import type { BackgroundActivity } from './backgroundQueue';

export function createReviewNotifications(publish: (items: BackgroundActivity[]) => void) {
  let progress: BackgroundActivity | null = null;
  const errors = new Map<string, BackgroundActivity>();
  let viewedGame: string | null = null;
  const completed = new Map<string, BackgroundActivity>();
  const update = () => {
    publish([
      ...(progress ? [progress] : []),
      ...[...completed.values()].reverse(),
      ...[...errors.values()].reverse(),
    ]);
  };
  return {
    notify(activity: BackgroundActivity | null) {
      if (!activity || activity.kind === 'progress') {
        progress = activity;
        update();
        return;
      }
      if (
        (activity.gameId && progress?.gameId === activity.gameId) ||
        progress?.id === activity.id.replace(/:complete$/, '')
      )
        progress = null;
      if (activity.kind === 'success') {
        if (!activity.gameId || activity.gameId !== viewedGame)
          completed.set(activity.id, activity);
      } else {
        errors.set(activity.id, activity);
      }
      update();
    },
    dismiss(id: string) {
      completed.delete(id);
      errors.delete(id);
      update();
    },
    viewGame(gameId: string | null) {
      viewedGame = gameId;
      let changed = false;
      // A game can have several confirmations from separate analyses.
      for (const [id, activity] of completed) {
        if (gameId && activity.gameId === gameId) {
          completed.delete(id);
          changed = true;
        }
      }
      if (changed) update();
    },
    dispose() {
      progress = null;
      viewedGame = null;
      completed.clear();
      errors.clear();
    },
  };
}
