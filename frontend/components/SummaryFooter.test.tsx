import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SummaryFooter } from './SummaryFooter';
import { makeTree } from '../chess/game';
import type { MoveReview } from '../types';
const node = makeTree('1. e4 *').nodes[1];
const tour = {
  origin: 'm0',
  target: 'm1',
  category: 'brilliant' as const,
  color: 'w' as const,
  index: 0,
  total: 1,
};
const move: MoveReview = {
  ply: 1,
  color: 'w',
  category: 'brilliant',
  loss: 0,
  best: 'e2e4',
  explanation: 'Explicación de la jugada',
};
it('only shows the category return button in review', () => {
  const review = renderToStaticMarkup(
    <SummaryFooter tab="review" tour={tour} node={node} move={move} onReturn={() => {}} />,
  );
  expect(review).toContain('Volver a mi posición');
  expect(review).toContain('Blancas');
  expect(review).toContain('<strong>1/1</strong>');
  expect(review).toContain('Explicación de la jugada');
  const moves = renderToStaticMarkup(
    <SummaryFooter tab="moves" tour={tour} node={node} move={move} onReturn={() => {}} />,
  );
  expect(moves).not.toContain('Volver');
  expect(moves).toContain('Explicación de la jugada');
});
it('keeps the footer without a return action when no category is selected', () => {
  const html = renderToStaticMarkup(
    <SummaryFooter tab="review" tour={null} node={node} onReturn={() => {}} />,
  );
  expect(html).toContain('summary-footer');
  expect(html).toContain('todavía no tiene valoración');
  expect(html).not.toContain('<button');
});
it('explains the initial position in either tab without empty space', () => {
  for (const tab of ['review', 'moves'] as const) {
    const html = renderToStaticMarkup(
      <SummaryFooter tab={tab} tour={null} node={makeTree('*').nodes[0]} onReturn={() => {}} />,
    );
    expect(html).toContain('Posición inicial');
    expect(html).toContain('Selecciona una jugada');
    expect(html).not.toContain('Volver');
  }
});
