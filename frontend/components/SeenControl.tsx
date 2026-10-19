import { Icon } from './Icon';
import { canToggleSeen } from '../database/seenGames';

export function SeenControl({
  seen,
  analysed,
  loadingAnalyses = false,
  disabled,
  onToggle,
}: {
  seen: boolean;
  analysed: boolean;
  loadingAnalyses?: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const action = seen ? 'Marcar como sin revisar' : 'Marcar como revisada';
  const allowed = canToggleSeen(seen, analysed, loadingAnalyses);
  return (
    <button
      className={`icon-button seen-control ${seen ? 'seen' : ''}`}
      aria-label={action}
      title={allowed ? action : 'Analiza la partida antes de marcarla como revisada'}
      aria-pressed={seen}
      disabled={disabled || !allowed}
      onClick={onToggle}
    >
      <Icon name="double-check" size={19} />
    </button>
  );
}
