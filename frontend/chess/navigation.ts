import { pathTo } from './game';
import type { GameTree, PositionNode } from '../types';

export type NavigationDirection = 'first' | 'prev' | 'next' | 'last';
export type NavigationTargets = Record<NavigationDirection, string | null>;

/** Buttons and keyboard use the same destinations and branch boundaries. */
export function navigationTargets(
  tree: GameTree,
  node: PositionNode,
  freeLine?: PositionNode[],
): NavigationTargets {
  const targets: NavigationTargets = { first: null, prev: null, next: null, last: null };
  if (freeLine || node.main) {
    const ids = freeLine ? [tree.nodes[0].id, ...freeLine.map((n) => n.id)] : tree.mainIds;
    const index = ids.indexOf(node.id);
    if (index < 0) return targets;
    if (index > 0) {
      targets.first = ids[0];
      targets.prev = ids[index - 1];
    }
    if (index < ids.length - 1) {
      targets.next = ids[index + 1];
      targets.last = ids.at(-1)!;
    }
    return targets;
  }
  const path = pathTo(tree, node.id);
  targets.first = path.find((n) => !n.main)?.parent ?? tree.nodes[0].id;
  targets.prev = node.parent;
  let cursor = node;
  const visited = new Set([node.id]);
  let next = tree.nodes.find((n) => n.parent === cursor.id && !n.main);
  while (next && !visited.has(next.id)) {
    targets.next ??= next.id;
    targets.last = next.id;
    visited.add(next.id);
    cursor = next;
    next = tree.nodes.find((n) => n.parent === cursor.id && !n.main);
  }
  return targets;
}
