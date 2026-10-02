import type { Category } from '../types';
import { categories } from '../review/classification';
import { Icon } from './Icon';

/** Familiar annotation symbols, drawn locally to keep a consistent weight. */
export function MoveSymbol({ category }: { category: Category }) {
  if (category === 'book') return <Icon name="book" size={16} />;
  if (category === 'excellent')
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M3 10h4v11H3zm6 0 5-7c1-1 3 0 2.5 2L16 9h4a2 2 0 0 1 2 2.4l-1.5 7A3 3 0 0 1 17.6 21H9z" />
      </svg>
    );
  if (category === 'good')
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 12 5 5L20 6" />
      </svg>
    );
  return <>{categories[category].symbol}</>;
}
