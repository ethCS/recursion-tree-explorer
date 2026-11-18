/**
 * Formatting helpers that turn exact values into LaTeX or plain text.
 * Pure functions, no DOM.
 */
import { type Rational } from './rational';

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·' };
export const superscript = (s: string | number) => String(s).split('').map((c) => SUP[c] ?? c).join('');

/** Abbreviate a big integer for tight spaces: 1,024 · 1.2e9 */
export function shortInt(x: bigint | number): string {
  const n = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (n < 100000n) return Number(n).toLocaleString('en-US');
  return Number(n).toExponential(2).replace('e+', 'e');
}

/** A whole number written out with separators up to 10^15, so nobody has to decode 5.31e5 */
export function fullInt(x: bigint | number): string {
  const n = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (n < 1000000000000000n) return n.toLocaleString('en-US');
  return Number(n).toExponential(2).replace('e+', 'e');
}

/** Format a real number compactly: 1,024 · 341.33 · 0.41 · 2.1e9 */
export function shortNum(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  const ax = Math.abs(x);
  if (ax >= 1e7) return x.toExponential(2).replace('e+', 'e');
  if (Number.isInteger(x)) return x.toLocaleString('en-US');
  if (ax >= 100) return x.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

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
  return `${nPowText(d)}/${den ** BigInt(d)}`;
}
export function workLatex(den: bigint, d: number): string {
  if (d === 0) return '1';
  if (den === 1n) return nPowLatex(d);
  return `\\tfrac{${nPowLatex(d)}}{${den ** BigInt(d)}}`;
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
  if (d === 0) return c.den === 1n ? `${c.num}` : `\\tfrac{${c.num}}{${c.den}}`;
  const lead = c.num === 1n ? np : `${c.num}${np}`;
  return c.den === 1n ? lead : `\\tfrac{${lead}}{${c.den}}`;
}

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
