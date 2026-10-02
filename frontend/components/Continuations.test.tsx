import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Continuations } from './Continuations';
import { makeTree } from '../chess/game';
import type { EngineLine } from '../types';
const tree = makeTree('1. e4 e5 *');
const lines: EngineLine[] = [
  { rank: 1, depth: 20, nodes: 1000, cp: 232, mate: null, wdl: null, pv: ['d2d4'] },
  { rank: 2, depth: 20, nodes: 1000, cp: -51, mate: null, wdl: null, pv: ['e2e4', 'e7e5'] },
];
it('pone la jugada de la partida antes de las opciones, con signos blancos y estrella independiente del fondo', () => {
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[0]}
      review={null}
      lines={lines}
      busy={false}
      freeMode={false}
      onMove={() => {}}
      onSelect={() => {}}
      onPreview={() => {}}
    />,
  );
  expect(html.indexOf('Jugada de la partida')).toBeLessThan(html.indexOf('Opciones del motor'));
  expect(html).toContain('evaluation-tone w');
  expect(html).toContain('evaluation-tone b');
  expect(html).toContain('+2.32');
  expect(html).toContain('−0.51');
  expect(html).toContain('aria-label="Mejor opción del motor"');
  expect(html).not.toContain('pv-score best');
});
it('no inventa una jugada de partida en modo libre', () => {
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[0]}
      review={null}
      lines={lines}
      busy={false}
      freeMode
      onMove={() => {}}
      onSelect={() => {}}
      onPreview={() => {}}
    />,
  );
  expect(html).not.toContain('Jugada de la partida');
  expect(html).toContain('Opciones del motor');
});
