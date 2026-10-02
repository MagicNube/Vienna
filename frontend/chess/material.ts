import { Chess, type PieceSymbol } from 'chess.js';
import { pathTo } from './game';
import type { Color, GameTree } from '../types';

const pieceValues: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function positionMaterial(tree: GameTree, nodeId: string) {
  const chess = new Chess(tree.rootFen);
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const node of pathTo(tree, nodeId)) {
    const move = chess.move({
      from: node.uci.slice(0, 2),
      to: node.uci.slice(2, 4),
      promotion: node.uci[4],
    });
    if (move.captured) captured[move.color].push(move.captured);
  }
  const balance = chess
    .board()
    .flat()
    .reduce(
      (sum, piece) => sum + (piece ? pieceValues[piece.type] * (piece.color === 'w' ? 1 : -1) : 0),
      0,
    );
  for (const color of ['w', 'b'] as const)
    captured[color].sort((a, b) => 'pnbrqk'.indexOf(a) - 'pnbrqk'.indexOf(b));
  return { captured, advantage: { w: Math.max(0, balance), b: Math.max(0, -balance) } };
}
