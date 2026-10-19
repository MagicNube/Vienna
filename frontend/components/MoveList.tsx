import { useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { spanishSan } from '../chess/game';
import { categories } from '../review/classification';
import type { GameTree, PositionNode, Review, MoveReview } from '../types';
import { Icon } from './Icon';
import { MoveSymbol } from './MoveSymbol';

export function MoveList({
  tree,
  nodeId,
  review,
  onSelect,
  onImport,
  line,
  ratings,
}: {
  tree: GameTree;
  nodeId: string;
  review: Review | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  line?: PositionNode[];
  ratings?: Record<string, MoveReview | undefined>;
}) {
  const active = useRef<HTMLButtonElement | null>(null);
  const scroll = useRef<HTMLDivElement | null>(null);
  const rows = new Map<number, { white?: PositionNode; black?: PositionNode }>();
  for (const node of line ?? tree.nodes.filter((n) => n.main && n.parent)) {
    const after = new Chess(node.fen);
    const color = after.turn() === 'b' ? 'white' : 'black';
    const number = after.moveNumber() - (color === 'black' ? 1 : 0);
    const row = rows.get(number) ?? {};
    row[color] = node;
    rows.set(number, row);
  }
  useEffect(() => {
    // Scroll only the move list: keyboard navigation must never shift the whole page.
    const button = active.current,
      container = scroll.current;
    if (!button || !container) return;
    const b = button.getBoundingClientRect(),
      c = container.getBoundingClientRect();
    if (b.top < c.top) container.scrollTop += b.top - c.top;
    else if (b.bottom > c.bottom) container.scrollTop += b.bottom - c.bottom;
  }, [nodeId]);
  return (
    <>
      <div className="move-list" ref={scroll}>
        {rows.size ? (
          [...rows].map(([number, row]) => (
            <div className="move-row" key={number}>
              <span>{number}.</span>
              {(['white', 'black'] as const).map((color) => {
                const node = row[color];
                if (!node) return <span key={color} />;
                const move = ratings?.[node.id] ?? review?.moves.find((m) => m.ply === node.ply);
                return (
                  <button
                    key={color}
                    ref={node.id === nodeId ? active : undefined}
                    className={node.id === nodeId ? 'current' : ''}
                    onClick={() => onSelect(node.id)}
                  >
                    <span>{spanishSan(node.san)}</span>
                    {move && (
                      <span
                        className={`badge ${move.category}`}
                        title={categories[move.category].label}
                        aria-label={categories[move.category].label}
                      >
                        <MoveSymbol category={move.category} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          <div className="empty-moves">
            <Icon name="board" size={32} />
            <p>Sin movimientos</p>
            <span>
              {line
                ? 'Mueve una pieza para comenzar.'
                : 'Importa un PGN para ver los movimientos.'}
            </span>
            {!line && (
              <button onClick={onImport}>
                Cargar una partida <Icon name="right" size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
