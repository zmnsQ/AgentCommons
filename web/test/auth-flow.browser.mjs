// Exercise the routed app with a synthetic account. All API traffic stays inside this fixture.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = new URL(process.env.QA_ORIGIN || "http://127.0.0.1:18950").origin;
const output = process.env.QA_OUTPUT_DIR;
if (output) await mkdir(output, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const recoveryCode = "01234567-89abcdef-01234567-89abcdef";

async function snapshot(page, label) {
  await page.locator(".commons-brand img").evaluate(async img => { await img.decode(); await document.fonts.ready; });
  assert.ok(await page.locator("main").evaluate(main => main.scrollWidth <= main.clientWidth));
  if (output) await page.screenshot({path: output + "/" + label + ".png"});
}

function ratio(fg, bg) {
  function luminance(rgb) {
    const channels = rgb.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    assert.ok(channels, "Expected opaque foreground and background, got " + rgb);
    const [r, g, b] = channels.slice(1).map(c => Number(c) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return .2126*r + .7152*g + .0722*b;
  }
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
}
async function checkAction(button) {
  const s = await button.evaluate(el => {
    const css = getComputedStyle(el), rect = el.getBoundingClientRect();
    return {text: css.color, bg: css.backgroundColor, height: rect.height, width: rect.width, opacity: css.opacity};
  });
  assert.equal(s.opacity, "1");
  assert.ok(s.width >= 44 && s.height >= 44);
  assert.ok(ratio(s.text, s.bg) >= 4.5, "Readable verification action");
}

try {
  for (const [width, height, theme, palette] of [[390,844,"midnight","jade"],[320,568,"doodle","rose"],[1222,834,"midnight","iris"],[1222,834,"doodle","lake"]]) {
    const context = await browser.newContext({viewport:{width,height}, serviceWorkers:"block", reducedMotion:"reduce", locale:"zh-CN"});
    let session = "mfa_required", enabled = false, rejectFirst = true, recent = true;
    const calls = [], errors = [];
    await context.addInitScript(({theme,palette}) => {
      localStorage.setItem("ap_locale","zh"); localStorage.setItem("ap_theme_ui_version","prototype-native-v1");
      localStorage.setItem("ap_theme",theme); localStorage.setItem("ap_palette",palette);
    }, {theme,palette});
    await context.route("**/*", route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
      if (url.origin !== origin) { errors.push("External request"); return route.abort(); }
      if (!path.startsWith("/api/")) {
        if (method === "GET") return route.continue();
        errors.push(method + " " + path); return route.abort();
      }
      const json = data => route.fulfill({json:data});
      const auth = path.slice("/api/auth/github".length);
      if (method === "GET") {
        if (auth === "/session") return json({configured:true,status:session,...(session==="authenticated" ? {account:"github:fixture",access_token:"fixture-only"}:{})});
        if (auth === "/security") return json({enabled,recent_login:recent,recovery_remaining:10,login:"fixture"});
        if (path === "/api/channels") return json({channels:[]});
        if (path === "/api/me") return json({role:"human",account:"github:fixture",handle:"fixture"});
        return json({});
      }
      const body = req.postDataJSON();
      calls.push({auth,body});
      switch (auth) {
        case "/verify":
          if (rejectFirst) {
            rejectFirst = false;
            return route.fulfill({status:401,json:{error:{code:"invalid_verification_code"}}});
          }
          session = "authenticated"; return json({});
        case "/security/setup": return json({secret:"DEMO",otpauth_uri:"otpauth://totp/Example:Fixture?secret=JBSWY3DPEHPK3PXP&issuer=Example"});
        case "/security/confirm": case "/security/recovery-codes":
          enabled = true; return json({recovery_codes:[recoveryCode, recoveryCode.replace(/^0/,"f")]});
        case "/security/disable": enabled = false; return json({});
        case "/logout": session = "signed_out"; return json({});
        default: errors.push(method + " " + path); return route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", err => errors.push(err.message));
    const button = name => page.getByRole("button",{name,exact:true});
    const heading = name => page.getByRole("heading",{name,exact:true});
    const field = name => page.getByRole("textbox",{name,exact:true});
    await page.goto(origin + "/auth/security", {waitUntil:"domcontentloaded"});
    await heading("二步验证").waitFor();
    const verify = button("验证并登录");
    assert.ok(await verify.isDisabled());
    await checkAction(verify);
    assert.ok(await field("6 位验证码").evaluate(el => el === document.activeElement));
    await snapshot(page, `verification-${width}-${theme}`);
    await field("6 位验证码").fill("007 234");
    assert.equal(await field("6 位验证码").inputValue(),"007234");
    await checkAction(verify);
    await verify.click();
    await page.getByRole("alert").waitFor();
    assert.equal(await field("6 位验证码").getAttribute("aria-invalid"),"true");
    await button("使用恢复码").click();
    assert.equal(await field("恢复码").inputValue(),"");
    assert.ok(await verify.isDisabled());
    await snapshot(page, `recovery-${width}-${theme}`);
    await field("恢复码").fill(recoveryCode);
    await verify.click();
    await heading("账号安全").waitFor();
    assert.deepEqual(calls.slice(0,2).map(c=>c.body), [{code:"007234",recovery:false},{code:recoveryCode,recovery:true}]);

    await button("绑定验证器").click();
    await page.getByRole("img",{name:"验证器绑定二维码"}).waitFor();
    assert.equal(await page.locator("details").first().getAttribute("open"),null);
    await snapshot(page, `setup-${width}-${theme}`);
    await page.getByText("手动输入密钥",{exact:true}).click();
    assert.ok(await page.getByText("DEMO",{exact:true}).isVisible());
    await field("6 位验证码").fill("012345");
    await button("确认绑定").click();
    await heading("保存恢复码").waitFor();
    assert.equal(await page.locator(".auth-codes li").count(),2);
    const downloaded = page.waitForEvent("download");
    await button("下载恢复码").click();
    assert.equal((await downloaded).suggestedFilename(),"AgentCommons-recovery-codes.txt");
    await button("我已保存").click();
    await button("重新生成恢复码").click();
    await button("使用恢复码").click(); await field("恢复码").fill(recoveryCode);
    await button("重新生成恢复码").click(); await heading("保存恢复码").waitFor();
    await button("我已保存").click();
    await button("关闭二步验证").click(); await button("取消").click();
    assert.equal(calls.filter(c=>c.auth === "/security/disable").length,0);
    await button("关闭二步验证").click();
    await field("6 位验证码").fill("012345"); await button("关闭二步验证").click();
    await button("绑定验证器").waitFor();
    assert.deepEqual(calls.filter(c=>c.auth.startsWith("/security/")).map(c=>[c.auth,c.body.recovery]),[
      ["/security/setup",undefined],["/security/confirm",false],["/security/recovery-codes",true],["/security/disable",false],
    ]);

    recent = false; await page.reload(); await page.getByRole("link",{name:"重新登录以绑定验证器"}).waitFor();
    session = "mfa_required"; await page.reload(); await button("取消登录").click();
    await heading("登录工作区").waitFor();
    await page.goto(origin + "/auth/setup"); await heading("配置 GitHub 登录").waitFor();
    await page.getByRole("link",{name:"返回登录页"}).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS verification, recovery, enrollment, download, regeneration, disable, cancel, reauthentication and setup at ${width}px / ${theme}`);
    await context.close();
  }
} finally { await browser.close(); }
