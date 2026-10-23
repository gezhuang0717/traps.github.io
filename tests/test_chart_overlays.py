"""Compact overlay tables for the chart of nuclides: structure, known values and complete labels."""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'static/data/research-cache'
LANGS = ['en', 'zh', 'fi', 'de', 'ja', 'fr']


def load(name):
    return json.loads((CACHE / name).read_text(encoding='utf8'))


def test_be2_table_has_one_entry_per_nuclide_and_prefers_the_2016_evaluation():
    data = load('be2-compact.json')
    cols = {c: i for i, c in enumerate(data['columns'])}
    keys = [(r[cols['Z']], r[cols['N']]) for r in data['rows']]
    assert len(keys) == len(set(keys)) == data['meta']['rows']
    ca48 = next(r for r in data['rows'] if (r[0], r[1]) == (20, 28))
    assert ca48[cols['E2_keV']] == 3831.72 and ca48[cols['be2_up_e2b2']] == 0.0092 and ca48[cols['evaluation_year']] == 2016
    assert all(r[cols['be2_up_e2b2']] is None or r[cols['be2_up_e2b2']] > 0 for r in data['rows'])
    assert data['meta']['with_be2'] == sum(r[cols['be2_up_e2b2']] is not None for r in data['rows'])
    assert len(data['meta']['raw_sha256']) == 64


def test_ame_editions_keep_flags_and_historical_counts():
    data = load('ame-editions-compact.json')
    assert {k: len(v) for k, v in data['editions'].items()} == {'ame1995': 2931, 'ame2003': 3179, 'ame2012': 3353, 'ame2016': 3436}
    li3 = next(r for r in data['editions']['ame2016'] if (r[0], r[1]) == (3, 0))
    assert li3 == [3, 0, 28667.0, 2000.0, 1]  # estimated (#) value keeps its flag and uncertainty
    ca48 = next(r for r in data['editions']['ame1995'] if (r[0], r[1]) == (20, 28))
    assert ca48[2] == -44214.742 and ca48[4] == 0
    for edition, meta in data['meta']['editions'].items():
        assert len(meta['raw_sha256']) == 64 and meta['rows'] == len(data['editions'][edition])


def test_nuclear_properties_exclude_physically_undefined_entries():
    data = load('nuclear-properties-compact.json')
    cols = {c: i for i, c in enumerate(data['columns'])}
    for row in data['rows']:
        jp = row[cols['Jpi']] or ''
        if jp.startswith('0'):
            assert row[cols['mu_muN']] is None and row[cols['Q_b']] is None, row
        assert row[cols['r_fm']] is None or row[cols['r_fm']] > 0
    assert data['meta']['excluded_inconsistent']['neutron_radius'] == 1
    assert data['meta']['query'] == {'fields': 'ground_states', 'nuclides': 'all'}


def test_new_chart_labels_exist_in_all_six_languages():
    labels = yaml.safe_load((ROOT / 'data/nuclide_chart_labels.yaml').read_text(encoding='utf8'))
    keys = ['m_rms', 'm_mu', 'm_qmom', 'm_e2p', 'm_be2', 'm_beta2e', 'm_dame16', 'm_dame12', 'm_dame03', 'm_dame95', 'mf_group_experimental', 'mf_group_editions', 'aux_error']
    for lang in LANGS:
        for key in keys:
            assert isinstance(labels[lang].get(key), str) and labels[lang][key].strip(), (lang, key)
    assert all('AME2020' in labels[lang]['m_dame16'] and '2016' in labels[lang]['m_dame16'] for lang in LANGS)


def test_ame2012_matches_known_values_and_the_neighbouring_edition():
    data = load('ame-editions-compact.json')['editions']
    a12 = {(r[0], r[1]): r for r in data['ame2012']}
    assert a12[(1, 0)][2] == 7288.97059 and a12[(0, 1)][2] == 8071.31714 and a12[(1, 2)][2] == 14949.80611
    a16 = {(r[0], r[1]): r for r in data['ame2016']}
    diffs = sorted(abs(a12[k][2] - a16[k][2]) for k in a12 if k in a16)
    assert len(diffs) == 3353 and diffs[len(diffs) // 2] < 1.0  # editions agree to well under a keV for the median nuclide
    meta = load('ame-editions-compact.json')['meta']['editions']['ame2012']
    assert meta['rows'] == 3353 and len(meta['raw_sha256']) == 64 and meta['url'].endswith('mass.mas12')


def test_edition_statistics_match_the_tables_and_the_published_nubase_counts():
    meta = load('ame-editions-compact.json')['meta']
    stats = meta['stats']
    editions = load('ame-editions-compact.json')['editions']
    assert list(stats) == ['ame1995', 'ame2003', 'ame2012', 'ame2016', 'ame2020'] or set(stats) == {'ame1995', 'ame2003', 'ame2012', 'ame2016', 'ame2020'}
    for key, rows in editions.items():
        assert stats[key]['nuclides'] == len(rows)
        assert stats[key]['estimated'] == sum(r[4] for r in rows) and stats[key]['measured'] == sum(1 - r[4] for r in rows)
    # NUBASE2003 and NUBASE2016 list exactly the ground states of the AME tables; the older and the 2012 tables list a few more
    for key in ('ame2003', 'ame2016'):
        n = stats[key]['nubase']
        assert (n['ground_states'], n['ground_measured'], n['ground_estimated']) == (stats[key]['nuclides'], stats[key]['measured'], stats[key]['estimated'])
    assert stats['ame2012']['nubase']['ground_states'] == 3379 and stats['ame1995']['nubase']['ground_no_mass'] == 4
    assert stats['ame2020']['nuclides'] == 3558 and stats['ame2020']['nubase']['isomers'] == 1841
    assert [stats[k]['nubase']['isomers'] for k in ('ame1995', 'ame2003', 'ame2012', 'ame2016', 'ame2020')] == [727, 1163, 1675, 1747, 1841]


def test_statistics_labels_exist_in_all_languages_with_the_same_placeholders():
    import re
    labels = yaml.safe_load((ROOT / 'data/nuclide_chart_labels.yaml').read_text(encoding='utf8'))
    keys = [k for k in labels['en'] if k.startswith(('st_', 'ed_'))]
    assert len(keys) == 27
    for key in keys:
        holes = set(re.findall(r'\{(\w+)\}', labels['en'][key]))
        for lang in LANGS:
            text = labels[lang].get(key)
            assert isinstance(text, str) and text.strip(), (lang, key)
            assert set(re.findall(r'\{(\w+)\}', text)) == holes, (lang, key)
