/* ===== 두더지 땅땅 (mole) · 하루퍼즐 리그 순발력 게임 =====
   잔디 들판 구멍에서 두더지가 쏙 올라온다. 두더지만 치고, 폭탄 두더지는 참는다(막 누르면 손해).
   - 한 판 = 두더지 N마리(물결마다 1~3마리). 같은 씨앗 = 같은 물결·구멍·두더지 종류·순서(rng만 씀).
   - 판단 창 = 두더지가 나와 있는 시간. 일반 두더지를 놓치면 점수만 없음(기회 그대로), 폭탄을 치면 기회 −1.
   - 빈 구멍 누르기 = −5점 + 0.4초 망치 멍. 0.25초 안에 3번 넘게 마구 누르면 "천천히!" 0.5초 잠금(벌점 없음).
   - 그림(두더지·구멍·망치)은 모두 직접 그린 오리지널, 공용 캐릭터와 같은 3D 비닐 장난감 질감(TOY 필터 재사용).
   기획서: docs/20_순발력5종_기획.md (2-2) */
NG.mole = (() => {
  const ID = 'mole';
  const HOSTS = ['frog', 'chick', 'owl', 'bear', 'dog'];          /* 챕터 진행자(판 위 심판) */
  const PEEK = .5, PEEK_GAP = .2;                                  /* 숨바꼭질: 처음 쏙 보이는 시간, 옆 구멍으로 옮기는 틈 */
  const EMPTY_PTS = 5, STUN = .4, SPAM_N = 3, SPAM_WIN = .25, SPAM_LOCK = .5;
  const COMBO_MSG = { 5:'좋아요!', 10:'대단해요!', 20:'완벽해요!' };

  /* ===== 솔로 개념 사이클 ===== */
  const CONC = {
    order:['helmet', 'gold', 'order', 'hide'],
    info:{
      helmet:{ name:'헬멧 두더지', desc:'노란 헬멧을 쓴 두더지는 두 번 쳐야 잡혀요. 한 번 치면 헬멧이 날아가요.' },
      gold:{ name:'황금 두더지', desc:'왕관을 쓴 황금 두더지는 아주 잠깐만 나와요. 잡으면 정답 2개로 쳐요!' },
      order:{ name:'번호 두더지', desc:'번호표를 단 두더지가 한꺼번에 나오면 1, 2, 3 순서대로 쳐요. 순서가 틀리면 실수예요.' },
      hide:{ name:'숨바꼭질', desc:'잎사귀를 쓴 두더지는 한 번 쏙 보였다가 옆 구멍에서 다시 나와요. 처음 보일 때 치면 빗나가요.' }
    },
    twists:['flash', 'dark', 'tight'],
    twInfo:{
      flash:{ name:'번개', desc:'두더지가 더 짧게 나와요. 침착하게, 그리고 재빨리!' },
      dark:{ name:'밤의 들판', desc:'들판이 어두워져요. 두더지가 나올 때만 구멍에 불이 켜져요.' },
      tight:{ name:'외줄 타기', desc:'기회가 2개뿐이에요. 폭탄 두더지를 특히 조심해요.' }
    }
  };
  const RULE_TIP = { helmet:'헬멧은 두 번', gold:'황금은 재빨리', order:'번호 순서대로', hide:'처음 쏙은 가짜', flash:'짧게 나와요', dark:'불 켜진 구멍', tight:'기회 2개' };

  /* ===== 솔로 스테이지 설정(planOf 개념 사이클) ===== */
  const KN = [12, 13, 14, 15, 17, 13, 15, 16, 12, 18];             /* 챕터 1 자리별 두더지 수(보스는 여기에 +6) */
  function stageCfg(n){
    const p = planOf(ID, n), c = p.c, k = p.k, g = Math.min(c, 8);
    let N = Math.min(32, KN[k - 1] + 2 * (c - 1)); if(p.boss) N += 6;
    let w0 = 2.5 * Math.pow(.94, g - 1);
    if(p.hard) w0 *= .9; if(p.boss) w0 *= .85; if(k === 9) w0 *= 1.15; if(k === 1 || k === 6) w0 *= 1.08;
    if(p.tw === 'flash') w0 *= .8;
    w0 = Math.max(1.05, w0);
    const w1 = Math.max(.9, w0 * .78);
    let trap = .1 + .075 * (Math.min(c, 5) - 1);
    if(p.boss) trap += .1; if(k === 9) trap -= .05; if(k === 1 || k === 6) trap -= .03;
    trap = Math.max(.08, Math.min(.5, trap));
    const boss = p.boss, cols = boss ? 4 : 3, rows = boss ? 4 : c >= 3 ? 4 : 3;
    return { N, w0:+w0.toFixed(3), w1:+w1.toFixed(3), trap:+trap.toFixed(3), cols, rows, maxPer:c === 1 && !boss ? 2 : 3,
      target:Math.min(.7, .6 + .02 * (c - 1)), lives:p.tw === 'tight' ? 2 : 3, limit:0,
      mj:p.mj.slice(), tw:p.tw, boss, hard:p.hard, ch:((c - 1) % 5) + 1, host:HOSTS[(c - 1) % 5], intro:p.intro };
  }
  const LV = {
    easy:{ N:20, w0:2.6, w1:2.0, trap:.15, cols:3, rows:3, maxPer:2, target:.6, lives:3, limit:0, ch:1, host:'chick' },
    normal:{ N:25, w0:2.2, w1:1.5, trap:.25, cols:3, rows:3, maxPer:3, target:.65, lives:3, limit:0, ch:2, host:'frog' },
    hard:{ N:30, w0:1.9, w1:1.2, trap:.35, cols:3, rows:4, maxPer:3, target:.7, lives:3, limit:0, ch:4, host:'owl' }
  };

  /* ===== 판 만들기(rng만) =====
     물결 = { gap, moles:[{ hole, kind, num?, peek?, delay, win }] }. kind: normal·bomb·helmet·gold·num·hide */
  function gen(cfg, rng){
    const H = cfg.cols * cfg.rows, N = cfg.N, mj = cfg.mj || [], has = k => mj.includes(k);
    const PK = { helmet:.22, gold:.13, hide:.2 };                     /* 켜진 개념 두더지 몫(전체 두더지 기준) */
    const pickW = (list, n, wf) => list.map(x => [x, Math.pow(rng(), 1 / Math.max(.01, wf(x)))]).sort((a, b) => b[1] - a[1]).slice(0, n).map(a => a[0]);
    const nbr = h => { const x = h % cfg.cols, y = Math.floor(h / cfg.cols), o = [];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const a = x + dx, b = y + dy; if(a >= 0 && b >= 0 && a < cfg.cols && b < cfg.rows) o.push(b * cfg.cols + a); }); return o; };
    /* 1) 물결 크기(1~3마리, 뒤로 갈수록 여럿). 번호 물결은 2~3마리 */
    const W = []; let made = 0;
    const orderWant = has('order') ? Math.max(2, Math.round(N / 11)) : 0;
    while(made < N){
      const t = N > 1 ? made / (N - 1) : 0, left = N - made;
      let per = 1, order = false;
      if(W.length){
        if(orderWant && left >= 2 && rng() < .3){ order = true; per = cfg.maxPer >= 3 && left >= 3 && rng() < .5 ? 3 : 2; }
        else {
          if(cfg.maxPer >= 2 && rng() < .3 + .35 * t) per++;
          if(cfg.maxPer >= 3 && per === 2 && rng() < .15 + .35 * t) per++;
        }
      }
      per = Math.min(per, left); if(per < 2) order = false;
      W.push({ per, order, t, gap:.35 + rng() * .25 }); made += per;
    }
    /* 번호 물결이 모자라면 2마리 이상 물결을 번호 물결로 */
    if(orderWant){ let have = W.filter(w => w.order).length;
      for(const w of pickW(W.filter(w => !w.order && w.per >= 2), Math.max(0, orderWant - have), () => 1)){ w.order = true; } }
    /* 2) 자리(두더지 하나하나): 폭탄은 정해진 개수(함정 비율 × N)를 뒤쪽에 더 많이 */
    const slots = [];
    W.forEach((w, wi) => { for(let i = 0; i < w.per; i++) slots.push({ wi, i, t:w.t, kind:w.order ? 'num' : 'normal' }); });
    const free0 = slots.filter(s => s.kind === 'normal' && s.wi > 0);
    const B = Math.min(free0.length, Math.round(cfg.trap * N));
    pickW(free0, B, s => .55 + .9 * s.t).forEach(s => { s.kind = 'bomb'; });
    /* 3) 켜진 개념 두더지(헬멧·황금·숨바꼭질)를 남은 일반 자리에 */
    for(const k of ['helmet', 'gold', 'hide']){
      if(!has(k)) continue;
      const cand = slots.filter(s => s.kind === 'normal' && s.wi > 0), want = Math.min(cand.length, Math.max(2, Math.round(PK[k] * N)));
      const early = pickW(cand.filter(s => s.wi <= 3), 1, () => 1);   /* 첫 번째는 판 앞쪽(2~4번째 물결)에서 바로 보이게 */
      early.forEach(s => { s.kind = k; });
      const used = new Set(early.map(s => s.wi));                      /* 나머지는 서로 다른 물결에 흩어지게 */
      pickW(cand.filter(s => s.kind === 'normal'), want - early.length, s => used.has(s.wi) ? .25 : 1).forEach(s => { s.kind = k; });
    }
    /* 4) 구멍·시간 */
    const waves = W.map((w, wi) => {
      const win = cfg.w0 + (cfg.w1 - cfg.w0) * w.t;
      const free = shuffle(Array.from({ length:H }, (_, i) => i), rng);
      const ss = slots.filter(s => s.wi === wi), moles = [];
      if(w.order){
        const nums = shuffle(ss.map((_, i) => i + 1), rng);   /* 나오는 순서와 번호 순서가 다르게 */
        nums.forEach((num, i) => moles.push({ hole:free.shift(), kind:'num', num, delay:+(i * .09).toFixed(3), win:+(win * 1.15 + .3 * ss.length).toFixed(3) }));
      } else {
        let d = 0;
        ss.forEach((s, i) => {
          if(i) d += .1 + rng() * .25;
          const mo = { hole:free.shift(), kind:s.kind, delay:+d.toFixed(3), win };
          if(s.kind === 'helmet') mo.win = win * 1.3;
          if(s.kind === 'gold') mo.win = Math.max(.7, win * .55);
          if(s.kind === 'hide'){   /* 처음엔 peek 구멍에서 쏙, 그다음 옆 구멍(hole)에서 진짜로 */
            mo.peek = mo.hole;
            const nb = nbr(mo.peek).filter(h => free.includes(h));
            const pick = nb.length ? nb[Math.floor(rng() * nb.length)] : free[0];
            free.splice(free.indexOf(pick), 1); mo.hole = pick;
          }
          moles.push(mo);
        });
        if(moles.every(x => x.kind === 'bomb')) moles.forEach(x => { x.win *= .85; });
        moles.forEach(x => { x.win = +x.win.toFixed(3); });
      }
      return { gap:+w.gap.toFixed(3), moles };
    });
    return { waves, N:slots.length, holes:H };
  }

  /* ===== 그림(디자인팀): 두더지·구멍·망치. 공용 TOY 필터(pb·pm·ps·gl·gs)로 3D 비닐 장난감 질감 ===== */
  const uri = (vb, body, defs = '') => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${TOY.DEFS}${defs}</defs>${body}</svg>`).replace(/'/g, '%27');
  const PAL = {
    normal:{ b:'#B8733F', belly:'#F4D6B2', muz:'#F7E0C8', nose:'#FF6F8E', paw:'#FFB3A6', cheek:'#FF8E9E', ink:'#4A2616' },
    bomb:{ b:'#77708F', belly:'#CFC9E0', muz:'#E0DBEC', nose:'#433D5C', paw:'#BDB4D2', cheek:'#A79BC8', ink:'#2A2440' },
    gold:{ b:'#F2B21C', belly:'#FFF1B8', muz:'#FFF6D6', nose:'#FF7E5A', paw:'#FFD580', cheek:'#FF9E6A', ink:'#6A3C00' }
  };
  const VB = '0 -22 100 122';
  function eyes(face, P){
    if(face === 'hit') return `<path d="M34 40l9 5-9 5M66 40l-9 5 9 5" fill="none" stroke="${P.ink}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(face === 'boom') return `<path d="M34 40l8 8M42 40l-8 8M58 40l8 8M66 40l-8 8" stroke="${P.ink}" stroke-width="3.4" stroke-linecap="round"/>`;
    return TOY.EYE(39, 44, 4.8) + TOY.EYE(61, 44, 4.8);
  }
  function mouth(face, P){
    if(face === 'hit') return `<ellipse cx="50" cy="66.5" rx="4" ry="4.6" fill="#5A1E2E"/>`;
    if(face === 'boom') return `<path d="M42 67q4-3 8 0t8 0" fill="none" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    if(face === 'grr') return `<path d="M43 66q7-3.5 14 0" fill="none" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M46.5 65.6h7v4.6a1.4 1.4 0 0 1-1.4 1.4h-4.2a1.4 1.4 0 0 1-1.4-1.4z" fill="#fff"/>`;
    return `<path d="M43 63.5q7 4.5 14 0" fill="none" stroke="${P.ink}" stroke-width="2.3" stroke-linecap="round"/><path d="M46.6 65.2h6.8v5.2a1.4 1.4 0 0 1-1.4 1.4h-4a1.4 1.4 0 0 1-1.4-1.4z" fill="#fff"/><path d="M50 65.4v6.2" stroke="#E2D5C4" stroke-width="1"/>`;
  }
  function moleSvg(kind, face){
    const P = PAL[kind === 'bomb' ? 'bomb' : kind === 'gold' ? 'gold' : 'normal'];
    const dark = kind === 'bomb';
    let s = `<g filter="url(#pb)"><path d="M15 104V56C15 29 30 12 50 12s35 17 35 44v48z" fill="${P.b}"/></g>${TOY.GL(35, 31, 12, 7)}
      <g filter="url(#pm)"><ellipse cx="50" cy="90" rx="23" ry="19" fill="${P.belly}"/><circle cx="23" cy="30" r="6.5" fill="${P.b}"/><circle cx="77" cy="30" r="6.5" fill="${P.b}"/></g>
      ${eyes(face, P)}
      ${face === '' && dark ? `<path d="M31 35.5l13 4.5M69 35.5l-13 4.5" stroke="${P.ink}" stroke-width="3.4" stroke-linecap="round"/>` : ''}
      ${TOY.CHEEK(29, 59, P.cheek)}${TOY.CHEEK(71, 59, P.cheek)}
      <g filter="url(#pm)"><ellipse cx="50" cy="60" rx="14.5" ry="10.5" fill="${P.muz}"/></g>
      <g filter="url(#ps)"><ellipse cx="50" cy="54.5" rx="7.6" ry="5.8" fill="${P.nose}"/></g><ellipse cx="47.5" cy="52.6" rx="2.6" ry="1.6" fill="#fff" opacity=".75"/>
      ${mouth(dark && face === '' ? 'grr' : face, P)}
      <path d="M33 58l-12-2M33 62l-11 2M67 58l12-2M67 62l11 2" stroke="${P.ink}" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>
      <g filter="url(#pm)"><ellipse cx="24" cy="86" rx="10.5" ry="8" fill="${P.paw}"/><ellipse cx="76" cy="86" rx="10.5" ry="8" fill="${P.paw}"/></g>
      <path d="M19 82v4M24 81v5M29 82v4M71 82v4M76 81v5M81 82v4" stroke="${P.ink}" stroke-width="1.5" stroke-linecap="round" opacity=".35"/>`;
    if(kind === 'bomb' && face === '') s += `<g filter="url(#pb)"><circle cx="50" cy="3" r="16" fill="#2D2944"/></g>${TOY.GL(43, -4, 6, 4)}
      <g filter="url(#ps)"><rect x="44.5" y="-16" width="11" height="7" rx="2.2" fill="#9C96B8"/></g>
      <path d="M50 -16q2-6 9-6" fill="none" stroke="#D6B178" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M61 -28l2.2 4.6 5-1-3.2 3.9 3.2 3.9-5-1-2.2 4.6-2.2-4.6-5 1 3.2-3.9-3.2-3.9 5 1z" fill="#FFD23F"/><circle cx="61" cy="-21" r="2.6" fill="#FF6A2B"/>
      <path d="M41 9l4-4M46 12l3-3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".35"/>`;
    if(kind === 'bomb' && face === 'boom') s += `<g fill="#3A3550" opacity=".55"><circle cx="38" cy="22" r="4"/><circle cx="60" cy="18" r="5"/><circle cx="48" cy="28" r="3"/></g>`;
    if(kind === 'gold') s += `<g filter="url(#pm)"><path d="M35 17l3.5-17 11.5 10 11.5-10 3.5 17z" fill="#FFE36A"/></g><g filter="url(#ps)"><circle cx="50" cy="9" r="3" fill="#FF5C8A"/><circle cx="39" cy="4" r="2" fill="#5FB8FF"/><circle cx="61" cy="4" r="2" fill="#5FB8FF"/></g>
      <path d="M86 20l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6zM13 40l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#FFFBE0"/>`;
    if(kind === 'hide') s += `<g filter="url(#pm)"><path d="M50 13c-1-13 7-21 20-21-1 13-9 20-20 21z" fill="#38B657"/><path d="M50 13c-5-9-13-12-22-9 2 9 11 13 22 9z" fill="#62D46F"/></g><path d="M50 13c3-8 9-13 17-17" stroke="#1E7A35" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>`;
    return uri(VB, s);
  }
  const helmSvg = () => uri(VB, `<g filter="url(#pb)"><path d="M17 36C17 13 32 0 50 0s33 13 33 36z" fill="#FFC21A"/></g>${TOY.GL(36, 13, 11, 5)}
    <g filter="url(#pm)"><rect x="10" y="31" width="80" height="9" rx="4.5" fill="#FFA70F"/></g><g filter="url(#ps)"><path d="M50 2v28" stroke="#FFE07A" stroke-width="7" stroke-linecap="round"/></g>`);
  /* 구멍: 뒤(흙 둔덕 + 어두운 구멍)·앞(앞 테두리 흙 + 풀). 칸 좌표 100×92 */
  const pitSvg = () => uri('0 0 100 92', `<ellipse cx="50" cy="70" rx="49" ry="17" fill="#1E3A12" opacity=".16"/>
    <g filter="url(#pb)"><ellipse cx="50" cy="65" rx="47" ry="18.5" fill="url(#hm)"/></g>
    <ellipse cx="50" cy="64" rx="40" ry="13" fill="url(#hp)"/>
    <path d="M11 62.5A40 13 0 0 1 89 62.5" fill="none" stroke="#5B3820" stroke-width="2.4" opacity=".55"/>`,
    `<radialGradient id="hp" cx=".5" cy=".85" r=".75"><stop offset="0" stop-color="#140B07"/><stop offset=".65" stop-color="#2B190F"/><stop offset="1" stop-color="#4B2E1B"/></radialGradient>
     <linearGradient id="hm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D49563"/><stop offset="1" stop-color="#A86C40"/></linearGradient>`);
  const lipSvg = () => uri('0 0 100 92', `<g filter="url(#pm)"><path d="M10 64A40 13 0 0 0 90 64L97 65.5A47 18.5 0 0 1 3 65.5Z" fill="url(#lm)"/></g>
    <path d="M12 66.5A40 13 0 0 0 88 66.5" fill="none" stroke="#E8B488" stroke-width="1.6" opacity=".7"/>
    <g fill="#4DAE3C"><path d="M9 80q-3-7 1-11 0 6 3 9 0-7 4-10-1 7 0 12z"/><path d="M84 81q0-7 4-10 0 5 2 8 1-6 5-8-2 7-3 11z"/><path d="M47 87q-1-5 2-8 0 4 2 6 1-4 4-5-2 5-2 8z"/></g>
    <g fill="#7AD35A"><path d="M11 79q-1-5 1-8 0 4 2 6z"/><path d="M87 80q1-5 3-7 0 4 1 6z"/></g>`,
    `<linearGradient id="lm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C58652"/><stop offset="1" stop-color="#9A6038"/></linearGradient>`);
  const hamSvg = () => uri('0 0 100 100', `<g filter="url(#pm)"><path d="M47 45l38 38a5 5 0 0 1-7 7L40 52z" fill="#E0A25E"/></g>
    <g transform="rotate(-45 34 34)"><g filter="url(#pb)"><rect x="6" y="18" width="56" height="32" rx="12" fill="#FF5A7E"/></g>${TOY.GL(20, 26, 12, 4, 0)}
    <g filter="url(#pm)"><rect x="2" y="16" width="11" height="36" rx="5" fill="#FFC2D0"/><rect x="55" y="16" width="11" height="36" rx="5" fill="#FFC2D0"/></g></g>`);
  let SPR = null;
  function sprites(){
    if(SPR) return SPR;
    SPR = { pit:pitSvg(), lip:lipSvg(), ham:hamSvg(), helm:helmSvg() };
    ['normal', 'bomb', 'gold', 'hide'].forEach(k => { SPR[k] = moleSvg(k, ''); SPR[k + '_hit'] = moleSvg(k, k === 'bomb' ? 'boom' : 'hit'); });
    return SPR;
  }
  const sprOf = (kind, face) => { const S = sprites(), k = kind === 'helmet' || kind === 'num' ? 'normal' : kind; return S[face ? k + '_hit' : k]; };

  /* ===== 진행 ===== */
  const S = () => G && G.id === ID ? G.m : null;
  const T = (fn, ms) => { const m = S(); if(!m) return; const id = setTimeout(() => { m.timers.delete(id); try{ fn(); }catch(_){} }, ms); m.timers.add(id); };
  const running = m => m && !G.over && !G.paused && !(G.duel && !G.duel.go);
  const cellEl = i => document.querySelector(`.ng-mole .ml-cell[data-i="${i}"]`);
  const fx = fn => { try{ fn(); }catch(_){} };

  function say(main, sub, cls){
    const e = $('#mlSay'); if(!e) return;
    e.className = 'ml-say' + (cls ? ' ' + cls : '');
    e.innerHTML = `<b>${main}</b>${sub ? `<span>${sub}</span>` : ''}`;
    void e.offsetWidth; e.classList.add('pop');
  }
  function mood(md, ms){
    const m = S(), im = $('#mlHost'); if(!m || !im) return;
    im.src = toySrc(m.host, md || '');
    clearTimeout(m.moodT); if(md && ms) m.moodT = setTimeout(() => { const i2 = $('#mlHost'); if(i2 && S() === m && !m.done) i2.src = toySrc(m.host, ''); }, ms);
    if(md) fx(() => { if(!FXR.reduce && im.animate) im.animate([{ transform:'translateY(0) scale(1)' }, { transform:'translateY(-6px) scale(1.06,.96)', offset:.35 }, { transform:'translateY(0) scale(1)' }], { duration:380, easing:'cubic-bezier(.2,1.5,.4,1)' }); });
  }
  function hud(){
    const m = S(); if(!m) return;
    const set = (id, v) => { const e = $('#' + id); if(e) e.textContent = v; };
    set('mlOk', m.correct); set('mlLeft', m.N - m.shown); set('mlCombo', m.combo);
    const okc = $('#mlOkP'); if(okc) okc.classList.toggle('goal', m.correct >= m.need);
    const lv = $('#mlLives');
    if(lv){ lv.innerHTML = '기회 ' + Array.from({ length:m.maxLives }, (_, n) => `<i${n >= m.lives ? ' class="off"' : ''}>★</i>`).join(''); lv.classList.toggle('last', m.lives === 1); lv.setAttribute('aria-label', '남은 기회 ' + m.lives + '개'); }
    G.paws = m.lives;
  }
  function playSub(m){
    if(m.tips.length) return m.tips.join(' · ');
    return '폭탄 두더지는 참아요';
  }

  /* ---- 두더지 보이기(transform만 → 60fps) ---- */
  function anim(el, frames, o){ if(!el) return null; try{ if(el._an) el._an.cancel(); }catch(_){} if(!el.animate){ return null; } const a = el.animate(frames, Object.assign({ fill:'forwards' }, o)); el._an = a; return a; }
  function showMole(r, hole, peek){
    const c = cellEl(hole); if(!c) return;
    const mo = c.querySelector('.ml-mole'), img = mo.querySelector('.ml-img'), helm = mo.querySelector('.ml-helm'), num = mo.querySelector('.ml-num');
    img.src = sprOf(r.kind, false);
    helm.hidden = r.kind !== 'helmet'; if(r.kind === 'helmet'){ try{ if(helm._an) helm._an.cancel(); }catch(_){} helm.style.opacity = ''; }
    num.hidden = r.kind !== 'num'; if(r.kind === 'num'){ num.textContent = r.num; num.dataset.n = r.num; }
    c.dataset.k = peek ? 'peek' : r.kind; c.classList.add('lit'); c.classList.toggle('danger', r.kind === 'bomb' && !peek);
    c.classList.remove('done-ok', 'done-x');
    const reduce = FXR.reduce;
    if(peek) anim(mo, [{ transform:'translateY(102%)' }, { transform:'translateY(36%) scale(1.04,.96)', offset:.7 }, { transform:'translateY(40%)' }], { duration:reduce ? 1 : 200, easing:'cubic-bezier(.3,1.4,.5,1)' });
    else anim(mo, [{ transform:'translateY(102%) scale(.92,1.05)' }, { transform:'translateY(-7%) scale(.93,1.09)', offset:.55 }, { transform:'translateY(1.5%) scale(1.05,.95)', offset:.8 }, { transform:'translateY(0) scale(1,1)' }], { duration:reduce ? 1 : 240, easing:'cubic-bezier(.25,.9,.35,1)' });
    fx(() => { const q = fxCenter(c); sfx(peek ? 'molePeek' : 'molePop', { pan:panX(q.x) }); });
  }
  function hideMole(hole, how){
    const c = cellEl(hole); if(!c) return;
    const mo = c.querySelector('.ml-mole'), reduce = FXR.reduce;
    if(how === 'hit') anim(mo, [{ transform:'translateY(0) scale(1,1)' }, { transform:'translateY(9%) scale(1.17,.76)', offset:.14 }, { transform:'translateY(6%) scale(.97,1.04)', offset:.3 }, { transform:'translateY(8%) scale(1.03,.97)', offset:.5 }, { transform:'translateY(104%) scale(.95,1.04)' }], { duration:reduce ? 1 : 560, easing:'cubic-bezier(.45,0,.55,1)' });
    else anim(mo, [{ transform:getComputedStyle(mo).transform === 'none' ? 'translateY(0)' : getComputedStyle(mo).transform }, { transform:'translateY(104%) scale(1.04,.94)' }], { duration:reduce ? 1 : 200, easing:'cubic-bezier(.55,0,.8,.4)' });
    const ms = how === 'hit' ? 520 : 180;
    T(() => { const c2 = cellEl(hole); if(c2 && c2._r === undefined){ c2.classList.remove('lit', 'danger'); delete c2.dataset.k; } }, ms);
  }
  function stamp(hole, ok){
    const c = cellEl(hole); if(!c) return;
    const s = c.querySelector('.ml-stamp'); if(!s) return;
    s.className = 'ml-stamp ' + (ok ? 'ok' : 'x'); s.innerHTML = ok ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    void s.offsetWidth; s.classList.add('on');
  }
  function hammer(hole, kind){
    const c = cellEl(hole), h = $('#mlHam'), f = $('#mlField'); if(!c || !h || !f) return;
    const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const cw = cr.width, yb = (cr.height - cw * .92) / 2;   /* 망치 머리가 두더지 머리 위에 떨어지게(회전 중심 84% 88%) */
    h.style.left = (cr.left - fr.left + cw * .37) + 'px'; h.style.top = (cr.top - fr.top + yb - cw * .19) + 'px';
    const reduce = FXR.reduce;
    anim(h, kind === 'whiff'
      ? [{ transform:'rotate(38deg)', opacity:1 }, { transform:'rotate(-6deg)', opacity:1, offset:.3 }, { transform:'rotate(-2deg) translateY(2px)', opacity:1, offset:.55 }, { transform:'rotate(8deg)', opacity:0 }]
      : [{ transform:'rotate(40deg)', opacity:1 }, { transform:'rotate(-16deg)', opacity:1, offset:.28 }, { transform:'rotate(-8deg)', opacity:1, offset:.5 }, { transform:'rotate(10deg)', opacity:0 }],
      { duration:reduce ? 120 : 300, easing:'cubic-bezier(.3,.7,.4,1)' });
  }
  function floatAt(hole, html, cls){
    fx(() => { const c = cellEl(hole); if(!c) return; const q = fxCenter(c); const d = fxFloat(q.x, q.y - q.h * .35, html, 'ml-float ' + (cls || '')); });
  }

  /* ---- 물결 시작·진행 ---- */
  function startWave(m, wi){
    m.wi = wi; m.phase = 'wave';
    const w = m.waves[wi];
    m.act = w.moles.map(x => Object.assign({}, x, { st:'wait', at:m.t + x.delay, upAt:0, endAt:0, goneAt:0, res:null, helm:x.kind === 'helmet', wave:wi }));
  }
  function cellMole(m, hole){ return m.act.find(r => (r.st === 'up' || r.st === 'hitting') && r.hole === hole) || m.act.find(r => (r.st === 'peek' || r.st === 'pwait') && r.peek === hole) || null; }
  function setCell(hole, r){ const c = cellEl(hole); if(c){ if(r) c._r = r; else delete c._r; } }
  function goUp(m, r){
    r.st = 'up'; r.upAt = m.t; r.endAt = m.t + r.win; m.shown++;
    setCell(r.hole, r); showMole(r, r.hole, false); hud();
  }
  function gone(m, r, res, how){
    r.st = 'gone'; r.res = res; r.goneAt = m.t; m.judged++;
    setCell(r.hole, null); hideMole(r.hole, how);
  }
  function resolveTimeout(m, r){
    if(r.kind === 'bomb'){ m.correct++; m.sumFr += 1; m.resist++; gone(m, r, 'resist', 'down'); fx(() => { const c = cellEl(r.hole); if(c){ const q = fxCenter(c); sfx('moleResist', { pan:panX(q.x) }); } }); floatAt(r.hole, '참았다!', 'calm'); }
    else { m.missed++; gone(m, r, 'miss', 'down'); }
    hud();
  }
  function step(m){
    const t = m.t;
    if(m.phase === 'intro'){
      if(t >= m.next){ say('시작!', playSub(m)); sfx('moleGo'); startWave(m, 0); }
      return;
    }
    if(m.phase === 'gap'){ if(t >= m.next) startWave(m, m.wi + 1); return; }
    if(m.phase !== 'wave') return;
    const others = m.act.filter(r => r.kind !== 'bomb');
    const nonBombDone = others.length && others.every(r => r.st === 'gone');
    for(const r of m.act){
      if(r.st === 'wait' && t >= r.at){
        if(r.kind === 'hide'){ r.st = 'peek'; r.peekEnd = t + PEEK; setCell(r.peek, r); showMole(r, r.peek, true); }
        else goUp(m, r);
      } else if(r.st === 'peek' && t >= r.peekEnd){
        r.st = 'pwait'; r.at2 = t + PEEK_GAP; setCell(r.peek, null); hideMole(r.peek, 'down');
      } else if(r.st === 'pwait' && t >= r.at2) goUp(m, r);
      else if(r.st === 'up'){
        if(r.kind === 'bomb' && nonBombDone) r.endAt = Math.min(r.endAt, Math.max(t + .2, r.upAt + .6));   /* 칠 두더지가 다 끝나면 폭탄도 곧 들어감 */
        if(t >= r.endAt) resolveTimeout(m, r);
      }
    }
    if(m.done) return;
    if(m.act.every(r => r.st === 'gone') && t >= Math.max(...m.act.map(r => r.goneAt)) + .25){
      if(m.wi + 1 < m.waves.length){ m.phase = 'gap'; m.next = t + m.waves[m.wi].gap; }
      else end(m);
    }
  }
  function bars(m){
    const t = m.t; let best = null;
    for(const r of m.act){
      if(r.st !== 'up') continue;
      const fr = Math.max(0, (r.endAt - t) / r.win), c = cellEl(r.hole);
      if(c){ const b = c.querySelector('.ml-tbar i'); if(b){ b.style.transform = `scaleX(${fr.toFixed(3)})`; b.parentNode.className = 'ml-tbar' + (r.kind === 'bomb' ? ' bomb' : fr < .25 ? ' red' : fr < .5 ? ' yel' : ''); } }
      if(r.kind !== 'bomb' && (!best || fr < best.fr)) best = { fr, left:r.endAt - t };
    }
    const bw = $('#mlBarW'), bi = $('#mlBar'); if(!bw || !bi) return;
    const fr = best ? best.fr : 0;
    bi.style.transform = `scaleX(${fr.toFixed(3)})`;
    const cls = 'hbar ml-wbar' + (!best ? ' idle' : fr < .25 ? ' red' : fr < .5 ? ' yel' : '') + (best && best.left < .4 && !FXR.reduce ? ' hurry' : '');
    if(bw.className !== cls) bw.className = cls;
  }
  function loop(ts){
    const m = S(); if(!m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const dt = m.lt ? Math.min(.05, (ts - m.lt) / 1000) : 0; m.lt = ts;
    if(!running(m) || m.done) return;
    m.t += dt;
    step(m); bars(m);
  }

  /* ---- 누르기 판정 ---- */
  function tap(hole){
    const m = S(); if(!running(m) || m.done || m.phase === 'intro') return;
    const now = m.t;
    m.taps = m.taps.filter(x => now - x < SPAM_WIN); m.taps.push(now);
    if(now < m.lockUntil){ return; }
    if(m.taps.length > SPAM_N){   /* 마구 누르기: 0.5초 잠금(벌점 없음) */
      m.lockUntil = now + SPAM_LOCK; m.taps = []; m.slow++;
      lockShow('천천히!', SPAM_LOCK); sfx('moleSlow'); say('천천히!', '잘 보고 눌러요', 'warn');
      return;
    }
    const r = cellMole(m, hole);
    if(!r){
      if(m.phase !== 'wave' || !m.act.some(x => x.st === 'up' || x.st === 'peek')){ hammer(hole, 'whiff'); return; }   /* 두더지가 없는 순간: 무시 */
      empty(m, hole, '빈 구멍'); return;
    }
    if(r.st === 'peek' || r.st === 'pwait'){ empty(m, hole, '빗나감'); return; }
    if(r.st !== 'up') return;
    hammer(hole, 'hit');
    const pan = (() => { try{ return panX(fxCenter(cellEl(hole)).x); }catch(_){ return 0; } })();
    if(r.kind === 'bomb'){ wrong(m, r, 'bomb'); return; }
    if(r.kind === 'num'){
      const want = Math.min(...m.act.filter(x => x.kind === 'num' && x.st !== 'gone').map(x => x.num));   /* 아직 안 나온 번호도 셈 */
      if(r.num !== want){ wrong(m, r, 'order', want); return; }
    }
    if(r.helm){   /* 헬멧: 첫 번째는 헬멧만 날아감 */
      r.helm = false; r.endAt = Math.max(r.endAt, now + .35);
      const c = cellEl(hole), hm = c && c.querySelector('.ml-helm');
      if(hm) anim(hm, [{ transform:'translate(0,0) rotate(0)', opacity:1 }, { transform:'translate(26%,-70%) rotate(28deg)', opacity:1, offset:.45 }, { transform:'translate(48%,-40%) rotate(70deg)', opacity:0 }], { duration:FXR.reduce ? 1 : 460, easing:'cubic-bezier(.2,.7,.4,1)' });
      const mo = c && c.querySelector('.ml-mole'); if(mo && !FXR.reduce) anim(mo, [{ transform:'translateY(0)' }, { transform:'translateY(6%) scale(1.06,.92)', offset:.35 }, { transform:'translateY(0)' }], { duration:220 });
      sfx('moleHelm', { pan }); fx(() => { const q = fxCenter(c); fxEmit(q.x, q.y - q.h * .3, { quantity:6, speed:{ min:80, max:180 }, angle:{ min:200, max:340 }, lifespan:{ min:300, max:500 }, kind:'spark', tint:['#FFE07A', '#FFFFFF'], scale:{ start:4, end:0 } }); });
      return;
    }
    hit(m, r, pan);
  }
  function hit(m, r, pan){
    const now = m.t, rt = Math.max(0, now - r.upAt), fr = Math.max(0, Math.min(1, 1 - rt / r.win)), val = r.kind === 'gold' ? 2 : 1;
    m.correct += val; m.sumFr += fr; m.rts.push(rt); m.hits++; m.combo++; m.bestCombo = Math.max(m.bestCombo, m.combo);
    const c = cellEl(r.hole), img = c && c.querySelector('.ml-img'); if(img) img.src = sprOf(r.kind, true);
    gone(m, r, 'hit', 'hit'); stamp(r.hole, true);
    sfx(r.kind === 'gold' ? 'moleGold' : 'moleHit', { n:Math.min(12, m.combo), pan });
    floatAt(r.hole, '+' + val, r.kind === 'gold' ? 'gold' : 'ok');
    fx(() => {
      const q = fxCenter(c), y = q.y - q.h * .28;
      fxEmit(q.x, y, { quantity:r.kind === 'gold' ? 16 : 10, speed:{ min:90, max:220 }, angle:{ min:200, max:340 }, lifespan:{ min:380, max:640 }, kind:'twinkle', tint:r.kind === 'gold' ? ['#FFE27A', '#FFFFFF', '#FFC93C'] : ['#FFFFFF', '#FFF2B0', '#C8F7C0'], scale:{ start:5, end:0, ease:'quad.in' }, gravityY:260, drag:1.2 });
      if(r.kind === 'gold'){ fxRing(q.x, y, '#FFE27A', q.w * .55, .45, 6); fxEmit(q.x, y, { quantity:8, speed:{ min:40, max:120 }, lifespan:{ min:500, max:800 }, kind:'star', tint:['#FFD23F', '#FFF6C8'], scale:{ start:6, end:0 }, glow:true }); }
    });
    if(COMBO_MSG[m.combo]) combo(m);
    else if(m.combo % 3 === 0) mood('joy', 600);
    hud();
  }
  function wrong(m, r, why, want){
    m.wrong++; m.combo = 0; m.lives = Math.max(0, m.lives - 1);
    const c = cellEl(r.hole);
    if(why === 'bomb'){
      const img = c && c.querySelector('.ml-img'); if(img) img.src = sprOf('bomb', true);
      sfx('moleBomb'); fxBuzz([40, 30, 60]);
      fx(() => {
        const q = fxCenter(c), y = q.y - q.h * .3;
        fxEmit(q.x, y, { quantity:14, speed:{ min:140, max:320 }, lifespan:{ min:350, max:650 }, kind:'shard', tint:['#FFB547', '#FF6A2B', '#FFE07A'], scale:{ start:6, end:1 }, gravityY:500, drag:1.4 });
        fxEmit(q.x, y, { quantity:9, speed:{ min:20, max:80 }, angle:{ min:200, max:340 }, lifespan:{ min:700, max:1100 }, kind:'smoke', tint:['#8C86A0', '#B9B3C8'], scale:{ start:10, end:24 }, alpha:{ start:.55, end:0 }, gravityY:-60 });
        fxFlash('#FF6B6B', .16, 320); fxShake($('#mlField'), 5);
      });
      say('앗, 폭탄!', m.lives ? '폭탄 두더지는 참아요' : '', 'bad');
    } else {
      sfx('moleWrong'); fxBuzz([30, 40, 30]);
      fx(() => { fxFlash('#FF6B6B', .12, 260); fxShake($('#mlField'), 4); });
      say('순서가 달라요', want ? want + '번부터 쳐요' : '', 'bad');
    }
    gone(m, r, 'wrong', 'hit'); stamp(r.hole, false);
    mood('sad', 900);
    hud(); lifeLost();
    if(m.lives <= 0) lose(m, 'lives');
  }
  function lifeLost(){ fx(() => { const m = S(), it = document.querySelectorAll('.ng-mole .hlives i')[m.lives]; if(it){ it.classList.add('lost'); } }); }
  function empty(m, hole, label){
    m.empty++; m.combo = 0; m.lockUntil = m.t + STUN;
    hammer(hole, 'whiff'); sfx('moleEmpty');
    floatAt(hole, '−' + EMPTY_PTS, 'bad');
    const c = cellEl(hole); if(c){ c.classList.remove('dizzy'); void c.offsetWidth; c.classList.add('dizzy'); T(() => { const c2 = cellEl(hole); if(c2) c2.classList.remove('dizzy'); }, STUN * 1000); }
    fx(() => { const q = fxCenter(c); fxEmit(q.x, q.y + q.h * .2, { quantity:6, speed:{ min:30, max:90 }, angle:{ min:190, max:350 }, lifespan:{ min:300, max:520 }, kind:'smoke', tint:['#C9A27A', '#E2C9A6'], scale:{ start:5, end:11 }, alpha:{ start:.5, end:0 } }); });
    lockShow(label === '빗나감' ? '빗나감!' : '멍…', STUN, true);
    hud();
  }
  function lockShow(text, sec, soft){
    const e = $('#mlLock'); if(!e) return;
    e.innerHTML = `<b>${text}</b>`; e.className = 'ml-lock on' + (soft ? ' soft' : '');
    const f = $('#mlField'); if(f) f.classList.add('locked');
    T(() => { const e2 = $('#mlLock'); if(e2) e2.className = 'ml-lock'; const f2 = $('#mlField'); if(f2) f2.classList.remove('locked'); }, sec * 1000);
  }
  function combo(m){
    const txt = COMBO_MSG[m.combo];
    sfx('moleCombo', { n:m.combo }); mood('joy', 900);
    say(txt, m.combo + '번 연속!', 'good');
    const e = $('#mlBanner');
    if(e){ e.innerHTML = `<b>${txt}</b><span>${m.combo}연속</span>`; e.className = 'ml-banner'; void e.offsetWidth; e.className = 'ml-banner on' + (m.combo >= 20 ? ' max' : ''); }
    fx(() => { fxPunch($('#mlField'), 1.025); const q = fxCenter($('#mlField')); fxEmit(q.x, q.y - q.h * .1, { quantity:14, speed:{ min:120, max:280 }, lifespan:{ min:500, max:800 }, kind:'twinkle', tint:['#FFE27A', '#FFFFFF', '#FF9CC4', '#9CE8FF'], scale:{ start:5, end:0 }, gravityY:180, drag:1 }); });
  }

  /* ---- 끝 ---- */
  function avgRt(m){ return m.rts.length ? m.rts.reduce((a, b) => a + b, 0) / m.rts.length : 0; }
  function end(m){
    if(m.done) return;
    m.phase = 'done';
    const ok = m.correct >= m.need;
    if(!ok){ lose(m, 'target'); return; }
    m.done = true; m.sec = m.t;
    const av = avgRt(m), key = 'hp:mole:best', best = store.get(key, 0);
    if(av > 0 && (!best || av < best)){ store.set(key, +av.toFixed(3)); m.newBest = true; }
    m.best = store.get(key, 0);
    mood('joy');
    say('목표 달성!', av ? `평균 ${av.toFixed(2)}초 · 내 최고 ${(m.best || av).toFixed(2)}초${m.newBest ? ' 새 기록!' : ''}` : '', 'good');
    sfx('win', { g:ID }); fxBuzz([30, 50, 30]);
    fx(() => { const f = $('#mlField'); f.classList.add('cleared'); const q = fxCenter(f); fxBurst(q.x, q.y - q.h * .2, ['#FFE27A', '#FF8FC8', '#7CE08A', '#7CCBFF'], 24, { speed:320, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); });
    T(() => finish(true), 1300);
  }
  function lose(m, why){
    if(m.done) return;
    m.done = true; m.fail = why; m.phase = 'done'; m.sec = m.t;
    m.act.forEach(r => { if(r.st !== 'gone'){ r.st = 'gone'; setCell(r.hole, null); hideMole(r.hole, 'down'); if(r.peek != null) hideMole(r.peek, 'down'); } });
    mood('sad');
    if(why === 'target') say('아쉬워요', `정답 ${m.correct}개 · 목표 ${m.need}개`, 'bad');
    else say('기회를 다 썼어요', `정답 ${m.correct}개`, 'bad');
    sfx('moleOver');
    T(() => finish(false), why === 'target' ? 1300 : 1100);
  }

  /* ---- 화면 맞추기: 390×844·360×740에서 스크롤 없이, 판은 크게 ---- */
  function layout(){
    const m = S(), f = $('#mlField'), root = document.querySelector('.ng-mole'); if(!m || !f || !root) return;
    const W = root.clientWidth || 340, vh = window.innerHeight || 700, sy = window.scrollY || 0;
    const rt = root.getBoundingClientRect().top + sy, total = Math.max(320, vh - rt - 12);
    const hudH = (root.querySelector('.hud-row') || {}).offsetHeight || 48;
    const pad = 10, gap = 4, cols = m.cols, rows = m.rows, HS0 = 58;
    const availH = Math.max(220, total - hudH - 8 - (HS0 + 6) - 18);
    const cwW = (W - 2 * pad - (cols - 1) * gap) / cols;
    const cwH = (availH - 2 * pad - (rows - 1) * gap) / (rows * .92);
    const cw = Math.floor(Math.max(56, Math.min(cwW, cwH, 150)));
    const asp = Math.max(.92, Math.min(1.6, (availH - 2 * pad - (rows - 1) * gap) / (rows * cw)));   /* 남는 높이는 칸 사이 풀밭으로 */
    const ch = Math.floor(cw * asp), fh = rows * ch + (rows - 1) * gap + 2 * pad;
    const hs = Math.round(Math.max(HS0, Math.min(90, HS0 + (availH - fh))));   /* 그래도 남으면 진행자를 크게 */
    f.style.setProperty('--cw', cw + 'px'); f.style.setProperty('--ch', ch + 'px');
    f.style.width = (cols * cw + (cols - 1) * gap + 2 * pad) + 'px';
    root.style.setProperty('--hs', hs + 'px');
    root.style.minHeight = Math.floor(total) + 'px';   /* 판은 엄지 자리(아래)로 */
  }

  function cellHtml(i, S0){
    return `<div class="ml-cell" data-i="${i}" role="button" aria-label="구멍 ${i + 1}">
      <img class="ml-pit" src="${S0.pit}" alt="" draggable="false">
      <div class="ml-clip"><div class="ml-mole"><img class="ml-img" src="${S0.normal}" alt="" draggable="false"><img class="ml-helm" src="${S0.helm}" alt="" draggable="false" hidden><span class="ml-num" hidden></span></div></div>
      <img class="ml-lip" src="${S0.lip}" alt="" draggable="false">
      <span class="ml-tbar"><i></i></span><span class="ml-stamp"></span></div>`;
  }

  let UID = 0;
  return {
    name:'두더지 땅땅', abil:'순발력', col:['#C8F0A0', '#5DB548', '#2F6E22'], time:'약 1분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 17.5V11a6 6 0 0 1 12 0v6.5z"/><ellipse cx="12" cy="18.5" rx="10" ry="3.2" opacity=".55"/><circle cx="9.6" cy="10.4" r="1.2" fill="#fff"/><circle cx="14.4" cy="10.4" r="1.2" fill="#fff"/><ellipse cx="12" cy="13" rx="1.8" ry="1.3" fill="#fff" opacity=".85"/></svg>',
    art(){
      const u = 'mlA' + (++UID) + Math.floor(performance.now() % 1e5), S0 = sprites();
      const img = (src, x, y, w, h) => `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
      const hole = (x, y, w, mole) => `<g>${img(S0.pit, x, y, w, w * .92)}${mole ? `<g clip-path="url(#${u}c${x})">${img(mole, x + w * .16, y - w * .02, w * .68, w * .68 * 1.22)}</g><clipPath id="${u}c${x}"><rect x="${x}" y="${y - 20}" width="${w}" height="${w * .77 + 20}"/></clipPath>` : ''}${img(S0.lip, x, y, w, w * .92)}</g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9F0A4"/><stop offset=".5" stop-color="#8FD46A"/><stop offset="1" stop-color="#5DB548"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}g)"/>
        <g fill="#fff" opacity=".35"><circle cx="18" cy="14" r="2"/><circle cx="140" cy="10" r="2.6"/><circle cx="96" cy="18" r="1.6"/></g>
        ${hole(4, 38, 52, S0.bomb)}${hole(54, 30, 56, S0.normal)}${hole(108, 40, 50, null)}
        ${img(S0.ham, 86, 2, 46, 46)}</svg>`;
    },
    help:[
      ['두더지만 땅!', '구멍에서 쏙 나온 두더지를 눌러 잡아요. 빨리 잡을수록 점수가 높아요. 놓쳐도 기회는 줄지 않아요.'],
      ['폭탄 두더지는 참기', '머리에 폭탄을 인 회색 두더지는 누르면 안 돼요. 들어갈 때까지 참으면 그것도 정답!'],
      ['막 누르면 손해', '빈 구멍을 누르면 ' + EMPTY_PTS + '점이 깎이고 망치가 잠깐 멍해져요. 폭탄을 치면 기회 별이 하나 줄어요.'],
      ['목표를 넘기면 성공', '두더지가 다 나온 뒤 정답이 목표 수 이상이면 성공. 솔로에서는 헬멧·황금·번호·숨바꼭질 두더지가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = S(); if(!m) return []; return [['이번 판', `두더지 ${m.N}마리 · 목표 ${m.need}개${m.tips.length ? ' · ' + m.tips.join(' · ') : ''}`]]; },
    chapters:['앞마당', '당근 밭', '달빛 들판', '두더지 마을', '땅속 왕국'],
    starRule:'★ 클리어 · ★★ 실수 1번 이하 · ★★★ 실수 없이',
    levels:LV,
    levelDesc(lv){ const c = LV[lv] || LV.normal; return `두더지 ${c.N}마리 · 폭탄 ${Math.round(c.trap * 100)}% · 목표 ${Math.round(c.target * 100)}%`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `두더지 ${c.N}마리 · 구멍 ${c.cols * c.rows}개 · 목표 ${Math.round(c.target * 100)}%${c.lives < 3 ? ' · 기회 ' + c.lives + '개' : ''}`; },
    init(cfg, rng){
      const g = gen(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      const lives = G.duel ? 3 : cfg.lives || 3;
      G.m = { waves:g.waves, N:g.N, cols:cfg.cols, rows:cfg.rows, need:Math.ceil(g.N * (cfg.target || .65) - 1e-9), target:cfg.target || .65,
        lives, maxLives:lives, correct:0, sumFr:0, rts:[], hits:0, resist:0, missed:0, wrong:0, empty:0, slow:0, combo:0, bestCombo:0,
        shown:0, judged:0, t:0, lt:0, phase:'intro', next:cfg.boss ? 1.9 : 1.1, wi:-1, act:[], taps:[], lockUntil:0,
        done:false, fail:null, sec:0, host:cfg.host || 'frog', ch:cfg.ch || 1, boss:!!cfg.boss, dark:cfg.tw === 'dark' && !G.duel,
        mj:cfg.mj || [], tw:cfg.tw || null, tips, timers:new Set(), moodT:0 };
      G.paws = lives;
      const m = G.m;
      m.onKey = e => {   /* 키보드: 숫자판 배치(7 8 9 / 4 5 6 / 1 2 3), 3×3 판만 */
        if(m.cols !== 3 || m.rows !== 3 || e.repeat) return;
        const k = '789456123'.indexOf(e.key); if(k >= 0){ e.preventDefault(); tap(k); }
      };
      addEventListener('keydown', m.onKey);
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear(); clearTimeout(m.moodT);
        removeEventListener('keydown', m.onKey);
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
    },
    render(st){
      const m = S(), S0 = sprites();
      st.innerHTML = `<div class="ng-mole ch-${m.ch}${m.dark ? ' dark' : ''}${m.boss ? ' boss' : ''}">
        <div class="hud-row">
          <div class="hchip" id="mlOkP" aria-label="정답과 목표"><span class="hv"><b id="mlOk">0</b><small>/목표 ${m.need}</small></span><em>정답</em></div>
          <div class="hchip" aria-label="남은 두더지"><span class="hv"><b id="mlLeft">${m.N}</b><small>마리</small></span><em>남은 두더지</em></div>
          <div class="hchip" aria-label="연속 정답"><span class="hv"><b id="mlCombo">0</b></span><em>연속</em></div>
        </div>
        <div class="ml-top">
          <div class="ml-hostw"><img class="toy ml-host" id="mlHost" src="${toySrc(m.host, m.boss ? 'wow' : '')}" alt="" aria-hidden="true" draggable="false"></div>
          <div class="ml-say" id="mlSay" aria-live="polite"><b>${m.boss ? '보스 판!' : '준비…'}</b><span>${playSub(m)}</span></div>
          <div class="hlives" id="mlLives" role="img"></div>
        </div>
        <div class="hbar ml-wbar idle" id="mlBarW" aria-hidden="true"><i id="mlBar"></i></div>
        <div class="ml-field" id="mlField" style="--cols:${m.cols}">
          <div class="ml-grid">${Array.from({ length:m.cols * m.rows }, (_, i) => cellHtml(i, S0)).join('')}</div>
          <img class="ml-ham" id="mlHam" src="${S0.ham}" alt="" draggable="false">
          <div class="ml-lock" id="mlLock" aria-live="assertive"></div>
          <div class="ml-banner" id="mlBanner" aria-hidden="true"></div>
          ${m.boss ? '<div class="ml-boss" id="mlBoss" aria-hidden="true"><b>보스!</b><span>끝까지 침착하게</span></div>' : ''}
        </div>
      </div>`;
      const f = $('#mlField');
      f.addEventListener('pointerdown', e => {
        const c = e.target.closest && e.target.closest('.ml-cell'); if(!c) return;
        e.preventDefault(); tap(+c.dataset.i);
      });
      hud(); layout();
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      requestAnimationFrame(() => { try{ layout(); }catch(_){} });
      if(m.boss){ sfx('moleBoss'); fx(() => { const b = $('#mlBoss'); if(b) b.classList.add('on'); }); T(() => { const b = $('#mlBoss'); if(b) b.classList.remove('on'); }, 1700); }
      if(G.raf) cancelAnimationFrame(G.raf);
      m.lt = 0; G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = S(); return m && m.N ? Math.min(1, m.judged / m.N) : 0; },
    lossText(){ const m = G.m; return (m.fail === 'lives' ? '기회를 다 썼어요. ' : m.fail === 'target' ? `목표 ${m.need}개에 못 미쳤어요. ` : '') + `정답 ${m.correct}/${m.N}개`; },
    score(){
      const m = G.m, N = Math.max(1, m.N), av = avgRt(m);
      const base = Math.round(500 * Math.min(1, m.correct / N));
      const time = Math.max(0, Math.round(350 * Math.min(1, m.sumFr / N)) - EMPTY_PTS * m.empty);
      const extra = 50 * Math.max(0, m.lives);
      return { base, time, extra, rows:[`정답 ${m.correct}/${m.N}`, `판단 속도 보너스 (평균 ${av.toFixed(2)}초)` + (m.empty ? ` · 빈 구멍 −${EMPTY_PTS * m.empty}` : ''), `남은 기회 ${m.lives}개`] };
    },
    stars(){ const w = G.m.wrong; return w === 0 ? 3 : w === 1 ? 2 : 1; },
    /* 테스트·도구용 */
    _gen:gen, _stage:stageCfg,
    _state(){ const m = S(); if(!m) return null; return { t:m.t, phase:m.phase, wi:m.wi, correct:m.correct, wrong:m.wrong, lives:m.lives, N:m.N, need:m.need, empty:m.empty, done:m.done,
      act:m.act.map(r => ({ hole:r.hole, peek:r.peek, kind:r.kind, num:r.num, st:r.st, helm:r.helm })) }; },
    css:`
body[data-mode="mole"]{background:
  radial-gradient(90% 45% at 50% 0%, rgba(255,255,255,.65), rgba(255,255,255,0) 70%),
  linear-gradient(180deg,#DDF4FF 0%,#E8F8DA 42%,#C9EBA8 100%) fixed}
.ng-mole{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none}
.ng-mole .hud-row{margin:0 0 8px}
.ng-mole .hchip small{font-size:13px}
.ng-mole #mlOkP.goal{background:linear-gradient(180deg,#E9FFD9,#B8F09A)}
.ng-mole #mlOkP.goal em, .ng-mole #mlOkP.goal small{color:#2F6E22}
.ng-mole .ml-top{display:flex; align-items:center; gap:8px; width:100%; height:var(--hs,58px); margin:0 0 6px}
.ng-mole .ml-hostw{flex:none; width:var(--hs,58px); height:var(--hs,58px); border-radius:50%; background:radial-gradient(circle at 50% 40%,#FFFFFF,#E6F7D2); border:2.5px solid #1A0F45; box-shadow:0 3px 0 #1A0F45; display:flex; align-items:center; justify-content:center; overflow:hidden}
.ng-mole .ml-host{width:calc(var(--hs,58px) - 6px); height:calc(var(--hs,58px) - 6px); display:block; transform-origin:50% 90%}
.ng-mole .ml-say{position:relative; flex:1; min-width:0; height:clamp(50px, calc(var(--hs,58px) * .7), 64px); padding:0 12px; border-radius:16px; background:#fff; border:2.5px solid #1A0F45; box-shadow:0 3px 0 #1A0F45;
  display:flex; flex-direction:column; justify-content:center; gap:2px; line-height:1.1; overflow:hidden}
.ng-mole .ml-say::before{content:""; position:absolute; left:-9px; top:50%; width:12px; height:12px; background:#fff; border-left:2.5px solid #1A0F45; border-bottom:2.5px solid #1A0F45; transform:translateY(-50%) rotate(45deg)}
.ng-mole .ml-say b{font-family:var(--heavy); font-weight:400; font-size:19px; color:#2B1D55; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.ng-mole .ml-say span{font-family:var(--disp); font-size:13.5px; color:#4A3A6E; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.ng-mole .ml-say.pop{animation:mole-say .3s cubic-bezier(.2,1.5,.4,1)}
.ng-mole .ml-say.good b{color:#2F8A1E}
.ng-mole .ml-say.bad b{color:#D93A3F}
.ng-mole .ml-say.warn b{color:#C46A00}
@keyframes mole-say{from{transform:scale(.92)}}
.ng-mole .hlives{flex:none; align-self:center}
.ng-mole .hlives i{display:inline-block}
.ng-mole .hlives i.lost{animation:mole-lost .5s ease-out}
.ng-mole .hlives.last{background:#FFE3E3}
@keyframes mole-lost{0%{transform:scale(1.7); color:#FF6B6B} 100%{transform:none}}
.ng-mole .ml-wbar{height:10px; margin:auto 0 8px}
.ng-mole .ml-wbar > i{width:100%; transform-origin:left center; transition:none; background:linear-gradient(180deg,#9BEA7A,#47B23A)}
.ng-mole .ml-wbar.yel > i{background:linear-gradient(180deg,#FFE27A,#F5B31E)}
.ng-mole .ml-wbar.red > i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-mole .ml-wbar.idle > i{opacity:.0}
.ng-mole .ml-wbar.hurry{animation:mole-hurry .16s linear infinite}
@keyframes mole-hurry{25%{transform:translateX(-1.5px)} 75%{transform:translateX(1.5px)}}
.ng-mole .ml-field{position:relative; --cw:100px; --ch:92px; padding:10px; border-radius:22px; border:2.5px solid #1A0F45; touch-action:none;
  box-shadow:0 4px 0 #1A0F45, 0 14px 26px rgba(30,70,20,.22), inset 0 2px 0 rgba(255,255,255,.5), inset 0 -10px 24px rgba(20,60,10,.18);
  background:
    radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,.45), rgba(255,255,255,0) 60%),
    radial-gradient(60% 40% at 15% 85%, rgba(255,255,255,.12), rgba(255,255,255,0) 70%),
    linear-gradient(180deg,var(--g1,#A6E07C) 0%,var(--g2,#7CC657) 55%,var(--g3,#5DAF45) 100%)}
.ng-mole.ch-2 .ml-field{--g1:#B9DE7A; --g2:#93C657; --g3:#76AE42}
.ng-mole.ch-3 .ml-field{--g1:#8DC9A0; --g2:#5FA67E; --g3:#3F8466}
.ng-mole.ch-4 .ml-field{--g1:#B4E48A; --g2:#86CB5F; --g3:#5FAE4A}
.ng-mole.ch-5 .ml-field{--g1:#B4A6C6; --g2:#9483AE; --g3:#74638E}
.ng-mole.ch-5 .ml-field::before{background-image:radial-gradient(circle,#FFFFFF 1.4px,transparent 2px), radial-gradient(circle,#9DF0FF 1.6px,transparent 2.2px); opacity:.45}
.ng-mole .ml-field::before{content:""; position:absolute; inset:0; border-radius:20px; pointer-events:none; opacity:.35;
  background-image:radial-gradient(circle,#FFFFFF 1.4px,transparent 2px), radial-gradient(circle,#FFE98A 1.6px,transparent 2.2px);
  background-size:97px 89px, 131px 113px; background-position:13px 21px, 61px 47px}
.ng-mole.ch-2 .ml-field::before{background-image:radial-gradient(circle,#FFFFFF 1.4px,transparent 2px), radial-gradient(circle,#FFB36B 1.8px,transparent 2.4px); opacity:.45}
.ng-mole.ch-3 .ml-field::before{background-image:radial-gradient(circle,#FFF7C2 1.2px,transparent 2px), radial-gradient(circle,#C9F0FF 1.4px,transparent 2px); opacity:.5}
.ng-mole .ml-grid{position:relative; display:grid; grid-template-columns:repeat(var(--cols), var(--cw)); grid-auto-rows:var(--ch); gap:4px}
.ng-mole .ml-cell{--yb:calc((var(--ch) - var(--cw) * .92) / 2); position:relative; width:var(--cw); height:var(--ch); cursor:pointer; -webkit-tap-highlight-color:transparent}
.ng-mole .ml-cell > *{pointer-events:none}
.ng-mole .ml-pit, .ng-mole .ml-lip{position:absolute; left:0; top:var(--yb); width:var(--cw); height:calc(var(--cw) * .92); display:block}
.ng-mole .ml-lip{z-index:3}
.ng-mole .ml-clip{position:absolute; left:0; right:0; top:calc(var(--cw) * -.3); height:calc(var(--yb) + var(--cw) * 1.07); overflow:hidden; z-index:2}
.ng-mole .ml-mole{position:absolute; left:12%; width:76%; bottom:0; aspect-ratio:100/122; transform:translateY(104%); transform-origin:50% 100%; will-change:transform}
.ng-mole .ml-img, .ng-mole .ml-helm{position:absolute; inset:0; width:100%; height:100%; display:block}
.ng-mole .ml-helm[hidden], .ng-mole .ml-num[hidden]{display:none}
.ng-mole .ml-num{position:absolute; left:50%; top:15%; transform:translate(-50%,-50%); width:calc(var(--cw) * .3); height:calc(var(--cw) * .3); min-width:26px; min-height:26px; border-radius:50%;
  display:flex; align-items:center; justify-content:center; font-family:var(--heavy); font-size:max(17px, calc(var(--cw) * .2)); line-height:1; color:#fff; border:2.5px solid #1A0F45; box-shadow:0 2px 0 #1A0F45; text-shadow:0 2px 0 rgba(26,15,69,.35)}
.ng-mole .ml-num[data-n="1"]{background:linear-gradient(180deg,#7CC6FF,#2F86E8)}
.ng-mole .ml-num[data-n="2"]{background:linear-gradient(180deg,#8EE38A,#2FA845)}
.ng-mole .ml-num[data-n="3"]{background:linear-gradient(180deg,#FFB77A,#F0702A)}
.ng-mole .ml-tbar{position:absolute; left:28%; right:28%; bottom:calc(var(--yb) + var(--cw) * .015); height:7px; border-radius:99px; background:rgba(26,15,69,.28); overflow:hidden; z-index:4; opacity:0; transition:opacity .12s}
.ng-mole .ml-tbar i{display:block; height:100%; background:#5BD04A; transform-origin:left center}
.ng-mole .ml-tbar.yel i{background:#F5B31E} .ng-mole .ml-tbar.red i{background:#E5484D} .ng-mole .ml-tbar.bomb i{background:#9C96B8}
.ng-mole .ml-cell.lit[data-k]:not([data-k="peek"]) .ml-tbar{opacity:1}
.ng-mole .ml-cell[data-k="bomb"] .ml-tbar{opacity:0 !important}
.ng-mole .ml-cell::before{content:""; position:absolute; left:2%; right:2%; top:calc(var(--yb) + var(--cw) * .38); height:calc(var(--cw) * .46); border-radius:50%; z-index:0; opacity:0; transition:opacity .15s;
  background:radial-gradient(closest-side, rgba(255,240,170,.75), rgba(255,240,170,0))}
.ng-mole .ml-cell.danger::before{opacity:1; background:radial-gradient(closest-side, rgba(255,90,90,.42), rgba(255,90,90,0))}
.ng-mole .ml-cell.dizzy .ml-lip, .ng-mole .ml-cell.dizzy .ml-pit{animation:mole-dizzy .4s ease-out}
@keyframes mole-dizzy{30%{transform:translateY(2px)} 60%{transform:translateY(-1px)}}
.ng-mole .ml-stamp{position:absolute; left:50%; top:calc(var(--yb) + var(--cw) * .22); z-index:6; width:calc(var(--cw) * .42); height:calc(var(--cw) * .42); border-radius:50%; transform:translate(-50%,-50%) scale(.3); opacity:0; display:flex; align-items:center; justify-content:center; border:3px solid #1A0F45; box-shadow:0 3px 0 #1A0F45}
.ng-mole .ml-stamp svg{width:64%; height:64%; fill:none; stroke:#fff; stroke-width:3.6; stroke-linecap:round; stroke-linejoin:round}
.ng-mole .ml-stamp.ok{background:linear-gradient(180deg,#7EE06A,#2FA845)}
.ng-mole .ml-stamp.x{background:linear-gradient(180deg,#FF8A8F,#E5484D)}
.ng-mole .ml-stamp.on{animation:mole-stamp .65s cubic-bezier(.2,1.5,.4,1) both}
@keyframes mole-stamp{0%{opacity:0; transform:translate(-50%,-50%) scale(1.8)} 20%{opacity:1; transform:translate(-50%,-50%) scale(.95)} 30%{transform:translate(-50%,-50%) scale(1)} 75%{opacity:1} 100%{opacity:0; transform:translate(-50%,-70%) scale(1)}}
.ng-mole .ml-ham{position:absolute; left:0; top:0; width:calc(var(--cw) * .62); height:calc(var(--cw) * .62); z-index:7; pointer-events:none; opacity:0; transform-origin:84% 88%; filter:drop-shadow(0 4px 3px rgba(20,40,10,.3))}
.ng-mole .ml-lock{position:absolute; left:50%; top:50%; z-index:9; pointer-events:none; transform:translate(-50%,-50%) scale(.6); opacity:0; transition:opacity .12s, transform .18s cubic-bezier(.2,1.5,.4,1)}
.ng-mole .ml-lock b{display:block; font-family:var(--heavy); font-weight:400; font-size:22px; color:#fff; background:#E5484D; border:2.5px solid #1A0F45; border-radius:99px; padding:6px 16px; box-shadow:0 3px 0 #1A0F45; white-space:nowrap}
.ng-mole .ml-lock.soft b{background:#8C6A4A; font-size:18px; padding:4px 13px}
.ng-mole .ml-lock.on{opacity:1; transform:translate(-50%,-50%) scale(1)}
.ng-mole .ml-field.locked .ml-grid{filter:saturate(.7) brightness(.96)}
.ng-mole .ml-banner{position:absolute; left:50%; top:38%; z-index:8; pointer-events:none; transform:translate(-50%,-50%); opacity:0; display:flex; flex-direction:column; align-items:center}
.ng-mole .ml-banner b{font-family:var(--heavy); font-weight:400; font-size:34px; color:#FFE27A; -webkit-text-stroke:6px #1A0F45; paint-order:stroke fill; letter-spacing:1px; white-space:nowrap}
.ng-mole .ml-banner span{font-family:var(--disp); font-size:16px; color:#fff; background:#1A0F45; border-radius:99px; padding:3px 12px; margin-top:2px}
.ng-mole .ml-banner.on{animation:mole-banner 1.1s cubic-bezier(.2,1.4,.4,1) both}
.ng-mole .ml-banner.max b{color:#FF9CC4}
@keyframes mole-banner{0%{opacity:0; transform:translate(-50%,-50%) scale(.4)} 18%{opacity:1; transform:translate(-50%,-50%) scale(1.08)} 30%{transform:translate(-50%,-50%) scale(1)} 78%{opacity:1} 100%{opacity:0; transform:translate(-50%,-62%) scale(1)}}
.ng-mole .ml-boss{position:absolute; left:-6px; right:-6px; top:40%; z-index:10; pointer-events:none; transform:translateY(-50%) scaleY(0); opacity:0; padding:10px 0 12px; text-align:center;
  background:linear-gradient(180deg,#FF7A6E,#D9363E); border-top:3px solid #1A0F45; border-bottom:3px solid #1A0F45; box-shadow:0 6px 16px rgba(120,10,20,.3); transition:transform .3s cubic-bezier(.2,1.4,.4,1), opacity .2s}
.ng-mole .ml-boss b{display:block; font-family:var(--heavy); font-weight:400; font-size:38px; color:#FFE27A; -webkit-text-stroke:6px #1A0F45; paint-order:stroke fill; line-height:1.05}
.ng-mole .ml-boss span{font-family:var(--disp); font-size:15px; color:#fff}
.ng-mole .ml-boss.on{opacity:1; transform:translateY(-50%) scaleY(1)}
.ng-mole.boss .ml-top .ml-say{border-color:#B0202A}
.ng-mole.boss .ml-field{box-shadow:0 4px 0 #1A0F45, 0 0 0 4px rgba(229,72,77,.28), 0 14px 26px rgba(120,30,20,.25), inset 0 2px 0 rgba(255,255,255,.5), inset 0 -10px 24px rgba(20,60,10,.18)}
.ng-mole .ml-field.cleared{animation:mole-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes mole-cheer{40%{transform:scale(1.02)}}
/* 밤의 들판: 판이 어둡고, 두더지가 나온 구멍만 불이 켜짐 */
.ng-mole.dark .ml-field{--g1:#2F4A5C; --g2:#22384A; --g3:#182A38}
.ng-mole.dark .ml-field::before{background-image:radial-gradient(circle,#FFF7C2 1.1px,transparent 1.8px), radial-gradient(circle,#BFE3FF 1px,transparent 1.6px); opacity:.55}
.ng-mole.dark .ml-pit, .ng-mole.dark .ml-lip{filter:brightness(.42) saturate(.6); transition:filter .16s}
.ng-mole.dark .ml-cell.lit .ml-pit, .ng-mole.dark .ml-cell.lit .ml-lip{filter:none}
.ng-mole.dark .ml-cell.lit::before{opacity:1}
.ng-mole.dark .ml-cell.lit.danger::before{opacity:1}
.ng-mole.dark .ml-banner span{background:#0E1830}
@media (max-width:370px){ .ng-mole .ml-say b{font-size:17px} .ng-mole .ml-say span{font-size:13px} .ng-mole .hlives{padding:0 7px 0 6px} }
@media (prefers-reduced-motion: reduce){ .ng-mole .ml-say.pop, .ng-mole .ml-banner.on, .ng-mole .ml-stamp.on, .ng-mole .ml-field.cleared, .ng-mole .ml-cell.dizzy .ml-lip, .ng-mole .ml-cell.dizzy .ml-pit{animation-duration:.01s} .ng-mole .ml-wbar.hurry{animation:none} }
.ml-float{font-family:var(--heavy); font-weight:400; font-size:24px}
.ml-float.ok{color:#B8F59A} .ml-float.gold{color:#FFE27A; font-size:28px} .ml-float.bad{color:#FFB0A0; font-size:20px} .ml-float.calm{color:#FFFFFF; font-size:18px}
`,
    sounds:{
      molePop(o){ aTone({ f:430, f2:860, a:.004, d:.09, v:.07, pan:o.pan }); aNoise({ ft:'bandpass', f:1300, q:2.2, d:.035, v:.025, pan:o.pan }); },
      molePeek(o){ aTone({ f:700, f2:1000, a:.004, d:.06, v:.04, pan:o.pan }); },
      moleHit(o){ const n = o.n || 0; aThump({ f:200, f2:70, d:.12, v:.24, pan:o.pan }); aNoise({ ft:'bandpass', f:1100, q:1.4, d:.05, v:.07, pan:o.pan }); aMarimba(penta(n + 2, 72), { t:.015, v:.16, pan:o.pan }); if(n >= 3) aBell({ f:penta(n + 7, 72), t:.06, d:.5, v:.04, rev:.35, pan:o.pan }); },
      moleGold(o){ aThump({ f:200, f2:80, d:.1, v:.2, pan:o.pan }); aCoin({ v:.05 }); aSparkle({ root:86, n:5, t:.05, v:.035 }); },
      moleHelm(o){ aBell({ f:1650, ratio:2.41, idx:2.5, d:.35, v:.07, pan:o.pan }); aTone({ f:2400, type:'square', lp:5000, d:.03, v:.03, pan:o.pan }); aThump({ f:300, f2:150, d:.06, v:.1 }); },
      moleBomb(){ aNoise({ ft:'lowpass', f:1600, f2:120, a:.003, d:.6, v:.32 }); aThump({ f:95, f2:32, d:.55, v:.45 }); aTone({ f:180, f2:70, type:'sawtooth', lp:700, d:.35, v:.05 }); },
      moleWrong(){ aTone({ f:220, f2:185, type:'square', lp:900, d:.16, v:.06 }); aTone({ f:165, type:'square', lp:700, t:.1, d:.2, v:.055 }); },
      moleEmpty(){ aTone({ f:240, f2:150, type:'triangle', d:.08, v:.1 }); aNoise({ ft:'lowpass', f:500, d:.08, v:.1 }); },
      moleResist(o){ aBell({ f:m2f(81), d:.35, v:.035, idx:1.1, rev:.3, pan:o.pan }); },
      moleSlow(){ aTone({ f:660, f2:420, type:'triangle', d:.2, v:.07 }); aTone({ f:520, f2:330, type:'triangle', t:.12, d:.22, v:.06 }); },
      moleCombo(o){ const k = o.n >= 20 ? 3 : o.n >= 10 ? 2 : 1; [72, 76, 79, 84, 88].slice(0, 2 + k).forEach((mm, i) => aBrass(m2f(mm), { t:i * .07, d:.16, v:.05 })); aSparkle({ root:84, n:3 + k, t:.12, v:.035 }); },
      moleGo(){ aWhoosh({ f:600, f2:3000, a:.02, d:.2, v:.045 }); aBell({ f:m2f(84), t:.08, d:.45, v:.06, rev:.3 }); },
      moleBoss(){ [0, .16, .32].forEach((t, i) => aThump({ f:110 - i * 10, f2:50, t, d:.3, v:.35 })); aBrass(m2f(55), { t:.48, hold:.25, d:.5, v:.06 }); aBrass(m2f(62), { t:.48, hold:.25, d:.5, v:.045 }); },
      moleOver(){ [67, 63, 58].forEach((mm, i) => aTone({ f:m2f(mm), type:'triangle', t:i * .16, d:.35, v:.07, lp:2000, rev:.25 })); }
    },
    gate:{ molePop:45, molePeek:60, moleHit:35, moleEmpty:70, moleResist:90, moleSlow:300 },
    jingle(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d, 67), { t:i * .07, v:.16 })); aThump({ f:180, f2:80, t:.42, d:.15, v:.2 }); [79, 84, 88].forEach((mm, i) => aBell({ f:m2f(mm), t:.46 + i * .04, d:1.1, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 같은 씨앗·보통 설정. 누가 더 많이, 더 빨리 맞혔나(끝났을 때 점수가 높은 쪽 승) */
Object.assign(NG.mole, {
  duelPace:[50, .8],
  duelStat:{ unit:'개', lfMax:3, get:() => ({ v:G.m.correct, t:G.m.N, lf:G.m.lives }) },
  duelHow:'같은 두더지 · 폭탄은 참고 누가 더 많이 잡나'
});
/* 움직이는 배경(core/scene.js): 잔잔한 꽃가루. 보이기만 하고 게임·대전에는 영향 없음 */
NG.mole.scene = { kind:'motes', colors:['#FFFFFF', '#FFF3B0', '#D8F5C8'], density:.6, alpha:.7 };
