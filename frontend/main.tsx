import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OpeningWindow } from './components/OpeningWindow';
import { applyAppearance } from './appearance';
import { isTauri } from '@tauri-apps/api/core';
import { DesktopWindow } from './components/WindowTitleBar';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
// Suppress the WebView browser menu without interfering with board annotations.
document.addEventListener('contextmenu', (event) => event.preventDefault());
const params = new URLSearchParams(location.search);
const opening = params.get('opening');
const customChrome = isTauri() && !opening;
if (customChrome) document.documentElement.dataset.windowChrome = 'custom';
if (opening)
  applyAppearance({
    appearance: params.get('appearance') === 'walnut' ? 'walnut' : 'vienna',
    density: params.get('density') === 'compact' ? 'compact' : 'comfortable',
  });
createRoot(document.getElementById('root')!).render(
  opening ? (
    <OpeningWindow name={opening} color={params.get('color') === 'b' ? 'b' : 'w'} />
  ) : customChrome ? (
    <DesktopWindow>
      <App />
    </DesktopWindow>
  ) : (
    <App />
  ),
);
