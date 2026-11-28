#!/usr/bin/env python3
"""Exercise real RFQ workflows against a built site, including saved file bytes."""
import json
import os
import pathlib
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('RFQ_E2E_BASE', 'http://127.0.0.1:8765/')
ART = pathlib.Path(os.environ.get('RFQ_E2E_ARTIFACTS', 'rfq-browser-evidence'))
ART.mkdir(parents=True, exist_ok=True)


def download(page, locator):
    with page.expect_download(timeout=30000) as item:
        locator.click()
    got = item.value
    return got.suggested_filename, pathlib.Path(got.path()).read_bytes()


def check():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        desktop = browser.new_context(viewport={'width': 1450, 'height': 950}, accept_downloads=True)
        page = desktop.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + 'lab/', wait_until='domcontentloaded', timeout=60000)
        root = page.locator('#rfq-workbench')
        expect(root).to_be_visible(timeout=25000)
        tabs = ('classic', 'design', 'resonance', 'motion', 'gas', 'bunch', 'scan', 'data')
        for key in tabs:
            tab = root.locator(f'[data-local-tab="{key}"]')
            assert tab.count() == 1, key
            tab.click()
            panel = root.locator(f'[data-local-panel="{key}"]')
            expect(panel).to_be_visible(timeout=10000)
            if key in ('motion', 'gas', 'bunch', 'scan'):
                output = panel.locator(f'[data-rfx-output="{key}"]')
                expect(output).to_contain_text('Model:', timeout=10000)
                assert panel.locator('svg').count() > 0, key
                expect(panel.locator(f'[data-rfx-error="{key}"]')).to_be_empty()
        # Programmatic actions must update dependent panels, including when hidden.
        root.locator('[data-local-tab="motion"]').click()
        motion = root.locator('[data-rfx-output="motion"]')
        before = motion.inner_text()
        root.locator('[name="ms-mass"]').fill('120')
        expect(motion).not_to_have_text(before, timeout=10000, use_inner_text=True)
        root.locator('[data-local-tab="classic"]').click()
        root.locator('[data-ms-action="stable-demo"]').click()
        root.locator('[data-local-tab="motion"]').click()
        q_metric = motion.locator('.rfq-metric').filter(has_text=re.compile(r'^q:')).locator('dd')
        expect(q_metric).to_have_text('0.4', timeout=10000)
        # A noninteger cycle count and physical velocity survive export correctly.
        root.locator('[name="rx-cycles"]').fill('1.1')
        root.locator('[name="rx-vx"]').fill('0.01')
        root.locator('[name="rx-vz"]').fill('3')
        root.locator('[name="rx-length"]').fill('12')
        name, raw = download(page, root.locator('[data-rfx-action="json"][data-rfx-kind="motion"]'))
        saved = json.loads(raw)
        assert saved['inputs']['rx-cycles'] == '1.1'
        assert saved['inputs']['rx-vx'] == '0.01'
        assert saved['inputs']['rx-length'] == '12'
        transit = saved['result']['transit']
        assert transit['schema'] == 'rfq-axial-transit-ideal-v1'
        assert transit['transit_time_us'] == 4
        assert abs(transit['transit_rf_cycles'] - 4 * saved['result']['shared']['f_MHz']) < 1e-10
        assert transit['observation_covers_nominal_exit'] is False
        expect(motion).to_contain_text('Nominal active length')
        assert abs(saved['result']['samples'][-1]['cycle'] - 1.1) < 1e-12
        for view in ('orbit', 'phase', 'time'):
            root.locator('[name="rx-motion-view"]').select_option(view)
            expect(root.locator('[data-rfx-figure="motion"] svg')).to_be_visible()
        name, raw = download(page, root.locator('[data-rfx-action="csv"][data-rfx-kind="motion"]'))
        assert name == 'rfq-motion-model.csv' and b'cycle' in raw and b'time_us' in raw
        for ext in ('svg', 'png', 'pdf'):
            name, raw = download(page, root.locator(f'[data-rfx-action="{ext}"][data-rfx-kind="motion"]'))
            assert name.endswith('.' + ext), name
            assert (raw.startswith(bytes.fromhex('89504e470d0a1a0a')) if ext == 'png' else
                    raw.startswith(b'%PDF-') if ext == 'pdf' else b'<svg' in raw), (ext, raw[:16])
            (ART / name).write_bytes(raw)
        # All comparison axes must generate actual numeric tables and exports.
        root.locator('[data-local-tab="scan"]').click()
        for axis in ('frequency', 'radius', 'mass', 'voltage'):
            root.locator('[name="rx-scan-axis"]').select_option(axis)
            name, raw = download(page, root.locator('[data-rfx-action="json"][data-rfx-kind="scan"]'))
            report = json.loads(raw)
            assert report['inputs']['rx-scan-axis'] == axis
            assert len(report['result']['rows']) == 51
            assert root.locator('[data-rfx-scan-table] tbody tr').count() == 51
        # Import -> quoted CSV export -> reimport must preserve sample statistics.
        root.locator('[data-local-tab="data"]').click()
        data = root.locator('[data-rfx-output="data"]')
        root.locator('[data-rfx-file]').set_input_files({'name': 'demo.csv', 'mimeType': 'text/csv',
            'buffer': b't_ns,E_eV,x_mm,y_mm\n1,1,0,0\n2,2,3,4\n3,3,0,0\n4,4,0,0\n'})
        expect(data).to_contain_text(re.compile(r'Events:\s*4'), timeout=10000)
        expect(data).to_contain_text('Cov(t,E)')
        before = data.inner_text()
        name, raw = download(page, root.locator('[data-rfx-action="csv"][data-rfx-kind="data"]'))
        root.locator('[data-rfx-file]').set_input_files({'name': name, 'mimeType': 'text/csv', 'buffer': raw})
        expect(data).to_have_text(before, use_inner_text=True)
        # Unrelated bad RF input must not invalidate a local data calculation.
        root.locator('[name="ms-f"]').fill('0')
        root.locator('[data-rfx-action="run"][data-rfx-kind="data"]').click()
        expect(data).to_have_text(before, use_inner_text=True)
        expect(root.locator('[data-rfx-error="data"]')).to_be_empty()
        root.locator('[name="ms-f"]').fill('0.7')
        root.locator('[name="rx-data-view"]').select_option('histogram')
        expect(root.locator('[data-rfx-figure="data"] svg')).to_be_visible()
        root.locator('[data-rfx-action="clear"]').click()
        expect(data).to_contain_text('Choose a valid')
        expect(root.locator('[data-rfx-action="csv"][data-rfx-kind="data"]')).to_be_disabled()
        root.locator('[data-rfx-action="demo"]').click()
        expect(data).to_contain_text(re.compile(r'Events:\s*61'))
        assert not errors, errors
        desktop.close()
        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=2)
        m = mobile.new_page()
        m.goto(BASE + 'lab/', wait_until='domcontentloaded', timeout=60000)
        root = m.locator('#rfq-workbench')
        expect(root).to_be_visible(timeout=25000)
        for key in tabs:
            root.locator(f'[data-local-tab="{key}"]').click()
            expect(root.locator(f'[data-local-panel="{key}"]')).to_be_visible(timeout=10000)
        mobile.close(); browser.close()
    print('RFQ E2E passed: eight tabs, shared programmatic state, motion views/timing, four scans, real figure downloads, CSV round trip, independent data analysis, mobile tabs.')


if __name__ == '__main__':
    check()
