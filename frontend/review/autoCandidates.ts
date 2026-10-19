import type { Game } from '../types';
export function autoCandidates(
  games: Game[],
  username: string,
  since: number,
  excluded: ReadonlySet<string> = new Set(),
) {
  const user = username.trim().toLowerCase();
  return [...new Map(games.map((g) => [g.id, g])).values()]
    .filter(
      (g) =>
        !excluded.has(g.id) &&
        g.source === 'chess.com' &&
        g.date >= since &&
        ['1-0', '0-1', '1/2-1/2'].includes(g.result) &&
        [g.white.toLowerCase(), g.black.toLowerCase()].includes(user),
    )
    .sort((a, b) => a.date - b.date);
}
