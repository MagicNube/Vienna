import { expect, it } from 'vitest';
import { distinctLines, engineArrows } from './lines';
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
    { orig: 'g1', dest: 'f3', brush: 'yellow', modifiers: { lineWidth: 10 } },
  ]);
  expect(engineArrows(lines, true, true)).toHaveLength(2);
  expect(engineArrows(lines, false, true)).toEqual([]);
  expect(engineArrows(lines, false, false, 'g1f3')).toHaveLength(1);
});
it('no repite candidatas ni dibuja dos flechas para la misma jugada', () => {
  const lines = [line(3, 'g1f3'), line(2, 'd2d4'), line(1, 'd2d4')];
  expect(distinctLines(lines).map((line) => line.rank)).toEqual([1, 3]);
  expect(engineArrows(lines, true, true)).toHaveLength(2);
});
