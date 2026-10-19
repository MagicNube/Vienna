import { describe, expect, it, vi } from 'vitest';
import {
  FEEDBACK_EMAIL,
  FEEDBACK_ENDPOINT,
  FEEDBACK_SUBJECT,
  feedbackMailto,
  feedbackPlatform,
  feedbackText,
  sendFeedback,
  type FeedbackDraft,
} from './feedback';

const draft: FeedbackDraft = {
  kind: 'suggestion',
  message: 'Me gustaría comparar dos variantes & volver al tablero.',
  contact: '',
  version: '0.1.0',
  platform: 'Windows',
};
describe('voluntary product feedback', () => {
  it('addresses the requested mailbox and preserves the subject and multiline body', () => {
    const url = new URL(feedbackMailto(draft));
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(FEEDBACK_EMAIL);
    expect(url.searchParams.get('subject')).toBe('Sugerencias Vienna');
    expect(url.searchParams.get('body')).toBe(feedbackText(draft));
    expect(url.searchParams.get('body')).toContain('& volver');
  });
  it('sends only the visible draft and version/system metadata, without requiring contact', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await sendFeedback(draft, ' public-access-key ', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(FEEDBACK_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      access_key: 'public-access-key',
      subject: FEEDBACK_SUBJECT,
      from_name: 'Vienna',
      tipo: 'Proponer una mejora',
      message: draft.message,
      contacto: 'No indicado',
      version: '0.1.0',
      sistema: 'Windows',
      botcheck: false,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('uses an email reply address only when contact is actually an email', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    await sendFeedback({ ...draft, contact: '@ajedrecista' }, 'key', fetcher);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).not.toHaveProperty('email');
    await sendFeedback({ ...draft, contact: ' player@example.org ' }, 'key', fetcher);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toHaveProperty(
      'email',
      'player@example.org',
    );
  });
  it.each([
    [200, { success: false }],
    [429, { success: false }],
    [500, { success: true }],
    [200, {}],
  ])('does not report success for status %i and response %j', async (status, body) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(body), { status }));
    await expect(sendFeedback(draft, 'key', fetcher)).rejects.toThrow();
  });
  it('preserves network errors and rejects malformed responses', async () => {
    await expect(
      sendFeedback(draft, 'key', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))),
    ).rejects.toThrow('offline');
    await expect(
      sendFeedback(
        draft,
        'key',
        vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>bad gateway</html>')),
      ),
    ).rejects.toThrow('No se pudo enviar');
  });
  it('validates before making any request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(sendFeedback({ ...draft, message: '   ' }, 'key', fetcher)).rejects.toThrow(
      '10 caracteres',
    );
    await expect(
      sendFeedback({ ...draft, message: 'x'.repeat(6001) }, 'key', fetcher),
    ).rejects.toThrow('6000');
    await expect(sendFeedback(draft, ' ', fetcher)).rejects.toThrow('configurado');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('honours cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      init?.signal?.throwIfAborted();
      return new Response('{}');
    });
    await expect(sendFeedback(draft, 'key', fetcher, controller.signal)).rejects.toThrow();
  });
  it('uses a short operating-system label rather than transmitting the user agent', () => {
    expect(feedbackPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(feedbackPlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('Android');
    expect(feedbackPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('macOS');
    expect(feedbackPlatform('')).toBe('Desconocido');
  });
});
