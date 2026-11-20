import { toLatex, toText, type Rational } from '../math/rational';

/** Short enough to read at a glance: 3/2, 7/16. Longer fractions become a rounded decimal. */
const isShort = (r: Rational) => String(r.num).length + String(r.den).length <= 6;

const approx = (v: number) => (v >= 1 ? String(Number(v.toFixed(2))) : String(Number(v.toPrecision(2))));

/** r for tight spots (ratio chips, sentences), as LaTeX: "\tfrac{3}{2}" or "\approx 0.0009" */
export const rShortLatex = (r: Rational) => (isShort(r) ? toLatex(r) : `\\approx ${approx(Number(r.num) / Number(r.den))}`);

/** the same as plain text for screen readers: "3/2" or "about 0.0009" */
export const rShortText = (r: Rational) => (isShort(r) ? toText(r) : `about ${approx(Number(r.num) / Number(r.den))}`);
