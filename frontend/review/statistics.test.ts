import { describe, expect, it } from 'vitest';
import {
  ownColor,
  filteredEntries,
  gameResult,
  statistics,
  type StatisticsEntry,
} from './statistics';
import type { Game, MoveReview, Review } from '../types';

const game = (changes: Partial<Game> = {}): Game => ({
  id: 'one',
  pgn: '1. e4 *',
  white: 'PlayerOne',
  black: 'Rival',
  whiteElo: '700',
  blackElo: '900',
  result: '1-0',
  date: 100 * 86_400_000,
  timeClass: 'blitz',
  timeControl: '180+2',
  source: 'chess.com',
  ...changes,
});
const entry = (changes: Partial<Game> = {}, color: 'w' | 'b' = 'w'): StatisticsEntry => ({
  game: game(changes),
  color,
});
const move = (category: MoveReview['category'], color: 'w' | 'b', loss = 0): MoveReview => ({
  category,
  color,
  loss,
  ply: 1,
  explanation: '',
  best: 'e2e4',
});
const review = (moves: MoveReview[], complete = true): Review => ({
  version: 1,
  engineId: 'test',
  options: { threads: 1, hash: 64, multiPv: 4, movetime: 150, depth: null },
  positions: {},
  moves,
  complete,
});

describe('estadísticas de la cuenta', () => {
  it('identifica el color sin distinguir mayúsculas y excluye partidas ajenas', () => {
    expect(ownColor(game(), ' playerone ', 'b')).toBe('w');
    expect(ownColor(game({ white: 'Rival', black: 'PLAYERONE' }), 'PlayerOne', 'w')).toBe('b');
    expect(ownColor(game(), 'Otra cuenta', 'w')).toBeNull();
    expect(ownColor(game(), '', 'b')).toBe('b');
  });
  it('interpreta victoria y derrota desde el color propio, y reconoce tablas', () => {
    expect(gameResult(entry())).toBe('win');
    expect(gameResult(entry({}, 'b'))).toBe('loss');
    expect(gameResult(entry({ result: '0-1' }, 'b'))).toBe('win');
    expect(gameResult(entry({ result: '1/2-1/2' }, 'b'))).toBe('draw');
    expect(gameResult(entry({ result: '*' }))).toBeNull();
  });
  it('incluye tablas en el denominador del winrate y excluye partidas sin terminar', () => {
    const stats = statistics([
      entry(),
      entry({ result: '0-1' }),
      entry({ result: '1/2-1/2' }),
      entry({ result: '*' }),
    ]);
    expect(stats.finished).toBe(3);
    expect(stats.winrate).toBeCloseTo(100 / 3);
    expect(statistics([entry({ result: '*' })]).winrate).toBeNull();
  });
  it('combina periodo, modo y color, incluyendo el límite del periodo', () => {
    const now = 100 * 86_400_000;
    const entries = [
      entry({ id: 'edge', date: now - 7 * 86_400_000 }, 'b'),
      entry({ date: now - 8 * 86_400_000 }, 'b'),
      entry({ timeClass: 'rapid' }, 'b'),
      entry(),
      entry({ date: now + 1 }, 'b'),
    ];
    expect(
      filteredEntries(entries, { mode: 'blitz', days: 7, color: 'b' }, now).map((e) => e.game.id),
    ).toEqual(['edge']);
    expect(filteredEntries(entries, { mode: 'all', days: 0, color: 'all' }, now)).toHaveLength(5);
  });
  it('cuenta solo las jugadas propias de análisis completos, sin duplicar las del rival', () => {
    const entries = [
      {
        ...entry(),
        review: review([
          move('brilliant', 'w'),
          move('great', 'b'),
          move('book', 'w'),
          move('blunder', 'w', 0.25),
        ]),
      },
      { ...entry({ id: 'partial' }), review: review([move('brilliant', 'w')], false) },
      entry({ id: 'missing' }),
    ];
    const stats = statistics(entries);
    expect(stats.complete).toBe(1);
    expect(stats.partial).toBe(1);
    expect(stats.moves).toBe(3);
    expect(stats.counts.brilliant).toBe(1);
    expect(stats.counts.great).toBe(0);
    expect(stats.counts.book).toBe(1);
    expect(stats.accuracy).toBeCloseTo(100 * Math.exp(-4 * 0.125));
  });
  it('conserva las nueve categorías vacías y no inventa precisión sin análisis', () => {
    const stats = statistics([]);
    expect(Object.keys(stats.counts)).toHaveLength(9);
    expect(Object.values(stats.counts).every((n) => n === 0)).toBe(true);
    expect(stats.accuracy).toBeNull();
    expect(stats.elo).toEqual([]);
  });
  it('usa el Elo propio por modo en orden cronológico, no el del rival ni el orden de la lista', () => {
    const stats = statistics([
      entry({ id: 'new', date: 300, whiteElo: '750' }),
      entry({ id: 'old', date: 100, blackElo: '680' }, 'b'),
      entry({ id: 'rapid', date: 200, timeClass: 'rapid', whiteElo: '1100' }),
    ]);
    expect(stats.elo.map((e) => [e.mode, e.rating, e.delta])).toEqual([
      ['blitz', 750, 70],
      ['rapid', 1100, null],
    ]);
    expect(stats.elo[0].points.map((p) => p.id)).toEqual(['old', 'new']);
  });
  it('ignora Elo ausente o inválido y fechas inválidas sin ocultar resultados', () => {
    const stats = statistics([
      entry({ whiteElo: undefined }),
      entry({ whiteElo: '?' }),
      entry({ whiteElo: '0' }),
      entry({ whiteElo: '700.5' }),
      entry({ date: NaN }),
      entry({ date: 0 }),
    ]);
    expect(stats.finished).toBe(6);
    expect(stats.elo).toEqual([]);
  });
});
