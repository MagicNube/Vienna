import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationCenter } from './NotificationCenter';

const actions = {
  modal: null,
  onView: () => {},
  onDismiss: () => {},
  onPause: () => {},
  onResume: () => {},
  onStopAll: () => {},
};

it('ofrece parar todos junto a pausar cuando hay cien partidas en cola', () => {
  const html = renderToStaticMarkup(<NotificationCenter {...actions} items={[]} queued={100} />);
  expect(html).toContain('100 partidas en cola');
  expect(html).toContain('Pausar');
  expect(html).toContain('Parar todos');
  expect(html).toContain('Detener el análisis actual y vaciar toda la cola');
});

it('mantiene parar todos al pausar y desactiva ambas acciones mientras se detiene', () => {
  const paused = renderToStaticMarkup(
    <NotificationCenter {...actions} items={[]} queued={100} paused />,
  );
  expect(paused).toContain('Reanudar');
  expect(paused).toContain('Parar todos');
  const stopping = renderToStaticMarkup(
    <NotificationCenter {...actions} items={[]} queued={0} stopping />,
  );
  expect(stopping).toContain('Deteniendo análisis…');
  expect(stopping).toMatch(/class="notification-pause" disabled=""/);
  expect(stopping).toMatch(/class="notification-stop" type="button" disabled=""/);
});

it('una cola vacía no muestra acciones de detener o pausar', () => {
  const html = renderToStaticMarkup(<NotificationCenter {...actions} items={[]} queued={0} />);
  expect(html).not.toContain('Parar todos');
  expect(html).not.toContain('Pausar');
});
