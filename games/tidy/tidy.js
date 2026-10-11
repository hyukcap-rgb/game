/* 착착 정리 */
/* ===== 착착 정리 (tidy) · 하루퍼즐 리그 게임 모듈 =====
   서랍·책상·냉장고 같은 칸에 모양이 다른 물건(테트리스 조각 모양)을 돌려 가며 빈틈없이 채우는 정리 퍼즐.
   - 판은 빈 칸을 rng로 쪼개 물건(1~5칸)으로 만든다 → 항상 풀 수 있다(정답 위치 sol 보관, 힌트가 씀).
   - 규칙 갈래(솔로 새 규칙): 막힌 칸(hole) · 차가운 칸(cold) · 깨지는 물건(fragile) · 무거운 물건(heavy)
   - 물건 그림은 모두 직접 그린 오리지널 SVG(굵은 외곽선 #3A2412). 문제 내용은 init의 rng로만 만든다. */
NG.tidy = (() => {
  const OL = '#3A2412';
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const $ = s => document.querySelector(s);
  /* 물건 색 10가지 */
  const PAL = ['#FF7A59', '#FFC93C', '#5BCB8B', '#5FB8F2', '#B28CFF', '#FF8FC0', '#F2A65A', '#7ADAD0', '#C6D95A', '#E8685F'];
  const NAMES = {
    drawer:['양말', '수건', '모자', '장갑', '손수건', '메모', '리본', '단추', '열쇠', '지갑'],
    desk:['공책', '필통', '자', '풀', '가위', '책', '클립', '편지', '달력', '시계'],
    fridge:['잼', '빵', '꿀', '차', '소스', '김', '쌈', '반찬', '밥', '떡'],
    closet:['셔츠', '바지', '치마', '티', '가방', '벨트', '신발', '스카프'],
    pantry:['쌀', '밀가루', '설탕', '소금', '라면', '통조림', '과자', '견과']
  };
  const COLD = ['우유', '주스', '치즈', '달걀', '두부', '햄', '요거트', '버터'];
  const FRAG = ['컵', '접시', '유리', '꽃병', '화분', '액자'];
  const HEAVY = ['책', '상자', '냄비', '쌀', '벽돌', '항아리'];
  const PLACE = { drawer:'서랍', desk:'책상', fridge:'냉장고', closet:'옷장', pantry:'찬장' };
  const WOOD = { drawer:['#E9C48A', '#C99A5B'], desk:['#D9B282', '#B58654'], fridge:['#EAF4FA', '#BFD5E3'], closet:['#D7B48C', '#B08A5E'], pantry:['#E2C18F', '#BE9760'] };

  const ICO = {
    box:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="#FFC93C" stroke="#3A2412" stroke-width="1.8"/><path d="M3 10h18M12 4v6" stroke="#3A2412" stroke-width="1.6"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#3A2412" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#3A2412"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#3A2412" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    turn:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12A7.5 7.5 0 1 1 17 6.4" fill="none" stroke="#3A2412" stroke-width="2.6" stroke-linecap="round"/><path d="M18.5 2.5v4.5H14" fill="none" stroke="#3A2412" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    reset:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="#3A2412" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#3A2412" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#3A2412" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  /* ----- 개념 사이클(새 규칙 11·21·31·41, 변주 6·16·26·36·46) ----- */
  const CONC = {
    order:['hole', 'cold', 'fragile', 'heavy'],
    info:{
      hole:{ name:'막힌 칸', desc:'이미 다른 물건이 놓인 회색 칸이 있어요. 그 칸은 비워 두고 나머지를 빈틈없이 채워요.' },
      cold:{ name:'차가운 칸', desc:'파란 칸에는 차가운 물건(❄ 표시)만, 파란 칸이 아닌 곳에는 차갑지 않은 물건만 놓을 수 있어요.' },
      fragile:{ name:'깨지는 물건', desc:'금이 그려진 물건은 깨지기 쉬워요. 깨지는 물건끼리는 서로 옆에 붙여 놓을 수 없어요.' },
      heavy:{ name:'무거운 물건', desc:'추가 그려진 물건은 무거워요. 맨 아래 두 줄에만 놓을 수 있어요.' }
    },
    twists:['flash', 'bare', 'big', 'turn'],
    twInfo:{
      flash:{ name:'빠른 판', desc:'제한 시간이 아주 짧아요. 빠르게 정리해요!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 머리로 정리해요.' },
      big:{ name:'큰 칸', desc:'칸이 더 커요. 물건도 많아요. 대신 시간은 넉넉해요.' },
      turn:{ name:'돌리기 제한', desc:'물건을 돌릴 수 있는 횟수가 정해져 있어요. 돌리기 전에 먼저 생각해요.' }
    }
  };
  const RULE_TIP = { hole:'회색 칸은 비워 둬요', cold:'❄ 물건은 파란 칸에만', fragile:'깨지는 물건은 떨어뜨려요', heavy:'무거운 물건은 아래 두 줄', flash:'시간이 짧아요', bare:'힌트 없음', big:'큰 칸', turn:'돌리기 횟수 제한' };

  const round5 = v => Math.max(30, Math.round(v / 5) * 5);
  const PLACES = ['drawer', 'desk', 'fridge', 'closet', 'pantry'];
  function stageCfg(n){
    const p = planOf('tidy', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let area = 12 + 3 * (c - 1) + (k - 1) * .9 + (p.hard ? 3 : 0) + (p.boss ? 5 : 0);
    if(tw === 'big') area += 6;
    area = Math.max(12, Math.min(42, Math.round(area)));
    const R = Math.max(3, Math.round(Math.sqrt(area * .85))), C = Math.max(4, Math.ceil(area / R));
    const mx = c === 1 ? (k < 4 ? 3 : 4) : c <= 3 ? 4 : 5;
    let limit = (R * C) * 7 + 60;
    if(has('cold')) limit *= 1.1; if(has('fragile')) limit *= 1.1; if(has('heavy')) limit *= 1.05; if(has('hole')) limit *= 1.05;
    if(tw === 'flash') limit *= .6; if(tw === 'big') limit *= 1.05;
    return { place:PLACES[(c - 1) % 5], R, C, mx, holes:has('hole') ? 2 + Math.floor(R * C / 12) : 0, cold:has('cold') ? 1 : 0, fragile:has('fragile') ? 2 + (R * C > 24 ? 1 : 0) : 0,
      heavy:has('heavy') ? 1 : 0, limit:round5(limit), hints:tw === 'bare' ? 0 : p.boss ? 1 : 2, turnCap:tw === 'turn' ? 99 : 0, mj:mj.slice(), tw, boss:p.boss, hard:p.hard, n };
  }

  /* ===== 판 만들기: rng로만 =====
     1) 막힌 칸 고르기 2) 빈 칸을 이어진 덩어리(1~mx칸)로 쪼개기 3) 규칙 표시 붙이기(차가운 칸·깨지는·무거운) 4) 이름·색 */
  const nb = (R, C, i) => { const r = Math.floor(i / C), c = i % C, o = []; if(r > 0) o.push(i - C); if(c > 0) o.push(i - 1); if(c < C - 1) o.push(i + 1); if(r < R - 1) o.push(i + C); return o; };
  function pickOf(rng, a){ return a[Math.floor(rng() * a.length)]; }
  function shuffle(rng, a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function partition(R, C, blocked, mx, rng){
    const own = new Array(R * C).fill(-1); blocked.forEach(i => { own[i] = -2; });
    const pcs = [];
    const order = shuffle(rng, [...Array(R * C).keys()].filter(i => own[i] === -1));
    for(const s of order){
      if(own[s] !== -1) continue;
      const id = pcs.length, cells = [s]; own[s] = id;
      const want = 2 + Math.floor(rng() * (mx - 1));      /* 2..mx */
      while(cells.length < want){
        const fr = []; cells.forEach(i => nb(R, C, i).forEach(j => { if(own[j] === -1 && !fr.includes(j)) fr.push(j); }));
        if(!fr.length) break;
        const j = pickOf(rng, fr); own[j] = id; cells.push(j);
      }
      pcs.push(cells);
    }
    /* 한 칸짜리는 이웃 덩어리에 붙인다(너무 커지면 그대로 둠) */
    for(let id = 0; id < pcs.length; id++){
      if(pcs[id].length !== 1) continue;
      const i = pcs[id][0], opts = nb(R, C, i).filter(j => own[j] >= 0 && own[j] !== id && pcs[own[j]].length < mx + 1);
      if(!opts.length) continue;
      const t = own[pickOf(rng, opts)]; pcs[t].push(i); own[i] = t; pcs[id] = [];
    }
    return pcs.filter(p => p.length);
  }
  function makePuzzle(cfg, rng){
    const R = cfg.R, C = cfg.C, N = R * C;
    for(let tries = 0; tries < 40; tries++){
      const blocked = cfg.holes ? shuffle(rng, [...Array(N).keys()]).slice(0, cfg.holes) : [];
      const pcs = partition(R, C, blocked, cfg.mx, rng);
      if(pcs.length < 3) continue;
      const ownOf = new Array(N).fill(-1); pcs.forEach((p, id) => p.forEach(i => { ownOf[i] = id; }));
      const adj = pcs.map((p, id) => { const s = new Set(); p.forEach(i => nb(R, C, i).forEach(j => { if(ownOf[j] >= 0 && ownOf[j] !== id) s.add(ownOf[j]); })); return s; });
      const tag = pcs.map(() => ({ cold:false, fragile:false, heavy:false }));
      const cold = new Set();
      if(cfg.cold){          /* 이어진 물건들로 파란 칸(전체의 30~45%) */
        const goal = Math.round(N * (.3 + rng() * .15)); let area = 0;
        const seed = Math.floor(rng() * pcs.length), q = [seed], seen = new Set([seed]);
        while(q.length && area < goal){
          const a = q.shift(); tag[a].cold = true; area += pcs[a].length; pcs[a].forEach(i => cold.add(i));
          shuffle(rng, [...adj[a]]).forEach(b => { if(!seen.has(b)){ seen.add(b); q.push(b); } });
        }
        if(pcs.filter((p, id) => tag[id].cold).length < 2 || cold.size > N * .6) continue;
      }
      if(cfg.heavy){         /* 아래 두 줄 안에 통째로 든 물건 */
        const low = pcs.map((p, id) => id).filter(id => pcs[id].length >= 2 && pcs[id].every(i => Math.floor(i / C) >= R - 2) && !tag[id].cold);
        if(!low.length) continue;
        shuffle(rng, low).slice(0, Math.max(1, Math.round(pcs.length / 6))).forEach(id => { tag[id].heavy = true; });
      }
      if(cfg.fragile){       /* 서로 닿지 않는 물건들 */
        let got = 0; const pick = [];
        for(const id of shuffle(rng, pcs.map((p, i) => i))){
          if(got >= cfg.fragile) break;
          if(pcs[id].length < 2 || tag[id].heavy) continue;
          if(pick.some(o => adj[o].has(id))) continue;
          pick.push(id); tag[id].fragile = true; got++;
        }
        if(got < Math.min(2, cfg.fragile)) continue;
      }
      /* 이름·색 */
      const base = NAMES[cfg.place] || NAMES.drawer, used = {};
      const items = pcs.map((p, id) => {
        const t = tag[id], pool = t.heavy ? HEAVY : t.fragile ? FRAG : t.cold ? COLD : base, nm = pickOf(rng, pool);
        used[nm] = (used[nm] || 0) + 1;
        return { id, sol:p.slice().sort((a, b) => a - b), nm, col:Math.floor(rng() * PAL.length), cold:t.cold, fragile:t.fragile, heavy:t.heavy, rot:Math.floor(rng() * 4) };
      });
      /* 색이 이웃과 같으면 구별이 안 되니 이웃끼리는 다른 색으로 */
      items.forEach((it, id) => { let g = 0; while(g++ < 12 && [...adj[id]].some(b => b < id && items[b].col === it.col)) it.col = (it.col + 1) % PAL.length; });
      return { R, C, blocked, cold, items, N };
    }
    /* 못 만들면 규칙 없는 판으로 */
    return makePuzzle(Object.assign({}, cfg, { cold:0, heavy:0, fragile:0 }), rng);
  }

  /* ----- 물건 모양 ----- */
  function shapeOf(it){          /* 지금 돌린 모양: [[r,c],…] 0,0 기준 */
    let cells = it.sol.map(i => [Math.floor(i / S().P.C), i % S().P.C]);
    for(let k = 0; k < it.rot; k++) cells = cells.map(([r, c]) => [c, -r]);
    const r0 = Math.min(...cells.map(x => x[0])), c0 = Math.min(...cells.map(x => x[1]));
    return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  /* 놓아 보기: 규칙에 맞는지 확인. 돌려주는 값 { ok, why, rule } (rule = 규칙을 어긴 것이라 실수로 셈) */
  function check(m, it, cells){
    const P = m.P;
    for(const [r, c] of cells){
      if(r < 0 || c < 0 || r >= P.R || c >= P.C) return { ok:false, why:'칸 밖으로 나가요' };
      const i = r * P.C + c;
      if(P.blocked.includes(i)) return { ok:false, why:'거긴 이미 물건이 있어요' };
      if(m.at[i] >= 0) return { ok:false, why:'거긴 자리가 찼어요' };
    }
    const idx = cells.map(([r, c]) => r * P.C + c);
    if(m.cfg.cold){
      if(it.cold && idx.some(i => !P.cold.has(i))) return { ok:false, why:'❄ 차가운 물건은 파란 칸에만 놓아요', rule:1 };
      if(!it.cold && idx.some(i => P.cold.has(i))) return { ok:false, why:'파란 칸은 차가운 물건 자리예요', rule:1 };
    }
    if(it.heavy && idx.some(i => Math.floor(i / P.C) < P.R - 2)) return { ok:false, why:'무거운 물건은 아래 두 줄에만 놓아요', rule:1 };
    if(it.fragile){
      for(const i of idx) for(const j of nb(P.R, P.C, i)){ const o = m.at[j]; if(o >= 0 && o !== it.id && P.items[o].fragile) return { ok:false, why:'깨지는 물건끼리는 떨어뜨려요', rule:1 }; }
    }
    return { ok:true, idx };
  }
  function putAt(m, it, idx){ idx.forEach(i => { m.at[i] = it.id; }); m.pos[it.id] = idx; }
  function takeOut(m, id){ (m.pos[id] || []).forEach(i => { m.at[i] = -1; }); m.pos[id] = null; }
  function placedCount(m){ return m.pos.filter(Boolean).length; }

  /* ----- 그림 ----- */
  function snow(x, y, s, col){ return `<g stroke="${col}" stroke-width="${s * .22}" stroke-linecap="round"><path d="M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}M${x - s * .7} ${y - s * .7}L${x + s * .7} ${y + s * .7}M${x - s * .7} ${y + s * .7}L${x + s * .7} ${y - s * .7}"/></g>`; }
  function itemMark(it, x, y, s){     /* 칸 안에 들어가는 작은 표시: 눈꽃·금·추 */
    let o = '';
    if(it.cold) o += snow(x, y, s * .26, '#FFFFFF');
    if(it.fragile) o += `<path d="M${x - s * .18} ${y - s * .3}l${s * .12} ${s * .2}l${-s * .1} ${s * .14}l${s * .14} ${s * .2}" fill="none" stroke="${OL}" stroke-width="${s * .07}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(it.heavy) o += `<path d="M${x - s * .22} ${y + s * .22}l${s * .09} ${-s * .36}h${s * .26}l${s * .09} ${s * .36}z" fill="${OL}"/><circle cx="${x}" cy="${y - s * .22}" r="${s * .07}" fill="none" stroke="${OL}" stroke-width="${s * .05}"/>`;
    return o;
  }
  /* 물건 하나(칸 목록, 100단위 칸): 같은 물건 칸끼리는 선 없이 이어지고 바깥 변만 굵은 선 */
  function pieceSvg(it, cells, lab, fs, sel){
    const set = new Set(cells.map(([r, c]) => r + ',' + c), 0), col = PAL[it.col];
    let o = '';
    cells.forEach(([r, c]) => { o += `<rect x="${c * 100}" y="${r * 100}" width="100" height="100" fill="${col}"/>`; });
    cells.forEach(([r, c]) => {
      const x = c * 100, y = r * 100;
      o += `<rect x="${x + 12}" y="${y + 10}" width="76" height="22" rx="10" fill="#fff" opacity=".28"/>`;
    });
    let e = '';
    cells.forEach(([r, c]) => {
      const x = c * 100, y = r * 100;
      if(!set.has((r - 1) + ',' + c)) e += `M${x} ${y}h100`;
      if(!set.has((r + 1) + ',' + c)) e += `M${x} ${y + 100}h100`;
      if(!set.has(r + ',' + (c - 1))) e += `M${x} ${y}v100`;
      if(!set.has(r + ',' + (c + 1))) e += `M${x + 100} ${y}v100`;
    });
    o += `<path d="${e}" fill="none" stroke="${sel ? '#FFFFFF' : OL}" stroke-width="${sel ? 11 : 8}" stroke-linecap="round"/>`;
    if(sel) o += `<path d="${e}" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>`;
    const a = cells[0];
    let mx = 0, my = 0; cells.forEach(([r, c]) => { mx += c; my += r; });
    const ax = a[1] * 100 + 50, ay = a[0] * 100 + 50;
    o += itemMark(it, ax + (lab ? 0 : 0), lab ? ay - 22 : ay, 100);
    if(lab) o += `<text x="${ax}" y="${ay + 34}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${OL}" stroke="#fff" stroke-width="${fs * .2}" paint-order="stroke" font-family="var(--disp),sans-serif">${it.nm}</text>`;
    return o;
  }
  function boardSvg(m){
    const P = m.P, W = P.C * 100, H = P.R * 100, w = WOOD[m.cfg.place] || WOOD.drawer, fs = Math.max(26, Math.min(36, 1300 / (m.cs || 48)));
    let o = `<rect width="${W}" height="${H}" fill="${w[1]}"/>`;
    for(let i = 0; i < P.N; i++){
      const r = Math.floor(i / P.C), c = i % P.C, x = c * 100, y = r * 100, cd = P.cold.has(i);
      if(P.blocked.includes(i)){
        o += `<rect x="${x}" y="${y}" width="100" height="100" fill="#8D8D99"/><path d="M${x + 14} ${y + 14}L${x + 86} ${y + 86}M${x + 86} ${y + 14}L${x + 14} ${y + 86}" stroke="#5E5E6B" stroke-width="8" stroke-linecap="round"/><rect x="${x + 4}" y="${y + 4}" width="92" height="92" fill="none" stroke="${OL}" stroke-width="6"/>`;
      } else {
        o += `<rect x="${x + 3}" y="${y + 3}" width="94" height="94" rx="12" fill="${cd ? '#BFE6FA' : w[0]}" stroke="${cd ? '#6FB6DA' : '#8A6236'}" stroke-width="3"/>`;
        if(cd) o += snow(x + 50, y + 50, 22, '#8CCBE8');
      }
    }
    if(m.cfg.heavy) o += `<path d="M0 ${(P.R - 2) * 100}H${W}" stroke="${OL}" stroke-width="5" stroke-dasharray="14 10" opacity=".7"/>`;
    m.P.items.forEach((it, id) => {
      const idx = m.pos[id]; if(!idx) return;
      const cells = idx.map(i => [Math.floor(i / P.C), i % P.C]);
      o += `<g class="td-it" data-id="${id}">${pieceSvg(it, cells, true, fs, false)}</g>`;
    });
    return o;
  }
  function traySvg(it, cs, sel){
    const sh = shapeOf(it), w = Math.max(...sh.map(x => x[1])) + 1, h = Math.max(...sh.map(x => x[0])) + 1;
    return `<svg viewBox="-8 -8 ${w * 100 + 16} ${h * 100 + 16}" width="${w * cs + 6}" height="${h * cs + 6}" aria-hidden="true">${pieceSvg(it, sh, false, 0, sel)}</svg>`;
  }

  /* ----- 화면 ----- */
  function msg(html, cls){ const e = $('#tdMsg'); if(!e) return; e.className = 'td-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S(), it = m.sel >= 0 ? m.P.items[m.sel] : null;
    if(it){ const t = [it.cold ? '❄ 차가운 물건' : '', it.fragile ? '깨지는 물건' : '', it.heavy ? '무거운 물건' : ''].filter(Boolean).join(' · ');
      return `<b>${it.nm}</b><span>${t ? t + ' · ' : ''}칸을 눌러 놓아요</span>`; }
    if(m.boss) return '<b class="boss">대장 판</b><span>끝까지 집중!</span>';
    return '<span>아래 물건을 골라 칸에 놓아요</span>';
  }
  function paint(){
    const m = S(); if(!m) return;
    const g = $('#tdDyn'); if(g) g.innerHTML = boardSvg(m);
    const tr = $('#tdTray');
    if(tr){
      const cs = Math.max(18, Math.min(28, Math.floor(m.cs * .42)));
      const rest = m.P.items.filter(it => !m.pos[it.id]);
      tr.innerHTML = rest.length ? rest.map(it => `<button class="td-tb${m.sel === it.id ? ' on' : ''}" data-id="${it.id}" aria-label="${it.nm}${it.cold ? ' 차가운 물건' : ''}${it.fragile ? ' 깨지는 물건' : ''}${it.heavy ? ' 무거운 물건' : ''}">${traySvg(it, cs, m.sel === it.id)}</button>`).join('') : '<span class="td-empty">다 정리했어요!</span>';
    }
    const n = placedCount(m), a = $('#tdDone'); if(a) a.textContent = n;
    const tn = $('#tdTurn'); if(tn){ tn.disabled = m.sel < 0 || m.phase !== 'play' || (m.turnMax && m.turns >= m.turnMax); const t = tn.querySelector('b'); if(t) t.textContent = m.turnMax ? `${Math.max(0, m.turnMax - m.turns)}` : ''; }
    const h = $('#tdHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.phase !== 'play'; }
    const r = $('#tdReset'); if(r) r.disabled = !n || m.phase !== 'play';
  }
  function layout(){
    const m = S(), box = $('#tdBoard'), root = document.querySelector('.ng-tidy'); if(!box || !root) return;
    const W = Math.min((root.clientWidth || 360) + 12, 480) - 26, P = m.P;
    const cs = Math.max(34, Math.min(66, Math.floor(Math.min(W / P.C, (innerHeight || 740) * .44 / P.R))));
    m.cs = cs; box.style.width = cs * P.C + 'px'; box.style.height = cs * P.R + 'px';
  }

  /* ----- 조작 ----- */
  const canPlay = () => { const m = S(); return m && !G.over && !G.paused && m.phase === 'play'; };
  function cellAt(e){
    const m = S(), box = $('#tdBoard'), r = box.getBoundingClientRect(), P = m.P;
    const c = Math.floor((e.clientX - r.left) / (r.width / P.C)), rr = Math.floor((e.clientY - r.top) / (r.height / P.R));
    return (c < 0 || rr < 0 || c >= P.C || rr >= P.R) ? -1 : rr * P.C + c;
  }
  function pick(id){
    const m = S(); if(!canPlay()) return;
    m.sel = m.sel === id ? -1 : id; sfx('tdPick'); paint(); msg(playMsg());
  }
  function tryPlace(cell){
    const m = S(), P = m.P, it = P.items[m.sel]; if(!it) return;
    const sh = shapeOf(it), tr = Math.floor(cell / P.C), tc = cell % P.C;
    const cr = sh.reduce((s, x) => s + x[0], 0) / sh.length, cc = sh.reduce((s, x) => s + x[1], 0) / sh.length;
    /* 누른 칸에 물건의 어느 칸이 오게 할지: 가운데에 가까운 칸부터 */
    const cand = sh.slice().sort((a, b) => Math.hypot(a[0] - cr, a[1] - cc) - Math.hypot(b[0] - cr, b[1] - cc));
    let ruleFail = null;
    for(const q of cand){
      const cells = sh.map(([r, c]) => [r + tr - q[0], c + tc - q[1]]), res = check(m, it, cells);
      if(res.ok){ placeNow(it, res.idx); return; }
      if(res.rule && !ruleFail) ruleFail = res;
    }
    sfx('tdNo');
    if(ruleFail){ m.fails++; msg(`<b class="bad">${ruleFail.why}</b>`, 'td-pop'); }
    else msg('<b class="bad">거기엔 안 들어가요</b><span>돌려 보거나 다른 곳에 놓아요</span>', 'td-pop');
    try{ const b = $('#tdBoard'); fxShake(b, 4); }catch(_){}
    T(() => { if(m.phase === 'play') msg(playMsg()); }, 1500);
  }
  function placeNow(it, idx){
    const m = S(); putAt(m, it, idx); m.sel = -1; m.moves++;
    sfx('tdPut', { n:placedCount(m) }); paint();
    try{ const b = $('#tdBoard'), r = b.getBoundingClientRect(), P = m.P, c = idx[0], x = r.left + (c % P.C + .5) * r.width / P.C, y = r.top + (Math.floor(c / P.C) + .5) * r.height / P.R;
      if(!FXR.reduce) fxEmit(x, y, { quantity:6, speed:{ min:40, max:120 }, lifespan:{ min:250, max:500 }, kind:'star', tint:[PAL[it.col], '#FFFFFF'], scale:{ start:1, end:0 }, alpha:{ start:1, end:0 } }); }catch(_){}
    if(placedCount(m) === m.P.items.length) win(); else msg(playMsg());
  }
  function boardTap(e){
    const m = S(); if(!canPlay()) return;
    const cell = cellAt(e); if(cell < 0) return;
    const id = m.at[cell];
    if(id >= 0){ takeOut(m, id); m.sel = id; sfx('tdPick'); paint(); msg(playMsg()); return; }   /* 놓인 물건을 누르면 집어 들기 */
    if(m.sel < 0){ msg('<span>먼저 아래에서 물건을 골라요</span>', 'td-pop'); sfx('tdNo'); return; }
    tryPlace(cell);
  }
  function turn(){
    const m = S(); if(!canPlay() || m.sel < 0) return;
    if(m.turnMax && m.turns >= m.turnMax){ msg('<b class="bad">돌리기를 다 썼어요</b>', 'td-pop'); sfx('tdNo'); return; }
    const it = m.P.items[m.sel]; it.rot = (it.rot + 1) % 4; m.turns++; sfx('tdTurn'); paint();
  }
  function reset(){
    const m = S(); if(!canPlay()) return;
    m.P.items.forEach(it => takeOut(m, it.id)); m.sel = -1; sfx('tdOut'); paint(); msg(playMsg());
    try{ fxPunch($('#tdBoard'), 1.02); }catch(_){}
  }
  /* 힌트: 안 놓인(또는 잘못 놓인) 물건 하나를 정답 자리에 놓아 준다. 그 자리를 차지한 다른 물건은 빠진다 */
  function hint(){
    const m = S(); if(!canPlay() || m.hintLeft <= 0) return;
    const P = m.P, ok = it => m.pos[it.id] && m.pos[it.id].slice().sort((a, b) => a - b).join() === it.sol.join();
    const todo = P.items.filter(it => !ok(it)); if(!todo.length) return;
    const free = todo.filter(it => it.sol.every(i => m.at[i] < 0 || m.at[i] === it.id));
    const it = (free.length ? free : todo).reduce((a, b) => b.sol.length > a.sol.length ? b : a);
    takeOut(m, it.id); it.sol.forEach(i => { if(m.at[i] >= 0) takeOut(m, m.at[i]); });
    it.rot = 0; putAt(m, it, it.sol.slice()); m.sel = -1; m.hintLeft--; m.hints++;
    sfx('tdHint'); paint(); msg(`<b>힌트</b><span>${it.nm}을(를) 놓아 줬어요</span>`, 'td-pop');
    if(placedCount(m) === P.items.length) T(win, 500);
  }

  /* ----- 시계·끝 ----- */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const m = S(); if(G.paused || m.phase !== 'play' || !G.limit) return;
    const t = elapsed(), rem = remTime(t), sec = Math.ceil(rem), bar = $('#tdBar');
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#tdTime'); if(e) e.textContent = mmss(sec);
      const p = $('#tdTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#tdBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0) sfx('tdTick', { hi:sec <= 5 });
    }
    if(rem <= 0){ const e = $('#tdTime'); if(e) e.textContent = '0:00'; lose(); }
  }
  function win(){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.won = true; m.sec = elapsed(); paint();
    msg('<b>정리 끝!</b><span>' + (m.hints === 0 && m.fails === 0 ? '실수 없이 완벽!' : '깔끔해요') + '</span>', 'td-win');
    sfx('tdWin'); fxBuzz([30, 50, 30]);
    try{ const b = $('#tdBoard'); b.classList.add('cleared'); const p = fxCenter(b); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); }catch(_){}
    T(() => finish(true), 1300);
  }
  function lose(){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; paint();
    msg('<b class="bad">시간이 다 됐어요</b><span>정리한 물건 ' + placedCount(m) + '/' + m.P.items.length + '</span>', 'td-pop');
    sfx('tdTimeUp'); fxBuzz([40, 40, 60]); try{ fxShake($('#tdBoard'), 6); }catch(_){}
    T(() => finish(false), 1400);
  }

  /* ----- 그림(썸네일·도움말) ----- */
  function demoBoard(u, ox, oy, cs, fill, cells){
    let o = `<rect x="${ox - 5}" y="${oy - 5}" width="${cs * 5 + 10}" height="${cs * 4 + 10}" rx="7" fill="#B58654" stroke="${OL}" stroke-width="2.4"/>`;
    for(let r = 0; r < 4; r++) for(let c = 0; c < 5; c++) o += `<rect x="${ox + c * cs + 1}" y="${oy + r * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="3" fill="#E9C48A"/>`;
    cells.forEach(([r, c, k]) => { o += `<rect x="${ox + c * cs}" y="${oy + r * cs}" width="${cs}" height="${cs}" fill="${PAL[k]}" stroke="${PAL[k]}" stroke-width=".6"/>`; });
    return o;
  }
  const DEMO = [   /* 5×4 판을 채운 모양: [r, c, 색] */
    [[0,0,0],[0,1,0],[1,0,0],[1,1,0]], [[0,2,1],[0,3,1],[0,4,1],[1,4,1]], [[1,2,3],[1,3,3],[2,2,3],[2,3,3]],
    [[2,0,4],[3,0,4],[3,1,4],[3,2,4]], [[2,1,2],[2,4,5],[3,3,5],[3,4,5]]
  ];
  function howPic(){
    const cs = 34, ox = 18, oy = 20;
    let o = `<rect width="320" height="180" fill="#FFE9C9"/>${demoBoard('h', ox, oy, cs, 0, DEMO[0].concat(DEMO[1], DEMO[2]))}`;
    /* 아직 안 놓은 물건: 아래 쪽 L 모양 → 빈 자리로 화살표 */
    const pc = DEMO[3];
    pc.forEach(([r, c, k]) => { o += `<rect x="${222 + c * 26}" y="${60 + r * 26 - 52}" width="26" height="26" fill="${PAL[k]}" stroke="${OL}" stroke-width="2.4"/>`; });
    o += `<path d="M214 100C200 120 160 126 130 118" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/><path d="M140 108l-14 10 16 8" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg viewBox="0 0 320 180" aria-hidden="true">${o}</svg>`;
  }

  return {
    name:'착착 정리', abil:'공간지각', col:['#FFD9A8', '#F2994A', '#B5651D'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="3" width="19" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="5.5" width="6" height="6"/><rect x="11" y="11.5" width="8" height="6"/><rect x="5" y="13.5" width="4" height="4"/></svg>',
    art(){
      const u = 'tdA' + Math.floor(performance.now() * 1000 % 1e6);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9C9"/><stop offset="1" stop-color="#F6C48A"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/>${demoBoard(u, 30, 12, 19, 0, DEMO.flat())}
        <path d="M30 12h95v76H30z" fill="none"/>
        <circle cx="140" cy="88" r="5" fill="#fff" opacity=".5"/></svg>`;
    },
    help:[
      ['물건을 골라 칸에 놓아요', '아래 물건을 누르고, 칸을 누르면 그 자리에 놓여요. 놓인 물건을 누르면 다시 집을 수 있어요.'],
      ['돌려서 맞춰요', '[돌리기]를 누르면 물건이 시계 방향으로 돌아요. 모양을 돌려 가며 빈틈에 꼭 맞춰요.'],
      ['빈틈없이 채우면 성공', '모든 물건을 칸에 넣으면 정리 끝! 제한 시간이 있고, 규칙을 어기면 점수가 줄어요.'],
      ['막히면 힌트', '💡힌트는 물건 하나를 정답 자리에 놓아 줘요. 대신 점수가 50점 줄어요.']
    ],
    howto:{ pic:howPic, lines:['아래 물건을 눌러 골라요', '칸을 눌러 놓고, 돌려서 맞춰요', '빈틈없이 다 넣으면 성공'],
      more:[['누르고 놓기', '물건을 누른 뒤 칸을 누르면 놓여요. 놓인 물건을 누르면 다시 집어요.'], ['돌리기', '[돌리기]는 고른 물건을 시계 방향으로 돌려요.'], ['점수', '빨리 끝내고, 규칙을 어기지 않고, 힌트를 안 쓸수록 높아요.']] },
    helpExtra(){ const m = G && G.id === 'tidy' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['서랍 정리', '책상 정리', '냉장고 정리', '옷장 정리', '찬장 정리'],
    starRule:'★ 다 정리하기 · ★★ 힌트 1번 이하, 규칙 어김 6번 이하 · ★★★ 힌트 없이 규칙 어김 2번 이하',
    levels:{
      easy:{ place:'drawer', R:4, C:4, mx:3, holes:0, cold:0, fragile:0, heavy:0, limit:150, hints:2, turnCap:0 },
      normal:{ place:'desk', R:5, C:5, mx:4, holes:3, cold:0, fragile:0, heavy:0, limit:210, hints:2, turnCap:0 },
      hard:{ place:'fridge', R:6, C:5, mx:5, holes:2, cold:1, fragile:0, heavy:0, limit:300, hints:2, turnCap:0 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${PLACE[c.place]} ${c.R}×${c.C} · ${mmss(c.limit)}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${PLACE[c.place]} ${c.R}×${c.C}`; },
    init(cfg, rng){
      const P = makePuzzle(cfg, rng), n = P.items.length;
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      if(!G.adv){ if(cfg.holes) tips.push(RULE_TIP.hole); if(cfg.cold) tips.push(RULE_TIP.cold); }
      G.m = { P, cfg, at:new Array(P.N).fill(-1), pos:new Array(n).fill(null), sel:-1, moves:0, fails:0, hints:0, turns:0, turnMax:cfg.turnCap ? n + 3 : 0,
        hintLeft:cfg.hints == null ? 2 : cfg.hints, phase:'play', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, lastSec:-1, sec:0, cs:48, timers:new Set() };
      G.limit = cfg.limit;
      const m = G.m;
      G.cleanup = () => { m.timers.forEach(clearTimeout); m.timers.clear(); if(m.onResize) removeEventListener('resize', m.onResize); if(G && G.raf) cancelAnimationFrame(G.raf); };
      /* 테스트·도구용: 정답대로 하나씩 놓아 끝까지 */
      m._solveForTest = () => new Promise(res => {
        let k = 0;
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.moves); return; }
          if(k >= n){ res(-1); return; }
          const it = P.items[k++]; it.rot = 0; m.sel = it.id; placeNow(it, it.sol.slice()); setTimeout(step, 120);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _make:makePuzzle, _stage:stageCfg,
    render(st){
      const m = S(), P = m.P;
      st.innerHTML = `<div class="ng-tidy">
        <div class="hud-row">
          <div class="hchip td-done" aria-label="정리한 물건"><span class="hv">${ICO.box}<b id="tdDone">0</b><small>/${P.items.length}개</small></span><em>정리한 물건</em></div>
          <div class="hchip time" id="tdTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="tdTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="td-rules" aria-label="켜진 규칙">${m.boss ? '<span class="td-chip boss">대장 판</span>' : ''}${m.mj.map(k => `<span class="td-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="td-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="td-barw" id="tdBarWrap"><i id="tdBar"></i></div>
        <div class="td-msg" id="tdMsg"><span>아래 물건을 골라 칸에 놓아요</span></div>
        <div class="td-wrap"><div class="td-frame"><div class="td-board" id="tdBoard" role="group" aria-label="${PLACE[m.cfg.place] || '선반'} ${P.R}×${P.C}, 물건 ${P.items.length}개">
          <svg viewBox="0 0 ${P.C * 100} ${P.R * 100}" aria-hidden="true"><g id="tdDyn"></g></svg>
        </div></div></div>
        <div class="td-tray" id="tdTray" aria-label="아직 안 넣은 물건"></div>
        <div class="tools-row td-ctl">
          <button class="tool" id="tdTurn" aria-label="돌리기">${ICO.turn}<span>돌리기</span><b class="cnt"></b></button>
          <button class="tool" id="tdReset" aria-label="모두 빼기">${ICO.reset}<span>모두 빼기</span></button>
          <button class="tool item" id="tdHint" aria-label="힌트">${ICO.hint}<span>힌트</span><b class="cnt">${m.hintLeft}</b></button>
        </div>
      </div>`;
      layout(); paint();
      $('#tdBoard').onclick = boardTap;
      $('#tdTray').onclick = e => { const b = e.target.closest('.td-tb'); if(b) pick(+b.dataset.id); };
      $('#tdTurn').onclick = turn; $('#tdReset').onclick = reset; $('#tdHint').onclick = hint;
      m.onResize = () => { layout(); paint(); };
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; if(!m) return 0; if(m.won) return 1; const P = m.P, tot = P.N - P.blocked.length; let c = 0; m.at.forEach(x => { if(x >= 0) c++; }); return Math.min(.97, c / tot); },
    lossText(){ const m = G.m; return `물건 ${m.P.items.length}개 중 ${placedCount(m)}개를 정리했어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit || 1, m.sec || elapsed()));
      const time = G.limit ? Math.max(0, 300 - Math.floor(sec * 300 / G.limit)) : 150;
      const extra = Math.max(0, 200 - 15 * m.fails - 50 * m.hints);
      return { base:500, time, extra, rows:[`다 정리하기 (물건 ${m.P.items.length}개)`, '시간 보너스 (' + mmss(sec) + ')', `규칙 어김 ${m.fails}번 · 힌트 ${m.hints}`] };
    },
    stars(){ const m = G.m; return m.hints === 0 && m.fails <= 2 ? 3 : m.hints <= 1 && m.fails <= 6 ? 2 : 1; },
    css:`
body[data-mode="tidy"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 2px, transparent 2px 28px),
  linear-gradient(180deg,#FFF1DA 0%,#FFDFB3 55%,#F7C687 100%) fixed}
.ng-tidy{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-tidy .hud-row{margin:0}
.ng-tidy .hchip.time.hurry{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)} .ng-tidy .hchip.time.hurry b{color:#E5484D}
.ng-tidy .td-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(58,36,18,.18); border:2px solid #3A2412; overflow:hidden}
.ng-tidy .td-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#FFD27A,#F2994A); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-tidy .td-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-tidy .td-msg{width:100%; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#5A3A1C; white-space:nowrap; overflow:hidden}
.ng-tidy .td-msg b{font-family:var(--heavy); font-weight:400; font-size:19px; color:#fff; -webkit-text-stroke:5px #3A2412; paint-order:stroke fill; letter-spacing:.5px}
.ng-tidy .td-msg b.boss{color:#FFE27A} .ng-tidy .td-msg b.bad{color:#FF9A8F}
.ng-tidy .td-msg.td-pop, .ng-tidy .td-msg.td-win{animation:tidy-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-tidy .td-msg.td-win b{font-size:24px; color:#FFE27A}
@keyframes tidy-in{from{transform:scale(.6); opacity:0}}
.ng-tidy .td-wrap{margin:2px -6px 0; display:flex; justify-content:center}
.ng-tidy .td-frame{padding:8px; border-radius:18px; background:#8A5A2B; border:3px solid #3A2412; box-shadow:inset 0 2px 0 rgba(255,255,255,.22), 0 5px 0 #3A2412, 0 14px 22px rgba(90,50,10,.28)}
.ng-tidy .td-board{position:relative; touch-action:manipulation; border-radius:10px; overflow:hidden; box-shadow:inset 0 0 0 2.5px #3A2412; cursor:pointer}
.ng-tidy .td-board svg{display:block; width:100%; height:100%}
.ng-tidy .td-board.cleared{animation:tidy-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes tidy-cheer{40%{scale:1.03}}
.ng-tidy .td-tray{display:flex; flex-wrap:wrap; gap:10px; justify-content:center; align-items:center; width:100%; min-height:72px; margin:14px 0 0; padding:10px; border-radius:16px; background:rgba(255,255,255,.55); border:2.5px dashed #B58654}
.ng-tidy .td-tb{appearance:none; border:2.5px solid transparent; background:rgba(255,255,255,.7); border-radius:12px; padding:5px; min-width:48px; min-height:48px; display:flex; align-items:center; justify-content:center; cursor:pointer}
.ng-tidy .td-tb.on{border-color:#3A2412; background:#FFF3C4; box-shadow:0 3px 0 #3A2412; transform:translateY(-2px)}
.ng-tidy .td-tb svg{display:block}
.ng-tidy .td-empty{font-family:var(--disp); font-size:16px; color:#5A3A1C}
.ng-tidy .td-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-tidy .td-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #3A2412; background:#fff; color:#4A2E14; box-shadow:0 2px 0 #3A2412; white-space:nowrap}
.ng-tidy .td-chip.mj{background:#FFE9C2; color:#7A4A12} .ng-tidy .td-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-tidy .td-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-tidy .td-ctl{margin-top:0; padding-top:14px}
.ng-tidy .td-ctl .tool{flex-direction:row; gap:6px; min-height:54px; font-size:16px}
.ng-tidy .td-ctl .tool .cnt{font-style:normal} .ng-tidy .td-ctl .tool .cnt:empty{display:none}
@media (max-width:370px){ .ng-tidy .td-ctl .tool{font-size:14px; gap:3px} .ng-tidy .td-msg b{font-size:17px} }
@media (prefers-reduced-motion: reduce){ .ng-tidy .td-board.cleared, .ng-tidy .td-msg.td-pop, .ng-tidy .td-msg.td-win{animation:none} }
`,
    sounds:{
      tdPick(){ aTone({ f:560, f2:700, type:'triangle', d:.06, v:.05 }); },
      tdPut(o){ aThump({ f:170, f2:90, d:.1, v:.12 }); aMarimba(penta(Math.min(12, (o.n || 1) + 2), 64), { v:.05 }); },
      tdTurn(){ aWhoosh({ f:2200, f2:700, a:.01, d:.12, v:.04 }); aTone({ f:640, f2:760, type:'triangle', d:.05, v:.03 }); },
      tdNo(){ aThump({ f:130, f2:70, d:.12, v:.1 }); },
      tdOut(){ aWhoosh({ f:2400, f2:500, a:.01, d:.2, v:.04 }); },
      tdHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      tdWin(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 2, 67), { t:i * .07, v:.12 })); aSparkle({ t:.45, n:7 }); },
      tdTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      tdTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ tdPick:60, tdPut:60, tdNo:150, tdTick:250, tdTurn:60 },
    jingle(){ [0, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 1, 70), { t:i * .08, v:.16 })); aSparkle({ t:.6, n:6 }); }
  };
})();

/* 대전: 같은 선반을 누가 먼저 다 정리하나(진행률 = 채운 칸 비율) */
Object.assign(NG.tidy, { duelPace:[100, .74], duelStat:{ unit:'%', get:() => ({ v:Math.floor(NG.tidy.progress() * 100), t:100, lf:null }) }, duelHow:'같은 선반 · 누가 먼저 다 정리하나?' });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.tidy.scene = { kind:'motes', colors:['#FFFFFF', '#FFD27A', '#FFB070'], density:.5, alpha:.5 };
