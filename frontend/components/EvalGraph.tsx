import { categories } from '../review/classification';
import { score, expected } from '../engine/EngineService';
import { playerColor } from '../chess/game';
import { evaluationSide } from '../engine/evaluation';
import { evaluationStats, evaluationStatLabel } from '../review/evaluationStats';
import type { Game, Review } from '../types';
import { useLayoutEffect, useRef, useState } from 'react';
export function EvalGraph({
  review,
  total,
  ply,
  onSelect,
  game,
  username,
  showTitle = true,
}: {
  review: Review | null;
  total: number;
  ply: number;
  onSelect: (ply: number) => void;
  game?: Game;
  username: string;
  showTitle?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [{ width, height }, setSize] = useState({ width: 680, height: 140 });
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      setSize((previous) =>
        previous.width === bounds.width && previous.height === bounds.height
          ? previous
          : { width: bounds.width, height: bounds.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg.parentElement!);
    return () => observer.disconnect();
  }, []);
  const color = playerColor(game, username);
  const ownGame =
    !!username.trim() &&
    [game?.white, game?.black].some(
      (player) => player?.toLowerCase() === username.trim().toLowerCase(),
    );
  const statistics = evaluationStats(review, total, 'w');
  const ownStatistics = evaluationStats(review, total, color);
  const entries = Array.from({ length: total }, (_, i) => ({
    i,
    line: review?.positions[`m${i}`]?.lines[0],
  })).filter((p) => p.line);
  const x = (i: number) => 8 + (i / Math.max(1, total - 1)) * (width - 16);
  const y = (i: number) => {
    const l = review!.positions[`m${i}`].lines[0];
    const v = l.mate !== null ? (expected(l, 'w') >= 0.5 ? 6 : -6) : (l.cp ?? 0) / 100;
    return height / 2 - Math.max(-6, Math.min(6, v)) * ((height - 20) / 12);
  };
  const d = entries.map(({ i }, j) => `${j ? 'L' : 'M'}${x(i)},${y(i)}`).join(' ');
  const active = entries.find(({ i }) => i === hovered);
  return (
    <section className="eval-card">
      {showTitle && (
        <header className="evaluation-header">
          <h2 className="card-title">Evaluación</h2>
          <span>{entries.length ? '' : 'Sin analizar'}</span>
        </header>
      )}
      <div
        className={`graph-player ${game?.white.toLowerCase() === username.toLowerCase() ? 'self' : ''}`}
      >
        <i className="move-color w" />
        {game?.white ?? 'Blancas'}
        <span>↑</span>
      </div>
      <div className="graph-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label="Gráfico de evaluación desde el punto de vista de blancas"
        >
          <defs>
            <clipPath id="top">
              <rect width={width} height={height / 2} />
            </clipPath>
            <clipPath id="bottom">
              <rect y={height / 2} width={width} height={height / 2} />
            </clipPath>
          </defs>
          <line
            x1="0"
            x2={width}
            y1={height / 2}
            y2={height / 2}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          {d && (
            <>
              <path
                d={`${d} L${x(entries.at(-1)!.i)},${height / 2} L${x(entries[0].i)},${height / 2} Z`}
                fill="var(--accent)"
                opacity=".14"
                clipPath="url(#top)"
              />
              <path
                d={`${d} L${x(entries.at(-1)!.i)},${height / 2} L${x(entries[0].i)},${height / 2} Z`}
                fill="#888"
                opacity=".15"
                clipPath="url(#bottom)"
              />
              <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
            </>
          )}
          {entries.map(({ i, line }) => (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Jugada ${i}, blancas ${score(line)}`}
              aria-describedby={hovered === i ? 'evaluation-tooltip' : undefined}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(i);
                }
              }}
            >
              <rect
                x={x(i) - (width - 16) / Math.max(1, total - 1) / 2}
                y="0"
                width={(width - 16) / Math.max(1, total - 1)}
                height={height}
                fill="transparent"
              />
              <circle
                pointerEvents="none"
                className={ply === i ? 'selected-position' : undefined}
                cx={x(i)}
                cy={y(i)}
                r={
                  review?.moves[i - 1] &&
                  ['blunder', 'mistake', 'brilliant', 'inaccuracy'].includes(
                    review.moves[i - 1].category,
                  )
                    ? 2.5
                    : 1.25
                }
                fill={
                  review?.moves[i - 1]
                    ? categories[review.moves[i - 1].category].color
                    : 'var(--accent)'
                }
              />
            </g>
          ))}
        </svg>
        {active && (
          <div
            id="evaluation-tooltip"
            role="tooltip"
            className="graph-tooltip"
            style={{ left: `${Math.max(22, Math.min(78, (x(active.i) / width) * 100))}%` }}
          >
            {active.i === 0 ? 'Inicio' : `Jugada ${Math.ceil(active.i / 2)}`}
            <strong>Blancas {score(active.line)}</strong>
          </div>
        )}
        {!entries.length && (
          <p className="graph-empty">Analiza la partida para ver la evaluación.</p>
        )}
      </div>
      <div
        className={`graph-player ${game?.black.toLowerCase() === username.toLowerCase() ? 'self' : ''}`}
      >
        <i className="move-color b" />
        {game?.black ?? 'Negras'}
        <span>↓</span>
      </div>
      {statistics && (
        <div className="evaluation-summary">
          <span className="evaluation-perspective">+ Blancas / − Negras</span>
          <div className="evaluation-extremes">
            {(['minimum', 'maximum'] as const).map((key) => {
              const entry = statistics[key];
              const label = key === 'minimum' ? 'Mínimo' : 'Máximo';
              if (!entry)
                return (
                  <div
                    key={key}
                    title="Sin evaluaciones numéricas; las posiciones de mate no cuentan como extremos."
                  >
                    <span>{label}</span>
                    <strong>—</strong>
                  </div>
                );
              const position = entry.ply
                ? `jugada ${Math.ceil(entry.ply / 2)}${entry.ply % 2 ? ', blancas' : ', negras'}`
                : 'inicio';
              return (
                <button
                  key={key}
                  className={`evaluation-tone ${evaluationSide(entry.line) ?? 'balanced'}`}
                  onClick={() => onSelect(entry.ply)}
                  title={`Ir al ${label.toLowerCase()}: ${position}. Sin contar posiciones de mate.`}
                >
                  <span>{label}</span>
                  <strong>{evaluationStatLabel(entry.line, 'w')}</strong>
                </button>
              );
            })}
            <div
              className={`evaluation-tone ${color}`}
              title={`Porcentaje de posiciones con ventaja de al menos medio peón para ${color === 'w' ? 'blancas' : 'negras'}, incluyendo mates a favor.`}
            >
              <span>
                {ownGame ? 'Tu ventaja' : `Ventaja ${color === 'w' ? 'blanca' : 'negra'}`}
              </span>
              <strong>{ownStatistics!.advantage}%</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
