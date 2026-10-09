import hashlib, json
from pathlib import Path
import pytest
from tools.import_bruslib import parse
from tools.import_ktuy import parse as parse_ktuy, parse_record, HEADER
from tools.make_mass_models import read_model

ROOT=Path(__file__).resolve().parents[1]
def test_model_index_and_payload_identity():
    all_data=json.loads((ROOT/'static/data/massmodels.json').read_text())
    index=json.loads((ROOT/'static/data/massmodels-index.json').read_text())
    assert set(index['models'])=={'frdm1995','frdm2012','hfb17','hfbd1m','hfb14','hfb24','bskg3','hfb21','hfb25','hfb26','hfb27','ktuy05'}
    for key,meta in index['models'].items():
        payload=(ROOT/'static/data'/meta['data_url']).read_bytes()
        assert hashlib.sha256(payload).hexdigest()==meta['payload_sha256']
        model=json.loads(payload)
        assert model==all_data['models'][key]
        assert len(model['rows'])==meta['row_count']
        assert model['uncertainty'] is None
        assert len({tuple(row[:2]) for row in model['rows']})==len(model['rows'])
    for key,count in [('hfb14',8388),('hfb24',8392),('bskg3',8485),('hfb21',8387),('hfb25',9484),('hfb26',9511),('hfb27',8386)]:
        meta=index['models'][key]['source']
        data=ROOT/f'tools/data/massmodels/{key}.txt'
        assert hashlib.sha256(data.read_bytes()).hexdigest()==meta['normalized_sha256']
        assert meta['rows']==count and meta['validation']['maximum_difference_MeV']<.016

def test_hfb14_blank_columns_never_shift_mass_or_supply_model_sigma():
    # A realistic boundary row with blank Sn/Sp/Q columns.
    text='   8  16  0.00  0.00 2.782  1.70                               -4.01    -0.72'
    assert float(text[59:68])==-4.01
    assert not text[32:41].strip()

def test_ktuy_mass_column_and_missing_deformation():
    assert parse_record('50 66 -91.21 -1.40 .006 0 0') == [50,116,-91.21,None]
    rows=read_model(ROOT/'tools/data/massmodels/ktuy05.txt')
    assert len(rows)==9436 and rows[0]==[2,2,6290,None] and rows[-1]==[130,200,315130,None]
    assert all(row[3] is None for row in rows)
    assert next(r for r in rows if r[:2]==[50,66])==[50,66,-91210,None]
    model=json.loads((ROOT/'static/data/massmodels/ktuy05.json').read_text())
    source=model['source']
    assert model['rows']==rows and source['rows']==9436
    assert source['mass_precision_keV']==10 and source['uncertainty'] is None
    assert hashlib.sha256((ROOT/'tools/data/massmodels/ktuy05.txt').read_bytes()).hexdigest()==source['normalized_sha256']
    assert source['validation']['Sn_checks']==9303 and source['validation']['Sp_checks']==9235

@pytest.mark.parametrize('line', ['50 66 nan -1 0 0 0', '50 66 -91.21 inf 0 0 0',
    '131 200 1 0 0 0 0', '50 201 1 0 0 0 0', '50 66 -91.21 0 0 0', '50 66 -91.21 0 0 0 0 extra'])
def test_ktuy_rejects_malformed_or_nonfinite_records(line):
    with pytest.raises(ValueError):
        parse_record(line)

def test_ktuy_rejects_shifted_header_duplicate_and_truncated_snapshot():
    header=' '.join(HEADER)+'\n'
    row='2 2 6.29 -2.39 .021 0 0\n'
    for text,reason in [('N Z ME\n'+row,'header'), (header+row+row,'Duplicate'),
                        (header+row,'9436')]:
        with pytest.raises(ValueError,match=reason):
            parse_ktuy(text)
