import type { Game, Review } from '../types';
export type ReviewJob = {
  state: 'queued' | 'analysing' | 'paused';
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
  gameId?: string;
  kind: 'progress' | 'success' | 'error';
  title: string;
  detail: string;
  done?: number;
  total?: number;
  paused?: boolean;
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
  pause,
  resume,
  onPaused,
}: {
  owner: { current: 'manual' | 'auto' | null };
  read: (game: Game) => Promise<Review | null>;
  run: RunReview;
  cancel: () => Promise<unknown>;
  compatible: (review: Review) => boolean;
  notify: (activity: BackgroundActivity | null) => void;
  onReview: (game: Game, review: Review) => void;
  onJobs?: (jobs: Record<string, ReviewJob>) => void;
  pause?: () => void;
  resume?: () => void;
  onPaused?: (paused: boolean) => void;
}) {
  const pending = new Map<string, { game: Game; run?: RunReview; cancelled?: boolean }>();
  const checking = new Set<string>();
  const jobs: Record<string, ReviewJob> = {};
  const publish = () => onJobs?.({ ...jobs });
  const remove = (id: string) => {
    pending.delete(id);
    delete jobs[id];
    publish();
  };
  let active = true;
  let paused = false;
  let progressActivity: BackgroundActivity | null = null;
  let draining = false;
  let current: { game: Game; run?: RunReview; cancelled?: boolean } | null = null;
  let sequence = 0;
  const manualRunning = () => owner.current === 'manual';
  async function drain() {
    if (!active || paused || draining || manualRunning()) return;
    draining = true;
    try {
      for (const task of pending.values()) {
        const { game } = task;
        if (!active || paused || manualRunning()) break;
        let saved: Review | null = null;
        try {
          saved = await read(game);
          if (!active || paused || manualRunning()) break;
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
          progressActivity = {
            id: activityId,
            gameId: game.id,
            kind: 'progress',
            title: 'Analizando partida',
            detail: `${game.white} vs ${game.black}`,
            done: 0,
          };
          notify(progressActivity);
          const result = await (task.run ?? run)(game, (done, total, review) => {
            if (!active || task.cancelled || owner.current !== origin) return;
            jobs[game.id] = { state: paused ? 'paused' : 'analysing', done, total, ...manual };
            publish();
            progressActivity = {
              id: activityId,
              gameId: game.id,
              kind: 'progress',
              title: paused ? 'Análisis en pausa' : 'Analizando partida',
              detail: `${game.white} vs ${game.black}`,
              done,
              total,
              paused,
            };
            notify(progressActivity);
            onReview(game, review);
          });
          if (!active) break;
          if (task.cancelled) {
            if (saved?.complete) onReview(game, saved);
            remove(game.id);
            notify(null);
            continue;
          }
          remove(game.id);
          onReview(game, result);
          notify({
            id: `${activityId}:complete`,
            gameId: game.id,
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
            gameId: game.id,
            kind: 'error',
            title: 'No se pudo analizar',
            detail: task.run
              ? `${game.white} vs ${game.black}`
              : 'Se reintentará en la próxima comprobación.',
          });
        } finally {
          current = null;
          progressActivity = null;
          if (active && owner.current === (task.run ? 'manual' : 'auto')) owner.current = null;
        }
      }
    } finally {
      draining = false;
    }
  }
  return {
    pause() {
      if (!active || paused) return;
      paused = true;
      pause?.();
      onPaused?.(true);
      if (current && jobs[current.game.id]) {
        jobs[current.game.id] = { ...jobs[current.game.id], state: 'paused' };
        publish();
      }
      if (progressActivity) {
        progressActivity = { ...progressActivity, title: 'Análisis en pausa', paused: true };
        notify(progressActivity);
      }
    },
    resume() {
      if (!active || !paused) return;
      paused = false;
      resume?.();
      onPaused?.(false);
      if (current && jobs[current.game.id]) {
        jobs[current.game.id] = { ...jobs[current.game.id], state: 'analysing' };
        publish();
      }
      if (progressActivity) {
        progressActivity = { ...progressActivity, title: 'Analizando partida', paused: false };
        notify(progressActivity);
      }
      void drain();
    },
    async add(games: Game[]) {
      if (!active) return;
      const candidates = games.filter((game) => {
        if (pending.has(game.id) || checking.has(game.id)) return false;
        checking.add(game.id);
        return true;
      });
      try {
        // A library scan is not a request to reanalyse a completed game.
        // Check before publishing a queued job, even while another game runs.
        const saved = await Promise.all(candidates.map(read));
        if (!active) return;
        let added = false;
        candidates.forEach((game, index) => {
          if (pending.has(game.id) || (saved[index]?.complete && compatible(saved[index]))) return;
          pending.set(game.id, { game });
          jobs[game.id] = { state: 'queued', done: 0 };
          added = true;
        });
        if (added) publish();
        void drain();
      } finally {
        for (const game of candidates) checking.delete(game.id);
      }
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
      resume?.();
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
