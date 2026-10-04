/* 색실 잇기 */
/* ===== 색실 잇기 (thread) · 하루퍼즐 리그 게임 모듈 =====
   청바지 천 위에 놓인 같은 색 단추 두 개를 색실로 꿰어 잇는 퍼즐. 실은 가로·세로로만 가고, 서로 겹치면 안 되며,
   모든 단추를 잇고 천의 빈칸을 남김없이 채우면 성공.
   - 문제는 thread-bank.js(thread-maker.py가 만든 목록, 답이 하나뿐인 판)에서 rng로 고르고,
     돌리기·뒤집기(8가지)·실 색을 rng로 바꾼다.
   - 솔로 새 규칙(구멍·벽·구슬·다리)은 목록의 갈래로 들어 있다(규칙이 있어야 답이 하나가 되는 판).
   - 단추·실·천·구멍 헝겊·나무 다리 그림은 모두 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45). */
NG.thread = (() => {
  const OL = '#1A0F45';
  /* 실 색 12가지(청바지 천 위에서 잘 보이는 밝은 색) + 단추 모양 5가지(색이 비슷해도 모양으로 구별) */
  const PAL = ['#FF4D5E', '#FFD23F', '#3CCB7F', '#6FD3FF', '#FF9A3D', '#FF8FC0', '#B79BFF', '#F6F2E8', '#C6F04A', '#B5774A', '#1FB5A8', '#E040A0'];
  const PAL_NAME = ['빨강', '노랑', '초록', '하늘', '주황', '분홍', '보라', '하양', '연두', '갈색', '청록', '자주'];
  const SHAPES = ['circle', 'square', 'flower', 'heart', 'hex'];
  const HINT_PEN = 50;
  const ICO = {
    link:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="4.2" fill="#FF4D5E" stroke="#1A0F45" stroke-width="1.8"/><circle cx="18" cy="12" r="4.2" fill="#FF4D5E" stroke="#1A0F45" stroke-width="1.8"/><path d="M10 12h4" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/><circle cx="5" cy="11" r=".9" fill="#1A0F45"/><circle cx="7" cy="13" r=".9" fill="#1A0F45"/><circle cx="17" cy="11" r=".9" fill="#1A0F45"/><circle cx="19" cy="13" r=".9" fill="#1A0F45"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    undo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5L4 10l5 5" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 10H14a6 6 0 0 1 0 12h-3" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/></svg>',
    reset:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12A7.5 7.5 0 1 1 17 6.4" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/><path d="M18.5 2.5v4.5H14" fill="none" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>'
  };

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['hole', 'wall', 'bead', 'bridge'],
    info:{
      hole:{ name:'구멍 헝겊', desc:'천에 헝겊을 덧댄 칸이 생겨요. 헝겊 칸은 실이 못 지나가고, 채우지 않아도 돼요.' },
      wall:{ name:'박음질 벽', desc:'칸 사이에 굵은 박음질 선이 있으면 실이 그 선을 넘을 수 없어요. 벽을 따라 길을 찾아요!' },
      bead:{ name:'색 구슬', desc:'색 구슬이 박힌 칸은 꼭 같은 색 실이 지나가야 해요. 구슬이 길을 알려 주기도, 막기도 해요.' },
      bridge:{ name:'나무 다리', desc:'다리 칸에서는 실 두 가닥이 위아래로 엇갈려 지나가요. 가로 실은 다리 위로, 세로 실은 다리 아래로 곧게!' }
    },
    twists:['flash', 'limit', 'bare', 'big'],
    twInfo:{
      flash:{ name:'번개', desc:'판은 조금 쉽지만 제한 시간이 아주 짧아요. 손이 빨라야 해요!' },
      limit:{ name:'한 번에 꿰기', desc:'실 색을 바꿔 잡을 수 있는 횟수가 정해져 있어요(실 수 + 2번). 머릿속으로 길을 다 그리고 꿰어요.' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 머리로 풀어요. (되돌리기·처음부터는 쓸 수 있어요)' },
      big:{ name:'큰 천', desc:'한 칸 더 큰 천! 단추도 많고 실도 길어요. 대신 시간은 넉넉해요.' }
    }
  };
  const RULE_TIP = { hole:'헝겊 칸은 비워 둬요', wall:'박음질 선은 못 넘어요', bead:'구슬은 같은 색 실로', bridge:'다리는 곧게 엇갈려요', flash:'시간이 짧아요', limit:'실 바꾸기 횟수 제한', bare:'힌트 없음', big:'한 칸 큰 천' };
  const FLAG = { hole:'h', wall:'w', bead:'b', bridge:'x' };

  /* ----- 솔로 난이도 표 -----
     크기: 챕터별(SZ), 보스·어려움은 한 칸 크게. 어려움 구간(목록 안 점수 순위의 비율) = WIN[k]
     제한 시간 = 크기별 기본 × (0.8 + 0.5 × 구간 가운데) × 규칙·변주 배수, 5초 단위 */
  const SZ = { 1:[0, 5, 5, 5, 6, 6, 5, 6, 6, 5, 6], 2:[0, 6, 6, 6, 6, 7, 6, 6, 6, 6, 7], 3:[0, 6, 6, 7, 7, 7, 6, 7, 7, 6, 8], 4:[0, 7, 7, 7, 7, 8, 7, 7, 7, 7, 8], 5:[0, 7, 7, 7, 8, 8, 7, 8, 8, 7, 8] };
  const WIN = [null, [0, .3], [.1, .4], [.2, .5], [.3, .6], [.55, .85], [.05, .35], [.3, .6], [.4, .7], [0, .3], [.7, 1]];
  const TBASE = { 5:80, 6:110, 7:160, 8:220, 9:290 };
  const LT = { mjTime:{ hole:1, wall:1.1, bead:1.05, bridge:1.15 }, twTime:{ flash:.6, limit:1.15, bare:1.1, big:1 } };
  const round5 = v => Math.max(30, Math.round(v / 5) * 5);
  function stageCfg(n){
    const p = planOf('thread', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let size = c <= 5 ? SZ[c][k] : (k === 10 ? 9 : k >= 5 ? 8 : 7);
    if(tw === 'big') size = Math.min(9, size + 1);
    let [lo, hi] = WIN[k];
    if(c >= 6){ lo = Math.min(.9, lo + .1); hi = Math.min(1, hi + .1); }
    if(tw === 'flash'){ lo = Math.max(0, lo - .15); hi = Math.max(.2, hi - .15); }
    let limit = TBASE[size] * (.8 + .5 * (lo + hi) / 2);
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    return { size, flags:mj.map(x => FLAG[x]).join(''), lo, hi, limit:round5(limit), hints:tw === 'bare' ? 0 : p.boss ? 2 : 3, cap:tw === 'limit' ? 2 : -1,
      boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 판 만들기: 목록에서 rng로 고르고 돌리기·뒤집기·색을 rng로 =====
     한 줄 = 판|벽|구슬|다리|점수 (thread-maker.py 설명 참고) */
  function pickLine(cfg, rng){
    const N = cfg.size || 6, fl = (cfg.flags || '').split('').sort().join('');
    const B = THREAD_BANK;
    let key = N + fl;
    if(!B[key]){   /* 그 크기에 갈래가 없으면 가까운 크기 → 그래도 없으면 규칙 없는 판 */
      const near = [N - 1, N + 1, N - 2, N + 2].map(s => s + fl).find(k2 => B[k2]);
      key = near || (B[N + ''] ? N + '' : '6');
    }
    const list = B[key], L = list.length;
    const lo = Math.max(0, Math.min(L - 1, Math.floor((cfg.lo || 0) * L))), hi = Math.max(lo + 1, Math.min(L, Math.ceil((cfg.hi == null ? 1 : cfg.hi) * L)));
    return list[lo + Math.floor(rng() * (hi - lo))];
  }
  function makeBoard(cfg, rng){
    const line = pickLine(cfg, rng), [g, ws, bs, xs] = line.split('|');
    const N = Math.round(Math.sqrt(g.length));
    /* 돌리기·뒤집기(8가지) */
    const sym = Math.floor(rng() * 8), rot = sym & 3, flip = sym >> 2, swap = rot % 2 === 1;
    const tf = i => { let r = Math.floor(i / N), c = i % N; if(flip) c = N - 1 - c; for(let t = 0; t < rot; t++){ const r2 = c, c2 = N - 1 - r; r = r2; c = c2; } return r * N + c; };
    /* 실 색 섞기(보이기만) */
    const letters = [...new Set(g.replace(/[^a-z]/gi, '').toLowerCase())].sort();
    const K = letters.length, pal = shuffle(PAL.map((_, i) => i), rng).slice(0, K);
    const kOf = ch => letters.indexOf(ch.toLowerCase());
    const type = new Array(N * N).fill('cell'), endc = new Array(N * N).fill(-1), solc = new Array(N * N).fill(-1), bead = new Array(N * N).fill(-1), br = {};
    for(let i = 0; i < N * N; i++){
      const ch = g[i], j = tf(i);
      if(ch === '#') type[j] = 'hole';
      else if(ch === '+') type[j] = 'bridge';
      else { solc[j] = kOf(ch); if(ch !== ch.toLowerCase()) endc[j] = kOf(ch); }
    }
    const walls = new Set();
    (ws ? ws.split(',') : []).forEach(w => { const a = +w.slice(0, -1), b = w.endsWith('r') ? a + 1 : a + N, x = tf(a), y = tf(b); walls.add(Math.min(x, y) + ',' + Math.max(x, y)); });
    (bs ? bs.split(',') : []).forEach(s => { const j = tf(+s); bead[j] = solc[j]; });
    (xs ? xs.split(',') : []).forEach(s => { const [c, hv] = s.split(':'), j = tf(+c); const h = kOf(hv[0]), v = kOf(hv[1]); br[j] = swap ? [v, h] : [h, v]; });
    const P = { N, K, type, endc, solc, bead, br, walls, pal };
    P.sol = solvePaths(P);
    return P;
  }
  /* 정답 길: 같은 색 칸을 단추에서 단추까지 따라간다(판을 만들 때 같은 실이 자기 옆을 스치지 않게 했으므로 길은 하나) */
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  function nodeColor(P, node){ const c = node >> 1; return P.type[c] === 'bridge' ? P.br[c][node & 1] : P.solc[c]; }
  function solvePaths(P){
    const N = P.N, out = [];
    for(let k = 0; k < P.K; k++){
      const ends = []; P.endc.forEach((x, i) => { if(x === k) ends.push(i); });
      const path = [ends[0] * 2];
      let prev = -1, safe = N * N * 2 + 4;
      while(safe-- > 0){
        const cur = path[path.length - 1], c = cur >> 1;
        if(cur !== path[0] && P.endc[c] === k) break;
        let next = -1;
        for(const [dr, dc] of DIRS){
          const r = Math.floor(c / N) + dr, cc = c % N + dc; if(r < 0 || cc < 0 || r >= N || cc >= N) continue;
          const nd = stepNode(P, cur, r * N + cc); if(nd < 0 || nd === prev) continue;
          if(nodeColor(P, nd) === k){ next = nd; break; }
        }
        if(next < 0) break;
        prev = cur; path.push(next);
      }
      out.push(path);
    }
    return out;
  }
  const wallBetween = (P, a, b) => P.walls.has(Math.min(a, b) + ',' + Math.max(a, b));
  /* node(칸×2 + 층)에서 이웃 칸 to로 한 걸음: 갈 수 있으면 도착 node, 못 가면 −1 */
  function stepNode(P, node, to){
    const N = P.N, c = node >> 1, d = to - c, horiz = Math.abs(d) === 1;
    if(!(horiz && Math.floor(to / N) === Math.floor(c / N)) && Math.abs(d) !== N) return -1;
    if(P.type[to] === 'hole' || wallBetween(P, c, to)) return -1;
    if(P.type[c] === 'bridge' && (node & 1) !== (horiz ? 0 : 1)) return -1;
    return to * 2 + (P.type[to] === 'bridge' && !horiz ? 1 : 0);
  }

  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const clonePaths = ps => ps.map(p => p.slice());
  const samePaths = (a, b) => a.length === b.length && a.every((p, i) => p.length === b[i].length && p.every((x, j) => x === b[i][j]));
  const isDone = (m, k, p) => { p = p || m.paths[k]; return p.length > 1 && m.P.endc[p[p.length - 1] >> 1] === k && (p[p.length - 1] >> 1) !== (p[0] >> 1); };
  const totalNodes = m => { let t = 0; m.P.type.forEach(x => { t += x === 'hole' ? 0 : x === 'bridge' ? 2 : 1; }); return t; };
  function occOf(paths){ const o = new Map(); paths.forEach((p, k) => p.forEach(x => o.set(x, k))); return o; }
  function stats(m){
    const o = occOf(m.paths); let done = 0; for(let k = 0; k < m.P.K; k++) if(isDone(m, k)) done++;
    let beadBad = 0; m.P.bead.forEach((b, i) => { if(b >= 0 && o.get(i * 2) !== b) beadBad++; });
    return { filled:o.size, done, beadBad };
  }

  /* ----- 그림 ----- */
  function buttonSvg(shape, col, cx, cy, R, sw){
    sw = sw || 5;
    let body;
    if(shape === 'square') body = `<rect x="${cx - R * .9}" y="${cy - R * .9}" width="${R * 1.8}" height="${R * 1.8}" rx="${R * .45}" fill="${col}" stroke="${OL}" stroke-width="${sw}"/>`;
    else if(shape === 'flower'){ let d = ''; for(let i = 0; i < 6; i++){ const a = i * Math.PI / 3; d += `<circle cx="${(cx + Math.cos(a) * R * .55).toFixed(1)}" cy="${(cy + Math.sin(a) * R * .55).toFixed(1)}" r="${(R * .48).toFixed(1)}"/>`; }
      body = `<g fill="${col}" stroke="${OL}" stroke-width="${sw}">${d}</g><circle cx="${cx}" cy="${cy}" r="${R * .62}" fill="${col}"/>`; }
    else if(shape === 'heart') body = `<path d="M${cx} ${cy + R * .95}C${cx - R * 1.25} ${cy + R * .1} ${cx - R * 1.05} ${cy - R * 1.05} ${cx} ${cy - R * .45}C${cx + R * 1.05} ${cy - R * 1.05} ${cx + R * 1.25} ${cy + R * .1} ${cx} ${cy + R * .95}z" fill="${col}" stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    else if(shape === 'hex'){ const pts = []; for(let i = 0; i < 6; i++){ const a = Math.PI / 6 + i * Math.PI / 3; pts.push((cx + Math.cos(a) * R).toFixed(1) + ',' + (cy + Math.sin(a) * R).toFixed(1)); } body = `<polygon points="${pts.join(' ')}" fill="${col}" stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round"/>`; }
    else body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}" stroke="${OL}" stroke-width="${sw}"/>`;
    const h = R * .2, hr = R * .1;
    return body + `<circle cx="${cx}" cy="${cy}" r="${R * .5}" fill="none" stroke="rgba(26,15,69,.28)" stroke-width="${sw * .55}"/>`
      + `<circle cx="${cx - h}" cy="${cy - h}" r="${hr}" fill="${OL}"/><circle cx="${cx + h}" cy="${cy - h}" r="${hr}" fill="${OL}"/><circle cx="${cx - h}" cy="${cy + h}" r="${hr}" fill="${OL}"/><circle cx="${cx + h}" cy="${cy + h}" r="${hr}" fill="${OL}"/>`
      + `<ellipse cx="${cx - R * .42}" cy="${cy - R * .5}" rx="${R * .22}" ry="${R * .12}" fill="#fff" opacity=".65" transform="rotate(-35 ${cx - R * .42} ${cy - R * .5})"/>`;
  }
  const colOf = (m, k) => PAL[m.P.pal[k]];
  /* 색을 t만큼 밝게(+)·어둡게(−) */
  function shade(hex, t){ const n = parseInt(hex.slice(1), 16), f = v => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); }
  const shapeOf = (m, k) => SHAPES[m.P.pal[k] % SHAPES.length];
  const ctr = (m, node) => { const c = node >> 1; return [(c % m.P.N) * 100 + 50, Math.floor(c / m.P.N) * 100 + 50]; };

  function fabricSvg(m){
    const P = m.P, N = P.N, W = N * 100, s = [];
    s.push(`<defs><pattern id="thTw" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="14" height="14" fill="#36558E"/><path d="M0 3h14M0 10h14" stroke="#2B4677" stroke-width="3"/><path d="M0 6.5h14" stroke="#4466A3" stroke-width="1.2" opacity=".7"/></pattern></defs>`);
    s.push(`<rect width="${W}" height="${W}" fill="url(#thTw)"/>`);
    /* 실 색마다 꼬인 결 무늬(사선 줄무늬는 가로·세로 실 어디서나 꼬인 실처럼 보인다) */
    s.push('<defs>' + P.pal.map((pi, k) => { const c = PAL[pi], d = shade(c, -.2), l = shade(c, .35);
      return `<pattern id="thF${k}" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="13" height="13" fill="${c}"/><rect width="13" height="4.2" fill="${d}"/><rect y="7" width="13" height="1.6" fill="${l}" opacity=".9"/></pattern>`; }).join('') + '</defs>');
    /* 청바지 가장자리 금색 스티치(성공하면 한 바퀴 박음질) */
    s.push(`<rect class="th-hem" x="9" y="9" width="${W - 18}" height="${W - 18}" rx="10" fill="none" stroke="#F2B544" stroke-width="3.4" stroke-dasharray="13 8" stroke-linecap="round" opacity=".9"/>`);
    /* 칸 사이 바느질 점선 */
    for(let i = 1; i < N; i++) s.push(`<path d="M${i * 100} 4V${W - 4}M4 ${i * 100}H${W - 4}" stroke="#E9DFC4" stroke-opacity=".2" stroke-width="2.2" stroke-dasharray="8 9" fill="none"/>`);
    /* 구멍 헝겊 */
    P.type.forEach((t, i) => {
      if(t !== 'hole') return;
      const x = (i % N) * 100, y = Math.floor(i / N) * 100;
      s.push(`<g class="th-patch"><rect x="${x + 6}" y="${y + 8}" width="88" height="88" rx="16" fill="rgba(10,6,40,.35)"/><rect x="${x + 5}" y="${y + 4}" width="90" height="88" rx="16" fill="#D9C7A8" stroke="${OL}" stroke-width="4"/>`
        + `<rect x="${x + 14}" y="${y + 13}" width="72" height="70" rx="10" fill="none" stroke="#9C7D55" stroke-width="2.6" stroke-dasharray="7 6"/>`
        + `<path d="M${x + 36} ${y + 34}l28 28M${x + 64} ${y + 34}l-28 28" stroke="#9C7D55" stroke-width="5" stroke-linecap="round"/></g>`);
    });
    return s.join('');
  }
  function wallsSvg(m){
    const P = m.P, N = P.N, s = [];
    P.walls.forEach(w => {
      const [a, b] = w.split(',').map(Number), r = Math.floor(a / N), c = a % N;
      const d = b === a + 1 ? `M${(c + 1) * 100} ${r * 100 - 2}V${(r + 1) * 100 + 2}` : `M${c * 100 - 2} ${(r + 1) * 100}H${(c + 1) * 100 + 2}`;
      s.push(`<path d="${d}" stroke="${OL}" stroke-width="22" stroke-linecap="round"/><path d="${d}" stroke="#FFE9B8" stroke-width="13" stroke-linecap="round"/><path d="${d}" stroke="#D2375E" stroke-width="5" stroke-dasharray="11 7" stroke-linecap="round"/>`);
    });
    return s.join('');
  }
  function bridgeSvg(m){
    const P = m.P, N = P.N, s = [];
    Object.keys(P.br).forEach(c => {
      c = +c; const x = (c % N) * 100, y = Math.floor(c / N) * 100;
      s.push(`<g class="th-bridge"><rect x="${x + 2}" y="${y + 26}" width="96" height="56" rx="14" fill="rgba(10,6,40,.45)"/><rect x="${x + 2}" y="${y + 20}" width="96" height="56" rx="14" fill="#E2A868" stroke="${OL}" stroke-width="4.5"/>`
        + `<path d="M${x + 26} ${y + 24}v48M${x + 50} ${y + 24}v48M${x + 74} ${y + 24}v48" stroke="#B9783E" stroke-width="3" stroke-linecap="round"/><circle cx="${x + 12}" cy="${y + 30}" r="3" fill="${OL}"/><circle cx="${x + 88}" cy="${y + 30}" r="3" fill="${OL}"/><circle cx="${x + 12}" cy="${y + 66}" r="3" fill="${OL}"/><circle cx="${x + 88}" cy="${y + 66}" r="3" fill="${OL}"/></g>`);
    });
    return s.join('');
  }
  /* 실: 이음 마디마다 짧은 선분. 다리 세로 층을 지나는 선분은 다리 아래에 그린다 */
  function threadsSvg(m, paths, active){
    const P = m.P, under = [], over = [], tint = [];
    paths.forEach((p, k) => {
      const col = colOf(m, k), done = isDone(m, k, p);
      p.forEach(nd => { const c = nd >> 1; if(P.type[c] !== 'bridge' && P.endc[c] < 0){ const [x, y] = ctr(m, nd); tint.push(`<rect x="${x - 44}" y="${y - 44}" width="88" height="88" rx="20" fill="${col}" opacity="${done ? .22 : .14}"/>`); } });
      for(let i = 1; i < p.length; i++){
        const a = p[i - 1], b = p[i], [x1, y1] = ctr(m, a), [x2, y2] = ctr(m, b);
        const seg = { d:`M${x1} ${y1}L${x2} ${y2}`, col:`url(#thF${k})`, k };
        ((a & 1) || (b & 1) ? under : over).push(seg);
      }
    });
    const draw = segs => segs.map(s => `<path d="${s.d}" stroke="${OL}" stroke-width="42" stroke-linecap="round"/>`).join('')
      + segs.map(s => `<path d="${s.d}" stroke="${s.col}" stroke-width="31" stroke-linecap="round"/>`).join('')
      + segs.map(s => `<path d="${s.d}" stroke="#fff" stroke-opacity=".28" stroke-width="7" stroke-linecap="round" transform="translate(-6 -6)"/>`).join('');
    const tunnels = Object.keys(P.br).map(c => { c = +c; const x = (c % P.N) * 100, y = Math.floor(c / P.N) * 100; return `<rect x="${x + 28}" y="${y + 2}" width="44" height="96" rx="12" fill="rgba(10,6,40,.42)"/><path d="M${x + 50} ${y + 8}l-8 9h16zM${x + 50} ${y + 92}l-8 -9h16z" fill="#FFE9B8" opacity=".8"/>`; }).join('');
    return `<g class="th-tint">${tint.join('')}</g>${tunnels}<g>${draw(under)}</g>${bridgeSvg(m)}<g>${draw(over)}</g>`;
  }
  function beadsSvg(m, paths){
    const P = m.P, o = occOf(paths), s = [];
    P.bead.forEach((k, i) => {
      if(k < 0) return;
      const [x, y] = ctr(m, i * 2), on = o.get(i * 2), ok = on === k, bad = on != null && on !== k;
      s.push(`<g class="th-bead${ok ? ' ok' : ''}${bad ? ' bad' : ''}">${on == null ? `<circle cx="${x}" cy="${y}" r="36" fill="${colOf(m, k)}" opacity=".22"/><circle cx="${x}" cy="${y}" r="36" fill="none" stroke="${colOf(m, k)}" stroke-width="3" stroke-dasharray="6 6" opacity=".8"/>` : ''}`
        + `<circle cx="${x}" cy="${y}" r="22" fill="${colOf(m, k)}" stroke="${OL}" stroke-width="5"/><circle cx="${x}" cy="${y}" r="8" fill="${OL}" opacity=".6"/><ellipse cx="${x - 8}" cy="${y - 9}" rx="6" ry="4" fill="#fff" opacity=".85" transform="rotate(-30 ${x - 8} ${y - 9})"/>${bad ? `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="#FF5A6A" stroke-width="5"/>` : ''}</g>`);
    });
    return s.join('');
  }
  function buttonsSvg(m, paths){
    const P = m.P, s = [];
    P.endc.forEach((k, i) => {
      if(k < 0) return;
      const [x, y] = ctr(m, i * 2), done = isDone(m, k, paths[k]);
      s.push(`<ellipse cx="${x + 3}" cy="${y + 7}" rx="33" ry="31" fill="rgba(10,6,40,.38)"/><g class="th-btn${done ? ' done' : ''}${m.justDone.has(k) ? ' jd' : ''}${m.glowK === k ? ' glow' : ''}" data-k="${k}" style="transform-origin:${x}px ${y}px">${buttonSvg(shapeOf(m, k), colOf(m, k), x, y, 33)}</g>`);
    });
    return s.join('');
  }
  function drawBoard(paths){
    const m = S(), g = $('#thDyn'); if(!g) return;
    paths = paths || m.paths;
    g.innerHTML = threadsSvg(m, paths) + beadsSvg(m, paths) + buttonsSvg(m, paths);
    m.justDone.clear();
  }

  /* ----- 화면 ----- */
  function hud(){
    const m = S(); if(!m) return;
    const st = stats(m);
    const d = $('#thDone'); if(d) d.textContent = st.done;
    const fp = $('#thFillP'); if(fp) fp.textContent = Math.floor(st.filled * 100 / m.total) + '%';
    const mv = $('#thMoves'); if(mv) mv.textContent = m.capMax ? `${m.moves}/${m.capMax}` : m.moves;
    const h = $('#thHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.phase !== 'play'; }
    const u = $('#thUndo'); if(u) u.disabled = !m.hist.length || m.phase !== 'play';
    const r = $('#thReset'); if(r) r.disabled = !m.paths.some(p => p.length > 1) || m.phase !== 'play';
  }
  function msg(html, cls){ const e = $('#thMsg'); if(!e) return; e.className = 'th-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>같은 단추끼리 실로 꿰어요</span>';
  }
  function layout(){
    const m = S(), box = $('#thBoard'), root = document.querySelector('.ng-thread'); if(!box || !root) return;
    const W = Math.min((root.clientWidth || 360) + 12, 480) - 6;
    const top = box.getBoundingClientRect().top + (window.scrollY || 0);
    const Hh = Math.max(250, (innerHeight || 740) - top - 96);
    const px = Math.max(220, Math.floor(Math.min(W - 20, Hh)));
    box.style.width = px + 'px'; box.style.height = px + 'px';
    m.px = px;
    try{ const rt = root.getBoundingClientRect().top + (window.scrollY || 0); root.style.minHeight = Math.max(0, Math.floor((innerHeight || 740) - rt - 20)) + 'px'; }catch(_){}
  }

  /* ----- 실 꿰기 ----- */
  function canPlay(){ const m = S(); return m && !G.over && !G.paused && m.phase === 'play'; }
  function cellAt(e){
    const m = S(), box = $('#thBoard'); if(!box) return -1;
    const r = box.getBoundingClientRect(), cs = r.width / m.P.N;
    const c = Math.floor((e.clientX - r.left) / cs), rr = Math.floor((e.clientY - r.top) / cs);
    if(c < 0 || rr < 0 || c >= m.P.N || rr >= m.P.N) return -1;
    return rr * m.P.N + c;
  }
  /* 지금 긋는 실(cur)을 base 위에 얹은 모습: 다른 실은 cur와 겹치는 곳에서 잘린다(손을 떼기 전엔 되살아남) */
  function compose(D){
    const m = S(), on = new Set(D.cur), out = D.base.map((p, k) => {
      if(k === D.k) return D.cur.slice();
      const at = p.findIndex(x => on.has(x));
      return at < 0 ? p.slice() : p.slice(0, at);
    });
    /* 다리 한 칸에 같은 색이 위아래로 둘 다 지나가면 안 됨 → 그런 길은 만들지 않는다(step에서 막음) */
    void m;
    return out;
  }
  function stepTo(D, to){
    const m = S(), P = m.P, cur = D.cur, last = cur[cur.length - 1];
    const nd = stepNode(P, last, to); if(nd < 0) return false;
    const at = cur.indexOf(nd);
    if(at >= 0){ cur.length = at + 1; D.lastCut = -1; return true; }
    if(isDone(m, D.k, cur)) return false;
    const ec = P.endc[to];
    if(ec >= 0){
      if(ec !== D.k || to === (cur[0] >> 1)) return false;
      cur.push(nd); return true;
    }
    if(P.type[to] === 'bridge'){ const other = (to * 2) + (1 - (nd & 1)); if(cur.includes(other)) return false; }
    cur.push(nd); return true;
  }
  function moveTo(D, cell){
    const m = S(), N = m.P.N; let changed = false, guard = 2 * N + 2;
    while(guard-- > 0){
      const last = D.cur[D.cur.length - 1] >> 1; if(last === cell) break;
      const lr = Math.floor(last / N), lc = last % N, tr = Math.floor(cell / N), tc = cell % N;
      const dr = tr - lr, dc = tc - lc;
      /* 대각선으로 크게 움직이면 더 먼 축부터 한 칸씩 */
      let nx = Math.abs(dc) >= Math.abs(dr) ? last + Math.sign(dc) : last + Math.sign(dr) * N;
      if(!stepTo(D, nx)){
        if(dr && dc){ nx = Math.abs(dc) >= Math.abs(dr) ? last + Math.sign(dr) * N : last + Math.sign(dc); if(!stepTo(D, nx)) break; }
        else break;
      }
      changed = true;
    }
    return changed;
  }
  function wire(){
    const m = S(), box = $('#thBoard');
    let D = null;
    box.onpointerdown = e => {
      if(D) return;
      e.preventDefault();
      if(!canPlay()) return;
      const cell = cellAt(e); if(cell < 0) return;
      const P = m.P;
      let k = -1, start = null;
      if(P.endc[cell] >= 0){ k = P.endc[cell]; start = [cell * 2]; }
      else {
        const o = occOf(m.paths), n0 = o.has(cell * 2) ? cell * 2 : o.has(cell * 2 + 1) ? cell * 2 + 1 : -1;
        if(n0 < 0){ sfx('thNo'); return; }
        k = o.get(n0); const p = m.paths[k]; start = p.slice(0, p.indexOf(n0) + 1);
      }
      if(m.capMax && k !== m.lastK && m.moves >= m.capMax){
        msg('<b class="bad">실 바꾸기를 다 썼어요</b><span>되돌리기로 다시 생각해요</span>', 'th-pop'); sfx('thNo');
        T(() => { if(m.phase === 'play') msg(playMsg()); }, 1500);
        return;
      }
      D = { k, base:clonePaths(m.paths), cur:start, id:e.pointerId, len:start.length, moved:false };
      try{ box.setPointerCapture(e.pointerId); }catch(_){}
      clearHintGlow();
      drawBoard(compose(D));
      box.classList.add('drawing'); box.style.setProperty('--thc', colOf(m, k));
      sfx('thGrab', { k });
    };
    box.onpointermove = e => {
      if(!D || e.pointerId !== D.id) return;
      const cell = cellAt(e); if(cell < 0) return;
      const before = D.cur.length, wasDone = isDone(m, D.k, D.cur), baseOcc = occOf(D.base);
      if(!moveTo(D, cell)) return;
      D.moved = true;
      const view = compose(D); drawBoard(view);
      if(D.cur.length > before){
        const nd = D.cur[D.cur.length - 1], cutK = baseOcc.get(nd);
        if(cutK != null && cutK !== D.k) sfx('thCut'); else sfx('thStep', { n:D.cur.length });
        if(!wasDone && isDone(m, D.k, D.cur)){ m.justDone.add(D.k); drawBoard(view); connected(D.k, nd); }
      } else sfx('thBack');
    };
    const up = e => {
      if(!D || e.pointerId !== D.id) return;
      const d = D; D = null;
      box.classList.remove('drawing');
      const view = compose(d);
      /* 누르기만 하고 움직이지 않았으면 아무 일도 없던 것으로(실이 지워지지 않게) */
      if(!canPlay() || !d.moved || d.cur.length <= 1 || samePaths(view, m.paths)){ drawBoard(); return; }
      commit(view, d.k);
    };
    box.onpointerup = up; box.onpointercancel = up;
    $('#thUndo').onclick = undo; $('#thReset').onclick = restart;
    const h = $('#thHint'); if(h) h.onclick = useHint;
  }
  function connected(k, nd){
    const m = S();
    try{
      sfx('thDone', { k });
      const box = $('#thBoard'), r = box.getBoundingClientRect(), sc = r.width / (m.P.N * 100), [x, y] = ctr(m, nd);
      if(!FXR.reduce) fxEmit(r.left + x * sc, r.top + y * sc, { quantity:10, speed:{ min:60, max:180 }, lifespan:{ min:300, max:600 }, kind:'star', tint:[colOf(m, k), '#FFFFFF'], scale:{ start:1.2, end:0 }, alpha:{ start:1, end:0 } });
    }catch(_){}
  }
  /* 한 번 손을 뗄 때마다 확정. 실 색을 바꿔 잡을 때만 수를 센다(같은 색을 이어서 고치면 한 수) */
  function commit(view, k){
    const m = S();
    m.hist.push({ paths:clonePaths(m.paths), moves:m.moves, lastK:m.lastK });
    if(m.hist.length > 200) m.hist.shift();
    if(k !== m.lastK){ m.moves++; m.lastK = k; }
    m.paths = view;
    drawBoard(); hud(); afterMove();
  }
  function afterMove(){
    const m = S(), st = stats(m);
    if(st.done === m.P.K && st.filled === m.total && !st.beadBad){ win(); return; }
    if(st.done === m.P.K){
      if(st.beadBad) msg('<b class="bad">구슬 색이 달라요</b><span>구슬은 같은 색 실로 꿰어요</span>', 'th-pop');
      else msg('<b>거의 다 왔어요!</b><span>빈칸 ' + (m.total - st.filled) + '개를 채워요</span>', 'th-pop');
      sfx('thAlmost');
    } else if(m.phase === 'play') msg(playMsg());
  }
  function undo(){
    const m = S(); if(!canPlay() || !m.hist.length) return;
    const h = m.hist.pop(); m.paths = h.paths; m.moves = h.moves; m.lastK = h.lastK;
    clearHintGlow(); drawBoard(); hud(); sfx('thUndo'); afterMove();
  }
  function restart(){
    const m = S(); if(!canPlay() || !m.paths.some(p => p.length > 1)) return;
    m.hist.push({ paths:clonePaths(m.paths), moves:m.moves, lastK:m.lastK });
    m.paths = m.paths.map(() => []); m.lastK = -1; m.restarts++;
    clearHintGlow(); drawBoard(); hud(); sfx('thUndo', { all:1 }); msg(playMsg());
    try{ fxPunch($('#thBoard'), 1.02); }catch(_){}
  }
  function clearHintGlow(){ const m = S(); if(m) m.glowK = -1; }
  /* 힌트: 아직 맞지 않은 실 하나(가장 긴 것)를 정답대로 꿰어 준다. 겹치던 다른 실은 그 자리에서 잘린다 */
  function useHint(){
    const m = S(); if(!canPlay() || m.hintLeft <= 0) return;
    const P = m.P, ok = k => { const a = m.paths[k], s = P.sol[k], r = s.slice().reverse(); return samePaths([a], [s]) || samePaths([a], [r]); };
    let best = -1;
    for(let k = 0; k < P.K; k++) if(!ok(k) && (best < 0 || P.sol[k].length > P.sol[best].length)) best = k;
    if(best < 0) return;
    m.hist.push({ paths:clonePaths(m.paths), moves:m.moves, lastK:m.lastK });
    const s = P.sol[best].slice(), on = new Set(s);
    m.paths = m.paths.map((p, k) => { if(k === best) return s; const at = p.findIndex(x => on.has(x)); return at < 0 ? p : p.slice(0, at); });
    m.hintLeft--; m.hints++; m.glowK = best; m.justDone.add(best);
    drawBoard(); hud();
    msg('<b>힌트</b><span>' + PAL_NAME[P.pal[best]] + ' 실을 꿰어 줬어요</span>', 'th-pop');
    sfx('thHint');
    T(() => afterMove(), 700);
  }

  /* ----- 시계·끝 ----- */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#thBar');
    if(m.phase === 'deal'){ if(t >= .45){ m.phase = 'play'; G.start = Date.now(); G.pausedMs = 0; msg(playMsg()); sfx('thGo'); hud(); } return; }
    if(m.phase !== 'play' || !G.limit) return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#thTime'); if(e) e.textContent = mmss(sec);
      const p = $('#thTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#thBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0) sfx('thTick', { hi:sec <= 5 });
    }
    if(rem <= 0) timeUp();
  }
  function win(){
    const m = S(); m.phase = 'done'; m.won = true; m.sec = elapsed(); hud();
    msg('<b>다 꿰맸어요!</b><span>' + m.moves + '번에' + (m.moves <= m.P.K ? ' · 완벽!' : '') + '</span>', 'th-win');
    sfx('thWin'); fxBuzz([30, 50, 30]);
    try{ const b = $('#thBoard'); b.classList.add('cleared'); const p = fxCenter(b); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12);
      document.querySelectorAll('.ng-thread .th-btn').forEach((e, i) => setTimeout(() => { try{ e.classList.add('pop'); }catch(_){} }, i * 35)); }catch(_){}
    T(() => finish(true), 1300);
  }
  function lose(text){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; hud();
    msg('<b class="bad">' + text + '</b><span>꿰맨 실 ' + stats(m).done + '/' + m.P.K + '</span>', 'th-pop');
    sfx('thTimeUp'); fxBuzz([40, 40, 60]); try{ fxShake($('#thBoard'), 6); }catch(_){}
    T(() => finish(false), 1400);
  }
  function timeUp(){ const e = $('#thTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요'); }

  return {
    name:'색실 잇기', abil:'공간지각', col:['#A9C8FF', '#3E6FD8', '#1F3C8A'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="6" r="3.5"/><circle cx="18.5" cy="18" r="3.5"/><path d="M5.5 6v6.5a3 3 0 0 0 3 3h7a3 3 0 0 1 3 2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    art(){
      const u = 'thA' + Math.floor(performance.now() * 1000 % 1e6), cs = 17, ox = 37, oy = 4, N = 5;
      const P = (r, c) => [ox + c * cs + cs / 2, oy + r * cs + cs / 2];
      const line = (pts, col) => { const d = pts.map((q, i) => (i ? 'L' : 'M') + P(q[0], q[1]).join(' ')).join(''); return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; };
      const btn = (r, c, col, sh) => { const [x, y] = P(r, c); return buttonSvg(sh, col, x, y, 6.2, 1.6); };
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDE8FF"/><stop offset="1" stop-color="#9DB8F2"/></linearGradient>
        <pattern id="${u}2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="5" height="5" fill="#36558E"/><path d="M0 1.2h5" stroke="#2B4677" stroke-width="1.4"/></pattern></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <rect x="${ox - 4}" y="${oy - 2}" width="${cs * N + 8}" height="${cs * N + 6}" rx="9" fill="#22396A" stroke="${OL}" stroke-width="2.2"/>
        <rect x="${ox}" y="${oy + 1}" width="${cs * N}" height="${cs * N}" rx="5" fill="url(#${u}2)"/>
        <rect x="${ox + 2.5}" y="${oy + 3.5}" width="${cs * N - 5}" height="${cs * N - 5}" rx="3" fill="none" stroke="#F2B544" stroke-width="1.1" stroke-dasharray="3 2"/>
        ${line([[0, 0], [0, 3], [1, 3]], PAL[0])}${line([[1, 0], [3, 0], [3, 2]], PAL[1])}${line([[1, 1], [2, 1], [2, 3], [3, 3], [3, 4], [0, 4]], PAL[3])}${line([[4, 0], [4, 4]], PAL[2])}
        ${btn(0, 0, PAL[0], 'circle')}${btn(1, 3, PAL[0], 'circle')}${btn(1, 0, PAL[1], 'square')}${btn(3, 2, PAL[1], 'square')}${btn(1, 1, PAL[3], 'heart')}${btn(0, 4, PAL[3], 'heart')}${btn(4, 0, PAL[2], 'flower')}${btn(4, 4, PAL[2], 'flower')}
        <path d="M16 74c6-10 14-8 14 0s-10 10-6 18" fill="none" stroke="#FF8FC0" stroke-width="3" stroke-linecap="round"/><path d="M140 20l8-8" stroke="#C8CEDD" stroke-width="3" stroke-linecap="round"/><circle cx="139" cy="21" r="2" fill="none" stroke="#8A93AA" stroke-width="1.4"/></svg>`;
    },
    help:[
      ['같은 단추끼리 이어요', '단추를 누른 채 손가락을 움직이면 색실이 따라와요. 같은 색·같은 모양 단추까지 실을 끌고 가면 이어져요.'],
      ['실은 겹치지 않아요', '실은 가로·세로로만 가고 서로 엇갈리지 못해요. 다른 실 위로 지나가면 그 실이 잘려요(손을 떼기 전엔 되돌아와요).'],
      ['빈칸 없이 꽉 채우기', '모든 단추를 잇고 천의 칸을 남김없이 채우면 성공! 실 색을 바꿔 잡는 횟수가 단추 쌍 수와 같으면 완벽이에요.'],
      ['막히면 힌트', '💡힌트는 실 하나를 정답대로 꿰어 줘요. 대신 점수가 ' + HINT_PEN + '점 줄어요. 되돌리기·처음부터는 벌칙이 없어요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 구멍 헝겊·박음질 벽·색 구슬·나무 다리 같은 새 규칙과 번개·한 번에 꿰기·큰 천 같은 변주가 차례로 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'thread' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['단추 상자', '헝겊 인형', '퀼트 이불', '털실 가게', '무대 의상'],
    starRule:'★ 다 꿰매기 · ★★ 힌트 1번 이하, 실 바꾸기 조금 · ★★★ 힌트 없이 단추 쌍 수만큼만',
    levels:{
      easy:{ size:6, lo:0, hi:.45, limit:150, hints:3 },
      normal:{ size:7, lo:.3, hi:.8, limit:210, hints:3 },
      hard:{ size:8, lo:.6, hi:1, limit:300, hints:3 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.size}×${c.size} 천 · ${mmss(c.limit)}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.size}×${c.size} 천`; },
    init(cfg, rng){
      const P = makeBoard(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { P, paths:P.sol.map(() => []), hist:[], moves:0, lastK:-1, hints:0, restarts:0, hintLeft:cfg.hints == null ? 3 : cfg.hints, justDone:new Set(), glowK:-1,
        capMax:cfg.cap >= 0 && cfg.cap != null ? P.K + cfg.cap : 0, phase:'deal', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips,
        lastSec:-1, sec:0, timers:new Set(), px:320 };
      G.m.total = totalNodes(G.m);
      G.limit = cfg.limit;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 정답대로 실을 하나씩 꿰어 끝까지 */
      m._solveForTest = () => new Promise(res => {
        let k = 0;
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.moves); return; }
          if(m.phase !== 'play'){ setTimeout(step, 60); return; }
          if(k >= m.P.K){ res(-1); return; }
          const s = m.P.sol[k], on = new Set(s);
          const view = m.paths.map((p, j) => { if(j === k) return s.slice(); const at = p.findIndex(x => on.has(x)); return at < 0 ? p : p.slice(0, at); });
          commit(view, k); k++; setTimeout(step, 200);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _make:makeBoard, _stage:stageCfg,
    render(st){
      const m = S(), N = m.P.N;
      st.innerHTML = `<div class="ng-thread">
        <div class="hud-row">
          <div class="hchip th-done" aria-label="이은 실"><span class="hv">${ICO.link}<b id="thDone">0</b><small>/${m.P.K}쌍</small></span><em>이은 실</em></div>
          <div class="hchip th-fillc" aria-label="채운 칸"><span class="hv"><b id="thFillP">0%</b></span><em>채운 칸</em></div>
          ${m.capMax ? `<div class="hchip th-cap" aria-label="실 바꾸기"><span class="hv"><b id="thMoves">0/${m.capMax}</b></span><em>실 바꾸기</em></div>` : ''}
          <div class="hchip time" id="thTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="thTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="th-rules" aria-label="켜진 규칙">${m.boss ? '<span class="th-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="th-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="th-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="th-barw" id="thBarWrap"><i id="thBar"></i></div>
        <div class="th-msg" id="thMsg"><span>단추를 다는 중…</span></div>
        <div class="th-wrap"><div class="th-frame"><div class="th-board in" id="thBoard" role="group" aria-label="색실 잇기 ${N}×${N} 천, 단추 ${m.P.K}쌍">
          <svg viewBox="0 0 ${N * 100} ${N * 100}" aria-hidden="true">${fabricSvg(m)}${wallsSvg(m)}<g id="thDyn"></g></svg>
        </div></div></div>
        <div class="tools-row th-ctl">
          <button class="tool" id="thUndo" aria-label="되돌리기">${ICO.undo}<span>되돌리기</span></button>
          <button class="tool" id="thReset" aria-label="처음부터">${ICO.reset}<span>처음부터</span></button>
          <button class="tool item" id="thHint" aria-label="힌트">${ICO.hint}<span>힌트</span><b class="cnt">${m.hintLeft}</b></button>
        </div>
      </div>`;
      layout(); drawBoard(); wire(); hud();
      T(() => { const b = $('#thBoard'); if(b) b.classList.remove('in'); }, 900);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; if(!m) return 0; if(m.won) return 1; const s = stats(m); const v = .5 * s.filled / m.total + .5 * s.done / m.P.K; return s.done === m.P.K && s.filled === m.total && !s.beadBad ? 1 : Math.min(.97, v); },
    lossText(){ const m = G.m, s = stats(m); return `실 ${m.P.K}쌍 중 ${s.done}쌍을 잇고 천의 ${Math.floor(s.filled * 100 / m.total)}%를 채웠어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit || 1, m.sec || elapsed()));
      const time = G.limit ? Math.max(0, 300 - Math.floor(sec * 300 / G.limit)) : 150;
      const extra = Math.max(0, 200 - 25 * Math.max(0, m.moves - m.P.K) - HINT_PEN * m.hints);
      return { base:500, time, extra, rows:[`다 꿰매기 (단추 ${m.P.K}쌍)`, '시간 보너스 (' + mmss(sec) + ')', `실 바꾸기 ${m.moves}번 · 힌트 ${m.hints}`] };
    },
    stars(){ const m = G.m, K = m.P.K; return m.hints === 0 && m.moves <= K ? 3 : m.hints <= 1 && m.moves <= K + Math.max(2, Math.ceil(K * .3)) ? 2 : 1; },
    css:`
body[data-mode="thread"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.18) 0 2px, transparent 3px) 0 0/26px 26px,
  linear-gradient(180deg,#E6EEFF 0%,#C4D5FA 55%,#9FB8EE 100%) fixed}
.ng-thread{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-thread .hud-row{margin:0}
.ng-thread .hchip.time.hurry{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)} .ng-thread .hchip.time.hurry b{color:#E5484D}
.ng-thread .th-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-thread .th-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#9EC0FF,#3E6FD8); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-thread .th-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-thread .th-msg{width:100%; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#2C3E7A; white-space:nowrap; overflow:hidden}
.ng-thread .th-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-thread .th-msg b.boss{color:#FFE27A}
.ng-thread .th-msg b.bad{color:#FF8A8F}
.ng-thread .th-msg.th-pop, .ng-thread .th-msg.th-win{animation:thread-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-thread .th-msg.th-win b{font-size:24px; color:#FFE27A}
@keyframes thread-in{from{transform:scale(.6); opacity:0}}
.ng-thread .th-wrap{margin:auto -6px; display:flex; justify-content:center}
.ng-thread .th-frame{padding:7px; border-radius:20px; background:#22396A; border:3px solid #1A0F45; box-shadow:inset 0 2px 0 rgba(255,255,255,.18), 0 5px 0 #1A0F45, 0 14px 22px rgba(30,40,110,.28);
  outline:2.5px dashed #F2B544; outline-offset:-6px}
.ng-thread .th-board{position:relative; touch-action:none; border-radius:12px; overflow:hidden; box-shadow:inset 0 0 0 2.5px #1A0F45; cursor:pointer}
.ng-thread .th-board svg{display:block; width:100%; height:100%}
.ng-thread .th-board.drawing{cursor:grabbing}
.ng-thread .th-btn{transition:transform .2s}
.ng-thread .th-btn.jd{animation:thread-btn .35s cubic-bezier(.2,1.6,.4,1)}
@keyframes thread-btn{40%{transform:scale(1.18)}}
.ng-thread .th-btn.glow{animation:thread-glow .6s ease-in-out infinite alternate}
@keyframes thread-glow{to{transform:scale(1.15); filter:drop-shadow(0 0 6px #FFE27A)}}
.ng-thread .th-btn.pop{animation:thread-btn .45s cubic-bezier(.2,1.6,.4,1)}
.ng-thread .th-bead.bad{animation:thread-bad .5s ease-in-out 3 alternate}
@keyframes thread-bad{to{opacity:.55}}
.ng-thread .th-board.in .th-btn{animation:thread-deal .45s cubic-bezier(.2,1.5,.4,1) both}
@keyframes thread-deal{from{opacity:0; transform:scale(.4)}}
.ng-thread .th-board.cleared{animation:thread-cheer .6s cubic-bezier(.2,1.6,.4,1)}
.ng-thread .th-board.cleared .th-hem{stroke:#FFD978; stroke-width:5; animation:thread-hem 1.1s linear both}
@keyframes thread-hem{from{stroke-dashoffset:0} to{stroke-dashoffset:-210}}
@keyframes thread-cheer{40%{scale:1.03}}
.ng-thread .th-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-thread .th-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#2B2160; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-thread .th-chip.mj{background:#E3ECFF; color:#1F3C8A}
.ng-thread .th-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-thread .th-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-thread .th-ctl{margin-top:0; padding-top:14px}
.ng-thread .th-ctl .tool{flex-direction:row; gap:6px; min-height:54px; font-size:16px}
.ng-thread .th-ctl .tool .cnt{font-style:normal}
@media (max-width:370px){ .ng-thread .th-ctl .tool{font-size:14px; gap:3px} .ng-thread .th-msg b{font-size:18px} .ng-thread .th-chip{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-thread .th-btn, .ng-thread .th-board.in .th-btn, .ng-thread .th-bead.bad, .ng-thread .th-board.cleared .th-hem{animation:none} }
`,
    sounds:{
      thGrab(o){ aTone({ f:620 + (o.k || 0) * 30, f2:760, type:'triangle', d:.06, v:.04 }); },
      thStep(o){ aMarimba(penta(Math.min(14, (o.n || 1) % 15 + 2), 64), { v:.05 }); },
      thBack(){ aTone({ f:520, f2:430, type:'triangle', d:.05, v:.03 }); },
      thCut(){ aNoise({ ft:'highpass', f:3000, q:1, d:.06, v:.05 }); aTone({ f:900, f2:400, type:'square', lp:2000, d:.06, v:.03 }); },
      thDone(o){ aBell({ f:m2f(76 + ((o.k || 0) % 5) * 2), d:.5, v:.06, rev:.25 }); aSparkle({ root:84, n:3, v:.03 }); },
      thAlmost(){ aTone({ f:660, f2:880, type:'triangle', d:.12, v:.05 }); },
      thNo(){ aThump({ f:130, f2:70, d:.12, v:.1 }); },
      thUndo(o){ aTone({ f:o.all ? 700 : 620, f2:o.all ? 300 : 440, type:'triangle', d:o.all ? .22 : .12, v:.06 }); aWhoosh({ f:2400, f2:600, a:.01, d:.15, v:.03 }); },
      thHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      thWin(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 2, 67), { t:i * .07, v:.12 })); aSparkle({ t:.45, n:7 }); },
      thGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      thTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      thTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ thStep:35, thBack:35, thCut:80, thTick:250, thNo:150 },
    jingle(){ [0, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 1, 70), { t:i * .08, v:.16 })); aSparkle({ t:.6, n:6 }); }
  };
})();

/* 대전: 같은 천을 누가 먼저 다 꿰매나(점수 = 시간 + 실 바꾸기 효율). AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.thread, { duelPace:[100, .74], duelStat:{ unit:'%', get:() => ({ v:Math.floor(NG.thread.progress() * 100), t:100, lf:null }) }, duelHow:'같은 천 · 누가 먼저 다 꿰매나?' });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.thread.scene = { kind:'shapes', colors:['#FFFFFF', '#FFD23F', '#FF8FC0', '#6FD3FF'], density:.6, alpha:.5 };
