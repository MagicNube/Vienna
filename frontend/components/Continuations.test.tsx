import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Continuations } from './Continuations';
import { makeTree } from '../chess/game';
import type { EngineLine } from '../types';
const tree = makeTree('1. Nf3 Nc6 2. e4 e5 *');
const lines: EngineLine[] = [
  { rank: 1, depth: 20, nodes: 1000, cp: 232, mate: null, wdl: null, pv: ['d2d4'] },
  { rank: 2, depth: 20, nodes: 1000, cp: -51, mate: null, wdl: null, pv: ['e2e4', 'e7e5'] },
];
it('pone la jugada de la partida antes de las opciones, con signos blancos y estrella independiente del fondo', () => {
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[2]}
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
  expect(html).toContain('2.ª opción');
  expect(html.match(/is-game-move/g)).toHaveLength(1);
  expect(html.slice(0, html.indexOf('Opciones del motor'))).not.toContain('is-game-move');
});
it('no inventa una jugada de partida en modo libre', () => {
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[2]}
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
  expect(html).not.toContain('is-game-move');
});
it.each([false, true])(
  'no muestra líneas ni jugada de partida en el inicio normal (modo libre: %s)',
  (freeMode) => {
    const html = renderToStaticMarkup(
      <Continuations
        tree={tree}
        node={tree.nodes[0]}
        review={null}
        lines={lines}
        busy={false}
        freeMode={freeMode}
        onMove={() => {}}
        onSelect={() => {}}
        onPreview={() => {}}
      />,
    );
    expect(html).toContain('Haz una jugada para ver las continuaciones.');
    expect(html).not.toContain('pv-line');
    expect(html).not.toContain('Jugada de la partida');
    expect(html).not.toContain('Mejor opción del motor');
  },
);

it.each([1, 3, 4, 5])('identifica la jugada de la partida como opción %s', (rank) => {
  const candidates = Array.from({ length: 5 }, (_, index) => ({
    ...lines[0],
    rank: index + 1,
    cp: 20 - index,
    pv: [index === rank - 1 ? 'e2e4' : ['d2d4', 'g2g3', 'c2c4', 'b2b3', 'f2f4'][index]],
  }));
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[2]}
      review={null}
      lines={candidates}
      busy={false}
      freeMode={false}
      onMove={() => {}}
      onSelect={() => {}}
      onPreview={() => {}}
    />,
  );
  expect(html).toContain(rank === 1 ? 'Mejor opción' : `${rank}.ª opción`);
  expect(html.match(/is-game-move/g)).toHaveLength(1);
  expect(html.match(/class="pv-line/g)).toHaveLength(6);
});
it('una jugada fuera de las líneas no se etiqueta como quinta o sexta por su evaluación posterior', () => {
  const candidates = [
    { ...lines[0], pv: ['d2d4'] },
    { ...lines[1], pv: ['g2g3'] },
  ];
  const html = renderToStaticMarkup(
    <Continuations
      tree={tree}
      node={tree.nodes[2]}
      review={null}
      lines={candidates}
      busy={false}
      freeMode={false}
      onMove={() => {}}
      onSelect={() => {}}
      onPreview={() => {}}
    />,
  );
  expect(html).toContain('Otra opción');
  expect(html).not.toContain('is-game-move');
});
