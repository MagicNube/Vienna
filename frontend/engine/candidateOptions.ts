import type { Color, EngineLine } from '../types';
import { moveExpectation } from '../review/moveQuality';
import { distinctLines } from './lines';

/** Keep four choices, plus a useful fifth or the actual game move. */
export function candidateOptions(lines: EngineLine[], color: Color, playedMove?: string) {
  const candidates = distinctLines(lines).filter((line) => line.pv[0]);
  return candidates.slice(0, 5).filter((line, index) => {
    if (index < 4 || line.pv[0] === playedMove) return true;
    const fourth = candidates[3];
    // An unfinished iteration is not evidence that the fifth option is worse.
    return (
      fourth.depth !== line.depth ||
      moveExpectation(fourth, color) - moveExpectation(line, color) < 0.1
    );
  });
}

/** A move outside MultiPV has no known ordinal; its later score is not a rank. */
export function candidateRank(lines: EngineLine[], move: string) {
  const candidates = distinctLines(lines).filter((line) => line.pv[0]);
  const index = candidates.findIndex((line) => line.pv[0] === move);
  return index < 0 ? null : index + 1;
}
