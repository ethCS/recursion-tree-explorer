/**
 * Everything the user can click to learn about. Each entity has a stable key;
 * UI elements declare which keys they represent, and are highlighted when the
 * selected (or hovered) entity relates to one of those keys.
 */
import type { Analysis } from '../math/recurrence';
import { pathLastBranch, pathLevel } from '../tree/layout';

export type StepId =
  | 'read'
  | 'size'
  | 'count'
  | 'work'
  | 'total'
  | 'ratio'
  | 'pattern'
  | 'dominates'
  | 'depth'
  | 'leaves'
  | 'answer';

export const STEP_ORDER: StepId[] = ['read', 'size', 'count', 'work', 'total', 'ratio', 'pattern', 'dominates', 'depth', 'leaves', 'answer'];
/** Steps hidden while the user is making a prediction */
export const VERDICT_STEPS = new Set<StepId>(['total', 'ratio', 'pattern', 'dominates', 'leaves', 'answer']);

export type Entity =
  | { kind: 'lhs' }
  | { kind: 'call'; term: number }
  | { kind: 'fwork' }
  | { kind: 'coef'; term: number }
  | { kind: 'div'; term: number }
  | { kind: 'exp' }
  | { kind: 'rterm'; term: number }
  | { kind: 'r' }
  | { kind: 'node'; path: string }
  | { kind: 'tuple'; level: number; den: string }
  | { kind: 'level'; level: number }
  | { kind: 'leafrow' }
  | { kind: 'step'; id: StepId }
  | { kind: 'answer' }
  | { kind: 'sum' };

export function keyOf(e: Entity): string {
  switch (e.kind) {
    case 'coef':
    case 'div':
    case 'rterm':
    case 'call':
      return `${e.kind}:${e.term}`;
    case 'node':
      return `node:${e.path}`;
    case 'tuple':
      return `tuple:${e.level}:${e.den}`;
    case 'level':
      return `level:${e.level}`;
    case 'step':
      return `step:${e.id}`;
    default:
      return e.kind;
  }
}

/** Every key that should light up when `e` is selected. */
export function relatedKeys(e: Entity, a: Analysis, shownLevels: number): string[] {
  const m = a.rec.terms.length;
  const terms = [...Array(m).keys()];
  const levels = [...Array(shownLevels).keys()];
  const k = [keyOf(e)];
  switch (e.kind) {
    case 'lhs':
      return [...k, 'answer', 'step:read'];
    case 'call':
      return [...k, `coef:${e.term}`, `div:${e.term}`, `rterm:${e.term}`, `branch:${e.term}`, 'step:read'];
    case 'fwork':
      return [...k, 'exp', ...terms.map((i) => `rterm:${i}`), 'step:work'];
    case 'coef':
      return [...k, `call:${e.term}`, `rterm:${e.term}`, `branch:${e.term}`, 'step:read', 'step:count'];
    case 'div': {
      const extra = a.rec.terms[e.term].b === a.minB ? ['step:depth'] : [];
      return [...k, `call:${e.term}`, `rterm:${e.term}`, `branch:${e.term}`, 'step:read', 'step:size', ...extra];
    }
    case 'exp':
      return [...k, 'fwork', ...terms.map((i) => `rterm:${i}`), 'step:read', 'step:work', 'answer'];
    case 'rterm':
      return [...k, `coef:${e.term}`, `div:${e.term}`, 'exp', `branch:${e.term}`, 'r'];
    case 'r':
      return [...k, ...terms.map((i) => `rterm:${i}`), 'ratio-mark', 'step:ratio', 'step:pattern', ...levels.map((l) => `bar:${l}`)];
    case 'node': {
      const level = pathLevel(e.path);
      const branch = pathLastBranch(e.path);
      return [...k, `level:${level}`, ...(branch >= 0 ? [`branch-node:${branch}`] : [])];
    }
    case 'tuple':
      return [...k, `level:${e.level}`];
    case 'level':
      return [...k, `bar:${e.level}`, `total:${e.level}`];
    case 'leafrow':
      return [...k, 'step:leaves', 'step:depth'];
    case 'step':
      return [...k, ...stepRelated(e.id, a, levels)];
    case 'answer':
      return [...k, 'step:answer', 'r', 'step:dominates'];
    case 'sum':
      return [...k, 'answer', ...levels.map((l) => `total:${l}`)];
  }
}

function stepRelated(id: StepId, a: Analysis, levels: number[]): string[] {
  const terms = [...a.rec.terms.keys()];
  switch (id) {
    case 'read':
      return [...terms.flatMap((i) => [`coef:${i}`, `div:${i}`]), 'exp'];
    case 'size':
      return terms.map((i) => `div:${i}`);
    case 'count':
      return terms.map((i) => `coef:${i}`);
    case 'work':
      return ['exp'];
    case 'total':
      return levels.map((l) => `total:${l}`);
    case 'ratio':
      return ['r', ...terms.map((i) => `rterm:${i}`), 'ratio-mark'];
    case 'pattern':
      return [...levels.map((l) => `bar:${l}`), 'ratio-mark'];
    case 'dominates':
      return a.case === 'root' ? ['bar:0', 'level:0'] : a.case === 'leaves' ? ['leafrow', `bar:${levels.length - 1}`] : levels.map((l) => `bar:${l}`);
    case 'depth':
      return [...terms.filter((i) => a.rec.terms[i].b === a.minB).map((i) => `div:${i}`), 'leafrow'];
    case 'leaves':
      return ['leafrow'];
    case 'answer':
      return ['answer', 'r'];
  }
}
