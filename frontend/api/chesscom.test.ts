import { expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('./native', () => ({ rpc }));
import { downloadGames } from './chesscom';
it('comparte la descarga en curso entre sincronización manual y automática', async () => {
  let finish!: (result: { games: unknown[] }) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = downloadGames('PlayerOne');
  const second = downloadGames('playerone');
  expect(first).toBe(second);
  expect(rpc).toHaveBeenCalledOnce();
  finish({ games: [] });
  await expect(first).resolves.toEqual([]);
  rpc.mockResolvedValueOnce({ games: [] });
  await downloadGames('PlayerOne');
  expect(rpc).toHaveBeenCalledTimes(2);
});
it('libera una descarga fallida para permitir el siguiente intento', async () => {
  rpc.mockReset();
  rpc.mockRejectedValueOnce(Error('offline'));
  await expect(downloadGames('PlayerOne')).rejects.toThrow('offline');
  rpc.mockResolvedValueOnce({ games: [] });
  await expect(downloadGames('PlayerOne')).resolves.toEqual([]);
  expect(rpc).toHaveBeenCalledTimes(2);
});
