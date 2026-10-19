import { expect, it, vi } from 'vitest';
import { canToggleSeen, SeenGames, SEEN_GAMES_KIND, type SeenGame } from './seenGames';

function storage(initial: SeenGame[] = []) {
  const records = new Map(initial.map((r) => [r.gameId, r]));
  return {
    records,
    list: vi.fn(async () => [...records.values()]),
    put: vi.fn(async (kind: string, id: string, value: SeenGame) => {
      expect(kind).toBe(SEEN_GAMES_KIND);
      records.set(id, value);
    }),
  };
}

it('bloquea nuevas marcas sin análisis completo, pero permite quitar marcas ya existentes', () => {
  expect(canToggleSeen(false, false)).toBe(false);
  expect(canToggleSeen(false, true, true)).toBe(false);
  expect(canToggleSeen(false, true, false)).toBe(true);
  expect(canToggleSeen(true, false, true)).toBe(true);
});

it('carga solo partidas marcadas y conserva el estado al reiniciar sin marcar nuevas', async () => {
  const db = storage([
    { gameId: 'old', seen: true, updatedAt: 1 },
    { gameId: 'unseen', seen: false, updatedAt: 1 },
  ]);
  const store = new SeenGames(db);
  expect([...(await store.load())]).toEqual(['old']);
  expect((await store.load()).has('new')).toBe(false);
  expect(db.list).toHaveBeenCalledTimes(1);
  await store.setSeen('new', true);
  expect([...(await new SeenGames(db).load())]).toEqual(['old', 'new']);
  await store.setSeen('old', false);
  expect([...(await new SeenGames(db).load())]).toEqual(['new']);
  expect(db.put.mock.calls.every(([kind]) => kind === SEEN_GAMES_KIND)).toBe(true);
});

it('no marca una partida si falla el guardado y permite reintentarlo', async () => {
  const db = storage();
  db.put.mockRejectedValueOnce(Error('disk'));
  const store = new SeenGames(db);
  await expect(store.setSeen('a', true)).rejects.toThrow('disk');
  expect((await store.load()).has('a')).toBe(false);
  expect((await store.setSeen('a', true)).has('a')).toBe(true);
});

it('no pierde marcas simultáneas de partidas distintas ni desordena cambios de una misma', async () => {
  const db = storage();
  const store = new SeenGames(db);
  await Promise.all([
    store.setSeen('a', true),
    store.setSeen('a', false),
    store.setSeen('b', true),
  ]);
  expect([...(await store.load())]).toEqual(['b']);
  expect([...(await new SeenGames(db).load())]).toEqual(['b']);
});

it('una carga fallida no queda cacheada y sus snapshots no pueden alterar el estado', async () => {
  const db = storage([{ gameId: 'a', seen: true, updatedAt: 1 }]);
  db.list.mockRejectedValueOnce(Error('read'));
  const store = new SeenGames(db);
  await expect(store.load()).rejects.toThrow('read');
  (await store.load()).clear();
  expect([...(await store.load())]).toEqual(['a']);
});

it('retira marcas sin análisis completo y conserva las válidas al reiniciar', async () => {
  const db = storage([
    { gameId: 'complete', seen: true, updatedAt: 1 },
    { gameId: 'partial', seen: true, updatedAt: 1 },
    { gameId: 'missing', seen: true, updatedAt: 1 },
  ]);
  const store = new SeenGames(db);
  expect([...(await store.clearUnanalysed(new Set(['complete'])))]).toEqual(['complete']);
  expect(db.records.get('partial')?.seen).toBe(false);
  expect(db.records.get('missing')?.seen).toBe(false);
  expect(db.records.get('complete')?.updatedAt).toBe(1);
  const restart = new SeenGames(db);
  expect([...(await restart.clearUnanalysed(new Set(['complete', 'partial'])))]).toEqual([
    'complete',
  ]);
  expect(db.put).toHaveBeenCalledTimes(2);
});
