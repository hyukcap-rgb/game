/* 숲 지킴이: 규칙 엔진·화면 */
/* ---------- 숲 지킴이 (길목 방어): 9×14 칸 판, 칸 100 · 논리 900×1400 ---------- */
/* ----- 숲 지킴이: 규칙 엔진(화면과 분리 — 자동 플레이어 시뮬레이션도 같은 코드를 씀) ----- */
const FS_C = 9, FS_R = 14, FS_S = 100, FS_W = 900, FS_H = 1400;
/* 맵: 굴 입구(맨 윗줄)에서 도토리 창고(맨 아랫줄)까지 칸 경로. routes = 꺾이는 칸 목록, rocks = 못 심는 바위, water = 개울,
   hp·dec = 맵 체력 보정(길이 둘로 나뉘는 맵은 식물이 나뉘어 불리해서 낮추고, 스테이지가 오를수록 조금 더 낮춤) */
const FS_MAPS = [
  { name:'구불 오솔길', routes:[[[1,0],[1,3],[7,3],[7,6],[1,6],[1,9],[7,9],[7,11],[4,11],[4,13]]], rocks:[[4,1],[8,8],[0,12],[4,7]], water:[], hp:1 },
  { name:'두 갈래 개울', routes:[[[4,0],[4,1],[2,1],[2,3],[0,3],[0,8],[2,8],[2,10],[4,10],[4,13]], [[4,0],[4,1],[6,1],[6,3],[8,3],[8,8],[6,8],[6,10],[4,10]]], rocks:[[1,12],[7,12],[4,3]], water:[[4,5],[4,6],[4,7],[3,6],[5,6]], hp:.6, dec:.014 },
  { name:'달팽이 언덕', routes:[[[7,0],[7,9],[1,9],[1,3],[5,3],[5,7],[3,7],[3,13]]], rocks:[[0,1],[8,12],[6,11],[3,5]], water:[], hp:1.1 },
  { name:'쌍굴', routes:[[[2,0],[2,2],[0,2],[0,6],[3,6],[3,10],[4,10],[4,13]], [[6,0],[6,2],[8,2],[8,6],[5,6],[5,10],[4,10]]], rocks:[[4,4],[1,11],[7,12],[4,0]], water:[], hp:.76, dec:.014 }
];
const FS_EN = {
  ant:   { name:'개미',     hp:34,   sp:1.0,  steal:1, sun:1, arm:0,  r:30, gap:.9 },
  mouse: { name:'들쥐',     hp:24,   sp:1.7,  steal:1, sun:1, arm:0,  r:30, gap:.62 },
  beetle:{ name:'딱정벌레', hp:78,   sp:.78,  steal:1, sun:2, arm:.5, r:32, gap:1.15 },
  crow:  { name:'까마귀',   hp:40,   sp:1.1,  steal:1, sun:2, arm:0,  r:30, gap:1.1, air:1 },
  mole:  { name:'두더지',   hp:66,   sp:.95,  steal:1, sun:2, arm:0,  r:32, gap:1.05, dig:1 },
  boar:  { name:'멧돼지',   hp:300,  sp:.68,  steal:2, sun:5, arm:.3, r:44, gap:2.4, boss:1 },
  bear:  { name:'먹보 곰',  hp:1200, sp:.5,   steal:5, sun:8, arm:.3, r:54, gap:3.2, boss:2 }
};
/* 식물: 사거리(칸)·피해·공격 간격(초)은 단계 1→2→3 */
const FS_PL = {
  pine:  { name:'솔방울 나무', short:'솔방울', rng:[2.3, 2.6, 2.9], dmg:[10, 17, 25], per:[.72, .66, .6], air:1, tip:'빠른 단일 공격 · 하늘도 맞혀요' },
  thorn: { name:'가시 덤불',   short:'가시',   rng:[1.3, 1.45, 1.65], dmg:[5, 8.5, 13], per:[.5, .5, .5], tip:'주변 땅 위 적을 찌르고 느리게' },
  fire:  { name:'반딧불 등',   short:'반딧불', rng:[2.2, 2.5, 2.8], dmg:[16, 27, 40], per:[1.5, 1.4, 1.3], air:1, jumps:[3, 3, 5], tip:'번개가 튀어요 · 갑옷 무시' },
  shroom:{ name:'독버섯',      short:'독버섯', rng:[2.5, 2.8, 3.1], dmg:[8, 13, 19], per:[2.4, 2.3, 2.2], cloud:[.9, 1.0, 1.35], tip:'독구름 · 갑옷을 절반으로' }
};
const FS_KINDS = ['pine', 'thorn', 'fire', 'shroom'];
const FS_ITEMS = { rain:{ name:'소나기', tip:'10초 동안 모든 식물 공격 속도 ×1.6' }, vine:{ name:'덩굴 올가미', tip:'누른 흙길 주변 땅 위 적 3초 묶기' }, wind:{ name:'돌개바람', tip:'모든 적을 길 뒤로 2칸 밀어내요' } };
const FS_HAND = 6, FS_SUN = 14, FS_BREAK = 8, FS_DT = 1 / 60;
/* 밸런스 값: 자동 플레이어 시뮬레이션으로 맞춘 값(hp 전체 배율 · 무리마다 체력 증가 · 무리 크기 c0+c1×무리+cn×min(강도,nc) · 앞쪽 무리 줄이는 곡선 mp) */
const FS_TUNE = { hp:3.4, wg:.03, c0:3, c1:2.5, cn:.9, mp:1.1, nc:8 };

function fsWaveCount(n){ return Math.min(12, 4 + Math.ceil(n / 2)); }
function fsExpand(wps){
  const cells = [wps[0].slice()];
  for(let i = 1; i < wps.length; i++){
    let [c, r] = cells[cells.length - 1]; const [tc, tr] = wps[i];
    while(c !== tc || r !== tr){ if(c !== tc) c += Math.sign(tc - c); else r += Math.sign(tr - r); cells.push([c, r]); }
  }
  return cells;
}
function fsRoute(pts){ const cum = [0]; for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L:cum[cum.length - 1] }; }
function fsAt(R, d){
  d = Math.max(0, Math.min(R.L, d)); let i = 1; while(i < R.cum.length - 1 && R.cum[i] < d) i++;
  const a = R.pts[i - 1], b = R.pts[i], seg = R.cum[i] - R.cum[i - 1] || 1, k = (d - R.cum[i - 1]) / seg;
  return { x:a[0] + (b[0] - a[0]) * k, y:a[1] + (b[1] - a[1]) * k, dx:b[0] - a[0], dy:b[1] - a[1] };
}
const fsCx = c => c * FS_S + FS_S / 2;
/* 무리 만들기: 강도 n(솔로 스테이지 번호 또는 오늘의 문제 강도), 무리 수 W */
function fsWaves(n, W, nr, rng){
  const pool = [['ant', 5], ['mouse', 3]];
  if(n >= 4) pool.push(['crow', 2]);
  if(n >= 8) pool.push(['beetle', 2.4]);
  if(n >= 13) pool.push(['mole', 2.2]);
  const hpN = 1 + 0.07 * (n - 1), out = [];
  for(let w = 1; w <= W; w++){
    /* 높은 스테이지일수록 한 마리가 단단해지는 대신, 앞쪽 무리는 수를 줄여 첫 손패로도 버틸 수 있게 */
    const mix = 1 / hpN + (1 - 1 / hpN) * Math.pow((w - 1) / Math.max(1, W - 1), FS_TUNE.mp);
    const cnt = Math.max(2, Math.round((FS_TUNE.c0 + w * FS_TUNE.c1 + Math.min(n, FS_TUNE.nc) * FS_TUNE.cn) * mix)), list = [];
    for(let i = 0; i < cnt; i++){
      let p = w === 1 ? [['ant', 5], ['mouse', n >= 2 ? 2 : 0]] : pool;
      if(w === 2) p = p.filter(q => q[0] !== 'beetle' && q[0] !== 'mole');
      const tot = p.reduce((s, q) => s + q[1], 0); let x = rng() * tot, t = p[0][0];
      for(const q of p){ x -= q[1]; if(x <= 0){ t = q[0]; break; } }
      list.push(t);
    }
    if(w === W && n % 5 === 0) list.push('boar');
    if(w === W && n % 10 === 0) list.push('bear');
    out.push({ list, hp:FS_TUNE.hp * hpN * (1 + FS_TUNE.wg * (w - 1)), boss:list.some(t => FS_EN[t].boss) });
  }
  return out;
}
function fsDeck(rng){
  const wt = [['pine', 30], ['thorn', 22], ['fire', 22], ['shroom', 18], ['compost', 8]], tot = 100, deck = [];
  for(let i = 0; i < 90; i++){
    let x = rng() * tot, k = 'pine';
    for(const q of wt){ x -= q[1]; if(x <= 0){ k = q[0]; break; } }
    /* 퇴비는 처음 8장에 없고, 두 장이 붙어 나오지 않게 */
    if(k === 'compost' && (i < 8 || deck[i - 1] === 'compost' || deck[i - 2] === 'compost')) k = FS_KINDS[Math.floor(rng() * 4)];
    deck.push(k);
  }
  deck[0] = 'pine';
  return deck;
}
/* 판 상태를 S(보통 G)에 채운다 */
function fsSetup(S, n, W, rng, mi){
  const map = FS_MAPS[mi != null ? mi : (n - 1) % FS_MAPS.length];
  const seedOf = () => Math.floor(rng() * 4294967296);
  const wr = mulberry(seedOf()), dr = mulberry(seedOf()), cr = mulberry(seedOf());
  const cell = new Array(FS_C * FS_R).fill(0);   /* 0 풀밭 · 1 흙길 · 2 바위 · 3 물 · 4 창고 */
  const routes = [], air = [], cellRoutes = map.routes.map(fsExpand);
  cellRoutes.forEach(cs => cs.forEach(([c, r]) => cell[r * FS_C + c] = 1));
  /* 두 번째 굴이 앞 길과 합쳐지면 뒤 칸을 이어 붙인다 */
  cellRoutes.forEach((cs, i) => { if(i){ const last = cs[cs.length - 1], main = cellRoutes[0], k = main.findIndex(q => q[0] === last[0] && q[1] === last[1]); if(k >= 0) cellRoutes[i] = cs.concat(main.slice(k + 1)); } });
  const end = cellRoutes[0][cellRoutes[0].length - 1];
  for(const dc of [-1, 0, 1]){ const c = end[0] + dc; if(c >= 0 && c < FS_C) cell[end[1] * FS_C + c] = 4; }
  map.rocks.forEach(([c, r]) => { if(!cell[r * FS_C + c]) cell[r * FS_C + c] = 2; });
  map.water.forEach(([c, r]) => { if(!cell[r * FS_C + c]) cell[r * FS_C + c] = 3; });
  const home = { x:fsCx(end[0]), y:fsCx(end[1]) + 20, c:end[0] };
  cellRoutes.forEach(cs => {
    const pts = [[fsCx(cs[0][0]), -60]].concat(cs.map(([c, r]) => [fsCx(c), fsCx(r)]));
    pts[pts.length - 1] = [home.x, home.y];
    routes.push(fsRoute(pts));
    air.push(fsRoute([[fsCx(cs[0][0]), -60], [fsCx(cs[0][0]), 60], [home.x, home.y - 60], [home.x, home.y]]));
  });
  const waves = fsWaves(n, W, routes.length, wr), boss = n % 5 === 0;
  Object.assign(S, { n, map, mapName:map.name, cell, cellRoutes, routes, air, home, waves, wave:0, cleared:0, left:[], spawnQ:[], spawnT:0, phase:'ready', breakT:0,
    lives:10, lost:0, plants:[], enemies:[], shots:[], clouds:[], deck:fsDeck(dr), deckI:0, cr, hand:[], sun:0, kills:0, clock:0, eid:0,
    items:{ rain:1, vine:boss ? 3 : 2, wind:1 }, itemsUsed:0, rainT:0, result:null, spd:1, cardsLost:0 });
  fsDraw(S, 4, 'start');
}
function fsEv(S, name, a){ if(S.ev) S.ev(name, a || {}); }
function fsDraw(S, k, why){
  for(let i = 0; i < k; i++){
    const card = S.deck[S.deckI++ % S.deck.length];
    if(S.hand.length >= FS_HAND){ S.cardsLost++; fsEv(S, 'cardLost', { why }); continue; }
    S.hand.push(card); fsEv(S, 'card', { why, card });
  }
}
const fsCellAt = (S, c, r) => c < 0 || r < 0 || c >= FS_C || r >= FS_R ? -1 : S.cell[r * FS_C + c];
const fsPlantAt = (S, c, r) => S.plants.find(p => p.c === c && p.r === r);
/* 손패 i번째 카드를 (c, r) 칸에 쓴다. 성공하면 true, 아니면 이유 문장 */
function fsUse(S, i, c, r){
  const k = S.hand[i]; if(!k) return '카드를 먼저 골라요';
  const t = fsCellAt(S, c, r), p = fsPlantAt(S, c, r);
  if(k === 'compost'){
    if(!p) return '퇴비는 식물 위에 써요';
    S.plants.splice(S.plants.indexOf(p), 1); S.hand.splice(i, 1);
    const nk = FS_KINDS[Math.floor(S.cr() * 4)]; S.hand.push(nk);
    fsEv(S, 'compost', { p, card:nk }); return true;
  }
  if(p){
    if(p.k !== k) return '다른 식물 위에는 못 심어요';
    if(p.lv >= 3) return '이미 다 자랐어요';
    p.lv++; p.grow = 0; S.hand.splice(i, 1); fsEv(S, 'grow', { p }); return true;
  }
  if(t === 1 || t === 4) return '흙길에는 못 심어요';
  if(t === 2) return '바위 칸이에요';
  if(t === 3) return '개울에는 못 심어요';
  if(t !== 0) return '여기엔 못 심어요';
  const np = { k, lv:1, c, r, x:fsCx(c), y:fsCx(r), cd:.35, grow:0, aim:0, fire:0 };
  S.plants.push(np); S.hand.splice(i, 1); fsEv(S, 'plant', { p:np }); return true;
}
function fsCanCall(S){ return !S.result && S.wave < S.waves.length && (S.phase === 'ready' || S.phase === 'break' || (S.phase === 'wave' && !S.spawnQ.length)); }
function fsLaunch(S){
  if(!fsCanCall(S)) return false;
  const w = S.wave++, W = S.waves[w], nr = S.routes.length;
  let t = 0, i = 0;
  W.list.forEach(type => { S.spawnQ.push({ type, w, ri:i++ % nr, at:t, hp:W.hp }); t += FS_EN[type].gap; });
  S.left[w] = W.list.length; S.spawnT = 0; S.phase = 'wave'; S.breakT = 0;
  fsEv(S, 'wave', { w:w + 1, boss:W.boss }); return true;
}
function fsItem(S, k, c, r){
  if(S.result || !S.items[k]) return '다 썼어요';
  const live = S.enemies.filter(e => !e.dead);
  if(k === 'rain'){ if(!live.length && S.phase !== 'wave') return '적이 올 때 써요'; S.rainT = 10; }
  else if(k === 'wind'){ if(!live.length) return '밀어낼 적이 없어요'; live.forEach(e => { e.d = Math.max(0, e.d - 200); e.windT = .5; }); }
  else if(k === 'vine'){
    if(fsCellAt(S, c, r) !== 1 && fsCellAt(S, c, r) !== 4) return '흙길 칸을 눌러요';
    const x = fsCx(c), y = fsCx(r), hit = live.filter(e => !e.E.air && !e.under && Math.hypot(e.x - x, e.y - y) <= 120 + e.E.r * .5);
    if(!hit.length) return '주변 흙길에 묶을 적이 없어요';
    hit.forEach(e => e.rootT = Math.max(e.rootT, e.E.boss === 2 ? 1.5 : 3));
    fsEv(S, 'vine', { x, y });
  }
  S.items[k]--; S.itemsUsed++; fsEv(S, 'item', { k }); return true;
}
function fsSpawn(S, q){
  const E = FS_EN[q.type], R = E.air ? S.air[q.ri] : S.routes[q.ri], p = fsAt(R, 0);
  const hp = Math.round(E.hp * q.hp * S.map.hp * Math.max(.72, 1 - (S.map.dec || 0) * Math.max(0, S.n - 8)));
  S.enemies.push({ id:++S.eid, type:q.type, E, hp, max:hp, d:0, R, w:q.w, x:p.x, y:p.y, face:1, slowT:0, rootT:0, rootCd:0, acidT:0, hitT:0, under:false, digT:E.dig ? 3 + (S.eid % 3) : 0, walk:Math.random() * 6, dead:false, windT:0 });
  if(E.boss) fsEv(S, 'boss', { type:q.type });
}
const fsTargetable = e => !e.dead && !e.under && e.d > 30;
const fsProg = e => e.d / e.R.L;
function fsHit(S, e, dmg, kind){
  if(e.dead || e.under) return;
  const arm = kind === 'magic' ? 0 : e.E.arm * (e.acidT > 0 ? .5 : 1);
  e.hp -= dmg * (1 - arm); e.hitT = .12;
  if(e.hp <= 0){
    e.dead = true; S.kills++; S.left[e.w]--; fsEv(S, 'kill', { e });
    S.sun += e.E.sun;
    if(S.sun >= FS_SUN){ S.sun -= FS_SUN; fsDraw(S, 1, 'sun'); }
    fsWaveDone(S, e.w);
  }
}
function fsWaveDone(S, w){
  if(S.left[w] > 0 || S.spawnQ.some(q => q.w === w)) return;
  S.cleared++; S.left[w] = -1;
  if(S.cleared < S.waves.length){ fsDraw(S, 2, 'wave'); fsEv(S, 'cleared', { w:w + 1 }); }
}
function fsInRange(S, p, r, air){
  const R = r * FS_S, out = [];
  for(const e of S.enemies) if(fsTargetable(e) && (air || !e.E.air) && Math.hypot(e.x - p.x, e.y - p.y) <= R + e.E.r * .35) out.push(e);
  return out;
}
function fsAct(S, p){
  const P = FS_PL[p.k], lv = p.lv - 1;
  if(p.k === 'pine'){
    const ts = fsInRange(S, p, P.rng[lv], true).sort((a, b) => fsProg(b) - fsProg(a)); if(!ts.length) return false;
    const n = p.lv >= 3 ? 2 : 1;
    for(let i = 0; i < n; i++){ const e = ts[Math.min(i, ts.length - 1)]; S.shots.push({ k:'cone', x:p.x, y:p.y - 40, e, tx:e.x, ty:e.y, dmg:P.dmg[lv], sp:1500, off:i ? 14 : 0 }); }
    p.aim = Math.atan2(ts[0].y - p.y, ts[0].x - p.x); fsEv(S, 'pine', { p }); return true;
  }
  if(p.k === 'thorn'){
    const ts = fsInRange(S, p, P.rng[lv], false); if(!ts.length) return false;
    for(const e of ts){
      e.slowT = Math.max(e.slowT, .6);
      if(p.lv >= 3 && e.rootCd <= 0 && S.cr() < .2){ e.rootT = Math.max(e.rootT, e.E.boss === 2 ? .5 : 1); e.rootCd = 3; }
      fsHit(S, e, P.dmg[lv], 'phys');
    }
    fsEv(S, 'thorn', { p, n:ts.length }); return true;
  }
  if(p.k === 'fire'){
    const ts = fsInRange(S, p, P.rng[lv], true).sort((a, b) => fsProg(b) - fsProg(a)); if(!ts.length) return false;
    const hit = [ts[0]], pts = [[p.x, p.y - 52], [ts[0].x, ts[0].y - 10]];
    let cur = ts[0];
    while(hit.length < P.jumps[lv]){
      let best = null, bd = 170;
      for(const e of S.enemies) if(fsTargetable(e) && !hit.includes(e)){ const d = Math.hypot(e.x - cur.x, e.y - cur.y); if(d < bd){ bd = d; best = e; } }
      if(!best) break; hit.push(best); pts.push([best.x, best.y - 10]); cur = best;
    }
    let dmg = P.dmg[lv]; hit.forEach(e => { fsHit(S, e, dmg, 'magic'); dmg *= .72; });
    fsEv(S, 'fire', { p, pts }); return true;
  }
  if(p.k === 'shroom'){
    const ts = fsInRange(S, p, P.rng[lv], false).sort((a, b) => fsProg(b) - fsProg(a)); if(!ts.length) return false;
    const e = ts[0], sp = e.E.sp * FS_S * (e.slowT > 0 ? .65 : 1) * (e.rootT > 0 ? 0 : 1), at = fsAt(e.R, e.d + sp * .55);
    S.shots.push({ k:'spore', x:p.x, y:p.y - 50, sx:p.x, sy:p.y - 50, tx:at.x, ty:at.y, t:0, dur:.55, dmg:P.dmg[lv], rad:P.cloud[lv] * FS_S });
    fsEv(S, 'shroom', { p }); return true;
  }
  return false;
}
function fsStep(S, dt){
  if(S.result) return;
  S.clock += dt;
  if(S.rainT > 0) S.rainT = Math.max(0, S.rainT - dt);
  /* 나오기 */
  if(S.spawnQ.length){
    S.spawnT += dt;
    while(S.spawnQ.length && S.spawnQ[0].at <= S.spawnT) fsSpawn(S, S.spawnQ.shift());
  }
  /* 무리 흐름 */
  if(S.phase === 'wave' && !S.spawnQ.length && !S.enemies.some(e => !e.dead) && S.wave < S.waves.length){ S.phase = 'break'; S.breakT = FS_BREAK; fsEv(S, 'break', {}); }
  if(S.phase === 'break'){ S.breakT -= dt; if(S.breakT <= 0) fsLaunch(S); }
  /* 적 이동 */
  for(const e of S.enemies){
    if(e.dead) continue;
    e.hitT = Math.max(0, e.hitT - dt); e.acidT = Math.max(0, e.acidT - dt); e.rootCd = Math.max(0, e.rootCd - dt); e.windT = Math.max(0, e.windT - dt);
    if(e.slowT > 0) e.slowT -= dt;
    if(e.E.dig){ e.digT -= dt; if(e.digT <= 0){ e.under = !e.under; e.digT = e.under ? 2 : 5; fsEv(S, e.under ? 'dig' : 'rise', { e }); } }
    let v = e.E.sp * FS_S * (e.slowT > 0 ? .65 : 1);
    if(e.rootT > 0){ e.rootT -= dt; v = 0; }
    e.d += v * dt; e.walk += v * dt * .06;
    const p = fsAt(e.R, e.d); if(Math.abs(p.dx) > 1) e.face = p.dx > 0 ? 1 : -1;
    e.x = p.x; e.y = p.y;
    if(e.d >= e.R.L){
      e.dead = true; e.leaked = true; S.left[e.w]--;
      const k = Math.min(S.lives, e.E.steal); S.lives -= k; S.lost += k;
      fsEv(S, 'leak', { e, k }); fsWaveDone(S, e.w);
      if(S.lives <= 0){ S.result = 'lose'; fsEv(S, 'lose', {}); return; }
    }
  }
  /* 식물 */
  const rate = S.rainT > 0 ? 1.6 : 1;
  for(const p of S.plants){
    p.grow += dt; p.fire = Math.max(0, p.fire - dt);
    if(p.cd > 0) p.cd -= dt * rate;
    if(p.cd <= 0){ if(fsAct(S, p)){ p.cd += FS_PL[p.k].per[p.lv - 1]; p.fire = .25; } else p.cd = 0; }
  }
  /* 날아가는 것 */
  for(const s of S.shots){
    if(s.k === 'cone'){
      if(!s.e.dead){ s.tx = s.e.x; s.ty = s.e.y - 12; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), st = s.sp * dt;
      if(d <= st){ s.done = true; if(!s.e.dead) fsHit(S, s.e, s.dmg, 'phys'); fsEv(S, 'coneHit', { x:s.tx, y:s.ty }); }
      else { s.x += dx / d * st; s.y += dy / d * st; }
    } else {
      s.t += dt; const k = Math.min(1, s.t / s.dur);
      s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 120;
      if(k >= 1){ s.done = true; S.clouds.push({ x:s.tx, y:s.ty, r:s.rad, t:0, dur:3, tick:0, dps:s.dmg }); fsEv(S, 'cloud', { x:s.tx, y:s.ty }); }
    }
  }
  if(S.shots.some(s => s.done)) S.shots = S.shots.filter(s => !s.done);
  for(const c of S.clouds){
    c.t += dt; c.tick -= dt;
    if(c.tick <= 0){
      c.tick += .5;
      for(const e of S.enemies) if(fsTargetable(e) && !e.E.air && Math.hypot(e.x - c.x, e.y - c.y) <= c.r + e.E.r * .3){ e.acidT = .6; fsHit(S, e, c.dps * .5, 'phys'); }
    }
  }
  if(S.clouds.some(c => c.t >= c.dur)) S.clouds = S.clouds.filter(c => c.t < c.dur);
  if(S.enemies.length > 40 || (S.enemies.length && S.enemies.every(e => e.dead))) S.enemies = S.enemies.filter(e => !e.dead);
  if(S.cleared >= S.waves.length && !S.result){ S.result = 'win'; fsEv(S, 'win', {}); }
}
function tdStars(l){ return l >= 10 ? 3 : l >= 7 ? 2 : 1; }
/* ----- 숲 지킴이: 화면 ----- */
Object.assign(SFX_GATE, { fsZap:70, fsThorn:150, fsSpore:90, fsCloud:140, fsDig:200, fsCard:120, fsPlant:60 });
Object.assign(SFX_LIB, {
  fsPlant(o){ aNoise({ ft:'bandpass', f:900, q:1.5, d:.08, v:.08, pan:o.pan }); aPluck(m2f(72), { d:.25, v:.09, pan:o.pan }); aPluck(m2f(79), { t:.07, d:.3, v:.08, pan:o.pan }); },
  fsGrow(o){ aSparkle({ root:76, n:4, gap:.05, pan:o.pan }); aPluck(m2f(84), { d:.3, v:.08, pan:o.pan }); },
  fsSpore(o){ aTone({ f:220, f2:520, type:'sine', d:.12, v:.07, pan:o.pan }); },
  fsCloud(o){ aNoise({ ft:'lowpass', f:900, f2:300, a:.03, d:.35, v:.07, pan:o.pan }); },
  fsZap(o){ aNoise({ ft:'highpass', f:2500, d:.12, v:.05, pan:o.pan }); aTone({ f:1600, f2:900, type:'square', lp:3000, d:.08, v:.02, pan:o.pan }); },
  fsThorn(o){ aNoise({ ft:'bandpass', f:2400, q:4, d:.05, v:.035, pan:o.pan }); },
  fsCard(){ aPluck(m2f(79), { d:.2, v:.08 }); aPluck(m2f(84), { t:.06, d:.3, v:.08 }); },
  fsSun(){ aSparkle({ root:84, n:5, gap:.045 }); },
  fsRain(){ aNoise({ ft:'bandpass', f:5000, q:.6, a:.3, hold:1.2, d:1, v:.05 }); aBell({ f:m2f(88), d:.6, v:.04, rev:.4 }); },
  fsVine(o){ aNoise({ ft:'lowpass', f:600, f2:1400, a:.05, d:.3, v:.12, pan:o.pan }); aPluck(m2f(55), { d:.35, v:.12, pan:o.pan }); },
  fsWind(){ aWhoosh({ f:300, f2:2400, a:.15, d:.7, v:.12 }); },
  fsDig(o){ aNoise({ ft:'lowpass', f:500, d:.15, v:.05, pan:o.pan }); },
  fsCompost(o){ aNoise({ ft:'lowpass', f:700, f2:200, d:.3, v:.1, pan:o.pan }); aPluck(m2f(67), { t:.15, d:.3, v:.08 }); }
});
/* 카드·아이템·줄 아이콘(작은 SVG) */
const FS_ICO = {
  acorn:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 10.5h11.6c.2 6.2-2.6 10.3-5.8 11.3-3.2-1-6-5.1-5.8-11.3z" fill="#E5A24B" stroke="#7A4A1C" stroke-width="1.3"/><path d="M8 13c.2 3 1.3 5.5 3 7" fill="none" stroke="#FFD89A" stroke-width="1.4" stroke-linecap="round"/><path d="M4.6 10.8c0-3.6 3.3-6 7.4-6s7.4 2.4 7.4 6z" fill="#8A5A2B" stroke="#5A3514" stroke-width="1.3"/><path d="M12 4.8V2.4" stroke="#5A3514" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#FF9F1C" stroke-width="2" stroke-linecap="round"><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1"/></g><circle cx="12" cy="12" r="5.6" fill="#FFC93C" stroke="#E07B00" stroke-width="1.3"/></svg>',
  pine:'<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="36" rx="11" ry="2.6" fill="rgba(0,0,0,.18)"/><rect x="17.6" y="26" width="4.8" height="9.5" rx="2" fill="#9A6A3F"/><ellipse cx="20" cy="25.5" rx="13" ry="7" fill="#3E9A45"/><ellipse cx="20" cy="18.5" rx="10.5" ry="6.4" fill="#4CAF50"/><ellipse cx="20" cy="11.5" rx="7" ry="5.2" fill="#63C466"/><ellipse cx="17" cy="9.5" rx="3" ry="1.5" fill="rgba(255,255,255,.5)"/><ellipse cx="12.5" cy="27" rx="2.4" ry="3" fill="#A0673A"/><ellipse cx="27" cy="25.5" rx="2.4" ry="3" fill="#A0673A"/><circle cx="17" cy="18.5" r="1.3" fill="#1F2A1A"/><circle cx="23" cy="18.5" r="1.3" fill="#1F2A1A"/></svg>',
  thorn:'<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="36" rx="13" ry="2.6" fill="rgba(0,0,0,.18)"/><g fill="#F4E7C5" stroke="#B89B6A" stroke-width=".8"><path d="M5 22l-4-2 5-1z"/><path d="M35 22l4-2-5-1z"/><path d="M10 11L7 6l6 3z"/><path d="M30 11l3-5-6 3z"/><path d="M20 6l-1.5-5 3 0z"/></g><circle cx="12" cy="25" r="8.5" fill="#5E9A45"/><circle cx="28" cy="25" r="8.5" fill="#5E9A45"/><circle cx="20" cy="18" r="11" fill="#6BAE4F"/><ellipse cx="16" cy="12" rx="4" ry="2" fill="rgba(255,255,255,.45)"/><circle cx="13" cy="15" r="2.2" fill="#C04BA0"/><circle cx="27" cy="21" r="2" fill="#C04BA0"/><circle cx="17" cy="20" r="1.3" fill="#1F2A1A"/><circle cx="23" cy="20" r="1.3" fill="#1F2A1A"/></svg>',
  fire:'<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="36" rx="9" ry="2.4" fill="rgba(0,0,0,.18)"/><circle cx="20" cy="14" r="12" fill="#FFE36B" opacity=".35"/><path d="M20 35c0-7 4-10 1-18" fill="none" stroke="#3E8E41" stroke-width="3" stroke-linecap="round"/><ellipse cx="14" cy="29" rx="5" ry="2.4" transform="rotate(-30 14 29)" fill="#58B85C"/><ellipse cx="20.5" cy="14.5" rx="7.5" ry="9" fill="#FFD84D" stroke="#E0A800" stroke-width="1"/><ellipse cx="18" cy="11" rx="2.6" ry="3" fill="#FFF6C4"/><ellipse cx="20.5" cy="5.6" rx="6" ry="2.4" fill="#4CAF50"/><circle cx="18" cy="15.5" r="1.2" fill="#5A3A00"/><circle cx="23" cy="15.5" r="1.2" fill="#5A3A00"/><circle cx="31" cy="9" r="1.6" fill="#FFF3A0"/><circle cx="8" cy="12" r="1.3" fill="#FFF3A0"/></svg>',
  shroom:'<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="36" rx="11" ry="2.6" fill="rgba(0,0,0,.18)"/><rect x="14.5" y="18" width="11" height="17" rx="5" fill="#F3E6CF" stroke="#C9B28E" stroke-width="1"/><path d="M4 20C4 9 11 4 20 4s16 5 16 16c-5 2-27 2-32 0z" fill="#9C5BD6" stroke="#6A3A9E" stroke-width="1"/><ellipse cx="13" cy="12" rx="3" ry="2.2" fill="#fff"/><ellipse cx="23" cy="9" rx="2.6" ry="2" fill="#fff"/><ellipse cx="29" cy="15" rx="2.2" ry="1.8" fill="#fff"/><circle cx="18" cy="26" r="1.2" fill="#3B2366"/><circle cx="22" cy="26" r="1.2" fill="#3B2366"/></svg>',
  compost:'<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="35" rx="13" ry="2.6" fill="rgba(0,0,0,.18)"/><path d="M5 33c1-9 7-14 15-14s14 5 15 14z" fill="#8A5A34" stroke="#5A3514" stroke-width="1.2"/><circle cx="13" cy="28" r="1.6" fill="#B98552"/><circle cx="24" cy="25" r="1.4" fill="#B98552"/><circle cx="29" cy="30" r="1.3" fill="#5A3514"/><path d="M20 20c-1-6 2-11 8-12-1 6-3 10-8 12z" fill="#7FCB5A" stroke="#3E8E41" stroke-width="1"/><path d="M20 20c-3-3-7-4-10-3 2 3 5 4 10 3z" fill="#9EDC6E" stroke="#3E8E41" stroke-width="1"/><path d="M31 5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#FFE36B"/></svg>',
  rain:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 23a7 7 0 0 1 1-14 9 9 0 0 1 17 2 6 6 0 0 1 0 12z" fill="#fff" stroke="#2A1650" stroke-width="2"/><g stroke="#1E7FD0" stroke-width="2.6" stroke-linecap="round"><path d="M13 28l-2 5"/><path d="M20 28l-2 5"/><path d="M27 28l-2 5"/></g></svg>',
  vine:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 32c0-9 6-10 10-7s1 9-3 7-2-12 7-14 11 6 9 10" fill="none" stroke="#2E7D32" stroke-width="4" stroke-linecap="round"/><path d="M8 32c0-9 6-10 10-7s1 9-3 7-2-12 7-14 11 6 9 10" fill="none" stroke="#7FCB5A" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="29" cy="12" rx="4.5" ry="2.6" transform="rotate(-30 29 12)" fill="#7FCB5A" stroke="#2E7D32" stroke-width="1.2"/><ellipse cx="10" cy="20" rx="4" ry="2.2" transform="rotate(40 10 20)" fill="#7FCB5A" stroke="#2E7D32" stroke-width="1.2"/></svg>',
  wind:'<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M5 14h19a5 5 0 1 0-5-5"/><path d="M5 22h26a5 5 0 1 1-5 5"/><path d="M9 30h9"/></g><g fill="none" stroke="#2A1650" stroke-width="2" stroke-linecap="round"><path d="M5 14h19a5 5 0 1 0-5-5"/><path d="M5 22h26a5 5 0 1 1-5 5"/><path d="M9 30h9"/></g></svg>'
};
const FS_CARD_NAME = { pine:'솔방울', thorn:'가시', fire:'반딧불', shroom:'독버섯', compost:'퇴비' };

function tdInit(n, rng){
  const W = (G.L && G.L.tower && G.L.tower.w) || fsWaveCount(n);
  fsSetup(G, n, W, rng);
  Object.assign(G, { sel:-1, itemSel:null, info:null, fx:[], floats:[], acc:0, lt:0, raf:0, shake:0, flash:0, endT:0, banner:null, bgc:null, spr:{}, hudK:'', handK:'', newCards:0, lostToastAt:0, clockV:0 });
  G.ev = fsOnEv;
}
const fsPan = x => panC(x, FS_W);
function fsFloat(x, y, text, o = {}){ G.floats.push({ x, y, text, t:0, dur:o.dur || 1.2, col:o.col || '#fff', acorn:!!o.acorn, size:o.size || 40 }); }
function fsBanner(big, small, dur){ G.banner = { big, small:small || '', t:0, dur:dur || 1.8 }; }
function fsOnEv(name, a){
  const S = G, rd = FXR.reduce;
  switch(name){
    case 'card': S.handK = ''; S.newCards++; if(a.why === 'sun'){ sfx('fsSun'); fsFloat(FS_W / 2, 90, '햇살 카드 +1', { col:'#FFE36B', size:38 }); const su = $('.fsun'); if(su){ su.classList.remove('full'); void su.offsetWidth; su.classList.add('full'); } } else if(a.why === 'wave') sfx('fsCard'); break;
    case 'cardLost': S.handK = ''; if(performance.now() - S.lostToastAt > 2500){ S.lostToastAt = performance.now(); toast('손패가 가득 차서 카드 한 장이 날아갔어요'); } break;
    case 'plant': sfx('fsPlant', { pan:fsPan(a.p.x) }); fxBuzz(12); fsBurst(a.p.x, a.p.y + 26, 10, '140,200,90'); S.fx.push({ k:'ring', x:a.p.x, y:a.p.y + 20, r:60, t:0, dur:.45, col:'255,255,255' }); break;
    case 'grow': sfx('fsGrow', { pan:fsPan(a.p.x) }); fxBuzz([12, 30, 12]); S.fx.push({ k:'ring', x:a.p.x, y:a.p.y, r:80, t:0, dur:.5, col:'255,221,90' }); fsBurst(a.p.x, a.p.y - 10, 12, '255,221,90'); fsFloat(a.p.x, a.p.y - 70, a.p.lv + '단계!', { col:'#FFE36B', size:34, dur:1 }); break;
    case 'compost': sfx('fsCompost', { pan:fsPan(a.p.x) }); fsBurst(a.p.x, a.p.y + 20, 14, '138,90,52'); fsFloat(a.p.x, a.p.y - 40, FS_CARD_NAME[a.card] + ' 카드 받음', { col:'#FFE9B8', size:32 }); S.handK = ''; break;
    case 'wave': sfx('tHorn'); fxBuzz(25); fsBanner('무리 ' + a.w + ' / ' + S.waves.length, a.boss ? (S.waves[a.w - 1].list.includes('bear') ? '먹보 곰이 와요!' : '멧돼지가 와요!') : a.w === S.waves.length ? '마지막 무리예요' : '', a.boss ? 2.4 : 1.6);
      if(a.boss) setTimeout(() => { if(G === S && !S.over) sfx('tBoss'); }, 700); break;
    case 'cleared': fsFloat(FS_W / 2, 150, '무리를 막았어요 · 카드 +2', { col:'#FFF3C4', size:36, dur:1.5 }); break;
    case 'kill': { const e = a.e; sfx('tDie', { pan:fsPan(e.x) }); fsBurst(e.x, e.y - 10, e.E.boss ? 22 : rd ? 4 : 8, e.type === 'crow' ? '80,90,140' : '255,240,210');
      S.fx.push({ k:'ring', x:e.x, y:e.y - 10, r:e.E.boss ? 130 : 50, t:0, dur:.35, col:'255,255,255' });
      if(e.E.boss){ S.shake = Math.max(S.shake, e.E.boss === 2 ? 16 : 9); fxBuzz([30, 40, 60]); } break; }
    case 'leak': { const h = S.home; sfx('tLeak'); fxBuzz([50, 30, 70]); S.flash = .6; S.shake = Math.max(S.shake, 10); fsFloat(h.x + 60, h.y - 70, '−' + a.k, { acorn:true, col:'#FF6B6B', size:46, dur:1.4 });
      const lv = $('#fsLv'); if(lv){ lv.classList.remove('hit'); void lv.offsetWidth; lv.classList.add('hit'); } break; }
    case 'pine': sfx('tArrow', { pan:fsPan(a.p.x) }); break;
    case 'coneHit': S.fx.push({ k:'spark', x:a.x, y:a.y, t:0, dur:.2 }); break;
    case 'fire': sfx('fsZap', { pan:fsPan(a.p.x) }); S.fx.push({ k:'bolt', pts:a.pts, t:0, dur:.22, seed:Math.random() * 99 }); break;
    case 'thorn': sfx('fsThorn', { pan:fsPan(a.p.x) }); S.fx.push({ k:'thorn', x:a.p.x, y:a.p.y + 10, r:FS_PL.thorn.rng[a.p.lv - 1] * FS_S, t:0, dur:.4 }); break;
    case 'shroom': sfx('fsSpore', { pan:fsPan(a.p.x) }); break;
    case 'cloud': sfx('fsCloud', { pan:fsPan(a.x) }); break;
    case 'dig': case 'rise': sfx('fsDig', { pan:fsPan(a.e.x) }); fsBurst(a.e.x, a.e.y, 6, '138,90,52'); break;
    case 'vine': sfx('fsVine', { pan:fsPan(a.x) }); fxBuzz(25); S.fx.push({ k:'vine', x:a.x, y:a.y, t:0, dur:3 }); break;
    case 'item': if(a.k === 'rain'){ sfx('fsRain'); fsBanner('소나기!', '10초 동안 식물이 빨라져요', 1.4); }
      if(a.k === 'wind'){ sfx('fsWind'); fxBuzz(30); S.fx.push({ k:'gust', t:0, dur:.9 }); fsBanner('돌개바람!', '모두 두 칸 뒤로', 1.2); }
      S.hudK = ''; break;
    case 'win': S.endT = 1.5; S.sel = -1; S.itemSel = null; fsBanner('숲을 지켰어요!', '도토리 ' + S.lives + '개를 지켰어요', 3); if(!rd) setTimeout(() => { if(G === S) fxConfetti(); }, 150); break;
    case 'lose': S.endT = 1.6; S.sel = -1; S.itemSel = null; S.flash = 1; fsBanner('도토리를 모두 뺏겼어요', '', 3); break;
  }
}
function fsBurst(x, y, n, col){
  for(let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160; G.fx.push({ k:'dot', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 60, r:5 + Math.random() * 6, t:0, dur:.45 + Math.random() * .3, col }); }
}

/* ----- 화면 틀: 줄(도토리·무리·햇살) + 칸 판 + 손패 + 아이템 줄 ----- */
function tdStage(st){
  const S = G;
  st.innerHTML = `<div class="fsw" id="fsw">
    <div class="fstop">
      <span class="fchip" id="fsLv" aria-label="남은 도토리">${FS_ICO.acorn}<b id="fsLives">${S.lives}</b><small>/10</small></span>
      <span class="fchip" aria-label="무리"><small>무리</small><b id="fsWave">0</b><small>/${S.waves.length}</small></span>
      <span class="fsun" aria-label="햇살 게이지">${FS_ICO.sun}<span class="fsunbar"><i id="fsSun"></i></span></span>
    </div>
    <div class="fsbox" id="fsbox"><canvas class="fscv" id="fscv" aria-label="숲 지킴이 판"></canvas></div>
    <div class="fshand" id="fsHand" role="group" aria-label="씨앗 카드"></div>
    <div class="fsctl">
      ${['rain', 'vine', 'wind'].map(k => `<button class="fitm" data-it="${k}" aria-label="${FS_ITEMS[k].name}: ${FS_ITEMS[k].tip}">${FS_ICO[k]}<b>0</b></button>`).join('')}
      <button class="fspd" id="fsSpd" aria-label="빠르기">×1</button>
      <button class="fsgo" id="fsGo">시작 ▶</button>
    </div></div>`;
  const cv = $('#fscv'), box = $('#fsbox'); S.cv = cv; S.ctx = cv.getContext('2d');
  const size = () => {
    if(G !== S) return;
    const wrapW = $('#fsw').clientWidth || 328, top = box.getBoundingClientRect().top + window.scrollY;
    const below = $('#fsHand').offsetHeight + $('.fsctl').offsetHeight + 24;
    const availH = Math.max(300, window.innerHeight - top - below - 6);
    const w = Math.floor(Math.max(200, Math.min(wrapW - 6, availH * FS_W / FS_H))), h = Math.round(w * FS_H / FS_W), dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    S.scale = cv.width / FS_W; S.bgc = null; S.spr = {};
  };
  size(); setTimeout(size, 80); window.onresize = size;
  S.cleanup = () => { if(window.onresize === size) window.onresize = null; };
  cv.onpointerdown = e => {
    e.preventDefault();
    if(S.over || S.paused || S.result || G !== S) return;
    const rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * FS_W, y = (e.clientY - rc.top) / rc.height * FS_H;
    fsTap(Math.floor(x / FS_S), Math.floor(y / FS_S));
  };
  ['selectstart', 'contextmenu', 'dragstart'].forEach(ev => cv.addEventListener(ev, e => e.preventDefault()));
  $('#fsHand').onclick = e => {
    const b = e.target.closest('.fcard[data-i]'); if(!b || S.over || S.result) return;
    const i = +b.dataset.i; S.itemSel = null; S.info = null;
    S.sel = S.sel === i ? -1 : i; sfx('tSel'); S.handK = ''; S.hudK = '';
  };
  document.querySelectorAll('.fitm').forEach(b => b.onclick = () => {
    if(S.over || S.result || S.paused) return;
    const k = b.dataset.it;
    if(!S.items[k]){ toast(FS_ITEMS[k].name + '은(는) 이번 판에 다 썼어요', 'err'); return; }
    if(k === 'vine'){ S.itemSel = S.itemSel === 'vine' ? null : 'vine'; S.sel = -1; S.handK = ''; S.hudK = ''; sfx('tSel'); return; }
    const r = fsItem(S, k); if(r !== true) toast(r, 'err');
  });
  $('#fsSpd').onclick = () => { S.spd = S.spd === 1 ? 2 : 1; sfx(S.spd > 1 ? 'bFast' : 'toggle', { on:false }); S.hudK = ''; };
  $('#fsGo').onclick = () => { if(S.over || S.result) return; if(fsLaunch(S)){ S.hudK = ''; } };
  const me = S;
  const loop = ts => {
    if(G !== me) return;
    const dt = me.lt ? Math.min(.1, (ts - me.lt) / 1000) : 0; me.lt = ts;
    const run = !me.over && !me.paused && !(me.duel && !me.duel.fleet && !me.duel.go);
    if(run){
      if(me.result){ me.endT -= dt; if(me.endT <= 0){ fsHud(); finish(me.result === 'win'); } }
      else { me.acc += dt * me.spd; let k = 0; while(me.acc >= FS_DT && k < 12){ fsStep(me, FS_DT); me.acc -= FS_DT; k++; } if(k >= 12) me.acc = 0; }
      fsFxStep(dt * (me.result ? 1 : me.spd));
    }
    if(G === me){ fsRender(); fsHud(); }
    if(!me.over) me.raf = requestAnimationFrame(loop);
  };
  me.raf = requestAnimationFrame(loop);
  fsHud();
}
function fsTap(c, r){
  const S = G;
  if(S.itemSel === 'vine'){ const res = fsItem(S, 'vine', c, r); if(res === true) S.itemSel = null; else toast(res, 'err'); S.hudK = ''; return; }
  if(S.sel >= 0){
    const res = fsUse(S, S.sel, c, r);
    if(res === true){ S.sel = -1; S.handK = ''; S.hudK = ''; }
    else toast(res, 'err');
    return;
  }
  const p = fsPlantAt(S, c, r);
  if(p){ S.info = { p, t:0 }; sfx('tSel'); return; }
  S.info = null;
  if(fsCellAt(S, c, r) === 0 && S.hand.length) fsFloat(fsCx(c), fsCx(r) - 20, '카드를 먼저 골라요', { size:30, dur:1 });
}
function fsFxStep(dt){
  const S = G;
  for(const f of S.fx){ f.t += dt; if(f.k === 'dot'){ f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 420 * dt; } }
  if(S.fx.length) S.fx = S.fx.filter(f => f.t < f.dur);
  for(const f of S.floats) f.t += dt;
  if(S.floats.length) S.floats = S.floats.filter(f => f.t < f.dur);
  if(S.banner){ S.banner.t += dt; if(S.banner.t > S.banner.dur) S.banner = null; }
  if(S.info){ S.info.t += dt; if(S.info.t > 2.6 || !S.plants.includes(S.info.p)) S.info = null; }
  S.shake = Math.max(0, S.shake - dt * 40); S.flash = Math.max(0, S.flash - dt * 1.5);
}
/* 줄·손패·버튼: 바뀐 게 있을 때만 다시 씀 */
function fsHud(){
  const S = G; if(!$('#fsw')) return;
  const canCall = fsCanCall(S);
  const goTxt = S.result ? (S.result === 'win' ? '다 막았어요!' : '실패') : S.phase === 'ready' ? '시작 ▶' : S.wave >= S.waves.length ? '마지막 무리' : '다음 무리 ▶' + (S.phase === 'break' ? ' ' + Math.ceil(S.breakT) : '');
  const key = [S.lives, S.wave, S.sun, goTxt, canCall, S.spd, S.items.rain, S.items.vine, S.items.wind, S.itemSel, S.phase].join('|');
  if(key !== S.hudK){
    S.hudK = key;
    $('#fsLives').textContent = S.lives; $('#fsWave').textContent = S.wave;
    $('#fsSun').style.width = Math.round(S.sun / FS_SUN * 100) + '%';
    const go = $('#fsGo'); go.textContent = goTxt; go.disabled = !canCall; go.classList.toggle('pulse', S.phase === 'ready' && !S.result);
    const sp = $('#fsSpd'); sp.textContent = '×' + S.spd; sp.classList.toggle('on', S.spd > 1);
    document.querySelectorAll('.fitm').forEach(b => { const k = b.dataset.it; b.querySelector('b').textContent = S.items[k]; b.disabled = !S.items[k] || !!S.result; b.classList.toggle('on', S.itemSel === k); });
  }
  const hk = S.hand.join(',') + '|' + S.sel;
  if(hk !== S.handK){
    S.handK = hk; const nw = S.newCards; S.newCards = 0;
    let h = '';
    for(let i = 0; i < FS_HAND; i++){
      const k = S.hand[i];
      h += k ? `<button class="fcard k-${k}${S.sel === i ? ' on' : ''}${i >= S.hand.length - nw ? ' new' : ''}" data-i="${i}" aria-label="${k === 'compost' ? '퇴비 카드: 식물을 거름으로 바꾸고 씨앗 카드 1장' : FS_PL[k].name + ' 카드: ' + FS_PL[k].tip}" aria-pressed="${S.sel === i}">${FS_ICO[k]}<span>${FS_CARD_NAME[k]}</span></button>` : '<span class="fcard empty" aria-hidden="true"></span>';
    }
    $('#fsHand').innerHTML = h;
  }
}

/* ---------- 그리기 도구 ---------- */
function fsE(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, Math.PI * 2); }
function fsRR(c, x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fsMix(hex, amt){
  const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, a = Math.abs(amt);
  const ch = s => Math.round(((n >> s) & 255) + (t - ((n >> s) & 255)) * a);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
/* 말랑한 비닐 인형 느낌: 위 왼쪽이 밝고 가장자리가 살짝 어두운 둥근 덩어리 */
function fsBlob(c, x, y, rx, ry, col, line, rot){
  const g = c.createRadialGradient(x - rx * .35, y - ry * .45, Math.min(rx, ry) * .08, x, y, Math.max(rx, ry) * 1.08);
  g.addColorStop(0, fsMix(col, .38)); g.addColorStop(.55, col); g.addColorStop(1, fsMix(col, -.22));
  fsE(c, x, y, rx, ry, rot); c.fillStyle = g; c.fill();
  if(line !== 0){ c.lineWidth = line || 3; c.strokeStyle = fsMix(col, -.5); c.stroke(); }
}
function fsGloss(c, x, y, rx, ry, a){ fsE(c, x - rx * .32, y - ry * .5, rx * .36, ry * .2, -.35); c.fillStyle = `rgba(255,255,255,${a || .5})`; c.fill(); }
function fsFace(c, x, y, s, eye){
  s = s || 1;
  for(const dx of [-8, 8]){ fsE(c, x + dx * s, y, 3.4 * s, 4.2 * s); c.fillStyle = eye || '#2A1A10'; c.fill(); fsE(c, x + dx * s + 1.1 * s, y - 1.6 * s, 1.2 * s, 1.3 * s); c.fillStyle = '#fff'; c.fill(); }
  for(const dx of [-14, 14]){ fsE(c, x + dx * s, y + 6 * s, 4.2 * s, 2.6 * s); c.fillStyle = 'rgba(255,120,140,.45)'; c.fill(); }
  c.beginPath(); c.arc(x, y + 4 * s, 3 * s, .15 * Math.PI, .85 * Math.PI); c.lineWidth = 1.8 * s; c.strokeStyle = eye || '#2A1A10'; c.stroke();
}
function fsAcorn(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.moveTo(-11, -2); c.bezierCurveTo(-12, 12, -4, 20, 0, 22); c.bezierCurveTo(4, 20, 12, 12, 11, -2); c.closePath();
  const g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#F2B863'); g.addColorStop(1, '#C67E2E'); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#7A4A1C'; c.stroke();
  fsE(c, 0, -3, 14, 8); c.fillStyle = '#8A5A2B'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -10); c.lineTo(1, -16); c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#5A3514'; c.stroke();
  fsE(c, -4, 6, 2.2, 5); c.fillStyle = 'rgba(255,240,200,.6)'; c.fill();
  c.restore();
}
/* 한 번 그려 둔 그림(식물·적)을 기기 해상도로 보관 */
function fsSprite(key, w, h, ox, oy, draw){
  const S = G; let sp = S.spr[key]; if(sp) return sp;
  const k = S.scale, cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
  const c = cv.getContext('2d'); c.scale(k, k); c.translate(ox, oy); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c);
  sp = S.spr[key] = { cv, w, h, ox, oy }; return sp;
}
const fsPut = (c, sp, x, y) => c.drawImage(sp.cv, x - sp.ox, y - sp.oy, sp.w, sp.h);

/* ---------- 식물 ---------- */
function fsPlantBody(c, k, lv){
  const s = [.96, 1.08, 1.2][lv - 1];
  fsE(c, 0, 34, 36 * s + 4, 10); c.fillStyle = 'rgba(20,60,10,.22)'; c.fill();
  c.translate(0, 32); c.scale(s, s); c.translate(0, -32);
  if(k === 'pine'){
    fsE(c, 0, 31, 24, 7); c.fillStyle = '#8B5E3C'; c.fill();
    fsRR(c, -7, 4, 14, 28, 5); c.fillStyle = '#9A6A3F'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#5E3B1E'; c.stroke();
    fsBlob(c, 0, 10, 38, 20, '#3E9A45'); fsBlob(c, 0, -8, 30, 18, '#48A94E'); fsBlob(c, 0, -25, 21, 15, '#5CBF60'); fsBlob(c, 0, -38, 9, 8, '#72CF72');
    fsGloss(c, 0, -25, 21, 15, .45);
    const cone = lv >= 3 ? '#E0A030' : '#A0673A';
    for(const [x, y] of [[-20, 18], [19, 14]]){ fsBlob(c, x, y, 6.5, 8.5, cone, 2); c.beginPath(); c.moveTo(x - 5, y - 2); c.lineTo(x + 5, y + 3); c.moveTo(x - 5, y + 3); c.lineTo(x + 5, y - 2); c.lineWidth = 1.4; c.strokeStyle = 'rgba(60,30,10,.5)'; c.stroke(); }
    fsFace(c, 0, -8, .95);
    if(lv >= 2){ c.beginPath(); for(let i = 0; i < 5; i++){ const a = -Math.PI / 2 + i * Math.PI * 2 / 5, a2 = a + Math.PI / 5; c.lineTo(Math.cos(a) * 9, -50 + Math.sin(a) * 9); c.lineTo(Math.cos(a2) * 4, -50 + Math.sin(a2) * 4); } c.closePath(); c.fillStyle = '#FFD54A'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#B07A00'; c.stroke(); }
  } else if(k === 'thorn'){
    for(let i = 0; i < 12; i++){
      const a = -Math.PI * 1.05 + i * Math.PI * 1.1 / 11, bx = Math.cos(a) * 34, by = 4 + Math.sin(a) * 30;
      c.beginPath(); c.moveTo(bx + Math.cos(a + 1.4) * 6, by + Math.sin(a + 1.4) * 6); c.lineTo(bx + Math.cos(a) * 15, by + Math.sin(a) * 15); c.lineTo(bx + Math.cos(a - 1.4) * 6, by + Math.sin(a - 1.4) * 6); c.closePath();
      c.fillStyle = '#F6EACB'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = '#A88A58'; c.stroke();
    }
    fsBlob(c, -19, 14, 21, 18, '#4F8F3A'); fsBlob(c, 19, 14, 21, 18, '#4F8F3A'); fsBlob(c, 0, 0, 29, 26, '#62A847');
    fsGloss(c, 0, 0, 29, 26, .4);
    for(const [x, y, r] of [[-15, -12, 5], [16, -6, 4.5], [-24, 10, 4], [22, 18, 4]]){ fsBlob(c, x, y, r, r, lv >= 3 ? '#E0457A' : '#B84AA0', 1.5); }
    fsFace(c, 0, 6, .95);
    if(lv >= 3){ for(let i = 0; i < 5; i++){ const a = i * Math.PI * 2 / 5; fsE(c, Math.cos(a) * 6, -26 + Math.sin(a) * 6, 5, 5); c.fillStyle = '#FF8FB1'; c.fill(); } fsE(c, 0, -26, 4, 4); c.fillStyle = '#FFE36B'; c.fill(); }
  } else if(k === 'fire'){
    c.beginPath(); c.moveTo(0, 32); c.bezierCurveTo(-4, 14, 14, 0, 2, -14); c.lineWidth = 8; c.strokeStyle = '#2F7D34'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#4FA653'; c.stroke();
    fsBlob(c, -14, 20, 13, 6, '#58B85C', 2, -.5); fsBlob(c, 14, 8, 12, 5.5, '#58B85C', 2, .6);
    fsBlob(c, 0, -34, 22, 26, '#FFD84D', 2.5); fsE(c, -5, -40, 9, 11); c.fillStyle = 'rgba(255,255,230,.75)'; c.fill();
    fsBlob(c, 0, -60, 17, 7, '#4CAF50', 2.5);
    c.beginPath(); c.moveTo(0, -66); c.quadraticCurveTo(6, -76, 12, -72); c.lineWidth = 3; c.strokeStyle = '#2F7D34'; c.stroke();
    fsFace(c, 0, -30, .9, '#6A4000');
    if(lv >= 3){ for(const [x, y] of [[-30, -52], [28, -44], [-24, -14]]){ fsE(c, x, y, 4, 4); c.fillStyle = '#FFF6A8'; c.fill(); } }
  } else {
    fsRR(c, -14, -6, 28, 38, 12); const g = c.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#FFF6E2'); g.addColorStop(1, '#E2CFAE'); c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#A88E68'; c.stroke();
    c.beginPath(); c.ellipse(0, -4, 42, 34, 0, Math.PI, 0); c.quadraticCurveTo(0, 8, -42, -4); c.closePath();
    const cap = lv >= 3 ? '#C24FD0' : '#9C5BD6', g2 = c.createRadialGradient(-12, -26, 4, 0, -10, 48); g2.addColorStop(0, fsMix(cap, .35)); g2.addColorStop(.6, cap); g2.addColorStop(1, fsMix(cap, -.25));
    c.fillStyle = g2; c.fill(); c.lineWidth = 3; c.strokeStyle = fsMix(cap, -.5); c.stroke();
    for(const [x, y, rx, ry] of [[-20, -18, 7, 5], [6, -28, 6.5, 4.6], [24, -12, 5.5, 4], [-4, -12, 4, 3]]){ fsE(c, x, y, rx, ry); c.fillStyle = '#FFFFFF'; c.fill(); }
    fsFace(c, 0, 14, .8, '#3B2366');
  }
}
/* ---------- 적 ---------- */
function fsLegs(c, xs, y, len, ph, col, w){
  c.lineWidth = w || 4; c.strokeStyle = col;
  xs.forEach((x, i) => { const sw = Math.sin(ph + i * 2.1) * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw, y + len); c.stroke(); });
}
function fsEnemyBody(c, type, ph, under){
  const bob = Math.abs(Math.sin(ph)) * 2;
  if(type !== 'crow'){ fsE(c, 0, 4, type === 'bear' ? 50 : type === 'boar' ? 42 : 26, type === 'bear' ? 12 : 8); c.fillStyle = 'rgba(20,50,10,.25)'; c.fill(); }
  if(type === 'ant'){
    fsLegs(c, [-12, -2, 8], -4, 13, ph, '#5A1E14', 3.6);
    c.translate(0, -bob);
    fsBlob(c, -17, -10, 17, 13, '#C4452F'); fsBlob(c, 0, -12, 9, 8, '#B23A27'); fsBlob(c, 16, -18, 13, 12, '#CF4F36');
    fsGloss(c, -17, -10, 17, 13, .45);
    c.beginPath(); c.moveTo(14, -28); c.quadraticCurveTo(12, -40, 20, -42); c.moveTo(20, -27); c.quadraticCurveTo(24, -38, 31, -37); c.lineWidth = 2.6; c.strokeStyle = '#5A1E14'; c.stroke();
    fsE(c, 21, -20, 4.6, 5); c.fillStyle = '#fff'; c.fill(); fsE(c, 22.3, -19.5, 2.4, 2.8); c.fillStyle = '#2A1010'; c.fill();
  } else if(type === 'mouse'){
    c.beginPath(); c.moveTo(-24, -6); c.bezierCurveTo(-40, -4, -40, -24, -30, -26); c.lineWidth = 3.4; c.strokeStyle = '#E79AAE'; c.stroke();
    fsLegs(c, [-12, 10], 0, 6, ph * 1.3, '#E79AAE', 4);
    c.translate(0, -bob);
    fsBlob(c, -4, -12, 24, 15, '#A9A2BD'); fsBlob(c, 16, -16, 14, 12, '#B8B1CC');
    fsBlob(c, 7, -30, 9, 9, '#B8B1CC', 2); fsE(c, 7, -30, 5, 5); c.fillStyle = '#F4A7BB'; c.fill();
    fsGloss(c, -4, -12, 24, 15, .4);
    fsBlob(c, 30, -15, 4.5, 4, '#F28FA6', 1.5);
    fsE(c, 20, -19, 3, 3.6); c.fillStyle = '#1E1A2A'; c.fill(); fsE(c, 21, -20, 1, 1.1); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.moveTo(28, -12); c.lineTo(38, -10); c.moveTo(28, -14); c.lineTo(38, -17); c.lineWidth = 1.2; c.strokeStyle = 'rgba(60,50,70,.6)'; c.stroke();
  } else if(type === 'beetle'){
    fsLegs(c, [-14, -2, 10], -6, 12, ph, '#1B3A50', 3.6);
    c.translate(0, -bob);
    fsBlob(c, 22, -12, 11, 10, '#1F4E6B');
    fsBlob(c, -3, -16, 26, 20, '#2F82B3', 3);
    c.beginPath(); c.moveTo(-3, -35); c.quadraticCurveTo(-1, -18, -3, 3); c.lineWidth = 2; c.strokeStyle = 'rgba(15,45,70,.6)'; c.stroke();
    fsGloss(c, -3, -16, 26, 20, .6);
    for(const [x, y] of [[-14, -18], [8, -22], [6, -8]]){ fsE(c, x, y, 3, 2.4); c.fillStyle = 'rgba(160,220,255,.7)'; c.fill(); }
    fsE(c, 26, -15, 3.2, 3.6); c.fillStyle = '#fff'; c.fill(); fsE(c, 27, -15, 1.6, 2); c.fillStyle = '#10202A'; c.fill();
  } else if(type === 'crow'){
    fsE(c, 0, 4, 20, 6); c.fillStyle = 'rgba(20,40,10,.22)'; c.fill();
    const fl = Math.sin(ph * 2.2) * .9, y0 = -44 - bob * 2;
    fsBlob(c, -6, y0 - 4, 22, 10, '#2C2F55', 2, -.5 + fl);
    c.beginPath(); c.moveTo(-18, y0 + 2); c.lineTo(-32, y0 - 2); c.lineTo(-30, y0 + 8); c.closePath(); c.fillStyle = '#2C2F55'; c.fill();
    fsBlob(c, 0, y0 + 2, 20, 15, '#3B3F6B'); fsBlob(c, 16, y0 - 8, 12, 11, '#474C80');
    c.beginPath(); c.moveTo(26, y0 - 11); c.lineTo(39, y0 - 7); c.lineTo(26, y0 - 3); c.closePath(); c.fillStyle = '#F5A623'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#A86A00'; c.stroke();
    fsBlob(c, -4, y0, 18, 8, '#34386A', 2, .3 - fl);
    fsGloss(c, 0, y0 + 2, 20, 15, .35);
    fsE(c, 19, y0 - 11, 3.6, 3.8); c.fillStyle = '#fff'; c.fill(); fsE(c, 20, y0 - 11, 1.8, 2.1); c.fillStyle = '#111'; c.fill();
  } else if(type === 'mole'){
    if(under){
      fsBlob(c, 0, -6, 30, 15, '#8A5A34', 2.5); fsBlob(c, -12, -12, 9, 6, '#A57048', 0); fsBlob(c, 10, -16, 8, 5, '#A57048', 0);
      for(const [x, y] of [[-20, -4], [18, -2], [4, -20]]){ fsE(c, x, y, 3, 2.4); c.fillStyle = '#6B432A'; c.fill(); }
      return;
    }
    fsLegs(c, [-10, 10], -2, 6, ph, '#5A3A26', 5);
    c.translate(0, -bob);
    fsBlob(c, 0, -16, 25, 22, '#7B5236'); fsBlob(c, 4, -10, 15, 12, '#A57A58', 0);
    fsGloss(c, 0, -16, 25, 22, .35);
    fsBlob(c, 23, -18, 7, 6, '#F28FA6', 2);
    for(const x of [-14, 16]){ fsBlob(c, x, -2, 7, 5, '#F4C7B8', 1.5); }
    c.beginPath(); c.moveTo(8, -24); c.quadraticCurveTo(11, -27, 14, -24); c.moveTo(-2, -24); c.quadraticCurveTo(1, -27, 4, -24); c.lineWidth = 2.2; c.strokeStyle = '#2A1A10'; c.stroke();
  } else if(type === 'boar'){
    fsLegs(c, [-26, -12, 6, 18], -6, 14, ph, '#4A2B1A', 7);
    c.translate(0, -bob);
    c.beginPath(); for(let i = 0; i < 7; i++){ c.moveTo(-30 + i * 8, -42); c.lineTo(-26 + i * 8, -54); } c.lineWidth = 4; c.strokeStyle = '#4A2B1A'; c.stroke();
    fsBlob(c, -6, -22, 38, 26, '#8E5B3B', 3); fsBlob(c, 26, -22, 21, 19, '#9C6844', 3);
    fsGloss(c, -6, -22, 38, 26, .35);
    c.beginPath(); c.moveTo(14, -40); c.lineTo(20, -52); c.lineTo(26, -38); c.closePath(); c.fillStyle = '#7A4A2E'; c.fill();
    fsBlob(c, 44, -18, 10, 9, '#E8A08A', 2);
    fsE(c, 42, -18, 1.8, 2.6); c.fillStyle = '#6A3020'; c.fill(); fsE(c, 47, -18, 1.8, 2.6); c.fill();
    c.beginPath(); c.moveTo(36, -10); c.quadraticCurveTo(40, -2, 48, -6); c.lineWidth = 4.5; c.strokeStyle = '#FFF6DE'; c.stroke();
    fsE(c, 30, -28, 3.6, 4); c.fillStyle = '#fff'; c.fill(); fsE(c, 31, -28, 1.8, 2.2); c.fillStyle = '#111'; c.fill();
    c.beginPath(); c.moveTo(24, -35); c.lineTo(34, -33); c.lineWidth = 2.4; c.strokeStyle = '#3A2010'; c.stroke();
  } else if(type === 'bear'){
    fsLegs(c, [-22, 18], -10, 14, ph, '#7A4E2A', 14);
    c.translate(0, -bob);
    fsBlob(c, 0, -40, 44, 40, '#A06A3C', 3.5); fsBlob(c, 6, -32, 27, 26, '#EFD2A2', 0);
    fsGloss(c, 0, -40, 44, 40, .3);
    fsBlob(c, 12, -82, 10, 10, '#A8733F', 3); fsBlob(c, 44, -80, 10, 10, '#A8733F', 3);
    fsBlob(c, 28, -66, 26, 23, '#A8733F', 3);
    fsBlob(c, 38, -60, 13, 9, '#F1DAB2', 2); fsBlob(c, 44, -64, 5.5, 4.2, '#3A2418', 0);
    for(const dx of [20, 34]){ fsE(c, dx, -72, 3.4, 4); c.fillStyle = '#1A0E08'; c.fill(); fsE(c, dx + 1, -73.5, 1.2, 1.3); c.fillStyle = '#fff'; c.fill(); }
    c.beginPath(); c.moveTo(10, -46); c.lineTo(48, -46); c.lineTo(29, -24); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#C9C0D8'; c.stroke();
    for(const [x, y] of [[20, -41], [34, -40], [29, -32]]){ fsE(c, x, y, 2.6, 2.6); c.fillStyle = '#FF5A7A'; c.fill(); }
    fsBlob(c, -30, -34, 11, 16, '#955F33', 3, .5);
  }
}
const FS_ES = 1.25;   /* 적 그림 배율 */
const FS_EBOX = { ant:[90, 80, 46, 56], mouse:[100, 70, 50, 50], beetle:[90, 80, 46, 56], crow:[100, 100, 50, 80], mole:[90, 80, 45, 56], boar:[140, 110, 70, 80], bear:[150, 150, 64, 124] };
function fsEnemySprite(type, fr, under){
  const b = FS_EBOX[type];
  return fsSprite('e' + type + fr + (under ? 'u' : ''), b[0], b[1], b[2], b[3], c => fsEnemyBody(c, type, fr / 4 * Math.PI * 2, under));
}

/* ---------- 배경(맵마다 한 번만 그림) ---------- */
function fsBg(){
  const S = G, k = S.scale, bg = document.createElement('canvas'); bg.width = S.cv.width; bg.height = S.cv.height;
  const c = bg.getContext('2d'); c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round';
  const rng = mulberry(seedFrom('fsbg:' + S.mapName)), T = (cc, r) => fsCellAt(S, cc, r);
  for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++){
    c.fillStyle = (r + cc) % 2 ? '#86C95A' : '#7BBE50'; c.fillRect(cc * FS_S, r * FS_S, FS_S, FS_S);
  }
  /* 풀 결·꽃 */
  for(let i = 0; i < 260; i++){
    const x = rng() * FS_W, y = rng() * FS_H, cc = Math.floor(x / FS_S), r = Math.floor(y / FS_S); if(T(cc, r) !== 0) continue;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y - 6, x + (rng() - .5) * 8, y - 11); c.lineWidth = 2.4; c.strokeStyle = rng() < .5 ? 'rgba(60,120,40,.35)' : 'rgba(200,240,150,.35)'; c.stroke();
  }
  for(let i = 0; i < 26; i++){
    const x = rng() * FS_W, y = rng() * FS_H, cc = Math.floor(x / FS_S), r = Math.floor(y / FS_S); if(T(cc, r) !== 0) continue;
    const col = ['#FFFFFF', '#FFE36B', '#FFB3C7'][Math.floor(rng() * 3)];
    for(let p = 0; p < 5; p++){ const a = p * Math.PI * 2 / 5; fsE(c, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, 3.2); c.fillStyle = col; c.fill(); }
    fsE(c, x, y, 2.4, 2.4); c.fillStyle = '#F2A33A'; c.fill();
  }
  /* 칸 경계를 은은하게 */
  for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(T(cc, r) === 0){ fsRR(c, cc * FS_S + 4, r * FS_S + 4, FS_S - 8, FS_S - 8, 16); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.13)'; c.stroke(); }
  /* 개울 */
  const water = (cc, r) => T(cc, r) === 3;
  for(const [col, ins] of [['#3F97C9', 2], ['#6CC3EE', 10]]){
    c.fillStyle = col;
    for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(water(cc, r)){
      fsRR(c, cc * FS_S + ins, r * FS_S + ins, FS_S - ins * 2, FS_S - ins * 2, 30); c.fill();
      if(water(cc + 1, r)) c.fillRect(cc * FS_S + 50, r * FS_S + ins, FS_S, FS_S - ins * 2);
      if(water(cc, r + 1)) c.fillRect(cc * FS_S + ins, r * FS_S + 50, FS_S - ins * 2, FS_S);
    }
  }
  for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(water(cc, r)){
    const x = cc * FS_S + 50, y = r * FS_S + 50;
    c.beginPath(); c.arc(x - 10, y - 8, 16, Math.PI * 1.1, Math.PI * 1.7); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
    if(rng() < .5){ fsBlob(c, x + 16, y + 14, 14, 9, '#5DB65A', 2); c.beginPath(); c.moveTo(x + 16, y + 14); c.lineTo(x + 28, y + 9); c.lineWidth = 3; c.strokeStyle = '#7FCB5A'; c.stroke(); }
  }
  /* 흙길: 테두리 → 속 → 디딤돌 */
  const path = (cc, r) => { const t = T(cc, r); return t === 1 || (t === 4 && cc === S.home.c); };
  const starts = S.cellRoutes.map(cs => cs[0][0]);
  for(const [col, ins] of [['#A97A45', 5], ['#D9AE73', 12]]){
    c.fillStyle = col;
    for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(path(cc, r)){
      fsRR(c, cc * FS_S + ins, r * FS_S + ins, FS_S - ins * 2, FS_S - ins * 2, 26); c.fill();
      if(path(cc + 1, r)) c.fillRect(cc * FS_S + 50, r * FS_S + ins, FS_S, FS_S - ins * 2);
      if(path(cc, r + 1)) c.fillRect(cc * FS_S + ins, r * FS_S + 50, FS_S - ins * 2, FS_S);
      if(r === 0 && starts.includes(cc)) c.fillRect(cc * FS_S + ins, -10, FS_S - ins * 2, 60);
    }
  }
  for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(T(cc, r) === 1){
    const x = cc * FS_S + 50, y = r * FS_S + 50;
    fsE(c, x + (rng() - .5) * 26, y + (rng() - .5) * 26, 17, 11, rng()); c.fillStyle = '#E8CFA0'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(150,110,60,.45)'; c.stroke();
    for(let i = 0; i < 4; i++){ fsE(c, x + (rng() - .5) * 70, y + (rng() - .5) * 70, 3, 2.4); c.fillStyle = 'rgba(140,95,50,.45)'; c.fill(); }
  }
  /* 바위 */
  for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(T(cc, r) === 2){
    const x = cc * FS_S + 50, y = r * FS_S + 56;
    fsE(c, x, y + 20, 38, 10); c.fillStyle = 'rgba(20,50,10,.25)'; c.fill();
    fsBlob(c, x + 14, y + 4, 22, 18, '#9E9A92', 3); fsBlob(c, x - 8, y - 4, 30, 26, '#B4B0A6', 3);
    fsGloss(c, x - 8, y - 4, 30, 26, .45);
    fsBlob(c, x - 12, y - 24, 16, 7, '#7DB04C', 0);
  }
  /* 굴 입구 */
  starts.forEach(cc => {
    const x = cc * FS_S + 50;
    fsBlob(c, x, 10, 58, 34, '#8A5A34', 3); fsBlob(c, x - 30, 30, 12, 8, '#A57048', 0); fsE(c, x, 16, 38, 22); c.fillStyle = '#2B1A0E'; c.fill();
    fsE(c, x, 22, 28, 12); c.fillStyle = '#140A04'; c.fill();
    for(const dx of [-50, 48]) { fsBlob(c, x + dx, 34, 8, 6, '#A57048', 0); }
  });
  /* 도토리 창고: 나무 그루터기 */
  const hx = S.home.x, y0 = (FS_R - 1) * FS_S;
  fsE(c, hx, FS_H - 6, 150, 18); c.fillStyle = 'rgba(20,50,10,.3)'; c.fill();
  for(const [dx, rot] of [[-128, -.3], [126, .3]]) fsBlob(c, hx + dx, FS_H - 18, 30, 14, '#8A5A34', 3, rot);
  fsRR(c, hx - 128, y0 + 14, 256, 120, 34);
  const g = c.createLinearGradient(hx - 128, 0, hx + 128, 0); g.addColorStop(0, '#9A6437'); g.addColorStop(.45, '#B77A45'); g.addColorStop(1, '#7E4F2A');
  c.fillStyle = g; c.fill(); c.lineWidth = 4; c.strokeStyle = '#5A3514'; c.stroke();
  for(const dx of [-96, -52, 58, 100]){ c.beginPath(); c.moveTo(hx + dx, y0 + 44); c.quadraticCurveTo(hx + dx + 6, y0 + 70, hx + dx - 2, y0 + 100); c.lineWidth = 3; c.strokeStyle = 'rgba(70,40,15,.45)'; c.stroke(); }
  fsE(c, hx, y0 + 22, 126, 24); c.fillStyle = '#E8C48E'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#5A3514'; c.stroke();
  for(const r of [96, 68, 40]){ fsE(c, hx, y0 + 22, r, r * .19); c.lineWidth = 2; c.strokeStyle = 'rgba(150,100,50,.5)'; c.stroke(); }
  fsE(c, hx, y0 + 24, 56, 14); c.fillStyle = '#3B230F'; c.fill();
  /* 작은 버섯 장식 */
  for(const [dx, s] of [[-112, 1], [112, .8]]){ const x = hx + dx, y = y0 + 20; fsRR(c, x - 4 * s, y - 2, 8 * s, 14 * s, 3); c.fillStyle = '#F6EBD5'; c.fill(); c.beginPath(); c.ellipse(x, y, 12 * s, 9 * s, 0, Math.PI, 0); c.closePath(); c.fillStyle = '#E4574B'; c.fill(); fsE(c, x - 3 * s, y - 5 * s, 2.2 * s, 1.7 * s); c.fillStyle = '#fff'; c.fill(); }
  /* 가장자리 그늘 */
  const v = c.createRadialGradient(FS_W / 2, FS_H / 2, FS_H * .35, FS_W / 2, FS_H / 2, FS_H * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,30,10,.28)');
  c.fillStyle = v; c.fillRect(0, 0, FS_W, FS_H);
  S.bgc = bg;
}

/* ---------- 매 프레임 그리기 ---------- */
function fsRender(){
  const S = G, c = S.ctx, k = S.scale; if(!c) return;
  if(!S.bgc) fsBg();
  const now = performance.now() / 1000, rd = FXR.reduce;
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(S.bgc, 0, 0);
  const sh = S.shake > 0 && !rd ? S.shake : 0;
  c.setTransform(k, 0, 0, k, (Math.random() * 2 - 1) * sh * k, (Math.random() * 2 - 1) * sh * k);
  c.lineJoin = 'round'; c.lineCap = 'round';
  /* 고른 카드: 심을 수 있는 칸 · 키울 수 있는 식물 */
  const card = S.sel >= 0 ? S.hand[S.sel] : null, pulse = .5 + .5 * Math.sin(now * 5);
  if(card){
    for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++){
      const p = fsPlantAt(S, cc, r);
      if(card === 'compost' ? p : (!p && fsCellAt(S, cc, r) === 0)){ fsRR(c, cc * FS_S + 7, r * FS_S + 7, FS_S - 14, FS_S - 14, 18); c.fillStyle = `rgba(255,255,255,${.16 + .12 * pulse})`; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(); }
      else if(p && p.k === card && p.lv < 3){ fsRR(c, cc * FS_S + 5, r * FS_S + 5, FS_S - 10, FS_S - 10, 20); c.fillStyle = `rgba(255,214,80,${.22 + .2 * pulse})`; c.fill(); c.lineWidth = 4; c.strokeStyle = '#FFD54A'; c.stroke(); }
    }
  }
  if(S.itemSel === 'vine'){
    for(let r = 0; r < FS_R; r++) for(let cc = 0; cc < FS_C; cc++) if(fsCellAt(S, cc, r) === 1){ fsRR(c, cc * FS_S + 8, r * FS_S + 8, FS_S - 16, FS_S - 16, 20); c.fillStyle = `rgba(120,220,90,${.18 + .15 * pulse})`; c.fill(); }
  }
  /* 창고 도토리 더미 */
  const hx = S.home.x, hy = (FS_R - 1) * FS_S + 24;
  const pile = [[0, -6], [-26, 2], [26, 2], [-48, 8], [48, 8], [-13, -20], [13, -20], [0, -34], [-34, -12], [34, -12]];
  for(let i = S.lives - 1; i >= 0; i--) fsAcorn(c, hx + pile[i][0], hy + pile[i][1] - 8, .95);
  fsRR(c, hx - 44, hy + 22, 88, 40, 20); c.fillStyle = '#FFF6DE'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#2A1650'; c.stroke();
  fsAcorn(c, hx - 20, hy + 38, .7); c.font = '32px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = S.lives < 10 ? '#D23B50' : '#3B2366'; c.fillText(String(S.lives), hx + 13, hy + 44);
  /* 독구름(땅에 깔림) */
  for(const cl of S.clouds){
    const a = Math.min(1, cl.t / .2) * Math.min(1, (cl.dur - cl.t) / .5);
    for(let i = 0; i < 6; i++){ const an = i * 1.05 + now * .6, rr = cl.r * .55; fsE(c, cl.x + Math.cos(an) * rr, cl.y + Math.sin(an) * rr * .55, cl.r * .5, cl.r * .34); c.fillStyle = `rgba(${i % 2 ? '170,110,220' : '130,200,110'},${.28 * a})`; c.fill(); }
    fsE(c, cl.x, cl.y, cl.r * .7, cl.r * .45); c.fillStyle = `rgba(160,120,210,${.25 * a})`; c.fill();
  }
  /* 식물·적: 위에서 아래 순서로 */
  const list = [];
  for(const p of S.plants) list.push({ y:p.y + 30, p });
  for(const e of S.enemies) if(!e.dead && e.y > -40) list.push({ y:e.E.air ? e.y + 60 : e.y, e });
  list.sort((a, b) => a.y - b.y);
  for(const it of list){
    if(it.p){
      const p = it.p, sp = fsSprite('p' + p.k + p.lv, 130, 150, 65, 100, cc => fsPlantBody(cc, p.k, p.lv));
      const g = Math.min(1, p.grow / .3), pop = g < 1 ? .6 + .4 * g + Math.sin(g * Math.PI) * .15 : 1, sq = p.fire > 0 && !rd ? 1 + p.fire * .25 : 1;
      if(p.k === 'fire'){ const gr = c.createRadialGradient(p.x, p.y - 34, 4, p.x, p.y - 34, 70); gr.addColorStop(0, `rgba(255,236,120,${.45 + .2 * Math.sin(now * 3 + p.c)})`); gr.addColorStop(1, 'rgba(255,236,120,0)'); c.fillStyle = gr; c.fillRect(p.x - 70, p.y - 104, 140, 140); }
      c.save(); c.translate(p.x, p.y + 32); c.scale(pop / Math.sqrt(sq), pop * sq); c.translate(-p.x, -(p.y + 32)); fsPut(c, sp, p.x, p.y); c.restore();
      for(let i = 0; i < p.lv; i++){ const px = p.x + (i - (p.lv - 1) / 2) * 20; fsE(c, px, p.y + 42, 7, 7); c.fillStyle = '#FFD54A'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#7A4A00'; c.stroke(); }
    } else {
      const e = it.e, fr = Math.floor(e.walk * 1.3) % 4, sp = fsEnemySprite(e.type, e.under ? 0 : fr, e.under);
      const fade = Math.min(1, (e.R.L - e.d) / 40);
      c.save(); c.globalAlpha = Math.max(0, fade);
      c.translate(e.x, e.y); c.scale(e.face < 0 && !e.under ? -FS_ES : FS_ES, FS_ES);
      if(e.rootT > 0 && !e.E.air){ c.save(); for(let i = 0; i < 3; i++){ c.beginPath(); c.ellipse(0, 2 - i * 7, e.E.r * .9, 8, 0, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = i % 2 ? '#7FCB5A' : '#2E7D32'; c.stroke(); } c.restore(); }
      fsPut(c, sp, 0, 0);
      if(e.hitT > 0){ c.globalCompositeOperation = 'lighter'; c.globalAlpha = e.hitT * 3; fsPut(c, sp, 0, 0); c.globalCompositeOperation = 'source-over'; }
      c.restore();
      if(e.acidT > 0 && !e.under){ for(let i = 0; i < 2; i++){ const t = (now * 1.5 + i * .5 + e.id * .3) % 1; fsE(c, e.x - 10 + i * 20, e.y - 30 - t * 30, 4, 4); c.fillStyle = `rgba(150,230,110,${.8 * (1 - t)})`; c.fill(); } }
      if(e.slowT > 0 && !e.E.air && !e.under){ c.beginPath(); for(let i = 0; i < 3; i++){ const ax = e.x - 16 + i * 16; c.moveTo(ax, e.y - 4); c.lineTo(ax + 4, e.y - 14); } c.lineWidth = 3; c.strokeStyle = 'rgba(246,234,203,.9)'; c.stroke(); }
      if(e.hp < e.max && !e.under){
        const w = e.E.boss ? 110 : 56, y = e.y - (FS_EBOX[e.type][3] - 4) * FS_ES - (e.E.boss ? 0 : 4), f = Math.max(0, e.hp / e.max);
        fsRR(c, e.x - w / 2 - 3, y - 3, w + 6, 16, 8); c.fillStyle = 'rgba(42,22,80,.85)'; c.fill();
        fsRR(c, e.x - w / 2, y, Math.max(6, w * f), 10, 5); c.fillStyle = f > .5 ? '#7EE06A' : f > .25 ? '#FFC93C' : '#FF6B6B'; c.fill();
      }
    }
  }
  /* 날아가는 것 */
  for(const s of S.shots){
    if(s.k === 'cone'){ c.save(); c.translate(s.x + s.off, s.y); c.rotate(now * 14); fsE(c, 0, 0, 9, 12); c.fillStyle = '#A0673A'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#5E3B1E'; c.stroke(); c.restore(); }
    else { const gr = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26); gr.addColorStop(0, 'rgba(220,170,255,.9)'); gr.addColorStop(1, 'rgba(180,120,240,0)'); c.fillStyle = gr; c.fillRect(s.x - 26, s.y - 26, 52, 52); fsBlob(c, s.x, s.y, 11, 11, '#A86BE0', 2); }
  }
  /* 효과 */
  for(const f of S.fx){
    const q = f.t / f.dur;
    if(f.k === 'ring'){ c.beginPath(); c.arc(f.x, f.y, f.r * (.3 + .7 * q), 0, Math.PI * 2); c.lineWidth = 6 * (1 - q); c.strokeStyle = `rgba(${f.col},${1 - q})`; c.stroke(); }
    else if(f.k === 'dot'){ fsE(c, f.x, f.y, f.r * (1 - q * .6), f.r * (1 - q * .6)); c.fillStyle = `rgba(${f.col},${1 - q})`; c.fill(); }
    else if(f.k === 'spark'){ c.beginPath(); for(let i = 0; i < 4; i++){ const a = i * Math.PI / 2 + .4; c.moveTo(f.x + Math.cos(a) * 6, f.y + Math.sin(a) * 6); c.lineTo(f.x + Math.cos(a) * (10 + 14 * q), f.y + Math.sin(a) * (10 + 14 * q)); } c.lineWidth = 3; c.strokeStyle = `rgba(255,236,170,${1 - q})`; c.stroke(); }
    else if(f.k === 'bolt'){
      const r = mulberry(Math.floor(f.seed + f.t * 30));
      c.save(); c.globalCompositeOperation = 'lighter';
      for(const [w, col] of [[12, `rgba(255,220,90,${.35 * (1 - q)})`], [4, `rgba(255,255,220,${1 - q})`]]){
        c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]);
        for(let i = 1; i < f.pts.length; i++){ const [ax, ay] = f.pts[i - 1], [bx, by] = f.pts[i]; for(let j = 1; j <= 3; j++){ const t = j / 4; c.lineTo(ax + (bx - ax) * t + (r() - .5) * 26, ay + (by - ay) * t + (r() - .5) * 26); } c.lineTo(bx, by); }
        c.lineWidth = w; c.strokeStyle = col; c.stroke();
      }
      c.restore();
    }
    else if(f.k === 'thorn'){ c.beginPath(); c.ellipse(f.x, f.y, f.r * (.6 + .4 * q), f.r * (.6 + .4 * q) * .7, 0, 0, Math.PI * 2); c.lineWidth = 5; c.setLineDash([10, 12]); c.strokeStyle = `rgba(246,234,203,${.7 * (1 - q)})`; c.stroke(); c.setLineDash([]); }
    else if(f.k === 'vine'){
      const a = Math.min(1, f.t / .25) * Math.min(1, (f.dur - f.t) / .4);
      for(let i = 0; i < 6; i++){ const an = i * Math.PI / 3 + .3, gx = f.x + Math.cos(an) * 60, gy = f.y + Math.sin(an) * 42; c.beginPath(); c.moveTo(f.x, f.y); c.quadraticCurveTo(f.x + Math.cos(an + .7) * 60, f.y + Math.sin(an + .7) * 40, gx, gy); c.lineWidth = 7; c.strokeStyle = `rgba(46,125,50,${a})`; c.stroke(); fsE(c, gx, gy, 9, 5, an); c.fillStyle = `rgba(127,203,90,${a})`; c.fill(); }
      c.beginPath(); c.arc(f.x, f.y, 120, 0, Math.PI * 2); c.lineWidth = 3; c.setLineDash([8, 10]); c.strokeStyle = `rgba(200,255,170,${.6 * a})`; c.stroke(); c.setLineDash([]);
    }
    else if(f.k === 'gust'){
      for(let i = 0; i < 7; i++){ const y = FS_H * (1 - q) - i * 190 + 200, x = 100 + (i * 173) % 700; c.beginPath(); c.arc(x, y, 50 + i * 4, Math.PI * .9, Math.PI * 2.1); c.lineWidth = 7; c.strokeStyle = `rgba(255,255,255,${.6 * (1 - q)})`; c.stroke(); }
    }
  }
  /* 소나기 */
  if(S.rainT > 0){
    const a = Math.min(1, S.rainT / .6, (10 - S.rainT) / .4);
    c.fillStyle = `rgba(70,120,200,${.12 * a})`; c.fillRect(0, 0, FS_W, FS_H);
    c.beginPath(); for(let i = 0; i < (rd ? 20 : 60); i++){ const x = (i * 157 + now * 260) % (FS_W + 200) - 100, y = (i * 263 + now * 1300) % FS_H; c.moveTo(x, y); c.lineTo(x - 10, y + 36); }
    c.lineWidth = 3; c.strokeStyle = `rgba(210,235,255,${.7 * a})`; c.stroke();
  }
  /* 식물 정보 */
  if(S.info){
    const p = S.info.p, P = FS_PL[p.k], R = P.rng[p.lv - 1] * FS_S, a = Math.min(1, (2.6 - S.info.t) / .4);
    c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.fillStyle = `rgba(255,255,255,${.14 * a})`; c.fill(); c.lineWidth = 4; c.setLineDash([14, 10]); c.strokeStyle = `rgba(255,255,255,${.85 * a})`; c.stroke(); c.setLineDash([]);
    fsPill(c, Math.max(170, Math.min(FS_W - 170, p.x)), Math.max(40, p.y - 100), P.name + ' ' + p.lv + '단계', 30, a);
  }
  /* 떠오르는 글자 */
  for(const f of S.floats){
    const q = f.t / f.dur, y = f.y - q * 70, a = q < .7 ? 1 : 1 - (q - .7) / .3;
    c.save(); c.globalAlpha = a; c.font = `${f.size}px "Jua", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#2A1650'; c.strokeText(f.text, f.x, y); c.fillStyle = f.col; c.fillText(f.text, f.x, y);
    if(f.acorn) fsAcorn(c, f.x + c.measureText(f.text).width / 2 + 24, y - 4, 1.1);
    c.restore();
  }
  /* 안내 한 줄 */
  const hint = S.result ? '' : S.itemSel === 'vine' ? '흙길 칸을 눌러 덩굴 올가미를 놓아요' : card ? (card === 'compost' ? '퇴비로 바꿀 식물을 눌러요' : FS_PL[card].name + ' · 풀밭 칸을 눌러 심어요') : S.phase === 'ready' ? '카드를 골라 풀밭에 심고 [시작 ▶]' : S.phase === 'break' ? '다음 무리까지 ' + Math.ceil(S.breakT) + '초' : '';
  if(hint) fsPill(c, FS_W / 2, 54, hint, 32, 1, card || S.itemSel ? '#FFF3B0' : '#FFFFFF');
  /* 큰 알림 */
  if(S.banner){
    const b = S.banner, q = b.t / b.dur, a = Math.min(1, b.t / .15, (b.dur - b.t) / .3), sc = rd ? 1 : 1 + Math.max(0, .25 - b.t) * 1.6;
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(FS_W / 2, FS_H * .36); c.scale(sc, sc);
    c.font = '84px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 16; c.strokeStyle = '#2A1650'; c.strokeText(b.big, 0, 0); c.fillStyle = '#FFF6DE'; c.fillText(b.big, 0, 0);
    if(b.small){ c.font = '40px "Jua", sans-serif'; c.lineWidth = 10; c.strokeText(b.small, 0, 72); c.fillStyle = '#FFE36B'; c.fillText(b.small, 0, 72); }
    c.restore();
  }
  if(S.flash > 0){ const gr = c.createRadialGradient(FS_W / 2, FS_H / 2, FS_H * .3, FS_W / 2, FS_H / 2, FS_H * .75); gr.addColorStop(0, 'rgba(230,40,60,0)'); gr.addColorStop(1, `rgba(230,40,60,${S.flash * .55})`); c.fillStyle = gr; c.fillRect(0, 0, FS_W, FS_H); }
  if(S.result === 'lose'){ c.fillStyle = `rgba(30,10,40,${Math.min(.35, (1.6 - S.endT) * .3)})`; c.fillRect(0, 0, FS_W, FS_H); }
}
function fsPill(c, x, y, text, size, a, bg){
  c.save(); c.globalAlpha = a == null ? 1 : Math.max(0, a); c.font = `${size}px "Jua", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + size * 1.4, h = size * 1.6;
  fsRR(c, x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = bg || '#FFFFFF'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#2A1650'; c.stroke();
  c.fillStyle = '#3B2366'; c.fillText(text, x, y + 2); c.restore();
}


CONCEPTS.tower = { fixed:[
  { at:4, key:'crow', name:'까마귀', desc:'하늘을 날아요. 솔방울 나무와 반딧불 등만 맞힐 수 있어요.' },
  { at:5, key:'boar', name:'멧돼지(중간 대장)', desc:'단단하고, 창고에 닿으면 도토리 2개를 훔쳐요.' },
  { at:8, key:'beetle', name:'딱정벌레', desc:'단단한 껍질(갑옷)이 있어요. 반딧불 등은 갑옷을 무시해요.' },
  { at:10, key:'bear', name:'먹보 곰(챕터 대장)', desc:'아주 튼튼하고 도토리 5개를 훔쳐요. 요정 도움을 아껴 두세요.' },
  { at:13, key:'mole', name:'두더지', desc:'5초마다 2초씩 땅속에 숨어 공격받지 않아요.' }] };


/* ===================== 게임 정의(엔진이 이 게임을 부르는 창구) =====================
   이름·색·도움말·썸네일·챕터·난이도·시작·점수·별을 엔진(core/engine.js)에 알려 준다. 규칙은 games/CLAUDE.md의 '게임 정의 계약' 참고. */
NG.tower = {
  name:'숲 지킴이', col:['#9BE27A','#2E9E5B','#15562E'], time:'약 4분', abil:'전략력',
  icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.8 10.6h12.4c.2 6.4-2.8 10.6-6.2 11.6-3.4-1-6.4-5.2-6.2-11.6z"/><path d="M4.2 9.6c0-3.8 3.4-6.2 7.8-6.2s7.8 2.4 7.8 6.2z" opacity=".6"/><path d="M11 3.6V1.8h2v1.8z"/></svg>',
  art(){
    /* 풀밭 칸 판 + 흙길 칸 + 솔방울 나무 + 개미 + 도토리 창고 */
    const path = [[2,0],[2,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[7,3],[7,4],[6,4],[5,4],[4,4],[4,5],[4,6]];
    let g = '';
    for(let r = 0; r < 7; r++) for(let c = 0; c < 10; c++) g += `<rect x="${c * 16}" y="${r * 16 - 6}" width="16" height="16" fill="${(r + c) % 2 ? '#86C95A' : '#7BBE50'}"/>`;
    const pts = '40,-10 ' + path.map(([c, r]) => `${c * 16 + 8},${r * 16 + 2}`).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="#A97A45" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#D9AE73" stroke-width="10.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    path.forEach(([c, r], k) => { if(k % 2) g += `<ellipse cx="${c * 16 + 8}" cy="${r * 16 + 2}" rx="3" ry="2" fill="#E8CFA0"/>`; });
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}
      <ellipse cx="40" cy="-2" rx="11" ry="7" fill="#8A5A34"/><ellipse cx="40" cy="-1" rx="7" ry="4" fill="#2B1A0E"/>
      <g transform="translate(72 84)"><ellipse cx="0" cy="14" rx="30" ry="4" fill="rgba(20,50,10,.3)"/><rect x="-26" y="-6" width="52" height="20" rx="7" fill="#A56B3B" stroke="#5A3514" stroke-width="1.6"/><ellipse cx="0" cy="-6" rx="25" ry="5" fill="#E8C48E" stroke="#5A3514" stroke-width="1.6"/><ellipse cx="0" cy="-5.6" rx="11" ry="2.8" fill="#3B230F"/>
        <g transform="translate(-6 -11)"><path d="M-3.5 0c-.3 4 1.4 6.4 3.5 7 2.1-.6 3.8-3 3.5-7z" fill="#E5A24B" stroke="#7A4A1C" stroke-width=".8"/><path d="M-4.4 .4c0-2.4 2-3.6 4.4-3.6s4.4 1.2 4.4 3.6z" fill="#8A5A2B"/></g>
        <g transform="translate(5 -12)"><path d="M-3.5 0c-.3 4 1.4 6.4 3.5 7 2.1-.6 3.8-3 3.5-7z" fill="#E5A24B" stroke="#7A4A1C" stroke-width=".8"/><path d="M-4.4 .4c0-2.4 2-3.6 4.4-3.6s4.4 1.2 4.4 3.6z" fill="#8A5A2B"/></g></g>
      <g transform="translate(88 50)"><ellipse cx="0" cy="12" rx="12" ry="3" fill="rgba(20,60,10,.28)"/><rect x="-2.2" y="3" width="4.4" height="9" rx="1.6" fill="#9A6A3F"/><ellipse cx="0" cy="3" rx="12.5" ry="6.5" fill="#3E9A45"/><ellipse cx="0" cy="-3" rx="10" ry="6" fill="#48A94E"/><ellipse cx="0" cy="-9" rx="6.8" ry="5" fill="#5CBF60"/><ellipse cx="-2.5" cy="-11" rx="2.6" ry="1.3" fill="rgba(255,255,255,.5)"/>
        <circle cx="-2.6" cy="-3" r="1.1" fill="#1F2A1A"/><circle cx="2.6" cy="-3" r="1.1" fill="#1F2A1A"/><ellipse cx="-7" cy="5" rx="2" ry="2.6" fill="#A0673A"/><ellipse cx="6.5" cy="4" rx="2" ry="2.6" fill="#A0673A"/>
        <circle cx="0" cy="-15.5" r="2.8" fill="#FFD54A" stroke="#B07A00" stroke-width=".8"/></g>
      <g transform="translate(24 44)"><ellipse cx="0" cy="11" rx="13" ry="3" fill="rgba(20,60,10,.28)"/><path d="M0 12c0-5 3-7 1-13" fill="none" stroke="#3E8E41" stroke-width="2.2" stroke-linecap="round"/><circle cx="1" cy="-4" r="10" fill="#FFE36B" opacity=".35"/><ellipse cx="1" cy="-4" rx="6" ry="7" fill="#FFD84D" stroke="#E0A800" stroke-width=".8"/><ellipse cx="1" cy="-11" rx="5" ry="2" fill="#4CAF50"/></g>
      <g transform="translate(110 68)"><path d="M-12 1l-2 5M-6 2l-1 5M0 2l1 5" stroke="#5A1E14" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="-9" cy="-1" rx="6.5" ry="5" fill="#C4452F"/><circle cx="-2" cy="-2" r="3.2" fill="#B23A27"/><circle cx="4" cy="-4.5" r="4.6" fill="#CF4F36"/><circle cx="5.6" cy="-5.2" r="1.7" fill="#fff"/><circle cx="6.1" cy="-5" r=".9" fill="#2A1010"/><path d="M3.5 -8.5q-1-4 2-5M6 -8q1.5-3.5 4-3.4" fill="none" stroke="#5A1E14" stroke-width="1" stroke-linecap="round"/></g>
      <path d="M94 44L104 58" stroke="#A0673A" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/></svg>`;
  },
  help:[['씨앗 카드를 심어요','아래 카드를 누르고 풀밭 칸을 누르면 바로 자라요. 흙길·바위·개울 칸에는 못 심어요. 심은 식물을 누르면 닿는 거리가 보여요.'],['같은 씨앗은 겹쳐 키우기','같은 종류를 그 식물 위에 또 심으면 3단계까지 커져요. 퇴비 카드는 식물 하나를 거름으로 돌리고 새 씨앗 카드를 줘요.'],['도토리 창고를 지켜요','[시작 ▶]을 누르면 무리가 와요. 창고에 닿으면 도토리를 훔쳐 가요. 소나기·덩굴 올가미·돌개바람은 판마다 정해진 횟수만 쓸 수 있어요.']],
  chapters:['도토리 숲','개울 건너','버섯 골짜기','두더지 굴','곰의 동굴'],
  starRule:'★ 클리어 · ★★ 도토리 7개 이상 · ★★★ 도토리를 하나도 안 잃음',
  levels:{ easy:{ limit:0, n:3, w:5 }, normal:{ limit:0, n:5, w:6 }, hard:{ limit:0, n:8, w:7 } },
  levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return '공격 ' + Math.min(15, 5 + Math.ceil(c.n * 0.6)) + '번'; },
  saveKey:'hp:towerStages',
  stage:n => ({ n, w:fsWaveCount(n), limit:0 }),
  stageDesc:n => FS_MAPS[(n - 1) % FS_MAPS.length].name + ' · 무리 ' + fsWaveCount(n) + '번' + (n % 10 === 0 ? ' · 멧돼지·먹보 곰' : n % 5 === 0 ? ' · 멧돼지' : ''),
  init(cfg, rng){ tdInit(cfg.n, rng); },
  render:st => tdStage(st),
  titleExtra:() => ' · ' + G.mapName,
  progress:() => G.waves ? (G.cleared || 0) / G.waves.length : 0,
  lossText:() => `무리 ${G.cleared || 0}/${G.waves.length}번째까지 막았어요.`,
  score(){ return { base:500, time:Math.round(350 * G.lives / 10), extra:Math.min(150, G.hand.length * 25),
    rows:['숲 지키기 성공', '남은 도토리 보너스 (' + G.lives + '/10개)', '남은 씨앗 카드 ' + G.hand.length + '장'] }; },
  stars:() => tdStars(G.lives),
  winSfx:true, amb:'forest',
  duelPace:[280,.62],
  duelStat:{ unit:'무리', lfMax:10, lfIcon:() => FS_ICO.acorn.replace('<svg ', '<svg class="ico" '), get:() => ({ v:G.cleared || 0, t:G.waves.length, lf:G.lives }) }
};
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.tower.scene = { kind:'forest', colors:['#8BD16E','#E9B44C','#F28C38','#6FB85A'], density:.9 };
