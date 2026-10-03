/* 별빛 구슬: 물리·화면·솔로 */
/* ---------- 별빛 구슬: 밤하늘 젤리 블록을 구슬로 깨는 게임. 논리 좌표(칸 100) 기준 물리, 화면은 배율만 적용 ---------- */
/* 판 8열 × 10줄(맨 아래 줄은 발사 자리). 줄 0은 비워 두는 여유 줄, 새 줄은 줄 1로 들어옴 */
const BC = 8, BR = 10, BS = 100, BW = BC*BS, BFLOOR = BR*BS, BH = BFLOOR + 34, BRAD = 15, BSPD = 1400, BGAP = 0.06;
const BPAD = 6, BRR = 20, BBUMP = 41, BSTAR = 24;          /* 젤리 여백·모서리, 범퍼 반지름, 별 조각 반지름 */
const BSPARK_R = 10, BSPARK_V = 1100;                       /* 폭죽 불꽃 구슬 */
const BAIM_MIN = 0.14, BAIM_MAX = Math.PI - 0.14, BAIM_STEP = 1.5 * Math.PI / 180;
/* 체력 구간 5색(낮음 → 높음): [채움, 어두운 쪽, 밝은 쪽] */
const BPAL = [['#9CEBC6','#4FC193','#E2FFF1'], ['#A6D2FF','#5E9CF0','#E6F3FF'], ['#FFE38A','#F2B63C','#FFF7D6'], ['#FFBC96','#F2865A','#FFE8DA'], ['#F7A3D6','#D863AE','#FFE3F4']];
const BOUT = '#2A1650';
const BSP_AT = { clock:3, shield:7, paint:12, fire:18 };   /* 특수 블록이 처음 나오는 스테이지 */
const BSP_INFO = { clock:['시계','깨면 다음 턴에 블록이 안 내려와요'], shield:['방패','아래쪽 면은 막혀요. 옆·위로 돌려 맞혀요'], paint:['물감','깨면 같은 색 블록 체력이 25% 줄어요'], fire:['폭죽','깨면 불꽃 구슬 4개가 튀어요'] };

/* 솔로 스테이지 N 설정. 오늘의 문제는 LEVELS의 like(비슷한 스테이지)와 rows로 만든다 */
function ballStageCfg(n){
  const sp = Object.keys(BSP_AT).filter(k => n >= BSP_AT[k]);
  return { n, rows: Math.min(36, 7 + Math.floor(n * 0.45)),
    minN: Math.min(5, 3 + Math.floor(n / 24)), maxN: Math.min(6, 4 + Math.floor(n / 9)),
    hpMul: Math.min(1.5, 0.82 + n * 0.015), dbl: n >= 24 ? Math.min(0.12, (n - 20) * 0.005) : 0,
    bump: Math.min(0.2, 0.05 + (n - 1) * 0.0052), sp, intro: sp.find(k => BSP_AT[k] === n) || null,
    star2: Math.max(0, 0.34 - n * 0.02), start: n >= 45 ? 5 : n >= 22 ? 4 : 3, limit: 0 };
}
/* 별: ★ 클리어 · ★★ 기준 턴+6 이내 · ★★★ 기준 턴+3 이내 그리고 방어막을 지킴 */
function ballStars(turn, R, shieldOk){ return turn <= R + 3 && shieldOk ? 3 : turn <= R + 6 ? 2 : 1; }

function genBall(rng, cfg){
  if(cfg.like) cfg = Object.assign(ballStageCfg(cfg.like), { rows: cfg.rows, intro: null });
  const rows = [], sp = cfg.sp || []; let total = 0, top = 1;
  for(let k=0;k<cfg.rows;k++){
    const t = k + 1, cols = shuffle([...Array(BC).keys()], rng);
    const n = cfg.minN + Math.floor(rng()*(cfg.maxN - cfg.minN + 1));
    const row = new Array(BC).fill(null);
    for(let j=0;j<n;j++){
      let hp = Math.max(1, Math.round((t + 1) * cfg.hpMul * (0.7 + 0.6*rng())));
      if(rng() < cfg.dbl) hp *= 2;
      const bump = rng() < cfg.bump;
      let s = null;
      if(!bump && sp.length && t > 1 && rng() < 0.09) s = cfg.intro && rng() < 0.5 ? cfg.intro : sp[Math.floor(rng()*sp.length)];
      row[cols[j]] = { hp, t: bump ? 'bump' : 'sq', sp: s }; total++; top = Math.max(top, hp);
    }
    row[cols[n]] = { star:true };
    if(n + 1 < BC && rng() < cfg.star2) row[cols[n+1]] = { star:true };
    rows.push(row);
  }
  /* 새 특수 블록이 처음 나오는 스테이지는 앞쪽 줄에 적어도 1개 보장 */
  if(cfg.intro && !rows.some(r => r.some(c => c && c.sp === cfg.intro))){
    for(let k=1;k<rows.length;k++){ const c = rows[k].find(c => c && c.t === 'sq' && !c.sp); if(c){ c.sp = cfg.intro; break; } }
  }
  return { rows, R: cfg.rows, start: cfg.start, total, top, intro: cfg.intro };
}
function ballInit(p){
  Object.assign(G, { rows:p.rows, R:p.R, rowsN:p.R, total:p.total, hpTop:p.top, intro:p.intro, next:0, uid:0,
    gridB:Array.from({length:BR}, () => new Array(BC).fill(null)),
    balls:p.start || 3, gained:0, sx:BW/2, phase:'aim', turn:0, broken:0, fly:[], sparks:[], toLaunch:0, launchT:0, speed:1, boost:1,
    aim:null, aiming:false, lastAim:Math.PI/2, firstLand:null, shield:1, itemUsed:0, items:{ pierce:1, scope:1, lift:1 }, pierce:false, scope:false, pierceShot:false,
    freeze:false, won:false, slide:0, slideDir:1, fx:[], rings:[], txts:[], flash:0, flashC:'255,255,255', ffT:0, shake:0, turnHits:0, tickA:null,
    guide:null, gKey:'', gVer:0, raf:0, lt:0, shootT:0, banner:null });
  ballSpawn();
}
function ballCell(c){
  if(!c) return null;
  if(c.star) return { star:true, id:++G.uid, bob:Math.random()*6 };
  const band = Math.min(4, Math.floor((c.hp - 1) * 5 / Math.max(1, G.hpTop)));
  return { id:++G.uid, hp:c.hp, max:c.hp, t:c.t, sp:c.sp, band, hit:0, ping:0 };
}
function ballSpawn(){
  if(G.next >= G.rowsN) return false;
  G.gridB[1] = G.rows[G.next].map(ballCell); G.next++; G.gVer++;
  return true;
}
function ballBlocksLeft(){ for(const row of G.gridB) for(const c of row) if(c && c.hp > 0) return true; return false; }
const ballCleared = () => G.next >= G.rowsN && !ballBlocksLeft();
const ballRowHas = r => G.gridB[r].some(c => c && c.hp > 0);
/* 모든 줄을 위(d=-1) 또는 아래(d=1)로 한 칸 */
function ballShift(d){
  if(d > 0){ for(let r=BR-1;r>=1;r--) G.gridB[r] = G.gridB[r-1]; G.gridB[0] = new Array(BC).fill(null); }
  else { for(let r=0;r<BR-1;r++) G.gridB[r] = G.gridB[r+1]; G.gridB[BR-1] = new Array(BC).fill(null); }
  G.gVer++;
}

/* ---- 화면 ---- */
const BICO = {
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.6"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10v-6z" fill="currentColor" stroke="#2A1650" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.5l1.3 2.8 3 .4-2.2 2.1.6 3L12 13.3l-2.7 1.5.6-3-2.2-2.1 3-.4z" fill="#fff"/></svg>',
  pierce:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="11" height="7" rx="2" opacity=".55"/><rect x="9" y="13" width="11" height="7" rx="2" opacity=".55"/><path d="M2.5 21.5L20 4"/><circle cx="4.5" cy="19.5" r="2.4" fill="currentColor" stroke="none"/></svg>',
  scope:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14.5l13-7 2 3.8-13 7z"/><path d="M16 7.5l3.2-1.7 2 3.8-3.2 1.7"/><path d="M9 17l-2 4.5M11 16l2 5.5"/></svg>',
  lift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/><path d="M12 10V3M8.5 6.5L12 3l3.5 3.5"/></svg>',
  left:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 4.5v15a1 1 0 0 1-1.6.8l-9.4-7.5a1 1 0 0 1 0-1.6l9.4-7.5a1 1 0 0 1 1.6.8z"/></svg>',
  right:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 4.5v15a1 1 0 0 0 1.6.8l9.4-7.5a1 1 0 0 0 0-1.6L10.1 3.7a1 1 0 0 0-1.6.8z"/></svg>'
};
function ballHud(){
  if(!G || G.id !== 'ball') return;
  const s = (id, v) => { const e = $(id); if(e) e.textContent = v; };
  s('#bline', Math.max(0, G.rowsN - G.next)); s('#bscore', G.broken + '/' + G.total); s('#bballs', '×' + (G.balls + (G.phase === 'aim' ? 0 : G.gained)));
  const sh = $('#bShield'); if(sh){ sh.classList.toggle('off', !G.shield); sh.setAttribute('aria-label', G.shield ? '별빛 방어막 있음' : '별빛 방어막 깨짐'); }
  const fs = $('#bFast'); if(fs){ const v = Math.max(G.speed, G.phase === 'shoot' ? G.boost : 1); fs.querySelector('b').textContent = '×' + v; fs.classList.toggle('on', v > 1); }
  const aim = G.phase === 'aim' && !G.over && !G.slide && !G.won;
  const it = (id, key, dis) => { const b = $(id); if(!b) return; b.disabled = dis; b.classList.toggle('on', !!G[key]); b.querySelector('i').textContent = G.items[key] > 0 ? '×' + G.items[key] : '씀'; };
  it('#bIPierce', 'pierce', !aim || (G.items.pierce < 1 && !G.pierce));
  it('#bIScope', 'scope', !aim || (G.items.scope < 1 && !G.scope));
  it('#bILift', 'lift', !aim || G.items.lift < 1 || G.gridB[0].some(c => c));
  ['#bLeft', '#bRight', '#bGo'].forEach(q => { const b = $(q); if(b) b.disabled = !aim; });
  const go = $('#bGo'); if(go) go.lastChild.textContent = G.phase === 'shoot' ? '날아가는 중' : '발사';
  const dg = $('#sbRoot'); if(dg) dg.classList.toggle('danger', ballRowHas(BR-2));
}
function ballStage(st){
  st.innerHTML = `<div class="sb" id="sbRoot">
    <div class="sb-stat">
      <button class="sb-ib" id="bPause" aria-label="일시정지">${BICO.pause}</button>
      <span class="sb-p"><small>남은 줄</small><b id="bline">0</b></span>
      <span class="sb-p"><small>깬 블록</small><b id="bscore">0</b></span>
      <span class="sb-p"><small>구슬</small><b id="bballs">×0</b></span>
      <span class="sb-sh" id="bShield" role="img">${BICO.shield}</span>
      <button class="sb-ib sb-ff" id="bFast" aria-label="빠르게 보기">⏩<b>×1</b></button>
    </div>
    <div class="sb-board"><canvas class="sb-cv" id="bcv" aria-label="별빛 구슬 판"></canvas></div>
    <div class="bfoot">
      <div class="sb-items">
        <button class="sb-it c1" id="bIPierce" aria-label="관통 구슬: 이번 턴 구슬이 블록을 뚫고 지나가요">${BICO.pierce}<span>관통 구슬</span><i>×1</i></button>
        <button class="sb-it c2" id="bIScope" aria-label="망원경: 이번 턴 조준선이 두 번 튕긴 곳까지 보여요">${BICO.scope}<span>망원경</span><i>×1</i></button>
        <button class="sb-it c3" id="bILift" aria-label="밀어 올리기: 모든 블록을 한 줄 위로">${BICO.lift}<span>밀어 올리기</span><i>×1</i></button>
      </div>
      <div class="sb-aim">
        <button class="sb-arr" id="bLeft" aria-label="조준 왼쪽으로 조금">${BICO.left}</button>
        <button class="b1 sb-go" id="bGo">발사</button>
        <button class="sb-arr" id="bRight" aria-label="조준 오른쪽으로 조금">${BICO.right}</button>
      </div>
    </div></div>`;
  const cv = $('#bcv'); G.cv = cv; G.ctx = cv.getContext('2d');
  const size = () => {
    const box = cv.parentNode, full = box.clientWidth || 328, top = box.getBoundingClientRect().top + (window.scrollY || 0);
    const below = (st.querySelector('.bfoot').offsetHeight || 130) + 16;
    const availH = Math.max(300, window.innerHeight - top - below - 6);
    const w = Math.floor(Math.min(full, availH * BW / BH)), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = Math.round(w * BH / BW) + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * BH / BW * dpr); G.scale = cv.width / BW; G.bgKey = '';
  };
  size(); G.onResize = () => { if(G && G.cv === cv) size(); }; window.addEventListener('resize', G.onResize);
  const me = G; G.cleanup = () => { window.removeEventListener('resize', me.onResize); clearInterval(me.rep); };
  const toXY = e => { const rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) * BW / rc.width, (e.clientY - rc.top) * BH / rc.height]; };
  const canAim = () => !G.over && !G.paused && !G.won && G.phase === 'aim' && !G.slide;
  const setAim = e => {
    const [x, y] = toXY(e), dx = x - G.sx, dy = (BFLOOR - BRAD) - y;
    if(dy < 30){ G.aim = null; return; }
    G.aim = Math.max(BAIM_MIN, Math.min(BAIM_MAX, Math.atan2(dy, dx))); G.lastAim = G.aim; ballAimTick();
  };
  cv.onpointerdown = e => { if(!canAim()) return; try{ cv.setPointerCapture(e.pointerId); }catch(_){} G.aiming = true; setAim(e); e.preventDefault(); };
  cv.onpointermove = e => { if(G.aiming) setAim(e); };
  cv.onpointerup = () => { if(!G.aiming) return; G.aiming = false; const a = G.aim; G.aim = null; if(a != null) ballFire(a); };
  cv.onpointercancel = () => { G.aiming = false; G.aim = null; };
  /* ◀ ▶: 한 번 누르면 1.5°, 누르고 있으면 계속 */
  const nudge = d => { if(!canAim()) return false; G.lastAim = Math.max(BAIM_MIN, Math.min(BAIM_MAX, G.lastAim + d * BAIM_STEP)); ballAimTick(true); return true; };
  const hold = (el, d) => {
    let t0 = 0;
    const stop = () => { clearTimeout(t0); clearInterval(G.rep); el.classList.remove('press'); };
    el.onpointerdown = e => { e.preventDefault(); if(!nudge(d)) return; el.classList.add('press'); try{ el.setPointerCapture(e.pointerId); }catch(_){}
      clearTimeout(t0); clearInterval(G.rep); t0 = setTimeout(() => { G.rep = setInterval(() => { if(!nudge(d)) stop(); }, 70); }, 330); };
    el.onpointerup = stop; el.onpointercancel = stop; el.onlostpointercapture = stop;
    el.onclick = e => { if(e.detail === 0) nudge(d); };   /* 키보드로 누를 때 */
  };
  hold($('#bLeft'), 1); hold($('#bRight'), -1);
  $('#bGo').onclick = () => { if(canAim()) ballFire(G.lastAim); };
  $('#bFast').onclick = () => { G.speed = G.speed >= 2 ? 1 : 2; if(G.speed === 1) G.boost = 1; ballHud(); sfx(G.speed > 1 ? 'bFast' : 'toggle', { on:false }); };
  $('#bIPierce').onclick = () => ballItem('pierce'); $('#bIScope').onclick = () => ballItem('scope'); $('#bILift').onclick = ballLift;
  $('#bPause').onclick = ballPause;
  const root = st.querySelector('.sb');
  ['selectstart','contextmenu','dragstart'].forEach(ev => root.addEventListener(ev, e => e.preventDefault()));
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
  if(G.intro && G.adv){ const [nm, tx] = BSP_INFO[G.intro]; G.banner = { t:0, dur:4.2, a:'새 블록: ' + nm, b:tx, sp:G.intro }; }
  ballHud();
  const loop = ts => {
    if(G !== me) return;
    const dt = me.lt ? Math.min(0.033, (ts - me.lt) / 1000) : 0; me.lt = ts;
    if(!me.over && !me.paused) ballUpdate(dt);
    ballDraw();
    if(!me.over) me.raf = requestAnimationFrame(loop);
  };
  me.raf = requestAnimationFrame(loop);
}
/* 조준 각도가 바뀔 때마다 작은 '틱' */
function ballAimTick(force){ const a = G.aim != null ? G.aim : G.lastAim; if(force || G.tickA == null || Math.abs(a - G.tickA) > .035){ G.tickA = a; sfx('bAim'); } }
/* 일시정지: 양피지 창(이어하기 · 게임 방법 · 나가기 · 소리). 대전은 멈추지 않는 대전 메뉴 */
function ballPause(){
  if(G.over) return;
  if(duelNoStop()){ duelMenu(); return; }
  if(!gPause()) return;
  openModal(`<h3>잠깐 쉬어요</h3><p class="note">${G.adv ? '스테이지 ' + G.adv + ' · ' : ''}${G.turn}턴째 · 깬 블록 ${G.broken}/${G.total}</p>
    <div class="mbtns one"><button class="b1" id="mResume">이어하기</button></div>
    <div class="mbtns two"><button class="b2" id="mHelp2">게임 방법</button><button class="b2" id="mQuit2">나가기</button></div>${sndBtnHtml()}`);
  sndBtnBind(); ambDuck(true);
  $('#mResume').onclick = () => { closeModal(); gResume(); ambDuck(false); };
  $('#mHelp2').onclick = () => { closeModal(); gResume(); ambDuck(false); openHelp('ball'); };
  $('#mQuit2').onclick = () => { closeModal(); gResume(); ambDuck(false); confirmQuit(); };
}
/* 관통 구슬·망원경: 누르면 이번 턴에 켜지고(다시 누르면 취소), 발사할 때 1개 씀 */
function ballItem(k){
  if(G.over || G.paused || G.phase !== 'aim' || G.slide) return;
  if(!G[k] && G.items[k] < 1) return;
  G[k] = !G[k]; G.gKey = '';
  sfx(G[k] ? 'bItem' : 'toggle', { on:false }); fxBuzz(12);
  if(G[k]) G.txts.push({ x:BW/2, y:BFLOOR*0.55, text:k === 'pierce' ? '이번 턴 관통 구슬' : '망원경: 두 번 튕긴 곳까지', t:0, dur:1.3 });
  ballHud();
}
/* 밀어 올리기: 모든 블록을 한 줄 위로(맨 윗줄이 차 있으면 못 씀) */
function ballLift(){
  if(G.over || G.paused || G.phase !== 'aim' || G.slide || G.items.lift < 1 || G.gridB[0].some(c => c)) return;
  G.items.lift--; G.itemUsed++;
  ballShift(-1); G.slide = 1; G.slideDir = -1;
  sfx('bLift'); fxBuzz(20);
  for(let c=0;c<BC;c++) G.fx.push(ballPiece(c*BS + BS/2, BFLOOR - 10, 0, -520 - Math.random()*260, '#BFE9FF', 0.6));
  ballHud();
}
function ballFire(a){
  if(G.over || G.paused || G.won || G.phase !== 'aim' || G.slide) return;
  a = Math.max(BAIM_MIN, Math.min(BAIM_MAX, a)); G.lastAim = a; G.aim = null;
  G.pierceShot = G.pierce;
  for(const k of ['pierce', 'scope']) if(G[k]){ G.items[k]--; G.itemUsed++; G[k] = false; }
  G.turnHits = 0; G.tickA = null; G.gained = 0;
  sfx('bFire'); fxBuzz(10);
  G.turn++; G.phase = 'shoot'; G.toLaunch = G.balls; G.launchT = 0; G.firstLand = null; G.shootT = 0; G.boost = 1;
  G.vx = Math.cos(a) * BSPD; G.vy = -Math.sin(a) * BSPD; ballHud();
}
function ballWin(){
  if(G.won) return; G.won = true;
  const me = G; G.flash = .5; G.flashC = '255,240,200';
  if(!G.sim) setTimeout(() => { if(G === me && !me.over) finish(true); }, 750);
}
function ballEndTurn(){
  G.balls += G.gained; G.gained = 0;
  if(G.firstLand != null) G.sx = G.firstLand;
  G.fly = []; G.sparks = []; G.phase = 'aim'; G.boost = 1; G.pierceShot = false; G.gKey = '';
  if(G.won || ballCleared()){ ballWin(); ballHud(); return; }
  if(G.freeze){   /* 시계: 이번엔 안 내려옴. 새 줄이 늦어진 만큼 기준 턴 +1 */
    G.freeze = false; if(G.next < G.rowsN) G.R++;
    G.txts.push({ x:BW/2, y:BFLOOR*0.45, text:'시계가 멈췄어요!', t:0, dur:1.2, big:true }); sfx('bClock', { pan:0 });
    ballHud(); return;
  }
  ballShift(1);
  let auto = 0; G.gridB[BR-1].forEach((c, i) => { if(c && c.star){ auto++; G.gridB[BR-1][i] = null; } });
  if(auto){ G.balls += auto; sfx('bRing', { pan:0 }); G.txts.push({ x:BW/2, y:BFLOOR - 60, text:'별 조각 +' + auto, t:0, dur:1 }); }
  if(G.next < G.rowsN){ if(G.gridB[1].some(c => c)) G.R++; else ballSpawn(); }
  G.slide = 1; G.slideDir = 1; sfx('bSlide');
  if(ballRowHas(BR-1)){
    if(G.shield){ G.phase = 'wait'; const me = G; ballAfter(.42, () => { if(G === me && !me.over) ballGuard(); }); }
    else {
      G.phase = 'end'; fxBuzz([80, 40, 120]); sfx('bAlarm'); G.shake = 14; G.flash = .6; G.flashC = '255,120,150';
      const me = G; ballAfter(.8, () => { if(G === me && !me.over) finish(false); });
    }
  } else if(ballRowHas(BR-2)) ballAfter(.3, () => sfx('bDanger'));
  ballHud();
}
/* 화면용 지연(모의 실행에서는 바로 실행) */
function ballAfter(s, f){ if(typeof setTimeout === 'function' && !G.sim) setTimeout(f, s * 1000); else f(); }
/* 별빛 방어막: 바닥선에 닿은 블록을 한 줄 위로(1번) */
function ballGuard(){
  G.shield = 0; ballShift(-1); G.slide = 1; G.slideDir = -1; G.phase = 'aim';
  G.flash = .7; G.flashC = '170,230,255'; G.shake = 10; fxBuzz([40, 30, 70]); sfx('bGuard');
  for(let i=0;i<26;i++){ const x = Math.random() * BW; G.fx.push(ballPiece(x, BFLOOR - 4, (Math.random() - .5) * 300, -300 - Math.random() * 500, i % 2 ? '#BFEFFF' : '#FFFFFF', .9)); }
  G.rings.push({ x:BW/2, y:BFLOOR, t:0, dur:.6, r:520, c:'170,230,255' });
  G.txts.push({ x:BW/2, y:BFLOOR*0.5, text:'방어막이 지켜 줬어요!', t:0, dur:1.6, big:true });
  ballHud();
}

/* ---- 물리 ---- */
/* 공(b)과 칸(r,c)의 접촉: 둥근 사각(모서리 BRR) 또는 원형 범퍼. 법선(n)과 밀어낸 위치를 돌려줌 */
function ballContact(b, r, c, cell){
  const cx = c*BS + BS/2, cy = r*BS + BS/2;
  if(cell.t === 'bump'){
    const dx = b.x - cx, dy = b.y - cy, R = BBUMP + b.r, d2 = dx*dx + dy*dy;
    if(d2 >= R*R) return null;
    const d = Math.sqrt(d2) || 1e-6, nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
    return { nx, ny, x:cx + nx*R, y:cy + ny*R };
  }
  const h = BS/2 - BPAD - BRR, R = BRR + b.r, ox = b.x - cx, oy = b.y - cy;
  const qx = Math.max(-h, Math.min(h, ox)), qy = Math.max(-h, Math.min(h, oy)), dx = ox - qx, dy = oy - qy, d2 = dx*dx + dy*dy;
  if(d2 >= R*R) return null;
  if(d2 > 1e-6){ const d = Math.sqrt(d2), nx = dx / d, ny = dy / d; return { nx, ny, x:cx + qx + nx*R, y:cy + qy + ny*R }; }
  if(Math.abs(ox) > Math.abs(oy)){ const nx = ox < 0 ? -1 : 1; return { nx, ny:0, x:cx + nx*(h + R), y:b.y }; }
  const ny = oy < 0 ? -1 : 1; return { nx:0, ny, x:b.x, y:cy + ny*(h + R) };
}
/* 한 걸음 충돌 처리. ghost = 조준선 계산용(피해·줍기 없음). 튕기면 true */
function ballCollide(b, ghost){
  const c0 = Math.max(0, Math.floor((b.x - b.r) / BS)), c1 = Math.min(BC-1, Math.floor((b.x + b.r) / BS));
  const r0 = Math.max(0, Math.floor((b.y - b.r) / BS)), r1 = Math.min(BR-1, Math.floor((b.y + b.r) / BS));
  let bounced = false, inNow = b.pierce ? [] : null;
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
    const cell = G.gridB[r][c]; if(!cell) continue;
    if(cell.star){
      if(ghost || b.spark) continue;
      const dx = b.x - (c*BS + BS/2), dy = b.y - (r*BS + BS/2);
      if(dx*dx + dy*dy < (BSTAR + b.r) ** 2) ballPick(r, c);
      continue;
    }
    if(cell.hp <= 0) continue;
    const k = ballContact(b, r, c, cell);
    if(!k) continue;
    if(b.pierce){   /* 관통: 튕기지 않고 들어갈 때마다 1 */
      inNow.push(cell.id);
      if(!ghost && !b.in.includes(cell.id)) ballDamage(r, c, cell, k.ny > 0.75, b);
      continue;
    }
    const dot = b.vx*k.nx + b.vy*k.ny;
    if(dot < 0){
      b.vx -= 2*dot*k.nx; b.vy -= 2*dot*k.ny; bounced = true;
      if(!ghost) ballDamage(r, c, cell, k.ny > 0.75, b);
    }
    b.x = k.x; b.y = k.y;
  }
  if(inNow) b.in = inNow;
  const sp = Math.hypot(b.vx, b.vy) || 1, minVy = sp * 0.12;
  if(Math.abs(b.vy) < minVy){ b.vy = (b.vy > 0 ? 1 : -1) * minVy; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp*sp - minVy*minVy); }
  return bounced;
}
/* 벽 튕김. 튕기면 true */
function ballWalls(b){
  let k = false;
  if(b.x < b.r){ b.x = b.r; b.vx = Math.abs(b.vx); k = true; }
  if(b.x > BW - b.r){ b.x = BW - b.r; b.vx = -Math.abs(b.vx); k = true; }
  if(b.y < b.r){ b.y = b.r; b.vy = Math.abs(b.vy); k = true; }
  return k;
}
function ballPick(r, c){
  G.gridB[r][c] = null; G.gained++; G.gVer++;
  const x = c*BS + BS/2, y = r*BS + BS/2;
  for(let i=0;i<8;i++){ const a = i / 8 * Math.PI * 2; G.fx.push(ballPiece(x, y, Math.cos(a) * 260, Math.sin(a) * 260 - 120, i % 2 ? '#FFE27A' : '#FFFFFF', .55, 1)); }
  G.rings.push({ x, y, t:0, dur:.4, r:60, c:'255,226,122' }); G.txts.push({ x, y:y - 20, text:'+1', t:0, dur:.8 });
  sfx('bRing', { pan:panC(x, BW) }); ballHud();
}
function ballDamage(r, c, cell, below, b){
  const x = c*BS + BS/2, pan = panC(x, BW);
  if(cell.sp === 'shield' && below){ cell.ping = .25; sfx('bTink', { pan }); return; }
  cell.hp -= 1; cell.hit = .18; G.turnHits++;
  if(cell.hp <= 0) ballKill(r, c);
  else sfx('bHit', { n:G.turnHits, pan });
}
/* 블록 깨짐(특수 블록 효과 포함) */
function ballKill(r, c){
  const cell = G.gridB[r] && G.gridB[r][c]; if(!cell || cell.star) return;
  G.gridB[r][c] = null; G.broken++; G.gVer++;
  const x = c*BS + BS/2, y = r*BS + BS/2, pan = panC(x, BW), col = BPAL[cell.band];
  const n = FXR.reduce ? 5 : 12;
  for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, s = 160 + Math.random()*360; G.fx.push(ballPiece(x, y, Math.cos(a)*s, Math.sin(a)*s - 200, i % 3 ? col[0] : (i % 2 ? '#FFFFFF' : col[1]), .7 + Math.random()*.3)); }
  G.rings.push({ x, y, t:0, dur:.3, r:62, c:'255,255,255' });
  sfx('bBreak', { n:G.turnHits, pan });
  if(cell.sp === 'clock'){
    G.freeze = true; G.rings.push({ x, y, t:0, dur:.55, r:140, c:'255,226,122' });
    G.txts.push({ x, y:y - 10, text:'멈춰!', t:0, dur:1 }); sfx('bClock', { pan });
  } else if(cell.sp === 'paint'){
    const hit = [];
    for(let rr=0;rr<BR;rr++) for(let cc=0;cc<BC;cc++){
      const o = G.gridB[rr][cc]; if(!o || o.star || o.hp <= 0 || o.band !== cell.band) continue;
      o.hp -= Math.max(1, Math.round(o.hp * 0.25)); o.hit = .25; o.paint = .6;
      const tx = cc*BS + BS/2, ty = rr*BS + BS/2;
      for(let i=0;i<(FXR.reduce ? 2 : 5);i++) G.fx.push(ballPiece(tx, ty, (Math.random() - .5) * 360, -120 - Math.random() * 240, col[i % 2 ? 0 : 1], .5, 1));
      G.rings.push({ x:tx, y:ty, t:-Math.hypot(tx - x, ty - y) / 2400, dur:.35, r:55, c:ballRgb(col[1]) });
      if(o.hp <= 0) hit.push([rr, cc]);
    }
    G.rings.push({ x, y, t:0, dur:.6, r:230, c:ballRgb(col[1]) }); G.flash = .35; G.flashC = ballRgb(col[0]);
    G.txts.push({ x, y:y - 10, text:'물감 퐁!', t:0, dur:1 }); sfx('bPaint', { pan });
    hit.forEach(([rr, cc]) => ballKill(rr, cc));
  } else if(cell.sp === 'fire'){
    for(const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) G.sparks.push({ x, y, vx:dx * BSPARK_V * Math.SQRT1_2, vy:dy * BSPARK_V * Math.SQRT1_2, r:BSPARK_R, spark:true });
    G.rings.push({ x, y, t:0, dur:.45, r:120, c:'255,170,90' });
    for(let i=0;i<10;i++){ const a = i / 10 * Math.PI * 2; G.fx.push(ballPiece(x, y, Math.cos(a) * 420, Math.sin(a) * 420, i % 2 ? '#FFD36B' : '#FF9E6B', .5, 1)); }
    sfx('bSpark', { pan });
  }
  ballHud();
  if(ballCleared()) ballWin();
}
const ballRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
/* 색종이 조각(pastel). round=1 이면 동그란 빛 */
function ballPiece(x, y, vx, vy, c, t, round){ return { x, y, vx, vy, t, t0:t, c, s:8 + Math.random()*9, rot:Math.random()*6, vr:(Math.random() - .5) * 14, round }; }
/* 한 걸음 이동(벽·블록). 공 = 발사한 구슬, 불꽃 = 폭죽 구슬 */
function ballMove(b, h){
  b.x += b.vx*h; b.y += b.vy*h;
  ballWalls(b); ballCollide(b, false);
}
function ballUpdate(dt){
  if(G.slide > 0){ G.slide = Math.max(0, G.slide - dt / 0.3); if(!G.slide) ballHud(); }
  if(G.flash > 0) G.flash = Math.max(0, G.flash - dt);
  if(G.ffT > 0) G.ffT = Math.max(0, G.ffT - dt);
  if(G.banner){ G.banner.t += dt; if(G.banner.t > G.banner.dur) G.banner = null; }
  if(!G.sim){
    for(const f of G.fx){ f.t -= dt; f.vy += 1300*dt; f.vx *= (1 - 1.6*dt); f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.vr*dt; }
    if(G.fx.length) G.fx = G.fx.filter(f => f.t > 0);
    if(G.shake > 0) G.shake = Math.max(0, G.shake - dt * 50);
    for(const x of G.rings) x.t += dt; if(G.rings.length) G.rings = G.rings.filter(x => x.t < x.dur);
    for(const x of G.txts) x.t += dt; if(G.txts.length) G.txts = G.txts.filter(x => x.t < x.dur);
    for(const row of G.gridB) for(const c of row) if(c && !c.star){ if(c.hit) c.hit = Math.max(0, c.hit - dt); if(c.ping) c.ping = Math.max(0, c.ping - dt); if(c.paint) c.paint = Math.max(0, c.paint - dt); }
  }
  if(G.phase !== 'shoot') return;
  G.shootT += dt;
  if(G.boost < 2 && G.shootT >= 4){ G.boost = 2; G.ffT = 1.1; sfx('bFast'); ballHud(); }
  const sdt = dt * Math.max(G.speed, G.boost);
  G.launchT -= sdt;
  while(G.toLaunch > 0 && G.launchT <= 0){
    G.fly.push({ x:G.sx, y:BFLOOR - BRAD - 1, vx:G.vx, vy:G.vy, r:BRAD, on:true, pierce:G.pierceShot, in:[] });
    if(!G.sim) sfx('bShot', { pan:panC(G.sx, BW) });
    G.toLaunch--; G.launchT += BGAP; ballHud();
  }
  const late = G.shootT > 20;   /* 아주 오래 날면 살짝 아래로 끌어당겨 턴이 끝나게 */
  const steps = Math.max(1, Math.ceil(BSPD * sdt / 6)), h = sdt / steps;
  for(let s=0;s<steps;s++){
    for(const b of G.fly){
      if(!b.on) continue;
      if(late) b.vy += 900*h;
      ballMove(b, h);
      if(b.vy > 0 && b.y >= BFLOOR - BRAD){
        b.on = false; b.y = BFLOOR - BRAD;
        if(G.firstLand == null){ G.firstLand = Math.max(BRAD, Math.min(BW - BRAD, b.x)); if(!G.sim){ sfx('bLand', { pan:panC(b.x, BW) }); G.rings.push({ x:G.firstLand, y:BFLOOR - BRAD, t:0, dur:.35, r:44, c:'255,236,170' }); } }
        else b.roll = true;
      }
    }
    for(const p of G.sparks){
      p.vy += 700*h; ballMove(p, h);
      if(p.vy > 0 && p.y >= BFLOOR - p.r){ p.dead = true; if(!G.sim) G.fx.push(ballPiece(p.x, BFLOOR - 6, 0, -180, '#FFD36B', .35, 1)); }
    }
    if(G.sparks.length && G.sparks.some(p => p.dead)) G.sparks = G.sparks.filter(p => !p.dead);
  }
  if(G.fly.length > 60 && !G.toLaunch) G.fly = G.fly.filter(b => b.on || b.roll);
  for(const b of G.fly){
    if(!b.roll) continue;
    const d = G.firstLand - b.x, st = 2400 * sdt;
    if(Math.abs(d) <= st){ b.x = G.firstLand; b.roll = false; b.on = false; } else b.x += Math.sign(d) * st;
  }
  if(G.toLaunch === 0 && !G.sparks.length && !G.fly.some(b => b.on || b.roll)) ballEndTurn();
}
/* 조준선: 유령 구슬을 같은 물리로 굴려 튕긴 점을 모음. 보통은 첫 튕김까지, 망원경은 두 번 튕긴 뒤 다음 닿는 곳까지 */
function ballGuide(a, bounces){
  const b = { x:G.sx, y:BFLOOR - BRAD - 1, vx:Math.cos(a) * BSPD, vy:-Math.sin(a) * BSPD, r:BRAD, pierce:G.pierce, in:[] };
  const pts = [[b.x, b.y]], h = 1 / 280; let n = 0;
  for(let i=0;i<5000;i++){
    b.x += b.vx*h; b.y += b.vy*h;
    const k = ballWalls(b) | ballCollide(b, true);
    if(k){ pts.push([b.x, b.y]); if(++n > bounces) break; }
    if(b.vy > 0 && b.y >= BFLOOR - BRAD){ pts.push([b.x, BFLOOR - BRAD]); break; }
  }
  return pts;
}

/* ---- 그리기 ---- */
const BSPR = {};
function ballPath(x, t){
  x.beginPath();
  if(t === 'bump') x.arc(BS/2, BS/2, BBUMP, 0, Math.PI*2);
  else { const a = BPAD, w = BS - 2*BPAD, r = BRR; x.moveTo(a + r, a); x.arcTo(a + w, a, a + w, a + w, r); x.arcTo(a + w, a + w, a, a + w, r); x.arcTo(a, a + w, a, a, r); x.arcTo(a, a, a + w, a, r); x.closePath(); }
}
/* 젤리 블록 이미지: 색·모양·특수별로 한 번만 그려 재사용 */
function ballSprite(t, band, sp){
  const sc = G.scale || 1, key = t + band + (sp || '') + '@' + sc.toFixed(3);
  if(BSPR[key]) return BSPR[key];
  const M = 10, size = BS + 2*M, cv = document.createElement('canvas');
  cv.width = Math.ceil(size * sc); cv.height = cv.width;
  const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(M, M);
  const [fill, deep, lite] = BPAL[band];
  x.save(); x.translate(0, 6); ballPath(x, t); x.fillStyle = 'rgba(12,4,40,.45)'; x.fill(); x.restore();   /* 그림자 */
  ballPath(x, t);
  const g = x.createLinearGradient(0, BPAD, 0, BS - BPAD); g.addColorStop(0, lite); g.addColorStop(.35, fill); g.addColorStop(1, deep);
  x.fillStyle = g; x.fill();
  x.save(); ballPath(x, t); x.clip();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(BS*.4, BS*.25, BS*.26, BS*.1, -.15, 0, Math.PI*2); x.fill();   /* 윗면 광택 */
  x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(BS*.24, BS*.24, 6, 4.2, -.5, 0, Math.PI*2); x.fill();
  x.strokeStyle = 'rgba(42,22,80,.18)'; x.lineWidth = 8; ballPath(x, t); x.stroke();   /* 안쪽 테두리 그늘 */
  x.restore();
  x.lineWidth = 5; x.strokeStyle = BOUT; x.lineJoin = 'round'; ballPath(x, t); x.stroke();
  const badge = (fn, bg) => { const bx = BS - BPAD - 13, by = BPAD + 13; x.beginPath(); x.arc(bx, by, 14, 0, Math.PI*2); x.fillStyle = bg; x.fill(); x.lineWidth = 3.5; x.strokeStyle = BOUT; x.stroke(); x.save(); x.translate(bx, by); fn(); x.restore(); };
  if(sp === 'shield'){   /* 아래 면에 굵은 방패 막대 */
    const y0 = BS - BPAD - 17, a = BPAD + 7, w = BS - 2*BPAD - 14;
    x.beginPath(); x.roundRect ? x.roundRect(a, y0, w, 15, 6) : x.rect(a, y0, w, 15); x.fillStyle = '#6F7FC8'; x.fill(); x.lineWidth = 3.5; x.strokeStyle = BOUT; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(a + 6, y0 + 3.5, w - 12, 3);
    for(const px of [a + 10, a + w - 10]){ x.beginPath(); x.arc(px, y0 + 9, 2.4, 0, Math.PI*2); x.fillStyle = BOUT; x.fill(); }
  } else if(sp === 'clock') badge(() => { x.strokeStyle = BOUT; x.lineWidth = 2.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -8); x.moveTo(0, 0); x.lineTo(6, 3); x.stroke(); }, '#FFFFFF');
  else if(sp === 'paint') badge(() => { [['#FF6FA8',-5,-3],['#5EC8FF',5,-3],['#FFD34D',0,5]].forEach(([c2, px, py]) => { x.beginPath(); x.arc(px, py, 4.6, 0, Math.PI*2); x.fillStyle = c2; x.fill(); }); }, '#FFFFFF');
  else if(sp === 'fire') badge(() => { x.fillStyle = '#FFE27A'; x.beginPath(); for(let i=0;i<10;i++){ const a = i / 10 * Math.PI*2 - Math.PI/2, r = i % 2 ? 4 : 10; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.closePath(); x.fill(); x.lineWidth = 2; x.strokeStyle = BOUT; x.stroke(); }, '#FF7A59');
  BSPR[key] = cv; return cv;
}
/* 밤하늘 배경(흐린 별·은하수): 크기별로 한 번만 */
function ballBg(){
  const key = G.cv.width + 'x' + G.cv.height;
  if(G.bgCv && G.bgKey === key) return G.bgCv;
  const cv = document.createElement('canvas'); cv.width = G.cv.width; cv.height = G.cv.height;
  const x = cv.getContext('2d'); x.scale(G.scale, G.scale);
  const g = x.createLinearGradient(0, 0, 0, BH); g.addColorStop(0, '#2E1D78'); g.addColorStop(.55, '#20145A'); g.addColorStop(1, '#170E44');
  x.fillStyle = g; x.fillRect(0, 0, BW, BH);
  const mw = x.createLinearGradient(0, BH*.9, BW, BH*.1); mw.addColorStop(0, 'rgba(255,140,210,0)'); mw.addColorStop(.5, 'rgba(190,160,255,.13)'); mw.addColorStop(1, 'rgba(255,140,210,0)');
  x.fillStyle = mw; x.fillRect(0, 0, BW, BH);
  const rng = mulberry(77);
  for(let i=0;i<120;i++){ const px = rng()*BW, py = rng()*BFLOOR, r = rng() < .12 ? 2.6 : 1.3 + rng(); x.globalAlpha = .18 + rng()*.4; x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(px, py, r, 0, Math.PI*2); x.fill(); }
  x.globalAlpha = 1;
  x.fillStyle = 'rgba(10,4,34,.55)'; x.fillRect(0, BFLOOR, BW, BH - BFLOOR);   /* 발사 자리 아래 땅 */
  G.bgCv = cv; G.bgKey = key; return cv;
}
/* 흰 금빛 구슬 이미지(관통 구슬은 분홍빛): 한 번만 그림 */
function ballOrb(pierce){
  const sc = G.scale || 1, key = 'orb' + (pierce ? 1 : 0) + '@' + sc.toFixed(3);
  if(BSPR[key]) return BSPR[key];
  const r = BRAD, cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil((2*r + 4) * sc);
  const x = cv.getContext('2d'); x.scale(sc, sc);
  const g = x.createRadialGradient(r + 2 - r*.35, r + 2 - r*.4, 1, r + 2, r + 2, r);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(.55, pierce ? '#FFD1EC' : '#FFF4C8'); g.addColorStop(1, pierce ? '#FF7FC4' : '#F5C04A');
  x.fillStyle = g; x.beginPath(); x.arc(r + 2, r + 2, r, 0, Math.PI*2); x.fill();
  BSPR[key] = cv; return cv;
}
function ballStarPath(ctx, x, y, R, r){ ctx.beginPath(); for(let i=0;i<10;i++){ const a = i / 10 * Math.PI*2 - Math.PI/2, k = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a)*k, y + Math.sin(a)*k); } ctx.closePath(); }
function ballDraw(){
  const ctx = G.ctx; if(!ctx) return;
  const now = performance.now() / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ballBg(), 0, 0);
  ctx.setTransform(G.scale, 0, 0, G.scale, 0, 0);
  if(G.shake > 0 && !FXR.reduce){ const k = G.shake; ctx.translate((Math.random()*2 - 1) * k, (Math.random()*2 - 1) * k); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  /* 바닥선 + 별빛 방어막 띠 */
  const danger = ballRowHas(BR-2);
  if(G.shield){ const gl = ctx.createLinearGradient(0, BFLOOR - 26, 0, BFLOOR + 6); gl.addColorStop(0, 'rgba(150,225,255,0)'); gl.addColorStop(1, `rgba(150,225,255,${.38 + .12*Math.sin(now*2.4)})`); ctx.fillStyle = gl; ctx.fillRect(0, BFLOOR - 26, BW, 32); }
  ctx.fillStyle = danger ? `rgba(255,130,170,${.7 + .3*Math.sin(now*7)})` : G.shield ? '#BFEFFF' : 'rgba(255,255,255,.55)';
  ctx.fillRect(0, BFLOOR, BW, 5);
  const ease = t => t*t*(3 - 2*t), slideY = G.slide > 0 ? -BS * ease(G.slide) * G.slideDir : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, BW, BFLOOR); ctx.clip(); ctx.translate(0, slideY);
  for(let r=0;r<BR;r++) for(let c=0;c<BC;c++){
    const cell = G.gridB[r][c]; if(!cell) continue;
    const cx = c*BS + BS/2, cy = r*BS + BS/2;
    if(r === 1 && G.slide > 0 && G.slideDir > 0 && cell.id > G.uid - BC) ctx.globalAlpha = 1 - G.slide;
    if(cell.star){   /* 별 조각: 살짝 떠다니며 반짝 */
      const by = cy + Math.sin(now*2.6 + cell.bob) * 4, tw = .8 + .2*Math.sin(now*5 + cell.bob);
      ctx.fillStyle = 'rgba(255,226,122,.22)'; ctx.beginPath(); ctx.arc(cx, by, 30 * tw, 0, Math.PI*2); ctx.fill();
      ballStarPath(ctx, cx, by, 21, 9.5); ctx.fillStyle = '#FFE27A'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BOUT; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(cx - 4, by - 5, 3.2, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1; continue;
    }
    const sq = cell.hit > 0 ? Math.sin(cell.hit / .18 * Math.PI) * .09 : 0, M = 10;
    ctx.save(); ctx.translate(cx, cy + (cell.t === 'bump' ? 0 : sq * 20)); ctx.scale(1 + sq, 1 - sq);
    ctx.drawImage(ballSprite(cell.t, cell.band, cell.sp), -BS/2 - M, -BS/2 - M, BS + 2*M, BS + 2*M);
    if(cell.paint){ ctx.globalAlpha = cell.paint / .6 * .55; ctx.fillStyle = '#FFFFFF'; ctx.translate(-BS/2, -BS/2); ballPath(ctx, cell.t); ctx.fill(); ctx.translate(BS/2, BS/2); ctx.globalAlpha = 1; }
    if(cell.ping){ ctx.globalAlpha = cell.ping / .25; ctx.strokeStyle = '#E8F4FF'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-32, 40); ctx.lineTo(32, 40); ctx.stroke(); ctx.globalAlpha = 1; }
    const s = String(cell.hp), fs = s.length > 2 ? 30 : 38;
    ctx.font = fs + 'px "Black Han Sans", Jua, sans-serif';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(s, 0, cell.sp === 'shield' ? -4 : 2);
    ctx.fillStyle = BOUT; ctx.fillText(s, 0, cell.sp === 'shield' ? -4 : 2);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  ctx.restore();
  /* 조준선 */
  if(G.phase === 'aim' && !G.slide && !G.over){
    const a = G.aim != null ? G.aim : G.lastAim, bn = G.scope ? 2 : 0, key = a.toFixed(4) + ':' + bn + ':' + G.gVer + ':' + G.sx + ':' + G.pierce;
    if(G.gKey !== key){ G.guide = ballGuide(a, bn); G.gKey = key; }
    const P = G.guide, act = G.aim != null;
    ctx.fillStyle = G.scope ? 'rgba(170,230,255,.95)' : act ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.5)';
    let carry = 18, total = 0;
    for(let i=1;i<P.length;i++){
      const [x0, y0] = P[i-1], [x1, y1] = P[i], L = Math.hypot(x1 - x0, y1 - y0);
      let d = carry;
      while(d < L){ const k = d / L, rad = Math.max(2.4, 6 - total * .0035); ctx.beginPath(); ctx.arc(x0 + (x1 - x0)*k, y0 + (y1 - y0)*k, rad, 0, Math.PI*2); ctx.fill(); d += 30; total += 30; }
      carry = d - L;
    }
    const e = P[P.length - 1]; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e[0], e[1], BRAD, 0, Math.PI*2); ctx.stroke();
  }
  /* 구슬: 흰 금빛 + 짧은 꼬리 */
  const pierce = G.phase === 'aim' ? G.pierce : G.pierceShot;
  const orb = ballOrb(pierce), drawBall = (x, y, r) => ctx.drawImage(orb, x - r - 2, y - r - 2, 2*r + 4, 2*r + 4);
  ctx.lineCap = 'round';
  for(const b of G.fly) if(b.on){ ctx.strokeStyle = pierce ? 'rgba(255,170,220,.4)' : 'rgba(255,236,170,.38)'; ctx.lineWidth = BRAD * 1.5; ctx.beginPath(); ctx.moveTo(b.x - b.vx * .028, b.y - b.vy * .028); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for(const b of G.fly) if(b.on || b.roll) drawBall(b.x, b.y, BRAD);
  for(const p of G.sparks){ ctx.strokeStyle = 'rgba(255,170,90,.45)'; ctx.lineWidth = p.r * 1.6; ctx.beginPath(); ctx.moveTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = '#FFE9A8'; ballStarPath(ctx, p.x, p.y, p.r + 4, p.r * .55); ctx.fill(); }
  const waiting = G.phase === 'aim' ? G.balls : G.toLaunch;
  if(G.phase === 'aim' || G.toLaunch > 0 || G.phase === 'wait' || G.phase === 'end') drawBall(G.sx, BFLOOR - BRAD, BRAD);
  else if(G.firstLand != null){ ctx.globalAlpha = .6; drawBall(G.firstLand, BFLOOR - BRAD, BRAD); ctx.globalAlpha = 1; }
  if(waiting > 0){
    ctx.font = '30px "Black Han Sans", Jua, sans-serif'; ctx.textAlign = G.sx > BW - 120 ? 'right' : 'left';
    const lx = G.sx > BW - 120 ? G.sx - 24 : G.sx + 24, ly = BFLOOR - 42;
    ctx.lineWidth = 6; ctx.strokeStyle = BOUT; ctx.strokeText('×' + waiting, lx, ly); ctx.fillStyle = '#FFF4C8'; ctx.fillText('×' + waiting, lx, ly); ctx.textAlign = 'center';
  }
  /* 조각·고리·글자 */
  for(const f of G.fx){ const k = Math.max(0, f.t / f.t0), sz = f.s * (.4 + .6 * k); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = f.c;
    if(f.round){ ctx.beginPath(); ctx.arc(f.x, f.y, sz * .5, 0, Math.PI*2); ctx.fill(); }
    else { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillRect(-sz/2, -sz/4, sz, sz/2); ctx.restore(); } }
  ctx.globalAlpha = 1;
  for(const g of G.rings){ if(g.t < 0) continue; const k = g.t / g.dur, e = 1 - Math.pow(1 - k, 3); ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = `rgb(${g.c})`; ctx.lineWidth = 10 * (1 - k) + 2; ctx.beginPath(); ctx.arc(g.x, g.y, 10 + g.r * e, 0, Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for(const x of G.txts){ const k = x.t / x.dur, sc = k < .15 ? .5 + k / .15 * .6 : k < .3 ? 1.1 - (k - .15) / .15 * .1 : 1;
    ctx.save(); ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; ctx.translate(x.x, x.y - k * 60); ctx.scale(sc, sc);
    ctx.font = (x.big ? 44 : 34) + 'px Jua, sans-serif'; ctx.lineWidth = 9; ctx.strokeStyle = BOUT; ctx.strokeText(x.text, 0, 0); ctx.fillStyle = x.big ? '#FFE27A' : '#FFFFFF'; ctx.fillText(x.text, 0, 0); ctx.restore(); }
  ctx.globalAlpha = 1;
  if(G.flash > 0){ ctx.fillStyle = `rgba(${G.flashC},${Math.min(.45, G.flash * .6)})`; ctx.fillRect(0, 0, BW, BFLOOR); }
  if(G.ffT > 0){ ctx.globalAlpha = Math.min(1, G.ffT * 2); ctx.font = '40px Jua, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = BOUT; ctx.strokeText('⏩ ×2 빠르게', BW/2, 60); ctx.fillStyle = '#FFE27A'; ctx.fillText('⏩ ×2 빠르게', BW/2, 60); ctx.globalAlpha = 1; }
  const bn = G.banner;
  if(bn){   /* 새 특수 블록 안내 */
    const k = bn.t / bn.dur, al = k < .1 ? k / .1 : k > .85 ? (1 - k) / .15 : 1, y = BFLOOR * .62;
    ctx.globalAlpha = al; ctx.fillStyle = 'rgba(255,248,234,.96)'; ctx.strokeStyle = BOUT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(60, y - 70, BW - 120, 140, 26) : ctx.rect(60, y - 70, BW - 120, 140); ctx.fill(); ctx.stroke();
    ctx.drawImage(ballSprite('sq', 2, bn.sp), 84, y - 50, 100, 100);
    ctx.textAlign = 'left'; ctx.fillStyle = BOUT; ctx.font = '38px Jua, sans-serif'; ctx.fillText(bn.a, 200, y - 22);
    ctx.fillStyle = '#7B6A93'; ctx.font = '26px "Noto Sans KR", sans-serif'; ctx.fillText(bn.b, 200, y + 24); ctx.textAlign = 'center'; ctx.globalAlpha = 1;
  } else if(G.phase === 'aim' && G.turn === 0 && G.aim == null && (!G.adv || G.adv <= 2)){
    ctx.font = '32px Jua, sans-serif'; ctx.lineWidth = 7; ctx.strokeStyle = BOUT; ctx.fillStyle = '#FFFFFF';
    for(const [t, dy] of [['판을 누른 채 끌어서 조준하고', 0], ['손을 떼면 구슬이 날아가요', 44]]){ ctx.strokeText(t, BW/2, (BR-3)*BS + dy); ctx.fillText(t, BW/2, (BR-3)*BS + dy); }
  }
}
Object.assign(SFX_LIB, {
  bClock(o){ aMarimba(m2f(84), { v:.1, pan:o.pan }); aMarimba(m2f(79), { t:.1, v:.08, pan:o.pan }); [.22, .36, .5].forEach(t => aTone({ f:2300, type:'triangle', t, d:.02, v:.025, pan:o.pan })); },
  bTink(o){ aBell({ f:m2f(98), ratio:3.1, idx:.5, d:.12, v:.028, pan:o.pan }); },
  bPaint(o){ aNoise({ ft:'bandpass', f:1100, f2:260, q:1.4, d:.32, v:.1, pan:o.pan }); aThump({ f:170, f2:90, d:.12, v:.08 }); aSparkle({ root:79, n:5, gap:.04, t:.08, v:.04 }); },
  bSpark(o){ [0, .05, .1, .17].forEach(t => aNoise({ ft:'highpass', f:rnd(2600, 5200), t, d:.05, v:.06, pan:o.pan })); aTone({ f:520, f2:1700, d:.2, v:.035, pan:o.pan }); },
  bGuard(){ aBell({ f:m2f(88), ratio:2.4, idx:1.4, d:1, v:.07, rev:.5 }); aBell({ f:m2f(95), t:.08, ratio:2.4, idx:1, d:1.1, v:.05, rev:.5 }); aNoise({ ft:'highpass', f:3000, d:.25, v:.06 }); aThump({ f:120, f2:50, d:.35, v:.2 }); },
  bLift(){ aTone({ f:260, f2:820, type:'triangle', d:.28, v:.07 }); aWhoosh({ f:600, f2:2600, d:.25, v:.05 }); },
  bItem(){ aSparkle({ root:84, n:4, gap:.04, v:.05 }); aTone({ f:660, f2:990, type:'triangle', d:.12, v:.05 }); }
});
Object.assign(SFX_GATE, { bTink:60, bPaint:90, bSpark:70, bClock:150 });

/* 이미 새 요소 등장 판이 정해진 게임: 카드·표시만(난이도 표는 그대로) */
CONCEPTS.ball = { fixed:[
  { at:3, key:'clock', name:'시계 블록', desc:'깨지면 다음 한 턴 동안 블록이 내려오지 않아요.' },
  { at:7, key:'shield', name:'방패 블록', desc:'아래쪽 면으로 맞으면 끄떡없어요. 벽에 튕겨 옆이나 위로 맞혀요.' },
  { at:12, key:'paint', name:'물감 블록', desc:'깨지면 같은 색 블록 모두 체력이 25% 줄어요.' },
  { at:18, key:'fire', name:'폭죽 블록', desc:'깨지면 불꽃 구슬 4개가 대각선으로 튀어 한 번 더 때려요.' }] };


/* ===================== 게임 정의(엔진이 이 게임을 부르는 창구) =====================
   이름·색·도움말·썸네일·챕터·난이도·시작·점수·별을 엔진(core/engine.js)에 알려 준다. 규칙은 games/CLAUDE.md의 '게임 정의 계약' 참고. */
NG.ball = {
  name:'별빛 구슬', col:['#D9A2FF','#9B44E8','#4E1683'], time:'약 3분', abil:'공간지각',
  icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="3" width="5.5" height="5" rx="1.4"/><rect x="9.25" y="3" width="5.5" height="5" rx="1.4" opacity=".55"/><rect x="16" y="3" width="5.5" height="5" rx="1.4"/><circle cx="12" cy="16" r="4.6"/></svg>',
  art(){
    const pal = ['#9CEBC6','#A6D2FF','#FFE38A','#FFBC96','#F7A3D6'];
    const cells = [[0,0,3,2],[1,0,5,3],[3,0,9,4],[4,0,4,2],[0,1,2,1],[2,1,6,'b'],[5,1,3,1],[1,2,1,0],[4,2,2,0]];
    let g = '', stars = '';
    for(let k=0;k<22;k++) stars += `<circle cx="${(k * 37) % 160}" cy="${(k * 23) % 96}" r="${k % 5 ? .7 : 1.2}" fill="#fff" opacity="${.25 + (k % 3) * .15}"/>`;
    cells.forEach(([c, r, n, b]) => { const x = 14 + c * 22, y = 6 + r * 22;
      if(b === 'b') g += `<circle cx="${x + 10}" cy="${y + 10}" r="9" fill="${pal[3]}" stroke="#2A1650" stroke-width="2.2"/><ellipse cx="${x + 7}" cy="${y + 5.5}" rx="4" ry="1.8" fill="#fff" opacity=".6"/><text x="${x + 10}" y="${y + 13.4}" text-anchor="middle" font-size="9.5" font-family="Black Han Sans, Jua, sans-serif" fill="#2A1650">${n}</text>`;
      else g += `<rect x="${x}" y="${y}" width="20" height="20" rx="5" fill="${pal[b]}" stroke="#2A1650" stroke-width="2.2"/><ellipse cx="${x + 8}" cy="${y + 5}" rx="5.5" ry="2" fill="#fff" opacity=".6"/><text x="${x + 10}" y="${y + 14.2}" text-anchor="middle" font-size="10" font-family="Black Han Sans, Jua, sans-serif" fill="#2A1650">${n}</text>`; });
    let dots = ''; for(let k=1;k<7;k++) dots += `<circle cx="${96 - k * 5.2}" cy="${88 - k * 7.6}" r="1.6" fill="#fff" opacity="${1 - k * .1}"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="aBallBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2690"/><stop offset=".6" stop-color="#22166A"/><stop offset="1" stop-color="#170E44"/></linearGradient>
      <radialGradient id="aBallG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#FFF4C8"/><stop offset="1" stop-color="#F5C04A"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#aBallBg)"/>${stars}${g}${dots}
      <path d="M134 7l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#FFE27A" stroke="#2A1650" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="0" y="93" width="160" height="2.5" fill="#BFEFFF"/><rect x="0" y="86" width="160" height="7" fill="#96E1FF" opacity=".25"/>
      <circle cx="98" cy="88" r="4.6" fill="url(#aBallG)"/><text x="108" y="84" font-size="8.5" font-family="Black Han Sans, Jua, sans-serif" fill="#FFF4C8" stroke="#2A1650" stroke-width="2" paint-order="stroke">×12</text></svg>`;
  },
  help:[['끌어서 조준, 떼면 발사','판을 누른 채 끌면 점선이 보여요. 손을 떼면 구슬이 날아가요. 아래 ◀ ▶로 조금씩 맞추고 [발사]를 눌러도 돼요.'],['숫자만큼 맞혀 깨기','젤리 블록과 둥근 범퍼는 숫자만큼 맞히면 깨져요. 별 조각을 먹으면 다음 턴 구슬 +1. 시계·방패·물감·폭죽 블록은 깨거나 맞힐 때 특별한 일이 생겨요.'],['바닥선을 지켜요','턴마다 블록이 한 줄 내려와요. 바닥선에 닿으면 별빛 방어막이 한 번 막아 주고, 두 번째엔 끝나요. 관통 구슬·망원경·밀어 올리기는 판마다 1번씩.']],
  chapters:['은하수 입구','젤리 성운','시계탑 별자리','방패 소행성대','불꽃놀이 은하'],
  starRule:'★ 클리어 · ★★ 기준 턴+6 이내 · ★★★ 기준 턴+3 이내·방어막 지킴',
  levels:{ easy:{ rows:10, like:5, limit:0 }, normal:{ rows:14, like:12, limit:0 }, hard:{ rows:18, like:22, limit:0 } },
  levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return '블록 ' + c.rows + '줄'; },
  saveKey:'hp:ballStages',
  stage:n => ballStageCfg(n),
  stageDesc(n){ const b = ballStageCfg(n); return b.rows + '줄 · 구슬 ' + b.start + '개' + (b.intro ? ' · 새 블록: ' + BSP_INFO[b.intro][0] : ''); },
  init(cfg, rng){ ballInit(genBall(rng, cfg)); },
  render:st => ballStage(st),
  progress:() => G.total ? G.broken / G.total : 0,
  lossText:() => `블록 ${G.broken}/${G.total}개를 깼어요${G.next < G.rowsN ? ' · 남은 줄 ' + (G.rowsN - G.next) + '줄' : ''}.`,
  score(){ return { base:500, time:Math.max(0, 350 - Math.max(0, G.turn - G.R) * 30), extra:(G.shield ? 100 : 0) + (G.itemUsed ? 0 : 50),
    rows:['스테이지 클리어', '턴 보너스 (' + G.turn + '턴, 기준 ' + G.R + '턴)', (G.shield ? '방어막 지킴' : '방어막 씀') + ' · ' + (G.itemUsed ? '아이템 씀' : '아이템 안 씀')] }; },
  stars:() => ballStars(G.turn, G.R, G.shield > 0),
  winSfx:true, amb:'stars',
  duelPace:[170,.66],
  duelStat:{ unit:'개',             get:() => ({ v:G.broken, t:G.total }) }
};
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.ball.scene = { kind:'stars', colors:['#FFFFFF','#E3C8FF','#9FD8FF'], density:1.1 };
