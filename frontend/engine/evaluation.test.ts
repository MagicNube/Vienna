import { expect, it } from 'vitest';
import { score } from './EngineService';
import { evaluationSide } from './evaluation';
import type { EngineLine } from '../types';
const line = (cp: number | null, mate: number | null = null): EngineLine => ({
  cp,
  mate,
  wdl: null,
  pv: [],
  rank: 1,
  depth: 20,
  nodes: 1000,
});
it('usa el mismo signo desde blancas en todas las puntuaciones y el fondo corresponde al lado favorecido', () => {
  expect(score(line(232))).toBe('+2.32');
  expect(evaluationSide(line(232))).toBe('w');
  expect(score(line(-51))).toBe('−0.51');
  expect(evaluationSide(line(-51))).toBe('b');
  expect(score(line(0))).toBe('0.00');
  expect(evaluationSide(line(0))).toBeNull();
  expect(score(line(-0.1))).toBe('0.00');
});
it('mantiene la convención en mates y usa WDL para identificar al ganador de un mate terminado', () => {
  expect(score(line(null, 4))).toBe('+M4');
  expect(evaluationSide(line(null, 4))).toBe('w');
  expect(score(line(null, -4))).toBe('−M4');
  expect(evaluationSide(line(null, -4))).toBe('b');
  expect(evaluationSide({ ...line(null, 0), wdl: [0, 0, 1000] })).toBe('b');
});
it('no inventa una igualdad si falta la evaluación', () => {
  expect(score(undefined)).toBe('—');
  expect(score(line(null))).toBe('—');
  expect(evaluationSide(undefined)).toBeNull();
});
