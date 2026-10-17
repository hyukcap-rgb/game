# 직접 만든 효과음(오프라인 합성): 체크 노크, 내 차례 종소리, 째깍, 승리 차임, 올인 울림
import numpy as np, wave, os
SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
def save(name, x):
    x = x / (np.abs(x).max() + 1e-9) * 0.89
    w = wave.open(os.path.join(OUT, name + '.wav'), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
def t(d): return np.arange(int(SR * d)) / SR
def env(d, a=0.002, dec=0.1):
    tt = t(d); e = np.minimum(1, tt / a) * np.exp(-tt / dec); return e
def reverb(x, amt=0.18, length=0.6):
    # 짧은 방 울림: 지수 감쇠 잡음 임펄스로 컨볼루션
    ir = rng.standard_normal(int(SR * length)) * np.exp(-t(length) / (length / 5))
    ir[0] = 0; ir /= np.abs(ir).sum() / 6
    wet = np.convolve(x, ir)[:len(x) + int(SR * length * 0.6)]
    y = np.zeros(len(wet)); y[:len(x)] += x
    return y + amt * wet
def bell(f, d, partials=((1, 1), (2.76, .35), (5.4, .15), (8.93, .06)), dec=0.35):
    tt = t(d); s = np.zeros(len(tt))
    for r, a in partials: s += a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / (dec / r ** 0.5))
    return s * np.minimum(1, tt / 0.002)
def knock(d=0.12):
    # 나무 테이블 두드림: 낮은 공진 여러 개 + 짧은 충격 잡음
    tt = t(d); s = np.zeros(len(tt))
    for f, a, dc in ((190, 1, .035), (410, .55, .02), (980, .25, .01), (1650, .12, .006)):
        s += a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / dc)
    n = rng.standard_normal(len(tt)) * np.exp(-tt / 0.004) * 0.35
    return (s + n) * np.minimum(1, tt / 0.0008)
def pad(x, d): y = np.zeros(int(SR * d)); y[:len(x)] = x[:len(y)]; return y
def mix(parts, d):
    y = np.zeros(int(SR * d))
    for off, x in parts:
        i = int(off * SR); n = min(len(x), len(y) - i)
        if n > 0: y[i:i + n] += x[:n]
    return y
# 체크: '똑똑' (두 번째는 조금 약하고 살짝 높게)
for v in range(3):
    k1 = knock(); k2 = knock() * 0.8
    save(f'check_{v}', reverb(mix([(0, k1), (0.105 + v * 0.01, k2)], 0.3), 0.08, 0.25))
# 내 차례: 맑은 종소리 두 음(높은 라 → 미) — 약 2kHz
turn = mix([(0, bell(1760, 1.0, dec=0.5)), (0.11, bell(2637, 1.0, dec=0.45) * 0.75)], 1.1)
save('turn', reverb(turn, 0.22, 0.8))
# 째깍(남은 5초)
for name, f in (('tick', 1400), ('tick_last', 1900)):
    save(name, pad(bell(f, 0.12, ((1, 1), (2.1, .3)), dec=0.03), 0.15))
# 승리 차임: 밝은 아르페지오
notes = [1046.5, 1318.5, 1568, 2093]
win = mix([(i * 0.075, bell(f, 1.2, dec=0.55) * (0.9 - i * 0.08)) for i, f in enumerate(notes)], 1.5)
save('win', reverb(win, 0.28, 1.0))
# 큰 족보: 더 길고 화려하게(두 옥타브 + 반짝임)
notes2 = [784, 1046.5, 1318.5, 1568, 2093, 2637, 3136]
epic = mix([(i * 0.07, bell(f, 1.6, dec=0.7) * 0.8) for i, f in enumerate(notes2)], 2.2)
sp = rng.standard_normal(int(SR * 1.2)) * np.exp(-t(1.2) / 0.4) * 0.05
sp = np.convolve(sp, np.ones(3) / 3, 'same')
save('epic', reverb(mix([(0, epic), (0.45, sp)], 2.2), 0.3, 1.2))
# 짐: 낮게 내려가는 두 음
lose = mix([(0, bell(659, 0.6, dec=0.3) * .8), (0.16, bell(523, 0.8, dec=0.4) * .8)], 1.0)
save('lose', reverb(lose, 0.2, 0.7))
# 올인: 낮은 울림(쿵) + 바람 소리
tt = t(0.9)
boom = np.sin(2 * np.pi * (70 + 40 * np.exp(-tt / 0.08)) * tt) * np.exp(-tt / 0.25)
wind = rng.standard_normal(len(tt)); wind = np.convolve(wind, np.ones(40) / 40, 'same') * np.exp(-((tt - 0.25) / 0.2) ** 2) * 0.5
save('allin', reverb(boom + wind, 0.15, 0.6))
# 버튼 톡
save('pop', pad(bell(1200, 0.1, ((1, 1), (2, .2)), dec=0.025), 0.12))
print('ok')
