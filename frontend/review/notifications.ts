import type { BackgroundActivity } from './backgroundQueue';

export function createReviewNotifications(publish: (activity: BackgroundActivity | null) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let progress: BackgroundActivity | null = null;
  return {
    notify(activity: BackgroundActivity | null) {
      if (!activity || activity.kind === 'progress') {
        progress = activity;
        if (!timer) publish(activity);
        return;
      }
      progress = null;
      clearTimeout(timer);
      publish(activity);
      // The next game can start immediately without erasing the completion notice.
      timer = setTimeout(() => {
        timer = undefined;
        publish(progress);
      }, 7000);
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
