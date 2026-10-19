import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  FEEDBACK_EMAIL,
  FEEDBACK_SUBJECT,
  FEEDBACK_VERSION,
  feedbackAccessKey,
  feedbackKinds,
  feedbackMailto,
  feedbackPlatform,
  sendFeedback,
  type FeedbackKind,
} from '../api/feedback';

export const FEEDBACK_FORM_ID = 'vienna-feedback-form';
export type FeedbackAction = {
  label: string;
  state: 'ready' | 'sending' | 'sent';
} | null;

export function HelpSettings({
  initialReport,
  active = true,
  onActionChange,
}: {
  initialReport?: string;
  active?: boolean;
  onActionChange?: (action: FeedbackAction) => void;
}) {
  const [kind, setKind] = useState<FeedbackKind | null>(initialReport ? 'problem' : null);
  const [message, setMessage] = useState(
    initialReport
      ? `Qué ha ocurrido:\n${initialReport.slice(0, 1500)}\n\nQué estaba haciendo:\n`
      : '',
  );
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const platform =
    typeof navigator === 'undefined' ? 'Desconocido' : feedbackPlatform(navigator.userAgent);
  const direct = Boolean(feedbackAccessKey);
  useEffect(() => {
    onActionChange?.(
      active && kind
        ? {
            label:
              state === 'sending'
                ? 'Enviando…'
                : state === 'sent'
                  ? 'Enviado'
                  : direct
                    ? 'Enviar opinión'
                    : 'Preparar correo',
            state: state === 'idle' ? 'ready' : state,
          }
        : null,
    );
  }, [active, kind, state, direct, onActionChange]);
  useEffect(() => () => onActionChange?.(null), [onActionChange]);
  useEffect(() => {
    if (active && kind) textarea.current?.focus({ preventScroll: true });
  }, [active, kind]);
  useEffect(() => {
    if (!active || (!error && !notice && state !== 'sent')) return;
    result.current?.focus({ preventScroll: true });
    result.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [active, error, notice, state]);
  useEffect(() => () => request.current?.abort(), []);
  const draft = () => ({
    kind: kind || ('suggestion' as FeedbackKind),
    message,
    contact,
    version: FEEDBACK_VERSION,
    platform,
  });
  function choose(value: FeedbackKind | null) {
    setKind(value);
    setState('idle');
    setError('');
    setNotice('');
  }
  async function openMail() {
    if (busy.current) return;
    busy.current = true;
    setError('');
    setNotice('');
    try {
      const url = feedbackMailto(draft());
      if (isTauri()) await openUrl(url);
      else window.location.href = url;
      setNotice('Revisa el mensaje en tu aplicación de correo y envíalo desde allí.');
    } catch (reason) {
      setError(
        reason instanceof Error && /caracteres/.test(reason.message)
          ? reason.message
          : `No se pudo abrir tu correo. Puedes enviar tu mensaje a ${FEEDBACK_EMAIL}.`,
      );
    } finally {
      busy.current = false;
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!direct) {
      await openMail();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setState('sending');
    setError('');
    setNotice('');
    const controller = new AbortController();
    request.current = controller;
    try {
      await sendFeedback(draft(), feedbackAccessKey, fetch, controller.signal);
      if (!controller.signal.aborted) setState('sent');
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(
          reason instanceof Error && !['TypeError', 'TimeoutError'].includes(reason.name)
            ? reason.message
            : 'No se pudo conectar. Revisa tu conexión o usa tu correo.',
        );
        setState('idle');
      }
    } finally {
      busy.current = false;
      request.current = null;
    }
  }
  return (
    <section className="help-settings" aria-labelledby="help-feedback-heading">
      <div className="help-heading">
        <h3 id="help-feedback-heading">Ayúdanos a mejorar Vienna</h3>
        {kind && state !== 'sending' && (
          <button type="button" onClick={() => choose(null)}>
            ← Ayuda
          </button>
        )}
      </div>
      {state === 'sent' ? (
        <div className="feedback-confirmation">
          <p ref={result} tabIndex={-1} role="status">
            Gracias. Tu mensaje se ha enviado.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMessage('');
              setContact('');
              choose(null);
            }}
          >
            Escribir otra opinión
          </button>
        </div>
      ) : !kind ? (
        <>
          <p className="help-description">
            Cuéntanos qué podemos mejorar o qué no ha funcionado como esperabas.
          </p>
          <div className="help-choices">
            <button type="button" onClick={() => choose('problem')}>
              <strong>Informar de un problema</strong>
              <span>Algo falla o da un resultado inesperado.</span>
            </button>
            <button type="button" onClick={() => choose('suggestion')}>
              <strong>Proponer una mejora</strong>
              <span>Una idea para que Vienna te resulte más útil.</span>
            </button>
          </div>
          <p className="help-contact">Contacto: {FEEDBACK_EMAIL}</p>
        </>
      ) : (
        <form
          id={FEEDBACK_FORM_ID}
          className="feedback-form"
          noValidate
          onSubmit={submit}
          aria-label="Enviar opinión sobre Vienna"
          aria-busy={state === 'sending'}
        >
          <div className="feedback-fields">
            <label>
              Tipo de mensaje
              <select
                value={kind}
                disabled={state === 'sending'}
                onChange={(event) => choose(event.target.value as FeedbackKind)}
              >
                {Object.entries(feedbackKinds).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Contacto <span className="feedback-optional">(opcional)</span>
              </span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                maxLength={160}
                disabled={state === 'sending'}
                placeholder="Nombre, correo o usuario de Discord"
                autoComplete="off"
              />
            </label>
          </div>
          <label>
            Tu mensaje
            <textarea
              ref={textarea}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              minLength={10}
              maxLength={6000}
              rows={4}
              disabled={state === 'sending'}
              placeholder={
                kind === 'problem'
                  ? 'Qué ocurrió, qué esperabas y cómo podemos reproducirlo…'
                  : 'Qué cambiarías y cómo te ayudaría…'
              }
              aria-describedby={error ? 'feedback-data feedback-result' : 'feedback-data'}
            />
          </label>
          <p id="feedback-data" className="feedback-data">
            Se incluirá: Vienna {FEEDBACK_VERSION} · {platform}
          </p>
          <p className="feedback-delivery">
            {direct
              ? 'Al enviar, compartirás este mensaje y los datos indicados con el desarrollador mediante Web3Forms.'
              : 'Se abrirá tu aplicación de correo con el mensaje preparado para que lo revises y lo envíes.'}
          </p>
          {(error || notice) && (
            <p
              id="feedback-result"
              ref={result}
              tabIndex={-1}
              className={error ? 'feedback-error' : 'feedback-notice'}
              role={error ? 'alert' : 'status'}
            >
              {error || notice}
            </p>
          )}
          <div className="feedback-buttons">
            {!onActionChange && (
              <button className="primary" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'Enviando…' : direct ? 'Enviar opinión' : 'Preparar correo'}
              </button>
            )}
            {direct && (
              <button
                className="secondary"
                type="button"
                disabled={state === 'sending'}
                onClick={() => void openMail()}
              >
                Usar mi correo
              </button>
            )}
          </div>
          <p className="help-contact">
            Para: {FEEDBACK_EMAIL}
            <br />
            Asunto: {FEEDBACK_SUBJECT}
          </p>
        </form>
      )}
    </section>
  );
}
