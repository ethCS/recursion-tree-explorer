// QA helper: screenshots the running app with the locally installed Chrome.
// usage: node scripts/shot.mjs <url> <out.png> [width] [height] [--dark] [--intro]
import { chromium } from 'playwright-core';

const [url = 'http://localhost:5179/', out = 'screenshots/shot.png', w = '1440', h = '1000', ...flags] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
  colorScheme: flags.includes('--dark') ? 'dark' : 'light',
  hasTouch: Number(w) < 700,
  isMobile: Number(w) < 700,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
if (!flags.includes('--intro')) await page.addInitScript(() => localStorage.setItem('rte.intro', '1'));
await page.goto(url);
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: flags.includes('--full') });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
else console.log('no console errors');
await browser.close();
