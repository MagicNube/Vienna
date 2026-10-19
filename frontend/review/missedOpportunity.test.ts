import { describe, expect, it } from 'vitest';
import { makeTree } from '../chess/game';
import { classify, accuracy, categories, CLASSIFICATION_VERSION } from './classification';
import { withMissedOpportunity } from './missedOpportunity';
import { upgradeReview } from './upgradeReview';
import { statistics } from './statistics';
import type { Color, EngineLine, Review } from '../types';

function setup(color: Color = 'w') {
  // Legal games: each opponent move permits mate in one, which is missed.
  // Scores here are controlled evidence; native/saved-game audits are separate.
  const tree = makeTree(
    color === 'w' ? '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. d3 *' : '1. f3 e5 2. g4 Qe7 *',
  );
  const [previous, before, after] = tree.nodes.slice(-3);
  const sign = color === 'w' ? 1 : -1;
  const line = (cp: number, move: string, rank = 1): EngineLine => ({
    cp: cp * sign,
    mate: null,
    wdl: null,
    pv: [move],
    rank,
    depth: 20,
    nodes: 1000,
  });
  const best: EngineLine = {
    ...line(0, color === 'w' ? 'h5f7' : 'd8h4'),
    cp: null,
    mate: sign,
    wdl: color === 'w' ? [1000, 0, 0] : [0, 0, 1000],
  };
  const played = line(0, after.uci, 2);
  const prior = line(0, color === 'w' ? 'g7g6' : 'g2g3');
  const context = { node: previous, lines: [prior, { ...best, pv: [before.uci], rank: 2 }] };
  const base = classify(before, after, [best, played], played);
  const rate = (current = [best, played], history = context, next = played) =>
    classify(before, after, current, next, undefined, history);
  return { tree, previous, before, after, line, best, played, prior, context, base, rate };
}

describe('oportunidades perdidas con contexto', () => {
  it.each(['w', 'b'] as const)(
    'reconoce un mate desaprovechado tras el error rival (%s)',
    (color) => {
      const t = setup(color);
      const result = t.rate();
      expect(t.base.category).toBe('blunder');
      expect(result.category).toBe('miss');
      expect(result.loss).toBe(t.base.loss);
      expect(result.best).toBe(t.base.best);
      expect(result.explanation).toContain('error del rival');
      expect(accuracy([result])).toBe(accuracy([t.base]));
    },
  );
  it('mantiene todas las categorías base cuando falta evidencia del turno anterior', () => {
    const t = setup();
    for (const category of Object.keys(categories) as (keyof typeof categories)[]) {
      const rating = { ...t.base, category };
      expect(withMissedOpportunity(rating, t.before, t.after, [t.best, t.played], t.played)).toBe(
        rating,
      );
    }
  });
  it('nunca sustituye Brillante, Genial, Libro, Mejor, Excelente ni Buena', () => {
    const t = setup();
    for (const category of ['brilliant', 'great', 'book', 'best', 'excellent', 'good'] as const) {
      const rating = { ...t.base, category };
      expect(
        withMissedOpportunity(rating, t.before, t.after, [t.best, t.played], t.played, t.context),
      ).toBe(rating);
    }
  });
  it('conservar una ventaja ganadora no es una oportunidad perdida, incluido +3,76 frente a +3,43', () => {
    const t = setup();
    const best = t.line(376, t.best.pv[0]);
    const played = t.line(343, t.after.uci, 2);
    expect(t.rate([best, played]).category).toBe('good');
    expect(t.rate([best, { ...played, cp: 200 }]).category).not.toBe('miss');
  });
  it('estar ya ganando antes del error rival conserva la clasificación ordinaria', () => {
    const t = setup();
    expect(
      t.rate(undefined, { ...t.context, lines: [{ ...t.prior, cp: 400 }, t.context.lines[1]] })
        .category,
    ).toBe('blunder');
  });
  it('requiere un error del rival, no un cambio de evaluación después de su mejor jugada', () => {
    const t = setup();
    expect(
      t.rate(undefined, { ...t.context, lines: [{ ...t.prior, pv: [t.before.uci] }] }).category,
    ).toBe('blunder');
    expect(
      t.rate(undefined, {
        ...t.context,
        lines: [t.prior, { ...t.context.lines[1], cp: 0, mate: null }],
      }).category,
    ).toBe('blunder');
  });
  it('requiere que el error haya creado una ventaja ganadora y una subida relevante', () => {
    const t = setup();
    expect(t.rate([{ ...t.best, cp: 200, mate: null }, t.played]).category).not.toBe('miss');
    const best = { ...t.best, cp: 300, mate: null };
    const history = {
      ...t.context,
      lines: [
        { ...t.prior, cp: 280 },
        { ...best, pv: [t.before.uci], rank: 2 },
      ],
    };
    expect(t.rate([best, t.played], history).category).not.toBe('miss');
  });
  it('rechaza evidencia superficial, profundidades mezcladas o posiciones ajenas', () => {
    const t = setup();
    expect(t.rate([{ ...t.best, depth: 15 }, t.played]).category).toBe('blunder');
    expect(t.rate([t.best, { ...t.played, depth: 19 }]).category).toBe('blunder');
    expect(
      t.rate(undefined, { ...t.context, node: { ...t.previous, id: 'unrelated' } }).category,
    ).toBe('blunder');
    expect(
      t.rate(undefined, { ...t.context, lines: [{ ...t.prior, pv: ['a1a8'] }] }).category,
    ).toBe('blunder');
  });
  it('actualiza revisiones guardadas sin cambiar evaluaciones, pérdida, precisión ni metadatos', () => {
    const t = setup();
    const review: Review = {
      version: 1,
      classificationVersion: 6,
      complete: true,
      engineId: 'test',
      options: { threads: 1, hash: 16, multiPv: 2, movetime: 5000, depth: null },
      positions: {
        [t.previous.id]: { engineId: 'test', cached: false, lines: t.context.lines },
        [t.before.id]: { engineId: 'test', cached: false, lines: [t.best, t.played] },
        [t.after.id]: { engineId: 'test', cached: false, lines: [t.played] },
      },
      moves: [classify(t.previous, t.before, t.context.lines, t.best), t.base],
    };
    const upgraded = upgradeReview(t.tree, review);
    expect(upgraded.classificationVersion).toBe(CLASSIFICATION_VERSION);
    expect(upgraded.moves.at(-1)!.category).toBe('miss');
    expect(upgraded.positions).toBe(review.positions);
    expect(upgraded.options).toBe(review.options);
    expect(upgraded.moves.at(-1)!.loss).toBe(t.base.loss);
    expect(accuracy(upgraded.moves)).toBe(accuracy(review.moves));
    expect(upgradeReview(t.tree, upgraded)).toBe(upgraded);
    const stats = statistics([
      {
        color: 'w',
        review: upgraded,
        game: {
          id: 'test',
          white: 'Player',
          black: 'Opponent',
          pgn: '',
          date: 1,
          result: '*',
          source: 'pgn',
          timeClass: 'pgn',
          timeControl: '',
        },
      },
    ]);
    expect(stats.counts.miss).toBe(1);
    expect(stats.counts.blunder).toBe(0);
    expect(stats.moves).toBe(1);
  });
});
