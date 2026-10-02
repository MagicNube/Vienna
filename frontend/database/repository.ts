import { rpc } from '../api/native';
export const repository = {
  get: <T>(kind: string, id: string) => rpc<T | null>('get', { kind, id }),
  list: <T>(kind: string) => rpc<T[]>('list', { kind }),
  put: <T>(kind: string, id: string, value: T) => rpc<void>('put', { kind, id, value }),
};
