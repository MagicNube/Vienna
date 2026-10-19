import { useId, useMemo, useState } from 'react';
import {
  accuracyEvolution,
  comparisonStatistics,
  resultStreaks,
  openingStatistics,
  phaseLabels,
  phaseStatistics,
  type InsightEntry,
} from '../review/statisticsInsights';

import { StatisticsTable } from './StatisticsTable';
import { Information } from './Information';
import { Icon } from './Icon';
import { openingReferences } from '../chess/openingReference';
import { openOpeningWindow } from './OpeningWindow';

const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);
const dateLabel = (date: number) =>
  new Date(date).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export function OpeningStatistics({
  entries,
  loading,
  onError,
}: {
  entries: InsightEntry[];
  loading: boolean;
  onError: (message: string) => void;
}) {
  const rows = useMemo(() => openingStatistics(entries), [entries]);
  return (
    <section className="statistics-card statistics-detail">
      <div className="statistics-card-heading">
        <h2>Tu repertorio</h2>
        <Information title="Sobre el repertorio">
          <p>
            Las variantes se agrupan por apertura y por tu color. La precisión incluye solo análisis
            completos.
          </p>
          <p>
            La información de cada apertura abre una línea de referencia del catálogo. Puede haber
            otros órdenes de jugadas que lleguen a la misma posición.
          </p>
        </Information>
      </div>
      {loading && (
        <p className="statistics-note" role="status">
          Actualizando análisis…
        </p>
      )}
      <StatisticsTable
        rows={rows}
        nameLabel="Aperturas"
        openingAction={(row) =>
          Object.hasOwn(openingReferences, row.name) ? (
            <button
              className="icon-button statistics-info"
              title={'Ver ' + row.name}
              aria-label={'Ver apertura ' + row.name + ' en otra ventana'}
              onClick={() => {
                void openOpeningWindow(row.name, row.color!).catch((error: unknown) =>
                  onError(error instanceof Error ? error.message : String(error)),
                );
              }}
            >
              <Icon name="info" size={17} />
            </button>
          ) : null
        }
      />
    </section>
  );
}

export function ComparisonStatistics({
  entries,
  loading,
}: {
  entries: InsightEntry[];
  loading: boolean;
}) {
  const groups = useMemo(
    () =>
      (['mode', 'color', 'rival'] as const).map((grouping) => ({
        grouping,
        rows: comparisonStatistics(entries, grouping),
      })),
    [entries],
  );
  const streaks = useMemo(() => resultStreaks(entries), [entries]);
  return (
    <div className="statistics-comparisons">
      <section className="statistics-card">
        <h2>Rachas</h2>
        <div className="statistics-streaks">
          <div>
            <span>Victorias seguidas</span>
            <strong>{streaks.bestWins}</strong>
            <small>Mejor racha</small>
          </div>
          <div>
            <span>Sin perder</span>
            <strong>{streaks.bestUnbeaten}</strong>
            <small>Mejor racha</small>
          </div>
          <div>
            <span>Victorias actuales</span>
            <strong>{streaks.currentWins}</strong>
          </div>
          <div>
            <span>Sin perder actualmente</span>
            <strong>{streaks.currentUnbeaten}</strong>
          </div>
        </div>
      </section>
      {loading && (
        <p className="statistics-note" role="status">
          Actualizando análisis…
        </p>
      )}
      {groups.map(({ grouping, rows }) => (
        <section className="statistics-card" key={grouping}>
          <h2>
            {grouping === 'mode' ? 'Por ritmo' : grouping === 'color' ? 'Por color' : 'Por rival'}
          </h2>
          <StatisticsTable
            rows={rows}
            nameLabel={
              grouping === 'mode' ? 'Ritmos' : grouping === 'color' ? 'Colores' : 'Rivales'
            }
            showBrilliant
          />
        </section>
      ))}
    </div>
  );
}

export function PhaseStatistics({ entries }: { entries: InsightEntry[] }) {
  const rows = phaseStatistics(entries);
  const available = rows.some((row) => row.moves > 0);
  const worst = rows
    .filter((row) => row.failureRate !== null && row.failureRate > 0)
    .sort((a, b) => b.failureRate! - a.failureRate!)[0];
  return (
    <>
      <div className="statistics-card-heading statistics-section-heading">
        <h2>Errores por fase</h2>
        <Information title="Cómo se dividen las fases">
          <p>
            Es una aproximación: apertura hasta la jugada 10; final cuando quedan como máximo 26
            puntos de piezas entre ambos bandos, sin contar peones ni reyes; medio juego en el
            resto. El final tiene prioridad incluso en posiciones importadas. Caballo y alfil valen
            3, torre 5 y dama 9.
          </p>
          <p>
            Los fallos incluyen imprecisiones, errores, graves errores y oportunidades perdidas. Se
            comparan por cada 100 jugadas para que las fases más largas no parezcan peores solo por
            durar más.
          </p>
        </Information>
      </div>
      {worst && (
        <p className="statistics-takeaway">
          Mayor frecuencia de fallos: <strong>{phaseLabels[worst.phase]}</strong>
          <span>
            {worst.failureRate!.toFixed(1)} por cada 100 jugadas en {worst.games}{' '}
            {worst.games === 1 ? 'partida' : 'partidas'}.
          </span>
        </p>
      )}
      <div className="statistics-phase-grid">
        {rows.map((row) => (
          <section className="statistics-card" key={row.phase}>
            <h2>{phaseLabels[row.phase]}</h2>
            <div className="phase-rate">
              <strong>{row.failureRate === null ? '—' : row.failureRate.toFixed(1)}</strong>
              <span>fallos por 100 jugadas</span>
            </div>
            <dl className="phase-counts">
              <div>
                <dt>Imprecisiones</dt>
                <dd>{row.inaccuracy}</dd>
              </div>
              <div>
                <dt>Errores</dt>
                <dd>{row.mistake}</dd>
              </div>
              <div>
                <dt>Graves errores</dt>
                <dd>{row.blunder}</dd>
              </div>
              <div>
                <dt>Oportunidades perdidas</dt>
                <dd>{row.miss}</dd>
              </div>
              <div>
                <dt>Precisión</dt>
                <dd>{percent(row.accuracy)}</dd>
              </div>
              <div>
                <dt>Jugadas / partidas</dt>
                <dd>
                  {row.moves} / {row.games}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      {!available && (
        <p className="statistics-note">Analiza alguna partida para ver tus errores por fase.</p>
      )}
    </>
  );
}

type EvolutionPoint = ReturnType<typeof accuracyEvolution>[number];
function EvolutionChart({
  points,
  metric,
}: {
  points: EvolutionPoint[];
  metric: 'accuracy' | 'failures';
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const maximum =
    metric === 'accuracy' ? 100 : points.reduce((max, point) => Math.max(max, point.failures), 1);
  const x = (index: number) =>
    points.length === 1 ? 360 : 38 + (index * 644) / (points.length - 1);
  const y = (value: number) => 174 - (value * 148) / maximum;
  const average = (point: EvolutionPoint) =>
    metric === 'accuracy' ? point.averageAccuracy : point.averageFailures;
  const value = (point: EvolutionPoint) =>
    metric === 'accuracy' ? point.accuracy : point.failures;
  const title = metric === 'accuracy' ? 'Precisión' : 'Fallos por partida';
  const active = hover === null ? undefined : points[hover];
  // Keep every point in both curves, with a bounded number of focusable markers.
  const markers = points
    .map((_, index) => index)
    .filter(
      (index) =>
        index % Math.max(1, Math.ceil(points.length / 100)) === 0 || index === points.length - 1,
    );
  return (
    <section className="statistics-card evolution-card">
      <h2>{title}</h2>
      <div className="evolution-chart">
        <svg
          viewBox="0 0 720 210"
          role="group"
          aria-label={`${title}, ${points.length} partidas en orden cronológico`}
        >
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1="38"
                x2="682"
                y1={y(maximum * fraction)}
                y2={y(maximum * fraction)}
                stroke="var(--border)"
              />
              <text x="30" y={y(maximum * fraction) + 4} textAnchor="end">
                {(maximum * fraction).toFixed(
                  metric === 'accuracy' || Number.isInteger(maximum * fraction) ? 0 : 1,
                )}
              </text>
            </g>
          ))}
          <polyline
            fill="none"
            stroke="var(--muted)"
            opacity=".55"
            strokeWidth="1.5"
            points={points.map((point, index) => `${x(index)},${y(value(point))}`).join(' ')}
          />
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            points={points.map((point, index) => `${x(index)},${y(average(point))}`).join(' ')}
          />
          {markers.map((index) => (
            <circle
              key={points[index].id}
              cx={x(index)}
              cy={y(value(points[index]))}
              r={hover === index ? 5 : 3}
              fill="var(--accent)"
              tabIndex={0}
              role="img"
              aria-label={`${dateLabel(points[index].date)}, contra ${points[index].rival}: ${metric === 'accuracy' ? percent(points[index].accuracy) : `${points[index].failures} fallos`}`}
              aria-describedby={hover === index ? id : undefined}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
            />
          ))}
          <text x="38" y="200">
            {dateLabel(points[0].date)}
          </text>
          <text x="682" y="200" textAnchor="end">
            {dateLabel(points.at(-1)!.date)}
          </text>
        </svg>
        <p id={id} className="evolution-readout" aria-live="polite">
          {active ? (
            <>
              {dateLabel(active.date)} <strong>{active.rival}</strong>
              <span>
                {metric === 'accuracy' ? percent(active.accuracy) : `${active.failures} fallos`}
              </span>
              <span>
                Media de {active.sample}:{' '}
                {metric === 'accuracy'
                  ? percent(active.averageAccuracy)
                  : active.averageFailures.toFixed(1)}
              </span>
            </>
          ) : (
            <>Línea verde: media de hasta 10 partidas. Línea tenue: cada partida.</>
          )}
        </p>
      </div>
    </section>
  );
}

export function EvolutionStatistics({ entries }: { entries: InsightEntry[] }) {
  const points = accuracyEvolution(entries);
  if (!points.length)
    return (
      <section className="statistics-card">
        <h2>Evolución</h2>
        <p className="statistics-note">
          Necesitas partidas analizadas con jugadas fuera del libro para ver tu evolución.
        </p>
      </section>
    );
  return (
    <>
      <p className="statistics-note">
        {points.length} {points.length === 1 ? 'partida analizada' : 'partidas analizadas'} con
        precisión estimada. Los fallos incluyen imprecisiones, errores, graves errores y
        oportunidades perdidas.
      </p>
      <div className="statistics-panels">
        <EvolutionChart
          key={`accuracy:${points.map((p) => p.id).join(',')}`}
          points={points}
          metric="accuracy"
        />
        <EvolutionChart
          key={`failures:${points.map((p) => p.id).join(',')}`}
          points={points}
          metric="failures"
        />
      </div>
      <section className="statistics-card statistics-detail evolution-recent">
        <h2>Últimas partidas del periodo</h2>
        <div className="statistics-table-wrap">
          <table className="statistics-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Rival</th>
                <th>Precisión</th>
                <th>Fallos</th>
              </tr>
            </thead>
            <tbody>
              {points
                .slice(-10)
                .reverse()
                .map((point) => (
                  <tr key={point.id}>
                    <td>{new Date(point.date).toLocaleDateString('es')}</td>
                    <th scope="row">{point.rival}</th>
                    <td>{percent(point.accuracy)}</td>
                    <td>{point.failures}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
