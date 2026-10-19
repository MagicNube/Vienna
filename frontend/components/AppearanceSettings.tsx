import type { Settings } from '../types';

export function AppearanceSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <div className="appearance-settings">
      <fieldset className="theme-options">
        <legend>Tema</legend>
        {(
          [
            ['vienna', 'Vienna'],
            ['walnut', 'Bird'],
          ] as const
        ).map(([id, label]) => (
          <label className="theme-option" key={id}>
            <span className="theme-preview" data-appearance={id} aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} className={(Math.floor(i / 4) + i) % 2 ? 'light' : 'dark'} />
              ))}
            </span>
            <span className="theme-option-name">
              <input
                type="radio"
                name="appearance-theme"
                checked={(settings.appearance ?? 'vienna') === id}
                onChange={() => onChange({ ...settings, appearance: id })}
              />
              {label}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="density-options">
        <legend>Densidad</legend>
        {(
          [
            ['comfortable', 'Cómoda', 'Espacios habituales'],
            ['compact', 'Compacta', 'Más contenido en pantalla'],
          ] as const
        ).map(([id, label, detail]) => (
          <label key={id}>
            <input
              type="radio"
              name="appearance-density"
              checked={(settings.density ?? 'comfortable') === id}
              onChange={() => onChange({ ...settings, density: id })}
            />
            <span>
              {label}
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
