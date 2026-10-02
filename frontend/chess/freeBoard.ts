import { pathTo } from './game';
import type { GameTree } from '../types';

// Keep the chosen branch when stepping back through a fork.
export function freeLine(tree: GameTree, nodeId: string, preferredTip: string) {
  const preferred = pathTo(tree, preferredTip);
  if (
    tree.nodes.some((n) => n.id === preferredTip) &&
    (nodeId === 'm0' || preferred.some((n) => n.id === nodeId))
  )
    return preferred;
  let cursor = tree.nodes.find((n) => n.id === nodeId) ?? tree.nodes[0];
  let child = tree.nodes.find((n) => n.parent === cursor.id);
  while (child) {
    cursor = child;
    child = tree.nodes.find((n) => n.parent === cursor.id);
  }
  return pathTo(tree, cursor.id);
}
