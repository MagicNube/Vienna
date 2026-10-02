import { expect, it } from 'vitest';
import { makeTree } from './game';
import { openingForMove, withBookMove, withOpeningBook } from './openings';
import { accuracy } from '../review/classification';
import type { MoveReview, Review } from '../types';

it('reconoce e4 y e5 por posición y jugada, sin etiquetar cualquier jugada temprana', () => {
  const tree = makeTree('1. e4 e5 2. Ke2 Ke7 *');
  expect(openingForMove(tree.nodes[0], tree.nodes[1])).toBeDefined();
  expect(openingForMove(tree.nodes[1], tree.nodes[2])).toBeDefined();
  expect(openingForMove(tree.nodes[3], tree.nodes[4])).toBeUndefined();
});
it('reconoce transposiciones y respeta los derechos de enroque', () => {
  const tree = makeTree('1. Nf3 d5 2. d4 Nf6 3. c4 *');
  expect(openingForMove(tree.nodes[4], tree.nodes[5])).toBeDefined();
  const changed = { ...tree.nodes[4], fen: tree.nodes[4].fen.replace('KQkq', '-') };
  expect(openingForMove(changed, tree.nodes[5])).toBeUndefined();
});
it('no etiqueta como apertura una posición repetida mucho después', () => {
  const tree = makeTree('1. e4 *');
  expect(openingForMove(tree.nodes[0], { ...tree.nodes[1], ply: 65 })).toBeUndefined();
});
it('actualiza revisiones antiguas sin mutarlas y excluye Libro de la precisión', () => {
  const tree = makeTree('1. e4 *');
  const move: MoveReview = {
    ply: 1,
    color: 'w',
    category: 'excellent',
    loss: 0.01,
    explanation: '',
    best: 'd2d4',
  };
  const review: Review = {
    version: 1,
    engineId: 'test',
    options: { threads: 1, hash: 16, multiPv: 3, movetime: 100, depth: null },
    positions: {},
    moves: [move],
    complete: true,
  };
  const decorated = withOpeningBook(tree, review);
  expect(decorated.moves[0].category).toBe('book');
  expect(review.moves[0].category).toBe('excellent');
  expect(withBookMove(tree.nodes[0], tree.nodes[1])?.category).toBe('book');
  expect(accuracy(decorated.moves)).toBeNull();
  expect(accuracy([...decorated.moves, { ...move, loss: 0.1 }])).toBeCloseTo(100 * Math.exp(-0.4));
});
