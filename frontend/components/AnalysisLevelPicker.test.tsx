import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisLevelPicker } from './AnalysisLevelPicker';

it('el nivel automático comparte la cinta de análisis y conserva opciones personalizadas', () => {
  const html = renderToStaticMarkup(
    <AnalysisLevelPicker
      value={750}
      onChange={() => {}}
      disabled
      label="Nivel automático"
      name="auto"
    />,
  );
  expect(html).not.toContain('<select');
  expect(html).toContain('Nivel automático');
  expect(html).toContain('disabled');
  expect((html.match(/type="radio"/g) ?? []).length).toBe(5);
  expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  expect(html).toContain('750 ms');
});
