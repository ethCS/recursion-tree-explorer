import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { shortInt, shortNum, sizeText, superscript, workText } from '../math/format';
import { p0Parts } from '../explain/tex';
import type { Analysis, ConcreteLevel } from '../math/recurrence';
import { useHl, useLearnable, useSelection } from '../state/selection';
import { defaultRealDepth, layoutTree, LEVEL_GAP, NODE_CAP, NODE_H, NODE_W, type Band, type LNode } from '../tree/layout';

interface Props {
  analysis: Analysis;
  maxLevel: number;
  concrete: { n: number; levels: ConcreteLevel[] } | null;
  /** changes when the tree should animate building from the root */
  buildKey: number;
  reducedMotion: boolean;
}

type View = { x: number; y: number; k: number };

export function TreeView({ analysis, maxLevel, concrete, buildKey, reducedMotion }: Props) {
  const rec = analysis.rec;
  const recKey = JSON.stringify(rec);
  const baseDepth = useMemo(() => defaultRealDepth(rec, maxLevel), [recKey, maxLevel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [realDepth, setRealDepth] = useState(baseDepth);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [buildDepth, setBuildDepth] = useState(Infinity);
  const [notice, setNotice] = useState<string | null>(null);

  // A new recurrence resets expansion state.
  useEffect(() => {
    setRealDepth(baseDepth);
    setCollapsed(new Set());
    setExpanded(new Set());
  }, [recKey, baseDepth]);

  // Build animation: reveal one level at a time.
  useEffect(() => {
    if (buildKey === 0 || reducedMotion) {
      setBuildDepth(Infinity);
      return;
    }
    setBuildDepth(0);
    let d = 0;
    const id = setInterval(() => {
      d++;
      setBuildDepth(d);
      if (d > maxLevel) clearInterval(id);
    }, 320);
    return () => clearInterval(id);
  }, [buildKey, reducedMotion, maxLevel]);

  const layout = useMemo(
    () =>
      layoutTree({
        rec,
        maxLevel: Math.min(maxLevel, buildDepth),
        realDepth: Math.min(realDepth, buildDepth),
        collapsed,
        expanded,
        concrete,
      }),
    [recKey, maxLevel, buildDepth, realDepth, collapsed, expanded, concrete], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const toggle = useCallback(
    (v: LNode) => {
      if (v.open) {
        setCollapsed((s) => new Set(s).add(v.id));
        setExpanded((s) => {
          const n = new Set(s);
          n.delete(v.id);
          return n;
        });
      } else {
        const kids = rec.terms.reduce((s, t) => s + t.a, 0);
        if (layout.realCount + kids > NODE_CAP) {
          setNotice(`That would draw more than ${NODE_CAP} nodes. Deeper nodes stay grouped by size.`);
          return;
        }
        setExpanded((s) => new Set(s).add(v.id));
        setCollapsed((s) => {
          const n = new Set(s);
          n.delete(v.id);
          return n;
        });
      }
    },
    [rec, layout.realCount],
  );

  const expandLevel = useCallback(
    (b: Band) => {
      if (!b.canExpand) {
        setNotice(`Level ${b.level} has too many nodes to draw individually (${shortInt(b.expandCost)} > ${NODE_CAP}).`);
        return;
      }
      setRealDepth((d) => Math.max(d, b.level));
      setCollapsed(new Set());
    },
    [],
  );

  // ---------- pan & zoom ----------
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 440 });
  const [view, setView] = useState<View>({ x: 300, y: 40, k: 1 });
  const [animView, setAnimView] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; dist?: number; k?: number; mid?: { x: number; y: number } } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (animate = true) => {
      const { x0, x1, y0, y1 } = layout.bounds;
      const pad = 36;
      const bw = x1 - x0 + 80; // room for level labels
      const bh = y1 - y0 + 70; // room for the tail note
      const kw = (size.w - pad * 2) / bw;
      const kh = (size.h - pad * 2) / bh;
      // Fit everything when that stays readable; for tall trees fit the width and let the user pan down.
      const k = Math.max(0.2, Math.min(1.25, Math.max(Math.min(kw, kh), Math.min(kw, 0.72))));
      const cx = (x0 - 80 + x1) / 2;
      setAnimView(animate && !reducedMotion);
      setView({ k, x: size.w / 2 - cx * k, y: pad + (-y0 + 8) * k });
    },
    [layout.bounds, size, reducedMotion],
  );

  // Refit when the recurrence, mode or container changes (not on expand/collapse).
  const fitKey = `${recKey}|${concrete?.n ?? 'sym'}|${Math.round(size.w)}x${Math.round(size.h)}|${buildDepth > maxLevel ? 'done' : buildDepth}`;
  useEffect(() => {
    fit(true);
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!animView) return;
    const t = setTimeout(() => setAnimView(false), 520);
    return () => clearTimeout(t);
  }, [animView, view]);

  const zoomAt = useCallback((factor: number, px: number, py: number, animate = false) => {
    setAnimView(animate);
    setView((v) => {
      const k = Math.max(0.15, Math.min(4, v.k * factor));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const local = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.current.set(e.pointerId, local(e));
    suppressClick.current = false;
    if (pointers.current.size === 1) {
      const p = local(e);
      drag.current = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: 0, y: 0, vx: view.x, vy: view.y, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (pointers.current.size >= 2 && d.dist && d.k && d.mid) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = Math.max(0.15, Math.min(4, d.k * (dist / d.dist)));
      const f = k / d.k;
      setAnimView(false);
      setView({ k, x: mid.x - (d.mid.x - d.vx) * f, y: mid.y - (d.mid.y - d.vy) * f });
      suppressClick.current = true;
      return;
    }
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    suppressClick.current = true;
    setAnimView(false);
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      drag.current = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: true };
    }
  };

  const { select } = useSelection();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 40;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setAnimView(true);
      setView((v) => ({ ...v, x: v.x + moves[e.key][0], y: v.y + moves[e.key][1] }));
    } else if (e.key === '+' || e.key === '=') zoomAt(1.25, size.w / 2, size.h / 2, true);
    else if (e.key === '-') zoomAt(0.8, size.w / 2, size.h / 2, true);
    else if (e.key === '0') fit(true);
  };

  // ---------- labels ----------
  const d = rec.d;
  const sizeLabel = (den: bigint) => (concrete ? shortNum(concrete.n / Number(den)) : sizeText(den));
  const workLabel = (den: bigint, base: boolean) => (concrete ? (base ? '1' : shortNum(Math.pow(concrete.n / Number(den), d))) : workText(den, d));

  const byId = useMemo(() => new Map(layout.nodes.map((v) => [v.id, v])), [layout.nodes]);
  const { x0, x1 } = layout.bounds;
  const lastY = layout.levelY(layout.maxLevel);
  const symbolicTail = !concrete && layout.maxLevel === maxLevel;

  return (
    <div className="tree-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className={`tree-svg ${drag.current?.moved ? 'grabbing' : ''}`}
        width={size.w}
        height={size.h}
        tabIndex={0}
        role="group"
        aria-label="Recursion tree. Drag to pan, scroll or pinch to zoom, arrow keys to pan, plus and minus to zoom, 0 to reset."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onClick={() => select(null)}
        onKeyDown={onKeyDown}
      >
        <g className={`viewport ${animView ? 'anim' : ''}`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          {[...Array(layout.maxLevel + 1).keys()].map((l) => (
            <LevelBand key={l} level={l} x0={x0 - 70} x1={x1 + 24} y={layout.levelY(l)} />
          ))}
          {layout.bands.map((b) => (
            <g key={`f${b.level}`} className="feeders">
              {b.feeders.map((f, i) => (
                <line key={i} x1={f.x} y1={f.y} x2={(b.x0 + b.x1) / 2} y2={b.y - NODE_H / 2} className={f.band ? 'feeder band' : 'feeder'} />
              ))}
            </g>
          ))}
          {layout.nodes.map((v) => {
            if (!v.parent && v.parent !== '') return null;
            const p = byId.get(v.parent);
            return p ? <Edge key={`e${v.id}`} from={p} to={v} /> : null;
          })}
          {layout.bands.map((b) => (
            <BandView key={`b${b.level}`} band={b} sizeLabel={sizeLabel} workLabel={workLabel} onExpand={() => expandLevel(b)} />
          ))}
          {layout.nodes.map((v) => {
            const p = v.parent !== null ? byId.get(v.parent) : undefined;
            return <NodeView key={v.id} node={v} from={p ?? v} size={sizeLabel(v.den)} work={workLabel(v.den, v.base)} onToggle={toggle} />;
          })}
          {symbolicTail && <Tail y={lastY + NODE_H / 2 + 26} x={(x0 + x1) / 2} analysis={analysis} />}
        </g>
      </svg>
      <div className="tree-tools" role="toolbar" aria-label="Tree view">
        <button className="icon-btn" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2, true)} aria-label="Zoom in" title="Zoom in (+)">
          <svg viewBox="0 0 16 16" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
        </button>
        <button className="icon-btn" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2, true)} aria-label="Zoom out" title="Zoom out (−)">
          <svg viewBox="0 0 16 16" aria-hidden><path d="M3 8h10" /></svg>
        </button>
        <button className="icon-btn" onClick={() => fit(true)} aria-label="Reset view" title="Reset view (0)">
          <svg viewBox="0 0 16 16" aria-hidden><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg>
        </button>
      </div>
      <div className="tree-legend" aria-hidden>
        {rec.terms.map((t, i) => (
          <span key={i} className={`legend-item b${i}`}>
            <i /> n/{t.b}
          </span>
        ))}
        <span className="legend-item grouped">
          <i /> grouped
        </span>
        <span className="legend-count">{layout.realCount} drawn</span>
      </div>
      {notice && (
        <div className="tree-notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

function useEntered() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);
  return entered;
}

const LevelBand = memo(function LevelBand({ level, x0, x1, y }: { level: number; x0: number; x1: number; y: number }) {
  const hl = useHl([`level:${level}`]);
  const learn = useLearnable({ kind: 'level', level });
  return (
    <g className={`level-band hl-${hl || 'none'}`}>
      <rect x={x0} y={y - LEVEL_GAP / 2 + 6} width={x1 - x0} height={LEVEL_GAP - 12} rx={12} />
      <text x={x0 + 14} y={y + 4} className="level-label" {...learn} aria-label={`Level ${level}`}>
        L{level}
      </text>
    </g>
  );
});

function Edge({ from, to }: { from: LNode; to: LNode }) {
  const entered = useEntered();
  const px = from.x;
  const py = from.y + NODE_H / 2;
  const dx = entered ? to.x - from.x : 0;
  const dy = entered ? to.y - NODE_H / 2 - py : 0;
  const hl = useHl([`branch:${to.branch}`]);
  return (
    <line
      x1={0}
      y1={0}
      x2={1}
      y2={1}
      className={`edge b${to.branch} hl-${hl || 'none'}`}
      vectorEffect="non-scaling-stroke"
      style={{ transform: `translate(${px}px, ${py}px) scale(${dx || 0.0001}, ${dy || 0.0001})` }}
    />
  );
}

const NodeView = memo(function NodeView({ node, from, size, work, onToggle }: { node: LNode; from: LNode; size: string; work: string; onToggle: (v: LNode) => void }) {
  const entered = useEntered();
  const keys = [`node:${node.id}`, `tuple:${node.level}:${node.den}`, `branch:${node.branch}`];
  const hl = useHl(keys);
  const learn = useLearnable({ kind: 'node', path: node.id });
  const x = entered ? node.x : from.x;
  const y = entered ? node.y : from.y;
  return (
    <g className={`node-pos`} style={{ transform: `translate(${x}px, ${y}px) scale(${entered ? 1 : 0.2})`, opacity: entered ? 1 : 0 }}>
      <g className={`node b${node.branch} ${node.base ? 'base' : ''} hl-${hl || 'none'}`} {...learn} aria-label={`Node at level ${node.level}, size ${size}, work ${work}`}>
        <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={10} />
        <text y={-2} className="node-size">
          {size}
        </text>
        <text y={15} className="node-work">
          work {work}
        </text>
      </g>
      {node.expandable && (
        <g
          className={`knob ${node.open ? 'open' : 'closed'}`}
          role="button"
          tabIndex={0}
          aria-label={node.open ? 'Collapse children' : 'Expand children'}
          aria-expanded={node.open}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggle(node);
            }
          }}
          transform={`translate(0, ${NODE_H / 2})`}
        >
          <circle r={8} />
          <path d={node.open ? 'M-3.5 0h7' : 'M-3.5 0h7M0 -3.5v7'} />
        </g>
      )}
    </g>
  );
});

function BandView({ band, sizeLabel, workLabel, onExpand }: { band: Band; sizeLabel: (d: bigint) => string; workLabel: (d: bigint, base: boolean) => string; onExpand: () => void }) {
  return (
    <g className="band">
      {band.chips.map((c) => (
        <ChipView key={String(c.den)} chip={c} size={sizeLabel(c.den)} work={workLabel(c.den, c.base)} />
      ))}
      {band.more > 0 && (
        <text x={band.x1 + 10} y={band.y + 4} className="band-more">
          +{band.more} sizes
        </text>
      )}
      <g
        className={`band-expand ${band.canExpand ? '' : 'disabled'}`}
        role="button"
        tabIndex={0}
        aria-label={band.canExpand ? `Draw level ${band.level} as individual nodes` : `Level ${band.level} has too many nodes to draw`}
        aria-disabled={!band.canExpand}
        transform={`translate(${band.x0 - 16}, ${band.y})`}
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onExpand();
          }
        }}
      >
        <title>{band.canExpand ? 'Draw these as individual nodes' : `Too many nodes to draw (${shortInt(band.expandCost)})`}</title>
        <circle r={9} />
        <path d="M-4 0h8M0 -4v8" />
      </g>
    </g>
  );
}

function ChipView({ chip, size, work }: { chip: Band['chips'][number]; size: string; work: string }) {
  const entered = useEntered();
  const keys = [`tuple:${chip.level}:${chip.den}`];
  const hl = useHl(keys);
  const learn = useLearnable({ kind: 'tuple', level: chip.level, den: String(chip.den) });
  return (
    <g className="chip-pos" style={{ transform: `translate(${chip.x}px, ${chip.y}px)`, opacity: entered ? 1 : 0 }}>
      <g className={`chip ${chip.base ? 'base' : ''} hl-${hl || 'none'}`} {...learn} aria-label={`${shortInt(chip.count)} nodes of size ${size}`}>
        <rect x={-chip.w / 2} y={-NODE_H / 2} width={chip.w} height={NODE_H} rx={10} />
        <rect x={-chip.w / 2 + 4} y={-NODE_H / 2 + 4} width={chip.w - 8} height={NODE_H - 8} rx={7} className="chip-inner" />
        <text y={-3} className="node-size">
          {shortInt(chip.count)} × {size}
        </text>
        <text y={13} className="node-work">
          {chip.base ? 'base cases' : `work ${work} each`}
        </text>
      </g>
    </g>
  );
}

function Tail({ x, y, analysis }: { x: number; y: number; analysis: Analysis }) {
  const learn = useLearnable({ kind: 'leafrow' });
  const hl = useHl(['leafrow']);
  const p = p0Parts(analysis);
  const single1 = analysis.rec.terms.length === 1 && analysis.rec.terms[0].a === 1;
  const pv = p.val === '1' ? 'n' : p.val === '0' ? '1' : `n${superscript(p.val.replace('/', 'ᐟ'))}`;
  const leaves = single1 ? '1 leaf' : `${p.exact ? '' : '≈ '}${pv} leaves`;
  return (
    <g className={`tail hl-${hl || 'none'}`} {...learn} aria-label="Leaves of the tree">
      <text x={x} y={y} className="tail-dots">
        ⋮
      </text>
      <text x={x} y={y + 26} className="tail-text">
        {`continues to depth log${sub(analysis.minB)} n · ${leaves} of size 1`}
      </text>
    </g>
  );
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map((c) => SUBS[Number(c)]).join('');
