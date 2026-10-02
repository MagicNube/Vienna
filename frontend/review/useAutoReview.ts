import { useEffect, useRef, useState, type RefObject } from 'react';
import { downloadGames } from '../api/chesscom';
import { repository } from '../database/repository';
import { makeTree } from '../chess/game';
import { GameReviewService, REVIEW_VERSION } from './GameReviewService';
import { autoCandidates } from './autoCandidates';
import { createReviewNotifications } from './notifications';
import { createBackgroundQueue, type BackgroundActivity, type ReviewJob } from './backgroundQueue';
import type { EngineOptions, Game, GameTree, Review } from '../types';

const AUTO_POLL_MS = 5 * 60_000;

export function useAutoReview({
  enabled,
  username,
  engineId,
  options,
  service,
  owner,
  onGames,
  onReview,
}: {
  enabled: boolean;
  username: string;
  engineId?: string;
  options: EngineOptions;
  service: GameReviewService;
  owner: RefObject<'manual' | 'auto' | null>;
  onGames: (games: Game[]) => void;
  onReview: (id: string, review: Review) => void;
}) {
  const [activity, setActivity] = useState<BackgroundActivity | null>(null);
  const [jobs, setJobs] = useState<Record<string, ReviewJob>>({});
  const callbacks = useRef({ onGames, onReview });
  callbacks.current = { onGames, onReview };
  const scan = useRef<(discovered?: Game[]) => Promise<void>>(async () => {});
  const discoveries = useRef(new Map<string, Game>());
  const configuration = useRef({ engineId, options });
  configuration.current = { engineId, options };
  const worker = useRef<ReturnType<typeof createBackgroundQueue> | null>(null);
  const notify = useRef<(activity: BackgroundActivity | null) => void>(setActivity);
  // The worker lives as long as the app, independently of polling and navigation.
  useEffect(() => {
    const notices = createReviewNotifications(setActivity);
    notify.current = notices.notify;
    const queue = createBackgroundQueue({
      owner,
      read: (game) => repository.get<Review>('reviews', game.id),
      compatible: (review) =>
        review.version === REVIEW_VERSION && review.engineId === configuration.current.engineId,
      run: (game, progress) =>
        service.run(game.id, makeTree(game.pgn), { ...configuration.current.options }, progress),
      cancel: () => service.cancel(),
      notify: (activity) => notify.current(activity),
      onJobs: setJobs,
      onReview: (game, review) => callbacks.current.onReview(game.id, review),
    });
    worker.current = queue;
    return () => {
      worker.current = null;
      notices.dispose();
      notify.current = () => {};
      queue.stop();
    };
  }, [service, owner]);
  useEffect(() => {
    if (!enabled || !username.trim() || !engineId) return;
    let active = true;
    let polling = false;
    const user = username.trim();
    const baselineKey = `autoReviewSince:${user.toLowerCase()}`;
    const started = Date.now();
    const discoveriesKey = `autoReviewDiscovered:${user.toLowerCase()}`;
    const knownDiscoveries = repository
      .get<string[]>('settings', discoveriesKey)
      .then((ids) => new Set(ids ?? []));
    void knownDiscoveries.catch(() => {});
    const since = repository.get<number>('settings', baselineKey).then(async (saved) => {
      if (saved !== null) return saved;
      await repository.put('settings', baselineKey, started);
      return started;
    });
    void since.catch(() => {});
    async function scanLibrary(discovered: Game[] = []) {
      try {
        const [baseline, ids] = await Promise.all([since, knownDiscoveries]);
        if (!active) return;
        const fresh = autoCandidates([...discoveries.current.values(), ...discovered], user, 0);
        discoveries.current.clear();
        const previousSize = ids.size;
        for (const game of fresh) ids.add(game.id);
        if (ids.size !== previousSize) await repository.put('settings', discoveriesKey, [...ids]);
        const games = await repository.list<Game>('games');
        if (active) worker.current?.add([...fresh, ...autoCandidates(games, user, baseline, ids)]);
      } catch {
        if (active && !owner.current)
          notify.current({
            id: 'review-read-error',
            kind: 'error',
            title: 'No se pudo preparar el análisis',
            detail: 'Se reintentará en la próxima comprobación.',
          });
      }
    }
    scan.current = scanLibrary;
    async function poll() {
      if (!active || polling) return;
      polling = true;
      try {
        const existing = await repository.list<Game>('games');
        const known = new Set(existing.map((game) => game.id));
        const downloaded = await downloadGames(user);
        if (!active) return;
        for (const game of downloaded) await repository.put('games', game.id, game);
        const games = (await repository.list<Game>('games')).sort((a, b) => b.date - a.date);
        await scanLibrary(existing.length ? downloaded.filter((game) => !known.has(game.id)) : []);
        if (active) callbacks.current.onGames(games);
      } catch {
        if (active && !owner.current)
          notify.current({
            id: 'sync-error',
            kind: 'error',
            title: 'No se pudo actualizar Chess.com',
            detail: 'Se reintentará en cinco minutos.',
          });
      } finally {
        polling = false;
        if (active) await scanLibrary();
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), AUTO_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
      scan.current = async () => {};
    };
  }, [enabled, username, engineId, owner]);
  return {
    activity,
    jobs,
    analyze: (game: Game, tree: GameTree, options: EngineOptions) => {
      const capturedOptions = { ...options };
      worker.current?.analyze(game, (_game, progress) =>
        service.run(game.id, tree, capturedOptions, progress),
      );
    },
    cancel: (id: string) => worker.current?.cancelJob(id) ?? Promise.resolve(),
    scan: (discovered: Game[] = []) => {
      for (const game of discovered) discoveries.current.set(game.id, game);
      return scan.current();
    },
  };
}
