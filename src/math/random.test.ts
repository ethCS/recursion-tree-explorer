import { describe, expect, it } from 'vitest';
import { PRESETS, poolSizes, randomRecurrence } from './random';
import { bigO, classify, LIMITS, normalize } from './recurrence';

describe('randomRecurrence', () => {
  it('every pool bucket is non-empty', () => {
    for (const b of Object.values(poolSizes())) {
      expect(b.single).toBeGreaterThan(0);
      expect(b.multi).toBeGreaterThan(0);
    }
  });
  it('samples the three cases about equally and includes multi-branch', () => {
    // deterministic LCG so the test is stable
    let s = 42;
    const rand = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
    const counts = { root: 0, equal: 0, leaves: 0 };
    let multi = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const rec = randomRecurrence(rand);
      counts[classify(rec)]++;
      if (rec.terms.length > 1) multi++;
      // always valid and already normalised
      expect(normalize(rec).merges).toHaveLength(0);
      for (const t of rec.terms) {
        expect(t.a).toBeGreaterThanOrEqual(LIMITS.a.min);
        expect(t.b).toBeGreaterThanOrEqual(LIMITS.b.min);
      }
    }
    for (const c of Object.values(counts)) expect(c / N).toBeGreaterThan(0.28);
    expect(multi / N).toBeGreaterThan(0.35);
  });
  it('presets give the textbook answers', () => {
    expect(PRESETS.map((p) => bigO(p.rec).text)).toEqual(['O(n log n)', 'O(log n)', 'O(n^1.585)', 'O(n log n)']);
  });
});
