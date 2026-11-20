import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LIMITS, validateField, type Analysis, type Field, type Recurrence } from '../math/recurrence';
import { partTip } from '../explain/explain';
import type { Entity } from '../state/entities';
import { keyOf } from '../state/entities';
import { useHl, useSelection } from '../state/selection';
import { Rich } from './Tex';

interface Props {
  rec: Recurrence;
  analysis: Analysis;
  onEdit: (field: Field, term: number, value: number) => void;
  onAddTerm: () => void;
  onRemoveTerm: (term: number) => void;
}

/** Every hoverable part of the formula, by its data-part key. */
function entityOfKey(key: string): Entity | null {
  const [kind, t] = key.split(':');
  const term = Number(t);
  switch (kind) {
    case 'lhs':
    case 'fwork':
    case 'exp':
      return { kind } as Entity;
    case 'call':
    case 'coef':
    case 'div':
      return { kind, term } as Entity;
    default:
      return null;
  }
}

interface TipState {
  key: string;
  el: HTMLElement;
  /** pinned while a number is being edited: stays until editing ends */
  pinned: boolean;
}

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden>
    <path d="M10.6 2.6a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L6 12.8l-3.3.8.8-3.3z" />
    <path d="M9.5 3.8l2.7 2.7" />
  </svg>
);

export function Formula({ rec, analysis, onEdit, onAddTerm, onRemoveTerm }: Props) {
  const multi = rec.terms.length > 1;
  const { hover, selectAt } = useSelection();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef<string>('mouse');
  const tipBeforeTouch = useRef<string | null>(null);
  const tipId = useId();

  const cancelHide = () => window.clearTimeout(hideTimer.current);
  const show = useCallback(
    (key: string, el: HTMLElement, pinned = false) => {
      cancelHide();
      setTip((cur) => (cur?.pinned && !pinned ? cur : { key, el, pinned }));
      hover(entityOfKey(key));
    },
    [hover],
  );
  const hide = useCallback(() => {
    cancelHide();
    setTip(null);
    hover(null);
  }, [hover]);
  const hideSoon = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      setTip((cur) => (cur?.pinned ? cur : null));
      hover(null);
    }, 220);
  }, [hover]);

  useEffect(() => () => cancelHide(), []);
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !tip.pinned && hide();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip, hide]);
  useEffect(() => {
    if (!tip || tip.pinned) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t)) hide();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [tip, hide]);
  // Touch screens snap a tap to the nearest element that "responds to clicks",
  // and React's delegated handlers don't count. Without a native listener on
  // each part, a tap on the small "n" in n^d lands on the exponent button next
  // to it and starts editing instead of showing what the n means.
  useEffect(() => {
    const parts = wrapRef.current?.querySelectorAll<HTMLElement>('.formula .m-it, .formula .m') ?? [];
    const noop = () => {};
    parts.forEach((p) => p.addEventListener('click', noop));
    return () => parts.forEach((p) => p.removeEventListener('click', noop));
  }, [rec]);
  // the recurrence changed shape (term added/removed): drop a stale tip
  useEffect(() => {
    setTip((cur) => (cur && !cur.el.isConnected ? null : cur));
  }, [rec]);

  const partFrom = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.('[data-part]') as HTMLElement | null;
    return el && wrapRef.current?.contains(el) ? el : null;
  };

  const activate = (el: HTMLElement) => {
    const entity = entityOfKey(el.dataset.part!);
    if (entity) selectAt(entity, el);
  };

  const formulaHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    onPointerOver: (e: React.PointerEvent) => {
      const el = partFrom(e.target);
      // a touch "hovers" right before it taps: remember what was showing before it
      if (e.pointerType === 'touch') tipBeforeTouch.current = tip?.key ?? null;
      if (el) show(el.dataset.part!, el);
      else if (e.pointerType !== 'touch') hideSoon();
    },
    // a finger lifting off is not "moving away": touch tips close on a tap elsewhere
    onPointerLeave: (e: React.PointerEvent) => e.pointerType !== 'touch' && hideSoon(),
    onFocus: (e: React.FocusEvent) => {
      const el = partFrom(e.target);
      if (el) show(el.dataset.part!, el);
    },
    onBlur: () => hideSoon(),
    // non-editable parts open their explanation on click / Enter
    onClick: (e: React.MouseEvent) => {
      const el = partFrom(e.target);
      if (!el || el.dataset.editable) return;
      // first tap on a touch screen just shows the tooltip
      if (lastPointer.current === 'touch' && tipBeforeTouch.current !== el.dataset.part) {
        tipBeforeTouch.current = el.dataset.part!;
        show(el.dataset.part!, el);
        return;
      }
      activate(el);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const el = partFrom(e.target);
      if (!el || (!el.dataset.editable && el !== e.target)) return;
      if (!el.dataset.editable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        activate(el);
      } else if (el.dataset.editable && (e.key === '?' || e.key === 'i')) {
        e.preventDefault();
        activate(el);
      }
    },
  };

  const part = (key: string, label: string) => ({
    'data-part': key,
    tabIndex: 0,
    role: 'button' as const,
    'aria-label': label,
    'aria-describedby': tip?.key === key ? tipId : undefined,
    className: `fpart ${tip?.key === key ? 'part-active' : ''}`,
  });

  const editState = (key: string) => (editing: boolean, el: HTMLElement | null) => {
    if (editing && el) show(key, el, true);
    else hide();
  };

  return (
    <div className="formula-wrap" ref={wrapRef}>
      <div className="formula" role="group" aria-label="Recurrence. Numbers marked with a pencil are editable." {...formulaHandlers}>
        <span {...part('lhs', 'T of n, the total cost. Press Enter to learn more.')}>
          <span className="m-it">T</span>
          <span className="m">(</span>
          <span className="m-it">n</span>
          <span className="m">)</span>
        </span>
        <span className="m op">=</span>
        {rec.terms.map((t, i) => {
          const p = part(`call:${i}`, `${t.a === 1 ? '' : t.a}T(n/${t.b}), recursive calls. Press Enter to learn more.`);
          return (
            <span key={i} className={`term b${i}`}>
              {i > 0 && <span className="m op">+</span>}
              <span {...p} className={`term-body ${p.className}`}>
                <Editable
                  field="a"
                  value={t.a}
                  ghost={t.a === 1}
                  entity={{ kind: 'coef', term: i }}
                  label={`Number of calls a${multi ? i + 1 : ''}, currently ${t.a}. Enter to edit, question mark to explain.`}
                  onCommit={(v) => onEdit('a', i, v)}
                  onEditState={editState(`coef:${i}`)}
                  active={tip?.key === `coef:${i}`}
                  describedBy={tip?.key === `coef:${i}` ? tipId : undefined}
                  branch={i}
                />
                <span className="m-it">T</span>
                <span className="m paren">(</span>
                <span className="frac">
                  <span className="frac-num m-it">n</span>
                  <span className="frac-den">
                    <Editable
                      field="b"
                      value={t.b}
                      entity={{ kind: 'div', term: i }}
                      label={`Shrink factor b${multi ? i + 1 : ''}, currently ${t.b}. Enter to edit, question mark to explain.`}
                      onCommit={(v) => onEdit('b', i, v)}
                      onEditState={editState(`div:${i}`)}
                      active={tip?.key === `div:${i}`}
                      describedBy={tip?.key === `div:${i}` ? tipId : undefined}
                      branch={i}
                    />
                  </span>
                </span>
                <span className="m paren">)</span>
                {multi && (
                  <button
                    className="term-x"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      hide();
                      onRemoveTerm(i);
                    }}
                    onPointerOver={(e) => e.stopPropagation()}
                    aria-label={`Remove term ${t.a === 1 ? '' : t.a}T(n/${t.b})`}
                    title="Remove this term"
                  >
                    ×
                  </button>
                )}
              </span>
            </span>
          );
        })}
        <span {...part('fwork', `${analysis.rec.d === 0 ? '1' : `n to the ${analysis.rec.d}`}, the non-recursive work. Press Enter to learn more.`)}>
          <span className="m op">+</span>
          <span className="power">
            <span className="m-it">n</span>
            <sup>
              <Editable
                field="d"
                value={rec.d}
                ghost={rec.d === 1}
                entity={{ kind: 'exp' }}
                label={`Exponent d, currently ${rec.d}. Enter to edit, question mark to explain.`}
                onCommit={(v) => onEdit('d', 0, v)}
                onEditState={editState('exp')}
                active={tip?.key === 'exp'}
                describedBy={tip?.key === 'exp' ? tipId : undefined}
              />
            </sup>
          </span>
        </span>
      </div>
      {tip && (
        <FormulaTip
          id={tipId}
          tipKey={tip.key}
          anchor={tip.el}
          wrap={wrapRef.current}
          analysis={analysis}
          editing={tip.pinned}
          onEnter={cancelHide}
          onLeave={hideSoon}
          onLearn={() => {
            const entity = entityOfKey(tip.key);
            if (entity) selectAt(entity, tip.el);
            if (!tip.pinned) hide();
          }}
        />
      )}
      <div className="formula-actions">
        {rec.terms.length < LIMITS.terms.max ? (
          <button className="chip-btn" onClick={onAddTerm}>
            <span aria-hidden>＋</span> Add a recursive term
          </button>
        ) : (
          <span className="muted small">Up to {LIMITS.terms.max} recursive terms</span>
        )}
        <span className="muted small hint-edit">
          <span className="hint-pencil" aria-hidden>
            <PencilIcon />
          </span>
          <span className="hint-fine">Click a dashed number to change it. Point at any other part to see what it means.</span>
          <span className="hint-touch">Tap a dashed number to change it.</span>
        </span>
      </div>
    </div>
  );
}

function FormulaTip({ id, tipKey, anchor, wrap, analysis, editing, onEnter, onLeave, onLearn }: {
  id: string;
  tipKey: string;
  anchor: HTMLElement;
  wrap: HTMLElement | null;
  analysis: Analysis;
  editing: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onLearn: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null);
  const entity = entityOfKey(tipKey);
  const info = entity ? partTip(entity, analysis) : null;

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el || !wrap) return;
      const a = anchor.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const tw = el.offsetWidth;
      const th = el.offsetHeight;
      const cx = a.left + a.width / 2;
      const margin = 10;
      const clamped = Math.min(Math.max(cx, tw / 2 + margin), window.innerWidth - tw / 2 - margin);
      // above the part unless that would run under the top of the screen
      const below = a.top - th - 14 < 8;
      setPos({
        left: clamped - w.left,
        top: below ? a.bottom - w.top + 12 : a.top - w.top - 12,
        arrow: cx - clamped,
        below,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, wrap, tipKey, analysis]);

  if (!info) return null;
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`ftip ${pos?.below ? 'below' : 'above'} ${pos ? 'placed' : ''}`}
      style={pos ? { left: pos.left, top: pos.top, ['--arrow' as string]: `${pos.arrow}px` } : { left: 0, top: 0 }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      // keep focus in the number being edited when the tooltip is clicked
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="ftip-name">
        <Rich text={info.name} />
      </div>
      <div className="ftip-body">
        <Rich text={info.body} />
      </div>
      <div className="ftip-foot">
        {info.editable ? (
          <span className="ftip-edit">
            <PencilIcon className="ftip-icon" />
            {editing ? 'Type a new value · Enter to apply · Esc to cancel' : 'Editable: click to change it'}
          </span>
        ) : (
          <span className="ftip-fixed">{info.editHint}</span>
        )}
        <button className="ftip-learn" onClick={onLearn}>
          {info.editable ? 'What does this mean?' : 'Full explanation'} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Editable({ field, value, entity, label, onCommit, onEditState, active, describedBy, ghost, branch }: {
  field: Field;
  value: number;
  entity: Entity;
  label: string;
  onCommit: (v: number) => void;
  onEditState: (editing: boolean, el: HTMLElement | null) => void;
  active: boolean;
  describedBy?: string;
  ghost?: boolean;
  branch?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const hl = useHl([keyOf(entity)]);
  const key = keyOf(entity);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
  }, [flash]);

  const setEditingState = (on: boolean) => {
    setEditing(on);
    onEditState(on, wrapRef.current);
  };

  const start = () => {
    setDraft(String(value));
    setError(null);
    setFlash(null);
    setEditingState(true);
  };

  const tryCommit = (raw: string, close: boolean) => {
    const v = validateField(field, raw);
    if (v.ok) {
      setError(null);
      if (v.value !== value) onCommit(v.value);
      if (close) setEditingState(false);
      return true;
    }
    setError(v.message);
    return false;
  };

  return (
    <span className={`editable ${branch !== undefined ? `b${branch}` : ''} ${editing ? 'editing' : ''}`} ref={wrapRef} data-part={key} data-editable="1">
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="num-input"
            inputMode="numeric"
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={[error ? `err-${key}` : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined}
            value={draft}
            size={Math.max(1, draft.length)}
            onChange={(e) => {
              setDraft(e.target.value);
              const v = validateField(field, e.target.value);
              setError(v.ok ? null : v.message);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                tryCommit(draft, true);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setError(null);
                setEditingState(false);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const lim = { a: LIMITS.a, b: LIMITS.b, d: LIMITS.d }[field];
                const cur = Number(draft);
                const base = Number.isFinite(cur) ? cur : value;
                const next = Math.min(lim.max, Math.max(lim.min, Math.round(base) + (e.key === 'ArrowUp' ? 1 : -1)));
                setDraft(String(next));
                tryCommit(String(next), false);
              }
            }}
            onBlur={() => {
              const v = validateField(field, draft);
              if (!tryCommit(draft, true)) {
                setFlash(`${v.ok ? '' : v.message} Kept ${value}.`);
                setError(null);
                setEditingState(false);
              }
            }}
          />
          {error && (
            <span className="field-error" role="alert" id={`err-${key}`}>
              {error}
              <span className="field-error-sub">Enter to apply · Esc to cancel</span>
            </span>
          )}
        </>
      ) : (
        <>
          <button
            ref={btnRef}
            className={`num ${ghost ? 'ghost' : ''} ${active ? 'part-active' : ''} hl-${hl || 'none'}`}
            aria-label={label}
            aria-describedby={describedBy}
            onClick={(e) => {
              e.stopPropagation();
              start();
            }}
          >
            {value}
            <PencilIcon className="pencil" />
          </button>
          {flash && (
            <span className="field-error soft" role="status">
              {flash}
            </span>
          )}
        </>
      )}
    </span>
  );
}
