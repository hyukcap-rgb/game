# 폴드(카드 '쓱' 미끄러짐 + 부드러운 바람 소리), 핸드 시작(실제 카드 섞는 소리 + 맑은 2음 '띵'), 입장(AI 차임) 만들기
import numpy as np, subprocess, sys
SR=44100; D=sys.argv[2] if len(sys.argv) > 2 else 'Kenney Casino Audio 폴더'   # 사용: python3 tools/sounds/fold_start.py card-slide-2,card-slide-6,card-slide-3,card-slide-5,card-slide-1 <Kenney 폴더>
def load(f): return np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout,np.float32).copy()
def save(a,name,lufs=-18):
    a=a/ (np.abs(a).max()+1e-9)*0.9
    p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-af',f'silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,loudnorm=I={lufs}:TP=-1.5,alimiter=limit=0.9','-ar',str(SR),'-ac','1','-b:a','96k',name],stdin=subprocess.PIPE); p.communicate(a.astype(np.float32).tobytes())
def lp(a,fc):  # 1차 저역 통과 2번
    k=np.exp(-2*np.pi*fc/SR)
    for _ in range(2):
        y=np.zeros_like(a); s=0
        for i,x in enumerate(a): s=(1-k)*x+k*s; y[i]=s
        a=y
    return a
rng=np.random.default_rng(7)
def whoosh(dur,f0,f1):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    # 띠 통과: 움직이는 중심 주파수(간단한 상태변수 필터)
    fc=np.geomspace(f0,f1,n); y=np.zeros(n); lo=bp=0.0
    for i in range(n):
        f=2*np.sin(np.pi*fc[i]/SR); hi=x[i]-lo-0.9*bp; bp+=f*hi; lo+=f*bp; y[i]=bp
    env=np.sin(np.pi*np.clip(t/dur,0,1))**1.6
    return y*env
def soften(a):  # 첫 순간 '딱' 소리 줄이기
    n=int(0.012*SR); a=a.copy(); a[:n]*=np.linspace(0,1,n); return a
for i,src in enumerate(sys.argv[1].split(','),1):
    c=soften(lp(load(f'{D}/{src}.ogg'),5200))
    w=whoosh(0.32,2600,700); w=w/np.abs(w).max()*np.abs(c).max()*0.55
    out=np.zeros(max(len(c),len(w))+int(0.02*SR)); out[:len(w)]+=w; out[int(0.02*SR):int(0.02*SR)+len(c)]+=c
    save(out,f'fold{i}.mp3',-21)
# 핸드 시작: 실제 섞는 소리 앞부분(리플) + 맑은 2음
sh=load(f'{D}/card-shuffle.ogg')
e=np.abs(sh); st=np.argmax(e>0.02); seg=sh[st:st+int(0.95*SR)].copy(); seg[-int(0.15*SR):]*=np.linspace(1,0,int(0.15*SR))
def bell(f,dur,amp):
    t=np.arange(int(dur*SR))/SR
    return amp*(np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*9)+0.15*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*16))*np.exp(-t*5.5)*np.minimum(1,t/0.003)
ch=np.zeros(int(0.9*SR)); b1=bell(1568,0.8,0.16); b2=bell(2093,0.8,0.18); ch[:len(b1)]+=b1; o=int(0.11*SR); ch[o:o+len(b2)]+=b2[:len(ch)-o]
seg=seg/np.abs(seg).max()*0.8
out=np.zeros(len(seg)+int(0.55*SR)); out[:len(seg)]+=seg; o=len(seg)-int(0.25*SR); out[o:o+len(ch)]+=ch[:len(out)-o]
save(out,'start.mp3',-19)
