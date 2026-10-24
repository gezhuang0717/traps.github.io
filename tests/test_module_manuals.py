"""Public short guides contain real native math and portable publication sources."""
from pathlib import Path
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'static/manuals'
BAD = re.compile(rb'/Volumes/|/Users/|file://')
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def test_four_public_guides_preserve_math_and_use_revtex_single_column():
    manifest = json.loads((OUT / 'MODULE_GUIDES_MANIFEST.json').read_text())
    assert len(manifest['guides']) == 4
    for guide in manifest['guides']:
        stem = OUT / guide['name']; expected = guide['math_elements']
        html = stem.with_suffix('.html').read_text()
        assert len(re.findall(r'<math(?:\s|>)', html)) == expected > 5
        assert '<script' not in html.lower() and 'mathjax' not in html.lower()
        assert 'Times New Roman' in html and 'Songti SC' in html
        tex = re.sub(r'\s+', '', stem.with_suffix('.tex').read_text())
        assert r'\documentclass[aps,onecolumn,11pt]{revtex4-2}' in tex
        for item in guide['files']:
            payload = (OUT / item['name']).read_bytes()
            assert hashlib.sha256(payload).hexdigest() == item['sha256']
            if item['name'].endswith('.docx'):
                with zipfile.ZipFile(OUT / item['name']) as archive:
                    for name in archive.namelist():
                        if name.endswith(('.xml', '.rels')): assert not BAD.search(archive.read(name))
                    doc = ET.fromstring(archive.read('word/document.xml'))
                    assert len(list(doc.iter(M + 'oMath'))) == expected
                    assert not list(doc.iter(W + 'drawing'))
                    styles = archive.read('word/styles.xml')
                    assert b'Times New Roman' in styles and b'Songti SC' in styles
            else: assert not BAD.search(payload)


def test_guides_explain_actual_conventions_reopening_and_limits():
    for lang in ('EN', 'ZH'):
        mathieu = (OUT / ('MATHIEU_STABILITY_' + lang + '.md')).read_text()
        cyclotron = (OUT / ('CYCLOTRON_COMPARE_' + lang + '.md')).read_text()
        assert all(x in mathieu for x in ['0.00347077', '241', '512', '1024', '13_Mathieu_stability.command', 'https://dlmf.nist.gov/28.17'])
        assert all(x in cyclotron for x in ['--sigma-B 0', 'cyclotron_rows.json', 'cyclotron_results.csv', '14_Cyclotron_comparison.command', '5.485799090441', 'm_{\\mathrm{ion}}'])
        assert 'https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt' in cyclotron
        assert not re.search(r'\]\((?:companion/|traplab_qt/|Individual_tools/)', mathieu + cyclotron)


def test_all_module_formats_are_linked_and_only_exact_public_filenames_are_unignored():
    ignore = (ROOT / '.gitignore').read_text()
    assert 'static/manuals/*' in ignore
    for lang in ('en', 'zh', 'fi', 'de', 'ja', 'fr'):
        page = (ROOT / 'content' / lang / 'manuals.md').read_text()
        for kind in ('MATHIEU_STABILITY', 'CYCLOTRON_COMPARE'):
            for edition in ('EN', 'ZH'):
                for ext in ('html', 'pdf', 'docx', 'tex', 'md'):
                    name = kind + '_' + edition + '.' + ext
                    assert (OUT / name).is_file()
                    assert 'manuals/' + name in page
                    assert '!static/manuals/' + name + '\n' in ignore
    assert '!static/manuals/MODULE_GUIDES_MANIFEST.json\n' in ignore


def test_six_current_pdfs_have_source_hashes_and_bounded_qa_records():
    mass = json.loads((OUT / 'MANIFEST.json').read_text())
    modules = json.loads((OUT / 'MODULE_GUIDES_MANIFEST.json').read_text())
    files = mass['files'] + [item for guide in modules['guides'] for item in guide['files']]
    pdfs = [item for item in files if item['name'].endswith('.pdf')]
    assert len(pdfs) == 6
    for item in pdfs:
        path = OUT / item['name']
        assert path.read_bytes().startswith(b'%PDF-')
        assert path.stat().st_size == item['bytes']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
        assert hashlib.sha256(path.with_suffix('.html').read_bytes()).hexdigest() == item['source_html_sha256']
        assert item['pages'] > 0 and item['qa']['status'] == 'pass'
        assert item['qa']['glyphs'] > 1000
        assert item['qa']['out_of_bounds_glyphs'] == item['qa']['private_token_matches'] == 0
        assert 'no raster or all-page visual QA' in item['qa']['method']
