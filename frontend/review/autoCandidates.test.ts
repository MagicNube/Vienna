import { expect, it } from 'vitest';
import { autoCandidates } from './autoCandidates';
import type { Game } from '../types';

it('no vuelve a encolar automáticamente un análisis borrado aunque antes fuese una partida nueva', () => {
  const games = [
    { id: 'old', source: 'chess.com', white: 'Me', black: 'Opponent', result: '1-0', date: 100 },
    { id: 'new', source: 'chess.com', white: 'Me', black: 'Opponent', result: '0-1', date: 300 },
  ] as Game[];
  expect(autoCandidates(games, 'Me', 0, new Set(['old'])).map((g) => g.id)).toEqual(['new']);
});
