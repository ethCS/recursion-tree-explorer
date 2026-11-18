import { useMemo } from 'react';
import { shortNum } from '../math/format';
import { boundValue, concreteSum, type Analysis } from '../math/recurrence';
import { useHl, useLearnable } from '../state/selection';
import { Tex } from './Tex';

/** n values on the slider: powers of 2, 3, 4, 5 and a few round numbers, 16..1024 */
export const N_VALUES = [16, 25, 27, 32, 64, 81, 100, 125, 128, 243, 256, 500, 512, 625, 729, 1000, 1024];

export function nNote(n: number): string {
  for (const b of [2, 3, 5, 7]) {
    let p = 0;
    let x = 1;
    while (x < n) {
      x *= b;
      p++;
    }
    if (x === n) return `${b}${sup(p)}`;
  }
  return '';
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => String(k).split('').map((c) => SUP[Number(c)]).join('');

export function NSlider({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  const idx = Math.max(0, N_VALUES.indexOf(n));
  const note = nNote(n);
  return (
    <div className="nslider">
      <label htmlFor="nrange" className="nslider-label">
        <Tex tex="n =" /> <strong className="nslider-value">{n}</strong>
        {note && <span className="muted small"> = {note}</span>}
      </label>
      <input
        id="nrange"
        type="range"
        min={0}
        max={N_VALUES.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(N_VALUES[Number(e.target.value)])}
        aria-valuetext={`n = ${n}`}
      />
      <span className="muted small nslider-ends">16 – 1024</span>
    </div>
  );
}

export function ConcreteSummary({ a, n, sum, levels }: { a: Analysis; n: number; sum: number; levels: number }) {
  const o = a.bigO;
  const bound = boundValue(o, n);
  const learn = useLearnable({ kind: 'sum' });
  const hl = useHl(['sum']);
  const series = useMemo(() => [16, 64, 256, 1024].map((m) => ({ m, ratio: concreteSum(a.rec, m) / boundValue(o, m) })), [a, o]);
  const lo = Math.min(...series.map((s) => s.ratio));
  const hi = Math.max(...series.map((s) => s.ratio));
  const steady = hi / lo < 2.2;
  const boundTex = o.latex.replace('\\log n', '\\log_2 n');
  return (
    <div className={`concrete-sum hl-${hl || 'none'}`} {...learn} aria-label="Sum of all levels compared with the Big-O prediction">
      <div className="cs-row">
        <div className="cs-cell">
          <span className="cs-label">Sum of all {levels} levels</span>
          <span className="cs-value">{shortNum(sum)}</span>
        </div>
        <div className="cs-cell">
          <span className="cs-label">
            Prediction <Tex tex={boundTex} />
          </span>
          <span className="cs-value">{shortNum(bound)}</span>
        </div>
        <div className="cs-cell">
          <span className="cs-label">Ratio</span>
          <span className="cs-value accent">{shortNum(Math.round((sum / bound) * 100) / 100)}</span>
        </div>
      </div>
      <div className="cs-series">
        <span className="muted small">Ratio as n grows:</span>
        {series.map((s) => (
          <span key={s.m} className={`cs-pt ${s.m === n ? 'cur' : ''}`}>
            <span className="muted small">n={s.m}</span> {shortNum(Math.round(s.ratio * 100) / 100)}
          </span>
        ))}
        <span className={`cs-verdict ${steady ? 'ok' : ''}`}>{steady ? 'stays bounded, so the Big-O fits' : 'still settling at small n'}</span>
      </div>
    </div>
  );
}
