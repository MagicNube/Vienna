import { Chess } from 'chess.js';
import type { Category, EngineLine, MoveReview, PositionNode } from '../types';
import { moveExpectation } from './moveQuality';
import { pvSan } from '../chess/game';
import { distinctLines } from '../engine/lines';
import { hasSacrifice } from './sacrifice';
export const CLASSIFICATION_VERSION = 6;
export const categories: Record<Category, { label: string; symbol: string; color: string }> = {
  brilliant: { label: 'Brillante', symbol: '!!', color: '#5acac4' },
  great: { label: 'Genial', symbol: '!', color: '#91b1ed' },
  book: { label: 'Libro', symbol: '▤', color: '#d1ac82' },
  best: { label: 'Mejor', symbol: '★', color: '#a9c77d' },
  excellent: { label: 'Excelente', symbol: '👍', color: '#a5ba8e' },
  good: { label: 'Buena', symbol: '✓', color: '#a2ada1' },
  inaccuracy: { label: 'Imprecisión', symbol: '?!', color: '#e5bd6d' },
  mistake: { label: 'Error', symbol: '?', color: '#e3985c' },
  blunder: { label: 'Grave error', symbol: '??', color: '#ef8186' },
};
const reviewRules = {
  // Published Chess.com expected-points boundaries. The probability model is
  // the public human Win% curve, not Chess.com's private Elo-dependent model.
  excellentLoss: 0.02,
  goodLoss: 0.05,
  inaccuracyLoss: 0.1,
  mistakeLoss: 0.2,
  specialMinDepth: 16,
  brilliantMinDepth: 10,
  // Roughly half a pawn against the mover still belongs to the equal band.
  brilliantMinimumExpected: 0.455,
  sacrificeNetLoss: 1,
  greatGap: 0.15,
  winningExpected: 0.75,
  completelyWinningExpected: 0.9,
};
const epsilon = 1e-12;
/** Conservative, explainable heuristic. No proprietary accuracy or brilliance claims. */
export function classify(
  before: PositionNode,
  after: PositionNode,
  lines: EngineLine[],
  next: EngineLine,
  rules = reviewRules,
): MoveReview {
  const chess = new Chess(before.fen);
  const color = chess.turn();
  const candidates = distinctLines(lines);
  const best = candidates[0];
  const played = candidates.find((line) => line.pv[0] === after.uci);
  // Compare candidates from the SAME search when available. Re-searching the
  // resulting position can shift every score; that is not a loss from the move.
  const loss = Math.max(0, moveExpectation(best, color) - moveExpectation(played ?? next, color));
  const isBest = best.pv[0] === after.uci;
  const choices = chess.moves().length;
  let category: Category = isBest
    ? 'best'
    : loss + epsilon >= rules.mistakeLoss
      ? 'blunder'
      : loss + epsilon >= rules.inaccuracyLoss
        ? 'mistake'
        : loss + epsilon >= rules.goodLoss
          ? 'inaccuracy'
          : loss + epsilon >= rules.excellentLoss
            ? 'good'
            : 'excellent';
  const alternatives = candidates.filter(
    (line) => line.pv[0] !== after.uci && line.depth === best.depth,
  );
  const playedExpected = moveExpectation(played ?? next, color);
  const alternativeExpected = alternatives.length
    ? Math.max(...alternatives.map((line) => moveExpectation(line, color)))
    : null;
  let sacrifice = false;
  if (
    played &&
    played.depth === best.depth &&
    played.depth >= rules.brilliantMinDepth &&
    loss + epsilon < rules.excellentLoss &&
    choices > 1 &&
    played.pv.length >= 3 &&
    playedExpected >= rules.brilliantMinimumExpected &&
    alternativeExpected !== null &&
    alternativeExpected < rules.completelyWinningExpected
  ) {
    sacrifice = hasSacrifice(before.fen, color, played.pv, rules.sacrificeNetLoss);
    if (sacrifice) category = 'brilliant';
  }
  if (
    category === 'best' &&
    best.depth >= rules.specialMinDepth &&
    alternatives.every((line) => line.depth >= rules.specialMinDepth) &&
    choices > 1 &&
    alternativeExpected !== null &&
    playedExpected - alternativeExpected + epsilon >= rules.greatGap &&
    // Local critical-outcome approximation: preserves a non-losing position
    // when alternatives lose, or a winning one when alternatives do not.
    ((playedExpected >= 0.5 && alternativeExpected < 0.5) ||
      (playedExpected >= rules.winningExpected && alternativeExpected < rules.winningExpected))
  )
    category = 'great';
  const recommendation = pvSan(before.fen, best.pv, 1)[0] ?? 'Sin continuación';
  let explanation =
    loss > epsilon
      ? `Las opciones estimadas bajan ${loss < 0.001 ? 'menos de 0,1' : (loss * 100).toFixed(1)} puntos porcentuales. El motor prefería ${recommendation}.`
      : isBest
        ? 'Coincide con la primera elección de Stockfish en este análisis.'
        : `Mantiene las opciones estimadas. El motor prefiere ${recommendation}.`;
  if (sacrifice)
    explanation =
      'Ofrece una pieza con un coste material real si el rival acepta, descontando las recapturas en esa casilla. Puede rechazar el sacrificio o haber compensación táctica en otra casilla. Es la mejor o casi la mejor y mantiene una posición favorable o aproximadamente equilibrada.';
  if (category === 'great')
    explanation =
      'Es la mejor opción: conserva una posición equilibrada o ganadora que las otras líneas analizadas no mantienen. La diferencia de expectativa es de al menos 15 puntos porcentuales.';
  return { ply: after.ply, color, category, loss, explanation, best: best.pv[0] ?? '' };
}
export function accuracy(moves: MoveReview[]) {
  moves = moves.filter((move) => move.category !== 'book');
  if (!moves.length) return null;
  return 100 * Math.exp((-4 * moves.reduce((s, m) => s + m.loss, 0)) / moves.length);
}
