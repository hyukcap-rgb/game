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

  /* ---------- 그림(오리지널 SVG, 40×60) ---------- */
  const O = (w = .9) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const FRAME = (bg = '#FFF8EA') => `<rect x=".8" y=".8" width="38.4" height="58.4" rx="4.2" fill="${bg}" stroke="${INK}" stroke-width="1.5"/>`;
  const NUM = m => `<circle cx="7.2" cy="7.2" r="5.2" fill="#fff" ${O(.9)}/><text x="7.2" y="9.6" font-size="${m > 9 ? 5.6 : 6.6}" font-weight="900" text-anchor="middle" fill="${INK}" font-family="system-ui,sans-serif">${m}</text>`;
  const TAG = (txt, bg, fg = '#fff') => { const w = txt.length > 1 ? 15 : 9.5; return `<rect x="${38.2 - w}" y="49.6" width="${w}" height="8.6" rx="2.6" fill="${bg}" ${O(.8)}/><text x="${38.2 - w / 2}" y="56.3" font-size="6.3" font-weight="900" text-anchor="middle" fill="${fg}" font-family="system-ui,sans-serif">${txt}</text>`; };
  const GW = `<circle cx="32" cy="8" r="6" fill="#D7263D" ${O(.9)}/><text x="32" y="10.6" font-size="7" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">광</text>`;
  const RIB = (col, t1, t2) => `<path d="M14.5 8.5h11v24l-5.5-3.6-5.5 3.6z" fill="${col}" ${O(.9)}/>${t1 ? `<text x="20" y="16.6" font-size="5.6" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${t1}</text><text x="20" y="23" font-size="5.6" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${t2}</text>` : '<path d="M17 13v13M23 13v13" stroke="#fff" stroke-width="1" opacity=".55"/>'}`;
  const pine = (x = 0) => `<g transform="translate(${x} 0)"><path d="M20 59c0-9-3-15-1-27" fill="none" stroke="#6B3E1F" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="12" cy="41" rx="10" ry="5" fill="#2F7D3A" ${O(.8)}/><ellipse cx="28" cy="35" rx="10" ry="5" fill="#3E9A48" ${O(.8)}/><ellipse cx="17" cy="28" rx="9" ry="4.4" fill="#2F7D3A" ${O(.8)}/><path d="M6 41h12M22 35h12M11 28h11" stroke="#BFE6B0" stroke-width=".8" opacity=".7"/></g>`;
  const plum = `<path d="M3 52C12 44 18 34 34 22" fill="none" stroke="#4A2A18" stroke-width="2.6" stroke-linecap="round"/><path d="M18 38c4 1 8 4 10 9" fill="none" stroke="#4A2A18" stroke-width="1.8" stroke-linecap="round"/>${[[9, 47], [17, 39], [26, 30], [33, 23], [27, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#E8476A" ${O(.7)}/><circle cx="${x}" cy="${y}" r="1.1" fill="#FFE27A"/>`).join('')}`;
  const sakura = `${[[10, 20], [22, 15], [31, 26], [14, 32], [26, 38], [9, 45], [31, 47]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-3" rx="2.4" ry="3" transform="rotate(${a})" fill="#FFC2D3" stroke="#D9577C" stroke-width=".6"/>`).join('')}<circle r="1.2" fill="#E8476A"/></g>`).join('')}`;
  const wisteria = `<path d="M4 3h33" stroke="#4A2A18" stroke-width="2.2"/>${[8, 15, 22, 29, 35].map((x, i) => `<path d="M${x} 4v${22 + (i % 2) * 8}" stroke="#3A2A22" stroke-width="1"/>${[...Array(5)].map((_, k) => `<ellipse cx="${x + (k % 2 ? 1.8 : -1.8)}" cy="${8 + k * 4.4}" rx="1.9" ry="2.6" fill="#2B1B12"/>`).join('')}`).join('')}`;
  const iris = `${[[8, 58, 5, 26], [14, 58, 14, 22], [24, 58, 26, 24], [32, 58, 36, 28]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}Q${(x1 + x2) / 2 - 3} ${(y1 + y2) / 2} ${x2} ${y2}" fill="none" stroke="#2E8B57" stroke-width="2.4" stroke-linecap="round"/>`).join('')}${[[11, 24], [27, 21]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 0c-5-1-6-6-3-8 1 3 3 4 3 8zM0 0c5-1 6-6 3-8-1 3-3 4-3 8zM0 0c-2-4 0-9 0-10 0 1 2 6 0 10z" fill="#7B4FC9" ${O(.6)}/></g>`).join('')}`;
  const peony = `<path d="M6 54c4-8 10-12 14-12M34 54c-3-7-8-11-14-12" fill="none" stroke="#2E8B57" stroke-width="2.2"/><ellipse cx="9" cy="48" rx="6" ry="3" transform="rotate(-30 9 48)" fill="#3E9A48" ${O(.6)}/><ellipse cx="31" cy="48" rx="6" ry="3" transform="rotate(30 31 48)" fill="#3E9A48" ${O(.6)}/><circle cx="20" cy="33" r="10" fill="#E8335A" ${O(.9)}/><circle cx="20" cy="33" r="6.5" fill="#FF6E8E"/><circle cx="20" cy="33" r="3" fill="#FFD84A"/><path d="M12 28c2-3 5-4 8-4" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>`;
  const clover = `${[[4, 56, 22, 14], [14, 58, 34, 20], [24, 58, 38, 34]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}Q${x1 + 2} ${y2 + 6} ${x2} ${y2}" fill="none" stroke="#5B3A1E" stroke-width="1.2"/>`).join('')}${[[18, 17], [23, 15], [28, 19], [31, 23], [35, 28], [30, 31], [36, 36], [20, 24], [12, 30], [16, 36], [25, 40], [9, 42]].map(([x, y], i) => i % 3 ? `<circle cx="${x}" cy="${y}" r="1.8" fill="#D7263D"/>` : `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.3" transform="rotate(30 ${x} ${y})" fill="#3E9A48"/>`).join('')}`;
  const hill = (sky) => `${sky ? `<rect x="1.6" y="1.6" width="36.8" height="40" rx="3.4" fill="${sky}"/>` : ''}<path d="M1.6 40Q20 18 38.4 40V57A2.6 2.6 0 0 1 35.8 58.4H4.2A2.6 2.6 0 0 1 1.6 57z" fill="#33251D"/><path d="M5 44q3-4 5 0M14 40q3-4 5 0M24 41q3-4 5 0M31 45q3-4 5 0" fill="none" stroke="#8A7A6A" stroke-width=".9"/>`;
  const mum = `<path d="M20 58V36" stroke="#2E8B57" stroke-width="2"/><ellipse cx="13" cy="48" rx="6" ry="3" transform="rotate(-25 13 48)" fill="#3E9A48" ${O(.6)}/><ellipse cx="27" cy="45" rx="6" ry="3" transform="rotate(25 27 45)" fill="#3E9A48" ${O(.6)}/><g transform="translate(20 28)">${[...Array(14)].map((_, i) => `<ellipse cx="0" cy="-7" rx="1.9" ry="5" transform="rotate(${i * 360 / 14})" fill="#F2B705" stroke="#B07A00" stroke-width=".5"/>`).join('')}<circle r="3.4" fill="#E08A00"/></g>`;
  const leafM = (x, y, s, r, col) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0-8l2 4 4-2-1 4 4 1-4 2 2 4-4-1-3 4-3-4-4 1 2-4-4-2 4-1-1-4 4 2z" fill="${col}" ${O(.5)}/>`;
  const maple = `<path d="M6 4c6 12 10 24 26 34" fill="none" stroke="#5B3A1E" stroke-width="1.4"/>${leafM(10, 13, 1, 10, '#E8401C')}${leafM(20, 23, 1.1, -15, '#D7263D')}${leafM(30, 33, 1, 20, '#F07A1A')}${leafM(14, 40, .9, -5, '#D7263D')}${leafM(28, 13, .8, 0, '#F07A1A')}`;
  const paulow = (tint) => `<path d="M20 58V40" stroke="#4A2A18" stroke-width="2"/>${[[11, 46, -30], [29, 46, 30], [20, 40, 0]].map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 0c-8-2-9-12-1-15 1 4 4 4 1 0 8 3 7 13 0 15z" fill="${tint ? '#C9B23A' : '#2F5D3A'}" ${O(.7)}/>`).join('')}<path d="M20 34v-14" stroke="#4A2A18" stroke-width="1.2"/>${[0, 1, 2, 3].map(k => `<circle cx="${18 + (k % 2) * 4}" cy="${20 + k * 3.4}" r="1.9" fill="#9B6BD6"/>`).join('')}`;
  const rain = `${[[6, 4], [14, 2], [24, 6], [32, 3], [10, 20], [30, 18]].map(([x, y]) => `<path d="M${x} ${y}l-3 9" stroke="#6E8FB8" stroke-width="1" stroke-linecap="round"/>`).join('')}`;
  const willow = `<path d="M38 2C28 8 22 20 20 58" fill="none" stroke="#4A2A18" stroke-width="1.6"/>${[[30, 6], [26, 14], [23, 24], [21, 34]].map(([x, y]) => `<path d="M${x} ${y}c-4 6-5 14-6 20" fill="none" stroke="#3E9A48" stroke-width="1.2"/>`).join('')}`;
  const bird = (x, y, s, body, head) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-9 1l-5 3 5 0z" fill="${INK}"/><ellipse cx="0" cy="0" rx="9" ry="5.2" fill="${body}" ${O(.8)}/><circle cx="7" cy="-3.6" r="3.6" fill="${head || body}" ${O(.8)}/><path d="M10.4 -3.6l3 .8-3 1z" fill="#F2A900"/><circle cx="8" cy="-4.2" r=".9" fill="${INK}"/><path d="M-4-1c2-3 6-3 8 0" fill="none" stroke="${INK}" stroke-width=".8"/></g>`;
  const crane = `<g transform="translate(22 36)"><path d="M-10 4l-6 4 6-1z" fill="${INK}"/><ellipse cx="0" cy="2" rx="10" ry="6" fill="#fff" ${O(.9)}/><path d="M8 0c3-6 3-12 0-16" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M8 0c3-6 3-12 0-16" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="-16" r="2.6" fill="#fff" ${O(.8)}/><circle cx="8" cy="-17.4" r="1.2" fill="#D7263D"/><path d="M10 -16l5 1" stroke="${INK}" stroke-width="1"/><path d="M-6 2c3-2 7-2 9 1" fill="none" stroke="#999" stroke-width=".8"/></g>`;
  const ART = {
    1:k => k === 0 ? `<circle cx="27" cy="16" r="8" fill="#E23B3B" ${O(.8)}/>${pine()}${crane}` : k === 1 ? `${pine()}${RIB('#D7263D', '홍', '단')}` : pine(k === 3 ? 2 : 0),
    2:k => k === 0 ? `${plum}${bird(20, 22, .9, '#B5C83A', '#9DB52A')}` : k === 1 ? `${plum}${RIB('#D7263D', '홍', '단')}` : plum,
    3:k => k === 0 ? `${sakura}<rect x="5" y="34" width="30" height="18" fill="#fff" ${O(.8)}/>${[0, 1, 2, 3, 4].map(i => `<rect x="${5 + i * 6}" y="34" width="3" height="18" fill="#D7263D"/>`).join('')}<path d="M3 34h34" stroke="${INK}" stroke-width="2"/>` : k === 1 ? `${sakura}${RIB('#D7263D', '홍', '단')}` : sakura,
    4:k => k === 0 ? `${wisteria}${bird(20, 40, .95, '#5A4A6A', '#3A2A4A')}` : k === 1 ? `${wisteria}${RIB('#D7263D')}` : wisteria,
    5:k => k === 0 ? `${iris}<path d="M3 44l10-4 14 4 10-4" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M3 44l10-4 14 4 10-4" fill="none" stroke="#C98A3A" stroke-width="3" stroke-linejoin="round"/>` : k === 1 ? `${iris}${RIB('#D7263D')}` : iris,
    6:k => k === 0 ? `${peony}${[[11, 14, '#FFD84A'], [27, 12, '#7CC8FF']].map(([x, y, cl]) => `<g transform="translate(${x} ${y})"><ellipse cx="-3" cy="-2" rx="3.2" ry="4.4" fill="${cl}" ${O(.6)}/><ellipse cx="3" cy="-2" rx="3.2" ry="4.4" fill="${cl}" ${O(.6)}/><ellipse cx="-2.4" cy="3" rx="2" ry="2.6" fill="${cl}" ${O(.6)}/><ellipse cx="2.4" cy="3" rx="2" ry="2.6" fill="${cl}" ${O(.6)}/><path d="M0-5v10" stroke="${INK}" stroke-width="1.2"/></g>`).join('')}` : k === 1 ? `${peony}${RIB('#2D6CDF', '청', '단')}` : peony,
    7:k => k === 0 ? `${clover}<g transform="translate(20 44)"><ellipse cx="0" cy="0" rx="11" ry="7" fill="#8A5A2B" ${O(.9)}/><path d="M9-3l6 2-5 3z" fill="#6B4220" ${O(.6)}/><circle cx="8" cy="-2" r=".9" fill="${INK}"/><path d="M-7 6v5M-2 7v4M4 7v4M8 5v5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M-8-5c4-3 9-3 12 0" fill="none" stroke="#5A3A1A" stroke-width="1"/></g>` : k === 1 ? `${clover}${RIB('#D7263D')}` : clover,
    8:k => k === 0 ? `${hill('#E8553A')}<circle cx="20" cy="20" r="11" fill="#FFF3C4" ${O(.9)}/>` : k === 1 ? `${hill('#F6E4C8')}${[[12, 12], [21, 9], [29, 15]].map(([x, y]) => `<path d="M${x - 5} ${y}l5 3 5-3" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}` : hill(k === 2 ? '#F6E4C8' : '#E9DCC6'),
    9:k => k === 0 ? `${mum}<g transform="translate(26 12)"><path d="M-8-4h16l-3 10h-10z" fill="#D7263D" ${O(.8)}/><path d="M-8-4h16" stroke="#F2B705" stroke-width="1.6"/><circle cx="0" cy="1" r="2" fill="#F2B705"/></g>` : k === 1 ? `${mum}${RIB('#2D6CDF', '청', '단')}` : mum,
    10:k => k === 0 ? `${maple}<g transform="translate(20 46)"><ellipse cx="0" cy="0" rx="9" ry="5" fill="#B8742E" ${O(.8)}/><circle cx="8" cy="-6" r="3" fill="#B8742E" ${O(.7)}/><path d="M7-9l-2-5M9-9l2-5" stroke="#6B4220" stroke-width="1"/><path d="M-6 4v6M-2 5v5M3 5v5M6 4v6" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/><circle cx="-2" cy="-1" r=".9" fill="#fff"/><circle cx="2" cy="1" r=".9" fill="#fff"/></g>` : k === 1 ? `${maple}${RIB('#2D6CDF', '청', '단')}` : maple,
    11:k => k === 0 ? `${paulow()}<g transform="translate(18 18)"><path d="M6 2c8 4 14 10 16 18-6-4-12-6-18-8z" fill="#2D9C6A" ${O(.7)}/><path d="M4 4c4 8 6 14 6 22-4-6-6-12-8-20z" fill="#2D6CDF" ${O(.7)}/><ellipse cx="0" cy="0" rx="8" ry="5" fill="#D7263D" ${O(.8)}/><circle cx="-6" cy="-4" r="3.2" fill="#F2B705" ${O(.7)}/><circle cx="-6.6" cy="-4.6" r=".8" fill="${INK}"/></g>` : paulow(k === 1),
    12:k => k === 0 ? `${rain}${willow}<path d="M6 28a12 9 0 0 1 24 0z" fill="#D7263D" ${O(.9)}/><path d="M18 28v14" stroke="${INK}" stroke-width="1.4"/><circle cx="14" cy="36" r="3" fill="#F6D3B0" ${O(.7)}/><path d="M10 54l3-14h4l2 14z" fill="#2D3A6A" ${O(.7)}/>` :
      k === 1 ? `${rain}${willow}<g transform="translate(18 30)"><path d="M-12 6l6-6-2 8zM-12 0l6 2" fill="${INK}"/><ellipse cx="0" cy="2" rx="8" ry="4" fill="#24334E" ${O(.8)}/><path d="M-4 0c4-8 10-10 16-8-4 2-8 6-10 10z" fill="#24334E" ${O(.7)}/><circle cx="6" cy="1" r="2.6" fill="#D7263D"/></g>` :
      k === 2 ? `${rain}${willow}<path d="M12 8.5h11v24l-5.5-3.6-5.5 3.6z" fill="#D7263D" ${O(.9)}/><path d="M14 14l3 3 3-3 3 3M14 21l3 3 3-3 3 3" fill="none" stroke="#fff" stroke-width=".9"/>` :
      `<rect x="1.6" y="1.6" width="36.8" height="56.8" rx="3.4" fill="#4B4B5E"/>${rain}<circle cx="20" cy="30" r="10" fill="#D7263D" ${O(1)}/><circle cx="20" cy="30" r="6.4" fill="#F2B705" ${O(.8)}/>${[0, 120, 240].map(a => `<path transform="rotate(${a} 20 30)" d="M20 30c0-4 3-5 5-3" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`).join('')}`
  };
  function tagOf(c){
    if(c.g) return TAG('광', '#F2B705', INK);
    if(c.y) return TAG(c.kj ? '열·쌍' : '열', '#F08A24');
    if(c.tt === 'hong') return TAG('홍단', '#D7263D');
    if(c.tt === 'cheong') return TAG('청단', '#2D6CDF');
    if(c.tt === 'cho') return TAG('초단', '#2E9B57');
    if(c.tt) return TAG('띠', '#D7263D');
    if(c.pv === 2) return TAG('쌍피', '#7B4FC9');
    return TAG('피', '#A0968C');
  }
  const SVGC = {}, INNER = {};
  function cardSvg(id){
    if(SVGC[id]) return SVGC[id];
    let s;
    if(isDummy(id)) s = `${FRAME('#E9E4EE')}<circle cx="20" cy="31" r="9" fill="#3A2F4A" ${O(1)}/><path d="M25 23l4-5" stroke="${INK}" stroke-width="1.6"/><circle cx="30" cy="17" r="2" fill="#FF8A1F"/><text x="20" y="53" font-size="6.6" font-weight="900" text-anchor="middle" fill="#5A4E6A" font-family="system-ui,sans-serif">넘기기</text>`;
    else {
      const c = C[id];
      if(c.bonus) s = `<rect x=".8" y=".8" width="38.4" height="58.4" rx="4.2" fill="#FFE27A" stroke="${INK}" stroke-width="1.5"/><path d="M20 12l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1L20 30.6l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z" fill="#FFB020" ${O(1)}/><text x="20" y="45" font-size="7" font-weight="900" text-anchor="middle" fill="${INK}" font-family="system-ui,sans-serif">보너스</text>${TAG('+' + c.pv, '#7B4FC9')}`;
      else s = FRAME(c.m === 11 && c.k === 1 ? '#FFF1B8' : '#FFF8EA') + ART[c.m](c.k) + (c.g ? GW : '') + NUM(c.m) + tagOf(c);
    }
    INNER[id] = s;
    return SVGC[id] = `<svg viewBox="0 0 40 60" aria-hidden="true">${s}</svg>`;
  }
  const cardInner = id => (cardSvg(id), INNER[id]);
  const BACK = `<svg viewBox="0 0 40 60" aria-hidden="true"><rect x=".8" y=".8" width="38.4" height="58.4" rx="4.2" fill="#B3122E" stroke="${INK}" stroke-width="1.5"/><rect x="4" y="4" width="32" height="52" rx="3" fill="none" stroke="#E8566E" stroke-width="1"/><circle cx="20" cy="30" r="9" fill="#8E0E24" stroke="#E8566E" stroke-width="1"/><path d="M20 23l2 5 5 .6-4 3.4 1.2 5L20 34.4 15.8 37l1.2-5-4-3.4 5-.6z" fill="#F2B705"/></svg>`;
  const BADGE19 = '<span class="gs19" aria-label="19세 이상 이용">19</span>';

  /* ---------- 화면 ---------- */
  const GS = () => G && G.gs;
  const myTurn = () => { const g = GS(); return g && g.S && !g.S.over && g.S.turn === g.me && g.S.pendingGS < 0; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function setMsg(html, cls){ const m = $('#gsMsg'); if(m){ m.className = 'gs-msg' + (cls ? ' ' + cls : ''); m.innerHTML = html; } }
  function capGroups(cap){
    const g = { g:[], y:[], t:[], p:[] };
    cap.forEach(id => g[kindOf(id)].push(id));
    g.p.sort((a, b) => (C[a].pv || 0) - (C[b].pv || 0));
    return g;
  }
  function capHtml(cap, cw){
    const g = capGroups(cap), s = scoreOf(cap);
    const cnt = { g:s.gN, y:s.yN, t:s.tN, p:s.piV };
    const lab = { g:'광', y:'열', t:'띠', p:'피' };
    const u = Math.max(240, (cw || 330) - 18), W = { g:u * .18, y:u * .23, t:u * .23, p:u * .36 };   /* 줄 폭에 맞춰 나눔(넘치지 않게) */
    return ['g', 'y', 't', 'p'].map(k => { const n = g[k].length, st = n > 1 ? Math.min(14, (W[k] - 22) / (n - 1)) : 14;
      return `<div class="gs-cg k-${k}${n ? '' : ' none'}" style="--w:${W[k].toFixed(1)}px;--st:${st.toFixed(1)}px"><span class="gs-cl">${lab[k]}<b>${cnt[k]}</b></span><div class="gs-cs">${g[k].map(id => `<div class="gs-c mini" data-cid="${id}">${cardSvg(id)}</div>`).join('')}</div></div>`; }).join('');
  }
  function infoHtml(p, view){
    const g = GS(), S = g.S, P = S.P[p], sc = scoreOf(view.c[p]).total, me = p === g.me;
    const name = me ? '나' : esc(g.oppNick);
    const av = me ? avatar({ me:true }) : oppAv(g.oppNick);
    const chips = [P.go ? `<span class="gs-chip go">${P.go}고</span>` : '', P.shake ? `<span class="gs-chip sh">흔들 ${P.shake}</span>` : '', P.ppuk ? `<span class="gs-chip pp">뻑 ${P.ppuk}</span>` : ''].join('');
    const turnOn = !S.over && S.turn === p;
    return `<div class="gs-who${turnOn ? ' on' : ''}">${av}<span class="gs-nm"><b>${name}</b>${(S.first === p) ? '<i>선</i>' : ''}</span></div><div class="gs-sc"><b class="num">${sc}</b><small>점</small></div><div class="gs-chips">${chips}</div>${me ? '<div class="gs-timer" id="gsTimer"><i></i></div>' : `<div class="gs-oh" id="gsOH">${view.h[p].map((_, i) => `<div class="gs-c back tiny" data-cid="o${i}">${BACK}</div>`).join('')}<b>${view.h[p].length}</b></div>`}`;
  }
  function floorHtml(view){
    const by = {}; view.f.forEach(id => { const m = C[id].m; (by[m] = by[m] || []).push(id); });
    const sel = GS().sel, selM = sel != null && C[sel] && !C[sel].bonus ? C[sel].m : 0;
    const can = new Set(GS().S.P[GS().me].hand.map(id => C[id] && C[id].m).filter(Boolean));
    let h = '';
    for(let m = 1; m <= 12; m++){
      const L = by[m] || [];
      h += `<div class="gs-slot${L.length ? '' : ' empty'}${selM === m ? ' hit' : ''}${L.length && can.has(m) && myTurn() ? ' can' : ''}${view.ppuk && view.ppuk[m] != null ? ' ppuk' : ''}" data-m="${m}"><span class="gs-sm">${m}</span>${L.map((id, i) => `<div class="gs-c fl${view.hi.includes(id) ? ' glow' : ''}" data-cid="${id}" style="--i:${i}">${cardSvg(id)}</div>`).join('')}</div>`;
    }
    return h;
  }
  function handHtml(view){
    const g = GS(), hand = view.h[g.me].slice().sort((a, b) => ((C[a] && C[a].m) || 99) - ((C[b] && C[b].m) || 99) || a - b);
    const fm = new Set(view.f.map(id => C[id].m)), mt = myTurn() && !g.busy;
    return hand.map(id => { const c = C[id], hit = c && !c.bonus && fm.has(c.m), bon = (c && c.bonus) || isDummy(id);
      return `<button class="gs-c hd${g.sel === id ? ' sel' : ''}${mt && (hit || bon) ? ' match' : ''}${mt ? '' : ' off'}" data-cid="${id}" data-h="${id}" aria-label="${cardName(id)}${hit ? ', 바닥에 같은 월 있음' : ''}">${cardSvg(id)}</button>`; }).join('');
  }
  function liveView(){ const S = GS().S; return Object.assign(snap(S), { ppuk:S.ppuk }); }
  function draw(view){
    const g = GS(); if(!g || !$('#gsg')) return;
    const op = 1 - g.me;
    $('#gsOpp').innerHTML = infoHtml(op, view);
    const cw = $('#gsCapMe').clientWidth;
    $('#gsCapOp').innerHTML = capHtml(view.c[op], cw);
    $('#gsFloor').innerHTML = floorHtml(view);
    $('#gsDeck').innerHTML = view.d ? `<div class="gs-c back" data-cid="deck">${BACK}</div><b class="num">${view.d}</b>` : '<span class="gs-dk0">더미 끝</span>';
    $('#gsCapMe').innerHTML = capHtml(view.c[g.me], cw);
    $('#gsMe').innerHTML = infoHtml(g.me, view);
    $('#gsHand').innerHTML = handHtml(view);
    $('#gsHand').querySelectorAll('[data-h]').forEach(b => b.onclick = () => onHand(+b.dataset.h));
    $('#gsFloor').querySelectorAll('.gs-slot').forEach(s => s.onclick = () => { if(g.sel != null && s.classList.contains('hit')) onHand(g.sel); });
  }
  /* 장면 바꾸기: 카드가 예전 자리에서 새 자리로 날아가게(FLIP) */
  function flipTo(view, prev, dur){
    const root = $('#gsg'); if(!root) return;
    const old = {};
    root.querySelectorAll('[data-cid]').forEach(el => { old[el.dataset.cid] = el.getBoundingClientRect(); });
    const oh = $('#gsOH'), ohR = oh ? oh.getBoundingClientRect() : null, dk = root.querySelector('[data-cid="deck"]'), dkR = dk ? dk.getBoundingClientRect() : null;
    draw(view);
    if(FXR.reduce) return;
    const g = GS(), op = 1 - g.me;
    root.querySelectorAll('[data-cid]').forEach(el => {
      const cid = el.dataset.cid; if(cid[0] === 'o' || cid === 'deck') return;
      let o = old[cid];
      if(!o){ const id = +cid; o = prev && prev.h[op].includes(id) ? ohR : dkR; }
      if(!o || !o.width) return;
      const n = el.getBoundingClientRect(); if(!n.width) return;
      const dx = o.left - n.left, dy = o.top - n.top, s = o.width / n.width;
      if(Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < .02) return;
      try{ el.animate([{ transform:`translate(${dx}px,${dy}px) scale(${s})`, zIndex:30 }, { transform:'none', zIndex:30 }], { duration:dur || 340, easing:'cubic-bezier(.25,.9,.3,1)' }); }catch(_){}
    });
  }
  function banner(txt, kind){
    const b = $('#gsBan'); if(!b) return;
    b.innerHTML = `<b class="${kind || ''}">${txt}</b>`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    try{ const r = b.getBoundingClientRect(); fxEmit(r.left + r.width / 2, r.top + r.height / 2, { quantity:18, speed:[160, 320], lifespan:700, scale:{ start:1.2, end:0 }, color:kind === 'bad' ? ['#FF8A8F', '#FFFFFF'] : ['#FFE27A', '#FFFFFF'], kind:'spark', glow:true }); }catch(_){}
  }
  async function playScenes(prev, scenes){
    let pv = prev;
    for(const sc of scenes){
      if(!GS() || G.over) return;
      flipTo(sc, pv, 340);
      sfx(sc.flip != null ? 'gsFlip' : 'gsSlap');
      let w = 420;
      if(sc.lab && sc.lab.length){
        const big = sc.lab.find(l => /[!]$/.test(l));
        if(big){ banner(sc.lab.filter(l => /!$/.test(l)).join(' '), /뻑!$/.test(big) && !/먹기|자뻑/.test(big) ? 'bad' : ''); sfx(/뻑!$/.test(big) && !/먹기|자뻑/.test(big) ? 'gsBad' : 'gsBig'); fxBuzz([20, 30, 20]); w = 760; }
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
    $('#gsBody').hidden = false;
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
      setMsg(`<b>내 차례</b> · ${S.P[g.me].hand.some(id => C[id] && C[id].bonus) ? '보너스패를 먼저 내도 돼요' : '낼 패를 누르고, 한 번 더 누르면 내요'}`, 'me');
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
    if(g.sel === id){ myPlay(id); return; }
    g.sel = id; sfx('gsPick', { off:false });
    draw(liveView());
    const c = C[id];
    if(isDummy(id)) setMsg('빈 패예요 · 한 번 더 누르면 더미만 뒤집어요', 'me');
    else if(c.bonus) setMsg('보너스패 · 한 번 더 누르면 먹고 한 장 더 받아요', 'me');
    else { const n = floorOf(g.S, c.m).length; setMsg(n ? `바닥에 ${c.m}월 ${n}장 · 한 번 더 누르면 내요` : `바닥에 ${c.m}월이 없어요 · 그냥 내려놓아요`, 'me'); }
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
    const mult = r.mults && r.mults.length ? r.mults.map(m => `<div><span>${m[0]}</span><b>×${m[1]}</b></div>`).join('') : '';
    const box = $('#gsAsk');
    const html = `<div class="gs-askc gs-end ${draw0 ? 'd' : win ? 'w' : 'l'}"><b class="gs-et">${draw0 ? '나가리' : win ? '이겼어요!' : '졌어요'}</b>
      <p class="gs-ew">${draw0 ? '아무도 7점을 못 내고 패가 다 떨어졌어요(무승부)' : (win ? '내가 ' : esc(g.oppNick) + '님이 ') + (r.why === '스톱' ? '스톱했어요' : r.why === '마지막 패' ? '마지막 패로 났어요' : r.why === '기권' ? '이겼어요(상대 기권)' : r.why + '로 이겼어요')}</p>
      ${draw0 ? '' : `<div class="gs-erows">${(r.rows || []).map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}${mult}<div class="tot"><span>최종</span><b>${fmt(r.final)}점</b></div></div>`}
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
      <h3 id="gsSt">상대를 찾는 중</h3><p id="gsSn"></p>
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
    room.presence({ du:'wait', dg:ID, dt:g.dt, nk:g.nick, dp:null }).catch(() => {});
    const check = () => {
      if(GS() !== g || G.over || (g.phase !== 'search' && g.phase !== 'nobody')) return;
      let ps; try{ ps = room.peers(); }catch(_){ return; }
      const me = ps.find(p => p.sameTab); if(!me) return;
      g.myPeer = me.peer;
      const claim = ps.find(p => !p.sameTab && p.presence && p.presence.du === 'play' && p.presence.dg === ID && p.presence.dp === me.peer);
      if(claim){ match(claim); return; }
      const list = ps.filter(p => p.presence && p.presence.du === 'wait' && p.presence.dg === ID && typeof p.presence.dt === 'number')
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
  function lobbyClear(){ if(ROOM) ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null }).catch(() => {}); }
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
    nr.presence({ v:1, nk:g.nick, mv:[] }).catch(() => {});
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
        lobbyClear(); g.mode = 'pvp';
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
    clearInterval(g.tIv); clearTimeout(g.turnT); clearTimeout(g.endT); clearInterval(g.mmIv); clearInterval(g.syncIv);
    if(g.mmUn) try{ g.mmUn(); }catch(_){}
    if(g.nrUn) try{ g.nrUn(); }catch(_){}
    const nr = g.nr; g.nr = null;
    if(nr) setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1200);
    lobbyClear();
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
    st.innerHTML = `<div class="gsg" id="gsg">
      <div class="gs-ban" id="gsBan" aria-live="polite"></div>
      <div id="gsBody" hidden>
        <div class="gs-info op" id="gsOpp"></div>
        <div class="gs-cap op" id="gsCapOp"></div>
        <div class="gs-table"><div class="gs-floor" id="gsFloor"></div><div class="gs-deck" id="gsDeck"></div></div>
        <div class="gs-msg" id="gsMsg"></div>
        <div class="gs-cap me" id="gsCapMe"></div>
        <div class="gs-info me" id="gsMe"></div>
        <div class="gs-hand" id="gsHand"></div>
      </div>
      <div class="gs-search" id="gsSearch" hidden></div>
      <div class="gs-ask" id="gsAsk" hidden></div>
      ${ageOk() ? '' : gateHtml()}
    </div>`;
    const go = () => {
      const g = GS(); if(!g || G.over) return;
      const gate = $('#gsGate'); if(gate) gate.remove();
      if(g.mode === 'pvp') search();
      else startPlay('gs:' + (G.adv ? 'solo:' + G.adv : 'ai') + ':' + g.seedBase);
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
    modes:['solo', 'duel'],   /* 오늘의 시험지·연습 없음(붙여 쓰는 모듈 첫 화면도 솔로·대전만) */
    age:19,
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="10" height="15" rx="2" transform="rotate(-12 8 11.5)"/><rect x="10" y="4.5" width="10" height="15" rx="2" transform="rotate(10 15 12)" fill-opacity=".75"/></svg>',
    art(){
      const u = 'gsA' + (++SVG_UID);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${u}" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#2E9A62"/><stop offset="1" stop-color="#0F4A2E"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/><circle cx="80" cy="56" r="44" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
        <g transform="translate(40 34) rotate(-15)">${cardInner(0)}</g><g transform="translate(60 26) rotate(-1)">${cardInner(28)}</g><g transform="translate(82 30) rotate(13)">${cardInner(44)}</g>
        <g transform="translate(112 19)"><circle r="14" fill="#fff" stroke="#D7263D" stroke-width="4"/><text y="5.5" font-size="15" font-weight="900" text-anchor="middle" fill="#1A0F45" font-family="system-ui,sans-serif">19</text></g></svg>`;
    },
    help:[
      ['같은 월끼리 먹어요', '내 패 한 장을 내고 더미에서 한 장을 뒤집어요. 바닥에 같은 월(왼쪽 위 숫자)이 있으면 둘 다 가져와요. 패를 누르면 들리고, 한 번 더 누르면 내요.'],
      ['7점 나면 고? 스톱?', '광 3장 3점(비광 끼면 2점)·4장 4점·5장 15점 · 열끗 5장 1점(고도리 5점) · 띠 5장 1점(홍단·청단·초단 3점) · 피 10장 1점. 7점이 나면 스톱해서 이기거나, 고를 불러 점수를 더 키워요(1고 +1, 2고 +2, 3고부터 2배씩). 고를 했는데 상대가 먼저 나면 고박!'],
      ['뻑·쪽·따닥·쓸', '뻑: 낸 패와 뒤집은 패가 바닥 패와 같은 월이면 세 장이 바닥에 묶여요(나중에 먹으면 피 1장, 내 뻑이면 2장). 쪽·따닥·쓸을 하면 상대 피 1장을 가져와요. 흔들기·폭탄은 점수 2배, 3뻑·총통은 바로 승리.'],
      ['박과 배수', '피박(상대 피 1~5장)·광박(상대 광 0장)·고박·멍따(열끗 7장+)는 점수 ×2. 둘 다 못 내고 패가 떨어지면 나가리(무승부). 19세 이상 · 돈이나 상품은 걸 수 없어요.']
    ],
    chapters:['동네 사랑방', '시장 골목', '장터 한마당', '명절 큰집', '고수의 방'],
    starRule:'★ 승리 · ★★ 10점 이상으로 승리 · ★★★ 20점 이상으로 승리',
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
    duelHow:'1:1 맞고 · 7점 나면 고/스톱 · 19세 이상',
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
    _rules:{ C, gsDeal, gsApply, gsGoStop, scoreOf, tally, aiPick, aiGo, cloneS }
  };
})();
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.gostop.scene = { kind:'petals', colors:['#FFC2D3', '#FFE27A', '#FFFFFF'], density:.6 };
