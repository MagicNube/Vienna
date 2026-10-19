import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { stopChessSound } from '../audio/chessSounds';
import { SoundPicker } from './SoundPicker';
import { AnalysisLevelPicker } from './AnalysisLevelPicker';
import { StorageSettings } from './StorageSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { HelpSettings, type FeedbackAction } from './HelpSettings';
import {
  applyProcessingProfile,
  selectedProcessingProfile,
  processingProfiles,
  processingKeys,
} from '../engine/processingProfiles';
export function SettingsPanel({
  settings,
  onChange,
  protectedIds,
  onStorageCleaned,
  cpus = 4,
  initialReport,
  onFeedbackAction,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  protectedIds: string[];
  onStorageCleaned: (ids: string[], cache: boolean) => Promise<void>;
  cpus?: number;
  initialReport?: string;
  onFeedbackAction?: (action: FeedbackAction) => void;
}) {
  const [tab, setTab] = useState<'engine' | 'board' | 'appearance' | 'storage' | 'help'>(
    initialReport ? 'help' : 'engine',
  );
  const latest = useRef(settings);
  latest.current = settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({
      ...latest.current,
      [key]: value,
      ...(processingKeys.some((processingKey) => processingKey === key)
        ? { processingProfile: 'custom' as const }
        : {}),
    });
  const profile = selectedProcessingProfile(settings, cpus);
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
        <button
          id="appearance-settings-tab"
          role="tab"
          aria-selected={tab === 'appearance'}
          aria-controls="settings-content"
          onClick={() => setTab('appearance')}
        >
          Apariencia
        </button>
        <button
          id="storage-settings-tab"
          role="tab"
          aria-selected={tab === 'storage'}
          aria-controls="settings-content"
          onClick={() => setTab('storage')}
        >
          Espacio
        </button>
        <button
          id="help-settings-tab"
          role="tab"
          aria-selected={tab === 'help'}
          aria-controls="settings-content"
          onClick={() => setTab('help')}
        >
          Ayuda
        </button>
      </div>
      <div
        className="settings-tab-body"
        role="tabpanel"
        id="settings-content"
        aria-labelledby={`${tab}-settings-tab`}
      >
        {tab === 'engine' ? (
          <>
            <div className="settings-engine-heading">
              <span>Stockfish 19</span>
            </div>
            <fieldset className="processing-profile" aria-label="Perfil de procesamiento">
              {[...processingProfiles, { id: 'custom' as const, label: 'Personalizado' }].map(
                (option) => (
                  <label
                    key={option.id}
                    title={
                      option.id === 'custom'
                        ? 'Conserva tus valores y permite combinarlos libremente'
                        : 'Configura recursos, profundidad y tiempos; adapta los hilos a tu equipo'
                    }
                  >
                    <input
                      type="radio"
                      name="processing-profile"
                      value={option.id}
                      checked={profile === option.id}
                      aria-label={option.label}
                      onChange={() =>
                        onChange(applyProcessingProfile(latest.current, option.id, cpus))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ),
              )}
            </fieldset>
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
              <label
                className="toggle-row"
                title="Comprueba cada 5 minutos y analiza las partidas nuevas en cola."
              >
                <span>Analizar nuevas partidas automáticamente</span>
                <input
                  type="checkbox"
                  checked={settings.autoReview}
                  onChange={(e) => set('autoReview', e.target.checked)}
                />
              </label>
              <div>
                <span className="settings-level-heading">Nivel automático</span>
                <AnalysisLevelPicker
                  value={settings.autoReviewTime}
                  onChange={(value) => set('autoReviewTime', value)}
                  disabled={!settings.autoReview}
                  label="Nivel automático"
                  name="automatic-analysis-level"
                />
              </div>
            </section>
          </>
        ) : tab === 'help' ? null : tab === 'appearance' ? (
          <AppearanceSettings settings={settings} onChange={onChange} />
        ) : tab === 'storage' ? (
          <StorageSettings protectedIds={protectedIds} onCleaned={onStorageCleaned} />
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
                  ['secondArrow', 'Flecha de la segunda mejor jugada'],
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
            </div>
          </div>
        )}
        <div hidden={tab !== 'help'}>
          <HelpSettings
            initialReport={initialReport}
            active={tab === 'help'}
            onActionChange={onFeedbackAction}
          />
        </div>
      </div>
    </div>
  );
}
