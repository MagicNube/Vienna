import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BackgroundActivity } from '../review/backgroundQueue';
import { Icon } from './Icon';

export function BackgroundNotice({
  activity,
  modal,
}: {
  activity: BackgroundActivity | null;
  modal: string | null;
}) {
  const [hidden, setHidden] = useState<string | null>(null);
  const [container, setContainer] = useState<Element | null>(null);
  useLayoutEffect(() => {
    // A toast outside a modal dialog is inert, even in the top layer.
    setContainer(modal ? document.querySelector('dialog.modal') : document.body);
  }, [modal]);
  const ref = useRef<HTMLElement>(null);
  const visible = !!activity && hidden !== activity.id;
  useEffect(() => {
    if (!visible || !ref.current?.isConnected) return;
    // Keep the completion visible even when a native dialog is open.
    ref.current.hidePopover();
    ref.current.showPopover();
  }, [visible, activity?.id, activity?.kind, container]);
  useEffect(() => {
    if (!activity || activity.kind === 'progress') return;
    const timer = setTimeout(() => setHidden(activity.id), 7000);
    return () => clearTimeout(timer);
  }, [activity?.id, activity?.kind]);
  if (!activity || hidden === activity.id) return null;
  return createPortal(
    <aside
      ref={ref}
      popover="manual"
      className="background-notice"
      aria-label="Actividad en segundo plano"
    >
      <div role="status" aria-live="polite">
        <strong>{activity.title}</strong>
        <span>{activity.detail}</span>
      </div>
      <button aria-label="Ocultar notificación" onClick={() => setHidden(activity.id)}>
        <Icon name="close" size={16} />
      </button>
      {activity.kind === 'progress' && (
        <div className="background-progress">
          <progress
            aria-label="Posiciones analizadas"
            value={activity.total ? activity.done : undefined}
            max={activity.total || 1}
          />
          {activity.total && (
            <span>
              {activity.done}/{activity.total}
            </span>
          )}
        </div>
      )}
    </aside>,
    container ?? document.body,
  );
}
