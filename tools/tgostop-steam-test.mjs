// 스팀판 랭크 대전(줄다리기) 실제 플레이 점검: 브라우저 두 대(주소 tgsteam=1 = 스팀판 흉내)로 랭크 대전을 끝까지 둔다.
//  1) 판 고르기에 [랭크 대전] 한 칸만 · 2) 스팀판끼리 짝(dv s1) · 3) 판 위 세로 줄 · 4) 판 끝 결과 창 하나에 줄다리기가 합쳐짐(골드 줄 없음)
//  5) 버튼을 안 눌러도 약 3초 뒤 다음 판 · 6) 점수 차 50 또는 10판이면 경기 끝, 두 기기 결과가 반대로 같음 · 7) LP +25/−20, 골드 그대로
//   node tools/build.js && node tools/tgostop-steam-test.mjs [--shots 폴더]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SI = process.argv.indexOf('--shots'), SHOTS = SI > 0 ? (process.argv[SI + 1] || path.join(ROOT, 'scratch')) : null;
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
  const ctx = await br.newContext({ viewport:{ width:1600, height:900 } });
  await ctx.routeWebSocket(/battle-production/, ws => attach(ws));
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(tag + ' ' + String(e)));
  pg.on('console', m => { if(m.type() === 'error' && !/WebSocket|favicon/.test(m.text())) errs.push(tag + ' ' + m.text()); });
  await pg.addInitScript(a => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:help:tgostop', '1'); if(a) localStorage.setItem('hp:age19', '1'); }catch(_){} }, age);
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

const A = await mk('A', B + 'index.html?tgsteam=1'), Bp = await mk('B', B + 'index.html?tgsteam=1');
for(const x of [A, Bp]) await x.pg.waitForFunction(() => ROOM_STATE === 'ok', null, { timeout:15000 });
await A.pg.evaluate(() => duelStart('tgostop')); await w(400); await Bp.pg.evaluate(() => duelStart('tgostop'));
const lob = await A.pg.waitForFunction(() => document.querySelector('#gsLobby:not([hidden]) .gs-room'), null, { timeout:10000 }).then(() => A.pg.evaluate(() => ({ rank:document.querySelectorAll('#gsLobby [data-rank]').length, rooms:document.querySelectorAll('#gsLobby [data-r]').length, txt:document.querySelector('#gsLobby [data-rank]')?.textContent || '' }))).catch(() => ({}));
const gold0 = await A.pg.evaluate(() => NG.tgostop._pt.wallet().pt);   /* 출석 보상을 받은 뒤 */
ok(lob.rank === 1 && lob.rooms === 0, `판 고르기 = 랭크 대전 한 칸(${lob.txt})`);
if(SHOTS){ fs.mkdirSync(SHOTS, { recursive:true }); await A.pg.screenshot({ path:path.join(SHOTS, 'steam-lobby.png') }); }
await A.pg.evaluate(() => document.querySelector('#gsLobby [data-rank]').click()); await w(700);
const dv = await A.pg.evaluate(() => ROOM && ROOM.peers().find(p => p.sameTab)?.presence?.dv);   /* 상대 찾는 동안의 짝 표식 */
await Bp.pg.waitForFunction(() => document.querySelector('#gsLobby:not([hidden]) [data-rank]'), null, { timeout:10000 }).catch(() => {});
await Bp.pg.evaluate(() => document.querySelector('#gsLobby [data-rank]').click());
const started = await Promise.all([A, Bp].map(x => x.pg.waitForFunction(() => G && G.gs && G.gs.began && G.gs.mode === 'pvp', null, { timeout:25000 }).then(() => true).catch(() => false)));
ok(started.every(Boolean), '스팀판끼리 짝 · 선 뽑기 시작');
let lbl = '';
/* 두 기기를 끝까지: 판 끝 창이 뜰 때마다 줄다리기 칸 확인, 버튼은 누르지 않음 */
const seen = { tugWin:0, payRow:0, gauge:false, autoMs:[] }; let shot = 0, lastGi = -1, betweenAt = 0;
const t0 = Date.now();
while(Date.now() - t0 < 900000){
  const [sa, sb] = await Promise.all([step(A.pg, true), step(Bp.pg, false)]);
  const st = await A.pg.evaluate(() => ({ over:G.over, gi:G.gs.gi, ph:G.gs.phase, tug:!!document.querySelector('#gsAsk:not([hidden]) .gs-tugr'), pay:!!document.querySelector('#gsAsk:not([hidden]) .gs-pay'), gauge:!!document.querySelector('#gsTug:not([hidden])') }));
  if(st.gauge && st.ph === 'play'){ seen.gauge = true; if(!lbl) lbl = await A.pg.evaluate(() => document.querySelector('#gsTag')?.textContent || ''); }
  if(st.ph === 'between' && st.tug && betweenAt === 0){ betweenAt = Date.now(); seen.tugWin++; if(st.pay) seen.payRow++;
    if(SHOTS && shot < 3){ await w(900); await A.pg.screenshot({ path:path.join(SHOTS, `steam-result-${++shot}.png`) }); } }
  if(st.ph === 'play' && st.gi !== lastGi){ if(betweenAt) seen.autoMs.push(Date.now() - betweenAt); betweenAt = 0; lastGi = st.gi;
    if(SHOTS && st.gi === 1){ await w(2500); await A.pg.screenshot({ path:path.join(SHOTS, 'steam-board.png') }); } }
  if(st.over && await Bp.pg.evaluate(() => G.over)) break;
  await w(sa === 'wait' && sb === 'wait' ? 150 : 250);
}
const fin = await Promise.all([A, Bp].map(x => x.pg.evaluate(() => ({ over:G.over, r:G.duel && G.duel.r, why:G.duel && G.duel.why, rope:G.gs.rope, n:(G.gs.tgHist || []).length, rank:JSON.parse(localStorage.getItem('hp:tg:rank') || 'null'), live:localStorage.getItem('hp:tg:rklive'), pt:NG.tgostop._pt.wallet().pt }))));
console.log('  A:', fin[0].why); console.log('  B:', fin[1].why);
ok(dv === 's1', '짝 표식 dv = s1(스팀판끼리만)');
ok(/랭크/.test(lbl), '판 이름표: ' + lbl.trim());
ok(seen.gauge, '판 위 세로 줄다리기 보임');
ok(seen.tugWin > 0 && seen.payRow === 0, `판 끝 창 ${seen.tugWin}번 모두 줄다리기 칸 하나(골드 줄 없음)`);
const auto = seen.autoMs.filter(x => x > 0);
ok(auto.length === 0 || auto.every(x => x < 7000), `버튼 없이 다음 판 자동 시작(창 뜬 뒤 ${auto.map(x => (x / 1000).toFixed(1) + '초').join(', ') || '—'})`);
ok(fin.every(f => f.over), '두 기기 모두 경기 끝');
ok(fin[0].rope === -fin[1].rope && fin[0].n === fin[1].n, `줄 위치 같음(A ${fin[0].rope} / B ${fin[1].rope}, ${fin[0].n}판)`);
ok(Math.abs(fin[0].rope) >= 50 || fin[0].n === 10, '끝난 까닭 = 점수 차 50 또는 10판');
ok((fin[0].r === 'w' && fin[1].r === 'l') || (fin[0].r === 'l' && fin[1].r === 'w') || (fin[0].r === 'd' && fin[1].r === 'd'), `승패 반대로 같음(${fin[0].r}/${fin[1].r})`);
const lp = f => f.rank ? f.rank.lp : null;
ok(fin.every(f => f.rank && (f.r === 'w' ? f.rank.w === 1 && lp(f) === 25 : f.r === 'l' ? f.rank.l === 1 && lp(f) === 0 : true)), `LP: A ${lp(fin[0])} · B ${lp(fin[1])} (이김 +25 · 짐 −20, 나무 IV 바닥 0)`);
ok(fin.every(f => f.live === '0'), '진행 중 표시 지움(강제 종료 감점 없음)');
ok(fin[0].pt === gold0, `골드 그대로(${gold0})`);
const errs = [...A.errs, ...Bp.errs].filter(e => !/ERR_TUNNEL|ERR_NAME|net::ERR/.test(e));   /* 이 점검 환경은 바깥 글꼴 주소가 막혀 있음 */ ok(!errs.length, '콘솔 오류 없음' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await br.close(); srv.close();
console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과'); process.exit(fail ? 1 : 0);
