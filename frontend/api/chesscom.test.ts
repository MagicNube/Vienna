import { expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('./native', () => ({ rpc }));
import { downloadGames } from './chesscom';
import { gameKind } from '../chess/gameKind';
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

it('preserves coach event metadata from downloaded daily games without dropping them', async () => {
  rpc.mockReset();
  rpc.mockResolvedValueOnce({
    games: [
      {
        pgn: '[Event "Play vs Coach"]\n[Site "Chess.com"]\n[White "PlayerOne"]\n[Black "NewCoach"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
        end_time: 1000,
        time_class: 'daily',
        time_control: '-',
        url: 'https://www.chess.com/game/daily/123',
      },
    ],
  });
  const games = await downloadGames('PlayerOne');
  expect(games).toHaveLength(1);
  expect(games[0].pgn).toContain('[Event "Play vs Coach"]');
  expect(games[0].timeClass).toBe('daily');
  expect(gameKind(games[0])).toBe('coach');
});
