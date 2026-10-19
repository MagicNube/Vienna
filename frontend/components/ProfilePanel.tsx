import { useRef, useState } from 'react';
import { profileImage, profileInitials } from '../profile/image';
import { Icon } from './Icon';

export function ProfilePanel({
  username,
  image,
  onImage,
  onAccount,
  onClose,
}: {
  username: string;
  image?: string;
  onImage: (image: string | undefined) => Promise<void>;
  onAccount: () => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function changeImage(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await onImage(await profileImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la imagen.');
    } finally {
      setBusy(false);
    }
  }
  async function removeImage() {
    setError('');
    setBusy(true);
    try {
      await onImage(undefined);
    } catch {
      setError('No se pudo quitar la foto.');
    } finally {
      setBusy(false);
    }
  }
  const photoAction = image ? 'Cambiar foto' : 'Añadir foto';
  return (
    <>
      <div className="profile-editor">
        <button
          className="profile-photo-picker"
          aria-label={busy ? 'Preparando foto de perfil' : photoAction}
          aria-busy={busy}
          title={photoAction}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <span className="profile-photo-image">
            {image ? <img src={image} alt="" /> : profileInitials(username)}
          </span>
          <span className="profile-photo-overlay" aria-hidden="true">
            <Icon name={busy ? 'clock' : 'camera'} size={22} />
            <span>{busy ? 'Preparando…' : image ? 'Cambiar' : 'Añadir'}</span>
          </span>
          <span className="profile-photo-badge" aria-hidden="true">
            <Icon name="camera" size={14} />
          </span>
        </button>
        <div>
          <strong>{username}</strong>
          {image && (
            <button className="profile-photo-remove" disabled={busy} onClick={removeImage}>
              <Icon name="trash" size={16} />
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        disabled={busy}
        aria-label="Imagen de perfil"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          void changeImage(file);
        }}
      />
      <p className="profile-photo-error" role="alert">
        {error}
      </p>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onAccount}>
          Cambiar cuenta
        </button>
        <button className="primary" disabled={busy} onClick={onClose}>
          Listo
        </button>
      </div>
    </>
  );
}
