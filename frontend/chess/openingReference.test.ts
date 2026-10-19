import { expect, it } from 'vitest';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { openingReference, openingReferences } from './openingReference';

it('all shipped reference lines replay legally from the initial board', () => {
  for (const name of Object.keys(openingReferences)) {
    const reference = openingReference(name)!;
    expect(reference.tree.rootFen).toBe(DEFAULT_POSITION);
    expect(reference.tree.nodes.length - 1).toBe(reference.moves.length);
    expect(reference.moves.length).toBeGreaterThan(0);
    expect(new Chess(reference.tree.nodes.at(-1)!.fen).isGameOver()).toBe(false);
  }
});
it('provides the Vienna position and rejects unavailable or inherited names', () => {
  expect(openingReference('Vienna Game')!.tree.nodes.at(-1)!.san).toBe('Nc3');
  expect(openingReference('Sin identificar')).toBeNull();
  expect(openingReference('__proto__')).toBeNull();
  expect(openingReference('constructor')).toBeNull();
});
