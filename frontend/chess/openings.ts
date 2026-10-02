import data from './data/openings.json';
import type { GameTree, MoveReview, PositionNode, Review } from '../types';
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
export function withOpeningBook(tree: GameTree, review: Review): Review {
  return {
    ...review,
    moves: review.moves.map((move) => {
      const after = tree.nodes.find((n) => n.main && n.ply === move.ply);
      const before = tree.nodes.find((n) => n.id === after?.parent);
      return after && before ? withBookMove(before, after, move)! : move;
    }),
  };
}
