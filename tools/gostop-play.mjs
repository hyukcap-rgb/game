// 고스톱 실제 플레이 점검(브라우저): 사람처럼 패를 눌러 끝까지 두어 본다.
//  1) 사이트에서 솔로 한 판(19세 확인 → 패 두 번 눌러 내기 → 고르기·고/스톱 → 정산 → 결과 창)
//  2) 붙여 쓰는 모듈: 오늘의 문제·연습이 없고 솔로·대전만 보이는지
//  3) 실시간 1:1 대전: 이 프로세스 안의 중계 서버로 브라우저 두 대를 붙여 선 뽑기 → 1판(A는 손대지 않음 = 8초 자동) → 바로 2판
//     (A 나가기 예약 → 취소 → 다시 예약) → 대전 끝. 판마다 두 기기의 판이 똑같은지
//  4) 끊김: 대전 중 한 쪽 브라우저를 닫아도 남은 쪽이 대신 자동으로 두어 판 끝까지 가고 대전이 끝나는지
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
    const room = document.querySelector('#gsLobby:not([hidden]) [data-r="1"]:not([disabled])') || document.querySelector('#gsLobby:not([hidden]) [data-r="0"]');
    if(room){ room.click(); return 'room'; }
    const sc = document.querySelector('#gsSun:not([hidden]) .sunc.can'); if(sc){ sc.click(); return 'sun'; }
    const ask = document.querySelector('#gsAsk:not([hidden])');
    if(ask && ask.querySelector('#gsEndBye')) return 'between';
    if(ask){
      const end = ask.querySelector('#gsEndOk'); if(end){ end.click(); return 'end'; }
      const bs = [...ask.querySelectorAll('[data-i]')]; if(!bs.length) return 'wait';
      const go = ask.querySelector('button.go'); if(go){ (goPref && G.gs.S.P[G.gs.me].go < 1 ? go : ask.querySelector('button.stop')).click(); return 'gs'; }
      bs[bs.length - 1].click(); return 'ask';
    }
    const g = G.gs; if(!g.S || g.phase !== 'play' || g.busy || g.picking || g.S.turn !== g.me || g.S.pendingGS >= 0) return 'wait';
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
if(!process.env.GSPVP){
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
for(const [stage, goPref] of process.env.GSPVP ? [] : [[1, true], [5, false], [25, true]]){
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
if(!process.env.GSPVP){
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
/* ---- 3b) AI 대전: 선 뽑기 → 연속 판 → 나가기 예약으로 끝 ---- */
if(!process.env.GSPVP){
  const x = await mk('aiduel');
  await x.pg.evaluate(() => startGame('gostop', 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:'AI 고수' } } }));
  await w(800);
  let t0 = Date.now(), seen2 = false, byeSet = false, last = '';
  while(Date.now() - t0 < 200000){
    last = await step(x.pg, false); if(last === 'over') break;
    const f = await x.pg.evaluate(() => ({ gi:G.gs.gi, ph:G.gs.phase }));
    if(f.gi >= 1 && f.ph === 'play'){ seen2 = true; if(!byeSet){ byeSet = true; await x.pg.evaluate(() => document.querySelector('#gsOut').click()); } }
    await w(last === 'wait' ? 150 : 250);
  }
  const f = await x.pg.evaluate(() => ({ over:G.over, tot:G.gs.tot, why:G.duel && G.duel.why, first:G.gs.first }));
  ok(seen2 && f.over && f.tot.n === 2, `AI 대전: 선 뽑기 → 1판 → 바로 2판 → 나가기 예약으로 끝 · ${f.why}`);
  ok(!x.errs.length, '오류 없음 ' + x.errs.join(' | '));
  await x.ctx.close();
}
/* ---- 4) 실시간 1:1 대전: 선 뽑기 · 8초 자동 · 연속 판 · 나가기 예약/취소 ---- */
async function pair(){
  const A = await mk('A'), Bp = await mk('B');
  await A.pg.waitForFunction(() => ROOM_STATE === 'ok', null, { timeout:15000 }); await Bp.pg.waitForFunction(() => ROOM_STATE === 'ok', null, { timeout:15000 });
  await A.pg.evaluate(() => duelStart('gostop')); await w(400); await Bp.pg.evaluate(() => duelStart('gostop'));
  const pickRoom = x => x.pg.waitForFunction(() => { const b = document.querySelector('#gsLobby:not([hidden]) [data-r="1"]'); if(b){ b.click(); return true; } return false; }, null, { timeout:10000 }).catch(() => {});
  await pickRoom(A); await w(300); await pickRoom(Bp);
  const started = await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G && G.gs && G.gs.began && G.gs.mode === 'pvp', null, { timeout:20000 }).then(() => true).catch(() => false)));
  ok(started.every(Boolean), '두 기기 연결 · 선 뽑기 시작');
  return [A, Bp];
}
const info = x => x.pg.evaluate(() => ({ seed:G.gs.seed0, h0:JSON.stringify(NG.gostop._rules.gsDeal(G.gs.seed0 + ':0').P), log:JSON.stringify(G.gs.log), ev:JSON.stringify(G.gs.ev), oev:JSON.stringify(G.gs.oev), over:G.over, phase:G.gs.phase, gi:G.gs.gi, me:G.gs.me, first:G.gs.first, seat:G.gs.seat, S:G.gs.S ? JSON.stringify(G.gs.S) : '', k:G.gs.k, bye:G.gs.bye, tot:G.gs.tot, r:G.duel && G.duel.r, why:G.duel && G.duel.why }));
{
  const [A, Bp] = await pair();
  if(SHOTS){ await w(900); await A.pg.screenshot({ path:path.join(SHOTS, 'gostop-sun.png') }); }
  const inPlay = await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G.gs.phase === 'play', null, { timeout:30000 }).then(() => true).catch(() => false)));
  const i0 = await Promise.all([A, Bp].map(info));
  ok(inPlay.every(Boolean) && i0[0].first === i0[1].first && i0[0].seat !== i0[1].seat && i0[0].me !== i0[1].me, `선 뽑기 결과가 같음 (선 자리 ${i0[0].first}, 내 S자리 ${i0[0].me}/${i0[1].me})`);
  if(SHOTS) await A.pg.screenshot({ path:path.join(SHOTS, 'gostop-pvp-start.png') });
  /* 1판: A는 아무것도 안 누름(8초마다 자동), B만 사람처럼 */
  let t0 = Date.now(), end0 = [null, null], autoShot = false;
  while(Date.now() - t0 < 300000 && !end0.every(Boolean)){
    const s = await step(Bp.pg, false);
    for(const [i, x] of [A, Bp].entries()){ if(end0[i]) continue; const f = await info(x); if(f.phase === 'between' || f.phase === 'decide' || f.gi > 0 || f.over) end0[i] = f; }
    if(SHOTS && !autoShot && Date.now() - t0 > 5500){ autoShot = true; await A.pg.screenshot({ path:path.join(SHOTS, 'gostop-timer.png') }); }
    await w(s === 'wait' ? 200 : 260);
  }
  ok(end0.every(Boolean) && end0[0].gi === 0 && end0[1].gi === 0, '1판 끝(A는 8초 자동만으로) ' + ((Date.now() - t0) / 1000 | 0) + '초');
  ok(end0[0] && end0[1] && end0[0].S === end0[1].S, '1판 두 기기 판 상태 똑같음');
  if(process.env.GSDBG && end0[0] && end0[0].S !== end0[1].S) console.log(end0.map(e => [e.seed, e.h0, e.gi, e.phase, e.log, e.ev, e.oev].join('\n')).join('\n----\n'));
  if(SHOTS) await Bp.pg.screenshot({ path:path.join(SHOTS, 'gostop-between.png') });
  /* 바로 2판 */
  const g2 = await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G.gs.gi === 1 && G.gs.phase === 'play', null, { timeout:40000 }).then(() => true).catch(() => false)));
  const i1 = await Promise.all([A, Bp].map(info));
  ok(g2.every(Boolean) && i1[0].first === i1[1].first, '한 판 끝나면 바로 다음 판 · 선 = 지난 판 이긴 사람 (' + i1[0].first + ')');
  const tg = await A.pg.evaluate(async () => { const b = document.querySelector('#gsOut'), r = []; b.click(); r.push(G.gs.bye, b.textContent); await new Promise(z => setTimeout(z, 300)); b.click(); r.push(G.gs.bye, b.textContent); await new Promise(z => setTimeout(z, 300)); b.click(); r.push(G.gs.bye); return r; });
  ok(tg[0] === true && tg[2] === false && tg[4] === true && /취소/.test(tg[1]), '나가기 예약 → 다시 누르면 취소 → 다시 예약: ' + JSON.stringify(tg));
  t0 = Date.now(); let done = [false, false];
  while(Date.now() - t0 < 240000 && !done.every(Boolean)){
    for(const [i, x] of [A, Bp].entries()){ if(done[i]) continue; const s = await step(x.pg, i === 0); if(s === 'over') done[i] = true; }
    await w(200);
  }
  await w(1500);
  const fin = await Promise.all([A, Bp].map(info));
  ok(done.every(Boolean), '2판 뒤 대전 끝(나가기 예약) · ' + (fin[0].why || ''));
  ok(fin[0].S === fin[1].S, '2판 두 기기 판 상태 똑같음');
  ok(fin[0].tot.n === 2 && fin[1].tot.n === 2 && fin[0].tot.w === fin[1].tot.l && fin[0].tot.d === fin[1].tot.d, `전적이 서로 맞음 A ${JSON.stringify(fin[0].tot)} / B ${JSON.stringify(fin[1].tot)}`);
  const rr = fin.map(f => f.r).join('/');
  ok(['w/l', 'l/w', 'd/d'].includes(rr), `승패가 서로 맞음 (${rr})`);
  ok(!A.errs.length && !Bp.errs.length, '오류 없음 ' + [...A.errs, ...Bp.errs].join(' | '));
  await A.ctx.close(); await Bp.ctx.close();
}
/* ---- 5) 끊김: B가 판 도중에 닫아도 A 쪽에서 B 차례를 자동으로 대신 두며 끝까지 ---- */
{
  const [A, Bp] = await pair();
  await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G.gs.phase === 'play', null, { timeout:30000 }).catch(() => {})));
  for(let n = 0; n < 12; n++){ await step(A.pg, false); await step(Bp.pg, false); await w(300); }
  const k0 = (await info(A)).k;
  await Bp.ctx.close();
  const t0 = Date.now(); let last = '';
  while(Date.now() - t0 < 150000){ last = await step(A.pg, false); if(last === 'over') break; await w(250); }
  const f = await info(A);
  ok(f.over && f.k > k0, `상대가 나가도 판 끝까지 자동 진행 후 대전 끝 (${k0}→${f.k}수, ${((Date.now() - t0) / 1000) | 0}초) · ${f.why || ''}`);
  ok(!A.errs.length, '오류 없음 ' + A.errs.join(' | '));
  await A.ctx.close();
}
await br.close(); srv.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
