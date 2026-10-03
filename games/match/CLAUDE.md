# 동물 삼총사 — 게임 프롬프트 (games/match)

> 이 파일은 이 게임의 **프롬프트**예요. 개발팀(Claude)은 이 게임을 고칠 때 항상 이 파일을 먼저 읽고 따릅니다.
> 바라는 방향·하지 말 것·고칠 점을 아래 **사용자 지시**에 적어 두면 다음 작업부터 반영돼요.

## 사용자 지시
<!-- 여기에 자유롭게 적으세요. 위에 적은 것이 가장 최근 지시예요. 개발팀은 이 목록을 지우지 않고 지킵니다. -->
- (아직 없음)

## 한 줄 소개
7×7 판에서 이웃한 동물을 밀어 바꿔 같은 동물 3마리 이상을 맞추는 퍼즐(능력: 추리력, 약 2분). 동물 7종(문어·고래·병아리·개구리·부엉이·여우·판다)은 공용 3D 장난감 그림(core의 `TOY`)을 쓴다.

## 규칙 (플레이어가 보는 것)
- 이웃한 두 칸을 바꿔 가로·세로 3줄, **2×2 네모**, 이어진 5마리 이상 덩어리가 되면 사라짐(붙은 같은 동물은 함께). 맞춰지지 않는 교환은 되돌아감.
- 특수 동물: 4줄 = 줄 폭탄(가로/세로), ㄱ·ㅗ 모양 또는 6마리 이상 = 3×3 폭탄, 5줄 = 무지개 별, 2×2 = 별사탕(X자 대각선 2칸씩). 특수끼리 바꾸면 조합 폭발(무지개+무지개 = 판 전체 등).
- 연쇄(캐스케이드) k번째 단계 점수 배율 = 1 + 0.25×(k−1). 움직일 곳이 없으면 자동 섞기, 5초 가만히 있으면 힌트 흔들림.
- 솔로만: 목표 모으기(동물·나무 상자·얼음·사슬) + 이동 횟수, 아이템(이동 안 씀).

## 모드별 동작
**오늘의 문제·연습·대전**: 시간 제한 없음, 이동 20번(`DAY_MOVES`) 안에 목표 점수. `levelCfg(lv)` = `LV`(종류 수·f) × `BOT`(자동 플레이어 20수 평균: 5종 8520, 6종 3480).

| 난이도 | 동물 종류 | 목표 점수 | 자동 플레이어 성공률(설계) |
|---|---|---|---|
| easy | 5 | 5110 | 약 90% |
| normal | 6 | 2680 | 약 75% |
| hard | 6 | 3170 | 약 55% |

오늘의 문제 난이도는 요일로 정해짐(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움, 사이트·모듈 공통), 배율 없음(`HOST.flatMult`). 연습은 `LEVELS` 배율 0.6/1.0/1.4.

**솔로**(`stageCfg` → `stagePlan(n)`): `mode:'moves'`. 이 게임은 개념 사이클 대신 **고정 등장 판**(`NG.match.concepts = { fixed:[…] }`)을 쓴다.

| 스테이지 | 새 장애물(key) | 설명 |
|---|---|---|
| 6 | 나무 상자(box) | 옆에서 맞추거나 폭발로 한 겹씩, 움직이지 않음 |
| 11 | 얼음 바닥(ice) | 그 칸이 터지면 한 겹 녹음 |
| 21 | 사슬(chain, 코드 내부 `lock`) | 묶인 동물은 못 옮김, 맞추면 풀림 |
| 26 | 2겹 상자(box2) | |
| 31 | 두꺼운 얼음(ice2) | |
| 46 | 3겹 상자(box3) | 보스 판에서 |

- 사이클(10판): 5 = 어려움, 10 = 보스(아주 어려움), 6 = 쉬어가기(`boost` .8). 인트로 판(6·7·11·12·21·22·26·31·46)은 그 장애물만.
- 이동 수 = `min(30, 16 + floor(n/4))` 기본, `MT_D[n]`이 `[배율, 이동]`이면 이동을 따로(최대 40). `MT_D` = 스테이지 1~100 목표 양 배율(자동 튜닝 값). 101 이후는 51~100을 돌려 쓰고 50판마다 +3%.
- 동물 종류: 1~3판 5종, 그 뒤 6종. 레이아웃·목표 무작위는 `mb(seedFrom('mtplan:'+n))`(스테이지별 고정).
- 아이템(`ITEMS`, 처음 열릴 때 3개씩 지급, 저장 키 `hp:mtItems`): 8 뿅망치 · 13 십자 폭죽 · 18 바꿔 장갑 · 23 동물 피리.
- 챕터 이름: 문어 바닷가 · 병아리 농장 · 개구리 연못 · 부엉이 숲 · 판다 대나무숲.

**별**: 솔로 = 이긴 순간 남은 이동 `l` ≥ max(2, ⌈이동×0.2⌉) ★★★, ≥ max(1, ⌈이동×0.1⌉) ★★, 그 외 ★. 점수 모드 = 점수 ≥ 목표×1.6 ★★★, ≥×1.3 ★★.

**대전**: normal 설정(6종·2680점·20번). `duelStat = { unit:'점', score:true, v:현재 점수, t:목표 }`, `duelPace:[120,.62]`이지만 AI는 게임 전용 `duelAi(rng)`(점수 = 목표×0.75~1.55, 1번에 약 5~7초)를 쓴다. `duelHow:'20번 움직여 누가 더 높은 점수?'`

## 점수
엔진 `calcScore()` = round((base + time + extra) × 배율). `score()`:
- 점수 모드: base 500 · time = clamp(round(350×(점수−목표)/(0.8×목표)), 0, 350) · extra = clamp(25×(최고 콤보−1), 0, 150).
- 솔로(moves): base 500 · time = min(350, 남은 이동×35) · extra = 위와 같은 콤보 보너스.
- 판 안 점수: 그룹당 10×n + 20×max(0, n−3), 특수 발동 보너스 `ACT_BONUS`(줄 40·폭탄 60·무지개 100·별사탕 50), 상자·사슬·얼음 한 겹마다 +20, 연쇄 배율 곱.

## 파일 지도
| 위치(함수/구역) | 하는 일 |
|---|---|
| 상단 상수 `N, KINDS, S_*, ACT_BONUS, BOT, DAY_MOVES, MT_D` | 판 크기·특수 종류·점수표·튜닝 표 |
| `makeEngine(rng,K)`, `nextKind` | 시작 판(바로 맞는 줄 없고 움직일 곳 있게), 열마다 rng에서 뽑은 보충 수열 |
| `lineRuns / isSquare / blob / findGroups` | 맞춤 그룹 찾기(줄·2×2·덩어리) |
| `swapValid / listMoves / hasMove` | 유효한 수 |
| `step(E,groups,seed,k)` | 한 단계: 특수 생성·발동·장애물 피해·낙하·보충·점수 |
| `move(E,a,b)` | 한 수 + 연쇄, 특수 조합 처리 |
| `itemCells / gloveSwap / blastCells` | 아이템 효과 |
| `goalLeft / goalDone / goalVal`, `shuffleBoard` | 솔로 목표, 막힘 섞기(E.rng 사용) |
| `bestMove / botRun / botMoves` | 자동 플레이어(튜닝·테스트용) |
| `LV, levelCfg, duelAi` | 오늘의 문제·대전 난이도, 대전 AI |
| `MT_UNLOCK, MT_Q, stagePlan, makeStage, stageCfg` | 솔로 스테이지 설계 |
| 그림 `SRC/IMG, bake, tileInner` | SVG → PNG 굽기(폰 성능) |
| 화면 `M`, `frame / tw / playStep / tryMove / movesCheck / endMoves` | 애니메이션 루프·한 수 연출·끝 판정 |
| `ITEMS, inv, paintDock, itemTap, useItem` | 솔로 아이템 |
| `bindInput / sizeBoard / hud / banner` | 입력(스와이프·두 번 누르기·키보드)·HUD |
| `return { … }` | NG.match 계약(help·levels·stage·score·stars·css·sounds 등), `_eng`·`_test` |
| 파일 끝 `NG.match.concepts`, `Object.assign(NG.match,{duelPace,duelStat,duelHow})` | 고정 개념 카드, 대전 설정 |

## 고칠 때 지킬 것
- 판 내용(시작 판·보충 동물·섞기)은 **반드시 주어진 rng(`E.rng`, 열별 `mb(...)`)에서만**. `Math.random`은 연출(회전 흔들림)에만 쓴다 → 같은 날짜 씨앗이면 모두 같은 판, 대전 두 사람도 같은 판.
- 점수·특수 규칙을 바꾸면 `BOT`·`LV.f`·`MT_D`가 틀어진다 → `tools/match-tune.js daily`/`tune`으로 다시 맞추고 표를 고친다.
- `_eng`의 이름(makeEngine, stagePlan, botMoves, levelCfg …)과 `NG.match = (() => {` … `\n})();` 모양은 match-tune.js가 소스를 잘라 쓰므로 유지.
- NG.match 계약(name·col·help·chapters·starRule·levels·stage·stageDesc·stageTag·levelDesc·init·render·progress·lossText·score·stars·css·sounds·gate·jingle, duelStat 등)을 지킨다.
- CSS는 모듈의 `css` 문자열 안에만, `.ng-match` / `body[data-mode="match"]`로 범위를 묶는다(키프레임은 `mt…` 접두). 예외: 끝부분 `.modal .path .st.hard/.xhard`는 모든 게임 솔로 지도에 걸린다 — 건드릴 때 주의.
- 그림·이름은 오리지널만(상용 게임 이름·그림·효과음 금지, 15_게임개편_IP대응.md). 동물은 core의 공용 `TOY` 그림.
- core/(engine.js·duel.js·effects-sound.js 등)를 바꾸면 모든 게임과 embed 모듈이 같이 바뀐다.

## 확인 방법
- `node tools/build.js` → index.html 파일 목록과 `embed/match.html` 다시 만들기(게임 파일을 고친 뒤 매번).
- 브라우저: `index.html`, `embed/match.html?mode=daily|practice|solo|duel`(옵션 `&level=easy|normal|hard`, `&stage=n&unlock=1`).
- `npm test -- match` (사이트·모듈에서 모든 모드를 한 판씩 자동 점검, `tools/test.mjs`).
- 튜닝(헤드리스, index.html을 읽음):
  - `node tools/match-tune.js tune [from] [to] [index.html]` — 솔로 MT_D 다시 맞추기(JSON 한 줄씩, `PLAYS=40` 환경변수로 판수)
  - `node tools/match-tune.js winrate [from] [to] [index.html] [판수]` — 지금 MT_D 스테이지별 승률
  - `node tools/match-tune.js daily [index.html] [판수]` — 이동 20번 점수 분포 → BOT 평균·난이도별 f

## 바뀐 기록
- 2026-10-03 게임별 폴더·게임 정의(NG.<id>)·붙여 쓰는 모듈(embed/<id>.html) 구조로 정리
