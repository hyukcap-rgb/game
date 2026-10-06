/* 자동차 주차하기 */
/* ===== 자동차 주차하기 (parking) · 하루퍼즐 리그 게임 모듈 =====
   꽉 찬 주차장에서 차를 앞뒤로만 밀어 빨간 내 차를 '내 주차 자리'(출구 또는 판 안 표시 칸)까지 보내는 슬라이딩 퍼즐.
   - 문제는 parking-bank.js(parking-maker.js가 만든 목록, 최단 수가 정확히 계산된 판)에서 rng로 고르고,
     좌우·상하 뒤집기·차 색·차 모양을 rng로 바꾼다. 솔로 규칙(한 번 차·일방통행 차)은 rng로 붙인 뒤 풀이 도구로 다시 확인한다.
   - 최단 수·힌트·진행률은 parking-solver.js(PKS)의 너비 우선 탐색으로 그때그때 계산한다.
   - 차 그림은 모두 직접 그린 오리지널 SVG(위에서 본 모습, 굵은 외곽선 #1A0F45). */
NG.parking = (() => {
  const OL = '#1A0F45';
  const RED = ['#FF4D5E', '#C8213B'], YEL = ['#FFD23F', '#D99A00'];
  const PAL = [['#4D8DFF', '#2C5FD6'], ['#3CCB7F', '#1F9558'], ['#9B6BFF', '#6A3FD6'], ['#FF9A3D', '#D9681A'], ['#25C6D0', '#138E99'],
    ['#FF8FC0', '#D9548F'], ['#A4D93A', '#6E9E14'], ['#7CCBFF', '#3E95D6'], ['#F4F1FF', '#B4ABD8'], ['#C08552', '#8A5A30'], ['#5A6BD8', '#3546A8'], ['#B98CFF', '#8455D9']];
  const GLASS = '#BFEAFF';

  /* ----- 차 그림: 가로 틀(길이 L×100, 폭 100, 앞이 오른쪽)에 그린 뒤 방향에 맞게 돌린다 ----- */
  const eyes = (x, y1, y2, r) => `<circle cx="${x}" cy="${y1}" r="${r}" fill="${OL}"/><circle cx="${x}" cy="${y2}" r="${r}" fill="${OL}"/><circle cx="${x - r * .35}" cy="${y1 - r * .4}" r="${r * .38}" fill="#fff"/><circle cx="${x - r * .35}" cy="${y2 - r * .4}" r="${r * .38}" fill="#fff"/>`;
  const wheels = xs => xs.map(x => `<rect x="${x - 14}" y="5" width="28" height="16" rx="6" fill="${OL}"/><rect x="${x - 14}" y="79" width="28" height="16" rx="6" fill="${OL}"/>`).join('');
  function body(kind, L, col, mark){
    const Lw = L * 100, c = col[0], d = col[1];
    const lights = `<ellipse cx="${Lw - 13}" cy="27" rx="5" ry="8" fill="#FFF6B0" stroke="${OL}" stroke-width="3"/><ellipse cx="${Lw - 13}" cy="73" rx="5" ry="8" fill="#FFF6B0" stroke="${OL}" stroke-width="3"/>`;
    const tail = `<rect x="9" y="22" width="6" height="12" rx="3" fill="#FF6B6B"/><rect x="9" y="66" width="6" height="12" rx="3" fill="#FF6B6B"/>`;
    const shadow = `<rect x="12" y="16" width="${Lw - 18}" height="76" rx="24" fill="rgba(10,6,40,.32)"/>`;
    let s = '';
    if(kind === 'truck'){
      s = shadow + wheels([46, 150, Lw - 48])
        + `<rect x="8" y="11" width="${Lw - 110}" height="78" rx="10" fill="#FFF8EC" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="8" y="42" width="${Lw - 110}" height="16" fill="${c}"/><rect x="8" y="11" width="${Lw - 110}" height="78" rx="10" fill="none" stroke="${OL}" stroke-width="5"/>`
        + `<path d="M24 24h${Lw - 140}M24 76h${Lw - 140}" stroke="#E6DCC8" stroke-width="4" stroke-linecap="round"/>`
        + `<rect x="${Lw - 98}" y="13" width="90" height="74" rx="22" fill="${c}" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="${Lw - 46}" y="24" width="18" height="52" rx="8" fill="${GLASS}" stroke="${OL}" stroke-width="3.5"/>`
        + `<rect x="${Lw - 88}" y="22" width="34" height="56" rx="10" fill="${d}"/>` + lights + eyes(Lw - 66, 40, 60, 5.5);
    } else if(kind === 'bus'){
      s = shadow + wheels([50, Lw - 54])
        + `<rect x="8" y="10" width="${Lw - 16}" height="80" rx="22" fill="${c}" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="22" y="18" width="${Lw - 70}" height="10" rx="5" fill="${GLASS}" stroke="${OL}" stroke-width="2.5"/><rect x="22" y="72" width="${Lw - 70}" height="10" rx="5" fill="${GLASS}" stroke="${OL}" stroke-width="2.5"/>`
        + `<rect x="34" y="36" width="${Lw - 110}" height="28" rx="10" fill="#fff" opacity=".85" stroke="${OL}" stroke-width="3"/>`
        + [0, 1, 2].map(k => `<rect x="${50 + k * (Lw - 150) / 2.6}" y="42" width="24" height="16" rx="4" fill="${d}"/>`).join('')
        + `<rect x="${Lw - 38}" y="20" width="18" height="60" rx="8" fill="${GLASS}" stroke="${OL}" stroke-width="3.5"/>` + lights + tail;
    } else if(kind === 'mini'){
      s = shadow + wheels([46, Lw - 48])
        + `<rect x="10" y="10" width="${Lw - 20}" height="80" rx="38" fill="${c}" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="54" y="20" width="76" height="60" rx="26" fill="${d}" stroke="${OL}" stroke-width="4"/>`
        + `<path d="M120 26q16 24 0 48" fill="${GLASS}" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/>`
        + `<ellipse cx="88" cy="38" rx="20" ry="6" fill="#fff" opacity=".35"/>` + lights + tail + eyes(Lw - 34, 38, 62, 6);
    } else if(kind === 'van'){
      s = shadow + wheels([44, Lw - 46])
        + `<rect x="8" y="10" width="${Lw - 16}" height="80" rx="18" fill="${c}" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="18" y="18" width="${Lw - 66}" height="64" rx="12" fill="${d}" stroke="${OL}" stroke-width="3.5"/>`
        + `<path d="M34 30v40M58 30v40M82 30v40M106 30v40" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
        + `<rect x="${Lw - 44}" y="20" width="16" height="60" rx="7" fill="${GLASS}" stroke="${OL}" stroke-width="3.5"/>` + lights + tail + eyes(Lw - 18, 42, 58, 4.5);
    } else {   /* car */
      s = shadow + wheels([44, Lw - 52])
        + `<rect x="8" y="12" width="${Lw - 16}" height="76" rx="26" fill="${c}" stroke="${OL}" stroke-width="5"/>`
        + `<rect x="22" y="19" width="${Lw - 60}" height="9" rx="4.5" fill="#fff" opacity=".35"/>`
        + `<rect x="50" y="22" width="84" height="56" rx="16" fill="${d}" stroke="${OL}" stroke-width="4"/>`
        + `<rect x="120" y="26" width="18" height="48" rx="8" fill="${GLASS}" stroke="${OL}" stroke-width="3.5"/>`
        + `<rect x="46" y="30" width="11" height="40" rx="5" fill="${GLASS}" stroke="${OL}" stroke-width="3"/>`
        + lights + tail + eyes(Lw - 32, 38, 62, 6);
    }
    if(mark === 'heart') s += `<path d="M92 63c-9-6-15-11-15-18 0-5 4-8 8-8 3 0 5 2 7 4 2-2 4-4 7-4 4 0 8 3 8 8 0 7-6 12-15 18z" fill="#fff" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`;
    if(mark === 'star') s += `<path d="M92 34l4.7 9.6 10.5 1.5-7.6 7.4 1.8 10.5-9.4-5-9.4 5 1.8-10.5-7.6-7.4 10.5-1.5z" fill="#fff" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`;
    return s;
  }
  /* h: 가로 차인지, face: +1 = 앞이 오른쪽/아래, −1 = 왼쪽/위 */
  function carSvg(kind, L, col, h, face, mark){
    const Lw = L * 100;
    const tr = h ? (face > 0 ? '' : `translate(${Lw} 0) scale(-1 1)`) : (face > 0 ? 'translate(100 0) rotate(90)' : `translate(0 ${Lw}) rotate(-90)`);
    return `<svg viewBox="0 0 ${h ? Lw : 100} ${h ? 100 : Lw}" preserveAspectRatio="none" aria-hidden="true"><g transform="${tr}">${body(kind, L, col, mark)}</g></svg>`;
  }
  const PILLAR = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="54" cy="56" r="38" fill="rgba(10,6,40,.35)"/><circle cx="50" cy="50" r="38" fill="#FFD23F" stroke="${OL}" stroke-width="5"/>
    <path d="M22 30l20-16M16 52l38-34M20 72l52-48M36 84l48-44M60 86l26-24" stroke="${OL}" stroke-width="7" stroke-linecap="round" opacity=".85"/>
    <circle cx="50" cy="50" r="24" fill="#C9C2E6" stroke="${OL}" stroke-width="5"/><circle cx="50" cy="50" r="12" fill="#E8E4F7"/><ellipse cx="42" cy="40" rx="7" ry="4" fill="#fff" opacity=".8" transform="rotate(-30 42 40)"/></svg>`;
  const ICO = {
    move:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="14" height="10" rx="4" fill="#FF4D5E" stroke="#1A0F45" stroke-width="1.8"/><rect x="8" y="9" width="5" height="6" rx="1.5" fill="#BFEAFF" stroke="#1A0F45" stroke-width="1.2"/><path d="M18 12h4M20 10l2 2-2 2" fill="none" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    undo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5L4 10l5 5" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 10H14a6 6 0 0 1 0 12h-3" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/></svg>',
    reset:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12A7.5 7.5 0 1 1 17 6.4" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/><path d="M18.5 2.5v4.5H14" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" fill="#FFD23F" stroke="#1A0F45" stroke-width="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#1A0F45" stroke-width="2.2"/><circle cx="12" cy="15.5" r="1.8" fill="#1A0F45"/></svg>'
  };
  const HINT_PEN = 50;
  /* 대전 판(세대별 테스트 2026-10-06): 짧은 판 10~12수 · 2분. 지금 엔진은 levels.normal로 시작하므로 init에서 바꿔 끼우고, 대전 v3 엔진은 duelCfg()를 읽는다 */
  const DUEL = { size:6, lo:10, hi:12, limit:120, hints:3, duel:true };

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['pillar', 'once', 'oneway', 'pair'],
    info:{
      pillar:{ name:'기둥', desc:'주차장 한가운데 굵은 기둥이 서 있어요. 기둥은 꿈쩍도 안 하니 차들을 돌려서 길을 만들어요.' },
      once:{ name:'한 번 차', desc:'①이 붙은 차는 딱 한 번만 움직일 수 있어요. 움직이고 나면 그 자리에 콕 박혀요. 어디로 보낼지 잘 생각해요!' },
      oneway:{ name:'일방통행 차', desc:'화살표가 붙은 차는 화살표 쪽으로만 갈 수 있어요. 뒤로는 못 가요.' },
      pair:{ name:'두 대 주차', desc:'노란 친구 차도 자기 출구로 보내야 해요. 빨간 차와 노란 차가 둘 다 자리에 들어가면 성공!' }
    },
    twists:['flash', 'bare', 'limit', 'big', 'ice'],
    twInfo:{
      flash:{ name:'번개', desc:'판은 조금 쉽지만 제한 시간이 아주 짧아요. 빠르게 길을 찾아요!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 머리로 풀어요. (되돌리기·처음부터는 쓸 수 있어요)' },
      limit:{ name:'수 제한', desc:'최단 수보다 2수까지만 더 움직일 수 있어요. 수를 다 쓰면 되돌리기로 다시 생각해요.' },
      big:{ name:'큰 주차장', desc:'7×7 넓은 주차장! 차도 많고 길도 길어요. 대신 시간은 넉넉해요.' },
      ice:{ name:'빙판 주차장', desc:'바닥이 꽁꽁 얼었어요. 민 차는 중간에 못 서고 막힐 때까지 쭉 미끄러져요.' }
    }
  };
  const RULE_TIP = { pillar:'기둥은 못 움직여요', once:'①차는 한 번만', oneway:'화살표 쪽으로만', pair:'노란 차도 출구로', flash:'시간이 짧아요', bare:'힌트 없음', limit:'수 제한', big:'7×7 큰 주차장', ice:'끝까지 미끄러져요' };

  /* ----- 솔로 난이도 표: 최단 수 범위 [lo, lo+폭] -----
     챕터 1 = LT.ch1[k], 챕터 2~ = LT.base[c] + LT.kOff[k] (최대 19). 제한 시간 = 40초 + 최단 수 × 9초 × 규칙·변주 배수 */
  const LT = {
    ch1:[0, 4, 5, 6, 7, 9, 5, 7, 8, 5, 11],
    base:[0, 0, 7, 9, 11, 12, 13],
    kOff:[0, -2, 0, 1, 1, 4, -2, 1, 2, -2, 6],
    mjTime:{ pillar:1.05, once:1.15, oneway:1.1, pair:1.2 },
    twTime:{ flash:.6, bare:1.1, limit:1.1, big:1.25, ice:1 }
  };
  const round5 = v => Math.max(30, Math.round(v / 5) * 5);
  function stageCfg(n){
    const p = planOf('parking', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let lo = c === 1 ? LT.ch1[k] : Math.min(19, LT.base[Math.min(c, LT.base.length - 1)] + LT.kOff[k]);
    if(tw === 'flash') lo = Math.max(4, lo - 2);
    if(tw === 'ice') lo = Math.max(4, Math.min(12, Math.round(lo * .7)));
    if(has('once') || has('oneway')) lo = Math.max(4, lo - 1);   /* 규칙을 붙이면 최단 수가 늘어나기 쉬움 */
    const hi = lo + (c === 1 ? 2 : 3);
    const extra = (p.boss ? 1 : 0) + (k === 5 ? 1 : 0);
    const once = has('once') ? 1 + extra : 0, oneway = has('oneway') ? 1 + extra : 0;
    let limit = 40 + lo * 9;
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    return { size:tw === 'big' ? 7 : 6, pillar:has('pillar'), pair:has('pair'), ice:tw === 'ice', once, oneway, lo, hi,
      limit:round5(limit), hints:tw === 'bare' ? 0 : p.boss ? 2 : 3, cap:tw === 'limit' ? 2 : 0, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 판 만들기: 문제 목록에서 rng로 고르고 뒤집기·색·규칙을 rng로 =====
     같은 씨앗 = 같은 판. 규칙(한 번 차·일방통행)을 붙이면 풀이 도구로 다시 풀어 최단 수를 새로 잰다(못 풀면 그 규칙은 다른 차에). */
  function makeBoard(cfg, rng){
    const N = cfg.size || 6, W = N, H = N;
    const cat = N + (cfg.pillar ? 'p' : '') + (cfg.pair ? '2' : '') + (cfg.ice ? 'i' : '');
    const list = (PARKING_BANK[cat] || PARKING_BANK[N + ''] || PARKING_BANK['6']).map(s => s.split('|'));
    const lo = cfg.lo || 6, hi = cfg.hi || lo + 3, mid = (lo + hi) / 2;
    let cand = list.filter(x => +x[2] >= lo && +x[2] <= hi);
    if(!cand.length) cand = list.slice().sort((a, b) => Math.abs(a[2] - mid) - Math.abs(b[2] - mid) || (a[0] < b[0] ? -1 : 1)).slice(0, 6);
    const it = cand[Math.floor(rng() * cand.length)];
    const P = PKS.decode(it[0], W, H, it[1]);
    P.ice = !!cfg.ice; P.once = []; P.way = {};
    /* 뒤집기(좌우·상하): 출구가 왼쪽·위로 갈 수도 있다 */
    const fx = rng() < .5, fy = rng() < .5;
    P.cars.forEach((k, i) => {
      if(fx) k.c = W - k.c - (k.h ? k.len : 1);
      if(fy) k.r = H - k.r - (k.h ? 1 : k.len);
    });
    P.walls = P.walls.map(w => { let r = Math.floor(w / W), c = w % W; if(fx) c = W - 1 - c; if(fy) r = H - 1 - r; return r * W + c; });
    P.goals = P.goals.map(([i, g]) => { const k = P.cars[i]; return [i, k.h ? (fx ? W - k.len - g : g) : (fy ? H - k.len - g : g)]; });
    const pos0 = PKS.posOf(P), nGoal = P.goals.length;
    /* 목록의 최단 수·최단 풀이는 이미 정확하다(뒤집으면 위치만 뒤집음) → 판 만들 때 풀이 탐색을 하지 않는다(휴대폰에서 빠르게) */
    let sol = null;
    if(it[3] != null) sol = { n:+it[2], path:(it[3].match(/[A-Z]\d/g) || []).map(t => { const i = t.charCodeAt(0) - 65, k = P.cars[i]; let v = +t[1];
      if(k.h && fx) v = W - k.len - v; if(!k.h && fy) v = H - k.len - v; return [i, v]; }) };
    else if(cfg.once || cfg.oneway) sol = PKS.solve(P, pos0, 0);
    /* 규칙 붙이기(다시 풀지 않아도 되게): 최단 풀이에서 딱 한 번 움직이는 차 → 한 번 차, 한 방향으로만 움직이는 차 → 일방통행 차.
       그러면 그 최단 풀이가 그대로 통하므로 최단 수가 바뀌지 않는다(규칙은 다른 길만 막는다). 그런 차가 없으면 풀이에 안 쓰이는 차에 붙인다. */
    const use = P.cars.map(() => ({ n:0, dir:0, mixed:false }));
    if(sol){ const p = pos0.slice(); for(const [ci, v] of sol.path){ const u = use[ci], d = v > p[ci] ? 1 : -1; u.n++; if(u.dir && u.dir !== d) u.mixed = true; u.dir = d; p[ci] = v; } }
    const addRule = (kind, want) => {
      for(let t = 0; t < want && sol; t++){
        const free = i => i >= nGoal && !P.once.includes(i) && P.way[i] == null;
        const fit = i => kind === 'once' ? use[i].n === 1 : use[i].n >= 1 && !use[i].mixed;
        const good = [], rest = [];
        P.cars.forEach((_, i) => { if(!free(i)) return; if(fit(i)) good.push(i); else if(!use[i].n) rest.push(i); });
        const L = good.length ? good : rest; if(!L.length) break;
        const i = L[Math.floor(rng() * L.length)];
        if(kind === 'once') P.once.push(i); else P.way[i] = use[i].dir || (rng() < .5 ? 1 : -1);
      }
    };
    if(cfg.once) addRule('once', cfg.once);
    if(cfg.oneway) addRule('oneway', cfg.oneway);
    PKS.prep(P);
    /* 차 모양·색·바라보는 쪽(보이기만) */
    const pal = shuffle(PAL.slice(), rng);
    const look = P.cars.map((k, i) => {
      const goal = P.goals.find(g => g[0] === i);
      const kind = k.len === 3 ? (rng() < .5 ? 'truck' : 'bus') : ['car', 'car', 'mini', 'van'][Math.floor(rng() * 4)];
      const face = goal ? (goal[1] >= (k.h ? k.c : k.r) ? 1 : -1) : (rng() < .5 ? 1 : -1);
      return { kind:i < nGoal ? 'car' : kind, col:i === 0 ? RED : i === 1 && nGoal > 1 ? YEL : pal[i % pal.length], face, mark:i === 0 ? 'heart' : i === 1 && nGoal > 1 ? 'star' : '' };
    });
    return { P, pos0, opt:sol ? sol.n : +it[2], path:sol ? sol.path : [], look };
  }

  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const carEl = i => document.querySelector(`.ng-parking .pk-car[data-i="${i}"]`);
  const isOnce = (m, i) => !!(m.P.onceMask & (1 << i));
  const usedUp = (m, i) => isOnce(m, i) && !!(m.used & (1 << i));

  /* ----- 화면 ----- */
  function hud(){
    const m = S(); if(!m) return;
    const mv = $('#pkMoves'); if(mv) mv.textContent = m.moves;
    const cp = $('#pkMovesP'); if(cp) cp.classList.toggle('over', m.capMax ? m.moves >= m.capMax : m.moves > m.opt);
    const h = $('#pkHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.phase !== 'play'; }
    const u = $('#pkUndo'); if(u) u.disabled = !m.hist.length || m.phase !== 'play';
    const r = $('#pkReset'); if(r) r.disabled = !m.hist.length || m.phase !== 'play';
  }
  function msg(html, cls){ const e = $('#pkMsg'); if(!e) return; e.className = 'pk-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return m.P.goals.length > 1 ? '<span>빨간 차·노란 차를 자리로!</span>' : '<span>차를 끌거나, 누르고 화살표로 밀어요</span>';
  }
  /* 출구 표지판이 판 밖으로 나오는 길이(px). 출구가 있는 쪽에만 자리를 비우고, 반대쪽은 거의 붙여서 판을 최대한 크게 */
  const SIGN = 26;
  function exitSides(m){
    const o = { l:0, r:0, t:0, b:0 };
    m.P.goals.forEach(([i, g]) => { const k = m.P.cars[i], lim = k.h ? m.W : m.H; if(!(g + k.len === lim || g === 0)) return;
      if(k.h) o[g === 0 ? 'l' : 'r'] = 1; else o[g === 0 ? 't' : 'b'] = 1; });
    return o;
  }
  function layout(){
    const m = S(), lot = $('#pkLot'), root = document.querySelector('.ng-parking'); if(!lot || !root) return;
    const sd = m.sides || (m.sides = exitSides(m)), wrap = lot.parentNode;
    const pl = sd.l ? SIGN + 2 : 2, pr = sd.r ? SIGN + 2 : 2, pt = sd.t ? SIGN + 4 : 2, pb = sd.b ? SIGN + 4 : 6;
    wrap.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    const W = Math.min((root.clientWidth || 360) + 24, 492) - pl - pr - 6;   /* 양옆 12px씩 더 씀(.pk-lotw 음수 여백) − 출구 표지판 자리 − 테두리 */
    const top = lot.getBoundingClientRect().top + (window.scrollY || 0);
    const Hh = Math.max(260, (innerHeight || 740) - top - 92 - pb);   /* 아래 단추 줄 */
    const pad = m.W >= 7 ? 9 : 10;
    let cs = Math.floor(Math.min((W - pad * 2) / m.W, (Hh - pad * 2) / m.H, 72));
    cs = Math.max(34, cs);
    m.geo = { cs, pad };
    lot.style.width = (cs * m.W + pad * 2) + 'px'; lot.style.height = (cs * m.H + pad * 2) + 'px';
    lot.style.setProperty('--cs', cs + 'px'); lot.style.setProperty('--pad', pad + 'px');
    /* 화면 높이 채우기(보이기만): 주차장은 가운데, 되돌리기·처음부터·힌트 줄은 엄지 자리(아래)로 */
    try{ const rt = root.getBoundingClientRect().top + (window.scrollY || 0); root.style.minHeight = Math.max(0, Math.floor((innerHeight || 740) - rt - 20)) + 'px'; }catch(_){}
    placeAll();
    if(m.sel != null) drawArw();
  }
  const xy = (m, i, v) => { const k = m.P.cars[i], g = m.geo; return [g.pad + (k.h ? v : k.c) * g.cs, g.pad + (k.h ? k.r : v) * g.cs]; };
  function place(i, v, anim){
    const m = S(), el = carEl(i); if(!el) return;
    const [x, y] = xy(m, i, v);
    el.classList.toggle('glide', !!anim);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function placeAll(){
    const m = S(), g = m.geo;
    m.P.cars.forEach((k, i) => {
      const el = carEl(i); if(!el) return;
      el.style.width = ((k.h ? k.len : 1) * g.cs) + 'px'; el.style.height = ((k.h ? 1 : k.len) * g.cs) + 'px';
      place(i, m.pos[i], false);
    });
    document.querySelectorAll('.ng-parking .pk-pillar').forEach(e => { const w = +e.dataset.w; e.style.transform = `translate(${g.pad + (w % m.W) * g.cs}px, ${g.pad + Math.floor(w / m.W) * g.cs}px)`; });
    document.querySelectorAll('.ng-parking .pk-goal').forEach(e => {
      const gi = +e.dataset.g, [i, gv] = m.P.goals[gi], k = m.P.cars[i], ex = e.dataset.kind;
      let x = g.pad + (k.h ? gv : k.c) * g.cs, y = g.pad + (k.h ? k.r : gv) * g.cs, w = (k.h ? k.len : 1) * g.cs, h = (k.h ? 1 : k.len) * g.cs;
      if(ex === 'exit'){   /* 벽에 뚫린 출구: 판 가장자리 여백(벽)을 지나 표지판까지 */
        const dir = +e.dataset.dir, ext = g.pad + 5;
        if(k.h){ w = ext; x = dir > 0 ? g.pad + m.W * g.cs : -5; }
        else { h = ext; y = dir > 0 ? g.pad + m.H * g.cs : -5; }
      }
      e.style.transform = `translate(${x}px, ${y}px)`; e.style.width = w + 'px'; e.style.height = h + 'px';
    });
    /* 출구 표지판: 판 밖, 출구 줄을 가운데로 2칸 폭, 빨간(노란) 화살 + "출구" */
    document.querySelectorAll('.ng-parking .pk-sign').forEach(e => {
      const gi = +e.dataset.g, [i] = m.P.goals[gi], k = m.P.cars[i], dir = +e.dataset.dir;
      const LW = m.W * g.cs + g.pad * 2, LH = m.H * g.cs + g.pad * 2, span = 2 * g.cs, out = SIGN + 3;
      let x, y, w, h;
      if(k.h){ w = out; h = span; x = dir > 0 ? LW - 1 : -out + 1; y = Math.max(0, Math.min(LH - span, g.pad + (k.r + .5) * g.cs - span / 2)); }
      else { h = out; w = span; y = dir > 0 ? LH - 1 : -out + 1; x = Math.max(0, Math.min(LW - span, g.pad + (k.c + .5) * g.cs - span / 2)); }
      e.style.transform = `translate(${x}px, ${y}px)`; e.style.width = w + 'px'; e.style.height = h + 'px';
    });
  }
  function floorSvg(m){
    const W = m.W, H = m.H, lines = [];
    for(let c = 1; c < W; c++) lines.push(`<path d="M${c * 10} 0V${H * 10}" />`);
    for(let r = 1; r < H; r++) lines.push(`<path d="M0 ${r * 10}H${W * 10}" class="d"/>`);
    return `<svg class="pk-floor" viewBox="0 0 ${W * 10} ${H * 10}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>`;
  }
  function goalsHtml(m){
    return m.P.goals.map(([i, g], gi) => {
      const k = m.P.cars[i], lim = k.h ? m.W : m.H, col = i === 0 ? 'red' : 'yel';
      const exit = g + k.len === lim || g === 0, dir = g === 0 ? -1 : 1;
      if(exit){
        const rot = k.h ? (dir > 0 ? 0 : 180) : (dir > 0 ? 90 : -90);
        return `<div class="pk-goal exit ${col} ${k.h ? 'h' : 'v'}" data-g="${gi}" data-kind="exit" data-dir="${dir}" aria-hidden="true"></div>`
          + `<div class="pk-sign ${col} ${k.h ? 'h' : 'v'}" data-g="${gi}" data-dir="${dir}" aria-hidden="true"><svg viewBox="0 0 24 24"><path transform="rotate(${rot} 12 12)" d="M3 9h9V4l9 8-9 8v-5H3z" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/></svg><span>출구</span></div>`;
      }
      return `<div class="pk-goal spot ${col} ${k.h ? 'h' : 'v'}" data-g="${gi}" data-kind="spot" aria-hidden="true"><b>P</b></div>`;
    }).join('');
  }
  function badge(m, i){
    if(isOnce(m, i)) return `<span class="pk-badge once${usedUp(m, i) ? ' used' : ''}" aria-hidden="true">${usedUp(m, i) ? ICO.lock : '<b>1</b>'}</span>`;
    const w = m.P.way[i]; if(w){ const k = m.P.cars[i]; return `<span class="pk-badge way" aria-hidden="true"><b>${k.h ? (w > 0 ? '→' : '←') : (w > 0 ? '↓' : '↑')}</b></span>`; }
    return '';
  }
  function carName(m, i){
    const k = m.P.cars[i], L = m.look[i];
    const nm = i === 0 ? '빨간 내 차' : i === 1 && m.P.goals.length > 1 ? '노란 친구 차' : ({ truck:'트럭', bus:'버스', mini:'꼬마 차', van:'승합차' }[L.kind] || '차');
    return nm + (k.h ? ' 가로' : ' 세로') + (isOnce(m, i) ? (usedUp(m, i) ? ' 움직임 끝남' : ' 한 번만') : '') + (m.P.way[i] ? ' 한 방향만' : '');
  }
  function carHtml(m, i){
    const k = m.P.cars[i], L = m.look[i];
    return `<button class="pk-car${i === 0 ? ' mine' : ''}${i === 1 && m.P.goals.length > 1 ? ' pal' : ''}${usedUp(m, i) ? ' used' : ''} ${k.h ? 'h' : 'v'}" data-i="${i}" aria-label="${carName(m, i)}">${carSvg(L.kind, k.len, L.col, k.h, L.face, L.mark)}${badge(m, i)}</button>`;
  }
  function refreshCar(i){ const m = S(), el = carEl(i); if(!el) return; const b = el.querySelector('.pk-badge'); if(b) b.outerHTML = badge(m, i); el.classList.toggle('used', usedUp(m, i)); el.setAttribute('aria-label', carName(m, i)); }

  /* ----- 움직이기 ----- */
  function canPlay(){ const m = S(); return m && !G.over && !G.paused && m.phase === 'play'; }
  function bounds(i){
    const m = S(); let [lo, hi] = PKS.range(m.P, m.pos, i); const w = m.P.way[i] || 0;
    if(w > 0) lo = m.pos[i]; if(w < 0) hi = m.pos[i];
    return [lo, hi];
  }
  /* 한 수 확정. 같은 차를 이어서 움직이면 한 수로 친다(제자리로 돌아오면 그 수는 없던 일) */
  function commit(i, v){
    const m = S(), from = m.pos[i];
    if(v === from){ place(i, v, true); return false; }
    const last = m.hist[m.hist.length - 1], merge = last && last.car === i && !isOnce(m, i);
    if(!merge && m.capMax && m.moves >= m.capMax){
      place(i, from, true); bump(i);
      msg('<b class="bad">수를 다 썼어요</b><span>되돌려서 다시 생각해요</span>', 'pk-pop'); sfx('pkBump');
      T(() => { if(m.phase === 'play') msg(playMsg()); }, 1400);
      return false;
    }
    if(merge){
      m.pos[i] = v;
      if(last.pos[i] === v){ m.hist.pop(); m.moves = last.mv; }
    } else {
      m.hist.push({ pos:m.pos.slice(), used:m.used, car:i, mv:m.moves });
      m.pos[i] = v; m.moves++;
      if(isOnce(m, i)){ m.used |= 1 << i; refreshCar(i); sfx('pkLock'); }
    }
    clearHint();
    place(i, v, true);
    sfx('pkMove', { n:Math.abs(v - from) });
    try{ const el = carEl(i); if(el && !FXR.reduce){ const q = fxCenter(el), k = m.P.cars[i], dir = v > from ? 1 : -1;
      fxEmit(q.x - (k.h ? dir * q.w * .45 : 0), q.y - (k.h ? 0 : dir * q.h * .45), { quantity:4, speed:{ min:10, max:40 }, angle:k.h ? (dir > 0 ? { min:160, max:200 } : { min:-20, max:20 }) : (dir > 0 ? { min:250, max:290 } : { min:70, max:110 }), lifespan:{ min:300, max:500 }, kind:'smoke', tint:['#FFFFFF', '#D8D2F5'], scale:{ start:2.6, end:4.5 }, alpha:{ start:.6, end:0 } }); } }catch(_){}
    hud(); afterMove();
    return true;
  }
  function afterMove(){
    const m = S();
    if(PKS.isGoal(m.P, m.pos)){ win(); return; }
    m.dirty = true;
    /* 풀이 탐색은 필요할 때만(7×7은 휴대폰에서 무거움): 대전(진행 막대) · 막힐 수 있는 규칙(한 번 차·일방통행·빙판)의 막힘 알림.
       그 밖에는 힌트를 누를 때·끝날 때(진행률) 한 번 계산한다 */
    if(!(G.duel || m.P.ice || m.P.onceMask || Object.keys(m.P.way).length)) return;
    m.solveTok = (m.solveTok || 0) + 1; const tok = m.solveTok;
    T(() => { if(m.solveTok === tok) analyse(); }, 60);
  }
  /* 지금 상태에서 최단 풀이(힌트·진행률·막힘 알림) */
  function analyse(){
    const m = S(); if(!m) return null;
    const key = PKS.keyOf(m.pos, m.used);
    m.dirty = false;
    if(m.memo.has(key)) { const r = m.memo.get(key); m.dist = r ? r.n : -1; m.next = r && r.path[0]; return r; }
    const r = PKS.solve(m.P, m.pos, m.used);
    m.memo.set(key, r); if(m.memo.size > 300) m.memo.clear();
    m.dist = r ? r.n : -1; m.next = r && r.path[0];
    if(!r && m.phase === 'play') msg('<b class="bad">길이 막혔어요</b><span>되돌리기나 처음부터!</span>', 'pk-pop');
    else if(m.phase === 'play' && m.wasStuck) msg(playMsg());
    m.wasStuck = !r;
    return r;
  }
  function bump(i){ try{ const el = carEl(i); if(el && el.animate && !FXR.reduce){ const k = S().P.cars[i]; el.animate([{ translate:'0 0' }, { translate:k.h ? '4px 0' : '0 4px' }, { translate:k.h ? '-4px 0' : '0 -4px' }, { translate:'0 0' }], { duration:220 }); } }catch(_){} }
  function undo(){
    const m = S(); if(!canPlay() || !m.hist.length) return;
    const last = m.hist.pop(), moved = [];
    m.pos.forEach((v, i) => { if(v !== last.pos[i]) moved.push(i); });
    const usedBefore = m.used;
    m.pos = last.pos.slice(); m.used = last.used; m.moves = last.mv;
    moved.forEach(i => place(i, m.pos[i], true));
    m.P.cars.forEach((_, i) => { if((usedBefore ^ m.used) & (1 << i)) refreshCar(i); });
    clearHint(); clearSel(); sfx('pkUndo'); hud(); afterMove();
  }
  function restart(){
    const m = S(); if(!canPlay() || !m.hist.length) return;
    const usedBefore = m.used;
    m.pos = m.pos0.slice(); m.used = 0; m.moves = 0; m.hist = []; m.restarts++;
    m.P.cars.forEach((_, i) => { place(i, m.pos[i], true); if(usedBefore & (1 << i)) refreshCar(i); });
    clearHint(); clearSel(); sfx('pkUndo', { all:1 }); hud(); afterMove();
    try{ fxPunch($('#pkLot'), 1.02); }catch(_){}
  }
  function clearHint(){ const g = $('#pkGhost'); if(g) g.remove(); document.querySelectorAll('.ng-parking .pk-car.hint').forEach(e => e.classList.remove('hint')); }

  /* ----- 누르고 화살표로 밀기(끌기가 어려운 사람용): 차를 누르면 갈 수 있는 쪽 빈칸에 큰 화살표(56px) ----- */
  const ARW = rot => `<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(${rot} 12 12)" d="M4 9.5h8V5l8.5 7-8.5 7v-4.5H4z" fill="#FFE27A" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  function clearSel(){
    const m = S(); if(m) m.sel = null;
    document.querySelectorAll('.ng-parking .pk-arw').forEach(e => e.remove());
    document.querySelectorAll('.ng-parking .pk-car.sel').forEach(e => e.classList.remove('sel'));
  }
  function drawArw(){
    const m = S(), lot = $('#pkLot'), i = m && m.sel;
    document.querySelectorAll('.ng-parking .pk-arw').forEach(e => e.remove());
    document.querySelectorAll('.ng-parking .pk-car.sel').forEach(e => e.classList.remove('sel'));
    if(!lot || i == null || !canPlay() || usedUp(m, i)){ if(m) m.sel = null; return; }
    const k = m.P.cars[i], [lo, hi] = bounds(i), p = m.pos[i], g = m.geo, dirs = [];
    if(p > lo) dirs.push(-1); if(p < hi) dirs.push(1);
    if(!dirs.length){ m.sel = null; return; }
    const el = carEl(i); if(el) el.classList.add('sel');
    lot.insertAdjacentHTML('beforeend', dirs.map(d => {
      const cell = d < 0 ? p - 1 : p + k.len;   /* 차 끝 바로 옆 빈칸 */
      const cx = g.pad + ((k.h ? cell : k.c) + .5) * g.cs, cy = g.pad + ((k.h ? k.r : cell) + .5) * g.cs;
      const rot = k.h ? (d > 0 ? 0 : 180) : (d > 0 ? 90 : -90), nm = k.h ? (d > 0 ? '오른쪽' : '왼쪽') : (d > 0 ? '아래' : '위');
      return `<button class="pk-arw" data-d="${d}" style="transform:translate(${cx}px, ${cy}px)" aria-label="${carName(m, i)}, ${nm}으로 밀기">${ARW(rot)}</button>`;
    }).join(''));
  }
  function selCar(i){
    const m = S(); m.sel = i; drawArw();
    if(m.sel != null){ sfx('pkGrab'); if(!m.toldArw){ m.toldArw = true; msg('<span>화살표를 누르면 한 칸씩 밀려요</span>', 'pk-pop'); T(() => { if(m.phase === 'play') msg(playMsg()); }, 1600); } }
  }
  function stepSel(d){
    const m = S(), i = m.sel; if(i == null || !canPlay()) return;
    const [lo, hi] = bounds(i), p = m.pos[i];
    const v = m.P.ice ? (d > 0 ? hi : lo) : Math.max(lo, Math.min(hi, p + d));   /* 빙판: 끝까지 미끄러짐 */
    if(v === p){ bump(i); sfx('pkBump'); return; }
    commit(i, v);
    if(m.sel === i) drawArw();
  }
  function useHint(){
    const m = S(); if(!canPlay() || m.hintLeft <= 0) return;
    const r = analyse(); if(!r || !r.path.length) return;
    const [i, v] = r.path[0], k = m.P.cars[i], g = m.geo;
    m.hintLeft--; m.hints++; hud(); clearHint(); clearSel();
    const el = carEl(i); if(el) el.classList.add('hint');
    const [x, y] = xy(m, i, v), dir = v > m.pos[i] ? 1 : -1;
    const lot = $('#pkLot');
    lot.insertAdjacentHTML('beforeend', `<div class="pk-ghost" id="pkGhost" style="transform:translate(${x}px, ${y}px); width:${(k.h ? k.len : 1) * g.cs}px; height:${(k.h ? 1 : k.len) * g.cs}px" aria-hidden="true"><i>${k.h ? (dir > 0 ? '→' : '←') : (dir > 0 ? '↓' : '↑')}</i></div>`);
    msg('<b>힌트</b><span>반짝이는 차를 점선 칸까지!</span>', 'pk-pop');
    sfx('pkHint');
  }

  /* 끌기: 칸 단위로 스냅, 길이 막힌 곳에서 멈춤 */
  function wire(){
    const m = S(), lot = $('#pkLot');
    let D = null;
    lot.onclick = e => { const a = e.target.closest && e.target.closest('.pk-arw'); if(a && canPlay()) stepSel(+a.dataset.d); };
    lot.onpointerdown = e => {
      if(e.target.closest && e.target.closest('.pk-arw')) return;   /* 화살표는 click으로 */
      const el = e.target.closest && e.target.closest('.pk-car');
      if(!el){ if(m.sel != null) clearSel(); return; }
      if(D) return;
      e.preventDefault();
      if(!canPlay()) return;
      const i = +el.dataset.i;
      if(usedUp(m, i)){ bump(i); sfx('pkBump'); msg('<b class="bad">이미 움직인 차예요</b><span>①차는 한 번만!</span>', 'pk-pop'); T(() => { if(m.phase === 'play') msg(playMsg()); }, 1200); return; }
      const [lo, hi] = bounds(i);
      D = { i, el, id:e.pointerId, x0:e.clientX, y0:e.clientY, p0:m.pos[i], lo, hi, v:m.pos[i], moved:false };
      try{ el.setPointerCapture(e.pointerId); }catch(_){}
      el.classList.add('drag'); el.classList.remove('glide');
      sfx('pkGrab');
    };
    lot.onpointermove = e => {
      if(!D || e.pointerId !== D.id) return;
      const k = m.P.cars[D.i], d = (k.h ? e.clientX - D.x0 : e.clientY - D.y0) / m.geo.cs;
      if(Math.abs(d) > .08) D.moved = true;
      let v = D.p0 + d;
      /* 막힌 쪽으로는 살짝만(고무줄 느낌) */
      if(v < D.lo) v = D.lo - Math.min(.12, (D.lo - v) * .2);
      if(v > D.hi) v = D.hi + Math.min(.12, (v - D.hi) * .2);
      D.v = v;
      const [x, y] = xy(m, D.i, v); D.el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const up = e => {
      if(!D || e.pointerId !== D.id) return;
      const d = D; D = null;
      d.el.classList.remove('drag');
      if(!canPlay()){ place(d.i, m.pos[d.i], true); return; }
      let v = Math.max(d.lo, Math.min(d.hi, Math.round(d.v)));
      if(m.P.ice && v !== d.p0) v = v > d.p0 ? d.hi : d.lo;   /* 빙판: 끝까지 미끄러짐 */
      if(!d.moved){   /* 누르기만 함 → 화살표 보이기(다시 누르면 숨김) */
        place(d.i, d.p0, true);
        if(d.lo === d.hi){ clearSel(); bump(d.i); sfx('pkBump'); return; }
        if(m.sel === d.i) clearSel(); else selCar(d.i);
        return;
      }
      clearSel();
      if(v === d.p0){ place(d.i, d.p0, true); return; }
      commit(d.i, v);
    };
    lot.onpointerup = up; lot.onpointercancel = up;
    lot.onkeydown = e => {
      const el = e.target.closest && e.target.closest('.pk-car'); if(!el || !canPlay()) return;
      const i = +el.dataset.i, k = m.P.cars[i];
      const d = k.h ? { ArrowLeft:-1, ArrowRight:1 }[e.key] : { ArrowUp:-1, ArrowDown:1 }[e.key];
      if(!d) return;
      e.preventDefault();
      if(usedUp(m, i)){ bump(i); return; }
      const [lo, hi] = bounds(i), p = m.pos[i];
      let v = m.P.ice ? (d > 0 ? hi : lo) : Math.max(lo, Math.min(hi, p + d));
      if(v === p){ bump(i); sfx('pkBump'); return; }
      clearSel(); commit(i, v);
      const n = carEl(i); if(n) n.focus();
    };
    $('#pkUndo').onclick = undo; $('#pkReset').onclick = restart;
    const h = $('#pkHint'); if(h) h.onclick = useHint;
  }

  /* ----- 시계·끝 ----- */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#pkBar');
    /* 차 세우기(0.45초) 뒤 시작. 대전은 두 사람이 같은 시계(엔진의 시작 시각)를 써야 하므로 시계를 다시 맞추지 않는다 */
    if(m.phase === 'deal'){ if(t >= .45){ m.phase = 'play'; if(!G.duel){ G.start = Date.now(); G.pausedMs = 0; } msg(playMsg()); sfx('pkGo'); hud(); } return; }
    if(m.phase !== 'play' || !G.limit) return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#pkTime'); if(e) e.textContent = mmss(sec);
      const p = $('#pkTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#pkBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('pkTick', { hi:sec <= 5 }); try{ if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }catch(_){} }
    }
    if(rem <= 0) timeUp();
  }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed(); m.dist = 0; clearHint(); clearSel(); hud();
    msg('<b>주차 성공!</b><span>' + m.moves + '수' + (m.moves <= m.opt ? ' · 최단!' : '') + '</span>', 'pk-win');
    sfx('pkHonk'); fxBuzz([30, 50, 30]);
    T(() => {
      try{
        m.P.goals.forEach(([i, g]) => {
          const el = carEl(i), k = m.P.cars[i], lim = k.h ? m.W : m.H; if(!el) return;
          const exit = g + k.len === lim || g === 0;
          const q = fxCenter(el);
          if(exit){
            /* '부릉': 제자리에서 부르르 떨다가 매연을 뿜으며 출구 밖으로 달려 나감(보이기만) */
            const dir = g === 0 ? -1 : 1, v = g + dir * (k.len + 1.6);
            el.classList.add('rev'); sfx('pkVroom');
            try{ fxFloat(q.x, q.y - q.h * .6, '부릉!', 'pkf'); }catch(_){}
            const puff = (n, dl) => T(() => { try{ if(FXR.reduce) return; const p = fxCenter(el);
              fxEmit(p.x - (k.h ? dir * p.w * .5 : 0), p.y - (k.h ? 0 : dir * p.h * .5), { quantity:n, speed:{ min:20, max:70 }, angle:k.h ? (dir > 0 ? { min:160, max:200 } : { min:-20, max:20 }) : (dir > 0 ? { min:250, max:290 } : { min:70, max:110 }), lifespan:{ min:400, max:700 }, kind:'smoke', tint:['#FFFFFF', '#C9C2E6'], scale:{ start:3, end:6 }, alpha:{ start:.75, end:0 } }); }catch(_){} }, dl);
            puff(5, 0); puff(4, 180);
            T(() => { el.classList.remove('rev'); el.classList.add('out'); place(i, v, true); puff(6, 60); puff(4, 220); }, 300);
          }
          else el.classList.add('parked');
          fxBurst(q.x, q.y, [i === 0 ? '#FF4D5E' : '#FFD23F', '#FFE27A', '#FFFFFF'], 16, { speed:260, size:5, kinds:['star', 'dot', 'spark'], up:120, g:420, glow:true, dur:.8 });
        });
        const lot = $('#pkLot'); if(lot){ lot.classList.add('cleared'); const p = fxCenter(lot); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); }
      }catch(_){}
    }, 120);
    T(() => finish(true), 1500);
  }
  function lose(text){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; clearHint(); clearSel(); hud();
    if(m.dirty) analyse();
    msg('<b class="bad">' + text + '</b>' + (m.dist > 0 ? '<span>남은 최단 ' + m.dist + '수</span>' : ''), 'pk-pop');
    sfx('pkTimeUp'); fxBuzz([40, 40, 60]); try{ fxShake($('#pkLot'), 6); }catch(_){}
    T(() => finish(false), 1400);
  }
  function timeUp(){ const e = $('#pkTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요'); }

  return {
    name:'자동차 주차하기', abil:'공간지각', col:['#FFB3BC', '#FF4D5E', '#B3122E'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8.5A3.5 3.5 0 0 1 7.5 5h9A3.5 3.5 0 0 1 20 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 15.5z"/><rect x="8" y="7.5" width="6" height="9" rx="1.6" fill="#fff" opacity=".55"/><path d="M2 12h2M20 12h2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    art(){
      const u = 'pkA' + Math.floor(performance.now() * 1000 % 1e6);
      const cs = 15, ox = 33, oy = 6, car = (r, c, L, h, col, kind, face, mark) => `<g transform="translate(${ox + c * cs + 1} ${oy + r * cs + 1}) scale(${(((h ? L : 1) * cs - 2) / (h ? L * 100 : 100)).toFixed(4)} ${(((h ? 1 : L) * cs - 2) / (h ? 100 : L * 100)).toFixed(4)})">${carSvg(kind, L, col, h, face, mark).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;   /* 안쪽 <svg>는 카드 CSS(svg{width:100%})에 늘어나므로 g로 */
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9E4FF"/><stop offset="1" stop-color="#B9ACF5"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <rect x="${ox - 5}" y="${oy - 5}" width="${cs * 6 + 10}" height="${cs * 6 + 10}" rx="9" fill="#C9C1F0" stroke="${OL}" stroke-width="2.4"/>
        <rect x="${ox}" y="${oy}" width="${cs * 6}" height="${cs * 6}" rx="4" fill="#3A3170"/>
        <g stroke="#fff" stroke-opacity=".22" stroke-width="1">${[1, 2, 3, 4, 5].map(c => `<path d="M${ox + c * cs} ${oy}v${cs * 6}"/>`).join('')}</g>
        <rect x="${ox + cs * 6}" y="${oy + cs * 2}" width="14" height="${cs}" fill="#3A3170"/>
        <path d="M${ox + cs * 6 + 4} ${oy + cs * 2 + 4}l5 3.5-5 3.5" fill="none" stroke="#FFD23F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        ${car(2, 1, 2, true, RED, 'car', 1, 'heart')}${car(0, 3, 3, false, PAL[0], 'bus', 1)}${car(3, 0, 3, true, PAL[3], 'truck', -1)}${car(0, 0, 2, true, PAL[1], 'mini', 1)}
        ${car(1, 5, 2, false, PAL[2], 'van', -1)}${car(4, 4, 2, false, PAL[4], 'car', 1)}${car(5, 1, 2, true, PAL[5], 'mini', -1)}
        <circle cx="${ox + cs * 1.5}" cy="${oy + cs * 4.5}" r="5.5" fill="#FFD23F" stroke="${OL}" stroke-width="1.8"/></svg>`;
    },
    help:[
      ['차를 앞뒤로 밀어요', '차를 끌거나, 차를 누르고 옆에 나온 화살표를 눌러 밀어요. 가로 차는 좌우, 세로 차는 위아래로만 가요.'],
      ['빨간 내 차를 출구로', '하트가 그려진 빨간 차를 빨간 화살 "출구"(또는 P 칸)까지 보내면 성공! 길을 막는 차를 비켜 세워요.'],
      ['적은 수가 고수', '차 한 대를 한 번 미는 것이 한 수(같은 차를 이어서 밀면 한 수). 최단 수로 풀면 ★★★! 되돌리기는 벌칙 없어요.'],
      ['막히면 힌트', '💡힌트는 다음에 밀 차와 갈 칸을 보여 줘요. 대신 점수가 ' + HINT_PEN + '점 줄어요.']
    ],
    /* 도움말 v2(공용 WP3가 읽음): 3줄 + 더 알아보기. 솔로 새 규칙은 개념 카드에서만 설명 */
    howto:{ lines:['차를 끌거나, 누르고 화살표로 밀어요', '빨간 내 차를 출구까지 보내요', '적은 수로 풀수록 별이 많아요'],
      more:[['한 수 세기', '같은 차를 이어서 밀면 한 수예요. 되돌리기·처음부터는 벌칙이 없어요.'], ['힌트', '다음에 밀 차와 갈 칸을 보여 줘요(점수 −' + HINT_PEN + ').'], ['대전', '같은 주차장을 동시에! 내 차를 먼저 빼면 이겨요(2분).']] },
    helpExtra(){ const m = G && G.id === 'parking' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['동네 골목', '마트 주차장', '항구 하역장', '공항 주차빌딩', '눈꽃 스키장'],
    starRule:'★ 주차 성공 · ★★ 힌트 1번 이하, 최단+여유 수 안 · ★★★ 힌트 없이 최단 수로',
    levels:{
      easy:{ size:6, lo:6, hi:9, limit:150, hints:3 },
      normal:{ size:6, lo:10, hi:15, limit:210, hints:3 },
      hard:{ size:6, lo:16, hi:25, limit:300, hints:3 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.size}×${c.size} · 최단 ${c.lo}~${c.hi}수 · ${mmss(c.limit)}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.size}×${c.size} · 최단 ${c.lo}~${c.hi}수`; },
    init(cfg, rng){
      if(G.duel && !G.adv && !cfg.duel) cfg = Object.assign({}, cfg, DUEL);
      const b = makeBoard(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { P:b.P, W:b.P.W, H:b.P.H, pos0:b.pos0.slice(), pos:b.pos0.slice(), used:0, look:b.look, opt:b.opt, path0:b.path,
        moves:0, hist:[], hints:0, restarts:0, hintLeft:cfg.hints == null ? 3 : cfg.hints, capMax:cfg.cap ? b.opt + cfg.cap : 0,
        dist:b.opt, next:b.path[0] || null, memo:new Map(), phase:'deal', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips,
        lastSec:-1, sec:0, timers:new Set(), geo:{ cs:52, pad:10 }, sel:null };
      G.limit = cfg.limit;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 최단 풀이대로 끝까지 움직인다 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.moves); return; }
          if(m.phase !== 'play'){ setTimeout(step, 60); return; }
          const r = analyse(); if(!r || !r.path.length){ res(-1); return; }
          const [i, v] = r.path[0]; commit(i, v); setTimeout(step, 260);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _make:makeBoard, _stage:stageCfg,
    duelCfg(){ return Object.assign({}, DUEL); },
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-parking">
        <div class="hud-row">
          <div class="hchip pk-moves" id="pkMovesP" aria-label="움직인 수"><span class="hv">${ICO.move}<b id="pkMoves">0</b><small>/${m.capMax || m.opt}수</small></span><em>${m.capMax ? '움직인 수 / 최대' : '움직인 수 / 최단'}</em></div>
          <div class="hchip time" id="pkTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="pkTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="pk-rules" aria-label="켜진 규칙">${m.boss ? '<span class="pk-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="pk-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="pk-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="pk-barw" id="pkBarWrap"><i id="pkBar"></i></div>
        <div class="pk-msg" id="pkMsg"><span>차를 세우는 중…</span></div>
        <div class="pk-lotw"><div class="pk-lot in${m.P.ice ? ' ice' : ''}" id="pkLot" role="group" aria-label="주차장 ${m.W}×${m.H}">
          ${floorSvg(m)}${goalsHtml(m)}
          ${m.P.walls.map(w => `<span class="pk-pillar" data-w="${w}" aria-hidden="true">${PILLAR}</span>`).join('')}
          ${m.P.cars.map((_, i) => carHtml(m, i)).join('')}
        </div></div>
        <div class="tools-row pk-ctl">
          <button class="tool" id="pkUndo" aria-label="되돌리기">${ICO.undo}<span>되돌리기</span></button>
          <button class="tool" id="pkReset" aria-label="처음부터">${ICO.reset}<span>처음부터</span></button>
          <button class="tool item" id="pkHint" aria-label="힌트">${ICO.hint}<span>힌트</span><b class="cnt">${m.hintLeft}</b></button>
        </div>
      </div>`;
      layout(); wire(); hud();
      T(() => { const l = $('#pkLot'); if(l) l.classList.remove('in'); }, 900);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; if(!m || !m.opt) return 0; if(m.phase === 'done' && m.dist === 0) return 1; if(m.dirty) analyse(); return m.dist < 0 ? 0 : Math.max(0, Math.min(1, 1 - m.dist / m.opt)); },
    lossText(){ const m = G.m; return `최단 ${m.opt}수 판에서 ${m.moves}수 움직였어요` + (m.dist > 0 ? ` (남은 최단 ${m.dist}수)` : '') + '.'; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit || 1, m.sec || elapsed()));
      const time = G.limit ? Math.max(0, 300 - Math.floor(sec * 300 / G.limit)) : 150;
      const extra = Math.max(0, 200 - 25 * Math.max(0, m.moves - m.opt) - HINT_PEN * m.hints);
      return { base:500, time, extra, rows:[`주차 성공 (최단 ${m.opt}수)`, '시간 보너스 (' + mmss(sec) + ')', `이동 ${m.moves}수 · 힌트 ${m.hints}`] };
    },
    stars(){ const m = G.m; return m.hints === 0 && m.moves <= m.opt ? 3 : m.hints <= 1 && m.moves <= m.opt + Math.max(2, Math.ceil(m.opt * .25)) ? 2 : 1; },
    css:`
body[data-mode="parking"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 14px, transparent 14px 28px),
  linear-gradient(180deg,#EEEAFF 0%,#D2C9FF 55%,#B5A8F5 100%) fixed}
.ng-parking{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-parking .hud-row{margin:0}
.ng-parking .hchip.pk-moves.over b{color:#E5484D}
.ng-parking .hchip.time.hurry{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)} .ng-parking .hchip.time.hurry b{color:#E5484D}
.ng-parking .pk-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-parking .pk-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#B9A8FF,#6A4BE0); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-parking .pk-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-parking .pk-msg{width:100%; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#3A2C86; white-space:nowrap; overflow:hidden}
.ng-parking .pk-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-parking .pk-msg b.boss{color:#FFE27A}
.ng-parking .pk-msg b.bad{color:#FF8A8F}
.ng-parking .pk-msg.pk-pop, .ng-parking .pk-msg.pk-win{animation:parking-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-parking .pk-msg.pk-win b{font-size:24px; color:#FFE27A}
@keyframes parking-in{from{transform:scale(.6); opacity:0}}
.ng-parking .pk-lotw{padding:2px 2px 6px; margin:auto -12px; display:flex; justify-content:center}
.ng-parking .pk-lot{position:relative; box-sizing:content-box; border-radius:18px; touch-action:none;
  background:repeating-linear-gradient(45deg,#D4CCF5 0 10px,#C6BDEE 10px 20px); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.7), 0 5px 0 #1A0F45, 0 14px 22px rgba(40,20,110,.25)}
.ng-parking .pk-floor{position:absolute; left:var(--pad); top:var(--pad); width:calc(100% - var(--pad) * 2); height:calc(100% - var(--pad) * 2); border-radius:8px;
  background:radial-gradient(circle at 50% 35%, #463C86 0%, #322A6A 100%); box-shadow:inset 0 0 0 2.5px #1A0F45, inset 0 3px 8px rgba(0,0,0,.35); stroke:#fff; stroke-opacity:.22; stroke-width:.35; fill:none}
.ng-parking .pk-floor .d{stroke-dasharray:1.6 1.6; stroke-opacity:.12}
.ng-parking .pk-lot.ice .pk-floor{background:radial-gradient(circle at 50% 35%, #8FD8F5 0%, #5AA8D8 100%); stroke-opacity:.5}
.ng-parking .pk-goal{position:absolute; left:0; top:0; pointer-events:none; display:flex; align-items:center; justify-content:center}
.ng-parking .pk-goal.exit{background:#322A6A; border:2.5px solid #1A0F45; z-index:1}
.ng-parking .pk-goal.exit.h{border-left:0; border-right:0}
.ng-parking .pk-goal.exit.v{border-top:0; border-bottom:0; flex-direction:column}
.ng-parking .pk-goal.exit.red{background:linear-gradient(90deg,#322A6A,#5A2A55)} .ng-parking .pk-goal.exit.red.v{background:linear-gradient(180deg,#322A6A,#5A2A55)}
/* 출구 표지판(판 밖, 2칸 폭): 흰 판 + 빨간(노란) 화살 + "출구" 15px */
.ng-parking .pk-sign{position:absolute; left:0; top:0; z-index:2; pointer-events:none; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:3px;
  background:#FFF4F5; border:2.5px solid #1A0F45; border-radius:10px; box-shadow:0 3px 0 #1A0F45}
.ng-parking .pk-sign.h{flex-direction:column; padding:4px 0}
.ng-parking .pk-sign svg{width:22px; height:22px; flex:none; fill:#FF4D5E; animation:parking-go 1s ease-in-out infinite alternate}
.ng-parking .pk-sign.v svg{animation-name:parking-gov}
.ng-parking .pk-sign span{font-family:var(--disp); font-size:15px; line-height:1.05; color:#C8213B; white-space:nowrap}
.ng-parking .pk-sign.h span{writing-mode:vertical-rl; text-orientation:upright; letter-spacing:1px}
.ng-parking .pk-sign.yel{background:#FFFBE6}
.ng-parking .pk-sign.yel svg{fill:#FFD23F}
.ng-parking .pk-sign.yel span{color:#8A5A00}
@keyframes parking-go{from{transform:translate(0,0)} to{transform:translate(3px,0)}}
@keyframes parking-gov{from{transform:translate(0,0)} to{transform:translate(0,3px)}}
.ng-parking .pk-goal.spot{border:3px dashed #FF7A86; border-radius:12px; background:rgba(255,77,94,.16); z-index:1}
.ng-parking .pk-goal.spot.yel{border-color:#FFD23F; background:rgba(255,210,63,.16)}
.ng-parking .pk-goal.spot b{font-family:var(--heavy); font-weight:400; font-size:calc(var(--cs) * .5); color:rgba(255,255,255,.55)}
.ng-parking .pk-pillar{position:absolute; left:0; top:0; width:var(--cs); height:var(--cs); padding:calc(var(--cs) * .06); box-sizing:border-box; z-index:2; pointer-events:none}
.ng-parking .pk-pillar svg{width:100%; height:100%; display:block}
.ng-parking .pk-car{position:absolute; left:0; top:0; padding:calc(var(--cs) * .045); box-sizing:border-box; border:0; margin:0; background:none; z-index:3; cursor:grab;
  -webkit-tap-highlight-color:transparent; outline:none; font:inherit; touch-action:none; will-change:transform}
.ng-parking .pk-car svg{width:100%; height:100%; display:block; overflow:visible; transition:filter .15s}
.ng-parking .pk-car.glide{transition:transform .17s cubic-bezier(.3,1.3,.5,1)}
.ng-parking .pk-car.drag{z-index:5; cursor:grabbing}
.ng-parking .pk-car.drag svg{filter:drop-shadow(0 4px 0 rgba(26,15,69,.5)) brightness(1.06)}
.ng-parking .pk-car:focus-visible svg{filter:drop-shadow(0 0 0 #FFE27A) drop-shadow(0 0 4px #FFE27A) drop-shadow(0 0 2px #FFE27A)}
.ng-parking .pk-car.mine svg{filter:drop-shadow(0 0 5px rgba(255,120,130,.75))}
.ng-parking .pk-car.used svg{filter:grayscale(.65) brightness(.85)}
.ng-parking .pk-car.hint svg{animation:parking-hint .6s ease-in-out infinite alternate}
@keyframes parking-hint{from{filter:drop-shadow(0 0 0 rgba(255,226,122,0))} to{filter:drop-shadow(0 0 7px #FFE27A) drop-shadow(0 0 3px #FFE27A)}}
/* 누르고 화살표로 밀기 */
.ng-parking .pk-car.sel svg{filter:drop-shadow(0 0 0 #FFE27A) drop-shadow(0 0 3px #FFE27A) drop-shadow(0 0 6px #FFE27A)}
.ng-parking .pk-arw{position:absolute; left:-28px; top:-28px; width:56px; height:56px; z-index:6; border-radius:50%; border:3px solid #1A0F45; padding:6px; margin:0; display:grid; place-items:center;
  background:radial-gradient(circle at 50% 35%, #5A4BB0, #2B2160); box-shadow:0 3px 0 #1A0F45, 0 0 0 3px rgba(255,226,122,.55); cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; animation:parking-arw .22s cubic-bezier(.2,1.5,.4,1)}
.ng-parking .pk-arw svg{width:100%; height:100%; display:block}
.ng-parking .pk-arw:active{scale:.92}
.ng-parking .pk-arw:focus-visible{outline:3px solid #FFE27A; outline-offset:2px}
@keyframes parking-arw{from{scale:.4; opacity:0}}
.ng-parking .pk-car.rev svg{animation:parking-rev .1s linear infinite alternate}
@keyframes parking-rev{from{translate:0 -1px} to{translate:0 1px}}
body[data-mode="parking"] .fxfloat.pkf{font-family:var(--heavy); font-weight:400; font-size:26px; color:#FFE27A; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill}
.ng-parking .pk-car.out{transition:transform .55s cubic-bezier(.5,0,.8,.4), opacity .55s ease-in .2s; opacity:0}
.ng-parking .pk-car.parked svg{animation:parking-park .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes parking-park{40%{transform:scale(1.1)}}
.ng-parking .pk-badge{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:calc(var(--cs) * .46); height:calc(var(--cs) * .46); border-radius:50%; display:grid; place-items:center;
  background:#fff; border:2.5px solid #1A0F45; box-shadow:0 2px 0 #1A0F45; pointer-events:none}
.ng-parking .pk-badge b{font-family:var(--heavy); font-weight:400; font-size:calc(var(--cs) * .3); line-height:1; color:#1A0F45}
.ng-parking .pk-badge.once{background:#FFE27A}
.ng-parking .pk-badge.used{background:#E8E4F7}
.ng-parking .pk-badge.used svg{width:72%; height:72%}
.ng-parking .pk-badge.way{background:#7CF0B0; border-radius:10px}
.ng-parking .pk-ghost{position:absolute; left:0; top:0; z-index:4; pointer-events:none; border:3px dashed #FFE27A; border-radius:14px; background:rgba(255,226,122,.2); display:grid; place-items:center; animation:parking-ghost .7s ease-in-out infinite alternate}
.ng-parking .pk-ghost i{font-style:normal; font-family:var(--heavy); font-size:calc(var(--cs) * .45); color:#FFE27A; -webkit-text-stroke:3px #1A0F45; paint-order:stroke fill}
@keyframes parking-ghost{to{background:rgba(255,226,122,.4)}}
.ng-parking .pk-lot.in .pk-car{animation:parking-deal .45s cubic-bezier(.2,1.5,.4,1) both}
.ng-parking .pk-lot.in .pk-car:nth-child(2n){animation-delay:.06s}
.ng-parking .pk-lot.in .pk-car:nth-child(3n){animation-delay:.12s}
@keyframes parking-deal{from{opacity:0; scale:.5}}
.ng-parking .pk-lot.cleared{animation:parking-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes parking-cheer{40%{scale:1.03}}
.ng-parking .pk-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-parking .pk-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#2B2160; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-parking .pk-chip.mj{background:#FFE3E6; color:#B3122E}
.ng-parking .pk-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-parking .pk-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-parking .pk-ctl{margin-top:8px}
.ng-parking .pk-ctl .tool{flex-direction:row; gap:6px; min-height:54px; font-size:16px}
.ng-parking .pk-ctl .tool .cnt{font-style:normal}
@media (max-width:370px){ .ng-parking .pk-ctl .tool{font-size:14px; gap:3px} .ng-parking .pk-msg b{font-size:18px} .ng-parking .pk-chip{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-parking .pk-car.glide{transition:none} .ng-parking .pk-lot.in .pk-car, .ng-parking .pk-sign svg, .ng-parking .pk-ghost, .ng-parking .pk-car.hint svg, .ng-parking .pk-car.rev svg, .ng-parking .pk-arw{animation:none} }
`,
    sounds:{
      pkGrab(){ aNoise({ ft:'bandpass', f:2400, q:2, d:.035, v:.05 }); aTone({ f:700, f2:820, type:'triangle', d:.05, v:.035 }); },
      pkMove(o){ const n = Math.min(5, o.n || 1); aWhoosh({ f:300, f2:900 + n * 200, a:.01, d:.12 + n * .03, v:.04 }); aTone({ f:180, f2:120, type:'triangle', d:.12, v:.07 }); aMarimba(penta(n + 3, 67), { t:.04, v:.07 }); },
      pkBump(){ aThump({ f:130, f2:70, d:.12, v:.12 }); aTone({ f:260, f2:200, type:'triangle', d:.08, v:.05 }); },
      pkLock(){ aTone({ f:1200, type:'square', lp:2600, d:.04, v:.04, t:.08 }); aTone({ f:900, type:'square', lp:2600, d:.05, v:.04, t:.13 }); },
      pkUndo(o){ aTone({ f:o.all ? 700 : 620, f2:o.all ? 300 : 440, type:'triangle', d:o.all ? .22 : .12, v:.06 }); aWhoosh({ f:2400, f2:600, a:.01, d:.15, v:.03 }); },
      pkHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      pkVroom(){ aTone({ f:70, f2:150, type:'sawtooth', lp:700, d:.35, v:.08 }); aTone({ f:95, f2:210, type:'sawtooth', lp:900, t:.22, d:.45, v:.07 }); aNoise({ ft:'lowpass', f:600, f2:1800, t:.2, d:.45, v:.05 }); },
      pkHonk(){ [0, .2].forEach(t => { aTone({ f:440, type:'square', lp:1800, t, d:.13, v:.06 }); aTone({ f:554, type:'square', lp:1800, t, d:.13, v:.05 }); }); aSparkle({ t:.4, n:6 }); },
      pkGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      pkTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      pkTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ pkGrab:40, pkTick:250, pkMove:50, pkBump:120 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [0, .18].forEach(t => aTone({ f:523, type:'square', lp:1800, t:.5 + t, d:.12, v:.05 })); aSparkle({ t:.85, n:6 }); }
  };
})();

/* 대전: 같은 판을 누가 먼저·적은 수로(점수 = 시간 + 수 효율). AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
/* 대전 판: 10~12수 · 2분(DUEL). duelKind·duelMax·duelCfg는 대전 v3 엔진이 읽는 값(지금 엔진은 1:1, 2단계에서 duelMax 5로 올림) */
Object.assign(NG.parking, { duelPace:[75, .75], duelStat:{ unit:'수', get:() => ({ v:G.m.moves, t:G.m.opt, lf:null, mis:0 }) }, duelHow:'같은 주차장 · 내 차를 먼저 빼면 1등!',
  duelKind:'race', duelMax:2 });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.parking.scene = { kind:'shapes', colors:['#FFFFFF', '#FFD23F', '#FF8FA0', '#9FD8FF'], density:.7, alpha:.55 };
