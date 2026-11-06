/** Real App bootstrap with synthetic, read-only transport. Never target production. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:18950';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname));
const output = process.env.QA_OUTPUT_DIR || '/tmp/agentcommons-workspace-design';
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {});
const results = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const geometry = page => page.evaluate(() => {
  const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,header:rect('.conversation-header'),composer:rect('.composer'),textSize:getComputedStyle(document.querySelector('.msg-body')).fontSize};
});
const readingAnchor = page => page.evaluate(() => {
  const stream = document.querySelector('.stream');const top = stream.getBoundingClientRect().top;
  const element = [...stream.querySelectorAll('.msg-card')].find(item => item.getBoundingClientRect().bottom > top+1);
  return {id:element.id,offset:element.getBoundingClientRect().top-top,top:stream.scrollTop,gap:stream.scrollHeight-stream.clientHeight-stream.scrollTop};
});
try {
  for (const theme of ['doodle','midnight']) for (const viewport of [{width:1440,height:960},{width:1024,height:768},{width:390,height:844},{width:320,height:640},{width:844,height:390}]) {
    const name = `${theme}-${viewport.width}x${viewport.height}`;
    const mobile = viewport.width<900;
    const context = await browser.newContext({viewport,screen:viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    try {
      await page.goto(`${origin}/test/app-workspace-preview.html?theme=${theme}`);
      await page.locator('.stream #msg-3').waitFor();await settle(page);
      const initial = await geometry(page);
      assert.equal(initial.overflow,false);assert.equal(initial.header.y,0);
      assert.ok(parseFloat(initial.textSize)>=15);assert.ok(initial.composer.right<=viewport.width+1);
      assert.ok(initial.composer.bottom<=viewport.height+1);
      assert.equal(await page.locator('.conversation-subtitle').innerText(),'3 位成员');
      await page.screenshot({path:`${output}/${name}.png`});
      if (mobile) await page.getByRole('button',{name:'打开群组列表',exact:true}).click();
      const toggle = page.locator('.sidebar-agents-toggle:visible');
      await toggle.click();assert.equal(await page.locator('.agent-list:visible').count(),0);
      await toggle.click();assert.equal(await page.locator('.agent-list:visible li').count(),2);
      await page.locator('.prototype-sidebar-search input:visible').fill('产品');
      assert.equal(await page.locator('.chan-pill:visible').count(),1);
      await page.locator('.chan-pill:visible').click();await page.waitForURL('**/c/fixture-1');
      await page.locator('.stream #msg-3').waitFor();
      if (!mobile) {
        const widths=[];
        for (const value of ['standard','wide','full']) {
          await page.getByLabel('阅读宽度',{exact:true}).selectOption(value);await settle(page);
          widths.push(await page.locator('.conversation-inner').evaluate(element=>element.getBoundingClientRect().width));
          assert.equal(await page.evaluate(()=>localStorage.getItem('commons.conversation.width')),value);
        }
        if(viewport.width===1440)assert.ok(widths[0]<widths[1]&&widths[1]<widths[2],`Distinct reading widths: ${widths}`);
        await page.locator('.workspace-nav-compact-toggle').click();
        assert.equal(await page.locator('.prototype-sidebar:visible').count(),0);
        await page.locator('.workspace-nav-compact-toggle').click();
        await page.getByLabel('阅读宽度',{exact:true}).selectOption('standard');
      }
      await page.locator('.conversation-title').click();
      const details = page.getByRole('dialog',{name:'群详情与操作',exact:true});await details.waitFor();
      const box = await details.boundingBox();assert.ok(box.x>=-1 && box.x+box.width<=viewport.width+1);
      await page.screenshot({path:`${output}/${name}-details.png`});
      await page.keyboard.press('Escape');await details.waitFor({state:'hidden'});
      assert.equal(await page.locator('.conversation-title').evaluate(element=>element===document.activeElement),true,'Details restores focus');
      await page.getByRole('button',{name:'邀请 Agent',exact:true}).click();
      await page.locator('.agent-join-card:visible').waitFor();
      assert.equal((await geometry(page)).overflow,false);
      await page.screenshot({path:`${output}/${name}-invite.png`});
      await page.keyboard.press('Escape');await page.locator('.agent-join-card').waitFor({state:'hidden'});
      assert.deepEqual(errors,[]);
      const writes = await page.evaluate(()=>window.__APP_WORKSPACE_FIXTURE__.requests.filter(request=>!request.startsWith('GET ')));
      assert.deepEqual(writes,[],'Viewing and navigation never send messages or mutate an account');
      results.push({name,passed:true,geometry:initial});
    } catch (error) {
      results.push({name,passed:false,error:String(error),errors});
      await page.screenshot({path:`${output}/${name}-failure.png`});throw error;
    } finally { await context.close(); }
  }
  // Reading history must stay anchored while status/new content arrive or width changes.
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*', route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  try {
    await page.goto(`${origin}/test/app-workspace-preview.html?theme=midnight&scroll=1&controls=0`);
    await page.locator('.stream #msg-200').waitFor();await settle(page);
    await page.locator('.stream').evaluate(element=>{element.scrollTop=1200;});await settle(page);
    const before=await readingAnchor(page);
    await page.evaluate(()=>{const c=window.__APP_WORKSPACE_FIXTURE__.controls;c.status();c.presence();c.append();c.streamLatest();});await settle(page);
    const refreshed=await readingAnchor(page);
    assert.equal(refreshed.id,before.id);assert.ok(Math.abs(refreshed.offset-before.offset)<2);assert.ok(refreshed.gap>500);
    await page.getByLabel('阅读宽度',{exact:true}).selectOption('full');await settle(page);
    const resized=await readingAnchor(page);assert.equal(resized.id,before.id);assert.ok(Math.abs(resized.offset-before.offset)<2);
    await page.locator('.stream').evaluate(element=>{element.scrollTop=element.scrollHeight;});await settle(page);
    await page.evaluate(()=>window.__APP_WORKSPACE_FIXTURE__.controls.append());await settle(page);
    assert.ok((await readingAnchor(page)).gap<3,'Bottom-follow remains available');
    results.push({name:'history-anchor-width-and-live-updates',passed:true});
  } finally {await context.close();}
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();
  console.log(JSON.stringify(results.map(({name,passed,error})=>({name,passed,error})),null,2));
}
