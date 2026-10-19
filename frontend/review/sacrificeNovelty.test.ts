import { expect, it } from 'vitest';
import { classify } from './classification';
import fixture from './fixtures/sacrifice-novelty.json';
import type { EngineLine, PositionNode } from '../types';

it.each(fixture.fixtures)('$description', ({ before, after, lines, next, expected }) => {
  const rating = classify(
    before as PositionNode,
    after as PositionNode,
    lines as EngineLine[],
    next as EngineLine,
  );
  expect(rating.category).toBe(expected);
  expect(rating.loss).toBe(0);
  expect(rating.best).toBe(after.uci);
});
