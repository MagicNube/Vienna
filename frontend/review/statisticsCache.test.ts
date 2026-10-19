import { beforeEach, expect, it, vi } from 'vitest';
import { StatisticsCache } from './statisticsCache';
import { repository } from '../database/repository';
import { CLASSIFICATION_VERSION } from './classification';
import type { Game, Review } from '../types';

vi.mock('../database/repository', () => ({
  repository: {
    get: vi.fn(),
    statisticsReviews: vi.fn(),
    cacheStatisticsReview: vi.fn(),
  },
}));
const summaries = vi.mocked(repository.statisticsReviews);
const get = vi.mocked(repository.get);
const save = vi.mocked(repository.cacheStatisticsReview);
const game: Game = {
  id: 'a',
  pgn: '1. e4 e5 *',
  white: 'One',
  black: 'Two',
  result: '*',
  date: 1,
  timeClass: 'blitz',
  timeControl: '180+2',
  source: 'pgn',
};
const review: Review = {
  version: 1,
  classificationVersion: CLASSIFICATION_VERSION,
  engineId: 'test',
  complete: true,
  options: { threads: 1, hash: 16, multiPv: 4, movetime: 500, depth: null },
  moves: [
    { ply: 1, color: 'w', category: 'book', loss: 0, best: 'e4', explanation: 'Texto largo' },
  ],
  positions: { m0: { lines: [], cached: true, engineId: 'test' } },
};
beforeEach(() => {
  vi.resetAllMocks();
  summaries.mockImplementation(async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { ...review, positions: {} }])),
  );
  get.mockResolvedValue(review);
  save.mockResolvedValue(true);
});

it('reutiliza la instantánea tras navegar y comparte cargas simultáneas, sin leer posiciones', async () => {
  const cache = new StatisticsCache();
  const a = cache.load([game]);
  const b = cache.load([game]);
  expect(a).toBe(b);
  const snapshot = await a;
  expect(await cache.load([{ ...game }])).toBe(snapshot);
  expect(cache.peek([game])).toBe(snapshot);
  expect(summaries).toHaveBeenCalledExactlyOnceWith(['a']);
  expect(get).not.toHaveBeenCalled();
  expect(snapshot.reviews.a.positions).toEqual({});
  expect(snapshot.reviews.a.moves[0].best).toBe('');
  expect(review.positions.m0).toBeDefined();
  expect(review.moves[0].explanation).toBe('Texto largo');
});

it('actualiza solo la partida terminada y conserva los números previos mientras cambia la instantánea', async () => {
  const cache = new StatisticsCache();
  const previous = await cache.load([game]);
  const updated = { ...review, moves: [{ ...review.moves[0], category: 'brilliant' as const }] };
  cache.updateReview(game.id, updated);
  expect(cache.peek([game])).toBeNull();
  expect(cache.previous([game])).toBe(previous);
  const next = await cache.load([game]);
  expect(next.reviews.a.moves[0].category).toBe('brilliant');
  expect(summaries).toHaveBeenCalledTimes(1);
  expect(get).not.toHaveBeenCalled();
  cache.updateReview(game.id, { ...updated, moves: [...updated.moves] });
  expect(cache.peek([game])).toBe(next);
});

it('solo pide los identificadores nuevos y recuerda las partidas sin análisis', async () => {
  const cache = new StatisticsCache();
  await cache.load([game]);
  summaries.mockResolvedValueOnce({});
  const second = { ...game, id: 'b' };
  await cache.load([game, second]);
  expect(summaries).toHaveBeenLastCalledWith(['b']);
  await cache.load([second]);
  expect(summaries).toHaveBeenCalledTimes(2);
  cache.updateReview('b', review);
  expect((await cache.load([second])).reviews.b.complete).toBe(true);
  expect(summaries).toHaveBeenCalledTimes(2);
});

it('refresca explícitamente y renueva perfiles cuando cambia el PGN', async () => {
  const cache = new StatisticsCache();
  const old = await cache.load([game]);
  const changed = { ...game, pgn: '1. d4 d5 *' };
  const next = await cache.load([changed]);
  expect(next.profiles.get('a')?.tree?.nodes[1].san).toBe('d4');
  expect(next.profiles.get('a')).not.toBe(old.profiles.get('a'));
  cache.invalidate();
  expect(cache.peek([changed])).toBeNull();
  expect(cache.previous([changed])).toBeNull();
  await cache.load([changed]);
  expect(summaries).toHaveBeenCalledTimes(3);
});

it('una lectura tardía no sobrescribe un análisis completado mientras esperaba', async () => {
  let finish!: (value: Record<string, Review>) => void;
  summaries.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const cache = new StatisticsCache();
  const old = cache.load([game]);
  const updated = { ...review, moves: [{ ...review.moves[0], category: 'excellent' as const }] };
  cache.updateReview('a', updated);
  const latest = await cache.load([game]);
  finish({ a: review });
  await old;
  expect(cache.peek([game])).toBe(latest);
  expect(latest.reviews.a.moves[0].category).toBe('excellent');
});

it('invalidar durante una carga no recupera análisis borrados', async () => {
  let finish!: (value: Record<string, Review>) => void;
  summaries.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const cache = new StatisticsCache();
  const old = cache.load([game]);
  cache.invalidate();
  summaries.mockResolvedValueOnce({});
  const latest = await cache.load([game]);
  finish({ a: review });
  await old;
  expect(cache.peek([game])).toBe(latest);
  expect(latest.reviews).toEqual({});
});

it('un fallo de lectura se puede reintentar sin guardar un resultado vacío como válido', async () => {
  summaries.mockRejectedValueOnce(Error('read failure'));
  const cache = new StatisticsCache();
  await expect(cache.load([game])).rejects.toThrow('read failure');
  expect(cache.peek([game])).toBeNull();
  expect((await cache.load([game])).reviews.a.complete).toBe(true);
});

it('actualiza etiquetas antiguas una sola vez y persiste solo el resumen derivado', async () => {
  const legacy = { ...review, classificationVersion: CLASSIFICATION_VERSION - 1 };
  summaries.mockResolvedValueOnce({ a: { ...legacy, positions: {} } });
  get.mockResolvedValueOnce(legacy);
  const cache = new StatisticsCache();
  await cache.load([game]);
  expect(get).toHaveBeenCalledExactlyOnceWith('reviews', 'a');
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.calls[0][2].classificationVersion).toBe(CLASSIFICATION_VERSION);
  expect(save.mock.calls[0][2].positions).toEqual({});
  expect(legacy.positions.m0).toBeDefined();
  await cache.load([game]);
  expect(get).toHaveBeenCalledTimes(1);
});

it('si termina un análisis durante la actualización de etiquetas, usa el resumen más nuevo', async () => {
  const legacy = { ...review, classificationVersion: CLASSIFICATION_VERSION - 1 };
  const newer = { ...review, moves: [{ ...review.moves[0], category: 'great' as const }] };
  summaries.mockResolvedValueOnce({ a: legacy }).mockResolvedValueOnce({ a: newer });
  get.mockResolvedValueOnce(legacy);
  save.mockResolvedValueOnce(false);
  expect((await new StatisticsCache().load([game])).reviews.a.moves[0].category).toBe('great');
});

it('no mezcla cuentas al conservar los resúmenes de partidas ya consultadas', async () => {
  const cache = new StatisticsCache();
  const other = { ...game, id: 'foreign', white: 'Other' };
  await cache.load([game]);
  const different = await cache.load([other]);
  expect(Object.keys(different.reviews)).toEqual(['foreign']);
  const original = await cache.load([game]);
  expect(Object.keys(original.reviews)).toEqual(['a']);
  expect(summaries).toHaveBeenCalledTimes(2);
  expect(cache.previous([other])).toBeNull();
});
