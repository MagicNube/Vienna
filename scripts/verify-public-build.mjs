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
assert(!JSON.stringify(config.bundle.resources).includes('.vienna-private'));
console.log(
  'Distribución pública verificada: cuatro sonidos CC0, sin audio privado ni datos locales.',
);
