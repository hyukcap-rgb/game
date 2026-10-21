// ① 화면 그리기가 '계속' 실패하는 상황을 일부러 만들고 스스로 풀리는지 ② 화면 멈춤(3초)이 서버 로그에 남는지
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const U = 'http://127.0.0.1:4131/';
const tk = (await (await fetch(U + 'admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"simpw"}' })).json()).token;
await fetch(U + 'admin/api/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': tk }, body: '{"autoApprove":true}' });
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
await p.goto(U); await p.fill('#nick', 'heal' + Date.now() % 1e5); await p.fill('#pin', '1234'); await p.click('#loginBtn'); await p.waitForSelector('#modesBox:not([hidden])');
await p.click('[data-mode=solo]'); await p.click('#biOk'); await p.waitForSelector('#game.active'); await p.waitForTimeout(3000);
// 지난 화면(prev)이 남아 있는 동안 늘 실패하는 그리기 오류 — 예전 코드라면 새로고침 전까지 굳음
await p.evaluate(() => { const R = window.__rh.R; const o = R.renderBets; window.__boom = 0; R.renderBets = function (v, prev, nh) { if (prev && window.__boom < 1000 && v.handNo >= 1) { window.__boom++; throw new Error('지난 화면과 맞지 않는 그리기 오류(시험)'); } return o.call(this, v, prev, nh); }; });
let mine = 0; const t0 = Date.now();
while (Date.now() - t0 < 40000) { if (await p.evaluate(() => document.querySelector('#actions').classList.contains('mine'))) { mine++; await p.click('#callBtn', { timeout: 1000 }).catch(() => {}); } await p.waitForTimeout(300); }
const dbg = await p.evaluate(() => { const v = window.__rh.R.v; const me = v.players.find(x => x.id === window.__rh.R.myId); return { stage: v.stage, toAct: v.toAct, my: me && me.stack, modal: document.querySelector('#modal').classList.contains('show') && document.querySelector('#modalCard').innerText.slice(0,40), last: window.__last }; }); console.log(JSON.stringify(dbg));
console.log('그리기 오류 횟수', await p.evaluate(() => window.__boom), '| 그동안 내 차례 버튼이 켜져 직접 친 횟수', mine, '| 지금 핸드', await p.evaluate(() => window.__rh.R.v.handNo));
await p.evaluate(() => { 0; });   // 3.2초 화면 멈춤
await p.waitForTimeout(1500);
await b.close();
