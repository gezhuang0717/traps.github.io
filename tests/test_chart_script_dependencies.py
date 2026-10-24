"""Render actual chart/Lab compositions; shared dependencies must execute once."""
from collections import Counter
from html.parser import HTMLParser
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")


class ScriptMarkup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.scripts, self.ids = [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "script" and attrs.get("src"):
            attrs["path"] = urlsplit(attrs["src"]).path
            self.scripts.append(attrs)


def test_lab_only_partial_caller_and_current_lab_chart_order_remain_explicit():
    callers = [p.relative_to(ROOT).as_posix() for p in (ROOT / "layouts").rglob("*.html")
               if not p.name.startswith("._") and 'partial "zg/legacy-penning3d.html"' in p.read_text()]
    assert callers == ["layouts/_shortcodes/lab.html"]
    for lang in LANGS:
        text = (ROOT / "content" / lang / "lab.md").read_text()
        assert text.index("{{< lab >}}") < text.index("{{< nuclide-chart >}}"), lang


def test_actual_hugo_standalone_and_lab_chart_have_unique_scripts_and_safe_order(tmp_path):
    hugo = os.environ.get("HUGO_TEST_BIN") or shutil.which("hugo")
    if not hugo:
        pytest.skip("Pinned Hugo required for actual template composition")
    # Literal dependencies only: no public static directory copy or full site build.
    pending = ["layouts/_shortcodes/nuclide-chart.html", "layouts/_shortcodes/lab.html",
               "layouts/_shortcodes/lab-more.html"]
    templates, data_keys, hash_files = set(), set(), set()
    while pending:
        rel = pending.pop()
        if rel in templates:
            continue
        text = (ROOT / rel).read_text()
        templates.add(rel)
        pending.extend("layouts/_partials/" + name for name in re.findall(r'partial(?:Cached)?\s+"([^"]+)"', text))
        data_keys.update(re.findall(r'(?:hugo|site)\.Data\.([A-Za-z0-9_]+)', text))
        hash_files.update(re.findall(r'(?:readFile|os\.ReadFile)\s+"([^"]+)"', text))
    data_files = set()
    for key in data_keys:
        matches = [p for p in (ROOT / "data").glob(key + ".*") if p.is_file()]
        assert len(matches) == 1, (key, matches)
        data_files.add(matches[0].relative_to(ROOT).as_posix())
    i18n = {p.relative_to(ROOT).as_posix() for p in (ROOT / "i18n").iterdir()
            if p.is_file() and not p.name.startswith("._")}
    inputs = templates | data_files | hash_files | i18n
    assert sum((ROOT / rel).stat().st_size for rel in inputs) < 10 * 1024 * 1024
    for rel in inputs:
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / rel).read_bytes())
    (tmp_path / "layouts/single.html").write_text('<!doctype html><html lang="{{ site.Language.Lang }}"><body>{{ .Content }}</body></html>')
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'defaultContentLanguageInSubdir=true', 'staticDir=[]',
              'disableKinds=["home","section","taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in LANGS:
        content = tmp_path / "content" / lang
        content.mkdir(parents=True)
        (content / "standalone.md").write_text('---\ntitle: Standalone chart\nindependentPanel: true\n---\n{{< nuclide-chart >}}\n')
        (content / "lab.md").write_text('---\ntitle: Lab and chart\n---\n{{< lab >}}\n{{< lab-more >}}\n{{< nuclide-chart >}}\n')
        (content / "plain.md").write_text('---\ntitle: Chart without independent panels\n---\n{{< nuclide-chart >}}\n')
        config += [f"[languages.{lang}]", f'contentDir="content/{lang}"']
    (tmp_path / "hugo.toml").write_text("\n".join(config))
    result = subprocess.run([hugo, "--source", str(tmp_path), "--destination", str(tmp_path / "public"),
                             "--cacheDir", str(tmp_path / "cache"), "--noBuildLock"],
                            env={**os.environ, "GOMAXPROCS": "1", "GOMEMLIMIT": "96MiB", "TMPDIR": str(tmp_path)},
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
    for lang in LANGS:
        for name in ("standalone", "lab", "plain"):
            rendered = ScriptMarkup((tmp_path / "public" / lang / name / "index.html").read_text())
            assert len(rendered.ids) == len(set(rendered.ids)), (lang, name, "duplicate IDs")
            scripts = rendered.scripts
            counts = Counter(s["path"] for s in scripts)
            assert all(count == 1 for count in counts.values()), (lang, name, counts)
            by_name = {Path(s["path"]).name: (i, s) for i, s in enumerate(scripts)}
            for dependency in ("zg-export.js", "physics.js", "nuclide-chart.js"):
                assert dependency in by_name, (lang, name, dependency)
            # Normal pages render the embedded comparison partial (which owns its script);
            # independent child pages omit that UI and load the same helper at chart level.
            assert "independent-panels.js" in by_name
            assert ("data-independent-panels" in (tmp_path / "public" / lang / name / "index.html").read_text()) == (name != "standalone")
            for dependency, consumers in {
                "zg-export.js": ("trap3d.js", "lab-calculators.js", "nuclide-chart.js"),
                "physics.js": ("calibration.js", "workbenches.js", "lab-calculators.js", "nuclide-chart.js"),
            }.items():
                left, attr = by_name[dependency]
                for consumer in consumers:
                    if consumer not in by_name:
                        continue
                    right, consumer_attr = by_name[consumer]
                    # A synchronous helper executes during parsing before all deferred consumers;
                    # two deferred scripts execute in document order.
                    assert "defer" in consumer_attr
                    assert "defer" not in attr or left < right, (lang, name, dependency, consumer)
