/* 거꾸로 화살표 */
/* ===== 거꾸로 화살표 (arrow) · 하루퍼즐 리그 순발력 게임 =====
   가운데 둥근 표지판에 화살표가 하나씩 "툭" 나온다. 파랑 = 그 방향, 빨강(꼬리에 되돌이 표시) = 반대 방향으로 민다.
   한 판 = 문제 N개(시간 대신 개수). 문제마다 판단 시간(창)이 있고, 판 안에서 뒤로 갈수록 창이 짧아지고 함정이 늘어난다.
   막 누르면 손해: 틀리면 기회 별 −1, 0.25초 안에 4번 넘게 누르면 0.5초 잠금. 소리 없이도 색·표시·글자만으로 똑같이 할 수 있다.
   문제 내용은 모두 rng(씨앗 난수)로만 만든다. 효과·소리는 보이기만(try로 감쌈). 기획서 docs/20. */
NG.arrow = (() => {
  const DIRS = ['위', '오른쪽', '아래', '왼쪽'];          /* 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽 */
  const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const opp = d => (d + 2) % 4;
  const HOSTS = ['whale', 'frog', 'tiger', 'owl', 'fox'];  /* 챕터 진행자 */
  const HOST_NAME = { whale:'고래', frog:'개구리', tiger:'호랑이', owl:'부엉이', fox:'여우' };
  /* 진행자 말투(챕터마다 다른 캐릭터): 첫마디 · 실수했을 때 · 끝났을 때 */
  const TALK = {
    whale:{ hi:'파랑은 그대로, 빨강은 반대로!', oops:'괜찮아요, 다음 거!', end:'다 했어요!' },
    frog:{ hi:'개굴! 빨간 건 거꾸로야!', oops:'개굴, 다시 집중!', end:'개굴개굴, 끝!' },
    tiger:{ hi:'어흥! 침착하게 보고 밀어!', oops:'어흥, 괜찮아!', end:'어흥! 해냈어!' },
    owl:{ hi:'부엉, 먼저 보고 그다음 밀기!', oops:'부엉, 천천히 봐요', end:'부엉, 훌륭해요!' },
    fox:{ hi:'자, 마지막 탑이야. 집중!', oops:'괜찮아, 다음!', end:'최고야!' }
  };
  /* 챕터 색(표지판 테두리 네온·배경). 빨강·파랑과 헷갈리지 않는 색만, 눈이 편하게 낮은 밝기 */
  const TINT = [
    { ring:'#6FD6E8', sky1:'#121838', sky2:'#1B2350', sky3:'#26305E' },   /* 표지판 길: 청록 */
    { ring:'#76E0A6', sky1:'#10202A', sky2:'#17303A', sky3:'#1F3C44' },   /* 미로 정원: 초록 */
    { ring:'#C3A2FF', sky1:'#171236', sky2:'#221A4C', sky3:'#2D225C' },   /* 거울 터널: 보라 */
    { ring:'#FFC27A', sky1:'#1A1630', sky2:'#28203F', sky3:'#35294A' },   /* 바람개비 언덕: 노을 */
    { ring:'#FFE07A', sky1:'#141634', sky2:'#1E2148', sky3:'#2A2B56' }    /* 나침반 탑: 금빛 */
  ];

  /* ===== 개념(솔로) ===== */
  const CONC = {
    order:['side', 'word', 'stop', 'pair'],
    info:{
      side:{ name:'엉뚱한 자리', desc:'화살표가 원판 가운데가 아니라 가장자리에 나와요. 자리에 속지 말고 화살표 방향(과 색)을 따라요.' },
      word:{ name:'글자 화살표', desc:'화살표 대신 "왼쪽" 같은 글자가 나와요. 노란 글자는 뜻대로, 빨간 글자(되돌이 표시)는 반대로! 글자가 화살표 모양 안에 있어도 모양 말고 글자를 따라요.' },
      stop:{ name:'정지 표지', desc:'회색 화살표(멈춤 표시)가 나오면 밀지 말고 가만히 기다려요. 참으면 정답이고, 밀면 실수예요.' },
      pair:{ name:'두 개 중 하나', desc:'화살표 두 개가 함께 나와요. 금색 테두리와 "이거" 표시가 붙은 쪽만 따라요.' }
    },
    twists:['flash', 'ghost', 'tight'],
    twInfo:{ ghost:{ name:'순간', desc:'화살표가 0.35초만 보이고 사라져요. 판단 시간은 그대로예요. 눈에 담아 두고 밀어요!' } }
  };
  const RULE_TIP = { side:'자리 말고 방향', word:'글자를 따라요', stop:'회색은 가만히', pair:'금색 쪽만', flash:'판단 시간이 짧아요', ghost:'잠깐만 보여요', tight:'기회 2번' };

  /* ===== 난이도 ===== */
  const LEVELS = {
    easy:{ N:20, w0:2.6, w1:2.0, trap:.15, limit:0 },
    normal:{ N:25, w0:2.2, w1:1.5, trap:.25, side:true, limit:0 },
    hard:{ N:30, w0:1.9, w1:1.2, trap:.35, side:true, stop:true, limit:0 }
  };
  function stageCfg(n){
    const p = planOf('arrow', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let N = Math.min(32, 12 + 2 * (c - 1) + Math.round(6 * (k - 1) / 9));
    if(k === 9) N -= 2;
    if(p.boss) N += 6;
    let w0 = 2.6 * Math.pow(.94, c - 1);
    w0 *= k === 5 ? .9 : p.boss ? .85 : k === 9 ? 1.15 : (k === 1 || k === 6) ? 1.08 : 1;
    if(has('word')) w0 *= 1.12;
    if(has('pair')) w0 *= 1.15;
    if(tw === 'flash') w0 *= .8;
    w0 = Math.max(1.12, w0);
    const w1 = Math.max(.9, w0 * .8);
    let trap = Math.min(.45, .10 + .075 * (c - 1));
    if(p.boss) trap += .10; else if(k === 5) trap += .05; else if(p.easy) trap -= .04;
    trap = Math.max(.06, trap);
    return { N, w0:+w0.toFixed(2), w1:+w1.toFixed(2), trap:+trap.toFixed(3), limit:0,
      side:has('side'), word:has('word'), stop:has('stop'), pair:has('pair'), ghost:tw === 'ghost', lives:tw === 'tight' ? 2 : 3,
      focus:p.introKind === 'major' ? p.intro : null, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, c, n };
  }

  /* ===== 문제 만들기(rng만) =====
     문제 = { kind:'arrow'|'word'|'pair', dir, col:'b'|'r'|'g', pos:'c'|0~3, w, wc:'y'|'r', shape, items:[…], lit, lay, ans:0~3|-1(가만히), win(초) } */
  function gen(cfg, rng){
    const N = cfg.N, out = [];
    const pick = a => a[Math.floor(rng() * a.length)];
    const ansOf = (col, d) => col === 'b' ? d : col === 'r' ? opp(d) : -1;
    for(let i = 0; i < N; i++){
      const f = N > 1 ? i / (N - 1) : 0;
      const trap = Math.min(.7, cfg.trap * (.6 + .8 * f));
      const pRed = Math.max(.25, Math.min(.62, .28 + trap * .7));
      const pStop = cfg.stop ? Math.min(.3, (cfg.focus === 'stop' ? .2 : .1) + trap * .25) : 0;
      const colOf = () => rng() < pStop ? 'g' : rng() < pRed ? 'r' : 'b';
      /* 종류 고르기: 새 규칙 소개 판은 그 규칙이 더 자주 */
      const ks = [['arrow', 1]];
      if(cfg.word) ks.push(['word', cfg.focus === 'word' ? 1.6 : .75]);
      if(cfg.pair) ks.push(['pair', cfg.focus === 'pair' ? 1.6 : .75]);
      let kind = 'arrow';
      if(i > 0){ const tot = ks.reduce((s, x) => s + x[1], 0); let r = rng() * tot; for(const [k, wgt] of ks){ r -= wgt; if(r <= 0){ kind = k; break; } } }
      let q = null;
      for(let tries = 0; tries < 4; tries++){
        if(kind === 'arrow'){
          const col = i === 0 ? 'b' : colOf(), dir = Math.floor(rng() * 4), ans = ansOf(col, dir);
          let pos = 'c';
          if(cfg.side && i > 0 && rng() < (cfg.focus === 'side' ? .85 : .7)){
            /* 위치 함정: 파랑은 반대쪽 가장자리, 빨강은 가리키는 쪽 가장자리(눈이 끌리는 쪽) */
            pos = rng() < trap + .3 ? (col === 'r' ? dir : opp(dir)) : Math.floor(rng() * 4);
          }
          q = { kind, col, dir, pos, ans };
        } else if(kind === 'word'){
          const w = Math.floor(rng() * 4), wc = rng() < pRed * .8 ? 'r' : 'y', ans = wc === 'y' ? w : opp(w);
          let shape = null;
          if(rng() < .3 + trap){ shape = rng() < .5 ? opp(ans) : (ans + (rng() < .5 ? 1 : 3)) % 4; }   /* 모양 함정: 글자와 다른 쪽을 가리키는 화살표 틀 */
          const pos = cfg.side && rng() < .35 ? Math.floor(rng() * 4) : 'c';
          q = { kind, w, wc, shape, pos, ans };
        } else {
          const lay = rng() < .5 ? 'h' : 'v', lit = rng() < .5 ? 0 : 1;
          const a = { col:colOf(), dir:Math.floor(rng() * 4) };
          let b = { col:rng() < pRed ? 'r' : 'b', dir:Math.floor(rng() * 4) };
          const la = ansOf(a.col, a.dir);
          for(let t = 0; t < 3 && ansOf(b.col, b.dir) === la; t++) b.dir = Math.floor(rng() * 4);   /* 다른 쪽(가짜)은 다른 답이 되게 */
          /* 세 번 다시 뽑아도 같으면 한 칸 돌린다(rng 안 씀 → 다른 판은 그대로). 가짜를 따라 민 것이 정답이 되는 일 없게 */
          for(let t = 0; t < 3 && ansOf(b.col, b.dir) === la; t++) b.dir = (b.dir + 1) % 4;
          const items = lit === 0 ? [a, b] : [b, a];
          q = { kind, lay, lit, items, ans:ansOf(items[lit].col, items[lit].dir) };
        }
        /* 같은 답이 4번 넘게 이어지지 않게 */
        const run = out.length >= 3 && out.slice(-3).every(x => x.ans === q.ans);
        if(!run) break;
      }
      q.win = +(cfg.w0 + (cfg.w1 - cfg.w0) * f + (q.kind === 'word' ? .2 : q.kind === 'pair' ? .25 : 0)).toFixed(3);
      q.trap = q.ans === -1 || (q.kind === 'arrow' && (q.col === 'r' || (q.pos !== 'c' && q.pos !== q.ans))) || (q.kind === 'word' && (q.wc === 'r' || q.shape != null)) || q.kind === 'pair';
      out.push(q);
    }
    return out;
  }

  /* ===== 그림: 3D 비닐 장난감 화살표(공용 TOY 조명 필터) ===== */
  const COLS = { b:'#2F7BFF', r:'#FF4D5E', g:'#7F889F' };
  const ARW = 'M50 9L89 48H67V89H33V48H11Z';
  const rot = (x, y, d) => { const a = d * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); return [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c]; };
  const UTURN = (x, y, k = 1, c = '#E0334A') => `<path d="M${x + 6.8 * k} ${y + 1.5 * k}A${7 * k} ${7 * k} 0 1 1 ${x + 3.2 * k} ${y - 6.2 * k}" fill="none" stroke="${c}" stroke-width="${3.4 * k}" stroke-linecap="round"/><path d="M${x + .2 * k} ${y - 11 * k}l${7.4 * k} ${4.4 * k}-${6.6 * k} ${4.6 * k}z" fill="${c}"/>`;
  const STOPB = (x, y) => { const r = 13, pts = Array.from({ length:8 }, (_, i) => { const a = (i * 45 + 22.5) * Math.PI / 180; return (x + Math.cos(a) * r).toFixed(1) + ',' + (y + Math.sin(a) * r).toFixed(1); }).join(' ');
    return `<g filter="url(#ps)"><polygon points="${pts}" fill="#FFFFFF"/></g><rect x="${x - 5.6}" y="${y - 6.5}" width="4" height="13" rx="2" fill="#2B3352"/><rect x="${x + 1.6}" y="${y - 6.5}" width="4" height="13" rx="2" fill="#2B3352"/>`; };
  function arrowBody(col, d){
    const c = COLS[col], [hx, hy] = rot(42, 34, d), [bx, by] = rot(50, 72, d);
    let s = `<g filter="url(#pb)"><path d="${ARW}" transform="rotate(${d * 90} 50 50)" fill="${c}" stroke="${c}" stroke-width="11" stroke-linejoin="round"/></g>${TOY.GL(hx, hy, 9, 5)}`;
    if(col === 'r') s += `<g filter="url(#ps)"><circle cx="${bx}" cy="${by}" r="14" fill="#FFFFFF"/></g>${UTURN(bx, by)}`;
    if(col === 'g') s += STOPB(bx, by);
    return s;
  }
  const svgDoc = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${TOY.DEFS}</defs>${body}</svg>`;
  const svgSrc = body => 'data:image/svg+xml,' + encodeURIComponent(svgDoc(body)).replace(/'/g, '%27');
  const SPR = {};
  const spr = (col, d) => { const k = col + d; return SPR[k] || (SPR[k] = svgSrc(arrowBody(col, d))); };
  const shapeSrc = d => { const k = 's' + d; return SPR[k] || (SPR[k] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${ARW}" transform="rotate(${d * 90} 50 50)" fill="rgba(255,255,255,.08)" stroke="rgba(235,240,255,.6)" stroke-width="3.2" stroke-dasharray="7 5" stroke-linejoin="round"/></svg>`)); };
  /* 폰 성능: 그린 뒤 한 번 PNG로 구워 바꾼다(효과처럼 보이기만, 실패하면 SVG 그대로) */
  let BAKED = false;
  function bake(){
    if(BAKED) return; BAKED = true;
    try{
      ['b', 'r', 'g'].forEach(col => [0, 1, 2, 3].forEach(d => {
        const k = col + d, im = new Image();
        im.onload = () => { try{ const cv = document.createElement('canvas'); cv.width = cv.height = 240; const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 240, 240); const u = cv.toDataURL('image/png'); if(u.length > 2000) SPR[k] = u; }catch(_){} };
        im.src = spr(col, d);
      }));
    }catch(_){}
  }

  /* ===== 화면 조각 ===== */
  const KEY_ARW = d => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 7L33 20H25V33H15V20H7Z" transform="rotate(${d * 90} 20 20)" fill="currentColor" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
  const ICO = {
    sign:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#2A3270" stroke="#1A0F45" stroke-width="2"/><path d="M12 5.5l5 5h-3v7h-4v-7H7z" fill="#5C9BFF"/></svg>',
    combo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L5 13.5h5.5L9 22l9.5-12.5H13z" fill="#FFD45A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  const HUB = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="currentColor"/><path d="M20 3l4 5h-8zM37 20l-5 4v-8zM20 37l-4-5h8zM3 20l5-4v8z" fill="currentColor" opacity=".7"/></svg>';
  const slotPos = { c:[50, 50], 0:[50, 21], 1:[79, 50], 2:[50, 79], 3:[21, 50] };

  function itemHtml(q){
    /* data-*: 보이는 그림 그대로의 정보(색·방향·글자). 판정 점검 도구가 정답 계산과 따로 화면만 보고 답을 맞혀 보는 데 쓴다 */
    const at = (p, cls, inner, sz, da) => `<div class="ar-slot ${cls}" style="left:${p[0]}%;top:${p[1]}%;--s:${sz}" ${da}>${inner}</div>`;
    if(q.kind === 'arrow'){
      const sz = q.pos === 'c' ? .58 : .36;
      return at(slotPos[q.pos], 'arw', `<img class="ar-img" src="${spr(q.col, q.dir)}" alt="" draggable="false">`, sz, `data-c="${q.col}" data-d="${q.dir}"`);
    }
    if(q.kind === 'word'){
      const side = q.pos !== 'c';
      const inner = `${q.shape != null ? `<img class="ar-shape" src="${shapeSrc(q.shape)}" alt="" draggable="false">` : ''}<span class="ar-plate ${q.wc}">${q.wc === 'r' ? `<i class="ar-rev"><svg viewBox="-12 -14 24 26">${UTURN(0, 0, 1, '#E0334A')}</svg></i>` : ''}<b>${DIRS[q.w]}</b></span>`;
      return at(slotPos[q.pos], 'wrd' + (side ? ' side' : '') + (q.shape != null ? ' shp' : ''), inner, side ? .5 : .78, `data-w="${q.w}" data-wc="${q.wc}"${q.shape != null ? ` data-shape="${q.shape}"` : ''}`);
    }
    const P = q.lay === 'h' ? [[27, 50], [73, 50]] : [[50, 27], [50, 73]];
    return q.items.map((it, j) => at(P[j], 'arw pr' + (j === q.lit ? ' lit' : ' dim'), `${j === q.lit ? '<em class="ar-tag">이거</em>' : ''}<img class="ar-img" src="${spr(it.col, it.dir)}" alt="" draggable="false">`, .4, `data-c="${it.col}" data-d="${it.dir}"`)).join('');
  }
  function itemSay(q){   /* 화면 읽기 프로그램용 설명(보이지 않음) */
    const cn = { b:'파란', r:'빨간', g:'회색' };
    if(q.kind === 'arrow') return `${cn[q.col]} 화살표, ${DIRS[q.dir]}`;
    if(q.kind === 'word') return `${q.wc === 'y' ? '노란' : '빨간'} 글자, ${DIRS[q.w]}`;
    const L = q.items[q.lit]; return `두 개 중 표시된 것: ${cn[L.col]} 화살표, ${DIRS[L.dir]}`;
  }
  function whyText(q, d){   /* 틀린 이유(글자로 보여 줌) */
    if(d == null) return '시간 초과!';
    if(q.ans === -1) return '회색은 가만히!';
    if(q.kind === 'pair') return '금색 테두리 쪽만!';
    if(q.kind === 'word') return q.shape != null && d === q.shape ? '모양 말고 글자!' : q.wc === 'r' ? '빨간 글자는 반대로!' : '노란 글자는 뜻대로!';
    if(q.pos !== 'c' && d === q.pos && q.pos !== q.ans) return '자리 말고 방향!';
    return q.col === 'r' ? '빨강은 반대로!' : '파랑은 그대로!';
  }

  /* ===== 진행 ===== */
  const GAP_OK = .42, GAP_BAD = .4;   /* 판정 뒤 다음 화살표까지(판단 시간에 안 들어감). 실수는 0.4초 안에 바로 다음으로 */
  const S = () => G && G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m) fn(); }, ms); m.timers.add(id); return id; };
  const $a = id => document.getElementById(id);
  const safe = fn => { try{ fn(); }catch(_){} };

  function say(html, cls){ const e = $a('arSay'); if(!e) return; e.className = 'ar-say ' + (cls || ''); e.innerHTML = html; }
  function hostMood(mood, ms){
    const m = S(), im = $a('arHost'); if(!m || !im) return;
    im.src = toySrc(m.host, mood || ''); clearTimeout(m.moodT);
    /* 표정이 바뀌는 순간만 한 번 움직임(기쁨 = 깡충, 슬픔 = 움츠림). 계속 흔들리지 않음 */
    safe(() => { const av = im.parentNode; av.classList.remove('hop', 'droop'); if(mood === 'joy' || mood === 'sad'){ void av.offsetWidth; av.classList.add(mood === 'joy' ? 'hop' : 'droop'); } });
    if(mood && ms) m.moodT = T(() => { const e = $a('arHost'); if(e) e.src = toySrc(m.host, ''); }, ms);
  }
  /* 손가락 자취(보이기만): 화면을 미는 동안 손끝을 따라오는 짧은 빛줄기. 판정에는 쓰지 않음 */
  const TRAIL = { pts:[], raf:0, on:false };
  function trailDraw(){
    TRAIL.raf = 0;
    safe(() => {
      const p = $a('arTrailP'), c = $a('arTrailC'), h = $a('arTrailH'); if(!p) return;
      const dOf = pts => pts.length ? 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') : '';
      p.setAttribute('d', dOf(TRAIL.pts.slice(-16))); if(c) c.setAttribute('d', dOf(TRAIL.pts.slice(-6)));   /* 꼬리는 가늘고 길게, 손끝 쪽은 굵게 */
      const e = TRAIL.pts[TRAIL.pts.length - 1]; if(h && e){ h.setAttribute('cx', e[0].toFixed(1)); h.setAttribute('cy', e[1].toFixed(1)); }
    });
  }
  function trail(kind, x, y){
    safe(() => {
      const sv = $a('arTrail'); if(!sv) return;
      if(kind === 'down'){ const r = sv.getBoundingClientRect(); TRAIL.ox = r.left; TRAIL.oy = r.top; TRAIL.pts = [[x - r.left, y - r.top]]; TRAIL.on = true; sv.setAttribute('class', 'ar-trail on'); }
      else if(kind === 'move'){ if(!TRAIL.on) return; TRAIL.pts.push([x - TRAIL.ox, y - TRAIL.oy]); if(TRAIL.pts.length > 24) TRAIL.pts.splice(0, TRAIL.pts.length - 24); }
      else if(kind === 'up'){ TRAIL.on = false; sv.classList.remove('on'); }
      else { sv.classList.remove('ok', 'bad'); sv.classList.add(kind); }   /* 'ok' | 'bad': 판정 색 */
      if(!TRAIL.raf) TRAIL.raf = requestAnimationFrame(trailDraw);
    });
  }
  function hud(){
    const m = S(); if(!m) return;
    const p = $a('arProg'); if(p) p.textContent = Math.min(m.N, m.done);
    const c = $a('arCombo'); if(c) c.textContent = m.combo;
    const lv = $a('arLives');
    if(lv){ lv.innerHTML = Array.from({ length:m.lives0 }, (_, n) => `<i${n >= m.lives ? ' class="off"' : ''}>★</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + m.lives + '번'); lv.closest('.hchip').classList.toggle('warn', m.lives === 1); }
  }
  function bar(left, win){
    const b = $a('arBar'), w = $a('arBarW'); if(!b || !w) return;
    const k = Math.max(0, Math.min(1, left / win));
    b.style.transform = `scaleX(${k.toFixed(4)})`;
    const st = k > .5 ? 'g' : k > .25 ? 'y' : 'r';
    if(w.dataset.st !== st){ w.dataset.st = st; }
    const hurry = left < .4 && left > 0;
    if(w.classList.contains('hurry') !== hurry) w.classList.toggle('hurry', hurry);
  }

  function show(i){
    const m = S(); m.i = i; m.phase = 'show'; m.t0 = elapsed(); m.ghosted = false;
    const q = m.items[i], L = $a('arLayer');
    if(L){ L.className = 'ar-layer in'; L.innerHTML = itemHtml(q); }
    const st = $a('arStamp'); if(st){ st.className = 'ar-stamp'; st.innerHTML = ''; }
    document.querySelectorAll('.ng-arrow .ar-key').forEach(k => k.classList.remove('ok', 'bad', 'ans'));
    const sr = $a('arSr'); if(sr) sr.textContent = itemSay(q);
    bar(q.win, q.win);
    sfx('arrowShow');
  }
  /* 입력 하나 = 판정 하나. 돌려주는 값: 이번 화살표를 판정했으면 true, 무시했으면 false
     - 문제가 없는 순간(시작 전·화살표 사이 간격·끝난 뒤)과 이미 판정된 화살표에 들어온 입력은 버린다(다음 화살표로 넘어가지 않음)
     - 판단 창이 이미 끝난 순간(다음 그림 그리기 전)에 들어온 입력은 시간 초과로 처리(늦은 입력이 정답이 되지 않게)
     - 화살표가 떠 있을 때 처음 들어온 입력은 막 누르기 잠금 중이어도 반드시 판정한다(틀린 입력이 잠금에 묻혀 사라지지 않게).
       막 누르기(0.25초 안에 4번 이상)는 판정한 뒤 "천천히!" + 다음 화살표가 0.5초 늦게 나오는 것으로만 막는다(벌점 없음) */
  function press(d, src){
    const m = S(); if(!m || G.over || G.paused || G.m !== m) return false;
    const t = elapsed(), now = performance.now();
    m.presses = m.presses.filter(x => now - x < 250); m.presses.push(now);
    const spam = m.presses.length > 3;
    let judged = false;
    if(m.phase === 'show'){
      keyFlash(d, '');
      const q = m.items[m.i];
      if(t - m.t0 >= q.win) timeout(t); else { judge(d, t, src); judged = true; }
    } else if(t >= m.lockUntil) keyFlash(d, '');
    if(spam && t >= m.lockUntil && m.phase !== 'done') slow(t);
    return judged;
  }
  function slow(t){
    const m = S(); m.lockUntil = t + .5; m.presses = []; m.slows++;
    if(m.phase === 'gap') m.next = Math.max(m.next, m.lockUntil);   /* 다음 화살표만 늦게(판단 시간은 그대로) */
    sfx('arrowSlow');
    safe(() => { const e = $a('arSlow'); if(e){ e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); } });
    T(() => { const e = $a('arSlow'); if(e) e.classList.remove('on'); }, 700);
  }
  function ringFlash(cls){ safe(() => { const d = $a('arDisc'); if(!d) return; d.classList.remove('rk', 'rb'); void d.offsetWidth; d.classList.add(cls); }); }
  function keyFlash(d, cls){ safe(() => { const k = document.querySelector(`.ng-arrow .ar-key[data-d="${d}"]`); if(!k) return; k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit'); if(cls) k.classList.add(cls); }); }

  function judge(d, t, src){
    const m = S(), q = m.items[m.i], rt = t - m.t0, ok = d === q.ans;
    m.phase = 'gap'; m.done++;
    if(src === 'swipe') trail(ok ? 'ok' : 'bad');
    if(ok){
      const ratio = Math.max(0, (q.win - rt) / q.win);
      m.correct++; m.ratio += ratio; m.rtSum += rt; m.rtN++; m.combo++; m.maxCombo = Math.max(m.maxCombo, m.combo);
      good(q, d, ratio);
      m.next = t + GAP_OK;
    } else {
      m.wrong++; m.combo = 0;
      bad(q, d);
      m.next = t + GAP_BAD;
    }
    m.res.push(ok ? 1 : 0);
    hud(); afterJudge();
  }
  function timeout(t){
    const m = S(), q = m.items[m.i];
    m.phase = 'gap'; m.done++;
    if(q.ans === -1){   /* 가만히가 정답: 참은 것도 실력(빠르기 1.0) */
      m.correct++; m.ratio += 1; m.combo++; m.maxCombo = Math.max(m.maxCombo, m.combo); m.stays++;
      good(q, -1, 1);
      m.next = t + GAP_OK; m.res.push(1);
    } else {
      m.wrong++; m.combo = 0;
      bad(q, null);
      m.next = t + GAP_BAD; m.res.push(0);
    }
    hud(); afterJudge();
  }
  function afterJudge(){
    const m = S();
    if(m.lives <= 0){ lose(); return; }
    G.paws = m.lives;
  }
  const pts = (m, ratio) => Math.round(500 / m.N + 350 * ratio / m.N);
  function good(q, d, ratio){
    const m = S(), L = $a('arLayer'), st = $a('arStamp');
    const lit = L && (L.querySelector('.ar-slot.lit') || L.querySelector('.ar-slot'));
    /* 정답: 화살표가 민 방향으로 "휙" 날아간다(살짝 뒤로 당겼다가). 뒤에 잔상 두 장이 따라감 */
    if(d >= 0 && lit) safe(() => {
      const D = lit.closest('.ar-disc').offsetWidth || 260, k = D * .78;
      lit.style.setProperty('--fx', DV[d][0] * k + 'px'); lit.style.setProperty('--fy', DV[d][1] * k + 'px');
      if(!FXR.reduce) [2, 1].forEach(n => { const c = lit.cloneNode(true); c.classList.add('ar-after', 'a' + n); c.classList.remove('lit'); const tg = c.querySelector('.ar-tag'); if(tg) tg.remove(); lit.parentNode.insertBefore(c, lit); c.classList.add('go'); });
      lit.classList.add('go');
      L.querySelectorAll('.ar-slot.dim').forEach(e => e.classList.add('fade'));
    });
    if(d < 0 && L) L.classList.add('stayed');
    if(st){ st.className = 'ar-stamp ok' + (d < 0 ? ' stay' : ''); st.innerHTML = d < 0 ? '<div class="msg"><i class="ico ck"></i><b>잘 참았어요</b></div>' : '<i class="ico ck"></i>'; }
    if(d >= 0) keyFlash(d, 'ok');
    ringFlash('rk');
    sfx(d < 0 ? 'arrowStay' : 'arrowOk', { n:Math.min(12, m.combo) }); fxBuzz(10);
    safe(() => {
      const disc = $a('arDisc'); if(!disc) return;
      const c = fxCenter(lit || disc), p = pts(m, ratio);
      fxEmit(c.x, c.y, { quantity:10, speed:{ min:70, max:220 }, angle:d >= 0 ? { min:[270, 0, 90, 180][d] - 50, max:[270, 0, 90, 180][d] + 50 } : { min:0, max:360 }, lifespan:{ min:380, max:650 },
        kind:'twinkle', tint:['#FFFFFF', '#BDF5D4', '#FFF2B0'], scale:{ start:5, end:0, ease:'quad.in' }, drag:2, glow:true });
      fxFloat(c.x, c.y - 24, `+${p}`, 'ar-plus');
    });
    const MS = [5, 10, 20], word = ['좋아요!', '대단해요!', '완벽해요!'];
    const mi = MS.indexOf(m.combo), big = mi >= 0 || (m.combo > 20 && m.combo % 10 === 0);
    if(big){
      const w = word[mi >= 0 ? mi : 2];
      say(`<b class="cb">${w}</b><span>${m.combo}연속 정답</span>`, 'pop');
      hostMood('joy', 900); sfx('arrowCombo', { k:mi >= 0 ? mi : 2 });
      safe(() => { const cp = $a('arComboP'); fxPunch(cp, 1.14); const c = fxCenter(cp); fxBurst(c.x, c.y, ['#FFD45A', '#FFFFFF', '#8FF0C0', '#9FC4FF'], 14, { speed:220, size:4.5, kinds:['star', 'spark', 'dot'], up:90, g:420, glow:true, dur:.7 }); });
    } else if(m.sayBusy < elapsed()) say(m.tip);
  }
  function bad(q, d){
    const m = S(), st = $a('arStamp'), L = $a('arLayer');
    m.lives = Math.max(0, m.lives - 1);
    /* 실수: 화살표가 민 쪽으로 "툭" 밀렸다가 제자리로 튕겨 돌아온다(안 넘어감). 시간 초과는 작아지며 흐려짐 */
    safe(() => {
      const sl = L && (L.querySelector('.ar-slot.lit') || L.querySelector('.ar-slot')); if(!sl) return;
      if(d != null){ const D = sl.closest('.ar-disc').offsetWidth || 260, k = D * .085; sl.style.setProperty('--bx', DV[d][0] * k + 'px'); sl.style.setProperty('--by', DV[d][1] * k + 'px'); sl.classList.add('bonk'); }
      else sl.classList.add('drop');
    });
    if(L) L.classList.add('miss');
    const ansHtml = q.ans === -1 ? '<small>정답: 가만히</small>' : `<small>정답 <span class="ar-ans" style="--r:${q.ans * 90}deg">${KEY_ARW(0)}</span></small>`;
    if(st){ st.className = 'ar-stamp bad' + (d == null ? ' time' : ''); st.innerHTML = `<i class="ico ${d == null ? 'clk' : 'x'}"></i><div class="msg"><b>${whyText(q, d)}</b>${ansHtml}</div>`; }
    if(d != null) keyFlash(d, 'bad');
    ringFlash('rb');
    if(q.ans >= 0) safe(() => { const k = document.querySelector(`.ng-arrow .ar-key[data-d="${q.ans}"]`); if(k) k.classList.add('ans'); });
    sfx(d == null ? 'arrowTime' : 'arrowBad'); fxBuzz([30, 30, 30]);
    say(`<b class="bd">${whyText(q, d)}</b><span>${m.talk.oops}</span>`, 'pop');   /* 다음 화살표가 0.4초 뒤에 바로 나오므로 이유는 말풍선에 조금 더 남겨 둔다 */ m.sayBusy = elapsed() + 1.1;
    hostMood('sad', 800);
    safe(() => {
      fxFlash('#FF4D5E', .1, 240); fxShake($a('arDisc'), 5);
      const v = $a('arVig'); if(v){ v.classList.remove('on'); void v.offsetWidth; v.classList.add('on'); }
      const hs = document.querySelectorAll('.ng-arrow #arLives i'), lost = hs[m.lives];
      if(lost){ lost.classList.add('lost'); const c = fxCenter(lost); fxBurst(c.x, c.y, ['#FFB020', '#FFE27A', '#fff'], 8, { speed:180, size:4, kinds:['dot', 'spark'], up:60, g:500, dur:.55 }); }
    });
  }

  function loop(){
    const m = S(); if(!m || G.over || m.phase === 'done') return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const t = elapsed();
    if(m.phase === 'intro'){
      if(!m.goShown && t >= m.next - .45){ m.goShown = true; const L = $a('arLayer'); if(L) L.innerHTML = '<b class="ar-ready go">시작!</b>'; }
      if(t >= m.next){ show(0); if(!m.boss) say(m.tip); sfx('arrowGo'); }
      return;
    }
    if(m.phase === 'show'){
      const q = m.items[m.i], left = m.t0 + q.win - t;
      bar(left, q.win);
      if(m.ghost && !m.ghosted && t - m.t0 >= .35){ m.ghosted = true; const L = $a('arLayer'); if(L) L.classList.add('ghost'); }
      if(left <= 0) timeout(t);
      return;
    }
    if(m.phase === 'gap' && t >= m.next){
      if(m.i + 1 >= m.N) win(); else show(m.i + 1);
    }
  }
  function avgRt(m){ return m.rtN ? m.rtSum / m.rtN : 0; }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed();
    const a = avgRt(m), key = 'hp:arrow:best';
    m.best0 = +store.get(key, 0) || 0;
    if(a > 0 && m.rtN >= 5 && !G.duel && (!m.best0 || a < m.best0)){ store.set(key, +a.toFixed(3)); m.newBest = true; }
    m.best = m.newBest ? a : m.best0;
    say(`<b class="cb">${m.talk.end}</b><span>평균 ${a ? a.toFixed(2) + '초' : '-'}${m.newBest ? ' · 내 최고 기록!' : m.best0 ? ' · 내 최고 ' + m.best0.toFixed(2) + '초' : ''}</span>`, 'pop');
    hostMood('joy');
    const L = $a('arLayer'); if(L) L.innerHTML = '';
    /* 끝 순간: 표지판이 결과판이 된다(맞힌 수 · 평균 판단 속도 · 별이 하나씩 켜짐) */
    const w = m.wrong, ns = w === 0 ? 3 : w === 1 ? 2 : 1;
    const stars = G.adv ? `<span class="rs-st" aria-label="별 ${ns}개">${[0, 1, 2].map(k => `<i class="${k < ns ? 'on' : ''}" style="--k:${k}">★</i>`).join('')}</span>` : '';
    const st = $a('arStamp'); if(st){ st.className = 'ar-stamp done'; st.innerHTML = `<div class="rs"><em class="rs-k">${m.correct === m.N ? '전부 정답' : '완주'}</em><b class="rs-n">${m.correct}<small>/${m.N}</small></b><span class="rs-a">평균 ${a ? a.toFixed(2) + '초' : '-'}</span>${stars}${m.newBest ? '<em class="rs-best">내 최고 기록!</em>' : ''}</div>`; }
    safe(() => { const d = $a('arDisc'); if(d) d.classList.add('won'); setTimeout(() => document.querySelectorAll('.ng-arrow .ar-key').forEach(k => k.classList.remove('ok', 'bad', 'ans')), 350); });
    bar(0, 1);
    safe(() => { const c = fxCenter($a('arDisc')); fxRing(c.x, c.y, '#FFE07A', c.w * .6, .6, 8); fxBurst(c.x, c.y, ['#FFE07A', '#8FF0C0', '#9FC4FF', '#FFFFFF'], 24, { speed:320, size:5.5, kinds:['star', 'dot', 'spark'], up:120, g:420, glow:true, dur:1 }); });
    T(() => finish(true), 1000);
  }
  function lose(){
    const m = S(); if(m.phase === 'done') return;
    m.phase = 'done'; m.sec = elapsed();
    hostMood('sad');
    T(() => { const st = $a('arStamp'), L = $a('arLayer'); if(L) L.innerHTML = ''; bar(0, 1); document.querySelectorAll('.ng-arrow .ar-key').forEach(k => k.classList.remove('ok', 'bad', 'ans')); if(st){ st.className = 'ar-stamp done lost'; st.innerHTML = `<div class="rs"><em class="rs-k">기회 끝</em><b class="rs-n">${m.correct}<small>/${m.N}</small></b><span class="rs-a">${m.done}번째 화살표까지</span></div>`; } }, 520);
    T(() => { say(`<b class="bd">기회를 다 썼어요</b><span>정답 ${m.correct}/${m.N}</span>`, 'pop'); sfx('arrowLose'); }, 500);
    T(() => finish(false), 1500);
  }

  /* ===== 크기 맞추기: 휴대폰 한 화면(스크롤 없이) ===== */
  function layout(){
    const m = S(), root = document.querySelector('.ng-arrow'); if(!m || !root) return;
    const wrap = root.closest('.wrap'), pb = wrap ? parseFloat(getComputedStyle(wrap).paddingBottom) || 0 : 0;
    const top = root.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(470, Math.floor((innerHeight || 740) - top - pb - 6));
    root.style.height = H + 'px';
    root.style.setProperty('--k', (H < 610 ? 64 : H < 700 ? 68 : 74) + 'px');
    const dw = $a('arDiscWrap'); if(!dw) return;
    root.style.setProperty('--d', '10px');
    const r = dw.getBoundingClientRect();
    const d = Math.floor(Math.max(160, Math.min(r.width - 6, r.height - 6, 400)));
    root.style.setProperty('--d', d + 'px');
  }

  let UID = 0;
  function art(){
    const u = 'arA' + (++UID) + '_' + Math.floor(performance.now() % 1e5);
    const big = spr('b', 1), red = spr('r', 3);
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141A3E"/><stop offset="1" stop-color="#2A3266"/></linearGradient>
      <radialGradient id="${u}d" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#36408A"/><stop offset="1" stop-color="#1F2558"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#${u}s)"/>
      <g fill="#9FB4FF" opacity=".35"><circle cx="14" cy="14" r="2.2"/><circle cx="148" cy="10" r="1.6"/><circle cx="120" cy="22" r="1.2"/><circle cx="34" cy="30" r="1.1"/></g>
      <path d="M60 100L76 62h8l16 38z" fill="#232A58"/><path d="M80 66v6M80 78v8M80 92v8" stroke="#FFE07A" stroke-width="2" stroke-linecap="round" opacity=".55"/>
      <g><circle cx="48" cy="48" r="32" fill="#0F1336"/><circle cx="48" cy="46" r="30" fill="url(#${u}d)" stroke="#6FD6E8" stroke-width="2.4" stroke-opacity=".75"/>
      <image href="${big}" x="26" y="24" width="44" height="44"/></g>
      <g><circle cx="116" cy="52" r="26" fill="#0F1336"/><circle cx="116" cy="50" r="24" fill="url(#${u}d)" stroke="#6FD6E8" stroke-width="2.2" stroke-opacity=".75"/>
      <image href="${red}" x="98" y="32" width="36" height="36"/></g>
      <path d="M84 84h20" stroke="#8FF0C0" stroke-width="3.2" stroke-linecap="round"/><path d="M98 79l7 5-7 5" fill="none" stroke="#8FF0C0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  return {
    name:'거꾸로 화살표', abil:'순발력', col:['#9FC4FF', '#3F6FE0', '#1D3A8A'], time:'약 1분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 5.2h11.3V2.3l7.7 5.3-7.7 5.3V9.9H2.5z"/><path d="M21.5 14.2H10.2v-2.9l-7.7 5.3 7.7 5.3v-2.9h11.3z" opacity=".55"/></svg>',
    art,
    help:[
      ['파랑은 그대로', '파란 화살표가 나오면 가리키는 쪽으로 밀어요. 화면 어디서든 손가락으로 밀거나, 아래 십자 버튼·키보드 화살표를 눌러도 돼요.'],
      ['빨강은 반대로', '빨간 화살표(꼬리에 되돌이 표시)는 반대쪽으로 밀어요. 오른쪽을 가리키면 왼쪽으로! 회색 화살표(멈춤 표시)는 가만히 있어야 정답이에요.'],
      ['막 누르면 손해', '틀리거나 시간이 지나면 기회 별이 하나 줄고, 다 쓰면 끝나요. 빨리 맞힐수록 점수가 높아요. 화살표가 떠 있을 때 처음 민 것 하나만 판정하고, 마구 누르면 다음 화살표가 늦게 나와요.'],
      ['솔로: 5판마다 새 규칙', '엉뚱한 자리·글자 화살표·정지 표지·두 개 중 하나 같은 새 규칙과 빠른 판·순간·외줄 타기 변주가 하나씩 나와요.']
    ],
    /* 도움말 v2(쉬운 화면): 그림 1장(파랑·빨강·회색 세 칸, 움직임 없음) + 3줄 */
    howto:{
      pic(){
        const card = (x, col, d, push, lab, sub, lc) => `<g transform="translate(${x} 0)"><rect x="4" y="14" width="96" height="152" rx="16" fill="#232A62" stroke="#3B468F" stroke-width="2"/>
          <circle cx="52" cy="66" r="38" fill="#2E377C"/><image href="${spr(col, d)}" x="22" y="36" width="60" height="60"/>
          ${push == null ? `<rect x="40" y="114" width="7" height="20" rx="3" fill="#C9D2FF"/><rect x="57" y="114" width="7" height="20" rx="3" fill="#C9D2FF"/>`
            : `<path d="M32 124h40" stroke="${lc}" stroke-width="5" stroke-linecap="round" transform="rotate(${push * 90 - 90} 52 124)"/><path d="M64 114l11 10-11 10" fill="none" stroke="${lc}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${push * 90 - 90} 52 124)"/>`}
          <text x="52" y="156" text-anchor="middle" font-family="Jua,sans-serif" font-size="15" fill="#fff">${lab}</text>
          <text x="52" y="34" text-anchor="middle" font-family="Jua,sans-serif" font-size="12" fill="#AEB8E8">${sub}</text></g>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#151A44"/>
          ${card(2, 'b', 1, 1, '그대로', '파랑', '#8FF0C0')}${card(108, 'r', 1, 3, '반대로', '빨강 ↺', '#8FF0C0')}${card(214, 'g', 0, null, '가만히', '회색 ‖', '#C9D2FF')}</svg>`;
      },
      lines:['파란 화살표는 그 방향으로 밀어요', '빨간 화살표(↺)는 반대로 밀어요', '틀리면 기회 별이 하나 줄어요'],
      more:null
    },
    helpExtra(){ const m = G && G.id === 'arrow' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['표지판 길', '미로 정원', '거울 터널', '바람개비 언덕', '나침반 탑'],
    starRule:'★ 클리어 · ★★ 실수 1번 · ★★★ 실수 없이',
    levels:LEVELS,
    levelDesc(lv){ const c = LEVELS[lv] || LEVELS.normal; return `화살표 ${c.N}개 · 판단 ${c.w0}초 → ${c.w1}초${c.stop ? ' · 회색 멈춤' : c.side ? ' · 엉뚱한 자리' : ''}`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `화살표 ${c.N}개 · 판단 ${c.w0.toFixed(1)}초 → ${c.w1.toFixed(1)}초${c.lives < 3 ? ' · 기회 ' + c.lives + '번' : ''}`; },
    init(cfg, rng){
      const items = gen(cfg, rng);
      const c = cfg.c || 1, host = G.adv ? HOSTS[(c - 1) % 5] : 'whale';
      const tips = [];
      if(cfg.side) tips.push(RULE_TIP.side); if(cfg.word) tips.push(RULE_TIP.word); if(cfg.stop) tips.push(RULE_TIP.stop); if(cfg.pair) tips.push(RULE_TIP.pair);
      if(cfg.tw && RULE_TIP[cfg.tw]) tips.push(RULE_TIP[cfg.tw]);
      const lives = G.duel ? 3 : cfg.lives || 3;
      const talk = TALK[host] || TALK.whale;
      const tip = cfg.focus && CONC.info[cfg.focus] ? `<b>새 규칙</b><span>${CONC.info[cfg.focus].name}: ${RULE_TIP[cfg.focus]}</span>` : tips.length ? `<span>${tips.slice(0, 2).join(' · ')}</span>` : `<span>${talk.hi}</span>`;
      G.m = { u:++UID, items, N:items.length, i:-1, phase:'intro', next:G.duel ? .7 : (cfg.boss ? 1.7 : 1.1), t0:0, ghosted:false,
        lives, lives0:lives, correct:0, wrong:0, done:0, ratio:0, rtSum:0, rtN:0, combo:0, maxCombo:0, stays:0, slows:0, res:[],
        presses:[], lockUntil:0, sayBusy:0, ghost:!!cfg.ghost, boss:!!cfg.boss, host, talk, tips, tip, tint:TINT[(c - 1) % 5], mj:cfg.mj || [], tw:cfg.tw || null,
        cfg, timers:new Set(), moodT:0, sec:0, best:0, best0:0, newBest:false };
      G.paws = lives; G.limit = 0;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.off) m.off();
        if(G && G.raf) cancelAnimationFrame(G.raf);
        if(TRAIL.raf){ cancelAnimationFrame(TRAIL.raf); TRAIL.raf = 0; } TRAIL.on = false; TRAIL.pts = [];
        safe(() => ['--ar-s1', '--ar-s2', '--ar-s3', '--ar-ring'].forEach(v => document.body.style.removeProperty(v)));
      };
    },
    /* 점검·도구용 */
    _gen:gen, _stage:stageCfg,
    _cur(){ const m = S(); if(!m) return null; return { phase:m.phase, i:m.i, N:m.N, ans:m.i >= 0 && m.items[m.i] ? m.items[m.i].ans : null, kind:m.i >= 0 && m.items[m.i] ? m.items[m.i].kind : null, lives:m.lives, correct:m.correct, t:elapsed(), t0:m.t0 }; },
    _press(d){ press(d, 'test'); },
    render(st){
      const m = S(), tn = m.tint, chips = [];
      if(G.adv && m.boss) chips.push('<span class="ar-chip boss">대장 판</span>');
      if(G.adv){ m.mj.forEach(k => chips.push(`<span class="ar-chip mj">${CONC.info[k].name}</span>`)); if(m.tw) chips.push(`<span class="ar-chip tw">${(conceptInfo('arrow', m.tw) || {}).name || m.tw}</span>`); }
      safe(() => { const b = document.body.style; b.setProperty('--ar-s1', tn.sky1); b.setProperty('--ar-s2', tn.sky2); b.setProperty('--ar-s3', tn.sky3); b.setProperty('--ar-ring', tn.ring); });
      st.innerHTML = `<div class="ng-arrow${m.boss ? ' boss' : ''}" style="--ring:${tn.ring}" role="application" aria-label="거꾸로 화살표. 화면을 밀거나 십자 버튼, 화살표 키로 답해요">
        <div class="hud-row">
          <div class="hchip" aria-label="푼 문제"><span class="hv">${ICO.sign}<b id="arProg">0</b><small>/${m.N}</small></span><em>문제</em></div>
          <div class="hchip" id="arComboP" aria-label="연속 정답"><span class="hv">${ICO.combo}<b id="arCombo">0</b></span><em>콤보</em></div>
          <div class="hchip ar-lvchip"><span class="hv hlives" id="arLives" role="img"></span><em>기회</em></div>
        </div>
        ${chips.length ? `<div class="ar-chips" aria-label="이번 판 규칙">${chips.join('')}</div>` : ''}
        <div class="ar-hostrow">
          <div class="ar-hostav">${toyImg(m.host, 'ar-hostimg', m.boss ? 'wow' : '').replace('<img ', '<img id="arHost" ')}</div>
          <div class="ar-say" id="arSay" aria-live="polite"></div>
        </div>
        <div class="ar-discwrap" id="arDiscWrap"><i class="ar-pole" aria-hidden="true"></i>
          <div class="ar-disc" id="arDisc">
            <i class="ar-notch n0"></i><i class="ar-notch n1"></i><i class="ar-notch n2"></i><i class="ar-notch n3"></i>
            <div class="ar-layer" id="arLayer"><b class="ar-ready">준비</b></div>
            <div class="ar-stamp" id="arStamp"></div>
            <div class="ar-slow" id="arSlow" aria-hidden="true">천천히!</div>
          </div>
        </div>
        <div class="ar-tbar" id="arBarW" data-st="g" aria-hidden="true"><i id="arBar"></i></div>
        <div class="ar-pad" aria-label="방향 버튼">
          <button class="ar-key k0" data-d="0" aria-label="위로">${KEY_ARW(0)}</button>
          <button class="ar-key k3" data-d="3" aria-label="왼쪽으로">${KEY_ARW(3)}</button>
          <div class="ar-hub" aria-hidden="true">${HUB}</div>
          <button class="ar-key k1" data-d="1" aria-label="오른쪽으로">${KEY_ARW(1)}</button>
          <button class="ar-key k2" data-d="2" aria-label="아래로">${KEY_ARW(2)}</button>
        </div>
        <svg class="ar-trail" id="arTrail" aria-hidden="true"><path id="arTrailP" d=""/><path class="core" id="arTrailC" d=""/><circle id="arTrailH" r="9" cx="-40" cy="-40"/></svg>
        <p class="ar-sr" id="arSr" aria-live="assertive"></p>
        <div class="ar-vig" id="arVig" aria-hidden="true"></div>
      </div>`;
      const root = st.querySelector('.ng-arrow');
      hud();
      if(m.boss){ say('<b class="bs">대장 판!</b><span>끝까지 침착하게</span>', 'pop'); sfx('arrowBoss'); T(() => hostMood(''), 1600); }
      else say(`<b>준비</b><span>${m.talk.hi}</span>`);
      /* 조작: 버튼(누르는 순간) · 화면 어디서든 밀기(24px) · 키보드 */
      root.querySelectorAll('.ar-key').forEach(b => {
        let pt = -1e9;   /* 한 동작 = 한 번: 누름(pointerdown) 바로 뒤 따라오는 click은 detail과 상관없이 버림 */
        b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); pt = performance.now(); press(+b.dataset.d, 'key'); });
        b.addEventListener('click', e => { if(e.detail === 0 && performance.now() - pt > 600) press(+b.dataset.d, 'key'); });
      });
      /* 밀기 규칙(판정 버그 막기)
         - 한 번 누른 손가락(한 획)은 화살표 하나만 판정한다. 판정에 쓰인 획은 손을 뗄 때까지 더 세지 않는다.
         - 획이 앞 화살표·간격 중에 시작됐으면, 새 화살표가 나온 뒤 움직인 거리만 센다(미리 밀어 둔 것이 다음 화살표 답이 되지 않게).
         - 간격 중에 24px을 다 민 획은 버려진다(그 획은 다음 화살표에도 안 씀). */
      let sx = 0, sy = 0, pid = null, used = false, tok = '';
      const tokNow = () => m.phase + ':' + m.i;
      const down = e => { if(e.button > 0) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; used = false; tok = tokNow(); try{ root.setPointerCapture(pid); }catch(_){} trail('down', e.clientX, e.clientY); };
      const move = e => { if(e.pointerId !== pid) return; trail('move', e.clientX, e.clientY); if(used) return;
        const k = tokNow(); if(k !== tok){ tok = k; sx = e.clientX; sy = e.clientY; return; }
        const dx = e.clientX - sx, dy = e.clientY - sy;
        const ax = Math.abs(dx), ay = Math.abs(dy), mx = Math.max(ax, ay), mn = Math.min(ax, ay);
        if(mx < 24) return;
        if(mx < 56 && mx < mn * 1.25) return;   /* 대각선(애매한 획)은 한쪽이 뚜렷해질 때까지 기다림(56px 넘으면 큰 쪽) */
        used = true;
        press(ax > ay ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0), 'swipe'); };
      const up = e => { if(e.pointerId === pid){ pid = null; trail('up'); } };
      root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move);
      root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
      const KEYS = { ArrowUp:0, ArrowRight:1, ArrowDown:2, ArrowLeft:3, w:0, d:1, s:2, a:3, W:0, D:1, S:2, A:3 };
      const key = e => { if(!G || G.m !== m || e.repeat) return; const v = $a('veil'); if(v && v.classList.contains('on')) return;
        if(e.key in KEYS){ e.preventDefault(); press(KEYS[e.key], 'kbd'); } };
      const rs = () => layout();
      /* 다른 앱으로 갔다 오면(솔로·연습) 멈춤: 판단 시간이 몰래 지나가지 않게. 대전은 엔진이 멈추지 않음 */
      let hid = false;
      const vis = () => { if(!G || G.m !== m || G.over) return; if(document.hidden){ hid = gPause(); } else if(hid){ hid = false; gResume(); } };
      addEventListener('keydown', key); addEventListener('resize', rs); document.addEventListener('visibilitychange', vis);
      m.off = () => { removeEventListener('keydown', key); removeEventListener('resize', rs); document.removeEventListener('visibilitychange', vis); };
      layout(); requestAnimationFrame(() => { if(G && G.m === m) layout(); }); T(layout, 300); T(layout, 900);
      T(bake, 400);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.N ? Math.min(1, m.done / m.N) : 0; },
    lossText(){ const m = G.m; return `정답 ${m.correct}/${m.N}개 · ${m.done}번째 화살표까지 했어요.`; },
    score(){
      const m = G.m, N = m.N || 1, a = avgRt(m);
      const base = Math.round(500 * m.correct / N), time = Math.round(350 * m.ratio / N), extra = 50 * Math.max(0, m.lives);
      const best = m.newBest ? ' · 최고 기록!' : m.best0 ? ' · 최고 ' + m.best0.toFixed(2) + '초' : '';
      return { base, time, extra, rows:[`정답 ${m.correct}/${N}`, `판단 속도 보너스 (평균 ${a.toFixed(2)}초${best})`, `남은 기회 ${Math.max(0, m.lives)}개`] };
    },
    stars(){ const w = G.m.wrong; return w === 0 ? 3 : w === 1 ? 2 : 1; },
    sounds:{
      arrowShow(){ aTone({ f:988, f2:1318, type:'triangle', d:.06, v:.03, bus:'ui' }); aNoise({ ft:'bandpass', f:2600, q:3, d:.03, v:.02, bus:'ui' }); },
      arrowOk(o){ const n = o.n || 0; aMarimba(penta(n + 2, 72), { v:.16 }); aMarimba(penta(n + 4, 72), { t:.05, v:.11 }); aWhoosh({ f:700, f2:2600, a:.01, d:.12, v:.025 }); if(n >= 3) aBell({ f:penta(n + 7, 72), t:.08, d:.5, v:.04, rev:.35 }); },
      arrowStay(){ aBell({ f:m2f(79), d:.55, v:.06, idx:1.2, rev:.35 }); aBell({ f:m2f(86), t:.07, d:.6, v:.045, idx:1.2, rev:.35 }); },
      arrowBad(){ aTone({ f:233, f2:150, type:'square', lp:900, d:.2, v:.06 }); aThump({ f:130, f2:60, d:.16, v:.12 }); },
      arrowTime(){ aTone({ f:466, f2:311, type:'triangle', d:.28, v:.07 }); aTone({ f:1200, type:'square', lp:2500, d:.03, v:.03, bus:'ui' }); },
      arrowSlow(){ aTone({ f:620, type:'triangle', d:.08, v:.05, bus:'ui' }); aTone({ f:520, type:'triangle', t:.1, d:.1, v:.05, bus:'ui' }); },
      arrowCombo(o){ const k = o.k || 0, top = [79, 84, 88][k]; [72, 76, top].forEach((mm, i) => aBrass(m2f(mm), { t:i * .07, d:.16, v:.05 })); aSparkle({ t:.2, n:3 + k * 2, v:.035 }); },
      arrowGo(){ aWhoosh({ f:500, f2:2400, a:.03, d:.22, v:.04 }); aBell({ f:m2f(84), t:.1, d:.45, v:.05, rev:.3 }); },
      arrowBoss(){ aBrass(m2f(55), { hold:.25, d:.5, v:.06 }); aBrass(m2f(62), { t:.12, hold:.2, d:.5, v:.05 }); aThump({ f:110, f2:50, d:.4, v:.2 }); },
      arrowLose(){ [67, 64, 60].forEach((mm, i) => aTone({ f:m2f(mm), type:'triangle', t:i * .14, d:.3, v:.06, rev:.3 })); }
    },
    gate:{ arrowShow:60, arrowOk:40, arrowBad:80, arrowTime:80, arrowSlow:300, arrowStay:60 },
    jingle(){ [0, 2, 4, 2, 7, 9].forEach((d, i) => aMarimba(penta(d + 2, 72), { t:i * .075, v:.15 })); [76, 79, 84, 88].forEach((mm, i) => aBell({ f:m2f(mm), t:.5 + i * .035, d:1.2, v:.055, idx:1.3, rev:.45 })); aSparkle({ t:.6, n:6 }); }
  };
})();

/* 대전: 같은 화살표(같은 씨앗·보통), 끝났을 때 점수가 높은 쪽 승. AI 상대 평균 시간·성공률(duelPace), 상대에게 보내는 수치(duelStat) */
Object.assign(NG.arrow, { duelPace:[50, .75], duelKind:'score', duelEnd:'all',
  /* 대전은 점수전(모두 끝까지, 점수 순): 막대 값 = 지금까지 점수(결과 창과 같은 식, 남은 기회 점수는 진행만큼) */
  duelStat:{ unit:'점', score:true, lfMax:3, get:() => {
    let v = 0; try{ const q = NG.arrow.score(), pr = Math.max(0, Math.min(1, NG.arrow.progress() || 0)); v = Math.round((q.base + q.time + q.extra * pr) * ((G.L && G.L.mult) || 1)); }catch(_){}
    return { v, t:100, lf:G.m.lives, mis:G.m.wrong };
  } }, duelHow:'같은 화살표 · 끝났을 때 점수가 높은 쪽이 이겨요' });
/* 움직이는 배경(core/scene.js): 밤 도로의 흐린 불빛 방울. 보이기만 하고 게임·대전에는 영향 없음 */
NG.arrow.scene = { kind:'motes', colors:['#6FD6E8', '#9FB4FF', '#FFE07A'], density:.55, alpha:.45 };
