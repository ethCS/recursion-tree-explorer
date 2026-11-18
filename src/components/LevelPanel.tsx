import { useMemo, useState } from 'react';
import { coefNLatex, shortInt, shortNum, workLatex } from '../math/format';
import { toLatex, toNumber } from '../math/rational';
import { exactLog, powerLatex, levelTotalCoef, levelTuples, tupleTotalCoef, type Analysis, type ConcreteLevel } from '../math/recurrence';
import { useHl, useLearnable } from '../state/selection';
import { Tex } from './Tex';
import { p0Parts } from '../explain/tex';

interface Row {
  level: number;
  tuples: { den: bigint; work: string; count: string; base?: boolean; share?: number }[];
  totalTex: string;
  value: number;
  /** fraction of the level total contributed by each branch (last step) */
  shares: number[];
}

interface Props {
  analysis: Analysis;
  levels: number;
  concrete: { n: number; levels: ConcreteLevel[] } | null;
  /** prediction pending: hide totals and bars except for hinted levels */
  hidden: boolean;
  hintLevels: number;
}

const MAX_TUPLES = 6;

export function LevelPanel({ analysis: a, levels, concrete, hidden, hintLevels }: Props) {
  const d = a.rec.d;
  const rows: Row[] = useMemo(() => {
    if (concrete)
      return concrete.levels.map((l) => ({
        level: l.level,
        tuples: l.tuples.map((t) => ({ den: t.den, work: t.leaf ? '1' : shortNum(t.work), count: shortInt(t.count), base: t.leaf })),
        totalTex: shortNum(l.total).replace(/,/g, '{,}'),
        value: l.total,
        shares: l.level === 0 ? [] : l.totalByBranch.map((x) => x / l.total),
      }));
    const shares = a.termRatios.map((q) => toNumber(q) / a.rNumber);
    return [...Array(levels).keys()].map((l) => ({
      level: l,
      tuples: levelTuples(a.rec, l).map((t) => ({ den: t.den, work: workLatex(t.den, d), count: shortInt(t.count), share: toNumber(tupleTotalCoef(t, d)) })),
      totalTex: coefNLatex(levelTotalCoef(a.rec, l), d),
      value: toNumber(levelTotalCoef(a.rec, l)),
      shares: l === 0 ? [] : shares,
    }));
  }, [a, levels, concrete, d]);

  const max = Math.max(...rows.map((r) => r.value));
  const leafCount = useMemo(() => {
    if (a.rec.terms.length === 1) {
      const { a: A, b: B } = a.rec.terms[0];
      if (A === 1) return '1';
      const ex = exactLog(A, B);
      return ex ? (ex.q === 1 ? (ex.p === 1 ? 'n' : `n^{${ex.p}}`) : `n^{${ex.p}/${ex.q}}`) : `n^{\\log_{${B}} ${A}}`;
    }
    const p = p0Parts(a);
    return `\\Theta(${powerLatex(p.val)})`;
  }, [a]);

  return (
    <div className="levels">
      <div className="levels-head" role="row">
        <span>Level</span>
        <span>(work per node, number of nodes)</span>
        <span className="t-right">Total</span>
        <span className="bars-head">Level total</span>
      </div>
      <ol className="level-rows" aria-label="Work per level">
        {rows.map((row, i) => (
          <LevelRow
            key={row.level}
            row={row}
            max={max}
            hide={hidden && row.level >= hintLevels}
            ratio={i > 0 ? (concrete ? row.value / rows[i - 1].value : null) : undefined}
            r={toLatex(a.r)}
            concrete={!!concrete}
          />
        ))}
        {!concrete && (
          <>
            <li className="level-gap" aria-hidden>
              <span>⋮</span>
              <span className="muted small">each level ×{' '}<Tex tex={hidden ? '?' : toLatex(a.r)} /> the one above, down to level <Tex tex={`\\log_{${a.minB}} n`} /></span>
            </li>
            <LeafRow leafCount={leafCount} multi={a.rec.terms.length > 1} />
          </>
        )}
      </ol>
    </div>
  );
}

function LevelRow({ row, max, hide, ratio, r, concrete }: { row: Row; max: number; hide: boolean; ratio: number | null | undefined; r: string; concrete: boolean }) {
  const [open, setOpen] = useState(false);
  const learn = useLearnable({ kind: 'level', level: row.level });
  const hl = useHl([`level:${row.level}`, `total:${row.level}`, `bar:${row.level}`]);
  const barHl = useHl([`bar:${row.level}`]);
  const shown = open ? row.tuples : row.tuples.slice(0, MAX_TUPLES);
  const width = max > 0 ? (row.value / max) * 100 : 0;
  return (
    <li className={`level-row hl-${hl || 'none'}`}>
      {ratio !== undefined && (
        <span className={`ratio-mark ${hide ? 'hidden' : ''}`} aria-hidden>
          <RatioMark text={hide ? '×?' : ratio === null ? `×${r}` : `×${shortNum(Math.round(ratio * 100) / 100)}`} tex={ratio === null && !hide} r={r} />
        </span>
      )}
      <button className="level-num" {...learn} aria-label={`Level ${row.level}`}>
        {row.level}
      </button>
      <span className="tuples">
        {shown.map((t) => (
          <TupleChip key={String(t.den)} level={row.level} t={t} concrete={concrete} />
        ))}
        {row.tuples.length > MAX_TUPLES && (
          <button className="more-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'fewer' : `+${row.tuples.length - MAX_TUPLES} more`}
          </button>
        )}
      </span>
      <span className="total t-right" {...learn} aria-label={`Level ${row.level} total`}>
        {hide ? <span className="unknown">?</span> : <Tex tex={row.totalTex} />}
      </span>
      <span className={`bar-cell hl-${barHl || 'none'}`} {...learn} aria-label={hide ? 'hidden until you predict' : `bar ${Math.round(width)}% of the largest level`}>
        <span className={`bar ${hide ? 'bar-hidden' : ''}`} style={{ width: hide ? '100%' : `max(3px, ${width}%)` }}>
          {row.shares.length === 0 ? <span className="seg root" style={{ width: '100%' }} /> : row.shares.map((s, i) => <BarSeg key={i} i={i} share={s} />)}
        </span>
      </span>
    </li>
  );
}

function RatioMark({ text, tex, r }: { text: string; tex: boolean; r: string }) {
  const hl = useHl(['ratio-mark']);
  return <span className={`ratio-chip hl-${hl || 'none'}`}>{tex ? <Tex tex={`\\times ${r}`} /> : text}</span>;
}

function BarSeg({ i, share }: { i: number; share: number }) {
  const hl = useHl([`branch:${i}`]);
  return <span className={`seg b${i} hl-${hl || 'none'}`} style={{ width: `${share * 100}%` }} />;
}

function TupleChip({ level, t, concrete }: { level: number; t: Row['tuples'][number]; concrete: boolean }) {
  const learn = useLearnable({ kind: 'tuple', level, den: String(t.den) });
  const hl = useHl([`tuple:${level}:${t.den}`]);
  return (
    <span className={`tuple hl-${hl || 'none'} ${t.base ? 'base' : ''}`} {...learn} aria-label={`${t.count} nodes doing ${t.work} work each`}>
      {concrete ? (
        <span className="tuple-plain">
          ({t.work}, {t.count})
        </span>
      ) : (
        <Tex tex={`(${t.work},\\, ${t.count.replace(/,/g, '{,}')})`} />
      )}
    </span>
  );
}

function LeafRow({ leafCount, multi }: { leafCount: string; multi: boolean }) {
  const learn = useLearnable({ kind: 'leafrow' });
  const hl = useHl(['leafrow']);
  return (
    <li className={`level-row leaf-row hl-${hl || 'none'}`}>
      <button className="level-num leaf-label" {...learn} aria-label="Leaves">
        leaves
      </button>
      <span className="tuples">
        <span className="tuple static">
          <Tex tex={`(1,\\, ${leafCount})`} />
        </span>
        {multi && <span className="muted small">spread over several depths</span>}
      </span>
      <span className="total t-right">
        <Tex tex={leafCount} />
      </span>
      <span className="bar-cell muted small leaf-note">{multi ? '' : 'one unit each'}</span>
    </li>
  );
}
