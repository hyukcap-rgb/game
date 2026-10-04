/* 틀린그림 찾기 */
/* ===== 틀린그림 찾기 (spot) · 하루퍼즐 리그 게임 모듈 =====
   rng로 귀여운 장면(마을·공원·부엌·바닷가·우주)을 만들고, 똑같이 복제한 아래 그림에 N곳의 차이를 만든다.
   차이 = 색 바꾸기 · 없애기 · 크기 · 자리 · 방향 · 작은 부분(창문·무늬·리본…). 차이끼리 겹치지 않고, 너무 작은 차이는 만들지 않는다.
   그림 조각·테마는 spot-art.js(SPOT_ART). 모두 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45). */
NG.spot = (() => {
  const A = SPOT_ART, P = A.P, TH = A.TH, W = A.W, H = A.H, OL = A.OL;
  const THEMES = ['town', 'park', 'kitchen', 'beach', 'space'];
  const TOL = 7;            /* 누른 곳이 차이 동그라미에서 이만큼(그림 단위)까지 벗어나도 찾은 것으로 */
  const MISS_PTS = 15, HINT_PTS = 40;

  /* ===== 판 만들기(rng만) ===== */
  const boxOf = (o, s) => { const p = P[o.t], k = s == null ? o.s : s, hw = p.w * k / 2, hh = p.h * k / 2; return [o.x - hw, o.y - hh, o.x + hw, o.y + hh]; };
  const over = (a, b, g) => a[0] < b[2] + g && b[0] < a[2] + g && a[1] < b[3] + g && b[1] < a[3] + g;
  const inPic = (b, m = 3) => b[0] >= m && b[1] >= m && b[2] <= W - m && b[3] <= H - m;
  const clone = o => ({ t:o.t, x:o.x, y:o.y, s:o.s, f:o.f, c:o.c.slice(), d:Object.assign({}, o.d), hide:o.hide });
  function newObj(t, rng){
    const p = P[t], d = {};
    (p.det || []).forEach(k => { d[k] = rng() < .5; });
    return { t, x:0, y:0, s:1, f:p.flip ? rng() < .5 : false, c:(p.pal || []).map(pl => pl[Math.floor(rng() * pl.length)]), d, hide:false };
  }
  /* 장면: 큰 조각부터 구역 안에 서로 겹치지 않게 놓는다(겹치지 않아야 없어진 조각·바뀐 색이 가려지지 않는다) */
  function placeScene(theme, want, rng, tiles){
    const T = TH[theme], bg = T.bg(rng), pool = [];
    T.items.forEach(([t, z, n]) => { for(let i = 0; i < n; i++) pool.push([t, z]); });
    shuffle(pool, rng);
    pool.sort((a, b) => P[b[0]].w * P[b[0]].h - P[a[0]].w * P[a[0]].h);
    const objs = [], boxes = bg.block.slice();
    for(const [t, z] of pool){
      if(objs.length >= want) break;
      const p = P[t], [kind, y0, y1] = T.zones[z];
      for(let k = 0; k < 30; k++){
        const s = .9 + rng() * .3, hw = p.w * s / 2, hh = p.h * s / 2;
        const x = hw + 4 + rng() * (W - 8 - 2 * hw);
        let y;
        if(kind === 'box'){ if(y1 - y0 < 2 * hh) break; y = y0 + hh + rng() * (y1 - y0 - 2 * hh); }
        else y = y0 + rng() * (y1 - y0) - hh;
        const b = [x - hw, y - hh, x + hw, y + hh];
        if(!inPic(b) || boxes.some(q => over(b, q, 5))) continue;
        if(tiles && ((b[0] < W / 2 + 3 && b[2] > W / 2 - 3) || (b[1] < H / 2 + 3 && b[3] > H / 2 - 3))) continue;   /* 조각 그림: 조각 경계에 걸치지 않게 */
        const o = newObj(t, rng); o.x = x; o.y = y; o.s = s; objs.push(o); boxes.push(b); break;
      }
    }
    objs.sort((a, b) => boxOf(a)[3] - boxOf(b)[3]);   /* 아래쪽(가까운) 조각을 나중에 그림 */
    return { bg:bg.svg, block:bg.block, objs };
  }
  /* 차이 종류와 뽑힐 무게 */
  const KW = { col:3, hide:2, size:1.4, move:1.2, flip:1.1, det:2.8 };
  function kindsOf(o, opt){
    const p = P[o.t], L = [];
    if(p.pal && p.pal.some(pl => pl.length > 1)) L.push(['col', KW.col]);
    if(!opt.subtle){ L.push(['hide', KW.hide], ['move', KW.move]); if(Math.min(p.w, p.h) * o.s >= 24) L.push(['size', KW.size]); }
    if(p.flip && !opt.mirror) L.push(['flip', KW.flip]);   /* 거울 그림에서는 방향 바꾸기를 쓰지 않음(헷갈림) */
    (p.det || []).forEach(k => L.push(['det:' + k, KW.det / Math.sqrt(p.det.length)]));
    return L;
  }
  function mutate(o, kind, rng){
    const m = clone(o), p = P[o.t];
    if(kind === 'col'){
      const slots = p.pal.map((pl, i) => pl.length > 1 ? i : -1).filter(i => i >= 0), i = slots[Math.floor(rng() * slots.length)];
      const opts = p.pal[i].filter(c => c !== o.c[i]); m.c[i] = opts[Math.floor(rng() * opts.length)];
    } else if(kind === 'hide') m.hide = true;
    else if(kind === 'size'){ m.s = o.s * (rng() < .5 ? 1.38 : .66); m.y = o.y + p.h * (o.s - m.s) / 2; }   /* 바닥은 그대로 */
    else if(kind === 'move') m.x = o.x + (p.w * o.s * .55 + 14) * (rng() < .5 ? -1 : 1);
    else if(kind === 'flip') m.f = !o.f;
    else { const k = kind.slice(4); m.d[k] = !o.d[k]; }
    return m;
  }
  const kindBase = k => k.startsWith('det') ? 'det' : k;
  function pickDiffs(sc, N, rng, opt){
    const objs = sc.objs, B = objs.map(clone), boxes = objs.map(o => boxOf(o)), diffs = [], cnt = {};
    const cap = Math.max(2, Math.ceil(N * .4));
    const order = shuffle(objs.map((_, i) => i), rng);
    for(const i of order){
      if(diffs.length >= N) break;
      const o = objs[i], p = P[o.t];
      if(Math.min(p.w, p.h) * o.s < 19) continue;   /* 너무 작은 조각은 차이로 쓰지 않음 */
      const ks = kindsOf(o, opt).map(([k, w]) => [k, Math.pow(rng(), 1 / w)]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
      for(const k of ks){
        if((cnt[kindBase(k)] || 0) >= cap) continue;
        const m = mutate(o, k, rng), b0 = boxes[i];
        let reg = b0;
        if(k === 'size' || k === 'move'){
          const b1 = boxOf(m);
          if(!inPic(b1)) continue;
          if(boxes.some((q, j) => j !== i && over(b1, q, 3)) || sc.block.some(q => over(b1, q, 3))) continue;
          reg = [Math.min(b0[0], b1[0]), Math.min(b0[1], b1[1]), Math.max(b0[2], b1[2]), Math.max(b0[3], b1[3])];
        }
        if(opt.tiles){   /* 조각 그림: 차이가 네 조각 중 한 조각 안에 들어가야 함 */
          const qx = reg[0] >= W / 2 ? W / 2 : 0, qy = reg[1] >= H / 2 ? H / 2 : 0;
          if(reg[0] < qx + 2 || reg[2] > qx + W / 2 - 2 || reg[1] < qy + 2 || reg[3] > qy + H / 2 - 2) continue;
        }
        const rw = reg[2] - reg[0], rh = reg[3] - reg[1];
        const d = { i, kind:k, cx:(reg[0] + reg[2]) / 2, cy:(reg[1] + reg[3]) / 2, r:Math.max(16, Math.hypot(rw, rh) * .4 + 3), found:false };
        if(diffs.some(e => Math.hypot(e.cx - d.cx, e.cy - d.cy) < e.r + d.r + 2)) continue;
        B[i] = m; if(k === 'size' || k === 'move') boxes[i] = reg;
        diffs.push(d); cnt[kindBase(k)] = (cnt[kindBase(k)] || 0) + 1; break;
      }
    }
    return diffs.length >= N ? { B, diffs } : null;
  }
  /* 판 하나: 장면을 만들고 차이 N곳을 고른다. 못 고르면 장면을 새로 만든다(점검: 수천 씨앗에서 실패 0) */
  function gen(cfg, rng){
    const N = cfg.diffs, theme = cfg.theme || THEMES[Math.floor(rng() * THEMES.length)];
    const opt = { mirror:!!cfg.mirror, tiles:!!cfg.tiles, subtle:!!cfg.subtle };
    let last = null;
    for(let t = 0; t < 40; t++){
      const sc = placeScene(theme, N + 8, rng, opt.tiles);
      if(sc.objs.length < N + 3){ last = last || sc; continue; }
      const r = pickDiffs(sc, N, rng, opt);
      if(r) return { theme, bg:sc.bg, A:sc.objs, B:r.B, diffs:r.diffs, ok:true, tries:t + 1 };
      last = sc;
    }
    /* 끝내 못 만들면(점검에선 0건) 고를 수 있는 만큼만 */
    for(let n = N - 1; n >= 1; n--){ const r = pickDiffs(last, n, rng, opt); if(r) return { theme, bg:last.bg, A:last.objs, B:r.B, diffs:r.diffs, ok:false, tries:40 }; }
    return { theme, bg:last.bg, A:last.objs, B:last.objs.map(clone), diffs:[], ok:false, tries:40 };
  }
  function objSvg(o){
    if(o.hide) return '';
    const p = P[o.t];
    return `<g transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) scale(${(o.f ? -o.s : o.s).toFixed(3)} ${o.s.toFixed(3)}) translate(${-p.w / 2} ${-p.h / 2})">${p.draw(o)}</g>`;
  }
  const sceneSvg = (bg, objs) => bg + objs.map(objSvg).join('');

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['mirror', 'blink', 'tiles', 'secret'],
    info:{
      mirror:{ name:'거울 그림', desc:'아래 그림이 거울에 비친 것처럼 좌우가 뒤집혀 있어요. 왼쪽과 오른쪽을 바꿔 생각하며 찾아요.' },
      blink:{ name:'깜빡 커튼', desc:'두 그림이 번갈아 잠깐씩 커튼에 가려져요. 가려진 그림은 누를 수 없으니 보이는 동안 재빨리!' },
      tiles:{ name:'조각 그림', desc:'아래 그림이 네 조각으로 잘려 자리가 뒤섞여 있어요. 조각 하나하나를 위 그림과 맞춰 보세요.' },
      secret:{ name:'몇 곳일까?', desc:'차이가 몇 곳인지 알려 주지 않아요. 다 찾으면 저절로 끝나요. 끝까지 꼼꼼히!' }
    },
    twists:['flash', 'bare', 'tight', 'subtle', 'more'],
    twInfo:{
      flash:{ name:'번개', desc:'제한 시간이 아주 짧아요. 큰 차이부터 빠르게 훑어보세요!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 눈으로 찾아요.' },
      tight:{ name:'외줄 타기', desc:'빗나간 누르기는 딱 한 번까지! 두 번 빗나가면 끝나요.' },
      subtle:{ name:'살금살금', desc:'없어지거나 커지는 차이 없이 색·방향·작은 무늬만 바뀌어요. 자세히 보세요.' },
      more:{ name:'차이 잔치', desc:'차이가 평소보다 두 곳 더 많아요. 시간도 그만큼 더 줘요.' }
    }
  };
  const RULE_TIP = { mirror:'아래는 거울 그림', blink:'가려지면 못 눌러요', tiles:'아래는 조각이 뒤섞였어요', secret:'몇 곳인지 비밀', flash:'시간이 짧아요', bare:'힌트 없음', tight:'두 번 빗나가면 끝', subtle:'색·무늬만 바뀌어요', more:'차이 +2곳' };

  /* ----- 솔로 난이도 표 -----
     차이 수 = 챕터 1은 LT.ch1[k−1], 챕터 2~는 LT.base[c] + LT.kOff[k] (+2 차이 잔치), 3~12곳.
     제한 시간 = 차이 × LT.spp[c] × kTime[k] × 규칙·변주 배수 (사람 기준 한 곳 약 8~12초 + 여유) */
  const LT = {
    ch1:[4, 5, 5, 5, 6, 4, 5, 6, 4, 7],
    base:[0, 0, 6, 6, 7, 7, 8],
    kOff:[0, -1, 0, 0, 1, 2, -1, 0, 1, -1, 2],
    spp:[0, 22, 20, 19, 18, 17, 16],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, 0.9, 1.1, 1.0, 1.0, 1.1, 0.9],
    mjTime:{ mirror:1.15, blink:1.25, tiles:1.25, secret:1.1 },
    twTime:{ flash:0.65, bare:1.1, tight:1.05, subtle:1.25 }
  };
  function stageCfg(n){
    const p = planOf('spot', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let diffs = c === 1 ? LT.ch1[k - 1] : LT.base[Math.min(c, LT.base.length - 1)] + LT.kOff[k];
    if(tw === 'more') diffs += 2;
    diffs = Math.max(3, Math.min(has('tiles') ? 8 : 12, diffs));   /* 조각 그림은 차이가 한 조각 안에 들어가야 해서 최대 8곳 */
    let limit = diffs * LT.spp[Math.min(c, LT.spp.length - 1)] * LT.kTime[k];
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(40, Math.round(limit / 5) * 5);
    return { diffs, limit, hints:tw === 'bare' ? 0 : p.boss ? 2 : 3, lives:tw === 'tight' ? 2 : 0, theme:THEMES[(n - 1 + c) % THEMES.length],
      mirror:has('mirror'), blink:has('blink'), tiles:has('tiles'), secret:has('secret'), subtle:tw === 'subtle',
      boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 화면·조작 ===== */
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const QX = [0, W / 2, 0, W / 2], QY = [0, 0, H / 2, H / 2];
  const quadOf = (x, y) => (x >= W / 2 ? 1 : 0) + (y >= H / 2 ? 2 : 0);
  /* 아래 그림: 화면 좌표 ↔ 원래 그림 좌표 (거울·조각 뒤섞기) — perm[화면 조각] = 원래 조각 */
  function toSrcB(x, y){
    const m = S(); if(m.mirror) x = W - x;
    if(m.perm){ const qd = quadOf(x, y), qs = m.perm[qd]; x += QX[qs] - QX[qd]; y += QY[qs] - QY[qd]; }
    return [x, y];
  }
  function toDispB(x, y){
    const m = S();
    if(m.perm){ const qs = quadOf(x, y), qd = m.perm.indexOf(qs); x += QX[qd] - QX[qs]; y += QY[qd] - QY[qs]; }
    if(m.mirror) x = W - x;
    return [x, y];
  }
  const picSvg = w => document.querySelector(`.ng-spot #sp${w} svg`);
  function scr(w, x, y){   /* 그림 좌표 → 화면(px) */
    const sv = picSvg(w); if(!sv) return { x:0, y:0 };
    const r = sv.getBoundingClientRect(); if(w === 'B'){ [x, y] = toDispB(x, y); }
    return { x:r.left + x / W * r.width, y:r.top + y / H * r.height, k:r.width / W };
  }

  const ICO = {
    eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.6" fill="#E6FBF7" stroke="#1A0F45" stroke-width="2"/><path d="M15 15l5.6 5.6" stroke="#1A0F45" stroke-width="3.4" stroke-linecap="round"/><path d="M7 8.4a3.4 3.4 0 0 1 3-2.4" stroke="#14B8A6" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>'
  };
  const COVER = '<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M8 20c8-9 36-9 44 0" fill="none" stroke="#1A0F45" stroke-width="3.6" stroke-linecap="round"/><path d="M14 24l-3 5M23 27l-1 6M37 27l1 6M46 24l3 5" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/></svg>';
  const ring = (cx, cy, r, cls, col) => `<g class="sp-ring ${cls || ''}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${OL}" stroke-width="6.4"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${col || '#FF3D7F'}" stroke-width="3.4"${cls === 'reveal' ? ' stroke-dasharray="7 5"' : ''}/></g>`;

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#spFound'); if(f) f.textContent = m.found;
    const h = $('#spHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const lv = $('#spLives');
    if(lv && !m.lives) lv.hidden = true;
    else if(lv){ const left = Math.max(0, m.lives - m.misses); lv.innerHTML = '기회 ' + Array.from({ length:m.lives }, (_, n) => `<i${n >= left ? ' class="off"' : ''}>★</i>`).join(''); lv.classList.toggle('last', left === 1); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); }
  }
  function msg(html, cls){ const e = $('#spMsg'); if(!e) return; e.className = 'sp-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>두 그림에서 다른 곳을 눌러요</span>';
  }

  function layout(){
    const pics = $('#spPics'), root = document.querySelector('.ng-spot'); if(!pics || !root) return;
    const Wr = Math.min(root.clientWidth || 360, 520);
    const top = pics.getBoundingClientRect().top + (window.scrollY || 0);
    const avail = Math.max(300, (innerHeight || 740) - top - 12), gap = 10, bd = 6;
    let w = Wr, h = (w - bd) * H / W + bd;
    if(2 * h + gap > avail){ h = (avail - gap) / 2; w = (h - bd) * W / H + bd; }
    w = Math.floor(Math.max(230, w)); h = Math.floor((w - bd) * H / W + bd);
    pics.style.setProperty('--pw', w + 'px'); pics.style.setProperty('--ph', h + 'px');
  }

  function addRing(d, cls, col){
    const a = $('#' + S().u + 'MA'), b = $('#' + S().u + 'MB');
    if(a) a.insertAdjacentHTML('beforeend', ring(d.cx, d.cy, d.r, cls, col));
    if(b) b.insertAdjacentHTML('beforeend', ring(d.cx, d.cy, d.r, cls === 'pop' ? '' : cls, col));   /* 아래 그림은 <use> 복사본이라 정지 그림 */
  }
  function fxLayer(w){ return $('#' + S().u + 'F' + w); }

  function tapAt(w, e){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play') return;
    if(e && e.preventDefault) e.preventDefault();
    if(m.cover === w){ msg('<b class="bad">가려졌어요</b><span>다른 그림을 봐요</span>', 'sp-pop'); return; }
    if(performance.now() < m.coolUntil) return;
    const sv = picSvg(w); if(!sv) return;
    const r = sv.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width * W, dy = (e.clientY - r.top) / r.height * H;
    const [x, y] = w === 'B' ? toSrcB(dx, dy) : [dx, dy];
    let best = null, bd = 1e9, onFound = false;
    for(const d of m.diffs){
      const dist = Math.hypot(x - d.cx, y - d.cy);
      if(dist > d.r + TOL) continue;
      if(d.found){ onFound = true; continue; }
      if(dist / d.r < bd){ bd = dist / d.r; best = d; }
    }
    if(best){ found(best, w); return; }
    if(onFound) return;   /* 이미 찾은 곳을 다시 누르면 아무 일 없음 */
    miss(w, dx, dy);
  }

  function found(d, w){
    const m = S();
    d.found = true; m.found++; m.streak = 0; clearHint();
    addRing(d, 'pop');
    sfx('spotFind', { n:m.found }); fxBuzz(14);
    try{
      ['A', 'B'].forEach((pw, n) => {
        const q = scr(pw, d.cx, d.cy);
        fxRing(q.x, q.y, '#FF3D7F', d.r * q.k * 1.5, .5, 6);
        fxBurst(q.x, q.y, ['#FF3D7F', '#FFE27A', '#FFFFFF', '#5EEAD4'], pw === w ? 12 : 7, { speed:200, size:4.5, kinds:['star', 'dot', 'spark'], up:90, g:420, glow:n === 0, dur:.6 });
      });
      const f = $('#spFoundP'); if(f) fxPunch(f, 1.12);
    }catch(_){}
    hud();
    if(m.found >= m.N){ win(); return; }
    msg(m.secret ? '<b>찾았어요!</b><span>또 있을까요?</span>' : `<b>찾았어요!</b><span>${m.N - m.found}곳 남았어요</span>`, 'sp-pop');
    T(() => { if(m.phase === 'play') msg(playMsg()); }, 1300);
  }

  function miss(w, dx, dy){
    const m = S();
    m.misses++; m.streak++;
    const cd = Math.min(2400, 700 + 400 * (m.streak - 1));   /* 연달아 빗나갈수록 쉬는 시간이 길어진다(마구 누르기 막기) */
    m.coolUntil = performance.now() + cd; m.coolLen = cd;
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;
    sfx('spotMiss'); fxBuzz(30);
    try{
      const L = fxLayer(w);
      if(L){
        L.insertAdjacentHTML('beforeend', `<g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})"><g class="sp-x"><path d="M-8-8L8 8M8-8L-8 8" stroke="${OL}" stroke-width="7" stroke-linecap="round"/><path d="M-8-8L8 8M8-8L-8 8" stroke="#FF4D6D" stroke-width="3.6" stroke-linecap="round"/></g></g>`);
        const x = L.lastElementChild; T(() => { if(x) x.remove(); }, Math.max(650, cd));
      }
      const pics = $('#spPics'); if(pics){ pics.classList.add('cool'); fxShake($('#sp' + w), 4); }
      coolShow();
    }catch(_){}
    T(() => { const pics = $('#spPics'); if(pics && performance.now() >= m.coolUntil - 20) pics.classList.remove('cool'); }, cd);
    msg('<b class="bad">빗나갔어요</b><span>' + (left < 0 ? '−' + MISS_PTS + '점 · 잠깐 쉬어요' : left ? '기회 ' + left + '번 남음' : '기회를 다 썼어요') + '</span>', 'sp-pop');
    T(() => { if(m.phase === 'play') msg(playMsg()); }, Math.max(1100, cd));
    hud();
    if(left >= 0){
      const hs = document.querySelectorAll('.ng-spot .hlives i'), lost = hs[left];
      try{ if(lost){ lost.classList.add('lost'); const q = fxCenter(lost); fxBurst(q.x, q.y, ['#FFB020', '#FFE27A', '#fff'], 10, { speed:200, size:4, kinds:['dot', 'spark'], up:60, g:500, dur:.6 }); } }catch(_){}
      G.paws = left; if(!left) lose('기회를 다 썼어요', 'miss');
    }
  }

  /* 쉬는 시간 남은 초 보여 주기(두 그림 사이 '잠깐! 0.8초' + 줄어드는 막대). 보이기만 함 */
  function coolShow(){
    try{
      const m = S(), c = $('#spCool'); if(!c || !m) return;
      const left = Math.max(0, m.coolUntil - performance.now()); if(!left) return;
      const t = (Math.ceil(left / 100) / 10).toFixed(1);
      const b = c.querySelector('b'); if(b && b.dataset.t !== t){ b.dataset.t = t; b.textContent = '잠깐! ' + t + '초'; }
      const bar = $('#spCoolBar'); if(bar) bar.style.transform = `scaleX(${Math.min(1, left / (m.coolLen || 700))})`;
    }catch(_){}
  }
  function clearHint(){ ['A', 'B'].forEach(w => { const L = fxLayer(w); if(L) L.querySelectorAll('.sp-hintc').forEach(e => e.remove()); }); }
  function useHint(){
    const m = S(); if(!m || G.over || G.paused || m.phase !== 'play' || m.hintLeft <= 0) return;
    const left = m.diffs.filter(d => !d.found); if(!left.length) return;
    const d = left[Math.floor(m.rng() * left.length)];
    m.hintLeft--; m.hints++; hud(); clearHint();
    /* 정확한 자리 대신 그 근처를 큰 점선 동그라미로 */
    const a = m.rng() * Math.PI * 2, off = d.r * .45 * m.rng(), R = d.r * 1.9 + 10;
    const cx = d.cx + Math.cos(a) * off, cy = d.cy + Math.sin(a) * off;
    ['A', 'B'].forEach(w => {
      const L = fxLayer(w); if(!L) return;
      const [x, y] = w === 'B' ? toDispB(cx, cy) : [cx, cy];
      L.insertAdjacentHTML('beforeend', `<g class="sp-hintc"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R.toFixed(1)}" fill="rgba(255,226,122,.18)" stroke="${OL}" stroke-width="5" stroke-dasharray="9 7"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#FFE27A" stroke-width="2.6" stroke-dasharray="9 7"/></g>`);
    });
    T(clearHint, 2800);
    sfx('spotHint');
    msg('<b>여기 어딘가!</b><span>−' + HINT_PTS + '점</span>', 'sp-pop');
    T(() => { if(m.phase === 'play') msg(playMsg()); }, 1600);
  }

  /* 시계·깜빡 커튼 */
  const remTime = t => Math.max(0, G.limit - t);
  function coverOf(t){   /* 5초마다: 3.2초 보이고 1.8초 한쪽이 가려짐(위·아래 번갈아) */
    const P5 = 5, ph = t % P5; if(ph < 3.2) return null;
    return Math.floor(t / P5) % 2 ? 'A' : 'B';
  }
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#spBar');
    if(m.phase === 'deal'){ if(t >= .45){ m.phase = 'play'; G.start = Date.now(); G.pausedMs = 0; msg(playMsg()); sfx('spotGo'); } return; }
    if(m.phase !== 'play') return;
    if(m.blink){
      const c = coverOf(t);
      if(c !== m.cover){ m.cover = c; ['A', 'B'].forEach(w => { const e = $('#sp' + w); if(e) e.classList.toggle('covered', c === w); }); if(c) sfx('spotBlink'); }
    }
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#spTime'); if(e) e.textContent = mmss(sec);
      const p = $('#spTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#spBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('spotTick', { hi:sec <= 5 }); try{ if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }catch(_){} }
    }
    if(performance.now() < m.coolUntil) coolShow();
    if(rem <= 0){ const e = $('#spTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
  }
  function uncover(){ const m = S(); m.cover = null; ['A', 'B'].forEach(w => { const e = $('#sp' + w); if(e) e.classList.remove('covered'); }); }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed(); uncover(); clearHint();
    msg('<b>모두 찾았어요!</b>', 'sp-win');
    sfx('win', { g:'spot' }); fxBuzz([30, 50, 30]);
    try{ const p = $('#spPics'); if(p){ p.classList.add('cleared'); const q = fxCenter(p); fxBurst(q.x, q.y, ['#FFE27A', '#FF8FC8', '#5EEAD4', '#7CCBFF'], 26, { speed:340, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); } }catch(_){}
    T(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.fail = why; uncover(); clearHint();
    m.diffs.filter(d => !d.found).forEach(d => addRing(d, 'reveal', '#FFE27A'));   /* 못 찾은 곳을 보여 줌 */
    msg('<b class="bad">' + text + '</b><span>' + (m.secret ? '못 찾은 곳을 보여 줄게요' : '남은 차이 ' + (m.N - m.found) + '곳') + '</span>', 'sp-pop');
    sfx('spotTimeUp'); fxBuzz([40, 40, 60]); try{ fxShake($('#spPics'), 6); }catch(_){}
    T(() => finish(false), 1700);
  }

  function picA(m){
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="위 그림(원래 그림)"><defs><clipPath id="${m.u}cA"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#${m.u}cA)">${sceneSvg(m.bg, m.A)}</g><g id="${m.u}MA"></g><g id="${m.u}FA"></g></svg>`;
  }
  function picB(m){
    const u = m.u;
    const clips = [0, 1, 2, 3].map(q => `<clipPath id="${u}q${q}"><rect x="${QX[q]}" y="${QY[q]}" width="${W / 2}" height="${H / 2}"/></clipPath>`).join('');
    const inner = m.perm ? [0, 1, 2, 3].map(qd => { const qs = m.perm[qd]; return `<g transform="translate(${QX[qd] - QX[qs]} ${QY[qd] - QY[qs]})"><use href="#${u}B" clip-path="url(#${u}q${qs})"/></g>`; }).join('') : `<use href="#${u}B" clip-path="url(#${u}cB)"/>`;
    const seams = m.perm ? `<path d="M${W / 2} 0V${H}M0 ${H / 2}H${W}" stroke="#fff" stroke-width="4"/><path d="M${W / 2} 0V${H}M0 ${H / 2}H${W}" stroke="${OL}" stroke-width="1.4" stroke-dasharray="6 4"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="아래 그림(다른 곳을 찾아요)"><defs><clipPath id="${u}cB"><rect width="${W}" height="${H}"/></clipPath>${clips}<g id="${u}B">${sceneSvg(m.bg, m.B)}<g id="${u}MB"></g></g></defs>${m.mirror ? `<g transform="matrix(-1 0 0 1 ${W} 0)">${inner}</g>` : inner}${seams}<g id="${u}FB"></g></svg>`;
  }
  let UID = 0;

  return {
    name:'틀린그림 찾기', abil:'집중력', col:['#8EEBDF', '#14B8A6', '#0B6B61'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 2.5h17A1.5 1.5 0 0 1 22 4v6a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 10V4a1.5 1.5 0 0 1 1.5-1.5zm0 10h17A1.5 1.5 0 0 1 22 14v6a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 20v-6a1.5 1.5 0 0 1 1.5-1.5z" opacity=".5"/><circle cx="15" cy="17" r="3.6" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="15" cy="7" r="2.4"/></svg>',
    art(){
      const u = 'spotA' + Math.floor(performance.now() * 1000 % 1e6);
      const mini = (x, y, alt) => `<g transform="translate(${x} ${y})"><rect width="64" height="50" rx="7" fill="#BFE8FF" stroke="#1A0F45" stroke-width="2.4"/><path d="M1.5 32h61v10.5a6 6 0 0 1-6 6H7.5a6 6 0 0 1-6-6z" fill="#94DB72"/>
        <g transform="translate(14 13) scale(.48)">${P.house.draw({ c:['#FFE3B3', alt ? '#4B6CD9' : '#E8503A'], d:{ win:true, chim:!alt } })}</g>
        ${alt ? '' : `<g transform="translate(46 4) scale(.4)">${P.sun.draw({ c:['#FFC93C'], d:{ face:true } })}</g>`}
        <g transform="translate(46 30) scale(.42)">${P.flower.draw({ c:[alt ? '#B266FF' : '#FF5A5F'], d:{ leaf:true } })}</g>
        <rect width="64" height="50" rx="7" fill="none" stroke="#1A0F45" stroke-width="2.4"/></g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2FBF6"/><stop offset="1" stop-color="#8EE3D4"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g fill="#fff" opacity=".5"><circle cx="10" cy="12" r="3"/><circle cx="150" cy="90" r="4"/><circle cx="80" cy="8" r="2.4"/></g>
        ${mini(10, 26, false)}${mini(86, 26, true)}
        <circle cx="111" cy="43" r="12" fill="none" stroke="#1A0F45" stroke-width="5"/><circle cx="111" cy="43" r="12" fill="none" stroke="#FF3D7F" stroke-width="2.8"/>
        <circle cx="139" cy="38" r="9" fill="none" stroke="#1A0F45" stroke-width="5"/><circle cx="139" cy="38" r="9" fill="none" stroke="#FF3D7F" stroke-width="2.8"/>
        <path d="M76 44l4 4-4 4" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['두 그림을 비교해요', '위 그림과 아래 그림은 거의 똑같지만 몇 곳이 달라요. 색이 바뀌거나, 없어지거나, 크기·자리·방향이 바뀌거나, 작은 무늬가 달라요.'],
      ['다른 곳을 눌러요', '위·아래 어느 그림을 눌러도 돼요. 찾으면 두 그림 모두에 동그라미가 그려져요. 제한 시간 안에 모두 찾으면 성공!'],
      ['마구 누르면 손해', '빗나간 곳을 누르면 점수가 ' + MISS_PTS + '점 깎이고 잠깐 누를 수 없어요. 연달아 빗나갈수록 더 오래 쉬어요. 💡힌트는 차이 근처를 알려 주지만 ' + HINT_PTS + '점이 깎여요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 거울 그림·깜빡 커튼·조각 그림·몇 곳일까 같은 새 규칙과 번개·살금살금·차이 잔치 같은 변주가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'spot' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['눈 크게 뜨기', '반짝 관찰단', '숨바꼭질 골목', '매의 눈', '명탐정의 방'],
    starRule:'★ 클리어 · ★★ 힌트·빗나감 합쳐 2번 이하 · ★★★ 힌트·빗나감 없이',
    levels:{
      easy:{ diffs:5, limit:120, hints:3 },
      normal:{ diffs:7, limit:150, hints:3 },
      hard:{ diffs:9, limit:180, hints:3 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${TH[c.theme].name} · 차이 ${c.secret ? '?' : c.diffs}곳 · ${mmss(c.limit)}${c.lives ? ' · 기회 ' + c.lives + '번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `차이 ${c.diffs}곳 · ${mmss(c.limit)}`; },
    init(cfg, rng){
      for(let i = 0; i < (cfg.diffs || 0) * 7; i++) rng();   /* 같은 날 난이도마다 다른 장면이 나오게(차이 수로 rng를 조금 넘김) */
      const g = gen(cfg, rng);
      let perm = null;
      if(cfg.tiles){ do{ perm = shuffle([0, 1, 2, 3], rng); }while(perm.some((q, i) => q === i)); }   /* 조각 그림: 제자리에 남는 조각 없이 */
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { u:'spu' + (++UID) + '_', theme:g.theme, bg:g.bg, A:g.A, B:g.B, diffs:g.diffs, N:g.diffs.length, ok:g.ok,
        mirror:!!cfg.mirror, perm, blink:!!cfg.blink, secret:!!cfg.secret && !G.duel, cover:null,
        found:0, misses:0, hints:0, streak:0, coolUntil:0, hintLeft:cfg.hints == null ? 3 : cfg.hints,
        lives:G.duel ? 0 : cfg.lives || 0,   /* 기본은 기회 제한 없음(빗나가면 점수·쉬는 시간만). 외줄 타기만 기회 2번 */
        phase:'deal', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, rng, lastSec:-1, sec:0, fail:null, timers:new Set() };
      G.limit = cfg.limit; if(G.m.lives) G.paws = G.m.lives;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 차이를 차례로 모두 누른다 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.found); return; }
          if(m.phase !== 'play' || G.paused){ setTimeout(step, 60); return; }
          const d = m.diffs.find(x => !x.found); if(!d){ res(m.found); return; }
          const w = m.cover === 'A' ? 'B' : 'A', q = scr(w, d.cx, d.cy);
          tapAt(w, { clientX:q.x, clientY:q.y }); setTimeout(step, 120);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _gen:gen, _stage:stageCfg, _svg:sceneSvg, _themes:THEMES,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-spot">
        <div class="hud-row">
          <div class="hchip" id="spFoundP" aria-label="찾은 차이"><span class="hv">${ICO.eye}<b id="spFound">0</b><small>/${m.secret ? '?' : m.N}</small></span><em>찾은 곳</em></div>
          <div class="hchip time" id="spTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="spTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="spHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="sp-rules" aria-label="켜진 규칙">${m.boss ? '<span class="sp-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="sp-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="sp-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="hbar sp-tbar" id="spBarWrap"><i id="spBar"></i></div>
        <div class="sp-row"><div class="hlives" id="spLives" role="img"></div><div class="sp-msg" id="spMsg"><span>그림을 그리는 중…</span></div></div>
        <div class="sp-pics in" id="spPics">
          <div class="sp-pic" id="spA">${picA(m)}<div class="sp-cover" aria-hidden="true">${COVER}<b>잠깐!</b></div></div>
          <div class="sp-pic" id="spB">${picB(m)}<div class="sp-cover" aria-hidden="true">${COVER}<b>잠깐!</b></div></div>
          <div class="sp-cool" id="spCool" aria-hidden="true"><b>잠깐!</b><i><s id="spCoolBar"></s></i></div>
        </div>
      </div>`;
      ['A', 'B'].forEach(w => { const e = $('#sp' + w); if(e) e.onpointerdown = ev => tapAt(w, ev); });
      const h = $('#spHint'); if(h) h.onclick = useHint;
      hud(); layout();
      T(() => { const p = $('#spPics'); if(p) p.classList.remove('in'); }, 900);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.N ? m.found / m.N : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `차이 ${m.found}/${m.N}곳을 찾았어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit, m.sec || elapsed()));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - HINT_PTS * m.hints - MISS_PTS * m.misses);
      return { base:500, time, extra, rows:['차이 ' + m.N + '곳 모두 찾기', '시간 보너스 (' + mmss(sec) + ')', `힌트 ${m.hints} · 빗나감 ${m.misses}`] };
    },
    stars(){ const m = G.m, k = m.hints + m.misses; return k === 0 ? 3 : k <= 2 ? 2 : 1; },
    css:`
body[data-mode="spot"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.25) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#E2FBF6 0%,#B2EEE3 55%,#86DCCD 100%) fixed}
.ng-spot{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-spot .hud-row{margin:0}
.ng-spot .hchip.time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-spot .hchip.time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-spot .hchip.time.hurry em{color:#fff}
.ng-spot .hchip:is(button){-webkit-tap-highlight-color:transparent}
.ng-spot .sp-tbar{margin:8px 0 0; height:10px}
.ng-spot .sp-tbar > i{width:100%; transform-origin:left center; transition:none; background:linear-gradient(180deg,#8EF0E0,#14B8A6)}
.ng-spot .sp-tbar.hurry > i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-spot .sp-row{display:flex; align-items:center; gap:8px; width:100%; height:36px}
.ng-spot .hlives{flex:none}
.ng-spot .hlives[hidden]{display:none}
.ng-spot .hlives i{display:inline-block}
.ng-spot .hlives i.lost{animation:spot-lost .5s ease-out}
.ng-spot .hlives.last{background:#FFE3E3}
@keyframes spot-lost{0%{transform:scale(1.6); color:#FFE27A} 100%{transform:none}}
.ng-spot .sp-msg{flex:1; min-width:0; overflow:hidden; height:36px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#145A50; white-space:nowrap}
.ng-spot .sp-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-spot .sp-msg b.boss{color:#FFE27A}
.ng-spot .sp-msg b.bad{color:#FF8A8F}
.ng-spot .sp-msg.sp-pop, .ng-spot .sp-msg.sp-win{animation:spot-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-spot .sp-msg.sp-win b{font-size:24px; color:#FFE27A}
@keyframes spot-in{from{transform:scale(.6); opacity:0}}
.ng-spot .sp-pics{position:relative; display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; touch-action:manipulation}
.ng-spot .sp-cool{position:absolute; left:50%; top:50%; z-index:5; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; transition:opacity .15s, transform .2s cubic-bezier(.2,1.5,.4,1)}
.ng-spot .sp-cool b{display:block; font-family:var(--heavy); font-weight:400; font-size:17px; color:#fff; background:#E5484D; border:2.5px solid #1A0F45; border-radius:99px; padding:5px 13px; box-shadow:0 3px 0 #1A0F45; white-space:nowrap; font-variant-numeric:tabular-nums}
.ng-spot .sp-cool i{display:block; height:6px; margin:5px 10px 0; border-radius:99px; background:rgba(26,15,69,.35); overflow:hidden}
.ng-spot .sp-cool s{display:block; height:100%; background:#FFE27A; transform-origin:left center}
.ng-spot .sp-pics.cool .sp-cool{opacity:1; transform:translate(-50%,-50%) scale(1)}
.ng-spot .sp-pic{position:relative; width:var(--pw, 100%); height:var(--ph, auto); border:3px solid #1A0F45; border-radius:16px; overflow:hidden; background:#fff;
  box-shadow:0 4px 0 #1A0F45, 0 10px 18px rgba(10,80,70,.2); cursor:pointer; -webkit-tap-highlight-color:transparent; transition:filter .15s}
.ng-spot .sp-pic svg{display:block; width:100%; height:100%}
.ng-spot .sp-pics.in .sp-pic{animation:spot-deal .5s cubic-bezier(.2,1.4,.4,1) both}
.ng-spot .sp-pics.in .sp-pic + .sp-pic{animation-delay:.1s}
@keyframes spot-deal{from{transform:translateY(-14px) scale(.9); opacity:0}}
.ng-spot .sp-pics.cool .sp-pic{filter:grayscale(.55) brightness(.92); cursor:wait}
.ng-spot .sp-ring.pop circle{animation:spot-ring .4s cubic-bezier(.2,1.6,.4,1) both; transform-box:fill-box; transform-origin:center}
@keyframes spot-ring{from{transform:scale(1.7); opacity:0}}
.ng-spot .sp-x{animation:spot-in .25s ease-out; transform-box:fill-box; transform-origin:center}
.ng-spot .sp-hintc circle{animation:spot-hint .8s ease-in-out infinite alternate; transform-box:fill-box; transform-origin:center}
@keyframes spot-hint{from{transform:scale(.94)} to{transform:scale(1.04)}}
.ng-spot .sp-cover{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; pointer-events:none; opacity:0; transform:translateY(-100%);
  transition:transform .28s cubic-bezier(.5,0,.5,1.3), opacity .2s;
  background:repeating-linear-gradient(90deg,#C9B8FF 0 22px,#B39DFF 22px 44px); border-bottom:4px solid #1A0F45}
.ng-spot .sp-cover svg{width:70px; height:auto}
.ng-spot .sp-cover b{font-family:var(--heavy); font-weight:400; font-size:22px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill}
.ng-spot .sp-pic.covered .sp-cover{opacity:1; transform:none}
.ng-spot .sp-pics.cleared .sp-pic{animation:spot-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes spot-cheer{40%{transform:scale(1.03)}}
.ng-spot .sp-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-spot .sp-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#124A42; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-spot .sp-chip.mj{background:#DDF8F3; color:#0B6B61}
.ng-spot .sp-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-spot .sp-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
@media (max-width:370px){ .ng-spot .sp-msg b{font-size:18px} .ng-spot .sp-chip{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-spot .sp-pics.in .sp-pic, .ng-spot .sp-ring.pop circle, .ng-spot .sp-hintc circle{animation:none} .ng-spot .sp-cover{transition:none} }
`,
    sounds:{
      spotFind(o){ const n = Math.min(10, o.n || 0); aWhoosh({ f:900, f2:3200, a:.01, d:.12, v:.03 }); aBell({ f:penta(n + 4, 72), t:.02, d:.6, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.1, d:.7, v:.07, idx:1.2, rev:.4 }); aSparkle({ root:84 + Math.min(7, n), n:3, t:.14, v:.025 }); },
      spotMiss(){ aTone({ f:330, f2:200, type:'triangle', d:.22, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      spotHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      spotBlink(){ aWhoosh({ f:1800, f2:500, a:.02, d:.22, v:.035 }); },
      spotGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      spotTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      spotTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ spotTick:250, spotFind:60, spotMiss:80, spotBlink:300 },
    jingle(){ [0, 4, 2, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();


/* 대전: 같은 그림, 누가 먼저 다 찾나. AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.spot, { duelPace:[85, .8], duelStat:{ unit:'곳', get:() => ({ v:G.m.found, t:G.m.N }) }, duelHow:'같은 그림 · 누가 먼저 차이를 다 찾나' });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.spot.scene = { kind:'bubbles', colors:['#FFFFFF', '#C8F5EC', '#FFF3B0'], density:.8 };
