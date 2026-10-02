import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { stopChessSound } from '../audio/chessSounds';
import { SoundPicker } from './SoundPicker';
export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const [tab, setTab] = useState<'engine' | 'board'>('engine');
  const latest = useRef(settings);
  latest.current = settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...latest.current, [key]: value });
  return (
    <div className="settings-panel">
      <div className="settings-tabs" role="tablist" aria-label="Secciones de ajustes">
        <button
          id="engine-settings-tab"
          role="tab"
          aria-selected={tab === 'engine'}
          aria-controls="settings-content"
          onClick={() => setTab('engine')}
        >
          Procesamiento
        </button>
        <button
          id="board-settings-tab"
          role="tab"
          aria-selected={tab === 'board'}
          aria-controls="settings-content"
          onClick={() => setTab('board')}
        >
          Sonido y tablero
        </button>
      </div>
      <div
        className="settings-tab-body"
        role="tabpanel"
        id="settings-content"
        aria-labelledby={tab === 'engine' ? 'engine-settings-tab' : 'board-settings-tab'}
      >
        {tab === 'engine' ? (
          <>
            <div className="settings-engine-heading">
              <span>Stockfish 19</span>
              <button
                className="secondary"
                title="8 hilos, 512 MB, 4 líneas, 2 s interactivo y 5 s por posición"
                onClick={() =>
                  onChange({
                    ...settings,
                    threads: 8,
                    hash: 512,
                    multiPv: 4,
                    interactiveTime: 2000,
                    reviewTime: 5000,
                    autoReviewTime: 5000,
                    depth: null,
                  })
                }
              >
                Perfil Ryzen 9800X3D
              </button>
            </div>
            <div className="settings-grid">
              <label>
                Hilos
                <select value={settings.threads} onChange={(e) => set('threads', +e.target.value)}>
                  {[...new Set([0, 1, 2, 4, 8, 16, 32, settings.threads])].map((n) => (
                    <option key={n} value={n}>
                      {n || 'Automático'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Memoria Hash
                <select value={settings.hash} onChange={(e) => set('hash', +e.target.value)}>
                  {[...new Set([64, 128, 256, 512, 1024, 2048, settings.hash])]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} MB
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Líneas simultáneas
                <select value={settings.multiPv} onChange={(e) => set('multiPv', +e.target.value)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'línea' : 'líneas'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Análisis interactivo
                <select
                  value={settings.interactiveTime}
                  onChange={(e) => set('interactiveTime', +e.target.value)}
                >
                  {[...new Set([150, 500, 1000, 2000, 5000, 0, settings.interactiveTime])].map(
                    (n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Sin límite' : n < 1000 ? n + ' ms' : n / 1000 + ' s'}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Profundidad máxima
                <input
                  type="number"
                  min="1"
                  max="128"
                  placeholder="Sin límite"
                  value={settings.depth ?? ''}
                  onChange={(e) =>
                    set(
                      'depth',
                      e.target.value ? Math.max(1, Math.min(128, +e.target.value)) : null,
                    )
                  }
                />
              </label>
              <label>
                Tiempo por posición (ms)
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={settings.reviewTime}
                  onChange={(e) => set('reviewTime', Math.max(50, +e.target.value))}
                />
              </label>
            </div>
            <section className="settings-auto-review">
              <label className="toggle-row">
                <span>Analizar nuevas partidas automáticamente</span>
                <input
                  type="checkbox"
                  checked={settings.autoReview}
                  onChange={(e) => set('autoReview', e.target.checked)}
                />
              </label>
              <div>
                <p>Comprueba cada 5 minutos y analiza las partidas nuevas en cola.</p>
                <label>
                  Nivel automático
                  <select
                    disabled={!settings.autoReview}
                    value={settings.autoReviewTime}
                    onChange={(e) => set('autoReviewTime', +e.target.value)}
                  >
                    <option value={150}>Rápido (150 ms)</option>
                    <option value={500}>Normal (500 ms)</option>
                    <option value={2000}>Profundo (2 s)</option>
                    <option value={5000}>Máximo (5 s)</option>
                    {![150, 500, 2000, 5000].includes(settings.autoReviewTime) && (
                      <option value={settings.autoReviewTime}>
                        Personalizado ({settings.autoReviewTime} ms)
                      </option>
                    )}
                  </select>
                </label>
              </div>
            </section>
          </>
        ) : (
          <div className="settings-board">
            <section className="sound-settings">
              <label className="toggle-row">
                Sonidos del tablero
                <input
                  type="checkbox"
                  checked={settings.sounds}
                  onChange={(e) => {
                    set('sounds', e.target.checked);
                    if (!e.target.checked) stopChessSound();
                  }}
                />
              </label>
              <label>
                Volumen / {Math.round(settings.soundVolume * 100)} %
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.soundVolume * 100}
                  disabled={!settings.sounds}
                  onChange={(e) => set('soundVolume', +e.target.value / 100)}
                />
              </label>
              <SoundPicker
                settings={settings}
                onCustom={(sound, value) => {
                  const custom = { ...latest.current.customSounds };
                  if (value) custom[sound] = value;
                  else delete custom[sound];
                  set('customSounds', custom);
                }}
              />
            </section>
            <div className="settings-display-options">
              {(
                [
                  ['arrows', 'Flecha de la mejor jugada'],
                  ['secondArrow', 'Segunda flecha más tenue'],
                  ['evaluation', 'Barra de evaluación'],
                ] as const
              ).map(([key, label]) => (
                <label className="toggle-row" key={key}>
                  {label}
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                </label>
              ))}
              <label>
                Tema
                <select
                  value={settings.theme}
                  onChange={(e) => set('theme', e.target.value as Settings['theme'])}
                >
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
