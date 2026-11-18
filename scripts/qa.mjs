// QA walkthrough: drives the running app through the main flows with the
// locally installed Chrome and saves screenshots to screenshots/.
// usage: node scripts/qa.mjs [baseUrl] [scenario...]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5179/';
const only = process.argv.slice(3);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];

async function open({ w = 1440, h = 1000, dark = false, hash = '', intro = false, reducedMotion = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    colorScheme: dark ? 'dark' : 'light',
    hasTouch: w < 700,
    isMobile: w < 700,
    deviceScaleFactor: w < 700 ? 2 : 1,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
  if (!intro) await page.addInitScript(() => localStorage.setItem('rte.intro', '1'));
  await page.goto(base + hash);
  await page.waitForTimeout(900);
  return { page, ctx };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: `screenshots/${name}.png`, ...opts });
const text = (page, sel) => page.locator(sel).first().innerText();

const scenarios = {
  async intro() {
    const { page, ctx } = await open({ intro: true });
    await shot(page, 'intro');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    console.log('intro dismissed:', (await page.locator('.intro').count()) === 0);
    await ctx.close();
  },
  async select() {
    const { page, ctx } = await open();
    await page.locator('.node').nth(5).click();
    await page.waitForTimeout(400);
    await shot(page, 'select-node');
    await page.locator('.tuple').nth(4).click();
    await page.waitForTimeout(300);
    await shot(page, 'select-tuple');
    await page.locator('.r-value').click();
    await page.waitForTimeout(300);
    await shot(page, 'select-r');
    console.log('explain title (r):', await text(page, '.explain-title'));
    await page.locator('.step').nth(8).click();
    await page.waitForTimeout(300);
    await shot(page, 'select-step', { fullPage: true });
    await ctx.close();
  },
  async predict() {
    const { page, ctx } = await open();
    await page.getByRole('button', { name: 'Karatsuba' }).click();
    await page.waitForTimeout(1800);
    await shot(page, 'predict-ask');
    await page.getByRole('button', { name: /Hint/ }).click();
    await page.waitForTimeout(300);
    await shot(page, 'predict-hint');
    await page.getByRole('button', { name: /The root/ }).click();
    await page.waitForTimeout(900);
    await shot(page, 'predict-feedback');
    console.log('feedback:', await text(page, '.fb-text'));
    await ctx.close();
  },
  async edit() {
    const { page, ctx } = await open();
    await page.getByRole('button', { name: /Shrink factor b1/ }).click();
    await page.keyboard.type('1');
    await page.waitForTimeout(200);
    await shot(page, 'edit-error', { clip: { x: 300, y: 100, width: 840, height: 300 } });
    console.log('error:', await text(page, '.field-error'));
    await page.locator('.num-input').fill('2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    console.log('toast after merge:', (await page.locator('.toast').count()) ? await text(page, '.toast') : '(none)');
    await shot(page, 'edit-merged');
    await page.getByRole('button', { name: /Exponent d/ }).click();
    await page.locator('.num-input').fill('0');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    console.log('rstrip d=0:', await text(page, '.rstrip'));
    await shot(page, 'edit-d0');
    await ctx.close();
  },
  async concrete() {
    const { page, ctx } = await open();
    await page.getByRole('radio', { name: 'Concrete n' }).click();
    await page.waitForTimeout(1000);
    await shot(page, 'concrete', { fullPage: true });
    console.log('concrete summary:', (await text(page, '.concrete-sum')).replace(/\s+/g, ' '));
    await ctx.close();
  },
  async random() {
    const { page, ctx } = await open();
    // turn prediction off for this run so every verdict is visible
    await page.locator('.switch').click();
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: /Randomize/ }).click();
      await page.waitForTimeout(i < 2 ? 2200 : 700);
      const rec = await page.locator('.formula').getAttribute('aria-label');
      const hash = await page.evaluate(() => location.hash);
      const strip = (await text(page, '.rstrip')).replace(/\s+/g, ' ');
      console.log(`#${i + 1} ${hash}  |  ${strip}`);
      if (i < 4) await shot(page, `random-${i + 1}`);
      void rec;
    }
    await ctx.close();
  },
  async presets() {
    const { page, ctx } = await open();
    await page.locator('.switch').click();
    for (const name of ['Merge sort', 'Binary search', 'Karatsuba', '2T(n/4) + T(n/2) + n']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(2000);
      console.log(name, '→', (await text(page, '.rstrip')).replace(/\s+/g, ' '));
      await shot(page, `preset-${name.replace(/[^a-z0-9]+/gi, '_')}`);
    }
    await ctx.close();
  },
  async mobile() {
    const { page, ctx } = await open({ w: 390, h: 844 });
    await shot(page, 'mobile-top');
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    await shot(page, 'mobile-tree');
    await page.locator('.levels').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, 'mobile-levels');
    await page.locator('.tuple').nth(3).tap();
    await page.waitForTimeout(400);
    await shot(page, 'mobile-explain');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log('horizontal overflow px:', overflow);
    await ctx.close();
  },
  async formula() {
    const { page, ctx } = await open();
    const tipText = async () => ((await page.locator('.ftip').count()) ? (await text(page, '.ftip')).replace(/\s+/g, ' ') : '(no tip)');
    for (const [name, sel] of [
      ['lhs', '[data-part="lhs"]'],
      ['call0', '[data-part="call:0"] .m-it >> nth=0'],
      ['coef0', '[data-part="coef:0"]'],
      ['div1', '[data-part="div:1"]'],
      ['fwork', '[data-part="fwork"] .m-it'],
      ['exp', '[data-part="exp"]'],
    ]) {
      await page.locator(sel).first().hover();
      await page.waitForTimeout(350);
      console.log(`tip ${name}:`, await tipText());
      if (name === 'coef0' || name === 'fwork') await shot(page, `tip-${name}`, { clip: { x: 200, y: 0, width: 1040, height: 380 } });
    }
    // moving from the number into the tooltip keeps it open, and its button opens the explanation
    await page.locator('[data-part="coef:0"]').hover();
    await page.waitForTimeout(300);
    await page.locator('.ftip-learn').hover();
    await page.waitForTimeout(400);
    console.log('tip still open over tooltip:', (await page.locator('.ftip').count()) === 1);
    await page.locator('.ftip-learn').click();
    await page.waitForTimeout(400);
    console.log('explain after learn:', (await text(page, '.explain')).replace(/\s+/g, ' ').slice(0, 400));
    await shot(page, 'tip-learn');
    await page.keyboard.press('Escape');
    // click a number: editing, with the tooltip pinned
    await page.locator('[data-part="div:0"] button').click();
    await page.waitForTimeout(300);
    console.log('editing tip:', await tipText());
    await shot(page, 'tip-editing', { clip: { x: 200, y: 0, width: 1040, height: 420 } });
    await page.locator('.num-input').fill('3');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    console.log('after edit, tip:', await tipText(), '| hash', await page.evaluate(() => location.hash));
    // keyboard: tab to a number and press ? to explain
    await page.locator('[data-part="lhs"]').focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    console.log('focus tip (term):', await tipText());
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    console.log('focus tip (number):', await tipText());
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    console.log('? opens:', await text(page, '.explain-title'));
    await page.keyboard.press('Escape');
    await page.locator('#deriv-h').scrollIntoViewIfNeeded();
    await shot(page, 'solution', { fullPage: true });
    await ctx.close();
  },
  async mformula() {
    const { page, ctx } = await open({ w: 390, h: 844 });
    await page.locator('[data-part="fwork"] .m-it').tap();
    await page.waitForTimeout(350);
    console.log('mobile tap fwork tip:', (await page.locator('.ftip').count()) === 1, '| explain open:', (await page.locator('.explain').count()) === 1);
    await shot(page, 'm-tip');
    await page.waitForTimeout(600);
    console.log('tip survives finger lift:', (await page.locator('.ftip').count()) === 1);
    await page.locator('[data-part="fwork"] .m-it').tap();
    await page.waitForTimeout(400);
    console.log('second tap opens explain:', (await page.locator('.explain').count()) === 1, (await page.locator('.explain-title').count()) ? await text(page, '.explain-title') : '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('[data-part="lhs"]').tap();
    await page.waitForTimeout(300);
    await page.locator('.rstrip').tap();
    await page.waitForTimeout(300);
    console.log('tap elsewhere hides tip:', (await page.locator('.ftip').count()) === 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-part="coef:0"] button').tap();
    await page.waitForTimeout(350);
    await shot(page, 'm-tip-edit');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log('overflow:', overflow);
    await ctx.close();
  },
  async dark() {
    const { page, ctx } = await open({ dark: true });
    await page.locator('.node').nth(2).click();
    await page.waitForTimeout(400);
    await shot(page, 'dark');
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(scenarios)) {
  if (only.length && !only.includes(name)) continue;
  console.log(`\n== ${name}`);
  try {
    await fn();
  } catch (e) {
    console.log(`!! ${name} failed: ${e.message.split('\n')[0]}`);
  }
}
console.log(errors.length ? `\nERRORS (${errors.length}):\n${[...new Set(errors)].join('\n')}` : '\nno console errors');
await browser.close();
