// 4명이 휴대폰처럼 느린 브라우저로 오래 칠 때 화면이 멈추는지(메인 스레드 응답 시간·DOM·메모리·쌓이는 것) 측정
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const PORT = process.argv[2], MIN = Number(process.argv[3] || 10), THROTTLE = Number(process.argv[4] || 4);
const U = 'http://127.0.0.1:' + PORT + '/';
const tk = (await (await fetch(U + 'admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"simpw"}' })).json()).token;
await fetch(U + 'admin/api/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': tk }, body: '{"autoApprove":true,"welcomeChips":5000000}' });
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const UA = 'Mozilla/5.0 (Linux; Android 16; SM-S948N Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.207 Mobile Safari/537.36 KAKAOTALK/26.8.3 (INAPP)';
const P = [];
const t = Date.now().toString(36).slice(-4);
for (const k of 'abcd') {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, userAgent: UA, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await cdp.send('Performance.enable');
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // 메인 스레드 멈춤 측정: 50ms마다 찍는 타이머가 얼마나 늦게 도는지
  await page.addInitScript(() => { window.__lag = { max: 0, last: performance.now(), long: 0 }; setInterval(() => { const n = performance.now(); const d = n - window.__lag.last - 50; if (d > window.__lag.max) window.__lag.max = d; if (d > 1000) window.__lag.long++; window.__lag.last = n; }, 50); });
  await page.goto(U); await page.fill('#nick', 's' + k + t); await page.fill('#pin', '1234'); await page.tap('#loginBtn');
  await page.waitForSelector('#modesBox:not([hidden])');
  P.push({ k, page, cdp, errs });
}
const A = P[0].page;
await A.tap('[data-mode=friends]'); await A.tap('#rbCreate'); await A.tap('#biOk'); await A.waitForSelector('#lobby.active');
const code = (await A.textContent('#roomCode')).trim();
for (const p of P.slice(1)) { await p.page.tap('[data-mode=friends]'); await p.page.tap(`#rbList [data-join="${code}"]`, { timeout: 8000 }); await p.page.tap('#biOk'); await p.page.waitForSelector('#lobby.active'); }
await A.waitForTimeout(600); await A.tap('#startBtn');
const t0 = Date.now(); let lastReport = 0;
const hist = [];
while (Date.now() - t0 < MIN * 60000) {
  for (const p of P) {
    const s0 = Date.now();
    let st;
    try {
      st = await p.page.evaluate(() => ({ mine: document.querySelector('#actions').classList.contains('mine'), modal: document.querySelector('#modal').classList.contains('show') ? document.querySelector('#modalCard').innerText.slice(0, 30) : '', hand: window.__rh.R.v && window.__rh.R.v.handNo, rb: !!(document.querySelector('#rebuyBtn') && !document.querySelector('#rebuyBtn').hidden) }));
    } catch (e) { st = { err: e.message.slice(0, 80) }; }
    const evalMs = Date.now() - s0;
    if (evalMs > 2000) console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${p.k} 화면 응답 ${evalMs}ms 늦음`);
    try {
      if (st.modal && /리바인/.test(st.modal)) await p.page.tap('#rbOk', { timeout: 1500 });
      else if (st.modal) { const c = await p.page.$('#modalCard [data-close], #again'); if (c) await c.tap({ timeout: 1500 }); }
      else if (st.rb) await p.page.tap('#rebuyBtn', { timeout: 1500 });
      else if (st.mine) {
        const r = Math.random();
        if (r < 0.15 && !(await p.page.isDisabled('#foldBtn'))) await p.page.tap('#foldBtn', { timeout: 1500 });
        else if (r < 0.8) await p.page.tap('#callBtn', { timeout: 1500 });
        else if (!(await p.page.isDisabled('#raiseBtn'))) { await p.page.tap('#raiseBtn', { timeout: 1500 }); const pr = await p.page.$$('#presets button'); if (pr.length) await pr[Math.floor(Math.random() * pr.length)].tap({ timeout: 1500 }).catch(() => {}); await p.page.tap('#raiseBtn', { timeout: 1500 }).catch(() => {}); }
        else await p.page.tap('#callBtn', { timeout: 1500 });
      } else if (Math.random() < 0.01) { await p.page.tap('#emoToggle', { timeout: 1500 }); const e = await p.page.$$('#emoPanel button'); if (e.length) await e[Math.floor(Math.random() * e.length)].tap({ timeout: 1500 }); }
    } catch (e) { /* */ }
  }
  if (Date.now() - lastReport > 30000) {
    lastReport = Date.now();
    const row = { s: Math.round((Date.now() - t0) / 1000) };
    for (const p of P) {
      const m = Object.fromEntries((await p.cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      const x = await p.page.evaluate(() => ({ lag: Math.round(window.__lag.max), long: window.__lag.long, dom: document.getElementsByTagName('*').length, fx: document.querySelector('#fx').children.length, seats: document.querySelector('#seats').getElementsByTagName('*').length, hand: window.__rh.R.v && window.__rh.R.v.handNo })).catch((e) => ({ err: e.message.slice(0, 50) }));
      await p.page.evaluate(() => { window.__lag.max = 0; });
      row[p.k] = `lag${x.lag}ms dom${x.dom} fx${x.fx} seat${x.seats} heap${Math.round(m.JSHeapUsedSize / 1e6)}MB nodes${m.Nodes} listeners${m.JSEventListeners} h${x.hand}`;
    }
    hist.push(row);
    console.log(JSON.stringify(row));
  }
  await A.waitForTimeout(120);
}
for (const p of P) console.log(p.k, 'errors', p.errs.slice(0, 5));
await b.close();
