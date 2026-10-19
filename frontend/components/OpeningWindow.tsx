import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openingReference } from '../chess/openingReference';
import { moveLabel } from '../chess/game';
import { Board } from './Board';
import { Icon } from './Icon';

export async function openOpeningWindow(name: string, color: 'w' | 'b') {
  const params = new URLSearchParams({
    opening: name,
    color,
    appearance: document.documentElement.dataset.appearance ?? 'vienna',
    density: document.documentElement.dataset.density ?? 'comfortable',
  });
  if (isTauri()) {
    const viewer = new WebviewWindow(`opening-${crypto.randomUUID()}`, {
      url: `index.html?${params}`,
      title: `Vienna — ${name}`,
      width: 650,
      height: 840,
      minWidth: 380,
      minHeight: 560,
      center: true,
      dragDropEnabled: false,
    });
    await new Promise<void>((resolve, reject) => {
      void viewer.once('tauri://created', () => resolve()).catch(reject);
      void viewer
        .once('tauri://error', (event) => reject(Error(String(event.payload))))
        .catch(reject);
    });
  } else {
    const url = new URL('/', location.origin);
    url.search = params.toString();
    const viewer = window.open(url.href, '_blank', 'popup,width=650,height=840');
    if (!viewer)
      throw Error('No se pudo abrir la ventana de la apertura. Permite las ventanas emergentes.');
    viewer.opener = null;
  }
}

export function OpeningWindow({ name, color }: { name: string; color: 'w' | 'b' }) {
  const reference = useMemo(() => openingReference(name), [name]);
  const [index, setIndex] = useState(() => (reference ? reference.tree.nodes.length - 1 : 0));
  const [orientation, setOrientation] = useState(color);
  const nodes = reference?.tree.nodes ?? [];
  const end = nodes.length - 1;
  useEffect(() => {
    document.title = `Vienna — ${name}`;
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"]')
      )
        return;
      const next =
        event.key === 'ArrowLeft'
          ? index - 1
          : event.key === 'ArrowRight'
            ? index + 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? end
                : null;
      if (next !== null) {
        event.preventDefault();
        setIndex(Math.max(0, Math.min(end, next)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [name, index, end]);
  if (!reference)
    return (
      <main className="opening-viewer">
        <h1>Apertura no disponible</h1>
      </main>
    );
  return (
    <main className="opening-viewer">
      <header className="page-heading">
        <div>
          <h1>{name}</h1>
          <p>{reference.eco} / Línea de referencia</p>
        </div>
      </header>
      <section className="opening-board-frame">
        <Board
          node={nodes[index]}
          orientation={orientation}
          lines={[]}
          arrows={false}
          secondArrow={false}
          interactive={false}
          onMove={() => {}}
        />
        <div className="board-toolbar">
          <button
            className="icon-button"
            aria-label="Girar tablero"
            title="Girar tablero"
            onClick={() => setOrientation(orientation === 'w' ? 'b' : 'w')}
          >
            <Icon name="flip" />
          </button>
          <div className="navigation">
            {(['first', 'left', 'right', 'last'] as const).map((icon, i) => (
              <button
                key={icon}
                className="icon-button"
                aria-label={
                  ['Ir al inicio', 'Movimiento anterior', 'Movimiento siguiente', 'Ir al final'][i]
                }
                title={['Inicio', 'Anterior', 'Siguiente', 'Final'][i]}
                disabled={i < 2 ? index === 0 : index === end}
                onClick={() =>
                  setIndex([0, Math.max(0, index - 1), Math.min(end, index + 1), end][i])
                }
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <span className="ply-counter">
            {index} / {end}
          </span>
        </div>
      </section>
      <div className="opening-reference-moves" aria-label="Jugadas de la apertura">
        <button aria-pressed={index === 0} onClick={() => setIndex(0)}>
          Inicio
        </button>
        {nodes.slice(1).map((node, i) => (
          <button key={node.id} aria-pressed={index === i + 1} onClick={() => setIndex(i + 1)}>
            {moveLabel(node)}
          </button>
        ))}
      </div>
    </main>
  );
}
