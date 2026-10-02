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
