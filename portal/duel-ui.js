/* ===================== 대전 화면(사이트): 대전 탭 · 결과 창 · 보상 · 하트 · 주간 등급 (docs/21 WP2 · 10-3 · 10-4 · 11-1, 결정 211~213) =====================
   portal.js에서 대전 부분(renderDuel · portalDuelResult · DUEL_PTS)을 옮겨 왔다. 게임 이름은 모른다(게임마다 다른 것은 게임 정의).
   · 보상 = 보통 기준표[인원][순위] × 난이도 배율(쉬움 0.75 · 어려움 1.375), 10 단위 반올림(5는 올림).
     2명 줄은 결정 199 숫자 그대로, 꼴찌는 그 난이도의 패배 점수, 2명 무승부 180/250/330, 3명 이상 공동은 평균, 컴퓨터 1:1 = 300/180/100.
   · 강자 보너스 +100: 나보다 5레벨 이상 높은 사람보다 높은 순위(컴퓨터 제외, 한 판 1번).
   · 같은 구성(나 + 같은 상대들) 하루 21판째부터 보상 절반, 강자 보너스·연승 불꽃 없음.
   · 연승 불꽃: 1위(공동 아님) 연속 2번째부터 +50씩 최대 +200. 컴퓨터 판은 세지도 끊지도 않음.
   · 주간 대전 등급(hp:duelWeek): 그 주 대전 포인트 0 · 2,000 · 6,000 · 12,000 · 20,000 → 새싹 · 풀잎 · 나무 · 숲 · 별숲, 월요일 0시 새로.
   · 하트: 방(또는 빠른 대전 한 판 더 묶음)의 첫 판 ♥1, 2·3·4판째 무료, 5판째부터 ♥1(hp:duelFree, 방을 나가면 새로). 컴퓨터 1:1은 판마다 ♥1.
   대전 포인트는 대전 기록에만 쌓이고 오늘 점수(시험지)와는 따로(결정 152·199). */
const DUEL_PTS = { w:400, d:250, l:150 };   /* 보통 2명(결정 199) — 빠른 대전도 보통 */
const DUEL_TWO = { easy:{ w:300, d:180, l:100 }, normal:DUEL_PTS, hard:{ w:550, d:330, l:200 } };
const DUEL_TAB = { 2:[400, 150], 3:[450, 270, 150], 4:[500, 330, 230, 150], 5:[550, 400, 300, 220, 150] };
const DUEL_MUL = { easy:.75, normal:1, hard:1.375 };
const DUEL_LAST = { easy:100, normal:150, hard:200 };
const DUEL_FREE_N = 4, DUEL_HALF_AT = 21, DUEL_STRONG = 100, DUEL_FIRE = 50, DUEL_FIRE_MAX = 200;
const DUEL_TIERS = [ { n:'새싹', at:0, col:'#9FD98C' }, { n:'풀잎', at:2000, col:'#5DB653' }, { n:'나무', at:6000, col:'#B88452' }, { n:'숲', at:12000, col:'#2E7D4F' }, { n:'별숲', at:20000, col:'#6C3CE0' } ];
const duelR10 = v => Math.floor(v / 10 + .5) * 10;
const duelDiff = d => DUEL_MUL[d] ? d : 'normal';

/* 한 순위의 보상(공동이 아닐 때) */
function duelPtsAt(n, rank, diff){
  diff = duelDiff(diff); n = Math.max(2, Math.min(5, n | 0)); rank = Math.max(1, Math.min(n, rank | 0));
  if(n === 2) return rank === 1 ? DUEL_TWO[diff].w : DUEL_TWO[diff].l;
  if(rank === n) return DUEL_LAST[diff];
  return duelR10(DUEL_TAB[n][rank - 1] * DUEL_MUL[diff]);
}
/* 보상 하나의 규칙: n 인원 · rank 순위 · tie 공동 · diff 난이도 · ai 컴퓨터 1:1 · k 공동 인원 */
function duelPts(n, rank, tie, diff, ai, k = 2){
  if(ai){ const t = DUEL_TWO.easy; return tie ? t.d : rank === 1 ? t.w : t.l; }
  n = Math.max(2, Math.min(5, n | 0)); diff = duelDiff(diff);
  if(n === 2 && tie) return DUEL_TWO[diff].d;
  if(!tie || k < 2) return duelPtsAt(n, rank, diff);
  let s = 0; for(let i = 0; i < k; i++) s += duelPtsAt(n, Math.min(n, rank + i), diff);
  return duelR10(s / k);
}
/* 1위 보상 범위 글: "1위 +400~550" */
const duelTopTxt = (diff, maxN = 5) => { const a = duelPtsAt(2, 1, diff), b = duelPtsAt(Math.max(2, maxN), 1, diff); return a === b ? `+${a}` : `+${a}~${b}`; };

/* ---- 주간 대전 등급 · 연승 ---- */
function duelWeek(){
  const wk = weekStartKey(), w = store.get('hp:duelWeek', null);
  if(w && w.wk === wk) return w;
  return { wk, pts:0, streak:w ? (w.streak | 0) : 0, best:w ? (w.best | 0) : 0, first:0, games:0 };
}
const duelTierOf = pts => { let i = 0; DUEL_TIERS.forEach((t, k) => { if(pts >= t.at) i = k; }); return i; };
/* 등급 방패(같은 모양에 색만, 별숲은 별) */
function duelShield(i, px = 40){
  const t = DUEL_TIERS[Math.max(0, Math.min(4, i))];
  const star = i === 4 ? '<path d="M20 11.5l2.3 4.7 5.1.7-3.7 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.7-3.6 5.1-.7z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.4" stroke-linejoin="round"/>'
    : `<path d="M20 12c3.5 2.5 5 5.4 4.6 9.6-.3 2.7-2.2 4.4-4.6 5.4-2.4-1-4.3-2.7-4.6-5.4-.4-4.2 1.1-7.1 4.6-9.6z" fill="#fff" fill-opacity=".85" stroke="#1A0F45" stroke-width="1.4"/><path d="M20 15.5v10" stroke="#1A0F45" stroke-width="1.2" stroke-linecap="round"/>`;
  return `<svg class="dshield" viewBox="0 0 40 44" width="${px}" height="${Math.round(px * 1.1)}" aria-hidden="true"><path d="M20 2.5l15 5v12.5c0 10-6.4 17.4-15 21.5C11.4 37.4 5 30 5 20V7.5z" fill="${t.col}" stroke="#1A0F45" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 6.5l11 3.7v9.6c0 7.6-4.6 13.4-11 16.8" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>${star}</svg>`;
}
const DUEL_FIRE_G = `<svg class="dfire" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1.5c1 4.2 6.8 7.4 7.8 13.2.9 5.4-2.9 10.8-7.8 10.8S3.3 21.9 4.2 16.6c.5-2.9 2.1-4.6 3.3-6 .1 2.4 1 3.7 2.3 4.4-.5-5.2.4-9.6 2.2-13.5z" fill="#FF7A1F" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/><path d="M12 13.5c.7 2.4 3.6 3.9 3.6 7 0 2.2-1.6 3.6-3.6 3.6s-3.6-1.4-3.6-3.6c0-2.1 1.7-3.4 3.6-7z" fill="#FFD35C"/></svg>`;
const DUEL_CROWN_G = `<svg class="dcrown" viewBox="0 0 32 24" aria-hidden="true"><path d="M3 7l6.5 6L16 3l6.5 10L29 7l-3 14H6z" fill="#FFC93C" stroke="#1A0F45" stroke-width="2.4" stroke-linejoin="round"/><circle cx="16" cy="15.5" r="2.2" fill="#F0368A" stroke="#1A0F45" stroke-width="1.4"/></svg>`;

/* ---- 하트: 같은 방 2~4판째 무료 ---- */
/* 방 열쇠: 대전 방은 방 코드, 빠른 대전 한 판 더 묶음은 대전 방 이름(fl-d3-…). 'fl-d3-r-<코드>-<판>'은 방 코드로 */
function duelFreeKey(x){
  if(!x) return '';
  if(typeof x === 'string'){ const m = /^fl-d3-r-([a-z0-9]+)-\d+$/i.exec(x); return m ? m[1].toUpperCase() : x; }
  if(x.room && x.room.id != null) return String(x.room.id).toUpperCase();
  if(x.mode === 'ai' || x.fleet) return '';
  return x.R ? duelFreeKey(String(x.R)) : '';
}
const duelFreeN = k => { const x = store.get('hp:duelFree', null); return k && x && x.k === k ? (x.n | 0) : 0; };
const duelFreeSet = (k, n) => store.set('hp:duelFree', k ? { k, n, t:Date.now() } : null);
const duelFreeNext = k => { const n = duelFreeN(k); return n >= 1 && n < DUEL_FREE_N; };   /* 다음 판이 무료인지 */
const duelFreeReset = k => duelFreeSet(String(k || '').toUpperCase(), 0);   /* 방에 들어갈 때(나갔다 오면 새로 셈) */
/* HOST.beforeStart에서: 이번 판이 무료인지 보고 판 수를 센다 */
function duelHeartFree(duel){ const k = duelFreeKey(duel); return !!k && duelFreeNext(k); }
function duelRoundCount(duel){ const k = duelFreeKey(duel); if(k) duelFreeSet(k, duelFreeN(k) + 1); }
/* 남은 무료 판(결과 창 "한 판 더 · 무료 남은 n번"). 기록이 없으면 null */
function duelFreeLeft(room){ const k = duelFreeKey(room); const n = duelFreeN(k); return n ? Math.max(0, DUEL_FREE_N - n) : null; }

/* ---- 보상 계산 + 기록(결과 한 번에 한 번) ---- */
function duelReward(R, diff, room){
  const d = dayState(), W = duelWeek(), ai = !!R.ai, n = Math.max(2, Math.min(5, R.n || R.rows.length));
  const tiedK = R.rows.filter(x => x.rank === R.rank).length;
  let base = duelPts(n, R.rank, R.tie, diff, ai, tiedK);
  const lvs = (room && room.lvs) || {}, myLv = rmLv();
  const strong = !ai && R.rows.some(x => !x.me && !x.ai && typeof lvs[x.nick] === 'number' && lvs[x.nick] - myLv >= RM_BAND && x.rank > R.rank);
  /* 같은 구성 하루 판 수 */
  const key = R.rows.filter(x => !x.me && !x.ai).map(x => String(x.nick)).sort().join('|');
  d.dcomp = d.dcomp || {}; let cnt = 0;
  if(key && !ai){ cnt = (d.dcomp[key] || 0) + 1; d.dcomp[key] = cnt; const ks = Object.keys(d.dcomp); if(ks.length > 40) delete d.dcomp[ks[0]]; }
  const half = !ai && cnt >= DUEL_HALF_AT;
  const first = R.rank === 1 && !R.tie;
  if(!ai) W.streak = first ? (W.streak | 0) + 1 : 0;
  const fire = !ai && first && W.streak >= 2 && !half ? Math.min(DUEL_FIRE_MAX, (W.streak - 1) * DUEL_FIRE) : 0;
  const bonus = strong && !half ? DUEL_STRONG : 0;
  if(half) base = duelR10(base / 2);
  const pts = base + bonus + fire, tier0 = duelTierOf(W.pts);
  W.pts += pts; W.games = (W.games | 0) + 1; if(first) W.first = (W.first | 0) + 1; W.best = Math.max(W.best | 0, W.streak | 0);
  store.set('hp:duelWeek', W);
  const each = {}; R.rows.forEach(x => { each[x.pid] = x.ai ? null : x.me ? pts : duelPts(n, x.rank, R.rows.filter(y => y.rank === x.rank).length > 1, diff, ai, R.rows.filter(y => y.rank === x.rank).length); });
  saveDay(d);
  return { base, bonus, fire, half, pts, each, streak:W.streak, first, tierUp:duelTierOf(W.pts) > tier0 ? duelTierOf(W.pts) : -1, week:W };
}

/* ---- 대전 탭 ---- */
function duelRecTot(){ const R = duelRec(); let w = 0, n = 0; for(const k in R){ const x = R[k] || {}; w += x.w | 0; n += (x.w | 0) + (x.d | 0) + (x.l | 0); } return { w, n }; }
function duelHeadHtml(){
  const live = duelLive(), n = duelWaiting(), T = duelRecTot(), W = duelWeek(), ti = duelTierOf(W.pts), nx = DUEL_TIERS[ti + 1];
  const pct = nx ? Math.min(100, (W.pts - DUEL_TIERS[ti].at) / (nx.at - DUEL_TIERS[ti].at) * 100) : 100;
  return `<div class="dh-top"><span class="dh-ico">${ic('duel')}</span><div><b>대전 · 2~5명</b><small>같은 문제를 같은 순간에 · 1위 ${T.w}번 · 판 ${T.n}번</small></div></div>
    <div class="dh-week">${duelShield(ti, 44)}<div class="dh-wk"><b>이번 주 ${DUEL_TIERS[ti].n} <span class="num">${fmt(W.pts)}</span></b>
      <span class="dh-bar"><i style="width:${pct.toFixed(1)}%"></i></span><small>${nx ? `다음 '${nx.n}'까지 ${fmt(nx.at - W.pts)}` : '가장 높은 등급이에요!'} · 월요일 0시 새로</small></div>
      ${W.streak >= 2 ? `<span class="dh-fire">${DUEL_FIRE_G}<b class="num">${W.streak}</b><small>연승</small></span>` : ''}</div>
    <div class="dh-rw"><span class="w">1위 ${duelTopTxt('normal')}</span><span class="d">인원이 많을수록 커요</span><span class="c">첫 판 ${ic('heart')}1 · 같은 방 3판 무료</span></div>
    <div class="dh-live${live ? '' : ' off'}"><i></i>${live ? (n ? `지금 대전을 기다리는 사람 <b>${n}명</b>` : '실시간 서버 연결됨 · 상대가 없으면 컴퓨터와 겨뤄요') : '지금은 실시간 연결이 안 돼요 · 컴퓨터와 겨뤄요'}</div>`;
}
/* "친구와 대전" 카드: [방 만들기] [코드로 들어가기] */
function duelFriendCardHtml(){
  return `<div class="dfcard"><b>${FR_G}친구와 대전</b><small>방을 만들어 2~5명이 같이 겨뤄요</small>
    <div class="dfbtns"><button class="btn primary" id="dfMake">방 만들기</button><button class="btn secondary" id="dfCode">코드로 들어가기</button></div></div>`;
}
function renderDuel(d){
  let card = $('#duelCard');
  if(!card){ card = document.createElement('div'); card.id = 'duelCard'; const h = $('#duelHead'); if(h) h.parentNode.insertBefore(card, h); }
  card.innerHTML = duelFriendCardHtml();
  $('#dfMake').onclick = () => { if(RM.cur){ rmOpen(); return; } duelPickGame(); };
  $('#dfCode').onclick = () => rmCodeSheet();
  $('#duelHead').innerHTML = duelHeadHtml();
  /* 빠른 대전: 오늘 시험지 게임 중 하나(문제 씨앗과 무관한 게임 고르기라 시계로 골라도 됨) */
  const qd = $('#quickDuel');
  if(qd){ qd.innerHTML = `${ic('duel')} 빠른 대전 <small>오늘 시험지 게임 중 하나</small> ${costTag()}`;
    qd.onclick = () => { if(RM.cur){ toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'); rmOpen(); return; } const s = dayState().set.filter(g => !isAdult(g) && GAMES[g]); const g = s[Math.floor(Date.now() / 1000) % s.length]; gateThen(g, () => duelStart(g)); }; }
  const dfr = $('#duelFriends'); if(dfr){ dfr.innerHTML = duelFriendsHtml(); duelFriendsBind(); }
  renderFilter('duel');
  const R = duelRec(), list = $('#duelList'); list.innerHTML = '';
  for(const id of filteredIds('duel')){
    if(id === ADULT_SEP){ list.insertAdjacentHTML('beforeend', adultSepHtml('duel')); adultSepBind('duel'); continue; }
    const r = R[id] || { w:0, d:0, l:0 }, tot = r.w + r.d + r.l, wait = duelWaiting(id), mx = duelMaxOf(id);
    /* 게임마다 다른 한 줄: 게임 정의의 duelHow, 없으면 게임 방법 첫 줄 */
    const how = NG[id].duelHow || (HELP[id] && HELP[id][0] && HELP[id][0][0]) || '점수가 높으면 승리';
    const row = document.createElement('div'); row.className = 'grow panel duelrow'; row.style.setProperty('--gc', GCOL[id][1]);
    row.innerHTML = `<span class="g-art">${ART[id]()}${wait ? `<span class="live"><i></i>${wait}명</span>` : ''}</span><b class="dname">${GAMES[id].name}<small class="drec">${mx > 2 ? `<em class="dmax">2~${mx}명</em> ` : ''}${NG[id].cardNote ? '<b class="cnote">' + escH(NG[id].cardNote()) + '</b> ' : ''}${tot ? `1위 ${r.w}번 · 판 ${tot}번` : ''}</small></b><button class="gr-go duel${rmOk(id) ? ' rooms' : ''}" aria-label="${GAMES[id].name} ${rmOk(id) ? '대전 방 목록' : '대전 시작, 하트 1개'}">${rmRowBtn(id)}</button><span class="dhow">${escH(how)}</span>`;
    const open = () => rmOk(id) ? rmList(id) : (RM.cur ? (toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'), rmOpen()) : gateThen(id, () => duelStart(id)));   /* 게임을 누르면 그 게임의 방 목록(22번 문서) */
    row.querySelector('.gr-go').onclick = open;
    row.querySelector('.g-art').onclick = open;
    list.appendChild(row);
  }
}
/* 방 만들기 → 게임 고르기(대전 목록과 같은 게임, 방을 열 수 있는 게임만) */
function duelPickGame(back){
  const set = dayState().set, ids = GAME_IDS.filter(g => rmOk(g) && !isAdult(g)).sort((a, b) => (set.includes(b) ? 1 : 0) - (set.includes(a) ? 1 : 0));
  openModal(`<div class="frpickg"><p class="kick">방 만들기</p><h3>어떤 게임으로 붙을까요?</h3>
    <div class="gpick">${ids.map(g => `<button data-tg="${g}" style="--gc:${GCOL[g][1]}"><span class="g-art">${ART[g]()}</span><b>${GAMES[g].name}</b>${duelMaxOf(g) > 2 ? `<em class="mx5">${duelMaxOf(g)}명</em>` : set.includes(g) ? '<em>오늘</em>' : ''}</button>`).join('')}</div>
    <div class="mbtns one"><button class="b2" id="tgBack">닫기</button></div></div>`);
  $('#tgBack').onclick = back || closeModal;
  document.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => rmCreateSheet(b.dataset.tg, { back:() => duelPickGame(back) }));
}

/* ---- 결과 창(사이트) ---- */
/* 자기 방식 대전(함대·고스톱 등)처럼 res가 없을 때: 2명 순위표로 맞춤 */
function duelResFallback(r, a, b){
  const D = G.duel, ai = D.mode === 'ai' || (D.fleet && G.lv !== 'pvp'), nick = (D.opp && D.opp.nick) || '상대';
  const tx = x => x && x.txt ? x.txt : x && x.sc ? fmt(x.sc) + '점' : '';
  return { kind:'turn', n:2, ai, rank:r === 'l' ? 2 : 1, tie:r === 'd', why:duelWhy(r, a, b), round:null, room:{ code:null, canAgain:false },
    rows:[ { pid:'me', nick:myNick(), me:true, ai:false, col:DUEL_SEAT[0].col, shape:DUEL_SEAT[0].shape, rank:r === 'l' ? 2 : 1, txt:tx(a) },
      { pid:'op', nick, me:false, ai, col:DUEL_SEAT[1].col, shape:DUEL_SEAT[1].shape, rank:r === 'w' ? 2 : 1, txt:tx(b) } ].sort((x, y) => x.rank - y.rank) };
}
const duelNm = x => x.me ? '나' : escH(String(x.nick || '상대'));
const duelFace = x => x.me ? avatar({ me:true }) : oppAv(x.nick);
/* 시리즈 띠: "이 방 3판째 · 1위 나 2번 · 토끼 1번" */
function duelSeriesTxt(R, room){
  /* 대전 방: 판마다 중계 방 이름이 바뀌므로 방(RM.cur.ser, 이름별 1위 수)으로 센다. 빠른 대전 묶음은 엔진의 series(pid별) */
  if(room && RM.cur && RM.cur.id === room.id){
    const c = RM.cur, ser = c.ser = c.ser || {}, w = R.rows.filter(x => x.rank === 1);
    if(w.length === 1 && !R.ai){ const k = w[0].me ? myNick() : w[0].nick; ser[k] = (ser[k] || 0) + 1; }
    const rd = room.rd || c.rd; if(!rd || rd < 2) return '';
    const ws = Object.keys(ser).sort((a, b) => ser[b] - ser[a]).slice(0, 3).map(k => `${k === myNick() ? '나' : escH(duelShortNick(k))} ${ser[k]}번`);
    return `이 방 ${rd}판째${ws.length ? ' · 1위 ' + ws.join(' · ') : ''}`;
  }
  const rd = R.round && R.round.r; if(!rd || rd < 2) return '';
  const ser = (R.round && R.round.series) || {}, by = {}; R.rows.forEach(x => { by[x.pid] = x; });
  const ws = Object.keys(ser).filter(p => by[p] && ser[p] > 0).sort((a, b) => ser[b] - ser[a]).slice(0, 3).map(p => `${by[p].me ? '나' : escH(duelShortNick(by[p].nick))} ${ser[p]}번`);
  return `이 방 ${rd}판째${ws.length ? ' · 1위 ' + ws.join(' · ') : ''}`;
}
function duelRowsHtml(R, each){
  return `<ol class="dz-rows">${R.rows.map(x => {
    const k = R.rows.filter(y => y.rank === x.rank).length, p = each ? each[x.pid] : null;
    return `<li class="${x.me ? 'me' : ''}${x.rank === 1 ? ' win' : ''}${x.left ? ' left' : ''}"><span class="dz-medal${x.rank <= 3 ? ' m' + x.rank : ''}">${x.rank}</span>${duelShapeSvg(x.shape, x.col, 16)}${duelFace(x)}
      <span class="dz-nm"><b>${duelNm(x)}${x.ai ? ' <em class="aitag">컴퓨터</em>' : ''}${k > 1 && R.n > 2 ? ' <em class="dz-tie">공동</em>' : ''}</b><small>${escH(x.txt || '')}</small></span>${p != null ? `<em class="dz-p num">+${fmt(p)}</em>` : '<em class="dz-p"></em>'}</li>`; }).join('')}</ol>`;
}
function duelBigHtml(R, streak){
  const r1 = R.rank === 1 && !R.tie, two = R.n <= 2;
  const t = two && R.tie ? '무승부' : `${R.tie ? '공동 ' : ''}${R.rank}위`;
  return `<h3 class="dz-h${r1 ? ' r1' : ''}${R.rank > 1 && !R.tie ? ' lo' : ''}" data-r="${R.tie && R.rank === 1 ? 'd' : r1 ? 'w' : 'l'}">${r1 ? DUEL_CROWN_G : ''}<span class="num">${t}</span>${streak >= 2 && r1 ? `<span class="dz-fire">${DUEL_FIRE_G}<small>${streak}연승</small></span>` : ''}</h3>`;
}
/* 결과 창 버튼(11-1): 같은 방이 살아 있으면 주 = 한 판 더(무료면 무료 남은 n번), 아니면 주 = 새 상대 찾기 ♥1(보조 색) */
function duelResBtns(R, id, room, inRoom){
  const newOpp = () => { goHome(); setTab('duel'); gateThen(id, () => duelStart(id)); };
  const toList = () => { goHome(); setTab('duel'); };
  if(inRoom){
    const fl = duelFreeLeft(room.id), free = fl && fl > 0;
    return { cost:!free, pri:{ id:'mPri', label:free ? `한 판 더 · 무료 남은 ${fl}번` : `한 판 더 ${costTag()}`, sub:'방으로 돌아가 바로 준비해요', fn:() => rmAgain() },
      pair:[ { id:'dzRoom', label:'방으로', fn:() => { goHome(); setTab('duel'); rmBack(); } }, { id:'dzOut', label:'나가기', fn:() => { rmLeave('방에서 나왔어요'); goHome(); setTab('duel'); } } ],
      links:[ { id:'mGh', label:'홈으로', fn:() => { goHome(); setTab('today'); } } ] };
  }
  if(R.room && R.room.canAgain && !R.ai){
    const fl = duelFreeLeft(R.round && G.duel ? G.duel.R : null), free = fl && fl > 0;
    return { cost:!free, again:true, pri:{ id:'mPri', keep:true, label:free ? `한 판 더 · 무료 남은 ${fl}번` : `한 판 더 ${costTag()}`, sub:'같은 상대와 새 문제로', fn:() => duelAgainPress() },
      pair:[ { id:'mSec', label:`새 상대 찾기 ${costTag()}`, fn:newOpp }, { id:'dzShare2', label:`${ic('share')} 결과 공유`, keep:true, fn:() => duelShareRes() } ],
      links:[ { id:'dzList', label:'대전 목록', fn:toList }, { id:'mGh', label:'홈으로', fn:() => { goHome(); setTab('today'); } } ] };
  }
  return { cost:true, pri:{ id:'mPri', label:`새 상대 찾기 ${costTag()}`, sub:GAMES[id].name, fn:newOpp },
    pair:[ { id:'mSec', label:'대전 목록', fn:toList }, { id:'mGh', label:'홈으로', fn:() => { goHome(); setTab('today'); } } ] };
}
let DZ = null;   /* 지금 열린 결과 창(공유·한 판 더 표시용) */
function portalDuelResult(r, a, b, res){
  const D = G.duel, id = G.id, R = res && res.rows ? res : duelResFallback(r, a, b);
  const room = D.room || null, inRoom = !!(room && RM.cur && RM.cur.id === room.id);
  if(room) rmAfterDuel();
  const diff = room && RM_DIFF.includes(G.lv) ? G.lv : 'normal';
  const P = duelReward(R, diff, room);
  const d = dayState(), firstToday = !d.att;
  d.duel += P.pts; d['d' + r] = (d['d' + r] || 0) + 1; d.att = true; saveDay(d);
  const RC = duelRec(), x = RC[id] || { w:0, d:0, l:0 }; x[r]++; RC[id] = x; store.set('hp:duelRec', RC);
  const me = R.rows.find(y => y.me) || {}, ser = duelSeriesTxt(R, inRoom ? room : null), r1 = R.rank === 1 && !R.tie;
  const brk = [ `기본 +${fmt(P.base)}`, P.bonus ? `강자 보너스 +${P.bonus}` : '', P.fire ? `연승 +${P.fire}` : '' ].filter(Boolean).join(' · ');
  const B = duelResBtns(R, id, room, inRoom);
  DZ = { R, id, room, g:G, B, code:room && room.code ? room.code : null };
  let html = `${r1 ? '<div class="burst" aria-hidden="true"></div>' : ''}<div class="dzres${R.n > 2 ? ' many' : ''}" id="dzRes">
    <div class="dz-top"><span class="dz-band">${ser}</span><button class="dz-share" id="dzShare" aria-label="결과 공유">${ic('share')}<small>공유</small></button></div>
    ${duelBigHtml(R, P.streak)}
    ${me.txt ? `<p class="dz-mine">${escH(me.txt)}</p>` : ''}
    ${R.why ? `<p class="dz-why">${R.why}</p>` : ''}
    ${duelRowsHtml(R, P.each)}${typeof duelResX === 'function' ? duelResX() : ''}
    <div class="dz-pts"><small>받은 포인트${room ? ' · ' + (RM_DNAME[diff] || '보통') : ''}</small><b class="num" id="bigScore">+0</b><p>${brk}</p>
      ${P.half ? `<p class="dz-half">${ic('help')}오늘 같은 친구들과 많이 해서 포인트 절반이에요</p>` : ''}
      ${P.tierUp >= 0 ? `<p class="dz-tier">${duelShield(P.tierUp, 22)} 이번 주 '${DUEL_TIERS[P.tierUp].n}' 등급이 됐어요!</p>` : ''}
      ${firstToday ? `<p class="dz-att">${attPillHtml().replace(/<[^>]+>/g, '').trim()}</p>` : ''}</div>
    <p class="dz-again" id="dzAgain" aria-live="polite"></p>
    ${duelContinueHtml()}
    ${resBtns(B)}</div>`;
  const show = again => {
    openModal(html);
    if(again){ const el = $('#bigScore'); if(el) el.textContent = '+' + fmt(P.pts); }
    $('#modal').classList.add('duelm', 'dzm');
    resBind(B); duelContinueBind();
    const pri = $('#mPri'); if(pri && B.cost) pri.classList.add('rb-cost');
    $('#dzShare').onclick = () => duelShareRes();
    duelAgainLoop();
  };
  DZ.show = show;
  setTimeout(() => {
    show();
    if(r1){ fxConfetti(); sfx('fanfare'); } else if(R.tie) sfx('result'); else sfx('lose');
    const el = $('#bigScore'), t0 = performance.now(), dur = FXR.reduce ? 0 : 800, pts = P.pts;
    const stepN = t => { if(!el.isConnected) return; const k = dur ? Math.min(1, (t - t0) / dur) : 1; el.textContent = '+' + fmt(Math.round(pts * (1 - Math.pow(1 - k, 3))));
      if(k < 1){ sfx('tick', { p:k }); requestAnimationFrame(stepN); } else { el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); } };
    requestAnimationFrame(stepN);
    try{ toyMood($('#modal .dz-rows li.me'), r1 ? 'joy' : R.tie ? 'wow' : 'sad'); }catch(_){}   /* 1위 기쁨 · 그 밖 아쉬움(회색 금지) */
  }, $('#veil').classList.contains('on') ? 0 : (r1 ? 500 : 250));
}
/* 결과 창이 열려 있는 동안: 한 판 더 남은 초 · 누른 사람 */
function duelAgainLoop(){
  clearInterval(duelAgainLoop.t);
  const Z = DZ; if(!Z) return;
  const tick = () => {
    const el = $('#dzAgain'), pri = $('#mPri');
    if(!el || DZ !== Z || !$('#dzRes')){ clearInterval(duelAgainLoop.t); return; }
    if(Z.room && RM.cur && RM.cur.id === Z.room.id){
      const ws = rmMembers(RM.cur).filter(p => !p.me && p.rdy).map(p => p.nk);
      el.innerHTML = ws.length ? `${ws.slice(0, 4).map(n => oppAv(n)).join('')}<span>${ws.map(n => escH(duelShortNick(n))).join('·')}${ws.length > 1 ? '가' : '이'} 한 판 더를 눌렀어요</span>` : '';
      return;
    }
    if(!Z.B.again || !pri) return;
    const s = duelAgainState();
    if(!s.on){
      if(pri.dataset.exp) return; pri.dataset.exp = 1;
      pri.innerHTML = `<span class="rb-l">새 상대 찾기 ${costTag()}</span><small>같은 상대와는 시간이 지났어요</small>`; pri.classList.add('rb-cost'); pri.disabled = false;
      pri.onclick = () => { closeModal(); goHome(); setTab('duel'); gateThen(Z.id, () => duelStart(Z.id)); };
      el.innerHTML = ''; return;
    }
    let tm = pri.querySelector('.dz-sec'); if(!tm){ tm = document.createElement('i'); tm.className = 'dz-sec num'; pri.appendChild(tm); }
    tm.textContent = s.left;
    el.innerHTML = s.want ? `<span>${s.n >= 2 ? `${s.n}명이 모였어요 · 곧 시작해요` : '다른 사람을 기다리는 중…'}</span>` : s.n ? `<span>${s.n}명이 한 판 더를 눌렀어요</span>` : '';
  };
  tick(); duelAgainLoop.t = setInterval(tick, 400);
}
function duelAgainPress(){
  const pri = $('#mPri'); if(!pri) return;
  if(!duelAgain()){ const s = duelAgainState(); if(!s.on) toast('같은 상대와 한 판 더 할 시간이 지났어요'); return; }
  sfx('flLock'); pri.disabled = true; pri.classList.add('rb-wait');
  const l = pri.querySelector('.rb-l'); if(l) l.textContent = '기다리는 중…';
}
/* 결과 공유: 대전 카드(1080×1920) */
function duelShareRes(){
  const Z = DZ; if(!Z) return;
  viralShare(cardDuel(Z.R, Z.id, Z.code), () => { if(DZ === Z && Z.show) Z.show(true); else closeModal(); });
}
function cardDuel(R, g, code){
  const names = R.rows.map(x => x.me ? '나' : duelShortNick(x.nick));
  const t = R.n <= 2 && R.tie ? '무승부' : (R.tie ? '공동 ' : '') + R.rank + '위';
  const text = `하루퍼즐 리그 ${GAMES[g].name} 대전 ${t}! ${names.join(' vs ')}\n같은 판으로 붙어 볼래?`;
  return { kind:'duel', title:'대전 결과 공유', head:GAMES[g].name + ' 대전', big:R.rank, unit:'위', sub:t, g, rows:R.rows.slice(0, 5).map(x => ({ nick:x.me ? myNick() : x.nick, me:x.me, rank:x.rank, txt:x.txt || '', col:x.col, shape:x.shape, ai:x.ai })),
    code:code || null, text, q:code ? { room:code } : {} };
}

/* ---- 엔진에 알려 주기(하트·무료 판·결과) ---- */
Object.assign(HOST, {
  canDuel(o){
    if(o && o.again && o.room && duelFreeNext(duelFreeKey(o.room))) return true;
    if(heartState().n < 1){ openHeartSheet('empty'); return false; }
    return true;
  },
  duelFreeLeft:room => duelFreeLeft(room),
  duelRewardHtml:() => `<div class="dh-rw sm"><span class="w">1위 ${duelTopTxt('normal')}</span><span class="l">꼴찌도 +${DUEL_LAST.normal}</span><span class="c">컴퓨터 1:1 이기면 +${DUEL_TWO.easy.w}</span></div>`,
  duelResult:(r, a, b, res) => portalDuelResult(r, a, b, res)
});
