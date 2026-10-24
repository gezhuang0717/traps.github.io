"""The chart-of-nuclides quick link, the per-tool workbench help and the extra Penning plots exist in every language."""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")


def test_chart_has_its_own_quick_link_in_all_languages():
    labels = yaml.safe_load((ROOT / "data/learning_labels.yaml").read_text())
    for lang in LANGS:
        assert labels[lang]["chart"] and labels[lang]["lab"], lang
        assert labels[lang]["chart"] != labels[lang]["lab"], lang
    links = (ROOT / "layouts/_shortcodes/learning-links.html").read_text()
    assert 'lab/#nuclide-chart' in links and '$t.chart' in links
    assert links.index("lab/#nuclide-chart") < links.index("lab/#penning-motion")
    assert 'id="nuclide-chart"' in (ROOT / "layouts/_shortcodes/nuclide-chart.html").read_text()


def test_every_workbench_kind_has_its_own_help_in_all_languages():
    data = json.loads((ROOT / "data/control_help.json").read_text())
    template = (ROOT / "layouts/_partials/zg/measurement-workbench.html").read_text()
    assert 'printf "workbench-%s"' in template
    for lang in LANGS:
        topics = data[lang]["topics"]
        assert "workbench" not in topics, lang
        for kind in ("mr", "tof", "penning"):
            paragraphs = topics["workbench-" + kind]
            assert len(paragraphs) >= 3 and all(p.strip() for p in paragraphs), (lang, kind)
    # the Penning text keeps its frequencies; the MR-TOF text must not
    assert "ν₊" in " ".join(data["en"]["topics"]["workbench-penning"])
    assert "ν₊" not in " ".join(data["en"]["topics"]["workbench-mr"])


def test_mr_tof_energy_bin_and_calibration_labels_exist_everywhere():
    labels = yaml.safe_load((ROOT / "data/workbench_labels.yaml").read_text())
    keys = ("energy", "energy_hint", "bin", "bin_auto", "bin_custom", "bin_custom_value", "bin_too_small",
            "cal_t0", "cal_formula", "cal_fill", "cal_filled")
    for lang in LANGS:
        table = labels[lang]
        for key in keys:
            assert str(table.get(key, "")).strip(), (lang, key)


def test_penning_tab_has_the_projection_and_phase_space_plots():
    html = (ROOT / "layouts/_partials/zg/laser-cooling.html").read_text()
    js = (ROOT / "static/js/laser-cooling.js").read_text()
    notes = yaml.safe_load((ROOT / "data/figure_notes.yaml").read_text())
    captions = yaml.safe_load((ROOT / "data/cooling_i18n.yaml").read_text())
    for canvas in ("axialy", "phasex", "phasez"):
        assert f'data-cv="{canvas}"' in html and f'"{canvas}"' in js or f"'{canvas}'" in js, canvas
    for key in ("c195", "c196", "c197"):
        assert set(captions[key]) >= set(LANGS), key
    for lang in LANGS:
        assert len(notes[lang]["penning-cooling-figures"]["items"]) >= 7, lang
