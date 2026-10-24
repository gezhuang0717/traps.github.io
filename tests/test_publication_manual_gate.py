"""Manual books stay private; scientific application data remain publishable."""
import importlib.util
from pathlib import Path
import re

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('publication_manual_gate', ROOT / 'tools/publish.py')
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


class ArtifactTree(type(Path())):
    """Model Hugo/Linux output without ExFAT's automatically created sidecars."""
    def rglob(self, pattern):
        return (p for p in super().rglob(pattern) if not p.name.startswith('._'))


@pytest.mark.parametrize('name', ['MASS_FILTER_EQUATIONS_EN.pdf', 'MATHIEU_STABILITY_ZH.docx',
    'CYCLOTRON_COMPARE_EN.html', 'MASS_FILTER_EQUATIONS_ZH.tex', 'MANIFEST.json', 'index.html', 'nested/book.txt'])
def test_no_manual_name_format_manifest_or_index_is_approved(tmp_path, name):
    directory = tmp_path / 'manuals'; target = directory / name
    target.parent.mkdir(parents=True, exist_ok=True); target.write_text('Private manual content')
    for source in (False, True):
        hits = []; P.check_manual_directory(directory, 'manuals', hits, source=source)
        assert hits and any('private manual' in hit for hit in hits)


@pytest.mark.parametrize('route', ['manuals/index.html', 'fr/manuals/index.html',
    'manuals/MATHIEU_STABILITY_EN.pdf', 'books/scientific-handbook.html'])
def test_built_manual_assets_and_translated_landing_pages_fail_closed(tmp_path, monkeypatch, route):
    public = tmp_path / 'public'; path = public / route
    path.parent.mkdir(parents=True, exist_ok=True); path.write_text('Private book')
    monkeypatch.setattr(P, 'PUBLIC', ArtifactTree(public))
    gate = P.Gate(); P.inspect_public(gate)
    assert not gate.ok
    assert any('private manual' in item for result in gate.results for item in result['items'])


def test_king_csv_txt_json_examples_remain_allowed_and_readme_is_private(tmp_path, monkeypatch):
    public = tmp_path / 'public'; directory = public / 'data/research-examples/king'
    directory.mkdir(parents=True)
    for ext in ['csv', 'txt', 'json']:
        (directory / ('correlated.' + ext)).write_text('{}' if ext == 'json' else 'x,y,sx,sy,rho\n0,1,.05,.1,.2\n')
    monkeypatch.setattr(P, 'PUBLIC', ArtifactTree(public))
    gate = P.Gate(); P.inspect_public(gate); assert gate.ok
    (directory / 'README.md').write_text('Private example guide')
    gate = P.Gate(); P.inspect_public(gate); assert not gate.ok


def test_source_gate_blocks_private_static_readme_and_manuals(tmp_path, monkeypatch):
    monkeypatch.setattr(P, 'ROOT', tmp_path)
    folder = tmp_path / 'static/data/research-examples/king'; folder.mkdir(parents=True)
    (folder / 'README.md').write_text('Private example guide')
    gate = P.Gate(); P.check_privacy_sources(gate); assert not gate.ok
    (folder / 'README.md').unlink()
    manuals = tmp_path / 'static/manuals'; manuals.mkdir()
    (manuals / 'MASS_FILTER_EQUATIONS_EN.html').write_text('Private book')
    gate = P.Gate(); P.check_privacy_sources(gate); assert not gate.ok


def test_active_website_has_no_manual_routes_or_download_integration():
    for lang in ['en', 'zh', 'fi', 'de', 'ja', 'fr']:
        assert not (ROOT / 'content' / lang / 'manuals.md').exists()
    assert not (ROOT / 'layouts/_shortcodes/manual-download.html').exists()
    assert not (ROOT / 'static/data/research-examples/king/README.md').exists()
    for path in [*ROOT.joinpath('content').rglob('*.md'), *ROOT.joinpath('layouts').rglob('*.html')]:
        if path.name.startswith('._'): continue
        text = path.read_text()
        assert not re.search(r'(?:href\s*=\s*["\'][^"\']*manuals/|manual-download|"manuals/"\s*\|\s*relLangURL)', text), path
    js = (ROOT / 'static/js/spectroscopy.js').read_text()
    assert "libraryBase+'README.md'" not in js
    for stem in ['correlated', 'heteroscedastic', 'exact-x', 'ols', 'curved']:
        for ext in ['csv', 'txt', 'json']:
            assert (ROOT / 'static/data/research-examples/king' / (stem + '.' + ext)).is_file()
    assert not any(line.startswith('!static/manuals/') for line in (ROOT / '.gitignore').read_text().splitlines())
    for name in ['build_public_mass_manuals.py', 'build_module_manuals.py', 'check_public_manual_pdfs.py']:
        assert not (ROOT / 'tools' / name).exists()
