import { toLatex } from '../math/rational';
import type { Analysis, Case } from '../math/recurrence';
import { useHl, useLearnable } from '../state/selection';
import { bigOTex, rTermTex, rValueTex } from '../explain/tex';
import { Rich, Tex } from './Tex';

const CASE_LABEL: Record<Case, string> = { root: 'The root', equal: 'All levels equally', leaves: 'The leaves' };
const CASE_SUB: Record<Case, string> = { root: 'top level', equal: 'same work everywhere', leaves: 'bottom level' };

export function RStrip({ a }: { a: Analysis }) {
  const rLearn = useLearnable({ kind: 'r' });
  const rHl = useHl(['r']);
  const ansLearn = useLearnable({ kind: 'answer' });
  const ansHl = useHl(['answer']);
  // single term with d <= 1: the term "3/2" already is the value; only add "≈ 1.5"
  const t0 = a.rec.terms[0];
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  const redundant = a.rec.terms.length === 1 && (a.rec.d === 0 || (a.rec.d === 1 && gcd(t0.a, t0.b) === 1));
  const verdict = a.case === 'root' ? 'totals shrink, the root dominates' : a.case === 'equal' ? 'every level does equal work' : 'totals grow, the leaves dominate';
  return (
    <section className={`rstrip case-${a.case}`} aria-label="The ratio r and the answer">
      <div className="rstrip-r">
        <span className={`r-symbol hl-${rHl || 'none'}`} {...rLearn} aria-label={`r equals ${toLatex(a.r)}`}>
          <Tex tex="r" />
        </span>
        <span className="r-eq">=</span>
        {a.rec.terms.map((t, i) => (
          <RTerm key={i} i={i} tex={rTermTex(t, a.rec.d, i)} last={i === a.rec.terms.length - 1} />
        ))}
        {!redundant && <span className="r-eq">=</span>}
        <span className={`r-value hl-${rHl || 'none'}`} {...rLearn} aria-hidden>
          <Tex tex={redundant ? rValueTex(a.r).replace(/^.*?(\\approx|$)/, '$1') : rValueTex(a.r)} />
        </span>
      </div>
      <div className="rstrip-verdict">
        <CaseGlyph c={a.case} />
        <span className="verdict-text">
          <Tex tex={`r ${a.case === 'root' ? '<' : a.case === 'equal' ? '=' : '>'} 1`} />: {verdict}
        </span>
        <span className={`answer-pill hl-${ansHl || 'none'}`} {...ansLearn} aria-label={`Answer: ${a.bigO.text}`}>
          <Tex tex={`T(n) = ${bigOTex(a)}`} />
        </span>
      </div>
    </section>
  );
}

function RTerm({ i, tex, last }: { i: number; tex: string; last: boolean }) {
  const learn = useLearnable({ kind: 'rterm', term: i });
  const hl = useHl([`rterm:${i}`]);
  return (
    <>
      <span className={`r-term hl-${hl || 'none'}`} {...learn} aria-label={`Branch ${i + 1} share`}>
        <Tex tex={tex} />
      </span>
      {!last && <span className="r-eq">+</span>}
    </>
  );
}

/** Tiny bar glyph: shrinking / flat / growing */
export function CaseGlyph({ c }: { c: Case }) {
  const ws = c === 'root' ? [16, 11, 7, 4] : c === 'equal' ? [12, 12, 12, 12] : [4, 7, 11, 16];
  return (
    <svg className="case-glyph" viewBox="0 0 18 18" aria-hidden>
      {ws.map((w, i) => (
        <rect key={i} x={1} y={1 + i * 4.3} width={w} height={3} rx={1.2} />
      ))}
    </svg>
  );
}

export type PredictState = { phase: 'ask'; hint: number } | { phase: 'feedback'; guess: Case };

export function PredictCard({ a, state, onGuess, onHint, onDone, onDisable }: {
  a: Analysis;
  state: PredictState;
  onGuess: (c: Case) => void;
  onHint: () => void;
  onDone: () => void;
  onDisable: () => void;
}) {
  if (state.phase === 'ask')
    return (
      <section className="predict" aria-label="Make a prediction">
        <div className="predict-q">
          <strong>Predict first:</strong> which part of this tree does the most work?
          <span className="muted small"> Look at the tree, or add up a level yourself.</span>
        </div>
        <div className="predict-options" role="group" aria-label="Your prediction">
          {(['root', 'equal', 'leaves'] as Case[]).map((c) => (
            <button key={c} className="predict-btn" onClick={() => onGuess(c)}>
              <CaseGlyph c={c} />
              <span>
                {CASE_LABEL[c]}
                <small>{CASE_SUB[c]}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="predict-foot">
          {state.hint < 2 ? (
            <button className="link-btn" onClick={onHint}>
              Hint: show the first two level totals
            </button>
          ) : (
            <span className="muted small">Hint shown: compare level 0 and level 1 in the table.</span>
          )}
          <span className="spacer" />
          <button className="link-btn" onClick={onDone}>
            Skip
          </button>
          <button className="link-btn" onClick={onDisable}>
            Stop asking
          </button>
        </div>
      </section>
    );
  const right = state.guess === a.case;
  const r = toLatex(a.r);
  const barWord = a.case === 'root' ? `shrinks to $${r}$ of the one above` : a.case === 'equal' ? 'is exactly as long as the one above' : `grows to $${r}$ times the one above`;
  const winner = a.case === 'root' ? 'the root dominates' : a.case === 'equal' ? 'every level contributes equally' : 'the leaves dominate';
  const text = right
    ? `Right. $r = ${r} ${a.case === 'root' ? '<' : a.case === 'equal' ? '=' : '>'} 1$, so each bar ${barWord}: ${winner}. $T(n) = ${bigOTex(a)}$.`
    : `Not quite. You said ${CASE_LABEL[state.guess].toLowerCase()}, but $r = ${r}$${a.case === 'root' ? ' < 1' : a.case === 'equal' ? ' = 1' : ' > 1'}: each bar ${barWord}, so ${winner}. $T(n) = ${bigOTex(a)}$.`;
  return (
    <section className={`predict feedback ${right ? 'right' : 'wrong'}`} role="status" aria-live="polite">
      <span className="fb-icon" aria-hidden>
        {right ? '✓' : '↻'}
      </span>
      <Rich text={text} className="fb-text" />
      <button className="btn small" onClick={onDone} autoFocus>
        Got it
      </button>
    </section>
  );
}
