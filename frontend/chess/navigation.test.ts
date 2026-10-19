import { expect, it } from 'vitest';
import { addMove, makeTree } from './game';
import { navigationTargets } from './navigation';
import { freeLine } from './freeBoard';

it('desactiva límites de la partida y todas las flechas en un tablero vacío', () => {
  const empty = makeTree('*');
  expect(navigationTargets(empty, empty.nodes[0])).toEqual({
    first: null,
    prev: null,
    next: null,
    last: null,
  });
  const tree = makeTree('1. e4 e5 2. Nf3 *');
  expect(navigationTargets(tree, tree.nodes[0])).toEqual({
    first: null,
    prev: null,
    next: 'm1',
    last: 'm3',
  });
  expect(navigationTargets(tree, tree.nodes[1])).toEqual({
    first: 'm0',
    prev: 'm0',
    next: 'm2',
    last: 'm3',
  });
  expect(navigationTargets(tree, tree.nodes[3])).toEqual({
    first: 'm0',
    prev: 'm2',
    next: null,
    last: null,
  });
});

it('el final de una variante no salta a la continuación de la partida original', () => {
  const main = makeTree('1. e4 e5 2. Nf3 Nc6 *');
  const branch = addMove(main, 'm1', 'c7', 'c5');
  const tip = addMove(branch.tree, branch.node.id, 'g1', 'f3');
  expect(navigationTargets(tip.tree, branch.node)).toEqual({
    first: 'm1',
    prev: 'm1',
    next: tip.node.id,
    last: tip.node.id,
  });
  expect(navigationTargets(tip.tree, tip.node)).toEqual({
    first: 'm1',
    prev: branch.node.id,
    next: null,
    last: null,
  });
  expect(navigationTargets(tip.tree, tip.tree.nodes[1]).next).toBe('m2');
});

it('el modo libre sigue su rama elegida al retroceder y llegar a sus límites', () => {
  const main = makeTree('1. e4 e5 2. Nf3 Nc6 *');
  const branch = addMove(main, 'm1', 'c7', 'c5');
  const line = freeLine(branch.tree, branch.node.id, branch.node.id);
  expect(navigationTargets(branch.tree, branch.node, line)).toEqual({
    first: 'm0',
    prev: 'm1',
    next: null,
    last: null,
  });
  expect(navigationTargets(branch.tree, branch.tree.nodes[1], line)).toEqual({
    first: 'm0',
    prev: 'm0',
    next: branch.node.id,
    last: branch.node.id,
  });
  expect(navigationTargets(branch.tree, branch.tree.nodes[0], line)).toEqual({
    first: null,
    prev: null,
    next: 'm1',
    last: branch.node.id,
  });
});
