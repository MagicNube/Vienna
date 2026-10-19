import { Chess } from 'chess.js';
import type { EngineLine, MoveReview, PositionNode } from '../types';
import { distinctLines } from '../engine/lines';
import { pvSan } from '../chess/game';
import { moveExpectation } from './moveQuality';

export type PreviousPosition = { node: PositionNode; lines: EngineLine[] };
const minDepth = 16;
const winning = 0.75;
const equalOrWorse = 0.55;
const opponentError = 0.1;

export function missedOpportunityExplanation(fen: string, best: string) {
  const recommendation = pvSan(fen, [best], 1)[0];
  return recommendation
    ? `Tras el error del rival, ${recommendation} mantenía la ventaja ganadora. Esta jugada la pierde.`
    : undefined;
}

/** A local, conservative Miss heuristic. It needs evidence of the opponent's error. */
export function withMissedOpportunity(
  rating: MoveReview,
  before: PositionNode,
  after: PositionNode,
  lines: EngineLine[],
  next: EngineLine,
  previous?: PreviousPosition,
): MoveReview {
  if (!previous || !['inaccuracy', 'mistake', 'blunder'].includes(rating.category)) return rating;
  const best = distinctLines(lines)[0];
  const earlier = distinctLines(previous.lines)[0];
  const candidate = lines.find((line) => line.pv[0] === after.uci);
  const played = candidate ?? next;
  const opponentPlayed = previous.lines.find((line) => line.pv[0] === before.uci);
  if (
    !best ||
    !earlier ||
    before.parent !== previous.node.id ||
    before.ply !== previous.node.ply + 1 ||
    after.parent !== before.id ||
    earlier.pv[0] === before.uci ||
    [best, earlier, played].some((line) => line.depth < minDepth) ||
    (candidate && candidate.depth !== best.depth) ||
    (opponentPlayed && opponentPlayed.depth !== earlier.depth)
  )
    return rating;
  // Validate the actual preceding move and the recommended alternatives.
  try {
    const old = new Chess(previous.node.fen);
    if (old.turn() === rating.color) return rating;
    const play = (chess: Chess, uci: string) =>
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
    play(new Chess(previous.node.fen), earlier.pv[0]);
    play(old, before.uci);
    if (old.fen() !== before.fen || old.turn() !== rating.color) return rating;
    play(new Chess(before.fen), best.pv[0]);
    const actual = new Chess(before.fen);
    play(actual, after.uci);
    if (actual.fen() !== after.fen) return rating;
  } catch {
    return rating;
  }
  const original = moveExpectation(earlier, rating.color);
  const opportunity = moveExpectation(best, rating.color);
  const afterOpponent = moveExpectation(opponentPlayed ?? best, rating.color);
  if (
    original >= winning ||
    opportunity < winning ||
    afterOpponent < winning ||
    afterOpponent - original < opponentError ||
    moveExpectation(played, rating.color) > equalOrWorse
  )
    return rating;
  return {
    ...rating,
    category: 'miss',
    explanation: missedOpportunityExplanation(before.fen, best.pv[0]) ?? rating.explanation,
  };
}
