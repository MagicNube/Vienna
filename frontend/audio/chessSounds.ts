import { Chess } from 'chess.js';
import type { PositionNode, Settings } from '../types';
export type ChessSound = 'move' | 'capture' | 'check' | 'mate';
export function soundForMove(before: PositionNode, after: PositionNode): ChessSound {
  const chess = new Chess(before.fen);
  const move = chess.move({
    from: after.uci.slice(0, 2),
    to: after.uci.slice(2, 4),
    promotion: after.uci[4],
  });
  if (chess.isCheckmate()) return 'mate';
  if (chess.isCheck()) return 'check';
  return move.captured ? 'capture' : 'move';
}

const soundFiles: Record<ChessSound, string> =
  import.meta.env.MODE === 'personal'
    ? {
        move: '/sounds/personal/move-self.mp3',
        capture: '/sounds/personal/capture.mp3',
        check: '/sounds/personal/move-check.mp3',
        mate: '/sounds/personal/game-end.mp3',
      }
    : {
        move: '/sounds/default/move.wav',
        capture: '/sounds/default/capture.wav',
        check: '/sounds/default/check.wav',
        mate: '/sounds/default/mate.wav',
      };

let context: AudioContext | undefined;
let current: AudioBufferSourceNode | undefined;
let request = 0;
const buffers = new Map<string, Promise<AudioBuffer>>();
export function stopChessSound() {
  request++;
  current?.stop();
  current = undefined;
}
export async function playChessSound(
  kind: ChessSound,
  volume: number,
  custom?: Settings['customSounds'],
) {
  const ticket = ++request;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    if (ticket !== request) return;
    current?.stop();
    current = undefined;
    const file = custom?.[kind]?.data ?? soundFiles[kind];
    let loading = buffers.get(file);
    if (!loading) {
      const audioContext = context;
      const data = file.startsWith('data:audio/wav;base64,')
        ? Promise.resolve(Uint8Array.from(atob(file.split(',')[1]), (c) => c.charCodeAt(0)).buffer)
        : fetch(file).then((response) => {
            if (!response.ok) throw new Error('Audio: ' + response.status);
            return response.arrayBuffer();
          });
      loading = data
        .then((data) => audioContext.decodeAudioData(data))
        .catch((error) => {
          buffers.delete(file);
          throw error;
        });
      // Bound memory when replacing custom recordings repeatedly.
      if (buffers.size >= 12) buffers.clear();
      buffers.set(file, loading);
    }
    const buffer = await loading;
    // A newer move or mute can arrive while the recording is being decoded.
    if (ticket !== request) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (current === source) current = undefined;
    };
    current = source;
    source.start();
  } catch {
    // Audio unavailable or blocked: chess interaction must still work.
  }
}
