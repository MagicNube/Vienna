import { useEffect, useMemo, useRef, useState } from 'react';
import { analysisStorage, storageSize, type StorageInfo } from '../database/analysisStorage';
import { Icon } from './Icon';

export function StorageSettings({
  protectedIds,
  onCleaned,
}: {
  protectedIds: string[];
  onCleaned: (ids: string[], cache: boolean) => Promise<void>;
}) {
  const [days, setDays] = useState('30');
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<'reviews' | 'cache' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const valid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650;
  const cutoff = useMemo(() => Date.now() - Number(days) * 86_400_000, [days, revision]);
  const protectedKey = JSON.stringify(protectedIds);
  const currentProtected = useRef(protectedIds);
  currentProtected.current = protectedIds;
  useEffect(() => {
    let active = true;
    setConfirmation(null);
    setLoading(true);
    setError('');
    if (!valid) return;
    void analysisStorage
      .info(cutoff, JSON.parse(protectedKey))
      .then((result) => {
        if (active) {
          setInfo(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(String(error));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [cutoff, protectedKey, valid]);

  async function clean(kind: 'reviews' | 'cache') {
    if (busy || loading || error || !info || !valid) return;
    if (confirmation !== kind) {
      setConfirmation(kind);
      setMessage('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ids =
        kind === 'reviews' ? await analysisStorage.clearOld(cutoff, currentProtected.current) : [];
      if (kind === 'cache') await analysisStorage.clearCache();
      await onCleaned(ids, kind === 'cache');
      setMessage(kind === 'reviews' ? `${ids.length} análisis eliminados` : 'Caché vaciada');
      setConfirmation(null);
      setRevision((n) => n + 1);
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="storage-settings" aria-busy={busy}>
      <div className="storage-metrics">
        <div>
          <span>Análisis guardados</span>
          <strong>{info ? storageSize(info.analysisBytes) : '—'}</strong>
          <small>{info ? `${info.analyses} partidas` : 'Cargando…'}</small>
        </div>
        <div>
          <span>Caché del motor</span>
          <strong>{info ? storageSize(info.cacheBytes) : '—'}</strong>
          <small>{info ? `${info.cachedPositions} posiciones` : 'Cargando…'}</small>
        </div>
      </div>
      <section className="storage-cleanup">
        <label htmlFor="storage-days">Análisis de partidas de hace más de</label>
        <div className="storage-age-input">
          <input
            id="storage-days"
            type="number"
            min="1"
            max="3650"
            step="1"
            value={days}
            disabled={busy}
            onChange={(e) => {
              setDays(e.target.value);
              setMessage('');
            }}
          />
          <span>días</span>
        </div>
        <p>
          {!valid
            ? 'Introduce entre 1 y 3650 días.'
            : loading
              ? 'Calculando…'
              : info
                ? `${info.eligibleAnalyses} partidas (${storageSize(info.eligibleBytes)})`
                : 'No se pudo calcular el espacio.'}
        </p>
        <button
          className="secondary"
          disabled={busy || loading || !!error || !info?.eligibleAnalyses}
          onClick={() => void clean('reviews')}
        >
          <Icon name="trash" size={16} />
          Borrar análisis antiguos
        </button>
      </section>
      <div className="storage-cache-action">
        <span>Las partidas se conservan.</span>
        <button
          className="secondary"
          disabled={busy || loading || !!error || !info?.cachedPositions}
          onClick={() => void clean('cache')}
        >
          Vaciar caché
        </button>
      </div>
      <span className="storage-note">
        Espacio de los datos guardados{' '}
        <span
          title="No incluye las partidas ni los ajustes. SQLite reutiliza el espacio borrado; el archivo puede conservar su tamaño. La caché puede volver a crecer al analizar."
          aria-label="Información del espacio"
        >
          <Icon name="info" size={15} />
        </span>
      </span>
      {confirmation && (
        <div className="storage-confirmation">
          <span>
            {confirmation === 'reviews'
              ? `¿Borrar ${info?.eligibleAnalyses} análisis? Tendrás que analizarlos de nuevo.`
              : '¿Vaciar la caché de posiciones? Los análisis guardados se conservan.'}
          </span>
          <div>
            <button className="secondary" disabled={busy} onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
            <button
              className="storage-delete"
              disabled={busy}
              onClick={() => void clean(confirmation)}
            >
              {busy ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="storage-message" role="status">
          <Icon name="check" size={16} />
          {message}
        </p>
      )}
      {error && (
        <p className="storage-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
