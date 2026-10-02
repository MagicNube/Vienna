import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Continuations } from './components/Continuations';
import { Board } from './components/Board';
import { Icon } from './components/Icon';
import { EvalGraph } from './components/EvalGraph';
import { Modal } from './components/Modal';
import { SettingsPanel } from './components/SettingsPanel';
import { GameLibrary, timeControl } from './components/GameLibrary';
import { ReviewSummary } from './components/ReviewSummary';
import { SummaryFooter } from './components/SummaryFooter';
import { ProfilePanel } from './components/ProfilePanel';
import { profileInitials } from './profile/image';
import { MoveList } from './components/MoveList';
import { RecentGame } from './components/RecentGame';
import { Statistics } from './components/Statistics';
import { BackgroundNotice } from './components/BackgroundNotice';
import { CapturedPieces } from './components/CapturedPieces';
import { ErrorNotice } from './components/ErrorNotice';
import { positionMaterial } from './chess/material';
import { distinctLines } from './engine/lines';
import { savedAnalysis } from './engine/savedAnalysis';
import { evaluationSide, evaluationDescription } from './engine/evaluation';
import { withBookMove } from './chess/openings';
import { playChessSound, soundForMove } from './audio/chessSounds';
import { cycleCategory, type CategoryTour } from './review/categoryTour';
import { freeLine } from './chess/freeBoard';
import { useAutoReview } from './review/useAutoReview';
import { useReviewIndex } from './review/useReviewIndex';
import { addMove, importPgn, makeTree, pathTo, playerColor } from './chess/game';
import { downloadGames } from './api/chesscom';
import { repository } from './database/repository';
import { engine, expected, score } from './engine/EngineService';
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
  returnId: string;
  review: Review | null;
  orientation: 'w' | 'b';
  tip?: string;
};
export function App() {
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
    returnId: 'm0',
    review: null,
    orientation: 'w',
  });
  const completedPositions = useRef(new Map<string, EngineLine[]>());
  const [settings, setSettings] = useState<Settings>(defaultSettings),
    [games, setGames] = useState<Game[]>([]),
    [game, setGame] = useState<Game>();
  const [tree, setTree] = useState<GameTree>(emptyTree),
    [nodeId, setNodeId] = useState('m0'),
    [returnId, setReturnId] = useState('m0');
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
    [modal, setModal] = useState<'import' | 'settings' | 'library' | 'connect' | 'profile' | null>(
      null,
    );
  const [ready, setReady] = useState(false),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState('');
  const [pgn, setPgn] = useState(''),
    [username, setUsername] = useState(''),
    [importing, setImporting] = useState(false);
  const [reviewTime, setReviewTime] = useState(500);
  const service = useRef(new GameReviewService()),
    loadToken = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    selectedGameId = useRef<string | undefined>(undefined),
    initialized = useRef(false);
  const reviewOwner = useRef<'manual' | 'auto' | null>(null);
  const node = tree.nodes.find((n) => n.id === nodeId) ?? tree.nodes[0];
  const storedAnalysis = savedAnalysis(node, review, freeMode);
  const activeFreeLine = freeLine(tree, node.id, freeTip);
  const positionScope = `${game?.id ?? 'free'}:${tree.rootFen}`;
  const positionKey = `${positionScope}:${node.id}:${node.fen}`;
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
  const autoOptions = useMemo(
    () => ({
      threads: options.threads,
      hash: options.hash,
      multiPv: options.multiPv,
      movetime: settings.autoReviewTime,
      depth: null,
    }),
    [options.threads, options.hash, options.multiPv, settings.autoReviewTime],
  );
  function updateGames(next: Game[]) {
    setGames((previous) =>
      previous.length === next.length &&
      previous.every((game, i) => game.id === next[i].id && game.pgn === next[i].pgn)
        ? previous
        : next,
    );
  }
  const autoReview = useAutoReview({
    enabled: ready && settings.autoReview && !!status?.available,
    username: settings.username,
    engineId: status?.engineId,
    options: autoOptions,
    service: service.current,
    owner: reviewOwner,
    onGames: updateGames,
    onReview: (id, result) => {
      if (result.complete) latestReviews.current.set(id, result);
      if (result.complete) setReviewRevision((n) => n + 1);
      if (selectedGameId.current === id) setReview(result);
      if (analysisSession.current?.game?.id === id) analysisSession.current.review = result;
    },
  });

  const reviewIndex = useReviewIndex(games, reviewRevision);
  const reviewJobs = autoReview.jobs;
  const selectedReviewJob = !freeMode && game ? reviewJobs[game.id] : undefined;
  const selectedManualJob = selectedReviewJob?.manual ? selectedReviewJob : undefined;
  const selectedAutoJob = selectedReviewJob?.manual ? undefined : selectedReviewJob;
  const visibleProgress =
    selectedReviewJob?.state === 'analysing'
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
      freeSession.current = { tree, nodeId, returnId, review: null, orientation, tip: freeTip };
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
    setReturnId('m0');
    setAnalysis({ key: '', lines: [] });
    setEvaluation(undefined);
    const latest = latestReviews.current.get(g.id) ?? stored;
    const restored =
      latest?.version === REVIEW_VERSION ? upgradeReview(selectedTree, latest) : null;
    setReview(restored);
    if (restored && restored !== latest)
      void repository.put('reviews', g.id, restored).catch(reportError);
    setOrientation(playerColor(g, config.username));
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
    try {
      const existing = await repository.list<Game>('games');
      const known = new Set(existing.map((game) => game.id));
      const downloaded = await downloadGames(config.username);
      for (const g of downloaded) await repository.put('games', g.id, g);
      const all = await repository.list<Game>('games');
      await autoReview.scan(
        existing.length ? downloaded.filter((game) => !known.has(game.id)) : [],
      );
      updateGames(all.sort((a, b) => b.date - a.date));
      setModal((current) => (current === 'connect' ? 'library' : current));
      if (!selectedGameId.current && !freeMode && downloaded[0])
        await selectGame(downloaded[0], config);
    } catch (e) {
      reportError(e);
    } finally {
      setSyncing(false);
    }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const [saved, all, st, last, savedFree, fourLineDefault] = await Promise.all([
          repository.get<Settings>('settings', 'preferences'),
          repository.list<Game>('games'),
          engine.status(),
          repository.get<string>('settings', 'lastGame'),
          repository.get<BoardSession>('settings', 'freeBoard'),
          repository.get<boolean>('settings', 'fourLineDefault'),
        ]);
        if (savedFree?.tree?.nodes.some((n) => n.id === savedFree.nodeId))
          freeSession.current = savedFree;
        const config = { ...defaultSettings, ...saved };
        if (!fourLineDefault) {
          if (config.multiPv === 3) config.multiPv = 4;
          await repository.put('settings', 'fourLineDefault', true);
        }
        setSettings(config);
        setReviewTime(config.reviewTime);
        setUsername(config.username);
        setStatus(st);
        setGames(all.sort((a, b) => b.date - a.date));
        const selected = all.find((g) => g.id === last) ?? all[0];
        if (selected) await selectGame(selected, config);
        setReady(true);
        if (config.username) void syncGames(config);
        else if (!all.length) setModal('connect');
      } catch (e) {
        reportError(e);
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    document.documentElement.classList.add('theme-switch');
    document.documentElement.dataset.theme = settings.theme;
    void document.documentElement.offsetHeight;
    const frame = requestAnimationFrame(() =>
      document.documentElement.classList.remove('theme-switch'),
    );
    return () => cancelAnimationFrame(frame);
  }, [settings.theme]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(
      () => repository.put('settings', 'preferences', settings).catch(reportError),
      300,
    );
    return () => clearTimeout(timer);
  }, [settings, ready]);
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
        if (parent && before?.[0] && updates[0])
          setMoveRatings((previous) => ({
            ...previous,
            [positionKey]: withBookMove(parent, node, classify(parent, node, before!, updates[0]))!,
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
    const snapshot = { tree, nodeId, returnId, review: null, orientation, tip: freeTip };
    freeSession.current = snapshot;
    const timer = setTimeout(
      () => repository.put('settings', 'freeBoard', snapshot).catch(reportError),
      300,
    );
    return () => clearTimeout(timer);
  }, [freeMode, ready, tree, nodeId, returnId, orientation, freeTip]);
  function restoreSession(snapshot: BoardSession) {
    setGame(snapshot.game);
    selectedGameId.current = snapshot.game?.id;
    setTree(snapshot.tree);
    setNodeId(snapshot.nodeId);
    setReturnId(snapshot.returnId);
    setReview(snapshot.review);
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
      analysisSession.current = { game, tree, nodeId, returnId, review, orientation };
      restoreSession(freeSession.current);
      setTab('moves');
    } else if (mode === 'analysis' && freeMode) {
      freeSession.current = { tree, nodeId, returnId, review: null, orientation, tip: freeTip };
      await repository.put('settings', 'freeBoard', freeSession.current);
      if (token !== loadToken.current) return;
      restoreSession(
        analysisSession.current ?? {
          tree: emptyTree,
          nodeId: 'm0',
          returnId: 'm0',
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
  function go(id: string, categoryNavigation = false) {
    if (!categoryNavigation && tour && id === tour.origin) setTour(null);
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
  function navigate(direction: 'first' | 'prev' | 'next' | 'last') {
    if (freeMode) {
      const ids = ['m0', ...activeFreeLine.map((n) => n.id)];
      const index = ids.indexOf(node.id);
      go(
        ids[
          direction === 'first'
            ? 0
            : direction === 'last'
              ? ids.length - 1
              : Math.max(0, Math.min(ids.length - 1, index + (direction === 'next' ? 1 : -1)))
        ],
      );
      return;
    }
    if (node.main) {
      const i = tree.mainIds.indexOf(node.id);
      go(
        tree.mainIds[
          direction === 'first'
            ? 0
            : direction === 'last'
              ? tree.mainIds.length - 1
              : Math.max(0, Math.min(tree.mainIds.length - 1, i + (direction === 'next' ? 1 : -1)))
        ],
      );
    } else {
      const path = pathTo(tree, node.id);
      if (direction === 'first') {
        const first = path.find((n) => !n.main);
        go(first?.parent ?? 'm0');
      } else if (direction === 'prev') go(node.parent ?? 'm0');
      else {
        let cursor = node;
        let next = tree.nodes.find((n) => n.parent === cursor.id && !n.main);
        while (next) {
          cursor = next;
          if (direction === 'next') break;
          next = tree.nodes.find((n) => n.parent === cursor.id && !n.main);
        }
        go(cursor.id);
      }
    }
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        modal ||
        view === 'statistics' ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Escape'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape' && tour) {
          go(tour.origin);
          setTour(null);
        } else if (e.key === 'Escape') go(returnId);
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
      if (node.main && !result.node.main) setReturnId(node.id);
      setTree(result.tree);
      setNodeId(result.node.id);
      if (freeMode)
        setFreeTip(
          freeLine(result.tree, result.node.id, result.node.id).at(-1)?.id ?? result.node.id,
        );
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
    await doImport(await file.text());
  }
  function analyzeGame() {
    if (!game || reviewJobs[game.id]) return;
    setError('');
    setTab('review');
    autoReview.analyze(game, tree, { ...options, movetime: reviewTime });
  }
  function queueGame(g: Game) {
    if (reviewJobs[g.id] || reviewIndex.reviewed.has(g.id) || !status?.available) return;
    autoReview.analyze(g, makeTree(g.pgn), autoOptions);
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
  const whitePercent = displayedEvaluation
    ? Math.max(3, Math.min(97, expected(displayedEvaluation, 'w') * 100))
    : 50;
  const topColor = orientation === 'w' ? 'b' : 'w',
    bottomColor = orientation;
  function resetFreeBoard(pgn: string) {
    setFreeUndo({ tree, nodeId, returnId, review: null, orientation, tip: freeTip });
    const next = makeTree(pgn);
    setTree(next);
    setNodeId(next.mainIds.at(-1)!);
    setFreeTip(next.mainIds.at(-1)!);
    setReturnId('m0');
    setTour(null);
    setReview(null);
    setTab('moves');
  }
  function player(color: 'w' | 'b') {
    return (
      <div className="player">
        <span className={`avatar ${color}`}>{color === 'w' ? '♔' : '♚'}</span>
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
        <div className={`player-side ${new Chess(node.fen).turn() === color ? 'to-move' : ''}`}>
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
        <a className="brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Vienna">
          <img className="brand-mark" src="/vienna.svg" alt="" />
          <span>Vienna</span>
        </a>
        <nav>
          <button
            className={modal === 'library' ? 'active' : ''}
            onClick={() => setModal('library')}
          >
            <Icon name="grid" />
            Mis partidas<span className="nav-count">{games.length}</span>
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
          {games.slice(0, 5).map((g) => (
            <RecentGame
              key={g.id}
              game={g}
              username={settings.username}
              now={recentNow}
              reviewed={reviewIndex.reviewed.has(g.id)}
              job={reviewJobs[g.id]}
              onAnalyze={() => queueGame(g)}
              canAnalyze={!!status?.available && !reviewIndex.loading}
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
            onClick={() => setModal('settings')}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>
      <main>
        {view === 'statistics' ? (
          <Statistics
            games={games}
            username={settings.username}
            revision={reviewRevision}
            onError={reportError}
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
              {freeMode && (
                <button
                  className="icon-button"
                  aria-label={freeUndo ? 'Deshacer nuevo tablero' : 'Nuevo tablero'}
                  title={freeUndo ? 'Deshacer nuevo tablero' : 'Nuevo tablero'}
                  onClick={() => {
                    if (freeUndo) {
                      restoreSession(freeUndo);
                      setFreeUndo(null);
                    } else resetFreeBoard('*');
                  }}
                >
                  <Icon name={freeUndo ? 'undo' : 'refresh'} size={18} />
                </button>
              )}
            </div>
            <div className="workspace">
              <section className="board-column">
                <div className="board-player">
                  {player(topColor)}
                  <span className="result-pill">
                    {game?.result === '*' ? 'En estudio' : game?.result || 'Tablero libre'}
                  </span>
                </div>
                <div className={`board-with-eval ${!settings.evaluation ? 'no-eval' : ''}`}>
                  {settings.evaluation && (
                    <div
                      className="evaluation-bar"
                      aria-label={`Evaluación desde blancas: ${score(displayedEvaluation)}. ${evaluationDescription(displayedEvaluation)}`}
                      title="+ favorece a blancas; − favorece a negras"
                      aria-busy={engineBusy}
                    >
                      <div className="white-eval" style={{ height: `${whitePercent}%` }} />
                      <span
                        className={
                          evaluationSide(displayedEvaluation) === 'w' ||
                          !evaluationSide(displayedEvaluation)
                            ? 'on-white'
                            : ''
                        }
                      >
                        {score(displayedEvaluation)}
                      </span>
                    </div>
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
                      className={`icon-button ${settings.arrows ? 'enabled' : ''}`}
                      title="Flechas del motor"
                      aria-label="Flechas del motor"
                      aria-pressed={settings.arrows}
                      onClick={() => setSettings({ ...settings, arrows: !settings.arrows })}
                    >
                      <Icon name="arrow" size={18} />
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
                        onClick={() => navigate(dir)}
                      >
                        <Icon name={['first', 'left', 'right', 'last'][i]} />
                      </button>
                    ))}
                    <button
                      className="icon-button board-return"
                      disabled={freeMode || node.main}
                      aria-label="Volver a la jugada"
                      title="Volver a la jugada de origen (Esc)"
                      onClick={() => go(returnId)}
                    >
                      <Icon name="undo" />
                    </button>
                  </div>
                  <span className="ply-counter">
                    {node.ply}
                    <span> / {freeMode ? activeFreeLine.length : tree.mainIds.length - 1}</span>
                  </span>
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
                      <div className="analysis-level">
                        <label htmlFor="analysis-level">Nivel</label>
                        <select
                          id="analysis-level"
                          aria-label="Nivel de análisis"
                          value={
                            [150, 500, 2000, 5000].includes(reviewTime) ? reviewTime : 'custom'
                          }
                          onChange={(e) =>
                            setReviewTime(
                              e.target.value === 'custom' ? settings.reviewTime : +e.target.value,
                            )
                          }
                        >
                          <option value="150">Rápido (150 ms)</option>
                          <option value="500">Normal (500 ms)</option>
                          <option value="2000">Profundo (2 s)</option>
                          <option value="5000">Máximo (5 s)</option>
                          {![150, 500, 2000, 5000].includes(settings.reviewTime) && (
                            <option value="custom">Personalizado ({settings.reviewTime} ms)</option>
                          )}
                        </select>
                      </div>
                      <button
                        className={`primary analyze-button ${selectedManualJob ? 'cancel' : ''}`}
                        disabled={
                          !game ||
                          !status?.available ||
                          !!selectedAutoJob ||
                          (!!review?.complete && !selectedManualJob)
                        }
                        onClick={() =>
                          selectedManualJob && game
                            ? autoReview.cancel(game.id).catch(reportError)
                            : analyzeGame()
                        }
                      >
                        <Icon
                          name={
                            selectedAutoJob
                              ? 'clock'
                              : selectedManualJob
                                ? 'stop'
                                : review?.complete
                                  ? 'check'
                                  : 'play'
                          }
                          size={17}
                        />
                        {selectedAutoJob
                          ? selectedAutoJob.state === 'queued'
                            ? 'En cola'
                            : 'Analizando automáticamente'
                          : selectedManualJob
                            ? selectedManualJob.state === 'queued'
                              ? 'Cancelar solicitud'
                              : 'Cancelar análisis'
                            : review?.complete
                              ? 'Partida analizada'
                              : 'Analizar partida'}
                      </button>
                      {review?.complete && !selectedReviewJob && (
                        <button
                          className="secondary reanalyze"
                          onClick={analyzeGame}
                          disabled={!status?.available}
                          title="Volver a analizar con el nivel seleccionado"
                        >
                          <Icon name="refresh" size={18} /> Reanalizar partida
                        </button>
                      )}
                      {visibleProgress && (
                        <div className="progress-area" role="status">
                          <div>
                            <span>
                              Posición {visibleProgress.done} de {visibleProgress.total}
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
                                ? new Chess(game.pgn ? tree.rootFen : undefined).fen() ===
                                  new Chess().fen()
                                  ? 'Partida principal'
                                  : 'Posición personalizada'
                                : freeMode
                                  ? 'Línea seleccionada'
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
                          ratings={Object.fromEntries(
                            tree.nodes.map((n) => {
                              const parent = tree.nodes.find((p) => p.id === n.parent);
                              const rating = moveRatings[`${positionScope}:${n.id}:${n.fen}`];
                              return [n.id, parent ? withBookMove(parent, n, rating) : rating];
                            }),
                          )}
                        />
                      </>
                    )}
                    {tab === 'review' &&
                      (review?.complete && !selectedReviewJob ? (
                        <ReviewSummary
                          onCategory={browseCategory}
                          activeCategory={tour?.category}
                          activeColor={tour?.color}
                          categoryProgress={
                            tour ? { index: tour.index, total: tour.total } : undefined
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
                  <SummaryFooter
                    tab={tab}
                    tour={tour}
                    node={node}
                    move={currentReview}
                    onReturn={() => {
                      if (tour) go(tour.origin);
                      setTour(null);
                    }}
                  />
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
                        ply={node.main ? node.ply : Number(returnId.slice(1)) || 0}
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
      <BackgroundNotice
        activity={autoReview.activity?.kind === 'error' ? null : autoReview.activity}
        modal={modal}
      />
      <ErrorNotice
        message={
          error ||
          (autoReview.activity?.kind === 'error'
            ? `${autoReview.activity.title}: ${autoReview.activity.detail}`
            : '') ||
          (ready && status && !status.available
            ? 'No se encuentra Stockfish 19. Revisa la instalación del motor.'
            : '')
        }
        modal={modal}
        onClose={() => setError('')}
      />
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
              setSettings(config);
              await repository.put('settings', 'preferences', config);
              await syncGames(config);
            }}
          >
            <label>
              Nombre de usuario de Chess.com
              <input
                autoComplete="username"
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
        <Modal title="Ajustes" className="settings-modal" onClose={() => setModal(null)}>
          <SettingsPanel
            settings={settings}
            onChange={(s) => {
              setSettings(s);
              setReviewTime(s.reviewTime);
            }}
          />
          <div className="modal-actions settings-actions">
            <button className="primary" onClick={() => setModal(null)}>
              Listo
            </button>
          </div>
        </Modal>
      )}
      {modal === 'library' && (
        <Modal title="Tu biblioteca" wide onClose={() => setModal(null)}>
          <GameLibrary
            games={games}
            username={settings.username}
            selected={game?.id}
            onSelect={(g) => selectGame(g).catch(reportError)}
            onImport={() => setModal('import')}
            onSync={() => syncGames()}
            syncing={syncing}
            reviewed={reviewIndex.reviewed}
            loadingReviews={reviewIndex.loading}
            jobs={reviewJobs}
          />
        </Modal>
      )}
    </div>
  );
}
