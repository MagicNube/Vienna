import { describe, it, expect } from 'vitest';
import { cycleCategory, pauseCategoryTour } from './categoryTour';
import { autoCandidates } from './autoCandidates';
import { addMove, makeTree } from '../chess/game';
import { freeLine } from '../chess/freeBoard';
import type { MoveReview, Game } from '../types';
const moves: MoveReview[] = [
  { ply: 19, color: 'w', category: 'brilliant', loss: 0, explanation: '', best: '' },
  { ply: 25, color: 'w', category: 'brilliant', loss: 0, explanation: '', best: '' },
  { ply: 6, color: 'b', category: 'blunder', loss: 0.3, explanation: '', best: '' },
];
describe('recorrido de categorías', () => {
  it('al navegar libremente oculta el recorrido, conserva Volver y reinicia desde la posición actual', () => {
    const first = cycleCategory(moves, 'brilliant', 'm8', null)!;
    const paused = pauseCategoryTour(first, 'm20')!;
    expect(paused).toMatchObject({ origin: 'm8', paused: true, index: 0 });
    expect(pauseCategoryTour(paused, first.target)?.paused).toBe(true);
    expect(cycleCategory(moves, 'brilliant', 'm20', paused)).toMatchObject({
      origin: 'm20',
      target: 'm19',
      index: 0,
      total: 2,
    });
    expect(pauseCategoryTour(paused, 'm8')).toBeNull();
    expect(pauseCategoryTour(null, 'm20')).toBeNull();
  });
  it('recorre cada coincidencia y termina para recuperar la posición de origen', () => {
    const first = cycleCategory(moves, 'brilliant', 'custom-position', null)!;
    expect(first).toMatchObject({ origin: 'custom-position', target: 'm19', index: 0, total: 2 });
    const second = cycleCategory(moves, 'brilliant', first.target, first)!;
    expect(second.target).toBe('m25');
    expect(cycleCategory(moves, 'brilliant', second.target, second)).toBeNull();
    expect(cycleCategory(moves, 'blunder', second.target, second)).toMatchObject({
      origin: 'custom-position',
      target: 'm6',
      total: 1,
    });
  });
  it('no cambia de posición al pulsar una categoría vacía', () => {
    expect(cycleCategory(moves, 'mistake', 'm0', null)).toBeNull();
  });
  it('filtra por color y conserva el origen al pasar de ambos a blancas o negras', () => {
    const mixed = [...moves, { ...moves[0], ply: 20, color: 'b' as const }];
    const all = cycleCategory(mixed, 'brilliant', 'm8', null)!;
    expect(cycleCategory(mixed, 'brilliant', all.target, all)?.target).toBe('m20');
    const white = cycleCategory(mixed, 'brilliant', all.target, all, 'w')!;
    expect(white).toMatchObject({ target: 'm19', total: 2, origin: 'm8', color: 'w' });
    expect(cycleCategory(mixed, 'brilliant', white.target, white, 'w')?.target).toBe('m25');
    const black = cycleCategory(mixed, 'brilliant', white.target, white, 'b')!;
    expect(black).toMatchObject({ target: 'm20', total: 1, origin: 'm8', color: 'b' });
    expect(cycleCategory(mixed, 'brilliant', black.target, black, 'b')).toBeNull();
  });
});
describe('navegación del modo libre', () => {
  it('conserva la rama seleccionada al retroceder hasta el inicio y permite cambiar de rama', () => {
    const tree = makeTree('1. e4 e5 2. Nf3 *');
    const branch = addMove(tree, 'm1', 'c7', 'c5');
    const tip = addMove(branch.tree, branch.node.id, 'g1', 'f3');
    expect(freeLine(tip.tree, 'm0', tip.node.id).map((n) => n.san)).toEqual(['e4', 'c5', 'Nf3']);
    expect(freeLine(tip.tree, 'm1', tip.node.id).at(-1)?.id).toBe(tip.node.id);
    expect(freeLine(tip.tree, 'm2', tip.node.id).map((n) => n.san)).toEqual(['e4', 'e5', 'Nf3']);
  });
});
describe('cola automática de partidas terminadas', () => {
  const game = (id: string, meta: Partial<Game> = {}): Game => ({
    id,
    pgn: '1. e4 *',
    white: 'Player',
    black: 'Other',
    result: '1-0',
    source: 'chess.com',
    date: 200,
    timeClass: 'blitz',
    timeControl: '180',
    ...meta,
  });
  it('excluye historial anterior, partidas en curso, PGN y otras cuentas; no duplica trabajos', () => {
    const candidates = autoCandidates(
      [
        game('new'),
        game('new'),
        game('old', { date: 99 }),
        game('live', { result: '*' }),
        game('pgn', { source: 'pgn' }),
        game('other', { white: 'Someone' }),
        game('black', { white: 'Other', black: 'PLAYER', date: 150 }),
      ],
      'player',
      100,
    );
    expect(candidates.map((g) => g.id)).toEqual(['black', 'new']);
  });
  it('no confunde la primera descarga de otra cuenta con partidas nuevas', () => {
    const candidates = autoCandidates(
      [
        game('discovered', { date: 50 }),
        game('history', { date: 30 }),
        game('live', { date: 50, result: '*' }),
        game('other', { date: 50, white: 'Other' }),
      ],
      'Player',
      100,
    );
    expect(candidates.map((game) => game.id)).toEqual([]);
  });
});
