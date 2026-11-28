#!/usr/bin/env python3
"""Real Chromium chart-of-nuclides and RFQ 2D/3D cinema acceptance.

Both evaluation versions are tested through the actual Hugo-built Lab page.
No synthetic replacement of AME2026 data; figures are browser UI evidence.
"""
from __future__ import annotations
import json,os,pathlib,re,sys,subprocess
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
    # Nuclear detail cards must never carry historical 2020 source labels while
    # the active evaluation is the authoritative AME/NUBASE 2026 edition.
    chart.locator('[name=nc-search]').fill('100Sn')
    chart.locator('[name=nc-search]').press('Enter')
    page.wait_for_function("()=>!document.querySelector('#nuclide-chart .nc-card').hidden",timeout=15000)
    card_text=chart.locator('.nc-card').inner_text()
    assert "AME2026" in card_text and "NUBASE2026" in card_text,card_text[:900]
    assert "Published AME2020 masses and reactions" not in card_text,card_text[:900]
    snapshot(page,"chart2026-card-edition-verified.png")
    # Previously these checkboxes looked inert when no comparison input existed.
    # They must now report the exact absence of compatible points, rather than
    # silently drawing an empty band or residual pane.
    band=chart.locator('[name=nc-band]');residual=chart.locator('[name=nc-residual]')
    feedback=chart.locator('[data-nc-series-feedback]')
    band.check()
    bands=int(feedback.get_attribute('data-band-count'))
    assert bands>=0 and 'uncertainty bands' in feedback.inner_text()
    if bands==0:
        assert 'no applicable points' in feedback.inner_text()
    residual.check()
    residuals=int(feedback.get_attribute('data-residual-count'))
    assert residuals>=0 and 'Residual points' in feedback.inner_text()
    if residuals==0:
        assert 'choose another' in feedback.inner_text()
    residual.uncheck();band.uncheck()
    # AME2026 versus AME2020 uses the *actual* archived ground-mass table,
    # not an empty metadata-only edition list or an assumed mass covariance.
    colours=chart.locator('[name=nc-colour]')
    assert colours.locator('option[value=dame20]').count()==1
    colours.select_option('dame20')
    page.wait_for_function(
        "()=>{const x=document.querySelector('#nuclide-chart .nc-edhint');"
        "return x&&!x.hidden&&x.textContent.includes('AME2020')"
        "&&!x.textContent.includes('Loading')}",
        timeout=25000)
    hint=chart.locator('.nc-edhint').inner_text()
    assert 'AME2020' in hint
    assert 'no 3σ significance' in hint or 'covariance' in hint
    chart.locator('.nc-editions summary').click()
    page.wait_for_function("()=>document.querySelector('#nuclide-chart .nc-ed-tab')?.textContent.includes('AME2026')",timeout=15000)
    table=chart.locator('.nc-ed-tab')
    assert 'AME2026' in table.inner_text() and 'AME2020' in table.inner_text()
    chart.locator('.nc-editions summary').click()
    chain_quantity=chart.locator('[name=nc-pq]')
    assert chain_quantity.locator('option[value=dame20]').count()==1
    chain_quantity.select_option('dame20')
    snapshot(page,"chart2026-versus-2020.png")
    # Restore the basic source colour for subsequent class/checkbox checks.
    colours.select_option('decay')

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
    # User-facing feedback distinguishes working overlays from physically absent
    # zero crossings; the controls really change the canvas or active state.
    status=chart.locator('[data-nc-overlay-feedback]')
    assert status.get_attribute('data-count')=='1'   # N=Z only
    magic.check()
    assert status.get_attribute('data-count')=='2'
    chart.locator('[data-nc-overlay-clear]').click()
    assert status.get_attribute('data-count')=='0'
    assert not overlays.locator('[data-opt=nz]').is_checked()
    chart.locator('[data-nc-overlay-default]').click()
    assert status.get_attribute('data-count')=='1'
    assert overlays.locator('[data-opt=nz]').is_checked()
    contour=overlays.locator('[data-drip=sn]')
    contour.check()
    assert 'Sₙ = 0:' in status.inner_text()
    contour.uncheck()
    rp=overlays.locator('[data-path=rp]')
    rp.check()
    page.wait_for_function("()=>document.querySelector('[data-nc-overlay-feedback]')?.textContent.includes('111 reference points')",timeout=20000)
    assert status.get_attribute('data-count')=='2'
    rp.uncheck()
    # Numerical-class checkbox must enable real controls in numeric color mode.
    colour=chart.locator("[name=nc-colour]")
    # Default 'Decay mode' is categorical: numerical min/max cannot apply.
    assert chart.locator("[name=nc-range-manual]").is_disabled()
    choose_numeric=chart.locator('[data-nc="range-numeric"]')
    assert choose_numeric.is_visible()
    choose_numeric.click()
    assert colour.input_value()=="me"
    assert chart.locator("[name=nc-range-manual]").is_enabled()
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
    canvas=chart.locator("canvas.nc-canvas")
    pixel_signature=lambda: canvas.evaluate("""el=>{
      const d=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
      let h=2166136261;
      for(let i=0;i<d.length;i+=43)h=Math.imul(h^d[i],16777619);
      return h>>>0;
    }""")
    baseline_pixels=pixel_signature()
    rangebox.check();assert rangebox.is_checked()
    assert chart.locator(".nc-range-note").get_attribute("data-range-state")=="manual"
    chart.locator("[name=nc-range-min]").fill("-70")
    chart.locator("[name=nc-range-max]").fill("50")
    chart.locator("[name=nc-range-min]").dispatch_event("input")
    assert chart.locator("[name=nc-range-min]").input_value()=="-70"
    assert chart.locator(".nc-range-note").get_attribute("data-range-unit")=="MeV"
    assert chart.locator(".nc-range-note").get_attribute("data-range-lo")=="-70"
    assert chart.locator(".nc-range-note").get_attribute("data-range-hi")=="50"
    assert pixel_signature()!=baseline_pixels,"Manual range changed fields but NOT rendered nuclear-cell colours"
    # Invalid input must not recolour the existing valid image.
    valid_pixels=pixel_signature()
    chart.locator("[name=nc-range-max]").fill("-100")
    assert chart.locator("[name=nc-range-max]").get_attribute("aria-invalid")=="true"
    assert pixel_signature()==valid_pixels
    chart.locator("[name=nc-range-max]").fill("50")
    assert chart.locator("[name=nc-range-max]").get_attribute("aria-invalid") is None
    # Switching numeric quantities and back must not erase a visitor's range.
    colour.select_option("sn")
    assert not rangebox.is_checked()
    colour.select_option("me")
    assert rangebox.is_checked()
    assert chart.locator("[name=nc-range-min]").input_value()=="-70"
    assert chart.locator("[name=nc-range-max]").input_value()=="50"
    assert pixel_signature()==valid_pixels
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
    # The RFQ uses the same 2026-default evaluated mass *and nuclear state*
    # source as this chart. Historical 2020 selection must refresh the actual
    # species mass, not merely rename a label or mix 2020 isomers with 2026 ME.
    root=page.locator("#rfq-workbench")
    evaluation=root.locator('[name="ms-evaluation"]')
    assert evaluation.input_value()=="2026"
    ion=root.locator('[name="ms-species"]')
    ion.fill("133Cs+")
    root.locator('[data-ms-action="fill"]').click()
    page.wait_for_function(
        "()=>document.querySelector('#rfq-workbench [data-ms-source]')?.textContent.includes('AME2026/NUBASE2026')",
        timeout=25000)
    mass26=float(root.locator('[name="ms-mass"]').input_value())
    assert 132 < mass26 < 134
    assert "AME2020" not in root.locator('[data-ms-source]').inner_text()
    evaluation.select_option("2020")
    page.wait_for_function(
        "()=>document.querySelector('#rfq-workbench [data-ms-source]')?.textContent.includes('AME2020/NUBASE2020')",
        timeout=25000)
    mass20=float(root.locator('[name="ms-mass"]').input_value())
    assert 132 < mass20 < 134
    evaluation.select_option("2026")
    page.wait_for_function(
        "()=>document.querySelector('#rfq-workbench [data-ms-source]')?.textContent.includes('AME2026/NUBASE2026')",
        timeout=25000)
    assert abs(float(root.locator('[name="ms-mass"]').input_value())-mass26)<1e-12
    assert evaluation.input_value()=="2026"
    snapshot(page,"rfq-ame2026-versus-historical-mass.png")
    # Synchronized RFQ real animations: same ion samples, 2D and 3D.
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
    # Perspective is a camera transformation of the same ideal 3D coordinates;
    # it must visibly change the SVG without changing model results.
    p_toggle=cinema.locator('[data-rfq-cinema-3d] [data-motion-projection-toggle]')
    p_toggle.check()
    assert right.get_attribute('data-motion-projection')=='perspective'
    perspective_svg=right.evaluate('(node)=>node.outerHTML')
    p_toggle.uncheck()
    assert right.get_attribute('data-motion-projection')=='orthographic'
    assert right.evaluate('(node)=>node.outerHTML')!=perspective_svg
    orbit=cinema.locator('[data-rfq-cinema-3d] [data-motion-camera-orbit]')
    camera_yaw=cinema.locator('[data-rfq-cinema-3d] .rfq-motion-camera input[type=range]').first
    assert not orbit.is_checked()
    orbit.check()
    initial_yaw=camera_yaw.input_value()
    assert "ideal" in cinema.locator('[data-rfq-cinema-warning]').inner_text().lower()
    snapshot(page,"rfq-2d3d-cinema-desktop.png")
    timeline=cinema.locator('[data-rfq-cinema-player]')
    play=timeline.locator('[data-playback-action="play"]');play.click()
    page.wait_for_timeout(1050)
    assert float(timeline.locator('[data-rfq-playback]').get_attribute("data-fraction"))>0
    assert camera_yaw.input_value()!=initial_yaw,'The 3D camera did not orbit during playback'
    play.click()
    orbit.uncheck()
    cinema.locator('[data-rfq-cinema-left-view]').select_option('phase')
    assert 'phase' in cinema.locator('[data-rfq-cinema-left-view]').input_value()
    for view in ('xz','yz','rz'):
        count_before=int(cinema.get_attribute('data-cinema-iteration'))
        cinema.locator('[data-rfq-cinema-left-view]').select_option(view)
        page.wait_for_function(
            "(previous)=>Number(document.querySelector('[data-rfq-cinema]').dataset.cinemaIteration)>previous",
            arg=count_before,timeout=12000)
        assert left.count()==1
        assert left.locator('text').count()>2
    # Save a radial/axial XZ movie alongside the orthographic 3D projected path.
    cinema.locator('[data-rfq-cinema-left-view]').select_option('xz')

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
    # Scientifically inspect the actual dual-view video stream, not only a
    # preview image or fake blob. Browser MediaRecorder -> decoded video frames.
    record_button=timeline.locator('[data-playback-action="record"]')
    assert record_button.is_enabled(),"This Chromium acceptance runtime must export browser video"
    timeline.locator('select[aria-label="Video duration"]').select_option("4")
    with page.expect_download(timeout=45000) as pending_movie:
        record_button.click()
    movie=pending_movie.value
    path=ART/movie.suggested_filename
    movie.save_as(path)
    assert path.stat().st_size>15000,("Empty RFQ 2D+3D video",path.stat().st_size)
    inspect=subprocess.run(['ffprobe','-v','error','-select_streams','v:0',
        '-count_frames','-show_entries','stream=codec_name,nb_read_frames,width,height',
        '-of','json',str(path)],capture_output=True,text=True,check=True)
    streams=json.loads(inspect.stdout)['streams']
    assert len(streams)==1 and int(streams[0]['width'])==1280
    assert int(streams[0]['height'])==800 and int(streams[0]['nb_read_frames'])>=3,streams
    print("RFQ REAL VIDEO",path.name,path.stat().st_size,"bytes",streams[0],flush=True)

    # Multi-ion RFQ: deterministic seeded beam, not simply a second static graph.
    ensemble=cinema.locator('[data-rfq-ensemble]')
    ensemble.locator('summary').click()
    page.wait_for_function("()=>document.querySelector('[data-rfq-ensemble]')?.dataset.ensembleReady==='true'",timeout=25000)
    assert ensemble.locator('[data-rfq-ensemble-xy] svg').count()==1
    assert ensemble.locator('[data-rfq-ensemble-3d] svg').count()==1
    assert ensemble.locator('[data-rfq-ensemble-xy] svg circle').count()>=16
    assert '16/16' in ensemble.locator('[data-rfq-ensemble-status]').inner_text() or 'survivors' in ensemble.locator('[data-rfq-ensemble-status]').inner_text().lower()
    timeline_packet=ensemble.locator('[data-rfq-ensemble-player]')
    assert timeline_packet.locator('[data-playback-action=play]').is_enabled()
    timeline_packet.locator('[data-playback-action=play]').click()
    page.wait_for_timeout(350)
    assert float(timeline_packet.locator('[data-rfq-playback]').get_attribute('data-fraction'))>0
    timeline_packet.locator('[data-playback-action=play]').click()
    with page.expect_download(timeout=25000) as csv_event:
        ensemble.locator('[data-rfq-ensemble-csv]').click()
    download=csv_event.value
    csv_path=ART/download.suggested_filename;download.save_as(csv_path)
    rows=csv_path.read_text(encoding='utf-8').splitlines()
    assert rows[0].startswith('ion_id,seed,rf_cycle,time_us,x_mm,y_mm,z_mm')
    assert len(rows)>200 and all('NaN' not in row for row in rows[:120])
    with page.expect_download(timeout=25000) as ensemble_frame:
        timeline_packet.locator('[data-playback-frame="svg"]').click()
    image=ensemble_frame.value
    frame_path=ART/image.suggested_filename;image.save_as(frame_path)
    assert frame_path.stat().st_size>1500
    assert 'Synchronized 2D XY / 3D' in frame_path.read_text(encoding='utf-8')
    snapshot(page,"rfq-ideal-ensemble-2d3d.png")
    ensemble.locator('[name=re-seed]').fill('20261129')
    ensemble.locator('[data-rfq-ensemble-run]').click()
    assert 'seed=20261129' in ensemble.locator('[data-rfq-ensemble-status]').inner_text()

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
