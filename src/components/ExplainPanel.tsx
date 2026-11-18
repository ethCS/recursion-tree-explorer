import { useEffect, useRef } from 'react';
import { explain, type ExplainCtx } from '../explain/explain';
import type { Entity } from '../state/entities';
import { useSelection } from '../state/selection';
import { Rich } from './Tex';

export function ExplainPanel({ ctx, locked }: { ctx: ExplainCtx; locked: boolean }) {
  const { selected, select, side } = useSelection();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected && !(e.target instanceof HTMLInputElement)) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  if (!selected) return null;
  const spoiler = locked && isSpoiler(selected);
  const ex = spoiler ? null : explain(selected, ctx);
  return (
    <aside className={`explain side-${side}`} ref={ref} aria-label="Explanation" aria-live="polite">
      <header className="explain-head">
        <span className="explain-kicker">Explain</span>
        <button className="icon-btn" onClick={() => select(null)} aria-label="Close explanation" title="Close (Esc)">
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      {ex ? (
        <>
          <h2 className="explain-title">
            <Rich text={ex.title} />
          </h2>
          <dl className="explain-body">
            {ex.sections.map((s) => (
              <div key={s.h} className={`explain-sec sec-${s.h.split(' ')[0].toLowerCase()}`}>
                <dt>{s.h}</dt>
                <dd>
                  <Rich text={s.body} />
                </dd>
              </div>
            ))}
          </dl>
          {ex.next && (
            <button className="next-btn" onClick={() => select(ex.next!.entity)}>
              {ex.next.label} <span aria-hidden>→</span>
            </button>
          )}
        </>
      ) : (
        <p className="muted">Make your prediction first. This explanation would give the answer away.</p>
      )}
    </aside>
  );
}

function isSpoiler(e: Entity) {
  return e.kind === 'r' || e.kind === 'rterm' || e.kind === 'answer' || e.kind === 'level' || e.kind === 'leafrow' || e.kind === 'sum' || (e.kind === 'step' && ['ratio', 'pattern', 'dominates', 'leaves', 'answer', 'total'].includes(e.id));
}
