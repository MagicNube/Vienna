import { useEffect, useMemo, useRef, useState } from 'react';
import { canToggleSeen, SeenGames } from './seenGames';
import { repository } from './repository';
import { REVIEW_VERSION } from '../review/GameReviewService';

export function useSeenGames(
  onError: (error: unknown) => void,
  analysed: ReadonlySet<string>,
  loadingAnalyses: boolean,
) {
  const store = useRef(new SeenGames());
  const initialLoad = useRef<Promise<Set<string>> | null>(null);
  const pendingIds = useRef(new Set<string>());
  const [savedIds, setIds] = useState(new Set<string>());
  const ids = useMemo(
    () => new Set([...savedIds].filter((id) => analysed.has(id))),
    [savedIds, analysed],
  );
  const [pending, setPending] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    function load() {
      // Read the saved index directly: the UI index may still be loading.
      const request = (initialLoad.current ??= repository
        .reviewedIds(REVIEW_VERSION)
        .then((complete) => store.current.clearUnanalysed(new Set(complete))));
      void request
        .then((saved) => {
          if (active) {
            setIds(saved);
            setLoading(false);
          }
        })
        .catch((error) => {
          if (initialLoad.current === request) initialLoad.current = null;
          if (!active) return;
          // A transient startup read must not lock manual review for the session.
          if (++attempts < 3) retryTimer = setTimeout(load, 250 * attempts);
          else onError(error);
        });
    }
    load();
    return () => {
      active = false;
      clearTimeout(retryTimer);
    };
  }, [onError]);

  async function toggle(id: string) {
    if (
      loading ||
      pendingIds.current.has(id) ||
      !canToggleSeen(ids.has(id), analysed.has(id), loadingAnalyses)
    )
      return;
    pendingIds.current.add(id);
    setPending(new Set(pendingIds.current));
    try {
      setIds(await store.current.setSeen(id, !ids.has(id)));
    } catch (error) {
      onError(error);
    } finally {
      pendingIds.current.delete(id);
      setPending(new Set(pendingIds.current));
    }
  }
  return {
    ids,
    pending,
    loading,
    toggle,
    forget: (removed: string[]) => setIds(store.current.forget(removed)),
  };
}
