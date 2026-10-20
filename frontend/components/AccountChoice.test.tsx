import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountChoice } from './AccountChoice';

const actions = { onContinue: () => {}, onNew: () => {} };
it('presenta una elección explícita entre la cuenta guardada y un nombre nuevo', () => {
  const html = renderToStaticMarkup(<AccountChoice {...actions} username="Player" busy={false} />);
  expect(html).toContain('Continuar con Player');
  expect(html).toContain('Usar otro nombre');
  expect(html).not.toContain('disabled');
});
it('impide repetir las acciones mientras se abre la cuenta', () => {
  const html = renderToStaticMarkup(<AccountChoice {...actions} username="Player" busy />);
  expect(html).toContain('Abriendo cuenta…');
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
