import { isTauri } from '@tauri-apps/api/core';
import { openSupportPage, SUPPORT_URL } from '../api/support';
import { Icon } from './Icon';

export function SupportLink({ onError }: { onError: (error: unknown) => void }) {
  return (
    <a
      className="support-link"
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Buy Me a Coffee — se abre en tu navegador"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void openSupportPage().catch(() =>
          onError('No se pudo abrir Buy Me a Coffee en el navegador.'),
        );
      }}
    >
      <Icon name="coffee" size={17} />
      Apoyar Vienna
    </a>
  );
}
