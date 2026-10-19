import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { downloadGames } from '../api/chesscom';
import { repository } from '../database/repository';
import { makeTree } from '../chess/game';
import { GameReviewService, REVIEW_VERSION } from './GameReviewService';
import { autoCandidates } from './autoCandidates';
import { automaticStart } from './automaticStart';
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
  const [notifications, setNotifications] = useState<BackgroundActivity[]>([]);
  const [jobs, setJobs] = useState<Record<string, ReviewJob>>({});
  const [paused, setPaused] = useState(false);
  const callbacks = useRef({ onGames, onReview });
  callbacks.current = { onGames, onReview };
  const scan = useRef<() => Promise<void>>(async () => {});
  const configuration = useRef({ engineId, options });
  configuration.current = { engineId, options };
  const worker = useRef<ReturnType<typeof createBackgroundQueue> | null>(null);
  const notify = useRef<(activity: BackgroundActivity | null) => void>(() => {});
  const dismiss = useRef<(id: string) => void>(() => {});
  const viewedGame = useRef<(gameId: string | null) => void>(() => {});
  const viewGame = useCallback((gameId: string | null) => viewedGame.current(gameId), []);
  // The worker lives as long as the app, independently of polling and navigation.
  useEffect(() => {
    const notices = createReviewNotifications(setNotifications);
    notify.current = notices.notify;
    dismiss.current = notices.dismiss;
    viewedGame.current = notices.viewGame;
    const queue = createBackgroundQueue({
      owner,
      read: (game) => repository.get<Review>('reviews', game.id),
      compatible: (review) =>
        review.version === REVIEW_VERSION && review.engineId === configuration.current.engineId,
      run: (game, progress) =>
        service.run(game.id, makeTree(game.pgn), { ...configuration.current.options }, progress),
      cancel: () => service.cancel(),
      pause: () => service.pause(),
      resume: () => service.resume(),
      onPaused: setPaused,
      notify: (activity) => notify.current(activity),
      onJobs: setJobs,
      onReview: (game, review) => callbacks.current.onReview(game.id, review),
    });
    worker.current = queue;
    return () => {
      worker.current = null;
      notices.dispose();
      notify.current = () => {};
      dismiss.current = () => {};
      viewedGame.current = () => {};
      queue.stop();
    };
  }, [service, owner]);
  useEffect(() => {
    if (!enabled || !username.trim() || !engineId) return;
    let active = true;
    let polling = false;
    const user = username.trim();
    const started = Date.now();
    void automaticStart(user, started).catch(() => {});
    async function scanLibrary() {
      try {
        const [baseline, cleaned] = await Promise.all([
          automaticStart(user, started),
          repository.list<{ gameId: string }>('review-cleaned'),
        ]);
        const excluded = new Set(cleaned.map((entry) => entry.gameId));
        if (!active) return;
        const games = await repository.list<Game>('games');
        if (active) await worker.current?.add(autoCandidates(games, user, baseline, excluded));
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
        const downloaded = await downloadGames(user);
        if (!active) return;
        for (const game of downloaded) await repository.put('games', game.id, game);
        const games = (await repository.list<Game>('games')).sort((a, b) => b.date - a.date);
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
        if (active) await scanLibrary();
        polling = false;
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
    notifications,
    dismiss: (id: string) => dismiss.current(id),
    viewGame,
    jobs,
    paused,
    pause: () => worker.current?.pause(),
    resume: () => worker.current?.resume(),
    reportError: useCallback((message: string) => {
      const detail = /api\.chess\.com|No se pudo conectar con Chess\.com/i.test(message)
        ? 'No se pudo conectar con Chess.com.'
        : /standard algebraic notation|Invalid move:/i.test(message)
          ? 'No se pudo leer el PGN. Revisa las jugadas.'
          : message;
      notify.current({ id: `app-error:${detail}`, kind: 'error', title: 'Error', detail });
    }, []),
    analyze: (game: Game, tree: GameTree, options: EngineOptions) => {
      const capturedOptions = { ...options };
      worker.current?.analyze(game, (_game, progress) =>
        service.run(game.id, tree, capturedOptions, progress),
      );
    },
    cancel: (id: string) => worker.current?.cancelJob(id) ?? Promise.resolve(),
    scan: () => scan.current(),
  };
}
