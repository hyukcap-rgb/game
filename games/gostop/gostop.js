/* 고스톱 */
/* ===== 고스톱 (gostop) · 하루퍼즐 리그 게임 모듈 · 19세 이상 =====
   2인 맞고 규칙(온라인 맞고에서 널리 쓰는 기본 규칙): 7점 나면 고/스톱, 피박·광박·고박·멍따, 흔들기·폭탄,
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
  /* 효과·소리 연출(gostop-fx.js). 없으면 아무것도 안 하는 대역 */
  const GX = typeof GSFX !== 'undefined' ? GSFX : { land(){}, flip(){}, grab(){}, event(){}, clear(){}, sounds:{}, gate:{} };
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
      const S = { P:[0, 1].map(i => ({ hand:ids.slice(i * 10, i * 10 + 10), cap:[], go:0, goScore:0, shake:0, ppuk:0, nt:0, fp:0 })), floor:[], deck:ids.slice(28),
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
    const first = !me.nt; me.nt = (me.nt || 0) + 1;   /* 이 사람의 첫 차례(보너스패는 세지 않음) → 첫뻑 */
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
        else if(pm === 1){ S.ppuk[FM] = p; me.ppuk++; labs.push('뻑!'); if(first){ me.fp = 1; labs.push('첫뻑!'); } }
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

  /* ---------- 화면: 온라인 맞고식 가로 판(기준 1630×923, 화면에 맞춰 확대·축소, 세로 화면이면 90° 돌림) ---------- */
  const BW = 1630, BH = 923, MAINW = 1262;
  const CW = { hand:[142, 232], floor:[90, 147], cap:[64, 104], deck:[92, 150] };   /* v1.5: 먹은 패 44→64(전략용으로 잘 보이게), 바닥 84→90 */
  const GS = () => G && G.gs;
  const myTurn = () => { const g = GS(); return g && g.S && g.phase === 'play' && !g.S.over && g.S.turn === g.me && g.S.pendingGS < 0; };
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
    const [w, h] = CW.cap, X0 = 26, X1 = 1094, GAP = 30;
    const ks = ['g', 'y', 't', 'p'].filter(k => g[k].length);
    /* 겹침 간격: 기본(광은 넓게) → 줄이 넘치면 간격만 줄임(카드 크기는 그대로) */
    const base = { g:34, y:26, t:26, p:19 };
    const need = f => ks.reduce((t, k) => t + w + (g[k].length - 1) * base[k] * f, 0) + GAP * Math.max(0, ks.length - 1);
    let f = 1; const room = X1 - X0;
    if(need(1) > room){ const fixed = need(0); f = Math.max(.25, (room - fixed) / (need(1) - fixed)); }
    let x = X0, out = '';
    for(const k of ks){
      const L = g[k], st = base[k] * f;
      L.forEach((id, i) => { out += `<div class="gs-c mini" data-cid="${id}" style="${px(x + i * st, y, w, h)};z-index:${i + 1}">${cardSvg(id)}</div>`; });
      const gw = w + (L.length - 1) * st;
      out += `<span class="gs-cnt k${k}" style="left:${Math.round(x + gw - 18)}px;top:${y + h - 38}px">${cnt[k]}</span>`;
      x += gw + GAP;
    }
    return out;
  }
  /* ---------- 탈 캐릭터(v1.5): 프로필 얼굴. 직접 그린 평면 SVG — 나 = 선비탈(황토 얼굴·검은 갓), 상대 = 각시탈(흰 얼굴·연지 곤지·쪽머리, 색은 이름마다)
     표정: '' 평소 · 'wow' 놀람(시계 5초 아래) · 'sad' 울상(2.5초 아래·짐) · 'joy' 웃음(큰 일·이김). 전통 탈을 바탕으로 새로 그린 오리지널 */
  const INKM = '#241A3A';
  const OPPC = [['#2E5E8C', '#C93A3A'], ['#5B3F8C', '#D9822B'], ['#2F7A5B', '#C93A6B'], ['#8C3A2E', '#3A6BC9']];
  function maskSvg(kind, mood, tone){
    const me = kind === 'me', face = me ? '#EDBF7A' : '#FBF1E2', cheek = me ? '#D9734A' : '#E0454F';
    const eyes = mood === 'wow' ? `<ellipse cx="37" cy="54" rx="5.2" ry="6.4" fill="${INKM}"/><ellipse cx="63" cy="54" rx="5.2" ry="6.4" fill="${INKM}"/><circle cx="38.6" cy="52" r="1.7" fill="#fff"/><circle cx="64.6" cy="52" r="1.7" fill="#fff"/>`
      : mood === 'sad' ? `<path d="M30 56q7 -5 14 0M56 56q7 -5 14 0" stroke="${INKM}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M67 61q2.5 5 0 8q-2.5 -3 0 -8z" fill="#7FC6F0" stroke="${INKM}" stroke-width="1.4"/>`
      : mood === 'joy' ? `<path d="M29 56q8 -10 16 0M55 56q8 -10 16 0" stroke="${INKM}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<path d="M30 53q7 6 14 0M56 53q7 6 14 0" stroke="${INKM}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    const brows = mood === 'sad' ? `<path d="M29 44l14 -5M71 44l-14 -5" stroke="${INKM}" stroke-width="3.4" stroke-linecap="round"/>`
      : mood === 'wow' ? `<path d="M29 40q8 -7 15 -2M71 40q-8 -7 -15 -2" stroke="${INKM}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
      : `<path d="M29 43q8 -5 15 -1M71 43q-8 -5 -15 -1" stroke="${INKM}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    const mouth = mood === 'wow' ? `<ellipse cx="50" cy="75" rx="5.5" ry="6.5" fill="#8C1D2A" stroke="${INKM}" stroke-width="2.4"/>`
      : mood === 'sad' ? `<path d="M40 79q10 -8 20 0" stroke="${INKM}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
      : mood === 'joy' ? `<path d="M37 70q13 0 26 0q-2 12 -13 12q-11 0 -13 -12z" fill="#8C1D2A" stroke="${INKM}" stroke-width="2.6" stroke-linejoin="round"/><path d="M42 77q8 4 16 0" fill="#E87A86"/>`
      : `<path d="M39 71q11 9 22 0" stroke="${INKM}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    let head, bg;
    if(me){
      bg = '#F3E3C3';
      /* 검은 갓: 넓은 챙 + 모자 */
      head = `<path d="M30 26q20 -4 40 0l-2 -12q-18 -6 -36 0z" fill="${INKM}"/><ellipse cx="50" cy="27" rx="38" ry="5.5" fill="${INKM}"/><path d="M31 21q19 -3 38 0" stroke="#5A4A7A" stroke-width="1.6" fill="none"/>`;
    } else {
      const [hb, rib] = OPPC[tone % OPPC.length]; bg = '#E8EEF6';
      /* 쪽머리(가르마) + 댕기 */
      head = `<path d="M18 52q-2 -34 32 -36q34 2 32 36q-6 -20 -32 -24q-26 4 -32 24z" fill="${INKM}"/><path d="M50 17v12" stroke="#3E3260" stroke-width="2"/><circle cx="50" cy="12" r="6" fill="${INKM}"/><path d="M53 9l9 -4l-2 8z" fill="${rib}"/><path d="M20 40q-4 6 -2 12" stroke="${hb}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="${bg}"/>
      <path d="M50 22c19 0 29 14 29 33c0 21-13 34-29 34s-29-13-29-34c0-19 10-33 29-33z" fill="${face}" stroke="${INKM}" stroke-width="3"/>
      ${head}${brows}${eyes}<circle cx="31" cy="66" r="5.5" fill="${cheek}" opacity="${me ? .45 : .85}"/><circle cx="69" cy="66" r="5.5" fill="${cheek}" opacity="${me ? .45 : .85}"/>${me ? '' : `<circle cx="50" cy="37" r="2.6" fill="${cheek}"/>`}${mouth}</svg>`;
  }
  const maskTone = nick => seedFrom(String(nick || '')) % OPPC.length;
  const maskAv = (me, mood) => { const g = GS(); return `<span class="av gs-mask" data-k="${me ? 'me' : 'op'}" data-md="${mood || ''}">${maskSvg(me ? 'me' : 'op', mood || '', maskTone(g && g.oppNick))}</span>`; };
  function profHtml(p, view){
    const g = GS(), S = g.S, P = S.P[p], me = p === g.me;
    const name = me ? '나' : esc(g.oppNick), av = maskAv(me);
    const bye = me ? g.bye : g.oppBye, off = !me && g.mode === 'pvp' && g.began && !g.oppHere;
    const st = [off ? '<b class="off">연결 끊김·자동</b>' : '', bye ? '<b class="bye">나가기 예약</b>' : '', P.go ? `<b class="go">${P.go}고</b>` : '', P.shake ? `<b class="sh">흔들 ${P.shake}</b>` : '', P.ppuk ? `<b class="pp">뻑 ${P.ppuk}</b>` : ''].join('');
    return `<div class="gs-pn">${S.first === p ? '<i class="gs-sun">先</i>' : ''}<b>${name}</b></div>
      <div class="gs-pl gs-ptv">${me ? fmtP(wallet().pt) : g.mode === 'pvp' ? (g.oppPt != null ? fmtP(g.oppPt) : '') : '판돈 무제한'}</div>
      <div class="gs-pl gs-sub" ${me ? '' : 'id="gsOH"'}>${me ? (G.adv ? '솔로 ' + G.adv + '판' : g.mode === 'pvp' ? '실시간 대전' : '컴퓨터 대전') : '남은 패 ' + view.h[p].length + '장'}</div>
      <div class="gs-ps">${st}</div><span class="gs-pav">${av}<svg class="gs-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" pathLength="100"/></svg><b class="gs-sec"></b><i class="gs-sweat"></i></span>`;
  }
  /* 바닥: 가운데 더미를 둘러싼 12자리(월마다 자리 고정), 같은 월은 살짝 겹쳐 쌓기 */
  /* v1.5: 바닥 12자리 = 두 줄 × 6칸(가운데 더미 자리 비움). 예전 타원 배치는 양 끝 자리끼리 겹쳤음 → 자리 사이 140px(카드 90 + 겹쳐 쌓기 3장까지) */
  const SLOT_X = [200, 342, 484, 776, 918, 1060], SLOT = [null];
  for(let m = 1; m <= 12; m++) SLOT.push([SLOT_X[(m - 1) % 6], m <= 6 ? 218 : 452]);
  function floorHtml(view){
    const by = {}; view.f.forEach(id => { const m = C[id].m; (by[m] = by[m] || []).push(id); });
    const [w, h] = CW.floor;
    let out = '';
    for(let m = 1; m <= 12; m++){
      const L = by[m] || []; if(!L.length) continue;
      const [cx, cy] = SLOT[m], n = L.length;
      const dx = n > 1 ? Math.min(16, 46 / (n - 1)) : 0;
      L.forEach((id, i) => { out += `<div class="gs-c fl${view.hi.includes(id) ? ' glow' : ''}" data-cid="${id}" style="${px(cx - w / 2 + (i - (n - 1) / 2) * dx, cy - h / 2 + (i - (n - 1) / 2) * 6, w, h)};z-index:${i + 2}">${cardSvg(id)}</div>`; });
      if(view.ppuk && view.ppuk[m] != null) out += `<span class="gs-ppk" style="left:${Math.round(cx - 24)}px;top:${Math.round(cy - h / 2 - 16)}px">뻑</span>`;
    }
    return out;
  }
  function handHtml(view){
    const g = GS(), hand = view.h[g.me].slice().sort((a, b) => ((C[a] && C[a].m) || 99) - ((C[b] && C[b].m) || 99) || a - b);
    const fm = new Set(view.f.map(id => C[id].m)), mt = myTurn() && !g.busy && !g.picking, [w, h] = CW.hand, n = hand.length;
    const step = n > 1 ? Math.min(150, (1448 - 12 - w) / (n - 1)) : 0;   /* 오른쪽 끝 1448 < 자동 치기(1474) */
    return hand.map((id, i) => { const c = C[id], hit = c && !c.bonus && fm.has(c.m), bon = (c && c.bonus) || isDummy(id);
      return `<button class="gs-c hd${mt && (hit || bon) ? ' match' : mt ? ' nm' : ''}${mt ? '' : ' off'}" data-cid="${id}" data-h="${id}" style="${px(12 + i * step, 683, w, h)};z-index:${i + 1}" aria-label="${cardName(id)}${hit ? ', 바닥에 같은 월 있음' : ''}">${cardSvg(id)}</button>`; }).join('');
  }
  function liveView(){ const S = GS().S; return Object.assign(snap(S), { ppuk:S.ppuk }); }
  function infoHtml(view){
    const g = GS(), S = g.S, s = scoreOf(view.c[g.me]), P = S.P[g.me];
    const mul = [P.shake ? '흔들 ×' + Math.pow(2, P.shake) : '', P.go >= 3 ? P.go + '고 ×' + Math.pow(2, P.go - 2) : '', s.yN >= 7 ? '멍따 ×2' : ''].filter(Boolean);
    return `<div class="gs-ih">내 패</div><div class="gs-ir"><span>광 <b>${s.gN}</b></span><span>열 <b>${s.yN}</b></span><span>띠 <b>${s.tN}</b></span><span>피 <b>${s.piV}</b></span></div>
      <div class="gs-ir2">${mul.length ? mul.join(' · ') : (s.birds === 3 ? '고도리!' : s.hong === 3 || s.cheong === 3 || s.cho === 3 ? '단 완성!' : '7점 나면 고 · 스톱')}</div>
`;
  }
  function draw(view){
    const g = GS(); if(!g || !$('#gsb')) return;
    const op = 1 - g.me;
    $('#gsCapOp').innerHTML = capHtml(view.c[op], 8);
    $('#gsCapMe').innerHTML = capHtml(view.c[g.me], 558);
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
    clockPaint();
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
  /* 장면 재생 + 연출(gostop-fx.js GSFX): 패가 '탁' 부딪힘 · 뒤집기 · 먹은 패 모으기 · 이벤트(뻑·쪽·따닥·쓸·폭탄…) · 족보 완성 */
  const EVMAP = [['자뻑!', 'jappuk'], ['뻑 먹기!', 'ppukEat'], ['폭탄!', 'bomb'], ['따닥!', 'ttadak'], ['쪽!', 'jjok'], ['쓸!', 'sseul'], ['흔들기!', 'shake'], ['뻑!', 'ppuk'], ['보너스!', 'bonus']];
  async function playScenes(prev, scenes, p, ep){
    const g = GS(), who = p === g.me ? 'me' : 'op', s0 = scoreOf(prev.c[p]);
    let pv = prev;
    for(const sc of scenes){
      if(GS() !== g || G.over || g.epoch !== ep) return;
      const labs0 = sc.lab || [], eat = labs0.includes('뻑 먹기!') || labs0.includes('자뻑!'), hc = sc.hi && sc.hi[0];
      /* 싼 패(뻑) 먹기: ① 낸 패가 묶인 세 장 위에 '탁' 붙고 → ② 네 장이 먹은 줄로 날아감 */
      if(eat && hc != null && sc.flip == null && pv.h[p].includes(hc)){
        const A = Object.assign({}, pv, { h:[pv.h[0].slice(), pv.h[1].slice()], f:pv.f.concat(hc), hi:[hc], lab:[] });
        A.h[p] = A.h[p].filter(x => x !== hc);
        flipTo(A, pv, 360);
        setTimeout(() => X(() => { const el = document.querySelector(`#gsFloor [data-cid="${hc}"]`); if(el) GX.land(el, 3); }), 330);
        X(() => document.querySelectorAll(`#gsFloor [data-cid]`).forEach(el => { const c0 = C[+el.dataset.cid]; if(c0 && C[hc] && c0.m === C[hc].m) el.classList.add('gs-pile'); }));
        await wait(700);
        if(GS() !== g || G.over || g.epoch !== ep) return;
        pv = A;
      }
      /* 피 뺏기는 따로 한 박자 늦게: 먼저 먹은 패만 옮기고, 그다음 상대 줄 → 내 줄로 피가 날아감 */
      const q = 1 - p, stolen = sc.c[p].filter(x => pv.c[q].includes(x));
      let mid = sc;
      if(stolen.length){ mid = Object.assign({}, sc, { c:[sc.c[0].slice(), sc.c[1].slice()] }); mid.c[p] = mid.c[p].filter(x => !stolen.includes(x)); mid.c[q] = mid.c[q].concat(stolen); }
      flipTo(mid, pv, eat ? 620 : 340);
      const labs = sc.lab || [], lid = sc.flip != null ? sc.flip : sc.hi && sc.hi[0];
      const evs = EVMAP.filter(([l]) => labs.includes(l)).map(x => x[1]);
      const big = evs.includes('bomb') || evs.includes('ppukEat') || evs.includes('jappuk');
      const nm = lid != null && C[lid] ? sc.f.filter(x => C[x] && C[x].m === C[lid].m).length : 0;
      setTimeout(() => X(() => { const el = lid != null && document.querySelector(`#gsb [data-cid="${lid}"]`); if(!el) return; if(sc.flip != null) GX.flip(el); else GX.land(el, big ? 3 : nm >= 2 ? 2 : 1); }), 300);
      for(const q of [0, 1]){
        const nw = sc.c[q].filter(x => !pv.c[q].includes(x));
        if(nw.length) setTimeout(() => X(() => GX.grab(nw.map(x => document.querySelector(`#gsCap${q === g.me ? 'Me' : 'Op'} [data-cid="${x}"]`)).filter(Boolean), q === g.me ? 'me' : 'op')), 400);
      }
      let w = 470;
      if(evs.length){
        setTimeout(() => X(() => GX.event(evs[0], { who })), 330);
        if(evs[1]) setTimeout(() => X(() => GX.event(evs[1], { who })), 1050);
        faceFor(p, evs[0] === 'ppuk' ? 'sad' : 'joy', 1800);
        if(evs[0] !== 'ppuk' && evs[0] !== 'bonus') faceFor(1 - p, 'wow', 1500);
        fxBuzz(big ? [40, 30, 60] : [20, 30, 20]);
        w = evs[1] ? 1650 : evs[0] === 'bonus' ? 750 : 1150;
      }
      if(eat) w = Math.max(w, 1250);
      await wait(w);
      if(stolen.length){
        if(GS() !== g || G.over || g.epoch !== ep) return;
        flipTo(sc, mid, 760);
        X(() => GX.event('steal', { who, n:stolen.length }));
        X(() => stolen.forEach(id => { const el = document.querySelector(`#gsCap${p === g.me ? 'Me' : 'Op'} [data-cid="${id}"]`); if(el){ el.classList.add('gs-stl'); setTimeout(() => el.classList.remove('gs-stl'), 1500); } }));
        sfx('gsCap');
        await wait(950);
      }
      pv = sc;
    }
    if(GS() !== g || G.over || g.epoch !== ep) return;
    /* 족보가 이번에 완성됐으면 */
    const s1 = scoreOf(pv.c[p]), yk = [];
    if(s1.birds === 3 && s0.birds < 3) yk.push(['godori']);
    for(const k of ['hong', 'cheong', 'cho']) if(s1[k] === 3 && s0[k] < 3) yk.push([k + 'dan']);
    if(s1.gN >= 3 && s1.gN > s0.gN) yk.push(['gwang', s1.gN]);
    for(const [n, v] of yk){
      X(() => GX.event(n, { who, n:v }));
      faceFor(p, 'joy', 1800);
      await wait(n === 'gwang' && v >= 5 ? 1600 : 1150);
      if(GS() !== g || G.over || g.epoch !== ep) return;
    }
  }

  /* ----- 흐름 -----
     한 판 = 결정(step)의 줄. 결정마다 주인(S 자리)이 있다: 패 내기(S.turn) · 고/스톱(S.pendingGS).
     g.k = 지금 결정 번호, g.log[k] = 실제로 둔 수, g.raw[k] = 받은 그대로의 수, g.own[k] = 내 결정이었는지, g.src[k] = 'mine'|'opp'(누구 기록으로 뒀는지).
     대전(g.sess: 사람·AI 대전)에서는 결정마다 8초 시계 — 시간이 다 되면 비풍초똥팔삼 순서로 자동(autoAct, 무작위 없음 → 대신 내 줘도 두 기기가 같은 수). */
  const TURN_SEC = 8, GS_SEC = 8, SUN_SEC = 5, GRACE = 3, GONE_SEC = 2.5, NEXT_SEC = 6;
  const PRI = [12, 10, 5, 11, 8, 3, 9, 7, 6, 4, 2, 1];   /* 비·풍·초·똥·팔·삼, 그다음 남은 월(큰 월부터) */
  const val = id => { const c = C[id]; return !c ? 0 : c.g ? 5 : c.y ? 4 : c.tt ? 3 : c.pv >= 2 ? 2 : 1; };
  const bestOf = L => L.slice().sort((a, b) => val(b) - val(a) || a - b)[0];
  function autoAct(S, p){
    if(S.pendingGS === p) return { gs:0 };   /* 고·스톱 시간 끝 → 스톱 */
    const h = S.P[p].hand;
    let c = h.find(id => !isDummy(id) && C[id].bonus);
    if(c == null) c = h.find(isDummy);
    if(c == null) for(const m of PRI){ const L = h.filter(id => C[id].m === m).sort((a, b) => val(a) - val(b) || a - b); if(L.length){ c = L[0]; break; } }
    const act = { c, a:-1, b:-1, s:0 };
    if(c != null && !isDummy(c) && !C[c].bonus){ const F = floorOf(S, C[c].m); if(F.length === 2) act.a = bestOf(F); }
    const pr = gsApply(cloneS(S), p, act, true);
    if(pr && pr.need === 'b') act.b = bestOf(pr.opts);
    return act;
  }
  const owner = S => S.pendingGS >= 0 ? S.pendingGS : S.turn;
  const valid = (S, p, x) => x && (x.gs != null ? S.pendingGS === p : S.pendingGS < 0 && S.turn === p && S.P[p].hand.includes(x.c));
  function applyRaw(S, p, x){ if(x.gs != null){ gsGoStop(S, p, !!x.gs); return []; } return gsApply(S, p, x); }
  /* 대전 기록 한 줄: [판, 번호, 종류, …]  종류 0 패 [c,a,b,s] · 1 고스톱 [g] · 2 선 뽑기 [칸] · 3 다음 판 [나가기 예약, 포인트] */
  const E = (gi, k, x) => x.gs != null ? [gi, k, 1, x.gs] : [gi, k, 0, x.c, x.a, x.b, x.s];
  const D = e => e[2] === 1 ? { gs:e[3] } : { c:e[3], a:e[4], b:e[5], s:e[6] };
  const fe = (L, gi, k) => (L || []).find(e => Array.isArray(e) && e[0] === gi && e[1] === k);
  const sameX = (x, y) => JSON.stringify(E(0, 0, x)) === JSON.stringify(E(0, 0, y));
  const X = (f) => { try{ f(); }catch(_){} };   /* 효과는 보이기만: 오류가 나도 판은 계속 */
  const seedOf = gi => GS().seed0 + ':' + gi;
  const seatOf = si => { const g = GS(); return si === 0 ? g.first : 1 - g.first; };

  function startPlay(){
    const g = GS(); if(!g || G.over) return;
    g.me = g.seat === g.first ? 0 : 1;   /* S 0번 자리 = 이번 판 선 */
    g.S = gsDeal(seedOf(g.gi)); g.S.first = 0;
    g.rnd = mulberry(seedFrom(seedOf(g.gi) + ':ai:' + g.seat));
    g.k = 0; g.log = []; g.raw = []; g.own = []; g.src = []; g.busy = true; g.picking = false; g.stepT0 = Date.now() + 700;   /* 패 돌리는 동안은 대신 두기 금지 */
    g.began = true; g.inGame = true; g.ended = false; g.paid = false; g.res = null; g.phase = 'play'; g.epoch = (g.epoch || 0) + 1;
    g.nxSent = false; clearInterval(g.nxIv); g.fpPaid = [0, 0]; g.fpd = 0;
    $('#gsSun').hidden = true; $('#gsLobby').hidden = true; $('#gsSearch').hidden = true;
    const box = $('#gsAsk'); if(box){ box.hidden = true; box.innerHTML = ''; }
    $('#gsBody').hidden = false; fit();
    const tg = $('#gsTag'); if(tg) tg.innerHTML = `${BADGE19}<b>${(g.room || ROOMS[0]).name}</b>${g.sess ? `<small>${g.gi + 1}판째</small>` : ''}`;
    const gate = $('#gsGate'); if(gate) gate.remove();
    byeUI();
    draw(liveView());
    /* 패 돌리기 연출 */
    X(() => { if(!FXR.reduce) document.querySelectorAll('#gsg .gs-c.hd, #gsg .gs-c.fl').forEach((el, i) => el.animate([{ transform:'translateY(-30px) scale(.5)', opacity:0 }, { transform:'none', opacity:1 }], { duration:360, delay:i * 28, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'backwards' })); });
    X(() => GX.event('deal', { n:18 }));
    if(g.S.over){ setTimeout(() => endGame(), 900); return; }
    const ep = g.epoch;
    setTimeout(() => { if(GS() === g && g.epoch === ep) nextStep(); }, 700);
  }
  function nextStep(){
    const g = GS(); if(!g || G.over || g.phase !== 'play') return;
    const S = g.S; if(S.over){ endGame(); return; }
    g.busy = false;
    const p = owner(S), gs = S.pendingGS >= 0, k = g.k;
    draw(liveView());
    g.stepT0 = Date.now(); clearTimeout(g.turnT);
    if(g.sess) clockRun(p, gs ? GS_SEC : TURN_SEC, p === g.me ? () => timeUp(k) : null);
    if(p === g.me){
      if(gs){ askGS(k); return; }
      setMsg(`<b>내 차례</b> · ${S.P[g.me].hand.some(id => C[id] && C[id].bonus) ? '보너스패를 먼저 내도 돼요' : g.sess ? '8초 안에 낼 패를 누르세요' : '낼 패를 누르세요'}`, 'me');
      sfx('gsfxTurn');   /* 내 차례: 소리만(바닥에 큰 원이 남아 보이지 않게) */
    } else {
      setMsg(`<b>${esc(g.oppNick)}</b> ${gs ? '고? 스톱? 고르는 중…' : '차례…'}${g.mode === 'pvp' && !g.oppHere ? ' <small>(연결 끊김 · 자동으로 대신 쳐요)</small>' : ''}`, 'op');
      if(g.mode !== 'pvp') g.turnT = setTimeout(() => { if(GS() === g && g.k === k && !g.busy) step(k, gs ? { gs:aiGo(S, p, g.ai, g.rnd) ? 1 : 0 } : aiPick(S, p, g.ai, g.rnd), 'ai'); }, gs ? 800 : 650 + g.rnd() * 500);
      else sync();
    }
  }
  /* 시계: 지금 결정의 주인 프로필에 둥근 시계 + 남은 시간에 따라 캐릭터 표정(여유 → 놀람 → 울상) */
  function clockRun(p, sec, onEnd){
    const g = GS(); clockStop();
    g.clk = { p, t0:Date.now(), sec, cb:onEnd, last:99 };
    const tk = () => {
      if(GS() !== g || G.over || !g.clk){ clearInterval(g.tIv); return; }
      const c = g.clk, left = c.sec - (Date.now() - c.t0) / 1000;
      clockPaint();
      const n = Math.ceil(left);
      if(n >= 1 && n <= 3 && n < c.last){ c.last = n; if(c.p === g.me) X(() => GX.event('tick', { n })); }
      if(left <= 0){ clearInterval(g.tIv); const cb = c.cb; c.cb = null; if(cb) cb(); }
    };
    g.tIv = setInterval(tk, 100); tk();
  }
  function clockStop(){ const g = GS(); if(!g) return; clearInterval(g.tIv); g.clk = null; clockPaint(); }
  const MOODS = { calm:'', hurry:'wow', panic:'sad' };
  function setMood(el, mood){
    X(() => {
      const m = el && el.querySelector('.gs-mask'); if(!m || m.dataset.md === mood) return;
      m.dataset.md = mood; m.innerHTML = maskSvg(m.dataset.k, mood, maskTone(GS().oppNick));
    });
  }
  function clockPaint(){
    const g = GS(); if(!g || !g.S) return;
    const c = g.clk, now = Date.now();
    for(const p of [0, 1]){
      const el = $(p === g.me ? '#gsMe' : '#gsOpp'); if(!el) continue;
      const on = c && c.p === p, left = on ? Math.max(0, c.sec - (now - c.t0) / 1000) : 0;
      const st = !on ? '' : left > 5 ? 'calm' : left > 2.5 ? 'hurry' : 'panic';
      el.classList.toggle('tm', !!on); ['calm', 'hurry', 'panic'].forEach(x => el.classList.toggle(x, st === x));
      const fg = el.querySelector('.gs-ring .fg'); if(fg) fg.style.strokeDashoffset = on ? (100 - left / c.sec * 100).toFixed(1) : '100';
      const sec = el.querySelector('.gs-sec'); if(sec) sec.textContent = on ? Math.ceil(left) : '';
      const face = g.face && g.face[p] && g.face[p][1] > now ? g.face[p][0] : null;
      setMood(el, on ? MOODS[st] : face || '');
    }
  }
  /* 잠깐 표정(큰 일이 생긴 쪽): 시계가 없을 때만 보임 */
  function faceFor(p, mood, ms){ const g = GS(); if(!g) return; g.face = g.face || []; g.face[p] = [mood, Date.now() + (ms || 1800)]; clockPaint(); setTimeout(() => { if(GS() === g) clockPaint(); }, (ms || 1800) + 50); }
  function timeUp(k){
    const g = GS(); if(!g || G.over || g.phase !== 'play' || g.k !== k || g.busy) return;
    closeAsk();
    X(() => GX.event('timeout'));
    toast('8초가 지나 비풍초똥팔삼 순서로 자동으로 냈어요');
    step(k, autoAct(g.S, g.me), 'me');
  }
  function onHand(id){
    const g = GS(); if(!g || g.busy || g.picking || !myTurn()) return;
    sfx('gsPick', { off:false });
    myPlay(id);   /* 한 번 누르면 바로 냄 */
  }
  function autoHand(){
    const g = GS(); if(!g || g.busy || g.picking || !myTurn()) return;
    step(g.k, aiPick(g.S, g.me, 'normal', g.rnd), 'me');   /* 자동 치기: 보통 AI가 대신 골라 냄 */
  }
  /* 고르기 창(게임 화면 안). closeAsk()로 닫으면 null */
  function ask(title, opts, cards){
    const g = GS();
    return new Promise(res => {
      const box = $('#gsAsk'); if(!box){ res(null); return; }
      box.innerHTML = `<div class="gs-askc"><b>${title}</b>${cards ? `<div class="gs-askcards">${cards}</div>` : ''}<div class="gs-askb">${opts.map((o, i) => `<button class="${o.cls || ''}" data-i="${i}">${o.html}</button>`).join('')}</div></div>`;
      box.hidden = false;
      let done = false;
      const fin = v => { if(done) return; done = true; if(g.askFin === fin0) g.askFin = null; box.hidden = true; box.innerHTML = ''; res(v); };
      const fin0 = () => fin(null);
      box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { sfx('gsPick', {}); fin(opts[+b.dataset.i].v); });
      g.askFin = fin0;
    });
  }
  function closeAsk(){ const g = GS(); if(g && g.askFin) g.askFin(); }
  async function myPlay(id){
    const g = GS(), S = g.S, k = g.k;
    g.picking = true;
    const gone = v => v == null || GS() !== g || G.over || g.k !== k || g.busy;
    let s = 0, a = -1, b = -1;
    if(!isDummy(id) && !C[id].bonus){
      const M = C[id].m, nh = S.P[g.me].hand.filter(x => C[x] && C[x].m === M).length, F = floorOf(S, M);
      if(nh >= 3 && F.length === 1){ s = 2; }
      else if(nh >= 3 && F.length === 0){
        s = await ask(`${M}월 세 장! 흔들까요?`, [{ v:1, html:'흔들기 (점수 ×2)', cls:'pri' }, { v:0, html:'그냥 내기' }], S.P[g.me].hand.filter(x => C[x] && C[x].m === M).map(x => `<div class="gs-c ask">${cardSvg(x)}</div>`).join(''));
        if(gone(s)) return;
      }
      if(s !== 2 && F.length === 2){
        if(same(F[0], F[1])) a = F[0];
        else { a = await ask('어느 패를 먹을까요?', F.map(x => ({ v:x, html:`<div class="gs-c ask">${cardSvg(x)}</div><small>${cardName(x)}</small>`, cls:'card' }))); if(gone(a)) return; }
      }
      const pr = gsApply(cloneS(S), g.me, { c:id, a, b:-1, s }, true);
      if(pr && pr.need === 'b'){
        b = await ask(`뒤집은 패 <span class="gs-inl">${cardSvg(pr.flip)}</span> 로 어느 패를 먹을까요?`, pr.opts.map(x => ({ v:x, html:`<div class="gs-c ask">${cardSvg(x)}</div><small>${cardName(x)}</small>`, cls:'card' })));
        if(gone(b)) return;
      }
    }
    if(gone(0)) return;
    step(k, { c:id, a, b, s }, 'me');
  }
  async function askGS(k){
    const g = GS(), S = g.S, p = g.me;
    const sc = scoreOf(S.P[p].cap).total, op = S.P[1 - p];
    g.picking = true;
    sfx('gsBig');
    setMsg(`<b>${sc}점!</b> 고? 스톱?`, 'me');
    const go = await ask(`<span class="gs-gsh">${sc}점 났어요!</span>${op.go ? '<small>상대가 고를 했어요 · 지금 스톱하면 고박(×2)</small>' : `<small>고 하면 +${S.P[p].go + 1}점${S.P[p].go + 1 >= 3 ? ' · 배수' : ''} · 대신 상대가 먼저 나면 고박</small>`}${g.sess ? '<small>8초 안에 안 고르면 스톱</small>' : ''}`,
      [{ v:1, html:`고! <small>${S.P[p].go + 1}고</small>`, cls:'go' }, { v:0, html:'스톱', cls:'stop' }]);
    if(go == null || GS() !== g || G.over || g.k !== k || g.busy) return;
    step(k, { gs:go }, 'me');
  }
  /* 결정 하나 두기(내 손·시간 끝·AI·상대 기록·대신 두기 모두 여기로). 잘못된 수면 자동 수로 바꿈(두 기기 같은 규칙) */
  async function step(k, x, from){
    const g = GS(); if(!g || G.over || g.phase !== 'play' || g.busy || k !== g.k) return;
    const S = g.S, p = owner(S), raw = x;
    if(!valid(S, p, x)) x = autoAct(S, p);
    g.busy = true; g.picking = false; closeAsk(); clockStop(); clearTimeout(g.turnT);
    const ep = g.epoch, who = p === g.me ? 'me' : 'op';
    g.log[k] = x; g.raw[k] = raw; g.own[k] = p === g.me; g.src[k] = from === 'opp' ? 'opp' : 'mine';
    if(g.mode === 'pvp' && (from === 'me' || from === 'proxy')) publish(E(g.gi, k, raw && valid(S, p, raw) ? raw : x));
    if(from === 'proxy') setMsg(`<b>${esc(g.oppNick)}</b> 대신 자동으로 냈어요`, 'op');
    const prev = liveView();
    if(x.gs != null){
      gsGoStop(S, p, !!x.gs);
      X(() => GX.event(x.gs ? 'go' : 'stop', { who, n:S.P[p].go }));
      faceFor(p, x.gs ? 'joy' : 'wow', 1600);
      fxBuzz(x.gs ? [30, 40, 30] : 60);
      draw(liveView());
      await wait(x.gs ? (S.P[p].go >= 3 ? 1500 : 1150) : 950);
    } else {
      const scenes = gsApply(S, p, x);
      await playScenes(prev, scenes, p, ep);
    }
    if(GS() !== g || G.over || g.epoch !== ep) return;
    fpCheck();
    g.k = k + 1; g.busy = false;
    if(S.over) endGame(); else nextStep();
  }
  /* 기록이 엇갈렸을 때(내가 끊긴 사이 상대가 대신 냄 등): 판 처음부터 정해진 규칙으로 다시 쌓기
     규칙: 결정마다 '주인이 아닌 쪽(대신 둔 쪽)'의 기록이 있으면 그것, 없으면 주인 기록. 두 기기가 같은 결과 */
  function rebuild(){
    const g = GS(); if(!g || g.phase !== 'play') return;
    g.epoch++; closeAsk(); clockStop(); clearTimeout(g.turnT);
    const S = gsDeal(seedOf(g.gi)); S.first = 0; g.S = S; g.log = []; g.raw = []; g.own = []; g.src = [];
    let k = 0;
    while(!S.over && k < 200){
      const p = owner(S), mine = p === g.me, my = fe(g.ev, g.gi, k), op = fe(g.oev, g.gi, k);
      const e = mine ? (op || my) : (my || op); if(!e || e[2] > 1) break;
      const raw = D(e); let x = raw; if(!valid(S, p, x)) x = autoAct(S, p);
      applyRaw(S, p, x); g.log[k] = x; g.raw[k] = raw; g.own[k] = mine; g.src[k] = e === my ? 'mine' : 'opp'; k++;
    }
    g.k = k; g.busy = false; g.picking = false; fpCheck();
    toast('연결이 늦어 상대와 판을 다시 맞췄어요');
    draw(liveView());
    if(S.over) endGame(); else nextStep();
  }

  /* ----- 선 뽑기: 엎어 둔 8장 중 한 장씩 뒤집어 높은 월이 선. 같은 월이면 다시. 5초 안에 안 고르면 아무거나(정해진 씨앗) ----- */
  function sunStart(){ const g = GS(); g.phase = 'sun'; g.began = true; g.sunR = 0; $('#gsBody').hidden = true; $('#gsSearch').hidden = true; sunRound(); }
  function sunCards(r){ return gsShuffle([...Array(48).keys()], mulberry(seedFrom(GS().seed0 + ':sun:' + r))).slice(0, 8); }
  const SUNW = 124, SUNH = 202, SUNG = 22, SUNX = (BW - (8 * SUNW + 7 * SUNG)) / 2;
  function sunRound(){
    const g = GS(); if(!g || G.over) return;
    g.sunCards = sunCards(g.sunR); g.sunPicks = []; g.sunBusy = false; g.sunT0 = Date.now() + 700;
    const box = $('#gsSun'); box.hidden = false;
    const nm = s => s === g.seat ? '나' : esc(g.oppNick);
    box.innerHTML = `<div class="gs-sunh"><b>선 뽑기</b><span>${g.sunR ? '다시 뽑기 · ' : ''}엎어 둔 패 한 장씩 뒤집어 <em>높은 월</em>이 선(먼저 침)</span></div>
      <div class="gs-sunp a">${maskAv(g.seat === 0)}<b>${nm(0)}</b><small>먼저 뒤집기</small></div>
      <div class="gs-sunp b">${maskAv(g.seat === 1)}<b>${nm(1)}</b><small>다음에 뒤집기</small></div>
      ${g.sunCards.map((id, i) => `<button class="gs-c sunc" data-i="${i}" style="${px(SUNX + i * (SUNW + SUNG), 300, SUNW, SUNH)}" aria-label="엎어 둔 패 ${i + 1}">${BACK}</button>`).join('')}
      <div class="gs-sunm" id="gsSunM"></div><div class="gs-sunt" id="gsSunT"><i></i></div>
      <button class="gs-sunx" id="gsSunX">나가기</button>`;
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { if(!g.sunBusy && g.sunPicks.length === g.seat && !g.sunPicks.includes(+b.dataset.i)){ sfx('gsPick', {}); sunPick(+b.dataset.i, 'me'); } });
    $('#gsSunX').onclick = () => confirmQuit();
    X(() => { if(!FXR.reduce) box.querySelectorAll('.sunc').forEach((el, i) => el.animate([{ transform:'translateY(-60px) rotate(-8deg)', opacity:0 }, { transform:'none', opacity:1 }], { duration:380, delay:i * 45, easing:'cubic-bezier(.2,1.3,.4,1)', fill:'backwards' })); });
    X(() => GX.event('deal', { n:8 }));
    const r0 = g.sunR; setTimeout(() => { if(GS() === g && g.phase === 'sun' && g.sunR === r0 && !g.sunPicks.length && !g.sunBusy) sunTurn(); }, 700);
  }
  function sunTurn(){
    const g = GS(), j = g.sunPicks.length, mine = j === g.seat;
    g.sunT0 = Date.now(); g.sunBusy = false;
    const m = $('#gsSunM'); if(m) m.innerHTML = mine ? '<b>내 차례</b> · 패 한 장을 눌러 뒤집어요' : `<b>${esc(g.oppNick)}</b> 고르는 중…`;
    $('#gsSun').querySelectorAll('.sunc').forEach((b, i) => b.classList.toggle('can', mine && !g.sunPicks.includes(i)));
    clearInterval(g.sunIv);
    g.sunIv = setInterval(() => {
      if(GS() !== g || g.phase !== 'sun'){ clearInterval(g.sunIv); return; }
      const left = Math.max(0, SUN_SEC - (Date.now() - g.sunT0) / 1000), t = $('#gsSunT');
      if(t){ t.firstChild.style.width = (left / SUN_SEC * 100) + '%'; t.classList.toggle('hurry', left < 2); t.dataset.s = Math.ceil(left); }
      if(left <= 0 && mine && !g.sunBusy){ clearInterval(g.sunIv); sunPick(sunAuto(), 'me'); }
    }, 100);
    if(!mine && g.mode !== 'pvp') g.turnT = setTimeout(() => { if(GS() === g && g.phase === 'sun') sunPick(sunAuto(), 'ai'); }, 1000);
    if(!mine && g.mode === 'pvp') sync();
  }
  function sunAuto(){
    const g = GS(), j = g.sunPicks.length, rng = mulberry(seedFrom(g.seed0 + ':sun:' + g.sunR + ':' + j)), free = [...Array(8).keys()].filter(i => !g.sunPicks.includes(i));
    return free[Math.floor(rng() * free.length)];
  }
  function sunPick(i, from){
    const g = GS(); if(!g || G.over || g.phase !== 'sun' || g.sunBusy) return;
    const j = g.sunPicks.length; if(j >= 2) return;
    if(!(i >= 0 && i < 8) || g.sunPicks.includes(i)) i = sunAuto();
    g.sunBusy = true; clearInterval(g.sunIv); clearTimeout(g.turnT);
    if(g.mode === 'pvp' && (from === 'me' || from === 'proxy')) publish([-1, g.sunR * 2 + j, 2, i]);
    g.sunPicks.push(i);
    const el = $('#gsSun').querySelector(`[data-i="${i}"]`), id = g.sunCards[i];
    if(el){
      el.classList.remove('can'); el.classList.add('open', j === g.seat ? 'mine' : 'opp');
      el.innerHTML = cardSvg(id) + `<span class="gs-sunl">${j === g.seat ? '나' : esc(g.oppNick)} · ${C[id].m}월</span>`;
      X(() => { if(!FXR.reduce) el.animate([{ transform:'rotateY(90deg) scale(1.1)' }, { transform:'rotateY(0) scale(1.12)', offset:.6 }, { transform:'none' }], { duration:520, easing:'cubic-bezier(.2,1.2,.4,1)' }); });
      X(() => GX.event('sunFlip'));
      setTimeout(() => X(() => GX.land(el, 1)), 300);
    }
    $('#gsSun').querySelectorAll('.sunc').forEach(b => b.classList.remove('can'));
    const r0 = g.sunR, n0 = g.sunPicks.length;
    setTimeout(() => {
      if(GS() !== g || G.over || g.phase !== 'sun' || g.sunR !== r0 || g.sunPicks.length !== n0) return;   /* 지난 뒤집기의 늦은 예약은 무시 */
      if(n0 < 2){ sunTurn(); return; }
      const m = g.sunPicks.map(x => C[g.sunCards[x]].m), mm = $('#gsSunM');
      if(m[0] === m[1]){
        if(mm) mm.innerHTML = `<b>둘 다 ${m[0]}월!</b> 같은 월이라 다시 뽑아요`;
        banner('같은 월! 다시', 'stop');
        setTimeout(() => { if(GS() === g && g.phase === 'sun'){ g.sunR++; sunRound(); } }, 1600);
        return;
      }
      g.first = m[0] > m[1] ? 0 : 1;
      const meFirst = g.first === g.seat;
      if(mm) mm.innerHTML = `<b>${m[0]}월 vs ${m[1]}월</b> · ${meFirst ? '내가 선! 먼저 쳐요' : esc(g.oppNick) + '님이 선이에요'}`;
      const win = $('#gsSun').querySelector(`[data-i="${g.sunPicks[g.first]}"]`); if(win) win.classList.add('sun');
      X(() => GX.event('sun', { who:meFirst ? 'me' : 'op' }));
      g.phase = 'sunDone';
      setTimeout(() => { if(GS() === g && g.phase === 'sunDone'){ g.gi = 0; startPlay(); } }, 2000);
    }, 800);
  }

  /* ----- 끝: 한 판 결과 → 대전이면 잠깐 뒤 바로 다음 판(나가기 예약이면 대전 끝) ----- */
  function endGame(){
    const g = GS(); if(!g || g.ended) return;
    g.ended = true; g.inGame = false; g.phase = 'between'; clockStop(); clearTimeout(g.turnT); closeAsk();
    const S = g.S, r = S.result || { w:-1, final:0, rows:[], mults:[], why:'나가리' };
    g.res = r;
    const win = r.w === g.me, draw0 = r.w < 0;
    const pay = settle() || { d:0, bonus:0, got:[], after:wallet().pt };
    if(g.sess){ const t = g.tot; t.n++; if(draw0) t.d++; else if(win) t.w++; else t.l++; t.pt += pay.d + (g.fpd || 0); if(g.mode === 'pvp' && g.oppPt != null) g.oppPt = Math.max(0, g.oppPt - pay.d); }
    g.lastW = r.w;
    draw(liveView());
    const payHtml = (g.room && g.room.stake ? `<div class="gs-pay ${pay.d > 0 ? 'up' : pay.d < 0 ? 'down' : ''}"><span>${g.room.name}</span><b>${pay.d > 0 ? '+' : ''}${fmtP(pay.d)}</b></div>` : '<div class="gs-pay"><span>연습 판</span><b>포인트 변화 없음</b></div>')
      + (g.fpd ? `<div class="gs-pay ${g.fpd > 0 ? 'up' : 'down'} sm"><span>첫뻑 (판돈 ×${FP_X}, 판 중에 받음)</span><b>${g.fpd > 0 ? '+' : '−'}${fmtP(Math.abs(g.fpd))}</b></div>` : '')
      + (pay.bonus ? `<div class="gs-pay up sm"><span>솔로 새 판 첫 클리어</span><b>+${fmtP(pay.bonus)}</b></div>` : '')
      + pay.got.map(a => `<div class="gs-pay up sm"><span>업적 · ${a.name}</span><b>+${fmtP(a.pt)}</b></div>`).join('')
      + `<p class="gs-after">보유 포인트 <b>${fmtP(pay.after)}</b>${pay.after < ROOMS[1].min ? ' · 다음 판 전에 파산 구제를 받을 수 있어요' : ''}</p>`;
    const mult = r.mults && r.mults.length ? r.mults.map(m => `<div><span>${m[0]}</span><b>×${m[1]}</b></div>`).join('') : '';
    const t = g.tot;
    const box = $('#gsAsk');
    const html = `<div class="gs-askc gs-end ${draw0 ? 'd' : win ? 'w' : 'l'}"><div class="gs-el">${g.sess ? `<span class="gs-eno">${t.n}판째 · ${t.w}승 ${t.l}패${t.d ? ' ' + t.d + '무' : ''}</span>` : ''}<b class="gs-et">${draw0 ? '나가리' : win ? '이겼어요!' : '졌어요'}</b>
      <p class="gs-ew">${draw0 ? '아무도 7점을 못 내고 패가 다 떨어졌어요(무승부)' : (win ? '내가 ' : esc(g.oppNick) + '님이 ') + (r.why === '스톱' ? '스톱했어요' : r.why === '마지막 패' ? '마지막 패로 났어요' : r.why + '로 이겼어요')}</p>
      ${draw0 ? '' : `<div class="gs-erows">${(r.rows || []).map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}${mult}<div class="tot"><span>최종</span><b>${fmt(r.final)}점</b></div></div>`}</div>
      <div class="gs-er">${payHtml}
      ${g.sess ? `<div class="gs-nx" id="gsNx"><i></i><span id="gsNxT"></span></div><div class="gs-askb"><button class="${g.bye ? 'on' : ''}" id="gsEndBye">${g.bye ? '나가기 예약 취소' : '나가기 예약'}</button></div>`
        : '<div class="gs-askb"><button class="pri" id="gsEndOk">결과 보기</button></div>'}</div></div>`;
    if(box){ box.innerHTML = html; box.hidden = false; }
    /* 연출: 총통·3뻑 → 박 → 승패 */
    const who = r.w === g.me ? 'me' : 'op';
    let at = 0;
    if(r.why === '총통' || r.why === '3뻑'){ X(() => GX.event(r.why === '총통' ? 'chongtong' : 'ppuk3', { who })); at = 1300; }
    (r.mults || []).filter(m => /피박|광박|고박|멍따/.test(m[0])).slice(0, 2).forEach(m => { setTimeout(() => X(() => GX.event('bak', { who, text:m[0].replace(/\(.*\)/, '') })), at); at += 900; });
    setTimeout(() => { if(GS() === g) X(() => GX.event(draw0 ? 'draw' : win ? 'win' : 'lose', { who })); }, at);
    if(!draw0){ faceFor(r.w, 'joy', 5000); faceFor(1 - r.w, 'sad', 5000); }
    if(g.sess){
      const eb = $('#gsEndBye'); if(eb) eb.onclick = () => toggleBye();
      const t0 = Date.now() + at, tot = NEXT_SEC * 1000;
      clearInterval(g.nxIv);
      g.nxIv = setInterval(() => {
        if(GS() !== g || G.over || g.phase !== 'between'){ clearInterval(g.nxIv); return; }
        const left = Math.max(0, tot - Math.max(0, Date.now() - t0)), n = $('#gsNx'), tx = $('#gsNxT');
        if(n) n.firstChild.style.width = (100 - left / tot * 100) + '%';
        if(!g.nxSent){
          if(tx) tx.textContent = g.bye ? `나가기 예약 · ${Math.ceil(left / 1000)}초 뒤 대전을 마쳐요` : `${Math.ceil(left / 1000)}초 뒤 다음 판을 시작해요`;
          if(left <= 0) nxSend();
        } else if(tx && g.phase === 'between') tx.textContent = `${esc(g.oppNick)}님을 기다리는 중…`;
      }, 150);
      return;
    }
    const done = () => {
      if(GS() !== g || G.over) return;
      if(box){ box.hidden = true; box.innerHTML = ''; }
      finish(win);
    };
    const ok = $('#gsEndOk'); if(ok) ok.onclick = done;
    g.endT = setTimeout(done, 30000);
  }
  /* 다음 판 할지 알리기: [판, 999, 3, 나가기 예약, 포인트]. 두 사람 기록이 모두 있어야 결정(같은 결론) */
  function nxSend(){
    const g = GS(); if(!g || g.nxSent) return;
    g.nxSent = true; g.nxT = Date.now(); g.nxBye = !!g.bye;
    if(g.mode === 'pvp' && !g.nxBye){ publish([g.gi, 999, 3, 0, wallet().pt]); sync(); }
    else { if(g.mode === 'pvp') publish([g.gi, 999, 3, 1, wallet().pt]); decideNext(false, null); }
  }
  function nxSync(){
    const g = GS(); if(!g.nxSent || g.phase !== 'between') return;
    const oe = fe(g.oev, g.gi, 999);
    if(oe){ decideNext(!!oe[3], oe[4]); return; }
    if(!g.oppHere && g.oppGone && Date.now() - g.oppGone > GONE_SEC * 1000){ decideNext(true, null, '상대가 나가서 대전을 마쳐요'); return; }
    if(Date.now() - g.nxT > 15000) decideNext(true, null, '상대 응답이 없어서 대전을 마쳐요');
  }
  function decideNext(oppBye, oppPt, why){
    const g = GS(); if(!g || g.phase !== 'between') return;
    g.phase = 'decide'; clearInterval(g.nxIv);
    if(typeof oppPt === 'number') g.oppPt = oppPt;
    const room = g.room || ROOMS[0], myPt = wallet().pt;
    let end = '';
    if(g.nxBye) end = '나가기 예약대로 대전을 마쳐요';
    else if(oppBye) end = why || '상대가 나가기를 예약해서 대전을 마쳐요';
    else if(myPt < room.min) end = '포인트가 모자라 대전을 마쳐요';
    else if(g.mode === 'pvp' && g.oppPt != null && g.oppPt < room.min) end = '상대 포인트가 모자라 대전을 마쳐요';
    if(end){ sessionEnd(end); return; }
    /* 다음 판 선 = 이번 판 이긴 사람(나가리면 그대로) */
    if(g.lastW >= 0) g.first = seatOf(g.lastW);
    g.gi++;
    startPlay();
  }
  function sessionEnd(why){
    const g = GS(); if(!g || G.over) return;
    g.phase = 'done'; clockStop(); clearInterval(g.nxIv);
    const box = $('#gsAsk'); if(box){ box.hidden = true; box.innerHTML = ''; }
    const t = g.tot;
    if(G.duel){
      G.duel.r = t.w > t.l ? 'w' : t.w < t.l ? 'l' : 'd';
      G.duel.a = { sc:t.w, pg:null }; G.duel.b = { sc:t.l, pg:null };
      G.duel.why = `${t.n}판 ${t.w}승 ${t.l}패${t.d ? ' ' + t.d + '무' : ''} · 포인트 ${t.pt > 0 ? '+' : ''}${fmtP(t.pt)}${why ? ' · ' + why : ''}`;
    }
    if(why) X(() => toast(why));
    finish(t.w > t.l || (t.w === t.l && t.pt > 0));
  }
  function toggleBye(){
    const g = GS(); if(!g || !g.sess) return;
    g.bye = !g.bye; sfx('gsPick', {});
    X(() => toast(g.bye ? (g.nxSent ? '나가기 예약! 다음 판이 끝나면 나가요' : '나가기 예약! 이번 판이 끝나면 나가요 · 다시 누르면 취소') : '나가기 예약을 취소했어요'));
    byeUI();
    if(g.nr) X(() => g.nr.presence({ bye:g.bye ? 1 : 0 }).catch(() => {}));
  }
  function byeUI(){
    const g = GS(); if(!g) return;
    const b = $('#gsOut'); if(b && g.sess){ b.textContent = g.bye ? '예약 취소' : '나가기 예약'; b.classList.toggle('on', !!g.bye); }
    const e = $('#gsEndBye'); if(e){ e.textContent = g.bye ? '나가기 예약 취소' : '나가기 예약'; e.classList.toggle('on', !!g.bye); }
    if(g.S && g.phase === 'play' && !g.busy) draw(liveView());
  }

  /* ----- 고스톱 포인트(이 게임 전용, 무료로만 얻음 · 구매·환전·선물 없음) ----- */
  const PT_KEY = 'hp:gs:pt', START_PT = 10000, RESCUE_TO = 10000, FREE_PT = 3000, FREE_MS = 3 * 3600 * 1000;
  const ROOMS = [
    { k:0, stake:0, min:0, name:'연습 판', sub:'포인트가 오가지 않아요' },
    { k:1, stake:100, min:2000, name:'작은 판', sub:'입장 2천 포인트 이상 · 판 크기 ×100' },
    { k:2, stake:500, min:10000, name:'보통 판', sub:'입장 1만 포인트 이상 · 판 크기 ×500' },
    { k:3, stake:1000, min:30000, name:'큰 판', sub:'입장 3만 포인트 이상 · 판 크기 ×1,000' },
    { k:4, stake:5000, min:150000, name:'왕 판', sub:'입장 15만 포인트 이상 · 판 크기 ×5,000' }
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
    if(g.link && g.mode === 'pvp'){ const r = ROOMS[g.link.k] || ROOMS[0]; g.room = wallet().pt >= r.min ? r : ROOMS[0]; turnHint(); linkJoin(); return; }
    const att = attendance();
    const box = $('#gsLobby'); box.hidden = false; $('#gsBody').hidden = true;
    const draw0 = msg => {
      const w = wallet(), fl = freeLeft(w), canRescue = broke(w) && w.rescue !== dayKey(), canFree = broke(w) && w.rescue === dayKey() && fl === 0;
      const nAch = ACH.filter(a => w.ach[a.k]).length;
      box.innerHTML = `<div class="gs-lb">
        <div class="gs-wal"><span class="gs-coin">P</span><div><small>내 고스톱 포인트</small><b>${fmtP(w.pt)}</b><em>${titleOf(w.peak)} · 최고 ${fmtP(w.peak)}</em></div></div>
        <h3>${g.mode === 'pvp' ? '대전할 판을 골라요' : G.adv ? '솔로 ' + G.adv + '판 · 판을 골라요' : '컴퓨터와 겨룰 판을 골라요'}</h3>
        <div class="gs-rooms">${ROOMS.map(r => { const ok = w.pt >= r.min; return `<button class="gs-room r${r.k}" data-r="${r.k}" ${ok ? '' : 'disabled'}><b>${r.name}</b><small>${ok ? r.sub : fmtP(r.min) + ' 필요'}</small></button>`; }).join('')}</div>
        <p class="gs-rnote">이기면 <b>최종 점수 × 판 크기</b>만큼 포인트를 받고, 지면 그만큼 잃어요(가진 포인트까지만). 포인트는 게임 안에서만 쓰고 돈으로 사고팔 수 없어요.</p>
        <div class="gs-earn"><b>포인트 얻는 법</b>
          <div class="${w.att === dayKey() ? 'done' : ''}"><span>매일 출석 <small>${w.streak || 1}일 연속 · 내일 +${fmt(1000 + Math.min(6, w.streak || 0) * 400)}P</small></span><i>${att ? '+' + fmt(att) + 'P 받음' : '오늘 받음'}</i></div>
          <div><span>파산 구제 <small>2천P보다 적으면 하루 한 번 1만P까지</small></span>${canRescue ? '<button id="gsRescue">받기</button>' : `<i>${w.rescue === dayKey() ? '오늘 받음' : '포인트 충분'}</i>`}</div>
          <div><span>무료 충전 <small>구제 뒤에도 모자라면 3시간마다 3천P</small></span>${canFree ? '<button id="gsFree">받기</button>' : `<i>${broke(w) && w.rescue === dayKey() ? hm(fl) + ' 뒤' : '필요 없음'}</i>`}</div>
          <div><span>업적 <small>${ACH.map(a => `${w.ach[a.k] ? '✓' : '·'} ${a.name} +${fmt(a.pt / 1000)}천`).join(' ')}</small></span><i>${nAch}/${ACH.length}</i></div>
          <div><span>솔로 새 판 첫 클리어 <small>챕터마다 +500P씩 커짐</small></span><i>솔로</i></div>
        </div></div>`;
      if(msg) try{ toast(msg); }catch(_){}
      box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = ROOMS[+b.dataset.r]; if(wallet().pt < r.min) return; sfx('gsPick', {}); g.room = r; box.hidden = true; box.innerHTML = ''; turnHint();
        if(g.mode === 'pvp') search();
        else if(g.sess){ g.seed0 = 'gs:ai:' + g.seedBase; g.seat = 0; sunStart(); }   /* AI 대전도 선 뽑기 · 연속 판 */
        else { g.seed0 = 'gs:solo:' + G.adv + ':' + g.seedBase; g.seat = 0; g.gi = 0; startPlay(); } });   /* 솔로: 선은 스테이지가 정함 */
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
    if(room.stake && win) d = Math.min(r.final * room.stake, g.mode === 'pvp' ? (g.oppPt ?? Infinity) : Infinity);
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
  /* 첫뻑: 자기 첫 차례에 뻑을 싸면 판돈(점당)의 5배를 상대에게서 바로 받음(점당 100P → 500P). 연습 판은 표시만.
     규칙 상태(S.P[i].fp)를 보고 한 번만 정산 → 다시 맞추기(rebuild)를 해도 두 번 주지 않음 */
  const FP_X = 5;
  function fpCheck(){
    const g = GS(); if(!g || !g.S) return;
    g.fpPaid = g.fpPaid || [0, 0];
    for(const i of [0, 1]){
      if(!g.S.P[i].fp || g.fpPaid[i]) continue;
      g.fpPaid[i] = 1;
      const room = g.room || ROOMS[0], amt = room.stake * FP_X, mine = i === g.me;
      let d = 0;
      if(amt){
        const w = wallet();
        d = mine ? Math.min(amt, g.mode === 'pvp' ? (g.oppPt ?? Infinity) : Infinity) : -Math.min(amt, w.pt);
        w.pt += d; saveW(w);
        if(g.mode === 'pvp' && g.oppPt != null) g.oppPt = Math.max(0, g.oppPt - d);
        g.fpd = (g.fpd || 0) + d;
      }
      banner(`첫뻑!${amt ? ' ' + (d >= 0 ? '+' : '−') + fmtP(Math.abs(d)) : ''}`, mine ? '' : 'bad');
      sfx(mine ? 'gsWin' : 'gsBad'); fxBuzz(mine ? [30, 40, 30] : 60);
      X(() => toast(mine ? (amt ? `첫뻑! 판돈의 ${FP_X}배 ${fmtP(d)}를 받았어요` : '첫뻑! (연습 판이라 포인트는 오가지 않아요)') : (amt ? `${esc(g.oppNick)}님 첫뻑 · ${fmtP(-d)}를 줬어요` : `${esc(g.oppNick)}님 첫뻑!`)));
      faceFor(i, 'joy', 1800); faceFor(1 - i, 'sad', 1800);
      if(g.S && g.phase === 'play') draw(liveView());
    }
  }
  /* 판 도중 나가면 기권 벌점(점당 × 10, 가진 만큼까지) */
  function quitPenalty(){
    const g = GS(); if(!g || !g.inGame || g.paid || !g.room || !g.room.stake) return;
    g.paid = true; const w = wallet(), p = Math.min(w.pt, g.room.stake * 10); w.pt -= p; saveW(w);
    try{ toast(`판 도중에 나가서 ${fmtP(p)}을 잃었어요`); }catch(_){}
  }

  /* ----- 19세 확인 ----- */
  const AGE_KEY = 'hp:age19';
  const ageOk = () => !!store.get(AGE_KEY, 0);
  /* 확인 창은 돌아가는 판(#gsb) 밖에 둔다 → 세로 휴대폰에서도 늘 똑바로 보인다 */
  function gateHtml(){
    return `<div class="gs-gate" id="gsGate" role="dialog" aria-modal="true" aria-labelledby="gsGateT"><div class="gs-gcard"><span class="gs19 big">19</span><b id="gsGateT">19세 이상 이용 게임이에요</b>
      <p>고스톱은 청소년에게 맞지 않는 게임이라 만 19세 이상만 할 수 있어요. 돈이나 상품을 걸 수 없고, 점수는 게임 안에서만 써요.</p>
      <div class="mbtns gs-gbtns"><button class="b2" id="gsAgeN">아니요</button><button class="b1" id="gsAgeY">네, 만 19세 이상이에요</button></div></div></div>`;
  }
  /* 세로 화면이면 "가로로 돌려 주세요" 안내를 한 번(판 밖, 똑바로). 누르거나 2.6초 뒤, 가로로 돌리면 사라짐. 보이기만 함 */
  let turnShown = false;
  function turnHint(){
    try{
      const g = GS(), host = $('#gsg'); if(!g || !host || !g.rot || turnShown) return;
      turnShown = true;
      host.insertAdjacentHTML('beforeend', `<div class="gs-turn" id="gsTurn" role="status"><div class="gs-tcard">
        <svg class="gs-tph" viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="8" width="20" height="36" rx="4" fill="#fff" stroke="#1A0F45" stroke-width="3"/><path d="M48 40a18 18 0 0 1-18 16" fill="none" stroke="#FFE27A" stroke-width="4" stroke-linecap="round"/><path d="M26 52l4 4 4-4" fill="none" stroke="#FFE27A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <b>휴대폰을 옆으로 눕혀 주세요</b><small>그대로 해도 돼요. 판이 옆으로 누워 보여요.</small></div></div>`);
      const el = $('#gsTurn'), off = () => { if(el && el.parentNode){ el.classList.add('out'); setTimeout(() => el.remove(), 250); } };
      el.onclick = off; setTimeout(off, 3200);
      g.turnOff = off;
    }catch(_){}
  }
  /* 공용 대전 방 정보 → 고스톱 방 연결(docs/21 3-7·10-2). o = { room, pl, host, seed, again, round, pace }.
     room은 글자·숫자(방 번호) 또는 { id | code | name, r | rd, host, stake(판 크기 0~4) }. 둘이 같은 o를 받으면 같은 방 이름 → 상대 찾기 없이 바로 마주 앉음.
     판 크기는 room.stake가 없으면 '연습 판'(포인트가 오가지 않음) */
  let linkNext = null;
  /* 사이트 대전 방: o = { room:'fl-d3-r-<코드>-<판>'(중계 방 이름), pl, me, host:이번 판 방장(pl[0]), seed, again, pace, n, lv, nick, info, onFail } → 그 중계 방에 바로 */
  function linkOf(o){
    if(!o || o.room == null || o.room === '') return null;
    const R = o.room, I = o.info && typeof o.info === 'object' ? o.info : (typeof R === 'object' ? R : {});
    const id = typeof R === 'object' ? (R.id != null ? R.id : R.code != null ? R.code : R.name) : R;
    if(id == null || id === '') return null;
    const num = v => typeof v === 'number' && isFinite(v) && v >= 1 ? Math.floor(v) : 0;
    const tail = /-(\d+)$/.exec(String(id));
    const r = num(I.rd) || num(I.r) || num(o.round) || num(o.again) || (tail ? +tail[1] : 0) || 1;
    const host = typeof o.host === 'boolean' ? o.host : typeof I.host === 'boolean' ? I.host : null;
    const sv = typeof I.x === 'number' ? I.x : I.stake, k = typeof sv === 'number' ? Math.max(0, Math.min(4, sv | 0)) : 0;   /* 방장이 정한 점당 금액(roomOpt → info.x) */
    const name = typeof R === 'string' && /^fl-/.test(R) ? R.slice(0, 60) : ('fl-g-r-' + (String(id).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 28) || 'x') + '-' + r).slice(0, 50);
    return { id, r, host, k, name, room:o.info || R, nick:typeof o.nick === 'string' ? o.nick.slice(0, 12) : null, onFail:typeof o.onFail === 'function' ? o.onFail : null };
  }
  function ageGate(go){
    if(ageOk()){ go(); return; }
    openModal(`<div class="gs-mgate"><span class="gs19 big">19</span><h3>19세 이상 이용 게임</h3><p class="note">고스톱은 만 19세 이상만 할 수 있어요. 돈이나 상품을 걸 수 없고, 점수는 게임 안에서만 써요.</p></div>
      <div class="mbtns"><button class="b2" id="mClose">아니요</button><button class="b1" id="mGo">네, 만 19세 이상이에요</button></div>`);
    $('#mClose').onclick = closeModal;
    $('#mGo').onclick = () => { store.set(AGE_KEY, 1); closeModal(); go(); };
  }

  /* ----- 실시간 대전(턴제): 상대 찾기 · 기록 주고받기 -----
     둘만의 방에서 각자 presence.ev에 기록을 쌓는다([판, 번호, 종류, …]). 상대 차례에 기록이 안 오면
     (8초 + 여유 3초, 연결이 끊겼으면 2.5초) 내가 비풍초똥팔삼 자동 수로 대신 두고 그 기록도 올린다 → 상대가 나가도 판 끝까지 진행. */
  function publish(e){
    const g = GS(); if(!g || g.mode !== 'pvp' || !g.nr) return;
    g.ev.push(e);
    g.ev = g.ev.filter(x => x[0] >= g.gi - 1 && !(x[0] === -1 && g.gi >= 1));
    X(() => g.nr.presence({ ev:g.ev, bye:g.bye ? 1 : 0, pt:wallet().pt }).catch(() => {}));
  }
  function searchUI(){
    const g = GS();
    $('#gsBody').hidden = true;
    const box = $('#gsSearch'); box.hidden = false;
    box.innerHTML = `<div class="gs-sc0"><div class="gs-fan">${[3, 17, 30].map((id, i) => `<div class="gs-c" style="--r:${(i - 1) * 14}deg">${cardSvg(id)}</div>`).join('')}</div>
      <h3 id="gsSt">상대를 찾는 중</h3><p class="gs-sroom">${g.room ? g.room.name + ' 방' : ''}</p><p id="gsSn"></p>
      <div class="gs-askb"><button class="pri" id="gsAiNow">컴퓨터와 바로 대전</button></div></div>`;
    $('#gsAiNow').onclick = () => switchAI();
    searchText();
  }
  function searchText(){
    const g = GS(), st = $('#gsSt'), sn = $('#gsSn'); if(!st || !g) return;
    const left = Math.max(0, 20 - Math.floor((Date.now() - g.mmT0) / 1000));
    if(g.link && g.phase === 'joining'){ st.textContent = '방 친구와 연결하는 중'; sn.textContent = g.oppSeen ? esc(g.oppNick) + '님과 판을 까는 중…' : '친구가 들어오면 바로 시작해요'; return; }
    if(g.phase === 'joining'){ st.textContent = '상대를 찾았어요!'; sn.innerHTML = `<b>${esc(g.oppNick)}</b>님과 연결하는 중…`; return; }
    if(g.phase === 'nobody'){ st.textContent = '지금 대전할 상대가 없어요'; sn.textContent = '계속 기다리면 누가 들어올 때 바로 연결해요. 지금 컴퓨터와 겨룰 수도 있어요.'; return; }
    st.textContent = '상대를 찾는 중';
    sn.textContent = `${left}초 · ${duelWaiting(ID) ? '기다리는 사람 ' + duelWaiting(ID) + '명' : '판을 깔고 기다리는 중'} · 내 이름 ${g.nick}`;
  }
  function search(){
    const g = GS(); g.phase = 'search'; g.mmT0 = Date.now(); searchUI();
    const room = ROOM; if(!room){ switchAI(); return; }
    g.dt = Date.now();
    room.presence({ du:'wait', dg:ID, dt:g.dt, nk:g.nick, dp:null, dr:g.room.k, dv:2 }).catch(() => {});
    const check = () => {
      if(GS() !== g || G.over || (g.phase !== 'search' && g.phase !== 'nobody')) return;
      let ps; try{ ps = room.peers(); }catch(_){ return; }
      const me = ps.find(p => p.sameTab); if(!me) return;
      g.myPeer = me.peer;
      const ok = p => p.presence && p.presence.dg === ID && p.presence.dr === g.room.k && p.presence.dv === 2;   /* dv:2 = 연속 판·자동 진행 기록 방식이 같은 판끼리만 */
      const claim = ps.find(p => !p.sameTab && ok(p) && p.presence.du === 'play' && p.presence.dp === me.peer);
      if(claim){ match(claim); return; }
      const list = ps.filter(p => ok(p) && p.presence.du === 'wait' && typeof p.presence.dt === 'number')
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
  function lobbyClear(){ if(ROOM) ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null, dr:null, dv:null }).catch(() => {}); }
  function switchAI(){
    const g = GS(); if(!g || g.began) return;
    stopSearch(); roomClose(); lobbyClear();
    g.mode = 'ai'; G.mode = 'ai'; g.ai = 'normal'; g.oppNick = '컴퓨터 고수'; g.seat = 0;
    if(G.duel){ G.duel.mode = 'ai'; G.duel.opp = { nick:'컴퓨터 고수' }; }
    $('#gsSearch').hidden = true;
    g.seed0 = 'gs:ai:' + g.seedBase + ':' + Date.now();
    sunStart();
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
    g.nr = nr; g.joinT = Date.now(); g.ev = []; g.oev = [];
    nr.presence({ v:2, nk:g.nick, ev:[], bye:0, pt:wallet().pt }).catch(() => {});
    g.seat = g.myPeer < opp.peer ? 0 : 1;
    try{ g.nrUn = nr.onPeers(ch => {
        if(GS() !== g) return;
        if(g.oppSeen && ch.left.some(p => p.peer === g.oppPeer) && !g.began){ matchFail(); return; }
        sync();
      }, () => { if(GS() === g && !G.over && g.began && g.phase !== 'done'){ toast('연결이 끊겨서 대전을 이어 가지 못했어요'); sessionEnd('내 연결이 끊겼어요'); } }); }catch(_){}
    g.syncIv = setInterval(() => { if(GS() === g) sync(); }, 250);
  }
  function matchFail(){ const g = GS(); roomClose(); g.oppSeen = false; if(G.over) return;
    if(g.link){
      const L = g.link; g.link = null;
      if(L.onFail){ G.over = true; try{ HOST.exit(); }catch(_){} try{ L.onFail('join'); }catch(_){} return; }   /* 사이트 방: 방 화면으로 돌아감 */
      toast('방 친구와 연결하지 못했어요 · 컴퓨터와 겨뤄요'); switchAI(); return;
    }
    toast('상대와 연결하지 못했어요. 다시 찾을게요'); search(); }
  /* 대전 방(사이트 방·한 판 더): 상대 찾기 없이 정해진 방에 들어감. 기록 방식(presence v:2 · ev · bye · pt)은 빠른 대전과 같음 */
  async function linkJoin(){
    const g = GS(), L = g && g.link; if(!L) return;
    if(!ROOM){ g.link = null; switchAI(); return; }
    g.phase = 'joining'; g.mmT0 = Date.now(); g.oppPeer = null; g.oppSeen = false; g.oppNick = '상대';
    if(L.nick) g.nick = L.nick;   /* 방에서 쓰는 별명 그대로 */
    searchUI();
    let nr;
    try{ nr = await ROOM.join(L.name); }catch(_){ if(GS() === g) matchFail(); return; }
    if(GS() !== g || g.phase !== 'joining' || G.over){ try{ nr.leave(); }catch(_){} return; }
    g.nr = nr; g.joinT = Date.now(); g.ev = []; g.oev = [];
    try{ const mine = nr.peers().find(p => p.sameTab); if(mine) g.myPeer = mine.peer; }catch(_){}
    nr.presence({ v:2, nk:g.nick, ev:[], bye:0, pt:wallet().pt }).catch(() => {});
    try{ g.nrUn = nr.onPeers(ch => {
        if(GS() !== g) return;
        if(g.oppSeen && ch.left.some(p => p.peer === g.oppPeer) && !g.began){ g.oppSeen = false; g.oppPeer = null; searchText(); return; }
        sync();
      }, () => { if(GS() === g && !G.over && g.began && g.phase !== 'done'){ toast('연결이 끊겨서 대전을 이어 가지 못했어요'); sessionEnd('내 연결이 끊겼어요'); } }); }catch(_){}
    g.syncIv = setInterval(() => { if(GS() === g){ sync(); if(g.phase === 'joining') searchText(); } }, 250);
  }
  function roomClose(){
    const g = GS(); if(!g) return;
    clearInterval(g.syncIv); if(g.nrUn) try{ g.nrUn(); }catch(_){} g.nrUn = null;
    if(g.nr){ const nr = g.nr; g.nr = null; setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
  }
  function oppPres(){
    const g = GS(); if(!g || !g.nr) return null;
    let ps; try{ ps = g.nr.peers(); }catch(_){ return null; }
    const o = ps.find(p => !p.sameTab && (p.peer === g.oppPeer || (p.presence && p.presence.nk === g.oppNick))) || (g.link && !g.began ? ps.find(p => !p.sameTab && p.presence && p.presence.v === 2 && p.presence.nk) : null);
    if(o && o.peer !== g.oppPeer) g.oppPeer = o.peer;   /* 상대가 다시 연결하면 새 peer id */
    return o ? o.presence || {} : null;
  }
  const oppLate = (t0, sec) => (Date.now() - (t0 || 0)) / 1000 > (GS().oppHere ? sec + GRACE : GONE_SEC);
  function sync(){
    const g = GS(); if(!g || G.over || g.mode !== 'pvp' || g.phase === 'done') return;
    const o = oppPres();
    const was = (g.oppHere ? 1 : 0) + (g.oppBye ? 2 : 0);
    if(o && o.nk){ g.oppSeen = true; g.oppHere = true; g.oppGone = 0; if(Array.isArray(o.ev)) g.oev = o.ev; g.oppBye = !!o.bye; }
    else { g.oppHere = false; if(g.oppSeen && !g.oppGone){ g.oppGone = Date.now(); if(g.began) X(() => toast('상대 연결이 끊겼어요 · 판 끝까지 자동으로 대신 쳐요')); } }
    if(!g.began){
      if(g.phase === 'joining' && o && o.nk){
        lobbyClear(); g.mode = 'pvp'; g.oppPt = typeof o.pt === 'number' ? o.pt : 0;
        const a = [g.myPeer, g.oppPeer].map(String).sort();
        g.seed0 = 'gs:pvp:' + a[0] + ':' + a[1];
        if(g.link){
          g.oppNick = String(o.nk).slice(0, 12);
          /* 자리: 방장 정보가 있으면 방장 0번, 없으면 peer 순서. 씨앗 = 방 이름(+ 판 표지) → 두 기기가 같은 패 */
          g.seat = typeof g.link.host === 'boolean' ? (g.link.host ? 0 : 1) : (String(g.myPeer) < String(g.oppPeer) ? 0 : 1);
          g.seed0 = 'gs:room:' + g.link.name;
        }
        $('#gsSearch').hidden = true;
        sunStart();
      } else if(g.phase === 'joining' && Date.now() - g.joinT > (g.link ? 30000 : 9000)) matchFail();
      return;
    }
    if(was !== (g.oppHere ? 1 : 0) + (g.oppBye ? 2 : 0) && g.phase === 'play' && !g.busy && g.S) draw(liveView());
    if(g.phase === 'sun') sunSync();
    else if(g.phase === 'play') playSync();
    else if(g.phase === 'between') nxSync();
  }
  function sunSync(){
    const g = GS(); if(g.sunBusy || !g.sunCards) return;
    const j = g.sunPicks.length; if(j >= 2) return;
    const oe = fe(g.oev, -1, g.sunR * 2 + j);
    if(oe){ sunPick(oe[3], 'opp'); return; }
    if(j !== g.seat && oppLate(g.sunT0, SUN_SEC)) sunPick(sunAuto(), 'proxy');
  }
  function playSync(){
    const g = GS(), S = g.S; if(!S || g.busy) return;
    /* 내 결정인데 상대가 대신 둔 기록이 있고 내가 둔 것과 다르면 → 다시 맞추기 */
    for(const e of g.oev || []) if(Array.isArray(e) && e[0] === g.gi && e[1] < g.k && e[2] <= 1 && g.own[e[1]] && g.src[e[1]] === 'mine' && !sameX(D(e), g.raw[e[1]])){ rebuild(); return; }
    if(S.over) return;
    const k = g.k, p = owner(S), oe = fe(g.oev, g.gi, k);
    if(oe && oe[2] <= 1){ if(p === g.me) X(() => toast('연결이 늦어 상대 쪽에서 자동으로 낸 수로 이어 가요')); step(k, D(oe), 'opp'); return; }
    if(p !== g.me && oppLate(g.stepT0, S.pendingGS >= 0 ? GS_SEC : TURN_SEC)) step(k, autoAct(S, p), 'proxy');
  }
  function cleanup(){
    const g = G && G.gs; if(!g) return;
    quitPenalty();
    clearInterval(g.tIv); clearTimeout(g.turnT); clearTimeout(g.endT); clearInterval(g.mmIv); clearInterval(g.syncIv); clearInterval(g.sunIv); clearInterval(g.nxIv);
    if(g.mmUn) try{ g.mmUn(); }catch(_){}
    if(g.nrUn) try{ g.nrUn(); }catch(_){}
    const nr = g.nr; g.nr = null;
    if(nr) setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1200);
    lobbyClear();
    X(() => GX.clear());
    if(g.onRs){ removeEventListener('resize', g.onRs); removeEventListener('orientationchange', g.onRs); }
    document.body.classList.remove('gs-full');
  }

  /* ----- 시작 ----- */
  function init(cfg, rng, lv){
    const mode = lv === 'pvp' ? 'pvp' : 'ai';
    const n = (store.get('hp:gs:n', 0) || 0) + 1; store.set('hp:gs:n', n);   /* 같은 스테이지라도 판마다 다른 패(문제 공유가 없는 게임) */
    const seedBase = Math.floor(rng() * 1e9) + ':' + n;
    /* 자리(seat): 대전은 peer 순서, AI와는 나 0 · AI 1. 판마다 선 자리(first)가 S의 0번 자리가 된다.
       솔로는 스테이지가 선을 정하고(aiFirst), 대전은 선 뽑기 → 다음 판부터 이긴 사람이 선 */
    G.gs = { mode, ai:cfg.ai || 'normal', me:0, seat:0, first:G.adv && cfg.aiFirst ? 1 : 0, gi:0, sess:!!G.duel && !G.adv, nick:duelNick(), oppNick:mode === 'pvp' ? '상대' : (G.adv ? AI_NAME[cfg.ai] : '컴퓨터 고수'),
      seedBase, ev:[], oev:[], tot:{ n:0, w:0, l:0, d:0, pt:0 }, bye:false, epoch:0, sel:null, busy:false, began:false, inGame:false, phase:'lobby', link:mode === 'pvp' ? linkNext : null };
    G.mode = mode;
    G.cleanup = cleanup;
    /* 아직 19세 확인 전이면 엔진의 첫 도움말을 막아 두고(이미 본 것으로 표시) 확인 뒤에 연다 → 확인 전에는 규칙 창이 뜨지 않음 */
    if(!ageOk() && !store.get('hp:help:' + ID, false)){ store.set('hp:help:' + ID, 1); G.gs.helpAfterGate = true; }
  }
  const AI_NAME = { easy:'컴퓨터 새내기', normal:'컴퓨터 고수', hard:'컴퓨터 타짜' };
  function render(st){
    st.innerHTML = `<div class="gsg" id="gsg"><div class="gsb" id="gsb">
      <div id="gsBody" hidden>
        <div class="gs-tray op"></div><div class="gs-tray me"></div>
        <div class="gs-tag" id="gsTag">${BADGE19}<span>고스톱</span></div>
        <div id="gsCapOp"></div>
        <div class="gs-pts op" id="gsPtsOp"></div>
        <div id="gsFloor"></div><div id="gsDeck"></div>
        <div class="gs-pts me" id="gsPtsMe"></div>
        <div id="gsCapMe"></div>
        <div class="gs-side">
          <div class="gs-prof op" id="gsOpp"></div>
          <div class="gs-info" id="gsInfo"></div>
          <div class="gs-btns"><button id="gsHelpB" aria-label="게임 방법">?</button><button class="out" id="gsOut">${GS() && GS().sess ? '나가기 예약' : '나가기'}</button>${GS() && GS().sess ? '<button class="q" id="gsQuit" aria-label="지금 바로 나가기(기권)">✕</button>' : ''}</div>
          <div class="gs-prof me" id="gsMe"></div>
          <div class="gs-msg" id="gsMsg"></div>
        </div>
        <div id="gsHand"></div>
        <button class="gs-auto" id="gsAuto" aria-label="자동 치기: 알맞은 패를 대신 골라 내요"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="10" width="17" height="26" rx="3" transform="rotate(-12 17 23)" fill="none" stroke="currentColor" stroke-width="3"/><rect x="21" y="9" width="17" height="26" rx="3" transform="rotate(10 30 22)" fill="currentColor"/><path d="M27 17l-3.5 7h5l-3.5 7" fill="none" stroke="#1D2B4F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="rotate(10 30 22)"/></svg><span>자동 치기</span></button>
      </div>
      <div class="gs-ban" id="gsBan" aria-live="polite"></div>
      <div class="gs-search" id="gsSearch" hidden></div>
      <div class="gs-sunb" id="gsSun" hidden></div>
      <div class="gs-ask" id="gsAsk" hidden></div>
    </div><div class="gs-lobby up" id="gsLobby" hidden></div>${ageOk() ? '' : gateHtml()}</div>`;
    document.body.classList.add('gs-full');
    const g0 = GS(); if(g0){ g0.onRs = () => { fit(); const g = GS(); if(g && !g.rot && g.turnOff) g.turnOff(); }; addEventListener('resize', g0.onRs); addEventListener('orientationchange', g0.onRs); }
    fit();
    $('#gsHelpB').onclick = () => openHelp(ID);
    $('#gsOut').onclick = () => { const g = GS(); if(g && g.sess) toggleBye(); else confirmQuit(); };   /* 대전: 누르면 나가기 예약, 다시 누르면 취소 */
    const qb = $('#gsQuit'); if(qb) qb.onclick = () => confirmQuit();   /* 바로 나가기(기권 · 남은 판은 상대 쪽에서 자동으로 끝까지) */
    $('#gsAuto').onclick = () => autoHand();
    const go = () => {
      const g = GS(); if(!g || G.over) return;
      const gate = $('#gsGate'); if(gate) gate.remove();
      lobby();
      if(g.helpAfterGate){ g.helpAfterGate = false; setTimeout(() => { if(GS() === g && !G.over) openHelp(ID, true); }, 60); }
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
    helpExtra:() => [['대전 규칙', '시작 전 선 뽑기(엎어 둔 패를 한 장씩 뒤집어 높은 월이 선, 같으면 다시, 5초 지나면 자동). 내 차례는 8초 — 넘기면 비(12월)·풍(10월)·초(5월)·똥(11월)·팔(8월)·삼(3월) 순서로 자동으로 내요. 한 판이 끝나면 바로 다음 판(이긴 사람이 선). 그만하려면 나가기 예약(다시 누르면 취소), 판 도중 나가거나 끊기면 남은 판은 자동으로 끝까지 진행돼요.'], ['그림 출처', '화투 그림: Marcus Richert(Louie Mantia, Jr.의 Hanafuda 그래픽 기반), Wikimedia Commons, <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ko" target="_blank" rel="noopener">CC BY-SA 4.0</a> 라이선스. 48장을 한 장 그림판으로 합쳐 씀.']],
    help:[
      ['같은 월끼리 먹어요', '내 패 한 장을 내고 더미에서 한 장을 뒤집어요. 바닥에 같은 월(왼쪽 위 숫자)이 있으면 둘 다 가져와요. 손패를 한 번 누르면 바로 내요.'],
      ['7점 나면 고? 스톱?', '광 3장 3점(비광 끼면 2점)·4장 4점·5장 15점 · 열끗 5장 1점(고도리 5점) · 띠 5장 1점(홍단·청단·초단 3점) · 피 10장 1점. 7점이 나면 스톱해서 이기거나, 고를 불러 점수를 더 키워요(1고 +1, 2고 +2, 3고부터 2배씩). 고를 했는데 상대가 먼저 나면 고박!'],
      ['뻑·쪽·따닥·쓸', '뻑: 낸 패와 뒤집은 패가 바닥 패와 같은 월이면 세 장이 바닥에 묶여요(나중에 먹으면 피 1장, 내 뻑이면 2장). 쪽·따닥·쓸을 하면 상대 피 1장을 가져와요. 흔들기·폭탄은 점수 2배, 3뻑·총통은 바로 승리.'],
      ['박과 배수', '피박(상대 피 1~5장)·광박(상대 광 0장)·고박·멍따(열끗 7장+)는 점수 ×2. 둘 다 못 내고 패가 떨어지면 나가리(무승부). 19세 이상 · 돈이나 상품은 걸 수 없어요.']
    ],
    chapters:['동네 사랑방', '시장 골목', '장터 한마당', '명절 큰집', '고수의 방'],
    starRule:'★ 승리 · ★★ 10점 이상으로 승리 · ★★★ 20점 이상으로 승리',
    _pt:{ wallet, ROOMS, ACH, attendance, rescue, freeCharge },
    levels:LV,
    levelDesc:lv => (AI_NAME[lv] || '컴퓨터') + '와 한 판',
    levelCfg(lv){ const k = LV[lv] ? lv : 'normal'; return { name:lv === 'pvp' ? '사람과' : AI_NAME[k], mult:1, [ID]:LV[k] }; },
    stage:n => ({ limit:0, ai:stageLevel(n), aiFirst:aiFirst(n) }),
    stageLevel,
    stageDesc:n => AI_NAME[stageLevel(n)] + '와 맞고 · ' + (aiFirst(n) ? '컴퓨터가 선' : '내가 선') + ' · 이기면 클리어',
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
    duelHow:'1:1 맞고 · 판 크기 고르기 · 19세 이상',
    /* 고스톱은 대전이 따로(턴제 실시간): 같은 문제 동시 풀기 대신 마주 앉아 한 판. fleet:true = 엔진에 "게임이 대전을 직접 진행"이라고 알림 */
    /* o = { pace, room, pl, host, seed, again }(공용 대전 v3). room이 있으면 사이트 방·한 판 더: 판 고르기·상대 찾기 없이 그 방 친구와 바로.
       19세 확인이 먼저(확인 전에는 판·도움말을 만들지 않음). G.duel.room에 받은 방 정보를 그대로 둔다 */
    duelRoom:true,   /* 사이트 대전 방(2명)에서 duelLaunch(o)로 시작할 수 있음 */
    duelNoPts:true,   /* 사이트 대전 포인트·난이도 보상·레벨 제한 없음 — 보유 고스톱 포인트로만 겨룸 */
    duelNoPtsNote:() => '고스톱은 대전 포인트·난이도·레벨이 없어요 · 보유 고스톱 포인트로만 겨뤄요',
    /* 대전 방 만들 때 방장이 고르는 칸(공용 roomOpt): 점당 금액. 방 목록·방 안에 보이고, 보유 포인트가 입장 기준보다 적으면 들어가기·준비가 막힘.
       판이 시작되면 info.x로 넘어와 보유 포인트로 정산(이기면 최종 점수 × 점당, 상대 보유까지) */
    roomOpt:{
      label:'점당 금액',
      def:1,
      opts:() => ROOMS.map(r => ({ v:r.k, name:r.stake ? '1점 ' + fmtP(r.stake) : '연습 판', sub:r.stake ? fmtP(r.min) + ' 이상 보유' : '포인트가 오가지 않아요' })),
      chip:v => { const r = ROOMS[v] || ROOMS[0]; return r.stake ? '점당 ' + fmtP(r.stake) : '연습 판'; },
      can:v => { const r = ROOMS[v] || ROOMS[0], pt = wallet().pt; return pt >= r.min ? '' : `보유 ${fmtP(pt)} · ${fmtP(r.min)} 이상 있어야 들어가요`; },
      note:() => '내 보유 ' + fmtP(wallet().pt)
    },
    duelLaunch(o){ ageGate(() => {
      const live = duelLive(), link = live ? linkOf(o) : null;
      linkNext = link;
      try{ startGame(ID, live ? 'pvp' : 'normal', { duel:{ fleet:true, mode:live ? 'pvp' : 'ai', opp:{ nick:live ? '상대' : '컴퓨터 고수' }, room:link ? link.room : null } }); }
      finally{ linkNext = null; }
    }); },
    /* 시작 전 관문(공용 WP3 startGate): 19세 확인 → 확인된 뒤에만 도움말·판(솔로·대전·모듈 모두). 'gate'는 소리 간격 칸이라 이름이 다르다 */
    startGate(go){ ageGate(go); },
    /* 도움말 v2(공용 WP3): 첫 화면 3줄, 점수 계산 표는 '더 알아보기' */
    howto:{
      /* 도움말 그림(320×180): 화투 그림은 지금 쓰는 패 그림 그대로(새로 그리지 않음). 손패 3월 패를 내서 바닥의 3월 패와 맞춰 먹는 움직임 */
      pic(){
        const card = (id, x, y) => `<svg x="${x}" y="${y}" width="46" height="75" style="width:46px;height:75px" viewBox="${GSART.VB}" overflow="hidden">${cardInner(id)}</svg>`;   /* 판 그림 그대로(크기만 줄임). 도움말 창의 svg 100% 규칙을 style로 막음 */
        const D = '3.2s';
        return `<svg viewBox="0 0 320 180" aria-hidden="true">
          <rect x="4" y="4" width="312" height="172" rx="18" fill="#4FA82E" stroke="#1F5A12" stroke-width="3"/>
          <rect x="16" y="14" width="288" height="86" rx="14" fill="rgba(8,46,4,.22)"/>
          ${card(20, 40, 20)}${card(41, 236, 20)}
          <g>${card(8, 137, 20)}<rect x="135" y="18" width="50" height="79" rx="8" fill="none" stroke="#FFC93C" stroke-width="4" opacity="0"><animate attributeName="opacity" dur="${D}" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;.5;.55;.85;1"/></rect></g>
          ${card(33, 70, 104)}${card(45, 200, 104)}
          <g><animateTransform attributeName="transform" type="translate" dur="${D}" repeatCount="indefinite" values="0 0;0 0;14 -80;14 -80;0 0" keyTimes="0;.2;.5;.9;1"/>
            <rect x="133" y="102" width="50" height="79" rx="8" fill="none" stroke="#FFC93C" stroke-width="4"><animate attributeName="opacity" dur="${D}" repeatCount="indefinite" values="1;1;0;0;1" keyTimes="0;.2;.3;.9;1"/></rect>${card(9, 135, 104)}</g>
        </svg>`;
      },
      /* 3줄은 글자열(줄마다 24자 이하, games/CLAUDE.md howto 계약) */
      lines:['같은 달 패를 맞춰 먹어요', '점수가 나면 고 또는 스톱', '많이 낸 쪽이 이겨요'],
      more:null
    },
    sounds:Object.assign({
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
    }, GX.sounds || {}),
    gate:Object.assign({ gsSlap:40, gsPick:30, gsFlip:40, gsCap:60 }, GX.gate || {}),
    /* 점검·도구용(화면에는 안 씀) */
    _fp:() => fpCheck(),   /* 점검 도구용: 첫뻑 정산 한 번 돌리기 */
    _rules:{ C, gsDeal, gsApply, gsGoStop, scoreOf, tally, aiPick, aiGo, cloneS, autoAct },
    _card:id => cardSvg(id), _back:BACK
  };
})();
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.gostop.scene = { kind:'petals', colors:['#FFC2D3', '#FFE27A', '#FFFFFF'], density:.6 };
/* 도움말 v2 '더 알아보기' = 예전 도움말 칸(점수 계산 표 등) 그대로 */
NG.gostop.howto.more = NG.gostop.help.slice();
