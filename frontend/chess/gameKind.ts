import type { Game } from '../types';

export type GameKind = 'regular' | 'coach' | 'bot';
const cached = new WeakMap<
  Game,
  { pgn: string; url?: string; source: Game['source']; kind: GameKind }
>();

function headers(pgn: string) {
  const values: Record<string, string> = {};
  let remaining = pgn.trimStart();
  // Read only the header block: move comments are not game metadata.
  while (remaining.startsWith('[')) {
    const newline = remaining.indexOf('\n');
    const line = newline < 0 ? remaining : remaining.slice(0, newline);
    const match = line.trim().match(/^\[(\w+)\s+"((?:\\.|[^"\\])*)"\]$/);
    if (!match) break;
    values[match[1].toLowerCase()] = match[2]
      .replace(/\\(["\\])/g, '$1')
      .trim()
      .toLowerCase();
    if (newline < 0) break;
    remaining = remaining.slice(newline + 1).trimStart();
  }
  return values;
}

function chessComUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      ['chess.com', 'www.chess.com'].includes(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

/** Identify computer games from metadata, never from a player's nickname. */
export function gameKind(game: Game): GameKind {
  const saved = cached.get(game);
  if (saved && saved.pgn === game.pgn && saved.url === game.url && saved.source === game.source)
    return saved.kind;
  const tags = headers(game.pgn);
  const urls = [chessComUrl(game.url), chessComUrl(tags.link), chessComUrl(tags.site)].filter(
    (url): url is URL => !!url,
  );
  const chessCom =
    game.source === 'chess.com' ||
    ['chess.com', 'www.chess.com'].includes(tags.site) ||
    urls.length > 0;
  let kind: GameKind = 'regular';
  if (chessCom && tags.event?.replace(/\s+/g, ' ') === 'play vs coach') kind = 'coach';
  else if (
    urls.some((url) => /^\/game\/computer\/\d+\/?$/i.test(url.pathname)) ||
    [tags.whitetype, tags.blacktype].includes('program') ||
    (chessCom && ['play vs computer', 'play vs bot'].includes(tags.event))
  )
    kind = 'bot';
  cached.set(game, { pgn: game.pgn, url: game.url, source: game.source, kind });
  return kind;
}

export function isTrainingGame(game: Game) {
  return gameKind(game) !== 'regular';
}
