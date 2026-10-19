import { FEEDBACK_FORM_ID, type FeedbackAction } from './HelpSettings';
import { SupportLink } from './SupportLink';
import { Icon } from './Icon';

export function SettingsActions({
  feedbackAction,
  onClose,
  onError,
}: {
  feedbackAction: FeedbackAction;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const sent = feedbackAction?.state === 'sent';
  return (
    <div className="modal-actions settings-actions">
      <SupportLink onError={onError} />
      <button
        className={`primary${feedbackAction ? ' feedback-submit' : ''}`}
        type={feedbackAction ? 'submit' : 'button'}
        form={feedbackAction ? FEEDBACK_FORM_ID : undefined}
        disabled={Boolean(feedbackAction && feedbackAction.state !== 'ready')}
        data-sent={sent || undefined}
        onClick={feedbackAction ? undefined : onClose}
      >
        {sent && <Icon name="check" size={16} />}
        {feedbackAction?.label ?? 'Listo'}
      </button>
    </div>
  );
}
