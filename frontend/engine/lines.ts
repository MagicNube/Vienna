import type { DrawShape } from '@lichess-org/chessground/draw';
import { DEFAULT_POSITION } from 'chess.js';
import type { EngineLine, PositionNode } from '../types';

export function isInitialPosition(node: PositionNode) {
  return node.ply === 0 && node.fen === DEFAULT_POSITION;
}

export const arrowBrushes = {
  green: { key: 'annotation', color: '#ed9140', opacity: 0.9, lineWidth: 10 },
  red: { key: 'red', color: '#cf525c', opacity: 0.9, lineWidth: 10 },
  blue: { key: 'blue', color: '#728d9d', opacity: 0.9, lineWidth: 10 },
  yellow: { key: 'yellow', color: '#d5ba56', opacity: 0.9, lineWidth: 10 },
  engineBest: { key: 'engineBest', color: 'var(--engine-arrow)', opacity: 0.95, lineWidth: 9 },
  engineSecond: { key: 'engineSecond', color: 'var(--engine-arrow)', opacity: 0.95, lineWidth: 5 },
  enginePreview: { key: 'enginePreview', color: 'var(--engine-arrow)', opacity: 1, lineWidth: 11 },
};

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
  const candidates = distinctLines(lines);
  const moves = preview
    ? [{ move: preview, brush: 'enginePreview', width: 11 }]
    : [
        ...(arrows ? [{ move: candidates[0]?.pv[0], brush: 'engineBest', width: 9 }] : []),
        ...(second ? [{ move: candidates[1]?.pv[0], brush: 'engineSecond', width: 5 }] : []),
      ];
  return moves
    .filter((entry) => entry.move)
    .map(({ move, brush, width }) => ({
      orig: move!.slice(0, 2) as DrawShape['orig'],
      dest: move!.slice(2, 4) as DrawShape['dest'],
      brush,
      modifiers: { lineWidth: width },
    }));
}
