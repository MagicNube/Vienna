import { rpc } from './native';
import { importPgn } from '../chess/game';
import type { Game } from '../types';
interface PublicGame {
  pgn: string;
  end_time: number;
  time_class: string;
  time_control: string;
  url: string;
}
const pending = new Map<string, Promise<Game[]>>();
export function downloadGames(username: string, months = 2): Promise<Game[]> {
  const key = `${username.trim().toLowerCase()}:${months}`;
  let request = pending.get(key);
  if (!request) {
    request = fetchGames(username.trim(), months).finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}
async function fetchGames(username: string, months: number): Promise<Game[]> {
  const result = await rpc<{ games: PublicGame[] }>('sync', { username, months });
  const games: Game[] = [];
  for (const g of result.games) {
    if (!g.pgn) continue;
    games.push(
      await importPgn(g.pgn, {
        date: g.end_time * 1000,
        timeClass: g.time_class,
        timeControl: g.time_control,
        source: 'chess.com',
        url: g.url,
      }),
    );
  }
  return games.sort((a, b) => b.date - a.date);
}
