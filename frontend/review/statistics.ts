import type { Category, Color, Game, Review } from '../types';
import { accuracy, categories } from './classification';
import { isTrainingGame } from '../chess/gameKind';

export const modeLabels: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápidas',
  daily: 'Diarias',
  pgn: 'PGN',
};
export interface StatisticsEntry {
  game: Game;
  color: Color;
  review?: Review;
}
export interface StatisticsFilter {
  mode: string;
  days: number;
  color: 'all' | Color;
}
export function isStatisticsGame(game: Game) {
  return !isTrainingGame(game);
}
export function ownColor(game: Game, username: string, fallback: Color): Color | null {
  const user = username.trim().toLowerCase();
  if (!user) return fallback;
  return game.white.toLowerCase() === user ? 'w' : game.black.toLowerCase() === user ? 'b' : null;
}
export function filteredEntries<T extends StatisticsEntry>(
  entries: T[],
  filter: StatisticsFilter,
  now: number,
) {
  return entries.filter(
    ({ game, color }) =>
      isStatisticsGame(game) &&
      (filter.mode === 'all' || game.timeClass === filter.mode) &&
      (filter.color === 'all' || color === filter.color) &&
      (!filter.days || (game.date >= now - filter.days * 86_400_000 && game.date <= now)),
  );
}
export function gameResult({ game, color }: StatisticsEntry): 'win' | 'loss' | 'draw' | null {
  if (game.result === '1/2-1/2') return 'draw';
  if (!['1-0', '0-1'].includes(game.result)) return null;
  return (game.result === '1-0') === (color === 'w') ? 'win' : 'loss';
}
export function categoryGames(entries: StatisticsEntry[], category: Category) {
  return entries.flatMap(({ game, color, review }) => {
    if (!isStatisticsGame(game) || !review?.complete) return [];
    const count = review.moves.filter(
      (move) => move.color === color && move.category === category,
    ).length;
    return count ? [{ game, count }] : [];
  });
}
export function statistics(entries: StatisticsEntry[]) {
  entries = entries.filter(({ game }) => isStatisticsGame(game));
  const wins = entries.filter((e) => gameResult(e) === 'win').length;
  const losses = entries.filter((e) => gameResult(e) === 'loss').length;
  const draws = entries.filter((e) => gameResult(e) === 'draw').length;
  const finished = wins + losses + draws;
  const complete = entries.filter((e) => e.review?.complete);
  const moves = complete.flatMap((e) => e.review!.moves.filter((m) => m.color === e.color));
  const counts = Object.fromEntries(Object.keys(categories).map((k) => [k, 0])) as Record<
    Category,
    number
  >;
  for (const m of moves) counts[m.category]++;
  const elo = Object.keys(modeLabels)
    .concat(entries.map((e) => e.game.timeClass))
    .filter((mode, i, all) => all.indexOf(mode) === i)
    .flatMap((mode) => {
      const points = entries
        .filter((e) => e.game.timeClass === mode && Number.isFinite(e.game.date) && e.game.date > 0)
        .map((e) => ({
          date: e.game.date,
          rating: Number(e.color === 'w' ? e.game.whiteElo : e.game.blackElo),
          id: e.game.id,
        }))
        .filter((p) => Number.isInteger(p.rating) && p.rating > 0)
        .sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
      return points.length
        ? [
            {
              mode,
              points,
              rating: points.at(-1)!.rating,
              delta: points.length > 1 ? points.at(-1)!.rating - points[0].rating : null,
            },
          ]
        : [];
    });
  return {
    wins,
    losses,
    draws,
    finished,
    winrate: finished ? (100 * wins) / finished : null,
    scoreRate: finished ? (100 * (wins + draws / 2)) / finished : null,
    complete: complete.length,
    partial: entries.filter((e) => e.review && !e.review.complete).length,
    counts,
    accuracy: accuracy(moves),
    moves: moves.length,
    elo,
  };
}
