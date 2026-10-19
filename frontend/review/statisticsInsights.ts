import { makeTree } from '../chess/game';
import { DEFAULT_POSITION } from 'chess.js';
import { openingForMove } from '../chess/openings';
import { accuracy } from './classification';
import type { StatisticsEntry } from './statistics';
import { gameResult, isStatisticsGame, modeLabels } from './statistics';
import type { Game, GameTree, PositionNode } from '../types';

export type GameProfile = { tree: GameTree | null; opening: string };
export type InsightEntry = StatisticsEntry & { profile: GameProfile };
export type GamePhase = 'opening' | 'middle' | 'end';
export const phaseLabels: Record<GamePhase, string> = {
  opening: 'Apertura',
  middle: 'Medio juego',
  end: 'Final',
};
const failures = new Set(['inaccuracy', 'mistake', 'blunder', 'miss']);

// Use the deepest known move of the actual main line, grouping named variations.
// Imported middlegames are not evidence of how a game opened.
export function gameProfile(game: Game): GameProfile {
  try {
    const tree = makeTree(game.pgn);
    if (tree.rootFen !== DEFAULT_POSITION) return { tree, opening: 'Posición personalizada' };
    const nodes = new Map(tree.nodes.map((node) => [node.id, node]));
    let name = 'Sin identificar';
    for (const id of tree.mainIds.slice(1, 33)) {
      const after = nodes.get(id)!;
      const before = after.parent ? nodes.get(after.parent) : undefined;
      const found = before && openingForMove(before, after);
      if (found) name = found[1].split(':')[0].trim();
    }
    return { tree, opening: name };
  } catch {
    return { tree: null, opening: 'Sin identificar' };
  }
}

// A transparent material heuristic, rather than a claim of an exact phase boundary.
export function gamePhase(before: PositionNode): GamePhase {
  const values: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };
  const material = [...before.fen.split(' ')[0]].reduce(
    (sum, piece) => sum + (values[piece.toLowerCase()] ?? 0),
    0,
  );
  if (material <= 26) return 'end';
  return Number(before.fen.split(' ')[5]) <= 10 ? 'opening' : 'middle';
}

export function openingStatistics(entries: InsightEntry[]) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const groups = new Map<string, InsightEntry[]>();
  for (const entry of entries) {
    const key = `${entry.color}:${entry.profile.opening}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => {
      let wins = 0,
        draws = 0,
        losses = 0;
      for (const entry of group) {
        const result = gameResult(entry);
        if (result === 'draw') draws++;
        else if (result === 'win') wins++;
        else if (result === 'loss') losses++;
      }
      const reviewed = group.filter((entry) => entry.review?.complete);
      const moves = reviewed.flatMap((entry) =>
        entry.review!.moves.filter((m) => m.color === entry.color),
      );
      const finished = wins + draws + losses;
      return {
        name: group[0].profile.opening,
        color: group[0].color,
        games: group.length,
        wins,
        draws,
        losses,
        finished,
        winrate: finished ? (wins * 100) / finished : null,
        scoreRate: finished ? ((wins + draws / 2) * 100) / finished : null,
        analyzed: reviewed.length,
        accuracy: accuracy(moves),
      };
    })
    .sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name) || a.color.localeCompare(b.color),
    );
}

export function phaseStatistics(entries: InsightEntry[]) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const groups = (Object.keys(phaseLabels) as GamePhase[]).map((phase) => ({
    phase,
    moves: [] as NonNullable<StatisticsEntry['review']>['moves'],
    games: new Set<string>(),
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    miss: 0,
  }));
  for (const entry of entries) {
    if (!entry.review?.complete || !entry.profile.tree) continue;
    const tree = entry.profile.tree;
    const nodes = new Map(tree.nodes.filter((n) => n.main).map((n) => [n.ply, n]));
    for (const move of entry.review.moves) {
      if (move.color !== entry.color) continue;
      const before = nodes.get(move.ply - 1);
      if (!before) continue;
      const group = groups.find((g) => g.phase === gamePhase(before))!;
      group.moves.push(move);
      group.games.add(entry.game.id);
      if (failures.has(move.category))
        group[move.category as 'inaccuracy' | 'mistake' | 'blunder' | 'miss']++;
    }
  }
  return groups.map((group) => {
    const count = group.inaccuracy + group.mistake + group.blunder + group.miss;
    return {
      phase: group.phase,
      games: group.games.size,
      moves: group.moves.length,
      inaccuracy: group.inaccuracy,
      mistake: group.mistake,
      blunder: group.blunder,
      miss: group.miss,
      accuracy: accuracy(group.moves),
      failureRate: group.moves.length ? (count * 100) / group.moves.length : null,
    };
  });
}

export function accuracyEvolution(entries: InsightEntry[]) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const points = entries
    .filter(
      (entry) => entry.review?.complete && Number.isFinite(entry.game.date) && entry.game.date > 0,
    )
    .sort((a, b) => a.game.date - b.game.date || a.game.id.localeCompare(b.game.id))
    .flatMap((entry) => {
      const moves = entry.review!.moves.filter((move) => move.color === entry.color);
      const precision = accuracy(moves);
      // A book-only game has no estimated accuracy; do not invent a perfect score.
      return precision === null
        ? []
        : [
            {
              id: entry.game.id,
              date: entry.game.date,
              rival: entry.color === 'w' ? entry.game.black : entry.game.white,
              accuracy: precision,
              failures: moves.filter((m) => failures.has(m.category)).length,
            },
          ];
    });
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 9), index + 1);
    return {
      ...point,
      averageAccuracy: window.reduce((sum, p) => sum + p.accuracy, 0) / window.length,
      averageFailures: window.reduce((sum, p) => sum + p.failures, 0) / window.length,
      sample: window.length,
    };
  });
}

export function comparisonStatistics(
  entries: InsightEntry[],
  grouping: 'mode' | 'color' | 'rival',
) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const groups = new Map<string, InsightEntry[]>();
  for (const entry of entries) {
    const name =
      grouping === 'mode'
        ? (modeLabels[entry.game.timeClass] ?? entry.game.timeClass)
        : grouping === 'color'
          ? entry.color === 'w'
            ? 'Blancas'
            : 'Negras'
          : entry.color === 'w'
            ? entry.game.black
            : entry.game.white;
    const key = name.toLocaleLowerCase();
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const name =
      grouping === 'mode'
        ? (modeLabels[first.game.timeClass] ?? first.game.timeClass)
        : grouping === 'color'
          ? first.color === 'w'
            ? 'Blancas'
            : 'Negras'
          : first.color === 'w'
            ? first.game.black
            : first.game.white;
    const results = group.map(gameResult);
    const wins = results.filter((r) => r === 'win').length;
    const draws = results.filter((r) => r === 'draw').length;
    const losses = results.filter((r) => r === 'loss').length;
    const finished = wins + draws + losses;
    const reviewed = group.filter((e) => e.review?.complete);
    const moves = reviewed.flatMap((e) => e.review!.moves.filter((m) => m.color === e.color));
    return {
      name,
      games: group.length,
      wins,
      draws,
      losses,
      finished,
      winrate: finished ? (wins * 100) / finished : null,
      scoreRate: finished ? ((wins + draws / 2) * 100) / finished : null,
      analyzed: reviewed.length,
      accuracy: accuracy(moves),
      brilliant: moves.filter((m) => m.category === 'brilliant').length,
    };
  });
}

export type StatisticsSort =
  'name' | 'games' | 'winrate' | 'scoreRate' | 'accuracy' | 'analyzed' | 'brilliant';
export function sortStatisticsRows<T extends { name: string }>(
  rows: T[],
  key: StatisticsSort,
  descending: boolean,
) {
  return [...rows].sort((a, b) => {
    const left = (a as Record<string, unknown>)[key];
    const right = (b as Record<string, unknown>)[key];
    if (left == null && right != null) return 1;
    if (right == null && left != null) return -1;
    const delta =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : key === 'name'
          ? a.name.localeCompare(b.name, 'es')
          : 0;
    return (descending ? -delta : delta) || a.name.localeCompare(b.name, 'es');
  });
}

export function resultStreaks(entries: InsightEntry[]) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const games = entries
    .filter((e) => gameResult(e) !== null)
    .sort((a, b) => a.game.date - b.game.date || a.game.id.localeCompare(b.game.id));
  let bestWins = 0,
    wins = 0,
    unbeaten = 0,
    bestUnbeaten = 0;
  for (const game of games) {
    const result = gameResult(game);
    wins = result === 'win' ? wins + 1 : 0;
    unbeaten = result === 'loss' ? 0 : unbeaten + 1;
    bestWins = Math.max(bestWins, wins);
    bestUnbeaten = Math.max(bestUnbeaten, unbeaten);
  }
  return { bestWins, bestUnbeaten, currentWins: wins, currentUnbeaten: unbeaten };
}
