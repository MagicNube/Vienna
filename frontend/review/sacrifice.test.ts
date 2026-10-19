import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { hasSacrifice } from './sacrifice';
import { classify } from './classification';
import { makeTree } from '../chess/game';
import fixture from './fixtures/bxh6-sacrifice.json';
import type { EngineLine, PositionNode } from '../types';

const before = fixture.before as PositionNode,
  after = fixture.after as PositionNode;
const reported = fixture.reported as EngineLine[],
  lines = fixture.lines as EngineLine[],
  next = fixture.next as EngineLine;
describe('Axh6 contra Opponent', () => {
  it('espera evidencia más profunda antes de conceder Brillante a la línea de profundidad 11', () => {
    expect(classify(before, after, reported, next).category).toBe('best');
    const result = classify(
      before,
      after,
      reported.map((l) => ({ ...l, depth: 9 })),
      next,
    );
    expect(result.category).toBe('best');
  });
  it('conserva Brillante en el análisis real profundo aunque sea casi la mejor y marque −0.05', () => {
    expect(lines[0].pv[0]).toBe('b3b4');
    expect(lines.find((l) => l.pv[0] === after.uci)!.cp).toBe(-5);
    const result = classify(before, after, lines, next);
    expect(result.category).toBe('brilliant');
    expect(result.loss).toBeLessThan(0.02);
  });
  it('comprueba el coste del alfil y permite compensación en otra casilla con Txf6', () => {
    expect(hasSacrifice(before.fen, 'w', ['e3h6', 'g7h6', 'f1f6'], 1)).toBe(true);
    const c = new Chess(before.fen);
    c.move('Bxh6');
    c.move('gxh6');
    expect(c.get('h6')?.type).toBe('p');
    expect(c.get('e3')).toBeUndefined();
    expect(c.moves()).toContain('Rxf6');
    expect(fixture.acceptance.cp).toBeGreaterThan(300);
  });
  it('es simétrico para negras y no depende de quién tenga la cuenta', () => {
    const parts = before.fen.split(' ');
    parts[0] = parts[0]
      .split('/')
      .reverse()
      .map((rank) =>
        [...rank].map((p) => (p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase())).join(''),
      )
      .join('/');
    parts[1] = 'b';
    const c = new Chess(parts.join(' '));
    const m = c.move('Bxh3');
    const reflected = lines.map((l) => ({
      ...l,
      cp: -l.cp!,
      pv: l.pv.map((u) => u.replace(/[1-8]/g, (n) => String(9 - Number(n)))),
    }));
    expect(
      classify(
        { ...before, fen: m.before },
        { ...after, fen: m.after, uci: m.from + m.to },
        reflected,
        { ...next, cp: -next.cp! },
      ).category,
    ).toBe('brilliant');
  });
  it('no otorga el premio cuando el sacrificio empeora demasiado o mantiene una posición mala', () => {
    expect(
      classify(
        before,
        after,
        reported.map((l) => ({ ...l, cp: l.pv[0] === after.uci ? -200 : 0 })),
        next,
      ).category,
    ).not.toBe('brilliant');
    expect(
      classify(
        before,
        after,
        reported.map((l) => ({ ...l, cp: -60 })),
        next,
      ).category,
    ).not.toBe('brilliant');
  });
});
it('no confunde el cambio de torres recuperable por el rey con un sacrificio real', () => {
  expect(hasSacrifice('3r2k1/8/8/8/8/8/R7/3K4 w - - 0 1', 'w', ['a2d2', 'd8d2', 'd1e1'], 1)).toBe(
    false,
  );
});

it.each(['w', 'b'] as const)(
  'no repite Brillante por dejar una pieza que ya estaba colgada (%s)',
  (color) => {
    const base = '3r2k1/8/8/8/3Q4/8/P7/1N4K1 w - - 0 1';
    const parts = base.split(' ');
    if (color === 'b') {
      parts[0] = parts[0]
        .split('/')
        .reverse()
        .map((rank) =>
          [...rank]
            .map((p) => (p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase()))
            .join(''),
        )
        .join('/');
      parts[1] = 'b';
    }
    const tree = makeTree(
      `[SetUp "1"]\n[FEN "${parts.join(' ')}"]\n\n1${color === 'b' ? '...' : '.'} a${color === 'b' ? '6' : '3'} *`,
    );
    const pv = ['a2a3', 'd8d4', 'b1c3'].map((u) =>
      color === 'b' ? u.replace(/[1-8]/g, (n) => String(9 - Number(n))) : u,
    );
    const alternative = color === 'b' ? 'b8c6' : 'b1c3';
    const candidate: EngineLine = {
      rank: 1,
      depth: 20,
      nodes: 1000,
      cp: 0,
      mate: null,
      wdl: null,
      pv,
    };
    expect(hasSacrifice(tree.rootFen, color, pv, 1)).toBe(false);
    expect(
      classify(
        tree.nodes[0],
        tree.nodes[1],
        [candidate, { ...candidate, rank: 2, pv: [alternative] }],
        candidate,
      ).category,
    ).toBe('best');
  },
);

it('un sacrificio nuevo con pérdida material insuficiente no es Brillante', () => {
  expect(hasSacrifice(before.fen, 'w', ['e3h6', 'g7h6', 'f1f6'], 3)).toBe(false);
});
