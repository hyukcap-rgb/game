/* ===================== 언어 사전 (DEV-01, docs/34 · docs/34_영어문구사전.md) =====================
   T('키', { 값 }) → 지금 언어의 글. 키가 없으면 한국어(ko) → 그래도 없으면 키 그대로(오류로 멈추지 않음).
   - 언어: 붙여 쓰는 모듈의 주소 옵션 lang=en (embed/frame.html이 window.HP_LANG에 넣음). 사이트(index.html)는 늘 한국어.
     lang이 없거나 모르는 값이면 ko → 모든 게임·사이트가 예전과 글자 하나 다르지 않다(ko 사전 = 예전 화면 글 그대로).
   - 공용 글(core.*)은 이 파일에, 게임 글(tg.* 등)은 게임 정의 선택 항목 i18n:{ en:{…}, ko:{…} }(registerGames가 합침)
     또는 게임 파일 맨 위에서 i18nAdd('en', {…}). 게임 이름으로 나누지 않는다(키 앞부분으로 나눔).
   - 값 자리: {name} 처럼 중괄호. 값이 함수면 vars를 받아 글을 돌려준다(영어 서수·복수 등).
   - 언어는 페이지를 열 때 정해진다(도중에 바꾸지 않음) → 다른 파일의 맨 위 상수에서 T를 써도 된다(이 파일이 core 맨 앞).
   - 숫자·골드 표기(사전 0-3): fmt(n) 천 단위 쉼표(ko-KR·en-US 모두 '12,400'), fmtG(n) '12,400 G'(줄바꿈 안 되는 공백 U+00A0),
     fmtSG(n) '+1,500 G' · '−2,000 G'(빼기는 U+2212). */
const I18N = (() => {
  let want = '';
  try{ want = String((typeof window !== 'undefined' && window.HP_LANG) || '').toLowerCase().split(/[-_]/)[0]; }catch(_){ want = ''; }
  return { lang:want === 'en' ? 'en' : 'ko', dict:{ ko:{}, en:{} } };
})();
/* 사전 더하기(게임·도구가 부름). 같은 키는 나중 것이 이김 */
function i18nAdd(lang, obj){
  if(!lang || !obj || typeof obj !== 'object') return;
  const d = I18N.dict[lang] || (I18N.dict[lang] = {});
  for(const k in obj) d[k] = obj[k];
}
const i18nLang = () => I18N.lang;
function T(key, vars){
  const d = I18N.dict;
  let s = d[I18N.lang] ? d[I18N.lang][key] : undefined;
  if(s == null) s = d.ko[key];
  if(s == null) return String(key);
  if(typeof s === 'function'){ try{ s = s(vars || {}); }catch(_){ s = d.ko[key]; if(typeof s === 'function') return String(key); } }
  s = String(s);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? String(vars[k]) : m) : s;
}
/* 골드 표기(사전 0-3). 게임이 필요할 때 쓴다(지금 화면에는 아직 안 씀) */
const I18N_NBSP = ' ', I18N_MINUS = '−';
function fmtG(n){ return fmt(Math.round(+n || 0)) + I18N_NBSP + 'G'; }
function fmtSG(n){ n = Math.round(+n || 0); return (n > 0 ? '+' : n < 0 ? I18N_MINUS : '') + fmtG(Math.abs(n)); }
/* 영어 서수 1st 2nd 3rd 4th */
const i18nOrd = n => { n = +n || 0; const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };
if(I18N.lang !== 'ko'){ try{ document.documentElement.lang = I18N.lang; }catch(_){} }

/* ---------- 공용 사전 core.* (ko = 예전 화면 글 그대로 · en = docs/34_영어문구사전.md 21절 + 개발팀 추가 키) ---------- */
/* 공용 버튼·말 */
i18nAdd('ko', {
  'core.cancel':'취소', 'core.ok':'확인', 'core.close':'닫기', 'core.back':'뒤로', 'core.leave':'나가기', 'core.later':'나중에',
  'core.me':'나', 'core.opp':'상대', 'core.cpu':'컴퓨터', 'core.friend':'친구', 'core.pts':'{n}점', 'core.noRec':'기록 안 됨',
  'core.stageN':'스테이지 {n}', 'core.exitAgain':'한 번 더 누르면 나가요', 'core.paws':'남은 기회 {n}번', 'core.pawsAria':'남은 기회',
  'core.lv.easy':'쉬움', 'core.lv.normal':'보통', 'core.lv.hard':'어려움',
  'core.wd.0':'일', 'core.wd.1':'월', 'core.wd.2':'화', 'core.wd.3':'수', 'core.wd.4':'목', 'core.wd.5':'금', 'core.wd.6':'토'
});
i18nAdd('en', {
  'core.cancel':'Cancel', 'core.ok':'OK', 'core.close':'Close', 'core.back':'Back', 'core.leave':'Leave', 'core.later':'Later',
  'core.me':'You', 'core.opp':'Opponent', 'core.cpu':'CPU', 'core.friend':'Friend', 'core.pts':v => v.n + (String(v.n) === '1' ? ' point' : ' points'), 'core.noRec':'Not recorded',
  'core.stageN':'Stage {n}', 'core.exitAgain':'Press again to exit', 'core.paws':v => v.n + (+v.n === 1 ? ' chance left' : ' chances left'), 'core.pawsAria':'Chances left',
  'core.lv.easy':'Easy', 'core.lv.normal':'Normal', 'core.lv.hard':'Hard',
  'core.wd.0':'Sun', 'core.wd.1':'Mon', 'core.wd.2':'Tue', 'core.wd.3':'Wed', 'core.wd.4':'Thu', 'core.wd.5':'Fri', 'core.wd.6':'Sat'
});
/* 솔로 개념 카드·변주(엔진 TWISTS) */
i18nAdd('ko', {
  'core.tw.flash':'빠른 판', 'core.tw.flashD':'시간(또는 기준 이동·턴)이 짧아요. 빠르고 정확하게!',
  'core.tw.tight':'외줄 타기', 'core.tw.tightD':'실수는 딱 한 번까지만 허용돼요.',
  'core.tw.bare':'맨손', 'core.tw.bareD':'힌트와 아이템 없이 오직 실력으로 풀어요.',
  'core.c.newRule':'새 규칙', 'core.c.newTwist':'새 변주', 'core.c.rule':'규칙', 'core.c.twist':'변주', 'core.c.mix':'섞기',
  'core.c.boss':'대장 판(아주 어려움)', 'core.c.hard':'어려움', 'core.c.first':'처음 나와요', 'core.c.stageOf':'스테이지 {n} · {name}',
  'core.c.twNote':'익숙한 판에 조건 하나가 더해져요.', 'core.c.fixedNote':'이 판부터 새로 나와요. 챕터 끝 대장 판에서 제대로 시험해요!',
  'core.c.majorNote':'첫 판은 이 규칙만 나와서 쉬워요. 챕터 끝 대장 판에서 제대로 시험해요!', 'core.c.go':'도전!'
});
i18nAdd('en', {
  'core.tw.flash':'Speed Round', 'core.tw.flashD':'Less time (or fewer moves). Be quick and accurate!',
  'core.tw.tight':'Tightrope', 'core.tw.tightD':'Only one mistake allowed.',
  'core.tw.bare':'Bare Hands', 'core.tw.bareD':'No hints or items. Just your skill.',
  'core.c.newRule':'New rule', 'core.c.newTwist':'New twist', 'core.c.rule':'Rule', 'core.c.twist':'Twist', 'core.c.mix':'Mix',
  'core.c.boss':'Boss Stage (very tough)', 'core.c.hard':'Tough', 'core.c.first':'New!', 'core.c.stageOf':'Stage {n} · {name}',
  'core.c.twNote':'One extra condition on a familiar board.', 'core.c.fixedNote':'It starts from this stage. The Boss Stage at the end of the chapter tests it!',
  'core.c.majorNote':'This stage only adds the new rule, so it\'s easy. The Boss Stage at the end of the chapter tests it!', 'core.c.go':'Let\'s go!'
});
/* 솔로 맵(21절) */
i18nAdd('ko', {
  'core.map.title':'{name} 판 고르기', 'core.map.num':'판 번호', 'core.map.go':'가기', 'core.map.numPh':'1~{n}',
  'core.map.numErr':'판 번호를 넣어 주세요', 'core.map.numMax':'{n}판까지 열려 있어요', 'core.map.chapter':'챕터 {c} · 별 {s}/30', 'core.map.cleared':'클리어',
  'core.map.prev':'이전 챕터', 'core.map.next':'다음 챕터', 'core.map.stage':'{n}판', 'core.map.boss':'대장 판', 'core.map.warm':'몸풀기',
  'core.map.locked':'{n}판 잠김', 'core.map.cellAria':'{n}판{tag}, 별 {s}개', 'core.map.ariaBoss':' 대장 판', 'core.map.ariaWarm':' 몸풀기',
  'core.map.legendNew':'새 규칙', 'core.map.legendHard':'어려움', 'core.map.best':'내 기록 {t}', 'core.map.noRec':'기록 없음', 'core.map.notYet':'아직 안 깼어요',
  'core.map.start':'{n}판 시작', 'core.map.replay':'다시 풀기', 'core.map.free':'무료', 'core.map.send':'친구에게 보내기',
  'core.map.skip5':'너무 쉬웠나요? 5판으로 건너뛰기', 'core.map.skip5Q':'너무 쉬웠나요?', 'core.map.skip5Go':'5판으로 건너뛰기',
  'core.rec':'기록', 'core.rec.moves':'{n}수'
});
i18nAdd('en', {
  'core.map.title':'Stages', 'core.map.num':'Stage #', 'core.map.go':'Go', 'core.map.numPh':'1–{n}',
  'core.map.numErr':'Enter a stage number', 'core.map.numMax':'Stages 1–{n} are open', 'core.map.chapter':'Chapter {c} · ★ {s}/30', 'core.map.cleared':'Cleared',
  'core.map.prev':'Previous chapter', 'core.map.next':'Next chapter', 'core.map.stage':'Stage {n}', 'core.map.boss':'Boss Stage', 'core.map.warm':'Warm-up',
  'core.map.locked':'Stage {n} locked', 'core.map.cellAria':v => 'Stage ' + v.n + v.tag + ', ' + v.s + (+v.s === 1 ? ' star' : ' stars'), 'core.map.ariaBoss':' (Boss Stage)', 'core.map.ariaWarm':' (Warm-up)',
  'core.map.legendNew':'New rule', 'core.map.legendHard':'Tough', 'core.map.best':'My best {t}', 'core.map.noRec':'No record', 'core.map.notYet':'Not cleared yet',
  'core.map.start':'Start Stage {n}', 'core.map.replay':'Replay', 'core.map.free':'Free', 'core.map.send':'Send to a Friend',
  'core.map.skip5':'Too easy? Skip to Stage 5', 'core.map.skip5Q':'Too easy?', 'core.map.skip5Go':'Skip to Stage 5',
  'core.rec':'Time', 'core.rec.moves':v => v.n + (+v.n === 1 ? ' move' : ' moves')
});
/* 도움말 창(20절) · 그만하기 창(16절) · 별 목표 · 손가락 안내 · 방향 버튼 */
i18nAdd('ko', {
  'core.help.title':'{name} 방법', 'core.help.more':'더 알아보기', 'core.help.tips':'화면 안내', 'core.help.sym':'표시 안내', 'core.help.goals':'별 목표',
  'core.help.start':'시작하기', 'core.help.cont':'계속하기',
  'core.quit.title':'그만할까요?', 'core.quit.solo':'지금 나가면 이번 도전은 기록되지 않아요.', 'core.quit.stay':'계속하기', 'core.quit.go':'그만하기',
  'core.quit.soloFree':'솔로는 언제든 다시 할 수 있어요.', 'core.quit.note':'지금 나가면 이번 판은 기록되지 않아요.',
  'core.quit.daily':'지금 나가면 이번 판은 기록되지 않아요. 같은 문제는 다시 할 수 있어요.',
  'core.quit.duel':'지금 나가면 이번 대전은 기권패예요.', 'core.quit.timeRuns':'시간은 계속 가요.', 'core.quit.forfeit':'기권하고 나가기',
  'core.quit.cont':'계속 풀기는 기록되지 않아요.',
  'core.star.goalAria':'별 {s}개 목표: {text}', 'core.star.goals':'별 목표: {list}', 'core.star.item':'{s}개 {text}',
  'core.coach.aria':'따라 해 보세요', 'core.coach.skip':'건너뛰기', 'core.coach.tap':'여기를 눌러요', 'core.coach.drag':'손가락을 대고 밀어요',
  'core.hint.move':'[↑↓] 이동', 'core.hint.select':'[Enter] 고르기', 'core.hint.back':'[Esc] 뒤로', 'core.hint.quit':'[Esc] 끝내기', 'core.hint.pause':'[Esc] 메뉴',
  'core.dpad':'방향 버튼', 'core.dpad.up':'위', 'core.dpad.down':'아래', 'core.dpad.left':'왼쪽', 'core.dpad.right':'오른쪽'
});
i18nAdd('en', {
  'core.help.title':'How to Play', 'core.help.more':'More', 'core.help.tips':'Screen Guide', 'core.help.sym':'Symbols', 'core.help.goals':'Star Goals',
  'core.help.start':'Start', 'core.help.cont':'Continue',
  'core.quit.title':'Quit this game?', 'core.quit.solo':'If you leave now, this run won\'t be saved.', 'core.quit.stay':'Keep Playing', 'core.quit.go':'Quit',
  'core.quit.soloFree':'You can replay stages anytime.', 'core.quit.note':'If you leave now, this game won\'t be saved.',
  'core.quit.daily':'If you leave now, this game won\'t be saved. You can play the same puzzle again.',
  'core.quit.duel':'If you leave now, you forfeit this duel.', 'core.quit.timeRuns':'The clock keeps running.', 'core.quit.forfeit':'Forfeit & Leave',
  'core.quit.cont':'Continued play isn\'t saved.',
  'core.star.goalAria':'{s}-star goal: {text}', 'core.star.goals':'Star goals: {list}', 'core.star.item':'{s}★ {text}',
  'core.coach.aria':'Try it', 'core.coach.skip':'Skip', 'core.coach.tap':'Tap here', 'core.coach.drag':'Press and drag',
  'core.hint.move':'[↑↓] Move', 'core.hint.select':'[Enter] Select', 'core.hint.back':'[Esc] Back', 'core.hint.quit':'[Esc] Quit', 'core.hint.pause':'[Esc] Menu',
  'core.dpad':'Direction buttons', 'core.dpad.up':'Up', 'core.dpad.down':'Down', 'core.dpad.left':'Left', 'core.dpad.right':'Right'
});
/* 판 제목 아래 작은 글 · 도움말 '이번 판' */
i18nAdd('ko', {
  'core.sub.gift':'친구 판', 'core.sub.duel':'대전', 'core.sub.giftFull':'친구가 보낸 판 · {n}판', 'core.sub.solo':'솔로 · {ch} · {n}판', 'core.sub.warm':'몸풀기 판',
  'core.sub.duelFull':'대전 · {lv}', 'core.sub.vsCpu':'컴퓨터 상대', 'core.sub.dsFrom':'{name}님이 보낸 대전 판', 'core.sub.dsReplay':'대전 판 다시 풀기',
  'core.sub.daily':'오늘의 문제 · {lv} · {k}', 'core.sub.firstRec':'첫 기록', 'core.sub.prac':'연습 · {lv} · 새 문제', 'core.sub.pracShort':'연습'
});
i18nAdd('en', {
  'core.sub.gift':'Friend\'s', 'core.sub.duel':'Duel', 'core.sub.giftFull':'From a friend · Stage {n}', 'core.sub.solo':'Solo · {ch} · Stage {n}', 'core.sub.warm':'Warm-up',
  'core.sub.duelFull':'Duel · {lv}', 'core.sub.vsCpu':'vs CPU', 'core.sub.dsFrom':'Duel stage from {name}', 'core.sub.dsReplay':'Duel replay',
  'core.sub.daily':'Daily Puzzle · {lv} · {k}', 'core.sub.firstRec':'First try', 'core.sub.prac':'Practice · {lv} · New puzzle', 'core.sub.pracShort':'Practice'
});
/* 모듈 첫 화면(embed/shell.js) */
i18nAdd('ko', {
  'core.brand':'하루퍼즐',
  'core.m.daily':'오늘의 문제', 'core.m.dailySub':'{wd}요일 · {lv} · 모두 같은 문제', 'core.m.todayBest':'오늘 최고 {n}점',
  'core.m.solo':'솔로 · 스테이지 {n}', 'core.m.stars':'별 {n}개', 'core.m.every5':'5판마다 새 규칙', 'core.m.map':'스테이지 맵',
  'core.m.prac':'연습', 'core.m.pracSub':'쉬움 · 보통 · 어려움 중 골라 새 문제로', 'core.m.pracSub2':'상대와 난이도를 골라요',
  'core.m.duel1':'1:1 대전', 'core.m.duelN':'대전 · 2~{n}명', 'core.m.duelHow':'같은 문제 · 점수가 높으면 승리', 'core.m.duelRec':'1위 {w}번 · 판 {n}번',
  'core.m.help':'게임 방법', 'core.m.bigOn':'큰 글씨 켬', 'core.m.bigOff':'큰 글씨 끔', 'core.m.close':'나가기',
  'core.prac.title':'{name} 연습', 'core.prac.note':'난이도를 고르면 새 문제로 시작해요.', 'core.prac.max':'최대 약 {n}점',
  'core.room.code':'방 코드 {code}', 'core.room.rd':'{n}판째', 'core.room.wait':'친구가 같은 코드로 들어오면 시작해요', 'core.room.max':'{n}명까지',
  'core.room.offline':'실시간 연결이 안 돼요. 잠시 뒤 다시 해 주세요', 'core.room.offline2':'실시간 연결이 안 돼요', 'core.room.fail':'대전을 시작하지 못했어요'
});
i18nAdd('en', {
  'core.brand':'Haru Puzzle',
  'core.m.daily':'Daily Puzzle', 'core.m.dailySub':'{wd} · {lv} · Same puzzle for all', 'core.m.todayBest':'Today\'s best {n}',
  'core.m.solo':'Solo · Stage {n}', 'core.m.stars':'★ {n}', 'core.m.every5':'New rule every 5 stages', 'core.m.map':'Stage Map',
  'core.m.prac':'Practice', 'core.m.pracSub':'Pick Easy, Normal or Hard for a new puzzle', 'core.m.pracSub2':'Pick your opponent and level',
  'core.m.duel1':'1v1 Duel', 'core.m.duelN':'Duel · 2–{n} players', 'core.m.duelHow':'Same puzzle · Higher score wins', 'core.m.duelRec':'1st ×{w} · {n} played',
  'core.m.help':'How to Play', 'core.m.bigOn':'Large Text: On', 'core.m.bigOff':'Large Text: Off', 'core.m.close':'Exit',
  'core.prac.title':'{name} Practice', 'core.prac.note':'Pick a level to start a new puzzle.', 'core.prac.max':'up to ~{n} points',
  'core.room.code':'Room code {code}', 'core.room.rd':'Game {n}', 'core.room.wait':'Starts when a friend joins with the same code', 'core.room.max':'up to {n} players',
  'core.room.offline':'Can\'t connect right now. Please try again soon.', 'core.room.offline2':'Can\'t connect right now', 'core.room.fail':'Couldn\'t start the duel'
});
/* 결과 창(21절 core.res.* + 개발팀 추가) */
i18nAdd('ko', {
  'core.res.clear':'스테이지 {n} 클리어!', 'core.res.starsAria':'별 {n}개', 'core.res.fail':'아쉬워요!', 'core.res.failNote':'몇 번이든 다시 할 수 있어요.',
  'core.res.next':'다음 스테이지 ▶', 'core.res.retry':'다시 도전', 'core.res.map':'스테이지 맵', 'core.res.home':'처음으로',
  'core.res.newBest':'기록 갱신!', 'core.res.prevBest':'내 최고 {t}', 'core.res.winTitle':'이겼어요!', 'core.res.loseTitle':'이번 판은 졌어요',
  'core.res.firstClear':'첫 클리어!', 'core.res.starBest':'별 기록 경신!', 'core.res.starKept':'최고 기록 별 {n}개는 그대로예요',
  'core.res.perfect':'완벽해요! 별 3개 달성', 'core.res.moreStars':'다시 하면 별을 더 모을 수 있어요',
  'core.res.clearShort':'클리어!', 'core.res.dailyFirst':'오늘의 문제 첫 기록이에요', 'core.res.prac':'연습 · {lv}', 'core.res.detail':'점수 자세히', 'core.res.mult':'난이도 배율',
  'core.res.failTitle':'이번 판은 실패', 'core.res.partial':'부분 점수 {n}점', 'core.res.dailyRetry':'같은 문제로 다시 해 볼 수 있어요.', 'core.res.tryAgain':'다시 도전해 봐요.',
  'core.res.samePuzzle':'같은 문제 다시 풀기', 'core.res.newPuzzle':'새 문제로 한 판 더', 'core.res.firstKept':'첫 기록은 그대로 남아요', 'core.res.bestKept':'오늘 최고 기록만 남아요', 'core.res.lv':'난이도 {lv}'
});
i18nAdd('en', {
  'core.res.clear':'Stage {n} Cleared!', 'core.res.starsAria':v => v.n + (+v.n === 1 ? ' star' : ' stars'), 'core.res.fail':'So close!', 'core.res.failNote':'Try as many times as you like.',
  'core.res.next':'Next Stage ▶', 'core.res.retry':'Try Again', 'core.res.map':'Back to Map', 'core.res.home':'Main Menu',
  'core.res.newBest':'New best!', 'core.res.prevBest':'Best {t}', 'core.res.winTitle':'You win!', 'core.res.loseTitle':'You lost this one',
  'core.res.firstClear':'First clear!', 'core.res.starBest':'New star record!', 'core.res.starKept':'Your best ({n}★) still stands',
  'core.res.perfect':'Perfect! 3 stars', 'core.res.moreStars':'Play again to earn more stars',
  'core.res.clearShort':'Clear!', 'core.res.dailyFirst':'Your first Daily Puzzle score', 'core.res.prac':'Practice · {lv}', 'core.res.detail':'Score details', 'core.res.mult':'Level bonus',
  'core.res.failTitle':'Not this time', 'core.res.partial':'Partial score {n}', 'core.res.dailyRetry':'You can try the same puzzle again.', 'core.res.tryAgain':'Give it another try.',
  'core.res.samePuzzle':'Play Same Puzzle', 'core.res.newPuzzle':'New Puzzle', 'core.res.firstKept':'Your first score stays', 'core.res.bestKept':'Only today\'s best counts', 'core.res.lv':'Level: {lv}'
});
/* 대전 결과 · 다시 풀기 · 보내기(모듈) */
i18nAdd('ko', {
  'core.d.draw':'무승부', 'core.d.tie':'공동 ', 'core.d.rank':'{n}위', 'core.d.rec':'대전 기록 1위 {w}번 · 판 {n}번', 'core.d.replay':'이 판 다시 풀기',
  'core.d.again':'한 판 더', 'core.d.againRoom':'같은 방 코드로 새 문제', 'core.d.againSame':'같은 상대와 새 문제로', 'core.d.newOpp':'새 상대 찾기', 'core.d.newOppSub':'새 문제로 다시 대전해요',
  'core.d.againLate':'같은 상대와 한 판 더 할 시간이 지났어요', 'core.d.waiting':'기다리는 중…', 'core.d.againGone':'같은 상대와는 시간이 지났어요',
  'core.d.gathered':'{n}명이 모였어요 · 곧 시작해요', 'core.d.waitOthers':'다른 사람을 기다리는 중…', 'core.d.againN':'{n}명이 한 판 더를 눌렀어요',
  'core.send.text':'{name} 대전 판{rec}{rk}. 같은 판으로 나를 이겨 볼래?', 'core.send.rec':', 나는 {r}', 'core.send.rk':' (대전 {n}위)',
  'core.send.copied':'링크를 복사했어요 · 친구에게 붙여 넣어 보내 주세요', 'core.send.made':'링크를 만들었어요',
  'core.ds.solo':'<b>{name}</b> 대전 판을 혼자 풀어요', 'core.ds.rec':'{name} 기록 <b>{r}</b>', 'core.ds.noRec':'기록·별에는 안 들어가요', 'core.ds.go':'풀어 보기',
  'core.ds.notDone':'못 깸', 'core.ds.meThen':'대전 때 나', 'core.ds.duelRank':'대전 {n}위', 'core.ds.done':'다 풀었어요!', 'core.ds.noRec2':'대전 판 다시 풀기라 기록에 안 들어가요',
  'core.ds.sameSub':'같은 판 · 기록 안 됨', 'core.ds.sendMine':'내 기록 보내기'
});
i18nAdd('en', {
  'core.d.draw':'Draw', 'core.d.tie':'Tied ', 'core.d.rank':v => i18nOrd(v.n), 'core.d.rec':'Duel record: 1st ×{w} · {n} played', 'core.d.replay':'Replay This Stage',
  'core.d.again':'Play Again', 'core.d.againRoom':'Same room code, new puzzle', 'core.d.againSame':'Same opponent, new puzzle', 'core.d.newOpp':'Find New Opponent', 'core.d.newOppSub':'Duel again with a new puzzle',
  'core.d.againLate':'Too late for a rematch with the same opponent', 'core.d.waiting':'Waiting…', 'core.d.againGone':'Rematch time is over',
  'core.d.gathered':'{n} players ready · Starting soon', 'core.d.waitOthers':'Waiting for others…', 'core.d.againN':'{n} pressed Play Again',
  'core.send.text':'{name} duel stage{rec}{rk}. Can you beat me on the same stage?', 'core.send.rec':', my result: {r}', 'core.send.rk':v => ' (' + i18nOrd(v.n) + ' in the duel)',
  'core.send.copied':'Link copied · Paste it to a friend', 'core.send.made':'Link created',
  'core.ds.solo':'Play the <b>{name}</b> duel stage solo', 'core.ds.rec':'{name}\'s result <b>{r}</b>', 'core.ds.noRec':'Doesn\'t count toward records or stars', 'core.ds.go':'Try It',
  'core.ds.notDone':'Not cleared', 'core.ds.meThen':'You (duel)', 'core.ds.duelRank':v => i18nOrd(v.n) + ' in the duel', 'core.ds.done':'All done!', 'core.ds.noRec2':'Duel replays don\'t count toward records',
  'core.ds.sameSub':'Same stage · Not recorded', 'core.ds.sendMine':'Send My Result'
});
/* 실시간 대전(core/duel.js): 찾기 창·준비·막대·알림·대기 창·결과 줄·판정 이유 — 문구만, 통신·상태는 그대로 */
i18nAdd('ko', {
  'core.ds3.kick':'대전 · {n}명까지', 'core.ds3.title':'대전 찾는 중', 'core.ds3.cnt':'지금 {n}명 · {max}명까지', 'core.ds3.cpuNow':'지금은 컴퓨터와 겨뤄요',
  'core.ds3.slow':'느긋하게 · 시간 2배', 'core.ds3.vsCpu':'컴퓨터와 바로 하기', 'core.ds3.startNow':'바로 시작',
  'core.ds3.offline':'<b>지금은 컴퓨터와 겨뤄요.</b> 실시간 서버에 연결되면 사람과 붙어요.', 'core.ds3.allIn':'모두 모였어요! 곧 시작해요', 'core.ds3.aiSoon':'사람이 없어 컴퓨터와 붙어요',
  'core.ds3.mem':'<b>{n}명이 모였어요.</b> 곧 시작해요', 'core.ds3.more':'더 들어올 수 있어요', 'core.ds3.left':'<b class="num">{n}초</b> 안에 상대가 없으면 컴퓨터와 붙어요', 'core.ds3.waitN':'기다리는 사람 {n}명',
  'core.ds3.full':'이번 판은 꽉 찼어요 · 다시 찾을게요', 'core.ds3.closed':'방이 닫혔어요 · 다시 찾을게요',
  'core.dg.nDuel':'{n}명 대전', 'core.dg.aria':'{name} 대전 준비', 'core.dg.liveReady':'실시간 상대 · 준비 완료',
  'core.dg.race':'같은 문제예요 · 먼저 다 푼 사람이 1등, 그 순간 모두 끝나요', 'core.dg.score':'같은 문제예요 · 끝났을 때 점수가 높은 사람이 이겨요',
  'core.dg.shared':'같은 판을 같이 봐요 · 먼저 누른 사람이 차지해요', 'core.dg.turn':'차례대로 해요 · 많이 가져간 사람이 이겨요',
  'core.dg.slow':'느긋하게', 'core.dg.ready':'준비', 'core.dg.go':'시작!', 'core.dg.soon':'곧 시작해요',
  'core.dg.allInN':'{n}명 모두 들어왔어요 · 같은 순간에 시작해요', 'core.dg.allIn2':'두 사람 모두 들어왔어요 · 같은 순간에 시작해요',
  'core.dbar.two':'대전 진행: 나와 {name}', 'core.dbar.rank':'{n}명 대전 순위', 'core.dbar.mini':'상대 판 미리 보기', 'core.dbar.turn':'차례', 'core.dbar.left':'나감', 'core.dbar.gone':'끊김 {n}',
  'core.dn.close':'간발의 차! {name}님이 먼저', 'core.dn.meLead':'내가 앞섰어요!', 'core.dn.oppLead':'{name}님이 앞질렀어요', 'core.dn.hot':'{name}님이 마무리 중이에요!',
  'core.dn.noPause':'대전 중에는 멈출 수 없어요', 'core.dn.clock':'대전 중이라 시간은 계속 가요', 'core.dn.back':'{name}님이 다시 연결됐어요', 'core.dn.miss':'{name}님이 한 번 틀렸어요',
  'core.dn.net':'{name}님 연결이 끊겼어요 · 15초 기다려요', 'core.dn.done':'{name}님이 다 풀었어요!', 'core.dn.stop':'{name}님이 멈췄어요 · {r}', 'core.dn.left':'{name}님이 나갔어요',
  'core.dn.meLost':'연결이 끊겼어요 · 이번 판은 무승부로 처리돼요', 'core.dn.meDown':'연결이 끊겼어요 · 다시 연결하는 중…', 'core.dn.meBack':'다시 연결됐어요', 'core.dn.last3':'마지막 3번 · {name} {n}점',
  'core.dm.title':'대전 메뉴', 'core.dm.live':'대전 중에는 멈출 수 없어요 · 시간이 계속 가요', 'core.dm.resume':'게임으로 돌아가기',
  'core.dc.cont':'계속 풀기', 'core.dc.contSub':'혼자 이어 풀기 · 기록 안 됨', 'core.dc.title':'대전 뒤 계속 풀기 · 기록되지 않아요', 'core.dc.toast':'혼자 이어서 풀어요 · 기록되지 않아요',
  'core.dc.end':'여기까지예요', 'core.dc.solved':'대전 뒤 혼자 끝까지 풀었어요.',
  'core.dw.end':'이번 판은 여기까지', 'core.dw.mine':'내 기록 · 확정', 'core.dw.race':'아직 푸는 사람이 있어요 · 끝나면 바로 순위가 나와요', 'core.dw.score':'모두 끝나면 점수로 순위를 매겨요',
  'core.dw.eta':'늦어도 {t} 뒤엔 결과가 나와요', 'core.dw.quiet':'창을 닫지 말고 기다려 주세요', 'core.dw.left':'나갔어요', 'core.dw.done':'끝냈어요', 'core.dw.playing':'아직 하는 중',
  'core.dr.unit':'개', 'core.dr.mis':'실수 {n}번', 'core.dr.shared':'{n}{u} 차지', 'core.dr.done':'다 풀었어요', 'core.dr.tile':'최고 {v} · 목표 {t}', 'core.dr.of':'{t}{u} 중 {v}{u}',
  'core.dr.pct':'{n}% 했어요', 'core.dr.none':'아직 시작 전이었어요', 'core.dr.stopped':'멈춤',
  'core.why.net':'연결이 끊겨서 무승부로 처리했어요', 'core.why.me':'내가', 'core.why.nm':'{name}님이', 'core.why.first':'{who} 먼저 다 풀어서 끝났어요',
  'core.why.allLeft':'다른 사람이 모두 나가서 끝났어요', 'core.why.oppLeft':'상대가 나가서 기권승이에요', 'core.why.allStop':'다른 사람이 모두 멈춰서, 내가 앞선 채로 끝났어요',
  'core.why.oppStop':'{name}님이 멈춰서, 내가 앞선 채로 끝났어요', 'core.why.end':'판이 끝났어요', 'core.why.time':'시간이 다 돼서 그때 기록으로 순위를 매겼어요',
  'core.why.score':'모두 끝나서 점수로 순위를 매겼어요', 'core.why.stopAll':'모두 멈춰서 푼 만큼 순위를 매겼어요',
  'core.why.forfeit':'상대가 떠나 기권승이에요', 'core.why.ownWin':'적 함대를 모두 격침했어요', 'core.why.ownLose':'우리 함대가 먼저 침몰했어요'
});
i18nAdd('en', {
  'core.ds3.kick':'Duel · up to {n}', 'core.ds3.title':'Finding a duel', 'core.ds3.cnt':'{n} here · up to {max}', 'core.ds3.cpuNow':'You\'ll play the CPU for now',
  'core.ds3.slow':'Relaxed · 2× time', 'core.ds3.vsCpu':'Play CPU Now', 'core.ds3.startNow':'Start Now',
  'core.ds3.offline':'<b>You\'ll play the CPU for now.</b> Once online, you\'ll face real players.', 'core.ds3.allIn':'Everyone\'s here! Starting soon', 'core.ds3.aiSoon':'No one around, so you\'ll play the CPU',
  'core.ds3.mem':'<b>{n} players ready.</b> Starting soon', 'core.ds3.more':'More can join', 'core.ds3.left':'No opponent in <b class="num">{n}s</b>? You\'ll play the CPU', 'core.ds3.waitN':'{n} waiting',
  'core.ds3.full':'This game is full · Searching again', 'core.ds3.closed':'The room closed · Searching again',
  'core.dg.nDuel':'{n}-player Duel', 'core.dg.aria':'{name} duel lobby', 'core.dg.liveReady':'Live opponent · Ready',
  'core.dg.race':'Same puzzle · First to finish wins, and it ends right then', 'core.dg.score':'Same puzzle · Highest score at the end wins',
  'core.dg.shared':'One shared board · First to tap claims it', 'core.dg.turn':'Take turns · Most claimed wins',
  'core.dg.slow':'Relaxed', 'core.dg.ready':'Ready', 'core.dg.go':'Go!', 'core.dg.soon':'Starting soon',
  'core.dg.allInN':'All {n} players are in · Starting together', 'core.dg.allIn2':'Both players are in · Starting together',
  'core.dbar.two':'Duel progress: you vs {name}', 'core.dbar.rank':'{n}-player duel ranking', 'core.dbar.mini':'Opponent boards', 'core.dbar.turn':'Turn', 'core.dbar.left':'Left', 'core.dbar.gone':'Offline {n}',
  'core.dn.close':'So close! {name} got there first', 'core.dn.meLead':'You took the lead!', 'core.dn.oppLead':'{name} took the lead', 'core.dn.hot':'{name} is almost done!',
  'core.dn.noPause':'You can\'t pause a duel', 'core.dn.clock':'It\'s a duel, so the clock keeps running', 'core.dn.back':'{name} is back online', 'core.dn.miss':'{name} made a mistake',
  'core.dn.net':'{name} disconnected · Waiting 15s', 'core.dn.done':'{name} finished!', 'core.dn.stop':'{name} stopped · {r}', 'core.dn.left':'{name} left',
  'core.dn.meLost':'Connection lost · This game counts as a draw', 'core.dn.meDown':'Connection lost · Reconnecting…', 'core.dn.meBack':'Reconnected', 'core.dn.last3':'Last 3 · {name} {n}',
  'core.dm.title':'Duel Menu', 'core.dm.live':'You can\'t pause a duel · The clock keeps running', 'core.dm.resume':'Back to Game',
  'core.dc.cont':'Keep Playing', 'core.dc.contSub':'Solo · Not recorded', 'core.dc.title':'Solo after duel · Not recorded', 'core.dc.toast':'Keep going solo · Not recorded',
  'core.dc.end':'That\'s it', 'core.dc.solved':'You finished it solo after the duel.',
  'core.dw.end':'That\'s all for this one', 'core.dw.mine':'Your result · Final', 'core.dw.race':'Others are still playing · Ranks appear when they finish', 'core.dw.score':'Ranked by score when everyone finishes',
  'core.dw.eta':'Results within {t}', 'core.dw.quiet':'Please keep this window open', 'core.dw.left':'Left', 'core.dw.done':'Finished', 'core.dw.playing':'Still playing',
  'core.dr.unit':'', 'core.dr.mis':v => v.n + (+v.n === 1 ? ' mistake' : ' mistakes'), 'core.dr.shared':'Claimed {n}{u}', 'core.dr.done':'Solved', 'core.dr.tile':'Best {v} · Goal {t}', 'core.dr.of':'{v}{u} / {t}{u}',
  'core.dr.pct':'{n}% done', 'core.dr.none':'Hadn\'t started yet', 'core.dr.stopped':'Stopped',
  'core.why.net':'Connection lost, so it\'s a draw', 'core.why.me':'You', 'core.why.nm':'{name}', 'core.why.first':'{who} finished first',
  'core.why.allLeft':'Everyone else left', 'core.why.oppLeft':'Your opponent left. You win by forfeit', 'core.why.allStop':'Everyone else stopped while you were ahead',
  'core.why.oppStop':'{name} stopped while you were ahead', 'core.why.end':'The game is over', 'core.why.time':'Time\'s up. Ranked by results so far',
  'core.why.score':'Everyone finished. Ranked by score', 'core.why.stopAll':'Everyone stopped. Ranked by progress',
  'core.why.forfeit':'Your opponent left. You win by forfeit', 'core.why.ownWin':'You sank the whole enemy fleet', 'core.why.ownLose':'Your fleet sank first'
});
/* 소리·글씨 설정 창 · 연속 콤보 · 아이템(core/effects-sound.js) */
i18nAdd('ko', {
  'core.snd.title':'소리 · 글씨', 'core.snd.big':'큰 글씨', 'core.snd.bigSub':'글자를 조금 크게', 'core.snd.all':'전체 소리', 'core.snd.allSub':'끄면 모든 효과음과 배경 소리가 꺼져요',
  'core.snd.sfx':'효과음', 'core.snd.sfxSub':'맞힘·깨짐·폭발·버튼 소리', 'core.snd.sfxVol':'효과음 크기', 'core.snd.amb':'배경 소리', 'core.snd.ambSub':'함대 = 바다, 디펜스 = 숲, 구슬 = 별밤 분위기', 'core.snd.ambVol':'배경 소리 크기',
  'core.snd.hap':'진동', 'core.snd.hapSub':'맞힘·틀림·폭발 때 짧게 떨려요(안드로이드)', 'core.snd.dOk':'맞힘', 'core.snd.dBreak':'깨짐', 'core.snd.dBoom':'폭발', 'core.snd.dFan':'축하', 'core.snd.back':'돌아가기',
  'core.snd.on':'소리 켜짐 · 누르면 끄기', 'core.snd.off':'소리 꺼짐 · 누르면 켜기',
  'core.combo':'연속 {n}', 'core.combo.2':'좋아요!', 'core.combo.3':'멋져요!', 'core.combo.4':'대단해요!', 'core.combo.5':'완벽해요!',
  'core.item.foxHint':'여우 힌트', 'core.item.foxAuto':'자동 ✕'
});
i18nAdd('en', {
  'core.snd.title':'Sound · Text', 'core.snd.big':'Large Text', 'core.snd.bigSub':'Slightly bigger text', 'core.snd.all':'All Sound', 'core.snd.allSub':'Turns off all effects and background sound',
  'core.snd.sfx':'Effects', 'core.snd.sfxSub':'Hits, breaks, blasts and buttons', 'core.snd.sfxVol':'Effects volume', 'core.snd.amb':'Background', 'core.snd.ambSub':'Ambient sound for each game', 'core.snd.ambVol':'Background volume',
  'core.snd.hap':'Vibration', 'core.snd.hapSub':'Short buzz on hits, misses and blasts (Android)', 'core.snd.dOk':'Hit', 'core.snd.dBreak':'Break', 'core.snd.dBoom':'Blast', 'core.snd.dFan':'Cheer', 'core.snd.back':'Back',
  'core.snd.on':'Sound on · Tap to mute', 'core.snd.off':'Sound off · Tap to unmute',
  'core.combo':'Combo {n}', 'core.combo.2':'Nice!', 'core.combo.3':'Great!', 'core.combo.4':'Amazing!', 'core.combo.5':'Perfect!',
  'core.item.foxHint':'Fox Hint', 'core.item.foxAuto':'Auto ✕'
});
