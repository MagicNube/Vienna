import { Chess, type Color, type Square } from 'chess.js';
import type { Game, GameTree, PositionNode } from '../types';
export function spanishSan(san: string) {
  return san.replace(/[KQRBN]/g, (c) => ({ K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' })[c]!);
}
export function makeTree(pgn: string): GameTree {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const rootFen = history[0]?.before ?? chess.fen();
  const nodes: PositionNode[] = [
    { id: 'm0', parent: null, fen: rootFen, san: '', uci: '', ply: 0, main: true },
  ];
  history.forEach((m, i) =>
    nodes.push({
      id: `m${i + 1}`,
      parent: `m${i}`,
      fen: m.after,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      ply: i + 1,
      main: true,
    }),
  );
  return { rootFen, nodes, mainIds: nodes.map((n) => n.id) };
}
export function pathTo(tree: GameTree, id: string): PositionNode[] {
  const map = new Map(tree.nodes.map((n) => [n.id, n]));
  const path: PositionNode[] = [];
  let node = map.get(id);
  while (node?.parent) {
    path.unshift(node);
    node = map.get(node.parent);
  }
  return path;
}
export function addMove(
  tree: GameTree,
  parentId: string,
  from: string,
  to: string,
  promotion?: string,
): { tree: GameTree; node: PositionNode } {
  const parent = tree.nodes.find((n) => n.id === parentId)!;
  const chess = new Chess(parent.fen);
  const move = chess.move({ from, to, promotion });
  const uci = move.from + move.to + (move.promotion ?? '');
  const existing = tree.nodes.find((n) => n.parent === parentId && n.uci === uci);
  if (existing) return { tree, node: existing };
  const node: PositionNode = {
    id: crypto.randomUUID(),
    parent: parentId,
    fen: chess.fen(),
    san: move.san,
    uci,
    ply: parent.ply + 1,
    main: false,
  };
  return { tree: { ...tree, nodes: [...tree.nodes, node] }, node };
}
export function legalDests(fen: string) {
  const c = new Chess(fen);
  const dests = new Map<Square, Square[]>();
  for (const m of c.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}
export function pvSan(fen: string, pv: string[], limit = 9) {
  const c = new Chess(fen);
  const result: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try {
      const number = c.moveNumber();
      const color = c.turn();
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      result.push(
        `${color === 'w' ? `${number}.` : result.length === 0 ? `${number}…` : ''}${spanishSan(m.san)}`,
      );
    } catch {
      break;
    }
  }
  return result;
}
export async function importPgn(pgn: string, meta: Partial<Game> = {}): Promise<Game> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.getHeaders();
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chess.pgn()));
  const id = Array.from(new Uint8Array(bytes))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  const date = Date.parse((headers.Date ?? '').replaceAll('.', '-') + 'T12:00:00');
  return {
    id,
    pgn: chess.pgn(),
    white: headers.White || 'Blancas',
    black: headers.Black || 'Negras',
    whiteElo: headers.WhiteElo,
    blackElo: headers.BlackElo,
    result: headers.Result || '*',
    date: Number.isNaN(date) ? Date.now() : date,
    timeClass: 'pgn',
    timeControl: headers.TimeControl || '—',
    source: 'pgn',
    ...meta,
  };
}
export function terminalAnalysis(tree: GameTree, nodeId: string) {
  const c = new Chess(tree.rootFen);
  for (const n of pathTo(tree, nodeId))
    c.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] });
  if (c.isCheckmate())
    return {
      cp: null,
      mate: 0,
      wdl: (c.turn() === 'w' ? [0, 0, 1000] : [1000, 0, 0]) as [number, number, number],
    };
  if (c.isDraw()) return { cp: 0, mate: null, wdl: [0, 1000, 0] as [number, number, number] };
  return null;
}
export function playerColor(game: Game | undefined, username: string): Color {
  return game?.black.toLowerCase() === username.toLowerCase() ? 'b' : 'w';
}
export function moveLabel(node: PositionNode) {
  const [, , , , , move] = node.fen.split(' ');
  const black = node.fen.split(' ')[1] === 'w';
  return `${Number(move) - (black ? 1 : 0)}${black ? '…' : '.'} ${spanishSan(node.san)}`;
}
