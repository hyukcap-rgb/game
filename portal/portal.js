/* 하루퍼즐 리그 사이트: 오늘의 시험지·하트·리그·친구·솔로 레벨·대전 목록·내 정보 (게임 자체는 games/, 공용 플레이 엔진은 core/) */
registerGames(['fox','sudoku','ball','fleet','match','nono','block','memory','merge','link','gostop','crossword','hidden','spot','chosung','wordchain','mines','omok','parking','snowball','flag','mole','twin','arrow','rps','thread']);   /* 사이트에 보일 게임과 순서 */
const ADULT = ['gostop'];   /* 성인(19) 게임: 솔로·대전 목록 맨 끝 "성인(19)" 묶음으로, 과목 칩 필터에서는 빠짐(게임 정의에 adult:true를 써도 됨) */
const isAdult = id => !!(NG[id] && NG[id].adult) || ADULT.includes(id);
/* ===== 가상 숫자 스위치 (2026-10-04 UI 검수 결론) =====
   서버 집계가 붙기 전까지: 기부액·참가자 수는 숨기고, 상위 %는 정수 + '예상', 예시 친구는 하트를 보내지 않고 추월 알림도 안 보낸다.
   진짜 데이터가 오면 DEMO_NUMBERS = false 한 줄만 바꾸면 예전 표시로 돌아간다. */
const DEMO_NUMBERS = true;
/* 테스트 도구는 주소에 ?dev=1 이 있을 때만 */
const DEV_TOOLS = /[?&]dev=1(&|$)/.test(location.search);
const MAX_H = 5, REGEN_MS = 10*60*1000, AD_LIMIT = 5;
const FRIENDS = [
  { name:'민지', av:'🐰' }, { name:'준호', av:'🐻' }, { name:'서연', av:'🐱' },
  { name:'도윤', av:'🐶' }, { name:'하은', av:'🐼' }, { name:'지훈', av:'🐯' }
];
const REG_COLORS = ['#FFC9D6','#FFE594','#BDEFD9','#C4DBFF','#DFCBFF','#FFD0A6','#D2F2A0','#9FE3EE'];

function dayState(){
  const k = 'hp:day:' + dayKey();
  const d = store.get(k, null) || { best:{}, tries:{}, sent:{}, claimed:[], ads:0 };
  const z = () => Object.fromEntries(GAME_IDS.map(g => [g, 0]));
  d.best = Object.assign(z(), d.best); d.tries = Object.assign(z(), d.tries);
  d.solo = d.solo || 0; d.duel = d.duel || 0; d.dw = d.dw || 0; d.dd = d.dd || 0; d.dl = d.dl || 0;
  if(!d.set) d.set = todaySet();
  /* 오늘 시험지에 사이트에서 못 푸는 게임(은퇴한 숲 지킴이 등)이 있으면 그날 과목만 다시 뽑는다. 이미 푼 다른 과목 기록(best·tries)은 그대로 */
  else if(d.set.some(g => !examReady(g))){ d.set = todaySet(); saveDay(d); }
  return d;
}
function saveDay(d){ store.set('hp:day:' + dayKey(), d); }

function heartState(){
  const h = store.get('hp:hearts', { n:MAX_H, t:Date.now() });
  if(h.n < MAX_H){
    const gained = Math.floor((Date.now() - h.t) / REGEN_MS);
    if(gained > 0){ h.n = Math.min(MAX_H, h.n + gained); h.t += gained * REGEN_MS; }
  }
  if(h.n >= MAX_H) h.t = Date.now();
  store.set('hp:hearts', h);
  return h;
}
function addHearts(k){ const h = heartState(); const wasFull = h.n >= MAX_H; h.n += k; if(h.n < MAX_H && wasFull) h.t = Date.now(); store.set('hp:hearts', h); }
function spendHeart(){
  const h = heartState(); if(h.n < 1) return false;
  const wasFull = h.n >= MAX_H; h.n -= 1; if(wasFull && h.n < MAX_H) h.t = Date.now();
  store.set('hp:hearts', h); return true;
}

function friendScore(f){
  const rng = mulberry(seedFrom(dayKey() + f.name));
  const full = Math.round((1300 + rng()*2600) / 10) * 10;
  const start = 7 + rng()*9, span = 3 + rng()*6;
  const now = new Date(); const h = now.getHours() + now.getMinutes()/60;
  const p = Math.max(0, Math.min(1, (h - start) / span));
  return Math.round(full * (p === 0 ? 0 : 0.45 + 0.55*p) / 10) * 10;
}
function giftsToday(){
  if(DEMO_NUMBERS || (typeof frReal === 'function' && frReal())) return [];   /* 예시 친구는 하트를 보내지 않음 */
  const rng = mulberry(seedFrom('gift' + dayKey()));
  return shuffle(FRIENDS.map(f=>f.name), rng).slice(0, 2 + Math.floor(rng()*2));
}
function dailySum(d){ return (d.set || todaySet()).reduce((a, g) => a + (d.best[g] || 0), 0); }
function myTotal(d){ return dailySum(d); }   /* v9: 오늘 점수 = 시험지 5과목 공식 점수 합 */

/* ===== 점수·리그 v5 (마케팅팀 설계) =====
   (v6) 오늘 점수 = (10게임 중 날짜별 5게임 오늘 최고점 합 + 솔로 점수 + 대전 점수) × (1 + 끈기 보너스). 끈기 보너스 = 연속 출석 하루당 +1%, 최대 +10%
   출석 = 한 판을 끝까지(성공·실패 무관, 그만하기 제외). 휴식권 월 2장: 빠진 날 자동 사용, 연속 유지(그날 점수 0)
   주간 리그 = 월~일 매일 '오늘 점수'의 합. 실력 비슷한 30명, 일요일 21:00(현지) 마감, 상위 5명 승급·하위 5명 강등
   글로벌: 모든 날짜·마감은 현지 시간 기준, 문제는 날짜별로 전 세계 동일, 주간 리그는 같은 시간대 권역끼리 */
const REST_PER_MONTH = 2, BONUS_MAX = 0;   /* v9: 출석 보너스는 점수에서 뺌(선물·휴식권만) */
const BTYPE = {
  fox:['논리형 두뇌','규칙 사이의 빈틈을 정확히 찾아내요'],
  sudoku:['집중형 두뇌','긴 문제도 끝까지 흐트러지지 않아요'],
  ball:['공간형 두뇌','각도와 궤적을 머릿속으로 그려내요'],
  merge:['전략형 두뇌','한 수 앞을 내다보고 자원을 배분해요'],   /* 전략력 대표 게임: 숲 지킴이 삭제(결정 220) 뒤 숫자 합치기 */
  fleet:['추리형 두뇌','작은 단서로 숨은 답을 좁혀가요']
};
function addDays(k, n){ const [y, m, d] = k.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); }
const bonusPct = streak => Math.min(BONUS_MAX, Math.max(0, streak));
function myDay(k){
  const d = store.get('hp:day:' + k, null); if(!d || !d.best) return { att:false, total:0, best:{} };
  /* d.set이 없는 옛 기록은 게임 5개 합(예전 규칙), 새 기록은 그날의 5게임 + 솔로 + 대전 */
  const total = d.set ? d.set.reduce((a, g) => a + (d.best[g] || 0), 0) : Object.values(d.best).reduce((a, b) => a + (b || 0), 0);
  return { att: !!d.att || total > 0, total, best:d.best };
}
function friendDay(f){
  const p = 0.55 + mulberry(seedFrom('p:' + f.name))() * 0.43, today = dayKey();
  return k => {
    if(k === today){ const sc = friendScore(f); return { att: sc > 0, total: sc }; }
    const r = mulberry(seedFrom('att:' + k + f.name)); const att = r() < p;
    return { att, total: att ? Math.round((1300 + r() * 2600) / 10) * 10 : 0 };
  };
}
/* 최근 120일을 앞에서부터 훑어 연속·휴식권·하루 점수를 계산 */
function timeline(getDay){
  const today = dayKey(), days = [], restUsed = {};
  let streak = 0, best = 0;
  for(let i = 119; i >= 0; i--){
    const k = addDays(today, -i), info = getDay(k), mo = k.slice(0, 7);
    let st, base = 0, pct = 0, final = 0;
    if(info.att){ streak++; st = 'att'; base = info.total; pct = bonusPct(streak); final = Math.round(base * (1 + pct / 100)); }
    else if(k === today){ st = 'today'; }
    else if(streak > 0 && (restUsed[mo] || 0) < REST_PER_MONTH){ restUsed[mo] = (restUsed[mo] || 0) + 1; st = 'rest'; }
    else { streak = 0; st = 'miss'; }
    best = Math.max(best, streak);
    days.push({ k, st, base, pct, final, streak });
  }
  const t = days[days.length - 1], mo = today.slice(0, 7);
  const month = days.filter(x => x.k.slice(0, 7) === mo);
  return { days, streak, best, today:t, score:t.final, bq:t.final, restLeft: REST_PER_MONTH - (restUsed[mo] || 0), month, mAtt: month.filter(x => x.st === 'att').length };
}
const myTL = () => timeline(myDay);
let RANK_MODE = 'day';

/* ---- 주간 리그 ---- */
function weekStartKey(k = dayKey()){ const [y, m, d] = k.split('-').map(Number), dt = new Date(y, m - 1, d); return dayKey(new Date(y, m - 1, d - (dt.getDay() + 6) % 7)); }
function weekDeadline(wk = weekStartKey()){ const [y, m, d] = wk.split('-').map(Number); return new Date(y, m - 1, d + 6, 21, 0, 0); }
function weekLeft(){ const s = Math.max(0, Math.floor((weekDeadline().getTime() - Date.now()) / 1000)), dd = Math.floor(s / 86400); return (dd ? dd + '일 ' : '') + String(Math.floor(s % 86400 / 3600)).padStart(2,'0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0'); }
function weekSum(tl, wk){ const end = addDays(wk, 6); return tl.days.filter(x => x.k >= wk && x.k <= end).reduce((a, x) => a + x.final, 0); }
const TIERS = [['브론즈','#D9772E','#FFC39A'],['실버','#8FA3B8','#EEF3F8'],['골드','#F0A000','#FFEA8E'],['다이아','#3BB8F5','#DDF6FF']];
const REGION = '한국·일본 권역';
const LG_A = ['하늘','바다','별빛','초록','달빛','새벽','노을','구름','은하','바람','단풍','봄날','여름밤','솔잎','눈꽃'];
const LG_B = ['고양이','사자','펭귄','부엉이','수달','판다','토끼','여우','곰','거북','고래','다람쥐','참새','사슴','돌고래'];
function leagueState(){ return store.get('hp:league', null) || { tier:0, week:weekStartKey() }; }
function leagueRivals(wk, tier){
  const r = mulberry(seedFrom('lg:' + wk + ':' + tier)), used = new Set(), out = [];
  while(out.length < 29){
    const n = LG_A[Math.floor(r() * LG_A.length)] + LG_B[Math.floor(r() * LG_B.length)];
    if(used.has(n)) continue; used.add(n);
    out.push({ name:n, skill:(1700 + tier * 600) * (0.72 + r() * 0.56), p:0.5 + r() * 0.48 });
  }
  return out;
}
function rivalDay(o, k){
  const today = dayKey(); if(k > today) return 0;
  const r = mulberry(seedFrom('rd:' + k + o.name)); if(r() > o.p) return 0;
  let v = o.skill * (0.7 + r() * 0.6);
  if(k === today){ const st = 7 + r() * 12, sp = 2 + r() * 5, n = new Date(), h = n.getHours() + n.getMinutes() / 60, q = Math.max(0, Math.min(1, (h - st) / sp)); v = q ? v * (0.45 + 0.55 * q) : 0; }
  return Math.round(v * 1.05 / 10) * 10;
}
function leagueBoard(wk = weekStartKey(), tier = leagueState().tier, tl = myTL()){
  const days = []; for(let i = 0; i < 7; i++) days.push(addDays(wk, i));
  const list = leagueRivals(wk, tier).map(o => ({ name:o.name, rival:true, score:days.reduce((a, k) => a + rivalDay(o, k), 0) }));
  list.push({ name:'나', me:true, score:weekSum(tl, wk) });
  list.sort((a, b) => b.score - a.score || (a.me ? 1 : b.me ? -1 : 0));
  return list;
}
/* 새 주가 시작되면 지난주 결과로 승급·강등 */
function leagueRollover(){
  const s = leagueState(), cur = weekStartKey();
  if(s.week === cur){ store.set('hp:league', s); return null; }
  const tl = myTL(), b = leagueBoard(s.week, s.tier, tl), pos = b.findIndex(x => x.me) + 1, my = b[pos - 1].score;
  let move = 0;
  if(my > 0 && pos <= 5 && s.tier < 3) move = 1; else if(pos > 25 && s.tier > 0) move = -1;
  const res = { week:s.week, pos, score:my, from:s.tier, to:s.tier + move };
  s.tier += move; s.week = cur; s.last = res; s.seen = false; store.set('hp:league', s);
  return res;
}
/* 모두의 기부(시뮬레이션, 결정 96): 이번 주 모두가 본 광고 수익 일부가 쌓여 매달 기부된다. 순위·성적과 무관 */
function prizePool(){
  const wk = weekStartKey(), [y, m, d] = wk.split('-').map(Number), st = new Date(y, m - 1, d).getTime();
  const el = Math.max(0, Math.min(Date.now(), weekDeadline(wk).getTime()) - st) / 1000;
  return 250000 + Math.round(el * 3.1) + (store.get('hp:adsWeek', {})[wk] || 0) * 12;
}
/* 전 세계 같은 문제(시뮬레이션): 오늘 참가자 수와 내 위치 */
function worldStat(score){
  const n = new Date(), h = n.getHours() + n.getMinutes() / 60;
  const cnt = Math.round(4200 + 118000 * Math.min(1, Math.max(0.05, (h - 5) / 17)));
  const top = score ? Math.round(Math.max(0.3, Math.min(99, 100 / (1 + Math.exp((score - 2300) / 500)))) * 10) / 10 : null;
  return { n:cnt, top };
}
/* 상위 % 표시: 시범 운영 중엔 정수 + '예상'(가짜 정밀도 금지) */
const topLabel = t => t == null ? '' : DEMO_NUMBERS ? '예상 상위 ' + Math.max(1, Math.round(t)) + '%' : '상위 ' + t + '%';
const topTxt = t => t == null ? '' : topLabel(t) + (t <= 50 ? '' : ' · 오늘 더 올려 봐요');
const onlySample = () => !(typeof frReal === 'function' && frReal());   /* 진짜 친구가 없어 예시 친구만 보이는 상태 */
/* 모두의 기부 한 줄(홈 띠·리그 카드): 시범 운영 중엔 금액 대신 안내 */
function poolLine(idSuffix = ''){
  return DEMO_NUMBERS ? `<b class="pl-t">모두의 기부</b><span class="pl-s">시범 운영 중 · 정식 오픈 후 기부해요</span>`
    : `<b class="pl-t">이번 주 모두의 기부</b><b class="num pl-n" id="poolAmt${idSuffix}">${fmt(prizePool())}원</b>`;
}
function openDonateInfo(){
  openModal(`<h3>모두의 기부</h3>
    <p class="note">광고를 1번 볼 때마다 광고 수익 일부(12원)를 모아 매달 좋은 곳에 기부해요. 순위나 성적과는 상관없어요.</p>
    ${DEMO_NUMBERS ? '<p class="note"><b>지금은 시범 운영 중이에요.</b> 아직 실제로 쌓이거나 기부되지 않아요. 정식 오픈부터 쌓이기 시작해요.</p>' : `<p class="note">이번 주 모인 금액 <b class="num">${fmt(prizePool())}원</b></p>`}
    <div class="mbtns one"><button class="b1" id="mClose">알겠어요</button></div>`);
  $('#mClose').onclick = closeModal;
}
function tierBadge(t){
  const [name, c, l] = TIERS[t], u = 'tb' + (++SVG_UID);
  return `<svg viewBox="0 0 64 70" aria-label="${name} 리그"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <path d="M32 3 58 12v20c0 18-12 30-26 35C18 62 6 50 6 32V12z" fill="url(#gGold)" stroke="#1A0F45" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 10 51 16.5V32c0 13.5-9 23-19 27-10-4-19-13.5-19-27V16.5z" fill="url(#${u})" stroke="#1A0F45" stroke-width="2"/>
    <path d="M32 10 51 16.5V26c-11-4-27-4-38 0v-9.5z" fill="#fff" opacity=".3"/>
    <path d="M32 17l4 8.2 9 1.3-6.5 6.3 1.5 9L32 37.6 24 41.8l1.5-9L19 26.5l9-1.3z" fill="#fff" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/>
    <text x="32" y="54" text-anchor="middle" font-family="Jua, sans-serif" font-size="10" fill="#1A0F45">${name}</text></svg>`;
}

function board(d){
  const pack = (tl, o) => ({ ...o, tl, streak: tl.streak, att: tl.today.st === 'att', pct: tl.today.pct, score: tl.score });
  const real = typeof frBoardFriends === 'function' ? frBoardFriends() : null;   /* 진짜 친구가 있으면 진짜만(친구 v1) */
  const list = real || FRIENDS.map(f => pack(timeline(friendDay(f)), { ...f, sample:true }));
  list.push(pack(myTL(), { name:'나', av:'🦊', me:true }));
  list.sort((a,b) => b.score - a.score || (a.me ? 1 : b.me ? -1 : 0));
  return list;
}
const meScore = b => b.find(x => x.me).score;
/* 모드 v6: 오늘 = 10게임 중 날짜별 5개, 솔로 = 새 스테이지 첫 클리어 점수, 대전 = 승패 점수 */
const DAILY_N = 5, SOLO_CAP = 1000, DUEL_PTS = { w:400, d:250, l:150 };
/* ===================== 오늘의 시험지 v9 (기획팀 × 마케팅팀 "같은 문제, 다른 점수.", 2026-09-30) =====================
   · 매일 5과목(논리·집중·공간·전략·추리) — 과목마다 게임 2개 중 1개, 같은 게임 3일 넘게 연속 금지
   · 전 국민 같은 문제: 문제 씨앗 = 날짜 + 게임(판 번호·난이도 없음). 난이도는 요일로 고정(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움), 배율 없음
   · 공식 답안 = 게임마다 그날 첫 판(무료). 다시 풀기는 같은 문제 연습(♥1, 기록 없음). 실패·그만하기는 진행률 × 300 부분 점수
   · 오늘 점수 = 5과목 공식 점수 합(솔로·대전·출석 보너스를 더하지 않음 → 누구와도 그대로 비교)
   · 성적표: 같은 문제를 푼 사람 중 등수로 과목마다 수·우·미·양·가 (서버 전까지는 분포 가정)
   · 출석은 점수가 아니라 선물(연속 3·7·14·30…일 하트)과 휴식권으로만 */
/* '전략' = 숫자 합치기 + 오목 묘수풀이(결정 220). 'tower'(숲 지킴이, 삭제됨)는 지난 날짜 뽑기를 그대로 두려고 목록 맨 앞에 이름만 남긴다(SUBJ_UNTIL) */
const SUBJ = [['논리', ['fox','nono']], ['집중', ['sudoku','memory']], ['공간', ['ball','block','link','thread']], ['전략', ['tower','merge','omok']], ['추리', ['fleet','match']]];
/* 과목에 새로 들어온 게임은 이 날짜부터 시험지에 나온다(그 전 날짜의 시험지는 그대로 → 이미 푼 사람과 같은 문제) */
const SUBJ_FROM = { link:'2026-10-04', thread:'2026-10-06', omok:'2026-10-07' };
/* 과목에서 빠진 게임은 이 날짜 전까지만 뽑기에 들어간다(지난 날짜 시험지가 바뀌지 않게). 적용일 다음 날 0시부터 빠짐 */
const SUBJ_UNTIL = { tower:'2026-10-07' };
/* 은퇴한 게임: 코드는 없고 지난 기록 표시용 이름만 */
const RETIRED = { tower:'숲 지킴이' };
const gameName = id => GAMES[id] ? GAMES[id].name : RETIRED[id] ? '지난 게임(' + RETIRED[id] + ')' : id;
/* 시험지에서 게임을 부를 때 쓰는 모드(게임 정의가 그 모드를 가져야 시험지에 나옴). 오목 = 묘수풀이 */
const EXAM_MODE = { omok:'puzzle' };
const hasMode = (g, md) => { const m = NG[g]; return !!m && (m.examMode === md || m.dailyMode === md || (Array.isArray(m.modes) && m.modes.includes(md)) || !!(m.modes && !Array.isArray(m.modes) && m.modes[md])); };
const examReady = g => !!GAMES[g] && (!EXAM_MODE[g] || hasMode(g, EXAM_MODE[g]));
const examOpt = (id, o = {}) => EXAM_MODE[id] ? Object.assign({ mode:EXAM_MODE[id] }, o) : o;
const subjGames = (i, kk) => SUBJ[i][1].filter(g => (!SUBJ_FROM[g] || kk >= SUBJ_FROM[g]) && (!SUBJ_UNTIL[g] || kk < SUBJ_UNTIL[g]));
const subjOf = id => { const x = SUBJ.find(q => q[1].includes(id)); return x ? x[0] : ''; };
const LV_KO = { easy:'쉬움', normal:'보통', hard:'어려움' }, WD_KO = ['일','월','화','수','목','금','토'];
function wdOf(k = dayKey()){ const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function examLv(k = dayKey()){ const w = wdOf(k); return w === 1 || w === 2 ? 'easy' : w === 0 || w === 6 ? 'hard' : 'normal'; }
function examLabel(k = dayKey()){ return WD_KO[wdOf(k)] + '요일 · ' + LV_KO[examLv(k)]; }
function examTop(id, score, k = dayKey()){
  if(!score) return null;
  const mu = { easy:700, normal:590, hard:480 }[examLv(k)] + (seedFrom('mu:' + k + ':' + id) % 61) - 30, z = (score - mu) / 170;
  return Math.max(0.5, Math.min(99.5, Math.round((1 - 1 / (1 + Math.exp(-1.702 * z))) * 1000) / 10));
}
const gradeOf = top => top == null ? '–' : top <= 10 ? '수' : top <= 30 ? '우' : top <= 60 ? '미' : top <= 85 ? '양' : '가';
const GRADE_COL = { '수':'#27B86A', '우':'#3BAFDA', '미':'#FFC93C', '양':'#FF8A3D', '가':'#B9A6C8', '–':'#DDD3C0' };
function examDone(d, id){ return (d.tries[id] || 0) > 0 && (d.best[id] > 0 || d.offDone && d.offDone[id]); }
function examProgress(){ return gameProg(); }   /* 진행률 0~1(게임 정의 progress) */
const STREAK_GIFT = { 3:1, 7:2, 14:2, 30:3, 50:3, 100:5, 200:5, 365:10 };
function nextGift(streak){ const k = Object.keys(STREAK_GIFT).map(Number).find(x => x > streak); return k ? [k, STREAK_GIFT[k]] : null; }
/* 오늘 첫 판(무엇이든 끝까지 한 판)에 부르는 출석 처리: 연속 기념일이면 하트 선물 */
function attPillHtml(){
  const t = myTL(), g = STREAK_GIFT[t.streak], d = dayState();
  if(g && !d.streakGift){ d.streakGift = true; saveDay(d); addHearts(g); }
  return `<span class="pill grit">${ic('flame')} 오늘 출석 · 연속 ${t.streak}일${g ? ` · 선물 하트 +${g}` : ''}</span>`;
}
const TSET_MEMO = {};
function todaySet(k = dayKey()){
  if(TSET_MEMO[k]) return TSET_MEMO[k].slice();
  /* 40일 전부터 차례로 뽑으며 같은 게임이 3일 넘게 이어지면 바꾼다(날짜만으로 결정 → 전 국민 같음) */
  /* 과목마다 그날 쓸 수 있는 게임 중 하나(게임 2개면 예전과 똑같이 뽑힘) */
  const base = (kk, i) => { const L = subjGames(i, kk); return L[Math.floor(mulberry(seedFrom('subj:' + kk + ':' + i))() * L.length)]; };
  const last = SUBJ.map(() => [null, 0]); let out = null;
  for(let j = 40; j >= 0; j--){
    const kk = addDays(k, -j);
    out = SUBJ.map((x, i) => { let g = base(kk, i); if(last[i][0] === g && last[i][1] >= 3){ const L = subjGames(i, kk).filter(y => y !== g); g = L[seedFrom('subj2:' + kk + ':' + i) % L.length]; }
      last[i] = [g, last[i][0] === g ? last[i][1] + 1 : 1]; return g; });
  }
  /* 오늘·앞으로의 시험지에 사이트에서 못 푸는 게임(은퇴했거나 시험지 모드가 아직 없는 게임)이 뽑히면 같은 과목의 풀 수 있는 게임으로 대신한다.
     지난 날짜는 뽑힌 그대로(은퇴 게임은 이름만 보임) */
  if(k >= dayKey()) out = out.map((g, i) => examReady(g) ? g : (subjGames(i, k).concat(SUBJ[i][1]).find(examReady) || g));
  TSET_MEMO[k] = out; return out.slice();
}

const soloPts = st => 100 + 50 * st;
function myPos(d){ const b = board(d); return { b, pos:b.findIndex(x => x.me) + 1, n:b.length }; }
function nextUnplayed(except){ const d = dayState(); return d.set.find(g => g !== except && !d.tries[g]); }
function pickNext(){
  const d = dayState(), un = d.set.find(g => !d.tries[g]);
  return un || d.set.slice().sort((a, b) => d.best[a] - d.best[b])[0];
}
function heartLeft(h){ return mmss((REGEN_MS - (Date.now() - h.t)) / 1000); }
/* 순위 메달: 1위 빨강, 2위 파랑, 3위 동색 + 금테·리본. 4위부터는 번호 원 */
function medal(n, big){
  const col = { 1:['#FF6B7E','#D61F3C'], 2:['#7FA6FF','#3558C9'], 3:['#F2A15C','#B3591F'] }[n] || ['#9C7BFF','#5B34D6'];
  const id = 'md' + n + (big ? 'b' : 's');
  const label = n ? n + '위' : '–';
  return `<svg viewBox="0 0 64 70" aria-label="${n ? n + '위' : '순위 없음'}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></linearGradient></defs>
    ${n && n <= 3 ? `<path d="M18 44l-6 22 10-5 6 8 6-21z" fill="${col[1]}" stroke="#1A0F45" stroke-width="2.5" stroke-linejoin="round"/><path d="M46 44l6 22-10-5-6 8-6-21z" fill="${col[1]}" stroke="#1A0F45" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
    <circle cx="32" cy="32" r="29" fill="url(#gGold)" stroke="#1A0F45" stroke-width="3"/>
    <circle cx="32" cy="32" r="22.5" fill="url(#${id})" stroke="#8A5200" stroke-width="2"/>
    <ellipse cx="32" cy="21" rx="15" ry="7.5" fill="#fff" opacity=".28"/>
    ${[0,1,2,3,4,5,6,7].map(k => { const a = k * Math.PI / 4; return `<circle cx="${32 + Math.cos(a) * 25.8}" cy="${32 + Math.sin(a) * 25.8}" r="1.3" fill="#FFF6C8"/>`; }).join('')}
    <text x="32" y="${n >= 10 ? 38 : 39}" text-anchor="middle" font-family="Black Han Sans, Jua, sans-serif" font-size="${n >= 10 ? 15 : 18}" fill="#fff" stroke="#1A0F45" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${label}</text>
  </svg>`;
}
/* ---- 모험 레벨: 별을 모아 레벨업 ---- */
const TITLES = [[1,'새싹 퍼즐러'],[3,'견습 탐험가'],[5,'숙련 탐험가'],[8,'퍼즐 기사'],[12,'두뇌 마법사'],[16,'전설의 현자'],[20,'퍼즐 마스터']];
function titleOf(L){ let t = TITLES[0][1]; for(const [k, v] of TITLES) if(L >= k) t = v; return t; }
/* 은퇴한 게임의 솔로 별(지우지 않음): 솔로 레벨이 내려가지 않게 레벨 계산에 그대로 더한다 */
function retiredStars(){ return Object.keys(RETIRED).reduce((s, g) => { const p = store.get('hp:adv:' + g, null); return s + (p && p.stars ? Object.values(p.stars).reduce((a, b) => a + (b || 0), 0) : 0); }, 0); }
function lvInfo(stars = advTotal() + retiredStars()){ let L = 1; while(stars >= 5 * L * (L + 1) / 2) L++; const a = 5 * L * (L - 1) / 2, b = 5 * L * (L + 1) / 2; return { L, cur:stars - a, need:b - a, stars, title:titleOf(L) }; }
function nextTitle(L){ const t = TITLES.find(([k]) => k > L); return t ? t : null; }
function shieldSVG(L){
  const u = 'sh' + (++SVG_UID);
  const tier = L >= 20 ? ['#FF9CEB','#B04BFF','#5B1C9E'] : L >= 12 ? ['#FFE27A','#FF9F1C','#9A5A00'] : L >= 5 ? ['#9FD8FF','#3B8BEB','#1B4C9E'] : ['#FFC39A','#E9772E','#8A3A0A'];
  const fs = L >= 100 ? 15 : L >= 10 ? 19 : 22;
  return `<svg viewBox="0 0 64 70" aria-label="레벨 ${L}"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tier[0]}"/><stop offset="1" stop-color="${tier[1]}"/></linearGradient></defs>
    <path d="M6 20 1 14l6-1M58 20l5-6-6-1" fill="url(#gGold)" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 4 58 13V32c0 18-12 30-26 35C18 62 6 50 6 32V13z" fill="url(#gGold)" stroke="#1A0F45" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 11 51 17.5V32c0 13.5-9 23-19 27-10-4-19-13.5-19-27V17.5z" fill="url(#${u})" stroke="${tier[2]}" stroke-width="2"/>
    <path d="M32 11 51 17.5V27c-11-4-27-4-38 0v-9.5z" fill="#fff" opacity=".25"/>
    <path d="M32 0l2.2 4.6 5 .7-3.6 3.5.9 5L32 11.4l-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#FFF3A8" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/>
    <text x="32" y="29" text-anchor="middle" font-family="Black Han Sans, Jua, sans-serif" font-size="9" fill="#fff" stroke="#1A0F45" stroke-width="3" paint-order="stroke">LV</text>
    <text x="32" y="${L >= 10 ? 48 : 49}" text-anchor="middle" font-family="Black Han Sans, Jua, sans-serif" font-size="${fs}" fill="#fff" stroke="#1A0F45" stroke-width="4.5" paint-order="stroke" stroke-linejoin="round">${L}</text></svg>`;
}
function badgeSVG(id, c){
  const u = 'bd' + (++SVG_UID), [c1, c2, c3] = GCOL[id];
  let pts = ''; for(let k = 0; k < 24; k++){ const a = k * Math.PI / 12 - Math.PI / 2, r = k % 2 ? 25.5 : 29.5; pts += (32 + Math.cos(a) * r).toFixed(1) + ',' + (30 + Math.sin(a) * r).toFixed(1) + ' '; }
  const icon = `<g transform="translate(19 16) scale(1.08)" fill="#fff" color="#fff">${SVG[id].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
  return `<svg viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <path d="M21 48 15 69l8-3.5 5.5 6L33 53z" fill="${c3}" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/><path d="M43 48l6 21-8-3.5-5.5 6L31 53z" fill="${c3}" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/>
    <polygon points="${pts}" fill="url(#gGold)" stroke="#1A0F45" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="32" cy="30" r="20" fill="url(#${u})" stroke="#1A0F45" stroke-width="2.4"/>
    <ellipse cx="32" cy="21" rx="13" ry="6" fill="#fff" opacity=".25"/>${icon}
    <circle cx="32" cy="50" r="8.5" fill="url(#gGold)" stroke="#1A0F45" stroke-width="2.2"/>
    <text x="32" y="54.5" text-anchor="middle" font-family="Black Han Sans, Jua, sans-serif" font-size="12" fill="#5A3300">${c}</text></svg>`;
}
function quickStart(id){ startGame(id, examLv(), examOpt(id)); }   /* v9: 오늘의 시험지는 요일 난이도 */


/* ---- 탭 ---- */
let TAB = 'today';
function setTab(t){ TAB = t; if(t === 'adv') store.set('hp:advSeen', 1); renderHome(); window.scrollTo(0, 0); }

function renderHome(){
  const d = dayState(), h = heartState();
  try{ lastSig = homeSig(); }catch(e){}
  const hc = $('#heartChip');
  hc.innerHTML = `<span class="res-ico">${HEART_G}</span><span class="res-val"><b class="num">${h.n}/${MAX_H}</b>${h.n < MAX_H ? `<small class="num" id="hTimer">${heartLeft(h)}</small>` : '<small>가득</small>'}</span><span class="res-plus" aria-hidden="true">+</span>`;
  hc.setAttribute('aria-label', '하트 ' + h.n + '개. 눌러서 하트 충전');
  const lv = lvInfo();
  $('#meBtn').innerHTML = FOX_FACE + `<span class="lvb">Lv.${lv.L}</span>`;
  const panes = { today:'#paneToday', adv:'#paneAdv', duel:'#paneDuel', league:'#paneLeague', me:'#paneMe' };
  for(const k in panes) $(panes[k]).hidden = k !== TAB;
  document.querySelectorAll('#dock button').forEach(b => { if(b.dataset.tab === TAB) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const dot = $('#advDot'); if(dot) dot.style.display = store.get('hp:advSeen', 0) ? 'none' : '';
  const tl = myTL(), P = myPos(d);
  renderToday(d, tl, P, lv); renderAdv(lv); renderDuel(d); renderLeague(d, P); renderMe(d, tl, P, lv);
  const pending = giftsToday().filter(n => !d.claimed.includes(n)).length + (typeof frInboxCount === 'function' ? frInboxCount() : 0);
  $('#badge').textContent = pending; $('#badge').style.display = pending ? '' : 'none';
  if(typeof frSyncScore === 'function') frSyncScore();
}

function renderToday(d, tl, P, lv){
  const ndone = d.set.filter(g => examDone(d, g) || d.tries[g] > 0).length;
  /* 상단 요약줄: 이름표가 붙은 세 칸(오늘 점수 · 시험지 · 마감까지) + 과목별 성적 */
  $('#strip').innerHTML = `<span class="st3">
      <span class="sc"><small>오늘 점수</small><b class="num">${fmt(tl.score)}<em>점</em></b></span>
      <span class="sc"><small>시험지</small><b class="num">${ndone}<em>/${DAILY_N}</em></b></span>
      <span class="sc"><small>마감까지</small><b class="num" id="closing">${closingText()}</b></span></span>
    <span class="stgr">${d.set.map(g => { const gr = gradeOf(examTop(g, d.best[g])); return `<i class="${gr === '–' ? 'none' : ''}" style="--gcol:${GRADE_COL[gr]}">${subjOf(g)}<b>${gr}</b></i>`; }).join('')}</span>
    <span class="go">${ic('chev')}</span>`;
  $('#strip').setAttribute('aria-label', `오늘 점수 ${fmt(tl.score)}점, 시험지 ${ndone}/${DAILY_N}과목, 자정 마감. 내 정보 보기`);
  $('#pool').innerHTML = `${ic('coin')}<span class="pt">${poolLine()}</span>${ic('chev')}`;
  const now = new Date();
  $('#dayNote').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 ${examLabel()}`;
  const nx = pickNext(), nb = $('#nextBtn');
  const nxDone = d.tries[nx] > 0, nxSub = nxDone ? '시험지 완료 · 다시 풀기는 ♥1, 기록 안 돼요' : subjOf(nx) + ' 과목 · 공식 답안 무료 · ' + GAME_META[nx].time;
  nb.innerHTML = `<span class="cta-tile" style="--g2:${GCOL[nx][1]}">${ic(nx)}</span><span class="cta-txt"><i>${nxDone ? '다시 풀기' : '지금 풀 차례'} · ${LV_KO[examLv()]}</i><b>${GAMES[nx].name}</b><small>${nxSub}</small></span><span class="cta-play">${SVG.play.replace('fill="currentColor"', 'fill="#C2410C"')}</span>`;
  nb.setAttribute('aria-label', '바로 시작: ' + GAMES[nx].name + (nxDone ? ', 다시 풀기 하트 1개' : ', 공식 답안 무료'));
  nb.onclick = () => quickStart(nx);
  const g = $('#games'); g.innerHTML = '';
  for(const id of d.set){
    const best = d.best[id], tries = d.tries[id], gr = gradeOf(examTop(id, best)), now1 = id === nx && !nxDone;
    const st = tries ? `공식 답안 <em>${fmt(best)}점</em>` : now1 ? `<em class="nowtx">지금 풀 차례</em> · ${GAME_META[id].time}` : `아직 안 풀었어요 · ${GAME_META[id].time}`;
    /* 꼬리표: 푼 과목 = 성적 도장, 한 번도 안 해 본 게임 = '처음'(매일 붙는 NEW 아님) */
    const badge = tries ? `<span class="stamp grade" style="--gcol:${GRADE_COL[gr]}">${gr}</span>` : !store.get('hp:help:' + id, false) ? '<span class="newb">처음</span>' : '';
    const row = document.createElement('div'); row.className = 'grow panel' + (now1 ? ' now' : '') + (tries ? ' done' : ''); row.style.setProperty('--gc', GCOL[id][1]);
    row.innerHTML = `<span class="g-art">${ART[id]()}${badge}</span><span class="gr-mid"><b><span class="subj">${subjOf(id)}</span>${GAMES[id].name}</b><span>${st}</span></span><button class="gr-go soft${tries ? ' re' : ''}" aria-label="${GAMES[id].name} ${tries ? '다시 풀기, 하트 1개, 기록 안 됨' : '공식 답안 시작, 무료'}">${tries ? '다시 풀기 ' + costTag() : '시작 <span class="freebadge">무료</span>'}</button>`;
    row.querySelector('.gr-go').onclick = () => quickStart(id);
    row.querySelector('.g-art').onclick = () => quickStart(id);
    g.appendChild(row);
  }
  if(typeof rpPastBtn === 'function') rpPastBtn();   /* 지난 7일 문제 다시 풀기(portal/replay.js) */
  $('#advPromo').innerHTML = `<span class="ap-i">${shieldSVG(lv.L)}</span><span><b>솔로 · Lv.${lv.L} ${lv.title}</b><small>${GAME_IDS.length}가지 게임 · 별을 모아 레벨 업</small></span>${ic('chev')}`;
  $('#duelPromo').innerHTML = `<span class="ap-i">${ic('duel')}</span><span><b>대전 · 오늘 ${d.dw}승 ${d.dd}무 ${d.dl}패</b><small>같은 문제를 같은 시간에, 1:1</small></span>${ic('chev')}`;
}

function renderAdv(lv){
  renderSoloPts();
  const nt = nextTitle(lv.L);
  $('#lvCard').innerHTML = `<span class="shield">${shieldSVG(lv.L)}</span><div><span class="t">솔로 레벨</span><b>Lv.${lv.L} ${lv.title}</b><div class="xp"><i style="width:${lv.cur / lv.need * 100}%"></i></div><div class="xp-t"><span>Lv.${lv.L + 1}까지 별 ${lv.need - lv.cur}개${nt ? ` · 칭호 '${nt[1]}' Lv.${nt[0]}` : ''}</span><b class="num">${lv.cur}/${lv.need}</b></div></div>`;
  renderFilter('adv');
  const list = $('#advList'); list.innerHTML = '';
  for(const id of filteredIds('adv')){
    if(id === ADULT_SEP){ list.insertAdjacentHTML('beforeend', adultSepHtml()); continue; }
    const p = advProg(id), cur = p.max, c = chOf(cur), cs = (c - 1) * 10;
    let dots = ''; for(let k = 1; k <= 10; k++){ const n = cs + k, s = p.stars[n] || 0; dots += `<i class="${s ? 's' + s : n === cur ? 'cur' : ''}"></i>`; }
    const el = document.createElement('div'); el.className = 'acard tile panel'; el.style.setProperty('--gc', GCOL[id][1]);
    el.innerHTML = `<span class="g-art">${ART[id]()}<span class="chn">챕터 ${c} · ${chName(id, c)}</span></span>
      <div class="ac-top"><b>${GAMES[id].name}</b><span>★ ${advStarsOf(id)}</span></div>
      ${NG[id].cardNote ? '<div class="ac-note"><b class="cnote">' + escH(NG[id].cardNote()) + '</b></div>' : ''}
      <div class="chdots" aria-label="챕터 ${c}에서 별 ${chStars(id, c)}개">${dots}</div>
      <div class="ac-btns"><button class="gr-go adv" aria-label="${GAMES[id].name} 이어 하기 ${cur}판, 무료">이어 하기 ${cur}판</button><button class="map" aria-label="${GAMES[id].name} 판 고르기">${ic('map')}판 고르기</button></div>`;
    el.querySelector('.map').onclick = () => openAdvMap(id);
    el.querySelector('.gr-go').onclick = () => startGame(id, null, { adv:cur });
    el.querySelector('.g-art').onclick = () => openAdvMap(id);
    list.appendChild(el);
  }
}
/* ---- 솔로·대전 목록: 과목 칩 필터 + 성인(19) 묶음 ---- */
const SUBJ_OF_ABIL = { '논리력':'논리', '집중력':'집중', '공간지각':'공간', '전략력':'전략', '추리력':'추리', '순발력':'순발' };
const FILT_SUBJ = ['전체', '논리', '집중', '공간', '전략', '추리', '순발'];
const FILT = { adv:'전체', duel:'전체' }, ADULT_SEP = '__adult__';
const subjOfGame = id => SUBJ_OF_ABIL[ABIL[id]] || '';
function filteredIds(kind){
  const f = FILT[kind], main = GAME_IDS.filter(id => !isAdult(id) && (f === '전체' || subjOfGame(id) === f));
  const adult = f === '전체' ? GAME_IDS.filter(isAdult) : [];
  return adult.length ? main.concat([ADULT_SEP], adult) : main;
}
const adultSepHtml = () => `<div class="adultsec"><span class="a19">19</span>성인 게임 · 만 19세 이상</div>`;
function renderFilter(kind){
  const box = $('#' + kind + 'Filter'); if(!box) return;
  box.innerHTML = FILT_SUBJ.map(s => `<button aria-pressed="${FILT[kind] === s}" data-f="${s}">${s}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => { FILT[kind] = b.dataset.f; if(kind === 'adv') renderAdv(lvInfo()); else renderDuel(dayState()); });
}

function renderLeague(d, P){
  const r = $('#rank'); r.innerHTML = '';
  $('#tabDay').setAttribute('aria-pressed', RANK_MODE === 'day'); $('#tabMonth').setAttribute('aria-pressed', RANK_MODE === 'week');
  if(RANK_MODE === 'week'){ renderWeek(d, r); return; }
  const tl = myTL(), ws = worldStat(tl.score);
  $('#lgHead').innerHTML = `<div class="worldcard">${ic('globe')}<span>${DEMO_NUMBERS ? '전 국민이 오늘 같은 문제를 받았어요' : `오늘 전 국민 <b class="num">${fmt(ws.n)}</b>명이 같은 문제를 풀었어요`}${ws.top != null ? `<br>내 위치 <b>${topTxt(ws.top)}</b>` : '<br>첫 과목을 끝내면 내 위치가 나와요'}</span></div>`;
  $('#rankNote').textContent = '오늘 점수 = 오늘의 시험지 5과목 공식 답안 합 · 모두 같은 문제라 그대로 비교해요 · 자정 마감';
  P.b.forEach((x, i) => {
    const row = document.createElement('div'); row.className = 'row' + (x.me ? ' me' : '');
    const stk = x.streak ? `<span class="streak">${ic('flame')}${x.streak}일</span>` : '';
    const sub = x.me ? d.set.map(k => `<span class="mini${d.best[k] ? ' on' : ''}" style="--gc:${GCOL[k][1]}">${ic(k)}</span>`).join('') + stk
      : (stk ? stk + (x.att ? '' : '&nbsp;· 오늘 아직') : (x.att ? '오늘 플레이함' : '아직 안 했어요'));
    const posHtml = !x.score ? '<span class="pnum none">–</span>' : i < 3 ? medal(i + 1, false) : `<span class="pnum">${i + 1}</span>`;
    row.innerHTML = `<div class="pos">${posHtml}</div>${pAvatar(x)}<div class="who"><b>${x.me ? '나' : escH(x.name)}${x.sample ? ' <i class="samp">예시</i>' : ''}</b><small>${sub}</small></div><div class="sc num">${fmt(x.score)}</div><div></div>`;
    if(!x.me){
      const btn = document.createElement('button'); btn.className = 'send';
      const key = x.fid || x.name, sent = !!d.sent[key];
      btn.innerHTML = ic(sent ? 'check' : 'heart'); btn.disabled = sent;
      btn.setAttribute('aria-label', sent ? x.name + '님에게 오늘 하트를 보냈어요' : x.name + '님에게 하트 보내기');
      btn.onclick = e => { e.stopPropagation(); frSendHeart(x, btn); };
      row.lastElementChild.appendChild(btn);
      if(x.fid){ row.classList.add('tap'); row.onclick = () => frFriendSheet(x); }
    }
    r.appendChild(row);
  });
  if(!(typeof frReal === 'function' && frReal())) r.insertAdjacentHTML('afterbegin', `<div class="sampnote">지금은 <b>예시 친구</b>예요. 친구를 초대하면 진짜 친구 리그가 돼요.</div>`);
  const inv = document.createElement('div'); inv.className = 'frbar';
  inv.innerHTML = `<button class="invrow" id="invBtn"><span class="ii">${ic('share')}</span><span><b>친구 초대하기</b><small>링크로 들어오면 바로 친구가 돼요 · 친구에게 하트 2개 선물</small></span></button>
    <button class="invrow mng" id="frMng"><span class="ii">${ic('user')}</span><span><b>친구 · 같이 하기</b><small>${typeof frOnlineN === 'function' && frOnlineN() ? '접속 중 ' + frOnlineN() + '명 · ' : ''}${frCode() ? '내 코드 ' + frCode() + ' · ' : ''}추가 · 삭제</small></span></button>`;
  r.appendChild(inv);
  $('#invBtn').onclick = () => viralShare(cardInvite(), closeModal);
  $('#frMng').onclick = frHub;
}
const rivalAv = x => { const i = seedFrom(x.name) % 6; return `<span class="av" style="--avbg:${FACE_BG[i]}">${animalFace(FACE_KIND[i])}</span>`; };
function renderWeek(d, r){
  const tl = myTL(), s = leagueState(), wk = weekStartKey(), b = leagueBoard(wk, s.tier, tl), pos = b.findIndex(x => x.me) + 1, me = b[pos - 1];
  const closed = Date.now() >= weekDeadline(wk).getTime(), up = s.tier < 3, down = s.tier > 0;
  $('#lgHead').innerHTML = `<div class="lgcard"><span class="tbd">${tierBadge(s.tier)}</span><div><span class="t">${REGION} · 현지 시간 기준</span><b class="big">${TIERS[s.tier][0]} 리그${me.score ? ' ' + pos + '위' : ''}</b>
      <span class="s2"><span>이번 주 <b class="num">${fmt(me.score)}</b>점</span><span>${ic('clock')}${closed ? '마감 · 월요일에 결과 발표' : `일요일 21시 마감까지 <span class="num" id="lgClose">${weekLeft()}</span>`}</span></span></div>
      <button class="lgpool" id="lgPool">${ic('coin')}<span class="pt">${poolLine('2')}</span></button></div>
      ${DEMO_NUMBERS ? '<div class="sampnote">주간 리그는 시범 운영 중이라 다른 참가자는 <b>예시</b>예요.</div>' : ''}`;
  $('#lgPool').onclick = openDonateInfo;
  b.forEach((x, i) => {
    if(i === 0 && up) r.insertAdjacentHTML('beforeend', `<div class="zone up">▲ 승급 구역 · 1~5위는 다음 주 ${TIERS[s.tier + 1][0]} 리그</div>`);
    if(i === 25 && down) r.insertAdjacentHTML('beforeend', `<div class="zone down">▼ 강등 구역 · 26~30위는 다음 주 ${TIERS[s.tier - 1][0]} 리그</div>`);
    const row = document.createElement('div'); row.className = 'row' + (x.me ? ' me' : '') + (up && i < 5 ? ' upz' : down && i >= 25 ? ' downz' : '');
    const posHtml = !x.score ? '<span class="pnum none">–</span>' : i < 3 ? medal(i + 1, false) : `<span class="pnum">${i + 1}</span>`;
    const sub = x.me ? (tl.streak ? `<span class="streak">${ic('flame')}연속 ${tl.streak}일</span>` : '매일 풀수록 주간 점수가 쌓여요') : (x.score ? '이번 주 참가 중' : '아직 기록 없음');
    row.innerHTML = `<div class="pos">${posHtml}</div>${x.me ? avatar(x) : rivalAv(x)}<div class="who"><b>${x.me ? '나' : x.name}</b><small>${sub}</small></div><div class="sc num">${fmt(x.score)}</div><div></div>`;
    r.appendChild(row);
  });
  $('#rankNote').textContent = '월~일 매일의 오늘 점수를 더해요. 빠진 날은 0점이라 꾸준할수록 유리해요 · 실력 비슷한 30명 · 리그 보상은 티어·트로피·칭호예요';
}
function showLeagueResult(res){
  if(!res) return;
  const up = res.to > res.from, down = res.to < res.from;
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">WEEKLY RESULT</p><div class="ttl">${up ? '승급!' : down ? '강등…' : '리그 유지'}</div>
    <div class="emb">${tierBadge(res.to)}</div><div class="newtitle">${TIERS[res.to][0]} 리그</div>
    <p class="note">지난주 ${TIERS[res.from][0]} 리그 <b>${res.score ? res.pos + '위' : '기록 없음'}</b> · 주간 점수 <b>${fmt(res.score)}</b>${down ? '<br>이번 주 5위 안에 들면 다시 올라가요' : ''}</p>
    ${up || (res.score && res.pos <= 3) ? `<div class="mbtns"><button class="b2" id="cBrag">${ic('share')} 자랑하기</button><button class="b1" id="cOk">좋아요!</button></div>` : `<div class="mbtns one"><button class="b1" id="cOk">${up ? '좋아요!' : '이번 주 다시 도전'}</button></div>`}`);
  { const bb = $('#cBrag'); if(bb) bb.onclick = () => viralShare(cardBrag('league', res), () => showLeagueResult(res)); }
  $('#modal').classList.add('celebrate');
  if(up){ fxConfetti(); sfx('fanfare'); setTimeout(() => fxPop($('#modal .emb'), 'gold'), 420); }
  else if(down) sfx('demote'); else sfx('result');
  const s = leagueState(); s.seen = true; store.set('hp:league', s);
  $('#cOk').onclick = () => { closeModal(); TAB = 'league'; RANK_MODE = 'week'; renderHome(); };
}

function renderMe(d, tl, P, lv){
  const tt = tl.today, { b, pos } = P, me = b[pos - 1];
  $('#prof').innerHTML = `${avatar({ me:true })}<div><b>나</b><span class="ttlchip">Lv.${lv.L} ${lv.title}</span><div class="xp"><i style="width:${lv.cur / lv.need * 100}%"></i></div><div class="xp-t"><span>솔로 별 ${lv.stars}개</span><b class="num">${lv.cur}/${lv.need}</b></div></div>`;
  const nplay = d.set.filter(g => d.best[g] > 0).length, nextPct = bonusPct(tl.streak + 1), curPct = tt.st === 'att' ? tt.pct : 0;
  const ng = nextGift(tl.streak), sampleOnly = DEMO_NUMBERS && onlySample();
  $('#bq').textContent = fmt(tl.score); $('#bqSkill').textContent = nplay; $('#bqSkillU').textContent = '/' + DAILY_N + '과목'; $('#bqGrit').textContent = tl.streak;
  $('#skillEx').innerHTML = '첫 판만 기록돼요';
  $('#barSkill').style.width = (nplay / DAILY_N * 100) + '%'; $('#barGrit').style.width = (ng ? Math.min(100, tl.streak / ng[0] * 100) : 100) + '%';
  $('#lbSkill').innerHTML = ic('brain') + '푼 과목'; $('#lbGrit').innerHTML = ic('flame') + '연속 출석';
  $('#gritEx').innerHTML = ng ? `${ng[0]}일째 선물 하트 <b>+${ng[1]}</b>` : '모든 선물을 받았어요';
  $('#myMedal').innerHTML = medal(tl.score && !sampleOnly ? pos : 0, true);
  let line;
  if(!tl.score) line = `아직 오늘 기록이 없어요. <em>${examLabel()}</em> 시험지를 풀어 보세요!`;
  else if(sampleOnly) line = `친구를 초대하면 <em>친구 순위</em>가 나와요`;   /* 예시 친구 기준 순위는 보이지 않음 */
  else if(pos === 1) line = `<em>1위</em>예요! 2위 ${b[1].name}님보다 ${fmt(me.score - b[1].score)}점 앞서요`;
  else { const a = b[pos - 2], gap = a.score - me.score; line = gap > 0 ? `${a.name}님까지 <em>${fmt(gap)}점</em> 남았어요` : `${a.name}님과 <em>동점</em>이에요`; }
  $('#rankLine').innerHTML = line;
  renderGritCard(tl);
  const played = d.set.filter(g => d.best[g] > 0).length;
  $('#dots').innerHTML = d.set.map(g => `<span class="gem${d.best[g] ? ' on' : ''}" style="--g1:${GCOL[g][0]};--g2:${GCOL[g][1]}" title="${GAMES[g].name}${d.best[g] ? ' · ' + fmt(d.best[g]) + '점' : ''}">${ic(g)}${d.best[g] ? `<i class="gem-ck">${ic('check')}</i>` : ''}</span>`).join('');
  /* 결정 152: 오늘 점수 = 시험지 5과목 합. 솔로·대전은 따로(여기에 더하지 않음) */
  $('#progTxt').textContent = played === DAILY_N ? `오늘의 시험지 ${DAILY_N}과목을 다 풀었어요!` : `오늘의 시험지 ${played} / ${DAILY_N}과목 · 솔로·대전은 따로 쌓여요`;
  /* 솔로 성장: 별 많은 순 5개 + 나머지는 접기 */
  const grw = id => { const p = advProg(id), c = chOf(p.max);
    return `<div class="grw" style="--gc:${GCOL[id][1]}"><span class="gi">${ic(id)}</span><span><b>${GAMES[id].name}</b><small>${p.max > 1 ? '스테이지 ' + (p.max - 1) + '까지 클리어 · ' : ''}지금 ${chName(id, c)}</small></span><span class="gs">★ ${advStarsOf(id)}</span></div>`; };
  const opn = sel => { const e = $(sel + ' details.more'); return e && e.open ? ' open' : ''; }, gOpen = opn('#growList'), bOpen = opn('#badges');   /* 다시 그려도 펼친 상태 유지 */
  const byStars = GAME_IDS.slice().sort((a, b) => advStarsOf(b) - advStarsOf(a));
  /* 은퇴한 게임: 별이 있으면 이름만 한 줄(솔로 레벨에 그대로 들어감) */
  const old = Object.keys(RETIRED).map(g => { const p = store.get('hp:adv:' + g, null), s = p && p.stars ? Object.values(p.stars).reduce((a, b) => a + (b || 0), 0) : 0;
    return s ? `<div class="grw retired"><span class="gi">${ic('trophy')}</span><span><b>${gameName(g)}</b><small>이제 없는 게임 · 모은 별은 레벨에 그대로 들어가요</small></span><span class="gs">★ ${s}</span></div>` : ''; }).join('');
  $('#growList').innerHTML = byStars.slice(0, 5).map(grw).join('') + (byStars.length > 5 || old ? `<details class="more"${gOpen}><summary>나머지 ${byStars.length - 5}개 게임 보기</summary>${byStars.slice(5).map(grw).join('')}${old}</details>` : '');
  /* 챕터 배지: 받은 것만 보이고 전체는 접기 */
  const bdg = (id, c, on) => `<div class="bdg${on ? '' : ' off'}" title="${GAMES[id].name} 챕터 ${c} ${chName(id, c)}${on ? ' 클리어' : ' 아직'}">${badgeSVG(id, c)}<span>${chName(id, c)}</span></div>`;
  let got = '', all = '', nb = 0; const total = GAME_IDS.length * 5;
  for(const id of GAME_IDS) for(let c = 1; c <= 5; c++){ const on = chCleared(id, c); if(on){ nb++; got += bdg(id, c, true); } all += bdg(id, c, on); }
  $('#badges').innerHTML = (nb ? `<div class="badges">${got}</div>` : '<p class="bd-empty">아직 받은 배지가 없어요. 솔로에서 챕터를 깨면 배지를 받아요.</p>')
    + `<details class="more"${bOpen}><summary>배지 ${total}개 모두 보기</summary><div class="badges">${all}</div></details>`;
  $('#bdgCount').textContent = nb + ' / ' + total;
}

/* ---- 난이도 시트(데일리): 고른 난이도는 기억해서 다음엔 바로 시작 ---- */
function pickLevel(id){
  if(NG[id].levelSheet){ NG[id].levelSheet(); return; }
  let sel = lastLv(id);
  const rows = Object.entries(LEVELS).map(([k, L], i) => {
    const X = levelOf(id, k);
    const d0 = NG[id].levelDesc(k);
    const desc = d0 + ' · 최대 약 ' + fmt(maxPts(id, k)) + '점';
    return `<button class="opt" role="radio" data-lv="${k}" aria-checked="${k === sel}"><span class="lvdots">${[0,1,2].map(j => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span><span><b>${L.name}</b><small>${desc}</small></span>${k === 'normal' ? '<span class="rec">추천</span>' : '<span></span>'}</button>`;
  }).join('');
  openModal(`<h3>${GAMES[id].name}</h3><p class="note">고른 난이도는 기억해 두었다가 다음엔 바로 시작해요.</p>
    <div class="opts" role="radiogroup" aria-label="난이도">${rows}</div>
    <div class="mbtns"><button class="b2" id="mClose">닫기</button><button class="b1" id="mGo">시작하기 ${costTag()}</button></div>`);
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => { sel = b.dataset.lv; document.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-checked', x === b)); });
  $('#mClose').onclick = closeModal;
  $('#mGo').onclick = () => { store.set('hp:lv:' + id, sel); closeModal(); startGame(id, sel); };
}
/* ---- 모험 결과 + 성장 축하 ---- */
function advFinish(win){
  const id = G.id, n = G.adv, lv0 = lvInfo();
  const p = advProg(id), prev = p.stars[n] || 0;
  let st = 0, first = false, better = false;
  const cel = [];
  /* 솔로도 끝까지 한 판이면 출석. 새 스테이지 첫 클리어는 솔로 점수(하루 한도 SOLO_CAP) */
  const dd = dayState(), firstToday = !dd.att; dd.att = true;
  let spts = 0, capped = false;
  if(win){
    st = advStarCalc(); first = !prev; better = st > prev;
    p.stars[n] = Math.max(prev, st); p.max = Math.max(p.max, n + 1); store.set(advKey(id), p);
    if(first){ const want = soloPts(st); spts = Math.max(0, Math.min(want, SOLO_CAP - dd.solo)); capped = spts < want; dd.solo += spts; }
    if(n % 10 === 0 && first){ addHearts(2); cel.push({ kind:'chapter', id, c:n / 10 }); itemReward([['foxHint', 1], ['foxAuto', 1]], '챕터 클리어 보상'); }
    const lv1 = lvInfo(), seen = store.get('hp:advLv', 1);
    if(lv1.L > seen){ addHearts(lv1.L - seen); itemAdd('foxHint', lv1.L - seen); store.set('hp:advLv', lv1.L); cel.push({ kind:'level', L:lv1.L, from:seen, hearts:lv1.L - seen }); }
  }
  saveDay(dd);
  const tlS = myTL(), attPill = firstToday ? attPillHtml() : '';
  const soloPill = first ? (spts ? `<span class="pill good">${ic('coin')} 솔로 포인트 +${spts} · 솔로 기록에 쌓여요</span>` : '') + (capped ? `<p class="note">오늘 솔로 점수 한도 ${fmt(SOLO_CAP)}점을 ${spts ? '다 채웠어요' : '이미 채웠어요'}. 내일 또 받아요.</p>` : '') : '';
  const lv1 = lvInfo(), c = chOf(n), cs = (c - 1) * 10;
  let dots = ''; for(let k = 1; k <= 10; k++){ const s = p.stars[cs + k] || 0; dots += `<i class="${s ? 's' + s : cs + k === p.max ? 'cur' : ''}"></i>`; }
  const xpFrom = lv1.L > lv0.L ? 0 : lv0.cur / lv0.need * 100, xpTo = lv1.cur / lv1.need * 100;
  const chBox = `<div class="chprog" style="--gc:${GCOL[id][1]}"><div class="h">${chName(id, c)} <small>챕터 ${c} · 별 ${chStars(id, c)}/30</small></div><div class="chdots">${dots}</div>
    <div class="xp"><i id="advXp" style="width:${xpFrom}%"></i></div><div class="xp-t"><span>Lv.${lv1.L} ${lv1.title}</span><b class="num">${win && st ? (better ? '+' + (st - prev) + '★ · ' : '') : ''}${lv1.cur}/${lv1.need}</b></div></div>`;
  let html;
  if(win){
    const tip = st === 3 ? '완벽해요! 별 3개 달성' : '다시 하면 별을 더 모을 수 있어요 · ' + ADV_RULE[id].split(' · ')[st];
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}스테이지 ${n} 클리어!</h3>
      <div class="bigstars" aria-label="별 ${st}개">${[1,2,3].map(i => `<span class="s${i <= st ? '' : ' off'}" style="animation-delay:${(0.1 + i * 0.22).toFixed(2)}s">${STAR_G}</span>`).join('')}</div>
      ${first ? '<span class="pill new">첫 클리어!</span>' : better ? '<span class="pill new">별 기록 경신!</span>' : `<p class="note">최고 기록 별 ${p.stars[n]}개는 그대로예요</p>`}
      <div>${soloPill}${attPill}</div>${!first ? '<p class="note">솔로 점수는 새 스테이지를 처음 깰 때만 받아요.</p>' : ''}
      ${recHtml()}${chBox}<p class="note">${tip}</p>`;
  } else {
    html = `<h3 class="bad">${resFace('sad')}아쉬워요!</h3><p class="lose">스테이지 ${n}</p><p class="note">${lossProgress()} 솔로는 하트 없이 몇 번이든 다시 할 수 있어요.</p>${attPill ? '<div>' + attPill + '</div>' : ''}${chBox}`;
  }
  const toMap = sel => () => { goHome(); TAB = 'adv'; renderHome(); openAdvMap(id, sel); };
  const pri = win ? ['다음 스테이지 ▶', () => startGame(id, null, { adv:n + 1 })] : ['다시 도전', () => startGame(id, null, { adv:n })];
  const sec = ['맵', toMap(win ? n + 1 : n)];
  const go = fn => () => { closeModal(); showCelebrations(cel.slice(), fn); cel.length = 0; };
  /* 결과 창 버튼 위계(공용): 주 버튼 1개 · 글자 버튼 줄 */
  const RB = { pri:{ id:'mPri', label:pri[0], sub:win ? `스테이지 ${n + 1}` : `스테이지 ${n} · 무료`, fn:go(pri[1]) },
    pair:[ win ? warmSkip(id, n, st) : null ],   /* 몸풀기 1판 ★3 → 5판으로 건너뛰기(WP3) */
    links:[{ id:'mSec', label:`${ic('map')}스테이지 ${sec[0]}`, fn:go(sec[1]) }, { id:'mGh', label:'홈으로', fn:go(() => { goHome(); setTab('adv'); }) }] };
  html += resBtns(RB);
  setTimeout(() => {
    openModal(html);
    if(win){
      fxConfetti(); sfx('result');
      document.querySelectorAll('#modal .bigstars .s').forEach((s, k) => setTimeout(() => {
        if(!s.isConnected) return;
        if(s.classList.contains('off')){ sfx('starOff'); return; }
        sfx('star', { i:k + 1 }); fxPop(s, 'gold'); fxBuzz(18);
      }, (0.1 + (k + 1) * 0.22) * 1000 + 180));
      if(first || better) setTimeout(() => { const pl = $('#modal .pill.new'); if(pl){ sfx('newRecord'); fxPop(pl, 'spark'); } }, 1150);
      recFx();   /* 기록 갱신 도장 */
    } else sfx('lose');
    resBind(RB);
    setTimeout(() => { const x = $('#advXp'); if(x){ x.style.width = xpTo + '%'; if(xpTo > xpFrom) sfx('xp'); } }, 250);
  }, win ? 500 : 250);
}
function showCelebrations(list, done){
  if(!list.length){ done(); return; }
  const e = list.shift();
  let html;
  if(e.kind === 'level'){
    const newT = titleOf(e.L) !== titleOf(e.from);
    html = `<div class="burst" aria-hidden="true"></div><p class="kick">LEVEL UP</p><div class="ttl">레벨 업!</div>
      <div class="emb">${shieldSVG(e.L)}</div>${newT ? `<div class="newtitle">새 칭호 · ${titleOf(e.L)}</div>` : ''}
      <p class="note">솔로 별을 모아 <b>Lv.${e.L}</b>이 되었어요!${newT ? '' : ` 칭호는 '${titleOf(e.L)}'`}</p>
      <div class="rewards"><div class="reward"><span class="ri">${HEART_G}</span><b>+${e.hearts}</b>하트</div><div class="reward"><span class="ri">${FX_ICON.bulb}</span><b>+${e.hearts}</b>여우 힌트</div><div class="reward"><span class="ri">${STAR_G}</span><b>Lv.${e.L}</b>레벨</div></div>`;
  } else {
    const nx = e.c + 1;
    html = `<div class="burst" aria-hidden="true"></div><p class="kick">CHAPTER CLEAR</p><div class="ttl">챕터 ${e.c} 클리어!</div>
      <div class="emb">${badgeSVG(e.id, e.c)}</div><div class="newtitle">${chName(e.id, e.c)} 정복</div>
      <p class="note">다음 무대 <b>${chName(e.id, nx)}</b> · 챕터 ${nx} 오픈!</p>
      <div class="rewards"><div class="reward"><span class="ri">${HEART_G}</span><b>+2</b>하트</div><div class="reward"><span class="ri">${badgeSVG(e.id, e.c)}</span><b>배지</b>획득</div></div>`;
  }
  html += e.kind === 'level' ? `<div class="mbtns"><button class="b2" id="cBrag">${ic('share')} 자랑하기</button><button class="b1" id="cOk">좋아요!</button></div>` : `<div class="mbtns one"><button class="b1" id="cOk">좋아요!</button></div>`;
  openModal(html); $('#modal').classList.add('celebrate');
  if(e.kind === 'level') $('#cBrag').onclick = () => viralShare(cardBrag('level', e), () => showCelebrations([e].concat(list), done));
  fxConfetti(); sfx('fanfare'); fxBuzz([30, 50, 30, 50, 60]);
  setTimeout(() => fxPop($('#modal .emb'), 'gold'), 450);
  setTimeout(() => { document.querySelectorAll('#modal .reward').forEach((r, k) => setTimeout(() => { if(!r.isConnected) return; sfx(k ? 'coin' : 'heartGet'); fxPop(r, k ? 'coin' : 'heart'); }, k * 180)); }, 900);
  $('#cOk').onclick = () => { closeModal(); setTimeout(() => showCelebrations(list, done), 120); };
}


const WD = ['일','월','화','수','목','금','토'];
function renderGritCard(tl){
  const on = tl.streak > 0 || tl.today.st === 'att';
  const last7 = tl.days.slice(-7);
  const week = last7.map(x => { const dt = new Date(x.k + 'T00:00'); return `<span class="wd ${x.st === 'att' ? 'att' : x.st === 'rest' ? 'rest' : ''}${x.st === 'today' ? ' today' : ''}" title="${x.k}">${WD[dt.getDay()]}</span>`; }).join('');
  const title = tl.today.st === 'att' ? `연속 ${tl.streak}일째 출석 중` : tl.streak ? `연속 ${tl.streak}일 · 오늘 이어가기` : '오늘부터 연속 기록 시작';
  const ng = nextGift(tl.streak), sub = `${ng ? '다음 선물 ' + ng[0] + '일째(하트 +' + ng[1] + ')' : '선물 모두 받음'} · 휴식권 ${tl.restLeft}/${REST_PER_MONTH}장`;
  const c = $('#gritCard');
  c.innerHTML = `<span class="flame${on ? '' : ' off'}">${ic('flame')}</span><span><span class="gc-t" style="display:block">${title}</span><span class="gc-s">${sub}</span><span class="week">${week}</span></span><span class="gc-go">${ic('chev')}</span>`;
  c.onclick = openReport;
}
/* 능력 5가지(논리력·집중력·공간지각·전략력·추리력). 게임 10개가 능력마다 2개씩 들어가고, 최근 7일 오늘의 문제 점수 평균으로 0~100 */
const AXES = ['논리력','집중력','공간지각','전략력','추리력'];
const AX_GAME = { '논리력':'fox', '집중력':'sudoku', '공간지각':'ball', '전략력':'merge', '추리력':'fleet' };
function abilities(){
  const today = dayKey(), out = {};
  for(const ax of AXES){
    const gs = GAME_IDS.filter(g => ABIL[g] === ax), v = [];
    for(let i = 0; i < 7; i++){ const x = myDay(addDays(today, -i)); if(x.best) for(const g of gs) if(x.best[g] > 0) v.push(x.best[g]); }
    out[ax] = v.length ? Math.min(100, Math.round(v.reduce((a, b) => a + b, 0) / v.length / 10)) : 0;
  }
  return out;
}
function radarSVG(ab){
  const cx = 150, cy = 128, R = 84, n = AXES.length, pt = (i, r) => { const a = (-90 + i * 360 / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  let g = '';
  [0.25, 0.5, 0.75, 1].forEach(f => { g += `<polygon points="${AXES.map((_, i) => pt(i, R * f).join(',')).join(' ')}" style="fill:none;stroke:var(--line);stroke-width:1"/>`; });
  AXES.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" style="stroke:var(--line);stroke-width:1"/>`; });
  const poly = AXES.map((k, i) => pt(i, R * Math.max(0.04, ab[k] / 100)).join(',')).join(' ');
  g += `<polygon points="${poly}" style="fill:color-mix(in srgb, var(--primary) 26%, transparent);stroke:var(--primary);stroke-width:2.5;stroke-linejoin:round"/>`;
  AXES.forEach((k, i) => {
    const [x, y] = pt(i, R * Math.max(0.04, ab[k] / 100)); g += `<circle cx="${x}" cy="${y}" r="4.5" style="fill:${GAME_META[AX_GAME[k]].col};stroke:var(--surface);stroke-width:2"/>`;
    const [lx, ly] = pt(i, R + 24), anc = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
    g += `<text x="${lx}" y="${ly - 2}" text-anchor="${anc}" style="fill:var(--ink);font-size:13px;font-weight:700">${k}</text><text x="${lx}" y="${ly + 14}" text-anchor="${anc}" style="fill:${ab[k] ? GAME_META[AX_GAME[k]].col : 'var(--sub)'};font-size:12px;font-weight:700">${ab[k] ? ab[k] : '–'}</text>`;
  });
  return `<svg class="radar" viewBox="0 0 300 260" role="img" aria-label="능력 5가지: ${AXES.map(k => k + ' ' + ab[k]).join(', ')}">${g}</svg>`;
}
function brainType(ab){
  const played = AXES.filter(k => ab[k] > 0);
  if(!played.length) return null;
  const top = played.slice().sort((a, b) => ab[b] - ab[a])[0];
  return AX_GAME[top];   /* BTYPE는 대표 게임 키로 찾는다 */
}
function openReport(){
  const d = dayState(), tl = myTL(), ab = abilities(), top = brainType(ab);
  const ls = leagueState(), lb = leagueBoard(undefined, ls.tier, tl), lpos = lb.findIndex(x => x.me) + 1, lme = lb[lpos - 1], ws = worldStat(tl.score), lvv = lvInfo();
  const ttl = [`<span class="g">${TIERS[ls.tier][0]} 리그</span>`]; if(tl.best >= 30) ttl.push('<span class="o">30일 끈기왕</span>'); else if(tl.best >= 7) ttl.push('<span class="o">7일 끈기</span>'); if(top) ttl.push(`<span>${BTYPE[top][0]}</span>`); ttl.push(`<span>${lvv.title}</span>`);
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
  const byK = {}; tl.month.forEach(x => byK[x.k] = x);
  let cal = WD.map(w => `<span class="h">${w}</span>`).join('') + '<span class="c blank"></span>'.repeat(first);
  for(let i = 1; i <= dim; i++){
    const k = dayKey(new Date(y, m, i)), x = byK[k];
    const cls = !x ? 'fut' : x.st === 'att' ? 'att' : x.st === 'rest' ? 'rest' : x.st === 'today' ? 'today' : 'miss';
    cal += `<span class="c ${cls}${k === dayKey() && cls !== 'today' ? ' today' : ''}">${i}</span>`;
  }
  const measured = AXES.filter(k => ab[k] > 0).length;
  const typeHtml = top ? `<p class="rp-kicker">최근 7일 기록으로 본 나는</p><p class="rp-type">${BTYPE[top][0]}</p><p class="rp-desc">${BTYPE[top][1]}${measured < AXES.length ? ` · 아직 ${AXES.length - measured}가지 능력은 기록이 없어요` : ''}</p>`
    : `<p class="rp-kicker">아직 측정 전이에요</p><p class="rp-type">두뇌 유형 측정 중</p><p class="rp-desc">오늘의 문제를 풀면 게임마다 맡은 능력이 쌓이고 내 두뇌 유형이 나와요.</p>`;
  let tk = ''; for(let i = 0; i < REST_PER_MONTH; i++) tk += ic('ticket', i < tl.restLeft ? '' : 'off');
  openModal(`<h3>내 두뇌 리포트</h3>${typeHtml}<div class="ttls" aria-label="내 칭호">${ttl.join('')}</div>${radarSVG(ab)}
    <div class="rp-sec"><h4>연속 출석 <small>3·7·14·30일마다 하트 선물 · 휴식권이 연속을 지켜요</small></h4>
      <div class="rp-stats"><div class="rp-stat hot"><b>${tl.streak}일</b><span>지금 연속</span></div><div class="rp-stat"><b>${tl.best}일</b><span>최장 연속</span></div><div class="rp-stat"><b>${tl.mAtt}/${tl.month.length}</b><span>${m + 1}월 출석</span></div></div>
      <div class="cal" aria-label="${m + 1}월 출석 달력">${cal}</div>
      <div class="legend2"><span><i style="background:var(--grit)"></i>출석</span><span><i style="border:2px dashed var(--grit)"></i>휴식권 사용</span><span><i style="background:var(--surface2)"></i>빠진 날</span></div>
      <div class="tickets">${tk}<span>휴식권 ${tl.restLeft}/${REST_PER_MONTH}장 · 빠진 날 자동으로 써서 연속을 지켜요 (매달 1일 충전)</span></div>
    </div>
    <div class="rp-sec"><h4>이번 주 리그 <small>${TIERS[ls.tier][0]} · ${REGION}</small></h4>
      <div class="mrow"><span>순위</span><b>${lme.score ? '30명 중 ' + lpos + '위' : '아직 기록 없음'}</b></div>
      <div class="mrow"><span>오늘 점수(시험지 5과목 합)</span><b>${fmt(tl.score)}</b></div>
      <div class="mrow tot"><span>이번 주 점수</span><b>${fmt(lme.score)}</b></div>
      <div class="mrow"><span>같은 문제 푼 사람 중</span><b>${ws.top != null ? topLabel(ws.top) : '–'}</b></div>
    </div>
    <div class="mbtns"><button class="b2" id="mClose">닫기</button><button class="b1" id="mShare">${ic('share')} 성적표 공유하기</button></div>`);
  $('#mClose').onclick = closeModal;
  $('#mShare').onclick = openShare;
}
function shareText(){
  const d = dayState(), tl = myTL(), ab = abilities(), top = brainType(ab), dt = new Date();
  const ls = leagueState(), lb = leagueBoard(undefined, ls.tier, tl), lpos = lb.findIndex(x => x.me) + 1, ws = worldStat(tl.score);
  const card = d.set.map(g => subjOf(g) + ' ' + gradeOf(examTop(g, d.best[g]))).join(' · ');
  /* 시범 운영 중엔 예시 참가자 기반 리그 순위를 공유 글에 넣지 않음 */
  const lgLine = (DEMO_NUMBERS || !(typeof frReal === 'function' && frReal())) ? (top ? `나는 '${BTYPE[top][0]}'` : '') : `🏆 ${TIERS[ls.tier][0]} 리그 ${lb[lpos - 1].score ? lpos + '위' : ''}${top ? ` · 나는 '${BTYPE[top][0]}'` : ''}`;
  return `하루퍼즐 ${dt.getMonth() + 1}/${dt.getDate()}(${WD_KO[dt.getDay()]}) 오늘의 시험지 · ${LV_KO[examLv()]}\n${card}\n오늘 ${fmt(tl.score)}점${ws.top != null && ws.top <= 50 ? ` · ${topLabel(ws.top)}` : ''}${tl.streak ? ` · 🔥${tl.streak}일` : ''}\n${lgLine ? lgLine + '\n' : ''}같은 문제, 다른 점수. 너는 몇 점?`;
}
function openShare(back, opt){ viralShare(opt || cardToday(), back); }

function closingText(){ const now = new Date(), mid = new Date(now); mid.setHours(24,0,0,0); const s = Math.floor((mid - now) / 1000); return Math.floor(s/3600) + ':' + String(Math.floor(s%3600/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
/* 하트 시트: 하트 칩, 하트가 없을 때 공통 */
function openHeartSheet(reason){
  const h = heartState(), d = dayState(), pend = giftsToday().filter(n => !d.claimed.includes(n));
  let hearts = ''; for(let i=0;i<MAX_H;i++) hearts += hi(i < h.n ? '' : 'off');
  if(h.n > MAX_H) hearts += `<span class="hx">+${h.n - MAX_H}</span>`;
  const adLeft = AD_LIMIT - d.ads, canAd = h.n < MAX_H && adLeft > 0;
  openModal(`<h3>${reason === 'empty' ? '하트가 모두 떨어졌어요' : '하트'}</h3>
    <div class="hrow" aria-label="하트 ${h.n}개">${hearts}</div>
    <p class="note">${h.n < MAX_H ? `다음 하트까지 <b class="num" id="hsT">${heartLeft(h)}</b> · 10분마다 1개씩 차요` : '하트가 가득 찼어요. 한 판에 1개씩 써요.'}</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
      ${pend.length ? `<button class="btn gold block" id="hsGift">친구가 보낸 하트 ${pend.length}개 받기</button>` : ''}
      ${canAd ? `<button class="btn ${pend.length ? 'secondary' : 'primary'} block" id="hsAd">광고 보고 하트 +1 <span class="cost">오늘 ${adLeft}회 남음</span></button>` : ''}
      <button class="btn ghost block" id="hsClose">${reason === 'empty' ? '홈으로' : '닫기'}</button></div>`);
  $('#hsClose').onclick = () => { closeModal(); if(reason === 'empty') goHome(); };
  if(reason === 'empty') sfx('error');
  if(pend.length) $('#hsGift').onclick = () => { fxPop($('#hsGift'), 'heart'); sfx('heartGet'); const dd = dayState(); dd.claimed.push(...pend); saveDay(dd); addHearts(pend.length); toast('하트 ' + pend.length + '개를 받았어요'); renderHome(); openHeartSheet(); };
  if(canAd) $('#hsAd').onclick = runAd;
}
function runAd(){
  let s = 3;
  openModal(`<h3>광고 재생 중</h3><div class="big num" id="adc">3</div><p class="note">보상형 광고 자리예요(시뮬레이션). 끝까지 보면 하트 1개를 받아요.${DEMO_NUMBERS ? ' 모두의 기부는 정식 오픈부터 쌓여요.' : ' 광고 수익 12원이 모두의 기부에 쌓여요.'}</p>`);
  const t = setInterval(() => {
    s--; const el = $('#adc'); if(el) el.textContent = s;
    if(s <= 0){ clearInterval(t); const d = dayState(); d.ads++; saveDay(d); addHearts(1); const aw = store.get('hp:adsWeek', {}), wk = weekStartKey(); aw[wk] = (aw[wk] || 0) + 1; store.set('hp:adsWeek', aw); closeModal(); sfx('heartGet'); setTimeout(() => sfx('coin'), 250); fxPop($('#heartChip'), 'heart'); toast(DEMO_NUMBERS ? '하트 +1을 받았어요' : '하트 +1 · 모두의 기부 +12원, 고마워요!'); renderHome(); }
  }, 1000);
}
function openInbox(){
  const d = dayState(), gifts = giftsToday(), frh = typeof frInboxHtml === 'function' ? frInboxHtml() : '';
  const rows = gifts.map(n => { const i = FRIENDS.findIndex(x => x.name === n), got = d.claimed.includes(n);
    return `<div class="gift${got ? ' got' : ''}">${avatar(FRIENDS[i])}<span><b>${n}</b>님이 하트를 보냈어요${got ? ' · 받음' : ''}</span>${hi()}</div>`; }).join('');
  const pending = gifts.filter(n => !d.claimed.includes(n));
  openModal(`<h3>알림함</h3><div style="margin:10px 0">${frh}${rows}</div>${frh || rows ? '' : '<p class="note">새 알림이 없어요. 친구에게 "같이 하자"를 보내 보세요.</p>'}<p class="note">받은 하트는 5개를 넘겨서도 쌓여요.</p>
    <div class="mbtns${pending.length ? '' : ' one'}"><button class="b2" id="mClose">닫기</button>${pending.length ? `<button class="b1" id="mClaim">모두 받기 · ${ic('heart')} ${pending.length}</button>` : ''}</div>`);
  $('#mClose').onclick = closeModal;
  if(typeof frInboxBind === 'function') frInboxBind(openInbox);
  if(pending.length) $('#mClaim').onclick = () => { fxPop($('#mClaim'), 'heart'); sfx('heartGet'); const dd = dayState(); dd.claimed.push(...pending); saveDay(dd); addHearts(pending.length); closeModal(); toast('하트 ' + pending.length + '개를 받았어요'); renderHome(); };
}
function welcome(){
  openModal(`<h3>오늘의 시험지가<br>도착했습니다</h3><p class="note"><b>같은 문제, 다른 점수.</b> 전 국민이 같은 퍼즐을 풀어요.</p><div class="help welcome">
    <div class="hstep"><span class="hn" style="background:var(--primary)">${ic('brain')}</span><div><b>하루 5과목</b><span>과목마다 한 문제, 자정에 바뀌어요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:var(--g-sudoku)">${ic('check')}</span><div><b>첫 판이 공식 답안(무료)</b><span>다시 풀기는 ♥1, 기록은 안 돼요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:var(--grit)">${ic('clock')}</span><div><b>요일마다 난이도</b><span>오늘은 ${examLabel()}이에요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:${(GAME_META.merge && GAME_META.merge.col) || 'var(--g-fleet)'}">${ic('trophy')}</span><div><b>성적표와 도전장</b><span>과목마다 수·우·미·양·가로 나와요.</span></div></div></div>
    <div class="mbtns one"><button class="b1" id="wGo">시험 시작</button></div><button class="btn ghost" id="wLater">둘러볼게요</button>`);
  const done = () => store.set('hp:welcome', 3);
  $('#wLater').onclick = () => { done(); closeModal(); };
  $('#wGo').onclick = () => { done(); closeModal(); quickStart(pickNext()); };
}
/* 오늘의 시험지 한 판 결과(공식 답안·다시 풀기)
   UI 검수(2026-10-04): 요약 카드 1장(성적 · 출석 · 진짜 친구 순위) + 버튼 위계(주: 다음 과목 · 반반: 다시 풀기 ♥1 / 도전장 · 글자: 결과 카드 공유 / 홈으로).
   예시 친구 순위·추월 알림은 진짜 친구가 있을 때만 보인다. */
function examFinish(win){
  const id = G.id;
  const d = dayState(), realFr = typeof frReal === 'function' && !!frReal(), r0 = myPos(d), before = r0.b.filter(x => !x.me && x.score < meScore(r0.b)).map(x => x.name);
  const firstToday = !d.att; if(firstToday){ d.att = true; saveDay(d); }
  const official = G.attempt === 1;   /* v9: 그날 첫 판만 공식 기록 */
  if(official) runClear();            /* 진행 중 판 표시 지우기(끝까지 했으니 자동 제출 필요 없음) */
  const attTxt = firstToday ? attPillHtml().replace(/<[^>]+>/g, '').trim() : '';   /* 출석 선물 처리 + 문구 */
  const gradeLine = sc => { const t = examTop(id, sc); return t == null ? '' : `${subjOf(id)} ${gradeOf(t)} · 예상 상위 ${Math.max(1, Math.round(t))}%${official ? '' : ' (다시 풀기 기준)'}`; };
  const sumCard = (main, bits) => main || bits.length ? `<div class="rsum">${main ? `<b class="${official ? 'new' : ''}">${main}</b>` : ''}<span>${bits.filter(Boolean).join(' · ')}</span></div>` : '';
  let html, score = 0, newRec = false, brk = '';
  if(win){
    const q = calcScore(); const { base, time, paw, l1, l2, l3 } = q; score = q.score;
    const prev = d.best[id];
    if(official){ d.best[id] = score; saveDay(d); newRec = true; }
    if(!d.itemDone && d.set && d.set.every(g => d.best[g] > 0)){ d.itemDone = 1; saveDay(d); itemReward([['foxAuto', 1]], '오늘의 시험지 5과목 완주'); }
    const d2 = dayState(), r1 = myPos(d2), tl2 = myTL();
    const passed = realFr ? r1.b.filter(x => !x.me && x.score < meScore(r1.b)).map(x => x.name).filter(n => !before.includes(n)) : [];
    const bits = [attTxt, firstToday && STREAK_MS.includes(tl2.streak) ? `연속 ${tl2.streak}일 달성!` : '',
      realFr ? (r1.pos < r0.pos ? `친구 순위 ${r0.pos}위 → ${r1.pos}위` : `친구 ${r1.n}명 중 ${r1.pos}위`) : '',
      passed.length ? `${passed.map(esc).join(', ')}님을 제쳤어요` : '',
      d2.set.every(g => d2.tries[g] > 0) && worldStat(tl2.score).top != null ? `오늘 시험지 예상 상위 ${Math.max(1, Math.round(worldStat(tl2.score).top))}%` : ''];
    brk = `<details class="brk"><summary>점수 자세히</summary><div><span>${l1}</span><b>${base}</b></div><div><span>${l2}</span><b>${time}</b></div><div><span>${l3}</span><b>${paw}</b></div><div><span>${examLabel()} 시험지</span><b>배율 없음</b></div><div><span>오늘 점수(5과목 공식 답안 합)</span><b>${fmt(tl2.score)}점</b></div></details>`;
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${resFace('joy')}${NG[id].winTitle || '클리어!'}</h3><div class="big" id="bigScore">0</div>
      <p class="note">${official ? '공식 답안으로 기록됐어요' : `다시 풀기 판이에요 · 공식 기록 ${fmt(prev)}점은 그대로예요`}</p>
      ${sumCard(gradeLine(score), bits)}${typeof rpFriendLine === 'function' ? rpFriendLine(id, d.best[id] || score) : ''}${brk}${chalBox(score)}`;
  } else {
    const best = d.best[id], part = official ? Math.round(examProgress() * 300) : 0;
    if(official){ d.best[id] = part; d.offDone = d.offDone || {}; d.offDone[id] = 1; saveDay(d); score = part; }
    html = `<h3 class="bad">${resFace('sad')}${NG[id].loseTitle || '이번 판은 실패'}</h3><p class="lose">${official ? '부분 점수 ' + fmt(part) + '점을 공식 기록했어요' : best ? '다시 풀기 판이에요 · 공식 기록 ' + fmt(best) + '점은 그대로예요' : '다시 풀기 판이에요'}</p>
      <p class="note">${lossProgress()} ${official ? '진행한 만큼(최대 300점) 인정돼요.' : ''}</p>
      ${sumCard(official && part ? gradeLine(part) : '', [attTxt, firstToday ? '끝까지 한 판은 출석으로 인정돼요' : ''])}${chalBox(0)}`;
  }
  const other = nextUnplayed(id), nextLv = G.lv, chalScore = dayState().best[id] || score;
  const reopen = () => { openModal(html); const b2 = $('#bigScore'); if(b2) b2.textContent = fmt(score); resBind(R); };
  const tl3 = myTL(), brag = win && firstToday && STREAK_MS.includes(tl3.streak);
  const R = {
    pri: other ? { id:'mPri', label:'다음 과목 풀기', sub:`${subjOf(other)} · ${GAMES[other].name}`, fn:() => { goHome(); quickStart(other); } }
               : { id:'mPri', label:'오늘 성적표 보기', sub:'오늘 시험지를 모두 풀었어요', fn:() => { goHome(); openShare(closeModal); } },
    pair:[ { id:'mSec', label:'다시 풀기 ' + costTag(), cls:'b2', fn:() => startGame(id, nextLv, examOpt(id)) },
      canChal() && chalScore > 0 ? { id:'mChal', label:`${ic('duel')} ${G.chal && G.chal.n ? '되갚기 도전장' : '친구에게 도전장'}`, cls:'gold', keep:true, fn:() => viralShare(cardChal(id, dayState().best[id] || score, nextLv), reopen) } : null ],
    links:[ { id:'mShareR', label:`${ic('share')}${brag ? '연속 ' + tl3.streak + '일 자랑하기' : '결과 카드 공유'}`, keep:true, fn:() => openShare(reopen) },
      { id:'mGh', label:'홈으로', fn:goHome } ]
  };
  html += resBtns(R);
  setTimeout(() => {
    openModal(html);
    if(win && !NG[id].noConfetti) fxConfetti();
    if(win) sfx('result'); else sfx('lose');
    resBind(R);
    const el = $('#bigScore');
    if(el){ const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900; let lastTk = 0;
      /* 점수가 올라가는 동안 '틱' 소리가 점점 높아지고, 다 오르면 '딩' + 금빛 폭죽 */
      const step = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(score * e));
        if(k < 1){ if(t - lastTk > 55){ lastTk = t; sfx('tick', { p:e }); } requestAnimationFrame(step); }
        else if(el.isConnected){ el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); fxBuzz(20);
          if(newRec) setTimeout(() => { const pl = $('#modal .rsum b.new'); if(pl){ sfx('newRecord'); fxPop(pl, 'spark'); } }, 380); } };
      requestAnimationFrame(step); }
  }, win ? 500 : 250);
}
function goHome(){ leavePlay(); $('#play').style.display = 'none'; $('#home').style.display = 'block'; renderHome(); window.scrollTo(0,0); }

function renderSoloPts(){
  const d = dayState(), el = $('#soloPts'); if(!el) return;
  const pct = Math.min(100, d.solo / SOLO_CAP * 100);
  el.innerHTML = `<span class="sp-i">${ic('coin')}</span><span class="sp-t"><small>오늘 솔로 포인트 · 솔로 기록(오늘 점수와 따로)</small><b class="num">${fmt(d.solo)} <em>/ ${fmt(SOLO_CAP)}</em></b><span class="sp-bar"><i style="width:${pct}%"></i></span><span class="sp-r">새 스테이지 첫 클리어 +100 · 별 하나당 +50</span></span>`;
}
function renderDuel(d){
  const live = duelLive(), n = duelWaiting(), R = duelRec();
  $('#duelHead').innerHTML = `<div class="dh-top"><span class="dh-ico">${ic('duel')}</span><div><b>1:1 대전</b><small>상대와 같은 문제를 동시에 풀고 점수로 겨뤄요</small></div></div>
    <div class="dh-rec"><div><b class="num">${d.dw}</b><span>승</span></div><div><b class="num">${d.dd}</b><span>무</span></div><div><b class="num">${d.dl}</b><span>패</span></div><div class="pts"><b class="num">+${fmt(d.duel)}</b><span>오늘 대전 포인트</span></div></div>
    <div class="dh-rw"><span class="w">승리 +${DUEL_PTS.w}</span><span class="d">무승부 +${DUEL_PTS.d}</span><span class="l">패배 +${DUEL_PTS.l}</span><span class="c">한 판 ${ic('heart')}1</span></div>
    <div class="dh-live${live ? '' : ' off'}"><i></i>${live ? (n ? `지금 대전을 기다리는 사람 <b>${n}명</b>` : '실시간 서버 연결됨 · 상대가 없으면 AI와 겨뤄요') : '지금은 실시간 연결이 안 돼요 · AI와 겨뤄요'}</div>`;
  /* 빠른 대전: 오늘 시험지 게임 중 하나(문제 씨앗과 무관한 게임 고르기라 시계로 골라도 됨) */
  const qd = $('#quickDuel');
  if(qd){ qd.innerHTML = `${ic('duel')} 빠른 대전 <small>오늘 시험지 게임 중 하나</small> ${costTag()}`;
    qd.onclick = () => { if(RM.cur){ toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'); rmOpen(); return; } const s = dayState().set.filter(g => !isAdult(g)); duelStart(s[Math.floor(Date.now() / 1000) % s.length]); }; }
  const dfr = $('#duelFriends'); if(dfr){ dfr.innerHTML = duelFriendsHtml(); duelFriendsBind(); }
  renderFilter('duel');
  const list = $('#duelList'); list.innerHTML = '';
  for(const id of filteredIds('duel')){
    if(id === ADULT_SEP){ list.insertAdjacentHTML('beforeend', adultSepHtml()); continue; }
    const r = R[id] || { w:0, d:0, l:0 }, tot = r.w + r.d + r.l, wait = duelWaiting(id);
    /* 게임마다 다른 한 줄: 게임 정의의 duelHow, 없으면 게임 방법 첫 줄 */
    const how = NG[id].duelHow || (HELP[id] && HELP[id][0] && HELP[id][0][0]) || '점수가 높으면 승리';
    const row = document.createElement('div'); row.className = 'grow panel duelrow'; row.style.setProperty('--gc', GCOL[id][1]);
    row.innerHTML = `<span class="g-art">${ART[id]()}${wait ? `<span class="live"><i></i>${wait}명</span>` : ''}</span><b class="dname">${GAMES[id].name}${tot || NG[id].cardNote ? `<small class="drec">${NG[id].cardNote ? '<b class="cnote">' + escH(NG[id].cardNote()) + '</b> ' : ''}${tot ? `${r.w}승 ${r.d}무 ${r.l}패` : ''}</small>` : ''}</b><button class="gr-go duel${rmOk(id) ? ' rooms' : ''}" aria-label="${GAMES[id].name} ${rmOk(id) ? '대전 방 목록' : '대전 시작, 하트 1개'}">${rmRowBtn(id)}</button><span class="dhow">${escH(how)}</span>`;
    const open = () => rmOk(id) ? rmList(id) : (RM.cur ? (toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'), rmOpen()) : duelStart(id));   /* 게임을 누르면 그 게임의 방 목록(22번 문서) */
    row.querySelector('.gr-go').onclick = open;
    row.querySelector('.g-art').onclick = open;
    list.appendChild(row);
  }
}
/* 대전 결과(사이트): 대전 포인트·전적 기록, 다시 대전·목록 버튼 */
function portalDuelResult(r, a, b){
  const D = G.duel;
  const id = G.id, PT = rmPts(G.lv, r, D), pts = PT.pts, d = dayState(), firstToday = !d.att, inRoom = !!(D.room && RM.cur && RM.cur.id === D.room.id);
  if(D.room) rmAfterDuel();
  d.duel += pts; d['d' + r] = (d['d' + r] || 0) + 1; d.att = true; saveDay(d);
  const R = duelRec(), x = R[id] || { w:0, d:0, l:0 }; x[r]++; R[id] = x; store.set('hp:duelRec', R);
  const tl = myTL(), win = r === 'w', why = duelWhy(r, a, b);
  let html = `${win ? '<div class="burst" aria-hidden="true"></div>' : ''}<h3 class="${r === 'l' ? 'bad' : 'ok'}">${win ? '승리!' : r === 'd' ? '무승부' : '패배'}</h3>
    ${duelSidesHtml(r, a, b)}
    ${why ? `<p class="note">${why}</p>` : ''}
    <p class="dr-lb">대전 포인트${D.room ? ' · ' + (RM_DNAME[G.lv] || '보통') : ''}</p><div class="big" id="bigScore">+0</div>${PT.bonus ? `<p class="dr-bonus">강자 보너스 +${PT.bonus} 포함</p>` : ''}
    <div class="rsum"><b>오늘 대전 ${d.dw}승 ${d.dd}무 ${d.dl}패</b><span>${['오늘 대전 포인트 ' + fmt(d.duel), firstToday ? attPillHtml().replace(/<[^>]+>/g, '').trim() : ''].filter(Boolean).join(' · ')}</span></div>
    <p class="note">${r === 'l' ? '져도 대전 포인트를 받아요. ' : ''}대전 포인트는 대전 기록에 쌓이고, 오늘 점수(시험지)와는 따로예요.</p>
    ${duelContinueHtml()}`;
  const RB = inRoom ? { pri:{ id:'mPri', label:'방으로 돌아가기', sub:'같은 상대와 다시 · ' + GAMES[id].name, fn:() => { goHome(); setTab('duel'); rmOpen(); } },
      links:[{ id:'mSec', label:'방 나가기', fn:() => { rmLeave('방에서 나왔어요'); goHome(); setTab('duel'); } }, { id:'mGh', label:'홈으로', fn:() => { goHome(); setTab('today'); } }] }
    : { pri:{ id:'mPri', label:'다시 대전 ' + costTag(), sub:GAMES[id].name, fn:() => { goHome(); duelStart(id); } },
    links:[{ id:'mSec', label:'대전 목록', fn:() => { goHome(); setTab('duel'); } }, { id:'mGh', label:'홈으로', fn:() => { goHome(); setTab('today'); } }] };
  html += resBtns(RB);
  setTimeout(() => {
    openModal(html);
    if(win){ fxConfetti(); sfx('fanfare'); } else if(r === 'd') sfx('result'); else sfx('lose');
    resBind(RB);
    duelContinueBind();
    const el = $('#bigScore'), t0 = performance.now(), dur = FXR.reduce ? 0 : 800;
    const stepN = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1; el.textContent = '+' + fmt(Math.round(pts * (1 - Math.pow(1 - k, 3))));
      if(k < 1){ sfx('tick', { p:k }); requestAnimationFrame(stepN); } else if(el.isConnected){ el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); } };
    requestAnimationFrame(stepN);
    try{ const mm = r === 'w' ? ['joy', 'sad'] : r === 'l' ? ['sad', 'joy'] : ['wow', 'wow']; document.querySelectorAll('#modal .dr-side').forEach((e, i) => toyMood(e, mm[i])); }catch(_){}   /* 이긴 쪽 기쁨 · 진 쪽 아쉬움 */
    const w = $('#modal .dr-side.win'); if(w) setTimeout(() => fxPop(w, 'gold'), 300);
  }, $('#veil').classList.contains('on') ? 0 : (win ? 500 : 250));
}

/* ===== 사이트(하루퍼즐 리그)가 엔진에 알려 주는 것: 하트·오늘 기록·결과 창·나가기 ===== */
Object.assign(HOST, {
  heartCost:true, flatMult:true,
  soloFreeNote:'솔로는 언제든 무료로 다시 할 수 있어요.',
  duelQuitNote:'대전 점수는 받지 못하고 쓴 하트도 돌아오지 않아요.',
  beforeStart(id, lv, o){
    const adv = o.adv || 0, duel = o.duel || null;
    if(o.replay) return { attempt:0 };   /* 지난 문제·받은 판·대전 판 다시 풀기: 하트 없음·기록 안 됨(portal/replay.js) */
    const freeRun = !adv && !duel && !(dayState().tries[id] > 0);   /* v9: 시험지 첫 판(공식 답안)은 무료 */
    if(!adv && !freeRun && !spendHeart()){ openHeartSheet('empty'); return false; }
    if(!adv && !freeRun) sfx('heartUse');
    let attempt = 0;
    if(!adv && !duel){ const d = dayState(); d.tries[id]++; saveDay(d); attempt = d.tries[id]; }
    if(attempt === 1) runMark(id);   /* 공식 답안 시작: 진행 중 판 표시(새로고침·앱 종료 때 부분 점수로 제출) */
    return { attempt };
  },
  showPlay(){ $('#home').style.display = 'none'; $('#play').style.display = 'block'; },
  subtitle:(L, attempt, ex) => attempt === 1 ? `${subjOf(G.id) ? subjOf(G.id) + ' · ' : ''}${L.name}${ex} · 공식 답안` : `다시 풀기 · 기록 안 됨 · ${L.name}${ex}`,
  quitInfo:() => ({
    note:G.attempt === 1 ? '지금 나가면 여기까지 진행한 만큼(최대 300점)만 공식 점수로 기록돼요. 오늘 이 문제의 공식 답안은 한 번뿐이에요.' : '연습 판이라 나가도 공식 기록은 그대로예요.',
    label:G.attempt === 1 ? '여기서 제출하기' : '다시 풀기 그만하기',
    onQuit(){ if(G.attempt === 1){ runClear(); const d = dayState(), part = Math.round(examProgress() * 300); d.best[G.id] = part; d.offDone = d.offDone || {}; d.offDone[G.id] = 1; if(!d.att) d.att = true; saveDay(d); toast(GAMES[G.id].name + ' 부분 점수 ' + fmt(part) + '점을 기록했어요'); } }
  }),
  finish(win){ if(G.adv) advFinish(win); else examFinish(win); },
  exit(){ goHome(); },
  canDuel(){ if(heartState().n < 1){ openHeartSheet('empty'); return false; } return true; },
  duelRewardHtml:() => `<div class="dh-rw sm"><span class="w">승리 +${DUEL_PTS.w}</span><span class="d">무 +${DUEL_PTS.d}</span><span class="l">패배 +${DUEL_PTS.l}</span></div>`,
  duelResult:(r, a, b) => portalDuelResult(r, a, b),
  historyGuard:true,   /* 뒤로가기: 창 닫기 → 그만하기 확인 → 오늘 탭 → 두 번 눌러 나가기 */
  back(){ if(TAB !== 'today'){ setTab('today'); return true; } return false; }
});

/* ===== 공식 답안 보호(UI 검수 P0, 2026-10-04) =====
   공식 답안(그날 첫 판)은 시작하는 순간 기회를 쓰므로, 진행 중 판을 'hp:run'에 적어 두고
   화면이 숨겨지거나 닫힐 때(pagehide · visibilitychange hidden) 그 순간의 부분 점수(진행률 × 300, 결정 151)를 공식 기록으로 저장한다.
   판을 계속하면 끝날 때 결과가 덮어쓴다. 다시 열었을 때 표시가 남아 있으면 마지막 부분 점수로 제출하고 안내한다.
   (이어 풀기는 게임마다 상태 저장이 필요해서 이번엔 하지 않음) */
function runMark(id){ store.set('hp:run', { day:dayKey(), id, t0:Date.now(), part:0 }); }
function runClear(){ store.set('hp:run', null); }
function runLive(){ const r = store.get('hp:run', null); return r && G && !G.over && !G.adv && !G.duel && G.attempt === 1 && G.id === r.id ? r : null; }
function runSave(r, part){   /* 그날 기록에 부분 점수를 공식 기록으로 넣기(날짜가 바뀌었으면 그날 기록에) */
  const key = 'hp:day:' + r.day, d = r.day === dayKey() ? dayState() : store.get(key, null);
  if(!d || !d.best) return;
  d.best[r.id] = Math.max(0, part); d.offDone = d.offDone || {}; d.offDone[r.id] = 1;
  store.set(key, d);
}
function runSnap(){ const r = runLive(); if(!r) return; try{ r.part = Math.round(examProgress() * 300); r.at = Date.now(); store.set('hp:run', r); runSave(r, r.part); }catch(_){} }
addEventListener('pagehide', runSnap);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') runSnap(); });
setInterval(() => { const r = runLive(); if(!r) return; try{ const p = Math.round(examProgress() * 300); if(p !== r.part){ r.part = p; store.set('hp:run', r); } }catch(_){} }, 2000);   /* 갑자기 꺼져도 최근 진행률이 남게 */
/* 다시 열었을 때: 끝나지 않은 공식 답안이 있으면 마지막 부분 점수로 제출 */
const RUN_LEFT = (() => {
  const r = store.get('hp:run', null); if(!r || !r.id || !GAMES[r.id]) { if(r) runClear(); return null; }
  runSave(r, r.part || 0); runClear();
  return r;
})();
function runNotice(){
  const r = RUN_LEFT; if(!r) return;
  const msg = `지난번 ${GAMES[r.id].name} 판은 부분 점수 ${fmt(r.part || 0)}점으로 제출됐어요`;
  if($('#veil').classList.contains('on') || (G && !G.over)){ toast(msg); return; }
  openModal(`<h3>공식 답안 제출 안내</h3><div class="runsub"><b>${GAMES[r.id].name} · 부분 점수 ${fmt(r.part || 0)}점</b><span>지난번 판이 끝나기 전에 화면이 닫혀서, 그때까지 진행한 만큼(최대 300점)을 공식 답안으로 제출했어요.</span></div>
    <p class="note">같은 문제는 다시 풀기(♥1)로 더 풀 수 있지만 기록은 바뀌지 않아요.</p><div class="mbtns one"><button class="b1" id="mClose">확인</button></div>`);
  $('#mClose').onclick = closeModal;
}
setTimeout(runNotice, 1200);
navInit();
/* 화면 글자 용어집(대전 포인트) */
HOST.duelQuitNote = '대전 포인트는 받지 못하고 쓴 하트도 돌아오지 않아요.';

let lastSig = '', ABOVE = null;
/* 추월 알림: 친구가 나를 제치면 여우가 알려줌 */
function checkOvertake(){
  const d = dayState(); if(!myTotal(d)){ ABOVE = null; return; }
  const b = board(d), mi = b.findIndex(x => x.me), above = b.slice(0, mi).filter(x => x.score > 0 && !(DEMO_NUMBERS && x.sample)).map(x => x.name);   /* 예시 친구는 추월 알림 안 함 */
  if(ABOVE){ const nw = above.filter(n => !ABOVE.includes(n)); if(nw.length) toast(nw[0] + '님이 당신을 제쳤어요! 가만있을 거예요? 🦊'); }
  ABOVE = above;
}
function homeSig(){ const d = dayState(), h = heartState(); return [dayKey(), h.n, d.ads, d.att ? 1 : 0, RANK_MODE, TAB === 'duel' ? duelWaiting() + ':' + ROOM_STATE : '', FRIENDS.map(friendScore).join(','), typeof frSig === 'function' ? frSig() : '', TAB === 'duel' && typeof rmSig === 'function' ? rmSig() : ''].join('|'); }
function tickHome(){
  const h = heartState();
  const ht = $('#hsT'); if(ht) ht.textContent = heartLeft(h);
  if($('#home').style.display === 'none' || $('#veil').classList.contains('on')) return;
  const sig = homeSig();
  if(sig !== lastSig){ lastSig = sig; checkOvertake(); renderHome(); return; }
  const t = $('#hTimer'); if(t) t.textContent = heartLeft(h);
  const cl = $('#closing'); if(cl) cl.textContent = closingText();
  const pa = $('#poolAmt'), pb = $('#poolAmt2'), lc = $('#lgClose'), pv = fmt(prizePool()) + '원';
  if(pa) pa.textContent = pv; if(pb) pb.textContent = pv; if(lc) lc.textContent = weekLeft();
}
playChromeInit();
document.querySelectorAll('#dock button').forEach(b => { b.innerHTML = b.innerHTML.replace(/ICO_(\w+)/, (_, n) => ic(n)); b.onclick = () => setTab(b.dataset.tab); });
$('#meBtn').onclick = () => setTab('me');
$('#strip').onclick = () => setTab('me');
$('#pool').onclick = openDonateInfo;
{ const pr = $('#proto'); if(pr) pr.hidden = !DEV_TOOLS; }   /* 테스트 도구는 ?dev=1 일 때만 */
$('#devWeek').onclick = () => { const s0 = leagueState(); s0.week = addDays(weekStartKey(), -7); store.set('hp:league', s0); showLeagueResult(leagueRollover()); };
$('#advPromo').onclick = () => setTab('adv'); $('#duelPromo').onclick = () => setTab('duel');
$('#meSound').onclick = () => openSoundSheet(); $('#meSound').textContent = '소리·글씨'; $('#meFriends').onclick = () => frHub(); $('#meReport').onclick = openReport; $('#meShare').onclick = () => openShare(closeModal);
if(!store.get('hp:advLv', 0)) store.set('hp:advLv', lvInfo().L);
$('#devAdv').onclick = () => { GAME_IDS.forEach(g => store.set(advKey(g), null)); store.set('hp:advLv', 1); renderHome(); toast('솔로 기록을 초기화했어요'); };
$('#devLvUp').onclick = () => { const L = lvInfo().L + 1; showCelebrations([{ kind:'level', L, from:L - 1, hearts:1 }], () => {}); };
$('#devCh').onclick = () => showCelebrations([{ kind:'chapter', id:'fox', c:1 }], () => {});
$('#heartChip').onclick = () => openHeartSheet();
$('#inboxBtn').innerHTML = MAIL_G + '<span class="badge" id="badge">0</span>'; $('#inboxBtn').onclick = openInbox;
$('#devFill').onclick = () => { const h = heartState(); if(h.n < MAX_H){ h.n = MAX_H; h.t = Date.now(); store.set('hp:hearts', h); } renderHome(); toast('하트를 채웠어요'); };
$('#devReset').onclick = () => { store.set('hp:day:' + dayKey(), null); renderHome(); toast('오늘 기록을 초기화했어요'); };
$('#devWelcome').onclick = () => { GAME_IDS.forEach(g => store.set('hp:help:' + g, 0)); welcome(); };
$('#tabDay').onclick = () => { RANK_MODE = 'day'; renderHome(); };
$('#tabMonth').onclick = () => { RANK_MODE = 'week'; renderHome(); };
$('#devHist').onclick = () => {
  const today = dayKey(), r = mulberry(seedFrom('hist' + today));
  for(let i = 1; i <= 14; i++){
    const k = addDays(today, -i);
    if(i === 4 || i === 11){ store.set('hp:day:' + k, null); continue; }
    const best = {}; for(const g of GAME_IDS) best[g] = r() < 0.75 ? Math.round((350 + r() * 750) / 10) * 10 : 0;
    const set = todaySet(k); for(const g of GAME_IDS) if(!set.includes(g)) best[g] = 0;
    store.set('hp:day:' + k, { best, tries:{}, sent:{}, claimed:[], ads:0, att:true, set, solo:r() < .5 ? 250 : 0, duel:r() < .4 ? 400 : 0 });
  }
  renderHome(); toast('지난 2주 기록을 만들었어요(2일은 휴식권)');
};
$('#devHistClr').onclick = () => { const today = dayKey(); for(let i = 0; i <= 120; i++) store.set('hp:day:' + addDays(today, -i), null); renderHome(); toast('출석 기록을 모두 지웠어요'); };
