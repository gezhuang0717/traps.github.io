#!/usr/bin/env python3
"""Bounded real-browser acceptance for RFQ motion, teaching scenes and data.

Requires a built site, Python Playwright/Chromium and ffmpeg/ffprobe. Uses the
same RFQ_E2E_BASE / RFQ_E2E_ARTIFACTS contract as the other RFQ acceptance tests.
Video success requires real decoded motion and frame counts, not a mocked blob.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import traceback
import xml.etree.ElementTree as ET

from playwright.sync_api import expect, sync_playwright
from rfq_resonance_acceptance import CHART_CHECK, settled

BASE = os.environ.get('RFQ_E2E_BASE', 'http://127.0.0.1:8765/').rstrip('/') + '/'
ART = Path(os.environ.get('RFQ_E2E_ARTIFACTS', 'rfq-browser-evidence')) / 'motion-scenes'
REPO = Path(__file__).resolve().parents[1]
VIEWS = ('time', 'orbit', 'phase', 'filtered', 'axial', 'spatial', 'comparison', 'spectrum')


def file_evidence(path):
    raw = path.read_bytes()
    return {'file': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def download(page, button, prefix, evidence):
    expect(button).to_be_enabled(timeout=15000)
    with page.expect_download(timeout=35000) as pending:
        button.click()
    item = pending.value
    path = ART / f'{prefix}-{item.suggested_filename}'
    item.save_as(path)
    assert path.stat().st_size > 100, (prefix, 'empty download')
    evidence['exports'].append(file_evidence(path))
    return path


def choose(root, kind):
    root.locator(f'[data-local-tab="{kind}"]').click()
    panel = root.locator(f'[data-local-panel="{kind}"]')
    expect(panel).to_be_visible()
    return panel


def model(page, root, kind, prefix, evidence):
    path = download(page, root.locator(f'[data-rfx-action="json"][data-rfx-kind="{kind}"]'), prefix, evidence)
    result = json.loads(path.read_text())
    assert result['kind'] == kind
    return result


def stage(panel, kind):
    return panel.locator('.rfq-motion-stage' if kind == 'motion' else f'[data-rfq-scene="{kind}"] .rfq-scene-display')


def player(panel):
    return panel.locator('[data-rfq-playback]')


def wait_scene(panel, kind):
    expect(panel.locator(f'[data-rfx-error="{kind}"]')).to_be_empty(timeout=15000)
    expect(stage(panel, kind).locator('svg')).to_be_visible(timeout=15000)
    expect(player(panel)).to_have_count(1)
    # Tab/resize work can replace the entire stage after its debounce. Observe
    # the permanent figure host so an old detached stage cannot stall the test.
    settled(panel.locator(f'[data-rfx-figure="{kind}"]'))


def seek(panel, fraction):
    value = round(fraction * 1000)
    player(panel).locator('[data-playback-seek]').evaluate("(e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));}", value)
    expect(player(panel)).to_have_attribute('data-fraction', f'{value / 1000:.6f}')


def geometry_signature(svg):
    # Exclude text so a changing time caption alone cannot fake motion.
    return svg.evaluate("e=>[...e.querySelectorAll('path,polyline,circle,line,rect')].map(x=>['d','points','cx','cy','x','y','x1','x2','y1','y2'].map(k=>x.getAttribute(k)||'').join('|')).join(';')")


def check_frame_exports(page, panel, kind, evidence):
    seek(panel, .35)
    for extension in ('svg', 'png', 'pdf'):
        path = download(page, player(panel).locator(f'[data-playback-frame="{extension}"]'), f'{kind}-frame35', evidence)
        raw = path.read_bytes()
        if extension == 'svg':
            svg = ET.fromstring(raw)
            assert svg.tag.endswith('svg') and svg.get('viewBox')
            metadata = [json.loads(e.text) for e in svg.iter() if e.tag.endswith('desc') and e.text and e.text.startswith('{')]
            saved = next(m for m in metadata if m.get('schema') == 'rfq-animation-frame-v1')
            assert abs(saved['fraction'] - .35) < 1e-12, (kind, 'wrong saved animation frame')
            assert b'\\frac' not in raw and b'\\mathrm' not in raw
        elif extension == 'png':
            assert raw.startswith(bytes.fromhex('89504e470d0a1a0a'))
        else:
            assert raw.startswith(b'%PDF-')
    assert abs(float(player(panel).get_attribute('data-fraction')) - .35) < 1e-12


def decode_video(path, declared_mime):
    """Count decoded video frames and compare decoded grayscale image content."""
    for binary in ('ffprobe', 'ffmpeg'):
        assert shutil.which(binary), f'{binary} is required to validate real recording'
    raw = path.read_bytes()
    suffix = path.suffix.lower()
    assert suffix in ('.webm', '.mp4')
    if suffix == '.webm':
        assert declared_mime.startswith('video/webm') and raw[:4] == bytes.fromhex('1a45dfa3')
    else:
        assert declared_mime.startswith('video/mp4') and raw[4:8] == b'ftyp'
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
        '-show_entries', 'stream=codec_name,width,height,nb_read_frames,duration,r_frame_rate:format=format_name,duration',
        '-of', 'json', str(path)], text=True, timeout=40))
    stream = probe['streams'][0]
    frames = int(stream.get('nb_read_frames', 0))
    assert frames >= 30, ('too few decoded video frames', frames)
    duration_text = probe.get('format', {}).get('duration') or stream.get('duration')
    if duration_text and duration_text != 'N/A':
        duration = float(duration_text)
    else:
        # WebM from MediaRecorder may not carry duration metadata. Packet
        # timestamps still establish the real temporal extent of the stream.
        timing = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_packets', '-show_entries', 'packet=pts_time,duration_time', '-of', 'json', str(path)], text=True, timeout=40))
        packets = timing['packets']
        duration = max(float(p['pts_time']) + float(p.get('duration_time', 0)) for p in packets) - min(float(p['pts_time']) for p in packets)
    assert 3.5 <= duration <= 6.5, ('four-second recording duration', duration)
    assert stream['width'] >= 640 and stream['height'] >= 360
    pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0',
        '-vf', 'fps=4,scale=160:100', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1'], timeout=40)
    size = 160 * 100
    assert len(pixels) % size == 0 and len(pixels) // size >= 10
    decoded = [pixels[i:i + size] for i in range(0, len(pixels), size)]
    hashes = {hashlib.sha256(frame).hexdigest() for frame in decoded}
    assert len(hashes) >= 4, 'decoded recording is static'
    difference = max(sum(abs(a - b) for a, b in zip(decoded[0], frame)) / (size * 255) for frame in decoded[1:])
    assert difference > .0001, ('decoded frames have no visible change', difference)
    return {'mime': declared_mime, 'container': probe['format']['format_name'], 'codec': stream['codec_name'],
            'decoded_frames': frames, 'duration_seconds': duration, 'decoded_samples': len(decoded),
            'unique_sample_frames': len(hashes), 'max_normalized_frame_difference': difference,
            'width': stream['width'], 'height': stream['height']}


def record_four_seconds(page, panel, kind, evidence):
    bar = player(panel)
    bar.locator('select').filter(has=page.locator('option[value="20"]')).select_option('4')
    # Capability cannot be replaced with a pretend movie in an acceptance run.
    expect(bar.locator('[data-playback-action="record"]')).to_be_enabled()
    path = download(page, bar.locator('[data-playback-action="record"]'), f'{kind}-4s', evidence)
    expect(bar).to_have_attribute('data-last-video-type', re.compile('^video/(mp4|webm)'))
    verified = decode_video(path, bar.get_attribute('data-last-video-type'))
    verified.update({'kind': kind, **file_evidence(path)})
    evidence['videos'].append(verified)


def motion_workflows(page, root, evidence):
    panel = choose(root, 'motion')
    wait_scene(panel, 'motion')
    expected_q = {'gentle': .12, 'strong': .55, 'orbitPreset': .25, 'flight': .3, 'phases': .4, 'unstable': 1.05}
    for name, q in expected_q.items():
        panel.locator('[data-motion-preset]').select_option(name)
        panel.locator('[data-motion-action="preset"]').click()
        page.wait_for_function("([q])=>Math.abs(Number(document.querySelector('[name=\"ms-q\"]').value)-q)<1e-12", arg=[q])
        wait_scene(panel, 'motion')
        saved = model(page, root, 'motion', name, evidence)
        assert saved['inputs']['ms-mode'] == 'direct'
        assert abs(saved['result']['shared']['q'] - q) < 1e-12
        if name == 'flight':
            samples = saved['result']['samples']; z0 = samples[0]['z_mm']; vz = samples[0]['vz_mm_per_us']
            assert vz != 0
            for row in samples[::max(1, len(samples) // 15)]:
                assert math.isclose(row['z_mm'], z0 + vz * row['time_us'], rel_tol=1e-12, abs_tol=1e-10)
            assert saved['result']['axial_model'].startswith('free drift')
        elif name == 'phases':
            comparison = saved['result']['phase_comparison']; assert len(comparison) == 3
            assert len({round(r['samples'][-1]['x_mm'], 8) for r in comparison}) > 1
        elif name == 'unstable':
            assert saved['result']['alive'] is False and saved['result']['loss_cycle'] is not None
        evidence['presets'].append({'preset': name, 'q': q, 'alive': saved['result']['alive']})

    panel.locator('[data-motion-preset]').select_option('gentle')
    panel.locator('[data-motion-action="preset"]').click()
    page.wait_for_function("Number(document.querySelector('[name=\"ms-q\"]').value)===.12")
    wait_scene(panel, 'motion')
    for view in VIEWS:
        root.locator('[name="rx-motion-view"]').select_option(view)
        expect(panel.locator('[data-motion-view]')).to_have_attribute('data-motion-view', view)
        wait_scene(panel, 'motion')
        seek(panel, .2); before = geometry_signature(stage(panel, 'motion').locator('svg'))
        seek(panel, .8); after = geometry_signature(stage(panel, 'motion').locator('svg'))
        if view != 'axial':
            assert before != after, (view, 'animation changed no visible geometry')
        # In this baseline v_z=0, the axial plot must remain a stationary line;
        # the flight preset separately verifies a moving nonzero-z trajectory.
        assert panel.locator(f'[data-rfx-error="motion"]').inner_text() == ''
        if view == 'spectrum':
            saved = model(page, root, 'motion', 'spectrum', evidence)
            assert saved['result']['spectrum']['window'] == 'Hann'
            assert saved['result']['spectrum']['resolution_MHz'] > 0
            assert saved['result']['spectrum']['source_samples'] > 100
        evidence['views'].append(view)

    panel.locator('[data-motion-preset]').select_option('flight')
    panel.locator('[data-motion-action="preset"]').click()
    expect(panel.locator('[data-motion-view]')).to_have_attribute('data-motion-view', 'spatial')
    wait_scene(panel, 'motion')
    camera = panel.locator('.rfq-motion-camera')
    before_data = model(page, root, 'motion', 'camera-before', evidence)['result']['samples']
    before_svg = geometry_signature(stage(panel, 'motion').locator('svg'))
    stage(panel, 'motion').focus(); stage(panel, 'motion').press('ArrowRight')
    expect(camera.locator('input[type="range"]').first).to_have_value('-30')
    settled(panel.locator('[data-rfx-figure="motion"]'))
    assert before_svg != geometry_signature(stage(panel, 'motion').locator('svg'))
    after_data = model(page, root, 'motion', 'camera-after', evidence)['result']['samples']
    assert before_data == after_data, 'camera rotation changed integrated physical trajectory'
    stage(panel, 'motion').press('r')
    expect(camera.locator('input[type="range"]').first).to_have_value('-35')

    # Real playback advances geometry and can be paused without rebuilding it.
    seek(panel, 0)
    player(panel).locator('[data-playback-action="play"]').click()
    page.wait_for_function("Number(document.querySelector('[data-rfq-playback=\"rfq-motion-spatial\"]').dataset.fraction)>.08")
    player(panel).locator('[data-playback-action="play"]').click()
    paused = player(panel).get_attribute('data-fraction')
    settled(panel.locator('[data-rfx-figure="motion"]'))
    assert player(panel).get_attribute('data-fraction') == paused
    check_frame_exports(page, panel, 'motion', evidence)
    record_four_seconds(page, panel, 'motion', evidence)


def scene_workflows(page, root, evidence):
    # Scan calculations use physical voltages, so exit direct mode explicitly.
    root.locator('[name="ms-mode"]').select_option('voltage')
    for kind in ('gas', 'bunch', 'scan'):
        panel = choose(root, kind)
        wait_scene(panel, kind)
        seek(panel, .15)
        first = stage(panel, kind).locator('svg').evaluate('e=>({...e.dataset})')
        geometry1 = geometry_signature(stage(panel, kind).locator('svg'))
        seek(panel, .8)
        last = stage(panel, kind).locator('svg').evaluate('e=>({...e.dataset})')
        assert geometry_signature(stage(panel, kind).locator('svg')) != geometry1, (kind, 'static scene')
        if kind == 'gas':
            assert float(last['sceneTimeMs']) > float(first['sceneTimeMs'])
            assert float(last['sceneEnergyEv']) < float(first['sceneEnergyEv'])
        elif kind == 'bunch':
            assert float(last['sceneDriftFraction']) > float(first['sceneDriftFraction'])
            assert float(last['sceneSigmaNs']) >= float(first['sceneSigmaNs'])  # baseline rho=0
        else:
            assert int(last['sceneIndex']) > int(first['sceneIndex'])
            assert float(last['sceneQ']) > float(first['sceneQ'])  # baseline voltage scan
        check_frame_exports(page, panel, kind, evidence)
        record_four_seconds(page, panel, kind, evidence)
        evidence['scenes'].append({'kind': kind, 'first_frame': first, 'last_frame': last})


def example_workflows(page, root, evidence):
    manifest = json.loads((REPO / 'static/data/rfq-examples/manifest.json').read_text())
    panel = choose(root, 'data'); controls = panel.locator('[data-rfq-example-controls]')
    select = controls.locator('[name="rx-example"]')
    expect(select).to_be_enabled(timeout=15000)
    expect(select.locator('option')).to_have_count(10)
    for item in manifest['examples']:
        select.select_option(item['id'])
        path = download(page, controls.locator('a[download]'), 'catalog-' + item['id'], evidence)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
        assert len(list(csv.DictReader(io.StringIO(path.read_text())))) == item['count']
        controls.locator('button').click()
        expect(panel.locator('[data-rfx-data-source]')).to_contain_text(item['id'])
        saved = model(page, root, 'data', 'loaded-' + item['id'], evidence)['result']
        assert saved['teaching_example']['origin'] == 'synthetic-teaching'
        for key, expected in item['expected'].items():
            actual = saved[key]
            if expected is None:
                assert actual is None, (item['id'], key)
            else:
                assert math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-10), (item['id'], key, actual, expected)
        evidence['examples'].append({'id': item['id'], 'count': saved['count'], 'source_sha256': item['sha256']})

    # The final tilted spot has all four columns; exercise all six views.
    view = root.locator('[name="rx-data-view"]')
    for name in ('scatter', 'histogram', 'energy-histogram', 'xy-spot', 'event-time', 'event-energy'):
        view.select_option(name)
        panel.locator('[data-rfx-action="run"]').click()
        expect(panel.locator('[data-rfx-error="data"]')).to_be_empty()
        settled(panel.locator('[data-rfx-figure="data"]'))
        evidence['data_views'].append(name)

    # Missing coordinates produce a contextual error, never a fabricated spot.
    select.select_option('narrow'); controls.locator('button').click()
    expect(panel.locator('[data-rfx-data-source]')).to_contain_text('narrow')
    view.select_option('xy-spot'); panel.locator('[data-rfx-action="run"]').click()
    expect(panel.locator('[data-rfx-error="data"]')).to_contain_text('requires x_mm and y_mm')
    select.select_option('tilted-spot'); controls.locator('button').click()
    expect(panel.locator('[data-rfx-data-source]')).to_contain_text('tilted-spot')
    expect(panel.locator('[data-rfx-error="data"]')).to_be_empty()


GEOMETRY_CHECK = r"""svg => {
  const n=(e,k)=>Number(e.getAttribute(k));
  const aperture=svg.querySelector('circle[data-rfq-aperture]');
  const rods=[...svg.querySelectorAll('circle[data-rfq-rod]')];
  const cx=n(aperture,'cx'),cy=n(aperture,'cy');
  const right=rods.reduce((a,b)=>n(a,'cx')>n(b,'cx')?a:b);
  const top=rods.reduce((a,b)=>n(a,'cy')<n(b,'cy')?a:b);
  const bottom=rods.reduce((a,b)=>n(a,'cy')>n(b,'cy')?a:b);
  const radius=svg.querySelector('line[data-rfq-dimension="inscribed-radius"]');
  const diameter=svg.querySelector('line[data-rfq-dimension="aperture-diameter"]');
  const radiusLength=Math.hypot(n(radius,'x2')-n(radius,'x1'),n(radius,'y2')-n(radius,'y1'));
  const diameterLength=Math.hypot(n(diameter,'x2')-n(diameter,'x1'),n(diameter,'y2')-n(diameter,'y1'));
  return {rods:rods.length,radiusLength,diameterLength,ratio:diameterLength/radiusLength,
    originError:Math.hypot(n(radius,'x1')-cx,n(radius,'y1')-cy),
    radiusSurfaceError:Math.hypot(n(radius,'x2')-(n(right,'cx')-n(right,'r')),n(radius,'y2')-n(right,'cy')),
    diameterTopError:Math.hypot(n(diameter,'x1')-n(top,'cx'),n(diameter,'y1')-(n(top,'cy')+n(top,'r'))),
    diameterBottomError:Math.hypot(n(diameter,'x2')-n(bottom,'cx'),n(diameter,'y2')-(n(bottom,'cy')-n(bottom,'r')))};
}"""


MATH_CHECK = r"""guide => [...guide.querySelectorAll('[data-rfq-equation]')].map(box => {
  const math=box.querySelector('math'),rect=math?.getBoundingClientRect();
  return {key:box.dataset.rfqEquation,namespace:math?.namespaceURI,
    width:rect?.width||0,height:rect?.height||0,alt:math?.getAttribute('alttext')||'',
    text:math?.textContent.trim()||'',nativeMath:CSS.supports('math-style','normal'),
    fractions:[...box.querySelectorAll('mfrac')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};})};
})"""


def fundamentals(page, panel, kind, language, width, evidence):
    guide = panel.locator(f'[data-rfq-basics="{kind}"]')
    expect(guide).to_be_visible()
    if guide.get_attribute('open') is None:
        guide.locator(':scope > summary').click()
    for section in guide.locator('details.rfq-guide-section').all():
        if section.get_attribute('open') is None:
            section.locator(':scope > summary').click()
    data = json.loads((REPO / 'data/rfq_cooling_bunch_basics.json').read_text())
    expected = [block['key'] for section in data[language][kind] for block in section['blocks'] if block['type'] == 'equation']
    expect(guide.locator('[data-rfq-equation]')).to_have_count(len(expected))
    page.evaluate('document.fonts.ready')
    equations = guide.evaluate(MATH_CHECK)
    assert [equation['key'] for equation in equations] == expected
    for equation in equations:
        assert equation['namespace'] == 'http://www.w3.org/1998/Math/MathML' and equation['nativeMath'], equation
        assert equation['width'] > 8 and equation['height'] > 8 and equation['alt'] and equation['text'], equation
        assert '\\frac' not in equation['text'] and '<mrow>' not in equation['text'], equation
        assert all(fraction['width'] > 0 and fraction['height'] > 0 for fraction in equation['fractions']), equation
    # Long equations may use their own horizontal scroller; opening the full
    # derivation must never make the entire document scroll sideways.
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), (language, width, kind, 'open guide overflow')
    path = ART / f'{language}-{width}-{kind}-fundamentals.png'
    guide.screenshot(path=str(path))
    evidence['fundamentals'].append({'language': language, 'viewport': width, 'kind': kind,
        'equations': equations, 'screenshot': path.name})


def layouts(browser, evidence):
    for language, width in ((lang, size) for lang in ('en', 'zh') for size in (320, 390, 1440)):
        context = browser.new_context(viewport={'width': width, 'height': 950})
        page = context.new_page()
        page.goto(BASE + ('' if language == 'en' else 'zh-hans/') + 'lab/', wait_until='domcontentloaded', timeout=60000)
        root = page.locator('#rfq-workbench'); expect(root).to_be_visible(timeout=30000)
        checks = [('design', None), ('motion', 'spatial'), ('motion', 'filtered'), ('motion', 'spectrum'), ('gas', None), ('bunch', None), ('scan', None)]
        for kind, view in checks:
            panel = choose(root, kind)
            if kind == 'design':
                container = panel.locator('[data-ms-design-figure]')
            elif kind == 'motion':
                root.locator('[name="rx-motion-view"]').select_option(view)
                expect(panel.locator('[data-motion-view]')).to_have_attribute('data-motion-view', view)
                wait_scene(panel, kind); container = stage(panel, kind)
            else:
                wait_scene(panel, kind); container = stage(panel, kind)
            page.wait_for_function('document.fonts.status === "loaded"')
            settled(panel.locator(f'[data-rfx-figure="{kind}"]') if kind != 'design' else container)
            svg = container.locator('svg'); checked = svg.evaluate(CHART_CHECK)
            assert not checked['clipped'], (language, width, kind, view, checked['clipped'])
            assert not checked['collisions'], (language, width, kind, view, checked['collisions'])
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), (language, width, kind, view)
            if kind == 'design':
                geometry = svg.evaluate(GEOMETRY_CHECK)
                assert geometry['rods'] == 4 and abs(geometry['ratio'] - 2) < 1e-10
                for key in ('originError', 'radiusSurfaceError', 'diameterTopError', 'diameterBottomError'):
                    assert geometry[key] < 1e-7, (language, width, key, geometry[key])
                evidence['geometry'].append({'language': language, 'width': width, **geometry})
            path = ART / f'{language}-{width}-{kind}-{view or "scene"}.png'
            svg.screenshot(path=str(path))
            evidence['layout'].append({'language': language, 'viewport': width, 'kind': kind, 'view': view, **checked})
            if kind in ('gas', 'bunch') and width in (320, 1440):
                fundamentals(page, panel, kind, language, width, evidence)
        context.close()


def run():
    ART.mkdir(parents=True, exist_ok=True)
    evidence = {'started_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'base_url': BASE,
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
        'evidence_kind': 'real browser UI and actual decoded MediaRecorder files; no experimental measurements',
        'exports': [], 'videos': [], 'presets': [], 'views': [], 'scenes': [], 'examples': [], 'data_views': [],
        'geometry': [], 'layout': [], 'fundamentals': [], 'failures': []}
    try:
        for binary in ('ffprobe', 'ffmpeg'):
            assert shutil.which(binary), f'{binary} must be installed before the browser acceptance run'
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            evidence['browser'] = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
            page = context.new_page(); errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + 'lab/', wait_until='domcontentloaded', timeout=60000)
            root = page.locator('#rfq-workbench'); expect(root).to_be_visible(timeout=30000)
            motion_workflows(page, root, evidence)
            scene_workflows(page, root, evidence)
            example_workflows(page, root, evidence)
            assert not errors, errors
            context.close()
            layouts(browser, evidence)
            browser.close()
        evidence['passed'] = True
    except Exception:
        evidence['passed'] = False; evidence['failures'].append(traceback.format_exc())
    finally:
        (ART / 'report.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': evidence['passed'], 'report': str(ART / 'report.json'),
                      'videos': len(evidence['videos']), 'examples': len(evidence['examples']), 'layout_cases': len(evidence['layout'])}))
    if not evidence['passed']:
        raise SystemExit(evidence['failures'][-1])


if __name__ == '__main__':
    run()
