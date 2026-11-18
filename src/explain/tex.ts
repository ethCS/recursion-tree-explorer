/** Small LaTeX builders shared by the derivation and explanation text. */
import { toLatex, type Rational } from '../math/rational';
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

/** r's value, plus a decimal when it is a fraction */
export function rValueTex(r: Rational): string {
  return r.den === 1n ? toLatex(r) : `${toLatex(r)} \\approx ${(Number(r.num) / Number(r.den)).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`;
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
