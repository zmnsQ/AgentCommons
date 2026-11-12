// Use the real chat renderer with isolated messages. A host add-on can write the
// generic theme attribute after boot or after the user changes appearance.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:18950').origin;
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const output = process.env.QA_OUTPUT_DIR;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  for (const width of [1440,390,320]) for (const theme of ['doodle','midnight']) {
    const page = await browser.newPage({viewport:{width,height:width > 600 ? 900 : 820}, reducedMotion:'reduce',serviceWorkers:'block'});
    const unexpected = [];
    page.on('pageerror', error => unexpected.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && route.request().method() === 'GET' && !url.pathname.startsWith('/api/')) return route.continue();
      unexpected.push(url.pathname); return route.abort();
    });
    await page.goto(origin + '/test/app-workspace-preview.html?thread=1&theme=' + theme);
    await page.locator('#msg-3 .msg-attachment-file').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    for(const external of ['light','dark',null]) {
      await page.evaluate(value => {
        if (value) document.documentElement.setAttribute('data-theme',value);
        else document.documentElement.removeAttribute('data-theme');
      },external);
      assert.equal(await page.locator('html').getAttribute('data-ac-theme'),theme);
      const measured = await page.evaluate(() => {
        const paint=document.createElement('canvas').getContext('2d');
        function color(value) {
          paint.clearRect(0,0,1,1);paint.fillStyle=value;paint.fillRect(0,0,1,1);
          return Array.from(paint.getImageData(0,0,1,1).data);
        }
        function light([r,g,b]) {
          const channels=[r,g,b].map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
          return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
        }
        function sample(el,pseudo) {
          const s=getComputedStyle(el,pseudo), fg=color(s.color);
          let bg;
          for(let at=el;at;at=at.parentElement) {
            const fill=color(getComputedStyle(at).backgroundColor);
            if(fill[3]===255) {bg=fill;break;}
          }
          if(!bg) throw Error('Missing opaque surface for ' + el.className);
          const x=light(fg),y=light(bg);
          return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        }
        const selectors=['#msg-1 .msg-body p','#msg-2 .msg-body p','#msg-3 .msg-body li','#msg-3 .msg-body pre',
          '#msg-3 .msg-quote-text','#msg-3 .msg-attachment-fname','#msg-3 .msg-time','#msg-3 .msg-sender',
          '.conversation-title h1','.conversation-subtitle','.composer-input'];
        const ratios=Object.fromEntries(selectors.map(sel=>[sel,sample(document.querySelector(sel))]));
        ratios.placeholder=sample(document.querySelector('.composer-input'),'::placeholder');
        for (const el of document.querySelectorAll('#msg-3 pre code, #msg-3 pre code span, #msg-2 .msg-status-summary, #msg-2 .msg-status-read')) {
          ratios[el.tagName + '.' + el.className] = sample(el);
        }
        const own=document.querySelector('#msg-1 .message-bubble'), incoming=document.querySelector('#msg-2 .message-bubble');
        return {ratios,own:getComputedStyle(own).backgroundColor,incoming:getComputedStyle(incoming).backgroundColor,
          ownRight:own.getBoundingClientRect().right,incomingRight:incoming.getBoundingClientRect().right,
          overflow:document.querySelector('.stream').scrollWidth-document.querySelector('.stream').clientWidth};
      });
      for (const [name,ratio] of Object.entries(measured.ratios)) assert.ok(ratio>=4.5,`${width} / ${theme} / ${external} / ${name}: ${ratio}`);
      assert.notEqual(measured.own,measured.incoming);
      assert.ok(measured.ownRight>measured.incomingRight-1);assert.ok(measured.overflow<=1);
      if(external==='light' && output) await page.screenshot({path:`${output}/chat-${theme}-${width}.png`});
    }
    await page.locator('#msg-3 .msg-quote').click();
    assert.ok(await page.locator('#msg-1').evaluate(el => {const b=el.getBoundingClientRect(), s=el.closest('.stream').getBoundingClientRect(); return b.bottom>s.top && b.top<s.bottom;}), 'Quote jumps to the original message');
    assert.deepEqual(unexpected,[]);
    assert.deepEqual(await page.evaluate(()=>window.__APP_WORKSPACE_FIXTURE__.requests.filter(s=>!s.startsWith('GET '))),[]);
    console.log('PASS',width,theme);await page.close();
  }
} finally {await browser.close();}
