import { spanishSan } from '../chess/game';
import type { PositionNode } from '../types';

function moveIdentity(node: PositionNode) {
  const fields = node.fen.split(' ');
  const color = fields[1] === 'w' ? 'b' : 'w';
  return { color, number: Number(fields[5]) - (color === 'b' ? 1 : 0), san: spanishSan(node.san) };
}
export function ReadableMove({ node }: { node: PositionNode }) {
  const { color, number, san } = moveIdentity(node);
  return (
    <span
      className="readable-move"
      aria-label={`Jugada ${number}, ${color === 'w' ? 'blancas' : 'negras'}: ${san}`}
    >
      <i className={`move-color ${color}`} aria-hidden="true" />
      <span>
        {number}. {san}
      </span>
    </span>
  );
}
