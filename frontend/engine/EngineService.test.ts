import { beforeEach, expect, it, vi } from 'vitest';
import { makeTree } from '../chess/game';
import type { Analysis, EngineOptions } from '../types';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), listen: vi.fn() }));
vi.mock('../api/native', () => ({ rpc: mocks.rpc, onEngineInfo: mocks.listen }));
import { EngineService } from './EngineService';

const options: EngineOptions = { threads: 1, hash: 16, multiPv: 3, movetime: 100, depth: null };
const result: Analysis = {
  cached: false,
  engineId: 'test',
  lines: [{ rank: 1, depth: 12, nodes: 100, cp: 0, mate: null, wdl: null, pv: ['e2e4'] }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue(result);
  mocks.listen.mockResolvedValue(() => {});
});

it('permite reintentar tras un fallo de la conexión de eventos', async () => {
  const service = new EngineService();
  mocks.listen.mockRejectedValueOnce(Error('Conexión interrumpida'));
  await expect(service.analyzePosition(makeTree('*'), 'm0', options)).rejects.toThrow(
    'Conexión interrumpida',
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
  await expect(service.analyzePosition(makeTree('*'), 'm0', options)).resolves.toEqual(result);
  expect(mocks.listen).toHaveBeenCalledTimes(2);
});

it('comparte una sola conexión entre búsquedas y retira callbacks al terminar', async () => {
  const service = new EngineService();
  const progress = vi.fn();
  let finish!: (result: Analysis) => void;
  mocks.rpc.mockImplementationOnce(
    () =>
      new Promise<Analysis>((resolve) => {
        finish = resolve;
      }),
  );
  const running = service.analyzePosition(makeTree('*'), 'm0', options, 'interactive', progress);
  await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
  const requestId = mocks.rpc.mock.calls[0][1].requestId;
  const emit = mocks.listen.mock.calls[0][0];
  emit({ requestId, lines: result.lines });
  expect(progress).toHaveBeenCalledOnce();
  finish(result);
  await running;
  emit({ requestId, lines: result.lines });
  expect(progress).toHaveBeenCalledOnce();
  await service.analyzePosition(makeTree('*'), 'm0', options, 'review');
  expect(mocks.listen).toHaveBeenCalledOnce();
});
