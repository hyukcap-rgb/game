# 숫자 합치기 — 게임 프롬프트 (games/merge)

> 이 파일은 이 게임의 **프롬프트**예요. 개발팀(Claude)은 이 게임을 고칠 때 항상 이 파일을 먼저 읽고 따릅니다.
> 바라는 방향·하지 말 것·고칠 점을 아래 **사용자 지시**에 적어 두면 다음 작업부터 반영돼요.

## 사용자 지시
<!-- 여기에 자유롭게 적으세요. 위에 적은 것이 가장 최근 지시예요. 개발팀은 이 목록을 지우지 않고 지킵니다. -->
- (아직 없음)

## 한 줄 소개
4×4 판을 위·아래·왼쪽·오른쪽으로 밀어 같은 숫자를 합쳐 목표 숫자 타일을 만드는 전략 퍼즐(능력: 전략력, 약 4분). 시간 제한 없음, 적은 이동이 좋은 점수.

## 규칙 (플레이어가 보는 것)
- 밀면 모든 타일이 끝까지 미끄러지고, 같은 숫자는 한 번씩 합쳐져 두 배. 움직임이 생기면 빈칸 하나에 새 타일(2: 90%, 4: 10% — `p4`).
- 목표 타일을 만들면 성공, 더 움직일 수 없으면 실패. 되돌리기는 판당 1번.
- 새 타일의 자리·값은 "몇 번째 이동인지"로 정해진 수열(`seqAt(M, k)`)에서 꺼내므로 되돌려도 같은 수가 나온다.
- 키보드 화살표·스와이프.

## 모드별 동작
**오늘의 문제·연습·대전**(`levels`, 돌 없음, 4×4):

| 난이도 | 목표 | 기준 이동 par | ★★★ / ★★ 이동 |
|---|---|---|---|
| easy | 128 | 67 | ≤67 / ≤87 |
| normal | 256 | 132 | ≤132 / ≤171 |
| hard | 512 | 247 | ≤247 / ≤321 |

par = `PAR` 표(16:9 · 32:19 · 64:38 · 128:67 · 256:132 · 512:247 · 1024:490 · 2048:980, 그 밖 목표×0.48). 오늘의 문제는 요일 난이도(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움), 배율 없음. 연습은 배율 0.6/1.0/1.4.

**솔로**(`stage(n)`, 개념 사이클 `planOf('merge', n)`):

| 스테이지 | 종류 | 이름(key) | 내용 |
|---|---|---|---|
| 6 | 변주 | 번개(flash) | 별 기준 이동 ×0.8 |
| 11 | 새 규칙 | 돌 칸(stone) | 구석 아닌 테두리 칸에 안 움직이는 돌(`ST = -1`) |
| 16 | 변주 | 4가 우르르(four) | p4 = .45 |
| 21 | 새 규칙 | 이동 제한(moves) | 이동 `mv` = ⌈par × mf⌉ 안에 목표 |
| 26 | 변주 | 맨손(bare) | 되돌리기 없음 |
| 31 | 새 규칙 | 자물쇠 타일(lock) | 벽처럼 고정, 같은 숫자로 부딪히면 풀리며 합쳐짐 |
| 36 | 변주 | 쌍둥이 타일(extra) | 4번 밀 때마다 새 타일 2개 |
| 41 | 새 규칙 | 좁은 판(small) | 3×3 |
| 46 | 변주 | 막힌 길(rot) | 한 방향 금지, 8번마다 위→오른쪽→아래→왼쪽 |

- 사이클 자리 k: 1 소개(쉬움) · 5 어려움 · 6 변주 소개 · 9 쉬어가기 · 10 보스. 51부터 리믹스.
- **사다리 `LAD[규칙 조합]`**: 쉬움 → 어려움 설정 목록(T 목표, s 돌 수, l 자물쇠 값들, p4, mf 이동 배수). 판마다 한 칸을 고름.
- 스테이지 1~100의 칸은 `TUNE` 문자열(36진수 한 글자씩, 자동 플레이어로 맞춤). 101~는 `RATE`(칸별 측정 성공률)에서 `wantRate(n)`(+변주 보정 `TW_EASE`)에 가장 가까운 칸.
- 목표 첫 도전 성공률 `wantRate`: k=1 92 · k=6·9 90 · k=2 86 · 3 83 · 4·7 80 · 8 77 · k=5 60 · 보스 40 (챕터마다 조금씩 내려감, 챕터 1은 +5).
- 솔로 par = `parFor(c)` = max(6, round((PAR(목표)×2.2 − 자물쇠 합×.6) / (새 타일 평균값 (2+2×p4)×(쌍둥이 1.25)))).
- 파일 머리 주석의 "보스 = 돌 블록 1개"는 예전 설명이다. 지금은 보스도 사다리 칸으로 정해진다.
- 챕터 이름: 숫자 마을 · 계산 공장 · 합산 탑 · 제곱 협곡 · 무한 궁전.

**별**(`starCut`): t3 = par, t2 = par×1.3. 이동 제한 판은 t3 ≤ mv×.85, t2 ≤ mv×.95. 번개는 둘 다 ×0.8. 이동 ≤ t3 → ★★★, ≤ t2 → ★★, 그 외 ★.

**대전**: normal(목표 256). `duelStat = { unit:'', tile:true, v:가장 큰 타일, t:목표 }`, `duelPace:[240,.62]`.

## 점수
엔진 `calcScore()` = round((base + time + extra) × 배율). `score()`:
- base 500
- time(효율) = round(350 × clamp((1.6×par − 이동) / (0.8×par), 0, 1)) — par는 솔로 `cfg.par`, 그 밖 `parOf(목표)`
- extra = 되돌리기 안 썼으면 150, 썼으면 0
- 판 위 `M.pts`(합친 값 합)는 표시용이고 결과 점수에 쓰지 않는다.

## 파일 지도
| 위치(함수/구역) | 하는 일 |
|---|---|
| `ST, SLIDE_MS, PAR, parOf` | 돌 값·밀기 시간·기준 이동 |
| `geo(N), LINES, DV` | 3×3·4×4 줄 순서·대칭·평가 가중 |
| `slideV / canMoveV / evalV / chanceV / rankMoves / aiMove` | 숫자 엔진(자동 플레이어·막힘 판정) |
| `EDGE, CORNER_PAIRS, spawnV, initV` | 새 판: 돌(구석 가두지 않게)·자물쇠(구석 제외)·첫 타일 2개 |
| `spawnCount, ROT_EVERY, banOf, simGame` | 쌍둥이·막힌 길, 사람 같은 자동 플레이어 한 판 |
| `seqAt / spawnInto / slideT` | 화면용 타일 판, 이동 번호별 새 타일 수열 |
| `LAD, ladKey, parFor, buildCfg, wantRate, TUNE, RATE, TW_EASE, rungOf, starCut` | 솔로 난이도 v2 |
| `hud / mkTile / drawAll / measure / cellXY` | 화면 |
| `doMove / mergeFx / combo / celebrate / stuck / undo` | 한 번 밀기·연출·승리·막힘·되돌리기 |
| `tipHTML` | 판 위 규칙 칩 |
| `return { … }` | NG.merge 계약, `_core`·`_tune`·`_move`·`_undo`·`_solveForTest`·`_set`·`_state` |
| 파일 끝 `Object.assign(NG.merge, { duelPace, duelStat })` | 대전 설정 |

## 고칠 때 지킬 것
- 돌·자물쇠 자리, 첫 타일, 새 타일 수열은 **주어진 rng(`M.rng`)에서만**(Math.random 금지) → 같은 날짜 씨앗이면 모두 같은 판. 새 타일은 반드시 `seqAt`(이동 번호 → 수열)로 꺼내 되돌리기로 다른 수를 뽑지 못하게 한다.
- `initV`의 rng 호출 순서, `seqAt`의 쌍 크기(쌍둥이면 4개)를 바꾸면 같은 날짜 문제가 바뀐다.
- `simGame`(자동 플레이어)과 화면 `doMove`는 같은 규칙이어야 한다. 규칙·par·사다리를 바꾸면 `TUNE`/`RATE`를 `_core.simGame`으로 다시 재서 맞춘다(전용 도구 없음, 판마다 40판으로 칸 찾기·100판 검증).
- NG.merge 계약(name·col·help·chapters·starRule·levels·concepts·stage·stageDesc·levelDesc·init·render·progress·lossText·score·stars·css …)과 `duelStat`(tile:true)을 지킨다.
- CSS는 `css` 문자열 안에만, `.ng-merge` / `body[data-mode="merge"]`로 범위를 묶는다(키프레임 `merge_…`).
- 그림·이름은 오리지널만(상용 숫자 퍼즐 이름·디자인 금지, 15_게임개편_IP대응.md).
- core/를 바꾸면 모든 게임과 embed 모듈이 같이 바뀐다.

## 확인 방법
- `node tools/build.js` → index.html 목록과 `embed/merge.html` 다시 만들기.
- 브라우저: `index.html`, `embed/merge.html?mode=daily|practice|solo|duel`(옵션 `&level=…`, `&stage=n&unlock=1`). 개발자 도구에서 `NG.merge._solveForTest()`, `NG.merge._state()`로 빠른 확인.
- `npm test -- merge` (사이트·모듈에서 모든 모드를 한 판씩 자동 점검, `tools/test.mjs`).

## 바뀐 기록
- 2026-10-03 256 이상이 생기면 빛 알갱이가 그 칸으로 빨려 들어가고 512 이상은 번쩍. 움직이는 배경(빛 방울)(보이기만 함 — 규칙·점수·대전 그대로)
- 2026-10-03 게임별 폴더·게임 정의(NG.<id>)·붙여 쓰는 모듈(embed/<id>.html) 구조로 정리
