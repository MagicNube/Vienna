// Copy only reviewed source paths. Never copy user databases, local assets or build output.
import { mkdir, readdir, lstat, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(root, 'exports', 'Vienna-GitHub-' + stamp);
const files = [
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'index.html',
  'LICENSE',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'docs/DISTRIBUTION.md',
  'docs/PUBLISHING.md',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/build.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/tauri.personal.conf.json',
];
async function collect(relative) {
  const source = path.join(root, relative);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw Error('No se exportan enlaces: ' + relative);
  if (info.isDirectory()) {
    for (const name of (await readdir(source)).sort()) await collect(relative + '/' + name);
  } else files.push(relative);
}
for (const directory of [
  'frontend',
  'public',
  'licenses',
  'scripts',
  'src-tauri/src',
  'src-tauri/capabilities',
  'src-tauri/icons',
])
  await collect(directory);
await mkdir(target, { recursive: true });
const manifest = {};
for (const relative of [...new Set(files)].sort()) {
  if (/\.(sqlite(?:3)?(?:-wal|-shm)?|db|mp3|pfx|pem|key|log)$/i.test(relative))
    throw Error('Archivo inesperado en las rutas públicas: ' + relative);
  const source = path.join(root, relative);
  const destination = path.join(target, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  // Preserve isolated position evidence while excluding the original game and account names.
  if (relative === 'frontend/review/fixtures/bxh6-sacrifice.json') {
    const fixture = JSON.parse(await readFile(source, 'utf8'));
    delete fixture.pgn;
    fixture.source =
      'Anonymous position regression: bishop sacrifice, rejected principal variation and native engine confirmation.';
    await writeFile(destination, JSON.stringify(fixture, null, 2) + '\n');
  } else await copyFile(source, destination);
  let bytes = await readFile(destination);
  // Keep the manifest valid after Git checkout on Windows as well as in the ZIP.
  if (!bytes.includes(0)) {
    bytes = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
    await writeFile(destination, bytes);
  }
  if (
    /\.(ts|tsx|json|md|mjs|rs|toml)$/.test(relative) &&
    /C:[\\/]Users[\\/]|data:image\/[\w.+-]+;base64,[a-z\d+/=]{256}/i.test(
      bytes.toString(),
    )
  )
    throw Error('Posible dato personal; revisa: ' + relative);
  manifest[relative] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(
  path.join(target, 'EXPORT-MANIFEST.json'),
  JSON.stringify(
    {
      excludes: [
        'User databases and caches',
        'Profile images and custom sounds',
        'Private audio',
        'Builds',
        'Local screenshots',
        'Personal verification reports',
      ],
      files: manifest,
    },
    null,
    2,
  ) + '\n',
);
console.log(target);
