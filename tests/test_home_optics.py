"""Primary-source figure and actual six-language homepage shortcode contract."""
import json
import os
import re
from pathlib import Path
import shutil
import struct
import subprocess
from html.parser import HTMLParser
from urllib.parse import urljoin

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
    assert d["ring_context"]["circumference_approx_m"] == 60
    assert d["ring_context"]["simulated_turns"] == 1900
    assert "facility_source" not in d
    assert (ROOT / "static" / d["vector_pdf"]).read_bytes().startswith(b"%PDF-")
    raw = (ROOT / "static" / d["image"]).read_bytes()
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")
    assert struct.unpack(">II", raw[16:24]) == (d["width"], d["height"])
    assert d["width"] >= 1400
    assert set(d["text"]) == set(LANGS)
    for lang, values in d["text"].items():
        for field in ("title", "short_title", "short_caption", "caption"):
            assert isinstance(values[field], str) and values[field].strip(), (lang, field)
        assert not set(values).intersection({"purpose", "inputs", "outputs", "gain", "hint", "limits"})
        assert len(values["paragraphs"]) >= 3
        assert all(isinstance(x, str) and x.strip() for x in values["paragraphs"])
    for lang in LANGS:
        home = (ROOT / "content" / lang / "_index.md").read_text()
        assert home.count("{{< home-optics >}}") == 1
        assert home.index('{{< gallery home="true" >}}') < home.index("{{< home-optics >}}")
        assert (ROOT / "content" / lang / "research.md").read_text().count('{{< home-optics detail="true" >}}') == 1


class OpticsMarkup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.images, self.links, self.figcaptions = [], [], [], []
        self._caption = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "img":
            self.images.append(a)
        if tag == "a":
            self.links.append(a)
        if tag == "figcaption":
            self._caption = []

    def handle_data(self, data):
        if self._caption is not None:
            self._caption.append(data)

    def handle_endtag(self, tag):
        if tag == "figcaption" and self._caption is not None:
            self.figcaptions.append("".join(self._caption))
            self._caption = None


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
    (tmp_path / "layouts/page.html").write_text("<main>{{ .Content }}</main>")
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in LANGS:
        folder = tmp_path / "content" / lang
        folder.mkdir(parents=True)
        (folder / "_index.md").write_text('---\ntitle: Home\n---\n{{< home-optics >}}\n')
        research = (ROOT / "content" / lang / "research.md").read_text()
        jump = re.findall(r"\[[^\]]+\]\(#beam-line-optics\)", research)
        assert len(jump) == 1
        assert research.index(jump[0]) < research.index("{{< gallery >}}")
        (folder / "research.md").write_text('---\ntitle: Research\n---\n' + jump[0] + '\n\n{{< home-optics detail="true" >}}\n')
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
        assert parsed.ids.count("beam-line-optics-guide") == 0
        assert parsed.ids.count("beam-line-optics-caption") == 1
        assert len(parsed.figcaptions) == 1
        assert parsed.figcaptions[0] == d["text"][lang]["short_title"] + d["text"][lang]["short_caption"]
        assert d["text"][lang]["short_title"] in html
        assert d["text"][lang]["paragraphs"][0] not in html
        assert d["source"]["citation"] not in html
        assert any(a.get("href", "").endswith("research/#beam-line-optics") for a in parsed.links)
        assert len(parsed.images) == 1
        image = parsed.images[0]
        assert image["alt"] == d["text"][lang]["caption"]
        assert image["width"] == str(d["width"]) and image["height"] == str(d["height"])
        for asset in (d["image"], d["vector_pdf"]):
            assert (tmp_path / "public" / asset).read_bytes() == (ROOT / "static" / asset).read_bytes()
        detailed_path = tmp_path / "public" / ("" if lang == "en" else lang) / "research/index.html"
        detailed = detailed_path.read_text()
        detail = OpticsMarkup(detailed)
        assert len(detail.ids) == len(set(detail.ids))
        assert detail.ids.count("beam-line-optics-guide") == 1
        research_url = "https://example.test/traps.github.io/" + ("" if lang == "en" else lang + "/") + "research/"
        assert any(urljoin(research_url, a.get("href", "")) == research_url + "#beam-line-optics" for a in detail.links)
        assert detail.figcaptions == [d["text"][lang]["caption"]]
        assert d["text"][lang]["short_caption"] not in detailed
        assert d["text"][lang]["title"] in detailed
        assert d["source"]["citation"] in detailed
        assert all(paragraph in detailed for paragraph in d["text"][lang]["paragraphs"])
        assert '<dl' not in detailed and 'class="zg-control-help"' not in detailed
        assert any(a.get("href") == d["source"]["url"] for a in detail.links)
        assert not any(".pdf" in a.get("href", "").lower() for a in parsed.links + detail.links)
        assert "114003" not in html + detailed and "adf1f5" not in html + detailed


def test_short_home_caption_names_two_methods_and_localized_transport_colour_key():
    d = json.loads((ROOT / "data/home_optics.json").read_text())
    localized = {
        "en": ("beam-line", "storage ring", "Beam-transport simulation", "red/green/blue", "+0.3%/0%/−0.3%"),
        "zh": ("束流线", "储存环", "束流传输模拟", "红／绿／蓝", "+0.3%／0%／−0.3%"),
        "fi": ("suihkulinjan", "varastorenkaan", "Suihkunsiirron simulaatio", "punainen/vihreä/sininen", "+0,3 %/0 %/−0,3 %"),
        "de": ("Strahlführung", "Speicherring", "Strahltransportsimulation", "Rot/Grün/Blau", "+0,3 %/0 %/−0,3 %"),
        "ja": ("ビームライン", "蓄積リング", "ビーム輸送シミュレーション", "赤・緑・青", "+0.3%・0%・−0.3%"),
        "fr": ("ligne de faisceau", "anneau de stockage", "Simulation du transport", "rouge/vert/bleu", "+0,3 %/0 %/−0,3 %"),
    }
    for lang, tokens in localized.items():
        caption = d["text"][lang]["short_caption"]
        assert all(token in caption for token in tokens), lang
        assert all(token in caption for token in ("Bρ–TOF", "IMS", "¹⁰⁰Sn", "175 MeV/u", "δp/p")), lang
        assert len(caption) < 300, lang
        assert "http" not in caption and "2019" not in caption
    assert len({v["short_caption"] for v in d["text"].values()}) == len(LANGS)
