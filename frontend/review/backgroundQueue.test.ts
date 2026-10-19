import { expect, it, vi } from 'vitest';
import { createBackgroundQueue } from './backgroundQueue';
import type { Game, Review } from '../types';
const game = (id: string): Game => ({
  id,
  pgn: '1. e4 1-0',
  white: 'Me',
  black: 'Rival',
  date: 1,
  result: '1-0',
  source: 'chess.com',
  timeClass: 'blitz',
  timeControl: '180',
});
const result: Review = {
  version: 1,
  engineId: 'engine',
  complete: true,
  options: { threads: 8, hash: 512, multiPv: 3, movetime: 5000, depth: null },
  moves: [],
  positions: {},
};
function setup() {
  const owner = { current: null as 'auto' | 'manual' | null };
  const saved = new Map<string, Review>();
  const read = vi.fn(async (game: Game) => saved.get(game.id) ?? null);
  const run = vi.fn(
    async (game: Game, progress: (done: number, total: number, review: Review) => void) => {
      progress(1, 2, { ...result, complete: false });
      saved.set(game.id, result);
      return result;
    },
  );
  const notify = vi.fn(),
    onJobs = vi.fn(),
    onReview = vi.fn(),
    cancel = vi.fn(async () => {});
  const queue = createBackgroundQueue({
    owner,
    read,
    run,
    cancel,
    notify,
    onJobs,
    onReview,
    compatible: (review) => review.version === 1 && review.engineId === 'engine',
  });
  return { queue, owner, saved, read, run, notify, onReview, cancel, onJobs };
}

it('una cola pausada acepta partidas nuevas pero no empieza ninguna hasta reanudar', async () => {
  const t = setup();
  t.queue.pause();
  await t.queue.add([game('a'), game('b')]);
  t.queue.analyze(game('c'), t.run);
  await t.queue.drain();
  expect(t.run).not.toHaveBeenCalled();
  expect(t.onJobs.mock.lastCall?.[0]).toMatchObject({
    a: { state: 'queued' },
    b: { state: 'queued' },
    c: { state: 'queued' },
  });
  t.queue.resume();
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledTimes(3));
  expect(t.run.mock.calls.map((call) => call[0].id)).toEqual(['a', 'b', 'c']);
  expect(t.cancel).not.toHaveBeenCalled();
  t.queue.stop();
});
it('serializa nuevas partidas recibidas durante un análisis y no repite las completadas', async () => {
  const t = setup();
  let finish!: (review: Review) => void;
  t.run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  t.queue.add([game('a')]);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  t.queue.add([game('a'), game('b'), game('b')]);
  await t.queue.drain();
  expect(t.run).toHaveBeenCalledOnce();
  t.saved.set('a', result);
  finish(result);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(t.owner.current).toBeNull());
  await t.queue.add([game('a'), game('b')]);
  expect(t.onJobs).toHaveBeenLastCalledWith({});
  expect(t.run.mock.calls.map((call) => call[0].id)).toEqual(['a', 'b']);
  expect(t.notify).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'success',
      gameId: 'b',
      id: expect.stringMatching(/^b:\d+:complete$/),
    }),
  );
  t.queue.stop();
});
it('publica el inicio antes de la primera posición y actualiza las marcas de ambas listas', async () => {
  const t = setup();
  let finish!: (review: Review) => void;
  let update!: (done: number, total: number, review: Review) => void;
  t.run.mockImplementationOnce((_game, progress) => {
    update = progress;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  t.queue.add([game('new')]);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  expect(t.onJobs).toHaveBeenLastCalledWith({ new: { state: 'analysing', done: 0 } });
  await t.queue.add([game('waiting')]);
  expect(t.onJobs).toHaveBeenLastCalledWith({
    new: { state: 'analysing', done: 0 },
    waiting: { state: 'queued', done: 0 },
  });
  update(2, 10, { ...result, complete: false });
  expect(t.onJobs.mock.lastCall?.[0].new).toEqual({ state: 'analysing', done: 2, total: 10 });
  finish(result);
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  expect(t.run.mock.calls.map(([game]) => game.id)).toEqual(['new', 'waiting']);
  t.queue.stop();
});

it('un sondeo con otra partida activa no marca como pendientes las ya analizadas', async () => {
  const t = setup();
  t.saved.set('completed-b', result);
  t.saved.set('completed-c', result);
  t.saved.set('partial', { ...result, complete: false });
  let finish!: (review: Review) => void;
  t.run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await t.queue.add([game('active')]);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  await t.queue.add([game('active'), game('completed-b'), game('completed-c'), game('partial')]);
  expect(t.onJobs).toHaveBeenLastCalledWith({
    active: { state: 'analysing', done: 0 },
    partial: { state: 'queued', done: 0 },
  });
  expect(t.onJobs.mock.calls.every(([jobs]) => !jobs['completed-b'] && !jobs['completed-c'])).toBe(
    true,
  );
  expect(t.saved.get('completed-b')).toBe(result);
  expect(t.onReview).not.toHaveBeenCalled();
  finish(result);
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  expect(t.run.mock.calls.map(([g]) => g.id)).toEqual(['active', 'partial']);
  t.queue.stop();
});

it('un sondeo no oculta ni sustituye un reanálisis manual solicitado durante la lectura', async () => {
  const t = setup();
  let finishRead!: (review: Review | null) => void;
  t.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const scanning = t.queue.add([game('same')]);
  let finish!: (review: Review) => void;
  const manual = vi.fn(
    () =>
      new Promise<Review>((resolve) => {
        finish = resolve;
      }),
  );
  t.queue.analyze(game('same'), manual);
  await vi.waitFor(() => expect(manual).toHaveBeenCalledOnce());
  finishRead(null);
  await scanning;
  expect(t.onJobs).toHaveBeenLastCalledWith({
    same: { state: 'analysing', done: 0, manual: true },
  });
  expect(t.run).not.toHaveBeenCalled();
  finish(result);
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  t.queue.stop();
});

it('cerrar mientras comprueba una partida no publica una cola ni inicia el motor después', async () => {
  const t = setup();
  let finishRead!: (review: Review | null) => void;
  t.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const scanning = t.queue.add([game('new')]);
  t.queue.stop();
  finishRead(null);
  await scanning;
  expect(t.onJobs).toHaveBeenCalledExactlyOnceWith({});
  expect(t.run).not.toHaveBeenCalled();
  expect(t.notify).not.toHaveBeenCalled();
});

it('conserva el orden y evita duplicados aunque las lecturas terminen en otro orden', async () => {
  const t = setup();
  t.owner.current = 'manual';
  const reads = new Map<string, (review: Review | null) => void>();
  t.read.mockImplementationOnce(
    (g) =>
      new Promise((resolve) => {
        reads.set(g.id, resolve);
      }),
  );
  t.read.mockImplementationOnce(
    (g) =>
      new Promise((resolve) => {
        reads.set(g.id, resolve);
      }),
  );
  const scanning = t.queue.add([game('a'), game('b'), game('a')]);
  await t.queue.add([game('b'), game('a')]);
  expect(t.read).toHaveBeenCalledTimes(2);
  reads.get('b')!(null);
  reads.get('a')!(null);
  await scanning;
  expect(t.onJobs).toHaveBeenLastCalledWith({
    a: { state: 'queued', done: 0 },
    b: { state: 'queued', done: 0 },
  });
  t.owner.current = null;
  await t.queue.drain();
  expect(t.run.mock.calls.map(([g]) => g.id)).toEqual(['a', 'b']);
  t.queue.stop();
});
it('espera al análisis manual y reanuda una revisión parcial cancelada', async () => {
  const t = setup();
  t.owner.current = 'manual';
  t.queue.add([game('a')]);
  expect(t.run).not.toHaveBeenCalled();
  t.owner.current = null;
  let reject!: (error: Error) => void;
  let update!: (done: number, total: number, review: Review) => void;
  t.run.mockImplementationOnce((_game, progress) => {
    update = progress;
    return new Promise((_resolve, no) => {
      reject = no;
    });
  });
  const pending = t.queue.drain();
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  t.owner.current = 'manual';
  update(1, 2, result);
  reject(Error('cancelled'));
  await pending;
  expect(t.owner.current).toBe('manual');
  expect(t.onReview).not.toHaveBeenCalled();
  t.owner.current = null;
  t.saved.set('a', { ...result, complete: false });
  await t.queue.add([game('a')]);
  await vi.waitFor(() => expect(t.owner.current).toBeNull());
  expect(t.run).toHaveBeenCalledTimes(2);
  expect(t.onReview).toHaveBeenLastCalledWith(game('a'), result);
  t.queue.stop();
});
it('cerrar el trabajador cancela y descarta resultados tardíos sin publicar éxito', async () => {
  const t = setup();
  let finish!: (review: Review) => void;
  let update!: (done: number, total: number, review: Review) => void;
  t.run.mockImplementationOnce((_game, progress) => {
    update = progress;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  t.queue.add([game('a')]);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  t.queue.stop();
  update(2, 2, result);
  finish(result);
  await Promise.resolve();
  expect(t.cancel).toHaveBeenCalledOnce();
  expect(t.onReview).not.toHaveBeenCalled();
  expect(t.notify.mock.calls.some(([a]) => a?.kind === 'success')).toBe(false);
});
it('solicitar un análisis manual espera al automático sin cortarlo', async () => {
  const t = setup();
  let finish!: (review: Review) => void;
  t.run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  t.queue.add([game('automatic')]);
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  const manual = vi.fn(async () => result);
  t.queue.analyze(game('manual'), manual);
  expect(t.cancel).not.toHaveBeenCalled();
  expect(manual).not.toHaveBeenCalled();
  expect(t.onJobs.mock.lastCall?.[0].manual).toEqual({ state: 'queued', done: 0, manual: true });
  finish(result);
  await vi.waitFor(() => expect(manual).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  expect(t.onReview.mock.calls.map(([g]) => g.id)).toEqual(['automatic', 'manual']);
  expect(t.cancel).not.toHaveBeenCalled();
  t.queue.stop();
});
it('mantiene un reanálisis manual al recibir otras partidas y permite cancelarlo explícitamente', async () => {
  const t = setup();
  t.saved.set('manual', result);
  let reject!: (error: Error) => void;
  let update!: (done: number, total: number, review: Review) => void;
  const manual = vi.fn((_game: Game, progress: typeof update) => {
    update = progress;
    return new Promise<Review>((_resolve, no) => {
      reject = no;
    });
  });
  t.queue.analyze(game('manual'), manual);
  await vi.waitFor(() => expect(manual).toHaveBeenCalledOnce());
  update(3, 10, { ...result, complete: false });
  t.queue.add([game('new'), game('manual')]);
  t.queue.analyze(game('manual'), manual);
  expect(manual).toHaveBeenCalledOnce();
  expect(t.run).not.toHaveBeenCalled();
  expect(t.cancel).not.toHaveBeenCalled();
  expect(t.onJobs.mock.lastCall?.[0].manual).toEqual({
    state: 'analysing',
    done: 3,
    total: 10,
    manual: true,
  });
  await t.queue.cancelJob('manual');
  update(4, 10, { ...result, complete: false });
  reject(Error('cancelled'));
  await vi.waitFor(() => expect(t.run).toHaveBeenCalledOnce());
  expect(t.cancel).toHaveBeenCalledOnce();
  expect(
    t.onReview.mock.calls.filter(([g]) => g.id === 'manual').map(([, r]) => r.complete),
  ).toEqual([false, true]);
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  t.queue.stop();
});
it('cancelar una solicitud en cola conserva el análisis activo y repetir muestra un aviso nuevo', async () => {
  const t = setup();
  let finish!: (review: Review) => void;
  const first = vi.fn(
    () =>
      new Promise<Review>((resolve) => {
        finish = resolve;
      }),
  );
  const waiting = vi.fn(async () => result);
  t.queue.analyze(game('a'), first);
  await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
  t.queue.analyze(game('b'), waiting);
  await t.queue.cancelJob('b');
  expect(t.cancel).not.toHaveBeenCalled();
  finish(result);
  await vi.waitFor(() => expect(t.owner.current).toBeNull());
  expect(waiting).not.toHaveBeenCalled();
  const notice = t.notify.mock.lastCall?.[0].id;
  t.queue.analyze(
    game('a'),
    vi.fn(async () => result),
  );
  await vi.waitFor(() => expect(t.notify.mock.lastCall?.[0].id).not.toBe(notice));
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  expect(t.notify.mock.lastCall?.[0]).toMatchObject({
    kind: 'success',
    title: 'Partida analizada',
  });
  t.queue.stop();
});
it('encola tres solicitudes manuales y las termina en orden sin búsquedas simultáneas', async () => {
  const t = setup();
  const finishes = new Map<string, (review: Review) => void>();
  let active = 0;
  let maxActive = 0;
  const order: string[] = [];
  const run = vi.fn(async (game: Game) => {
    order.push(game.id);
    maxActive = Math.max(maxActive, ++active);
    const review = await new Promise<Review>((resolve) => finishes.set(game.id, resolve));
    active--;
    return review;
  });
  t.queue.analyze(game('a'), run);
  t.queue.analyze(game('b'), run);
  t.queue.analyze(game('c'), run);
  t.queue.analyze(game('b'), run);
  await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(t.onJobs.mock.lastCall?.[0]).toMatchObject({
    a: { state: 'analysing' },
    b: { state: 'queued' },
    c: { state: 'queued' },
  });
  await Promise.all([t.queue.drain(), t.queue.drain()]);
  expect(order).toEqual(['a']);
  finishes.get('a')!(result);
  await vi.waitFor(() => expect(order).toEqual(['a', 'b']));
  expect(t.onJobs.mock.lastCall?.[0]).toMatchObject({
    b: { state: 'analysing' },
    c: { state: 'queued' },
  });
  await t.queue.drain();
  expect(run).toHaveBeenCalledTimes(2);
  finishes.get('b')!(result);
  await vi.waitFor(() => expect(order).toEqual(['a', 'b', 'c']));
  finishes.get('c')!(result);
  await vi.waitFor(() => expect(t.onJobs).toHaveBeenLastCalledWith({}));
  expect(order).toEqual(['a', 'b', 'c']);
  expect(maxActive).toBe(1);
  expect(active).toBe(0);
  expect(t.cancel).not.toHaveBeenCalled();
  t.queue.stop();
});
it('reintenta un fallo en el siguiente sondeo y recalcula análisis incompatibles', async () => {
  const t = setup();
  t.run.mockRejectedValueOnce(Error('engine failed'));
  t.saved.set('a', { ...result, engineId: 'old-engine' });
  t.queue.add([game('a')]);
  await vi.waitFor(() =>
    expect(t.notify).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'error' })),
  );
  expect(t.run).toHaveBeenCalledOnce();
  t.queue.add([game('a')]);
  await vi.waitFor(() =>
    expect(t.notify).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'success' })),
  );
  expect(t.run).toHaveBeenCalledTimes(2);
  t.queue.stop();
});
