/* ===================== 이벤트 선물 (운영자 지급) =====================
   운영자가 정한 날에 접속한 사람에게 한 번 주는 선물. 받을 사람 확인은 이 브라우저 기록으로 한다
   (그날 접속하면 바로, 그날 들렀다가 나중에 다시 오면 그날의 흔적 — 오늘 기록·하트 충전 시각·친구 기록 — 으로).
   새 선물은 EVENT_GIFTS에 한 줄 더하면 된다. id는 바꾸지 않는다(한 사람에 한 번). */
const EVENT_GIFTS = [
  { id:'visit-20261004', day:'2026-10-04', until:'2026-10-11', hearts:100, title:'10월 4일 접속 선물', note:'10월 4일에 하루퍼즐에 들러 주셔서 고마워요!' },
];
const evDayOf = t => { try{ return t ? dayKey(new Date(t)) : ''; }catch(_){ return ''; } };
function evVisited(day){
  if(dayKey() === day) return true;
  if(store.get('hp:day:' + day, null)) return true;
  const vs = store.get('hp:visits', []); if(Array.isArray(vs) && vs.includes(day)) return true;
  const h = store.get('hp:hearts', null); if(h && evDayOf(h.t) === day) return true;
  const fc = store.get('hp:frcache', null); if(fc && evDayOf(fc.t) === day) return true;
  return false;
}
/* 앞으로를 위해 들른 날을 남겨 둔다(최근 60일) */
function evMarkVisit(){
  const k = dayKey(), vs = store.get('hp:visits', []);
  const L = Array.isArray(vs) ? vs : [];
  if(!L.includes(k)){ L.push(k); store.set('hp:visits', L.slice(-60)); }
}
function evPending(){
  const k = dayKey(), got = store.get('hp:events', {});
  return EVENT_GIFTS.filter(e => !got[e.id] && k >= e.day && k <= e.until && evVisited(e.day));
}
function evShow(e){
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">GIFT</p><div class="ttl">${e.title}</div>
    <div class="rewards"><div class="reward"><span class="ri">${HEART_G}</span><b>+${e.hearts}</b>하트</div></div>
    <p class="note">${e.note}<br>받은 하트는 가득(5개)을 넘겨서도 쌓여요.</p>
    <div class="mbtns one"><button class="b1" id="evGet">하트 ${e.hearts}개 받기</button></div>`);
  $('#modal').classList.add('celebrate'); fxConfetti(); sfx('fanfare');
  $('#evGet').onclick = () => {
    const got = store.get('hp:events', {}); if(got[e.id]){ closeModal(); return; }
    got[e.id] = Date.now(); store.set('hp:events', got);
    addHearts(e.hearts); sfx('heartGet'); fxPop($('#evGet'), 'heart');
    closeModal(); toast('하트 ' + e.hearts + '개를 받았어요'); renderHome();
    setTimeout(evCheck, 600);
  };
}
/* 다른 창(첫 안내·초대·주간 결과)이 떠 있으면 닫힐 때까지 기다렸다가 띄운다 */
function evCheck(){
  evMarkVisit();
  const p = evPending(); if(!p.length) return;
  let n = 0;
  const tryShow = () => {
    if(($('#veil') && $('#veil').classList.contains('on')) || (typeof G !== 'undefined' && G && !G.over)){ if(++n < 600) setTimeout(tryShow, 1000); return; }
    evShow(p[0]);
  };
  setTimeout(tryShow, 800);
}
