# 트럼프 고스톱 — 스팀(PC) 앱

`embed/tgostop.html`(웹 모듈 빌드 결과물)을 Electron 창으로 감싼 스팀용 앱이에요. **게임 코드는 이 폴더에 없어요** — 게임을 고치면 `games/tgostop`을 고치고 `node tools/build.js` 한 뒤 여기서 다시 빌드하면 돼요.

| 파일 | 하는 일 |
|---|---|
| `main.js` | 창(1600×900, 최소 960×540, F11·Alt+Enter 전체 화면), 바깥 링크는 기본 브라우저로, 스팀 연결(steamworks.js)·업적, 게임 이벤트 받기 |
| `preload.js` | 게임 모듈의 `window.HaruPuzzle.postMessage` → 앱으로 전달(finish·close 이벤트) |
| `prepare.mjs` | `embed/tgostop.html` → `app/index.html` 복사, 구글 글꼴을 앱 안 글꼴(`app/fonts`, @fontsource · OFL)로 바꿈 → 인터넷 없어도 글꼴 같음 |
| `achievements.json` | 업적 목록(id·조건·한국어/영어 이름) — Steamworks에 같은 id로 등록 |
| `steam_appid.txt` | 개발용 앱 번호(지금은 스팀 테스트 앱 480). 앱 번호를 받으면 바꾸기 |
| `upload/*.vdf` | SteamPipe 업로드 설정(앱·디포 번호 자리만 바꾸면 됨) |

## 실행·빌드
```bash
cd steam
npm install                 # 처음 한 번
npm start                   # 창으로 실행(스팀 클라이언트가 켜져 있으면 업적까지)
npm run dist:win            # dist/win-unpacked/ 에 Windows 실행 파일 묶음
npm run dist:mac            # macOS (맥에서)
npm run dist:linux          # Linux
SMOKE=play npm start        # 점검: 솔로 판까지 들어가 smoke.png 저장 후 종료
```
- 저장(포인트·스테이지·설정)은 `localStorage` → Windows `%APPDATA%/TrumpGostop/Local Storage/`, 업적용 기록은 `%APPDATA%/TrumpGostop/steam-stats.json`.
- 실시간 대전은 웹과 같은 Railway 중계 서버(`core/net.js`)를 써요 → 웹 사용자와도 매칭돼요.

## 스팀에 올리기(SteamPipe)
1. Steamworks에서 앱 번호(APP_ID)·Windows 디포 번호(WIN_DEPOT_ID)를 받는다 → `steam_appid.txt`, `package.json`의 `steamAppId`, `upload/*.vdf`의 자리 바꾸기.
2. `npm run dist:win` → `dist/win-unpacked/`.
3. Steamworks SDK의 `steamcmd`로:
   `steamcmd +login <계정> +run_app_build <이 폴더>/upload/app_build.vdf +quit`
4. Steamworks → SteamPipe → 빌드 → 'default' 브랜치에 설정 → 실행 옵션: `Trump Gostop.exe`.
5. 스팀 클라우드(선택): 자동 클라우드 루트 `WinAppDataRoaming`, 하위 경로 `TrumpGostop/Local Storage`, 패턴 `*`.

출시 전체 순서와 스토어 문구는 `docs/30_스팀출시_준비.md`.
