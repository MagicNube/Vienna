// Original deterministic synthesis: no samples or recordings from other services.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const rate = 44100;
const root = new URL('../public/sounds/default/', import.meta.url);
await mkdir(root, { recursive: true });
function synthesize(duration, hits, seed) {
  const length = Math.round(duration * rate);
  const data = Buffer.alloc(44 + length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(length * 2, 40);
  let smooth = 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    smooth += (noise - smooth) * 0.45;
    const time = i / rate;
    let value = 0;
    for (const [start, frequency, strength] of hits) {
      const t = time - start;
      if (t < 0) continue;
      const attack = Math.min(1, t / 0.0015);
      // Short dry wooden tap; a quieter resonant tail distinguishes the effects.
      value +=
        strength *
        attack *
        (0.62 * smooth * Math.exp(-t * 155) +
          0.32 * Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 74) +
          0.11 * Math.sin(2 * Math.PI * frequency * 2.7 * t) * Math.exp(-t * 100));
    }
    const fade = Math.min(1, (duration - time) / 0.008);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * fade)) * 32767), 44 + i * 2);
  }
  return data;
}
const effects = {
  move: [0.09, [[0, 760, 1]], 31],
  capture: [
    0.15,
    [
      [0, 430, 1.3],
      [0.024, 880, 0.45],
    ],
    73,
  ],
  check: [
    0.24,
    [
      [0, 800, 0.85],
      [0.075, 1200, 0.8],
    ],
    113,
  ],
  mate: [
    0.42,
    [
      [0, 900, 0.9],
      [0.11, 670, 0.9],
      [0.22, 450, 1],
    ],
    167,
  ],
};
const files = {};
for (const [name, [duration, hits, seed]] of Object.entries(effects)) {
  const bytes = synthesize(duration, hits, seed);
  await writeFile(new URL(name + '.wav', root), bytes);
  files[name + '.wav'] = { duration, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(
  new URL('provenance.json', root),
  JSON.stringify(
    {
      origin: 'Original procedural synthesis for Vienna; no external samples',
      generator: 'scripts/generate-sounds.mjs',
      license: 'CC0-1.0',
      sampleRate: rate,
      channels: 1,
      bits: 16,
      files,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  new URL('README.md', root),
  '# Sonidos de Vienna\n\nMovimiento, captura, jaque y mate creados mediante síntesis original, sin muestras de otras plataformas. Se dedican al dominio público mediante CC0-1.0. La licencia completa está en `licenses/Vienna-Sounds-CC0.txt`. Se regeneran con `npm run sounds:generate`.\n',
);
console.log('Cuatro sonidos originales generados (CC0-1.0).');
