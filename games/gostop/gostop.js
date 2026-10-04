/* 고스톱 */
/* ===== 고스톱 (gostop) · 하루퍼즐 리그 게임 모듈 · 19세 이상 =====
   2인 맞고 규칙(한게임 맞고에서 널리 쓰는 기본 규칙): 7점 나면 고/스톱, 피박·광박·고박·멍따, 흔들기·폭탄,
   뻑·쪽·따닥·쓸, 보너스패 3장(쌍피 2 · 쓰리피 1), 총통·3뻑 바로 승리, 나가리(무승부).
   화투 그림은 모두 직접 그린 오리지널 SVG(전통 월별 소재만 씀, 특정 회사 카드 그림·화면 배치는 쓰지 않음).
   모드: 솔로(AI와 스테이지) · 대전(실시간 1:1 턴제, 상대가 없으면 AI). 오늘의 시험지·연습에는 넣지 않는다(modes).

   구조
   - 규칙(순수 함수): gsDeal(seed) → 판 상태 S, gsApply(S, 좌석, 수) → 화면용 장면 목록, gsGoStop(S, 좌석, 고?)
     같은 씨앗·같은 수 → 두 기기에서 똑같은 판(실시간 대전은 수만 주고받음).
   - 수(act) = { c:낸 패, a:바닥 고르기, b:뒤집은 패 고르기, s:0 보통 · 1 흔들기 · 2 폭탄, g:고(1)/스톱(0) }
   - 실시간 대전: 대기실 presence(du/dg/dt/nk)로 짝을 찾고, 둘만의 방('fl-g-…')에서 각자 presence.mv에 수를 쌓는다. */
NG.gostop = (() => {
  const INK = '#2B1B12';
  const ID = 'gostop';
  /* ---------- 패 ---------- */
  /* 월별 네 장의 종류: g 광 · y 열끗 · hong/cheong/cho 단 · rain 비띠 · p 피 · s 쌍피 */
  const T = [null,
    ['g', 'hong', 'p', 'p'], ['y', 'hong', 'p', 'p'], ['g', 'hong', 'p', 'p'], ['y', 'cho', 'p', 'p'],
    ['y', 'cho', 'p', 'p'], ['y', 'cheong', 'p', 'p'], ['y', 'cho', 'p', 'p'], ['g', 'y', 'p', 'p'],
    ['y', 'cheong', 'p', 'p'], ['y', 'cheong', 'p', 'p'], ['g', 's', 'p', 'p'], ['g', 'y', 'rain', 's']];
  const C = [];
  for(let m = 1; m <= 12; m++) for(let k = 0; k < 4; k++){
    const t = T[m][k], id = (m - 1) * 4 + k;
    C[id] = { id, m, k, g:t === 'g', y:t === 'y', tt:['hong', 'cheong', 'cho', 'rain'].includes(t) ? t : null, pv:t === 'p' ? 1 : t === 's' ? 2 : 0,
      bird:t === 'y' && (m === 2 || m === 4 || m === 8), rg:t === 'g' && m === 12, kj:t === 'y' && m === 9 };
  }
  C[48] = { id:48, m:0, k:0, bonus:true, pv:2 }; C[49] = { id:49, m:0, k:1, bonus:true, pv:2 }; C[50] = { id:50, m:0, k:2, bonus:true, pv:3 };
  const NCARD = 51, DUMMY = 60;   /* 폭탄 뒤 손에 들어오는 빈 패(내면 뒤집기만) = 60번부터 */
  const isDummy = id => id >= DUMMY;
  const isPi = c => c && !c.g && !c.y && !c.tt;
  const kindOf = id => { const c = C[id]; if(!c) return 'p'; return c.g ? 'g' : c.y ? 'y' : c.tt ? 't' : 'p'; };
  const MON = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국진', '단풍', '오동', '비'];
  const cardName = id => { if(isDummy(id)) return '폭탄 빈 패'; const c = C[id]; if(c.bonus) return '보너스 ' + (c.pv === 3 ? '쓰리피' : '쌍피');
    return c.m + '월 ' + MON[c.m] + ' ' + (c.g ? (c.rg ? '비광' : '광') : c.y ? (c.kj ? '국진(열끗)' : '열끗') : c.tt === 'hong' ? '홍단' : c.tt === 'cheong' ? '청단' : c.tt === 'cho' ? '초단' : c.tt ? '띠' : c.pv === 2 ? '쌍피' : '피'); };

  /* ---------- 점수 ---------- */
  function tally(cap, kjPi){
    let gN = 0, rain = false, yN = 0, birds = 0, tN = 0, hong = 0, cheong = 0, cho = 0, piV = 0;
    for(const id of cap){
      const c = C[id]; if(!c) continue;
      if(c.g){ gN++; if(c.rg) rain = true; }
      else if(c.y){ if(c.kj && kjPi) piV += 2; else { yN++; if(c.bird) birds++; } }
      else if(c.tt){ tN++; if(c.tt === 'hong') hong++; else if(c.tt === 'cheong') cheong++; else if(c.tt === 'cho') cho++; }
      else piV += c.pv || 0;
    }
    const gP = gN >= 5 ? 15 : gN === 4 ? 4 : gN === 3 ? (rain ? 2 : 3) : 0;
    const yP = (yN >= 5 ? yN - 4 : 0) + (birds === 3 ? 5 : 0);
    const tP = (tN >= 5 ? tN - 4 : 0) + (hong === 3 ? 3 : 0) + (cheong === 3 ? 3 : 0) + (cho === 3 ? 3 : 0);
    const pP = piV >= 10 ? piV - 9 : 0;
    return { gN, rain, yN, birds, tN, hong, cheong, cho, piV, gP, yP, tP, pP, total:gP + yP + tP + pP, kjPi:!!kjPi };
  }
  /* 국진(9월 열끗)은 열끗·쌍피 중 점수가 높은 쪽으로 자동 */
  function scoreOf(cap){ const a = tally(cap, false); if(!cap.some(id => C[id] && C[id].kj)) return a; const b = tally(cap, true); return b.total > a.total ? b : a; }
  const piMax = cap => Math.max(tally(cap, false).piV, tally(cap, true).piV);

  /* ---------- 판 만들기 ---------- */
  function gsShuffle(arr, rng){ for(let i = arr.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function monthCount(ids){ const o = {}; ids.forEach(id => { const m = C[id] && C[id].m; if(m) o[m] = (o[m] || 0) + 1; }); return o; }
  function gsDeal(seed){
    for(let r = 0; r < 60; r++){
      const rng = mulberry(seedFrom(seed + ':' + r));
      const ids = gsShuffle([...Array(NCARD).keys()], rng);
      const S = { P:[0, 1].map(i => ({ hand:ids.slice(i * 10, i * 10 + 10), cap:[], go:0, goScore:0, shake:0, ppuk:0 })), floor:[], deck:ids.slice(28),
        turn:0, ppuk:{}, pendingGS:-1, over:false, result:null, dn:0, nAct:0 };
      /* 바닥 8장: 보너스패는 선(0번 자리)이 먹고 더미에서 채움 */
      for(const id of ids.slice(20, 28)){ if(C[id].bonus) S.P[0].cap.push(id); else S.floor.push(id); }
      while(S.floor.length < 8 && S.deck.length){ const d = S.deck.shift(); if(C[d].bonus) S.P[0].cap.push(d); else S.floor.push(d); }
      if(Object.values(monthCount(S.floor)).some(v => v >= 4)) continue;   /* 바닥에 같은 월 4장 → 다시 섞기 */
      /* 손패에 보너스패가 있어도 그대로(내면 먹고 한 장 더 받음) */
      for(const p of [0, 1]){
        const mc = monthCount(S.P[p].hand), m4 = Object.keys(mc).find(k => mc[k] >= 4);
        if(m4){ S.over = true; S.result = { w:p, final:10, base:10, why:'총통', rows:[[`총통 (${m4}월 네 장)`, '10점']], mults:[] }; break; }
      }
      return S;
    }
    return null;
  }
  const cloneS = S => JSON.parse(JSON.stringify(S));
  const floorOf = (S, m) => S.floor.filter(id => C[id] && C[id].m === m);
  const same = (a, b) => { const x = C[a], y = C[b]; return x && y && x.g === y.g && x.y === y.y && x.tt === y.tt && x.pv === y.pv && x.bird === y.bird && x.kj === y.kj; };
  const snap = (S, x) => Object.assign({ h:[S.P[0].hand.slice(), S.P[1].hand.slice()], f:S.floor.slice(), c:[S.P[0].cap.slice(), S.P[1].cap.slice()], d:S.deck.length, hi:[], lab:[] }, x || {});

  /* ---------- 한 수 두기 (두 기기 모두 같은 결과: 무작위 없음) ----------
     돌려주는 값: 화면용 장면 목록. probe=true면 뒤집은 패 고르기가 필요할 때 { need:'b', opts, flip }를 돌려준다. */
  function gsApply(S, p, act, probe){
    const me = S.P[p], op = S.P[1 - p], scenes = [], labs = [];
    const take = ids => { ids.forEach(id => { const i = S.floor.indexOf(id); if(i >= 0) S.floor.splice(i, 1); if(!me.cap.includes(id)) me.cap.push(id); }); };
    const steal = n => {
      let got = 0;
      for(let k = 0; k < n; k++){
        const order = [1, 2, 3].map(v => op.cap.find(id => { const c = C[id]; return c && isPi(c) && !c.bonus && c.pv === v; }) ?? op.cap.find(id => { const c = C[id]; return c && c.bonus && c.pv === v; }));
        const id = order.find(x => x != null); if(id == null) break;
        op.cap.splice(op.cap.indexOf(id), 1); me.cap.push(id); got++;
      }
      if(got) labs.push('피 ' + got + '장 가져옴');
    };
    const c = act.c;
    const hi = me.hand.indexOf(c);
    if(hi < 0) return probe ? { need:null } : scenes;   /* 잘못된 수(있으면 안 됨) */
    S.nAct++;
    /* 보너스패: 바로 먹고 더미에서 한 장 받기, 차례는 그대로 */
    if(C[c] && C[c].bonus){
      if(probe) return { need:null };
      me.hand.splice(hi, 1); me.cap.push(c);
      scenes.push(snap(S, { lab:['보너스!'], hi:[c] }));
      if(S.deck.length){ const d = S.deck.shift(); me.hand.push(d); scenes.push(snap(S, { draw:d })); }
      return scenes;
    }
    me.hand.splice(hi, 1);
    let played = null, pm = 0, pre = null, capped = false;
    if(isDummy(c)){ /* 빈 패: 뒤집기만 */ }
    else if(act.s === 2 && me.hand.filter(x => C[x] && C[x].m === C[c].m).length >= 2 && floorOf(S, C[c].m).length === 1){
      /* 폭탄: 같은 월 세 장을 한꺼번에 내고 바닥 한 장까지 먹음 + 피 1장 + 빈 패 2장 */
      const M = C[c].m, three = [c, ...me.hand.filter(x => C[x] && C[x].m === M).slice(0, 2)];
      three.slice(1).forEach(x => me.hand.splice(me.hand.indexOf(x), 1));
      S.floor.push(...three);
      if(!probe) scenes.push(snap(S, { hi:three, lab:['폭탄!'] }));
      take(floorOf(S, M)); capped = true; steal(1); me.shake++;
      me.hand.push(DUMMY + S.dn++, DUMMY + S.dn++);
      pm = -1;
    } else {
      const M = C[c].m, F = floorOf(S, M);
      if(act.s === 1 && me.hand.filter(x => C[x] && C[x].m === M).length >= 2){ me.shake++; labs.push('흔들기!'); }
      S.floor.push(c); played = c;
      if(F.length === 0) pm = 0;
      else if(F.length === 1){ pm = 1; pre = F[0]; }
      else if(F.length === 2){ pm = 2; pre = F.includes(act.a) ? act.a : F[0]; }
      else {
        pm = -1; take([...F, c]); capped = true;
        if(S.ppuk[M] != null){ const own = S.ppuk[M] === p; labs.push(own ? '자뻑!' : '뻑 먹기!'); steal(own ? 2 : 1); delete S.ppuk[M]; }
      }
      if(!probe) scenes.push(snap(S, { hi:[c], lab:labs.splice(0) }));
    }
    /* 더미 뒤집기(보너스패는 먹고 한 장 더) */
    let f = null;
    while(S.deck.length){
      const d = S.deck.shift();
      if(C[d].bonus){ me.cap.push(d); if(!probe) scenes.push(snap(S, { flip:d, lab:['보너스!'] })); continue; }
      f = d; break;
    }
    if(f != null){
      const FM = C[f].m;
      if(played != null && FM === C[played].m){
        S.floor.push(f);
        if(!probe) scenes.push(snap(S, { flip:f, hi:[f] }));
        if(pm === 0){ take([played, f]); capped = true; labs.push('쪽!'); steal(1); }
        else if(pm === 1){ S.ppuk[FM] = p; me.ppuk++; labs.push('뻑!'); }
        else if(pm === 2){ take(floorOf(S, FM)); capped = true; labs.push('따닥!'); steal(1); }
        played = null;
      } else {
        const FF = floorOf(S, FM);
        let pick = null;
        if(FF.length === 2){
          if(FF.includes(act.b)) pick = act.b;
          else if(same(FF[0], FF[1])) pick = FF[0];
          else if(probe) return { need:'b', opts:FF, flip:f };
          else pick = FF[0];
        }
        S.floor.push(f);
        if(!probe) scenes.push(snap(S, { flip:f, hi:[f] }));
        if(played != null && pm >= 1){ take([played, pre]); capped = true; }
        if(FF.length === 1){ take([FF[0], f]); capped = true; }
        else if(FF.length === 2){ take([pick, f]); capped = true; }
        else if(FF.length === 3){
          take([...FF, f]); capped = true;
          if(S.ppuk[FM] != null){ const own = S.ppuk[FM] === p; labs.push(own ? '자뻑!' : '뻑 먹기!'); steal(own ? 2 : 1); delete S.ppuk[FM]; }
        }
      }
    } else if(played != null && pm >= 1){ take([played, pre]); capped = true; }
    if(probe) return { need:null };
    /* 쓸: 내 차례 끝에 바닥이 비면 피 1장(마지막 패 제외) */
    if(capped && !S.floor.length && (S.deck.length || me.hand.length)){ labs.push('쓸!'); steal(1); }
    scenes.push(snap(S, { lab:labs.splice(0) }));
    /* 3뻑 바로 승리 */
    if(me.ppuk >= 3){ S.over = true; S.result = { w:p, final:10, base:10, why:'3뻑', rows:[['3뻑', '10점']], mults:[] }; return scenes; }
    const sc = scoreOf(me.cap).total;
    if(sc >= 7 && (me.go === 0 || sc > me.goScore)){
      if(!me.hand.length){ gsEnd(S, p, '마지막 패'); return scenes; }   /* 남은 패가 없으면 고 없이 스톱 */
      S.pendingGS = p; return scenes;
    }
    gsNext(S);
    return scenes;
  }
  function gsGoStop(S, p, go){
    if(S.pendingGS !== p) return;
    S.pendingGS = -1;
    const me = S.P[p];
    if(go){ me.go++; me.goScore = scoreOf(me.cap).total; gsNext(S); }
    else gsEnd(S, p, '스톱');
  }
  function gsNext(S){
    if(S.over) return;
    const a = S.P[S.turn], b = S.P[1 - S.turn];
    if(!a.hand.length && !b.hand.length){ S.over = true; S.result = { w:-1, final:0, why:'나가리', rows:[], mults:[] }; return; }
    if(b.hand.length) S.turn = 1 - S.turn;
  }
  /* 정산: 기본 점수 + 고 점수 → 배수(흔들기·폭탄, 멍따, 피박, 광박, 고박) */
  function gsEnd(S, w, how){
    const W = S.P[w], L = S.P[1 - w], s = scoreOf(W.cap);
    const rows = [], mults = [];
    if(s.gP) rows.push([`광 ${s.gN}장${s.gN === 3 && s.rain ? '(비광)' : ''}`, s.gP + '점']);
    if(s.yP) rows.push([`열끗 ${s.yN}장${s.birds === 3 ? ' · 고도리' : ''}`, s.yP + '점']);
    if(s.tP) rows.push([`띠 ${s.tN}장${s.hong === 3 ? ' · 홍단' : ''}${s.cheong === 3 ? ' · 청단' : ''}${s.cho === 3 ? ' · 초단' : ''}`, s.tP + '점']);
    if(s.pP) rows.push([`피 ${s.piV}장`, s.pP + '점']);
    let pts = s.total;
    if(W.go){ pts += W.go; rows.push([`${W.go}고`, '+' + W.go + '점']); if(W.go >= 3){ const m = Math.pow(2, W.go - 2); mults.push([W.go + '고 배수', m]); } }
    if(W.shake) mults.push(['흔들기·폭탄 ' + W.shake + '번', Math.pow(2, W.shake)]);
    if(s.yN >= 7) mults.push(['멍따(열끗 7장+)', 2]);
    const lp = piMax(L.cap);
    if(s.pP && lp > 0 && lp < 6) mults.push(['피박', 2]);
    if(s.gP && !L.cap.some(id => C[id] && C[id].g)) mults.push(['광박', 2]);
    if(L.go) mults.push(['고박', 2]);
    const final = mults.reduce((a, m) => a * m[1], pts);
    S.over = true; S.pendingGS = -1;
    S.result = { w, final, base:pts, why:how, rows, mults, s };
  }

  /* ---------- AI (다른 사람 패·더미는 보지 않음) ---------- */
  function seenCards(S, p){ return new Set([...S.floor, ...S.P[0].cap, ...S.P[1].cap, ...S.P[p].hand]); }
  function want(S, p, id){
    const c = C[id]; if(!c) return 0; if(c.bonus) return c.pv * 3;
    const mine = scoreOf(S.P[p].cap), opp = scoreOf(S.P[1 - p].cap);
    let v = 0;
    if(c.g) v = (c.rg ? 9 : 15) + 4 * mine.gN + 3 * opp.gN;
    else if(c.y){ v = 5 + (mine.yN >= 4 ? 3 : 0); if(c.bird) v += 4 + 4 * mine.birds + 3 * opp.birds; if(c.kj) v += 3; }
    else if(c.tt){
      v = 4 + (mine.tN >= 4 ? 3 : 0);
      const k = c.tt, hm = k === 'hong' ? mine.hong : k === 'cheong' ? mine.cheong : k === 'cho' ? mine.cho : 0, ho = k === 'hong' ? opp.hong : k === 'cheong' ? opp.cheong : k === 'cho' ? opp.cho : 0;
      if(k !== 'rain') v += 4 * hm + 3 * ho;
    } else v = c.pv * 3 + (mine.piV >= 7 ? 3 : 0) + (opp.piV >= 8 ? 2 : 0);
    return v;
  }
  /* 판 가치: 지금 점수 + 족보에 다가간 정도 */
  function pot(cap){
    const s = scoreOf(cap);
    let v = s.total * 12 + [0, 1, 3, 8][Math.min(3, s.gN)] * 2 + (s.birds === 2 ? 6 : s.birds === 1 ? 2 : 0);
    for(const k of ['hong', 'cheong', 'cho']) v += s[k] === 2 ? 5 : s[k] === 1 ? 1.5 : 0;
    return v + Math.min(s.yN, 4) * 1.2 + Math.min(s.tN, 4) * 1.2 + Math.min(s.piV, 9);
  }
  /* 어려움 AI: 더미에서 나올 수 있는 모든 패(내가 못 본 패)를 고루 가정하고 기대 가치로 고름. 남의 패를 엿보지 않음 */
  function evalAfter(S0, S, p){
    const me = S.P[p], op = S.P[1 - p], before = new Set(S0.P[p].cap), opBefore = new Set(S0.P[1 - p].cap);
    let v = 0;
    for(const x of me.cap) if(!before.has(x)) v += want(S0, p, x) + (opBefore.has(x) ? want(S0, 1 - p, x) * .6 : 0);
    for(const x of op.cap) if(!opBefore.has(x)) v -= want(S0, 1 - p, x);   /* (내 차례엔 거의 없음) */
    if(S.over && S.result) v += S.result.w === p ? 300 : S.result.w >= 0 ? -300 : 0;
    if(S.pendingGS === p) v += 25;
    if(me.ppuk > S0.P[p].ppuk) v -= 4;
    if(me.shake > S0.P[p].shake) v += 9;   /* 흔들기·폭탄 = 점수 2배 */
    /* 바닥에 남긴 패를 상대가 먹을 위험 */
    const seen = new Set([...S.floor, ...S.P[0].cap, ...S.P[1].cap, ...me.hand]), unseen = Math.max(1, NCARD - [...seen].filter(x => x < NCARD).length);
    const oh = op.hand.length, mons = {};
    S.floor.forEach(id => { const m = C[id].m; (mons[m] = mons[m] || []).push(id); });
    for(const m in mons){
      let left = 0; for(let k = 0; k < 4; k++) if(!seen.has((m - 1) * 4 + k)) left++;
      if(!left) continue;
      const pr = Math.min(1, 1 - Math.pow(1 - oh / unseen, left));
      v -= pr * mons[m].reduce((t, x) => t + want(S0, 1 - p, x), 0) * (mons[m].length >= 3 ? .9 : .6);
    }
    return v;
  }
  function aiPickHard(S, p, rnd){
    const me = S.P[p], cands = [];
    for(const c of me.hand){
      if(!isDummy(c) && C[c].bonus) return { c, a:-1, b:-1, s:0 };   /* 보너스패는 먼저 */
      const opts = [{ c, a:-1, b:-1, s:0 }];
      if(!isDummy(c)){
        const M = C[c].m, F = floorOf(S, M), nh = me.hand.filter(x => C[x] && C[x].m === M).length;
        if(nh >= 3 && F.length === 1) opts[0].s = 2;
        else if(nh >= 3 && !F.length) opts[0].s = 1;
        if(opts[0].s !== 2 && F.length === 2 && !same(F[0], F[1])){ opts[0].a = F[0]; opts.push({ c, a:F[1], b:-1, s:opts[0].s }); }
      }
      cands.push(...opts);
    }
    /* 이번에 낸 패의 효과만 본다(뒤집힐 패는 모르니 계산에 넣지 않음 — 시뮬레이션에서 이쪽이 더 강했음) */
    let best = null;
    for(const act of cands){
      const T = cloneS(S); T.deck = [];
      gsApply(T, p, act);
      let v = evalAfter(S, T, p) + (rnd() - .5) * .6;
      if(isDummy(act.c)) v += 1.5;
      if(!best || v > best.v) best = { act, v };
    }
    const act = Object.assign({}, best.act);
    const pr = gsApply(cloneS(S), p, act, true);
    if(pr && pr.need === 'b'){
      act.b = pr.opts.map(o => { const U = cloneS(S); gsApply(U, p, Object.assign({}, act, { b:o })); return [o, evalAfter(S, U, p)]; }).sort((x, y) => y[1] - x[1])[0][0];
    }
    return act;
  }
  function aiPick(S, p, lvl, rnd){
    if(lvl === 'hard') return aiPickHard(S, p, rnd);
    const me = S.P[p], seen = seenCards(S, p);
    const noise = lvl === 'easy' ? 12 : 3;
    let best = null;
    for(const c of me.hand){
      let v, s = 0, a = -1;
      if(isDummy(c)) v = 1;
      else if(C[c].bonus) v = 100;
      else {
        const M = C[c].m, F = floorOf(S, M), nh = me.hand.filter(x => C[x] && C[x].m === M).length;
        if(nh >= 3 && F.length === 1){ s = 2; v = 30 + F.concat(me.hand.filter(x => C[x] && C[x].m === M)).reduce((t, x) => t + want(S, p, x), 0); }
        else if(F.length === 0){
          const alive = [...Array(4)].some((_, k) => !seen.has((M - 1) * 4 + k));
          v = -want(S, 1 - p, c) * (alive ? 1 : .25) - 2;
          if(nh >= 3){ s = 1; v += 6; }
        } else if(F.length === 1) v = want(S, p, c) + want(S, p, F[0]) + 2;
        else if(F.length === 2){ a = want(S, p, F[0]) >= want(S, p, F[1]) ? F[0] : F[1]; v = want(S, p, c) + want(S, p, a) + 2; }
        else v = F.concat(c).reduce((t, x) => t + want(S, p, x), 0) + 8;
        if(lvl === 'hard' && F.length === 1 && nh === 2) v -= 3;   /* 같은 월을 두 장 들고 있으면 아껴 둠(따닥·뻑 먹기 노림) */
      }
      v += (rnd() - .5) * noise * 2;
      if(lvl === 'easy' && rnd() < .35) v = rnd() * 30;
      if(!best || v > best.v) best = { c, v, s, a };
    }
    const act = { c:best.c, a:best.a, b:-1, s:best.s };
    const pr = gsApply(cloneS(S), p, act, true);
    if(pr && pr.need === 'b') act.b = want(S, p, pr.opts[0]) >= want(S, p, pr.opts[1]) ? pr.opts[0] : pr.opts[1];
    if(lvl === 'easy' && pr && pr.need === 'b' && rnd() < .4) act.b = pr.opts[1];
    return act;
  }
  function aiGo(S, p, lvl, rnd){
    const me = S.P[p], op = S.P[1 - p], opS = scoreOf(op.cap).total, n = me.hand.length;
    if(op.go) return false;   /* 상대가 고를 했으면 스톱(고박) */
    if(lvl === 'easy') return n >= 3 && rnd() < .5;
    if(lvl === 'normal') return n >= 4 && opS <= 3 && me.go < 2;
    return n >= 3 && opS <= (me.go ? 2 : 3) && me.go < 3 && S.deck.length > 4;
  }

  /* ---------- 그림: gostop-art.js(GSART) ---------- */
  const SVGC = {}, INNER = {};
  function cardSvg(id){
    if(SVGC[id]) return SVGC[id];
    const s = isDummy(id) ? GSART.dummy : GSART.face(C[id]);
    INNER[id] = s;
    return SVGC[id] = `<svg viewBox="${GSART.VB}" aria-hidden="true">${s}</svg>`;
  }
  const cardInner = id => (cardSvg(id), INNER[id]);
  const BACK = `<svg viewBox="${GSART.VB}" aria-hidden="true">${GSART.back}</svg>`;
  const BADGE19 = '<span class="gs19" aria-label="19세 이상 이용">19</span>';

  /* ---------- 화면: 한게임 맞고식 가로 판(기준 1630×923, 화면에 맞춰 확대·축소, 세로 화면이면 90° 돌림) ---------- */
  const BW = 1630, BH = 923, MAINW = 1262;
  const CW = { hand:[142, 232], floor:[84, 137], cap:[44, 72], deck:[92, 150] };
  const GS = () => G && G.gs;
  const myTurn = () => { const g = GS(); return g && g.S && !g.S.over && g.S.turn === g.me && g.S.pendingGS < 0; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const px = (x, y, w, h) => `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px`;
  function setMsg(html, cls){ const m = $('#gsMsg'); if(m){ m.className = 'gs-msg' + (cls ? ' ' + cls : ''); m.innerHTML = '<span>' + html + '</span>'; } }
  /* 판 크기 맞추기 */
  function fit(){
    const g = GS(), b = $('#gsb'); if(!g || !b) return;
    const vw = window.innerWidth, vh = window.innerHeight, rot = vh > vw * 1.05;
    const S = rot ? Math.min(vh / BW, vw / BH) : Math.min(vw / BW, vh / BH);
    g.rot = rot; g.sc = S;
    b.style.transform = `translate(-50%,-50%) rotate(${rot ? 90 : 0}deg) scale(${S})`;
  }
  function capGroups(cap){
    const g = { g:[], y:[], t:[], p:[] };
    cap.forEach(id => g[kindOf(id)].push(id));
    g.p.sort((a, b) => (C[a].pv || 0) - (C[b].pv || 0));
    return g;
  }
  /* 먹은 패 줄: 광 · 열끗 · 띠 · 피 묶음(겹쳐 놓기), 묶음마다 장수 */
  function capHtml(cap, y){
    const g = capGroups(cap), s = scoreOf(cap), cnt = { g:s.gN, y:s.yN, t:s.tN, p:s.piV };
    const [w, h] = CW.cap, step = { g:20, y:16, t:16, p:11 };
    let x = 170, out = '';
    for(const k of ['g', 'y', 't', 'p']){
      const L = g[k]; if(!L.length) continue;
      L.forEach((id, i) => { out += `<div class="gs-c mini" data-cid="${id}" style="${px(x + i * step[k], y, w, h)};z-index:${i + 1}">${cardSvg(id)}</div>`; });
      const gw = w + (L.length - 1) * step[k];
      out += `<span class="gs-cnt" style="left:${Math.round(x + gw - 14)}px;top:${y + h - 22}px">${cnt[k]}</span>`;
      x += gw + 30;
    }
    return out;
  }
  function profHtml(p, view){
    const g = GS(), S = g.S, P = S.P[p], me = p === g.me;
    const name = me ? '나' : esc(g.oppNick), av = me ? avatar({ me:true }) : oppAv(g.oppNick);
    const st = [P.go ? `<b class="go">${P.go}고</b>` : '', P.shake ? `<b class="sh">흔들 ${P.shake}</b>` : '', P.ppuk ? `<b class="pp">뻑 ${P.ppuk}</b>` : ''].join('');
    return `<div class="gs-pn">${S.first === p ? '<i class="gs-sun">先</i>' : ''}<b>${name}</b></div>
      <div class="gs-pl gs-ptv">${me ? fmtP(wallet().pt) : g.mode === 'pvp' ? (g.oppPt0 != null ? fmtP(g.oppPt0) : '') : '판돈 무제한'}</div>
      <div class="gs-pl gs-sub" ${me ? '' : 'id="gsOH"'}>${me ? (G.adv ? '솔로 ' + G.adv + '판' : g.mode === 'pvp' ? '실시간 대전' : 'AI 대전') : '남은 패 ' + view.h[p].length + '장'}</div>
      <div class="gs-ps">${st}</div><span class="gs-pav">${av}</span>`;
  }
  /* 바닥: 가운데 더미를 둘러싼 12자리(월마다 자리 고정), 같은 월은 살짝 겹쳐 쌓기 */
  const SLOT = [...Array(13)].map((_, m) => { const a = (180 + (m - 1) * 30) * Math.PI / 180; return [630 + Math.cos(a) * 425, 334 + Math.sin(a) * 152]; });
  function floorHtml(view){
    const by = {}; view.f.forEach(id => { const m = C[id].m; (by[m] = by[m] || []).push(id); });
    const [w, h] = CW.floor;
    let out = '';
    for(let m = 1; m <= 12; m++){
      const L = by[m] || []; if(!L.length) continue;
      const [cx, cy] = SLOT[m], n = L.length;
      L.forEach((id, i) => { out += `<div class="gs-c fl${view.hi.includes(id) ? ' glow' : ''}" data-cid="${id}" style="${px(cx - w / 2 + (i - (n - 1) / 2) * 18, cy - h / 2 + (i - (n - 1) / 2) * 7, w, h)};z-index:${i + 2}">${cardSvg(id)}</div>`; });
      if(view.ppuk && view.ppuk[m] != null) out += `<span class="gs-ppk" style="left:${Math.round(cx + w / 2 + 6)}px;top:${Math.round(cy - h / 2 - 8)}px">뻑</span>`;
    }
    return out;
  }
  function handHtml(view){
    const g = GS(), hand = view.h[g.me].slice().sort((a, b) => ((C[a] && C[a].m) || 99) - ((C[b] && C[b].m) || 99) || a - b);
    const fm = new Set(view.f.map(id => C[id].m)), mt = myTurn() && !g.busy, [w, h] = CW.hand, n = hand.length;
    const step = n > 1 ? Math.min(152, (1452 - w) / (n - 1)) : 0;
    return hand.map((id, i) => { const c = C[id], hit = c && !c.bonus && fm.has(c.m), bon = (c && c.bonus) || isDummy(id);
      return `<button class="gs-c hd${mt && (hit || bon) ? ' match' : ''}${mt ? '' : ' off'}" data-cid="${id}" data-h="${id}" style="${px(12 + i * step, 683, w, h)};z-index:${i + 1}" aria-label="${cardName(id)}${hit ? ', 바닥에 같은 월 있음' : ''}">${cardSvg(id)}</button>`; }).join('');
  }
  function liveView(){ const S = GS().S; return Object.assign(snap(S), { ppuk:S.ppuk }); }
  function infoHtml(view){
    const g = GS(), S = g.S, s = scoreOf(view.c[g.me]), P = S.P[g.me];
    const mul = [P.shake ? '흔들 ×' + Math.pow(2, P.shake) : '', P.go >= 3 ? P.go + '고 ×' + Math.pow(2, P.go - 2) : '', s.yN >= 7 ? '멍따 ×2' : ''].filter(Boolean);
    return `<div class="gs-ih">내 패</div><div class="gs-ir"><span>광 <b>${s.gN}</b></span><span>열 <b>${s.yN}</b></span><span>띠 <b>${s.tN}</b></span><span>피 <b>${s.piV}</b></span></div>
      <div class="gs-ir2">${mul.length ? mul.join(' · ') : (s.birds === 3 ? '고도리!' : s.hong === 3 || s.cheong === 3 || s.cho === 3 ? '단 완성!' : '7점 나면 고 · 스톱')}</div>
      <div class="gs-timer" id="gsTimer"><i></i></div>`;
  }
  function draw(view){
    const g = GS(); if(!g || !$('#gsb')) return;
    const op = 1 - g.me;
    $('#gsCapOp').innerHTML = capHtml(view.c[op], 14);
    $('#gsCapMe').innerHTML = capHtml(view.c[g.me], 584);
    $('#gsPtsOp').innerHTML = `<b>${scoreOf(view.c[op]).total}</b><small>점</small>`;
    $('#gsPtsMe').innerHTML = `<b>${scoreOf(view.c[g.me]).total}</b><small>점</small>`;
    $('#gsFloor').innerHTML = floorHtml(view);
    const [dw, dh] = CW.deck;
    $('#gsDeck').innerHTML = view.d ? `${view.d > 1 ? `<div class="gs-c back" style="${px(630 - dw / 2 + 7, 334 - dh / 2 + 7, dw, dh)}">${BACK}</div>` : ''}<div class="gs-c back" data-cid="deck" style="${px(630 - dw / 2, 334 - dh / 2, dw, dh)}">${BACK}</div><span class="gs-dn" style="left:${630 - 40}px;top:${334 + dh / 2 + 14}px">${view.d}</span>` : `<span class="gs-dn" style="left:${630 - 90}px;top:325px;width:180px">더미 끝</span>`;
    $('#gsOpp').innerHTML = profHtml(op, view);
    $('#gsMe').innerHTML = profHtml(g.me, view);
    $('#gsOpp').classList.toggle('on', !g.S.over && g.S.turn === op);
    $('#gsMe').classList.toggle('on', !g.S.over && g.S.turn === g.me);
    $('#gsInfo').innerHTML = infoHtml(view);
    $('#gsHand').innerHTML = handHtml(view);
    $('#gsHand').querySelectorAll('[data-h]').forEach(b => b.onclick = () => onHand(+b.dataset.h));
    const au = $('#gsAuto'); if(au) au.disabled = !(myTurn() && !g.busy);
  }
  /* 장면 바꾸기: 카드가 예전 자리에서 새 자리로 날아가게(FLIP). 판이 돌려져 있으면 화면 좌표를 판 좌표로 바꿔 계산 */
  function flipTo(view, prev, dur){
    const root = $('#gsb'), g = GS(); if(!root || !g) return;
    const org = r => g.rot ? [r.right, r.top] : [r.left, r.top];
    const old = {};
    root.querySelectorAll('[data-cid]').forEach(el => { old[el.dataset.cid] = el.getBoundingClientRect(); });
    const oh = $('#gsOpp .gs-pav'), ohR = oh ? oh.getBoundingClientRect() : null, dk = root.querySelector('[data-cid="deck"]'), dkR = dk ? dk.getBoundingClientRect() : null;
    draw(view);
    if(FXR.reduce) return;
    const op = 1 - g.me;
    root.querySelectorAll('[data-cid]').forEach(el => {
      const cid = el.dataset.cid; if(cid === 'deck') return;
      let o = old[cid];
      if(!o){ const id = +cid; o = prev && prev.h[op].includes(id) ? ohR : dkR; }
      if(!o || !o.width) return;
      const n = el.getBoundingClientRect(); if(!n.width) return;
      const [ox, oy] = org(o), [nx, ny] = org(n), sx = ox - nx, sy = oy - ny;
      const dx = g.rot ? sy / g.sc : sx / g.sc, dy = g.rot ? -sx / g.sc : sy / g.sc, s = Math.max(o.width, o.height) / Math.max(n.width, n.height);
      if(Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < .02) return;
      try{ el.animate([{ transform:`translate(${dx}px,${dy}px) scale(${s})`, zIndex:60 }, { transform:'none', zIndex:60 }], { duration:dur || 360, easing:'cubic-bezier(.25,.9,.3,1)' }); }catch(_){}
    });
  }
  function banner(txt, kind){
    const b = $('#gsBan'); if(!b) return;
    b.innerHTML = `<b class="${kind || ''}">${txt}</b>`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    try{ const r = b.getBoundingClientRect(); fxEmit(r.left + r.width / 2, r.top + r.height / 2, { quantity:22, speed:[180, 360], lifespan:750, scale:{ start:1.3, end:0 }, color:kind === 'bad' ? ['#FF8A8F', '#FFFFFF'] : ['#FFE27A', '#FFFFFF'], kind:'spark', glow:true }); }catch(_){}
  }
  async function playScenes(prev, scenes){
    let pv = prev;
    for(const sc of scenes){
      if(!GS() || G.over) return;
      flipTo(sc, pv, 360);
      sfx(sc.flip != null ? 'gsFlip' : 'gsSlap');
      let w = 440;
      if(sc.lab && sc.lab.length){
        const big = sc.lab.find(l => /[!]$/.test(l));
        if(big){ banner(sc.lab.filter(l => /!$/.test(l)).join(' '), /뻑!$/.test(big) && !/먹기|자뻑/.test(big) ? 'bad' : ''); sfx(/뻑!$/.test(big) && !/먹기|자뻑/.test(big) ? 'gsBad' : 'gsBig'); fxBuzz([20, 30, 20]); w = 780; }
        const st = sc.lab.find(l => /^피 /.test(l)); if(st){ setTimeout(() => { try{ toast(st); }catch(_){} }, 200); }
      }
      if(sc.c && pv && (sc.c[0].length > pv.c[0].length || sc.c[1].length > pv.c[1].length)) setTimeout(() => sfx('gsCap'), 260);
      await wait(w);
      pv = sc;
    }
  }

  /* ----- 흐름 ----- */
  function startPlay(seed){
    const g = GS();
    g.S = gsDeal(seed); g.S.first = 0;
    g.rnd = mulberry(seedFrom(seed + ':ai'));
    g.sel = null; g.busy = false; g.began = true;
    $('#gsBody').hidden = false; fit();
    const tg = $('#gsTag'); if(tg) tg.innerHTML = `${BADGE19}<span>고스톱 · ${(g.room || ROOMS[0]).stake ? '점당 ' + fmtP(g.room.stake) : '연습 판'}</span>`;
    const gate = $('#gsGate'); if(gate) gate.remove();
    draw(liveView());
    /* 패 돌리기 연출 */
    try{ if(!FXR.reduce) document.querySelectorAll('#gsg .gs-c.hd, #gsg .gs-c.fl').forEach((el, i) => el.animate([{ transform:'translateY(-30px) scale(.5)', opacity:0 }, { transform:'none', opacity:1 }], { duration:360, delay:i * 28, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'backwards' })); }catch(_){}
    sfx('gsDeal');
    if(g.S.over){ setTimeout(() => endGame(), 900); return; }
    setTimeout(() => startTurn(), 650);
  }
  function startTurn(){
    const g = GS(); if(!g || G.over) return;
    const S = g.S;
    if(S.over){ endGame(); return; }
    g.sel = null;
    draw(liveView());
    clearTimeout(g.turnT); g.turnAt = Date.now();
    if(S.turn === g.me){
      setMsg(`<b>내 차례</b> · ${S.P[g.me].hand.some(id => C[id] && C[id].bonus) ? '보너스패를 먼저 내도 돼요' : '낼 패를 누르세요'}`, 'me');
      sfx('gsTurn');
      if(g.mode === 'pvp') timerRun(TURN_SEC, () => autoPlay());
    } else {
      setMsg(`<b>${esc(g.oppNick)}</b> 차례…`, 'op');
      timerStop();
      if(g.mode !== 'pvp') g.turnT = setTimeout(() => { if(GS() === g && !G.over) aiTurn(); }, 650 + g.rnd() * 500);
    }
  }
  const TURN_SEC = 25, GS_SEC = 15, OPP_WAIT = 60;
  function timerRun(sec, onEnd){
    const g = GS(); timerStop();
    g.tEnd = Date.now() + sec * 1000; g.tSec = sec; g.tCb = onEnd;
    g.tIv = setInterval(() => {
      if(GS() !== g || G.over){ clearInterval(g.tIv); return; }
      const left = (g.tEnd - Date.now()) / 1000, t = $('#gsTimer');
      if(t){ t.classList.add('on'); t.firstChild.style.width = Math.max(0, left / g.tSec * 100) + '%'; t.classList.toggle('hurry', left < 6); }
      if(left <= 0){ clearInterval(g.tIv); const cb = g.tCb; g.tCb = null; if(cb) cb(); }
    }, 200);
  }
  function timerStop(){ const g = GS(); if(!g) return; clearInterval(g.tIv); g.tCb = null; const t = $('#gsTimer'); if(t) t.classList.remove('on', 'hurry'); }
  function onHand(id){
    const g = GS(); if(!g || g.busy || !myTurn()) return;
    sfx('gsPick', { off:false });
    myPlay(id);   /* 한 번 누르면 바로 냄 */
  }
  function autoHand(){
    const g = GS(); if(!g || g.busy || !myTurn()) return;
    g.busy = true; timerStop();
    commit(g.me, aiPick(g.S, g.me, 'normal', g.rnd));   /* 자동 치기: 보통 AI가 대신 골라 냄 */
  }
  /* 고르기 창(게임 화면 안). pvp에선 시간이 다 되면 기본값 */
  function ask(title, opts, defIdx, cards){
    const g = GS();
    return new Promise(res => {
      const box = $('#gsAsk'); if(!box){ res(opts[defIdx || 0].v); return; }
      box.innerHTML = `<div class="gs-askc"><b>${title}</b>${cards ? `<div class="gs-askcards">${cards}</div>` : ''}<div class="gs-askb">${opts.map((o, i) => `<button class="${o.cls || ''}" data-i="${i}">${o.html}</button>`).join('')}</div></div>`;
      box.hidden = false;
      let done = false;
      const fin = v => { if(done) return; done = true; if(g.askFin === fin0) g.askFin = null; box.hidden = true; box.innerHTML = ''; res(v); };
      const fin0 = () => fin(opts[defIdx || 0].v);
      box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { sfx('gsPick', {}); fin(opts[+b.dataset.i].v); });
      g.askFin = fin0;
    });
  }
  async function myPlay(id){
    const g = GS(), S = g.S;
    g.busy = true; g.sel = null;
    let s = 0, a = -1, b = -1;
    if(!isDummy(id) && !C[id].bonus){
      const M = C[id].m, nh = S.P[g.me].hand.filter(x => C[x] && C[x].m === M).length, F = floorOf(S, M);
      if(nh >= 3 && F.length === 1){ s = 2; }
      else if(nh >= 3 && F.length === 0){
        s = await ask(`${M}월 세 장! 흔들까요?`, [{ v:1, html:'흔들기 (점수 ×2)', cls:'pri' }, { v:0, html:'그냥 내기' }], 0, S.P[g.me].hand.filter(x => C[x] && C[x].m === M).map(x => `<div class="gs-c ask">${cardSvg(x)}</div>`).join(''));
        if(!GS() || G.over) return;
      }
      if(s !== 2 && F.length === 2){
        if(same(F[0], F[1])) a = F[0];
        else { a = await ask('어느 패를 먹을까요?', F.map(x => ({ v:x, html:`<div class="gs-c ask">${cardSvg(x)}</div><small>${cardName(x)}</small>`, cls:'card' })), 0); if(!GS() || G.over) return; }
      }
      const pr = gsApply(cloneS(S), g.me, { c:id, a, b:-1, s }, true);
      if(pr && pr.need === 'b'){
        b = await ask(`뒤집은 패 <span class="gs-inl">${cardSvg(pr.flip)}</span> 로 어느 패를 먹을까요?`, pr.opts.map(x => ({ v:x, html:`<div class="gs-c ask">${cardSvg(x)}</div><small>${cardName(x)}</small>`, cls:'card' })), 0);
        if(!GS() || G.over) return;
      }
    }
    timerStop();
    await commit(g.me, { c:id, a, b, s });
  }
  function autoPlay(){
    const g = GS(); if(!g || G.over) return;
    if(g.askFin){ g.askFin(); return; }
    if(g.busy || !myTurn()) return;
    toast('시간이 지나 자동으로 냈어요');
    g.busy = true;
    commit(g.me, aiPick(g.S, g.me, 'normal', g.rnd));
  }
  function aiTurn(){
    const g = GS(); if(!g || G.over || g.busy || g.S.turn === g.me) return;
    g.busy = true;
    commit(1 - g.me, aiPick(g.S, 1 - g.me, g.ai, g.rnd));
  }
  async function commit(p, act){
    const g = GS(), S = g.S;
    g.busy = true; g.askFin = null;
    const prev = liveView();
    const scenes = gsApply(S, p, act);
    await playScenes(prev, scenes);
    if(GS() !== g || G.over) return;
    if(S.pendingGS === p){
      let go;
      if(p === g.me){
        draw(liveView());
        const sc = scoreOf(S.P[p].cap).total, op = S.P[1 - p];
        if(g.mode === 'pvp') timerRun(GS_SEC, () => { if(g.askFin) g.askFin(); });
        sfx('gsBig');
        go = await ask(`<span class="gs-gsh">${sc}점 났어요!</span>${op.go ? '<small>상대가 고를 했어요 · 지금 스톱하면 고박(×2)</small>' : `<small>고 하면 +${S.P[p].go + 1}점${S.P[p].go + 1 >= 3 ? ' · 배수' : ''} · 대신 상대가 먼저 나면 고박</small>`}`,
          [{ v:1, html:`고! <small>${S.P[p].go + 1}고</small>`, cls:'go' }, { v:0, html:'스톱', cls:'stop' }], 1);
        timerStop();
        if(!GS() || G.over) return;
        act.g = go ? 1 : 0;
      } else go = g.mode === 'pvp' ? act.g === 1 : aiGo(S, p, g.ai, g.rnd);
      gsGoStop(S, p, !!go);
      banner(go ? (S.P[p].go + '고!') : '스톱!', go ? '' : 'stop');
      sfx(go ? 'gsGo' : 'gsStop'); fxBuzz(go ? [30, 40, 30] : 60);
      await wait(900);
      if(GS() !== g || G.over) return;
    }
    if(p === g.me) publish(act);
    g.busy = false;
    if(S.over) endGame(); else startTurn();
  }

  /* ----- 끝 ----- */
  function endGame(){
    const g = GS(); if(!g || g.ended) return;
    g.ended = true; timerStop(); clearTimeout(g.turnT);
    const S = g.S, r = S.result || { w:-1, final:0, rows:[], mults:[], why:'나가리' };
    g.res = r;
    draw(liveView());
    const win = r.w === g.me, draw0 = r.w < 0;
    const pay = settle() || { d:0, bonus:0, got:[], after:wallet().pt };
    draw(liveView());
    const payHtml = (g.room && g.room.stake ? `<div class="gs-pay ${pay.d > 0 ? 'up' : pay.d < 0 ? 'down' : ''}"><span>점당 ${fmtP(g.room.stake)}</span><b>${pay.d > 0 ? '+' : ''}${fmtP(pay.d)}</b></div>` : '<div class="gs-pay"><span>연습 판</span><b>포인트 변화 없음</b></div>')
      + (pay.bonus ? `<div class="gs-pay up sm"><span>솔로 새 판 첫 클리어</span><b>+${fmtP(pay.bonus)}</b></div>` : '')
      + pay.got.map(a => `<div class="gs-pay up sm"><span>업적 · ${a.name}</span><b>+${fmtP(a.pt)}</b></div>`).join('')
      + `<p class="gs-after">보유 포인트 <b>${fmtP(pay.after)}</b>${pay.after < ROOMS[1].min ? ' · 다음 판 전에 파산 구제를 받을 수 있어요' : ''}</p>`;
    const mult = r.mults && r.mults.length ? r.mults.map(m => `<div><span>${m[0]}</span><b>×${m[1]}</b></div>`).join('') : '';
    const box = $('#gsAsk');
    const html = `<div class="gs-askc gs-end ${draw0 ? 'd' : win ? 'w' : 'l'}"><b class="gs-et">${draw0 ? '나가리' : win ? '이겼어요!' : '졌어요'}</b>
      <p class="gs-ew">${draw0 ? '아무도 7점을 못 내고 패가 다 떨어졌어요(무승부)' : (win ? '내가 ' : esc(g.oppNick) + '님이 ') + (r.why === '스톱' ? '스톱했어요' : r.why === '마지막 패' ? '마지막 패로 났어요' : r.why === '기권' ? '이겼어요(상대 기권)' : r.why + '로 이겼어요')}</p>
      ${draw0 ? '' : `<div class="gs-erows">${(r.rows || []).map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}${mult}<div class="tot"><span>최종</span><b>${fmt(r.final)}점</b></div></div>`}
      ${payHtml}
      <div class="gs-askb"><button class="pri" id="gsEndOk">결과 보기</button></div></div>`;
    if(box){ box.innerHTML = html; box.hidden = false; }
    sfx(draw0 ? 'gsStop' : win ? 'gsWin' : 'gsLose');
    if(win) try{ fxConfetti(); }catch(_){}
    const done = () => {
      if(GS() !== g || G.over) return;
      if(box){ box.hidden = true; box.innerHTML = ''; }
      if(G.duel){
        G.duel.r = draw0 ? 'd' : win ? 'w' : 'l';
        G.duel.a = { sc:win ? r.final : null, pg:null }; G.duel.b = { sc:!win && !draw0 ? r.final : null, pg:null };
        G.duel.why = draw0 ? '나가리 · 무승부예요' : r.why === '기권' ? (win ? '상대가 떠나 기권승이에요' : '기권패예요') : (win ? '내가 ' : '상대가 ') + fmt(r.final) + '점으로 났어요';
      }
      finish(win);
    };
    const ok = $('#gsEndOk'); if(ok) ok.onclick = done;
    g.endT = setTimeout(done, g.mode === 'pvp' ? 12000 : 30000);
  }

  /* ----- 고스톱 포인트(이 게임 전용, 무료로만 얻음 · 구매·환전·선물 없음) ----- */
  const PT_KEY = 'hp:gs:pt', START_PT = 10000, RESCUE_TO = 10000, FREE_PT = 3000, FREE_MS = 3 * 3600 * 1000;
  const ROOMS = [
    { k:0, stake:0, min:0, name:'연습 판', sub:'포인트 안 걸림' },
    { k:1, stake:100, min:2000, name:'점당 100P', sub:'입장 2천P' },
    { k:2, stake:500, min:10000, name:'점당 500P', sub:'입장 1만P' },
    { k:3, stake:1000, min:30000, name:'점당 1,000P', sub:'입장 3만P' },
    { k:4, stake:5000, min:150000, name:'점당 5,000P', sub:'입장 15만P' }
  ];
  const ACH = [
    { k:'win1', name:'첫 승리', pt:3000 },
    { k:'go3', name:'3고 이상으로 이기기', pt:5000 },
    { k:'bak', name:'피박·광박 씌우기', pt:2000 },
    { k:'shake', name:'흔들기·폭탄으로 이기기', pt:2000 },
    { k:'big', name:'한 판 20점 이상 나기', pt:5000 },
    { k:'ch1', name:'솔로 챕터 1 깨기', pt:5000 }
  ];
  const TITLES = [[0, '동네 새내기'], [30000, '사랑방 고수'], [100000, '장터 명인'], [500000, '큰손'], [2000000, '전설의 손']];
  const titleOf = pt => TITLES.filter(t => pt >= t[0]).pop()[1];
  const fmtP = n => fmt(Math.round(n)) + 'P';
  const yday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  function wallet(){
    const w = store.get(PT_KEY, null) || { pt:START_PT, peak:START_PT, att:'', streak:0, rescue:'', free:0, ach:{}, games:0, wins:0 };
    w.ach = w.ach || {};
    return w;
  }
  function saveW(w){ w.pt = Math.max(0, Math.round(w.pt)); w.peak = Math.max(w.peak || 0, w.pt); store.set(PT_KEY, w); }
  const broke = w => w.pt < ROOMS[1].min;
  /* 출석: 하루 첫 판 화면에서 1,000P + 연속 하루마다 400P(최대 +2,400P) */
  function attendance(){
    const w = wallet(), t = dayKey(); if(w.att === t) return 0;
    w.streak = w.att === yday() ? (w.streak || 0) + 1 : 1; w.att = t;
    const b = 1000 + Math.min(6, w.streak - 1) * 400; w.pt += b; saveW(w); return b;
  }
  /* 파산 구제: 입장 최소(2천P)보다 적으면 하루 한 번 1만P까지 채움 */
  function rescue(){ const w = wallet(); if(!broke(w) || w.rescue === dayKey()) return 0; const b = RESCUE_TO - w.pt; w.pt = RESCUE_TO; w.rescue = dayKey(); saveW(w); return b; }
  /* 무료 충전: 파산 구제를 쓴 날에도 모자라면 3시간마다 3천P */
  const freeLeft = w => Math.max(0, (w.free || 0) + FREE_MS - Date.now());
  function freeCharge(){ const w = wallet(); if(!broke(w) || w.rescue !== dayKey() || freeLeft(w) > 0) return 0; w.pt += FREE_PT; w.free = Date.now(); saveW(w); return FREE_PT; }
  function achieve(keys){
    const w = wallet(), got = [];
    keys.forEach(k => { const a = ACH.find(x => x.k === k); if(a && !w.ach[k]){ w.ach[k] = dayKey(); w.pt += a.pt; got.push(a); } });
    if(got.length) saveW(w);
    return got;
  }
  const hm = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분'; };

  /* 방 고르기 + 포인트 얻기 화면(판 안) */
  function lobby(){
    const g = GS(); if(!g || G.over) return;
    const att = attendance();
    const box = $('#gsLobby'); box.hidden = false; $('#gsBody').hidden = true;
    const draw0 = msg => {
      const w = wallet(), fl = freeLeft(w), canRescue = broke(w) && w.rescue !== dayKey(), canFree = broke(w) && w.rescue === dayKey() && fl === 0;
      const nAch = ACH.filter(a => w.ach[a.k]).length;
      box.innerHTML = `<div class="gs-lb">
        <div class="gs-wal"><span class="gs-coin">P</span><div><small>내 고스톱 포인트</small><b>${fmtP(w.pt)}</b><em>${titleOf(w.peak)} · 최고 ${fmtP(w.peak)}</em></div></div>
        <h3>${g.mode === 'pvp' ? '대전할 방을 골라요' : G.adv ? '솔로 ' + G.adv + '판 · 방을 골라요' : 'AI와 겨룰 방을 골라요'}</h3>
        <div class="gs-rooms">${ROOMS.map(r => { const ok = w.pt >= r.min; return `<button class="gs-room r${r.k}" data-r="${r.k}" ${ok ? '' : 'disabled'}><b>${r.name}</b><small>${ok ? r.sub : fmtP(r.min) + ' 필요'}</small></button>`; }).join('')}</div>
        <p class="gs-rnote">이기면 <b>최종 점수 × 점당</b>만큼 따고, 지면 그만큼 잃어요(가진 포인트까지만). 포인트는 게임 안에서만 쓰고 돈으로 사고팔 수 없어요.</p>
        <div class="gs-earn"><b>포인트 얻는 법</b>
          <div class="${w.att === dayKey() ? 'done' : ''}"><span>매일 출석 <small>${w.streak || 1}일 연속 · 내일 +${fmt(1000 + Math.min(6, w.streak || 0) * 400)}P</small></span><i>${att ? '+' + fmt(att) + 'P 받음' : '오늘 받음'}</i></div>
          <div><span>파산 구제 <small>2천P보다 적으면 하루 한 번 1만P까지</small></span>${canRescue ? '<button id="gsRescue">받기</button>' : `<i>${w.rescue === dayKey() ? '오늘 받음' : '포인트 충분'}</i>`}</div>
          <div><span>무료 충전 <small>구제 뒤에도 모자라면 3시간마다 3천P</small></span>${canFree ? '<button id="gsFree">받기</button>' : `<i>${broke(w) && w.rescue === dayKey() ? hm(fl) + ' 뒤' : '필요 없음'}</i>`}</div>
          <div><span>업적 <small>${ACH.map(a => `${w.ach[a.k] ? '✓' : '·'} ${a.name} +${fmt(a.pt / 1000)}천`).join(' ')}</small></span><i>${nAch}/${ACH.length}</i></div>
          <div><span>솔로 새 판 첫 클리어 <small>챕터마다 +500P씩 커짐</small></span><i>솔로</i></div>
        </div></div>`;
      if(msg) try{ toast(msg); }catch(_){}
      box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = ROOMS[+b.dataset.r]; if(wallet().pt < r.min) return; sfx('gsPick', {}); g.room = r; box.hidden = true; box.innerHTML = '';
        if(g.mode === 'pvp') search(); else startPlay('gs:' + (G.adv ? 'solo:' + G.adv : 'ai') + ':' + g.seedBase); });
      const rb = $('#gsRescue'); if(rb) rb.onclick = () => { const b = rescue(); if(b){ sfx('gsWin'); draw0(`파산 구제 +${fmtP(b)}! 다시 도전해요`); } };
      const fb = $('#gsFree'); if(fb) fb.onclick = () => { const b = freeCharge(); if(b){ sfx('gsCap'); draw0(`무료 충전 +${fmtP(b)}`); } };
    };
    draw0(att ? `출석 보상 +${fmtP(att)}!` : '');
    if(att) sfx('gsBig');
  }
  /* 정산(판이 끝날 때 한 번): 이기면 최종 점수 × 점당(상대가 가진 만큼까지), 지면 잃음(내가 가진 만큼까지) */
  function settle(){
    const g = GS(); if(!g || g.paid) return null;
    g.paid = true;
    const r = g.S.result, room = g.room || ROOMS[0], w = wallet(), win = r && r.w === g.me, lose = r && r.w >= 0 && !win;
    let d = 0;
    if(room.stake && win) d = Math.min(r.final * room.stake, g.mode === 'pvp' ? (g.oppPt0 ?? Infinity) : Infinity);
    else if(room.stake && lose) d = -Math.min(r.final * room.stake, w.pt);
    w.pt += d; w.games = (w.games || 0) + 1; if(win) w.wins = (w.wins || 0) + 1; saveW(w);
    const keys = [];
    if(win){ keys.push('win1'); if(r.mults && r.mults.some(m => /피박|광박/.test(m[0]))) keys.push('bak'); if(g.S.P[g.me].go >= 3) keys.push('go3'); if(g.S.P[g.me].shake) keys.push('shake'); if(r.final >= 20) keys.push('big');
      if(G.adv === 10 && !(advProg(ID).stars || {})[10]) keys.push('ch1'); }
    let bonus = 0;
    if(win && G.adv && !(advProg(ID).stars || {})[G.adv]){ bonus = 500 * Math.ceil(G.adv / 10); const w2 = wallet(); w2.pt += bonus; saveW(w2); }
    const got = achieve(keys);
    return { d, bonus, got, after:wallet().pt };
  }
  /* 판 도중 나가면 기권 벌점(점당 × 10, 가진 만큼까지) */
  function quitPenalty(){
    const g = GS(); if(!g || !g.began || g.ended || g.paid || !g.room || !g.room.stake) return;
    g.paid = true; const w = wallet(), p = Math.min(w.pt, g.room.stake * 10); w.pt -= p; saveW(w);
    try{ toast(`판 도중에 나가서 ${fmtP(p)}을 잃었어요`); }catch(_){}
  }

  /* ----- 19세 확인 ----- */
  const AGE_KEY = 'hp:age19';
  const ageOk = () => !!store.get(AGE_KEY, 0);
  function gateHtml(){
    return `<div class="gs-gate" id="gsGate"><div class="gs-gcard"><span class="gs19 big">19</span><b>19세 이상 이용 게임이에요</b>
      <p>고스톱은 청소년에게 맞지 않는 게임이라 만 19세 이상만 할 수 있어요. 돈이나 상품을 걸 수 없고, 점수는 게임 안에서만 써요.</p>
      <div class="gs-askb"><button class="pri" id="gsAgeY">네, 만 19세 이상이에요</button><button id="gsAgeN">아니요</button></div></div></div>`;
  }
  function ageGate(go){
    if(ageOk()){ go(); return; }
    openModal(`<div class="gs-mgate"><span class="gs19 big">19</span><h3>19세 이상 이용 게임</h3><p class="note">고스톱은 만 19세 이상만 할 수 있어요. 돈이나 상품을 걸 수 없고, 점수는 게임 안에서만 써요.</p></div>
      <div class="mbtns"><button class="b2" id="mClose">아니요</button><button class="b1" id="mGo">네, 만 19세 이상이에요</button></div>`);
    $('#mClose').onclick = closeModal;
    $('#mGo').onclick = () => { store.set(AGE_KEY, 1); closeModal(); go(); };
  }

  /* ----- 실시간 대전(턴제): 상대 찾기 · 수 주고받기 ----- */
  const enc = a => [a.c, a.a == null ? -1 : a.a, a.b == null ? -1 : a.b, a.s || 0, a.g == null ? -1 : a.g];
  const dec = v => ({ c:v[0], a:v[1], b:v[2], s:v[3], g:v[4] });
  function publish(act){
    const g = GS(); if(!g || g.mode !== 'pvp' || !g.nr) return;
    g.mv.push(enc(act));
    try{ g.nr.presence({ mv:g.mv }).catch(() => {}); }catch(_){}
  }
  function searchUI(){
    const g = GS();
    $('#gsBody').hidden = true;
    const box = $('#gsSearch'); box.hidden = false;
    box.innerHTML = `<div class="gs-sc0"><div class="gs-fan">${[3, 17, 30].map((id, i) => `<div class="gs-c" style="--r:${(i - 1) * 14}deg">${cardSvg(id)}</div>`).join('')}</div>
      <h3 id="gsSt">상대를 찾는 중</h3><p class="gs-sroom">${g.room ? g.room.name + ' 방' : ''}</p><p id="gsSn"></p>
      <div class="gs-askb"><button class="pri" id="gsAiNow">AI와 바로 대전</button></div></div>`;
    $('#gsAiNow').onclick = () => switchAI();
    searchText();
  }
  function searchText(){
    const g = GS(), st = $('#gsSt'), sn = $('#gsSn'); if(!st || !g) return;
    const left = Math.max(0, 20 - Math.floor((Date.now() - g.mmT0) / 1000));
    if(g.phase === 'joining'){ st.textContent = '상대를 찾았어요!'; sn.innerHTML = `<b>${esc(g.oppNick)}</b>님과 연결하는 중…`; return; }
    if(g.phase === 'nobody'){ st.textContent = '지금 대전할 상대가 없어요'; sn.textContent = '계속 기다리면 누가 들어올 때 바로 연결해요. 지금 AI와 겨룰 수도 있어요.'; return; }
    st.textContent = '상대를 찾는 중';
    sn.textContent = `${left}초 · ${duelWaiting(ID) ? '기다리는 사람 ' + duelWaiting(ID) + '명' : '판을 깔고 기다리는 중'} · 내 이름 ${g.nick}`;
  }
  function search(){
    const g = GS(); g.phase = 'search'; g.mmT0 = Date.now(); searchUI();
    const room = ROOM; if(!room){ switchAI(); return; }
    g.dt = Date.now();
    room.presence({ du:'wait', dg:ID, dt:g.dt, nk:g.nick, dp:null, dr:g.room.k }).catch(() => {});
    const check = () => {
      if(GS() !== g || G.over || (g.phase !== 'search' && g.phase !== 'nobody')) return;
      let ps; try{ ps = room.peers(); }catch(_){ return; }
      const me = ps.find(p => p.sameTab); if(!me) return;
      g.myPeer = me.peer;
      const claim = ps.find(p => !p.sameTab && p.presence && p.presence.du === 'play' && p.presence.dg === ID && p.presence.dp === me.peer && p.presence.dr === g.room.k);
      if(claim){ match(claim); return; }
      const list = ps.filter(p => p.presence && p.presence.du === 'wait' && p.presence.dg === ID && p.presence.dr === g.room.k && typeof p.presence.dt === 'number')
        .sort((a, b) => a.presence.dt - b.presence.dt || (a.peer < b.peer ? -1 : 1));
      const i = list.findIndex(p => p.sameTab); if(i < 0) return;
      const opp = list[i % 2 ? i - 1 : i + 1]; if(opp) match(opp);
    };
    try{ g.mmUn = room.onPeers(check, () => {}); }catch(_){}
    g.mmIv = setInterval(() => {
      if(GS() !== g){ clearInterval(g.mmIv); return; }
      check();
      if(g.phase === 'search' && Date.now() - g.mmT0 > 20000){ g.phase = 'nobody'; }
      searchText();
    }, 500);
  }
  function stopSearch(){ const g = GS(); if(!g) return; clearInterval(g.mmIv); if(g.mmUn) try{ g.mmUn(); }catch(_){} g.mmUn = null; }
  function lobbyClear(){ if(ROOM) ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null, dr:null }).catch(() => {}); }
  function switchAI(){
    const g = GS(); if(!g || g.began) return;
    stopSearch(); roomClose(); lobbyClear();
    g.mode = 'ai'; G.mode = 'ai'; g.ai = 'normal'; g.oppNick = 'AI 고수';
    if(G.duel){ G.duel.mode = 'ai'; G.duel.opp = { nick:'AI 고수' }; }
    $('#gsSearch').hidden = true;
    startPlay('gs:ai:' + g.seedBase + ':' + Date.now());
  }
  async function match(opp){
    const g = GS(); if(g.phase !== 'search' && g.phase !== 'nobody') return;
    stopSearch();
    g.phase = 'joining'; g.oppPeer = opp.peer; g.oppNick = String((opp.presence && opp.presence.nk) || '상대').slice(0, 12);
    ROOM.presence({ du:'play', dp:opp.peer }).catch(() => {});
    searchText(); sfx('gsBig'); fxBuzz([20, 40, 20]);
    const a = [g.myPeer, opp.peer].map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)).sort();
    let nr;
    try{ nr = await ROOM.join(('fl-g-' + a[0] + '-' + a[1]).slice(0, 50)); }catch(_){ if(GS() === g) matchFail(); return; }
    if(GS() !== g || g.phase !== 'joining' || G.over){ try{ nr.leave(); }catch(_){} return; }
    g.nr = nr; g.joinT = Date.now(); g.mv = []; g.oc = 0;
    nr.presence({ v:1, nk:g.nick, mv:[], pt:wallet().pt }).catch(() => {});
    g.seat = g.myPeer < opp.peer ? 0 : 1;
    try{ g.nrUn = nr.onPeers(ch => {
        if(GS() !== g) return;
        if(g.oppSeen && ch.left.some(p => p.peer === g.oppPeer)){ if(!g.began){ matchFail(); return; } if(!g.oppGone){ g.oppGone = Date.now(); toast('상대 연결이 끊겼어요 · 15초 기다려요'); } }
        else sync();
      }, () => { if(GS() === g && !G.over && g.began && !g.ended){ toast('연결이 끊겨서 대전을 이어 가지 못했어요'); forfeit(false); } }); }catch(_){}
    g.syncIv = setInterval(() => { if(GS() === g) sync(); }, 250);
  }
  function matchFail(){ const g = GS(); roomClose(); g.oppSeen = false; if(G.over) return; toast('상대와 연결하지 못했어요. 다시 찾을게요'); search(); }
  function roomClose(){
    const g = GS(); if(!g) return;
    clearInterval(g.syncIv); if(g.nrUn) try{ g.nrUn(); }catch(_){} g.nrUn = null;
    if(g.nr){ const nr = g.nr; g.nr = null; setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
  }
  function oppPres(){
    const g = GS(); if(!g || !g.nr) return null;
    let ps; try{ ps = g.nr.peers(); }catch(_){ return null; }
    const o = ps.find(p => !p.sameTab && (p.peer === g.oppPeer || (p.presence && p.presence.nk === g.oppNick)));
    if(o && o.peer !== g.oppPeer){ g.oppPeer = o.peer; g.oppGone = 0; }   /* 상대가 다시 연결하면 새 peer id */
    return o ? o.presence || {} : null;
  }
  function sync(){
    const g = GS(); if(!g || G.over || g.ended) return;
    const o = oppPres();
    if(o && o.nk){ g.oppSeen = true; g.oppGone = 0; }
    if(!g.began){
      if(g.phase === 'joining' && o && o.nk){
        lobbyClear(); g.mode = 'pvp'; g.oppPt0 = typeof o.pt === 'number' ? o.pt : 0;
        const a = [g.myPeer, g.oppPeer].map(String).sort();
        g.me = g.seat;
        $('#gsSearch').hidden = true;
        startPlay('gs:pvp:' + a[0] + ':' + a[1]);
        g.lastOpp = Date.now();
      } else if(g.phase === 'joining' && Date.now() - g.joinT > 9000) matchFail();
      return;
    }
    if(g.oppGone && Date.now() - g.oppGone > 15000){ forfeit(true); return; }
    const S = g.S;
    if(!S || S.over) return;
    const mv = o && Array.isArray(o.mv) ? o.mv : [];
    if(!g.busy && S.turn !== g.me && S.pendingGS < 0 && mv.length > g.oc){
      const act = dec(mv[g.oc++]); g.lastOpp = Date.now();
      commit(1 - g.me, act);
      return;
    }
    if(S.turn !== g.me && !g.busy){
      const left = OPP_WAIT - (Date.now() - Math.max(g.lastOpp || 0, g.turnAt || 0)) / 1000;
      if(left < 20) setMsg(`<b>${esc(g.oppNick)}</b> 차례… 응답이 없으면 ${Math.max(0, Math.ceil(left))}초 뒤 기권승`, 'op');
      if(left <= 0){ forfeit(true); }
    }
  }
  function forfeit(iWin){
    const g = GS(); if(!g || g.ended) return;
    const S = g.S;
    if(S){ S.over = true; S.result = { w:iWin ? g.me : 1 - g.me, final:iWin ? Math.max(7, scoreOf(S.P[g.me].cap).total) : 0, base:0, why:'기권', rows:[['상대 기권', '']], mults:[] }; }
    g.busy = false; const box = $('#gsAsk'); if(box){ box.hidden = true; }
    endGame();
  }
  function cleanup(){
    const g = G && G.gs; if(!g) return;
    quitPenalty();
    clearInterval(g.tIv); clearTimeout(g.turnT); clearTimeout(g.endT); clearInterval(g.mmIv); clearInterval(g.syncIv);
    if(g.mmUn) try{ g.mmUn(); }catch(_){}
    if(g.nrUn) try{ g.nrUn(); }catch(_){}
    const nr = g.nr; g.nr = null;
    if(nr) setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1200);
    lobbyClear();
    if(g.onRs){ removeEventListener('resize', g.onRs); removeEventListener('orientationchange', g.onRs); }
    document.body.classList.remove('gs-full');
  }

  /* ----- 시작 ----- */
  function init(cfg, rng, lv){
    const mode = lv === 'pvp' ? 'pvp' : 'ai';
    const n = (store.get('hp:gs:n', 0) || 0) + 1; store.set('hp:gs:n', n);   /* 같은 스테이지라도 판마다 다른 패(문제 공유가 없는 게임) */
    const seedBase = Math.floor(rng() * 1e9) + ':' + n;
    const me = mode === 'pvp' ? 0 : G.adv ? (cfg.aiFirst ? 1 : 0) : (rng() < .5 ? 0 : 1);   /* 0번 자리 = 선(먼저 둠·바닥 보너스패) */
    G.gs = { mode, ai:cfg.ai || 'normal', me, seat:0, nick:duelNick(), oppNick:mode === 'pvp' ? '상대' : (G.adv ? AI_NAME[cfg.ai] : 'AI 고수'), seedBase, mv:[], oc:0, sel:null, busy:false, began:false };
    G.mode = mode;
    G.cleanup = cleanup;
  }
  const AI_NAME = { easy:'AI 새내기', normal:'AI 고수', hard:'AI 타짜' };
  function render(st){
    st.innerHTML = `<div class="gsg" id="gsg"><div class="gsb" id="gsb">
      <div id="gsBody" hidden>
        <div class="gs-mat"></div><div class="gs-tray op"></div><div class="gs-tray me"></div>
        <div class="gs-tag" id="gsTag">${BADGE19}<span>고스톱</span></div>
        <div id="gsCapOp"></div>
        <div class="gs-pts op" id="gsPtsOp"></div>
        <div id="gsFloor"></div><div id="gsDeck"></div>
        <div class="gs-pts me" id="gsPtsMe"></div>
        <div id="gsCapMe"></div>
        <div class="gs-side">
          <div class="gs-prof op" id="gsOpp"></div>
          <div class="gs-info" id="gsInfo"></div>
          <div class="gs-btns"><button id="gsHelpB" aria-label="게임 방법">?</button><button class="out" id="gsOut">나가기</button></div>
          <div class="gs-prof me" id="gsMe"></div>
          <div class="gs-msg" id="gsMsg"></div>
        </div>
        <div id="gsHand"></div>
        <button class="gs-auto" id="gsAuto">자동<br>치기</button>
      </div>
      <div class="gs-ban" id="gsBan" aria-live="polite"></div>
      <div class="gs-lobby" id="gsLobby" hidden></div>
      <div class="gs-search" id="gsSearch" hidden></div>
      <div class="gs-ask" id="gsAsk" hidden></div>
      ${ageOk() ? '' : gateHtml()}
    </div></div>`;
    document.body.classList.add('gs-full');
    const g0 = GS(); if(g0){ g0.onRs = () => fit(); addEventListener('resize', g0.onRs); addEventListener('orientationchange', g0.onRs); }
    fit();
    $('#gsHelpB').onclick = () => openHelp(ID);
    $('#gsOut').onclick = () => confirmQuit();
    $('#gsAuto').onclick = () => autoHand();
    const go = () => {
      const g = GS(); if(!g || G.over) return;
      const gate = $('#gsGate'); if(gate) gate.remove();
      lobby();
    };
    if(ageOk()) go();
    else {
      $('#gsAgeY').onclick = () => { store.set(AGE_KEY, 1); go(); };
      $('#gsAgeN').onclick = () => { G.over = true; HOST.exit(); };
    }
  }
  function stageLevel(n){
    const c = Math.ceil(n / 10), k = n - (c - 1) * 10;
    const q = (c === 1 ? 0 : c === 2 ? 1 : 2) + (k === 5 || k === 10 ? 1 : 0) - (k === 1 || k === 9 ? 1 : 0);
    return ['easy', 'normal', 'hard'][Math.max(0, Math.min(2, q))];
  }
  function aiFirst(n){ const c = Math.ceil(n / 10), k = n - (c - 1) * 10; return k === 5 || k === 10 || (c >= 3 && k % 2 === 0); }
  const res = () => { const g = GS(); return (g && g.res) || null; };
  const myFinal = () => { const g = GS(), r = res(); return r && g && r.w === g.me ? r.final || 0 : 0; };
  const LV = {
    easy:{ limit:0, ai:'easy' }, normal:{ limit:0, ai:'normal' }, hard:{ limit:0, ai:'hard' }
  };

  return {
    name:'고스톱', col:['#FF9A8A', '#C81E3A', '#6E0E1E'], time:'약 5분', abil:'전략력',
    modes:['solo', 'duel'],
    cardNote:() => '보유 ' + fmtP(wallet().pt),   /* 사이트·모듈 목록에 보이는 한 줄(포인트). 오늘의 시험지·연습 없음 */
    age:19,
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="10" height="15" rx="2" transform="rotate(-12 8 11.5)"/><rect x="10" y="4.5" width="10" height="15" rx="2" transform="rotate(10 15 12)" fill-opacity=".75"/></svg>',
    art(){
      const u = 'gsA' + (++SVG_UID);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${u}" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#2E9A62"/><stop offset="1" stop-color="#0F4A2E"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/><circle cx="80" cy="56" r="44" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
        ${[[0, 36, 32, -15], [28, 60, 23, -1], [44, 84, 28, 13]].map(([id, x, y, a], k) => `<clipPath id="${u}c${k}"><rect width="176" height="287" rx="11"/></clipPath><g transform="translate(${x} ${y}) rotate(${a}) scale(.22)"><g clip-path="url(#${u}c${k})">${cardInner(id)}</g></g>`).join('')}
        <g transform="translate(112 19)"><circle r="14" fill="#fff" stroke="#D7263D" stroke-width="4"/><text y="5.5" font-size="15" font-weight="900" text-anchor="middle" fill="#1A0F45" font-family="system-ui,sans-serif">19</text></g></svg>`;
    },
    helpExtra:() => [['그림 출처', '화투 그림: Marcus Richert(Louie Mantia, Jr.의 Hanafuda 그래픽 기반), Wikimedia Commons, <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ko" target="_blank" rel="noopener">CC BY-SA 4.0</a> 라이선스. 48장을 한 장 그림판으로 합쳐 씀.']],
    help:[
      ['같은 월끼리 먹어요', '내 패 한 장을 내고 더미에서 한 장을 뒤집어요. 바닥에 같은 월(왼쪽 위 숫자)이 있으면 둘 다 가져와요. 패를 누르면 들리고, 한 번 더 누르면 내요.'],
      ['7점 나면 고? 스톱?', '광 3장 3점(비광 끼면 2점)·4장 4점·5장 15점 · 열끗 5장 1점(고도리 5점) · 띠 5장 1점(홍단·청단·초단 3점) · 피 10장 1점. 7점이 나면 스톱해서 이기거나, 고를 불러 점수를 더 키워요(1고 +1, 2고 +2, 3고부터 2배씩). 고를 했는데 상대가 먼저 나면 고박!'],
      ['뻑·쪽·따닥·쓸', '뻑: 낸 패와 뒤집은 패가 바닥 패와 같은 월이면 세 장이 바닥에 묶여요(나중에 먹으면 피 1장, 내 뻑이면 2장). 쪽·따닥·쓸을 하면 상대 피 1장을 가져와요. 흔들기·폭탄은 점수 2배, 3뻑·총통은 바로 승리.'],
      ['박과 배수', '피박(상대 피 1~5장)·광박(상대 광 0장)·고박·멍따(열끗 7장+)는 점수 ×2. 둘 다 못 내고 패가 떨어지면 나가리(무승부). 19세 이상 · 돈이나 상품은 걸 수 없어요.']
    ],
    chapters:['동네 사랑방', '시장 골목', '장터 한마당', '명절 큰집', '고수의 방'],
    starRule:'★ 승리 · ★★ 10점 이상으로 승리 · ★★★ 20점 이상으로 승리',
    _pt:{ wallet, ROOMS, ACH, attendance, rescue, freeCharge },
    levels:LV,
    levelDesc:lv => (AI_NAME[lv] || 'AI') + '와 한 판',
    levelCfg(lv){ const k = LV[lv] ? lv : 'normal'; return { name:lv === 'pvp' ? '사람과' : AI_NAME[k], mult:1, [ID]:LV[k] }; },
    stage:n => ({ limit:0, ai:stageLevel(n), aiFirst:aiFirst(n) }),
    stageLevel,
    stageDesc:n => AI_NAME[stageLevel(n)] + '와 맞고 · ' + (aiFirst(n) ? 'AI가 선' : '내가 선') + ' · 이기면 클리어',
    init(cfg, rng, lv){ init(cfg, rng, lv); },
    render:st => render(st),
    titleExtra:() => ' ' + BADGE19,
    progress(){ const g = GS(); return g && g.S ? Math.min(1, scoreOf(g.S.P[g.me].cap).total / 7) : 0; },
    lossText(){ const g = GS(), r = res(); if(!g || !g.S) return '판이 시작되지 않았어요.'; if(r && r.w < 0) return '나가리(무승부)로 끝났어요.'; return `${r ? '상대가 ' + fmt(r.final) + '점으로 났어요. ' : ''}내 점수는 ${scoreOf(g.S.P[g.me].cap).total}점이었어요.`; },
    score(){
      const r = res(), f = myFinal(), nm = r && r.mults ? r.mults.length : 0;
      return { base:500, time:Math.min(350, f * 20), extra:Math.min(150, nm * 50),
        rows:[`승리 · ${fmt(f)}점${r && r.why ? ' (' + r.why + ')' : ''}`, `점수 보너스 (${fmt(f)}점 × 20, 최대 350)`, `박·흔들기 보너스 (${nm}개 × 50)`] };
    },
    stars(){ const f = myFinal(); return f >= 20 ? 3 : f >= 10 ? 2 : 1; },
    winTitle:'이겼어요!', loseTitle:'이번 판은 졌어요', noConfetti:true,
    bodyClass:'gsmode',
    duelHow:'1:1 맞고 · 점당 방 · 19세 이상',
    /* 고스톱은 대전이 따로(턴제 실시간): 같은 문제 동시 풀기 대신 마주 앉아 한 판. fleet:true = 엔진에 "게임이 대전을 직접 진행"이라고 알림 */
    duelLaunch(){ ageGate(() => { const live = duelLive(); startGame(ID, live ? 'pvp' : 'normal', { duel:{ fleet:true, mode:live ? 'pvp' : 'ai', opp:{ nick:live ? '상대' : 'AI 고수' } } }); }); },
    sounds:{
      gsSlap(){ aThump({ f:220, f2:90, d:.09, v:.22 }); aNoise({ ft:'highpass', f:2400, d:.05, v:.09 }); },
      gsFlip(){ aWhoosh({ f:1200, f2:3600, a:.01, d:.08, v:.05 }); aThump({ f:200, f2:90, t:.07, d:.08, v:.18 }); aNoise({ ft:'highpass', f:2600, t:.07, d:.04, v:.08 }); },
      gsCap(){ aMarimba(m2f(79), { v:.1 }); aMarimba(m2f(84), { t:.06, v:.09 }); },
      gsPick(){ aNoise({ ft:'bandpass', f:2600, q:2, d:.035, v:.05 }); aTone({ f:760, f2:900, type:'triangle', d:.05, v:.04 }); },
      gsTurn(){ aBell({ f:m2f(84), d:.35, v:.04, rev:.3 }); },
      gsDeal(){ for(let k = 0; k < 8; k++) aNoise({ ft:'highpass', f:2400, t:k * .05, d:.03, v:.05 }); },
      gsBig(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .05, v:.13 })); aSparkle({ t:.15, n:4, v:.03 }); },
      gsBad(){ aTone({ f:330, f2:200, type:'triangle', d:.25, v:.1 }); aThump({ f:120, f2:60, d:.2, v:.15 }); },
      gsGo(){ aBrass(m2f(67), { d:.18, v:.08 }); aBrass(m2f(72), { t:.12, d:.3, v:.08 }); aThump({ f:110, f2:55, t:.1, d:.25, v:.25 }); },
      gsStop(){ aThump({ f:160, f2:60, d:.3, v:.3 }); aBell({ f:m2f(76), t:.05, d:.5, v:.05 }); },
      gsWin(){ [0, 4, 7, 12, 16].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .07, v:.14 })); aSparkle({ t:.4, n:6 }); },
      gsLose(){ aTone({ f:392, f2:262, type:'triangle', d:.5, v:.08 }); }
    },
    gate:{ gsSlap:40, gsPick:30, gsFlip:40, gsCap:60 },
    /* 점검·도구용(화면에는 안 씀) */
    _rules:{ C, gsDeal, gsApply, gsGoStop, scoreOf, tally, aiPick, aiGo, cloneS },
    _card:id => cardSvg(id), _back:BACK
  };
})();
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.gostop.scene = { kind:'petals', colors:['#FFC2D3', '#FFE27A', '#FFFFFF'], density:.6 };
