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

/** Material exposed on a square if the opponent could capture there now.
 * Changing the turn models the existing threat, never an engine evaluation. */
function existingExposure(fen: string, square: Square, color: Color, budget: { left: number }) {
  const parts = fen.split(' ');
  parts[1] = color === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const chess = new Chess(parts.join(' '));
  const initial = material(chess, color);
  let exposure = 0;
  for (const capture of chess
    .moves({ verbose: true })
    .filter((m) => m.to === square && m.captured)) {
    chess.move(capture);
    const result = exchange(chess, square, color, budget);
    chess.undo();
    if (result === null) return null;
    exposure = Math.max(exposure, initial - result);
  }
  return exposure;
}

export function hasSacrifice(fen: string, color: Color, pv: string[], minimumLoss: number) {
  if (pv.length < 3) return false;
  const sim = new Chess(fen),
    initial = material(sim, color);
  try {
    const offer = play(sim, pv[0]);
    // Do not infer brilliance from an illegal engine continuation.
    const validation = new Chess(sim.fen());
    for (const uci of pv.slice(1, 7)) play(validation, uci);
    const budget = { left: 256 };
    const offeredMaterial = material(sim, color);
    // The offered piece need not be the one that moved: a knight can leave
    // its queen en prise and recover compensation with a fork elsewhere.
    // Count recaptures on the captured square, so ordinary equal trades fail.
    // A sound offer remains a sacrifice when the opponent declines it.
    for (const capture of sim
      .moves({ verbose: true })
      .filter((m) => m.captured && values[m.captured] >= 3)) {
      sim.move(capture);
      const result = exchange(sim, capture.to, color, budget);
      sim.undo();
      if (result === null || initial - result < minimumLoss) continue;
      if (capture.to !== offer.to) {
        const existing = existingExposure(fen, capture.to, color, budget);
        const exposure = offeredMaterial - result;
        // A quiet move needs a NEW material commitment. Merely improving
        // recaptures (e.g. moving the checked king) cannot repeat an old offer.
        // Active captures may change an indirect offer's exchange, including
        // a knight capture enabling a recapture of the rook taking its queen.
        if (
          existing === null ||
          existing === exposure ||
          (!offer.captured && exposure - existing < minimumLoss)
        )
          continue;
      }
      return true;
    }
    // Checks or intermediate exchanges can delay a legal acceptance.
    if (values[offer.piece] < 3) return false;
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

/** A forcing, verifiable exception for an already-winning position:
 * a quiet piece offer checks the king and forks the queen. Every legal
 * acceptance permits mate in one; every refusal permits a profitable queen
 * capture by that piece. No existing mate in one or inherited king evasion. */
export function hasMateForkSacrifice(fen: string, color: Color, uci: string, minimumLoss: number) {
  try {
    const chess = new Chess(fen);
    if (chess.turn() !== color) return false;
    const piece = chess.get(uci.slice(0, 2) as Square);
    if (!piece || !['n', 'b', 'r'].includes(piece.type)) return false;
    const initial = material(chess, color);
    const offer = play(chess, uci);
    if (offer.captured || !['n', 'b', 'r'].includes(offer.piece) || !chess.isCheck()) return false;
    const enemy = color === 'w' ? 'b' : 'w';
    const targets = chess
      .board()
      .flat()
      .filter((piece) => piece?.color === enemy);
    const checkedKing = targets.find((piece) => piece?.type === 'k');
    if (!checkedKing || !chess.attackers(checkedKing.square, color).includes(offer.to))
      return false;
    if (
      !targets.some(
        (piece) => piece?.type === 'q' && chess.attackers(piece.square, color).includes(offer.to),
      )
    )
      return false;
    if (new Chess(fen).moves().some((san) => san.endsWith('#'))) return false;
    const replies = chess.moves({ verbose: true });
    const budget = { left: 256 };
    let acceptances = 0;
    let refusals = 0;
    for (const reply of replies) {
      chess.move(reply);
      const accepts = reply.to === offer.to && reply.captured === offer.piece;
      if (accepts) {
        acceptances++;
        const cost = exchange(chess, offer.to, color, budget);
        if (
          cost === null ||
          initial - cost < minimumLoss ||
          !chess.moves().some((san) => san.endsWith('#'))
        )
          return false;
      } else {
        refusals++;
        const captures = chess
          .moves({ verbose: true })
          .filter((move) => move.from === offer.to && move.captured === 'q');
        let profitable = false;
        for (const capture of captures) {
          chess.move(capture);
          const gain = exchange(chess, capture.to, color, budget);
          chess.undo();
          if (gain !== null && gain - initial >= minimumLoss) profitable = true;
        }
        if (!profitable) return false;
      }
      chess.undo();
    }
    return acceptances > 0 && refusals > 0;
  } catch {
    return false;
  }
}
