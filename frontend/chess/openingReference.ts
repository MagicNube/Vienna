import { Chess } from 'chess.js';
import data from './data/openingLines.json';
import { makeTree } from './game';

export const openingReferences: Record<string, { eco: string; name: string; moves: string[] }> =
  data;
export function openingReference(name: string) {
  const line = Object.hasOwn(openingReferences, name) ? openingReferences[name] : undefined;
  if (!line) return null;
  const chess = new Chess();
  for (const uci of line.moves)
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return { ...line, tree: makeTree(chess.pgn()) };
}
