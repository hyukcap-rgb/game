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
//   npm run test:duel -- chosung crossword --only-word        (낱말 파티 선점 3명·컴퓨터 상대만)
//   npm run test:duel -- hidden spot --only-shared           (선점 게임 3명 점검만)
//   npm run test:duel -- memory wordchain --only-turn        (차례 게임 3명 점검만)
//
// 공용 엔진(core)·효과·배경을 고친 뒤에는 꼭 돌린다. 실제 서버에는 연결하지 않는다.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARGS=process.argv.slice(2).filter(a=>!a.startsWith('--')).join(',').split(',').filter(Boolean);
const HAS=g=>fs.existsSync(path.join(ROOT,'games',g,'game.json'));
const GAMES=(ARGS.length?ARGS:'sudoku,link,match,merge,memory,block,nono,fox,ball'.split(',')).filter(HAS);
const STRESS=process.argv.includes('--stress'), MULTI=!process.argv.includes('--no-multi'), ONLYW=process.argv.includes('--only-word'), ONLYS=process.argv.includes('--only-shared'), ONLYT=process.argv.includes('--only-turn'), ONLYM=ONLYW||ONLYS||ONLYT||process.argv.includes('--only-multi');   /* --only-word: 낱말 선점만 · --only-shared: 숨은그림·틀린그림 선점만 · --only-turn: 차례 게임만 */
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
  if(['fleet','gostop'].includes(g)){ console.log(`  (${g}: 자기 방식 대전(duelLaunch) → 아래 따로 점검)`); continue; }
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
  const sc=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>({me:G.duel.me&&G.duel.me.sc,opp:G.duel.opp&&G.duel.opp.sc,txt:(h=>!h?'':h.dataset.r?({w:'승리!',l:'패배',d:'무승부'})[h.dataset.r]:h.textContent)(document.querySelector('#modal h3')),body:(document.querySelector('#modal')||{}).textContent||'',rank:G.duel.res&&G.duel.res.rank}))));
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

if(MULTI&&!ONLYW&&!ONLYS&&!ONLYT){
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
/* ================= 3) 경주 게임 여러 명(2단계: 짝 잇기·별빛 구슬·블록·주차, duelMax 5) =================
   3명: 같은 판 · 미니 화면/칩 줄 · 게임별(짝 잇기 얼음은 나를 뺀 1위에게·모든 브라우저에서 같은 칸, 블록 미니 판 같음, 주차 '탈출!'·풀이 다시 보기)
        · 한 명 나감 · 순위 모두 같음 · 나간 사람 맨 뒤. 5명: 390px 화면(칩 줄·미니 카드 4장) 스크린샷 + 결과 순위 같음.
   짝 잇기는 컴퓨터 대전에서 얼음을 보내면 컴퓨터가 실제로 늦어지는지도 본다. */
async function raceMulti(g){
  const L=[await mk('A'),await mk('B'),await mk('C')], [A,Bq,C]=L;
  for(const x of L){ await x.pg.evaluate(g=>duelStart(g),g); await w(250); }
  const go=await goAll(L,30000);
  const sig=g==='link'?'JSON.stringify(G.m.b)':g==='ball'?'ballMiniGet()+":"+G.total':g==='block'?'JSON.stringify(NG.block._state().tray)':'JSON.stringify([G.m.pos0,G.m.opt,G.m.P.goals])';
  const I=await Promise.all(L.map(x=>x.pg.evaluate(s=>({seed:G.duel.seed,pl:G.duel.pl.join(','),me:G.duel.myPid,sig:eval(s),lim:G.limit}),sig)));
  const same=I.every(i=>i.seed===I[0].seed&&i.pl===I[0].pl&&i.sig===I[0].sig);
  ok(go&&same&&I[0].pl.split(',').length===3, `${g} 3명: 같은 방·같은 판=${same} 인원=${I[0].pl.split(',').length} 제한 ${I[0].lim}초`);
  await w(3300);
  const mini=g!=='parking';
  const ui=await A.pg.evaluate(m=>m?document.querySelectorAll('#dMinis .dmini').length:document.querySelectorAll('#dChips .dpchip').length,mini);
  ok(ui===(mini?2:3), `${g} ${mini?'미니 카드':'칩 줄'} ${ui}개`);
  const pid=x=>I[L.indexOf(x)].me;
  if(g==='link'){   /* A가 3초 안에 두 짝 → 2콤보 → 얼음 2장이 나를 뺀 1위(같으면 자리 순서)에게 */
    await A.pg.evaluate(()=>NG.link._stepForTest()); await w(450); await A.pg.evaluate(()=>NG.link._stepForTest());
    await w(STRESS?4000:2600);
    const S=await Promise.all(L.map(x=>x.pg.evaluate(()=>NG.link._duelState())));
    const to=Object.keys(S[0].sentTo)[0], tx=L.find(x=>pid(x)===to), other=L.find(x=>x!==A&&x!==tx);
    const plOrd=I[0].pl.split(','), want=plOrd.filter(p=>p!==pid(A))[0];
    const st=S[L.indexOf(tx)], so=S[L.indexOf(other)];
    ok(to===want&&st.ice.length===2&&so.ice.length===0, `link 얼음: 받은 사람=자리 순서 첫 상대(${to===want}) 얼음 ${st.ice.length}장 · 다른 사람 ${so.ice.length}장`);
    await w(1600);
    const S2=await Promise.all(L.map(x=>x.pg.evaluate(()=>NG.link._duelState())));
    const mv=S2[L.indexOf(tx)].mv, seen=S2.filter((_,i)=>L[i]!==tx).map(s=>s.minis[to]);
    ok(seen.every(v=>v===mv)&&/2/.test(mv), `link 얼음 칸이 모든 브라우저에서 같음(미니 판 = 받은 사람 판) ${seen.map(v=>v===mv).join(',')}`);
  }
  if(g==='block'){
    for(let k=0;k<3;k++){ await A.pg.evaluate(()=>NG.block._step()); await w(300); }
    await w(1800);
    const mine=await A.pg.evaluate(()=>NG.block.duelMini.get()), seen=await Promise.all([Bq,C].map(x=>x.pg.evaluate(p=>G.duel.P[p].mv,pid(A))));
    ok(seen.every(v=>v===mine)&&/[1-9a-e]/.test(mine), `block 미니 판이 다른 두 브라우저에서 같음 ${seen.map(v=>v===mine).join(',')}`);
  }
  await A.pg.screenshot({path:SHOT+`/race3-${g}-play.png`});
  /* C가 기권하고 나감 */
  await C.pg.evaluate(()=>{ G.over=true; HOST.exit(); });
  const left=(await Promise.all([A,Bq].map(x=>until(x,p=>G.duel.P[p]&&G.duel.P[p].left,pid(C),8000)))).every(Boolean);
  ok(left,`${g} 한 명 나감을 나머지가 봄`);
  if(g==='parking'){   /* B가 한 수 → A가 끝까지 풀어 탈출 → B에게 'A 탈출!' 알림 · 순위 A, B, C(나감) · 풀이 다시 보기 */
    await Bq.pg.evaluate(()=>NG.parking._stepForTest()); await w(600);
    await A.pg.evaluate(()=>NG.parking._solveForTest());
    const note=await until(Bq,()=>/탈출!/.test((document.querySelector('#dNote')||{}).textContent||''),null,8000);
    ok(note,'parking 다른 사람에게 "○○ 탈출!" 알림');
  } else await A.pg.evaluate(()=>finish(true));
  const res=(await Promise.all([A,Bq].map(x=>until(x,()=>G.duel&&G.duel.resolved,null,15000)))).every(Boolean); await w(1500);
  const rk=await ranksOf([A,Bq]);
  const R=await A.pg.evaluate(()=>({rank:G.duel.res.rank,last:G.duel.res.rows[G.duel.res.rows.length-1].txt,n:G.duel.res.rows.length,
    rp:document.querySelectorAll('#modal .pk-rpc').length,be:document.querySelectorAll('#modal .bk-end').length}));
  const rB=await Bq.pg.evaluate(()=>G.duel.res.rank), cl=await bodyClean([A,Bq]);
  ok(res&&rk[0]===rk[1]&&R.rank===1&&rB===2&&R.last==='나감'&&R.n===3&&cl.every(Boolean), `${g} 결과: 순위 같음 ${rk[0]} · A 1위 · B 2위 · 나간 사람 맨 뒤("${R.last}")`);
  if(g==='parking') ok(R.rp===2,`parking 결과 창 풀이 나란히 다시 보기 ${R.rp}칸(움직인 A·B, 안 움직이고 나간 C는 풀이 없음)`);
  if(g==='block') ok(R.be===3,`block 결과 창 끝 판 나란히 ${R.be}칸`);
  await A.pg.screenshot({path:SHOT+`/race3-${g}-result.png`});
  ok(!errsOf(L).length,`${g} 오류 없음 `+errsOf(L).join(' | ')); await closeAll(L);
}
async function race5(g){
  const L=[]; for(const t of ['A','B','C','D','E']) L.push(await mk(t));
  await Promise.all(L.map(x=>x.pg.evaluate(g=>duelStart(g),g)));
  const go=await goAll(L,30000), I=await info(L);
  ok(go&&I.every(i=>i.seed===I[0].seed)&&I[0].pl.split(',').length===5, `${g} 5명 모임: 인원=${I[0].pl.split(',').length}`);
  await w(3500);
  if(g==='link') await L[1].pg.evaluate(()=>NG.link._stepForTest());
  if(g==='block') await L[1].pg.evaluate(()=>NG.block._step());
  if(g==='parking') await L[1].pg.evaluate(()=>NG.parking._stepForTest());
  await w(1800);
  const ui=await L[0].pg.evaluate(()=>({mini:document.querySelectorAll('#dMinis .dmini').length,chip:document.querySelectorAll('#dChips .dpchip').length,
    over:[...document.querySelectorAll('#duelBar .dmini, #duelBar .dpchip, #duelBar .dm-rank')].some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>390;})
      ||(()=>{const b=document.querySelector('#duelBar'),h=document.querySelector('.hud-row');return !b||(h&&b.getBoundingClientRect().bottom>h.getBoundingClientRect().top+1);})()}));   /* 카드·칩이 화면 밖으로 안 나가고, 판 위 칩 줄을 가리지 않음 */
  await L[0].pg.screenshot({path:SHOT+`/race5-${g}.png`});
  ok((g==='parking'?ui.chip===5:ui.mini===4)&&!ui.over, `${g} 5명 390px: ${g==='parking'?'칩 '+ui.chip+'개':'미니 카드 '+ui.mini+'장'} · 넘침 없음(화면: ${SHOT}/race5-${g}.png)`);
  await L[2].pg.evaluate(()=>finish(true));
  await Promise.all(L.map(x=>until(x,()=>G.duel&&G.duel.resolved,null,15000))); await w(1200);
  const rk=await ranksOf(L);
  ok(rk.every(x=>x===rk[0]),`${g} 5명 결과 순위 같음`);
  await L[0].pg.screenshot({path:SHOT+`/race5-${g}-result.png`});
  ok(!errsOf(L).length,`${g} 5명 오류 없음 `+errsOf(L).join(' | ')); await closeAll(L);
}
async function linkAiIce(){
  const X=await mk('A');
  await X.pg.evaluate(()=>{ startGame('link','normal',{ duel:duelMakeAI('link','나','n') }); });
  await until(X,()=>G&&G.duel&&G.duel.go&&G.m&&G.m.phase==='play',null,15000);
  const t0=await X.pg.evaluate(()=>G.duel.ai.T);
  await X.pg.evaluate(()=>NG.link._stepForTest()); await w(450); await X.pg.evaluate(()=>NG.link._stepForTest()); await w(1500);
  const s=await X.pg.evaluate(()=>NG.link._duelState());
  ok(s.aiIce>=1&&s.aiT>t0, `link 컴퓨터에게 얼음 → 컴퓨터 미니 판 얼음 ${s.aiIce}장 · 끝나는 시각 ${t0.toFixed(1)} → ${s.aiT.toFixed(1)}초(실제로 늦어짐)`);
  ok(!X.errs.length,'link 컴퓨터 대전 오류 없음 '+X.errs.join(' | ')); await closeAll([X]);
}
const RACE=['link','ball','block','parking'].filter(g=>GAMES.includes(g));
if(MULTI&&RACE.length){
  console.log('— 경주 게임 여러 명(2단계) —');
  for(const g of RACE) await raceMulti(g);
  for(const g of RACE) await race5(g);
  if(RACE.includes('link')) await linkAiIce();
}
/* ================= 3) 낱말 파티 선점(WP11): 초성 버저 3명 · 낱말퀴즈 땅따먹기 3명 · 컴퓨터 상대 =================
   게임 이름을 주지 않았거나(전체) chosung·crossword를 주면 돈다. --no-multi면 건너뜀 */
const WANT=g=>HAS(g)&&(!ARGS.length||GAMES.includes(g));
async function wordStart(L,g){ for(const x of L){ await x.pg.evaluate(g=>duelStart(g),g); await w(250); } return goAll(L,30000); }
const ownersOf=L=>Promise.all(L.map(x=>x.pg.evaluate(()=>{const D=G.duel,o={};for(const k in D.owners||{}) o[k]=D.owners[k];return JSON.stringify(Object.keys(o).sort().map(k=>[k,o[k]]));})));
async function chosungShared3(){
  console.log('— 초성 버저 3명 —');
  const L=[await mk('A'),await mk('B'),await mk('C')];
  const go=await wordStart(L,'chosung'), I=await info(L);
  const pid=I.map(i=>i.me), kind=await L[0].pg.evaluate(()=>G.duel.kind+'/'+G.duel.pl.length+'/'+G.m.q+'/'+G.m.bz.qt);
  const q0=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.m.qs.map(p=>p.n).join(','))));
  ok(go&&I.every(i=>i.seed===I[0].seed)&&kind==='shared/3/8/15'&&q0.every(q=>q===q0[0]), `초성 3명: 선점·3명·8문제·문제당 15초=${kind} · 모두 같은 문제=${q0.every(q=>q===q0[0])}`);
  const key=(x,k,ms)=>until(x,k=>G.m.bz.key===k,k,ms||20000);
  const ans=(x,i)=>x.pg.evaluate(i=>{ if(G.m.i!==i||G.m.lock) return false; const inp=document.querySelector('#csIn'); inp.value=G.m.qs[i].ans[0]; document.querySelector('#csGo').click(); return true; },i);
  /* 0번: B가 맞힘 → 모두 '0번 B 차지 · 정답 보여 주기' */
  await key(L[1],'0:open:'); await w(700);
  await L[1].pg.screenshot({path:SHOT+'/chosung3-play.png'});
  const a0=await ans(L[1],0);
  const s0=(await Promise.all(L.map(x=>key(x,'0:show:'+pid[1],6000)))).every(Boolean);
  await w(250); await L[0].pg.screenshot({path:SHOT+'/chosung3-show.png'});
  const mineB=await L[1].pg.evaluate(()=>document.querySelector('#csMine').textContent);
  ok(a0&&s0&&mineB==='1', `0번: B가 먼저 맞힘 → 세 화면 모두 B 차지·정답 보여 줌=${s0} · B '내가 맞힘' ${mineB}`);
  /* 1번: C가 틀림 → 0.8초 쉼 · 틀린 수 1 */
  const o1=(await Promise.all(L.map(x=>key(x,'1:open:',8000)))).every(Boolean);
  const bad=await L[2].pg.evaluate(()=>{ const inp=document.querySelector('#csIn'); inp.value='가가가가가가'; document.querySelector('#csGo').click(); return { lock:G.m.bz.lockUntil-Date.now(), mis:duelStatNow().mis, form:document.querySelector('#csForm').classList.contains('lock') }; });
  const blocked=await L[2].pg.evaluate(()=>{ const inp=document.querySelector('#csIn'); inp.value=G.m.qs[G.m.i].ans[0]; document.querySelector('#csGo').click(); return !duelOwner('q'+G.m.i); });
  ok(o1&&bad.lock>600&&bad.lock<=800&&bad.mis===1&&bad.form&&blocked, `오답: 0.8초 못 누름(${bad.lock}ms, 그 사이 정답도 안 받음=${blocked}) · 틀린 수 ${bad.mis}`);
  await w(900);
  /* 1번 간발의 차: A가 50ms 먼저 맞혔지만 A 소식이 0.3초 늦게 도착 → C는 잠깐 자기 것으로 보다가 A로 바뀜(모두 A) */
  DELAY.A=STRESS?1500:300;
  await ans(L[0],1); await w(50); await ans(L[2],1);
  await w(STRESS?3000:1000); DELAY.A=0;
  const s1=(await Promise.all(L.map(x=>until(x,k=>G.m.bz.key.startsWith(k),'1:show:'+pid[0],4000)))).every(Boolean);
  const note=await L[2].pg.evaluate(()=>(document.querySelector('#dNote')||{}).textContent||'');
  ok(s1, `1번 동시 정답(50ms 차): 세 화면 모두 A 차지=${s1} · C 알림 "${note.trim()}"`);
  /* 2~7번: A가 차례로 맞힘 → 8문제가 끝나면 모두 끝 */
  for(let i=2;i<8;i++){ await key(L[0],i+':open:',25000); await w(150); await ans(L[0],i); }
  const res=(await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,15000)))).every(Boolean); await w(1300);
  const rk=await ranksOf(L), own=await ownersOf(L), cl=await bodyClean(L);
  const R=await L[0].pg.evaluate(()=>({rank:G.duel.res.rank,why:G.duel.res.why,rows:G.duel.res.rows.map(r=>r.txt)}));
  ok(res&&rk.every(x=>x===rk[0])&&own.every(x=>x===own[0])&&R.rank===1&&cl.every(Boolean)&&/차지/.test(R.rows[0])&&/8문제/.test(R.why), `초성 결과: 순위·주인 모두 같음 · A 1위 · "${R.why}" · ${R.rows.join(' / ')}`);
  await L[2].pg.screenshot({path:SHOT+'/chosung3-result.png'});
  ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}
async function crosswordShared3(){
  console.log('— 낱말퀴즈 땅따먹기 3명 —');
  const L=[await mk('A'),await mk('B'),await mk('C')];
  const go=await wordStart(L,'crossword'), I=await info(L);
  const pid=I.map(i=>i.me), kind=await L[0].pg.evaluate(()=>G.duel.kind+'/'+G.duel.pl.length+'/'+G.m.N+'/'+G.m.words.length+'/'+G.limit);
  const bd=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.m.words.map(w=>w.w).join(','))));
  ok(go&&kind==='shared/3/7/8/120'&&bd.every(b=>b===bd[0]), `낱말퀴즈 3명: 선점·3명·7×7·8낱말·2분=${kind} · 모두 같은 판=${bd.every(b=>b===bd[0])}`);
  await Promise.all(L.map(x=>until(x,()=>G.m.phase==='play'&&G.duel.go)));
  const word=k=>L[0].pg.evaluate(k=>G.m.words[k].w,k), type=(x,k,t)=>x.pg.evaluate(([k,t])=>NG.crossword._typeForTest(k,t),[k,t]);
  /* 0번 낱말: B가 맞힘 → 모두의 판에 B 색으로 칠해지고 글자가 드러남 */
  await type(L[1],0,await word(0));
  const seen=(await Promise.all(L.map(x=>until(x,p=>duelOwner('w0')===p,pid[1],5000)))).every(Boolean); await w(300);
  const cellA=await L[0].pg.evaluate(()=>{ const wd=G.m.words[0]; return wd.cells.every(i=>{ const el=document.querySelector(`.ng-crossword .cw-c[data-i="${i}"]`); return el.classList.contains('own')&&el.querySelector('b').textContent===G.m.cell[i].ch; }); });
  const inpA=await L[0].pg.evaluate(()=>{ NG.crossword._typeForTest(0,G.m.words[0].w); return duelOwner('w0')!==G.duel.myPid; });
  ok(seen&&cellA&&inpA, `0번: B 차지 → A·C 판에도 B 색 칸·글자 보임=${cellA} · 남의 땅은 다시 못 넣음=${inpA}`);
  /* C 오답 → 틀린 수 1 */
  const k1=1; const wrong=(await word(k1)).split('').reverse().join('');
  await type(L[2],k1,wrong===await word(k1)?'가'.repeat(wrong.length):wrong);
  const misC=await L[2].pg.evaluate(()=>duelStatNow().mis);
  /* 1번 간발의 차: A가 50ms 먼저(소식은 0.3초 늦게) → 모두 A */
  DELAY.A=STRESS?1500:300;
  await type(L[0],k1,await word(k1)); await w(50); await type(L[2],k1,await word(k1));
  await w(STRESS?3000:1000); DELAY.A=0;
  const o1=(await Promise.all(L.map(x=>until(x,p=>duelOwner('w1')===p,pid[0],4000)))).every(Boolean);
  const cC=await L[2].pg.evaluate(()=>({own:G.m.words[1].owner===G.m.words[1].owner&&G.m.words[1].owner!==G.duel.myPid,mine:G.m.solved}));
  ok(misC===1&&o1&&cC.own&&cC.mine===0, `오답 틀린 수 ${misC} · 1번 동시 정답(50ms 차): 모두 A 차지=${o1} · C 칸 색 되돌림(C 차지 ${cC.mine})`);
  await L[0].pg.screenshot({path:SHOT+'/crossword3-play.png'});
  /* 나머지: A가 차례로 맞힘 → 승부가 정해지면(또는 다 차지) 모두 끝 */
  const n=await L[0].pg.evaluate(()=>G.m.words.length);
  for(let k=2;k<n;k++){ if(await L[0].pg.evaluate(()=>G.over)) break; await type(L[0],k,await word(k)); await w(250); }
  const res=(await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,15000)))).every(Boolean); await w(1300);
  const rk=await ranksOf(L), own=await ownersOf(L), cl=await bodyClean(L);
  const R=await L[1].pg.evaluate(()=>({rank:G.duel.res.rank,why:G.duel.res.why,rows:G.duel.res.rows.map(r=>r.txt)}));
  const aR=await L[0].pg.evaluate(()=>G.duel.res.rank);
  ok(res&&rk.every(x=>x===rk[0])&&own.every(x=>x===own[0])&&aR===1&&cl.every(Boolean)&&/차지/.test(R.rows[0]), `낱말퀴즈 결과: 순위·주인 모두 같음 · A 1위 · "${R.why}" · ${R.rows.join(' / ')}`);
  await L[1].pg.screenshot({path:SHOT+'/crossword3-result.png'});
  ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}
/* 컴퓨터 상대: 초성은 게임이 문제마다 차지시키고, 낱말퀴즈는 엔진이 계단마다 남은 낱말(duelKeys)을 차지 */
async function wordAi(g,ms){
  const x=await mk('S');
  await x.pg.evaluate(g=>startGame(g,'normal',{duel:duelMakeAI(g,'나','n')}),g);
  const go=await until(x,()=>G&&G.duel&&G.duel.go,null,15000);
  const t0=Date.now(), got=await until(x,()=>Object.values(G.duel.owners||{}).includes('ai')||(G.m.bz&&G.m.i>=3),null,ms);
  const st=await x.pg.evaluate(()=>({ai:Object.values(G.duel.owners||{}).filter(p=>p==='ai').length,i:G.m.i,chip:G.duel.P.ai.st.v||0}));
  ok(go&&got&&(st.ai>0?st.chip===st.ai:true)&&!x.errs.length, `${g} 컴퓨터 상대: ${((Date.now()-t0)/1000).toFixed(1)}초 안에 컴퓨터 차지 ${st.ai}개(칩 값 ${st.chip})${st.ai?'':' · 맞힌 문제 없이 '+st.i+'번 문제까지 진행'} ${x.errs.join(' ')}`);
  await closeAll([x]);
}
if(MULTI){
  if(WANT('chosung')){ await chosungShared3(); await wordAi('chosung',60000); }
  if(WANT('crossword')){ await crosswordShared3(); await wordAi('crossword',20000); }
}

/* ================= 3) 차례 게임 2단계(WP12: 오목·함대·고스톱) — 게임별 함수, 이름을 고르면(또는 아무것도 안 고르면 함대·오목) 돈다 ================= */
const WANT12=g=>HAS(g)&&!ONLYM&&(ARGS.length?ARGS.includes(g):['omok','fleet'].includes(g));
/* 오목: 흑백이 서로 다름 → 한 판 더(같은 상대) → 흑백이 바뀜 */
async function wp12Omok(){
  const L=[await mk('A'),await mk('B')];
  await L[0].pg.evaluate(()=>duelStart('omok')); await w(300); await L[1].pg.evaluate(()=>duelStart('omok'));
  const go=(await Promise.all(L.map(x=>until(x,()=>G&&G.duel&&G.duel.go&&G.m&&G.m.began)))).every(Boolean);
  const c1=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.m.me)));
  ok(go&&c1[0]!==c1[1],`오목 1판: 흑백 다름 ${c1.join('/')}`);
  /* 흑 차례인 사람이 한 수 두면 상대 판에도 그 수 */
  const bi=c1.indexOf(1); await L[bi].pg.evaluate(()=>{const n=G.m.B.n;document.querySelector('#omPut');G.m.preview=(n>>1)*n+(n>>1);document.querySelector('#omPut').disabled=false;document.querySelector('#omPut').click();});
  const seen=await until(L[1-bi],()=>G.m.hist.length===1,null,6000);
  ok(seen,'오목: 흑의 첫 수가 상대 판에 보임');
  await L[0].pg.evaluate(()=>finish(true)); await w(800); await L[1].pg.evaluate(()=>finish(false));
  await Promise.all(L.map(x=>until(x,()=>G.duel.resolved,null,10000))); await w(1200);
  await Promise.all(L.map(x=>x.pg.evaluate(()=>duelAgain())));
  const again=(await Promise.all(L.map(x=>until(x,()=>G&&G.duel&&G.duel.r===2&&G.duel.go&&G.m&&G.m.began,null,15000)))).every(Boolean);
  const c2=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.m.me)));
  ok(again&&c2[0]!==c2[1]&&c2[0]!==c1[0]&&c2[1]!==c1[1],`오목 한 판 더: 흑백 바꿈 ${c1.join('/')} → ${c2.join('/')}`);
  await L[0].pg.screenshot({path:SHOT+'/omok-again.png'});
  ok(!errsOf(L).length,'오목 오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}
/* 함대: 사이트 방(WP2 계약 room·pl·host·info)에서 duelLaunch(o) → 상대 찾기 없이 같은 방 · 선공은 방장(2판째는 바뀜) · 포격이 상대에게 감 */
async function wp12FleetRoom(){
  for(const r of [1,2]){
    const L=[await mk('A'),await mk('B')];
    await Promise.all(L.map((x,i)=>x.pg.evaluate(([i,r])=>{store.set('hp:help:fleet',1);NG.fleet.duelLaunch({room:'fl-d3-r-test01-'+r,pl:['a','b'],host:i===0,again:r>1,pace:'n',n:2,lv:'normal',nick:i?'비':'가',info:{id:'TEST01',rd:r,n:2}});},[i,r])));
    const placed=(await Promise.all(L.map(x=>until(x,()=>G&&G.id==='fleet'&&G.phase==='place'&&!!G.link,null,8000)))).every(Boolean);
    await L[0].pg.evaluate(()=>document.querySelector('#flGo').click()); await w(1500);
    const waitTxt=await L[0].pg.evaluate(()=>G.phase+' '+((document.querySelector('#flSt')||{}).textContent||''));
    await L[1].pg.evaluate(()=>document.querySelector('#flGo').click());
    const bat=(await Promise.all(L.map(x=>until(x,()=>G.phase==='battle',null,10000)))).every(Boolean);
    const st=await Promise.all(L.map(x=>x.pg.evaluate(()=>({first:G.first,room:G.nr&&G.nr.name||'',lobby:!!(ROOM.peers().find(p=>p.sameTab)||{presence:{}}).presence.fl}))));
    const hostFirst=r===1?st[0].first:st[1].first;
    ok(placed&&bat&&st[0].first!==st[1].first&&hostFirst&&!st[0].lobby&&/방 친구/.test(waitTxt), `함대 방 ${r}판: 같은 방에서 바로 시작 · 선공 ${r===1?'방장':'도전자'}(${st.map(s=>s.first)}) · 먼저 출격한 쪽 "${waitTxt}"`);
    const fi=st[0].first?0:1;
    await L[fi].pg.evaluate(()=>{flAim(0);flFire(0);});
    const got=await until(L[1-fi],()=>G.myShot[0]>0,null,8000);
    ok(got,`함대 방 ${r}판: 포격이 상대 바다에 닿음`);
    if(r===1) await L[0].pg.screenshot({path:SHOT+'/fleet-room.png'});
    ok(!errsOf(L).length,'함대 방 오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
  }
}
/* 고스톱: 사이트 방(WP2 계약)에서 duelLaunch(o) → 판 고르기·상대 찾기 없이 같은 방 · 자리 다름 · 같은 씨앗 */
async function wp12GostopRoom(){
  const L=[await mk('A'),await mk('B')];
  await Promise.all(L.map((x,i)=>x.pg.evaluate(i=>{store.set('hp:age19',1);store.set('hp:help:gostop',1);NG.gostop.duelLaunch({room:'fl-d3-r-test02-1',pl:['a','b'],host:i===0,again:false,pace:'n',n:2,lv:'normal',nick:i?'비':'가',info:{id:'TEST02',rd:1,n:2}});},i)));
  const began=(await Promise.all(L.map(x=>until(x,()=>G&&G.gs&&G.gs.mode==='pvp'&&G.gs.seed0&&G.gs.oppSeen&&G.gs.phase!=='joining',null,15000)))).every(Boolean);
  const st=await Promise.all(L.map(x=>x.pg.evaluate(()=>({seat:G.gs.seat,seed:G.gs.seed0,room:G.gs.room&&G.gs.room.name,link:!!G.gs.link}))));
  ok(began&&st[0].seat===0&&st[1].seat===1&&st[0].seed===st[1].seed&&st[0].room==='연습 판',`고스톱 방: 바로 마주 앉음 · 자리 ${st.map(s=>s.seat)} · 같은 씨앗=${st[0].seed===st[1].seed} · 판 '${st[0].room}'`);
  ok(!errsOf(L).length,'고스톱 방 오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}
if(WANT12('omok')) await wp12Omok();
if(WANT12('fleet')) await wp12FleetRoom();
if(WANT12('gostop')) await wp12GostopRoom();
/* ================= 3) 선점 게임 3명(숨은그림·틀린그림, docs/21 WP6·WP7 완료 기준) =================
   진짜 게임 정의로: 같은 판 · A가 50ms 먼저 눌렀지만 A 소식이 늦게 도착해도 주인은 A 하나(B는 뺏김 → 내 수 되돌림) ·
   남이 차지한 것을 누르면 벌칙 없음 · 빗나감은 실수 · 승부가 나면 모두 끝 · 모든 기기 같은 순위. 컴퓨터 상대도 열쇠를 차지하는지 */
async function sharedTest3(g){
  const C={hidden:{tap:'_tapItemForTest',st:'h',pre:'o'},spot:{tap:'_tapDiffForTest',st:'m',pre:'d'}}[g]; if(!C) return;
  console.log(`— 선점 3명: ${g} —`);
  const L=[await mk('A'),await mk('B'),await mk('C')];
  if(g==='hidden') await Promise.all(L.map(x=>x.pg.evaluate(()=>{ window.dayKey=()=>'2026-10-07'; })));   /* 새 장면(10-07부터 모든 모드)으로 점검 */
  await Promise.all(L.map(x=>x.pg.evaluate(g=>duelStart(g),g)));   /* 함께 찾기(5명 점검과 같은 방식) */
  const go=await goAll(L,32000), I=await info(L);
  const board=await Promise.all(L.map(x=>x.pg.evaluate(([c,g])=>{const m=G[c.st];return JSON.stringify(g==='hidden'?[m.sc.key,!!m.sc.v2,m.items.map(o=>[o.k,Math.round(o.x),Math.round(o.y)])]:[m.theme,m.diffs.map(d=>[Math.round(d.cx),Math.round(d.cy)])]);},[C,g])));
  const n=await L[0].pg.evaluate(c=>(c.st==='h'?G.h.items:G.m.diffs).length,C);
  ok(go&&I.every(i=>i.seed===I[0].seed&&i.pl===I[0].pl)&&I[0].pl.split(',').length===3&&board.every(b=>b===board[0]),
    `${g} 3명 모임·같은 판(${board[0].slice(0,40)}…) 열쇠 ${n}개 · 제한 ${await L[0].pg.evaluate(()=>G.limit)}초`+(board.every(b=>b===board[0])?'':' 판 다름 '+board.map(b=>b.slice(0,30)).join(' / '))+' 인원 '+I.map(i=>i.pl.split(',').length+':'+i.seed.slice(0,30)).join(' '));
  await Promise.all(L.map(x=>until(x,c=>elapsed()>.8&&G[c.st].phase==='play',C,8000)));
  const pid=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.myPid)));
  const k0=C.pre+'0', k1=C.pre+'1';
  /* (1) 동시 누르기 50ms 차: A가 먼저, 그런데 A 소식이 늦게 도착(0.3초) → 잠깐 B 것으로 보였다가 모두 A로 */
  DELAY.A=STRESS?2000:700;
  /* 두 기기가 같은 순간(서버 시각 기준)을 기다렸다가 A는 바로, B는 50ms 뒤에 누름(evaluate 지연과 상관없이 50ms 차) */
  const at=await L[0].pg.evaluate(()=>netNow()+400);
  await Promise.all([[0,0],[1,50]].map(([j,d])=>L[j].pg.evaluate(([c,at,d])=>new Promise(r=>{const go=()=>{NG[G.id][c.tap](0);r();};const t=at+d-netNow();setTimeout(go,Math.max(0,t));}),[C,at,d])));
  const mid=await L[1].pg.evaluate(k=>duelOwner(k)===G.duel.myPid,k0);
  if(process.env.DBG){ console.log('   dbg B', await L[1].pg.evaluate(k=>JSON.stringify({own:duelOwner(k),me:G.duel.myPid,cl:G.duel.P[G.duel.myPid].cl,owners:G.duel.owners,el:elapsed()}),k0)); console.log('   dbg A', await L[0].pg.evaluate(()=>JSON.stringify({cl:G.duel.P[G.duel.myPid].cl,owners:G.duel.owners}))); }
  await w(STRESS?3200:1000); DELAY.A=0;
  const own0=await Promise.all(L.map(x=>x.pg.evaluate(k=>duelOwner(k),k0)));
  const st0=await Promise.all(L.map(x=>x.pg.evaluate(c=>{const m=G[c.st];return {found:m.found,mine:c.st==='h'?m.own[0]:m.diffs[0].own,marks:document.querySelectorAll(c.st==='h'?'.ng-hidden .hd-own':'.ng-spot [id$="MA"] .sp-own').length};},C)));
  ok(mid&&own0.every(o=>o===pid[0])&&st0[0].found===1&&st0[1].found===0&&st0.every(s=>s.mine===pid[0]&&s.marks===1),
    `동시 누르기 50ms 차: B 화면에 잠깐 B=${mid} → 모두 주인 A · 찾은 수 A ${st0[0].found} B ${st0[1].found} · 표시 ${st0.map(s=>s.marks)}`);
  /* (2) C가 다른 것 차지 → A가 그것을 눌러도 벌칙 없음 */
  await L[2].pg.evaluate(c=>NG[G.id][c.tap](1),C); await w(700);
  const mis0=await L[0].pg.evaluate(c=>G[c.st].misses,C);
  await L[0].pg.evaluate(c=>NG[G.id][c.tap](1),C); await w(120);
  const a1=await L[0].pg.evaluate(c=>({mis:G[c.st].misses,cool:G[c.st].coolUntil>(c.st==='h'?Date.now():performance.now()),msg:(document.querySelector('#hdMsg,#spMsg')||{}).textContent||''}),C);
  const own1=await Promise.all(L.map(x=>x.pg.evaluate(k=>duelOwner(k),k1)));
  ok(own1.every(o=>o===pid[2])&&a1.mis===mis0&&!a1.cool&&/이미 차지/.test(a1.msg),`남이 차지한 것 누르기: 벌칙 없음(실수 ${a1.mis}) · "${a1.msg}"`);
  /* (3) B 빗나감 → 실수 1, 잠깐 못 누름 */
  await L[1].pg.evaluate(()=>NG[G.id]._tapMissForTest()); await w(450);
  const bm=await L[1].pg.evaluate(c=>({mis:G[c.st].misses,st:duelStatNow().mis}),C);
  ok(bm.mis===1&&bm.st===1,`빗나감 = 실수 1번(대전 막대에도 ${bm.st})`);
  await w(1200);
  await L[1].pg.screenshot({path:`${SHOT}/shared-${g}-play.png`});
  /* (4) 나머지: A 2·3, B 4 (숨은그림 6개면 A3·B1·C1·남은 1 → 승부 남 → 끝) / 틀린그림은 C 5·6까지 → 다 차지 → 끝 */
  for(const [who,i] of [[0,2],[0,3],[1,4],[2,5],[2,6]]){
    const over=await L[0].pg.evaluate(()=>G.over); if(over) break;
    await L[who].pg.evaluate(([c,i])=>{ if(!G.over) NG[G.id][c.tap](i); },[C,i]); await w(700);
  }
  const res=(await Promise.all(L.map(x=>until(x,()=>G.duel&&G.duel.resolved,null,15000)))).every(Boolean); await w(1300);
  const rk=await ranksOf(L), why=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.res.why))), cl=await bodyClean(L);
  const myRank=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.res.rank)));
  const want=g==='hidden'?[1,3,2]:[1,3,2];
  ok(res&&rk.every(x=>x===rk[0])&&myRank.join()===want.join()&&cl.every(Boolean)&&why.every(t=>g==='hidden'?/먼저 차지해서/.test(t):/모두 찾아서/.test(t)),
    `${g} 끝: 순위 모두 같음=${rk.every(x=>x===rk[0])} · A·B·C = ${myRank} (기대 ${want}) · 이유 "${why[1]}" · '실패'·'진행 0%' 없음=${cl}`+(rk.every(x=>x===rk[0])?'':' '+rk.join(' / ')));
  await L[1].pg.screenshot({path:`${SHOT}/shared-${g}-result.png`});
  ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
  /* (5) 컴퓨터 상대: 계단마다 남은 열쇠 하나를 차지하고 게임 화면에도 그 색으로 보임 */
  const X=await mk('AI');
  if(g==='hidden') await X.pg.evaluate(()=>{ window.dayKey=()=>'2026-10-07'; });
  await X.pg.evaluate(g=>startGame(g,'normal',{duel:duelMakeAI(g,'나','n')}),g);
  await until(X,()=>G.duel&&G.duel.go,null,10000);
  const got=await until(X,()=>Object.values(G.duel.owners||{}).includes('ai'),null,STRESS?30000:20000);
  const aiv=await X.pg.evaluate(c=>{const m=G[c.st],keys=NG[G.id].duelKeys();const k=keys.find(k=>duelOwner(k)==='ai');const i=+k.slice(1);return {k,mine:c.st==='h'?m.own[i]:m.diffs[i].own,t:Math.round(elapsed()),bar:duelStatNow().v,ai:G.duel.P.ai.st.v};},C).catch(e=>({err:String(e)}));
  ok(got&&aiv.mine==='ai'&&aiv.ai===1,`컴퓨터가 ${aiv.t}초에 ${aiv.k} 차지 → 게임 표시 ${aiv.mine} · 컴퓨터 수 ${aiv.ai}`);
  await X.pg.screenshot({path:`${SHOT}/shared-${g}-ai.png`});
  ok(!X.errs.length,'오류 없음 '+X.errs.join(' | ')); await closeAll([X]);
}
if(MULTI) for(const g of GAMES) await sharedTest3(g);
/* ================= 3) 차례 게임 3명(WP12 카드 짝 · WP11 끝말잇기): 모든 기기 같은 판·같은 결과, 시간 초과·나감 ================= */
const turnStart=async(L,g)=>{for(const x of L){ await x.pg.evaluate(g=>duelStart(g),g); await w(250);} return goAll(L,30000);};
const curIdx=async L=>{for(let i=0;i<L.length;i++){ if(await L[i].pg.evaluate(()=>!!(G&&G.duel&&!G.over&&duelTurn.mine()))) return i; } return -1;};
const allTimeout=(L,s)=>Promise.all(L.map(x=>x.pg.evaluate(s=>duelTurn.timeout(s),s)));

/* 카드 짝: 판 4×6 · 틀리면 다음 사람 · 맞히면 한 번 더 · 시간 초과 대신 뒤집기 · 차례인 사람이 나가면 건너뜀 · 끝까지 → 순위 같음 */
async function memoryTurn3(){
  const L=[await mk('A'),await mk('B'),await mk('C')];
  const go=await turnStart(L,'memory'), I=await info(L);
  const hash=xs=>Promise.all(xs.map(x=>x.pg.evaluate(()=>{const m=G.m,d=m.dd;return JSON.stringify([m.cards,m.st,d.own,G.duel.pl.map(p=>[d.pairs[p],d.miss[p]]),duelTurn.cur(),duelTurn.n()]);})));
  const same=a=>a.every(h=>h===a[0]);
  const board=await L[0].pg.evaluate(()=>[G.m.cols,G.m.rows,G.m.pairs,G.m.preview]);
  ok(go&&I.every(i=>i.seed===I[0].seed)&&I[0].pl.split(',').length===3&&board.join()==='4,6,12,0',`카드 짝 3명 모임: 같은 방·판 4×6 12쌍 미리 보기 없음 (${board})`);
  await w(1200);
  ok(same(await hash(L)),'카드 짝 시작 판이 모든 기기에서 같음');
  const tap=(x,i)=>x.pg.evaluate(i=>{const el=document.querySelector(`.mm-card[data-i="${i}"]`);if(el)el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));},i);
  const pick=(x,hit)=>x.pg.evaluate(hit=>{const m=G.m,dn=m.st.map((s,i)=>s===0&&!m.open.includes(i)?i:-1).filter(i=>i>=0),a=dn[0];return [a,dn.find(j=>j!==a&&(hit?m.cards[j]===m.cards[a]:m.cards[j]!==m.cards[a]))];},hit);
  /* 1) 틀림 → 다음 사람 */
  let c=await curIdx(L); const pl=I[0].pl.split(','), who=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.myPid)));
  let [a,b]=await pick(L[c],false); await tap(L[c],a); await w(350); await tap(L[c],b); await w(1300);
  const seeOpen=await L[(c+1)%3].pg.evaluate(()=>document.querySelectorAll('.mm-card.up').length);
  const h1=await hash(L), c1=await curIdx(L);
  ok(same(h1)&&c1!==c&&who[c1]===pl[(pl.indexOf(who[c])+1)%3],`틀리면 다음 사람 차례(모든 기기 같은 상태) · 남이 뒤집은 카드 보임=${seeOpen>=0}`);
  /* 2) 맞힘 → 한 번 더 */
  c=c1; [a,b]=await pick(L[c],true); await tap(L[c],a); await w(350); await tap(L[c],b); await w(900);
  const h2=await hash(L), c2=await curIdx(L), mine=await L[c].pg.evaluate(()=>G.m.dd.pairs[G.duel.myPid]);
  ok(same(h2)&&c2===c&&mine===1,`맞히면 가져가고 한 번 더(같은 사람 차례) · 가져간 짝 ${mine}`);
  /* 3) 시간 초과 → 모든 기기가 같은 카드를 대신 뒤집고 다음 사람 */
  await allTimeout(L,1); await w(STRESS?6000:4200); await allTimeout(L,15);
  const h3=await hash(L), c3=await curIdx(L);
  ok(same(h3)&&c3!==c,`시간 초과 대신 뒤집기 → 다음 사람(모든 기기 같음)`);
  /* 4) 차례인 사람이 나감 → 건너뜀 */
  const lv=c3; await L[lv].pg.evaluate(()=>{ G.over=true; HOST.exit(); });
  const rest=L.filter((_,i)=>i!==lv);
  const skip=(await Promise.all(rest.map(x=>until(x,p=>!!G.duel.P[p].left&&duelTurn.cur()!==p,who[lv],20000)))).every(Boolean);
  ok(skip,'차례인 사람이 나가면 다음 사람으로 넘어감');
  /* 5) 남은 두 사람이 끝까지(아는 짝을 차례로) */
  for(let k=0;k<200;k++){
    if((await Promise.all(rest.map(x=>x.pg.evaluate(()=>G.over)))).every(Boolean)) break;
    const ci=await curIdx(rest); if(ci<0){ await w(300); continue; }
    const busy=await rest[ci].pg.evaluate(()=>Date.now()<G.m.dd.busyUntil); if(busy){ await w(250); continue; }
    const [p,q]=await pick(rest[ci],true); if(p==null||q==null){ await w(300); continue; }
    await tap(rest[ci],p); await w(200); await tap(rest[ci],q); await w(450);
  }
  const res=(await Promise.all(rest.map(x=>until(x,()=>G.duel&&G.duel.resolved,null,15000)))).every(Boolean); await w(800);
  const rows=await Promise.all(rest.map(x=>x.pg.evaluate(()=>JSON.stringify(G.duel.res.rows.map(r=>[r.pid,r.rank,r.v,r.left]).sort()))));
  const last=await rest[0].pg.evaluate(()=>{const R=G.duel.res;return R.rows[R.rows.length-1].txt;});
  const why=await rest[0].pg.evaluate(()=>G.duel.res.why);
  ok(res&&same(rows)&&last==='나감'&&/짝을 모두 찾았어요/.test(why),`카드 짝 결과 순위 같음 · 나간 사람 맨 뒤 · "${why}"`);
  await rest[0].pg.screenshot({path:SHOT+'/memory3-result.png'});
  ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}

/* 끝말잇기: 같은 시작 낱말 · 돌아가며 잇기 · 시간 초과 탈락 · 탈락한 사람 차례는 넘김 · 차례인 사람이 나가면 탈락 → 마지막 남은 사람 1위 */
async function wordchainTurn3(){
  const L=[await mk('A'),await mk('B'),await mk('C')];
  const go=await turnStart(L,'wordchain'), I=await info(L);
  await Promise.all(L.map(x=>until(x,()=>G.m.phase==='play',null,8000)));
  const st=()=>Promise.all(L.filter(x=>!x.gone).map(x=>x.pg.evaluate(()=>{const m=G.m,d=m.dw;return JSON.stringify([m.chain.map(c=>c.w),G.duel.pl.map(p=>[d.P[p].words,d.P[p].out,d.P[p].outN]),duelTurn.cur(),duelTurn.n()]);})));
  const same=a=>a.every(h=>h===a[0]);
  const s0=await st();
  ok(go&&I.every(i=>i.seed===I[0].seed)&&I[0].pl.split(',').length===3&&same(s0),`끝말잇기 3명 모임: 같은 시작 낱말 ${JSON.parse(s0[0])[0][0]}`);
  const say=async x=>x.pg.evaluate(()=>{const m=G.m,D=NG.wordchain._dict,C=D.cands(m,m.chain[m.chain.length-1].w),c=C.find(j=>D.follow(m,j)>3)??C[0];const inp=document.querySelector('#wcInput');inp.value=D.W[c];document.querySelector('#wcGo').click();return D.W[c];});
  const who=await Promise.all(L.map(x=>x.pg.evaluate(()=>G.duel.myPid)));
  /* 1) 첫 사람 → 둘째 사람이 잇기 */
  let c=await curIdx(L); const w1=await say(L[c]); await w(700);
  c=await curIdx(L); const w2=await say(L[c]); await w(700);
  const s1=await st(); const ch=JSON.parse(s1[0])[0];
  ok(same(s1)&&ch.length===3&&ch[1]===w1&&ch[2]===w2,`돌아가며 잇기: ${ch.join(' → ')} (모든 기기 같음)`);
  /* 2) 셋째 사람이 시간 초과 → 탈락(모든 기기 같음) */
  const third=await curIdx(L);
  await allTimeout(L,1); await w(STRESS?6000:4200); await allTimeout(L,18);
  const s2=await st(), outs=JSON.parse(s2[0])[1].filter(p=>p[1]);
  ok(same(s2)&&outs.length===1&&outs[0][1]==='time',`시간 초과 → 탈락 ${JSON.stringify(outs)}`);
  /* 3) 첫·둘째 사람이 한 번씩 더 → 탈락한 셋째 차례는 그 기기가 바로 넘김 */
  c=await curIdx(L); await say(L[c]); await w(700);
  c=await curIdx(L); await say(L[c]); await w(1500);
  c=await curIdx(L); const s3=await st();
  ok(same(s3)&&c>=0&&c!==third&&JSON.parse(s3[0])[0].length===5,'탈락한 사람 차례는 넘어감(차례 '+(c>=0?who[c]:'?')+')');
  /* 4) 지금 차례인 사람이 나감 → 탈락 → 한 명만 남아 끝 */
  const lv=c; await L[lv].pg.evaluate(()=>{ G.over=true; HOST.exit(); }); L[lv].gone=true;
  const rest=L.filter((_,i)=>i!==lv);
  const res=(await Promise.all(rest.map(x=>until(x,()=>G.duel&&G.duel.resolved,null,30000)))).every(Boolean); await w(800);
  const rows=await Promise.all(rest.map(x=>x.pg.evaluate(()=>JSON.stringify(G.duel.res.rows.map(r=>[r.pid,r.rank]).sort()))));
  const R=await rest[0].pg.evaluate(()=>({why:G.duel.res.why,ord:G.duel.res.rows.map(r=>r.pid)}));
  const survivor=who.find((p,i)=>i!==lv&&i!==third);
  ok(res&&same(rows)&&R.ord[0]===survivor&&R.ord[1]===who[third]&&R.ord[2]===who[lv]&&/끝까지 남았어요/.test(R.why),`끝말잇기 순위 같음 · 1위 끝까지 남은 사람 · 2위 먼저 탈락 · 3위 나감 · "${R.why}"`);
  await rest[0].pg.screenshot({path:SHOT+'/wordchain3-result.png'});
  ok(!errsOf(L).length,'오류 없음 '+errsOf(L).join(' | ')); await closeAll(L);
}
const TURN3=ARGS.length?GAMES:['memory','wordchain'];
if(MULTI&&TURN3.includes('memory')&&HAS('memory')){ console.log('— 카드 짝 3명 차례 대전 —'); await memoryTurn3(); }
if(MULTI&&TURN3.includes('wordchain')&&HAS('wordchain')){ console.log('— 끝말잇기 3명 차례 대전 —'); await wordchainTurn3(); }

await br.close(); srv.close(); console.log(fail?`실패 ${fail}`:'대전 모두 통과'); process.exit(fail?1:0);
