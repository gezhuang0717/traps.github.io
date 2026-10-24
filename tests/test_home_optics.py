"""Primary-source figure and actual six-language homepage shortcode contract."""
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
from html.parser import HTMLParser

import pytest

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")


def test_figure_and_source_conditions_are_explicit_and_localized():
    d = json.loads((ROOT / "data/home_optics.json").read_text())
    assert d["schema_version"] == 1
    assert d["source"]["figure"] == 2 and d["source"]["pdf_page"] == 3 and d["source"]["journal_page"] == 296
    assert d["source"]["doi"] == "10.11804/NuclPhysRev.36.03.294"
    assert d["conditions"]["nuclide"] == "100Sn"
    assert d["conditions"]["kinetic_energy_MeVu"] == 175
    assert d["conditions"]["momentum_offsets_percent"] == [0.3, 0, -0.3]
    assert d["conditions"]["tof_baseline_F3_S0_m"] == 84
    assert d["ring_context"]["circumference_m"] == 60.4
    assert (ROOT / "static" / d["vector_pdf"]).read_bytes().startswith(b"%PDF-")
    raw = (ROOT / "static" / d["image"]).read_bytes()
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")
    assert struct.unpack(">II", raw[16:24]) == (d["width"], d["height"])
    assert d["width"] >= 1400
    assert set(d["text"]) == set(LANGS)
    for lang, values in d["text"].items():
        for field in ("title", "caption", "purpose", "inputs", "outputs", "gain", "hint", "limits"):
            assert isinstance(values[field], str) and values[field].strip(), (lang, field)
        assert len(values["paragraphs"]) >= 3
        assert all(isinstance(x, str) and x.strip() for x in values["paragraphs"])
    for lang in LANGS:
        assert (ROOT / "content" / lang / "_index.md").read_text().count("{{< home-optics >}}") == 1


class OpticsMarkup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.images, self.links = [], [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "img":
            self.images.append(a)
        if tag == "a":
            self.links.append(a)


def test_actual_homepage_figure_shortcode_renders_all_languages_and_usable_assets(tmp_path):
    hugo = os.environ.get("HUGO_TEST_BIN") or shutil.which("hugo")
    if not hugo:
        pytest.skip("Pinned Hugo required")
    d = json.loads((ROOT / "data/home_optics.json").read_text())
    paths = ["layouts/_shortcodes/home-optics.html", "layouts/_partials/zg/tool-workflows.html",
             "data/home_optics.json", "data/game_workflows.json", "data/lab_workflows.json",
             "static/js/tool-workflows.js", "static/css/tool-workflows.css",
             "static/" + d["image"], "static/" + d["vector_pdf"]]
    for path in paths:
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / path).read_bytes())
    (tmp_path / "layouts/home.html").write_text("<main>{{ .Content }}</main>")
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in LANGS:
        folder = tmp_path / "content" / lang
        folder.mkdir(parents=True)
        (folder / "_index.md").write_text('---\ntitle: Home\n---\n{{< home-optics >}}\n')
        config += [f"[languages.{lang}]", f'contentDir="content/{lang}"']
    (tmp_path / "hugo.toml").write_text("\n".join(config))
    result = subprocess.run([hugo, "--source", str(tmp_path), "--destination", str(tmp_path / "public"),
                             "--cacheDir", str(tmp_path / "cache"), "--noBuildLock"],
                            env={**os.environ, "GOMAXPROCS": "1", "GOMEMLIMIT": "96MiB", "TMPDIR": str(tmp_path)},
                            capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
    for lang in LANGS:
        path = tmp_path / "public" / ("" if lang == "en" else lang) / "index.html"
        html = path.read_text()
        parsed = OpticsMarkup(html)
        assert len(parsed.ids) == len(set(parsed.ids))
        assert parsed.ids.count("beam-line-optics") == 1
        assert parsed.ids.count("beam-line-optics-guide") == 1
        assert d["text"][lang]["title"] in html
        assert len(parsed.images) == 1
        image = parsed.images[0]
        assert image["alt"] == d["text"][lang]["caption"]
        assert image["width"] == str(d["width"]) and image["height"] == str(d["height"])
        for asset in (d["image"], d["vector_pdf"]):
            assert (tmp_path / "public" / asset).read_bytes() == (ROOT / "static" / asset).read_bytes()
        assert any(a.get("href") == d["source"]["url"] for a in parsed.links)
        assert any(a.get("href") == d["facility_source"]["url"] for a in parsed.links)
