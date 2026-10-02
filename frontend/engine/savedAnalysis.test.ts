import { expect, it } from 'vitest';
import { makeTree } from '../chess/game';
import { savedAnalysis } from './savedAnalysis';
import type { Analysis, Review } from '../types';

const tree = makeTree('1. e4 e5 *');
const stored: Analysis = {
  cached: false,
  engineId: 'test',
  lines: [{ rank: 1, depth: 25, nodes: 1234, cp: 20, mate: null, wdl: null, pv: ['e2e4'] }],
};
const review: Review = {
  version: 1,
  engineId: 'test',
  complete: true,
  moves: [],
  options: { threads: 8, hash: 512, multiPv: 3, movetime: 5000, depth: null },
  positions: { m0: stored },
};
it('recupera las mismas líneas originales tras guardar, abrir y volver a la posición', () => {
  const reopened = JSON.parse(JSON.stringify(review)) as Review;
  expect(savedAnalysis(tree.nodes[0], reopened, false)?.lines).toEqual(stored.lines);
  expect(savedAnalysis(tree.nodes[1], reopened, false)).toBeUndefined();
  expect(savedAnalysis(tree.nodes[0], reopened, false)).toBe(reopened.positions.m0);
});
it('una variante con la misma FEN y el modo libre requieren su propio cálculo', () => {
  expect(savedAnalysis({ ...tree.nodes[0], main: false }, review, false)).toBeUndefined();
  expect(savedAnalysis(tree.nodes[0], review, true)).toBeUndefined();
});
it('reutiliza posiciones terminadas de una revisión parcial pero no posiciones sin líneas', () => {
  expect(savedAnalysis(tree.nodes[0], { ...review, complete: false }, false)).toBe(stored);
  expect(
    savedAnalysis(tree.nodes[0], { ...review, positions: { m0: { ...stored, lines: [] } } }, false),
  ).toBeUndefined();
});
