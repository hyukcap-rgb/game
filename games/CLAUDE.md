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
| `css` `sounds` `gate` `jingle` | 게임 안에 든 스타일·소리(모듈형 게임) |
| `scene` | 움직이는 배경 `{ kind:'stars'|'sea'|'forest'|'bubbles'|'petals'|'shapes'|'motes', colors:[…], density, alpha }`(core/scene.js). 보이기만 하고 게임·대전에 영향 없음 |

## 새 게임 추가
1. `games/<id>/` 만들기: `<id>.js`(마지막에 `NG.<id> = {…}`), 필요하면 `<id>.css`, `game.json`(`order`는 마지막 번호), `CLAUDE.md`(다른 게임 것을 본떠 같은 제목 순서로).
2. 사이트에 보이려면 `portal/portal.js` 맨 위 `registerGames([...])`에 id를 더하고, 오늘의 시험지 과목(`SUBJ`)에 넣을지 사용자에게 묻는다.
3. `node tools/build.js` → `index.html` 목록과 `embed/<id>.html`이 생긴다 → `npm test -- <id>`.
4. 사용자에게 붙여 쓰는 코드(`embed/README.md` 형식)를 알려 준다.
