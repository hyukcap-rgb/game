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
| `css` `sounds` `gate` `jingle` | 게임 안에 든 스타일·소리(모듈형 게임) |

## 새 게임 추가
1. `games/<id>/` 만들기: `<id>.js`(마지막에 `NG.<id> = {…}`), 필요하면 `<id>.css`, `game.json`(`order`는 마지막 번호), `CLAUDE.md`(다른 게임 것을 본떠 같은 제목 순서로).
2. 사이트에 보이려면 `portal/portal.js` 맨 위 `registerGames([...])`에 id를 더하고, 오늘의 시험지 과목(`SUBJ`)에 넣을지 사용자에게 묻는다.
3. `node tools/build.js` → `index.html` 목록과 `embed/<id>.html`이 생긴다 → `npm test -- <id>`.
4. 사용자에게 붙여 쓰는 코드(`embed/README.md` 형식)를 알려 준다.
