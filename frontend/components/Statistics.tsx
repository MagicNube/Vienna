import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { MoveSymbol } from './MoveSymbol';
import { repository } from '../database/repository';
import { makeTree } from '../chess/game';
import { upgradeReview } from '../review/upgradeReview';
import { REVIEW_VERSION } from '../review/GameReviewService';
import { categories } from '../review/classification';
import {
  filteredEntries,
  ownColor,
  statistics,
  modeLabels,
  type StatisticsEntry,
  type StatisticsFilter,
} from '../review/statistics';
import type { Category, Game, Review } from '../types';

export function Statistics({
  games,
  username,
  revision,
  onError,
}: {
  games: Game[];
  username: string;
  revision: number;
  onError: (message: string) => void;
}) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [fallback, setFallback] = useState<'w' | 'b'>('w');
  const [filter, setFilter] = useState<StatisticsFilter>({ mode: 'all', days: 0, color: 'all' });
  const [skipped, setSkipped] = useState(0);
  const scope = useMemo(
    () => games.filter((g) => ownColor(g, username, fallback)),
    [games, username, fallback],
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReviews({});
    void (async () => {
      const found: Record<string, Review> = {};
      let unavailable = 0;
      for (let offset = 0; offset < scope.length; offset += 8) {
        const batch = await Promise.allSettled(
          scope.slice(offset, offset + 8).map(async (game) => {
            const review = await repository.get<Review>('reviews', game.id);
            if (!review) return;
            if (review.version !== REVIEW_VERSION) {
              unavailable++;
              return;
            }
            found[game.id] = upgradeReview(makeTree(game.pgn), review);
          }),
        );
        if (!active) return;
        unavailable += batch.filter((r) => r.status === 'rejected').length;
      }
      if (active) {
        setReviews(found);
        setSkipped(unavailable);
      }
    })()
      .catch(() => {
        if (active)
          onError('No se pudieron cargar las estadísticas. Pulsa Actualizar para reintentarlo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope, revision, reload, onError]);
  const entries: StatisticsEntry[] = scope.map((game) => ({
    game,
    color: ownColor(game, username, fallback)!,
    review: reviews[game.id],
  }));
  const selected = filteredEntries(entries, filter, Date.now());
  const stats = statistics(selected);
  const modes = [...new Set(scope.map((g) => g.timeClass))].sort();
  return (
    <section className="statistics-page">
      <header className="statistics-heading">
        <div>
          <h1>Estadísticas</h1>
          <p>{username || 'Partidas importadas'}</p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => setReload((v) => v + 1)}>
          <Icon name="refresh" size={16} />
          Actualizar
        </button>
      </header>
      <div className="statistics-filters">
        <label>
          Periodo
          <select
            aria-label="Periodo"
            value={filter.days}
            onChange={(e) => setFilter({ ...filter, days: +e.target.value })}
          >
            <option value={0}>Todo el historial</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Último año</option>
          </select>
        </label>
        <label>
          Modo
          <select
            aria-label="Modo"
            value={filter.mode}
            onChange={(e) => setFilter({ ...filter, mode: e.target.value })}
          >
            <option value="all">Todos los modos</option>
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabels[mode] ?? mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          Color
          <select
            aria-label="Color"
            value={filter.color}
            onChange={(e) =>
              setFilter({ ...filter, color: e.target.value as StatisticsFilter['color'] })
            }
          >
            <option value="all">Ambos colores</option>
            <option value="w">Blancas</option>
            <option value="b">Negras</option>
          </select>
        </label>
        {!username && (
          <label>
            Mis jugadas
            <select value={fallback} onChange={(e) => setFallback(e.target.value as 'w' | 'b')}>
              <option value="w">Blancas</option>
              <option value="b">Negras</option>
            </select>
          </label>
        )}
      </div>
      <div className="statistics-metrics">
        <div>
          <span>Partidas terminadas</span>
          <strong>{stats.finished}</strong>
        </div>
        <div>
          <span>Winrate</span>
          <strong>{stats.winrate === null ? '—' : `${stats.winrate.toFixed(1)}%`}</strong>
        </div>
        <div>
          <span>Analizadas</span>
          <strong>
            {loading ? '—' : stats.complete}
            <small> / {selected.length}</small>
          </strong>
        </div>
        <div>
          <span>Precisión</span>
          <strong>
            {loading || stats.accuracy === null ? '—' : `${stats.accuracy.toFixed(1)}%`}
          </strong>
        </div>
      </div>
      {!selected.length && <p className="statistics-note">No hay partidas con estos filtros.</p>}
      <div className="statistics-panels">
        <section className="statistics-card">
          <h2>Resultados</h2>
          <div
            className="result-distribution"
            role="img"
            aria-label={`${stats.wins} victorias, ${stats.draws} tablas y ${stats.losses} derrotas`}
          >
            {(['win', 'draw', 'loss'] as const).map((key, i) => {
              const value = [stats.wins, stats.draws, stats.losses][i];
              return value > 0 && <span key={key} className={key} style={{ flex: value }} />;
            })}
          </div>
          <div className="result-counts">
            {[
              ['Victorias', stats.wins, 'win'],
              ['Tablas', stats.draws, 'draw'],
              ['Derrotas', stats.losses, 'loss'],
            ].map(([label, count, key]) => (
              <div key={key} className={String(key)}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="statistics-note">
            Las tablas cuentan como partidas terminadas. Las partidas sin resultado se excluyen del
            winrate.
          </p>
        </section>
        <section className="statistics-card">
          <h2>Tus jugadas</h2>
          <p className="statistics-note" role={loading ? 'status' : undefined}>
            {loading
              ? 'Cargando análisis…'
              : `${stats.moves} jugadas en ${stats.complete} ${stats.complete === 1 ? 'partida analizada' : 'partidas analizadas'}`}
          </p>
          <div className="statistics-categories">
            {(Object.keys(categories) as Category[]).map((key) => (
              <div key={key}>
                <span className={`badge ${key}`}>
                  <MoveSymbol category={key} />
                </span>
                <span>{categories[key].label}</span>
                <strong>{loading ? '—' : stats.counts[key]}</strong>
              </div>
            ))}
          </div>
          {stats.partial > 0 && (
            <p className="statistics-note">
              {stats.partial} análisis {stats.partial === 1 ? 'pendiente' : 'pendientes'} de
              completar.
            </p>
          )}
        </section>
        <section className="statistics-card elo-statistics">
          <h2>Elo por modo</h2>
          <p className="statistics-note">
            Último Elo guardado y evolución en el periodo seleccionado.
          </p>
          {!stats.elo.length ? (
            <p className="statistics-note">No hay datos de Elo con estos filtros.</p>
          ) : (
            <div className="elo-mode-grid">
              {stats.elo.map((mode) => {
                const min = Math.min(...mode.points.map((p) => p.rating)),
                  max = Math.max(...mode.points.map((p) => p.rating));
                return (
                  <div className="elo-mode" key={mode.mode}>
                    <div>
                      <h3>{modeLabels[mode.mode] ?? mode.mode}</h3>
                      <strong>{mode.rating}</strong>
                      {mode.delta !== null && (
                        <span className={mode.delta >= 0 ? 'positive' : 'negative'}>
                          {mode.delta > 0 ? '+' : ''}
                          {mode.delta}
                        </span>
                      )}
                    </div>
                    {mode.points.length > 1 && (
                      <svg
                        viewBox="0 0 300 72"
                        role="img"
                        aria-label={`Elo de ${modeLabels[mode.mode] ?? mode.mode}: de ${mode.points[0].rating} a ${mode.rating}`}
                      >
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2.5"
                          points={mode.points
                            .map(
                              (p, i) =>
                                `${4 + (i * 292) / (mode.points.length - 1)},${max === min ? 36 : 64 - ((p.rating - min) * 56) / (max - min)}`,
                            )
                            .join(' ')}
                        />
                      </svg>
                    )}
                    <small>
                      {mode.points.length}{' '}
                      {mode.points.length === 1 ? 'partida con Elo' : 'partidas con Elo'}
                    </small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {skipped > 0 && (
        <p className="statistics-note">
          {skipped} análisis no se pudieron incluir. Sus partidas sí cuentan en los resultados.
        </p>
      )}
    </section>
  );
}
