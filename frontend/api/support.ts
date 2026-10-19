import { openUrl } from '@tauri-apps/plugin-opener';

export const SUPPORT_URL = 'https://buymeacoffee.com/magicnube';

export async function openSupportPage(): Promise<void> {
  await openUrl(SUPPORT_URL);
}
