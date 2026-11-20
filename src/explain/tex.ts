/** Small LaTeX builders shared by the derivation and explanation text. */
import { cmp, ONE, type Rational } from '../math/rational';
import { approxTex, eqTex, isShort, qTex } from '../math/format';
import { exactLog, type Analysis, type Term } from '../math/recurrence';

/** Colour a LaTeX fragment with a branch colour (CSS class b0/b1/b2). */
export const br = (i: number, tex: string) => `\\htmlClass{b${i}}{${tex}}`;

/** Subscript for term i, only when there are several terms. */
export const sub = (a: Analysis, i: number) => (a.rec.terms.length > 1 ? `_${i + 1}` : '');

export const aSym = (a: Analysis, i: number) => br(i, `a${sub(a, i)}`);
export const bSym = (a: Analysis, i: number) => br(i, `b${sub(a, i)}`);

/** "\tfrac{2}{4^1}" style term of r for term i, coloured */
export function rTermTex(t: Term, d: number, i: number): string {
  const den = d === 0 ? '' : d === 1 ? `${t.b}` : `${t.b}^{${d}}`;
  return br(i, d === 0 ? `${t.a}` : `\\tfrac{${t.a}}{${den}}`);
}

/** "2/4 + 1/2" */
export const rSumTex = (a: Analysis) => a.rec.terms.map((t, i) => rTermTex(t, a.rec.d, i)).join(' + ');

/**
 * r's value, plus a decimal when it is a fraction: "\frac{7}{4} \approx 1.75".
 * A fraction too long to read (4290553/4741632000) becomes just "\approx 0.000905".
 */
export function rValueTex(r: Rational): string {
  if (r.den === 1n) return qTex(r);
  const dec = approxTex(Number(r.num) / Number(r.den));
  return isShort(r) ? `${qTex(r)} \\approx ${dec}` : `\\approx ${dec}`;
}
/** rValueTex with its relation: "= \frac{7}{4} \approx 1.75" or "\approx 0.000905" */
export const rValueEq = (r: Rational) => (r.den === 1n || isShort(r) ? `= ${rValueTex(r)}` : rValueTex(r));

/**
 * "r = \frac{2}{4} + \frac{1}{2} = 1": the sum of the shares and its value,
 * without repeating a single share that already is the value (r = 16, not r = 16 = 16).
 */
export function rFullTex(a: Analysis): string {
  const t = a.rec.terms[0];
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  const sumIsValue = a.rec.terms.length === 1 && (a.rec.d === 0 || (a.rec.d === 1 && gcd(t.a, t.b) === 1));
  if (!sumIsValue) return `r = ${rSumTex(a)} ${rValueEq(a.r)}`;
  return a.r.den === 1n ? `r = ${rSumTex(a)}` : `r = ${rSumTex(a)} \\approx ${approxTex(Number(a.r.num) / Number(a.r.den))}`;
}

/** r as LaTeX: exact when short, otherwise its decimal */
export const rTex = (a: Analysis) => qTex(a.r);
/** "r = \frac{7}{4}" or "r \approx 0.000905" */
export const rEqTex = (a: Analysis) => `r ${eqTex(a.r)}`;

/**
 * x compared with a reference, in words: "the same as the root's work",
 * "$\frac{1}{2}$ of the root's work", "$\frac{7}{4}$ times the root's work"
 */
export function timesWords(x: Rational, what: string): string {
  const c = cmp(x, ONE);
  return c === 0 ? `the same as ${what}` : c < 0 ? `$${qTex(x)}$ of ${what}` : `$${qTex(x)}$ times ${what}`;
}

export const caseWord = (a: Analysis) => (a.case === 'root' ? 'shrink' : a.case === 'equal' ? 'stay the same' : 'grow');
export const relTex = (a: Analysis) => (a.case === 'root' ? '<' : a.case === 'equal' ? '=' : '>');
export const dominatesWord = (a: Analysis) =>
  a.case === 'root' ? 'the root dominates' : a.case === 'equal' ? 'every level contributes equally' : 'the leaves dominate';

export const logTex = (b: number) => `\\log_{${b}} n`;

/** O(...) */
export const bigOTex = (a: Analysis) => `O(${a.bigO.latex})`;

/**
 * The leaf-count exponent p0 as text: exact when possible (r = 1 gives p0 = d,
 * a = b^k gives an integer), otherwise to three decimals.
 */
export function p0Parts(a: Analysis): { rel: '=' | '\\approx'; val: string; exact: boolean } {
  if (a.case === 'equal') return { rel: '=', val: String(a.rec.d), exact: true };
  if (a.rec.terms.length === 1) {
    const ex = exactLog(a.rec.terms[0].a, a.rec.terms[0].b);
    if (ex) return { rel: '=', val: ex.q === 1 ? String(ex.p) : `${ex.p}/${ex.q}`, exact: true };
  }
  return { rel: '\\approx', val: a.p0.toFixed(3), exact: false };
}
