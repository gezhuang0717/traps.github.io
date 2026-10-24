"""Every label the workbench script reads exists (English) so no tab shows 'undefined'; the six languages are checked by test_cooling_i18n."""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_all_labels_used_by_workbenches_exist():
    js = (ROOT / "static/js/workbenches.js").read_text(encoding="utf8")
    used = set(re.findall(r"\bT\.([A-Za-z_][A-Za-z0-9_]*)", js))
    known = set(yaml.safe_load((ROOT / "data/workbench_labels.yaml").read_text(encoding="utf8"))["en"])
    known |= set(yaml.safe_load((ROOT / "data/trap_labels.yaml").read_text(encoding="utf8"))["en"])
    missing = sorted(k for k in used if k not in known)
    assert not missing, missing


def test_workbench_scripts_are_loaded_before_workbenches():
    for page in ("games.html", "lab.html"):
        html = (ROOT / "layouts/_shortcodes" / page).read_text(encoding="utf8")
        order = [html.index(name) for name in ("js/figure-style.js", "js/wb-plot.js", "js/workbenches.js")]
        assert order == sorted(order), page
