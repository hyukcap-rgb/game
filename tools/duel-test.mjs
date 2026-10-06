// 실시간 대전 점검(대전 v3, docs/21 5-2): server/index.ts와 같은 규칙의 중계 서버를 이 프로세스 안에 띄우고
// 브라우저 여러 개(각자 다른 기기처럼)를 붙여 확인한다.
//  1) 게임마다 1:1: 상대 찾기 → 같은 순간 시작 → 진행 공유 → 결과(서로의 점수·순위가 맞는지) → 먼저 끝내면 상대도 끝 → 계속 풀기
//  2) 여러 명(가짜 설정은 이 점검 안에서만 NG.sudoku에 덮어씀): 3명 경주(첫 완료 0.7초 뒤 모두 끝·순위 같음·'실패'·'진행 0%' 없음),
//     5명(칩 줄·한 명 나감), 모으기 6초 규칙 + 한 판 더(씨앗이 바뀜), 선점 충돌(늦게 도착한 더 이른 기록이 이김),
//     차례(넘김·시간 초과 대신 하기·나간 사람 건너뜀), v2 대기실과 안 섞임 + 느긋하게끼리만 + 12초에 혼자면 컴퓨터(계단식 진행)
//
//   node tools/build.js && npm run test:duel                (모든 게임 1:1 + 여러 명)
//   npm run test:duel -- sudoku,link                         (몇 게임만, 쉼표나 띄어쓰기로)
//   npm run test:duel -- fox memory --stress                 (느린 폰 흉내: CPU 4배 느리게 + 효과 폭주)
//   npm run test:duel -- --no-multi | --only-multi           (여러 명 점검 빼기 / 그것만)
//
// 공용 엔진(core)·효과·배경을 고친 뒤에는 꼭 돌린다. 실제 서버에는 연결하지 않는다.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARGS=process.argv.slice(2).filter(a=>!a.startsWith('--')).join(',').split(',').filter(Boolean);
const HAS=g=>fs.existsSync(path.join(ROOT,'games',g,'game.json'));
const GAMES=(ARGS.length?ARGS:'sudoku,link,match,merge,memory,block,nono,fox,ball'.split(',')).filter(HAS);
const STRESS=process.argv.includes('--stress'), MULTI=!process.argv.includes('--no-multi'), ONLYM=process.argv.includes('--only-multi');
const SHOT=process.env.SHOT_DIR||'/tmp';
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':T[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
const B=`http://127.0.0.1:${srv.address().port}/`; const w=ms=>new Promise(r=>setTimeout(r,ms));
/* ---- 중계(서버와 같은 동작). DELAY[tag]ms만큼 그 기기가 보내는 presence를 늦출 수 있음(선점 충돌 점검) ---- */
const rooms=new Map(), last=new Map(), DELAY={}; let N=0;
const snap=r=>[...(rooms.get(r)||[])].map(c=>({peer:c.id,presence:c.rooms.get(r)||{}}));
function flush(r){const set=rooms.get(r);const peers=snap(r),ids=peers.map(p=>p.peer),prev=last.get(r)||[];
  const joined=ids.filter(x=>!prev.includes(x)).map(peer=>({peer})),left=prev.filter(x=>!ids.includes(x)).map(peer=>({peer}));
  if(!set||!set.size){rooms.delete(r);last.delete(r);return;} last.set(r,ids);
  for(const c of set) c.send({t:'peers',r,you:c.id,peers,joined,left});}
function leave(c,r){if(!c.rooms.has(r))return;c.rooms.delete(r);const s=rooms.get(r);if(s){s.delete(c);flush(r);}}
function attach(ws,tag){const c={id:'p'+(++N)+'x'+Math.random().toString(36).slice(2,8),rooms:new Map(),send:m=>{try{ws.send(JSON.stringify(m))}catch(_){}}};
  c.send({t:'hello',you:c.id,now:Date.now()});
  ws.onMessage(raw=>{let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.t==='ping'){c.send({t:'pong',now:Date.now()});return}
    const r=typeof m.r==='string'?m.r.slice(0,64):'';if(!r)return;
    if(m.t==='join'){if(c.rooms.has(r)){flush(r);return}let s=rooms.get(r);if(!s){s=new Set();rooms.set(r,s)}s.add(c);c.rooms.set(r,{});flush(r);}
    else if(m.t==='leave')leave(c,r);
    else if(m.t==='p'){const ap=()=>{const cur=c.rooms.get(r);if(!cur||!m.p)return;c.rooms.set(r,{...cur,...m.p});setTimeout(()=>flush(r),r.startsWith('fl-')?0:60);};
      if(DELAY[tag]) setTimeout(ap,DELAY[tag]); else ap();}});
  ws.onClose(()=>{for(const r of [...c.rooms.keys()])leave(c,r)});}
const br=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const HELPED=['fox','sudoku','ball','fleet','match','nono','block','memory','merge','link','mines','parking','hidden','spot','crossword','chosung','wordchain','omok','gostop'];
async function mk(tag){const ctx=await br.newContext({viewport:{width:390,height:844}});
  await ctx.routeWebSocket(/battle-production/,ws=>attach(ws,tag));
  await ctx.route(/function-bun|railway\.app\/api|fonts\.(googleapis|gstatic)\.com/,r=>r.abort());   /* 바깥 서버·글꼴은 막음(불러오기 멈춤 방지) */
  const pg=await ctx.newPage(); const errs=[]; if(STRESS){ const cdp=await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); } pg.on('pageerror',e=>errs.push(tag+' '+String(e)));
  pg.on('console',m=>{if(m.type()==='error'&&!/WebSocket|favicon|Failed to load resource/.test(m.text()))errs.push(tag+' '+m.text())});
  await pg.addInitScript(h=>{try{localStorage.setItem('hp:welcome','9');for(const g of h)localStorage.setItem('hp:help:'+g,'1')}catch(_){}},HELPED);
  await pg.goto(B+'index.html',{waitUntil:'domcontentloaded'}); await pg.waitForFunction(()=>typeof ROOM_STATE!=='undefined'&&ROOM_STATE==='ok',null,{timeout:15000});
  await pg.evaluate(()=>closeModal&&closeModal()); return {ctx,pg,errs,tag};}
const until=(x,fn,arg,ms=20000)=>x.pg.waitForFunction(fn,arg,{timeout:STRESS?ms*2:ms}).then(()=>true).catch(()=>false);
let fail=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; return c;};
const closeAll=async L=>{for(const x of L) await x.ctx.close().catch(()=>{});};
const errsOf=L=>L.flatMap(x=>x.errs);

/* ================= 1) 게임마다 1:1 ================= */
if(!ONLYM) for(const g of GAMES){
  const A=await mk('A'),Bp=await mk('B');
  await A.pg.evaluate(g=>duelStart(g),g); await w(300); await Bp.pg.evaluate(g=>duelStart(g),g);
  const okGo=await Promise.all([A,Bp].map(x=>until(x,()=>G&&G.duel&&G.duel.go)));
  const st=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>({mode:G.duel.mode,seed:G.duel.seed,start:G.start,off:Math.round(ROOM.clockOffset)}))));
  console.log('   시계 오차(ms)',st.map(s=>s.off).join(', '),' 씨앗',st[0].seed);
  if(STRESS){ for(const x of [A,Bp]) await x.pg.evaluate(()=>{window.__st=setInterval(()=>{try{fxConfetti();fxBurst(200,400,['#fff','#fc0'],40,{glow:true});}catch(e){console.error(e)}},300)}); }
  await w(2500);
  if(STRESS){ const fr=await A.pg.evaluate(()=>({q:FXR.q,ema:Math.round(FXR.ema),lite:SCN.lite,n:SCN.items.length})); console.log('   부하 중 효과 품질',JSON.stringify(fr)); }
  await A.pg.evaluate(()=>finish(true)); await w(1500); await Bp.pg.evaluate(()=>finish(true));
  const res=await Promise.all([A,Bp].map(x=>until(x,()=>G&&G.duel&&G.duel.resolved,null,15000)));
  await w(1200);   /* 결과 창이 뜨는 시간 */
  const sc=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>({me:G.duel.me&&G.duel.me.sc,opp:G.duel.opp&&G.duel.opp.sc,txt:(document.querySelector('#modal h3')||{}).textContent||'',body:(document.querySelector('#modal')||{}).textContent||'',rank:G.duel.res&&G.duel.res.rank}))));
  const r=sc.map(s=>s.txt.trim()||'?');
  const clean=sc.every(s=>!/실패|진행 0%/.test(s.body));
  const good=okGo.every(Boolean)&&res.every(Boolean)&&st[0].mode==='pvp'&&st[1].mode==='pvp'&&st[0].seed===st[1].seed&&/^fl-d3-/.test(st[0].seed)&&Math.abs(st[0].start-st[1].start)<400&&sc[0].me===sc[1].opp&&sc[1].me===sc[0].opp&&!A.errs.length&&!Bp.errs.length
    &&({'승리!':'패배','패배':'승리!','무승부':'무승부'})[r[0]]===r[1]&&(r[0]==='무승부'?sc[0].rank+sc[1].rank===2:sc[0].rank+sc[1].rank===3)&&clean;   /* 한쪽이 이기면 다른 쪽은 져야 함 */
  /* 한쪽이 끝나면 다른 쪽도 끝: B는 A가 끝낸 뒤 스스로 끝내기 전에 끊겨야 함 → '계속 풀기'로 혼자 이어 풀기 */
  const endAll=await A.pg.evaluate(g=>duelEndOf(g)!=='first',g);   /* 점수전처럼 모두 끝까지 하는 게임은 '먼저 끝내면 모두 끝'을 보지 않음 */
  const cut=await Bp.pg.evaluate(()=>({cut:G.duel.cut||'',btn:!!document.querySelector('#mCont')}));
  let cont='-';
  if(cut.btn){ await Bp.pg.click('#mCont'); await w(800);
    cont=await Bp.pg.evaluate(()=>({p:!!G.practice,over:G.over,duel:!!G.duel,stage:!!document.querySelector('#stage').children.length,prog:Math.round(NG[G.id].progress()*100)}));
    const before=await Bp.pg.evaluate(()=>JSON.stringify(dayState()));
    await Bp.pg.evaluate(()=>finish(true)); await w(1200);
    const after=await Bp.pg.evaluate(()=>({d:JSON.stringify(dayState()),t:(document.querySelector('#modal h3')||{}).textContent||''}));
    cont=Object.assign(cont,{rec:before===after.d?'안 바뀜':'바뀜!',t:after.t});
  }
  const cutOk=cut.cut==='done'&&cut.btn&&cont.p&&!cont.over&&!cont.duel&&cont.stage&&cont.rec==='안 바뀜'&&cont.t==='다 풀었어요!';
  if(endAll) console.log(`  (모두 끝까지 하는 대전: 끊김 점검 건너뜀)`); else ok(cutOk,`  상대가 끝내면 나도 끝=${cut.cut} 계속풀기=${JSON.stringify(cont)}`);
  ok(good,`${g}  pvp=${st.map(s=>s.mode)} 같은문제=${st[0].seed===st[1].seed} 시작차=${Math.abs(st[0].start-st[1].start)}ms 점수A=${sc[0].me}/${sc[0].opp} B=${sc[1].me}/${sc[1].opp} 결과=${r.join(' | ')} 순위=${sc.map(s=>s.rank)} 문구깨끗=${clean} ${[...A.errs,...Bp.errs].join(' ')}`);
  await closeAll([A,Bp]);
}
// 함대: 실시간 포격전 방 연결(자기 방식 대전)
if(!ONLYM&&HAS('fleet')){ const A=await mk('A'),Bp=await mk('B');
  await A.pg.evaluate(()=>duelStart('fleet')); await w(300); await Bp.pg.evaluate(()=>duelStart('fleet'));
  await w(1500);
  const lv=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>G&&G.lv)));
  ok(lv.every(v=>v==='pvp')&&!A.errs.length&&!Bp.errs.length,`fleet 실시간 모드=${lv} ${[...A.errs,...Bp.errs].join(' ')}`);
  await closeAll([A,Bp]); }

/* ================= 2) 여러 명(대전 v3) ================= */
/* 이 점검 안에서만 스도쿠 정의를 바꿔 씀(가짜 게임 설정). o = { max, kind, end } */
const setup=(L,o)=>Promise.all(L.map(x=>x.pg.evaluate(o=>{const m=NG.sudoku; m.duelMax=o.max; if(o.kind) m.duelKind=o.kind; if(o.end) m.duelEnd=o.end;
  window.__cl=[]; window.__acts=[]; m.onDuelClaim=(k,own,i)=>window.__cl.push([k,own,!!i.lost,!!i.sure]); },o)));
const goAll=async(L,ms)=>(await Promise.all(L.map(x=>until(x,()=>G&&G.duel&&G.duel.go,null,ms||25000)))).every(Boolean);
const info=L=>Promise.all(L.map(x=>x.pg.evaluate(()=>({seed:G.duel.seed,pl:G.duel.pl.join(','),me:G.duel.myPid,start:G.start,r:G.duel.r,host:duelIsHost()}))));
const ranksOf=L=>Promise.all(L.map(x=>x.pg.evaluate(()=>{const R=G.duel.res;return R?JSON.stringify(R.rows.map(r=>[r.pid,r.rank]).sort()):'-';})));
const bodyClean=L=>Promise.all(L.map(x=>x.pg.evaluate(()=>{const t=(document.querySelector('#modal')||{}).textContent||'';return !/실패|진행 0%/.test(t);})));
const start=async(L,gap=250)=>{for(const x of L){ await x.pg.evaluate(()=>duelStart('sudoku')); await w(gap);} };

if(MULTI){
  console.log('— 여러 명 대전(v3) —');
  /* (1) 3명 경주: 같은 방·같은 판·동시 시작 → 한 명이 다 풀면 0.7초 뒤 모두 끝, 순위 같음 */
  { const L=[await mk('A'),await mk('B'),await mk('C')];
    await setup(L,{max:3}); await start(L);
    const go=await goAll(L), I=await info(L);
    const same=I.every(i=>i.seed===I[0].seed&&i.pl===I[0].pl), n3=I[0].pl.split(',').length===3, dt=Math.max(...I.map(i=>i.start))-Math.min(...I.map(i=>i.start));
    ok(go&&same&&n3&&dt<=(STRESS?600:400)&&/^fl-d3-/.test(I[0].seed)&&I.filter(i=>i.host).length===1, `3명 모임: 같은 판=${same} 인원=${I[0].pl.split(',').length} 시작차=${dt}ms 방장 1명`);
    await w(2000);
    const chips=await L[0].pg.evaluate(()=>document.querySelectorAll('#dChips .dpchip').length);
    ok(chips===3,'3명 칩 줄 '+chips+'개');
    await Promise.all(L.map(x=>x.pg.evaluate(()=>{const f=window.finish;window.finish=function(w){window.__overAt=Date.now();return f(w);};})));
    const t0=await L[1].pg.evaluate(()=>{const t=Date.now();finish(true);return t;});
    await Promise.all([L[0],L[2]].map(x=>until(x,()=>G.over,null,8000)));
    const cutAt=await Promise.all([L[0],L[2]].map(x=>x.pg.evaluate(t=>window.__overAt?window.__overAt-t:-1,t0)));
    ok(cutAt.every(c=>c>=350&&c<=(STRESS?3000:2000)), `첫 완료 뒤 나머지 끝남(ms) ${cutAt.join(', ')} (목표 = 다 푼 서버 시각 + 0.7초, 이 컴퓨터가 바쁘면 늦어짐)`);
    const res=(await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,10000)))).every(Boolean); await w(1300);
    const rk=await ranksOf(L), why=await L[0].pg.evaluate(()=>G.duel.res.why), win=await L[1].pg.evaluate(()=>G.duel.res.rank);
    const cl=await bodyClean(L);
    ok(res&&rk.every(x=>x===rk[0])&&win===1&&cl.every(Boolean)&&/먼저 다 풀어서/.test(why), `순위가 모두 같음 ${rk[0]} · 1위=B · 이유 "${why}" · '실패'·'진행 0%' 없음=${cl}`);
    await L[0].pg.screenshot({path:SHOT+'/duel3-result.png'});
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }

  /* (2) 5명: 다 모이면 바로 시작 · 칩 줄 5개 · 한 명 나감 → 모두 나감으로 봄 · 결과 순위 같음 */
  { const L=[]; for(const t of ['A','B','C','D','E']) L.push(await mk(t));
    await setup(L,{max:5}); await Promise.all(L.map(x=>x.pg.evaluate(()=>duelStart('sudoku'))));   /* 함께 찾기(느린 폰에서 6초 규칙에 먼저 걸리지 않게) */
    const go=await goAll(L), I=await info(L);
    ok(go&&I.every(i=>i.seed===I[0].seed)&&I[0].pl.split(',').length===5, `5명 모임: 인원=${I[0].pl.split(',').length} 같은 판=${I.every(i=>i.seed===I[0].seed)}`+(go?'':' 시작 못 함')+' '+I.map(i=>i.pl.split(',').length+':'+i.seed.slice(6,14)).join(' '));
    await w(3300);
    const chips=await L[0].pg.evaluate(()=>document.querySelectorAll('#dChips .dpchip').length);
    await L[0].pg.screenshot({path:SHOT+'/duel5-chips.png'});
    ok(chips===5,'5명 칩 줄 '+chips+'개(화면: '+SHOT+'/duel5-chips.png)');
    await L[4].pg.evaluate(()=>{ G.over=true; HOST.exit(); });   /* E가 기권하고 나감 */
    const seenLeft=(await Promise.all(L.slice(0,4).map(x=>until(x,()=>Object.values(G.duel.P).some(p=>p.left),null,6000)))).every(Boolean);
    ok(seenLeft,'한 명이 나간 것을 나머지 4명이 모두 봄');
    await L[2].pg.evaluate(()=>finish(true));
    const res=(await Promise.all(L.slice(0,4).map(x=>until(x,()=>G.duel.resolved,null,10000)))).every(Boolean); await w(1300);
    const rk=await ranksOf(L.slice(0,4));
    const last=await L[0].pg.evaluate(()=>{const R=G.duel.res;return R.rows[R.rows.length-1].txt;});
    ok(res&&rk.every(x=>x===rk[0])&&last==='나감', `5명 결과 순위 같음 · 나간 사람 맨 뒤("${last}")`+(rk.every(x=>x===rk[0])?'':' '+rk.join(' / '))+' 결과='+res);
    await L[0].pg.screenshot({path:SHOT+'/duel5-result.png'});
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }

  /* (3) 모으기 규칙: 최대 5명인데 2명만 → 두 번째 입장 6초 뒤 시작 · 한 판 더 → 새 씨앗 */
  { const L=[await mk('A'),await mk('B')];
    await setup(L,{max:5}); await L[0].pg.evaluate(()=>duelStart('sudoku')); await w(300);
    const tB=Date.now(); await L[1].pg.evaluate(()=>duelStart('sudoku'));
    const go=await goAll(L,30000), I=await info(L);
    const at=await L[1].pg.evaluate(()=>G.duel.startAt), wait=(at-tB)/1000;
    ok(go&&I[0].seed===I[1].seed&&I[0].pl.split(',').length===2&&wait>=7.5&&wait<=12, `2명 + 두 번째 입장 6초 → 시작(찾기부터 ${wait.toFixed(1)}초, 준비 2.5초 포함)`);
    await L[0].pg.evaluate(()=>finish(true));
    await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,10000))); await w(1300);
    const can=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.res.room.canAgain)));
    await Promise.all(L.map(x=>x.pg.evaluate(()=>duelAgain())));
    const again=(await Promise.all(L.map(x=>until(x,s=>G&&G.duel&&G.duel.r===2&&G.duel.go,null,15000)))).every(Boolean);
    const I2=await info(L);
    ok(can.every(Boolean)&&again&&I2[0].seed===I2[1].seed&&I2[0].seed!==I[0].seed&&I2[0].r===2, `한 판 더: 2판째 시작=${again} 새 씨앗=${I2[0].seed!==I[0].seed}`);
    await L[1].pg.evaluate(()=>finish(true));
    const res2=(await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,10000)))).every(Boolean); await w(800);
    const ser=await L[0].pg.evaluate(()=>JSON.stringify(G.duel.res.round.series));
    ok(res2&&Object.values(JSON.parse(ser)).every(v=>v===1), '2판째 결과 · 방 기록 '+ser);
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }

  /* (4) 선점: A의 소식을 0.3초(느린 폰 흉내는 1.5초) 늦게 보냄 → A가 50ms 먼저 눌러도 B·C에는 B가 먼저 보임 → A 기록이 도착하면 모두 A로(B는 '뺏김') */
  { const L=[await mk('A'),await mk('B'),await mk('C')];
    await setup(L,{max:3,kind:'shared',end:'game'}); await start(L);
    await goAll(L); await w(600);
    DELAY.A=STRESS?1500:300;
    await L[0].pg.evaluate(()=>duelClaim('k1')); await w(50);
    const rb=await L[1].pg.evaluate(()=>duelClaim('k1'));
    await w(STRESS?3000:900); DELAY.A=0;
    const own=await Promise.all(L.map(x=>x.pg.evaluate(()=>{const D=G.duel;return D.owners.k1===D.myPid?'me':D.P[D.owners.k1]?D.owners.k1:'?';})));
    const aPid=await L[0].pg.evaluate(()=>G.duel.myPid);
    const lostB=await L[1].pg.evaluate(()=>window.__cl.some(c=>c[0]==='k1'&&c[2]));
    ok(rb.ok&&own[0]==='me'&&own[1]===aPid&&own[2]===aPid&&lostB, `선점 충돌: 모두 A가 주인 · B가 '뺏김' 받음=${lostB}`);
    /* 이미 남의 것은 못 누름 */
    await L[1].pg.evaluate(()=>duelClaim('k2')); await w(400);
    const rc=await L[2].pg.evaluate(()=>duelClaim('k2'));
    ok(rc.ok===false,'남이 차지한 것은 누를 수 없음');
    await Promise.all(L.map(x=>x.pg.evaluate(()=>duelEndNow('다 차지했어요'))));
    await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,10000))); await w(400);
    const rk=await ranksOf(L);
    ok(rk.every(x=>x===rk[0]),'선점 결과 순위 같음 '+rk[0]);
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }

  /* (5) 차례: 차례 넘김 · 시간 초과 대신 하기(모두 같은 rng) · 나간 사람 건너뜀 */
  { const L=[await mk('A'),await mk('B'),await mk('C')];
    await setup(L,{max:3,kind:'turn',end:'game'}); await start(L);
    await goAll(L); await w(400);
    await Promise.all(L.map(x=>x.pg.evaluate(()=>duelTurn.onAct(a=>window.__acts.push(a.kind+':'+a.n+(a.rng?':'+Math.floor(a.rng()*1000):''))))));
    const pl=(await info(L))[0].pl.split(',');
    const cur0=await Promise.all(L.map(x=>x.pg.evaluate(()=>duelTurn.cur())));
    const who=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.myPid)));
    const i0=who.indexOf(cur0[0]);
    ok(cur0.every(c=>c===pl[0])&&i0>=0,'첫 차례 = 참가 순서 첫 사람(모두 같음)');
    const r1=await L[(i0+1)%3].pg.evaluate(()=>duelTurn.act('flip',{i:1}));   /* 차례가 아닌 사람은 못 함 */
    const r0=await L[i0].pg.evaluate(()=>duelTurn.act('flip',{i:3}));
    await w(600);
    const s1=await Promise.all(L.map(x=>x.pg.evaluate(()=>[duelTurn.cur(),duelTurn.n()].join('/'))));
    const got=await Promise.all(L.map((x,i)=>x.pg.evaluate(()=>window.__acts.join(','))));
    ok(!r1&&r0&&s1.every(s=>s===pl[1]+'/1')&&got.filter((g,i)=>i!==i0).every(g=>g==='flip:0'), `차례 넘김: ${s1[0]} · 받은 수 ${got.join(' | ')}`);
    await Promise.all(L.map(x=>x.pg.evaluate(()=>duelTurn.timeout(1))));
    await w(3600);
    const s2=await Promise.all(L.map(x=>x.pg.evaluate(()=>[duelTurn.cur(),duelTurn.n()].join('/'))));
    const auto=await Promise.all(L.map(x=>x.pg.evaluate(()=>window.__acts.filter(a=>a.startsWith('timeout')).join(','))));
    ok(s2.every(s=>s===s2[0])&&s2[0].startsWith(pl[2]+'/')&&auto.every(a=>a&&a===auto[0]), `시간 초과 대신 하기(모두 같음): ${s2[0]} · ${auto[0]}`);
    await Promise.all(L.map(x=>x.pg.evaluate(()=>duelTurn.timeout(0))));
    const ic=who.indexOf(pl[2]);
    await L[ic].pg.evaluate(()=>{ G.over=true; HOST.exit(); });   /* 지금 차례인 사람이 나감 */
    const rest=L.filter((_,i)=>i!==ic);
    const skip=(await Promise.all(rest.map(x=>until(x,p=>duelTurn.cur()===p,pl[0],8000)))).every(Boolean);
    ok(skip,'차례인 사람이 나가면 다음 사람으로 넘어감');
    await Promise.all(rest.map(x=>x.pg.evaluate(()=>duelEndNow())));
    await Promise.all(rest.map(x=>until(x,()=>G.duel.resolved,null,10000))); await w(300);
    const rk=await ranksOf(rest);
    ok(rk.every(x=>x===rk[0]),'차례 결과 순위 같음');
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }

  /* (6) v2 대기실과 안 섞임 · 느긋하게끼리만 · 12초에 혼자면 컴퓨터(사람 같은 계단식 진행) */
  { const L=[await mk('V2'),await mk('N'),await mk('S')];
    await L[0].pg.evaluate(()=>ROOM.presence({du:'wait',dg:'sudoku',dt:Date.now()-5000,nk:'옛 사이트',dp:null}));
    await L[2].pg.evaluate(()=>store.set('hp:duelPace','s'));
    await L[1].pg.evaluate(()=>duelStart('sudoku')); await w(200); await L[2].pg.evaluate(()=>duelStart('sudoku'));
    await w(2500);
    const wn=await L[1].pg.evaluate(()=>duelWaiting('sudoku')), txt=await L[1].pg.evaluate(()=>document.querySelector('#modal').textContent);
    ok(wn>=2&&/컴퓨터/.test(txt)&&!/AI/.test(txt),`대기 인원 표시 ${wn}명(v2·v3 모두 셈) · 찾기 창 '컴퓨터'`);
    await L[1].pg.screenshot({path:SHOT+'/duel-search.png'});
    const ai=(await Promise.all(L.slice(1).map(x=>until(x,()=>G&&G.duel&&G.duel.mode==='ai'&&G.duel.go,null,20000)))).every(Boolean);
    const lim=await Promise.all(L.slice(1).map(x=>x.pg.evaluate(()=>G.limit)));
    const nm=await L[1].pg.evaluate(()=>document.querySelector('#ptitle').textContent);
    ok(ai&&lim[1]===lim[0]*2&&/컴퓨터/.test(nm), `v2·느긋하게와 짝 안 됨 → 12초 뒤 컴퓨터 · 느긋하게 제한 시간 ${lim[1]}초(보통 ${lim[0]}초) · 제목 '${nm.replace(/\s+/g,' ').slice(0,40)}'`);
    const steps=[]; for(let i=0;i<10;i++){ steps.push(await L[1].pg.evaluate(()=>[Math.round(elapsed()*10)/10,G.duel.P.ai.st.v||0])); await w(STRESS?1600:1200); }
    const early=steps.filter(s=>s[0]<2.9).every(s=>s[1]===0), ints=steps.every(s=>Number.isInteger(s[1]));
    ok(early&&ints,'컴퓨터: 3초 전에는 0, 한 칸씩 계단 '+steps.map(s=>s.join('s:')).join(' '));
    await L[1].pg.screenshot({path:SHOT+'/duel2-bar.png'});
    ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L); }
}
await br.close(); srv.close(); console.log(fail?`실패 ${fail}`:'대전 모두 통과'); process.exit(fail?1:0);
