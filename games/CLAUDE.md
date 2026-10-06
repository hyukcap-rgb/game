# games/ — 게임 정의 계약 · 새 게임 추가

게임 하나 = 폴더 하나(`games/<id>/`). 엔진(core)은 게임 이름을 모르고, 아래 **게임 정의** `NG.<id>`만 보고 게임을 부른다.
그래서 같은 게임 파일이 하루퍼즐 리그 사이트(index.html)와 붙여 쓰는 모듈(embed/<id>.html)에서 그대로 돈다.

## 폴더 안
| 파일 | 내용 |
|---|---|
| `game.json` | `id`(폴더 이름과 같게), `name`, `version`, `summary`, `js`·`css`(불러오는 순서), `duel`(대전 지원), `order`(사이트에 보이는 순서) |
| `CLAUDE.md` | 이 게임의 **프롬프트**(사용자 지시·규칙·난이도·점수·파일 지도·주의점·바뀐 기록) |
| `*.js` | 게임 코드. 마지막에 `NG.<id> = { ... }` |
| `*.css` | (선택) 게임 화면 스타일. `body[data-mode="<id>"]`나 게임 고유 클래스로 범위를 좁힌다. 모듈형 게임은 `css` 칸에 넣어도 된다 |

game.json의 `version`은 게임을 바꿀 때 올린다(작은 수정 1.0.1, 규칙·난이도 변화 1.1.0). 모듈을 붙인 곳이 `ready` 이벤트로 버전을 볼 수 있다.

## 게임 정의 `NG.<id>` (필수)
| 칸 | 뜻 |
|---|---|
| `name` `col:[밝은, 기본, 어두운]` `time:'약 3분'` `abil:'공간지각'` | 이름·색·한 판 시간·능력(논리력·집중력·공간지각·전략력·추리력) |
| `icon` | 24×24 SVG 글자(작은 아이콘) |
| `art()` | 160×100 썸네일 SVG를 돌려줌(그릴 때마다 그라데이션 id가 겹치지 않게) |
| `help:[[제목, 설명], …]` | 게임 방법 3~4칸 |
| `chapters:[5개]` `starRule` | 솔로 챕터 이름, 별 기준 문구(`★ … · ★★ … · ★★★ …`) |
| `levels:{easy, normal, hard}` `levelDesc(lv)` | 오늘의 문제·연습 난이도별 판 설정(`limit` 초 포함, 0이면 시간 제한 없음)과 설명 |
| `stage(n)` `stageDesc(n)` | 솔로 스테이지 n의 판 설정·설명. 개념 사이클은 `planOf('<id>', n)`을 읽어 반영 |
| `init(cfg, rng, lv)` | 판 만들기. `G`(지금 판 상태)에 필요한 값을 넣는다. **문제 내용은 rng로만** |
| `render(st)` | `#stage` 안에 화면 그리기 |
| `progress()` | 0~1 진행률(대전 막대·부분 점수) |
| `lossText()` | 실패했을 때 "여기까지 했어요" 문장 |
| `score()` | 성공 판 점수 `{ base, time, extra, rows:[줄1, 줄2, 줄3] }` → 엔진이 `(base+time+extra)×배율` |
| `stars()` | 솔로 별 1~3 |

게임 코드는 끝날 때 `finish(true|false)`를 부른다. 엔진 도구: `G`, `elapsed()`, `openModal/closeModal`, `openHelp`, `confirmQuit`, `gPause/gResume`, `sfx(이름)`, `fx*` 효과, `store`, `toast`, `planOf/conceptInfo`, `toyImg/toyImage`(공용 캐릭터).

자기 방식 대전(`duelLaunch` + `duel:{ fleet:true }`)은 끝내기 전에 `G.duel.r`('w'·'l'·'d' 무승부), `G.duel.a`/`G.duel.b`(`{ sc }` 결과 창 점수), `G.duel.why`(판정 문구)를 정해 두면 엔진이 그대로 쓴다(없으면 승/패만).

효과(이펙트 v2, `core/effects-sound.js`): 예전 `fxBurst/fxRing/fxPop/fxShake/fxConfetti/fxFloat`는 그대로 쓰고, 새로
`fxEmit(x, y, { quantity, speed, angle, lifespan, scale:{start,end,ease}, alpha:{start,end}, color:[시작,끝], tint:[…], gravityY, drag, kind:'dot'|'glow'|'smoke'|'twinkle'|'shard'|'heart'|'star'|'spark', glow, wob, flip, well:{x,y,power}, delay })`(Phaser 파티클식 설정),
`fxFlash(색, 세기, ms)`(화면 번쩍), `fxPunch(요소, 배율)`(줌 펀치)가 있다. 효과는 **보이기만** 한다: 게임 상태·rng를 바꾸지 않고, 효과 코드는 `try{}catch(_){}`로 감싸 오류가 나도 판이 멈추지 않게 한다.
캐릭터 v4: `toyImg(종류, cls, 표정)`·`toySrc(종류, 표정)` 표정은 `''`·`'joy'`·`'sad'`·`'wow'`. 표정은 결과·대전 같은 순간 연출에만 쓰고 계속 움직이게 하지 않는다.

## 게임 정의 (선택)
| 칸 | 쓰는 곳 |
|---|---|
| `concepts` 또는 `CONCEPTS.<id>` | 솔로 개념 사이클 `{ order:[새 규칙 4개], info, twists, twInfo }` 또는 정해진 등장 `{ fixed:[{ at, key, name, desc }] }` |
| `stageTag(n)` | 솔로 맵 칸에 붙일 클래스 |
| `helpExtra()` | 게임 방법에 덧붙일 칸(지금 판 규칙 등) |
| `saveKey` | 솔로 기록 저장 이름(기본 `hp:adv:<id>`) |
| `titleExtra()` | 화면 제목 뒤에 붙일 글자(예: 맵 이름) |
| `winTitle` `loseTitle` `noConfetti` `winSfx` | 결과 창 제목·색종이 끄기·성공 음악 |
| `bodyClass` `amb` | 게임 중 `<body>`에 붙일 클래스, 배경 소리(`'sea'|'forest'|'stars'`) |
| `levelCfg(lv)` `pickLv(lv)` `levelSheet()` `stageLevel(n)` | 난이도 체계가 다른 게임(함대: 실시간·AI 세기) |
| `duelPace:[평균 초, 성공률]` | 대전 AI 상대 속도 |
| `duelStat:{ unit, lfMax?, score?, tile?, lfIcon?, get:() => ({ v, t, lf }) }` | 대전 막대에 보이는 수치 |
| `duelHow` `duelLaunch()` | 대전 설명 문구, 자기 방식 대전(함대) |
| `modes:['solo','duel']` | 이 게임에 있는 모드만(붙여 쓰는 모듈 첫 화면·명령에 반영). 없으면 오늘의 문제·솔로·연습·대전 모두. 사이트 오늘의 시험지는 `SUBJ`로 따로 정함 |
| `age:19` | 이용 연령 표시 정보(고스톱). 표시·확인 화면은 게임이 직접 |
| `cardNote()` | 사이트 솔로·대전 목록과 모듈 첫 화면에 덧붙일 짧은 한 줄(예: 고스톱 보유 포인트) |
| `css` `sounds` `gate` `jingle` | 게임 안에 든 스타일·소리(모듈형 게임). `gate`는 **객체**(소리 간격 ms). 시작 전 관문은 아래 `startGate` |
| `howto` | 도움말 v2(쉬운 화면): `{ pic?:() => SVG 문자열(320×180, 움직이는 그림·글자 없음), lines:['3줄', …](줄마다 24자 이하), more?:[[제목, 설명], …] }`. 있으면 첫 화면 = 그림(있을 때만) + 3줄 16px + "더 알아보기 ▾"(접힘, `more` 없으면 `help`+`helpExtra`) + 바닥 고정 [시작하기]. 없으면 `help` 단계 목록 + 바닥 고정 버튼. 함수로 줘도 됨(`howto:() => ({…})`). 솔로 새 규칙 설명은 3줄에 넣지 말고 개념 카드(`concepts`)로 |
| `startGate(go)` | 시작 전 관문(예: 고스톱 19세 확인). `startGame`이 개념 카드·도움말보다 **먼저** 부른다. 확인되면 `go()`(이미 확인했으면 바로 `go()`). 실시간 대전 쪽은 엔진 `gateThen(id, fn)`으로 감싸 부름 |
| `starGoal()` | 솔로 별 목표선(판 위 한 줄 `.hstar`): `[{ s:3, text:'1:30 안에 · 실수 0', ok:true|false|null }]`(최대 2개, `ok`는 함수여도 됨: 지키는 중 초록 · 놓침 회색 줄긋기). 없으면 `starRule`의 ★★★ 부분 글을 그대로 보여 줌 |
| `coach` | 첫 판 손가락 안내(처음 한 번, `hp:coach:<id>`): `[{ at:() => 요소|{x,y}, text:'여기를 눌러요', act:'tap'|'drag'|'swipe', to?:() => 요소|{x,y} }]`. 시계 멈춘 채 따라 하기, 마지막 동작에서 시계 다시 감. 대전에서는 안 나옴 |
| `recMoves()` | 판 기록(`hp:best:<id>:<판>`)에 시간과 같이 남길 수(이동 수 등). 없으면 시간만 |
| `noSend` | `true`면 판 고르기 창에 [친구에게 보내기] 없음(`age`가 있는 게임은 자동으로 없음) |
| `duelReplay` | 대전 결과 창 "이 판 다시 풀기 · 친구에게 보내기"(R11) 켜기/끄기. 없으면 경주(`race`)·점수(`score`)만 켜짐, 선점·차례·`duelLaunch`는 꺼짐. 상대 수에 따라 판이 달라지는 게임은 `false`(예: 오목). 다시 풀기는 대전과 같은 씨앗·`duelCfg`로 `init`을 부르고, `init` 동안만 `G.duel = { replay:true, … }`(가짜 표식)이 있어 대전 전용 판 갈래를 그대로 탄 뒤 `G.duel = null`로 혼자 푼다(대전 뒤 계속 풀기와 같은 모양) |

공용 조작 부품(엔진, 게임이 붙여 씀): `dpadHtml({ okText, ok:false, cls })` + `dpadBind(요소, dir => …, { repeat:ms })`(▲▼◀▶ + [확인] 56px), `tapPlace(요소, { item:'.조각', cell:'.칸', place:(조각, 칸) => false면 못 놓음, pick? })`(끌기 대신 누르고 놓기, 고른 것에 `.tp-sel`). 큰 글씨는 `body.big`(글자 +2px) — 게임 CSS에서 필요하면 `body.big .내클래스{…}`로 맞춘다.
| `scene` | 움직이는 배경 `{ kind:'stars'|'sea'|'forest'|'bubbles'|'petals'|'shapes'|'motes', colors:[…], density, alpha }`(core/scene.js). 보이기만 하고 게임·대전에 영향 없음 |

## 대전 v3 (선택, `core/duel.js`, docs/21 3절) — 2~5명 · 순위 · 사건 · 선점 · 차례
아무것도 안 넣으면 지금처럼 **1:1 경주**(먼저 다 푼 사람이 1위, 그 순간 0.7초 뒤 모두 끝)로 돈다.

| 칸 | 기본값 | 뜻 |
|---|---|---|
| `duelKind` | `'race'` | `'race'` 경주 · `'score'` 점수(정해진 횟수 뒤 점수) · `'shared'` 선점(한 판을 같이 보고 먼저 누른 사람이 차지) · `'turn'` 차례. 자기 방식은 지금처럼 `duelLaunch` |
| `duelMax` | `2` | 최대 인원 2~5. 빠른 대전은 이만큼 모으거나, 2명 이상 + 두 번째 입장 6초, 또는 12초에 시작(12초에 혼자면 컴퓨터 1:1) |
| `duelCfg(o)` | 그 난이도 `levels` | 대전 판 설정을 돌려줌. `o = { n:인원, pace:'n'|'s', avoid:[최근 본 열쇠], diff:'easy'|'normal'|'hard' }`. **문제 내용은 여기서 rng로 만들지 않는다**(init의 rng로만). `avoid`는 `G.duel.avoid`로도 읽을 수 있음 |
| `duelSlow(cfg)` | `limit × 2` | '느긋하게'일 때 설정 바꾸기(차례 게임은 차례 시간 ×2 등). 없으면 엔진이 limit만 2배, `duelTurn.timeout`도 2배 |
| `duelStat.get()` | | 돌려주는 값에 `mis`(틀린 횟수)를 **더함**. 경주·선점 게임은 넣는 것을 권함(없으면 엔진이 `lf`가 줄어든 횟수로 셈). `v`가 오른 시각(`la`)은 엔진이 셈. `tb`(선택) = 순위 동점 가르기 수(작을수록 앞, 예: 쏜 턴·움직인 수) → 기본 순위에서 `v` 다음·`mis` 앞. `left`(선택) = 점수전의 남은 수 → 3 이하일 때 "마지막 3번" 알림 |
| `duelRank(a, b)` | 엔진 기본 | 순위 비교를 바꿀 때만. `a`·`b` = `{ pg, v, t, lf, mis, la, dn, ok, sc, ft, left }`, 앞서면 음수 |
| `duelEnd` | 종류별 | `'first'`(경주 기본: 누가 다 풀면 모두 끝) · `'all'`(점수 기본: 모두 끝나거나 시간. 컴퓨터 대전에서 내가 먼저 끝나면 컴퓨터는 제 판을 끝까지 한 결과로 셈 — 일부러 빨리 끝내 이기기 막기) · `'game'`(선점·차례 기본: 게임이 `duelEndNow()`) |
| `onDuelEvent(ev, from)` | | 다른 사람이 `duelSend`로 보낸 사건. `ev = { n, kind, data, at }`, `from` = 참가자 |
| `onDuelClaim(key, owner, info)` | | 선점 주인이 정해지거나 바뀔 때(내 것 포함). `info = { mine, lost, at, sure }`(`lost` = 내 것으로 보였다가 더 이른 사람에게 뺏김 → "간발의 차" 알림은 엔진이 띄움, 게임은 표시·점수만 되돌림. `sure` = 0.4초 확인 끝) |
| `duelKeys()` | | 선점 게임의 차지할 수 있는 열쇠 목록(컴퓨터 상대가 계단마다 하나씩 차지). 없으면 컴퓨터는 수만 올라감 |
| `duelHelp` | | 대전 준비 화면·대전 중 규칙 목록(`[[제목, 설명], …]` 또는 함수). 없으면 `help`. 솔로와 대전 규칙이 다를 때(예: 카드 짝 미리 보기 없음) |
| `duelMini` | | 미니 화면 `{ get:() => 글자열(400B 이하), draw:(el, s, p) => void }`. 있으면 칩 줄 대신 상대 카드(72×64, 그림 칸 약 60×42). 컴퓨터 상대는 판 글자가 없어 `draw`를 매번 부름(`s=''`, `p.ai`·`p.st`로 그리고, 같으면 건너뛰기) |
| `duelResHtml(rows, res)` | | 결과 창(사이트·모듈)에 덧붙일 HTML(끝 판 나란히·풀이 다시 보기 등). `rows` = 순위 순 + `mv`(그 사람의 마지막 미니 화면 글자열, 나는 게임이 직접) |
| `duelDoneMsg(nick)` | `'○○님이 다 풀었어요!'` | 경주에서 다른 사람이 다 풀었을 때 큰 알림 문구(예: 주차 `'○○ 탈출!'`) |
| `duelAi(rng, o)` | 엔진 사람 흉내 | 게임 전용 컴퓨터 결과 `{ ok, T(초), sc, fail(못 끝낼 때 멈추는 진행 0~1), pts? }`. `o = { pace, cfg }`. `T`를 getter로 주면 예전처럼 연속으로 움직임(오목) |
| `duelAvoidKey()` | | 이번 판을 나타내는 열쇠(예: 숨은그림 장면 이름). 엔진이 최근 3개를 저장해 다음 대전 `avoid`로 넘김(빠른 대전은 방장 목록을 모두가 씀) |
| `duelLaunch(o)` | | 자기 방식 대전(함대·고스톱·끝말잇기). 빠른 대전은 `o = { pace }`. 사이트 대전 방에서는 `o = { room:중계 방 이름('fl-d3-r-<코드>-<판>'), pl:[참가자 기기 표식], me, host:내가 이번 판 방장인지, seed, again, pace, n, lv:난이도, nick, info:방 정보(G.duel.room에 그대로 넣으면 결과 창이 방 버튼·보상 난이도를 씀), onFail(why) }` — 받으면 짝 찾기 없이 그 방에서 pl 사람끼리 시작 |
| `duelRoom` | `false` | `duelLaunch` 게임이 위 방 정보(o.room)를 받아 시작할 수 있으면 `true` → 대전 방 목록·방 만들기에 나옴(없으면 빠른 대전만, 예: 스노우볼) |
| `duelPlace` | `'bar'` | `'top'`이면 막대·칩 줄을 늘 맨 위에(상단 바 안에 넣지 않음) |

**엔진이 주는 함수(전역)**: `duelPlayers()`(자리 순서 `[{ pid, seat, nick, me, ai, col, shape, st, left, gone, rank }]`, 색·모양은 내 화면 기준: 나는 늘 분홍 원) · `duelMe()` · `duelIsHost()` ·
`duelSend(kind, data)`(200B 이하, 나에게는 안 옴) · `duelAiDelay(초)`(컴퓨터 상대를 늦춤: 남은 계단·끝 시각을 뒤로) · `duelClaim(key)` → `{ ok }` · `duelOwner(key)` · `duelEndNow(why)` · `duelNotify(text, { from, kind:'good'|'bad'|'info' })` · `duelSeed()` · `duelRound()` → `{ r, series, freeLeft }` ·
`duelTurn = { order(), cur(), n(), mine(), act(kind, data, { next:false로 차례 유지 }), onAct(cb), timeout(sec), left() }`(`onAct`는 다른 사람의 수와 엔진의 대신 하기 `{ kind:'timeout'|'skip', auto:true, rng }`만 부름, 내 수는 게임이 바로 그림).
게임 상태는 같은 씨앗·같은 사건 순서로 모든 기기가 같게 계산한다. `G.duel.opp`·`G.duel.oppPeer`·`G.duel.nr`(1:1 게임이 쓰던 이름)은 그대로 있다.

## 새 게임 추가
1. `games/<id>/` 만들기: `<id>.js`(마지막에 `NG.<id> = {…}`), 필요하면 `<id>.css`, `game.json`(`order`는 마지막 번호), `CLAUDE.md`(다른 게임 것을 본떠 같은 제목 순서로).
2. 사이트에 보이려면 `portal/portal.js` 맨 위 `registerGames([...])`에 id를 더하고, 오늘의 시험지 과목(`SUBJ`)에 넣을지 사용자에게 묻는다.
3. `node tools/build.js` → `index.html` 목록과 `embed/<id>.html`이 생긴다 → `npm test -- <id>`.
4. 사용자에게 붙여 쓰는 코드(`embed/README.md` 형식)를 알려 준다.
