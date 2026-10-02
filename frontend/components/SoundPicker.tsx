import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { playChessSound, stopChessSound, type ChessSound } from '../audio/chessSounds';
import { customSound } from '../audio/customSound';
import { Icon } from './Icon';
const effects: [ChessSound, string][] = [
  ['move', 'Movimiento'],
  ['capture', 'Captura'],
  ['check', 'Jaque'],
  ['mate', 'Mate'],
];
export function SoundPicker({
  settings,
  onCustom,
}: {
  settings: Settings;
  onCustom: (kind: ChessSound, value?: { name: string; data: string }) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const kind = useRef<ChessSound>('move');
  const [busy, setBusy] = useState<ChessSound | null>(null);
  const [error, setError] = useState('');
  return (
    <>
      <div className="sound-files">
        {effects.map(([sound, label]) => (
          <div className="sound-file" key={sound}>
            <div>
              <strong>{label}</strong>
              <span title={settings.customSounds?.[sound]?.name}>
                {busy === sound
                  ? 'Preparando…'
                  : (settings.customSounds?.[sound]?.name ?? 'Predeterminado')}
              </span>
            </div>
            <button
              className="secondary sound-preview"
              disabled={!settings.sounds || !!busy}
              aria-label={'Probar sonido de ' + label.toLowerCase()}
              onClick={() =>
                void playChessSound(sound, settings.soundVolume, settings.customSounds)
              }
            >
              <Icon name="play" size={15} />
            </button>
            <button
              className="secondary"
              disabled={!!busy}
              aria-label={'Cargar sonido de ' + label.toLowerCase()}
              onClick={() => {
                kind.current = sound;
                input.current?.click();
              }}
            >
              Cargar
            </button>
            <button
              className="secondary sound-reset"
              disabled={!!busy || !settings.customSounds?.[sound]}
              aria-label={'Restaurar sonido de ' + label.toLowerCase()}
              title="Restaurar predeterminado"
              onClick={() => {
                stopChessSound();
                onCustom(sound);
                setError('');
              }}
            >
              <Icon name="undo" size={16} />
            </button>
          </div>
        ))}
      </div>
      <p className="sound-format">MP3, WAV u OGG. Hasta 3 s y 2 MB.</p>
      {error && (
        <p className="sound-file-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
        aria-label="Archivo de sonido"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (!file) return;
          const sound = kind.current;
          setBusy(sound);
          setError('');
          try {
            const value = await customSound(file);
            stopChessSound();
            onCustom(sound, value);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo preparar el sonido.');
          } finally {
            setBusy(null);
          }
        }}
      />
    </>
  );
}
