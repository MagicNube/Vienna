import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { gameStage, ReviewStatus } from './ReviewStatus';

it('distingue revisión guardada, en cola y progreso sin dar una parcial por terminada', () => {
  expect(renderToStaticMarkup(<ReviewStatus reviewed={false} />)).toBe('');
  expect(renderToStaticMarkup(<ReviewStatus reviewed={true} />)).toContain('Analizada');
  expect(
    renderToStaticMarkup(<ReviewStatus reviewed={false} job={{ state: 'queued', done: 0 }} />),
  ).toContain('En cola');
  const running = renderToStaticMarkup(
    <ReviewStatus reviewed={true} job={{ state: 'analysing', done: 2, total: 10 }} />,
  );
  expect(running).toContain('Analizando 20%');
  expect(running).not.toContain('Analizada');
  expect(
    renderToStaticMarkup(<ReviewStatus reviewed={true} job={{ state: 'queued', done: 0 }} />),
  ).toContain('Analizada');
  expect(
    renderToStaticMarkup(
      <ReviewStatus reviewed={true} job={{ state: 'queued', done: 0, manual: true }} />,
    ),
  ).toContain('En cola');
});

it('solo muestra Revisada si existe un análisis completo guardado', () => {
  const html = renderToStaticMarkup(<ReviewStatus reviewed seen showUnreviewed />);
  expect(html).toContain('Revisada');
  expect(html).not.toContain('Analizada');
  expect(html).not.toContain('Sin analizar');
  expect((html.match(/<svg/g) ?? []).length).toBe(1);
  expect(gameStage(true, true)).toBe('seen');
  expect(gameStage(false, true)).toBe('pending');
  expect(renderToStaticMarkup(<ReviewStatus reviewed={false} seen showUnreviewed />)).toContain(
    'Sin analizar',
  );
  expect(renderToStaticMarkup(<ReviewStatus reviewed={false} seen />)).toBe('');
  expect(gameStage(true, false)).toBe('analysed');
  expect(gameStage(false, false)).toBe('pending');
});
