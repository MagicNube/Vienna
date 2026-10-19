import type { Color, EngineLine } from '../types';

/** Every UI score uses White's perspective, including when the user is Black. */
export function evaluationSide(line: EngineLine | undefined): Color | null {
  if (!line) return null;
  if (line.mate !== null) {
    if (line.mate !== 0) return line.mate > 0 ? 'w' : 'b';
    if (line.wdl && line.wdl[0] !== line.wdl[2]) return line.wdl[0] > line.wdl[2] ? 'w' : 'b';
    return null;
  }
  if (line.cp === null || line.cp === 0) return null;
  return line.cp > 0 ? 'w' : 'b';
}

/** Visual advantage gauge, independent of WDL expected score used by move quality.
 * A fixed, symmetric curve keeps the same displayed evaluation at the same height:
 * +1 is about 60%, +3 about 77%, and +5 about 88% White.
 */
export function evaluationWhitePercent(line: EngineLine | undefined): number {
  if (!line) return 50;
  if (line.mate !== null) {
    const side = evaluationSide(line);
    return side === 'w' ? 97 : side === 'b' ? 3 : 50;
  }
  if (line.cp === null || !Number.isFinite(line.cp)) return 50;
  return Math.max(3, Math.min(97, 100 / (1 + Math.exp(-0.004 * line.cp))));
}

export function evaluationDescription(line: EngineLine | undefined) {
  const side = evaluationSide(line);
  return !line || (line.cp === null && line.mate === null)
    ? 'Sin evaluar'
    : side === 'w'
      ? 'Ventaja blanca'
      : side === 'b'
        ? 'Ventaja negra'
        : line.mate === 0
          ? 'Jaque mate'
          : 'Igualdad';
}
