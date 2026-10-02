import { afterEach, expect, it, vi } from 'vitest';
import { customSound, pcmWav, validateSound, MAX_SOUND_BYTES } from './customSound';
afterEach(() => vi.unstubAllGlobals());
it('rechaza formatos ajenos, vacíos y exceso de tamaño', () => {
  expect(() => validateSound({ name: 'clack.MP3', size: 42 })).not.toThrow();
  expect(() => validateSound({ name: 'capture.ogg', size: MAX_SOUND_BYTES })).not.toThrow();
  expect(() => validateSound({ name: 'move.exe', size: 42 })).toThrow('MP3');
  expect(() => validateSound({ name: 'move.wav', size: 0 })).toThrow('vacío');
  expect(() => validateSound({ name: 'move.wav', size: MAX_SOUND_BYTES + 1 })).toThrow('2 MB');
});
it('convierte estéreo a PCM mono, limita amplitud y conserva frecuencia', () => {
  const wav = new DataView(
    pcmWav({
      sampleRate: 44100,
      length: 3,
      numberOfChannels: 2,
      getChannelData: (i) => new Float32Array(i ? [-1, 0, 2] : [-1, 1, 2]),
    }),
  );
  expect(wav.getUint16(22, true)).toBe(1);
  expect(wav.getUint32(24, true)).toBe(44100);
  expect(wav.getUint32(40, true)).toBe(6);
  expect([44, 46, 48].map((offset) => wav.getInt16(offset, true))).toEqual([-32768, 16384, 32767]);
});
function setup(duration = 0.1) {
  const close = vi.fn().mockResolvedValue(undefined);
  const decode = vi
    .fn()
    .mockResolvedValue({
      duration,
      sampleRate: 44100,
      length: 4,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 1, -1, 0]),
    });
  vi.stubGlobal(
    'AudioContext',
    class {
      decodeAudioData = decode;
      close = close;
    },
  );
  return { close, decode };
}
const file = {
  name: 'Mi sonido.wav',
  size: 44,
  arrayBuffer: async () => new ArrayBuffer(44),
} as File;
it('normaliza el archivo, guarda su nombre y libera el contexto', async () => {
  const { close } = setup();
  const result = await customSound(file);
  expect(result.name).toBe(file.name);
  expect(result.data).toMatch(/^data:audio\/wav;base64,UklGR/);
  expect(close).toHaveBeenCalledOnce();
});
it('rechaza grabaciones largas y corruptas sin conservarlas', async () => {
  const { close } = setup(3.1);
  await expect(customSound(file)).rejects.toThrow('3 segundos');
  expect(close).toHaveBeenCalledOnce();
  const next = setup();
  next.decode.mockRejectedValue(Error('codec'));
  await expect(customSound(file)).rejects.toThrow('No se pudo abrir');
  expect(next.close).toHaveBeenCalledOnce();
});
