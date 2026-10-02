import { Chess, type Color, type Square } from 'chess.js';

const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function material(chess: Chess, color: Color) {
  return chess
    .board()
    .flat()
    .reduce((sum, p) => sum + (p ? values[p.type] * (p.color === color ? 1 : -1) : 0), 0);
}
function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}
/** Optimal legal exchanges on the offered square, with the option to stop.
 * This proves the material cost of accepting, not the tactical compensation.
 * An exhausted budget is unknown, never evidence for a special label. */
function exchange(
  chess: Chess,
  square: Square,
  color: Color,
  budget: { left: number },
): number | null {
  if (--budget.left < 0) return null;
  let best = material(chess, color);
  const ownTurn = chess.turn() === color;
  for (const move of chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured)) {
    chess.move(move);
    const result = exchange(chess, square, color, budget);
    chess.undo();
    if (result === null) return null;
    best = ownTurn ? Math.max(best, result) : Math.min(best, result);
  }
  return best;
}

export function hasSacrifice(fen: string, color: Color, pv: string[], minimumLoss: number) {
  if (pv.length < 3) return false;
  const sim = new Chess(fen),
    initial = material(sim, color);
  try {
    const offer = play(sim, pv[0]);
    if (values[offer.piece] < 3) return false;
    // Do not infer brilliance from an illegal engine continuation.
    const validation = new Chess(sim.fen());
    for (const uci of pv.slice(1, 7)) play(validation, uci);
    const budget = { left: 256 };
    // A sound offer remains a sacrifice when the opponent declines it.
    // Count recaptures on the same square, so ordinary equal trades fail.
    // Compensation elsewhere (e.g. Bxh6, gxh6, Rxf6) does not erase the offer.
    for (const capture of sim
      .moves({ verbose: true })
      .filter((m) => m.to === offer.to && m.captured === offer.piece)) {
      sim.move(capture);
      const result = exchange(sim, offer.to, color, budget);
      sim.undo();
      if (result !== null && initial - result >= minimumLoss) return true;
    }
    // Checks or intermediate exchanges can delay a legal acceptance.
    for (let i = 1; i <= Math.min(5, pv.length - 2); i++) {
      const move = play(sim, pv[i]);
      if (move.color === color && move.from === offer.to) return false;
      if (move.color !== color && move.to === offer.to && move.captured === offer.piece) {
        const result = exchange(sim, offer.to, color, budget);
        return result !== null && initial - result >= minimumLoss;
      }
    }
  } catch {
    return false;
  }
  return false;
}
