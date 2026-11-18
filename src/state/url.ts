/** Share a recurrence in the URL hash: #2T4+1T2+n1  (aTb terms, then n<d>) */
import { LIMITS, normalize, validateField, type Recurrence } from '../math/recurrence';

export function encodeHash(rec: Recurrence): string {
  return '#' + rec.terms.map((t) => `${t.a}T${t.b}`).join('+') + `+n${rec.d}`;
}

export function decodeHash(hash: string): Recurrence | null {
  const m = /^#((?:\d+T\d+\+){1,3})n(\d+)$/.exec(hash);
  if (!m) return null;
  const terms = m[1]
    .split('+')
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split('T');
      return { a: Number(a), b: Number(b) };
    });
  const d = Number(m[2]);
  const ok =
    terms.length <= LIMITS.terms.max &&
    validateField('d', String(d)).ok &&
    terms.every((t) => validateField('a', String(t.a)).ok && validateField('b', String(t.b)).ok);
  return ok ? normalize({ terms, d }).rec : null;
}
