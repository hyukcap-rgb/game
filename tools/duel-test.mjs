// 실시간 1:1 대전 점검(사람 둘): server/index.ts와 같은 규칙의 중계 서버를 이 프로세스 안에 띄우고
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
const GAMES=(ARG||'sudoku,link,match,merge,memory,block,nono,fox,ball').split(',');
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
  await ctx.routeWebSocket(/battle-production/,ws=>attach(ws));
  const pg=await ctx.newPage(); const errs=[]; if(STRESS){ const cdp=await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); } pg.on('pageerror',e=>errs.push(tag+' '+String(e)));
  pg.on('console',m=>{if(m.type()==='error'&&!/WebSocket|favicon/.test(m.text()))errs.push(tag+' '+m.text())});
  await pg.addInitScript(()=>{try{localStorage.setItem('hp:welcome','9');for(const g of ['fox','sudoku','ball','fleet','match','nono','block','memory','merge','link'])localStorage.setItem('hp:help:'+g,'1')}catch(_){}});
  await pg.goto(B+'index.html'); await pg.waitForFunction(()=>typeof ROOM_STATE!=='undefined'&&ROOM_STATE==='ok',null,{timeout:15000});
  await pg.evaluate(()=>closeModal&&closeModal()); return {ctx,pg,errs};}
let fail=0;
for(const g of GAMES){
  const A=await mk('A'),Bp=await mk('B');
  await A.pg.evaluate(g=>duelStart(g),g); await w(300); await Bp.pg.evaluate(g=>duelStart(g),g);
  const ok=await Promise.all([A,Bp].map(x=>x.pg.waitForFunction(()=>G&&G.duel&&G.duel.go,null,{timeout:20000}).then(()=>true).catch(()=>false)));
  const st=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>({mode:G.duel.mode,seed:G.duel.seed,start:G.start,off:Math.round(ROOM.clockOffset)}))));
  console.log('   시계 오차(ms)',st.map(s=>s.off).join(', '));
  if(STRESS){ for(const x of [A,Bp]) await x.pg.evaluate(()=>{window.__st=setInterval(()=>{try{fxConfetti();fxBurst(200,400,['#fff','#fc0'],40,{glow:true});}catch(e){console.error(e)}},300)}); }
  await w(2500);
  if(STRESS){ const fr=await A.pg.evaluate(()=>({q:FXR.q,ema:Math.round(FXR.ema),lite:SCN.lite,n:SCN.items.length})); console.log('   부하 중 효과 품질',JSON.stringify(fr)); }
  // 중간 진행이 상대에게 보이는지
  const seen=await Bp.pg.evaluate(()=>({opp:G.duel.opp&&G.duel.opp.nick, hb:!!G.duel}));
  await A.pg.evaluate(()=>finish(true)); await w(1500); await Bp.pg.evaluate(()=>finish(true));
  const res=await Promise.all([A,Bp].map(x=>x.pg.waitForFunction(()=>G&&G.duel&&G.duel.resolved,null,{timeout:15000}).then(()=>true).catch(()=>false)));
  await w(1200);   /* 결과 창이 뜨는 시간 */
  const sc=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>({me:G.duel.me&&G.duel.me.sc,opp:G.duel.opp&&G.duel.opp.sc,txt:(document.querySelector('#modal h3')||{}).textContent||''}))));
  const r=sc.map(s=>s.txt.trim()||'?');
  const good=ok.every(Boolean)&&res.every(Boolean)&&st[0].mode==='pvp'&&st[1].mode==='pvp'&&st[0].seed===st[1].seed&&Math.abs(st[0].start-st[1].start)<400&&sc[0].me===sc[1].opp&&sc[1].me===sc[0].opp&&!A.errs.length&&!Bp.errs.length
    &&({'승리!':'패배','패배':'승리!','무승부':'무승부'})[r[0]]===r[1];   /* 한쪽이 이기면 다른 쪽은 져야 함 */
  /* 한쪽이 끝나면 다른 쪽도 끝: B는 A가 끝낸 뒤 스스로 끝내기 전에 끊겨야 함 → '계속 풀기'로 혼자 이어 풀기 */
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
  if(!cutOk)fail++;
  console.log(`  ${cutOk?'✓':'✗'} 상대가 끝내면 나도 끝=${cut.cut} 계속풀기=${JSON.stringify(cont)}`);
  if(!good)fail++;
  console.log(`${good?'✓':'✗'} ${g}  pvp=${st.map(s=>s.mode)} 같은문제=${st[0].seed===st[1].seed} 시작차=${Math.abs(st[0].start-st[1].start)}ms 점수A=${sc[0].me}/${sc[0].opp} B=${sc[1].me}/${sc[1].opp} 결과=${r.join(' | ')} ${[...A.errs,...Bp.errs].join(' ')}`);
  await A.ctx.close(); await Bp.ctx.close();
}
// 함대: 실시간 포격전 방 연결
{ const A=await mk('A'),Bp=await mk('B');
  await A.pg.evaluate(()=>duelStart('fleet')); await w(300); await Bp.pg.evaluate(()=>duelStart('fleet'));
  await w(1500);
  const lv=await Promise.all([A,Bp].map(x=>x.pg.evaluate(()=>G&&G.lv)));
  console.log(`${lv.every(v=>v==='pvp')&&!A.errs.length&&!Bp.errs.length?'✓':'✗'} fleet 실시간 모드=${lv} ${[...A.errs,...Bp.errs].join(' ')}`);
  if(!lv.every(v=>v==='pvp'))fail++;
  await A.ctx.close(); await Bp.ctx.close(); }
await br.close(); srv.close(); console.log(fail?`실패 ${fail}`:'대전 모두 통과'); process.exit(fail?1:0);
