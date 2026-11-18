import { useMemo } from 'react';
import { derivation, type Step } from '../explain/derivation';
import type { Analysis } from '../math/recurrence';
import { VERDICT_STEPS } from '../state/entities';
import { useHl, useLearnable } from '../state/selection';
import { Rich, Tex } from './Tex';

export function Derivation({ a, hidden }: { a: Analysis; hidden: boolean }) {
  const steps = useMemo(() => derivation(a), [a]);
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <StepItem key={s.id} s={s} n={i + 1} hidden={hidden && VERDICT_STEPS.has(s.id)} />
      ))}
    </ol>
  );
}

function StepItem({ s, n, hidden }: { s: Step; n: number; hidden: boolean }) {
  const learn = useLearnable({ kind: 'step', id: s.id });
  const hl = useHl([`step:${s.id}`]);
  if (hidden)
    return (
      <li className="step locked">
        <span className="step-n">{n}</span>
        <div className="step-body">
          <div className="step-title">{s.title}</div>
          <div className="muted small">Make your prediction above to reveal this step.</div>
        </div>
      </li>
    );
  return (
    <li className={`step hl-${hl || 'none'} ${s.id === 'answer' ? 'final' : ''}`} {...learn} aria-label={`Step ${n}: ${s.title}`}>
      <span className="step-n">{n}</span>
      <div className="step-body">
        <div className="step-title">{s.title}</div>
        <div className="step-tex">
          <Tex tex={s.tex} display />
        </div>
        <Rich text={s.note} className="step-note" />
        {s.check && (
          <div className="step-check">
            <span className="step-check-label">Check</span>
            <Rich text={s.check} />
          </div>
        )}
      </div>
    </li>
  );
}
