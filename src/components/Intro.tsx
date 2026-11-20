import { useEffect, useRef } from 'react';
import { CaseGlyph } from './Verdict';

export function Intro({ onClose }: { onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="intro-backdrop" onClick={onClose}>
      <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-h" onClick={(e) => e.stopPropagation()}>
        <h2 id="intro-h">One number decides the answer</h2>
        <p className="muted">
          A recursion tree splits the work of a recurrence into levels. Each level’s total is the total above it times the same number, <i>r</i>.
        </p>
        <ol className="intro-steps">
          <li>
            <span className="intro-n">1</span>
            <span>
              <strong>Change a number</strong> in the recurrence. Any number in a dashed box is editable.
            </span>
          </li>
          <li>
            <span className="intro-n">2</span>
            <span>
              <strong>Watch the bars.</strong> They shrink <CaseGlyph c="root" />, stay level <CaseGlyph c="equal" />, or grow <CaseGlyph c="leaves" /> when <i>r</i> is below, equal to, or above 1. That decides the Big-O.
            </span>
          </li>
          <li>
            <span className="intro-n">3</span>
            <span>
              <strong>Click anything</strong> (a node, a tuple, a bar, a step) to see why it has that value.
            </span>
          </li>
        </ol>
        <button ref={btn} className="btn primary" onClick={onClose}>
          Start exploring
        </button>
      </div>
    </div>
  );
}
