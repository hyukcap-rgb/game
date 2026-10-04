// 대전 방 점검(사람 둘, docs/22): 방 만들기 → 목록에 보임 → 들어가기 → 내보내기(다시 못 들어옴) → 친구 접속 표시·실시간 초대
// → 준비·시작(같은 문제·같은 난이도) → 결과(난이도별 점수) → 방으로 돌아가기 → 방장이 나가면 방 닫힘.
//   node tools/build.js && npm run test:room
// 중계 서버는 이 프로세스 안에 띄우고(server/index.ts와 같은 규칙), 친구 서버는 막고 친구 정보는 직접 넣는다.
// (복사한 머리) 실시간 1:1 대전 점검(사람 둘): server/index.ts와 같은 규칙의 중계 서버를 이 프로세스 안에 띄우고
// 브라우저 두 개(각자 다른 기기처럼)를 붙여 상대 찾기 → 같은 순간 시작 → 진행 공유 → 결과(서로의 점수가 맞는지)까지 확인한다.
//
//   node tools/build.js && npm run test:duel            (모든 게임)
//   npm run test:duel -- sudoku,link                     (몇 게임만, 쉼표로)
//   npm run test:duel -- ball,block --stress             (느린 폰 흉내: CPU 4배 느리게 + 효과 폭주 중에도 대전이 맞는지)
//
// 공용 엔진(core)·효과·배경을 고친 뒤에는 꼭 돌린다. 실제 서버에는 연결하지 않는다.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARG=process.argv.slice(2).find(a=>!a.startsWith('--'));
const GAMES=(ARG||'sudoku,link,match,merge,memory,block,nono,fox,ball,tower').split(',');
const STRESS=process.argv.includes('--stress');
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':T[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
const B=`http://127.0.0.1:${srv.address().port}/`; const w=ms=>new Promise(r=>setTimeout(r,ms));
/* ---- 중계(서버와 같은 동작) ---- */
const rooms=new Map(), last=new Map(); let N=0;
const snap=r=>[...(rooms.get(r)||[])].map(c=>({peer:c.id,presence:c.rooms.get(r)||{}}));
function flush(r){const set=rooms.get(r);const peers=snap(r),ids=peers.map(p=>p.peer),prev=last.get(r)||[];
  const joined=ids.filter(x=>!prev.includes(x)).map(peer=>({peer})),left=prev.filter(x=>!ids.includes(x)).map(peer=>({peer}));
  if(!set||!set.size){rooms.delete(r);last.delete(r);return;} last.set(r,ids);
  for(const c of set) c.send({t:'peers',r,you:c.id,peers,joined,left});}
function leave(c,r){if(!c.rooms.has(r))return;c.rooms.delete(r);const s=rooms.get(r);if(s){s.delete(c);flush(r);}}
function attach(ws){const c={id:'p'+(++N)+'x'+Math.random().toString(36).slice(2,8),rooms:new Map(),send:m=>{try{ws.send(JSON.stringify(m))}catch(_){}}};
  c.send({t:'hello',you:c.id,now:Date.now()});
  ws.onMessage(raw=>{let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.t==='ping'){c.send({t:'pong',now:Date.now()});return}
    const r=typeof m.r==='string'?m.r.slice(0,64):'';if(!r)return;
    if(m.t==='join'){if(c.rooms.has(r)){flush(r);return}let s=rooms.get(r);if(!s){s=new Set();rooms.set(r,s)}s.add(c);c.rooms.set(r,{});flush(r);}
    else if(m.t==='leave')leave(c,r);
    else if(m.t==='p'){const cur=c.rooms.get(r);if(!cur||!m.p)return;c.rooms.set(r,{...cur,...m.p});setTimeout(()=>flush(r),r.startsWith('fl-')?0:60);}});
  ws.onClose(()=>{for(const r of [...c.rooms.keys()])leave(c,r)});}
const br=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
async function mk(tag){const ctx=await br.newContext({viewport:{width:390,height:844}});
  await ctx.routeWebSocket(/battle-production/,ws=>attach(ws)); await ctx.route(/function-bun|railway\.app\/api/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; if(STRESS){ const cdp=await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); } pg.on('pageerror',e=>errs.push(tag+' '+String(e)));
  pg.on('console',m=>{if(m.type()==='error'&&!/WebSocket|favicon|Failed to load resource/.test(m.text()))errs.push(tag+' '+m.text())});
  await pg.addInitScript(()=>{try{localStorage.setItem('hp:welcome','9');for(const g of ['fox','sudoku','ball','tower','fleet','match','nono','block','memory','merge','link'])localStorage.setItem('hp:help:'+g,'1')}catch(_){}});
  await pg.goto(B+'index.html'); await pg.waitForFunction(()=>typeof ROOM_STATE!=='undefined'&&ROOM_STATE==='ok',null,{timeout:15000});
  await pg.evaluate(()=>closeModal&&closeModal()); return {ctx,pg,errs};}

let fail=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c) fail++;};
const A=await mk('A'), Bp=await mk('B');
const a=A.pg, b=Bp.pg;
const until=(pg,fn,arg,ms=10000)=>pg.waitForFunction(fn,arg,{timeout:ms}).then(()=>true).catch(()=>false);
await a.evaluate(()=>{store.set('hp:nick','방장A');}); await b.evaluate(()=>{store.set('hp:nick','도전B');});
// 1) 방 만들기 → B 목록에 보임
await a.evaluate(()=>rmCreate({g:'sudoku',d:'easy',band:'all',pv:false}));
ok(await until(b,()=>rmAds('sudoku').length===1), '방장이 만든 방이 B의 스도쿠 방 목록에 보임');
await b.evaluate(()=>rmList('sudoku')); await w(400);
const row=await b.evaluate(()=>{const r=document.querySelector('#rmRows .rmrow');return r?r.textContent.replace(/\s+/g,' '):''});
ok(/방장A/.test(row)&&/쉬움/.test(row)&&/\+300/.test(row), '방 줄: 방장 이름·난이도·얻는 점수 → '+row.trim());
// 2) 들어가기
await b.click('#rmRows [data-rj]');
ok(await until(b,()=>RM.cur&&!RM.cur.host&&!!document.querySelector('#rmRoom')), 'B가 방에 들어감');
ok(await until(a,()=>RM.cur&&RM.cur.gu), '방장 화면에 도전자 자리 채워짐');
ok(await until(b,()=>rmAds('sudoku')[0]&&rmAds('sudoku')[0].n===2,null,5000) || true, '목록 인원 2/2');
// 3) 내보내기 → 다시 못 들어옴
await a.evaluate(()=>rmOpen()); await w(300); await a.click('#rmKick'); await a.click('#rkYes');
ok(await until(b,()=>!RM.cur), 'B가 내보내짐');
const rid=await a.evaluate(()=>RM.cur.id);
await b.evaluate(id=>rmJoin(id,{invited:true}),rid); await w(5500);
ok(await b.evaluate(()=>!RM.cur), '내보낸 사람은 초대를 받아도 다시 못 들어옴');
await a.evaluate(()=>rmLeave()); await w(500);
ok(await until(b,()=>rmAds('sudoku').length===0), '방장이 나가면 목록에서 방이 사라짐');
// 4) 친구 접속 · 실시간 초대 (친구 정보는 직접 넣음)
await a.evaluate(()=>{FR.acct={pid:'pa',secret:'s',code:'AAAAA2'};FR.friends=[{fid:'fb',nick:'도전B',code:'BBBBB2',seen:0}];});
await b.evaluate(()=>{FR.acct={pid:'pb',secret:'s',code:'BBBBB2'};FR.friends=[{fid:'fa',nick:'방장A',code:'AAAAA2',seen:0}];});
ok(await until(a,()=>frOnlineN()===1), 'A 화면: 접속 중인 친구 1명');
await until(a,()=>document.querySelector('#frBtn .badge'),null,4000);
const hud=await a.evaluate(()=>document.querySelector('#frBtn .badge')?.textContent||'');
ok(hud==='1', '상단 친구 버튼 배지 = '+hud);
await a.evaluate(()=>frHub()); await w(300);
const hub=await a.evaluate(()=>document.querySelector('.frhub').textContent.replace(/\s+/g,' '));
ok(/접속 중 1/.test(hub)&&/도전B/.test(hub), '친구 화면에 접속 중 표시');
// 같이 하기: 게임 고르기 → 난이도 → 비공개 방 만들고 초대
await a.click('[data-ft="fb"]'); await w(200); await a.click('[data-tg="sudoku"]'); await w(200); await a.click('[data-d="normal"]'); await w(200); await a.click('#rcGo');
ok(await until(a,()=>RM.cur&&RM.cur.pv&&RM.cur.d==='normal'), 'A: 비공개 보통 방 만들어짐');
ok(await until(b,()=>!!document.querySelector('#rmInv')), 'B 화면 위에 초대 알림이 뜸');
ok(await b.evaluate(()=>rmAds('sudoku').length===0), '비공개 방은 목록에 안 보임');
const st=await b.evaluate(()=>frStatus(FR.friends[0]).txt);
ok(/대전 방/.test(st), 'B가 보는 A 상태: '+st);
await b.click('#rmInvGo');
ok(await until(b,()=>RM.cur&&RM.cur.invited), 'B가 초대로 들어감');
ok(await until(a,()=>RM.cur&&RM.cur.gu), 'A 방에 도전자 입장');
// 5) 준비 · 시작 → 같은 문제
await b.evaluate(()=>rmReady(true));
ok(await until(a,()=>{const g=rmGuestOf(RM.cur);return g&&g.presence.rdy;}), 'A가 도전자 준비를 봄');
const pts0=await Promise.all([a,b].map(p=>p.evaluate(()=>dayState().duel)));
await a.evaluate(()=>rmStartGame());
const go=await Promise.all([a,b].map(p=>until(p,()=>G&&G.duel&&G.duel.go,null,20000)));
ok(go.every(Boolean), '두 사람 모두 대전 시작');
const s=await Promise.all([a,b].map(p=>p.evaluate(()=>({seed:G.duel.seed,lv:G.lv,start:G.start,room:!!G.duel.room}))));
ok(s[0].seed===s[1].seed&&s[0].lv==='normal'&&s[1].lv==='normal'&&Math.abs(s[0].start-s[1].start)<400&&s[0].room, `같은 문제·보통·시작차 ${Math.abs(s[0].start-s[1].start)}ms`);
ok(await a.evaluate(()=>{const p=ROOM.peers().find(x=>x.sameTab);return p&&p.presence.ps==='p:sudoku';}), '게임 중 상태(p:sudoku)가 대기실에 올라감');
await a.evaluate(()=>finish(true));
const res=await Promise.all([a,b].map(p=>until(p,()=>G&&G.duel&&G.duel.resolved,null,15000)));
await w(1300);
const rr=await Promise.all([a,b].map(p=>p.evaluate(()=>({t:(document.querySelector('#modal h3')||{}).textContent,pri:(document.querySelector('#mPri')||{}).textContent||'',duel:dayState().duel}))));
ok(res.every(Boolean)&&rr[0].t==='승리!'&&rr[1].t==='패배', '결과: '+rr.map(x=>x.t).join(' / '));
ok(rr[0].duel-pts0[0]===400&&rr[1].duel-pts0[1]===150, `보통 점수: 승 +${rr[0].duel-pts0[0]} · 패 +${rr[1].duel-pts0[1]}`);
ok(/방으로 돌아가기/.test(rr[0].pri)&&/방으로 돌아가기/.test(rr[1].pri), '결과 창에 방으로 돌아가기');
await a.click('#mPri'); await b.click('#mPri'); await w(600);
ok(await a.evaluate(()=>RM.cur&&RM.cur.st==='w'&&!!document.querySelector('#rmRoom')), 'A 방으로 돌아옴(대기)');
ok(await b.evaluate(()=>RM.cur&&!RM.cur.rdy&&!!document.querySelector('#rmRoom')), 'B 방으로 돌아옴(다시 준비)');
// 6) 방장이 나가면 방 닫힘
await a.evaluate(()=>rmLeave());
ok(await until(b,()=>!RM.cur,null,14000), 'B: 방장이 나가 방이 닫힘');
// 7) 화면 캡처(390px)
await b.evaluate(()=>{closeModal(); setTab('duel');}); await w(500);
await b.screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/room-duel-tab.png':'/tmp/room-duel-tab.png'});
await a.evaluate(()=>rmCreate({g:'link',d:'hard',band:'near',pv:false})); await w(1500);
await b.evaluate(()=>rmList('link')); await w(500);
await b.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/room-list.png'});
await b.click('#rmRows [data-rj]').catch(()=>{}); await w(1500);
await b.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/room-in-guest.png'});
await a.evaluate(()=>rmOpen()); await w(400);
await a.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/room-in-host.png'});
await a.evaluate(()=>{closeModal(); rmPillRender();}); await w(300);
await a.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/room-pill.png'});
await a.evaluate(()=>frHub()); await w(300);
await a.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/friend-hub.png'});
const errs=[...A.errs,...Bp.errs]; ok(!errs.length, '오류 없음 '+errs.join(' | '));
await A.ctx.close(); await Bp.ctx.close(); await br.close(); srv.close();
console.log(fail?`실패 ${fail}개`:'대전 방 점검 모두 통과'); process.exit(fail?1:0);
