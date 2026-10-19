import { expect, it } from 'vitest';
import { storageSize } from './analysisStorage';

it('muestra el espacio vacío y tamaños pequeños y grandes en unidades legibles', () => {
  expect(storageSize(0)).toBe('0 B');
  expect(storageSize(512)).toBe('512 B');
  expect(storageSize(1536)).toBe('1,5 KB');
  expect(storageSize(1024 ** 2)).toBe('1 MB');
});
