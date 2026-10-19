import { describe, expect, it } from 'vitest';
import { moveExpectation } from './moveQuality';
import { classify } from './classification';
import { makeTree } from '../chess/game';
import type { EngineLine, PositionNode } from '../types';
import { expected } from '../engine/EngineService';
import fixture from './fixtures/axd4-regression.json';

const line = (cp: number, pv: string[], rank = 1): EngineLine => ({
  cp,
  pv,
  rank,
  depth: 14,
  nodes: 1000,
  mate: null,
  wdl: [0, 0, 1000],
});

describe('calidad práctica de una jugada', () => {
  it('normaliza ambos colores y mantiene la simetría alrededor de cero', () => {
    expect(moveExpectation(line(0, []), 'w')).toBe(0.5);
    expect(moveExpectation(line(152, []), 'w')).toBeCloseTo(0.636375918);
    expect(moveExpectation(line(-152, []), 'b')).toBeCloseTo(moveExpectation(line(152, []), 'w'));
    expect(moveExpectation(line(152, []), 'w') + moveExpectation(line(152, []), 'b')).toBe(1);
  });
  it('WDL describe el motor, pero no cambia las categorías si los centipeones son iguales', () => {
    const score = line(92, []);
    expect(moveExpectation({ ...score, wdl: [1000, 0, 0] }, 'w')).toBe(moveExpectation(score, 'w'));
  });
  it('conserva resultados de mate y usa WDL si no existe una evaluación numérica', () => {
    expect(moveExpectation({ ...line(0, []), cp: null, mate: 2, wdl: [1000, 0, 0] }, 'w')).toBe(1);
    expect(moveExpectation({ ...line(0, []), cp: null, mate: 0, wdl: [0, 0, 1000] }, 'b')).toBe(1);
    expect(moveExpectation({ ...line(0, []), cp: null, wdl: [100, 800, 100] }, 'b')).toBe(0.5);
  });
  it('no castiga igual una reducción de ventaja decisiva que perder el equilibrio', () => {
    const losingEquality = moveExpectation(line(0, []), 'w') - moveExpectation(line(-300, []), 'w');
    const stillWinning = moveExpectation(line(1000, []), 'w') - moveExpectation(line(700, []), 'w');
    expect(losingEquality).toBeGreaterThan(0.2);
    expect(stillWinning).toBeLessThan(0.05);
  });
  it.each(['w', 'b'] as const)('+1,52 frente a +0,92 no es Grave error (%s)', (color) => {
    const tree = makeTree(color === 'w' ? '1. d4 *' : '1. e4 e5 *');
    const before = tree.nodes.at(-2)!,
      after = tree.nodes.at(-1)!;
    const sign = color === 'w' ? 1 : -1;
    const best = line(152 * sign, [color === 'w' ? 'e2e4' : 'c7c5']);
    const played = line(92 * sign, [after.uci], 2);
    const result = classify(before, after, [best, played], line(-800 * sign, []));
    expect(result.loss).toBeCloseTo(0.052482, 4);
    expect(result.category).toBe('inaccuracy');
    expect(result.explanation).toContain('5.2');
  });
  it('mantiene la misma etiqueta para una candidata aunque la búsqueda posterior se mueva', () => {
    const tree = makeTree('1. d4 *');
    const best = line(152, ['e2e4']),
      played = line(92, ['d2d4'], 2);
    const result = classify(tree.nodes[0], tree.nodes[1], [best, played], line(-2000, []));
    expect(result.category).toBe('inaccuracy');
    expect(result.loss).toBeCloseTo(moveExpectation(best, 'w') - moveExpectation(played, 'w'));
  });
  for (const color of ['w', 'b'] as const) {
    it.each([
      [343, 0.0201725668, 'good'],
      [344, 0.0195404134, 'excellent'],
      [313, 0.0397410525, 'good'],
      [258, 0.0785961938, 'inaccuracy'],
    ] as const)(
      `${color}: frente a una ventaja de 3,76, %s centipeones pierden %s y producen %s`,
      (cp, loss, category) => {
        // Score regression from the reported Ad3 / Ab5 alternatives. Use a
        // separate legal position; these numbers do not reconstruct that game.
        const tree = makeTree(color === 'w' ? '1. d4 *' : '1. e4 e5 *');
        const before = tree.nodes.at(-2)!;
        const after = tree.nodes.at(-1)!;
        const sign = color === 'w' ? 1 : -1;
        const best = { ...line(376 * sign, [color === 'w' ? 'e2e4' : 'c7c5']), depth: 21 };
        const played = { ...line(cp * sign, [after.uci], 2), depth: 21 };
        const result = classify(before, after, [best, played], line(-2000 * sign, []));
        expect(result.loss).toBeCloseTo(loss, 9);
        expect(result.category).toBe(category);
        // Candidate rank alone does not decide Excellent versus Good.
        expect(classify(before, after, [best, { ...played, rank: 4 }], played).category).toBe(
          category,
        );
      },
    );
  }
  it('conserva Grave error para pérdidas grandes y no suaviza una pieza colgada', () => {
    const tree = makeTree('1. d4 *');
    const result = classify(tree.nodes[0], tree.nodes[1], [line(0, ['e2e4'])], line(-500, []));
    expect(result.category).toBe('blunder');
  });
  it('reproduce Axd4 con evidencia real: WDL perdía 22,55 puntos, la curva práctica 5,07', () => {
    const best = fixture.lines[0] as EngineLine;
    const played = fixture.lines.find((line) => line.pv[0] === fixture.after.uci) as EngineLine;
    expect(expected(best, 'b') - expected(played, 'b')).toBeCloseTo(0.2255);
    const rating = classify(
      fixture.before as PositionNode,
      fixture.after as PositionNode,
      fixture.lines as EngineLine[],
      fixture.next as EngineLine,
    );
    expect(rating.category).toBe('inaccuracy');
    expect(rating.loss).toBeCloseTo(0.0507023);
  });
});
