import asyncio, json
from playwright.async_api import async_playwright
idx=set(json.load(open('/home/claude/mechde/audio/michael/index.json')))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        for W in (1400,390):
            pg=await b.new_page(viewport={'width':W,'height':900})
            await pg.goto('http://localhost:8765/index.html#home'); await pg.wait_for_timeout(700)
            ids=await pg.evaluate("Object.keys(MD.pages)"); miss=[]
            for i in ids:
                await pg.goto('http://localhost:8765/index.html#'+i); await pg.wait_for_timeout(500)
                for t in await pg.evaluate("Presenter._items()"):
                    if await pg.evaluate("t=>Presenter._hash(t)",t) not in idx: miss.append((i,t[:60]))
            print(W,'missing',miss)
            await pg.close()
        # playback sequence on bolt: record audio requests
        pg=await b.new_page(); reqs=[]; pg.on('request',lambda r: reqs.append(r.url.split('/audio/')[1]) if '/audio/' in r.url else None)
        await pg.goto('http://localhost:8765/index.html#bolt'); await pg.wait_for_timeout(800)
        await pg.evaluate("window.__tts=0; speechSynthesis.speak=(u)=>{window.__tts++; window.__t=(u.text||'').slice(0,80)+' | '+new Error().stack.split(String.fromCharCode(10)).slice(1,4).join(' ')}; 0")
        await pg.click('.p-ctrl button[title="Explain this page"]'); await pg.wait_for_timeout(45000)
        print(reqs, 'phone-voice calls:', await pg.evaluate('window.__tts'), await pg.evaluate('window.__t'))
        await b.close()
asyncio.run(main())
