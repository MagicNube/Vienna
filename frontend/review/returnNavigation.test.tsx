import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { addMove, makeTree } from '../chess/game';
import { mainOrigin, returnContext } from './returnNavigation';
import { ReturnControl } from '../components/ReturnControl';
import type { CategoryTour } from './categoryTour';

const base = makeTree('1. e4 e5 2. Nf3 Nc6 *');
const tour: CategoryTour = {
  origin: 'm1',
  target: 'm3',
  category: 'brilliant',
  color: 'w',
  index: 0,
  total: 2,
};

it('returns a nested custom line to its original main-game branch point', () => {
  const first = addMove(base, 'm1', 'c7', 'c5');
  const second = addMove(first.tree, first.node.id, 'g1', 'f3');
  const result = returnContext(second.tree, second.node, null, false);
  expect(result).toMatchObject({ kind: 'custom', target: { id: 'm1' } });
  expect(mainOrigin(second.tree, second.node)?.id).toBe('m1');
  expect(returnContext(second.tree, result!.target, null, false)).toBeNull();
});

it('leaves Custom before the category and keeps the category origin intact', () => {
  const custom = addMove(base, 'm3', 'd7', 'd6');
  const first = returnContext(custom.tree, custom.node, tour, false)!;
  expect(first).toMatchObject({ kind: 'custom', target: { id: 'm3' } });
  const second = returnContext(custom.tree, first.target, tour, false)!;
  expect(second).toMatchObject({ kind: 'category', category: 'brilliant', target: { id: 'm1' } });
  expect(tour.origin).toBe('m1');
});

it('returns to a custom origin after a category tour, then to that custom line’s own branch point', () => {
  const first = addMove(base, 'm1', 'c7', 'c5');
  const second = addMove(first.tree, 'm3', 'd7', 'd6');
  const fromCustom = { ...tour, origin: first.node.id };
  const backToCategory = returnContext(second.tree, second.node, fromCustom, false)!;
  expect(backToCategory.target.id).toBe('m3');
  const backToCustom = returnContext(second.tree, backToCategory.target, fromCustom, false)!;
  expect(backToCustom.target.id).toBe(first.node.id);
  const final = returnContext(second.tree, backToCustom.target, null, false)!;
  expect(final.target.id).toBe('m1');
});

it('does not invent a return in the main game, free mode or a missing tour origin', () => {
  expect(returnContext(base, base.nodes[2], null, false)).toBeNull();
  expect(returnContext(base, base.nodes[2], tour, true)).toBeNull();
  expect(returnContext(base, base.nodes[2], { ...tour, origin: 'missing' }, false)).toBeNull();
});

it('keeps Return enabled after leaving the category selection to browse the game', () => {
  const context = returnContext(base, base.nodes[4], { ...tour, paused: true }, false);
  expect(context?.target.id).toBe('m1');
  expect(
    renderToStaticMarkup(<ReturnControl context={context} onReturn={() => {}} />),
  ).not.toContain('disabled');
});

it('shows context and a destination label in the same control for both actions', () => {
  const custom = addMove(base, 'm1', 'c7', 'c5');
  const customHtml = renderToStaticMarkup(
    <ReturnControl
      context={returnContext(custom.tree, custom.node, null, false)}
      onReturn={() => {}}
    />,
  );
  expect(customHtml).toContain('Custom');
  expect(customHtml).toContain('Volver a 1. e4. Custom (Esc)');
  expect(customHtml).not.toContain('<span');
  const categoryHtml = renderToStaticMarkup(
    <ReturnControl context={returnContext(base, base.nodes[3], tour, false)} onReturn={() => {}} />,
  );
  expect(categoryHtml).toContain('Brillante');
  expect(categoryHtml).toContain('Volver a 1. e4. Brillante (Esc)');
  expect(categoryHtml).not.toContain('<span');
  const idle = renderToStaticMarkup(<ReturnControl context={null} onReturn={() => {}} />);
  expect(idle).toContain('disabled');
  expect(idle).toContain('Volver');
  expect(idle).not.toContain('<span');
});
