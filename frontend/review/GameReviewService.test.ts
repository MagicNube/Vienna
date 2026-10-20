import { beforeEach, expect, it, vi } from 'vitest';
import { makeTree } from '../chess/game';
import type { Analysis, EngineOptions } from '../types';
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), cancel: vi.fn(), put: vi.fn(), get: vi.fn() }));
vi.mock('../engine/EngineService', async (original) => ({
  ...(await original<typeof import('../engine/EngineService')>()),
  engine: {
    status: async () => ({ engineId: 'test-engine' }),
    analyzePosition: mocks.analyze,
    cancel: mocks.cancel,
  },
}));
vi.mock('../database/repository', () => ({ repository: { put: mocks.put, get: mocks.get } }));
import { GameReviewService } from './GameReviewService';
import { createBackgroundQueue } from './backgroundQueue';
import type { Game } from '../types';
const options: EngineOptions = { threads: 1, hash: 16, multiPv: 1, movetime: 100, depth: null };
const result: Analysis = {
  cached: false,
  engineId: 'test-engine',
  lines: [{ rank: 1, depth: 16, nodes: 100, cp: 0, mate: null, wdl: [0, 1000, 0], pv: ['e2e4'] }],
};
beforeEach(() => vi.resetAllMocks());
it('cancela una revisión pendiente sin publicar ni guardar resultados obsoletos', async () => {
  let finish!: (result: Analysis) => void;
  mocks.analyze.mockImplementation(
    () =>
      new Promise<Analysis>((resolve) => {
        finish = resolve;
      }),
  );
  const service = new GameReviewService();
  const progress = vi.fn();
  const running = service.run('old', makeTree('1. e4 *'), options, progress);
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalledOnce());
  await service.cancel();
  finish(result);
  await cancelled;
  expect(mocks.cancel).toHaveBeenCalledWith('review');
  expect(progress).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
});
it('permite una nueva revisión después de cancelar y guarda cada posición', async () => {
  const service = new GameReviewService();
  await service.cancel();
  mocks.analyze.mockResolvedValue(result);
  const progress = vi.fn();
  const review = await service.run('new', makeTree('1. e4 *'), options, progress);
  expect(review.complete).toBe(true);
  expect(Object.keys(review.positions)).toEqual(['m0', 'm1']);
  expect(mocks.put).toHaveBeenCalledTimes(2);
  expect(progress).toHaveBeenLastCalledWith(2, 2, expect.objectContaining({ complete: true }));
});

it('una revisión nueva conserva la anterior completa hasta terminar', async () => {
  mocks.get.mockResolvedValue({ complete: true });
  mocks.analyze.mockResolvedValue(result);
  await new GameReviewService().run('saved', makeTree('1. e4 *'), options, vi.fn());
  expect(mocks.put.mock.calls.map((call) => call[0])).toEqual(['review-drafts', 'reviews']);
});

it('cancelar un reanálisis no sobrescribe la revisión completa guardada', async () => {
  mocks.get.mockResolvedValue({ complete: true });
  let finish!: (value: Analysis) => void;
  mocks.analyze.mockResolvedValueOnce(result).mockImplementationOnce(
    () =>
      new Promise<Analysis>((resolve) => {
        finish = resolve;
      }),
  );
  const service = new GameReviewService();
  const running = service.run('saved', makeTree('1. e4 *'), options, vi.fn());
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalledTimes(2));
  await service.cancel();
  finish(result);
  await cancelled;
  expect(mocks.put.mock.calls.map((call) => call[0])).toEqual(['review-drafts']);
});

it('no publica progreso ni inicia otra posición al cancelar durante el guardado', async () => {
  mocks.analyze.mockResolvedValue(result);
  let finishSave!: () => void;
  mocks.put.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
  );
  const service = new GameReviewService();
  const progress = vi.fn();
  const running = service.run('saved', makeTree('1. e4 *'), options, progress);
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
  await service.cancel();
  finishSave();
  await cancelled;
  expect(progress).not.toHaveBeenCalled();
  expect(mocks.analyze).toHaveBeenCalledOnce();
});

it('pausa tras guardar la posición actual y reanuda sin repetir posiciones ni solapar partidas', async () => {
  let finish!: (value: Analysis) => void;
  mocks.analyze
    .mockImplementationOnce(
      () =>
        new Promise<Analysis>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(result);
  const service = new GameReviewService();
  const progress = vi.fn(),
    jobs = vi.fn(),
    notify = vi.fn();
  const first: Game = {
    id: 'a',
    pgn: '1. e4 *',
    white: 'A',
    black: 'B',
    date: 1,
    result: '*',
    source: 'pgn',
    timeClass: 'blitz',
    timeControl: '180',
  };
  const second = { ...first, id: 'b' };
  const queue = createBackgroundQueue({
    owner: { current: null },
    read: async () => null,
    compatible: () => false,
    run: async (game, onProgress) =>
      service.run(game.id, makeTree(game.pgn), options, (...args) => {
        progress(game.id, ...args);
        onProgress(...args);
      }),
    cancel: () => service.cancel(),
    pause: () => service.pause(),
    resume: () => service.resume(),
    onJobs: jobs,
    notify,
    onReview: vi.fn(),
  });
  await queue.add([first, second]);
  await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalledOnce());
  queue.pause();
  finish(result);
  await vi.waitFor(() => expect(progress).toHaveBeenCalledOnce());
  expect(mocks.analyze).toHaveBeenCalledOnce();
  expect(jobs.mock.lastCall?.[0]).toMatchObject({
    a: { state: 'paused', done: 1, total: 2 },
    b: { state: 'queued' },
  });
  expect(notify).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: 'Análisis en pausa', done: 1, paused: true }),
  );
  await queue.drain();
  expect(mocks.analyze).toHaveBeenCalledOnce();
  queue.resume();
  await vi.waitFor(() => expect(progress).toHaveBeenCalledTimes(4));
  expect(mocks.analyze.mock.calls.map((call) => call[1])).toEqual(['m0', 'm1', 'm0', 'm1']);
  expect(progress.mock.calls.map((call) => call[0])).toEqual(['a', 'a', 'b', 'b']);
  expect(jobs.mock.lastCall?.[0]).toEqual({});
  queue.stop();
});

it('cancelar durante la pausa libera la espera y no analiza otra posición', async () => {
  mocks.analyze.mockResolvedValue(result);
  const service = new GameReviewService(),
    progress = vi.fn();
  progress.mockImplementationOnce(() => service.pause());
  const running = service.run('paused', makeTree('1. e4 *'), options, progress);
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(progress).toHaveBeenCalledOnce());
  await service.cancel();
  await cancelled;
  expect(mocks.analyze).toHaveBeenCalledOnce();
  service.resume();
  const later = await service.run('later', makeTree('1. e4 *'), options, vi.fn());
  expect(later.complete).toBe(true);
});

it('parar todos con el servicio real despierta una pausa sin continuar las cien partidas', async () => {
  mocks.analyze.mockResolvedValue(result);
  const service = new GameReviewService();
  const owner = { current: null as 'manual' | 'auto' | null };
  const queue = createBackgroundQueue({
    owner,
    read: async () => null,
    compatible: () => true,
    run: (game, progress) => service.run(game.id, makeTree(game.pgn), options, progress),
    cancel: () => service.cancel(),
    pause: () => service.pause(),
    resume: () => service.resume(),
    notify: () => {},
    onReview: () => queue.pause(),
  });
  const games = Array.from({ length: 101 }, (_, i): Game => ({
    id: `queued-${i}`,
    pgn: '1. e4 *',
    white: 'Player',
    black: 'Opponent',
    date: 1,
    result: '*',
    source: 'pgn',
    timeClass: 'pgn',
    timeControl: '-',
  }));
  await queue.add(games);
  await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
  await queue.cancelAll();
  await vi.waitFor(() => expect(owner.current).toBeNull());
  expect(mocks.cancel).toHaveBeenCalledWith('review');
  expect(mocks.analyze).toHaveBeenCalledOnce();
  expect(mocks.put).toHaveBeenCalledOnce();
  queue.stop();
});
