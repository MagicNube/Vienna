import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewStatus } from './ReviewStatus';

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
