/* 동물 삼총사 */

/* ===== 새 게임 모듈 ===== */
/* @@NG_MODULES_BEGIN@@ */
/* ===== 동물 삼총사 (match) · 7×7 같은 동물 3마리 맞추기 · 오늘의 문제·대전은 이동 20번 목표 점수 ===== */
NG.match = (() => {
  const N = 7;
  const KINDS = ['octopus','whale','chick','frog','owl','fox','panda'];
  const KNAME = ['문어','고래','병아리','개구리','부엉이','여우','판다'];
  const TCOL = ['#FF7B84','#5DB8FF','#FFD23F','#6ED147','#A98BF5','#FF9A3F','#F4F4FA'];
  const TDRK = ['#C9404F','#2A7BC4','#D39A00','#2F8F22','#6C4CC4','#C75E12','#3A3340'];
  const TLIT = ['#FFD2D6','#D3EEFF','#FFF3B5','#D8F7C4','#E9E0FF','#FFE3C8','#FFFFFF'];
  const S_H = 1, S_V = 2, S_BOMB = 3, S_RB = 4, S_STAR = 5, S_BOX = 6;   /* 5 별사탕(2×2, 대각선 X), 6 나무 상자(장애물) */
  const A_HAM = 7, A_FLUTE = 8;   /* 아이템 연출 종류: 뿅망치 · 동물 피리 */
  const ACT_BONUS = { 1:40, 2:40, 3:60, 4:100, 5:50 };
  /* 그리디 자동 플레이어가 이동 20번에 얻는 평균 점수(2026-09-30 별사탕 규칙으로 다시 잼, 동물 수별 150판, tools/match-tune.js daily). 오늘의 문제·대전 목표의 기준 */
  const BOT = { 5:8520, 6:3480 };
  const DAY_MOVES = 20;
  const MT_D = [0,2.82,2.82,2.78,1.55,1.34,4.99,4.99,1.45,1.59,1.34,[0.5,22],4.99,0.5,1.13,0.89,1.41,1.13,1.24,0.99,1.1,[0.5,31],[0.5,24],[0.5,22],1.13,0.64,4.99,0.75,0.99,0.57,0.5,[0.5,26],0.99,0.82,0.96,[0.5,27],0.85,0.64,1.13,[0.5,31],[0.5,38],[0.5,37],[0.5,31],0.57,0.71,[0.5,31],4.99,1.13,0.75,0.89,0.89,0.78,[0.5,32],0.71,1.13,[0.5,31],0.85,0.92,0.75,0.75,0.54,0.68,[0.5,40],0.54,0.82,0.57,[0.5,38],1.03,0.71,0.99,[0.5,37],[0.5,40],0.61,[0.5,39],[0.5,40],[0.5,40],0.85,[0.5,31],0.57,0.82,[0.5,40],[0.5,33],[0.5,40],0.89,0.85,[0.5,38],0.71,0.78,0.5,0.57,[0.5,40],[0.5,40],0.78,0.5,0.57,0.68,0.82,0.5,0.78,0.78,[0.5,40]];   /* 솔로 스테이지별 난이도 배율(자동 플레이어로 맞춘 값, 14_난이도_벤치마크.md). 2026-09-30 별사탕 규칙으로 다시 맞춤(tools/match-tune.js tune, 판마다 40번). 비어 있으면 1 */
  const mult = k => 1 + 0.25 * (k - 1);
  const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const idx = (r, c) => r * N + c;

  /* ------------------------------------------------------------------
     엔진(화면과 분리 · 결정적). 판 E.b[49] = {id,k,s} (k: 동물 0~K-1, 무지개는 -1)
     새로 떨어지는 동물은 열마다 따로 쌓아 둔 수열(E.cols)에서 순서대로 꺼낸다.
     → 같은 씨앗 + 같은 수 = 같은 결과. 시뮬레이션용 복제도 같은 수열을 공유한다.
  ------------------------------------------------------------------ */
  const kindAt = (b, i) => { const t = b[i]; return t && t.s !== S_RB && t.s !== S_STAR && t.s !== S_BOX ? t.k : -1; };
  const movable = t => !!t && t.s !== S_BOX && !t.lk;
  const nb4 = i => { const r = Math.floor(i / N), c = i % N, o = []; if(r) o.push(i - N); if(r < N - 1) o.push(i + N); if(c) o.push(i - 1); if(c < N - 1) o.push(i + 1); return o; };
  function newTile(E, k, s){ return { id:++E.uid, k, s:s || 0 }; }
  function nextKind(E, c){ const col = E.cols[c]; if(col.i >= col.arr.length) col.arr.push(col.gen()); return Math.floor(col.arr[col.i++] * E.K); }
  function makeEngine(rng, K){
    const E = { K, rng, uid:0, b:new Array(N * N).fill(null), cols:[], pts:0, maxCombo:0, moves:0, shuffles:0 };
    for(let c = 0; c < N; c++) E.cols.push({ arr:[], gen:mb(Math.floor(rng() * 4294967296)), i:0 });
    for(let tries = 0; tries < 50; tries++){
      for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
        let k;
        do k = Math.floor(rng() * K);
        while((c >= 2 && E.b[idx(r, c - 1)].k === k && E.b[idx(r, c - 2)].k === k) || (r >= 2 && E.b[idx(r - 1, c)].k === k && E.b[idx(r - 2, c)].k === k) || (r >= 1 && c >= 1 && E.b[idx(r - 1, c)].k === k && E.b[idx(r, c - 1)].k === k && E.b[idx(r - 1, c - 1)].k === k));
        E.b[idx(r, c)] = newTile(E, k);
      }
      if(!findGroups(E.b).length && hasMove(E)) break;
    }
    return E;
  }
  function clone(E){
    return { K:E.K, rng:null, uid:E.uid, b:E.b.map(t => t && { ...t }), cols:E.cols.map(c => ({ arr:c.arr, gen:c.gen, i:c.i })), pts:E.pts, maxCombo:E.maxCombo, moves:E.moves, shuffles:0,
      ice:E.ice ? E.ice.slice() : null, goals:E.goals, got:E.got ? { k:{ ...E.got.k }, box:E.got.box, ice:E.got.ice, lock:E.got.lock } : null, movesLeft:E.movesLeft };
  }
  /* 터지는 규칙(2026-09-29): ① 가로·세로 3개 이상 한 줄 ② 2×2 네모 ③ 이어진 같은 동물 5개 이상(모양 무관).
     셋 중 하나라도 걸리면 그 동물과 이어진(상하좌우) 같은 동물 덩어리 전체가 함께 터진다. */
  function lineRuns(b){
    const runs = [];
    for(let r = 0; r < N; r++){ let c = 0; while(c < N){ const k = kindAt(b, idx(r, c)); let e = c + 1; if(k >= 0){ while(e < N && kindAt(b, idx(r, e)) === k) e++; if(e - c >= 3){ const cells = []; for(let x = c; x < e; x++) cells.push(idx(r, x)); runs.push({ h:true, k, cells }); } } c = e; } }
    for(let c = 0; c < N; c++){ let r = 0; while(r < N){ const k = kindAt(b, idx(r, c)); let e = r + 1; if(k >= 0){ while(e < N && kindAt(b, idx(e, c)) === k) e++; if(e - r >= 3){ const cells = []; for(let y = r; y < e; y++) cells.push(idx(y, c)); runs.push({ h:false, k, cells }); } } r = e; } }
    return runs;
  }
  function isSquare(b, r, c){   /* (r,c)가 왼쪽 위인 2×2 */
    if(r < 0 || c < 0 || r >= N - 1 || c >= N - 1) return false;
    const k = kindAt(b, idx(r, c));
    return k >= 0 && kindAt(b, idx(r, c + 1)) === k && kindAt(b, idx(r + 1, c)) === k && kindAt(b, idx(r + 1, c + 1)) === k;
  }
  function blob(b, i, seen){   /* i와 이어진 같은 동물 칸들 */
    const k = kindAt(b, i), out = [i], st = [i]; seen.add(i);
    while(st.length){
      const j = st.pop(), r = Math.floor(j / N), c = j % N;
      for(const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]){
        if(y < 0 || y >= N || x < 0 || x >= N) continue;
        const n = idx(y, x); if(seen.has(n) || kindAt(b, n) !== k) continue;
        seen.add(n); out.push(n); st.push(n);
      }
    }
    return out;
  }
  function findGroups(b){
    const runs = lineRuns(b), hot = new Set();
    runs.forEach(r => r.cells.forEach(x => hot.add(x)));
    for(let r = 0; r < N - 1; r++) for(let c = 0; c < N - 1; c++) if(isSquare(b, r, c)) [idx(r, c), idx(r, c + 1), idx(r + 1, c), idx(r + 1, c + 1)].forEach(x => hot.add(x));
    const seen = new Set(), out = [];
    for(let i = 0; i < N * N; i++){
      if(seen.has(i) || kindAt(b, i) < 0) continue;
      const cells = blob(b, i, seen);
      if(cells.length < 5 && !cells.some(x => hot.has(x))) continue;
      const set = new Set(cells), rs = runs.filter(r => set.has(r.cells[0]));
      const k = kindAt(b, i);
      const longest = rs.length ? rs.reduce((m, r) => r.cells.length > m.cells.length ? r : m, rs[0]) : { h:true, k, cells:[cells[0]] };
      let sq = false; for(const x of cells){ const r = Math.floor(x / N), c = x % N; if(isSquare(b, r, c)){ sq = true; break; } }
      out.push({ runs:rs, k, cells:cells.sort((a, b2) => a - b2), hasH:rs.some(r => r.h), hasV:rs.some(r => !r.h), longest, sq });
    }
    return out;
  }
  function matchThrough(b, i){
    const k = kindAt(b, i); if(k < 0) return false;
    const r = Math.floor(i / N), c = i % N;
    let n = 1; for(let x = c - 1; x >= 0 && kindAt(b, idx(r, x)) === k; x--) n++; for(let x = c + 1; x < N && kindAt(b, idx(r, x)) === k; x++) n++; if(n >= 3) return true;
    n = 1; for(let y = r - 1; y >= 0 && kindAt(b, idx(y, c)) === k; y--) n++; for(let y = r + 1; y < N && kindAt(b, idx(y, c)) === k; y++) n++; if(n >= 3) return true;
    if(isSquare(b, r - 1, c - 1) || isSquare(b, r - 1, c) || isSquare(b, r, c - 1) || isSquare(b, r, c)) return true;
    return blob(b, i, new Set()).length >= 5;
  }
  const isBlast = t => t && (t.s === S_H || t.s === S_V || t.s === S_BOMB || t.s === S_STAR);
  function swapValid(E, a, b){
    const ta = E.b[a], tb = E.b[b];
    if(!movable(ta) || !movable(tb)) return false;
    if(ta.s === S_RB || tb.s === S_RB || ta.s === S_STAR || tb.s === S_STAR) return true;
    if(isBlast(ta) && isBlast(tb)) return true;
    E.b[a] = tb; E.b[b] = ta;
    const ok = matchThrough(E.b, a) || matchThrough(E.b, b);
    E.b[a] = ta; E.b[b] = tb;
    return ok;
  }
  function listMoves(E){
    const out = [];
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
      const i = idx(r, c);
      if(c < N - 1 && swapValid(E, i, i + 1)) out.push([i, i + 1]);
      if(r < N - 1 && swapValid(E, i, i + N)) out.push([i, i + N]);
    }
    return out;
  }
  function hasMove(E){
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){ const i = idx(r, c); if((c < N - 1 && swapValid(E, i, i + 1)) || (r < N - 1 && swapValid(E, i, i + N))) return true; }
    return false;
  }
  function area(type, i){
    const r = Math.floor(i / N), c = i % N, out = [];
    if(type === S_H) for(let x = 0; x < N; x++) out.push(idx(r, x));
    else if(type === S_V) for(let y = 0; y < N; y++) out.push(idx(y, c));
    else if(type === S_BOMB){ for(let y = r - 1; y <= r + 1; y++) for(let x = c - 1; x <= c + 1; x++) if(y >= 0 && y < N && x >= 0 && x < N) out.push(idx(y, x)); }
    else if(type === S_STAR) return diagX(i, 2);
    return out;
  }
  /* 별사탕: 자기 칸을 지나는 두 대각선을 네 방향으로 len칸씩(X자, 반지름 2면 최대 9칸). 날아가거나 목표를 고르지 않는다 */
  function diagX(i, len){
    const r = Math.floor(i / N), c = i % N, out = [i];
    for(const [dy, dx] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) for(let d = 1; d <= len; d++){ const y = r + dy * d, x = c + dx * d; if(y < 0 || y >= N || x < 0 || x >= N) break; out.push(idx(y, x)); }
    return out;
  }
  function commonKind(E, skip){
    const n = new Array(E.K).fill(0);
    E.b.forEach((t, i) => { if(t && t.k >= 0 && !skip.has(i)) n[t.k]++; });
    let best = 0; for(let k = 1; k < E.K; k++) if(n[k] > n[best]) best = k; return best;
  }
  /* 한 단계: 맞춤 그룹 + (특수 발동) → 지우기 → 특수 생성 → 중력·채우기 */
  function step(E, groups, seed, k, prefer){
    const b = E.b, clear = new Set(seed ? seed.clear : []), created = [], ginfo = [], acts = seed ? seed.acts.slice() : [], activated = new Set(seed ? seed.activated : []);
    const keep = new Set();
    let raw = seed ? seed.bonus : 0;
    for(const g of groups){
      const n = g.cells.length, lg = g.longest.cells.length;
      let type = lg >= 5 ? S_RB : (g.hasH && g.hasV) || n >= 6 ? S_BOMB : lg === 4 ? (g.longest.h ? S_H : S_V) : g.sq ? S_STAR : 0, pos = -1;
      if(type){
        const cand = [];
        (prefer || []).forEach(p => { if(g.cells.includes(p)) cand.push(p); });
        if(type === S_BOMB){ const hc = new Set(), vc = new Set(); g.runs.forEach(r => r.cells.forEach(x => (r.h ? hc : vc).add(x))); g.cells.forEach(x => { if(hc.has(x) && vc.has(x)) cand.push(x); }); }
        cand.push(g.longest.cells[Math.floor((lg - 1) / 2)]); g.cells.forEach(x => cand.push(x));
        pos = cand.find(x => b[x] && !b[x].s && !b[x].lk && !keep.has(x));
        if(pos == null){ pos = -1; type = 0; }
      }
      g.cells.forEach(x => { if(x !== pos) clear.add(x); });
      if(type){ keep.add(pos); created.push({ i:pos, id:b[pos].id, s:type, k:type === S_RB || type === S_STAR ? -1 : g.k }); }
      const gp = 10 * n + 20 * Math.max(0, n - 3);
      raw += gp; ginfo.push({ cells:g.cells, pts:gp, k:g.k });
    }
    const inGroup = new Set(); groups.forEach(g => g.cells.forEach(x => inGroup.add(x)));
    const queue = [...clear].filter(i => b[i] && b[i].s && !activated.has(i));
    while(queue.length){
      const i = queue.shift(); if(activated.has(i)) continue; activated.add(i);
      const t = b[i]; let cells;
      if(t.s === S_RB){ const kk = commonKind(E, clear); cells = []; b.forEach((u, j) => { if(u && u.k === kk) cells.push(j); }); acts.push({ type:S_RB, i, cells, kind:kk }); }
      else if(t.s === S_STAR){ cells = area(S_STAR, i); acts.push({ type:S_STAR, i, cells, len:2 }); }
      else { cells = area(t.s, i); acts.push({ type:t.s, i, cells }); }
      raw += ACT_BONUS[t.s];
      for(const j of cells){ if(keep.has(j) || !b[j]) continue; if(!clear.has(j)){ clear.add(j); if(b[j].s && !activated.has(j)) queue.push(j); } }
    }
    /* 장애물: 상자는 옆에서 맞추거나 폭발에 닿으면 한 겹씩, 사슬은 풀리기만(동물은 남음), 얼음은 그 칸이 터지거나 풀리면 한 겹 */
    const boxHits = [], unlocks = [], iceHits = [];
    if(E.goals || b.some(t => t && (t.s === S_BOX || t.lk))){
      const dmg = new Map();
      groups.forEach(g => { const near = new Set(); g.cells.forEach(x => nb4(x).forEach(j => { if(b[j] && b[j].s === S_BOX) near.add(j); })); near.forEach(j => dmg.set(j, (dmg.get(j) || 0) + 1)); });
      [...clear].forEach(j => { if(b[j] && b[j].s === S_BOX){ clear.delete(j); dmg.set(j, (dmg.get(j) || 0) + 1); } });
      dmg.forEach((d, j) => { const t = b[j]; t.hp = Math.max(0, t.hp - d); raw += 20; if(t.hp <= 0){ clear.add(j); if(E.got) E.got.box++; } else boxHits.push({ i:j, id:t.id, hp:t.hp }); });
      [...clear].forEach(j => { const t = b[j]; if(t && t.lk && !keep.has(j)){ clear.delete(j); t.lk = 0; unlocks.push({ i:j, id:t.id }); raw += 20; if(E.got) E.got.lock++; } });
    }
    if(E.ice){ const hitc = new Set([...clear, ...unlocks.map(u => u.i)]); hitc.forEach(j => { if(E.ice[j] > 0 && !(b[j] && b[j].s === S_BOX && b[j].hp > 0)){ E.ice[j]--; raw += 20; iceHits.push({ i:j, left:E.ice[j] }); if(E.ice[j] === 0 && E.got) E.got.ice++; } }); }
    if(E.got) clear.forEach(j => { const t = b[j]; if(t && t.k >= 0 && t.s !== S_BOX && !keep.has(j)) E.got.k[t.k] = (E.got.k[t.k] || 0) + 1; });
    clear.forEach(i => { if(!inGroup.has(i) && !(seed && seed.clear.includes(i))) raw += 10; });
    if(seed) raw += 10 * seed.clear.length;
    const m = mult(k), pts = Math.round(raw * m);
    const clears = [...clear].map(i => ({ i, id:b[i].id, k:b[i].k, s:b[i].s }));
    clear.forEach(i => { b[i] = null; });
    created.forEach(cr => { b[cr.i].s = cr.s; b[cr.i].k = cr.k; });
    const falls = [], spawns = [];
    b.forEach((t, i) => { if(t) t._r = Math.floor(i / N); });
    for(let c = 0; c < N; c++){
      /* 상자는 제자리에 고정. 동물은 상자 칸을 건너뛰어(상자 뒤로 지나) 아래 빈칸으로 떨어진다 */
      const rows = []; for(let r = N - 1; r >= 0; r--){ const t = b[idx(r, c)]; if(!(t && t.s === S_BOX)) rows.push(r); }
      const tiles = rows.map(r => b[idx(r, c)]).filter(Boolean);
      rows.forEach(r => { b[idx(r, c)] = null; });
      tiles.forEach((t, j) => { const to = rows[j]; b[idx(to, c)] = t; if(t._r != null && t._r !== to) falls.push({ id:t.id, from:t._r, to, c }); });
      const miss = rows.length - tiles.length;
      for(let j = tiles.length; j < rows.length; j++){ const r = rows[j], t = newTile(E, nextKind(E, c)); b[idx(r, c)] = t; spawns.push({ id:t.id, k:t.k, r, c, from:r - miss }); }
    }
    b.forEach(t => { if(t) delete t._r; });
    E.pts += pts;
    return { k, mult:m, pts, raw, groups:ginfo, acts, clears, created, falls, spawns, converted:seed ? seed.converted : [], boxHits, unlocks, iceHits };
  }
  /* 한 수: 성공하면 E를 바꾸고 단계 목록을 돌려준다. maxSteps로 시뮬레이션 길이 제한 */
  function move(E, a, b2, maxSteps){
    const ta = E.b[a], tb = E.b[b2];
    if(!swapValid(E, a, b2)) return { ok:false };
    E.b[a] = tb; E.b[b2] = ta;
    const steps = []; let seed = null;
    if(ta.s === S_RB || tb.s === S_RB || (isBlast(ta) && isBlast(tb))){
      const rbPos = ta.s === S_RB ? b2 : tb.s === S_RB ? a : -1, oPos = rbPos === a ? b2 : a, other = E.b[oPos];
      seed = { clear:[], acts:[], activated:[], converted:[], bonus:0 };
      if(rbPos >= 0 && other.s === S_RB){
        E.b.forEach((t, i) => seed.clear.push(i)); seed.acts.push({ type:S_RB, i:b2, cells:seed.clear.slice(), kind:-1 }); seed.bonus = 300;
      } else if(rbPos >= 0 && other.s === S_STAR){
        /* 별사탕 + 무지개: 판에 가장 많은 동물이 모두 별사탕이 되어 한꺼번에 터진다 */
        const kk = commonKind(E, new Set()), cells = [rbPos, oPos];
        E.b.forEach((t, i) => { if(!t || t.k !== kk) return; cells.push(i); if(!t.s && !t.lk){ t.s = S_STAR; seed.converted.push({ id:t.id, s:S_STAR }); } });
        seed.clear = cells; seed.activated = [rbPos]; seed.acts.push({ type:S_RB, i:rbPos, cells, kind:kk }); seed.bonus = 150;
      } else if(rbPos >= 0){
        const kk = other.k, cells = [rbPos];
        E.b.forEach((t, i) => { if(t.k === kk && i !== rbPos) cells.push(i); });
        if(isBlast(other)){
          let n = 0;
          cells.forEach(i => { if(i === rbPos) return; const t = E.b[i]; if(!t.s){ t.s = other.s === S_BOMB ? S_BOMB : (n++ % 2 ? S_V : S_H); seed.converted.push({ id:t.id, s:t.s }); } });
          seed.clear = cells; seed.activated = [rbPos]; seed.acts.push({ type:S_RB, i:rbPos, cells, kind:kk }); seed.bonus = 150;
        } else { seed.clear = cells; seed.activated = [rbPos]; seed.acts.push({ type:S_RB, i:rbPos, cells, kind:kk }); seed.bonus = 100; }
      } else {
        const r = Math.floor(b2 / N), c = b2 % N, set = new Set();
        const both = [ta.s, tb.s].sort();
        if(both[1] === S_STAR){
          /* 별사탕 조합: 별사탕+별사탕 = 두 칸의 대각선 끝까지, +폭탄 = 반지름 3 X + 가운데 3×3, +줄 폭탄 = 대각선 끝까지 + 그 줄 */
          if(both[0] === S_STAR){ diagX(a, N).forEach(x => set.add(x)); diagX(b2, N).forEach(x => set.add(x)); seed.acts.push({ type:S_STAR, i:a, cells:[], len:N }, { type:S_STAR, i:b2, cells:[...set], len:N }); }
          else if(both[0] === S_BOMB){ diagX(b2, 3).forEach(x => set.add(x)); area(S_BOMB, b2).forEach(x => set.add(x)); seed.acts.push({ type:S_STAR, i:b2, cells:[...set], len:3 }, { type:S_BOMB, i:b2, cells:[] }); }
          else { diagX(b2, N).forEach(x => set.add(x)); area(both[0], b2).forEach(x => set.add(x)); seed.acts.push({ type:S_STAR, i:b2, cells:[...set], len:N }, { type:both[0], i:b2, cells:[] }); }
        }
        else if(both[0] === S_BOMB){ for(let y = r - 2; y <= r + 2; y++) for(let x = c - 2; x <= c + 2; x++) if(y >= 0 && y < N && x >= 0 && x < N) set.add(idx(y, x)); seed.acts.push({ type:S_BOMB, i:b2, cells:[...set], big:2 }); }
        else if(both[1] === S_BOMB){ for(let d = -1; d <= 1; d++){ area(S_H, idx(Math.max(0, Math.min(N - 1, r + d)), c)).forEach(x => set.add(x)); area(S_V, idx(r, Math.max(0, Math.min(N - 1, c + d)))).forEach(x => set.add(x)); } seed.acts.push({ type:S_H, i:b2, cells:[...set], wide:true }, { type:S_V, i:b2, cells:[], wide:true }); }
        else { area(S_H, b2).forEach(x => set.add(x)); area(S_V, b2).forEach(x => set.add(x)); seed.acts.push({ type:S_H, i:b2, cells:[] }, { type:S_V, i:b2, cells:[] }); }
        seed.clear = [...set]; seed.activated = [a, b2]; seed.bonus = 120;
      }
      steps.push(step(E, [], seed, 1, null));
    } else if(ta.s === S_STAR || tb.s === S_STAR){
      const sp = ta.s === S_STAR ? b2 : a;   /* 바꾼 뒤 별사탕이 있는 칸 */
      steps.push(step(E, findGroups(E.b), { clear:[sp], acts:[], activated:[], converted:[], bonus:0 }, 1, [b2, a]));
    } else {
      steps.push(step(E, findGroups(E.b), null, 1, [b2, a]));
    }
    while(!maxSteps || steps.length < maxSteps){
      const g = findGroups(E.b); if(!g.length) break;
      steps.push(step(E, g, null, steps.length + 1, null));
    }
    E.moves++; E.maxCombo = Math.max(E.maxCombo, steps.length);
    if(E.movesLeft != null) E.movesLeft--;
    return { ok:true, steps };
  }
  /* 아이템: 이동을 쓰지 않고 칸들을 터뜨린다. types = 연출 종류 하나 또는 여러 개(십자 폭죽 = 가로 + 세로) */
  function blastCells(E, cells, types, at){
    const steps = [], acts = [].concat(types).map((type, n) => ({ type, i:at, cells:n ? [] : cells.slice(), item:true }));
    steps.push(step(E, [], { clear:cells.slice(), acts, activated:[], converted:[], bonus:0 }, 1, null));
    for(;;){ const g = findGroups(E.b); if(!g.length) break; steps.push(step(E, g, null, steps.length + 1, null)); }
    E.maxCombo = Math.max(E.maxCombo, steps.length);
    return { ok:true, steps };
  }
  /* 아이템 칸 계산: 뿅망치 1칸 · 십자 폭죽 가로+세로 · 동물 피리 그 동물 전부 */
  function itemCells(E, key, i){
    const r = Math.floor(i / N), c = i % N;
    if(key === 'ham') return [i];
    if(key === 'cross'){ const s = new Set(); for(let x = 0; x < N; x++){ s.add(idx(r, x)); s.add(idx(x, c)); } return [...s]; }
    if(key === 'flute'){ const t = E.b[i]; if(!t || t.s === S_BOX || t.s === S_RB || t.s === S_STAR || t.k < 0) return null; const out = []; E.b.forEach((u, j) => { if(u && u.k === t.k && u.s !== S_BOX && u.s !== S_RB) out.push(j); }); return out; }
    return null;
  }
  /* 바꿔 장갑: 이웃한 두 칸을 이동 없이 바꾼다. 맞춰지면(특수 동물 포함) 보통 수처럼 터지고, 아니면 자리만 바뀐다 */
  function gloveSwap(E, a, b2){
    const ta = E.b[a], tb = E.b[b2];
    if(!movable(ta) || !movable(tb) || Math.abs(Math.floor(a / N) - Math.floor(b2 / N)) + Math.abs(a % N - b2 % N) !== 1) return { ok:false };
    if(swapValid(E, a, b2)){ const mv = E.moves, ml = E.movesLeft, r = move(E, a, b2); E.moves = mv; E.movesLeft = ml; return { ok:true, steps:r.steps }; }
    E.b[a] = tb; E.b[b2] = ta;
    return { ok:true, steps:[] };
  }
  /* 목표 */
  const goalLeft = E => E.goals ? E.goals.reduce((s, g) => s + Math.max(0, g.n - (g.t === 'k' ? (E.got.k[g.k] || 0) : E.got[g.t])), 0) : 0;
  const goalDone = E => !!E.goals && goalLeft(E) === 0;
  const goalVal = E => E.goals ? E.goals.reduce((s, g) => s + Math.min(g.n, g.t === 'k' ? (E.got.k[g.k] || 0) : E.got[g.t]) * (g.t === 'k' ? 1 : 3), 0) : 0;
  function shuffleBoard(E){
    const pos = []; E.b.forEach((t, i) => { if(movable(t)) pos.push(i); });
    const tiles = pos.map(i => E.b[i]), rnd = E.rng || mb(E.moves * 7919 + E.uid);
    for(let t = 0; t < 200; t++){
      const arr = tiles.slice();
      for(let i = arr.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      pos.forEach((p, n) => { E.b[p] = arr[n]; });
      if(!findGroups(E.b).length && hasMove(E)){ E.shuffles++; return true; }
    }
    E.b.forEach((t, i) => { if(t && !t.s) t.k = (i + Math.floor(i / N)) % E.K; });   /* 극히 드문 경우: 계단 무늬로 다시 칠함 */
    E.shuffles++; return true;
  }
  /* 한 수의 연출 시간(ms) 추정 — 화면 연출과 같은 공식 */
  const FALL_MS = d => 60 + 110 * Math.sqrt(Math.max(1, d));
  function stepMs(st){
    let md = 0; st.falls.forEach(f => { md = Math.max(md, f.to - f.from); }); st.spawns.forEach(s => { md = Math.max(md, s.r - s.from); });
    const stag = st.acts.length ? 160 : 0;
    return 200 + stag + (st.converted.length ? 260 : 0) + FALL_MS(md) + 40;
  }
  /* 그리디: 바로 얻는 점수(첫 단계)가 가장 큰 수 */
  function bestMove(E){
    const ms = listMoves(E); let best = null, bv = -1;
    const g0 = goalVal(E);
    for(const m of ms){ const C = clone(E), r = move(C, m[0], m[1], 1); const v = r.ok ? r.steps[0].pts + (E.goals ? (goalVal(C) - g0) * 60 : 0) : -1; if(v > bv){ bv = v; best = m; } }
    return best;
  }
  /* 이동 n번 동안 그리디로 둔 결과(오늘의 문제·대전 목표를 맞출 때 씀) */
  function botRun(rng, K, moves){
    const E = makeEngine(rng, K); let n = 0;
    while(n < (moves || DAY_MOVES)){
      if(!hasMove(E)) shuffleBoard(E);
      const m = bestMove(E); if(!m) break;
      move(E, m[0], m[1]); n++;
    }
    return { pts:E.pts, moves:n, maxCombo:E.maxCombo };
  }

  /* ------------------------------------------------------------------
     난이도
  ------------------------------------------------------------------ */
  const r10 = v => Math.round(v / 10) * 10;
  /* 오늘의 문제·대전: 시간 제한 없이 이동 20번 안에 목표 점수. f = 자동 플레이어 평균의 몇 배인가
     (자동 플레이어 성공률 쉬움 약 90% · 보통 약 75% · 어려움 약 55%가 되게 맞춘 값) */
  const LV = { easy:{ kinds:5, f:.6 }, normal:{ kinds:6, f:.77 }, hard:{ kinds:6, f:.91 } };   /* 2026-09-30 별사탕 규칙으로 다시 맞춤 */
  function levelCfg(lv){ const L = LV[lv] || LV.normal; return { mode:'score', moves:DAY_MOVES, limit:0, kinds:L.kinds, target:r10(BOT[L.kinds] * L.f) }; }
  /* 대전 AI: 자동 플레이어처럼 이동 20번을 두고(점수는 목표의 0.75~1.55배), 사람 평균 속도(1번에 약 6초)로 진행 */
  function duelAi(rng){
    const cfg = levelCfg('normal'), t = cfg.target, r = .75 + rng() * .8, pts = r10(t * r), ok = pts >= t;
    const mc = 2 + Math.floor(rng() * 4), bonus = Math.max(0, Math.min(350, Math.round(350 * (pts - t) / (0.8 * t)))), extra = Math.min(150, 25 * (mc - 1));
    return { ok, T:DAY_MOVES * (5 + rng() * 2), pts, sc:ok ? 500 + bonus + extra : 0, fail:Math.min(.99, pts / t) };
  }
  /* ------------------------------------------------------------------
     솔로 스테이지(2026-09-29): 이동 횟수 + 목표 모으기(자체 난이도 곡선, 자동 플레이어로 맞춤)
     - 10스테이지 한 사이클: 1~4 오르막, 5 어려움, 6 쉬어가기, 7~9 오르막, 10 보스(아주 어려움)
     - 새 장애물은 약 5~10스테이지마다 하나씩(처음 두 판은 그 장애물만)
     - 이동 횟수 = 흔들리는 자동 플레이어가 그 판을 깨는 데 쓴 이동의 분위수(목표 승률) → MT_MOVES 표
  ------------------------------------------------------------------ */
  const MT_UNLOCK = { box:6, ice:11, lock:21, box2:26, ice2:31, box3:46 };
  const MT_Q = [0, .9, .85, .8, .75, .55, .88, .8, .75, .7, .45];   /* 사이클 자리별 목표 승률 */
  function stagePlan(n, D0){
    const far = n > 100 ? Math.floor((n - 51) / 50) : 0, T = far ? MT_D[51 + (n - 51) % 50] : MT_D[n];   /* 101 이후는 51~100 표를 돌려 쓰고 50판마다 3%씩 더 어렵게 */
    const D = D0 || ((Array.isArray(T) ? T[0] : T) || 1) * (1 + far * .03);   /* 난이도 배율: 목표 양 전체에 곱함(자동 플레이어로 맞춘 값). [배율, 이동] 이면 이동도 따로 */
    const cyc = (n - 1) % 10 + 1, hard = cyc === 5, boss = cyc === 10, R = mb(seedFrom('mtplan:' + n));
    const kinds = n < 4 ? 5 : 6;
    const has = k => n >= MT_UNLOCK[k];
    const intro = n === 6 || n === 7 ? 'box' : n === 11 || n === 12 ? 'ice' : n === 21 || n === 22 ? 'lock' : n === 26 ? 'box2' : n === 31 ? 'ice2' : n === 46 ? 'box3' : null;
    let types = [];
    if(intro) types = [intro.replace(/\d/, '')];
    else {
      const pool = ['k']; if(has('box')) pool.push('box', 'box'); if(has('ice')) pool.push('ice', 'ice'); if(has('lock')) pool.push('lock');
      const want = n < 6 ? 1 : (hard || boss) ? 2 : (R() < .45 ? 2 : 1);
      while(types.length < want && types.length < new Set(pool).size){ const t = pool[Math.floor(R() * pool.length)]; if(!types.includes(t)) types.push(t); }
    }
    const lay = { box:[], ice:[], lock:[] }, goals = [], used = new Set();
    const boost = (hard ? 1.25 : boss ? 1.45 : cyc === 6 ? .8 : 1);
    if(types.includes('box')){
      const hp = has('box3') && boss ? 3 : has('box2') && (hard || boss || R() < .45) ? 2 : 1;
      const cnt = Math.max(3, Math.min(14, Math.round((5 + n / 7) * boost * D)));
      const shapes = [
        () => { const r = 3 + Math.floor(R() * 2); for(const c of [3, 2, 4, 1, 5, 0, 6]) lay.box.push([idx(r, c), hp]); },
        () => { for(const r of [4, 5]) for(let c = 0; c < N; c++) if((r + c) % 2 === 0) lay.box.push([idx(r, c), hp]); },
        () => { for(const [r0, c0] of [[3, 0], [3, N - 2], [5, 0], [5, N - 2]]) for(let y = r0; y < r0 + 2; y++) for(let x = c0; x < c0 + 2; x++) lay.box.push([idx(y, x), hp]); },
        () => { for(let r = 2; r < N - 1; r++) lay.box.push([idx(r, 3), hp]); for(const c of [2, 4, 1, 5]) lay.box.push([idx(4, c), hp]); }
      ];
      shapes[Math.floor(R() * shapes.length)]();
      lay.box = lay.box.slice(0, cnt); lay.box.forEach(([i]) => used.add(i));
      goals.push({ t:'box', n:lay.box.length, hp });
    }
    if(types.includes('ice')){
      const lv = has('ice2') && (hard || boss || R() < .45) ? 2 : 1;
      const cnt = Math.max(4, Math.min(40, Math.round((8 + n / 3) * boost * D)));
      const cells = [], add = i => { if(!used.has(i) && !cells.includes(i)) cells.push(i); };
      const sh = Math.floor(R() * 4);
      /* 가운데·아래에서 두 번째 줄부터 채운다(맨 아래 구석은 늦게) */
      for(const r of [5, 4, 3, 6, 2, 1, 0]) for(const c of [3, 2, 4, 1, 5, 0, 6]){
        const ok = sh === 0 ? true : sh === 1 ? Math.abs(r - 3) + Math.abs(c - 3) <= 3 : sh === 2 ? (r + c) % 2 === 0 : (c <= 1 || c >= N - 2);
        if(ok) add(idx(r, c));
      }
      cells.slice(0, cnt).forEach(i => lay.ice.push([i, lv]));
      goals.push({ t:'ice', n:lay.ice.length, lv });
    }
    if(types.includes('lock')){
      const cnt = Math.max(3, Math.min(14, Math.round((5 + n / 12) * boost * D))), cand = [];
      for(let i = 0; i < N * N; i++){ const r = Math.floor(i / N), c = i % N; if(!used.has(i) && r >= 2 && r <= 5 && c >= 1 && c <= 5) cand.push(i); }
      while(lay.lock.length < cnt && cand.length) lay.lock.push(cand.splice(Math.floor(R() * cand.length), 1)[0]);
      goals.push({ t:'lock', n:lay.lock.length });
    }
    /* 동물 모으기는 인트로 판을 빼고 늘 들어가며, 난이도를 맞추는 조절 손잡이다(양 A = 자동 플레이어로 맞춘 값) */
    if(!intro){
      const nk = n >= 8 && R() < .5 ? 2 : 1, ks = [];
      while(ks.length < nk){ const k = Math.floor(R() * kinds); if(!ks.includes(k)) ks.push(k); }
      const per = Math.max(5, Math.round((12 + n * .6) * boost * D / (nk === 2 ? 1.5 : 1)));
      ks.forEach(k => goals.unshift({ t:'k', k, n:per }));
    }
    const moves = !D0 && Array.isArray(T) ? T[1] : Math.min(30, 16 + Math.floor(n / 4));   /* 설계 이동 수: 16 → 30 */
    return { n, cyc, hard, boss, intro:!!intro, kinds, goals, lay, moves, q:Math.max(boss ? .35 : .45, MT_Q[cyc] - Math.floor((n - 1) / 10) * .01) };
  }
  /* 판을 만들고 장애물을 놓는다 */
  function makeStage(rng, cfg){
    const E = makeEngine(rng, cfg.kinds);
    E.goals = cfg.goals; E.got = { k:{}, box:0, ice:0, lock:0 }; E.movesLeft = cfg.moves; E.ice = new Array(N * N).fill(0);
    const L = cfg.lay;
    L.box.forEach(([i, hp]) => { E.b[i] = { id:++E.uid, k:-2, s:S_BOX, hp }; });
    L.ice.forEach(([i, lv]) => { E.ice[i] = lv; });
    L.lock.forEach(i => { if(E.b[i] && !E.b[i].s) E.b[i].lk = 1; });
    for(let t = 0; t < 40 && (!hasMove(E) || findGroups(E.b).length); t++) shuffleBoard(E);
    return E;
  }
  /* 흔들리는 자동 플레이어: 좋은 수 1~3위 중 하나(60/25/15%). 목표를 다 모을 때까지 쓴 이동 수 */
  function botMoves(rng, cfg, noise, cap){
    const E = makeStage(rng, Object.assign({}, cfg, { moves:999 })); let n = 0;
    while(!goalDone(E) && n < (cap || 120)){
      if(!hasMove(E)) shuffleBoard(E);
      const ms = listMoves(E); if(!ms.length) break;
      const g0 = goalVal(E);
      const sc = ms.map(m => { const C = clone(E), r = move(C, m[0], m[1], 1); return [r.ok ? r.steps[0].pts + (goalVal(C) - g0) * 60 : -1, m]; }).sort((a, b) => b[0] - a[0]);
      const x = noise(), pick = x < .6 ? 0 : x < .85 ? 1 : 2;
      const m = sc[Math.min(pick, sc.length - 1)][1];
      move(E, m[0], m[1]); n++;
    }
    return n;
  }
  function stageCfg(n){
    const p = stagePlan(n);
    return Object.assign(p, { mode:'moves', limit:0, target:0 });
  }


  /* ------------------------------------------------------------------
     그림
  ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     그림 v3 (디자인팀): 3D 비닐 장난감 질감. 평면 도형을 SVG 조명 필터(확산광+반사광)로 부풀려
     매끈한 광택·아래쪽 그늘을 만든다. 외곽선 없이 색 하나 + 실루엣으로 구분. 모두 직접 그린 오리지널.
     0 문어(빨강) 1 고래(파랑) 2 병아리(노랑) 3 개구리(초록) 4 부엉이(보라) 5 여우(주황) 6 판다(흰색)
     처음엔 SVG를 그대로 쓰고, 판을 그린 뒤 칸 크기의 2배 PNG로 한 번 구워 바꾼다(폰 성능).
  ------------------------------------------------------------------ */
  const { DEFS, EYE, GL, A } = TOY;
  const ANIM = ['octopus','whale','chick','frog','owl','fox','panda'].map(k => A[k]);
  const svgDoc = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${DEFS}</defs>${body}</svg>`;
  const toURL = src => "url('" + src + "')";
  const svgSrc = body => 'data:image/svg+xml,' + encodeURIComponent(svgDoc(body)).replace(/'/g, '%27');
  const SRC = {}, IMG = {};
  const RB_BODY = `<ellipse cx="50" cy="90" rx="26" ry="5.5" fill="url(#gs)"/><defs><clipPath id="rc"><path d="M50 8l11.5 24 26 3.6-19 18.2 4.8 26L50 67.2 26.7 79.8l4.8-26-19-18.2 26-3.6z"/></clipPath></defs>
    <g filter="url(#pb)"><g clip-path="url(#rc)"><rect width="100" height="18" fill="#FF3B55"/><rect y="18" width="100" height="13" fill="#FF9A1F"/><rect y="31" width="100" height="12" fill="#FFD21A"/><rect y="43" width="100" height="12" fill="#2EC04A"/><rect y="55" width="100" height="12" fill="#2A8CFF"/><rect y="67" width="100" height="20" fill="#9447F0"/></g></g>
    ${GL(40, 26, 10, 5, -35)}${EYE(42, 46, 4.6)}${EYE(58, 46, 4.6)}<path d="M46 54q4 4 8 0" fill="none" stroke="#3A1E00" stroke-width="2.4" stroke-linecap="round"/>`;
  const ARW_BODY = `<g filter="url(#pm)"><path d="M4 50l17-15v9h58v-9l17 15-17 15v-9H21v9z" fill="#FFC400"/></g>`;
  const BOMB_BODY = `<g filter="url(#pm)"><path d="M58 38l9-10" stroke="#8A6A3A" stroke-width="5" stroke-linecap="round"/></g><g filter="url(#pb)"><circle cx="45" cy="60" r="27" fill="#3B3F5C"/></g>${GL(36, 49, 9, 5)}<g filter="url(#ps)"><path d="M69 18l3 6 7 1-5 5 1 7-6-4-6 3 1-7-5-5 7-1z" fill="#FFB000"/></g>`;
  ['rb', 'arw', 'bomb'].forEach((n, i) => SRC[n] = svgSrc([RB_BODY, ARW_BODY, BOMB_BODY][i]));
  /* 별사탕(2×2) · 나무 상자(1~3겹) · 사슬 · 아이템 — 같은 비닐 장난감 질감, 직접 그린 오리지널 */
  /* 별사탕: 뿔이 짧고 통통한 여섯 뿔 별사탕(분홍) + 반짝이 알갱이. 대각선 X로 터지는 것을 모서리 반짝이로 암시 */
  const STAR_PTS = [...Array(12)].map((_, k) => { const a = k * Math.PI / 6 - Math.PI / 2, R = k % 2 ? 22 : 36; return (50 + Math.cos(a) * R).toFixed(1) + ' ' + (53 + Math.sin(a) * R).toFixed(1); }).join(' ');
  const SPK = (x, y, r, c) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z" fill="${c}"/>`;
  SRC.star = svgSrc(`<ellipse cx="50" cy="92" rx="27" ry="5" fill="url(#gs)"/>
    <g filter="url(#pb)"><polygon points="${STAR_PTS}" fill="#FF6FB1" stroke="#FF6FB1" stroke-width="13" stroke-linejoin="round"/></g>
    <g filter="url(#pm)"><circle cx="50" cy="53" r="15" fill="#FFA8D2"/></g>
    <g filter="url(#ps)"><circle cx="43" cy="47" r="3.8" fill="#FFE45C"/><circle cx="58" cy="58" r="3.4" fill="#7FD6FF"/><circle cx="56" cy="45" r="2.8" fill="#fff"/><circle cx="44" cy="61" r="2.8" fill="#9BF07A"/></g>
    ${GL(38, 32, 10, 5, -30)}${SPK(12, 12, 9, '#FFE45C')}${SPK(89, 12, 7, '#fff')}${SPK(90, 90, 6, '#FFE45C')}`);
  const BOXB = hp => `<ellipse cx="50" cy="92" rx="36" ry="5" fill="url(#gs)"/>
    <g filter="url(#pb)"><rect x="8" y="10" width="84" height="80" rx="14" fill="${['#D9894A', '#C46F33', '#9E5424'][hp - 1]}"/></g>
    <g filter="url(#pm)"><rect x="18" y="20" width="64" height="60" rx="8" fill="${['#E9A565', '#D98A4A', '#B86A34'][hp - 1]}"/></g>
    <g filter="url(#ps)"><path d="M22 76L78 24" stroke="${['#B8672E', '#A25522', '#7E3F17'][hp - 1]}" stroke-width="9" stroke-linecap="round"/>${hp >= 2 ? '<path d="M22 24L78 76" stroke="#8F4A1D" stroke-width="9" stroke-linecap="round"/>' : ''}</g>
    ${hp >= 2 ? '<g filter="url(#ps)"><rect x="10" y="12" width="16" height="16" rx="4" fill="#9AA6B8"/><rect x="74" y="12" width="16" height="16" rx="4" fill="#9AA6B8"/><rect x="10" y="72" width="16" height="16" rx="4" fill="#9AA6B8"/><rect x="74" y="72" width="16" height="16" rx="4" fill="#9AA6B8"/></g>' : ''}
    ${hp >= 3 ? '<g filter="url(#pm)"><rect x="8" y="44" width="84" height="12" rx="5" fill="#6E7A8E"/></g>' : ''}${GL(30, 22, 16, 5, -8)}`;
  [1, 2, 3].forEach(h => SRC['box' + h] = svgSrc(BOXB(h)));
  SRC.lock = svgSrc(`<g filter="url(#pm)"><path d="M6 20L94 80M6 80L94 20" stroke="#8E97AC" stroke-width="11" stroke-linecap="round" stroke-dasharray="14 7"/></g>
    <g filter="url(#pm)"><path d="M38 50v-9a12 12 0 0 1 24 0v9" fill="none" stroke="#6E7A8E" stroke-width="7"/></g><g filter="url(#pb)"><rect x="30" y="47" width="40" height="32" rx="8" fill="#FFB020"/></g><g filter="url(#ps)"><circle cx="50" cy="60" r="4.5" fill="#6A3B00"/><rect x="48" y="62" width="4" height="9" rx="2" fill="#6A3B00"/></g>`);
  SRC.ham = svgSrc(`<ellipse cx="50" cy="90" rx="26" ry="5" fill="url(#gs)"/><g filter="url(#pm)"><rect x="44" y="40" width="12" height="48" rx="6" fill="#C98A4A" transform="rotate(35 50 64)"/></g><g filter="url(#pb)"><rect x="18" y="14" width="50" height="30" rx="10" fill="#FF5C7A" transform="rotate(35 43 29)"/></g>${GL(34, 20, 10, 5, 35)}`);
  /* 십자 폭죽: 가운데 폭죽 통 + 네 방향 화살 불꽃 */
  SRC.cross = svgSrc(`<ellipse cx="50" cy="91" rx="24" ry="5" fill="url(#gs)"/>
    <g filter="url(#pm)"><path d="M4 50l13-11v6h66v-6l13 11-13 11v-6H17v6zM50 4l11 13h-6v66h6L50 96 39 83h6V17h-6z" fill="#FFC928"/></g>
    <g filter="url(#pb)"><rect x="33" y="31" width="34" height="42" rx="10" fill="#FF3B55"/></g>
    <g filter="url(#ps)"><rect x="34" y="43" width="32" height="6" rx="2" fill="#FFE9A0"/><rect x="34" y="57" width="32" height="6" rx="2" fill="#FFE9A0"/></g>${GL(42, 38, 5, 9, 0)}`);
  /* 바꿔 장갑: 노란 장갑 + 파란 맞바꾸기 화살 */
  SRC.glove = svgSrc(`<ellipse cx="44" cy="92" rx="26" ry="5" fill="url(#gs)"/>
    <g filter="url(#pb)" fill="#FFD23F"><rect x="20" y="42" width="46" height="40" rx="16"/><rect x="22" y="20" width="13" height="34" rx="6.5"/><rect x="36" y="14" width="13" height="38" rx="6.5"/><rect x="50" y="20" width="13" height="34" rx="6.5"/><rect x="6" y="50" width="26" height="13" rx="6.5" transform="rotate(-35 19 56)"/></g>
    <g filter="url(#pm)"><rect x="22" y="76" width="42" height="14" rx="6" fill="#FF8A1F"/></g>${GL(30, 50, 7, 11, 0)}
    <g filter="url(#ps)" fill="none" stroke="#2E8FE8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M70 30h22l-7-7"/><path d="M92 46H70l7 7"/></g>`);
  /* 동물 피리: 보라 피리 + 분홍 음표 */
  SRC.flute = svgSrc(`<ellipse cx="46" cy="91" rx="26" ry="5" fill="url(#gs)"/>
    <g filter="url(#pb)"><rect x="37" y="14" width="18" height="78" rx="9" fill="#A57BFF" transform="rotate(38 46 53)"/></g>
    <g filter="url(#pm)"><rect x="37" y="14" width="18" height="16" rx="8" fill="#6C4CC4" transform="rotate(38 46 53)"/></g>
    <g filter="url(#ps)" fill="#4A2C9E"><circle cx="41.5" cy="59" r="3.4"/><circle cx="48" cy="50.5" r="3.4"/><circle cx="54.5" cy="42" r="3.4"/><circle cx="61" cy="33.5" r="3.4"/></g>${GL(40, 58, 4, 14, 38)}
    <g filter="url(#ps)"><path d="M78 10v24" stroke="#FF5C8A" stroke-width="5" stroke-linecap="round"/><path d="M78 10l12 5v8l-12-5z" fill="#FF5C8A"/><ellipse cx="73" cy="35" rx="7" ry="5.5" fill="#FF5C8A" transform="rotate(-20 73 35)"/><path d="M18 18v14" stroke="#FFB020" stroke-width="4" stroke-linecap="round"/><ellipse cx="14.5" cy="33" rx="5" ry="4" fill="#FFB020" transform="rotate(-20 14.5 33)"/></g>`);
  const IK = k => IMG[k] || toURL(SRC[k]);
  ANIM.forEach((f, k) => SRC[k] = svgSrc(f()));
  const img = k => IMG[k] || toURL(SRC[k]);
  let RB_IMG = toURL(SRC.rb), ARW_IMG = toURL(SRC.arw), BOMB_IMG = toURL(SRC.bomb);
  /* 칸 크기에 맞춰 PNG로 한 번 굽기 */
  let bakedAt = 0;
  function bake(px, done){
    if(bakedAt >= px) return; bakedAt = px;
    const keys = Object.keys(SRC); let left = keys.length;
    keys.forEach(key => {
      const im = new Image();
      im.onload = () => {
        try{ const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(im, 0, 0, px, px); IMG[key] = toURL(c.toDataURL('image/png')); }catch(_){}
        if(--left === 0){ RB_IMG = IMG.rb || RB_IMG; ARW_IMG = IMG.arw || ARW_IMG; BOMB_IMG = IMG.bomb || BOMB_IMG; done && done(); }
      };
      im.onerror = () => { if(--left === 0) done && done(); };
      im.src = SRC[key];
    });
  }
  function tileInner(t){
    if(t.s === S_BOX) return `<div class="mt-in bx"><i class="mt-img" style="background-image:${IK('box' + Math.max(1, Math.min(3, t.hp)))}"></i></div>`;
    if(t.s === S_STAR) return `<div class="mt-in sc"><i class="mt-img" style="background-image:${IK('star')}"></i></div>`;
    if(t.lk) return tileInner0(t) .replace(/<\/div>$/, `<i class="mt-lock" style="background-image:${IK('lock')}"></i></div>`);
    return tileInner0(t);
  }
  function tileInner0(t){
    if(t.s === S_RB) return `<div class="mt-in rb"><i class="mt-rbg"></i><i class="mt-img" style="background-image:${RB_IMG}"></i></div>`;
    const sp = t.s === S_H ? ' lh' : t.s === S_V ? ' lv' : t.s === S_BOMB ? ' bm' : '';
    return `<div class="mt-in k${t.k}${sp}">${t.s === S_BOMB ? '<i class="mt-ray"></i>' : ''}<i class="mt-img" style="background-image:${img(t.k)}"></i>${t.s === S_H || t.s === S_V ? `<i class="mt-arw" style="background-image:${ARW_IMG}"></i>` : ''}${t.s === S_BOMB ? `<i class="mt-bmb" style="background-image:${BOMB_IMG}"></i>` : ''}</div>`;
  }

  /* ------------------------------------------------------------------
     화면 상태·연출
  ------------------------------------------------------------------ */
  let M = null;   /* 이번 판의 화면 상태 (G.mt 와 같은 객체) */
  const $m = s => M && M.root ? M.root.querySelector(s) : null;
  const EASE = {
    lin:t => t, out:t => 1 - Math.pow(1 - t, 3), in:t => t * t, inout:t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    back:t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  function tw(v, to, dur, ease, delay){
    return new Promise(res => {
      M.tws = M.tws.filter(o => { if(o.v === v && Object.keys(o.to).some(k => k in to)){ o.res(); return false; } return true; });
      M.tws.push({ v, to, from:null, t0:M.clock + (delay || 0), dur:Math.max(1, dur), ease:EASE[ease || 'out'], res });
    });
  }
  const wait = ms => new Promise(res => M.waits.push({ at:M.clock + ms, res }));
  function applyView(v){
    v.el.style.transform = `translate3d(${v.x.toFixed(2)}px,${v.y.toFixed(2)}px,0) scale(${v.sx.toFixed(3)},${v.sy.toFixed(3)}) rotate(${v.rot.toFixed(1)}deg)`;
    v.el.style.opacity = v.o >= 1 ? '' : v.o.toFixed(3);
  }
  function mkView(t, r, c){
    const el = document.createElement('div'); el.className = 'mt-t'; el.innerHTML = tileInner(t); if(t.s === S_BOX) el.style.zIndex = 2;
    el.style.width = el.style.height = M.s + 'px';
    const v = { id:t.id, el, x:c * M.s, y:r * M.s, sx:1, sy:1, rot:0, o:1 };
    M.grid.appendChild(el); M.views.set(t.id, v); applyView(v); return v;
  }
  function restyle(v, t){ v.el.innerHTML = tileInner(t); }
  function layoutAll(){
    if(!M.grid) return;
    M.views.forEach(v => v.el.remove()); M.views.clear(); M.tws.forEach(o => o.res()); M.tws = [];
    M.E.b.forEach((t, i) => { if(t) mkView(t, Math.floor(i / N), i % N); });
    paintSel();
  }
  function frame(ts){
    if(!M || M.dead) return;
    G.raf = requestAnimationFrame(frame);
    const dt = Math.min(50, ts - (M.lt || ts)); M.lt = ts;
    if(!G.paused) M.clock += dt;
    const now = M.clock;
    if(M.tws.length){
      const keep = [];
      for(const o of M.tws){
        if(now < o.t0){ keep.push(o); continue; }
        if(!o.from){ o.from = {}; for(const k in o.to) o.from[k] = o.v[k]; }
        const p = Math.min(1, (now - o.t0) / o.dur), e = o.ease(p);
        for(const k in o.to) o.v[k] = o.from[k] + (o.to[k] - o.from[k]) * e;
        o.v.dirty = true;
        if(p >= 1) o.res(); else keep.push(o);
      }
      M.tws = keep;
      M.views.forEach(v => { if(v.dirty){ v.dirty = false; applyView(v); } });
    }
    if(M.waits.length){ const due = M.waits.filter(w => w.at <= now); if(due.length){ M.waits = M.waits.filter(w => w.at > now); due.forEach(w => w.res()); } }
    if(!M.busy && !M.stop && !M.item && !G.over && !G.paused && !M.hint && now - M.last > 5000) showHint();
  }
  const cellXY = i => { const g = M.grid.getBoundingClientRect(), r = Math.floor(i / N), c = i % N; return { x:g.left + (c + .5) * M.s, y:g.top + (r + .5) * M.s }; };

  const isMoves = () => !!(G && G.cfg && G.cfg.mode === 'moves');   /* 솔로: 이동 횟수 + 목표 모으기 */
  const gGot = (E, g) => g.t === 'k' ? (E.got.k[g.k] || 0) : E.got[g.t];
  const goalIcon = g => g.t === 'k' ? img(g.k) : g.t === 'box' ? IK('box' + (g.hp || 1)) : g.t === 'lock' ? IK('lock') : 'none';
  function hudMoves(){
    const E = M.E;
    E.goals.forEach((g, n) => {
      const el = $m('#mtG' + n); if(!el) return;
      const left = Math.max(0, g.n - gGot(E, g)), b = el.querySelector('b');
      if(b.textContent !== String(left)){ b.textContent = left; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      if(left === 0 && !el.classList.contains('done')){ el.classList.add('done'); if(M.ready){ sfx('star', { i:2 }); fxPop(el, 'gold'); } }
    });
    const mv = $m('#mtMv'); if(mv && mv.textContent !== String(E.movesLeft)){ mv.textContent = E.movesLeft; mv.classList.remove('bump'); void mv.offsetWidth; mv.classList.add('bump'); }
    M.root.classList.toggle('warn', E.movesLeft <= 3 && !goalDone(E));
  }
  function paintIce(){
    const cl = M.grid && M.grid.querySelector('.mt-cells'); if(!cl || !M.E.ice) return;
    [...cl.children].forEach((c, i) => { const v = M.E.ice[i]; c.className = v >= 2 ? 'ice2' : v === 1 ? 'ice1' : ''; });
  }
  function hud(){
    if(isMoves()){ hudMoves(); return; }
    const cfg = G.cfg, p = M.E.pts, el = $m('#mtPts');
    if(el && el.textContent !== fmt(p)){ el.textContent = fmt(p); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    const fill = $m('#mtProgF'); if(fill) fill.style.width = (Math.min(1, p / (1.6 * cfg.target)) * 100).toFixed(2) + '%';
    const marks = [1, 1.3, 1.6];
    marks.forEach((m, i) => {
      const mk = $m('#mtMk' + i); if(!mk) return;
      const on = p >= m * cfg.target;
      if(on && !mk.classList.contains('on')){
        mk.classList.add('on');
        if(M.ready){ sfx('star', { i:i + 1 }); fxPop(mk, 'gold'); fxBuzz(18); if(i === 0) banner('목표 달성!', 'goal'); }
      }
    });
    const g = $m('#mtGoal'); if(g) g.classList.toggle('done', p >= cfg.target);
    /* 남은 이동(시간 제한 없음). 마지막 3번은 경고 */
    const left = M.E.movesLeft, mv = $m('#mtMv');
    if(mv && mv.textContent !== String(left)){
      mv.textContent = left; mv.classList.remove('bump'); void mv.offsetWidth; mv.classList.add('bump');
      if(M.ready && left > 0 && left <= 3){ sfx('matchWarn', { hi:left === 1 }); fxBuzz(12); }
    }
    const f = M.tf; if(f) f.style.transform = `scaleX(${(Math.max(0, left) / cfg.moves).toFixed(4)})`;
    M.root.classList.toggle('warn', left > 0 && left <= 3);
  }
  function banner(text, cls){
    const b = document.createElement('div'); b.className = 'mt-banner ' + (cls || ''); b.innerHTML = `<b>${text}</b>`;
    M.panel.appendChild(b); setTimeout(() => b.remove(), 1500);
  }
  function showCombo(k){
    const c = $m('#mtCombo'); if(!c) return;
    const word = k >= 6 ? '대폭발!' : k >= 4 ? '굉장해요!' : '콤보!';
    c.innerHTML = `<b>${k}</b><span>${word}</span>`; c.className = 'mt-combo' + (k >= 4 ? ' big' : '');
    void c.offsetWidth; c.classList.add('on');
    sfx('matchCombo', { n:k });
    if(k >= 3) fxBuzz(10 + k * 4);
  }
  function paintSel(){
    M.views.forEach(v => v.el.classList.remove('sel', 'kc'));
    if(M.sel >= 0 && M.E.b[M.sel]){ const v = M.views.get(M.E.b[M.sel].id); if(v) v.el.classList.add('sel'); }
    if(M.kbd && M.kc >= 0 && M.E.b[M.kc]){ const v = M.views.get(M.E.b[M.kc].id); if(v) v.el.classList.add('kc'); }
  }
  function showHint(){
    const m = bestMove(M.E); if(!m) return;
    M.hint = m;
    m.forEach((i, j) => { const v = M.views.get(M.E.b[i].id); if(v){ v.el.classList.add('hint'); v.el.style.setProperty('--hx', (j ? -1 : 1) * (m[1] - m[0] === 1 ? 1 : 0) + ''); v.el.style.setProperty('--hy', (j ? -1 : 1) * (m[1] - m[0] === 1 ? 0 : 1) + ''); } });
  }
  function clearHint(){
    M.hint = null; M.views.forEach(v => v.el.classList.remove('hint'));
  }

  function fxAct(act){
    const bd = M.panel, o = cellXY(act.i), r = Math.floor(act.i / N), c = act.i % N;
    if(act.type === S_STAR){
      /* 별사탕: 두 대각선으로 반짝이는 빛줄기(X자). len = 네 방향 칸 수 */
      const len = act.len || 2, svgNS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(svgNS, 'svg');
      sv.setAttribute('class', 'mt-diag'); sv.setAttribute('viewBox', `0 0 ${N * M.s} ${N * M.s}`);
      const cx = (c + .5) * M.s, cy = (r + .5) * M.s;
      [[-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(([dy, dx], n) => {
        let d = 0; while(d < len && r + dy * (d + 1) >= 0 && r + dy * (d + 1) < N && c + dx * (d + 1) >= 0 && c + dx * (d + 1) < N) d++;
        const ln = document.createElementNS(svgNS, 'line'); ln.setAttribute('x1', cx); ln.setAttribute('y1', cy); ln.setAttribute('x2', cx + dx * (d + .45) * M.s); ln.setAttribute('y2', cy + dy * (d + .45) * M.s);
        ln.style.stroke = n % 2 ? '#FFE45C' : '#FFB2D8'; sv.appendChild(ln);
        const q = cellXY(act.i); fxBurst(q.x + dx * d * M.s, q.y + dy * d * M.s, ['#FFE45C', '#FF7EB8', '#fff'], 5, { speed:160, size:4, kinds:['star','spark'], up:30, dur:.5 });
      });
      M.grid.appendChild(sv); setTimeout(() => sv.remove(), 560);
      sfx('matchStar', { pan:panX(o.x) }); fxBuzz(22);
      fxRing(o.x, o.y, '#FFE27A', M.s * (1.4 + len * .2), .4, 8); fxShake(bd, 3);
      return;
    }
    if(act.type === A_FLUTE){
      /* 동물 피리: 고른 칸에서 음표가 퍼지고 같은 동물마다 작은 고리 */
      sfx('matchFlute'); fxBuzz([15, 25, 15]);
      fxRing(o.x, o.y, '#C9B2FF', M.s * 2.2, .5, 9);
      fxBurst(o.x, o.y, ['#A57BFF', '#FF5C8A', '#FFE45C', '#fff'], 18, { speed:260, size:5, kinds:['star','dot'], up:60, glow:true, dur:.8 });
      act.cells.forEach((j, n) => { if(j === act.i) return; setTimeout(() => { if(!M || M.dead) return; const q = cellXY(j); fxRing(q.x, q.y, '#FFFFFF', M.s * 1.1, .3, 5); }, 40 + n * 22); });
      return;
    }
    if(act.type === A_HAM){
      sfx('matchBomb', { pan:panX(o.x), big:1 }); fxBuzz(30);
      fxRing(o.x, o.y, '#FFFFFF', M.s * 1.6, .35, 10); fxBurst(o.x, o.y, ['#FF5C7A', '#FFE27A', '#fff'], 14, { speed:240, size:5, kinds:['star','dot'], up:60, dur:.6 }); fxShake(bd, 5);
      return;
    }
    if(act.type === S_H || act.type === S_V){
      const rows = act.wide ? [-1, 0, 1] : [0];
      rows.forEach(d => {
        const beam = document.createElement('div'); beam.className = 'mt-beam ' + (act.type === S_H ? 'h' : 'v');
        if(act.type === S_H){ const rr = r + d; if(rr < 0 || rr >= N) return; beam.style.top = (rr * M.s) + 'px'; beam.style.height = M.s + 'px'; }
        else { const cc = c + d; if(cc < 0 || cc >= N) return; beam.style.left = (cc * M.s) + 'px'; beam.style.width = M.s + 'px'; }
        M.grid.appendChild(beam); setTimeout(() => beam.remove(), 520);
      });
      sfx('matchLine', { pan:panX(o.x) }); fxRing(o.x, o.y, '#FFFFFF', M.s * 1.6, .35, 6); fxShake(bd, 3);
    } else if(act.type === S_BOMB){
      const big = act.big || 1;
      sfx('matchBomb', { pan:panX(o.x), big }); fxBuzz(big > 1 ? [40, 30, 60] : 35);
      fxRing(o.x, o.y, '#FFE27A', M.s * (1.8 + big), .5, 12); fxRing(o.x, o.y, '#FF7A3D', M.s * (1.2 + big), .38, 8);
      fxBurst(o.x, o.y, ['#FFE27A', '#FF9A1F', '#FFFFFF', '#FF5C8A'], 22 * big, { speed:360 * big, size:6, kinds:['star','spark','dot'], up:80, glow:true, dur:.8 });
      fxShake(bd, 7 + big * 3);
      /* 이펙트 v2: 폭발 뒤 피어오르는 연기, 큰 폭발은 화면이 따뜻하게 번쩍 */
      try{ fxEmit(o.x, o.y, { quantity:6 + big * 3, speed:{ min:30, max:90 * big }, lifespan:{ min:600, max:1000 }, kind:'smoke', tint:['#FFD9A8', '#FFE9C9', '#FFFFFF'], scale:{ start:M.s * .25, end:M.s * .7, ease:'cubic.out' }, alpha:{ start:.5, end:0 }, gravityY:-40, drag:1.5 }); if(big > 1) fxFlash('#FFD27A', .2, 260); }catch(_){}
      const fl = document.createElement('div'); fl.className = 'mt-flash'; M.grid.appendChild(fl); setTimeout(() => fl.remove(), 380);
    } else {
      sfx('matchRainbow'); fxBuzz([20, 30, 20]);
      const svgNS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(svgNS, 'svg');
      sv.setAttribute('class', 'mt-zap'); sv.setAttribute('viewBox', `0 0 ${N * M.s} ${N * M.s}`);
      const ox = (c + .5) * M.s, oy = (r + .5) * M.s;
      act.cells.forEach((j, n) => { if(j === act.i) return; const x = (j % N + .5) * M.s, y = (Math.floor(j / N) + .5) * M.s;
        const ln = document.createElementNS(svgNS, 'line'); ln.setAttribute('x1', ox); ln.setAttribute('y1', oy); ln.setAttribute('x2', x); ln.setAttribute('y2', y);
        ln.style.stroke = ['#FF5C8A','#FFB020','#FFE45C','#5BE08A','#43A6FF','#A57BFF'][n % 6]; ln.style.animationDelay = (n * 18) + 'ms'; sv.appendChild(ln); });
      M.grid.appendChild(sv); setTimeout(() => sv.remove(), 700);
      fxRing(o.x, o.y, '#FFFFFF', M.s * 4, .6, 10);
      fxBurst(o.x, o.y, ['#FF5C8A','#FFB020','#FFE45C','#5BE08A','#43A6FF','#A57BFF'], 30, { speed:320, size:5.5, kinds:['star','dot'], up:60, glow:true, dur:.9 });
      fxShake(bd, 5);
      /* 이펙트 v2: 무지개 번개가 닿은 칸마다 반짝 */
      try{ act.cells.forEach((j, n) => { if(j === act.i) return; const q = cellXY(j); fxEmit(q.x, q.y, { quantity:2, speed:{ min:10, max:60 }, lifespan:{ min:400, max:600 }, kind:'twinkle', tint:['#FFFFFF', ['#FF5C8A','#FFB020','#FFE45C','#5BE08A','#43A6FF','#A57BFF'][n % 6]], scale:{ start:4, end:0 }, glow:true, delay:n * 18 + 60 }); }); }catch(_){}
    }
  }
  function popView(v, delay, k, s, many){
    return tw(v, { sx:1.28, sy:1.28 }, 70, 'out', delay).then(() => {
      v.el.classList.add('pop');
      const p = { x:0, y:0 }; const g = M.grid.getBoundingClientRect(); p.x = g.left + v.x + M.s / 2; p.y = g.top + v.y + M.s / 2;
      if(!FXR.reduce){ const col = k >= 0 ? [TCOL[k], TLIT[k], '#FFFFFF'] : ['#FFE45C', '#FF5C8A', '#43A6FF', '#fff'];
        fxBurst(p.x, p.y, col, many ? 4 : 9, { speed:many ? 190 : 230, size:many ? 4 : 5, kinds:['star','dot','spark'], up:70, dur:.6 }); }
      return tw(v, { sx:0, sy:0, o:0, rot:(Math.random() - .5) * 40 }, 150, 'in');
    }).then(() => { v.el.remove(); M.views.delete(v.id); });
  }
  async function playStep(st){
    const k = st.k;
    if(k >= 2) showCombo(k);
    if(st.converted.length){
      st.converted.forEach(cv => { const v = M.views.get(cv.id); if(v){ restyle(v, { k:st.acts[0].kind, s:cv.s }); tw(v, { sx:1.2, sy:1.2 }, 120, 'out').then(() => tw(v, { sx:1, sy:1 }, 120, 'back')); } });
      sfx('matchMake'); await wait(260);
    }
    st.acts.forEach(fxAct);
    const many = st.clears.length > 14;
    let maxD = 0;
    const actOf = new Map(); st.acts.forEach(a => a.cells.forEach(j => { if(!actOf.has(j)) actOf.set(j, a); }));
    const inG = new Set(); st.groups.forEach(g => g.cells.forEach(x => inG.add(x)));
    st.clears.forEach(cl => {
      const v = M.views.get(cl.id); if(!v) return;
      let d = 0;
      if(!inG.has(cl.i) && actOf.has(cl.i)){ const a = actOf.get(cl.i); d = Math.min(160, (Math.abs(Math.floor(a.i / N) - Math.floor(cl.i / N)) + Math.abs(a.i % N - cl.i % N)) * 26); }
      maxD = Math.max(maxD, d);
      popView(v, d, cl.k, cl.s, many);
    });
    const center = cells => { let x = 0, y = 0; cells.forEach(i => { const p = cellXY(i); x += p.x; y += p.y; }); return { x:x / cells.length, y:y / cells.length }; };
    let pan = 0;
    st.groups.forEach(g => { const p = center(g.cells); pan = panX(p.x); fxFloat(p.x, p.y, '+' + fmt(Math.round(g.pts * st.mult)), 'mtf' + (k >= 3 ? ' hot' : '')); });
    const extra = st.pts - st.groups.reduce((s, g) => s + Math.round(g.pts * st.mult), 0);
    if(st.acts.length && extra > 0){ const p = cellXY(st.acts[0].i); fxFloat(p.x, p.y - M.s * .4, '+' + fmt(extra), 'mtf big'); }
    if(st.groups.length) sfx('matchPop', { n:k, pan });
    fxBuzz(k >= 2 ? 16 : 10);
    await wait(215 + (st.acts.length ? 160 : 0));
    st.created.forEach(cr => {
      const v = M.views.get(cr.id); if(!v) return;
      restyle(v, { k:cr.k, s:cr.s }); v.sx = v.sy = .4; v.dirty = true; tw(v, { sx:1, sy:1 }, 260, 'back');
      const p = cellXY(cr.i); fxRing(p.x, p.y, cr.s === S_RB ? '#FFE45C' : '#FFFFFF', M.s * 1.3, .4, 7);
      fxBurst(p.x, p.y, ['#FFFFFF', '#FFE27A'], 10, { speed:200, size:4, kinds:['spark'], up:40, glow:true, dur:.6 });
      sfx('matchMake');
    });
    (st.boxHits || []).forEach(h => { const v = M.views.get(h.id); if(!v) return; restyle(v, { s:S_BOX, hp:h.hp, k:-2 }); tw(v, { sx:1.15, sy:.85, rot:(Math.random() - .5) * 14 }, 80, 'out').then(() => tw(v, { sx:1, sy:1, rot:0 }, 200, 'back'));
      const p = cellXY(h.i); fxBurst(p.x, p.y, ['#C46F33', '#E9A565', '#7E3F17'], 10, { speed:220, size:5, kinds:['dot','spark'], up:90, dur:.6 }); sfx('matchBad'); });
    (st.unlocks || []).forEach(u => { const v = M.views.get(u.id); const t = M.E.b.find(x => x && x.id === u.id); if(v && t) restyle(v, t); const p = cellXY(u.i); fxRing(p.x, p.y, '#B8C2D6', M.s * 1.3, .35, 6); fxBurst(p.x, p.y, ['#8E97AC', '#D9DEE8', '#FFB020'], 10, { speed:200, size:4, kinds:['spark','dot'], up:60, dur:.5 }); });
    if((st.iceHits || []).length){ paintIce(); st.iceHits.forEach(h => { const p = cellXY(h.i); fxBurst(p.x, p.y, ['#BFEFFF', '#FFFFFF', '#7FD6FF'], 6, { speed:160, size:3.5, kinds:['spark'], up:40, dur:.5 }); }); sfx('matchLine', { pan:0 }); }
    hud();
    let longest = 0;
    st.falls.forEach(f => { const v = M.views.get(f.id); if(!v) return; const d = f.to - f.from, ms = FALL_MS(d); longest = Math.max(longest, ms);
      tw(v, { y:f.to * M.s }, ms, 'in').then(() => land(v)); });
    st.spawns.forEach(s => { const v = mkView({ id:s.id, k:s.k, s:0 }, s.from, s.c); const d = s.r - s.from, ms = FALL_MS(d); longest = Math.max(longest, ms);
      tw(v, { y:s.r * M.s }, ms, 'in').then(() => land(v)); });
    await wait(longest + 40);
  }
  function land(v){ tw(v, { sx:1.1, sy:.88 }, 55, 'out').then(() => tw(v, { sx:1, sy:1 }, 150, 'back')); }

  async function tryMove(a, b){
    if(!M || M.busy || M.stop || G.over || G.paused) return;
    if(a < 0 || b < 0 || a >= N * N || b >= N * N) return;
    const ra = Math.floor(a / N), rb = Math.floor(b / N);
    if(Math.abs(ra - rb) + Math.abs(a % N - b % N) !== 1) return;
    clearHint(); M.sel = -1; paintSel();
    M.busy = true;
    const E = M.E, ta = E.b[a], tb = E.b[b], va = M.views.get(ta.id), vb = M.views.get(tb.id);
    const ax = va.x, ay = va.y, bx = vb.x, by = vb.y;
    const res = move(E, a, b);
    sfx('matchSwap');
    va.el.style.zIndex = 3;
    if(!res.ok){
      const mx = (bx - ax) * .42, my = (by - ay) * .42;
      tw(va, { x:ax + mx, y:ay + my }, 100, 'out'); await tw(vb, { x:bx - mx, y:by - my }, 100, 'out');
      sfx('matchBad'); fxBuzz(25);
      tw(va, { x:ax, y:ay }, 170, 'back'); await tw(vb, { x:bx, y:by }, 170, 'back');
      [va, vb].forEach(v => { v.el.classList.remove('no'); void v.el.offsetWidth; v.el.classList.add('no'); });
      va.el.style.zIndex = '';
      M.busy = false; M.last = M.clock;
      return;
    }
    tw(va, { x:bx, y:by }, 130, 'inout'); await tw(vb, { x:ax, y:ay }, 130, 'inout');
    va.el.style.zIndex = '';
    for(const st of res.steps) await playStep(st);
    if(res.steps.length >= 2) M.best = Math.max(M.best, res.steps.length);
    hud();
    if(isMoves() && await movesCheck()) return;
    if(!isMoves() && E.movesLeft <= 0){ M.stop = true; clearHint(); endRound(); return; }
    if(!hasMove(E) && !M.stop){ await doShuffle(); }
    M.busy = false; M.last = M.clock;
  }
  /* 솔로(이동 횟수): 목표를 다 모으면 성공 + 남은 이동 보너스, 이동이 끝나면 실패 */
  async function movesCheck(){
    const E = M.E;
    if(goalDone(E)){
      M.stop = true; M.leftAtWin = E.movesLeft; clearHint();
      banner('목표 완료!', 'goal'); sfx('win', { g:'match' }); fxBuzz([30, 50, 30]);
      await wait(900);
      const left = Math.min(6, E.movesLeft);
      if(left > 0){
        banner('남은 이동 ' + E.movesLeft + ' 보너스!', 'goal');
        const cand = []; E.b.forEach((t, i) => { if(t && !t.s && !t.lk && t.k >= 0) cand.push(i); });
        const pick = []; for(let n = 0; n < left && cand.length; n++) pick.push(cand.splice((n * 17 + E.uid) % cand.length, 1)[0]);
        pick.forEach((i, n) => { E.b[i].s = n % 2 ? S_V : S_H; const v = M.views.get(E.b[i].id); if(v){ restyle(v, E.b[i]); tw(v, { sx:1.3, sy:1.3 }, 120, 'out').then(() => tw(v, { sx:1, sy:1 }, 160, 'back')); } });
        sfx('matchMake'); await wait(420);
        E.pts += E.movesLeft * 100;
        const r = blastCells(E, pick, S_H, pick[0]);
        for(const st of r.steps) await playStep(st);
      }
      endMoves(true); return true;
    }
    if(E.movesLeft <= 0){ M.stop = true; clearHint(); endMoves(false); return true; }
    return false;
  }
  function endMoves(win){
    if(M.ended || G.over) return;
    M.ended = true; M.busy = true;
    banner(win ? '성공!' : '이동 끝!', win ? 'goal end' : 'end');
    sfx('matchEnd'); fxBuzz([30, 50, 30]);
    setTimeout(() => { if(G && !G.over && G.mt === M) finish(win); }, win ? 900 : 1300);
  }
  /* 아이템(솔로 전용, 이동을 쓰지 않음). 2026-09-30 개편: 십자 폭죽 · 바꿔 장갑 · 동물 피리 */
  const ITEMS = [
    { key:'ham', name:'뿅망치', desc:'한 칸(상자는 한 겹)', at:8, pick:'깰 칸을 골라요' },
    { key:'cross', name:'십자 폭죽', desc:'고른 칸의 가로·세로 한 줄씩', at:13, pick:'터뜨릴 칸을 골라요' },
    { key:'glove', name:'바꿔 장갑', desc:'이웃한 두 동물을 그냥 바꾸기', at:18, pick:'바꿀 두 칸을 차례로 눌러요' },
    { key:'flute', name:'동물 피리', desc:'고른 동물을 판에서 모두 모으기', at:23, pick:'모을 동물을 골라요' }
  ];
  const INV_KEY = 'hp:mtItems';
  /* 예전 아이템(가로·세로 화살 → 십자 폭죽, 요술 모자 → 동물 피리)을 한 번만 옮긴다 */
  function invMigrate(v){
    if(v.v >= 2) return false;
    const n = v.n || {}, got = v.got || {};
    const arrows = (n.row || 0) + (n.col || 0);
    if(got.row || got.col){ got.cross = 1; n.cross = (n.cross || 0) + arrows; }
    if(got.hat){ got.flute = 1; n.flute = (n.flute || 0) + (n.hat || 0); }
    ['row', 'col', 'hat'].forEach(k => { delete n[k]; delete got[k]; });
    v.n = n; v.got = got; v.v = 2;
    return true;
  }
  function inv(){
    const v = store.get(INV_KEY, null) || { n:{}, got:{}, v:2 };
    const top = Math.max(G.adv || 0, (typeof advProg === 'function' ? advProg('match').max : 1));
    let ch = invMigrate(v); const fresh = [];
    ITEMS.forEach(it => { if(top >= it.at && !v.got[it.key]){ v.got[it.key] = 1; v.n[it.key] = (v.n[it.key] || 0) + 3; ch = true; fresh.push(it); } });
    if(ch) store.set(INV_KEY, v);
    if(fresh.length && M && M.root && typeof toast === 'function') setTimeout(() => toast(fresh.length === 1 ? '새 아이템! ' + fresh[0].name + ' 3개를 받았어요' : '새 아이템 ' + fresh.length + '가지를 3개씩 받았어요'), 700);
    return v;
  }
  function paintDock(){
    const d = $m('#mtItems'); if(!d) return;
    const v = inv();
    d.innerHTML = ITEMS.map(it => { const open = !!v.got[it.key], n = v.n[it.key] || 0;
      return `<button class="mt-bst it${open ? '' : ' lk'}${M.item === it.key ? ' on' : ''}" data-it="${it.key}" ${open && n > 0 ? '' : 'disabled'} aria-label="${it.name}: ${it.desc}${open ? ', ' + n + '개' : ', 스테이지 ' + it.at + '에서 열려요'}">
        <span class="mt-bi"><i style="background-image:${IK(it.key)}"></i></span><em>${it.name}</em>${open ? `<b class="mt-cnt num">${n}</b>` : `<b class="mt-cnt lk">${it.at}</b>`}</button>`; }).join('');
    d.querySelectorAll('button[data-it]').forEach(b => b.onclick = () => {
      if(M.busy || M.stop || G.over) return;
      const k = b.dataset.it;
      M.item = M.item === k ? null : k; M.gsel = -1; M.sel = -1; clearHint(); paintDock(); paintSel();
      if(M.item) banner(ITEMS.find(x => x.key === k).pick, 'mix');
    });
  }
  /* 아이템 칸 누르기: 장갑은 두 칸(두 번째는 이웃 칸), 나머지는 한 칸 */
  function itemTap(i){
    if(M.item === 'glove'){
      const a = M.gsel;
      if(a >= 0 && a !== i && Math.abs(Math.floor(a / N) - Math.floor(i / N)) + Math.abs(a % N - i % N) === 1 && movable(M.E.b[i])){ M.gsel = -1; M.sel = -1; useItem('glove', a, i); return; }
      if(!movable(M.E.b[i])){ sfx('matchBad'); return; }
      M.gsel = a === i ? -1 : i; M.sel = M.gsel; paintSel(); sfx('sSel'); return;
    }
    useItem(M.item, i);
  }
  async function useItem(key, i, j){
    const E = M.E, v = inv(); if(!(v.n[key] > 0)) return;
    let cells = null;
    if(key !== 'glove'){ cells = itemCells(E, key, i); if(!cells){ sfx('matchBad'); banner('동물을 골라 주세요', 'mix'); return; } }
    v.n[key]--; store.set(INV_KEY, v); M.item = null; M.gsel = -1; paintDock();
    M.busy = true; clearHint(); M.sel = -1; paintSel();
    if(key === 'glove'){
      const ta = E.b[i], tb = E.b[j], va = M.views.get(ta.id), vb = M.views.get(tb.id), ax = va.x, ay = va.y;
      const res = gloveSwap(E, i, j);
      sfx('matchSwap'); va.el.style.zIndex = 3;
      const p = cellXY(i), q = cellXY(j); fxBurst((p.x + q.x) / 2, (p.y + q.y) / 2, ['#FFD23F', '#2E8FE8', '#fff'], 10, { speed:200, size:4.5, kinds:['star','spark'], up:40, dur:.5 });
      tw(va, { x:vb.x, y:vb.y }, 180, 'inout'); await tw(vb, { x:ax, y:ay }, 180, 'inout');
      va.el.style.zIndex = '';
      for(const st of res.steps) await playStep(st);
      if(res.steps.length >= 2) M.best = Math.max(M.best, res.steps.length);
    } else {
      const res = blastCells(E, cells, key === 'ham' ? A_HAM : key === 'cross' ? [S_H, S_V] : A_FLUTE, i);
      for(const st of res.steps) await playStep(st);
    }
    hud();
    if(await movesCheck()) return;
    if(!hasMove(E)) await doShuffle();
    M.busy = false; M.last = M.clock;
  }
  async function doShuffle(){
    banner('섞을게요!', 'mix'); sfx('matchShuffle');
    await wait(450);
    shuffleBoard(M.E);
    const pr = [];
    M.E.b.forEach((t, i) => { const v = M.views.get(t.id); if(!v) return; restyle(v, t);
      pr.push(tw(v, { x:(i % N) * M.s, y:Math.floor(i / N) * M.s, rot:360 * (i % 2 ? 1 : -1) }, 480, 'inout').then(() => { v.rot = 0; v.dirty = true; })); });
    M.views.forEach(v => { tw(v, { sx:.6, sy:.6 }, 200, 'out').then(() => tw(v, { sx:1, sy:1 }, 280, 'back')); });
    await Promise.all(pr); await wait(80);
  }
  function endRound(){
    if(M.ended || G.over) return;
    M.ended = true; M.busy = true; clearHint();
    const win = M.E.pts >= G.cfg.target;
    banner(win ? '이동 끝! 성공!' : '이동 끝!', win ? 'goal end' : 'end');
    sfx('matchEnd'); fxBuzz([30, 50, 30]);
    if(win) setTimeout(() => sfx('win', { g:'match' }), 350);
    setTimeout(() => { if(G && !G.over && G.mt === M) finish(win); }, 1100);
  }

  /* ------------------------------------------------------------------
     입력: 밀기(스와이프) · 탭-탭 · 키보드
  ------------------------------------------------------------------ */
  function bindInput(){
    const gr = M.grid;
    const cellAt = e => { const g = gr.getBoundingClientRect(), c = Math.floor((e.clientX - g.left) / M.s), r = Math.floor((e.clientY - g.top) / M.s); return r >= 0 && r < N && c >= 0 && c < N ? idx(r, c) : -1; };
    let st = null;
    gr.onpointerdown = e => {
      if(G.over || G.paused || M.stop) return;
      const i = cellAt(e); if(i < 0) return;
      if(M.item){ e.preventDefault(); if(!M.busy) itemTap(i); st = null; return; }
      try{ gr.setPointerCapture(e.pointerId); }catch(_){}
      st = { i, x:e.clientX, y:e.clientY, done:false }; M.kbd = false; e.preventDefault();
      if(M.hint){ clearHint(); } M.last = M.clock;
    };
    gr.onpointermove = e => {
      if(!st || st.done) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if(Math.max(Math.abs(dx), Math.abs(dy)) < M.s * .32) return;
      st.done = true;
      const r = Math.floor(st.i / N), c = st.i % N;
      let t = -1;
      if(Math.abs(dx) > Math.abs(dy)){ if(dx > 0 && c < N - 1) t = st.i + 1; else if(dx < 0 && c > 0) t = st.i - 1; }
      else { if(dy > 0 && r < N - 1) t = st.i + N; else if(dy < 0 && r > 0) t = st.i - N; }
      if(t >= 0) tryMove(st.i, t);
    };
    gr.onpointerup = e => {
      if(!st) return; const s0 = st; st = null;
      if(s0.done || M.busy || M.stop) return;
      const i = s0.i;
      if(M.sel >= 0 && M.sel !== i){
        const d = Math.abs(Math.floor(M.sel / N) - Math.floor(i / N)) + Math.abs(M.sel % N - i % N);
        if(d === 1){ const a = M.sel; M.sel = -1; tryMove(a, i); return; }
      }
      M.sel = M.sel === i ? -1 : i; paintSel(); sfx('sSel');
      void e;
    };
    gr.onpointercancel = () => { st = null; };
    M.onKey = e => {
      if(!M || G.over || G.paused || $('#veil').classList.contains('on')) return;
      const dirs = { ArrowLeft:[0, -1], ArrowRight:[0, 1], ArrowUp:[-1, 0], ArrowDown:[1, 0] };
      if(dirs[e.key]){
        e.preventDefault(); M.kbd = true; if(M.kc < 0) M.kc = 24;
        const [dr, dc] = dirs[e.key], r = Math.floor(M.kc / N) + dr, c = M.kc % N + dc;
        if(r < 0 || r >= N || c < 0 || c >= N){ paintSel(); return; }
        if(M.sel >= 0){ const a = M.sel; M.kc = idx(r, c); tryMove(a, M.kc); }
        else { M.kc = idx(r, c); paintSel(); }
      } else if(e.key === ' ' || e.key === 'Enter'){
        e.preventDefault(); M.kbd = true; if(M.kc < 0) M.kc = 24;
        M.sel = M.sel === M.kc ? -1 : M.kc; paintSel();
      }
    };
    window.addEventListener('keydown', M.onKey);
    M.onResize = () => { if(!M || M.busy) return; sizeBoard(); layoutAll(); };
    window.addEventListener('resize', M.onResize);
  }
  function sizeBoard(){
    const st = M.root.parentElement, wAvail = Math.min(460, st.clientWidth || 360);
    const top = M.panel.getBoundingClientRect().top + window.scrollY;
    const hAvail = Math.max(260, window.innerHeight - top - 112);
    const pad = 16;
    const s = Math.max(34, Math.floor((Math.min(wAvail, hAvail) - pad) / N));
    M.s = s;
    M.grid.style.width = M.grid.style.height = (s * N) + 'px';
    M.grid.style.setProperty('--s', s + 'px');
    M.grid.style.backgroundImage = 'none';
    let cl = M.grid.querySelector('.mt-cells');
    if(!cl){ cl = document.createElement('div'); cl.className = 'mt-cells'; cl.setAttribute('aria-hidden', 'true'); cl.innerHTML = '<i></i>'.repeat(N * N); M.grid.prepend(cl); }
    cl.style.gridTemplateColumns = `repeat(${N}, ${s}px)`; cl.style.gridAutoRows = s + 'px';
    paintIce();
  }

  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.6" fill="#fff" stroke="#1A0F45" stroke-width="2.4"/><rect x="9.6" y="1.8" width="4.8" height="3" rx="1.2" fill="#1A0F45"/><path d="M12 8.6V13l3 2" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="#1A0F45" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4.5h11l-2.6 3.8L18 12H7z" fill="#FF5C8A" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg>';

  return {
    name:'동물 삼총사', abil:'추리력', col:['#FFB2D6','#FF5FA2','#A3155A'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 14.5a8 8 0 1 0 16 0a8 8 0 1 0-16 0zM3.3 7.8a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0zM14.3 7.8a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0zM8.1 13.4a1.5 1.5 0 1 1 3 0a1.5 1.5 0 1 1-3 0zM12.9 13.4a1.5 1.5 0 1 1 3 0a1.5 1.5 0 1 1-3 0zM10.2 16.6h3.6l-1.8 2z"/><path d="M20.5 .8l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>',
    art(){
      const lay = [[1,0,3,4,2],[0,2,2,2,3],[4,3,0,1,5]];
      let g = '';
      lay.forEach((row, r) => row.forEach((k, c) => {
        const x = 22 + c * 24, y = 14 + r * 24, hot = r === 1 && c >= 1 && c <= 3;
        g += `<rect x="${x}" y="${y}" width="24" height="24" fill="${(r + c) % 2 ? '#9FB0E6' : '#A9B9EC'}"/>`;
        if(hot) g += `<rect x="${x + 1}" y="${y + 1}" width="22" height="22" rx="6" fill="#FFF6A8" opacity=".75"/>`;
        g += `<image href='${SRC[k]}' x="${x - 2}" y="${y - 3}" width="28" height="28"/>`;
      }));
      const gid = 'matchA' + (ART._n = (ART._n || 0) + 1);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3F8FE0"/><stop offset=".7" stop-color="#9FD6FF"/><stop offset="1" stop-color="#CDEBFF"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${gid})"/><ellipse cx="18" cy="10" rx="18" ry="7" fill="#fff" opacity=".85"/><ellipse cx="146" cy="8" rx="16" ry="6" fill="#fff" opacity=".75"/>
        <rect x="19" y="11" width="126" height="78" rx="6" fill="#E8B64A" stroke="#1A0F45" stroke-width="2.2"/>${g}
        <path d="M130 64l5 8 9-3-3 9 8 5-9 3 1 9-8-4-6 7-2-9-9-1 6-7-5-8 9 1z" fill="#FFE45C" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/>
        <text x="134" y="86" font-family="Black Han Sans, Jua, sans-serif" font-size="12" text-anchor="middle" fill="#FF3D8B" stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round" transform="rotate(-10 134 86)">3콤보!</text>
        </svg>`;
    },
    help:[
      ['같은 동물 셋이 모이면 짝!', '이웃한 두 동물을 손가락으로 밀어 자리를 바꿔요(차례로 두 번 눌러도 돼요). 가로·세로 3마리 한 줄, 2×2 네모, 이어진 5마리 이상 덩어리가 되면 사라져요. 붙어 있는 같은 동물은 모두 함께 사라져요. 맞춰지지 않는 자리는 바뀌지 않아요.'],
      ['특수 동물을 만들어요', '4개 한 줄 = 줄 폭탄, ㄱ·ㅗ 모양 = 3×3 폭탄, 5개 한 줄 = 무지개 별, 2×2 네모 = 별사탕. 별사탕은 옆 칸과 바꾸거나 폭발에 닿으면 X자 대각선으로 두 칸씩 터져요. 무지개 별을 아무 동물과 바꾸면 그 동물이 모두 사라져요. 특수 동물끼리 바꾸면 더 크게 터져요(별사탕 + 줄 폭탄 = 대각선 끝까지, 별사탕 + 무지개 별 = 가장 많은 동물이 모두 별사탕으로).'],
      ['오늘의 문제·대전: 이동 20번 목표 점수', '시간 제한은 없어요. 20번 움직이는 동안 목표 점수를 넘기면 성공! 연달아 사라지면 콤보 점수가 커져요. 5초 동안 가만히 있으면 움직일 곳이 살짝 흔들려요.'],
      ['솔로: 이동 횟수 안에 목표 모으기', '위쪽 목표(동물·상자·얼음·사슬)를 이동 횟수 안에 다 모으면 성공! 상자는 옆에서 맞추거나 폭탄으로 깨고, 얼음은 그 칸에서 터뜨리고, 사슬은 맞춰서 풀어요. 아래 아이템은 이동을 쓰지 않아요: 뿅망치(한 칸) · 십자 폭죽(가로·세로 한 줄씩) · 바꿔 장갑(이웃한 두 동물을 그냥 바꾸기) · 동물 피리(고른 동물을 판에서 모두 모으기).']
    ],
    chapters:['문어 바닷가','병아리 농장','개구리 연못','부엉이 숲','판다 대나무숲'],
    starRule:'★ 목표 완료 · ★★ 이동 10% 남기기 · ★★★ 이동 20% 남기기',
    levels:{ easy:levelCfg('easy'), normal:levelCfg('normal'), hard:levelCfg('hard') },
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n), it = ITEMS.find(x => x.at === n); return (c.boss ? '보스(아주 어려움) · ' : c.hard ? '어려움 · ' : '') + '이동 ' + c.moves + ' · ' + c.goals.map(g => (g.t === 'k' ? KNAME[g.k] : g.t === 'box' ? (g.hp > 1 ? g.hp + '겹 ' : '') + '상자' : g.t === 'ice' ? (g.lv > 1 ? '두꺼운 ' : '') + '얼음' : '사슬') + ' ' + g.n).join(' · ') + (it ? ' · 새 아이템: ' + it.name + '(' + it.desc + ')' : ''); },
    stageTag(n){ const c = stagePlan(n); return c.boss ? 'xhard' : c.hard ? 'hard' : ''; },
    levelDesc(lv){ const c = levelCfg(lv); return '동물 ' + c.kinds + '종 · 목표 ' + fmt(c.target) + '점'; },
    init(cfg, rng){
      const E = cfg.mode === 'moves' ? makeStage(rng, cfg) : makeEngine(rng, cfg.kinds || 6);
      if(cfg.mode !== 'moves') E.movesLeft = cfg.moves || DAY_MOVES;
      M = { E, item:null, s:44, views:new Map(), tws:[], waits:[], clock:0, lt:0, last:0, busy:false, stop:false, ended:false, sel:-1, gsel:-1, kc:-1, kbd:false, hint:null, best:0, ready:false, dead:false };
      G.mt = M;
      G.cleanup = () => {
        const m = G.mt; if(!m) return; m.dead = true;
        if(m.onKey) window.removeEventListener('keydown', m.onKey);
        if(m.onResize) window.removeEventListener('resize', m.onResize);
        m.tws = []; m.waits = [];
        if(G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxfloat.mtf').forEach(e => e.remove());
      };
    },
    render(st){
      M = G.mt;
      const cfg = G.cfg, mv = cfg.mode === 'moves';
      const hudHtml = mv ? `<div class="mt-hud mv">
          <div class="mt-por" aria-hidden="true"><i style="background-image:${img(5)}"></i></div>
          <div class="mt-box mt-goal"><span class="mt-tag">목표</span><div class="mt-gs">${cfg.goals.map((g, n) => `<span class="mt-gc" id="mtG${n}" aria-label="${g.t === 'k' ? KNAME[g.k] : g.t === 'box' ? '상자' : g.t === 'ice' ? '얼음' : '사슬'} ${g.n}개"><i class="${g.t === 'ice' ? 'ice' : ''}" style="background-image:${goalIcon(g)}"></i><b class="num">${g.n}</b><s>${ic('check')}</s></span>`).join('')}</div></div>
          <div class="mt-box mt-time mt-mvb" aria-label="남은 이동"><span class="mt-tag">이동 횟수</span><b class="num" id="mtMv">${cfg.moves}</b>${cfg.hard || cfg.boss ? `<span class="mt-diff ${cfg.boss ? 'x' : ''}">${cfg.boss ? '아주 어려움' : '어려움'}</span>` : ''}</div>
        </div>` : `<div class="mt-hud">
          <div class="mt-por" aria-hidden="true"><i style="background-image:${img(5)}"></i></div>
          <div class="mt-box mt-goal" id="mtGoal"><span class="mt-tag">목표</span>
            <div class="mt-gl"><b class="num" id="mtPts">0</b><small class="num">/ ${fmt(cfg.target)}</small></div>
            <div class="mt-prog" aria-label="목표까지 진행"><div class="mt-pbar"><i id="mtProgF"></i></div>
              <span class="mt-mk" id="mtMk0" style="left:62.5%" aria-label="목표">★</span><span class="mt-mk" id="mtMk1" style="left:81.25%" aria-label="목표의 1.3배">★</span><span class="mt-mk last" id="mtMk2" style="left:100%" aria-label="목표의 1.6배">★</span></div>
          </div>
          <div class="mt-box mt-time mt-mvb" aria-label="남은 이동"><span class="mt-tag">남은 이동</span><b class="num" id="mtMv">${cfg.moves}</b><div class="mt-tbar"><i id="mtTF"></i></div></div>
        </div>`;
      const dockHtml = mv ? `<div class="mt-dock items" id="mtItems"></div>` : `<div class="mt-dock" aria-hidden="true">
          <span class="mt-bst"><span class="mt-bi"><i class="lh" style="background-image:${img(1)}"></i><i class="ar" style="background-image:${ARW_IMG}"></i></span><em>4개<br>줄 폭탄</em></span>
          <span class="mt-bst"><span class="mt-bi"><i style="background-image:${img(3)}"></i><i class="bb" style="background-image:${BOMB_IMG}"></i></span><em>ㄱ·ㅗ<br>폭탄</em></span>
          <span class="mt-bst"><span class="mt-bi"><i style="background-image:${RB_IMG}"></i></span><em>5개<br>무지개</em></span>
          <span class="mt-bst"><span class="mt-bi"><i style="background-image:${IK('star')}"></i></span><em>2×2<br>별사탕</em></span>
          <span class="mt-bst best"><b class="num" id="mtBest">–</b><em>최고<br>콤보</em></span>
        </div>`;
      st.innerHTML = `<div class="ng-match" id="mtRoot">
        <div class="mt-top"><button class="mt-rbt" id="mtBack" aria-label="그만하기">${ic('back')}</button><div class="mt-ttl" id="mtTtl"></div><button class="mt-rbt" id="mtHelp" aria-label="게임 방법">${ic('help')}</button></div>
        ${hudHtml}
        <div class="mt-stage"><div class="mt-roof" aria-hidden="true"></div>
          <div class="mt-panel" id="mtPanel"><div class="mt-grid" id="mtGrid" role="application" aria-label="동물 삼총사 판. 이웃한 동물을 밀어서 바꿔요"></div><div class="mt-combo" id="mtCombo" aria-live="polite"></div></div>
        </div>
        ${dockHtml}
      </div>`;
      st.querySelector('#mtTtl').innerHTML = $('#ptitle').innerHTML;
      st.querySelector('#mtBack').onclick = () => confirmQuit();
      st.querySelector('#mtHelp').onclick = () => { if(G && !G.over) openHelp(G.id); };
      M.root = st.querySelector('#mtRoot'); M.grid = st.querySelector('#mtGrid'); M.panel = st.querySelector('#mtPanel'); M.tf = st.querySelector('#mtTF');
      sizeBoard(); layoutAll(); bindInput(); hud();
      if(mv){ paintDock(); paintIce(); }
      setTimeout(() => { if(M && !M.dead) banner(mv ? '이동 ' + cfg.moves + '번 안에 목표를 모아요' : '이동 ' + cfg.moves + '번 안에 ' + fmt(cfg.target) + '점!', 'mix'); }, 350);
      bake(Math.min(256, Math.round(M.s * 1.25 * Math.min(3, window.devicePixelRatio || 1))), () => { if(M && !M.dead && !M.busy){ M.views.forEach(v => { const t = M.E.b.find(x => x && x.id === v.id); if(t) restyle(v, t); }); } });
      M.ready = true; M.last = 0;
      const bestEl = () => { const b = $m('#mtBest'); if(b) b.textContent = M.E.maxCombo >= 2 ? M.E.maxCombo : '–'; };
      M.bestEl = bestEl;
      if(G.raf) cancelAnimationFrame(G.raf);
      M.lt = 0; G.raf = requestAnimationFrame(frame);
      const obs = setInterval(() => { if(!M || M.dead || G.over){ clearInterval(obs); return; } bestEl(); }, 300);
      const oc = G.cleanup; G.cleanup = () => { clearInterval(obs); oc && oc(); };
    },
    progress(){ const m = G && G.mt; if(!m || !G.cfg) return 0; if(isMoves()){ const tot = G.cfg.goals.reduce((s, g) => s + g.n, 0); return Math.min(1, (tot - goalLeft(m.E)) / tot); } return Math.min(1, m.E.pts / G.cfg.target); },
    lossText(){ const m = G.mt; if(isMoves()) return `목표까지 ${m ? goalLeft(m.E) : 0}개 남았어요. 이동 ${G.cfg.moves}번을 다 썼어요.`; return `목표 ${fmt(G.cfg.target)}점 중 ${fmt(m ? m.E.pts : 0)}점을 모았어요. 이동 ${G.cfg.moves}번을 다 썼어요.`; },
    score(){
      const m = G.mt, pts = m.E.pts, t = G.cfg.target, mc = m.E.maxCombo;
      if(isMoves()){ const left = m.leftAtWin || 0; return { base:500, time:Math.min(350, left * 35), extra:Math.max(0, Math.min(150, 25 * (mc - 1))), rows:['목표 완료', `남은 이동 보너스 (${left}번)`, `최고 콤보 ${Math.max(1, mc)}연속`] }; }
      const time = Math.max(0, Math.min(350, Math.round(350 * (pts - t) / (0.8 * t))));
      const extra = Math.max(0, Math.min(150, 25 * (mc - 1)));
      return { base:500, time, extra, rows:['목표 달성 (이동 ' + G.cfg.moves + '번)', `목표 넘긴 점수 보너스 (${fmt(pts)}점)`, `최고 콤보 ${Math.max(1, mc)}연속`] };
    },
    stars(){ const m = G.mt; if(isMoves()){ const l = m.leftAtWin || 0, mv = G.cfg.moves; return l >= Math.max(2, Math.ceil(mv * .2)) ? 3 : l >= Math.max(1, Math.ceil(mv * .1)) ? 2 : 1; } const p = m.E.pts, t = G.cfg.target; return p >= 1.6 * t ? 3 : p >= 1.3 * t ? 2 : 1; },
    css:`
body[data-mode="match"]{background:#C7DCEF}
body[data-mode="match"] #play > .pbar{display:none!important}
body[data-mode="match"]::before{content:""; position:fixed; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(120% 40% at 30% 110%, #CFE3C4 0 50%, rgba(207,227,196,0) 51%),
    linear-gradient(180deg,#A9C8E6 0%,#C7DCEF 45%,#E6EFF6 100%)}
body[data-mode="match"] #play{position:relative; z-index:1}
.ng-match{position:relative; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; color:var(--ink)}
.ng-match .num{font-variant-numeric:tabular-nums}
/* 맨 위 줄 */
.ng-match .mt-top{display:grid; grid-template-columns:42px 1fr 42px; align-items:center; gap:6px; margin:0 0 6px}
.ng-match .mt-rbt{width:42px; height:42px; border-radius:50%; display:grid; place-items:center; color:#4B4775; background:#FAF8F3; border:2px solid #4B4775; box-shadow:0 2px 0 #4B4775}
.ng-match .mt-rbt .ico{width:22px; height:22px}
.ng-match .mt-rbt:active{transform:translateY(2px); box-shadow:0 0 0 #4B4775}
.ng-match .mt-ttl{text-align:center; font-family:var(--disp); font-size:19px; line-height:1.15; color:#3F4470; min-width:0}
.ng-match .mt-ttl small{display:block; font-family:var(--font); font-size:11px; font-weight:800; color:#6B7197; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
/* HUD: 버건디 틀 + 크림 칸 */
.ng-match .mt-hud{position:relative; display:grid; grid-template-columns:74px 1fr 88px; gap:8px; align-items:stretch; padding:8px 9px 9px 8px; border-radius:22px;
  background:#6E6A9E; border:2px solid #4B4775; box-shadow:0 3px 0 #4B4775, 0 8px 14px rgba(20,40,90,.14)}
.ng-match .mt-por{position:relative; border-radius:20px; background:#BFD6EE; border:2px solid #4B4775; overflow:hidden; min-height:70px}
.ng-match .mt-por i{position:absolute; inset:2px -2px -6px; background:center/contain no-repeat}
.ng-match .mt-box{position:relative; border-radius:16px; padding:17px 8px 7px; background:#FAF8F3; border:2px solid #4B4775; text-align:center}
.ng-match .mt-tag{position:absolute; left:50%; top:-9px; transform:translateX(-50%); white-space:nowrap; padding:1px 10px 2px; border-radius:9px; font-family:var(--disp); font-size:12.5px; color:#fff; background:#4B4775; border:2px solid #4B4775; font-size:12px}
.ng-match .mt-gl{display:flex; align-items:baseline; justify-content:center; gap:4px; line-height:1}
.ng-match .mt-gl b{font-family:var(--heavy); font-weight:400; font-size:26px; color:#3A2261; letter-spacing:.3px}
.ng-match .mt-gl b.bump{animation:mtBump .28s cubic-bezier(.2,1.6,.4,1)}
.ng-match .mt-gl small{font-family:var(--disp); font-size:13px; color:#9A7A55}
.ng-match .mt-gl{white-space:nowrap}
@media (max-width:380px){ .ng-match .mt-hud{grid-template-columns:60px minmax(0,1fr) 82px; gap:6px} .ng-match .mt-gl b{font-size:22px} .ng-match .mt-gl small{font-size:12px} }
@keyframes mtBump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
.ng-match .mt-goal.done{background:linear-gradient(180deg,#FFF8C8,#FFDE6A)}
.ng-match .mt-prog{position:relative; height:20px; margin:6px 10px 0 2px}
.ng-match .mt-pbar{position:absolute; left:0; right:0; top:4px; height:12px; border-radius:99px; background:#E9E6F0; border:1.5px solid #B9B4CE; overflow:hidden}
.ng-match .mt-pbar i{display:block; height:100%; width:0; border-radius:99px; background:linear-gradient(180deg,#9BF07A,#2EBD55); box-shadow:inset 0 -3px 0 rgba(0,0,0,.14), inset 0 2px 0 rgba(255,255,255,.6); transition:width .35s cubic-bezier(.2,.9,.3,1)}
.ng-match .mt-mk{position:absolute; top:0; transform:translateX(-50%); width:20px; height:20px; border-radius:50%; display:grid; place-items:center; background:#fff; border:1.5px solid #B9B4CE; color:#D5D0E2; font-size:12px; line-height:1}
.ng-match .mt-mk.last{transform:translateX(-70%)}
.ng-match .mt-mk.on{background:linear-gradient(#FFE98E,#FFB020); color:#8A4B00; animation:mtBump .35s}
.ng-match .mt-time b{display:block; font-family:var(--heavy); font-weight:400; font-size:34px; line-height:1.05; color:#3A2261}
.ng-match .mt-tbar{height:8px; margin-top:5px; border-radius:99px; background:#E9E6F0; border:1.5px solid #B9B4CE; overflow:hidden}
.ng-match .mt-tbar i{display:block; height:100%; width:100%; transform-origin:left center; background:linear-gradient(180deg,#86D6FF,#2E8FE8)}
.ng-match.warn .mt-time{animation:mtWarn .5s ease-in-out infinite alternate}
.ng-match.warn .mt-time b{color:#E5484D}
.ng-match.warn .mt-tbar i{background:linear-gradient(180deg,#FF9C9C,#E5484D)}
@keyframes mtWarn{from{background:linear-gradient(180deg,#FFFBEF,#FBE9C6)}to{background:linear-gradient(180deg,#FFE3E3,#FFB9B9)}}
/* 판: 연보라 칸 + 금테 */
.ng-match .mt-stage{position:relative; margin-top:18px}
.ng-match .mt-roof{display:none; position:absolute; left:50%; top:-12px; transform:translateX(-50%); width:62%; height:18px; border-radius:12px 12px 4px 4px; background:repeating-linear-gradient(90deg,#C8683A 0 16px,#A9502A 16px 18px); border:2.5px solid #5A2A12; box-shadow:inset 0 3px 0 rgba(255,255,255,.25); z-index:0}
.ng-match .mt-panel{position:relative; z-index:1; margin:0 auto; width:max-content; padding:5px; border-radius:14px; background:linear-gradient(180deg,#F3CF7A,#D9A441); border:2px solid #8A6424;
  box-shadow:0 3px 0 #8A6424, 0 10px 18px rgba(20,40,90,.16)}
.ng-match .mt-grid{position:relative; overflow:hidden; border-radius:7px; touch-action:none; cursor:pointer;
  background-color:#8E9DD6;
  box-shadow:inset 0 2px 6px rgba(30,40,110,.18)}
.ng-match .mt-cells{position:absolute; inset:0; display:grid; z-index:0; pointer-events:none}
.ng-match .mt-cells i{margin:1.5px; border-radius:22%; background:linear-gradient(180deg,#B3C0EC,#A6B4E4); box-shadow:inset 0 1.5px 0 rgba(255,255,255,.35), inset 0 -1.5px 0 rgba(40,50,120,.1)}
.ng-match .mt-t{position:absolute; left:0; top:0; will-change:transform; z-index:1}
.ng-match .mt-in{position:absolute; inset:0}
.ng-match .mt-img{position:absolute; inset:-6% -6% -3%; background:center/contain no-repeat; z-index:1}
.ng-match .mt-t.pop .mt-img{filter:brightness(1.35) saturate(1.1)}
.ng-match .mt-t.sel{z-index:2}
.ng-match .mt-t.sel .mt-in{animation:mtSel .9s ease-in-out infinite}
.ng-match .mt-t.sel .mt-in::before{content:""; position:absolute; inset:3px; border-radius:24%; background:rgba(255,255,255,.45); box-shadow:0 0 0 2.5px #fff}
@keyframes mtSel{0%,100%{transform:scale(1.06)}50%{transform:scale(.95)}}
.ng-match .mt-t.kc .mt-in{outline:3px dashed #fff; outline-offset:-3px; border-radius:20%}
.ng-match .mt-t.hint .mt-in{animation:mtHint 1.1s ease-in-out infinite}
@keyframes mtHint{0%,55%,100%{transform:translate(0,0) rotate(0)}62%{transform:translate(calc(var(--hx) * 4px),calc(var(--hy) * 4px)) rotate(-7deg)}70%{transform:translate(0,0) rotate(6deg)}78%{transform:translate(calc(var(--hx) * 3px),calc(var(--hy) * 3px)) rotate(-4deg)}86%{transform:none}}
.ng-match .mt-t.no .mt-in{animation:mtNo .3s}
@keyframes mtNo{25%{transform:translateX(-3px) rotate(-4deg)}50%{transform:translateX(3px) rotate(4deg)}75%{transform:translateX(-2px)}}
/* 특수 동물 */
.ng-match .mt-arw{position:absolute; left:-14%; right:-14%; top:22%; height:100%; z-index:2; background:center/contain no-repeat; filter:none}
.ng-match .lv .mt-arw{top:0; transform:translateX(24%) rotate(90deg)}
@keyframes mtArw{from{transform:scaleX(.9)}to{transform:scaleX(1.05)}}
@keyframes mtArwV{from{transform:translateX(24%) rotate(90deg) scaleX(.9)}to{transform:translateX(24%) rotate(90deg) scaleX(1.05)}}
.ng-match .lh .mt-img, .ng-match .lv .mt-img, .ng-match .bm .mt-img{animation:none}
@keyframes mtWob{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) scale(1.04)}}
.ng-match .mt-ray{position:absolute; inset:-18%; z-index:0; border-radius:50%; background:repeating-conic-gradient(rgba(255,236,160,.55) 0 12deg, rgba(255,236,160,0) 12deg 30deg); -webkit-mask:radial-gradient(circle, #000 30%, transparent 70%); mask:radial-gradient(circle, #000 30%, transparent 70%); animation:spin 12s linear infinite}
.ng-match .mt-bmb{position:absolute; right:-10%; bottom:-8%; width:60%; height:60%; z-index:3; background:center/contain no-repeat; animation:none}
@keyframes mtFuse{from{transform:scale(.9) rotate(-6deg)}to{transform:scale(1.08) rotate(6deg)}}
.ng-match .mt-rbg{position:absolute; inset:4%; border-radius:50%; background:conic-gradient(#FF7B8F,#FFB24A,#FFE45C,#7EDB6A,#6FC3FF,#B79CFF,#FF7B8F); opacity:.3; filter:blur(4px); animation:spin 8s linear infinite}
.ng-match .rb .mt-img{animation:none}
@keyframes mtRb{from{transform:scale(.92) rotate(-8deg)}to{transform:scale(1.06) rotate(8deg)}}
/* 아래: 특수 동물 안내(초록 아이템 칸) */
.ng-match .mt-dock{display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:16px}
.ng-match .mt-bst{position:relative; border-radius:16px; background:#EEF1F7; border:2px solid #B9BFD3; box-shadow:0 2px 0 #B9BFD3; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:8px; padding:7px 4px 8px; min-height:96px; overflow:hidden}
.ng-match .mt-bi{position:relative; flex:none; width:46px; height:42px}
.ng-match .mt-bst i{position:absolute; inset:0; background:center/contain no-repeat}
.ng-match .mt-bst i.ar{inset:30% -14% 4%}
.ng-match .mt-bst i.bb{inset:auto; right:-18%; top:36%; width:46%; height:46%}
.ng-match .mt-bst em{position:relative; z-index:1; font-style:normal; font-family:var(--disp); font-size:11.5px; line-height:1.05; text-align:center; color:#4B4775; padding:0}
.ng-match .mt-bst.best{background:#F6EEF4; border-color:#D3BFD0; box-shadow:0 2px 0 #D3BFD0; flex-direction:column; justify-content:center; align-items:center}
.ng-match .mt-bst.best b{font-family:var(--heavy); font-weight:400; font-size:26px; line-height:1; color:#8C4F7A}
.ng-match .mt-bst.best em{color:#8C4F7A; padding:2px 0 0}
/* 발동 효과 */
.ng-match .mt-beam{position:absolute; z-index:5; pointer-events:none; background:linear-gradient(var(--bd,180deg), rgba(255,255,255,0), #fff 35%, #FFF6A8 50%, #fff 65%, rgba(255,255,255,0)); box-shadow:0 0 18px 6px rgba(255,246,168,.8); border-radius:99px}
.ng-match .mt-beam.h{left:0; width:100%; --bd:180deg; animation:mtBeamH .5s ease-out forwards}
.ng-match .mt-beam.v{top:0; height:100%; --bd:90deg; animation:mtBeamV .5s ease-out forwards}
@keyframes mtBeamH{0%{transform:scaleX(0) scaleY(.4); opacity:1}35%{transform:scaleX(1) scaleY(1); opacity:1}100%{transform:scaleX(1) scaleY(.1); opacity:0}}
@keyframes mtBeamV{0%{transform:scaleY(0) scaleX(.4); opacity:1}35%{transform:scaleY(1) scaleX(1); opacity:1}100%{transform:scaleY(1) scaleX(.1); opacity:0}}
.ng-match .mt-flash{position:absolute; inset:0; z-index:5; pointer-events:none; background:radial-gradient(circle, rgba(255,246,168,.9), rgba(255,160,60,0) 70%); animation:mtFlash .38s ease-out forwards}
@keyframes mtFlash{from{opacity:1}to{opacity:0}}
.ng-match .mt-zap{position:absolute; inset:0; width:100%; height:100%; z-index:5; pointer-events:none; overflow:visible}
.ng-match .mt-zap line{stroke-width:4; stroke-linecap:round; filter:drop-shadow(0 0 4px #fff); stroke-dasharray:400; stroke-dashoffset:400; animation:mtZap .6s ease-out forwards}
@keyframes mtZap{0%{stroke-dashoffset:400; opacity:1}45%{stroke-dashoffset:0; opacity:1}100%{stroke-dashoffset:0; opacity:0}}
/* 콤보·알림 글자 */
.ng-match .mt-combo{position:absolute; left:50%; top:38%; z-index:8; pointer-events:none; display:flex; align-items:baseline; gap:4px; opacity:0; transform:translate(-50%,-50%) scale(.3); white-space:nowrap}
.ng-match .mt-combo b{font-family:var(--heavy); font-size:58px; line-height:1; color:#FFE45C; -webkit-text-stroke:7px var(--outline2); paint-order:stroke fill; text-shadow:0 5px 0 var(--outline2)}
.ng-match .mt-combo span{font-family:var(--disp); font-size:30px; color:#fff; -webkit-text-stroke:6px #E0457F; paint-order:stroke fill; text-shadow:0 4px 0 #8E0F4F}
.ng-match .mt-combo.big b{color:#FF8CC2; font-size:70px}
.ng-match .mt-combo.on{animation:mtCombo .9s cubic-bezier(.2,1.5,.4,1) forwards}
@keyframes mtCombo{0%{opacity:0; transform:translate(-50%,-50%) scale(.3) rotate(-10deg)}22%{opacity:1; transform:translate(-50%,-50%) scale(1.15) rotate(3deg)}40%{transform:translate(-50%,-50%) scale(1) rotate(-2deg)}75%{opacity:1; transform:translate(-50%,-60%) scale(1)}100%{opacity:0; transform:translate(-50%,-85%) scale(.9)}}
.ng-match .mt-banner{position:absolute; left:50%; top:50%; z-index:9; pointer-events:none; transform:translate(-50%,-50%); white-space:nowrap; animation:mtBan 1.4s cubic-bezier(.2,1.4,.4,1) forwards}
.ng-match .mt-banner b{display:block; padding:10px 22px; border-radius:18px; font-family:var(--disp); font-size:30px; color:#fff; background:linear-gradient(180deg,#86D6FF,#2E8FE8); border:3px solid var(--outline2); box-shadow:inset 0 2px 0 rgba(255,255,255,.5), 0 5px 0 var(--outline2), 0 12px 20px rgba(0,0,0,.25); -webkit-text-stroke:5px #124F92; paint-order:stroke fill}
.ng-match .mt-banner.goal b{background:linear-gradient(180deg,#FFE98E,#FFB020); -webkit-text-stroke:5px #9A5A00}
.ng-match .mt-banner.end{animation:mtBanEnd 2s cubic-bezier(.2,1.4,.4,1) forwards}
.ng-match .mt-banner.end b{font-size:36px; background:linear-gradient(180deg,#FF8AC0,#F0368A); -webkit-text-stroke:5px #8E0F4F}
.ng-match .mt-banner.goal.end b{background:linear-gradient(180deg,#FFE98E,#FFB020); -webkit-text-stroke:5px #9A5A00}
@keyframes mtBan{0%{opacity:0; transform:translate(-50%,-50%) scale(.4)}18%{opacity:1; transform:translate(-50%,-50%) scale(1.08)}30%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0; transform:translate(-50%,-70%) scale(1)}}
@keyframes mtBanEnd{0%{opacity:0; transform:translate(-50%,-50%) scale(.4)}15%{opacity:1; transform:translate(-50%,-50%) scale(1.1)}25%{transform:translate(-50%,-50%) scale(1)}100%{opacity:1; transform:translate(-50%,-50%) scale(1)}}
body[data-mode="match"] .fxfloat.mtf{font-family:var(--heavy); font-size:20px; color:#fff; -webkit-text-stroke:4px #1A0F45; letter-spacing:.5px}
body[data-mode="match"] .fxfloat.mtf.hot{color:#FFE45C; font-size:24px}
body[data-mode="match"] .fxfloat.mtf.big{color:#FFB020; font-size:26px; -webkit-text-stroke:5px #5A2A00}
/* ===== 솔로(이동 횟수) HUD · 목표 · 장애물 · 아이템 (2026-09-29) ===== */
.ng-match .mt-hud.mv{grid-template-columns:64px 1fr 84px}
.ng-match .mt-gs{display:flex; justify-content:center; gap:6px; flex-wrap:wrap; padding-top:2px}
.ng-match .mt-gc{position:relative; display:flex; flex-direction:column; align-items:center; min-width:40px}
.ng-match .mt-gc i{display:block; width:36px; height:36px; background:center/contain no-repeat}
.ng-match .mt-gc i.ice{border-radius:9px; background:linear-gradient(180deg,#E6FAFF,#9FE1FA); border:2px solid #6CC6EA; box-shadow:inset 0 2px 0 #fff; width:30px; height:30px; margin:3px}
.ng-match .mt-gc b{font-family:var(--heavy); font-weight:400; font-size:17px; line-height:1; color:#3A2261; margin-top:1px}
.ng-match .mt-gc.bump b{animation:mtBump .28s cubic-bezier(.2,1.6,.4,1)}
.ng-match .mt-gc s{display:none; position:absolute; right:-2px; top:18px; width:20px; height:20px; border-radius:50%; background:linear-gradient(#8BF06A,#2BB24C); border:2px solid #fff; color:#fff; place-items:center; text-decoration:none}
.ng-match .mt-gc s .ico{width:12px; height:12px}
.ng-match .mt-gc.done b{visibility:hidden}
.ng-match .mt-gc.done s{display:grid}
.ng-match .mt-mvb b{font-size:36px}
.ng-match .mt-mvb b.bump{animation:mtBump .28s cubic-bezier(.2,1.6,.4,1)}
.ng-match .mt-diff{display:inline-block; margin-top:3px; padding:1px 7px 2px; border-radius:8px; font-family:var(--disp); font-size:11px; color:#fff; background:#E5484D; white-space:nowrap}
.ng-match .mt-diff.x{background:#7B3FE0}
.ng-match.warn .mt-mvb{animation:mtWarn .5s ease-in-out infinite alternate}
.ng-match.warn .mt-mvb b{color:#E5484D}
.ng-match .mt-cells i.ice1{background:linear-gradient(180deg,#CFF3FF,#7FD6F7); box-shadow:inset 0 0 0 3px #3FB8E8, inset 0 3px 0 rgba(255,255,255,.9), 0 0 6px rgba(80,200,250,.6)}
.ng-match .mt-cells i.ice2{background:linear-gradient(135deg,rgba(255,255,255,.85) 0 9%,transparent 9% 44%,rgba(255,255,255,.7) 44% 50%,transparent 50%),linear-gradient(180deg,#9EE6FF,#35AEE6); box-shadow:inset 0 0 0 4px #1C8FC8, inset 0 3px 0 #fff, 0 0 8px rgba(40,170,240,.7)}
.ng-match .mt-lock{position:absolute; inset:-4%; z-index:3; background:center/contain no-repeat; pointer-events:none}
.ng-match .bx .mt-img{inset:-2%}
.ng-match .mt-diag{position:absolute; inset:0; width:100%; height:100%; z-index:5; pointer-events:none; overflow:visible}
.ng-match .mt-diag line{stroke-width:calc(var(--s) * .34); stroke-linecap:round; opacity:.9; filter:drop-shadow(0 0 5px #fff); stroke-dasharray:1200; stroke-dashoffset:1200; animation:mtDiag .55s ease-out forwards}
@keyframes mtDiag{0%{stroke-dashoffset:1200; opacity:1}40%{stroke-dashoffset:0; opacity:1}100%{stroke-dashoffset:0; opacity:0; stroke-width:2px}}
.ng-match .mt-dock.items{grid-template-columns:repeat(4,1fr)}
.ng-match .mt-bst.it{cursor:pointer; min-height:88px}
.ng-match .mt-bst.it:disabled{cursor:default; opacity:.55}
.ng-match .mt-bst.it.lk .mt-bi{filter:grayscale(1) opacity(.5)}
.ng-match .mt-bst.it.on{background:#FFF6C8; border-color:#E0A700; box-shadow:0 0 0 3px rgba(255,200,40,.45), 0 2px 0 #E0A700}
.ng-match .mt-cnt{position:absolute; right:5px; top:5px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; font-family:var(--heavy); font-weight:400; font-size:12px; line-height:20px; color:#fff; background:#FF5C7A}
.ng-match .mt-cnt.lk{background:#8E97AC; font-size:10px}
.ng-match .mt-cnt.lk::before{content:"St."}
.ng-match .mt-dock:not(.items){grid-template-columns:repeat(5,1fr)}
.modal .path .st.hard:not(.lock){background:linear-gradient(180deg,#FF7A7A,#B3122E); box-shadow:inset 0 2px 0 rgba(255,255,255,.5), 0 3px 0 var(--outline2), 0 0 0 3px #FFD0D0}
.modal .path .st.xhard:not(.lock){background:linear-gradient(180deg,#A77BFF,#4B1E9E); box-shadow:inset 0 2px 0 rgba(255,255,255,.5), 0 3px 0 var(--outline2), 0 0 0 3px #E2D2FF}
@media (prefers-reduced-motion: reduce){ .ng-match .mt-ray, .ng-match .mt-rbg, .ng-match .mt-arw, .ng-match .mt-bmb, .ng-match .mt-img, .ng-match .mt-t.hint .mt-in, .ng-match.warn .mt-time{animation:none} }
`,
    sounds:{
      matchSwap(){ aWhoosh({ f:900, f2:2400, q:1.4, a:.01, d:.09, v:.035 }); aTone({ f:620, f2:900, type:'triangle', d:.06, v:.05 }); },
      matchBad(){ aTone({ f:330, f2:250, type:'triangle', d:.08, v:.08 }); aTone({ f:280, f2:200, type:'triangle', t:.09, d:.1, v:.07 }); },
      matchPop(o){ const n = Math.min(9, o.n || 1); aMarimba(penta(n + 3, 72), { v:.19, pan:o.pan }); aMarimba(penta(n + 5, 72), { t:.05, v:.14, pan:o.pan }); aTone({ f:520 + n * 70, f2:1300 + n * 140, d:.07, v:.06 }); aNoise({ ft:'highpass', f:5200, d:.08, v:.03 }); if(n >= 3) aBell({ f:penta(n + 8, 72), t:.08, d:.5, v:.05, rev:.35 }); },
      matchCombo(o){ const n = Math.min(8, o.n || 2); for(let k = 0; k < Math.min(n, 5); k++) aBell({ f:penta(4 + n + k, 72), t:k * .04, d:.45, v:.045, rev:.35 }); },
      matchMake(){ aSparkle({ root:84, n:4, gap:.04, v:.05 }); aTone({ f:420, f2:1250, type:'triangle', d:.2, v:.05 }); },
      matchLine(o){ aTone({ f:2400, f2:320, type:'sawtooth', lp:4200, d:.28, v:.05, pan:o.pan, rev:.2 }); aWhoosh({ f:700, f2:4200, a:.02, d:.24, v:.06 }); },
      matchBomb(o){ const b = o.big || 1; aThump({ f:115, f2:34, d:.5 + b * .1, v:.36 + b * .04, pan:o.pan }); aNoise({ ft:'lowpass', f:2600, f2:160, d:.55 + b * .1, v:.28, pan:o.pan, rev:.3 }); aNoise({ ft:'highpass', f:3200, d:.08, v:.08 }); },
      matchRainbow(){ aSparkle({ root:79, n:8, gap:.035, v:.06 }); aTone({ f:300, f2:2400, type:'triangle', d:.5, v:.05, rev:.3 }); aThump({ t:.2, f:120, f2:50, d:.4, v:.22 }); },
      matchStar(o){ aSparkle({ root:88, n:5, gap:.03, v:.055 }); aTone({ f:1800, f2:600, type:'triangle', d:.22, v:.05, pan:o.pan, rev:.25 }); aWhoosh({ f:1200, f2:3600, a:.01, d:.16, v:.045 }); },
      matchFlute(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aTone({ f:m2f(79 + d), type:'sine', t:i * .06, a:.01, d:.18, v:.06, rev:.3 })); aSparkle({ t:.3, root:84, n:4, gap:.04, v:.045 }); },
      matchWarn(o){ aTone({ f:o.hi ? 1760 : 1320, type:'square', lp:3200, d:.05, v:o.hi ? .06 : .04 }); },
      matchEnd(){ aTone({ f:1900, f2:2250, type:'triangle', a:.02, hold:.12, d:.25, v:.07 }); aTone({ f:2250, f2:1700, type:'triangle', t:.22, hold:.18, d:.35, v:.07, rev:.3 }); aThump({ f:140, f2:60, d:.3, v:.2 }); },
      matchShuffle(){ aWhoosh({ f:300, f2:3200, a:.12, d:.4, v:.07 }); for(let k = 0; k < 6; k++) aTone({ f:700 + k * 120, type:'triangle', t:.05 + k * .05, d:.04, v:.03 }); }
    },
    gate:{ matchPop:40, matchWarn:250, matchLine:60, matchBomb:80, matchMake:60, matchSwap:40, matchStar:60 },
    jingle(){ [0, 2, 4, 5, 7, 9].forEach((d, i) => aMarimba(penta(d, 72), { t:i * .065, v:.16 })); [72, 76, 79, 84].forEach(m => aMarimba(m2f(m), { t:.48, d:1, v:.11 })); aSparkle({ t:.52, n:6 }); },
    duelAi,
    _eng:{ makeEngine, move, listMoves, hasMove, findGroups, shuffleBoard, bestMove, botRun, clone, stepMs, BOT, levelCfg, duelAi, stageCfg, stagePlan, makeStage, botMoves, goalDone, goalLeft, blastCells, itemCells, gloveSwap, diagX, MT_D, S_STAR },
    _test:{
      auto(n){ const m = G.mt; if(!m) return; let k = 0; const go = async () => { while(k++ < n && !G.over && !m.stop){ const mv = bestMove(m.E); if(!mv) break; await tryMove(mv[0], mv[1]); } }; return go(); },
      boost(p){ G.mt.E.pts += p; hud(); },
      lastMove(){ G.mt.E.movesLeft = 1; hud(); },
      snap(){ return G.mt.E.b.map(t => t.s === S_RB ? '*' : t.k + (t.s ? 'HVB'[t.s - 1] : '')).join(','); },
      tryMove:(a, b) => tryMove(a, b),
      shuffle:() => doShuffle()
    }
  };
})();

if(NG.match) NG.match.concepts = { fixed:[
  { at:6, key:'box', name:'나무 상자', desc:'옆에서 맞추거나 폭탄에 닿으면 한 겹씩 깨져요. 상자는 움직이지 않아요.' },
  { at:11, key:'ice', name:'얼음 바닥', desc:'그 칸의 동물이 터지면 얼음이 한 겹 녹아요.' },
  { at:21, key:'chain', name:'사슬', desc:'묶인 동물은 옮길 수 없어요. 맞추거나 폭탄에 닿으면 풀려요.' },
  { at:26, key:'box2', name:'2겹 상자', desc:'두 번 깨야 사라지는 상자예요.' },
  { at:31, key:'ice2', name:'두꺼운 얼음', desc:'두 번 녹여야 하는 얼음이에요.' },
  { at:46, key:'box3', name:'3겹 상자', desc:'세 번 깨야 하는 가장 단단한 상자예요.' }] };


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.match, { duelPace:[120,.62], duelStat:{ unit:'점', score:true, get:() => ({ v:G.mt ? G.mt.E.pts : 0, t:G.cfg.target }) }, duelHow:'20번 움직여 누가 더 높은 점수?' });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.match.scene = { kind:'bubbles', colors:['#FFFFFF','#9FD3FF','#FFD1E8'], density:1 };
