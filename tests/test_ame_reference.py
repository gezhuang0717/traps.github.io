"""Compact AME2020 reference table: it must reproduce the published reactions file exactly and stay in step with its generator."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'static/data/research-cache/ame2020-reference.json'


def load():
    return json.loads(TABLE.read_text(encoding='utf8'))


def test_generated_file_is_current():
    result = subprocess.run([sys.executable, str(ROOT / 'tools/make_ame_reference.py'), '--check'], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_every_nuclide_matches_the_published_reactions_file():
    table, full = load(), json.loads((ROOT / 'static/data/ame2020-reactions.json').read_text(encoding='utf8'))
    col = {c: i for i, c in enumerate(table['columns'])}
    assert len(table['rows']) == len(full['records']) == table['meta']['rows'] == 3558
    for row in table['rows']:
        rec = full['records'][f'{row[0]},{row[1]}']
        assert row[col['symbol']] == rec['element']
        for q in ('me', 'bea', 'sn', 's2n', 'sp', 's2p', 'qbm', 'qa', 'q2bm'):
            cell = rec['values'].get('BEA' if q == 'bea' else q)
            got = (row[col[q]], row[col[q + '_s']], row[col[q + '_x']])
            want = (None, None, None) if not cell or cell.get('value') is None else (cell['value'], cell.get('uncertainty'), 1 if cell.get('value_extrapolated') else 0)
            assert got == want, (row[:3], q)


def test_published_uncertainties_are_kept_not_recombined():
    table = load()
    col = {c: i for i, c in enumerate(table['columns'])}
    eu155 = next(r for r in table['rows'] if r[0] == 63 and r[1] == 92)
    assert (eu155[col['qbm']], eu155[col['qbm_s']]) == (251.9612, 0.8682)   # owner rule: tabulated AME uncertainty, not independent marginal errors
    assert len(table['meta']['sources']) == 3 and all(len(s['sha256']) == 64 for s in table['meta']['sources'])
    assert 'github.com/gezhuang' not in json.dumps(table['meta'])
