import { expect, it } from 'vitest';
import { makeTree } from './game';
import { openingForMove, withBookMove } from './openings';
import { accuracy } from '../review/classification';
import type { MoveReview } from '../types';

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
it('etiqueta Libro sin mutar la valoración y lo excluye de la precisión', () => {
  const tree = makeTree('1. e4 *');
  const move: MoveReview = {
    ply: 1,
    color: 'w',
    category: 'excellent',
    loss: 0.01,
    explanation: '',
    best: 'd2d4',
  };
  const decorated = withBookMove(tree.nodes[0], tree.nodes[1], move)!;
  expect(decorated.category).toBe('book');
  expect(move.category).toBe('excellent');
  expect(withBookMove(tree.nodes[0], tree.nodes[1])?.category).toBe('book');
  expect(accuracy([decorated])).toBeNull();
  expect(accuracy([decorated, { ...move, loss: 0.1 }])).toBeCloseTo(100 * Math.exp(-0.4));
});
