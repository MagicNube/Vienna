import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsActions } from './SettingsActions';
import { FEEDBACK_FORM_ID } from './HelpSettings';

const callbacks = { onClose: () => {}, onError: () => {} };

it('offers an explicit close action outside the feedback flow', () => {
  const html = renderToStaticMarkup(<SettingsActions {...callbacks} feedbackAction={null} />);
  expect(html).toContain('type="button"');
  expect(html).toContain('Listo');
  expect(html).not.toContain(`form="${FEEDBACK_FORM_ID}"`);
});

it.each([
  ['ready', 'Enviar opinión', false],
  ['sending', 'Enviando…', true],
  ['sent', 'Enviado', true],
] as const)(
  'keeps the footer associated with the feedback form in state %s',
  (state, label, disabled) => {
    const html = renderToStaticMarkup(
      <SettingsActions {...callbacks} feedbackAction={{ state, label }} />,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain(`form="${FEEDBACK_FORM_ID}"`);
    expect(html).toContain(label);
    expect(html.includes('disabled=""')).toBe(disabled);
    expect(html).not.toContain('Listo');
  },
);
