import { expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindowTitleBar, type WindowControls } from './WindowTitleBar';
import { Modal } from './Modal';
import fs from 'node:fs';

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
afterEach(() => vi.unstubAllGlobals());
const controls: WindowControls = {
  minimize: vi.fn(async () => {}),
  toggleMaximize: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  isMaximized: vi.fn(async () => false),
  onResized: vi.fn(async () => () => {}),
};

it('mantiene los tres controles accesibles y separados de la región arrastrable, sin marca visible', () => {
  const html = renderToStaticMarkup(<WindowTitleBar controls={controls} />);
  expect((html.match(/<button/g) ?? []).length).toBe(3);
  expect(html).toContain('Minimizar ventana');
  expect(html).toContain('Maximizar ventana');
  expect(html).toContain('Cerrar ventana');
  expect(html).toContain('data-tauri-drag-region=""');
  expect(html).not.toContain('Vienna');
  expect(html).not.toContain('<img');
});

it('los diálogos mantienen los controles de la ventana y dan el foco a su propio cerrar', () => {
  vi.stubGlobal('document', { documentElement: { dataset: { windowChrome: 'custom' } } });
  const html = renderToStaticMarkup(
    <Modal title="Ajustes" onClose={() => {}}>
      Contenido
    </Modal>,
  );
  expect(html).toContain('Controles de la ventana');
  expect(html).toContain('Cerrar ventana');
  expect(html).toMatch(/aria-label="Cerrar"[^>]*autofocus/);
});

it('la ventana conserva título de sistema y resize; concede las acciones necesarias', () => {
  const config = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  expect(config.app.windows[0]).toMatchObject({
    title: 'Vienna',
    decorations: false,
    resizable: true,
  });
  const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json', 'utf8'));
  expect(capability.permissions).toEqual(
    expect.arrayContaining([
      'core:window:allow-minimize',
      'core:window:allow-toggle-maximize',
      'core:window:allow-close',
      'core:window:allow-start-dragging',
    ]),
  );
  expect(capability.windows).toEqual(['main']);
});
