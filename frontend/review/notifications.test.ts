import { afterEach, expect, it, vi } from 'vitest';
import { createReviewNotifications } from './notifications';
import type { BackgroundActivity } from './backgroundQueue';

afterEach(() => vi.useRealTimers());
const finished: BackgroundActivity = {
  id: 'a:complete',
  gameId: 'a',
  kind: 'success',
  title: 'Partida analizada',
  detail: 'A vs B',
};
const running: BackgroundActivity = {
  id: 'b',
  gameId: 'b',
  kind: 'progress',
  title: 'Analizando partida',
  detail: 'C vs D',
  done: 1,
  total: 10,
};

it('reúne progreso y confirmaciones en la campana, con las últimas primero', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  const second = { ...finished, id: 'c:complete', gameId: 'c' };
  notices.notify(finished);
  notices.notify(second);
  notices.notify(running);
  expect(items).toHaveBeenLastCalledWith([running, second, finished]);
  notices.viewGame('c');
  expect(items).toHaveBeenLastCalledWith([running, finished]);
  notices.dismiss(finished.id);
  expect(items).toHaveBeenLastCalledWith([running]);
});

it('conserva confirmaciones y errores hasta omitirlos, sin duplicados ni temporizadores', () => {
  vi.useFakeTimers();
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  const error = { ...finished, id: 'error', kind: 'error' as const };
  notices.notify(finished);
  notices.notify(finished);
  notices.notify(error);
  vi.advanceTimersByTime(60_000);
  expect(items).toHaveBeenLastCalledWith([finished, error]);
  notices.dismiss(error.id);
  expect(items).toHaveBeenLastCalledWith([finished]);
  notices.dismiss(finished.id);
  expect(items).toHaveBeenLastCalledWith([]);
  notices.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('abrir una partida borra todas sus confirmaciones y conserva las demás', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  const other = { ...finished, id: 'b:complete', gameId: 'b' };
  notices.notify(finished);
  notices.notify(other);
  notices.notify({ ...other, id: 'b:2:complete' });
  notices.viewGame('b');
  expect(items).toHaveBeenLastCalledWith([finished]);
});

it('ver una partida no oculta su progreso ni elimina sus errores', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.notify(running);
  notices.viewGame('b');
  expect(items).toHaveBeenLastCalledWith([running]);
  const error = { ...running, kind: 'error' as const, title: 'Error' };
  notices.notify(error);
  notices.viewGame('b');
  expect(items).toHaveBeenLastCalledWith([error]);
});

it('no añade una finalización de la partida abierta, pero sí después de salir', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.viewGame('a');
  notices.notify(finished);
  expect(items).toHaveBeenLastCalledWith([]);
  notices.viewGame(null);
  const later = { ...finished, id: 'a:2:complete' };
  notices.notify(later);
  expect(items).toHaveBeenLastCalledWith([later]);
});

it('actualiza el progreso sin descartar confirmaciones pendientes', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.notify(finished);
  notices.notify(running);
  const next = { ...running, done: 4, paused: true };
  notices.notify(next);
  expect(items).toHaveBeenLastCalledWith([next, finished]);
  notices.dismiss(finished.id);
  expect(items).toHaveBeenLastCalledWith([next]);
});

it('terminar una partida retira su progreso y conserva las otras confirmaciones', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.notify(finished);
  notices.notify(running);
  const second = { ...finished, id: 'b:complete', gameId: 'b' };
  notices.notify(second);
  notices.notify(second);
  expect(items).toHaveBeenLastCalledWith([second, finished]);
  notices.dismiss(second.id);
  expect(items).toHaveBeenLastCalledWith([finished]);
});

it('finalizar la partida abierta retira el progreso sin dejar una confirmación', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.viewGame('b');
  notices.notify(running);
  notices.notify({ ...finished, id: 'b:complete', gameId: 'b' });
  expect(items).toHaveBeenLastCalledWith([]);
});

it('cancelar otra partida no borra la confirmación pendiente', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  notices.notify(finished);
  notices.notify(running);
  notices.notify(null);
  expect(items).toHaveBeenLastCalledWith([finished]);
});

it('conserva errores distintos, deduplica reintentos y mantiene búsquedas ajenas', () => {
  const items = vi.fn();
  const notices = createReviewNotifications(items);
  const first: BackgroundActivity = {
    id: 'sync-error',
    kind: 'error',
    title: 'Error',
    detail: 'Conexión',
  };
  const second = { ...first, id: 'read-error', detail: 'PGN' };
  notices.notify(running);
  notices.notify(first);
  notices.notify(second);
  notices.notify(first);
  expect(items).toHaveBeenLastCalledWith([running, second, first]);
  notices.dismiss(first.id);
  expect(items).toHaveBeenLastCalledWith([running, second]);
});
