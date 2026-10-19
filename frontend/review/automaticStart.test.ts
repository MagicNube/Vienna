import { afterEach, expect, it, vi } from 'vitest';
import { repository } from '../database/repository';
import { automaticStart } from './automaticStart';
import { autoCandidates } from './autoCandidates';
import type { Game } from '../types';

afterEach(() => vi.restoreAllMocks());
function storage() {
  const values = new Map<string, number>();
  vi.spyOn(repository, 'get').mockImplementation(
    async (_kind, key) => (values.get(key) ?? null) as never,
  );
  const put = vi.spyOn(repository, 'put').mockImplementation(async (_kind, key, value) => {
    values.set(key, value as number);
  });
  return { values, put };
}
const game = (id: string, user: string, date: number): Game => ({
  id,
  white: user,
  black: 'Rival',
  date,
  pgn: '1. e4 1-0',
  result: '1-0',
  source: 'chess.com',
  timeClass: 'blitz',
  timeControl: '180',
});

it('la instalación vacía descarga historial pero solo analiza partidas terminadas desde la conexión', async () => {
  storage();
  const since = await automaticStart('Friend', 100);
  const downloaded = [game('history', 'Friend', 50), game('new', 'Friend', 101)];
  expect(autoCandidates(downloaded, 'Friend', since).map((g) => g.id)).toEqual(['new']);
});

it('cada cuenta nueva tiene su propio inicio aunque la biblioteca ya contenga otras cuentas', async () => {
  storage();
  await automaticStart('Me', 10);
  const since = await automaticStart('Friend', 100);
  const all = [
    game('mine', 'Me', 150),
    game('old-friend', 'Friend', 50),
    game('new-friend', 'Friend', 120),
  ];
  expect(autoCandidates(all, 'Friend', since).map((g) => g.id)).toEqual(['new-friend']);
});

it('reabrir o regresar a una cuenta conserva el inicio y recupera partidas jugadas con la app cerrada', async () => {
  storage();
  await automaticStart(' Me ', 100);
  await automaticStart('Friend', 200);
  const since = await automaticStart('ME', 300);
  expect(since).toBe(100);
  expect(autoCandidates([game('offline', 'Me', 250)], ' Me ', since).map((g) => g.id)).toEqual([
    'offline',
  ]);
});

it('dos sincronizaciones concurrentes comparten el mismo inicio sin sobrescribirlo', async () => {
  const { put } = storage();
  const first = automaticStart('Me', 100);
  const second = automaticStart('me', 200);
  expect(await Promise.all([first, second])).toEqual([100, 100]);
  expect(put).toHaveBeenCalledOnce();
});

it('un error al guardar el inicio se reintenta y no deja una petición bloqueada', async () => {
  const { put } = storage();
  put.mockRejectedValueOnce(Error('disk'));
  await expect(automaticStart('Me', 100)).rejects.toThrow('disk');
  expect(await automaticStart('Me', 200)).toBe(200);
});
