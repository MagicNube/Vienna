export const FEEDBACK_EMAIL = 'jesus.caravaca@protonmail.com';
export const FEEDBACK_SUBJECT = 'Sugerencias Vienna';
export const FEEDBACK_ENDPOINT = 'https://api.web3forms.com/submit';
export const FEEDBACK_VERSION = import.meta.env.VITE_APP_VERSION || 'Desarrollo';
// Public submission identifier (not an account/API secret). Empty override enables mail-only builds.
export const feedbackAccessKey = (
  import.meta.env.VITE_WEB3FORMS_ACCESS_KEY ?? '9462abfa-3f33-4b76-9ac7-3b3958d6e86b'
).trim();

export const feedbackKinds = {
  problem: 'Informar de un problema',
  suggestion: 'Proponer una mejora',
  question: 'Hacer una consulta',
} as const;
export type FeedbackKind = keyof typeof feedbackKinds;
export type FeedbackDraft = {
  kind: FeedbackKind;
  message: string;
  contact: string;
  version: string;
  platform: string;
};

export function feedbackPlatform(agent: string): string {
  if (/Windows/i.test(agent)) return 'Windows';
  if (/Android/i.test(agent)) return 'Android';
  if (/iPhone|iPad/i.test(agent)) return 'iOS';
  if (/Macintosh|Mac OS/i.test(agent)) return 'macOS';
  if (/Linux/i.test(agent)) return 'Linux';
  return 'Desconocido';
}

function validate(draft: FeedbackDraft): void {
  if (!(draft.kind in feedbackKinds)) throw Error('Selecciona el tipo de mensaje.');
  if (draft.message.trim().length < 10) throw Error('Escribe al menos 10 caracteres.');
  if (draft.message.trim().length > 6000) throw Error('El mensaje admite hasta 6000 caracteres.');
  if (draft.contact.trim().length > 160) throw Error('El contacto admite hasta 160 caracteres.');
}

export function feedbackText(draft: FeedbackDraft): string {
  validate(draft);
  return [
    `Tipo: ${feedbackKinds[draft.kind]}`,
    `Vienna: ${draft.version}`,
    `Sistema: ${draft.platform}`,
    `Contacto: ${draft.contact.trim() || 'No indicado'}`,
    '',
    draft.message.trim(),
  ].join('\n');
}

export function feedbackMailto(draft: FeedbackDraft): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(feedbackText(draft))}`;
}

export async function sendFeedback(
  draft: FeedbackDraft,
  accessKey: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<void> {
  validate(draft);
  if (!accessKey.trim())
    throw Error('El envío directo todavía no está configurado. Usa tu correo.');
  const contact = draft.contact.trim();
  const timeout = AbortSignal.timeout(15000);
  const response = await fetcher(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    body: JSON.stringify({
      access_key: accessKey.trim(),
      subject: FEEDBACK_SUBJECT,
      from_name: 'Vienna',
      tipo: feedbackKinds[draft.kind],
      message: draft.message.trim(),
      contacto: contact || 'No indicado',
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? { email: contact } : {}),
      version: draft.version,
      sistema: draft.platform,
      botcheck: false,
    }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true
  )
    throw Error(
      response.status === 429
        ? 'Se han enviado demasiados mensajes. Espera un poco o usa tu correo.'
        : 'No se pudo enviar el mensaje. Puedes intentarlo de nuevo o usar tu correo.',
    );
}
