import type { Color, EngineLine } from '../types';
import { expected } from '../engine/EngineService';

// Public Lichess Win% curve, based on human games:
// https://lichess.org/page/accuracy
// This is a practical quality estimate, not Chess.com's Elo-dependent model
// or Stockfish's self-play WDL. Keep raw WDL for the evaluation display.
export function moveExpectation(line: EngineLine, color: Color) {
  if (line.mate !== null || line.cp === null || !Number.isFinite(line.cp))
    return expected(line, color);
  const white = 1 / (1 + Math.exp(-0.00368208 * line.cp));
  return color === 'w' ? white : 1 - white;
}
