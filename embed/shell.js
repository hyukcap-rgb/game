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
    cur:null                                       /* 지금 하는 모드 */
  };
})();
const EMB_VER = document.documentElement.dataset.ver || 'dev';
const EMB_WD = ['일', '월', '화', '수', '목', '금', '토'];
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
  if(mode === 'duel'){ duelStart(id); return; }
}
function embLevelSheet(){
  const id = EMB.id, m = NG[id];
  const rows = Object.keys(LEVELS).map((k, i) => `<button class="opt" data-lv="${k}"><span class="lvdots">${[0, 1, 2].map(j => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span><span><b>${LEVELS[k].name}</b><small>${m.levelDesc(k)} · 최대 약 ${fmt(maxPts(id, k))}점</small></span><span></span></button>`).join('');
  openModal(`<h3>${m.name} 연습</h3><p class="note">난이도를 고르면 새 문제로 시작해요.</p><div class="opts">${rows}</div><div class="mbtns one"><button class="b2" id="mClose">닫기</button></div>`);
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
      ${embHas('daily') ? row('daily', ic('clock'), '오늘의 문제', `${EMB_WD[new Date().getDay()]}요일 · ${LEVELS[lv].name} · 모두 같은 문제${r.tries ? ' · 오늘 최고 ' + fmt(r.best) + '점' : ''}`) : ''}
      ${embHas('solo') ? row('solo', ic('map'), '솔로 · 스테이지 ' + p.max, `${chName(id, chOf(p.max))} · 별 ${advStarsOf(id)}개${conceptsOf(id) ? ' · 5판마다 새 규칙' : ''}${m.cardNote ? ' · ' + esc(m.cardNote()) : ''}`) + `<button class="em-map" id="emMap">${ic('map')} 스테이지 맵</button>` : ''}
      ${embHas('practice') ? row('practice', ic('play'), '연습', m.levelSheet ? '상대와 난이도를 골라요' : '쉬움 · 보통 · 어려움 중 골라 새 문제로') : ''}
      ${embHas('duel') ? row('duel', ic('duel'), '1:1 대전', `${m.duelHow || '같은 문제 · 점수가 높으면 승리'}${R.w + R.d + R.l ? ` · ${R.w}승 ${R.d}무 ${R.l}패` : ''}${m.cardNote ? ' · ' + esc(m.cardNote()) : ''}`) : ''}
    </div>
    <div class="em-foot"><button id="emHelp">게임 방법</button><button id="emBig" aria-pressed="${bigOn()}">큰 글씨 ${bigOn() ? '켬' : '끔'}</button>${EMB.close ? `<button id="emClose">나가기</button>` : ''}</div>`;
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
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${m.winTitle || '클리어!'}</h3><div class="big" id="bigScore">0</div>
      <p class="note">${daily ? (G.attempt === 1 ? '오늘의 문제 첫 기록이에요' : `오늘 최고 ${fmt(rec.best)}점`) : '연습 · ' + G.L.name}</p>
      <details class="brk"><summary>점수 자세히</summary><div><span>${q.l1}</span><b>${q.base}</b></div><div><span>${q.l2}</span><b>${q.time}</b></div><div><span>${q.l3}</span><b>${q.paw}</b></div>${G.L.mult !== 1 ? `<div><span>난이도 배율</span><b>×${G.L.mult}</b></div>` : ''}</details>`;
  } else {
    html = `<h3 class="bad">${resFace('sad')}${m.loseTitle || '이번 판은 실패'}</h3><p class="lose">${daily && part ? '부분 점수 ' + fmt(part) + '점' : '아쉬워요!'}</p><p class="note">${lossProgress()} ${daily ? '같은 문제로 다시 해 볼 수 있어요.' : '다시 도전해 봐요.'}</p>`;
  }
  const pri = [daily ? '같은 문제 다시 풀기' : '새 문제로 한 판 더', again, daily ? (G.attempt === 1 ? '첫 기록은 그대로 남아요' : '오늘 최고 기록만 남아요') : '난이도 ' + G.L.name], sc = ['처음으로', embMenu];
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
  const chBox = `<div class="chprog" style="--gc:${GCOL[id][1]}"><div class="h">${chName(id, c)} <small>챕터 ${c} · 별 ${chStars(id, c)}/30</small></div><div class="chdots">${dots}</div></div>`;
  let html;
  if(win){
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}스테이지 ${n} 클리어!</h3>
      <div class="bigstars" aria-label="별 ${st}개">${[1, 2, 3].map(i => `<span class="s${i <= st ? '' : ' off'}" style="animation-delay:${(0.1 + i * 0.22).toFixed(2)}s">${STAR_G}</span>`).join('')}</div>
      ${first ? '<span class="pill new">첫 클리어!</span>' : better ? '<span class="pill new">별 기록 경신!</span>' : `<p class="note">최고 기록 별 ${p.stars[n]}개는 그대로예요</p>`}
      ${recHtml()}${chBox}<p class="note">${st === 3 ? '완벽해요! 별 3개 달성' : '다시 하면 별을 더 모을 수 있어요 · ' + ADV_RULE[id].split(' · ')[st]}</p>`;
  } else {
    html = `<h3 class="bad">${resFace('sad')}아쉬워요!</h3><p class="lose">스테이지 ${n}</p><p class="note">${lossProgress()} 몇 번이든 다시 할 수 있어요.</p>${chBox}`;
  }
  const pri = win ? ['다음 스테이지 ▶', () => startGame(id, null, { adv:n + 1 })] : ['다시 도전', () => startGame(id, null, { adv:n })];
  const sc = [`${ic('map')}스테이지 맵`, () => { embMenu(); openAdvMap(id, win ? n + 1 : n); }], gh = [{ id:'mGh', label:'처음으로', fn:embMenu }];
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
/* 대전 */
function embDuelResult(r, a, b){
  const D = G.duel, id = G.id, win = r === 'w', why = duelWhy(r, a, b);
  const R = duelRec(), x = R[id] || { w:0, d:0, l:0 }; x[r]++; R[id] = x; store.set('hp:duelRec', R);
  embEmit('finish', { mode:'duel', result:r, win, vs:D.mode === 'ai' || (D.fleet && G.mode !== 'pvp') ? 'ai' : 'live', me:a ? { score:a.sc, progress:a.pg } : null, opp:b ? { score:b.sc, progress:b.pg } : null, record:x });
  const html = `${win ? '<div class="burst" aria-hidden="true"></div>' : ''}<h3 class="${r === 'l' ? 'bad' : 'ok'}">${win ? '승리!' : r === 'd' ? '무승부' : '패배'}</h3>
    ${duelSidesHtml(r, a, b)}${why ? `<p class="note">${why}</p>` : ''}
    <p class="note">대전 기록 ${x.w}승 ${x.d}무 ${x.l}패</p>`;
  const pri = ['다시 대전', () => { embMenu(); embStart('duel'); }], sc = ['처음으로', embMenu];
  setTimeout(() => {
    openModal(html + duelContinueHtml() + embButtons(pri, sc)); embBind(pri, sc); duelContinueBind();
    if(win){ fxConfetti(); sfx('fanfare'); } else if(r === 'd') sfx('result'); else sfx('lose');
    try{ const mm = r === 'w' ? ['joy', 'sad'] : r === 'l' ? ['sad', 'joy'] : ['wow', 'wow']; document.querySelectorAll('#modal .dr-side').forEach((e, i) => toyMood(e, mm[i])); }catch(_){}   /* 이긴 쪽 기쁨 · 진 쪽 아쉬움 */
    const w = $('#modal .dr-side.win'); if(w) setTimeout(() => fxPop(w, 'gold'), 300);
  }, $('#veil').classList.contains('on') ? 0 : (win ? 500 : 250));
}

/* ---- 엔진에 알려 주기 ---- */
Object.assign(HOST, {
  heartCost:false,
  beforeStart(id, lv, o){
    if(o.adv) EMB.cur = 'solo'; else if(o.duel) EMB.cur = 'duel'; else if(!o.seed && EMB.cur !== 'practice') EMB.cur = 'daily';
    if(EMB.cur === 'practice' && !o.adv && !o.duel && !o.seed) o.seed = 'prac:' + id + ':' + Date.now() + ':' + Math.random();   /* 연습은 매번 새 문제 */
    let attempt = 0;
    if(EMB.cur === 'daily' && !o.adv && !o.duel){ const r = embDay(); r.tries++; embDaySave(r); attempt = r.tries; }
    embEmit('start', { mode:EMB.cur, level:o.adv ? null : lv, stage:o.adv || null, attempt });
    return { attempt };
  },
  showPlay(){ $('#menu').hidden = true; $('#play').style.display = 'block'; },
  subtitle:(L, attempt, ex) => EMB.cur === 'daily' ? `오늘의 문제 · ${L.name}${ex} · ${attempt === 1 ? '첫 기록' : '다시 풀기'}` : `연습 · ${L.name}${ex} · 새 문제`,
  quitInfo:() => ({ note:EMB.cur === 'daily' ? '지금 나가면 이번 판은 기록되지 않아요. 같은 문제는 다시 할 수 있어요.' : '지금 나가면 이번 판은 기록되지 않아요.', label:'그만하기' }),
  finish(win){ if(G.adv) embSoloFinish(win); else embPlayFinish(win); },
  exit(){ embEmit('quit', { mode:EMB.cur }); embMenu(); },
  canDuel:() => true,
  duelResult:(r, a, b) => embDuelResult(r, a, b)
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
/* 뒤로가기 처리는 붙인 사이트의 방문 기록을 건드리므로 주소 옵션 ?back=1일 때만(앱 WebView 등) */
if(new URLSearchParams(location.search).get('back') === '1'){ HOST.historyGuard = true; navInit(); }
if(embHas('duel')) netStart(); else ROOM_STATE = 'none';   /* 대전을 켠 곳에서만 대전 서버에 연결 */
if(new URLSearchParams(location.search).get('sound') === '0') sndSetOn(false);
{ const bg = new URLSearchParams(location.search).get('big'); if(bg === '1' || bg === '0') bigSet(bg === '1'); }   /* 주소 옵션 big=1|0: 큰 글씨 */
embEmit('ready', { name:NG[EMB.id].name, modes:EMB.modes });
embMenu();
if(EMB.start !== 'menu' && embHas(EMB.start)) embStart(EMB.start);
