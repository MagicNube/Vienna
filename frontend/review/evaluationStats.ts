import { expected, score } from '../engine/EngineService';
import type { Color, EngineLine, Review } from '../types';

function evaluationValue(line: EngineLine, color: Color) {
  if (line.mate !== null) {
    const sign = expected(line, color) >= 0.5 ? 1 : -1;
    return sign * (100_000 - Math.abs(line.mate));
  }
  return (line.cp ?? 0) * (color === 'w' ? 1 : -1);
}

export function evaluationStats(review: Review | null, total: number, color: Color) {
  if (!review?.complete) return null;
  const entries = Array.from({ length: total }, (_, ply) => {
    const line = review.positions[`m${ply}`]?.lines[0];
    return line && (line.mate !== null || line.cp !== null)
      ? { ply, line, value: evaluationValue(line, color) }
      : null;
  }).filter((entry) => entry !== null);
  if (!entries.length) return null;
  const numeric = entries.filter((entry) => entry.line.mate === null && entry.line.cp !== null);
  const minimum = numeric.length ? numeric.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const maximum = numeric.length ? numeric.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  return {
    minimum,
    maximum,
    advantage: Math.round(
      (entries.filter((entry) => entry.value >= 50).length / entries.length) * 100,
    ),
  };
}

export function evaluationStatLabel(line: EngineLine, color: Color) {
  if (line.mate === 0) return expected(line, color) >= 0.5 ? 'Mate a favor' : 'Mate en contra';
  return score(line, color);
}
