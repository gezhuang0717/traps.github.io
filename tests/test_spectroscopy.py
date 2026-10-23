"""Offline spectroscopy data and actual-shortcode contracts; no network or full-site build."""
import json
import math
import os
import re
import shutil
import subprocess
from datetime import date
from fractions import Fraction
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")
DATA = yaml.safe_load((ROOT / "data/spectroscopy.yaml").read_text(encoding="utf-8"))


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def https_url(value):
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname)


def test_every_selected_record_resolves_to_attributed_dated_sources():
    sources = {source["id"]: source for source in DATA["sources"]}
    records = DATA["charge_radii"] + DATA["moments"] + DATA["nuclear_schemes"]
    assert records
    for record in records:
        assert record["source_id"] in sources, record
    for source in sources.values():
        for key in ("title", "status", "licence", "evaluation_date", "retrieved_date"):
            assert isinstance(source[key], str) and source[key].strip(), (source["id"], key)
        assert https_url(source["url"])
        assert https_url(source["terms_url"])
        assert re.fullmatch(r"\d{4}(?:-\d{2}-\d{2})?", source["evaluation_date"])
        retrieved = date.fromisoformat(source["retrieved_date"])
        evaluated = date.fromisoformat(source["evaluation_date"] if len(source["evaluation_date"]) == 10
                                      else source["evaluation_date"] + "-01-01")
        assert evaluated <= retrieved, source["id"]
    for scheme in DATA["nuclear_schemes"]:
        assert https_url(sources[scheme["source_id"]]["gamma_url"]), scheme["nuclide"]


def test_radius_and_moment_records_keep_state_units_and_reported_uncertainties():
    for collection in (DATA["charge_radii"], DATA["moments"]):
        assert collection
        for record in collection:
            assert isinstance(record["state"], str) and record["state"].strip()
            assert isinstance(record["A"], int) and isinstance(record["Z"], int)
            assert 0 < record["Z"] <= record["A"]
    for record in DATA["charge_radii"]:
        assert finite(record["r_fm"]) and 0 < record["r_fm"] < 20
        assert finite(record["sigma_fm"]) and 0 <= record["sigma_fm"] < record["r_fm"]
    for record in DATA["moments"]:
        assert finite(record["mu_muN"])
        assert finite(record["sigma_muN"]) and record["sigma_muN"] >= 0
        spin = Fraction(str(record["spin"]))
        assert spin >= 0 and (2 * spin).denominator == 1
        assert record["spin_parity"]
    # Frozen reference cases detect fm/mean-square and nuclear-magneton/SI unit drift.
    ca40 = next(row for row in DATA["charge_radii"] if (row["element"], row["A"], row["state"]) == ("Ca", 40, "ground"))
    assert ca40["r_fm"] == 3.4776 and ca40["sigma_fm"] == 0.0019
    ca43 = next(row for row in DATA["moments"] if (row["element"], row["A"], row["state"]) == ("Ca", 43, "ground"))
    assert ca43["mu_muN"] == -1.31733 and ca43["sigma_muN"] == 0.00006
    assert Fraction(ca43["spin"]) == Fraction(7, 2)


def test_nuclear_scheme_preserves_source_gamma_energies_and_unknown_uncertainties():
    for scheme in DATA["nuclear_schemes"]:
        levels = {level["id"]: level for level in scheme["levels"]}
        assert levels
        for level in levels.values():
            assert finite(level["energy_keV"]) and level["energy_keV"] >= 0
            assert level["spin_parity"]
            assert "sigma_energy_keV" in level
            sigma = level["sigma_energy_keV"]
            assert sigma is None or (finite(sigma) and sigma >= 0)
        for transition in scheme["transitions"]:
            assert transition["from"] in levels and transition["to"] in levels
            assert levels[transition["from"]]["energy_keV"] > levels[transition["to"]]["energy_keV"]
            assert finite(transition["energy_keV"]) and transition["energy_keV"] > 0
            assert "sigma_energy_keV" in transition
            sigma = transition["sigma_energy_keV"]
            assert sigma is None or (finite(sigma) and sigma >= 0)
    carbon = next(scheme for scheme in DATA["nuclear_schemes"] if scheme["nuclide"] == "12C")
    levels = {level["id"]: level for level in carbon["levels"]}
    assert levels["c12-0"]["sigma_energy_keV"] is None
    assert (levels["c12-1"]["energy_keV"], levels["c12-1"]["sigma_energy_keV"]) == (4439.82, 0.21)
    expected = {("c12-1", "c12-0"): 4438.94, ("c12-2", "c12-1"): 3213.79, ("c12-3", "c12-0"): 9637}
    transitions = {(row["from"], row["to"]): row for row in carbon["transitions"]}
    for endpoints, gamma_energy in expected.items():
        transition = transitions[endpoints]
        assert transition["energy_keV"] == gamma_energy
        assert transition["sigma_energy_keV"] is None  # Unknown is not zero or propagated level error.
        level_difference = levels[endpoints[0]]["energy_keV"] - levels[endpoints[1]]["energy_keV"]
        assert not math.isclose(gamma_energy, level_difference, rel_tol=0, abs_tol=0.001)


def test_trail_sits_after_the_chart_of_nuclei_and_before_the_trap_zoo_on_the_lab_page():
    shortcode = re.compile(r"{{[<%]\s*([\w-]+)\b[^}]*[>%]}}")
    for lang in LANGS:
        read = lambda name: (ROOT / "content" / lang / name).read_text(encoding="utf-8")
        research, games, lab = read("research.md"), read("games.md"), read("lab.md")
        codes = lambda text: [m.group(1) for m in shortcode.finditer(text)]
        research_codes, games_codes, lab_codes = codes(research), codes(games), codes(lab)
        assert research_codes.count("spectroscopy-tools") == 1, lang
        assert "spectroscopy-games" not in research_codes and "spectroscopy-games" not in games_codes, lang
        assert research_codes[-1] == "trap-zoo" and research_codes.count("trap-zoo") == 1, lang
        assert not research[list(shortcode.finditer(research))[-1].end():].strip(), lang
        assert games_codes[-1] == "games", lang
        assert lab_codes.count("spectroscopy-games") == 1 and lab_codes.count("trap-zoo") == 1, lang
        assert lab_codes.index("nuclide-chart") < lab_codes.index("spectroscopy-games") < lab_codes.index("trap-zoo"), lang
        assert lab_codes[-1] == "trap-zoo", lang
        assert "../lab/#spectroscopy-trail" in research, lang


class SpectroscopyMarkup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.widgets = []
        self.scripts = []
        self.links = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "section" and "data-spectroscopy" in attrs:
            self.widgets.append(attrs)
        if tag == "script" and "src" in attrs:
            self.scripts.append(attrs)
        if tag == "link" and "href" in attrs:
            self.links.append(attrs)


def test_actual_shortcode_build_retains_json_nulls_languages_and_usable_assets(tmp_path):
    hugo = os.environ.get("HUGO_TEST_BIN") or shutil.which("hugo")
    if not hugo:
        pytest.skip("Pinned Hugo required; installed in CI before tests")
    assets = ["static/js/zg-export.js", "static/js/spectroscopy-core.js", "static/js/spectroscopy.js",
              "static/css/spectroscopy.css", "static/js/spectroscopy-settings.js", "static/js/spectroscopy-uncertainty.js", "static/js/spectroscopy-fr.js"]
    for relative in ["layouts/_shortcodes/spectroscopy-tools.html", "data/spectroscopy.yaml",
                     "data/laser_cooling.yaml"] + assets:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / relative).read_bytes())
    (tmp_path / "layouts/single.html").write_text("{{ .Content }}", encoding="utf-8")
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in LANGS:
        content = tmp_path / "content" / lang
        content.mkdir(parents=True)
        (content / "fixture.md").write_text('---\ntitle: Spectroscopy fixture\n---\n{{< spectroscopy-tools >}}\n', encoding="utf-8")
        config.extend([f"[languages.{lang}]", f'contentDir="content/{lang}"'])
    (tmp_path / "hugo.toml").write_text("\n".join(config) + "\n", encoding="utf-8")
    cache = tmp_path / "hugo-cache"
    cache.mkdir()
    result = subprocess.run([hugo, "--source", str(tmp_path), "--destination", str(tmp_path / "public"),
                             "--cacheDir", str(cache), "--noBuildLock"],
                            env={**os.environ, "GOMAXPROCS": "1", "GOMEMLIMIT": "96MiB", "TMPDIR": str(tmp_path)},
                            capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
    cooling = yaml.safe_load((ROOT / "data/laser_cooling.yaml").read_text(encoding="utf-8"))["species"]
    for lang in LANGS:
        base = tmp_path / "public" / ("" if lang == "en" else lang)
        markup = SpectroscopyMarkup((base / "fixture/index.html").read_text(encoding="utf-8"))
        assert len(markup.widgets) == 1, lang
        widget = markup.widgets[0]
        assert widget["data-lang"] == lang
        assert json.loads(widget["data-values"]) == DATA, lang
        assert json.loads(widget["data-cooling"]) == cooling, lang
        script_names = [Path(urlparse(script["src"]).path).name for script in markup.scripts]
        assert script_names.index("spectroscopy-core.js") < script_names.index("spectroscopy.js")
        assert all("defer" in script for script in markup.scripts)
        assert "zg-export.js" in script_names
        for asset in assets:
            published = tmp_path / "public" / asset.removeprefix("static/")
            assert published.read_bytes() == (ROOT / asset).read_bytes(), asset
        assert any(Path(urlparse(link["href"]).path).name == "spectroscopy.css" for link in markup.links)
