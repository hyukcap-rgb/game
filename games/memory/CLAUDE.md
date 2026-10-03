# 카드 짝 맞추기 — 게임 프롬프트 (games/memory)

> 이 파일은 이 게임의 **프롬프트**예요. 개발팀(Claude)은 이 게임을 고칠 때 항상 이 파일을 먼저 읽고 따릅니다.
> 바라는 방향·하지 말 것·고칠 점을 아래 **사용자 지시**에 적어 두면 다음 작업부터 반영돼요.

## 사용자 지시
<!-- 여기에 자유롭게 적으세요. 위에 적은 것이 가장 최근 지시예요. 개발팀은 이 목록을 지우지 않고 지킵니다. -->
- (아직 없음)

## 한 줄 소개
처음 몇 초 모든 카드를 보여 준 뒤 덮고, 두 장씩 뒤집어 같은 그림 짝을 제한 시간 안에 모두 찾는 기억력 게임(능력: 집중력, 약 2분). 그림 27종(과일·하늘·소품 23 + 동물 4)은 모두 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45).

## 규칙 (플레이어가 보는 것)
- 카드 나눠주기 → 미리 보기(앞면) → 덮고 시작. 두 장을 뒤집어 같으면 짝, 다르면 다시 덮임(틀린 뒤집기 1번).
- 제한 시간 안에 짝을 모두 찾으면 성공. 시간이 끝나면 남은 짝을 보여 주고 실패.
- 연달아 맞히면 콤보 연출. 덜 틀리고 빨리 찾을수록 점수가 높음.

## 모드별 동작
**오늘의 문제·연습·대전**(`levels`):

| 난이도 | 배열 | 짝 | 제한 시간 | 미리 보기 |
|---|---|---|---|---|
| easy | 4×4 | 8쌍 | 90초 | 3초 |
| normal | 4×5 | 10쌍 | 120초 | 2.5초 |
| hard | 5×6 | 15쌍 | 180초 | 2초 |

오늘의 문제는 요일 난이도(월·화 쉬움 · 수·목·금 보통 · 토·일 어려움), 배율 없음. 연습은 배율 0.6/1.0/1.4.

**솔로**(`stageCfg(n)`, 개념 사이클 `planOf('memory', n)`, 개념 표 `CONC`):

| 스테이지 | 종류 | 이름(key) | 내용 |
|---|---|---|---|
| 6 | 변주 | 번개(flash) | 카드 ×0.75, 시간 짧게 |
| 11 | 새 규칙 | 세 장 짝(triple) | 같은 그림 3장, 세 장이 같아야 짝 |
| 16 | 변주 | 외줄 타기(tight) | 허용 실수(`missCap`) 넘으면 실패 |
| 21 | 새 규칙 | 폭탄 카드(bomb) | 뒤집으면 −8초(`BOMB_SEC`) + 덮인 두 장 자리 바꿈, 폭탄은 사라짐 |
| 26 | 변주 | 카드 섞기(shuffle) | 짝 3번마다 덮인 카드 최대 3쌍 자리 바꿈 |
| 31 | 새 규칙 | 조커(joker) | 아무 카드와 짝, 같이 뒤집은 카드의 나머지 짝까지 한꺼번에 |
| 36 | 변주 | 맨손(bare) | 미리 보기 없음, 카드 ×0.8 |
| 41 | 새 규칙 | 닮은꼴(twins) | 색이 다르고 리본 단 카드(키 + `~b`), 색·리본까지 같아야 짝 |
| 46 | 변주 | 째깍 벌칙(tick) | 틀릴 때마다 −3초 |

- 사이클 자리 k: 1 소개(쉬움) · 5 어려움 · 6 변주 소개 · 9 쉬어가기 · 10 보스. 51부터 리믹스. 챕터 1은 과일 8종만(`fruit`).
- 카드 수: 챕터 1 = `MT.ch1[k−1]`(6·8·12·12·16·10·12·16·12·14), 챕터 2~ = `MT.base[c] + MT.kOff[k]`, 세 장 짝 ×0.8, 변주 배수. 폭탄 1개(k=5·10과 리믹스 k=8은 2개), 조커 1개, 전체 42장 이하. 배열은 `gridOf`(세로 화면에 거의 정사각).
- 제한 시간 = `MT.A`(0.742) × 카드^(1.4 [+0.474 세 장 짝]) × `kTime[k]` × 규칙 배수(`mjTime`, 폭탄은 개수만큼) × 변주 배수(`twTime`) × (세 장+조커 0.84) × (보스+변주 `bossTw`), 최소 max(10, 1.5×카드)초.
- 미리 보기 = 카드 ≤12면 3초, ≤20이면 2.5, 그 위 2 (보스 −0.5, 폭탄 +0.5, 최소 1.5, 맨손 0).
- 외줄 허용 실수 = max(2, round(0.4 × 짝^1.4 × `capK[k]` × (세 장 2.6) × (닮은꼴 1.15))).
- 목표 첫 도전 클리어율: k=1·6·9 ≈90%, 보통 75~85%, k=5 ≈60%, 보스 ≈40%(챕터마다 조금씩 내려감).
- 챕터 이름: 과일 바구니 · 장난감 상자 · 별빛 하늘 · 바닷속 친구들 · 마법 서랍.

**별**(f = 세 장 짝이면 1.6, 아니면 1): 틀린 뒤집기 ≤ 짝×0.5×f → ★★★, ≤ 짝×1.2×f → ★★, 그 외 ★.

**대전**: normal(4×5, 120초). `duelStat = { unit:'쌍', v:찾은 짝, t:전체 짝 }`, `duelPace:[70,.74]`.

## 점수
엔진 `calcScore()` = round((base + time + extra) × 배율). `score()`:
- base 500
- time = max(0, 350 − floor(sec × 350 / 제한 시간)), sec = min(제한, 경과초 + 벌칙초(폭탄·째깍))
- extra = max(0, round(150 × (1 − 틀린 뒤집기 / (1.5 × 짝 × f))))

## 파일 지도
| 위치(함수/구역) | 하는 일 |
|---|---|
| `OL, O, O2, HL, FACE, starPath` | 그림 공통 조각 |
| `SYM, ANIMAL, FRUITS, POOL, symSvg` | 카드 그림 목록(이름·대표색·SVG) |
| `BOMB, JOKER, ALT, *_SVG, faceHtml, cardName` | 특수 카드·닮은꼴 리본 |
| `CONC, RULE_TIP` | 개념 사이클 정의·판 위 규칙 이름표 |
| `MT, gridOf, stageCfg` | 솔로 난이도 표(memory-bot이 맞춘 값)·배열·스테이지 설정 |
| `S, T(타이머), cardEl, setUp, hud, msg, layout` | 상태·화면 |
| `startPlay, loop` | 나눠주기 → 미리 보기 → 진행 시계 |
| `tap, match, jokerMatch, miss, afterMatch, celebrate` | 뒤집기·짝 판정 |
| `boom, swapCards, swapTwist` | 폭탄·카드 섞기(자리 바꿈은 `m.rng`) |
| `win, timeUp, failMiss, showLeft, build` | 끝 처리·판 만들기 |
| `return { … }` | NG.memory 계약(levels·concepts·stage·init·render·score·stars·css·sounds …), `_solveForTest` |
| 파일 끝 `Object.assign(NG.memory, { duelPace, duelStat })` | 대전 설정 |

## 고칠 때 지킬 것
- 카드 배치·그림 선택·폭탄/섞기 자리 바꿈은 **주어진 rng(`init`의 rng, `m.rng`)에서만**(Math.random 금지) → 같은 날짜 씨앗이면 모두 같은 배치.
- 기본 판(두 장 짝, 특수 없음)은 `init`의 첫 분기에서 예전과 같은 순서로 rng를 쓴다 — 이 순서를 바꾸면 오늘의 문제·대전 판이 바뀐다.
- 그림을 추가·삭제하면 `POOL` 순서가 바뀌어 같은 씨앗의 판이 달라진다(필요하면 끝에 추가). 짝은 반드시 `g`장씩 존재해야 한다.
- 난이도 식(`MT`, `stageCfg`)을 바꾸면 `tools/memory-bot.js --calib`으로 다시 맞춘다. `NG.memory = (() => {` … `\n})();` 모양과 `stage(n)`은 도구가 잘라 쓰므로 유지.
- NG.memory 계약(name·col·help·chapters·starRule·levels·concepts·stage·stageDesc·levelDesc·init·render·progress·lossText·score·stars·css …)과 `duelStat`을 지킨다.
- CSS는 `css` 문자열 안에만, `.ng-memory` / `body[data-mode="memory"]`로 범위를 묶는다(키프레임 `memory-…`).
- 그림·이름은 오리지널만(상용 게임·캐릭터 그림 금지, 15_게임개편_IP대응.md).
- core/를 바꾸면 모든 게임과 embed 모듈이 같이 바뀐다.

## 확인 방법
- `node tools/build.js` → index.html 목록과 `embed/memory.html` 다시 만들기.
- 브라우저: `index.html`, `embed/memory.html?mode=daily|practice|solo|duel`(옵션 `&level=…`, `&stage=n&unlock=1`).
- `npm test -- memory` (사이트·모듈에서 모든 모드를 한 판씩 자동 점검, `tools/test.mjs`).
- 시뮬레이터(헤드리스): `node tools/memory-bot.js [판수=400] [from=1] [to=70] [--calib] [--file index.html]` — 기억 용량 제한 봇으로 스테이지별 첫 도전 클리어율. `--calib`이면 판마다 제한 시간·허용 실수를 이분 탐색하고 `MT` 추천값(A·alpha·alpha3·kTime·mjTime·twTime·tjTime)을 JSON 한 줄로 낸다.

## 바뀐 기록
- 2026-10-03 짝을 맞히면 카드 위로 하트·반짝이가 떠오름. 움직이는 배경(꽃잎·하트)(보이기만 함 — 규칙·점수·대전 그대로)
- 2026-10-03 게임별 폴더·게임 정의(NG.<id>)·붙여 쓰는 모듈(embed/<id>.html) 구조로 정리
