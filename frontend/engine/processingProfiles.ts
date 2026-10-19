import type { Settings } from '../types';

export type ProcessingProfile = 'low' | 'medium' | 'high' | 'maximum' | 'custom';
export const processingProfiles = [
  {
    id: 'low',
    label: 'Bajo',
    threads: 1,
    hash: 64,
    multiPv: 2,
    interactiveTime: 150,
    depth: 16,
    reviewTime: 150,
  },
  {
    id: 'medium',
    label: 'Medio',
    threads: 2,
    hash: 128,
    multiPv: 3,
    interactiveTime: 500,
    depth: 20,
    reviewTime: 500,
  },
  {
    id: 'high',
    label: 'Alto',
    threads: 4,
    hash: 256,
    multiPv: 4,
    interactiveTime: 1000,
    depth: 24,
    reviewTime: 2000,
  },
  {
    id: 'maximum',
    label: 'Máximo',
    threads: 8,
    hash: 512,
    multiPv: 5,
    interactiveTime: 2000,
    depth: null,
    reviewTime: 5000,
  },
] as const;

export const processingKeys = [
  'threads',
  'hash',
  'multiPv',
  'interactiveTime',
  'depth',
  'reviewTime',
  'autoReviewTime',
] as const;

export function profileValues(profile: Exclude<ProcessingProfile, 'custom'>, cpus: number) {
  const definition = processingProfiles.find((p) => p.id === profile)!;
  const available = Number.isFinite(cpus) && cpus >= 1 ? cpus : 4;
  const threads = Math.min(definition.threads, Math.max(1, Math.floor(available / 2)));
  return {
    threads,
    hash: definition.hash,
    multiPv: definition.multiPv,
    interactiveTime: definition.interactiveTime,
    depth: definition.depth,
    reviewTime: definition.reviewTime,
    autoReviewTime: definition.reviewTime,
  };
}

export function selectedProcessingProfile(settings: Settings, cpus: number): ProcessingProfile {
  if (settings.processingProfile === 'custom') return 'custom';
  return (
    processingProfiles.find((profile) => {
      const values = profileValues(profile.id, cpus);
      return processingKeys.every((key) => settings[key] === values[key]);
    })?.id ?? 'custom'
  );
}

export function applyProcessingProfile(
  settings: Settings,
  profile: ProcessingProfile,
  cpus: number,
): Settings {
  return {
    ...settings,
    ...(profile === 'custom' ? {} : profileValues(profile, cpus)),
    processingProfile: profile,
  };
}
