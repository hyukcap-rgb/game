# 효과음 만들기·바꾸기

게임 소리 파일은 `public/snd/*.mp3`에 있어요. 브라우저에서 `/sounds.html`을 열면 전부 들어 볼 수 있어요.
**같은 이름으로 파일만 바꾸면** 코드 수정 없이 소리가 바뀌어요. 파일이 없으면 예전 합성음이 대신 나와요.

## 지금 들어 있는 소리
| 파일 | 무엇 | 출처 |
|---|---|---|
| `chip1~3` 칩 걸기, `stack1~6` 칩 쌓기·팟 받기, `collide1~4` 칩 부딪힘 | 실제 녹음 | Kenney "Casino Audio" (CC0, 상업 사용 가능, 출처 표시 필요 없음) |
| `deal1~8` 카드 돌리기, `flip1~4` 뒤집기, `fold1~4` 폴드 | 실제 녹음 | Kenney "Casino Audio" (CC0) |
| `check_0~2` 똑똑, `turn` 내 차례, `tick`·`tick_last` 남은 5초, `win`·`epic`·`lose`, `allin`, `pop` | 직접 만든 합성음 | `tools/sounds/synth.py` |
| `v_call` `v_check` `v_bet` `v_raise` `v_allin` `v_fold` (+ `_2`) | 여자 AI 성우 2가지 말투 | ElevenLabs v4 "Anna Kim"(Creative Claw로 생성) |
| `v_m_call` … `v_m_fold` (+ `_2`) | 남자 AI 성우 2가지 말투 | ElevenLabs v4 "Chris"(Creative Claw로 생성) |
| `ai_chip` `ai_stack` `ai_deal` `ai_turn` `ai_win` | AI 효과음 **후보**(게임에선 안 씀) | ElevenLabs Sound Effects(Creative Claw). 마음에 들면 `chip4.mp3`처럼 이름을 바꿔 넣고 `app.js`의 `SND` 목록에 추가 |

- 음성은 음성 인식(Whisper)으로 6단어 중 맞는 단어로 알아듣는지 24개 모두 확인했어요(예전 MeloTTS '폴드'는 '콜'로 잘못 알아들었음).
- ElevenLabs로 만든 소리를 상업적으로 쓰려면 Creative Claw/ElevenLabs의 상업 이용 조건(유료 요금제 여부)을 확인하세요.
- 게임 소리 버튼: 🔊여(효과음+여자 음성) → 🔊남(효과음+남자 음성) → 🔉(효과음만) → 🔇(끔).

## 혼자 바꾸는 방법
### 1. 행동 음성을 더 좋게 (AI)
- Claude에게 "Creative Claw로 ○○ 목소리 다시 만들어 줘"라고 하면 바로 만들어 넣을 수 있어요(한 번에 6단어를 쉼표로 이어 만든 뒤 자동으로 잘라요, 1번 약 2~3크레딧).
- 또는 ElevenLabs·타입캐스트·클로바더빙 같은 AI 성우에 "콜!", "체크.", "베팅!", "레이즈!", "올인!", "폴드." 를 한 줄씩 입력 → mp3로 내려받기.
- 상업 사용이 되는 요금제인지 꼭 확인하세요(무료 요금제는 안 되는 곳이 많아요).
- 내 목소리로 직접 녹음해도 돼요(아래 3번 방법).
- 파일 이름을 `v_call.mp3`처럼 바꿔 `public/snd/`에 넣기.

### 2. 효과음을 AI로
- ElevenLabs Sound Effects 등에 영어로 설명하면 잘 나와요. 예:
  - 칩 걸기: `two clay poker chips dropped onto a felt table, close, dry, short`
  - 팟 받기: `a stack of clay poker chips being pushed and stacked, satisfying clinks, short`
  - 카드 돌리기: `single playing card dealt and sliding on felt, quick swish`
  - 내 차례: `soft clean notification chime, two notes, bright, short, mobile game`
  - 승리: `short winning jingle with chips cascading, casino, joyful, 1 second`
- 0.2~1초 정도로 짧게, 앞뒤 빈 소리는 잘라 주세요.

### 3. 직접 녹음
- 진짜 칩·카드를 조용한 방, 천(펠트·담요) 위에서 휴대폰 녹음 앱으로 30cm 거리에서 녹음.
- 같은 소리를 4~5번씩 → 번호를 붙여 `chip1.mp3`, `chip2.mp3`…로 저장(게임에서 번갈아 나와 덜 반복적이에요).
- 무료 프로그램 Audacity로: 앞뒤 자르기 → 잡음 제거 → 정규화(-1dB) → 내보내기(MP3, 모노).

## 다시 만들기(개발용)
```
# 합성음
python3 tools/sounds/synth.py            # tools/sounds/out/*.wav
# AI 음성: MeloTTS(Python 3.10) 설치 후
python tools/sounds/voice.py             # tools/sounds/out/*.wav
# mp3 변환(앞뒤 무음 자르기, 모노 44.1kHz 96kbps)
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,alimiter=limit=0.9" -ac 1 -ar 44100 -b:a 96k out.mp3
```
