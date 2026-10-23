"""The cooling/guide templates take their text from data files that must cover all six languages."""
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
LANGS = ['en', 'zh', 'fi', 'de', 'ja', 'fr']


def _yaml(name):
    return yaml.safe_load((ROOT / 'data' / name).read_text(encoding='utf8'))


def test_every_template_key_exists_and_has_six_languages():
    data = _yaml('cooling_i18n.yaml')
    used = set()
    for path in (ROOT / 'layouts').rglob('*.html'):
        if path.name.startswith('._'):
            continue
        used |= set(re.findall(r'partial "zg/ct\.html" "(c\d+[a-z]?)"', path.read_text(encoding='utf8')))
    assert used, 'no templates use zg/ct.html'
    assert used <= set(data), sorted(used - set(data))
    for key, row in data.items():
        for lang in LANGS:
            assert isinstance(row.get(lang), str) and row[lang].strip(), (key, lang)
        # a long sentence must not be an unnoticed copy of the English text (short symbolic labels may coincide)
        for lang in ('fi', 'de', 'ja', 'fr'):
            if row[lang] == row['en']:
                assert len(row['en'].split()) < 6, (key, lang, row['en'])


def test_template_keys_with_two_chinese_wordings_are_kept_apart():
    data = _yaml('cooling_i18n.yaml')
    assert {'c029b', 'c033b', 'c056b', 'c057b'} <= set(data)
    assert data['c029']['en'] == data['c029b']['en'] and data['c029']['zh'] != data['c029b']['zh']


def test_cooling_controls_table_has_all_languages():
    rows = json.loads((ROOT / 'data/cooling_controls.json').read_text(encoding='utf8'))
    assert len(rows) >= 23
    for row in rows:
        for lang in LANGS:
            assert row[lang]['name'].strip() and row[lang]['effect'].strip(), (row['key'], lang)


def test_runtime_dictionary_covers_the_four_non_chinese_languages_equally():
    data = _yaml('cooling_js_i18n.yaml')
    assert set(data) == {'fi', 'de', 'ja', 'fr'}
    sizes = {lang: len(v) for lang, v in data.items()}
    assert min(sizes.values()) >= 60 and max(sizes.values()) - min(sizes.values()) <= 3, sizes


def test_label_tables_have_no_missing_keys_in_any_language():
    for name in ('games_labels', 'nuclide_chart_labels', 'workbench_labels', 'trap_labels', 'calibration_labels'):
        data = _yaml(name + '.yaml')
        for lang in LANGS[1:]:
            missing = [k for k in data['en'] if k not in data[lang]]
            assert not missing, (name, lang, missing[:5])


def test_trap_zoo_and_control_help_include_french():
    zoo = _yaml('trap_zoo.yaml')
    assert zoo['title']['fr'] and zoo['note']['fr']
    assert all(t['name'].get('fr') and t['how'].get('fr') for t in zoo['traps'])
    help_ = json.loads((ROOT / 'data/control_help.json').read_text(encoding='utf8'))
    assert help_['fr']['title'] and set(help_['fr']['topics']) == set(help_['en']['topics'])
    assert all(len(help_['fr']['topics'][k]) == len(v) for k, v in help_['en']['topics'].items())
