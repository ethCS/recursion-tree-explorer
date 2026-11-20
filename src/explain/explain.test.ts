/**
 * Every explanation and solution step, for a wide spread of recurrences:
 * - all LaTeX must parse (KaTeX with throwOnError),
 * - no "undefined" / "NaN" / template leftovers (a_i, k_i, Σ_i ...),
 * - the text must quote the recurrence's actual numbers.
 */
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { analyze, concreteLevels, boundValue, type Recurrence } from '../math/recurrence';
import { PRESETS } from '../math/random';
import type { Entity } from '../state/entities';
import { STEP_ORDER } from '../state/entities';
import { derivation } from './derivation';
import { explain, partTip, type ExplainCtx } from './explain';

const BAD = [/undefined/, /NaN/, /\[object/, /Infinity/, /a_i/, /b_i/, /k_i/, /\\sum_i/, /\\prod/, /k_1/];
// wording and number-style slips that once shipped
const SLIPS = [/\b1 calls\b/, /\b1 nodes\b/, /\b1 children\b/, /\b1 call on \$[^$]*\$ do\b/, /r = 1 = 1/, /\$\$/, /\d\.?\d*e[+-]?\d/, /frac\{[^}]*\}\{\d{6,}\}/, /\\dots\$\./];

function checkRich(text: string, where: string) {
  for (const re of BAD) expect(text, `${where}: ${re}`).not.toMatch(re);
  for (const re of SLIPS) expect(text, `${where}: ${re}`).not.toMatch(re);
  const parts = text.split(/(\$[^$]+\$)/g).filter((p) => p.startsWith('$') && p.endsWith('$') && p.length > 1);
  for (const p of parts) {
    expect(() => katex.renderToString(p.slice(1, -1), { throwOnError: true, trust: true, strict: false }), `${where}: ${p}`).not.toThrow();
  }
  // an odd number of $ means an unclosed math span
  expect((text.match(/\$/g) ?? []).length % 2, `${where}: unbalanced $ in ${text}`).toBe(0);
}

function checkTex(tex: string, where: string) {
  for (const re of BAD) expect(tex, `${where}: ${re}`).not.toMatch(re);
  expect(() => katex.renderToString(tex, { throwOnError: true, trust: true, strict: false, displayMode: true }), `${where}: ${tex}`).not.toThrow();
}

function entities(rec: Recurrence): Entity[] {
  const m = rec.terms.length;
  const terms = [...Array(m).keys()];
  const paths = ['', '0a', ...(m > 1 ? ['1a', '0a1a', '1a0b'] : ['0a0b'])];
  return [
    { kind: 'lhs' },
    { kind: 'fwork' },
    { kind: 'exp' },
    { kind: 'r' },
    { kind: 'answer' },
    { kind: 'sum' },
    { kind: 'leafrow' },
    ...terms.flatMap((term): Entity[] => [
      { kind: 'call', term },
      { kind: 'coef', term },
      { kind: 'div', term },
      { kind: 'rterm', term },
    ]),
    ...paths.map((path): Entity => ({ kind: 'node', path })),
    ...[0, 1, 2, 3, 4].map((level): Entity => ({ kind: 'level', level })),
    ...STEP_ORDER.map((id): Entity => ({ kind: 'step', id })),
  ];
}

function checkAll(rec: Recurrence, concreteN?: number) {
  const a = analyze(rec);
  const label = JSON.stringify(rec);
  for (const s of derivation(a)) {
    checkTex(s.tex, `${label} step ${s.id} tex`);
    checkRich(s.note, `${label} step ${s.id} note`);
    checkRich(s.why, `${label} step ${s.id} why`);
    if (s.check) checkRich(s.check, `${label} step ${s.id} check`);
  }
  const levels = concreteN ? concreteLevels(rec, concreteN) : null;
  const ctxs: ExplainCtx[] = [
    { a, concrete: null },
    { a, concrete: null, locked: true },
    ...(levels
      ? [{ a, concrete: { n: concreteN!, levels, sum: levels.reduce((s, l) => s + l.total, 0), bound: boundValue(a.bigO, concreteN!) } }]
      : []),
  ];
  for (const ctx of ctxs)
    for (const e of entities(rec)) {
      const ex = explain(e, ctx);
      checkRich(ex.title, `${label} ${e.kind} title`);
      for (const s of ex.sections) checkRich(s.body, `${label} ${JSON.stringify(e)} ${s.h}`);
      const tip = partTip(e, a);
      if (tip) {
        checkRich(tip.name, `${label} tip ${e.kind}`);
        checkRich(tip.body, `${label} tip ${e.kind}`);
      }
      // tuples on the first levels
    }
}

describe('explanations render for every kind of recurrence', () => {
  it('presets', () => {
    for (const p of PRESETS) checkAll(p.rec, 256);
  });

  it('single-term recurrences across the whole input range', () => {
    for (let d = 0; d <= 4; d++)
      for (const b of [2, 3, 4, 5, 7, 8, 10, 16]) for (const a of [1, 2, 3, 4, 7, 8, 9, 16]) checkAll({ terms: [{ a, b }], d });
  }, 120_000);

  it('a spread of two- and three-term recurrences', () => {
    const bs = [2, 3, 4, 7, 16];
    const as = [1, 2, 5, 16];
    for (let d = 0; d <= 4; d += 2)
      for (const b1 of bs)
        for (const b2 of bs)
          if (b2 < b1) for (const a1 of as) for (const a2 of as) checkAll({ terms: [{ a: a1, b: b1 }, { a: a2, b: b2 }], d });
    checkAll({ terms: [{ a: 3, b: 6 }, { a: 2, b: 5 }, { a: 1, b: 2 }], d: 0 }, 1000);
    checkAll({ terms: [{ a: 1, b: 6 }, { a: 1, b: 3 }, { a: 1, b: 2 }], d: 1 }, 729);
    checkAll({ terms: [{ a: 16, b: 16 }, { a: 16, b: 15 }, { a: 16, b: 14 }], d: 4 });
  }, 120_000);
});

describe('explanations plug in the actual numbers', () => {
  const course = analyze({ terms: [{ a: 2, b: 4 }, { a: 1, b: 2 }], d: 1 });
  const steps = Object.fromEntries(derivation(course).map((s) => [s.id, s]));

  it('reads the recurrence in words', () => {
    expect(steps.read.note).toMatch(/2 calls on/);
    expect(steps.read.note).toMatch(/a quarter of the input/);
    expect(steps.read.note).toMatch(/1 call on/);
    expect(steps.read.note).toMatch(/half the input/);
  });

  it('spells out where level 2 counts come from', () => {
    // n/8 is reached two ways: ÷4 then ÷2 (2·1) and ÷2 then ÷4 (1·2)
    expect(steps.count.note).toMatch(/2 ways/);
    expect(steps.count.note).toMatch(/2 \+ 2 = 4/);
  });

  it('adds up level 2 with real numbers', () => {
    expect(steps.total.tex).toContain('4\\cdot \\tfrac{n}{16}');
    expect(steps.total.tex).toContain('4\\cdot \\tfrac{n}{8}');
  });

  it('computes r from the root and checks it on level 2', () => {
    expect(steps.ratio.note).toMatch(/2 calls on/);
    expect(steps.ratio.check).toMatch(/Level 2 ÷ level 1/);
  });

  it('gives a concrete depth example', () => {
    expect(steps.depth.check).toMatch(/n = 4{,}096/);
    expect(steps.depth.check).toMatch(/12 levels below the root/);
    expect(steps.depth.check).toMatch(/shortest is 6/);
  });

  it('Karatsuba counts its leaves for a real n', () => {
    const k = derivation(analyze({ terms: [{ a: 3, b: 2 }], d: 1 })).find((s) => s.id === 'leaves')!;
    expect(k.check).toContain('3^{12} = 531{,}441');
  });

  it('what-if: the coefficient explanation says what a change would do', () => {
    const ms = analyze({ terms: [{ a: 2, b: 2 }], d: 1 });
    const ex = explain({ kind: 'coef', term: 0 }, { a: ms, concrete: null });
    const feeds = ex.sections.find((s) => s.h === 'What it feeds')!.body;
    expect(feeds).toMatch(/With 3 calls/);
    expect(feeds).toMatch(/the leaves dominate/);
    expect(feeds).toMatch(/With 1/);
    expect(feeds).toMatch(/the root dominates/);
  });

  it('locked explanations do not give away r', () => {
    const ex = explain({ kind: 'coef', term: 0 }, { a: course, concrete: null, locked: true });
    expect(ex.sections.map((s) => s.body).join(' ')).not.toMatch(/r = /);
  });

  it('tooltips name each part and say whether it is editable', () => {
    expect(partTip({ kind: 'fwork' }, course)!.name).toMatch(/non-recursive work/);
    expect(partTip({ kind: 'fwork' }, course)!.editable).toBe(false);
    expect(partTip({ kind: 'coef', term: 0 }, course)!.body).toMatch(/2 recursive calls on \$n\/4\$/);
    expect(partTip({ kind: 'div', term: 1 }, course)!.body).toMatch(/half the input/);
    expect(partTip({ kind: 'exp' }, course)!.editable).toBe(true);
  });
});
