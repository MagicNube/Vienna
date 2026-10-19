import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { MoveSymbol } from './MoveSymbol';
import {
  EvolutionStatistics,
  OpeningStatistics,
  PhaseStatistics,
  ComparisonStatistics,
} from './StatisticsInsights';
import { type InsightEntry } from '../review/statisticsInsights';
import { StatisticsCache, type StatisticsSnapshot } from '../review/statisticsCache';
import { categories } from '../review/classification';
import {
  filteredEntries,
  ownColor,
  statistics,
  categoryGames,
  modeLabels,
  isStatisticsGame,
  type StatisticsFilter,
} from '../review/statistics';
import type { Category, Game } from '../types';

const sections = [
  { id: 'summary', label: 'Resumen' },
  { id: 'openings', label: 'Aperturas' },
  { id: 'comparisons', label: 'Comparativas' },
  { id: 'phases', label: 'Fases' },
  { id: 'evolution', label: 'Evolución' },
] as const;

export function Statistics({
  games,
  username,
  revision,
  cache,
  onError,
  onCategoryGames,
}: {
  games: Game[];
  username: string;
  revision: number;
  cache: StatisticsCache;
  onError: (message: string) => void;
  onCategoryGames: (category: Category, matches: ReturnType<typeof categoryGames>) => void;
}) {
  const [reload, setReload] = useState(0);
  const [fallback, setFallback] = useState<'w' | 'b'>('w');
  const [filter, setFilter] = useState<StatisticsFilter>({ mode: 'all', days: 0, color: 'all' });
  const [section, setSection] = useState<(typeof sections)[number]['id']>('summary');
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scope = useMemo(
    () => games.filter((g) => isStatisticsGame(g) && ownColor(g, username, fallback)),
    [games, username, fallback],
  );
  const [snapshot, setSnapshot] = useState<StatisticsSnapshot>(
    () =>
      cache.peek(scope) ??
      cache.previous(scope) ?? { reviews: {}, profiles: new Map(), skipped: 0 },
  );
  const [loading, setLoading] = useState(() => !cache.peek(scope));
  const [hasSnapshot, setHasSnapshot] = useState(
    () => !!(cache.peek(scope) ?? cache.previous(scope)),
  );
  const displayLoading = loading && !hasSnapshot;
  const { reviews, profiles, skipped } = snapshot;
  useEffect(() => {
    let active = true;
    const cached = cache.peek(scope);
    if (cached) {
      setSnapshot(cached);
      setHasSnapshot(true);
      setLoading(false);
      return;
    }
    const previous = cache.previous(scope);
    setHasSnapshot(!!previous);
    setSnapshot(previous ?? { reviews: {}, profiles: new Map(), skipped: 0 });
    setLoading(true);
    void cache
      .load(scope)
      .then((data) => {
        if (active) {
          setSnapshot(data);
          setHasSnapshot(true);
        }
      })
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
  }, [scope, revision, reload, onError, cache]);
  const entries: InsightEntry[] = useMemo(
    () =>
      scope.map((game) => ({
        game,
        color: ownColor(game, username, fallback)!,
        review: reviews[game.id],
        profile: profiles.get(game.id) ?? { tree: null, opening: 'Sin identificar' },
      })),
    [scope, username, fallback, reviews, profiles],
  );
  const selected = useMemo(() => filteredEntries(entries, filter, Date.now()), [entries, filter]);
  const stats = useMemo(() => statistics(selected), [selected]);
  const modes = [...new Set(scope.map((g) => g.timeClass))].sort();
  return (
    <section className="statistics-page">
      <header className="page-heading statistics-heading">
        <div>
          <div className="statistics-title-row">
            <h1>Estadísticas</h1>
            <button
              className="icon-button statistics-refresh"
              title="Actualizar estadísticas"
              aria-label="Actualizar estadísticas"
              disabled={loading}
              onClick={() => {
                cache.invalidate();
                setReload((v) => v + 1);
              }}
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
          <p className="game-metadata">{username || 'Partidas importadas'}</p>
        </div>
      </header>
      <div className="statistics-workspace">
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
            <span>Victorias %</span>
            <strong>{stats.winrate === null ? '—' : `${stats.winrate.toFixed(1)}%`}</strong>
          </div>
          <div title="Victoria: 1 punto. Tablas: medio punto. Derrota: 0 puntos.">
            <span>Puntuación %</span>
            <strong>{stats.scoreRate === null ? '—' : `${stats.scoreRate.toFixed(1)}%`}</strong>
          </div>
          <div>
            <span>Analizadas</span>
            <strong>
              {displayLoading ? '—' : stats.complete}
              <small> / {selected.length}</small>
            </strong>
          </div>
          <div>
            <span>Precisión</span>
            <strong>
              {displayLoading || stats.accuracy === null ? '—' : `${stats.accuracy.toFixed(1)}%`}
            </strong>
          </div>
        </div>
        <div className="statistics-tabs" role="tablist" aria-label="Secciones de estadísticas">
          {sections.map((item, index) => (
            <button
              key={item.id}
              id={`${tabsId}-${item.id}`}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              aria-selected={section === item.id}
              aria-controls={`${tabsId}-panel`}
              tabIndex={section === item.id ? 0 : -1}
              onClick={() => setSection(item.id)}
              onKeyDown={(event) => {
                const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
                const step =
                  event.key === 'ArrowRight'
                    ? rtl
                      ? -1
                      : 1
                    : event.key === 'ArrowLeft'
                      ? rtl
                        ? 1
                        : -1
                      : 0;
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? sections.length - 1
                      : step
                        ? (index + step + sections.length) % sections.length
                        : null;
                if (next === null) return;
                event.preventDefault();
                setSection(sections[next].id);
                tabRefs.current[next]?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="statistics-content"
          id={`${tabsId}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-${section}`}
          tabIndex={0}
          aria-busy={loading}
        >
          {!selected.length && (
            <p className="statistics-note">No hay partidas con estos filtros.</p>
          )}
          {selected.length > 0 && section === 'summary' && (
            <div className="statistics-panels statistics-overview">
              <section className="statistics-card statistics-results">
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
              </section>
              <section className="statistics-card category-statistics">
                <h2>Tus jugadas</h2>
                <p className="statistics-note" role={displayLoading ? 'status' : undefined}>
                  {displayLoading
                    ? 'Cargando análisis…'
                    : `${stats.moves} jugadas en ${stats.complete} ${stats.complete === 1 ? 'partida analizada' : 'partidas analizadas'}`}
                </p>
                <div className="statistics-categories">
                  {(Object.keys(categories) as Category[]).map((key) => (
                    <button
                      key={key}
                      className="statistics-category"
                      disabled={displayLoading || stats.counts[key] === 0}
                      aria-label={`Ver partidas con ${categories[key].label}: ${stats.counts[key]} ${stats.counts[key] === 1 ? 'jugada tuya' : 'jugadas tuyas'}`}
                      onClick={() => onCategoryGames(key, categoryGames(selected, key))}
                    >
                      <span className={`badge ${key}`}>
                        <MoveSymbol category={key} />
                      </span>
                      <span>{categories[key].label}</span>
                      <strong>{displayLoading ? '—' : stats.counts[key]}</strong>
                    </button>
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
          )}
          {selected.length > 0 && section === 'comparisons' && (
            <ComparisonStatistics entries={selected} loading={displayLoading} />
          )}
          {selected.length > 0 && section === 'openings' && (
            <OpeningStatistics entries={selected} loading={displayLoading} onError={onError} />
          )}
          {selected.length > 0 &&
            (section === 'phases' || section === 'evolution') &&
            (displayLoading ? (
              <p className="statistics-note" role="status">
                Cargando análisis…
              </p>
            ) : section === 'phases' ? (
              <PhaseStatistics entries={selected} />
            ) : (
              <EvolutionStatistics entries={selected} />
            ))}
          {skipped > 0 && (
            <p className="statistics-note">
              {skipped} análisis no se pudieron incluir. Sus partidas sí cuentan en los resultados.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
