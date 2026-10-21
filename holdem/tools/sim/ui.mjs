// 실제 화면(브라우저)으로 게임을 치는 봇 — 버튼을 눌러 진행하며 화면 오류(자바스크립트 오류·표시 불일치·테이블 흔들림·멈춤)를 모음
// 사용: node ui.mjs <port> <games> [conc]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const PORT = Number(process.argv[2]); const GAMES = Number(process.argv[3] || 10); const CONC = Number(process.argv[4] || 4);
const URL = 'http://127.0.0.1:' + PORT + '/';
const issues = new Map();
const note = (kind, msg, extra) => { const k = kind + '|' + msg; const e = issues.get(k) || { n: 0, ex: [] }; e.n++; if (e.ex.length < 3) e.ex.push(extra); issues.set(k, e); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;
const b = await chromium.launch();
let seq = 0;

async function newPlayer(tag) {
  const ctx = await b.newContext({ viewport: pickVp() });
  const page = await ctx.newPage();
  const name = ('u' + (seq++).toString(36) + tag + Math.random().toString(36).slice(2, 5)).slice(0, 10);
  page.on('pageerror', (e) => note('js', e.message, { name, stack: (e.stack || '').split('\n').slice(0, 4).join(' | ') }));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) note('console', m.text().slice(0, 160), { name }); });
  await page.addInitScript(() => {
    // 서버 메시지·화면 상태 기록용 훅
    window.__log = [];
    const WS = window.WebSocket;
    window.WebSocket = function (...a) {
      const ws = new WS(...a);
      ws.addEventListener('message', (e) => { try { const m = JSON.parse(e.data); window.__last = window.__last || {}; window.__last[m.t] = m; window.__lastAt = Date.now(); if (m.t === 'state') window.__stateAt = Date.now(); window.__log.push(m.t); if (window.__log.length > 50) window.__log.shift(); } catch (er) { /* */ } });
      return ws;
    };
    window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  });
  await page.goto(URL);
  await page.fill('#nick', name); await page.fill('#pin', '1234'); await page.click('#loginBtn');
  await page.waitForSelector('#modesBox:not([hidden])', { timeout: 8000 });
  return { ctx, page, name };
}
function pickVp() { return [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 430, height: 932 }, { width: 1280, height: 800 }][rnd(0, 3)]; }

// 화면 점검 + 한 번 행동
async function step(pl, g) {
  const page = pl.page;
  const r = await page.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const out = { modal: $('#modal').classList.contains('show') ? ($('#modal').dataset.kind || 'x') : '', modalHtml: '', screen: [...document.querySelectorAll('.screen.active')].map((e) => e.id).join(',') };
    if (out.modal) out.modalHtml = $('#modalCard').innerText.slice(0, 80);
    out.modalBtns = out.modal ? [...document.querySelectorAll('#modalCard button')].filter((x) => !x.disabled).map((x) => x.id || x.dataset.join || x.dataset.v || x.textContent.slice(0, 8)) : [];
    const a = $('#actions');
    out.mine = a.classList.contains('mine'); out.pre = a.classList.contains('pre'); out.raising = a.classList.contains('raising');
    out.reveal = a.classList.contains('can-reveal');
    const t = $('#table').getBoundingClientRect(); out.table = [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height)];
    out.overflowX = document.documentElement.scrollWidth > innerWidth + 1;
    const st = window.__last && window.__last.state;
    out.stateAge = window.__stateAt ? Date.now() - window.__stateAt : -1;
    out.quiet = window.__lastAt ? Date.now() - window.__lastAt : -1;
    if (st && out.screen === 'game') {
      const v = st.view; out.hk = v.hk; out.stage = v.stage; out.legal = !!v.legal; out.handNo = v.handNo;
      const R = window.__rh.R;
      // 화면 표시 vs 서버 상태(조용할 때만 — 애니메이션이 끝난 뒤)
      if (out.stateAge > 2600 && R.v && R.v.hk === v.hk) {
        const seats = [...document.querySelectorAll('#seats .seat')];
        const fmt = (n) => Number(n).toLocaleString('ko-KR');
        const bad = [];
        v.players.forEach((p, i) => {
          const el = seats[i]; if (!el) return bad.push('seat ' + i + ' missing');
          const txt = el.querySelector('.stk').textContent;
          const want = p.empty ? '' : !p.inHand && p.stack <= 0 ? '칩 없음' : fmt(p.stack);
          if (txt !== want) bad.push(`${p.name} 칩 표시 ${txt} ≠ ${want}`);
          const cards = el.querySelectorAll('.cards .card').length;
          if (cards !== p.hole.length) bad.push(`${p.name} 카드 ${cards}장 표시 ≠ ${p.hole.length}`);
        });
        const bc = document.querySelectorAll('#board .card').length;
        if (bc !== v.board.length) bad.push(`보드 ${bc}장 ≠ ${v.board.length}`);
        if (v.stage !== 'done') { const pt = $('#potAmt').textContent; if ($('#pot').classList.contains('show') && pt !== fmt(v.pot) && v.pot > 0) bad.push(`팟 ${pt} ≠ ${fmt(v.pot)}`); }
        if (!!v.legal !== out.mine && !v.result) bad.push(`내 차례 표시 ${out.mine} ≠ ${!!v.legal}`);
        if (!v.result && $('#banner').className !== 'banner') bad.push('결과 없는데 배너 남음');
        out.bad = bad;
      }
      out.toAct = v.toAct; out.deadline = st.deadline;
      out.L = v.legal;
      out.rb = st.rebuy && st.rebuy.can;
    }
    return out;
  });
  if (r.overflowX) note('ui', '가로 스크롤 생김', { name: pl.name, screen: r.screen });
  if (r.bad && r.bad.length) for (const x of r.bad) note('ui', x.replace(/[\d,]+/g, 'N'), { name: pl.name, detail: x, hk: r.hk, stage: r.stage });
  if (r.screen === 'game' && !r.modal) {
    if (pl.tableRect && r.table.join() !== pl.tableRect && pl.vpKey === JSON.stringify(page.viewportSize())) note('ui', '테이블 크기/위치가 바뀜', { name: pl.name, was: pl.tableRect, now: r.table.join(), stage: r.stage });
    pl.tableRect = r.table.join(); pl.vpKey = JSON.stringify(page.viewportSize());
  }
  return r;
}

async function act(pl, r) {
  const page = pl.page;
  try {
    if (r.mine && !r.modal) {
      if (chance(0.03)) return;   // 가끔 생각하는 척(시간 초과도 가끔)
      const x = Math.random();
      if (x < 0.15 && !(await page.isDisabled('#foldBtn'))) await page.click('#foldBtn', { timeout: 1500 });
      else if (x < 0.6 || (r.L && !r.L.canRaise)) await page.click('#callBtn', { timeout: 1500 });
      else {
        await page.click('#raiseBtn', { timeout: 1500 });
        if (await page.evaluate(() => document.querySelector('#actions').classList.contains('raising'))) {
          const pres = await page.$$('#presets button');
          if (pres.length && chance(0.8)) await pres[rnd(0, pres.length - 1)].click({ timeout: 1500 });
          if (chance(0.3)) await page.click(chance(0.5) ? '#plus' : '#minus', { timeout: 1500 });
          await page.click('#raiseBtn', { timeout: 1500 });
        }
      }
    } else if (r.pre && !r.modal && chance(0.08)) {
      await page.click(chance(0.5) ? '#foldBtn' : '#callBtn', { timeout: 1500 });
    } else if (r.reveal && !r.modal && chance(0.15)) {
      const bs = await page.$$('#revealRow button[data-mask]:not([disabled])');
      if (bs.length) await bs[rnd(0, bs.length - 1)].click({ timeout: 1500 });
    } else if (r.rb && !r.modal && chance(0.5)) {
      const btn = (await page.$('#rebuyBtn:not([hidden])')) || (await page.$('#rebuyBtn2'));
      if (btn) await btn.click({ timeout: 1500 });
    } else if (!r.modal && r.screen === 'game' && chance(0.01)) {
      await page.click('#emoToggle', { timeout: 1500 }); const e = await page.$$('#emoPanel button'); if (e.length) await e[rnd(0, e.length - 1)].click({ timeout: 1500 });
    }
    if (r.modal) {
      if (r.modalBtns.includes('rbOk')) await page.click('#rbOk');
      else if (r.modalBtns.includes('biOk')) await page.click('#biOk');
    }
  } catch (e) { if (!/Timeout|detached|not attached|intercepts/.test(e.message)) note('bot', e.message.slice(0, 120), { name: pl.name }); }
}

async function playUntil(players, g, isOver, maxMs) {
  const t0 = Date.now();
  let lastProgress = Date.now(), lastKey = '';
  while (Date.now() - t0 < maxMs) {
    for (const pl of players) {
      if (pl.done) continue;
      let r;
      try { r = await step(pl, g); } catch (e) { note('bot', 'step: ' + e.message.slice(0, 100), {}); continue; }
      const key = r.hk + ':' + r.stage + ':' + r.toAct + ':' + r.handNo;
      if (key !== lastKey) { lastKey = key; lastProgress = Date.now(); }
      g.hands = Math.max(g.hands || 0, r.handNo || 0);
      if (await isOver(pl, r)) pl.done = true;
      else await act(pl, r);
    }
    if (players.every((p) => p.done)) return 'over';
    if (Date.now() - lastProgress > 40000) { note('stall', '화면이 40초 넘게 그대로', { g: g.id, mode: g.mode, key: lastKey }); return 'stall'; }
    await sleep(150);
  }
  return 'cap';
}

async function soloGame(g) {
  const pl = await newPlayer('s');
  await pl.page.click('[data-mode=solo]');
  await pl.page.waitForSelector('#biOk', { timeout: 5000 });
  const bl = await pl.page.$$('#biBlinds button'); if (bl.length) await bl[rnd(0, Math.min(3, bl.length - 1))].click();
  const q = await pl.page.$$('#biQuick button'); if (q.length) await q[rnd(0, q.length - 1)].click();
  await pl.page.click('#biOk');
  const cap = rnd(4, 12);
  const res = await playUntil([pl], g, async (p, r) => {
    if (r.modal === 'over') { g.ended = true; return true; }
    if ((r.handNo || 0) >= cap && r.stage === 'done') { await p.page.click('#exitBtn').catch(() => {}); await sleep(300); const m = await p.page.$('#modalCard button'); if (m) await m.click().catch(() => {}); return true; }
    return false;
  }, 240000);
  await sleep(800);
  await pl.ctx.close();
  return res;
}

async function friendsGame(g) {
  const n = rnd(2, 3);
  const pls = [];
  for (let i = 0; i < n; i++) pls.push(await newPlayer('f'));
  const host = pls[0];
  await host.page.click('[data-mode=friends]');
  await host.page.click('#rbCreate', { timeout: 5000 });
  await host.page.waitForSelector('#biOk', { timeout: 5000 });
  await host.page.click('#biOk');
  await host.page.waitForSelector('#lobby.active', { timeout: 5000 });
  const code = (await host.page.textContent('#roomCode')).trim();
  for (const p of pls.slice(1)) {
    await p.page.click('[data-mode=friends]');
    await p.page.waitForSelector(`#rbList [data-join="${code}"]`, { timeout: 8000 }).catch(() => note('ui', '열린 방 목록에 새 방이 안 보임', { code }));
    await p.page.click(`#rbList [data-join="${code}"]`, { timeout: 3000 }).catch(() => {});
    await p.page.waitForSelector('#biOk', { timeout: 5000 }).catch(() => {});
    await p.page.click('#biOk').catch(() => {});
    await p.page.waitForSelector('#lobby.active', { timeout: 5000 }).catch(() => note('ui', '방 입장 실패', { code }));
  }
  await sleep(500);
  if (chance(0.3)) await host.page.click('#botToggle').catch(() => {});
  await sleep(300);
  if (await host.page.isDisabled('#startBtn')) note('ui', '모두 앉았는데 시작 버튼이 꺼져 있음', { code });
  await host.page.click('#startBtn').catch(() => {});
  const cap = rnd(4, 10);
  // 중간에 관전으로 들어와 앉는 사람
  let late = null;
  const res = await playUntil(pls, g, async (p, r) => {
    if (!late && (r.handNo || 0) >= 2 && chance(0.02) && p === host) {
      late = await newPlayer('l');
      await late.page.click('[data-mode=friends]');
      await late.page.click(`#rbList [data-join="${code}"]`, { timeout: 8000 }).catch(() => {});
      await late.page.waitForSelector('#game.active', { timeout: 5000 }).catch(() => {});
      await sleep(500);
      const sit = await late.page.$('.sit-btn:not([disabled])');
      if (sit) { await sit.click().catch(() => {}); await late.page.waitForSelector('#biOk', { timeout: 3000 }).catch(() => {}); const pb = await late.page.$$('#biPost button'); if (pb.length) await pb[rnd(0, 1)].click().catch(() => {}); await late.page.click('#biOk').catch(() => {}); }
      pls.push(late);
    }
    if (r.modal === 'over') { g.ended = true; return true; }
    if (r.modal && /시간 초과/.test(r.modalHtml)) { note('info', '시간 초과 2번 → 방에서 나옴(정상 동작)', { name: p.name }); return true; }
    if (r.screen === 'home' && !r.modal) { note('ui', '게임 중 홈으로 튕김', { name: p.name }); return true; }
    if ((r.handNo || 0) >= cap && r.stage === 'done') return true;
    return false;
  }, 300000);
  for (const p of pls) { await p.page.click('#exitBtn').catch(() => {}); await sleep(200); }
  await sleep(1000);
  for (const p of pls) await p.ctx.close();
  return res;
}

const results = [];
let next = 0;
async function worker() {
  while (next < GAMES) {
    const id = ++next;
    const g = { id, mode: id % 2 ? 'solo' : 'friends' };
    let res;
    try { res = await (g.mode === 'solo' ? soloGame : friendsGame)(g); } catch (e) { note('bot', g.mode + ' crash: ' + e.message.slice(0, 120), {}); res = 'error'; }
    results.push({ id, mode: g.mode, res, hands: g.hands || 0 });
    console.log(`#${id} ${g.mode} ${res} hands=${g.hands || 0}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
await b.close();
console.log('UISUMMARY ' + JSON.stringify({ games: results.length, hands: results.reduce((s, r) => s + r.hands, 0), res: results.reduce((o, r) => ((o[r.res] = (o[r.res] || 0) + 1), o), {}) }));
console.log('UIISSUES ' + JSON.stringify(Object.fromEntries(issues), null, 1));
