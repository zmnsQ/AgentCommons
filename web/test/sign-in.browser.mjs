// QA_ORIGIN can also point to a deployed site with GitHub sign-in enabled.
// Only local previews receive mock data. The production check never starts OAuth.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:18950').origin;
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname);
const output = process.env.QA_OUTPUT_DIR;
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});

function luminance(rgb) {
  assert.match(rgb, /^rgb\(\d+, \d+, \d+\)$/);
  const [r, g, b] = rgb.match(/\d+/g).map(value => {
    const n = Number(value) / 255;
    return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(foreground, background) {
  const [lo, hi] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (hi + .05) / (lo + .05);
}
async function checkButton(link) {
  const style = await link.evaluate(el => {
    const s = getComputedStyle(el), rect = el.getBoundingClientRect();
    return {
      foreground: s.color, background: s.backgroundColor,
      panel: getComputedStyle(el.closest('section')).backgroundColor,
      inView: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      largeEnough: rect.width >= 44 && rect.height >= 44,
    };
  });
  const textRatio = contrast(style.foreground, style.background);
  assert.ok(textRatio >= 4.5, 'Button text contrast ' + textRatio);
  assert.ok(contrast(style.background, style.panel) >= 3, 'Button boundary against panel');
  assert.ok(style.inView && style.largeEnough, 'Button is visible and large enough to tap');
  return Number(textRatio.toFixed(2));
}

try {
  if (output) await mkdir(output, {recursive: true});
  for (const width of [1222, 320]) {
    const height = width === 320 ? 568 : 834;
    const context = await browser.newContext({
      viewport: {width, height}, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'zh-CN',
    });
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET' || url.origin !== origin || url.pathname.startsWith('/api/auth/github/start')) {
        errors.push(url.pathname);
        return route.abort();
      }
      if (local && url.pathname === '/api/auth/github/session')
        return route.fulfill({json: {configured: true, status: 'signed_out'}});
      if (local && url.pathname === '/api/config') return route.fulfill({json: {auth: {providers: []}}});
      return route.continue();
    });
    for (const theme of ['midnight', 'doodle']) {
      for (const palette of ['jade', 'lake', 'iris', 'rose', 'amber', 'slate']) {
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({theme, palette}) => {
          localStorage.setItem('ap_theme_ui_version', 'prototype-native-v1');
          localStorage.setItem('ap_locale', 'zh');
          localStorage.setItem('ap_theme', theme);
          localStorage.setItem('ap_palette', palette);
        }, {theme, palette});
        await page.goto(origin);
        const link = page.getByRole('link', {name: '使用 GitHub 登录'});
        await link.waitFor();
        assert.equal(await page.locator('html').getAttribute('data-ac-theme'), theme);
        assert.equal(await page.locator('html').getAttribute('data-palette'), palette);
        const target = new URL(await link.getAttribute('href'), origin);
        assert.equal(target.origin, origin);
        assert.equal(target.pathname, '/api/auth/github/start');
        const normal = await checkButton(link);
        if (output && palette === 'jade') await page.screenshot({path: output + '/signin-' + theme + '-' + width + '.png'});
        await page.keyboard.press('Tab');
        assert.ok(await link.evaluate(el => el.matches(':focus-visible')), 'First Tab focuses the main action');
        const ring = await link.evaluate(el => {
          const s = getComputedStyle(el);
          return {color: s.outlineColor, width: parseFloat(s.outlineWidth), panel: getComputedStyle(el.closest('section')).backgroundColor};
        });
        assert.ok(ring.width >= 2 && contrast(ring.color, ring.panel) >= 3);
        await link.hover();
        const hover = await checkButton(link);
        await page.getByText('使用访问令牌登录', {exact: true}).click();
        assert.ok(await page.getByLabel('访问令牌', {exact: true}).isVisible());
        await page.getByText('作者与许可', {exact: true}).click();
        assert.ok(await page.locator('.signin-credit a[rel~=author]').isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth));
        console.log(JSON.stringify({width, theme, palette, normal, hover}));
        await page.close();
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
