import { describe, it, expect } from 'vitest';
import { classify, accuracy } from './classification';
import { makeTree } from '../chess/game';
import { expected, score } from '../engine/EngineService';
import { Chess } from 'chess.js';
import type { EngineLine } from '../types';
const line = (wdl: [number, number, number], pv = ['e2e4']): EngineLine => ({
  rank: 1,
  depth: 20,
  nodes: 1000,
  cp:
    wdl[0] + wdl[1] / 2 === 0 || wdl[0] + wdl[1] / 2 === 1000
      ? null
      : Math.log((wdl[0] + wdl[1] / 2) / (wdl[2] + wdl[1] / 2)) / 0.00368208,
  mate: null,
  wdl,
  pv,
});
describe('expectativa y clasificación', () => {
  it('normaliza a la perspectiva del jugador', () => {
    const l = line([700, 200, 100]);
    expect(expected(l, 'w')).toBe(0.8);
    expect(expected(l, 'b')).toBeCloseTo(0.2);
    expect(score({ ...l, cp: 84 }, 'b')).toBe('−0.84');
    expect(score({ ...l, mate: -5 }, 'b')).toBe('+M5');
  });
  it('no castiga como grave error un cambio de WDL con los mismos centipeones', () => {
    const t = makeTree('1. e4 *');
    const r = classify(t.nodes[0], t.nodes[1], [{ ...line([500, 500, 0], ['d2d4']), cp: 0 }], {
      ...line([0, 500, 500]),
      cp: 0,
    });
    expect(r.category).toBe('excellent');
    expect(r.loss).toBe(0);
  });
  it('no convierte una buena jugada en brillante sin evidencia de sacrificio', () => {
    const t = makeTree('1. e4 *');
    const r = classify(
      t.nodes[0],
      t.nodes[1],
      [line([100, 800, 100]), line([90, 820, 90], ['d2d4'])],
      line([100, 800, 100]),
    );
    expect(r.category).toBe('best');
  });
  it('no penaliza una mejora y mantiene la precisión acotada', () => {
    const t = makeTree('1. e4 *');
    const r = classify(t.nodes[0], t.nodes[1], [line([100, 800, 100])], line([300, 600, 100]));
    expect(r.loss).toBe(0);
    expect(accuracy([r])).toBe(100);
    expect(accuracy([])).toBe(null);
  });
  it('evalúa la pérdida de negras desde negras', () => {
    const t = makeTree('1. e4 e5 *');
    const r = classify(
      t.nodes[1],
      t.nodes[2],
      [line([100, 800, 100], ['c7c5'])],
      line([600, 400, 0]),
    );
    expect(r.color).toBe('b');
    expect(r.loss).toBeCloseTo(0.3);
    expect(r.category).toBe('blunder');
  });
});

it('una brillante puede pasar a mejor si faltan profundidad, alternativas o evidencia de sacrificio', () => {
  const tree = makeTree(
    '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 *',
  );
  const before = tree.nodes.at(-2)!,
    after = tree.nodes.at(-1)!;
  const best = line([600, 400, 0], ['c3b5', 'c6b5', 'c4b5', 'b8d7', 'e1c1']);
  const second = { ...line([580, 400, 20], ['c4d3']), rank: 2 };
  const next = line([600, 400, 0]);
  expect(classify(before, after, [best, second], next).category).toBe('brilliant');
  expect(classify(before, after, [{ ...best, depth: 15 }, second], next).category).toBe('best');
  expect(classify(before, after, [best], next).category).toBe('best');
  expect(classify(before, after, [{ ...best, pv: ['c3b5'] }, second], next).category).toBe('best');
});

import fixtures from './fixtures/category-regressions.json';
import type { PositionNode } from '../types';

it('Dc5 con cambios de torres no es un sacrificio brillante', () => {
  const f = fixtures[0];
  expect(f.after.san).toBe('Qc5');
  expect(
    classify(
      f.before as PositionNode,
      f.after as PositionNode,
      f.lines as EngineLine[],
      f.next as EngineLine,
    ).category,
  ).toBe('best');
});
it('Cxc4 conserva Mejor aunque el siguiente cálculo cambie la valoración', () => {
  const f = fixtures[1];
  expect(f.after.san).toBe('Nxc4');
  const result = classify(
    f.before as PositionNode,
    f.after as PositionNode,
    f.lines as EngineLine[],
    { ...f.next, wdl: [10, 800, 190] } as EngineLine,
  );
  expect(result.category).toBe('best');
  expect(result.loss).toBe(0);
});
it('una recaptura inmediata de igual valor no obtiene Brillante', () => {
  const t = makeTree('[SetUp "1"]\n[FEN "rr4k1/8/8/2B5/8/8/8/R5K1 w - - 0 1"]\n\n1. Ra7 *');
  const best = line([100, 800, 100], ['a1a7', 'a8a7', 'c5a7', 'b8b7', 'g1f1']);
  expect(
    classify(
      t.nodes[0],
      t.nodes[1],
      [best, { ...line([90, 820, 90], ['a1a2']), rank: 2 }],
      line([100, 800, 100]),
    ).category,
  ).toBe('best');
});
it('evalúa una alternativa incluida usando su línea de la misma búsqueda', () => {
  const t = makeTree('1. d4 *');
  const best = line([200, 800, 0], ['e2e4']);
  const played = { ...line([100, 860, 40], ['d2d4']), rank: 2 };
  const r = classify(t.nodes[0], t.nodes[1], [best, played], line([700, 300, 0]));
  expect(r.loss).toBeCloseTo(0.07);
  expect(r.category).toBe('inaccuracy');
});

describe('límites publicados de pérdida de expectativa', () => {
  const cases = [
    [0, 'excellent'],
    [0.019, 'excellent'],
    [0.02, 'good'],
    [0.049, 'good'],
    [0.05, 'inaccuracy'],
    [0.099, 'inaccuracy'],
    [0.1, 'mistake'],
    [0.199, 'mistake'],
    [0.2, 'blunder'],
    [1, 'blunder'],
  ] as const;
  for (const color of ['w', 'b'] as const) {
    it.each(cases)(`${color}: pérdida %s produce %s`, (loss, category) => {
      const tree = makeTree(color === 'w' ? '1. d4 *' : '1. e4 e5 *');
      const before = tree.nodes.at(-2)!,
        after = tree.nodes.at(-1)!;
      const wins = Math.round((1 - loss) * 1000);
      const best = line(color === 'w' ? [1000, 0, 0] : [0, 0, 1000], [
        color === 'w' ? 'e2e4' : 'c7c5',
      ]);
      const played = {
        ...line(color === 'w' ? [wins, 0, 1000 - wins] : [1000 - wins, 0, wins], [after.uci]),
        rank: 2,
      };
      const result = classify(before, after, [best, played], line([0, 1000, 0]));
      expect(result.category).toBe(category);
      expect(result.loss).toBeCloseTo(loss);
    });
  }
});

describe('gravedad según el contexto de la evaluación, para ambos colores', () => {
  // Scores are from the mover's point of view. A similar centipawn loss has
  // less impact when the game is already decided than around equality.
  const cases = [
    [0, -50, 'good'],
    [0, -100, 'inaccuracy'],
    [0, -200, 'mistake'],
    [0, -250, 'blunder'],
    [400, 300, 'inaccuracy'],
    [800, 600, 'good'],
    [-600, -800, 'good'],
    [1400, 1000, 'excellent'],
    [376, 343, 'good'],
    [414, 125, 'blunder'],
  ] as const;
  for (const color of ['w', 'b'] as const) {
    it.each(cases)(`${color}: %s → %s produce %s`, (bestCp, playedCp, category) => {
      const tree = makeTree(color === 'w' ? '1. d4 *' : '1. e4 e5 *');
      const before = tree.nodes.at(-2)!,
        after = tree.nodes.at(-1)!;
      const sign = color === 'w' ? 1 : -1;
      const best = { ...line([500, 0, 500], [color === 'w' ? 'e2e4' : 'c7c5']), cp: bestCp * sign };
      const played = { ...line([500, 0, 500], [after.uci]), cp: playedCp * sign, rank: 2 };
      // Raw engine WDL and a later search must not override the comparison
      // between two candidates from the same search.
      const next = {
        ...played,
        cp: -2000 * sign,
        wdl: color === 'w' ? [0, 0, 1000] : [1000, 0, 0],
      } as EngineLine;
      const result = classify(before, after, [best, played], next);
      expect(result.category).toBe(category);
      expect(result.loss).toBeGreaterThan(0);
      expect(result.loss).toBeLessThan(0.5);
    });
  }
});

const sacrificeTree = makeTree(
  '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 *',
);
const sacrificeBefore = sacrificeTree.nodes.at(-2)!,
  sacrificeAfter = sacrificeTree.nodes.at(-1)!;
const sacrificePv = ['c3b5', 'c6b5', 'c4b5', 'b8d7', 'e1c1'];

it.each([15, 16])('Brillante exige profundidad 16 en la jugada y alternativas (%s)', (depth) => {
  const best = { ...line([600, 400, 0], sacrificePv), depth };
  const second = { ...line([580, 400, 20], ['c4d3']), depth, rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe(
    depth < 16 ? 'best' : 'brilliant',
  );
});

it('Brillante no sustituye Buena en el límite de dos puntos de pérdida', () => {
  const best = line([800, 0, 200], ['c4d3']);
  const played = { ...line([780, 0, 220], sacrificePv), rank: 2 };
  const result = classify(sacrificeBefore, sacrificeAfter, [best, played], played);
  expect(result.loss).toBeCloseTo(0.02);
  expect(result.category).toBe('good');
});

it('reconoce la aceptación aplazada de Nxb5 en una línea real de Stockfish 19', () => {
  // Stockfish 19, 5 s, 1 thread, 64 MB, MultiPV 4: depth 22. The queen
  // exchange delays the capture of the offered knight until Black's third reply.
  const best = {
    ...line([1000, 0, 0], ['c3b5', 'e7b4', 'b3b4', 'f8b4', 'c2c3', 'c6b5', 'c4b5']),
    cp: 543,
    depth: 22,
    nodes: 5640695,
  };
  const second = { ...line([727, 273, 0], ['g5f6']), cp: 122, depth: 22, rank: 2 };
  const result = classify(sacrificeBefore, sacrificeAfter, [best, second], best);
  expect(result.category).toBe('brilliant');
  expect(result.loss).toBe(0);
});
it('no concede Brillante si la pieza ofrecida se mueve antes de ser capturada', () => {
  const best = line([600, 400, 0], ['c3b5', 'e7b4', 'b3b4', 'f8b4', 'b5c7']);
  const second = { ...line([580, 400, 20], ['c4d3']), rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe('best');
});
it('no concede Brillante a partir de una continuación ilegal', () => {
  const best = line([600, 400, 0], ['c3b5', 'c6b5', 'c4b3']);
  const second = { ...line([580, 400, 20], ['c4d3']), rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe('best');
});

it('Brillante tiene prioridad sobre Genial si el sacrificio es la única opción buena', () => {
  const best = line([600, 400, 0], sacrificePv);
  const second = { ...line([0, 800, 200], ['c4d3']), rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe(
    'brilliant',
  );
});
it('un sacrificio casi óptimo puede ser Brillante sin ser la primera opción', () => {
  const best = line([600, 400, 0], ['c4d3']);
  const played = { ...line([580, 420, 0], sacrificePv), rank: 2 };
  const result = classify(sacrificeBefore, sacrificeAfter, [best, played], played);
  expect(result.loss).toBeCloseTo(0.01);
  expect(result.category).toBe('brilliant');
});
it('no premia como Brillante un sacrificio cuando otras opciones ya aseguran la victoria', () => {
  const best = line([1000, 0, 0], sacrificePv);
  const second = { ...line([900, 100, 0], ['c4d3']), rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe('best');
});
it('no premia como Brillante un sacrificio que mantiene una posición desfavorable', () => {
  const best = line([0, 900, 100], sacrificePv);
  const second = { ...line([0, 800, 200], ['c4d3']), rank: 2 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe('best');
});
it('no inventa Brillante usando el sacrificio de una candidata que no se jugó', () => {
  const tree = makeTree(`[SetUp "1"]\n[FEN "${sacrificeBefore.fen}"]\n\n1. Bd3 *`);
  const best = line([600, 400, 0], sacrificePv);
  expect(classify(tree.nodes[0], tree.nodes[1], [best], best).category).toBe('excellent');
});
it('no usa alternativas de poca profundidad para conceder una categoría especial', () => {
  const best = line([600, 400, 0], sacrificePv);
  const second = { ...line([0, 800, 200], ['c4d3']), rank: 2, depth: 15 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, second], best).category).toBe('best');
});

it('una alternativa incompleta no desaparece de la comparación de Brillante o Genial', () => {
  const best = line([600, 400, 0], sacrificePv);
  const shallow = { ...line([580, 400, 20], ['c4d3']), rank: 2, depth: 15 };
  const deep = { ...line([0, 800, 200], ['g5f6']), rank: 3 };
  expect(classify(sacrificeBefore, sacrificeAfter, [best, shallow, deep], best).category).toBe(
    'best',
  );
  const tree = makeTree('1. e4 *');
  const primary = line([600, 400, 0]);
  const close = { ...line([580, 400, 20], ['d2d4']), rank: 2, depth: 15 };
  const inferior = { ...line([0, 800, 200], ['c2c4']), rank: 3 };
  expect(classify(tree.nodes[0], tree.nodes[1], [primary, close, inferior], primary).category).toBe(
    'best',
  );
});
it('detecta el mismo sacrificio para negras, con WDL normalizado desde blancas', () => {
  const parts = sacrificeBefore.fen.split(' ');
  parts[0] = parts[0]
    .split('/')
    .reverse()
    .map((rank) =>
      [...rank]
        .map((piece) => (piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase()))
        .join(''),
    )
    .join('/');
  parts[1] = 'b';
  const tree = makeTree(`[SetUp "1"]\n[FEN "${parts.join(' ')}"]\n\n10... Nxb4 *`);
  const reflectedPv = sacrificePv.map((move) =>
    move.replace(/[1-8]/g, (rank) => String(9 - Number(rank))),
  );
  const best = line([0, 400, 600], reflectedPv);
  const second = { ...line([20, 400, 580], ['c5d6']), rank: 2 };
  const result = classify(tree.nodes[0], tree.nodes[1], [best, second], best);
  expect(result.color).toBe('b');
  expect(result.category).toBe('brilliant');
});
it('un sacrificio correcto que responde a un jaque no se descarta por el jaque inicial', () => {
  // The bishop protects d2: Kxd2 would otherwise recover the rook for free.
  const tree = makeTree('[SetUp "1"]\n[FEN "3r2k1/8/7b/8/8/8/R7/3K4 w - - 0 1"]\n\n1. Rd2 *');
  expect(new Chess(tree.nodes[0].fen).isCheck()).toBe(true);
  const best = line([600, 400, 0], ['a2d2', 'd8d2', 'd1e1']);
  const second = { ...line([0, 900, 100], ['d1c1']), rank: 2 };
  expect(classify(tree.nodes[0], tree.nodes[1], [best, second], best).category).toBe('brilliant');
});
it('las promociones y mates no convierten por sí solos una jugada en Brillante', () => {
  const promotion = makeTree('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *');
  const best = { ...line([1000, 0, 0], ['a7a8q', 'h8h7', 'a8a7']), cp: null, mate: 3 };
  const second = { ...line([1000, 0, 0], ['a7a8r']), rank: 2 };
  expect(classify(promotion.nodes[0], promotion.nodes[1], [best, second], best).category).toBe(
    'best',
  );
  const mate = makeTree('1. f3 e5 2. g4 Qh4# *');
  const mateBest = { ...line([0, 0, 1000], ['d8h4']), cp: null, mate: -1 };
  const terminal = { ...line([0, 0, 1000], []), cp: null, mate: 0 };
  expect(classify(mate.nodes.at(-2)!, mate.nodes.at(-1)!, [mateBest], terminal).category).toBe(
    'best',
  );
});

describe('Genial exige relevancia para el resultado', () => {
  it.each([
    [0.5, 0.3, 'great'],
    [0.85, 0.6, 'great'],
    [1, 0.8, 'best'],
    [0.3, 0.1, 'best'],
    [0.6, 0.5, 'best'],
  ] as const)('mejor %s frente a alternativa %s produce %s', (bestValue, secondValue, category) => {
    const tree = makeTree('1. e4 *');
    const best = line([Math.round(bestValue * 1000), 0, Math.round((1 - bestValue) * 1000)]);
    const second = {
      ...line([Math.round(secondValue * 1000), 0, Math.round((1 - secondValue) * 1000)], ['d2d4']),
      rank: 2,
    };
    expect(classify(tree.nodes[0], tree.nodes[1], [best, second], best).category).toBe(category);
  });
});
