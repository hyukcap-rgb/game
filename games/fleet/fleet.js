/* 함대 결전: 배치·AI·대전·솔로 */
/* ---------- 함대 결전 (해전 전략): 10×10 바다, 함선 5척(5·4·3·3·2칸), 번갈아 한 발씩 ---------- */
const FL_SHIPS = [{ k:'carrier', n:'항공모함', len:5 }, { k:'battle', n:'전함', len:4 }, { k:'cruiser', n:'순양함', len:3 }, { k:'sub', n:'잠수함', len:3 }, { k:'destroyer', n:'구축함', len:2 }];
const FL_TOTAL = 17, FL_TURN = 25, FL_TURN_PVP = 10, FL_TURN_SLOW = 30, FL_COLS = 'ABCDEFGHIJ';   /* 실시간 한 차례: 보통 10초 · 느긋하게 30초(2026-10-06 세대별 테스트, 예전 5초) */
const flTurnSec = () => G && G.slow ? FL_TURN_SLOW : FL_TURN_PVP;
let flPaceNext = null;   /* duelLaunch(o.pace)가 다음 판 속도를 넘김 */
/* 대전 시계: 서버 시각 기준(두 기기가 같은 남은 시간을 보도록) */
const flNow = () => Date.now() + ((ROOM && ROOM.clockOffset) || 0);
const flShotN = () => G.sh.filter(x => x >= 0).length;
const FL_LV = {
  pvp:    { name:'실시간 대전', mult:1.6, fleet:{ limit:0 } },
  easy:   { name:'컴퓨터 쉬움',   mult:0.6, fleet:{ limit:0 } },
  normal: { name:'컴퓨터 보통',   mult:1.0, fleet:{ limit:0 } },
  hard:   { name:'컴퓨터 어려움', mult:1.4, fleet:{ limit:0 } }
};
const FL_AI_DESC = { easy:'아무 데나 쏘는 컴퓨터', normal:'맞히면 주변을 노리는 컴퓨터', hard:'확률을 계산하는 컴퓨터' };
const flName = i => FL_COLS[i % 10] + (Math.floor(i / 10) + 1);
const flEsc = esc;   /* 글자 안전하게(공용 esc) */
const FL_I = UI_ICON;   /* 버튼 아이콘(공용: core/effects-sound.js의 UI_ICON) */
const FL_XH = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12.5" fill="none" stroke="#FF4D4D" stroke-width="2.6" stroke-dasharray="14 5.6"/><circle cx="20" cy="20" r="2.6" fill="#FF4D4D"/><path d="M20 2v8M20 30v8M2 20h8M30 20h8" stroke="#FF4D4D" stroke-width="2.6" stroke-linecap="round"/></svg>';
const FL_FLAME = '<svg class="fl-flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c1.2 3.8 5.6 5.9 5.6 11.2A5.6 5.6 0 0 1 6.4 12.9c0-2.2 1.1-3.7 2.2-4.8.2 2 1.1 3.2 2.4 3.7C10.4 8.4 10.9 4.8 12 1.5z" fill="#FF6A1A"/><path d="M12 9c.7 2.2 3.1 3.3 3.1 5.9a3.1 3.1 0 0 1-6.2 0c0-1.6.9-2.6 1.6-3.3.2 1 .7 1.6 1.2 1.9-.2-1.8-.2-3.1.3-4.5z" fill="#FFD84A"/><circle cx="12" cy="16.2" r="1.3" fill="#FFF6D0"/></svg>';

/* 함선 그림: 가로 기준(뱃머리 오른쪽), 세로는 90도 회전 */
function flShipBody(k, len){
  const W = len * 100, pal = { carrier:['#8B9DAE','#3F4B56'], battle:['#8E9AA6','#46545F'], cruiser:['#9DAEBD','#4E5E6C'], sub:['#4E5D6A','#2A3640'], destroyer:['#A7B6C3','#56687A'] }[k];
  const hull = k === 'sub'
    ? `M6 50C8 29 32 26 70 26L${W-70} 26C${W-18} 26 ${W-6} 39 ${W-6} 50C${W-6} 61 ${W-18} 74 ${W-70} 74L70 74C32 74 8 71 6 50Z`
    : `M10 50C10 29 27 19 56 17L${W-92} 15C${W-40} 18 ${W-14} 33 ${W-3} 50C${W-14} 67 ${W-40} 82 ${W-92} 85L56 83C27 81 10 71 10 50Z`;
  const tur = x => `<g transform="translate(${x} 50)"><rect x="2" y="-4.5" width="44" height="9" rx="4" fill="#26313B"/><circle r="16" fill="${pal[1]}" stroke="#1B2630" stroke-width="4"/><circle r="5.5" fill="#8797A4"/></g>`;
  let d = `<path d="${hull}" fill="${pal[0]}" stroke="#1B2630" stroke-width="5"/><path d="M${k === 'sub' ? 50 : 44} 33L${W - 96} 30" stroke="rgba(255,255,255,.28)" stroke-width="5" stroke-linecap="round"/>`;
  if(k === 'carrier'){
    d += `<rect x="30" y="27" width="${W - 118}" height="46" rx="8" fill="${pal[1]}"/><path d="M44 50H${W - 104}" stroke="#F1F5F8" stroke-width="3" stroke-dasharray="18 12"/>`;
    d += `<rect x="${W * .56}" y="8" width="58" height="20" rx="4" fill="#C9D4DD" stroke="#1B2630" stroke-width="3"/>`;
    for(const x of [W * .16, W * .3]) d += `<path d="M${x} 40l22 10-22 10 5-10z" fill="#E6EDF2"/>`;
  } else if(k === 'battle'){
    d += `<rect x="${W * .42}" y="31" width="${W * .15}" height="38" rx="8" fill="#BCC7D0" stroke="#1B2630" stroke-width="3"/><circle cx="${W * .495}" cy="50" r="8" fill="#56636F"/>` + tur(W * .2) + tur(W * .32) + tur(W * .7);
  } else if(k === 'cruiser'){
    d += `<rect x="${W * .4}" y="32" width="${W * .18}" height="36" rx="8" fill="#C4CFD8" stroke="#1B2630" stroke-width="3"/>` + tur(W * .22) + tur(W * .72);
  } else if(k === 'sub'){
    d += `<rect x="${W * .4}" y="37" width="${W * .22}" height="26" rx="13" fill="#6D7C89" stroke="#1B2630" stroke-width="3"/><path d="M${W * .52} 37V22" stroke="#9AA8B4" stroke-width="4" stroke-linecap="round"/>`;
    for(const x of [W * .2, W * .28, W * .75]) d += `<circle cx="${x}" cy="50" r="4" fill="#2A3640"/>`;
  } else {
    d += `<rect x="${W * .26}" y="33" width="${W * .26}" height="34" rx="8" fill="#C9D4DD" stroke="#1B2630" stroke-width="3"/><circle cx="${W * .36}" cy="50" r="7" fill="#56687A"/>` + tur(W * .7);
  }
  return d;
}
function flShipSvg(k, len, v, cls, h){
  const W = len * 100, body = flShipBody(k, len);
  if(cls) return `<svg class="${cls}" viewBox="0 0 ${W} 100" style="width:${len * h}px;height:${h}px" aria-hidden="true">${body}</svg>`;
  return v ? `<svg viewBox="0 0 100 ${W}" preserveAspectRatio="none" aria-hidden="true"><g transform="translate(100 0) rotate(90)">${body}</g></svg>`
           : `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
function flShipEl(s, idx, cls){
  return `<div class="fl-ship ${cls || ''}" data-s="${idx}" style="left:${s.x * 10}%;top:${s.y * 10}%;width:${(s.v ? 1 : s.len) * 10}%;height:${(s.v ? s.len : 1) * 10}%">${flShipSvg(s.k, s.len, s.v)}</div>`;
}
const flKind = (len, used) => { const c = FL_SHIPS.findIndex((S, j) => S.len === len && !used.includes(j)); return c < 0 ? FL_SHIPS.findIndex(S => S.len === len) : c; };

/* 배치 규칙 */
function flCells(s){ const o = []; for(let k=0;k<s.len;k++) o.push((s.y + (s.v ? k : 0)) * 10 + s.x + (s.v ? 0 : k)); return o; }
function flInBounds(s){ return s.x >= 0 && s.y >= 0 && (s.v ? s.x <= 9 && s.y + s.len <= 10 : s.y <= 9 && s.x + s.len <= 10); }
function flFits(ships, s, ignore, rocks){
  if(!flInBounds(s)) return false;
  if(rocks && rocks.length && flCells(s).some(c => rocks.includes(c))) return false;
  const occ = new Set(); ships.forEach(t => { if(t !== ignore) flCells(t).forEach(c => occ.add(c)); });
  return flCells(s).every(c => !occ.has(c));
}
function flRandomFleet(rng, rocks){   /* 서로 붙지 않게 무작위 배치. rocks = 섬 칸(솔로 '섬' 규칙) */
  for(let tries=0; tries<300; tries++){
    const ships = [], block = new Set(rocks || []); let ok = true;
    for(const S of FL_SHIPS){
      let placed = false;
      for(let a=0; a<200 && !placed; a++){
        const v = rng() < .5, s = { ...S, v, x:Math.floor(rng() * (v ? 10 : 11 - S.len)), y:Math.floor(rng() * (v ? 11 - S.len : 10)), hits:0 };
        const cs = flCells(s); if(cs.some(c => block.has(c))) continue;
        ships.push(s); placed = true;
        cs.forEach(c => { const r = Math.floor(c / 10), q = c % 10; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ const rr = r + dr, cc = q + dc; if(rr >= 0 && rr < 10 && cc >= 0 && cc < 10) block.add(rr * 10 + cc); } });
      }
      if(!placed){ ok = false; break; }
    }
    if(ok) return ships;
  }
  return FL_SHIPS.map((S, k) => ({ ...S, v:false, x:0, y:k * 2, hits:0 }));
}
function flMapOf(ships){ const m = new Array(100).fill(-1); ships.forEach((s, k) => flCells(s).forEach(c => m[c] = k)); return m; }

/* ===================== 함대 결전 솔로: 난이도 v2 개념 사이클 (5판마다 새 개념) =====================
   새 규칙: 11 섬 · 21 레이더 · 31 연발 포격 · 41 침묵 함대 / 변주: 6 번개 · 16 맨손 · 26 선공 AI · 36 안개 · 46 외줄 타기(포탄 제한)
   모두 배틀십 장르에서 흔한 변형(장애물 칸, 탐지, Salvo 규칙, 격침 비공개, 포탄 제한)이에요(결정 135).
   솔로(G.adv)에서만 켜지고, 오늘의 문제·대전 함대는 그대로. 난이도(AI 세기 q)는 사람 흉내 봇 시뮬레이션(tools/fleet_sim.mjs)으로 맞춤. */
CONCEPTS.fleet = {
  order:['island', 'radar', 'salvo', 'silent'],
  info:{
    island:{ name:'섬', desc:'두 바다에 똑같이 섬 칸이 몇 개 생겨요. 섬에는 배를 둘 수도, 포를 쏠 수도 없어요. 배가 숨을 곳이 줄어든 만큼 머리를 써 봐요!' },
    radar:{ name:'레이더', desc:'레이더를 2번 쓸 수 있어요. 칸을 고르면 그 둘레 3×3 안에 적 배가 있는지 알려 줘요. 레이더는 차례를 쓰지 않아요. 높은 스테이지에선 AI도 레이더를 써요.' },
    salvo:{ name:'연발 포격', desc:'한 차례에 3발! 세 칸을 골라 한꺼번에 쏘고, 결과도 한꺼번에 봐요. 대신 맞혀도 한 번 더는 없어요. AI도 3발씩 쏴요.' },
    silent:{ name:'침묵 함대', desc:'적이 격침을 알려 주지 않아요. 명중과 빗나감만 보이고, 어떤 배가 가라앉았는지는 끝나야 알 수 있어요. 적 배 17칸을 모두 맞히면 이겨요.' }
  },
  twists:['flash', 'bare', 'first', 'fog', 'tight'],
  twInfo:{
    flash:{ name:'빠른 판', desc:'한 차례가 12초(연발은 18초)로 짧고, 별 기준 발수도 15% 빡빡해요. 빠르고 정확하게!' },
    bare:{ name:'맨손', desc:'레이더도, 격침한 배 둘레 자동 표시도 없어요. 오직 감으로 찾아요!' },
    first:{ name:'선공 AI', desc:'이번엔 AI가 먼저 쏴요. 한 발도 허투루 쏘면 안 돼요!' },
    fog:{ name:'안개', desc:'빗나간 표시가 내 차례 3번이 지나면 안개 속으로 사라져요. 같은 칸을 또 쏘면 한 발 손해! 쏜 곳을 잘 기억해요.' },
    tight:{ name:'외줄 타기', desc:'포탄 수가 정해져 있어요(시작할 때 알려 줘요). 포탄을 다 쓰기 전에 적 함대를 모두 격침해야 이겨요.' }
  }
};
/* 칸 상태(아는 것) K: 0 모름 · 1 빗나감 · 2 명중 · 3 격침 · 4 섬 · 5 배 없음(레이더·자동 표시) · 6 조준 중(연발) */
function flRockList(){ return G && G.fx && G.fx.rocks ? G.fx.rocks : []; }
function flArea(i){ const r = Math.floor(i / 10), c = i % 10, o = []; for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){ const rr = r + dr, cc = c + dc; if(rr >= 0 && rr < 10 && cc >= 0 && cc < 10) o.push(rr * 10 + cc); } return o; }
function flRocks(rng, n){   /* 섬: 1~2칸짜리 작은 섬 몇 개(가장자리 한 칸 안쪽, 섬끼리 붙지 않게) */
  const set = new Set();
  for(let t=0; t<400 && set.size < n; t++){
    const c = (1 + Math.floor(rng() * 8)) * 10 + 1 + Math.floor(rng() * 8);
    if(flArea(c).some(j => set.has(j))) continue;
    set.add(c);
    if(set.size < n && rng() < .5){ const nb = flNb(c).filter(j => j % 10 > 0 && j % 10 < 9 && j > 9 && j < 90); set.add(nb[Math.floor(rng() * nb.length)]); }
  }
  return [...set].slice(0, n).sort((a, b) => a - b);
}
/* '어려움' AI의 확률 지도: 남은 함선이 들어갈 수 있는 모든 자리를 센다 */
let FL_PL = null;   /* 길이별 모든 배치(칸 목록) — 한 번만 만들어 둔다 */
function flDensity(K, sunk){
  if(!FL_PL){ FL_PL = {}; for(const len of [2, 3, 4, 5]){ const a = FL_PL[len] = []; for(const v of [0, 1]) for(let y=0; y<(v ? 11 - len : 10); y++) for(let x=0; x<(v ? 10 : 11 - len); x++) a.push(flCells({ x, y, v, len })); } }
  const left = FL_SHIPS.map(S => S.len); sunk.forEach(l => { const k = left.indexOf(l); if(k >= 0) left.splice(k, 1); });
  let anyHit = false; for(let i=0; i<100; i++) if(K[i] === 2){ anyHit = true; break; }
  const sc = new Array(100).fill(0);
  for(const len of left) for(const cs of FL_PL[len]){
    let bad = false, hc = 0;
    for(const c of cs){ const k = K[c]; if(k === 1 || k === 3 || k === 4 || k === 5){ bad = true; break; } if(k === 2) hc++; }
    if(bad) continue;
    const w = hc ? 1 + hc * 25 : (anyHit ? 0.05 : 1);
    for(const c of cs) if(!K[c]) sc[c] += w;
  }
  return sc;
}
/* AI 한 발 고르기. lvl 0 쉬움 · 1 보통 · 2 어려움. hot = 레이더가 '있음'이라고 한 3×3(명중이 없을 때 그 안을 먼저) */
function flAiPickK(K, sunk, lvl, rnd, hot){
  const all = [...Array(100).keys()], unk = all.filter(i => !K[i]), hits = all.filter(i => K[i] === 2);
  const pick = a => a[Math.floor(rnd() * a.length)];
  if(!unk.length) return -1;
  const hu = hot && !hits.length ? hot.filter(i => !K[i]) : [], pool = hu.length ? hu : unk;
  if(lvl <= 0){
    if(hits.length && rnd() < .5){ const c = hits.flatMap(flNb).filter(j => !K[j]); if(c.length) return pick(c); }
    return pick(pool);
  }
  if(lvl === 1){
    if(hits.length){
      let best = [], bw = 0;
      for(const h of hits) for(const j of flNb(h)){
        if(K[j]) continue;
        const d = j - h, back = h - d, sameRow = Math.abs(d) !== 1 || Math.floor(back / 10) === Math.floor(h / 10);
        const w = back >= 0 && back < 100 && sameRow && K[back] === 2 ? 3 : 1;
        if(w > bw){ bw = w; best = [j]; } else if(w === bw) best.push(j);
      }
      if(best.length) return pick(best);
    }
    const par = pool.filter(i => (Math.floor(i / 10) + i % 10) % 2 === 0);
    return pick(par.length ? par : pool);
  }
  const sc = flDensity(K, sunk);
  let mx = -1, best = [];
  for(const i of pool){ const s2 = sc[i] + ((Math.floor(i / 10) + i % 10) % 2 ? 0 : .01); if(s2 > mx + 1e-9){ mx = s2; best = [i]; } else if(Math.abs(s2 - mx) < 1e-9) best.push(i); }
  return pick(best.length ? best : pool);
}
/* q(0~2)를 한 발마다 두 단계 사이에서 섞는다: 1.4 = 보통 60% · 어려움 40% */
function flAiLvl(q, rnd){ const b = Math.floor(q), f = q - b; return Math.max(0, Math.min(2, b + (rnd() < f ? 1 : 0))); }
function flRadarPick(K, sunk, rnd){
  const sc = flDensity(K, sunk); let mx = -1, best = [];
  for(let r=1; r<9; r++) for(let c=1; c<9; c++){ const i = r * 10 + c; let s = 0; for(const j of flArea(i)) if(!K[j]) s += sc[j] + .001;
    if(s > mx + 1e-9){ mx = s; best = [i]; } else if(Math.abs(s - mx) < 1e-9) best.push(i); }
  return best[Math.floor(rnd() * best.length)];
}
/* 침묵 함대: 격침을 모르니, 양 끝이 막힌 명중 줄(2칸 이상)은 '가라앉았다'고 본다(사람과 AI 모두 이렇게 추리) */
function flSilentResolve(K, sunk){
  const blocked = j => K[j] === 1 || K[j] === 3 || K[j] === 4 || K[j] === 5;
  for(const d of [1, 10]){
    for(let i=0; i<100; i++){
      if(K[i] !== 2) continue;
      if((d === 1 ? i % 10 > 0 : i >= 10) && K[i - d] === 2) continue;
      const run = [i]; let j = i;
      for(;;){ const nx = j + d; if(d === 1 ? nx % 10 === 0 : nx >= 100) break; if(K[nx] !== 2) break; run.push(nx); j = nx; }
      if(run.length < 2) continue;
      const a = run[0] - d, b = run[run.length - 1] + d;
      const aEnd = d === 1 ? run[0] % 10 === 0 : run[0] < 10, bEnd = d === 1 ? b % 10 === 0 : b >= 100;
      if((aEnd || blocked(a)) && (bEnd || blocked(b))){ run.forEach(c => K[c] = 3); if(run.length <= 5) sunk.push(run.length); }
    }
  }
}
/* 스테이지 설정: 켜진 규칙·변주, AI 세기와 AI 보너스, 별 기준 발수 */
function flStageFx(n){
  const p = planOf('fleet', n), mj = p.mj || [], has = k => mj.includes(k), tw = p.tw;
  const fx = { n, p, mj, tw, island:has('island'), salvo:has('salvo'), silent:has('silent'), radar:has('radar') && tw !== 'bare' ? 2 : 0,
    flash:tw === 'flash', bare:tw === 'bare', first:tw === 'first', fog:tw === 'fog', tight:0, rocks:[], aiRadar:0 };
  fx.mark = !fx.bare && !fx.silent;   /* 격침한 적 배 둘레 자동 '배 없음' 표시(적 배는 서로 붙지 않음) */
  if(fx.island) fx.rocks = flRocks(mulberry(seedFrom('flrock:' + n)), p.intro === 'island' ? 4 : p.boss ? 6 : 5);
  /* 별 기준 발수: 기본 ★★ 55 · ★★★ 43. 규칙마다 봇 기록 분포에 맞춰 옮기고, 번개는 15% 빡빡하게 */
  let [t2, t3] = FL_TH_BASE;
  for(const k of ['island', 'salvo', 'silent', 'fog', 'bare']) if(fx[k]){ t2 += FL_TH_ADD[k][0]; t3 += FL_TH_ADD[k][1]; }
  if(fx.radar){ t2 += FL_TH_ADD.radar[0]; t3 += FL_TH_ADD.radar[1]; }
  if(fx.flash){ t2 = Math.round(t2 * .85); t3 = Math.round(t3 * .85); }
  fx.th = [t2, t3];
  Object.assign(fx, flTune(p, fx));
  fx.turnSec = fx.salvo ? 18 : 12;   /* 번개 변주에서만 쓰는 차례 시계 */
  return fx;
}
const FL_TH_BASE = [55, 43], FL_TH_ADD = { island:[-3, -2], radar:[-4, -3], salvo:[9, 9], silent:[6, 7], fog:[2, 1], bare:[2, 2] };
/* 목표 첫 도전 승률(로얄 매치식 톱니): 쉬움(1·6·9) ~90% · 보통 75~85% · 5번째 ~60% · 보스 ~40%, 챕터마다 조금씩 내려감 */
function flTarget(c, k){
  const d = Math.min(c, 8) - 1;
  const t = { 1:.92, 2:.85, 3:.84, 4:.81, 5:.62, 6:.91, 7:.82, 8:.80, 9:.91, 10:.46 }[k];
  const drop = k === 10 ? .015 : k === 5 ? .01 : k === 1 || k === 6 || k === 9 ? .006 : .012;
  return Math.max(k === 10 ? .36 : .5, t - drop * d);
}
/* AI 세기 표(스테이지 1~70): tools/fleet-sim.js tune 결과. 71부터는 개념별 보정 모델 */
const FL_Q = [
  0.25, 0.7, 0.75, 0.85, 1.5, 0.2, 0.75, 0.9, 0.3, 2,
  0.25, 0.6, 0.8, 0.85, 1.4, 0.1, 0.55, 0.6, 0.35, 1.6,
  0.65, 1, 1.15, 1.05, 1.75, 0.3, 1, 1, 0.5, 2,
  0, 0.45, 0.35, 1, 1.4, 0.1, 0.05, 0.1, 0, 1.7,
  0, 0.2, 0.2, 0.05, 0.8, 0.3, 0, 0, 0.05, 1.2,
  0.3, 0.6, 0.85, 1, 1.35, 0.3, 0.85, 0.95, 0.05, 1.85,
  0.05, 0.2, 0.95, 0.05, 0.7, 0, 0.35, 0.05, 0.05, 1.25
];
const FL_QOFF = { island:-.05, radar:.27, salvo:-.27, silent:-.62, flash:0, bare:-.18, first:-.15, fog:-.46, tight:-.2 };   /* 표에서 최소제곱으로 뽑은 개념별 보정 */
function flTune(p, fx){
  const n = fx.n, tight = fx.tw === 'tight' ? fx.th[0] + 4 : 0;
  const aiRadar = fx.mj.includes('radar') && (p.c > 3 || p.k >= 4) ? 1 : 0;
  if(FL_Q[n - 1] != null) return { aiQ:FL_Q[n - 1], aiRadar, tight };
  /* 모델: 목표 승률 → 기본 q(개념 없는 판의 승률 곡선을 거꾸로) + 켜진 개념별 보정 */
  const T = flTarget(p.c, p.k), W = [[0, .97], [.5, .88], [1, .76], [1.5, .64], [2, .485]];
  let q = 2; for(let i=1; i<W.length; i++) if(T >= W[i][1]){ const [q0, w0] = W[i - 1], [q1, w1] = W[i]; q = q0 + (q1 - q0) * (w0 - T) / (w0 - w1); break; }
  if(T > W[0][1]) q = 0;
  for(const k of Object.keys(FL_QOFF)) if(fx[k] || fx.mj.includes(k)) q += FL_QOFF[k];
  return { aiQ:Math.round(Math.max(0, Math.min(2, q)) * 100) / 100, aiRadar, tight };
}

function flWaitingCount(){ try{ return ROOM ? ROOM.peers().filter(p => !p.sameTab && p.presence && p.presence.fl === 'wait').length : 0; }catch(_){ return 0; } }
const FL_NICK_A = ['푸른','용감한','날쌘','은빛','붉은','고요한','번개','새벽'], FL_NICK_B = ['고래','상어','돌고래','범고래','문어','거북','갈매기','해달'];

/* 모드·난이도 시트 */
function openFleetSheet(){
  const canLive = ROOM_STATE !== 'none';
  let sel = lastLv('fleet');
  const n = flWaitingCount();
  const liveDesc = !canLive ? '이 화면에선 실시간 대전을 쓸 수 없어요' : (n ? `지금 대기 중인 선장 ${n}명` : '20초 안에 상대가 없으면 컴퓨터와 붙어요') + ' · 최대 약 ' + fmt(maxPts('fleet', 'pvp')) + '점';
  const row = (k, title, desc, lead, rec) => `<button class="opt" role="radio" data-lv="${k}" aria-checked="${k === sel}" ${k === 'pvp' && !canLive ? 'disabled' : ''}>${lead}<span><b>${title}</b><small>${desc}</small></span>${rec ? '<span class="rec">' + rec + '</span>' : '<span></span>'}</button>`;
  const ai = ['easy','normal','hard'].map((k, i) => row(k, FL_LV[k].name, FL_AI_DESC[k] + ' · 최대 약 ' + fmt(maxPts('fleet', k)) + '점',
    `<span class="lvdots">${[0,1,2].map(j => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`, !canLive && k === 'normal' ? '추천' : '')).join('');
  openModal(`<h3>${GAMES.fleet.name}</h3><p class="note">함대를 숨기고 포격해요. 맞히면 한 번 더! 고른 방식은 기억해 두었다가 다음엔 바로 시작해요.</p>
    <div class="opts" role="radiogroup" aria-label="대전 방식">
      ${row('pvp', '실시간 1:1 대전', liveDesc, `<span class="livedot${canLive ? '' : ' off'}"></span>`, canLive ? '추천' : '')}
      <div class="optsep">솔로 · 컴퓨터와 대전</div>${ai}
    </div>
    <div class="mbtns"><button class="b2" id="mClose">닫기</button><button class="b1" id="mGo">시작하기 ${costTag()}</button></div>`);
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => { if(b.disabled) return; sel = b.dataset.lv; document.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-checked', x === b)); });
  $('#mClose').onclick = closeModal;
  $('#mGo').onclick = () => { store.set('hp:lv:fleet', sel); closeModal(); startGame('fleet', sel); };
}

function flInit(lv, rng){
  const nick = FL_NICK_A[Math.floor(Math.random() * FL_NICK_A.length)] + ' ' + FL_NICK_B[Math.floor(Math.random() * FL_NICK_B.length)];
  const fx = G.adv ? flStageFx(G.adv) : null, rocks = fx ? fx.rocks : undefined;   /* 솔로만: 스테이지 규칙·변주 */
  const en = flRandomFleet(rng, rocks);   /* AI 함대 배치는 오늘 친구들과 같음 */
  Object.assign(G, { mode: lv === 'pvp' ? 'pvp' : 'ai', ai: lv === 'pvp' ? 'normal' : lv, phase:'place', nick, oppNick: lv === 'pvp' ? '상대 선장' : '컴퓨터 함장',
    my:flRandomFleet(Math.random, rocks), en, enMap:flMapOf(en), myMap:null, myShot:new Array(100).fill(0), enShot:new Array(100).fill(0),
    sh:[], an:[], shown:0, pending:-1, hitsN:0, myLeft:FL_TOTAL, enSunk:[], turn:null, lastTurn:null, aimI:-1, busy:false, busyIn:false,
    aiKnow:new Array(100).fill(0), aiSunk:[], log:[], opp:{ sh:[], an:[] }, nr:null, oppPeer:null, myPeer:null, oppRv:null, forfeit:false, ending:false,
    slow:lv === 'pvp' && (flPaceNext != null ? !!flPaceNext : !!store.get('hp:fleet:slow', 0)), selShip:0 });   /* 실시간 '느긋하게'(한 차례 30초) */
  G.fx = fx;
  if(fx){
    Object.assign(G, { radarN:fx.radar, aiRadarN:fx.aiRadar, aiHot:null, radarMode:false, radarMarks:[], salvoSel:[], myTurnN:0, aiTurnN:0, missAt:{}, fogged:new Set() });
    fx.rocks.forEach(c => { G.aiKnow[c] = 4; G.enShot[c] = 4; });
  }
  G.cleanup = () => flCleanup();
}
function flCleanup(){
  clearInterval(G.mmIv); clearInterval(G.syncIv);
  if(G.mmUn) try{ G.mmUn(); }catch(_){}
  if(G.nrUn) try{ G.nrUn(); }catch(_){}
  const nr = G.nr; G.nr = null;
  if(nr) setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1200);
  if(ROOM) ROOM.presence({ fl:null, ft:null, pr:null, nk:null, dk:null }).catch(() => {});
}

/* ----- 화면 ----- */
function flStage(st){
  st.innerHTML = `<div class="flg" id="flg">
    <div class="fl-top pbar">
      <button class="iconbtn fl-rb" id="flBack" aria-label="그만하기">${FL_I.back}</button>
      <div class="ptitle fl-vs"><b id="flVs"></b><span class="fl-turn" id="flTurn"><i></i>함대 배치</span>${flRuleNames() ? `<span class="fl-cx" aria-label="이번 판 규칙">${flRuleNames()}</span>` : ''}</div>
      <button class="iconbtn fl-rb" id="flSnd" aria-label="효과음"></button>
      <button class="iconbtn fl-rb" id="flHelp" aria-label="게임 방법">${FL_I.help}</button>
    </div>
    <div id="flBody"></div></div>`;
  $('#flBack').onclick = confirmQuit; $('#flHelp').onclick = () => openHelp('fleet');
  const si = () => { $('#flSnd').innerHTML = SND.on ? FL_I.snd : FL_I.mute; $('#flSnd').setAttribute('aria-pressed', SND.on); };
  si(); $('#flSnd').onclick = () => { sndSetOn(!SND.on); si(); if(SND.on) flSound('ping'); };
  const flg = $('#flg'); ['selectstart','contextmenu','dragstart'].forEach(ev => flg.addEventListener(ev, e => e.preventDefault()));
  flRender();
}
function flLabels(){ return `<div class="fl-lx">${[...FL_COLS].map(c => `<span>${c}</span>`).join('')}</div><div class="fl-ly">${[...Array(10)].map((_, k) => `<span>${k + 1}</span>`).join('')}</div>`; }
function flRender(){
  const b = $('#flBody'); if(!b) return;
  $('#flVs').textContent = G.phase === 'battle' ? '나 vs ' + G.oppNick : G.mode === 'pvp' ? '실시간 1:1 대전' + (G.slow ? ' · 느긋하게' : '') : G.adv ? G.L.name + ' 해전' : G.duel ? '컴퓨터와 해전' : '오늘의 바다';
  if(G.phase === 'place') flRenderPlace(b);
  else if(G.phase === 'battle') flRenderBattle(b);
  else flRenderSearch(b);
}

/* 배치 화면: 끌어서 이동, 탭하면 회전 */
function flRenderPlace(b){
  $('#flTurn').className = 'fl-turn'; $('#flTurn').innerHTML = '<i></i>함대 배치';
  if(G.selShip == null) G.selShip = 0;
  b.innerHTML = `<div class="fl-panel">
      <button class="btn primary fl-auto" id="flAuto">${FL_I.shuf}<span>자동으로 놓고 출격</span></button>
      <div class="fl-head"><span><b>우리 함대 배치</b></span><span>끌면 이동 · 누르면 회전</span></div>
      <div class="fl-board">${flLabels()}<div class="fl-sea" id="flMy"><div class="fl-radar"></div>${flRockLayer()}<div class="fl-ships edit" id="flMyShips"></div></div></div>
      <div class="fl-dpad" role="group" aria-label="고른 배 옮기기">
        <button class="fl-dk" data-d="l" aria-label="왼쪽으로">◀</button><button class="fl-dk" data-d="u" aria-label="위로">▲</button><button class="fl-dk" data-d="d" aria-label="아래로">▼</button><button class="fl-dk" data-d="r" aria-label="오른쪽으로">▶</button><button class="fl-dk rot" data-d="o" aria-label="돌리기">⟳</button>
      </div>
      <div class="fl-pbtns"><button class="btn secondary fl-sbtn" id="flShuf">${FL_I.shuf}무작위</button><button class="btn secondary fl-sbtn fl-go2" id="flGo">${G.mode === 'pvp' ? '이대로 · 상대 찾기' : '이대로 출격'}</button></div>
      ${G.mode === 'pvp' ? `<button type="button" class="fl-pace${G.slow ? ' on' : ''}" id="flPace" aria-pressed="${!!G.slow}"><b>${G.slow ? '느긋하게' : '보통'}</b> · 한 차례 ${flTurnSec()}초 <span>바꾸기 ⇄</span></button>` : ''}
    </div>
    <p class="fl-tip">${G.mode === 'pvp' ? '20초 안에 상대를 못 찾으면 이 배치 그대로 컴퓨터와 겨룰 수 있어요.' : (G.adv ? flSoloTip() : '<b>오늘의 바다 · 컴퓨터와 해전</b><br>컴퓨터 함대의 위치는 오늘 친구들과 똑같아요. 누가 더 적게 쏘고 이길까요?')}</p>`;
  $('#flMy').classList.add('live');
  flPlaceShips(true);
  const go = () => { flSound('fire'); if(G.mode === 'pvp') flSearch(); else flStartBattle(); };
  const shuf = () => { G.my = flRandomFleet(Math.random, G.fx ? G.fx.rocks : undefined); flPlaceShips(true); flSound('splash'); G.my.forEach((sh, k) => setTimeout(() => flSound('aim'), k * 60)); };
  $('#flShuf').onclick = shuf;
  $('#flGo').onclick = go;
  $('#flAuto').onclick = () => { shuf(); const me = G; setTimeout(() => { if(G === me && G.phase === 'place') go(); }, 450); };
  document.querySelectorAll('.fl-dk').forEach(k => k.onclick = () => flNudge(k.dataset.d));
  const pc = $('#flPace'); if(pc) pc.onclick = () => { G.slow = !G.slow; store.set('hp:fleet:slow', G.slow ? 1 : 0); sfx('toggle'); flRender(); };
}
/* 방향 버튼(세대별 테스트 S-FLT-4): 고른 배를 한 칸씩 옮기거나 돌린다. 막히면 그다음 들어갈 수 있는 칸까지 건너뛴다 */
function flNudge(d){
  const s = G.my[G.selShip | 0]; if(!s || G.phase !== 'place') return;
  if(d === 'o'){
    const v = !s.v, cands = [];
    for(let dx=-4; dx<=4; dx++) for(let dy=-4; dy<=4; dy++) cands.push([dx, dy]);
    cands.sort((a, b2) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b2[0]) - Math.abs(b2[1]));
    const hit = cands.map(([dx, dy]) => ({ ...s, v, x:s.x + dx, y:s.y + dy })).find(t => flInBounds(t) && flFits(G.my, t, s, flRockList()));
    if(hit){ s.v = v; s.x = hit.x; s.y = hit.y; flSound('lock'); flPlaceShips(false); } else { flSound('bad'); fxBuzz(40); }
    return;
  }
  const [dx, dy] = { l:[-1, 0], r:[1, 0], u:[0, -1], d:[0, 1] }[d];
  for(let k = 1; k < 10; k++){
    const t = { ...s, x:s.x + dx * k, y:s.y + dy * k };
    if(!flInBounds(t)) break;
    if(flFits(G.my, t, s, flRockList())){ s.x = t.x; s.y = t.y; flSound('aim'); flPlaceShips(false); return; }
  }
  flSound('bad'); fxBuzz(30);
}
function flPlaceShips(anim){
  const layer = $('#flMyShips'); if(!layer) return;
  layer.innerHTML = G.my.map((s, k) => flShipEl(s, k, (anim ? 'pop' : '') + (k === (G.selShip | 0) ? ' sel' : ''))).join('');
  if(anim) layer.querySelectorAll('.fl-ship').forEach((e, k) => e.style.animationDelay = k * 60 + 'ms');
  const sea = $('#flMy'); let drag = null;
  layer.querySelectorAll('.fl-ship').forEach(el => {
    const s = G.my[+el.dataset.s];
    el.onpointerdown = e => {
      e.preventDefault(); try{ el.setPointerCapture(e.pointerId); }catch(_){}
      const rc = sea.getBoundingClientRect(), cs = rc.width / 10;
      drag = { gx:Math.floor((e.clientX - rc.left) / cs) - s.x, gy:Math.floor((e.clientY - rc.top) / cs) - s.y, x0:e.clientX, y0:e.clientY, moved:false, nx:s.x, ny:s.y };
      G.selShip = +el.dataset.s; layer.querySelectorAll('.fl-ship').forEach(x => x.classList.toggle('sel', x === el));
      el.classList.remove('pop'); el.classList.add('drag');
    };
    el.onpointermove = e => {
      if(!drag) return;
      if(!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
      drag.moved = true;
      const rc = sea.getBoundingClientRect(), cs = rc.width / 10;
      const nx = Math.max(0, Math.min(10 - (s.v ? 1 : s.len), Math.floor((e.clientX - rc.left) / cs) - drag.gx));
      const ny = Math.max(0, Math.min(10 - (s.v ? s.len : 1), Math.floor((e.clientY - rc.top) / cs) - drag.gy));
      if(nx !== drag.nx || ny !== drag.ny) flSound('aim');
      drag.nx = nx; drag.ny = ny; el.style.left = nx * 10 + '%'; el.style.top = ny * 10 + '%';
      el.classList.toggle('bad', !flFits(G.my, { ...s, x:nx, y:ny }, s, flRockList()));
    };
    const end = () => {
      if(!drag) return; const d = drag; drag = null; el.classList.remove('drag', 'bad');
      if(!d.moved){   /* 회전: 안 맞으면 가까운 자리로 밀어서 시도 */
        const v = !s.v, cands = [];
        for(let dx=-4; dx<=4; dx++) for(let dy=-4; dy<=4; dy++) cands.push([dx, dy]);
        cands.sort((a, b2) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b2[0]) - Math.abs(b2[1]));
        const hit = cands.map(([dx, dy]) => ({ ...s, v, x:s.x + dx, y:s.y + dy })).find(t => flFits(G.my, t, s, flRockList()));
        if(hit){ s.v = v; s.x = hit.x; s.y = hit.y; flSound('lock'); }
        else { el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); fxBuzz(40); return; }
      } else if(flFits(G.my, { ...s, x:d.nx, y:d.ny }, s, flRockList())){ s.x = d.nx; s.y = d.ny; flSound('lock'); }
      else { flSound('bad'); fxBuzz(40); }
      flPlaceShips(false);
    };
    el.onpointerup = end; el.onpointercancel = end;
  });
}

/* 상대 찾기 화면 */
function flRenderSearch(b){
  $('#flTurn').className = 'fl-turn'; $('#flTurn').innerHTML = '<i></i>' + (G.phase === 'joining' ? '연결 중' : '상대 찾는 중');
  b.innerHTML = `<div class="fl-panel fl-searchp">
      <div class="fl-rbig${G.phase === 'joining' ? ' found' : ''}"><i></i><span class="fl-blip" style="left:30%;top:36%"></span><span class="fl-blip" style="left:68%;top:58%;animation-delay:1.1s"></span><span class="fl-blip" style="left:44%;top:76%;animation-delay:.6s"></span></div>
      <h3 class="fl-st" id="flSt"></h3><p class="fl-sn" id="flSn"></p>
      <div class="fl-sbtns" id="flSBtns"><button class="btn primary fl-go" id="flAiNow">컴퓨터와 바로 대전</button><button class="btn secondary fl-sbtn" id="flCancel">배치로 돌아가기</button></div>
    </div>`;
  $('#flAiNow').onclick = flSwitchAI;
  $('#flCancel').onclick = () => { flStopSearch(); if(ROOM) ROOM.presence({ fl:null, ft:null, pr:null }).catch(() => {}); G.phase = 'place'; flRender(); };
  flSearchText();
}
function flSearchText(){
  const st = $('#flSt'), sn = $('#flSn'); if(!st) return;
  const left = Math.max(0, 20 - Math.floor((Date.now() - (G.mmT0 || Date.now())) / 1000));
  if(!ROOM){ st.textContent = '실시간 대전을 쓸 수 없어요'; sn.textContent = '이 화면에선 다른 선장과 연결할 수 없어요. 지금 배치 그대로 AI와 겨뤄 보세요.'; $('#flAiNow').textContent = '컴퓨터와 대전 (보통)'; return; }
  if(G.phase === 'joining'){ st.textContent = '상대를 찾았어요!'; sn.innerHTML = `<b>${flEsc(G.oppNick)}</b> 선장과 연결하는 중…`; $('#flSBtns').style.display = 'none'; return; }
  if(G.phase === 'nobody'){ st.textContent = '지금 대전할 선장이 없어요'; sn.textContent = '계속 기다리면 누가 들어올 때 바로 연결해요. 컴퓨터 대전은 보통 난이도 점수로 계산돼요.'; $('#flAiNow').textContent = '컴퓨터와 대전 (보통)'; return; }
  st.textContent = '상대 선장을 찾는 중'; const n = flWaitingCount();
  sn.textContent = `${left}초 · ${n ? '대기 중인 선장 ' + n + '명' : '레이더로 바다를 훑고 있어요'} · 내 이름 ${G.nick}`;
}
function flSearch(){
  G.phase = 'search'; G.mmT0 = Date.now(); flRender();
  const room = ROOM;
  if(!room){ return; }
  G.ft = Date.now();
  room.presence({ fl:'wait', ft:G.ft, nk:G.nick, pr:null, dk:G.slow ? 's' : 'n' }).catch(() => {});
  const check = () => {
    if(G.over || (G.phase !== 'search' && G.phase !== 'nobody')) return;
    let ps; try{ ps = room.peers(); }catch(_){ return; }
    const me = ps.find(p => p.sameTab); if(!me) return;
    G.myPeer = me.peer;
    const claim = ps.find(p => !p.sameTab && p.presence && p.presence.fl === 'play' && p.presence.pr === me.peer);
    if(claim){ flMatch(claim); return; }
    const dk = G.slow ? 's' : 'n';
    const list = ps.filter(p => p.presence && p.presence.fl === 'wait' && typeof p.presence.ft === 'number' && (p.presence.dk || 'n') === dk)
      .sort((a, b) => a.presence.ft - b.presence.ft || (a.peer < b.peer ? -1 : 1));
    const i = list.findIndex(p => p.sameTab); if(i < 0) return;
    const opp = list[i % 2 ? i - 1 : i + 1]; if(opp) flMatch(opp);
  };
  try{ G.mmUn = room.onPeers(check, () => {}); }catch(_){}
  G.mmIv = setInterval(() => {
    check();
    if((G.phase === 'search' || G.phase === 'nobody') && Date.now() - (G.pingT || 0) > 2400){ G.pingT = Date.now(); flSound('ping'); }
    if(G.phase === 'search' && Date.now() - G.mmT0 > 20000){ G.phase = 'nobody'; flSound('bad'); }
    flSearchText();
  }, 500);
}
function flStopSearch(){ clearInterval(G.mmIv); if(G.mmUn) try{ G.mmUn(); }catch(_){} G.mmUn = null; }
function flSwitchAI(){
  flStopSearch(); flCleanupRoom();
  G.mode = 'ai'; G.lv = 'normal'; G.ai = 'normal'; G.L = FL_LV.normal; G.oppNick = '컴퓨터 함장';
  flStartBattle();
}
function flCleanupRoom(){
  clearInterval(G.syncIv); if(G.nrUn) try{ G.nrUn(); }catch(_){} G.nrUn = null;
  if(G.nr){ const nr = G.nr; G.nr = null; try{ nr.leave(); }catch(_){} }
  if(ROOM) ROOM.presence({ fl:null, ft:null, pr:null }).catch(() => {});
}
async function flMatch(opp){
  if(G.phase !== 'search' && G.phase !== 'nobody') return;
  flStopSearch();
  G.phase = 'joining'; G.oppPeer = opp.peer; G.oppNick = String((opp.presence && opp.presence.nk) || '상대 선장').slice(0, 12);
  G.first = G.myPeer < opp.peer;
  ROOM.presence({ fl:'play', pr:opp.peer }).catch(() => {});
  flRender(); flSound('lock'); fxBuzz([20, 40, 20]);
  const a = [G.myPeer, opp.peer].map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)).sort();
  const me = G; let nr;
  try{ nr = await ROOM.join(('fl-' + a[0] + '-' + a[1]).slice(0, 48)); }catch(_){ if(G === me) flMatchFail(); return; }
  if(G !== me || G.phase !== 'joining' || G.over){ try{ nr.leave(); }catch(_){} return; }
  G.nr = nr; G.joinT = Date.now();
  nr.presence({ v:1, nk:G.nick, sh:[], an:[] }).catch(() => {});
  try{ G.nrUn = nr.onPeers(ch => {
      if(G !== me) return;
      if(G.oppSeen && ch.left.some(p => p.peer === G.oppPeer)){
        /* 상대가 끊김: 바로 기권승으로 보지 않고 15초 다시 들어오길 기다림(들어오면 새 peer id로 이어감) */
        if(G.phase !== 'battle'){ flOppLeft(); return; }
        if(!G.oppGone){ G.oppGone = Date.now(); toast('상대 연결이 끊겼어요 · 15초 기다려요'); }
      } else flSync();
    }, () => { if(G === me && !G.over && G.phase === 'battle'){ toast('연결이 끊겨서 대전을 이어 가지 못했어요'); flEnd(false); } }); }catch(_){}
  G.syncIv = setInterval(() => { if(G === me){ flSync(); flTimerTick(); } }, 250);
}
function flMatchFail(){
  flCleanupRoom(); G.oppSeen = false;
  if(G.over) return;
  toast('상대와 연결하지 못했어요. 다시 찾을게요');
  flSearch();
}
function flOppLeft(){
  if(G.over || G.ending) return;
  if(G.phase === 'joining'){ flMatchFail(); return; }
  if(G.phase !== 'battle') return;
  /* 상대가 전투를 정상으로 끝내고(rv 공개) 나간 경우: 기권승이 아니라 마지막 포격 결과로 판정 */
  if(Array.isArray(G.oppRv)){
    const me = G;
    setTimeout(() => {
      if(G !== me || G.over || G.ending) return;
      if(G.myLeft <= 0) flEnd(false);
      else if(G.enSunk.length >= FL_SHIPS.length) flEnd(true);
      else { G.forfeit = true; flBanner('#flEnP', '상대가 떠났어요', 'good', '기권승이에요'); flEnd(true); }
    }, 3500);
    return;
  }
  G.forfeit = true; flBanner('#flEnP', '상대가 떠났어요', 'good', '기권승이에요');
  flEnd(true);
}

/* 전투 화면 */
function flStartBattle(){
  G.phase = 'battle'; G.myMap = flMapOf(G.my); G.start = Date.now(); G.pausedMs = 0;
  if(G.mode === 'pvp' && ROOM) ROOM.presence({ fl:null, ft:null, pr:null }).catch(() => {});
  const aiFirst = !!(G.fx && G.fx.first);
  if(G.mode === 'ai') G.turn = aiFirst ? 'ai' : 'me';
  flRender();
  const first = G.mode === 'ai' ? !aiFirst : G.first;
  flBanner('#flEnP', '전투 개시!', 'good', first ? '내가 먼저 쏴요' : '상대가 먼저 쏴요');
  flSound('horn'); setTimeout(() => flSound('ping'), 700); fxBuzz([30, 50, 30]);
  flLog(`<span class="s">⚓ 전투 개시</span> · ${first ? '선공' : '후공'}`);
  if(G.fx){
    const me = G;
    if(aiFirst) setTimeout(() => { if(G === me) flAiTurn(); }, 1500); else flMyTurnStart();
    /* 번개 변주만 차례 시계(12초, 연발 18초). 도움말 등으로 멈춘 동안은 시계도 멈춤 */
    if(G.fx.flash) G.syncIv = setInterval(() => { if(G !== me) return; if(G.paused || $('#veil').classList.contains('on')){ if(G.turnAt) G.turnAt += 250; return; } flTimerTick(); }, 250);
  }
  flTurnUI();
}
function flRenderBattle(b){
  b.innerHTML = `<div class="fl-panel" id="flEnP">
      <div class="fl-head"><span>적 해역 · <b>${flEsc(G.oppNick)}</b></span><span class="fl-fleet" id="flEnFleet"></span></div>
      <div class="fl-board">${flLabels()}<div class="fl-sea" id="flEn"><div class="fl-radar"></div>${flRockLayer()}<div class="fl-ships" id="flEnShips"></div><div class="fl-rdl" id="flRdl"></div>${[...Array(100)].map((_, i) => `<button class="fl-c" data-i="${i}" aria-label="${flName(i)}"></button>`).join('')}</div></div>
      <div class="fl-bar${G.fx && G.fx.radar ? ' rdr' : ''}"><span class="hchip fl-stat"><span class="hv"><b id="flShots">0</b></span><em>${G.fx && G.fx.tight ? '남은 포탄' : '쏜 포탄'}</em></span><span class="hchip fl-stat"><span class="hv"><b id="flAcc">–</b></span><em>명중률</em></span>
        ${G.fx && G.fx.radar ? `<button class="tool toggle fl-rdb" id="flRdr" aria-pressed="false">${FL_I.radar}<span>레이더</span><b class="cnt" id="flRdrN">${G.radarN}</b></button>` : ''}
        <button class="btn primary fl-fire" id="flFire" disabled>${FL_I.target}<span id="flFireL">${G.fx && G.fx.salvo ? '0/3 조준' : '발사'}</span> <small id="flAimT"></small></button></div>
    </div>
    <div class="fl-panel" id="flMeP"><div class="fl-mewrap">
      <div><div class="fl-head" style="margin-bottom:0"><span><b>우리 함대</b></span></div>
        <div class="fl-board">${flLabels()}<div class="fl-sea small" id="flMy">${flRockLayer()}<div class="fl-ships" id="flMyShips"></div><div class="fl-rdl" id="flMyRdl"></div><div class="fl-xh" id="flXh">${FL_XH}</div>${[...Array(100)].map((_, i) => `<div class="fl-c" data-i="${i}"></div>`).join('')}</div></div></div>
      <div class="fl-side"><div id="flMyList"></div><div class="fl-log" id="flLog"></div></div>
    </div></div>`;
  $('#flMyShips').innerHTML = G.my.map((s, k) => flShipEl(s, k, s.hits >= s.len ? 'wreck' : '')).join('');
  $('#flEnShips').innerHTML = G.fx && G.fx.silent && !G.ending ? '' : G.enSunk.map(sp => flShipEl(sp, 0, 'wreck')).join('');
  $('#flEn').onclick = e => { const c = e.target.closest('.fl-c'); if(!c) return; if(G.radarMode) flRadarUse(+c.dataset.i); else flAim(+c.dataset.i); };
  $('#flFire').onclick = () => G.fx && G.fx.salvo ? flSalvoFire() : flFire(G.aimI);
  if($('#flRdr')) $('#flRdr').onclick = flRadarToggle;
  if(G.fx) flRadarDraw();
  for(let i=0;i<100;i++){ flPaintEn(i); flPaintMy(i); }
  flFleetUI(); flStats(); flLogUI();
}
const flEnCell = i => document.querySelector(`#flEn .fl-c[data-i="${i}"]`);
const flMyCell = i => document.querySelector(`#flMy .fl-c[data-i="${i}"]`);
function flPaintEn(i){
  const el = flEnCell(i); if(!el) return; let s = G.enShot[i];
  if(s === 4 || s === 5){ el.className = 'fl-c done ' + (s === 4 ? 'fl-rockc' : 'fl-clear'); el.innerHTML = ''; el.setAttribute('aria-label', flName(i) + (s === 4 ? ' 섬' : ' 배 없음')); return; }
  if(s === 1 && G.fogged && G.fogged.has(i)) s = 0;   /* 안개: 빗나간 표시가 사라짐(다시 쏠 수 있음) */
  el.className = 'fl-c' + (s ? ' done' : '') + (s === 1 ? ' fl-miss' : s >= 2 ? ' fl-hit' : '') + (s === 3 ? ' fl-sunk' : '');
  el.innerHTML = s >= 2 ? FL_FLAME : '';
  el.setAttribute('aria-label', flName(i) + (s === 1 ? ' 빗나감' : s === 2 ? ' 명중' : s === 3 ? ' 격침' : ''));
}
function flPaintMy(i){
  const el = flMyCell(i); if(!el) return; const s = G.myShot[i], si = G.myMap ? G.myMap[i] : -1;
  const sunk = s === 2 && si >= 0 && G.my[si].hits >= G.my[si].len;
  el.className = 'fl-c' + (s === 1 ? ' fl-miss' : s === 2 ? ' fl-hit' : '') + (sunk ? ' fl-sunk' : '');
  el.innerHTML = s === 2 ? FL_FLAME : '';
}
function flPaintAim(){
  const a = G.aimI, sv = G.fx && G.fx.salvo ? G.salvoSel : null;
  document.querySelectorAll('#flEn .fl-c').forEach(el => {
    const i = +el.dataset.i, on = sv ? sv.includes(i) : i === a, line = !sv && a >= 0 && !on && (Math.floor(i / 10) === Math.floor(a / 10) || i % 10 === a % 10);
    el.classList.toggle('aim', on); el.classList.toggle('hl', line);
    const x = el.querySelector('.xh'); if(on && !x){ const d = document.createElement('span'); d.className = 'xh'; d.innerHTML = FL_XH; el.appendChild(d); } else if(!on && x) x.remove();
  });
  const t = $('#flAimT'); if(t) t.textContent = sv ? '' : a >= 0 ? flName(a) : '';
  if(sv){ const L = $('#flFireL'), need = flSalvoNeed(); if(L) L.textContent = sv.length >= need && need > 0 ? need + '발 발사!' : sv.length + '/' + need + ' 조준'; }
  flTurnUI();
}
function flFleetUI(){
  const ef = $('#flEnFleet');
  if(ef && G.fx && G.fx.silent && !G.ending) ef.innerHTML = `<span class="fl-sil" title="침묵 함대: 격침을 알려 주지 않아요">${FL_I.mute}<span>격침 비공개 · 명중 <b>${G.hitsN}</b>/${FL_TOTAL}</span></span>`;
  else if(ef){ const used = G.enSunk.map(sp => sp.idx); ef.innerHTML = FL_SHIPS.map((S, j) => flShipSvg(S.k, S.len, false, 'fl-mini' + (used.includes(j) ? ' dead' : ''), 10)).join(''); }
  const ml = $('#flMyList');
  if(ml) ml.innerHTML = G.my.map(s => `<div class="fl-row${s.hits >= s.len ? ' dead' : ''}">${flShipSvg(s.k, s.len, false, 'fl-mini', 10)}<span>${s.n === '항공모함' ? '항모' : s.n}</span><span class="fl-pips">${[...Array(s.len)].map((_, k) => `<i class="${k < s.hits ? 'x' : ''}"></i>`).join('')}</span></div>`).join('');
}
function flStats(){
  const n = flShotN(), s = $('#flShots'), a = $('#flAcc');
  if(s) s.textContent = G.fx && G.fx.tight ? Math.max(0, G.fx.tight - n) : n; if(a) a.textContent = n ? Math.round(G.hitsN / n * 100) + '%' : '–';
}
function flLog(html){ G.log.unshift(html); G.log = G.log.slice(0, 3); flLogUI(); }
function flLogUI(){ const l = $('#flLog'); if(l) l.innerHTML = G.log.map(x => `<div>${x}</div>`).join('') || '<div>포격 기록이 여기에 나와요</div>'; }
function flBanner(sel, text, cls, sub, stay){
  const p = $(sel); if(!p) return;
  p.querySelectorAll('.fl-banner').forEach(e => e.remove());
  const d = document.createElement('div'); d.className = 'fl-banner ' + (cls || '') + (stay ? ' stay' : '');
  d.innerHTML = flEsc(text) + (sub ? `<small>${flEsc(sub)}</small>` : ''); p.appendChild(d);
  if(!stay) setTimeout(() => d.remove(), 1700);
}
function flFlash(sel){ const p = $(sel); if(!p) return; const d = document.createElement('div'); d.className = 'fl-flash'; p.appendChild(d); setTimeout(() => d.remove(), 520); }
function flShake(sel){ const p = $(sel); if(!p || FXR.reduce) return; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }

/* 차례 */
function flTurn(){
  if(G.phase !== 'battle' || G.ending) return 'end';
  if(G.pending >= 0 || G.busy) return 'wait';
  if(G.mode === 'ai') return G.turn;
  if(G.opp.sh.length > G.an.length || G.busyIn) return 'op';
  const miss = r => !(r === 1 || Array.isArray(r));
  let t = G.first ? 'me' : 'op', i = 0, j = 0;
  for(let n=0; n<400; n++){
    if(t === 'me'){ if(i >= G.sh.length) return 'me'; if(i >= G.opp.an.length) return 'wait'; if(miss(G.opp.an[i++])) t = 'op'; }
    else { if(j >= G.opp.sh.length) return 'op'; if(j >= G.an.length) return 'op'; if(miss(G.an[j++])) t = 'me'; }
  }
  return 'op';
}
function flTurnUI(){
  const pill = $('#flTurn'); if(!pill || G.phase !== 'battle') return;
  const t = flTurn();
  if(t !== G.lastTurn){
    if(t === 'me'){ G.turnAt = Date.now(); if(G.mode === 'pvp'){ flSound('ping'); G.myDl = flNow() + flTurnSec() * 1000 + Math.max(0, 1700 - (Date.now() - G.start));   /* 첫 차례는 '전투 개시' 알림이 지나간 뒤부터 */ if(G.nr) G.nr.presence({ td:G.myDl, tk:G.sh.length }).catch(() => {}); } }
    if(t === 'op') G.opSince = Date.now();
    G.lastTurn = t;
  }
  let txt = t === 'me' ? (G.radarMode ? '레이더 칸 고르기' : G.fx && G.fx.salvo ? '내 차례 · 3발' : '내 차례') : t === 'wait' ? '포탄 비행 중' : t === 'end' ? '전투 종료' : G.mode === 'ai' ? '컴퓨터 조준 중' : '상대 차례';
  let left = -1;
  if(G.fx && G.fx.flash && t === 'me' && G.turnAt) left = Math.max(0, Math.ceil(G.fx.turnSec - (Date.now() - G.turnAt) / 1000));   /* 번개: 차례 시계 */
  if(G.mode === 'pvp' && t === 'me' && G.myDl) left = Math.max(0, Math.ceil((G.myDl - flNow()) / 1000));
  if(G.mode === 'pvp' && t === 'op' && !G.busyIn && G.oppDl && G.oppDl > flNow() - 1500) left = Math.max(0, Math.ceil((G.oppDl - flNow()) / 1000));
  if(left >= 0) txt += ' · ' + left + '초';
  pill.className = 'fl-turn' + (t === 'me' ? ' me' : t === 'op' || t === 'ai' ? ' op' : '') + (left >= 0 && left <= 2 ? ' hurry' : '');
  pill.innerHTML = '<i></i>' + txt;
  const en = $('#flEn'), p = $('#flEnP'), f = $('#flFire');
  if(en) en.classList.toggle('live', t === 'me');
  if(p) p.classList.toggle('dim', t !== 'me' && t !== 'wait' && t !== 'end');
  if(f){ f.disabled = t !== 'me' || (G.fx && G.fx.salvo ? G.salvoSel.length < flSalvoNeed() || !flSalvoNeed() : G.aimI < 0); f.classList.toggle('ready', !f.disabled); }
  const rb = $('#flRdr'); if(rb){ rb.disabled = t !== 'me' || !G.radarN; rb.classList.toggle('on', !!G.radarMode); rb.setAttribute('aria-pressed', !!G.radarMode); if(en) en.classList.toggle('rdr', !!G.radarMode); }
}
function flTimerTick(){
  if(G.phase !== 'battle' || G.over || G.ending) return;
  flTurnUI();
  const t = flTurn();
  if(G.mode === 'pvp' && t === 'me' && G.myDl && flNow() >= G.myDl){
    /* 칸을 조준해 두었으면(한 번만 누름) 넘기지 않고 그 칸에 쏜다. 아무 칸도 안 골랐을 때만 차례를 넘김 */
    if(G.aimI >= 0 && flCanShoot(G.aimI) && !G.enShot[G.aimI]){ toast('시간이 다 돼서 조준한 칸에 쐈어요'); flFire(G.aimI); }
    else flPass();
    return;
  }
  if(G.mode !== 'pvp' && t === 'me' && (Date.now() - G.turnAt) / 1000 >= (G.fx ? G.fx.turnSec : FL_TURN)){
    if(G.fx && G.fx.salvo){ G.radarMode = false; const open = flOpenCells().filter(i => !G.salvoSel.includes(i)); while(G.salvoSel.length < flSalvoNeed() && open.length) G.salvoSel.push(open.splice(Math.floor(Math.random() * open.length), 1)[0]); toast('시간이 지나 자동으로 발사했어요'); flSalvoFire(); return; }
    G.radarMode = false;
    const open = [...Array(100).keys()].filter(i => !G.enShot[i]);
    const i = G.aimI >= 0 && !G.enShot[G.aimI] ? G.aimI : open[Math.floor(Math.random() * open.length)];
    toast('시간이 지나 자동으로 발사했어요'); flFire(i);
  }
  if(t === 'op' && !G.busyIn && G.opSince && Date.now() - G.opSince > Math.max(30000, (flTurnSec() + 20) * 1000)){ G.forfeit = true; toast('상대가 응답하지 않아 기권승 처리했어요'); flEnd(true); }
}

/* 시간 초과로 차례 넘기기: 쏜 칸 목록에 -1을 올리고, 상대는 '빗나감(0)'으로 답해 차례가 넘어간다 */
function flPass(){
  if(G.over || G.ending || G.phase !== 'battle' || G.mode !== 'pvp' || flTurn() !== 'me') return;
  G.pending = -1; G.sh.push(-1); G.aimI = -1; G.myDl = 0; flPaintAim();
  if(G.nr) G.nr.presence({ sh:G.sh, td:0 }).catch(() => {});
  toast('시간 초과! 차례가 상대에게 넘어갔어요'); flSound('bad'); fxBuzz([40, 40, 40]);
  flLog('<span class="m">시간 초과</span> · 차례를 넘겼어요');
  flTurnUI(); flSync();
}

/* 조준·발사 */
function flAim(i){
  if(G.over || G.ending || G.phase !== 'battle' || !flCanShoot(i)) return;
  if(flTurn() !== 'me'){ toast(G.mode === 'ai' ? '컴퓨터가 쏘는 중이에요' : '상대 차례예요'); return; }
  if(G.fx && G.fx.salvo){   /* 연발: 세 칸까지 골랐다 풀었다 */
    const k = G.salvoSel.indexOf(i);
    if(k >= 0) G.salvoSel.splice(k, 1);
    else if(G.salvoSel.length < flSalvoNeed()) G.salvoSel.push(i);
    else { toast(flSalvoNeed() + '칸을 모두 골랐어요. 발사하거나, 고른 칸을 다시 눌러 풀어요'); return; }
    const c = flEnCell(i); flSound(k >= 0 ? 'bad' : 'aim', c ? panX(fxCenter(c).x) : 0); fxBuzz(8); flPaintAim(); return;
  }
  if(G.aimI === i){ flFire(i); return; }
  G.aimI = i; const c = flEnCell(i); flSound('aim', c ? panX(fxCenter(c).x) : 0); fxBuzz(8); flPaintAim();
}
function flFromShip(){
  const alive = G.my.map((s, k) => [s, k]).filter(([s]) => s.hits < s.len);
  const pick = alive.length ? alive[Math.floor(Math.random() * alive.length)][1] : 0;
  return document.querySelector(`#flMyShips .fl-ship[data-s="${pick}"]`) || $('#flMy');
}
function flFire(i){
  if(G.over || G.ending || G.phase !== 'battle' || i == null || i < 0 || !flCanShoot(i) || flTurn() !== 'me') return;
  G.radarMode = false;
  G.busy = true; G.pending = i; G.sh.push(i); G.aimI = -1; G.myDl = 0; flPaintAim(); flStats();
  if(G.mode === 'pvp' && G.nr) G.nr.presence({ sh:G.sh, td:0 }).catch(() => {});
  const me = G;
  flShell(flFromShip(), flEnCell(i), false, () => {
    if(G !== me || G.over) return;
    G.busy = false;
    if(G.mode === 'ai') flMyResult(i, flAiReceive(i));
    else flSync();
  });
  flTurnUI();
}
function flShell(fromEl, toEl, en, done){
  flSound('fire', fromEl ? panX(fxCenter(fromEl).x) : 0);
  if(!fromEl || !toEl || FXR.reduce){ setTimeout(done, 120); return; }
  const a = fxCenter(fromEl), b = fxCenter(toEl), d = document.createElement('div');
  d.className = 'fl-shell' + (en ? ' en' : ''); document.body.appendChild(d);
  const dx = b.x - a.x, dy = b.y - a.y, lift = -Math.min(170, Math.abs(dy) * .35 + 70);
  fxBurst(a.x, a.y, ['#FFE8A0', '#FFFFFF', '#FFB347'], 8, { speed:140, size:3, kinds:['dot'], g:0, up:0, dur:.35 });
  d.animate([
    { transform:`translate(${a.x}px, ${a.y}px) scale(.5)` },
    { transform:`translate(${a.x + dx * .5}px, ${a.y + dy * .5 + lift}px) scale(1.5)`, offset:.5 },
    { transform:`translate(${b.x}px, ${b.y}px) scale(.8)` }
  ], { duration:430, easing:'cubic-bezier(.45,0,.55,1)', fill:'forwards' }).onfinish = () => { d.remove(); done(); };
}
function flSplash(el, small){
  if(!el) return; const p = fxCenter(el);
  fxRing(p.x, p.y, '#CFEFFF', p.w * (small ? 1.3 : 1.8), .55, 6);
  fxBurst(p.x, p.y, ['#E6F7FF', '#8FD3FF', '#FFFFFF', '#5DB8F0'], small ? 10 : 18, { speed:small ? 120 : 170, size:small ? 2.6 : 3.6, kinds:['dot'], g:900, up:small ? 150 : 230, dur:.7 });
  if(!small) fxRing(p.x, p.y, 'rgba(207,239,255,.6)', p.w * 2.6, .9, 3);
  flSound('splash', panX(p.x));
}
function flBoom(el, big, small){
  if(!el) return; const p = fxCenter(el), k = small ? .8 : 1.3;   /* 2026-10-06: 폭발을 더 크게 */
  fxRing(p.x, p.y, '#FFF3C4', p.w * (big ? 3 : 2) * k, .5, 10);
  fxRing(p.x, p.y, '#FF6A2B', p.w * (big ? 4.2 : 2.8) * k, .75, 6);
  fxBurst(p.x, p.y, ['#FFD84A', '#FF7A1A', '#FF3B30', '#FFFFFF', '#555A60'], (big ? 30 : 20) * k | 0, { speed:(big ? 360 : 260) * k, size:(big ? 6 : 4.6) * k, kinds:['star', 'dot', 'rect'], g:420, up:110 });
  fxBurst(p.x, p.y, ['#FFE9A0', '#FFB347'], (big ? 14 : 8) * k | 0, { speed:(big ? 420 : 300) * k, size:3.5 * k, kinds:['spark'], g:300, up:60, glow:true, dur:.55 });
  /* 이펙트 v2: 피어오르며 커지는 연기 + 불빛, 격침은 화면이 따뜻하게 번쩍 */
  fxEmit(p.x, p.y - p.h * .2, { quantity:big ? 9 : 5, speed:{ min:14, max:46 }, angle:{ min:235, max:305 }, lifespan:{ min:900, max:1500 }, kind:'smoke', tint:['#4E525C', '#6B6F7A', '#3E414A'], scale:{ start:(big ? 9 : 7) * k, end:(big ? 26 : 18) * k, ease:'cubic.out' }, alpha:{ start:.55, end:0, ease:'quad.in' }, gravityY:-30, drag:.6 });
  fxEmit(p.x, p.y, { quantity:1, speed:0, lifespan:300, kind:'glow', tint:['#FFB347'], scale:{ start:(big ? 16 : 11) * k, end:(big ? 26 : 18) * k, ease:'expo.out' }, alpha:{ start:.9, end:0, ease:'quad.out' } });
  if(big) fxFlash('#FF9A3C', .2, 320);
  flSound(big ? 'sink' : 'boom', panX(p.x));
}
function flSunkInfo(cells, kIdx){
  cells = cells.slice().sort((a, b) => a - b);
  const idx = kIdx != null ? kIdx : flKind(cells.length, G.enSunk.map(sp => sp.idx));
  return { cells, x:cells[0] % 10, y:Math.floor(cells[0] / 10), v:cells.length > 1 && cells[1] - cells[0] === 10, len:cells.length, idx, k:FL_SHIPS[idx].k, n:FL_SHIPS[idx].n };
}

/* 내가 쏜 결과: 0 빗나감, 1 명중, [칸들] 격침 */
function flMyResult(i, r){
  G.pending = -1;
  if(i < 0){ flTurnUI(); flSync(); return; }   /* 시간 초과 넘김 */
  const cell = flEnCell(i), again = flMyApply(i, r);
  flFleetUI(); flStats();
  if(G.enSunk.length >= FL_SHIPS.length){ flEnd(true); return; }
  if(flOutOfAmmo()) return;
  if(again) setTimeout(() => { const q = cell && fxCenter(cell); if(q && !G.ending) fxFloat(q.x, q.y + q.h * .2, '한 번 더!', 'flf s'); }, 380);
  if(G.mode === 'ai'){
    if(again){ G.turn = 'me'; flTurnUI(); }
    else { G.turn = 'ai'; flTurnUI(); const me = G; setTimeout(() => { if(G === me) flAiTurn(); }, 700); }
  } else flTurnUI();
}
/* 한 발의 결과를 판에 그린다(연발은 세 발을 모아 한꺼번에). 명중이면 true */
function flMyApply(i, r){
  const cell = flEnCell(i), p = cell ? fxCenter(cell) : null, fx = G.fx;
  if(!(r === 1 || Array.isArray(r))){
    const re = !!(fx && G.enShot[i] === 1);   /* 안개로 사라진 칸을 또 쏨 */
    G.enShot[i] = 1; if(fx){ G.fogged.delete(i); G.missAt[i] = G.myTurnN; }
    flPaintEn(i); flSplash(cell);
    if(p) fxFloat(p.x, p.y - p.h * .5, re ? '이미 쏜 칸!' : '빗나감', 'flf m');
    flLog(`<b>${flName(i)}</b> 포격 · <span class="m">${re ? '이미 쏜 칸이었어요' : '빗나감'}</span>`);
    return false;
  }
  G.hitsN++; G.enShot[i] = 2;
  if(Array.isArray(r)){
    const cells = r.map(c => c | 0).filter(c => c >= 0 && c < 100 && (G.enShot[c] || c === i));
    const kIdx = G.mode === 'ai' && G.enMap[i] >= 0 ? FL_SHIPS.findIndex(S => S.k === G.en[G.enMap[i]].k) : null;
    const sp = flSunkInfo(cells.length ? cells : [i], kIdx); G.enSunk.push(sp);
    if(fx && fx.silent){   /* 침묵 함대: 격침은 몰래 기록만, 화면엔 명중으로 */
      flPaintEn(i); flBoom(cell); flShake('#flEnP'); fxBuzz([25, 30, 25]);
      if(p) fxFloat(p.x, p.y - p.h * .5, '명중!', 'flf h');
      flLog(`<b>${flName(i)}</b> 포격 · <span class="h">명중!</span>`);
      return true;
    }
    cells.forEach(c => G.enShot[c] = 3);
    cells.forEach((c, k) => setTimeout(() => { flPaintEn(c); flBoom(flEnCell(c), k === 0, false); }, k * 110));
    setTimeout(() => { const L = $('#flEnShips'); if(L) L.insertAdjacentHTML('beforeend', flShipEl(sp, 0, 'wreck pop')); }, cells.length * 110);
    if(fx && fx.mark){   /* 적 배는 서로 붙지 않으니 둘레는 '배 없음' */
      const around = [...new Set(cells.flatMap(flArea))].filter(j => !G.enShot[j]);
      around.forEach(j => G.enShot[j] = 5);
      setTimeout(() => { if(G.fx === fx) around.forEach(flPaintEn); }, cells.length * 110 + 200);
    }
    flFlash('#flEnP'); flShake('#flEnP'); fxBuzz([40, 40, 90]);
    flBanner('#flEnP', '격침!', 'hot', '적 ' + sp.n + ' (' + sp.len + '칸) 침몰');
    if(p) fxFloat(p.x, p.y - p.h * .5, '격침!', 'flf s');
    flLog(`<b>${flName(i)}</b> · <span class="s">적 ${sp.n} 격침!</span>`);
  } else {
    flPaintEn(i); flBoom(cell); flShake('#flEnP'); fxBuzz([25, 30, 25]);
    if(p) fxFloat(p.x, p.y - p.h * .5, '명중!', 'flf h');
    flLog(`<b>${flName(i)}</b> 포격 · <span class="h">명중!</span>`);
  }
  return true;
}
/* ----- 솔로 규칙 도우미(G.fx가 있을 때만) ----- */
function flCanShoot(i){ const s = G.enShot[i]; return !s || (s === 1 && !!G.fogged && G.fogged.has(i)); }
function flOpenCells(){ return [...Array(100).keys()].filter(flCanShoot); }
function flSalvoNeed(){ return Math.max(0, Math.min(3, flOpenCells().length, G.fx && G.fx.tight ? G.fx.tight - flShotN() : 3)); }
function flOutOfAmmo(){
  if(!G.fx || !G.fx.tight || flShotN() < G.fx.tight || G.enSunk.length >= FL_SHIPS.length) return false;
  flEnd(false, 'ammo'); return true;
}
function flRuleNames(){
  const fx = G && G.fx; if(!fx) return '';
  return [...fx.mj, fx.tw].filter(Boolean).map(k => (conceptInfo('fleet', k) || {}).name || k).join(' · ');
}
function flSoloTip(){
  const fx = G.fx; if(!fx) return '';
  let t = `솔로 스테이지 ${G.adv} · ★★★ ${fx.th[1]}발 · ★★ ${fx.th[0]}발 이하로 이기기`;
  if(fx.tight) t += `<br><b>포탄은 ${fx.tight}발뿐!</b> 다 쓰기 전에 모두 격침해요.`;
  if(fx.first) t += '<br>이번엔 AI가 먼저 쏴요.';
  if(fx.island) t += '<br>섬에는 배를 둘 수 없어요.';
  return t;
}
const FL_ISLE = '<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="28" rx="17" ry="8.5" fill="#E9CF8E" stroke="#7A5A22" stroke-width="2.2"/><ellipse cx="20" cy="30.5" rx="18.5" ry="8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4" stroke-dasharray="3 3"/><path d="M19 28c0-7 1.5-11 4-15" stroke="#6B4420" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M23 12.5c-4-3.5-9.5-2.5-12 .5 4.5-1 7.5.2 12-.5zM23 12.5c3-4.5 8.5-4.5 11-2.2-4.5 0-7.5 1-11 2.2zM23 12.5c.7-4.5-1.5-7.5-5-8.5 2.4 3 3.6 5.5 5 8.5zM23 12.5c4.5 0 7.5 3.2 7.5 6.5-2.3-3.2-4.5-4.4-7.5-6.5z" fill="#34A04A" stroke="#1F6B2E" stroke-width=".8"/><ellipse cx="11.5" cy="29" rx="4.2" ry="2.3" fill="#9A9A9A" stroke="#555" stroke-width="1"/></svg>';
function flRockLayer(){
  const r = G && G.fx ? G.fx.rocks : null; if(!r || !r.length) return '';
  return `<div class="fl-rocks" aria-hidden="true">${r.map(c => `<span class="fl-isl" style="left:${c % 10 * 10}%;top:${Math.floor(c / 10) * 10}%">${FL_ISLE}</span>`).join('')}</div>`;
}
/* 내 차례가 새로 시작될 때: 안개 변주면 오래된 빗나감 표시가 사라진다(내 차례 3번 뒤) */
function flMyTurnStart(){
  if(!G.fx) return;
  G.myTurnN++;
  if(!G.fx.fog) return;
  const fade = [];
  for(const c in G.missAt) if(G.myTurnN - G.missAt[c] >= 3){ if(G.enShot[c] === 1 && !G.fogged.has(+c)) fade.push(+c); delete G.missAt[c]; }
  fade.forEach(c => { G.fogged.add(c); const el = flEnCell(c); if(el){ el.classList.add('fl-fading'); setTimeout(() => { if(G.fogged && G.fogged.has(c)) flPaintEn(c); }, 700); } });
  if(fade.length) flLog(`<span class="m">안개</span> · 빗나간 표시 ${fade.length}개가 사라졌어요`);
}
/* 레이더: 내 차례에 버튼 → 칸 고르기. 차례를 쓰지 않는다 */
function flRadarToggle(){
  if(!G.fx || !G.radarN || flTurn() !== 'me') return;
  G.radarMode = !G.radarMode; flSound(G.radarMode ? 'ping' : 'aim'); fxBuzz(10);
  if(G.radarMode) toast('레이더로 훑을 칸을 눌러요 · 그 둘레 3×3을 살펴요');
  flTurnUI();
}
function flRadarUse(i){
  if(!G.radarMode || !G.radarN || flTurn() !== 'me'){ G.radarMode = false; flTurnUI(); return; }
  G.radarMode = false; G.radarN--;
  const area = flArea(i), yes = area.some(j => G.enMap[j] >= 0 && !G.enShot[j]);   /* 아직 안 맞힌 적 배 칸이 있나 */
  G.radarMarks.push({ c:i, yes });
  if(!yes) area.forEach(j => { if(!G.enShot[j]){ G.enShot[j] = 5; flPaintEn(j); } });
  flRadarDraw(true); flSound(yes ? 'lock' : 'ping'); fxBuzz(yes ? [20, 40, 20] : 15);
  flBanner('#flEnP', yes ? '배 있음!' : '배 없음', yes ? 'hot' : 'good', flName(i) + ' 둘레 3×3' + (yes ? ' 안에 적 배가 있어요' : '는 비었어요'));
  flLog(`레이더 <b>${flName(i)}</b> · ${yes ? '<span class="h">배 있음!</span>' : '<span class="m">배 없음</span>'}`);
  const n = $('#flRdrN'); if(n) n.textContent = G.radarN;
  flTurnUI();
}
function flRdBox(c, cls, label){
  const r = Math.floor(c / 10), q = c % 10, x0 = Math.max(0, q - 1), y0 = Math.max(0, r - 1), x1 = Math.min(9, q + 1), y1 = Math.min(9, r + 1);
  return `<div class="fl-rdo ${cls}" style="left:${x0 * 10}%;top:${y0 * 10}%;width:${(x1 - x0 + 1) * 10}%;height:${(y1 - y0 + 1) * 10}%"><span>${label}</span></div>`;
}
function flRadarDraw(fresh){
  const L = $('#flRdl'); if(!L || !G.radarMarks) return;
  L.innerHTML = G.radarMarks.map((m, k) => flRdBox(m.c, (m.yes ? 'yes' : 'no') + (fresh && k === G.radarMarks.length - 1 ? ' new' : ''), m.yes ? '배 있음' : '배 없음')).join('');
}
/* AI 레이더(레이더 규칙 판, 높은 스테이지): 명중이 없을 때 60% 확률로 확률 지도가 가장 진한 3×3을 훑는다 */
function flAiRadarMaybe(){
  if(!G.fx || !G.aiRadarN || G.aiKnow.some(v => v === 2) || Math.random() >= .6) return false;
  G.aiRadarN--;
  const c = flRadarPick(G.aiKnow, G.aiSunk, Math.random), area = flArea(c), yes = area.some(j => G.myMap[j] >= 0 && G.myShot[j] !== 2);
  if(yes) G.aiHot = area; else area.forEach(j => { if(!G.aiKnow[j]) G.aiKnow[j] = 5; });
  const L = $('#flMyRdl'); if(L){ L.innerHTML = flRdBox(c, 'en new', yes ? '들켰어요!' : '무사'); setTimeout(() => { if(L.isConnected) L.innerHTML = ''; }, 1800); }
  flSound('ping'); fxBuzz([20, 30, 20]);
  flBanner('#flMeP', '적 레이더!', 'hot', yes ? '우리 배를 찾아냈어요' : '거기엔 우리 배가 없어요');
  flLog(`<span class="h">적 레이더</span> · 우리 ${flName(c)} 둘레를 훑었어요`);
  return true;
}
/* 연발 포격: 고른 세 칸을 한꺼번에 쏘고, 모두 떨어진 뒤 결과를 한꺼번에 */
function flSalvoFire(){
  if(G.over || G.ending || G.phase !== 'battle' || flTurn() !== 'me') return;
  const need = flSalvoNeed(), sel = G.salvoSel.filter(flCanShoot).slice(0, need);
  if(!need || sel.length < need) return;
  G.radarMode = false; G.busy = true; G.salvoSel = []; sel.forEach(i => G.sh.push(i)); flPaintAim(); flStats();
  const me = G, sunk0 = G.enSunk.length; let landed = 0;
  sel.forEach((i, k) => setTimeout(() => {
    if(G !== me || G.over) return;
    flShell(flFromShip(), flEnCell(i), false, () => {
      if(G !== me || G.over || ++landed < sel.length) return;
      G.busy = false;
      let hits = 0; sel.forEach(j => { if(flMyApply(j, flAiReceive(j))) hits++; });
      flFleetUI(); flStats();
      if(G.enSunk.length === sunk0 || G.fx.silent) flBanner('#flEnP', hits ? '명중 ' + hits + '발!' : '모두 빗나감', hits ? 'hot' : '', sel.length + '발 중 ' + hits + '발 명중');
      if(G.enSunk.length >= FL_SHIPS.length){ flEnd(true); return; }
      if(flOutOfAmmo()) return;
      G.turn = 'ai'; flTurnUI(); setTimeout(() => { if(G === me) flAiTurn(); }, 1000);
    });
  }, k * 150));
  flTurnUI();
}
/* 적 포격이 우리 함대에 떨어짐 */
function flReceive(i){
  if(G.myShot[i]) return G.myShot[i] === 1 ? 0 : 1;
  const si = G.myMap[i];
  if(si < 0){ G.myShot[i] = 1; return 0; }
  G.myShot[i] = 2; const s = G.my[si]; s.hits++; G.myLeft--;
  return s.hits >= s.len ? flCells(s) : 1;
}
function flEnemyAim(i, done, quick){
  const xh = $('#flXh'); if(!xh){ done(); return; }
  const hops = quick ? [i] : [Math.floor(Math.random() * 100), Math.floor(Math.random() * 100), i];
  xh.classList.add('on'); let k = 0; const me = G;
  const step = () => {
    if(G !== me) return;
    const c = hops[k++]; xh.style.left = (c % 10) * 10 + '%'; xh.style.top = Math.floor(c / 10) * 10 + '%'; flSound('aim');
    if(k < hops.length) setTimeout(step, 230);
    else setTimeout(() => {
      if(G !== me) return;
      xh.classList.remove('lock'); void xh.offsetWidth; xh.classList.add('lock'); flSound('lock');
      setTimeout(() => { if(G === me) flShell($('#flEn'), flMyCell(i), true, () => { xh.classList.remove('on'); if(G === me) done(); }); }, 240);
    }, 240);
  };
  step();
}
function flIncoming(i, r){
  const cell = flMyCell(i);
  flPaintMy(i);
  if(r === 0){ flSplash(cell, true); flLog(`적 포격 <b>${flName(i)}</b> · <span class="m">빗나감</span>`); }
  else if(Array.isArray(r)){
    const s = G.my[G.myMap[i]];
    r.forEach((c, k) => setTimeout(() => { flPaintMy(c); flBoom(flMyCell(c), k === 0, true); }, k * 110));
    const el = document.querySelector(`#flMyShips .fl-ship[data-s="${G.myMap[i]}"]`); if(el) el.classList.add('wreck');
    flFlash('#flMeP'); flShake('#flMeP'); fxVignette(); fxBuzz([80, 50, 140]);
    flBanner('#flMeP', '침몰…', 'hot', '우리 ' + s.n + '이(가) 가라앉았어요');
    flLog(`<span class="h">우리 ${s.n} 침몰</span> · ${flName(i)}`);
  } else { flBoom(cell, false, true); flShake('#flMeP'); fxVignette(); fxBuzz([60, 40, 60]); flLog(`적 포격 <b>${flName(i)}</b> · <span class="h">피격!</span>`); }
  flFleetUI();
}

/* ----- AI ----- */
function flAiReceive(i){ const si = G.enMap[i]; if(si < 0) return 0; const s = G.en[si]; s.hits++; return s.hits >= s.len ? flCells(s) : 1; }
function flNb(i){ const r = Math.floor(i / 10), c = i % 10, o = []; if(r) o.push(i - 10); if(r < 9) o.push(i + 10); if(c) o.push(i - 1); if(c < 9) o.push(i + 1); return o; }
function flAiPick(){
  const lvl = G.fx ? flAiLvl(G.fx.aiQ, Math.random) : G.ai === 'easy' ? 0 : G.ai === 'normal' ? 1 : 2;
  return flAiPickK(G.aiKnow, G.aiSunk, lvl, Math.random, G.aiHot);
}
function flAiTurn(cont){
  if(G.over || G.ending || G.id !== 'fleet') return;
  if(G.paused || $('#veil').classList.contains('on')){ const me = G; setTimeout(() => { if(G === me) flAiTurn(cont); }, 400); return; }
  if(G.fx){
    const me = G;
    if(!cont) G.aiTurnN++;
    if(G.fx.silent) flSilentResolve(G.aiKnow, G.aiSunk);
    if(flAiRadarMaybe()){ setTimeout(() => { if(G === me) (G.fx.salvo ? flAiSalvo() : flAiShoot()); }, 1100); return; }
    if(G.fx.salvo){ flAiSalvo(); return; }
  }
  flAiShoot();
}
function flAiShoot(){
  const i = flAiPick(), me = G;
  flEnemyAim(i, () => {
    if(G !== me || G.over) return;
    const r = flReceive(i);
    flAiLearn(i, r);
    flIncoming(i, r);
    if(G.myLeft <= 0){ flEnd(false); return; }
    if(r !== 0){ G.turn = 'ai'; flTurnUI(); setTimeout(() => { if(G === me) flAiTurn(true); }, 900); return; }
    G.turn = 'me'; flMyTurnStart(); flTurnUI();
  });
}
function flAiLearn(i, r){
  G.aiKnow[i] = r === 0 ? 1 : 2;
  if(Array.isArray(r) && !(G.fx && G.fx.silent)){ r.forEach(c => G.aiKnow[c] = 3); G.aiSunk.push(r.length); }
  if(G.fx){ if(r !== 0) G.aiHot = null; if(G.aiHot && !G.aiHot.some(j => !G.aiKnow[j])) G.aiHot = null; }
}
function flAiSalvo(){
  const me = G, K2 = G.aiKnow.slice(), picks = [];
  for(let k = 0; k < 3; k++){ const i = flAiPickK(K2, G.aiSunk, flAiLvl(G.fx.aiQ, Math.random), Math.random, G.aiHot); if(i < 0) break; picks.push(i); K2[i] = 6; }
  let k = 0;
  const next = () => {
    if(G !== me || G.over || G.ending) return;
    if(k >= picks.length){ G.turn = 'me'; flMyTurnStart(); flTurnUI(); return; }
    const i = picks[k++];
    flEnemyAim(i, () => {
      if(G !== me || G.over) return;
      const r = flReceive(i); flAiLearn(i, r); flIncoming(i, r);
      if(G.myLeft <= 0){ flEnd(false); return; }
      setTimeout(next, 260);
    }, k > 1);
  };
  next();
}

/* ----- 실시간 동기화: 서로의 presence(쏜 칸 목록 sh, 받은 포격 답 an)만으로 진행 ----- */
function flSync(){
  if(!G || G.id !== 'fleet' || !G.nr || G.over) return;
  let opp = null; try{ const ps = G.nr.peers(); opp = ps.find(p => p.peer === G.oppPeer && !p.sameTab) || ps.find(p => !p.sameTab); }catch(_){}
  if(opp && opp.peer !== G.oppPeer){ G.oppPeer = opp.peer; }
  if(G.oppGone){
    if(opp){ G.oppGone = 0; toast('상대가 다시 연결됐어요'); }
    else if(Date.now() - G.oppGone > 15000){ G.oppGone = 0; flOppLeft(); return; }
  }
  if(!opp){ if(G.phase === 'joining' && Date.now() - G.joinT > 12000) flMatchFail(); return; }
  const o = opp.presence || {};
  if(Array.isArray(o.rv)) G.oppRv = o.rv;
  if(G.phase === 'joining'){
    if(o.v === 1){ G.oppSeen = true; if(typeof o.nk === 'string') G.oppNick = o.nk.slice(0, 12); flStartBattle(); }
    else if(Date.now() - G.joinT > 12000) flMatchFail();
    return;
  }
  if(G.phase !== 'battle' || G.ending) return;
  G.opp = { sh:Array.isArray(o.sh) ? o.sh : [], an:Array.isArray(o.an) ? o.an : [] };
  G.oppDl = typeof o.td === 'number' ? o.td : 0;
  if(!G.busyIn && G.opp.sh.length > G.an.length && G.opp.sh[G.an.length] === -1){
    G.an.push(0); G.nr.presence({ an:G.an }).catch(() => {});
    G.opSince = Date.now(); G.oppDl = 0;
    flLog('상대가 <span class="m">시간 초과</span> · 내 차례예요');
    flTurnUI(); flSync(); return;
  }
  if(!G.busyIn && G.opp.sh.length > G.an.length){
    const i = Math.max(0, Math.min(99, G.opp.sh[G.an.length] | 0)), r = flReceive(i);
    G.an.push(r); G.nr.presence({ an:G.an }).catch(() => {});
    G.opSince = Date.now();   /* 상대가 쏘고 있으면 응답 없음이 아님(연속 명중 중 기권승 오판 방지) */
    G.busyIn = true; flTurnUI(); const me = G;
    flEnemyAim(i, () => { if(G !== me) return; G.busyIn = false; flIncoming(i, r); if(G.myLeft <= 0){ flEnd(false); return; } flSync(); }, true);
    return;
  }
  if(!G.busy && G.shown < Math.min(G.opp.an.length, G.sh.length)){ const k = G.shown++; flMyResult(G.sh[k], G.opp.an[k]); return; }
  flTurnUI();
}

/* ----- 끝 ----- */
function flEnd(win, why){
  if(G.over || G.ending) return;
  G.ending = true; G.aimI = -1; if(G.fx){ G.radarMode = false; G.salvoSel = []; flPaintAim(); } flTurnUI();
  if(G.fx && G.fx.silent) flSilentReveal();
  if(G.nr) G.nr.presence({ rv:G.my.map(s => [s.x, s.y, s.v ? 1 : 0, s.len]) }).catch(() => {});
  clearInterval(G.mmIv);
  const me = G;
  if(win){
    flBanner('#flEnP', '승리!', 'good', G.forfeit ? '상대가 전투를 떠났어요' : '적 함대 전멸', true);
    setTimeout(() => { if(G !== me) return; fxConfetti(); sfx('win', { g:'fleet' }); fxBuzz([30, 60, 30, 60, 90]); document.querySelectorAll('#flMyShips .fl-ship:not(.wreck)').forEach((e, k) => { e.style.animationDelay = k * 90 + 'ms'; e.classList.add('bob'); }); }, 350);
  } else {
    if(why === 'ammo') flBanner('#flEnP', '포탄 바닥', 'hot', '포탄을 다 쓰기 전에 격침하지 못했어요', true);
    else flBanner('#flMeP', '패배', 'hot', '우리 함대가 모두 침몰했어요', true);
    flSound('sink');
    setTimeout(() => {   /* 남은 적 함선 공개 */
      if(G !== me) return;
      const L = $('#flEnShips'); if(!L) return;
      let ships = [];
      if(G.mode === 'ai') ships = G.en.filter(s => s.hits < s.len);
      else if(Array.isArray(G.oppRv)){ const used = []; ships = G.oppRv.filter(a => Array.isArray(a) && a.length === 4).map(a => { const len = Math.max(2, Math.min(5, a[3] | 0)), j = flKind(len, used); used.push(j); return { ...FL_SHIPS[j], x:a[0] | 0, y:a[1] | 0, v:!!a[2], len }; })
        .filter(s => flInBounds(s) && !flCells(s).every(c => G.enShot[c] === 3)); }
      L.insertAdjacentHTML('beforeend', ships.map(s => flShipEl(s, 0, 'ghost pop')).join(''));
    }, 900);
  }
  setTimeout(() => { if(G === me && !G.over){ clearInterval(G.syncIv); finish(win); } }, win ? 1900 : 2300);
}

/* 침묵 함대: 끝나면 가라앉은 적 배를 공개 */
function flSilentReveal(){
  G.enSunk.forEach(sp => sp.cells.forEach(c => { G.enShot[c] = 3; flPaintEn(c); }));
  const L = $('#flEnShips'); if(L) L.innerHTML = G.enSunk.map(sp => flShipEl(sp, 0, 'wreck pop')).join('');
  flFleetUI();
}
/* 효과음(해전용): 공용 엔진의 함대 소리로 연결. pan = 좌우 위치 */
function flSound(kind, pan){
  const m = { fire:'flFire', splash:'flSplash', boom:'flBoom', sink:'flSink', ping:'flPing', aim:'flAim', lock:'flLock', bad:'flBad', horn:'flHorn' }[kind];
  if(m) sfx(m, { pan:pan || 0 });
}


/* ===================== 게임 정의(엔진이 이 게임을 부르는 창구) =====================
   이름·색·도움말·썸네일·챕터·난이도·시작·점수·별을 엔진(core/engine.js)에 알려 준다. 규칙은 games/CLAUDE.md의 '게임 정의 계약' 참고. */
NG.fleet = {
  name:'함대 결전', col:['#7FD6FF','#1A8CC4','#0B4A6E'], time:'약 5분', abil:'추리력',
  icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2.5h2V6h3.2l1 4.2H6.8l1-4.2H11z"/><path d="M2.6 11.6h18.8l-2.7 6.3a2 2 0 0 1-1.8 1.1H7.1a2 2 0 0 1-1.8-1.1z"/><path d="M1.8 21.6c1.7 0 1.7-1 3.4-1s1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  art(){
    let grid = ''; for(let k=1;k<10;k++) grid += `<path d="M${k * 16} 0v100M0 ${k * 10}h160" stroke="rgba(170,225,255,.14)" stroke-width="1"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="aSea" cx=".25" cy="0" r="1.1"><stop offset="0" stop-color="#2A8AC8"/><stop offset=".5" stop-color="#0F4A7A"/><stop offset="1" stop-color="#081F38"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#aSea)"/>${grid}
      <path d="M0 78q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      <g transform="translate(14 36) scale(.29)">${flShipBody('battle', 4)}</g>
      <g transform="translate(96 70) scale(.2)">${flShipBody('destroyer', 2)}</g>
      <circle cx="132" cy="28" r="9" fill="none" stroke="#CFEFFF" stroke-width="1.6" opacity=".8"/><circle cx="132" cy="28" r="4" fill="#DDF1FF"/>
      ${FL_FLAME.replace('<svg class="fl-flame" ', '<svg x="92" y="30" width="20" height="20" ')}
      <g transform="translate(110 42)"><circle r="11" fill="none" stroke="#FF4D4D" stroke-width="2" stroke-dasharray="10 4"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6" stroke="#FF4D4D" stroke-width="2" stroke-linecap="round"/></g></svg>`;
  },
  help:[['함대를 숨겨요','배를 끌어 옮기고, 탭하면 방향이 바뀌어요. 함선은 5척(5·4·3·3·2칸)이고 무작위 배치도 있어요.'],['맞히면 한 번 더','적 해역 칸을 눌러 조준하고 발사해요(같은 칸을 한 번 더 눌러도 발사). 명중(불꽃)하면 계속 쏘고, 빗나가면(물보라) 상대 차례예요. 한 척을 모두 맞히면 격침!'],['먼저 다 격침하면 승리','실시간 대전은 한 차례 10초(느긋하게 30초), 조준해 둔 칸이 있으면 시간이 다 될 때 그 칸에 쏴요. 상대가 없으면 컴퓨터와 붙어요. 적게 쏠수록, 내 배가 많이 남을수록 점수가 높아요.'],['솔로는 5판마다 새 규칙','섬·레이더·연발 포격·침묵 함대, 그리고 빠른 판·안개 같은 변주가 차례로 나와요. 이번 판 규칙은 위쪽 작은 표시에 보여요. 솔로에선 격침한 적 배 둘레가 자동으로 "배 없음"으로 칠해져요(적 배는 서로 붙어 있지 않아요).']],
  /* 도움말 v2(공용 WP3): 첫 화면 3줄(레이더·연발 포격·침묵 함대는 솔로 개념 카드로), 나머지는 '더 알아보기' */
  howto:{
    lines:[['배를 놓고 출격', '[자동으로 놓고 출격]을 누르면 바로 시작'], ['번갈아 적 바다를 쏴요', '칸을 눌러 조준 → [발사]'], ['맞히면 한 번 더', '적 배를 먼저 모두 가라앉히면 승리']],
    more:[['배 옮기기', '배를 끌어 옮기고, 누르면 방향이 바뀌어요. 배를 누른 뒤 ◀▲▼▶·⟳ 버튼으로도 옮길 수 있어요.'],
      ['실시간 대전', '한 차례 10초(느긋하게 30초, 같은 속도끼리 짝). 조준해 둔 칸이 있으면 시간이 다 될 때 그 칸에 쏴요. 상대가 없으면 컴퓨터와 붙어요.'],
      ['점수', '적게 쏠수록, 내 배가 많이 남을수록 점수가 높아요.']]
  },
  chapters:['잔잔한 만','안개 해협','폭풍 바다','빙하 항로','해적 섬'],
  starRule:'★ 승리 · ★★ 기준 발수 이하 · ★★★ 더 적은 발수(판마다 달라요)',
  levels:FL_LV,
  levelCfg:lv => FL_LV[lv] || FL_LV.normal,   /* 실시간 대전(pvp)·AI 쉬움/보통/어려움 */
  pickLv(lv){ if(!lv) lv = ROOM_STATE !== 'none' ? 'pvp' : 'normal'; if(lv === 'pvp' && ROOM_STATE === 'none') lv = 'normal'; return FL_LV[lv] ? lv : 'normal'; },
  levelSheet:() => openFleetSheet(),
  stage:n => ({ limit:0 }),
  stageLevel(n){ const q = flStageFx(n).aiQ; return q < .67 ? 'easy' : q < 1.34 ? 'normal' : 'hard'; },   /* 솔로 스테이지의 AI 세기 */
  stageDesc(n){ const fx = flStageFx(n); return FL_LV[this.stageLevel(n)].name + ' · ★★ ' + fx.th[0] + '발 · ★★★ ' + fx.th[1] + '발 이하' + (fx.tight ? ' · 포탄 ' + fx.tight + '발' : ''); },
  init(cfg, rng, lv){ flInit(lv, rng); },
  render:st => flStage(st),
  progress:() => (G.enSunk ? G.enSunk.length : 0) / 5,
  lossText:() => `적 함선 ${G.enSunk ? G.enSunk.length : 0}/5척을 격침했어요.`,
  score(){ const n = flShotN(); return { base:500, time:Math.round(350 * Math.max(0, Math.min(1, (100 - n) / 83))), extra:Math.round(150 * G.myLeft / FL_TOTAL),
    rows:[G.forfeit ? '승리 (상대 기권)' : '승리', '명중률 보너스 (' + n + '발 중 ' + G.hitsN + '명중)', '남은 내 함선 ' + G.myLeft + '/' + FL_TOTAL + '칸'] }; },
  stars(){ const n = flShotN(), th = G.fx ? G.fx.th : [60, 45]; return n <= th[1] ? 3 : n <= th[0] ? 2 : 1; },
  winTitle:'승리! 적 함대 전멸', loseTitle:'패배 · 우리 함대가 침몰했어요',
  bodyClass:'flmode', noConfetti:true, amb:'sea',
  duelHow:'서로 포격하는 턴제 대전 · 한 차례 10초',
  /* 함대는 대전이 따로(턴제 실시간): 같은 문제 동시 풀기 대신 바로 포격전 */
  /* o.pace === 's'(공용 대전 v3 '느긋하게')면 한 차례 30초. 없으면 이 기기에 기억한 선택 */
  duelLaunch(o){ const lv = duelLive() ? 'pvp' : 'normal', slow = o && o.pace ? o.pace === 's' : !!store.get('hp:fleet:slow', 0); flPaceNext = slow; startGame('fleet', lv, { duel:{ fleet:true, mode:lv === 'pvp' ? 'pvp' : 'ai', opp:{ nick:lv === 'pvp' ? '상대 선장' : '컴퓨터 함장' } } }); flPaceNext = null; }
};
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.fleet.scene = { kind:'sea', colors:['#BFF4FF'], density:1 };
