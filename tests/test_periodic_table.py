"""Checks for static/data/periodic-table.json (Games periodic-table panel and Mulberry GUI data)."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "static" / "data" / "periodic-table.json").read_text(encoding="utf-8"))
E = D["elements"]
LANGS = ["en", "zh", "fi", "de", "ja", "fr"]
BY = {e["sym"]: e for e in E}


def test_builder_reproduces_committed_json():
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "make_periodic_table.py"), "--check"],
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_118_unique_elements_and_grid_cells():
    assert [e["z"] for e in E] == list(range(1, 119))
    assert len({e["sym"] for e in E}) == 118
    assert len({(e["row"], e["col"]) for e in E}) == 118


def test_names_in_six_languages():
    for e in E:
        assert set(e["names"]) == set(LANGS), e["sym"]
        assert all(isinstance(v, str) and v.strip() for v in e["names"].values()), e["sym"]
    assert BY["Fe"]["names"]["de"] == "Eisen" and BY["Fe"]["names"]["ja"] == "鉄" and BY["Fe"]["names"]["fr"] == "Fer"


def test_origin_codes_valid_and_reference_cases():
    valid = set(D["i18n"]["origins"]["order"])
    for e in E:
        assert e["origin"] and set(e["origin"]) <= valid, e["sym"]
    assert BY["H"]["origin"] == ["b"]
    assert BY["Li"]["origin"] == ["b", "j", "y"]
    assert BY["Fe"]["origin"] == ["g", "c"]  # massive stars + white dwarfs, not 'neutron-star mergers' only
    assert BY["Au"]["origin"] == ["y", "o"]
    assert BY["U"]["origin"] == ["o"] and not BY["U"]["trace"]
    assert all(BY[s]["origin"] == ["z"] for s in ("Tc", "Pm", "Am", "Lr", "Og"))
    assert BY["Po"]["trace"] and BY["Ra"]["trace"] and not BY["Th"]["trace"]


def test_origin_classes_have_text_in_six_languages():
    o = D["i18n"]["origins"]
    for lang in LANGS:
        assert set(o["label"][lang]) == set(o["order"]) == set(o["desc"][lang])
        assert lang in o["trace"]
    assert set(o["color"]) == set(o["order"])


def test_isotope_sums_within_0_1_percent_and_fixes():
    for e in E:
        if e["iso"]:
            assert abs(sum(i["pct"] for i in e["iso"]) - 100.0) <= 0.1, (e["sym"], sum(i["pct"] for i in e["iso"]))
    assert {i["a"]: i["pct"] for i in BY["Cd"]["iso"]}[113] == 12.22
    se = {i["a"]: i["pct"] for i in BY["Se"]["iso"]}
    assert se[76] == 9.37 and se[77] == 7.63


def test_ionisation_and_affinity_are_in_ev():
    for e in E:
        if e["ie"] is not None:
            assert 3.0 < e["ie"] < 25.0, (e["sym"], e["ie"])  # Cs 3.894 ... He 24.587 eV
        if e["ea"] is not None:
            assert 0.0 <= e["ea"] < 3.7, (e["sym"], e["ea"])  # Cl 3.617 eV is the maximum
    for sym, ie in {"H": 13.598, "He": 24.587, "Li": 5.392, "C": 11.260, "Ne": 21.565, "Fe": 7.902, "Cs": 3.894}.items():
        assert abs(BY[sym]["ie"] - ie) < 0.01, sym
    assert abs(D["meta"]["units"]["ev_to_kj_mol"] - 96.485) < 0.001


def test_known_physical_values():
    assert abs(BY["H"]["mass"] - 1.008) < 0.002 and abs(BY["Fe"]["mass"] - 55.845) < 0.01
    assert BY["Hg"]["state"] == "Liquid" and BY["Br"]["state"] == "Liquid"
    assert abs(BY["W"]["mp"] - 3695) < 5 and abs(BY["He"]["bp"] - 4.22) < 0.1


def test_labels_and_definitions_complete_in_six_languages():
    p = D["i18n"]["properties"]
    for lang in LANGS:
        assert set(p["label"][lang]) == set(p["order"]) == set(p["definition"][lang]), lang
        assert all(v.strip() for v in p["label"][lang].values())
        assert all(v.strip() for v in p["definition"][lang].values())
    g = D["i18n"]["groups"]
    for lang in LANGS:
        assert set(g["label"][lang]) == set(g["order"]) == set(D["i18n"]["groups"]["color"]), lang
    for lang in LANGS:
        assert set(D["i18n"]["states"]["label"][lang]) == {"Solid", "Liquid", "Gas"}
    for e in E:
        assert e["block"] in g["order"] and e["state"] in ("Solid", "Liquid", "Gas")


def test_sources_and_fixes_recorded():
    meta = D["meta"]
    assert {s["id"] for s in meta["sources"]} >= {"johnson2019", "cmglee", "kobayashi2020", "gui"}
    assert any(f["element"] == "Cd" for f in meta["fixes"]) and any(f["element"] == "Se" for f in meta["fixes"])
    assert len(meta["inputs_sha256"]) == 4


def test_atomic_masses_follow_the_ciaaw_abridged_weights():
    expected = {"Li": 6.94, "Fe": 55.845, "Pb": 207.2, "Zn": 65.38, "Ar": 39.95, "Br": 79.904, "Ca": 40.078, "Cu": 63.546, "Ru": 101.07, "Sm": 150.36}
    for sym, mass in expected.items():
        assert BY[sym]["mass"] == mass, sym
    assert {s["id"] for s in D["meta"]["sources"]} >= {"ciaaw"} and any("Li" in f["element"] and "CIAAW" in f["what"] for f in D["meta"]["fixes"])
