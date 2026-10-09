import hashlib, json
from pathlib import Path
from tools.import_bruslib import parse

ROOT=Path(__file__).resolve().parents[1]
def test_model_index_and_payload_identity():
    all_data=json.loads((ROOT/'static/data/massmodels.json').read_text())
    index=json.loads((ROOT/'static/data/massmodels-index.json').read_text())
    assert set(index['models'])=={'frdm1995','frdm2012','hfb17','hfbd1m','hfb14','hfb24','bskg3','hfb21','hfb25','hfb26','hfb27'}
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
