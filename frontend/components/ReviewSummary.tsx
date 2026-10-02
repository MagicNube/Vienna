import type { Category, Game, Review } from '../types';
import { accuracy, categories } from '../review/classification';
import { MoveSymbol } from './MoveSymbol';
export function ReviewSummary({
  review,
  game,
  onCategory,
  activeCategory,
  activeColor,
  categoryProgress,
}: {
  review: Review;
  game: Game;
  onCategory: (category: Category, color?: 'w' | 'b') => void;
  activeCategory?: Category;
  activeColor?: 'w' | 'b';
  categoryProgress?: { index: number; total: number };
}) {
  if (!review.complete)
    return <p className="review-pending">El resumen estará disponible al terminar el análisis.</p>;
  const white = review.moves.filter((m) => m.color === 'w'),
    black = review.moves.filter((m) => m.color === 'b');
  return (
    <div className="review-summary">
      <div className="accuracy-row">
        {[
          { name: game.white, moves: white },
          { name: game.black, moves: black },
        ].map(({ name, moves }, i) => {
          const value = accuracy(moves);
          return (
            <div key={i} className={i ? 'accuracy-black' : 'accuracy-white'}>
              <span title={name}>{name}</span>
              {value === null ? (
                <div className="accuracy-empty">
                  {!review.complete ? 'Pendiente' : moves.length ? 'Solo libro' : 'Sin datos'}
                </div>
              ) : (
                <strong>
                  {value.toFixed(1)}
                  <small>%</small>
                </strong>
              )}
              <span aria-label={`Precisión ${i ? 'negras' : 'blancas'}`}>Precisión</span>
            </div>
          );
        })}
      </div>
      <div className="category-table">
        <div className="category-head">
          <span>Categoría</span>
          <span>Blancas</span>
          <span>Negras</span>
        </div>
        {(Object.keys(categories) as Category[]).map((key) => (
          <div className="category-row" key={key}>
            <button
              disabled={!review.moves.some((m) => m.category === key)}
              aria-pressed={activeCategory === key && !activeColor}
              aria-label={`Ver ${categories[key].label}: ${review.moves.filter((m) => m.category === key).length} jugadas`}
              onClick={() => onCategory(key)}
            >
              <span>
                <b className={`badge ${key}`}>
                  <MoveSymbol category={key} />
                </b>
                <span className="category-name">
                  {categories[key].label}
                  {activeCategory === key && !activeColor && categoryProgress && (
                    <small className="category-cycle-count">
                      {categoryProgress.index + 1}/{categoryProgress.total}
                    </small>
                  )}
                </span>
              </span>
            </button>
            {(['w', 'b'] as const).map((color) => {
              const count = review.moves.filter(
                (m) => m.category === key && m.color === color,
              ).length;
              return (
                <button
                  key={color}
                  disabled={!count}
                  aria-label={`${categories[key].label}, ${color === 'w' ? 'blancas' : 'negras'}: ${count} jugadas`}
                  aria-pressed={activeCategory === key && activeColor === color}
                  onClick={() => onCategory(key, color)}
                >
                  {activeCategory === key && activeColor === color && categoryProgress
                    ? `${categoryProgress.index + 1}/${categoryProgress.total}`
                    : count}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
