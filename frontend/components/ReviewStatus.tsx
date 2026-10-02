import { Icon } from './Icon';
import type { ReviewJob } from '../review/backgroundQueue';

export function ReviewStatus({
  reviewed,
  job,
  showUnreviewed = false,
}: {
  reviewed: boolean;
  job?: ReviewJob;
  showUnreviewed?: boolean;
}) {
  if (job?.state === 'analysing')
    return (
      <span className="review-status analysing" role="status">
        <Icon name="refresh" size={13} />
        {job.total ? `Analizando ${Math.round((job.done / job.total) * 100)}%` : 'Analizando'}
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
