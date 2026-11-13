import json, os, sys, time, subprocess, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k=Kokoro('kokoro.onnx','voices.bin')
items=json.load(open('items.json'))
V={'michael':('am_michael','en-us'),'lewis':('bm_lewis','en-gb')}
SAMPLE="Hello, I am Doctor Vignesh. Every machine begins with a question: what must it do, and how might it fail?"
t0=time.time(); limit=float(sys.argv[1]) if len(sys.argv)>1 else 540
for name,(vid,lang) in V.items():
    d=f'/home/claude/mechde/audio/{name}'; os.makedirs(d,exist_ok=True)
    jobs=[('sample',SAMPLE)]+list(items.items())
    for h,t in jobs:
        f=f'{d}/{h}.mp3'
        if os.path.exists(f): continue
        if time.time()-t0>limit: print('PAUSE'); sys.exit(0)
        a,sr=k.create(t,voice=vid,speed=0.95,lang=lang)
        a=np.concatenate([np.zeros(int(sr*0.05),'float32'),a,np.zeros(int(sr*0.15),'float32')])
        sf.write('/tmp/r.wav',a,sr)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i','/tmp/r.wav','-ac','1','-b:a','40k',f+'.tmp.mp3'],check=True); os.rename(f+'.tmp.mp3',f)
    json.dump(sorted(items.keys()),open(f'{d}/index.json','w'))
print('DONE')
