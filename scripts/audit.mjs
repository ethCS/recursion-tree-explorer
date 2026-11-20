// First-visit audit: screenshots a fixed set of views so before/after can be compared.
// usage: node scripts/audit.mjs <baseUrl> <outDir> [chromium|firefox|webkit]
// Chromium uses the locally installed Chrome; firefox/webkit need `npx playwright-core install firefox webkit`.
import { chromium, firefox, webkit } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'screenshots/audit';
const engine = process.argv[4] ?? 'chromium';
mkdirSync(out, { recursive: true });
const launcher = { chromium, firefox, webkit }[engine];
const browser = await launcher.launch(engine === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } : { headless: true });
const errors = [];
const report = {};

async function open({ w = 1440, h = 900, dark = false, hash = '', intro = true, wait = 1500 } = {}) {
  const mobile = w < 700;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    colorScheme: dark ? 'dark' : 'light',
    hasTouch: mobile,
    ...(engine === 'firefox' ? {} : { isMobile: mobile }),
    deviceScaleFactor: mobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${engine} pageerror] ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${engine} console] ${m.text()}`));
  if (!intro) await page.addInitScript(() => localStorage.setItem('rte.intro', '1'));
  // collect layout shifts from the very start (Chromium only)
  await page.addInitScript(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
  await page.goto(base + hash);
  await page.waitForTimeout(wait);
  return { page, ctx };
}
const shot = (page, name, opts = {}) => page.screenshot({ path: `${out}/${name}.png`, ...opts });

// what's visible in the first screen, after the intro is dismissed
async function aboveFold(page) {
  return page.evaluate(() => {
    const vh = innerHeight;
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'missing';
      const r = el.getBoundingClientRect();
      return r.bottom <= vh ? 'full' : r.top < vh ? `partial (${Math.round(vh - r.top)}/${Math.round(r.height)}px)` : `below (top ${Math.round(r.top)})`;
    };
    return {
      formula: vis('.formula'),
      r: vis('.rstrip'),
      tree: vis('.tree-wrap'),
      bars: vis('.level-rows'),
      cls: Math.round(window.__cls * 1000) / 1000,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

const views = [
  ['laptop-light', { w: 1280, h: 800 }],
  ['laptop-dark', { w: 1280, h: 800, dark: true }],
  ['desktop-light', { w: 1440, h: 900 }],
  ['small-laptop', { w: 1366, h: 768 }],
  ['phone-light', { w: 390, h: 844 }],
  ['phone-dark', { w: 390, h: 844, dark: true }],
];

for (const [name, opt] of views) {
  const { page, ctx } = await open(opt);
  await shot(page, `${name}-0-firstvisit`);
  // dismiss intro the way a visitor would
  const btn = page.getByRole('button', { name: /start exploring/i });
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(700);
  await shot(page, `${name}-1-fold`);
  report[name] = await aboveFold(page);
  if (name.startsWith('phone') || name === 'laptop-light' || name === 'laptop-dark') await shot(page, `${name}-2-full`, { fullPage: true });
  await ctx.close();
}

// concrete mode with a tall tree: does the legend cover the last level?
{
  const { page, ctx } = await open({ w: 1280, h: 800, intro: false, hash: '#1T2+n1' });
  await page.getByRole('radio', { name: 'Concrete n' }).click();
  await page.waitForTimeout(1200);
  await page.locator('.tree-wrap').scrollIntoViewIfNeeded();
  await shot(page, 'concrete-tall', { fullPage: false });
  await page.locator('.tree-wrap').screenshot({ path: `${out}/concrete-tall-tree.png` });
  await ctx.close();
}
// large a, three terms, long formula on a phone
{
  const { page, ctx } = await open({ w: 1280, h: 800, intro: false, hash: '#16T2+n0' });
  await page.locator('.tree-wrap').screenshot({ path: `${out}/large-a-tree.png` });
  await shot(page, 'large-a', { fullPage: true });
  await ctx.close();
}
{
  const { page, ctx } = await open({ w: 360, h: 780, intro: false, hash: '#16T16+15T15+14T14+n4' });
  await shot(page, 'phone-long-formula');
  report['phone-long-formula'] = await aboveFold(page);
  await ctx.close();
}
// remove a node: collapse a subtree mid-way, capture a frame
{
  const { page, ctx } = await open({ w: 1280, h: 800, intro: false });
  const knob = page.locator('.knob.open').first();
  await knob.click();
  await page.waitForTimeout(60);
  await page.locator('.tree-wrap').screenshot({ path: `${out}/collapse-60ms.png` });
  await ctx.close();
}
// explanation open on desktop and phone
{
  const { page, ctx } = await open({ w: 1280, h: 800, intro: false });
  await page.locator('.r-value').click();
  await page.waitForTimeout(500);
  await shot(page, 'explain-r');
  await ctx.close();
}

console.log(JSON.stringify(report, null, 2));
console.log(errors.length ? `ERRORS:\n${[...new Set(errors)].join('\n')}` : 'no console errors');
await browser.close();
