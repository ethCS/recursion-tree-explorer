/**
 * Generates the "click anything to learn" explanations from live values.
 * Every explanation is a worked example for the recurrence on screen: it
 * plugs in the actual a, b and d, and says in words what is computed.
 * Rich text: $...$ is inline LaTeX.
 */
import { cmp, mul, ONE } from '../math/rational';
import { levelTotalCoef, levelTuples, nodesAtLevel, nodeWorkCoef, tupleTotalCoef, termRatio, type Analysis, type ConcreteLevel } from '../math/recurrence';
import { coefNEq, coefNLatex, eqTex, nPowLatex, qPowTex, shortInt, shortIntTex, shortNum, shortNumTex, sizeLatex, workLatex } from '../math/format';
import type { Entity, StepId } from '../state/entities';
import { pathBranches, pathDen, pathLevel } from '../tree/layout';
import { derivation } from './derivation';
import { bigOTex, br, rEqTex, rFullTex, rSumTex, rTermTex, rTex, timesWords } from './tex';
import {
  calls,
  callsList,
  does,
  exampleN,
  fAt,
  levelRatioTex,
  levelSumTex,
  levelTotalTex,
  logOfExample,
  ownWork,
  pieceOfInput,
  plural,
  tupleCountWords,
  whatIf,
  whatIfSentence,
  workExample,
  workKind,
  workOfSizeM,
} from './words';

export interface Explanation {
  title: string;
  sections: { h: 'What it is' | 'Why this value' | 'What it feeds' | 'Check it'; body: string }[];
  next?: { label: string; entity: Entity };
}

export interface ExplainCtx {
  a: Analysis;
  concrete: { n: number; levels: ConcreteLevel[]; sum: number; bound: number } | null;
  /** a prediction is pending: avoid giving away r or the verdict */
  locked?: boolean;
}

const NEXT_R: Explanation['next'] = { label: 'Next: the ratio r', entity: { kind: 'r' } };
const NEXT_ANSWER: Explanation['next'] = { label: 'Next: the final answer', entity: { kind: 'answer' } };
const LOCKED_NOTE = 'Make your prediction first to see how this affects the answer.';
export const BRANCH_COLOUR = ['teal', 'indigo', 'magenta'];

const sym = (a: Analysis, s: 'a' | 'b', i: number) => `${s}${a.rec.terms.length > 1 ? `_${i + 1}` : ''}`;
const callTex = (a: Analysis, i: number) => {
  const t = a.rec.terms[i];
  return `${t.a === 1 ? '' : t.a}T(n/${t.b})`;
};
const ndOf = (a: Analysis) => nPowLatex(a.rec.d);
const firstTotals = (a: Analysis) => [0, 1, 2, 3].map((l) => levelTotalTex(a.rec, l)).join(',\\ ') + ',\\ \\dots';
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const boundName = (a: Analysis) => a.bigO.latex.replace(/\\log n/, '\\log_2 n');
/** "each does $1/16$ of the parent's work", or the d = 0 version where every call does 1 unit */
const eachDoes = (b: number, d: number) => (d === 0 ? 'each does 1 unit, the same as its parent' : `each does $1/${shortIntTex(BigInt(b) ** BigInt(d))}$ of the parent's work`);

/** "2·n/4 = n/2" for the root's calls on branch i */
function rootShareTex(a: Analysis, i: number) {
  const t = a.rec.terms[i];
  const d = a.rec.d;
  const prod = `${t.a}\\cdot ${workLatex(BigInt(t.b), d)}`;
  const val = coefNLatex(termRatio(t, d), d);
  return br(i, prod === val ? prod : `${prod} = ${val}`);
}

export function explain(e: Entity, ctx: ExplainCtx): Explanation {
  switch (e.kind) {
    case 'lhs':
      return explainLhs(ctx);
    case 'call':
      return explainCall(e.term, ctx);
    case 'fwork':
      return explainFwork(ctx);
    case 'coef':
      return explainCoef(e.term, ctx);
    case 'div':
      return explainDiv(e.term, ctx);
    case 'exp':
      return explainExp(ctx);
    case 'rterm':
      return explainRterm(e.term, ctx);
    case 'r':
      return explainR(ctx);
    case 'node':
      return explainNode(e.path, ctx);
    case 'tuple':
      return explainTuple(e.level, BigInt(e.den), ctx);
    case 'level':
      return explainLevel(e.level, ctx);
    case 'leafrow':
      return explainLeaves(ctx);
    case 'step':
      return explainStep(e.id, ctx);
    case 'answer':
      return explainAnswer(ctx);
    case 'sum':
      return explainSum(ctx);
  }
}

/* ------------------------------------------------------------------ */
/* Short tooltips for the parts of the formula                         */
/* ------------------------------------------------------------------ */

export interface PartTip {
  /** rich text: what this part is called, with its live value */
  name: string;
  /** rich text: one or two sentences, with the live values */
  body: string;
  editable: boolean;
  /** for non-editable parts: which numbers inside it can be edited */
  editHint?: string;
}

export function partTip(e: Entity, a: Analysis): PartTip | null {
  const { terms, d } = a.rec;
  const nd = ndOf(a);
  switch (e.kind) {
    case 'lhs':
      return {
        name: `$T(n)$ · the total cost`,
        body: `The total work to solve an input of size $n$, counting every recursive call. This is what we are solving for.`,
        editable: false,
        editHint: 'Not editable: change the numbers on the right instead.',
      };
    case 'call': {
      const t = terms[e.term];
      return {
        name: `$${br(e.term, callTex(a, e.term))}$ · recursive ${plural(t.a, 'call')}`,
        body: `${t.a === 1 ? 'One call' : `${t.a} calls`} to the same algorithm, ${t.a === 1 ? 'on' : 'each on'} $n/${t.b}$ (${pieceOfInput(t.b)}). ${t.a === 1 ? 'It splits' : 'They split'} up the same way, which builds the tree.`,
        editable: false,
        editHint: `Edit the ${t.a} or the ${t.b} to change it.`,
      };
    }
    case 'fwork':
      return {
        name: `$${nd}$ · the non-recursive work`,
        body: `The work each call does itself, outside its recursive calls. A call on size $m$ ${workOfSizeM(d)}: ${workKind(d)} work.`,
        editable: false,
        editHint: `Edit the exponent ${d} to change it.`,
      };
    case 'coef': {
      const t = terms[e.term];
      return {
        name: `$${br(e.term, `${sym(a, 'a', e.term)} = ${t.a}`)}$ · number of calls`,
        body: `Each call makes ${t.a} recursive ${plural(t.a, 'call')} on $n/${t.b}$.${t.a === 1 ? ' A 1 in front is usually left unwritten.' : ''}`,
        editable: true,
      };
    }
    case 'div': {
      const t = terms[e.term];
      return {
        name: `$${br(e.term, `${sym(a, 'b', e.term)} = ${t.b}`)}$ · shrink factor`,
        body: `${t.a === 1 ? 'This call gets' : 'Each of these calls gets'} ${pieceOfInput(t.b)}: size $n/${t.b}$.`,
        editable: true,
      };
    }
    case 'exp':
      return {
        name: `$d = ${d}$ · power of the non-recursive work`,
        body: `Makes the non-recursive work $n^{${d}}${d === 1 ? ' = n' : d === 0 ? ' = 1' : ''}$ (${workKind(d)}).${d === 1 ? ' An exponent of 1 is usually left unwritten.' : ''}`,
        editable: true,
      };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* The formula's parts                                                 */
/* ------------------------------------------------------------------ */

function explainLhs(ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  return {
    title: '$T(n)$: the total cost',
    sections: [
      { h: 'What it is', body: `The total work needed to solve an input of size $n$, counting every recursive call all the way down. This is the unknown we are solving for.` },
      {
        h: 'Why this value',
        body: `The right-hand side says where the work comes from. A call on size $n$ makes ${callsList(a.rec, { colour: true })}, then does ${ownWork(a.rec.d)} of its own. Each recursive call is again a $T(\\cdot)$ of a smaller size, so the calls form a tree.`,
      },
      {
        h: 'What it feeds',
        body: locked
          ? `Adding up the work in the tree, level by level, gives $T(n)$. ${LOCKED_NOTE}`
          : `Adding up the work in the tree, level by level, gives $T(n) = ${bigOTex(a)}$.`,
      },
    ],
    next: { label: 'Start the solution, step 1', entity: { kind: 'step', id: 'read' } },
  };
}

function explainCall(i: number, ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  const t = a.rec.terms[i];
  const d = a.rec.d;
  const multi = a.rec.terms.length > 1;
  const one = t.a === 1;
  const grandkids = one ? `, which has 1 child of size $n/${t.b * t.b}$, and so on` : `, which have ${shortInt(BigInt(t.a) ** 2n)} children of size $n/${t.b * t.b}$, and so on`;
  return {
    title: `$${br(i, callTex(a, i))}$: recursive ${plural(t.a, 'call')}`,
    sections: [
      { h: 'What it is', body: `${one ? 'One call' : `${t.a} calls`} to the same algorithm, ${one ? 'on' : 'each on'} an input of size $n/${t.b}$ (${pieceOfInput(t.b)}).` },
      {
        h: 'Why this value',
        body: `$T(n/${t.b})$ means "the total cost of solving an input of size $n/${t.b}$". ${
          one ? `With no number in front there is just 1 such call` : `The ${t.a} in front says there are ${t.a} such calls`
        }, so this part costs $${one ? '' : `${t.a}\\cdot `}T(n/${t.b})$. Each of those calls splits up in the same way, so the root has ${t.a} ${BRANCH_COLOUR[i]} ${plural(t.a, 'child', 'children')} of size $n/${t.b}$${multi ? '' : grandkids}.`,
      },
      {
        h: 'What it feeds',
        body: locked
          ? `The ${BRANCH_COLOUR[i]} edges in the tree are these calls. ${LOCKED_NOTE}`
          : `The ${BRANCH_COLOUR[i]} edges in the tree are these calls. ${one ? `The root's 1 call on $n/${t.b}$ does` : `Together the root's ${t.a} calls on $n/${t.b}$ do`} $${rootShareTex(a, i)}$ work${
              d === 0 ? '' : ` (${t.a} × $1/${shortIntTex(BigInt(t.b) ** BigInt(d))}$ of the root's)`
            }, so this term's share of $r$ is $${rTermTex(t, d, i)}$.`,
      },
    ],
    next: { label: `Next: the ${t.a} in front`, entity: { kind: 'coef', term: i } },
  };
}

function explainFwork(ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  const { terms, d } = a.rec;
  const nd = ndOf(a);
  const sizes = [1n, ...terms.map((t) => BigInt(t.b))];
  const up = whatIf(a.rec, (r) => void (r.d += 1));
  const down = whatIf(a.rec, (r) => void (r.d -= 1));
  return {
    title: `$${nd}$: the non-recursive work`,
    sections: [
      {
        h: 'What it is',
        body: `The work one call does by itself, outside its recursive calls (${workExample(d)}). Here a call on size $m$ ${workOfSizeM(d)}: ${workKind(d)} work.`,
      },
      {
        h: 'Why this value',
        body:
          d === 0
            ? `It is $n^0 = 1$: every call does 1 unit of work, from the root down to the smallest call.`
            : `Plug in the sizes from the tree: $${sizes.map((s, i) => (i === 0 ? fAt(s, d) : br(i - 1, fAt(s, d)))).join(',\\ ')}$. The root does the most, and every smaller call does less.`,
      },
      {
        h: 'What it feeds',
        body: `This is the only place work actually gets done. The $T(\\cdot)$ terms just hand the rest to smaller calls. Adding this up over every call in the tree gives $T(n)$. ${
          locked ? LOCKED_NOTE : [whatIfSentence(`With $n^{${d + 1}}$ instead`, up), whatIfSentence(`With $n^{${d - 1}}$`, down)].filter(Boolean).join(' ')
        }`,
      },
    ],
    next: { label: `Next: the exponent d = ${d}`, entity: { kind: 'exp' } },
  };
}

function explainCoef(i: number, ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  const { terms, d } = a.rec;
  const t = terms[i];
  const multi = terms.length > 1;
  const tot = a.branching;
  const levels = [1n, tot, tot ** 2n, tot ** 3n].map(shortInt).join(', ');
  const up = whatIf(a.rec, (r) => void (r.terms[i].a += 1));
  const down = whatIf(a.rec, (r) => void (r.terms[i].a -= 1));
  const why = multi
    ? `With the other ${plural(Number(tot) - t.a, 'call')} (${joinAnd(terms.filter((_, j) => j !== i).map((u) => `${u.a} on $n/${u.b}$`))}), every call has $${terms.map((u, j) => br(j, String(u.a))).join(' + ')} = ${tot}$ children. So the levels have ${levels}, … calls.`
    : t.a === 1
      ? `With $a = 1$ each call makes just one call, so the tree is a single path: 1 call on every level.`
      : `So the tree branches ${t.a} ways: the levels have ${levels}, … calls ($${t.a}^{\\ell}$ on level $\\ell$).`;
  return {
    title: `$${br(i, `${sym(a, 'a', i)} = ${t.a}`)}$: number of calls`,
    sections: [
      { h: 'What it is', body: `The ${t.a} in $${br(i, callTex(a, i))}$${t.a === 1 ? ' (a 1 in front is usually left unwritten)' : ''}: each call makes ${t.a} recursive ${plural(t.a, 'call')} on $n/${t.b}$.` },
      { h: 'Why this value', body: why },
      {
        h: 'What it feeds',
        body: locked
          ? `More calls means more work on every level below. ${LOCKED_NOTE}`
          : `It is the top of this branch's share of $r$: $${rTermTex(t, d, i)}$ = (${t.a} ${plural(t.a, 'call')}) × (${eachDoes(t.b, d)}). ${[whatIfSentence(`With ${t.a + 1} calls`, up), t.a > 1 ? whatIfSentence(`With ${t.a - 1}`, down) : ''].filter(Boolean).join(' ')}`,
      },
    ],
    next: NEXT_R,
  };
}

function explainDiv(i: number, ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  const { terms, d } = a.rec;
  const t = terms[i];
  const multi = terms.length > 1;
  const ex = exampleN(a);
  const nEx = `$n = ${shortIntTex(ex.n)}$`;
  const depthWords = multi
    ? t.b === a.minB
      ? `This is the slowest-shrinking branch, so it makes the deepest path: $\\log_{${t.b}} n$ levels (${logOfExample(ex.n, t.b)} for ${nEx}).`
      : `Always dividing by ${t.b}, a path reaches size 1 after $\\log_{${t.b}} n$ levels (${logOfExample(ex.n, t.b)} for ${nEx}), sooner than the slowest branch.`
    : `Dividing by ${t.b} each level, the size reaches 1 after $\\log_{${t.b}} n$ levels (${logOfExample(ex.n, t.b)} for ${nEx}).`;
  const up = whatIf(a.rec, (r) => void (r.terms[i].b += 1));
  const down = whatIf(a.rec, (r) => void (r.terms[i].b -= 1));
  const bd = shortIntTex(BigInt(t.b) ** BigInt(d));
  const fraction = d === 1 ? `$\\frac{1}{${t.b}}$` : `$1/${t.b}^{${d}} = \\frac{1}{${bd}}$`;
  return {
    title: `$${br(i, `${sym(a, 'b', i)} = ${t.b}`)}$: shrink factor`,
    sections: [
      { h: 'What it is', body: `The ${t.b} in $${br(i, `T(n/${t.b})`)}$: ${t.a === 1 ? 'this call gets' : `each of these ${t.a} calls gets`} ${pieceOfInput(t.b)}, size $n/${t.b}$.` },
      {
        h: 'Why this value',
        body:
          d === 0
            ? `With $d = 0$ a call on $n/${t.b}$ still does 1 unit of work, so $b$ doesn't change the work per call. ${depthWords}`
            : `A call on $n/${t.b}$ does $${fAt(BigInt(t.b), d)}$ work, which is ${fraction} of what its parent does on $n$. ${depthWords}`,
      },
      {
        h: 'What it feeds',
        body: locked
          ? `Smaller pieces mean less work per call. ${LOCKED_NOTE}`
          : d === 0
            ? `Since $d = 0$, $b$ does not appear in $r$: it changes the depth, not the ratio between levels.`
            : `${d === 1 ? `The ${t.b}` : `$${t.b}^{${d}} = ${bd}$`} is the bottom of this branch's share of $r$: $${rTermTex(t, d, i)}$. ${[whatIfSentence(`With $n/${t.b + 1}$`, up), t.b > 2 ? whatIfSentence(`With $n/${t.b - 1}$`, down) : ''].filter(Boolean).join(' ')}`,
      },
    ],
    next: NEXT_R,
  };
}

function explainExp(ctx: ExplainCtx): Explanation {
  const { a, locked } = ctx;
  const { terms, d } = a.rec;
  const nd = ndOf(a);
  const up = whatIf(a.rec, (r) => void (r.d += 1));
  const down = whatIf(a.rec, (r) => void (r.d -= 1));
  const perBranch = terms.map((t, i) => `a call on $${br(i, `n/${t.b}`)}$ does $${fAt(BigInt(t.b), d)}$${d === 0 ? '' : ` ($1/${shortIntTex(BigInt(t.b) ** BigInt(d))}$ as much)`}`);
  return {
    title: `$d = ${d}$: power of the non-recursive work`,
    sections: [
      {
        h: 'What it is',
        body: `${d === 1 ? 'The exponent in $n^1$, which is usually written just $n$' : `The ${d} in $n^{${d}}$`}: a call on size $m$ ${workOfSizeM(d)}, outside its recursive calls.`,
      },
      { h: 'Why this value', body: d === 0 ? `The root does 1 unit of work, and so does every smaller call.` : `The root does $${nd}$. ${joinAnd(perBranch).replace(/^a/, 'A')}.` },
      {
        h: 'What it feeds',
        body: locked
          ? `A bigger $d$ makes the top of the tree heavier compared with the rest. ${LOCKED_NOTE}`
          : `${
              d === 0 ? `With $d = 0$, $b^0 = 1$, so each share of $r$ is just its number of calls.` : `$d$ is in every share of $r = ${rSumTex(a)}$: each share is (calls) ÷ $b${d === 1 ? '' : `^{${d}}`}$.`
            } ${[whatIfSentence(`With $d = ${d + 1}$`, up), whatIfSentence(`With $d = ${d - 1}$`, down)].filter(Boolean).join(' ')}`,
      },
    ],
    next: NEXT_R,
  };
}

/* ------------------------------------------------------------------ */
/* r and its parts                                                     */
/* ------------------------------------------------------------------ */

function pct(a: Analysis, i: number) {
  return `${Math.round((100 * Number(a.termRatios[i].num)) / Number(a.termRatios[i].den) / a.rNumber)}%`;
}

function explainRterm(i: number, ctx: ExplainCtx): Explanation {
  const { a } = ctx;
  const { terms, d } = a.rec;
  const t = terms[i];
  const each = d === 0 ? `${t.a} ${plural(t.a, 'call')}, each doing 1 unit like the root` : `${t.a} ${plural(t.a, 'call')} × $1/${shortIntTex(BigInt(t.b) ** BigInt(d))}$ each`;
  return {
    title: `Branch share $${rTermTex(t, d, i)}$`,
    sections: [
      { h: 'What it is', body: `How much work this branch's calls do, compared with the call that made them.` },
      {
        h: 'Why this value',
        body: `The root does ${ownWork(d)}. ${
          t.a === 1
            ? `Its 1 call on $n/${t.b}$ does $${rootShareTex(a, i)}$.`
            : `Its ${t.a} calls on $n/${t.b}$ each do $${workLatex(BigInt(t.b), d)}$, so together they do $${rootShareTex(a, i)}$.`
        } That is ${timesWords(a.termRatios[i], "the root's work")}: ${each}.`,
      },
      {
        h: 'What it feeds',
        body: `Adding every branch's share gives $${rFullTex(a)}$.${terms.length > 1 ? ` In the bars, the ${BRANCH_COLOUR[i]} part is ${pct(a, i)} of every level after the root.` : ''}`,
      },
    ],
    next: NEXT_R,
  };
}

function explainR(ctx: ExplainCtx): Explanation {
  const { a } = ctx;
  const { terms } = a.rec;
  const r = rTex(a);
  const t0 = terms[0];
  const children =
    terms.length > 1
      ? `Its children: ${joinAnd(terms.map((t, i) => `the ${calls(t.a)} on $${br(i, `n/${t.b}`)}$ ${does(t.a)} $${rootShareTex(a, i)}$`))}. In total that is $${levelTotalTex(a.rec, 1)}$, which is ${timesWords(a.r, "the root's work")}.`
      : `Its ${calls(t0.a)} on $n/${t0.b}$ ${does(t0.a)} $${levelSumTex(a.rec, 1)}$${t0.a === 1 ? '' : ' in total'}, which is ${timesWords(a.r, "the root's work")}.`;
  const every = a.case === 'equal' ? 'every level matches the one above' : `every level is $${r}$ times the one above`;
  const feeds =
    a.case === 'root'
      ? `The level totals shrink going down: $${firstTotals(a)}$ Since $r < 1$, the root's level is the biggest, so $T(n) = ${bigOTex(a)}$.`
      : a.case === 'equal'
        ? `Every level has the same total: $${firstTotals(a)}$ So the answer is one level's work times the number of levels: $T(n) = ${bigOTex(a)}$.`
        : `The level totals grow going down: $${firstTotals(a)}$ Since $r > 1$, the bottom of the tree is the biggest, so $T(n) = ${bigOTex(a)}$.`;
  return {
    title: `The ratio $${rEqTex(a)}$`,
    sections: [
      { h: 'What it is', body: `How many times as much work each level does as the level above it.` },
      {
        h: 'Why this value',
        body: `Start at the root, which does ${ownWork(a.rec.d)}. ${children} Every call's children compare to it the same way, so ${every}: $${rFullTex(a)}$.`,
      },
      { h: 'What it feeds', body: feeds },
      {
        h: 'Check it',
        body: `Level 2 is $${levelSumTex(a.rec, 2)}$, and $${levelRatioTex(a.rec, a.r)}$ again.`,
      },
    ],
    next: NEXT_ANSWER,
  };
}

/* ------------------------------------------------------------------ */
/* Tree and table                                                      */
/* ------------------------------------------------------------------ */

function pathTex(a: Analysis, path: string) {
  if (!path) return '';
  return pathBranches(path)
    .map((i) => br(i, `\\div ${a.rec.terms[i].b}`))
    .join('\\;');
}

function explainNode(path: string, ctx: ExplainCtx): Explanation {
  const { a, concrete } = ctx;
  const { d, terms } = a.rec;
  const level = pathLevel(path);
  const den = pathDen(a.rec, path);
  const tuple = levelTuples(a.rec, level).find((t) => t.den === den)!;
  const size = sizeLatex(den);
  const work = workLatex(den, d);
  const concreteSize = concrete ? concrete.n / Number(den) : null;
  const concreteLeaf = concreteSize !== null && concreteSize <= 1;
  const kids = terms.map((t, i) => br(i, `${t.a === 1 ? '' : t.a}T(${sizeLatex(den * BigInt(t.b))})`)).join(' + ');
  const kidWork = terms.map((t, i) => br(i, `${t.a}\\cdot ${workLatex(den * BigInt(t.b), d)}`)).join(' + ');
  const kidTotal = coefNEq(mul(nodeWorkCoef(den, d), a.r), d);
  const oneKid = a.branching === 1n;
  const makes = oneKid ? `It makes one call, $${kids}$, which does` : `It makes the calls $${kids}$. Together they do`;
  const tupleWords =
    tuple.count === 1n
      ? level === 0
        ? `It is the only call on level 0: the tuple $(${work}, 1)$.`
        : `It is the only call of this size on level ${level}: the tuple $(${work}, 1)$.`
      : `It is one of $${shortIntTex(tuple.count)}$ calls of this size on level ${level}: the tuple $(${work}, ${shortIntTex(tuple.count)})$.`;
  return {
    title: level === 0 ? 'The root: the original call' : `A call on level ${level}`,
    sections: [
      {
        h: 'What it is',
        body:
          level === 0
            ? `The original call, on the whole input of size $n${concrete ? ` = ${shortIntTex(concrete.n)}` : ''}$.`
            : `One recursive call. Starting from $n$, its path divides by $${pathTex(a, path)}$, so its size is $${size}${concreteSize !== null ? ` = ${shortNumTex(concreteSize)}` : ''}$.`,
      },
      {
        h: 'Why this value',
        body: concreteLeaf
          ? `Its size is at most 1, so it is a base case: it does 1 unit of work and makes no more calls.`
          : `It does $${fAt(den, d)}${concreteSize !== null && d > 0 ? ` = ${shortNumTex(Math.pow(concreteSize, d))}` : ''}$ work outside its recursive calls. ${tupleWords}`,
      },
      {
        h: 'What it feeds',
        body: concreteLeaf
          ? `Leaves end the recursion. Their count sets the bottom level's total.`
          : ctx.locked
            ? `${oneKid ? `It makes one call, $${kids}$, which does` : `It makes the calls $${kids}$, which do`} $${kidWork}$ work. Compare that with this call's own $${work}$: that comparison is your prediction.`
            : `${makes} $${kidWork} ${kidTotal}$ work, ${
                a.case === 'equal' ? `the same as this call's own $${work}$ ($r = 1$)` : `which is $${rEqTex(a)}$ times this call's own $${work}$`
              }. Every call repeats this pattern.`,
      },
    ],
    next: { label: `See level ${level}'s total`, entity: { kind: 'level', level } },
  };
}

function compositionWords(a: Analysis, ks: number[], orderings: bigint, coef: bigint) {
  const { terms } = a.rec;
  const steps = ks
    .map((k, i) => (k ? `$${br(i, `\\div ${terms[i].b}`)}$ ${k === 1 ? 'once' : k === 2 ? 'twice' : `${k} times`}` : ''))
    .filter(Boolean);
  const factors = ks.map((k, i) => (k ? `${br(i, String(terms[i].a))}^{${k}}` : '')).filter(Boolean).join('\\cdot ');
  return `taking ${joinAnd(steps)}, in any of ${shortInt(orderings)} ${plural(orderings, 'order')}: $${shortIntTex(orderings)} \\times ${factors} = ${shortIntTex(orderings * coef)}$`;
}

function explainTuple(level: number, den: bigint, ctx: ExplainCtx): Explanation {
  const { a, concrete } = ctx;
  const { d, terms } = a.rec;
  const t = levelTuples(a.rec, level).find((x) => x.den === den);
  const work = workLatex(den, d);
  if (!t) return { title: 'Tuple', sections: [{ h: 'What it is', body: 'This size does not occur at this level.' }] };
  const multi = terms.length > 1;
  const one = t.count === 1n;
  const N = shortIntTex(t.count);
  const how =
    level === 0
      ? `The root is the only call on level 0.`
      : !multi
        ? terms[0].a === 1
          ? `Each call makes 1 call, so level ${level} has just 1 call.`
          : `Each level multiplies the number of calls by $a = ${terms[0].a}$, so level ${level} has $${terms[0].a}^{${level}} = ${N}$ calls.`
        : (tupleCountWords(a.rec, level, den) ??
          `Every path to size $${sizeLatex(den)}$ is ${t.parts.map((p) => compositionWords(a, p.ks, p.orderings, p.coefProduct)).join('; or ')}${t.parts.length > 1 ? `, for $${N}$ in all` : ''}.`);
  const ct = concrete?.levels[level]?.tuples.find((x) => x.den === den);
  const contrib = coefNEq(tupleTotalCoef(t, d), d);
  return {
    title: `Tuple $(${work}, ${N})$ on level ${level}`,
    sections: [
      {
        h: 'What it is',
        body: `${one ? '1 call' : `$${N}$ calls`} of size $${sizeLatex(den)}$ on level ${level}, ${one ? 'doing' : 'each doing'} $${fAt(den, d)}$ work. A tuple lists (work per call, number of calls).`,
      },
      { h: 'Why this value', body: how },
      {
        h: 'What it feeds',
        body: `${one ? 'It does' : 'Together they do'} $${N} \\cdot ${work} ${contrib}$${ct ? ` (${shortNum(ct.count * ct.work)} for $n = ${shortIntTex(concrete!.n)}$)` : ''}, part of level ${level}'s total of $${levelTotalTex(a.rec, level)}$.`,
      },
    ],
    next: { label: `See level ${level}'s total`, entity: { kind: 'level', level } },
  };
}

function explainLevel(level: number, ctx: ExplainCtx): Explanation {
  const { a, concrete } = ctx;
  const total = levelTotalCoef(a.rec, level);
  const cl = concrete?.levels[level];
  const prevC = level > 0 ? concrete?.levels[level - 1] : undefined;
  const nodes = nodesAtLevel(a.rec, level);
  const check =
    cl && concrete
      ? prevC
        ? `With $n = ${shortIntTex(concrete.n)}$ the ${calls(cl.nodes)} on this level ${does(cl.nodes)} ${shortNum(cl.total)} work in total. The level above did ${shortNum(prevC.total)}, a ratio of ${shortNum(cl.total / prevC.total)}${
            Math.abs(cl.total / prevC.total - a.rNumber) > 0.01
              ? `. That differs from $r$ near the bottom, because some paths have already reached size 1 and stopped, and a base case does 1 unit of work even when its (fractional) size is below 1`
              : ', matching $r$'
          }.`
        : `With $n = ${shortIntTex(concrete.n)}$ this level does ${shortNum(cl.total)} work.`
      : null;
  const vsRoot = cmp(a.r, ONE) === 0 ? `Its bar is as long as the root's, because $r = 1$.` : `Its bar is $${qPowTex(a.r, level)} ${eqTex(total)}$ times as long as the root's.`;
  return {
    title: `Level ${level}: total $${levelTotalTex(a.rec, level)}$`,
    sections: [
      {
        h: 'What it is',
        body: `All the work done by the $${shortIntTex(nodes)}$ ${plural(nodes, 'call')} on level ${level}, not counting the calls ${nodes === 1n ? 'it makes' : 'they make'}.`,
      },
      {
        h: 'Why this value',
        body: `Multiply each size's call count by the work per call, and add: $${levelSumTex(a.rec, level)}$.${
          level > 0 ? ` That is ${timesWords(a.r, `level ${level - 1}'s $${levelTotalTex(a.rec, level - 1)}$`)}.` : ''
        }`,
      },
      {
        h: 'What it feeds',
        body: level === 0 ? `The root's bar is the reference length; every other bar is measured against it.` : vsRoot,
      },
      ...(check ? [{ h: 'Check it' as const, body: check }] : []),
    ],
    next: NEXT_R,
  };
}

function explainLeaves(ctx: ExplainCtx): Explanation {
  const { a } = ctx;
  const s = derivation(a).find((x) => x.id === 'leaves')!;
  return {
    title: 'The leaves',
    sections: [
      { h: 'What it is', body: `The base cases at the bottom of the tree: calls on size 1 that do a constant amount of work and make no more calls.` },
      { h: 'Why this value', body: s.note },
      ...(s.check ? [{ h: 'Check it' as const, body: s.check }] : []),
      {
        h: 'What it feeds',
        body:
          a.case === 'leaves'
            ? `Since $${rEqTex(a)} > 1$, the bottom of the tree does the most work, so the leaf count is the answer: $${bigOTex(a)}$.`
            : a.case === 'root'
              ? `Since $${rEqTex(a)} < 1$, the leaves do less work than the root, so they don't decide the answer.`
              : `Since $r = 1$, the leaves do the same work as every other level, so they don't decide the answer on their own.`,
      },
    ],
    next: NEXT_ANSWER,
  };
}

function explainStep(id: StepId, ctx: ExplainCtx): Explanation {
  const { a } = ctx;
  const steps = derivation(a);
  const i = steps.findIndex((s) => s.id === id);
  const s = steps[i];
  const nxt = steps[i + 1];
  return {
    title: `Step ${i + 1}: ${s.title}`,
    sections: [
      { h: 'What it is', body: s.note },
      { h: 'Why this value', body: s.why },
      ...(s.check ? [{ h: 'Check it' as const, body: s.check }] : []),
      { h: 'What it feeds', body: nxt ? `Next, step ${i + 2}: ${nxt.title.toLowerCase()}.` : `This is the end of the solution: $T(n) = ${bigOTex(a)}$.` },
    ],
    next: nxt ? { label: `Next: ${nxt.title}`, entity: { kind: 'step', id: nxt.id } } : undefined,
  };
}

function explainAnswer(ctx: ExplainCtx): Explanation {
  const { a, concrete } = ctx;
  const s = derivation(a).find((x) => x.id === 'answer')!;
  const r = rTex(a);
  // one sentence on which levels matter, then the final step's reasoning
  const lead =
    a.case === 'root'
      ? `Each level is $${r}$ of the one above, so the root's level is the biggest. `
      : a.case === 'leaves'
        ? `Each level is $${r}$ times the one above, so the bottom level is the biggest. `
        : '';
  return {
    title: `$T(n) = ${bigOTex(a)}$`,
    sections: [
      { h: 'What it is', body: `The total work of the whole tree, up to a constant factor.` },
      { h: 'Why this value', body: `${lead}${s.note}` },
      {
        h: 'Check it',
        body: concrete
          ? `For $n = ${shortIntTex(concrete.n)}$ the tree's levels add up to ${shortNum(concrete.sum)}, and $${boundName(a)} = ${shortNumTex(concrete.bound)}$: a ratio of ${shortNum(concrete.sum / concrete.bound)}. Move the $n$ slider and the ratio should stay roughly the same.`
          : (s.check ?? ''),
      },
    ],
    next: { label: 'Why: the ratio r', entity: { kind: 'r' } },
  };
}

function explainSum(ctx: ExplainCtx): Explanation {
  const { a, concrete } = ctx;
  if (!concrete) return explainAnswer(ctx);
  const totals = concrete.levels.map((l) => l.total);
  return {
    title: `Sum of all levels for $n = ${shortIntTex(concrete.n)}$`,
    sections: [
      { h: 'What it is', body: `The exact work of the whole tree at this $n$: every level's total, added up.` },
      { h: 'Why this value', body: `${totals.slice(0, 6).map(shortNum).join(' + ')}${totals.length > 6 ? ' + …' : ''} = ${shortNum(concrete.sum)}, over ${concrete.levels.length} levels.` },
      {
        h: 'What it feeds',
        body: `Compare with $${boundName(a)} = ${shortNumTex(concrete.bound)}$. If the Big-O is right, the ratio between them (${shortNum(concrete.sum / concrete.bound)}) stays bounded as $n$ grows.`,
      },
    ],
    next: NEXT_ANSWER,
  };
}

