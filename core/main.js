/* 공용 본체: 게임 목록·점수·리그·홈 화면·게임 시작/끝·결과 창 */

const MAX_H = 5, REGEN_MS = 10*60*1000, AD_LIMIT = 5;
const GAMES = {
  fox:    { name:'여우 자리 찾기', ico:'🦊', rule:'색깔 구역마다 여우를 1마리씩. 같은 줄에 둘 수 없고, 대각선으로도 붙으면 안 돼요.' },
  sudoku: { name:'스도쿠',       ico:'🔢', rule:'가로줄, 세로줄, 굵은 칸 안에 1부터 9까지 한 번씩 넣어요. 메모를 켜면 예비 숫자를 적어둘 수 있어요.' },
  ball:   { name:'별빛 구슬', ico:'🌟', rule:'판을 누른 채 끌어서 조준하고 손을 떼면 구슬이 날아가요. 아래 ◀ ▶로 조금씩 맞추고 [발사]를 눌러도 돼요. 젤리 블록과 둥근 범퍼는 숫자만큼 맞히면 깨지고, 별 조각을 먹으면 다음 턴 구슬이 1개 늘어요. 시계(한 턴 멈춤)·방패(아래 면은 막힘)·물감(같은 색 체력 25% 감소)·폭죽(불꽃 구슬 4개) 블록이 있어요. 아이템은 판마다 1번씩: 관통 구슬·망원경·밀어 올리기. 블록이 바닥선에 닿으면 별빛 방어막이 한 번 막아 주고, 두 번째엔 끝나요.' },
  fleet:  { name:'함대 결전', ico:'⚓', rule:'10×10 바다에 함선 5척(5·4·3·3·2칸)을 숨기고, 한 발씩 쏘되 명중하면 한 번 더, 빗나가면 턴이 넘어가요. 상대 함대를 먼저 모두 격침하면 이겨요. 실시간 대전 상대가 없으면 AI와 겨뤄요.' },
  tower:  { name:'숲 지킴이', ico:'🌰', rule:'길을 따라 몰려오는 벌레·짐승에게서 도토리 창고를 지켜요. 아래 씨앗 카드를 누르고 풀밭 칸을 누르면 식물이 바로 자라요(솔방울 나무·가시 덤불·반딧불 등·독버섯). 같은 씨앗을 그 식물 위에 또 심으면 3단계까지 커져요. 퇴비 카드는 식물 하나를 거름으로 돌려 새 씨앗 카드를 줘요. 무리를 하나 막을 때마다 카드 2장, 햇살 게이지가 차면 1장을 더 받아요(손패 최대 6장). 요정 도움(소나기·덩굴 올가미·돌개바람)은 판마다 정해진 횟수만 써요. 도토리 10개를 모두 뺏기면 실패예요.' }
};
const LEVELS = {
  easy:   { name:'쉬움',   mult:0.6, fox:{N:8, limit:180}, sudoku:{givens:38, limit:420}, ball:{rows:10, like:5, limit:0} },
  normal: { name:'보통',   mult:1.0, fox:{N:9, limit:300}, sudoku:{givens:30, limit:600}, ball:{rows:14, like:12, limit:0} },
  hard:   { name:'어려움', mult:1.4, fox:{N:10, limit:480}, sudoku:{givens:0,  limit:900}, ball:{rows:18, like:22, limit:0} }
};
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
const ABIL = { fox:'논리력', sudoku:'집중력', ball:'공간지각', tower:'전략력', fleet:'추리력' };
const BTYPE = {
  fox:['논리형 두뇌','규칙 사이의 빈틈을 정확히 찾아내요'],
  sudoku:['집중형 두뇌','긴 문제도 끝까지 흐트러지지 않아요'],
  ball:['공간형 두뇌','각도와 궤적을 머릿속으로 그려내요'],
  tower:['전략형 두뇌','한 수 앞을 내다보고 자원을 배분해요'],
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
const topTxt = t => t == null ? '' : t <= 50 ? '상위 ' + t + '%' : '상위 ' + Math.round(t) + '% · 오늘 더 올려 봐요';
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
  const list = FRIENDS.map(f => pack(timeline(friendDay(f)), f));
  list.push(pack(myTL(), { name:'나', av:'🦊', me:true }));
  list.sort((a,b) => b.score - a.score || (a.me ? 1 : b.me ? -1 : 0));
  return list;
}
const meScore = b => b.find(x => x.me).score;






/* ===== 셸(홈·시트·결과) — 디자인·UX·기획 감사 반영 ===== */
const SVG = {
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5l-1.3-1.2C5.4 14.5 2 11.4 2 7.6 2 4.5 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.5 22 7.6c0 3.8-3.4 6.9-8.7 11.7z"/></svg>',
  heartO:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 19.5l-1-.9C5.9 14 3 11.2 3 7.8 3 5.1 5.1 3 7.7 3c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2C18.9 3 21 5.1 21 7.8c0 3.4-2.9 6.2-8 10.8z"/></svg>',
  paw:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6.5" cy="9.5" r="2.2"/><circle cx="10.5" cy="5.8" r="2.2"/><circle cx="15.3" cy="6.3" r="2.2"/><circle cx="18.7" cy="10.4" r="2"/><path d="M12.2 11c3 0 6 4.1 6 6.6 0 2-1.7 2.6-3 2.6-1.2 0-2-.8-3-.8s-1.8.8-3 .8c-1.3 0-3-.6-3-2.6 0-2.5 3-6.6 6-6.6z"/></svg>',
  fox:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 2.5L8.5 8h7l6-5.5-.8 9.3L12 21.5l-8.7-9.7z"/><path d="M5.5 12.2l6.5 7.3 6.5-7.3-3.4.4L12 15l-3.1-2.4z" fill="#fff" opacity=".92"/><circle cx="8.8" cy="11" r="1.2" fill="#2A1A10"/><circle cx="15.2" cy="11" r="1.2" fill="#2A1A10"/><circle cx="12" cy="17.3" r="1.1" fill="#2A1A10"/></svg>',
  sudoku:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.3"/><rect x="9.5" y="3" width="5" height="5" rx="1.3" opacity=".55"/><rect x="16" y="3" width="5" height="5" rx="1.3"/><rect x="3" y="9.5" width="5" height="5" rx="1.3" opacity=".55"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.3"/><rect x="16" y="9.5" width="5" height="5" rx="1.3" opacity=".55"/><rect x="3" y="16" width="5" height="5" rx="1.3"/><rect x="9.5" y="16" width="5" height="5" rx="1.3" opacity=".55"/><rect x="16" y="16" width="5" height="5" rx="1.3"/></svg>',
  ball:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="3" width="5.5" height="5" rx="1.4"/><rect x="9.25" y="3" width="5.5" height="5" rx="1.4" opacity=".55"/><rect x="16" y="3" width="5.5" height="5" rx="1.4"/><circle cx="12" cy="16" r="4.6"/></svg>',
  tower:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.8 10.6h12.4c.2 6.4-2.8 10.6-6.2 11.6-3.4-1-6.4-5.2-6.2-11.6z"/><path d="M4.2 9.6c0-3.8 3.4-6.2 7.8-6.2s7.8 2.4 7.8 6.2z" opacity=".6"/><path d="M11 3.6V1.8h2v1.8z"/></svg>',
  fleet:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2.5h2V6h3.2l1 4.2H6.8l1-4.2H11z"/><path d="M2.6 11.6h18.8l-2.7 6.3a2 2 0 0 1-1.8 1.1H7.1a2 2 0 0 1-1.8-1.1z"/><path d="M1.8 21.6c1.7 0 1.7-1 3.4-1s1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3"/><circle cx="12" cy="17.8" r=".6" fill="currentColor"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  flame:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.3 1.8c.6 3.4 2.6 5.2 4.3 7 1.6 1.7 3.1 3.6 3.1 6.4A7.6 7.6 0 0 1 12 22.6a7.6 7.6 0 0 1-7.7-7.4c0-2.6 1.3-4.7 3-6.3.2 1.8 1 3.1 2.4 3.9-.3-3.9.6-7.9 2.6-11z"/><path d="M12 22.6a3.6 3.6 0 0 1-3.6-3.6c0-2.1 1.8-3.3 2.6-5.3.9 1.4 4.6 2.8 4.6 5.3a3.6 3.6 0 0 1-3.6 3.6z" fill="#FFD27A"/></svg>',
  brain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 9.5a3 3 0 0 0 .8 2A3.2 3.2 0 0 0 4 13.7 3.2 3.2 0 0 0 6.5 17 3 3 0 0 0 9.5 20.5 2.5 2.5 0 0 0 12 18V6a2.5 2.5 0 0 0-3-2.5z"/><path d="M15 3.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 2.8 3 3 0 0 1-.8 2 3.2 3.2 0 0 1 .8 2.2 3.2 3.2 0 0 1-2.5 3.3 3 3 0 0 1-3 3.5A2.5 2.5 0 0 1 12 18V6a2.5 2.5 0 0 1 3-2.5z"/></svg>',
  ticket:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6z"/><path d="M9.5 12.2l1.7 1.7 3.4-3.6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10v2h3v2.5A4.5 4.5 0 0 1 16.3 12 5 5 0 0 1 13 14.8V17h3v4H8v-4h3v-2.2A5 5 0 0 1 7.7 12 4.5 4.5 0 0 1 4 7.5V5h3zm0 4H6v.5a2.5 2.5 0 0 0 1.2 2.1A6 6 0 0 1 7 8zm10 0v1a6 6 0 0 1-.2 1.6A2.5 2.5 0 0 0 18 7.5V7z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 4 5.7 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.7-4-9s1.4-6.5 4-9z"/></svg>',
  coin:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#FFC93C" stroke="#9A5A00" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#FFF1B0" stroke-width="1.6"/><path d="M9.5 9l1.3 6 1.2-4 1.2 4 1.3-6" fill="none" stroke="#9A5A00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  duel:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 2.5l6.8 6.8-1.9 1.9L2.5 5.3V2.5zM20.5 2.5v2.8l-9 9 1.4 1.4-1.4 1.4-2-2-2.8 2.8.7 2.1-1.4 1.4-2.1-2.8-2.8-2.1 1.4-1.4 2.1.7 2.8-2.8-2-2 1.4-1.4 1.4 1.4 9-9zM13.9 13.7l1.9-1.9 2.8 2.8 2.1-.7 1.4 1.4-2.8 2.1-2.1 2.8-1.4-1.4.7-2.1z"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/></svg>'
};
const ic = (n, cls = '') => `<span class="ico ${cls}" aria-hidden="true">${SVG[n]}</span>`;
const costTag = () => `<span class="cost">${ic('heart')}1</span>`;
const GAME_META = {
  fox:{ col:'var(--g-fox)', time:'약 2분' }, sudoku:{ col:'var(--g-sudoku)', time:'약 10분' },
  ball:{ col:'var(--g-ball)', time:'약 3분' }, tower:{ col:'var(--g-tower)', time:'약 4분' }, fleet:{ col:'var(--g-fleet)', time:'약 5분' }
};
const GAME_IDS = ['fox','sudoku','ball','tower','fleet'];
/* 새 게임 모듈(동물 삼총사·네모 그림·블록 채우기·카드 짝·숫자 합치기)이 여기에 등록된다. ngRegister()가 GAMES·GCOL·HELP 등에 합친다. */
/* ===================== 난이도 v2: 개념 사이클 (기획팀, 2026-09-30 · 17·18번 문서) =====================
   벤치마크: 로얄 매치(약 8판마다 새 블록, 5·9로 끝나는 판 어려움, 10판마다 아주 어려움), 컷 더 로프(박스마다 새 기믹),
   닌텐도 기승전결(소개 → 전개 → 반전 → 정리). → 5판마다 새 개념 하나.
   챕터(10판) 자리 k: 1 새 규칙 소개(쉬움) · 2~3 익히기 · 4 섞기(이전 규칙과) · 5 어려움 · 6 변주 소개(쉬움) · 7~8 규칙+변주 · 9 쉬어가기 · 10 보스(규칙+이전 규칙+변주, 아주 어려움)
   챕터 1은 기본 규칙만(6부터 첫 변주). 새 규칙은 11·21·31·41, 변주는 6·16·26·36·46. 51부터는 리믹스(배운 규칙 2개를 챕터마다 바꿔 섞음).
   게임 쪽 계약: 개념 목록 = NG[id].concepts 또는 CONCEPTS[id] = { order:[새 규칙 키 4개], info:{키:{name,desc}}, twists:[변주 키…], twInfo?:{키:{name,desc}} }
                 또는 이미 등장 판이 정해진 게임은 { fixed:[{ at, key, name, desc }] } (카드·표시만).
                 각 게임의 stage(n)/advLevel은 planOf(id, n)을 읽어 mj(켜진 규칙)·tw(변주)·easy/hard/boss를 반영한다. */
const TWISTS = {
  flash:{ name:'번개', desc:'시간(또는 기준 이동·턴)이 짧아요. 빠르고 정확하게!' },
  tight:{ name:'외줄 타기', desc:'실수는 딱 한 번까지만 허용돼요.' },
  bare:{ name:'맨손', desc:'힌트와 아이템 없이 오직 실력으로 풀어요.' }
};
const CONCEPTS = {};
function cyclePlan(n, majors, twists){
  const c = Math.ceil(n / 10), k = n - (c - 1) * 10, M = majors || [], T = twists || [];
  const twKey = T.length ? T[(c - 1) % T.length] : null;
  const o = { c, k, mj:[], tw:null, twKey, intro:null, introKind:null, hard:k === 5, boss:k === 10, easy:k === 1 || k === 6 || k === 9, remix:false };
  const twOn = k === 6 || k === 7 || k === 8 || k === 10;
  if(c === 1){ if(twOn) o.tw = twKey; if(k === 6 && twKey){ o.intro = twKey; o.introKind = 'twist'; } return o; }
  if(c <= 1 + M.length && c <= 5){
    const cur = M[c - 2], prev = c > 2 ? M[c - 3] : null;
    o.mj = k === 6 ? [] : (k === 4 || k === 10) && prev ? [cur, prev] : [cur];
    if(twOn) o.tw = twKey;
    if(k === 1){ o.intro = cur; o.introKind = 'major'; }
    if(k === 6 && twKey){ o.intro = twKey; o.introKind = 'twist'; }
    return o;
  }
  /* 리믹스 */
  o.remix = true;
  if(M.length){
    const r = mulberry(seedFrom('remix:' + c)), a = Math.floor(r() * M.length); let b = Math.floor(r() * M.length); if(M.length > 1 && b === a) b = (a + 1) % M.length;
    const A = M[a], B = M[b];
    o.mj = { 1:[A], 2:[B], 3:[A], 4:[A, B], 5:[A, B], 6:[A], 7:[B], 8:[A, B], 9:[B], 10:[A, B] }[k].filter((x, i, arr) => arr.indexOf(x) === i);
  }
  if(k === 6 || k === 7 || k === 10) o.tw = twKey;
  return o;
}
function conceptsOf(id){ return (NG[id] && NG[id].concepts) || CONCEPTS[id] || null; }
function planOf(id, n){
  const C = conceptsOf(id);
  if(!C || C.fixed){ const k = n - (Math.ceil(n / 10) - 1) * 10, f = C && C.fixed ? C.fixed.find(x => x.at === n) : null;
    return { c:Math.ceil(n / 10), k, mj:[], tw:null, intro:f ? f.key : null, introKind:f ? 'major' : null, hard:k === 5, boss:k === 10, easy:k === 1 || k === 6 || k === 9, remix:false, fixed:true }; }
  return cyclePlan(n, C.order, C.twists);
}
function conceptInfo(id, key){
  const C = conceptsOf(id) || {};
  if(C.fixed){ const f = C.fixed.find(x => x.key === key); return f || null; }
  return (C.info && C.info[key]) || (C.twInfo && C.twInfo[key]) || TWISTS[key] || null;
}
/* 스테이지 설명에 붙는 한 줄: "새 규칙: 바위 칸" / "변주: 번개" / "리믹스: A + B" */
function conceptLine(id, n){
  const p = planOf(id, n), nm = k => (conceptInfo(id, k) || {}).name || k, bits = [];
  if(p.intro) bits.push((p.introKind === 'twist' ? '새 변주' : '새 규칙') + ': ' + nm(p.intro));
  else if(p.mj.length) bits.push((p.remix ? '리믹스' : '규칙') + ': ' + p.mj.map(nm).join(' + '));
  if(p.tw && p.intro !== p.tw) bits.push('변주: ' + nm(p.tw));
  if(p.boss) bits.unshift('보스(아주 어려움)'); else if(p.hard) bits.unshift('어려움');
  return bits.join(' · ');
}
function stageClass(id, n){ const p = planOf(id, n); return (p.boss ? ' xhard' : p.hard ? ' hard' : '') + (p.intro ? ' newc' : ''); }
/* 새 개념을 처음 만나는 판: 시작 전에 규칙 카드 한 장 */
function conceptCard(id, n, go){
  const p = planOf(id, n), inf = conceptInfo(id, p.intro); if(!inf){ go(); return; }
  const tw = p.introKind === 'twist';
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">${tw ? 'NEW TWIST' : 'NEW RULE'}</p><div class="ttl">${tw ? '새 변주' : '새 규칙'} · ${inf.name}</div>
    <div class="ncard" style="--gc:${GCOL[id][1]}"><span class="nc-ic">${ic(id)}</span><p>${inf.desc}</p></div>
    <p class="note">스테이지 ${n} · ${GAMES[id].name}<br>${tw ? '익숙한 판에 조건 하나가 더해져요.' : p.fixed ? '이 판부터 새로 나와요. 챕터 끝 보스에서 제대로 시험해요!' : '첫 판은 이 규칙만 나와서 쉬워요. 챕터 끝 보스에서 제대로 시험해요!'}</p>
    <div class="mbtns one"><button class="b1" id="ncGo">도전!</button></div>`);
  $('#modal').classList.add('celebrate'); sfx('fanfare');
  $('#ncGo').onclick = () => { store.set('hp:seenC:' + id + ':' + p.intro, 1); closeModal(); go(); };
}

const NG = {};
/* 모드 v6: 오늘 = 10게임 중 날짜별 5개, 솔로 = 새 스테이지 첫 클리어 점수, 대전 = 승패 점수 */
const DAILY_N = 5, SOLO_CAP = 1000, DUEL_PTS = { w:400, d:250, l:150 };
/* ===================== 오늘의 시험지 v9 (기획팀 × 마케팅팀 "같은 문제, 다른 점수.", 2026-09-30) =====================
   · 매일 5과목(논리·집중·공간·전략·추리) — 과목마다 게임 2개 중 1개, 같은 게임 3일 넘게 연속 금지
   · 전 국민 같은 문제: 문제 씨앗 = 날짜 + 게임(판 번호·난이도 없음). 난이도는 요일로 고정(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움), 배율 없음
   · 공식 답안 = 게임마다 그날 첫 판(무료). 다시 풀기는 같은 문제 연습(♥1, 기록 없음). 실패·그만하기는 진행률 × 300 부분 점수
   · 오늘 점수 = 5과목 공식 점수 합(솔로·대전·출석 보너스를 더하지 않음 → 누구와도 그대로 비교)
   · 성적표: 같은 문제를 푼 사람 중 등수로 과목마다 수·우·미·양·가 (서버 전까지는 분포 가정)
   · 출석은 점수가 아니라 선물(연속 3·7·14·30…일 하트)과 휴식권으로만 */
const SUBJ = [['논리', ['fox','nono']], ['집중', ['sudoku','memory']], ['공간', ['ball','block']], ['전략', ['tower','merge']], ['추리', ['fleet','match']]];
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
function examProgress(){ try{ if(G.id === 'fleet') return (G.enSunk ? G.enSunk.length : 0) / 5; }catch(_){} return gameProg(); }
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
  const base = (kk, i) => SUBJ[i][1][mulberry(seedFrom('subj:' + kk + ':' + i))() < .5 ? 0 : 1];
  const last = SUBJ.map(() => [null, 0]); let out = null;
  for(let j = 40; j >= 0; j--){
    const kk = addDays(k, -j);
    out = SUBJ.map((x, i) => { let g = base(kk, i); if(last[i][0] === g && last[i][1] >= 3) g = x[1].find(y => y !== g);
      last[i] = [g, last[i][0] === g ? last[i][1] + 1 : 1]; return g; });
  }
  TSET_MEMO[k] = out; return out.slice();
}

const soloPts = st => 100 + 50 * st;
const isStage = id => id === 'ball' || id === 'tower';
const FRIEND_COL = ['#FFD6E0','#FFE7A8','#C9F0DE','#CFE0FF','#E4D4FF','#FFDCC2'];
const HELP = {
  fox:[['색깔당 여우 1마리','같은 색 구역마다 여우를 1마리씩, 행과 열마다도 1마리씩 놓아요. 여우끼리는 대각선으로도 붙으면 안 돼요.'],['한 번 누르면 ✕, 두 번이면 여우','빈칸을 누르면 ✕, ✕를 한 번 더 누르면 여우예요. 손가락으로 끌면 ✕를 여러 칸에 칠해요.'],['틀리면 기회 별 1개','틀린 자리는 주황 ✕가 되고 위쪽 기회 별이 하나 꺼져요. 별 3개를 다 잃으면 끝. 힌트·자동 ✕는 가진 개수에서 한 판에 1번씩만 써요.']],
  sudoku:[['1~9를 한 번씩','가로줄, 세로줄, 굵은 3×3 칸마다 1부터 9까지 한 번씩 넣어요.'],['메모로 예비 숫자','메모를 켜면 작은 예비 숫자를 적어둘 수 있어요. 메모는 실수가 아니에요.'],['실수는 3번까지','틀린 숫자는 빨갛게 남아요. 3번 틀리면 끝나요. 힌트는 3번 쓸 수 있어요.'],['솔로의 새 규칙','솔로에서는 대각선·짝수 칸·창문·부등호 같은 규칙과 변주가 5판마다 하나씩 더해져요. 판 위 표시를 확인해요.']],
  ball:[['끌어서 조준, 떼면 발사','판을 누른 채 끌면 점선이 보여요. 손을 떼면 구슬이 날아가요. 아래 ◀ ▶로 조금씩 맞추고 [발사]를 눌러도 돼요.'],['숫자만큼 맞혀 깨기','젤리 블록과 둥근 범퍼는 숫자만큼 맞히면 깨져요. 별 조각을 먹으면 다음 턴 구슬 +1. 시계·방패·물감·폭죽 블록은 깨거나 맞힐 때 특별한 일이 생겨요.'],['바닥선을 지켜요','턴마다 블록이 한 줄 내려와요. 바닥선에 닿으면 별빛 방어막이 한 번 막아 주고, 두 번째엔 끝나요. 관통 구슬·망원경·밀어 올리기는 판마다 1번씩.']],
  fleet:[['함대를 숨겨요','배를 끌어 옮기고, 탭하면 방향이 바뀌어요. 함선은 5척(5·4·3·3·2칸)이고 무작위 배치도 있어요.'],['맞히면 한 번 더','적 해역 칸을 눌러 조준하고 발사해요(같은 칸을 한 번 더 눌러도 발사). 명중(불꽃)하면 계속 쏘고, 빗나가면(물보라) 상대 차례예요. 한 척을 모두 맞히면 격침!'],['먼저 다 격침하면 승리','실시간 대전은 한 턴 5초, 안 쏘면 차례가 넘어가요. 상대가 없으면 AI와 붙어요. 적게 쏠수록, 내 배가 많이 남을수록 점수가 높아요.'],['솔로는 5판마다 새 규칙','섬·레이더·연발 포격·침묵 함대, 그리고 번개·안개 같은 변주가 차례로 나와요. 이번 판 규칙은 위쪽 작은 표시에 보여요. 솔로에선 격침한 적 배 둘레가 자동으로 "배 없음"으로 칠해져요(적 배는 서로 붙어 있지 않아요).']],
  tower:[['씨앗 카드를 심어요','아래 카드를 누르고 풀밭 칸을 누르면 바로 자라요. 흙길·바위·개울 칸에는 못 심어요. 심은 식물을 누르면 닿는 거리가 보여요.'],['같은 씨앗은 겹쳐 키우기','같은 종류를 그 식물 위에 또 심으면 3단계까지 커져요. 퇴비 카드는 식물 하나를 거름으로 돌리고 새 씨앗 카드를 줘요.'],['도토리 창고를 지켜요','[시작 ▶]을 누르면 무리가 와요. 창고에 닿으면 도토리를 훔쳐 가요. 소나기·덩굴 올가미·돌개바람은 판마다 정해진 횟수만 쓸 수 있어요.']]
};
function maxPts(id, lv){ return Math.round(1000 * levelOf(id, lv).mult); }
function myPos(d){ const b = board(d); return { b, pos:b.findIndex(x => x.me) + 1, n:b.length }; }
function nextUnplayed(except){ const d = dayState(); return d.set.find(g => g !== except && !d.tries[g]); }
function pickNext(){
  const d = dayState(), un = d.set.find(g => !d.tries[g]);
  return un || d.set.slice().sort((a, b) => d.best[a] - d.best[b])[0];
}
function heartLeft(h){ return mmss((REGEN_MS - (Date.now() - h.t)) / 1000); }

/* ===== 로비 디자인 v2: 게임 색, 메달, 하트, 친구 얼굴, 게임 썸네일 그림(모두 직접 그린 오리지널) ===== */
const GCOL = { fox:['#FFB36B','#FF7A1F','#9A3D00'], sudoku:['#8DB8FF','#3B6FD8','#1B3C86'], ball:['#D9A2FF','#9B44E8','#4E1683'], tower:['#9BE27A','#2E9E5B','#15562E'], fleet:['#7FD6FF','#1A8CC4','#0B4A6E'] };
const HEART_G = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 35.5l-2.2-2C9 25.6 3.5 20.6 3.5 14.3 3.5 9.1 7.6 5 12.8 5c2.9 0 5.7 1.4 7.2 3.6C21.5 6.4 24.3 5 27.2 5c5.2 0 9.3 4.1 9.3 9.3 0 6.3-5.5 11.3-14.3 19.2z" fill="url(#gHeart)" stroke="#7A0B3C" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="12.5" cy="12" rx="4.2" ry="2.8" transform="rotate(-30 12.5 12)" fill="#fff" opacity=".75"/><circle cx="17.2" cy="9.4" r="1.2" fill="#fff" opacity=".8"/></svg>';
const MAIL_G = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="19" rx="4" fill="url(#gMail)" stroke="#1A0F45" stroke-width="2.2"/><path d="M4.5 9l11.5 9 11.5-9" fill="none" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/><path d="M13 16.5c0-1.5 1.1-2.6 2.5-2.6.2 0 .4 0 .5.1.1-.1.3-.1.5-.1 1.4 0 2.5 1.1 2.5 2.6 0 1.8-3 3.8-3 3.8s-3-2-3-3.8z" fill="#FF3D7F"/></svg>';
const SPARK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10C5.2 9.2 9.2 5.2 10 0z" fill="#FFF3A8"/></svg>';
const CLOCK_I = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const hi = (cls = '') => `<span class="hi ${cls}" aria-hidden="true">${HEART_G}</span>`;

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

/* ===== 공용 캐릭터(디자인팀 v3): 3D 비닐 장난감 질감. 사이트 전체의 동물은 모두 이 그림을 쓴다 =====
   평면 도형을 SVG 조명 필터(확산광+반사광)로 부풀려 광택·그늘을 만든다. 외곽선 없음, 색 하나 + 실루엣.
   종류: fox octopus whale chick frog owl panda rabbit bear cat dog tiger (모두 직접 그린 오리지널)
   HTML에는 toyImg(kind), SVG 안에는 toyImage(kind,x,y,w,h), 주소만 필요하면 toySrc(kind) */
const TOY = (() => {
  const PUFF = (id, blur, scale, spec) => `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="${scale}" diffuseConstant="1" lighting-color="#fff" result="d0"><feDistantLight azimuth="250" elevation="62"/></feDiffuseLighting>
    <feGaussianBlur in="d0" stdDeviation=".9" result="d"/>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1=".88" k2=".17" result="sh"/>
    <feSpecularLighting in="h" surfaceScale="${scale}" specularConstant="${spec}" specularExponent="10" lighting-color="#fff" result="s0"><feDistantLight azimuth="240" elevation="66"/></feSpecularLighting>
    <feGaussianBlur in="s0" stdDeviation="1.4" result="s"/>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sm"/>
    <feComposite in="sh" in2="sm" operator="arithmetic" k2="1" k3=".42" result="o"/>
    <feComposite in="o" in2="SourceAlpha" operator="in"/>
  </filter>`;
  const DEFS = PUFF('pb', 7, 4.2, .8) + PUFF('pm', 3.6, 3.2, .7) + PUFF('ps', 1.6, 3, 1)
    + `<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="gs" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#101845" stop-opacity=".35"/><stop offset="1" stop-color="#101845" stop-opacity="0"/></radialGradient>`;
  const EYE = (x, y, r = 5.2) => `<g filter="url(#ps)"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="#231A2E"/></g><ellipse cx="${x - r * .32}" cy="${y - r * .45}" rx="${r * .38}" ry="${r * .42}" fill="#fff"/><circle cx="${x + r * .35}" cy="${y + r * .4}" r="${r * .16}" fill="#fff" opacity=".85"/>`;
  const CHEEK = (x, y, c) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.8" fill="${c}" opacity=".55"/>`;
  const GL = (x, y, rx, ry, r = -25) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#gl)"/>`;
  const SH = `<ellipse cx="50" cy="92" rx="30" ry="6" fill="url(#gs)"/>`;
  const A = {
    octopus:() => SH + `<g filter="url(#pb)"><path d="M18 52C18 27 32 13 50 13S82 27 82 52c0 8 4 14 9 19-5 6-12 4-16-1-2 9-10 12-15 5-4 7-16 7-20 0-5 7-13 4-15-5-4 5-11 7-16 1 5-5 9-11 9-19z" fill="#F0364A"/></g>${GL(36, 28, 14, 8)}
      <g filter="url(#ps)"><circle cx="35" cy="27" r="4" fill="#FF8C98"/><circle cx="64" cy="24" r="3" fill="#FF8C98"/></g>
      ${EYE(40, 47)}${EYE(60, 47)}${CHEEK(30, 57, '#FF9AA8')}${CHEEK(70, 57, '#FF9AA8')}<path d="M45 58q5 5 10 0" fill="none" stroke="#7A0F1E" stroke-width="2.6" stroke-linecap="round"/>`,
    whale:() => SH + `<g filter="url(#pm)"><path d="M50 30c0-8-1-13-1-16" stroke="#6CC3FF" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M49 18c-4-8-12-9-16-4M51 18c4-8 12-9 16-4" stroke="#6CC3FF" stroke-width="5" stroke-linecap="round" fill="none"/></g>
      <g filter="url(#pb)"><path d="M12 60c0-21 16-32 38-32s38 11 38 30c0 18-15 28-38 28S12 79 12 60z" fill="#1F74E0"/></g>${GL(34, 40, 15, 7)}
      <g filter="url(#pm)"><path d="M24 74c9 6 43 6 52 0-5 8-14 12-26 12s-21-4-26-12z" fill="#8FC8FF"/></g>
      ${EYE(37, 54)}${EYE(63, 54)}${CHEEK(27, 63, '#7FB6FF')}${CHEEK(73, 63, '#7FB6FF')}<path d="M45 62q5 4.5 10 0" fill="none" stroke="#0B3F86" stroke-width="2.6" stroke-linecap="round"/>`,
    chick:() => SH + `<g filter="url(#pm)"><path d="M45 26c-4-9 3-15 7-8 4-8 12-3 6 8z" fill="#FFB300"/><path d="M17 60c-9 1-10 13 1 13zM83 60c9 1 10 13-1 13z" fill="#FFB300"/></g>
      <g filter="url(#pb)"><circle cx="50" cy="56" r="33" fill="#FFC40D"/></g>${GL(38, 36, 14, 8)}
      ${EYE(39, 50)}${EYE(61, 50)}${CHEEK(29, 61, '#FF9C5A')}${CHEEK(71, 61, '#FF9C5A')}<g filter="url(#ps)"><path d="M42 58l8-6 8 6-8 7z" fill="#FF6A1A"/></g>`,
    frog:() => SH + `<g filter="url(#pb)"><circle cx="30" cy="35" r="14" fill="#27AE3B"/><circle cx="70" cy="35" r="14" fill="#27AE3B"/><path d="M11 63c0-18 17-28 39-28s39 10 39 28c0 16-17 25-39 25S11 79 11 63z" fill="#27AE3B"/></g>${GL(26, 27, 7, 4)}${GL(66, 27, 7, 4)}${GL(40, 46, 14, 5, -10)}
      <g filter="url(#pm)"><ellipse cx="50" cy="75" rx="22" ry="9" fill="#C6F09A"/></g>
      ${EYE(30, 35, 5.6)}${EYE(70, 35, 5.6)}${CHEEK(24, 60, '#8BE06A')}${CHEEK(76, 60, '#8BE06A')}<path d="M36 59q14 10 28 0" fill="none" stroke="#0E5A17" stroke-width="2.8" stroke-linecap="round"/>`,
    owl:() => SH + `<g filter="url(#pb)"><path d="M24 34L18 10l21 13zM76 34l6-24-21 13z" fill="#8A3FEA"/><path d="M50 17c22 0 35 16 35 38 0 21-15 33-35 33S15 76 15 55c0-22 13-38 35-38z" fill="#8A3FEA"/></g>${GL(36, 28, 13, 7)}
      <g filter="url(#pm)"><circle cx="37" cy="48" r="12.5" fill="#EBDDFF"/><circle cx="63" cy="48" r="12.5" fill="#EBDDFF"/><ellipse cx="50" cy="75" rx="17" ry="10" fill="#B58CFF"/></g>
      ${EYE(37, 48, 5.8)}${EYE(63, 48, 5.8)}<g filter="url(#ps)"><path d="M45 57h10l-5 7z" fill="#FFA000"/></g>`,
    fox:() => SH + `<g filter="url(#pb)"><path d="M22 46L15 9l29 20zM78 46l7-37-29 20z" fill="#FF7A12"/><path d="M12 54c0-19 17-28 38-28s38 9 38 28c0 19-17 32-38 33-21-1-38-14-38-33z" fill="#FF7A12"/></g>${GL(36, 36, 14, 7)}
      <g filter="url(#pm)"><path d="M23 33l-3-15 13 10zM77 33l3-15-13 10z" fill="#FFD2A6"/><path d="M25 64c8-7 18-6 25 1 7-7 17-8 25-1-4 14-14 21-25 21s-21-7-25-21z" fill="#FFF3E4"/></g>
      ${EYE(37, 52)}${EYE(63, 52)}${CHEEK(27, 62, '#FF7E6B')}${CHEEK(73, 62, '#FF7E6B')}<g filter="url(#ps)"><ellipse cx="50" cy="65" rx="4.2" ry="3.2" fill="#231A2E"/></g><path d="M50 68v2.5M46 71.5q4 3 8 0" fill="none" stroke="#5A3A2A" stroke-width="2" stroke-linecap="round"/>`,
    panda:() => SH + `<g filter="url(#pb)"><circle cx="25" cy="30" r="12" fill="#2C2838"/><circle cx="75" cy="30" r="12" fill="#2C2838"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="57" rx="37" ry="32" fill="#F6F7FB"/></g>${GL(36, 38, 14, 7)}
      <g filter="url(#pm)"><ellipse cx="36" cy="53" rx="9" ry="11" transform="rotate(-28 36 53)" fill="#2C2838"/><ellipse cx="64" cy="53" rx="9" ry="11" transform="rotate(28 64 53)" fill="#2C2838"/></g>
      <circle cx="37" cy="52" r="3.4" fill="#fff"/><circle cx="63" cy="52" r="3.4" fill="#fff"/>${CHEEK(25, 67, '#FFB0C0')}${CHEEK(75, 67, '#FFB0C0')}<g filter="url(#ps)"><ellipse cx="50" cy="64" rx="4.2" ry="3.2" fill="#2C2838"/></g>`
  };
  
  Object.assign(A, {
    rabbit:() => SH + `<g filter="url(#pb)"><ellipse cx="36" cy="24" rx="9" ry="20" transform="rotate(-10 36 24)" fill="#FF9EC2"/><ellipse cx="64" cy="24" rx="9" ry="20" transform="rotate(10 64 24)" fill="#FF9EC2"/></g>
      <g filter="url(#pm)"><ellipse cx="36" cy="24" rx="4" ry="13" transform="rotate(-10 36 24)" fill="#FFE0EC"/><ellipse cx="64" cy="24" rx="4" ry="13" transform="rotate(10 64 24)" fill="#FFE0EC"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="60" rx="34" ry="29" fill="#FF9EC2"/></g>${GL(38, 44, 13, 6)}
      <g filter="url(#pm)"><ellipse cx="50" cy="69" rx="14" ry="10" fill="#FFF1F6"/></g>
      ${EYE(38, 56)}${EYE(62, 56)}${CHEEK(27, 66, '#FF6FA0')}${CHEEK(73, 66, '#FF6FA0')}<g filter="url(#ps)"><ellipse cx="50" cy="65" rx="3.6" ry="2.8" fill="#E0457F"/></g><path d="M50 67v3M46 71q4 3 8 0" fill="none" stroke="#8A2A4E" stroke-width="2.2" stroke-linecap="round"/>`,
    bear:() => SH + `<g filter="url(#pb)"><circle cx="24" cy="30" r="12" fill="#B06A30"/><circle cx="76" cy="30" r="12" fill="#B06A30"/></g>
      <g filter="url(#pm)"><circle cx="24" cy="30" r="6" fill="#E9B27A"/><circle cx="76" cy="30" r="6" fill="#E9B27A"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="36" ry="31" fill="#B06A30"/></g>${GL(36, 40, 14, 7)}
      <g filter="url(#pm)"><ellipse cx="50" cy="68" rx="15" ry="11" fill="#F0C995"/></g>
      ${EYE(36, 54)}${EYE(64, 54)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="5" ry="3.8" fill="#2A1B14"/></g><path d="M50 67v3M45 71q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/>`,
    cat:() => SH + `<g filter="url(#pb)"><path d="M18 46L20 12l24 18zM82 46L80 12 56 30z" fill="#8E98B5"/></g>
      <g filter="url(#pm)"><path d="M24 34l1-14 11 9zM76 34l-1-14-11 9z" fill="#FFC6D6"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="37" ry="30" fill="#8E98B5"/></g>${GL(36, 40, 14, 7)}
      <g filter="url(#pm)"><path d="M50 30v10M42 31l2 9M58 31l-2 9" stroke="#6C7593" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="50" cy="69" rx="13" ry="9" fill="#EEF1F8"/></g>
      ${EYE(36, 55)}${EYE(64, 55)}${CHEEK(26, 65, '#FF9DB6')}${CHEEK(74, 65, '#FF9DB6')}<g filter="url(#ps)"><path d="M46.5 63h7L50 67z" fill="#FF7EA2"/></g><path d="M50 67q-3 4-6 1M50 67q3 4 6 1" fill="none" stroke="#3E4560" stroke-width="2" stroke-linecap="round"/>
      <path d="M14 64l12-1M15 70l11-3M86 64l-12-1M85 70l-11-3" stroke="#3E4560" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
    dog:() => SH + `<g filter="url(#pb)"><ellipse cx="50" cy="56" rx="34" ry="31" fill="#E9B46E"/></g>${GL(38, 38, 13, 7)}
      <g filter="url(#pb)"><path d="M20 30c-10 4-12 26-4 32 7-2 10-14 10-26z" fill="#8A5226"/><path d="M80 30c10 4 12 26 4 32-7-2-10-14-10-26z" fill="#8A5226"/></g>
      <g filter="url(#pm)"><ellipse cx="50" cy="69" rx="16" ry="11" fill="#FFF3E2"/><ellipse cx="64" cy="48" rx="8" ry="7" fill="#C98A48"/></g>
      ${EYE(38, 52)}${EYE(62, 52)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="5.2" ry="3.8" fill="#2A1B14"/></g><path d="M50 67v3M45 71q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/><g filter="url(#ps)"><path d="M47 73q3 7 6 0z" fill="#FF6E8A"/></g>`,
    tiger:() => SH + `<g filter="url(#pb)"><circle cx="24" cy="30" r="11" fill="#FF9420"/><circle cx="76" cy="30" r="11" fill="#FF9420"/></g>
      <g filter="url(#pm)"><circle cx="24" cy="30" r="5" fill="#FFE4C4"/><circle cx="76" cy="30" r="5" fill="#FFE4C4"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="37" ry="31" fill="#FF9420"/></g>
      <g filter="url(#pm)"><path d="M50 28v9M42 30l2 7M58 30l-2 7M14 52l10 3M15 62l9 0M86 52l-10 3M85 62l-9 0" stroke="#3A2414" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="50" cy="69" rx="17" ry="11" fill="#FFF4E6"/></g>${GL(36, 40, 13, 6)}
      ${EYE(36, 53)}${EYE(64, 53)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="4.6" ry="3.4" fill="#E0457F"/></g><path d="M50 66v3M45 70q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/>`
  });
  
  const src = {};
  const toySrc = k => src[k] || (src[k] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${DEFS}</defs>${(A[k] || A.fox)()}</svg>`).replace(/'/g, '%27'));
  return { PUFF, DEFS, EYE, CHEEK, GL, SH, A, toySrc };
})();
const toySrc = k => TOY.toySrc(k);
const toyImg = (k, cls = '') => `<img class="toy ${cls}" src="${toySrc(k)}" alt="" aria-hidden="true" draggable="false">`;
const toyImage = (k, x, y, w, h) => `<image href="${toySrc(k)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
/* 친구 얼굴(토끼·곰·고양이·강아지·판다·호랑이) */
const FACE_KIND = ['rabbit','bear','cat','dog','panda','tiger'];
const FACE_BG = ['#FFD6E6','#FFE7A8','#CFE9FF','#D8F5C8','#E6DAFF','#FFE0C4'];
function animalFace(kind){ return toyImg(kind); }   /* 예전 평면 얼굴 → 공용 3D 캐릭터 */
const avatar = x => {
  if(x.me) return `<span class="av" style="--avbg:#FFE0C4">${toyImg('fox')}</span>`;
  const i = Math.max(0, FRIENDS.findIndex(f => f.name === x.name));
  return `<span class="av" style="--avbg:${FACE_BG[i % 6]}">${animalFace(FACE_KIND[i % 6])}</span>`;
};

/* 게임 썸네일 그림 */
const ART = {
  fox(){   /* 밤하늘 + 연보라 종이 카드 + 우리 구역 색 + 기회 별 */
    const reg = [0,0,1,1,1,2, 0,3,3,1,2,2, 4,4,3,5,5,2, 4,6,6,6,5,5], cols = ['#FF8C9E','#FFD04D','#5ECF9C','#62AEFF','#B48BFF','#FF9E4F','#3FC2C4'];
    const marks = { 1:'x', 4:'x', 7:'fox', 11:'x', 13:'x', 16:'x', 20:'fox', 22:'x' };
    let g = '';
    reg.forEach((r, k) => { const x = 29 + (k % 6) * 17.5, y = 22 + Math.floor(k / 6) * 17.5;
      g += `<rect x="${x}" y="${y}" width="15.5" height="15.5" rx="4" fill="${cols[r]}"/>`;
      if(marks[k] === 'x') g += `<path d="M${x + 5} ${y + 5}l5.5 5.5M${x + 10.5} ${y + 5}l-5.5 5.5" stroke="#2A1650" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>`;
      if(marks[k] === 'fox') g += FOX_FACE.replace('<svg ', `<svg x="${x - 1}" y="${y - 1}" width="17.5" height="17.5" `);
    });
    const star = (x, y, on) => `<path transform="translate(${x} ${y}) scale(.42)" d="M12 1.9l3 6.1 6.7 1-4.9 4.7 1.2 6.7L12 17.2l-6 3.2 1.2-6.7L2.3 9l6.7-1z" fill="${on ? '#FFC93C' : '#8C7BC0'}" stroke="#2A1650" stroke-width="3" stroke-linejoin="round"/>`;
    const gid = 'aFox' + (ART._n = (ART._n || 0) + 1);   /* 숨은 탭의 같은 id를 참조하면 그라데이션이 안 보여서 그릴 때마다 새 id */
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4B30B0"/><stop offset="1" stop-color="#1E1260"/></linearGradient></defs>
      <rect width="160" height="100" fill="url(#${gid})"/><circle cx="14" cy="18" r="1.4" fill="#fff" opacity=".8"/><circle cx="148" cy="30" r="1.2" fill="#fff" opacity=".7"/><circle cx="140" cy="10" r="1.6" fill="#FFF3A8"/><circle cx="10" cy="70" r="1.1" fill="#fff" opacity=".6"/>
      <rect x="22" y="15" width="116" height="85" rx="13" fill="#1A0F45"/><rect x="22" y="12" width="116" height="83" rx="13" fill="#E9DDFF" stroke="#2A1650" stroke-width="2.5"/>${g}
      ${star(3, 1, 1)}${star(14, 1, 1)}${star(25, 1, 0)}
      ${FOX_FACE.replace('<svg ', '<svg x="122" y="60" width="40" height="38" ')}</svg>`;
  },
  sudoku(){   /* 밤하늘 + 양피지 카드 + 우리 색 스도쿠 판 */
    const s = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const x0 = 40, y0 = 9, c = 82 / 9; let g = '';
    g += `<rect x="${x0}" y="${y0 + 4 * c}" width="82" height="${c}" fill="#F3EDFF"/><rect x="${x0 + 6 * c}" y="${y0}" width="${c}" height="82" fill="#F3EDFF"/><rect x="${x0 + 6 * c}" y="${y0 + 4 * c}" width="${c}" height="${c}" fill="#FFE38A"/>`;
    for(let i=0;i<81;i++) if(s[i] !== '0') g += `<text x="${x0 + (i % 9 + .5) * c}" y="${y0 + (Math.floor(i / 9) + .5) * c + 2.8}" text-anchor="middle" font-size="7.4" font-family="Jua,sans-serif" fill="${i % 7 === 3 ? '#6C3CE0' : '#2A1650'}">${s[i]}</text>`;
    for(let k=1;k<9;k++){ const w = k % 3 ? .6 : 1.6, col = k % 3 ? '#D9CCF0' : '#2A1650'; g += `<path d="M${x0 + k * c} ${y0}v82M${x0} ${y0 + k * c}h82" stroke="${col}" stroke-width="${w}"/>`; }
    const gid = 'aSud' + (ART._n = (ART._n || 0) + 1);
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4B30B0"/><stop offset="1" stop-color="#1E1260"/></linearGradient></defs>
      <rect width="160" height="100" fill="url(#${gid})"/><circle cx="16" cy="12" r="1.4" fill="#fff" opacity=".8"/><circle cx="148" cy="44" r="1.2" fill="#fff" opacity=".7"/><circle cx="24" cy="94" r="1.1" fill="#fff" opacity=".6"/>
      <rect x="${x0 - 6}" y="${y0 - 4}" width="94" height="94" rx="9" fill="#1A0F45"/><rect x="${x0 - 6}" y="${y0 - 6}" width="94" height="94" rx="9" fill="#FBEBCB" stroke="#2A1650" stroke-width="2.2"/><rect x="${x0 - 1}" y="${y0 - 1}" width="84" height="84" rx="2" fill="#2A1650"/><rect x="${x0}" y="${y0}" width="82" height="82" fill="#fff"/>${g}
      <g font-family="Black Han Sans, Jua, sans-serif" font-size="15" text-anchor="middle"><circle cx="18" cy="30" r="12" fill="#fff" stroke="#2A1650" stroke-width="2.5"/><text x="18" y="35.5" fill="#6C3CE0">7</text><circle cx="142" cy="70" r="12" fill="#FFD04D" stroke="#2A1650" stroke-width="2.5"/><text x="142" y="75.5" fill="#2A1650">9</text></g></svg>`;
  },
  ball(){
    const pal = ['#9CEBC6','#A6D2FF','#FFE38A','#FFBC96','#F7A3D6'];
    const cells = [[0,0,3,2],[1,0,5,3],[3,0,9,4],[4,0,4,2],[0,1,2,1],[2,1,6,'b'],[5,1,3,1],[1,2,1,0],[4,2,2,0]];
    let g = '', stars = '';
    for(let k=0;k<22;k++) stars += `<circle cx="${(k * 37) % 160}" cy="${(k * 23) % 96}" r="${k % 5 ? .7 : 1.2}" fill="#fff" opacity="${.25 + (k % 3) * .15}"/>`;
    cells.forEach(([c, r, n, b]) => { const x = 14 + c * 22, y = 6 + r * 22;
      if(b === 'b') g += `<circle cx="${x + 10}" cy="${y + 10}" r="9" fill="${pal[3]}" stroke="#2A1650" stroke-width="2.2"/><ellipse cx="${x + 7}" cy="${y + 5.5}" rx="4" ry="1.8" fill="#fff" opacity=".6"/><text x="${x + 10}" y="${y + 13.4}" text-anchor="middle" font-size="9.5" font-family="Black Han Sans, Jua, sans-serif" fill="#2A1650">${n}</text>`;
      else g += `<rect x="${x}" y="${y}" width="20" height="20" rx="5" fill="${pal[b]}" stroke="#2A1650" stroke-width="2.2"/><ellipse cx="${x + 8}" cy="${y + 5}" rx="5.5" ry="2" fill="#fff" opacity=".6"/><text x="${x + 10}" y="${y + 14.2}" text-anchor="middle" font-size="10" font-family="Black Han Sans, Jua, sans-serif" fill="#2A1650">${n}</text>`; });
    let dots = ''; for(let k=1;k<7;k++) dots += `<circle cx="${96 - k * 5.2}" cy="${88 - k * 7.6}" r="1.6" fill="#fff" opacity="${1 - k * .1}"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="aBallBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2690"/><stop offset=".6" stop-color="#22166A"/><stop offset="1" stop-color="#170E44"/></linearGradient>
      <radialGradient id="aBallG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#FFF4C8"/><stop offset="1" stop-color="#F5C04A"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#aBallBg)"/>${stars}${g}${dots}
      <path d="M134 7l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#FFE27A" stroke="#2A1650" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="0" y="93" width="160" height="2.5" fill="#BFEFFF"/><rect x="0" y="86" width="160" height="7" fill="#96E1FF" opacity=".25"/>
      <circle cx="98" cy="88" r="4.6" fill="url(#aBallG)"/><text x="108" y="84" font-size="8.5" font-family="Black Han Sans, Jua, sans-serif" fill="#FFF4C8" stroke="#2A1650" stroke-width="2" paint-order="stroke">×12</text></svg>`;
  },
  tower(){
    /* 풀밭 칸 판 + 흙길 칸 + 솔방울 나무 + 개미 + 도토리 창고 */
    const path = [[2,0],[2,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[7,3],[7,4],[6,4],[5,4],[4,4],[4,5],[4,6]];
    let g = '';
    for(let r = 0; r < 7; r++) for(let c = 0; c < 10; c++) g += `<rect x="${c * 16}" y="${r * 16 - 6}" width="16" height="16" fill="${(r + c) % 2 ? '#86C95A' : '#7BBE50'}"/>`;
    const pts = '40,-10 ' + path.map(([c, r]) => `${c * 16 + 8},${r * 16 + 2}`).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="#A97A45" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#D9AE73" stroke-width="10.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    path.forEach(([c, r], k) => { if(k % 2) g += `<ellipse cx="${c * 16 + 8}" cy="${r * 16 + 2}" rx="3" ry="2" fill="#E8CFA0"/>`; });
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}
      <ellipse cx="40" cy="-2" rx="11" ry="7" fill="#8A5A34"/><ellipse cx="40" cy="-1" rx="7" ry="4" fill="#2B1A0E"/>
      <g transform="translate(72 84)"><ellipse cx="0" cy="14" rx="30" ry="4" fill="rgba(20,50,10,.3)"/><rect x="-26" y="-6" width="52" height="20" rx="7" fill="#A56B3B" stroke="#5A3514" stroke-width="1.6"/><ellipse cx="0" cy="-6" rx="25" ry="5" fill="#E8C48E" stroke="#5A3514" stroke-width="1.6"/><ellipse cx="0" cy="-5.6" rx="11" ry="2.8" fill="#3B230F"/>
        <g transform="translate(-6 -11)"><path d="M-3.5 0c-.3 4 1.4 6.4 3.5 7 2.1-.6 3.8-3 3.5-7z" fill="#E5A24B" stroke="#7A4A1C" stroke-width=".8"/><path d="M-4.4 .4c0-2.4 2-3.6 4.4-3.6s4.4 1.2 4.4 3.6z" fill="#8A5A2B"/></g>
        <g transform="translate(5 -12)"><path d="M-3.5 0c-.3 4 1.4 6.4 3.5 7 2.1-.6 3.8-3 3.5-7z" fill="#E5A24B" stroke="#7A4A1C" stroke-width=".8"/><path d="M-4.4 .4c0-2.4 2-3.6 4.4-3.6s4.4 1.2 4.4 3.6z" fill="#8A5A2B"/></g></g>
      <g transform="translate(88 50)"><ellipse cx="0" cy="12" rx="12" ry="3" fill="rgba(20,60,10,.28)"/><rect x="-2.2" y="3" width="4.4" height="9" rx="1.6" fill="#9A6A3F"/><ellipse cx="0" cy="3" rx="12.5" ry="6.5" fill="#3E9A45"/><ellipse cx="0" cy="-3" rx="10" ry="6" fill="#48A94E"/><ellipse cx="0" cy="-9" rx="6.8" ry="5" fill="#5CBF60"/><ellipse cx="-2.5" cy="-11" rx="2.6" ry="1.3" fill="rgba(255,255,255,.5)"/>
        <circle cx="-2.6" cy="-3" r="1.1" fill="#1F2A1A"/><circle cx="2.6" cy="-3" r="1.1" fill="#1F2A1A"/><ellipse cx="-7" cy="5" rx="2" ry="2.6" fill="#A0673A"/><ellipse cx="6.5" cy="4" rx="2" ry="2.6" fill="#A0673A"/>
        <circle cx="0" cy="-15.5" r="2.8" fill="#FFD54A" stroke="#B07A00" stroke-width=".8"/></g>
      <g transform="translate(24 44)"><ellipse cx="0" cy="11" rx="13" ry="3" fill="rgba(20,60,10,.28)"/><path d="M0 12c0-5 3-7 1-13" fill="none" stroke="#3E8E41" stroke-width="2.2" stroke-linecap="round"/><circle cx="1" cy="-4" r="10" fill="#FFE36B" opacity=".35"/><ellipse cx="1" cy="-4" rx="6" ry="7" fill="#FFD84D" stroke="#E0A800" stroke-width=".8"/><ellipse cx="1" cy="-11" rx="5" ry="2" fill="#4CAF50"/></g>
      <g transform="translate(110 68)"><path d="M-12 1l-2 5M-6 2l-1 5M0 2l1 5" stroke="#5A1E14" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="-9" cy="-1" rx="6.5" ry="5" fill="#C4452F"/><circle cx="-2" cy="-2" r="3.2" fill="#B23A27"/><circle cx="4" cy="-4.5" r="4.6" fill="#CF4F36"/><circle cx="5.6" cy="-5.2" r="1.7" fill="#fff"/><circle cx="6.1" cy="-5" r=".9" fill="#2A1010"/><path d="M3.5 -8.5q-1-4 2-5M6 -8q1.5-3.5 4-3.4" fill="none" stroke="#5A1E14" stroke-width="1" stroke-linecap="round"/></g>
      <path d="M94 44L104 58" stroke="#A0673A" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/></svg>`;
  },
  fleet(){
    let grid = ''; for(let k=1;k<10;k++) grid += `<path d="M${k * 16} 0v100M0 ${k * 10}h160" stroke="rgba(170,225,255,.14)" stroke-width="1"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="aSea" cx=".25" cy="0" r="1.1"><stop offset="0" stop-color="#2A8AC8"/><stop offset=".5" stop-color="#0F4A7A"/><stop offset="1" stop-color="#081F38"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#aSea)"/>${grid}
      <path d="M0 78q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      <g transform="translate(14 36) scale(.29)">${flShipBody('battle', 4)}</g>
      <g transform="translate(96 70) scale(.2)">${flShipBody('destroyer', 2)}</g>
      <circle cx="132" cy="28" r="9" fill="none" stroke="#CFEFFF" stroke-width="1.6" opacity=".8"/><circle cx="132" cy="28" r="4" fill="#DDF1FF"/>
      ${FL_FLAME.replace('<svg class="fl-flame" ', '<svg x="92" y="30" width="20" height="20" ')}
      <g transform="translate(110 42)"><circle r="11" fill="none" stroke="#FF4D4D" stroke-width="2" stroke-dasharray="10 4"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6" stroke="#FF4D4D" stroke-width="2" stroke-linecap="round"/></g></svg>`;
  }
};

/* ===== v4: 메인 간소화(탭 4개) + 모험(save) 모드 + 성장 축하 ===== */
Object.assign(SVG, {
  home:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.8 11a1 1 0 0 0 .7 1.8H5V20a1 1 0 0 0 1 1h4.2v-5.5h3.6V21H18a1 1 0 0 0 1-1v-7.2h1.5a1 1 0 0 0 .7-1.8z"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3.5 3.6 5.6A1 1 0 0 0 3 6.5v13a.8.8 0 0 0 1.1.7L9 18.3l6 2.2 5.4-2.1a1 1 0 0 0 .6-.9v-13a.8.8 0 0 0-1.1-.7L15 5.7z" opacity=".5"/><path d="M9 3.5v14.8l6 2.2V5.7z"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 20.5c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0z"/></svg>'
});
const STAR_G = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l8.6 17.4 19.2 2.8-13.9 13.5 3.3 19.1L32 47.8 14.8 56.8l3.3-19.1L4.2 24.2l19.2-2.8z" fill="url(#gGold)" stroke="#1A0F45" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 22l8-14 5 11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>';

/* ---- 모험: 챕터·난이도·별 ---- */
const ADV_CH = {
  fox:['여우 마을','단풍 숲','달빛 언덕','눈꽃 계곡','별빛 성'],
  sudoku:['숫자 정원','고요한 서재','수정 동굴','시계탑','천문대'],
  ball:['은하수 입구','젤리 성운','시계탑 별자리','방패 소행성대','불꽃놀이 은하'],
  tower:['도토리 숲','개울 건너','버섯 골짜기','두더지 굴','곰의 동굴'],
  fleet:['잔잔한 만','안개 해협','폭풍 바다','빙하 항로','해적 섬']
};
const ADV_RULE = {
  fox:'★ 클리어 · ★★ 실수 1번 이하 · ★★★ 실수·힌트 없이',
  sudoku:'★ 클리어 · ★★ 실수 1번 이하 · ★★★ 실수·힌트 없이',
  ball:'★ 클리어 · ★★ 기준 턴+6 이내 · ★★★ 기준 턴+3 이내·방어막 지킴',
  tower:'★ 클리어 · ★★ 도토리 7개 이상 · ★★★ 도토리를 하나도 안 잃음',
  fleet:'★ 승리 · ★★ 기준 발수 이하 · ★★★ 더 적은 발수(판마다 달라요)'
};
const chOf = n => Math.ceil(n / 10);
function chName(id, c){ const a = ADV_CH[id]; return a[(c - 1) % 5] + (c > 5 ? ' ' + ['II','III','IV','V'][Math.min(3, Math.floor((c - 6) / 5))] : ''); }
const ADV_KEY = { ball:'hp:ballStages', tower:'hp:towerStages' };
const advKey = id => ADV_KEY[id] || 'hp:adv:' + id;
function advProg(id){ const p = store.get(advKey(id), null) || {}; p.stars = p.stars || {}; p.max = p.max || 1; return p; }
function advStarsOf(id){ return Object.values(advProg(id).stars).reduce((a, b) => a + b, 0); }
function advTotal(){ return GAME_IDS.reduce((s, g) => s + advStarsOf(g), 0); }
function chStars(id, c){ const p = advProg(id); let s = 0; for(let k = 1; k <= 10; k++) s += p.stars[(c - 1) * 10 + k] || 0; return s; }
function chCleared(id, c){ return !!advProg(id).stars[c * 10]; }

function advLevel(id, n){
  const L = { name:'스테이지 ' + n, mult:1 };
  const N = n <= 5 ? 5 : n <= 15 ? 6 : n <= 30 ? 7 : n <= 50 ? 8 : n <= 80 ? 9 : 10;
  L.fox = foxStageCfg(n);   /* 난이도 v2: 5판마다 새 개념(여우 코드 쪽) */
  L.sudoku = { givens:0, limit:sudPlan(n).limit };   /* 스도쿠 솔로: 개념 사이클 + 기술 판정으로 만든다(sudPlan) */
  L.ball = ballStageCfg(n);
  L.tower = { n, w:fsWaveCount(n), limit:0 };
  L.ai = 'normal';
  if(id === 'fleet'){ const q = flStageFx(n).aiQ; L.ai = q < .67 ? 'easy' : q < 1.34 ? 'normal' : 'hard'; }
  L.fleet = { limit:0 };
  if(NG[id]) L[id] = NG[id].stage(n);
  return L;
}
function advDesc(id, n){
  const L = advLevel(id, n);
  if(id === 'fox') return L.fox.N + '×' + L.fox.N + ' 판' + (L.fox.k === 2 ? ' · 여우 ' + L.fox.N * 2 + '마리' : '');
  if(id === 'sudoku') return sudDesc(n);
  if(id === 'ball'){ const b = L.ball; return b.rows + '줄 · 구슬 ' + b.start + '개' + (b.intro ? ' · 새 블록: ' + BSP_INFO[b.intro][0] : ''); }
  if(NG[id]) return NG[id].stageDesc(n);
  if(id === 'tower') return FS_MAPS[(n - 1) % FS_MAPS.length].name + ' · 무리 ' + fsWaveCount(n) + '번' + (n % 10 === 0 ? ' · 멧돼지·먹보 곰' : n % 5 === 0 ? ' · 멧돼지' : '');
  const fx = flStageFx(n);
  return FL_LV[L.ai].name + ' · ★★ ' + fx.th[0] + '발 · ★★★ ' + fx.th[1] + '발 이하' + (fx.tight ? ' · 포탄 ' + fx.tight + '발' : '');
}
function levelOf(id, lv, adv){
  if(adv) return advLevel(id, adv);
  if(id === 'fleet') return FL_LV[lv] || FL_LV.normal;
  const B = LEVELS[lv] || LEVELS.normal;
  if(NG[id]) return Object.assign({}, B, { [id]:NG[id].levels[lv] || NG[id].levels.normal });
  if(id === 'tower'){ const q = { easy:[3, 5], normal:[5, 6], hard:[8, 7] }[lv] || [5, 6]; return Object.assign({}, B, { tower:{ limit:0, n:q[0], w:q[1] } }); }
  return B;
}
function advStarCalc(){
  const id = G.id;
  if(NG[id]) return NG[id].stars();
  if(id === 'ball') return ballStars(G.turn, G.R, G.shield > 0);
  if(id === 'tower') return tdStars(G.lives);
  if(id === 'fleet'){ const n = flShotN(), th = G.fx ? G.fx.th : [60, 45]; return n <= th[1] ? 3 : n <= th[0] ? 2 : 1; }
  const miss = (G.pawMax || 3) - G.paws; return miss === 0 && !G.hintUsed ? 3 : miss <= 1 ? 2 : 1;
}

/* ---- 모험 레벨: 별을 모아 레벨업 ---- */
const TITLES = [[1,'새싹 퍼즐러'],[3,'견습 탐험가'],[5,'숙련 탐험가'],[8,'퍼즐 기사'],[12,'두뇌 마법사'],[16,'전설의 현자'],[20,'퍼즐 마스터']];
function titleOf(L){ let t = TITLES[0][1]; for(const [k, v] of TITLES) if(L >= k) t = v; return t; }
function lvInfo(stars = advTotal()){ let L = 1; while(stars >= 5 * L * (L + 1) / 2) L++; const a = 5 * L * (L - 1) / 2, b = 5 * L * (L + 1) / 2; return { L, cur:stars - a, need:b - a, stars, title:titleOf(L) }; }
function nextTitle(L){ const t = TITLES.find(([k]) => k > L); return t ? t : null; }

/* ---- 그림: 레벨 방패, 챕터 배지 ---- */
let SVG_UID = 0;
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

/* ---- 빠른 시작: 마지막 난이도 기억 ---- */
function lastLv(id){
  let lv = store.get('hp:lv:' + id, null);
  if(id === 'fleet'){ if(!lv) lv = ROOM_STATE !== 'none' ? 'pvp' : 'normal'; if(lv === 'pvp' && ROOM_STATE === 'none') lv = 'normal'; return FL_LV[lv] ? lv : 'normal'; }
  return LEVELS[lv] ? lv : 'normal';
}
const lvName = (id, lv) => id === 'fleet' ? FL_LV[lv].name : LEVELS[lv].name;
function quickStart(id){ startGame(id, examLv()); }   /* v9: 오늘의 시험지는 요일 난이도 */

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
  const pending = giftsToday().filter(n => !d.claimed.includes(n)).length;
  $('#badge').textContent = pending; $('#badge').style.display = pending ? '' : 'none';
}

function renderToday(d, tl, P, lv){
  const { b, pos } = P;
  const tt = tl.today, ls = leagueState(), lb = leagueBoard(undefined, ls.tier, tl), lpos = lb.findIndex(x => x.me) + 1;
  const pctNow = tt.st === 'att' ? tt.pct : bonusPct(tl.streak + 1);
  const ndone = d.set.filter(g => examDone(d, g) || d.tries[g] > 0).length;
  $('#strip').innerHTML = `<span class="md">${medal(tl.score ? pos : 0, false)}</span><span><b class="num">오늘 ${fmt(tl.score)}점 <small>시험지 ${ndone}/${DAILY_N} · ${d.set.map(g => gradeOf(examTop(g, d.best[g]))).join(' ')}</small></b><span class="s2"><span>${tl.score ? '친구 중 ' + pos + '위' : '오늘 첫 판 전'}</span>${tl.streak ? `<span class="hot">${ic('flame')}연속 ${tl.streak}일</span>` : ''}<span>${ic('trophy')}${TIERS[ls.tier][0]} ${lb[lpos - 1].score ? lpos + '위' : ''}</span><span>${ic('clock')}<span class="num" id="closing">${closingText()}</span></span></span></span><span class="go">${ic('chev')}</span>`;
  $('#pool').innerHTML = `${ic('coin')}<span class="pt"><small>이번 주 모두의 기부</small><b class="num" id="poolAmt">${fmt(prizePool())}원</b></span><span class="pr">광고 1번 = +12원<br>매달 좋은 곳에 기부해요</span>`;
  const now = new Date();
  $('#dayNote').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 ${examLabel()} · 전 국민 같은 문제 · 첫 판이 공식 답안(무료)`;
  const nx = pickNext(), lx = lastLv(nx), nb = $('#nextBtn');
  const nxDone = d.tries[nx] > 0, nxSub = nxDone ? '시험지 완료 · 같은 문제 연습(♥1)' : subjOf(nx) + ' 과목 · 첫 판 무료 · ' + GAME_META[nx].time;
  nb.innerHTML = `<span class="cta-tile" style="--g2:${GCOL[nx][1]}">${ic(nx)}</span><span class="cta-txt"><i>${nxDone ? '연습' : '다음 과목'} · ${LV_KO[examLv()]}</i><b>${GAMES[nx].name}</b><small>${nxSub}</small></span><span class="cta-play">${SVG.play.replace('fill="currentColor"', 'fill="#C2410C"')}</span>`;
  nb.setAttribute('aria-label', '바로 시작: ' + GAMES[nx].name + (nxDone ? ', 연습 하트 1개' : ', 공식 답안 무료'));
  nb.onclick = () => quickStart(nx);
  const g = $('#games'); g.innerHTML = '';
  for(const id of d.set){
    const best = d.best[id], tries = d.tries[id], gr = gradeOf(examTop(id, best));
    const st = tries ? `공식 <em>${fmt(best)}점</em>${best ? ' · 성적 ' + gr : ''}${tries > 1 ? ' · 연습 ' + (tries - 1) + '판' : ''}` : `아직 안 풀었어요 · ${GAME_META[id].time}`;
    const badge = tries ? `<span class="stamp grade" style="--gcol:${GRADE_COL[gr]}">${gr}</span>` : '<span class="newb">NEW</span>';
    const row = document.createElement('div'); row.className = 'grow panel'; row.style.setProperty('--gc', GCOL[id][1]);
    row.innerHTML = `<span class="g-art">${ART[id]()}${badge}</span><span class="gr-mid"><b><span class="subj">${subjOf(id)}</span>${GAMES[id].name}</b><span>${st}</span><span class="lvchip ro">${LV_KO[examLv()]}</span></span><button class="gr-go${tries ? ' re' : ''}" aria-label="${GAMES[id].name} ${tries ? '같은 문제 연습, 하트 1개' : '공식 답안 시작, 무료'}">${tries ? '연습 ' + costTag() : '시작 <span class="freebadge">무료</span>'}</button>`;
    row.querySelector('.gr-go').onclick = () => quickStart(id);
    row.querySelector('.g-art').onclick = () => quickStart(id);
    g.appendChild(row);
  }
  $('#advPromo').innerHTML = `<span class="ap-i">${shieldSVG(lv.L)}</span><span><b>솔로 · Lv.${lv.L} ${lv.title}</b><small>10게임 스테이지 · 5판마다 새 규칙 · 별을 모아 레벨 업</small></span>${ic('chev')}`;
  $('#duelPromo').innerHTML = `<span class="ap-i">${ic('duel')}</span><span><b>대전 · 오늘 ${d.dw}승 ${d.dd}무 ${d.dl}패</b><small>같은 문제, 같은 시간, 1:1 · 대전 포인트는 대전 기록에</small></span>${ic('chev')}`;
}

function renderAdv(lv){
  renderSoloPts();
  const nt = nextTitle(lv.L);
  $('#lvCard').innerHTML = `<span class="shield">${shieldSVG(lv.L)}</span><div><span class="t">솔로 레벨</span><b>Lv.${lv.L} ${lv.title}</b><div class="xp"><i style="width:${lv.cur / lv.need * 100}%"></i></div><div class="xp-t"><span>Lv.${lv.L + 1}까지 별 ${lv.need - lv.cur}개${nt ? ` · 칭호 '${nt[1]}' Lv.${nt[0]}` : ''}</span><b class="num">${lv.cur}/${lv.need}</b></div></div>`;
  const list = $('#advList'); list.innerHTML = '';
  for(const id of GAME_IDS){
    const p = advProg(id), cur = p.max, c = chOf(cur), cs = (c - 1) * 10;
    let dots = ''; for(let k = 1; k <= 10; k++){ const n = cs + k, s = p.stars[n] || 0; dots += `<i class="${s ? 's' + s : n === cur ? 'cur' : ''}"></i>`; }
    const el = document.createElement('div'); el.className = 'acard panel'; el.style.setProperty('--gc', GCOL[id][1]);
    el.innerHTML = `<span class="g-art">${ART[id]()}<span class="chn">챕터 ${c}</span></span><div class="ac-mid"><div class="ac-top"><b>${GAMES[id].name}</b><span>★ ${advStarsOf(id)}</span></div>
      <div class="ac-stage">${chName(id, c)} · 스테이지 <em>${cur}</em></div><div class="chdots" aria-label="챕터 ${c}에서 별 ${chStars(id, c)}개">${dots}</div>
      <div class="ac-btns"><button class="map">${ic('map')} 맵</button><button class="gr-go adv">${cur} 시작 <span class="freebadge">무료</span></button></div></div>`;
    el.querySelector('.map').onclick = () => openAdvMap(id);
    el.querySelector('.gr-go').onclick = () => startGame(id, null, { adv:cur });
    el.querySelector('.g-art').onclick = () => openAdvMap(id);
    list.appendChild(el);
  }
}

function renderLeague(d, P){
  const r = $('#rank'); r.innerHTML = '';
  $('#tabDay').setAttribute('aria-pressed', RANK_MODE === 'day'); $('#tabMonth').setAttribute('aria-pressed', RANK_MODE === 'week');
  if(RANK_MODE === 'week'){ renderWeek(d, r); return; }
  const tl = myTL(), ws = worldStat(tl.score);
  $('#lgHead').innerHTML = `<div class="worldcard">${ic('globe')}<span>오늘 전 세계 <b class="num">${fmt(ws.n)}</b>명이 같은 문제를 풀었어요${ws.top != null ? `<br>나는 전 세계 <b>${topTxt(ws.top)}</b>` : ' · 첫 판을 끝내면 내 위치가 나와요'}</span></div>`;
  $('#rankNote').textContent = '오늘 점수 = 오늘의 시험지 5과목 공식 기록(각 첫 판) 합 · 모두 같은 문제라 그대로 비교해요 · 현지 자정 마감';
  P.b.forEach((x, i) => {
    const row = document.createElement('div'); row.className = 'row' + (x.me ? ' me' : '');
    const stk = x.streak ? `<span class="streak">${ic('flame')}${x.streak}일</span>` : '';
    const sub = x.me ? d.set.map(k => `<span class="mini${d.best[k] ? ' on' : ''}" style="--gc:${GCOL[k][1]}">${ic(k)}</span>`).join('') + stk
      : (stk ? stk + (x.att ? '' : '&nbsp;· 오늘 아직') : (x.att ? '오늘 플레이함' : '아직 안 했어요'));
    const posHtml = !x.score ? '<span class="pnum none">–</span>' : i < 3 ? medal(i + 1, false) : `<span class="pnum">${i + 1}</span>`;
    row.innerHTML = `<div class="pos">${posHtml}</div>${avatar(x)}<div class="who"><b>${x.me ? '나' : x.name}</b><small>${sub}</small></div><div class="sc num">${fmt(x.score)}</div><div></div>`;
    if(!x.me){
      const btn = document.createElement('button'); btn.className = 'send';
      const sent = !!d.sent[x.name];
      btn.innerHTML = ic(sent ? 'check' : 'heart'); btn.disabled = sent;
      btn.setAttribute('aria-label', sent ? x.name + '님에게 오늘 하트를 보냈어요' : x.name + '님에게 하트 보내기');
      btn.onclick = () => { fxPop(btn, 'heart'); sfx('heartSend'); fxBuzz(15); const dd = dayState(); dd.sent[x.name] = true; saveDay(dd); toast(x.name + '님에게 하트를 보냈어요'); renderHome(); };
      row.lastElementChild.appendChild(btn);
    }
    r.appendChild(row);
  });
  const inv = document.createElement('button'); inv.className = 'invrow'; inv.id = 'invBtn';
  inv.innerHTML = `<span class="ii">${ic('share')}</span><span><b>친구 초대하기</b><small>링크로 들어온 친구는 친구 리그에 바로 들어와요 · 친구에게 하트 2개 선물</small></span>`;
  inv.onclick = () => viralShare(cardInvite(), closeModal);
  r.appendChild(inv);
}
const rivalAv = x => { const i = seedFrom(x.name) % 6; return `<span class="av" style="--avbg:${FACE_BG[i]}">${animalFace(FACE_KIND[i])}</span>`; };
function renderWeek(d, r){
  const tl = myTL(), s = leagueState(), wk = weekStartKey(), b = leagueBoard(wk, s.tier, tl), pos = b.findIndex(x => x.me) + 1, me = b[pos - 1];
  const closed = Date.now() >= weekDeadline(wk).getTime(), up = s.tier < 3, down = s.tier > 0;
  $('#lgHead').innerHTML = `<div class="lgcard"><span class="tbd">${tierBadge(s.tier)}</span><div><span class="t">${REGION} · 현지 시간 기준</span><b class="big">${TIERS[s.tier][0]} 리그${me.score ? ' ' + pos + '위' : ''}</b>
      <span class="s2"><span>이번 주 <b class="num">${fmt(me.score)}</b>점</span><span>${ic('clock')}${closed ? '마감 · 월요일에 결과 발표' : `일요일 21시 마감까지 <span class="num" id="lgClose">${weekLeft()}</span>`}</span></span></div>
      <div class="lgpool"><span>${ic('coin')} 모두의 기부 · 성적과 상관없이 매달 기부</span><b class="num" id="poolAmt2">${fmt(prizePool())}원</b></div></div>`;
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
  $('#total').textContent = fmt(dailySum(d)) + '점';
  const ng = nextGift(tl.streak);
  $('#bq').textContent = fmt(tl.score); $('#bqSkill').textContent = fmt(myTotal(d)); $('#bqGrit').textContent = tl.streak;
  $('#barSkill').style.width = (nplay / DAILY_N * 100) + '%'; $('#barGrit').style.width = (ng ? Math.min(100, tl.streak / ng[0] * 100) : 100) + '%';
  $('#lbSkill').innerHTML = ic('brain') + '시험지 점수'; $('#lbGrit').innerHTML = ic('flame') + '연속 출석';
  $('#gritEx').innerHTML = ng ? `${ng[0]}일째 선물 하트 <b>+${ng[1]}</b>` : '모든 선물을 받았어요';
  $('#myMedal').innerHTML = medal(tl.score ? pos : 0, true);
  let line;
  if(!tl.score) line = `아직 오늘 기록이 없어요. <em>${examLabel()}</em> 시험지를 풀어 보세요!`;
  else if(pos === 1) line = `<em>1위</em>예요! 2위 ${b[1].name}님보다 ${fmt(me.score - b[1].score)}점 앞서요`;
  else { const a = b[pos - 2], gap = a.score - me.score; line = gap > 0 ? `${a.name}님까지 <em>${fmt(gap)}점</em> 남았어요` : `${a.name}님과 <em>동점</em>이에요`; }
  $('#rankLine').innerHTML = line;
  renderGritCard(tl);
  const played = d.set.filter(g => d.best[g] > 0).length;
  $('#dots').innerHTML = d.set.map(g => `<span class="gem${d.best[g] ? ' on' : ''}" style="--g1:${GCOL[g][0]};--g2:${GCOL[g][1]}" title="${GAMES[g].name}${d.best[g] ? ' · ' + fmt(d.best[g]) + '점' : ''}">${ic(g)}${d.best[g] ? `<i class="gem-ck">${ic('check')}</i>` : ''}</span>`).join('');
  $('#progTxt').textContent = (played === DAILY_N ? '오늘의 ' + DAILY_N + '게임 완주!' : '오늘의 문제 ' + played + ' / ' + DAILY_N) + ` · 솔로 +${fmt(d.solo)} · 대전 +${fmt(d.duel)}`;
  $('#growList').innerHTML = GAME_IDS.map(id => { const p = advProg(id), c = chOf(p.max);
    return `<div class="grw" style="--gc:${GCOL[id][1]}"><span class="gi">${ic(id)}</span><span><b>${GAMES[id].name}</b><small>${p.max > 1 ? '스테이지 ' + (p.max - 1) + '까지 클리어 · ' : ''}지금 ${chName(id, c)}</small></span><span class="gs">★ ${advStarsOf(id)}</span></div>`; }).join('');
  let bd = ''; for(const id of GAME_IDS) for(let c = 1; c <= 5; c++){ const on = chCleared(id, c);
    bd += `<div class="bdg${on ? '' : ' off'}" title="${GAMES[id].name} 챕터 ${c} ${chName(id, c)}${on ? ' 클리어' : ' 아직'}">${badgeSVG(id, c)}<span>${chName(id, c)}</span></div>`; }
  $('#badges').innerHTML = bd;
  const nb = GAME_IDS.reduce((s, id) => { let k = 0; for(let c = 1; c <= 5; c++) if(chCleared(id, c)) k++; return s + k; }, 0);
  $('#bdgCount').textContent = nb + ' / 25';
}

/* ---- 난이도 시트(데일리): 고른 난이도는 기억해서 다음엔 바로 시작 ---- */
function pickLevel(id){
  if(id === 'fleet'){ openFleetSheet(); return; }
  let sel = lastLv(id);
  const rows = Object.entries(LEVELS).map(([k, L], i) => {
    const X = levelOf(id, k);
    const d0 = NG[id] ? NG[id].levelDesc(k) : id === 'fox' ? X.fox.N + '×' + X.fox.N + ' 판' : id === 'sudoku' ? (X.sudoku.givens ? '숫자 ' + X.sudoku.givens + '개 제공' : '숫자 최소 제공') : id === 'ball' ? '블록 ' + X.ball.rows + '줄' : '공격 ' + Math.min(15, 5 + Math.ceil(X.tower.n * 0.6)) + '번';
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

/* ---- 모험 맵: 챕터 10칸, 10번은 보스 ---- */
function openAdvMap(id, want){
  const p = advProg(id);
  let pick = Math.min(want || p.max, p.max), c = chOf(pick);
  const draw = () => {
    const cs = (c - 1) * 10;
    const cells = [1,2,3,4,5,10,9,8,7,6].map(k => { const n = cs + k, lock = n > p.max, s = p.stars[n] || 0;
      return `<button class="st${lock ? ' lock' : ''}${n === p.max ? ' cur' : ''}${n === pick ? ' sel' : ''}${k === 10 ? ' boss' : ''}${NG[id] && NG[id].stageTag ? ' ' + NG[id].stageTag(n) : stageClass(id, n)}" data-n="${n}" ${lock ? 'disabled aria-label="' + n + ' 잠김"' : 'aria-label="스테이지 ' + n + (k === 10 ? ' 보스' : '') + ', 별 ' + s + '개"'}>${lock ? ic('lock') : n}${lock ? '' : `<i>${[1,2,3].map(j => `<span class="${j <= s ? 'on' : 'off'}">★</span>`).join('')}</i>`}</button>`; }).join('');
    const canNext = p.max > c * 10;
    openModal(`<h3>${GAMES[id].name} 솔로</h3>
      <div class="chhead"><button id="chPrev" aria-label="이전 챕터" ${c <= 1 ? 'disabled' : ''}>${ic('chev', 'rot')}</button><div class="chname">${chName(id, c)}<small>챕터 ${c} · 별 ${chStars(id, c)}/30${chCleared(id, c) ? ' · 클리어' : ''}</small></div><button id="chNext" aria-label="다음 챕터" ${canNext ? '' : 'disabled'}>${ic('chev')}</button></div>
      <div class="path">${cells}</div>
      <p class="rule">${ADV_RULE[id]}<br>스테이지 ${pick}: <b>${advDesc(id, pick)}</b>${conceptLine(id, pick) ? `<br><span class="cline">${conceptLine(id, pick)}</span>` : ''}</p>
      <p class="legend3"><span class="lg-n">NEW</span> 새 규칙 · <span class="lg-h"></span> 어려움 · <span class="lg-x"></span> 보스</p>
      <div class="mbtns"><button class="b2" id="mClose">닫기</button><button class="b1" id="mGo">${pick} 시작 · 무료</button></div>`);
    const m = $('#modal'); m.classList.add('amap'); m.style.setProperty('--gc', GCOL[id][1]);
    $('#mClose').onclick = closeModal;
    $('#mGo').onclick = () => { closeModal(); startGame(id, null, { adv:pick }); };
    $('#chPrev').onclick = () => { c--; pick = Math.min(p.max, c * 10); draw(); };
    $('#chNext').onclick = () => { c++; pick = Math.min(p.max, c * 10); draw(); };
    document.querySelectorAll('.st:not(.lock)').forEach(b => b.onclick = () => { pick = +b.dataset.n; draw(); });
  };
  draw();
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
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">스테이지 ${n} 클리어!</h3>
      <div class="bigstars" aria-label="별 ${st}개">${[1,2,3].map(i => `<span class="s${i <= st ? '' : ' off'}" style="animation-delay:${(0.1 + i * 0.22).toFixed(2)}s">${STAR_G}</span>`).join('')}</div>
      ${first ? '<span class="pill new">첫 클리어!</span>' : better ? '<span class="pill new">별 기록 경신!</span>' : `<p class="note">최고 기록 별 ${p.stars[n]}개는 그대로예요</p>`}
      <div>${soloPill}${attPill}</div>${!first ? '<p class="note">솔로 점수는 새 스테이지를 처음 깰 때만 받아요.</p>' : ''}
      ${chBox}<p class="note">${tip}</p>`;
  } else {
    html = `<h3 class="bad">아쉬워요!</h3><p class="lose">스테이지 ${n}</p><p class="note">${lossProgress()} 솔로는 하트 없이 몇 번이든 다시 할 수 있어요.</p>${attPill ? '<div>' + attPill + '</div>' : ''}${chBox}`;
  }
  const toMap = sel => () => { goHome(); TAB = 'adv'; renderHome(); openAdvMap(id, sel); };
  const pri = win ? ['다음 스테이지 ▶', () => startGame(id, null, { adv:n + 1 })] : ['다시 도전', () => startGame(id, null, { adv:n })];
  const sec = ['맵', toMap(win ? n + 1 : n)];
  html += `<div class="mbtns"><button class="b2" id="mSec">${ic('map')} ${sec[0]}</button><button class="b1" id="mPri">${pri[0]}</button></div><button class="btn ghost" id="mGh">홈으로</button>`;
  const go = fn => () => { closeModal(); showCelebrations(cel.slice(), fn); cel.length = 0; };
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
    } else sfx('lose');
    $('#mPri').onclick = go(pri[1]);
    $('#mSec').onclick = go(sec[1]);
    $('#mGh').onclick = go(() => { goHome(); setTab('adv'); });
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
const AX_GAME = { '논리력':'fox', '집중력':'sudoku', '공간지각':'ball', '전략력':'tower', '추리력':'fleet' };
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
      <div class="mrow"><span>전 세계 오늘 참가자 중</span><b>${ws.top != null ? topTxt(ws.top) : '–'}</b></div>
    </div>
    <div class="mbtns"><button class="b2" id="mClose">닫기</button><button class="b1" id="mShare">${ic('share')} 결과 공유하기</button></div>`);
  $('#mClose').onclick = closeModal;
  $('#mShare').onclick = openShare;
}
function shareText(){
  const d = dayState(), tl = myTL(), ab = abilities(), top = brainType(ab), dt = new Date();
  const ls = leagueState(), lb = leagueBoard(undefined, ls.tier, tl), lpos = lb.findIndex(x => x.me) + 1, ws = worldStat(tl.score);
  const card = d.set.map(g => subjOf(g) + ' ' + gradeOf(examTop(g, d.best[g]))).join(' · ');
  return `하루퍼즐 ${dt.getMonth() + 1}/${dt.getDate()}(${WD_KO[dt.getDay()]}) 시험지 · ${LV_KO[examLv()]}\n${card}\n오늘 ${fmt(tl.score)}점${ws.top != null && ws.top <= 50 ? ` · 전국 상위 ${ws.top}%` : ''}${tl.streak ? ` · 🔥${tl.streak}일` : ''}\n🏆 ${TIERS[ls.tier][0]} 리그 ${lb[lpos - 1].score ? lpos + '위' : ''}${top ? ` · 나는 '${BTYPE[top][0]}'` : ''}\n같은 문제, 다른 점수. 너는 몇 점?`;
}
function openShare(back, opt){ viralShare(opt || cardToday(), back); }

function closingText(){ const now = new Date(), mid = new Date(now); mid.setHours(24,0,0,0); const s = Math.floor((mid - now) / 1000); return Math.floor(s/3600) + ':' + String(Math.floor(s%3600/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }

function openModal(html){ if(!$('#veil').classList.contains('on')) sfx('open'); const m = $('#modal'); m.className = 'modal'; m.style.removeProperty('--gc'); m.innerHTML = html; $('#veil').classList.add('on'); m.scrollTop = 0; }
function closeModal(){ $('#veil').classList.remove('on'); }

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
  openModal(`<h3>광고 재생 중</h3><div class="big num" id="adc">3</div><p class="note">보상형 광고 자리예요(시뮬레이션). 끝까지 보면 하트 1개를 받고, 광고 수익 12원이 모두의 기부에 쌓여요.</p>`);
  const t = setInterval(() => {
    s--; const el = $('#adc'); if(el) el.textContent = s;
    if(s <= 0){ clearInterval(t); const d = dayState(); d.ads++; saveDay(d); addHearts(1); const aw = store.get('hp:adsWeek', {}), wk = weekStartKey(); aw[wk] = (aw[wk] || 0) + 1; store.set('hp:adsWeek', aw); closeModal(); sfx('heartGet'); setTimeout(() => sfx('coin'), 250); fxPop($('#heartChip'), 'heart'); toast('하트 +1 · 모두의 기부 +12원, 고마워요!'); renderHome(); }
  }, 1000);
}
function openInbox(){
  const d = dayState(), gifts = giftsToday();
  const rows = gifts.map(n => { const i = FRIENDS.findIndex(x => x.name === n), got = d.claimed.includes(n);
    return `<div class="gift${got ? ' got' : ''}">${avatar(FRIENDS[i])}<span><b>${n}</b>님이 하트를 보냈어요${got ? ' · 받음' : ''}</span>${hi()}</div>`; }).join('');
  const pending = gifts.filter(n => !d.claimed.includes(n));
  openModal(`<h3>받은 하트</h3><div style="margin:10px 0">${rows}</div><p class="note">받은 하트는 5개를 넘겨서도 쌓여요.</p>
    <div class="mbtns${pending.length ? '' : ' one'}"><button class="b2" id="mClose">닫기</button>${pending.length ? `<button class="b1" id="mClaim">모두 받기 · ${ic('heart')} ${pending.length}</button>` : ''}</div>`);
  $('#mClose').onclick = closeModal;
  if(pending.length) $('#mClaim').onclick = () => { fxPop($('#mClaim'), 'heart'); sfx('heartGet'); const dd = dayState(); dd.claimed.push(...pending); saveDay(dd); addHearts(pending.length); closeModal(); toast('하트 ' + pending.length + '개를 받았어요'); renderHome(); };
}

/* 게임 방법(? 버튼, 첫 판 자동) — 여는 동안 시간 멈춤 */
const duelNoStop = () => !!(G && G.duel && !G.duel.fleet);
function gPause(){ if(!G || G.over || G.paused || duelNoStop()) return false; G.paused = true; G.pauseAt = Date.now(); return true; }
function gResume(){ if(!G || !G.paused) return; G.pausedMs += Date.now() - G.pauseAt; G.paused = false; G.lt = 0; }
function openHelp(id, first){
  if(duelNoStop() && !G.over){ duelRulesToggle(); return; }
  const paused = gPause();
  openModal(`<h3>${GAMES[id].name} 방법</h3><div class="help">${HELP[id].concat(id === 'fox' ? foxHelpExtra() : []).map((s, i) => `<div class="hstep"><span class="hn" style="background:${GAME_META[id].col}">${i + 1}</span><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('')}</div>
    <div class="mbtns one"><button class="b1" id="mOk">${first ? '시작하기' : '계속하기'}</button></div>`);
  $('#mOk').onclick = () => { closeModal(); if(paused) gResume(); };
}
function confirmQuit(){
  if(!G || G.over){ goHome(); return; }
  const paused = gPause();
  openModal(`<h3>그만할까요?</h3><p class="note">${G.adv ? '지금 나가면 이번 도전은 기록되지 않아요. 솔로는 언제든 무료로 다시 할 수 있어요.' : G.duel ? '지금 나가면 이번 대전은 기권패예요. 대전 점수는 받지 못하고 쓴 하트도 돌아오지 않아요.' + (duelNoStop() ? ' 시간은 계속 가요.' : '') : (G.attempt === 1 ? '지금 나가면 여기까지 진행한 만큼(최대 300점)만 공식 점수로 기록돼요. 오늘 이 문제의 공식 답안은 한 번뿐이에요.' : '연습 판이라 나가도 공식 기록은 그대로예요.')}</p>
    <div class="mbtns two"><button class="b2" id="mQuit">${G.adv ? '그만하기' : G.duel ? '기권하고 나가기' : G.attempt === 1 ? '여기서 제출하기' : '연습 그만하기'}</button><button class="b1" id="mStay">계속하기</button></div>`);
  $('#mStay').onclick = () => { closeModal(); if(paused) gResume(); };
  $('#mQuit').onclick = () => {
    if(!G.adv && !G.duel && G.attempt === 1){ const d = dayState(), part = Math.round(examProgress() * 300); d.best[G.id] = part; d.offDone = d.offDone || {}; d.offDone[G.id] = 1; if(!d.att) d.att = true; saveDay(d); toast(GAMES[G.id].name + ' 부분 점수 ' + fmt(part) + '점을 기록했어요'); }
    G.over = true; closeModal(); goHome(); };
}
function welcome(){
  openModal(`<p class="kick">TODAY'S EXAM</p><h3>오늘의 시험지가<br>도착했습니다</h3><p class="note"><b>같은 문제, 다른 점수.</b> 전 국민이 같은 퍼즐을 풀어요. 차이는 실력뿐!</p><div class="help">
    <div class="hstep"><span class="hn" style="background:var(--primary)">${ic('brain')}</span><div><b>5과목 시험지</b><span>논리·집중·공간·전략·추리 과목마다 퍼즐 한 문제씩. 전 국민이 같은 문제를 풀고 자정에 바뀌어요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:var(--g-sudoku)">${ic('check')}</span><div><b>첫 판이 공식 답안(무료)</b><span>과목마다 처음 푼 점수만 기록돼요. 다시 풀기는 같은 문제로 연습(♥1)이에요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:var(--grit)">${ic('clock')}</span><div><b>요일 난이도</b><span>월·화 쉬움 → 수·목·금 보통 → 토·일 어려움. 오늘은 ${examLabel()}이에요.</span></div></div>
    <div class="hstep"><span class="hn" style="background:var(--g-tower)">${ic('trophy')}</span><div><b>성적표와 도전장</b><span>같은 문제를 푼 사람 중 등수로 과목마다 수·우·미·양·가. 친구에게 같은 문제 도전장을 보내 보세요.</span></div></div></div>
    <div class="mbtns"><button class="b2" id="wLater">둘러볼게요</button><button class="b1" id="wGo">시험 시작</button></div>`);
  const done = () => store.set('hp:welcome', 3);
  $('#wLater').onclick = () => { done(); closeModal(); };
  $('#wGo').onclick = () => { done(); closeModal(); quickStart(pickNext()); };
}

function lossProgress(){
  if(NG[G.id]) return NG[G.id].lossText();
  if(G.id === 'fox') return `여우 ${G.placed}/${G.total || G.N}마리까지 놓았어요.`;
  if(G.id === 'sudoku'){ const empty = Math.round(500 / G.perCell); return `빈칸 ${Object.keys(G.earnedCells).length}/${empty}개를 채웠어요.`; }
  if(G.id === 'ball') return `블록 ${G.broken}/${G.total}개를 깼어요${G.next < G.rowsN ? ' · 남은 줄 ' + (G.rowsN - G.next) + '줄' : ''}.`;
  if(G.id === 'fleet') return `적 함선 ${G.enSunk ? G.enSunk.length : 0}/5척을 격침했어요.`;
  return `무리 ${G.cleared || 0}/${G.waves.length}번째까지 막았어요.`;
}
/* 성공한 판의 게임 점수(배율 포함). 결과 창과 대전 판정에 같이 쓴다 */
function calcScore(){
  const id = G.id, sec = elapsed(), lim = G.limit, L = G.L;
    let time = Math.max(0, 350 - Math.floor(sec * 350 / lim)), paw = G.paws * 50, base = id === 'sudoku' || id === 'fox' ? Math.round(G.earned) : 500;
    let l1 = id === 'sudoku' ? '칸 채우기' + (G.hintUsed ? ' (힌트 ' + G.hintUsed + '칸 제외)' : '') : id === 'fox' ? '여우 찾기' + (G.hintUsed ? ' (힌트 ' + G.hintUsed + '마리 제외)' : '') : '클리어';
    let l2 = '시간 보너스 (' + mmss(sec) + ')';
    let l3 = id === 'sudoku' ? '실수 ' + (3 - G.paws) + '번' : '남은 기회 별 ' + G.paws + '개';
    if(id === 'ball'){ time = Math.max(0, 350 - Math.max(0, G.turn - G.R) * 30); paw = (G.shield ? 100 : 0) + (G.itemUsed ? 0 : 50); l1 = '스테이지 클리어'; l2 = '턴 보너스 (' + G.turn + '턴, 기준 ' + G.R + '턴)'; l3 = (G.shield ? '방어막 지킴' : '방어막 씀') + ' · ' + (G.itemUsed ? '아이템 씀' : '아이템 안 씀'); }
    if(id === 'fleet'){ const n = flShotN(); base = 500; time = Math.round(350 * Math.max(0, Math.min(1, (100 - n) / 83))); paw = Math.round(150 * G.myLeft / FL_TOTAL);
      l1 = G.forfeit ? '승리 (상대 기권)' : '승리'; l2 = '명중률 보너스 (' + n + '발 중 ' + G.hitsN + '명중)'; l3 = '남은 내 함선 ' + G.myLeft + '/' + FL_TOTAL + '칸'; }
    if(id === 'tower'){ base = 500; time = Math.round(350 * G.lives / 10); paw = Math.min(150, G.hand.length * 25); l1 = '숲 지키기 성공'; l2 = '남은 도토리 보너스 (' + G.lives + '/10개)'; l3 = '남은 씨앗 카드 ' + G.hand.length + '장'; }
    if(NG[id]){ const q = NG[id].score(); base = q.base; time = q.time; paw = q.extra; [l1, l2, l3] = q.rows; }
  return { base, time, paw, l1, l2, l3, score:Math.round((base + time + paw) * L.mult) };
}
function finish(win){
  if(G.over) return; G.over = true; clearInterval(tick);
  ambStop();
  if(win && (G.id === 'ball' || G.id === 'tower')){ sfx('win', { g:G.id }); fxBuzz([30, 60, 30, 60, 80]); }
  if(G.adv){ advFinish(win); return; }
  if(G.duel){ duelFinish(win); return; }
  const id = G.id, sec = elapsed(), lim = G.limit, L = G.L;
  const d = dayState(), r0 = myPos(d), before = r0.b.filter(x => !x.me && x.score < meScore(r0.b)).map(x => x.name);
  const firstToday = !d.att; if(firstToday){ d.att = true; saveDay(d); }
  const official = G.attempt === 1;   /* v9: 그날 첫 판만 공식 기록 */
  let gp = null; const gritPill = () => firstToday ? (gp = gp || attPillHtml()) : '';
  const gradePill = sc => { const t = examTop(id, sc); return t == null ? '' : `<span class="pill ${official ? 'new' : 'info'}">${subjOf(id)} ${gradeOf(t)} · 같은 문제 푼 사람 중 상위 ${t}%${official ? '' : ' (연습 기준)'}</span>`; };
  let html, score = 0, newRec = false;
  if(win){
    const q = calcScore(); const { base, time, paw, l1, l2, l3 } = q; score = q.score;
    const prev = d.best[id], isBest = official;
    if(official){ d.best[id] = score; saveDay(d); newRec = true; }
    if(!d.itemDone && d.set && d.set.every(g => d.best[g] > 0)){ d.itemDone = 1; saveDay(d); itemReward([['foxAuto', 1]], '오늘의 문제 5게임 완주'); }
    const d2 = dayState(), r1 = myPos(d2);
    const passed = r1.b.filter(x => !x.me && x.score < meScore(r1.b)).map(x => x.name).filter(n => !before.includes(n));
    const tl2 = myTL();
    const rank = r1.pos < r0.pos ? `<span class="pill good">${r0.pos}위 → ${r1.pos}위 ▲${r0.pos - r1.pos}</span>` : `<span class="pill info">지금 친구 ${r1.n}명 중 ${r1.pos}위</span>`;
    html = `<div class="burst" aria-hidden="true"></div><h3 class="ok">${id === 'fleet' ? '승리! 적 함대 전멸' : '클리어!'}</h3><div class="big" id="bigScore">0</div>
      ${isBest ? '<p class="note">공식 답안으로 기록됐어요</p>' : `<p class="note">연습 판이에요 · 공식 기록 ${fmt(prev)}점은 그대로예요</p>`}<div>${gradePill(score)}</div>
      <div>${gritPill()}${rank}${passed.length ? `<span class="pill good">${passed.join(', ')}님을 제쳤어요 · 알림을 보냈어요</span>` : ''}</div>
      <details class="brk"><summary>점수 자세히</summary><div><span>${l1}</span><b>${base}</b></div><div><span>${l2}</span><b>${time}</b></div><div><span>${l3}</span><b>${paw}</b></div><div><span>${examLabel()} 시험지</span><b>배율 없음</b></div><div><span>오늘 점수(5과목 공식 기록 합)</span><b>${fmt(tl2.score)}점</b></div></details>
      <div>${d2.set.every(g => d2.tries[g] > 0) ? `<span class="pill info">${ic('globe')} 오늘 시험지 전국 ${topTxt(worldStat(tl2.score).top)}</span>` : ''}${firstToday && STREAK_MS.includes(tl2.streak) ? `<span class="pill fire">${ic('flame')} 연속 ${tl2.streak}일 달성!</span>` : ''}</div>${chalBox(score)}
      <div class="shrow">${canChal() ? `<button class="btn small primary" id="mChal">${ic('duel')} ${G.chal && G.chal.n ? '되갚기 도전장' : '친구에게 도전장'}</button>` : ''}<button class="btn small gold" id="mShareR">${ic('share')} ${firstToday && STREAK_MS.includes(tl2.streak) ? '연속 ' + tl2.streak + '일 자랑하기' : '결과 카드 공유'}</button></div>`;
  } else {
    const best = d.best[id], part = official ? Math.round(examProgress() * 300) : 0;
    if(official){ d.best[id] = part; d.offDone = d.offDone || {}; d.offDone[id] = 1; saveDay(d); score = part; }
    html = `<h3 class="bad">${id === 'fleet' ? '패배 · 우리 함대가 침몰했어요' : '이번 판은 실패'}</h3><p class="lose">${official ? '부분 점수 ' + fmt(part) + '점을 공식 기록했어요' : best ? '연습 판이에요 · 공식 기록 ' + fmt(best) + '점은 그대로예요' : '연습 판이에요'}</p>
      <p class="note">${lossProgress()} ${official ? '진행한 만큼(최대 300점) 인정돼요. 같은 문제로 연습할 수 있어요.' : '같은 문제로 다시 연습할 수 있어요.'}</p>${official && part ? `<div>${gradePill(part)}</div>` : ''}
      ${firstToday ? `<div>${gritPill()}</div><p class="note">실패해도 끝까지 한 판은 출석으로 인정돼요.</p>` : ''}${chalBox(0)}`;
  }
  const other = nextUnplayed(id), againLbl = '같은 문제 연습';
  const nextLv = G.lv;
  let pri, sec2, gh = null;
  if(win && other){ pri = ['다음 게임: ' + GAMES[other].name, () => { goHome(); quickStart(other); }]; sec2 = [againLbl + ' ' + costTag(), () => startGame(id, nextLv)]; gh = ['홈으로', goHome]; }
  else { pri = [againLbl + ' ' + costTag(), () => startGame(id, nextLv)]; sec2 = ['홈으로', goHome]; }
  html += `<div class="mbtns"><button class="b2" id="mSec">${sec2[0]}</button><button class="b1" id="mPri">${pri[0]}</button></div>${gh ? `<button class="btn ghost" id="mGh">${gh[0]}</button>` : ''}`;
  setTimeout(() => {
    const bindRes = () => {
      $('#mPri').onclick = () => { closeModal(); pri[1](); };
      $('#mSec').onclick = () => { closeModal(); sec2[1](); };
      if(gh) $('#mGh').onclick = () => { closeModal(); gh[1](); };
      const reopen = () => { openModal(html); const b2 = $('#bigScore'); if(b2) b2.textContent = fmt(score); bindRes(); };
      const shr = $('#mShareR'); if(shr) shr.onclick = () => openShare(reopen);
      const chb = $('#mChal'); if(chb) chb.onclick = () => viralShare(cardChal(id, dayState().best[id] || score, G.lv), reopen);
    };
    openModal(html);
    if(win && id !== 'fox' && id !== 'fleet') fxConfetti();
    if(win) sfx('result'); else sfx('lose');
    bindRes();
    const el = $('#bigScore');
    if(el){ const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900; let lastTk = 0;
      /* 점수가 올라가는 동안 '틱' 소리가 점점 높아지고, 다 오르면 '딩' + 금빛 폭죽 */
      const step = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(score * e));
        if(k < 1){ if(t - lastTk > 55){ lastTk = t; sfx('tick', { p:e }); } requestAnimationFrame(step); }
        else if(el.isConnected){ el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); fxBuzz(20);
          if(newRec) setTimeout(() => { const pl = $('#modal .pill.new'); if(pl){ sfx('newRecord'); fxPop(pl, 'spark'); } }, 380); } };
      requestAnimationFrame(step); }
  }, win ? 500 : 250);
}
function goHome(){ ambStop(); duelClose(); if(G && G.cleanup){ try{ G.cleanup(); }catch(_){} G.cleanup = null; } document.body.classList.remove('fxmode', 'flmode'); delete document.body.dataset.mode; clearInterval(tick); if(G && G.raf) cancelAnimationFrame(G.raf); $('#play').style.display = 'none'; $('#home').style.display = 'block'; renderHome(); window.scrollTo(0,0); }
function renderPaws(){
  const p = $('#paws'); const prev = +(p.dataset.n || 3);
  p.innerHTML = [0,1,2].map(i => ic('paw', i >= G.paws ? 'off' + (i === G.paws && G.paws < prev ? ' lost' : '') : '')).join('');
  p.dataset.n = G.paws; p.setAttribute('aria-label', '남은 기회 ' + G.paws + '번');
}

let G = null, tick = null;

function startGame(id, lv = 'normal', o = {}){
  const adv = o.adv || 0, duel = o.duel || null;
  if(adv && !o.cardDone){ const p0 = planOf(id, adv); if(p0.intro && !store.get('hp:seenC:' + id + ':' + p0.intro, 0)){ conceptCard(id, adv, () => startGame(id, lv, Object.assign({}, o, { cardDone:true }))); return; } }
  const freeRun = !adv && !duel && !(dayState().tries[id] > 0);   /* v9: 시험지 첫 판(공식 답안)은 무료 */
  if(!adv && !freeRun && !spendHeart()){ openHeartSheet('empty'); return; }
  if(!adv && !freeRun) sfx('heartUse'); if(!duel || duel.fleet) sfx('start');
  if(G && G.cleanup){ try{ G.cleanup(); }catch(_){} G.cleanup = null; }
  if(G && G.raf) cancelAnimationFrame(G.raf);
  let attempt = 0;
  if(!adv && !duel){ const d = dayState(); d.tries[id]++; saveDay(d); attempt = d.tries[id]; }
  let L = levelOf(id, lv, adv);
  if(!adv && !duel) L = Object.assign({}, L, { mult:1 });   /* v9: 시험지는 배율 없음 */
  if(adv) lv = id === 'fleet' ? L.ai : 'adv';
  const rng = adv ? mulberry(seedFrom('adv:' + id + ':' + adv)) : duel ? mulberry(seedFrom(duel.seed || ('duel:' + id + ':' + Date.now()))) : mulberry(seedFrom('exam:' + dayKey() + ':' + id));   /* v9: 전 국민 같은 문제 */
  G = { id, lv, adv, duel, L, attempt, chal:o.chal || null, paws:3, start:Date.now(), over:false, limit:L[id].limit, paused:false, pauseAt:0, pausedMs:0 };
  if(id === 'fox'){
    Object.assign(G, { N:L.fox.N, rng, reg:null, cells:[], placed:0, earned:0, hints:FOX_ITEM_PER_GAME, autos:FOX_ITEM_PER_GAME, hist:[], hintUsed:0, combo:0 });
    if(adv) foxAdvInit();
  } else if(id === 'ball'){
    ballInit(genBall(rng, L.ball));
  } else if(id === 'tower'){
    tdInit(L.tower.n, rng);
  } else if(id === 'fleet'){
    flInit(lv, rng);
  } else if(NG[id]){
    G.cfg = L[id]; NG[id].init(L[id], rng);
  } else {
    const X = adv ? sudGenStage(adv) : null, p = X ? X.r : genSudoku(rng, L.sudoku.givens);
    const empty = p.puz.filter(v => !v).length;
    Object.assign(G, { sol:p.sol, grid:p.puz.slice(), given:p.puz.map(v => v>0), notes:new Array(81).fill(0), wrong:new Array(81).fill(false),
      sel:-1, memo:false, hints:3, hintUsed:0, undo:[], earned:0, earnedCells:{}, perCell:500/empty, scombo:0, done:false });
    if(X) sudSxInit(X);
    G.uDone = sudUnitsDone();
  }
  $('#home').style.display = 'none'; $('#play').style.display = 'block';
  $('#ptitle').innerHTML = GAMES[id].name + (adv ? `<small>솔로 · ${chName(id, chOf(adv))} · 스테이지 ${adv}${id === 'tower' ? ' · ' + G.mapName : ''}</small>` : duel ? `<small>대전 · ${duel.fleet ? (lv === 'pvp' ? '실시간 1:1' : 'AI 함장') : 'VS ' + flEsc(duel.opp.nick) + (duel.mode === 'ai' ? ' (AI)' : '')} · ${L.name}${id === 'tower' ? ' · ' + G.mapName : ''}</small>` : `<small>${L.name}${id === 'tower' ? ' · ' + G.mapName : ''} · 오늘 ${attempt}번째 판 · 친구와 같은 문제</small>`);
  $('.stats').style.display = 'none'; document.body.dataset.mode = id; document.body.classList.toggle('fxmode', id === 'fox'); document.body.classList.toggle('flmode', id === 'fleet');
  $('#paws').dataset.n = 3; $('#fcount').textContent = ''; renderPaws(); renderStage();
  duelBarInit();
  if((!duel || duel.fleet) && !store.get('hp:help:' + id, false)){ store.set('hp:help:' + id, 1); setTimeout(() => { if(G && !G.over) openHelp(id, true); }, 50); }
  clearInterval(tick);
  tick = setInterval(updateClock, 250); updateClock();
  ambStart(ambFor(id));
  window.scrollTo(0,0);
}

function elapsed(){
  /* 대전: 시작 후엔 멈추지 않는 시계(다 풀어 멈춘 순간만 고정). 시작 전(카운트다운)은 0 */
  if(G.duel && !G.duel.fleet) return G.duel.go ? Math.max(0, ((G.paused && G.done && G.pauseAt ? G.pauseAt : Date.now()) - G.start) / 1000) : 0;
  return ((G.paused ? G.pauseAt : Date.now()) - G.start - G.pausedMs) / 1000;
}
function clock2(sec){ sec = Math.floor(sec); return String(Math.floor(sec/60)).padStart(2,'0') + ':' + String(sec%60).padStart(2,'0'); }
function updateClock(){
  if(!G || G.over) return;
  const c = $('#clock'); if(c) c.textContent = mmss(elapsed());
  const sc = $('#sclock'); if(sc) sc.textContent = clock2(elapsed());
  if(G.duel) duelTick();
}

function renderStage(){
  const st = $('#stage');
  if(G.id === 'fox'){
    foxStage(st);
  } else if(G.id === 'ball'){
    ballStage(st);
  } else if(G.id === 'tower'){
    tdStage(st);
  } else if(G.id === 'fleet'){
    flStage(st);
  } else if(NG[G.id]){
    NG[G.id].render(st);
  } else {
    sudStage(st);
  }
}
