#!/usr/bin/env python3
"""Real-browser acceptance for the RFQ resonance panel.

RFQ_E2E_BASE points to a built/served website (default http://127.0.0.1:8765/).
RFQ_E2E_ARTIFACTS selects evidence output. Requires Python Playwright and its
Chromium binary. It never installs browsers or changes website data remotely.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import traceback
import xml.etree.ElementTree as ET

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("RFQ_E2E_BASE", "http://127.0.0.1:8765/").rstrip("/") + "/"
ART = Path(os.environ.get("RFQ_E2E_ARTIFACTS", "rfq-browser-evidence")) / "resonance"

CHART_CHECK = r"""svg => {
  const view=svg.getBoundingClientRect();
  const labels=[...svg.querySelectorAll('text')].filter(t=>t.textContent.trim()).map(t=>{
    const r=t.getBoundingClientRect();return {role:t.dataset.chartLabel||'text',text:t.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom};
  });
  const clipped=labels.filter(r=>r.x<view.x-1||r.y<view.y-1||r.right>view.right+1||r.bottom>view.bottom+1);
  const collisions=[];
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++) {
    const a=labels[i],b=labels[j];
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)collisions.push([a,b]);
  }
  return {width:view.width,height:view.height,labels:labels.length,clipped,collisions};
}"""


def ready(panel):
    expect(panel.locator('[data-rr-action="json"]')).to_be_enabled(timeout=20000)
    expect(panel.locator('[data-rr-figure="map"] svg')).to_be_visible()
    # A control event can precede the debounced rebuild. Observe a quiet map
    # container, then recheck the export gate, which stays closed until both
    # the map and the finite-pulse response belong to the current inputs.
    settled(panel.locator('[data-rr-figure="map"]'))
    expect(panel.locator('[data-rr-action="json"]')).to_be_enabled(timeout=20000)
    expect(panel.locator('[data-rr-error]')).to_be_hidden()


def settled(container):
    # Observe container identity and SVG dimensions, so a tab/resize replacement
    # cannot make an old detached SVG appear to pass a layout check.
    container.evaluate(r"""container => new Promise((resolve,reject)=>{
      const start=performance.now();let last=start,prior=null,size='';
      const observer=new MutationObserver(()=>last=performance.now());
      observer.observe(container,{subtree:true,childList:true,attributes:true,characterData:true});
      const step=now=>{
        const svg=container.querySelector('svg'),rect=container.getBoundingClientRect();
        const next=svg&&rect.width&&rect.height?[rect.width,rect.height,svg.getAttribute('viewBox')].join('|'):'';
        if(!next||svg!==prior||next!==size){last=now;prior=svg;size=next;}
        if(next&&now-last>300){observer.disconnect();resolve();return;}
        if(now-start>8000){observer.disconnect();reject(Error('resonance figure did not settle'));return;}
        requestAnimationFrame(step);
      };requestAnimationFrame(step);
    })""")


def download(page, panel, action, prefix):
    ready(panel)
    with page.expect_download(timeout=30000) as pending:
        panel.locator(f'[data-rr-action="{action}"]').click()
    result = pending.value
    output = ART / f"{prefix}-{result.suggested_filename}"
    result.save_as(output)
    raw = output.read_bytes()
    assert len(raw) > 100, (action, "empty export")
    return raw, {"file": output.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def model(page, panel, prefix, evidence):
    raw, saved = download(page, panel, "json", prefix)
    evidence["exports"].append(saved)
    result = json.loads(raw)
    assert result["schema"] == "rfq-resonance-export-v1"
    assert result["model_evidence"].startswith("ideal numerical")
    return result


def wait_readout_change(panel, old):
    expect(panel.locator('[data-rr-readout]')).not_to_have_text(old, use_inner_text=True, timeout=15000)
    ready(panel)


def workflows(page, evidence):
    page.goto(BASE + "lab/", wait_until="domcontentloaded", timeout=60000)
    root = page.locator('#rfq-workbench')
    expect(root).to_be_visible(timeout=30000)
    root.locator('[data-local-tab="resonance"]').click()
    panel = root.locator('[data-local-panel="resonance"]')
    expect(panel).to_be_visible()
    ready(panel)

    # Use physical controls, not direct core calls, to verify shared-state wiring.
    root.locator('[name="ms-geometry"]').select_option('linear')
    root.locator('[name="ms-mode"]').select_option('voltage')
    root.locator('[name="ms-voltage-convention"]').select_option('rod-peak')
    for name, value in [('mass', '100'), ('charge', '1'), ('U', '0'), ('V', '150'), ('r0', '10'), ('f', '.7')]:
        root.locator(f'[name="ms-{name}"]').fill(value)
    # Force one explicit update after the shared controller has refreshed.
    page.wait_for_function("document.querySelector('[data-rfx-shared-summary]')?.textContent.includes('0.2992656')")
    panel.locator('[data-rr-action="run"]').click()
    ready(panel)
    first = model(page, panel, 'physical', evidence)
    point = first['point']
    assert point['stable'] and abs(point['q'] - .29926555280314987) < 1e-12
    assert abs(point['f_x_Hz'] - 75428.4999381953) < .01
    assert abs(point['primary_parametric_x_Hz'] - 2 * point['f_x_Hz']) < 1e-8
    assert first['response']['rows'] and first['response']['pulse_cycles'] == 48

    old = panel.locator('[data-rr-readout]').inner_text()
    root.locator('[name="ms-mass"]').fill('200')
    wait_readout_change(panel, old)
    heavier = model(page, panel, 'mass-200', evidence)
    assert abs(heavier['point']['q'] - point['q'] / 2) < 1e-12
    assert heavier['point']['f_x_Hz'] < point['f_x_Hz']
    assert heavier['inputs']['ms-mass'] == '200'

    # Hold an absolute auxiliary frequency fixed while RF frequency changes.
    before_path = panel.locator('[data-rr-family="dipole"]').first.get_attribute('d')
    old = panel.locator('[data-rr-readout]').inner_text()
    root.locator('[name="ms-f"]').fill('1.0')
    wait_readout_change(panel, old)
    after_path = panel.locator('[data-rr-family="dipole"]').first.get_attribute('d')
    assert before_path != after_path, 'fixed-Hz dipole contour did not move with RF frequency'
    changed_rf = model(page, panel, 'rf-1MHz', evidence)
    assert changed_rf['inputs']['rr-drive'] == first['inputs']['rr-drive']
    beta = next(c['beta'] for c in changed_rf['conditions'] if c['family'] == 'dipole')
    assert abs(beta - .2) < 1e-12

    before_path = after_path
    panel.locator('[name="rr-drive"]').fill('140')
    expect(panel.locator('[data-rr-family="dipole"]').first).not_to_have_attribute('d', before_path, timeout=20000)
    ready(panel)
    assert panel.locator('[data-rr-family="dipole"]').first.get_attribute('d') != before_path
    # Keep the edited field focused. The first export click must survive the
    # native change event emitted by its blur, without requiring a second click.
    expect(panel.locator('[name="rr-drive"]')).to_be_focused()
    driven = model(page, panel, 'drive-140kHz', evidence)
    assert all(abs(c['beta'] - .28) < 1e-12 for c in driven['conditions'] if c['family'] == 'dipole')

    # An overlay is a conditional locus. Its presence must not turn it into an
    # invented nonlinear force or a parametric heating/loss simulation.
    panel.locator('[name="rr-nonlinear"]').check()
    expect(panel.locator('[data-rr-family="candidate"]')).to_have_count(4, timeout=20000)
    ready(panel)
    expect(panel.locator('[data-rr-candidate-note]')).to_be_visible()
    expect(panel.locator('[data-rr-candidate-note]')).to_contain_text('not sufficient')
    candidate = model(page, panel, 'candidates', evidence)
    lines = [c for c in candidate['contour_segments'] if c['family'] == 'candidate']
    assert len(lines) == 4 and any(c['segments'] for c in lines)
    assert all('requires a nonzero' in c['interpretation'] for c in lines)
    assert 'No nonlinear or parametric drive' in ' '.join(candidate['response']['limits'])
    assert 'no damping' in candidate['response']['model']

    # A map click explicitly switches to shared direct a,q inputs. Choose a
    # stable point away from boundaries; the pick area itself is the chart.
    pick = panel.locator('[data-rr-pick-area]')
    bounds = pick.bounding_box()
    old = panel.locator('[data-rr-readout]').inner_text()
    pick.click(position={'x': bounds['width'] * .55, 'y': bounds['height'] * .50})
    expect(root.locator('[name="ms-mode"]')).to_have_value('direct')
    page.wait_for_function("Math.abs(Number(document.querySelector('[name=\"ms-q\"]').value)-.55)<.002")
    wait_readout_change(panel, old)
    selected = model(page, panel, 'picked', evidence)
    assert abs(selected['point']['a']) < .002 and abs(selected['point']['q'] - .55) < .002
    assert selected['point']['stable']

    # Boundary/unstable points do not receive principal-arccos frequency aliases.
    old = panel.locator('[data-rr-readout]').inner_text()
    root.locator('[name="ms-q"]').fill('.95')
    wait_readout_change(panel, old)
    expect(panel.locator('[data-rr-point-warning]')).to_be_visible()
    bad = model(page, panel, 'unstable', evidence)
    assert not bad['point']['stable'] and bad['point']['f_x_Hz'] is None
    assert bad['response'] is None

    old = panel.locator('[data-rr-readout]').inner_text()
    root.locator('[name="ms-q"]').fill('.4')
    wait_readout_change(panel, old)
    for target in ('map', 'spectrum'):
        panel.locator('[name="rr-export-target"]').select_option(target)
        for action in ('csv', 'svg', 'png', 'pdf'):
            raw, saved = download(page, panel, action, target)
            evidence['exports'].append(saved)
            if action == 'csv':
                rows = list(csv.DictReader(io.StringIO(raw.decode())))
                assert len(rows) > 20
                expected = {'a', 'q', 'stable', 'beta_x', 'beta_y', 'f_x_Hz', 'f_y_Hz'} if target == 'map' else {'drive_Hz', 'x_rms_mm', 'y_rms_mm'}
                assert expected.issubset(rows[0])
            elif action == 'svg':
                svg = ET.fromstring(raw); assert svg.tag.endswith('svg') and svg.get('viewBox')
                assert b'\\frac' not in raw and b'\\mathrm' not in raw
            elif action == 'png':
                assert raw.startswith(bytes.fromhex('89504e470d0a1a0a'))
            else:
                assert raw.startswith(b'%PDF-')
    evidence['workflows'] = {'physical_inputs': True, 'frequency_and_drive_update': True, 'candidate_limits': True,
                             'map_click_direct_mode': True, 'unstable_suppression': True, 'exports': True}


def narrow_layout(browser, evidence):
    for lang in ('en', 'zh'):
        context = browser.new_context(viewport={'width': 320, 'height': 900})
        page = context.new_page()
        page.goto(BASE + ('' if lang == 'en' else 'zh-hans/') + 'lab/', wait_until='domcontentloaded', timeout=60000)
        root = page.locator('#rfq-workbench')
        expect(root).to_be_visible(timeout=30000)
        root.locator('[data-local-tab="resonance"]').click()
        panel = root.locator('[data-local-panel="resonance"]')
        ready(panel)
        panel.locator('[name="rr-nonlinear"]').check()
        expect(panel.locator('[data-rr-family="candidate"]')).to_have_count(4, timeout=20000)
        ready(panel)
        page.wait_for_function('document.fonts.status === "loaded"')
        for kind in ('map', 'spectrum'):
            container = panel.locator(f'[data-rr-figure="{kind}"]')
            settled(container)
            result = container.locator('svg').evaluate(CHART_CHECK)
            assert not result['clipped'], (lang, kind, result['clipped'])
            assert not result['collisions'], (lang, kind, result['collisions'])
            assert result['width'] <= 320, (lang, kind, result['width'])
            container.locator('svg').screenshot(path=str(ART / f'{lang}-320-{kind}.png'))
            evidence['layout'].append({'language': lang, 'kind': kind, 'viewport': 320, **result})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), lang
        if lang == 'zh':
            expect(panel.locator('h3')).to_have_text('共振')
        context.close()


def run():
    ART.mkdir(parents=True, exist_ok=True)
    evidence = {'started_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'base_url': BASE,
                'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
                'kind': 'real browser workflows, exported bytes, narrow-layout checks; no hardware validation',
                'exports': [], 'layout': [], 'failures': []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            evidence['browser'] = browser.version
            context = browser.new_context(viewport={'width': 1400, 'height': 1000}, accept_downloads=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            workflows(page, evidence)
            assert not errors, errors
            context.close()
            narrow_layout(browser, evidence)
            browser.close()
        evidence['passed'] = True
    except Exception:
        evidence['passed'] = False
        evidence['failures'].append(traceback.format_exc())
    finally:
        (ART / 'report.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': evidence['passed'], 'report': str(ART / 'report.json'),
                      'exports': len(evidence['exports']), 'layout_cases': len(evidence['layout'])}))
    if not evidence['passed']:
        raise SystemExit(evidence['failures'][-1])


if __name__ == '__main__':
    run()
