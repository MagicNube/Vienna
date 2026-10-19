import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function Information({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button statistics-info"
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
      >
        <Icon name="info" size={18} />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} className="information-dialog">
          <div className="information-content">{children}</div>
        </Modal>
      )}
    </>
  );
}
