"""The numbered "How to use" lists of the tools: same tools, same number of steps and the same control references in all six languages,
and every data-tool-steps marker in the templates has a list."""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")
REF = re.compile(r"\{([^{}]*)\}")


def load():
    return yaml.safe_load((ROOT / "data/tool_steps.yaml").read_text(encoding="utf8"))


def test_all_languages_and_tools_match():
    data = load()
    assert tuple(data) == LANGS
    ids = set(data["en"])
    assert len(ids) >= 12
    for lang in LANGS:
        assert set(data[lang]) == ids, lang


def test_steps_are_complete_translated_and_reference_the_same_controls():
    data = load()
    for tool, en in data["en"].items():
        assert 3 <= len(en["steps"]) <= 5, tool
        for lang in LANGS:
            entry = data[lang][tool]
            assert entry["title"].strip() and len(entry["steps"]) == len(en["steps"]), (lang, tool)
            for i, (text, ref) in enumerate(zip(entry["steps"], en["steps"])):
                assert text.strip(), (lang, tool, i)
                assert sorted(REF.findall(text)) == sorted(REF.findall(ref)), (lang, tool, i, "control references differ from English")
                for token in REF.findall(text):
                    assert re.match(r"^(name|act|sel):\S+$", token), (lang, tool, token)
                if lang != "en" and not REF.sub("", ref).strip() == "":
                    assert text != ref, (lang, tool, i, "step identical to English")


def test_every_marker_has_steps_and_every_list_has_a_marker():
    data = load()
    marked = set()
    for sub in ("layouts", "static/js"):
        for path in (ROOT / sub).rglob("*"):
            if path.suffix in (".html", ".js") and not path.name.startswith("._"):
                marked.update(re.findall(r"data-tool-steps(?:=|['\"]\s*:\s*)[\"']?([a-z0-9-]+)", path.read_text(encoding="utf8")))
    marked -= {"id", "wb-"}  # the helper's own documentation, and the workbench partial that builds wb-<kind>
    marked |= {"wb-penning", "wb-tof", "wb-mr"}
    assert marked == set(data["en"]), (sorted(marked - set(data["en"])), sorted(set(data["en"]) - marked))
