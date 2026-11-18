import { describe, expect, it } from 'vitest';
import { eq, rat, toText } from './rational';
import {
  analyze,
  bigO,
  classify,
  compositions,
  concreteLevels,
  exactLog,
  levelTotalCoef,
  levelTuples,
  nodesAtLevel,
  normalize,
  predictedLevelCoef,
  ratio,
  solveExponent,
  validateField,
  type Recurrence,
} from './recurrence';
import { coefNText, sizeText, workText } from './format';

const R = (d: number, ...ab: [number, number][]): Recurrence => ({ d, terms: ab.map(([a, b]) => ({ a, b })) });

describe('required cases from the brief', () => {
  const cases: [string, Recurrence, string, string][] = [
    ['2T(n/2) + n', R(1, [2, 2]), '1', 'O(n log n)'],
    ['T(n/2) + 1', R(0, [1, 2]), '1', 'O(log n)'],
    ['T(n/2) + n', R(1, [1, 2]), '1/2', 'O(n)'],
    ['3T(n/2) + n', R(1, [3, 2]), '3/2', 'O(n^1.585)'],
    ['4T(n/2) + n^2', R(2, [4, 2]), '1', 'O(n^2 log n)'],
    ['2T(n/4) + T(n/2) + n', R(1, [2, 4], [1, 2]), '1', 'O(n log n)'],
    ['T(n/2) + 2T(n/5) + n', R(1, [1, 2], [2, 5]), '9/10', 'O(n)'],
    ['T(n/2) + T(n/3) + 1', R(0, [1, 2], [1, 3]), '2', 'O(n^0.788)'],
  ];
  for (const [name, rec, r, o] of cases) {
    it(`${name}: r = ${r}, ${o}`, () => {
      expect(toText(ratio(rec))).toBe(r);
      expect(bigO(rec).text).toBe(o);
    });
  }

  it('2T(n/4) + T(n/2) + n: level tuples match the course table', () => {
    const rec = R(1, [2, 4], [1, 2]);
    const fmt = (l: number) => levelTuples(rec, l).map((t) => `(${workText(t.den, rec.d)}, ${t.count})`).join(', ');
    expect(fmt(0)).toBe('(n, 1)');
    expect(fmt(1)).toBe('(n/4, 2), (n/2, 1)');
    expect(fmt(2)).toBe('(n/16, 4), (n/8, 4), (n/4, 1)');
    for (let l = 0; l <= 4; l++) expect(coefNText(levelTotalCoef(rec, l), 1)).toBe('n');
  });
});

describe('exact r', () => {
  it('detects r = 1 exactly where floating point would not', () => {
    // 1/3 + 1/3 + 1/3 sums to 1 exactly with rationals
    const rec = R(1, [1, 3], [1, 3], [1, 3]);
    expect(eq(ratio(rec), rat(1))).toBe(true);
    expect(classify(rec)).toBe('equal');
  });
  it('classifies all three cases', () => {
    expect(classify(R(1, [1, 2]))).toBe('root');
    expect(classify(R(1, [2, 2]))).toBe('equal');
    expect(classify(R(1, [3, 2]))).toBe('leaves');
  });
  it('d = 0 gives r = Σ a', () => {
    expect(toText(ratio(R(0, [2, 2], [1, 3])))).toBe('3');
  });
});

describe('level totals form a geometric series', () => {
  const recs = [R(1, [2, 4], [1, 2]), R(2, [3, 2], [1, 3]), R(0, [1, 2], [1, 3], [2, 5]), R(1, [7, 2]), R(3, [5, 4], [2, 3])];
  for (const rec of recs)
    it(`total(l) = r^l for d=${rec.d}, terms=${JSON.stringify(rec.terms)}`, () => {
      for (let l = 0; l <= 6; l++) expect(eq(levelTotalCoef(rec, l), predictedLevelCoef(rec, l))).toBe(true);
    });
  it('tuple counts sum to (Σa)^l', () => {
    const rec = R(1, [2, 4], [1, 2], [3, 5]);
    for (let l = 0; l <= 5; l++) expect(levelTuples(rec, l).reduce((s, t) => s + t.count, 0n)).toBe(nodesAtLevel(rec, l));
  });
});

describe('levelTuples', () => {
  it('merges colliding sizes (4·4 = 2·8)', () => {
    const rec = R(1, [1, 4], [1, 2], [1, 8]);
    const l2 = levelTuples(rec, 2);
    const n16 = l2.find((t) => t.den === 16n)!;
    expect(n16.parts.length).toBe(2);
    expect(n16.count).toBe(1n + 2n); // (4,4) one ordering + (2,8) two orderings
  });
  it('enumerates compositions in course order', () => {
    expect(compositions(2, 2)).toEqual([[2, 0], [1, 1], [0, 2]]);
    expect(compositions(1, 3)).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  });
  it('formats sizes', () => {
    expect(sizeText(1n)).toBe('n');
    expect(workText(4n, 2)).toBe('n²/16');
    expect(workText(4n, 0)).toBe('1');
  });
});

describe('normalize', () => {
  it('merges terms that share b', () => {
    const { rec, merges } = normalize(R(1, [1, 2], [3, 4], [1, 2]));
    expect(rec.terms).toEqual([{ a: 2, b: 2 }, { a: 3, b: 4 }]);
    expect(merges).toHaveLength(1);
  });
});

describe('Big-O details', () => {
  it('exact master exponents', () => {
    expect(bigO(R(1, [4, 2])).text).toBe('O(n^2)');
    expect(bigO(R(1, [8, 4])).text).toBe('O(n^3/2)');
    expect(bigO(R(0, [2, 2])).text).toBe('O(n)');
    expect(bigO(R(0, [1, 2])).text).toBe('O(log n)');
    expect(bigO(R(2, [7, 2])).text).toBe('O(n^2.807)');
    expect(bigO(R(1, [3, 2])).method).toBe('master-log');
  });
  it('root case is n^d', () => {
    expect(bigO(R(2, [2, 2])).text).toBe('O(n^2)');
    expect(bigO(R(3, [1, 2], [1, 3])).text).toBe('O(n^3)');
  });
  it('exactLog', () => {
    expect(exactLog(8, 4)).toEqual({ p: 3, q: 2 });
    expect(exactLog(3, 2)).toBeNull();
    expect(exactLog(1, 5)).toEqual({ p: 0, q: 1 });
  });
  it('numeric p solves Σ a_i/b_i^p = 1', () => {
    const terms = [{ a: 1, b: 2 }, { a: 1, b: 3 }];
    const p = solveExponent(terms);
    expect(Math.pow(2, -p) + Math.pow(3, -p)).toBeCloseTo(1, 10);
    expect(p).toBeCloseTo(0.7878, 3);
  });
  it('critical exponent equals d exactly when r = 1', () => {
    const a = analyze(R(1, [2, 4], [1, 2]));
    expect(a.p0).toBeCloseTo(1, 9);
  });
});

describe('concrete n', () => {
  it('merge sort at n = 1024 sums to n(log n + 1)', () => {
    const levels = concreteLevels(R(1, [2, 2]), 1024);
    expect(levels).toHaveLength(11);
    expect(levels.reduce((s, l) => s + l.total, 0)).toBe(1024 * 11);
  });
  it('binary search at n = 1024 has 11 levels of work 1', () => {
    const levels = concreteLevels(R(0, [1, 2]), 1024);
    expect(levels.map((l) => l.total)).toEqual(Array(11).fill(1));
  });
  it('multi-branch tree stops each branch at its own depth', () => {
    const levels = concreteLevels(R(1, [2, 4], [1, 2]), 64);
    // deepest path is the n/2 branch: 64 → 1 in 6 halvings
    expect(levels).toHaveLength(7);
    // the pure n/4 path hits size 1 at level 3 (n/64), so level 4 has no n/256 node
    expect(levels[3].tuples.find((t) => t.den === 64n)?.leaf).toBe(true);
    expect(levels[4].tuples.some((t) => t.den === 256n)).toBe(false);
  });
});

describe('validation', () => {
  it('rejects with friendly messages', () => {
    expect(validateField('a', '0').ok).toBe(false);
    expect(validateField('a', '1.5').ok).toBe(false);
    expect(validateField('b', '1').ok).toBe(false);
    expect(validateField('d', '-1').ok).toBe(false);
    expect(validateField('d', 'x').ok).toBe(false);
    expect(validateField('d', '0')).toEqual({ ok: true, value: 0 });
    const bad = validateField('b', '1');
    expect(!bad.ok && bad.message).toMatch(/never/);
  });
});
