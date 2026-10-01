/* 여우 자리 찾기: 화면·조작·솔로 난이도 */
function fxStamp(){
  const bd = $('#bd'); if(!bd) return;
  const d = document.createElement('div'); d.className = 'fxstamp'; d.textContent = '완성!'; bd.appendChild(d);
  setTimeout(() => { sfx('fStamp'); const p = fxCenter(d); fxRing(p.x, p.y, '#FF5C8A', p.w * .9, .6, 10); }, 330);
}

function foxStage(st){
  st.innerHTML = `<div class="fxg" id="fxg">
    <div class="fx-stats">
      <div class="fx-lives" id="fxLives" role="img" aria-label="남은 기회"></div>
      <div class="fx-st"><small>여우</small><b id="fxCnt" class="num">0/${G.total || G.N}</b></div>
      <div class="fx-st"><small>시간</small><b id="sclock" class="num">00:00</b></div>
      <div class="fx-st"><small>점수</small><b id="fxScore" class="num">0</b></div>
    </div>${foxRuleChips()}
    <div class="fx-card" id="fxCard"><div class="fx-board" id="bd" role="grid" aria-label="여우 자리 찾기 판"><div class="fx-wait">문제를 만드는 중…</div></div></div>
    <div class="fx-tools">
      <button class="fx-tool hint" id="fxHint" aria-label="힌트"><span class="ico" aria-hidden="true">${FX_ICON.bulb}</span><span>힌트 <b id="fxHintN">${itemN('foxHint')}</b></span></button>
      <button class="fx-tool auto" id="fxAuto" aria-label="자동 ✕"><span class="ico" aria-hidden="true">${FX_ICON.auto}</span><span>자동 ✕ <b id="fxAutoN">${itemN('foxAuto')}</b></span></button>
      <button class="fx-tool undo" id="fxUndo" aria-label="되돌리기"><span class="ico" aria-hidden="true">${FX_ICON.undo}</span><span>되돌리기</span></button>
    </div>
    <p class="fx-tip">한 번 누르면 ✕, 한 번 더 누르면 여우. 끌면 ✕를 여러 칸에 칠해요.</p>
  </div>`;
  $('#fxHint').onclick = foxHint; $('#fxAuto').onclick = foxAuto; $('#fxUndo').onclick = foxUndo;
  foxLives();
  if(!G.reg){
    const me = G;
    setTimeout(() => {
      if(G !== me || me.over) return;
      const p = me.fx ? foxAdvBoard(me.rng, me.fx) : genFox(me.rng, me.N);
      Object.assign(me, p, { cells:new Array(me.N*me.N).fill(0), placed:0, earned:0, hints:FOX_ITEM_PER_GAME, autos:FOX_ITEM_PER_GAME, hist:[], hintUsed:0, colors:shuffle(FOX_PAL.slice(0, me.N), me.rng) });
      if(me.fx) foxAdvReady(me);
      if(!me.duel){ me.start = Date.now(); me.pausedMs = 0; }
      foxBuild(true);
    }, 30);
  } else foxBuild(false);
}
function foxBuild(intro){
  const N = G.N, bd = $('#bd'); if(!bd) return;
  bd.innerHTML = ''; bd.style.setProperty('--n', N);
  const mid = (N - 1) / 2;
  for(let i=0;i<N*N;i++){
    const r = Math.floor(i/N), c = i%N, el = document.createElement('div');
    el.className = 'fxc' + (intro ? ' in' : ''); el.dataset.i = i;
    if(fxBlk(i)){ el.classList.add(G.rock[i] ? 'rock' : 'clue'); el.innerHTML = foxBlkHtml(i); }
    if(!(G.rock && G.rock[i])) el.style.background = G.colors[G.reg[i]];
    if(intro) el.style.animationDelay = Math.round((Math.abs(r - mid) + Math.abs(c - mid)) * 34) + 'ms';   /* 가운데에서 바깥으로 퍼지며 나타남 */
    el.setAttribute('role', 'gridcell'); if(fxBlk(i)) el.setAttribute('aria-label', G.rock[i] ? '바위' : '숫자 ' + G.clue[i]);
    bd.appendChild(el);
  }
  foxPaint();
  let down = null, drag = false, paintTo = 0, touched = null;
  const cellAt = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.closest ? t.closest('.fxc') : null; };
  const apply = i => { if(touched.has(i) || fxBlk(i)) return; touched.add(i); const s = G.cells[i]; if(paintTo === 1 && G.xMax && s === 0 && fxXCount() >= G.xMax) return; if(paintTo === 1 && s === 0) G.cells[i] = 1; else if(paintTo === 0 && s === 1) G.cells[i] = 0; else return; foxPaint(i); sfx(paintTo ? 'fPaint' : 'fErase'); };
  bd.onpointerdown = e => {
    if(G.over || G.paused || G.done) return;
    const el = cellAt(e); if(!el) return;
    e.preventDefault(); try{ bd.setPointerCapture(e.pointerId); }catch(_){}
    down = +el.dataset.i; drag = false; touched = new Set(); if(fxBlk(down)){ down = null; return; }
    paintTo = G.cells[down] === 0 ? 1 : 0;
  };
  bd.onpointermove = e => {
    if(down == null) return;
    const el = cellAt(e); if(!el) return; const i = +el.dataset.i;
    if(!drag && i !== down){ drag = true; G.hist.push(G.cells.slice()); apply(down); }
    if(drag) apply(i);
  };
  bd.onpointerup = () => {
    if(down == null) return;
    const i = down; down = null;
    if(!drag) foxTap(i);
  };
  bd.onpointercancel = () => { down = null; };
  bd.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
}
/* 기회 별 3개: 틀리면 하나씩 꺼지고, 마지막 하나는 두근거리며 판 카드가 붉게 빛남 */
function foxLives(){
  const el = $('#fxLives'); if(!el) return;
  const prev = +(el.dataset.n || 3);
  el.innerHTML = [...Array(G.pawMax || 3).keys()].map(k => `<span class="fx-star${k >= G.paws ? ' off' + (k === G.paws && G.paws < prev ? ' lost' : '') : ''}">${FX_ICON.star}</span>`).join('');
  el.dataset.n = G.paws; el.setAttribute('aria-label', '남은 기회 ' + G.paws + '번');
  if(G.paws === 1){ const last = el.querySelector('.fx-star:not(.off)'); if(last) last.classList.add('last'); }
  const card = $('#fxCard');
  if(card){ card.classList.toggle('danger', G.paws === 1); const tag = card.querySelector('.fxlast'); if(G.paws === 1 && !tag){ const t = document.createElement('div'); t.className = 'fxlast'; t.textContent = '마지막 기회!'; card.appendChild(t); } else if(G.paws !== 1 && tag) tag.remove(); }
}
function foxCount(bump){
  const el = $('#fxCnt'); if(!el) return;
  el.textContent = (G.placed || 0) + '/' + (G.total || G.N);
  if(bump){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function foxPaint(only){
  const list = only != null ? [only] : [...Array(G.N*G.N).keys()];
  for(const i of list){
    const el = document.querySelector(`#bd .fxc[data-i="${i}"]`); if(!el) continue;
    if(fxBlk(i)) continue;
    const s = G.cells[i];
    el.innerHTML = s === 1 ? FX_X('rgba(42,22,80,.55)') : s === 2 ? FOX_FACE : s === 4 ? FX_X('#D6243A') : '';
    el.classList.toggle('fox', s === 2);
    el.setAttribute('aria-label', s === 2 ? '여우' : s === 1 ? '✕ 표시' : s === 4 ? '틀린 자리' : '빈 칸');
  }
  const sc = $('#fxScore'); if(sc) sc.textContent = fmt(Math.round(G.earned * G.L.mult));
  foxCount(false);
  if(G.clue) for(let i=0;i<G.N*G.N;i++) if(G.clue[i] >= 0 && (only == null || Math.abs(Math.floor(i/G.N) - Math.floor(only/G.N)) <= 1 && Math.abs(i%G.N - only%G.N) <= 1)) foxClueState(i);
  foxXLeft();
  const h = $('#fxHintN'), a = $('#fxAutoN');
  const tool = (el, n, left, name) => { if(!el) return; const b = el.closest('button'); el.textContent = left ? n : '✓';
    if(G.bare){ el.textContent = '—'; b.disabled = true; b.setAttribute('aria-label', name + ', 맨손 변주라 이번 판은 못 써요'); return; }
    b.disabled = !left || G.done; b.classList.toggle('empty', left && !n);
    b.setAttribute('aria-label', left ? `${name}, 가진 개수 ${n}개 · 이 판에서 1번 쓸 수 있어요` : `${name}, 이번 판에서 이미 썼어요`); };
  tool(h, itemN('foxHint'), G.hints, '힌트'); tool(a, itemN('foxAuto'), G.autos, '자동 ✕');
  const u = $('#fxUndo'); if(u) u.disabled = !G.hist || !G.hist.length;
}
function foxCanPlace(i){
  if(G.solSet) return G.solSet.has(i) && G.cells[i] !== 2;   /* 솔로(난이도 v2): 정답 칸 모음 */
  const N = G.N, r = Math.floor(i/N), c = i%N, fixed = new Array(N).fill(-1);
  for(let j=0;j<N*N;j++) if(G.cells[j] === 2) fixed[Math.floor(j/N)] = j%N;
  if(fixed[r] !== -1) return false;
  return G.sol[r] === c;   /* 답이 하나뿐인 판이라 정답 자리만 맞음 */
}
function foxTap(i){
  if(G.over || G.paused || !G.reg || G.done || fxBlk(i)) return;
  const s = G.cells[i];
  if(s === 0 && G.xMax && fxXCount() >= G.xMax){ toast('✕를 다 썼어요 · 필요 없는 ✕를 지우고 다시 써요', 'err'); return; }
  if(s === 0){ G.hist.push(G.cells.slice()); G.cells[i] = 1; foxPaint(i); fxSound('x'); fxBuzz(6); return; }
  if(s !== 1) return;
  const el = document.querySelector(`#bd .fxc[data-i="${i}"]`);
  if(foxCanPlace(i)){
    foxPlace(i, true);
  } else {
    foxWrong(i);
  }
}
function foxPlace(i, earn){
  const tot = G.total || G.N;
  G.cells[i] = 2; G.placed++; if(earn) G.earned += fxPer();
  G.hist = G.hist.map(h => { h = h.slice(); h[i] = 2; return h; });   /* 되돌리기로 여우가 사라지지 않게 */
  foxPaint(i);
  foxCelebrate(i, earn);
  if(G.placed === tot){
    G.done = true;
    setTimeout(() => {
      document.querySelectorAll('#bd .fxc.fox').forEach((e, k) => { e.style.animationDelay = k * 70 + 'ms'; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('dance'); });
      fxStamp(); fxConfetti(); fxSound('win'); fxBuzz([30, 60, 30, 60, 80]);
    }, 450);
    const me = G; setTimeout(() => { if(G === me) finish(true); }, 1500 + G.N * 70);
  }
}
/* 맞힘 연출: 충격파 + 구역색 조각 + 구역 물결 + 여우 수 칸으로 날아가기 + 점수 떠오름 + 연속 배지 */
function foxCelebrate(i, earn){
  const N = G.N, el = document.querySelector(`#bd .fxc[data-i="${i}"]`); if(!el) return;
  const g = G.reg[i], col = G.colors[g], p = fxCenter(el);
  G.combo = earn ? (G.combo || 0) + 1 : 0;
  const lv = Math.max(0, G.combo - 1);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  fxRing(p.x, p.y, '#fff', p.w * (1.6 + lv * .25), .5, 10); fxRing(p.x, p.y, col, p.w * (2.3 + lv * .3), .7, 6);
  fxBurst(p.x, p.y, [col, '#FFD23F', '#fff', '#FF8A3D'], 14 + lv * 6, { speed:240 + lv * 40, size:5 + lv * .6, kinds:['star','dot','star','rect'] });
  const r0 = Math.floor(i/N), c0 = i%N;
  document.querySelectorAll('#bd .fxc').forEach(e => {
    const j = +e.dataset.i; if(G.reg[j] !== g || j === i) return;
    const d = Math.abs(Math.floor(j/N) - r0) + Math.abs(j%N - c0);
    e.classList.remove('glow'); void e.offsetWidth; e.style.animationDelay = d * 45 + 'ms'; e.classList.add('glow');
  });
  const cnt = $('#fxCnt');
  fxFly(el, cnt, FOX_FACE, () => { foxCount(true); if(cnt && cnt.isConnected){ sfx('fLand'); const q = fxCenter(cnt); fxBurst(q.x, q.y, [col, '#FFD23F'], 8, { speed:140, size:3.5, up:40 }); } });
  if(earn){
    const pts = Math.round(fxPer() * G.L.mult);
    fxFloat(p.x, p.y - p.h * .4, '+' + pts);
    const sc = $('#fxScore'); if(sc){ sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
    if(G.combo >= 2) fxCombo(G.combo);
    sfx('fOk', { n:lv, pan:panX(p.x) }); fxBuzz(G.combo >= 3 ? [15, 30, 15, 30, 25] : [15, 30, 20]);
  } else { fxFloat(p.x, p.y - p.h * .4, '힌트'); sfx('fHint', { pan:panX(p.x) }); fxBuzz(15); fxBurst(p.x, p.y, ['#FFE27A','#FFFFFF','#9C7BD8'], 14, { speed:160, size:4, kinds:['spark','star'], glow:true, up:120, g:200 }); }
}
/* 틀림 연출: 주황 ✕ 내려찍기 + 판 흔들림 + 붉은 가장자리 + 기회 별 떨어짐 + 틀린 이유 말풍선 */
function foxWrong(i){
  const why = G.solSet ? foxWhyAdv(i) : foxWhy(i);
  G.cells[i] = 4; foxPaint(i); G.combo = 0;
  const el = document.querySelector(`#bd .fxc[data-i="${i}"]`);
  el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
  const p = fxCenter(el);
  fxRing(p.x, p.y, '#FF3B30', p.w * 1.9, .45, 8);
  fxBurst(p.x, p.y, ['#FF6A2B', '#2A1650', '#FF3B30'], 10, { speed:200, size:4, kinds:['rect','dot'], g:900, up:20 });
  if(!FXR.reduce){ const b = $('#bd'); b.classList.remove('shake2'); void b.offsetWidth; b.classList.add('shake2'); }
  fxVignette(); fxSound('bad'); fxBuzz([70, 40, 110]);
  if(why.f >= 0){ const fe = document.querySelector(`#bd .fxc[data-i="${why.f}"]`); if(fe){ fe.classList.remove('conflict'); void fe.offsetWidth; fe.classList.add('conflict'); } }
  fxBubble(el, why.text);
  const stars = document.querySelectorAll('#fxLives .fx-star'), lostEl = stars[G.paws - 1];
  if(lostEl && !FXR.reduce){
    const q = fxCenter(lostEl), d = document.createElement('div'); d.className = 'fx-lost'; d.innerHTML = FX_ICON.star;
    d.style.left = (q.x - 13) + 'px'; d.style.top = (q.y - 13) + 'px'; document.body.appendChild(d);
    d.animate([{ transform:'translate(0,0) rotate(0)', opacity:1 }, { transform:'translate(-10px,-30px) rotate(-40deg) scale(1.3)', opacity:1, offset:.25 }, { transform:'translate(30px,160px) rotate(220deg) scale(.6)', opacity:0 }], { duration:900, easing:'cubic-bezier(.3,0,.7,1)' }).onfinish = () => d.remove();
  }
  G.paws--; foxLives();
  if(G.fx && G.fx.tw === 'crumble' && G.paws > 0) foxCrumble();
  const pill = $('#fxLives'); if(pill){ pill.classList.remove('hurt'); void pill.offsetWidth; pill.classList.add('hurt'); }
  fxFloat(p.x, p.y - p.h * .4, '−1', 'bad');
  if(G.paws <= 0){ const me = G; setTimeout(() => { if(G === me) finish(false); }, 900); }
}
function foxHint(){
  if(G.over || G.paused || !G.reg || G.hints < 1 || G.done) return;
  if(itemN('foxHint') < 1){ toast('힌트가 없어요 · 챕터·레벨업 보상으로 받아요', 'err'); return; }
  if(G.solSet){   /* 솔로: 아직 못 찾은 정답 칸 중 가장 작은 구역 */
    const size = g => G.reg.filter(x => x === g).length, left = G.sol.filter(i => G.cells[i] !== 2).sort((a, b) => size(G.reg[a]) - size(G.reg[b]));
    if(!left.length) return;
    itemUse('foxHint'); G.hints--; G.hintUsed++; foxPlace(left[0], false); return;
  }
  const N = G.N, has = new Set(); for(let i=0;i<N*N;i++) if(G.cells[i] === 2) has.add(G.reg[i]);
  /* 가장 작은 구역(스스로 찾기 쉬운 곳 대신 막힌 곳 위주로)에서 정답 한 칸을 알려줌 */
  const size = g => G.reg.filter(x => x === g).length;
  const rows = [...Array(N).keys()].filter(r => !has.has(G.reg[r*N + G.sol[r]])).sort((a, b) => size(G.reg[a*N + G.sol[a]]) - size(G.reg[b*N + G.sol[b]]));
  if(!rows.length) return;
  itemUse('foxHint'); G.hints--; G.hintUsed++; foxPlace(rows[0]*N + G.sol[rows[0]], false);
}
function foxAuto(){   /* 놓은 여우 때문에 여우가 올 수 없는 칸에 ✕ */
  if(G.over || G.paused || !G.reg || G.autos < 1 || G.done) return;
  if(itemN('foxAuto') < 1){ toast('자동 ✕가 없어요 · 5게임 완주·챕터 보상으로 받아요', 'err'); return; }
  const N = G.N, foxes = []; for(let i=0;i<N*N;i++) if(G.cells[i] === 2) foxes.push(i);
  if(!foxes.length){ toast('여우를 먼저 1마리 놓아 보세요', 'err'); return; }
  G.hist.push(G.cells.slice()); let n = 0; const marked = [];
  if(G.solSet){ foxAutoAdv().forEach(j => { G.cells[j] = 1; n++; marked.push(j); }); }
  else for(let j=0;j<N*N;j++){
    if(G.cells[j] !== 0) continue;
    const rr = Math.floor(j/N), cc = j%N;
    if(foxes.some(f => { const r = Math.floor(f/N), c = f%N; return rr === r || cc === c || G.reg[j] === G.reg[f] || (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1); })){ G.cells[j] = 1; n++; marked.push(j); }
  }
  if(!n){ G.hist.pop(); toast('더 칠할 칸이 없어요', 'err'); return; }
  itemUse('foxAuto'); G.autos--; foxPaint();
  /* 효과: ✕가 가까운 칸부터 차례로 찍히며 쓸어가는 소리 */
  const f0 = foxes[foxes.length - 1];
  marked.sort((a, b) => (Math.abs(Math.floor(a/N) - Math.floor(f0/N)) + Math.abs(a%N - f0%N)) - (Math.abs(Math.floor(b/N) - Math.floor(f0/N)) + Math.abs(b%N - f0%N)));
  marked.forEach((j, k) => { const e = document.querySelector(`#bd .fxc[data-i="${j}"]`); if(!e) return; e.style.setProperty('--xd', Math.min(600, k * 14) + 'ms'); e.classList.remove('xin'); void e.offsetWidth; e.classList.add('xin'); setTimeout(() => e.classList.remove('xin'), 1100); });
  sfx('fAuto'); fxBuzz(20);
}
function foxUndo(){
  if(G.over || G.paused || !G.hist || !G.hist.length) return;
  G.cells = G.hist.pop(); foxPaint(); sfx('fUndo');
}
/* ===== 여우 자리 찾기 · 솔로 난이도 v2: 5판마다 새 개념(planOf('fox', n)) =====
   새 규칙: 11 바위 칸 · 21 여우 굴 숫자 · 31 쌍둥이 여우 · 41 가늘고 긴 구역 (51부터 둘씩 리믹스)
   변주: 6 번개 · 16 와르르 · 26 외줄 타기 · 36 ✕ 아껴 쓰기 · 46 맨손 (이후 반복)
   모두 장르 공통 규칙(막힌 칸, 둘레 숫자, 2마리 변형)만 쓴다(결정 135). 오늘의 문제·대전은 그대로. */
CONCEPTS.fox = {
  order:['rock', 'clue', 'twin', 'thin'],
  info:{
    rock:{ name:'바위 칸', desc:'바위에는 여우가 들어갈 수 없어요. 색 구역도 바위를 피해 구불구불 이어져요.' },
    clue:{ name:'여우 굴 숫자', desc:'숫자는 그 칸을 둘러싼 8칸에 있는 여우 수예요. 숫자 칸에는 여우가 없어요.' },
    twin:{ name:'쌍둥이 여우', desc:'가로줄·세로줄·색 구역마다 여우가 2마리씩이에요. 여우끼리 붙으면 안 되는 건 그대로예요.' },
    thin:{ name:'가늘고 긴 구역', desc:'색 구역이 뱀처럼 가늘고 길게 이어져요. 여러 줄에 걸친 구역을 잘 살펴요.' }
  },
  twists:['flash', 'crumble', 'tight', 'fewx', 'bare'],
  twInfo:{
    flash:{ name:'번개', desc:'시간 보너스가 훨씬 빨리 줄어요. 빠르고 정확하게!' },
    crumble:{ name:'와르르', desc:'틀리면 칠해 둔 ✕가 모두 지워져요. 확실할 때만 여우를 놓아요.' },
    tight:{ name:'외줄 타기', desc:'기회 별이 2개뿐이에요. 실수는 딱 한 번까지만 괜찮아요.' },
    fewx:{ name:'✕ 아껴 쓰기', desc:'✕는 한 번에 정해진 개수까지만 칠할 수 있어요. 필요 없는 ✕는 지우고 다시 써요.' },
    bare:{ name:'맨손', desc:'힌트와 자동 ✕ 없이 오직 실력으로 풀어요.' }
  }
};
const FOX_LIM = { 5:90, 6:120, 7:150, 8:180, 9:300, 10:480 };
/* 난이도 목표(풀이 점수 fxxRate 기준). 챕터 기준값 × 자리 배율 → 톱니 모양: 1·6·9 쉬움, 5 어려움, 10 보스 */
const FOX_KMUL = { 1:0.5, 2:0.8, 3:0.9, 4:1.1, 5:1.6, 6:0.45, 7:1, 8:1.15, 9:0.55, 10:2.2 };
const FOX_CBASE = [0, 6, 12, 15, 32, 20];   /* 챕터 1~5. 리믹스(6~)는 30부터 조금씩 */
function foxTarget(n){ const p = planOf('fox', n); return (p.c <= 5 ? FOX_CBASE[p.c] : Math.min(44, 28 + 2 * (p.c - 5))) * FOX_KMUL[p.k]; }
/* 스테이지 n의 판 설정: 판 크기·규칙 재료를 정하고, 후보 판 몇 개를 풀어 보고 목표 난이도에 가장 가까운 판을 쓴다 */
function foxStageCfg(n){
  const p = planOf('fox', n), on = key => p.mj.includes(key), k = p.k, c = Math.min(p.c, 9);
  const N = p.c === 1 ? [5, 5, 5, 6, 6, 5, 6, 6, 5, 7][k - 1] : [0, 0, 7, 7, 8, 8, 8, 9, 9, 9][c] + ({ 1:-1, 5:1, 6:-1, 9:-1, 10:2 }[k] || 0);
  const x = { N, k:1, target:foxTarget(n), sel:p.easy ? 'min' : p.hard || p.boss ? 'max' : 'near', tw:p.tw, mj:p.mj.slice() };
  /* 쌍둥이: 8×8(보스 9×9, 챕터 10부터 보스 10×10). 쌍둥이는 판 자체가 훨씬 어려워서 쉬운 자리는 여우 2마리, 보통·보스 자리는 1마리를 미리 놓아 줌(어려움은 0). 쌍둥이+숫자는 9×9 이상 — 8×8 쌍둥이는 구역만으로 답이 거의 하나로 정해져 숫자가 쓸모없어짐 */
  if(on('twin')){ x.k = 2; x.N = 8 + (p.boss ? 1 : 0) + (p.boss && p.c >= 10 ? 1 : 0); if(on('clue')) x.N = Math.max(9, x.N); if(!p.easy) x.sel = 'near'; x.gift = p.easy ? 2 : p.hard ? 0 : 1; }   /* 쌍둥이는 판 자체가 어려워 '가장 어려운 판' 대신 목표에 가까운 판 */
  if(on('rock')){ if(!on('twin') && k !== 1) x.N = Math.min(p.boss ? 10 : 9, x.N + 1); x.rocks = Math.round(x.N * 0.6); }   /* 바위는 칸 수를 줄이니 판을 1 키움 */
  /* 숫자 전에 남겨 둘 답 수: 많을수록 숫자가 많이 필요(= 정보가 많아 쉬움). 쉬운 판은 숫자 넉넉히, 어려운 판은 꼭 필요한 만큼만 */
  if(on('clue')){ x.clue = 1; x.clueMin = x.k === 2 ? (p.boss ? 2 : 3) : p.easy ? 5 : p.boss || p.hard ? 2 : 4; x.clueT = x.clueMin + 3; }
  if(on('thin')){ x.thin = 1; if(x.k === 1) x.N = Math.min(9, x.N); if(p.hard) x.sel = 'near'; }   /* 긴 구역 10×10은 만들기가 너무 느리고, 9×9만으로도 충분히 어려움 */
  x.N = Math.min(10, x.N);
  x.cand = x.N >= 10 || (x.N === 9 && (x.k === 2 || x.thin)) ? 2 : x.N === 9 ? 3 : x.k === 2 ? 4 : p.boss ? 4 : 3;   /* 후보 판 수(큰 판은 만들기가 느려서 적게) */
  const lim = FOX_LIM[x.N] * (x.k === 2 ? 1.6 : 1) * (p.tw === 'flash' ? 0.6 : 1);
  x.limit = Math.round(lim / 10) * 10;
  return x;
}
function foxAdvBoard(rng, x){
  let best = null, bd = 0;
  const far = s => Math.abs(Math.log((s + 3) / (x.target + 3)));
  for(let t=0; t<x.cand; t++){
    const P = fxxGen(rng, x) || fxxGen(rng, { N:x.N, k:x.k, rocks:x.rocks, clue:x.clue, clueMin:x.clueMin, clueT:x.clueT }) || fxxGen(rng, Object.assign({}, x, { clueMin:2, clueT:3 }));   /* 예비: 긴 구역·바위 빼기, 숫자 전 답 수 줄이기 */
    if(!P) continue;
    if(x.gift){   /* 미리 놓아 주는 여우: 가장 큰 구역부터 하나씩(찾기 어려운 곳) */
      const sz = g => P.reg.filter(v => v === g).length, seen = new Set();
      P.given = P.sol.slice().sort((a, b) => sz(P.reg[b]) - sz(P.reg[a])).filter(i => !seen.has(P.reg[i]) && seen.add(P.reg[i])).slice(0, x.gift);
    }
    P.score = fxxRate(P).score;
    let d = x.sel === 'min' ? P.score / (x.target + 3) : x.sel === 'max' ? -P.score / (x.target + 3) : far(P.score);   /* 쉬움은 가장 쉬운 판, 어려움·보스는 가장 어려운 판, 나머지는 목표에 가까운 판 */
    if(x.thin){ let bl = 0; const N = P.N; for(let r=0;r<N-1;r++) for(let c=0;c<N-1;c++){ const g = P.reg[r*N+c]; if(g >= 0 && P.reg[r*N+c+1] === g && P.reg[(r+1)*N+c] === g && P.reg[(r+1)*N+c+1] === g) bl++; }
      d += bl * 0.12; }   /* 긴 구역은 2×2 덩어리가 적은 판을 조금 우대(규칙이 눈에 보이게. 너무 가늘면 급격히 어려워져서 약하게) */
    if(!best || d < bd){ best = P; bd = d; }
  }
  if(best) return best;
  const q = genFox(rng, x.N), NN = x.N * x.N;   /* 마지막 예비: 기본 판 */
  return { N:x.N, k:1, reg:q.reg, blk:new Uint8Array(NN), rock:new Uint8Array(NN), clue:new Int8Array(NN).fill(-1), sol:q.sol.map((c, r) => r * x.N + c), score:-1 };
}
/* 판이 준비되면: 정답 칸 모음, 전체 여우 수, 변주(외줄 타기·맨손·✕ 아껴 쓰기) */
function foxAdvReady(me){
  me.solSet = new Set(me.sol); me.total = me.N * me.k;
  (me.given || []).forEach(i => { me.cells[i] = 2; me.placed++; });
  me.xMax = me.fx.tw === 'fewx' ? Math.round(me.N * me.N * 0.4) : 0;
  if(me.fx.tw === 'bare'){ me.hints = 0; me.autos = 0; me.bare = true; }
}
function foxAdvInit(){
  G.fx = G.L.fox; G.k = G.fx.k; G.total = G.N * G.k;
  if(G.fx.tw === 'tight'){ G.paws = 2; G.pawMax = 2; }
}
const fxBlk = i => !!(G.blk && G.blk[i]);
const fxPer = () => 500 / ((G.total || G.N) - (G.given ? G.given.length : 0));   /* 여우 1마리 점수(미리 놓인 여우 빼고 500점을 나눔) */
const fxXCount = () => G.cells.reduce((a, s) => a + (s === 1), 0);
function foxRuleChips(){
  if(!G.fx) return '';
  const nm = key => (conceptInfo('fox', key) || {}).name || key;
  const chips = G.fx.mj.map(m => `<span class="fx-rule">${nm(m)}${m === 'twin' ? ' · 2마리씩' : ''}</span>`);
  if(G.fx.tw) chips.push(`<span class="fx-rule tw">${nm(G.fx.tw)}${G.fx.tw === 'fewx' ? ` · 남은 <b id="fxXLeft" class="num"></b>` : ''}</span>`);
  return chips.length ? `<div class="fx-rules" aria-label="이번 판 규칙">${chips.join('')}</div>` : '';
}
function foxXLeft(){ const el = $('#fxXLeft'); if(el && G.xMax) el.textContent = Math.max(0, G.xMax - fxXCount()) + '개'; }
/* 도움말: 이번 판에 켜진 규칙·변주 설명을 덧붙임 */
function foxHelpExtra(){
  if(!(G && G.id === 'fox' && G.fx && !G.over)) return [];
  return G.fx.mj.concat(G.fx.tw ? [G.fx.tw] : []).map(key => { const f = conceptInfo('fox', key) || {}; return [(G.fx.mj.includes(key) ? '새 규칙 · ' : '변주 · ') + f.name, f.desc]; });
}
const FX_ROCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 18.2l2.1-6.6 4.4-4.1 5.3 1.1 4.1 4.8.7 4.8-3 1.8H6.4z" fill="#A9A2BE" stroke="#2A1650" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.6 12.2l2.8-2.6 3.2.7" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12.4 15.6l3.3-1.4" stroke="#2A1650" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/></svg>`;
function foxBlkHtml(i){ return G.rock && G.rock[i] ? FX_ROCK : `<span class="fxnum">${G.clue[i]}</span>`; }
/* 숫자 칸: 둘레 여우 수가 숫자와 같고 나머지 둘레 칸도 ✕로 정리되면 초록으로 */
function foxClueState(i){
  if(!(G.clue && G.clue[i] >= 0)) return;
  const el = document.querySelector(`#bd .fxc[data-i="${i}"]`); if(!el) return;
  const N = G.N, r = Math.floor(i/N), c = i%N; let n = 0, open = 0;
  for(let rr=Math.max(0,r-1); rr<=Math.min(N-1,r+1); rr++) for(let cc=Math.max(0,c-1); cc<=Math.min(N-1,c+1); cc++){ const j = rr*N+cc; if(G.cells[j] === 2) n++; else if(!G.cells[j] && !fxBlk(j)) open++; }
  el.classList.toggle('ok', n === G.clue[i] && !open);   /* 여우 수가 맞고 둘레 빈칸도 다 정리되면 */
}
function foxWhyAdv(i){
  const N = G.N, k = G.k, r = Math.floor(i/N), c = i%N;
  for(let f=0; f<N*N; f++){ if(G.cells[f] !== 2) continue; if(Math.abs(Math.floor(f/N) - r) <= 1 && Math.abs(f%N - c) <= 1) return { f, text:'옆 여우와 붙어 있어요' }; }
  const cnt = test => { let n = 0, f0 = -1; for(let f=0; f<N*N; f++) if(G.cells[f] === 2 && test(f)){ n++; f0 = f; } return [n, f0]; };
  const two = k === 2 ? '에 여우가 벌써 2마리예요' : '에 여우가 있어요';
  let q = cnt(f => Math.floor(f/N) === r); if(q[0] >= k) return { f:q[1], text:'같은 가로줄' + two };
  q = cnt(f => f%N === c); if(q[0] >= k) return { f:q[1], text:'같은 세로줄' + two };
  q = cnt(f => G.reg[f] === G.reg[i]); if(q[0] >= k) return { f:q[1], text:'같은 색 구역' + two };
  for(let rr=Math.max(0,r-1); rr<=Math.min(N-1,r+1); rr++) for(let cc=Math.max(0,c-1); cc<=Math.min(N-1,c+1); cc++){
    const j = rr*N+cc; if(!(G.clue[j] >= 0)) continue;
    const jr = rr, jc = cc; let n = 0;
    for(let a=Math.max(0,jr-1); a<=Math.min(N-1,jr+1); a++) for(let b=Math.max(0,jc-1); b<=Math.min(N-1,jc+1); b++) if(G.cells[a*N+b] === 2) n++;
    if(n >= G.clue[j]) return { f:j, text:'숫자 ' + G.clue[j] + '보다 여우가 많아져요' };
  }
  return { f:-1, text:'여기는 여우 자리가 아니에요' };
}
/* 와르르: 틀리면 칠해 둔 ✕가 모두 사라짐 */
function foxCrumble(){
  const gone = []; G.cells.forEach((s, i) => { if(s === 1){ G.cells[i] = 0; gone.push(i); } });
  G.hist = [];
  if(!gone.length) return;
  gone.forEach(i => { const e = document.querySelector(`#bd .fxc[data-i="${i}"]`); if(e){ e.classList.remove('crumble'); void e.offsetWidth; e.classList.add('crumble'); } });
  setTimeout(() => { if(G && G.id === 'fox') foxPaint(); }, 260);
  setTimeout(() => toast('와르르! 칠해 둔 ✕가 모두 지워졌어요'), 700);
}
function foxAutoAdv(){
  const N = G.N, k = G.k, foxes = []; for(let i=0;i<N*N;i++) if(G.cells[i] === 2) foxes.push(i);
  const rc = new Array(N).fill(0), cc = new Array(N).fill(0), gc = new Array(N).fill(0);
  foxes.forEach(f => { rc[Math.floor(f/N)]++; cc[f%N]++; gc[G.reg[f]]++; });
  const clueFull = j => { const r = Math.floor(j/N), c = j%N; let n = 0; for(let a=Math.max(0,r-1); a<=Math.min(N-1,r+1); a++) for(let b=Math.max(0,c-1); b<=Math.min(N-1,c+1); b++) if(G.cells[a*N+b] === 2) n++; return n >= G.clue[j]; };
  const marked = [];
  for(let j=0;j<N*N;j++){
    if(G.cells[j] !== 0 || fxBlk(j)) continue;
    if(G.xMax && fxXCount() + marked.length >= G.xMax) break;
    const r = Math.floor(j/N), c = j%N; let hit = rc[r] >= k || cc[c] >= k || gc[G.reg[j]] >= k;
    for(let a=Math.max(0,r-1); a<=Math.min(N-1,r+1) && !hit; a++) for(let b=Math.max(0,c-1); b<=Math.min(N-1,c+1) && !hit; b++){ const t = a*N+b; if(G.cells[t] === 2 || (G.clue[t] >= 0 && clueFull(t))) hit = true; }
    if(hit) marked.push(j);
  }
  return marked;
}
