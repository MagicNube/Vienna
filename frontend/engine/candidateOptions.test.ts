import { expect, it } from 'vitest';
import { candidateOptions, candidateRank } from './candidateOptions';
import type { EngineLine } from '../types';
const moves = ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3', 'b2b3'];
const lines = (scores: number[]): EngineLine[] =>
  scores.map((cp, index) => ({
    rank: index + 1,
    cp,
    mate: null,
    wdl: null,
    depth: 20,
    nodes: 1000,
    pv: [moves[index]],
  }));

it.each(['w', 'b'] as const)('conserva una quinta alternativa cercana para %s', (color) => {
  const candidates = lines([30, 20, 15, 10, 5, 0].map((cp) => (color === 'w' ? cp : -cp)));
  expect(candidateOptions(candidates, color)).toEqual(candidates.slice(0, 5));
});
it.each(['w', 'b'] as const)(
  'oculta una quinta claramente peor sin ocultar la jugada real (%s)',
  (color) => {
    const candidates = lines([30, 20, 15, 10, -300].map((cp) => (color === 'w' ? cp : -cp)));
    expect(candidateOptions(candidates, color)).toEqual(candidates.slice(0, 4));
    expect(candidateOptions(candidates, color, moves[4])).toEqual(candidates);
  },
);
it('no elimina alternativas a partir de una iteración incompleta', () => {
  const candidates = lines([30, 20, 15, 10, -300]);
  candidates[4].depth--;
  expect(candidateOptions(candidates, 'w')).toEqual(candidates);
});
it('las líneas se ordenan y no se cuenta dos veces el mismo movimiento', () => {
  const candidates = lines([30, 20, 15, 10, 5]);
  expect(
    candidateOptions([candidates[3], candidates[0], candidates[0], ...candidates], 'w'),
  ).toEqual(candidates);
  expect(candidateRank([...candidates, candidates[0]], moves[4])).toBe(5);
});
it('no inventa la posición exacta de una jugada fuera de MultiPV', () => {
  expect(candidateRank(lines([30, 20, 15, 10]), moves[4])).toBeNull();
  expect(candidateRank([], moves[0])).toBeNull();
  expect(candidateOptions([], 'w')).toEqual([]);
});
it('no recomienda filas sin un movimiento y no oculta la cuarta por ser mala', () => {
  const candidates = lines([30, 20, 15, -1000]);
  expect(candidateOptions([...candidates, { ...candidates[0], pv: [] }], 'w')).toEqual(candidates);
});
it('una quinta que permite mate se oculta, pero se conserva cuando es la jugada de la partida', () => {
  const candidates = lines([30, 20, 15, 10, -300]);
  candidates[4] = { ...candidates[4], cp: null, mate: -1 };
  expect(candidateOptions(candidates, 'w')).toHaveLength(4);
  expect(candidateOptions(candidates, 'w', moves[4])).toHaveLength(5);
});
