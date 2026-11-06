/** Real App visual regression, isolated by the local read-only workspace fixture.
 * QA_ORIGIN / QA_OUTPUT_DIR / PLAYWRIGHT_MODULE / PLAYWRIGHT_CHROMIUM_EXECUTABLE
 * are optional. QA_CASE_FILTER selects cases by regular expression.
 * Set QA_RECORD_VIDEO=1 to record a synthetic walkthrough (ffmpeg/ffprobe).
 */
import assert from 'node:assert/strict';
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:18950').origin;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'Only local fixtures are permitted');
const output = process.env.QA_OUTPUT_DIR || '/tmp/agentcommons-visual-polish';
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {});
const results = [];
const caseFilter = process.env.QA_CASE_FILTER ? new RegExp(process.env.QA_CASE_FILTER) : null;
const settle = page => page.evaluate(async () => {
  await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const anchor = page => page.evaluate(() => {
  const stream = document.querySelector('.stream'), top = stream.getBoundingClientRect().top;
  const message = [...stream.querySelectorAll('.msg-card')].find(element => element.getBoundingClientRect().bottom > top + 1);
  return {id: message?.id, offset: message ? message.getBoundingClientRect().top - top : 0, gap: stream.scrollHeight - stream.clientHeight - stream.scrollTop};
});
const sameAnchor = (before, after, reason) => {
  assert.equal(after.id, before.id, reason + ': same visible message');
  assert.ok(Math.abs(after.offset - before.offset) < 3, reason + ': reading offset ' + JSON.stringify({before, after}));
};
async function session(viewport, motion = 'no-preference', video = false) {
  const mobile = viewport.width < 900, blocked = [], errors = [];
  const context = await browser.newContext({viewport, screen: viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: motion, serviceWorkers: 'block', ...(video ? {recordVideo: {dir: output + '/raw-video', size: viewport}} : {})});
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== 'GET' || url.pathname.startsWith('/api/')) {
      blocked.push({method: request.method(), reason: url.origin !== origin ? 'external' : url.pathname.startsWith('/api/') ? 'unmocked-api' : 'mutation'});
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  return {context, page, mobile, errors, blocked};
}
async function load(page, theme, history = false) {
  await page.goto(`${origin}/test/app-workspace-preview.html?theme=${theme}${history ? '&scroll=1&controls=0' : ''}`);
  await page.locator(history ? '#msg-200' : '#msg-3').waitFor();
  assert.equal(await page.evaluate(() => Boolean(window.__APP_WORKSPACE_FIXTURE__)), true);
  await settle(page);
}
async function transport(state) {
  assert.deepEqual(state.errors, [], 'No JavaScript exceptions');
  assert.deepEqual(state.blocked, [], 'No external or unmocked transport attempted');
  assert.deepEqual(await state.page.evaluate(() => window.__APP_WORKSPACE_FIXTURE__.requests.filter(request => !request.startsWith('GET '))), [], 'No mutation requests, including synthetic writes');
}
async function run(name, viewport, motion, callback) {
  if (caseFilter && !caseFilter.test(name)) return;
  const state = await session(viewport, motion);
  try {
    const metrics = await callback(state);
    await transport(state); results.push({name, passed: true, metrics});
  } catch (error) {
    results.push({name, passed: false, error: String(error), focus: await state.page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label'),className:document.activeElement?.className})), errors: state.errors, blocked: state.blocked});
    await state.page.screenshot({path: `${output}/${name}-failed.png`});
  } finally {
    await state.context.close(); await writeFile(output + '/results.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify({name, passed: results.at(-1).passed, error: results.at(-1).error?.split('\n')[0]}));
  }
}
async function shortcut(page, mobile, label) {
  if (mobile) {
    await page.locator('.conversation-shortcut-menu>summary').click();
    await page.locator('.conversation-shortcut-menu').getByRole('button', {name: new RegExp('^' + label)}).click();
  } else await page.locator('.conversation-shortcut-actions').getByRole('button', {name: label, exact: true}).click();
  await page.locator('.channel-panel-card').waitFor(); await settle(page);
}
async function icons(page) {
  const measured = await page.locator('.studio-icon:visible,.platform-icon:visible').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {type: element.className.baseVal ?? element.className, width: rect.width, height: rect.height};
  }));
  assert.ok(measured.length > 8, 'Actual application icons are visible');
  for (const icon of measured) assert.ok(icon.width > 0 && Math.abs(icon.width - icon.height) < 1, 'Icon stays square: ' + JSON.stringify(icon));
  return measured.length;
}
async function pageBounds(page) {
  const metrics = await page.evaluate(() => ({viewport: innerWidth, page: document.documentElement.scrollWidth}));
  assert.ok(metrics.page <= metrics.viewport + 1, 'No horizontal page overflow');
}

try {
  // Both motion preferences exercise the same production components at all sizes.
  for (const theme of ['midnight', 'doodle']) for (const motion of ['no-preference', 'reduce']) for (const viewport of [{width:1440,height:900}, {width:1024,height:768}, {width:390,height:844}, {width:320,height:740}, {width:844,height:390}]) {
    const name = `${theme}-${motion}-${viewport.width}x${viewport.height}`;
    await run(name, viewport, motion, async ({page, mobile}) => {
      await load(page, theme); const count = await icons(page); await pageBounds(page);
      await page.screenshot({path: `${output}/${name}-chat.png`});
      await shortcut(page, mobile, '任务');
      const panel = page.locator('.channel-panel-overlay');
      assert.equal(await panel.getAttribute('role'), viewport.width >= 1280 && !mobile ? 'region' : 'dialog');
      const title = await page.locator('.task-card-copy>strong').first().evaluate(element => {
        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(element); const text = range.getBoundingClientRect();
        return {text: element.textContent, whiteSpace: style.whiteSpace, overflow: style.overflow, width: rect.width, height: rect.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, textBottom: text.bottom, bottom: rect.bottom};
      });
      assert.equal(title.text, '【TEST FIXTURE】Muse 视觉方案评审');
      assert.equal(title.whiteSpace, 'normal'); assert.ok(title.scrollWidth <= title.clientWidth + 1 && title.textBottom <= title.bottom + 1, 'Complete task title is visible');
      await icons(page); await pageBounds(page); await page.screenshot({path: `${output}/${name}-tasks.png`});
      const panelMotion = await page.locator('.channel-panel-card').evaluate(element => getComputedStyle(element).animationName);
      assert.equal(panelMotion === 'none', motion === 'reduce', 'Panel honors the motion preference');
      await page.locator('.channel-panel-close').click(); await panel.waitFor({state: 'hidden'}); await settle(page);
      const seq = await page.evaluate(() => window.__APP_WORKSPACE_FIXTURE__.controls.append('【TEST FIXTURE】新的协作消息，仅用于本地动画验收。'));
      const message = page.locator(`#msg-${seq}`); await message.waitFor();
      const arrival = await message.evaluate(element => ({article: getComputedStyle(element).animationName, body: getComputedStyle(element.querySelector('.msg-body')).animationName}));
      assert.equal(arrival.article, 'none', 'Arrival never animates the transcript layout container');
      assert.equal(arrival.body === 'none', motion === 'reduce', 'New content honors reduced motion');
      await settle(page);
      await page.evaluate(() => {window.__APP_WORKSPACE_FIXTURE__.controls.status(); window.__APP_WORKSPACE_FIXTURE__.controls.presence();});
      assert.equal(await page.locator('#msg-2>.msg-body').evaluate(element => element.getAnimations().length), 0, 'Presence updates do not replay old content animations');
      await pageBounds(page); return {icons: count, title, panelMotion, arrival};
    });
  }

  for (const motion of ['no-preference', 'reduce']) await run(`history-${motion}`, {width:1440,height:900}, motion, async ({page}) => {
    await load(page, 'midnight', true);
    await page.locator('.stream').evaluate(element => {element.scrollTop = 1200;}); await settle(page);
    const before = await anchor(page);
    await page.evaluate(() => {const controls = window.__APP_WORKSPACE_FIXTURE__.controls; controls.status(); controls.presence(); controls.append(); controls.streamLatest();});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    sameAnchor(before, await anchor(page), 'During new content arrival');
    await settle(page); sameAnchor(before, await anchor(page), 'After status and content updates');
    await shortcut(page, false, '任务'); sameAnchor(before, await anchor(page), 'Opening dock');
    await page.locator('.channel-panel-close').click(); await settle(page); sameAnchor(before, await anchor(page), 'Closing dock');
    await page.locator('.stream').evaluate(element => {element.scrollTop = element.scrollHeight;}); await settle(page);
    await page.evaluate(() => window.__APP_WORKSPACE_FIXTURE__.controls.append()); await settle(page);
    assert.ok((await anchor(page)).gap < 3, 'Bottom follow survives arrival animation');
    return {anchor: before};
  });

  await run('integrated-toolbar-tooltip', {width:1440,height:900}, 'no-preference', async ({page}) => {
    await load(page, 'midnight');
    const tasks = page.locator('.conversation-shortcut-actions button[aria-label="任务"]');
    const files = page.locator('.conversation-shortcut-actions button[aria-label="共享文件"]');
    const tooltip = page.locator('.toolbar-tooltip');
    assert.equal(await tasks.getAttribute('title'), null);
    await tasks.hover(); await page.waitForTimeout(200); assert.equal(await tooltip.count(), 0);
    await tooltip.waitFor(); assert.equal(await tooltip.innerText(), '任务');
    await files.hover(); assert.equal(await tooltip.innerText(), '共享文件');
    assert.equal(await tooltip.evaluate(element => element.parentElement === document.body), true);
    await page.mouse.move(800, 400); await page.waitForTimeout(350); await tasks.hover();
    await page.waitForTimeout(200); assert.equal(await tooltip.count(), 0); await tooltip.waitFor();
    await page.keyboard.press('Escape'); assert.equal(await tooltip.count(), 0);
    await files.focus(); await tooltip.waitFor();
    assert.ok((await files.getAttribute('aria-describedby')).includes(await tooltip.getAttribute('id')));
    await page.screenshot({path: output + '/integrated-tooltip.png'});
  });

  for (const theme of ['midnight', 'doodle']) await run(`dock-state-${theme}`, {width:1280,height:800}, 'no-preference', async ({page}) => {
    await load(page, theme, true); await page.locator('.stream').evaluate(element => {element.scrollTop = 1200;}); await settle(page);
    const before = await anchor(page);
    await shortcut(page, false, '任务');
    await page.locator('.task-new-btn').click(); await page.locator('.task-new-title').fill('TEST FIXTURE 未提交任务草稿');
    await page.locator('.task-new-desc').fill('TEST FIXTURE 缩放窗口保留说明');
    const foldedWidth = (await page.locator('.channel-panel-card').boundingBox()).width;
    await page.locator('.task-expand-btn').click(); await settle(page);
    assert.equal(await page.locator('.channel-panel-overlay').getAttribute('role'), 'dialog', 'Expand opens a wider modal');
    assert.ok((await page.locator('.channel-panel-card').boundingBox()).width > foldedWidth + 100, 'Expand actually increases the task workspace width');
    assert.equal(await page.locator('.task-new-title').inputValue(), 'TEST FIXTURE 未提交任务草稿');
    assert.equal(await page.locator('.task-new-desc').inputValue(), 'TEST FIXTURE 缩放窗口保留说明');
    await page.locator('.task-expand-btn').click(); await settle(page);
    assert.equal(await page.locator('.channel-panel-overlay').getAttribute('role'), 'region', 'Collapse returns to the dock');
    assert.ok(Math.abs((await page.locator('.channel-panel-card').boundingBox()).width - foldedWidth) < 2);
    assert.equal(await page.locator('.task-new-title').inputValue(), 'TEST FIXTURE 未提交任务草稿');
    assert.equal(await page.locator('.task-new-desc').inputValue(), 'TEST FIXTURE 缩放窗口保留说明');
    await page.locator('.composer-input').click();
    for (const width of [1024, 1280, 1024, 1280]) {
      await page.setViewportSize({width, height:800}); await settle(page);
      assert.equal(await page.locator('.channel-panel-overlay').getAttribute('role'), width >= 1280 ? 'region' : 'dialog');
      assert.equal(await page.locator('.task-new-title').inputValue(), 'TEST FIXTURE 未提交任务草稿');
      assert.equal(await page.locator('.task-new-desc').inputValue(), 'TEST FIXTURE 缩放窗口保留说明');
      if (width < 1280) assert.equal(await page.locator('.channel-panel-card').evaluate(element => element.contains(document.activeElement)), true, 'Becoming modal moves focus inside');
    }
    await page.getByRole('button', {name:'查看任务 1 详情', exact:true}).click();
    await page.locator('.task-detail-card').waitFor();
    await page.locator('.channel-panel-body').evaluate(element => {element.scrollTop = 120;});
    const detailScroll = await page.locator('.channel-panel-body').evaluate(element => ({top:element.scrollTop,height:element.clientHeight,scrollHeight:element.scrollHeight}));
    await page.setViewportSize({width:1024,height:800}); await settle(page);
    assert.equal(await page.locator('.task-detail-card').count(), 1, 'Task detail selection survives becoming modal');
    await page.setViewportSize({width:1280,height:800}); await settle(page);
    assert.equal(await page.locator('.task-detail-card').count(), 1);
    const afterDetailScroll = await page.locator('.channel-panel-body').evaluate(element => ({top:element.scrollTop,height:element.clientHeight,scrollHeight:element.scrollHeight}));
    assert.ok(Math.abs(afterDetailScroll.top - detailScroll.top) < 3, 'Task detail scroll survives a viewport round trip: '+JSON.stringify({before:detailScroll,after:afterDetailScroll}));
    await page.locator('.task-detail-close').click();
    assert.equal(await page.locator('.task-new-title').inputValue(), 'TEST FIXTURE 未提交任务草稿');
    await page.locator('.channel-panel-close').click(); await settle(page);
    sameAnchor(before, await anchor(page), 'Closing after viewport changes');
    await shortcut(page, false, '任务'); await shortcut(page, false, '共享文件'); await shortcut(page, false, '搜索消息');
    assert.equal(await page.locator('.conversation-shortcut-actions button[aria-pressed="true"]').getAttribute('aria-label'), '搜索消息');
    await page.locator('.channel-panel-close').click(); await settle(page);
    assert.equal(await page.locator('.conversation-shortcut-actions button[aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('.conversation-shortcut-actions button[aria-label="搜索消息"]').evaluate(element => element === document.activeElement), true, 'Close returns to the most recently selected tool');
  });

  await run('dock-detail-escape-scope', {width:1440,height:900}, 'no-preference', async ({page}) => {
    await load(page, 'midnight'); await shortcut(page, false, '任务');
    await page.getByRole('button', {name:'查看任务 1 详情', exact:true}).click();
    await page.locator('.task-detail-card').waitFor();
    await page.locator('.composer-input').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.task-detail-card').count(), 1, 'Composer Escape does not dismiss a docked task detail');
    assert.equal(await page.locator('.composer-input').evaluate(element=>element===document.activeElement), true);
    await page.locator('.task-detail-close').focus(); await page.keyboard.press('Escape');
    await page.locator('.task-detail-card').waitFor({state:'hidden'});
    assert.equal(await page.locator('.task-card-open').count(), 1, 'Detail Escape returns to the task list');
  });

  for (const theme of ['midnight', 'doodle']) await run(`connection-draft-${theme}`, {width:1280,height:800}, 'no-preference', async ({page}) => {
    await load(page, theme); await shortcut(page, false, '共享文件');
    await page.locator('#commons-tab-bridges').click();
    await page.locator('.commons-section-head .commons-primary').click();
    await page.locator('.agent-connect-tabs button').filter({hasText:'Hermes'}).click();
    await page.getByRole('button', {name:'继续连接 Hermes', exact:true}).click();
    const form = page.locator('.commons-form'); await form.waitFor();
    await form.getByLabel('显示名称', {exact:true}).fill('TEST FIXTURE 未提交连接草稿');
    await form.getByLabel('HTTPS API 服务地址', {exact:true}).fill('https://fixture.invalid/api');
    await page.locator('.composer-input').click();
    for (const width of [1024,1280,1024,1280]) {
      await page.setViewportSize({width,height:800}); await settle(page);
      assert.equal(await form.getByLabel('显示名称', {exact:true}).inputValue(), 'TEST FIXTURE 未提交连接草稿');
      assert.equal(await form.getByLabel('HTTPS API 服务地址', {exact:true}).inputValue(), 'https://fixture.invalid/api');
      assert.equal(await form.locator('select').inputValue(), 'hermes', 'Selected provider survives viewport changes');
      if(width<1280) assert.equal(await page.locator('.channel-panel-card').evaluate(element=>element.contains(document.activeElement)), true);
    }
    await page.screenshot({path:`${output}/connection-draft-${theme}.png`});
  });

  if (process.env.QA_RECORD_VIDEO === '1' && (!caseFilter || caseFilter.test('synthetic-video'))) {
    const started = Date.now(), state = await session({width:1440,height:900}, 'no-preference', true);
    const {page, context} = state;
    try {
      await load(page, 'midnight'); const clipStarted = Date.now();
      const video = page.video();
      await page.locator('.conversation-shortcut-actions button[aria-label="任务"]').hover(); await page.locator('.toolbar-tooltip').waitFor(); await page.waitForTimeout(300);
      await shortcut(page, false, '任务'); await page.waitForTimeout(650);
      await page.getByRole('button', {name:'查看任务 1 详情', exact:true}).click(); await settle(page); await page.waitForTimeout(850);
      await page.locator('.task-detail-close').click(); await settle(page); await page.waitForTimeout(400);
      await page.locator('.channel-panel-close').click(); await settle(page); await page.waitForTimeout(500);
      await page.evaluate(() => window.__APP_WORKSPACE_FIXTURE__.controls.append('【TEST FIXTURE】新的想法已加入讨论。仅为本地演示，没有发送真实消息。'));
      await settle(page); await page.waitForTimeout(Math.max(1000, 9000 - (Date.now() - clipStarted)));
      await transport(state); await context.close();
      const raw = await video.path(); await copyFile(raw, output + '/fixture-walkthrough.webm');
      await promisify(execFile)(process.env.FFMPEG_EXECUTABLE || 'ffmpeg', ['-y','-ss',String((clipStarted-started)/1000),'-i',raw,'-t','9','-an','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',output+'/fixture-walkthrough.mp4']);
      const probe = await promisify(execFile)(process.env.FFPROBE_EXECUTABLE || 'ffprobe', ['-v','error','-show_entries','format=duration','-of','json',output+'/fixture-walkthrough.mp4']);
      const duration = Number(JSON.parse(probe.stdout).format.duration);
      assert.ok(duration >= 6 && duration <= 12, 'The exported walkthrough lasts 6–12 seconds');
      await writeFile(output+'/video-source.json', JSON.stringify({source:'Local real-App synthetic fixture; no production account or test messages sent',entry:'/test/app-workspace-preview.html',actions:['hover task tooltip','open task dock','view task detail','return to chat','fixture controls.append'],duration_seconds:duration,real_writes:0},null,2));
      results.push({name:'synthetic-video',passed:true,source:'fixture',file:'fixture-walkthrough.mp4',duration});
    } finally {await context.close();}
  }
} finally {
  await writeFile(output + '/results.json', JSON.stringify(results, null, 2)); await browser.close();
}
console.log(JSON.stringify({checks:results.length,passed:results.filter(result=>result.passed).length,failures:results.filter(result=>!result.passed).map(({name,error})=>({name,error:error?.split('\n')[0]}))}));
if (results.some(result => !result.passed)) process.exitCode = 1;
