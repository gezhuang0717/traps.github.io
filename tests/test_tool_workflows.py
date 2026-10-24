"""Actual multilingual guidance payload rendering, without a full site build."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from html.parser import HTMLParser

import pytest

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")
FIELDS = ("purpose", "inputs", "outputs", "gain", "hint", "limits")


def test_profiles_have_complete_localized_workflow_fields_and_real_source_paths():
    for file in ("game_workflows.json", "lab_workflows.json"):
        data = json.loads((ROOT / "data" / file).read_text())
        assert data["schema_version"] == 1
        assert set(data["languages"]) == set(LANGS)
        for key, topic in data["topics"].items():
            assert set(topic["text"]) == set(LANGS), key
            for lang, values in topic["text"].items():
                assert set(values) == set(FIELDS), (key, lang)
                assert all(isinstance(values[k], str) and values[k].strip() for k in FIELDS)
            assert all((ROOT / path).is_file() for path in topic["source_files"]), key


class GuidanceMarkup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.configs, self.scripts, self.links = [], [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "data-tool-workflows-config" in a:
            assert "hidden" in a
            self.configs.append(json.loads(a["data-tool-workflows-config"]))
        if tag == "script":
            self.scripts.append(a)
        if tag == "link":
            self.links.append(a)


def test_actual_shared_partial_preserves_native_help_without_generic_guides(tmp_path):
    hugo = os.environ.get("HUGO_TEST_BIN") or shutil.which("hugo")
    if not hugo:
        pytest.skip("Pinned Hugo required")
    files = ["layouts/_shortcodes/learning-links.html", "layouts/_partials/zg/tool-workflows.html",
             "data/learning_labels.yaml", "data/game_workflows.json", "data/lab_workflows.json",
             "static/js/tool-workflows.js", "static/css/tool-workflows.css"]
    for path in files:
        dest = tmp_path / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((ROOT / path).read_bytes())
    (tmp_path / "layouts/single.html").write_text("<main>{{ .Content }}</main>")
    config = ['baseURL="https://example.test/traps.github.io/"', 'defaultContentLanguage="en"',
              'disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in LANGS:
        content = tmp_path / "content" / lang
        content.mkdir(parents=True)
        (content / "lab.md").write_text('---\ntitle: Lab\n---\n{{< learning-links >}}\n{{< learning-links >}}\n\nSpecific isotope instructions stay here.\n')
        config += [f"[languages.{lang}]", f'contentDir="content/{lang}"']
    (tmp_path / "hugo.toml").write_text("\n".join(config))
    result = subprocess.run([hugo, "--source", str(tmp_path), "--destination", str(tmp_path / "public"),
                             "--cacheDir", str(tmp_path / "cache"), "--noBuildLock"],
                            env={**os.environ, "GOMAXPROCS": "1", "GOMEMLIMIT": "96MiB", "TMPDIR": str(tmp_path)},
                            capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
    for lang in LANGS:
        path = tmp_path / "public" / ("" if lang == "en" else lang) / "lab/index.html"
        text = path.read_text()
        rendered = GuidanceMarkup(text)
        assert not rendered.configs, lang
        assert "Specific isotope instructions stay here." in text
        assert not any("tool-workflows.js" in a.get("src", "") for a in rendered.scripts)
        assert not any("tool-workflows.css" in a.get("href", "") for a in rendered.links)
