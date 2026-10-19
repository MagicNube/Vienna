import { rpc } from '../api/native';
import type { Review } from '../types';
export const repository = {
  get: <T>(kind: string, id: string) => rpc<T | null>('get', { kind, id }),
  list: <T>(kind: string) => rpc<T[]>('list', { kind }),
  reviewedIds: (version: number) => rpc<string[]>('review-index', { version }),
  statisticsReviews: (ids: string[]) => rpc<Record<string, Review>>('statistics-reviews', { ids }),
  cacheStatisticsReview: (id: string, expected: Review, value: Review) =>
    rpc<boolean>('cache-statistics-review', { id, expected, value }),
  put: <T>(kind: string, id: string, value: T) => rpc<void>('put', { kind, id, value }),
};
