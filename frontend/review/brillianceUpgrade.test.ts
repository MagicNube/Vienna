import { expect, it } from 'vitest';
import { makeTree } from '../chess/game';
import { upgradeReview } from './upgradeReview';
import { accuracy, CLASSIFICATION_VERSION } from './classification';
import type { EngineLine, Review } from '../types';

it('revisa una Brillante de versión 8 usando la evidencia guardada sin perder análisis ni precisión', () => {
  const tree = makeTree('[SetUp "1"]\n[FEN "3r2k1/8/8/8/3Q4/8/P7/1N4K1 w - - 0 1"]\n\n1. a3 *');
  const line: EngineLine = {
    rank: 1,
    depth: 20,
    nodes: 1000,
    cp: 0,
    mate: null,
    wdl: null,
    pv: ['a2a3', 'd8d4', 'b1c3'],
  };
  const review: Review = {
    version: 1,
    classificationVersion: 8,
    engineId: 'stored',
    complete: true,
    options: { threads: 1, hash: 64, multiPv: 4, movetime: 5000, depth: null },
    positions: {
      m0: { lines: [line, { ...line, rank: 2, pv: ['b1c3'] }], cached: true, engineId: 'stored' },
      m1: { lines: [{ ...line, pv: ['d8d4', 'b1c3'] }], cached: true, engineId: 'stored' },
    },
    moves: [
      {
        ply: 1,
        color: 'w',
        category: 'brilliant',
        loss: 0,
        explanation: 'Old label',
        best: 'a2a3',
      },
    ],
  };
  const updated = upgradeReview(tree, review);
  expect(updated.classificationVersion).toBe(CLASSIFICATION_VERSION);
  expect(updated.moves).toHaveLength(1);
  expect(updated.moves[0].category).toBe('best');
  expect(updated.positions).toBe(review.positions);
  expect(updated.options).toBe(review.options);
  expect(updated.complete).toBe(true);
  expect(accuracy(updated.moves)).toBe(accuracy(review.moves));
  expect(review.moves[0].category).toBe('brilliant');
  expect(upgradeReview(tree, updated)).toBe(updated);
});
