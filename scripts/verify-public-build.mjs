// Fail closed before packaging a public installer with private or user resources.
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const provenance = JSON.parse(
  await readFile(path.join(root, 'public/sounds/default/provenance.json')),
);
assert.equal(provenance.license, 'CC0-1.0');

for (const [name, info] of Object.entries(provenance.files)) {
  const data = await readFile(path.join(dist, 'sounds/default', name));
  assert.equal(createHash('sha256').update(data).digest('hex'), info.sha256, name);
}

async function inspect(directory) {
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    const relative = path.relative(dist, absolute).replaceAll('\\', '/');
    assert(!/(^|\/)(personal|\.vienna-private|\.vienna-dev)(\/|$)/i.test(relative), relative);
    assert(!/\.(mp3|sqlite\w*|db|pfx|pem|key|log)$/i.test(name), relative);
    if ((await stat(absolute)).isDirectory()) await inspect(absolute);
    else if (name.endsWith('.js')) {
      const script = await readFile(absolute, 'utf8');
      assert(!script.includes('/sounds/personal/'), 'El código usa sonidos privados');
    }
  }
}
await inspect(dist);
const config = JSON.parse(await readFile(path.join(root, 'src-tauri/tauri.conf.json')));
assert.deepEqual(
  config.bundle.resources,
  [
    'resources/stockfish/stockfish/**/*',
    'resources/stockfish/provenance.json',
    '../LICENSE',
    '../THIRD_PARTY_NOTICES.md',
    '../licenses/*',
  ],
  'Revisa los recursos públicos antes de añadir nuevas rutas al instalador',
);
const settingsSource = await readFile(path.join(root, 'frontend/types/index.ts'), 'utf8');
const defaults = settingsSource.match(/export const defaultSettings: Settings = (\{[\s\S]*?\n\});/);
assert(defaults, 'No se encontraron las preferencias iniciales para verificar el perfil vacío');
assert.match(defaults[1], /\busername:\s*(['"])\1\s*,/, 'La cuenta inicial debe estar vacía');
assert(!/\bprofileImage\s*:/.test(defaults[1]), 'No se permite una foto de perfil por defecto');
await inspect(path.join(root, 'src-tauri/resources/stockfish'));
console.log(
  'Distribución pública verificada: perfil vacío, cuatro sonidos CC0 y recursos sin datos locales.',
);
