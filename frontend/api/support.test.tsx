import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { openSupportPage, SUPPORT_URL } from './support';
import { SupportLink } from '../components/SupportLink';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it('ofrece un enlace real de apoyo separado de los controles, sin compartir datos de la cuenta', () => {
  const html = renderToStaticMarkup(<SupportLink onError={() => {}} />);
  expect(html).toContain(`href="${SUPPORT_URL}"`);
  expect(html).toContain('Apoyar Vienna');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(new URL(SUPPORT_URL).search).toBe('');
});

it('abre únicamente la página de apoyo fijada en la aplicación', async () => {
  vi.mocked(openUrl).mockResolvedValue(undefined);
  await openSupportPage();
  expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://buymeacoffee.com/magicnube');
});

it('propaga fallos de apertura para poder comunicarlos en la campana', async () => {
  vi.mocked(openUrl).mockRejectedValue(new Error('No browser'));
  await expect(openSupportPage()).rejects.toThrow('No browser');
});

it('limita el permiso nativo a esa URL y a la ventana principal, sin acceso a archivos', () => {
  const capabilities = JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json', 'utf8'));
  expect(capabilities.windows).toEqual(['main']);
  expect(capabilities.permissions.filter((p: unknown) => typeof p !== 'string')).toEqual([
    { identifier: 'opener:allow-open-url', allow: [{ url: SUPPORT_URL }] },
  ]);
  expect(capabilities.permissions).not.toContain('opener:default');
  expect(capabilities.permissions).not.toContain('opener:allow-open-path');
});
