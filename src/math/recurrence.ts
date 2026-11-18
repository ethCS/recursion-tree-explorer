/**
 * Pure, UI-independent math for divide-and-conquer recurrences
 *
 *   T(n) = a_1 T(n / b_1) + ... + a_m T(n / b_m) + n^d
 *
 * analysed with the recursion-tree method. Sizes, counts and the level ratio
 * r are exact (BigInt rationals), so r = 1 is detected exactly. Floors and
 * ceilings are dropped throughout.
 */
import { add, cmp, ONE, pow, rat, toNumber, type Rational } from './rational';

export interface Term {
  /** number of recursive calls of this shape (integer >= 1) */
  a: number;
  /** shrink factor: each call has size n / b (integer >= 2) */
  b: number;
}

export interface Recurrence {
  terms: Term[];
  /** non-recursive work f(n) = n^d (integer >= 0) */
  d: number;
}

export const LIMITS = {
  a: { min: 1, max: 16 },
  b: { min: 2, max: 16 },
  d: { min: 0, max: 4 },
  terms: { min: 1, max: 3 },
} as const;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type Field = 'a' | 'b' | 'd';

export type Validation = { ok: true; value: number } | { ok: false; message: string };

/**
 * Validate a raw string typed into one of the editable numbers. Messages are
 * written for a person, and explain *why* the rule exists.
 */
export function validateField(field: Field, raw: string): Validation {
  const s = raw.trim();
  if (s === '') return { ok: false, message: 'Type a number here.' };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, message: `“${s}” isn’t a number.` };
  const v = Number(s);
  const lim = LIMITS[field];
  switch (field) {
    case 'a':
      if (!Number.isInteger(v)) return { ok: false, message: 'a counts recursive calls, so it must be a whole number.' };
      if (v < 1) return { ok: false, message: 'a must be at least 1. With 0 calls, the term disappears; remove it with × instead.' };
      if (v > lim.max) return { ok: false, message: `Keep a ≤ ${lim.max} so the tree stays readable.` };
      return { ok: true, value: v };
    case 'b':
      if (!Number.isInteger(v)) return { ok: false, message: 'b must be a whole number (sizes are n/2, n/3, …).' };
      if (v < 2) return { ok: false, message: 'b must be at least 2. With b = 1 the subproblem never shrinks, so the recursion never ends.' };
      if (v > lim.max) return { ok: false, message: `Keep b ≤ ${lim.max}.` };
      return { ok: true, value: v };
    case 'd':
      if (v < 0) return { ok: false, message: 'd must be ≥ 0. Use d = 0 for constant work f(n) = 1.' };
      if (!Number.isInteger(v)) return { ok: false, message: 'This tool uses whole-number d (0–4) so that r can be computed exactly.' };
      if (v > lim.max) return { ok: false, message: `Keep d ≤ ${lim.max}.` };
      return { ok: true, value: v };
  }
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export interface Normalized {
  rec: Recurrence;
  /** human-readable notes about merges that happened, e.g. "T(n/2) + T(n/2) → 2T(n/2)" */
  merges: string[];
}

/** Merge terms that share the same b (keeping first-appearance order). */
export function normalize(rec: Recurrence): Normalized {
  const out: Term[] = [];
  const merges: string[] = [];
  for (const t of rec.terms) {
    const hit = out.find((o) => o.b === t.b);
    if (hit) {
      const before = `${coefText(hit.a)}T(n/${t.b}) + ${coefText(t.a)}T(n/${t.b})`;
      hit.a += t.a;
      merges.push(`${before} → ${coefText(hit.a)}T(n/${t.b})`);
    } else out.push({ ...t });
  }
  return { rec: { terms: out, d: rec.d }, merges };
}

const coefText = (a: number) => (a === 1 ? '' : String(a));

/* ------------------------------------------------------------------ */
/* The ratio r                                                         */
/* ------------------------------------------------------------------ */

/** a_i / b_i^d for one term: how much of a parent's work this branch's children redo. */
export function termRatio(t: Term, d: number): Rational {
  return rat(BigInt(t.a), BigInt(t.b) ** BigInt(d));
}

/** r = Σ a_i / b_i^d, exact. */
export function ratio(rec: Recurrence): Rational {
  return rec.terms.reduce((acc, t) => add(acc, termRatio(t, rec.d)), rat(0));
}

export type Case = 'root' | 'equal' | 'leaves';

/** r < 1 → root dominates, r = 1 → all levels equal, r > 1 → leaves dominate */
export function classify(rec: Recurrence): Case {
  const c = cmp(ratio(rec), ONE);
  return c < 0 ? 'root' : c === 0 ? 'equal' : 'leaves';
}

/* ------------------------------------------------------------------ */
/* Level tuples                                                        */
/* ------------------------------------------------------------------ */

/** One way to reach a level: take branch i exactly ks[i] times, in any order. */
export interface Composition {
  ks: number[];
  /** number of orderings: multinomial(level; ks) */
  orderings: bigint;
  /** Π a_i^{k_i} */
  coefProduct: bigint;
}

/** A (work per node, number of nodes) tuple: `count` nodes of size n / den. */
export interface Tuple {
  level: number;
  den: bigint;
  count: bigint;
  /** compositions that land on this size (more than one if sizes collide) */
  parts: Composition[];
}

/** All k-vectors of length m summing to l, first entry descending (matches course table order). */
export function compositions(l: number, m: number): number[][] {
  if (m === 1) return [[l]];
  const out: number[][] = [];
  for (let k = l; k >= 0; k--) for (const rest of compositions(l - k, m - 1)) out.push([k, ...rest]);
  return out;
}

const factorials: bigint[] = [1n];
function fact(n: number): bigint {
  for (let i = factorials.length; i <= n; i++) factorials[i] = factorials[i - 1] * BigInt(i);
  return factorials[n];
}

/**
 * The tuples at a given level, grouped by subproblem size, in the order the
 * course table uses: (n/16, 4), (n/8, 4), (n/4, 1) for 2T(n/4) + T(n/2).
 */
export function levelTuples(rec: Recurrence, level: number): Tuple[] {
  const byDen = new Map<bigint, Tuple>();
  for (const ks of compositions(level, rec.terms.length)) {
    let den = 1n;
    let coefProduct = 1n;
    let orderings = fact(level);
    ks.forEach((k, i) => {
      den *= BigInt(rec.terms[i].b) ** BigInt(k);
      coefProduct *= BigInt(rec.terms[i].a) ** BigInt(k);
      orderings /= fact(k);
    });
    const part: Composition = { ks, orderings, coefProduct };
    const existing = byDen.get(den);
    if (existing) {
      existing.count += orderings * coefProduct;
      existing.parts.push(part);
    } else byDen.set(den, { level, den, count: orderings * coefProduct, parts: [part] });
  }
  return [...byDen.values()];
}

/** Total node count at a level: (Σ a_i)^level */
export function nodesAtLevel(rec: Recurrence, level: number): bigint {
  const s = rec.terms.reduce((acc, t) => acc + BigInt(t.a), 0n);
  return s ** BigInt(level);
}

/** Work of one node of size n/den, as a coefficient of n^d: 1 / den^d */
export function nodeWorkCoef(den: bigint, d: number): Rational {
  return rat(1n, den ** BigInt(d));
}

/** A tuple's contribution to its level total, as a coefficient of n^d: count / den^d */
export function tupleTotalCoef(t: Tuple, d: number): Rational {
  return rat(t.count, t.den ** BigInt(d));
}

/** The level total as a coefficient of n^d: Σ count / den^d. Always equals r^level. */
export function levelTotalCoef(rec: Recurrence, level: number): Rational {
  return levelTuples(rec, level).reduce((acc, t) => add(acc, tupleTotalCoef(t, rec.d)), rat(0));
}

/** r^level, the closed form for the level total coefficient. */
export function predictedLevelCoef(rec: Recurrence, level: number): Rational {
  return pow(ratio(rec), level);
}

/* ------------------------------------------------------------------ */
/* Depth, leaves, critical exponent                                    */
/* ------------------------------------------------------------------ */

/** The slowest-shrinking branch (smallest b) sets the depth of the tree. */
export const minB = (rec: Recurrence) => Math.min(...rec.terms.map((t) => t.b));
/** The fastest-shrinking branch (largest b) bottoms out first: the tree is full only to log_{bmax} n. */
export const maxB = (rec: Recurrence) => Math.max(...rec.terms.map((t) => t.b));

/**
 * Solve Σ a_i / b_i^p = target for p by bisection. The left side is strictly
 * decreasing in p, so the root is unique. Returns NaN if no root in [0, 64].
 */
export function solveExponent(terms: Term[], target = 1): number {
  const f = (p: number) => terms.reduce((s, t) => s + t.a * Math.pow(t.b, -p), 0) - target;
  let lo = 0;
  let hi = 64;
  if (f(lo) < 0 || f(hi) > 0) return NaN;
  if (f(lo) === 0) return 0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Critical exponent p0 with Σ a_i / b_i^{p0} = 1. The tree has Θ(n^{p0})
 * leaves. For one term, p0 = log_b a. Comparing d with p0 is the same
 * question as comparing r with 1.
 */
export function criticalExponent(rec: Recurrence): number {
  // r = 1 means Σ a_i / b_i^d = 1 exactly, so d itself is the root
  if (classify(rec) === 'equal') return rec.d;
  if (rec.terms.length === 1) {
    const { a, b } = rec.terms[0];
    return Math.log(a) / Math.log(b);
  }
  return solveExponent(rec.terms);
}

/**
 * For a single term, try to express log_b a exactly as p/q with small q
 * (e.g. log_4 8 = 3/2, log_2 4 = 2). Returns null if irrational.
 */
export function exactLog(a: number, b: number, maxQ = 6): { p: number; q: number } | null {
  if (a === 1) return { p: 0, q: 1 };
  for (let q = 1; q <= maxQ; q++) {
    // need a^q = b^p for an integer p
    const target = BigInt(a) ** BigInt(q);
    let p = 0;
    let acc = 1n;
    while (acc < target) {
      acc *= BigInt(b);
      p++;
    }
    if (acc === target) {
      const g = Number(gcdNum(p, q));
      return { p: p / g, q: q / g };
    }
  }
  return null;
}
const gcdNum = (x: number, y: number): number => (y === 0 ? x : gcdNum(y, x % y));

/* ------------------------------------------------------------------ */
/* Final answer                                                        */
/* ------------------------------------------------------------------ */

export interface BigO {
  case: Case;
  /** LaTeX of the bound without the O(), e.g. "n \\log n" */
  latex: string;
  /** Plain text, e.g. "O(n log n)" */
  text: string;
  /** Numeric exponent of n in the bound (for plotting / comparison) */
  exponent: number;
  /** true when the bound carries an extra log n factor */
  log: boolean;
  /** How the exponent was obtained */
  method: 'root' | 'equal' | 'master-exact' | 'master-log' | 'numeric';
  /** For 'master-log': the irrational exponent written as log_b a */
  logBase?: { a: number; b: number };
}

/** n^e as LaTeX, with the conventional simplifications. */
export function powerLatex(e: number | string): string {
  if (e === 0 || e === '0') return '1';
  if (e === 1 || e === '1') return 'n';
  return `n^{${e}}`;
}

export function bigO(rec: Recurrence): BigO {
  const c = classify(rec);
  const d = rec.d;
  if (c === 'root') {
    const latex = powerLatex(d);
    return { case: c, latex, text: `O(${plain(latex)})`, exponent: d, log: false, method: 'root' };
  }
  if (c === 'equal') {
    const latex = d === 0 ? '\\log n' : `${powerLatex(d)} \\log n`;
    return { case: c, latex, text: `O(${plain(latex)})`, exponent: d, log: true, method: 'equal' };
  }
  if (rec.terms.length === 1) {
    const { a, b } = rec.terms[0];
    const exact = exactLog(a, b);
    const e = Math.log(a) / Math.log(b);
    if (exact) {
      const eStr = exact.q === 1 ? String(exact.p) : `${exact.p}/${exact.q}`;
      const latex = exact.q === 1 ? powerLatex(exact.p) : `n^{${exact.p}/${exact.q}}`;
      return { case: c, latex, text: exact.q === 1 ? `O(${plain(latex)})` : `O(n^${eStr})`, exponent: e, log: false, method: 'master-exact' };
    }
    const latex = `n^{${e.toFixed(3)}}`;
    return { case: c, latex, text: `O(n^${e.toFixed(3)})`, exponent: e, log: false, method: 'master-log', logBase: { a, b } };
  }
  const p = solveExponent(rec.terms);
  const latex = `n^{${p.toFixed(3)}}`;
  return { case: c, latex, text: `O(n^${p.toFixed(3)})`, exponent: p, log: false, method: 'numeric' };
}

function plain(latex: string): string {
  return latex.replace(/\\log/g, 'log').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Concrete n                                                          */
/* ------------------------------------------------------------------ */

export interface ConcreteTuple {
  den: bigint;
  /** subproblem size n / den (floors dropped, so may be fractional) */
  size: number;
  count: number;
  /** count split by the branch of the last step (empty for the root) */
  countByBranch: number[];
  /** base case: size <= 1, does 1 unit of work and has no children */
  leaf: boolean;
  /** work of one node: size^d, or 1 for a base case */
  work: number;
}

export interface ConcreteLevel {
  level: number;
  tuples: ConcreteTuple[];
  total: number;
  /** total split by the branch of the last step (empty for the root) */
  totalByBranch: number[];
  nodes: number;
}

/**
 * Expand the tree for a concrete n. A node of size s > 1 does s^d work and
 * recurses; a node of size s <= 1 is a base case doing 1 unit of work.
 */
export function concreteLevels(rec: Recurrence, n: number, maxLevels = 64): ConcreteLevel[] {
  const m = rec.terms.length;
  const levels: ConcreteLevel[] = [];
  let frontier = new Map<bigint, number[]>([[1n, []]]);
  for (let level = 0; frontier.size > 0 && level < maxLevels; level++) {
    const tuples: ConcreteTuple[] = [];
    const next = new Map<bigint, number[]>();
    for (const [den, byBranch] of frontier) {
      const count = level === 0 ? 1 : byBranch.reduce((s, c) => s + c, 0);
      const size = n / Number(den);
      const leaf = size <= 1;
      const work = leaf ? 1 : Math.pow(size, rec.d);
      tuples.push({ den, size, count, countByBranch: byBranch, leaf, work });
      if (!leaf)
        rec.terms.forEach((t, i) => {
          const cd = den * BigInt(t.b);
          const arr = next.get(cd) ?? new Array(m).fill(0);
          arr[i] += count * t.a;
          next.set(cd, arr);
        });
    }
    const totalByBranch = level === 0 ? [] : [...Array(m).keys()].map((i) => tuples.reduce((s, t) => s + (t.countByBranch[i] ?? 0) * t.work, 0));
    levels.push({
      level,
      tuples,
      total: tuples.reduce((s, t) => s + t.count * t.work, 0),
      totalByBranch,
      nodes: tuples.reduce((s, t) => s + t.count, 0),
    });
    frontier = next;
  }
  return levels;
}

/** The function inside the O(): n^e, times log2 n when the bound has a log. */
export function boundValue(o: BigO, n: number): number {
  return Math.pow(n, o.exponent) * (o.log ? Math.log2(n) : 1);
}

export function concreteSum(rec: Recurrence, n: number): number {
  return concreteLevels(rec, n).reduce((s, l) => s + l.total, 0);
}

/* ------------------------------------------------------------------ */
/* Convenience: everything the UI needs in one pass                    */
/* ------------------------------------------------------------------ */

export interface Analysis {
  rec: Recurrence;
  r: Rational;
  rNumber: number;
  termRatios: Rational[];
  case: Case;
  bigO: BigO;
  p0: number;
  minB: number;
  maxB: number;
  branching: bigint;
}

export function analyze(rec: Recurrence): Analysis {
  const r = ratio(rec);
  return {
    rec,
    r,
    rNumber: toNumber(r),
    termRatios: rec.terms.map((t) => termRatio(t, rec.d)),
    case: classify(rec),
    bigO: bigO(rec),
    p0: criticalExponent(rec),
    minB: minB(rec),
    maxB: maxB(rec),
    branching: rec.terms.reduce((s, t) => s + BigInt(t.a), 0n),
  };
}
