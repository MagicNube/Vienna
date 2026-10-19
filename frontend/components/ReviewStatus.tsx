import { Icon } from './Icon';
import type { ReviewJob } from '../review/backgroundQueue';

export function gameStage(reviewed: boolean, seen: boolean) {
  return reviewed ? (seen ? 'seen' : 'analysed') : 'pending';
}

export function ReviewStatus({
  reviewed,
  seen = false,
  job,
  showUnreviewed = false,
}: {
  reviewed: boolean;
  seen?: boolean;
  job?: ReviewJob;
  showUnreviewed?: boolean;
}) {
  if (reviewed && seen)
    return (
      <span className="review-status ready seen">
        <Icon name="double-check" size={14} />
        Revisada
      </span>
    );
  if (job?.state === 'analysing')
    return (
      <span className="review-status analysing" role="status">
        <Icon name="refresh" size={13} />
        {job.total ? `Analizando ${Math.round((job.done / job.total) * 100)}%` : 'Analizando'}
      </span>
    );
  if (job?.state === 'paused')
    return (
      <span className="review-status queued" role="status">
        <Icon name="pause" size={13} />
        En pausa
      </span>
    );
  if (reviewed && !job?.manual)
    return (
      <span className="review-status ready">
        <Icon name="check" size={13} />
        Analizada
      </span>
    );
  if (job?.state === 'queued')
    return (
      <span className="review-status queued">
        <Icon name="clock" size={13} />
        En cola
      </span>
    );
  return showUnreviewed ? <span className="review-status pending">Sin analizar</span> : null;
}
