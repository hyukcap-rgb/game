// 대전 방 점검(docs/22 → docs/21 10-2·11-1, 결정 208·209·212): 사람 여럿(브라우저 4~5개)
//  1) 2명 방: 만들기 → 목록에 "1/2" → 들어가기 → 내보내기(다시 못 들어옴) → 방장이 혼자 나가면 목록에서 사라짐
//  2) 친구 접속·실시간 초대 → 비공개 방(정원 기본 = 그 게임 최대) → 2명 판(같은 문제·보통·보상 400/150·첫 판 ♥1)
//  3) 방 코드로 들어가기(틀린 코드 오류 · 맞는 코드 입장) + 링크로 4명 → 4명 판(보상 500/330/230/150 · 새로 온 사람만 ♥1)
//  4) 한 판 더 = 방으로 + 자동 준비 → 모두 누르면 3초 뒤 자동 시작(새 씨앗 · 무료)
//  5) 방장이 나가면 들어온 순서가 가장 빠른 사람이 방장(나머지 화면에 "이제 ○○님이 방장이에요")
//  6) 일부만 한 판 더 → 방장 [시작]으로 누른 사람끼리 · 3판 연속 쉬면 자동으로 나감 · 5판째부터 ♥1
//  7) 390px 화면 캡처: 대전 탭 · 방 목록 · 방 안 2·3·5명 · 결과 창 2·4명 · 코드 입력
//   node tools/build.js && npm run test:room
// 중계 서버는 이 프로세스 안에 띄우고(server/index.ts와 같은 규칙), 친구 서버는 막고 친구 정보는 직접 넣는다.
// 다인원은 이 점검 안에서만 NG.sudoku.duelMax = 5로 덮어쓴다(게임 WP가 올리기 전에도 방 동작을 볼 수 있게).
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SHOT=process.env.SHOT_DIR||'/tmp';
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
async function mk(tag,nick){const ctx=await br.newContext({viewport:{width:390,height:844}});
  await ctx.routeWebSocket(/battle-production/,ws=>attach(ws)); await ctx.route(/function-bun|railway\.app\/api|fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(tag+' '+String(e)));
  pg.on('console',m=>{if(m.type()==='error'&&!/WebSocket|favicon|Failed to load resource/.test(m.text()))errs.push(tag+' '+m.text())});
  await pg.addInitScript(n=>{try{localStorage.setItem('hp:welcome','9');localStorage.setItem('hp:nick',JSON.stringify(n));for(const g of ['fox','sudoku','ball','fleet','match','nono','block','memory','merge','link'])localStorage.setItem('hp:help:'+g,'1')}catch(_){}},nick);
  await pg.goto(B+'index.html',{waitUntil:'domcontentloaded'}); await pg.waitForFunction(()=>typeof ROOM_STATE!=='undefined'&&ROOM_STATE==='ok',null,{timeout:15000});
  await pg.evaluate(n=>{closeModal&&closeModal(); store.set('hp:nick',n); NG.sudoku.duelMax=5; store.set('hp:hearts',{n:5,t:Date.now()});},nick);
  return {ctx,pg,errs,tag};}

let fail=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c) fail++; return c;};
const until=(pg,fn,arg,ms=10000)=>pg.waitForFunction(fn,arg,{timeout:ms}).then(()=>true).catch(()=>false);
const shot=(pg,name)=>pg.screenshot({path:SHOT+'/'+name}).catch(()=>{});
const hearts=pg=>pg.evaluate(()=>heartState().n);
const A=await mk('A','방장A'), Bp=await mk('B','도전B');
const a=A.pg, b=Bp.pg;
// 1) 2명 방: 방 만들기 → B 목록에 보임
await a.evaluate(()=>{NG.sudoku.duelMax=2;}); await b.evaluate(()=>{NG.sudoku.duelMax=2;});
await a.evaluate(()=>rmCreate({g:'sudoku',d:'easy',band:'all',pv:false}));
ok(await until(b,()=>rmAds('sudoku').length===1), '방장이 만든 방이 B의 스도쿠 방 목록에 보임');
await b.evaluate(()=>rmList('sudoku')); await w(400);
const row=await b.evaluate(()=>{const r=document.querySelector('#rmRows .rmrow');return r?r.textContent.replace(/\s+/g,' '):''});
ok(/방장A/.test(row)&&/쉬움/.test(row)&&/\+300/.test(row)&&/1\/2/.test(row), '방 줄: 방장 이름·난이도·1위 보상·인원 1/2 → '+row.trim());
await shot(b,'room-list.png');
await b.click('#rmRows [data-rj]');
ok(await until(b,()=>RM.cur&&!RM.cur.host&&!!document.querySelector('#rmRoom')), 'B가 방에 들어감');
ok(await until(a,()=>RM.cur&&RM.cur.ord.length===2), '방장 화면에 자리 2/2');
ok(await until(b,()=>rmAds('sudoku')[0]&&rmAds('sudoku')[0].n===2,null,5000), '목록 인원 2/2');
await a.evaluate(()=>rmOpen()); await w(400); await shot(a,'room-2.png');
// 내보내기 → 다시 못 들어옴
await a.click('[data-kick]'); await a.click('#rkYes');
ok(await until(b,()=>!RM.cur), 'B가 내보내짐');
const rid=await a.evaluate(()=>RM.cur.id);
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(rid), '방 코드 6글자(I·O·0·1 없음) '+rid);
const kerr=await b.evaluate(id=>new Promise(res=>rmJoin(id,{invited:true,onErr:res})),rid);
ok(await b.evaluate(()=>!RM.cur)&&/내보내져서/.test(kerr), '내보낸 사람은 다시 못 들어옴 → '+kerr);
await a.evaluate(()=>rmLeave()); await w(500);
ok(await until(b,()=>rmAds('sudoku').length===0), '방장이 혼자 나가면 목록에서 방이 사라짐');
await a.evaluate(()=>{NG.sudoku.duelMax=5;}); await b.evaluate(()=>{NG.sudoku.duelMax=5;});

// 2) 친구 접속 · 실시간 초대 (친구 정보는 직접 넣음) → 비공개 방
await a.evaluate(()=>{FR.acct={pid:'pa',secret:'s',code:'AAAAA2'};FR.friends=[{fid:'fb',nick:'도전B',code:'BBBBB2',seen:0}];});
await b.evaluate(()=>{FR.acct={pid:'pb',secret:'s',code:'BBBBB2'};FR.friends=[{fid:'fa',nick:'방장A',code:'AAAAA2',seen:0}];});
ok(await until(a,()=>frOnlineN()===1), 'A 화면: 접속 중인 친구 1명');
await a.evaluate(()=>frHub()); await w(300);
const hub=await a.evaluate(()=>document.querySelector('.frhub').textContent.replace(/\s+/g,' '));
ok(/접속 중 1/.test(hub)&&/도전B/.test(hub), '친구 화면에 접속 중 표시');
await shot(a,'friend-hub.png');
await a.click('[data-ft="fb"]'); await w(200); await a.click('[data-tg="sudoku"]'); await w(200); await a.click('[data-d="normal"]'); await w(200);
const capOn=await a.evaluate(()=>(document.querySelector('.rmcap button.on')||{}).textContent||'');
ok(capOn==='5명', '정원 기본 = 그 게임 최대(5명) → '+capOn);
await a.click('#rcGo');
ok(await until(a,()=>RM.cur&&RM.cur.pv&&RM.cur.d==='normal'&&RM.cur.cap===5), 'A: 비공개 보통 5명 방 만들어짐');
ok(await until(b,()=>!!document.querySelector('#rmInv')), 'B 화면 위에 초대 알림이 뜸');
ok(await b.evaluate(()=>rmAds('sudoku').length===0), '비공개 방은 목록에 안 보임');
await b.click('#rmInvGo');
ok(await until(b,()=>RM.cur&&RM.cur.invited), 'B가 초대로 들어감');
ok(await until(a,()=>RM.cur&&RM.cur.ord.length===2), 'A 방에 B 입장');
const codeTxt=await b.evaluate(()=>(document.querySelector('.rmcode b')||{}).textContent||'');
ok(codeTxt.replace(' ','')===await a.evaluate(()=>RM.cur.id), '비공개 방 코드가 방 안 모두에게 보임 '+codeTxt);
// 2명 판
const h0=await Promise.all([a,b].map(hearts));
await b.evaluate(()=>rmReady(true));
ok(await until(a,()=>rmMembers(RM.cur).some(m=>!m.me&&m.rdy)), 'A가 B 준비를 봄');
const pts0=await Promise.all([a,b].map(p=>p.evaluate(()=>dayState().duel)));
await a.evaluate(()=>rmStartGame());
ok((await Promise.all([a,b].map(p=>until(p,()=>G&&G.duel&&G.duel.go,null,20000)))).every(Boolean), '2명 모두 대전 시작');
const s1=await Promise.all([a,b].map(p=>p.evaluate(()=>({seed:G.duel.seed,lv:G.lv,start:G.start,room:!!G.duel.room,n:G.duel.pl.length}))));
ok(s1[0].seed===s1[1].seed&&s1[0].lv==='normal'&&Math.abs(s1[0].start-s1[1].start)<400&&s1[0].room&&s1[0].n===2, `같은 문제·보통·2명·시작차 ${Math.abs(s1[0].start-s1[1].start)}ms`);
ok(await a.evaluate(()=>{const p=ROOM.peers().find(x=>x.sameTab);return p&&p.presence.ps==='p:sudoku';}), '게임 중 상태(p:sudoku)가 대기실에 올라감');
await a.evaluate(()=>finish(true));
await Promise.all([a,b].map(p=>until(p,()=>!!document.querySelector('#dzRes'),null,15000)));
await w(1300);
const rr=await Promise.all([a,b].map(p=>p.evaluate(()=>({t:(document.querySelector('#modal h3')||{}).textContent,pri:(document.querySelector('#mPri')||{}).textContent||'',duel:dayState().duel,h:heartState().n,body:document.querySelector('#modal').textContent}))));
ok(rr[0].t==='1위'&&rr[1].t==='2위', '결과 큰 순위: '+rr.map(x=>x.t).join(' / '));
ok(rr[0].duel-pts0[0]===400&&rr[1].duel-pts0[1]===150, `보통 2명 보상: 1위 +${rr[0].duel-pts0[0]} · 2위 +${rr[1].duel-pts0[1]}`);
ok(h0[0]-rr[0].h===1&&h0[1]-rr[1].h===1, '첫 판은 하트 1개씩');
ok(/한 판 더 · 무료 남은 3번/.test(rr[0].pri)&&/한 판 더 · 무료 남은 3번/.test(rr[1].pri), '결과 창 주 버튼: '+rr[0].pri.trim());
ok(rr.every(x=>!/실패|진행 0%/.test(x.body)), '결과 창에 "실패"·"진행 0%" 없음');
await shot(b,'result-2.png');

// 3) 방 코드로 들어가기(C) + 링크로(D) → 4명
const C=await mk('C','셋째C'), Dp=await mk('D','넷째D'); const c=C.pg, d=Dp.pg;
await a.evaluate(()=>{closeModal(); goHome(); setTab('duel'); rmBack();}); await b.evaluate(()=>{closeModal(); goHome(); setTab('duel'); rmBack();});
await c.evaluate(()=>{setTab('duel');}); await w(300);
await shot(c,'room-duel-tab.png');
await c.click('#dfCode'); await w(300);
await c.type('#rcIn','ABC'); await w(200); await shot(c,'code-entry.png');
await c.fill('#rcIn',''); await c.type('#rcIn','ZZZZZZ');
ok(await until(c,()=>/그런 방이 없어요/.test((document.querySelector('#rcErr')||{}).textContent||''),null,8000), '틀린 코드 → "그런 방이 없어요"');
await shot(c,'code-error.png');
const code=await a.evaluate(()=>RM.cur.id);
await c.fill('#rcIn',''); await c.type('#rcIn',code.toLowerCase().slice(0,3)+' '+code.slice(3));
ok(await until(c,()=>RM.cur&&RM.cur.id&&!!document.querySelector('#rmRoom'),null,8000), 'C: 방 코드(소문자·띄어쓰기 섞어도)로 들어감');
await w(800); await a.evaluate(()=>rmOpen()); await w(500); await shot(a,'room-3.png');
await d.evaluate(id=>rmJoin(id,{invited:true}),code);
ok(await until(a,()=>RM.cur.ord.length===4), '방장 화면 4/5');
for(const p of [b,c,d]) await p.evaluate(()=>rmReady(true));
ok(await until(a,()=>rmMembers(RM.cur).filter(m=>m.rdy&&!m.me).length===3), '세 사람 준비');
const hb=await Promise.all([a,b,c,d].map(hearts)); const pb=await Promise.all([a,b,c,d].map(p=>p.evaluate(()=>dayState().duel)));
await a.evaluate(()=>rmStartGame());
const go2=await Promise.all([a,b,c,d].map(p=>until(p,()=>G&&G.duel&&G.duel.go&&G.duel.pl.length===4,null,25000)));
ok(go2.every(Boolean), '4명 모두 대전 시작');
const s2=await Promise.all([a,b,c,d].map(p=>p.evaluate(()=>G.duel.seed)));
ok(new Set(s2).size===1&&s2[0]!==s1[0].seed, '4명 같은 문제 · 지난 판과 다른 씨앗');
await a.evaluate(()=>finish(true));
await Promise.all([a,b,c,d].map(p=>until(p,()=>!!document.querySelector('#dzRes'),null,15000))); await w(1300);
const r2=await Promise.all([a,b,c,d].map(p=>p.evaluate(()=>({rank:G.duel.res.rank,rows:G.duel.res.rows.length,duel:dayState().duel,h:heartState().n,pri:(document.querySelector('#mPri')||{}).textContent||''}))));
const got=r2.map((x,i)=>x.duel-pb[i]);
const oth=got.slice(1).sort((x,y)=>x-y).join(',');
ok(r2.every(x=>x.rows===4)&&r2[0].rank===1&&got[0]===550&&(oth==='150,230,330'||oth==='240,240,240'), '4명 보상(보통 1위 500 + 2연승 불꽃 50, 공동은 평균): '+got.join(' / '));
ok(hb[0]===r2[0].h&&hb[1]===r2[1].h&&hb[2]-r2[2].h===1&&hb[3]-r2[3].h===1, '같은 방 2판째 무료 · 새로 온 사람만 ♥1 → '+hb.map((v,i)=>v-r2[i].h).join(','));
await shot(c,'result-4.png'); await shot(a,'result-4-win.png');
const cv=await c.evaluate(async()=>{const cv=await cardCanvas(cardDuel(DZ.R,DZ.id,DZ.code));return cv.width+'x'+cv.height+':'+cv.toDataURL('image/png').length;});
ok(/^1080x1920:\d{5,}/.test(cv), '대전 공유 카드 PNG '+cv.split(':')[0]);

// 4) 한 판 더 = 방으로 + 자동 준비 → 모두 누르면 3초 뒤 자동 시작
for(const p of [a,b,c,d]) await p.click('#mPri');
ok(await until(a,()=>RM.cur&&RM.cur.autoAt>0||(G&&G.duel&&G.duel.go&&G.duel.R&&/-3$/.test(G.duel.R)),null,8000), '모두 한 판 더 → 자동 시작 카운트다운');
await shot(b,'room-auto.png');
const go3=await Promise.all([a,b,c,d].map(p=>until(p,()=>G&&G.duel&&G.duel.go&&/-3$/.test(G.duel.R||''),null,20000)));
ok(go3.every(Boolean), '3초 뒤 4명 자동 시작(3판째)');
const s3=await Promise.all([a,b,c,d].map(p=>p.evaluate(()=>G.duel.seed)));
ok(new Set(s3).size===1&&s3[0]!==s2[0], '한 판 더는 새 씨앗');
await a.evaluate(()=>finish(true));
await Promise.all([a,b,c,d].map(p=>until(p,()=>!!document.querySelector('#dzRes'),null,15000))); await w(1000);
const band=await b.evaluate(()=>(document.querySelector('.dz-band')||{}).textContent||'');
ok(/이 방 3판째/.test(band)&&/방장A 3번/.test(band), '시리즈 띠: '+band);

// 5) 방장이 나가면 들어온 순서가 가장 빠른 사람(B)이 방장
for(const p of [b,c,d]) await p.evaluate(()=>{closeModal(); goHome(); setTab('duel'); rmBack();});
await a.evaluate(()=>{closeModal(); rmLeave();});
ok(await until(b,()=>RM.cur&&RM.cur.host,null,8000), 'B가 새 방장');
ok(await until(c,()=>RM.cur&&RM.cur.hostU===RM.cur.ord[0]&&!RM.cur.host&&rmMembers(RM.cur).find(m=>m.host&&m.nk==='도전B'),null,8000), 'C 화면: 방장이 B로 바뀜');
ok(await b.evaluate(()=>!!document.querySelector('#rmGo')), 'B 화면에 시작 버튼이 생김');

// 6) 일부만 한 판 더(D는 쉼) → B [시작]으로 B·C끼리 · 3판 연속 쉬면 D 자동으로 나감 · 5판째부터 ♥1
let lastHB=await hearts(b), spentB=[];
for(let k=0;k<3;k++){
  await c.evaluate(()=>rmReady(true));
  ok(await until(b,()=>rmMembers(RM.cur).some(m=>m.nk==='셋째C'&&m.rdy),null,6000), `  ${k+4}판: C 준비`);
  await w(300);
  await b.evaluate(()=>rmStartGame());
  const g=await Promise.all([b,c].map(p=>until(p,()=>G&&G.duel&&G.duel.go&&!G.over,null,20000)));
  ok(g.every(Boolean)&&await b.evaluate(()=>G.duel.pl.length===2), `  ${k+4}판: B·C 둘이 시작, D는 쉼`);
  await b.evaluate(()=>finish(true));
  await Promise.all([b,c].map(p=>until(p,()=>!!document.querySelector('#dzRes'),null,15000))); await w(600);
  const hn=await hearts(b); spentB.push(lastHB-hn); lastHB=hn;
  if(k<2){ for(const p of [b,c]) await p.evaluate(()=>{closeModal(); goHome(); setTab('duel'); rmBack();}); }
}
ok(await until(d,()=>!RM.cur,null,6000), 'D: 3판 연속 쉬어서 자동으로 방에서 나감 '+await d.evaluate(()=>RM.cur?JSON.stringify({rest:RM.cur.rest,rd:RM.cur.rd,ord:RM.cur.ord,host:RM.cur.host,hu:RM.cur.hostU,me:rmUid(),st:RM.cur.st}):'')+' B:'+await b.evaluate(()=>JSON.stringify({rd:RM.cur.rd,ord:RM.cur.ord})));
ok(spentB.join(',')==='0,1,1', 'B 하트: 4판째 무료 · 5판째부터 ♥1 → '+spentB.join(','));

// 7) 5명 방 화면
for(const p of [b,c]) await p.evaluate(()=>{closeModal(); goHome(); setTab('duel'); rmBack();});
const E=await mk('E','다섯째E');
const code2=await b.evaluate(()=>RM.cur.id);
await a.evaluate(id=>rmJoin(id,{invited:true}),code2); await d.evaluate(id=>rmJoin(id,{invited:true}),code2); await E.pg.evaluate(id=>rmJoin(id,{invited:true}),code2);
ok(await until(b,()=>RM.cur.ord.length===5,null,10000), '5/5 꽉 참');
await a.evaluate(()=>rmReady(true)); await w(800);
await E.pg.evaluate(()=>rmOpen()); await w(600); await shot(E.pg,'room-5.png');
const fullErr=await (await mk('F','여섯째F')).pg.evaluate(id=>new Promise(res=>rmJoin(id,{invited:true,onErr:res})),code2).catch(e=>String(e));
ok(/꽉 찼어요/.test(fullErr), '꽉 찬 방에 코드로 들어가면 → '+fullErr);
await b.evaluate(()=>{closeModal(); rmPillRender();}); await w(300); await shot(b,'room-pill.png');
const errs=[A,Bp,C,Dp,E].flatMap(x=>x.errs); ok(!errs.length, '오류 없음 '+errs.join(' | '));
await br.close(); srv.close();
console.log(fail?`실패 ${fail}개`:'대전 방 점검 모두 통과'); process.exit(fail?1:0);
