/* 스도쿠: 화면·조작·솔로 변형 엔진 */
/* 스도쿠 화면 그리기(renderStage가 부름) */
function sudStage(st){
  const L = G.L;
  const ico = {
    undo:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5L4 9.5l5 5"/><path d="M4 9.5h10a5.5 5.5 0 0 1 0 11h-3"/></svg>',
    erase:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.8l5.7 5.7-9.8 9.8H6.3l-3-3z" fill="rgba(255,255,255,.25)"/><path d="M8.6 9.7l5.7 5.7"/><path d="M13 20.3h7.5"/></svg>',
    memo:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3" width="13" height="17.5" rx="2.5" fill="rgba(255,255,255,.25)"/><path d="M7 8h6M7 12h4"/><path d="M20.5 9.5l-7.2 7.2-.8 3.1 3.1-.8 7.2-7.2z" fill="#fff"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6a6.6 6.6 0 0 0-3.9 11.9c.7.5 1.1 1.3 1.1 2.1v1h5.6v-1c0-.8.4-1.6 1.1-2.1A6.6 6.6 0 0 0 12 2.6z" fill="#FFF7D6" stroke="#4A2A00" stroke-width="2" stroke-linejoin="round"/><path d="M9.4 19.6h5.2v.6a1.9 1.9 0 0 1-1.9 1.9h-1.4a1.9 1.9 0 0 1-1.9-1.9z" fill="#4A2A00"/><path d="M9.9 8.4a2.8 2.8 0 0 1 2.1-1.5" stroke="#FFB020" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.6" fill="#fff"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" fill="#fff"/></svg>'
  };
  st.innerHTML = `<div class="shead">
      <span class="sch"><small>실수</small><span class="smis" id="smis" role="img" aria-label="실수 0번, ${G.missCap || 3}번까지">${'<i></i>'.repeat(G.missCap || 3)}</span></span>
      <span class="sch"><small>점수</small><b id="sscore">0</b></span>
      <span class="sch"><small>시간</small><b id="sclock">00:00</b></span>
      <button id="spause" aria-label="일시정지">${ico.pause}</button>
    </div>${sudSxChips()}
    <div class="swrap"><div class="board s9" id="bd" role="grid" aria-label="스도쿠 판"></div>
      <div class="pcover" id="pcover"><span class="pc-ico">${ico.pause}</span><b>잠깐 쉬는 중</b><button class="b1" id="presume">계속하기</button><button class="psnd" id="pSnd" style="width:auto;padding:0 18px"></button></div></div>
    <div class="tools">
      <button id="tUndo" aria-label="실행 취소"><span class="tc">${ico.undo}</span>실행 취소</button>
      <button id="tErase" aria-label="지우기"><span class="tc">${ico.erase}</span>지우기</button>
      <button id="tMemo" aria-label="메모 끄기 상태"><span class="tc">${ico.memo}<i class="tb off" id="memoBadge">OFF</i></span>메모</button>
      <button id="tHint" aria-label="힌트 3번 남음"><span class="tc">${ico.hint}<i class="tb" id="hintBadge">3</i></span>힌트</button>
    </div>
    <div class="pad9" id="pad"></div>`;
  const bd = $('#bd');
  for(let i=0;i<81;i++){
    const r = Math.floor(i/9), c = i%9;
    const el = document.createElement('div'); el.className = 'cell'; el.dataset.i = i;
    const edge = '2px solid #2A1650', thin = '1px solid #D9CCF0';
    el.style.borderTop = r===0 ? '0' : (r%3===0 ? edge : thin);
    el.style.borderLeft = c===0 ? '0' : (c%3===0 ? edge : thin);
    el.onclick = () => { if(G.over || G.paused) return; G.sel = i; paintSud(); sfx('sSel'); };
    bd.appendChild(el);
  }
  sudSxOverlay(bd);
  /* 효과 클래스는 애니메이션이 끝나면 스스로 지움(다시 그려도 끊기지 않게 paintSud가 보존) */
  const FXEND = { sok:'pop', swave:'wave', swin:'winw', sbad:'flash' };
  bd.addEventListener('animationend', e => { const c = FXEND[e.animationName]; if(c && e.target.classList) e.target.classList.remove(c); });
  const pad = $('#pad');
  for(let v=1;v<=9;v++){ const b = document.createElement('button'); b.textContent = v; b.dataset.v = v; b.onclick = () => { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); sudInput(v); }; pad.appendChild(b); }
  $('#tUndo').onclick = sudUndo; $('#tErase').onclick = sudErase; $('#tHint').onclick = sudHint;
  $('#tMemo').onclick = () => { if(G.noMemo){ toast('이 판은 메모 없이 풀어요', 'err'); return; } G.memo = !G.memo; paintSud(); sfx('toggle', { on:G.memo }); };
  $('#spause').onclick = () => togglePause(true); $('#presume').onclick = () => togglePause(false);
  const ps = () => { $('#pSnd').innerHTML = (SND.on ? FL_I.snd : FL_I.mute) + (SND.on ? '소리 켜짐' : '소리 꺼짐'); };
  ps(); $('#pSnd').onclick = () => { sndSetOn(!SND.on); ps(); if(SND.on) sfx('toggle', { on:true }); };
  paintSud();
}

/* ===================== 스도쿠 솔로: 개념 사이클(대각선·짝수 칸·창문·부등호) · 기술 판정 생성기 ===================== */
/* SX-CORE-BEGIN */
/* 스도쿠 솔로 변형 엔진: 추가 구역(대각선·창문) + 짝수 칸 + 부등호를 모두 다루는 생성기·판정기.
   판정기(rate)는 사람이 쓰는 기술만 순서대로 써서 푼다(찍기 없음). 끝까지 풀리면 답이 하나뿐이라는 뜻.
   기술 단계: 1 네이키드 싱글 · 2 히든 싱글 · 3 잠긴 후보(포인팅/클레이밍) · 4 페어(네이키드/히든) · 5 트리플·X-윙 */
function SX_MAKE(shuffle){
  const PC = new Uint8Array(1024); for(let m = 1; m < 1024; m++) PC[m] = PC[m & (m - 1)] + 1;
  const ALL = 0x3FE, EV = (1 << 2) | (1 << 4) | (1 << 6) | (1 << 8);
  const lo = m => 31 - Math.clz32(m & -m), hi = m => 31 - Math.clz32(m);
  const seq = (n, f) => { const a = []; for(let k = 0; k < n; k++) a.push(f(k)); return a; };
  const sq3 = (r0, c0) => seq(9, k => (r0 + ((k / 3) | 0)) * 9 + c0 + k % 3);
  const BASE = [];
  for(let r = 0; r < 9; r++) BASE.push(seq(9, c => r * 9 + c));
  for(let c = 0; c < 9; c++) BASE.push(seq(9, r => r * 9 + c));
  for(let b = 0; b < 9; b++) BASE.push(sq3(((b / 3) | 0) * 3, (b % 3) * 3));
  const EXTRA = {
    diag:[seq(9, k => k * 10), seq(9, k => k * 9 + 8 - k)],
    window:[[1, 1], [1, 5], [5, 1], [5, 5]].map(([r, c]) => sq3(r, c))
  };
  function model(rules, even, ineq){
    const units = BASE.slice(); (rules || []).forEach(k => { if(EXTRA[k]) units.push(...EXTRA[k]); });
    const cu = seq(81, () => []); units.forEach((u, x) => u.forEach(i => cu[i].push(x)));
    const peers = seq(81, i => { const s = new Set(); cu[i].forEach(x => units[x].forEach(j => { if(j !== i) s.add(j); })); return [...s]; });
    /* 두 구역이 2칸 이상 겹치면 잠긴 후보 검사용으로 기억: [y, x 안에서 겹친 자리 비트, y에서 겹치지 않은 칸] */
    const inter = units.map((u, x) => { const r = []; units.forEach((v, y) => { if(y === x) return; let mk = 0, k2 = 0; u.forEach((i, k) => { if(v.includes(i)){ mk |= 1 << k; k2++; } }); if(k2 >= 2) r.push([y, mk, v.filter(j => !u.includes(j))]); }); return r; });
    return { rules:rules || [], units, cu, peers, inter, even:even || null, ineq:ineq || [] };
  }
  /* 규칙을 모두 만족하는 완성 판(무작위) */
  function fill(M, rng){
    const g = new Array(81).fill(0); let nodes = 0;
    const bt = () => {
      if(++nodes > 600) return false;
      let best = -1, bm = 0, bn = 10;
      for(let i = 0; i < 81; i++){ if(g[i]) continue; let m = ALL; for(const j of M.peers[i]) if(g[j]) m &= ~(1 << g[j]); const n = PC[m]; if(n < bn){ best = i; bm = m; bn = n; if(n <= 1) break; } }
      if(best < 0) return true; if(!bn) return false;
      for(const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) if(bm & (1 << d)){ g[best] = d; if(bt()) return true; g[best] = 0; if(nodes > 600) return false; }
      return false;
    };
    while(!bt()){ g.fill(0); nodes = 0; }
    return g;
  }
  /* 기술 판정: cap 단계까지만 써서 풀어 본다. { ok, max, n:[단계별 사용 횟수] }
     pm[x*10+d] = 구역 x 안에서 숫자 d가 들어갈 수 있는 자리(9비트), pl[x] = 구역 x에 이미 놓인 숫자 */
  const RG = new Int8Array(81), RC = new Int16Array(81), RPM = new Int16Array(400), RPL = new Int16Array(40);
  function rate(puz, M, cap){
    cap = cap || 5;
    const g = RG, c = RC, n = [0, 0, 0, 0, 0, 0], U = M.units, NU = U.length, P = M.peers, IQ = M.ineq, IN = M.inter, pm = RPM, pl = RPL;
    for(let i = 0; i < 81; i++) g[i] = puz[i];
    let left = 0, max = 0, bad = false;
    for(let i = 0; i < 81; i++){ c[i] = g[i] ? 1 << g[i] : M.even && M.even[i] ? EV : ALL; if(!g[i]) left++; }
    for(let i = 0; i < 81; i++) if(g[i]){ const b = ~(1 << g[i]); for(const j of P[i]) if(!g[j]){ c[j] &= b; if(!c[j]) bad = true; } }
    const place = (i, v) => { g[i] = v; c[i] = 1 << v; left--; const b = ~(1 << v); for(const j of P[i]) if(!g[j]){ c[j] &= b; if(!c[j]) bad = true; } };
    const elim = (i, m) => { if(g[i] || !(c[i] & m)) return false; c[i] &= ~m; if(!c[i]) bad = true; return true; };
    const use = t => { n[t]++; if(t > max) max = t; };
    const bounds = () => { let ch = true; while(ch && !bad){ ch = false; for(const [a, b] of IQ){ if(!c[a] || !c[b]){ bad = true; return; }
      const na = c[a] & ~((2 << lo(c[b])) - 1), nb = c[b] & ((1 << hi(c[a])) - 1);
      if(na !== c[a] || nb !== c[b]){ c[a] = na; c[b] = nb; ch = true; if(!na || !nb) bad = true; } } } };
    const build = () => { pm.fill(0, 0, NU * 10); pl.fill(0, 0, NU);
      for(let x = 0; x < NU; x++){ const u = U[x], o = x * 10; for(let k = 0; k < 9; k++){ const i = u[k]; if(g[i]){ pl[x] |= 1 << g[i]; continue; } let m = c[i]; while(m){ const b = m & -m; pm[o + 31 - Math.clz32(b)] |= 1 << k; m ^= b; } } } };
    while(left > 0 && !bad){
      if(IQ.length){ bounds(); if(bad) break; }
      let hit = false;
      /* 1 네이키드 싱글 */
      for(let i = 0; i < 81; i++) if(!g[i] && !(c[i] & (c[i] - 1))){ if(!c[i]){ bad = true; break; } place(i, lo(c[i])); hit = true; }
      if(bad) break; if(hit){ use(1); continue; }
      if(cap < 2) break;
      /* 2 히든 싱글: once/twice 비트 트릭으로 빠르게 */
      for(let x = 0; x < NU && !bad; x++){ const u = U[x]; let once = 0, twice = 0, placed = 0;
        for(let k = 0; k < 9; k++){ const i = u[k]; if(g[i]){ placed |= c[i]; continue; } twice |= once & c[i]; once |= c[i]; }
        if((once | placed) !== ALL){ bad = true; break; }
        let hs = once & ~twice & ~placed;
        while(hs){ const b = hs & -hs; hs ^= b; for(let k = 0; k < 9; k++){ const i = u[k]; if(!g[i] && (c[i] & b)){ place(i, lo(b)); hit = true; break; } } }
      }
      if(bad) break; if(hit){ use(2); continue; }
      if(cap < 3) break;
      build();
      /* 3 잠긴 후보: 구역 x에서 d가 다른 구역 y와 겹친 칸에만 있으면 y의 나머지에서 d 제거 */
      for(let x = 0; x < NU; x++){ const o = x * 10; for(let d = 1; d <= 9; d++){ const m = pm[o + d]; if(!(m & (m - 1))) continue;
        for(const [y, mk, rest] of IN[x]) if(!(m & ~mk)) for(const j of rest) if(elim(j, 1 << d)) hit = true; } }
      if(bad) break; if(hit){ use(3); continue; }
      if(cap < 4) break;
      /* 4 페어(네이키드: 두 칸이 같은 후보 2개 · 히든: 두 숫자가 같은 두 칸에만) */
      for(let x = 0; x < NU && !hit; x++){ const u = U[x], o = x * 10;
        for(let a = 0; a < 9 && !hit; a++){ const ia = u[a], m = c[ia]; if(g[ia] || PC[m] !== 2) continue;
          for(let b2 = a + 1; b2 < 9; b2++){ const ib = u[b2]; if(g[ib] || c[ib] !== m) continue; for(const j of u) if(j !== ia && j !== ib && elim(j, m)) hit = true; } }
        for(let d1 = 1; d1 <= 8 && !hit; d1++){ const m1 = pm[o + d1]; if(PC[m1] !== 2) continue;
          for(let d2 = d1 + 1; d2 <= 9; d2++) if(pm[o + d2] === m1){ const keep = (1 << d1) | (1 << d2); for(let k = 0; k < 9; k++) if(m1 & (1 << k) && elim(u[k], ALL & ~keep)) hit = true; } }
      }
      if(bad) break; if(hit){ use(4); continue; }
      if(cap < 5) break;
      /* 5 트리플(네이키드/히든) · X-윙 */
      for(let x = 0; x < NU && !hit; x++){ const u = U[x], o = x * 10, e = [];
        for(let k = 0; k < 9; k++){ const i = u[k]; if(!g[i] && PC[c[i]] <= 3) e.push(i); }
        for(let a = 0; a < e.length && !hit; a++) for(let b2 = a + 1; b2 < e.length && !hit; b2++){ const m2 = c[e[a]] | c[e[b2]]; if(PC[m2] > 3) continue;
          for(let q = b2 + 1; q < e.length; q++){ const m = m2 | c[e[q]]; if(PC[m] !== 3) continue;
            for(const j of u) if(j !== e[a] && j !== e[b2] && j !== e[q] && elim(j, m)) hit = true; if(hit) break; } }
        const ds = []; for(let d = 1; d <= 9; d++){ const q = PC[pm[o + d]]; if(q >= 2 && q <= 3) ds.push(d); }
        for(let a = 0; a < ds.length && !hit; a++) for(let b2 = a + 1; b2 < ds.length && !hit; b2++) for(let q = b2 + 1; q < ds.length && !hit; q++){
          const m = pm[o + ds[a]] | pm[o + ds[b2]] | pm[o + ds[q]]; if(PC[m] !== 3) continue;
          const keep = (1 << ds[a]) | (1 << ds[b2]) | (1 << ds[q]); for(let k = 0; k < 9; k++) if(m & (1 << k) && elim(u[k], ALL & ~keep)) hit = true; }
      }
      /* X-윙: 가로줄(구역 0~8)의 칸 번호 = 세로줄 번호, 세로줄(9~17)의 칸 번호 = 가로줄 번호 */
      for(let d = 1; d <= 9 && !hit; d++) for(const A of [0, 9]){ if(hit) break; const B = 9 - A;
        for(let r1 = 0; r1 < 9 && !hit; r1++){ const m = pm[(A + r1) * 10 + d]; if(PC[m] !== 2) continue;
          for(let r2 = r1 + 1; r2 < 9 && !hit; r2++){ if(pm[(A + r2) * 10 + d] !== m) continue;
            for(let k = 0; k < 9; k++) if(m & (1 << k)){ const v = U[B + k]; for(let t = 0; t < 9; t++) if(t !== r1 && t !== r2 && elim(v[t], 1 << d)) hit = true; } } } }
      if(bad) break; if(hit){ use(5); continue; }
      break;
    }
    return { ok:!bad && left === 0, max, n };
  }
  let calls = 0;
  function dig(sol, M, rng, maxT, floor, first){
    const puz = sol.slice(); let gv = 81;
    const rest = shuffle(seq(81, i => i).filter(i => !first || !first.has(i)), rng), order = first ? shuffle([...first], rng).concat(rest) : rest;
    for(const i of order){
      if(gv <= floor) break;
      const v = puz[i]; puz[i] = 0;
      calls++; if(rate(puz, M, maxT).ok) gv--; else puz[i] = v;
    }
    return { puz, gv, r:rate(puz, M, maxT) };
  }
  /* 한 판 만들기. spec = { rules:[], maxT, minT, floor, ne(짝수 칸 개수), ni(부등호 개수), tries } */
  function gen(spec, rng){
    const units = (spec.rules || []).filter(k => EXTRA[k]), M0 = model(units);
    let best = null; calls = 0;
    /* 시도 횟수와 판정 호출 수(기기와 무관하게 같은 값)로 멈춤 → 같은 스테이지는 어느 폰에서나 같은 문제 */
    let sol = null;
    for(let t = 0; t < (spec.tries || 6) && calls < (spec.budget || 1000); t++){
      if(t % 3 === 0) sol = fill(M0, rng);   /* 완성 판 하나로 표시·파내는 순서만 바꿔 3번까지 시도 */
      let even = null, ineq = [];
      const first = new Set();
      if(spec.ne){ even = new Array(81).fill(0); shuffle(seq(81, i => i).filter(i => sol[i] % 2 === 0), rng).slice(0, spec.ne).forEach(i => { even[i] = 1; first.add(i); }); }
      if(spec.ni){ const pairs = []; for(let r = 0; r < 9; r++) for(let c = 0; c < 9; c++){ if(c < 8) pairs.push([r * 9 + c, r * 9 + c + 1]); if(r < 8) pairs.push([r * 9 + c, r * 9 + c + 9]); }
        ineq = shuffle(pairs, rng).slice(0, spec.ni).map(([a, b]) => sol[a] > sol[b] ? [a, b] : [b, a]); ineq.forEach(([a, b]) => { first.add(a); first.add(b); }); }
      const M = model(units, even, ineq), d = dig(sol, M, rng, spec.maxT, spec.floor - Math.min(spec.slack || 0, t * 2), first.size ? first : null);
      const res = { sol, puz:d.puz, gv:d.gv, rules:spec.rules || [], even, ineq, max:d.r.max, n:d.r.n, tries:t + 1 };
      const sc = r => (r.max >= (spec.minT || 0) ? 100 : r.max * 10) - r.gv * 0.01;
      if(!best || sc(res) > sc(best)) best = res;
      if(best.max >= (spec.minT || 0)) break;
    }
    return best;
  }
  /* 검증용: 해답 개수 세기(추가 구역·짝수·부등호 모두 반영) */
  function count(puz, M, limit){
    const g = puz.slice(); let k = 0;
    const okIq = i => { for(const [a, b] of M.ineq){ if(a !== i && b !== i) continue; if(g[a] && g[b] && g[a] <= g[b]) return false; } return true; };
    (function bt(){
      if(k >= limit) return;
      let best = -1, bm = 0, bn = 10;
      for(let i = 0; i < 81; i++){ if(g[i]) continue; let m = M.even && M.even[i] ? EV : ALL; for(const j of M.peers[i]) if(g[j]) m &= ~(1 << g[j]); const q = PC[m]; if(q < bn){ best = i; bm = m; bn = q; } }
      if(best < 0){ k++; return; }
      for(let d = 1; d <= 9; d++) if(bm & (1 << d)){ g[best] = d; if(okIq(best)) bt(); g[best] = 0; if(k >= limit) return; }
    })();
    return k;
  }
  return { model, fill, rate, dig, gen, count, EXTRA };
}
/* 같은 코드를 Web Worker에서도 돌리려고 함수로 감쌈(다음 스테이지 미리 만들기) */
const SX = SX_MAKE(shuffle);
/* SX-CORE-END */
/* SX-PLAN-BEGIN */
/* 스테이지 n의 스도쿠 설계: 켜진 규칙·변주 + 요구 기술 단계(판정기 기준) + 최소 숫자 수(바닥)
   쉬움(k1·6·9) = 네이키드 싱글만 · 보통(k2~4·7·8) = 싱글+히든 싱글까지 · 어려움(k5) = 잠긴 후보/페어가 꼭 필요 · 보스(k10) = 트리플/X-윙까지 */
function sudPlan(n){
  const p = planOf('sudoku', n), c = p.c, k = p.k, rules = p.mj.slice(), tw = p.tw;
  const F = [0, 36, 33, 31, 29, 27][Math.min(c, 5)] - (c > 5 ? 1 : 0);
  const T = { 1:1, 2:2, 3:2, 4:2, 5:4, 6:1, 7:2, 8:2, 9:1, 10:5 }[k];
  const minT = k === 5 ? (c >= 3 ? 4 : 3) : k === 10 ? (c === 1 || tw === 'nomemo' ? 4 : 5) : [3, 4, 7, 8].includes(k) && !(c === 1 && k === 3) ? 2 : 0;
  let floor = k === 5 || k === 10 ? (rules.length ? 15 : 17) : F + { 1:8, 2:4, 3:2, 4:0, 6:6, 7:3, 8:1, 9:8 }[k];
  if(c === 1 && k <= 3) floor = [0, 46, 42, 39][k];
  if(k !== 5 && k !== 10) floor -= rules.reduce((s, r) => s + ({ diag:2, window:2, parity:3, ineq:5 }[r] || 0), 0);
  const easy = T === 1, ne = rules.includes('parity') ? (easy ? 16 : T === 2 ? 13 : 9) : 0, ni = rules.includes('ineq') ? (easy ? 26 : T === 2 ? 20 : 13) : 0;
  const lim = Math.round(({ 1:420, 2:600, 4:900, 5:1200 }[T] + rules.length * 60) * (tw === 'flash' ? 0.6 : 1));
  return { n, c, k, rules, tw, maxT:T, minT, floor, ne, ni, limit:lim, tries:minT >= 4 ? 24 : minT >= 3 ? 8 : 5, slack:minT === 2 ? 6 : 0, budget:minT >= 4 ? 1600 : 1000 };
}
/* SX-PLAN-END */
/* SX-CONCEPTS-BEGIN */
/* 스도쿠 솔로 개념 사이클(난이도 v2 계약): 11 대각선 · 21 짝수 칸 · 31 창문 · 41 부등호, 변주 6 번개 · 16 맨손 · 26 외줄 타기 · 36 강조 없이 · 46 메모 없이.
   모두 장르 공통 변형 규칙(대각선/홀짝/창문/부등호 스도쿠)이고 특정 앱의 배치·용어를 따르지 않음(결정 135). 오늘의 문제·대전 스도쿠에는 적용하지 않음. */
CONCEPTS.sudoku = {
  order:['diag', 'parity', 'window', 'ineq'],
  info:{
    diag:{ name:'대각선', desc:'파랗게 칠한 두 대각선에도 1부터 9까지 한 번씩 들어가요. 가운데 칸은 두 대각선이 함께 지나가요.' },
    parity:{ name:'짝수 칸', desc:'회색 동그라미가 있는 칸에는 짝수(2·4·6·8)만 들어가요. 주어진 숫자가 적은 대신 동그라미가 힌트예요.' },
    window:{ name:'창문', desc:'초록 테두리 창문 4개(3×3)에도 1부터 9까지 한 번씩 들어가요. 굵은 칸과 겹치는 곳을 함께 봐요.' },
    ineq:{ name:'부등호', desc:'두 칸 사이의 ‹ › 표시는 크기 비교예요. 뾰족한 쪽이 더 작은 숫자예요.' }
  },
  twists:['flash', 'bare', 'tight', 'nosame', 'nomemo'],
  twInfo:{
    nosame:{ name:'강조 없이', desc:'칸을 골라도 같은 숫자가 분홍색으로 표시되지 않아요. 눈으로 직접 찾아요!' },
    nomemo:{ name:'메모 없이', desc:'메모를 쓸 수 없어요. 예비 숫자는 머릿속에 적어 두세요.' }
  }
};
/* SX-CONCEPTS-END */
/* 판정기 단계 → 스테이지 설명 */
const SX_TECH = { 1:'기본 채우기', 2:'숨은 자리 찾기', 3:'후보 묶기', 4:'후보 묶기·짝 찾기', 5:'고급 기술(세 쌍·X-윙)' };
function sudDesc(n){ const P = sudPlan(n); return '필요한 기술: ' + SX_TECH[Math.max(1, Math.min(5, P.minT))]; }
/* 만든 문제는 기기에 몇 개만 기억(같은 스테이지 재도전·다음 스테이지 미리 만들기). 설계가 바뀌면 지문이 달라져 새로 만든다 */
const SX_V = 1;
const sudFp = P => SX_V + ':' + [P.rules.join('+'), P.maxT, P.minT, P.floor, P.ne, P.ni, P.tries, P.slack, P.budget].join('/');
const sudPack = g => ({ puz:g.puz, sol:g.sol, even:g.even ? g.even.map((v, i) => v ? i : -1).filter(i => i >= 0) : [], ineq:g.ineq || [], max:g.max, gv:g.gv });
function sudCache(n, P, r){
  let C = null; try{ C = store.get('hp:sxc', null); }catch(_){}
  C = C && C.v ? C : { v:{} };
  const f = sudFp(P);
  if(r === undefined){ const e = C.v[n]; return e && e.f === f && Array.isArray(e.r.puz) ? e.r : null; }
  C.v[n] = { f, r, t:Date.now() };
  Object.keys(C.v).sort((a, b) => C.v[b].t - C.v[a].t).slice(6).forEach(k => delete C.v[k]);
  try{ store.set('hp:sxc', C); }catch(_){}
  return r;
}
function sudGenStage(n){
  const P = sudPlan(n);
  let r = sudCache(n, P);
  if(!r) r = sudCache(n, P, sudPack(SX.gen(P, mulberry(seedFrom('adv:sudoku:' + n)))));
  return { P, r };
}
/* 다음 스테이지를 Web Worker에서 미리 만든다(같은 씨앗·같은 코드라 결과가 같음). 실패하면 조용히 넘어가고 시작할 때 만든다 */
let SX_W = null;
function sudPrefetch(n){
  try{
    const P = sudPlan(n); if(sudCache(n, P) || typeof Worker === 'undefined') return;
    if(!SX_W){
      const src = `const mulberry=${mulberry};const shuffle=${shuffle};const SX=(${SX_MAKE})(shuffle);
onmessage=e=>{const d=e.data,g=SX.gen(d.P,mulberry(d.seed));postMessage({n:d.n,g:{puz:g.puz,sol:g.sol,even:g.even,ineq:g.ineq,max:g.max,gv:g.gv}});};`;
      SX_W = new Worker(URL.createObjectURL(new Blob([src], { type:'text/javascript' })));
      SX_W.onmessage = e => { const d = e.data; if(d && d.g) sudCache(d.n, sudPlan(d.n), sudPack(d.g)); };
      SX_W.onerror = () => { SX_W = null; };
    }
    SX_W.postMessage({ n, P, seed:seedFrom('adv:sudoku:' + n) });
  }catch(_){}
}
/* 솔로 판 준비: 추가 구역·짝수 칸·부등호·변주를 G에 싣는다 */
function sudSxInit(X){
  const P = X.P, M = SX.model(P.rules), pe = new Uint8Array(6561), ev = new Set(X.r.even);
  M.peers.forEach((ps, i) => ps.forEach(j => { pe[i * 81 + j] = 1; }));
  const xu = M.units.slice(27).map((u, k) => ({ key:'x' + k, ids:u, name:P.rules.includes('diag') && k < 2 ? '대각선' : '창문' }));
  const dg = new Set(P.rules.includes('diag') ? SX.EXTRA.diag.flat() : []), wn = new Set(P.rules.includes('window') ? SX.EXTRA.window.flat() : []);
  G.sx = { P, rules:P.rules, tw:P.tw, ineq:X.r.ineq, even:ev, xu, cls:[...Array(81).keys()].map(i => (dg.has(i) ? ' dg' : '') + (wn.has(i) ? ' wn' : '') + (ev.has(i) ? ' ev' : '')) };
  G.sxP = pe;
  if(P.tw === 'bare') G.hints = 0;
  if(P.tw === 'tight') G.missCap = 2;
  G.noMemo = P.tw === 'nomemo'; G.noSame = P.tw === 'nosame';
  const me = G; setTimeout(() => { if(G === me) sudPrefetch(P.n + 1); }, 1500);
}
/* 판 위 그림: 창문 테두리 · 부등호(뾰족한 쪽 = 작은 수). 칸 색(대각선·창문)과 짝수 동그라미는 칸 클래스로 */
function sudSxOverlay(bd){
  const S = G.sx; if(!S) return;
  bd.classList.add('sxb');
  let h = '';
  if(S.rules.includes('window')) h += [[1, 1], [1, 5], [5, 1], [5, 5]].map(([r, c]) => `<i class="wnb" style="top:${r / 9 * 100}%;left:${c / 9 * 100}%"></i>`).join('');
  const chev = '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M3 2 9 7 3 12" fill="none" stroke="#C2410C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  for(const [a, b] of S.ineq){
    const ra = (a / 9) | 0, ca = a % 9, rb = (b / 9) | 0, cb = b % 9;
    const rot = b === a + 1 ? 0 : b === a - 1 ? 180 : b === a + 9 ? 90 : 270;
    const x = ra === rb ? Math.max(ca, cb) / 9 : (ca + .5) / 9, y = ra === rb ? (ra + .5) / 9 : Math.max(ra, rb) / 9;
    h += `<i class="iq" style="left:${(x * 100).toFixed(3)}%;top:${(y * 100).toFixed(3)}%;transform:rotate(${rot}deg)">${chev}</i>`;
  }
  const o = document.createElement('div'); o.className = 'sxo'; o.setAttribute('aria-hidden', 'true'); o.innerHTML = h; bd.appendChild(o);
}
function sudSxChips(){
  const S = G.sx; if(!S) return '';
  const nm = k => (conceptInfo('sudoku', k) || {}).name || k;
  const bits = S.rules.map(k => `<span class="sxc">${nm(k)}</span>`);
  if(S.tw) bits.push(`<span class="sxc t">${nm(S.tw)}</span>`);
  return bits.length ? `<div class="sxchips" aria-label="이번 판 규칙">${bits.join('')}</div>` : '';
}

const boxOf = i => Math.floor(Math.floor(i/9)/3)*3 + Math.floor((i%9)/3);
/* 솔로 변형 판이면 대각선·창문도 같은 무리(peers): 강조·메모 자동 지우기에 함께 반영 */
const isPeer = (a, b) => a !== b && (G && G.sxP ? G.sxP[a * 81 + b] === 1 : (Math.floor(a/9) === Math.floor(b/9) || a%9 === b%9 || boxOf(a) === boxOf(b)));
const locked = i => G.given[i] || (G.grid[i] && !G.wrong[i]);

function paintSud(){
  const sel = G.sel, sv = sel >= 0 ? G.grid[sel] : 0;
  document.querySelectorAll('#bd .cell').forEach(el => {
    const i = +el.dataset.i, v = G.grid[i];
    let cls = 'cell ' + (G.given[i] ? 'given' : G.wrong[i] ? 'wrong' : 'user') + (G.sx ? G.sx.cls[i] : '');
    if(sel >= 0){
      if(i === sel) cls += ' sel';
      else if(sv && v === sv && !G.noSame) cls += ' same';
      else if(isPeer(i, sel)) cls += ' hl';
    }
    for(const fc of ['pop','wave','winw','flash']) if(el.classList.contains(fc)) cls += ' ' + fc;
    el.className = cls;
    if(v){ el.textContent = v; }
    else if(G.notes[i]){
      let h = '<div class="nt">'; for(let d=1;d<=9;d++) h += `<span>${G.notes[i] & (1<<d) ? d : ''}</span>`; el.innerHTML = h + '</div>';
    } else el.textContent = '';
  });
  document.querySelectorAll('#pad button').forEach(b => {
    const v = +b.dataset.v; let n = 0; for(let i=0;i<81;i++) if(G.grid[i] === v && !G.wrong[i]) n++;
    b.classList.toggle('gone', n >= 9);
  });
  const mis = $('#smis'), mn = 3 - G.paws;
  if(mis){ [...mis.children].forEach((d, k) => d.classList.toggle('on', k < mn)); mis.setAttribute('aria-label', '실수 ' + mn + '번, ' + (G.missCap || 3) + '번까지'); }
  $('#sscore').textContent = fmt(Math.round(G.earned * G.L.mult));
  $('#memoBadge').textContent = G.memo ? 'ON' : 'OFF'; $('#memoBadge').classList.toggle('off', !G.memo);
  $('#tMemo').classList.toggle('on', G.memo); $('#tMemo').classList.toggle('used', !!G.noMemo); $('#tMemo').setAttribute('aria-pressed', G.memo); $('#tMemo').setAttribute('aria-label', '메모 ' + (G.memo ? '켜짐' : '꺼짐'));
  $('#hintBadge').textContent = G.hints; $('#tHint').classList.toggle('used', G.hints === 0); $('#tHint').setAttribute('aria-label', '힌트 ' + G.hints + '번 남음');
}
function snap(){ G.undo.push({ grid:G.grid.slice(), notes:G.notes.slice(), wrong:G.wrong.slice() }); if(G.undo.length > 200) G.undo.shift(); }
function placeCorrect(i, v, earn){
  G.grid[i] = v; G.wrong[i] = false; G.notes[i] = 0;
  for(let j=0;j<81;j++) if(isPeer(i, j)) G.notes[j] &= ~(1 << v);
  if(!G.earnedCells[i]){ G.earnedCells[i] = 1; if(earn) G.earned += G.perCell; }
}
function sudCheckWin(){ for(let i=0;i<81;i++) if(G.grid[i] !== G.sol[i]) return false; return true; }
function cellEl(i){ return document.querySelector(`#bd .cell[data-i="${i}"]`); }

function sudInput(v){
  const i = G.sel;
  if(G.over || G.paused || G.done || i < 0 || locked(i)) return;
  if(G.memo){
    if(G.grid[i]) return;
    snap(); G.notes[i] ^= (1 << v); paintSud(); sfx('sNote', { on:!!(G.notes[i] & (1 << v)) }); return;
  }
  snap();
  if(G.sol[i] === v){
    placeCorrect(i, v, true);
    const padR = sudPadRect(v);
    paintSud();
    sudCelebrate(i, v, padR, false);
    if(sudCheckWin()) sudWin();
  } else {
    G.grid[i] = v; G.wrong[i] = true; G.notes[i] = 0; G.scombo = 0; paintSud(); miss(cellEl(i)); paintSud();
  }
}
/* ----- 스도쿠 효과(효과팀) ----- */
function sudUnitsDone(){
  const u = {}, ok = ids => ids.every(j => G.grid[j] && G.grid[j] === G.sol[j]);
  for(let k=0;k<9;k++){
    if(ok([...Array(9)].map((_, x) => k*9 + x))) u['r' + k] = 1;
    if(ok([...Array(9)].map((_, x) => x*9 + k))) u['c' + k] = 1;
    if(ok([...Array(81).keys()].filter(j => boxOf(j) === k))) u['b' + k] = 1;
  }
  if(G.sx) G.sx.xu.forEach(x => { if(ok(x.ids)) u[x.key] = 1; });
  return u;
}
/* 이 숫자를 넣으면 9개가 다 채워지는지: 채워지면 숫자판 버튼 위치를 미리 기억(곧 사라지므로) */
function sudPadRect(v){ let n = 0; for(let j=0;j<81;j++) if(G.grid[j] === v && !G.wrong[j]) n++; const b = document.querySelector(`#pad button[data-v="${v}"]`); return n >= 9 && b ? fxCenter(b) : null; }
function sudCelebrate(i, v, padR, hint){
  const el = cellEl(i); if(!el) return;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  const p = fxCenter(el), pan = panX(p.x);
  G.scombo = hint ? 0 : (G.scombo || 0) + 1;
  fxRing(p.x, p.y, hint ? '#FFD54F' : '#8B5CF6', p.w * 1.4, .45, 5);
  fxBurst(p.x, p.y, hint ? ['#FFE27A','#FFFFFF','#9C7BD8'] : ['#8B5CF6','#D9CCF0','#FFFFFF','#FFD54F'], hint ? 14 : 9, { speed:170, size:3.4, kinds:['dot','star','spark'], up:70, g:480, dur:.6, glow:hint });
  if(hint){ fxFloat(p.x, p.y - p.h * .5, '힌트', 'sud'); sfx('fHint', { pan }); }
  else { fxFloat(p.x, p.y - p.h * .5, '+' + Math.round(G.perCell * G.L.mult), 'sud'); sfx('sNum', { v, n:G.scombo, pan }); fxBuzz(10); }
  /* 가로줄·세로줄·굵은 칸이 완성되면: 놓은 칸에서부터 물결 + 반짝임 + 차임 */
  const r = Math.floor(i/9), c = i%9, b = boxOf(i), found = [];
  const ok = ids => ids.every(j => G.grid[j] === G.sol[j] && !G.wrong[j]);
  const units = [['r' + r, [...Array(9)].map((_, x) => r*9 + x), '가로줄'], ['c' + c, [...Array(9)].map((_, x) => x*9 + c), '세로줄'], ['b' + b, [...Array(81).keys()].filter(j => boxOf(j) === b), '굵은 칸']];
  if(G.sx) G.sx.xu.forEach(x => { if(x.ids.includes(i)) units.push([x.key, x.ids, x.name]); });
  G.uDone = G.uDone || {};
  for(const [k, ids, nm] of units) if(!G.uDone[k] && ok(ids)){ G.uDone[k] = 1; found.push([ids, nm]); }
  if(found.length){
    const seen = new Set();
    found.forEach(([ids]) => ids.forEach(j => {
      if(seen.has(j)) return; seen.add(j);
      const e = cellEl(j); if(!e) return;
      const dist = Math.max(Math.abs(Math.floor(j/9) - r), Math.abs(j%9 - c));
      e.style.setProperty('--wd', dist * 55 + 'ms'); e.classList.remove('wave'); void e.offsetWidth; e.classList.add('wave');
      setTimeout(() => { if(!e.isConnected) return; const q = fxCenter(e); fxBurst(q.x, q.y, ['#FFE27A','#FFFFFF','#FFB020'], 4, { speed:120, size:3, kinds:['star','spark'], up:90, g:300, glow:true, dur:.55 }); }, dist * 55 + 120);
    }));
    setTimeout(() => sfx('sLine', { k:found.length }), 60);
    fxFloat(p.x, p.y - p.h * 1.3, found.length > 1 ? (found.length > 2 ? '트리플!' : '더블!') : found[0][1] + ' 완성!', 'big');
    fxBuzz(found.length > 1 ? [20, 30, 20, 30, 30] : [20, 30, 20]);
  }
  if(padR){
    setTimeout(() => { sfx('sDigit'); fxRing(padR.x, padR.y, '#FFD54F', padR.w * 1.6, .5, 6); fxBurst(padR.x, padR.y, ['#FFE27A','#FFFFFF','#8B5CF6'], 16, { speed:220, size:4, kinds:['star','spark','dot'], up:160, g:500, glow:true }); fxFloat(padR.x, padR.y - padR.h, v + ' 끝!', 'sud'); }, 160);
  }
}
/* 스도쿠 완성: 왼쪽 위에서 오른쪽 아래로 파도 → 완성 음악 → 색종이 → 결과 */
function sudWin(){
  G.done = true; G.paused = true; G.pauseAt = Date.now(); G.sel = -1; paintSud();
  document.querySelectorAll('#bd .cell').forEach(e => { const j = +e.dataset.i, d = Math.floor(j/9) + j%9; e.style.setProperty('--wd', d * 40 + 'ms'); e.classList.remove('winw', 'wave', 'pop'); void e.offsetWidth; e.classList.add('winw'); });
  sfx('win', { g:'sudoku' }); fxBuzz([30, 60, 30, 60, 80]);
  const me = G;
  setTimeout(() => { if(G !== me) return; fxConfetti(); fxPop($('#bd'), 'gold'); }, 650);
  setTimeout(() => { if(G === me) finish(true); }, 1500);
}
function sudUndo(){
  if(G.over || G.paused || G.done || !G.undo.length) return;
  const u = G.undo.pop(); G.grid = u.grid; G.notes = u.notes; G.wrong = u.wrong; paintSud(); sfx('sUndo');
}
function sudErase(){
  const i = G.sel;
  if(G.over || G.paused || i < 0 || locked(i)) return;
  if(!G.grid[i] && !G.notes[i]) return;
  snap(); G.grid[i] = 0; G.wrong[i] = false; G.notes[i] = 0; paintSud(); sfx('sErase');
}
function sudHint(){
  if(G.over || G.paused || G.done) return;
  if(G.hints <= 0){ toast(G.sx && G.sx.tw === 'bare' ? '이 판은 힌트 없이 풀어요' : '힌트를 모두 썼어요', 'err'); return; }
  let i = G.sel;
  if(i < 0 || locked(i)){
    const open = []; for(let j=0;j<81;j++) if(!locked(j)) open.push(j);
    if(!open.length) return; i = open[Math.floor(Math.random()*open.length)];
  }
  const hv = G.sol[i];
  snap(); G.hints--; G.hintUsed++; placeCorrect(i, hv, false); G.sel = i;
  const padR = sudPadRect(hv); paintSud();
  sudCelebrate(i, hv, padR, true);
  if(sudCheckWin()) sudWin();
}
function togglePause(on){
  if(on && duelNoStop()){ duelNoPause(); return; }
  if(G.over || G.paused === on) return;
  if(on){ G.paused = true; G.pauseAt = Date.now(); }
  else { G.pausedMs += Date.now() - G.pauseAt; G.paused = false; }
  $('#pcover').classList.toggle('on', on); updateClock(); sfx('toggle', { on:!on });
}

function miss(el){
  G.paws--; renderPaws();
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  const p = fxCenter(el), bd = $('#bd');
  sfx('sBad'); fxBuzz([60, 40, 90]);
  fxRing(p.x, p.y, '#E5484D', p.w * 1.6, .4, 6);
  fxBurst(p.x, p.y, ['#E5484D', '#FF9AA4', '#2A1650'], 8, { speed:170, size:3.4, kinds:['rect','dot'], g:900, up:20 });
  const cap = G.missCap || 3;   /* 외줄 타기: 2번째 실수에서 끝 */
  fxFloat(p.x, p.y - p.h * .5, '실수 ' + (3 - G.paws) + '/' + cap, 'bad');
  if(bd && !FXR.reduce){ bd.classList.remove('shake2'); void bd.offsetWidth; bd.classList.add('shake2'); }
  if(3 - G.paws === cap - 1) fxVignette();
  if(G.paws <= 0 || 3 - G.paws >= cap) setTimeout(() => finish(false), 650);
}
