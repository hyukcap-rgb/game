/* ===================== 붙여 쓰는 모듈(임베드) 셸 =====================
   게임 하나만 들어 있는 페이지(embed/<게임>.html)의 첫 화면·결과 화면·바깥과 주고받기.
   - 다른 웹사이트: <iframe> 또는 embed/haru-embed.js로 붙인다.
   - 앱: WebView로 embed/<게임>.html 주소를 그대로 연다.
   주소 옵션(?mode=…)·명령(postMessage)·이벤트 목록은 embed/README.md 참고.
   사이트(portal/)와 같은 엔진(core/)을 쓰고, HOST만 이 파일이 정한다. */
const EMB = (() => {
  const q = new URLSearchParams(location.search);
  const ALL = ['daily', 'solo', 'practice', 'duel'];
  const pick = s => String(s || '').split(',').map(x => x.trim()).filter(x => ALL.includes(x));
  const lv = q.get('level');
  return {
    id:document.documentElement.dataset.game,
    start:q.get('mode') || 'menu',                 /* menu | daily | solo | practice | duel */
    modes:pick(q.get('modes')).length ? pick(q.get('modes')) : ALL,
    level:['easy', 'normal', 'hard'].includes(lv) ? lv : null,
    stage:Math.max(0, parseInt(q.get('stage') || '0', 10) || 0),
    unlock:q.get('unlock') === '1',                /* 솔로: 아직 안 연 스테이지도 바로 시작 */
    close:q.get('close') === '1',                  /* 첫 화면에 '나가기' 버튼(앱이 화면을 닫을 때) */
    origin:q.get('origin') || '*',                 /* 이벤트를 받을 부모 페이지 주소(보안상 정해 주는 것을 권장) */
    room:String(q.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),   /* 더함: 같은 방 코드끼리 대전(2~5명) */
    pace:q.get('pace') === 'slow' ? 's' : q.get('pace') === 'normal' ? 'n' : null,             /* 더함: 대전 느긋하게(시간 2배) */
    roomRd:0,
    cur:null                                       /* 지금 하는 모드 */
  };
})();
const EMB_VER = document.documentElement.dataset.ver || 'dev';
const EMB_WD = [0, 1, 2, 3, 4, 5, 6].map(i => T('core.wd.' + i));   /* 요일(언어 사전) */
/* 오늘의 문제: 요일 난이도(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움) + 날짜 씨앗 → 하루퍼즐 리그 사이트·다른 모든 사이트와 같은 문제 */
function embDailyLv(){ const w = new Date().getDay(); return w === 1 || w === 2 ? 'easy' : w === 0 || w === 6 ? 'hard' : 'normal'; }
function embDay(){ return store.get('hp:eday:' + dayKey(), null) || { best:0, first:null, tries:0 }; }
function embDaySave(r){ store.set('hp:eday:' + dayKey(), r); }
const embHas = m => EMB.modes.includes(m);

/* ---- 바깥으로 알리기: 부모 창(iframe) · 앱(WebView) 모두 ---- */
function embEmit(type, data){
  const msg = Object.assign({ source:'haru-puzzle', type, game:EMB.id, ver:EMB_VER }, data || {});
  try{ if(window.parent && window.parent !== window) window.parent.postMessage(msg, EMB.origin); }catch(_){}
  const json = JSON.stringify(msg);
  try{ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json); }catch(_){}                         /* React Native */
  try{ if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haruPuzzle) window.webkit.messageHandlers.haruPuzzle.postMessage(msg); }catch(_){}   /* iOS WKWebView */
  try{ if(window.HaruPuzzle && typeof window.HaruPuzzle.postMessage === 'function') window.HaruPuzzle.postMessage(json); }catch(_){}   /* Android addJavascriptInterface · Flutter JavaScriptChannel */
  try{ window.dispatchEvent(new CustomEvent('haru-puzzle', { detail:msg })); }catch(_){}
}
/* 앱·부모 창이 다시 넣어 주는 기록(서버에 저장해 둔 진행 상황 등) */
function embState(){ return { solo:advProg(EMB.id), daily:embDay(), duel:(duelRec()[EMB.id] || { w:0, d:0, l:0 }) }; }
function embRestore(s){
  if(!s) return;
  if(s.solo && typeof s.solo === 'object') store.set(advKey(EMB.id), { max:Math.max(1, s.solo.max | 0), stars:s.solo.stars || {} });
  if(s.daily && typeof s.daily === 'object') embDaySave(Object.assign(embDay(), s.daily));
  if(!G || G.over) embMenu();
}

/* ---- 모드 시작 ---- */
function embStart(mode, opt){
  const id = EMB.id, m = NG[id]; opt = opt || {};
  if(!embHas(mode)) mode = EMB.modes[0];
  closeModal();
  EMB.cur = mode;
  if(mode === 'daily'){ startGame(id, embDailyLv()); return; }
  if(mode === 'solo'){
    const p = advProg(id), want = opt.stage || EMB.stage || p.max;
    startGame(id, null, { adv:EMB.unlock ? Math.max(1, want) : Math.max(1, Math.min(want, p.max)) }); return;
  }
  if(mode === 'practice'){
    const lv = opt.level || EMB.level;
    if(!lv && m.levelSheet){ m.levelSheet(); return; }   /* 함대: 실시간/AI 고르는 창 */
    if(!lv){ embLevelSheet(); return; }
    startGame(id, lv, { seed:'prac:' + id + ':' + Date.now() + ':' + Math.random() }); return;
  }
  if(mode === 'duel'){ if(EMB.room) embRoomDuel(); else duelStart(id); return; }
}
/* 방 코드 대전(주소 옵션 room=코드): 같은 코드로 연 사람끼리 대전 방 'fl-d3-e-<코드>-<판>'에 모여 같은 순간 시작(2명 이상, 그 게임 최대 인원까지).
   12초 안에 혼자면 계속 기다림. 사이트의 대전 방과는 따로(모듈끼리만) */
function embRoomDuel(rd){
  const id = EMB.id, code = EMB.room, n = duelMaxOf(id); EMB.cur = 'duel';
  rd = rd || EMB.roomRd + 1;
  if(!duelLive()){ toast(T('core.room.offline')); embMenu(); return; }
  let stop = false;
  openModal(`<div class="rmwait"><span class="ds-radar"><i></i><i></i><i></i></span><p class="note"><b>${T('core.room.code', { code:esc(code.length === 6 ? code.slice(0, 3) + ' ' + code.slice(3) : code) })}</b> · ${T('core.room.rd', { n:rd })}<br>${T('core.room.wait')}${n > 2 ? ' · ' + T('core.room.max', { n }) : ''}</p></div><div class="mbtns one"><button class="b2" id="erNo">${T('core.cancel')}</button></div>`);
  const h = duelPrivate(id, 'normal', 'fl-d3-e-' + code.toLowerCase() + '-' + rd, { n, round:rd, pace:duelPaceGet(), room:{ id:code, code, rd },
    onFail:why => { if(stop) return; if(why === 'gone' && $('#erNo')){ embRoomDuel(rd); return; } closeModal(); toast(why === 'offline' ? T('core.room.offline2') : T('core.room.fail')); embMenu(); } });
  EMB.roomRd = rd;
  $('#erNo').onclick = () => { stop = true; h.cancel(); embMenu(); };
}
function embLevelSheet(){
  const id = EMB.id, m = NG[id];
  const rows = Object.keys(LEVELS).map((k, i) => `<button class="opt" data-lv="${k}"><span class="lvdots">${[0, 1, 2].map(j => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span><span><b>${LEVELS[k].name}</b><small>${m.levelDesc(k)} · ${T('core.prac.max', { n:fmt(maxPts(id, k)) })}</small></span><span></span></button>`).join('');
  openModal(`<h3>${T('core.prac.title', { name:m.name })}</h3><p class="note">${T('core.prac.note')}</p><div class="opts">${rows}</div><div class="mbtns one"><button class="b2" id="mClose">${T('core.close')}</button></div>`);
  document.querySelectorAll('#modal .opt').forEach(b => b.onclick = () => { store.set('hp:lv:' + id, b.dataset.lv); closeModal(); embStart('practice', { level:b.dataset.lv }); });
  $('#mClose').onclick = closeModal;
}

/* ---- 첫 화면 ---- */
function embMenu(){
  if(G && !G.over) return;
  leavePlay(); closeModal();
  $('#play').style.display = 'none';
  const id = EMB.id, m = NG[id], el = $('#menu'), r = embDay(), p = advProg(id), lv = embDailyLv(), R = duelRec()[id] || { w:0, d:0, l:0 };
  el.hidden = false; el.style.setProperty('--gc', m.col[1]);
  const row = (k, icon, title, sub) => `<button class="em-go ${k}" data-m="${k}"><span class="em-i">${icon}</span><span class="em-t"><b>${title}</b><small>${sub}</small></span>${ic('chev')}</button>`;
  el.innerHTML = `<div class="em-card panel"><span class="g-art">${ART[id]()}</span><div class="em-nm"><b>${m.name}</b><small>${m.abil} · ${m.time}</small></div></div>
    <div class="em-list">
      ${embHas('daily') ? row('daily', ic('clock'), T('core.m.daily'), `${T('core.m.dailySub', { wd:EMB_WD[new Date().getDay()], lv:LEVELS[lv].name })}${r.tries ? ' · ' + T('core.m.todayBest', { n:fmt(r.best) }) : ''}`) : ''}
      ${embHas('solo') ? row('solo', ic('map'), T('core.m.solo', { n:p.max }), `${chName(id, chOf(p.max))} · ${T('core.m.stars', { n:advStarsOf(id) })}${conceptsOf(id) ? ' · ' + T('core.m.every5') : ''}${m.cardNote ? ' · ' + esc(m.cardNote()) : ''}`) + `<button class="em-map" id="emMap">${ic('map')} ${T('core.m.map')}</button>` : ''}
      ${embHas('practice') ? row('practice', ic('play'), T('core.m.prac'), m.levelSheet ? T('core.m.pracSub2') : T('core.m.pracSub')) : ''}
      ${embHas('duel') ? row('duel', ic('duel'), duelMaxOf(id) > 2 ? T('core.m.duelN', { n:duelMaxOf(id) }) : T('core.m.duel1'), `${EMB.room ? T('core.room.code', { code:esc(EMB.room) }) + ' · ' : ''}${m.duelHow || T('core.m.duelHow')}${R.w + R.d + R.l ? ' · ' + T('core.m.duelRec', { w:R.w, n:R.w + R.d + R.l }) : ''}${m.cardNote ? ' · ' + esc(m.cardNote()) : ''}`) : ''}
    </div>
    <div class="em-foot"><button id="emHelp">${T('core.m.help')}</button><button id="emBig" aria-pressed="${bigOn()}">${bigOn() ? T('core.m.bigOn') : T('core.m.bigOff')}</button>${EMB.close ? `<button id="emClose">${T('core.m.close')}</button>` : ''}</div>`;
  el.querySelectorAll('.em-go').forEach(b => b.onclick = () => embStart(b.dataset.m));
  const mp = $('#emMap'); if(mp) mp.onclick = () => openAdvMap(id);
  $('#emHelp').onclick = () => openHelp(id);
  $('#emBig').onclick = () => { bigSet(!bigOn()); embEmit('setting', { big:bigOn() }); embMenu(); };   /* 큰 글씨(WP3): 글자 +2px */
  const cl = $('#emClose'); if(cl) cl.onclick = () => embEmit('close');
  window.scrollTo(0, 0);
  embEmit('menu');
}

/* ---- 결과 ---- */
function embCount(score, prefix){
  const el = $('#bigScore'); if(!el) return;
  const t0 = performance.now(), dur = FXR.reduce ? 0 : 900; let lastTk = 0;
  const step = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); el.textContent = (prefix || '') + fmt(Math.round(score * e));
    if(k < 1){ if(t - lastTk > 55){ lastTk = t; sfx('tick', { p:e }); } requestAnimationFrame(step); }
    else if(el.isConnected){ el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); fxBuzz(20); } };
  requestAnimationFrame(step);
}
/* 결과 창 버튼: 사이트와 같은 위계(주 버튼 1개 · 글자 버튼 줄). 버튼 id(#mPri·#mSec·#mGh)와 이벤트는 그대로 */
function embRes(pri, sec, extra){
  return { pri:{ id:'mPri', label:pri[0], sub:pri[2], fn:pri[1] }, links:[{ id:'mSec', label:sec[0], fn:sec[1] }].concat(extra || []) };
}
function embButtons(pri, sec, extra){ return resBtns(embRes(pri, sec, extra)); }
function embBind(pri, sec, extra){ resBind(embRes(pri, sec, extra)); }
/* 오늘의 문제 · 연습 */
function embPlayFinish(win){
  const id = G.id, m = NG[id], daily = EMB.cur === 'daily', sec = Math.round(elapsed());
  const q = win ? calcScore() : null, part = !win && daily ? Math.round(gameProg() * 300) : 0, score = win ? q.score : part;
  let rec = null;
  if(daily){ rec = embDay(); if(G.attempt === 1) rec.first = score; rec.best = Math.max(rec.best || 0, score); embDaySave(rec); }
  embEmit('finish', { mode:EMB.cur, win, score, level:G.lv, attempt:G.attempt, official:daily && G.attempt === 1, partial:!win && part > 0, time:sec, date:dayKey(),
    detail:q ? { base:q.base, bonus:q.time, extra:q.paw, rows:[q.l1, q.l2, q.l3], mult:G.L.mult } : null });
  const again = () => daily ? startGame(id, embDailyLv()) : embStart('practice', { level:G.lv });
  let html;
  if(win){
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${m.winTitle || T('core.res.clearShort')}</h3><div class="big" id="bigScore">0</div>
      <p class="note">${daily ? (G.attempt === 1 ? T('core.res.dailyFirst') : T('core.m.todayBest', { n:fmt(rec.best) })) : T('core.res.prac', { lv:G.L.name })}</p>
      <details class="brk"><summary>${T('core.res.detail')}</summary><div><span>${q.l1}</span><b>${q.base}</b></div><div><span>${q.l2}</span><b>${q.time}</b></div><div><span>${q.l3}</span><b>${q.paw}</b></div>${G.L.mult !== 1 ? `<div><span>${T('core.res.mult')}</span><b>×${G.L.mult}</b></div>` : ''}</details>`;
  } else {
    html = `<h3 class="bad">${resFace('sad')}${m.loseTitle || T('core.res.failTitle')}</h3><p class="lose">${daily && part ? T('core.res.partial', { n:fmt(part) }) : T('core.res.fail')}</p><p class="note">${lossProgress()} ${daily ? T('core.res.dailyRetry') : T('core.res.tryAgain')}</p>`;
  }
  const pri = [daily ? T('core.res.samePuzzle') : T('core.res.newPuzzle'), again, daily ? (G.attempt === 1 ? T('core.res.firstKept') : T('core.res.bestKept')) : T('core.res.lv', { lv:G.L.name })], sc = [T('core.res.home'), embMenu];
  html += embButtons(pri, sc);
  setTimeout(() => {
    openModal(html); embBind(pri, sc);
    if(win && !m.noConfetti) fxConfetti();
    sfx(win ? 'result' : 'lose');
    if(win) embCount(score);
  }, win ? 500 : 250);
}
/* 솔로 */
function embSoloFinish(win){
  const id = G.id, n = G.adv, p = advProg(id), prev = p.stars[n] || 0, sec = Math.round(elapsed());
  let st = 0, first = false, better = false;
  if(win){ st = advStarCalc(); first = !prev; better = st > prev; p.stars[n] = Math.max(prev, st); p.max = Math.max(p.max, n + 1); store.set(advKey(id), p); }
  embEmit('finish', { mode:'solo', win, stage:n, stars:st, first, best:p.stars[n] || 0, time:sec });
  embEmit('progress', { solo:{ max:p.max, stars:p.stars, total:advStarsOf(id) } });
  const c = chOf(n), cs = (c - 1) * 10;
  let dots = ''; for(let k = 1; k <= 10; k++){ const s = p.stars[cs + k] || 0; dots += `<i class="${s ? 's' + s : cs + k === p.max ? 'cur' : ''}"></i>`; }
  const chBox = `<div class="chprog" style="--gc:${GCOL[id][1]}"><div class="h">${chName(id, c)} <small>${T('core.map.chapter', { c, s:chStars(id, c) })}</small></div><div class="chdots">${dots}</div></div>`;
  let html;
  if(win){
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${T('core.res.clear', { n })}</h3>
      <div class="bigstars" aria-label="${T('core.res.starsAria', { n:st })}">${[1, 2, 3].map(i => `<span class="s${i <= st ? '' : ' off'}" style="animation-delay:${(0.1 + i * 0.22).toFixed(2)}s">${STAR_G}</span>`).join('')}</div>
      ${first ? '<span class="pill new">' + T('core.res.firstClear') + '</span>' : better ? '<span class="pill new">' + T('core.res.starBest') + '</span>' : `<p class="note">${T('core.res.starKept', { n:p.stars[n] })}</p>`}
      ${recHtml()}${chBox}<p class="note">${st === 3 ? T('core.res.perfect') : T('core.res.moreStars') + ' · ' + ADV_RULE[id].split(' · ')[st]}</p>`;
  } else {
    html = `<h3 class="bad">${resFace('sad')}${T('core.res.fail')}</h3><p class="lose">${T('core.stageN', { n })}</p><p class="note">${lossProgress()} ${T('core.res.failNote')}</p>${chBox}`;
  }
  const pri = win ? [T('core.res.next'), () => startGame(id, null, { adv:n + 1 })] : [T('core.res.retry'), () => startGame(id, null, { adv:n })];
  const sc = [`${ic('map')}${T('core.res.map')}`, () => { embMenu(); openAdvMap(id, win ? n + 1 : n); }], gh = [{ id:'mGh', label:T('core.res.home'), fn:embMenu }];
  const RB = embRes(pri, sc, gh);
  RB.pair = [ win ? warmSkip(id, n, st, p2 => embEmit('progress', { solo:{ max:p2.max, stars:p2.stars, total:advStarsOf(id) } })) : null ];   /* 몸풀기 1판 ★3 → 5판으로 */
  html += resBtns(RB);
  setTimeout(() => {
    openModal(html); resBind(RB); recFx();
    if(win){
      fxConfetti(); sfx('result');
      document.querySelectorAll('#modal .bigstars .s').forEach((s, k) => setTimeout(() => {
        if(!s.isConnected) return;
        if(s.classList.contains('off')){ sfx('starOff'); return; }
        sfx('star', { i:k + 1 }); fxPop(s, 'gold'); fxBuzz(18);
      }, (0.1 + (k + 1) * 0.22) * 1000 + 180));
    } else sfx('lose');
  }, win ? 500 : 250);
}
/* 대전: 사이트와 같은 배치(큰 순위 → 순위표 → 버튼), 포인트 대신 "대전 기록". finish 이벤트는 더하기만(rank·players·kind·round·room) */
const EMB_CROWN = `<svg class="dcrown" viewBox="0 0 32 24" aria-hidden="true"><path d="M3 7l6.5 6L16 3l6.5 10L29 7l-3 14H6z" fill="#FFC93C" stroke="#1A0F45" stroke-width="2.4" stroke-linejoin="round"/><circle cx="16" cy="15.5" r="2.2" fill="#F0368A" stroke="#1A0F45" stroke-width="1.4"/></svg>`;
function embDuelFallback(r, a, b){
  const D = G.duel, ai = D.mode === 'ai' || (D.fleet && G.mode !== 'pvp' && G.lv !== 'pvp'), tx = x => x && x.txt ? x.txt : x && x.sc ? T('core.pts', { n:fmt(x.sc) }) : '';
  return { kind:'turn', n:2, ai, rank:r === 'l' ? 2 : 1, tie:r === 'd', why:duelWhy(r, a, b), round:null, room:{ code:null, canAgain:false },
    rows:[ { pid:'me', nick:T('core.me'), me:true, col:DUEL_SEAT[0].col, shape:DUEL_SEAT[0].shape, rank:r === 'l' ? 2 : 1, txt:tx(a) },
      { pid:'op', nick:(D.opp && D.opp.nick) || T('core.opp'), ai, col:DUEL_SEAT[1].col, shape:DUEL_SEAT[1].shape, rank:r === 'w' ? 2 : 1, txt:tx(b) } ].sort((x, y) => x.rank - y.rank) };
}
function embDuelResult(r, a, b, res){
  const D = G.duel, id = G.id, R = res && res.rows ? res : embDuelFallback(r, a, b), r1 = R.rank === 1 && !R.tie;
  const RC = duelRec(), x = RC[id] || { w:0, d:0, l:0 }; x[r]++; RC[id] = x; store.set('hp:duelRec', RC);
  embEmit('finish', { mode:'duel', result:r, win:r === 'w', vs:D.mode === 'ai' || (D.fleet && G.mode !== 'pvp') ? 'ai' : 'live', me:a ? { score:a.sc, progress:a.pg } : null, opp:b ? { score:b.sc, progress:b.pg } : null, record:x,
    rank:R.rank, players:R.rows.map(y => ({ nick:y.me ? null : y.nick, me:!!y.me, ai:!!y.ai, rank:y.rank, ok:!!y.ok, v:y.v == null ? null : y.v, t:y.t == null ? null : y.t, mis:y.mis || 0, score:y.sc || 0, text:y.txt || '', left:!!y.left })),
    kind:R.kind, round:R.round ? { r:R.round.r, series:R.round.series || {} } : null, room:EMB.room ? { code:EMB.room, r:EMB.roomRd } : (R.room && R.room.code ? { code:R.room.code } : null) });
  const tot = x.w + x.d + x.l, t = R.n <= 2 && R.tie ? T('core.d.draw') : `${R.tie ? T('core.d.tie') : ''}${T('core.d.rank', { n:R.rank })}`;
  const me = R.rows.find(y => y.me) || {};
  const rows = `<ol class="dz-rows">${R.rows.map(y => `<li class="${y.me ? 'me' : ''}${y.rank === 1 ? ' win' : ''}${y.left ? ' left' : ''}"><span class="dz-medal${y.rank <= 3 ? ' m' + y.rank : ''}">${y.rank}</span>${duelShapeSvg(y.shape, y.col, 16)}${y.me ? avatar({ me:true }) : oppAv(y.nick)}
    <span class="dz-nm"><b>${y.me ? T('core.me') : esc(y.nick)}${y.ai ? ' <em class="aitag">' + T('core.cpu') + '</em>' : ''}</b><small>${esc(y.txt || '')}</small></span></li>`).join('')}</ol>`;
  let html = `${r1 ? '<div class="burst" aria-hidden="true"></div>' : ''}<div class="dzres" id="dzRes">
    <h3 class="dz-h${r1 ? ' r1' : ''}" data-r="${R.tie && R.rank === 1 ? 'd' : r1 ? 'w' : 'l'}">${r1 ? EMB_CROWN : ''}<span class="num">${t}</span></h3>
    ${me.txt ? `<p class="dz-mine">${esc(me.txt)}</p>` : ''}${R.why ? `<p class="dz-why">${R.why}</p>` : ''}${rows}${typeof duelResX === 'function' ? duelResX() : ''}
    <p class="dz-rec">${T('core.d.rec', { w:x.w, n:tot })}</p><p class="dz-again" id="dzAgain" aria-live="polite"></p>`;
  const RPX = typeof duelReplayOf === 'function' ? duelReplayOf(res) : null;   /* 이 판 다시 풀기 · 친구에게 보내기(R11) */
  const rpRow = RPX ? `<div class="rb-links dz-rp"><button id="dzRp">${ic('play')}${T('core.d.replay')}</button><i aria-hidden="true">·</i><button id="dzSend">${ic('share')}${T('core.map.send')}</button></div>` : '';
  const quickAgain = R.room && R.room.canAgain && !R.ai;
  const pri = EMB.room ? [T('core.d.again'), () => embRoomDuel(EMB.roomRd + 1), T('core.d.againRoom')]
    : quickAgain ? [T('core.d.again'), () => embDuelAgain(), T('core.d.againSame')] : [T('core.d.newOpp'), () => { embMenu(); embStart('duel'); }, T('core.d.newOppSub')];
  const sc = [T('core.res.home'), embMenu], ex = quickAgain ? [{ id:'mNew', label:T('core.d.newOpp'), fn:() => { embMenu(); duelStart(id); } }] : [];
  const RB = embRes(pri, sc, ex); if(quickAgain) RB.pri.keep = true;
  setTimeout(() => {
    openModal(html + duelContinueHtml() + rpRow + resBtns(RB) + '</div>'); $('#modal').classList.add('duelm', 'dzm'); resBind(RB); duelContinueBind();
    if(RPX){ $('#dzRp').onclick = () => duelReplayStart(RPX); $('#dzSend').onclick = () => embSendDuel(RPX); }
    if(r1){ fxConfetti(); sfx('fanfare'); } else if(R.tie) sfx('result'); else sfx('lose');
    try{ toyMood($('#modal .dz-rows li.me'), r1 ? 'joy' : R.tie ? 'wow' : 'sad'); }catch(_){}
    if(quickAgain) embAgainLoop(id);
  }, $('#veil').classList.contains('on') ? 0 : (r1 ? 500 : 250));
}
/* 빠른 대전 한 판 더(결과 뒤 30초): 남은 초 · 누른 사람 수 */
function embDuelAgain(){ const p = $('#mPri'); if(!duelAgain()){ toast(T('core.d.againLate')); return; } sfx('flLock'); if(p){ p.disabled = true; const l = p.querySelector('.rb-l'); if(l) l.textContent = T('core.d.waiting'); } }
function embAgainLoop(id){
  clearInterval(embAgainLoop.t);
  const g = G, tick = () => {
    const el = $('#dzAgain'), pri = $('#mPri'); if(!el || !pri || G !== g){ clearInterval(embAgainLoop.t); return; }
    const s = duelAgainState();
    if(!s.on){ clearInterval(embAgainLoop.t); pri.disabled = false; pri.innerHTML = '<span class="rb-l">' + T('core.d.newOpp') + '</span><small>' + T('core.d.againGone') + '</small>'; pri.onclick = () => { closeModal(); embMenu(); duelStart(id); }; el.innerHTML = ''; return; }
    let tm = pri.querySelector('.dz-sec'); if(!tm){ tm = document.createElement('i'); tm.className = 'dz-sec num'; pri.appendChild(tm); } tm.textContent = s.left;
    el.innerHTML = s.want ? `<span>${s.n >= 2 ? T('core.d.gathered', { n:s.n }) : T('core.d.waitOthers')}</span>` : s.n ? `<span>${T('core.d.againN', { n:s.n })}</span>` : '';
  };
  tick(); embAgainLoop.t = setInterval(tick, 400);
}

/* ---- 대전 판 다시 풀기 · 보내기(R11, 더함) ----
   보내기: 이 모듈 주소 + ?ds=<씨앗>&g&lv&pn&pc&rk&rt&t&sc(core/engine.js duelReplayQ) → 기기 공유 시트, 안 되면 복사. 붙인 곳에는 'send' 이벤트(url 포함).
   받기: 주소에 ds=가 있으면 첫 화면 위에 "친구가 보낸 대전 판" 창 → 풀어 보기(기록 안 됨). 시작·끝에 'replay' 이벤트(phase:'start'|'finish') */
const embT = t => t > 0 ? clock2(t).replace(/^0(?=\d:)/, '') : '–';
function embDsUrl(x){
  const u = new URL(location.origin + location.pathname), now = new URLSearchParams(location.search), q = duelReplayQ(x);
  for(const k of ['ns', 'sound', 'big']){ const v = now.get(k); if(v != null) u.searchParams.set(k, v); }   /* 기록 나누기·소리·큰 글씨는 그대로 */
  for(const k in q) u.searchParams.set(k, q[k]);
  return u.toString();
}
async function embSendDuel(x){
  const url = embDsUrl(x), name = NG[EMB.id].name, rec = x.dk === 'score' && x.sc ? T('core.pts', { n:fmt(x.sc) }) : x.t != null ? embT(x.t) : '';
  const text = T('core.send.text', { name, rec:rec ? T('core.send.rec', { r:rec }) : '', rk:x.rk ? T('core.send.rk', { n:x.rk }) : '' });
  embEmit('send', { kind:'duel', url, text, seed:x.seed, level:x.lv, rank:x.rk || null, time:x.t == null ? null : x.t, score:x.sc || 0 });
  try{ if(navigator.share){ await navigator.share({ title:name, text, url }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  let ok = false; try{ await navigator.clipboard.writeText(text + '\n' + url); ok = true; }catch(_){}
  toast(ok ? T('core.send.copied') : T('core.send.made'));
}
function embDsGift(x){
  const nm = esc(x.from || T('core.friend')), m = NG[EMB.id], rec = [x.rk ? T('core.d.rank', { n:x.rk }) : '', x.rt || (x.t != null ? embT(x.t) : x.sc ? T('core.pts', { n:fmt(x.sc) }) : '')].filter(Boolean).join(' · ');
  openModal(`<h3>${T('core.sub.dsFrom', { name:nm })}</h3><span class="g-art em-dsart">${ART[EMB.id]()}</span>
    <p class="note">${T('core.ds.solo', { name:m.name })}${rec ? `<br>${T('core.ds.rec', { name:nm, r:esc(rec) })}` : ''}</p><p class="note">${T('core.ds.noRec')}</p>
    <div class="mbtns two"><button class="b2" id="mClose">${T('core.later')}</button><button class="b1" id="dsGo">${T('core.ds.go')}</button></div>`);
  $('#mClose').onclick = closeModal;
  $('#dsGo').onclick = () => duelReplayStart(x);
}
function embReplayFinish(win){
  const R = G.replay, id = G.id, m = NG[id];
  if(!R || R.kind !== 'duel'){ embPlayFinish(win); return; }
  const t = Math.round(elapsed()), isSc = R.dk === 'score', from = R.from || '';
  let score = 0; if(win || isSc){ try{ score = calcScore().score; }catch(_){ score = 0; } }
  const meTxt = isSc ? T('core.pts', { n:fmt(score) }) : win ? embT(t) : T('core.ds.notDone'), opTxt = isSc ? (R.sc ? T('core.pts', { n:fmt(R.sc) }) : (R.rt || '–')) : (R.t != null ? embT(R.t) : (R.rt || '–'));
  const meWin = isSc ? score > (R.sc || 0) : win && (R.t == null || t < R.t), opWin = isSc ? (R.sc || 0) > score : R.t != null && (!win || t > R.t);
  embEmit('replay', { phase:'finish', win, time:t, score, seed:R.seed, from:from || null });
  /* 나란히: 대전 결과 창과 같은 순위표 모양(나 · 보낸 사람 또는 대전 때 나), 앞선 쪽이 위 */
  const even = !meWin && !opWin, two = [ { me:true, nm:T('core.me'), txt:meTxt, w:meWin }, { me:false, nm:from || T('core.ds.meThen'), txt:opTxt + (R.rk ? ' · ' + T('core.ds.duelRank', { n:R.rk }) : ''), w:opWin } ];
  if(opWin) two.reverse();
  const vs = `<ol class="dz-rows em-rpvs">${two.map(y => `<li class="${y.me ? 'me' : ''}${y.w ? ' win' : ''}"><span class="dz-medal ${y.w || even ? 'm1' : 'm2'}">${y.w || even ? 1 : 2}</span>${y.me || !from ? avatar({ me:true }) : oppAv(from)}<span class="dz-nm"><b>${esc(y.nm)}</b><small>${esc(y.txt)}</small></span></li>`).join('')}</ol>`;
  const html = (win ? `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${m.winTitle || T('core.ds.done')}</h3>` : `<h3 class="bad">${resFace('sad')}${T('core.res.fail')}</h3><p class="note">${lossProgress()}</p>`)
    + vs + `<p class="note">${T('core.ds.noRec2')}</p>`;
  const mine = Object.assign({}, R, { rk:0, rt:meTxt, t:win ? t : null, sc:isSc ? score : 0, from:'' });
  const RB = { pri:{ id:'mPri', label:T('core.map.replay'), sub:T('core.ds.sameSub'), fn:() => duelReplayStart(R) },
    links:[ win || (isSc && score > 0) ? { id:'dzSend', label:`${ic('share')}${T('core.ds.sendMine')}`, keep:true, fn:() => embSendDuel(mine) } : null, { id:'mGh', label:T('core.res.home'), fn:embMenu } ] };
  setTimeout(() => { openModal(html + resBtns(RB)); resBind(RB); if(win){ if(!m.noConfetti) fxConfetti(); sfx('result'); } else sfx('lose'); }, win ? 500 : 250);
}

/* ---- 엔진에 알려 주기 ---- */
Object.assign(HOST, {
  heartCost:false,
  beforeStart(id, lv, o){
    if(o.replay){ EMB.cur = 'replay'; embEmit('replay', { phase:'start', seed:o.replay.seed || null, level:lv, from:o.replay.from || null }); return { attempt:0 }; }   /* 더함(R11): 대전 판 다시 풀기 — 기록 안 됨 */
    if(o.adv) EMB.cur = 'solo'; else if(o.duel) EMB.cur = 'duel'; else if(!o.seed && EMB.cur !== 'practice') EMB.cur = 'daily';
    if(EMB.cur === 'practice' && !o.adv && !o.duel && !o.seed) o.seed = 'prac:' + id + ':' + Date.now() + ':' + Math.random();   /* 연습은 매번 새 문제 */
    let attempt = 0;
    if(EMB.cur === 'daily' && !o.adv && !o.duel){ const r = embDay(); r.tries++; embDaySave(r); attempt = r.tries; }
    embEmit('start', { mode:EMB.cur, level:o.adv ? null : lv, stage:o.adv || null, attempt });
    return { attempt };
  },
  showPlay(){ $('#menu').hidden = true; $('#play').style.display = 'block'; },
  subtitle:(L, attempt, ex) => EMB.cur === 'daily' ? (attempt === 1 ? `${L.name}${ex}` : `${T('core.map.replay')}${ex}`) : `${T('core.sub.pracShort')}${ex}`,
  subtitleFull:(L, attempt, ex) => EMB.cur === 'daily' ? T('core.sub.daily', { lv:L.name + ex, k:attempt === 1 ? T('core.sub.firstRec') : T('core.map.replay') }) : T('core.sub.prac', { lv:L.name + ex }),
  quitInfo:() => ({ note:EMB.cur === 'daily' ? T('core.quit.daily') : T('core.quit.note'), label:T('core.quit.go') }),
  finish(win){ if(G.adv) embSoloFinish(win); else embPlayFinish(win); },
  exit(){ embEmit('quit', { mode:EMB.cur }); embMenu(); },
  canDuel:() => true,
  duelResult:(r, a, b, res) => embDuelResult(r, a, b, res),
  replayFinish:win => embReplayFinish(win)
});
Object.defineProperty(HOST, 'flatMult', { get:() => EMB.cur === 'daily' });   /* 오늘의 문제는 배율 없이(사이트와 같은 점수) */

/* ---- 바깥에서 조종: postMessage({ target:'haru-puzzle', cmd:'start', mode:'daily' }) 또는 앱에서 HaruPuzzleEmbed.start('daily') ---- */
window.HaruPuzzleEmbed = {
  start:(mode, opt) => embStart(mode, opt),
  menu:() => { if(G && !G.over){ G.over = true; } embMenu(); },
  sound:on => { sndSetOn(!!on); },
  big:on => { bigSet(!!on); if(!G || G.over) embMenu(); },   /* 큰 글씨 켜기/끄기(더한 명령) */
  state:() => { const s = embState(); embEmit('state', { state:s }); return s; },
  restore:s => embRestore(s)
};
window.addEventListener('message', e => {
  const d = e.data; if(!d || d.target !== 'haru-puzzle') return;
  const A = window.HaruPuzzleEmbed;
  if(d.cmd === 'start') A.start(d.mode, d);
  else if(d.cmd === 'menu') A.menu();
  else if(d.cmd === 'sound') A.sound(d.on);
  else if(d.cmd === 'big') A.big(d.on);
  else if(d.cmd === 'state') A.state();
  else if(d.cmd === 'restore') A.restore(d.state);
});
/* 높이 알리기(부모가 iframe 높이를 맞출 때) */
(() => { let last = 0; const send = () => { const h = Math.ceil(document.documentElement.scrollHeight); if(Math.abs(h - last) > 2){ last = h; embEmit('resize', { height:h }); } };
  try{ new ResizeObserver(send).observe(document.body); }catch(_){ setInterval(send, 1000); } })();

/* ---- 시작 ---- */
registerGames([EMB.id]);
/* 게임 정의의 modes가 있으면 그 모드만(예: 오늘의 문제·연습이 없는 게임) */
if(Array.isArray(NG[EMB.id].modes)){ const ok = EMB.modes.filter(x => NG[EMB.id].modes.includes(x)); EMB.modes = ok.length ? ok : NG[EMB.id].modes.filter(x => ['daily', 'solo', 'practice', 'duel'].includes(x)); }
playChromeInit();
/* 주소 옵션 lang=en(더함, DEV-01): 창 제목·첫 화면 이름표도 그 언어로. 한국어는 페이지에 적힌 그대로(core/i18n.js) */
if(i18nLang() !== 'ko'){ try{ document.title = NG[EMB.id].name + ' · ' + T('core.brand'); $('#menu').setAttribute('aria-label', NG[EMB.id].name); }catch(_){} }
/* 뒤로가기 처리는 붙인 사이트의 방문 기록을 건드리므로 주소 옵션 ?back=1일 때만(앱 WebView 등) */
if(new URLSearchParams(location.search).get('back') === '1'){ HOST.historyGuard = true; navInit(); }
if(embHas('duel')) netStart(); else ROOM_STATE = 'none';   /* 대전을 켠 곳에서만 대전 서버에 연결 */
if(new URLSearchParams(location.search).get('sound') === '0') sndSetOn(false);
if(EMB.pace) store.set('hp:duelPace', EMB.pace);   /* 주소 옵션 pace=slow|normal: 대전 느긋하게(시간 2배) */
{ const bg = new URLSearchParams(location.search).get('big'); if(bg === '1' || bg === '0') bigSet(bg === '1'); }   /* 주소 옵션 big=1|0: 큰 글씨 */
embEmit('ready', { name:NG[EMB.id].name, modes:EMB.modes });
embMenu();
{ const ds = duelReplayParse(new URLSearchParams(location.search));   /* 주소 옵션 ds=(더함, R11): 친구가 보낸 대전 판 → 첫 화면 위에 창 */
  if(ds && ds.g === EMB.id) embDsGift(ds); else if(EMB.start !== 'menu' && embHas(EMB.start)) embStart(EMB.start); }
