// 고스톱 실제 플레이 점검(브라우저): 사람처럼 패를 눌러 끝까지 두어 본다.
//  1) 사이트에서 솔로 한 판(19세 확인 → 패 두 번 눌러 내기 → 고르기·고/스톱 → 정산 → 결과 창)
//  2) 붙여 쓰는 모듈: 오늘의 문제·연습이 없고 솔로·대전만 보이는지
//  3) 실시간 1:1 대전: 이 프로세스 안의 중계 서버로 브라우저 두 대를 붙여 끝까지 두고, 두 기기의 판이 똑같은지
//   node tools/build.js && node tools/gostop-play.mjs [--shots]   (--shots: 390px 화면 사진을 scratch/ 에 저장)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots') ? (process.env.SHOT_DIR || path.join(ROOT, 'scratch')) : null;
if(SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
const T = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if(!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type':T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const B = `http://127.0.0.1:${srv.address().port}/`; const w = ms => new Promise(r => setTimeout(r, ms));
/* 중계(server/index.ts와 같은 동작) */
const rooms = new Map(), last = new Map(); let N = 0;
const snapP = r => [...(rooms.get(r) || [])].map(c => ({ peer:c.id, presence:c.rooms.get(r) || {} }));
function flush(r){ const set = rooms.get(r); const peers = snapP(r), ids = peers.map(p => p.peer), prev = last.get(r) || [];
  const joined = ids.filter(x => !prev.includes(x)).map(peer => ({ peer })), left = prev.filter(x => !ids.includes(x)).map(peer => ({ peer }));
  if(!set || !set.size){ rooms.delete(r); last.delete(r); return; } last.set(r, ids);
  for(const c of set) c.send({ t:'peers', r, you:c.id, peers, joined, left }); }
function leave(c, r){ if(!c.rooms.has(r)) return; c.rooms.delete(r); const s = rooms.get(r); if(s){ s.delete(c); flush(r); } }
function attach(ws){ const c = { id:'p' + (++N) + 'x' + Math.random().toString(36).slice(2, 8), rooms:new Map(), send:m => { try{ ws.send(JSON.stringify(m)); }catch(_){} } };
  c.send({ t:'hello', you:c.id, now:Date.now() });
  ws.onMessage(raw => { let m; try{ m = JSON.parse(String(raw)); }catch{ return; }
    if(m.t === 'ping'){ c.send({ t:'pong', now:Date.now() }); return; }
    const r = typeof m.r === 'string' ? m.r.slice(0, 64) : ''; if(!r) return;
    if(m.t === 'join'){ if(c.rooms.has(r)){ flush(r); return; } let s = rooms.get(r); if(!s){ s = new Set(); rooms.set(r, s); } s.add(c); c.rooms.set(r, {}); flush(r); }
    else if(m.t === 'leave') leave(c, r);
    else if(m.t === 'p'){ const cur = c.rooms.get(r); if(!cur || !m.p) return; c.rooms.set(r, { ...cur, ...m.p }); setTimeout(() => flush(r), r.startsWith('fl-') ? 0 : 60); } });
  ws.onClose(() => { for(const r of [...c.rooms.keys()]) leave(c, r); }); }

const br = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
let fail = 0;
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if(!c) fail++; };
async function mk(tag, url, age = true){
  const ctx = await br.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
  await ctx.routeWebSocket(/battle-production/, ws => attach(ws));
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(tag + ' ' + String(e)));
  pg.on('console', m => { if(m.type() === 'error' && !/WebSocket|favicon/.test(m.text())) errs.push(tag + ' ' + m.text()); });
  await pg.addInitScript(a => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:help:gostop', '1'); if(a) localStorage.setItem('hp:age19', '1'); }catch(_){} }, age);
  await pg.goto(url || B + 'index.html'); await w(600);
  await pg.evaluate(() => typeof closeModal === 'function' && closeModal());
  return { ctx, pg, errs };
}
/* 한 수 두기(사람처럼): 차례면 패를 두 번 누르고, 창이 뜨면 버튼을 누름. 고/스톱은 seed에 따라 고 또는 스톱 */
async function step(pg, goPref){
  return pg.evaluate(goPref => {
    if(!G || !G.gs) return 'nogame';
    if(G.over) return 'over';
    const ask = document.querySelector('#gsAsk:not([hidden])');
    if(ask){
      const end = ask.querySelector('#gsEndOk'); if(end){ end.click(); return 'end'; }
      const bs = [...ask.querySelectorAll('[data-i]')]; if(!bs.length) return 'wait';
      const go = ask.querySelector('button.go'); if(go){ (goPref && G.gs.S.P[G.gs.me].go < 1 ? go : ask.querySelector('button.stop')).click(); return 'gs'; }
      bs[bs.length - 1].click(); return 'ask';
    }
    const g = G.gs; if(!g.S || g.busy || g.S.turn !== g.me || g.S.pendingGS >= 0) return 'wait';
    const cards = [...document.querySelectorAll('#gsHand .gs-c.hd')]; if(!cards.length) return 'wait';
    const c = cards.find(x => x.classList.contains('match')) || cards[0];
    c.click(); c.click(); return 'play';
  }, goPref);
}
async function playOut(x, goPref, maxMs = 120000){
  const t0 = Date.now(); let plays = 0, last = '';
  while(Date.now() - t0 < maxMs){
    const s = await step(x.pg, goPref); last = s;
    if(s === 'play') plays++;
    if(s === 'over' || s === 'end') break;
    await w(s === 'wait' ? 150 : 250);
  }
  return { plays, last };
}

/* ---- 1) 19세 확인 거절 ---- */
{
  const x = await mk('gate', null, false);
  await x.pg.evaluate(() => startGame('gostop', null, { adv:1 }));
  await w(500);
  const gate = await x.pg.evaluate(() => !!document.querySelector('#gsGate') && !!document.querySelector('#ptitle .gs19'));
  ok(gate, '처음엔 19세 확인 창 · 제목에 19 표시');
  if(SHOTS) await x.pg.screenshot({ path:path.join(SHOTS, 'gostop-gate.png') });
  await x.pg.click('#gsAgeN'); await w(500);
  const home = await x.pg.evaluate(() => $('#home').style.display !== 'none' && localStorage.getItem('hp:age19') == null);
  ok(home, '아니요 → 게임 안 하고 홈으로');
  ok(!x.errs.length, '오류 없음 ' + x.errs.join(' | '));
  await x.ctx.close();
}
/* ---- 2) 솔로 한 판 끝까지 ---- */
for(const [stage, goPref] of [[1, true], [5, false], [25, true]]){
  const x = await mk('solo' + stage);
  await x.pg.evaluate(n => startGame('gostop', null, { adv:n }), stage);
  await w(1400);
  if(SHOTS && stage === 1){
    for(let k = 0; k < 6; k++){ await step(x.pg, goPref); await w(1500); }
    await x.pg.screenshot({ path:path.join(SHOTS, 'gostop-mid.png') });
    await x.pg.evaluate(() => { const c = document.querySelector('#gsHand .gs-c.hd'); if(c) c.click(); }); await w(300);
    await x.pg.screenshot({ path:path.join(SHOTS, 'gostop-select.png') });
  }
  const r = await playOut(x, goPref);
  await w(900);
  const st = await x.pg.evaluate(() => ({ over:G.over, res:G.gs.res, modal:(document.querySelector('#modal h3') || {}).textContent || '', stars:G.gs.res && G.gs.res.w === G.gs.me ? NG.gostop.stars() : 0 }));
  if(SHOTS && stage === 1) await x.pg.screenshot({ path:path.join(SHOTS, 'gostop-result.png') });
  ok(st.over && st.res && /클리어|아쉬워요/.test(st.modal), `솔로 ${stage}: ${r.plays}수 · ${st.res ? (st.res.w < 0 ? '나가리' : st.res.w === 0 ? '좌석0 승' : '좌석1 승') + ' ' + st.res.final + '점 ' + st.res.why : '?'} · 결과 창 "${st.modal.trim()}"`);
  ok(!x.errs.length, '오류 없음 ' + x.errs.join(' | '));
  await x.ctx.close();
}
/* ---- 3) 모듈: 솔로·대전만 ---- */
{
  const x = await mk('embed', B + 'embed/gostop.html?ns=t');
  const m = await x.pg.evaluate(() => [...document.querySelectorAll('.em-go')].map(b => b.dataset.m));
  ok(m.join(',') === 'solo,duel', '모듈 첫 화면 모드: ' + m.join(','));
  if(SHOTS) await x.pg.screenshot({ path:path.join(SHOTS, 'gostop-embed-menu.png') });
  await x.pg.evaluate(() => HaruPuzzleEmbed.start('daily')); await w(800);
  const cur = await x.pg.evaluate(() => EMB.cur);
  ok(cur === 'solo', '모듈에서 오늘의 문제를 부르면 솔로로: ' + cur);
  ok(!x.errs.length, '오류 없음 ' + x.errs.join(' | '));
  await x.ctx.close();
}
/* ---- 4) 실시간 1:1 대전 ---- */
{
  const A = await mk('A'), Bp = await mk('B');
  await A.pg.waitForFunction(() => ROOM_STATE === 'ok', null, { timeout:15000 }); await Bp.pg.waitForFunction(() => ROOM_STATE === 'ok', null, { timeout:15000 });
  await A.pg.evaluate(() => duelStart('gostop')); await w(400); await Bp.pg.evaluate(() => duelStart('gostop'));
  const started = await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G && G.gs && G.gs.began && G.gs.mode === 'pvp', null, { timeout:20000 }).then(() => true).catch(() => false)));
  ok(started.every(Boolean), '두 기기 연결 · 같은 판 시작');
  if(SHOTS) await A.pg.screenshot({ path:path.join(SHOTS, 'gostop-pvp-start.png') });
  const seats = await Promise.all([A, Bp].map(x => x.pg.evaluate(() => G.gs.me)));
  ok(seats[0] !== seats[1], '자리 나눔 ' + seats.join('/'));
  const t0 = Date.now(); let done = [false, false];
  while(Date.now() - t0 < 240000 && !done.every(Boolean)){
    for(const [i, x] of [A, Bp].entries()){ if(done[i]) continue; const s = await step(x.pg, i === 0); if(s === 'over' || s === 'end') done[i] = true; }
    await w(200);
  }
  await w(1500);
  const fin = await Promise.all([A, Bp].map(x => x.pg.evaluate(() => ({ me:G.gs.me, res:G.gs.res, S:JSON.stringify(G.gs.S), r:G.duel && G.duel.r, txt:(document.querySelector('#modal h3') || {}).textContent || '' }))));
  ok(done.every(Boolean), '대전 끝까지');
  ok(fin[0].S === fin[1].S, '두 기기의 판 상태가 똑같음');
  const rr = fin.map(f => f.r).join('/');
  ok(['w/l', 'l/w', 'd/d'].includes(rr), `승패가 서로 맞음 (${rr}) · 결과 창 "${fin[0].txt.trim()}" / "${fin[1].txt.trim()}" · ${fin[0].res ? fin[0].res.final + '점 ' + fin[0].res.why : ''}`);
  if(SHOTS) await Bp.pg.screenshot({ path:path.join(SHOTS, 'gostop-pvp-end.png') });
  ok(!A.errs.length && !Bp.errs.length, '오류 없음 ' + [...A.errs, ...Bp.errs].join(' | '));
  await A.ctx.close(); await Bp.ctx.close();
}
await br.close(); srv.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
