/* 끝말잇기 */
/* ===== 끝말잇기 (wordchain) · 하루퍼즐 리그 게임 모듈 =====
   앞 낱말의 끝 글자로 시작하는 낱말을 번갈아 잇는다(두음법칙 허용: 녀→여, 력→역, 라→나 …).
   사전은 wordchain-words.js(직접 모은 일반 명사, core = 누구나 아는 말 · extra = 받아 주는 말).
   - 오늘의 문제·연습·솔로: AI와 번갈아 잇기. 시작 낱말·AI 응답은 모두 씨앗 rng(같은 날 같은 시작, 같은 수 → 같은 응답).
   - 대전: 2~5명 돌아가며 잇기(공용 대전 v3 차례 엔진 duelTurn). 못 이으면 탈락, 끝까지 남은 사람이 1등. 사람이 없으면 컴퓨터. */
NG.wordchain = (() => {
  const ID = 'wordchain';
  const OL = '#1A0F45';

  /* ===== 사전 ===== */
  const W = [], IDX = new Map();
  const add = w => { if(w && !IDX.has(w)){ IDX.set(w, W.length); W.push(w); } };
  WC_DICT.core.split(' ').sort().forEach(add);
  const NCORE = W.length;
  WC_DICT.extra.split(' ').sort().forEach(add);
  (WC_DICT.more || '').split(' ').sort().forEach(add);   /* 국어사전 명사 보강(사람이 넣으면 인정) */
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
      long:{ name:'긴 낱말', desc:'두 글자 낱말은 쓸 수 없어요. 나도 컴퓨터도 세 글자 이상 낱말만 이어요.' },
      gold:{ name:'황금 글자', desc:'판마다 황금 글자 3개가 정해져요. 황금 글자가 들어간 낱말을 정해진 수만큼 이어야 성공이에요.' },
      ban:{ name:'금지 글자', desc:'판마다 금지 글자 2개가 정해져요. 그 글자가 들어간 낱말은 나도 컴퓨터도 쓸 수 없어요.' },
      rev:{ name:'거꾸로 잇기', desc:'앞 낱말의 첫 글자로 끝나는 낱말을 이어요. 사과 → 회사 → 사회처럼요. (두음법칙은 없어요)' }
    },
    twists:['flash', 'bare', 'tight', 'tick', 'shrink'],
    twInfo:{
      flash:{ name:'빠른 판', desc:'한 차례 제한 시간이 짧아요. 떠오르는 대로 빠르게!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 내 머릿속 사전으로 이어요.' },
      tight:{ name:'외줄 타기', desc:'첫 글자가 틀리거나 이미 쓴 말·규칙에 어긋난 말은 한 번만 봐줘요. 두 번째면 끝! (사전에 없는 말은 괜찮아요)' },
      tick:{ name:'째깍 벌칙', desc:'첫 글자가 틀리거나 이미 쓴 말을 넣으면 그 차례 시간이 3초 줄어요.' },
      shrink:{ name:'줄어드는 시계', desc:'내 차례가 지날수록 제한 시간이 1초씩 줄어요(최소 6초).' }
    }
  };
  const RULE_TIP = { long:'세 글자 이상만', gold:'황금 글자 미션', ban:'금지 글자 조심', rev:'첫 글자로 끝나게', flash:'시간이 짧아요', bare:'힌트 없음', tight:'규칙 실수 1번까지', tick:'틀리면 −3초', shrink:'차례마다 −1초' };
  const AI_NAME = ['순한 컴퓨터', '보통 컴퓨터', '영리한 컴퓨터', '끝내기 컴퓨터'];   /* 2026-10-06 쉬운 말: AI → 컴퓨터, 한방 → 끝내기 */
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
    if(tw === 'flash') limit = Math.max(12, Math.round(limit * 0.7));   /* 빠른 판: 최소 12초(50대 "9초는 너무 짧다") */
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
  function avHtml(by, pid){
    const m = S();
    if(by === 'me') return toyImg('fox', 'wc-avimg');
    if(m.dw && pid) return toyImg(oppKind(dWho(pid).nick), 'wc-avimg');   /* 대전: 참가자마다 동물 얼굴 */
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
    const who = by === 'me' ? '나' : m.dw && x.pid ? esc(duelShortNick(dWho(x.pid).nick)) + (x.pid === 'ai' ? ' (컴퓨터)' : '') : by === 'op' ? esc(m.oppNick || '상대') : (m.aiName || '컴퓨터');
    const sc = m.dw && x.pid && by !== 'me' ? ` style="--sc:${dWho(x.pid).col}"` : '';
    return `<div class="wc-b ${by === 'me' ? 'me' : 'ai'}${sc ? ' seat' : ''}" data-n="${n}"${sc}><span class="wc-av">${avHtml(by, x.pid)}</span><div class="wc-bw"><small>${who}${x.kill ? ' · <b class="kill">끝내기 낱말!</b>' : ''}</small><div class="wc-ws">${tilesHtml(x.w, true, true)}</div></div></div>`;
  }
  /* 이은 낱말 기차(보이기만): 최근 8개를 칸으로 잇고, 새 낱말이 오른쪽에 붙으면 앞 칸은 왼쪽으로 밀려난다 */
  const TRAIN_N = 8;
  function train(){
    try{
      const m = S(), e = $('#wcTrain'); if(!e || !m.chain) return;
      const list = m.chain.slice(-TRAIN_N), off = m.chain.length - list.length;
      e.innerHTML = list.map((x, j) => `${j ? '<i class="wc-link"></i>' : ''}<span class="wc-car ${x.by === 'me' ? 'me' : x.by === 'start' ? 'st' : 'ai'}${x.kill ? ' kill' : ''}${j === list.length - 1 && off + j > 0 ? ' new' : ''}">${esc(x.w)}</span>`).join('');
      const hide = m.chain.length < 2; if(e.hidden !== hide){ e.hidden = hide; setTimeout(fit, 0); }   /* 기차가 나타나면 기록 칸 높이를 다시 맞춤 */
      e.scrollLeft = e.scrollWidth;
    }catch(_){}
  }
  function logAdd(x){
    train();
    const log = $('#wcLog'); if(!log) return null;
    const t = log.querySelector('.wc-typing'); if(t) t.remove();
    const gd = log.querySelector('.wc-guide'); if(gd) gd.remove();
    log.insertAdjacentHTML('beforeend', bubble(x, S().chain.length - 1));
    const el = log.lastElementChild; el.classList.add('pop');
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(by, on){
    const log = $('#wcLog'); if(!log) return;
    const t = log.querySelector('.wc-typing'); if(t) t.remove();
    if(!on) return;
    const m = S(), dp = m.dw && by !== 'op' && by !== 'ai' ? by : m.dw && by === 'ai' ? 'ai' : null;   /* 대전: by = 참가자 번호 */
    log.insertAdjacentHTML('beforeend', `<div class="wc-b ai wc-typing"><span class="wc-av">${avHtml(dp ? 'op' : by, dp)}</span><div class="wc-bw"><small>${dp ? esc(duelShortNick(dWho(dp).nick)) : by === 'op' ? esc(m.oppNick || '상대') : m.aiName} · 생각 중</small><div class="wc-dots"><i></i><i></i><i></i></div></div></div>`);
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
    const o = $('#wcAlive'); if(o && m.dw) try{ o.textContent = dAlive().length; }catch(_){}
    const h = $('#wcHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.turn !== 'me'; }
    const hd = $('#wcHead'); if(hd){ const t = headTxt(); hd.textContent = t; hd.classList.toggle('two', t.length > 1); }
    const g = $('#wcGold'); if(g){ g.innerHTML = `★ ${m.rule.gold.join('·')} <b>${Math.min(m.goldGot, m.rule.goldNeed)}/${m.rule.goldNeed}</b>`; g.classList.toggle('ok', m.goldGot >= m.rule.goldNeed); }
    const mi = $('#wcMiss'); if(mi) mi.innerHTML = `실수 <b>${m.misses}/1</b>`;
    const inp = $('#wcInput');
    if(inp) inp.placeholder = m.dw && m.dw.P[m.dw.me].out ? '탈락했어요 · 함께 구경해요' : m.turn === 'me' ? (m.rule.rev ? `‘${lastW(m)[0]}’(으)로 끝나는 낱말` : `‘${needTxt(m)}’(으)로 시작하는 낱말`) : m.turn === 'op' || m.turn === 'ai' ? '상대 차례예요…' : '';
    const st = $('#wcStage'); if(st) st.dataset.turn = m.turn || '';
    fresh();
  }
  /* 처음(시작 낱말만 있을 때): 빈 기록 칸 대신 가운데에 시작 낱말과 안내를 크게 보여 준다(보이기만) */
  function fresh(){
    try{
      const m = S(), log = $('#wcLog'); if(!log) return;
      const on = m.chain.length === 1 && m.phase !== 'done';
      log.classList.toggle('fresh', on);
      let g = log.querySelector('.wc-guide');
      if(!on){ if(g) g.remove(); return; }
      const txt = m.turn === 'me' ? (m.rule.rev ? `<b>‘${lastW(m)[0]}’</b>(으)로 <b>끝나는</b> 낱말을 넣어요` : `<b>‘${needTxt(m)}’</b>(으)로 시작하는 낱말을 넣어요`) : m.turn ? '상대가 먼저 이어요' : '곧 시작해요';
      const goal = m.duelOn ? `차례에 못 이으면 탈락 · 끝까지 남으면 1등 (모두 ${m.dTurns}개씩 이으면 글자 점수)` :`${m.cfg.goal}개를 이으면 성공 · 상대가 못 이으면 끝내기 승리`;
      const html = `<p class="wc-gt">${txt}</p><p class="wc-gs">${goal}</p>`;
      if(!g){ log.insertAdjacentHTML('beforeend', `<div class="wc-guide">${html}</div>`); }
      else if(g.innerHTML !== html){ g.innerHTML = html; log.appendChild(g); }
    }catch(_){}
  }
  /* 휴대폰 화면 키보드가 올라와도 입력 칸과 마지막 낱말이 보이게: 기록 칸 높이를 보이는 화면에 맞춘다 */
  function fit(){
    try{
      const log = $('#wcLog'), form = $('#wcForm'); if(!log || !form) return;
      const vv = window.visualViewport, bottom = vv ? vv.offsetTop + vv.height : innerHeight;
      const top = log.getBoundingClientRect().top, below = form.offsetHeight + ($('#wcMsg') ? $('#wcMsg').offsetHeight : 0) + 18;
      const h = Math.max(150, Math.min(640, Math.floor(bottom - Math.max(0, top) - below - 8)));
      log.style.height = h + 'px'; log.classList.toggle('short', h < 300);   /* 키보드가 올라와 낮아지면 처음 안내를 작게 */
      log.scrollTop = log.scrollHeight;
    }catch(_){}
  }

  /* ===== 차례 · 시계 ===== */
  const pvp = () => !!S().dw;   /* 대전: 멈추지 않는 시계, 차례 시간은 엔진(duelTurn.left) */
  const nowS = () => elapsed();
  const turnLimit = m => m.rule.shrink ? Math.max(6, m.cfg.limit - m.myWords) : m.cfg.limit;
  const remain = m => { if(m.dw){ const l = duelTurn.left(); return l == null ? m.tLim : l; } return Math.max(0, m.tLim - (nowS() - m.tStart) - m.pen); };
  function startMyTurn(){
    const m = S(); if(m.phase !== 'play' || G.over) return;
    if(!m.dw && !cands(m, lastW(m)).length){ lose('kill'); return; }     /* 이을 낱말이 사전에 하나도 없음 = 한방 당함(대전은 dTurnStart가 탈락 처리) */
    m.turn = 'me'; m.tLim = turnLimit(m); m.tStart = nowS(); m.pen = 0; m.lastSec = -1; m.hintShown = null; m.timeShown = false; m.giveArm = false;
    hud();
    msg(m.rule.rev ? `<b>‘${lastW(m)[0]}’</b><span>(으)로 끝나는 낱말을 넣어요</span>` : `<b>‘${needTxt(m)}’</b><span>(으)로 시작하는 낱말!</span>`, 'go');
    const inp = $('#wcInput'); if(inp && !G.paused) try{ inp.focus({ preventScroll:true }); }catch(_){}
    sfx('wcTurn');
  }
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const m = S();
    if(m.dw && m.phase === 'intro' && G.duel.go) startChain(m.start, 0);   /* 대전: 모두 같은 순간(엔진 카운트다운 끝)에 시작 */
    if(m.dw) dPoll();
    if(m.phase !== 'play') return;
    const bar = $('#wcBar'), tp = $('#wcTimeP'), te = $('#wcTime');
    if(m.turn === 'me'){
      if(G.paused && !pvp()) return;
      const rem = remain(m), sec = Math.ceil(rem);
      if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / m.tLim)})`;
      if(sec !== m.lastSec){
        m.lastSec = sec; if(te) te.textContent = sec;
        const hurry = sec <= 5; if(tp) tp.classList.toggle('warn', hurry); const bw = $('#wcBarW'); if(bw) bw.classList.toggle('hurry', hurry);
        if(hurry && sec > 0){ sfx('wcTick', { hi:sec <= 3 }); try{ if(tp && !FXR.reduce && tp.animate) tp.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:280 }); }catch(_){} }
      }
      if(rem <= 0){ if(m.dw){ if(!m.timeShown){ m.timeShown = true; msg('<b class="bad">시간이 다 됐어요</b><span>잠깐만요…</span>', 'pop'); } } else lose('time'); }   /* 대전: 탈락은 엔진의 시간 초과 사건으로(모든 기기 같게) */
    } else if(m.dw && (m.turn === 'op' || m.turn === 'ai')){
      /* 대전에서 남의 차례: 엔진 차례 시계(모든 기기 같음)를 그대로 보여 줌 */
      const l = duelTurn.left(), rem = l == null ? m.cfg.limit : l, sec = Math.ceil(rem);
      if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / m.cfg.limit)})`;
      if(te && sec !== m.lastSec){ m.lastSec = sec; te.textContent = sec; if(tp) tp.classList.remove('warn'); const bw = $('#wcBarW'); if(bw) bw.classList.remove('hurry'); }
    } else {
      /* 상대·컴퓨터 차례: 내 차례에 남았던 숫자(예: 10)가 그대로 보이지 않게, 다음 내 차례 시간을 보여 준다 */
      if(bar) bar.style.transform = 'scaleX(1)';
      if(m.lastSec !== 'idle'){ m.lastSec = 'idle'; if(te) te.textContent = turnLimit(m); if(tp) tp.classList.remove('warn'); const bw = $('#wcBarW'); if(bw) bw.classList.remove('hurry'); }
    }
  }

  /* ===== 내가 넣기 ===== */
  function submit(){
    const m = S(), inp = $('#wcInput'); if(!m || !inp || G.over) return;
    const w = inp.value.replace(/\s+/g, '').normalize('NFC');   /* 자모가 나뉘어 들어오는 입력기(맥 등)도 사전과 맞게 */
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
        if(m.dw){   /* 대전: 규칙 실수는 한 번 봐주고 두 번째면 탈락 */
          m.dw.P[m.dw.me].miss = m.misses;
          if(m.misses >= 2){ msg(`<b class="bad">${e.t}</b><span>실수 2번째!</span>`, 'pop'); if(duelTurn.act('out', { k:'miss' })) dOut(m.dw.me, 'miss'); return; }
          msg(`<b class="bad">${e.t}</b><span>한 번 더 틀리면 탈락!</span>`, 'pop'); hud(); try{ inp.select(); }catch(_){} return;
        }
        if(m.rule.tick){ m.pen += m.rule.tick; try{ const q = fxCenter($('#wcTimeP')); fxFloat(q.x, q.y + 30, '−' + m.rule.tick + '초', 'bad'); }catch(_){} }
        if(m.rule.tight && m.misses >= 2){ msg(`<b class="bad">${e.t}</b><span>실수 2번째!</span>`, 'pop'); hud(); lose('miss'); return; }
      }
      msg(`<b class="bad">${e.t}</b><span>${e.dict ? '다른 낱말을 넣어 봐요' : e.kind === 'rule' && m.rule.tight ? '한 번 더 틀리면 끝!' : e.kind === 'rule' && m.rule.tick ? '−' + m.rule.tick + '초' : '다시 넣어요'}</span>`, 'pop');
      hud();
      try{ inp.select(); }catch(_){}
      return;
    }
    if(m.dw && !duelTurn.act('w', { w })){ msg('<b class="bad">시간이 지났어요</b><span>이번 차례는 넘어가요</span>', 'pop'); return; }   /* 늦은 수는 엔진이 막음 */
    inp.value = '';
    play('me', w, m.dw ? { pid:m.dw.me } : null);
  }
  /* 한 수 두기(나·AI·상대 공통) */
  function play(by, w, extra){
    const m = S();
    const rem = by === 'me' ? remain(m) : 0;
    const x = Object.assign({ w, by }, extra || {});
    m.chain.push(x); m.used.add(w);
    if(m.dw && x.pid){ const q = m.dw.P[x.pid]; if(q){ q.words++; q.chars += w.length; } if(!cands(m, w).length) x.kill = true; dSyncAi(); }   /* 대전: 다음 사람이 이을 낱말이 없으면 끝내기 낱말 */
    if(by === 'me'){
      m.myWords++; m.myChars += w.length; m.remSum += Math.min(1, rem / m.tLim); m.turns++;
      if(w.length >= 3) m.longW++;
      if(m.rule.gold.some(c => w.includes(c))) m.goldGot++;
    } else { m.oppWords++; m.oppChars += w.length; }
    m.turn = null; hud(); if(m.dw) order();
    const el = logAdd(x);
    /* 효과(보이기만) */
    try{
      if(el){ const t = el.querySelector('.wc-t.to') || el; const q = fxCenter(t); fxBurst(q.x, q.y, by === 'me' ? ['#FF8A3D', '#FFE27A', '#FFFFFF'] : ['#14A3A0', '#B5F0E8', '#FFFFFF'], by === 'me' ? 10 : 6, { speed:200, size:4, kinds:['star', 'dot', 'spark'], up:90, g:420, dur:.55 }); }
      if(x.kill){ fxShake($('#wcStage'), 7); fxFlash('#FF8A3D', .3, 220); const q = fxCenter(el || $('#wcLog')); fxBurst(q.x, q.y, ['#FF8A3D', '#FFE27A', '#E5484D', '#fff'], 24, { speed:340, size:6, kinds:['star', 'dot', 'spark'], up:120, g:420, glow:true, dur:.9 }); }
      if(by === 'me' && m.rule.gold.some(c => w.includes(c)) && el){ const g = el.querySelector('.wc-t.gold'); if(g){ const q = fxCenter(g); fxEmit(q.x, q.y, { quantity:10, speed:{ min:40, max:160 }, lifespan:{ min:400, max:700 }, kind:'twinkle', tint:['#FFE27A', '#FFB020'], scale:{ start:3, end:.3 }, alpha:{ start:1, end:0 } }); } }
    }catch(_){}
    sfx(by === 'me' ? 'wcPop' : 'wcAi', { n:m.myWords });
    if(by === 'me' && m.combo != null){ m.combo++; if(m.combo >= 3) try{ fxCombo(m.combo); }catch(_){} }
    afterMove(by);
  }
  function afterMove(by){
    const m = S(); if(m.phase !== 'play') return;
    if(m.dw){ dCheckEnd(); return; }   /* 대전: 다음 차례는 엔진 차례(dPoll)가 정함 */
    if(by === 'me'){
      const goldOk = m.goldGot >= m.rule.goldNeed;
      if(m.myWords >= m.cfg.goal && goldOk){ win('goal'); return; }
      if(m.myWords >= m.cfg.goal + 5 && !goldOk){ lose('gold'); return; }
      if(m.myWords >= m.cfg.goal && !goldOk && m.myWords === m.cfg.goal) msg('<b>황금 글자 미션이 남았어요</b><span>낱말 5개 안에 채워요</span>', 'pop');
      T(aiTurn, 380);
    } else T(startMyTurn, 420);
  }
  /* ===== AI 차례 ===== */
  function aiTurn(){
    const m = S(); if(m.phase !== 'play' || G.over) return;
    m.turn = 'ai'; m.lastSec = -1; hud(); typing('ai', true);
    msg(`<span>${m.dw ? esc(duelShortNick(dWho('ai').nick)) + '님이' : m.aiName + '가'} 생각하고 있어요…</span>`, 'soft');
    const r = histRng(m, 'wait'), wait = (m.dw ? 1500 + Math.floor(r() * 2000) : 650 + Math.floor(r() * 650)) + (m.myWords > 6 ? 250 : 0);   /* 대전 컴퓨터는 1.5~3.5초 생각 */
    const n0 = m.dw ? duelTurn.n() : 0;
    T(() => {
      if(m.dw && (duelTurn.cur() !== 'ai' || duelTurn.n() !== n0 || m.dw.ended)) return;
      const res = aiPick(m, m.cfg.ai, m.duelOn ? .25 : null, m.duelOn ? .05 : 0);
      if(m.dw){
        typing('ai', false);
        if(!res || res.fail){ if(duelTurn.act('out', { k:res ? 'stuck' : 'kill' }, { as:'ai' })) dOut('ai', res ? 'stuck' : 'kill'); return; }
        if(duelTurn.act('w', { w:W[res.i] }, { as:'ai' })) play('ai', W[res.i], { pid:'ai', kill:!!res.kill });
        return;
      }
      if(!res || res.fail){ typing('ai', false); win('kill'); return; }
      play('ai', W[res.i], res.kill ? { kill:true } : null);
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
    if(m.dw && (m.dw.P[m.dw.me].out || m.dw.ended)) return;
    if(m.dw && m.turn !== 'me'){ msg('<span>포기는 내 차례에만 할 수 있어요</span>', 'soft'); return; }
    if(!m.giveArm){ m.giveArm = true; if(b) b.classList.add('arm'); msg('<b class="bad">포기할까요?</b><span>한 번 더 누르면 포기해요</span>', 'pop'); T(() => { m.giveArm = false; const bb = $('#wcGive'); if(bb) bb.classList.remove('arm'); }, 2600); return; }
    if(m.dw){ if(duelTurn.act('out', { k:'give' })) dOut(m.dw.me, 'give'); return; }
    lose('give');
  }

  /* ===== 끝 ===== */
  function end(){ const m = S(); m.phase = 'done'; m.turn = null; m.sec = elapsed(); typing('', false); const inp = $('#wcInput'); if(inp) inp.blur(); hud(); }
  function win(why){
    const m = S(); if(m.phase !== 'play') return;
    end(); m.result = why;
    if(why === 'kill'){
      msg('<b class="win">끝내기 승리!</b><span>컴퓨터가 이을 낱말이 없어요</span>', 'win');
      sfx('wcKill'); try{ fxShake($('#wcStage'), 7); fxFlash('#FFE27A', .35, 260); const ms = document.querySelectorAll('#wcLog .wc-b.me'), l = ms.length ? ms[ms.length - 1] : $('#wcLog'); const q = fxCenter(l); fxBurst(q.x, q.y, ['#FFE27A', '#FF8A3D', '#14A3A0', '#fff'], 28, { speed:360, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); }catch(_){}
    } else { msg(`<b class="win">${m.cfg.goal}개 잇기 성공!</b><span>끝까지 버텼어요</span>`, 'win'); try{ const q = fxCenter($('#wcLog')); fxRing(q.x, q.y, '#FFE27A', q.w * .6, .7, 12); }catch(_){} }
    fxBuzz([30, 50, 30]);
    T(() => finish(true), 1100);
  }
  const LOSE_TXT = { time:'시간이 다 됐어요', give:'포기했어요', kill:'끝내기 낱말을 받았어요', miss:'실수를 두 번 했어요', gold:'황금 글자 미션 실패' };
  function lose(why){
    const m = S(); if(m.phase !== 'play') return;
    end(); m.result = why;
    let sub = why === 'kill' ? `‘${needTxt(m)}’(으)로 ${m.rule.rev ? '끝나는' : '시작하는'} 낱말이 사전에 없어요` : `${m.myWords}개 이었어요`;
    msg(`<b class="bad">${LOSE_TXT[why]}</b><span>${sub}</span>`, 'pop');
    sfx(why === 'kill' ? 'wcKilled' : 'wcLose'); fxBuzz([40, 40, 60]); try{ fxShake($('#wcLog'), 5); }catch(_){}
    T(() => finish(false), 1500);
  }

  /* ===== 대전: 2~5명 돌아가며 잇기(대전 v3 차례 엔진, docs/21 WP11) =====
     - 같은 씨앗 → 같은 시작 낱말. 차례 순서 = 엔진 참가 순서(duelTurn). 모든 기기가 같은 사건 순서로 같은 상태를 계산한다.
     - 수: act('w', { w:낱말 }) · 탈락 act('out', { k:'kill'|'give'|'miss' }) · 이미 탈락한 사람 차례는 그 기기가 바로 act('p')(넘김)
     - 시간 초과(엔진이 모든 기기에서 같은 '대신 하기' timeout을 냄) = 탈락. 차례인 사람이 나가면 엔진이 'skip' → 탈락
     - 이을 낱말이 사전에 없음(끝내기 낱말을 받음)·포기·규칙 실수 2번째도 탈락. 사전에 없는 말은 다시 넣기(실수 아님)
     - 끝: 남은 사람이 1명이면 그 사람 1위, 또는 남은 사람 모두 정한 수(2명 8 · 3명 6 · 4~5명 5개)를 이으면 글자 점수로 순위
     - 순위 = 탈락 순서(늦게 탈락할수록 위) → 끝까지 남은 사람은 글자 점수. 순위 열쇠는 duelStat의 lf(남은 사람 1000 + 글자 수, 탈락 = 탈락 번째 수)
     - 컴퓨터 상대(사람이 없을 때 1:1): 보통 컴퓨터 + 끝내기 25% + 가끔 못 찾음 */
  const DUEL_TURNS = 8;
  const duelCap = n => n <= 2 ? 8 : n === 3 ? 6 : 5;
  const pts = chars => chars * 10;
  const DW = () => S() && S().dw;
  const dSrv = () => { try{ return duelSrv(); }catch(_){ return Date.now(); } };
  function dPpl(){ const d = DW(); if(!d) return {}; if(!d.ppl || Date.now() - d.pplAt > 800){ d.ppl = {}; try{ duelPlayers().forEach(p => { d.ppl[p.pid] = p; }); }catch(_){} d.pplAt = Date.now(); } return d.ppl; }
  const dWho = pid => dPpl()[pid] || { pid, nick:'상대', col:'#2F7BFF', shape:'square' };
  const dNm = pid => { const d = DW(); return d && pid === d.me ? '나' : duelShortNick(dWho(pid).nick); };
  const dAlive = () => { const d = DW(), pp = dPpl(); return G.duel.pl.filter(p => !d.P[p].out && !(pp[p] && pp[p].left)); };
  /* 순위 열쇠(lf): 남은 사람 1000 + 글자 수, 탈락 = 몇 번째로 탈락했는지(1부터) */
  const dKey = pid => { const q = DW().P[pid]; return q.out ? q.outN : 1000 + q.chars; };
  function dSyncAi(){
    try{ const D = G.duel, A = D.P.ai, d = DW(); if(!A || !d.P.ai) return; const q = d.P.ai;
      if(q.words > (A.st.v || 0)) A.st.la = Math.round(dSrv());
      Object.assign(A.st, { v:q.words, lf:dKey('ai'), mis:q.miss, pg:Math.min(1, q.words / d.cap) }); }catch(_){}
  }
  function dInit(cfg){
    const m = S(), D = G.duel;
    m.dw = { me:D.myPid, cap:duelCap(D.pl.length), P:{}, outN:0, ended:false, lastKey:'', aiBusy:false, sec:cfg.limit };
    D.pl.forEach(p => { m.dw.P[p] = { words:0, chars:0, miss:0, out:null, outN:0 }; });
    m.dTurns = m.dw.cap; G.limit = 0;   /* 판 전체 시간 제한 없음(차례 시간만) */
    try{ duelTurn.timeout(cfg.limit); duelTurn.onAct(dOnAct); }catch(_){}
    m.dIv = setInterval(dPoll, 200);   /* 화면이 가려져 그림이 멈춰도 차례 넘김은 돌게 */
  }
  /* 다른 사람의 수 · 엔진의 대신 하기(시간 초과) · 나간 사람 건너뛰기 */
  function dOnAct(a){
    const m = S(), d = DW(); if(!m || !d || d.ended || G.over) return;
    const q = d.P[a.pid]; if(!q) return;
    if(a.kind === 'w' && a.data && a.data.w){ typing('', false); play(a.pid === 'ai' ? 'ai' : 'op', String(a.data.w).slice(0, 12), { pid:a.pid }); return; }
    if(a.kind === 'out') dOut(a.pid, a.data && a.data.k || 'give');
    else if(a.kind === 'timeout' && !q.out) dOut(a.pid, 'time');
    else if(a.kind === 'skip' && !q.out) dOut(a.pid, 'left');
  }
  const OUT_TXT = { time:'시간 안에 못 이었어요', give:'포기했어요', kill:'이을 낱말이 사전에 없어요', miss:'규칙 실수 2번', left:'나갔어요', stuck:'이을 낱말을 못 찾았어요' };
  function dOut(pid, why){
    const m = S(), d = DW(), q = d.P[pid]; if(!q || q.out) return;
    q.out = why; q.outN = ++d.outN;
    typing('', false);
    const me = pid === d.me, who = dWho(pid);
    const log = $('#wcLog'); if(log){ log.insertAdjacentHTML('beforeend', `<div class="wc-out pop"><b>${me ? '나' : esc(duelShortNick(who.nick))}</b> 탈락 · ${OUT_TXT[why] || ''}</div>`); log.scrollTop = log.scrollHeight; }
    if(me){
      m.turn = null; m.result = why;
      msg(`<b class="bad">탈락했어요</b><span>${OUT_TXT[why] || ''} · 끝날 때까지 함께 봐요</span>`, 'pop');
      sfx(why === 'kill' ? 'wcKilled' : 'wcLose'); fxBuzz([40, 40, 60]); try{ fxShake($('#wcLog'), 5); }catch(_){}
      const inp = $('#wcInput'); if(inp){ inp.value = ''; inp.blur(); }
    } else {
      try{ duelNotify(`${esc(duelShortNick(who.nick))}님 탈락 · ${OUT_TXT[why] || ''}`, { from:who, kind:'good', force:true }); }catch(_){}
      sfx(why === 'kill' ? 'wcKill' : 'wcAi');
    }
    dSyncAi(); order(); hud(); dCheckEnd();
  }
  /* 차례가 바뀌었는지 살핌(0.2초마다 + 그림 틀마다) */
  function dPoll(){
    const m = S(), d = DW(); if(!m || !d || G.over || d.ended || m.phase !== 'play') return;
    dCheckEnd(); if(d.ended) return;
    const cur = duelTurn.cur(), key = cur + ':' + duelTurn.n();
    if(key === d.lastKey) return;
    d.lastKey = key; dTurnStart(cur);
  }
  function dTurnStart(cur){
    const m = S(), d = DW(), q = d.P[cur]; if(!q) return;
    order();
    if(cur === d.me){
      if(q.out){ m.turn = null; duelTurn.act('p', null); hud(); return; }               /* 이미 탈락: 바로 넘김 */
      if(!cands(m, lastW(m)).length){ m.turn = null; if(duelTurn.act('out', { k:'kill' })) dOut(d.me, 'kill'); return; }   /* 끝내기 낱말을 받음 */
      startMyTurn(); return;
    }
    if(cur === 'ai'){
      if(q.out){ duelTurn.act('p', null, { as:'ai' }); return; }
      aiTurn(); return;
    }
    m.turn = q.out ? null : 'op'; m.lastSec = -1; hud();
    if(!q.out){ typing(cur, true); msg(`<span><b>${esc(duelShortNick(dWho(cur).nick))}</b>님 차례예요</span>`, 'soft'); }
  }
  function dCheckEnd(){
    const m = S(), d = DW(); if(!d || d.ended) return;
    const alive = dAlive();
    let why = null;
    if(alive.length <= 1) why = alive.length ? (alive[0] === d.me ? '내가 끝까지 남았어요!' : `${esc(dNm(alive[0]))}님이 끝까지 남았어요`) : '모두 탈락했어요';
    else if(alive.every(p => d.P[p].words >= d.cap)) why = `모두 ${d.cap}개씩 이었어요 · 글자 점수로 순위를 매겼어요`;
    if(!why) return;
    d.ended = true; end();
    const keys = G.duel.pl.map(p => dKey(p)), best = Math.max(...keys), meTop = dKey(d.me) === best;
    const tie = keys.filter(k => k === best).length > 1;
    msg(`<b class="${meTop ? 'win' : 'bad'}">${meTop ? (tie ? '공동 1위!' : '1위!') : '끝났어요'}</b><span>${why}</span>`, meTop ? 'win' : 'pop');
    sfx(meTop ? 'wcWinD' : 'wcLose');
    if(meTop) try{ const q = fxCenter($('#wcLog')); fxRing(q.x, q.y, '#FFE27A', q.w * .6, .7, 12); }catch(_){}
    dSyncAi();
    T(() => { try{ duelEndNow(why); }catch(_){} }, 1500);
  }
  /* 차례 순서 줄: 얼굴 + 이름 + 이은 수, 지금 차례 강조, 탈락은 회색 ✕ */
  function order(){
    try{
      const e = $('#wcOrder'), d = DW(); if(!e || !d) return;
      const cur = duelTurn.cur(), pp = dPpl();
      e.innerHTML = G.duel.pl.map(pid => { const p = pp[pid] || dWho(pid), q = d.P[pid], out = q.out || (p.left ? 'left' : null);
        return `<span class="wc-op${pid === cur && !out && !d.ended ? ' cur' : ''}${out ? ' out' : ''}${pid === d.me ? ' me' : ''}" style="--sc:${p.col || '#2F7BFF'}">${pid === d.me ? toyImg('fox', 'wc-oav') : toyImg(oppKind(p.nick), 'wc-oav')}<b>${pid === d.me ? '나' : esc(duelShortNick(p.nick))}</b><i>${out ? '탈락' : q.words}</i></span>`; }).join('<em class="wc-oarr" aria-hidden="true">›</em>');
    }catch(_){}
  }

  /* ===== 시작: 시작 낱말을 놓고 첫 차례 ===== */
  function startChain(sw, delay){
    const m = S();
    m.chain = [{ w:sw, by:'start' }]; m.used = new Set([sw]);
    const log = $('#wcLog'); if(log) log.innerHTML = '';
    logAdd(m.chain[0]); hud();
    sfx('wcStart');
    if(m.dw){ m.phase = 'play'; order(); dPoll(); return; }   /* 대전: 첫 차례는 엔진 참가 순서 첫 사람 */
    msg('<span>시작 낱말이 나왔어요</span>', 'soft');
    T(() => { m.phase = 'play'; startMyTurn(); }, delay);
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
      ['제한 시간 안에!', '내 차례마다 시간이 정해져 있어요(남은 5초부터 시계가 깜빡여요). 시간이 다 되거나 포기하면 실패. 정한 수만큼 이으면 성공이에요. 💡 힌트는 이을 낱말의 첫 두 글자를 보여 줘요(점수 −30).'],
      ['끝내기 낱말을 노려요', '상대가 이을 낱말이 사전에 없는 끝 글자(예: ~름, ~슴, ~릇)로 끝내면 끝내기 승리! 반대로 컴퓨터도 끝내기 낱말을 노리니 조심해요. 긴 낱말일수록 점수가 커요.']
    ],
    /* 도움말 v2(공용 WP3): 그림 1장(320×180, 글자 타일만 — 낱말은 그림의 일부) + 3줄, 나머지는 '더 알아보기' */
    howto:{
      pic(){
        /* 글자 타일 3줄이 차례로 나타남: 사과 → 과일 → 일기. 이어 받는 글자는 주황 → 다음 줄 첫 칸이 같은 색 */
        const tile = (x, y, c, k) => `<g transform="translate(${x} ${y})"><rect x="-19" y="-20" width="38" height="40" rx="9" fill="${k === 'to' ? '#FFB36B' : k === 'from' ? '#B5F0E8' : '#FFFDF4'}" stroke="${OL}" stroke-width="3"/><text y="9" font-size="24" font-weight="900" text-anchor="middle" fill="${OL}" font-family="system-ui,sans-serif">${c}</text></g>`;
        const row = (i, a, b, y, x0) => `<g opacity="0">${tile(x0, y, a, i ? 'from' : '')}${tile(x0 + 44, y, b, 'to')}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(i * .22).toFixed(2)};${(i * .22 + .06).toFixed(2)};.92;1" dur="5s" repeatCount="indefinite"/></g>`;
        const arrow = (i, x1, y1, x2, y2) => `<path d="M${x1} ${y1}Q${x1 + 26} ${y1 + 4} ${x2} ${y2}" fill="none" stroke="#FF8A3D" stroke-width="4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(i * .22 + .03).toFixed(2)};${(i * .22 + .08).toFixed(2)};.92;1" dur="5s" repeatCount="indefinite"/></path>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#DDF8F3"/>
          <circle cx="24" cy="22" r="4" fill="#fff"/><circle cx="296" cy="160" r="5" fill="#fff"/>
          ${row(0, '사', '과', 40, 50)}${arrow(1, 120, 40, 122, 82)}${row(1, '과', '일', 90, 122)}${arrow(2, 192, 90, 194, 132)}${row(2, '일', '기', 140, 194)}</svg>`;
      },
      lines:['앞 낱말 끝 글자로 이어요', '두 글자 이상, 한 번만 써요', '차례 시간 안에 넣어요'],
      more:[
        ['끝 글자로 이어요', '앞 낱말의 끝 글자로 시작하는 낱말을 넣고 [잇기]. 두음법칙도 돼요(녀→여, 력→역, 라→나, 리→이). 사전에 없는 말은 “사전에 없어요” — 실수가 아니니 다른 낱말을 넣어요.'],
        ['성공 · 끝내기 낱말', '정한 수만큼 이으면 성공. 상대가 이을 낱말이 없는 끝 글자(예: ~름, ~슴, ~릇)로 끝내면 끝내기 승리! 💡 힌트는 첫 두 글자를 보여 줘요(−30점).'],
        ['대전: 2~5명 돌아가며', '차례대로 이어요. 시간 안에 못 잇거나, 포기하거나, 이을 낱말이 없거나, 규칙 실수를 두 번 하면 탈락. 끝까지 남은 사람이 1등이고, 모두 정한 수만큼 이으면 글자 점수로 순위를 매겨요. 느긋하게는 차례 36초.']
      ]
    },
    helpExtra(){ const m = G && G.id === ID && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ') + (m.rule.ban.length ? ` (금지 글자: ${m.rule.ban.join(', ')})` : '') + (m.rule.gold.length ? ` (황금 글자: ${m.rule.gold.join(', ')} · ${m.rule.goldNeed}개)` : '')]]; },
    chapters:['말놀이 마당', '이야기 골목', '낱말 숲', '글자 바다', '사전 궁전'],
    starRule:'★ 성공 · ★★ 힌트 없이 · ★★★ 힌트 없이 + 끝내기 승리 또는 세 글자 이상 낱말 5개',
    levels:{
      easy:{ goal:8, limit:20, ai:0, hints:3 },
      normal:{ goal:10, limit:18, ai:1, hints:3 },   /* 2026-10-06: 15 → 18초(대전도 이 값) */
      hard:{ goal:12, limit:15, ai:2, hints:2 }      /* 12 → 15초 */
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.goal}개 잇기 · 한 차례 ${c.limit}초 · ${AI_NAME[c.ai]}`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.goal}개 잇기 · 한 차례 ${c.limit}초 · ${AI_NAME[c.ai]}`; },
    init(cfg, rng, lv){
      const s = setup(cfg, rng);
      const duelOn = !!(G.duel && !G.duel.fleet);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { cfg, rule:s.rule, start:s.start, seed:s.seed, chain:[], used:new Set(), turn:null, phase:'intro', duelOn, dTurns:DUEL_TURNS,
        aiName:duelOn ? AI_NAME[1] : AI_NAME[cfg.ai || 0], oppNick:null, oppKind:null,
        myWords:0, myChars:0, oppWords:0, oppChars:0, longW:0, goldGot:0, turns:0, remSum:0, misses:0, hints:0, hintLeft:duelOn ? 0 : (cfg.hints == null ? 3 : cfg.hints),
        combo:0, tLim:cfg.limit, tStart:0, pen:0, lastSec:-1, result:null, ended:false, tips, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, timers:new Set() };
      G.limit = cfg.limit;
      const m = G.m;
      if(duelOn) dInit(cfg);
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear(); clearInterval(m.dIv);
        if(m.onVV){ try{ removeEventListener('resize', m.onVV); if(window.visualViewport) visualViewport.removeEventListener('resize', m.onVV); }catch(_){} }
        if(G && G.raf) cancelAnimationFrame(G.raf);
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
      const chips = (G.adv && (m.mj.length || m.tw || m.boss)) ? `<div class="wc-rules">${m.boss ? '<span class="wc-chip boss">대장 판</span>' : ''}${m.mj.map(k => `<span class="wc-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="wc-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}${m.rule.ban.length ? `<span class="wc-chip ban">✕ ${m.rule.ban.join('·')}</span>` : ''}${m.rule.gold.length ? `<span class="wc-chip gold" id="wcGold"></span>` : ''}${m.rule.tight ? '<span class="wc-chip tw" id="wcMiss"></span>' : ''}</div>` : '';
      st.innerHTML = `<div class="ng-wc" id="wcStage">
        <div class="hud-row">
          <div class="hchip" aria-label="${duel ? '내가 이은 낱말' : '이은 낱말'}"><span class="hv">${duel ? toyImg('fox', 'wc-hav') : ICO.word}<b id="wcCnt">0</b><small>/${duel ? m.dTurns : m.cfg.goal}</small></span><em>${duel ? '내 낱말' : '이은 낱말'}</em></div>
          <div class="hchip time" id="wcTimeP" aria-label="내 차례 남은 시간"><span class="hv">${ICO.clock}<b id="wcTime">${m.cfg.limit}</b><small>초</small></span><em>차례 시간</em></div>
          ${duel ? `<div class="hchip" aria-label="남은 사람"><span class="hv">${ICO.vs}<b id="wcAlive">${G.duel.pl.length}</b><small>명</small></span><em>남은 사람</em></div>`
            : `<button class="hchip item" id="wcHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>`}
          <button class="hchip skip wc-give" id="wcGive" aria-label="포기(두 번 누르기)"><span class="hv">${ICO.flag}</span><em>포기</em></button>
        </div>
        <div class="wc-barw" id="wcBarW"><i id="wcBar"></i></div>
        ${chips}
        <div class="wc-train" id="wcTrain" aria-hidden="true" hidden></div>
        ${duel ? `<div class="wc-order" id="wcOrder" aria-label="차례 순서"></div>` : ''}
        <div class="wc-body" id="wcBody">
          <div class="wc-log" id="wcLog" role="log" aria-live="polite" aria-label="이어진 낱말"></div>
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
      if(m.dw){ order(); msg('<span>모두 모이면 시작 낱말이 나와요</span>', 'soft'); return; }   /* 대전: 엔진 카운트다운이 끝나면 loop가 startChain */
      startChain(m.start, 900);
    },
    progress(){ const m = G && G.m; if(!m) return 0; return Math.min(1, m.myWords / (m.duelOn ? m.dTurns : m.cfg.goal)); },
    /* 대전 순위: 순위 열쇠 lf(남은 사람 1000 + 글자 수 · 탈락 = 탈락 번째) 큰 순 → 이은 낱말 → 실수 적은 순 */
    duelRank(a, b){ return ((b.lf || 0) - (a.lf || 0)) || ((b.v || 0) - (a.v || 0)) || ((a.mis || 0) - (b.mis || 0)); },
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
      return { base, time, extra, rows:[`이은 낱말 ${m.myWords}개 · ${m.myChars}글자`, `남은 시간 보너스 (평균 ${Math.round(avg * 100)}%)`, `긴 낱말 +${longB}${killB ? ' · 끝내기 +100' : ''} · 힌트 ${m.hints}번`] };
    },
    stars(){ const m = G.m; return m.hints ? 1 : (m.result === 'kill' || m.longW >= 5) ? 3 : 2; },
    winTitle:'끝말잇기 성공!',
    duelHow:'2~5명이 돌아가며 잇기 · 못 이으면 탈락 · 끝까지 남으면 1등',
    /* 대전 v3(2026-10-06): 공용 차례 엔진(duelKind 'turn', 2~5명, 공용 준비 화면). 예전 자체 1:1(duelLaunch·fleet·대기실 'wait')은 없앰
       → 엔진이 v3 대기실(w3/h3/j3)·방 'fl-d3-…'을 쓰므로 지난 버전(1:1 'wait')과 섞이지 않는다 */
    duelKind:'turn', duelMax:5, duelEnd:'game',
    duelCfg:() => ({ goal:DUEL_TURNS, limit:18, ai:1, hints:0, duel:1 }),
    duelSlow:cfg => Object.assign({}, cfg, { limit:36 }),   /* 느긋하게: 차례 36초 */
    duelAi:() => null,                                       /* 컴퓨터 상대는 이 게임이 직접 잇는다(aiTurn) */
    css:`
body[data-mode="wordchain"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.65), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.28) 0 3px, transparent 3.5px) 0 0/46px 46px,
  linear-gradient(180deg,#E2FAF6 0%,#B9EEE6 55%,#8FDCD2 100%) fixed}
.ng-wc{position:relative; display:flex; flex-direction:column; align-items:stretch; width:100%; max-width:520px; margin:0 auto}
.ng-wc .hud-row{margin:0}
.ng-wc .wc-ic{width:22px; height:22px; flex:none; display:block}
.ng-wc .wc-ic svg{width:100%; height:100%; display:block}
.ng-wc .hchip .wc-hav, .ng-wc .hchip #wcOppAv{width:20px; height:20px; display:block; flex:none}
.ng-wc .hchip #wcOppAv .wc-hav{width:20px; height:20px}
.ng-wc .hchip.time.warn{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)}
.ng-wc .wc-give{flex:.8 1 0}
.ng-wc .wc-give.arm{background:linear-gradient(180deg,#FF9A9E,#E5484D)} .ng-wc .wc-give.arm em{color:#fff}
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
.ng-wc .wc-body{position:relative; margin-top:10px}
.ng-wc .wc-log{height:300px; overflow-y:auto; overscroll-behavior:contain; padding:12px 10px 14px; border-radius:20px; background:radial-gradient(circle at 50% 30%, #FBFFFE 0%, #E6F8F4 100%);
  border:3px solid ${OL}; box-shadow:inset 0 0 0 3px rgba(255,255,255,.8), 0 5px 0 ${OL}, 0 14px 22px rgba(10,90,85,.2); display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth}
.ng-wc .wc-body.wait .wc-log{visibility:hidden}
.ng-wc .wc-start{align-self:center; display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 16px 10px; border-radius:16px; background:#fff; border:2.5px dashed #14A3A0}
.ng-wc .wc-start small{font-family:var(--disp); font-size:13px; color:#3F7A74}
.ng-wc .wc-log.fresh{justify-content:center; gap:16px}
.ng-wc .wc-log.fresh .wc-start{padding:10px 18px 12px; border-width:3px; gap:6px}
.ng-wc .wc-log.fresh .wc-start small{font-size:16px}
.ng-wc .wc-log.fresh .wc-start .wc-ws{gap:6px; padding:9px 12px}
.ng-wc .wc-log.fresh .wc-start .wc-t{width:46px; height:50px; border-radius:12px; font-size:28px}
.ng-wc .wc-log.fresh .wc-start .wc-t.to{-webkit-text-stroke:5px ${OL}}
.ng-wc .wc-guide{align-self:center; text-align:center; animation:wc-pop .38s cubic-bezier(.2,1.5,.4,1) both}
.ng-wc .wc-gt{margin:0; font-family:var(--disp); font-size:19px; color:#0E4F4B; line-height:1.4}
.ng-wc .wc-gt b{font-family:var(--heavy); font-weight:400; color:#E06A10}
.ng-wc .wc-gs{margin:6px 0 0; font-size:14px; color:#3F6B67}
.ng-wc .wc-log.fresh.short{gap:8px}
.ng-wc .wc-log.fresh.short .wc-start{padding:8px 16px 10px}
.ng-wc .wc-log.fresh.short .wc-start .wc-t{width:42px; height:45px; font-size:26px}
.ng-wc .wc-log.fresh.short .wc-gs{display:none}
.ng-wc .wc-b{display:flex; align-items:flex-end; gap:7px; max-width:92%}
.ng-wc .wc-b.me{align-self:flex-end; flex-direction:row-reverse}
.ng-wc .wc-b.ai{align-self:flex-start}
.ng-wc .wc-av{flex:none; width:38px; height:38px; border-radius:50%; background:#fff; border:2.2px solid ${OL}; display:grid; place-items:center; overflow:hidden}
.ng-wc .wc-b.me .wc-av{background:#FFE0C4}
.ng-wc .wc-b.ai .wc-av{background:#E6DAFF}
.ng-wc .wc-avimg{width:34px; height:34px; display:block}
.ng-wc .wc-bw{display:flex; flex-direction:column; gap:3px; min-width:0}
.ng-wc .wc-b.me .wc-bw{align-items:flex-end}
.ng-wc .wc-bw small{font-family:var(--disp); font-size:13px; color:#3F7A74; padding:0 4px}
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
.ng-wc .wc-in input::placeholder{color:#4E7D78; font-size:15px}
.ng-wc .wc-train{display:flex; align-items:center; gap:0; margin:8px 0 0; padding:2px 2px 4px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; white-space:nowrap; scroll-behavior:smooth; -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 18px)}
.ng-wc .wc-train[hidden]{display:none}
.ng-wc .wc-train::-webkit-scrollbar{display:none}
.ng-wc .wc-car{flex:none; padding:5px 9px 4px; border-radius:10px 10px 6px 6px; border:2px solid ${OL}; background:#fff; box-shadow:0 3px 0 ${OL}; font-family:var(--heavy); font-size:15px; line-height:1.1; color:${OL}}
.ng-wc .wc-car.me{background:linear-gradient(180deg,#FFF3E2,#FFD9AE)}
.ng-wc .wc-car.ai{background:linear-gradient(180deg,#FFFFFF,#D5F3EE)}
.ng-wc .wc-car.st{background:#fff; border-style:dashed}
.ng-wc .wc-car.kill{background:linear-gradient(180deg,#FFB3B6,#FF6B70); color:#fff}
.ng-wc .wc-car.new{animation:wc-car .42s cubic-bezier(.2,1.5,.4,1) both}
.ng-wc .wc-link{flex:none; width:10px; height:4px; background:${OL}; border-radius:2px}
@keyframes wc-car{from{transform:translateX(26px); opacity:0}}
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
/* 대전(2~5명): 차례 순서 줄 · 탈락 줄 · 참가자 색 말풍선 */
.ng-wc .wc-order{display:flex; align-items:center; justify-content:center; gap:2px; margin:6px 0 0; padding:12px 0 3px; flex-wrap:nowrap}
.ng-wc .wc-op{position:relative; display:flex; flex-direction:column; align-items:center; gap:1px; min-width:50px; max-width:62px; padding:4px 4px 3px; border-radius:12px; background:#fff; border:2px solid ${OL}; box-shadow:0 2px 0 ${OL}; transition:transform .2s, opacity .2s}
.ng-wc .wc-op .wc-oav{width:24px; height:24px; display:block}
.ng-wc .wc-op b{font-family:var(--disp); font-weight:400; font-size:13px; line-height:1.1; color:${OL}; max-width:58px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.ng-wc .wc-op i{font-style:normal; font-family:var(--heavy); font-size:13px; line-height:1; color:#0B5E5C}
.ng-wc .wc-op.me{background:#FFF1E2}
.ng-wc .wc-op.cur{border-color:var(--sc); box-shadow:0 0 0 3px var(--sc), 0 2px 0 ${OL}; transform:translateY(-2px) scale(1.06)}
.ng-wc .wc-op.cur::before{content:'차례'; position:absolute; top:-11px; left:50%; transform:translateX(-50%); padding:1px 6px; border-radius:99px; background:var(--sc); color:#fff; font-family:var(--disp); font-size:13px; line-height:1.2; border:1.5px solid ${OL}; white-space:nowrap}
.ng-wc .wc-op.out{opacity:.45; filter:grayscale(1)}
.ng-wc .wc-op.out i{color:#B3122E}
.ng-wc .wc-oarr{font-style:normal; font-family:var(--heavy); font-size:15px; color:#3F7A74}
.ng-wc .wc-order:has(.wc-op:nth-child(9)) .wc-oarr{display:none}
.ng-wc .wc-out{align-self:center; padding:5px 12px; border-radius:99px; background:#FFE3E3; border:2px solid ${OL}; font-family:var(--disp); font-size:14px; color:#8E0F2F}
.ng-wc .wc-out b{font-family:var(--heavy); font-weight:400}
.ng-wc .wc-b.seat .wc-av{border-color:var(--sc); box-shadow:0 0 0 2px var(--sc)}
@media (max-width:370px){ .ng-wc .wc-t{width:30px; height:33px; font-size:19px} .ng-wc .wc-go{padding:0 10px 0 8px; font-size:16px} }
@media (prefers-reduced-motion: reduce){ .ng-wc .wc-car.new, .ng-wc .pop, .ng-wc .wc-msg.pop, .ng-wc .wc-msg.win{animation:none} .ng-wc .wc-log{scroll-behavior:auto} }
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
/* 대전 수치(duelStat): v = 내가 이은 낱말(칩 '3낱말'), mis = 규칙 실수, lf = 순위 열쇠(duelRank가 씀, 화면에는 안 나옴). t는 주지 않음 */
Object.assign(NG.wordchain, { duelPace:[150, .6], duelStat:{ unit:'낱말', get:() => { const m = G.m; if(m && m.dw){ const q = m.dw.P[m.dw.me]; return { v:m.myWords, mis:q.miss, lf:q.out ? q.outN : 1000 + q.chars }; } return { v:m.myWords, t:m.cfg.goal }; } } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.wordchain.scene = { kind:'bubbles', colors:['#FFFFFF', '#B5F0E8', '#FFE9A8'], density:.8 };
