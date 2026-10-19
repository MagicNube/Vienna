import { expect, it } from 'vitest';
import { makeTree } from '../chess/game';
import { savedAnalysis, reviewMatchesOptions } from './savedAnalysis';
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

it('permite reanalizar al cambiar motor, profundidad, tiempo o pedir más líneas', () => {
  expect(reviewMatchesOptions(review, review.options, 'test')).toBe(true);
  expect(reviewMatchesOptions(review, review.options, 'new-engine')).toBe(false);
  expect(reviewMatchesOptions(review, { ...review.options, depth: 20 }, 'test')).toBe(false);
  expect(reviewMatchesOptions(review, { ...review.options, movetime: 2000 }, 'test')).toBe(false);
  expect(reviewMatchesOptions(review, { ...review.options, multiPv: 5 }, 'test')).toBe(false);
  const limited = { ...review, options: { ...review.options, depth: 16 } };
  expect(reviewMatchesOptions(limited, review.options, 'test')).toBe(false);
});

it('reutiliza el mismo análisis con menos líneas o distintos recursos del equipo', () => {
  expect(
    reviewMatchesOptions(review, { ...review.options, threads: 2, hash: 128, multiPv: 2 }, 'test'),
  ).toBe(true);
  expect(reviewMatchesOptions({ ...review, complete: false }, review.options, 'test')).toBe(false);
  expect(reviewMatchesOptions(null, review.options, 'test')).toBe(false);
});
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
