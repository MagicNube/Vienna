import { engine } from '../engine/EngineService';
import { classify, CLASSIFICATION_VERSION } from './classification';
import { withBookMove } from '../chess/openings';
import { repository } from '../database/repository';
import type { EngineOptions, GameTree, Review } from '../types';
export const REVIEW_VERSION = 1;
export class GameReviewService {
  private generation = 0;
  cancel() {
    this.generation++;
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
      if (ticket !== this.generation) throw Error('cancelled');
      const id = tree.mainIds[i];
      const analysis = await engine.analyzePosition(tree, id, options, 'review');
      if (ticket !== this.generation) throw Error('cancelled');
      review.positions[id] = analysis;
      if (i > 0) {
        const prev = tree.nodes.find((n) => n.id === tree.mainIds[i - 1])!;
        const next = tree.nodes.find((n) => n.id === id)!;
        review.moves.push(
          withBookMove(
            prev,
            next,
            classify(prev, next, review.positions[prev.id].lines, analysis.lines[0]),
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
      onProgress(i + 1, total, {
        ...review,
        positions: { ...review.positions },
        moves: [...review.moves],
      });
    }
    return review;
  }
}
