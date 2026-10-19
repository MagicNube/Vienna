import type { Category, MoveReview } from '../types';
export interface CategoryTour {
  origin: string;
  category: Category;
  color?: 'w' | 'b';
  index: number;
  total: number;
  target: string;
  paused?: boolean;
}
/** Hide the category selection while retaining its return destination. */
export function pauseCategoryTour(tour: CategoryTour | null, destination: string) {
  return tour && destination !== tour.origin ? { ...tour, paused: true } : null;
}
export function cycleCategory(
  moves: MoveReview[],
  category: Category,
  current: string,
  tour: CategoryTour | null,
  color?: 'w' | 'b',
): CategoryTour | null {
  const matches = moves
    .filter((m) => m.category === category && (!color || m.color === color))
    .sort((a, b) => a.ply - b.ply);
  if (!matches.length) return tour;
  const continuing = !tour?.paused && tour?.category === category && tour.color === color;
  const index = continuing ? tour.index + 1 : 0;
  if (index >= matches.length) return null;
  return {
    origin: tour?.paused ? current : (tour?.origin ?? current),
    category,
    color,
    index,
    total: matches.length,
    target: `m${matches[index].ply}`,
  };
}
