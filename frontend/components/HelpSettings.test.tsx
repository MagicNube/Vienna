import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpSettings } from './HelpSettings';

const config = vi.hoisted(() => ({ accessKey: '' }));
vi.mock('../api/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/feedback')>()),
  get feedbackAccessKey() {
    return config.accessKey;
  },
}));
beforeEach(() => {
  config.accessKey = '';
});

it('offers the two help entry points without requesting an account or contact first', () => {
  const html = renderToStaticMarkup(<HelpSettings />);
  expect(html).toContain('Informar de un problema');
  expect(html).toContain('Proponer una mejora');
  expect(html).not.toContain('<form');
});
it('opens the error report form with visible, editable context and an optional contact', () => {
  const html = renderToStaticMarkup(<HelpSettings initialReport="No se pudo abrir el motor." />);
  expect(html).toContain('No se pudo abrir el motor.');
  expect(html).toContain('Qué estaba haciendo:');
  expect(html).toContain('Sugerencias Vienna');
  expect(html).toContain('jesus.caravaca@protonmail.com');
  expect(html).toContain('(opcional)');
  expect(html).toContain('Preparar correo');
  expect(html).not.toContain('mensaje se ha enviado');
});

it('offers direct delivery and discloses Web3Forms when a public key is configured', () => {
  config.accessKey = 'public-test-key';
  const html = renderToStaticMarkup(<HelpSettings initialReport="No se pudo abrir el motor." />);
  expect(html).toContain('Enviar opinión');
  expect(html).toContain('mediante Web3Forms');
  expect(html).toContain('Usar mi correo');
  expect(html).not.toContain('Preparar correo');
  expect(html).not.toContain('mensaje se ha enviado');
});
