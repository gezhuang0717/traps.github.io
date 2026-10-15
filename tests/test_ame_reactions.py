"""Published AME energies: independent source parity, identities and covariance.

Run: python3 -B -m pytest tests/test_ame_reactions.py
The evaluated uncertainty is an oracle, not a diagonal-error approximation.
"""
from decimal import Decimal
from functools import lru_cache
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('ame_reactions', ROOT/'tools/make_ame_reactions.py')
GEN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GEN)


@lru_cache(maxsize=1)
def dataset():
    return json.loads((ROOT/'static/data/ame2020-reactions.json').read_text())


def independent_number(raw):
    token = raw.strip()
    return None if token in ('', '*') else float(Decimal(token.replace('#', '.')))


def assert_original_cell(actual, value, error):
    assert actual['raw'] == value.strip()
    assert actual['raw_uncertainty'] == error.strip()
    assert actual['value'] == independent_number(value)
    assert actual['uncertainty'] == independent_number(error)
    assert actual['value_extrapolated'] == ('#' in value)
    assert actual['uncertainty_extrapolated'] == ('#' in error)


def test_complete_reaction_columns_have_independent_raw_parity():
    data = dataset()
    for filename, keys in [
        ('rct1.mas20.txt', ('s2n','s2p','qa','q2bm','qep','qbmn')),
        ('rct2_1.mas20.txt', ('sn','sp','q4bm','qda','qpa','qna')),
    ]:
        table = 'rct1' if filename.startswith('rct1') else 'rct2'
        count = 0
        for lineno, line in enumerate((ROOT/'tools/data/ame2020'/filename).read_text().splitlines(), 1):
            if not line[1:4].strip().isdigit() or not line[8:11].strip().isdigit():
                continue
            a, z = int(line[1:4]), int(line[8:11])
            row = data['records'][f'{z},{a-z}']
            assert (row['A'],row['Z'],row['N'],row['element']) == (a,z,a-z,line[5:8].strip())
            assert row['source_lines'][table] == lineno
            for index, key in enumerate(keys):
                start = 12 + index * 22
                assert_original_cell(row['values'][key], line[start:start+12], line[start+12:start+22])
            count += 1
        assert count == 3558


def test_mass_columns_and_scaled_binding_energy_have_exact_provenance():
    data = dataset()
    count = 0
    for lineno, line in enumerate((ROOT/'tools/data/ame2020/mass_1.mas20.txt').read_text().splitlines(), 1):
        if not all(line[a:b].strip().isdigit() for a,b in [(4,9),(9,14),(14,19)]):
            continue
        n,z,a = int(line[4:9]),int(line[9:14]),int(line[14:19])
        row = data['records'][f'{z},{n}']
        assert row['source_lines']['mass'] == lineno
        for key,v0,v1,e0,e1 in [('me',28,42,42,54),('BEA',54,67,68,78),('qbm',81,94,94,105)]:
            assert_original_cell(row['values'][key], line[v0:v1], line[e0:e1])
        be,bea = row['values']['BE'],row['values']['BEA']
        assert be['source_quantity'] == 'BEA' and be['raw_is_derived']
        assert be['source_raw'] == bea['raw'] and be['source_raw_uncertainty'] == bea['raw_uncertainty']
        for field, token in [('value',bea['raw']),('uncertainty',bea['raw_uncertainty'])]:
            assert be[field] == float(Decimal(token.replace('#','.')) * a)
        assert be['value_extrapolated'] == bea['value_extrapolated']
        assert be['uncertainty_extrapolated'] == bea['uncertainty_extrapolated']
        count += 1
    assert count == 3558


@pytest.mark.parametrize('identity,key,value,sigma', [
    ('50,66','sn',9563.4512,.0948), ('50,66','sp',9278.5934,.0953),
    ('50,66','s2n',17108.8797,.0980), ('50,66','s2p',16088.9870,.2899),
    ('50,66','qa',-3376.0374,.2664), ('50,66','q2bm',-6262.1863,24.2060),
    ('50,66','qep',-10730.4702,.6573), ('50,66','qbmn',-12593.8847,16.0256),
    ('50,66','q4bm',-18479.1015,13.0175), ('50,66','qda',7754.6353,.3154),
    ('50,66','qpa',2705.1998,.2103), ('50,66','qna',3163.7098,.2602),
    ('32,44','q2bm',2039.0612,.0075), ('20,28','q2bm',4268.0840,.0726),
    ('54,82','q2bm',2457.9090,.2448), ('48,68','q2bm',2813.4899,.1295),
    ('63,92','qbm',251.9612,.8682),
])
def test_published_ground_state_oracles(identity,key,value,sigma):
    entry = dataset()['records'][identity]['values'][key]
    assert entry['value'] == value and entry['uncertainty'] == sigma


def test_155eu_and_76ge_covariance_uncertainties_are_not_diagonal():
    rows = dataset()['records']
    eu,gd = rows['63,92']['values'],rows['64,91']['values']
    assert eu['qbm']['raw'] == '251.9612' and eu['qbm']['raw_uncertainty'] == '0.8682'
    diagonal = math.hypot(eu['me']['uncertainty'],gd['me']['uncertainty'])
    assert 1.59 < diagonal < 1.60 and eu['qbm']['uncertainty'] < .55 * diagonal
    ge,se = rows['32,44']['values'],rows['34,42']['values']
    assert ge['q2bm']['uncertainty'] == .0075
    assert ge['q2bm']['uncertainty'] < .4 * math.hypot(ge['me']['uncertainty'],se['me']['uncertainty'])


def test_estimated_decimal_flags_and_missing_values_do_not_shift_columns():
    assert GEN.cell('-123#4567','0.0456') == dict(value=-123.4567,uncertainty=.0456,
        value_extrapolated=True,uncertainty_extrapolated=False,raw='-123#4567',raw_uncertainty='0.0456')
    assert GEN.cell('123.4567','0#0456')['uncertainty_extrapolated']
    assert GEN.cell('0.0000','0.0000')['value'] == 0.
    fields = [('*',''),('123#4567','0.0456'),('-9.0000','0#1234'),('0.0000','0.0000'),('*',''),('6.2500','1.0000')]
    line = f' {116:3} {"Sn":3}{50:3} ' + ''.join(f'{v:>12}{e:>10}' for v,e in fields)
    text = 'a1,i3,1x,a3,i3,1x,6(f12.4,f10.4) Q(2B-)\n' + line
    values = GEN.parse_reactions(text,'rct1')['50,66']['values']
    assert values['s2n']['value'] is None and values['qep']['value'] is None
    assert values['s2p']['value'] == 123.4567 and values['s2p']['value_extrapolated']
    assert values['qa']['uncertainty'] == .1234 and values['qa']['uncertainty_extrapolated']
    assert values['q2bm']['value'] == 0. and values['qbmn']['value'] == 6.25
    with pytest.raises(ValueError,match='Duplicate'):
        GEN.parse_reactions(text+'\n'+line,'rct1')
    with pytest.raises(ValueError,match='header mismatch'):
        GEN.parse_reactions(text,'rct2')
    for invalid in ['1e3','NaN','1#2#3','1,000']:
        with pytest.raises(ValueError): GEN.number(invalid)
    with pytest.raises(ValueError): GEN.cell('*','1.0000')
    with pytest.raises(ValueError): GEN.cell('1.0000','-0.1000')


def test_metadata_hashes_missing_entries_and_full_table_oracle():
    data = dataset()
    assert data['schema'] == 'zg-ame2020-reactions-v1' and data['unit'] == 'keV'
    assert len(data['records']) == 3558 and len(data['quantities']) == 16
    assert data['metadata']['quantity_units']['BEA'] == 'keV/nucleon'
    assert data['metadata']['quantity_units']['BE'] == 'keV'
    assert 'published BEA' in data['metadata']['quantity_transformations']['BE']
    for item in data['metadata']['sources']:
        raw = (ROOT/'tools/data/ame2020'/item['filename']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == item['sha256'] and len(raw) == item['bytes']
        assert item['url'].startswith('https://www-nds.iaea.org/amdc/ame2020/')
    assert all(set(row['values']) == set(data['quantities']) for row in data['records'].values())
    assert any(c['value'] is None for row in data['records'].values() for c in row['values'].values())
    ame = json.loads((ROOT/'static/data/ame2020.json').read_text())
    result = GEN.comparison(data['records'],ame)
    assert result['status'] == 'PASS' and not result['failures']
    assert sum(v['checked'] for v in result['quantities'].values()) > 52000
    assert all(v['max_precision_ratio'] <= 1 for v in result['quantities'].values())
    ame['rows'][0][3] += 1
    with pytest.raises(ValueError,match='central value mismatch'):
        GEN.comparison(data['records'],ame)
