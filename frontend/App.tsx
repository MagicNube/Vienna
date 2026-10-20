import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyAppearance } from './appearance';
import { Continuations } from './components/Continuations';
import { Board } from './components/Board';
import { Icon } from './components/Icon';
import { EvalGraph } from './components/EvalGraph';
import { EvaluationBar } from './components/EvaluationBar';
import { Modal } from './components/Modal';
import { WINDOW_ERROR_EVENT } from './components/WindowTitleBar';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsActions } from './components/SettingsActions';
import type { FeedbackAction } from './components/HelpSettings';
import { AnalysisLevelPicker } from './components/AnalysisLevelPicker';
import { GameLibrary, timeControl } from './components/GameLibrary';
import { ReviewSummary } from './components/ReviewSummary';
import { MoveExplanation } from './components/MoveExplanation';
import { ReturnControl } from './components/ReturnControl';
import { ProfilePanel } from './components/ProfilePanel';
import { AccountChoice } from './components/AccountChoice';
import { profileInitials } from './profile/image';
import { MoveList } from './components/MoveList';
import { RecentGame } from './components/RecentGame';
import { Statistics } from './components/Statistics';
import { StatisticsCache } from './review/statisticsCache';
import { isStatisticsGame, ownColor as statisticsColor } from './review/statistics';
import { NotificationCenter } from './components/NotificationCenter';
import { BrandMark } from './components/BrandMark';
import { analysisLevelLabel, analysisLevelName } from './review/analysisLevel';
import { CapturedPieces } from './components/CapturedPieces';
import { positionMaterial } from './chess/material';
import { distinctLines } from './engine/lines';
import { savedAnalysis, reviewMatchesOptions } from './engine/savedAnalysis';
import { withBookMove } from './chess/openings';
import { playChessSound, soundForMove } from './audio/chessSounds';
import { cycleCategory, pauseCategoryTour, type CategoryTour } from './review/categoryTour';
import { mainOrigin, returnContext } from './review/returnNavigation';
import { freeLine } from './chess/freeBoard';
import { navigationTargets, type NavigationDirection } from './chess/navigation';
import { useAutoReview } from './review/useAutoReview';
import { useReviewIndex } from './review/useReviewIndex';
import { useSeenGames } from './database/useSeenGames';
import { SeenControl } from './components/SeenControl';
import { addMove, importPgn, makeTree, playerColor } from './chess/game';
import { downloadGames } from './api/chesscom';
import { accountGames, updatedGames } from './api/accountGames';
import { isTrainingGame } from './chess/gameKind';
import { repository } from './database/repository';
import { engine } from './engine/EngineService';
import { GameReviewService, REVIEW_VERSION } from './review/GameReviewService';
import { classify } from './review/classification';
import { upgradeReview } from './review/upgradeReview';
import {
  defaultSettings,
  type Settings,
  type Game,
  type GameTree,
  type Review,
  type EngineLine,
  type EngineOptions,
  type MoveReview,
  type Category,
} from './types';

const emptyTree = makeTree('*');
type BoardSession = {
  game?: Game;
  tree: GameTree;
  nodeId: string;
  review: Review | null;
  orientation: 'w' | 'b';
  tip?: string;
};
export function App() {
  const statisticsCache = useRef(new StatisticsCache());
  const [recentNow, setRecentNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setRecentNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [view, setView] = useState<'analysis' | 'free' | 'statistics'>('analysis');
  const [freeMode, setFreeMode] = useState(false);
  const [freeTip, setFreeTip] = useState('m0');
  const [freeUndo, setFreeUndo] = useState<BoardSession | null>(null);
  const [preview, setPreview] = useState<{ key: string; rank: number; move?: string } | null>(null);
  const [reviewRevision, setReviewRevision] = useState(0);
  const [tour, setTour] = useState<CategoryTour | null>(null);
  const [moveRatings, setMoveRatings] = useState<Record<string, MoveReview>>({});
  const analysisSession = useRef<BoardSession | null>(null);
  const latestReviews = useRef(new Map<string, Review>());
  const freeSession = useRef<BoardSession>({
    tree: emptyTree,
    nodeId: 'm0',
    review: null,
    orientation: 'w',
  });
  const completedPositions = useRef(new Map<string, EngineLine[]>());
  const [settings, setSettings] = useState<Settings>(defaultSettings),
    [games, setGames] = useState<Game[]>([]),
    [game, setGame] = useState<Game>();
  const [tree, setTree] = useState<GameTree>(emptyTree),
    [nodeId, setNodeId] = useState('m0');
  const [orientation, setOrientation] = useState<'w' | 'b'>('w'),
    [analysis, setAnalysis] = useState<{ key: string; lines: EngineLine[] }>({
      key: '',
      lines: [],
    }),
    [evaluation, setEvaluation] = useState<EngineLine>(),
    [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState<{
      available: boolean;
      name: string;
      engineId: string;
      cpus: number;
    } | null>(null),
    [engineBusy, setEngineBusy] = useState(false);
  const [tab, setTab] = useState<'moves' | 'review'>('review'),
    [modal, setModal] = useState<
      'import' | 'settings' | 'library' | 'connect' | 'profile' | 'account-choice' | null
    >(null);
  const [ready, setReady] = useState(false),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState('');
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const rememberedGame = useRef<Game | undefined>(undefined);
  const [pgn, setPgn] = useState(''),
    [username, setUsername] = useState(''),
    [importing, setImporting] = useState(false);
  const [categoryLibrary, setCategoryLibrary] = useState<{
    category: Category;
    counts: Record<string, number>;
  } | null>(null);
  const [reviewTime, setReviewTime] = useState(500);
  const [settingsReport, setSettingsReport] = useState<string>();
  const [feedbackAction, setFeedbackAction] = useState<FeedbackAction>(null);
  useLayoutEffect(() => applyAppearance(settings), [settings.appearance, settings.density]);
  const libraryGames = useMemo(
    () => accountGames(games, settings.username),
    [games, settings.username],
  );
  const recentGames = libraryGames.filter((game) => !isTrainingGame(game)).slice(0, 5);
  const service = useRef(new GameReviewService()),
    loadToken = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    selectedGameId = useRef<string | undefined>(undefined),
    initialized = useRef(false);
  const reviewOwner = useRef<'manual' | 'auto' | null>(null);
  const node = tree.nodes.find((n) => n.id === nodeId) ?? tree.nodes[0];
  const storedAnalysis = savedAnalysis(node, review, freeMode);
  const activeFreeLine = useMemo(
    () => (freeMode ? freeLine(tree, node.id, freeTip) : []),
    [freeMode, tree, node.id, freeTip],
  );
  const navigation = useMemo(
    () => navigationTargets(tree, node, freeMode ? activeFreeLine : undefined),
    [tree, node, freeMode, activeFreeLine],
  );
  const turn = node.fen.split(' ')[1];
  const positionScope = `${game?.id ?? 'free'}:${tree.rootFen}`;
  const positionKey = `${positionScope}:${node.id}:${node.fen}`;
  const moveListRatings = useMemo(() => {
    const nodes = new Map(tree.nodes.map((n) => [n.id, n]));
    return Object.fromEntries(
      tree.nodes.map((n) => {
        const parent = n.parent ? nodes.get(n.parent) : undefined;
        const rating = moveRatings[`${positionScope}:${n.id}:${n.fen}`];
        return [n.id, parent ? withBookMove(parent, n, rating) : rating];
      }),
    );
  }, [tree, moveRatings, positionScope]);
  const options: EngineOptions = useMemo(
    () => ({
      threads: settings.threads || Math.min(8, Math.max(1, Math.floor((status?.cpus ?? 4) / 2))),
      hash: settings.hash,
      multiPv: settings.multiPv,
      movetime: settings.interactiveTime,
      depth: settings.depth,
    }),
    [
      settings.threads,
      settings.hash,
      settings.multiPv,
      settings.interactiveTime,
      settings.depth,
      status?.cpus,
    ],
  );
  const reportError = useCallback((e: unknown) => {
    if (!String(e).includes('cancelled')) setError(String(e).replace(/^Error: /, ''));
  }, []);
  useEffect(() => {
    const handle = (event: Event) => reportError((event as CustomEvent<string>).detail);
    window.addEventListener(WINDOW_ERROR_EVENT, handle);
    return () => window.removeEventListener(WINDOW_ERROR_EVENT, handle);
  }, [reportError]);
  const autoOptions = useMemo(
    () => ({
      threads: options.threads,
      hash: options.hash,
      multiPv: options.multiPv,
      movetime: settings.autoReviewTime,
      depth: options.depth,
    }),
    [options.threads, options.hash, options.multiPv, options.depth, settings.autoReviewTime],
  );
  function updateGames(next: Game[]) {
    setGames((previous) => updatedGames(previous, next));
  }
  const autoReview = useAutoReview({
    enabled: ready && accountConfirmed && settings.autoReview && !!status?.available,
    username: settings.username,
    engineId: status?.engineId,
    options: autoOptions,
    service: service.current,
    owner: reviewOwner,
    onGames: updateGames,
    onReview: (id, result) => {
      if (result.complete) statisticsCache.current.updateReview(id, result);
      if (result.complete) latestReviews.current.set(id, result);
      if (result.complete) setReviewRevision((n) => n + 1);
      if (selectedGameId.current === id) {
        setReview(result);
        if (result.complete) setReviewTime(result.options.movetime);
      }
      if (analysisSession.current?.game?.id === id) analysisSession.current.review = result;
    },
  });

  const reviewIndex = useReviewIndex(games, reviewRevision, reportError);
  useEffect(() => {
    if (!error) return;
    autoReview.reportError(error);
    setError('');
  }, [error, autoReview.reportError]);
  useEffect(() => {
    if (ready && status && !status.available)
      autoReview.reportError('No se encuentra Stockfish 19. Revisa la instalación del motor.');
  }, [ready, status?.available, autoReview.reportError]);
  useEffect(() => {
    autoReview.viewGame(
      ready && view === 'analysis' && !freeMode && !modal ? (game?.id ?? null) : null,
    );
  }, [ready, view, freeMode, modal, game?.id, autoReview.viewGame]);
  const seenGames = useSeenGames(reportError, reviewIndex.reviewed, reviewIndex.loading);
  const reviewJobs = autoReview.jobs;
  const selectedReviewJob = !freeMode && game ? reviewJobs[game.id] : undefined;
  const selectedManualJob = selectedReviewJob?.manual ? selectedReviewJob : undefined;
  const selectedAutoJob = selectedReviewJob?.manual ? undefined : selectedReviewJob;
  const visibleProgress =
    selectedReviewJob && selectedReviewJob.state !== 'queued'
      ? { done: selectedReviewJob.done, total: selectedReviewJob.total ?? tree.mainIds.length }
      : null;
  async function selectGame(g: Game, config = settings) {
    const token = ++loadToken.current;
    await engine.cancel();
    const base = makeTree(g.pgn);
    const [saved, stored] = await Promise.all([
      repository.get<GameTree>('variants', g.id),
      repository.get<Review>('reviews', g.id),
    ]);
    if (token !== loadToken.current) return;
    if (freeMode) {
      freeSession.current = { tree, nodeId, review: null, orientation, tip: freeTip };
      await repository.put('settings', 'freeBoard', freeSession.current);
      if (token !== loadToken.current) return;
    }
    setFreeMode(false);
    setView('analysis');
    setTour(null);
    setGame(g);
    selectedGameId.current = g.id;
    const selectedTree = saved?.rootFen === base.rootFen ? saved : base;
    setTree(selectedTree);
    setNodeId('m0');
    setAnalysis({ key: '', lines: [] });
    setEvaluation(undefined);
    const latest = latestReviews.current.get(g.id) ?? stored;
    const restored =
      latest?.version === REVIEW_VERSION ? upgradeReview(selectedTree, latest) : null;
    setReview(restored);
    if (restored?.complete) statisticsCache.current.updateReview(g.id, restored);
    setReviewTime(restored?.complete ? restored.options.movetime : config.reviewTime);
    if (restored && restored !== latest)
      void repository.put('reviews', g.id, restored).catch(reportError);
    setOrientation(playerColor(g, config.username));
    setCategoryLibrary(null);
    setModal(null);
    setTab('review');
    setError('');
    await repository.put('settings', 'lastGame', g.id);
  }
  async function syncGames(config = settings) {
    if (syncing) return;
    if (!config.username) {
      setUsername('');
      setModal('connect');
      return;
    }
    setSyncing(true);
    setError('');
    const accountChanged =
      config.username.trim().toLowerCase() !== settings.username.trim().toLowerCase();
    try {
      const downloaded = await downloadGames(config.username);
      for (const g of downloaded) await repository.put('games', g.id, g);
      const all = await repository.list<Game>('games');
      await autoReview.scan();
      updateGames(all.sort((a, b) => b.date - a.date));
      setModal((current) => (current === 'connect' ? 'library' : current));
      if ((!selectedGameId.current || accountChanged) && !freeMode && downloaded[0])
        await selectGame(downloaded[0], config);
    } catch (e) {
      reportError(e);
    } finally {
      setSyncing(false);
    }
  }
  async function openActivityGame(id: string) {
    const selected =
      games.find((game) => game.id === id) ?? (await repository.get<Game>('games', id));
    if (!selected) throw Error('No se encuentra esta partida en tu biblioteca.');
    await selectGame(selected);
    setGames((previous) =>
      previous.some((game) => game.id === id)
        ? previous
        : [...previous, selected].sort((a, b) => b.date - a.date),
    );
  }
  function chooseNewAccount() {
    setSettings((previous) => ({ ...previous, username: '', profileImage: undefined }));
    setUsername('');
    setGames([]);
    rememberedGame.current = undefined;
    setAccountConfirmed(true);
    setModal('connect');
  }
  async function continueAccount() {
    if (accountBusy) return;
    setAccountBusy(true);
    setAccountConfirmed(true);
    try {
      const selected = rememberedGame.current;
      rememberedGame.current = undefined;
      setModal(null);
      if (selected) await selectGame(selected, settings);
      await syncGames(settings);
    } catch (error) {
      reportError(error);
    } finally {
      setAccountBusy(false);
    }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const [saved, all, st, last, savedFree, fourLineDefault, fiveLineDefault] =
          await Promise.all([
            repository.get<Settings>('settings', 'preferences'),
            repository.list<Game>('games'),
            engine.status(),
            repository.get<string>('settings', 'lastGame'),
            repository.get<BoardSession>('settings', 'freeBoard'),
            repository.get<boolean>('settings', 'fourLineDefault'),
            repository.get<boolean>('settings', 'fiveLineDefault'),
          ]);
        if (savedFree?.tree?.nodes.some((n) => n.id === savedFree.nodeId))
          freeSession.current = savedFree;
        const config = { ...defaultSettings, ...saved };
        // Remove the obsolete preference when saving settings from older builds.
        Reflect.deleteProperty(config, 'theme');
        if (!fourLineDefault) {
          if (config.multiPv === 3) config.multiPv = 4;
          await repository.put('settings', 'fourLineDefault', true);
        }
        if (!fiveLineDefault) {
          if (config.multiPv === 4) config.multiPv = 5;
          // Persist the migration before its marker, preserving custom limits.
          await repository.put('settings', 'preferences', config);
          await repository.put('settings', 'fiveLineDefault', true);
        }
        setSettings(config);
        setReviewTime(config.reviewTime);
        setUsername(config.username);
        setStatus(st);
        setGames(all.sort((a, b) => b.date - a.date));
        const ownGames = accountGames(all, config.username);
        const selected = ownGames.find((g) => g.id === last) ?? ownGames[0];
        if (config.username.trim()) {
          rememberedGame.current = selected;
          setUsername('');
          setModal('account-choice');
        } else {
          setAccountConfirmed(true);
          if (selected) await selectGame(selected, config);
          if (!all.length) setModal('connect');
        }
        setReady(true);
      } catch (e) {
        reportError(e);
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready || !accountConfirmed) return;
    const scope = libraryGames.filter(
      (g) => isStatisticsGame(g) && statisticsColor(g, settings.username, 'w'),
    );
    const timer = setTimeout(() => {
      void statisticsCache.current.load(scope).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, accountConfirmed, libraryGames, settings.username, reviewRevision]);
  useEffect(() => {
    if (!ready || !accountConfirmed) return;
    const timer = setTimeout(
      () => repository.put('settings', 'preferences', settings).catch(reportError),
      300,
    );
    return () => clearTimeout(timer);
  }, [settings, ready, accountConfirmed]);
  useEffect(() => {
    if (!ready || view === 'statistics') return;
    if (storedAnalysis) {
      setAnalysis({ key: positionKey, lines: storedAnalysis.lines });
      setEvaluation(storedAnalysis.lines[0]);
      setEngineBusy(false);
      completedPositions.current.set(positionKey, storedAnalysis.lines);
      return;
    }
    if (!status?.available) return;
    let active = true;
    setAnalysis({ key: positionKey, lines: [] });
    setEngineBusy(true);
    void engine.cancel().catch(reportError);
    const timer = setTimeout(async () => {
      if (!active) return;
      setEngineBusy(true);
      const parent = tree.nodes.find((n) => n.id === node.parent);
      const parentKey = parent ? `${positionScope}:${parent.id}:${parent.fen}` : '';
      let before =
        completedPositions.current.get(parentKey) ??
        (parent?.main ? review?.positions[parent.id]?.lines : undefined);
      const commitRating = (updates: EngineLine[]) => {
        const previousNode = tree.nodes.find((n) => n.id === parent?.parent);
        const previousLines =
          previousNode &&
          (completedPositions.current.get(
            `${positionScope}:${previousNode.id}:${previousNode.fen}`,
          ) ??
            (previousNode.main ? review?.positions[previousNode.id]?.lines : undefined));
        if (parent && before?.[0] && updates[0])
          setMoveRatings((previous) => ({
            ...previous,
            [positionKey]: withBookMove(
              parent,
              node,
              classify(
                parent,
                node,
                before!,
                updates[0],
                undefined,
                previousNode && previousLines
                  ? { node: previousNode, lines: previousLines }
                  : undefined,
              ),
            )!,
          }));
      };
      try {
        // A manual move needs both positions to earn a rating. Never invent one
        // from the notation or from an unfinished, unrelated search.
        if (
          parent &&
          !before?.length &&
          !review?.moves.some((m) => node.main && m.ply === node.ply)
        ) {
          const baseline = await engine.analyzePosition(
            tree,
            parent.id,
            { ...options, movetime: Math.min(options.movetime || 1000, 1000) },
            'interactive',
          );
          if (!active) return;
          before = baseline.lines;
          completedPositions.current.set(parentKey, before);
        }
        const result = await engine.analyzePosition(
          tree,
          node.id,
          options,
          'interactive',
          (updates) => {
            if (active) {
              setAnalysis({ key: positionKey, lines: updates });
              // Finite searches commit the bar only when finished. Infinite analysis
              // can keep improving it after a useful depth has been reached.
              if (!options.movetime && updates[0]?.depth >= 12) {
                setEvaluation(updates[0]);
                commitRating(updates);
                completedPositions.current.set(positionKey, updates);
              }
            }
          },
        );
        if (active) {
          setAnalysis({ key: positionKey, lines: result.lines });
          if (result.lines[0]) setEvaluation(result.lines[0]);
          completedPositions.current.set(positionKey, result.lines);
          commitRating(result.lines);
        }
      } catch (e) {
        if (active) reportError(e);
      } finally {
        if (active) setEngineBusy(false);
      }
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
      void engine.cancel().catch(() => {});
    };
  }, [
    game?.id,
    node.id,
    node.fen,
    tree.rootFen,
    options,
    ready,
    status?.available,
    view,
    storedAnalysis,
  ]);
  useEffect(() => {
    if (!freeMode || !ready) return;
    const snapshot = { tree, nodeId, review: null, orientation, tip: freeTip };
    freeSession.current = snapshot;
    const timer = setTimeout(
      () => repository.put('settings', 'freeBoard', snapshot).catch(reportError),
      300,
    );
    return () => clearTimeout(timer);
  }, [freeMode, ready, tree, nodeId, orientation, freeTip]);
  function restoreSession(snapshot: BoardSession) {
    setGame(snapshot.game);
    selectedGameId.current = snapshot.game?.id;
    setTree(snapshot.tree);
    setNodeId(snapshot.nodeId);
    setReview(snapshot.review);
    if (snapshot.review?.complete) setReviewTime(snapshot.review.options.movetime);
    setOrientation(snapshot.orientation);
    setFreeTip(snapshot.tip ?? snapshot.nodeId);
    setAnalysis({ key: '', lines: [] });
    setEvaluation(undefined);
    setTour(null);
    setModal(null);
  }
  async function openBoard(mode: 'analysis' | 'free') {
    if ((mode === 'free') === freeMode) {
      setView(mode);
      setModal(null);
      return;
    }
    const token = ++loadToken.current;
    await engine.cancel();
    if (token !== loadToken.current) return;
    if (mode === 'free' && !freeMode) {
      analysisSession.current = { game, tree, nodeId, review, orientation };
      restoreSession(freeSession.current);
      setTab('moves');
    } else if (mode === 'analysis' && freeMode) {
      freeSession.current = { tree, nodeId, review: null, orientation, tip: freeTip };
      await repository.put('settings', 'freeBoard', freeSession.current);
      if (token !== loadToken.current) return;
      restoreSession(
        analysisSession.current ?? {
          tree: emptyTree,
          nodeId: 'm0',
          review: null,
          orientation: 'w',
        },
      );
      setTab('review');
    }
    setModal(null);
    setFreeMode(mode === 'free');
    setView(mode);
  }
  function browseCategory(category: Category, color?: 'w' | 'b') {
    if (!review) return;
    const next = cycleCategory(review.moves, category, node.id, tour, color);
    if (next) {
      setTour(next);
      go(next.target, true);
    } else if (tour) {
      go(tour.origin);
      setTour(null);
    }
  }
  const activeReturn = returnContext(tree, node, tour, freeMode);
  const selectedTour = tour?.paused ? null : tour;
  function returnToOrigin() {
    if (!activeReturn) return;
    go(activeReturn.target.id);
    if (activeReturn.kind === 'category') setTour(null);
  }
  function go(id: string, categoryNavigation = false) {
    if (!categoryNavigation) setTour((current) => pauseCategoryTour(current, id));
    if (settings.sounds && id !== node.id) {
      const target = tree.nodes.find((n) => n.id === id);
      const parent = tree.nodes.find((n) => n.id === target?.parent);
      void playChessSound(
        target && parent && id !== node.parent ? soundForMove(parent, target) : 'move',
        settings.soundVolume,
        settings.customSounds,
      );
    }
    if (freeMode) setFreeTip(freeLine(tree, id, freeTip).at(-1)?.id ?? 'm0');
    setNodeId(id);
    setError('');
  }
  function navigate(direction: NavigationDirection) {
    const target = navigation[direction];
    if (target) go(target);
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        modal ||
        document.querySelector(
          '#notification-panel:popover-open, .move-explanation-popover:popover-open',
        ) ||
        view === 'statistics' ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Escape'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape') returnToOrigin();
        else navigate(e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : 'first');
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  function manualMove(from: string, to: string, promotion?: string) {
    try {
      if (currentLines.length) completedPositions.current.set(positionKey, currentLines);
      const result = addMove(tree, node.id, from, to, promotion);
      setPreview(null);
      if (settings.sounds)
        void playChessSound(
          soundForMove(node, result.node),
          settings.soundVolume,
          settings.customSounds,
        );
      setTree(result.tree);
      setNodeId(result.node.id);
      if (freeMode) {
        setFreeUndo(null);
        setFreeTip(
          freeLine(result.tree, result.node.id, result.node.id).at(-1)?.id ?? result.node.id,
        );
      }
      if (!result.node.main && !freeMode) setTab('moves');
      if (game) repository.put('variants', game.id, result.tree).catch(reportError);
    } catch (e) {
      reportError(e);
    }
  }
  async function doImport(text: string) {
    setImporting(true);
    setError('');
    try {
      const parts = text
        .trim()
        .split(/(?=\[Event\s+")/)
        .filter((s) => s.trim());
      const imported: Game[] = [];
      for (const part of parts) {
        const g = await importPgn(part);
        imported.push(g);
      }
      if (!imported.length) throw Error('Pega un PGN o selecciona un archivo .pgn.');
      for (const g of imported) await repository.put('games', g.id, g);
      setGames((await repository.list<Game>('games')).sort((a, b) => b.date - a.date));
      await selectGame(imported[0]);
      setPgn('');
    } catch (e) {
      reportError(e);
    } finally {
      setImporting(false);
    }
  }
  async function readFile(file: File) {
    if (file.size > 20_000_000) {
      setError('El archivo supera los 20 MB. Divide el PGN en archivos más pequeños.');
      return;
    }
    try {
      await doImport(await file.text());
    } catch (error) {
      reportError(error);
    }
  }
  const reviewMatchesSelection = reviewMatchesOptions(
    review,
    { ...options, movetime: reviewTime },
    status?.engineId,
  );
  function analyzeGame() {
    if (!game || reviewJobs[game.id] || reviewMatchesSelection) return;
    setError('');
    setTab('review');
    autoReview.analyze(game, tree, { ...options, movetime: reviewTime });
  }
  const engineRating =
    (node.main ? review?.moves.find((m) => m.ply === node.ply) : null) ?? moveRatings[positionKey];
  const parentNode = tree.nodes.find((n) => n.id === node.parent);
  const currentReview = parentNode ? withBookMove(parentNode, node, engineRating) : engineRating;
  const currentLines = distinctLines(
    storedAnalysis?.lines ?? (analysis.key === positionKey ? analysis.lines : []),
  );
  const material = useMemo(() => positionMaterial(tree, node.id), [tree, node.id]);
  const displayedEvaluation = storedAnalysis?.lines[0] ?? evaluation;
  const ownColor =
    game && settings.username.trim()
      ? game.white.toLowerCase() === settings.username.trim().toLowerCase()
        ? 'w'
        : game.black.toLowerCase() === settings.username.trim().toLowerCase()
          ? 'b'
          : undefined
      : undefined;
  const topColor = orientation === 'w' ? 'b' : 'w',
    bottomColor = orientation;
  function resetFreeBoard() {
    // Resetting an already empty board preserves the last useful undo snapshot.
    if (tree.nodes.length === 1 && tree.rootFen === emptyTree.rootFen) return;
    setFreeUndo({ tree, nodeId, review: null, orientation, tip: freeTip });
    restoreSession({ tree: makeTree('*'), nodeId: 'm0', review: null, orientation, tip: 'm0' });
    setPreview(null);
    setError('');
    setTab('moves');
  }
  function player(color: 'w' | 'b') {
    return (
      <div className="player">
        <span className={`avatar ${color}`} aria-hidden="true">
          <img src={`/pieces/player/${color}k.svg`} alt="" />
        </span>
        <div className="player-identity">
          <strong>
            {game
              ? color === 'w'
                ? game.white
                : game.black
              : color === 'w'
                ? 'Blancas'
                : 'Negras'}
          </strong>
          <span>
            {game ? (color === 'w' ? game.whiteElo : game.blackElo) || 'Sin Elo' : ''}
            {game &&
            playerColor(game, settings.username) === color &&
            [game.white.toLowerCase(), game.black.toLowerCase()].includes(
              settings.username.toLowerCase(),
            )
              ? '  Tú'
              : ''}
          </span>
        </div>
        <CapturedPieces color={color} material={material} />
        <div className={`player-side ${turn === color ? 'to-move' : ''}`}>
          <span>{color === 'w' ? 'Blancas' : 'Negras'}</span>
          <span className="turn-label">Turno</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void readFile(f);
      }}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Vienna">
            <BrandMark />
            <span>Vienna</span>
          </a>
          <NotificationCenter
            items={autoReview.notifications}
            queued={Object.values(reviewJobs).filter((job) => job.state === 'queued').length}
            modal={modal}
            onView={(id) => {
              autoReview.viewGame(id);
              void openActivityGame(id).catch(reportError);
            }}
            onReport={(detail) => {
              setSettingsReport(detail);
              setModal('settings');
            }}
            onDismiss={autoReview.dismiss}
            paused={autoReview.paused}
            onPause={autoReview.pause}
            onResume={autoReview.resume}
            stopping={autoReview.stopping}
            onStopAll={() => void autoReview.stopAll().catch(reportError)}
          />
        </div>
        <nav>
          <button
            className={modal === 'library' ? 'active' : ''}
            onClick={() => {
              setCategoryLibrary(null);
              setModal('library');
            }}
          >
            <Icon name="grid" />
            Mis partidas<span className="nav-count">{libraryGames.length}</span>
          </button>
          <button
            className={modal !== 'library' && view === 'analysis' ? 'active' : ''}
            onClick={() => openBoard('analysis').catch(reportError)}
          >
            <Icon name="board" />
            Análisis
          </button>
          <button
            className={modal !== 'library' && view === 'free' ? 'active' : ''}
            onClick={() => openBoard('free').catch(reportError)}
          >
            <Icon name="branch" />
            Modo libre
          </button>
          <button
            className={modal !== 'library' && view === 'statistics' ? 'active' : ''}
            onClick={() => {
              setModal(null);
              setView('statistics');
            }}
          >
            <Icon name="chart" />
            Estadísticas
          </button>
        </nav>
        <div className="sidebar-collection">
          {game && !freeMode && (
            <section className="sidebar-current-game" aria-label="Partida en análisis">
              <div className="recent-heading-row">
                <span className="recent-heading">Analizando</span>
              </div>
              <RecentGame
                game={game}
                username={settings.username}
                now={recentNow}
                reviewed={reviewIndex.reviewed.has(game.id) || !!review?.complete}
                seen={seenGames.ids.has(game.id)}
                job={reviewJobs[game.id]}
                selected={false}
                onSelect={() => openBoard('analysis').catch(reportError)}
              />
            </section>
          )}
          <div className="recent-heading-row">
            <span className="recent-heading">Últimas 5 partidas</span>
            <button
              className={`recent-refresh ${syncing ? 'syncing' : ''}`}
              onClick={() => void syncGames()}
              disabled={syncing}
              aria-label={syncing ? 'Actualizando partidas' : 'Actualizar últimas partidas'}
              aria-busy={syncing}
              title="Actualizar últimas partidas"
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
          {recentGames.map((g) => (
            <RecentGame
              key={g.id}
              game={g}
              username={settings.username}
              now={recentNow}
              reviewed={reviewIndex.reviewed.has(g.id)}
              seen={seenGames.ids.has(g.id)}
              job={reviewJobs[g.id]}
              selected={game?.id === g.id && !freeMode}
              onSelect={() => selectGame(g).catch(reportError)}
            />
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            className={`profile ${settings.username ? 'connected' : ''}`}
            title={
              settings.username
                ? `Tu cuenta de Chess.com: ${settings.username}`
                : 'Conectar Chess.com'
            }
            aria-label={
              settings.username
                ? `Tu cuenta de Chess.com: ${settings.username}`
                : 'Conectar Chess.com'
            }
            onClick={() => {
              setUsername(settings.username);
              setModal(settings.username ? 'profile' : 'connect');
            }}
          >
            {settings.username ? (
              <>
                <span className="profile-avatar">
                  {settings.profileImage ? (
                    <img src={settings.profileImage} alt="" />
                  ) : (
                    profileInitials(settings.username)
                  )}
                </span>
                <span className="profile-identity">
                  <strong>{settings.username}</strong>
                </span>
              </>
            ) : (
              <>
                <Icon name="board" />
                <span>Conectar Chess.com</span>
              </>
            )}
          </button>
          <button
            className="profile-settings icon-button"
            aria-label="Ajustes"
            title="Ajustes"
            onClick={() => {
              setSettingsReport(undefined);
              setModal('settings');
            }}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>
      <main>
        {view === 'statistics' ? (
          <Statistics
            games={libraryGames}
            username={settings.username}
            revision={reviewRevision}
            cache={statisticsCache.current}
            onError={reportError}
            onCategoryGames={(category, matches) => {
              setCategoryLibrary({
                category,
                counts: Object.fromEntries(matches.map(({ game, count }) => [game.id, count])),
              });
              setModal('library');
            }}
          />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <h1>
                  {game ? (
                    <>
                      {game.white} <span className="versus">vs</span> {game.black}
                    </>
                  ) : freeMode ? (
                    'Modo libre'
                  ) : (
                    'Análisis'
                  )}
                </h1>
                <p className="game-metadata">
                  {game ? (
                    <>
                      <span>{timeControl(game.timeControl)}</span>
                      <span>
                        {new Date(game.date).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </>
                  ) : freeMode ? (
                    'Explora aperturas, gambitos y variantes.'
                  ) : (
                    'Elige una partida en Mis partidas.'
                  )}
                </p>
              </div>
            </div>
            <div className="workspace">
              <section className="board-column">
                <div className="board-player">{player(topColor)}</div>
                <div className={`board-with-eval ${!settings.evaluation ? 'no-eval' : ''}`}>
                  {settings.evaluation && (
                    <EvaluationBar
                      evaluation={displayedEvaluation}
                      orientation={orientation}
                      ownColor={ownColor}
                      busy={engineBusy}
                    />
                  )}
                  <div className="board-area">
                    <Board
                      category={currentReview?.category}
                      node={node}
                      orientation={orientation}
                      lines={currentLines}
                      arrows={settings.arrows}
                      secondArrow={settings.secondArrow}
                      previewMove={
                        preview?.key === positionKey
                          ? preview.rank === 0
                            ? preview.move
                            : currentLines.find((line) => line.rank === preview.rank)?.pv[0]
                          : undefined
                      }
                      onMove={manualMove}
                    />
                  </div>
                </div>
                <div className="board-player bottom-player">{player(bottomColor)}</div>
                <div className="board-toolbar">
                  <div className="board-tools">
                    <button
                      className="icon-button"
                      title="Girar tablero"
                      aria-label="Girar tablero"
                      onClick={() => setOrientation(orientation === 'w' ? 'b' : 'w')}
                    >
                      <Icon name="flip" size={18} />
                    </button>
                    <button
                      className={`icon-button engine-arrow-toggle best-arrow ${settings.arrows ? 'enabled' : ''}`}
                      title="Flecha de la mejor jugada"
                      aria-label="Flecha de la mejor jugada"
                      aria-pressed={settings.arrows}
                      onClick={() => setSettings({ ...settings, arrows: !settings.arrows })}
                    >
                      <Icon name="arrow" size={18} />
                      <span aria-hidden="true">1</span>
                    </button>
                    <button
                      className={`icon-button engine-arrow-toggle second-arrow ${settings.secondArrow ? 'enabled' : ''}`}
                      title="Flecha de la segunda mejor jugada"
                      aria-label="Flecha de la segunda mejor jugada"
                      aria-pressed={settings.secondArrow}
                      onClick={() =>
                        setSettings({ ...settings, secondArrow: !settings.secondArrow })
                      }
                    >
                      <Icon name="arrow" size={16} />
                      <span aria-hidden="true">2</span>
                    </button>
                  </div>
                  <div className="navigation">
                    {(['first', 'prev', 'next', 'last'] as const).map((dir, i) => (
                      <button
                        key={dir}
                        className="icon-button"
                        aria-label={
                          [
                            'Ir al inicio',
                            'Movimiento anterior',
                            'Movimiento siguiente',
                            'Ir al final',
                          ][i]
                        }
                        title={['Inicio (↑)', 'Anterior (←)', 'Siguiente (→)', 'Final'][i]}
                        disabled={!navigation[dir]}
                        onClick={() => navigate(dir)}
                      >
                        <Icon name={['first', 'left', 'right', 'last'][i]} />
                      </button>
                    ))}
                    {!freeMode && (
                      <ReturnControl context={activeReturn} onReturn={returnToOrigin} />
                    )}
                  </div>
                  <div className="board-status-actions">
                    {freeMode ? (
                      <>
                        <button
                          className="icon-button"
                          aria-label="Reiniciar tablero"
                          title="Reiniciar tablero"
                          onClick={resetFreeBoard}
                        >
                          <Icon name="refresh" size={18} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Deshacer reinicio"
                          title="Deshacer reinicio"
                          disabled={
                            !freeUndo ||
                            tree.nodes.length !== 1 ||
                            tree.rootFen !== emptyTree.rootFen
                          }
                          onClick={() => {
                            if (freeUndo) {
                              restoreSession(freeUndo);
                              setPreview(null);
                              setFreeUndo(null);
                            }
                          }}
                        >
                          <Icon name="undo" size={18} />
                        </button>
                      </>
                    ) : (
                      game && (
                        <SeenControl
                          seen={seenGames.ids.has(game.id)}
                          analysed={reviewIndex.reviewed.has(game.id)}
                          loadingAnalyses={reviewIndex.loading}
                          disabled={seenGames.loading || seenGames.pending.has(game.id)}
                          onToggle={() => void seenGames.toggle(game.id)}
                        />
                      )
                    )}
                    <span className="ply-counter">
                      {node.ply}
                      <span> / {freeMode ? activeFreeLine.length : tree.mainIds.length - 1}</span>
                    </span>
                  </div>
                </div>

                <div className="board-hint">
                  <Icon name="target" size={14} />
                  <span>
                    Botón derecho: anotar <kbd>←</kbd> <kbd>→</kbd> Navegar
                  </span>
                </div>
              </section>
              <div className="analysis-panel analysis-column">
                {!freeMode && (
                  <section className="analysis-controls-panel" aria-labelledby="analysis-title">
                    <header className="analysis-card-header">
                      <h2 className="card-title" id="analysis-title">
                        Análisis
                      </h2>
                    </header>
                    <div className="review-controls">
                      <AnalysisLevelPicker
                        value={reviewTime}
                        onChange={setReviewTime}
                        times={[
                          settings.reviewTime,
                          ...(review?.complete ? [review.options.movetime] : []),
                        ]}
                      />
                      <button
                        className={`primary analyze-button ${selectedReviewJob ? 'cancel' : ''}`}
                        title={
                          selectedReviewJob && selectedReviewJob.state !== 'queued'
                            ? autoReview.paused
                              ? 'Continuar desde la posición pendiente'
                              : 'Pausar la cola al terminar la posición actual'
                            : undefined
                        }
                        disabled={
                          !game ||
                          !status?.available ||
                          selectedAutoJob?.state === 'queued' ||
                          (!!review?.complete && !selectedReviewJob)
                        }
                        onClick={() =>
                          selectedReviewJob && selectedReviewJob.state !== 'queued'
                            ? autoReview.paused
                              ? autoReview.resume()
                              : autoReview.pause()
                            : selectedManualJob && game
                              ? autoReview.cancel(game.id).catch(reportError)
                              : analyzeGame()
                        }
                      >
                        <Icon
                          name={
                            selectedReviewJob && selectedReviewJob.state !== 'queued'
                              ? autoReview.paused
                                ? 'play'
                                : 'pause'
                              : selectedAutoJob
                                ? 'clock'
                                : selectedManualJob
                                  ? 'stop'
                                  : review?.complete
                                    ? 'check'
                                    : 'play'
                          }
                          size={17}
                        />
                        {selectedReviewJob && selectedReviewJob.state !== 'queued' ? (
                          autoReview.paused ? (
                            'Reanudar análisis'
                          ) : (
                            'Pausar análisis'
                          )
                        ) : selectedAutoJob ? (
                          selectedAutoJob.state === 'queued' ? (
                            'En cola'
                          ) : (
                            'Analizando automáticamente'
                          )
                        ) : selectedManualJob ? (
                          selectedManualJob.state === 'queued' ? (
                            'Cancelar solicitud'
                          ) : (
                            'Cancelar análisis'
                          )
                        ) : review?.complete ? (
                          <span
                            className="analysed-label"
                            title={analysisLevelLabel(review.options.movetime)}
                          >
                            Analizada ({analysisLevelName(review.options.movetime)})
                          </span>
                        ) : (
                          'Analizar partida'
                        )}
                      </button>
                      {selectedManualJob && selectedManualJob.state !== 'queued' && game && (
                        <button
                          className="secondary pause-cancel"
                          onClick={() => autoReview.cancel(game.id).catch(reportError)}
                        >
                          <Icon name="stop" size={16} /> Cancelar
                        </button>
                      )}
                      {review?.complete && !selectedReviewJob && (
                        <button
                          className="secondary reanalyze"
                          onClick={analyzeGame}
                          disabled={!status?.available || !!reviewMatchesSelection}
                          title={
                            reviewMatchesSelection
                              ? 'Ya analizada con este nivel'
                              : review.options.movetime === reviewTime &&
                                  review.options.multiPv < options.multiPv
                                ? `Ampliar el análisis a ${options.multiPv} líneas`
                                : 'Volver a analizar con el nivel seleccionado'
                          }
                        >
                          <Icon name="refresh" size={18} /> Reanalizar partida
                        </button>
                      )}
                      {visibleProgress && (
                        <div className="progress-area" role="status">
                          <div>
                            <span>
                              {autoReview.paused ? 'En pausa' : 'Posición'} {visibleProgress.done}{' '}
                              de {visibleProgress.total}
                            </span>{' '}
                            <span>
                              {Math.round((visibleProgress.done / visibleProgress.total) * 100)}%
                            </span>
                          </div>
                          <progress
                            aria-label="Progreso del análisis"
                            max={visibleProgress.total}
                            value={visibleProgress.done}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                )}
                <section className="summary-panel" aria-labelledby="summary-title">
                  <header className="analysis-card-header">
                    <h2 className="card-title" id="summary-title">
                      {freeMode ? 'Análisis' : 'Resumen'}
                    </h2>
                    <MoveExplanation node={node} before={parentNode} move={currentReview} />
                  </header>
                  <div className="panel-tabs" role="tablist" aria-label="Panel de análisis">
                    {(
                      [
                        ['review', 'Revisión'],
                        ['moves', 'Movimientos'],
                      ] as const
                    )
                      .filter(([id]) => !freeMode || id !== 'review')
                      .map(([id, label]) => (
                        <button
                          role="tab"
                          aria-selected={tab === id}
                          className={tab === id ? 'selected' : ''}
                          key={id}
                          onClick={() => setTab(id)}
                        >
                          {label}
                        </button>
                      ))}
                  </div>
                  <div
                    className={`tab-body ${tab === 'review' ? 'review-tab' : ''}`}
                    role="tabpanel"
                  >
                    {tab === 'moves' && (
                      <>
                        {!freeMode && (
                          <div className="opening-label">
                            <Icon name="book" size={16} />
                            <span>
                              {game
                                ? tree.rootFen === emptyTree.rootFen
                                  ? 'Partida principal'
                                  : 'Posición personalizada'
                                : 'Posición inicial'}
                            </span>
                            <span>{game?.result || '—'}</span>
                          </div>
                        )}
                        <MoveList
                          tree={tree}
                          nodeId={nodeId}
                          review={review}
                          onSelect={go}
                          onImport={() => setModal('import')}
                          line={freeMode ? activeFreeLine : undefined}
                          ratings={moveListRatings}
                        />
                      </>
                    )}
                    {tab === 'review' &&
                      (review?.complete && !selectedReviewJob ? (
                        <ReviewSummary
                          onCategory={browseCategory}
                          activeCategory={selectedTour?.category}
                          activeColor={selectedTour?.color}
                          categoryProgress={
                            selectedTour
                              ? { index: selectedTour.index, total: selectedTour.total }
                              : undefined
                          }
                          review={review}
                          game={game!}
                        />
                      ) : (
                        <div className="empty-moves">
                          <Icon name="chart" size={34} />
                          <p>
                            {selectedReviewJob || review ? 'Resumen pendiente' : 'Sin revisión'}
                          </p>
                          <span>
                            {selectedReviewJob || review
                              ? 'La precisión y las categorías aparecerán al terminar el análisis.'
                              : 'Pulsa «Analizar partida» para ver la precisión y las categorías.'}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
              <div className={`analysis-side ${freeMode ? 'free-analysis' : ''}`}>
                {!freeMode && (
                  <section className="evaluation-panel" aria-label="Evaluación">
                    <header>
                      <h2 className="card-title">Evaluación</h2>
                    </header>
                    <div className="evaluation-body">
                      <EvalGraph
                        showTitle={false}
                        game={game}
                        username={settings.username}
                        review={review}
                        total={tree.mainIds.length}
                        ply={mainOrigin(tree, node)?.ply ?? 0}
                        onSelect={(ply) => go(`m${ply}`)}
                      />
                    </div>
                  </section>
                )}
                <Continuations
                  tree={tree}
                  node={node}
                  review={review}
                  lines={currentLines}
                  busy={engineBusy}
                  freeMode={freeMode}
                  onMove={manualMove}
                  onSelect={go}
                  onPreview={(line) =>
                    setPreview(
                      line ? { key: positionKey, rank: line.rank, move: line.pv[0] } : null,
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </main>
      <input
        type="file"
        ref={fileInput}
        hidden
        accept=".pgn,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFile(file);
          e.target.value = '';
        }}
      />
      {modal === 'import' && (
        <Modal title="Importar una partida" onClose={() => setModal(null)}>
          <p className="modal-description">
            Pega tu PGN, abre un archivo o arrástralo a cualquier parte de Vienna.
          </p>
          <textarea
            aria-label="PGN de la partida"
            placeholder={
              '[Event "Mi partida"]\n[White "Blancas"]\n[Black "Negras"]\n\n1. e4 e5 2. Nf3 Nc6 *'
            }
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            rows={10}
          />

          <div className="modal-actions">
            <button className="secondary" onClick={() => fileInput.current?.click()}>
              <Icon name="folder" />
              Abrir archivo .pgn
            </button>
            <button
              className="primary"
              disabled={!pgn.trim() || importing}
              onClick={() => doImport(pgn)}
            >
              {importing ? 'Importando…' : 'Cargar PGN'}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'profile' && (
        <Modal title="Perfil" className="profile-modal" onClose={() => setModal(null)}>
          <ProfilePanel
            username={settings.username}
            image={settings.profileImage}
            onImage={async (profileImage) => {
              const config = { ...settings, profileImage };
              await repository.put('settings', 'preferences', config);
              setSettings(config);
            }}
            onAccount={() => {
              setUsername(settings.username);
              setModal('connect');
            }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === 'account-choice' && (
        <Modal title="Cuenta guardada" dismissOnBackdrop={false} onClose={chooseNewAccount}>
          <AccountChoice
            username={settings.username}
            busy={accountBusy}
            onContinue={() => void continueAccount()}
            onNew={chooseNewAccount}
          />
        </Modal>
      )}
      {modal === 'connect' && (
        <Modal title="Conectar Chess.com" onClose={() => setModal(null)}>
          <div className="connect-emblem">
            <Icon name="board" size={40} />
          </div>
          <p className="modal-description">
            Introduce tu usuario para descargar tus partidas públicas. No necesitas contraseña.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const config = { ...settings, username: username.trim() };
              setAccountConfirmed(true);
              setSettings(config);
              await repository.put('settings', 'preferences', config);
              await syncGames(config);
            }}
          >
            <label>
              Nombre de usuario de Chess.com
              <input
                autoComplete="off"
                placeholder="Tu nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="[A-Za-z0-9_-]+"
                maxLength={50}
              />
            </label>

            <button className="primary full-width" type="submit" disabled={syncing}>
              {syncing ? 'Descargando partidas…' : 'Conectar mis partidas'}
              <Icon name="right" size={18} />
            </button>
          </form>
          <button className="text-button full-width" onClick={() => setModal('import')}>
            Prefiero importar un PGN
          </button>
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal
          title="Ajustes"
          className="settings-modal"
          onClose={() => setModal(null)}
          dismissOnBackdrop={!feedbackAction}
        >
          <SettingsPanel
            initialReport={settingsReport}
            onFeedbackAction={setFeedbackAction}
            settings={settings}
            cpus={status?.cpus ?? 4}
            protectedIds={[...Object.keys(reviewJobs), ...seenGames.pending]}
            onStorageCleaned={async (ids, cache) => {
              for (const id of ids) latestReviews.current.delete(id);
              seenGames.forget(ids);
              if (analysisSession.current?.game && ids.includes(analysisSession.current.game.id))
                analysisSession.current.review = null;
              if (freeUndo?.game && ids.includes(freeUndo.game.id))
                setFreeUndo({ ...freeUndo, review: null });
              if (!freeMode && game && ids.includes(game.id)) {
                setReview(null);
                setTour(null);
                setMoveRatings({});
                setReviewTime(settings.reviewTime);
              }
              if (cache || ids.length) completedPositions.current.clear();
              if (ids.length) statisticsCache.current.invalidate();
              setCategoryLibrary(null);
              setReviewRevision((n) => n + 1);
            }}
            onChange={(s) => {
              setSettings(s);
              if (!review?.complete) setReviewTime(s.reviewTime);
            }}
          />
          <SettingsActions
            feedbackAction={feedbackAction}
            onClose={() => setModal(null)}
            onError={reportError}
          />
        </Modal>
      )}
      {modal === 'library' && (
        <Modal
          title="Tu biblioteca"
          wide
          onClose={() => {
            setCategoryLibrary(null);
            setModal(null);
          }}
        >
          <GameLibrary
            games={libraryGames}
            now={recentNow}
            username={settings.username}
            selected={game?.id}
            onSelect={(g) => {
              selectGame(g).catch(reportError);
            }}
            onImport={() => {
              setCategoryLibrary(null);
              setModal('import');
            }}
            onSync={() => syncGames()}
            syncing={syncing}
            reviewed={reviewIndex.reviewed}
            seen={seenGames.ids}
            loadingSeen={seenGames.loading}
            pendingSeen={seenGames.pending}
            onToggleSeen={(id) => void seenGames.toggle(id)}
            loadingReviews={reviewIndex.loading}
            jobs={reviewJobs}
            categoryFilter={categoryLibrary ?? undefined}
            onClearCategory={() => setCategoryLibrary(null)}
          />
        </Modal>
      )}
    </div>
  );
}
