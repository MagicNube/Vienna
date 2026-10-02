import type { DrawShape } from '@lichess-org/chessground/draw';
import type { EngineLine } from '../types';

export function distinctLines(lines: EngineLine[]) {
  const seen = new Set<string>();
  return [...lines]
    .sort((a, b) => a.rank - b.rank)
    .filter((line) => {
      const move = line.pv[0];
      if (!move) return true;
      if (seen.has(move)) return false;
      seen.add(move);
      return true;
    });
}
export function engineArrows(
  lines: EngineLine[],
  arrows: boolean,
  second: boolean,
  preview?: string,
): DrawShape[] {
  const moves = preview
    ? [preview]
    : arrows
      ? distinctLines(lines)
          .slice(0, second ? 2 : 1)
          .map((line) => line.pv[0])
          .filter(Boolean)
      : [];
  return moves.map((move, index) => ({
    orig: move.slice(0, 2) as DrawShape['orig'],
    dest: move.slice(2, 4) as DrawShape['dest'],
    brush: preview ? 'yellow' : index ? 'blue' : 'green',
    modifiers: { lineWidth: preview ? 10 : index ? 6 : 9 },
  }));
}
