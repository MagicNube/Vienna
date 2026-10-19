import type { Category, GameTree, PositionNode } from '../types';
import type { CategoryTour } from './categoryTour';

export type ReturnContext = {
  target: PositionNode;
} & ({ kind: 'custom' } | { kind: 'category'; category: Category });

export function mainOrigin(tree: GameTree, node: PositionNode): PositionNode | undefined {
  let cursor: PositionNode | undefined = node;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    if (cursor.main) return cursor;
    seen.add(cursor.id);
    cursor = tree.nodes.find((entry) => entry.id === cursor?.parent);
  }
  return undefined;
}

/** Leave the current branch before leaving an enclosing category tour. */
export function returnContext(
  tree: GameTree,
  node: PositionNode,
  tour: CategoryTour | null,
  freeMode: boolean,
): ReturnContext | null {
  if (freeMode) return null;
  if (!node.main) {
    const target = mainOrigin(tree, node);
    return target ? { kind: 'custom', target } : null;
  }
  const target = tour && tree.nodes.find((entry) => entry.id === tour.origin);
  return target && tour ? { kind: 'category', category: tour.category, target } : null;
}
