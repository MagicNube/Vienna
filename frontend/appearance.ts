import type { Settings } from './types';

export function applyAppearance(settings: Pick<Settings, 'appearance' | 'density'>) {
  document.documentElement.dataset.appearance =
    settings.appearance === 'walnut' ? 'walnut' : 'vienna';
  document.documentElement.dataset.density =
    settings.density === 'compact' ? 'compact' : 'comfortable';
}
