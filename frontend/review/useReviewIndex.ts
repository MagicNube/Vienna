import { useEffect, useState } from 'react';
import { repository } from '../database/repository';
import type { Game } from '../types';
import { REVIEW_VERSION } from './GameReviewService';

export function useReviewIndex(games: Game[], revision: number, onError: (error: unknown) => void) {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const ids = games.length ? await repository.reviewedIds(REVIEW_VERSION) : [];
        if (active) {
          const libraryIds = new Set(games.map((game) => game.id));
          setReviewed(new Set(ids.filter((id) => libraryIds.has(id))));
        }
      } catch (error) {
        if (active) onError(error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [games, revision, onError]);
  return { reviewed, loading };
}
