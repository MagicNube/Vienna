import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { hasSacrifice } from './sacrifice';
import { classify } from './classification';
import fixture from './fixtures/indirect-queen-sacrifice.json';
import type { EngineLine, PositionNode } from '../types';

const before = fixture.before as PositionNode;
const after = fixture.after as PositionNode;
const lines = fixture.lines as EngineLine[];
const next = fixture.next as EngineLine;

describe('dama ofrecida al mover el caballo', () => {
  it('reconoce la dama en e6 aunque el caballo se mueva a c5 y el rival rechace la oferta', () => {
    expect(hasSacrifice(before.fen, 'w', lines[0].pv, 1)).toBe(true);
    const chess = new Chess(before.fen);
    for (const san of ['Nxc5', 'Rxe6', 'Nxe6+', 'Kd7', 'Nxc7', 'Kxc7']) chess.move(san);
    expect(chess.get('e6')).toBeUndefined();
    expect(
      chess
        .board()
        .flat()
        .some((piece) => piece?.type === 'q'),
    ).toBe(false);
    expect(chess.get('a1')?.type).toBe('r');
  });

  it('mantiene Mejor cuando otras opciones ya dejan una victoria clara', () => {
    const result = classify(before, after, lines, next);
    expect(result.category).toBe('best');
    expect(result.loss).toBe(0);
  });

  it('puede ser Brillante si las alternativas no ganan ya y la oferta sigue siendo óptima', () => {
    const balanced = lines.map((line, index) => ({ ...line, cp: index === 0 ? 50 : 0 }));
    expect(classify(before, after, balanced, next).category).toBe('brilliant');
  });

  it('no premia una dama ofrecida que empeora la posición o deja al jugador perdiendo', () => {
    const worse = lines.map((line, index) => ({ ...line, cp: index === 0 ? -200 : 0 }));
    expect(classify(before, after, worse, next).category).not.toBe('brilliant');
    const losing = lines.map((line) => ({ ...line, cp: -100 }));
    expect(classify(before, after, losing, next).category).not.toBe('brilliant');
  });

  it('no considera sacrificio un intercambio recuperable de una pieza distinta de la movida', () => {
    expect(
      hasSacrifice('3r2k1/8/8/8/8/8/2P5/3RK3 w - - 0 1', 'w', ['c2c3', 'd8d1', 'e1d1'], 1),
    ).toBe(false);
  });

  it('reconoce la misma oferta para negras', () => {
    const parts = before.fen.split(' ');
    parts[0] = parts[0]
      .split('/')
      .reverse()
      .map((rank) =>
        [...rank]
          .map((piece) =>
            piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase(),
          )
          .join(''),
      )
      .join('/');
    parts[1] = 'b';
    const reflected = lines[0].pv.map((move) =>
      move.replace(/[1-8]/g, (n) => String(9 - Number(n))),
    );
    expect(hasSacrifice(parts.join(' '), 'b', reflected, 1)).toBe(true);
  });
});
