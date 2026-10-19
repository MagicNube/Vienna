import type { ReturnContext } from '../review/returnNavigation';
import { categories } from '../review/classification';
import { moveLabel } from '../chess/game';
import { Icon } from './Icon';

export function ReturnControl({
  context,
  onReturn,
}: {
  context: ReturnContext | null;
  onReturn: () => void;
}) {
  const label =
    context?.kind === 'custom' ? 'Custom' : context ? categories[context.category].label : 'Volver';
  const destination = context
    ? context.target.ply
      ? moveLabel(context.target)
      : 'la posición inicial'
    : '';
  const description = context ? `Volver a ${destination}. ${label} (Esc)` : 'Volver a tu posición';
  return (
    <button
      className="icon-button board-return"
      disabled={!context}
      aria-label={description}
      title={description}
      onClick={onReturn}
    >
      <Icon name="undo" />
    </button>
  );
}
