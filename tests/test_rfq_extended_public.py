"""Source-level guard for public RFQ extensions and the private/manuals boundary."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]

def test_rfq_extended_sources_exist_and_use_local_data_only():
    files = [
        "static/js/rfq-extended-core.js",
        "static/js/rfq-extended-ui.js",
        "static/css/rfq-extras.css",
        "layouts/_partials/zg/rfq-extras.html",
        "data/rfq_extras_labels.json",
    ]
    for f in files:
        assert (ROOT / f).is_file(), f
    ui = (ROOT / files[1]).read_text()
    assert "fetch(" not in ui
    assert "XMLHttpRequest" not in ui
    assert "sendBeacon" not in ui
    assert "localStorage" not in ui
    assert "await file.text()" in ui
    assert "window.ZGRFQExtras" in ui

def test_all_rfq_panels_labeled_and_mounted():
    partial=(ROOT / "layouts/_partials/zg/rfq-mathieu.html").read_text()
    extras=(ROOT / "layouts/_partials/zg/rfq-extras.html").read_text()
    data=json.loads((ROOT / "data/rfq_extras_labels.json").read_text())
    for language in ("en","zh","fi","de","ja","fr"):
        for key in ("motion","gas","bunch","scan","data","scope","run","csv","json","svg"):
            assert data[language][key].strip(), (language,key)
    for key in ("motion","gas","bunch","scan","data"):
        assert f'data-local-tab="{{{{ . }}}}"' in partial
        assert f'data-local-panel="{key}"' in extras
    assert '{{ partial "zg/rfq-extras.html" . }}' in partial
    for module in ("rfq-extended-core.js","rfq-extended-ui.js","rfq-extras.css"):
        assert module in partial

def test_no_private_repo_identifiers_or_private_manuals_in_public_new_files():
    paths=[
        "README.md","static/js/rfq-extended-core.js","static/js/rfq-extended-ui.js",
        "layouts/_partials/zg/rfq-extras.html","data/rfq_extras_labels.json",
    ]
    for name in paths:
        text=(ROOT / name).read_text().lower()
        for forbidden in ("website_manuals", "heisol", "p s s d", "github_pat_", "sk-proj-"):
            assert forbidden not in text, (name,forbidden)
