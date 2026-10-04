/* 끝말잇기 */
/* ===== 끝말잇기 (wordchain) · 하루퍼즐 리그 게임 모듈 =====
   앞 낱말의 끝 글자로 시작하는 낱말을 번갈아 잇는다(두음법칙 허용: 녀→여, 력→역, 라→나 …).
   사전은 wordchain-words.js(직접 모은 일반 명사, core = 누구나 아는 말 · extra = 받아 주는 말).
   - 오늘의 문제·연습·솔로: AI와 번갈아 잇기. 시작 낱말·AI 응답은 모두 씨앗 rng(같은 날 같은 시작, 같은 수 → 같은 응답).
   - 대전: 실시간 1:1 턴제(사람끼리 번갈아 잇기, gostop처럼 duelLaunch + duel:{fleet:true} + presence로 수 주고받기). 상대가 없으면 AI. */
NG.wordchain = (() => {
  const ID = 'wordchain';
  const OL = '#1A0F45';

  /* ===== 사전 ===== */
  const W = [], IDX = new Map();
  const add = w => { if(w && !IDX.has(w)){ IDX.set(w, W.length); W.push(w); } };
  WC_DICT.core.split(' ').sort().forEach(add);
  const NCORE = W.length;
  WC_DICT.extra.split(' ').sort().forEach(add);
  const BYF = new Map(), BYL = new Map();   /* 첫 글자 → 낱말 번호들, 끝 글자 → 낱말 번호들(core가 먼저) */
  const push = (M, k, i) => { let a = M.get(k); if(!a) M.set(k, a = []); a.push(i); };
  W.forEach((w, i) => { push(BYF, w[0], i); push(BYL, w[w.length - 1], i); });

  /* ===== 두음법칙: 끝 글자 → 이어도 되는 첫 글자들 ===== */
  const IY = [2, 6, 7, 12, 17, 20];   /* ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ */
  function dueum(c){
    const o = c.charCodeAt(0) - 0xAC00; if(o < 0 || o > 11171) return null;
    const i = Math.floor(o / 588), v = Math.floor(o % 588 / 28), t = o % 28;
    if(i === 5) return String.fromCharCode(0xAC00 + (IY.includes(v) ? 11 : 2) * 588 + v * 28 + t);   /* ㄹ → ㅇ(ㅣ계열) / ㄴ */
    if(i === 2 && IY.includes(v)) return String.fromCharCode(0xAC00 + 11 * 588 + v * 28 + t);         /* ㄴ(ㅣ계열) → ㅇ */
    return null;
  }
  const starts = c => { const d = dueum(c); return d ? [c, d] : [c]; };
  const isHan = w => /^[가-힣]+$/.test(w);

  /* ===== 규칙(새 규칙·변주) ===== */
  const CONC = {
    order:['long', 'gold', 'ban', 'rev'],
    info:{
      long:{ name:'긴 낱말', desc:'두 글자 낱말은 쓸 수 없어요. 나도 AI도 세 글자 이상 낱말만 이어요.' },
      gold:{ name:'황금 글자', desc:'판마다 황금 글자 3개가 정해져요. 황금 글자가 들어간 낱말을 정해진 수만큼 이어야 성공이에요.' },
      ban:{ name:'금지 글자', desc:'판마다 금지 글자 2개가 정해져요. 그 글자가 들어간 낱말은 나도 AI도 쓸 수 없어요.' },
      rev:{ name:'거꾸로 잇기', desc:'앞 낱말의 첫 글자로 끝나는 낱말을 이어요. 사과 → 회사 → 사회처럼요. (두음법칙은 없어요)' }
    },
    twists:['flash', 'bare', 'tight', 'tick', 'shrink'],
    twInfo:{
      flash:{ name:'번개', desc:'한 차례 제한 시간이 아주 짧아요. 떠오르는 대로 빠르게!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 내 머릿속 사전으로 이어요.' },
      tight:{ name:'외줄 타기', desc:'첫 글자가 틀리거나 이미 쓴 말·규칙에 어긋난 말은 한 번만 봐줘요. 두 번째면 끝! (사전에 없는 말은 괜찮아요)' },
      tick:{ name:'째깍 벌칙', desc:'첫 글자가 틀리거나 이미 쓴 말을 넣으면 그 차례 시간이 3초 줄어요.' },
      shrink:{ name:'줄어드는 시계', desc:'내 차례가 지날수록 제한 시간이 1초씩 줄어요(최소 6초).' }
    }
  };
  const RULE_TIP = { long:'세 글자 이상만', gold:'황금 글자 미션', ban:'금지 글자 조심', rev:'첫 글자로 끝나게', flash:'시간이 짧아요', bare:'힌트 없음', tight:'규칙 실수 1번까지', tick:'틀리면 −3초', shrink:'차례마다 −1초' };
  const AI_NAME = ['순한 AI', '보통 AI', '영리한 AI', '한방 AI'];
  /* 황금·금지 글자 후보(낱말에 자주 나오는 글자) */
  const GOLD_POOL = ['사', '기', '수', '자', '지', '리', '이', '도', '고', '구', '소', '대', '장', '전', '정', '상', '화', '시', '주', '가', '아', '무', '나', '마', '바', '하', '오', '공', '물', '산', '불', '꽃', '눈', '손', '발', '말', '밤', '별', '달', '해', '강', '새', '나무', '비'].filter(c => c.length === 1);
  const BAN_POOL = ['기', '사', '리', '이', '자', '지', '수', '구', '도', '고', '대', '장', '전', '정', '시', '주', '가', '화'];

  /* ===== 솔로 난이도 표 =====
     목표 = 이어야 할 내 낱말 수, 시간 = 한 차례 제한(초), AI 세기 0 순함(쉬운 끝 글자를 줌) · 1 보통 · 2 영리함(어려운 끝 글자, 한방 50%) · 3 한방(한방 낱말이 있으면 꼭 씀) */
  const LT = {
    ch1Goal:[6, 7, 8, 7, 10, 6, 8, 9, 7, 10],
    kOff:[0, -2, -1, 0, 0, 2, -1, 0, 1, -2, 2],
    lim:[0, 20, 18, 16, 15, 14, 14]
  };
  function stageCfg(n){
    const p = planOf(ID, n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let goal = c === 1 ? LT.ch1Goal[k - 1] : 9 + Math.min(c, 6) - 2 + LT.kOff[k];
    if(has('long') || has('rev')) goal -= 1;
    goal = Math.max(5, Math.min(14, goal));
    let limit = LT.lim[Math.min(c, LT.lim.length - 1)] + (p.easy ? 2 : 0) - (p.boss ? 1 : 0);
    if(has('long') || has('rev')) limit += 3;
    if(tw === 'flash') limit = Math.round(limit * 0.6);
    if(tw === 'shrink') limit += 3;
    limit = Math.max(7, limit);
    let ai = c === 1 ? (k === 5 || k === 10 ? 1 : 0) : c === 2 ? (k === 10 ? 2 : 1) : c === 3 ? (k === 10 ? 3 : k === 5 ? 2 : 1) : (k === 10 ? 3 : k === 1 || k === 9 ? 1 : 2);
    if(has('rev') && ai > 2) ai = 2;
    const hints = tw === 'bare' ? 0 : p.boss ? 2 : 3;
    return { goal, limit, ai, hints, long:has('long'), gold:has('gold') ? (p.boss ? 3 : 2) : 0, ban:has('ban') ? 2 : 0, rev:has('rev'),
      tight:tw === 'tight', tick:tw === 'tick' ? 3 : 0, shrink:tw === 'shrink', mj:mj.slice(), tw, boss:p.boss, hard:p.hard, n };
  }

  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const lastW = m => m.chain[m.chain.length - 1].w;

  /* ===== 잇기 규칙 ===== */
  function okWord(m, w){ return !m.used.has(w) && !(m.rule.long && w.length < 3) && !m.rule.ban.some(c => w.includes(c)); }
  /* 앞 낱말 last 다음에 올 수 있는 낱말 번호들(core 먼저) */
  function cands(m, last){
    const L = m.rule.rev ? (BYL.get(last[0]) || []) : [].concat(...starts(last[last.length - 1]).map(c => BYF.get(c) || []));
    return L.filter(i => okWord(m, W[i])).sort((a, b) => a - b);
  }
  /* 낱말 i를 쓴 뒤 상대가 이을 수 있는 낱말들(빈 배열 = 한방) */
  function followList(m, i){ const w = W[i]; m.used.add(w); const L = cands(m, w); m.used.delete(w); return L; }
  const follow = (m, i) => followList(m, i).length;
  /* 규칙별 표(이미 쓴 말은 빼지 않은 어림값): nAll[i] = 낱말 i 뒤에 올 수 있는 낱말 수(0 = 한방 낱말), nCore = 그중 core.
     판 만들기(시작 낱말)와 AI의 "상대에게 한방 기회를 주지 않기" 판단에 쓴다. 규칙 조합마다 한 번만 만든다 */
  const TBL = new Map();
  function tables(rule){
    const key = (rule.long ? 'L' : '') + (rule.rev ? 'R' : '') + rule.ban.join('');
    let t = TBL.get(key); if(t) return t;
    const fA = new Map(), fC = new Map(), inc = (M, k) => M.set(k, (M.get(k) || 0) + 1);
    W.forEach((w, i) => { if((rule.long && w.length < 3) || rule.ban.some(c => w.includes(c))) return; const k = rule.rev ? w[w.length - 1] : w[0]; inc(fA, k); if(i < NCORE) inc(fC, k); });
    const nAll = new Uint16Array(W.length), nCore = new Uint16Array(W.length);
    W.forEach((w, i) => { const ks = rule.rev ? [w[0]] : starts(w[w.length - 1]); for(const k of ks){ nAll[i] += fA.get(k) || 0; nCore[i] += fC.get(k) || 0; } });
    t = { nAll, nCore }; TBL.set(key, t); return t;
  }
  /* 넣은 낱말 검사: null이면 통과. kind: 'rule'(실수로 셈) | 'soft'(다시 입력) */
  function check(m, w){
    if(!w) return null;
    if(!isHan(w)) return { kind:'soft', t:'한글 낱말만 넣어요' };
    if(w.length < 2) return { kind:'soft', t:'한 글자 낱말은 안 돼요' };
    const last = lastW(m);
    if(m.rule.rev){ if(w[w.length - 1] !== last[0]) return { kind:'rule', t:`‘${last[0]}’(으)로 끝나야 해요` }; }
    else if(!starts(last[last.length - 1]).includes(w[0])) return { kind:'rule', t:`‘${needTxt(m)}’(으)로 시작해야 해요` };
    if(m.rule.long && w.length < 3) return { kind:'rule', t:'세 글자 이상만 돼요' };
    const b = m.rule.ban.find(c => w.includes(c)); if(b) return { kind:'rule', t:`금지 글자 ‘${b}’가 있어요` };
    if(m.used.has(w)) return { kind:'rule', t:'이미 쓴 낱말이에요' };
    if(!IDX.has(w)) return { kind:'soft', t:'사전에 없어요', dict:true };
    return null;
  }
  const needTxt = m => { const last = lastW(m); return m.rule.rev ? last[0] : starts(last[last.length - 1]).join('·'); };

  /* ===== AI: 같은 수(지금까지 이은 낱말) → 같은 응답. 씨앗 = 판 씨앗 + 낱말 기록 ===== */
  const histRng = (m, tag) => mulberry(seedFrom(m.seed + ':' + tag + ':' + m.chain.map(x => x.w).join(',')));
  const pickOf = (r, a) => a[Math.floor(r() * a.length)];
  /* 돌려줌: { i } 낱말 · { fail:true } 못 찾음(대전 AI가 가끔) · null 이을 낱말이 아예 없음(한방 당함)
     lvl 0 순함: 이어 받기 쉬운 낱말 · 1 보통: 아무 낱말(가끔 내게 한방 기회를 막음) · 2 영리함: 이어 받기 어려운 낱말 + 내게 한방 기회를 거의 안 줌 + 한방 15% · 3 한방: 한방 35% */
  const KILL_P = [0, 0, .15, .35], GUARD_P = [0, .4, .85, 1];
  function aiPick(m, lvl, killP, failP){
    const r = histRng(m, 'ai'), C = cands(m, lastW(m));
    if(!C.length) return null;
    const core = C.filter(i => i < NCORE), pool = core.length ? core : C, dead = tables(m.rule).nAll;
    const sc = pool.map(i => { const F = followList(m, i); return { i, f:F.length, k:F.reduce((s, j) => s + (dead[j] === 0 ? 1 : 0), 0) }; });
    const kill = sc.filter(x => x.f === 0); let live = sc.filter(x => x.f > 0).sort((a, b) => b.f - a.f || a.i - b.i);
    if(failP && r() < failP + (live.length <= 3 ? .25 : 0)) return { fail:true };
    const kp = killP != null ? killP : KILL_P[lvl] || 0;
    if(kill.length && (!live.length || r() < kp)) return { i:pickOf(r, kill).i, kill:true };
    if(!live.length) return { i:pickOf(r, sc).i };
    if(r() < (GUARD_P[lvl] || 0)){ const safe = live.filter(x => x.k === 0); if(safe.length) live = safe; else { const mk = Math.min(...live.map(x => x.k)); live = live.filter(x => x.k === mk); } }
    const third = Math.max(1, Math.ceil(live.length / 3));
    let part;
    if(lvl <= 0) part = live.slice(0, third);                                   /* 순함: 이어 받기 쉬운 낱말 */
    else if(lvl === 1){ part = live.filter(x => x.f >= 3); if(!part.length) part = live; }
    else { part = live.filter(x => x.f >= 2).slice(-third); if(!part.length) part = live.slice(-third); }   /* 영리함: 이어 받기 어려운 낱말 */
    return { i:pickOf(r, part).i };
  }
  /* 힌트·자동 풀기: 이을 수 있는 낱말 하나(되도록 core, 한방을 안 당하는 것) */
  function helpPick(m, tag, prefer){
    const C = cands(m, lastW(m)); if(!C.length) return null;
    const core = C.filter(i => i < NCORE), pool = core.length ? core : C;
    const sc = pool.map(i => [i, follow(m, i)]);
    if(prefer === 'kill'){ const k = sc.find(x => x[1] === 0); if(k) return k[0]; }
    const live = sc.filter(x => x[1] > 0);
    return pickOf(histRng(m, tag), live.length ? live : sc)[0];
  }

  /* ===== 판 만들기(시작 낱말·황금/금지 글자): rng만 ===== */
  function setup(cfg, rng){
    const rule = { long:!!cfg.long, rev:!!cfg.rev, ban:[], gold:[], goldNeed:cfg.gold || 0, tight:!!cfg.tight, tick:cfg.tick || 0, shrink:!!cfg.shrink };
    if(cfg.ban) rule.ban = shuffle(BAN_POOL.slice(), rng).slice(0, cfg.ban);
    if(cfg.gold) rule.gold = shuffle(GOLD_POOL.filter(c => !rule.ban.includes(c)), rng).slice(0, 3);
    /* 시작 낱말: core에서, 규칙에 맞고 이을 core 낱말이 넉넉한 것(표로 바로 확인) */
    const nc = tables(rule).nCore, need = rule.long || rule.rev ? 6 : 12;
    const order = shuffle(Array.from({ length:NCORE }, (_, i) => i), rng);
    let start = -1;
    for(const i of order){ const w = W[i]; if(w.length > 3 || (rule.long && w.length < 3) || rule.ban.some(c => w.includes(c))) continue; if(nc[i] >= need){ start = i; break; } }
    if(start < 0) start = order.find(i => nc[i] > 0);
    return { rule, start:W[start], seed:Math.floor(rng() * 1e9) };
  }

  /* ===== 화면 ===== */
  const ICO = {
    word:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H10l-4 3.5v-3.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" fill="#8FE3DA" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 10.5h7" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M15 2.5l3 2-3 2" fill="none" stroke="#FF8A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    flag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3.5" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 4h11l-2.6 4 2.6 4h-11z" fill="#FFFFFF" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    vs:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="6" fill="#FFB36B" stroke="#1A0F45" stroke-width="1.8"/><circle cx="16" cy="12" r="6" fill="#8FE3DA" stroke="#1A0F45" stroke-width="1.8" fill-opacity=".9"/></svg>',
    send:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2 20 4l-5.6 16.3-3.2-6.9z" fill="#fff" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/><path d="M11.2 13.4 20 4" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const oppKind = nick => { try{ const k = DUEL_NICK_B.findIndex(a => String(nick || '').endsWith(a)); return FACE_KIND[k >= 0 ? k : seedFrom(String(nick || '?')) % 6]; }catch(_){ return 'cat'; } };
  function avHtml(by){
    const m = S();
    if(by === 'me') return toyImg('fox', 'wc-avimg');
    if(by === 'op') return toyImg(m.oppKind || 'cat', 'wc-avimg');
    return toyImg('owl', 'wc-avimg');
  }
  /* 낱말을 글자 타일로: 첫 글자(이어 받은 글자)·끝 글자(넘겨 줄 글자) 강조 */
  function tilesHtml(w, from, to){
    const rev = S().rule.rev, fi = rev ? w.length - 1 : 0, ti = rev ? 0 : w.length - 1;   /* 거꾸로 잇기: 끝 글자가 이어 받은 글자, 첫 글자가 넘겨 줄 글자 */
    return [...w].map((c, i) => `<span class="wc-t${i === fi && from ? ' from' : ''}${i === ti && to ? ' to' : ''}${S().rule.gold.includes(c) ? ' gold' : ''}">${c}</span>`).join('');
  }
  function bubble(x, n){
    const m = S(), by = x.by;
    if(by === 'start') return `<div class="wc-start" data-n="${n}"><small>시작 낱말</small><div class="wc-ws">${tilesHtml(x.w, false, true)}</div></div>`;
    const who = by === 'me' ? '나' : by === 'op' ? esc(m.oppNick || '상대') : (m.aiName || 'AI');
    return `<div class="wc-b ${by === 'me' ? 'me' : 'ai'}" data-n="${n}"><span class="wc-av">${avHtml(by)}</span><div class="wc-bw"><small>${who}${x.kill ? ' · <b class="kill">한방!</b>' : ''}</small><div class="wc-ws">${tilesHtml(x.w, true, true)}</div></div></div>`;
  }
  function logAdd(x){
    const log = $('#wcLog'); if(!log) return null;
    const t = log.querySelector('.wc-typing'); if(t) t.remove();
    log.insertAdjacentHTML('beforeend', bubble(x, S().chain.length - 1));
    const el = log.lastElementChild; el.classList.add('pop');
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(by, on){
    const log = $('#wcLog'); if(!log) return;
    const t = log.querySelector('.wc-typing'); if(t) t.remove();
    if(!on) return;
    log.insertAdjacentHTML('beforeend', `<div class="wc-b ai wc-typing"><span class="wc-av">${avHtml(by)}</span><div class="wc-bw"><small>${by === 'op' ? esc(S().oppNick || '상대') : S().aiName} · 생각 중</small><div class="wc-dots"><i></i><i></i><i></i></div></div></div>`);
    log.scrollTop = log.scrollHeight;
  }
  function msg(html, cls){ const e = $('#wcMsg'); if(!e) return; e.className = 'wc-msg ' + (cls || ''); e.innerHTML = html; }
  function headTxt(){
    const m = S(); if(!m.chain.length) return '';
    return m.rule.rev ? `…${lastW(m)[0]}` : needTxt(m);
  }
  function hud(){
    const m = S(); if(!m) return;
    const c = $('#wcCnt'); if(c) c.textContent = m.myWords;
    const o = $('#wcOpp'); if(o) o.textContent = m.oppWords;
    const h = $('#wcHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.turn !== 'me'; }
    const hd = $('#wcHead'); if(hd){ const t = headTxt(); hd.textContent = t; hd.classList.toggle('two', t.length > 1); }
    const g = $('#wcGold'); if(g){ g.innerHTML = `★ ${m.rule.gold.join('·')} <b>${Math.min(m.goldGot, m.rule.goldNeed)}/${m.rule.goldNeed}</b>`; g.classList.toggle('ok', m.goldGot >= m.rule.goldNeed); }
    const mi = $('#wcMiss'); if(mi) mi.innerHTML = `실수 <b>${m.misses}/1</b>`;
    const inp = $('#wcInput');
    if(inp) inp.placeholder = m.turn === 'me' ? (m.rule.rev ? `‘${lastW(m)[0]}’(으)로 끝나는 낱말` : `‘${needTxt(m)}’(으)로 시작하는 낱말`) : m.turn === 'op' || m.turn === 'ai' ? '상대 차례예요…' : '';
    const st = $('#wcStage'); if(st) st.dataset.turn = m.turn || '';
  }
  /* 휴대폰 화면 키보드가 올라와도 입력 칸과 마지막 낱말이 보이게: 기록 칸 높이를 보이는 화면에 맞춘다 */
  function fit(){
    try{
      const log = $('#wcLog'), form = $('#wcForm'); if(!log || !form) return;
      const vv = window.visualViewport, bottom = vv ? vv.offsetTop + vv.height : innerHeight;
      const top = log.getBoundingClientRect().top, below = form.offsetHeight + ($('#wcMsg') ? $('#wcMsg').offsetHeight : 0) + 18;
      const h = Math.max(150, Math.min(460, Math.floor(bottom - Math.max(0, top) - below)));
      log.style.height = h + 'px';
      log.scrollTop = log.scrollHeight;
    }catch(_){}
  }

  /* ===== 차례 · 시계 ===== */
  const pvp = () => S().net && S().net.live;
  const nowS = () => pvp() ? Date.now() / 1000 : elapsed();   /* 실시간 대전은 멈추지 않는 시계 */
  const turnLimit = m => m.rule.shrink ? Math.max(6, m.cfg.limit - m.myWords) : m.cfg.limit;
  const remain = m => Math.max(0, m.tLim - (nowS() - m.tStart) - m.pen);
  function startMyTurn(){
    const m = S(); if(m.phase !== 'play' || G.over) return;
    if(!cands(m, lastW(m)).length){ lose('kill'); return; }     /* 이을 낱말이 사전에 하나도 없음 = 한방 당함 */
    m.turn = 'me'; m.tLim = turnLimit(m); m.tStart = nowS(); m.pen = 0; m.lastSec = -1; m.hintShown = null;
    hud();
    msg(m.rule.rev ? `<b>‘${lastW(m)[0]}’</b><span>(으)로 끝나는 낱말을 넣어요</span>` : `<b>‘${needTxt(m)}’</b><span>(으)로 시작하는 낱말!</span>`, 'go');
    const inp = $('#wcInput'); if(inp && !G.paused) try{ inp.focus({ preventScroll:true }); }catch(_){}
    sfx('wcTurn');
  }
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const m = S(); if(m.phase !== 'play') return;
    const bar = $('#wcBar'), tp = $('#wcTimeP'), te = $('#wcTime');
    if(m.turn === 'me'){
      if(G.paused && !pvp()) return;
      const rem = remain(m), sec = Math.ceil(rem);
      if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / m.tLim)})`;
      if(sec !== m.lastSec){
        m.lastSec = sec; if(te) te.textContent = sec;
        const hurry = sec <= 5; if(tp) tp.classList.toggle('hurry', hurry); const bw = $('#wcBarW'); if(bw) bw.classList.toggle('hurry', hurry);
        if(hurry && sec > 0){ sfx('wcTick', { hi:sec <= 3 }); try{ if(tp && !FXR.reduce && tp.animate) tp.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:280 }); }catch(_){} }
      }
      if(rem <= 0) lose('time');
    } else if(m.turn === 'op' && m.net && m.net.live){
      /* 상대 차례: 상대 시계를 흉내(내 화면용). 진짜 판정은 상대 기기가 보낸 수로 */
      const rem = Math.max(0, m.cfg.limit - (Date.now() - m.net.turnAt) / 1000), sec = Math.ceil(rem);
      if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / m.cfg.limit)})`;
      if(te && sec !== m.lastSec){ m.lastSec = sec; te.textContent = sec; }
    } else if(bar) bar.style.transform = 'scaleX(1)';
  }

  /* ===== 내가 넣기 ===== */
  function submit(){
    const m = S(), inp = $('#wcInput'); if(!m || !inp || G.over) return;
    const w = inp.value.replace(/\s+/g, '');
    if(!w) return;
    if(m.phase !== 'play' || m.turn !== 'me'){ msg('<span>상대 차례예요. 잠깐만요!</span>', 'soft'); return; }
    if(G.paused && !pvp()) return;
    const e = check(m, w);
    if(e){
      inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
      try{ fxShake($('#wcForm'), 4); }catch(_){}
      sfx('wcBad'); fxBuzz(20);
      if(e.kind === 'rule'){
        m.misses++;
        if(m.rule.tick){ m.pen += m.rule.tick; try{ const q = fxCenter($('#wcTimeP')); fxFloat(q.x, q.y + 30, '−' + m.rule.tick + '초', 'bad'); }catch(_){} }
        if(m.rule.tight && m.misses >= 2){ msg(`<b class="bad">${e.t}</b><span>실수 2번째!</span>`, 'pop'); hud(); lose('miss'); return; }
      }
      msg(`<b class="bad">${e.t}</b><span>${e.dict ? '다른 낱말을 넣어 봐요' : e.kind === 'rule' && m.rule.tight ? '한 번 더 틀리면 끝!' : e.kind === 'rule' && m.rule.tick ? '−' + m.rule.tick + '초' : '다시 넣어요'}</span>`, 'pop');
      hud();
      try{ inp.select(); }catch(_){}
      return;
    }
    inp.value = '';
    play('me', w);
  }
  /* 한 수 두기(나·AI·상대 공통) */
  function play(by, w, extra){
    const m = S();
    const rem = by === 'me' ? remain(m) : 0;
    const x = Object.assign({ w, by }, extra || {});
    m.chain.push(x); m.used.add(w);
    if(by === 'me'){
      m.myWords++; m.myChars += w.length; m.remSum += Math.min(1, rem / m.tLim); m.turns++;
      if(w.length >= 3) m.longW++;
      if(m.rule.gold.some(c => w.includes(c))) m.goldGot++;
      if(m.net && m.net.live) publish(w);
    } else { m.oppWords++; m.oppChars += w.length; }
    m.turn = null; hud();
    const el = logAdd(x);
    /* 효과(보이기만) */
    try{
      if(el){ const t = el.querySelector('.wc-t.to') || el; const q = fxCenter(t); fxBurst(q.x, q.y, by === 'me' ? ['#FF8A3D', '#FFE27A', '#FFFFFF'] : ['#14A3A0', '#B5F0E8', '#FFFFFF'], by === 'me' ? 10 : 6, { speed:200, size:4, kinds:['star', 'dot', 'spark'], up:90, g:420, dur:.55 }); }
      if(by === 'me' && m.rule.gold.some(c => w.includes(c)) && el){ const g = el.querySelector('.wc-t.gold'); if(g){ const q = fxCenter(g); fxEmit(q.x, q.y, { quantity:10, speed:{ min:40, max:160 }, lifespan:{ min:400, max:700 }, kind:'twinkle', tint:['#FFE27A', '#FFB020'], scale:{ start:3, end:.3 }, alpha:{ start:1, end:0 } }); } }
    }catch(_){}
    sfx(by === 'me' ? 'wcPop' : 'wcAi', { n:m.myWords });
    if(by === 'me' && m.combo != null){ m.combo++; if(m.combo >= 3) try{ fxCombo(m.combo); }catch(_){} }
    afterMove(by);
  }
  function afterMove(by){
    const m = S(); if(m.phase !== 'play') return;
    if(m.duelOn){
      if(m.myWords >= m.dTurns && m.oppWords >= m.dTurns){ duelEnd('pts'); return; }
      if(by === 'me') T(oppTurn, 380); else T(startMyTurn, 420);
      return;
    }
    if(by === 'me'){
      const goldOk = m.goldGot >= m.rule.goldNeed;
      if(m.myWords >= m.cfg.goal && goldOk){ win('goal'); return; }
      if(m.myWords >= m.cfg.goal + 5 && !goldOk){ lose('gold'); return; }
      if(m.myWords >= m.cfg.goal && !goldOk && m.myWords === m.cfg.goal) msg('<b>황금 글자 미션이 남았어요</b><span>낱말 5개 안에 채워요</span>', 'pop');
      T(aiTurn, 380);
    } else T(startMyTurn, 420);
  }
  function oppTurn(){ const m = S(); if(m.net && m.net.live){ m.turn = 'op'; m.net.turnAt = Date.now(); m.lastSec = -1; hud(); typing('op', true); msg(`<span><b>${esc(m.oppNick)}</b> 차례예요</span>`, 'soft'); sync(); } else aiTurn(); }

  /* ===== AI 차례 ===== */
  function aiTurn(){
    const m = S(); if(m.phase !== 'play' || G.over) return;
    m.turn = 'ai'; hud(); typing('ai', true);
    msg(`<span>${m.aiName}가 생각하고 있어요…</span>`, 'soft');
    const r = histRng(m, 'wait'), wait = 650 + Math.floor(r() * 650) + (m.myWords > 6 ? 250 : 0);
    T(() => {
      const res = aiPick(m, m.cfg.ai, m.duelOn ? .25 : null, m.duelOn ? .05 : 0);
      if(!res || res.fail){ typing('ai', false); if(m.duelOn) duelEnd(res ? 'oppStuck' : 'oppKilled'); else win('kill'); return; }
      play(m.duelOn ? 'op' : 'ai', W[res.i], res.kill ? { kill:true } : null);
    }, wait);
  }

  /* ===== 힌트: 이을 수 있는 낱말 하나의 첫 두 글자 ===== */
  function useHint(){
    const m = S(); if(!m || G.over || m.phase !== 'play' || m.turn !== 'me' || m.hintLeft <= 0) return;
    const i = helpPick(m, 'hint' + m.hints); if(i == null) return;
    const w = W[i]; m.hintLeft--; m.hints++;
    const show = w.length <= 2 ? w[0] + '○' : w.slice(0, 2) + '○'.repeat(w.length - 2);
    msg(`<span>힌트</span><b class="hint">${show}</b><span>(${w.length}글자)</span>`, 'pop');
    sfx('wcHint'); hud();
    const inp = $('#wcInput'); if(inp) try{ inp.focus({ preventScroll:true }); }catch(_){}
  }
  function giveUp(){
    const m = S(); if(!m || G.over || m.phase !== 'play') return;
    const b = $('#wcGive');
    if(!m.giveArm){ m.giveArm = true; if(b) b.classList.add('arm'); msg('<b class="bad">포기할까요?</b><span>한 번 더 누르면 포기해요</span>', 'pop'); T(() => { m.giveArm = false; const bb = $('#wcGive'); if(bb) bb.classList.remove('arm'); }, 2600); return; }
    lose('give');
  }

  /* ===== 끝 ===== */
  function end(){ const m = S(); m.phase = 'done'; m.turn = null; m.sec = elapsed(); typing('', false); const inp = $('#wcInput'); if(inp) inp.blur(); hud(); }
  function win(why){
    const m = S(); if(m.phase !== 'play') return;
    end(); m.result = why;
    if(why === 'kill'){
      msg('<b class="win">한방 승리!</b><span>AI가 이을 낱말이 없어요</span>', 'win');
      sfx('wcKill'); try{ fxFlash('#FFE27A', .35, 260); const ms = document.querySelectorAll('#wcLog .wc-b.me'), l = ms.length ? ms[ms.length - 1] : $('#wcLog'); const q = fxCenter(l); fxBurst(q.x, q.y, ['#FFE27A', '#FF8A3D', '#14A3A0', '#fff'], 28, { speed:360, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); }catch(_){}
    } else { msg(`<b class="win">${m.cfg.goal}개 잇기 성공!</b><span>끝까지 버텼어요</span>`, 'win'); try{ const q = fxCenter($('#wcLog')); fxRing(q.x, q.y, '#FFE27A', q.w * .6, .7, 12); }catch(_){} }
    fxBuzz([30, 50, 30]);
    T(() => finish(true), 1100);
  }
  const LOSE_TXT = { time:'시간이 다 됐어요', give:'포기했어요', kill:'한방을 맞았어요', miss:'실수를 두 번 했어요', gold:'황금 글자 미션 실패' };
  function lose(why){
    const m = S(); if(m.phase !== 'play') return;
    end(); m.result = why;
    if(m.duelOn){ duelEnd(why === 'kill' ? 'meKilled' : why === 'give' ? 'meGive' : 'meTime'); return; }
    let sub = why === 'kill' ? `‘${needTxt(m)}’(으)로 ${m.rule.rev ? '끝나는' : '시작하는'} 낱말이 사전에 없어요` : `${m.myWords}개 이었어요`;
    msg(`<b class="bad">${LOSE_TXT[why]}</b><span>${sub}</span>`, 'pop');
    sfx(why === 'kill' ? 'wcKilled' : 'wcLose'); fxBuzz([40, 40, 60]); try{ fxShake($('#wcLog'), 5); }catch(_){}
    T(() => finish(false), 1500);
  }

  /* ===== 대전 =====
     같은 시작 낱말로 번갈아 잇기. 각자 dTurns개씩 이으면 글자 수 점수(낱말 글자 × 10)로 승부.
     시간 초과·포기·이을 낱말 없음(한방 맞음)이면 그쪽이 진다. 상대가 없으면 AI(보통, 가끔 못 찾음). */
  const DUEL_TURNS = 8;
  const pts = (chars) => chars * 10;
  function duelEnd(why){
    const m = S(); if(m.ended) return; m.ended = true;
    if(m.phase === 'play') end();
    const me = pts(m.myChars), op = pts(m.oppChars);
    let r, txt;
    if(why === 'pts'){ r = me > op ? 'w' : me < op ? 'l' : 'd'; txt = r === 'd' ? `${DUEL_TURNS}개씩 다 이었어요 · 글자 점수가 같아요!` : `${DUEL_TURNS}개씩 다 이었어요 · 글자 점수 ${fmt(Math.abs(me - op))}점 차이`; }
    else if(why === 'oppKilled'){ r = 'w'; txt = '한방 승리! 상대가 이을 낱말이 없어요'; }
    else if(why === 'oppStuck'){ r = 'w'; txt = '상대가 이을 낱말을 못 찾았어요'; }
    else if(why === 'oppTime'){ r = 'w'; txt = '상대가 시간 안에 못 이었어요'; }
    else if(why === 'oppGive'){ r = 'w'; txt = '상대가 포기했어요 · 기권승'; }
    else if(why === 'oppLeft'){ r = 'w'; txt = '상대가 떠나 기권승이에요'; }
    else if(why === 'meKilled'){ r = 'l'; txt = '한방을 맞았어요 · 이을 낱말이 사전에 없어요'; }
    else if(why === 'meGive'){ r = 'l'; txt = '포기했어요'; }
    else if(why === 'meNet'){ r = 'l'; txt = '연결이 끊겨 대전을 이어 가지 못했어요'; }
    else { r = 'l'; txt = '시간 안에 못 이었어요'; }
    if(m.net && m.net.live && /^me/.test(why)) publish(why === 'meKilled' ? '!k' : why === 'meGive' ? '!g' : why === 'meNet' ? '!q' : '!t');
    const winSide = r === 'w';
    msg(`<b class="${r === 'l' ? 'bad' : 'win'}">${r === 'w' ? '이겼어요!' : r === 'l' ? '졌어요' : '무승부'}</b><span>${txt}</span>`, r === 'w' ? 'win' : 'pop');
    sfx(r === 'w' ? (why === 'oppKilled' ? 'wcKill' : 'wcWinD') : r === 'l' ? 'wcLose' : 'wcAi');
    if(G.duel){ G.duel.r = r; G.duel.a = { sc:me, pg:null }; G.duel.b = { sc:op, pg:null }; G.duel.why = txt; }
    T(() => finish(winSide), 1500);
  }

  /* ----- 실시간 1:1(턴제): 대기실 presence로 짝 찾기 → 둘만의 방 'fl-w-…'에서 presence.mv에 수를 쌓는다 -----
     수 = 낱말 글자 또는 '!t'(시간 초과) '!g'(포기) '!q'(나감·연결 끊김) '!k'(이을 낱말 없음). 자리 0(peer가 작은 쪽)이 먼저 잇고 시작 낱말을 정해 sw로 알린다. */
  const OPP_GRACE = 10;   /* 상대 차례가 제한 시간 + 10초를 넘으면 기권승 */
  function publish(mv){
    const n = S().net; if(!n || !n.nr) return;
    n.mv.push(mv);
    try{ n.nr.presence({ mv:n.mv.slice() }).catch(() => {}); }catch(_){}
  }
  function lobbyClear(){ try{ if(ROOM) ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null }).catch(() => {}); }catch(_){} }
  function searchUI(on){
    const box = $('#wcSearch'), body = $('#wcBody'); if(!box) return;
    box.hidden = !on; if(body) body.classList.toggle('wait', on);
    if(on) box.innerHTML = `<div class="wc-sc"><div class="wc-radar"><i></i><i></i><i></i>${toyImg('fox', 'wc-scav')}</div><h3 id="wcSt">끝말잇기 상대를 찾는 중</h3><p id="wcSn"></p>
      <button class="wc-cta" id="wcAiNow">AI와 바로 대전</button></div>`;
    const b = $('#wcAiNow'); if(b) b.onclick = () => toAI();
  }
  function searchText(){
    const m = S(), n = m.net, st = $('#wcSt'), sn = $('#wcSn'); if(!st || !n) return;
    if(n.phase === 'joining'){ st.textContent = '상대를 찾았어요!'; sn.innerHTML = `<b>${esc(n.oppNick)}</b>님과 연결하는 중…`; return; }
    const left = Math.max(0, 15 - Math.floor((Date.now() - n.t0) / 1000)), k = typeof duelWaiting === 'function' ? duelWaiting(ID) : 0;
    sn.textContent = `${left}초 안에 상대가 없으면 AI와 겨뤄요${k ? ' · 기다리는 사람 ' + k + '명' : ''} · 내 이름 ${n.nick}`;
  }
  function search(){
    const m = S(); const n = m.net = { live:false, phase:'search', t0:Date.now(), nick:duelNick(), mv:[], oc:0 };
    searchUI(true); searchText();
    const room = ROOM; if(!room){ toAI(); return; }
    n.dt = Date.now();
    room.presence({ du:'wait', dg:ID, dt:n.dt, nk:n.nick, dp:null }).catch(() => {});
    const check = () => {
      if(S() !== m || G.over || n.phase !== 'search') return;
      let ps; try{ ps = room.peers(); }catch(_){ return; }
      const me = ps.find(p => p.sameTab); if(!me) return;
      n.myPeer = me.peer;
      const claim = ps.find(p => !p.sameTab && p.presence && p.presence.du === 'play' && p.presence.dg === ID && p.presence.dp === me.peer);
      if(claim){ match(claim); return; }
      const list = ps.filter(p => p.presence && p.presence.du === 'wait' && p.presence.dg === ID && typeof p.presence.dt === 'number')
        .sort((a, b) => a.presence.dt - b.presence.dt || (a.peer < b.peer ? -1 : 1));
      const i = list.findIndex(p => p.sameTab); if(i < 0) return;
      const opp = list[i % 2 ? i - 1 : i + 1]; if(opp) match(opp);
    };
    try{ n.mmUn = room.onPeers(check, () => {}); }catch(_){}
    n.mmIv = setInterval(() => {
      if(S() !== m || G.over){ clearInterval(n.mmIv); return; }
      check(); searchText();
      if(n.phase === 'search' && Date.now() - n.t0 > 15000) toAI();
    }, 500);
  }
  function stopSearch(){ const n = S().net; if(!n) return; clearInterval(n.mmIv); if(n.mmUn) try{ n.mmUn(); }catch(_){} n.mmUn = null; }
  function roomClose(){
    const n = S() && S().net; if(!n) return;
    clearInterval(n.syncIv); if(n.nrUn) try{ n.nrUn(); }catch(_){} n.nrUn = null;
    if(n.nr){ const nr = n.nr; n.nr = null; setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
  }
  async function match(opp){
    const m = S(), n = m.net; if(n.phase !== 'search') return;
    stopSearch();
    n.phase = 'joining'; n.oppPeer = opp.peer; n.oppNick = String((opp.presence && opp.presence.nk) || '상대').slice(0, 12);
    ROOM.presence({ du:'play', dp:opp.peer }).catch(() => {});
    searchText(); sfx('flLock'); fxBuzz([20, 40, 20]);
    const a = [n.myPeer, opp.peer].map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)).sort();
    n.key = a[0] + ':' + a[1];
    let nr;
    try{ nr = await ROOM.join(('fl-w-' + a[0] + '-' + a[1]).slice(0, 50)); }catch(_){ if(S() === m) matchFail(); return; }
    if(S() !== m || n.phase !== 'joining' || G.over){ try{ nr.leave(); }catch(_){} return; }
    n.nr = nr; n.joinT = Date.now(); n.mv = []; n.oc = 0;
    n.seat = String(n.myPeer) < String(opp.peer) ? 0 : 1;
    /* 자리 0이 시작 낱말을 정해 알린다(두 기기 사전이 달라도 같은 판) */
    if(n.seat === 0){ const s = setup(m.cfg, mulberry(seedFrom('wc:pvp:' + n.key))); n.sw = s.start; n.seed = s.seed; }
    nr.presence({ v:1, nk:n.nick, mv:[], sw:n.sw || null }).catch(() => {});
    try{ n.nrUn = nr.onPeers(ch => {
        if(S() !== m) return;
        if(n.oppSeen && ch.left && ch.left.some(p => p.peer === n.oppPeer)){ if(!n.began){ matchFail(); return; } if(!n.oppGone){ n.oppGone = Date.now(); toast('상대 연결이 끊겼어요 · 15초 기다려요'); } }
        else sync();
      }, () => { if(S() === m && !G.over && n.began && !m.ended){ toast('연결이 끊겨서 대전을 이어 가지 못했어요'); if(m.phase === 'play') end(); duelEnd('meNet'); } }); }catch(_){}
    n.syncIv = setInterval(() => { if(S() === m) sync(); }, 250);
  }
  function matchFail(){ const m = S(), n = m.net; roomClose(); n.oppSeen = false; if(G.over) return; toast('상대와 연결하지 못했어요. 다시 찾을게요'); search(); }
  function oppPres(){
    const n = S().net; if(!n || !n.nr) return null;
    let ps; try{ ps = n.nr.peers(); }catch(_){ return null; }
    const o = ps.find(p => !p.sameTab && (p.peer === n.oppPeer || (p.presence && p.presence.nk === n.oppNick)));
    if(o && o.peer !== n.oppPeer){ n.oppPeer = o.peer; n.oppGone = 0; }
    return o ? o.presence || {} : null;
  }
  function sync(){
    const m = S(), n = m && m.net; if(!n || G.over || m.ended) return;
    const o = oppPres();
    if(o && o.nk){ n.oppSeen = true; if(n.oppGone){ n.oppGone = 0; toast('상대가 다시 연결됐어요'); } }
    if(!n.began){
      if(n.phase === 'joining' && o && o.nk && (n.seat === 0 || o.sw)){
        lobbyClear(); n.began = true; n.live = true; n.lastOpp = Date.now();
        if(n.seat === 1){ n.sw = String(o.sw); n.seed = seedFrom('wc:pvp:' + n.key) % 1e9; }
        beginPvp();
      } else if(n.phase === 'joining' && Date.now() - n.joinT > 9000) matchFail();
      return;
    }
    if(n.oppGone && Date.now() - n.oppGone > 15000){ duelEnd('oppLeft'); return; }
    if(m.phase !== 'play') return;
    const mv = o && Array.isArray(o.mv) ? o.mv : [];
    if(m.turn === 'op' && mv.length > n.oc){
      const x = String(mv[n.oc++]); n.lastOpp = Date.now();
      typing('op', false);
      if(x[0] === '!'){ end(); duelEnd(x === '!k' ? 'oppKilled' : x === '!g' ? 'oppGive' : x === '!q' ? 'oppLeft' : 'oppTime'); return; }
      play('op', x);
      return;
    }
    if(m.turn === 'op' && Date.now() - n.turnAt > (m.cfg.limit + OPP_GRACE) * 1000){ end(); duelEnd('oppTime'); }
  }
  function beginPvp(){
    const m = S(), n = m.net;
    searchUI(false);
    m.oppNick = n.oppNick; m.oppKind = oppKind(n.oppNick); m.aiName = n.oppNick;
    if(G.duel){ G.duel.mode = 'pvp'; G.duel.opp = { nick:n.oppNick }; }
    const t = $('#ptitle small'); if(t) t.textContent = '대전 · 실시간 1:1 · ' + n.oppNick;
    const on = $('#wcOppName'); if(on) on.textContent = n.oppNick;
    const oa = $('#wcOppAv'); if(oa) oa.innerHTML = toyImg(m.oppKind, 'wc-hav');
    m.seed = n.seed; m.seat = n.seat;
    startChain(n.sw, 2200);
  }
  function toAI(){
    const m = S(); if(!m || (m.net && m.net.began)) return;
    stopSearch(); roomClose(); lobbyClear();
    if(m.net){ m.net.live = false; m.net.phase = 'ai'; }
    searchUI(false);
    const nick = AI_NAME[1];
    m.oppNick = nick; m.aiName = nick; m.oppKind = 'owl';
    if(G.duel){ G.duel.mode = 'ai'; G.duel.opp = { nick }; }
    const t = $('#ptitle small'); if(t) t.textContent = '대전 · ' + nick;
    const on = $('#wcOppName'); if(on) on.textContent = nick;
    startChain(m.start, 700);
  }

  /* ===== 시작: 시작 낱말을 놓고 첫 차례 ===== */
  function startChain(sw, delay){
    const m = S();
    m.chain = [{ w:sw, by:'start' }]; m.used = new Set([sw]);
    const log = $('#wcLog'); if(log) log.innerHTML = '';
    logAdd(m.chain[0]); hud();
    msg('<span>시작 낱말이 나왔어요</span>', 'soft');
    sfx('wcStart');
    T(() => {
      m.phase = 'play';
      const first = m.duelOn ? (m.seat === 0 ? 'me' : 'op') : 'me';
      if(first === 'me') startMyTurn(); else oppTurn();
    }, delay);
  }

  function wire(){
    const inp = $('#wcInput'), f = $('#wcForm'), go = $('#wcGo');
    if(f) f.onsubmit = e => { e.preventDefault(); submit(); };
    if(inp){
      inp.addEventListener('keydown', e => {
        if(e.key !== 'Enter') return;
        e.preventDefault();
        /* 한글 조합 중 Enter: 조합이 끝난 뒤에 넣는다(마지막 글자가 빠지거나 두 번 들어가지 않게) */
        if(e.isComposing || e.keyCode === 229){ S().pendEnter = true; return; }
        submit();
      });
      inp.addEventListener('compositionend', () => { const m = S(); if(m && m.pendEnter){ m.pendEnter = false; setTimeout(submit, 0); } });
      inp.addEventListener('input', () => inp.classList.remove('bad'));
      inp.addEventListener('focus', () => setTimeout(fit, 250));
      inp.addEventListener('blur', () => setTimeout(fit, 250));
    }
    if(go){ go.addEventListener('pointerdown', e => e.preventDefault()); go.onclick = e => { e.preventDefault(); submit(); }; }   /* 단추를 눌러도 키보드가 내려가지 않게 */
    const h = $('#wcHint'); if(h){ h.addEventListener('pointerdown', e => e.preventDefault()); h.onclick = useHint; }
    const g = $('#wcGive'); if(g){ g.addEventListener('pointerdown', e => e.preventDefault()); g.onclick = giveUp; }
  }

  return {
    name:'끝말잇기', abil:'전략력', col:['#8FE3DA', '#14A3A0', '#0B5E5C'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h7a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 12 12H7.5L4 15v-3.2A2.5 2.5 0 0 1 2.5 9.5z"/><path d="M9.5 14.5A2.5 2.5 0 0 1 12 12h7a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 20 21v-.2L17 23v-2h-5a2.5 2.5 0 0 1-2.5-2.5z" fill-opacity=".7"/></svg>',
    art(){
      const u = 'wcA' + (++SVG_UID);
      const tile = (x, y, c, cls) => `<g transform="translate(${x} ${y})"><rect x="-10" y="-9" width="20" height="21" rx="5" fill="${cls === 'to' ? '#FFB36B' : cls === 'from' ? '#B5F0E8' : '#FFFDF4'}" stroke="${OL}" stroke-width="2"/><text y="6.5" font-size="13" font-weight="900" text-anchor="middle" fill="${OL}" font-family="system-ui,sans-serif">${c}</text></g>`;
      const bub = (x, y, w, h, tail) => `<path d="M${x} ${y + 6}a6 6 0 0 1 6-6h${w - 12}a6 6 0 0 1 6 6v${h - 12}a6 6 0 0 1-6 6H${tail ? x + 16 : x + w - 10}l${tail ? -8 : 8} 7v-7H${x + 6}a6 6 0 0 1-6-6z" fill="#fff" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDF8F3"/><stop offset="1" stop-color="#8FE3DA"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/><g fill="#fff" opacity=".5"><circle cx="12" cy="14" r="3"/><circle cx="148" cy="86" r="4"/><circle cx="140" cy="12" r="2.4"/></g>
        ${bub(8, 10, 64, 34, true)}${tile(26, 26, '사', '')}${tile(48, 26, '과', 'to')}
        ${bub(56, 36, 64, 34, false)}${tile(74, 52, '과', 'from')}${tile(96, 52, '일', 'to')}
        ${bub(88, 62, 64, 30, true)}${tile(106, 76, '일', 'from')}${tile(128, 76, '기', 'to')}
        <path d="M57 15c8-6 16-4 20 4" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/><path d="M57 15c8-6 16-4 20 4" fill="none" stroke="#FF8A3D" stroke-width="2.6" stroke-linecap="round"/><path d="M74 15l3.5 4.5 2-5.5" fill="none" stroke="#FF8A3D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['끝 글자로 이어요', '앞 낱말의 끝 글자로 시작하는 낱말을 넣고 [잇기]를 눌러요. 두음법칙도 돼요(녀→여, 력→역, 라→나, 리→이 …). 사과 → 과일 → 일기'],
      ['두 글자 이상 · 한 번만', '한 글자 낱말과 이미 나온 낱말은 쓸 수 없어요. 사전에 없는 말은 “사전에 없어요” — 실수가 아니니 다른 낱말을 넣으면 돼요.'],
      ['제한 시간 안에!', '내 차례마다 시간이 정해져 있어요. 시간이 다 되거나 포기하면 실패. 정한 수만큼 이으면 성공이에요. 💡 힌트는 이을 낱말의 첫 두 글자를 보여 줘요(점수 −30).'],
      ['한방을 노려요', 'AI가 이을 낱말이 사전에 없는 끝 글자(예: ~름, ~슴, ~릇)로 끝내면 한방 승리! 반대로 AI도 한방을 노리니 조심해요. 긴 낱말일수록 점수가 커요.']
    ],
    helpExtra(){ const m = G && G.id === ID && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ') + (m.rule.ban.length ? ` (금지 글자: ${m.rule.ban.join(', ')})` : '') + (m.rule.gold.length ? ` (황금 글자: ${m.rule.gold.join(', ')} · ${m.rule.goldNeed}개)` : '')]]; },
    chapters:['말놀이 마당', '이야기 골목', '낱말 숲', '글자 바다', '사전 궁전'],
    starRule:'★ 성공 · ★★ 힌트 없이 · ★★★ 힌트 없이 + 한방 승리 또는 세 글자 이상 낱말 5개',
    levels:{
      easy:{ goal:8, limit:20, ai:0, hints:3 },
      normal:{ goal:10, limit:15, ai:1, hints:3 },
      hard:{ goal:12, limit:12, ai:2, hints:2 }
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.goal}개 잇기 · 한 차례 ${c.limit}초 · ${AI_NAME[c.ai]}`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.goal}개 잇기 · 한 차례 ${c.limit}초 · ${AI_NAME[c.ai]}`; },
    init(cfg, rng, lv){
      const s = setup(cfg, rng);
      const duelOn = !!G.duel;
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { cfg, rule:s.rule, start:s.start, seed:s.seed, chain:[], used:new Set(), turn:null, phase:'intro', duelOn, dTurns:DUEL_TURNS,
        seat:duelOn ? (rng() < .5 ? 0 : 1) : 0, aiName:duelOn ? AI_NAME[1] : AI_NAME[cfg.ai || 0], oppNick:null, oppKind:null,
        myWords:0, myChars:0, oppWords:0, oppChars:0, longW:0, goldGot:0, turns:0, remSum:0, misses:0, hints:0, hintLeft:duelOn ? 0 : (cfg.hints == null ? 3 : cfg.hints),
        combo:0, tLim:cfg.limit, tStart:0, pen:0, lastSec:-1, result:null, ended:false, tips, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, timers:new Set(), net:null };
      G.limit = cfg.limit;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onVV){ try{ removeEventListener('resize', m.onVV); if(window.visualViewport) visualViewport.removeEventListener('resize', m.onVV); }catch(_){} }
        if(G && G.raf) cancelAnimationFrame(G.raf);
        const n = m.net;
        if(n){
          clearInterval(n.mmIv); clearInterval(n.syncIv);
          if(n.mmUn) try{ n.mmUn(); }catch(_){} if(n.nrUn) try{ n.nrUn(); }catch(_){}
          if(n.nr){ if(n.began && !m.ended){ n.mv.push('!q'); try{ n.nr.presence({ mv:n.mv.slice() }).catch(() => {}); }catch(_){} } const nr = n.nr; n.nr = null; setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1200); }
          if(n.phase === 'search' || n.phase === 'joining') lobbyClear();
        }
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트·도구용: 이을 수 있는 낱말을 넣어 끝까지 둔다(한방이 있으면 한방) */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.result); return; }
          if(m.phase !== 'play' || m.turn !== 'me'){ setTimeout(step, 80); return; }
          const i = helpPick(m, 'auto', 'kill'); const inp = $('#wcInput');
          if(i == null || !inp){ setTimeout(step, 80); return; }
          inp.value = W[i]; submit(); setTimeout(step, 120);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _dict:{ W, NCORE, IDX, starts, dueum, cands, follow, check, aiPick, setup }, _stage:stageCfg,
    render(st){
      const m = S(), duel = m.duelOn;
      const chips = (G.adv && (m.mj.length || m.tw || m.boss)) ? `<div class="wc-rules">${m.boss ? '<span class="wc-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="wc-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="wc-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}${m.rule.ban.length ? `<span class="wc-chip ban">✕ ${m.rule.ban.join('·')}</span>` : ''}${m.rule.gold.length ? `<span class="wc-chip gold" id="wcGold"></span>` : ''}${m.rule.tight ? '<span class="wc-chip tw" id="wcMiss"></span>' : ''}</div>` : '';
      st.innerHTML = `<div class="ng-wc" id="wcStage">
        <div class="wc-hud">
          <div class="wc-pill" aria-label="${duel ? '내가 이은 낱말' : '이은 낱말'}"><span class="wc-ic">${duel ? toyImg('fox', 'wc-hav') : ICO.word}</span><b id="wcCnt">0</b><small>/${duel ? m.dTurns : m.cfg.goal}</small></div>
          <div class="wc-pill wc-time" id="wcTimeP" aria-label="남은 시간"><span class="wc-ic">${ICO.clock}</span><b id="wcTime">${m.cfg.limit}</b><small>초</small></div>
          ${duel ? `<div class="wc-pill" aria-label="상대가 이은 낱말"><span class="wc-ic" id="wcOppAv">${toyImg('owl', 'wc-hav')}</span><b id="wcOpp">0</b><small>/${m.dTurns}</small></div>`
            : `<button class="wc-pill wc-btn" id="wcHint" aria-label="힌트"><span class="wc-ic">${ICO.hint}</span><b>${m.hintLeft}</b></button>`}
          <button class="wc-pill wc-btn give" id="wcGive" aria-label="포기"><span class="wc-ic">${ICO.flag}</span></button>
        </div>
        <div class="wc-barw" id="wcBarW"><i id="wcBar"></i></div>
        ${chips}
        ${duel ? `<p class="wc-dline">${toyImg('fox', 'wc-hav')}<b>나</b><span>VS</span><b id="wcOppName">${esc(m.oppNick || '상대')}</b> · ${m.dTurns}개씩 이으면 글자 점수로 승부</p>` : ''}
        <div class="wc-body" id="wcBody">
          <div class="wc-log" id="wcLog" role="log" aria-live="polite" aria-label="이어진 낱말"></div>
          <div class="wc-search" id="wcSearch" hidden></div>
        </div>
        <form class="wc-in" id="wcForm" autocomplete="off">
          <span class="wc-head" id="wcHead" aria-hidden="true"></span>
          <input id="wcInput" type="text" lang="ko" inputmode="text" enterkeyhint="send" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="10" aria-label="낱말 넣기">
          <button type="submit" class="wc-go" id="wcGo"><span class="wc-ic">${ICO.send}</span>잇기</button>
        </form>
        <div class="wc-msg" id="wcMsg"><span>시작 낱말을 고르는 중…</span></div>
      </div>`;
      wire(); hud();
      m.onVV = () => fit();
      addEventListener('resize', m.onVV); if(window.visualViewport) visualViewport.addEventListener('resize', m.onVV);
      setTimeout(fit, 30);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
      if(duel && G.lv === 'pvp' && typeof ROOM !== 'undefined' && ROOM){ search(); return; }
      if(duel){ toAI(); return; }
      startChain(m.start, 900);
    },
    progress(){ const m = G && G.m; if(!m) return 0; return Math.min(1, m.myWords / (m.duelOn ? m.dTurns : m.cfg.goal)); },
    lossText(){
      const m = G.m, why = m.result;
      return (why && LOSE_TXT[why] ? LOSE_TXT[why] + '. ' : '') + `낱말 ${m.myWords}개를 이었어요${m.duelOn ? '' : ` (목표 ${m.cfg.goal}개)`}.`;
    },
    score(){
      const m = G.m, goal = m.cfg.goal || 10;
      const avg = m.turns ? m.remSum / m.turns : 0;
      const base = 400 + Math.round(100 * Math.min(1, m.myWords / goal));
      const time = Math.round(250 * avg);
      const longB = Math.min(150, Math.max(0, (m.myChars - 2 * m.myWords) * 15)), killB = m.result === 'kill' ? 100 : 0;
      const extra = Math.max(0, Math.min(250, longB + killB - 30 * m.hints));
      return { base, time, extra, rows:[`이은 낱말 ${m.myWords}개 · ${m.myChars}글자`, `남은 시간 보너스 (평균 ${Math.round(avg * 100)}%)`, `긴 낱말 +${longB}${killB ? ' · 한방 +100' : ''} · 힌트 ${m.hints}번`] };
    },
    stars(){ const m = G.m; return m.hints ? 1 : (m.result === 'kill' || m.longW >= 5) ? 3 : 2; },
    winTitle:'끝말잇기 성공!',
    duelHow:'실시간 1:1 번갈아 잇기 · 한방이면 승리 · 8개씩 이으면 글자 점수',
    /* 대전은 게임이 직접 진행(턴제 실시간). fleet:true = 엔진에 "게임이 대전을 직접 진행"이라고 알림 */
    duelLaunch(){ const live = duelLive(); startGame(ID, live ? 'pvp' : 'normal', { duel:{ fleet:true, mode:live ? 'pvp' : 'ai', opp:{ nick:live ? '상대' : AI_NAME[1] } } }); },
    css:`
body[data-mode="wordchain"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.65), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.28) 0 3px, transparent 3.5px) 0 0/46px 46px,
  linear-gradient(180deg,#E2FAF6 0%,#B9EEE6 55%,#8FDCD2 100%) fixed}
.ng-wc{position:relative; display:flex; flex-direction:column; align-items:stretch; width:100%; max-width:520px; margin:0 auto}
.ng-wc .wc-hud{display:flex; gap:7px; width:100%}
.ng-wc .wc-pill{flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; height:44px; padding:0 8px; border-radius:999px; font:inherit;
  background:linear-gradient(180deg,#FFFFFF,#EEFBF8); border:2.5px solid ${OL}; box-shadow:inset 0 -3px 0 rgba(20,120,110,.14), 0 3px 0 ${OL}; color:#0E4F4B; white-space:nowrap}
.ng-wc .wc-pill b{font-family:var(--heavy); font-size:20px; font-weight:400; line-height:1; font-variant-numeric:tabular-nums}
.ng-wc .wc-pill small{font-family:var(--disp); font-size:14px; color:#4E8A84}
.ng-wc .wc-ic{width:22px; height:22px; flex:none; display:block}
.ng-wc .wc-ic svg{width:100%; height:100%; display:block}
.ng-wc .wc-ic .toy, .ng-wc .wc-hav{width:24px; height:24px; display:block}
.ng-wc .wc-time{flex:1.25 1 0}
.ng-wc .wc-time b{font-size:23px}
.ng-wc .wc-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-wc .wc-time.hurry small{color:#FFE3E3}
.ng-wc .wc-btn{flex:.8 1 0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:linear-gradient(180deg,#FFF6C8,#FFE07A)}
.ng-wc .wc-btn.give{flex:.62 1 0; background:linear-gradient(180deg,#FFFFFF,#E9E4F5)}
.ng-wc .wc-btn.give.arm{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-wc .wc-btn:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(20,120,110,.14), 0 1px 0 ${OL}}
.ng-wc .wc-btn:disabled{opacity:.45; background:#EDEDED; cursor:default}
.ng-wc .wc-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid ${OL}; overflow:hidden}
.ng-wc .wc-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#9EF0E2,#14A3A0); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-wc .wc-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-wc[data-turn="ai"] .wc-barw i, .ng-wc[data-turn="op"] .wc-barw i{background:linear-gradient(180deg,#D8D2EA,#A79FC4)}
.ng-wc .wc-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0}
.ng-wc .wc-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid ${OL}; background:#fff; color:#0E4F4B; box-shadow:0 2px 0 ${OL}; white-space:nowrap}
.ng-wc .wc-chip.mj{background:#E0FAF5; color:#0B5E5C}
.ng-wc .wc-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-wc .wc-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-wc .wc-chip.ban{background:#FFE3E3; color:#B3122E}
.ng-wc .wc-chip.gold{background:#FFF4C2; color:#8A5A00}
.ng-wc .wc-chip.gold.ok{background:#E3FAE8; color:#13703F}
.ng-wc .wc-chip b{font-family:var(--heavy); font-weight:400}
.ng-wc .wc-dline{display:flex; align-items:center; justify-content:center; gap:6px; margin:8px 0 0; font-family:var(--disp); font-size:14px; color:#0E4F4B; white-space:nowrap; overflow:hidden}
.ng-wc .wc-dline b{font-family:var(--heavy); font-weight:400; max-width:40%; overflow:hidden; text-overflow:ellipsis}
.ng-wc .wc-dline span{font-family:var(--heavy); color:#FF8A3D}
.ng-wc .wc-body{position:relative; margin-top:10px}
.ng-wc .wc-log{height:300px; overflow-y:auto; overscroll-behavior:contain; padding:12px 10px 14px; border-radius:20px; background:radial-gradient(circle at 50% 30%, #FBFFFE 0%, #E6F8F4 100%);
  border:3px solid ${OL}; box-shadow:inset 0 0 0 3px rgba(255,255,255,.8), 0 5px 0 ${OL}, 0 14px 22px rgba(10,90,85,.2); display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth}
.ng-wc .wc-body.wait .wc-log{visibility:hidden}
.ng-wc .wc-start{align-self:center; display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 16px 10px; border-radius:16px; background:#fff; border:2.5px dashed #14A3A0}
.ng-wc .wc-start small{font-family:var(--disp); font-size:12.5px; color:#4E8A84}
.ng-wc .wc-b{display:flex; align-items:flex-end; gap:7px; max-width:92%}
.ng-wc .wc-b.me{align-self:flex-end; flex-direction:row-reverse}
.ng-wc .wc-b.ai{align-self:flex-start}
.ng-wc .wc-av{flex:none; width:38px; height:38px; border-radius:50%; background:#fff; border:2.2px solid ${OL}; display:grid; place-items:center; overflow:hidden}
.ng-wc .wc-b.me .wc-av{background:#FFE0C4}
.ng-wc .wc-b.ai .wc-av{background:#E6DAFF}
.ng-wc .wc-avimg{width:34px; height:34px; display:block}
.ng-wc .wc-bw{display:flex; flex-direction:column; gap:3px; min-width:0}
.ng-wc .wc-b.me .wc-bw{align-items:flex-end}
.ng-wc .wc-bw small{font-family:var(--disp); font-size:12px; color:#4E8A84; padding:0 4px}
.ng-wc .wc-bw small .kill{font-family:var(--heavy); font-weight:400; color:#E5484D}
.ng-wc .wc-ws{display:flex; gap:4px; padding:7px 9px; border-radius:16px; background:#fff; border:2.2px solid ${OL}; box-shadow:0 3px 0 ${OL}}
.ng-wc .wc-b.me .wc-ws{background:linear-gradient(180deg,#FFF3E2,#FFE1BF); border-bottom-right-radius:5px}
.ng-wc .wc-b.ai .wc-ws{background:linear-gradient(180deg,#FFFFFF,#EAF7F4); border-bottom-left-radius:5px}
.ng-wc .wc-t{display:grid; place-items:center; width:34px; height:36px; border-radius:9px; background:#FFFDF6; border:2px solid ${OL}; box-shadow:0 2px 0 rgba(26,15,69,.55);
  font-family:var(--heavy); font-size:21px; line-height:1; color:${OL}}
.ng-wc .wc-t.from{background:#C9F3EC}
.ng-wc .wc-t.to{background:linear-gradient(180deg,#FFD08A,#FF9F4D); color:#fff; -webkit-text-stroke:3px ${OL}; paint-order:stroke fill}
.ng-wc .wc-t.gold{box-shadow:0 2px 0 rgba(26,15,69,.55), 0 0 0 3px #FFD23F}
.ng-wc .pop{animation:wc-pop .38s cubic-bezier(.2,1.5,.4,1) both}
@keyframes wc-pop{from{transform:translateY(10px) scale(.7); opacity:0}}
.ng-wc .wc-dots{display:flex; gap:5px; padding:12px 14px; border-radius:16px; background:#fff; border:2.2px solid ${OL}; box-shadow:0 3px 0 ${OL}; border-bottom-left-radius:5px}
.ng-wc .wc-dots i{width:8px; height:8px; border-radius:50%; background:#14A3A0; animation:wc-dot 1s ease-in-out infinite}
.ng-wc .wc-dots i:nth-child(2){animation-delay:.15s} .ng-wc .wc-dots i:nth-child(3){animation-delay:.3s}
@keyframes wc-dot{0%,60%,100%{transform:none; opacity:.4} 30%{transform:translateY(-5px); opacity:1}}
.ng-wc .wc-in{display:flex; align-items:center; gap:7px; margin-top:12px; padding:6px; border-radius:999px; background:#fff; border:3px solid ${OL}; box-shadow:0 4px 0 ${OL}}
.ng-wc .wc-head{flex:none; min-width:44px; height:44px; padding:0 8px; display:grid; place-items:center; border-radius:999px; background:linear-gradient(180deg,#FFD08A,#FF9F4D);
  border:2.2px solid ${OL}; font-family:var(--heavy); font-size:22px; line-height:1; color:#fff; -webkit-text-stroke:3.5px ${OL}; paint-order:stroke fill; white-space:nowrap}
.ng-wc .wc-head.two{font-size:17px}
.ng-wc .wc-head:empty{visibility:hidden}
.ng-wc .wc-in input{flex:1; min-width:0; height:44px; border:0; outline:0; background:transparent; font:inherit; font-family:var(--disp); font-size:20px; color:${OL}; padding:0 4px}
.ng-wc .wc-in input::placeholder{color:#9AB5B1; font-size:15px}
.ng-wc .wc-in input.bad{animation:wc-bad .35s}
@keyframes wc-bad{30%{color:#E5484D}}
.ng-wc .wc-go{flex:none; display:flex; align-items:center; gap:4px; height:44px; padding:0 14px 0 10px; border-radius:999px; border:2.2px solid ${OL}; cursor:pointer; -webkit-tap-highlight-color:transparent;
  background:linear-gradient(180deg,#5FD8CB,#14A3A0); color:#fff; font-family:var(--heavy); font-size:18px; box-shadow:inset 0 -3px 0 rgba(0,60,55,.25), 0 3px 0 ${OL}}
.ng-wc .wc-go .wc-ic{width:20px; height:20px}
.ng-wc .wc-go:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(0,60,55,.25), 0 1px 0 ${OL}}
.ng-wc[data-turn="ai"] .wc-go, .ng-wc[data-turn="op"] .wc-go, .ng-wc[data-turn=""] .wc-go{filter:grayscale(.7); opacity:.75}
.ng-wc .wc-msg{min-height:34px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px 8px; margin-top:6px; font-family:var(--disp); font-size:15px; color:#0E5A55; text-align:center}
.ng-wc .wc-msg b{font-family:var(--heavy); font-weight:400; font-size:19px; color:#fff; -webkit-text-stroke:5px ${OL}; paint-order:stroke fill; letter-spacing:.3px}
.ng-wc .wc-msg b.bad{color:#FF8A8F}
.ng-wc .wc-msg b.win{color:#FFE27A; font-size:22px}
.ng-wc .wc-msg b.hint{color:#FFE27A; font-size:24px; letter-spacing:2px}
.ng-wc .wc-msg.go b{color:#FFB36B}
.ng-wc .wc-msg.pop, .ng-wc .wc-msg.win{animation:wc-in .35s cubic-bezier(.2,1.5,.4,1)}
@keyframes wc-in{from{transform:scale(.6); opacity:0}}
.ng-wc .wc-search{position:absolute; inset:0; display:grid; place-items:center; border-radius:20px; background:linear-gradient(180deg,#FFFFFF,#E6F8F4); border:3px solid ${OL}; box-shadow:0 5px 0 ${OL}; padding:16px; text-align:center}
.ng-wc .wc-search[hidden]{display:none}
.ng-wc .wc-sc h3{margin:10px 0 4px; font-family:var(--heavy); font-weight:400; font-size:20px; color:${OL}}
.ng-wc .wc-sc p{margin:0 0 14px; font-size:14px; color:#4E6F6B; line-height:1.45}
.ng-wc .wc-radar{position:relative; width:96px; height:96px; margin:0 auto; display:grid; place-items:center}
.ng-wc .wc-radar i{position:absolute; inset:0; border-radius:50%; border:3px solid #14A3A0; opacity:0; animation:wc-rad 2.1s ease-out infinite}
.ng-wc .wc-radar i:nth-child(2){animation-delay:.7s} .ng-wc .wc-radar i:nth-child(3){animation-delay:1.4s}
@keyframes wc-rad{0%{transform:scale(.4); opacity:.9} 100%{transform:scale(1.15); opacity:0}}
.ng-wc .wc-scav{width:64px; height:64px; position:relative}
.ng-wc .wc-cta{height:46px; padding:0 22px; border-radius:999px; border:2.5px solid ${OL}; background:linear-gradient(180deg,#FFE27A,#FFB020); font-family:var(--heavy); font-size:17px; color:${OL}; box-shadow:0 3px 0 ${OL}; cursor:pointer}
@media (max-width:370px){ .ng-wc .wc-pill b{font-size:18px} .ng-wc .wc-time b{font-size:20px} .ng-wc .wc-pill small{font-size:12px} .ng-wc .wc-hud{gap:5px} .ng-wc .wc-pill{padding:0 5px} .ng-wc .wc-t{width:30px; height:33px; font-size:19px} .ng-wc .wc-go{padding:0 10px 0 8px; font-size:16px} }
@media (prefers-reduced-motion: reduce){ .ng-wc .pop, .ng-wc .wc-msg.pop, .ng-wc .wc-msg.win{animation:none} .ng-wc .wc-log{scroll-behavior:auto} }
`,
    sounds:{
      wcPop(o){ const n = Math.min(10, o.n || 0); aNoise({ ft:'bandpass', f:2600, q:2, d:.04, v:.05 }); aBell({ f:penta(n + 4, 72), d:.5, v:.08, idx:1.3, rev:.3 }); aBell({ f:penta(n + 6, 72), t:.08, d:.6, v:.06, idx:1.2, rev:.35 }); },
      wcAi(){ aMarimba(m2f(67), { v:.09 }); aMarimba(m2f(71), { t:.07, v:.08 }); },
      wcTurn(){ aTone({ f:880, f2:1180, type:'triangle', d:.08, v:.04, bus:'ui' }); },
      wcBad(){ aTone({ f:330, f2:220, type:'triangle', d:.18, v:.09 }); aThump({ f:140, f2:70, d:.12, v:.1 }); },
      wcHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      wcTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      wcStart(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      wcKill(){ aThump({ f:160, f2:60, d:.3, v:.28 }); [0, 4, 7, 12, 16].forEach((d, i) => aMarimba(m2f(72 + d), { t:.08 + i * .06, v:.14 })); aSparkle({ t:.35, n:7 }); },
      wcKilled(){ aThump({ f:120, f2:45, d:.4, v:.25 }); aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); },
      wcLose(){ aTone({ f:392, f2:262, type:'triangle', d:.5, v:.08 }); },
      wcWinD(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .07, v:.13 })); }
    },
    gate:{ wcTick:250, wcPop:50, wcBad:80 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 진행 수치(duelStat — 실시간 턴제라 막대는 안 쓰지만 계약대로), AI 상대 속도(duelPace) */
Object.assign(NG.wordchain, { duelPace:[150, .6], duelStat:{ unit:'낱말', get:() => ({ v:G.m.myWords, t:G.m.duelOn ? G.m.dTurns : G.m.cfg.goal }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.wordchain.scene = { kind:'bubbles', colors:['#FFFFFF', '#B5F0E8', '#FFE9A8'], density:.8 };
