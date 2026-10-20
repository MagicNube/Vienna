import { afterEach, expect, it, vi } from 'vitest';
import { repository } from '../database/repository';
import { createAutomaticSession } from './automaticStart';
import { autoCandidates } from './autoCandidates';
import { downloadGames } from '../api/chesscom';
import * as native from '../api/native';
import { createBackgroundQueue } from './backgroundQueue';
import type { Game } from '../types';

afterEach(() => vi.restoreAllMocks());
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

it('cada apertura excluye todo el historial anterior y las partidas jugadas con Vienna cerrada', () => {
  const first = createAutomaticSession(100);
  expect(first.prepare('Friend', [], 100)).toBe(100);
  const reopened = createAutomaticSession(300);
  const games = [
    game('history', 'Friend', 50),
    game('offline', 'Friend', 250),
    game('new', 'Friend', 350),
  ];
  const since = reopened.prepare('Friend', games, 400);
  expect(autoCandidates(games, 'Friend', since).map((g) => g.id)).toEqual(['new']);
});

it('no recupera fechas persistidas antiguas ni escribe un inicio que sobreviva al cierre', () => {
  const read = vi.spyOn(repository, 'get').mockResolvedValue(1 as never);
  const write = vi.spyOn(repository, 'put').mockResolvedValue();
  const session = createAutomaticSession(1_000);
  const history = Array.from({ length: 101 }, (_, i) => game(`old-${i}`, 'Friend', i + 1));
  expect(autoCandidates(history, 'Friend', session.prepare('Friend', history, 1_000))).toEqual([]);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it('incluye una partida terminada después de abrir aunque llegue en la primera descarga', () => {
  const session = createAutomaticSession(100);
  const games = [game('old', 'Friend', 50), game('while-choosing-account', 'Friend', 150)];
  const since = session.prepare('Friend', games, 200);
  expect(since).toBe(100);
  expect(autoCandidates(games, 'Friend', since).map((g) => g.id)).toEqual([
    'while-choosing-account',
  ]);
});

it('desactivar/reactivar o cambiar de cuenta en la misma apertura no desplaza el inicio', () => {
  const session = createAutomaticSession(100);
  expect(session.prepare('Friend', [], 150)).toBe(100);
  expect(session.prepare('Other', [], 200)).toBe(100);
  const games = [game('new', 'Friend', 250)];
  expect(session.prepare(' FRIEND ', games, 300)).toBe(100);
  expect(autoCandidates(games, 'Friend', session.get('friend')!)).toEqual(games);
});

it('un primer intento fallido no crea un historial vacío', () => {
  const session = createAutomaticSession(100);
  expect(session.get('Friend')).toBeNull();
  const history = [game('old', 'Friend', 50)];
  expect(session.prepare('Friend', history, 200)).toBe(100);
});

it('un reloj atrasado no encola 30 partidas antiguas de casi 19 días', () => {
  const realNow = Date.parse('2026-10-20T00:00:00Z');
  const deviceNow = realNow - 19 * 86_400_000;
  const session = createAutomaticSession(deviceNow);
  const history = Array.from({ length: 30 }, (_, i) =>
    game(`old-${i}`, 'Friend', realNow - (i + 1) * 15 * 3_600_000),
  );
  const since = session.prepare('Friend', history, deviceNow);
  expect(autoCandidates(history, 'Friend', since)).toEqual([]);
  const next = game('new', 'Friend', realNow + 60_000);
  expect(
    autoCandidates(
      [...history, next],
      'Friend',
      session.prepare('Friend', [...history, next], deviceNow + 60_000),
    ),
  ).toEqual([next]);
});

it('no usa partidas de otra cuenta, PGN ni partidas en curso para corregir el reloj', () => {
  const session = createAutomaticSession(100);
  const games = [
    game('old', 'Friend', 50),
    game('other', 'Another', 10_000),
    { ...game('pgn', 'Friend', 20_000), source: 'pgn' as const },
    { ...game('unfinished', 'Friend', 30_000), result: '*' },
  ];
  expect(session.prepare('Friend', games, 100)).toBe(100);
});

it('descargar las últimas cinco no las encola y la siguiente partida nueva sí entra', async () => {
  const openedAt = Date.parse('2026-10-19T23:30:00Z');
  const session = createAutomaticSession(openedAt);
  const archiveGame = (number: number, end: number) => ({
    pgn: `[White "Friend"]\n[Black "Opponent${number}"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
    end_time: Math.floor(end / 1000),
    time_class: 'blitz',
    time_control: '180',
    url: `https://www.chess.com/game/live/${number}`,
  });
  const historical = Array.from({ length: 5 }, (_, i) =>
    archiveGame(i, openedAt - (i + 1) * 3_600_000),
  );
  const rpc = vi.spyOn(native, 'rpc').mockResolvedValueOnce({ games: historical });
  const onJobs = vi.fn(),
    run = vi.fn();
  const queue = createBackgroundQueue({
    owner: { current: null },
    read: async () => null,
    compatible: () => true,
    run,
    cancel: async () => {},
    notify: () => {},
    onReview: () => {},
    onJobs,
  });
  queue.pause();
  try {
    const initial = await downloadGames('Friend');
    const since = session.prepare('Friend', initial, openedAt);
    await queue.add(autoCandidates(initial, 'Friend', since));
    expect(initial).toHaveLength(5);
    expect(onJobs).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ games: [...historical, archiveGame(6, openedAt + 60_000)] });
    const updated = await downloadGames('Friend');
    const candidates = autoCandidates(
      updated,
      'Friend',
      session.prepare('Friend', updated, openedAt + 120_000),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].black).toBe('Opponent6');
    await queue.add(candidates);
    expect(onJobs).toHaveBeenLastCalledWith({ [candidates[0].id]: { state: 'queued', done: 0 } });
    expect(run).not.toHaveBeenCalled();
  } finally {
    queue.stop();
  }
});
