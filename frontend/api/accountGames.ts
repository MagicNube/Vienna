import type { Game } from '../types';

/** Preserve the list reference only when every saved field and its order match. */
export function updatedGames(previous: Game[], next: Game[]): Game[] {
  return previous.length === next.length &&
    previous.every((game, index) => {
      const updated = next[index];
      const fields = new Set([...Object.keys(game), ...Object.keys(updated)] as (keyof Game)[]);
      return [...fields].every((field) => game[field] === updated[field]);
    })
    ? previous
    : next;
}

/** Scope account views without deleting other accounts' saved games. */
export function accountGames(games: Game[], username: string) {
  const user = username.trim().toLowerCase();
  return games
    .filter(
      (game) =>
        !user || [game.white, game.black].some((name) => name.trim().toLowerCase() === user),
    )
    .sort((a, b) => b.date - a.date);
}
