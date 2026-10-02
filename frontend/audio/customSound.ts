export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export function validateSound(file: Pick<File, 'name' | 'size'>) {
  if (!/\.(mp3|wav|ogg)$/i.test(file.name)) throw Error('Elige un archivo MP3, WAV u OGG.');
  if (!file.size) throw Error('El archivo está vacío.');
  if (file.size > MAX_SOUND_BYTES) throw Error('El sonido debe ocupar como máximo 2 MB.');
}
export function pcmWav(
  buffer: Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>,
) {
  const bytes = new ArrayBuffer(44 + buffer.length * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, buffer.length * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(
      -1,
      Math.min(1, channels.reduce((sum, c) => sum + c[i], 0) / channels.length),
    );
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
export async function customSound(file: File) {
  validateSound(file);
  const context = new AudioContext({ sampleRate: 44100 });
  try {
    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw Error('No se pudo abrir el sonido. Prueba con otro MP3, WAV u OGG.');
    }
    if (!decoded.length || !Number.isFinite(decoded.duration) || decoded.duration > 3)
      throw Error('El sonido debe durar como máximo 3 segundos.');
    const wav = new Uint8Array(pcmWav(decoded));
    let binary = '';
    for (const byte of wav) binary += String.fromCharCode(byte);
    return { name: file.name.slice(0, 120), data: 'data:audio/wav;base64,' + btoa(binary) };
  } finally {
    await context.close();
  }
}
