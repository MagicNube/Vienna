import type { EngineOptions, PositionNode, Review } from '../types';

// Reviews belong to the original game's history, never to a matching FEN in a branch.
export function savedAnalysis(node: PositionNode, review: Review | null, freeMode: boolean) {
  const saved = !freeMode && node.main ? review?.positions[node.id] : undefined;
  return saved?.lines.length ? saved : undefined;
}

/** Hardware changes alone do not require reanalysis; search limits and engine do. */
export function reviewMatchesOptions(
  review: Review | null,
  options: EngineOptions,
  engineId: string | undefined,
) {
  return !!(
    review?.complete &&
    review.engineId === engineId &&
    review.options.movetime === options.movetime &&
    review.options.multiPv >= options.multiPv &&
    review.options.depth === options.depth
  );
}
