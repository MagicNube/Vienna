import type { GameTree, Review } from '../types';
import { withBookMove } from '../chess/openings';
import { classify, CLASSIFICATION_VERSION } from './classification';

// Upgrade labels using persisted engine evidence; do not discard or re-run it.
export function upgradeReview(tree: GameTree, review: Review): Review {
  if (review.classificationVersion === CLASSIFICATION_VERSION) return review;
  return {
    ...review,
    classificationVersion: CLASSIFICATION_VERSION,
    moves: tree.mainIds.slice(1).flatMap((id, index) => {
      const before = tree.nodes.find((node) => node.id === tree.mainIds[index])!;
      const after = tree.nodes.find((node) => node.id === id)!;
      const lines = review.positions[before.id]?.lines;
      const next = review.positions[id]?.lines[0];
      if (!lines?.length || !next) return [];
      const previous = tree.nodes.find((node) => node.id === before.parent);
      const previousLines = previous && review.positions[previous.id]?.lines;
      return [
        withBookMove(
          before,
          after,
          classify(
            before,
            after,
            lines,
            next,
            undefined,
            previous && previousLines ? { node: previous, lines: previousLines } : undefined,
          ),
        )!,
      ];
    }),
  };
}
