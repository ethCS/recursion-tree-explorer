/**
 * Formatting helpers that turn exact values into LaTeX or plain text.
 * Pure functions, no DOM.
 */
import { type Rational } from './rational';

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·' };
export const superscript = (s: string | number) => String(s).split('').map((c) => SUP[c] ?? c).join('');

/**
 * Number style, used everywhere a reader sees a number:
 *  - whole numbers get thousands separators: 4,096
 *  - very large or very small values use powers of ten: 2.81 × 10¹⁴, never 2.81e14
 * The *Tex variants return the same thing as LaTeX ({,} keeps KaTeX from
 * spacing the comma like punctuation; \times 10^{k} for powers of ten).
 */

/**
 * 3 significant digits, trailing zeros dropped: "2.81", "3", "0.000905".
 * A non-integer never rounds to a whole number: 1.0009 stays "1.001", not "1".
 */
const sig = (x: number, digits = 3) => {
  let p = digits;
  while (p < 8 && !Number.isInteger(x) && Number.isInteger(Number(x.toPrecision(p)))) p++;
  return Number(x.toPrecision(p)).toLocaleString('en-US', { maximumSignificantDigits: p });
};

/** mantissa and exponent for powers-of-ten notation */
function sci(x: number): { m: string; e: number } {
  const [m, e] = x.toExponential(2).split('e');
  return { m: String(Number(m)), e: Number(e) };
}
const sciText = (x: number) => {
  const { m, e } = sci(x);
  return `${m} × 10${e < 0 ? '⁻' : ''}${superscript(Math.abs(e))}`;
};
const sciTex = (x: number) => {
  const { m, e } = sci(x);
  return `${m} \\times 10^{${e}}`;
};
const UNSUP = (s: string) => s.split('').map((c) => (c === '⁻' ? '-' : String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)))).join('');
/** Turn a plain-text number from the helpers below into LaTeX. */
export const numTex = (s: string) => s.replace(/,/g, '{,}').replace(/ × 10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (_m, sup: string) => ` \\times 10^{${UNSUP(sup)}}`);

/** A whole number for tight spaces: 4,096 · 531,441 · 1.2 × 10⁹ */
export function shortInt(x: bigint | number): string {
  const n = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (n < 10000000n) return n.toLocaleString('en-US');
  return sciText(Number(n));
}
export const shortIntTex = (x: bigint | number) => numTex(shortInt(x));

/** A whole number written out with separators up to 10^15, so nobody has to decode 5.31 × 10⁵ */
export function fullInt(x: bigint | number): string {
  const n = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (n < 1000000000000000n) return n.toLocaleString('en-US');
  return sciText(Number(n));
}
export const fullIntTex = (x: bigint | number) => numTex(fullInt(x));

/** A real number, compactly: 1,024 · 341.3 · 0.41 · 2.1 × 10⁹ */
export function shortNum(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  const ax = Math.abs(x);
  if (ax >= 1e7) return sciText(x);
  if (Number.isInteger(x)) return x.toLocaleString('en-US');
  if (ax >= 100) return x.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (ax !== 0 && ax < 0.01) return sig(x);
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export const shortNumTex = (x: number) => numTex(shortNum(x));

/** An approximate value to 3 significant digits, as LaTeX: 1.75 · 0.000905 · 7.41 \times 10^{-10} */
export function approxTex(x: number): string {
  const ax = Math.abs(x);
  if (ax !== 0 && (ax < 1e-4 || ax >= 1e7)) return sciTex(x);
  return numTex(sig(x));
}

/** Integers and fractions small enough to read at a glance (at most 4 digits each). */
export const isShort = (x: Rational) => (x.num < 0n ? -x.num : x.num) < 10000n && x.den < 10000n;

/** A rational as LaTeX: exact when short (\frac{7}{4}, 4{,}096), otherwise its decimal (0.000905). */
export function qTex(x: Rational): string {
  if (x.den === 1n) return shortIntTex(x.num);
  return isShort(x) ? `\\frac{${shortIntTex(x.num)}}{${shortIntTex(x.den)}}` : approxTex(Number(x.num) / Number(x.den));
}
/** Does qTex show this value exactly? */
export const isExact = (x: Rational) => x.den === 1n || isShort(x);
/** "= \frac{7}{4}" or "\approx 0.000905": the right relation for qTex */
export const eqTex = (x: Rational) => (isExact(x) ? `= ${qTex(x)}` : `\\approx ${qTex(x)}`);
/** x^k as LaTeX, with brackets only around fractions: 16^{3}, \left(\frac{7}{4}\right)^{3} */
export const qPowTex = (x: Rational, k: number | string) => (x.den === 1n ? `${qTex(x)}^{${k}}` : `\\left(${qTex(x)}\\right)^{${k}}`);

/** subproblem size n/den: "n", "n/16" */
export const sizeText = (den: bigint) => (den === 1n ? 'n' : `n/${den}`);
export const sizeLatex = (den: bigint) => (den === 1n ? 'n' : `\\tfrac{n}{${den}}`);

/** n^d as plain text */
export const nPowText = (d: number) => (d === 0 ? '1' : d === 1 ? 'n' : `n${superscript(d)}`);
export const nPowLatex = (d: number) => (d === 0 ? '1' : d === 1 ? 'n' : `n^{${d}}`);

/** work of one node of size n/den: (n/den)^d */
export function workText(den: bigint, d: number): string {
  if (d === 0) return '1';
  if (den === 1n) return nPowText(d);
  if (den ** BigInt(d) >= 100000n) return `(n/${den})${superscript(d)}`;
  return `${nPowText(d)}/${(den ** BigInt(d)).toLocaleString("en-US")}`;
}
export function workLatex(den: bigint, d: number): string {
  if (d === 0) return '1';
  if (den === 1n) return nPowLatex(d);
  if (den ** BigInt(d) >= 100000n) return `\\left(\\tfrac{n}{${den}}\\right)^{${d}}`;
  return `\\tfrac{${nPowLatex(d)}}{${shortIntTex(den ** BigInt(d))}}`;
}

/** A rational coefficient times n^d: "n", "3n/2", "9n²/4", "1/2" */
export function coefNText(c: Rational, d: number): string {
  const np = nPowText(d);
  if (d === 0) return c.den === 1n ? `${c.num}` : `${c.num}/${c.den}`;
  const lead = c.num === 1n ? np : `${c.num}${np}`;
  return c.den === 1n ? lead : `${lead}/${c.den}`;
}
export function coefNLatex(c: Rational, d: number): string {
  const np = nPowLatex(d);
  if (!isShort(c) && c.den !== 1n) return d === 0 ? qTex(c) : `${qTex(c)}\\,${np}`;
  const num = shortIntTex(c.num);
  if (d === 0) return c.den === 1n ? num : `\\tfrac{${num}}{${shortIntTex(c.den)}}`;
  const lead = c.num === 1n ? np : `${num}${np}`;
  return c.den === 1n ? lead : `\\tfrac{${lead}}{${shortIntTex(c.den)}}`;
}
/** "= <coefNLatex>" or "\approx <decimal> n^d" when the exact coefficient is too long to read */
export const coefNEq = (c: Rational, d: number) => (isExact(c) ? '= ' : '\\approx ') + coefNLatex(c, d);

/** "a/b^d" for one term of r, as LaTeX, with the unsimplified form when helpful */
export function termRatioLatex(a: number, b: number, d: number): string {
  if (d === 0) return `${a}`;
  if (d === 1) return `\\tfrac{${a}}{${b}}`;
  return `\\tfrac{${a}}{${b}^{${d}}}`;
}

/** LaTeX for the recurrence itself */
export function recurrenceLatex(terms: { a: number; b: number }[], d: number): string {
  const parts = terms.map((t) => `${t.a === 1 ? '' : t.a}T\\!\\left(\\tfrac{n}{${t.b}}\\right)`);
  return `T(n) = ${parts.join(' + ')} + ${nPowLatex(d)}`;
}

export function recurrenceText(terms: { a: number; b: number }[], d: number): string {
  const parts = terms.map((t) => `${t.a === 1 ? '' : t.a}T(n/${t.b})`);
  return `T(n) = ${parts.join(' + ')} + ${nPowText(d)}`;
}
