#!/usr/bin/env python3
"""Real Chromium smoke/interaction audit for the site's other public sections.

Read-only audit against freshly rendered Hugo pages. Records mobile overflow
rather than hiding it. The scientific features have separate deep tests.
"""
from __future__ import annotations
import json,os,pathlib
from playwright.sync_api import sync_playwright

BASE=os.environ.get("NUCLIDE_E2E_BASE","http://127.0.0.1:8770/").rstrip("/")+"/"
ART=pathlib.Path(os.environ.get("NUCLIDE_E2E_ARTIFACTS","chart-2026-browser-evidence"))
ART.mkdir(parents=True,exist_ok=True)
SECTIONS=("research","publications","talks","facilities","daily","lab","games",
          "databases","projects","group","posts","cv")
REPORT={"schema":"public-sections-chromium-v1","base":BASE,"sections":[],
        "notes":"Real HTTP/DOM and viewport measurements; not a simulation or scientific validation"}

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,args=["--no-sandbox"])
    desktop=browser.new_page(viewport={"width":1320,"height":940},locale="en-US")
    mobile=browser.new_page(viewport={"width":390,"height":840},device_scale_factor=1)
    for route in SECTIONS:
        rec={"route":route}
        for label,page in (("desktop",desktop),("mobile",mobile)):
            response=page.goto(BASE+route+"/",wait_until="domcontentloaded",timeout=35000)
            assert response and response.status==200,(route,label,response.status if response else None)
            assert page.locator("main").count()>=1,(route,label,"main landmark missing")
            assert page.title().strip(),(route,label,"HTML title missing")
            dims=page.evaluate("""()=>({
                clientWidth:document.documentElement.clientWidth,
                scrollWidth:document.documentElement.scrollWidth,
                innerWidth:innerWidth,
                links:document.querySelectorAll('main a[href]').length
            })""")
            rec[label]={"status":response.status,"title":page.title(),"dimensions":dims,
                        "overflow_px":max(0,dims["scrollWidth"]-dims["clientWidth"])}
        REPORT["sections"].append(rec)
    # Publication filtering must change the rendered result set and reset it.
    desktop.goto(BASE+"publications/",wait_until="domcontentloaded",timeout=35000)
    pub=desktop.locator("[data-pub-search]")
    pub.wait_for(state="visible",timeout=12000)
    desktop.wait_for_function("()=>document.querySelector('[data-pub-count]')?.textContent.includes(' / ')",timeout=12000)
    initial=pub.locator("[data-pub-count]").inner_text()
    assert desktop.locator(".zg-paper").count()>5
    pub.locator("[name=pub-query]").fill("THIS_QUERY_SHOULD_MATCH_NO_PUBLICATION_829172")
    assert pub.locator("[data-pub-empty]").is_visible()
    assert pub.locator("[data-pub-count]").inner_text().startswith("0 /")
    pub.locator("[data-pub-reset]").click()
    assert not pub.locator("[data-pub-empty]").is_visible()
    assert pub.locator("[data-pub-count]").inner_text()==initial
    REPORT["publication_search"]={"initial":initial,"empty_query":True,"reset_restored":True}
    # Explicit Mandarin edition for an important public research section.
    zh=desktop.goto(BASE+"zh/research/",wait_until="domcontentloaded",timeout=35000)
    REPORT["chinese_research"]={"http_status":zh.status if zh else None,
                                "title":desktop.title()}
    assert zh and zh.status==200,"Chinese research page missing"
    (ART/"public-section-viewport-audit.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+"\n")
    mobile_flags=[(r["route"],r["mobile"]["overflow_px"]) for r in REPORT["sections"]
                  if r["mobile"]["overflow_px"]>36]
    print("PASS:",len(SECTIONS),"public tabs rendered on desktop/mobile; publication filters reset; Chinese Research loads.")
    print("Mobile overflow flags (>36 px):",mobile_flags,flush=True)
    browser.close()
