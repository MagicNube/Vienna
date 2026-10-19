import { expect, it } from 'vitest';
import { defaultSettings } from '../types';
import {
  applyProcessingProfile,
  selectedProcessingProfile,
  profileValues,
  processingProfiles,
} from './processingProfiles';

it.each(processingProfiles)(
  'aplica $label a todos los parámetros de procesamiento sin modificar la cuenta ni el sonido',
  ({ id }) => {
    const settings = {
      ...defaultSettings,
      username: 'Player',
      sounds: false,
      autoReview: false,
      profileImage: 'avatar',
    };
    const changed = applyProcessingProfile(settings, id, 16);
    expect(changed).toMatchObject(profileValues(id, 16));
    expect(selectedProcessingProfile(changed, 16)).toBe(id);
    expect(changed).toMatchObject({
      username: 'Player',
      sounds: false,
      autoReview: false,
      profileImage: 'avatar',
    });
    expect(settings).toEqual({
      ...defaultSettings,
      username: 'Player',
      sounds: false,
      autoReview: false,
      profileImage: 'avatar',
    });
  },
);

it.each([1, 2, 4, 8, 16, 32])(
  'limita los hilos en un equipo con %i procesadores lógicos',
  (cpus) => {
    for (const { id } of processingProfiles) {
      const values = profileValues(id, cpus);
      expect(values.threads).toBeGreaterThanOrEqual(1);
      expect(values.threads).toBeLessThanOrEqual(Math.max(1, Math.floor(cpus / 2)));
      expect(values.threads).toBeLessThanOrEqual(8);
    }
  },
);

it('Máximo no limita la profundidad; los otros perfiles tienen límites crecientes', () => {
  expect(processingProfiles.map((p) => profileValues(p.id, 16).depth)).toEqual([16, 20, 24, null]);
  expect(processingProfiles.map((p) => profileValues(p.id, 16).reviewTime)).toEqual([
    150, 500, 2000, 5000,
  ]);
  expect(processingProfiles.map((p) => profileValues(p.id, 16).multiPv)).toEqual([2, 3, 4, 5]);
});

it('Personalizado conserva toda la combinación incluso si coincide con un perfil', () => {
  const maximum = applyProcessingProfile(defaultSettings, 'maximum', 16);
  const custom = applyProcessingProfile(maximum, 'custom', 16);
  expect(custom).toEqual({ ...maximum, processingProfile: 'custom' });
  expect(selectedProcessingProfile(custom, 16)).toBe('custom');
});

it('un cambio manual invalida un perfil previamente guardado y no se etiqueta como Máximo', () => {
  const maximum = applyProcessingProfile(defaultSettings, 'maximum', 16);
  expect(selectedProcessingProfile({ ...maximum, hash: 128 }, 16)).toBe('custom');
  expect(selectedProcessingProfile({ ...maximum, autoReviewTime: 500 }, 16)).toBe('custom');
});

it('reconoce una combinación antigua sin perfil y conserva una mezcla diferente', () => {
  expect(
    selectedProcessingProfile({ ...defaultSettings, ...profileValues('maximum', 16) }, 16),
  ).toBe('maximum');
  expect(selectedProcessingProfile({ ...defaultSettings, threads: 3, hash: 1024 }, 16)).toBe(
    'custom',
  );
});

it('adapta un perfil a procesadores disponibles y tolera un recuento ausente', () => {
  expect(profileValues('maximum', 8).threads).toBe(4);
  expect(profileValues('maximum', Number.NaN).threads).toBe(2);
});
