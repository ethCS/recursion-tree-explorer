import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConcreteSummary, NSlider } from './components/Concrete';
import { Derivation } from './components/Derivation';
import { ExplainPanel } from './components/ExplainPanel';
import { Formula } from './components/Formula';
import { Intro } from './components/Intro';
import { LevelPanel } from './components/LevelPanel';
import { TreeView } from './components/TreeView';
import { PredictCard, RStrip, type PredictState } from './components/Verdict';
import { PRESETS, randomRecurrence } from './math/random';
import { analyze, boundValue, concreteLevels, LIMITS, normalize, type Field, type Recurrence } from './math/recurrence';
import type { Entity } from './state/entities';
import { SelectionProvider } from './state/selection';
import { decodeHash, encodeHash } from './state/url';
import { useLocalSetting, useReducedMotion, useTheme } from './state/prefs';

const SYMBOLIC_LEVELS = 5;
// The project's page on the portfolio site, which links here. Override with
// VITE_PORTFOLIO_URL when hosting the explorer somewhere else.
const PORTFOLIO_URL = import.meta.env.VITE_PORTFOLIO_URL || 'https://eethan.com/projects/dsa';
const DEFAULT: Recurrence = PRESETS[3].rec;

export default function App() {
  const [rec, setRec] = useState<Recurrence>(() => decodeHash(window.location.hash) ?? DEFAULT);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [concreteOn, setConcreteOn] = useState(false);
  const [n, setN] = useState(256);
  const [predict, setPredict] = useState<PredictState | null>(null);
  const [predictEnabled, setPredictEnabled] = useLocalSetting('rte.predict', true);
  const [introSeen, setIntroSeen] = useLocalSetting('rte.intro', false);
  const [buildKey, setBuildKey] = useState(0);
  const [theme, cycleTheme] = useTheme();
  const reducedMotion = useReducedMotion();

  const analysis = useMemo(() => analyze(rec), [rec]);
  const concrete = useMemo(() => {
    if (!concreteOn) return null;
    const levels = concreteLevels(rec, n);
    const sum = levels.reduce((s, l) => s + l.total, 0);
    return { n, levels, sum, bound: boundValue(analysis.bigO, n) };
  }, [concreteOn, rec, n, analysis]);
  const shownLevels = concrete ? concrete.levels.length : SYMBOLIC_LEVELS;
  const treeMaxLevel = concrete ? Math.min(concrete.levels.length - 1, 12) : SYMBOLIC_LEVELS - 1;
  const locked = predict?.phase === 'ask';

  useEffect(() => {
    const h = encodeHash(rec);
    if (window.location.hash !== h) history.replaceState(null, '', h);
  }, [rec]);

  useEffect(() => {
    if (!mergeNote) return;
    const t = setTimeout(() => setMergeNote(null), 5000);
    return () => clearTimeout(t);
  }, [mergeNote]);

  const apply = useCallback((next: Recurrence, opts: { build?: boolean; ask?: boolean } = {}) => {
    const { rec: norm, merges } = normalize(next);
    setRec(norm);
    setMergeNote(merges.length ? `Merged ${merges.join('; ')}: calls of the same size are the same kind of call.` : null);
    // keep selections that still make sense; nodes, tuples and levels may no longer exist
    setSelected((s) => {
      if (!s) return s;
      if ('term' in s) return s.term < norm.terms.length ? s : null;
      return s.kind === 'node' || s.kind === 'tuple' || s.kind === 'level' ? null : s;
    });
    if (opts.build) setBuildKey((k) => k + 1);
    setPredict(opts.ask ? { phase: 'ask', hint: 0 } : null);
  }, []);

  const onEdit = (field: Field, term: number, value: number) => {
    const next = structuredClone(rec);
    if (field === 'd') next.d = value;
    else next.terms[term][field] = value;
    apply(next);
  };
  const onAddTerm = () => {
    const used = new Set(rec.terms.map((t) => t.b));
    let b = 2;
    while (used.has(b) && b < LIMITS.b.max) b++;
    apply({ ...rec, terms: [...rec.terms, { a: 1, b }] }, { build: false });
  };
  const onRemoveTerm = (i: number) => apply({ ...rec, terms: rec.terms.filter((_, j) => j !== i) });
  const randomize = () => {
    setSelected(null);
    apply(randomRecurrence(Math.random, rec), { build: true, ask: predictEnabled });
  };
  const loadPreset = (r: Recurrence) => {
    setSelected(null);
    apply(structuredClone(r), { build: true, ask: predictEnabled });
  };

  const activePreset = PRESETS.find((p) => JSON.stringify(p.rec) === JSON.stringify(rec))?.id;

  return (
    <SelectionProvider analysis={analysis} shownLevels={shownLevels} selected={selected} onSelect={setSelected}>
      <div className={`app ${selected ? 'has-explain' : ''}`}>
        <header className="topbar">
          <div className="brand">
            <a className="back-link" href={PORTFOLIO_URL} title="Back to the portfolio" aria-label="Back to the portfolio">
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
              <span className="back-label">Portfolio</span>
            </a>
            <Logo />
            <div>
              <div className="brand-name">Recursion Tree Explorer</div>
              <div className="brand-sub">Why one ratio decides every divide-and-conquer recurrence</div>
            </div>
          </div>
          <div className="top-actions">
            <div className="seg" role="radiogroup" aria-label="Show n as">
              <button role="radio" aria-checked={!concreteOn} className={!concreteOn ? 'on' : ''} onClick={() => setConcreteOn(false)}>
                Symbolic n
              </button>
              <button role="radio" aria-checked={concreteOn} className={concreteOn ? 'on' : ''} onClick={() => setConcreteOn(true)}>
                Concrete n
              </button>
            </div>
            <label className="switch" title="Ask for a prediction after Randomize or a preset">
              <input type="checkbox" checked={predictEnabled} onChange={(e) => setPredictEnabled(e.target.checked)} />
              <span className="switch-track" aria-hidden>
                <span className="switch-thumb" />
              </span>
              <span className="switch-label">Predict first</span>
            </label>
            <button className="icon-btn theme-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change.`} title={`Theme: ${theme}`}>
              <ThemeIcon theme={theme} />
            </button>
          </div>
        </header>

        <main className="main">
          <section className="hero" aria-label="Recurrence">
            <div className="toolbar" role="toolbar" aria-label="Examples">
              <span className="toolbar-label">Try</span>
              {PRESETS.map((p) => (
                <button key={p.id} className={`chip-btn ${activePreset === p.id ? 'on' : ''}`} onClick={() => loadPreset(p.rec)} title={p.note}>
                  {p.name}
                </button>
              ))}
              <button className="btn primary" onClick={randomize}>
                <DiceIcon /> Randomize
              </button>
            </div>
            <Formula rec={rec} analysis={analysis} onEdit={onEdit} onAddTerm={onAddTerm} onRemoveTerm={onRemoveTerm} />
            {mergeNote && (
              <div className="toast" role="status">
                {mergeNote}
              </div>
            )}
            {concreteOn && <NSlider n={n} onChange={setN} />}
          </section>

          {predict && <PredictCard a={analysis} state={predict} onGuess={(guess) => setPredict({ phase: 'feedback', guess })} onHint={() => setPredict({ phase: 'ask', hint: 2 })} onDone={() => setPredict(null)} onDisable={() => {
            setPredictEnabled(false);
            setPredict(null);
          }} />}
          {!locked && <RStrip a={analysis} />}

          <div className="workspace">
            <section className="panel tree-panel" aria-labelledby="tree-h">
              <div className="panel-head">
                <h2 id="tree-h">Recursion tree</h2>
                <p className="muted small">Each node: subproblem size and its own work. Drag to pan, scroll to zoom, ± to expand.</p>
              </div>
              <TreeView analysis={analysis} maxLevel={treeMaxLevel} concrete={concrete} buildKey={buildKey} reducedMotion={reducedMotion} />
            </section>
            <section className="panel levels-panel" aria-labelledby="levels-h">
              <div className="panel-head">
                <h2 id="levels-h">Work per level</h2>
                <p className="muted small">Bars are level totals. Their shape is the whole answer.</p>
              </div>
              <LevelPanel analysis={analysis} levels={SYMBOLIC_LEVELS} concrete={concrete} hidden={locked} hintLevels={predict?.phase === 'ask' ? predict.hint : 99} />
              {concrete && !locked && <ConcreteSummary a={analysis} n={concrete.n} sum={concrete.sum} levels={concrete.levels.length} />}
            </section>
          </div>

          <section className="panel derivation-panel" aria-labelledby="deriv-h">
            <div className="panel-head">
              <h2 id="deriv-h">Worked solution</h2>
              <p className="muted small">Every step uses this recurrence's own numbers. Click a step to see why it works.</p>
            </div>
            <Derivation a={analysis} hidden={locked} />
          </section>

          <footer className="footer">
            <p>
              Floors and ceilings are dropped throughout, so sizes like <i>n</i>/3 are treated as exact. In concrete mode a call on size ≤ 1 is a base case doing 1 unit of work.
            </p>
            <p>
              CSCI 332 final project ·{' '}
              <button className="link-btn" onClick={() => setIntroSeen(false)}>
                Show intro
              </button>
            </p>
          </footer>
        </main>

        <ExplainPanel ctx={{ a: analysis, concrete, locked }} locked={locked} />
        {!introSeen && <Intro onClose={() => setIntroSeen(true)} />}
      </div>
    </SelectionProvider>
  );
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="6" r="3.2" />
      <circle cx="8" cy="16" r="2.6" />
      <circle cx="24" cy="16" r="2.6" />
      <circle cx="4" cy="26" r="2" />
      <circle cx="12" cy="26" r="2" />
      <circle cx="20" cy="26" r="2" />
      <circle cx="28" cy="26" r="2" />
      <path d="M16 6L8 16M16 6l8 10M8 16l-4 10M8 16l4 10M24 16l-4 10M24 16l4 10" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 16 16" className="btn-icon" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <circle cx="5.5" cy="5.5" r="1" />
      <circle cx="10.5" cy="10.5" r="1" />
      <circle cx="8" cy="8" r="1" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === 'dark')
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" />
      </svg>
    );
  if (theme === 'light')
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5v11A5.5 5.5 0 008 2.5z" className="fill" />
    </svg>
  );
}
