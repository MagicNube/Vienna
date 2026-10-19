import { useEffect, useRef, useState } from 'react';
import type { BackgroundActivity } from '../review/backgroundQueue';
import { Icon } from './Icon';

export function NotificationCenter({
  items,
  queued,
  modal,
  onView,
  onDismiss,
  paused = false,
  onPause,
  onResume,
  onReport,
}: {
  items: BackgroundActivity[];
  queued: number;
  modal: string | null;
  onView: (gameId: string) => void;
  onDismiss: (id: string) => void;
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onReport?: (detail: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const unread = items.filter((item) => item.kind !== 'progress').length;
  useEffect(() => {
    if (modal) panel.current?.hidePopover();
  }, [modal]);
  useEffect(() => {
    const hide = () => panel.current?.hidePopover();
    window.addEventListener('resize', hide);
    return () => window.removeEventListener('resize', hide);
  }, []);
  const close = () => {
    panel.current?.hidePopover();
    button.current?.focus();
  };
  return (
    <div className="notification-center">
      <button
        ref={button}
        className="notification-bell icon-button"
        aria-label={`Notificaciones${unread ? `, ${unread} ${unread === 1 ? 'pendiente' : 'pendientes'}` : ''}`}
        title="Notificaciones"
        aria-expanded={open}
        aria-controls="notification-panel"
        popoverTarget="notification-panel"
        popoverTargetAction="toggle"
        onClick={() => {
          const rect = button.current!.getBoundingClientRect();
          panel.current!.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 344))}px`;
          panel.current!.style.top = `${rect.bottom + 8}px`;
        }}
      >
        <Icon name="bell" size={19} />
        {unread > 0 ? (
          <span className="notification-count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : items.length > 0 || queued > 0 ? (
          <i className="notification-dot" aria-hidden="true" />
        ) : null}
      </button>
      <div
        ref={panel}
        id="notification-panel"
        className="notification-panel"
        popover="auto"
        role="region"
        aria-label="Notificaciones"
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <header>
          <h2>Notificaciones</h2>
          <button className="icon-button" aria-label="Cerrar notificaciones" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="notification-list">
          {items.length === 0 && <p className="notification-empty">Sin notificaciones</p>}
          {items.map((item) => (
            <div
              className={`notification-item ${item.kind}${item.kind === 'error' && onReport ? ' has-report' : ''}`}
              key={item.id}
            >
              <button
                className="notification-view"
                disabled={!item.gameId}
                onClick={() => {
                  if (!item.gameId) return;
                  close();
                  onView(item.gameId);
                }}
              >
                <Icon
                  name={
                    item.kind === 'success'
                      ? 'check'
                      : item.kind === 'error'
                        ? 'alert'
                        : item.paused
                          ? 'pause'
                          : 'refresh'
                  }
                  size={17}
                />
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  {item.kind === 'progress' && (
                    <progress
                      aria-label="Posiciones analizadas"
                      max={item.total || 1}
                      value={item.total ? item.done : undefined}
                    />
                  )}
                </span>
              </button>
              {item.kind !== 'progress' && (
                <button
                  className="notification-dismiss icon-button"
                  aria-label={`Omitir: ${item.detail}`}
                  onClick={() => onDismiss(item.id)}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
              {item.kind === 'error' && onReport && (
                <button
                  className="notification-report"
                  type="button"
                  onClick={() => {
                    close();
                    onReport(item.detail);
                  }}
                >
                  Informar de este problema
                </button>
              )}
            </div>
          ))}
        </div>
        {(queued > 0 || paused || items.some((item) => item.kind === 'progress')) && (
          <footer>
            <span>
              {queued > 0
                ? `${queued} ${queued === 1 ? 'partida en cola' : 'partidas en cola'}`
                : paused
                  ? 'Cola en pausa'
                  : 'Análisis en curso'}
            </span>
            {onPause && onResume && (
              <button
                className="notification-pause"
                onClick={paused ? onResume : onPause}
                title={
                  paused
                    ? 'Continuar desde la posición pendiente'
                    : 'Pausar toda la cola al terminar la posición actual'
                }
              >
                <Icon name={paused ? 'play' : 'pause'} size={14} />
                {paused ? 'Reanudar' : 'Pausar'}
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
