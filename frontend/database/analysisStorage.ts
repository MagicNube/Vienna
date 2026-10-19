import { rpc } from '../api/native';

export type StorageInfo = {
  analysisBytes: number;
  analyses: number;
  cacheBytes: number;
  cachedPositions: number;
  eligibleBytes: number;
  eligibleAnalyses: number;
};
export const analysisStorage = {
  info: (cutoff: number, protectedIds: string[]) =>
    rpc<StorageInfo>('storage-info', { cutoff, protected: protectedIds }),
  clearOld: (cutoff: number, protectedIds: string[]) =>
    rpc<string[]>('clear-old-reviews', { cutoff, protected: protectedIds }),
  clearCache: () => rpc<void>('clear-position-cache'),
};
export function storageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2)
    return `${(bytes / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 ** 2).toLocaleString('es', { maximumFractionDigits: 1 })} MB`;
}
