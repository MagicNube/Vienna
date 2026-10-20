import { Icon } from './Icon';

export function AccountChoice({
  username,
  busy,
  onContinue,
  onNew,
}: {
  username: string;
  busy: boolean;
  onContinue: () => void;
  onNew: () => void;
}) {
  return (
    <div className="account-choice">
      <button className="primary full-width" disabled={busy} onClick={onContinue}>
        <Icon name="user" size={18} />
        {busy ? 'Abriendo cuenta…' : `Continuar con ${username}`}
      </button>
      <button className="secondary full-width" disabled={busy} onClick={onNew}>
        Usar otro nombre
      </button>
    </div>
  );
}
