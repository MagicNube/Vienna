import type { Game } from '../types';
import { Icon } from './Icon';
import { ReviewStatus } from './ReviewStatus';
import type { ReviewJob } from '../review/backgroundQueue';
export function accountOutcome(game: Game, username: string) {
  const user = username.trim().toLowerCase();
  const color =
    game.white.toLowerCase() === user ? 'w' : game.black.toLowerCase() === user ? 'b' : null;
  if (!user || !color) return null;
  if (game.result === '1/2-1/2') return 'draw';
  if (!['1-0', '0-1'].includes(game.result)) return null;
  return (game.result === '1-0') === (color === 'w') ? 'win' : 'loss';
}
export function relativeGameTime(date: number, now: number) {
  if (!Number.isFinite(date) || date <= 0) return 'Sin fecha';
  const minutes = Math.floor(Math.max(0, now - date) / 60_000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}
function gameOutcome(game: Game) {
  return game.result === '1-0'
    ? 'Ganan blancas'
    : game.result === '0-1'
      ? 'Ganan negras'
      : game.result === '1/2-1/2'
        ? 'Tablas'
        : 'Sin resultado';
}
export function RecentGame({
  game,
  selected,
  username,
  onSelect,
  now,
  reviewed,
  seen = false,
  job,
}: {
  game: Game;
  selected: boolean;
  username: string;
  onSelect: () => void;
  now: number;
  reviewed: boolean;
  seen?: boolean;
  job?: ReviewJob;
}) {
  const label = `Blancas: ${game.white}. Negras: ${game.black}. ${gameOutcome(game)}.`;
  const result = game.result === '1/2-1/2' ? 'draw' : accountOutcome(game, username);
  function resultIcon(player: string) {
    if (!result || (result !== 'draw' && player.toLowerCase() !== username.trim().toLowerCase()))
      return null;
    const label = result === 'win' ? 'Victoria' : result === 'loss' ? 'Derrota' : 'Tablas';
    return (
      <span className={`recent-outcome ${result}`} role="img" aria-label={label} title={label}>
        <Icon name={result === 'win' ? 'crown' : result === 'loss' ? 'close' : 'equal'} size={16} />
      </span>
    );
  }
  return (
    <div className={`recent-game ${selected ? 'current' : ''}`}>
      <button className="recent-open" title={label} aria-label={label} onClick={onSelect}>
        <span className="recent-players">
          <span className="recent-player">
            <span className="recent-letter" aria-hidden="true">
              W
            </span>
            <span
              className={game.white.toLowerCase() === username.toLowerCase() ? 'recent-me' : ''}
            >
              {game.white}
            </span>
            {resultIcon(game.white)}
          </span>
          <span className="recent-player">
            <span className="recent-letter" aria-hidden="true">
              B
            </span>
            <span
              className={game.black.toLowerCase() === username.toLowerCase() ? 'recent-me' : ''}
            >
              {game.black}
            </span>
            {resultIcon(game.black)}
          </span>
        </span>
      </button>
      <span className="recent-meta">
        <span className="recent-review-actions">
          <ReviewStatus reviewed={reviewed} seen={seen} job={job} />
        </span>
        <time
          className="recent-age"
          dateTime={
            Number.isFinite(game.date) && game.date > 0
              ? new Date(game.date).toISOString()
              : undefined
          }
          title={
            Number.isFinite(game.date) && game.date > 0
              ? new Date(game.date).toLocaleString('es-ES')
              : undefined
          }
        >
          {relativeGameTime(game.date, now)}
        </time>
      </span>
    </div>
  );
}
