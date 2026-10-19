import type { Color } from '../types';
import type { positionMaterial } from '../chess/material';

const names = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
export function CapturedPieces({
  material,
  color,
}: {
  material: ReturnType<typeof positionMaterial>;
  color: Color;
}) {
  const pieces = material.captured[color];
  const advantage = material.advantage[color];
  return (
    <div
      className="captured-material"
      aria-label={`Capturas: ${pieces.map((piece) => names[piece]).join(', ') || 'ninguna'}. Ventaja material: ${advantage} puntos.`}
    >
      <span className="captured-pieces" aria-hidden="true">
        {pieces.map((piece, index) => (
          <img
            key={index}
            src={`/pieces/${color === 'w' ? 'captured/b' : 'w'}${piece}.svg`}
            alt=""
          />
        ))}
      </span>
      {advantage > 0 && (
        <b className="material-advantage" title="Ventaja material">
          +{advantage}
        </b>
      )}
    </div>
  );
}
