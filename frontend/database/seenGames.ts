import { repository } from './repository';

export const SEEN_GAMES_KIND = 'game-seen';
export type SeenGame = { gameId: string; seen: boolean; updatedAt: number };
export function canToggleSeen(seen: boolean, analysed: boolean, loadingAnalyses = false) {
  return seen || (analysed && !loadingAnalyses);
}
type Storage = {
  list: (kind: string) => Promise<SeenGame[]>;
  put: (kind: string, id: string, value: SeenGame) => Promise<void>;
};

// Human review follows a complete engine analysis. New games stay unseen.
export class SeenGames {
  private ids = new Set<string>();
  private loading?: Promise<Set<string>>;
  private writes = new Map<string, Promise<Set<string>>>();

  constructor(private storage: Storage = repository) {}

  load(): Promise<Set<string>> {
    this.loading ??= this.storage.list(SEEN_GAMES_KIND).then(
      (records) => {
        this.ids = new Set(records.filter((r) => r.seen && r.gameId).map((r) => r.gameId));
        return new Set(this.ids);
      },
      (error) => {
        this.loading = undefined;
        throw error;
      },
    );
    return this.loading.then(() => new Set(this.ids));
  }

  async clearUnanalysed(analysed: ReadonlySet<string>): Promise<Set<string>> {
    const saved = await this.load();
    for (const id of saved) {
      if (!analysed.has(id)) await this.setSeen(id, false);
    }
    return this.load();
  }

  forget(ids: string[]) {
    for (const id of ids) this.ids.delete(id);
    return new Set(this.ids);
  }

  setSeen(gameId: string, seen: boolean): Promise<Set<string>> {
    const previous = this.writes.get(gameId) ?? Promise.resolve(new Set(this.ids));
    const write = previous
      .catch(() => new Set(this.ids))
      .then(async () => {
        await this.load();
        await this.storage.put(SEEN_GAMES_KIND, gameId, {
          gameId,
          seen,
          updatedAt: Date.now(),
        });
        if (seen) this.ids.add(gameId);
        else this.ids.delete(gameId);
        return new Set(this.ids);
      });
    this.writes.set(gameId, write);
    const cleanup = () => {
      if (this.writes.get(gameId) === write) this.writes.delete(gameId);
    };
    void write.then(cleanup, cleanup);
    return write;
  }
}
