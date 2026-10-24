"""The figure explanations and how-to steps are written only on pages that carry a tool, never into every generated page."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL_SHORTCODES = ("games", "lab", "nuclide-chart", "spectroscopy-games", "spectroscopy-tools")


def test_no_global_footer_carries_the_data():
    footer = ROOT / "layouts/_partials/extend-footer.html"
    assert not footer.exists() or not any(k in footer.read_text() for k in ("figure_notes", "tool_steps"))
    head = (ROOT / "layouts/_partials/extend-head.html").read_text()
    assert "figure_notes" not in head and "tool_steps" not in head


def test_every_tool_shortcode_writes_the_data_once_per_page():
    partial = (ROOT / "layouts/_partials/zg/page-data.html").read_text()
    assert 'id="zg-figure-notes"' in partial and 'id="zg-tool-steps"' in partial
    assert 'Store.Get "zg-page-data"' in partial and 'Store.Set "zg-page-data"' in partial
    for name in TOOL_SHORTCODES:
        text = (ROOT / "layouts/_shortcodes" / (name + ".html")).read_text()
        assert text.count('partial "zg/page-data.html"') == 1, name


def test_pages_with_a_marker_get_the_steps_from_a_tool_shortcode():
    # every template that marks a tool is reached from one of the shortcodes above
    for path in (ROOT / "layouts").rglob("*.html"):
        if path.name.startswith("._") or "data-tool-steps" not in path.read_text():
            continue
        rel = path.relative_to(ROOT / "layouts").as_posix()
        if rel.startswith("_shortcodes/"):
            assert path.stem in TOOL_SHORTCODES, rel
        else:
            callers = [s for s in TOOL_SHORTCODES if Path(ROOT / "layouts/_shortcodes" / (s + ".html")).read_text().count(rel.removeprefix("_partials/")) or s in ("games", "lab")]
            assert callers, rel
