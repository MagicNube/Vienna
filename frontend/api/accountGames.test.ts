import { expect, it } from 'vitest';
import { accountGames, updatedGames } from './accountGames';
import type { Game } from '../types';
import { ownColor } from '../review/statistics';

const games = [
  { id: 'other', white: 'Other', black: 'Rival', date: 300 },
  { id: 'white', white: 'Me', black: 'Rival', date: 100 },
  { id: 'black', white: 'Rival', black: 'ME', date: 200 },
] as Game[];

it('reutiliza la biblioteca cuando una descarga no cambia los datos', () => {
  expect(
    updatedGames(
      games,
      games.map((game) => ({ ...game })),
    ),
  ).toBe(games);
});

it('actualiza metadatos aunque el identificador y las jugadas no cambien', () => {
  const previous: Game[] = [
    {
      id: 'same',
      pgn: '1. e4 *',
      white: 'Me',
      black: 'Rival',
      result: '*',
      date: 1,
      timeClass: 'pgn',
      timeControl: '—',
      source: 'pgn',
    },
  ];
  const changes: Partial<Game>[] = [
    { date: 2 },
    { timeClass: 'blitz' },
    { timeControl: '180+2' },
    { source: 'chess.com' },
    { url: 'https://www.chess.com/game/live/1' },
    { whiteElo: '800' },
    { blackElo: '900' },
    { result: '1-0' },
    { white: 'ME' },
    { black: 'Other' },
    { pgn: '1. d4 *' },
  ];
  for (const change of changes) {
    const next = [{ ...previous[0], ...change }];
    expect(updatedGames(previous, next)).toBe(next);
  }
  const withRating = [{ ...previous[0], whiteElo: '800' }];
  expect(updatedGames(withRating, previous)).toBe(previous);
});

it('respeta altas, bajas y cambios de orden', () => {
  const reversed = [...games].reverse();
  expect(updatedGames(games, reversed)).toBe(reversed);
  const smaller = games.slice(1);
  expect(updatedGames(games, smaller)).toBe(smaller);
  expect(updatedGames(smaller, games)).toBe(games);
});

it('las últimas partidas se limitan a la cuenta en ambos colores sin modificar la biblioteca', () => {
  expect(accountGames(games, ' me ').map((g) => g.id)).toEqual(['black', 'white']);
  expect(games.map((g) => g.id)).toEqual(['other', 'white', 'black']);
});
it('cambiar a otra cuenta no muestra las partidas de la anterior', () => {
  expect(accountGames(games, 'Other').map((g) => g.id)).toEqual(['other']);
  expect(accountGames(games, 'Friend')).toEqual([]);
});
it('sin cuenta se conserva el acceso a las partidas importadas', () => {
  expect(accountGames(games, '').map((g) => g.id)).toEqual(['other', 'black', 'white']);
});

it('aísla bibliotecas y estadísticas de cuentas consultadas, conservando sus enfrentamientos', () => {
  const mixed = [
    { id: 'mine', white: 'PlayerOne', black: 'Rival', date: 1 },
    { id: 'foreign', white: 'Rival', black: 'OtherPlayer', date: 2 },
    { id: 'shared', white: 'OtherPlayer', black: 'PlayerOne', date: 3 },
  ] as Game[];
  const mine = accountGames(mixed, ' playerone ');
  expect(mine.map((g) => g.id)).toEqual(['shared', 'mine']);
  expect(accountGames(mixed, 'OTHERPLAYER').map((g) => g.id)).toEqual(['shared', 'foreign']);
  expect(mixed.filter((g) => ownColor(g, 'PlayerOne', 'w')).map((g) => g.id)).toEqual([
    'mine',
    'shared',
  ]);
  expect(mixed).toHaveLength(3);
});
