import type { Game } from '../types';
import { autoCandidates } from './autoCandidates';

/** A new instance belongs to one app opening; persisted dates are never reused. */
export function createAutomaticSession(openedAt: number) {
  const cutoffs = new Map<string, number>();
  const key = (username: string) => username.trim().toLowerCase();
  return {
    get(username: string) {
      return cutoffs.get(key(username)) ?? null;
    },
    prepare(username: string, games: Game[], observedAt = Date.now()) {
      const user = key(username);
      const existing = cutoffs.get(user);
      if (existing !== undefined) return existing;
      // Finished games cannot look new just because the device clock is behind
      // Chess.com's timestamps. Normal new games since opening remain eligible.
      const since = autoCandidates(games, user, 0).reduce(
        (cutoff, game) =>
          Number.isSafeInteger(game.date) && game.date > observedAt
            ? Math.max(cutoff, game.date + 1)
            : cutoff,
        openedAt,
      );
      cutoffs.set(user, since);
      return since;
    },
  };
}
