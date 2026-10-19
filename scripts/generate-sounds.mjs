// Reproducible edits of Kenney's CC0 Impact Sounds. No private audio is used.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const rate = 44100;
const root = new URL('../public/sounds/default/', import.meta.url);
await mkdir(root, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = {};
async function load(strength) {
  const name = `impactWood_${strength}_000.wav`;
  const bytes = await readFile(new URL('audio/' + name, import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let samples;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert(start + size <= bytes.length);
    if (id === 'fmt ') {
      assert.equal(bytes.readUInt16LE(start), 1);
      assert.equal(bytes.readUInt16LE(start + 2), 1);
      assert.equal(bytes.readUInt32LE(start + 4), rate);
      assert.equal(bytes.readUInt16LE(start + 14), 16);
    }
    if (id === 'data') {
      samples = Float64Array.from(
        { length: size / 2 },
        (_, i) => bytes.readInt16LE(start + 2 * i) / 32768,
      );
    }
    offset = start + size + (size % 2);
  }
  assert(samples?.length);
  const first = Math.max(0, samples.findIndex((x) => Math.abs(x) > 0.002) - 44);
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) < 0.001) last--;
  samples = samples.slice(first, Math.min(samples.length, last + 442));
  const peak = Math.max(...samples.map(Math.abs));
  samples = samples.map((x, i) => (x / peak) * Math.min(1, i / 22, (samples.length - 1 - i) / 220));
  sources[name] = { original: name.replace('.wav', '.ogg'), sha256: hash(bytes) };
  return samples;
}
const light = await load('light');
const medium = await load('medium');
function render(hits) {
  const length = Math.max(...hits.map(([time, sample]) => Math.round(time * rate) + sample.length));
  const samples = new Float64Array(length);
  for (const [time, sample, gain] of hits) {
    const offset = Math.round(time * rate);
    sample.forEach((x, i) => (samples[offset + i] += x * gain));
  }
  const peak = Math.max(...samples.map(Math.abs));
  const gain = Math.min(1, 0.92 / peak);
  const bytes = Buffer.alloc(44 + length * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(length * 2, 40);
  samples.forEach((x, i) => bytes.writeInt16LE(Math.round(x * gain * 32767), 44 + i * 2));
  return { bytes, duration: length / rate };
}
const effects = {
  move: [[0, light, 0.65]],
  capture: [[0, medium, 0.85]],
  check: [
    [0, light, 0.65],
    [0.105, medium, 0.55],
  ],
  mate: [
    [0, medium, 0.8],
    [0.14, light, 0.55],
    [0.28, medium, 0.65],
  ],
};
const files = {};
for (const [name, hits] of Object.entries(effects)) {
  const { bytes, duration } = render(hits);
  await writeFile(new URL(name + '.wav', root), bytes);
  files[name + '.wav'] = { duration, sha256: hash(bytes) };
}
await writeFile(
  new URL('provenance.json', root),
  JSON.stringify(
    {
      origin: 'Kenney — Impact Sounds 1.0 (2019), edited for Vienna',
      source: 'https://kenney.nl/assets/impact-sounds',
      author: 'Kenney',
      license: 'CC0-1.0',
      generator: 'scripts/generate-sounds.mjs',
      modifications:
        'Decoded OGG sources to mono PCM WAV; trimmed pre-roll/tail, faded edges, adjusted gain; check and mate combine wooden hits.',
      sources,
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
  `# Sonidos de Vienna\n\nBasados en **Impact Sounds 1.0**, de Kenney: https://kenney.nl/assets/impact-sounds (CC0-1.0).\n\nMovimiento: impactWood_light_000. Captura: impactWood_medium_000. Jaque: dos golpes; mate: tres. Edición: conversión a WAV mono, recorte de silencio, fundidos breves y ajuste de volumen.\n\nLas fuentes PCM están en scripts/audio/. Se regeneran sin descargas ni dependencias adicionales con npm run sounds:generate. Procedencia y SHA-256 en provenance.json; aviso original en licenses/Kenney-Impact-Sounds.txt y licencia completa en licenses/Vienna-Sounds-CC0.txt.\n`,
);
console.log('Cuatro sonidos de madera Kenney (CC0-1.0) preparados.');
