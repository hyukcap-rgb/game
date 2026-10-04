/* 가로세로 낱말퀴즈 */
/* ===== 가로세로 낱말퀴즈 (crossword) · 하루퍼즐 리그 게임 모듈 =====
   판 위에 가로·세로로 엇갈려 놓인 한국어 낱말(한 칸 = 한 글자)을 뜻풀이 열쇠를 보고 맞힌다.
   낱말과 뜻풀이는 모두 crossword-words.js의 사전(직접 만든 것)에서만 나온다.
   판은 rng로 낱말을 하나씩 엇갈려 붙여 만든다(모든 낱말이 다른 낱말과 적어도 한 번 겹침 = 고립 낱말 없음). */
NG.crossword = (() => {
  const OL = '#1A0F45';
  const GOLD_SEC = 15, TICK_SEC = 5;

  /* ----- 사전 읽기(처음 한 번): 주제 순서·줄 순서대로. 같은 낱말은 먼저 나온 것만 ----- */
  let DICT = null;
  function dict(){
    if(DICT) return DICT;
    const words = [], seen = new Set(), cats = [];
    for(const key of Object.keys(CW_DICT)){
      const [name, text] = CW_DICT[key]; cats.push(key);
      for(const line of text.split('\n')){
        const k = line.indexOf('='); if(k < 0) continue;
        const w = line.slice(0, k).trim(), c = line.slice(k + 1).trim();
        if(!/^[가-힣]{2,5}$/.test(w) || !c || seen.has(w)) continue;
        seen.add(w); words.push({ w, c, cat:key, prov:CW_PROVERB[w] || null });
      }
    }
    const idx = new Map();   /* 글자 → [[낱말 번호, 자리], …] */
    words.forEach((o, wi) => { for(let p = 0; p < o.w.length; p++){ const s = o.w[p]; if(!idx.has(s)) idx.set(s, []); idx.get(s).push([wi, p]); } });
    const catName = {}; for(const key of cats) catName[key] = CW_DICT[key][0];
    return DICT = { words, idx, cats, catName };
  }
  const THEMES = ['food', 'animal', 'nature', 'life', 'town', 'play'];   /* 주제 판에 쓰는 큰 주제 */

  /* ===== 판 만들기 =====
     빈 판에 첫 낱말을 놓고, 이미 놓인 글자와 겹치는(교차) 자리에만 다음 낱말을 붙인다.
     - 낱말 앞뒤 칸은 비어 있어야 하고, 새 글자 옆(가로 낱말이면 위아래)도 비어 있어야 한다 → 사전에 없는 글자 줄이 생기지 않음
     - 이미 같은 방향으로 쓰인 칸은 다시 쓰지 않는다
     - 교차가 많은 자리 · 긴 낱말 · (주제·속담 판이면 그 낱말) 을 먼저 고른다. 여러 번 만들어 보고 가장 좋은 판을 쓴다. */
  function makeBoard(cfg, rng){
    const D = dict(), N = cfg.size, target = cfg.words;
    const okLen = wi => D.words[wi].w.length <= N;
    const bonus = wi => { const o = D.words[wi]; return (cfg.theme && o.cat === cfg.theme ? 5 : 0) + (cfg.proverb && o.prov ? 6 : 0); };
    function once(){
      const g = new Array(N * N).fill(null), use = new Array(N * N).fill(0), used = new Set(), list = [];
      let cross = 0;
      const fits = (w, r0, c0, d) => {   /* d: 0 가로, 1 세로 → 겹침 수(놓을 수 없으면 -1) */
        const dr = d, dc = 1 - d, L = w.length, bit = d ? 2 : 1;
        const r1 = r0 + dr * (L - 1), c1 = c0 + dc * (L - 1);
        if(r0 < 0 || c0 < 0 || r1 >= N || c1 >= N) return -1;
        const br = r0 - dr, bc = c0 - dc, ar = r1 + dr, ac = c1 + dc;
        if(br >= 0 && bc >= 0 && g[br * N + bc] != null) return -1;
        if(ar < N && ac < N && g[ar * N + ac] != null) return -1;
        let x = 0;
        for(let k = 0; k < L; k++){
          const r = r0 + dr * k, c = c0 + dc * k, i = r * N + c, v = g[i];
          if(v != null){ if(v !== w[k] || (use[i] & bit)) return -1; x++; continue; }
          const pr = r + dc, pc = c + dr, qr = r - dc, qc = c - dr;
          if(pr < N && pc < N && g[pr * N + pc] != null) return -1;
          if(qr >= 0 && qc >= 0 && g[qr * N + qc] != null) return -1;
        }
        return x === L ? -1 : x;   /* 모든 칸이 이미 찬 낱말은 놓지 않음(새 칸이 하나도 없으면 의미 없음) */
      };
      const put = (wi, r0, c0, d) => {
        const w = D.words[wi].w, dr = d, dc = 1 - d, cells = [];
        for(let k = 0; k < w.length; k++){ const i = (r0 + dr * k) * N + c0 + dc * k; if(g[i] != null) cross++; g[i] = w[k]; use[i] |= d ? 2 : 1; cells.push(i); }
        used.add(wi); list.push({ wi, r:r0, c:c0, d, cells });
      };
      /* 첫 낱말: 판 가운데쯤 가로(또는 세로)로, 4~5글자(작은 판은 3~4글자) */
      const lo = N <= 6 ? 3 : 4, hi = Math.min(5, N - 1);
      let first = D.words.map((o, wi) => wi).filter(wi => { const L = D.words[wi].w.length; return L >= lo && L <= hi; });
      const pref = first.filter(wi => bonus(wi) > 0);
      if(pref.length && rng() < .85) first = pref;
      const f = first[Math.floor(rng() * first.length)], fl = D.words[f].w.length, fd = rng() < .5 ? 0 : 1;
      const fr = Math.floor((N - 1) / 2) + Math.floor(rng() * 3) - 1, fc = Math.floor(rng() * (N - fl + 1));
      if(fd === 0) put(f, fr, fc, 0); else put(f, fc, fr, 1);
      while(list.length < target){
        let best = null, bs = -1e9;
        for(let i = 0; i < N * N; i++){
          const v = g[i]; if(v == null || use[i] === 3) continue;
          const d = use[i] & 1 ? 1 : 0, r = Math.floor(i / N), c = i % N, cand = D.idx.get(v); if(!cand) continue;
          for(const [wi, p] of cand){
            if(used.has(wi) || !okLen(wi)) continue;
            const w = D.words[wi].w, r0 = d ? r - p : r, c0 = d ? c : c - p;
            const x = fits(w, r0, c0, d); if(x < 1) continue;
            const s = x * 6 + w.length * .5 + bonus(wi) + rng() * 3.2;
            if(s > bs){ bs = s; best = [wi, r0, c0, d]; }
          }
        }
        if(!best) break;
        put(...best);
      }
      let filled = 0; g.forEach(v => { if(v != null) filled++; });
      return { g, list, cross, filled, score:Math.min(list.length, target) * 14 + cross * 5 + filled * .4 };
    }
    let best = null;
    for(let a = 0; a < 16; a++){
      const b = once();
      if(!best || b.score > best.score) best = b;
      if(b.list.length >= target && (b.cross >= target || a >= 3)) break;   /* 충분히 좋은 판이면 그만 */
    }
    return best;
  }

  /* 만든 판 → 칸·낱말·번호. 번호는 낱말이 시작하는 칸에 위에서 아래, 왼쪽에서 오른쪽 순서로 */
  function layoutWords(cfg, rng){
    const D = dict(), N = cfg.size, b = makeBoard(cfg, rng);
    const starts = new Map(); b.list.forEach(o => starts.set(o.cells[0], 0));
    let n = 0; [...starts.keys()].sort((a, c) => a - c).forEach(i => starts.set(i, ++n));
    const words = b.list.map(o => { const e = D.words[o.wi]; return { w:e.w, len:e.w.length, clue:e.c, cat:e.cat, prov:e.prov, d:o.d, num:starts.get(o.cells[0]), cells:o.cells, done:false, blind:false, gold:false }; });
    words.sort((a, c) => a.d - c.d || a.num - c.num);
    /* 칸마다 지나가는 낱말(가로·세로) */
    const at = Array.from({ length:N * N }, () => [-1, -1]);
    words.forEach((wd, k) => wd.cells.forEach(i => { at[i][wd.d] = k; }));
    const crossOf = wd => wd.cells.filter(i => at[i][0] >= 0 && at[i][1] >= 0).length;
    /* 규칙: 빈 열쇠(첫 글자만 보이고 뜻풀이 없음) — 겹침이 2개 이상인 3글자 이상 낱말 */
    if(cfg.blind){
      const pool = shuffle(words.filter(wd => wd.len >= 3 && crossOf(wd) >= 2), rng);
      const k = Math.min(cfg.blind, pool.length); for(let j = 0; j < k; j++) pool[j].blind = true;
    }
    /* 규칙: 황금 낱말(맞히면 +15초) */
    if(cfg.gold){
      const pool = shuffle(words.filter(wd => wd.len >= 3 && !wd.blind), rng);
      if(pool.length) pool[0].gold = true;
    }
    if(cfg.proverb) words.forEach(wd => { if(wd.prov) wd.useProv = true; });
    return { N, g:b.g, words, at, cross:b.cross };
  }

  /* ----- 개념 사이클: 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['theme', 'blind', 'gold', 'proverb'],
    info:{
      theme:{ name:'주제 판', desc:'판의 낱말이 거의 한 주제(음식·동물·자연…)에서 나와요. 주제를 떠올리면 더 빨리 풀려요.' },
      blind:{ name:'빈 열쇠', desc:'뜻풀이가 없는 낱말이 있어요. 첫 글자와 엇갈린 글자만 보고 맞혀요.' },
      gold:{ name:'황금 낱말', desc:'금빛 테두리 낱말을 맞히면 남은 시간이 ' + GOLD_SEC + '초 늘어나요.' },
      proverb:{ name:'속담 열쇠', desc:'뜻풀이 대신 속담이 나오는 낱말이 있어요. ○ 자리에 들어갈 말을 맞혀요.' }
    },
    twists:['flash', 'bare', 'tight', 'big', 'tick'],
    twInfo:{
      flash:{ name:'번개', desc:'낱말은 조금 적지만 제한 시간이 아주 짧아요.' },
      bare:{ name:'맨손', desc:'글자 열기와 틀린 칸 확인 없이 오직 머리로 풀어요.' },
      tight:{ name:'외줄 타기', desc:'틀린 낱말을 넣을 수 있는 기회가 딱 한 번! 확실할 때만 넣어요.' },
      big:{ name:'큰 판', desc:'판이 한 칸 더 크고 낱말이 많아요. 대신 시간도 넉넉해요.' },
      tick:{ name:'째깍 벌칙', desc:'틀린 낱말을 넣을 때마다 남은 시간이 ' + TICK_SEC + '초씩 줄어요.' }
    }
  };
  const RULE_TIP = { theme:'주제 판', blind:'뜻풀이 없는 낱말', gold:'황금 낱말 = +' + GOLD_SEC + '초', proverb:'속담 열쇠', flash:'시간이 짧아요', bare:'도구 없음', tight:'한 번 틀리면 끝', big:'큰 판', tick:'틀리면 −' + TICK_SEC + '초' };

  /* ----- 솔로 난이도 표 -----
     판 크기 = 챕터별(6 → 9), 낱말 수 = WORDS_OF[크기] + kOff[k], 제한 시간 = 낱말 × spw[c] × kTime[k] × 규칙·변주 배수 */
  const ST = {
    wordsOf:{ 6:7, 7:9, 8:12, 9:15 },
    kOff:[0, -1, 0, 0, 0, 1, -1, 0, 0, -1, 1],
    spw:[0, 24, 23, 22, 21, 20, 19],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, 0.92, 1.1, 1.0, 1.0, 1.1, 0.9],
    mjTime:{ theme:0.95, blind:1.15, gold:1.0, proverb:1.05 },
    twTime:{ flash:0.7, bare:1.1, tight:1.05, big:1.1, tick:1.05 }
  };
  function stageCfg(n){
    const p = planOf('crossword', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let size = c === 1 ? (k < 5 ? 6 : 7) : c === 2 ? 7 : c === 3 ? (k < 5 ? 7 : 8) : c === 4 ? 8 : c === 5 ? (k < 5 ? 8 : 9) : 9;
    if(p.boss) size = Math.min(9, size + 1);
    if(tw === 'big') size = Math.min(9, size + 1);
    let words = ST.wordsOf[size] + ST.kOff[k] + (tw === 'big' ? 1 : 0);
    if(tw === 'flash') words = Math.round(words * .85);
    words = Math.max(6, Math.min(size === 9 ? (has('theme') ? 15 : 16) : 99, words));
    const sc = Math.min(c, ST.spw.length - 1);
    let limit = words * ST.spw[sc] * ST.kTime[k];
    mj.forEach(x => { limit *= ST.mjTime[x] || 1; });
    if(tw) limit *= ST.twTime[tw] || 1;
    limit = Math.max(60, Math.round(limit / 5) * 5);
    /* 주제는 스테이지 번호로 정함(같은 스테이지 = 같은 주제) */
    const theme = has('theme') ? THEMES[(n * 7 + c) % THEMES.length] : null;
    return { size, words, limit, hints:tw === 'bare' ? 0 : p.boss ? 2 : 3, checks:tw === 'bare' ? 0 : 2, lives:tw === 'tight' ? 1 : 0,
      theme, blind:has('blind') ? (size >= 8 ? 3 : 2) : 0, gold:has('gold'), proverb:has('proverb'), tick:tw === 'tick' ? TICK_SEC : 0,
      boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 게임 진행 ===== */
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const cellEl = i => document.querySelector(`.ng-crossword .cw-c[data-i="${i}"]`);
  const dirName = d => d ? '세로' : '가로';
  const canPlay = () => { const m = G && G.m; return !!(m && !G.over && !G.paused && m.phase === 'play'); };

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C6 17 2.5 13.6 2.5 9.2 2.5 6.3 4.7 4 7.4 4c1.9 0 3.5 1 4.6 2.6C13.1 5 14.7 4 16.6 4c2.7 0 4.9 2.3 4.9 5.2 0 4.4-3.5 7.8-9.5 11.8z" fill="currentColor" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg>';
  const ICO = {
    word:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="7" height="7" rx="1.5" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><rect x="9" y="8" width="7" height="7" rx="1.5" fill="#DFF7E6" stroke="#1A0F45" stroke-width="1.8"/><rect x="9" y="1" width="7" height="7" rx="1.5" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><rect x="9" y="15" width="7" height="7" rx="1.5" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><rect x="16" y="8" width="6" height="7" rx="1.5" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#CFEFFF" stroke="#1A0F45" stroke-width="2"/><path d="M15 15l6 6" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/><path d="M7 10.2l2 2 3.6-3.8" fill="none" stroke="#E5484D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#cwFound'); if(f) f.textContent = m.solved;
    const h = $('#cwHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const x = $('#cwCheck'); if(x){ x.querySelector('b').textContent = m.checkLeft; x.disabled = m.checkLeft <= 0; }
    const lv = $('#cwLives');
    if(lv && !m.lives) lv.hidden = true;
    else if(lv){ const left = Math.max(0, m.lives - m.misses); lv.innerHTML = Array.from({ length:m.lives }, (_, n) => `<i class="cw-heart${n >= left ? ' off' : ''}">${HEART}</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); }
  }
  function msg(html, cls){ const e = $('#cwMsg'); if(!e) return; e.className = 'cw-msg ' + (cls || ''); e.innerHTML = html; }
  /* 잠깐 알림: ms 뒤 원래 문구로(앞 알림의 되돌리기 예약은 취소) */
  function flash(html, ms){
    const m = S(); msg(html, 'cw-pop');
    if(m.msgT){ clearTimeout(m.msgT); m.timers.delete(m.msgT); }
    m.msgT = T(() => { m.msgT = null; if(m.phase === 'play') msg(playMsg()); }, ms || 1500);
  }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.theme) return '<b class="theme">주제 · ' + dict().catName[m.theme] + '</b>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>칸을 눌러 낱말을 고르고 답을 넣어요</span>';
  }

  /* 열쇠 문구: 빈 열쇠·속담 열쇠·보통 */
  function clueText(wd){
    if(wd.blind) return '<i class="cw-blind">뜻풀이 없음 — 첫 글자와 엇갈린 글자로 맞혀요</i>';
    if(wd.useProv) return '<span class="cw-prov">속담</span> ' + esc(wd.prov);
    return esc(wd.clue);
  }
  function clueLine(){
    const m = S(), wd = m.words[m.cur], e = $('#cwClue'); if(!e || !wd) return;
    e.innerHTML = `<span class="cw-tg"><b class="cw-tag d${wd.d}">${dirName(wd.d)} ${wd.num}</b><small>${wd.len}글자${wd.gold ? ' ★' : ''}</small></span><span class="cw-ct">${wd.done ? '<em>' + wd.w + '</em> · ' + clueText(wd) : clueText(wd)}</span>`;
    const inp = $('#cwIn'); if(inp){ inp.placeholder = wd.done ? '맞힌 낱말이에요' : wd.len + '글자 낱말'; inp.disabled = wd.done || G.over; }
    const go = $('#cwGo'); if(go) go.disabled = wd.done || G.over;
  }
  function paintCells(){
    const m = S(), wd = m.words[m.cur], on = new Set(wd ? wd.cells : []);
    m.cell.forEach((c, i) => {
      if(!c) return; const el = cellEl(i); if(!el) return;
      el.classList.toggle('on', on.has(i));
      el.classList.toggle('lock', !!c.lock);
      el.classList.toggle('given', c.given === 'hint' || c.given === 'blind');
      el.classList.toggle('chk', c.given === 'check');
      el.querySelector('b').textContent = c.v || '';
    });
  }
  function listHtml(){
    const m = S();
    return [0, 1].map(d => `<div class="cw-lsec"><h4>${dirName(d)} 열쇠</h4>${m.words.map((wd, k) => wd.d !== d ? '' : `<button class="cw-li${wd.done ? ' done' : ''}${k === m.cur ? ' cur' : ''}${wd.gold ? ' gold' : ''}" data-k="${k}"><b>${wd.num}</b><span>${wd.done ? '<em>' + wd.w + '</em> · ' : ''}${clueText(wd)}</span><small>${wd.len}</small></button>`).join('')}</div>`).join('');
  }
  function refresh(){ paintCells(); clueLine(); const l = $('#cwList'); if(l) l.innerHTML = listHtml(); hud(); }

  function select(k, focus){
    const m = S(); if(!m || !m.words[k]) return;
    m.cur = k; refresh();
    if(focus){ const inp = $('#cwIn'); if(inp && !inp.disabled){ try{ inp.focus({ preventScroll:true }); }catch(_){ inp.focus(); } T(keepVisible, 350); } }
  }
  /* 칸 누르기: 그 칸을 지나는 낱말을 고른다. 이미 고른 낱말의 겹친 칸을 다시 누르면 다른 방향으로 */
  function tapCell(i){
    const m = S(); if(!m || G.over || !m.cell[i]) return;
    const [h, v] = m.at[i], cur = m.words[m.cur];
    let k;
    if(h >= 0 && v >= 0) k = cur && cur.cells.includes(i) ? (m.cur === h ? v : h) : (cur && cur.d === 1 ? v : h);
    else k = h >= 0 ? h : v;
    sfx('cwPick'); select(k, true);
  }
  function step(dir){
    const m = S(), n = m.words.length; if(!n) return;
    for(let s = 1; s <= n; s++){ const k = (m.cur + dir * s + n * 2) % n; if(!m.words[k].done){ select(k, false); return; } }
  }

  /* 낱말이 다 맞았는지 보고 맞힌 낱말을 잠근다(겹친 글자로 저절로 채워진 낱말도) */
  function lockSolved(typed){
    const m = S(), got = [];
    m.words.forEach((wd, k) => {
      if(wd.done) return;
      if(wd.cells.every(i => m.cell[i].v === m.cell[i].ch)){
        wd.done = true; m.solved++; got.push(k);
        wd.cells.forEach(i => { m.cell[i].lock = true; });
        if(wd.gold){ m.pen -= GOLD_SEC; m.bonus += GOLD_SEC; try{ const tp = $('#cwTimeP'); if(tp){ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '+' + GOLD_SEC + '초', 'good'); } }catch(_){} sfx('cwGold'); }
      }
    });
    if(got.length){
      m.combo += got.length;
      sfx('cwRight', { n:m.combo - 1 }); fxBuzz(12);
      try{
        got.forEach((k, j) => m.words[k].cells.forEach((i, n) => {
          const el = cellEl(i); if(!el) return;
          el.style.setProperty('--d', (n * 45 + j * 120) + 'ms'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
          const q = fxCenter(el); fxBurst(q.x, q.y, [m.words[k].gold ? '#FFD23F' : '#5BD08A', '#FFE27A', '#FFFFFF'], 6, { speed:180, size:4, kinds:['star','dot','spark'], up:90, g:460, dur:.55 });
        }));
        if(m.combo >= 3) fxCombo(m.combo);
      }catch(_){}
    }
    return got;
  }

  function submit(){
    const m = S(); if(!canPlay()) return;
    const wd = m.words[m.cur], inp = $('#cwIn'); if(!wd || wd.done || !inp) return;
    const t = (inp.value || '').normalize('NFC').replace(/[^가-힣]/g, '');
    if(!t){ flash('<span>답을 한글로 넣어요</span>'); try{ fxShake(inp, 3); }catch(_){} return; }
    if(t.length !== wd.len){ flash(`<b class="bad">${wd.len}글자</b><span>낱말이에요 (넣은 글자 ${t.length}개)</span>`); sfx('cwNo'); try{ fxShake(inp, 3); }catch(_){} return; }
    /* 이미 맞힌(잠긴) 칸과 다르면 벌칙 없이 알려 주기만 */
    for(let k = 0; k < wd.len; k++){ const c = m.cell[wd.cells[k]]; if(c.lock && c.ch !== t[k]){ flash(`<span>${k + 1}번째 칸은 이미 '<b class="lk">${c.ch}</b>'예요</span>`); sfx('cwNo'); try{ fxShake(cellEl(wd.cells[k]), 4); }catch(_){} return; } }
    wd.cells.forEach((i, k) => { const c = m.cell[i]; if(!c.lock){ c.v = t[k]; c.given = null; } });
    inp.value = '';
    if(t === wd.w){
      const got = lockSolved(true);
      m.typed++;
      refresh();
      flash(`<b>정답!</b><span>${wd.w}${got.length > 1 ? ' · 엇갈린 낱말 ' + (got.length - 1) + '개도' : ''}</span>`);
      if(m.solved >= m.words.length){ win(); return; }
      step(1);
      return;
    }
    /* 틀린 낱말 = 실수: 글자는 칸에 남는다(틀린 칸 확인으로 어느 글자가 틀렸는지 볼 수 있음) */
    m.misses++; m.combo = 0;
    const got = lockSolved(false);   /* 틀린 낱말이어도 엇갈린 다른 낱말이 맞게 채워졌을 수 있음 */
    refresh();
    sfx('cwWrong'); fxBuzz(25);
    try{ wd.cells.forEach(i => { const el = cellEl(i); if(el && !m.cell[i].lock){ el.classList.add('bad'); } }); fxShake($('#cwBoard'), 4); }catch(_){}
    T(() => document.querySelectorAll('.ng-crossword .cw-c.bad').forEach(e => e.classList.remove('bad')), 650);
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;
    flash(`<b class="bad">아니에요</b><span>${left === 0 ? '기회를 다 썼어요' : left > 0 ? '기회 ' + left + '번 남음' : '점수 −20'}${m.tick ? ' · −' + m.tick + '초' : ''}</span>`);
    if(m.tick){ m.pen += m.tick; try{ const tp = $('#cwTimeP'); if(tp){ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '−' + m.tick + '초', 'bad'); } }catch(_){} }
    try{ const hs = document.querySelectorAll('.ng-crossword .cw-heart'), lost = left >= 0 && hs[left]; if(lost) lost.classList.add('lost'); }catch(_){}
    if(got.length && m.solved >= m.words.length){ win(); return; }
    if(left === 0){ G.paws = 0; lose('기회를 다 썼어요', 'miss'); return; }
    if(left > 0) G.paws = left;
  }

  /* 글자 열기: 고른 낱말의 아직 맞지 않은 첫 칸을 열어 준다 */
  function useHint(){
    const m = S(); if(!canPlay() || m.hintLeft <= 0) return;
    let wd = m.words[m.cur]; if(!wd || wd.done){ step(1); wd = m.words[m.cur]; if(!wd || wd.done) return; }
    const i = wd.cells.find(j => !m.cell[j].lock && m.cell[j].v !== m.cell[j].ch) ?? wd.cells.find(j => !m.cell[j].lock);
    if(i == null) return;
    m.hintLeft--; m.hints++;
    const c = m.cell[i]; c.v = c.ch; c.lock = true; c.given = 'hint';
    sfx('cwHint');
    try{ const el = cellEl(i); if(el){ const q = fxCenter(el); fxEmit(q.x, q.y, { quantity:10, speed:{ min:40, max:120 }, lifespan:{ min:350, max:600 }, kind:'twinkle', tint:['#FFE27A', '#FFFFFF'], scale:{ start:3, end:.3 }, alpha:{ start:1, end:0 } }); } }catch(_){}
    const got = lockSolved(false);
    refresh();
    flash(`<span>'<b class="lk">${c.ch}</b>' 글자를 열었어요 · 점수 −40</span>`);
    if(m.solved >= m.words.length){ win(); return; }
    if(got.includes(m.cur)) step(1);
  }
  /* 틀린 칸 확인: 써 넣은(잠기지 않은) 글자 중 틀린 칸은 빨갛게 보여 주고 지우고, 맞는 칸은 파랗게 잠근다 */
  function useCheck(){
    const m = S(); if(!canPlay() || m.checkLeft <= 0) return;
    const open = m.cell.map((c, i) => c && c.v && !c.lock ? i : -1).filter(i => i >= 0);
    if(!open.length){ flash('<span>확인할 글자가 없어요 (넣은 글자만 확인해요)</span>'); return; }
    m.checkLeft--; m.checks++;
    const bad = open.filter(i => m.cell[i].v !== m.cell[i].ch);
    open.forEach(i => { const c = m.cell[i]; if(c.v === c.ch){ c.lock = true; c.given = 'check'; } });
    sfx('cwCheck');
    bad.forEach(i => { const el = cellEl(i); if(el) el.classList.add('bad', 'x'); });
    flash(bad.length ? `<b class="bad">틀린 칸 ${bad.length}개</b><span>지울게요</span>` : '<b>모두 맞는 글자예요</b>');
    const got = lockSolved(false);
    paintCells(); hud();
    T(() => {
      bad.forEach(i => { m.cell[i].v = null; const el = cellEl(i); if(el) el.classList.remove('bad', 'x'); });
      refresh();
      if(m.solved >= m.words.length){ win(); return; }
    }, 1000);
  }

  /* 휴대폰 화면 키보드가 올라오면 판이 가려지지 않게: 칸을 줄이고 판 위쪽이 보이게 */
  function keepVisible(){
    try{
      layout();
      const bd = $('#cwBoard'), vv = window.visualViewport; if(!bd || !vv) return;
      if(vv.height < (innerHeight || 800) * .82 && document.activeElement === $('#cwIn')){
        const r = bd.getBoundingClientRect();
        window.scrollBy(0, r.top - 6 - (vv.offsetTop || 0));
      }
    }catch(_){}
  }
  function layout(){
    const m = S(), bd = $('#cwBoard'), root = document.querySelector('.ng-crossword'); if(!bd || !root || !m) return;
    const W = Math.min(root.clientWidth || 360, 460), N = m.N, gap = 2, pad = 8;
    let cw = Math.floor((W - pad * 2 - gap * (N - 1)) / N);
    const vv = window.visualViewport;
    if(vv && document.activeElement === $('#cwIn') && vv.height < (innerHeight || 800) * .82){
      const ctl = ($('#cwCtl') ? $('#cwCtl').offsetHeight : 110) + 18;
      cw = Math.min(cw, Math.floor((vv.height - ctl - pad * 2 - gap * (N - 1)) / N));
    }
    cw = Math.max(24, Math.min(52, cw));
    bd.style.setProperty('--cw', cw + 'px'); bd.style.setProperty('--gap', gap + 'px'); bd.style.setProperty('--pad', pad + 'px');
    bd.style.gridTemplateColumns = `repeat(${N}, ${cw}px)`;
  }

  /* 시계 */
  const remTime = t => Math.max(0, G.limit - S().pen - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#cwBar');
    if(m.phase === 'deal'){ m.phase = 'play'; msg(playMsg()); sfx('cwGo'); }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#cwTime'); if(e) e.textContent = mmss(sec);
      const p = $('#cwTimeP'); if(p) p.classList.toggle('hurry', sec <= 15);
      const b = $('#cwBarWrap'); if(b) b.classList.toggle('hurry', sec <= 15);
      if(sec <= 10 && sec > 0) sfx('cwTick', { hi:sec <= 5 });
    }
    if(rem <= 0){ const e = $('#cwTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
  }
  function win(){
    const m = S(); if(m.phase === 'done') return; m.phase = 'done'; m.sec = elapsed();
    msg('<b>판을 모두 채웠어요!</b>', 'cw-win');
    const inp = $('#cwIn'); if(inp){ inp.disabled = true; inp.blur(); }
    sfx('win', { g:'crossword' }); fxBuzz([30, 50, 30]);
    try{ const bd = $('#cwBoard'); if(bd){ bd.classList.add('cleared'); const p = fxCenter(bd); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxBurst(p.x, p.y, ['#FFE27A', '#FF8FC8', '#7CCBFF', '#5BD08A'], 26, { speed:340, size:6, kinds:['star','dot','spark'], up:140, g:420, glow:true, dur:1 }); } }catch(_){}
    T(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.fail = why;
    const inp = $('#cwIn'); if(inp){ inp.disabled = true; inp.blur(); }
    msg('<b class="bad">' + text + '</b><span>맞힌 낱말 ' + m.solved + '/' + m.words.length + '</span>', 'cw-pop');
    sfx('cwTimeUp'); fxBuzz([40, 40, 60]); try{ fxShake($('#cwBoard'), 6); }catch(_){}
    /* 못 맞힌 낱말의 답을 흐리게 보여 준다 */
    m.cell.forEach((c, i) => { if(c && !c.lock){ const el = cellEl(i); if(el){ el.classList.add('miss'); el.querySelector('b').textContent = c.ch; } } });
    T(() => finish(false), 1700);
  }

  function boardHtml(){
    const m = S(), N = m.N, nums = {};
    m.words.forEach(wd => { nums[wd.cells[0]] = wd.num; });
    let h = '';
    for(let i = 0; i < N * N; i++){
      const c = m.cell[i];
      if(!c){ h += '<span class="cw-x" aria-hidden="true"></span>'; continue; }
      const gold = m.at[i].some(k => k >= 0 && m.words[k].gold);
      h += `<span class="cw-c${gold ? ' gold' : ''}" data-i="${i}" role="gridcell" aria-label="${Math.floor(i / N) + 1}행 ${i % N + 1}열">${nums[i] ? `<i>${nums[i]}</i>` : ''}<b></b></span>`;
    }
    return h;
  }
  function wire(){
    const m = S(), bd = $('#cwBoard');
    bd.onpointerdown = e => { const el = e.target.closest && e.target.closest('.cw-c'); if(!el) return; e.preventDefault(); tapCell(+el.dataset.i); };
    const inp = $('#cwIn');
    inp.onkeydown = e => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); submit(); } };
    inp.onfocus = () => T(keepVisible, 350);
    inp.onblur = () => T(layout, 200);
    $('#cwGo').onpointerdown = e => e.preventDefault();   /* 누를 때 입력창 포커스(키보드)가 내려가지 않게 */
    $('#cwGo').onclick = submit;
    $('#cwPrev').onclick = () => step(-1);
    $('#cwNext').onclick = () => step(1);
    $('#cwHint').onclick = useHint;
    $('#cwCheck').onclick = useCheck;
    $('#cwList').onclick = e => { const b = e.target.closest && e.target.closest('.cw-li'); if(!b) return; sfx('cwPick'); select(+b.dataset.k, true); };
    m.onResize = () => layout();
    addEventListener('resize', m.onResize);
    if(window.visualViewport){ m.onVV = () => layout(); visualViewport.addEventListener('resize', m.onVV); }
  }

  /* 썸네일 낱말판 */
  const ART_G = [['사', '과', '', '', ''], ['', '자', '두', '', ''], ['', '', '부', '채', ''], ['', '', '', '소', '']];
  return {
    name:'가로세로 낱말퀴즈', abil:'추리력', col:['#FFD3A8', '#F07F2E', '#9A4610'], time:'약 4분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9.5h5.5V4H14v5.5h5.5V15H14v5.5H8.5V15H3zM5 11.5v1.5h3.5v-1.5zm5.5-5.5v3.5H12V6zm0 5.5V13H12v-1.5zm3.5 0V13h3.5v-1.5zm-3.5 3.5v3.5H12V15z"/></svg>',
    art(){
      const u = 'cwA' + Math.floor(performance.now() * 1000 % 1e6);
      const cell = (x, y, ch, on) => `<g transform="translate(${x} ${y})"><rect width="20" height="20" rx="4" fill="${on ? '#FFE9A0' : '#FFFDF4'}" stroke="${OL}" stroke-width="2"/>${ch ? `<text x="10" y="15" font-size="13" font-weight="900" text-anchor="middle" fill="${OL}">${ch}</text>` : ''}</g>`;
      const cells = [[0, 0, '사'], [1, 0, '과'], [1, 1, '자'], [2, 1, '두'], [3, 1, '부'], [4, 1, ''], [3, 2, '채'], [3, 0, '두'], [1, 2, '']];
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1DC"/><stop offset="1" stop-color="#FFC994"/></linearGradient>
        <linearGradient id="${u}2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3AA8"/><stop offset="1" stop-color="#2A1E6E"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g fill="#fff" opacity=".5"><circle cx="12" cy="14" r="3"/><circle cx="150" cy="86" r="4"/><circle cx="146" cy="12" r="2.4"/></g>
        <rect x="24" y="12" width="122" height="78" rx="12" fill="url(#${u}2)" stroke="${OL}" stroke-width="3"/>
        ${cells.map(([cx, cy, ch]) => cell(32 + cx * 22, 20 + cy * 22, ch, cy === 1)).join('')}
        <g transform="translate(126 54) rotate(35)"><rect x="-4" y="-26" width="8" height="40" rx="2" fill="#FFC93C" stroke="${OL}" stroke-width="2"/><path d="M-4 14l4 9 4-9z" fill="#FFE4C4" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><rect x="-4" y="-30" width="8" height="6" rx="2" fill="#FF8FA8" stroke="${OL}" stroke-width="2"/></g>
        <circle cx="16" cy="70" r="7" fill="#FFE27A" stroke="${OL}" stroke-width="2"/><text x="16" y="74.5" font-size="11" font-weight="900" text-anchor="middle" fill="${OL}">?</text></svg>`;
    },
    help:[
      ['칸을 눌러 낱말을 골라요', '흰 칸을 누르면 그 칸을 지나는 낱말이 노랗게 빛나고 아래에 뜻풀이(열쇠)가 나와요. 가로·세로가 겹친 칸을 한 번 더 누르면 방향이 바뀌어요.'],
      ['답을 넣어요', '아래 입력창에 낱말을 쓰고 [넣기]를 누르면 한 글자씩 칸에 들어가요. 맞으면 초록으로 잠기고, 겹친 글자가 다른 낱말의 힌트가 돼요.'],
      ['틀리면 실수', '틀린 낱말을 넣으면 실수(점수 −20)예요. 글자는 칸에 남으니 🔍 틀린 칸으로 어느 글자가 틀렸는지 볼 수 있어요. 💡 글자 열기는 한 글자를 알려 줘요(점수 −40).'],
      ['시간 안에 판을 채워요', '제한 시간 안에 모든 낱말을 맞히면 성공! 열쇠 목록은 판 아래에 있어요. 솔로에서는 주제 판·빈 열쇠·황금 낱말·속담 열쇠 같은 새 규칙이 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'crossword' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['골목 사전', '시장 골목', '바닷가 책방', '산마루 서당', '별빛 도서관'],
    starRule:'★ 클리어 · ★★ 도구 1번 이하·실수 2번 이하 · ★★★ 도구·실수 없이',
    levels:{
      easy:{ size:7, words:9, limit:240, hints:3, checks:2 },
      normal:{ size:8, words:12, limit:300, hints:3, checks:2 },
      hard:{ size:9, words:15, limit:360, hints:3, checks:2 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.size}×${c.size} · 낱말 ${c.words}개 · ${mmss(c.limit)}${c.lives === 1 ? ' · 기회 1번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.size}×${c.size} · 낱말 ${c.words}개`; },
    init(cfg, rng){
      const L = layoutWords(cfg, rng), N = L.N;
      const cell = L.g.map(ch => ch == null ? null : { ch, v:null, lock:false, given:null });
      L.words.forEach(wd => { if(wd.blind){ const c = cell[wd.cells[0]]; c.v = c.ch; c.lock = true; c.given = 'blind'; } });
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      if(cfg.theme && tips.length) tips[tips.indexOf(RULE_TIP.theme)] = '주제 · ' + dict().catName[cfg.theme];
      G.m = { N, words:L.words, at:L.at, cell, cur:0, solved:0, typed:0, combo:0, misses:0, hints:0, checks:0, pen:0, bonus:0,
        hintLeft:cfg.hints == null ? 3 : cfg.hints, checkLeft:cfg.checks == null ? 2 : cfg.checks, lives:G.duel ? 0 : cfg.lives || 0, tick:cfg.tick || 0,
        theme:cfg.theme || null, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, phase:'deal', lastSec:-1, sec:0, fail:null, timers:new Set() };
      G.limit = cfg.limit; if(G.m.lives) G.paws = G.m.lives;
      const m = G.m;
      /* 처음 고른 낱말: 가로 1번(빈 열쇠가 아닌 것 먼저) */
      const k0 = m.words.findIndex(wd => !wd.blind); m.cur = k0 >= 0 ? k0 : 0;
      lockSolved(false); m.combo = 0;   /* (빈 열쇠 첫 글자만으로 풀리는 낱말은 없지만 혹시 모르니) */
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(m.onVV && window.visualViewport) visualViewport.removeEventListener('resize', m.onVV);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트·도구용: 낱말을 차례로 모두 넣는다 */
      m._solveForTest = () => new Promise(res => {
        const go = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.solved); return; }
          if(!canPlay()){ setTimeout(go, 80); return; }
          const k = m.words.findIndex(wd => !wd.done); if(k < 0){ res(m.solved); return; }
          select(k, false); const inp = $('#cwIn'); inp.value = m.words[k].w; submit(); setTimeout(go, 90);
        };
        go();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _layout:layoutWords, _stage:stageCfg, _dict:dict,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-crossword">
        <div class="cw-hud">
          <div class="cw-pill" aria-label="맞힌 낱말"><span class="cw-ic">${ICO.word}</span><b id="cwFound">0</b><small>/${m.words.length}</small></div>
          <div class="cw-pill cw-time" id="cwTimeP" aria-label="남은 시간"><span class="cw-ic">${ICO.clock}</span><b id="cwTime">${mmss(G.limit)}</b></div>
          <button class="cw-pill cw-btn" id="cwHint" aria-label="글자 열기"><span class="cw-ic">${ICO.hint}</span><b>${m.hintLeft}</b></button>
          <button class="cw-pill cw-btn" id="cwCheck" aria-label="틀린 칸 확인"><span class="cw-ic">${ICO.check}</span><b>${m.checkLeft}</b></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="cw-rules" aria-label="켜진 규칙">${m.boss ? '<span class="cw-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="cw-chip mj">${k === 'theme' && m.theme ? '주제 · ' + dict().catName[m.theme] : CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="cw-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="cw-barw" id="cwBarWrap"><i id="cwBar"></i></div>
        <div class="cw-row"><div class="cw-lives" id="cwLives" role="img"></div><div class="cw-msg" id="cwMsg"><span>낱말판을 펼치는 중…</span></div></div>
        <div class="cw-board in" id="cwBoard" role="grid" aria-label="낱말판">${boardHtml()}</div>
        <div class="cw-ctl" id="cwCtl">
          <div class="cw-clue"><button class="cw-arr" id="cwPrev" aria-label="이전 열쇠">${ICO.prev}</button><div class="cw-cl" id="cwClue" aria-live="polite"></div><button class="cw-arr" id="cwNext" aria-label="다음 열쇠">${ICO.next}</button></div>
          <div class="cw-in"><input id="cwIn" type="text" lang="ko" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" maxlength="12" aria-label="답 넣기"><button id="cwGo" class="cw-go">넣기</button></div>
        </div>
        <div class="cw-list" id="cwList"></div>
      </div>`;
      layout(); wire(); refresh();
      T(() => { const b = $('#cwBoard'); if(b) b.classList.remove('in'); }, 900);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.words ? m.solved / m.words.length : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `낱말 ${m.solved}/${m.words.length}개를 맞혔어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit, (m.sec || elapsed()) + (m.pen || 0)));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - 40 * m.hints - 25 * m.checks - 20 * m.misses);
      return { base:500, time, extra, rows:['낱말판 모두 채우기', '시간 보너스 (' + mmss(sec) + ')', `글자 열기 ${m.hints} · 확인 ${m.checks} · 실수 ${m.misses}`] };
    },
    stars(){ const m = G.m, help = m.hints + m.checks; return help === 0 && m.misses === 0 ? 3 : help <= 1 && m.misses <= 2 ? 2 : 1; },
    css:`
body[data-mode="crossword"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.65), rgba(255,255,255,0) 70%),
  linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px) 0 0/100% 26px,
  linear-gradient(180deg,#FFF5E4 0%,#FFE2C2 55%,#FFC99A 100%) fixed}
.ng-crossword{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none; padding-bottom:20px}
.ng-crossword .cw-hud{display:flex; gap:7px; width:100%; justify-content:space-between}
.ng-crossword .cw-pill{flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; height:44px; padding:0 8px; border-radius:999px; font:inherit;
  background:linear-gradient(180deg,#FFFFFF,#FFF4E6); border:2.5px solid #1A0F45; box-shadow:inset 0 -3px 0 rgba(160,90,20,.14), 0 3px 0 #1A0F45; color:#5A2E0A; white-space:nowrap}
.ng-crossword .cw-pill b{font-family:var(--heavy); font-size:20px; font-weight:400; line-height:1; font-variant-numeric:tabular-nums}
.ng-crossword .cw-pill small{font-family:var(--disp); font-size:14px; color:#9A6A3E}
.ng-crossword .cw-ic{width:22px; height:22px; flex:none; display:block}
.ng-crossword .cw-ic svg{width:100%; height:100%; display:block}
.ng-crossword .cw-time{flex:1.3 1 0}
.ng-crossword .cw-time b{font-size:23px}
.ng-crossword .cw-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-crossword .cw-time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-crossword .cw-btn{flex:.8 1 0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:linear-gradient(180deg,#FFF6C8,#FFE07A)}
.ng-crossword .cw-btn:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(160,90,20,.14), 0 1px 0 #1A0F45}
.ng-crossword .cw-btn:disabled{opacity:.45; background:#EDEDED; cursor:default}
.ng-crossword .cw-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-crossword .cw-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#FFD38A,#F07F2E); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-crossword .cw-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-crossword .cw-row{display:flex; align-items:center; gap:8px; width:100%; height:36px}
.ng-crossword .cw-lives{display:flex; gap:2px; flex:none; padding:4px 7px; border-radius:99px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45}
.ng-crossword .cw-lives[hidden]{display:none}
.ng-crossword .cw-heart{display:block; width:19px; height:19px; color:#FF4D6D}
.ng-crossword .cw-heart svg{width:100%; height:100%; display:block}
.ng-crossword .cw-heart.off{color:#DCD6E6}
.ng-crossword .cw-heart.lost{animation:cw-lost .5s ease-out}
@keyframes cw-lost{0%{transform:scale(1.5); color:#FF4D6D} 100%{transform:none}}
.ng-crossword .cw-msg{flex:1; min-width:0; overflow:hidden; height:36px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#7A3F10; white-space:nowrap}
.ng-crossword .cw-msg span{overflow:hidden; text-overflow:ellipsis}
.ng-crossword .cw-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px; flex:none}
.ng-crossword .cw-msg b.boss{color:#FFE27A}
.ng-crossword .cw-msg b.theme{color:#FFD38A}
.ng-crossword .cw-msg b.bad{color:#FF8A8F}
.ng-crossword .cw-msg b.lk{font-size:17px; -webkit-text-stroke:4px #1A0F45; color:#9EF0B8}
.ng-crossword .cw-msg.cw-pop, .ng-crossword .cw-msg.cw-win{animation:cw-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-crossword .cw-msg.cw-win b{font-size:24px; color:#FFE27A}
@keyframes cw-in{from{transform:scale(.6); opacity:0}}
.ng-crossword .cw-board{position:relative; display:grid; width:max-content; gap:var(--gap); padding:var(--pad); border-radius:18px; justify-content:center;
  background:linear-gradient(180deg,#4A3AA8 0%,#2A1E6E 100%); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.18), 0 5px 0 #1A0F45, 0 14px 22px rgba(90,40,10,.22); touch-action:manipulation}
.ng-crossword .cw-x{width:var(--cw); height:var(--cw); border-radius:calc(var(--cw) * .16); background:rgba(255,255,255,.06)}
.ng-crossword .cw-c{position:relative; width:var(--cw); height:var(--cw); border-radius:calc(var(--cw) * .16); cursor:pointer; -webkit-tap-highlight-color:transparent;
  background:linear-gradient(180deg,#FFFFFB 0%,#FFF3DE 100%); box-shadow:inset 0 -2px 0 rgba(160,90,20,.16), 0 2px 0 #1A0F45; display:grid; place-items:center; transition:background .12s, transform .12s}
.ng-crossword .cw-c i{position:absolute; left:2px; top:0; font-style:normal; font-family:var(--disp); font-size:calc(var(--cw) * .28); line-height:1.1; color:#8A5A2E}
.ng-crossword .cw-c b{font-family:var(--heavy); font-weight:400; font-size:calc(var(--cw) * .56); line-height:1; color:#1A0F45; padding-top:calc(var(--cw) * .06)}
.ng-crossword .cw-c.gold{box-shadow:inset 0 0 0 2.5px #F2B705, inset 0 -2px 0 rgba(160,90,20,.16), 0 2px 0 #1A0F45}
.ng-crossword .cw-c.on{background:linear-gradient(180deg,#FFF6C0,#FFE07A); transform:translateY(-1px)}
.ng-crossword .cw-c.lock{background:linear-gradient(180deg,#E9FBEF,#C9F0D6)}
.ng-crossword .cw-c.lock b{color:#13703F}
.ng-crossword .cw-c.lock.on{background:linear-gradient(180deg,#E6FFD2,#BFF0A8)}
.ng-crossword .cw-c.given b{color:#6A4BD8}
.ng-crossword .cw-c.chk b{color:#1F6FC9}
.ng-crossword .cw-c.bad{background:linear-gradient(180deg,#FFE8E8,#FFC6C8)}
.ng-crossword .cw-c.bad b{color:#C8102E}
.ng-crossword .cw-c.x::after{content:''; position:absolute; inset:18%; border-radius:50%; border:2.5px solid #E5484D; opacity:.8}
.ng-crossword .cw-c.miss b{color:#B9A6D9}
.ng-crossword .cw-c.pop{animation:cw-pop .5s cubic-bezier(.2,1.6,.4,1) var(--d, 0ms) both}
@keyframes cw-pop{0%{transform:scale(1)} 40%{transform:scale(1.22) rotate(-4deg)} 100%{transform:none}}
.ng-crossword .cw-board.in .cw-c{animation:cw-deal .45s cubic-bezier(.2,1.5,.4,1) both}
.ng-crossword .cw-board.in .cw-c:nth-child(3n){animation-delay:.06s}
.ng-crossword .cw-board.in .cw-c:nth-child(3n+1){animation-delay:.12s}
@keyframes cw-deal{from{transform:scale(.4); opacity:0}}
.ng-crossword .cw-board.cleared{animation:cw-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes cw-cheer{40%{transform:scale(1.04)}}
.ng-crossword .cw-ctl{width:100%; margin-top:12px; display:flex; flex-direction:column; gap:8px}
.ng-crossword .cw-clue{display:flex; align-items:stretch; gap:6px; width:100%}
.ng-crossword .cw-arr{flex:none; width:38px; border-radius:14px; border:2.5px solid #1A0F45; background:#fff; color:#1A0F45; box-shadow:0 3px 0 #1A0F45; padding:0; display:grid; place-items:center; cursor:pointer; -webkit-tap-highlight-color:transparent}
.ng-crossword .cw-arr svg{width:20px; height:20px}
.ng-crossword .cw-arr:active{transform:translateY(2px); box-shadow:0 1px 0 #1A0F45}
.ng-crossword .cw-cl{flex:1; min-width:0; min-height:62px; display:flex; align-items:center; gap:9px; padding:6px 10px 6px 7px; border-radius:14px; background:#FFFDF6; border:2.5px solid #1A0F45; box-shadow:0 3px 0 #1A0F45; font-size:15px; line-height:1.35; color:#2A1A10; user-select:text}
.ng-crossword .cw-tag{flex:none; font-family:var(--heavy); font-weight:400; font-size:14px; padding:2px 8px; border-radius:99px; color:#fff; background:#F07F2E; border:2px solid #1A0F45}
.ng-crossword .cw-tag.d1{background:#6A4BD8}
.ng-crossword .cw-tg{flex:none; display:flex; flex-direction:column; align-items:center; gap:3px}
.ng-crossword .cw-ct{flex:1; min-width:0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden}
.ng-crossword .cw-ct em{font-style:normal; font-weight:800; color:#13703F}
.ng-crossword .cw-cl small{font-family:var(--disp); font-size:12.5px; line-height:1; color:#9A6A3E; white-space:nowrap}
.ng-crossword .cw-blind{font-style:normal; color:#6A4BD8}
.ng-crossword .cw-prov{display:inline-block; font-family:var(--disp); font-size:12px; padding:1px 6px; border-radius:99px; background:#EFE7FF; color:#5B3FB5; border:1.5px solid #5B3FB5; vertical-align:1px}
.ng-crossword .cw-in{display:flex; gap:8px; width:100%}
.ng-crossword .cw-in input{flex:1; min-width:0; height:50px; padding:0 14px; border-radius:16px; border:2.5px solid #1A0F45; background:#fff; box-shadow:inset 0 3px 0 rgba(26,15,69,.08); font:inherit; font-size:20px; font-weight:800; color:#1A0F45; letter-spacing:2px; outline:none; user-select:text; -webkit-user-select:text}
.ng-crossword .cw-in input:focus{border-color:#F07F2E; box-shadow:0 0 0 3px rgba(240,127,46,.3)}
.ng-crossword .cw-in input::placeholder{color:#B8A48E; font-weight:600; letter-spacing:0; font-size:16px}
.ng-crossword .cw-in input:disabled{background:#F2EEE8}
.ng-crossword .cw-go{flex:none; width:92px; height:50px; border-radius:16px; border:2.5px solid #1A0F45; font-family:var(--heavy); font-size:20px; color:#fff; cursor:pointer; -webkit-tap-highlight-color:transparent;
  background:linear-gradient(180deg,#FFB067,#F07F2E); box-shadow:inset 0 -4px 0 rgba(120,50,0,.25), 0 4px 0 #1A0F45; text-shadow:0 2px 0 #9A4610}
.ng-crossword .cw-go:active{transform:translateY(3px); box-shadow:inset 0 -4px 0 rgba(120,50,0,.25), 0 1px 0 #1A0F45}
.ng-crossword .cw-go:disabled{opacity:.5; cursor:default}
.ng-crossword .cw-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-crossword .cw-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#5A2E0A; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-crossword .cw-chip.mj{background:#FFF0DC; color:#9A4610}
.ng-crossword .cw-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-crossword .cw-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-crossword .cw-list{width:100%; margin-top:14px; display:flex; flex-direction:column; gap:10px}
.ng-crossword .cw-lsec{background:rgba(255,255,255,.72); border:2px solid #1A0F45; border-radius:16px; padding:8px 8px 6px; box-shadow:0 3px 0 rgba(26,15,69,.6)}
.ng-crossword .cw-lsec h4{margin:0 0 4px 4px; font-family:var(--heavy); font-weight:400; font-size:16px; color:#7A3F10}
.ng-crossword .cw-li{display:flex; align-items:baseline; gap:8px; width:100%; text-align:left; padding:7px 6px; border:0; border-top:1px dashed rgba(26,15,69,.15); background:none; font:inherit; font-size:14.5px; line-height:1.35; color:#2A1A10; cursor:pointer; -webkit-tap-highlight-color:transparent}
.ng-crossword .cw-li:first-of-type{border-top:0}
.ng-crossword .cw-li b{flex:none; min-width:22px; font-family:var(--heavy); font-weight:400; color:#F07F2E}
.ng-crossword .cw-lsec:last-child .cw-li b{color:#6A4BD8}
.ng-crossword .cw-li span{flex:1; min-width:0}
.ng-crossword .cw-li small{flex:none; color:#9A6A3E; font-size:12px}
.ng-crossword .cw-li.cur{background:#FFF1B8; border-radius:10px}
.ng-crossword .cw-li.done{color:#7FA58E}
.ng-crossword .cw-li.done em{font-style:normal; font-weight:800; color:#13703F}
.ng-crossword .cw-li.gold b::after{content:'★'; color:#F2B705; margin-left:1px}
@media (max-width:370px){ .ng-crossword .cw-pill b{font-size:18px} .ng-crossword .cw-time b{font-size:20px} .ng-crossword .cw-hud{gap:5px} .ng-crossword .cw-pill{padding:0 5px} .ng-crossword .cw-msg b{font-size:18px} .ng-crossword .cw-go{width:78px} }
@media (prefers-reduced-motion: reduce){ .ng-crossword .cw-board.in .cw-c, .ng-crossword .cw-c.pop{animation:none} }
`,
    sounds:{
      cwPick(){ aNoise({ ft:'bandpass', f:2600, q:2, d:.035, v:.05 }); aTone({ f:820, f2:980, type:'triangle', d:.06, v:.045 }); },
      cwRight(o){ const n = Math.min(10, o.n || 0); aBell({ f:penta(n + 4, 72), t:.02, d:.6, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.1, d:.7, v:.07, idx:1.2, rev:.4 }); aBell({ f:penta(n + 8, 72), t:.18, d:.8, v:.06, idx:1.2, rev:.45 }); },
      cwWrong(){ aTone({ f:330, f2:220, type:'triangle', d:.2, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      cwNo(){ aTone({ f:440, f2:380, type:'triangle', d:.09, v:.05 }); },
      cwHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      cwCheck(){ aWhoosh({ f:700, f2:2600, q:1.2, a:.03, d:.25, v:.05 }); aTone({ f:1046, type:'triangle', t:.18, d:.12, v:.05 }); },
      cwGold(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(76 + d), { t:i * .06, v:.12 })); },
      cwGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      cwTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      cwTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ cwPick:40, cwTick:250, cwRight:60, cwNo:120 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 같은 판을 누가 먼저(더 많이) 맞히나. AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.crossword, {
  duelPace:[230, .7],
  duelHow:'같은 낱말판 · 빨리 많이 맞혀 점수가 높으면 승리',
  duelStat:{ unit:'낱말', get:() => ({ v:G.m.solved, t:G.m.words.length }) }
});
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.crossword.scene = { kind:'motes', colors:['#FFFFFF', '#FFE2B8', '#FFF3B0'], density:1 };
