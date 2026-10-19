import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Icon } from './Icon';

export const WINDOW_ERROR_EVENT = 'vienna:window-error';
export type WindowControls = Pick<
  ReturnType<typeof getCurrentWindow>,
  'minimize' | 'toggleMaximize' | 'close' | 'isMaximized' | 'onResized'
>;
const ControlsContext = createContext<WindowControls | null>(null);

export function DesktopWindow({
  children,
  controls,
}: {
  children: ReactNode;
  controls?: WindowControls;
}) {
  const nativeWindow = useMemo(() => controls ?? getCurrentWindow(), [controls]);
  return (
    <ControlsContext.Provider value={nativeWindow}>
      <WindowTitleBar />
      {children}
    </ControlsContext.Provider>
  );
}

function reportError(error: unknown) {
  window.dispatchEvent(
    new CustomEvent(WINDOW_ERROR_EVENT, { detail: `No se pudo controlar la ventana: ${error}` }),
  );
}

export function WindowTitleBar({ controls }: { controls?: WindowControls }) {
  const shared = useContext(ControlsContext);
  const nativeWindow = useMemo(() => controls ?? shared ?? getCurrentWindow(), [controls, shared]);
  const [maximized, setMaximized] = useState(false);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let unlisten: (() => void) | undefined;
    const update = async () => {
      const ticket = ++sequence;
      try {
        const value = await nativeWindow.isMaximized();
        if (active && ticket === sequence) setMaximized(value);
      } catch (error) {
        if (active) reportError(error);
      }
    };
    refresh.current = update;
    void update();
    void nativeWindow
      .onResized(() => void update())
      .then(
        (remove) => {
          if (active) unlisten = remove;
          else remove();
        },
        (error) => {
          if (active) reportError(error);
        },
      );
    return () => {
      active = false;
      refresh.current = async () => {};
      unlisten?.();
    };
  }, [nativeWindow]);

  return (
    <div className="window-titlebar" role="region" aria-label="Controles de la ventana">
      <div className="window-drag-region" data-tauri-drag-region="" aria-hidden="true" />
      <div className="window-controls">
        <button
          type="button"
          aria-label="Minimizar ventana"
          title="Minimizar"
          onClick={() => void nativeWindow.minimize().catch(reportError)}
        >
          <Icon name="window-minimize" size={16} />
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restaurar ventana' : 'Maximizar ventana'}
          title={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() =>
            void nativeWindow
              .toggleMaximize()
              .then(() => refresh.current())
              .catch(reportError)
          }
        >
          <Icon name={maximized ? 'window-restore' : 'window-maximize'} size={16} />
        </button>
        <button
          type="button"
          className="window-close"
          aria-label="Cerrar ventana"
          title="Cerrar"
          onClick={() => void nativeWindow.close().catch(reportError)}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
