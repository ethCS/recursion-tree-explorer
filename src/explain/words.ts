/**
 * Plain-language building blocks for explanations. Everything here takes the
 * live recurrence and produces words or LaTeX with its actual numbers in it,
 * so explanations read as a worked example, never as a template.
 */
import { analyze, levelTotalCoef, levelTuples, normalize, LIMITS, tupleTotalCoef, type Analysis, type Recurrence } from '../math/recurrence';
import { div as qdiv, sub as qsub, ONE, type Rational } from '../math/rational';
import { coefNEq, coefNLatex, isExact, nPowLatex, qTex, shortInt, shortIntTex, sizeLatex, workLatex } from '../math/format';
import { br } from './tex';

const ORD = ['', '', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth'];

/** "half the input", "a third of the input" */
export const pieceOfInput = (b: number) => (b === 2 ? 'half the input' : `a ${ORD[b]} of the input`);
/** "halves", "cuts to a third" */
export const shrinkVerb = (b: number) => (b === 2 ? 'halves the size' : `cuts the size to a ${ORD[b]}`);

export const plural = (k: number | bigint, one: string, many = one + 's') => (k === 1 || k === 1n ? one : many);
export const calls = (k: number | bigint) => `${shortInt(k)} ${plural(k, 'call')}`;
/** verb agreement: "1 call does", "2 calls do" */
export const does = (k: number | bigint) => plural(k, 'does', 'do');

/** a call's own work as a phrase: "1 unit of work", "$n^{2}$ work" */
export const ownWork = (d: number) => (d === 0 ? '1 unit of work' : `$${nPowLatex(d)}$ work`);
/** what the non-recursive work typically is, for a given d */
export const workExample = (d: number) => (d === 0 ? 'a fixed amount, like one comparison' : 'such as splitting the input and combining the results');

/** linear / quadratic / ... */
export const workKind = (d: number) => ['constant', 'linear', 'quadratic', 'cubic', 'quartic'][d] ?? `degree-${d}`;

/** "does $m$ work", "does $m^2$ work", "does 1 unit of work" for a call on size m */
export function workOfSizeM(d: number) {
  return d === 0 ? 'does 1 unit of work, whatever its size' : d === 1 ? 'does $m$ work (as much as its size)' : `does $m^{${d}}$ work (its size ${d === 2 ? 'squared' : d === 3 ? 'cubed' : `to the power ${d}`})`;
}

/** f(size) worked out: "f(n/4) = n/4", "f(n/4) = (n/4)^2 = n^2/16", "f(n/4) = 1" */
export function fAt(den: bigint, d: number): string {
  const s = sizeLatex(den);
  if (d === 0) return `f(${s}) = 1`;
  if (d === 1 || den === 1n) return `f(${s}) = ${workLatex(den, d)}`;
  return `f(${s}) = (${s})^{${d}} = ${workLatex(den, d)}`;
}

/** n^d with nothing for n^0 when multiplied: "n", "n^{2}", "" */
export const nd = (d: number) => (d === 0 ? '' : nPowLatex(d));

/** Level total as LaTeX: "\tfrac{3}{2}n" */
export const levelTotalTex = (rec: Recurrence, level: number) => coefNLatex(levelTotalCoef(rec, level), rec.d);
/** "= \tfrac{3n}{2}", or "\approx 0.000905\,n^{4}" when the exact total is too long to read */
export const levelTotalEq = (rec: Recurrence, level: number) => coefNEq(levelTotalCoef(rec, level), rec.d);

/** "\frac{49}{16} \div \frac{7}{4} = \frac{7}{4}": level 2's total over level 1's, which is r */
export function levelRatioTex(rec: Recurrence, r: Rational): string {
  const [c1, c2] = [levelTotalCoef(rec, 1), levelTotalCoef(rec, 2)];
  const rel = [c1, c2, r].every(isExact) ? '=' : '\\approx';
  return `${qTex(c2)} \\div ${qTex(c1)} ${rel} ${qTex(r)}`;
}

/** More sizes than this on one level are summarised instead of listed. */
const MAX_LISTED = 4;

/**
 * A level's total, worked out from its tuples:
 * "4·n/16 + 4·n/8 + 1·n/4 = n/4 + n/2 + n/4 = n"
 * Level 1 parts are coloured by branch. Long levels list the first few sizes and "⋯".
 */
export function levelSumTex(rec: Recurrence, level: number): string {
  const d = rec.d;
  const tuples = levelTuples(rec, level);
  const colour = (i: number, tex: string) => (level === 1 ? br(i, tex) : tex);
  const total = coefNLatex(levelTotalCoef(rec, level), d);
  const eq = levelTotalEq(rec, level);
  if (tuples.length > MAX_LISTED) {
    const first = tuples.slice(0, 2).map((t) => `${shortIntTex(t.count)}\\cdot ${workLatex(t.den, d)}`);
    return `${first.join(' + ')} + \\cdots ${eq}`;
  }
  const products = tuples.map((t) => `${shortIntTex(t.count)}\\cdot ${workLatex(t.den, d)}`);
  const parts = tuples.map((t) => coefNLatex(tupleTotalCoef(t, d), d));
  // compare uncoloured, so "1·1 = 1 = 1" never happens
  const steps: string[][] = [products];
  if (parts.join('+') !== products.join('+') && (tuples.length > 1 || parts[0] !== total)) steps.push(parts);
  const out = steps.map((xs) => xs.map((x, i) => colour(i, x)).join(' + ')).join(' = ');
  return steps[steps.length - 1].join(' + ') === total ? out : `${out} ${eq}`;
}

/** An example n that is a power of the smallest b, so the deepest path ends exactly: 4096 = 2^12 */
export function exampleN(a: Analysis): { n: number; k: number; b: number } {
  const b = a.minB;
  let k = 1;
  while (b ** (k + 1) <= 4096) k++;
  return { n: b ** k, k, b };
}

/** log_b(n) for the example n, as text: "6" or "≈ 4.3" */
export function logOfExample(n: number, b: number): string {
  const v = Math.log(n) / Math.log(b);
  return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : `≈ ${v.toFixed(1)}`;
}

/**
 * Ordered paths of `level` steps grouped by the size they reach, for spelling
 * out where a tuple's count comes from. Only for small levels (≤ 3), where
 * listing every path is readable.
 */
export function pathsTo(rec: Recurrence, level: number): Map<bigint, { seq: number[]; count: bigint }[]> {
  const out = new Map<bigint, { seq: number[]; count: bigint }[]>();
  const walk = (seq: number[], den: bigint, count: bigint) => {
    if (seq.length === level) {
      const arr = out.get(den) ?? [];
      arr.push({ seq, count });
      out.set(den, arr);
      return;
    }
    rec.terms.forEach((t, i) => walk([...seq, i], den * BigInt(t.b), count * BigInt(t.a)));
  };
  walk([], 1n, 1n);
  return out;
}

/** "÷4 then ÷2" coloured by branch */
export const seqTex = (rec: Recurrence, seq: number[]) => seq.map((i) => br(i, `\\div ${rec.terms[i].b}`)).join('\\to');
/** "2·1" coloured by branch */
export const seqCountTex = (rec: Recurrence, seq: number[]) => seq.map((i) => br(i, String(rec.terms[i].a))).join('\\cdot ');

/** How a tuple's count arises, in words: "÷4 → ÷2: 2·1 = 2, ÷2 → ÷4: 1·2 = 2, so 4 calls" */
export function tupleCountWords(rec: Recurrence, level: number, den: bigint): string | null {
  if (level === 0 || level > 3) return null;
  const paths = pathsTo(rec, level).get(den);
  if (!paths) return null;
  const total = paths.reduce((s, p) => s + p.count, 0n);
  const one = (p: { seq: number[]; count: bigint }) => `$${seqTex(rec, p.seq)}$ gives $${seqCountTex(rec, p.seq)} = ${shortIntTex(p.count)}$`;
  if (paths.length === 1) return `There is one way to get there, ${one(paths[0]).replace(' gives ', ', which gives ')} ${plural(total, 'call')}.`;
  return `There are ${paths.length} ways to get there: ${paths.map(one).join('; ')}. Together that is $${paths.map((p) => shortIntTex(p.count)).join(' + ')} = ${shortIntTex(total)}$ calls.`;
}

/** Analysis of the recurrence after a change, or null if the change is out of range. */
export function whatIf(rec: Recurrence, change: (r: Recurrence) => void): Analysis | null {
  const copy: Recurrence = { terms: rec.terms.map((t) => ({ ...t })), d: rec.d };
  change(copy);
  const ok =
    copy.d >= LIMITS.d.min &&
    copy.d <= LIMITS.d.max &&
    copy.terms.every((t) => t.a >= LIMITS.a.min && t.a <= LIMITS.a.max && t.b >= LIMITS.b.min && t.b <= LIMITS.b.max);
  return ok ? analyze(normalize(copy).rec) : null;
}

export const caseShort = (a: Analysis) => (a.case === 'root' ? 'the root dominates' : a.case === 'equal' ? 'all levels tie' : 'the leaves dominate');

/** "r would be 5/4 (> 1), so the leaves dominate: O(n^{1.161})" */
export function whatIfSentence(label: string, w: Analysis | null): string {
  if (!w) return '';
  const rel = w.case === 'root' ? '< 1' : w.case === 'equal' ? '= 1' : '> 1';
  return `${label}, $r$ would be $${qTex(w.r)}$ ($${rel}$), so ${caseShort(w)}: $O(${w.bigO.latex})$.`;
}

/** 1/(1 - r) for r < 1: the shrinking series' bound as a multiple of its first term */
export const rootBound = (r: Rational) => qdiv(ONE, qsub(ONE, r));
/** r/(r - 1) for r > 1: the growing series' bound as a multiple of its last term */
export const leafBound = (r: Rational) => qdiv(r, qsub(r, ONE));

/** "2 calls on n/4 (a quarter of the input) and 1 call on n/2 (half the input)" */
export function callsList(rec: Recurrence, opts: { colour?: boolean } = {}) {
  const items = rec.terms.map((t, i) => {
    const s = `${calls(t.a)} on $${opts.colour ? br(i, `n/${t.b}`) : `n/${t.b}`}$ (${pieceOfInput(t.b)})`;
    return s;
  });
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
