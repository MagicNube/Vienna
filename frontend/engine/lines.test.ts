import { expect, it } from 'vitest';
import { distinctLines, engineArrows, isInitialPosition } from './lines';
import { makeTree } from '../chess/game';
import type { EngineLine } from '../types';
const line = (rank: number, move: string): EngineLine => ({
  rank,
  pv: [move],
  depth: 25,
  nodes: 1,
  cp: 20,
  mate: null,
  wdl: null,
});
it('el hover sustituye flechas automáticas y restaura sus preferencias al salir', () => {
  const lines = [line(1, 'e2e4'), line(2, 'd2d4'), line(3, 'g1f3')];
  expect(engineArrows(lines, true, true)).toHaveLength(2);
  expect(engineArrows(lines, true, true, 'g1f3')).toEqual([
    { orig: 'g1', dest: 'f3', brush: 'enginePreview', modifiers: { lineWidth: 11 } },
  ]);
  expect(engineArrows(lines, true, true)).toHaveLength(2);
  expect(engineArrows(lines, false, true)).toEqual([
    { orig: 'd2', dest: 'd4', brush: 'engineSecond', modifiers: { lineWidth: 5 } },
  ]);
  expect(engineArrows(lines, true, false)).toEqual([
    { orig: 'e2', dest: 'e4', brush: 'engineBest', modifiers: { lineWidth: 9 } },
  ]);
  expect(engineArrows(lines, false, false)).toEqual([]);
  expect(engineArrows(lines, false, false, 'g1f3')).toHaveLength(1);
});
it('no sustituye la segunda opción por la primera si falta una segunda línea', () => {
  expect(engineArrows([line(1, 'e2e4')], false, true)).toEqual([]);
});
it('oculta sugerencias solo en el inicio normal, conservándolas en posiciones personalizadas', () => {
  const tree = makeTree('1. e4 e5 *');
  expect(isInitialPosition(tree.nodes[0])).toBe(true);
  expect(isInitialPosition(tree.nodes[1])).toBe(false);
  expect(isInitialPosition({ ...tree.nodes[0], fen: tree.nodes[1].fen })).toBe(false);
  expect(isInitialPosition({ ...tree.nodes[0], ply: 4 })).toBe(false);
});
it('no repite candidatas ni dibuja dos flechas para la misma jugada', () => {
  const lines = [line(3, 'g1f3'), line(2, 'd2d4'), line(1, 'd2d4')];
  expect(distinctLines(lines).map((line) => line.rank)).toEqual([1, 3]);
  expect(engineArrows(lines, true, true)).toHaveLength(2);
});
