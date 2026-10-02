import type { PositionNode, Review } from '../types';

// Reviews belong to the original game's history, never to a matching FEN in a branch.
export function savedAnalysis(node: PositionNode, review: Review | null, freeMode: boolean) {
  const saved = !freeMode && node.main ? review?.positions[node.id] : undefined;
  return saved?.lines.length ? saved : undefined;
}
