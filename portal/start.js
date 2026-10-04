/* 시작: 모든 파일을 불러온 뒤 홈 화면을 띄움 (맨 마지막에 불러와야 함) */
netStart();   /* 대전 서버 연결 */
linkFriendsLoad();
const ARRIVE = readLink();
frStart(ARRIVE && ARRIVE.f);   /* 친구 v1: 저장된 친구 → 서버에서 새로 받기, 초대 링크면 친구 맺기 */
renderHome(); lastSig = homeSig(); checkOvertake();
const LG_RES = leagueRollover();
if(onArrive(ARRIVE)){}
else if(store.get('hp:welcome', 0) < 3) welcome();
else if(LG_RES) showLeagueResult(LG_RES);
else { const ls0 = leagueState(); if(ls0.last && ls0.seen === false) showLeagueResult(ls0.last); }

evCheck();   /* 운영자 이벤트 선물(portal/events.js) */
rmStart();   /* 대전 방 · 친구 접속(portal/rooms.js) */
setInterval(tickHome, 1000);
try{ sceneHome({ kind:'stars', colors:['#FFFFFF','#FFE9A8','#CFC5FF'], density:.7 }); }catch(_){}   /* 홈 밤하늘: 반짝이는 별·별똥별 */
