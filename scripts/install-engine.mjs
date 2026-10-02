import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve('src-tauri/resources/stockfish');
await mkdir(root, { recursive: true });
const platform =
  process.platform === 'win32'
    ? `windows-${process.arch === 'arm64' ? 'arm64' : 'x86-64'}`
    : process.platform === 'darwin'
      ? 'macos'
      : `linux-${process.arch === 'arm64' ? 'arm64' : 'x86-64'}`;
const name = `stockfish-${platform}-universal.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
const response = await fetch(
  'https://api.github.com/repos/official-stockfish/Stockfish/releases/tags/sf_19',
  { headers: { 'User-Agent': 'Vienna-Chess/0.1 (local desktop analysis)' } },
);
if (!response.ok) throw Error(`GitHub: ${response.status}`);
const release = await response.json();
const asset = release.assets.find((a) => a.name === name);
if (!asset?.digest?.startsWith('sha256:'))
  throw Error('No hay un paquete oficial verificable para esta plataforma.');
const download = await fetch(asset.browser_download_url);
if (!download.ok) throw Error(`Descarga: ${download.status}`);
const data = Buffer.from(await download.arrayBuffer());
if (`sha256:${createHash('sha256').update(data).digest('hex')}` !== asset.digest)
  throw Error('SHA-256 incorrecto');
const archive = path.join(root, name);
await writeFile(archive, data);
execFileSync('tar', ['-xf', archive, '-C', root]);
await writeFile(
  path.join(root, 'provenance.json'),
  JSON.stringify(
    {
      version: 'Stockfish 19',
      url: asset.browser_download_url,
      sha256: asset.digest,
      source: 'https://github.com/official-stockfish/Stockfish/tree/sf_19',
    },
    null,
    2,
  ),
);
console.log('Stockfish 19 descargado y SHA-256 verificado en', root);
