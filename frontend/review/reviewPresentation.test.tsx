import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewSummary } from '../components/ReviewSummary';
import { upgradeReview } from './upgradeReview';
import { CLASSIFICATION_VERSION } from './classification';
import fixtures from './fixtures/category-regressions.json';
import type { EngineLine, Game, GameTree, Review } from '../types';
import { makeTree } from '../chess/game';

const fixture = fixtures[0];
const tree = {
  rootFen: fixture.before.fen,
  nodes: [fixture.before, fixture.after],
  mainIds: [fixture.before.id, fixture.after.id],
} as GameTree;
const legacy = {
  version: 1,
  engineId: 'test',
  complete: true,
  options: { threads: 8, hash: 256, multiPv: 3, movetime: 5000, depth: null },
  positions: {
    [fixture.before.id]: { lines: fixture.lines },
    [fixture.after.id]: { lines: [fixture.next] },
  },
  moves: [
    {
      ply: 48,
      color: 'b',
      category: 'brilliant',
      loss: 0,
      explanation: 'Anterior',
      best: fixture.after.uci,
    },
  ],
} as Review;

it('actualiza etiquetas antiguas conservando las evaluaciones y la partida completa', () => {
  const upgraded = upgradeReview(tree, legacy);
  expect(upgraded.positions).toBe(legacy.positions);
  expect(upgraded.complete).toBe(true);
  expect(upgraded.moves[0].category).toBe('best');
  expect(upgraded.classificationVersion).toBe(CLASSIFICATION_VERSION);
  expect(upgradeReview(tree, upgraded)).toBe(upgraded);
});
it.each([true, false])(
  'reclasifica una pérdida de 19 puntos sin volver a analizar (completa=%s)',
  (complete) => {
    const sourceTree = makeTree(`[SetUp "1"]\n[FEN "${fixture.before.fen}"]\n\n24... Qd7 *`);
    const [before, after] = sourceTree.nodes;
    const stored: Review = {
      ...legacy,
      classificationVersion: 2,
      complete,
      positions: {
        [before.id]: {
          cached: true,
          engineId: 'test',
          lines: [
            {
              ...fixture.lines[0],
              cp: null,
              wdl: [0, 0, 1000] as [number, number, number],
              pv: ['e7c5'],
            },
            {
              ...fixture.lines[1],
              cp: -Math.log(0.81 / 0.19) / 0.00368208,
              wdl: [190, 0, 810] as [number, number, number],
              pv: ['e7d7'],
            },
          ],
        },
        [after.id]: { cached: true, engineId: 'test', lines: [fixture.next as EngineLine] },
      },
      moves: [{ ...legacy.moves[0], ply: after.ply, category: 'blunder', loss: 0.19 }],
    };
    const updated = upgradeReview(sourceTree, stored);
    expect(updated.moves[0].category).toBe('mistake');
    expect(updated.moves[0].loss).toBeCloseTo(0.19);
    expect(updated.positions).toBe(stored.positions);
    expect(updated.options).toBe(stored.options);
    expect(updated.complete).toBe(complete);
    expect(stored.moves[0].category).toBe('blunder');
    expect(upgradeReview(sourceTree, updated)).toBe(updated);
  },
);
it('oculta porcentajes y recuentos hasta completar la revisión', () => {
  const game = { white: 'Blancas', black: 'Negras' } as Game;
  const partial = renderToStaticMarkup(
    <ReviewSummary review={{ ...legacy, complete: false }} game={game} onCategory={() => {}} />,
  );
  expect(partial).not.toContain('%');
  expect(partial).not.toContain('category-table');
  const complete = renderToStaticMarkup(
    <ReviewSummary review={upgradeReview(tree, legacy)} game={game} onCategory={() => {}} />,
  );
  expect(complete).toContain('%');
  expect(complete).toContain('category-table');
});
