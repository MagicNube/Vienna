import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export function ErrorNotice({
  message,
  modal,
  onClose,
}: {
  message: string;
  modal: string | null;
  onClose: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [container, setContainer] = useState<Element | null>(null);
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    setContainer(modal ? document.querySelector('dialog.modal') : document.body);
  }, [modal]);
  useEffect(() => setHidden(false), [message]);
  useEffect(() => {
    if (!message || hidden || !ref.current?.isConnected) return;
    ref.current.hidePopover();
    ref.current.showPopover();
  }, [message, hidden, container]);
  if (!message || hidden) return null;
  const summary = /api\.chess\.com|No se pudo conectar con Chess\.com/i.test(message)
    ? 'No se pudo conectar con Chess.com.'
    : /standard algebraic notation|Invalid move:/i.test(message)
      ? 'No se pudo leer el PGN. Revisa las jugadas.'
      : message;
  return createPortal(
    <aside ref={ref} popover="manual" className="error-notice" aria-label="Aviso de error">
      <Icon name="alert" size={18} />
      <div role="alert" title={message}>
        {summary}
      </div>
      <button
        aria-label="Cerrar aviso"
        onClick={() => {
          setHidden(true);
          onClose();
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </aside>,
    container ?? document.body,
  );
}
