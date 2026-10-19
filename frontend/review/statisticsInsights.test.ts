import { describe, expect, it } from 'vitest';
import {
  gameProfile,
  gamePhase,
  openingStatistics,
  phaseStatistics,
  accuracyEvolution,
  comparisonStatistics,
  sortStatisticsRows,
  resultStreaks,
  type InsightEntry,
} from './statisticsInsights';
import { filteredEntries } from './statistics';
import { makeTree } from '../chess/game';
import type { Game, MoveReview, Review } from '../types';

function entry(
  id: string,
  pgn = '1. e4 e5 2. Nc3 Nf6 *',
  result = '1-0',
  color: 'w' | 'b' = 'w',
): InsightEntry {
  const game: Game = {
    id,
    pgn,
    result,
    white: 'White',
    black: 'Black',
    date: 1000,
    timeClass: 'blitz',
    timeControl: '180+2',
    source: 'pgn',
  };
  return { game, color, profile: gameProfile(game) };
}
const move = (
  ply: number,
  category: MoveReview['category'],
  loss = 0,
  color: 'w' | 'b' = 'w',
): MoveReview => ({ ply, category, loss, color, explanation: '', best: '' });
const review = (moves: MoveReview[], complete = true): Review => ({
  version: 1,
  engineId: 'test',
  options: { threads: 1, hash: 16, multiPv: 1, movetime: 100, depth: null },
  complete,
  positions: {},
  moves,
});

it('excludes coach and bot games from every statistics view, not human Coach names', () => {
  const human = entry('human');
  human.game.black = 'CoachManolin';
  human.review = review([move(1, 'excellent', 0.01)]);
  const coach = entry('coach', '[Event "Play vs Coach"]\n[Site "Chess.com"]\n\n1. e4 e5 *');
  coach.review = review([move(1, 'brilliant')]);
  const bot = entry('bot');
  bot.game.url = 'https://www.chess.com/game/computer/123';
  bot.review = review([move(1, 'brilliant')]);
  const mixed = [human, coach, bot];
  expect(openingStatistics(mixed)).toEqual(openingStatistics([human]));
  expect(phaseStatistics(mixed)).toEqual(phaseStatistics([human]));
  expect(accuracyEvolution(mixed)).toEqual(accuracyEvolution([human]));
  expect(resultStreaks(mixed)).toEqual(resultStreaks([human]));
  for (const group of ['mode', 'color', 'rival'] as const)
    expect(comparisonStatistics(mixed, group)).toEqual(comparisonStatistics([human], group));
  expect(mixed).toHaveLength(3);
});

describe('repertorio', () => {
  it('identifica la apertura real y agrupa variantes conocidas de la vienesa', () => {
    const first = entry('a');
    const second = entry('b', '1. e4 e5 2. Nc3 Nc6 3. Bc4 *');
    expect(first.profile.opening).toBe('Vienna Game');
    expect(second.profile.opening).toBe('Vienna Game');
    expect(openingStatistics([first, second])).toHaveLength(1);
  });
  it('separa colores y cuenta tablas como medio punto, excluyendo partidas sin resultado', () => {
    const rows = openingStatistics([
      entry('a'),
      entry('b', undefined, '1/2-1/2'),
      entry('c', undefined, '*'),
      entry('d', undefined, '1-0', 'b'),
    ]);
    expect(rows[0]).toMatchObject({
      color: 'w',
      games: 3,
      finished: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      winrate: 50,
      scoreRate: 75,
    });
    expect(rows[1]).toMatchObject({ color: 'b', losses: 1, winrate: 0, scoreRate: 0 });
  });
  it('usa solo la precisión propia y completa, sin inventarla por jugadas de libro', () => {
    const a = {
      ...entry('a'),
      review: review([move(1, 'book'), move(3, 'good', 0.05), move(2, 'blunder', 0.5, 'b')]),
    };
    const b = { ...entry('b'), review: review([move(1, 'blunder', 0.8)], false) };
    expect(openingStatistics([a, b])[0].accuracy).toBeCloseTo(100 * Math.exp(-0.2));
    expect(openingStatistics([a, b])[0].analyzed).toBe(1);
    expect(openingStatistics([entry('c')])[0].accuracy).toBeNull();
  });
  it('no atribuye una apertura a un final importado y tolera un PGN dañado', () => {
    const custom = entry(
      'a',
      '[SetUp "1"]\n[FEN "8/4k3/8/8/8/8/4K3/R6r w - - 0 30"]\n\n30. Ke3 Kf6 *',
    );
    expect(custom.profile.opening).toBe('Posición personalizada');
    expect(entry('bad', 'no es un PGN').profile.tree).toBeNull();
  });
});

describe('fases', () => {
  it('usa el material antes de la jugada y prioriza finales importados desde el inicio', () => {
    const tree = makeTree('*');
    expect(gamePhase(tree.nodes[0])).toBe('opening');
    expect(
      gamePhase({ ...tree.nodes[0], fen: tree.nodes[0].fen.replace('0 1', '0 11'), ply: 20 }),
    ).toBe('middle');
    expect(gamePhase({ ...tree.nodes[0], fen: tree.nodes[0].fen.replace('0 1', '0 30') })).toBe(
      'middle',
    );
    const custom = entry(
      'end',
      '[SetUp "1"]\n[FEN "8/4k3/8/8/8/8/4K3/R6r w - - 0 30"]\n\n30. Ke3 Kf6 *',
    );
    expect(gamePhase(custom.profile.tree!.nodes[0])).toBe('end');
  });
  it('normaliza fallos por jugadas y excluye movimientos del rival y análisis parciales', () => {
    const pgn =
      '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. Nf3 Nf6 6. Ng1 Ng8 7. Nf3 Nf6 8. Ng1 Ng8 9. Nf3 Nf6 10. Ng1 Ng8 11. Nf3 Nf6 *';
    const a = {
      ...entry('a', pgn),
      review: review([
        move(1, 'mistake', 0.1),
        move(3, 'good'),
        move(2, 'blunder', 0.5, 'b'),
        move(21, 'miss', 0.2),
      ]),
    };
    const partial = { ...entry('p', pgn), review: review([move(1, 'blunder')], false) };
    const [opening, middle, end] = phaseStatistics([a, partial]);
    expect(opening).toMatchObject({ moves: 2, games: 1, mistake: 1, blunder: 0, failureRate: 50 });
    expect(middle).toMatchObject({ moves: 1, miss: 1, failureRate: 100 });
    expect(end).toMatchObject({ moves: 0, failureRate: null, accuracy: null });
  });
});

describe('evolución', () => {
  it('ordena cronológicamente y excluye libros, análisis parciales y fechas inválidas', () => {
    const a = { ...entry('a'), review: review([move(1, 'good', 0.1)]) };
    const b = {
      ...entry('b'),
      game: { ...entry('b').game, date: 2000 },
      review: review([move(1, 'blunder', 0.3), move(2, 'mistake', 0.5, 'b')]),
    };
    const book = { ...entry('book'), review: review([move(1, 'book')]) };
    const partial = { ...entry('partial'), review: review([move(1, 'good')], false) };
    const badDate = { ...a, game: { ...a.game, id: 'bad', date: NaN } };
    const points = accuracyEvolution([b, book, partial, badDate, a]);
    expect(points.map((point) => point.id)).toEqual(['a', 'b']);
    expect(points[1].failures).toBe(1);
    expect(points[1].sample).toBe(2);
    expect(points[1].averageAccuracy).toBeCloseTo((points[0].accuracy + points[1].accuracy) / 2);
  });
  it('limita la media móvil a diez partidas y respeta los filtros compartidos', () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...entry(String(index)),
      game: {
        ...entry(String(index)).game,
        date: index + 1,
        timeClass: index === 0 ? 'rapid' : 'blitz',
      },
      review: review([move(1, index ? 'good' : 'blunder', index ? 0 : 0.5)]),
    }));
    const points = accuracyEvolution(entries);
    expect(points.at(-1)?.sample).toBe(10);
    expect(points.at(-1)?.averageAccuracy).toBe(100);
    const filtered = filteredEntries(
      entries,
      { mode: 'rapid', days: 0, color: 'all' },
      100,
    ) as InsightEntry[];
    expect(accuracyEvolution(filtered)).toHaveLength(1);
    expect(openingStatistics(filtered)[0].games).toBe(1);
    expect(phaseStatistics(filtered)[0].blunder).toBe(1);
  });
});

describe('comparativas y ordenación', () => {
  it('agrupa rivales sin distinguir mayúsculas y respeta color y tablas', () => {
    const a = entry('a', undefined, '1-0');
    const b = {
      ...entry('b', undefined, '1/2-1/2', 'b'),
      game: { ...entry('b').game, white: 'black', black: 'Me', result: '1/2-1/2' },
    };
    const unfinished = { ...a, game: { ...a.game, id: 'c', result: '*' } };
    expect(comparisonStatistics([a, b, unfinished], 'rival')[0]).toMatchObject({
      name: 'Black',
      games: 3,
      finished: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      winrate: 50,
      scoreRate: 75,
    });
    expect(comparisonStatistics([a, b], 'color')).toHaveLength(2);
    expect(comparisonStatistics([a, b], 'mode')[0].name).toBe('Blitz');
  });
  it('puts missing precision last in both sort directions and does not mutate input', () => {
    const rows = [
      { name: 'C', games: 1, accuracy: null },
      { name: 'B', games: 3, accuracy: 90 },
      { name: 'A', games: 2, accuracy: 80 },
    ];
    expect(sortStatisticsRows(rows, 'accuracy', true).map((r) => r.name)).toEqual(['B', 'A', 'C']);
    expect(sortStatisticsRows(rows, 'accuracy', false).map((r) => r.name)).toEqual(['A', 'B', 'C']);
    expect(sortStatisticsRows(rows, 'games', true).map((r) => r.name)).toEqual(['B', 'A', 'C']);
    expect(sortStatisticsRows(rows, 'name', false).map((r) => r.name)).toEqual(['A', 'B', 'C']);
    expect(rows.map((r) => r.name)).toEqual(['C', 'B', 'A']);
  });
  it('a draw ends the win streak but preserves unbeaten streak; unfinished games do neither', () => {
    const games = ['1-0', '1-0', '1/2-1/2', '0-1', '1-0', '*'].map((result, i) => ({
      ...entry(String(i), undefined, result),
      game: { ...entry(String(i)).game, result, date: i + 1 },
    }));
    expect(resultStreaks(games.reverse())).toEqual({
      bestWins: 2,
      bestUnbeaten: 3,
      currentWins: 1,
      currentUnbeaten: 1,
    });
    expect(resultStreaks([])).toEqual({
      bestWins: 0,
      bestUnbeaten: 0,
      currentWins: 0,
      currentUnbeaten: 0,
    });
  });
});
