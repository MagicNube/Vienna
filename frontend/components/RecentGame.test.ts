import { expect, it } from 'vitest';
import { relativeGameTime, accountOutcome } from './RecentGame';
import type { Game } from '../types';

const now = Date.UTC(2026, 8, 29, 21);
const minute = 60_000;

it('muestra la antigüedad en minutos, horas y días completos', () => {
  expect(relativeGameTime(now - 5 * minute, now)).toBe('Hace 5m');
  expect(relativeGameTime(now - 10 * minute, now)).toBe('Hace 10m');
  expect(relativeGameTime(now - 3 * 24 * 60 * minute, now)).toBe('Hace 3d');
  expect(relativeGameTime(now - 59 * minute, now)).toBe('Hace 59m');
  expect(relativeGameTime(now - 60 * minute, now)).toBe('Hace 1h');
  expect(relativeGameTime(now - 24 * 60 * minute, now)).toBe('Hace 1d');
});

it('evita minutos negativos y reconoce fechas ausentes', () => {
  expect(relativeGameTime(now - 59_999, now)).toBe('Ahora');
  expect(relativeGameTime(now + minute, now)).toBe('Ahora');
  expect(relativeGameTime(Number.NaN, now)).toBe('Sin fecha');
  expect(relativeGameTime(0, now)).toBe('Sin fecha');
});

it('identifica el resultado propio tanto con blancas como con negras y sin marcar al rival', () => {
  const white = { white: 'Me', black: 'Rival', result: '1-0' } as Game;
  const black = { ...white, white: 'Rival', black: 'Me' };
  expect(accountOutcome(white, 'ME')).toBe('win');
  expect(accountOutcome(black, 'me')).toBe('loss');
  expect(accountOutcome({ ...white, result: '0-1' }, 'Me')).toBe('loss');
  expect(accountOutcome({ ...black, result: '0-1' }, 'Me')).toBe('win');
  expect(accountOutcome({ ...white, result: '1/2-1/2' }, 'Me')).toBe('draw');
  expect(accountOutcome({ ...black, result: '1/2-1/2' }, 'Me')).toBe('draw');
  expect(accountOutcome(white, 'Other')).toBeNull();
  expect(accountOutcome(white, '')).toBeNull();
  expect(accountOutcome({ ...white, result: '*' }, 'Me')).toBeNull();
});
