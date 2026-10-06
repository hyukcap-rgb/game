/* 별빛 구슬: 물리·화면·솔로 */
/* ---------- 별빛 구슬: 밤하늘 젤리 블록을 구슬로 깨는 게임. 논리 좌표(칸 100) 기준 물리, 화면은 배율만 적용 ---------- */
/* 판 8열 × 11줄(맨 아래 줄은 발사 자리). 줄 0은 비워 두는 여유 줄, 새 줄은 줄 1로 들어옴 */
/* 2026-10-06 세대별 테스트: 속도 2배(BSPD 2800·간격 0.03초), 고정 단계 물리(BSTEP 1/240초 × BSUB 2 = 한 번에 5.8 논리 이동, 칸의 1/17) */
const BC = 8, BR = 11, BS = 100, BW = BC*BS, BFLOOR = BR*BS, BH = BFLOOR + 34, BRAD = 15, BSPD = 2800, BGAP = 0.03;
const BSTEP = 1 / 240, BSUB = 2, BPRE = 4, BSLIDE = 0.15;   /* 고정 단계·나눔, 시작할 때 미리 채우는 줄, 한 줄 내려오는 시간 */
const BPAD = 6, BRR = 20, BBUMP = 41, BSTAR = 24;          /* 블록 여백·모서리, 범퍼 반지름, 별 조각 반지름 */
const BSPARK_R = 10, BSPARK_V = 2200;                       /* 폭죽 불꽃 구슬 */
const BAIM_MIN = 0.14, BAIM_MAX = Math.PI - 0.14, BAIM_STEP = 1.5 * Math.PI / 180;
/* 체력 단계 5색(채도 낮춤, 광택 없음): 1~3 민트 · 4~7 하늘 · 8~15 연보라 · 16~30 살구 · 31+ 장미. [바탕, 조각용 진한 색] */
const BPAL = [['#9ED8C8','#6FB9A6'], ['#9EC3F0','#6F9DD6'], ['#B9A6EE','#8F78D6'], ['#F2B08A','#D98A62'], ['#E88A9E','#C9667C']];
const ballBand = hp => hp <= 3 ? 0 : hp <= 7 ? 1 : hp <= 15 ? 2 : hp <= 30 ? 3 : 4;
const BOUT = '#1A0F45', BGOLD = '#FFC93C';
const BSP_AT = { clock:3, shield:7, paint:12, fire:18 };   /* 특수 블록이 처음 나오는 스테이지 */
const BSP_INFO = { clock:['시계','깨면 다음 턴에 블록이 안 내려와요'], shield:['방패','아래쪽 면은 막혀요. 옆·위로 돌려 맞혀요'], paint:['물감','깨면 같은 색 블록 체력이 25% 줄어요'], fire:['폭죽','깨면 불꽃 구슬 4개가 튀어요'] };
/* 이벤트 블록(3턴 동안만 반짝, 못 깨면 보통 블록): 솔로 첫 등장 스테이지 */
const BEV_AT = { meteor:15, bolt:25, chest:35, magnet:45 }, BEV_TURNS = 3, BEV_P = 0.09;
const BEV_INFO = { meteor:['별똥별','깨면 구슬이 2개 늘어요'], bolt:['번개','깨면 같은 줄 블록 체력이 2 줄어요'], chest:['보물 상자','깨면 아이템이 1개 생겨요'], magnet:['자석','깨면 판의 별 조각을 모두 모아요'] };
const BITEM = { pierce:'뚫는 구슬', scope:'긴 조준선', lift:'한 줄 올리기' };

/* 솔로 스테이지 N 설정. 오늘의 문제는 LEVELS의 like(비슷한 스테이지)와 rows로 만든다 */
function ballStageCfg(n){
  const sp = Object.keys(BSP_AT).filter(k => n >= BSP_AT[k]), ev = Object.keys(BEV_AT).filter(k => n >= BEV_AT[k]);
  return { n, rows: Math.min(36, 7 + Math.floor(n * 0.45)),
    minN: Math.min(5, 3 + Math.floor(n / 24)), maxN: Math.min(6, 4 + Math.floor(n / 9)),
    hpMul: Math.min(1.5, 0.82 + n * 0.015), dbl: n >= 24 ? Math.min(0.12, (n - 20) * 0.005) : 0,
    bump: Math.min(0.2, 0.05 + (n - 1) * 0.0052), sp, intro: sp.find(k => BSP_AT[k] === n) || null,
    ev, evIntro: ev.find(k => BEV_AT[k] === n) || null,
    star2: Math.max(0, 0.34 - n * 0.02), start: n >= 45 ? 5 : n >= 22 ? 4 : 3, limit: 0 };
}
/* 오늘의 문제·연습 판(봇 tools/star-ball-bot.js도 이 표를 그대로 읽음): like = 비슷한 솔로 스테이지, evN = 이벤트 블록 1~2개 */
const BLEVELS = { easy:{ rows:10, like:5, limit:0, evN:[1,2] }, normal:{ rows:14, like:12, limit:0, evN:[1,2], hpAdd:1 }, hard:{ rows:18, like:22, limit:0, evN:[1,2] } };
/* 대전 판: 고정 7줄(내려오지 않음·새 줄 없음·방어막 없음), 구슬 5개, 이벤트 블록 3개, 3분. 문제 내용은 init의 rng로만 */
function ballDuelCfg(){ return { rows:7, like:12, fixed:true, start:5, evN:3, limit:180, hpAdd:6 }; }
/* 별: ★ 클리어 · ★★ 기준 턴+6 이내 · ★★★ 기준 턴+3 이내 그리고 방어막을 지킴 */
function ballStars(turn, R, shieldOk){ return turn <= R + 3 && shieldOk ? 3 : turn <= R + 6 ? 2 : 1; }

function genBall(rng, cfg){
  if(cfg.like){ const o = cfg; cfg = Object.assign(ballStageCfg(o.like), { rows:o.rows, intro:null, ev:[], evIntro:null });
    for(const k of ['fixed', 'evN', 'limit', 'hpAdd']) if(o[k] != null) cfg[k] = o[k];
    if(o.start) cfg.start = o.start; }
  const rows = [], sp = cfg.sp || []; let total = 0, top = 1;
  for(let k=0;k<cfg.rows;k++){
    const t = k + 1, cols = shuffle([...Array(BC).keys()], rng);
    const n = cfg.minN + Math.floor(rng()*(cfg.maxN - cfg.minN + 1));
    const row = new Array(BC).fill(null);
    for(let j=0;j<n;j++){
      let hp = Math.max(1, Math.round((t + 1 + (cfg.hpAdd || 0)) * cfg.hpMul * (0.7 + 0.6*rng())));
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
  /* 이벤트 블록: 줄을 다 만든 뒤에 같은 rng로 고름(이벤트가 없는 판은 예전과 똑같은 판) */
  const plain = k => rows[k].map((c, i) => c && c.t === 'sq' && !c.sp && !c.ev ? i : -1).filter(i => i >= 0);
  const evN = Array.isArray(cfg.evN) ? cfg.evN[0] + Math.floor(rng() * (cfg.evN[1] - cfg.evN[0] + 1)) : (cfg.evN || 0);
  const kinds = Object.keys(BEV_AT);
  for(let i=0, tries=0;i<evN && tries<60;tries++){   /* 오늘의 문제·대전: 개수만큼 씨앗으로 같은 자리 */
    const k = Math.floor(rng() * rows.length), cs = plain(k); if(!cs.length) continue;
    rows[k][cs[Math.floor(rng() * cs.length)]].ev = kinds[(i + Math.floor(rng() * kinds.length)) % kinds.length]; i++;
  }
  if(!evN && cfg.ev && cfg.ev.length){   /* 솔로 15판부터: 줄마다 9% */
    for(let k=1;k<rows.length;k++){ if(rng() >= BEV_P) continue; const cs = plain(k); if(!cs.length) continue;
      rows[k][cs[Math.floor(rng() * cs.length)]].ev = cfg.evIntro && rng() < 0.5 ? cfg.evIntro : cfg.ev[Math.floor(rng() * cfg.ev.length)]; }
    if(cfg.evIntro && !rows.some(r => r.some(c => c && c.ev === cfg.evIntro))){
      for(let k=1;k<rows.length;k++){ const cs = plain(k); if(cs.length){ rows[k][cs[0]].ev = cfg.evIntro; break; } }
    }
  }
  /* 미리 채운 줄만큼 새 줄이 일찍 끝나므로 기준 턴도 그만큼 줄임 */
  const pre = cfg.fixed ? cfg.rows : Math.min(BPRE, cfg.rows);
  return { rows, R: cfg.fixed ? cfg.rows + 1 : cfg.rows - (pre - 1), start: cfg.start, total, top, intro: cfg.intro, evIntro: cfg.evIntro || null,
    pre, fixed: !!cfg.fixed, limit: cfg.limit || 0 };
}
function ballInit(p){
  Object.assign(G, { rows:p.rows, R:p.R, rowsN:p.rows.length, total:p.total, hpTop:p.top, intro:p.intro, evIntro:p.evIntro, fixed:p.fixed, next:0, uid:0,
    gridB:Array.from({length:BR}, () => new Array(BC).fill(null)),
    balls:p.start || 3, gained:0, sx:BW/2, phase:'aim', turn:0, broken:0, fly:[], sparks:[], toLaunch:0, launchT:0, speed:1, boost:1, acc:0, simT:0, allOutAt:null,
    aim:null, aiming:false, lastAim:Math.PI/2, firstLand:null, shield:p.fixed ? 0 : 1, itemUsed:0, items:{ pierce:1, scope:1, lift:p.fixed ? 0 : 1 }, pierce:false, scope:false, pierceShot:false,
    freeze:false, won:false, slide:0, slideDir:1, fx:[], rings:[], txts:[], flash:0, flashC:'255,255,255', ffT:0, shake:0, turnHits:0, turnBreaks:0, tickA:null,
    guide:null, gKey:'', gVer:0, raf:0, lt:0, shootT:0, banner:null, bolts:[] });
  if(p.fixed && p.limit) G.limit = p.limit;
  /* 시작할 때 위 4줄(대전은 7줄 전부)을 미리 채움: 먼저 만든 줄이 아래 */
  for(let i=0;i<p.pre;i++){ if(i) ballShift(1); ballSpawn(); }
}
function ballCell(c){
  if(!c) return null;
  if(c.star) return { star:true, id:++G.uid };
  return { id:++G.uid, hp:c.hp, max:c.hp, t:c.t, sp:c.sp, band:ballBand(c.hp), hit:0, ping:0, ev:c.ev || null, evT:c.ev ? BEV_TURNS : 0, evFade:0 };
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
  fast:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.2v11.6a1 1 0 0 0 1.6.8L12 13v4.8a1 1 0 0 0 1.6.8l7.6-5.8a1 1 0 0 0 0-1.6l-7.6-5.8a1 1 0 0 0-1.6.8V11L4.6 5.4A1 1 0 0 0 3 6.2z"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10v-6z" fill="currentColor" stroke="#2A1650" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.5l1.3 2.8 3 .4-2.2 2.1.6 3L12 13.3l-2.7 1.5.6-3-2.2-2.1 3-.4z" fill="#fff"/></svg>',
  /* 뚫는 구슬(화살이 블록을 뚫음) · 긴 조준선(점선) · 한 줄 올리기(위 화살) */
  pierce:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="7.5" width="8" height="9" rx="2" opacity=".5"/><path d="M2.5 12h18M16.5 8l4 4-4 4"/></svg>',
  scope:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="20" r="2.2"/><circle cx="8.5" cy="15.5" r="1.8"/><circle cx="12.5" cy="11.5" r="1.8"/><circle cx="16.5" cy="7.5" r="1.8"/><circle cx="20.3" cy="3.7" r="1.8"/></svg>',
  lift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V4M5.5 10.5L12 4l6.5 6.5"/></svg>',
  left:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 4.5v15a1 1 0 0 1-1.6.8l-9.4-7.5a1 1 0 0 1 0-1.6l9.4-7.5a1 1 0 0 1 1.6.8z"/></svg>',
  right:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 4.5v15a1 1 0 0 0 1.6.8l9.4-7.5a1 1 0 0 0 0-1.6L10.1 3.7a1 1 0 0 0-1.6.8z"/></svg>'
};
function ballHud(){
  if(!G || G.id !== 'ball') return;
  const s = (id, v) => { const e = $(id); if(e) e.textContent = v; };
  s('#bline', G.fixed ? ballTimeLeft() : Math.max(0, G.rowsN - G.next)); s('#bscore', G.broken + '/' + G.total); s('#bballs', '×' + (G.balls + (G.phase === 'aim' ? 0 : G.gained)));
  const sh = $('#bShield'); if(sh){ sh.classList.toggle('off', !G.shield); sh.firstElementChild.classList.toggle('off', !G.shield); sh.setAttribute('aria-label', G.shield ? '별빛 방어막 있음' : '별빛 방어막 깨짐'); }
  const fs = $('#bFast'); if(fs){ const v = Math.max(G.speed, G.phase === 'shoot' ? G.boost : 1); fs.classList.toggle('on', v > 1); fs.setAttribute('aria-pressed', v > 1); }
  const aim = G.phase === 'aim' && !G.over && !G.slide && !G.won;
  const it = (id, key, dis) => { const b = $(id); if(!b) return; b.disabled = dis; b.classList.toggle('on', !!G[key]); b.querySelector('i').textContent = G.items[key] > 0 ? '×' + G.items[key] : '씀'; };
  it('#bIPierce', 'pierce', !aim || (G.items.pierce < 1 && !G.pierce));
  it('#bIScope', 'scope', !aim || (G.items.scope < 1 && !G.scope));
  it('#bILift', 'lift', !aim || G.items.lift < 1 || G.gridB[0].some(c => c));
  ['#bLeft', '#bRight'].forEach(q => { const b = $(q); if(b) b.disabled = !aim; });
  /* 발사 버튼: 날아가는 동안엔 [모두 거두기](다 쏜 뒤 1.5초부터) */
  const go = $('#bGo'), rc = ballCanRecall();
  if(go){ go.disabled = !(aim || rc); go.lastChild.textContent = G.phase === 'shoot' ? (rc ? '모두 거두기' : '날아가는 중') : '발사'; go.classList.toggle('recall', rc); }
  const dg = $('#sbRoot'); if(dg) dg.classList.toggle('danger', !G.fixed && ballRowHas(BR-2));
}
/* 대전 남은 시간 글자(m:ss) */
function ballTimeLeft(){ const t = Math.max(0, Math.ceil((G.limit || 0) - (typeof elapsed === 'function' ? elapsed() : 0))); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
const ballCanRecall = () => G.phase === 'shoot' && !G.over && !G.won && G.allOutAt != null && G.shootT - G.allOutAt >= 1.5;
/* 모두 거두기: 날고 있는 구슬·불꽃을 바로 바닥으로. 다음 발사 자리는 같은 규칙(먼저 떨어진 구슬, 없으면 맨 먼저 쏜 날고 있는 구슬) */
function ballRecall(){
  if(!ballCanRecall()) return;
  if(G.firstLand == null){ const b = G.fly.find(b => b.on); if(b) G.firstLand = Math.max(BRAD, Math.min(BW - BRAD, b.x)); }
  if(!G.sim){ for(const b of G.fly) if(b.on && Math.random() < .5) G.fx.push(ballPiece(b.x, b.y, 0, 300, '#FFF4C8', .3, 1)); sfx('bLand', { pan:0 }); }
  G.sparks = []; G.fly = []; ballEndTurn();
}
function ballStage(st){
  st.innerHTML = `<div class="sb" id="sbRoot">
    <div class="hud-row sb-hud">
      <span class="hchip"><span class="hv"><b id="bscore">0</b></span><em>깬 블록</em></span>
      <span class="hchip${G.fixed ? ' time' : ''}"><span class="hv"><b id="bline">0</b></span><em>${G.fixed ? '남은 시간' : '남은 줄'}</em></span>
      <span class="hchip"><span class="hv"><b id="bballs">×0</b></span><em>구슬</em></span>
      ${G.fixed ? '' : `<span class="hchip"><span class="hv"><span class="hlives sb-sh" id="bShield" role="img"><i>★</i></span></span><em>방어막</em></span>`}
      <button class="hpause" id="bPause" aria-label="일시정지">${BICO.pause}</button>
    </div>
    <div class="sb-board"><canvas class="sb-cv" id="bcv" aria-label="별빛 구슬 판"></canvas></div>
    <div class="bfoot">
      <div class="tools-row sb-items">
        <button class="tool item sb-it it-pierce" id="bIPierce" aria-label="뚫는 구슬: 이번 턴 구슬이 블록을 뚫고 지나가며 1씩 깎아요">${BICO.pierce}<span>뚫는 구슬</span><i class="cnt">×1</i></button>
        <button class="tool item sb-it it-scope" id="bIScope" aria-label="긴 조준선: 이번 턴 조준선이 두 번 튕긴 곳까지 보여요">${BICO.scope}<span>긴 조준선</span><i class="cnt">×1</i></button>
        ${G.fixed ? '' : `<button class="tool item sb-it it-lift" id="bILift" aria-label="한 줄 올리기: 모든 블록을 한 줄 위로">${BICO.lift}<span>한 줄 올리기</span><i class="cnt">×1</i></button>`}
        <button class="tool toggle sb-ff" id="bFast" aria-label="빠르게 보기" aria-pressed="false">${BICO.fast}<span>빠르게 보기</span></button>
      </div>
      <div class="sb-aim">
        <button class="sb-arr" id="bLeft" aria-label="조준 왼쪽으로 조금">${BICO.left}</button>
        <button class="btn primary sb-go" id="bGo">발사</button>
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
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * BH / BW * dpr); G.scale = cv.width / BW; G.bgKey = ''; G.cssU = BW / w;   /* 화면 1px = 논리 cssU */
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
  /* ◀ ▶(64×56): 한 번 누르면 1.5°, 0.3초 넘게 누르고 있으면 0.1초마다 1.5° → 4°까지 빨라짐 */
  const nudge = (d, deg) => { if(!canAim()) return false; G.lastAim = Math.max(BAIM_MIN, Math.min(BAIM_MAX, G.lastAim + d * (deg || 1.5) * Math.PI / 180)); ballAimTick(true); return true; };
  const hold = (el, d) => {
    let t0 = 0;
    const stop = () => { clearTimeout(t0); clearInterval(G.rep); el.classList.remove('press'); };
    el.onpointerdown = e => { e.preventDefault(); if(!nudge(d)) return; el.classList.add('press'); try{ el.setPointerCapture(e.pointerId); }catch(_){}
      clearTimeout(t0); clearInterval(G.rep); t0 = setTimeout(() => { let k = 0; G.rep = setInterval(() => { if(!nudge(d, Math.min(4, 1.5 + 0.5 * k++))) stop(); }, 100); }, 300); };
    el.onpointerup = stop; el.onpointercancel = stop; el.onlostpointercapture = stop;
    el.onclick = e => { if(e.detail === 0) nudge(d); };   /* 키보드로 누를 때 */
  };
  hold($('#bLeft'), 1); hold($('#bRight'), -1);
  $('#bGo').onclick = () => { if(canAim()) ballFire(G.lastAim); else if(ballCanRecall()) ballRecall(); };
  $('#bFast').onclick = () => { G.speed = G.speed >= 2 ? 1 : 2; if(G.speed === 1) G.boost = 1; ballHud(); sfx(G.speed > 1 ? 'bFast' : 'toggle', { on:false }); };
  $('#bIPierce').onclick = () => ballItem('pierce'); $('#bIScope').onclick = () => ballItem('scope'); if($('#bILift')) $('#bILift').onclick = ballLift;
  try{ G.tip = !store.get('hp:ballTip', 0); }catch(_){ G.tip = false; }   /* 판 안 안내 문장: 처음 1번만 */
  $('#bPause').onclick = ballPause;
  const root = st.querySelector('.sb');
  ['selectstart','contextmenu','dragstart'].forEach(ev => root.addEventListener(ev, e => e.preventDefault()));
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
  if(G.intro && G.adv){ const [nm, tx] = BSP_INFO[G.intro]; G.banner = { t:0, dur:4.2, a:'새 블록: ' + nm, b:tx, sp:G.intro }; }
  else if(G.evIntro && G.adv){ const [nm, tx] = BEV_INFO[G.evIntro]; G.banner = { t:0, dur:4.2, a:'이벤트 블록: ' + nm, b:tx, ev:G.evIntro }; }
  ballHud();
  const loop = ts => {
    if(G !== me) return;
    const dt = me.lt ? Math.min(0.05, (ts - me.lt) / 1000) : 0; me.lt = ts;   /* 느린 폰(20fps)도 제 속도. 결과는 고정 단계라 같음 */
    if(!me.over && !me.paused) ballUpdate(dt);
    if(me.fixed && me.limit && me.duel && !me.over) ballClock();   /* 대전 뒤 계속 풀기(G.duel 없음)는 시간 제한 없음 */
    ballDraw();
    if(!me.over) me.raf = requestAnimationFrame(loop);
  };
  me.raf = requestAnimationFrame(loop);
}
/* 대전 시계: 남은 시간 칩을 1초마다 고치고, 시간이 다 되면 멈춤(깬 블록 수로 판정) */
function ballClock(){
  const left = ballTimeLeft();
  if(left !== G.clockTxt){ G.clockTxt = left; const e = $('#bline'); if(e) e.textContent = left; }
  if(elapsed() >= G.limit && !G.won && !G.over){ G.timeUp = true; finish(false); }
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
  if(G[k]) G.txts.push({ x:BW/2, y:BFLOOR*0.55, text:k === 'pierce' ? '이번 턴 뚫는 구슬' : '긴 조준선: 두 번 튕긴 곳까지', t:0, dur:1.3 });
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
  G.turnHits = 0; G.turnBreaks = 0; G.tickA = null; G.gained = 0;
  if(G.tip){ G.tip = false; try{ store.set('hp:ballTip', 1); }catch(_){} }
  sfx('bFire'); fxBuzz(10);
  G.turn++; G.phase = 'shoot'; G.toLaunch = G.balls; G.launchT = 0; G.firstLand = null; G.shootT = 0; G.boost = 1; G.acc = 0; G.simT = 0; G.allOutAt = null;
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
  G.fly = []; G.sparks = []; G.phase = 'aim'; G.boost = 1; G.pierceShot = false; G.gKey = ''; G.allOutAt = null;
  if(!G.sim) ballCombo(G.turnBreaks);
  /* 이벤트 블록: 판에 나온 뒤 3턴이 지나면 보통 블록으로 */
  for(const row of G.gridB) for(const c of row) if(c && c.ev && --c.evT <= 0){ c.ev = null; c.evFade = .3; }
  if(G.won || ballCleared()){ ballWin(); ballHud(); return; }
  if(G.fixed){ ballHud(); return; }   /* 대전 고정 판: 내려오지 않고 새 줄도 없음 */
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
    if(G.shield){ G.phase = 'wait'; const me = G; ballAfter(.25, () => { if(G === me && !me.over) ballGuard(); }); }
    else {
      G.phase = 'end'; fxBuzz([80, 40, 120]); sfx('bAlarm'); G.shake = 14; G.flash = .6; G.flashC = '255,120,150';
      const me = G; ballAfter(.8, () => { if(G === me && !me.over) finish(false); });
    }
  } else if(ballRowHas(BR-2)) ballAfter(.3, () => sfx('bDanger'));
  ballHud();
}
/* 한 턴에 많이 깼을 때: 6개 이상 "와르르 N개!", 10개 이상 아주 약한 흔들림(흔들림 끄기 설정을 따름). 보이기만 함 */
function ballCombo(n){
  if(n < 6) return;
  try{
    const rc = G.cv.getBoundingClientRect();
    fxFloat(rc.left + rc.width / 2, rc.top + rc.height * .4, '와르르 ' + n + '개!', 'sb-combo');
    if(n >= 10) fxShake(G.cv, 2);
  }catch(_){}
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
  cell.hp -= 1; cell.hit = .12; G.turnHits++;
  if(cell.hp <= 0) ballKill(r, c);
  else { sfx('bHit', { n:G.turnHits, pan }); if(!G.sim && G.txts.length < 18) G.txts.push({ x:x + 22, y:r*BS + 18, text:'−1', t:0, dur:.45, small:true }); }
}
/* 블록 깨짐(특수 블록 효과 포함) */
function ballKill(r, c){
  const cell = G.gridB[r] && G.gridB[r][c]; if(!cell || cell.star) return;
  G.gridB[r][c] = null; G.broken++; G.gVer++; G.turnBreaks++;
  const x = c*BS + BS/2, y = r*BS + BS/2, pan = panC(x, BW), col = BPAL[cell.band];
  if(!G.sim){   /* 파편 6~10개(블록 색). 보이기만 함 */
    const n = FXR.reduce ? 6 : 6 + Math.floor(Math.random() * 5);
    for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, s = 200 + Math.random()*380; G.fx.push(ballPiece(x, y, Math.cos(a)*s, Math.sin(a)*s - 220, i % 3 ? col[0] : col[1], .45 + Math.random()*.25)); }
  }
  sfx('bBreak', { n:G.turnBreaks * 5, pan });   /* 깰수록 높아지는 톡·톡·톡 */
  if(cell.ev) ballEvent(r, c, cell, x, y, pan);
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
/* 이벤트 블록 효과(규칙은 여기, 꾸밈은 G.sim이 아닐 때만) */
function ballEvent(r, c, cell, x, y, pan){
  const ev = cell.ev, vis = !G.sim;
  if(ev === 'meteor'){   /* 별똥별: 구슬 +2(그 판 동안 유지) */
    G.gained += 2;
    if(vis){ for(let i=0;i<6;i++) G.fx.push(ballPiece(x, y, (G.sx - x) * 1.6 + (Math.random() - .5) * 120, (BFLOOR - y) * 1.6 - 300, i % 2 ? '#FFE27A' : '#FFFFFF', .6, 1)); G.txts.push({ x, y:y - 10, text:'구슬 +2', t:0, dur:1 }); sfx('bRing', { pan }); }
  } else if(ev === 'bolt'){   /* 번개: 같은 가로줄 블록 체력 −2 */
    const dead = [];
    G.gridB[r].forEach((o, cc) => { if(!o || o.star || o.hp <= 0) return; o.hp -= 2; o.hit = .12; if(o.hp <= 0) dead.push(cc); });
    if(vis){ G.bolts.push({ y, t:0, dur:.2 }); G.txts.push({ x, y:y - 10, text:'번개 −2', t:0, dur:.9 }); sfx('bSpark', { pan }); }
    dead.forEach(cc => ballKill(r, cc));
  } else if(ev === 'chest'){   /* 보물 상자: 셋 중 가장 적은 아이템 +1 */
    const ks = Object.keys(G.items).filter(k => !(G.fixed && k === 'lift'));
    const k = ks.reduce((a, b) => G.items[b] < G.items[a] ? b : a, ks[0]); G.items[k]++;
    if(vis){ G.txts.push({ x, y:y - 10, text:BITEM[k] + ' +1', t:0, dur:1.2 }); sfx('bItem'); }
  } else if(ev === 'magnet'){   /* 자석: 판의 별 조각을 모두 모음 */
    let n = 0;
    for(let rr=0;rr<BR;rr++) for(let cc=0;cc<BC;cc++){ const o = G.gridB[rr][cc]; if(o && o.star){ G.gridB[rr][cc] = null; n++;
      if(vis) G.fx.push(ballPiece(cc*BS + BS/2, rr*BS + BS/2, (x - cc*BS - BS/2) * 2.4, (y - rr*BS - BS/2) * 2.4 - 200, '#FFE27A', .45, 1)); } }
    G.gained += n; G.gVer++;
    if(vis){ G.txts.push({ x, y:y - 10, text:'별 조각 +' + n, t:0, dur:1 }); sfx('bRing', { pan }); }
  }
}
const ballRgb = h =>[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
/* 색종이 조각(pastel). round=1 이면 동그란 빛 */
function ballPiece(x, y, vx, vy, c, t, round){ return { x, y, vx, vy, t, t0:t, c, s:10 + Math.random()*10, rot:Math.random()*6, vr:(Math.random() - .5) * 14, round }; }
/* 한 걸음 이동(벽·블록). 공 = 발사한 구슬, 불꽃 = 폭죽 구슬 */
function ballMove(b, h){
  b.x += b.vx*h; b.y += b.vy*h;
  ballWalls(b); ballCollide(b, false);
}
function ballUpdate(dt){
  if(G.slide > 0){ G.slide = Math.max(0, G.slide - dt / BSLIDE); if(!G.slide) ballHud(); }
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
  for(const x of G.bolts) x.t += dt; if(G.bolts.length) G.bolts = G.bolts.filter(x => x.t < x.dur);
  for(const row of G.gridB) for(const c of row) if(c && c.evFade) c.evFade = Math.max(0, c.evFade - dt);
  if(G.phase !== 'shoot') return;
  /* 빠르게: 2초 넘게 날면 ×2, 4초 넘으면 ×4(화면 시간). 빠르기는 '한 프레임에 몇 단계'만 바꾸고 결과는 그대로 */
  G.shootT += dt;
  if(G.boost < 2 && G.shootT >= 2){ G.boost = 2; G.ffT = 1.1; if(!G.sim) sfx('bFast'); ballHud(); }
  else if(G.boost < 4 && G.shootT >= 4){ G.boost = 4; G.ffT = 1.1; ballHud(); }
  if(G.allOutAt == null && G.toLaunch === 0) G.allOutAt = G.shootT;
  const rc = ballCanRecall(); if(rc !== !!G.rcOn){ G.rcOn = rc; ballHud(); }
  /* 고정 단계 물리: 프레임 길이와 상관없이 1/240초씩 같은 순서로 계산(30·60·120fps 같은 결과) */
  G.acc += dt * Math.max(G.speed, G.boost);
  for(let n=0; G.acc >= BSTEP - 1e-9 && G.phase === 'shoot' && n < 600; n++){ G.acc -= BSTEP; ballStep(BSTEP); }
}
/* 물리 한 단계(h = BSTEP). 판 결과에 영향을 주는 계산은 모두 여기서만 */
function ballStep(h){
  G.simT += h;
  G.launchT -= h;
  while(G.toLaunch > 0 && G.launchT <= 1e-9){
    G.fly.push({ x:G.sx, y:BFLOOR - BRAD - 1, vx:G.vx, vy:G.vy, r:BRAD, on:true, pierce:G.pierceShot, in:[] });
    if(!G.sim) sfx('bShot', { pan:panC(G.sx, BW) });
    G.toLaunch--; G.launchT += BGAP; ballHud();
  }
  const late = G.simT > 10, hs = h / BSUB;   /* 아주 오래 날면 살짝 아래로 끌어당겨 턴이 끝나게 */
  for(let s=0;s<BSUB;s++){
    for(const b of G.fly){
      if(!b.on) continue;
      if(late) b.vy += 3600*hs;
      ballMove(b, hs);
      if(b.vy > 0 && b.y >= BFLOOR - BRAD){
        b.on = false; b.y = BFLOOR - BRAD;
        if(G.firstLand == null){ G.firstLand = Math.max(BRAD, Math.min(BW - BRAD, b.x)); if(!G.sim){ sfx('bLand', { pan:panC(b.x, BW) }); G.rings.push({ x:G.firstLand, y:BFLOOR - BRAD, t:0, dur:.25, r:44, c:'255,236,170' }); } }
        else b.roll = true;
      }
    }
    for(const p of G.sparks){
      p.vy += 2800*hs; ballMove(p, hs);
      if(p.vy > 0 && p.y >= BFLOOR - p.r){ p.dead = true; if(!G.sim) G.fx.push(ballPiece(p.x, BFLOOR - 6, 0, -180, '#FFD36B', .35, 1)); }
    }
    if(G.sparks.length && G.sparks.some(p => p.dead)) G.sparks = G.sparks.filter(p => !p.dead);
  }
  if(G.fly.length > 60 && !G.toLaunch) G.fly = G.fly.filter(b => b.on || b.roll);
  for(const b of G.fly){
    if(!b.roll) continue;
    const d = G.firstLand - b.x, st = 4800 * h;
    if(Math.abs(d) <= st){ b.x = G.firstLand; b.roll = false; b.on = false; } else b.x += Math.sign(d) * st;
  }
  if(G.toLaunch === 0 && !G.sparks.length && !G.fly.some(b => b.on || b.roll)) ballEndTurn();
}
/* 조준선: 유령 구슬을 같은 물리로 굴려 튕긴 점을 모음. 보통은 첫 튕김까지, 망원경은 두 번 튕긴 뒤 다음 닿는 곳까지 */
function ballGuide(a, bounces){
  const b = { x:G.sx, y:BFLOOR - BRAD - 1, vx:Math.cos(a) * BSPD, vy:-Math.sin(a) * BSPD, r:BRAD, pierce:G.pierce, in:[] };
  const pts = [[b.x, b.y]], h = BSTEP / BSUB; let n = 0;   /* 실제 물리와 같은 걸음 */
  for(let i=0;i<5000;i++){
    b.x += b.vx*h; b.y += b.vy*h;
    const k = ballWalls(b) | ballCollide(b, true);
    if(k){ pts.push([b.x, b.y]); if(++n > bounces) break; }
    if(b.vy > 0 && b.y >= BFLOOR - BRAD){ pts.push([b.x, BFLOOR - BRAD]); break; }
  }
  return pts;
}

/* ---- 그리기 ---- */
/* 2026-10-06 눈 편한 화면(디자인팀 11-4): 광택·그라데이션·그림자 없음, 판 안 단색, 계속 움직이는 효과 없음(이벤트 금 테두리만 천천히) */
const BSPR = {};
function ballPath(x, t){
  x.beginPath();
  if(t === 'bump') x.arc(BS/2, BS/2, BBUMP, 0, Math.PI*2);
  else { const a = BPAD, w = BS - 2*BPAD, r = BRR; x.moveTo(a + r, a); x.arcTo(a + w, a, a + w, a + w, r); x.arcTo(a + w, a + w, a, a + w, r); x.arcTo(a, a + w, a, a, r); x.arcTo(a, a, a + w, a, r); x.closePath(); }
}
/* 블록 이미지: 단색 + 테두리 #1A0F45. 범퍼(원)는 굵은 점선 테두리로만 구분. 색·모양·특수별로 한 번만 그려 재사용 */
function ballSprite(t, band, sp){
  const sc = G.scale || 1, key = 'v2' + t + band + (sp || '') + '@' + sc.toFixed(3);
  if(BSPR[key]) return BSPR[key];
  const M = 10, size = BS + 2*M, cv = document.createElement('canvas');
  cv.width = Math.ceil(size * sc); cv.height = cv.width;
  const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(M, M);
  ballPath(x, t); x.fillStyle = BPAL[band][0]; x.fill();
  x.lineJoin = 'round'; x.strokeStyle = BOUT;
  if(t === 'bump'){ x.lineWidth = 7.5; x.setLineDash([13, 8]); } else x.lineWidth = 5.6;
  ballPath(x, t); x.stroke(); x.setLineDash([]);
  const badge = (fn, bg) => { const bx = BS - BPAD - 13, by = BPAD + 13; x.beginPath(); x.arc(bx, by, 14, 0, Math.PI*2); x.fillStyle = bg; x.fill(); x.lineWidth = 3.5; x.strokeStyle = BOUT; x.stroke(); x.save(); x.translate(bx, by); fn(); x.restore(); };
  if(sp === 'shield'){   /* 아래 면에 굵은 방패 막대 */
    const y0 = BS - BPAD - 17, a = BPAD + 7, w = BS - 2*BPAD - 14;
    x.beginPath(); x.roundRect ? x.roundRect(a, y0, w, 15, 6) : x.rect(a, y0, w, 15); x.fillStyle = '#7C88C4'; x.fill(); x.lineWidth = 3.5; x.strokeStyle = BOUT; x.stroke();
    for(const px of [a + 10, a + w - 10]){ x.beginPath(); x.arc(px, y0 + 7.5, 2.4, 0, Math.PI*2); x.fillStyle = BOUT; x.fill(); }
  } else if(sp === 'clock') badge(() => { x.strokeStyle = BOUT; x.lineWidth = 2.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -8); x.moveTo(0, 0); x.lineTo(6, 3); x.stroke(); }, '#FFFFFF');
  else if(sp === 'paint') badge(() => { [['#E88AA8',-5,-3],['#8EC5EA',5,-3],['#F0D27A',0,5]].forEach(([c2, px, py]) => { x.beginPath(); x.arc(px, py, 4.6, 0, Math.PI*2); x.fillStyle = c2; x.fill(); }); }, '#FFFFFF');
  else if(sp === 'fire') badge(() => { x.fillStyle = '#FFE27A'; x.beginPath(); for(let i=0;i<10;i++){ const a = i / 10 * Math.PI*2 - Math.PI/2, r = i % 2 ? 4 : 10; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.closePath(); x.fill(); x.lineWidth = 2; x.strokeStyle = BOUT; x.stroke(); }, '#E9876A');
  BSPR[key] = cv; return cv;
}
/* 이벤트 블록 가운데 그림(약 48 논리 = 22px): 흰색 단색 + #1A0F45 선 */
function ballEvIcon(x, ev){
  x.save(); x.fillStyle = '#FFFFFF'; x.strokeStyle = BOUT; x.lineWidth = 3.4; x.lineJoin = 'round'; x.lineCap = 'round';
  if(ev === 'meteor'){
    x.beginPath(); x.moveTo(-4, 6); x.lineTo(-22, 22); x.moveTo(-10, 0); x.lineTo(-22, 12); x.moveTo(2, 10); x.lineTo(-10, 22); x.lineWidth = 4; x.strokeStyle = '#FFFFFF'; x.stroke();
    x.lineWidth = 3.4; x.strokeStyle = BOUT; ballStarPath(x, 6, -6, 17, 7.5); x.fill(); x.stroke();
  } else if(ev === 'bolt'){
    x.beginPath(); [[6,-24],[-12,2],[0,2],[-8,24],[14,-4],[2,-4],[10,-24]].forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.fill(); x.stroke();
  } else if(ev === 'chest'){
    x.beginPath(); x.moveTo(-20, -2); x.lineTo(-20, -8); x.quadraticCurveTo(-20, -20, 0, -20); x.quadraticCurveTo(20, -20, 20, -8); x.lineTo(20, -2); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.rect(-20, -2, 40, 22); x.fill(); x.stroke();
    x.beginPath(); x.rect(-5, -6, 10, 10); x.fillStyle = BOUT; x.fill();
  } else if(ev === 'magnet'){
    const U = () => { x.beginPath(); x.moveTo(-13, -20); x.lineTo(-13, 2); x.arc(0, 2, 13, Math.PI, 0, true); x.lineTo(13, -20); };
    x.lineWidth = 17; x.strokeStyle = BOUT; x.lineCap = 'butt'; U(); x.stroke();
    x.lineWidth = 10.5; x.strokeStyle = '#FFFFFF'; U(); x.stroke();
    x.fillStyle = BOUT; x.fillRect(-19, -14, 12, 2.6); x.fillRect(7, -14, 12, 2.6);
  }
  x.restore();
}
/* 이벤트 블록 꾸밈: 금 테두리 3px(1초 주기로 밝기 20% 이내) + 오른쪽 위 "!" 배지 + 왼쪽 아래 남은 턴 */
function ballEvDraw(ctx, cell, t, now){
  const k = cell.ev ? .85 + .15 * Math.sin(now * Math.PI * 2) : cell.evFade / .3;
  ctx.save(); ctx.translate(-BS/2, -BS/2);
  ctx.globalAlpha = k; ctx.strokeStyle = BGOLD; ctx.lineWidth = 7; ballPath(ctx, t); ctx.stroke(); ctx.globalAlpha = 1;
  if(cell.ev){
    ctx.save(); ctx.translate(BS/2, BS/2); ctx.globalAlpha = .62; ballEvIcon(ctx, cell.ev); ctx.restore();
    ctx.beginPath(); ctx.arc(BS - BPAD - 6, BPAD + 6, 15, 0, Math.PI*2); ctx.fillStyle = BGOLD; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BOUT; ctx.stroke();
    ctx.fillStyle = BOUT; ctx.font = '26px "Black Han Sans", Jua, sans-serif'; ctx.fillText('!', BS - BPAD - 6, BPAD + 7);
    ctx.beginPath(); ctx.arc(BPAD + 8, BS - BPAD - 8, 15, 0, Math.PI*2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = BOUT; ctx.font = '26px "Black Han Sans", Jua, sans-serif'; ctx.fillText(String(cell.evT), BPAD + 8, BS - BPAD - 7);
  }
  ctx.restore();
}
/* 판 바탕: 단색 #211A4A(움직이는 별은 판 바깥 배경에만). 크기별로 한 번만 */
function ballBg(){
  const key = G.cv.width + 'x' + G.cv.height;
  if(G.bgCv && G.bgKey === key) return G.bgCv;
  const cv = document.createElement('canvas'); cv.width = G.cv.width; cv.height = G.cv.height;
  const x = cv.getContext('2d'); x.scale(G.scale, G.scale);
  x.fillStyle = '#211A4A'; x.fillRect(0, 0, BW, BH);
  x.fillStyle = '#19133C'; x.fillRect(0, BFLOOR, BW, BH - BFLOOR);   /* 발사 자리 아래 땅 */
  G.bgCv = cv; G.bgKey = key; return cv;
}
/* 구슬: 흰색(뚫는 구슬은 연분홍 테두리). 빛 번짐 없음. 한 번만 그림 */
function ballOrb(pierce){
  const sc = G.scale || 1, key = 'orb2' + (pierce ? 1 : 0) + '@' + sc.toFixed(3);
  if(BSPR[key]) return BSPR[key];
  const r = BRAD, cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil((2*r + 4) * sc);
  const x = cv.getContext('2d'); x.scale(sc, sc);
  x.beginPath(); x.arc(r + 2, r + 2, r - 1.5, 0, Math.PI*2); x.fillStyle = '#FFFFFF'; x.fill();
  x.lineWidth = 3; x.strokeStyle = pierce ? '#F08A8A' : '#F3DC94'; x.stroke();
  BSPR[key] = cv; return cv;
}
function ballStarPath(ctx, x, y, R, r){ ctx.beginPath(); for(let i=0;i<10;i++){ const a = i / 10 * Math.PI*2 - Math.PI/2, k = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a)*k, y + Math.sin(a)*k); } ctx.closePath(); }
function ballDraw(){
  const ctx = G.ctx; if(!ctx) return;
  const now = performance.now() / 1000, U = G.cssU || 2.2;   /* U: 화면 1px의 논리 크기 */
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ballBg(), 0, 0);
  ctx.setTransform(G.scale, 0, 0, G.scale, 0, 0);
  if(G.shake > 0 && !FXR.reduce){ const k = G.shake; ctx.translate((Math.random()*2 - 1) * k, (Math.random()*2 - 1) * k); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  /* 바닥선 + 별빛 방어막 띠(움직이지 않음) */
  const danger = !G.fixed && ballRowHas(BR-2);
  if(G.shield){ ctx.fillStyle = 'rgba(150,225,255,.16)'; ctx.fillRect(0, BFLOOR - 22, BW, 22); }
  ctx.fillStyle = danger ? '#FF8FB0' : G.shield ? '#BFEFFF' : 'rgba(255,255,255,.5)';
  ctx.fillRect(0, BFLOOR, BW, 5);
  const ease = t => t*t*(3 - 2*t), slideY = G.slide > 0 ? -BS * ease(G.slide) * G.slideDir : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, BW, BFLOOR); ctx.clip(); ctx.translate(0, slideY);
  for(let r=0;r<BR;r++) for(let c=0;c<BC;c++){
    const cell = G.gridB[r][c]; if(!cell) continue;
    const cx = c*BS + BS/2, cy = r*BS + BS/2;
    if(r === 1 && G.slide > 0 && G.slideDir > 0 && cell.id > G.uid - BC) ctx.globalAlpha = 1 - G.slide;
    if(cell.star){   /* 별 조각(움직이지 않음) */
      ballStarPath(ctx, cx, cy, 21, 9.5); ctx.fillStyle = '#F6DA7A'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BOUT; ctx.stroke();
      ctx.globalAlpha = 1; continue;
    }
    const sq = cell.hit > 0 ? Math.sin(cell.hit / .12 * Math.PI) * .08 : 0, M = 10;   /* 맞을 때 0.12초 눌림 */
    ctx.save(); ctx.translate(cx, cy + (cell.t === 'bump' ? 0 : sq * 20)); ctx.scale(1 + sq, 1 - sq);
    ctx.drawImage(ballSprite(cell.t, cell.band, cell.sp), -BS/2 - M, -BS/2 - M, BS + 2*M, BS + 2*M);
    if(cell.ev || cell.evFade) ballEvDraw(ctx, cell, cell.t, now);
    if(cell.paint){ ctx.globalAlpha = cell.paint / .6 * .55; ctx.fillStyle = '#FFFFFF'; ctx.translate(-BS/2, -BS/2); ballPath(ctx, cell.t); ctx.fill(); ctx.translate(BS/2, BS/2); ctx.globalAlpha = 1; }
    if(cell.ping){ ctx.globalAlpha = cell.ping / .25; ctx.strokeStyle = '#E8F4FF'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-32, 40); ctx.lineTo(32, 40); ctx.stroke(); ctx.globalAlpha = 1; }
    /* 숫자: 흰 글자 + #1A0F45 외곽 2px, 20px */
    const s = String(cell.hp), fs = Math.round(20 * U * (s.length > 2 ? .8 : 1)), ny = cell.sp === 'shield' ? -6 : 2;
    ctx.font = fs + 'px "Black Han Sans", Jua, sans-serif';
    ctx.lineWidth = 4 * U; ctx.strokeStyle = BOUT; ctx.strokeText(s, 0, ny);
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(s, 0, ny);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  for(const b of G.bolts){ const k = b.t / b.dur; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, b.y - 4, BW * Math.min(1, k * 2.5), 8); ctx.globalAlpha = 1; }   /* 번개: 같은 줄로 흰 선 */
  ctx.restore();
  /* 조준선 */
  if(G.phase === 'aim' && !G.slide && !G.over){
    const a = G.aim != null ? G.aim : G.lastAim, bn = G.scope ? 2 : 0, key = a.toFixed(4) + ':' + bn + ':' + G.gVer + ':' + G.sx + ':' + G.pierce;
    if(G.gKey !== key){ G.guide = ballGuide(a, bn); G.gKey = key; }
    const P = G.guide, act = G.aim != null;
    ctx.fillStyle = G.scope ? 'rgba(170,230,255,.95)' : act ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)';
    let carry = 18, total = 0;
    for(let i=1;i<P.length;i++){
      const [x0, y0] = P[i-1], [x1, y1] = P[i], L = Math.hypot(x1 - x0, y1 - y0);
      let d = carry;
      while(d < L){ const k = d / L, rad = Math.max(2.4, 6 - total * .0035); ctx.beginPath(); ctx.arc(x0 + (x1 - x0)*k, y0 + (y1 - y0)*k, rad, 0, Math.PI*2); ctx.fill(); d += 30; total += 30; }
      carry = d - L;
    }
    const e = P[P.length - 1]; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e[0], e[1], BRAD, 0, Math.PI*2); ctx.stroke();
  }
  /* 구슬: 흰색 + 연노랑 짧은 꼬리 4px */
  const pierce = G.phase === 'aim' ? G.pierce : G.pierceShot;
  const orb = ballOrb(pierce), drawBall = (x, y, r) => ctx.drawImage(orb, x - r - 2, y - r - 2, 2*r + 4, 2*r + 4);
  ctx.lineCap = 'round'; ctx.strokeStyle = pierce ? 'rgba(255,170,170,.5)' : 'rgba(255,241,184,.5)'; ctx.lineWidth = 4 * U;
  for(const b of G.fly) if(b.on){ ctx.beginPath(); ctx.moveTo(b.x - b.vx * .007, b.y - b.vy * .007); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for(const b of G.fly) if(b.on || b.roll) drawBall(b.x, b.y, BRAD);
  for(const p of G.sparks){ ctx.strokeStyle = 'rgba(255,190,120,.5)'; ctx.lineWidth = p.r * 1.4; ctx.beginPath(); ctx.moveTo(p.x - p.vx * .012, p.y - p.vy * .012); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = '#FFE9A8'; ballStarPath(ctx, p.x, p.y, p.r + 4, p.r * .55); ctx.fill(); }
  const waiting = G.phase === 'aim' ? G.balls : G.toLaunch;
  if(G.phase === 'aim' || G.toLaunch > 0 || G.phase === 'wait' || G.phase === 'end') drawBall(G.sx, BFLOOR - BRAD, BRAD);
  else if(G.firstLand != null){ ctx.globalAlpha = .6; drawBall(G.firstLand, BFLOOR - BRAD, BRAD); ctx.globalAlpha = 1; }
  const right = G.sx > BW - 140, ly = BFLOOR - 42;
  if(waiting > 0){
    ctx.font = '30px "Black Han Sans", Jua, sans-serif'; ctx.textAlign = right ? 'right' : 'left';
    const lx = right ? G.sx - 24 : G.sx + 24;
    ctx.lineWidth = 6; ctx.strokeStyle = BOUT; ctx.strokeText('×' + waiting, lx, ly); ctx.fillStyle = '#FFF4C8'; ctx.fillText('×' + waiting, lx, ly); ctx.textAlign = 'center';
  }
  if(G.phase === 'aim' && !G.over){   /* 조준 각도 "63°"(14px), 구슬 수 반대쪽 */
    const deg = Math.round((G.aim != null ? G.aim : G.lastAim) * 180 / Math.PI);
    ctx.font = Math.round(14 * U) + 'px "Black Han Sans", Jua, sans-serif'; ctx.textAlign = right ? 'left' : 'right';
    const lx = right ? G.sx + 24 : G.sx - 24;
    ctx.lineWidth = 2.5 * U; ctx.strokeStyle = BOUT; ctx.strokeText(deg + '°', lx, ly); ctx.fillStyle = '#BFEFFF'; ctx.fillText(deg + '°', lx, ly); ctx.textAlign = 'center';
  }
  /* 파편·고리·글자 */
  for(const f of G.fx){ const k = Math.max(0, f.t / f.t0), sz = f.s * (.4 + .6 * k); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = f.c;
    if(f.round){ ctx.beginPath(); ctx.arc(f.x, f.y, sz * .5, 0, Math.PI*2); ctx.fill(); }
    else { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.beginPath(); ctx.moveTo(-sz/2, sz/3); ctx.lineTo(sz/2, sz/4); ctx.lineTo(-sz/6, -sz/2); ctx.closePath(); ctx.fill(); ctx.restore(); } }
  ctx.globalAlpha = 1;
  for(const g of G.rings){ if(g.t < 0) continue; const k = g.t / g.dur, e = 1 - Math.pow(1 - k, 3); ctx.globalAlpha = (1 - k) * .7; ctx.strokeStyle = `rgb(${g.c})`; ctx.lineWidth = 8 * (1 - k) + 2; ctx.beginPath(); ctx.arc(g.x, g.y, 10 + g.r * e, 0, Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for(const x of G.txts){ const k = x.t / x.dur, sc = x.small ? 1 : k < .15 ? .5 + k / .15 * .6 : k < .3 ? 1.1 - (k - .15) / .15 * .1 : 1;
    ctx.save(); ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; ctx.translate(x.x, x.y - k * (x.small ? 30 : 60)); ctx.scale(sc, sc);
    ctx.font = (x.big ? 44 : x.small ? 26 : 34) + 'px Jua, sans-serif'; ctx.lineWidth = x.small ? 6 : 9; ctx.strokeStyle = BOUT; ctx.strokeText(x.text, 0, 0); ctx.fillStyle = x.big ? '#FFE27A' : '#FFFFFF'; ctx.fillText(x.text, 0, 0); ctx.restore(); }
  ctx.globalAlpha = 1;
  if(G.flash > 0){ ctx.fillStyle = `rgba(${G.flashC},${Math.min(.35, G.flash * .5)})`; ctx.fillRect(0, 0, BW, BFLOOR); }
  if(G.ffT > 0){ const t = '⏩ ×' + Math.max(G.boost, G.speed) + ' 빠르게'; ctx.globalAlpha = Math.min(1, G.ffT * 2); ctx.font = '40px Jua, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = BOUT; ctx.strokeText(t, BW/2, 60); ctx.fillStyle = '#FFE27A'; ctx.fillText(t, BW/2, 60); ctx.globalAlpha = 1; }
  const bn = G.banner;
  if(bn){   /* 새 특수·이벤트 블록 안내 */
    const k = bn.t / bn.dur, al = k < .1 ? k / .1 : k > .85 ? (1 - k) / .15 : 1, y = BFLOOR * .62;
    ctx.globalAlpha = al; ctx.fillStyle = 'rgba(255,248,234,.96)'; ctx.strokeStyle = BOUT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, y - 80, BW - 80, 160, 26) : ctx.rect(40, y - 80, BW - 80, 160); ctx.fill(); ctx.stroke();
    ctx.drawImage(ballSprite('sq', 2, bn.sp), 60, y - 60, 120, 120);
    if(bn.ev){ ctx.save(); ctx.translate(120, y); ctx.scale(100 / 120, 100 / 120); ballEvDraw(ctx, { ev:bn.ev, evT:BEV_TURNS }, 'sq', 0); ctx.restore(); }
    ctx.textAlign = 'left'; ctx.fillStyle = BOUT; ctx.font = '38px Jua, sans-serif'; ctx.fillText(bn.a, 196, y - 26);
    ctx.fillStyle = '#5E4F78'; ctx.font = Math.round(13 * U) + 'px "Noto Sans KR", sans-serif'; ctx.fillText(bn.b, 196, y + 26); ctx.textAlign = 'center'; ctx.globalAlpha = 1;
  } else if(G.tip && G.phase === 'aim' && G.turn === 0 && G.aim == null){   /* 처음 1번만, 쏘면 사라짐 */
    ctx.font = Math.round(15 * U) + 'px Jua, sans-serif'; ctx.lineWidth = 7; ctx.strokeStyle = BOUT; ctx.fillStyle = '#FFFFFF';
    for(const [t, dy] of [['판을 누른 채 끌어서 조준하고', 0], ['손을 떼면 구슬이 날아가요', 44]]){ ctx.strokeText(t, BW/2, (BR-2)*BS + dy); ctx.fillText(t, BW/2, (BR-2)*BS + dy); }
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
  { at:18, key:'fire', name:'폭죽 블록', desc:'깨지면 불꽃 구슬 4개가 대각선으로 튀어 한 번 더 때려요.' },
  /* 이벤트 블록: 금 테두리 + "!" 배지, 3턴 안에 깨야 함(못 깨면 보통 블록) */
  { at:15, key:'meteor', name:'별똥별 블록', desc:'금 테두리 이벤트 블록이에요. 3턴 안에 깨면 구슬이 2개 늘어요.' },
  { at:25, key:'bolt', name:'번개 블록', desc:'3턴 안에 깨면 같은 가로줄 블록 체력이 모두 2씩 줄어요.' },
  { at:35, key:'chest', name:'보물 상자 블록', desc:'3턴 안에 깨면 가장 적은 아이템이 1개 생겨요.' },
  { at:45, key:'magnet', name:'자석 블록', desc:'3턴 안에 깨면 판의 별 조각을 모두 모아 구슬이 늘어요.' }] };


/* ===================== 게임 정의(엔진이 이 게임을 부르는 창구) =====================
   이름·색·도움말·썸네일·챕터·난이도·시작·점수·별을 엔진(core/engine.js)에 알려 준다. 규칙은 games/CLAUDE.md의 '게임 정의 계약' 참고. */
NG.ball = {
  name:'별빛 구슬', col:['#D9A2FF','#9B44E8','#4E1683'], time:'약 3분', abil:'공간지각',
  icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="3" width="5.5" height="5" rx="1.4"/><rect x="9.25" y="3" width="5.5" height="5" rx="1.4" opacity=".55"/><rect x="16" y="3" width="5.5" height="5" rx="1.4"/><circle cx="12" cy="16" r="4.6"/></svg>',
  art(){
    const pal = BPAL.map(p => p[0]);
    const cells = [[0,0,3,2],[1,0,5,3],[3,0,9,4],[4,0,4,2],[0,1,2,1],[2,1,6,'b'],[5,1,3,1],[1,2,1,0],[4,2,2,0]];
    let g = '', stars = '';
    for(let k=0;k<22;k++) stars += `<circle cx="${(k * 37) % 160}" cy="${(k * 23) % 96}" r="${k % 5 ? .7 : 1.2}" fill="#fff" opacity="${.25 + (k % 3) * .15}"/>`;
    cells.forEach(([c, r, n, b]) => { const x = 14 + c * 22, y = 6 + r * 22;
      const tx = `<text x="${x + 10}" y="${y + 14}" text-anchor="middle" font-size="10" font-family="Black Han Sans, Jua, sans-serif" fill="#fff" stroke="#1A0F45" stroke-width="2" paint-order="stroke">${n}</text>`;
      if(b === 'b') g += `<circle cx="${x + 10}" cy="${y + 10}" r="9" fill="${pal[3]}" stroke="#1A0F45" stroke-width="2.2" stroke-dasharray="3 2"/>${tx}`;
      else g += `<rect x="${x}" y="${y}" width="20" height="20" rx="5" fill="${pal[b]}" stroke="#1A0F45" stroke-width="2.2"/>${tx}`; });
    let dots = ''; for(let k=1;k<7;k++) dots += `<circle cx="${96 - k * 5.2}" cy="${88 - k * 7.6}" r="1.6" fill="#fff" opacity="${1 - k * .1}"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="aBallBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2690"/><stop offset=".6" stop-color="#22166A"/><stop offset="1" stop-color="#170E44"/></linearGradient>
      <radialGradient id="aBallG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#FFF4C8"/><stop offset="1" stop-color="#F5C04A"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#aBallBg)"/>${stars}${g}${dots}
      <path d="M134 7l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#FFE27A" stroke="#2A1650" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="0" y="93" width="160" height="2.5" fill="#BFEFFF"/><rect x="0" y="86" width="160" height="7" fill="#96E1FF" opacity=".25"/>
      <circle cx="98" cy="88" r="4.6" fill="url(#aBallG)"/><text x="108" y="84" font-size="8.5" font-family="Black Han Sans, Jua, sans-serif" fill="#FFF4C8" stroke="#2A1650" stroke-width="2" paint-order="stroke">×12</text></svg>`;
  },
  help:[['끌어서 조준, 또는 ◀ ▶ 버튼','판을 누른 채 끌면 점선이 보여요. 손을 떼면 발사! 아래 ◀ ▶를 누르면 각도가 조금씩(길게 누르면 빨리) 바뀌고 [발사]를 눌러도 돼요.'],['숫자만큼 맞혀 깨기','블록은 숫자만큼 맞히면 깨져요. 별 조각을 먹으면 구슬 +1. 금 테두리 이벤트 블록은 3턴 안에 깨면 선물이 있어요. 다 쏜 뒤 [모두 거두기]로 바로 다음 턴.'],['바닥선을 지켜요','턴마다 블록이 한 줄 내려와요. 바닥선에 닿으면 별빛 방어막이 한 번 막아 줘요. 뚫는 구슬·긴 조준선·한 줄 올리기는 판마다 1번씩.']],
  chapters:['은하수 입구','젤리 성운','시계탑 별자리','방패 소행성대','불꽃놀이 은하'],
  starRule:'★ 클리어 · ★★ 기준 턴+6 이내 · ★★★ 기준 턴+3 이내·방어막 지킴',
  levels:BLEVELS,
  levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return '블록 ' + c.rows + '줄'; },
  saveKey:'hp:ballStages',
  stage:n => ballStageCfg(n),
  stageDesc(n){ const b = ballStageCfg(n); return b.rows + '줄 · 구슬 ' + b.start + '개' + (b.intro ? ' · 새 블록: ' + BSP_INFO[b.intro][0] : b.evIntro ? ' · 이벤트 블록: ' + BEV_INFO[b.evIntro][0] : ''); },
  /* 대전이면(지금 엔진은 levels.normal을 넘김) 대전 판 설정으로 바꿈. 공용 v3가 duelCfg를 넘기면 그대로 씀 */
  init(cfg, rng){ if(G.duel && !G.duel.fleet && !cfg.fixed) cfg = Object.assign({}, ballDuelCfg(), cfg.limit > 180 ? { limit:cfg.limit } : {}); ballInit(genBall(rng, cfg));
    if(G.duel && G.fixed) G.map0 = ballMiniGet(); },   /* 대전: 처음 블록 지도(컴퓨터 미니 화면이 아래 줄부터 지워 보여 줌) */
  render:st => ballStage(st),
  progress:() => G.total ? G.broken / G.total : 0,
  lossText:() => `${G.timeUp ? '시간이 다 됐어요 · ' : ''}블록 ${G.broken}/${G.total}개를 깼어요${G.next < G.rowsN ? ' · 남은 줄 ' + (G.rowsN - G.next) + '줄' : ''}.`,
  score(){ return { base:500, time:Math.max(0, 350 - Math.max(0, G.turn - G.R) * 30), extra:(G.shield ? 100 : 0) + (G.itemUsed ? 0 : 50),
    rows:['스테이지 클리어', '턴 보너스 (' + G.turn + '턴, 기준 ' + G.R + '턴)', (G.shield ? '방어막 지킴' : '방어막 씀') + ' · ' + (G.itemUsed ? '아이템 씀' : '아이템 안 씀')] }; },
  stars:() => ballStars(G.turn, G.R, G.shield > 0),
  winSfx:true, amb:'stars',
  /* 대전 = 고정 7줄 판 모든 블록 먼저 없애기(3분, 느긋하게 6분 = 엔진 기본 limit×2). 2~5명 경주.
     순위: 다 깬 사람(먼저) → 깬 블록 많은 → 쏜 턴 적은(tb) → 마지막으로 깬 시각 */
  duelKind:'race', duelMax:5, duelCfg:() => ballDuelCfg(),
  howto:{ pic:() => ballHowPic(), lines:['끌어서 조준하고 손을 떼면 쏴요', '구슬이 닿을 때마다 블록 숫자가 줄어요', '블록이 바닥에 닿기 전에 다 깨요'] },
  duelHow:'같은 7줄 판을 3분 안에 먼저 다 깨면 이겨요',
  duelPace:[110,.65],
  duelStat:{ unit:'개',             get:() => ({ v:G.broken, t:G.total, mis:0, tb:G.turn }) },
  /* 미니 화면(공용 v3): 남은 블록 지도 8×7(줄 1~7) → '0'/'1' 56글자. 컴퓨터는 처음 지도에서 깬 수만큼 아래 줄부터 지움 */
  duelMini:{ get:() => ballMiniGet(), draw:(el, s, p) => ballMiniDraw(el, s, p) }
};
/* 대전 미니 화면: 남은 블록 지도(줄 1~7 × 8칸) */
function ballMiniGet(){ let s = ''; for(let r=1;r<=7;r++) for(let c=0;c<BC;c++){ const o = G.gridB && G.gridB[r] && G.gridB[r][c]; s += o && !o.star && o.hp > 0 ? '1' : '0'; } return s; }
function ballMiniDraw(el, s, p){
  try{
    if(p && p.ai && G.map0){   /* 컴퓨터: 처음 지도에서 깬 블록 수만큼 아래 줄부터 지운 모습 */
      const a = G.map0.split(''), n = Math.max(0, Math.floor((p.st && p.st.v) || 0)); let k = 0;
      for(let i = a.length - 1; i >= 0 && k < n; i--) if(a[i] === '1'){ a[i] = '0'; k++; }
      s = a.join('');
    }
    s = String(s || '');
    if(el._bm === s) return; el._bm = s;
    let h = ''; for(let i=0;i<56;i++) if(s[i] === '1') h += `<rect x="${(i % 8) * 9 + 1}" y="${Math.floor(i / 8) * 8 + 1}" width="7" height="7" rx="2" fill="#B9A6EE"/>`;
    el.innerHTML = `<svg class="b-mini" viewBox="0 0 72 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="72" height="56" rx="6" fill="#211A4A"/>${h}</svg>`;
  }catch(_){}
}
/* 도움말 그림(320×180, 움직임·글자 없음): 끌어 조준 → 구슬이 날아가 블록에 튕기고 → 블록이 깨짐 */
function ballHowPic(){
  const dur = '3.2s', R = (k, x, y, c, gone) => `<g>${gone || ''}<rect x="${x}" y="${y}" width="40" height="30" rx="8" fill="${c}" stroke="#1A0F45" stroke-width="2.5"/></g>`;
  const pop = `<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.5;.56;.94;1" dur="${dur}" repeatCount="indefinite"/>`;
  const shake = `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -3;0 0;0 0" keyTimes="0;.42;.45;.5;1" dur="${dur}" repeatCount="indefinite"/>`;
  const path = 'M160 160L224 66L266 108';
  const ball = (dl, o) => `<circle r="6" fill="#fff" stroke="#1A0F45" stroke-width="2" opacity="0"><animateMotion path="${path}" keyPoints="0;0;1;1" keyTimes="0;${(.25 + dl).toFixed(2)};${(.62 + dl).toFixed(2)};1" calcMode="linear" dur="${dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;${o};${o};0;0" keyTimes="0;${(.24 + dl).toFixed(2)};${(.25 + dl).toFixed(2)};${(.6 + dl).toFixed(2)};${(.63 + dl).toFixed(2)};1" dur="${dur}" repeatCount="indefinite"/></circle>`;
  const shard = (dx, dy) => `<rect x="-3" y="-3" width="6" height="6" rx="1.5" fill="#F2B08A" stroke="#1A0F45" stroke-width="1.2" opacity="0"><animateTransform attributeName="transform" type="translate" values="224 50;224 50;${224 + dx} ${50 + dy};${224 + dx} ${50 + dy}" keyTimes="0;.5;.66;1" dur="${dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.5;.52;.68;1" dur="${dur}" repeatCount="indefinite"/></rect>`;
  return `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="끌어서 조준하면 구슬이 날아가 블록을 깨는 그림">
    <rect width="320" height="180" fill="#2A2160"/><rect x="40" y="10" width="240" height="160" rx="14" fill="#211A4A" stroke="#1A0F45" stroke-width="3"/>
    <g fill="#fff" opacity=".5"><circle cx="20" cy="24" r="1.6"/><circle cx="300" cy="40" r="1.4"/><circle cx="16" cy="140" r="1.2"/><circle cx="304" cy="150" r="1.8"/></g>
    ${R(0, 60, 20, '#9ED8C8')}${R(0, 108, 20, '#9EC3F0')}${R(0, 156, 20, '#B9A6EE')}<g>${pop}${shake}${R(0, 204, 36, '#F2B08A')}</g>${R(0, 252, 72, '#9EC3F0')}${R(0, 84, 58, '#E88A9E')}${R(0, 252, 20, '#9ED8C8')}
    <path d="${path.split('L').slice(0, 2).join('L')}" fill="none" stroke="#FFE27A" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;.24;.26;1" dur="${dur}" repeatCount="indefinite"/></path>
    ${ball(0, 1)}${ball(.04, .85)}${ball(.08, .7)}
    ${shard(-26, -18)}${shard(22, -22)}${shard(-18, 20)}${shard(26, 14)}${shard(0, -30)}
    <circle cx="160" cy="160" r="9" fill="#FFE27A" stroke="#1A0F45" stroke-width="2.5"/>
    <g opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.04;.22;.26;1" dur="${dur}" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="150 176;150 176;120 168;120 168" keyTimes="0;.06;.22;1" dur="${dur}" repeatCount="indefinite"/><path d="M0 0c0-6 8-6 8 0v12c4-3 10-1 9 5l-3 11c-1 4-5 7-9 7h-6c-4 0-7-2-9-6l-5-11c-2-4 3-6 6-3l3 3z" fill="#fff" stroke="#1A0F45" stroke-width="2.6" stroke-linejoin="round" transform="rotate(180)"/></g>
  </svg>`;
}
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.ball.scene = { kind:'stars', colors:['#FFFFFF','#E3C8FF','#9FD8FF'], density:.55 };   /* 판 바깥만, 밀도 절반(눈 편하게) */
