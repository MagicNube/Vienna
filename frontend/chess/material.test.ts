import { expect, it } from 'vitest';
import { addMove, makeTree } from './game';
import { positionMaterial } from './material';

it('cuenta capturas por jugador y calcula la ventaja en la posición visitada', () => {
  const tree = makeTree('1. e4 d5 2. exd5 Qxd5 *');
  expect(positionMaterial(tree, 'm0')).toEqual({
    captured: { w: [], b: [] },
    advantage: { w: 0, b: 0 },
  });
  expect(positionMaterial(tree, 'm3')).toEqual({
    captured: { w: ['p'], b: [] },
    advantage: { w: 1, b: 0 },
  });
  expect(positionMaterial(tree, 'm4')).toEqual({
    captured: { w: ['p'], b: ['p'] },
    advantage: { w: 0, b: 0 },
  });
});
it('reconoce captura al paso y promoción, sin inventar capturas desde un FEN', () => {
  const ep = makeTree('1. e4 a6 2. e5 d5 3. exd6 *');
  expect(positionMaterial(ep, 'm5').captured.w).toEqual(['p']);
  const tree = makeTree('[SetUp "1"]\n[FEN "1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. axb8=Q+ *');
  expect(positionMaterial(tree, 'm0')).toEqual({
    captured: { w: [], b: [] },
    advantage: { w: 0, b: 4 },
  });
  expect(positionMaterial(tree, 'm1')).toEqual({
    captured: { w: ['r'], b: [] },
    advantage: { w: 9, b: 0 },
  });
});
it('las capturas de otra rama no se mezclan con la posición actual', () => {
  const original = makeTree('1. e4 d5 *');
  const capture = addMove(original, 'm2', 'e4', 'd5');
  const quiet = addMove(capture.tree, 'm2', 'b1', 'c3');
  expect(positionMaterial(quiet.tree, capture.node.id).advantage.w).toBe(1);
  expect(positionMaterial(quiet.tree, quiet.node.id).captured.w).toEqual([]);
});
