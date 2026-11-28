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
TABS = ("classic", "design", "resonance", "motion", "gas", "bunch", "scan", "data")
# The trajectory cinema is a ninth accessible keyboard tab. Existing eight
# scientific chart groups retain their independent figure/export acceptance.
KEY_TABS = TABS[:3] + ("cinema",) + TABS[3:]
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
  const container=svg.closest('[data-ms-figure], [data-ms-design-figure], [data-rfx-figure]')||svg.parentElement;
  const labels=[...svg.querySelectorAll('text')].filter(t=>t.textContent.trim()).map(t=>{
    const r=t.getBoundingClientRect();return {role:t.dataset.chartLabel||'text',text:t.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom};
  });
  const clipped=labels.filter(b=>b.x<viewport.x-1||b.y<viewport.y-1||b.right>viewport.right+1||b.bottom>viewport.bottom+1);
  const collisions=[];
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)collisions.push([a,b]);
  }
  return {width:viewport.width,height:viewport.height,container_width:container.clientWidth,labels:labels.length,clipped,collisions};
}"""


def fixture() -> bytes:
    rows = ["t_ns,E_eV,x_mm,y_mm"]
    for i in range(80):
        t = 200 + 12 * math.sin(i * .41) + i * .04
        energy = 1000 + .2 * (t - 200) + math.cos(i * .71)
        rows.append(f"{t:.9f},{energy:.9f},{math.sin(i):.6f},{math.cos(i):.6f}")
    return ("\n".join(rows) + "\n").encode()


def settled_figure(container) -> dict:
    """Wait for a visible chart to stop changing, with a strict 5 s deadline.

    Tab/resize events legitimately replace the SVG after a short debounce.
    Observe its permanent container instead of retaining a detached SVG handle.
    Both DOM mutations and measured size changes reset the quiet interval.
    """
    return container.evaluate(r"""container => new Promise((resolve, reject) => {
      const start=performance.now(), limit=5000, quiet=250;
      let lastChange=start, previous=null, signature='', frame=null;
      const observer=new MutationObserver(()=>{lastChange=performance.now();});
      observer.observe(container,{subtree:true,childList:true,attributes:true,characterData:true});
      const finish=(error,result)=>{observer.disconnect();if(frame!==null)cancelAnimationFrame(frame);error?reject(Error(error)):resolve(result);};
      const sample=now=>{
        const svg=container.querySelector('svg');
        const bounds=container.getBoundingClientRect();
        const visible=svg && svg.isConnected && bounds.width>0 && bounds.height>0 && getComputedStyle(container).display!=='none';
        const next=visible?[bounds.width.toFixed(2),bounds.height.toFixed(2),svg.getAttribute('viewBox')].join('|'):'';
        if(!visible||svg!==previous||next!==signature){lastChange=now;previous=svg;signature=next;}
        if(visible&&now-lastChange>=quiet){finish(null,{wait_ms:Math.round(now-start),quiet_ms:Math.round(now-lastChange),width:bounds.width,height:bounds.height,viewBox:svg.getAttribute('viewBox')});return;}
        if(now-start>=limit){finish('RFQ figure did not settle within 5 seconds');return;}
        frame=requestAnimationFrame(sample);
      };
      frame=requestAnimationFrame(sample);
    })""")


def check_exports(page, root, tab: str, prefix: str) -> list[dict]:
    outputs = []
    for suffix in ("svg", "png", "pdf"):
        selector = (
            f'[data-ms-action="{suffix}"]' if tab == "classic"
            else f'[data-ms-action="design-{suffix}"]' if tab == "design"
            else f'[data-rr-action="{suffix}"]' if tab == "resonance"
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
                "cases": [], "exports": [], "failures": []}

    def failure(scope: dict, kind: str, detail) -> None:
        item = {**scope, "kind": kind, "detail": detail}
        evidence["failures"].append(item)
        print(f'RFQ visual failure: {scope} — {kind}', flush=True)

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
                # A keyboard failure remains a gate, but does not discard the
                # independent rendered evidence from the remaining viewports.
                try:
                    expect(root.locator('[data-local-tab="classic"]')).to_have_attribute("aria-selected", "true")
                    root.locator('[data-local-tab="classic"]').focus()
                    for tab in KEY_TABS[1:]:
                        page.keyboard.press("ArrowRight")
                        expect(root.locator(f'[data-local-tab="{tab}"]')).to_be_focused()
                        expect(root.locator(f'[data-local-panel="{tab}"]')).to_be_visible()
                    page.keyboard.press("Home")
                    expect(root.locator('[data-local-tab="classic"]')).to_be_focused()
                    page.keyboard.press("End")
                    expect(root.locator('[data-local-tab="data"]')).to_be_focused()
                except Exception:
                    failure({"language": language}, "keyboard navigation", traceback.format_exc())
                try:
                    root.locator('[data-local-tab="data"]').click()
                    root.locator('[data-rfx-file]').set_input_files({"name": "rfq-visual-test-fixture.csv", "mimeType": "text/csv", "buffer": fixture()})
                    expect(root.locator('[data-rfx-output="data"]')).not_to_be_empty()
                except Exception:
                    failure({"language": language}, "fixture import", traceback.format_exc())

                for width in WIDTHS:
                    page.set_viewport_size({"width": width, "height": 1000})
                    for tab in TABS:
                        scope = {"language": language, "viewport": width, "tab": tab}
                        case = {**scope, "layout": None, "charts": []}
                        evidence["cases"].append(case)
                        first_failure = len(evidence["failures"])
                        prefix = f"{language}-{width}"
                        panel = root.locator(f'[data-local-panel="{tab}"]')
                        figure_container = panel.locator('[data-ms-figure]' if tab == 'classic' else '[data-ms-design-figure]' if tab == 'design' else '[data-rr-figure="map"]' if tab == 'resonance' else '[data-rfx-figure]').first
                        figure = figure_container.locator('svg').first
                        try:
                            root.locator(f'[data-local-tab="{tab}"]').click()
                            expect(panel).to_be_visible()
                            if tab == 'resonance':
                                panel.locator('[data-rr-action="run"]').click()
                            elif tab not in ("classic", "design"):
                                panel.locator(f'[data-rfx-action="run"][data-rfx-kind="{tab}"]').click()
                            expect(figure).to_be_visible(timeout=15000)
                            figure_container.scroll_into_view_if_needed(timeout=10000)
                            case["render_settle"] = settled_figure(figure_container)
                            layout = root.evaluate(LAYOUT_CHECK)
                            case["layout"] = layout
                            if layout["document"] > layout["viewport"] + 2:
                                failure(scope, "document overflow", layout)
                            if layout["root"]["right"] > layout["viewport"] + 2 or layout["root"]["x"] < -2:
                                failure(scope, "workbench overflow", layout)
                            if layout["collisions"]:
                                failure(scope, "control overlap", layout["collisions"])
                            for chart_index, svg in enumerate(panel.locator('svg[data-rfq-chart]').all()):
                                check = svg.evaluate(CHART_CHECK)
                                case["charts"].append(check)
                                if check["width"] > check["container_width"] + 2:
                                    failure({**scope, "chart": chart_index}, "chart overflow", {"rendered_width": check["width"], "container_width": check["container_width"]})
                                if check["clipped"]:
                                    failure({**scope, "chart": chart_index}, "clipped labels", check["clipped"])
                                if check["collisions"]:
                                    failure({**scope, "chart": chart_index}, "overlapping labels", check["collisions"])
                        except Exception:
                            failure(scope, "rendering or measurement", traceback.format_exc())
                        # Capture failing cases as well as successful ones; the
                        # measured collisions remain failures, never suppressed.
                        try:
                            if figure.is_visible():
                                figure_container.screenshot(path=str(ART / f"{prefix}-{tab}-figure.png"), timeout=10000)
                            if panel.is_visible() and (width in (390, 1440) or len(evidence["failures"]) > first_failure):
                                panel.screenshot(path=str(ART / f"{prefix}-{tab}-panel.png"), timeout=10000)
                            elif not figure.is_visible():
                                page.screenshot(path=str(ART / f"{prefix}-{tab}-failure.png"), timeout=10000)
                        except Exception:
                            failure(scope, "evidence screenshot", traceback.format_exc())
                        if width == 1440 and language == "en":
                            try:
                                evidence["exports"].extend(check_exports(page, root, tab, prefix))
                            except Exception:
                                failure(scope, "figure export", traceback.format_exc())
                        case["result"] = "failed" if len(evidence["failures"]) > first_failure else "passed"
                    if width in (320, 1440):
                        guide = root.locator(':scope > .rfq-foundations')
                        scope = {"language": language, "viewport": width, "tab": "physics guide"}
                        try:
                            if guide.get_attribute('open') is None:
                                guide.locator(':scope > summary').click()
                            for section in guide.locator('.rfq-guide-section').all():
                                if section.get_attribute('open') is None:
                                    section.locator(':scope > summary').click()
                            if guide.locator('math mfrac').count() < 8:
                                failure(scope, "equations absent", "Expected the guide's fraction equations")
                            for index, eq in enumerate(guide.locator('math').all()):
                                if eq.evaluate('(e)=>e.getBoundingClientRect().height') <= 5:
                                    failure(scope, "equation did not render", {"equation": index})
                            layout = root.evaluate(LAYOUT_CHECK)
                            if layout["document"] > width + 2:
                                failure(scope, "equation overflow", layout)
                            guide.screenshot(path=str(ART / f"{language}-{width}-physics-guide.png"), timeout=10000)
                        except Exception:
                            failure(scope, "guide rendering or screenshot", traceback.format_exc())
                        finally:
                            if guide.get_attribute('open') is not None:
                                guide.locator(':scope > summary').click()
                if errors:
                    failure({"language": language}, "uncaught browser errors", errors)
                context.close()
            browser.close()
        if evidence["failures"]:
            failed_cases = sum(case["result"] == "failed" for case in evidence["cases"])
            raise AssertionError(f'RFQ visual acceptance: {len(evidence["failures"])} failures in {failed_cases}/{len(evidence["cases"])} rendered cases; inspect visual/validation.json and screenshots.')
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
