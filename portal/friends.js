/* ===================== 친구 v1 (2026-10-03) =====================
   진짜 친구: 친구 서버(server/friends.ts, Railway 함수 "friends")에 기기마다 계정(pid + 비밀 열쇠)과 6자리 친구 코드를 만든다.
   · 친구 맺기: 초대 링크(?f=코드)로 들어오거나, 친구 코드를 입력하면 서로 친구가 된다.
   · 친구 끊기: 친구 관리에서 삭제(양쪽 모두에서 지워짐).
   · 보내기: 하트(하루 1번) · "같이 하자"(오늘의 시험지로 부르기) · 도전장(내 공식 점수로 같은 문제 도전).
   · 친구 리그: 진짜 친구가 한 명이라도 있으면 진짜 친구만, 없으면 예시 친구를 보여 주고 초대를 권한다.
   · 서버가 없거나 연결이 안 되면 조용히 예시 친구로 돌아간다(게임·대전은 영향 없음). */
const FR_API_DEFAULT = 'https://function-bun-production-da45.up.railway.app/api/';   /* 친구 서버 주소(예: https://friends-production-xxxx.up.railway.app/api/) — 배포 뒤 채움 */
const FR = { acct:null, friends:[], inbox:[], online:false, busy:false, lastSync:'', err:'' };
function frApi(){
  try{ const q = new URLSearchParams(location.search).get('frapi'); if(q) store.set('hp:frapi', q); }catch(_){}
  const v = store.get('hp:frapi', '') || (typeof window !== 'undefined' && window.HARU_FRIENDS_API) || FR_API_DEFAULT;
  return v ? (v.endsWith('/') ? v : v + '/') : '';
}
async function frCall(name, body){
  const api = frApi(); if(!api) throw new Error('no server');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try{
    const r = await fetch(api + name, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body || {}), signal:ctl.signal });
    const j = await r.json().catch(() => ({}));
    if(!r.ok){ const e = new Error(j.error || ('http ' + r.status)); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
const frAuth = () => FR.acct ? { pid:FR.acct.pid, secret:FR.acct.secret } : null;
function frLoad(){
  FR.acct = store.get('hp:fracct', null);
  const c = store.get('hp:frcache', null);
  if(c && FR.acct){ FR.friends = c.friends || []; FR.inbox = c.inbox || []; }
}
async function frEnsure(){
  if(FR.acct) return FR.acct;
  const r = await frCall('register', { nick:myNick() });
  FR.acct = { pid:r.pid, secret:r.secret, code:r.code, nick:r.nick }; store.set('hp:fracct', FR.acct);
  return FR.acct;
}
const frReal = () => FR.friends.length > 0;
const frCode = () => FR.acct ? FR.acct.code : '';
function frSig(){ return FR.friends.map(f => f.fid + ':' + f.score + ':' + f.streak).join(',') + '|' + FR.inbox.length + '|' + (FR.online ? 1 : 0); }

/* 서버에서 친구·알림함 새로 받기 */
async function frRefresh(quiet){
  if(!frApi() || FR.busy) return;
  FR.busy = true;
  try{
    await frEnsure();
    const r = await frCall('me', { ...frAuth(), day:dayKey(), nick:myNick() });
    const before = new Set(FR.inbox.map(m => m.id));
    FR.friends = r.friends || []; FR.inbox = r.inbox || []; FR.online = true; FR.err = '';
    if(r.me && r.me.code && FR.acct.code !== r.me.code){ FR.acct.code = r.me.code; store.set('hp:fracct', FR.acct); }
    store.set('hp:frcache', { t:Date.now(), friends:FR.friends, inbox:FR.inbox });
    const fresh = FR.inbox.filter(m => !before.has(m.id));
    if(!quiet && fresh.length){ const m = fresh[fresh.length - 1]; toast(frMsgText(m).replace(/<[^>]+>/g, '')); }
  }catch(e){
    FR.online = false; FR.err = e && e.message || 'offline';
    if(e && e.status === 401){ store.set('hp:fracct', null); FR.acct = null; }   /* 계정이 서버에서 사라졌으면 새로 만든다 */
  }finally{ FR.busy = false; }
  frSyncScore();
  const sig = frSig(); if(sig === FR.shown) return; FR.shown = sig;
  if(typeof renderHome === 'function' && $('#home') && $('#home').style.display !== 'none' && !$('#veil').classList.contains('on')) renderHome();
}
/* 내 오늘 점수 올리기(점수가 바뀌었을 때만) */
let frSyncT = 0;
function frSyncScore(){
  if(!FR.acct || !frApi()) return;
  const d = dayState(), tl = myTL(), g = {}, gr = {};
  for(const id of d.set){ if(d.tries[id]) g[id] = d.best[id] || 0; gr[subjOf(id)] = gradeOf(examTop(id, d.best[id])); }
  const body = { day:dayKey(), total:tl.score, streak:tl.streak, detail:{ g, gr } };
  const sig = JSON.stringify(body); if(sig === FR.lastSync) return;
  clearTimeout(frSyncT);
  frSyncT = setTimeout(async () => { try{ await frCall('score', { ...frAuth(), ...body }); FR.lastSync = sig; }catch(_){} }, 1200);
}

/* 친구 리그에 넣을 목록: 진짜 친구가 있으면 진짜만 */
function frBoardFriends(){
  if(!frReal()) return null;
  return FR.friends.map(f => ({ name:f.nick, fid:f.fid, code:f.code, real:true, detail:f.detail, streak:f.streak, att:!!f.played, pct:0, score:f.score || 0,
    tl:{ streak:f.streak, today:{ st:f.played ? 'att' : 'today', pct:0 }, score:f.score || 0 } }));
}
const pAvatar = x => x.fid ? rivalAv({ name:x.fid }) : avatar(x);

/* 친구 맺기·끊기·보내기 */
async function frAdd(code, quiet){
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(code.length !== 6){ toast('친구 코드는 6자리예요'); return false; }
  if(!frApi()){ toast('친구 서버를 준비하고 있어요. 조금만 기다려 주세요'); return false; }
  try{
    await frEnsure();
    if(code === FR.acct.code){ toast('내 코드예요. 친구의 코드를 넣어 주세요'); return false; }
    const r = await frCall('add', { ...frAuth(), code });
    if(!quiet) toast(r.already ? r.friend.nick + '님과 이미 친구예요' : r.friend.nick + '님과 친구가 됐어요!');
    if(!r.already){ sfx('fanfare'); }
    await frRefresh(true); return r.friend;
  }catch(e){ toast(e.status === 404 ? '그런 친구 코드가 없어요' : e.status === 409 ? '친구가 너무 많아요(최대 200명)' : '연결이 안 돼요. 잠시 뒤 다시 해 주세요'); return false; }
}
function frRemove(f){
  openModal(`<h3>친구 삭제</h3><p class="note"><b>${escH(f.name || f.nick)}</b>님을 친구에서 뺄까요?<br>서로의 친구 목록에서 모두 사라져요. 다시 친구가 되려면 코드를 넣으면 돼요.</p>
    <div class="mbtns"><button class="b2" id="frNo">취소</button><button class="b1" id="frYes">삭제하기</button></div>`);
  $('#frNo').onclick = () => frManage();
  $('#frYes').onclick = async () => {
    try{ await frCall('remove', { ...frAuth(), fid:f.fid }); FR.friends = FR.friends.filter(x => x.fid !== f.fid); toast((f.name || f.nick) + '님을 친구에서 뺐어요'); }
    catch(_){ toast('연결이 안 돼요. 잠시 뒤 다시 해 주세요'); }
    frManage(); frRefresh(true);
  };
}
async function frSend(f, kind, data){
  try{ await frCall('send', { ...frAuth(), fid:f.fid, kind, data:data || {} }); return true; }
  catch(e){ toast(e.status === 409 ? '오늘은 이미 하트를 보냈어요' : e.status === 429 ? '잠깐 쉬었다 보내 주세요' : '연결이 안 돼요. 잠시 뒤 다시 해 주세요'); return false; }
}
function frSendHeart(f, btn){
  const d = dayState(); if(d.sent[f.fid || f.name]) return;
  const done = () => { if(btn) fxPop(btn, 'heart'); sfx('heartSend'); fxBuzz(15); const dd = dayState(); dd.sent[f.fid || f.name] = true; saveDay(dd); toast((f.name || f.nick) + '님에게 하트를 보냈어요'); renderHome(); };
  if(!f.fid){ done(); return; }
  frSend(f, 'heart', { day:dayKey() }).then(ok => { if(ok) done(); });
}
/* 같이 하자: 친구가 아직 안 푼 오늘 과목을 골라 부른다 */
function frInvitePlay(f){
  const d = dayState(), mine = d.set.find(g => !d.tries[g]) || d.set[0];
  frSend(f, 'play', { day:dayKey(), g:mine }).then(ok => { if(ok){ sfx('heartSend'); toast((f.name || f.nick) + '님에게 "같이 하자"를 보냈어요'); } });
}
/* 도전장: 내가 공식 기록을 낸 과목 중 가장 잘한 것 */
function frChallenge(f){
  const d = dayState(), done = d.set.filter(g => d.tries[g] && d.best[g] > 0).sort((a, b) => d.best[b] - d.best[a]);
  if(!done.length){ toast('오늘의 시험지를 한 과목이라도 풀면 도전장을 보낼 수 있어요'); return; }
  openModal(`<h3>${escH(f.name || f.nick)}님에게 도전장</h3><p class="note">같은 문제로 붙어요. 친구가 열면 바로 그 게임이 시작돼요.</p>
    <div class="frpick">${done.map(g => `<button class="btn secondary block" data-g="${g}"><span class="subj">${subjOf(g)}</span>${GAMES[g].name} · <b>${fmt(d.best[g])}점</b></button>`).join('')}</div>
    <div class="mbtns one"><button class="b2" id="frBack">뒤로</button></div>`);
  $('#frBack').onclick = () => frFriendSheet(f);
  document.querySelectorAll('.frpick [data-g]').forEach(b => b.onclick = async () => {
    const g = b.dataset.g;
    if(await frSend(f, 'challenge', { g, s:d.best[g], d:dayKey(), lv:examLv() })){ sfx('fanfare'); toast(GAMES[g].name + ' 도전장을 보냈어요'); closeModal(); }
  });
}

/* 친구 한 명 자세히 */
function frFriendSheet(x){
  const f = FR.friends.find(q => q.fid === x.fid) || x, d = dayState(), name = escH(f.nick || f.name);
  const gr = f.detail && f.detail.gr ? Object.entries(f.detail.gr).map(([s, v]) => `<span class="frg" style="--gcol:${GRADE_COL[v] || '#DDD3C0'}"><i>${s}</i>${v}</span>`).join('') : '';
  const sent = !!d.sent[f.fid];
  openModal(`<div class="frhead">${rivalAv({ name:f.fid })}<div><b>${name}</b><small>${(() => { const st = frStatus(f); return st.txt ? `<span class="frst${st.on ? ' on' : ''}">${st.on ? '<i class="ondot"></i>' : ''}${escH(st.txt)}</span><br>` : ''; })()}친구 코드 ${f.code || ''}${f.streak ? ` · ${ic('flame')}연속 ${f.streak}일` : ''}</small></div></div>
    <div class="frscore"><span>오늘 점수</span><b class="num">${fmt(f.score || 0)}점</b></div>
    ${gr ? `<div class="frgrades">${gr}</div>` : `<p class="note">${f.played ? '' : '아직 오늘의 시험지를 안 풀었어요'}</p>`}
    <div class="frbtns">
      <button class="btn primary" id="frPlay">${ic('duel')} 같이 하기</button>
      <button class="btn gold" id="frChal">${ic('trophy')} 도전장</button>
      <button class="btn secondary" id="frHeart" ${sent ? 'disabled' : ''}>${ic(sent ? 'check' : 'heart')} ${sent ? '하트 보냄' : '하트'}</button>
    </div>
    <div class="mbtns"><button class="b2" id="frDel">친구 삭제</button><button class="b1" id="frOk">친구 목록</button></div>`);
  $('#frOk').onclick = frHub;
  $('#frDel').onclick = () => frRemove(f);
  $('#frPlay').onclick = () => frTogether(f);
  $('#frChal').onclick = () => frChallenge(f);
  $('#frHeart').onclick = () => { frSendHeart(f, $('#frHeart')); closeModal(); };
}

/* 친구 관리: 내 코드 · 초대 · 코드로 추가 · 목록(삭제) */
function frManage(){
  const api = !!frApi();
  const list = FR.friends.map(f => `<div class="frrow">${rivalAv({ name:f.fid })}<span class="frn"><b>${escH(f.nick)}</b><small>${f.code} · 오늘 ${fmt(f.score || 0)}점</small></span>
      <button class="frx" data-open="${f.fid}" aria-label="${escH(f.nick)}님 자세히">${ic('chev')}</button><button class="frx del" data-del="${f.fid}" aria-label="${escH(f.nick)}님 삭제">✕</button></div>`).join('');
  openModal(`<h3>친구</h3>
    <div class="frcode"><small>내 친구 코드</small><b class="num" id="frMy">${frCode() || (api ? '만드는 중…' : '준비 중')}</b><button class="btn small secondary" id="frCopy" ${frCode() ? '' : 'disabled'}>복사</button></div>
    <button class="btn gold block" id="frInv">${ic('share')} 친구 초대하기 · 카톡으로 보내기</button>
    <div class="fradd"><input id="frIn" maxlength="6" placeholder="친구 코드 6자리" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="친구 코드"><button class="btn small primary" id="frGo">추가</button></div>
    ${!api ? '<p class="note">친구 서버를 준비하고 있어요. 지금은 예시 친구로 보여 줘요.</p>' : !FR.online && FR.err ? '<p class="note">지금 친구 서버에 연결이 안 돼요. 잠시 뒤 자동으로 다시 시도해요.</p>' : ''}
    <div class="frlist">${list || '<p class="note">아직 친구가 없어요. 초대 링크를 보내거나 친구 코드를 넣어 보세요.<br>링크로 들어온 친구와는 바로 친구가 돼요.</p>'}</div>
    <div class="mbtns one"><button class="b2" id="frClose">친구 목록으로</button></div>`);
  $('#frClose').onclick = frHub;
  $('#frCopy').onclick = async () => { try{ await navigator.clipboard.writeText(frCode()); toast('친구 코드를 복사했어요'); }catch(_){ toast('코드: ' + frCode()); } };
  $('#frInv').onclick = () => viralShare(cardInvite(), frManage);
  const go = async () => { const v = $('#frIn').value; $('#frGo').disabled = true; const ok = await frAdd(v); if(ok) frManage(); else { const b = $('#frGo'); if(b) b.disabled = false; } };
  $('#frGo').onclick = go; $('#frIn').onkeydown = e => { if(e.key === 'Enter') go(); };
  $('#frIn').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => frFriendSheet({ fid:b.dataset.open }));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const f = FR.friends.find(q => q.fid === b.dataset.del); if(f) frRemove(f); });
  if(api && !FR.acct) frEnsure().then(() => { const el = $('#frMy'); if(el){ el.textContent = frCode(); const c = $('#frCopy'); if(c) c.disabled = false; } }).catch(() => {});
}

/* 알림함 문구 */
function frMsgText(m){
  const n = '<b>' + escH(m.nick) + '</b>님';
  if(m.kind === 'friend') return n + '과 친구가 됐어요';
  if(m.kind === 'heart') return n + '이 하트를 보냈어요';
  if(m.kind === 'play' && m.data && m.data.room){ const g = GAMES[m.data.g]; return n + '이 대전 방으로 불렀어요' + (g ? ' · ' + g.name + ' ' + (RM_DNAME[m.data.d] || '') : ''); }
  if(m.kind === 'play'){ const g = m.data && GAMES[m.data.g]; return n + '이 같이 하재요' + (g ? ' · ' + GAMES[m.data.g].name : ''); }
  if(m.kind === 'challenge'){ const g = m.data && GAMES[m.data.g]; return n + '의 도전장' + (g ? ' · ' + GAMES[m.data.g].name + ' ' + fmt(m.data.s || 0) + '점' : ''); }
  return n + '의 알림';
}
const frInboxCount = () => FR.inbox.length;
async function frAck(ids){ FR.inbox = FR.inbox.filter(m => !ids.includes(m.id)); store.set('hp:frcache', { t:Date.now(), friends:FR.friends, inbox:FR.inbox }); try{ await frCall('ack', { ...frAuth(), ids }); }catch(_){} }
function frInboxHtml(){
  if(!FR.inbox.length) return '';
  return FR.inbox.slice().reverse().map(m => {
    const act = m.kind === 'heart' ? `<button class="btn small gold" data-act="${m.id}">${ic('heart')} 받기</button>` : m.kind === 'play' ? `<button class="btn small primary" data-act="${m.id}">${m.data && m.data.room ? '들어가기' : '지금 하기'}</button>` : m.kind === 'challenge' ? `<button class="btn small primary" data-act="${m.id}">도전하기</button>` : `<button class="btn small secondary" data-act="${m.id}">확인</button>`;
    return `<div class="gift fr">${rivalAv({ name:m.from })}<span>${frMsgText(m)}</span>${act}</div>`;
  }).join('');
}
function frInboxBind(reopen){
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const m = FR.inbox.find(q => q.id === +b.dataset.act); if(!m) return;
    frAck([m.id]);
    if(m.kind === 'heart'){ fxPop(b, 'heart'); sfx('heartGet'); addHearts(1); toast(m.nick + '님의 하트 +1'); reopen(); renderHome(); return; }
    if(m.kind === 'play' && m.data && m.data.room){ closeModal(); rmJoin(m.data.room, { invited:true }); return; }
    if(m.kind === 'play'){ closeModal(); const g = m.data && GAME_IDS.includes(m.data.g) && dayState().set.includes(m.data.g) ? m.data.g : pickNext(); quickStart(g); return; }
    if(m.kind === 'challenge' && m.data && GAME_IDS.includes(m.data.g)){ closeModal(); showChallenge({ n:m.nick, g:m.data.g, d:m.data.d || '', s:+m.data.s || 0, lv:m.data.lv || examLv() }); return; }
    reopen();
  });
}

/* 시작: 저장된 친구를 먼저 보여 주고, 서버에서 새로 받기. 45초마다·화면으로 돌아올 때 다시 */
function frStart(pendingCode){
  frLoad();
  if(!frApi()) return;
  (async () => {
    await frRefresh(true);
    if(pendingCode){ const f = await frAdd(pendingCode, true); if(f){ toast(f.nick + '님과 친구가 됐어요! 친구 리그에서 점수를 겨뤄요'); sfx('fanfare'); } }
  })();
  setInterval(() => { if(document.visibilityState === 'visible' && !(G && !G.over)) frRefresh(); }, 45000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') frRefresh(); });
}
