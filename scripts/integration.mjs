import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
const data = path.resolve('test-results', `integration-${Date.now()}`);
await mkdir(data, { recursive: true });
const bin = path.resolve(
  process.env.VIENNA_TEST_BRIDGE ??
    `src-tauri/target/debug/vienna-bridge${process.platform === 'win32' ? '.exe' : ''}`,
);
function start() {
  const child = spawn(bin, [], {
    windowsHide: true,
    env: { ...process.env, VIENNA_DATA_DIR: data },
  });
  let next = 0;
  const pending = new Map();
  let events = 0;
  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    const r = JSON.parse(line);
    if (r.event) {
      events++;
      return;
    }
    const p = pending.get(r.id);
    if (!p) return;
    pending.delete(r.id);
    clearTimeout(p.timer);
    r.error ? p.reject(Error(r.error)) : p.resolve(r.result);
  });
  child.stderr.on('data', (d) => process.stderr.write(d));
  return {
    call(command, args = {}) {
      return new Promise((resolve, reject) => {
        const id = ++next;
        const timer = setTimeout(() => reject(Error(`Timeout: ${command}`)), 45000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ id, command, args }) + '\n');
      });
    },
    get events() {
      return events;
    },
    stop() {
      child.stdin.end();
      child.kill();
      rl.close();
    },
  };
}
let bridge = start();
const options = { threads: 1, hash: 16, multiPv: 3, movetime: 150, depth: null };
const chess = new Chess();
const args = { fen: chess.fen(), history: [], options, lane: 'interactive', requestId: 'smoke' };
try {
  const status = await bridge.call('status');
  assert.equal(status.available, true);
  assert.equal(status.name, 'Stockfish 19');
  assert.equal(status.engineId.length, 64);
  console.log('PASS Stockfish 19 oficial detectado');
  const result = await bridge.call('analyze', args);
  assert.equal(result.lines.length, 3);
  assert.equal(
    new Set(result.lines.map((l) => l.depth)).size,
    1,
    'MultiPV must use one complete depth',
  );
  assert.ok(result.lines[0].depth > 0);
  assert.ok(result.lines.every((l) => l.wdl?.reduce((a, b) => a + b, 0) === 1000));
  for (const l of result.lines) {
    const c = new Chess();
    for (const u of l.pv) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  }
  assert.ok(bridge.events > 0);
  console.log('PASS UCI real, MultiPV=3, WDL y continuaciones legales');
  assert.equal((await bridge.call('analyze', args)).cached, true);
  console.log('PASS caché SQLite con parámetros idénticos');
  const black = await bridge.call('analyze', { ...args, history: ['e2e4'], requestId: 'black' });
  assert.equal(black.lines.length, 3);
  console.log('PASS análisis con historial y turno negro');
  const infinite = bridge.call('analyze', {
    ...args,
    options: { ...options, movetime: 0 },
    requestId: 'infinite',
  });
  const rejected = assert.rejects(infinite, /cancelled/);
  await new Promise((r) => setTimeout(r, 200));
  await bridge.call('cancel', { lane: 'interactive' });
  await rejected;
  console.log('PASS cancelación de análisis sin límite');
  const old = bridge.call('analyze', {
    ...args,
    options: { ...options, movetime: 5000 },
    requestId: 'old',
  });
  const oldRejected = assert.rejects(old, /cancelled/);
  await new Promise((r) => setTimeout(r, 100));
  const latest = await bridge.call('analyze', { ...args, history: ['d2d4'], requestId: 'latest' });
  await oldRejected;
  assert.equal(latest.lines.length, 3);
  console.log('PASS una posición nueva cancela la anterior');
  const background = bridge.call('analyze', {
    ...args,
    lane: 'review',
    history: ['c2c4'],
    options: { ...options, movetime: 500 },
    requestId: 'background-review',
  });
  const foreground = bridge.call('analyze', {
    ...args,
    options: { ...options, movetime: 0 },
    requestId: 'foreground-navigation',
  });
  const foregroundCancelled = assert.rejects(foreground, /cancelled/);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await bridge.call('cancel', { lane: 'interactive' });
  await foregroundCancelled;
  assert.equal((await background).lines.length, 3);
  console.log(
    'PASS navegar/cancelar el análisis interactivo conserva la revisión en segundo plano',
  );
  await assert.rejects(
    bridge.call('analyze', { ...args, options: { ...options, multiPv: 10 } }),
    /Parámetros/,
  );
  console.log('PASS parámetros inválidos rechazados');
  for (const kind of ['games', 'variants', 'reviews', 'settings'])
    await bridge.call('put', { kind, id: 'test', value: { retained: true, kind } });
  for (const [id, complete, version] of [
    ['ready', true, 1],
    ['pending', false, 1],
    ['old', true, 0],
  ])
    await bridge.call('put', {
      kind: 'reviews',
      id,
      value: { complete, version, positions: { retained: true } },
    });
  assert.deepEqual(await bridge.call('review-index', { version: 1 }), ['ready']);
  const statsReview = {
    version: 1,
    classificationVersion: 11,
    complete: true,
    engineId: status.engineId,
    options,
    moves: [
      {
        ply: 1,
        color: 'w',
        category: 'excellent',
        loss: 0.01,
        best: 'e4',
        explanation: 'Descripción completa',
      },
    ],
    positions: { m0: result, m1: black },
  };
  await bridge.call('put', { kind: 'reviews', id: 'statistics', value: statsReview });
  const summaries = await bridge.call('statistics-reviews', { ids: ['statistics', 'missing'] });
  assert.deepEqual(Object.keys(summaries), ['statistics']);
  assert.deepEqual(summaries.statistics.positions, {});
  assert.equal(summaries.statistics.moves[0].category, 'excellent');
  assert.equal(summaries.statistics.moves[0].loss, 0.01);
  assert.equal(summaries.statistics.moves[0].explanation, '');
  assert.equal(
    await bridge.call('cache-statistics-review', {
      id: 'statistics',
      expected: summaries.statistics,
      value: { ...summaries.statistics, classificationVersion: 12 },
    }),
    true,
  );
  bridge.stop();
  bridge = start();
  for (const kind of ['games', 'variants', 'reviews', 'settings'])
    assert.equal((await bridge.call('get', { kind, id: 'test' })).retained, true);
  assert.equal((await bridge.call('analyze', args)).cached, true);
  assert.deepEqual(await bridge.call('review-index', { version: 1 }), ['ready', 'statistics']);
  const reopenedSummaries = await bridge.call('statistics-reviews', { ids: ['statistics'] });
  assert.equal(reopenedSummaries.statistics.classificationVersion, 12);
  assert.deepEqual(await bridge.call('get', { kind: 'reviews', id: 'statistics' }), statsReview);
  assert.equal(
    await bridge.call('cache-statistics-review', {
      id: 'statistics',
      expected: summaries.statistics,
      value: summaries.statistics,
    }),
    false,
  );
  console.log(
    'PASS resúmenes estadísticos persistentes, compactos y protegidos ante escrituras antiguas',
  );
  assert.equal(
    (await bridge.call('get', { kind: 'reviews', id: 'ready' })).positions.retained,
    true,
  );
  console.log('PASS índice compacto de análisis completos, sin modificar las revisiones guardadas');
  console.log('PASS partidas, variantes, revisión, ajustes y caché sobreviven al reinicio');
  if (process.env.TEST_CHESSCOM) {
    const remote = await bridge.call('sync', { username: 'erik', months: 1 });
    assert.ok(Array.isArray(remote.games));
    console.log(`PASS PubAPI real: ${remote.games.length} partidas`);
  }
  console.log('Integración nativa completada. Base aislada:', data);
} finally {
  bridge.stop();
}
