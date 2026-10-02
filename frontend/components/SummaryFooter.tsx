import type { MoveReview, PositionNode } from '../types';
import type { CategoryTour } from '../review/categoryTour';
import { categories } from '../review/classification';
import { spanishSan } from '../chess/game';
import { Icon } from './Icon';
import { MoveSymbol } from './MoveSymbol';

export function SummaryFooter({
  tab,
  tour,
  node,
  move,
  onReturn,
}: {
  tab: 'moves' | 'review';
  tour: CategoryTour | null;
  node: PositionNode;
  move?: MoveReview;
  onReturn: () => void;
}) {
  return (
    <div className="summary-footer">
      <div className="summary-insight-header">
        <div className="summary-insight-title">
          <span className={`insight-icon badge ${move?.category ?? ''}`}>
            {move ? <MoveSymbol category={move.category} /> : <Icon name="board" size={16} />}
          </span>
          <div>
            <strong>{node.san ? spanishSan(node.san) : 'Posición inicial'}</strong>
            {node.san && <span>{move ? categories[move.category].label : 'Sin evaluar'}</span>}
          </div>
        </div>
        {tab === 'review' && tour && (
          <div className="category-return">
            <span role="status">
              {tour.color && <span>{tour.color === 'w' ? 'Blancas' : 'Negras'}</span>}
              <strong>
                {tour.index + 1}/{tour.total}
              </strong>
            </span>
            <button aria-label="Volver a mi posición" onClick={onReturn}>
              <Icon name="left" size={14} /> Volver
            </button>
          </div>
        )}
      </div>
      <div className="summary-insight-body">
        <p>
          {move?.explanation ??
            (node.san
              ? 'Esta jugada todavía no tiene valoración.'
              : 'Selecciona una jugada para ver su valoración.')}
        </p>
      </div>
    </div>
  );
}
