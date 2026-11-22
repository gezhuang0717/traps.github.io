#!/usr/bin/env python3
"""Seven-tab RFQ end-to-end browser smoke test. Requires a built Hugo site."""
import os
import pathlib
import re
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get("RFQ_E2E_BASE","http://127.0.0.1:8765/")
ART=pathlib.Path(os.environ.get("RFQ_E2E_ARTIFACTS","rfq-browser-evidence"))
ART.mkdir(parents=True,exist_ok=True)

def check():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        desktop=browser.new_context(viewport={"width":1450,"height":950},accept_downloads=True)
        page=desktop.new_page()
        page.goto(BASE+"lab/",wait_until="domcontentloaded",timeout=60000)
        root=page.locator("#rfq-workbench")
        expect(root).to_be_visible(timeout=25000)
        tabs=("classic","design","motion","gas","bunch","scan","data")
        for key in tabs:
            tab=root.locator(f'[data-local-tab="{key}"]')
            assert tab.count()==1,key
            tab.click()
            panel=root.locator(f'[data-local-panel="{key}"]')
            expect(panel).to_be_visible(timeout=10000)
            if key in ("motion","gas","bunch","scan"):
                output=panel.locator(f'[data-rfx-output="{key}"]')
                expect(output).not_to_be_empty(timeout=10000)
                assert "Model:" in output.inner_text(),(key,output.inner_text())
                assert panel.locator("svg").count()>0,key
            page.screenshot(path=str(ART/f"desktop-{key}.png"),full_page=False)
        root.locator('[data-local-tab="motion"]').click()
        motion=root.locator('[data-rfx-output="motion"]')
        before=motion.inner_text()
        root.locator('[name="ms-mass"]').fill("120")
        expect(motion).not_to_have_text(before,timeout=10000)
        with page.expect_download() as info:
            root.locator('[data-rfx-action="csv"][data-rfx-kind="motion"]').click()
        dl=info.value
        assert dl.suggested_filename=="rfq-motion-model.csv"
        assert "cycle" in pathlib.Path(dl.path()).read_text()
        root.locator('[data-local-tab="data"]').click()
        data=root.locator('[data-rfx-output="data"]')
        root.locator('[data-rfx-file]').set_input_files({"name":"demo.csv","mimeType":"text/csv","buffer":b"t_ns,E_eV,x_mm,y_mm\n1,1,0,0\n2,2,3,4\n3,3,0,0\n4,4,0,0\n"})
        expect(data).to_contain_text("Events: 4",timeout=10000)
        expect(data).to_contain_text("Cov(t,E)",timeout=10000)
        page.screenshot(path=str(ART/"desktop-data-import.png"),full_page=False)
        desktop.close()
        mobile=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=2)
        m=mobile.new_page()
        m.goto(BASE+"lab/",wait_until="domcontentloaded",timeout=60000)
        root=m.locator("#rfq-workbench")
        expect(root).to_be_visible(timeout=25000)
        for key in tabs:
            root.locator(f'[data-local-tab="{key}"]').click()
            expect(root.locator(f'[data-local-panel="{key}"]')).to_be_visible(timeout=10000)
        m.screenshot(path=str(ART/"mobile-seven-tabs.png"),full_page=False)
        mobile.close();browser.close()
    print("RFQ browser E2E: seven tabs, linked mass state, CSV download/import and mobile tab visibility passed.")

if __name__=="__main__": check()
