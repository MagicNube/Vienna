import { afterEach, expect, it, vi } from 'vitest';
import { validateProfileImage, profileInitials, profileImage } from './image';
afterEach(() => vi.unstubAllGlobals());
it('accepts supported images and rejects excessive, empty or non-image files', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp'])
    expect(() => validateProfileImage({ type, size: 100 })).not.toThrow();
  expect(() => validateProfileImage({ type: 'image/svg+xml', size: 100 })).toThrow('JPG');
  expect(() => validateProfileImage({ type: 'image/png', size: 0 })).toThrow('vacía');
  expect(() => validateProfileImage({ type: 'image/png', size: 11 * 1024 * 1024 })).toThrow(
    '10 MB',
  );
});
it('provides recognizable initials when no photo is present', () => {
  expect(profileInitials('PlayerOne')).toBe('PO');
  expect(profileInitials('player')).toBe('PL');
});

function browserImage(readError = false, decodeError = false) {
  const drawn = vi.fn();
  const assignedSources: string[] = [];
  vi.stubGlobal(
    'FileReader',
    class {
      result = 'data:image/png;base64,test';
      onload?: () => void;
      onerror?: () => void;
      readAsDataURL() {
        if (readError) this.onerror?.();
        else this.onload?.();
      }
    },
  );
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 640;
      naturalHeight = 480;
      set src(value: string) {
        assignedSources.push(value);
      }
      decode() {
        return decodeError
          ? Promise.reject(new Error('The source image cannot be decoded.'))
          : Promise.resolve();
      }
    },
  );
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ drawImage: drawn }),
      toDataURL: () => 'data:image/png;base64,prepared',
    }),
  });
  return { drawn, assignedSources };
}
it('loads an allowed data URL under the installer policy and crops the image', async () => {
  const { drawn, assignedSources } = browserImage();
  expect(await profileImage({ type: 'image/png', size: 100 } as File)).toBe(
    'data:image/png;base64,prepared',
  );
  expect(assignedSources).toEqual(['data:image/png;base64,test']);
  expect(drawn.mock.calls[0].slice(1)).toEqual([80, 0, 480, 480, 0, 0, 256, 256]);
});
it('explains a genuine decode failure in Spanish', async () => {
  browserImage(false, true);
  await expect(profileImage({ type: 'image/png', size: 100 } as File)).rejects.toThrow(
    'No se pudo abrir la imagen',
  );
});
it('reports unreadable files before trying to decode them', async () => {
  const { assignedSources } = browserImage(true);
  await expect(profileImage({ type: 'image/png', size: 100 } as File)).rejects.toThrow(
    'No se pudo leer la imagen',
  );
  expect(assignedSources).toEqual([]);
});
