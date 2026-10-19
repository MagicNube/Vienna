import type { Color, EngineLine } from '../types';
import { score } from '../engine/EngineService';
import { evaluationDescription, evaluationSide, evaluationWhitePercent } from '../engine/evaluation';

export function EvaluationBar({
  evaluation,
  orientation,
  ownColor,
  busy,
}: {
  evaluation: EngineLine | undefined;
  orientation: Color;
  ownColor?: Color;
  busy: boolean;
}) {
  const whitePercent = evaluationWhitePercent(evaluation);
  const scoreColor = evaluationSide(evaluation) ?? 'w';
  const ownDescription = ownColor ? `Tu color: ${ownColor === 'w' ? 'blancas' : 'negras'}. ` : '';
  return (
    <div
      className="evaluation-bar"
      aria-label={`${ownDescription}Evaluación desde blancas: ${score(evaluation)}. ${evaluationDescription(evaluation)}`}
      title={`${ownDescription}+ favorece a blancas; − favorece a negras`}
      aria-busy={busy}
    >
      <div
        className={`white-eval ${orientation === 'w' ? 'white-bottom' : ''}`}
        style={{ height: `${whitePercent}%` }}
      />
      <span
        className={`${scoreColor === 'w' ? 'on-white' : ''} ${scoreColor !== orientation ? 'on-top' : ''}`}
      >
        {score(evaluation)}
      </span>
    </div>
  );
}
