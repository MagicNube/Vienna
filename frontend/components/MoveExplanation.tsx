import { useEffect, useId, useRef, useState } from 'react';
import type { MoveReview, PositionNode } from '../types';
import { categories } from '../review/classification';
import { spanishSan } from '../chess/game';
import { missedOpportunityExplanation } from '../review/missedOpportunity';
import { MoveSymbol } from './MoveSymbol';
import { Icon } from './Icon';

export function MoveExplanation({
  node,
  before,
  move,
}: {
  node: PositionNode;
  before?: PositionNode;
  move?: MoveReview;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    panel.current?.hidePopover();
    setOpen(false);
  }, [node.id, node.fen]);
  useEffect(() => {
    const hide = () => panel.current?.hidePopover();
    window.addEventListener('resize', hide);
    return () => window.removeEventListener('resize', hide);
  }, []);
  if (!move || !node.parent) return null;
  const san = spanishSan(node.san);
  const label = categories[move.category].label;
  const explanation =
    move.category === 'miss' && before
      ? (missedOpportunityExplanation(before.fen, move.best) ?? move.explanation)
      : move.explanation;
  function close() {
    panel.current?.hidePopover();
    trigger.current?.focus();
  }
  return (
    <div className="current-move-detail">
      <span className={`badge ${move.category}`}>
        <MoveSymbol category={move.category} />
      </span>
      <strong>{san}</strong>
      <span className="current-move-category" title={label}>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="icon-button move-explanation-trigger"
        aria-label={`Ver explicación de ${san}, ${label}`}
        title="Ver explicación"
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
        popoverTargetAction="toggle"
        onClick={() => {
          const rect = trigger.current!.getBoundingClientRect();
          const width = Math.min(360, innerWidth - 24);
          panel.current!.style.left = `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`;
          panel.current!.style.top = `${rect.bottom + 8}px`;
          panel.current!.style.maxHeight = `${Math.max(80, innerHeight - rect.bottom - 24)}px`;
        }}
      >
        <Icon name="info" size={17} />
      </button>
      <div
        id={id}
        ref={panel}
        className="move-explanation-popover"
        popover="auto"
        role="region"
        aria-label={`Explicación de ${san}`}
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <header>
          <span className={`badge ${move.category}`}>
            <MoveSymbol category={move.category} />
          </span>
          <strong>{san}</strong>
          <span>{label}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar explicación"
            onClick={close}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        <p>{explanation}</p>
      </div>
    </div>
  );
}
