/* 숨은그림 찾기 */
/* ===== 숨은그림 찾기 (hidden) · 하루퍼즐 리그 게임 모듈 =====
   v2.0: 장면은 그림책 사진 장면 20곳(hidden-photo.js, 그림 games/hidden/img/). 찾을 물건은 그림 속에 원래 있는 물건으로,
   장면마다 12개 중 씨앗 난수로 몇 개를 고른다(예전 직접 그린 SVG 장면·물건은 2026-10-10에 모두 지움).
   아래 목록(그림에서 잘라 낸 아이콘 + 이름)의 물건을 장면에서 찾아 누르면 동그라미. 빗나간 누르기는 실수(잠깐 못 누름 + 감점).
   문제 내용은 rng로만 만든다. */
NG.hidden = (() => {
  const W = 360, H = 480;            /* 장면 좌표(세로 3:4) */
  const INK = '#1A0F45';
  const r1 = n => Math.round(n * 10) / 10;
  const R = (rng, a, b) => a + rng() * (b - a);
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  const st = (K, w) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const starPath = (cx, cy, Ro, Ri, n = 5) => { let d = ''; for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? Ri : Ro; d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * rr) + ' ' + r1(cy + Math.sin(a) * rr); } return d + 'z'; };

  /* ----- 그림책 사진 장면 20곳(hidden-photo.js) — 찾을 물건은 그림 속에 원래 있는 물건(장면마다 12개 중 몇 개) ----- */
  const PH = window.HIDDEN_PHOTO, SCN = PH.SC.map(s => s.key);
  const sceneOf = k => PH.SC.find(s => s.key === k) || PH.SC[0];
  /* 양이: 세계를 여행하는 아기 고양이(메인 캐릭터 = 사이트 공용 3D 회색 줄무늬 고양이 toyImg('cat')). 모든 모드의 장면에 한 마리가 숨어 있고, 목록 맨 앞 칸이 양이.
     양이는 물건과 따로 하나 더 찾는다(물건 cfg.items개 + 양이 1, 2026-10-12) */
  const YK = 'yangi', YANG = { id:YK, name:'양이', i:-1, scene:null };
  const objOf = k => k === YK ? YANG : PH.OBJ[k] || { name:'물건', i:0, scene:SCN[0] };
  const nmOf = k => objOf(k).name;
  /* 목록 아이콘 = 그 물건을 그림에서 잘라 낸 칸(아이콘 판 4×3). 그림자 목록이면 까맣게. 양이는 양이 그림판의 얼굴 칸(5번째 = 공용 고양이 얼굴) */
  const iconSvg = (k, shadow) => { if(k === YK) return `<i class="hd-ph yg${shadow ? ' sh' : ''}" style="background-image:url('${PH.yang()}')"></i>`; const o = objOf(k); return `<i class="hd-ph${shadow ? ' sh' : ''}" style="background-image:url('${PH.icons(o.scene)}');background-position:${r1((o.i % 4) * 100 / 3)}% ${Math.floor(o.i / 4) * 50}%"></i>`; };
  /* 양이 그림(장면 좌표, 발 가운데가 (x, y+h/2)). 그림판 칸 336×400 중 pose(0~3) 칸만 보이게 중첩 svg로 자른다 */
  const YW = 336, YH = 400;
  const yangSvg = (y, filt) => { const h = r1(y.r * 2.5), w = r1(h * YW / YH);
    return `<g class="hd-yang" transform="translate(${r1(y.bx)} ${r1(y.y)})"><g class="j"><svg x="${r1(-w / 2)}" y="${r1(-h * .56)}" width="${w}" height="${h}" viewBox="${y.pose * YW} 0 ${YW} ${YH}" preserveAspectRatio="xMidYMid meet" overflow="hidden"${filt ? ` filter="${filt}"` : ''}><g${y.flip ? ` transform="translate(${y.pose * YW * 2 + YW} 0) scale(-1 1)"` : ''}><image href="${PH.yang()}" width="${YW * 5}" height="${YH}"/></g></svg></g></g>`; };
  /* 양이 자리: 장면 물건 12개와 겹치지 않고, 가장자리·위쪽 알림 자리·오른쪽 아래 확대 단추 자리를 피함(rng만) */
  function placeYang(rng, sc, cfg){
    const r = r1(cfg.items <= 7 && !cfg.hard ? R(rng, 10, 11.5) : R(rng, 8.5, 10.5)), pose = Math.floor(rng() * 4), flip = rng() < .5;
    const free = (x, y) => x > 26 && x < W - 26 && y > 52 && y < H - 30 && !(x > W - 86 && y > H - 150) && sc.objs.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r * 1.25 + 8);
    let x = W / 2, y = H / 2;
    for(let t = 0; t < 400; t++){ const px = R(rng, 26, W - 26), py = R(rng, 52, H - 30); if(free(px, py)){ x = px; y = py; break; } }
    return { r, pose, flip, bx:x, y };
  }
  /* 장면 그림(장면 좌표 360×480). 거울 장면은 좌우를 뒤집고, 흑백 사진은 색을 뺀다 */
  const photoSvg = (key, u, mirror, gray, yang) => `${gray ? `<defs><filter id="${u}g"><feColorMatrix type="saturate" values="0"/></filter></defs>` : ''}<g${mirror ? ` transform="translate(${W} 0) scale(-1 1)"` : ''}><image class="hd-img" href="${PH.src(key)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"${gray ? ` filter="url(#${u}g)"` : ''}/>${yang ? yangSvg(yang, gray ? `url(#${u}g)` : '') : ''}</g>`;
  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const LIGHT_R = 66;   /* 손전등 반지름(장면 단위) */
  const CONC = {
    order:['shadow', 'many', 'swim', 'night'],
    info:{
      shadow:{ name:'그림자 목록', desc:'아래 목록에 물건 이름은 없고 까만 그림자만 보여요. 모양만 보고 찾아요!' },
      many:{ name:'거울 장면', desc:'그림이 좌우로 뒤집혀 있어요. 목록 그림과 방향이 반대라서 더 헷갈려요!' },
      swim:{ name:'흑백 사진', desc:'그림에 색이 없어요. 색 대신 모양을 잘 보고 찾아요.' },
      night:{ name:'밤 손전등', desc:'장면이 깜깜해요! 끌어서 손전등을 비추고, 불빛 안의 물건을 눌러요. 불빛 밖을 누르면 손전등만 옮겨 가요.' }
    },
    twists:['flash', 'tiny', 'bare', 'order', 'tight'],
    twInfo:{
      flash:{ name:'빠른 판', desc:'제한 시간이 아주 짧아요. 빠르게 훑어보세요!' },
      tiny:{ name:'더 많이', desc:'찾을 물건이 2개 더 많아요. 대신 시간은 넉넉해요. 확대해서 찾아요!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 눈으로 찾아요.' },
      order:{ name:'차례대로', desc:'목록 순서대로만 찾을 수 있어요. 반짝이는 물건부터!' },
      tight:{ name:'외줄 타기', desc:'빗나간 누르기는 두 번까지만! 두 번 빗나가면 끝나요.' }
    }
  };
  const RULE_TIP = { shadow:'그림자만 보고', many:'좌우가 뒤집힌 그림', swim:'색이 없는 그림', night:'끌어서 손전등', flash:'시간이 짧아요', tiny:'물건이 더 많아요', bare:'힌트 없음', order:'목록 순서대로', tight:'두 번 빗나가면 끝' };

  /* ----- 솔로 난이도 표 -----
     물건 수 = 챕터 1은 LT.ch1[k−1], 챕터 2~는 LT.base[c] + LT.kOff[k]. 크기는 챕터마다 작아지고, 꾸밈은 빽빽해진다.
     제한 시간 = (물건 + 여분 개수×0.5) × LT.spp[c] × kTime[k] × 규칙·변주 배수 */
  const LT = {
    ch1:[5, 6, 6, 7, 8, 5, 6, 7, 6, 9],
    base:[0, 0, 7, 8, 9, 9, 10],
    kOff:[0, -2, -1, 0, 0, 1, -1, 0, 1, -2, 2],
    size:[0, 1.06, 1.0, .94, .88, .84, .8],
    dens:[0, 75, 95, 110, 122, 132, 140],
    spp:[0, 15, 14, 13, 12.5, 12, 11.5],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, .9, 1.1, 1.0, 1.0, 1.1, .85],
    mjTime:{ shadow:1.15, many:1.0, swim:1.1, night:1.35 },
    twTime:{ flash:.65, tiny:1.2, bare:1.1, order:1.1, tight:1.05 },
    /* 새 장면(v1.1): 물건과 바탕의 밝기 차(클수록 잘 보임), 기울기 최대(도), 선이 많은 자리 선호(−면 빈 곳, +면 복잡한 곳), 외곽선을 바탕색 쪽으로 섞는 정도 */
    tone:[0, [.25, .33], [.22, .3], [.19, .27], [.17, .24], [.15, .22], [.15, .2]],
    rot:[0, 12, 15, 18, 22, 25, 25],   /* 기울기는 어려움·대장 판에만 */
    busy:[0, -.5, -.3, 0, .2, .4, .5],
    ink:[0, .1, .16, .22, .28, .32, .35]
  };
  /* 새 장면: 챕터마다 장면 2~3개를 돌아가며(같은 장면이 연달아 나오지 않게), 쉬어가기(k=9)는 공원 */
  /* 솔로 챕터마다 장면 4곳을 차례로(같은 장면이 연달아 나오지 않게) */
  const CH_SCENE = [['seoul', 'tokyo', 'beijing', 'bangkok'], ['hanoi', 'agra', 'singapore', 'dubai'], ['cairo', 'istanbul', 'paris', 'london'], ['rome', 'barcelona', 'santorini', 'amsterdam'], ['alps', 'nyc', 'rio', 'sydney']];
  function stageCfg(n){
    const p = planOf('hidden', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x), cc = Math.min(c, LT.spp.length - 1);
    let items = c === 1 ? LT.ch1[k - 1] : LT.base[cc] + LT.kOff[k];
    if(tw === 'tiny') items += 2;
    items = Math.max(5, Math.min(12, items));
    let limit = (items + 1) * LT.spp[cc] * LT.kTime[k];   /* 양이 몫 +1(양이는 물건과 따로 하나 더) */
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(45, Math.round(limit / 5) * 5);
    const cs = CH_SCENE[(c - 1) % CH_SCENE.length], scene = cs[(k - 1 + Math.floor((c - 1) / CH_SCENE.length)) % cs.length];
    return { items, many:0, swim:0, limit, scene, mirror:has('many'), gray:has('swim'), hints:tw === 'bare' ? 0 : p.boss ? 2 : 3,
      shadow:has('shadow'), night:has('night'), order:tw === 'order', lives:tw === 'tight' ? 2 : 0, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 판 만들기(rng만): 장면 → 그 장면 물건 12개 중 n개 =====
     물건은 그림 속에 원래 있는 것(서로 다른 물건, 자리·반지름은 hidden-photo.js) → 늘 보이고 누를 수 있다(풀 수 있음). */
  function pickScene(rng, avoid){ const ok = SCN.filter(k => !(avoid || []).includes(k)), a = ok.length ? ok : SCN; return a[Math.floor(rng() * a.length)]; }
  function gen3(cfg, rng, key){
    const sc = sceneOf(key || cfg.scene || pickScene(rng, cfg.avoid));
    const no = Math.max(1, Math.min(sc.objs.length, cfg.items || 8)), n = no + 1;
    const pick = shuffle(sc.objs.slice(), rng).slice(0, no);   /* 그림 속 물건 cfg.items개 + 양이 1 = 모두 n개(양이는 따로 하나 더, 시간도 한 개 몫 더) */
    const u = 'hd' + Math.floor(rng() * 1e6);
    /* 양이: 목록 맨 앞(물건 0번). 그림은 거울 묶음 안에 원래 자리(bx)로 그려 거울이면 같이 뒤집히고, 판정 자리 x도 뒤집는다 */
    const yg = placeYang(rng, sc, cfg);
    const all = [{ id:YK, x:yg.bx, y:yg.y, r:yg.r }].concat(pick);
    const list = all.map(o => ({ k:o.id, need:1, got:0 }));
    const items = all.map((o, li) => ({ i:li, li, k:o.id, x:cfg.mirror ? W - o.x : o.x, y:o.y, r:o.r, s:1, rot:0, F:'#FFE27A', A:'#FFE27A', K:INK, yang:o.id === YK }));
    const ok = items.length === n && items.every(o => o.x - o.r >= -2 && o.x + o.r <= W + 2 && o.y - o.r >= -2 && o.y + o.r <= H + 2);
    return { key:sc.key, tk:sc.key, T:{ name:sc.name, k:INK }, bg:photoSvg(sc.key, u, !!cfg.mirror, !!cfg.gray, yg), top:'', items, list, ok, v2:true, photo:true, yang:yg };
  }
  /* 대전에서 같은 그림이 다시 나오지 않게(대전 v3): 엔진이 판마다 새 씨앗(방·판 번호·판 표지)을 주고,
     최근 본 장면 3개(duelAvoidKey로 엔진이 저장 → G.duel.avoid, 빠른 대전은 방장 목록을 모두가 같이 씀)를 피해 고른다.
     예전에 게임 안에서 세던 판 번호(hp:hidden:rounds)·최근 장면(hp:hidden:seen)은 엔진으로 옮겼다. */
  const duelAvoid = cfg => [].concat((G.duel && G.duel.avoid) || [], (cfg && cfg.avoid) || []).filter(k => SCN.includes(k));

  /* ===== 플레이 ===== */
  const S = () => G.h;
  const T_ = (fn, ms) => { const m = G.h, id = setTimeout(() => { m.timers.delete(id); if(G && G.h === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const posOf = (o, t) => o.mv ? [o.x + o.mv.ax * Math.sin(t * Math.PI * 2 / o.mv.per + o.mv.ph), o.y + o.mv.ay * Math.sin(t * Math.PI * 2 / o.mv.per + o.mv.ph)] : [o.x, o.y];
  const totalOf = m => m.items.length;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const curLi = m => m.list.findIndex(L => L.got < L.need);

  const ICO = {
    glass:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#E6F6FF" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5.5 5.5" stroke="#1A0F45" stroke-width="3.4" stroke-linecap="round"/><path d="M7 8a3.5 3.5 0 0 1 3-2.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    zin:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5 5" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6M10 7v6" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/></svg>',
    zout:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5 5" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#hdFound'); if(f) f.textContent = m.found;
    const h = $('#hdHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const lv = $('#hdLives');
    if(lv){ if(!m.lives) lv.hidden = true; else { const left = Math.max(0, m.lives - m.misses); lv.hidden = false; lv.innerHTML = '기회 ' + Array.from({ length:m.lives }, (_, n) => `<i${n >= left ? ' class="off"' : ''}>★</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); } }
  }
  function msg(html, cls){ const e = $('#hdMsg'); if(!e) return; e.className = 'hd-msg ' + (cls || ''); e.innerHTML = html; }
  /* 2026-10-18 판 위 글자 최소화(docs/29): 평소 알림 줄은 비워 둔다(장면 이름·규칙 설명은 도움말 tips·"이번 판"으로) */
  function playMsg(){ return ''; }
  /* 판 위 규칙 꼬리표는 4글자 이하 짧은 이름(긴 이름·설명은 도움말) */
  const RULE_SHORT = { shadow:'그림자', many:'거울', swim:'흑백', night:'손전등', flash:'빠른 판', tiny:'더 많이', bare:'맨손', order:'차례로', tight:'외줄' };
  function chipHtml(L, li){
    const m = S(), done = L.got >= L.need, cur = m.order && li === curLi(m);
    if(SHR()){   /* 선점 대전: 차지한 사람 자리 색으로 칠하고 줄 긋기 + 자리 모양 표식 */
      const o = m.items.find(x => x.li === li), P = o && m.own[o.i] ? plOf(m.own[o.i]) : null;
      if(P) return `<div class="hd-chip done own" style="--oc:${P.col}" data-li="${li}" role="listitem" aria-label="${nmOf(L.k)} ${P.me ? '내가' : esc(P.nick) + '님이'} 차지"><span class="hd-ci">${iconSvg(L.k, false)}</span><span class="hd-cn" aria-hidden="true"></span><em class="sh">${shapeIco(P.shape, P.col)}</em></div>`;
    }
    const nm = m.shadow && !done ? '???' : nmOf(L.k);
    return `<div class="hd-chip${done ? ' done' : ''}${cur ? ' cur' : ''}${m.order && !done && !cur ? ' wait' : ''}" data-li="${li}" role="listitem" aria-label="${m.shadow && !done ? '그림자 물건' : nmOf(L.k)}${L.need > 1 ? ' ' + L.got + '/' + L.need + '개' : ''}${done ? ' 찾음' : ''}"><span class="hd-ci">${iconSvg(L.k, m.shadow && !done)}</span><span class="hd-cn">${done ? '' : nm}</span>${L.need > 1 ? `<em>${done ? '✔' : '×' + (L.need - L.got)}</em>` : done ? '<em class="ok">✔</em>' : ''}</div>`;
  }
  /* 찾을 목록: 한 줄 가로 칸(넘치면 옆으로 밀기). 아직 못 찾은 물건이 앞에 오고, 찾은 물건은 뒤로 → 보이는 칸이 늘 남은 물건 */
  function drawList(){
    const m = S(), el = $('#hdList'); if(!el) return;
    const idx = m.list.map((L, li) => li), done = li => m.list[li].got >= m.list[li].need;
    el.innerHTML = idx.filter(li => !done(li)).concat(idx.filter(done)).map(li => chipHtml(m.list[li], li)).join('');
    try{ el.scrollLeft = 0; listFade(); }catch(_){}
  }
  function listFade(){ const el = $('#hdList'); if(!el) return; const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 6; el.classList.toggle('more', more); }

  /* 확대/이동: viewBox로 보이는 부분만 바꾼다(물건 자리·판정은 장면 좌표 그대로) */
  function applyView(){
    const m = S(), v = m.view, svg = $('#hdSvg'); if(!svg) return;
    const vw = W / v.z, vh = H / v.z;
    v.cx = Math.max(vw / 2, Math.min(W - vw / 2, v.cx)); v.cy = Math.max(vh / 2, Math.min(H - vh / 2, v.cy));
    svg.setAttribute('viewBox', `${r1(v.cx - vw / 2)} ${r1(v.cy - vh / 2)} ${r1(vw)} ${r1(vh)}`);
    const zi = $('#hdZin'), zo = $('#hdZout'); if(zi) zi.disabled = v.z >= ZMAX - .01; if(zo) zo.disabled = v.z <= 1.01;
    const w = $('#hdWrap'); if(w) w.classList.toggle('zoomed', v.z > 1.01);
    /* 확대하면 동그라미·✕ 선이 같이 굵어지지 않게(화면 기준 굵기 비슷하게) — 보이기만 */
    svg.style.setProperty('--zs', r1(Math.max(1 / v.z, .12) * 1000) / 1000);
    const lv = $('#hdZlv'); if(lv){ const t = v.z > 1.01 ? '×' + (v.z < 9.95 ? (Math.round(v.z * 10) / 10).toString() : Math.round(v.z)) : ''; if(lv.textContent !== t) lv.textContent = t; lv.hidden = !t; }
  }
  const ZMAX = 12;   /* 2026-10-12 사용자 지시: 3배 → 12배(4배 더) */
  const ZSTEP = [1, 2, 4, 8, 12];   /* 돋보기 +/− 단추 단계 */
  function zoomBy(f, cx, cy){
    const m = S(), v = m.view, z = Math.max(1, Math.min(ZMAX, v.z * f));
    if(cx != null){ /* 손가락 사이(또는 누른 곳)를 기준으로 확대 */ v.cx = cx + (v.cx - cx) * v.z / z; v.cy = cy + (v.cy - cy) * v.z / z; }
    v.z = z; applyView();
  }
  function scenePt(cx, cy){
    const svg = $('#hdSvg'); if(!svg || !svg.getScreenCTM) return null;
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y];
  }
  const pxPerUnit = () => { const m = S(), svg = $('#hdSvg'); return svg && svg.clientWidth ? svg.clientWidth / (W / m.view.z) : 1; };
  function screenOf(x, y){ const svg = $('#hdSvg'); if(!svg) return { x:0, y:0 }; const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); return { x:q.x, y:q.y }; }

  function setLight(x, y){ const m = S(); m.light = [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]; const c = $('#hdLight'), g = $('#hdGlow'); if(c){ c.setAttribute('cx', r1(m.light[0])); c.setAttribute('cy', r1(m.light[1])); } if(g){ g.setAttribute('cx', r1(m.light[0])); g.setAttribute('cy', r1(m.light[1])); } }

  /* 누르기 판정: 아직 못 찾은 물건 중 가까운 것. 판정 반지름 = 물건 반지름 + 화면 14px(작은 물건도 관대하게) */
  function hitAt(x, y, all){   /* all: 이미 찾은(선점 대전에서는 누가 차지한) 물건도 판정 → 남의 것을 눌러도 빗나감이 아님 */
    const m = S(), t = elapsed(), tol = Math.max(14 / pxPerUnit(), .8);   /* 화면 14px(12배 확대에서도 화면 기준) */
    let best = null, bd = 1e9;
    for(const o of m.items){
      if(m.got.has(o.i) && !all) continue;
      const [px, py] = posOf(o, t), d = Math.hypot(px - x, py - y), lim = Math.max(o.r + tol, 22 / pxPerUnit());
      if(d < lim && d / lim < bd){ bd = d / lim; best = o; }
    }
    return best;
  }
  function tapAt(cx, cy){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play') return;
    const p = scenePt(cx, cy); if(!p) return;
    if(Date.now() < m.coolUntil){ const c = $('#hdCool'); if(c) fxShake(c, 3); return; }
    if(m.night && Math.hypot(p[0] - m.light[0], p[1] - m.light[1]) > LIGHT_R){ setLight(p[0], p[1]); sfx('hdLight'); return; }
    if(SHR()){ const o = hitAt(p[0], p[1], true); if(o) claimTap(o); else miss(p[0], p[1], cx, cy); return; }
    const o = hitAt(p[0], p[1]);
    if(o && m.order && o.li !== curLi(m)){ msg('<b class="boss">차례 아님</b>', 'hd-pop'); T_(() => { if(m.phase === 'play') msg(playMsg()); }, 900); return; }
    if(o) found(o); else miss(p[0], p[1], cx, cy);
  }
  function found(o){
    const m = S(), L = m.list[o.li];
    m.got.add(o.i); L.got++; m.found++; m.streak = 0; m.combo++;
    const mk = document.createElementNS(SVGNS, 'g');
    mk.setAttribute('class', 'hd-mark'); mk.dataset.i = o.i;
    const [px, py] = posOf(o, elapsed());
    mk.setAttribute('transform', `translate(${r1(px)} ${r1(py)})`);
    mk.innerHTML = `<g class="p"><circle r="${r1(o.r + 8 / Math.min(3, m.view.z))}" class="o"/><circle r="${r1(o.r + 8 / Math.min(3, m.view.z))}" class="c"/></g>`;
    const ml = $('#hdMarks'); if(ml) ml.appendChild(mk);
    const ig = document.querySelector(`.ng-hidden .hd-it[data-i="${o.i}"]`); if(ig) ig.classList.add('got');
    drawList(); hud();
    try{ const q = screenOf(px, py); fxBurst(q.x, q.y, ['#FF3D7F', '#FFE27A', '#FFFFFF', o.F], 12, { speed:220, size:4.5, kinds:['star', 'dot', 'spark'], up:90, g:420, glow:true, dur:.6 }); fxRing(q.x, q.y, '#FFE27A', 56, .5, 7); fxRing(q.x, q.y, '#FFFFFF', 34, .35, 4);
      const ch = document.querySelector(`.ng-hidden .hd-chip[data-li="${o.li}"]`); if(ch) fxPunch(ch, 1.12); }catch(_){}
    sfx('hdFind', { n:Math.min(8, m.combo - 1) }); fxBuzz(12);
    if(o.yang) yangHop();
    if(m.combo >= 3) try{ fxCombo(m.combo); }catch(_){}
    clearHint();
    if(m.found >= totalOf(m)){ win(); return; }
    if(m.phase === 'play') msg(L.got >= L.need ? `<b>${nmOf(L.k)}</b><span>✔</span>` : `<b>${nmOf(L.k)}</b><span>+${L.need - L.got}</span>`, 'hd-pop');
  }
  /* 양이를 찾으면 작게 폴짝(보이기만, 판 상태와 상관없음) */
  function yangHop(){ try{ const g = document.querySelector('.ng-hidden .hd-yang'); if(g){ g.classList.remove('hop'); void g.getBoundingClientRect(); g.classList.add('hop'); } }catch(_){} }
  function miss(x, y){
    const m = S();
    m.misses++; m.streak++; m.combo = 0;
    const cool = (G.duel ? 1500 : 700) + 350 * Math.min(3, m.streak - 1);   /* 연속으로 빗나가면 더 오래 못 누름(마구 누르기 막기). 대전은 1.5초부터(막 누르기로 이기지 않게) */
    m.coolUntil = Date.now() + cool; m.coolLen = cool;
    const xg = document.createElementNS(SVGNS, 'g'); xg.setAttribute('class', 'hd-x');
    const sc = 1 / m.view.z; xg.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100})`);
    xg.innerHTML = '<path d="M-9-9L9 9M9-9L-9 9" class="o"/><path d="M-9-9L9 9M9-9L-9 9" class="c"/>';
    const ml = $('#hdMarks'); if(ml){ ml.appendChild(xg); T_(() => xg.remove(), 650); }
    const w = $('#hdWrap'), c = $('#hdCool');
    if(w){ w.classList.add('cool'); T_(() => { if(Date.now() >= m.coolUntil - 20) w.classList.remove('cool'); }, cool); }
    coolShow();
    sfx('hdMiss'); fxBuzz(25);
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;
    msg('<b class="bad">빗나갔어요</b><span>' + (left < 0 ? '점수 −15' : left ? '기회 ' + left + '번 남음' : '기회를 다 썼어요') + '</span>', 'hd-pop');
    hud();
    T_(() => { if(m.phase === 'play') msg(playMsg()); }, 1100);
    if(left >= 0){ G.paws = left; if(!left) lose('기회를 다 썼어요', 'miss'); }
  }
  /* 쿨다운 남은 시간 보여 주기(장면 위 '잠깐! 0.8초' + 줄어드는 막대). 보이기만 함 */
  function coolShow(){
    try{
      const m = S(), c = $('#hdCool'); if(!c || !m) return;
      const left = Math.max(0, m.coolUntil - Date.now()); if(!left) return;
      const t = (Math.ceil(left / 100) / 10).toFixed(1);
      const b = c.querySelector('b'); if(b && b.dataset.t !== t){ b.dataset.t = t; b.textContent = '잠깐! ' + t + '초'; }
      const bar = $('#hdCoolBar'); if(bar) bar.style.transform = `scaleX(${Math.min(1, left / (m.coolLen || 700))})`;
    }catch(_){}
  }
  function clearHint(){ const h = $('#hdHintRing'); if(h) h.remove(); }
  function useHint(){
    const m = S(); if(!m || G.over || G.paused || m.phase !== 'play' || m.hintLeft <= 0) return;
    const left = m.items.filter(o => !m.got.has(o.i) && (!m.order || o.li === curLi(m)));
    if(!left.length) return;
    m.hintLeft--; m.hints++; hud(); clearHint();
    const o = left[Math.floor(m.hr() * left.length)], [px, py] = posOf(o, elapsed());
    /* 물건 바로 위가 아니라 "근처"를 밝힌다 */
    const a = m.hr() * Math.PI * 2, d = m.hr() * o.r * .9, hx = px + Math.cos(a) * d, hy = py + Math.sin(a) * d;
    const g = document.createElementNS(SVGNS, 'g'); g.id = 'hdHintRing'; g.setAttribute('class', 'hd-hint'); g.setAttribute('transform', `translate(${r1(hx)} ${r1(hy)})`);
    const hrr = r1(Math.min(o.r * 2.6, Math.max(o.r * 1.4, W / m.view.z * .38)));   /* 크게 확대했을 때 밝힘이 화면을 다 덮지 않게 */
    g.innerHTML = `<circle r="${hrr}" class="f"/><circle r="${hrr}" class="c"/>`;
    const ml = $('#hdMarks'); if(ml) ml.appendChild(g);
    T_(() => { if(g.parentNode) g.remove(); }, 2600);
    const v = m.view, vw = W / v.z, vh = H / v.z;
    if(Math.abs(hx - v.cx) > vw / 2 - 20 || Math.abs(hy - v.cy) > vh / 2 - 20){ v.cx = hx; v.cy = hy; applyView(); }
    if(m.night) setLight(hx, hy);
    sfx('hdHint');
  }

  /* ===== 선점 대전(대전 v3 'shared', docs/21 WP6 3번·11절) =====
     2~5명이 같은 장면을 같이 보고, 물건을 먼저 누른 사람이 차지한다. 열쇠 = 'o' + 물건 번호.
     주인은 엔진이 정한다(서버 시각이 가장 이른 사람, 늦게 온 더 이른 기록이 있으면 바뀜 → onDuelClaim의 lost).
     게임은 보이기만 바꾼다: 그 사람 자리 색·모양 테두리(내 화면에서 나는 늘 분홍 원), 이름표 1.2초, 목록 칸 색·줄긋기, 내 찾은 수.
     끝: 다 차지되거나, 남은 것을 다 가져가도 1위를 못 따라잡으면(2명이면 6개 중 4개 먼저) duelEndNow — 모든 기기가 같은 주인 표로 같은 판단 */
  const SHR = () => !!(G && G.id === 'hidden' && G.duel && G.duel.v === 3 && G.duel.kind === 'shared' && typeof duelClaim === 'function');
  const keyOf = o => 'o' + o.i;
  const plOf = pid => { try{ return duelPlayers().find(p => p.pid === pid) || null; }catch(_){ return null; } };
  /* 자리 모양 테두리(장면 단위, 중심 0,0). 모양은 엔진 자리 표식과 같은 다섯 가지 */
  function shapeD(shape, R){
    const f = n => r1(n);
    if(shape === 'square'){ const a = R * .9; return `M${f(-a)} ${f(-a)}H${f(a)}V${f(a)}H${f(-a)}z`; }
    if(shape === 'tri'){ const t = R * 1.3; return `M0 ${f(-t * 1.12)}L${f(t * 1.1)} ${f(t * .74)}H${f(-t * 1.1)}z`; }
    if(shape === 'diamond'){ const d = R * 1.3; return `M0 ${f(-d)}L${f(d)} 0L0 ${f(d)}L${f(-d)} 0z`; }
    if(shape === 'star') return starPath(0, R * .08, R * 1.5, R * .98);
    return `M${f(-R)} 0a${f(R)} ${f(R)} 0 1 0 ${f(2 * R)} 0a${f(R)} ${f(R)} 0 1 0 ${f(-2 * R)} 0`;
  }
  const shapeIco = (shape, col) => `<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="${shapeD(shape, 6.4)}" fill="${col}" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const markOf = i => document.querySelector(`.ng-hidden .hd-mark[data-i="${i}"]`);
  function ownMark(o, P, tent){
    const old = markOf(o.i); if(old) old.remove();
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'hd-mark hd-own' + (tent ? ' tent' : '')); g.dataset.i = o.i;
    const [px, py] = posOf(o, elapsed()); g.setAttribute('transform', `translate(${r1(px)} ${r1(py)})`);
    const d = shapeD(P.shape, o.r + 8);
    g.innerHTML = `<g class="p"><path d="${d}" class="k"/><path d="${d}" class="o"/><path d="${d}" class="c" style="stroke:${P.col}"/></g>`;
    const ml = $('#hdMarks'); if(ml) ml.appendChild(g);
  }
  /* 얼굴 꼬리표 대신 이름표(자리 모양 + 이름) 1.2초 — 보이기만 */
  function claimTag(o, P){
    try{
      const m = S(), ml = $('#hdMarks'); if(!ml) return;
      const nm = P.me ? '나' : '', w = nm ? 34 + nm.length * 13 : 28, sc = 1 / m.view.z;   /* 2026-10-18: 남의 이름표는 자리 모양만(별명은 알림 줄) */
      const [px, py] = posOf(o, elapsed()), x = Math.max(w / 2 * sc + 2, Math.min(W - w / 2 * sc - 2, px)), y = Math.max(16 * sc, py - (o.r + 22) * Math.min(1, sc * 1.4));
      const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'hd-tag'); g.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100})`);
      g.innerHTML = `<rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="12" fill="#fff" stroke="${P.col}" stroke-width="3"/><path d="${shapeD(P.shape, 5.5)}" transform="translate(${-w / 2 + 14} 0)" fill="${P.col}" stroke="#1A0F45" stroke-width="1.6"/><text x="${-w / 2 + 25}" y="5" font-size="14" fill="#1A0F45">${esc(nm)}</text>`;
      ml.appendChild(g); setTimeout(() => { try{ g.remove(); }catch(_){} }, 1200);
    }catch(_){}
  }
  function takenMsg(own){
    const m = S(), P = plOf(own);
    msg(`<b>이미 차지</b>${P ? `<span class="hd-msh">${shapeIco(P.shape, P.col)}</span>` : ''}`, 'hd-pop');
    T_(() => { if(m.phase === 'play') msg(playMsg()); }, 900);
  }
  /* 누르기: 아직 주인 없는 물건이면 차지 시도(내 화면에는 바로 점선 → 0.4초 확인 뒤 진하게). 남의 것은 아무 일 없음(벌칙 없음) */
  function claimTap(o){
    const me = G.duel.myPid, own = duelOwner(keyOf(o)) || S().own[o.i];
    if(own && own !== me){ takenMsg(own); return; }
    if(own) return;
    const r = duelClaim(keyOf(o));
    if(!r.ok && r.owner && r.owner !== me) takenMsg(r.owner);
  }
  /* 엔진이 주인을 정하거나 바꿀 때(내 것·남의 것·컴퓨터 모두) */
  function claimSeen(key, owner, info){
    const m = G && G.id === 'hidden' && G.h; if(!m || !SHR() || String(key)[0] !== 'o') return;
    const o = m.items[+String(key).slice(1)]; if(!o) return;
    const me = G.duel.myPid, prev = m.own[o.i], L = m.list[o.li];
    if(info.sure){ if(owner === me){ const mk = markOf(o.i); if(mk) mk.classList.remove('tent'); } return; }
    if(prev === owner) return;
    if(prev === me) m.found = Math.max(0, m.found - 1);   /* 뺏김: 내 수 되돌림("간발의 차" 알림은 엔진이) */
    if(!prev){ L.got = Math.min(L.need, L.got + 1); m.got.add(o.i); }
    m.own[o.i] = owner;
    const P = plOf(owner) || { pid:owner, col:'#8A8FA8', shape:'circle', nick:'상대', me:false };
    ownMark(o, P, owner === me);
    claimTag(o, P);
    if(o.yang) yangHop();
    const left = m.items.length - Object.keys(m.own).length;
    if(owner === me){
      m.streak = 0; m.combo++; m.found++; clearHint();
      try{ const [px, py] = posOf(o, elapsed()), q = screenOf(px, py); fxBurst(q.x, q.y, ['#FF3D7F', '#FFE27A', '#FFFFFF', o.F], 12, { speed:220, size:4.5, kinds:['star', 'dot', 'spark'], up:90, g:420, glow:true, dur:.6 }); fxRing(q.x, q.y, '#FFE27A', 56, .5, 7); }catch(_){}
      sfx('hdFind', { n:Math.min(8, m.combo - 1) }); fxBuzz(12);
      if(m.phase === 'play') msg(`<b>${nmOf(L.k)}</b><span>✔</span>`, 'hd-pop');
    } else if(m.phase === 'play'){
      msg(`<span class="hd-msh">${shapeIco(P.shape, P.col)}</span><b aria-label="${esc(String(P.nick))}">✔</b>`, 'hd-pop');   /* 2026-10-18: 별명 대신 모양만(글자 줄이기) */
      try{ sfx('toggle'); }catch(_){}
    }
    if(m.phase === 'play') T_(() => { if(m.phase === 'play') msg(playMsg()); }, 1300);
    drawList(); hud();
    sharedEndSoon();
  }
  /* 끝 판단은 0.45초 뒤(확인 중인 차지가 뒤집힐 수 있으니). 주인 표는 엔진 것을 그대로 읽음 → 모든 기기가 같은 답 */
  function sharedEndSoon(){ const m = S(); if(m.endT){ clearTimeout(m.endT); m.timers.delete(m.endT); } m.endT = T_(sharedEndCheck, 450); }
  function sharedEndCheck(){
    const m = S(); if(!SHR() || G.over || m.phase !== 'play') return;
    const ps = duelPlayers(), cnt = {}; let taken = 0;
    m.items.forEach(o => { const w = duelOwner(keyOf(o)); if(w){ taken++; cnt[w] = (cnt[w] || 0) + 1; } });
    const rem = m.items.length - taken, arr = ps.map(p => ({ p, c:cnt[p.pid] || 0 })).sort((a, b) => b.c - a.c);
    if(!arr.length) return;
    const top = arr[0], sec = arr[1] ? arr[1].c : 0;
    if(rem > 0 && !(arr.length > 1 && top.c > sec + rem)) return;
    m.phase = 'done';
    const who = top.p.me ? '내가' : esc(top.p.nick) + '님이';
    const why = rem <= 0 ? '물건을 모두 찾아서 끝났어요' : `${who} ${top.c}개를 먼저 차지해서 끝났어요`;
    msg(rem <= 0 ? '<b>모두 찾았어요!</b>' : `<b>${top.p.me ? '내가 앞섰어요!' : '승부가 났어요'}</b>`, 'hd-win');
    duelEndNow(why);
  }

  /* 시계·움직이는 물건 */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.h || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed();
    if(m.movers.length){
      m.movers.forEach(o => { const [px, py] = posOf(o, t), tr = `translate(${r1(px)} ${r1(py)})`; const e = m.itEl[o.i]; if(e) e.setAttribute('transform', tr); if(m.got.has(o.i)){ const mk = document.querySelector(`.ng-hidden .hd-mark[data-i="${o.i}"]`); if(mk) mk.setAttribute('transform', tr); } });
    }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem), bar = $('#hdBar');
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#hdTime'); if(e) e.textContent = mmss(sec);
      const p = $('#hdTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#hdBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('hdTick', { hi:sec <= 5 }); try{ if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }catch(_){} }
    }
    if(rem <= 0){ const e = $('#hdTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
    const c = $('#hdWrap'); if(c && c.classList.contains('cool')){ if(Date.now() >= m.coolUntil) c.classList.remove('cool'); else coolShow(); }
  }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed();
    msg('<b>모두 찾았어요!</b>', 'hd-win');
    sfx('win', { g:'hidden' }); fxBuzz([30, 50, 30]);
    try{ const w = $('#hdWrap'); if(w){ w.classList.add('cleared'); const p = fxCenter(w); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxBurst(p.x, p.y, ['#FFE27A', '#FF8FC8', '#7CCBFF', '#5BD08A'], 26, { speed:340, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); } }catch(_){}
    if(m.night){ const ov = $('#hdNight'); if(ov) ov.classList.add('off'); }
    T_(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.fail = why;
    msg('<b class="bad">' + text + '</b>', 'hd-pop');
    sfx('hdTimeUp'); fxBuzz([40, 40, 60]);
    try{ fxShake($('#hdWrap'), 6); }catch(_){}
    /* 못 찾은 물건 자리 보여 주기 */
    const ml = $('#hdMarks'), t = elapsed();
    if(ml) m.items.filter(o => !m.got.has(o.i)).forEach(o => { const [px, py] = posOf(o, t); const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'hd-mark miss'); g.setAttribute('transform', `translate(${r1(px)} ${r1(py)})`); g.innerHTML = `<circle r="${r1(o.r + 8)}" class="o"/><circle r="${r1(o.r + 8)}" class="c"/>`; ml.appendChild(g); });
    if(m.night){ const ov = $('#hdNight'); if(ov) ov.classList.add('off'); }
    T_(() => finish(false), 1500);
  }

  /* 첫 판 안내: 돋보기 단추 옆 말풍선(한 번 확대하거나 3초 지나면 사라짐, 이 기기에서 3판까지) */
  function zoomTipOff(){ const t = $('#hdZtip'); if(t){ t.classList.add('off'); setTimeout(() => { try{ t.remove(); }catch(_){} }, 300); } try{ store.set('hp:hidden:ztip', 9); }catch(_){} }
  function zoomTip(){
    try{
      return;   /* 2026-10-18 판 위 글자 최소화: 말풍선 대신 도움말 tips '크게 보기' */
      const m = S(), n = +store.get('hp:hidden:ztip', 0) || 0; if(m.night || n >= 3 || !$('#hdWrap')) return;
      store.set('hp:hidden:ztip', n + 1);
      const t = document.createElement('div'); t.id = 'hdZtip'; t.className = 'hd-ztip'; t.innerHTML = '돋보기로<br>크게 볼 수 있어요'; t.setAttribute('aria-hidden', 'true');
      $('#hdWrap').appendChild(t); T_(() => zoomTipOff(), 3000);
    }catch(_){}
  }
  function layout(){
    const m = S(), wrap = $('#hdWrap'), root = document.querySelector('.ng-hidden'), list = $('#hdList'); if(!wrap || !root) return;
    const RW = Math.min(root.clientWidth || 360, 480);
    const top = wrap.getBoundingClientRect().top + (window.scrollY || 0);
    const lh = list ? list.offsetHeight : 90;
    const avail = Math.max(300, (innerHeight || 740) - top - lh - 32);
    const w = Math.floor(Math.max(240, Math.min(RW, avail * W / H)));
    wrap.style.width = w + 'px'; wrap.style.height = Math.round(w * H / W) + 'px';
    if(list) list.style.maxWidth = Math.max(w, Math.min(RW, 420)) + 'px';
  }
  function wire(){
    const m = S(), svg = $('#hdSvg'); if(!svg) return;
    const P = new Map(); let pinch = null, moved = false, multi = false, sv = null;
    svg.onpointerdown = e => {
      e.preventDefault(); try{ svg.setPointerCapture(e.pointerId); }catch(_){}
      P.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY });
      if(P.size === 1){ moved = false; multi = false; sv = { cx:m.view.cx, cy:m.view.cy }; }
      if(P.size === 2 && !m.night){ multi = true; const [a, b] = [...P.values()]; pinch = { d:Math.hypot(a.x - b.x, a.y - b.y) || 1, z:m.view.z }; }
    };
    svg.onpointermove = e => {
      const p = P.get(e.pointerId); if(!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if(P.size >= 2 && pinch){
        const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = scenePt((a.x + b.x) / 2, (a.y + b.y) / 2);
        const f = (pinch.z * d / pinch.d) / m.view.z; if(c && Math.abs(f - 1) > .01) zoomBy(f, c[0], c[1]);
        return;
      }
      if(P.size !== 1 || multi) return;
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if(!moved && Math.hypot(dx, dy) > 8) moved = true;
      if(!moved || G.paused || G.over) return;
      if(m.night){ const q = scenePt(e.clientX, e.clientY); if(q) setLight(q[0], q[1]); return; }
      if(m.view.z > 1.01){ const upp = (W / m.view.z) / (svg.clientWidth || W); m.view.cx = sv.cx - dx * upp; m.view.cy = sv.cy - dy * upp; applyView(); }
    };
    const up = e => {
      const p = P.get(e.pointerId); if(!p) return;
      P.delete(e.pointerId);
      if(e.type === 'pointerup' && !moved && !multi && P.size === 0) tapAt(e.clientX, e.clientY);
      if(P.size < 2) pinch = null;
      if(P.size === 0){ multi = false; }
    };
    svg.onpointerup = up; svg.onpointercancel = up;
    svg.onwheel = e => { if(m.night) return; e.preventDefault(); const c = scenePt(e.clientX, e.clientY); zoomBy(e.deltaY < 0 ? 1.25 : 1 / 1.25, c && c[0], c && c[1]); };
    const zi = $('#hdZin'), zo = $('#hdZout');
    if(zi) zi.onclick = () => { const z = ZSTEP.find(s => s > m.view.z + .05) || ZMAX; zoomBy(z / m.view.z); sfx('hdZoom'); zoomTipOff(); };
    const hl = $('#hdList'); if(hl) hl.onscroll = listFade;
    if(zo) zo.onclick = () => { const z = ZSTEP.slice().reverse().find(s => s < m.view.z - .05) || 1; zoomBy(z / m.view.z); sfx('hdZoom', { out:1 }); };
    const h = $('#hdHint'); if(h) h.onclick = useHint;
  }

  return {
    name:'숨은그림 찾기', abil:'집중력', col:['#FFD6A5', '#F08A24', '#9A4A08'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 2.5a7.5 7.5 0 0 1 6.1 11.9l5 5a1.5 1.5 0 0 1-2.1 2.1l-5-5A7.5 7.5 0 1 1 10 2.5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/><path d="M10 7.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L7.1 9.3l2-.3z"/></svg>',
    art(){
      /* 썸네일(2026-10-12): 파리 장면 그림을 칸 가득(img/thumb.webp 480×300, 양이가 들어 있음) + 양이를 찾은 동그라미 + 돋보기.
         예전엔 360×480 장면 일부를 viewBox로 잘라 써서 작은 칸에서 복잡했다 → 썸네일 전용 그림을 viewBox 0 0 160 100 전체에 깐다 */
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="#F08A24"/>
        <image href="${PH.thumb()}" x="0" y="0" width="160" height="100" preserveAspectRatio="xMidYMid slice"/>
        <circle cx="90" cy="55" r="23" fill="none" stroke="#fff" stroke-width="5.5"/><circle cx="90" cy="55" r="23" fill="none" stroke="#FF2E7E" stroke-width="3"/>
        <g transform="translate(122 72) rotate(-10) scale(.62)"><circle r="20" fill="#E6F6FF" fill-opacity=".45" stroke="#1A0F45" stroke-width="5"/><path d="M14 14l15 15" stroke="#1A0F45" stroke-width="9" stroke-linecap="round"/><path d="M14 14l15 15" stroke="#F08A24" stroke-width="4.5" stroke-linecap="round"/><path d="M-10-7a12 12 0 0 1 9-7" stroke="#fff" stroke-width="3.6" stroke-linecap="round" fill="none"/></g></svg>`;
    },
    /* 도움말: 그림 1장 + 3줄(쉬운 말) */
    get help(){
      const sc = sceneOf('paris'), o = sc.objs.find(x => x.name === '판토마임') || sc.objs[0];
      const vx = r1(Math.max(0, Math.min(W - 168, o.x - 60))), vy = r1(Math.max(0, Math.min(H - 100, o.y - 50)));
      const pic = `<svg viewBox="${vx} ${vy} 168 100" style="display:block;width:100%;max-width:300px;margin:4px 0 8px;border-radius:12px;border:2px solid #1A0F45" aria-hidden="true">${photoSvg(sc.key, 'hdH')}<circle cx="${o.x}" cy="${o.y}" r="${r1(o.r + 4)}" fill="none" stroke="#fff" stroke-width="7"/><circle cx="${o.x}" cy="${o.y}" r="${r1(o.r + 4)}" fill="none" stroke="#FF2E7E" stroke-width="3.6"/></svg>`;
      return [
        ['여행 중인 양이 찾기', pic + '장면 어딘가에 여행 중인 고양이 양이가 숨어 있어요. 양이와 아래 목록의 물건을 그림에서 찾아 눌러요. 찾으면 동그라미!'],
        ['크게 보기', '두 손가락으로 벌리거나 돋보기 단추로 12배까지 크게 볼 수 있어요.'],
        ['아무 데나 누르면 잠깐 멈춤', '빗나가면 점수가 조금 줄고 잠깐 못 눌러요. 막히면 💡힌트!']
      ];
    },
    helpExtra(){ const m = G && G.id === 'hidden' && G.h; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    /* 2026-10-18 판 위에서 뺀 안내(docs/29) → 도움말 "화면 안내" */
    tips(){
      const m = G && G.id === 'hidden' && G.h, out = [];
      if(m && m.sc) out.push(['장면', m.sc.T.name + '에서 양이와 아래 목록의 물건을 찾아 눌러요.']);
      out.push(['아래 목록', '그림에서 잘라 낸 물건 그림과 이름이에요. 찾은 칸은 ✔ 표시만 남아요(대전은 차지한 사람 색·모양).']);
      out.push(['크게 보기', '오른쪽 아래 돋보기 단추(×2·×4·×8·×12)나 두 손가락으로 크게 볼 수 있어요. 크게 본 채로 끌면 옮겨 가요.']);
      out.push(['💡 힌트', '남은 물건 하나의 근처를 잠깐 밝혀요(−40점).']);
      out.push(['빗나가면', '점수가 15점 줄고 잠깐 못 눌러요(빨간 ✕와 "잠깐!" 막대).']);
      if(m && G.adv){
        for(const k of m.mj) out.push([RULE_SHORT[k] || CONC.info[k].name, CONC.info[k].name + ' · ' + (CONC.info[k].desc || RULE_TIP[k] || '')]);
        if(m.tw) out.push([RULE_SHORT[m.tw] || CONC.twInfo[m.tw].name, CONC.twInfo[m.tw].name + ' · ' + (CONC.twInfo[m.tw].desc || RULE_TIP[m.tw] || '')]);
        if(m.boss) out.push(['대장 판', '이 챕터의 마지막 큰 판이에요. 끝까지 집중!']);
      }
      if(G && G.duel) out.push(['대전', '먼저 누른 사람이 그 물건을 차지해요. 다른 사람이 차지하면 위 알림 줄에 그 사람 모양과 별명이 잠깐 보여요.']);
      return out;
    },
    chapters:['동아시아 산책', '열대와 사막', '피라미드와 런던', '지중해 골목', '세계 일주'],
    starRule:'★ 클리어 · ★★ 힌트 1번·실수 4번 이하 · ★★★ 힌트 없이 실수 1번 이하',
    levels:{
      /* 새 장면: tone = 물건과 바탕의 명도 차(쉬움 25~35%, 그 밖 15~25%), minR = 최소 반지름(화면 28px, 쉬움 32px), rot = 기울기(어려움만 ±25°) */
      /* items = 물건 수(양이는 따로 +1), limit = 물건 + 양이 몫(2026-10-12: 120·150·180 → 135·165·195) */
      easy:{ items:7, size:1.02, dens:90, limit:135, hints:3, tone:[.25, .35], rot:0, minR:16, busy:-.5, ink:.1 },
      normal:{ items:9, size:.9, dens:120, limit:165, hints:3, tone:[.17, .25], rot:0, minR:14, busy:0, ink:.25 },
      hard:{ items:11, size:.8, dens:150, limit:195, hints:3, tone:[.15, .2], rot:25, minR:14, busy:.5, ink:.35 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${sceneOf(c.scene).name} · 물건 ${c.items}개 + 양이 · ${mmss(c.limit)}${c.lives ? ' · 기회 ' + c.lives + '번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `물건 ${c.items}개 + 양이 · ${mmss(c.limit)}`; },
    init(cfg, rng){
      /* 모든 모드가 그림책 사진 장면 20곳(2026-10-10부터, 예전 그림 장면은 모두 지움). 대전은 최근 본 장면을 피해 고른다 */
      const sc = gen3(cfg, rng, G.duel ? pickScene(rng, duelAvoid(cfg)) : (cfg.scene || pickScene(rng, cfg.avoid)));
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.h = { sc, items:sc.items, list:sc.list.map(L => Object.assign({}, L, { got:0 })), got:new Set(), found:0, misses:0, streak:0, combo:0, hints:0,
        hintLeft:cfg.hints == null ? 3 : cfg.hints, lives:G.duel ? 0 : cfg.lives || 0, coolUntil:0, shadow:!!cfg.shadow, night:!!cfg.night, order:!!cfg.order,
        movers:sc.items.filter(o => o.mv), itEl:{}, view:{ z:1, cx:W / 2, cy:H / 2 }, light:[W / 2, H * .55],
        phase:'play', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, hr:mulberry(Math.floor(rng() * 1e9)), lastSec:-1, sec:0, fail:null, timers:new Set(), own:{}, endT:0 };
      G.limit = cfg.limit;
      const m = G.h; if(m.lives) G.paws = m.lives;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트·도구용: 물건을 차례로 모두 누른다(장면 좌표로 바로 판정) */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.h !== m || m.phase === 'done'){ res(m.found); return; }
          if(G.paused){ setTimeout(step, 80); return; }
          m.coolUntil = 0;
          const left = m.items.filter(o => !m.got.has(o.i) && (!m.order || o.li === curLi(m)));
          if(!left.length){ setTimeout(step, 80); return; }
          const o = left[0], [px, py] = posOf(o, elapsed());
          if(m.night) setLight(px, py);
          const h = hitAt(px, py); if(h){ if(SHR()) claimTap(h); else found(h); }
          setTimeout(step, 90);
        };
        step();
      });
    },
    _solveForTest(){ return G.h._solveForTest(); },
    /* 점검용: 물건 i를 화면에서 누른 것처럼(진짜 누르기 길: tapAt) · 물건이 없는 곳을 누르기 */
    _tapItemForTest(i){ const m = G.h, o = m.items[i]; if(!o) return false; m.coolUntil = 0; const [px, py] = posOf(o, elapsed()), q = screenOf(px, py); tapAt(q.x, q.y); return true; },
    onDuelClaim(key, owner, info){ try{ claimSeen(key, owner, info || {}); }catch(_){} },
    duelKeys(){ const m = G && G.id === 'hidden' && G.h; return m ? m.items.map(keyOf) : []; },
    /* 도움말 그림(320×180, 오리지널 도형): 돋보기가 장면을 훑다가 열쇠를 찾아 분홍 동그라미, 다른 사람이 별을 파란 네모로 차지 */
    howto:{
      pic(){
        /* 파리 장면을 돋보기가 훑다가 물건 하나를 찾아 분홍 동그라미, 다른 사람이 다른 물건을 파란 네모로 차지 */
        const sc = sceneOf('paris'), a = sc.objs.find(x => x.name === '판토마임') || sc.objs[0], b = sc.objs.find(x => x.name === '흰 우산') || sc.objs[1];
        const vx = r1(Math.max(0, Math.min(W - 160, (a.x + b.x) / 2 - 80))), vy = r1(Math.max(0, Math.min(H - 90, (a.y + b.y) / 2 - 45))), dur = '4s';
        const show = kt => `<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"/>`, br = r1(b.r + 5);
        return `<svg viewBox="${vx} ${vy} 160 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="그림 속 물건을 찾아 누르면 동그라미가 그려지는 그림">${photoSvg(sc.key, 'hdW')}
          <g>${show('0;.34;.4;.92;1')}<circle cx="${a.x}" cy="${a.y}" r="${r1(a.r + 4)}" fill="none" stroke="#fff" stroke-width="4"/><circle cx="${a.x}" cy="${a.y}" r="${r1(a.r + 4)}" fill="none" stroke="#F0368A" stroke-width="2.2"/></g>
          <g>${show('0;.62;.68;.92;1')}<rect x="${r1(b.x - br)}" y="${r1(b.y - br)}" width="${br * 2}" height="${br * 2}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><rect x="${r1(b.x - br)}" y="${r1(b.y - br)}" width="${br * 2}" height="${br * 2}" fill="none" stroke="#2F7BFF" stroke-width="2.2" stroke-linejoin="round"/></g>
          <g><animateTransform attributeName="transform" type="translate" values="${r1(vx + 80)} ${r1(vy + 60)};${r1((a.x + vx + 80) / 2)} ${r1((a.y + vy + 30) / 2)};${a.x} ${a.y};${a.x} ${a.y};${r1(vx + 80)} ${r1(vy + 60)}" keyTimes="0;.22;.34;.5;1" dur="${dur}" repeatCount="indefinite"/>
            <g transform="scale(.5)"><circle r="15" fill="#E6F6FF" fill-opacity=".35" stroke="#1A0F45" stroke-width="4"/><path d="M11 11l13 13" stroke="#1A0F45" stroke-width="7" stroke-linecap="round"/><path d="M11 11l13 13" stroke="#F08A24" stroke-width="3.4" stroke-linecap="round"/></g></g>
        </svg>`;
      },
      lines:['여행 중인 고양이 양이가 숨어 있어요', '양이와 아래 물건을 찾아 눌러요', '아무 데나 누르면 잠깐 못 눌러요'],
      more:[['여행 중인 양이', '이마에 줄무늬 세 개, 노란 배낭을 멘 회색 고양이 양이가 장면 어딘가에 숨어 있어요. 목록 맨 앞의 양이도 물건과 따로 하나 더 찾아야 해요. 찾으면 양이가 폴짝!'],
        ['그림 속 물건 찾기', '아래 목록의 물건을 그림에서 찾아 눌러요. 찾으면 동그라미가 그려져요.'],
        ['크게 보기', '두 손가락으로 벌리거나 오른쪽 아래 돋보기 단추로 12배까지 크게 볼 수 있어요(×2·×4·×8·×12). 크게 본 채로 끌면 옮겨 가요.'],
        ['아무 데나 누르면 잠깐 멈춤', '빗나가면 점수가 15점 줄고 잠깐 못 눌러요(대전은 1.5초). 막히면 💡힌트(−40점)!'],
        ['대전: 먼저 누르면 내 것', '여럿이 같은 그림을 봐요. 먼저 누른 사람이 그 물건을 차지하고, 그 사람 색 테두리가 그려져요. 많이 차지한 사람이 1등!']]
    },
    _tapMissForTest(){
      const m = G.h; m.coolUntil = 0;
      for(let y = 30; y < H - 30; y += 17) for(let x = 30; x < W - 90; x += 19){
        if(m.items.every(o => Math.hypot(o.x - x, o.y - y) > o.r + 40)){ const q = screenOf(x, y); tapAt(q.x, q.y); return true; }
      }
      return false;
    },
    _hit(x, y){ return hitAt(x, y); }, _applyViewForTest(){ applyView(); },
    _gen:gen3, _gen2:gen3, _stage:stageCfg, _items:PH.OBJ, _themes:{}, _scenes:SCN,
    render(st){
      const m = S(), sc = m.sc;
      const items = '';   /* 물건은 그림 속에 원래 있어서 따로 그리지 않는다 */
      const night = m.night ? `<defs><radialGradient id="hdLg"><stop offset="0" stop-color="#000"/><stop offset=".72" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
        <mask id="hdMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle id="hdLight" cx="${m.light[0]}" cy="${m.light[1]}" r="${LIGHT_R}" fill="url(#hdLg)"/></mask></defs>
        <g id="hdNight" class="hd-night"><rect width="${W}" height="${H}" fill="#0B0A2A" fill-opacity=".985" mask="url(#hdMask)"/><circle id="hdGlow" cx="${m.light[0]}" cy="${m.light[1]}" r="${LIGHT_R - 4}" fill="none" stroke="#FFE9A0" stroke-width="2" stroke-dasharray="5 6" opacity=".55"/></g>` : '';
      st.innerHTML = `<div class="ng-hidden">
        <div class="hud-row">
          <div class="hchip" aria-label="찾은 물건"><span class="hv">${ICO.glass}<b id="hdFound">0</b><small>/${totalOf(m)}</small></span><em>찾은 물건</em></div>
          <div class="hchip time" id="hdTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="hdTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="hdHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="hd-rules" aria-label="켜진 규칙">${m.boss ? '<span class="hd-chipr boss">대장 판</span>' : ''}${m.mj.map(k => `<span class="hd-chipr mj" aria-label="${CONC.info[k].name}">${RULE_SHORT[k] || CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="hd-chipr tw" aria-label="${CONC.twInfo[m.tw].name}">${RULE_SHORT[m.tw] || CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="hbar hd-tbar" id="hdBarWrap"><i id="hdBar"></i></div>
        <div class="hd-row"><div class="hlives" id="hdLives" role="img" hidden></div><div class="hd-msg" id="hdMsg">${playMsg()}</div></div>
        <div class="hd-wrap in" id="hdWrap">
          <svg id="hdSvg" class="hd-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${sc.T.name} 장면: 숨은 물건을 찾아 누르세요">
            <g class="hd-bg">${sc.bg}</g><g class="hd-items">${items}</g><g class="hd-top">${sc.top}</g>${night}<g id="hdMarks"></g>
          </svg>
          <div class="hd-zoom"${m.night ? ' hidden' : ''}><button id="hdZin" aria-label="확대">${ICO.zin}</button><button id="hdZout" aria-label="축소" disabled>${ICO.zout}</button></div>
          <div class="hd-zlv" id="hdZlv" aria-live="polite" hidden></div>
          <div class="hd-cool" id="hdCool" aria-hidden="true"><b>잠깐!</b><i><s id="hdCoolBar"></s></i></div>
        </div>
        <div class="hd-list" id="hdList" role="list" aria-label="찾을 물건"></div>
      </div>`;
      m.items.forEach(o => { m.itEl[o.i] = document.querySelector(`.ng-hidden .hd-it[data-i="${o.i}"]`); });
      drawList(); wire(); hud(); layout(); applyView(); zoomTip();
      T_(() => { const w = $('#hdWrap'); if(w) w.classList.remove('in'); }, 700);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.h; return m ? m.found / Math.max(1, totalOf(m)) : 0; },
    lossText(){ const m = G.h; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `물건 ${m.found}/${totalOf(m)}개를 찾았어요.`; },
    score(){
      const m = G.h, sec = Math.max(0, Math.min(G.limit, m.sec || elapsed()));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - 40 * m.hints - 15 * m.misses);
      return { base:500, time, extra, rows:['물건 모두 찾기', '시간 보너스 (' + mmss(sec) + ')', `힌트 ${m.hints} · 실수 ${m.misses}`] };
    },
    stars(){ const m = G.h; return m.hints === 0 && m.misses <= 1 ? 3 : m.hints <= 1 && m.misses <= 4 ? 2 : 1; },
    css:`
body[data-mode="hidden"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.28) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#FFF1DC 0%,#FFD9A8 55%,#F8BE7C 100%) fixed}
.ng-hidden{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-hidden .hud-row{margin:0}
.ng-hidden .hchip.time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-hidden .hchip.time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-hidden .hchip.time.hurry em{color:#fff}
.ng-hidden .hchip:is(button){-webkit-tap-highlight-color:transparent}
.ng-hidden .hd-tbar{margin:8px 0 0; height:10px}
.ng-hidden .hd-tbar > i{width:100%; transform-origin:left center; transition:none; background:linear-gradient(180deg,#FFD08A,#F08A24)}
.ng-hidden .hd-tbar.hurry > i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-hidden .hd-row{display:flex; align-items:center; gap:8px; width:100%; height:36px}
.ng-hidden .hlives{flex:none}
.ng-hidden .hlives[hidden]{display:none}
.ng-hidden .hd-msg{flex:1; min-width:0; overflow:hidden; height:36px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#7A4310; white-space:nowrap}
.ng-hidden .hd-msg span{overflow:hidden; text-overflow:ellipsis}
.ng-hidden .hd-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px; flex:none}
.ng-hidden .hd-msg b.boss{color:#FFE27A}
.ng-hidden .hd-msg b.bad{color:#FF8A8F}
.ng-hidden .hd-msh{display:inline-flex; width:22px; height:22px; flex:none}
.ng-hidden .hd-msh svg{width:100%; height:100%}
.ng-hidden .hd-cn:empty{min-height:13px}
.ng-hidden .hd-msg.hd-pop, .ng-hidden .hd-msg.hd-win{animation:hidden-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-hidden .hd-msg.hd-win b{font-size:24px; color:#FFE27A}
@keyframes hidden-in{from{transform:scale(.6); opacity:0}}
.ng-hidden .hd-wrap{position:relative; flex:none; border-radius:18px; overflow:hidden; border:3px solid #1A0F45; background:#fff;
  box-shadow:0 5px 0 #1A0F45, 0 14px 22px rgba(120,60,10,.22); transition:filter .2s}
.ng-hidden .hd-wrap.in{animation:hidden-pop .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes hidden-pop{from{transform:scale(.9); opacity:0}}
.ng-hidden .hd-svg{display:block; width:100%; height:100%; touch-action:none; cursor:crosshair}
.ng-hidden .hd-wrap.zoomed .hd-svg{cursor:grab}
.ng-hidden .hd-it.got{opacity:1}
.ng-hidden .hd-mark circle{fill:none}
.ng-hidden .hd-svg{--zs:1}
.ng-hidden .hd-mark .o{stroke:#fff; stroke-width:calc(9px * var(--zs))}
.ng-hidden .hd-mark .c{stroke:#FF2E7E; stroke-width:calc(4.6px * var(--zs))}
.ng-hidden .hd-yang{pointer-events:none}
.ng-hidden .hd-yang .j{transform-box:fill-box; transform-origin:50% 100%}
.ng-hidden .hd-yang.hop .j{animation:hidden-hop .75s cubic-bezier(.3,.7,.4,1)}
@keyframes hidden-hop{0%{transform:none} 18%{transform:translateY(0) scale(1.08,.9)} 45%{transform:translateY(-22%) scale(.95,1.06)} 70%{transform:translateY(0) scale(1.06,.93)} 85%{transform:translateY(-6%)} 100%{transform:none}}
.ng-hidden .hd-ph.yg{background-size:auto 119.05%; background-position:right center}   /* 정사각 칸에 얼굴 칸(336 폭)만 보이게: 높이 400 중 336만 */
.ng-hidden .hd-mark circle{stroke-dasharray:220; stroke-dashoffset:220; animation:hidden-draw .35s ease-out forwards}
.ng-hidden .hd-mark .p{animation:hidden-ring .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes hidden-ring{from{transform:scale(1.7); opacity:.2}}
.ng-hidden .hd-mark.miss .c{stroke:#2F7BFF; stroke-dasharray:6 5; stroke-dashoffset:0; animation:none}
.ng-hidden .hd-mark.miss .o{stroke-dasharray:none; stroke-dashoffset:0; animation:none}
@keyframes hidden-draw{to{stroke-dashoffset:0}}
.ng-hidden .hd-own path{fill:none; stroke-linejoin:round; stroke-dasharray:none; stroke-dashoffset:0}
.ng-hidden .hd-own .k{stroke:#1A0F45; stroke-width:calc(11px * var(--zs))}
.ng-hidden .hd-own .o{stroke:#fff; stroke-width:calc(8.6px * var(--zs))}
.ng-hidden .hd-own .c{stroke-width:calc(4.6px * var(--zs))}
.ng-hidden .hd-own.tent .c{stroke-dasharray:7 5}
.ng-hidden .hd-own.tent .k, .ng-hidden .hd-own.tent .o{opacity:.55}
.ng-hidden .hd-tag{pointer-events:none; animation:hidden-tag 1.2s ease-out forwards}
.ng-hidden .hd-tag text{font-family:var(--disp); font-weight:700}
@keyframes hidden-tag{0%{opacity:0} 12%,75%{opacity:1} 100%{opacity:0}}
.ng-hidden .hd-chip.own{background:#fff; background:color-mix(in srgb, var(--oc) 24%, #fff); border-color:var(--oc); box-shadow:0 2px 0 #1A0F45}
.ng-hidden .hd-chip.own .hd-cn{color:#1A0F45; text-decoration:line-through; text-decoration-thickness:2px; text-decoration-color:var(--oc)}
.ng-hidden .hd-chip em.sh{padding:1px; background:#fff; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-color:var(--oc)}
.ng-hidden .hd-chip em.sh svg{width:13px; height:13px; display:block}
.ng-hidden .hd-x path{fill:none; stroke-linecap:round}
.ng-hidden .hd-x .o{stroke:#fff; stroke-width:7}
.ng-hidden .hd-x .c{stroke:#E5484D; stroke-width:4}
.ng-hidden .hd-x{animation:hidden-fade .65s ease-in forwards}
@keyframes hidden-fade{0%,60%{opacity:1} 100%{opacity:0}}
.ng-hidden .hd-hint .f{fill:#FFE27A; fill-opacity:.28}
.ng-hidden .hd-hint .c{fill:none; stroke:#FFD23F; stroke-width:calc(4px * var(--zs)); stroke-dasharray:calc(8px * var(--zs)) calc(6px * var(--zs))}
.ng-hidden .hd-hint{animation:hidden-hint 2.6s ease-in-out forwards}
@keyframes hidden-hint{0%{opacity:0} 12%{opacity:1} 30%{opacity:.6} 45%{opacity:1} 80%{opacity:1} 100%{opacity:0}}
.ng-hidden .hd-night{transition:opacity .6s}
.ng-hidden .hd-night.off{opacity:0}
.ng-hidden .hd-zoom{position:absolute; right:8px; bottom:8px; display:flex; flex-direction:column; gap:7px}
.ng-hidden .hd-zoom[hidden]{display:none}
.ng-hidden .hd-zlv{position:absolute; right:12px; bottom:136px; min-width:44px; padding:3px 7px; border-radius:99px; background:rgba(26,15,69,.82); color:#fff; font-family:var(--heavy); font-size:14px; line-height:1.15; text-align:center; pointer-events:none; font-variant-numeric:tabular-nums}
.ng-hidden .hd-zlv[hidden]{display:none}
.ng-hidden .hd-img{image-rendering:auto}
.ng-hidden .hd-zoom button{width:56px; height:56px; padding:9px; border-radius:50%; border:2.5px solid #1A0F45; background:#FFFFFF; box-shadow:0 3px 0 #1A0F45; cursor:pointer; -webkit-tap-highlight-color:transparent}
.ng-hidden .hd-zoom button svg{width:100%; height:100%; display:block}
.ng-hidden .hd-zoom button:active{transform:translateY(2px); box-shadow:0 1px 0 #1A0F45}
.ng-hidden .hd-zoom button:disabled{opacity:1; background:#E4DEF2; border-color:#1A0F45; cursor:default}   /* 그림 위에서도 단추가 보이게: 투명하게 하지 않고 회보라 바탕 + 아이콘만 흐리게 */
.ng-hidden .hd-zoom button:disabled svg{opacity:.45}
.ng-hidden .hd-ztip{position:absolute; right:74px; bottom:76px; padding:7px 11px; border-radius:12px; background:#1A0F45; color:#fff; font-family:var(--disp); font-size:14px; line-height:1.25; text-align:center; pointer-events:none; box-shadow:0 3px 0 rgba(0,0,0,.2); animation:hidden-in .35s cubic-bezier(.2,1.5,.4,1); transition:opacity .3s}
.ng-hidden .hd-ztip::after{content:''; position:absolute; right:-7px; top:50%; margin-top:-7px; border:7px solid transparent; border-right:0; border-left-color:#1A0F45}
.ng-hidden .hd-ztip.off{opacity:0}
.ng-hidden .hd-cool{position:absolute; left:50%; top:10px; transform:translateX(-50%) scale(.6); opacity:0; pointer-events:none; transition:opacity .15s, transform .2s cubic-bezier(.2,1.5,.4,1)}
.ng-hidden .hd-cool b{display:block; font-family:var(--heavy); font-weight:400; font-size:17px; color:#fff; background:#E5484D; border:2.5px solid #1A0F45; border-radius:99px; padding:5px 13px; box-shadow:0 3px 0 #1A0F45; white-space:nowrap; font-variant-numeric:tabular-nums}
.ng-hidden .hd-cool i{display:block; height:6px; margin:5px 10px 0; border-radius:99px; background:rgba(26,15,69,.35); overflow:hidden}
.ng-hidden .hd-cool s{display:block; height:100%; background:#FFE27A; transform-origin:left center}
.ng-hidden .hd-wrap.cool .hd-cool{opacity:1; transform:translateX(-50%) scale(1)}
.ng-hidden .hd-wrap.cool .hd-svg{filter:saturate(.55) brightness(.92)}
.ng-hidden .hd-wrap.cleared{animation:hidden-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes hidden-cheer{40%{transform:scale(1.03)}}
.ng-hidden .hd-list{display:flex; gap:6px; width:100%; margin:4px 0 0; padding:9px 2px 6px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity}
.ng-hidden .hd-list::-webkit-scrollbar{display:none}
.ng-hidden .hd-list.more{-webkit-mask-image:linear-gradient(90deg,#000 82%,transparent); mask-image:linear-gradient(90deg,#000 82%,transparent)}
.ng-hidden .hd-chip{position:relative; flex:0 0 76px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; height:82px; padding:3px 1px 3px; border-radius:12px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45; min-width:0; scroll-snap-align:start}
.ng-hidden .hd-ci{width:38px; height:38px; flex:none; display:block}
.ng-hidden .hd-ph{display:block; width:100%; height:100%; border-radius:8px; background-size:400% 300%; background-repeat:no-repeat; background-color:#fff; box-shadow:0 0 0 1.5px #1A0F45}
.ng-hidden .hd-ph.sh{filter:brightness(0) opacity(.72)}
.ng-hidden .hd-ci svg{width:100%; height:100%; display:block; overflow:visible}
.ng-hidden .hd-cn{max-width:100%; font-family:var(--disp); font-size:13px; line-height:1.12; color:#4A2A10; white-space:normal; word-break:keep-all; overflow-wrap:anywhere; text-align:center; letter-spacing:-.5px; padding:0 2px; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden}   /* 13px · 두 줄까지(말줄임 없이 낱말 단위로 줄바꿈) */
.ng-hidden .hd-chip em{position:absolute; top:-8px; right:-3px; font-style:normal; font-family:var(--heavy); font-size:13px; line-height:1; padding:3px 5px; border-radius:99px; background:#F08A24; color:#fff; border:2px solid #1A0F45}
.ng-hidden .hd-chip em.ok{background:#2BB673}
.ng-hidden .hd-chip.done{background:#E3FAEC}
.ng-hidden .hd-chip.done em{background:#2BB673}
.ng-hidden .hd-chip.done .hd-cn{color:#2B8A55; text-decoration:line-through; text-decoration-thickness:2px}
.ng-hidden .hd-chip.done .hd-ci{opacity:.55}
.ng-hidden .hd-chip.cur{background:#FFF6C8; animation:hidden-cur 1s ease-in-out infinite alternate}
.ng-hidden .hd-chip.wait{opacity:.55}
@keyframes hidden-cur{to{box-shadow:0 2px 0 #1A0F45, 0 0 10px 3px rgba(255,200,60,.85)}}
.ng-hidden .hd-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-hidden .hd-chipr{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#6A3A10; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-hidden .hd-chipr.mj{background:#FFF0DC; color:#9A4A08}
.ng-hidden .hd-chipr.tw{background:#EFE7FF; color:#5B3FB5}
.ng-hidden .hd-chipr.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
@media (max-width:370px){ .ng-hidden .hd-msg b{font-size:18px} .ng-hidden .hd-chipr{font-size:13px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-hidden .hd-yang.hop .j{animation:none} .ng-hidden .hd-mark circle{animation:none; stroke-dashoffset:0} .ng-hidden .hd-wrap.in, .ng-hidden .hd-chip.cur{animation:none} }
`,
    sounds:{
      hdFind(o){ const n = Math.min(8, o.n || 0); aBell({ f:penta(n + 4, 72), t:0, d:.6, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.08, d:.7, v:.07, idx:1.2, rev:.4 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.12, v:.03 }); },
      hdMiss(){ aTone({ f:330, f2:200, type:'triangle', d:.22, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      hdHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      hdLight(){ aWhoosh({ f:900, f2:2400, a:.02, d:.12, v:.03 }); },
      hdZoom(o){ aTone({ f:o.out ? 760 : 620, f2:o.out ? 560 : 900, type:'triangle', d:.08, v:.04 }); },
      hdTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      hdTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ hdTick:250, hdFind:60, hdLight:80, hdZoom:60 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 같은 장면(같은 씨앗)에서 누가 먼저 다 찾나. AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
/* 대전 v3 선점(docs/21 WP6 3번): 2~5명이 같은 장면에서 물건 6개 + 양이 = 7개를 먼저 누른 사람이 차지, 105초(느긋하게 210초), 많이 차지한 순
   (같으면 실수 적은 순 → 마지막 차지가 이른 순, 엔진 기본). 컴퓨터 상대는 계단마다 남은 물건 하나를 차지(평균 약 13초 간격) */
Object.assign(NG.hidden, {
  duelKind:'shared', duelMax:5, duelPace:[75, 1],
  duelHow:'같은 그림을 같이 봐요 · 먼저 누른 사람이 물건을 차지해요',
  duelStat:{ unit:'개', get:() => ({ v:G.h.found, t:G.h.items.length, mis:G.h.misses }) },
  duelCfg(o){
    const d = o && ['easy', 'normal', 'hard'].includes(o.diff) ? o.diff : 'normal';
    return Object.assign({}, NG.hidden.levels[d], { items:6, limit:105, hints:1, avoid:(o && o.avoid) || [] });
  },
  duelAi(rng, o){
    const lim = (o && o.cfg && o.cfg.limit) || 105, slow = o && o.pace === 's' ? 1.5 : 1;
    const T = Math.min(lim * .95, 4.5 + 6 * 13 * (0.8 + rng() * 0.45) * slow);
    return { ok:true, T, sc:0, fail:1 };
  },
  duelAvoidKey:() => (G && G.id === 'hidden' && G.h && G.h.sc && G.h.sc.v2 ? G.h.sc.key : null)
});
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.hidden.scene = { kind:'motes', colors:['#FFFFFF', '#FFE2B8', '#FFF3B0'], density:1 };
