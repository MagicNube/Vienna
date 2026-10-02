import type { Game, Review } from '../types';
export type ReviewJob = {
  state: 'queued' | 'analysing';
  done: number;
  total?: number;
  manual?: boolean;
};
type RunReview = (
  game: Game,
  progress: (done: number, total: number, review: Review) => void,
) => Promise<Review>;

export type BackgroundActivity = {
  id: string;
  kind: 'progress' | 'success' | 'error';
  title: string;
  detail: string;
  done?: number;
  total?: number;
};

// Downloads can enqueue games while the single review lane is occupied.
export function createBackgroundQueue({
  owner,
  read,
  run,
  cancel,
  compatible,
  notify,
  onReview,
  onJobs,
}: {
  owner: { current: 'manual' | 'auto' | null };
  read: (game: Game) => Promise<Review | null>;
  run: RunReview;
  cancel: () => Promise<unknown>;
  compatible: (review: Review) => boolean;
  notify: (activity: BackgroundActivity | null) => void;
  onReview: (game: Game, review: Review) => void;
  onJobs?: (jobs: Record<string, ReviewJob>) => void;
}) {
  const pending = new Map<string, { game: Game; run?: RunReview; cancelled?: boolean }>();
  const jobs: Record<string, ReviewJob> = {};
  const publish = () => onJobs?.({ ...jobs });
  const remove = (id: string) => {
    pending.delete(id);
    delete jobs[id];
    publish();
  };
  let active = true;
  let draining = false;
  let current: { game: Game; run?: RunReview; cancelled?: boolean } | null = null;
  let sequence = 0;
  const manualRunning = () => owner.current === 'manual';
  async function drain() {
    if (!active || draining || manualRunning()) return;
    draining = true;
    try {
      for (const task of pending.values()) {
        const { game } = task;
        if (!active || manualRunning()) break;
        let saved: Review | null = null;
        try {
          saved = await read(game);
          if (!active || manualRunning()) break;
          if (task.cancelled) continue;
          if (!task.run && saved?.complete && compatible(saved)) {
            remove(game.id);
            continue;
          }
          current = task;
          const origin = task.run ? 'manual' : 'auto';
          const manual = task.run ? { manual: true } : {};
          const activityId = `${game.id}:${++sequence}`;
          owner.current = origin;
          jobs[game.id] = { state: 'analysing', done: 0, ...manual };
          publish();
          notify({
            id: activityId,
            kind: 'progress',
            title: 'Analizando partida',
            detail: `${game.white} vs ${game.black}`,
            done: 0,
          });
          const result = await (task.run ?? run)(game, (done, total, review) => {
            if (!active || task.cancelled || owner.current !== origin) return;
            jobs[game.id] = { state: 'analysing', done, total, ...manual };
            publish();
            notify({
              id: activityId,
              kind: 'progress',
              title: 'Analizando partida',
              detail: `${game.white} vs ${game.black}`,
              done,
              total,
            });
            onReview(game, review);
          });
          if (!active) break;
          if (task.cancelled) {
            if (saved?.complete) onReview(game, saved);
            remove(game.id);
            continue;
          }
          remove(game.id);
          onReview(game, result);
          notify({
            id: `${activityId}:complete`,
            kind: 'success',
            title: 'Partida analizada',
            detail: `${game.white} vs ${game.black}`,
          });
        } catch (error) {
          if (!active) break;
          if (saved?.complete) onReview(game, saved);
          if (task.cancelled) {
            remove(game.id);
            notify(null);
            continue;
          }
          if (String(error).includes('cancelled')) {
            jobs[game.id] = { state: 'queued', done: 0, ...(task.run ? { manual: true } : {}) };
            publish();
            notify(null);
            break;
          }
          remove(game.id); // Retry at the next scan, not in a busy loop.
          notify({
            id: `${game.id}:error`,
            kind: 'error',
            title: 'No se pudo analizar',
            detail: task.run
              ? `${game.white} vs ${game.black}`
              : 'Se reintentará en la próxima comprobación.',
          });
        } finally {
          current = null;
          if (active && owner.current === (task.run ? 'manual' : 'auto')) owner.current = null;
        }
      }
    } finally {
      draining = false;
    }
  }
  return {
    add(games: Game[]) {
      if (!active) return;
      for (const game of games) {
        if (!pending.has(game.id)) pending.set(game.id, { game });
        jobs[game.id] ??= { state: 'queued', done: 0 };
      }
      publish();
      void drain();
    },
    analyze(game: Game, run: RunReview) {
      if (!active || pending.has(game.id)) return;
      pending.set(game.id, { game, run });
      jobs[game.id] = { state: 'queued', done: 0, manual: true };
      publish();
      void drain();
    },
    async cancelJob(id: string) {
      const task = pending.get(id);
      if (!task?.run) return;
      task.cancelled = true;
      if (task === current) await cancel();
      else remove(id);
    },
    drain,
    stop() {
      active = false;
      pending.clear();
      for (const id of Object.keys(jobs)) delete jobs[id];
      publish();
      if (current) {
        owner.current = null;
        void cancel().catch(() => {});
      }
    },
  };
}
