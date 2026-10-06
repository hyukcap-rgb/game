/* 플레이 엔진: 게임 하나를 시작·진행·끝내는 공용 부분. 사이트(portal/)와 붙여 쓰는 모듈(embed/)이 같이 쓴다.
   - 어떤 게임인지는 모른다. 게임마다 다른 것은 모두 게임 정의 NG[id](games/<id>/)에 있다.
   - 사이트·모듈마다 다른 것(하트, 기록, 결과 창, 나가기)은 HOST가 정한다. */
const HOST = {
  heartCost:false,          /* true면 버튼에 하트 1개 표시(사이트) */
  flatMult:false,           /* true면 오늘의 문제는 난이도 배율 없이 */
  soloFreeNote:'솔로는 언제든 다시 할 수 있어요.',
  duelQuitNote:'',
  beforeStart:(id, lv, o) => ({ attempt:0 }),
  showPlay(){ $('#play').style.display = 'block'; },
  subtitle:(L, attempt, ex) => L.name + ex,
  quitInfo:() => ({ note:'지금 나가면 이번 판은 기록되지 않아요.', label:'그만하기' }),
  finish(win){},
  exit(){},
  canDuel:() => true,
  duelRewardHtml:() => '',
  duelResult(r, a, b){},
  historyGuard:false,       /* true면 뒤로가기(안드로이드 버튼·iOS 밀기)를 엔진이 받아 처리(사이트). 모듈은 붙인 곳의 방문 기록을 건드리지 않게 기본 끔 */
  back:() => false          /* 뒤로가기: 창·판이 없을 때 HOST가 먼저 처리하면 true(사이트: 다른 탭 → 오늘 탭) */
};

const SVG = {
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5l-1.3-1.2C5.4 14.5 2 11.4 2 7.6 2 4.5 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.5 22 7.6c0 3.8-3.4 6.9-8.7 11.7z"/></svg>',
  heartO:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 19.5l-1-.9C5.9 14 3 11.2 3 7.8 3 5.1 5.1 3 7.7 3c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2C18.9 3 21 5.1 21 7.8c0 3.4-2.9 6.2-8 10.8z"/></svg>',
  paw:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6.5" cy="9.5" r="2.2"/><circle cx="10.5" cy="5.8" r="2.2"/><circle cx="15.3" cy="6.3" r="2.2"/><circle cx="18.7" cy="10.4" r="2"/><path d="M12.2 11c3 0 6 4.1 6 6.6 0 2-1.7 2.6-3 2.6-1.2 0-2-.8-3-.8s-1.8.8-3 .8c-1.3 0-3-.6-3-2.6 0-2.5 3-6.6 6-6.6z"/></svg>',
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
const costTag = () => HOST.heartCost ? `<span class="cost">${ic('heart')}1</span>` : '';
/* 게임 표: registerGames()가 게임 정의에서 채운다 */
const GAMES = {}, GAME_META = {}, GAME_IDS = [], GCOL = {}, HELP = {}, ADV_CH = {}, ADV_RULE = {}, ABIL = {}, ART = {};
/* 오늘의 문제·연습 난이도 이름과 점수 배율(게임별 판 크기는 게임 정의 levels) */
const LEVELS = { easy:{ name:'쉬움', mult:0.6 }, normal:{ name:'보통', mult:1.0 }, hard:{ name:'어려움', mult:1.4 } };
/* ===================== 난이도 v2: 개념 사이클 (기획팀, 2026-09-30 · 17·18번 문서) =====================
   벤치마크: 로얄 매치(약 8판마다 새 블록, 5·9로 끝나는 판 어려움, 10판마다 아주 어려움), 컷 더 로프(박스마다 새 기믹),
   닌텐도 기승전결(소개 → 전개 → 반전 → 정리). → 5판마다 새 개념 하나.
   챕터(10판) 자리 k: 1 새 규칙 소개(쉬움) · 2~3 익히기 · 4 섞기(이전 규칙과) · 5 어려움 · 6 변주 소개(쉬움) · 7~8 규칙+변주 · 9 쉬어가기 · 10 보스(규칙+이전 규칙+변주, 아주 어려움)
   챕터 1은 기본 규칙만(6부터 첫 변주). 새 규칙은 11·21·31·41, 변주는 6·16·26·36·46. 51부터는 리믹스(배운 규칙 2개를 챕터마다 바꿔 섞음).
   게임 쪽 계약: 개념 목록 = NG[id].concepts 또는 CONCEPTS[id] = { order:[새 규칙 키 4개], info:{키:{name,desc}}, twists:[변주 키…], twInfo?:{키:{name,desc}} }
                 또는 이미 등장 판이 정해진 게임은 { fixed:[{ at, key, name, desc }] } (카드·표시만).
                 각 게임의 stage(n)/advLevel은 planOf(id, n)을 읽어 mj(켜진 규칙)·tw(변주)·easy/hard/boss를 반영한다. */
const TWISTS = {
  flash:{ name:'빠른 판', desc:'시간(또는 기준 이동·턴)이 짧아요. 빠르고 정확하게!' },
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
  else if(p.mj.length) bits.push((p.remix ? '섞기' : '규칙') + ': ' + p.mj.map(nm).join(' + '));
  if(p.tw && p.intro !== p.tw) bits.push('변주: ' + nm(p.tw));
  if(p.boss) bits.unshift('대장 판(아주 어려움)'); else if(p.hard) bits.unshift('어려움');
  return bits.join(' · ');
}
function stageClass(id, n){ const p = planOf(id, n); return (p.boss ? ' xhard' : p.hard ? ' hard' : '') + (p.intro ? ' newc' : ''); }
/* 새 개념을 처음 만나는 판: 시작 전에 규칙 카드 한 장 */
function conceptCard(id, n, go){
  const p = planOf(id, n), inf = conceptInfo(id, p.intro); if(!inf){ go(); return; }
  const tw = p.introKind === 'twist';
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">처음 나와요</p><div class="ttl">${tw ? '새 변주' : '새 규칙'} · ${inf.name}</div>
    <div class="ncard" style="--gc:${GCOL[id][1]}"><span class="nc-ic">${ic(id)}</span><p>${inf.desc}</p></div>
    <p class="note">스테이지 ${n} · ${GAMES[id].name}<br>${tw ? '익숙한 판에 조건 하나가 더해져요.' : p.fixed ? '이 판부터 새로 나와요. 챕터 끝 대장 판에서 제대로 시험해요!' : '첫 판은 이 규칙만 나와서 쉬워요. 챕터 끝 대장 판에서 제대로 시험해요!'}</p>
    <div class="mbtns one"><button class="b1" id="ncGo">도전!</button></div>`);
  $('#modal').classList.add('celebrate'); sfx('fanfare');
  $('#ncGo').onclick = () => { store.set('hp:seenC:' + id + ':' + p.intro, 1); closeModal(); go(); };
}
const NG = {};   /* 게임 정의: games/<id>/ 파일이 NG.<id> = {...}로 넣는다 */
/* ---- 게임 등록: games/<id>/의 NG.<id> 정의를 엔진 표에 합친다. order = 화면에 보일 게임 순서(사이트·모듈이 정함) ---- */
function registerGames(order){
  const ids = (order || []).filter(id => NG[id]).concat(Object.keys(NG).filter(id => !(order || []).includes(id)));
  GAME_IDS.length = 0;
  for(const id of ids){
    const m = NG[id];
    GAMES[id] = { name:m.name, ico:'', rule:m.help.map(h => h[1]).join(' ') };
    GAME_META[id] = { col:m.col[1], time:m.time };
    GCOL[id] = m.col; HELP[id] = m.help; ADV_CH[id] = m.chapters; ADV_RULE[id] = m.starRule; ABIL[id] = m.abil;
    SVG[id] = m.icon; ART[id] = () => m.art();
    GAME_IDS.push(id);
    if(m.css && !document.querySelector(`style[data-ng="${id}"]`)){ const el = document.createElement('style'); el.dataset.ng = id; el.textContent = m.css; document.head.appendChild(el); }
    if(m.sounds) Object.assign(SFX_LIB, m.sounds);
    if(m.gate && typeof m.gate === 'object') Object.assign(SFX_GATE, m.gate);   /* 소리 간격(객체). 함수 gate는 시작 전 관문(startGateOf) */
    if(m.jingle) WIN_JINGLE[id] = m.jingle;
  }
}
/* 게임 화면 위 막대(그만하기·도움말) 단추 */
function playChromeInit(){
  $('#quitBtn').innerHTML = ic('back'); $('#helpBtn').innerHTML = ic('help');
  $('#quitBtn').onclick = confirmQuit;
  $('#helpBtn').onclick = () => { if(G && !G.over) openHelp(G.id); };
}

const HEART_G = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 35.5l-2.2-2C9 25.6 3.5 20.6 3.5 14.3 3.5 9.1 7.6 5 12.8 5c2.9 0 5.7 1.4 7.2 3.6C21.5 6.4 24.3 5 27.2 5c5.2 0 9.3 4.1 9.3 9.3 0 6.3-5.5 11.3-14.3 19.2z" fill="url(#gHeart)" stroke="#7A0B3C" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="12.5" cy="12" rx="4.2" ry="2.8" transform="rotate(-30 12.5 12)" fill="#fff" opacity=".75"/><circle cx="17.2" cy="9.4" r="1.2" fill="#fff" opacity=".8"/></svg>';
const MAIL_G = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="19" rx="4" fill="url(#gMail)" stroke="#1A0F45" stroke-width="2.2"/><path d="M4.5 9l11.5 9 11.5-9" fill="none" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/><path d="M13 16.5c0-1.5 1.1-2.6 2.5-2.6.2 0 .4 0 .5.1.1-.1.3-.1.5-.1 1.4 0 2.5 1.1 2.5 2.6 0 1.8-3 3.8-3 3.8s-3-2-3-3.8z" fill="#FF3D7F"/></svg>';
const hi = (cls = '') => `<span class="hi ${cls}" aria-hidden="true">${HEART_G}</span>`;

/* ===== 공용 캐릭터(디자인팀 v3): 3D 비닐 장난감 질감. 사이트 전체의 동물은 모두 이 그림을 쓴다 =====
   평면 도형을 SVG 조명 필터(확산광+반사광)로 부풀려 광택·그늘을 만든다. 외곽선 없음, 색 하나 + 실루엣.
   종류: fox octopus whale chick frog owl panda rabbit bear cat dog tiger (모두 직접 그린 오리지널)
   HTML에는 toyImg(kind, cls, mood), SVG 안에는 toyImage(kind,x,y,w,h,mood), 주소만 필요하면 toySrc(kind, mood)
   v4(2026-10-03): 뒤쪽 테두리빛(림 라이트) + 표정 mood: '' 기본 · 'joy' 기쁨 · 'sad' 아쉬움 · 'wow' 놀람 */
const TOY = (() => {
  const PUFF = (id, blur, scale, spec, rim) => `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="${scale}" diffuseConstant="1" lighting-color="#fff" result="d0"><feDistantLight azimuth="250" elevation="62"/></feDiffuseLighting>
    <feGaussianBlur in="d0" stdDeviation=".9" result="d"/>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1=".88" k2=".17" result="sh"/>
    <feSpecularLighting in="h" surfaceScale="${scale}" specularConstant="${spec}" specularExponent="10" lighting-color="#fff" result="s0"><feDistantLight azimuth="240" elevation="66"/></feSpecularLighting>
    <feGaussianBlur in="s0" stdDeviation="1.4" result="s"/>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sm"/>
    <feComposite in="sh" in2="sm" operator="arithmetic" k2="1" k3=".42" result="o"/>${rim ? `
    <feOffset in="SourceAlpha" dx="-${rim}" dy="-${rim * 1.15}" result="rf"/>
    <feComposite in="SourceAlpha" in2="rf" operator="out" result="r0"/>
    <feGaussianBlur in="r0" stdDeviation="${rim * .5}" result="r1"/>
    <feFlood flood-color="#E6F2FF" flood-opacity=".5"/>
    <feComposite in2="r1" operator="in" result="r2"/>
    <feMerge result="o2"><feMergeNode in="o"/><feMergeNode in="r2"/></feMerge>
    <feComposite in="o2" in2="SourceAlpha" operator="in"/>` : `
    <feComposite in="o" in2="SourceAlpha" operator="in"/>`}
  </filter>`;
  const DEFS = PUFF('pb', 7, 4.2, .8, 2.4) + PUFF('pm', 3.6, 3.2, .7, 1.4) + PUFF('ps', 1.6, 3, 1)   /* v4: 큰 몸통·중간 부분에 뒤쪽 테두리빛(림 라이트) */
    + `<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="gs" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#101845" stop-opacity=".35"/><stop offset="1" stop-color="#101845" stop-opacity="0"/></radialGradient>`;
  /* v4 표정: 결과·대전 같은 순간에만 쓴다(계속 움직이지 않음). '' 기본 · joy 기쁨 · sad 아쉬움 · wow 놀람 */
  let MOOD = '', EYEN = 0;
  const EYE = (x, y, r = 5.2) => {
    const n = EYEN++;
    if(MOOD === 'joy') return `<path d="M${x - r * 1.05} ${y + r * .35}Q${x} ${y - r * 1.25} ${x + r * 1.05} ${y + r * .35}" fill="none" stroke="#231A2E" stroke-width="${(r * .62).toFixed(2)}" stroke-linecap="round"/>`;
    if(MOOD === 'wow') return EYE0(x, y, r * 1.18);
    if(MOOD === 'sad'){ const L = n % 2 === 0, bx = L ? 1 : -1;
      return EYE0(x, y + r * .15, r * .92) + `<path d="M${x - r * 1.1 * bx} ${y - r * 1.55}L${x + r * .9 * bx} ${y - r * 2.05}" stroke="#231A2E" stroke-width="${(r * .38).toFixed(2)}" stroke-linecap="round" opacity=".8"/>`
        + (L ? `<path d="M${x - r * .7} ${y + r * 1.3}q-${r * .55} ${r * 1} 0 ${r * 1.5}q${r * .55} -${r * .5} 0 -${r * 1.5}z" fill="#7FD0FF" opacity=".9"/>` : ''); }
    return EYE0(x, y, r);
  };
  const MO = (x, y, w, c, def) => {   /* 입: 기본 그림(def) 또는 표정 입 */
    if(MOOD === 'joy') return `<path d="M${x - w * 1.2} ${y - w * .25}Q${x} ${y + w * 1.9} ${x + w * 1.2} ${y - w * .25}z" fill="#5A1E2E"/><path d="M${x - w * .6} ${y + w * .75}q${w * .6} -${w * .5} ${w * 1.2} 0q-${w * .6} ${w * .55} -${w * 1.2} 0z" fill="#FF7A92"/>`;
    if(MOOD === 'sad') return `<path d="M${x - w * .9} ${y + w * .55}Q${x} ${y - w * .45} ${x + w * .9} ${y + w * .55}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    if(MOOD === 'wow') return `<ellipse cx="${x}" cy="${y + w * .3}" rx="${w * .5}" ry="${w * .7}" fill="#5A1E2E"/>`;
    return def;
  };
  const EYE0 = (x, y, r = 5.2) => `<g filter="url(#ps)"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="#231A2E"/></g><ellipse cx="${x - r * .32}" cy="${y - r * .45}" rx="${r * .38}" ry="${r * .42}" fill="#fff"/><circle cx="${x + r * .35}" cy="${y + r * .4}" r="${r * .16}" fill="#fff" opacity=".85"/>`;
  const CHEEK = (x, y, c) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.8" fill="${c}" opacity=".55"/>`;
  const GL = (x, y, rx, ry, r = -25) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#gl)"/>`;
  const SH = `<ellipse cx="50" cy="92" rx="30" ry="6" fill="url(#gs)"/>`;
  const A = {
    octopus:() => SH + `<g filter="url(#pb)"><path d="M18 52C18 27 32 13 50 13S82 27 82 52c0 8 4 14 9 19-5 6-12 4-16-1-2 9-10 12-15 5-4 7-16 7-20 0-5 7-13 4-15-5-4 5-11 7-16 1 5-5 9-11 9-19z" fill="#F0364A"/></g>${GL(36, 28, 14, 8)}
      <g filter="url(#ps)"><circle cx="35" cy="27" r="4" fill="#FF8C98"/><circle cx="64" cy="24" r="3" fill="#FF8C98"/></g>
      ${EYE(40, 47)}${EYE(60, 47)}${CHEEK(30, 57, '#FF9AA8')}${CHEEK(70, 57, '#FF9AA8')}${MO(50, 59, 5, '#7A0F1E', '<path d="M45 58q5 5 10 0" fill="none" stroke="#7A0F1E" stroke-width="2.6" stroke-linecap="round"/>')}`,
    whale:() => SH + `<g filter="url(#pm)"><path d="M50 30c0-8-1-13-1-16" stroke="#6CC3FF" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M49 18c-4-8-12-9-16-4M51 18c4-8 12-9 16-4" stroke="#6CC3FF" stroke-width="5" stroke-linecap="round" fill="none"/></g>
      <g filter="url(#pb)"><path d="M12 60c0-21 16-32 38-32s38 11 38 30c0 18-15 28-38 28S12 79 12 60z" fill="#1F74E0"/></g>${GL(34, 40, 15, 7)}
      <g filter="url(#pm)"><path d="M24 74c9 6 43 6 52 0-5 8-14 12-26 12s-21-4-26-12z" fill="#8FC8FF"/></g>
      ${EYE(37, 54)}${EYE(63, 54)}${CHEEK(27, 63, '#7FB6FF')}${CHEEK(73, 63, '#7FB6FF')}${MO(50, 63, 5, '#0B3F86', '<path d="M45 62q5 4.5 10 0" fill="none" stroke="#0B3F86" stroke-width="2.6" stroke-linecap="round"/>')}`,
    chick:() => SH + `<g filter="url(#pm)"><path d="M45 26c-4-9 3-15 7-8 4-8 12-3 6 8z" fill="#FFB300"/><path d="M17 60c-9 1-10 13 1 13zM83 60c9 1 10 13-1 13z" fill="#FFB300"/></g>
      <g filter="url(#pb)"><circle cx="50" cy="56" r="33" fill="#FFC40D"/></g>${GL(38, 36, 14, 8)}
      ${EYE(39, 50)}${EYE(61, 50)}${CHEEK(29, 61, '#FF9C5A')}${CHEEK(71, 61, '#FF9C5A')}<g filter="url(#ps)"><path d="M42 58l8-6 8 6-8 7z" fill="#FF6A1A"/></g>`,
    frog:() => SH + `<g filter="url(#pb)"><circle cx="30" cy="35" r="14" fill="#27AE3B"/><circle cx="70" cy="35" r="14" fill="#27AE3B"/><path d="M11 63c0-18 17-28 39-28s39 10 39 28c0 16-17 25-39 25S11 79 11 63z" fill="#27AE3B"/></g>${GL(26, 27, 7, 4)}${GL(66, 27, 7, 4)}${GL(40, 46, 14, 5, -10)}
      <g filter="url(#pm)"><ellipse cx="50" cy="75" rx="22" ry="9" fill="#C6F09A"/></g>
      ${EYE(30, 35, 5.6)}${EYE(70, 35, 5.6)}${CHEEK(24, 60, '#8BE06A')}${CHEEK(76, 60, '#8BE06A')}${MO(50, 61, 9, '#0E5A17', '<path d="M36 59q14 10 28 0" fill="none" stroke="#0E5A17" stroke-width="2.8" stroke-linecap="round"/>')}`,
    owl:() => SH + `<g filter="url(#pb)"><path d="M24 34L18 10l21 13zM76 34l6-24-21 13z" fill="#8A3FEA"/><path d="M50 17c22 0 35 16 35 38 0 21-15 33-35 33S15 76 15 55c0-22 13-38 35-38z" fill="#8A3FEA"/></g>${GL(36, 28, 13, 7)}
      <g filter="url(#pm)"><circle cx="37" cy="48" r="12.5" fill="#EBDDFF"/><circle cx="63" cy="48" r="12.5" fill="#EBDDFF"/><ellipse cx="50" cy="75" rx="17" ry="10" fill="#B58CFF"/></g>
      ${EYE(37, 48, 5.8)}${EYE(63, 48, 5.8)}<g filter="url(#ps)"><path d="M45 57h10l-5 7z" fill="#FFA000"/></g>`,
    fox:() => SH + `<g filter="url(#pb)"><path d="M22 46L15 9l29 20zM78 46l7-37-29 20z" fill="#FF7A12"/><path d="M12 54c0-19 17-28 38-28s38 9 38 28c0 19-17 32-38 33-21-1-38-14-38-33z" fill="#FF7A12"/></g>${GL(36, 36, 14, 7)}
      <g filter="url(#pm)"><path d="M23 33l-3-15 13 10zM77 33l3-15-13 10z" fill="#FFD2A6"/><path d="M25 64c8-7 18-6 25 1 7-7 17-8 25-1-4 14-14 21-25 21s-21-7-25-21z" fill="#FFF3E4"/></g>
      ${EYE(37, 52)}${EYE(63, 52)}${CHEEK(27, 62, '#FF7E6B')}${CHEEK(73, 62, '#FF7E6B')}<g filter="url(#ps)"><ellipse cx="50" cy="65" rx="4.2" ry="3.2" fill="#231A2E"/></g>${MO(50, 72, 4.5, '#5A3A2A', '<path d="M50 68v2.5M46 71.5q4 3 8 0" fill="none" stroke="#5A3A2A" stroke-width="2" stroke-linecap="round"/>')}`,
    panda:() => SH + `<g filter="url(#pb)"><circle cx="25" cy="30" r="12" fill="#2C2838"/><circle cx="75" cy="30" r="12" fill="#2C2838"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="57" rx="37" ry="32" fill="#F6F7FB"/></g>${GL(36, 38, 14, 7)}
      <g filter="url(#pm)"><ellipse cx="36" cy="53" rx="9" ry="11" transform="rotate(-28 36 53)" fill="#2C2838"/><ellipse cx="64" cy="53" rx="9" ry="11" transform="rotate(28 64 53)" fill="#2C2838"/></g>
      <circle cx="37" cy="52" r="3.4" fill="#fff"/><circle cx="63" cy="52" r="3.4" fill="#fff"/>${CHEEK(25, 67, '#FFB0C0')}${CHEEK(75, 67, '#FFB0C0')}<g filter="url(#ps)"><ellipse cx="50" cy="64" rx="4.2" ry="3.2" fill="#2C2838"/></g>${MO(50, 71, 4.5, '#2C2838', '')}`
  };
  
  Object.assign(A, {
    rabbit:() => SH + `<g filter="url(#pb)"><ellipse cx="36" cy="24" rx="9" ry="20" transform="rotate(-10 36 24)" fill="#FF9EC2"/><ellipse cx="64" cy="24" rx="9" ry="20" transform="rotate(10 64 24)" fill="#FF9EC2"/></g>
      <g filter="url(#pm)"><ellipse cx="36" cy="24" rx="4" ry="13" transform="rotate(-10 36 24)" fill="#FFE0EC"/><ellipse cx="64" cy="24" rx="4" ry="13" transform="rotate(10 64 24)" fill="#FFE0EC"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="60" rx="34" ry="29" fill="#FF9EC2"/></g>${GL(38, 44, 13, 6)}
      <g filter="url(#pm)"><ellipse cx="50" cy="69" rx="14" ry="10" fill="#FFF1F6"/></g>
      ${EYE(38, 56)}${EYE(62, 56)}${CHEEK(27, 66, '#FF6FA0')}${CHEEK(73, 66, '#FF6FA0')}<g filter="url(#ps)"><ellipse cx="50" cy="65" rx="3.6" ry="2.8" fill="#E0457F"/></g>${MO(50, 72, 4.5, '#8A2A4E', '<path d="M50 67v3M46 71q4 3 8 0" fill="none" stroke="#8A2A4E" stroke-width="2.2" stroke-linecap="round"/>')}`,
    bear:() => SH + `<g filter="url(#pb)"><circle cx="24" cy="30" r="12" fill="#B06A30"/><circle cx="76" cy="30" r="12" fill="#B06A30"/></g>
      <g filter="url(#pm)"><circle cx="24" cy="30" r="6" fill="#E9B27A"/><circle cx="76" cy="30" r="6" fill="#E9B27A"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="36" ry="31" fill="#B06A30"/></g>${GL(36, 40, 14, 7)}
      <g filter="url(#pm)"><ellipse cx="50" cy="68" rx="15" ry="11" fill="#F0C995"/></g>
      ${EYE(36, 54)}${EYE(64, 54)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="5" ry="3.8" fill="#2A1B14"/></g>${MO(50, 72, 5, '#4A2A14', '<path d="M50 67v3M45 71q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/>')}`,
    cat:() => SH + `<g filter="url(#pb)"><path d="M18 46L20 12l24 18zM82 46L80 12 56 30z" fill="#8E98B5"/></g>
      <g filter="url(#pm)"><path d="M24 34l1-14 11 9zM76 34l-1-14-11 9z" fill="#FFC6D6"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="37" ry="30" fill="#8E98B5"/></g>${GL(36, 40, 14, 7)}
      <g filter="url(#pm)"><path d="M50 30v10M42 31l2 9M58 31l-2 9" stroke="#6C7593" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="50" cy="69" rx="13" ry="9" fill="#EEF1F8"/></g>
      ${EYE(36, 55)}${EYE(64, 55)}${CHEEK(26, 65, '#FF9DB6')}${CHEEK(74, 65, '#FF9DB6')}<g filter="url(#ps)"><path d="M46.5 63h7L50 67z" fill="#FF7EA2"/></g>${MO(50, 69, 5, '#3E4560', '<path d="M50 67q-3 4-6 1M50 67q3 4 6 1" fill="none" stroke="#3E4560" stroke-width="2" stroke-linecap="round"/>')}
      <path d="M14 64l12-1M15 70l11-3M86 64l-12-1M85 70l-11-3" stroke="#3E4560" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
    dog:() => SH + `<g filter="url(#pb)"><ellipse cx="50" cy="56" rx="34" ry="31" fill="#E9B46E"/></g>${GL(38, 38, 13, 7)}
      <g filter="url(#pb)"><path d="M20 30c-10 4-12 26-4 32 7-2 10-14 10-26z" fill="#8A5226"/><path d="M80 30c10 4 12 26 4 32-7-2-10-14-10-26z" fill="#8A5226"/></g>
      <g filter="url(#pm)"><ellipse cx="50" cy="69" rx="16" ry="11" fill="#FFF3E2"/><ellipse cx="64" cy="48" rx="8" ry="7" fill="#C98A48"/></g>
      ${EYE(38, 52)}${EYE(62, 52)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="5.2" ry="3.8" fill="#2A1B14"/></g>${MO(50, 72, 5, '#4A2A14', '<path d="M50 67v3M45 71q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/><g filter="url(#ps)"><path d="M47 73q3 7 6 0z" fill="#FF6E8A"/></g>')}`,
    tiger:() => SH + `<g filter="url(#pb)"><circle cx="24" cy="30" r="11" fill="#FF9420"/><circle cx="76" cy="30" r="11" fill="#FF9420"/></g>
      <g filter="url(#pm)"><circle cx="24" cy="30" r="5" fill="#FFE4C4"/><circle cx="76" cy="30" r="5" fill="#FFE4C4"/></g>
      <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="37" ry="31" fill="#FF9420"/></g>
      <g filter="url(#pm)"><path d="M50 28v9M42 30l2 7M58 30l-2 7M14 52l10 3M15 62l9 0M86 52l-10 3M85 62l-9 0" stroke="#3A2414" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="50" cy="69" rx="17" ry="11" fill="#FFF4E6"/></g>${GL(36, 40, 13, 6)}
      ${EYE(36, 53)}${EYE(64, 53)}<g filter="url(#ps)"><ellipse cx="50" cy="63" rx="4.6" ry="3.4" fill="#E0457F"/></g>${MO(50, 71, 5, '#4A2A14', '<path d="M50 66v3M45 70q5 3.5 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/>')}`
  });
  
  const src = {};
  const toySrc = (k, mood = '') => { const key = k + ':' + mood; if(src[key]) return src[key];
    let body; MOOD = mood; EYEN = 0; try{ body = (A[k] || A.fox)(); } finally { MOOD = ''; EYEN = 0; }
    return src[key] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${DEFS}</defs>${body}</svg>`).replace(/'/g, '%27'); };
  return { PUFF, DEFS, EYE, CHEEK, GL, SH, A, MO, toySrc };
})();
const toySrc = (k, mood) => TOY.toySrc(k, mood || '');
const toyImg = (k, cls = '', mood) => `<img class="toy ${cls}" src="${toySrc(k, mood)}" alt="" aria-hidden="true" draggable="false">`;
const toyImage = (k, x, y, w, h, mood) => `<image href="${toySrc(k, mood)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
/* 결과 창 제목 옆 마스코트(성공 기쁨 · 실패 아쉬움) */
const resFace = mood => toyImg('fox', 'resface', mood);
/* 이미 그려진 캐릭터 그림(img.toy)의 표정만 바꾸기: 결과 창처럼 그린 뒤에 기쁨·아쉬움을 입힐 때 */
function toyMood(root, mood){ try{ (root || document).querySelectorAll('img.toy').forEach(im => { const m = /data:image\/svg\+xml,/.test(im.src) && Object.keys(TOY.A).find(k => im.src === toySrc(k)); if(m){ im.src = toySrc(m, mood); im.classList.add('mood-' + mood); } }); }catch(_){} }
/* 친구 얼굴(토끼·곰·고양이·강아지·판다·호랑이) */
const FACE_KIND = ['rabbit','bear','cat','dog','panda','tiger'];
const FACE_BG = ['#FFD6E6','#FFE7A8','#CFE9FF','#D8F5C8','#E6DAFF','#FFE0C4'];
function animalFace(kind){ return toyImg(kind); }   /* 예전 평면 얼굴 → 공용 3D 캐릭터 */
const avatar = x => {
  if(x.me) return `<span class="av" style="--avbg:#FFE0C4">${toyImg('fox')}</span>`;
  const i = Math.max(0, typeof FRIENDS !== 'undefined' ? FRIENDS.findIndex(f => f.name === x.name) : seedFrom(String(x.name || '')) % 6);
  return `<span class="av" style="--avbg:${FACE_BG[i % 6]}">${animalFace(FACE_KIND[i % 6])}</span>`;
};

Object.assign(SVG, {
  home:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.8 11a1 1 0 0 0 .7 1.8H5V20a1 1 0 0 0 1 1h4.2v-5.5h3.6V21H18a1 1 0 0 0 1-1v-7.2h1.5a1 1 0 0 0 .7-1.8z"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3.5 3.6 5.6A1 1 0 0 0 3 6.5v13a.8.8 0 0 0 1.1.7L9 18.3l6 2.2 5.4-2.1a1 1 0 0 0 .6-.9v-13a.8.8 0 0 0-1.1-.7L15 5.7z" opacity=".5"/><path d="M9 3.5v14.8l6 2.2V5.7z"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 20.5c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0z"/></svg>'
});
const STAR_G = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l8.6 17.4 19.2 2.8-13.9 13.5 3.3 19.1L32 47.8 14.8 56.8l3.3-19.1L4.2 24.2l19.2-2.8z" fill="url(#gGold)" stroke="#1A0F45" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 22l8-14 5 11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>';

/* ---- 솔로(스테이지): 챕터·별 기록 ---- */
const chOf = n => Math.ceil(n / 10);
function chName(id, c){ const a = ADV_CH[id]; return a[(c - 1) % 5] + (c > 5 ? ' ' + ['II','III','IV','V'][Math.min(3, Math.floor((c - 6) / 5))] : ''); }
const advKey = id => (NG[id] && NG[id].saveKey) || 'hp:adv:' + id;   /* 솔로 기록 저장 이름(게임 정의 saveKey로 바꿀 수 있음) */
function advProg(id){ const p = store.get(advKey(id), null) || {}; p.stars = p.stars || {}; p.max = p.max || 1; return p; }
function advStarsOf(id){ return Object.values(advProg(id).stars).reduce((a, b) => a + b, 0); }
function advTotal(){ return GAME_IDS.reduce((s, g) => s + advStarsOf(g), 0); }
function chStars(id, c){ const p = advProg(id); let s = 0; for(let k = 1; k <= 10; k++) s += p.stars[(c - 1) * 10 + k] || 0; return s; }
function chCleared(id, c){ return !!advProg(id).stars[c * 10]; }
/* ---- 난이도(오늘의 시험지·연습) · 솔로 스테이지 설정: 모두 게임 정의에서 ---- */
function advLevel(id, n){
  const m = NG[id];
  return { name:'스테이지 ' + n, mult:1, ai:m.stageLevel ? m.stageLevel(n) : 'normal', [id]:m.stage(n) };
}
function advDesc(id, n){ return NG[id].stageDesc(n); }
function levelOf(id, lv, adv){
  if(adv) return advLevel(id, adv);
  const m = NG[id];
  if(m.levelCfg) return m.levelCfg(lv);
  const B = LEVELS[lv] || LEVELS.normal;
  return Object.assign({}, B, { [id]:m.levels[lv] || m.levels.normal });
}
function advStarCalc(){ return NG[G.id].stars(); }
function maxPts(id, lv){ return Math.round(1000 * levelOf(id, lv).mult); }
/* 마지막에 고른 난이도 기억 */
function lastLv(id){
  const lv = store.get('hp:lv:' + id, null), m = NG[id];
  if(m && m.pickLv) return m.pickLv(lv);
  return LEVELS[lv] ? lv : 'normal';
}

let SVG_UID = 0;

/* ---- 판 고르기(솔로 맵): 챕터 10칸, 10번은 대장 판. 위에 "판 번호 [  ] 가기", 판을 고르면 바닥에 내 기록 + [친구에게 보내기] [다시 풀기] ---- */
const WARMUP = n => n <= 2;   /* 몸풀기 판(솔로 1·2판) */
/* 판마다 내 가장 좋은 기록: hp:best:<게임>:<판> = { t:초, m?:수 }. 솔로 진도와 따로(다시 풀어도 갱신) */
const bestKey = (id, n) => 'hp:best:' + id + ':' + n;
function advBest(id, n){ return store.get(bestKey(id, n), null); }
function advBestSave(id, n){   /* 성공한 판이 끝날 때 엔진이 부름 → { t, m, prev, better } */
  const t = Math.max(0, Math.round(elapsed())), m0 = NG[id].recMoves ? NG[id].recMoves() : null, m = typeof m0 === 'number' && isFinite(m0) ? m0 : null;
  const prev = advBest(id, n), better = !!prev && (t < prev.t || (t === prev.t && m != null && prev.m != null && m < prev.m));
  if(!prev || better) store.set(bestKey(id, n), m != null ? { t, m } : { t });
  return { t, m, prev, better };
}
const recTxt = r => r ? clock2(r.t).replace(/^0(?=\d:)/, '') + (r.m != null ? ' · ' + r.m + '수' : '') : '';
const starTxt = s => '★'.repeat(s) + '☆'.repeat(3 - s);
function openAdvMap(id, want){
  const p = advProg(id), send = HOST.sendStage && !NG[id].noSend && !NG[id].age;   /* 판 보내기는 사이트만(HOST.sendStage). 연령 제한 게임(age)·noSend는 빼요 */
  let pick = Math.min(want || p.max, p.max), c = chOf(pick);
  const draw = () => {
    const cs = (c - 1) * 10;
    const cells = [1,2,3,4,5,10,9,8,7,6].map(k => { const n = cs + k, lock = n > p.max, s = p.stars[n] || 0;
      return `<button class="st${lock ? ' lock' : ''}${n === p.max ? ' cur' : ''}${n === pick ? ' sel' : ''}${k === 10 ? ' boss' : ''}${NG[id].stageTag ? ' ' + NG[id].stageTag(n) : stageClass(id, n)}" data-n="${n}" ${lock ? 'disabled aria-label="' + n + '판 잠김"' : 'aria-label="' + n + '판' + (k === 10 ? ' 대장 판' : WARMUP(n) ? ' 몸풀기' : '') + ', 별 ' + s + '개"'}>${lock ? ic('lock') : n}${lock ? '' : `<i>${[1,2,3].map(j => `<span class="${j <= s ? 'on' : 'off'}">★</span>`).join('')}</i>`}${WARMUP(n) && !lock ? '<em class="wu">몸풀기</em>' : ''}</button>`; }).join('');
    const canNext = p.max > c * 10, s = p.stars[pick] || 0, rec = advBest(id, pick), done = s > 0;
    const info = `<b>${pick}판</b>${WARMUP(pick) ? ' · 몸풀기' : ''} · ${rec ? '내 기록 ' + recTxt(rec) : done ? '기록 없음' : '아직 안 깼어요'}${done ? ' · <span class="stx">' + starTxt(s) + '</span>' : ''}`;
    openModal(`<h3>${GAMES[id].name} 판 고르기</h3><button class="amx" id="mClose" aria-label="닫기">✕</button>
      <form class="amgo" id="amForm"><label for="amNum">판 번호</label><input id="amNum" type="number" inputmode="numeric" min="1" max="${p.max}" placeholder="1~${p.max}" enterkeyhint="go"><button class="b2" id="amGo" type="submit">가기</button></form>
      <div class="chhead"><button type="button" id="chPrev" aria-label="이전 챕터" ${c <= 1 ? 'disabled' : ''}>${ic('chev', 'rot')}</button><div class="chname">${chName(id, c)}<small>챕터 ${c} · 별 ${chStars(id, c)}/30${chCleared(id, c) ? ' · 클리어' : ''}</small></div><button type="button" id="chNext" aria-label="다음 챕터" ${canNext ? '' : 'disabled'}>${ic('chev')}</button></div>
      <div class="path">${cells}</div>
      <p class="rule">${ADV_RULE[id]}<br>${pick}판: <b>${advDesc(id, pick)}</b>${conceptLine(id, pick) ? `<br><span class="cline">${conceptLine(id, pick)}</span>` : ''}</p>
      <p class="legend3"><span class="lg-n">새 규칙</span> · <span class="lg-h"></span> 어려움 · <span class="lg-x"></span> 대장 판</p>
      <div class="amfoot"><p class="aminfo">${info}</p><div class="ambtns${send && done ? '' : ' one'}">${send && done ? `<button class="b2" id="amSend">${ic('share')} 친구에게 보내기</button>` : ''}<button class="b1" id="mGo">${done ? '다시 풀기' : pick + '판 시작'} · 무료</button></div></div>`);
    const m = $('#modal'); m.classList.add('amap'); m.style.setProperty('--gc', GCOL[id][1]);
    $('#mClose').onclick = closeModal;
    $('#mGo').onclick = () => { closeModal(); startGame(id, null, { adv:pick }); };
    const sb = $('#amSend'); if(sb) sb.onclick = () => HOST.sendStage(id, pick, { t:rec ? rec.t : 0, st:s }, () => openAdvMap(id, pick));
    $('#amForm').onsubmit = e => { e.preventDefault(); const v = parseInt($('#amNum').value, 10);
      if(!(v >= 1)){ toast('판 번호를 넣어 주세요'); return; }
      if(v > p.max){ toast(p.max + '판까지 열려 있어요'); $('#amNum').value = p.max; return; }
      pick = v; c = chOf(v); draw(); };
    $('#chPrev').onclick = () => { c--; pick = Math.min(p.max, c * 10); draw(); };
    $('#chNext').onclick = () => { c++; pick = Math.min(p.max, c * 10); draw(); };
    document.querySelectorAll('.st:not(.lock)').forEach(b => b.onclick = () => { pick = +b.dataset.n; draw(); });
  };
  draw();
}

function openModal(html){ if(!$('#veil').classList.contains('on')) sfx('open'); const m = $('#modal'); m.className = 'modal'; m.style.removeProperty('--gc'); m.innerHTML = html; $('#veil').classList.add('on'); document.body.classList.add('modal-open'); m.scrollTop = 0; }
function closeModal(){ $('#veil').classList.remove('on'); document.body.classList.remove('modal-open'); }

/* ===== 결과 창 버튼(공용 위계, UI 검수 2026-10-04) =====
   ① 주 버튼 1개(전체 폭, 핑크) ② 반반 버튼 0~2개 ③ 글자 버튼 줄. 사이트·모듈의 결과 창이 같이 쓴다.
   o = { pri:{ id, label, sub?, fn }, pair:[{ id, label, cls?:'b2'|'gold', fn, keep? }], links:[{ id, label, fn, keep? }] }
   keep:true면 누를 때 창을 닫지 않는다(공유·도전장처럼 위에 다른 창을 띄우는 버튼). */
function resBtns(o){
  const pri = o.pri ? `<button class="b1 rb-pri" id="${o.pri.id}"><span class="rb-l">${o.pri.label}</span>${o.pri.sub ? `<small>${o.pri.sub}</small>` : ''}</button>` : '';
  const pair = (o.pair || []).filter(Boolean), links = (o.links || []).filter(Boolean);
  const pr = pair.length ? `<div class="rb-pair${pair.length === 1 ? ' one' : ''}">${pair.map(b => `<button class="${b.cls === 'gold' ? 'btn gold' : 'b2'}" id="${b.id}">${b.label}</button>`).join('')}</div>` : '';
  const ln = links.length ? `<div class="rb-links">${links.map(b => `<button id="${b.id}">${b.label}</button>`).join('<i aria-hidden="true">·</i>')}</div>` : '';
  return `<div class="rbtns">${pri}${pr}${ln}</div>`;
}
function resBind(o){
  [o.pri].concat(o.pair || [], o.links || []).forEach(b => { if(!b || !b.fn) return; const el = document.getElementById(b.id); if(el) el.onclick = () => { if(!b.keep) closeModal(); b.fn(); }; });
}

/* ===== 뒤로가기(HOST.historyGuard가 켜진 곳만) =====
   방문 기록에 한 칸을 쌓아 두고, 뒤로가기가 오면 다시 쌓은 뒤 화면 안에서 처리한다.
   창이 열려 있으면 닫기 · 플레이 중이면 그만하기 확인 · 결과 뒤면 나가기 · HOST.back() · 그 밖엔 "한 번 더 누르면 나가요" */
const NAV = { on:false, last:0 };
function navInit(){
  if(NAV.on || !HOST.historyGuard) return;
  try{ history.replaceState(Object.assign({}, history.state, { hp:'base' }), ''); history.pushState({ hp:'guard' }, ''); }catch(_){ return; }
  NAV.on = true;
  addEventListener('popstate', () => {
    let leave = false;
    try{ leave = navBack(); }catch(_){}
    if(leave){ try{ history.back(); }catch(_){} return; }   /* 두 번째 뒤로가기: 진짜로 나감 */
    try{ history.pushState({ hp:'guard' }, ''); }catch(_){}
  });
}
const NAV_CLOSE = ['#mStay', '#dsCancel', '#mClose', '#mBack', '#hsClose', '#wLater', '#chLater', '#mOk'];
function navBack(){
  const playing = !!G && !!$('#play') && $('#play').style.display === 'block';   /* showPlay()가 'block'으로, 나가기가 'none'으로 바꾼다 */
  if($('#veil').classList.contains('on')){
    if(playing && G && G.over){   /* 판이 끝난 뒤: 결과 창이면 나가기, 대전 결과를 기다리는 창이면 그대로 */
      if(document.querySelector('#modal #mPri, #modal .rbtns, #modal #mOut')){ closeModal(); HOST.exit(); }
      return false;
    }
    const b = NAV_CLOSE.map(s => document.querySelector('#modal ' + s)).find(Boolean);
    if(b) b.click(); else { closeModal(); if(G && G.paused) gResume(); }
    return false;
  }
  if(playing && G && !G.over){ confirmQuit(); return false; }
  if(playing){ HOST.exit(); return false; }
  if(HOST.back && HOST.back()) return false;
  if(Date.now() - NAV.last < 2000) return true;
  NAV.last = Date.now(); toast('한 번 더 누르면 나가요');
  return false;
}

/* 게임 방법(? 버튼, 첫 판 자동) — 여는 동안 시간 멈춤 */
const duelNoStop = () => !!(G && G.duel && !G.duel.fleet);
function gPause(){ if(!G || G.over || G.paused || duelNoStop()) return false; G.paused = true; G.pauseAt = Date.now(); return true; }
function gResume(){ if(!G || !G.paused) return; G.pausedMs += Date.now() - G.pauseAt; G.paused = false; G.lt = 0; }
/* 도움말 v2(WP3): 게임 정의 howto = { pic?:() => SVG(320×180), lines:[3줄], more?:[[제목, 설명], …] }
   있으면: 그림(있을 때만) + 3줄(16px) + "더 알아보기 ▾"(접힘, more 또는 help 단계) + 바닥 고정 [시작하기].
   없으면: 지금 help 단계 목록 + 바닥 고정 버튼. 버튼 id는 예전과 같은 #mOk */
function openHelp(id, first){
  if(duelNoStop() && !G.over){ duelRulesToggle(); return; }
  const paused = gPause(), m = NG[id] || {}, col = GAME_META[id].col;
  let ho = null; try{ ho = typeof m.howto === 'function' ? m.howto() : m.howto; }catch(_){ ho = null; }
  const steps = (ho && ho.more ? ho.more : HELP[id].concat(m.helpExtra ? m.helpExtra() : []));
  const stepHtml = steps.map((s, i) => `<div class="hstep"><span class="hn" style="background:${col}">${i + 1}</span><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('');
  let body;
  if(ho && ho.lines && ho.lines.length){
    let pic = ''; try{ pic = ho.pic ? ho.pic() : ''; }catch(_){ pic = ''; }
    body = `${pic ? `<div class="hpic" style="--gc:${col}" aria-hidden="true">${pic}</div>` : ''}
      <ol class="h3l">${ho.lines.slice(0, 3).map((l, i) => `<li><span class="hn" style="background:${col}">${i + 1}</span><span>${l}</span></li>`).join('')}</ol>
      ${steps.length ? `<details class="hmore"><summary>더 알아보기 <span aria-hidden="true">▾</span></summary><div class="help">${stepHtml}</div></details>` : ''}`;
  } else body = `<div class="help">${stepHtml}</div>`;
  openModal(`<h3>${GAMES[id].name} 방법</h3>${body}
    <div class="hfoot"><button class="b1" id="mOk">${first ? '시작하기' : '계속하기'}</button></div>`);
  $('#modal').classList.add('helpm');
  $('#mOk').onclick = () => { closeModal(); if(first && coachWant(id)){ coachStart(id, paused); return; } if(paused) gResume(); };
}
function confirmQuit(){
  if(!G || G.over){ HOST.exit(); return; }
  const paused = gPause();
  /* 솔로·대전 문구는 엔진이, 그 밖(사이트의 오늘의 시험지, 모듈의 연습 판)은 HOST가 정한다 */
  const q = G.adv ? { note:'지금 나가면 이번 도전은 기록되지 않아요. ' + HOST.soloFreeNote, label:'그만하기' }
    : G.duel ? { note:'지금 나가면 이번 대전은 기권패예요. ' + HOST.duelQuitNote + (duelNoStop() ? ' 시간은 계속 가요.' : ''), label:'기권하고 나가기' }
    : G.practice ? { note:'계속 풀기는 기록되지 않아요.', label:'나가기' }
    : HOST.quitInfo();
  openModal(`<h3>그만할까요?</h3><p class="note">${q.note}</p>
    <div class="mbtns two"><button class="b2" id="mQuit">${q.label}</button><button class="b1" id="mStay">계속하기</button></div>`);
  $('#mStay').onclick = () => { closeModal(); if(paused) gResume(); };
  $('#mQuit').onclick = () => {
    if(!G.adv && !G.duel && !G.practice && q.onQuit) q.onQuit();
    G.over = true; closeModal(); HOST.exit(); };
}

/* 실패했을 때 여기까지 한 만큼(결과 창 문구) */
function lossProgress(){ return NG[G.id].lossText(); }
/* 성공한 판의 게임 점수(배율 포함). 결과 창과 대전 판정에 같이 쓴다. 게임 정의 score()가 기본·보너스·추가 점수와 설명 3줄을 준다 */
function calcScore(){
  const q = NG[G.id].score(), base = q.base, time = q.time, paw = q.extra, [l1, l2, l3] = q.rows;
  return { base, time, paw, l1, l2, l3, score:Math.round((base + time + paw) * G.L.mult) };
}
/* 판이 끝남(게임이 부름). 대전은 엔진이 마무리, 그 밖은 HOST(사이트·모듈)가 결과 창을 보여 준다 */
function finish(win){
  if(G.over) return; G.over = true; clearInterval(tick);
  ambStop(); coachStop();
  if(G.adv && !G.duel){ try{ G.rec = win && !G.replay ? advBestSave(G.id, G.adv) : null; }catch(_){ G.rec = null; } }   /* 판마다 내 가장 좋은 기록 */
  if(G.replay && !G.duel && HOST.replayFinish){ HOST.replayFinish(win); return; }
  if(win && NG[G.id].winSfx){ sfx('win', { g:G.id }); fxBuzz([30, 60, 30, 60, 80]); }
  if(G.duel){ duelFinish(win); return; }
  if(G.practice){ practiceFinish(win); return; }   /* 대전 뒤 계속 풀기: 기록 안 함 */
  HOST.finish(win);
}
/* 게임 화면 정리(다른 화면으로 나가기 전에) */
function leavePlay(){ ambStop(); coachStop(); hstarDrop(); try{ sceneStart(null); }catch(_){} duelClose(); if(G && G.cleanup){ try{ G.cleanup(); }catch(_){} G.cleanup = null; } bodyModeSet(null); delete document.body.dataset.mode; clearInterval(tick); if(G && G.raf) cancelAnimationFrame(G.raf); }
function bodyModeSet(cls){ GAME_IDS.forEach(g => { const c = NG[g].bodyClass; if(c) document.body.classList.toggle(c, c === cls); }); }

function renderPaws(){
  const p = $('#paws'); const prev = +(p.dataset.n || 3);
  p.innerHTML = [0,1,2].map(i => ic('paw', i >= G.paws ? 'off' + (i === G.paws && G.paws < prev ? ' lost' : '') : '')).join('');
  p.dataset.n = G.paws; p.setAttribute('aria-label', '남은 기회 ' + G.paws + '번');
}

let G = null, tick = null;

function startGame(id, lv = 'normal', o = {}){
  const adv = o.adv || 0, duel = o.duel || null, m = NG[id];
  /* 시작 전 관문(게임 정의 startGate(go), 예: 19세 확인): 개념 카드·도움말보다 먼저. 실시간 대전은 찾기 전에 gateThen()으로 */
  if(!duel && !o.gateDone){ const gf = startGateOf(id); if(gf){ gf(() => startGame(id, lv, Object.assign({}, o, { gateDone:true }))); return; } }
  if(adv && !o.cardDone){ const p0 = planOf(id, adv); if(p0.intro && !store.get('hp:seenC:' + id + ':' + p0.intro, 0)){ conceptCard(id, adv, () => startGame(id, lv, Object.assign({}, o, { cardDone:true }))); return; } }
  const pre = HOST.beforeStart(id, lv, o);   /* 사이트: 하트·오늘 몇 번째 판. false면 시작 안 함 */
  if(pre === false) return;
  if(!duel || duel.fleet) sfx('start');
  if(G && G.cleanup){ try{ G.cleanup(); }catch(_){} G.cleanup = null; }
  if(G && G.raf) cancelAnimationFrame(G.raf);
  const attempt = (pre && pre.attempt) || 0;
  let L = levelOf(id, lv, adv);
  if(!adv && !duel && HOST.flatMult) L = Object.assign({}, L, { mult:1 });   /* 시험지는 배율 없음 */
  if(adv) lv = m.stageLevel ? L.ai : 'adv';
  const rng = adv ? mulberry(seedFrom('adv:' + id + ':' + adv)) : duel ? mulberry(seedFrom(duel.seed || ('duel:' + id + ':' + Date.now()))) : mulberry(seedFrom(o.seed || ('exam:' + dayKey() + ':' + id)));   /* 날짜 씨앗 = 전 국민(모든 사이트) 같은 문제 */
  G = { id, lv, adv, duel, L, attempt, chal:o.chal || null, paws:3, start:Date.now(), over:false, limit:L[id].limit, paused:false, pauseAt:0, pausedMs:0 };
  G.cfg = L[id]; m.init(L[id], rng, lv);
  HOST.showPlay();
  G.replay = o.replay || null;   /* 다시 풀기·받은 판·지난 문제: 기록·진도에 넣지 않음(HOST.replayFinish가 결과 창) */
  const ex = m.titleExtra ? m.titleExtra() : '';
  $('#ptitle').innerHTML = GAMES[id].name + (adv ? `<small>솔로 · ${chName(id, chOf(adv))} · 스테이지 ${adv}${ex}</small>` : duel ? `<small>대전 · ${duel.fleet ? (lv === 'pvp' ? '실시간 1:1' : esc((duel.opp && duel.opp.nick) || 'AI')) : 'VS ' + esc(duel.opp.nick) + (duel.mode === 'ai' ? ' (AI)' : '')} · ${L.name}${ex}</small>` : `<small>${HOST.subtitle(L, attempt, ex)}</small>`);
  if(adv && !duel) $('#ptitle').innerHTML = GAMES[id].name + `<small>${G.replay && G.replay.kind === 'gift' ? '친구가 보낸 판 · ' + adv + '판' : '솔로 · ' + (WARMUP(adv) ? '몸풀기 판' : chName(id, chOf(adv))) + ' · ' + adv + '판'}${ex}</small>`;
  hstarTick();   /* 솔로 별 목표선(판을 그리기 전에 자리를 잡아 판 크기 계산이 맞게) */
  $('.stats').style.display = 'none'; document.body.dataset.mode = id; bodyModeSet(m.bodyClass);
  $('#paws').dataset.n = 3; $('#fcount').textContent = ''; renderPaws(); renderStage();
  duelBarInit();
  if(!duel && store.get('hp:help:' + id, false) && coachWant(id)) setTimeout(() => { if(G && !G.over && G.id === id && !$('#veil').classList.contains('on')) coachStart(id, gPause()); }, 400);
  if((!duel || duel.fleet) && !store.get('hp:help:' + id, false)){ store.set('hp:help:' + id, 1); setTimeout(() => { if(G && !G.over) openHelp(id, true); }, 50); }
  clearInterval(tick);
  tick = setInterval(updateClock, 250); updateClock();
  ambStart(ambFor(id));
  try{ m.scene ? sceneStart(m.scene) : sceneStop(); }catch(_){}   /* 움직이는 배경(보이기만 함) */
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
  hstarTick();
  if(G.duel) duelTick();
}

function renderStage(){ NG[G.id].render($('#stage')); }

/* ===================== 공용 쉬운 화면(WP3, 2026-10-06 세대별 테스트) =====================
   큰 글씨 · 별 목표선 · 첫 판 손가락 안내 · 시작 전 관문 · 몸풀기 건너뛰기 · 기록 갱신 도장 · 대체 조작 부품(dpad·tapPlace).
   모두 게임 이름을 모르고 게임 정의(NG.<id>)의 선택 항목만 본다. 판 상태(G)·씨앗·시계·대전은 바꾸지 않는다(시계는 gPause/gResume만). */

/* ---- 큰 글씨(설정 "소리 · 글씨" 맨 위 스위치, hp:big) → body.big: 글자 +2px, 판 칸 크기는 그대로 ---- */
const bigOn = () => !!store.get('hp:big', 0);
function bigSet(on){ store.set('hp:big', on ? 1 : 0); document.body.classList.toggle('big', !!on); }
try{ if(bigOn()) document.body.classList.add('big'); }catch(_){}

/* ---- 시작 전 관문: 게임 정의 startGate(go)(함수). 예전 이름 gate가 함수면 그것도 관문으로 본다(객체 gate는 소리 간격) ---- */
function startGateOf(id){ const m = NG[id] || {}; return typeof m.startGate === 'function' ? m.startGate : typeof m.gate === 'function' ? m.gate : null; }
/* 실시간 대전·방처럼 startGame 전에 다른 화면이 먼저 뜨는 곳에서: gateThen(id, () => duelStart(id)) */
function gateThen(id, fn){ const g = startGateOf(id); if(g){ try{ g(fn); }catch(_){ fn(); } } else fn(); }

/* ---- 별 목표선(솔로만): 게임 제목 막대 아래 한 줄 .hstar. 게임 정의 starGoal() → [{ s:3, text:'1:30 안에', ok:true|false|null|() => … }]
   없으면 starRule의 ★★★ 부분 글을 그대로. 지키는 중 = 초록, 놓침 = 회색 줄긋기. 오늘의 문제·대전에는 없음 ---- */
function hstarItems(){
  const m = NG[G.id];
  if(m.starGoal){ try{ const a = m.starGoal(); if(Array.isArray(a) && a.length) return a; }catch(_){} }
  const parts = String(ADV_RULE[G.id] || '').split(' · ').map(x => x.trim()).filter(Boolean);
  const top = parts.find(x => /^★★★/.test(x)) || parts[parts.length - 1];
  return top ? [{ s:3, text:top.replace(/^★+\s*/, ''), ok:null }] : [];
}
function hstarTick(){
  try{
    if(!G || !G.adv || G.duel){ hstarDrop(); return; }
    const items = hstarItems().slice(0, 2); if(!items.length){ hstarDrop(); return; }
    let el = $('#hstar');
    if(!el){ el = document.createElement('div'); el.id = 'hstar'; el.className = 'hstar'; }
    const bar = document.querySelector('#play > .pbar');
    if(bar && el.previousElementSibling !== bar) bar.after(el);
    const html = items.map(x => { const ok = typeof x.ok === 'function' ? x.ok() : x.ok;
      return `<span class="hs${ok === false ? ' miss' : ok ? ' keep' : ''}"><i aria-hidden="true">${'★'.repeat(x.s || 3)}</i>${x.text}</span>`; }).join('<b aria-hidden="true">·</b>');
    if(el.dataset.h !== html){ el.dataset.h = html; el.innerHTML = html; el.setAttribute('aria-label', '별 목표: ' + items.map(x => (x.s || 3) + '개 ' + x.text).join(', ')); }
  }catch(_){}
}
function hstarDrop(){ const el = $('#hstar'); if(el) el.remove(); }

/* ---- 몸풀기 판: 1판을 별 3개로 깨면 결과 창 반반 자리에 "너무 쉬웠나요? 5판으로 건너뛰기"(건너뛴 판은 별 0으로 남음)
   warmSkip(id, n, 별, after?) → resBtns의 pair 버튼 하나 또는 null ---- */
function warmSkip(id, n, st, after){
  if(n !== 1 || st < 3 || (G && G.replay) || advProg(id).max >= 5) return null;
  return { id:'mSkip', label:'너무 쉬웠나요?<small>5판으로 건너뛰기</small>', cls:'b2', fn:() => {
    const p = advProg(id); p.max = Math.max(p.max, 5); store.set(advKey(id), p);
    if(after) try{ after(p); }catch(_){}
    startGame(id, null, { adv:5 }); } };
}

/* ---- 기록 갱신 도장: 결과 창 기록 옆 "기록 갱신!"(다시 풀어 가장 좋은 기록을 넘었을 때) ---- */
function recHtml(){
  const r = G && G.rec; if(!r) return '';
  return `<p class="recl">기록 <b class="num">${recTxt(r)}</b>${r.better ? '<span class="recst">기록 갱신!</span>' : r.prev ? `<small>내 최고 ${recTxt(r.prev)}</small>` : ''}</p>`;
}
function recFx(){ try{ const s = $('#modal .recst'); if(!s) return; setTimeout(() => { if(!s.isConnected) return; s.classList.add('on'); sfx('newRecord'); if(typeof fxPunch === 'function') fxPunch(s, 1.25); }, 900); }catch(_){} }

/* ---- 첫 판 손가락 안내(coach): 게임 정의 coach = [{ at:() => 요소|{x,y}, text:'여기를 눌러요', act:'tap'|'drag'|'swipe', to?:() => 요소|{x,y} }]
   처음 한 번만(hp:coach:<id>). 시계를 멈춘 채 판 위 손가락이 따라 하기를 보여 주고, 사용자가 그 동작을 하면 다음 단계.
   마지막 단계에서 손가락을 대는 순간 시계를 다시 움직여 그 동작은 판에 그대로 들어간다(공식 판 시간에 안내 시간이 들어가지 않음). 대전에서는 안 나옴 ---- */
const HAND_SVG = '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M17 30V9.5a4 4 0 0 1 8 0V25l.2-3.6a3.8 3.8 0 0 1 7.6.3l-.2 4 .4-2.4a3.7 3.7 0 0 1 7.3 1.1L39.6 37c-.8 9.4-7 15.5-15.3 15.5-6.7 0-10.4-3.4-14.2-9.4L4.7 34.8a3.6 3.6 0 0 1 5.7-4.4z" fill="#fff" stroke="#1A0F45" stroke-width="2.5" stroke-linejoin="round"/><path d="M25 24v8M32.6 26v7M17 30v4" stroke="#1A0F45" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>';
let COACH = null;
function coachWant(id){ const c = NG[id] && NG[id].coach; return !!(c && c.length && G && G.id === id && !G.duel && !G.over && !store.get('hp:coach:' + id, 0)); }
function coachStart(id, paused){
  coachStop();
  const steps = NG[id].coach || [];
  const el = document.createElement('div'); el.className = 'coach'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '따라 해 보세요');
  el.innerHTML = `<div class="ch-hole"></div><div class="ch-hand">${HAND_SVG}</div><p class="ch-tx" aria-live="polite"></p><button class="ch-skip" type="button">건너뛰기</button>`;
  document.body.appendChild(el);
  const C = COACH = { el, id, paused, i:0, a:null, b:null, down:null, h:{} };
  const pos = v => { if(!v) return null; if(v.getBoundingClientRect){ const r = v.getBoundingClientRect(); if(!r.width && !r.height) return null; return { x:r.left + r.width / 2, y:r.top + r.height / 2, r:Math.max(26, Math.min(80, Math.max(r.width, r.height) / 2 + 8)) }; } return isFinite(v.x) && isFinite(v.y) ? { x:v.x, y:v.y, r:v.r || 34 } : null; };
  const finish = () => { store.set('hp:coach:' + id, 1); coachStop(); };
  const show = () => {
    if(COACH !== C) return;
    const st = steps[C.i]; let a = null, b = null; try{ a = pos(st.at()); b = st.to ? pos(st.to()) : null; }catch(_){}
    if(!a){ C.i++; if(C.i >= steps.length) finish(); else show(); return; }
    C.a = a; C.b = b; C.act = st.act === 'drag' || st.act === 'swipe' ? st.act : 'tap';
    const s = el.style; s.setProperty('--x', a.x + 'px'); s.setProperty('--y', a.y + 'px'); s.setProperty('--r', a.r + 'px');
    s.setProperty('--dx', ((b ? b.x : a.x + (C.act === 'swipe' ? 80 : 0)) - a.x) + 'px'); s.setProperty('--dy', ((b ? b.y : a.y) - a.y) + 'px');
    el.dataset.act = C.act; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    const tx = el.querySelector('.ch-tx'); tx.textContent = st.text || (C.act === 'tap' ? '여기를 눌러요' : '손가락을 대고 밀어요');
    tx.classList.toggle('up', a.y > innerHeight * .6);
  };
  const near = e => C.a && Math.hypot(e.clientX - C.a.x, e.clientY - C.a.y) <= C.a.r * 1.7;
  const last = () => C.i >= steps.length - 1;
  C.h.down = e => { if(e.target.closest && e.target.closest('.ch-skip')) return; C.down = { x:e.clientX, y:e.clientY, ok:near(e) };
    if(C.down.ok && last()){ finish(); return; }   /* 마지막 동작은 시계를 돌린 뒤 판에 그대로 */
    if(C.act === 'tap' && C.down.ok){ C.i++; setTimeout(show, 60); } };
  C.h.up = e => { const d = C.down; C.down = null; if(!d || C.act === 'tap') return; if(Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24){ C.i++; if(C.i >= steps.length) finish(); else setTimeout(show, 60); } };
  C.h.rs = () => show();
  document.addEventListener('pointerdown', C.h.down, true); document.addEventListener('pointerup', C.h.up, true); addEventListener('resize', C.h.rs);
  el.querySelector('.ch-skip').onclick = finish;
  show();
}
function coachStop(){
  const C = COACH; if(!C) return; COACH = null;
  document.removeEventListener('pointerdown', C.h.down, true); document.removeEventListener('pointerup', C.h.up, true); removeEventListener('resize', C.h.rs);
  try{ C.el.remove(); }catch(_){}
  if(C.paused) gResume();
}

/* ---- 대체 조작 공용 부품 (게임 WP가 붙여 씀: 블록·주차·함대·여우 등) ----
   dpadHtml({ okText:'확인', ok:false면 가운데 비움, cls, label }) → ▲▼◀▶ + [확인] 56px 버튼 묶음(엄지 자리)
   dpadBind(rootEl, dir => …, { repeat:ms }) : dir = 'up'|'down'|'left'|'right'|'ok'. repeat를 주면 길게 누르는 동안 되풀이. 반환 = 풀기 함수 */
function dpadHtml(o = {}){
  return `<div class="dpad${o.cls ? ' ' + o.cls : ''}" role="group" aria-label="${o.label || '방향 버튼'}"><button type="button" class="dp-u" data-d="up" aria-label="위">▲</button><button type="button" class="dp-l" data-d="left" aria-label="왼쪽">◀</button>${o.ok === false ? '<span class="dp-c"></span>' : `<button type="button" class="dp-ok" data-d="ok">${o.okText || '확인'}</button>`}<button type="button" class="dp-r" data-d="right" aria-label="오른쪽">▶</button><button type="button" class="dp-d" data-d="down" aria-label="아래">▼</button></div>`;
}
function dpadBind(root, fn, o = {}){
  const pad = root && (root.classList && root.classList.contains('dpad') ? root : root.querySelector('.dpad')); if(!pad) return () => {};
  let t1 = 0, t2 = 0;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  const down = e => { const b = e.target.closest('button[data-d]'); if(!b || !pad.contains(b)) return; e.preventDefault(); stop();
    const d = b.dataset.d; try{ fn(d); }catch(_){}
    if(o.repeat && d !== 'ok') t1 = setTimeout(() => { t2 = setInterval(() => { try{ fn(d); }catch(_){ stop(); } }, o.repeat); }, 350); };
  pad.addEventListener('pointerdown', down); ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => pad.addEventListener(k, stop));
  return () => { stop(); pad.removeEventListener('pointerdown', down); };
}
/* tapPlace(rootEl, { item:'.piece', cell:'.cell', place:(itemEl, cellEl) => false면 못 놓음, pick?:itemEl => false면 못 고름 })
   끌기 대신 "대상 누르기 → 칸 누르기". 고른 대상에 .tp-sel, root에 .tp-on. 반환 { clear(), get(), off() } */
function tapPlace(root, o){
  let sel = null;
  const clear = () => { if(sel) sel.classList.remove('tp-sel'); sel = null; root.classList.remove('tp-on'); };
  const h = e => {
    const it = o.item ? e.target.closest(o.item) : null, ce = o.cell ? e.target.closest(o.cell) : null;
    if(sel && !sel.isConnected) clear();
    if(sel && ce && root.contains(ce) && it !== sel){ let ok = false; try{ ok = o.place(sel, ce) !== false; }catch(_){} if(ok){ clear(); return; } }
    if(it && root.contains(it)){ if(it === sel){ clear(); return; } if(o.pick && o.pick(it) === false) return; clear(); sel = it; it.classList.add('tp-sel'); root.classList.add('tp-on'); }
  };
  root.addEventListener('click', h);
  return { clear, get:() => sel, off:() => { root.removeEventListener('click', h); clear(); } };
}
