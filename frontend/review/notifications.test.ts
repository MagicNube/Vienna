import { afterEach, expect, it, vi } from 'vitest';
import { createReviewNotifications } from './notifications';
import type { BackgroundActivity } from './backgroundQueue';

afterEach(() => vi.useRealTimers());
const finished: BackgroundActivity = {
  id: 'a:complete',
  kind: 'success',
  title: 'Partida analizada',
  detail: 'A vs B',
};
const running: BackgroundActivity = {
  id: 'b',
  kind: 'progress',
  title: 'Analizando partida',
  detail: 'C vs D',
  done: 1,
  total: 10,
};

it('mantiene la finalización siete segundos aunque empiece la siguiente partida', () => {
  vi.useFakeTimers();
  const publish = vi.fn();
  const notices = createReviewNotifications(publish);
  notices.notify(finished);
  notices.notify(running);
  notices.notify({ ...running, done: 4 });
  vi.advanceTimersByTime(6999);
  expect(publish).toHaveBeenLastCalledWith(finished);
  vi.advanceTimersByTime(1);
  expect(publish).toHaveBeenLastCalledWith({ ...running, done: 4 });
  notices.dispose();
});
it('renueva el aviso al completar otra partida y no recupera un progreso ya terminado', () => {
  vi.useFakeTimers();
  const publish = vi.fn();
  const notices = createReviewNotifications(publish);
  notices.notify(finished);
  notices.notify(running);
  vi.advanceTimersByTime(5000);
  const second = { ...finished, id: 'b:complete' };
  notices.notify(second);
  vi.advanceTimersByTime(5000);
  expect(publish).toHaveBeenLastCalledWith(second);
  vi.advanceTimersByTime(2000);
  expect(publish).toHaveBeenLastCalledWith(null);
  notices.notify(finished);
  notices.dispose();
  vi.advanceTimersByTime(10000);
  expect(publish).toHaveBeenLastCalledWith(finished);
});
