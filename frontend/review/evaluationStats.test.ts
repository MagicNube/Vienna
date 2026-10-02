import { expect, it } from 'vitest';
import { evaluationStats, evaluationStatLabel } from './evaluationStats';
import type { EngineLine, Review } from '../types';

const line = (
  cp: number | null,
  mate: number | null = null,
  wdl: EngineLine['wdl'] = null,
): EngineLine => ({ cp, mate, wdl, rank: 1, depth: 20, nodes: 1000, pv: [] });
const review = (lines: EngineLine[]): Review => ({
  complete: true,
  version: 1,
  engineId: 'test',
  options: { threads: 1, hash: 16, multiPv: 3, movetime: 5000, depth: null },
  moves: [],
  positions: Object.fromEntries(
    lines.map((line, i) => [`m${i}`, { lines: [line], cached: false, engineId: 'test' }]),
  ),
});

it('calcula extremos sin recortar a la escala del gráfico y los invierte para negras', () => {
  const game = review([line(0), line(-900), line(150), line(49)]);
  const white = evaluationStats(game, 4, 'w')!;
  expect(white.minimum!.ply).toBe(1);
  expect(evaluationStatLabel(white.minimum!.line, 'w')).toBe('−9.00');
  expect(white.maximum!.ply).toBe(2);
  expect(white.advantage).toBe(25);
  const black = evaluationStats(game, 4, 'b')!;
  expect(black.minimum!.ply).toBe(2);
  expect(black.maximum!.ply).toBe(1);
  expect(evaluationStatLabel(black.maximum!.line, 'b')).toBe('+9.00');
  expect(black.advantage).toBe(25);
});
it('distingue dominio constante de una remontada y cuenta la ventaja desde +0.50', () => {
  const domination = evaluationStats(review([line(0), line(50), line(300)]), 3, 'w')!;
  expect(domination.minimum!.ply).toBe(0);
  expect(domination.advantage).toBe(67);
  const comeback = evaluationStats(review([line(0), line(-400), line(600)]), 3, 'w')!;
  expect(comeback.minimum!.ply).toBe(1);
  expect(comeback.maximum!.ply).toBe(2);
  expect(comeback.advantage).toBe(33);
});
it('excluye mates de los extremos numéricos pero los conserva en el porcentaje de ventaja', () => {
  const game = review([
    line(1000),
    line(null, -3),
    line(null, 7),
    line(null, 2),
    line(null, 0, [1000, 0, 0]),
  ]);
  expect(evaluationStats(game, 5, 'w')!.minimum!.ply).toBe(0);
  expect(evaluationStats(game, 5, 'w')!.maximum!.ply).toBe(0);
  expect(evaluationStats(game, 5, 'b')!.minimum!.ply).toBe(0);
  expect(evaluationStats(game, 5, 'w')!.advantage).toBe(80);
  expect(evaluationStatLabel(game.positions.m4.lines[0], 'w')).toBe('Mate a favor');
  expect(evaluationStatLabel(game.positions.m4.lines[0], 'b')).toBe('Mate en contra');
});
it('no inventa un valor numérico cuando todas las posiciones son de mate', () => {
  const stats = evaluationStats(review([line(null, 4), line(null, -2)]), 2, 'w')!;
  expect(stats.minimum).toBeNull();
  expect(stats.maximum).toBeNull();
  expect(stats.advantage).toBe(50);
});
it('no presenta estadísticas parciales ni mezcla posiciones ajenas a la partida original', () => {
  const game = review([line(0), line(50)]);
  expect(evaluationStats(null, 2, 'w')).toBeNull();
  expect(evaluationStats({ ...game, complete: false }, 2, 'w')).toBeNull();
  expect(evaluationStats({ ...game, positions: {} }, 2, 'w')).toBeNull();
  game.positions.custom = { lines: [line(-1000)], cached: false, engineId: 'test' };
  expect(evaluationStats(game, 2, 'w')!.minimum!.ply).toBe(0);
});
