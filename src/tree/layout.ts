/**
 * Builds and lays out the visible recursion tree. Pure (no DOM).
 *
 * The top of the tree is drawn as real nodes. Nodes that are not drawn are
 * not lost: every level shows "grouped" chips for the nodes it couldn't draw
 * individually ("4 × n/16"), so each level always accounts for all its nodes.
 *
 * Node paths: two characters per step, branch index + copy letter
 * ("0a1b" = first copy of branch 0, then second copy of branch 1).
 */
import { levelTuples, type ConcreteLevel, type Recurrence } from '../math/recurrence';

export const NODE_W = 80;
export const NODE_H = 46;
const GAP = 8;
export const LEVEL_GAP = 88;
const CHIP_W = 118;
const CHIP_GAP = 10;
const MAX_CHIPS = 6;
export const NODE_CAP = 150;

export const pathLevel = (p: string) => p.length / 2;
export const pathBranches = (p: string) => [...Array(p.length / 2).keys()].map((i) => Number(p[2 * i]));
export const pathLastBranch = (p: string) => (p.length ? Number(p[p.length - 2]) : -1);
export const pathParent = (p: string) => (p.length ? p.slice(0, -2) : null);
export const pathDen = (rec: Recurrence, p: string) => pathBranches(p).reduce((acc, i) => acc * BigInt(rec.terms[i].b), 1n);

export interface LNode {
  id: string;
  level: number;
  den: bigint;
  branch: number;
  x: number;
  y: number;
  parent: string | null;
  open: boolean;
  /** has children that could be shown */
  expandable: boolean;
  /** concrete mode base case (size <= 1) */
  base: boolean;
}

export interface Chip {
  level: number;
  den: bigint;
  count: number;
  x: number;
  y: number;
  w: number;
  base: boolean;
}

export interface Band {
  level: number;
  y: number;
  chips: Chip[];
  /** tuples not shown as chips */
  more: number;
  moreCount: number;
  /** x-range covered by the chips */
  x0: number;
  x1: number;
  /** points that feed into this band from above (frontier nodes or the band above) */
  feeders: { x: number; y: number; band: boolean }[];
  /** can this level be expanded into real nodes without exceeding the cap? */
  canExpand: boolean;
  /** node count if fully expanded */
  expandCost: number;
}

export interface TreeLayout {
  nodes: LNode[];
  bands: Band[];
  maxLevel: number;
  realCount: number;
  capped: boolean;
  bounds: { x0: number; y0: number; x1: number; y1: number };
  levelY: (l: number) => number;
}

export interface TreeOptions {
  rec: Recurrence;
  maxLevel: number;
  /** levels 0..realDepth-1 are open by default */
  realDepth: number;
  collapsed: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  /** concrete mode: n and its levels; base cases have size <= 1 */
  concrete: { n: number; levels: ConcreteLevel[] } | null;
}

/** Biggest default depth that keeps the tree readable. */
export function defaultRealDepth(rec: Recurrence, maxLevel: number): number {
  const s = rec.terms.reduce((acc, t) => acc + t.a, 0);
  // too many children to read even one level of them: start grouped
  if (s > 12) return 0;
  let D = 1;
  let total = 1 + s;
  while (D < maxLevel) {
    const next = Math.pow(s, D + 1);
    // keep the widest drawn level readable at a normal zoom
    if (total + next > 32 || next > 12) break;
    total += next;
    D++;
  }
  return D;
}

export function layoutTree(o: TreeOptions): TreeLayout {
  const { rec, maxLevel, collapsed, expanded, concrete } = o;
  const isBase = (den: bigint) => (concrete ? concrete.n / Number(den) <= 1 : false);

  // 1. Decide which nodes are real (breadth-first so the cap trims the bottom first).
  interface Raw {
    id: string;
    level: number;
    den: bigint;
    open: boolean;
    expandable: boolean;
    base: boolean;
    children: Raw[];
  }
  const root: Raw = { id: '', level: 0, den: 1n, open: false, expandable: false, base: isBase(1n), children: [] };
  const all: Raw[] = [root];
  let capped = false;
  const queue: Raw[] = [root];
  const kidsPer = rec.terms.reduce((s, t) => s + t.a, 0);
  while (queue.length) {
    const v = queue.shift()!;
    v.expandable = !v.base && v.level < maxLevel;
    const wanted = (v.level < o.realDepth && !collapsed.has(v.id)) || expanded.has(v.id);
    if (!v.expandable || !wanted) continue;
    if (all.length + kidsPer > NODE_CAP) {
      capped = true;
      continue;
    }
    v.open = true;
    rec.terms.forEach((t, i) => {
      for (let j = 0; j < t.a; j++) {
        const den = v.den * BigInt(t.b);
        const c: Raw = { id: v.id + i + String.fromCharCode(97 + j), level: v.level + 1, den, open: false, expandable: false, base: isBase(den), children: [] };
        v.children.push(c);
        all.push(c);
        queue.push(c);
      }
    });
  }

  // 2. Tidy x positions: each closed node takes one slot, open nodes centre over children.
  const slot = NODE_W + GAP;
  let cursor = 0;
  const pos = new Map<string, number>();
  const place = (v: Raw): number => {
    if (!v.open) {
      const x = cursor;
      cursor += slot;
      pos.set(v.id, x);
      return x;
    }
    const xs = v.children.map(place);
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    pos.set(v.id, x);
    return x;
  };
  place(root);
  const shift = pos.get('')!;
  const levelY = (l: number) => l * LEVEL_GAP;
  const nodes: LNode[] = all.map((v) => ({
    id: v.id,
    level: v.level,
    den: v.den,
    branch: v.id.length ? Number(v.id[v.id.length - 2]) : -1,
    x: pos.get(v.id)! - shift,
    y: levelY(v.level),
    parent: v.id.length ? v.id.slice(0, -2) : null,
    open: v.open,
    expandable: v.expandable,
    base: v.base,
  }));

  // 3. Grouped bands: per level, the tuples minus what is drawn for real.
  const realByLevel = new Map<number, Map<bigint, number>>();
  for (const v of nodes) {
    const m = realByLevel.get(v.level) ?? new Map<bigint, number>();
    m.set(v.den, (m.get(v.den) ?? 0) + 1);
    realByLevel.set(v.level, m);
  }
  const lastLevel = concrete ? Math.min(maxLevel, concrete.levels.length - 1) : maxLevel;
  const bands: Band[] = [];
  let prevBand: Band | null = null;
  for (let l = 1; l <= lastLevel; l++) {
    const tuples: { den: bigint; count: number; base: boolean }[] = concrete
      ? concrete.levels[l].tuples.map((t) => ({ den: t.den, count: t.count, base: t.leaf }))
      : levelTuples(rec, l).map((t) => ({ den: t.den, count: Number(t.count), base: false }));
    const real = realByLevel.get(l);
    const rest = tuples.map((t) => ({ ...t, count: t.count - (real?.get(t.den) ?? 0) })).filter((t) => t.count > 0);
    if (!rest.length) {
      prevBand = null;
      continue;
    }
    const shown = rest.slice(0, MAX_CHIPS);
    const width = shown.length * CHIP_W + (shown.length - 1) * CHIP_GAP;
    const realXs = nodes.filter((v) => v.level === l).map((v) => v.x);
    // feeders: closed, expandable real nodes on the level above
    const feederNodes = nodes.filter((v) => v.level === l - 1 && !v.open && v.expandable);
    let x0: number;
    if (realXs.length) x0 = Math.max(...realXs) + NODE_W / 2 + GAP * 2;
    else if (feederNodes.length) {
      const fx = feederNodes.map((v) => v.x);
      x0 = (Math.min(...fx) + Math.max(...fx)) / 2 - width / 2;
    } else if (prevBand) x0 = (prevBand.x0 + prevBand.x1) / 2 - width / 2;
    else x0 = -width / 2;
    const y = levelY(l);
    const chips: Chip[] = shown.map((t, k) => ({ level: l, den: t.den, count: t.count, x: x0 + k * (CHIP_W + CHIP_GAP) + CHIP_W / 2, y, w: CHIP_W, base: t.base }));
    const feeders = feederNodes.map((v) => ({ x: v.x, y: v.y + NODE_H / 2, band: false }));
    if (prevBand) feeders.push({ x: (prevBand.x0 + prevBand.x1) / 2, y: prevBand.y + NODE_H / 2, band: true });
    const restCount = rest.reduce((s, t) => s + t.count, 0);
    const band: Band = {
      level: l,
      y,
      chips,
      more: rest.length - shown.length,
      moreCount: rest.slice(MAX_CHIPS).reduce((s, t) => s + t.count, 0),
      x0,
      x1: x0 + width,
      feeders,
      canExpand: nodes.length + restCount <= NODE_CAP && (feederNodes.length > 0 || l <= o.realDepth + 1),
      expandCost: nodes.length + restCount,
    };
    bands.push(band);
    prevBand = band;
  }

  // 4. Bounds
  let x0 = Infinity,
    x1 = -Infinity,
    y1 = 0;
  for (const v of nodes) {
    x0 = Math.min(x0, v.x - NODE_W / 2);
    x1 = Math.max(x1, v.x + NODE_W / 2);
    y1 = Math.max(y1, v.y + NODE_H / 2);
  }
  for (const b of bands) {
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1 + (b.more ? 70 : 0));
    y1 = Math.max(y1, b.y + NODE_H / 2);
  }
  return { nodes, bands, maxLevel: lastLevel, realCount: nodes.length, capped, bounds: { x0, y0: -NODE_H / 2, x1, y1 }, levelY };
}
