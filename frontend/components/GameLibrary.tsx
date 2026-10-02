import { useState } from 'react';
import { Icon } from './Icon';
import type { Game } from '../types';
import type { ReviewJob } from '../review/backgroundQueue';
import { ReviewStatus } from './ReviewStatus';
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
function dateGroup(timestamp: number) {
  const date = new Date(timestamp),
    today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  today.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function GameLibrary({
  games,
  username,
  selected,
  onSelect,
  onImport,
  onSync,
  syncing,
  reviewed,
  loadingReviews,
  jobs,
}: {
  games: Game[];
  username: string;
  selected?: string;
  onSelect: (g: Game) => void;
  onImport: () => void;
  onSync: () => void;
  syncing: boolean;
  reviewed: Set<string>;
  loadingReviews: boolean;
  jobs: Record<string, ReviewJob>;
}) {
  const [speed, setSpeed] = useState('all'),
    [result, setResult] = useState('all'),
    [query, setQuery] = useState('');
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const filtered = games.filter(
    (g) =>
      (speed === 'all' || g.timeClass === speed) &&
      (result === 'all' || outcome(g, username) === result) &&
      (analysisFilter === 'all' ||
        (analysisFilter === 'reviewed' ? reviewed.has(g.id) : !reviewed.has(g.id))) &&
      `${g.white} ${g.black}`.toLowerCase().includes(query.toLowerCase()),
  );
  let previous = '';
  return (
    <div className="library">
      <div className="library-title">
        <div>
          <h2>
            Mis partidas <small>{games.length}</small>
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
      <div className="library-filters">
        <div className="search-input">
          <Icon name="search" />
          <input
            aria-label="Buscar jugador"
            placeholder="Buscar jugador…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select aria-label="Ritmo" value={speed} onChange={(e) => setSpeed(e.target.value)}>
          <option value="all">Todos los ritmos</option>
          {['rapid', 'blitz', 'bullet', 'daily', 'pgn'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Resultado" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="all">Todos los resultados</option>
          {['Victoria', 'Derrota', 'Tablas'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Análisis guardados"
          value={analysisFilter}
          disabled={loadingReviews}
          onChange={(e) => setAnalysisFilter(e.target.value)}
        >
          <option value="all">Todos los análisis</option>
          <option value="reviewed">Analizadas ({reviewed.size})</option>
          <option value="pending">Sin analizar</option>
        </select>
      </div>
      {filtered.length ? (
        filtered.map((g) => {
          const group = dateGroup(g.date),
            heading = previous !== group;
          previous = group;
          const r = outcome(g, username);
          return (
            <div key={g.id}>
              {heading && <h3 className="date-heading">{group}</h3>}
              <button
                className={`game-row ${selected === g.id ? 'selected' : ''}`}
                onClick={() => onSelect(g)}
                aria-label={`${g.white} vs ${g.black}. ${reviewed.has(g.id) ? 'Abrir análisis guardado' : 'Abrir partida'}`}
              >
                <span className="game-avatar">
                  <Icon name={g.timeClass === 'bullet' ? 'bolt' : 'board'} />
                </span>
                <span className="game-players">
                  <strong>
                    {g.white} <span>vs</span> {g.black}
                  </strong>
                  <small>
                    {g.source === 'chess.com' ? 'Chess.com' : 'PGN importado'} / {g.timeClass}
                    <ReviewStatus reviewed={reviewed.has(g.id)} job={jobs[g.id]} />
                  </small>
                </span>
                <span
                  className={`result ${r === 'Victoria' ? 'win' : r === 'Derrota' ? 'loss' : ''}`}
                >
                  {r}
                </span>
                <span className="game-time">{timeControl(g.timeControl)}</span>
                <Icon name="right" size={16} />
              </button>
            </div>
          );
        })
      ) : (
        <div className="empty-library">
          <Icon name="folder" size={42} />
          <h3>{games.length ? 'No hay partidas con estos filtros' : 'Sin partidas'}</h3>
          <p>
            {games.length
              ? 'Prueba otro ritmo o resultado.'
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
