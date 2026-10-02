import { pvSan } from '../chess/game';
import { score } from '../engine/EngineService';
import { playedLine } from '../engine/playedLine';
import { evaluationSide, evaluationDescription } from '../engine/evaluation';
import { Icon } from './Icon';
import { ReadableMove } from './ReadableMove';
import { useLayoutEffect, useRef, useState } from 'react';
import type { EngineLine, GameTree, PositionNode, Review } from '../types';

export function Continuations({
  tree,
  node,
  review,
  lines,
  busy,
  freeMode,
  onMove,
  onSelect,
  onPreview,
}: {
  tree: GameTree;
  node: PositionNode;
  review: Review | null;
  lines: EngineLine[];
  busy: boolean;
  freeMode: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  onSelect: (id: string) => void;
  onPreview: (line: EngineLine | null) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const panel = ref.current!;
    const measure = () => setCompact(panel.clientHeight < 420);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  const played = freeMode ? null : playedLine(tree, node, review, lines);
  function row(line: EngineLine, index: number, actual = false) {
    const preview = actual ? { ...line, rank: 0 } : line;
    return (
      <button
        className={`pv-line ${actual ? 'played-line' : ''}`}
        key={actual ? 'played' : line.rank}
        disabled={!line.pv[0]}
        onMouseEnter={() => onPreview(preview)}
        onMouseLeave={() => onPreview(null)}
        onFocus={() => onPreview(preview)}
        onBlur={() => onPreview(null)}
        onClick={() =>
          actual && played
            ? onSelect(played.node.id)
            : onMove(line.pv[0].slice(0, 2), line.pv[0].slice(2, 4), line.pv[0][4])
        }
        title={actual ? 'Ver la jugada de la partida' : 'Probar esta continuación'}
      >
        <span
          className={`pv-score evaluation-tone ${evaluationSide(line) ?? 'balanced'}`}
          title={evaluationDescription(line)}
        >
          {score(line)}
        </span>
        <span className="pv-moves">
          <span className="pv-first">
            <strong>
              {index === 0 && !actual && (
                <span
                  className="pv-best"
                  role="img"
                  aria-label="Mejor opción del motor"
                  title="Mejor opción del motor"
                >
                  ★
                </span>
              )}
              {pvSan(node.fen, line.pv, 1)[0]?.replace(/^(\d+)[.…]/, '$1. ') ??
                (line.mate !== null ? 'Jaque mate' : 'Tablas')}
            </strong>
            <span className="pv-depth">Prof. {line.depth}</span>
          </span>
          <small>
            {pvSan(node.fen, line.pv, compact ? 4 : 6)
              .slice(1)
              .map((move) => move.replace(/^(\d+)\./, '$1. '))
              .join(' ') || 'Fin de la línea'}
          </small>
          {actual && played?.posterior && (
            <span className="pv-posterior">Evaluación posterior</span>
          )}
        </span>
      </button>
    );
  }
  return (
    <aside
      ref={ref}
      className={`continuations-panel ${compact ? 'compact' : ''}`}
      aria-label="Continuaciones del motor"
    >
      <header>
        <h2 className="card-title">Continuaciones</h2>
        <span>{node.fen.split(' ')[1] === 'w' ? 'Juegan blancas' : 'Juegan negras'}</span>
      </header>
      <div className="engine-lines">
        {played && (
          <section className="played-continuation" aria-label="Jugada realizada en esta posición">
            <h3>
              <Icon name="played-move" size={16} />
              Jugada de la partida
            </h3>
            {played.line ? (
              row(played.line, -1, true)
            ) : (
              <button className="unrated-played" onClick={() => onSelect(played.node.id)}>
                <ReadableMove node={played.node} />
                <span>Sin evaluar</span>
              </button>
            )}
          </section>
        )}
        <section className="engine-options" aria-label="Opciones del motor">
          {played && <h3>Opciones del motor</h3>}
          {lines.length ? (
            lines.slice(0, 4).map((line, index) => row(line, index))
          ) : (
            <p className="engine-empty">
              {busy ? 'Calculando…' : 'Sin continuaciones disponibles'}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
