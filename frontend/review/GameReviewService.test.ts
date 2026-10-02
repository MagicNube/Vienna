import { beforeEach, expect, it, vi } from 'vitest';
import { makeTree } from '../chess/game';
import type { Analysis, EngineOptions } from '../types';
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), cancel: vi.fn(), put: vi.fn(), get: vi.fn() }));
vi.mock('../engine/EngineService', async (original) => ({
  ...(await original<typeof import('../engine/EngineService')>()),
  engine: {
    status: async () => ({ engineId: 'test-engine' }),
    analyzePosition: mocks.analyze,
    cancel: mocks.cancel,
  },
}));
vi.mock('../database/repository', () => ({ repository: { put: mocks.put, get: mocks.get } }));
import { GameReviewService } from './GameReviewService';
const options: EngineOptions = { threads: 1, hash: 16, multiPv: 1, movetime: 100, depth: null };
const result: Analysis = {
  cached: false,
  engineId: 'test-engine',
  lines: [{ rank: 1, depth: 16, nodes: 100, cp: 0, mate: null, wdl: [0, 1000, 0], pv: ['e2e4'] }],
};
beforeEach(() => vi.resetAllMocks());
it('cancela una revisión pendiente sin publicar ni guardar resultados obsoletos', async () => {
  let finish!: (result: Analysis) => void;
  mocks.analyze.mockImplementation(
    () =>
      new Promise<Analysis>((resolve) => {
        finish = resolve;
      }),
  );
  const service = new GameReviewService();
  const progress = vi.fn();
  const running = service.run('old', makeTree('1. e4 *'), options, progress);
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalledOnce());
  await service.cancel();
  finish(result);
  await cancelled;
  expect(mocks.cancel).toHaveBeenCalledWith('review');
  expect(progress).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
});
it('permite una nueva revisión después de cancelar y guarda cada posición', async () => {
  const service = new GameReviewService();
  await service.cancel();
  mocks.analyze.mockResolvedValue(result);
  const progress = vi.fn();
  const review = await service.run('new', makeTree('1. e4 *'), options, progress);
  expect(review.complete).toBe(true);
  expect(Object.keys(review.positions)).toEqual(['m0', 'm1']);
  expect(mocks.put).toHaveBeenCalledTimes(2);
  expect(progress).toHaveBeenLastCalledWith(2, 2, expect.objectContaining({ complete: true }));
});

it('una revisión nueva conserva la anterior completa hasta terminar', async () => {
  mocks.get.mockResolvedValue({ complete: true });
  mocks.analyze.mockResolvedValue(result);
  await new GameReviewService().run('saved', makeTree('1. e4 *'), options, vi.fn());
  expect(mocks.put.mock.calls.map((call) => call[0])).toEqual(['review-drafts', 'reviews']);
});

it('cancelar un reanálisis no sobrescribe la revisión completa guardada', async () => {
  mocks.get.mockResolvedValue({ complete: true });
  let finish!: (value: Analysis) => void;
  mocks.analyze.mockResolvedValueOnce(result).mockImplementationOnce(
    () =>
      new Promise<Analysis>((resolve) => {
        finish = resolve;
      }),
  );
  const service = new GameReviewService();
  const running = service.run('saved', makeTree('1. e4 *'), options, vi.fn());
  const cancelled = expect(running).rejects.toThrow('cancelled');
  await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalledTimes(2));
  await service.cancel();
  finish(result);
  await cancelled;
  expect(mocks.put.mock.calls.map((call) => call[0])).toEqual(['review-drafts']);
});
