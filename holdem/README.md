# 로열 홀덤

텍사스 홀덤 노리밋 웹게임 — AI 대결 · 친구 대전 · 오늘의 토너먼트, 회원·칩·관리자·분양(사업장)·수수료.
Node 18+ / Express + ws. 자세한 구조와 규칙은 `CLAUDE.md`.

## 로컬 실행
```
npm install
ADMIN_PASSWORD=비밀번호 npm start      # http://localhost:3000  (관리자 /admin, 슈퍼 관리자 /super)
npm test
# 화면 겹침 점검(선택): npm i --no-save playwright 후 node test/ui-layout.mjs
```

## Railway 배포
| 항목 | 값 |
|---|---|
| 소스 | 이 GitHub 저장소, 브랜치 `main`, 루트 폴더 비움(저장소 루트) |
| 시작 명령 | `npm start` |
| 헬스체크 | `/healthz` |
| 볼륨 | `/data` 에 연결 |
| 변수 | `DATA_DIR=/data`, `ADMIN_PASSWORD=<슈퍼 관리자 비밀번호>` |
| 도메인 | Railway 도메인 만들기(또는 직접 도메인 연결) |

볼륨은 한 지역에서만 돌기 때문에 복제(replica)는 1개로 둡니다.

## 다른 서버로 데이터 옮기기
1. **예전 서버** `/super` 로그인 → **⬇ 백업** → `royal-holdem-backup-날짜.json` 내려받기
2. **새 서버** 배포가 끝나면 `/super` 로그인(새 `ADMIN_PASSWORD`) → **⬆ 되살리기** → 백업 파일 선택
3. 서버가 다시 켜지면 회원·보유 칩·칩 로그·사업장·설정이 그대로 넘어와 있어요
   (새 서버에 있던 데이터는 `/data/db.json.before-restore`로 보관)
4. 사업장에 직접 도메인을 붙였다면 DNS를 새 Railway 주소로 바꾸고, 하루퍼즐의 홀덤 주소도 새 주소로 바꿔요

옮기는 동안에는 예전 서버에서 게임이 계속되지 않게, 백업 직전에 공지하거나 사업장 운영을 잠깐 멈추는 게 안전해요.
