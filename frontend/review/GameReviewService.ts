import { engine } from '../engine/EngineService';
import { classify, CLASSIFICATION_VERSION } from './classification';
import { withBookMove } from '../chess/openings';
import { repository } from '../database/repository';
import type { EngineOptions, GameTree, Review } from '../types';
export const REVIEW_VERSION = 1;
export class GameReviewService {
  private generation = 0;
  private paused = false;
  private waiting = new Set<() => void>();
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    this.wake();
  }
  private wake() {
    for (const resolve of this.waiting) resolve();
    this.waiting.clear();
  }
  private async checkpoint(ticket: number) {
    while (this.paused && ticket === this.generation)
      await new Promise<void>((resolve) => this.waiting.add(resolve));
    if (ticket !== this.generation) throw Error('cancelled');
  }
  cancel() {
    this.generation++;
    this.wake();
    return engine.cancel('review');
  }
  async run(
    gameId: string,
    tree: GameTree,
    options: EngineOptions,
    onProgress: (done: number, total: number, review: Review) => void,
  ): Promise<Review> {
    const ticket = ++this.generation;
    const status = await engine.status();
    const previous = await repository.get<Review>('reviews', gameId);
    const review: Review = {
      version: REVIEW_VERSION,
      classificationVersion: CLASSIFICATION_VERSION,
      engineId: status.engineId,
      options,
      positions: {},
      moves: [],
      complete: false,
    };
    const total = tree.mainIds.length;
    for (let i = 0; i < total; i++) {
      await this.checkpoint(ticket);
      const id = tree.mainIds[i];
      const analysis = await engine.analyzePosition(tree, id, options, 'review');
      if (ticket !== this.generation) throw Error('cancelled');
      review.positions[id] = analysis;
      if (i > 0) {
        const prev = tree.nodes.find((n) => n.id === tree.mainIds[i - 1])!;
        const next = tree.nodes.find((n) => n.id === id)!;
        const previous = tree.nodes.find((n) => n.id === prev.parent);
        const previousLines = previous && review.positions[previous.id]?.lines;
        review.moves.push(
          withBookMove(
            prev,
            next,
            classify(
              prev,
              next,
              review.positions[prev.id].lines,
              analysis.lines[0],
              undefined,
              previous && previousLines ? { node: previous, lines: previousLines } : undefined,
            ),
          )!,
        );
      }
      review.complete = i === total - 1;
      // A cancelled re-analysis must not erase the previous complete review.
      await repository.put(
        previous?.complete && !review.complete ? 'review-drafts' : 'reviews',
        gameId,
        review,
      );
      if (ticket !== this.generation) throw Error('cancelled');
      onProgress(i + 1, total, {
        ...review,
        positions: { ...review.positions },
        moves: [...review.moves],
      });
    }
    return review;
  }
}
