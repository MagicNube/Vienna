import { rpc, onEngineInfo } from '../api/native';
import { Chess } from 'chess.js';
import { pathTo, terminalAnalysis } from '../chess/game';
import type { Analysis, EngineOptions, EngineLine, GameTree } from '../types';
export class EngineService {
  private callbacks = new Map<string, (lines: EngineLine[]) => void>();
  private listening: Promise<() => void> | null = null;
  status() {
    return rpc<{ available: boolean; name: string; engineId: string; cpus: number }>('status');
  }
  cancel(lane: 'interactive' | 'review' = 'interactive') {
    return rpc<void>('cancel', { lane });
  }
  async analyzePosition(
    tree: GameTree,
    nodeId: string,
    options: EngineOptions,
    lane: 'interactive' | 'review' = 'interactive',
    onInfo?: (lines: EngineLine[]) => void,
  ): Promise<Analysis> {
    const terminal = terminalAnalysis(tree, nodeId);
    if (terminal)
      return {
        lines: [{ rank: 1, depth: 0, nodes: 0, pv: [], ...terminal }],
        cached: false,
        engineId: 'terminal',
      };
    if (!this.listening)
      this.listening = onEngineInfo((e) => this.callbacks.get(e.requestId)?.(e.lines));
    await this.listening;
    options = {
      ...options,
      multiPv: Math.min(
        options.multiPv,
        new Chess(tree.nodes.find((n) => n.id === nodeId)!.fen).moves().length,
      ),
    };
    const requestId = crypto.randomUUID();
    if (onInfo) this.callbacks.set(requestId, onInfo);
    try {
      return await rpc<Analysis>('analyze', {
        fen: tree.rootFen,
        history: pathTo(tree, nodeId).map((n) => n.uci),
        options,
        lane,
        requestId,
      });
    } finally {
      this.callbacks.delete(requestId);
    }
  }
}
export const engine = new EngineService();
export function expected(line: EngineLine, color: 'w' | 'b') {
  let white: number;
  if (line.wdl) white = (line.wdl[0] + line.wdl[1] / 2) / 1000;
  else if (line.mate !== null) white = line.mate > 0 ? 1 : 0;
  else white = 1 / (1 + Math.exp(-(line.cp ?? 0) / 180));
  return color === 'w' ? white : 1 - white;
}
export function score(line: EngineLine | undefined, color: 'w' | 'b' = 'w') {
  if (!line) return '—';
  const sign = color === 'w' ? 1 : -1;
  if (line.mate !== null) {
    if (line.mate === 0) return 'Mate';
    const value = line.mate * sign;
    return `${value < 0 ? '−' : '+'}M${Math.abs(value)}`;
  }
  if (line.cp === null) return '—';
  const cp = (line.cp * sign) / 100;
  const value = Math.abs(cp).toFixed(2);
  return value === '0.00' ? '0.00' : `${cp > 0 ? '+' : '−'}${value}`;
}
