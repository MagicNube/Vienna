import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { backdropGesture, type Point } from './modalInteraction';
import { WindowTitleBar } from './WindowTitleBar';
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = '',
  dismissOnBackdrop = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  dismissOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef<Point | null>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    d.showModal();
    closeButton.current?.focus();
    return () => d.close();
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      onCancel={onClose}
      onPointerDown={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClick={(e) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        const dialog = ref.current!;
        const rect = dialog.getBoundingClientRect();
        if (
          dismissOnBackdrop &&
          e.target === dialog &&
          backdropGesture(start, { x: e.clientX, y: e.clientY }, rect)
        )
          onClose();
      }}
    >
      {typeof document !== 'undefined' &&
        document.documentElement.dataset.windowChrome === 'custom' && <WindowTitleBar />}
      <header>
        <h2>{title}</h2>
        <button
          ref={closeButton}
          className="icon-button"
          aria-label="Cerrar"
          onClick={onClose}
          autoFocus
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
