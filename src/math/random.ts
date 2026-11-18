/**
 * Presets and a case-balanced random generator.
 *
 * Naive sampling of (a, b, d) lands in r > 1 most of the time, so instead we
 * enumerate a pool of "nice" recurrences once, bucket them by case, then pick
 * a case uniformly and a recurrence from that bucket. Within a case, single-
 * and multi-branch recurrences are picked about equally often.
 */
import { classify, type Case, type Recurrence } from './recurrence';

export interface Preset {
  id: string;
  name: string;
  note: string;
  rec: Recurrence;
}

export const PRESETS: Preset[] = [
  { id: 'merge', name: 'Merge sort', note: 'split in half, merge in linear time', rec: { terms: [{ a: 2, b: 2 }], d: 1 } },
  { id: 'binary', name: 'Binary search', note: 'one half, constant work', rec: { terms: [{ a: 1, b: 2 }], d: 0 } },
  { id: 'karatsuba', name: 'Karatsuba', note: 'three half-size multiplications', rec: { terms: [{ a: 3, b: 2 }], d: 1 } },
  { id: 'course', name: '2T(n/4) + T(n/2) + n', note: 'uneven branches, equal levels', rec: { terms: [{ a: 2, b: 4 }, { a: 1, b: 2 }], d: 1 } },
];

type Bucket = { single: Recurrence[]; multi: Recurrence[] };
let pool: Record<Case, Bucket> | null = null;

function buildPool(): Record<Case, Bucket> {
  const out: Record<Case, Bucket> = {
    root: { single: [], multi: [] },
    equal: { single: [], multi: [] },
    leaves: { single: [], multi: [] },
  };
  const push = (rec: Recurrence) => out[classify(rec)][rec.terms.length === 1 ? 'single' : 'multi'].push(rec);
  // single term: a 1..9, b 2..6, d 0..3
  for (let d = 0; d <= 3; d++)
    for (let b = 2; b <= 6; b++)
      for (let a = 1; a <= 9; a++) if (a < 16) push({ terms: [{ a, b }], d });
  // two terms with distinct b (b1 > b2 so the bigger split is listed first, like the course example)
  for (let d = 0; d <= 2; d++)
    for (let b1 = 3; b1 <= 6; b1++)
      for (let b2 = 2; b2 < b1; b2++)
        for (let a1 = 1; a1 <= 4; a1++) for (let a2 = 1; a2 <= 4; a2++) push({ terms: [{ a: a1, b: b1 }, { a: a2, b: b2 }], d });
  // three terms, small coefficients
  for (let d = 0; d <= 2; d++)
    for (let b1 = 4; b1 <= 6; b1++)
      for (let b2 = 3; b2 < b1; b2++)
        for (let b3 = 2; b3 < b2; b3++)
          for (let a1 = 1; a1 <= 3; a1++)
            for (let a2 = 1; a2 <= 2; a2++)
              for (let a3 = 1; a3 <= 2; a3++) push({ terms: [{ a: a1, b: b1 }, { a: a2, b: b2 }, { a: a3, b: b3 }], d });
  return out;
}

export function poolSizes() {
  pool ??= buildPool();
  const p = pool;
  return Object.fromEntries((Object.keys(p) as Case[]).map((c) => [c, { single: p[c].single.length, multi: p[c].multi.length }]));
}

const sameRec = (x: Recurrence, y: Recurrence) =>
  x.d === y.d && x.terms.length === y.terms.length && x.terms.every((t, i) => t.a === y.terms[i].a && t.b === y.terms[i].b);

/** Random recurrence; `rand` is injectable for tests. Avoids returning `avoid`. */
export function randomRecurrence(rand: () => number = Math.random, avoid?: Recurrence): Recurrence {
  pool ??= buildPool();
  const cases: Case[] = ['root', 'equal', 'leaves'];
  for (let attempt = 0; attempt < 20; attempt++) {
    const bucket = pool[cases[Math.floor(rand() * 3)]];
    const kinds = (['single', 'multi'] as const).filter((k) => bucket[k].length > 0);
    const list = bucket[kinds[Math.floor(rand() * kinds.length)]];
    const rec = list[Math.floor(rand() * list.length)];
    if (!avoid || !sameRec(rec, avoid)) return structuredClone(rec);
  }
  return structuredClone(PRESETS[0].rec);
}
