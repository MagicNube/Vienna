import { afterEach, expect, it, vi } from 'vitest';
import { makeTree } from '../chess/game';
import { soundForMove } from './chessSounds';

afterEach(() => vi.unstubAllGlobals());

const sound = (pgn: string) => {
  const tree = makeTree(pgn);
  return soundForMove(tree.nodes.at(-2)!, tree.nodes.at(-1)!);
};
it('distingue movimiento, captura, jaque y mate con la prioridad adecuada', () => {
  expect(sound('1. e4 *')).toBe('move');
  expect(sound('1. e4 d5 2. exd5 *')).toBe('capture');
  expect(sound('1. e4 f6 2. Qh5+ *')).toBe('check');
  expect(sound('1. f3 e5 2. g4 Qh4# *')).toBe('mate');
  expect(sound('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# *')).toBe('mate');
  expect(sound('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Bxf7+ *')).toBe('check');
  expect(sound('1. e4 a6 2. e5 d5 3. exd6 *')).toBe('capture');
});

function fakeAudio() {
  const start = vi.fn(),
    stop = vi.fn();
  const source = {
    buffer: null,
    onended: null,
    start,
    stop,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  source.connect.mockReturnValue(gain);
  const decoded = { duration: 0.25 };
  const decode = vi.fn().mockResolvedValue(decoded);
  class FakeAudioContext {
    state = 'running';
    destination = {};
    decodeAudioData = decode;
    createBufferSource() {
      return source;
    }
    createGain() {
      return gain;
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { source, gain, start, stop, decoded, decode };
}
it('decodifica el WAV distribuible, conserva volumen, reutiliza audio y permite silenciar', async () => {
  vi.resetModules();
  const audio = fakeAudio();
  const fetchAudio = vi
    .fn()
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  vi.stubGlobal('fetch', fetchAudio);
  const { playChessSound, stopChessSound } = await import('./chessSounds');
  await playChessSound('capture', 0.35);
  expect(fetchAudio).toHaveBeenCalledWith('/sounds/default/capture.wav');
  expect(audio.source.buffer).toBe(audio.decoded);
  expect(audio.start).toHaveBeenCalledOnce();
  expect(audio.gain.gain.value).toBe(0.35);
  stopChessSound();
  expect(audio.stop).toHaveBeenCalledOnce();
  await playChessSound('capture', 0.5);
  expect(fetchAudio).toHaveBeenCalledOnce();
  expect(audio.decode).toHaveBeenCalledOnce();
});
it('cambiar un sonido invalida la selección anterior y restaurar reutiliza el predeterminado', async () => {
  vi.resetModules();
  const audio = fakeAudio();
  const fetchAudio = vi
    .fn()
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  vi.stubGlobal('fetch', fetchAudio);
  const { playChessSound } = await import('./chessSounds');
  await playChessSound('move', 0.5);
  await playChessSound('move', 0.5, {
    move: { name: 'Uno.wav', data: 'data:audio/wav;base64,AA==' },
  });
  await playChessSound('move', 0.5, {
    move: { name: 'Dos.wav', data: 'data:audio/wav;base64,AQ==' },
  });
  await playChessSound('move', 0.5);
  expect(fetchAudio).toHaveBeenCalledOnce();
  expect(audio.decode).toHaveBeenCalledTimes(3);
  expect(audio.start).toHaveBeenCalledTimes(4);
  // Custom audio is decoded directly: no data: fetch blocked by packaged CSP.
  expect(audio.decode.mock.calls[1][0].byteLength).toBe(1);
});
it('no reproduce un audio pendiente después de silenciar', async () => {
  vi.resetModules();
  const audio = fakeAudio();
  let finish!: (value: unknown) => void;
  audio.decode.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  );
  const { playChessSound, stopChessSound } = await import('./chessSounds');
  const pending = playChessSound('check', 0.5);
  await vi.waitFor(() => expect(audio.decode).toHaveBeenCalledOnce());
  stopChessSound();
  finish(audio.decoded);
  await pending;
  expect(audio.start).not.toHaveBeenCalled();
});
it('descarta movimientos obsoletos durante la carga y permite recuperar un fallo', async () => {
  vi.resetModules();
  const audio = fakeAudio();
  let finish!: (value: unknown) => void;
  const fetchAudio = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  vi.stubGlobal('fetch', fetchAudio);
  const { playChessSound } = await import('./chessSounds');
  const oldMove = playChessSound('move', 0.5);
  await playChessSound('mate', 0.5);
  await playChessSound('mate', 0.5);
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await oldMove;
  expect(audio.start).toHaveBeenCalledOnce();
  expect(fetchAudio).toHaveBeenCalledTimes(3);
});
