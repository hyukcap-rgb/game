/* 오목 */
/* ===== 오목 (omok) · 하루퍼즐 리그 게임 모듈 =====
   15×15 판의 줄이 만나는 점에 흑·백이 번갈아 돌을 두고, 가로·세로·대각선으로 '정확히 5개'를 먼저 잇는 쪽이 이긴다.
   흑(먼저 두는 쪽)만 3·3 금지. 6개 이상(장목)은 흑·백 모두 승리가 아니다.
   - 오늘의 문제 = 묘수풀이: rng로 국면을 만들고 탐색기(연속 4 찾기, VCF)로 'N수 안에 이김'을 확인한 판만 낸다.
   - AI = 위협 판단 + 평가 함수 + 얕은 탐색(쉬움·보통·어려움). 결정은 (판 씨앗 + 지금까지의 수)로 만든 rng로만 → 같은 수 = 같은 응답.
   - 대전 = 엔진 1:1 대전(같은 시각 시작·같은 씨앗) 위에서 presence.om.mv로 수를 주고받는 실시간 턴제. 그림은 모두 직접 그린 SVG. */
NG.omok = (() => {
  const OL = '#1A0F45';
  const EMPTY = 0, BLACK = 1, WHITE = 2, ROCK = 3;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const other = c => 3 - c;
  const CNAME = c => c === BLACK ? '흑' : '백';
  const COLS = 'ABCDEFGHIJKLMNO';

  /* ===================== 규칙 (판·돌 계산: 무작위·시간 없음) ===================== */
  const mkB = n => ({ n, b:new Int8Array(n * n) });
  const cloneB = B => ({ n:B.n, b:B.b.slice() });
  const at = (B, x, y) => x < 0 || y < 0 || x >= B.n || y >= B.n ? ROCK : B.b[y * B.n + x];
  function run(B, x, y, dx, dy, c){ let k = 0; x += dx; y += dy; while(at(B, x, y) === c){ k++; x += dx; y += dy; } return k; }
  /* 빈 칸 i에 c를 두면 d 방향으로 '정확히 5'가 되나 */
  function fiveDir(B, i, c, d){ const n = B.n, x = i % n, y = (i / n) | 0, [dx, dy] = DIRS[d]; return 1 + run(B, x, y, dx, dy, c) + run(B, x, y, -dx, -dy, c) === 5; }
  /* 5목이 되는 방향(없으면 -1) */
  function fiveAt(B, i, c){ for(let d = 0; d < 4; d++) if(fiveDir(B, i, c, d)) return d; return -1; }
  /* i(c가 놓여 있음)를 포함해 d 방향으로 정확히 5목을 만드는 빈 칸(양쪽 끝 첫 빈칸만 가능 → 최대 2개) */
  function fivesFrom(B, i, c, d){
    const n = B.n, x = i % n, y = (i / n) | 0, [dx, dy] = DIRS[d], out = [];
    for(const sg of [1, -1]){
      let t = 1; while(at(B, x + dx * sg * t, y + dy * sg * t) === c) t++;
      const fx = x + dx * sg * t, fy = y + dy * sg * t;
      if(at(B, fx, fy) === EMPTY){ const f = fy * n + fx; if(fiveDir(B, f, c, d)) out.push(f); }
    }
    return out;
  }
  function fivesThrough(B, i, c){ const out = []; for(let d = 0; d < 4; d++) for(const f of fivesFrom(B, i, c, d)) if(!out.includes(f)) out.push(f); return out; }
  /* 지금 c가 두면 바로 5목인 빈 칸들(c 돌 바로 옆 빈칸만 살펴봄) */
  let MARK = new Uint16Array(0), MARKN = 0;
  function fivePts(B, c){
    const n = B.n, b = B.b, N = n * n, out = [];
    if(MARK.length < N) MARK = new Uint16Array(N);
    if(++MARKN > 65000){ MARK.fill(0); MARKN = 1; }
    for(let i = 0; i < N; i++){
      if(b[i] !== c) continue;
      const x = i % n, y = (i / n) | 0;
      for(let dy = -1; dy <= 1; dy++){ const Y = y + dy; if(Y < 0 || Y >= n) continue;
        for(let dx = -1; dx <= 1; dx++){ const X = x + dx; if(X < 0 || X >= n) continue;
          const j = Y * n + X; if(b[j] !== EMPTY || MARK[j] === MARKN) continue; MARK[j] = MARKN;
          if(fiveAt(B, j, c) >= 0) out.push(j); } }
    }
    return out;
  }
  /* 한 방향 모양(c가 i에 놓여 있다고 봄): 5목·4(5목 자리 수 nF)·열린 3·닫힌 3·창 점수 */
  const WS = [0, 1, 6, 30, 160, 0];
  function dirInfo(B, i, c, d){
    const n = B.n, x = i % n, y = (i / n) | 0, [dx, dy] = DIRS[d];
    const o = { five:false, nF:0, open3:false, three:false, ws:0 };
    if(1 + run(B, x, y, dx, dy, c) + run(B, x, y, -dx, -dy, c) === 5){ o.five = true; return o; }
    let maxK = 0;
    for(let s = -4; s <= 0; s++){   /* 깨끗한 5칸 창(상대 돌·바위·판 밖 없음)만 */
      let k = 0, ok = true;
      for(let t = s; t < s + 5; t++){ const v = at(B, x + dx * t, y + dy * t); if(v === c) k++; else if(v !== EMPTY){ ok = false; break; } }
      if(ok){ o.ws += WS[k]; if(k > maxK) maxK = k; }
    }
    if(maxK >= 4){ o.nF = fivesFrom(B, i, c, d).length; if(o.nF) return o; }
    if(maxK >= 3){
      for(let t = -4; t <= 4; t++){
        if(!t) continue; const ex = x + dx * t, ey = y + dy * t; if(at(B, ex, ey) !== EMPTY) continue;
        const e = ey * n + ex; B.b[e] = c; const f = fivesFrom(B, i, c, d).length; B.b[e] = EMPTY;
        if(f >= 2){ o.open3 = true; break; } if(f === 1) o.three = true;
      }
    }
    return o;
  }
  /* 흑 3·3 금지: 이 자리에 두면 열린 3이 두 줄 이상 생김(5목이 되면 금지 아님). 열린 3 = 한 수 더 두면 양쪽이 열린 4(5목 자리 2곳)가 되는 3 */
  function isForbidden(B, i){
    if(B.b[i] !== EMPTY || fiveAt(B, i, BLACK) >= 0) return false;
    B.b[i] = BLACK; let n3 = 0;
    for(let d = 0; d < 4; d++){ const o = dirInfo(B, i, BLACK, d); if(!o.nF && o.open3) n3++; }
    B.b[i] = EMPTY; return n3 >= 2;
  }
  const legal = (B, i, c) => i >= 0 && i < B.b.length && B.b[i] === EMPTY && !(c === BLACK && isForbidden(B, i));
  /* 두면 생기는 5목 줄(이긴 다섯 칸) */
  function winLine(B, i, c){
    const d = fiveAt(B, i, c); if(d < 0) return null;
    const n = B.n, x = i % n, y = (i / n) | 0, [dx, dy] = DIRS[d], out = [i];
    for(const sg of [1, -1]){ let t = 1; while(at(B, x + dx * sg * t, y + dy * sg * t) === c){ out.push((y + dy * sg * t) * n + x + dx * sg * t); t++; } }
    return out;
  }
  /* 한 줄 최고 길이(진행 표시용) */
  function bestLine(B, c){
    const n = B.n; let best = 0;
    for(let i = 0; i < n * n; i++){ if(B.b[i] !== c) continue; const x = i % n, y = (i / n) | 0;
      for(const [dx, dy] of DIRS){ if(at(B, x - dx, y - dy) === c) continue; const k = 1 + run(B, x, y, dx, dy, c); if(k > best) best = k; } }
    return Math.min(5, best);
  }
  const isFull = B => { for(let i = 0; i < B.b.length; i++) if(B.b[i] === EMPTY) return false; return true; };

  /* ===================== AI: 위협 → 평가 함수 → 얕은 탐색 ===================== */
  /* 후보 = 돌에서 r칸 안의 빈 칸 */
  function cands(B, r = 2){
    const n = B.n, seen = new Uint8Array(n * n), out = []; let any = false;
    for(let i = 0; i < n * n; i++){
      const v = B.b[i]; if(v !== BLACK && v !== WHITE) continue; any = true;
      const x = i % n, y = (i / n) | 0;
      for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){
        const X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= n || Y >= n) continue;
        const j = Y * n + X; if(!seen[j] && B.b[j] === EMPTY){ seen[j] = 1; out.push(j); }
      }
    }
    if(!any){ const h = n >> 1; for(const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]){ const j = (h + dy) * n + h + dx; if(B.b[j] === EMPTY){ out.push(j); break; } } }
    if(!out.length) for(let i = 0; i < n * n; i++) if(B.b[i] === EMPTY) out.push(i);
    return out;
  }
  /* 칸 점수: c를 i에 두었을 때 공격 가치 */
  function cellEval(B, i, c){
    B.b[i] = c;
    let nF = 0, n4o = 0, n3 = 0, sum = 0, five = false;
    for(let d = 0; d < 4; d++){
      const o = dirInfo(B, i, c, d);
      if(o.five){ five = true; break; }
      if(o.nF >= 2) n4o++; else if(o.nF === 1) nF++; else if(o.open3) n3++;
      sum += o.ws + (o.nF ? 2500 : o.open3 ? 900 : o.three ? 120 : 0);
    }
    B.b[i] = EMPTY;
    if(five) return { s:1e8, five:true, forbid:false };
    const fours = nF + n4o, forbid = c === BLACK && n3 >= 2;
    let s;
    if(n4o || fours >= 2) s = 2e6;            /* 열린 4 · 4·4 */
    else if(fours && n3) s = 1.5e6;           /* 4·3 */
    else if(n3 >= 2) s = 4e5;                 /* 3·3 (흑은 금지) */
    else s = sum;
    return { s, fours, n3, forbid, five:false };
  }
  /* 난이도: dw 수비 비중 · noise 흔들림 · blind 이번 수는 공격만 볼 확률 · miss5 5목 막기를 놓칠 확률 · vcf 연속 4 탐색 깊이 · look 얕은 탐색 후보 수 */
  const LV = [
    { dw:.62, noise:.7, blind:.3, miss5:.12 },
    { dw:.8, noise:.1, blind:0, miss5:0 },
    { dw:.85, noise:.02, blind:0, miss5:0, vcf:6, look:6, guard:4 }
  ];
  function scoreCands(B, c, cs, L, rng){
    const o = other(c), blind = L.blind && rng() < L.blind;
    return cs.map(i => {
      const a = cellEval(B, i, c), df = cellEval(B, i, o);
      let dv = o === BLACK && df.forbid ? df.s * .05 : df.s;
      if(blind && dv < 1e8) dv *= .002;
      let s = a.s + dv * L.dw;
      s *= 1 + (rng() - .5) * L.noise;
      return [s, i];
    }).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
  }
  /* AI 한 수(rng만 씀 → 같은 판·같은 rng = 같은 수). 둘 곳이 없으면 -1 */
  function aiPick(B, c, lv, rng){
    const o = other(c), L = LV[Math.max(0, Math.min(2, lv))];
    let cs = cands(B).filter(i => legal(B, i, c));
    if(!cs.length){ for(let i = 0; i < B.b.length; i++) if(legal(B, i, c)) return i; return -1; }
    for(const i of cs) if(fiveAt(B, i, c) >= 0) return i;                 /* 1) 내 5목 */
    const op5 = fivePts(B, o).filter(i => legal(B, i, c));
    if(op5.length && !(L.miss5 && rng() < L.miss5)){                     /* 2) 상대 5목 막기 */
      if(op5.length === 1) return op5[0];
      return scoreCands(B, c, op5, L, rng)[0][1];
    }
    if(L.vcf){ const v = vcfSolve(B, c, L.vcf, 1200); if(v) return v[0]; }   /* 3) 연속 4로 이기는 길(노드 수 제한 → 휴대폰에서도 빠르고 늘 같은 답) */
    let sc = scoreCands(B, c, cs, L, rng);                                 /* 4) 평가 함수 */
    if(L.look && sc[0][0] < 1.4e6){                                        /* 5) 얕은 탐색: 상대의 가장 센 다음 수까지 보고 고름 */
      const top = sc.slice(0, L.look); let best = null;
      for(const [s, i] of top){
        B.b[i] = c;
        const oc = cands(B, 1), q = oc.map(j => Math.max(cellEval(B, j, o).s, cellEval(B, j, c).s * .6)).sort((x, y) => y - x);
        let v = s - .55 * (q[0] || 0);
        if(L.guard && (q[0] || 0) < 1.4e6 && vcfSolve(B, o, L.guard, 250)) v -= 3e6;   /* 상대에게 연속 4 승리를 주는 수는 피함 */
        B.b[i] = EMPTY;
        if(!best || v > best[0]) best = [v, i];
      }
      return best[1];
    }
    return sc[0][1];
  }

  /* ===================== 연속 4 탐색(VCF): c가 계속 4를 두어(상대는 막을 수밖에 없음) 이기는 길 ===================== */
  /* 4가 되는 빈 칸(두면 5목 자리가 생김). 5목 자리 2곳(열린 4·4·4)이 먼저 */
  function fourMoves(B, c){
    const n = B.n, b = B.b, N = n * n, out = [], cand = [];
    if(MARK.length < N) MARK = new Uint16Array(N);
    if(++MARKN > 65000){ MARK.fill(0); MARKN = 1; }
    /* 후보: 5칸 창 안에 c 3개 + 빈칸 2개(다른 것 없음)인 창의 빈칸. 창은 c 돌마다 그 돌이 창의 첫 c 돌인 것만 본다(중복 없음) */
    for(let i = 0; i < N; i++){
      if(b[i] !== c) continue; const x = i % n, y = (i / n) | 0;
      for(const [dx, dy] of DIRS) for(let s = -4; s <= 0; s++){
        const sx = x + dx * s, sy = y + dy * s, ex = sx + dx * 4, ey = sy + dy * 4;
        if(sx < 0 || sx >= n || sy < 0 || sy >= n || ex < 0 || ex >= n || ey < 0 || ey >= n) continue;
        let k = 0, e1 = -1, e2 = -1, bad = false;
        for(let t = 0; t < 5; t++){
          const j = (sy + dy * t) * n + sx + dx * t, v = b[j];
          if(v === c){ if(!k && t !== -s){ bad = true; break; } k++; }
          else if(v === EMPTY){ if(e1 < 0) e1 = j; else if(e2 < 0) e2 = j; else { bad = true; break; } }
          else { bad = true; break; }
        }
        if(bad || k !== 3) continue;
        if(MARK[e1] !== MARKN){ MARK[e1] = MARKN; cand.push(e1); }
        if(MARK[e2] !== MARKN){ MARK[e2] = MARKN; cand.push(e2); }
      }
    }
    for(const j of cand){ b[j] = c; const f = fivesThrough(B, j, c).length; b[j] = EMPTY; if(f) out.push([f, j]); }
    return out.sort((p, q) => q[0] - p[0] || p[1] - q[1]).map(p => p[1]);
  }
  /* 공격 쪽 수 목록(가장 짧은 것)을 돌려줌. 길이 = 공격 쪽이 두는 수(마지막 5목 포함) */
  function vcfSolve(B, c, maxD, cap = 30000){
    const st = { nodes:0, cap };
    for(let d = 1; d <= maxD; d++){ const r = vcfRec(B, c, d, st); if(r) return r; if(st.nodes > st.cap) return null; }
    return null;
  }
  function vcfRec(B, c, d, st){
    if(++st.nodes > st.cap) return null;
    const o = other(c);
    const my5 = fivePts(B, c); if(my5.length) return [my5[0]];
    if(d <= 1) return null;
    const op5 = fivePts(B, o);
    if(op5.length >= 2) return null;
    const list = op5.length === 1 ? [op5[0]] : fourMoves(B, c);
    for(const m of list){
      if(B.b[m] !== EMPTY || (c === BLACK && isForbidden(B, m))) continue;
      B.b[m] = c;
      const f = fivesThrough(B, m, c);
      let res = null;
      if(f.length >= 2) res = [m, f[0]];                                  /* 상대는 한 곳만 막을 수 있음 */
      else if(f.length === 1){
        const bl = f[0];
        if(o === BLACK && isForbidden(B, bl)) res = [m, bl];               /* 흑이 금지 자리라 못 막음 */
        else { B.b[bl] = o; const r = vcfRec(B, c, d - 1, st); B.b[bl] = EMPTY; if(r) res = [m].concat(r); }
      }
      B.b[m] = EMPTY;
      if(res) return res;
      if(st.nodes > st.cap) return null;
    }
    return null;
  }

  /* ===================== 판 꾸미기(바위·먼저 깔린 돌)·묘수 만들기 (rng만) ===================== */
  function placeRocks(B, k, rng){
    const n = B.n, h = n >> 1; let put = 0;
    for(let t = 0; t < 400 && put < k; t++){
      const x = 1 + Math.floor(rng() * (n - 2)), y = 1 + Math.floor(rng() * (n - 2));
      if(Math.abs(x - h) <= 1 && Math.abs(y - h) <= 1) continue;
      let near = false; for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++) if(at(B, x + dx, y + dy) === ROCK && x + dx >= 0 && y + dy >= 0 && x + dx < n && y + dy < n) near = true;
      if(near || B.b[y * n + x] !== EMPTY) continue;
      B.b[y * n + x] = ROCK; put++;
    }
  }
  function placePre(B, pairs, rng){
    const n = B.n, h = n >> 1;
    for(let k = 0; k < pairs * 2; k++){
      const c = k % 2 ? WHITE : BLACK;
      for(let t = 0; t < 200; t++){
        const x = h - 3 + Math.floor(rng() * 7), y = h - 3 + Math.floor(rng() * 7), i = y * n + x;
        if(B.b[i] !== EMPTY || (x === h && y === h)) continue;
        B.b[i] = c; let bad = false;
        for(let d = 0; d < 4; d++){ const o = dirInfo(B, i, c, d); if(o.five || o.nF || o.open3 || o.three) bad = true; }
        if(bad){ B.b[i] = EMPTY; continue; }
        break;
      }
    }
  }
  /* 판 만들기용 빠른 수 고르기: 창 점수만(공격 쪽은 공격 위주, 수비 쪽은 허술하게) + rng 흔들림. 5목·5목 막기는 지킴 */
  const LINE = new Int8Array(9);
  /* 빈 칸 i의 창 점수(c 쪽 aw배 + 상대 쪽 dw배): 방향마다 9칸을 한 번만 읽음 */
  function winScore2(B, i, c, aw, dw){
    const n = B.n, x = i % n, y = (i / n) | 0, o = other(c); let s = 0;
    for(const [dx, dy] of DIRS){
      for(let t = -4; t <= 4; t++) LINE[t + 4] = t ? at(B, x + dx * t, y + dy * t) : EMPTY;
      for(let st = 0; st <= 4; st++){
        let kc = 0, ko = 0, bc = false, bo = false;
        for(let t = st; t < st + 5; t++){ const v = LINE[t]; if(v === c){ kc++; bo = true; } else if(v === o){ ko++; bc = true; } else if(v !== EMPTY){ bc = bo = true; } }
        if(!bc) s += aw * WS[kc + 1]; if(!bo) s += dw * WS[ko + 1];
      }
    }
    return s;
  }
  function quickPick(B, c, aw, dw, rng){
    const o = other(c), cs = cands(B, 1);
    const f5 = fivePts(B, c); if(f5.length) return f5[0];
    const o5 = fivePts(B, o).filter(i => legal(B, i, c)); if(o5.length) return o5[0];
    const sc = cs.map(i => [winScore2(B, i, c, aw, dw) * (.75 + rng() * .5), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    for(const [, i] of sc) if(legal(B, i, c)) return i;
    return -1;
  }
  /* 묘수: 빠른 AI끼리 두게 해 국면을 만들고, side 차례에 '가장 짧은 연속 4 승리가 정확히 N수'인 판을 고른다(탐색기로 확인).
     끝내 못 찾으면 찾은 것 중 N에 가장 가까운 판(그래도 반드시 이길 수 있음). */
  function makePuzzle(rng, o){
    const side = o.side || BLACK; let best = null;
    const maxSt = o.n >= 15 ? 34 : 26;   /* 돌이 너무 많은 판은 읽기 어려워서 버림 */
    for(let g = 0; g < 120; g++){
      const B = mkB(o.n); if(o.rocks) placeRocks(B, o.rocks, rng);
      let turn = BLACK, moves = 0;
      const h = o.n >> 1;
      for(let mv = 0; mv < maxSt; mv++){
        if(turn === side && moves >= 8){
          if(!fivePts(B, other(side)).length && !fivePts(B, side).length && fourMoves(B, side).length){
            const v = vcfSolve(B, side, o.N, 4000);
            if(v){
              const rec = { b:B.b.slice(), n:B.n, side, sol:v, N:v.length, games:g + 1 };
              if(v.length === o.N) return rec;   /* 얕은 깊이를 노드 제한 없이 다 본 뒤에야 답이 나오므로 N이 가장 짧은 길 */
              if(!best || v.length > best.N) best = rec;
              break;   /* 더 짧은 묘수가 생긴 판 → 새 판으로 */
            }
          }
        }
        let i;
        if(moves === 0){ i = (h + Math.floor(rng() * 3) - 1) * o.n + h + Math.floor(rng() * 3) - 1; if(B.b[i] !== EMPTY) i = h * o.n + h; }
        else i = turn === side ? quickPick(B, turn, 1, .55, rng) : quickPick(B, turn, .8, .4, rng);
        if(i < 0 || !legal(B, i, turn)) break;
        const win = fiveAt(B, i, turn) >= 0; B.b[i] = turn; moves++;
        if(win || isFull(B)) break;
        turn = other(turn);
      }
    }
    if(best) return best;
    /* 비상: 아주 단순한 열린 3 판(반드시 이김) */
    const B = mkB(o.n), h = o.n >> 1, n = o.n, s = side, t = other(side);
    [[h - 1, h], [h, h], [h + 1, h]].forEach(([x, y]) => { B.b[y * n + x] = s; });
    [[h, h - 1], [h + 1, h + 1], [h - 2, h + 2]].forEach(([x, y]) => { B.b[y * n + x] = t; });
    return { b:B.b, n, side, sol:vcfSolve(B, s, 3) || [], N:2, games:0 };
  }

  /* ===================== 솔로 단계 표 · 개념 사이클 ===================== */
  const CONC = {
    order:['rock', 'white', 'tiny', 'pre'],
    info:{
      rock:{ name:'바위 칸', desc:'판 곳곳에 아무도 둘 수 없는 바위가 있어요. 바위는 줄을 끊어요 — 바위 너머로는 이어지지 않아요.' },
      white:{ name:'백으로 두기', desc:'이번엔 내가 백이에요. AI 흑이 먼저 두고, 3·3 금지는 흑에게만 있어요. 묘수풀이도 백으로 풀어요.' },
      tiny:{ name:'작은 판', desc:'11×11 작은 판이에요. 칸이 커서 두기 쉽지만 공격과 수비가 금방 부딪혀요.' },
      pre:{ name:'먼저 깔린 돌', desc:'AI 대국이 판 가운데에 흑·백 돌이 몇 개 놓인 채로 시작해요. 처음부터 수 싸움이에요.' }
    },
    twists:['flash', 'bare', 'tight', 'deep', 'fog'],
    twInfo:{
      flash:{ name:'번개', desc:'AI 대국은 한 수 10초! 묘수풀이는 제한 시간이 짧아요.' },
      bare:{ name:'맨손', desc:'힌트와 무르기 없이 실력으로만 둬요.' },
      tight:{ name:'외줄 타기', desc:'묘수풀이는 다시 하기·여유 수 없이 딱 정해진 수 안에. AI 대국은 무르기 없이, 시간을 넘기면 바로 져요.' },
      deep:{ name:'깊은 수', desc:'묘수는 한 수 더 길고, AI는 한 단계 더 세요.' },
      fog:{ name:'안개', desc:'상대가 마지막에 둔 자리와 3·3 금지 표시가 보이지 않아요. 판을 잘 살펴요!' }
    }
  };
  const RULE_TIP = { rock:'바위는 줄을 끊어요', white:'나는 백', tiny:'11×11 판', pre:'돌이 깔린 채 시작', flash:'한 수 10초', bare:'힌트·무르기 없음', tight:'한 번에 끝까지', deep:'더 깊은 수', fog:'마지막 수 표시 없음' };
  /* 자리 k: 1 AI(새 규칙 소개) · 2 묘수 · 3 AI · 4 묘수 · 5 AI(어려움) · 6 묘수(변주 소개) · 7 AI · 8 묘수 · 9 묘수(쉬어가기) · 10 AI(보스) */
  const KIND = [null, 'ai', 'pz', 'ai', 'pz', 'ai', 'pz', 'ai', 'pz', 'pz', 'ai'];
  const AI_NAME = ['쉬움', '보통', '어려움'];
  function stageCfg(n){
    const p = planOf('omok', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    const kind = KIND[k], size = has('tiny') ? 11 : 15, me = has('white') ? WHITE : BLACK;
    let ai = c === 1 ? 0 : c <= 4 ? 1 : 2;
    if(p.hard || p.boss) ai++; if(p.easy) ai--; if(tw === 'deep') ai++;
    ai = Math.max(0, Math.min(2, ai));
    let N = c === 1 ? (k === 8 ? 3 : 2) : c === 2 ? (k === 2 ? 2 : 3) : c <= 4 ? (k === 8 ? 4 : 3) : 4;
    if(k === 9) N = Math.max(2, N - 1); if(tw === 'deep') N = Math.min(4, N + 1);   /* 5수 묘수는 만들기가 느려서(평균 0.3초) 4수까지 */
    const rocks = has('rock') ? (size === 11 ? 4 : 6) + (p.boss ? 2 : 0) : 0;
    const tight = tw === 'tight', bare = tw === 'bare' || tight;
    const cfg = { kind, n:size, me, side:me, ai, rocks, pre:has('pre') && kind === 'ai' ? 3 : 0, fog:tw === 'fog',
      turn:tw === 'flash' ? 10 : 30, tight, mj:mj.slice(), tw, boss:p.boss, hard:p.hard, stage:n };
    if(kind === 'pz') Object.assign(cfg, { N, extra:tight ? 0 : 2, tries:tight ? 1 : 3, hints:bare ? 0 : 1, limit:Math.round((60 + 40 * N) * (tw === 'flash' ? .6 : 1) / 5) * 5 });
    else Object.assign(cfg, { hints:bare ? 0 : 2, undos:bare ? 0 : 2, limit:0 });
    return cfg;
  }
  function stageText(c){
    const side = c.kind === 'pz' ? c.side : c.me;
    return c.kind === 'pz' ? `묘수풀이 · ${CNAME(side)} ${c.N}수 안에 이기기 · ${mmss(c.limit)}${c.tries === 1 ? ' · 기회 1번' : ''}` : `AI 대국(${AI_NAME[c.ai]}) · 나는 ${CNAME(c.me)}${c.n === 11 ? ' · 11×11' : ''} · 한 수 ${c.turn}초`;
  }

  /* ===================== 화면 상태 ===================== */
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const cellName = (m, i) => COLS[i % m.B.n] + (m.B.n - ((i / m.B.n) | 0));
  const aiRng = m => mulberry(seedFrom(m.seedStr + ':' + m.hist.join(',')));
  const myTurn = m => m.turn === m.me && !m.over && !m.busy;
  const isDuel = () => !!(G && G.duel);
  const duelLive = () => !!(G && G.duel && G.duel.mode === 'pvp');
  let UID = 0;

  function initPuzzle(cfg, rng, m){
    const pz = makePuzzle(rng, { n:cfg.n || 15, N:cfg.N || 3, side:cfg.side || BLACK, rocks:cfg.rocks || 0 });
    m.B = { n:pz.n, b:Int8Array.from(pz.b) }; m.b0 = Int8Array.from(pz.b);
    m.me = pz.side; m.opp = other(pz.side); m.turn = pz.side; m.turn0 = pz.side;
    m.N = pz.N; m.sol = pz.sol; m.maxMoves = pz.N + (cfg.extra == null ? 2 : cfg.extra);
    m.tries = cfg.tries || 3; m.triesLeft = m.tries; m.aiLv = 2;
  }
  function initMatch(cfg, rng, m){
    const B = mkB(cfg.n || 15);
    if(cfg.rocks) placeRocks(B, cfg.rocks, rng);
    if(cfg.pre) placePre(B, cfg.pre, rng);
    m.B = B; m.b0 = B.b.slice(); m.turn = BLACK; m.turn0 = BLACK;
    m.me = cfg.me || BLACK; m.opp = other(m.me); m.aiLv = cfg.ai == null ? 1 : cfg.ai;
  }

  /* ----- 화면 조각 ----- */
  function stoneSvg(c, x, y, cls){
    const u = S().uid;
    if(c === ROCK) return `<g class="om-rock${cls ? ' ' + cls : ''}"><path d="M${x - 4.2} ${y + 1.6}l1.2-4 3.4-1.8 3.4 .8 1.6 3.4-1.3 3-3.9 .9z" fill="#9C97B4" stroke="${OL}" stroke-width=".7" stroke-linejoin="round"/><path d="M${x - 2.4} ${y - 1.6}l2.2 1.2 1.2 2.6M${x - .2} ${y - .4}l2.8-1.6" fill="none" stroke="#6E6988" stroke-width=".55" stroke-linecap="round"/></g>`;
    return `<g class="om-st${cls ? ' ' + cls : ''}" style="--x:${x}px;--y:${y}px"><circle cx="${x}" cy="${y + .5}" r="4.45" fill="rgba(40,20,0,.25)"/><circle cx="${x}" cy="${y}" r="4.45" fill="url(#om${c === BLACK ? 'B' : 'W'}${u})" stroke="${c === BLACK ? '#0A0618' : '#8E84B0'}" stroke-width=".45"/><ellipse cx="${x - 1.5}" cy="${y - 1.7}" rx="1.5" ry=".95" transform="rotate(-30 ${x - 1.5} ${y - 1.7})" fill="#fff" opacity="${c === BLACK ? .35 : .9}"/></g>`;
  }
  const P = i => { const n = S().B.n; return [5 + (i % n) * 10, 5 + ((i / n) | 0) * 10]; };
  function boardSvg(){
    const m = S(), n = m.B.n, W = n * 10, u = m.uid;
    let g = '';
    for(let k = 0; k < n; k++){ const p = 5 + k * 10; g += `M5 ${p}H${W - 5}M${p} 5V${W - 5}`; }
    const h = n >> 1, q = n === 15 ? 3 : 2;
    const stars = [[q, q], [n - 1 - q, q], [h, h], [q, n - 1 - q], [n - 1 - q, n - 1 - q]].map(([x, y]) => `<circle cx="${5 + x * 10}" cy="${5 + y * 10}" r="1.1" fill="#6B4A1F"/>`).join('');
    return `<svg class="om-svg" id="omSvg" viewBox="0 0 ${W} ${W}" role="img" aria-label="${n}×${n} 오목 판">
      <defs><radialGradient id="omB${u}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#5B5578"/><stop offset=".55" stop-color="#211B3A"/><stop offset="1" stop-color="#0B0716"/></radialGradient>
      <radialGradient id="omW${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".65" stop-color="#F3EFFF"/><stop offset="1" stop-color="#C9C0E6"/></radialGradient></defs>
      <path d="${g}" stroke="#7A5428" stroke-width=".42" opacity=".85" fill="none"/>
      <rect x="5" y="5" width="${W - 10}" height="${W - 10}" fill="none" stroke="#6B4A1F" stroke-width=".8"/>${stars}
      <g id="omGuide"></g><g id="omStones"></g><g id="omMarks"></g><g id="omPrev"></g></svg>`;
  }
  function drawStones(newI){
    const m = S(), el = $('#omStones'); if(!el) return;
    let h = '';
    for(let i = 0; i < m.B.b.length; i++){ const v = m.B.b[i]; if(v === EMPTY) continue; const [x, y] = P(i); h += stoneSvg(v, x, y, i === newI ? 'om-new' : (m.win && m.win.includes(i) ? 'om-wins' : '')); }
    el.innerHTML = h;
    drawMarks();
  }
  function drawMarks(){
    const m = S(), el = $('#omMarks'); if(!el) return;
    let h = '';
    const last = m.hist.length ? m.hist[m.hist.length - 1] : -1;
    if(m.win){ const pts = m.win.map(P).sort((p, q) => p[0] - q[0] || p[1] - q[1]); h += `<path class="om-winline" d="M${pts[0][0]} ${pts[0][1]}L${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}"/>`; }
    else if(last >= 0 && !m.fog){ const [x, y] = P(last); h += `<circle class="om-last" cx="${x}" cy="${y}" r="1.35" fill="${m.B.b[last] === BLACK ? '#FF5A6E' : '#E5484D'}"/>`; }
    /* 내 차례이고 내가 흑이면 3·3 금지 자리에 × */
    if(!m.fog && m.me === BLACK && m.turn === BLACK && !m.over && m.forbidAt !== m.hist.length){ m.forbidAt = m.hist.length; m.forbid = cands(m.B).filter(i => isForbidden(m.B, i)); }
    if(!m.fog && m.me === BLACK && m.turn === BLACK && !m.over && m.forbid) m.forbid.forEach(i => { const [x, y] = P(i); h += `<path class="om-ban" d="M${x - 2.2} ${y - 2.2}l4.4 4.4M${x + 2.2} ${y - 2.2}l-4.4 4.4"/>`; });
    el.innerHTML = h;
  }
  function drawPreview(){
    const m = S(), el = $('#omPrev'), gd = $('#omGuide'), btn = $('#omPut'), co = $('#omCoord'); if(!el) return;
    const i = m.preview;
    if(i == null || !myTurn(m)){ el.innerHTML = ''; if(gd) gd.innerHTML = ''; if(btn){ btn.disabled = true; btn.querySelector('small').textContent = ''; } if(co) co.innerHTML = myTurn(m) ? '자리를 눌러 골라요' : (m.over ? '' : '상대 차례'); return; }
    const [x, y] = P(i), W = m.B.n * 10, ban = m.me === BLACK && isForbidden(m.B, i);
    gd.innerHTML = `<path d="M5 ${y}H${W - 5}M${x} 5V${W - 5}" class="om-guide"/>`;
    el.innerHTML = `<g class="om-ghost${ban ? ' ban' : ''}">${stoneSvg(m.me, x, y)}</g><circle cx="${x}" cy="${y}" r="6.3" class="om-ring${ban ? ' ban' : ''}"/>`;
    if(btn){ btn.disabled = ban; btn.querySelector('small').textContent = cellName(m, i); }
    if(co) co.innerHTML = ban ? '<b class="bad">3·3 금지 자리예요</b>' : '<b>' + cellName(m, i) + '</b> 맞으면 [두기] · 같은 자리를 한 번 더 눌러도 돼요';
  }
  function msg(html, cls){ const e = $('#omMsg'); if(!e) return; e.className = 'om-msg ' + (cls || ''); e.innerHTML = html; }
  function turnMsg(){
    const m = S(); if(m.over) return;
    if(m.mode === 'pz'){ msg(m.turn === m.me ? `<span><b class="sm">${CNAME(m.me)} 차례</b> · ${m.myMoves + 1}번째 수 / 최대 ${m.maxMoves}수</span>` : '<span>상대가 막는 중…</span>'); return; }
    if(m.turn === m.me) msg(`<span><b class="sm">내 차례</b> · ${CNAME(m.me)}${m.me === BLACK && !m.fog ? ' · × 자리는 3·3 금지' : ''}</span>`);
    else msg(`<span class="om-think">${oppName(m)} 생각 중<i></i><i></i><i></i></span>`);
  }
  function oppName(m){ return m.mode === 'duel' && G.duel ? (G.duel.mode === 'pvp' ? esc(G.duel.opp.nick || '상대') : 'AI') : 'AI' + (m.mode === 'ai' ? '(' + AI_NAME[m.aiLv] + ')' : ''); }
  function hud(){
    const m = S(); if(!m) return;
    const mv = $('#omMv'); if(mv) mv.textContent = m.mode === 'pz' ? m.myMoves + '/' + m.maxMoves : m.myMoves;
    const h = $('#omHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || !myTurn(m); }
    const bk = $('#omBack'); if(bk){ const left = m.mode === 'pz' ? m.triesLeft - 1 : m.undoLeft; bk.querySelector('b').textContent = Math.max(0, left); bk.disabled = left <= 0 || m.over || m.busy || (m.mode === 'pz' ? m.myMoves === 0 : (m.turn !== m.me || m.myMoves === 0)); }
    const lv = $('#omLives'); if(lv && m.mode === 'pz'){ const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C6 17 2.5 13.6 2.5 9.2 2.5 6.3 4.7 4 7.4 4c1.9 0 3.5 1 4.6 2.6C13.1 5 14.7 4 16.6 4c2.7 0 4.9 2.3 4.9 5.2 0 4.4-3.5 7.8-9.5 11.8z" fill="currentColor" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg>';
      lv.innerHTML = Array.from({ length:m.tries }, (_, k) => `<i class="om-heart${k >= m.triesLeft ? ' off' : ''}">${HEART}</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + m.triesLeft + '번'); }
    const me = $('#omMe'), op = $('#omOp');
    if(me) me.classList.toggle('on', m.turn === m.me && !m.over);
    if(op) op.classList.toggle('on', m.turn !== m.me && !m.over);
    m.best = bestLine(m.B, m.me); m.oppBest = bestLine(m.B, m.opp);
  }

  /* ----- 배치 ----- */
  function layout(){
    const m = S(), wrap = $('#omBoard'), root = document.querySelector('.ng-omok'); if(!wrap || !root || !m) return;
    const W = Math.min(root.clientWidth || 360, 520);
    const top = wrap.getBoundingClientRect().top + (window.scrollY || 0);
    const H = (innerHeight || 760) - top - 78;
    const s = Math.max(250, Math.floor(Math.min(W, H)));
    wrap.style.width = s + 'px'; wrap.style.height = s + 'px';
  }
  function cellFromEvent(e){
    const m = S(), svg = $('#omSvg'); if(!svg) return -1;
    const r = svg.getBoundingClientRect(), n = m.B.n;
    const x = Math.round(((e.clientX - r.left) / r.width * n * 10 - 5) / 10), y = Math.round(((e.clientY - r.top) / r.height * n * 10 - 5) / 10);
    if(x < 0 || y < 0 || x >= n || y >= n) return -1;
    return y * n + x;
  }

  /* ----- 두기 ----- */
  function playerPut(i){
    const m = S();
    if(!myTurn(m) || G.over || G.paused || (isDuel() && !G.duel.go)) return;
    if(m.B.b[i] !== EMPTY){ return; }
    if(m.me === BLACK && isForbidden(m.B, i)){ sfx('omokBan'); msg('<b class="bad">3·3 금지</b><span>흑은 열린 3을 두 줄 만들 수 없어요</span>', 'om-pop'); try{ fxShake($('#omBoard'), 3); }catch(_){} T(turnMsg, 1400); return; }
    m.preview = null; m.myMoves++;
    if(m.mode === 'duel' && duelLive()){ m.myMv.push(i); pubMoves(); }
    put(i, m.me);
  }
  function put(i, c){
    const m = S();
    const line = winLine(m.B, i, c);
    m.B.b[i] = c; m.hist.push(i); m.turnUsed = 0; m.oppWait = 0;
    drawStones(i); drawPreview();
    sfx(c === m.me ? 'omokPut' : 'omokPutOpp', { c }); fxBuzz(10);
    try{ const svg = $('#omSvg'); if(svg && !FXR.reduce){ const r = svg.getBoundingClientRect(), [x, y] = P(i), k = r.width / (m.B.n * 10); fxRing(r.left + x * k, r.top + y * k, c === BLACK ? '#6B5BD6' : '#FFFFFF', 14, .35, 3); } }catch(_){}
    if(line){ m.win = line; m.winner = c; drawStones(-1); end(c === m.me ? 'win' : 'lose'); return; }
    if(isFull(m.B)){ end('draw'); return; }
    m.turn = other(c); hud(); turnMsg(); drawMarks();
    if(m.mode === 'pz' && c === m.me && m.myMoves >= m.maxMoves){ pzFail('moves'); return; }
    nextTurn();
  }
  /* 상대(AI) 차례면 AI가 둔다. 실시간 대전 상대면 상대 수를 기다린다 */
  function nextTurn(){
    const m = S(); if(m.over) return;
    if(m.turn === m.me){ hud(); drawPreview(); return; }
    if(m.mode === 'duel' && duelLive()) return;   /* 상대 수는 loop의 readOpp가 넣음 */
    m.busy = true; hud();
    const go = () => {
      if(G.paused || (isDuel() && !G.duel.go)){ T(go, 200); return; }
      const t0 = performance.now(), i = aiPick(m.B, m.opp, m.aiLv, aiRng(m));
      m.lastAiMs = performance.now() - t0;
      m.busy = false;
      if(i < 0){ end('draw'); return; }
      put(i, m.opp);
    };
    T(go, m.mode === 'pz' ? 420 : 520);
  }
  function end(r){
    const m = S(); if(m.over) return;
    m.over = true; m.result = r; m.sec = elapsed(); m.preview = null; drawPreview(); hud();
    if(m.mode === 'pz' && r !== 'win'){ m.over = false; pzFail(r === 'draw' ? 'draw' : 'lose'); return; }
    if(r === 'win'){
      msg(`<b>${m.mode === 'pz' ? '묘수 성공!' : '5목 완성!'}</b>`, 'om-win');
      sfx('win', { g:'omok' }); fxBuzz([30, 50, 30]);
      winFx();
      if(G.duel) G.duel.why = m.forfeit ? m.forfeit : '내가 먼저 5목을 만들었어요';
      T(() => finish(true), 1100);
    } else {
      msg(r === 'draw' ? '<b class="boss">판이 가득 찼어요</b><span>무승부</span>' : `<b class="bad">${oppName(m)}의 5목</b>`, 'om-pop');
      sfx('omokLose'); fxBuzz([40, 40, 60]);
      try{ fxShake($('#omBoard'), 5); }catch(_){}
      if(G.duel){
        const D = G.duel;
        D.why = r === 'draw' ? '판이 가득 차서 무승부예요' : '상대가 먼저 5목을 만들었어요';
        if(D.mode === 'ai'){ D.opp.dn = 1; D.opp.sc = r === 'draw' ? 0 : 600 + Math.max(0, 300 - m.hist.length * 4); D.opp.pg = r === 'draw' ? 1 : 1; }
      }
      T(() => finish(false), 1400);
    }
  }
  function winFx(){
    try{
      const m = S(), svg = $('#omSvg'); if(!svg || !m.win) return;
      const r = svg.getBoundingClientRect(), k = r.width / (m.B.n * 10);
      m.win.forEach((i, n) => { const [x, y] = P(i); T(() => { try{ fxBurst(r.left + x * k, r.top + y * k, ['#FFE27A', '#FF8FC8', '#fff'], 10, { speed:220, size:4.5, kinds:['star', 'dot', 'spark'], up:100, g:460, glow:true, dur:.6 }); }catch(_){} }, n * 70); });
      fxPunch($('#omBoard'), 1.03);
    }catch(_){}
  }
  /* 묘수 한 번 실패 → 기회가 남으면 처음 판으로 */
  function pzFail(why){
    const m = S(); m.busy = true; m.over = true;
    m.triesLeft--; m.retries++;
    const left = m.triesLeft;
    msg(`<b class="bad">${why === 'moves' ? '수를 다 썼어요' : why === 'time' ? '시간이 다 됐어요' : why === 'reset' ? '처음부터 다시' : '상대가 이겼어요'}</b><span>${left > 0 ? '기회 ' + left + '번 남음' : '기회를 다 썼어요'}</span>`, 'om-pop');
    sfx(why === 'reset' ? 'omokUndo' : 'omokLose'); if(why !== 'reset') try{ fxShake($('#omBoard'), 5); }catch(_){}
    hud();
    if(left <= 0 || why === 'time'){ m.fail = why; m.result = 'lose'; T(() => finish(false), 1300); return; }
    T(() => { pzReset(); }, why === 'reset' ? 350 : 1300);
  }
  function pzReset(){
    const m = S();
    m.B.b = Int8Array.from(m.b0); m.hist = []; m.turn = m.turn0; m.myMoves = 0; m.win = null; m.over = false; m.busy = false; m.preview = null; m.forbidAt = null; m.result = null;
    drawStones(-1); drawPreview(); hud(); turnMsg();
  }
  function useHint(){
    const m = S(); if(!myTurn(m) || m.hintLeft <= 0 || G.over) return;
    let i = -1;
    if(m.mode === 'pz'){
      const left = m.maxMoves - m.myMoves, v = vcfSolve(m.B, m.me, Math.min(left, m.N + 2), 20000);
      if(v) i = v[0];
      else { msg('<b class="boss">지금은 길이 없어요</b><span>[다시]로 처음부터 해 봐요</span>', 'om-pop'); T(turnMsg, 1800); return; }
    } else i = aiPick(m.B, m.me, 2, aiRng(m));
    if(i < 0) return;
    m.hintLeft--; m.hints++; sfx('omokHint');
    m.preview = i; drawPreview(); hud();
    const svg = $('#omSvg'); if(svg){ const [x, y] = P(i); $('#omPrev').insertAdjacentHTML('beforeend', `<circle cx="${x}" cy="${y}" r="7.5" class="om-hintring"/>`); }
  }
  function useBack(){
    const m = S(); if(m.over || m.busy || G.over) return;
    if(m.mode === 'pz'){ if(m.triesLeft <= 1 || m.myMoves === 0) return; pzFail('reset'); return; }
    if(m.undoLeft <= 0 || m.turn !== m.me || m.myMoves === 0) return;
    /* 무르기: 상대 수와 내 수를 하나씩 되돌림 */
    let k = 0;
    while(m.hist.length && k < 2){ const i = m.hist.pop(); m.B.b[i] = EMPTY; k++; }
    m.turn = m.me; m.myMoves--; m.undoLeft--; m.undos++; m.preview = null; m.forbidAt = null;
    sfx('omokUndo'); drawStones(-1); drawPreview(); hud(); turnMsg();
  }
  /* 차례 시간 초과: 대신 둠(보통 AI) — 외줄 타기는 바로 짐 */
  function timeOut(){
    const m = S(); if(!myTurn(m)) return;
    if(m.tight){ m.fail = 'turn'; m.result = 'lose'; m.over = true; msg('<b class="bad">시간 초과</b><span>외줄 타기 — 이번 판은 여기까지</span>', 'om-pop'); sfx('omokLose'); T(() => finish(false), 1300); return; }
    const i = m.preview != null && legal(m.B, m.preview, m.me) ? m.preview : aiPick(m.B, m.me, 1, aiRng(m));
    if(i < 0){ end('draw'); return; }
    toast('시간이 다 돼서 대신 뒀어요'); m.autoPut++;
    playerPut(i);
  }

  /* ----- 실시간 대전: 엔진 방(D.nr) presence.om.mv에 내 수를 쌓고, 상대 것을 읽어 차례대로 둔다 ----- */
  function pubMoves(){ const D = G.duel, m = S(); try{ D.nr.presence({ om:{ v:1, c:m.me, mv:m.myMv.slice() } }).catch(() => {}); }catch(_){} }
  function readOpp(){
    const m = S(), D = G.duel; if(!D || !D.nr || m.over) return;
    let ps = []; try{ ps = D.nr.peers(); }catch(_){ return; }
    const o = ps.find(p => !p.sameTab && p.peer === D.oppPeer) || ps.find(p => !p.sameTab);
    const q = o && o.presence && o.presence.om; if(!q || !Array.isArray(q.mv)) return;
    if(typeof q.c === 'number' && q.c === m.me && !m.colorWarn){ m.colorWarn = 1; console.warn('omok: 두 사람이 같은 색으로 잡힘'); }
    while(q.mv.length > m.oppMv.length && m.turn === m.opp && !m.over){
      const i = q.mv[m.oppMv.length];
      if(!(typeof i === 'number' && legal(m.B, i, m.opp))){ console.warn('omok: 상대 수가 맞지 않음', i); m.oppMv.push(i); continue; }
      m.oppMv.push(i); put(i, m.opp);
    }
  }
  function myColorInDuel(D, rng){
    const coin = rng() < .5;
    if(D.mode !== 'pvp') return coin ? BLACK : WHITE;
    const clean = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const parts = String(D.seed || '').split(':')[0].replace(/^du-/, '').split('-');
    let myId = ''; try{ const me = D.nr.peers().find(p => p.sameTab); myId = me ? clean(me.peer) : ''; }catch(_){}
    const opId = clean(D.oppPeer || '');
    let iAmA;
    if(myId === parts[0] || myId === parts[1]) iAmA = myId === parts[0];
    else iAmA = opId === parts[1];
    return iAmA === coin ? BLACK : WHITE;
  }

  /* ----- 시계 ----- */
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const m = S(), now = performance.now(), dt = m.lt ? Math.min(.25, (now - m.lt) / 1000) : 0; m.lt = now;
    if(isDuel() && !G.duel.go) return;
    if(isDuel() && !m.began){ m.began = true; turnMsg(); hud(); nextTurn(); }
    if(G.paused && !isDuel()) return;
    if(m.mode === 'duel' && duelLive() && now - (m.pollAt || 0) > 150){ m.pollAt = now; readOpp(); }
    if(m.over) return;
    const tEl = $('#omTime'), tP = $('#omTimeP');
    if(m.mode === 'pz'){
      const rem = Math.max(0, G.limit - elapsed()), sec = Math.ceil(rem);
      if(sec !== m.lastSec){ m.lastSec = sec; if(tEl) tEl.textContent = mmss(sec); if(tP) tP.classList.toggle('hurry', sec <= 10); if(sec <= 10 && sec > 0) sfx('omokTick', { hi:sec <= 5 }); }
      if(rem <= 0 && !m.busy){ m.fail = 'time'; m.result = 'lose'; m.over = true; msg('<b class="bad">시간이 다 됐어요</b>', 'om-pop'); sfx('omokLose'); T(() => finish(false), 1300); }
      return;
    }
    /* 차례 시간 */
    let rem;
    if(m.turn === m.me){ if(!m.busy) m.turnUsed += dt; rem = m.turnLim - m.turnUsed; }
    else { m.oppWait += dt; rem = m.turnLim - m.oppWait; }
    const sec = Math.max(0, Math.ceil(rem));
    if(sec !== m.lastSec || m.turn !== m.lastTurn){
      m.lastSec = sec; m.lastTurn = m.turn;
      if(tEl) tEl.textContent = sec + '초';
      if(tP){ tP.classList.toggle('hurry', m.turn === m.me && sec <= 5); tP.classList.toggle('opp', m.turn !== m.me); }
      if(m.turn === m.me && sec <= 5 && sec > 0) sfx('omokTick', { hi:sec <= 3 });
    }
    const bar = $('#omTurnBar'); if(bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, rem / m.turnLim))})`;
    if(m.turn === m.me && rem <= 0 && !m.busy) timeOut();
    /* 상대 무응답(실시간): 차례 시간 + 20초 지나도 안 두면 기권승 */
    if(m.turn !== m.me && duelLive() && m.oppWait > m.turnLim + 20){ m.forfeit = '상대가 시간 안에 두지 않아 기권승이에요'; m.winner = m.me; end('win'); }
  }

  /* ----- 그리기 ----- */
  function render(st){
    const m = S();
    /* 대전이 끊긴 뒤 '계속 풀기': AI(보통)와 이어서 둔다. 이미 끝난 판이면 새 판 */
    if(m.mode === 'duel' && !G.duel){
      m.mode = 'ai'; m.aiLv = 1; m.hintLeft = 0; m.undoLeft = 0; m.busy = false; m.timers.forEach(clearTimeout); m.timers.clear();
      if(m.over || m.win){ m.B = mkB(15); m.hist = []; m.turn = BLACK; m.me = BLACK; m.opp = WHITE; m.win = null; m.over = false; m.myMoves = 0; }
    }
    m.uid = 'o' + (++UID);
    const pz = m.mode === 'pz', duel = m.mode === 'duel';
    const stoneIco = c => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="${c === BLACK ? '#231B3E' : '#FFFFFF'}" stroke="${OL}" stroke-width="2"/><ellipse cx="9" cy="8.5" rx="3" ry="2" fill="#fff" opacity="${c === BLACK ? .35 : .9}"/></svg>`;
    const ICO = {
      clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
      hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/></svg>',
      back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5L4 10l5 5" fill="none" stroke="#1A0F45" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 10H14a6 6 0 0 1 0 12h-3" fill="none" stroke="#1A0F45" stroke-width="2.4" stroke-linecap="round"/></svg>',
      retry:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" fill="none" stroke="#1A0F45" stroke-width="2.4" stroke-linecap="round"/><path d="M18.5 2.5v4.5H14" fill="none" stroke="#1A0F45" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    const chips = G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="om-rules" aria-label="켜진 규칙">${m.boss ? '<span class="om-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="om-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="om-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : '';
    st.innerHTML = `<div class="ng-omok${pz ? ' is-pz' : ''}${duel ? ' is-duel' : ''}">
      <div class="om-hud">
        ${pz ? `<div class="om-pill om-goal" aria-label="목표"><span class="om-ic">${stoneIco(m.me)}</span><b>${m.N}수</b><small>묘수</small></div>
          <div class="om-pill om-time" id="omTimeP" aria-label="남은 시간"><span class="om-ic">${ICO.clock}</span><b id="omTime">${mmss(G.limit)}</b></div>`
        : `<div class="om-pill om-side" id="omMe" aria-label="나"><span class="om-ic">${stoneIco(m.me)}</span><b>나</b><small id="omMv">0</small></div>
          <div class="om-pill om-time" id="omTimeP" aria-label="차례 시간"><span class="om-ic">${ICO.clock}</span><b id="omTime">${m.turnLim}초</b><i class="om-tbar"><i id="omTurnBar"></i></i></div>
          <div class="om-pill om-side op" id="omOp" aria-label="상대"><span class="om-ic">${stoneIco(m.opp)}</span><b class="om-opn">${duel ? (G.duel && G.duel.mode === 'pvp' ? '상대' : 'AI') : 'AI'}</b></div>`}
        ${duel ? '' : `<button class="om-pill om-btn" id="omHint" aria-label="힌트"><span class="om-ic">${ICO.hint}</span><b>${m.hintLeft}</b></button>
        <button class="om-pill om-btn" id="omBack" aria-label="${pz ? '처음부터 다시' : '무르기'}"><span class="om-ic">${pz ? ICO.retry : ICO.back}</span><b>0</b></button>`}
      </div>
      ${chips}
      <div class="om-row">${pz ? '<div class="om-lives" id="omLives" role="img"></div>' : ''}<div class="om-msg" id="omMsg"><span>판을 놓는 중…</span></div></div>
      <div class="om-board" id="omBoard">${boardSvg()}</div>
      <div class="om-act"><p class="om-coord" id="omCoord" aria-live="polite"></p><button class="om-put" id="omPut" disabled>두기<small></small></button></div>
    </div>`;
    drawStones(-1); hud(); layout(); drawPreview(); turnMsg();
    wire();
    m.onResize = () => layout(); addEventListener('resize', m.onResize);
    if(G.raf) cancelAnimationFrame(G.raf);
    m.lt = 0; G.raf = requestAnimationFrame(loop);
    if(m.mode !== 'duel' || !G.duel) T(nextTurn, 300);
  }
  function wire(){
    const m = S(), bd = $('#omBoard');
    let downCell = -1, confirmOk = false;
    bd.onpointerdown = e => {
      if(!myTurn(m) || G.over) return;
      const i = cellFromEvent(e); if(i < 0 || m.B.b[i] !== EMPTY) return;
      e.preventDefault(); try{ bd.setPointerCapture(e.pointerId); }catch(_){}
      confirmOk = m.preview === i; downCell = i;
      if(!confirmOk){ m.preview = i; sfx('omokPick'); drawPreview(); }
    };
    bd.onpointermove = e => {
      if(downCell < 0) return;
      const i = cellFromEvent(e); if(i < 0 || i === m.preview || m.B.b[i] !== EMPTY) return;
      m.preview = i; confirmOk = false; downCell = i; drawPreview();
    };
    bd.onpointerup = e => {
      if(downCell < 0) return;
      const i = cellFromEvent(e), ok = confirmOk && i === m.preview; downCell = -1; confirmOk = false;
      if(ok) playerPut(i);
    };
    bd.onpointercancel = () => { downCell = -1; confirmOk = false; };
    bd.tabIndex = 0;
    bd.onkeydown = e => {
      if(!myTurn(m)) return;
      const n = m.B.n, c = m.preview == null ? (n >> 1) * n + (n >> 1) : m.preview, x = c % n, y = (c / n) | 0;
      const mv = { ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1] }[e.key];
      if(mv){ e.preventDefault(); const X = Math.max(0, Math.min(n - 1, x + mv[0])), Y = Math.max(0, Math.min(n - 1, y + mv[1])); m.preview = Y * n + X; drawPreview(); }
      else if((e.key === 'Enter' || e.key === ' ') && m.preview != null){ e.preventDefault(); playerPut(m.preview); }
    };
    $('#omPut').onclick = () => { if(m.preview != null) playerPut(m.preview); };
    const h = $('#omHint'); if(h) h.onclick = useHint;
    const b = $('#omBack'); if(b) b.onclick = useBack;
  }

  return {
    name:'오목', abil:'전략력', col:['#FFD9A8', '#E8963A', '#9A5A12'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3z" opacity=".25"/><path d="M3 8h18M3 13h18M3 18h18M8 3v18M13 3v18M18 3v18" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="8" cy="8" r="2.6"/><circle cx="13" cy="13" r="2.6"/><circle cx="18" cy="18" r="2.6"/><circle cx="13" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    art(){
      const u = 'omA' + Math.floor(performance.now() * 1000 % 1e6) + (++UID);
      const gx = 32, gy = 8, s = 12, N = 8;
      let lines = ''; for(let k = 0; k < N; k++) lines += `M${gx} ${gy + k * s}H${gx + (N - 1) * s}M${gx + k * s} ${gy}V${gy + (N - 1) * s}`;
      const st = (x, y, c, glow) => `${glow ? `<circle cx="${gx + x * s}" cy="${gy + y * s}" r="7.5" fill="#FFE27A" opacity=".7"/>` : ''}<circle cx="${gx + x * s}" cy="${gy + y * s}" r="5.2" fill="url(#${u}${c})" stroke="${c === 'b' ? '#0A0618' : '#8E84B0'}" stroke-width=".8"/><ellipse cx="${gx + x * s - 1.7}" cy="${gy + y * s - 1.9}" rx="1.7" ry="1.1" fill="#fff" opacity="${c === 'b' ? .35 : .9}"/>`;
      const W = [[2, 2], [5, 3], [3, 5], [6, 5], [2, 4], [4, 6]], B = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]];
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE4FF"/><stop offset="1" stop-color="#C8B6F2"/></linearGradient>
        <linearGradient id="${u}2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE2B0"/><stop offset="1" stop-color="#E9B66A"/></linearGradient>
        <radialGradient id="${u}b" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#5B5578"/><stop offset=".6" stop-color="#211B3A"/><stop offset="1" stop-color="#0B0716"/></radialGradient>
        <radialGradient id="${u}w" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#F3EFFF"/><stop offset="1" stop-color="#C9C0E6"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g fill="#fff" opacity=".5"><circle cx="12" cy="14" r="3"/><circle cx="148" cy="86" r="4"/><circle cx="146" cy="12" r="2.4"/><circle cx="16" cy="84" r="2"/></g>
        <rect x="${gx - 8}" y="${gy - 6}" width="${(N - 1) * s + 16}" height="${(N - 1) * s + 12}" rx="7" fill="url(#${u}2)" stroke="${OL}" stroke-width="2.4"/>
        <path d="${lines}" stroke="#7A5428" stroke-width=".8" opacity=".8"/>
        ${W.filter(([x, y]) => !B.some(b => b[0] === x && b[1] === y)).map(([x, y]) => st(x, y, 'w')).join('')}
        ${B.map(([x, y]) => st(x, y, 'b', true)).join('')}
        <path d="M${gx + s} ${gy + s}L${gx + 5 * s} ${gy + 5 * s}" stroke="#FF5A6E" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></svg>`;
    },
    help:[
      ['5개를 먼저 이어요', '흑이 먼저, 번갈아 줄이 만나는 점에 둬요. 가로·세로·대각선으로 내 돌 정확히 5개를 먼저 이으면 승리(6개 이상은 승리 아님).'],
      ['흑은 3·3 금지', '흑은 열린 3을 두 줄 한꺼번에 만드는 자리(판에 ×)에 둘 수 없어요. 4·4와 4·3은 괜찮아요. 백은 금지 자리가 없어요.'],
      ['누르고 [두기]', '자리를 누르면 반투명 돌과 안내선이 보여요. 끌어서 고치고, [두기]나 같은 자리를 한 번 더 눌러 확정해요.'],
      ['묘수풀이 · 솔로 · 대전', '오늘의 문제는 N수 안에 이기는 묘수풀이(상대는 늘 같은 방식으로 막음, 기회 3번). 솔로는 AI 대국과 묘수가 섞여 나오고, 대전은 실시간 1:1(한 수 30초).']
    ],
    helpExtra(){ const m = G && G.id === 'omok' && G.m; if(!m) return []; const tips = [].concat(m.mj || [], m.tw ? [m.tw] : []).map(k => RULE_TIP[k]).filter(Boolean); return tips.length ? [['이번 판 규칙', tips.join(' · ')]] : []; },
    chapters:['나무 그늘 쉼터', '돌담 골목', '달빛 정자', '바람 언덕', '별빛 대국장'],
    starRule:'★ 이기기 · ★★ 도움 1번 이하로 빨리 · ★★★ 도움 없이 가장 짧게',
    levels:{
      easy:{ kind:'pz', n:15, N:2, side:BLACK, extra:2, tries:3, hints:1, limit:150 },
      normal:{ kind:'pz', n:15, N:3, side:BLACK, extra:2, tries:3, hints:1, limit:180 },
      hard:{ kind:'pz', n:15, N:4, side:BLACK, extra:2, tries:3, hints:1, limit:210 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ return stageText(stageCfg(n)); },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `묘수풀이 · 흑 ${c.N}수 안에 이기기`; },
    init(cfg, rng){
      const duel = !!G.duel;
      const mode = duel ? 'duel' : cfg.kind === 'ai' ? 'ai' : 'pz';
      const m = G.m = { mode, hist:[], myMoves:0, hints:0, undos:0, retries:0, autoPut:0, preview:null, busy:false, over:false, win:null, winner:0,
        mj:cfg.mj || [], tw:cfg.tw || null, boss:!!cfg.boss, fog:!!cfg.fog, tight:!!cfg.tight, timers:new Set(), lt:0, turnUsed:0, oppWait:0, lastSec:-1,
        hintLeft:duel ? 0 : cfg.hints == null ? 1 : cfg.hints, undoLeft:cfg.undos || 0, turnLim:cfg.turn || 30, myMv:[], oppMv:[], best:0, oppBest:0, uid:'o0' };
      const t0 = performance.now();
      if(mode === 'pz') initPuzzle(cfg, rng, m);
      else if(mode === 'ai') initMatch(cfg, rng, m);
      else { initMatch({ n:15, ai:1 }, rng, m); m.me = myColorInDuel(G.duel, rng); m.opp = other(m.me); m.turnLim = 30; }
      m.genMs = performance.now() - t0;
      m.seedStr = 'om' + Math.floor(rng() * 1e9);
      G.limit = mode === 'pz' ? cfg.limit : 0;
      if(mode === 'pz') G.paws = Math.min(3, m.triesLeft);
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 묘수 정답 순서대로 두기 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.result){ res(m.result || null); return; }
          if(!myTurn(m) || (isDuel() && !G.duel.go)){ setTimeout(step, 80); return; }
          const v = vcfSolve(m.B, m.me, 6, 40000), i = v ? v[0] : aiPick(m.B, m.me, 2, aiRng(m));
          playerPut(i); setTimeout(step, 120);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _rules:{ mkB, cloneB, fiveAt, fivePts, isForbidden, legal, winLine, vcfSolve, aiPick, makePuzzle, cellEval, bestLine, stageCfg, BLACK, WHITE, ROCK, EMPTY },
    render,
    progress(){
      const m = G && G.m; if(!m) return 0;
      if(m.result === 'win' || m.result === 'draw') return 1;
      if(m.mode === 'pz') return Math.min(.95, m.myMoves / Math.max(1, m.N));
      return Math.min(.95, (m.best || 0) / 5);
    },
    lossText(){
      const m = G.m;
      if(m.mode === 'pz') return (m.fail === 'time' ? '시간이 다 됐어요. ' : '기회를 다 썼어요. ') + `${CNAME(m.me)} ${m.N}수 묘수였어요.`;
      if(m.fail === 'turn') return '차례 시간을 넘겼어요.';
      return m.result === 'draw' ? '판이 가득 차서 무승부예요.' : `상대가 먼저 5목을 만들었어요. 내 수 ${m.myMoves}개.`;
    },
    score(){
      const m = G.m, sec = Math.max(0, m.sec || elapsed());
      if(m.mode === 'pz'){
        const time = Math.max(0, 350 - Math.floor(Math.min(G.limit, sec) * 350 / G.limit));
        const extra = Math.max(0, 150 - 50 * Math.max(0, m.myMoves - m.N) - 40 * m.retries - 40 * m.hints);
        return { base:500, time, extra, rows:[`묘수 풀기 (${CNAME(m.me)} ${m.N}수)`, '시간 보너스 (' + mmss(sec) + ')', `내 수 ${m.myMoves} · 다시 ${m.retries} · 힌트 ${m.hints}`] };
      }
      const time = Math.max(0, 350 - Math.floor(Math.min(300, sec) * 350 / 300));
      const extra = Math.max(0, 150 - 6 * Math.max(0, m.myMoves - 5) - 40 * m.hints - 30 * m.undos);
      return { base:500, time, extra, rows:['5목 완성', '시간 보너스 (' + mmss(sec) + ')', `내 수 ${m.myMoves} · 힌트 ${m.hints} · 무르기 ${m.undos}`] };
    },
    stars(){
      const m = G.m;
      if(m.mode === 'pz') return m.myMoves <= m.N && !m.retries && !m.hints ? 3 : m.retries + m.hints <= 1 && m.myMoves <= m.N + 1 ? 2 : 1;
      const help = m.hints + m.undos;
      return !help && m.myMoves <= 15 ? 3 : help <= 1 && m.myMoves <= 22 ? 2 : 1;
    },
    duelHow:'실시간 1:1 · 번갈아 두기 · 한 수 30초',
    css:`
body[data-mode="omok"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.22) 0 3px, transparent 3.5px) 0 0/46px 46px,
  linear-gradient(180deg,#F1EBFF 0%,#D9CCF8 55%,#C3B1F0 100%) fixed}
.ng-omok{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-omok .om-hud{display:flex; gap:6px; width:100%; justify-content:space-between}
.ng-omok .om-pill{position:relative; flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:4px; height:44px; padding:0 7px; border-radius:999px; font:inherit; overflow:hidden;
  background:linear-gradient(180deg,#FFFFFF,#F3EEFF); border:2.5px solid #1A0F45; box-shadow:inset 0 -3px 0 rgba(80,60,160,.14), 0 3px 0 #1A0F45; color:#2E2260; white-space:nowrap}
.ng-omok .om-pill b{font-family:var(--heavy); font-size:19px; font-weight:400; line-height:1; font-variant-numeric:tabular-nums}
.ng-omok .om-pill small{font-family:var(--disp); font-size:13px; color:#6E62A0}
.ng-omok .om-ic{width:22px; height:22px; flex:none; display:block}
.ng-omok .om-ic svg{width:100%; height:100%; display:block}
.ng-omok .om-time{flex:1.25 1 0}
.ng-omok .om-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-omok .om-time.opp{background:linear-gradient(180deg,#F4F1FA,#E3DDF2); color:#6E62A0}
.ng-omok .om-tbar{position:absolute; left:10px; right:10px; bottom:3px; height:4px; border-radius:9px; background:rgba(26,15,69,.12); overflow:hidden}
.ng-omok .om-tbar i{position:absolute; inset:0; transform-origin:left center; background:#8C6CF0; border-radius:9px}
.ng-omok .om-time.hurry .om-tbar i{background:#fff}
.ng-omok .om-side{flex:1 1 0; transition:transform .15s, background .15s}
.ng-omok .om-side.on{background:linear-gradient(180deg,#FFF6C8,#FFD86B); transform:translateY(-2px); box-shadow:inset 0 -3px 0 rgba(160,110,0,.18), 0 5px 0 #1A0F45}
.ng-omok .om-side .om-opn{font-size:16px; overflow:hidden; text-overflow:ellipsis}
.ng-omok .om-btn{flex:.78 1 0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:linear-gradient(180deg,#FFF6C8,#FFE07A)}
.ng-omok .om-btn:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(80,60,160,.14), 0 1px 0 #1A0F45}
.ng-omok .om-btn:disabled{opacity:.45; background:#EDEDED; cursor:default}
.ng-omok .om-row{display:flex; align-items:center; gap:8px; width:100%; height:40px; margin-top:6px}
.ng-omok .om-lives{display:flex; gap:2px; flex:none; padding:4px 7px; border-radius:99px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45}
.ng-omok .om-heart{display:block; width:18px; height:18px; color:#FF4D6D}
.ng-omok .om-heart svg{width:100%; height:100%; display:block}
.ng-omok .om-heart.off{color:#DCD6E6}
.ng-omok .om-msg{flex:1; min-width:0; overflow:hidden; height:40px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:14.5px; color:#3A2C78; white-space:nowrap}
.ng-omok .om-msg > span{overflow:hidden; text-overflow:ellipsis}
.ng-omok .om-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-omok .om-msg b.sm{font-size:16px; -webkit-text-stroke:4px #1A0F45; color:#FFE27A}
.ng-omok .om-msg b.boss{color:#FFE27A}
.ng-omok .om-msg b.bad{color:#FF8A8F}
.ng-omok .om-msg.om-pop, .ng-omok .om-msg.om-win{animation:omok-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-omok .om-msg.om-win b{font-size:24px; color:#FFE27A}
.ng-omok .om-think i{display:inline-block; width:5px; height:5px; margin-left:3px; border-radius:50%; background:#6E62A0; animation:omok-dot 1s infinite}
.ng-omok .om-think i:nth-child(2){animation-delay:.15s} .ng-omok .om-think i:nth-child(3){animation-delay:.3s}
@keyframes omok-dot{50%{transform:translateY(-4px); opacity:.4}}
@keyframes omok-in{from{transform:scale(.6); opacity:0}}
.ng-omok .om-board{position:relative; margin-top:4px; border-radius:16px; padding:0; touch-action:none; outline:none;
  background:radial-gradient(120% 90% at 30% 20%, #FCE6B8 0%, #F2CB86 60%, #E4AE62 100%); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.55), 0 5px 0 #1A0F45, 0 14px 22px rgba(60,30,120,.22)}
.ng-omok .om-board:focus-visible{box-shadow:inset 0 0 0 3px rgba(255,255,255,.55), 0 0 0 3px #FFE27A, 0 5px 0 #1A0F45}
.ng-omok .om-svg{display:block; width:100%; height:100%; overflow:visible}
.ng-omok .om-st.om-new{transform-box:fill-box; transform-origin:center; animation:omok-drop .28s cubic-bezier(.2,1.6,.4,1)}
@keyframes omok-drop{from{transform:scale(1.6); opacity:.2}}
.ng-omok .om-st.om-wins{filter:drop-shadow(0 0 2px #FFE27A) drop-shadow(0 0 3px #FFB020)}
.ng-omok .om-winline{stroke:#FF5A6E; stroke-width:1.6; stroke-linecap:round; opacity:.9; stroke-dasharray:80; stroke-dashoffset:80; animation:omok-line .45s ease-out forwards}
@keyframes omok-line{to{stroke-dashoffset:0}}
.ng-omok .om-ban{stroke:#E5484D; stroke-width:.9; stroke-linecap:round; opacity:.75}
.ng-omok .om-guide{stroke:#FF8A3D; stroke-width:.5; stroke-dasharray:1.6 1.4; opacity:.9}
.ng-omok .om-ghost{opacity:.6}
.ng-omok .om-ghost.ban{opacity:.35}
.ng-omok .om-ring{fill:none; stroke:#FF8A3D; stroke-width:.9; animation:omok-pulse 1s ease-in-out infinite alternate}
.ng-omok .om-ring.ban{stroke:#E5484D}
.ng-omok .om-hintring{fill:none; stroke:#FFD23F; stroke-width:1.4; stroke-dasharray:2 1.5; animation:omok-pulse .6s ease-in-out infinite alternate}
@keyframes omok-pulse{to{opacity:.35}}
.ng-omok .om-act{display:flex; align-items:center; gap:8px; width:100%; margin-top:10px; min-height:52px}
.ng-omok .om-coord{flex:1; min-width:0; margin:0; font-family:var(--disp); font-size:13.5px; line-height:1.3; color:#4A3C8A; text-align:left}
.ng-omok .om-coord b{font-family:var(--heavy); font-weight:400; font-size:16px; color:#1A0F45}
.ng-omok .om-coord b.bad{color:#D0303A}
.ng-omok .om-put{flex:none; display:flex; flex-direction:column; align-items:center; justify-content:center; width:118px; height:52px; border-radius:18px; cursor:pointer; -webkit-tap-highlight-color:transparent;
  font-family:var(--heavy); font-size:21px; color:#fff; -webkit-text-stroke:4px #1A0F45; paint-order:stroke fill; line-height:1;
  background:linear-gradient(180deg,#FFB547 0%,#FF8A1F 100%); border:3px solid #1A0F45; box-shadow:inset 0 3px 0 rgba(255,255,255,.45), inset 0 -4px 0 rgba(160,60,0,.25), 0 4px 0 #1A0F45}
.ng-omok .om-put small{font-family:var(--disp); font-size:12px; -webkit-text-stroke:0; color:#5A2E00; margin-top:2px}
.ng-omok .om-put:active{transform:translateY(3px); box-shadow:inset 0 3px 0 rgba(255,255,255,.45), 0 1px 0 #1A0F45}
.ng-omok .om-put:disabled{background:linear-gradient(180deg,#E9E4F4,#CFC7E3); cursor:default; color:#F4F1FA}
.ng-omok .om-put:disabled small{color:#8C82AE}
.ng-omok .om-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:8px 0 0; max-width:100%}
.ng-omok .om-chip{font-family:var(--disp); font-size:13px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#2E2260; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-omok .om-chip.mj{background:#FFF0DC; color:#9A5A12}
.ng-omok .om-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-omok .om-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
@media (max-width:370px){ .ng-omok .om-pill b{font-size:17px} .ng-omok .om-pill small{font-size:11.5px} .ng-omok .om-hud{gap:4px} .ng-omok .om-pill{padding:0 5px} .ng-omok .om-put{width:100px} .ng-omok .om-msg b{font-size:18px} }
@media (prefers-reduced-motion: reduce){ .ng-omok .om-st.om-new, .ng-omok .om-ring, .ng-omok .om-hintring{animation:none} }
`,
    sounds:{
      omokPick(){ aNoise({ ft:'bandpass', f:2600, q:2, d:.03, v:.04 }); aTone({ f:880, type:'triangle', d:.05, v:.035 }); },
      omokPut(){ aThump({ f:260, f2:120, d:.09, v:.22 }); aNoise({ ft:'bandpass', f:3200, q:3, d:.04, v:.09 }); aMarimba(m2f(79), { t:.02, v:.08 }); },
      omokPutOpp(){ aThump({ f:220, f2:100, d:.09, v:.2 }); aNoise({ ft:'bandpass', f:2600, q:3, d:.04, v:.08 }); },
      omokBan(){ aTone({ f:330, f2:220, type:'triangle', d:.18, v:.09 }); },
      omokHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      omokUndo(){ aWhoosh({ f:2600, f2:500, a:.02, d:.2, v:.05 }); },
      omokTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      omokLose(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.55, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.22 }); }
    },
    gate:{ omokPick:40, omokTick:250 },
    jingle(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .08, v:.16 })); [84, 88, 91, 96].forEach((mm, i) => aBell({ f:m2f(mm), t:.4 + i * .04, d:1.1, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.5, n:6 }); }
  };
})();

/* 대전: 엔진 1:1 대전(같은 시각 시작·같은 씨앗) 위에 실시간 턴제. AI 상대는 게임 안 AI(보통)가 실제로 둔다 →
   엔진의 가짜 진행 AI(duelAi)는 끝나지 않게 하고 진행도만 AI의 최고 줄 길이로 보여 준다. */
Object.assign(NG.omok, {
  duelPace:[200, .5],
  duelAi(){ return { ok:false, sc:0, get T(){ return (G && G.duel && G.duel.go ? elapsed() : 0) + .01; }, get fail(){ const m = G && G.m; return m ? Math.min(.99, ((m.oppBest || 0) + .05) / 5) : 0; } }; },
  duelStat:{ unit:'목', get:() => ({ v:G.m.best || 0, t:5 }) }
});
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.omok.scene = { kind:'petals', colors:['#FFFFFF', '#FFE3B8', '#E2D6FF'], density:.8 };
