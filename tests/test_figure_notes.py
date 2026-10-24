"""Every figure explanation exists in all six languages, with the same ids and the same number of entries."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "zh", "fi", "de", "ja", "fr")


def load():
    return yaml.safe_load((ROOT / "data/figure_notes.yaml").read_text(encoding="utf8"))


def test_all_languages_and_ids_match():
    data = load()
    assert tuple(data) == LANGS
    ids = set(data["en"])
    assert ids, "no figure notes"
    for lang in LANGS:
        assert set(data[lang]) == ids, lang


def test_entries_are_complete_and_not_copied_from_english():
    data = load()
    for fig, en in data["en"].items():
        for lang in LANGS:
            note = data[lang][fig]
            assert note["title"].strip() and note["summary"].strip(), (lang, fig)
            assert len(note["items"]) == len(en["items"]) >= 2, (lang, fig)
            for symbol, text in note["items"]:
                assert str(symbol).strip() and str(text).strip(), (lang, fig, symbol)
            if lang != "en":
                assert note["summary"] != en["summary"], (lang, fig, "summary not translated")
                same = sum(1 for (_, a), (_, b) in zip(note["items"], en["items"]) if a == b)
                assert same == 0, (lang, fig, "entries identical to English")


def test_mathieu_labels_present_in_all_languages():
    import json
    labels = json.loads((ROOT / "data/mathieu_labels.json").read_text(encoding="utf8"))
    keys = set(labels["en"])
    for lang in LANGS:
        assert not keys - set(labels[lang]), (lang, sorted(keys - set(labels[lang]))[:5])
