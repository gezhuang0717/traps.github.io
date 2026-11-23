#!/usr/bin/env python3
"""RFQ visual acceptance in a real browser.

Run against a locally built website. This checks rendered geometry and actual
exported files, not an implementation snapshot. Evidence identifies its source
commit and browser. Numeric data below are deterministic test fixtures.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import traceback
import xml.etree.ElementTree as ET

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("RFQ_E2E_BASE", "http://127.0.0.1:8765/").rstrip("/") + "/"
ART = Path(os.environ.get("RFQ_E2E_ARTIFACTS", "rfq-browser-evidence")) / "visual"
TABS = ("classic", "design", "motion", "gas", "bunch", "scan", "data")
WIDTHS = (320, 390, 768, 1440)
ART.mkdir(parents=True, exist_ok=True)

# Rectangles are measured after rendering; contained horizontal scrollers are
# allowed for long equations/tables, but the document itself must not overflow.
LAYOUT_CHECK = r"""root => {
  const visible = el => {const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';};
  const box = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
  const collisions=[];
  for(const grid of root.querySelectorAll('.zg-form, .zg-local-tabs')) {
    if(!visible(grid)) continue;
    const items=[...grid.children].filter(visible);
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(overlap(box(items[i]),box(items[j])))
      collisions.push([items[i].textContent.trim().slice(0,90),items[j].textContent.trim().slice(0,90)]);
  }
  return {viewport:innerWidth,document:document.documentElement.scrollWidth,root:box(root),collisions};
}"""

CHART_CHECK = r"""svg => {
  const viewport=svg.getBoundingClientRect();
  const labels=[...svg.querySelectorAll('text')].filter(t=>t.textContent.trim()).map(t=>{
    const r=t.getBoundingClientRect();return {role:t.dataset.chartLabel||'text',text:t.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom};
  });
  const clipped=labels.filter(b=>b.x<viewport.x-1||b.y<viewport.y-1||b.right>viewport.right+1||b.bottom>viewport.bottom+1);
  const collisions=[];
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)collisions.push([a,b]);
  }
  return {width:viewport.width,height:viewport.height,labels:labels.length,clipped,collisions};
}"""


def fixture() -> bytes:
    rows = ["t_ns,E_eV,x_mm,y_mm"]
    for i in range(80):
        t = 200 + 12 * math.sin(i * .41) + i * .04
        energy = 1000 + .2 * (t - 200) + math.cos(i * .71)
        rows.append(f"{t:.9f},{energy:.9f},{math.sin(i):.6f},{math.cos(i):.6f}")
    return ("\n".join(rows) + "\n").encode()


def check_exports(page, root, tab: str, prefix: str) -> list[dict]:
    outputs = []
    for suffix in ("svg", "png", "pdf"):
        selector = (
            f'[data-ms-action="{suffix}"]' if tab == "classic"
            else f'[data-ms-action="design-{suffix}"]' if tab == "design"
            else f'[data-rfx-action="{suffix}"][data-rfx-kind="{tab}"]'
        )
        button = root.locator(selector)
        expect(button).to_be_enabled()
        with page.expect_download(timeout=30000) as event:
            button.click()
        download = event.value
        path = ART / f"{prefix}-{tab}.{suffix}"
        download.save_as(path)
        raw = path.read_bytes()
        assert len(raw) > 100, (tab, suffix, "empty export")
        if suffix == "svg":
            svg = ET.fromstring(raw)
            assert svg.tag.endswith("svg") and svg.attrib.get("viewBox"), tab
            assert b"\\frac" not in raw and b"\\mathrm" not in raw, (tab, "raw TeX in SVG")
        elif suffix == "png":
            assert raw.startswith(bytes.fromhex("89504e470d0a1a0a")), tab
        else:
            assert raw.startswith(b"%PDF-"), tab
        outputs.append({"file": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})
    return outputs


def run() -> dict:
    evidence = {"started_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "base_url": BASE,
                "evidence_kind": "browser rendering and deterministic test data; no native simulation",
                "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                "cases": [], "exports": []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            evidence["browser"] = browser.version
            for language, route in (("en", "lab/"), ("zh", "zh-hans/lab/")):
                context = browser.new_context(viewport={"width": WIDTHS[0], "height": 1000}, accept_downloads=True)
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(BASE + route, wait_until="domcontentloaded", timeout=60000)
                root = page.locator("#rfq-workbench")
                expect(root).to_be_visible(timeout=30000)
                page.evaluate("document.fonts.ready")
                expect(root.locator('[data-local-tab="classic"]')).to_have_attribute("aria-selected", "true")
                # Confirm keyboard navigation works without a pointer.
                root.locator('[data-local-tab="classic"]').focus()
                for tab in TABS[1:]:
                    page.keyboard.press("ArrowRight")
                    expect(root.locator(f'[data-local-tab="{tab}"]')).to_be_focused()
                    expect(root.locator(f'[data-local-panel="{tab}"]')).to_be_visible()
                page.keyboard.press("Home")
                expect(root.locator('[data-local-tab="classic"]')).to_be_focused()
                page.keyboard.press("End")
                expect(root.locator('[data-local-tab="data"]')).to_be_focused()
                root.locator('[data-rfx-file]').set_input_files({"name": "rfq-visual-test-fixture.csv", "mimeType": "text/csv", "buffer": fixture()})
                expect(root.locator('[data-rfx-output="data"]')).not_to_be_empty()

                for width in WIDTHS:
                    page.set_viewport_size({"width": width, "height": 1000})
                    for tab in TABS:
                        root.locator(f'[data-local-tab="{tab}"]').click()
                        panel = root.locator(f'[data-local-panel="{tab}"]')
                        expect(panel).to_be_visible()
                        # Run buttons refresh visible charts at the final width.
                        if tab not in ("classic", "design"):
                            panel.locator(f'[data-rfx-action="run"][data-rfx-kind="{tab}"]').click()
                        figure = panel.locator('[data-ms-figure] svg' if tab == 'classic' else '[data-ms-design-figure] svg' if tab == 'design' else '[data-rfx-figure] svg').first
                        expect(figure).to_be_visible(timeout=15000)
                        figure.scroll_into_view_if_needed()
                        layout = root.evaluate(LAYOUT_CHECK)
                        assert layout["document"] <= layout["viewport"] + 2, (language, width, tab, "document overflow", layout)
                        assert layout["root"]["right"] <= layout["viewport"] + 2 and layout["root"]["x"] >= -2, (language, width, tab, "workbench overflow", layout)
                        assert not layout["collisions"], (language, width, tab, "control overlap", layout["collisions"])
                        chart_checks = []
                        for svg in panel.locator('svg[data-rfq-chart]').all():
                            check = svg.evaluate(CHART_CHECK)
                            assert not check["clipped"], (language, width, tab, "clipped labels", check["clipped"])
                            assert not check["collisions"], (language, width, tab, "overlapping labels", check["collisions"])
                            chart_checks.append(check)
                        prefix = f"{language}-{width}"
                        figure.screenshot(path=str(ART / f"{prefix}-{tab}-figure.png"))
                        if width in (390, 1440):
                            panel.screenshot(path=str(ART / f"{prefix}-{tab}-panel.png"))
                        evidence["cases"].append({"language": language, "viewport": width, "tab": tab, "layout": layout, "charts": chart_checks})
                        if width == 1440 and language == "en":
                            evidence["exports"].extend(check_exports(page, root, tab, prefix))
                    if width in (320, 1440):
                        guide = root.locator('.rfq-foundations')
                        guide.locator(':scope > summary').click()
                        for section in guide.locator('.rfq-guide-section').all():
                            if section.get_attribute('open') is None:
                                section.locator(':scope > summary').click()
                        assert guide.locator('math mfrac').count() >= 8, "Equations are absent"
                        for eq in guide.locator('math').all():
                            assert eq.evaluate('(e)=>e.getBoundingClientRect().height') > 5, "Equation did not render"
                        layout = root.evaluate(LAYOUT_CHECK)
                        assert layout["document"] <= width + 2, (language, width, "equation overflow", layout)
                        guide.screenshot(path=str(ART / f"{language}-{width}-physics-guide.png"))
                        guide.locator(':scope > summary').click()
                assert not errors, (language, "uncaught browser errors", errors)
                context.close()
            browser.close()
        evidence["result"] = "passed"
        return evidence
    except Exception:
        evidence["result"] = "failed"
        evidence["error"] = traceback.format_exc()
        raise
    finally:
        evidence["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        (ART / 'validation.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    result = run()
    print(f'RFQ visual acceptance passed: {len(result["cases"])} rendered cases; {len(result["exports"])} actual figure exports.')
