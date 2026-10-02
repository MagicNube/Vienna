import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { EngineLine } from '../types';
export async function rpc<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri()) return invoke<T>('rpc', { command, args });
  const response = await fetch('/__native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args }),
  });
  const data = await response.json();
  if (data.error) throw Error(data.error);
  return data.result as T;
}
export async function onEngineInfo(
  callback: (event: { requestId: string; lines: EngineLine[] }) => void,
): Promise<() => void> {
  if (isTauri())
    return listen<{ requestId: string; lines: EngineLine[] }>('engine-info', (e) =>
      callback(e.payload),
    );
  const stream = new EventSource('/__native/events');
  stream.onmessage = (e) => callback(JSON.parse(e.data));
  return () => stream.close();
}
