import { repository } from '../database/repository';
import type { Game, Review } from '../types';
import { gameProfile, type GameProfile } from './statisticsInsights';
import { upgradeReview } from './upgradeReview';
import { REVIEW_VERSION } from './GameReviewService';
import { CLASSIFICATION_VERSION } from './classification';

export type StatisticsSnapshot = {
  reviews: Record<string, Review>;
  profiles: Map<string, GameProfile>;
  skipped: number;
};
const empty = (): StatisticsSnapshot => ({ reviews: {}, profiles: new Map(), skipped: 0 });
const compact = (review: Review): Review => ({
  ...review,
  positions: {},
  moves: review.moves.map((move) => ({ ...move, best: '', explanation: '' })),
});
type RecordEntry = { pgn?: string; review: Review | null; serial: number };

// App owns the cache: page navigation never discards loaded per-game summaries.
export class StatisticsCache {
  private profiles = new Map<string, { pgn: string; profile: GameProfile }>();
  private records = new Map<string, RecordEntry>();
  private reads = new Map<string, number>();
  private key = '';
  private snapshotScope = '';
  private snapshot = empty();
  private pending = new Map<string, Promise<StatisticsSnapshot>>();
  private generation = 0;
  private change = 0;
  private sequence = 0;
  private requestedKey = '';
  private scope(games: Game[]) {
    return JSON.stringify(games.map((g) => [g.id, g.pgn]));
  }
  private signature(games: Game[]) {
    return `${this.generation}:${this.change}:${this.scope(games)}`;
  }
  peek(games: Game[]) {
    return this.key === this.signature(games) ? this.snapshot : null;
  }
  previous(games: Game[]) {
    return this.snapshotScope === this.scope(games) ? this.snapshot : null;
  }
  updateReview(id: string, review: Review) {
    if (!review.complete) return;
    const value = compact(review);
    const previous = this.records.get(id);
    if (previous?.review && JSON.stringify(previous.review) === JSON.stringify(value)) return;
    this.records.set(id, {
      pgn: previous?.pgn ?? this.profiles.get(id)?.pgn,
      review: value,
      serial: ++this.sequence,
    });
    this.change++;
  }
  invalidate() {
    this.generation++;
    this.records.clear();
    this.reads.clear();
    this.key = '';
    this.snapshotScope = '';
    this.snapshot = empty();
  }
  load(games: Game[]): Promise<StatisticsSnapshot> {
    const key = this.signature(games);
    this.requestedKey = key;
    const cached = this.peek(games);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const generation = this.generation;
    const task = (async () => {
      const missing = games.filter((game) => {
        const saved = this.records.get(game.id);
        return !saved || (saved.pgn !== undefined && saved.pgn !== game.pgn);
      });
      if (missing.length) {
        const ticket = ++this.sequence;
        for (const game of missing) this.reads.set(game.id, ticket);
        const summaries = await repository.statisticsReviews(missing.map((game) => game.id));
        if (generation === this.generation) {
          for (const game of missing) {
            const current = this.records.get(game.id);
            if (this.reads.get(game.id) !== ticket || (current && current.serial > ticket))
              continue;
            this.records.set(game.id, {
              pgn: game.pgn,
              review: summaries[game.id] ?? null,
              serial: ticket,
            });
          }
        }
      }
      const result = empty();
      for (let offset = 0; offset < games.length; offset += 8) {
        let parsed = false;
        const batch = await Promise.allSettled(
          games.slice(offset, offset + 8).map(async (game) => {
            const cached = this.profiles.get(game.id);
            const profile = cached?.pgn === game.pgn ? cached.profile : gameProfile(game);
            if (cached?.pgn !== game.pgn) parsed = true;
            this.profiles.set(game.id, { pgn: game.pgn, profile });
            result.profiles.set(game.id, profile);
            const record = this.records.get(game.id);
            if (record?.pgn !== undefined && record.pgn !== game.pgn) return;
            let review = record?.review;
            if (!review) return;
            if (review.version !== REVIEW_VERSION || !profile.tree) {
              result.skipped++;
              return;
            }
            if (review.classificationVersion !== CLASSIFICATION_VERSION) {
              // Only old classification evidence requires the full analysis, once.
              const full = await repository.get<Review>('reviews', game.id);
              if (!full) return;
              const upgraded = upgradeReview(profile.tree, full);
              if (
                record &&
                generation === this.generation &&
                this.records.get(game.id) === record
              ) {
                const cached = await repository.cacheStatisticsReview(
                  game.id,
                  compact(full),
                  compact(upgraded),
                );
                const value = cached
                  ? compact(upgraded)
                  : ((await repository.statisticsReviews([game.id]))[game.id] ?? null);
                if (generation === this.generation && this.records.get(game.id) === record)
                  record.review = value;
              }
              review = this.records.get(game.id)?.review;
              if (!review) return;
            }
            result.reviews[game.id] = compact(review);
          }),
        );
        result.skipped += batch.filter((r) => r.status === 'rejected').length;
        // Yield while parsing a new library, rather than blocking board interactions.
        if (parsed && offset + 8 < games.length)
          await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (key === this.requestedKey && key === this.signature(games)) {
        this.key = key;
        this.snapshotScope = this.scope(games);
        this.snapshot = result;
      }
      return result;
    })();
    this.pending.set(key, task);
    void task.finally(() => this.pending.delete(key)).catch(() => {});
    return task;
  }
}
