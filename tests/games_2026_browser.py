#!/usr/bin/env python3
"""Real browser test: Games source edition and nuclear ion physics from verified AMDC data."""
import json,os,pathlib,re
from playwright.sync_api import sync_playwright
BASE=os.getenv("GAMES_E2E_BASE","http://127.0.0.1:8771/").rstrip("/")+"/"
ART=pathlib.Path(os.getenv("GAMES_E2E_ARTIFACTS","games2026-browser-evidence"))
ART.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 desktop=browser.new_context(viewport={"width":1360,"height":980},locale="en-US")
 page=desktop.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(BASE+"games/",wait_until="domcontentloaded",timeout=30000)
 games=page.locator("[data-games]");games.wait_for(state="visible")
 assert games.get_attribute("data-src").endswith("/data/nubase2026.json")
 assert games.get_attribute("data-ame").endswith("/data/ame2026.json")
 assert games.get_attribute("data-catalogue").endswith("/data/nuclear-states2026.json")
 assert games.locator("[data-games-edition]").input_value()=="2026"
 assert games.locator("[data-games-source-status]").inner_text().startswith("AME2026 + NUBASE2026")
 page.wait_for_function("()=>document.querySelectorAll('#g-hl .g-nuc').length===2",timeout=30000)
 assert "NUBASE2026" in games.locator("#g-hl > p.zg-muted").inner_text()
 # The three data files must be a single coherent 2026 set.
 source=page.evaluate("""async()=>{
   const r=document.querySelector('[data-games]');
   const files=await Promise.all(['ame','src','catalogue'].map(k=>fetch(r.dataset[k]).then(x=>x.json())));
   return {mass:files[0].metadata.name,state:files[2].source.name,
      masses:files[0].rows.length,nuclides:files[1].rows.length,
      physics:!!window.ZGPhysics};
 }""")
 assert source['mass']=="AME2026",source
 assert source['state']=="NUBASE2026",source
 assert source['masses']==3723 and source['nuclides']==3725,source
 assert source['physics'] is True
 assert games.locator("#g-hl [data-pick]").count()==2
 games.locator("#g-hl [data-pick=a]").click()
 assert "Score" in games.locator("#g-hl .g-msg").inner_text()
 page.screenshot(path=str(ART/"games2026-desktop.png"),animations="disabled")
 # No silent 2026 values with historical 2020 labels: full page reload.
 games.locator("[data-games-edition]").select_option("2020")
 page.wait_for_url(re.compile(r"evaluation=2020"),timeout=25000)
 older=page.locator("[data-games]")
 older.wait_for(state="visible")
 page.wait_for_function("()=>document.querySelectorAll('#g-hl .g-nuc').length===2",timeout=30000)
 assert older.get_attribute("data-active-evaluation")=="2020"
 assert older.get_attribute("data-src").endswith("/data/nubase2020.json")
 assert older.get_attribute("data-ame").endswith("/data/ame2020.json")
 assert "NUBASE2020" in older.locator("#g-hl > p.zg-muted").inner_text()
 assert "AME2020" in older.locator("[data-games-source-status]").inner_text()
 assert "/ame2020/" in older.locator("[data-games-source-link]").get_attribute("href")
 page.screenshot(path=str(ART/"games2020-historical.png"),animations="disabled")
 # Switch back to 2026 without changing the user's other query strings.
 older.locator("[data-games-edition]").select_option("2026")
 page.wait_for_url(lambda u:"evaluation=2020" not in u,timeout=25000)
 now=page.locator("[data-games]")
 page.wait_for_function("()=>document.querySelectorAll('#g-hl .g-nuc').length===2",timeout=30000)
 assert now.get_attribute("data-active-evaluation")=="2026"
 assert now.get_attribute("data-src").endswith("/data/nubase2026.json")
 # Responsive layout stays inside a 390-pixel mobile screen.
 mobile=browser.new_context(viewport={"width":390,"height":850},device_scale_factor=1)
 m=mobile.new_page();mobile_errors=[]
 m.on("pageerror",lambda e:mobile_errors.append(str(e)))
 m.goto(BASE+"games/",wait_until="domcontentloaded",timeout=30000)
 game=m.locator("[data-games]")
 page.wait_for_timeout(350)
 m.wait_for_function("()=>document.querySelectorAll('#g-hl .g-nuc').length===2",timeout=30000)
 assert game.locator("[data-games-edition]").input_value()=="2026"
 assert game.locator("#g-hl").is_visible()
 m.screenshot(path=str(ART/"games2026-mobile.png"),animations="disabled")
 assert not errors,errors
 assert not mobile_errors,mobile_errors
 print("PASS: Games evaluated AME2026/NUBASE2026 with actual mass/state counts, 2020 historical switch, quiz and mobile browser",flush=True)
 browser.close()
