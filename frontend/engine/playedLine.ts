import type { EngineLine, GameTree, PositionNode, Review } from '../types';

export function playedLine(
  tree: GameTree,
  node: PositionNode,
  review: Review | null,
  lines: EngineLine[],
) {
  if (!node.main) return null;
  const index = tree.mainIds.indexOf(node.id);
  const next = tree.nodes.find((item) => item.id === tree.mainIds[index + 1]);
  if (!next) return null;
  const candidate = lines.find((line) => line.pv[0] === next.uci);
  const after = review?.positions[next.id]?.lines[0];
  return {
    node: next,
    posterior: !candidate,
    line: candidate ?? (after ? { ...after, pv: [next.uci, ...after.pv] } : undefined),
  };
}
