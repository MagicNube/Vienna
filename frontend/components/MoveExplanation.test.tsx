import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveExplanation } from './MoveExplanation';
import { makeTree } from '../chess/game';
import type { MoveReview } from '../types';
const node = makeTree('1. e4 *').nodes[1];
const move: MoveReview = {
  ply: 1,
  color: 'w',
  category: 'brilliant',
  loss: 0,
  best: 'e2e4',
  explanation: 'Explicación de la jugada',
};
it.each([
  ['1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. d3 *', 'h5f7', '4.Dxf7#'],
  ['1. f3 e5 2. g4 Qe7 *', 'd8h4', '2…Dh4#'],
])(
  'compacts a saved missed opportunity without changing the stored review (%s)',
  (pgn, best, san) => {
    const [before, after] = makeTree(pgn).nodes.slice(-2);
    const saved = {
      ...move,
      category: 'miss' as const,
      best,
      explanation: 'Descripción antigua larga',
    };
    const html = renderToStaticMarkup(
      <MoveExplanation before={before} node={after} move={saved} />,
    );
    expect(html).toContain(san);
    expect(html).toContain('Esta jugada la pierde.');
    expect(html).not.toContain(saved.explanation);
    expect(saved.explanation).toBe('Descripción antigua larga');
    expect(saved.category).toBe('miss');
  },
);
it('retains the stored explanation when a saved recommendation is unavailable', () => {
  const html = renderToStaticMarkup(
    <MoveExplanation
      before={makeTree('*').nodes[0]}
      node={node}
      move={{ ...move, category: 'miss', best: 'a1a8' }}
    />,
  );
  expect(html).toContain(move.explanation);
  expect(html).not.toContain('undefined');
});
it('expone la explicación mediante un botón con estado y panel desplegable accesibles', () => {
  const html = renderToStaticMarkup(<MoveExplanation node={node} move={move} />);
  expect(html).toContain('Explicación de la jugada');
  expect(html).toContain('popover="auto"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('Ver explicación de e4, Brillante');
  expect(html).toContain('Cerrar explicación');
  expect(html).not.toContain('explanation-panel');
  expect(html).not.toContain('explanation-actions');
});
it('no añade texto ni controles cuando todavía no hay valoración', () => {
  const html = renderToStaticMarkup(<MoveExplanation node={node} />);
  expect(html).toBe('');
});
it('no reserva una tarjeta para la posición inicial', () => {
  const html = renderToStaticMarkup(<MoveExplanation node={makeTree('*').nodes[0]} />);
  expect(html).toBe('');
});
