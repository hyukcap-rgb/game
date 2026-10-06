# 블록 채우기 — 게임 프롬프트 (games/block)

> 이 파일은 이 게임의 **프롬프트**예요. 개발팀(Claude)은 이 게임을 고칠 때 항상 이 파일을 먼저 읽고 따릅니다.
> 바라는 방향·하지 말 것·고칠 점을 아래 **사용자 지시**에 적어 두면 다음 작업부터 반영돼요.

## 사용자 지시
<!-- 여기에 자유롭게 적으세요. 위에 적은 것이 가장 최근 지시예요. 개발팀은 이 목록을 지우지 않고 지킵니다. -->
- 2026-10-06 세대별 테스트: 칸 경계가 잘 보이게(대비 3:1 이상), 끌 때 손가락 위 60px·놓일 자리 진하게, 조각 누르고 판 칸 누르기로도 놓기, 이름표 "지운 줄 3/10", 줄 지울 때 빛·날아감·"2줄 콤보!". 대전은 12줄 먼저·3분(2~5명·미니 화면·결과 판 나란히는 대전 v3에서, 공격(돌 보내기)은 보류).
- 2026-10-04 UI 검수 결론: 공용 HUD 칩·기회 별·도구 버튼 규격을 따른다.

## 한 줄 소개
8×8 판에 아래 조각 3개를 끌어다 놓아 가로·세로 줄을 꽉 채워 지우는 공간지각 퍼즐(능력: 공간지각, 약 3분). 블록은 캔버스로 직접 그린 오리지널 광택 블록, 시간 제한 없음(대전만 3분).

## 규칙 (플레이어가 보는 것)
- 조각 3개 중 하나를 끌어 빈 곳에 놓기(조각은 손끝 위 `LIFT` 60px에 뜸, 놓일 자리 60% 진하게). 3개를 다 쓰면 새 3개. 놓을 곳이 하나도 없으면 실패.
- **누르고 놓기(tapPlace)**: 조각을 누르기만 하면(10px 안) 골라지고(노란 테두리), 판 칸을 누르면 그 칸을 덮는 자리에 놓임(`tapSpot`: 조각 가운데에 가까운 칸부터 맞춰 보고 처음 들어가는 자리). 다시 누르면 취소, 안 들어가면 "거기엔 안 들어가요".
- 가로·세로 줄을 빈틈없이 채우면 지워짐. 여러 줄 동시(멀티)·연속(콤보)이면 점수가 커짐.
- 목표 줄 수를 지우면 성공. 조각을 적게 쓸수록 점수·별이 많음.
- 조각 13가족(o1·i2~i5·o2·o3·r23·v3·l4·t4·s4·v5), 난이도 d(0~1.4)에 따라 뽑힐 무게가 바뀜(`FAM[].w(d)`).

## 모드별 동작
**오늘의 문제·연습·대전**(`levels = LV`, 특수 칸 없음):

| 난이도 | 목표 줄 | 조각 난이도 d | need(새 세트 중 판에 맞아야 할 조각 수) | 기준 조각 수 par |
|---|---|---|---|---|
| easy | 10 | .2 | 2 | 23 |
| normal | 20 | .45 | 1 | 42 |
| hard | 30 | .65 | 1 | 59 |

par = `E.par(cfg)` = round(.94×(목표×(2.3−.5d)+3) − .25×돌 수). 오늘의 문제는 요일 난이도(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움), 배율 없음. 연습은 배율 0.6/1.0/1.4.

**솔로**(`stageCfg(n)`, 개념 사이클 `planOf('block', n)`):

| 스테이지 | 종류 | 이름(key) | 내용 |
|---|---|---|---|
| 6 | 변주 | 번개(flash) | 별 기준 조각 수 ×0.8 |
| 11 | 새 규칙 | 보석 모으기(gem) | 보석 든 줄을 지워 모으기(목표 = 보석 수) |
| 16 | 변주 | 두 개씩(duo) | 조각이 2개씩 |
| 21 | 새 규칙 | 얼음 칸(ice) | 두 번 지워야 깨짐(목표 = 얼음 수) |
| 26 | 변주 | 큰 조각 가방(big) | 큰 조각 무게 ↑(`BIGF`), d+.25 |
| 31 | 새 규칙 | 시한폭탄(bomb) | 조각 놓을 때마다 숫자 −1, 0이 되면 실패 |
| 36 | 변주 | 돌 블록(rock) | 돌 4+2×min(3,⌊c/3⌋)개 미리 놓임 |
| 41 | 새 규칙 | 덩굴(vine) | 한 세트 동안 줄을 못 지우면 옆으로 자람 |
| 46 | 변주 | 미리보기 없음(nopeek) | 지워질 줄이 미리 빛나지 않음 |

- 사이클 자리 k: 1 소개(쉬움) · 5 어려움 · 6 변주 소개 · 9 쉬어가기 · 10 보스(챕터 1 보스는 돌 6개). 51부터 리믹스.
- **`BK_T[n] = [y, 기준 조각 수]`**(스테이지 1~100, tools/block-tune.js가 맞춘 값). y 하나로 난이도: 0~1.4 = 조각 난이도 d, 음수 = 목표 줄이고 폭탄 숫자 늘림(−1 아래는 새 조각이 모두 들어가게 need 3), 1.4 초과 = 목표 늘림.
- 목표 길이 = `ROLE[k]` × (1 + .1×min(9, c−1)) × len. 줄 목표 max(3, round(7×rl)), 얼음·보석 판은 줄 목표 0.
- 표 밖(101~)은 `yOf(n)`: 같은 자리·비슷한 규칙 판들의 y 평균 + 챕터당 조금(최대 +0.2), par는 `parGuess(c)`.
- 목표 첫 판 클리어율: 쉬움 90% · 보통 75~85% · 어려움 60% · 보스 40%.
- 챕터 이름: 나무 상자 · 보석 광산 · 얼음 궁전 · 용암 동굴 · 덩굴 숲.

**별**: 쓴 조각 ≤ par → ★★★, ≤ par×1.35 → ★★, 그 외 ★.

**대전**(경주 `duelKind:'race'`, 지금은 1:1 `duelMax:2`): 대전 판 `DUEL` = 12줄 먼저 · 3분 · d .45(`duelCfg()`; 지금 엔진은 levels.normal로 시작하므로 `init`에서 `G.duel`이면 바꿔 끼우고 `G.limit` 180). 시간이 다 되면 `duelClock`이 그 자리 기록으로 끝(진행률 = 지운 줄/12). HUD 시간 칩은 대전에서 '남은 시간'. `duelStat = { unit:'줄', v, t, mis:0 }`, `duelPace:[130,.7]`, `duelHow`, `duelMini`(v3용: 칸마다 16진 글자 64개 + 8×8 작은 그림 칸 6px).

## 점수
엔진 `calcScore()` = round((base + time + extra) × 배율). `score()`:
- base 500
- time(효율) = `E.eff(used, par)` = round(350 × clamp((1.35×par − 쓴 조각) / (0.35×par), 0, 1))
- extra = min(150, 50 × 멀티 클리어 횟수(한 번에 2줄 이상))
- 판 안 표시 점수(`s.pts`, 결과 점수와 별개): 조각 칸 수 + round(10×(지운 칸+금 간 얼음)×줄 수×(1+(콤보−1)×.5)) + 보석당 30.

## 파일 지도
| 위치(함수/구역) | 하는 일 |
|---|---|
| 상단 `N, STONE, ICE2, ICE1, GEM, BOMB, VINE, PAL` | 칸 종류·색 |
| `FAM, mkPiece, BIG, BIGF` | 조각 가족·회전/뒤집기·큰 조각 |
| `E.canPlace / fits / place` | 판 논리(순수 함수, 줄 지우기·특수 칸 처리) |
| `E.draw / tray` | 무게대로 조각 뽑기, 새 세트(need개 이상 맞을 때까지 같은 rng로 최대 20번) |
| `E.stones / icePlace / spot / topGems / topBombs / grow` | 돌·얼음·보석·폭탄·덩굴 배치 |
| `E.setup / step / goalDone` | 새 판 상태, 조각 하나 놓기(지우기→목표→폭탄→세트 끝 처리→새 조각→막힘) |
| `E.quality / best / botEval / botCands / botMove / botRun, BW` | 자동 플레이어(튜닝·테스트) |
| `E.par / E.eff`, `LV` | 기준 조각 수·효율 점수, 오늘의 문제 난이도 |
| `sprite / drawPiece / drawBoard / frame` | 캔버스 그림 |
| `init / cleanup / render / layout / paintTray / hud` | 상태·화면 |
| `dragStart / dragMove / dragUpdate / dragEnd` | 끌어 놓기(손끝 위 `LIFT` 46px) |
| `doPlace / clearFx / win / lose` | 놓기·연출(줄 빛·블록 날아감·"N줄 콤보!"·3줄 이상 번쩍)·끝 |
| `pickSel / tapSpot / boardTap` | 누르고 놓기 |
| `duelClock` | 대전 3분 시계 |
| `BK_T, ROLE, Y0, yOf, stageCfg, parGuess, goalText` | 솔로 스테이지 |
| `return { … }` | NG.block 계약, `_E · _LV · _stageCfg · _BK_T` 테스트용 |
| 파일 끝 `Object.assign(NG.block, { duelPace, duelStat })` | 대전 설정 |

## 고칠 때 지킬 것
- 조각 순서·특수 칸 자리는 **주어진 rng(`st.rng`)에서만**(Math.random은 승리 반짝이 연출에만) → 같은 날짜 씨앗이면 모두 같은 조각 순서. 오늘의 문제는 특수 칸이 없어 예전과 같은 순서로 rng를 쓴다 — `setup`/`tray`에서 rng 호출 순서를 바꾸면 문제가 바뀐다.
- 판 논리(`E`)는 화면 없이 도는 순수 함수로 유지(자동 플레이어·튜닝 도구가 같은 코드를 씀). 규칙·조각 무게·par 식을 바꾸면 `BK_T`를 다시 맞춘다.
- `BK_T`는 손으로 고치지 말고 `block-tune.js apply`로 쓴다(`const BK_T = [` 한 줄 모양 유지). `NG.block = (function(){` … `\n})();` 모양도 도구가 잘라 쓰므로 유지.
- NG.block 계약(name·col·help·chapters·concepts·starRule·levels·stage·stageDesc·levelDesc·init·render·progress·lossText·score·stars·css …)과 `duelStat`을 지킨다.
- CSS는 `css` 문자열 안에만, `.ng-block` / `body[data-mode="block"]`로 범위를 묶는다(키프레임 `bk…`).
- 그림·이름은 오리지널만(상용 블록 게임 이름·그림 금지, 15_게임개편_IP대응.md).
- core/를 바꾸면 모든 게임과 embed 모듈이 같이 바뀐다.

## 확인 방법
- `node tools/build.js` → index.html 목록과 `embed/block.html` 다시 만들기.
- 브라우저: `index.html`, `embed/block.html?mode=daily|practice|solo|duel`(옵션 `&level=…`, `&stage=n&unlock=1`).
- `npm test -- block` (사이트·모듈에서 모든 모드를 한 판씩 자동 점검, `tools/test.mjs`).
- 튜닝(헤드리스, `PLAYS` 환경변수 = 판마다 플레이 수, 기본 60):
  - `node tools/block-tune.js tune [from] [to] [index.html]` — BK_T 다시 맞추기 → 판마다 JSON `{n, y, par, rate, want}`
  - `node tools/block-tune.js refine [from] [to] [index.html]` — 지금 값을 150판으로 재고 어긋난 판만 y 조금 옮김
  - `node tools/block-tune.js apply a.jsonl b.jsonl …` — 결과를 BK_T 표(games/block/block.js)에 씀
  - `node tools/block-tune.js winrate [from] [to] [index.html] [판수]` — 지금 BK_T 첫 판 클리어율

## 바뀐 기록
- 2026-10-06 v1.1.0 세대별 테스트(WP13): 판 대비(빈칸 #2B2360·칸 테두리 #8274DA 1.5px = 3.6:1, 판 바깥 테두리 밝게), 조각 받침 테두리 밝게·조각 크게(판 칸의 62→70%), 끌 때 손가락 위 46→60px·놓일 자리 60%, 누르고 놓기(tapPlace), 이름표 "지운 줄 3/10"(13px, 조각 수 칩 뺌), 줄 빛·블록 날아감·"N줄 콤보!"·3줄 이상 번쩍 세게, 대전 12줄·3분(`DUEL`/`duelCfg`·`duelClock`·`duelMini`), 도움말 4번(솔로 특별한 칸) 빼고 개념 카드로 + `howto` 3줄
- 2026-10-04 UI 검수: 위쪽 정보줄을 공용 칩(목표 진행·걸린 시간·점수, 이름표)으로, 조각 받침을 화면 맨 아래 엄지 자리로, 12px 미만 글자 정리(보이기만 바뀜 — 규칙·점수·대전 그대로)
- 2026-10-03 줄이 지워질 때 그 줄을 따라 반짝이가 훑고, 3줄 이상이면 화면이 살짝 번쩍. 움직이는 배경(떠다니는 도형)(보이기만 함 — 규칙·점수·대전 그대로)
- 2026-10-03 게임별 폴더·게임 정의(NG.<id>)·붙여 쓰는 모듈(embed/<id>.html) 구조로 정리
