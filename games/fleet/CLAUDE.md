# 함대 결전 — 게임 프롬프트 (games/fleet)

> 이 파일은 이 게임의 **프롬프트**예요. 개발팀(Claude)은 이 게임을 고칠 때 항상 이 파일을 먼저 읽고 따릅니다.
> 바라는 방향·하지 말 것·고칠 점을 아래 **사용자 지시**에 적어 두면 다음 작업부터 반영돼요.

## 사용자 지시
<!-- 여기에 자유롭게 적으세요. 위에 적은 것이 가장 최근 지시예요. 개발팀은 이 목록을 지우지 않고 지킵니다. -->
- 2026-10-06 세대별 테스트: 실시간 한 차례 10초(느긋하게 30초, 같은 속도끼리 짝), 배치 화면 맨 앞 큰 [자동으로 놓고 출격], 배를 누르고 ◀▲▼▶·⟳로 옮기기, 조준해 둔 칸 자동 발사는 그대로, 오늘의 문제 = '오늘의 바다 · 컴퓨터와 해전', 'AI' 대신 '컴퓨터'.
- 2026-10-04 UI 검수 결론: 공용 HUD 칩·기회 별·도구 버튼 규격을 따른다.

## 한 줄 소개
10×10 바다에 함대 5척을 숨기고 번갈아 포격해 상대 함대를 먼저 모두 격침하는 해전 추리 게임(실시간 1:1 또는 AI, 약 5분, 능력 '추리력').

## 규칙 (플레이어가 보는 것)
- 함선 5척(`FL_SHIPS`): 항공모함 5 · 전함 4 · 순양함 3 · 잠수함 3 · 구축함 2 = 17칸(`FL_TOTAL`). 칸 이름 A1~J10.
- **배치**: 끌어서 이동, 탭하면 회전(안 맞으면 가까운 자리로 밀어 봄), [무작위]. 내 배치는 자유(붙여도 됨). 무작위 배치(`flRandomFleet`)는 배끼리 붙지 않게.
- **포격**: 적 칸을 눌러 조준 → [발사](같은 칸 한 번 더 눌러도 발사). **명중하면 한 번 더**, 빗나가면 상대 차례. 한 척을 다 맞히면 격침.
- 먼저 상대 함대를 모두 격침하면 승리.
- 실시간 대전은 한 차례 **10초**(`FL_TURN_PVP`, 느긋하게 30초 `FL_TURN_SLOW`): 조준해 둔 칸이 있으면 그 칸에 자동 발사, 없으면 차례가 넘어감.

## 모드별 동작
| 난이도(`FL_LV`, `levelCfg`) | 이름 | 배율 | AI |
|---|---|---|---|
| pvp | 실시간 대전 | 1.6 | (상대 없으면 AI 보통으로 전환) |
| easy | AI 쉬움 | 0.6 | 아무 데나(명중 있으면 50%로 이웃) |
| normal | AI 보통 | 1.0 | 명중 주변·줄 잇기, 사냥은 체크무늬 |
| hard | AI 어려움 | 1.4 | 남은 배 자리 확률 지도(`flDensity`) |

- **오늘의 문제**: 요일 난이도 키(월·화 easy · 수·목·금 normal · 토·일 hard)로 AI 세기를 정함. **AI 함대 배치**는 날짜 씨앗(`exam:<날짜>:fleet`)이라 모두 같음, 내 함대 초기 배치는 `Math.random`. 배율 없음(HOST.flatMult).
- **연습**: `levelSheet` → `openFleetSheet()`에서 실시간/AI 쉬움·보통·어려움 선택(`hp:lv:fleet`에 기억, `pickLv`가 연결 없으면 pvp→normal). 씨앗을 따로 안 넘겨서 AI 함대는 오늘 날짜 배치와 같음.
- AI 대전(오늘의 문제·연습)은 차례 시계가 돌지 않음(`FL_TURN = 25`는 정의만 있고 tick이 없음). 시계는 실시간(5초)과 솔로 '번개' 변주(12초, 연발 18초)뿐.
- **솔로**: 개념 사이클 `CONCEPTS.fleet`(core/engine.js `cyclePlan`). 솔로(`G.adv`)에서만 켜지고 오늘의 문제·연습·대전에는 없음. 씨앗 `adv:fleet:<n>`, 섬 위치는 `flrock:<n>`. 챕터: 잔잔한 만 · 안개 해협 · 폭풍 바다 · 빙하 항로 · 해적 섬.

  | 스테이지 | 종류 | key · 이름 | 내용 |
  |---|---|---|---|
  | 6 | 변주 | flash · 번개 | 차례 12초(연발 18초), 별 기준 발수 ×0.85 |
  | 11 | 새 규칙 | island · 섬 | 두 바다에 같은 섬 칸(소개 4 · 보스 6 · 그 밖 5칸), 배·포격 불가 |
  | 16 | 변주 | bare · 맨손 | 레이더·격침 둘레 자동 '배 없음' 표시 없음 |
  | 21 | 새 규칙 | radar · 레이더 | 2번, 3×3에 배 있나 알려 줌(차례 안 씀). c>3 또는 k≥4면 AI도 1번(명중 없을 때 60%) |
  | 26 | 변주 | first · 선공 AI | AI가 먼저 쏨 |
  | 31 | 새 규칙 | salvo · 연발 포격 | 한 차례 3발, 결과 한꺼번에, 명중해도 추가 차례 없음(AI도 3발) |
  | 36 | 변주 | fog · 안개 | 빗나감 표시가 내 차례 3번 뒤 사라짐 → 다시 쏘면 한 발 손해 |
  | 41 | 새 규칙 | silent · 침묵 함대 | 격침 비공개, 17칸 다 맞히면 승리(AI·봇은 `flSilentResolve`로 추리) |
  | 46 | 변주 | tight · 외줄 타기 | 포탄 = ★★ 기준+4발, 다 쓰면 패배 |
  | 51~ | 리믹스 | — | 챕터마다 배운 규칙 2개를 섞음, 변주는 k6·7·10 |
  - 챕터 자리 k: 1 소개(쉬움) · 4·10은 이전 규칙도 함께(챕터 3부터) · 5 어려움 · 6 변주 소개(규칙 없이) · 6~8·10 변주 켜짐 · 9 쉬어가기 · 10 보스.
  - AI 세기 `aiQ`(0~2, 한 발마다 `flAiLvl`로 두 단계 섞음): 스테이지 1~70은 `FL_Q` 표(fleet-sim tune 결과), 71부터는 `flTarget`(목표 첫 도전 승률) 곡선 + `FL_QOFF` 개념 보정. `stageLevel`은 q<.67 easy · <1.34 normal · 그 이상 hard.
  - 기본으로 격침한 적 배 둘레를 자동 '배 없음' 표시(`fx.mark`, 맨손·침묵 제외).
- **별**(`stars()`, 발수 = `-1` 넘김 제외): ★ 승리 · ★★ `th[0]`발 이하 · ★★★ `th[1]`발 이하. 솔로 `th` = 기본 [55, 43] + 보정 `FL_TH_ADD`(island −3/−2 · radar −4/−3 · salvo +9/+9 · silent +6/+7 · fog +2/+1 · bare +2/+2), 번개면 ×0.85. 솔로 밖은 [60, 45].
- **대전**: 공용 '같은 문제 동시 풀기'가 아니라 `NG.fleet.duelLaunch()` → 연결되면 `startGame('fleet','pvp',{duel:{fleet:true,…}})`, 아니면 AI 보통. 결과는 `duelFinish`에서 승/패만(`duelResult('w'|'l')`).

### 실시간 프로토콜(presence만으로 진행, server/index.ts는 중계만)
- **상대 찾기(로비 ROOM)**: 내 presence `{fl:'wait', ft:시작시각, nk:닉네임, pr:null}`. 대기자를 `ft`·peer 순으로 정렬해 짝(0↔1, 2↔3…). 짝을 고르면 `{fl:'play', pr:상대peer}`, 나를 지목한 `play`가 보이면 바로 매칭. 20초 지나면 'nobody'(계속 대기 또는 AI 보통).
- **방**: `fl-<작은id>-<큰id>`(소문자 영숫자 20자씩, 48자 제한). 입장 후 `{v:1, nk, sh:[], an:[]}`. 상대 `v===1`을 보면 전투 시작, 12초 안에 안 오면 다시 찾기. 선공 = peer id가 작은 쪽(`G.first`).
- **진행**: `sh` = 내가 쏜 칸 목록(시간 초과 넘김은 `-1`), `an` = 상대 포격에 대한 내 답 목록(0 빗나감 · 1 명중 · [칸들] 격침, `-1`에는 0). 차례는 `flTurn()`이 두 목록만으로 다시 계산. `td`/`tk` = 내 차례 마감 서버 시각(`flNow()` = Date.now()+ROOM.clockOffset). 끝나면 `rv` = 내 함대 `[x,y,v,len]` 공개.
- **끊김**: 상대가 나가면 15초 재접속 대기 후 기권승, 상대 차례 30초 무응답이면 기권승, `rv`를 남기고 나간 경우는 마지막 결과로 판정.

## 점수
`score()` → `calcScore()`가 `(base + time + extra) × G.L.mult`(반올림). n = 쏜 발수(넘김 제외).
- base = 500
- time = round(350 × clamp((100 − n) / 83, 0, 1)) — 17발 만에 이기면 350
- extra = round(150 × 남은 내 함선 칸 / 17)
- mult: pvp 1.6 · easy .6 · normal 1 · hard 1.4 · 오늘의 문제 1 · 솔로 1

## 파일 지도
| 파일 | 하는 일 | 주요 함수 |
|---|---|---|
| fleet.js 배치·그림 | 함선 SVG, 배치 규칙, 무작위 함대 | `flShipBody` `flShipSvg` `flCells` `flFits` `flRandomFleet` `flMapOf` |
| fleet.js 솔로·AI | 개념 표, 섬, 확률 지도, AI 고르기, 스테이지 설정·튜닝 | `CONCEPTS.fleet` `flRocks` `flDensity` `flAiPickK` `flAiLvl` `flRadarPick` `flSilentResolve` `flStageFx` `flTarget` `FL_Q` `FL_QOFF` `flTune` |
| fleet.js 화면·진행 | 모드 시트, 시작, 배치/찾기/전투 화면, 차례·시계, 발사, 결과 적용 | `openFleetSheet` `flInit` `flStage` `flRender*` `flTurn` `flTurnUI` `flTimerTick` `flPass` `flAim` `flFire` `flMyResult` `flMyApply` `flReceive` `flIncoming` |
| fleet.js 솔로 규칙 | 레이더·연발·안개·포탄 | `flRadarUse` `flAiRadarMaybe` `flSalvoFire` `flAiSalvo` `flMyTurnStart` `flOutOfAmmo` |
| fleet.js 실시간 | 매칭·방·동기화·끝 | `flSearch` `flMatch` `flSync` `flOppLeft` `flSwitchAI` `flCleanup` `flEnd` |
| fleet.js 끝 | 게임 정의 | `NG.fleet`(levelCfg·pickLv·levelSheet·stageLevel·duelLaunch·bodyClass `flmode`) |
| fleet.css | 바다·함선·칸·배너 스타일(`.fl-*`, `body.flmode`) | — |

중요 G 필드: `mode('pvp'|'ai') ai phase('place'|'search'|'nobody'|'joining'|'battle') my en enMap myMap myShot enShot`(칸 상태 0 모름·1 빗나감·2 명중·3 격침·4 섬·5 배 없음) `sh an opp{sh,an} shown pending hitsN myLeft enSunk turn first nr oppPeer oppRv forfeit ending aiKnow aiSunk fx`(솔로 설정) `radarN salvoSel fogged missAt`.

## 고칠 때 지킬 것
- **AI 함대·섬 위치는 씨앗 rng로만**(오늘의 문제는 날짜 씨앗 → 모두 같은 적 함대). 판 내용 쪽 rng 호출 순서를 바꾸면 그날 문제가 달라진다. AI의 한 발 선택·내 배치는 `Math.random`(의도).
- **실시간 프로토콜 하위 호환**: 두 사람이 **서로 다른 버전의 페이지**로 붙을 수 있다. presence 키(`fl ft nk pr v sh an td tk rv`), 방 이름 규칙, `an` 값 형식, `-1` 넘김, 선공 규칙을 바꾸거나 지우지 말 것. 새 기능은 새 키를 더하고, 없으면 예전처럼 동작하게. `v`를 올리면 옛 버전과 매칭이 끊긴다.
- **server/index.ts**(Bun 중계, presence 최대 8KB)와 core/net.js는 함께 바꿔야 한다. 서버 메시지 형식(`join/leave/p/ping` ↔ `hello/peers/pong`)을 바꾸면 배포된 모든 페이지가 영향.
- 솔로 규칙(`G.fx`)은 솔로에서만 — 오늘의 문제·연습·대전 동작을 바꾸지 말 것.
- `FL_Q`·`FL_TH_*`를 바꾸면 tools/fleet-sim.js로 다시 재고, 표와 결과를 바뀐 기록에 남길 것. fleet-sim.js는 이 파일의 함수·상수를 이름(`^function name(`, `^const FL_Q = […];` 등)으로 잘라 쓰므로 이름·한 줄 형식을 바꾸면 도구도 고칠 것.
- **`NG.fleet` 계약** 유지(games/CLAUDE.md). `flNow`는 core/duel.js도 부른다.
- 그림·소리는 **직접 만든 오리지널만**. 상용 게임 이름·에셋을 쓰지 않는다(일반 장르 변형만, docs/15).
- `core/`를 고치면 **모든 게임과 모든 embed 모듈**이 바뀐다.

## 확인 방법
- `node tools/build.js` → index.html 목록과 `embed/fleet.html` 다시 만들기.
- `index.html`과 `embed/fleet.html?mode=daily` · `?mode=practice` · `?mode=solo` · `?mode=duel` 열기. 실시간은 브라우저 창 두 개로 서로 매칭(가능하면 한쪽은 이전 버전 페이지로).
- `npm test -- fleet` (사이트·모듈에서 모든 모드를 한 판씩 자동 점검, `tools/test.mjs`).
- 솔로 난이도 시뮬레이션(사람 흉내 봇 vs 스테이지 AI):
  - `node tools/fleet-sim.js rate [from] [to] [판수]` — 스테이지별 첫 도전 승률·발수 분포·별 기준(기본 1~70, 300판)
  - `node tools/fleet-sim.js tune [from] [to] [판수]` — 목표 승률에 맞는 q를 찾아 `FL_Q` 표 출력(기본 400판)
  - `node tools/fleet-sim.js q [q] [판수] [규칙…]` — q 고정 한 설정(규칙: island radar salvo silent flash bare first fog tight=N airadar=N)
  - 다른 html을 읽으려면 `HTML=<경로>` 환경 변수(기본 index.html).

## 바뀐 기록
- 2026-10-06 v1.1.0 세대별 테스트 1단계(WP12): `FL_TURN_PVP` 5→10초, 느긋하게 `FL_TURN_SLOW` 30초(배치 화면 속도 단추·`hp:fleet:slow`, `duelLaunch(o)`의 `o.pace`, 대기실 presence에 `dk` 더함 — 없으면 보통으로 봄, 무응답 기권은 max(30초, 차례+20초)), 배치 화면 [자동으로 놓고 출격](주 핑크) + [무작위]·[이대로 출격](보조) + 방향 버튼 5개(고른 배 노란 빛, 막히면 다음 빈자리까지), 좌표 글자 13px(작은 판 '10' 넘침 고침), 폭발 크게(×1.3), 제목 '오늘의 바다'·도움말 3줄(`howto`, 레이더·연발·침묵은 더 알아보기·개념 카드), 쉬운 말(컴퓨터·빠른 판). 실시간 프로토콜 키·방 이름·`v` 그대로.
- 2026-10-04 UI 검수 반영: 맨 위 막대를 공용 제목 막대(.pbar·.iconbtn) 모양으로, '출격!'·'AI와 바로 대전'·'발사'는 공용 핑크, '무작위'·'배치로 돌아가기'는 공용 보조 버튼. 칸 번호 '10' 잘림 고침(번호 칸 20px, 12px Jua), 전투 수치는 공용 칩, 레이더는 .tool.toggle. 12px 미만 글자 정리(화면·CSS·마크업만, 규칙·점수·실시간 프로토콜 그대로)
- 2026-10-03 폭발에 피어오르는 연기·불빛, 격침 때 화면 번쩍 추가. 움직이는 배경(바닷속 빛줄기·물방울)(보이기만 함 — 규칙·점수·대전 그대로)
- 2026-10-03 게임별 폴더·게임 정의(NG.<id>)·붙여 쓰는 모듈(embed/<id>.html) 구조로 정리
