import { expect, it } from 'vitest';
import type { Game } from '../types';
import { gameKind, isTrainingGame } from './gameKind';

const game = (changes: Partial<Game> = {}): Game => ({
  id: 'test',
  pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n\n1. e4 e5 *',
  white: 'Me',
  black: 'Rival',
  result: '1-0',
  date: 1,
  timeClass: 'blitz',
  timeControl: '180+2',
  source: 'chess.com',
  ...changes,
});

it.each(['CoachManolin', 'Coach-Manolin', 'Coach-Mae', 'COACH-Li', 'Robot'])(
  'does not classify a human nickname %s as a computer',
  (name) => {
    expect(gameKind(game({ black: name }))).toBe('regular');
    expect(isTrainingGame(game({ white: name }))).toBe(false);
  },
);

it.each(['Coach-Mae', 'Coach-Li', 'Dante', 'AnyNewCoach'])(
  'recognizes coach metadata regardless of its name: %s',
  (name) => {
    const pgn = '[Event "Play vs Coach"]\n[Site "Chess.com"]\n\n1. e4 e5 *';
    expect(
      gameKind(game({ black: name, pgn, url: 'https://www.chess.com/game/daily/263113958' })),
    ).toBe('coach');
    expect(gameKind(game({ white: name, pgn, source: 'pgn' }))).toBe('coach');
  },
);

it('recognizes imported computer games by their original Chess.com link', () => {
  expect(
    gameKind(
      game({
        source: 'pgn',
        pgn: '[Link "https://www.chess.com/game/computer/221355005"]\n\n1. e4 *',
      }),
    ),
  ).toBe('bot');
  expect(gameKind(game({ url: 'https://www.chess.com/game/computer/123?foo=bar' }))).toBe('bot');
});

it('uses explicit program player metadata even without a Chess.com link', () => {
  expect(gameKind(game({ source: 'pgn', pgn: '[BlackType "program"]\n\n1. e4 *' }))).toBe('bot');
});

it('ignores lookalike URLs and metadata inside move comments', () => {
  expect(gameKind(game({ url: 'https://www.chess.com.evil/game/computer/123' }))).toBe('regular');
  expect(gameKind(game({ pgn: '1. e4 {\n[Event "Play vs Coach"]\n} e5 *' }))).toBe('regular');
  expect(
    gameKind(
      game({ source: 'pgn', pgn: '[Event "Play vs Coach"]\n[Site "Another club"]\n\n1. e4 *' }),
    ),
  ).toBe('regular');
});

it('refreshes classification when game metadata changes, without modifying the game', () => {
  const original = game();
  const before = structuredClone(original);
  expect(gameKind(original)).toBe('regular');
  expect(original).toEqual(before);
  original.url = 'https://www.chess.com/game/computer/123';
  expect(gameKind(original)).toBe('bot');
  original.url = undefined;
  expect(gameKind(original)).toBe('regular');
});
