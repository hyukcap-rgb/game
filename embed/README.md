# 하루퍼즐 게임 모듈 — 다른 사이트·앱에 붙이기

게임마다 한 파일짜리 모듈이 있어요. 필요한 게임만 골라 원하는 사이트·앱에 붙이면 돼요.

| 게임 | 모듈 주소 |
|---|---|
| 여우 자리 찾기 | `https://hyukcap-rgb.github.io/game/embed/fox.html` |
| 스도쿠 | `…/embed/sudoku.html` |
| 별빛 구슬 | `…/embed/ball.html` |
| 숲 지킴이 | `…/embed/tower.html` |
| 함대 결전 | `…/embed/fleet.html` |
| 동물 삼총사 | `…/embed/match.html` |
| 네모 그림 | `…/embed/nono.html` |
| 블록 채우기 | `…/embed/block.html` |
| 카드 짝 맞추기 | `…/embed/memory.html` |
| 숫자 합치기 | `…/embed/merge.html` |
| 짝 잇기 | `…/embed/link.html` |
| 고스톱 (19세 이상) | `…/embed/gostop.html` — 솔로·대전만(오늘의 문제·연습 없음) |

- 모듈 하나에는 **그 게임과 공용 엔진만** 들어 있어요(다른 게임 코드 없음). 전송 크기는 게임마다 약 65~80KB예요.
- iframe 안에서 돌아서 붙이는 사이트의 디자인·코드와 섞이지 않아요.
- 미리 보기·붙이는 코드 만들기: `https://hyukcap-rgb.github.io/game/embed/` (이 폴더의 index.html)

## 1. 웹사이트에 붙이기

### 가장 쉬운 방법(코드 두 줄)
```html
<div data-haru-game="ball"></div>
<script src="https://hyukcap-rgb.github.io/game/embed/haru-embed.js" defer></script>
```
A 사이트엔 구슬, D 사이트엔 함대처럼 `data-haru-game`만 바꾸면 돼요. 한 페이지에 여러 개 붙여도 돼요.

| 속성 | 값 | 기본 |
|---|---|---|
| `data-haru-game` | fox sudoku ball tower fleet match nono block memory merge link gostop | (필수) |
| `data-mode` | `menu`(첫 화면) `daily`(오늘의 문제) `solo` `practice`(연습) `duel`(대전) | menu |
| `data-modes` | 첫 화면에 보일 모드, 쉼표로: `daily,solo` | 모두 |
| `data-level` | 연습 난이도 `easy` `normal` `hard` | 고르게 함 |
| `data-stage` | 솔로 시작 스테이지 | 이어서 |
| `data-ns` `data-user` | 기록을 사이트·사용자별로 나누는 이름 | 없음 |
| `data-height` | `720px` `100%` `auto`(내용에 맞춤) | 720px |
| `data-sound` | `0`이면 소리 끄고 시작 | 1 |

### 코드로(점수 받기·조종)
```html
<div id="game"></div>
<script src="https://hyukcap-rgb.github.io/game/embed/haru-embed.js"></script>
<script>
  const g = HaruPuzzle.mount('#game', {
    game: 'fleet', mode: 'menu', modes: ['practice', 'duel'],
    user: '회원번호', height: '720px',
    onFinish(e){ console.log('한 판 끝', e.mode, e.win, e.score, e.stars); },   // 우리 서버에 점수 저장 등
    onEvent(e){ if(e.type === 'progress') saveProgress(e.solo); }              // 솔로 진행 저장
  });
  // g.start('daily')  g.menu()  g.sound(false)  g.state()  g.restore(저장해둔상태)  g.destroy()
</script>
```

### iframe만으로
```html
<iframe src="https://hyukcap-rgb.github.io/game/embed/ball.html?mode=menu&ns=siteA"
        style="width:100%;max-width:480px;height:720px;border:0;border-radius:18px" allow="autoplay; vibrate"></iframe>
```

## 2. 앱에 붙이기(WebView)
모듈 주소를 WebView로 열면 끝이에요. 화면 전체로 쓰려면 `?mode=menu&close=1`(첫 화면에 '나가기' 버튼 → `close` 이벤트).

결과는 아래 이름으로 앱에 전달돼요(메시지는 JSON, 내용은 "4. 이벤트" 참고).

| 앱 | 받는 법 |
|---|---|
| Android(WebView) | `webView.addJavascriptInterface(obj, "HaruPuzzle")` → `@JavascriptInterface fun postMessage(json: String)` |
| iOS(WKWebView) | `userContentController.add(self, name: "haruPuzzle")` → `didReceive message` |
| React Native | `<WebView onMessage={e => JSON.parse(e.nativeEvent.data)} />` |
| Flutter(webview_flutter) | `addJavaScriptChannel('HaruPuzzle', onMessageReceived: (m) => jsonDecode(m.message))` |

앱에서 모듈을 조종할 때: `webView.evaluateJavascript("HaruPuzzleEmbed.start('daily')")` (`start(모드)`, `menu()`, `sound(true|false)`, `state()`, `restore(상태)`).

## 3. 주소 옵션(`embed/<게임>.html?…`)
| 옵션 | 뜻 |
|---|---|
| `mode` | 처음 화면: `menu` `daily` `solo` `practice` `duel` |
| `modes` | 보일 모드만: `daily,solo` |
| `level` | 연습 난이도 |
| `stage` · `unlock=1` | 솔로 시작 스테이지(unlock=1이면 아직 안 연 스테이지도) |
| `ns` · `user` | 기록 나누기(같은 기기에서 사이트·사용자별 따로) |
| `sound=0` | 소리 끄고 시작 |
| `close=1` | 첫 화면에 나가기 버튼 |
| `origin` | 이벤트를 보낼 부모 주소(haru-embed.js가 자동으로 넣음) |

## 4. 이벤트(모듈 → 붙인 곳)
모든 메시지: `{ source:'haru-puzzle', type, game, ver, … }`

| type | 언제 | 내용 |
|---|---|---|
| `ready` | 모듈 준비 | `name`, `modes` |
| `menu` | 첫 화면이 보일 때 | |
| `start` | 한 판 시작 | `mode`, `level`, `stage`, `attempt` |
| `finish` | 한 판 끝 | 오늘의 문제·연습: `win`, `score`, `level`, `attempt`, `official`(오늘 첫 판), `partial`(실패 부분 점수), `time`(초), `date`, `detail` · 솔로: `win`, `stage`, `stars`, `first`, `best`, `time` · 대전: `result`(w/d/l), `win`, `vs`(ai/live), `me`, `opp`, `record` |
| `progress` | 솔로 기록이 바뀜 | `solo:{ max, stars, total }` → 저장해 두었다가 `restore`로 넣을 수 있음 |
| `quit` | 게임 중 그만하기 | `mode` |
| `close` | 첫 화면 '나가기'(`close=1`일 때) | |
| `state` | `state()` 요청에 답 | `state:{ solo, daily, duel }` |
| `resize` | 내용 높이 바뀜 | `height` |

명령(붙인 곳 → 모듈): `iframe.contentWindow.postMessage({ target:'haru-puzzle', cmd:'start', mode:'daily' }, '*')` — `cmd`: `start`·`menu`·`sound`(`on`)·`state`·`restore`(`state`).

## 5. 알아 둘 점
- **오늘의 문제**는 하루퍼즐 리그 사이트와 모든 모듈에서 같은 날 같은 문제예요(요일 난이도: 월·화 쉬움, 수~금 보통, 토·일 어려움). 사이트끼리 점수를 비교할 수 있어요.
- 게임에 없는 모드는 `modes`에 넣어도 빠져요(고스톱은 솔로·대전만). 없는 모드로 `start`하면 첫 번째 모드로 시작해요.
- **대전**은 같은 대전 서버를 써서, 다른 사이트에 붙은 같은 게임끼리도 상대가 될 수 있어요. 상대가 없으면 AI와 겨뤄요. 대전을 빼려면 `modes`에서 `duel`을 빼세요(그러면 서버에 연결하지 않아요).
- 기록은 그 기기의 브라우저에 저장돼요. 회원별로 오래 보관하려면 `progress`/`finish` 이벤트를 받아 붙인 쪽 서버에 저장하고 `restore`로 되돌려 주세요.
- 하트·광고·리그는 모듈에 없어요(붙인 곳이 정해요). 사이트(index.html)에만 있어요.
- 모듈은 게임 파일을 고친 뒤 `node tools/build.js`로 다시 만들어요(저장소에 올리면 GitHub Actions도 확인해요).
