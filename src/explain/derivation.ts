/**
 * The step-by-step solution, written as a worked example for the live
 * recurrence: every number in it comes from the recurrence on screen, and
 * every step says in words what is being computed and why.
 *
 * Each step has
 *   tex   – the computation, with the actual numbers plugged in
 *   note  – what the step does, in plain words, for this recurrence
 *   why   – the reasoning behind it (shown in the explanation panel)
 *   check – optional: a concrete-number sanity check
 * Rich text: $...$ is inline LaTeX.
 */
import { boundValue, concreteSum, levelTuples, powerLatex, termRatio, type Analysis } from '../math/recurrence';
import { rat } from '../math/rational';
import { coefNLatex, eqTex, fullIntTex, isExact, nPowLatex, qPowTex, qTex, shortInt, shortIntTex, shortNum, shortNumTex, sizeLatex, workLatex } from '../math/format';
import type { StepId } from '../state/entities';
import { aSym, bSym, bigOTex, br, logTex, p0Parts, rSumTex, rTex, rValueEq, timesWords } from './tex';
import {
  calls,
  callsList,
  does,
  exampleN,
  fAt,
  leafBound,
  levelRatioTex,
  levelSumTex,
  levelTotalEq,
  levelTotalTex,
  logOfExample,
  ownWork,
  pathsTo,
  rootBound,
  seqCountTex,
  shrinkVerb,
  tupleCountWords,
  workKind,
  workOfSizeM,
} from './words';

export interface Step {
  id: StepId;
  title: string;
  tex: string;
  note: string;
  why: string;
  check?: string;
}

const cache = new WeakMap<Analysis, Step[]>();

/** The solution for this analysis (cached: explanations look steps up often). */
export function derivation(a: Analysis): Step[] {
  let steps = cache.get(a);
  if (!steps) {
    steps = [read(a), size(a), count(a), work(a), total(a), ratioStep(a), pattern(a), dominates(a), depth(a), leaves(a), answer(a)];
    cache.set(a, steps);
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const B = (k: number | bigint) => BigInt(k);
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const chain = (xs: string[]) => xs.filter((x, i) => i === 0 || x !== xs[i - 1]).join(' = ');
const single = (a: Analysis) => a.rec.terms.length === 1;
/** "(×1.75)" after a short fraction, so the size of the step is clear; nothing for whole numbers or long fractions */
const rDec = (a: Analysis) => (a.r.den !== 1n && isExact(a.r) ? ` (×${shortNum(Number(a.r.num) / Number(a.r.den))})` : '');
/** n^d with "1 \cdot" dropped, for products: "n", "n^{2}", "" */
const ndTimes = (nd: string) => (nd === '1' ? '' : `${nd}\\cdot `);

/** "n, \tfrac{3}{2}n, \tfrac{9}{4}n, \dots" */
function firstTotals(a: Analysis, k = 4) {
  return [...Array(k).keys()].map((l) => levelTotalTex(a.rec, l)).join(',\\ ') + ',\\ \\dots';
}

/** One branch's share of r, worked out from the root: "2·n/4 = n/2" */
function rootShareTex(a: Analysis, i: number) {
  const t = a.rec.terms[i];
  const d = a.rec.d;
  const prod = `${t.a}\\cdot ${workLatex(B(t.b), d)}`;
  const val = coefNLatex(termRatio(t, d), d);
  return br(i, prod === val ? prod : `${prod} = ${val}`);
}
/** "the 2 calls on n/4 do 2·n/4 = n/2" for every branch */
const childrenDo = (a: Analysis) => joinAnd(a.rec.terms.map((t, i) => `the ${calls(t.a)} on $${br(i, `n/${t.b}`)}$ ${does(t.a)} $${rootShareTex(a, i)}$`));

/* ------------------------------------------------------------------ */
/* steps                                                               */
/* ------------------------------------------------------------------ */

function read(a: Analysis): Step {
  const { terms, d } = a.rec;
  const nd = nPowLatex(d);
  const tex = terms.map((t, i) => `${aSym(a, i)} = ${br(i, String(t.a))},\\ ${bSym(a, i)} = ${br(i, String(t.b))}`).join(';\\quad ') + `;\\quad d = ${d}`;
  const kind = d === 0 ? 'a fixed amount, like one comparison' : `${workKind(d)} work, such as splitting the input and combining the results`;
  const note = `A call on an input of size $n$ makes ${callsList(a.rec, { colour: true })}, then does ${ownWork(d)} of its own (${kind}).`;
  const why = single(a)
    ? `$a = ${terms[0].a}$ is the number of recursive calls. $b = ${terms[0].b}$ means each of those calls gets $n/${terms[0].b}$. $d = ${d}$ is the power in the extra work, $n^{${d}}${d === 1 ? ' = n' : d === 0 ? ' = 1' : ''}$. These three numbers are all the method needs.`
    : `Each kind of call is its own branch of the tree, with its own colour: ${joinAnd(terms.map((t, i) => `$${aSym(a, i)} = ${t.a}, ${bSym(a, i)} = ${t.b}$ (${calls(t.a)} on $n/${t.b}$)`))}. Every call does the same extra work, $${nd}$, so there is a single $d = ${d}$.`;
  return { id: 'read', title: 'What the recurrence says', tex, note, why };
}

function size(a: Analysis): Step {
  const { terms } = a.rec;
  if (single(a)) {
    const b = terms[0].b;
    const s = (k: number) => sizeLatex(B(b) ** B(k));
    return {
      id: 'size',
      title: 'Input size on each level',
      tex: `${br(0, 'n')} \\;\\to\\; ${s(1)} \\;\\to\\; ${s(2)} \\;\\to\\; ${s(3)} \\;\\to\\;\\cdots\\;\\to\\; \\tfrac{n}{${b}^{\\ell}}`,
      note: `Each level down ${shrinkVerb(b)} again. Level 1 has size $${s(1)}$, level 2 has $${s(2)}$ ($= n/${b}^2$), level 3 has $${s(3)}$. In general, level $\\ell$ has size $n/${b}^{\\ell}$.`,
      why: `A call on size $m$ makes calls on $m/${b}$. The root has $m = n$, so its children have $n/${b}$. Their children have $\\tfrac{n}{${b}} \\div ${b} = ${s(2)}$, and so on, one more factor of ${b} per level.`,
    };
  }
  const l2 = levelTuples(a.rec, 2).map((t) => sizeLatex(t.den));
  const kids = terms.map(
    (t, i) => `a call on $${br(i, `n/${t.b}`)}$ makes calls on ${joinAnd(terms.map((u, j) => `$${br(j, `n/${t.b * u.b}`)}$`))}`,
  );
  const [b1, b2] = [terms[0].b, terms[1].b];
  return {
    id: 'size',
    title: 'Input size on each level',
    tex: `\\text{level 1: } ${terms.map((t, i) => br(i, sizeLatex(B(t.b)))).join(',\\ ')} \\qquad \\text{level 2: } ${l2.join(',\\ ')}`,
    note: `The branches shrink by different amounts, so one level can hold several sizes. Level 1 has ${joinAnd(terms.map((t, i) => `$${br(i, `n/${t.b}`)}$`))}. On level 2, ${joinAnd(kids)}. So level 2 has the sizes ${joinAnd(l2.map((s) => `$${s}$`))}.`,
    why: `Each step of a path divides by the $b$ of the branch it takes. Taking $\\div ${b1}$ twice reaches $n/${b1 * b1}$. Taking $\\div ${b1}$ then $\\div ${b2}$ reaches $n/${b1 * b2}$, and so does $\\div ${b2}$ then $\\div ${b1}$. Calls that end up the same size are counted together as one tuple.`,
  };
}

function count(a: Analysis): Step {
  const { terms } = a.rec;
  if (single(a)) {
    const A = terms[0].a;
    if (A === 1)
      return {
        id: 'count',
        title: 'Number of calls on each level',
        tex: `1 \\;\\to\\; 1 \\;\\to\\; 1 \\;\\to\\;\\cdots`,
        note: `Each call makes just 1 recursive call, so every level has exactly 1 call. The tree is a single path.`,
        why: `$a = 1$: the root has 1 child, that child has 1 child, and so on. Nothing ever branches.`,
      };
    const p = (k: number) => shortInt(B(A) ** B(k));
    const pT = (k: number) => shortIntTex(B(A) ** B(k));
    return {
      id: 'count',
      title: 'Number of calls on each level',
      tex: `1 \\;\\to\\; ${br(0, String(A))} \\;\\to\\; ${pT(2)} \\;\\to\\; ${pT(3)} \\;\\to\\;\\cdots\\;\\to\\; ${A}^{\\ell}`,
      note: `Every call makes ${A} calls, so each level has ${A} times as many calls as the one above: 1, ${A}, ${p(2)}, ${p(3)}. Level $\\ell$ has $${A}^{\\ell}$ calls.`,
      why: `Level 1 is the root's ${A} calls. Each of those makes ${A} more, giving $${A}\\times${A} = ${pT(2)}$ on level 2, then $${pT(2)}\\times${A} = ${pT(3)}$ on level 3.`,
    };
  }
  const paths = pathsTo(a.rec, 2);
  const tuples = levelTuples(a.rec, 2);
  const parts = tuples.map((t) => `${sizeLatex(t.den)}:\\ ${chain([paths.get(t.den)!.map((p) => seqCountTex(a.rec, p.seq)).join(' + '), shortIntTex(t.count)])}`);
  // explain the size with the most paths: that is the interesting one
  const richest = tuples.reduce((x, y) => ((paths.get(y.den)?.length ?? 0) > (paths.get(x.den)?.length ?? 0) ? y : x));
  const total = a.branching;
  const how = tupleCountWords(a.rec, 2, richest.den) ?? '';
  return {
    id: 'count',
    title: 'Number of calls on each level',
    tex: parts.join(',\\quad '),
    note: `To count the calls of one size, multiply the counts along each path that reaches it, then add the paths. For $${sizeLatex(richest.den)}$ on level 2, ${how.charAt(0).toLowerCase()}${how.slice(1)}`,
    why: `Every call makes $${terms.map((t, i) => br(i, String(t.a))).join(' + ')} = ${total}$ calls in all, so the levels have $1, ${total}, ${shortIntTex(total ** 2n)}, ${shortIntTex(total ** 3n)}, \\dots$ calls. Level 2's $${shortIntTex(total ** 2n)}$ calls split into the sizes above: $${tuples.map((t) => shortIntTex(t.count)).join(' + ')} = ${shortIntTex(total ** 2n)}$.`,
  };
}

function work(a: Analysis): Step {
  const { terms, d } = a.rec;
  const nd = nPowLatex(d);
  const dens = single(a) ? [1n, B(terms[0].b), B(terms[0].b) ** 2n] : [1n, ...terms.map((t) => B(t.b))];
  const tex = dens.map((den, i) => (single(a) || i === 0 ? fAt(den, d) : br(i - 1, fAt(den, d)))).join(',\\quad ');
  const listed = dens.slice(1).map((den) => `a call on $${sizeLatex(den)}$ does $${workLatex(den, d)}$`);
  const note =
    d === 0
      ? `This is the $+\\,1$ part of the recurrence: every call does 1 unit of work of its own, whatever its size. The root does 1, and so does every call below it.`
      : `This is the $+\\,${nd}$ part of the recurrence. A call on size $m$ ${workOfSizeM(d)}, not counting its recursive calls. So the root does $${nd}$, ${joinAnd(listed)}.`;
  const b0 = single(a) ? terms[0].b : a.minB;
  const why =
    d === 0
      ? `$d = 0$ means $f(n) = n^0 = 1$: a fixed amount of work per call, like one comparison. Smaller calls do not do any less.`
      : `$d = ${d}$ means $f(n) = ${nd}$, so a smaller size means less work. Dividing the size by ${b0} divides the work by ${d === 1 ? `${b0} too` : `$${b0}^{${d}} = ${shortIntTex(B(b0) ** B(d))}$`}.`;
  return { id: 'work', title: 'Work done by one call', tex, note, why };
}

function total(a: Analysis): Step {
  const rec = a.rec;
  const upto = single(a) ? 3 : 2;
  const rows = [...Array(upto + 1).keys()].map((l) => `\\text{level ${l}:}\\ & ${levelSumTex(rec, l)}`);
  const d = rec.d;
  const t0 = rec.terms[0];
  const w1 = d === 0 ? '1 unit of work' : `$${workLatex(B(t0.b), d)}$`;
  const l1 = single(a)
    ? t0.a === 1
      ? `Level 1 has 1 call, doing ${w1}.`
      : `Level 1 has ${calls(t0.a)}, each doing ${w1}, for $${levelTotalTex(rec, 1)}$ in all.`
    : `On level 1, ${childrenDo(a)}, for $${levelTotalTex(rec, 1)}$ in all.`;
  return {
    id: 'total',
    title: 'Total work on each level',
    tex: `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`,
    note: `For each level, multiply the number of calls by the work each one does, then add. ${l1}`,
    why: `These totals are exactly what the bars show: level 0 is $${levelTotalTex(rec, 0)}$, level 1 is $${levelTotalTex(rec, 1)}$, level 2 is $${levelTotalTex(rec, 2)}$. The next step compares each level with the one above it.`,
  };
}

function ratioStep(a: Analysis): Step {
  const rec = a.rec;
  const { terms, d } = rec;
  const nd = nPowLatex(d);
  const L0 = levelTotalTex(rec, 0);
  const L1 = levelTotalTex(rec, 1);
  const r = rTex(a);
  const equal = a.case === 'equal';
  const vsAbove = equal ? 'the same work as the level above' : timesWords(a.r, 'the work of the level above');
  const mid = single(a) ? (d === 0 ? `${terms[0].a}\\cdot 1` : `${terms[0].a}\\cdot \\tfrac{1}{${shortIntTex(B(terms[0].b) ** B(d))}}`) : rSumTex(a);
  const tex = `${chain([`r = \\frac{\\text{level 1}}{\\text{level 0}}`, `\\frac{${L1}}{${L0}}`, mid])} ${rValueEq(a.r)}`;
  let note: string;
  if (single(a)) {
    const { a: A, b: Bv } = terms[0];
    const more = A === 1 ? 'there is still just 1 call' : `there are ${A} times as many calls`;
    const divided = d === 1 ? `so its work is divided by ${Bv} too` : `so its work is divided by $${Bv}^{${d}} = ${shortIntTex(B(Bv) ** B(d))}$`;
    note =
      d === 0
        ? `Going down one level ${more}, and each still does 1 unit of work. So each level does ${vsAbove}: $r = ${r}$.`
        : `Going down one level ${more}, but each call's size is divided by ${Bv}, ${divided}. Together: $${A} \\times \\tfrac{1}{${shortIntTex(B(Bv) ** B(d))}} ${eqTex(a.r)}$. Each level does ${vsAbove}.`;
  } else {
    note = `Look at what the root's children do: ${childrenDo(a)}. Together that is $${L1}$, which is ${timesWords(a.r, `the root's $${nd}$`)}. Each branch adds its own share (${joinAnd(terms.map((_t, i) => `$${br(i, qTex(a.termRatios[i]))}$`))}), and $r$ is their sum.`;
  }
  return {
    id: 'ratio',
    title: 'The ratio r between levels',
    tex,
    note,
    why: equal
      ? `The same thing happens under every call, not just the root: a call that does some amount of work $W$ has children that together also do $W$. So every level has the same total as the one above, all the way down.`
      : `The same thing happens under every call, not just the root: a call that does some amount of work $W$ has children that do $${r}\\cdot W$ in total. So every level is $${r}$ times the one above, all the way down.`,
    check: `Level 2 ÷ level 1: $${levelRatioTex(rec, a.r)}$${d > 0 ? ` (the $${nd}$ cancels)` : ''}. Same ratio.`,
  };
}

function pattern(a: Analysis): Step {
  const r = rTex(a);
  const nd = nPowLatex(a.rec.d);
  const note =
    a.case === 'root'
      ? `Each total is $${r}$ of the one before${rDec(a)}, so they shrink: the bars get shorter going down.`
      : a.case === 'equal'
        ? `Every total equals the one before, so every level does ${ownWork(a.rec.d)}: the bars are all the same length.`
        : `Each total is $${r}$ times the one before${rDec(a)}, so they grow: the bars get longer going down.`;
  return {
    id: 'pattern',
    title: 'The pattern of level totals',
    tex: firstTotals(a),
    note,
    why:
      a.case === 'equal'
        ? `Multiplying by $r = 1$ changes nothing, so level 3 does $${nd}$, just like the root, and so does every other level.`
        : `Multiplying by $${r}$ once per level means level $\\ell$ does $${qPowTex(a.r, '\\ell')}$ times the root's work. Level 3, for example, does $${qPowTex(a.r, 3)} \\cdot ${nd} ${levelTotalEq(a.rec, 3)}$.`,
  };
}

function dominates(a: Analysis): Step {
  const rec = a.rec;
  const r = rTex(a);
  const nd = nPowLatex(rec.d);
  const [L0, L1, L2] = [0, 1, 2].map((l) => levelTotalTex(rec, l));
  if (a.case === 'root') {
    const c = rootBound(a.r);
    return {
      id: 'dominates',
      title: 'Which levels matter most',
      tex: `${L0} + ${L1} + ${L2} + \\cdots \\;\\le\\; ${qTex(c)}\\cdot ${nd}`,
      note: `Each level is $${r}$ of the one above, so the totals shrink. A shrinking series like this adds up to at most $\\frac{1}{1 - r} ${eqTex(c)}$ times its first term, however many levels there are. So the whole tree does at most $${qTex(c)}$ × the root's $${nd}$: the root dominates.`,
      why: `The first term is the root's $${nd}$. Each later level adds only $${r}$ of the one before, so the extra amounts keep getting smaller and never push the sum past $${qTex(c)}\\cdot ${nd}$.`,
    };
  }
  if (a.case === 'equal')
    return {
      id: 'dominates',
      title: 'Which levels matter most',
      tex: `${L0} + ${L0} + ${L0} + \\cdots = ${nd === '1' ? '' : `${nd} \\times `}(\\text{number of levels})`,
      note: `Every level does exactly ${ownWork(rec.d)}, so no level is bigger than the others. The total is ${nd === '1' ? 'just the number of levels' : `$${nd}$ times the number of levels`}, which the next step counts.`,
      why: `With $r = 1$ nothing shrinks or grows from level to level. The answer depends only on how many levels there are.`,
    };
  const c = leafBound(a.r);
  const inv = rat(a.r.den, a.r.num);
  return {
    id: 'dominates',
    title: 'Which levels matter most',
    tex: `\\text{all levels} \\;\\le\\; ${qTex(c)} \\times (\\text{bottom level})`,
    note: `Each level is $${r}$ times the one above, so the totals grow and the bottom level does the most. Read from the bottom up, each level is $${qTex(inv)}$ of the one below it, so all the levels together add up to at most $\\frac{r}{r - 1} ${eqTex(c)}$ times the bottom level. The leaves dominate.`,
    why: single(a)
      ? `It's the same shrinking-series idea as when $r < 1$, just read from the bottom up: the bottom level is the biggest, and each level above it is a fixed fraction of the one below.`
      : `With several branches the bottom is ragged, because paths end at different depths. The idea is the same, though: the work piles up near the leaves, so counting the leaves gives the answer.`,
  };
}

function depth(a: Analysis): Step {
  const rec = a.rec;
  const ex = exampleN(a);
  if (single(a)) {
    const b = rec.terms[0].b;
    const sizes = [...Array(ex.k + 1).keys()].map((i) => shortIntTex(B(ex.n) / B(b) ** B(i)));
    const shown = sizes.length <= 7 ? sizes.join(' \\to ') : `${sizes.slice(0, 3).join(' \\to ')} \\to \\cdots \\to 1`;
    return {
      id: 'depth',
      title: 'How deep the tree goes',
      tex: `\\frac{n}{${b}^{L}} = 1 \\;\\Rightarrow\\; ${b}^{L} = n \\;\\Rightarrow\\; L = ${logTex(b)}`,
      note: `The recursion stops when a call's size reaches 1. The size is divided by ${b} at each level, so after $L$ levels it is $n/${b}^L$. That is 1 when $L = ${logTex(b)}$, which gives $${logTex(b)} + 1$ levels counting the root.`,
      why: `$${logTex(b)}$ answers "how many times can I divide $n$ by ${b} before reaching 1?" That count is the depth of the tree.`,
      check: `With $n = ${shortIntTex(ex.n)} = ${b}^{${ex.k}}$: $${shown}$. That is ${ex.k} divisions, so ${ex.k + 1} levels.`,
    };
  }
  const minIdx = rec.terms.findIndex((t) => t.b === a.minB);
  const maxIdx = rec.terms.findIndex((t) => t.b === a.maxB);
  return {
    id: 'depth',
    title: 'How deep the tree goes',
    tex: `\\text{deepest: } \\log_{${br(minIdx, String(a.minB))}} n,\\qquad \\text{complete down to: } \\log_{${br(maxIdx, String(a.maxB))}} n`,
    note: `Paths shrink at different speeds. Always taking the slowest branch ($${br(minIdx, `\\div ${a.minB}`)}$) gives the deepest path, which reaches size 1 after $\\log_{${a.minB}} n$ levels. Always taking $${br(maxIdx, `\\div ${a.maxB}`)}$ ends soonest, after $\\log_{${a.maxB}} n$ levels. Down to level $\\log_{${a.maxB}} n$ every path is still going, so those levels are complete. Below that, the tree thins out.`,
    why: `Each complete level does exactly $r^{\\ell}$ times the root's work. The thinned-out levels do less, because some of their paths have already stopped.`,
    check: `With $n = ${shortIntTex(ex.n)}$: the deepest path is ${logOfExample(ex.n, a.minB)} levels below the root, and the shortest is ${logOfExample(ex.n, a.maxB)}.`,
  };
}

function leaves(a: Analysis): Step {
  const rec = a.rec;
  const { terms, d } = rec;
  const pp = p0Parts(a);
  const ex = exampleN(a);
  if (single(a)) {
    const { a: A, b: Bv } = terms[0];
    if (A === 1)
      return {
        id: 'leaves',
        title: 'How many leaves',
        tex: `1^{L} = 1`,
        note: `With $a = 1$ there is one call per level, so the bottom level is a single leaf.`,
        why: `A single path has a single end.`,
      };
    const leavesExact = B(A) ** B(ex.k);
    const swapped = `${A}^{${logTex(Bv)}} = n^{\\log_{${Bv}} ${A}}`;
    return {
      id: 'leaves',
      title: 'How many leaves',
      tex: `${swapped} ${pp.rel} ${powerLatex(pp.val)}`,
      note: `The bottom level (level $L = ${logTex(Bv)}$) has $${A}^L$ calls. Swap the base and the exponent using $a^{\\log_b n} = n^{\\log_b a}$: ${
        pp.exact ? `$${swapped} = ${powerLatex(pp.val)}$` : `$${swapped}$, and $\\log_{${Bv}} ${A} \\approx ${pp.val}$`
      }. Each leaf does a constant amount of work, so the leaves together do about $${powerLatex(pp.val)}$ work.`,
      why: `The swap works because both sides equal $e^{\\ln ${A} \\cdot \\ln n / \\ln ${Bv}}$. Writing the count as a power of $n$ makes it easy to compare with the root's ${ownWork(d)}.`,
      check: `With $n = ${shortIntTex(ex.n)} = ${Bv}^{${ex.k}}$, the bottom level has $${A}^{${ex.k}} = ${fullIntTex(leavesExact)}$ leaves${
        pp.exact ? `, which is $${shortIntTex(ex.n)}^{${pp.val}}$` : `, and $${shortIntTex(ex.n)}^{${pp.val}} \\approx ${shortNumTex(Math.pow(ex.n, a.p0))}$`
      }.`,
    };
  }
  const p = a.case === 'equal' ? d : a.p0;
  const pStr = pp.val;
  const shares = terms.map((t, i) => br(i, `\\tfrac{${t.a}}{${t.b}^{p_0}}`)).join(' + ');
  const vals = terms.map((t) => t.a * Math.pow(t.b, -p));
  return {
    id: 'leaves',
    title: 'How many leaves',
    tex: `${shares} = 1 \\;\\Rightarrow\\; p_0 ${pp.rel} ${pStr} \\;\\Rightarrow\\; \\Theta(${powerLatex(pStr)}) \\text{ leaves}`,
    note: `Paths end at different depths, so there is no single "$a^L$". Instead, the number of leaves is about $n^{p_0}$, where $p_0$ is the power that makes the branches' shares add up to exactly 1. ${
      a.case === 'equal' ? `Here $p_0 = d = ${d}$, because $r = 1$ already says $${rSumTex(a)} = 1$.` : `Solving for it numerically gives $p_0 \\approx ${pStr}$.`
    }`,
    why: `Pretend each call did $m^{p_0}$ work instead of $m^{${d}}$. Then every level would tie (that is what "shares add up to 1" means), and the bottom level, about one unit of work per leaf, would do about $n^{p_0}$ in total. So there are about $n^{p_0}$ leaves.`,
    check: `Put $p_0 = ${pStr}$ back in: $${terms.map((t, i) => br(i, `\\tfrac{${t.a}}{${t.b}^{${pStr}}}`)).join(' + ')} \\approx ${vals.map((v) => v.toFixed(3)).join(' + ')} = ${vals.reduce((s, v) => s + v, 0).toFixed(3)}$.`,
  };
}

function answer(a: Analysis): Step {
  const rec = a.rec;
  const { terms, d } = rec;
  const nd = nPowLatex(d);
  const ex = exampleN(a);
  const sum = concreteSum(rec, ex.n);
  const bound = boundValue(a.bigO, ex.n);
  const boundName = a.bigO.latex.replace(/\\log n/, '\\log_2 n');
  const check = `With $n = ${shortIntTex(ex.n)}$, the actual tree's levels add up to ${shortNum(sum)}, and $${boundName} = ${shortNumTex(bound)}$: a ratio of ${shortNum(sum / bound)}. In the Concrete $n$ view you can watch this ratio stay roughly steady as $n$ grows.`;
  if (a.case === 'root') {
    const c = qTex(rootBound(a.r));
    return {
      id: 'answer',
      title: 'Final answer',
      tex: `T(n) \\;\\le\\; ${c}\\cdot ${nd} \\;\\Rightarrow\\; T(n) = ${bigOTex(a)}`,
      note: `All the levels together do at most $${c}\\cdot ${nd}$: the root's work times a constant. Big-O ignores constant factors, so $T(n) = ${bigOTex(a)}$.`,
      why: `The root alone already does $${nd}$, so the total is at least $${nd}$ and at most $${c}\\cdot ${nd}$. Both bounds are a constant times $${nd}$.`,
      check,
    };
  }
  if (a.case === 'equal') {
    if (single(a)) {
      const b = terms[0].b;
      const exact = d === 0 ? `${logTex(b)} + 1` : `${nd}(${logTex(b)} + 1)`;
      return {
        id: 'answer',
        title: 'Final answer',
        tex: `T(n) = ${exact} \\;\\Rightarrow\\; T(n) = ${bigOTex(a)}`,
        note: `Each of the $${logTex(b)} + 1$ levels does ${ownWork(d)}, so $T(n) = ${exact}$. Dropping the smaller $+\\,${nd}$ gives $T(n) = ${bigOTex(a)}$.`,
        why:
          b === 2
            ? `Big-O writes $\\log_2 n$ as just $\\log n$: logs in different bases differ only by a constant factor.`
            : `$${logTex(b)}$ is $\\log_2 n$ divided by the constant $\\log_2 ${b}$, so the base of the log doesn't matter in Big-O.`,
        check,
      };
    }
    return {
      id: 'answer',
      title: 'Final answer',
      tex: `${ndTimes(nd)}\\log_{${a.maxB}} n \\;\\le\\; T(n) \\;\\le\\; ${nd === '1' ? '' : nd}(\\log_{${a.minB}} n + 1) \\;\\Rightarrow\\; T(n) = ${bigOTex(a)}`,
      note: `The complete levels each do exactly ${ownWork(d)}, and there are between $${logTex(a.maxB)}$ and $${logTex(a.minB)} + 1$ levels. Both are a constant times $\\log n$, so $T(n) = ${bigOTex(a)}$.`,
      why: `The lower bound counts only the complete levels, each doing exactly ${ownWork(d)}. The upper bound pretends the tree is complete all the way down to the deepest path.`,
      check,
    };
  }
  const pp = p0Parts(a);
  const c = qTex(leafBound(a.r));
  if (single(a)) {
    const { a: A, b: Bv } = terms[0];
    return {
      id: 'answer',
      title: 'Final answer',
      tex: `T(n) \\;\\le\\; ${c}\\cdot n^{\\log_{${Bv}} ${A}} \\;\\Rightarrow\\; T(n) = ${bigOTex(a)}`,
      note: `The bottom level does about $n^{\\log_{${Bv}} ${A}}$ work (one unit per leaf), and the levels above it add at most a factor of $${c}$. So $T(n) = ${bigOTex(a)}$${pp.exact ? '' : `, using $\\log_{${Bv}} ${A} \\approx ${pp.val}$`}.`,
      why: `Compare with the root: the leaves do $${powerLatex(pp.val)}$ and the root does $${nd}$. Since $${pp.val} > ${d}$, the leaves win, just as $r = ${rTex(a)} > 1$ said.`,
      check,
    };
  }
  return {
    id: 'answer',
    title: 'Final answer',
    tex: `T(n) = \\Theta(n^{p_0}),\\ p_0 \\approx ${pp.val} \\;\\Rightarrow\\; T(n) = ${bigOTex(a)}`,
    note: `The work piles up at the leaves, and there are about $n^{${pp.val}}$ of them, so $T(n) = ${bigOTex(a)}$. This is the Akra–Bazzi method; the single-branch formula $n^{\\log_b a}$ doesn't apply because there is no single $b$.`,
    why: `$p_0 \\approx ${pp.val}$ is bigger than $d = ${d}$, so the leaves do more than the root's ${ownWork(d)}, just as $r ${eqTex(a.r)} > 1$ predicted.`,
    check,
  };
}

