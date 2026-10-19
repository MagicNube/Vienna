import data from './data/openings.json';
import type { MoveReview, PositionNode } from '../types';
const book = data as Record<string, string[]>;
export function openingForMove(before: PositionNode, after: PositionNode) {
  if (after.ply > 32) return undefined;
  return book[before.fen.split(' ').slice(0, 4).join(' ') + '|' + after.uci];
}
export function withBookMove(
  before: PositionNode,
  after: PositionNode,
  rating?: MoveReview,
): MoveReview | undefined {
  const opening = openingForMove(before, after);
  if (!opening) return rating;
  return {
    ply: after.ply,
    color: before.fen.split(' ')[1] as 'w' | 'b',
    loss: rating?.loss ?? 0,
    best: rating?.best ?? '',
    category: 'book',
    explanation: `Jugada de libro · ${opening[0]} · ${opening[1]}.`,
  };
}
