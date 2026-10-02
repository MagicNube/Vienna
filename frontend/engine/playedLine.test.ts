import { expect, it } from 'vitest';
import { makeTree } from '../chess/game';
import { playedLine } from './playedLine';
import type { EngineLine, Review } from '../types';
const tree = makeTree('1. e4 e5 *');
const line: EngineLine = {
  rank: 1,
  depth: 20,
  nodes: 1,
  cp: 30,
  mate: null,
  wdl: null,
  pv: ['e2e4', 'e7e5'],
};
const review = {
  positions: { m1: { lines: [{ ...line, cp: -80, pv: ['e7e5'] }] } },
} as unknown as Review;
it('compara la jugada realizada con la misma búsqueda de las tres candidatas', () => {
  const result = playedLine(tree, tree.nodes[0], review, [line]);
  expect(result?.line?.cp).toBe(30);
  expect(result?.posterior).toBe(false);
});
it('identifica la evaluación posterior cuando la jugada no está entre las candidatas', () => {
  const result = playedLine(tree, tree.nodes[0], review, [{ ...line, pv: ['d2d4'] }]);
  expect(result?.line?.cp).toBe(-80);
  expect(result?.line?.pv).toEqual(['e2e4', 'e7e5']);
  expect(result?.posterior).toBe(true);
});
it('no inventa puntuaciones ni una jugada original para una variante o el final', () => {
  expect(playedLine(tree, tree.nodes[0], null, [])?.line).toBeUndefined();
  expect(playedLine(tree, { ...tree.nodes[0], main: false }, review, [line])).toBeNull();
  expect(playedLine(tree, tree.nodes.at(-1)!, review, [line])).toBeNull();
});
