import { useEffect, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { legalDests, spanishSan } from '../chess/game';
import { categories } from '../review/classification';
import { MoveSymbol } from './MoveSymbol';
import { arrowBrushes, engineArrows, isInitialPosition } from '../engine/lines';
import type { Category, EngineLine, PositionNode } from '../types';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
export function Board({
  node,
  orientation,
  lines,
  arrows,
  secondArrow,
  category,
  onMove,
  interactive = true,
  previewMove,
}: {
  node: PositionNode;
  orientation: 'w' | 'b';
  lines: EngineLine[];
  arrows: boolean;
  secondArrow: boolean;
  category?: Category;
  onMove: (from: string, to: string, promotion?: string) => void;
  interactive?: boolean;
  previewMove?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const callback = useRef(onMove);
  callback.current = onMove;
  const current = useRef(node);
  current.current = node;
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      coordinates: true,
      coordinatesOnSquares: false,
      disableContextMenu: true,
      animation: {
        enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: 140,
      },
      movable: {
        free: false,
        events: {
          after: (from, to) => {
            const c = new Chess(current.current.fen);
            const piece = c.get(from as Square);
            if (piece?.type === 'p' && (to[1] === '1' || to[1] === '8')) {
              setPromotion({ from, to });
              api.current?.set({ fen: current.current.fen });
              return;
            }
            callback.current(from, to);
          },
        },
      },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      drawable: {
        enabled: true,
        visible: true,
        brushes: arrowBrushes,
        onChange: (shapes) => {
          // Retain native toggle/clear behavior and arrows; paint square annotations
          // underneath the pieces. The corresponding SVG circles are hidden in CSS.
          api.current?.set({
            highlight: {
              custom: new Map(
                shapes
                  .filter((shape) => !shape.dest)
                  .map((shape) => [shape.orig, 'annotation-orange']),
              ),
            },
          });
        },
      },
    });
    return () => api.current?.destroy();
  }, []);
  useEffect(() => {
    const c = new Chess(node.fen);
    setPromotion(null);
    api.current?.set({
      fen: node.fen,
      orientation: orientation === 'w' ? 'white' : 'black',
      turnColor: c.turn() === 'w' ? 'white' : 'black',
      check: c.isCheck(),
      highlight: { custom: new Map() },
      lastMove: node.uci ? [node.uci.slice(0, 2) as Key, node.uci.slice(2, 4) as Key] : [],
      movable: {
        color: interactive ? (c.turn() === 'w' ? 'white' : 'black') : undefined,
        dests: interactive ? legalDests(node.fen) : new Map(),
      },
    });
    api.current?.setShapes([]);
  }, [node, orientation, interactive]);
  useEffect(() => {
    api.current?.setAutoShapes(
      isInitialPosition(node) ? [] : engineArrows(lines, arrows, secondArrow, previewMove),
    );
  }, [lines, arrows, secondArrow, previewMove, node]);
  const destination = node.uci?.slice(2, 4);
  const file = destination ? destination.charCodeAt(0) - 97 : 0;
  const rank = destination ? Number(destination[1]) - 1 : 0;
  const column = orientation === 'w' ? file : 7 - file;
  const row = orientation === 'w' ? 7 - rank : rank;
  return (
    <>
      <div className="board-shell">
        <div
          ref={el}
          className="chessboard"
          aria-label={`Tablero. Juegan ${node.fen.split(' ')[1] === 'w' ? 'blancas' : 'negras'}`}
        />
        {destination && category && !promotion && (
          <div
            className="board-move-marker"
            style={{ left: `${(column + 1) * 12.5}%`, top: `${row * 12.5}%` }}
            aria-label={`${spanishSan(node.san)}${category ? `: ${categories[category].label}` : ''}`}
          >
            <span className={`badge ${category}`} title={categories[category].label}>
              <MoveSymbol category={category} />
            </span>
          </div>
        )}
        {promotion && (
          <div className="promotion" role="dialog" aria-label="Elige una pieza para promocionar">
            <strong>Promocionar a</strong>
            <div>
              {[
                ['q', 'Dama'],
                ['r', 'Torre'],
                ['b', 'Alfil'],
                ['n', 'Caballo'],
              ].map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => {
                    onMove(promotion.from, promotion.to, p);
                    setPromotion(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setPromotion(null)}>Cancelar</button>
          </div>
        )}
      </div>
    </>
  );
}
