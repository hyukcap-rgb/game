# AI 성우가 한 번에 읽은 "콜 … 체크 … 베팅 … 레이즈 … 올인 … 폴드" 파일을 무음 기준으로 6개로 잘라 mp3로 저장
# 사용: python3 tools/sounds/split_voice.py 받은파일.mp3:v_ 받은파일2.mp3:v_m_
import subprocess,re,sys
names=['call','check','bet','raise','allin','fold']
EX="highpass=f=110,equalizer=f=3200:t=q:w=1.2:g=3,acompressor=threshold=-18dB:ratio=3:attack=5:release=60,loudnorm=I=-16:TP=-1.5"
def segs(src):
    out=subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af','silencedetect=n=-40dB:d=0.12','-f','null','-'],capture_output=True,text=True).stderr
    dur=float(re.search(r'Duration: 00:00:([\d.]+)',out).group(1))
    ev=[(float(t),k) for k,t in re.findall(r'silence_(start|end): ([\d.]+)',out)]
    s=[];cur=0.0
    for t,k in ev:
        if k=='start':
            if t-cur>0.08: s.append((max(0,cur-0.03),t+0.06))
        else: cur=t
    if dur-cur>0.08 and (not ev or ev[-1][1]=='end'): s.append((cur-0.03,dur))
    return s
for src,pre in [(a,b) for a,b in [x.split(':') for x in sys.argv[1:]]]:
    ss=segs(src); assert len(ss)==6,(src,ss)
    for n,(a,b) in zip(names,ss):
        af=f"atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,{EX},afade=t=out:st={max(0,b-a-0.05):.3f}:d=0.05,alimiter=limit=0.9"
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src,'-af',af,'-ac','1','-ar','44100','-b:a','96k',f'{pre}{n}.mp3'],check=True)
        print(pre+n, round(b-a,2))
