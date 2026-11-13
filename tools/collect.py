import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1400,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/mechde/index.html#home'); await pg.wait_for_timeout(800)
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(800)
        ids=await pg.evaluate("Object.keys(MD.pages)")
        out={}
        for i in ids:
            await pg.goto('file:///home/claude/mechde/index.html#'+i); await pg.wait_for_timeout(700)
            for t in await pg.evaluate("Presenter._items()"):
                out[await pg.evaluate("t=>Presenter._hash(t)",t)]=t
        json.dump(out,open('/home/claude/tts/items.json','w'),indent=0)
        print(len(ids),'pages',len(out),'clips',sum(len(t) for t in out.values()),'chars',errs[:3])
        await b.close()
asyncio.run(main())
