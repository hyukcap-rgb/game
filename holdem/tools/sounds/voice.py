from melo.api import TTS
m = TTS(language='KR', device='cpu'); sid = list(m.hps.data.spk2id.values())[0]
c = {'allin': ['올인!', '올 인!', '올인이요!', '올인 갑니다!'], 'bet': ['베팅!', '벳.', '베팅합니다.'], 'call': ['콜!', '콜이요.', '콜.'],
     'raise': ['레이즈!', '레이즈요!'], 'fold': ['폴드.', '폴드요.', '다이.'], 'check': ['체크.', '체크요.']}
for k, ts in c.items():
    for i, t in enumerate(ts):
        m.tts_to_file(t, sid, f'out/{k}_{i}.wav', speed=1.2, quiet=True)
