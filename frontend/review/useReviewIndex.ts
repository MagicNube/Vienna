import { useEffect, useState } from 'react';
import { repository } from '../database/repository';
import type { Game, Review } from '../types';
import { REVIEW_VERSION } from './GameReviewService';

export function useReviewIndex(games: Game[], revision: number) {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      const ids: string[] = [];
      for (let offset = 0; offset < games.length; offset += 8) {
        const batch = await Promise.allSettled(
          games.slice(offset, offset + 8).map(async (game) => {
            const review = await repository.get<Review>('reviews', game.id);
            return review?.complete && review.version === REVIEW_VERSION ? game.id : null;
          }),
        );
        for (const result of batch)
          if (result.status === 'fulfilled' && result.value) ids.push(result.value);
      }
      if (active) {
        setReviewed(new Set(ids));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [games, revision]);
  return { reviewed, loading };
}
