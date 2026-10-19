import { repository } from '../database/repository';

const pending = new Map<string, Promise<number>>();

/** Each account starts watching now once; reopening resumes from its saved date. */
export function automaticStart(username: string, now = Date.now()) {
  const key = `autoReviewSince:${username.trim().toLowerCase()}`;
  let request = pending.get(key);
  if (!request) {
    request = repository
      .get<number>('settings', key)
      .then(async (saved) => {
        if (saved !== null) return saved;
        await repository.put('settings', key, now);
        return now;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}
