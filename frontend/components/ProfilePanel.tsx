import { useRef, useState } from 'react';
import { profileImage, profileInitials } from '../profile/image';

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
  return (
    <>
      <div className="profile-editor">
        <button
          className="profile-photo-picker"
          aria-label="Elegir foto de perfil"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {image ? <img src={image} alt="" /> : <span>{profileInitials(username)}</span>}
        </button>
        <div>
          <strong>{username}</strong>
          <div className="profile-photo-actions">
            <button className="secondary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Preparando foto…' : image ? 'Cambiar foto' : 'Añadir foto'}
            </button>
            {image && (
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setError('');
                  setBusy(true);
                  try {
                    await onImage(undefined);
                  } catch {
                    setError('No se pudo quitar la foto.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
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
        <button className="secondary" onClick={onAccount}>
          Cambiar cuenta
        </button>
        <button className="primary" disabled={busy} onClick={onClose}>
          Listo
        </button>
      </div>
    </>
  );
}
