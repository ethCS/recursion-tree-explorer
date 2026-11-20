import { useEffect, useRef } from 'react';
import { explain, type ExplainCtx } from '../explain/explain';
import type { Entity } from '../state/entities';
import { useSelection } from '../state/selection';
import { Rich } from './Tex';

export function ExplainPanel({ ctx, locked }: { ctx: ExplainCtx; locked: boolean }) {
  const { selected, select, side, anchor } = useSelection();
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
    <aside className={`explain side-${side} ${dock(anchor).cls}`} style={dock(anchor).style} ref={ref} aria-label="Explanation" aria-live="polite">
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

/**
 * Dock the card at the bottom unless what was clicked sits in the lower part of
 * the screen; then dock at the top. Either way the card stops short of the
 * clicked element, so it never covers the thing it explains (on wide screens;
 * phones use a bottom sheet).
 */
function dock(anchor: { top: number; bottom: number } | null): { cls: string; style?: React.CSSProperties } {
  if (!anchor || window.innerWidth <= 640) return { cls: 'dock-bottom' };
  const vh = window.innerHeight;
  const gap = 16;
  const minH = 240;
  const below = vh - anchor.bottom - gap * 2;
  const above = anchor.top - gap * 2 - 64;
  if (below >= minH || below >= above) return { cls: 'dock-bottom', style: { maxHeight: Math.max(minH, Math.min(below, 600)) } };
  return { cls: 'dock-top', style: { maxHeight: Math.max(minH, Math.min(above, 600)) } };
}

function isSpoiler(e: Entity) {
  return e.kind === 'r' || e.kind === 'rterm' || e.kind === 'answer' || e.kind === 'level' || e.kind === 'leafrow' || e.kind === 'sum' || (e.kind === 'step' && ['ratio', 'pattern', 'dominates', 'leaves', 'answer', 'total'].includes(e.id));
}
