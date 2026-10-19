import { expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classify, accuracy, CLASSIFICATION_VERSION } from './classification';
import { hasSacrifice, hasMateForkSacrifice } from './sacrifice';
import { moveExpectation } from './moveQuality';
import { makeTree } from '../chess/game';
import { upgradeReview } from './upgradeReview';
import fixture from './fixtures/winning-knight-offer.json';
import type { EngineLine, PositionNode, Review } from '../types';

const before = fixture.before as PositionNode;
const after = fixture.after as PositionNode;
const lines = fixture.lines as EngineLine[];
const next = fixture.next as EngineLine;

it('detecta la oferta real del caballo aunque Stockfish recomiende rechazarla', () => {
  expect(lines[0].pv.slice(0, 2)).toEqual(['d5b6', 'c8b7']);
  expect(hasSacrifice(before.fen, 'w', lines[0].pv, 1)).toBe(true);
  expect(hasMateForkSacrifice(before.fen, 'w', after.uci, 1)).toBe(true);
});

it('confirma que aceptar permite mate en una, pero Rb7 es una respuesta legal sin mate inmediato', () => {
  const chess = new Chess(after.fen);
  expect(chess.isCheck()).toBe(true);
  chess.move('cxb6');
  chess.move('Qb8#');
  expect(chess.isCheckmate()).toBe(true);
  chess.undo();
  chess.undo();
  chess.move('Kb7');
  expect(chess.isCheck()).toBe(false);
  expect(chess.moves().some((move) => move.endsWith('#'))).toBe(false);
  expect(fixture.acceptance.mate).toBe(1);
  expect(fixture.responses.find((line) => line.pv[0] === 'c7b6')?.mate).toBe(1);
});

it('reconoce la combinación de mate o dama como Brillante aunque otras alternativas también ganen', () => {
  expect(lines[0].cp).toBe(1381);
  expect(lines[1].pv[0]).toBe('g2g5');
  expect(lines[1].cp).toBe(880);
  expect(moveExpectation(lines[1], 'w')).toBeGreaterThan(0.9);
  expect(moveExpectation(lines[2], 'w')).toBeGreaterThan(0.9);
  const result = classify(before, after, lines, next);
  expect(result.category).toBe('brilliant');
  expect(result.explanation).toContain('mate en una');
  expect(result.loss).toBe(0);
  expect(result.best).toBe('d5b6');
  expect(accuracy([result])).toBe(100);
});

it('el mismo criterio para una posición ganadora se aplica al bando negro', () => {
  function reflectFen(fen: string) {
    const parts = fen.split(' ');
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
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    return parts.join(' ');
  }
  const reflectMove = (move: string) => move.replace(/[1-8]/g, (rank) => String(9 - Number(rank)));
  const reflectLine = (line: EngineLine): EngineLine => ({
    ...line,
    cp: line.cp === null ? null : -line.cp,
    mate: line.mate === null ? null : -line.mate,
    wdl: line.wdl ? [line.wdl[2], line.wdl[1], line.wdl[0]] : null,
    pv: line.pv.map(reflectMove),
  });
  const reflected = lines.map(reflectLine);
  const blackBefore = { ...before, fen: reflectFen(before.fen) };
  const blackAfter = { ...after, fen: reflectFen(after.fen), uci: reflectMove(after.uci) };
  expect(hasSacrifice(blackBefore.fen, 'b', reflected[0].pv, 1)).toBe(true);
  expect(hasMateForkSacrifice(blackBefore.fen, 'b', blackAfter.uci, 1)).toBe(true);
  expect(classify(blackBefore, blackAfter, reflected, reflectLine(next)).category).toBe(
    'brilliant',
  );
});

it('un tenedor normal, sin mate tras aceptar, no activa la excepción', () => {
  const chess = new Chess(before.fen);
  chess.remove('h2');
  expect(hasMateForkSacrifice(chess.fen(), 'w', after.uci, 1)).toBe(false);
});

it('exige la dama en el tenedor y no premia cualquier jaque sacrificando una pieza', () => {
  const chess = new Chess(before.fen);
  chess.remove('d7');
  expect(hasMateForkSacrifice(chess.fen(), 'w', after.uci, 1)).toBe(false);
  expect(hasMateForkSacrifice(before.fen, 'w', 'g2g5', 1)).toBe(false);
});

it('si hay otra captura legal del caballo que no permite mate, no concede la excepción', () => {
  const chess = new Chess(before.fen);
  chess.put({ type: 'n', color: 'b' }, 'a4');
  const fen = chess.fen();
  chess.move('Nb6+');
  expect(chess.moves()).toContain('Nxb6');
  chess.move('Nxb6');
  expect(chess.moves().some((move) => move.endsWith('#'))).toBe(false);
  expect(hasMateForkSacrifice(fen, 'w', after.uci, 1)).toBe(false);
});

it('mantiene los límites de profundidad y comparación entre candidatas', () => {
  expect(
    classify(
      before,
      after,
      lines.map((line) => ({ ...line, depth: 15 })),
      next,
    ).category,
  ).toBe('best');
  const incomplete = lines.map((line, index) => ({
    ...line,
    depth: index === 1 ? 22 : line.depth,
  }));
  expect(classify(before, after, incomplete, next).category).toBe('best');
  expect(classify(before, after, lines.slice(1), next).category).not.toBe('brilliant');
});

it('solo admite la excepción en la mejor jugada, manteniendo una posición ganadora', () => {
  const worse = lines.map((line, index) => (index === 0 ? { ...line, cp: -1000 } : line));
  expect(classify(before, after, worse, next).category).not.toBe('brilliant');
  const alternativesFirst = [
    { ...lines[1], rank: 1, cp: 1400 },
    { ...lines[0], rank: 2 },
    ...lines.slice(2),
  ];
  expect(classify(before, after, alternativesFirst, next).category).not.toBe('brilliant');
});

it('actualiza el análisis guardado sin volver a pensar ni cambiar evaluaciones o precisión', () => {
  const tree = makeTree(`[SetUp "1"]\n[FEN "${before.fen}"]\n\n28. Nb6+ *`);
  const saved: Review = {
    version: 1,
    classificationVersion: CLASSIFICATION_VERSION - 1,
    engineId: 'saved',
    complete: true,
    options: { threads: 1, hash: 64, multiPv: 5, movetime: 5000, depth: null },
    positions: {
      m0: { lines, cached: true, engineId: 'saved' },
      m1: { lines: [next], cached: true, engineId: 'saved' },
    },
    moves: [
      { ply: 1, color: 'w', category: 'best', loss: 0, best: after.uci, explanation: 'Old label' },
    ],
  };
  const upgraded = upgradeReview(tree, saved);
  expect(upgraded.moves[0].category).toBe('brilliant');
  expect(upgraded.classificationVersion).toBe(CLASSIFICATION_VERSION);
  expect(upgraded.positions).toBe(saved.positions);
  expect(upgraded.options).toBe(saved.options);
  expect(accuracy(upgraded.moves)).toBe(accuracy(saved.moves));
  expect(saved.moves[0].category).toBe('best');
});
