import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { Category, Game } from '../types';
import { categories } from '../review/classification';
import { MoveSymbol } from './MoveSymbol';
import type { ReviewJob } from '../review/backgroundQueue';
import { gameStage, ReviewStatus } from './ReviewStatus';
import { modeLabels } from '../review/statistics';
import { relativeGameTime } from './RecentGame';
import { canToggleSeen } from '../database/seenGames';
import { gameKind, isTrainingGame } from '../chess/gameKind';
export function outcome(game: Game, user: string) {
  if (!['1-0', '0-1', '1/2-1/2'].includes(game.result)) return 'Sin terminar';
  if (game.result === '1/2-1/2') return 'Tablas';
  if (![game.white.toLowerCase(), game.black.toLowerCase()].includes(user.toLowerCase()))
    return game.result;
  const isWhite = game.white.toLowerCase() === user.toLowerCase();
  return (game.result === '1-0') === isWhite ? 'Victoria' : 'Derrota';
}
export function timeControl(value: string) {
  const [base, increment] = value.split('+');
  if (/^\d+$/.test(base)) return `${Number(base) / 60}${increment ? '+' + increment : '+0'}`;
  return value;
}
function dateGroup(timestamp: number, now: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Sin fecha';
  const date = new Date(timestamp),
    today = new Date(now);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  today.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function GameLibrary({
  games,
  now,
  username,
  selected,
  onSelect,
  onImport,
  onSync,
  syncing,
  reviewed,
  seen: savedSeen,
  loadingSeen,
  pendingSeen,
  onToggleSeen,
  loadingReviews,
  jobs,
  categoryFilter,
  onClearCategory,
}: {
  games: Game[];
  now: number;
  username: string;
  selected?: string;
  onSelect: (g: Game) => void;
  onImport: () => void;
  onSync: () => void;
  syncing: boolean;
  reviewed: Set<string>;
  seen: Set<string>;
  loadingSeen: boolean;
  pendingSeen: Set<string>;
  onToggleSeen: (id: string) => void;
  loadingReviews: boolean;
  jobs: Record<string, ReviewJob>;
  categoryFilter?: { category: Category; counts: Record<string, number> };
  onClearCategory?: () => void;
}) {
  const seen = useMemo(
    () => new Set([...savedSeen].filter((id) => reviewed.has(id))),
    [savedSeen, reviewed],
  );
  const [speed, setSpeed] = useState('all'),
    [result, setResult] = useState('all'),
    [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [collection, setCollection] = useState<'regular' | 'training'>(() =>
    !categoryFilter && games.some((g) => g.id === selected && isTrainingGame(g))
      ? 'training'
      : 'regular',
  );
  const collections = useMemo(
    () => ({
      regular: games.filter((g) => !isTrainingGame(g)),
      training: games.filter(isTrainingGame),
    }),
    [games],
  );
  const scopedGames = categoryFilter
    ? collections.regular.filter((g) => categoryFilter.counts[g.id] > 0)
    : collections[collection];
  const stateCounts = {
    pending: scopedGames.filter((g) => gameStage(reviewed.has(g.id), seen.has(g.id)) === 'pending')
      .length,
    analysed: scopedGames.filter(
      (g) => gameStage(reviewed.has(g.id), seen.has(g.id)) === 'analysed',
    ).length,
    seen: scopedGames.filter((g) => seen.has(g.id)).length,
  };
  const filtered = scopedGames.filter(
    (g) =>
      (speed === 'all' || g.timeClass === speed) &&
      (result === 'all' || outcome(g, username) === result) &&
      (stateFilter === 'all' || gameStage(reviewed.has(g.id), seen.has(g.id)) === stateFilter) &&
      `${g.white} ${g.black}`.toLowerCase().includes(query.toLowerCase()),
  );
  let previous = '';
  return (
    <div className="library">
      <div className="library-title">
        <div>
          <h2>
            Mis partidas <small>{categoryFilter ? scopedGames.length : games.length}</small>
          </h2>
        </div>
        <div className="library-actions">
          <button onClick={onImport} className="secondary">
            <Icon name="import" />
            Importar PGN
          </button>
          <button onClick={onSync} disabled={syncing} className="secondary">
            <Icon name="refresh" />
            {syncing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      {!categoryFilter && collections.training.length > 0 && (
        <div className="library-collections" role="group" aria-label="Colecciones de partidas">
          {(
            [
              ['regular', 'Partidas'],
              ['training', 'Coaches y bots'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={collection === key}
              onClick={() => {
                setCollection(key);
                setSpeed('all');
              }}
            >
              {label}
              <small>{collections[key].length}</small>
            </button>
          ))}
        </div>
      )}
      {!categoryFilter && collection === 'training' && (
        <p className="library-training-note">No cuentan en tus estadísticas.</p>
      )}
      {categoryFilter && (
        <div className="library-category-filter">
          <span className={`badge ${categoryFilter.category}`}>
            <MoveSymbol category={categoryFilter.category} />
          </span>
          <strong>Con {categories[categoryFilter.category].label}</strong>
          <span>Tus jugadas</span>
          <button
            className="icon-button"
            aria-label="Quitar filtro de categoría"
            title="Quitar filtro de categoría"
            onClick={onClearCategory}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <div
        className={`library-filters ${!categoryFilter && collection === 'training' ? 'training' : ''}`}
      >
        <div className="search-input">
          <Icon name="search" />
          <input
            aria-label="Buscar jugador"
            placeholder="Buscar jugador…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(categoryFilter || collection === 'regular') && (
          <select aria-label="Ritmo" value={speed} onChange={(e) => setSpeed(e.target.value)}>
            <option value="all">Todos los ritmos</option>
            {['rapid', 'blitz', 'bullet', 'pgn'].map((s) => (
              <option key={s} value={s}>
                {modeLabels[s]}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Resultado" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="all">Todos los resultados</option>
          {['Victoria', 'Derrota', 'Tablas'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Estado de la partida"
          value={stateFilter}
          disabled={loadingReviews || loadingSeen}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Sin analizar ({stateCounts.pending})</option>
          <option value="analysed">Analizadas ({stateCounts.analysed})</option>
          <option value="seen">Revisadas ({stateCounts.seen})</option>
        </select>
      </div>
      {filtered.length ? (
        filtered.map((g) => {
          const group = dateGroup(g.date, now),
            heading = previous !== group;
          previous = group;
          const r = outcome(g, username);
          const kind = gameKind(g);
          return (
            <div key={g.id}>
              {heading && <h3 className="date-heading">{group}</h3>}
              <div className={`game-entry ${selected === g.id ? 'selected' : ''}`}>
                <button
                  className="game-open-target"
                  onClick={() => onSelect(g)}
                  aria-label={`${g.white} vs ${g.black}. ${r}. ${relativeGameTime(g.date, now)}. ${seen.has(g.id) ? 'Revisada.' : reviewed.has(g.id) ? 'Analizada.' : 'Sin analizar.'} ${reviewed.has(g.id) ? 'Abrir análisis guardado' : 'Abrir partida'}`}
                />
                <div className="game-row">
                  <span className="game-avatar">
                    <Icon name={g.timeClass === 'bullet' ? 'bolt' : 'board'} />
                  </span>
                  <span className="game-players">
                    <strong>
                      <span
                        className={
                          g.white.toLowerCase() === username.toLowerCase()
                            ? 'game-me'
                            : 'game-rival'
                        }
                      >
                        {g.white}
                      </span>
                      <span className="game-versus">vs</span>
                      <span
                        className={
                          g.black.toLowerCase() === username.toLowerCase()
                            ? 'game-me'
                            : 'game-rival'
                        }
                      >
                        {g.black}
                      </span>
                    </strong>
                    <small>
                      <span
                        className={`game-outcome ${r === 'Victoria' ? 'win' : r === 'Derrota' ? 'loss' : ''}`}
                      >
                        <Icon
                          name={
                            r === 'Victoria'
                              ? 'crown'
                              : r === 'Derrota'
                                ? 'close'
                                : r === 'Tablas'
                                  ? 'equal'
                                  : 'board'
                          }
                          size={r === 'Victoria' ? 16 : 14}
                        />
                        {r}
                      </span>
                      <button
                        className={`game-state-action ${seen.has(g.id) ? 'seen' : ''}`}
                        aria-label={
                          seen.has(g.id) ? 'Marcar como sin revisar' : 'Marcar como revisada'
                        }
                        title={
                          !canToggleSeen(seen.has(g.id), reviewed.has(g.id), loadingReviews)
                            ? 'Analiza la partida antes de marcarla como revisada'
                            : seen.has(g.id)
                              ? 'Marcar como sin revisar'
                              : 'Marcar como revisada'
                        }
                        aria-pressed={seen.has(g.id)}
                        disabled={
                          loadingSeen ||
                          pendingSeen.has(g.id) ||
                          !canToggleSeen(seen.has(g.id), reviewed.has(g.id), loadingReviews)
                        }
                        onClick={() => onToggleSeen(g.id)}
                      >
                        <ReviewStatus
                          reviewed={reviewed.has(g.id)}
                          seen={seen.has(g.id)}
                          job={jobs[g.id]}
                          showUnreviewed
                        />
                      </button>
                      {categoryFilter && (
                        <span className="game-category-count">
                          <span className={`badge ${categoryFilter.category}`}>
                            <MoveSymbol category={categoryFilter.category} />
                          </span>
                          {categoryFilter.counts[g.id]}{' '}
                          {categoryFilter.counts[g.id] === 1 ? 'jugada' : 'jugadas'}
                        </span>
                      )}
                    </small>
                  </span>
                  <span className="game-row-timing">
                    <span className="game-mode">
                      {kind === 'coach'
                        ? 'Coach'
                        : kind === 'bot'
                          ? 'Bot'
                          : (modeLabels[g.timeClass] ?? g.timeClass)}{' '}
                      {!isTrainingGame(g) || /^\d+(\+\d+)?$/.test(g.timeControl)
                        ? timeControl(g.timeControl)
                        : ''}
                    </span>
                    <time
                      className="game-age"
                      dateTime={
                        Number.isFinite(g.date) && g.date > 0
                          ? new Date(g.date).toISOString()
                          : undefined
                      }
                      title={
                        Number.isFinite(g.date) && g.date > 0
                          ? new Date(g.date).toLocaleString('es-ES')
                          : undefined
                      }
                    >
                      {relativeGameTime(g.date, now)}
                    </time>
                  </span>
                  <Icon name="right" size={16} />
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty-library">
          <Icon name="folder" size={42} />
          <h3>{games.length ? 'No hay partidas con estos filtros' : 'Sin partidas'}</h3>
          <p>
            {games.length
              ? 'Prueba otros filtros.'
              : 'Conecta tu usuario de Chess.com o importa un PGN para empezar a analizar.'}
          </p>
          <button className="primary" onClick={onImport}>
            <Icon name="import" />
            Importar PGN
          </button>
        </div>
      )}
    </div>
  );
}
