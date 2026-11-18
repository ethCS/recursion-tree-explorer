/**
 * Exact rational arithmetic on BigInt. Values are always kept in lowest terms
 * with a positive denominator, so equality is structural.
 */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

const abs = (x: bigint) => (x < 0n ? -x : x);

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function rat(num: bigint | number, den: bigint | number = 1n): Rational {
  let n = BigInt(num);
  let d = BigInt(den);
  if (d === 0n) throw new RangeError('zero denominator');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { num: n / g, den: d / g };
}

export const ZERO = rat(0);
export const ONE = rat(1);

export const add = (x: Rational, y: Rational) => rat(x.num * y.den + y.num * x.den, x.den * y.den);
export const sub = (x: Rational, y: Rational) => rat(x.num * y.den - y.num * x.den, x.den * y.den);
export const mul = (x: Rational, y: Rational) => rat(x.num * y.num, x.den * y.den);
export const div = (x: Rational, y: Rational) => rat(x.num * y.den, x.den * y.num);

export function pow(x: Rational, k: number): Rational {
  if (!Number.isInteger(k) || k < 0) throw new RangeError('pow needs a non-negative integer');
  return { num: x.num ** BigInt(k), den: x.den ** BigInt(k) };
}

/** -1, 0 or 1 */
export function cmp(x: Rational, y: Rational): -1 | 0 | 1 {
  const l = x.num * y.den;
  const r = y.num * x.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

export const eq = (x: Rational, y: Rational) => x.num === y.num && x.den === y.den;

export function toNumber(x: Rational): number {
  return Number(x.num) / Number(x.den);
}

export const isInteger = (x: Rational) => x.den === 1n;

/** "3/2", "1", "-1/4" */
export function toText(x: Rational): string {
  return x.den === 1n ? x.num.toString() : `${x.num}/${x.den}`;
}

/** LaTeX for a rational: \frac{3}{2} or 1 */
export function toLatex(x: Rational): string {
  if (x.den === 1n) return x.num.toString();
  const sign = x.num < 0n ? '-' : '';
  return `${sign}\\frac{${abs(x.num)}}{${x.den}}`;
}
