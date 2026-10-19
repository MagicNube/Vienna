import { availableAnalysisLevels } from '../review/analysisLevel';

export function AnalysisLevelPicker({
  value,
  onChange,
  times = [],
  disabled = false,
  label = 'Nivel de análisis',
  name = 'analysis-level',
}: {
  value: number;
  onChange: (value: number) => void;
  times?: number[];
  disabled?: boolean;
  label?: string;
  name?: string;
}) {
  return (
    <fieldset className="analysis-level" aria-label={label} disabled={disabled}>
      {availableAnalysisLevels(...times, value).map((level) => (
        <label key={level.value} title={`${level.name} (${level.time})`}>
          <span>{level.name}</span>
          <span className="analysis-level-choice">
            <input
              type="radio"
              name={name}
              value={level.value}
              checked={value === level.value}
              onChange={() => onChange(level.value)}
              aria-label={`${level.name} (${level.time})`}
            />
            <span>{level.time}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
