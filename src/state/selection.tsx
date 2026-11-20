import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Analysis } from '../math/recurrence';
import { keyOf, relatedKeys, type Entity } from './entities';

interface SelectionValue {
  selected: Entity | null;
  /** which side of the viewport the last selection was made on, so the explanation can avoid covering it */
  side: 'left' | 'right';
  /** the selected element's vertical extent in the viewport when it was picked */
  anchor: { top: number; bottom: number } | null;
  selectAt: (e: Entity, el: Element | null) => void;
  hovered: Entity | null;
  select: (e: Entity | null) => void;
  hover: (e: Entity | null) => void;
  /** keys related to the selected entity */
  active: Set<string>;
  /** keys related to the hovered entity */
  preview: Set<string>;
  primary: string | null;
}

const Ctx = createContext<SelectionValue | null>(null);

export function SelectionProvider({ analysis, shownLevels, children, selected, onSelect }: {
  analysis: Analysis;
  shownLevels: number;
  children: ReactNode;
  selected: Entity | null;
  onSelect: (e: Entity | null) => void;
}) {
  const [hovered, setHovered] = useState<Entity | null>(null);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [anchor, setAnchor] = useState<{ top: number; bottom: number } | null>(null);
  const selectAt = useCallback(
    (e: Entity, el: Element | null) => {
      if (el) {
        const r = el.getBoundingClientRect();
        setSide(r.left + r.width / 2 > window.innerWidth / 2 ? 'left' : 'right');
        setAnchor({ top: r.top, bottom: r.bottom });
      }
      onSelect(e);
    },
    [onSelect],
  );
  const active = useMemo(() => new Set(selected ? relatedKeys(selected, analysis, shownLevels) : []), [selected, analysis, shownLevels]);
  const preview = useMemo(() => new Set(hovered ? relatedKeys(hovered, analysis, shownLevels) : []), [hovered, analysis, shownLevels]);
  const hover = useCallback((e: Entity | null) => setHovered(e), []);
  const value = useMemo<SelectionValue>(
    () => ({ selected, side, anchor, selectAt, hovered, select: onSelect, hover, active, preview, primary: selected ? keyOf(selected) : null }),
    [selected, side, anchor, selectAt, hovered, onSelect, hover, active, preview],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelection(): SelectionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSelection outside provider');
  return v;
}

/**
 * Highlight state for an element that represents `keys`.
 * 'on'   – this is the selected thing itself
 * 'rel'  – related to the selection
 * 'peek' – related to what is hovered
 */
export function useHl(keys: string[]): '' | 'on' | 'rel' | 'peek' {
  const { active, preview, primary } = useSelection();
  if (primary && keys[0] === primary) return 'on';
  if (keys.some((k) => active.has(k))) return 'rel';
  if (keys.some((k) => preview.has(k))) return 'peek';
  return '';
}

/** Props to make any element a clickable, keyboard-accessible "learn" target. */
export function useLearnable(entity: Entity, opts: { hoverPreview?: boolean; tabIndex?: number } = {}) {
  const { selectAt, hover } = useSelection();
  return {
    role: 'button' as const,
    tabIndex: opts.tabIndex ?? 0,
    onClick: (ev: React.MouseEvent) => {
      ev.stopPropagation();
      selectAt(entity, ev.currentTarget);
    },
    onKeyDown: (ev: React.KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation();
        selectAt(entity, ev.currentTarget);
      }
    },
    ...(opts.hoverPreview !== false
      ? { onMouseEnter: () => hover(entity), onMouseLeave: () => hover(null), onFocus: () => hover(entity), onBlur: () => hover(null) }
      : {}),
  };
}
