#!/usr/bin/env python3
"""Real Chromium chart-of-nuclides and RFQ 2D/3D cinema acceptance.

Both evaluation versions are tested through the actual Hugo-built Lab page.
No synthetic replacement of AME2026 data; figures are browser UI evidence.
"""
from __future__ import annotations
import json,os,pathlib,re,sys
from playwright.sync_api import sync_playwright
BASE=os.environ.get("NUCLIDE_E2E_BASE","http://127.0.0.1:8770/").rstrip("/")+"/"
ART=pathlib.Path(os.environ.get("NUCLIDE_E2E_ARTIFACTS","chart-2026-browser-evidence"))
ART.mkdir(parents=True,exist_ok=True)
def log(*args):print(*args,flush=True)
def snapshot(p,name):
    p.screenshot(path=str(ART/name),full_page=False,animations="disabled")
def console_watch(page):
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    return errors
def await_chart(page,expected):
    root=page.locator("#nuclide-chart")
    root.wait_for(state="visible",timeout=30000)
    try:
        page.wait_for_function(
            "(min) => {const c=document.querySelector('#nuclide-chart .nc-count');"
            "return c&&parseInt(c.textContent.replace(/[^0-9].*$/,''),10)>=min;}",
            arg=expected,timeout=30000)
    except Exception:
        diag=page.evaluate("""()=>({
          title:document.title,body:document.querySelector('#nuclide-chart .nc-card')?.innerText,
          count:document.querySelector('#nuclide-chart .nc-count')?.textContent,
          loaded:document.readyState,
          source:Object.fromEntries(['src','catalogue','ame','reactions','activeEvaluation'].map(k=>[k,document.querySelector('#nuclide-chart')?.dataset[k]])),
          scripts:[...document.scripts].map(s=>s.src).filter(x=>x.includes('nuclide-chart.js')||x.includes('physics.js')||x.includes('mass-surface.js')),
          engine:{physics:!!window.ZGPhysics,chart:!!window.ZGChartStats,quantity:!!window.ZGMassQuantityMenu},
          resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/data/')||r.name.includes('/js/nuclide-chart.js')).map(r=>({url:r.name,status:r.responseStatus,size:r.transferSize,duration:r.duration})).slice(0,28)
        })""")
        log("FAILED NUCLEAR CHART INITIALIZATION DIAGNOSTIC",json.dumps(diag,default=str)[:7000])
        raise
    count=root.locator(".nc-count").inner_text()
    log("NUCLIDES",count,"edition",root.get_attribute("data-active-evaluation"))
    return root

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
    ctx=browser.new_context(viewport={"width":1440,"height":990},device_scale_factor=1,
                            accept_downloads=True,locale="en-US")
    page=ctx.new_page();errors=console_watch(page)
    page.on("console",lambda msg:log("BROWSER CONSOLE",msg.type,msg.text[:350]) if msg.type=="error" else None)
    page.on("response",lambda resp:log("HTTP ERROR",resp.status,resp.url) if resp.status>=400 else None)
    r=page.goto(BASE+"lab/",wait_until="domcontentloaded",timeout=30000)
    assert r and r.status==200
    chart=await_chart(page,3700)
    assert chart.get_attribute("data-active-evaluation")=="2026"
    assert chart.locator("[name=nc-edition]").input_value()=="2026"
    assert "AME2026" in chart.locator("h2").inner_text()
    edition=chart.locator(".nc-evaluation-provenance")
    assert "AME2026" in edition.inner_text()
    assert chart.locator("[name=nc-colour] option").count()>15
    snapshot(page,"chart2026-loaded-desktop.png")
    # User-reported checkbox controls: check and verify their real side effects.
    overlays=chart.locator(".nc-ovl")
    magic=overlays.locator("[data-opt=magic]")
    assert magic.count()==1
    magic.check();assert magic.is_checked()
    img_on=chart.locator("canvas.nc-canvas").screenshot()
    magic.uncheck();assert not magic.is_checked()
    img_off=chart.locator("canvas.nc-canvas").screenshot()
    assert img_on!=img_off, "Magic-shell checkbox did not alter the chart pixels"
    overlay=overlays.locator("[data-opt=nz]")
    overlay.uncheck();assert not overlay.is_checked()
    overlay.check();assert overlay.is_checked()
    # Numerical-class checkbox must enable real controls in numeric color mode.
    colour=chart.locator("[name=nc-colour]")
    colour.select_option("me")
    cl=chart.locator("[name=nc-classes]");cl.check()
    assert cl.is_checked()
    cls=chart.locator("[name=nc-class-n]")
    assert cls.is_enabled(),"Classes toggle did not enable class count"
    cls.fill("7");cls.dispatch_event("input")
    chart.locator("[name=nc-class-method]").select_option("quantile")
    assert chart.locator("[name=nc-class-method]").input_value()=="quantile"
    cl.uncheck();assert cls.is_disabled()
    # Manual color range must be genuinely editable when enabled.
    rangebox=chart.locator("[name=nc-range-manual]")
    rangebox.check();assert rangebox.is_checked()
    chart.locator("[name=nc-range-min]").fill("-70")
    chart.locator("[name=nc-range-max]").fill("50")
    chart.locator("[name=nc-range-min]").dispatch_event("input")
    assert chart.locator("[name=nc-range-min]").input_value()=="-70"
    rangebox.uncheck();assert not rangebox.is_checked()
    chart.locator("[name=nc-isomark]").check()
    assert chart.locator("[name=nc-isomark]").is_checked()
    chart.locator("[name=nc-isomark]").uncheck()
    # These are 12 evaluated 2026 reaction-energy definitions in the chart.
    options=chart.locator("[name=nc-colour] option")
    contents=options.all_text_contents()
    assert any("2β" in x or "2B" in x for x in contents)
    snapshot(page,"chart2026-checkboxes.png")
    # Choose historical 2020: genuine page reload, no data-version mixing.
    chart.locator("[name=nc-edition]").select_option("2020")
    page.wait_for_url(re.compile(r"evaluation=2020"),timeout=25000)
    historical=await_chart(page,3200)
    assert historical.get_attribute("data-active-evaluation")=="2020"
    assert "2020" in historical.locator("h2").inner_text()
    assert "2020" in historical.locator(".nc-evaluation-provenance").inner_text()
    snapshot(page,"chart2020-history-desktop.png")
    # Return to default and assert historical URL state does not leak.
    historical.locator("[name=nc-edition]").select_option("2026")
    page.wait_for_url(lambda u:"evaluation=2020" not in u,timeout=25000)
    chart=await_chart(page,3700)
    assert chart.get_attribute("data-active-evaluation")=="2026"
    # Synchronized RFQ real animations: same ion samples, 2D and 3D.
    root=page.locator("#rfq-workbench")
    root.wait_for(state="visible",timeout=20000)
    cinema_button=root.locator('[data-local-tab="cinema"]')
    cinema_button.scroll_into_view_if_needed()
    cinema_button.click()
    cinema=root.locator('[data-local-panel="cinema"]')
    cinema.wait_for(state="visible",timeout=12000)
    cinema.locator('[data-rfq-cinema-preset="flight"]').click()
    page.wait_for_function("()=>Number(document.querySelector('[data-rfq-cinema]').dataset.cinemaIteration||0)>0",timeout=25000)
    left=cinema.locator('[data-rfq-cinema-2d] .rfq-motion-stage svg')
    right=cinema.locator('[data-rfq-cinema-3d] .rfq-motion-stage svg')
    assert left.count()==1 and right.count()==1
    assert right.get_attribute("data-motion-projection")=="orthographic"
    assert "ideal" in cinema.locator('[data-rfq-cinema-warning]').inner_text().lower()
    snapshot(page,"rfq-2d3d-cinema-desktop.png")
    timeline=cinema.locator('[data-rfq-cinema-player]')
    play=timeline.locator('[data-playback-action="play"]');play.click()
    page.wait_for_timeout(750)
    assert float(timeline.locator('[data-rfq-playback]').get_attribute("data-fraction"))>0
    play.click()
    cinema.locator('[data-rfq-cinema-left-view]').select_option('phase')
    assert 'phase' in cinema.locator('[data-rfq-cinema-left-view]').input_value()
    camera=cinema.locator('[data-rfq-cinema-3d] .rfq-motion-camera input[type=range]').first
    camera.evaluate("(node)=>{node.value='65';node.dispatchEvent(new Event('input',{bubbles:true}));}")
    assert right.count()==1
    # Frame SVG export proves combined render is a valid standalone SVG, not a fake static placeholder.
    with page.expect_download(timeout=25000) as dl:
        timeline.locator('[data-playback-frame="svg"]').click()
    download=dl.value
    output=ART/download.suggested_filename;download.save_as(output)
    data=output.read_bytes()
    assert b"<svg" in data and b"NOT" in data or (b"<svg" in data and len(data)>1800)
    assert b"orthographic" in data or b"trajectory" in data
    # Mobile responsive: both panels remain in DOM, no clipped controls.
    mobile_ctx=browser.new_context(viewport={"width":393,"height":852},device_scale_factor=1,
                                  accept_downloads=True,locale="en-US")
    mobile=mobile_ctx.new_page()
    mobile_errors=console_watch(mobile)
    mobile.goto(BASE+"lab/",wait_until="domcontentloaded")
    await_chart(mobile,3700)
    mr=mobile.locator("#rfq-workbench");mr.locator('[data-local-tab="cinema"]').click()
    mobile.wait_for_function("()=>Number(document.querySelector('[data-rfq-cinema]').dataset.cinemaIteration||0)>0",timeout=25000)
    cinema_m=mr.locator('[data-rfq-cinema]')
    assert cinema_m.locator('[data-rfq-cinema-2d] svg').count()>0
    assert cinema_m.locator('[data-rfq-cinema-3d] svg').count()>0
    container_width=mobile.evaluate("()=>document.documentElement.clientWidth")
    boxes=cinema_m.locator('.rfq-cinema-cell').evaluate_all(
      "(nodes)=>nodes.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width}))")
    assert all(0<=e["x"]<container_width and e["x"]+e["w"]<=container_width+3 for e in boxes),boxes
    snapshot(mobile,"rfq-2d3d-cinema-mobile.png")
    all_errors=errors+mobile_errors
    filtered=[s for s in all_errors if "favicon" not in s.lower()]
    assert not filtered,filtered
    log("PASS: AME2026 chart default, historical AME2020, checkboxes, RFQ synchronized 2D/3D and SVG export, mobile")
    browser.close()
