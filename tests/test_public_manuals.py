"""Public editions preserve checked math, keep portable links and expose real files."""
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlparse

import pytest

ROOT = Path(__file__).resolve().parents[1]
MANUALS = ROOT / "static/manuals"
BAD = re.compile(rb"/(?:Volumes|Users)/|file://|github\.com/gezhuang0717", re.I)
M = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def test_all_public_formats_have_equivalent_math_and_no_private_paths_or_local_hyperlinks():
    manifest = json.loads((MANUALS / "MANIFEST.json").read_text())
    assert manifest["equations_per_edition"] == 190
    for lang in ("EN", "ZH"):
        stem = MANUALS / ("MASS_FILTER_EQUATIONS_" + lang)
        html = stem.with_suffix(".html").read_text()
        assert len(re.findall(r"<math(?:\s|>)", html)) == 190
        layout = manifest["math_layout"][lang]
        assert layout["wrapped"] == layout["tex"]["wrapped"] == 16
        assert layout["tokens_preserved"] and layout["annotations_preserved"]
        assert html.count('displaystyle="true" scriptlevel="0"') == 16
        assert "<script" not in html.lower() and "mathjax" not in html.lower()
        assert "PingFang SC" in html and "11pt" in html
        tex = stem.with_suffix(".tex").read_text()
        assert r"\begin{document}" in tex and r"\end{document}" in tex
        assert "Arial" in tex and "Menlo" in tex
        for suffix in (".md", ".html", ".tex"):
            payload = stem.with_suffix(suffix).read_bytes()
            assert not BAD.search(payload), (lang, suffix)
        with zipfile.ZipFile(stem.with_suffix(".docx")) as archive:
            for name in archive.namelist():
                if name.endswith((".xml", ".rels")):
                    assert not BAD.search(archive.read(name)), name
            doc = ET.fromstring(archive.read("word/document.xml"))
            assert len(list(doc.iter(M + "oMath"))) == 190
            assert not list(doc.iter(W + "drawing"))
            styles = ET.fromstring(archive.read("word/styles.xml"))
            title = next(s for s in styles.iter(W + "style") if s.get(W + "styleId") == "Title")
            assert not list(title.iter(W + "pBdr"))
            assert b"PingFang SC" in archive.read("word/styles.xml")
        assert "https://doi.org/10.1088/1674-1137/abddb0" in html


def test_six_access_pages_only_link_existing_formats_and_real_king_examples():
    for lang in ("en", "zh", "fi", "de", "ja", "fr"):
        page = (ROOT / "content" / lang / "manuals.md").read_text()
        assert not BAD.search(page.encode())
        for link in re.findall(r'{{< manual-download "([^"]+)"', page):
            assert (ROOT / "static" / link).is_file(), (lang, link)
        for code in ("EN", "ZH"):
            assert "MASS_FILTER_EQUATIONS_" + code + ".docx" in page
        for case in ("correlated", "heteroscedastic", "exact-x", "ols", "curved"):
            assert all(case + "." + ext in page for ext in ("csv", "txt", "json"))
    shortcode = (ROOT / "layouts/_shortcodes/spectroscopy-tools.html").read_text()
    assert shortcode.count('"manuals/" | relLangURL') == 1
    assert '.Get 0 | relURL' in (ROOT / "layouts/_shortcodes/manual-download.html").read_text()


def test_public_markdown_retains_equation_count_and_module_labels_as_text():
    for lang in ("EN", "ZH"):
        text = (MANUALS / ("MASS_FILTER_EQUATIONS_" + lang + ".md")).read_text()
        assert "mass-surface.js" in text and "energies.py" in text
        assert not re.search(r"\]\((?:companion/|static/|inventory|sources\.json)", text)
        assert re.search(r"[0-9a-f]{64}", text)
        assert "38" in text and "28" in text


def test_built_download_links_keep_site_prefix_for_default_and_translated_routes(tmp_path):
    """Exercise Hugo relURL: EN has one fewer path segment than translated pages."""
    hugo = os.environ.get("HUGO_TEST_BIN") or shutil.which("hugo")
    if not hugo:
        pytest.skip("Pinned Hugo required")
    shortcodes = tmp_path / "layouts/_shortcodes"
    shortcodes.mkdir(parents=True)
    (shortcodes / "manual-download.html").write_text((ROOT / "layouts/_shortcodes/manual-download.html").read_text())
    (tmp_path / "layouts/single.html").write_text("{{ .Content }}")
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in ("en", "zh", "fi", "de", "ja", "fr"):
        content = tmp_path / "content" / lang
        content.mkdir(parents=True)
        (content / "manuals.md").write_text((ROOT / "content" / lang / "manuals.md").read_text())
        config += [f"[languages.{lang}]", f'contentDir="content/{lang}"']
    (tmp_path / "hugo.toml").write_text("\n".join(config) + "\n")
    result = subprocess.run([hugo, "--source", str(tmp_path), "--destination", str(tmp_path / "public"),
                             "--cacheDir", str(tmp_path / "cache"), "--noBuildLock"],
                            env={**os.environ, "GOMAXPROCS": "1", "GOMEMLIMIT": "96MiB", "TMPDIR": str(tmp_path)},
                            capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    for lang in ("en", "zh", "fi", "de", "ja", "fr"):
        route = "" if lang == "en" else lang + "/"
        page_url = "https://example.test/traps.github.io/" + route + "manuals/"
        html = (tmp_path / "public" / route / "manuals/index.html").read_text()
        links = re.findall(r'href="([^"]+)"', html)
        assert len(links) >= 24
        for link in links:
            path = urlparse(urljoin(page_url, link)).path
            assert path.startswith("/traps.github.io/"), (lang, path)
            assert (ROOT / "static" / path.removeprefix("/traps.github.io/")).is_file(), (lang, path)
