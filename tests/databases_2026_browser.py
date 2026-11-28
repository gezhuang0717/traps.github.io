"""Chromium checks for the Databases page's current and archival isotope lookups."""
import os
from playwright.sync_api import sync_playwright
BASE=os.environ.get("NUCLIDE_E2E_BASE","http://127.0.0.1:8770/").rstrip("/")+"/"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
    ctx=browser.new_context(viewport={"width":1140,"height":900},locale="en-US")
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto(BASE+"databases/",wait_until="domcontentloaded",timeout=30000)
    root=page.locator("[data-databases]")
    root.wait_for(state="visible")
    assert root.get_attribute("data-nubase").endswith("/data/nubase2026.json")
    assert root.locator("#db-amdc2026").count()==1
    assert root.locator('[name=zg-db-edition]').input_value()=="2026"
    root.locator('.zg-db-lookup-f [name=nuc]').fill('100Sn')
    root.locator('.zg-db-lookup-f button[type=submit]').click()
    result=root.locator('.zg-db-lookup-out')
    result.locator('dt').filter(has_text='AME2026').wait_for(timeout=15000)
    assert '100' in result.inner_text()
    assert root.locator('a[href*="nuclide=100Sn"]').count()>=1
    assert root.locator('.zg-db-count').inner_text().strip()
    # Real search filtering, category and favorite buttons.
    query=root.locator('.zg-db-tools [name=q]')
    query.fill('AME2026')
    assert root.locator('#db-amdc2026').is_visible()
    assert root.locator('#db-amdc').is_hidden()
    query.fill('')
    fav=root.locator('#db-amdc2026 .zg-db-fav')
    fav.click();assert fav.get_attribute('aria-pressed')=='true'
    fav.click();assert fav.get_attribute('aria-pressed')=='false'
    # Historical NUBASE2020 is an explicit selection, not substituted for 2026.
    root.locator('[name=zg-db-edition]').select_option('2020')
    result.locator('dt').filter(has_text='AME2020').wait_for(timeout=15000)
    assert root.locator('a[href*="evaluation=2020"]').count()>=1
    root.locator('[name=zg-db-edition]').select_option('2026')
    result.get_by_text('AME2026',exact=True).wait_for(timeout=15000)
    assert not errors,errors
    print("PASS: Databases search, AMDC2026 source, 100Sn mass lookup, 2020 archive switch and favorites",flush=True)
    browser.close()
