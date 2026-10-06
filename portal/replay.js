/* 사이트 전용: 판 보내기 · 받은 판 · 지난 7일 문제 다시 풀기 · 친구 기록 나란히 (WP3, 2026-10-06 세대별 테스트 · 결정 199)
   - 솔로 판은 씨앗이 'adv:게임:판번호'라 누구나 같은 판이 나온다 → 링크 ?p=<게임>.<판>&s=<내 기록 초>&st=<별>&n=<별명>
     받은 사람은 그 판을 "친구가 보낸 판"으로 풀고(솔로 진도·별·솔로 포인트에 안 들어감), 끝나면 "나 1:58 vs 판다 2:10".
   - 지난 문제: 오늘의 시험지 아래 "지난 7일 문제 다시 풀기" → 날짜 → 그날 게임(씨앗 'exam:날짜:게임', 하트 없음·기록 안 됨).
     보내기는 지금 도전장 링크(c·d·s·lv)에 그 날짜를 그대로 넣는다. 받는 쪽은 7일 안의 날짜면 그날 문제로 연다.
   - 엔진(core/engine.js)과의 약속: startGame(…, { replay:{ kind } }) → G.replay, 끝나면 HOST.replayFinish(win).
     판 고르기 창의 [친구에게 보내기] = HOST.sendStage(id, 판, { t, st }, back). 모듈(embed)에는 없음. */
const RP_DAYS = 7;
let RP_IN = null;
const rpInt = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || 0));
const rpT = t => t > 0 ? clock2(t).replace(/^0(?=\d:)/, '') : '–';
function rpPastKeys(){ const k0 = dayKey(), a = []; for(let i = 1; i <= RP_DAYS; i++) a.push(addDays(k0, -i)); return a; }
const rpPastOk = k => rpPastKeys().includes(k);
const rpWd = k => WD_KO[wdOf(k)];

/* ---- 링크 읽기: readLink(viral.js)가 주소를 지우기 전에 ?p=를 먼저 읽는다 ---- */
function rpParse(){
  let q; try{ q = new URLSearchParams(location.search); }catch(_){ return null; }
  const m = /^([a-z0-9_-]{1,20})\.(\d{1,4})$/.exec(q.get('p') || '');
  if(!m || !GAME_IDS.includes(m[1]) || !NG[m[1]].stage || NG[m[1]].age || NG[m[1]].noSend) return null;
  return { kind:'gift', g:m[1], n:Math.max(1, +m[2]), t:rpInt(q.get('s'), 0, 99999), st:rpInt(q.get('st'), 0, 3), from:cleanNick(q.get('n')) };
}
{
  const read0 = readLink, arrive0 = onArrive;
  readLink = function(){ RP_IN = rpParse(); const o = read0(); if(RP_IN && !o){ try{ history.replaceState(null, '', location.pathname + location.hash); }catch(_){} } return o; };
  onArrive = function(o){
    if(RP_IN){ const x = RP_IN; RP_IN = null;
      if(o && o.n && !(o.f && typeof frApi === 'function' && frApi())) linkFriendAdd(o.n);
      store.set('hp:welcome', Math.max(3, store.get('hp:welcome', 0))); renderHome(); rpShowGift(x); return true; }
    if(o && o.g && o.d && o.d !== dayKey() && rpPastOk(o.d) && !isAdult(o.g)){   /* 지난 문제 도전장 */
      if(o.n && !(o.f && typeof frApi === 'function' && frApi())) linkFriendAdd(o.n);
      store.set('hp:welcome', Math.max(3, store.get('hp:welcome', 0))); renderHome(); rpShowPastChal(o); return true; }
    return arrive0(o);
  };
}

/* ---- 판 보내기(판 고르기 창 · 받은 판 결과 창) ---- */
function cardStage(id, n, me){
  const rec = me && me.t ? rpT(me.t) : '', st = me && me.st ? ' · ' + '★'.repeat(me.st) : '';
  return { kind:'stage', title:'친구에게 판 보내기', head:GAMES[id].name + ' ' + n + '판', big:n, unit:'판', sub:(rec ? '내 기록 ' + rec : '솔로 ' + n + '판') + st,
    text:`🦊 하루퍼즐 ${GAMES[id].name} ${n}판${rec ? ', 나는 ' + rec + '에 풀었어요' : ''}.\n이 판 풀 수 있어?`, q:{ p:id + '.' + n, s:me && me.t || 0, st:me && me.st || 0 } };
}
HOST.sendStage = (id, n, me, back) => viralShare(cardStage(id, n, me), back);

function rpShowGift(x){
  const nm = escH(x.from || '친구'), name = GAMES[x.g].name;
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">친구가 보낸 판</p><div class="ttl rpttl">${nm}님이 보낸<br>${name} ${x.n}판</div>
    <span class="chal-art">${ART[x.g] ? ART[x.g]() : ''}</span>
    <p class="rprec">${nm} 기록 <b class="num">${rpT(x.t)}</b>${x.st ? ` <span class="stx">${'★'.repeat(x.st)}</span>` : ''}</p>
    <p class="rpnote">솔로 진도·별에는 안 들어가요</p>
    <div class="mbtns"><button class="b2" id="chLater">나중에</button><button class="b1" id="rpGo">풀어 보기</button></div>`);
  $('#modal').classList.add('celebrate'); sfx('fanfare');
  $('#chLater').onclick = () => { closeModal(); renderHome(); };
  $('#rpGo').onclick = () => { closeModal(); rpPlayGift(x); };
}
function rpPlayGift(x){ startGame(x.g, null, { adv:x.n, replay:{ kind:'gift', g:x.g, n:x.n, from:x.from, t:x.t, st:x.st } }); }

/* ---- 지난 7일 문제 ---- */
function rpPastBtn(){
  const g = $('#games'); if(!g) return;
  let b = $('#rpPast');
  if(!b){ b = document.createElement('button'); b.id = 'rpPast'; b.className = 'rppast'; b.type = 'button'; b.onclick = () => rpOpenPast(); }
  b.innerHTML = `지난 ${RP_DAYS}일 문제 다시 풀기 <span aria-hidden="true">▸</span>`;
  if(b.previousElementSibling !== g) g.after(b);
}
function rpOpenPast(k){
  const keys = rpPastKeys(); if(!keys.includes(k)) k = keys[0];
  const day = store.get('hp:day:' + k, null), set = todaySet(k).filter(g => GAME_IDS.includes(g) && !isAdult(g));
  const chips = keys.map(x => { const [, mm, dd] = x.split('-').map(Number); return `<button class="rpday${x === k ? ' on' : ''}" data-k="${x}" aria-pressed="${x === k}"><b>${mm}/${dd}</b><small>${rpWd(x)}</small></button>`; }).join('');
  const rows = set.map(g => { const sc = day && day.best ? day.best[g] : 0;
    return `<button class="rprow" data-g="${g}" style="--gc:${GCOL[g][1]}"><span class="rpi">${ic(g)}</span><span class="rpm"><b>${subjOf(g) ? `<span class="subj">${subjOf(g)}</span>` : ''}${GAMES[g].name}</b><small>${LV_KO[examLv(k)]} · ${sc ? '그날 내 점수 ' + fmt(sc) + '점' : '그날 안 풀었어요'}</small></span><em>다시 풀기<small>기록 안 됨</small></em></button>`; }).join('');
  openModal(`<h3>지난 ${RP_DAYS}일 문제</h3><p class="note">그날 모두가 푼 문제를 다시 풀어요 · 하트 없이 · 기록 안 됨</p>
    <div class="rpdays" role="group" aria-label="날짜 고르기">${chips}</div>
    <div class="rplist">${rows || '<p class="note">그날 문제가 없어요</p>'}</div>
    <div class="mbtns one"><button class="b2" id="mClose">닫기</button></div>`);
  $('#mClose').onclick = closeModal;
  document.querySelectorAll('#modal .rpday').forEach(b => b.onclick = () => rpOpenPast(b.dataset.k));
  document.querySelectorAll('#modal .rprow').forEach(b => b.onclick = () => { closeModal(); rpPlayPast(b.dataset.g, k); });
  const on = $('#modal .rpday.on'); if(on) try{ on.scrollIntoView({ inline:'center', block:'nearest' }); }catch(_){}
}
function rpPlayPast(g, k, chal){
  startGame(g, examLv(k), { seed:'exam:' + k + ':' + g, replay:{ kind:'past', g, d:k, chal:chal || null } });
  if(G && G.replay && G.replay.kind === 'past' && G.id === g){ const sm = $('#ptitle small'); if(sm) sm.textContent = `지난 문제 · ${mdTxt(k)} ${rpWd(k)} · ${LV_KO[examLv(k)]} · 기록 안 됨`; }
}
function rpShowPastChal(o){
  const n = escH(o.n || '친구'), name = GAMES[o.g].name;
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">CHALLENGE</p><div class="ttl">${n}님의 도전장</div>
    <span class="chal-art">${ART[o.g] ? ART[o.g]() : ''}</span>
    <p class="note">${mdTxt(o.d)} ${rpWd(o.d)}요일 <b>${name}</b> 문제에서 <b>${fmt(o.s)}점</b>을 받았어요.<br>그날 문제로 이길 수 있을까요?</p>
    <p class="rpnote">지난 문제라 하트 없이 · 기록 안 됨</p>
    <div class="mbtns"><button class="b2" id="chLater">나중에</button><button class="b1" id="chGo">도전하기 · 무료</button></div>`);
  $('#modal').classList.add('celebrate'); sfx('fanfare');
  $('#chLater').onclick = () => { closeModal(); renderHome(); };
  $('#chGo').onclick = () => { closeModal(); rpPlayPast(o.g, o.d, { n:o.n, s:o.s }); };
}

/* ---- 다시 풀기 판의 결과 창(기록·진도·하트 없음) ---- */
const rpVs = (meTxt, meWin, opN, opTxt, opWin) => `<div class="chal"><div class="vs"><div class="${meWin ? 'w' : ''}">나<b>${meTxt}</b></div><em>VS</em><div class="${opWin ? 'w' : ''}">${escH(opN)}<b>${opTxt}</b></div></div></div>`;
HOST.replayFinish = function(win){
  const R = G.replay, id = G.id;
  const dd = dayState(); if(!dd.att){ dd.att = true; saveDay(dd); }   /* 끝까지 한 판 = 출석(다른 판과 같음) */
  let html, B, score = 0;
  if(R.kind === 'gift'){
    const t = Math.round(elapsed()), st = win ? advStarCalc() : 0, from = R.from || '친구';
    const meWin = win && (!R.t || t < R.t), opWin = !!R.t && (!win || t > R.t);
    html = win ? `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${R.n}판 클리어!</h3>
        <div class="bigstars" aria-label="별 ${st}개">${[1,2,3].map(i => `<span class="s${i <= st ? '' : ' off'}" style="animation-delay:${(0.1 + i * 0.22).toFixed(2)}s">${STAR_G}</span>`).join('')}</div>`
      : `<h3 class="bad">${resFace('sad')}아쉬워요!</h3><p class="lose">${GAMES[id].name} ${R.n}판</p><p class="note">${lossProgress()}</p>`;
    html += rpVs(win ? rpT(t) : '못 깸', meWin, from, rpT(R.t), opWin)
      + `<p class="note">${win ? (meWin ? '내가 더 빨랐어요! 이번엔 내 기록으로 보내 봐요.' : opWin ? `${escH(from)}님이 ${rpT(t - R.t)} 더 빨랐어요.` : '똑같은 기록이에요!') : '몇 번이든 다시 할 수 있어요.'}<br>친구가 보낸 판이라 솔로 진도·별에는 안 들어가요.</p>`;
    B = { pri:{ id:'mPri', label:win ? '다시 풀기' : '다시 도전', sub:`${GAMES[id].name} ${R.n}판 · 무료`, fn:() => rpPlayGift(R) },
      pair:[ win ? { id:'rpSend', label:`${ic('share')} 내 기록 보내기`, cls:'gold', keep:true, fn:() => HOST.sendStage(id, R.n, { t, st }, reopen) } : null ],
      links:[ { id:'rpSolo', label:`${ic('map')}내 솔로 하기`, fn:() => { goHome(); setTab('adv'); } }, { id:'mGh', label:'홈으로', fn:goHome } ] };
  } else {
    const k = R.d, ch = R.chal;
    if(win){ score = calcScore().score; }
    html = (win ? `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${NG[id].winTitle || '클리어!'}</h3><div class="big" id="bigScore">${fmt(score)}</div>`
      : `<h3 class="bad">${resFace('sad')}${NG[id].loseTitle || '이번 판은 실패'}</h3><p class="note">${lossProgress()}</p>`)
      + `<p class="note">지난 문제 · ${mdTxt(k)} ${rpWd(k)}요일 · 기록 안 돼요</p>`
      + (ch && ch.s ? rpVs(win ? fmt(score) : '실패', score > ch.s, ch.n, fmt(ch.s), score < ch.s) : '');
    const myDay = store.get('hp:day:' + k, null), mine = myDay && myDay.best ? myDay.best[id] : 0;
    if(mine) html += `<p class="note">그날 내 공식 점수 <b>${fmt(mine)}점</b>은 그대로예요</p>`;
    const lv = examLv(k);
    B = { pri:{ id:'mPri', label:'다른 날 문제', sub:`지난 ${RP_DAYS}일`, fn:() => { goHome(); rpOpenPast(k); } },
      pair:[ { id:'mSec', label:'다시 풀기', cls:'b2', fn:() => rpPlayPast(id, k, ch) },
        win && score > 0 ? { id:'mChal', label:`${ic('duel')} 친구에게 보내기`, cls:'gold', keep:true, fn:() => { const c = cardChal(id, score, lv); c.q.d = k; c.sub = mdTxt(k) + ' 문제 · 같은 문제로 나를 이겨 봐!'; c.text = `🦊 하루퍼즐 ${mdTxt(k)} ${GAMES[id].name} 문제, 나는 ${fmt(score)}점!\n같은 문제로 나를 이길 수 있을까요?`; viralShare(c, reopen); } } : null ],
      links:[ { id:'mGh', label:'홈으로', fn:goHome } ] };
  }
  html += resBtns(B);
  function reopen(){ openModal(html); resBind(B); }
  setTimeout(() => { reopen(); if(win){ if(!NG[id].noConfetti) fxConfetti(); sfx('result'); } else sfx('lose'); }, win ? 500 : 250);
};

/* ---- 오늘의 문제 결과 창: 친구 기록 나란히 "친구 중 2등 · 토끼 1,240점 · 나 1,100점"(진짜 친구가 없으면 줄 없음) ---- */
function rpFriendLine(id, mine){
  try{
    const fr = typeof frBoardFriends === 'function' ? frBoardFriends() : null; if(!fr || !mine) return '';
    const L = fr.map(f => ({ n:f.name, s:f.detail && f.detail.g ? +f.detail.g[id] || 0 : 0 })).filter(x => x.s > 0); if(!L.length) return '';
    const all = L.concat([{ n:'나', s:mine, me:true }]).sort((a, b) => b.s - a.s), pos = all.findIndex(x => x.me) + 1;
    const rival = pos === 1 ? all[1] : all[pos - 2];
    return `<p class="rpfr">친구 중 <b>${pos}등</b> · ${escH(rival.n)} ${fmt(rival.s)}점 · 나 ${fmt(mine)}점</p>`;
  }catch(_){ return ''; }
}
