"""Scientific adapter and cache-failure contracts; no live network dependency."""
import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('research_data', ROOT/'tools/research_data.py')
rd = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rd)
INDEX = json.loads((ROOT/'static/data/research-cache/index.json').read_text())

def snapshot(key):
    spec = next(d for d in INDEX['datasets'] if d['key'] == key)
    body = json.loads((ROOT/'static/data/research-cache'/spec['cache']['file']).read_text())
    return spec, body

def test_all_snapshots_are_validated_and_content_addressed():
    import hashlib
    for spec in INDEX['datasets']:
        raw = (ROOT/'static/data/research-cache'/spec['cache']['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == spec['cache']['sha256']
        rd.validate(json.loads(raw), spec, rd.canonical_query(spec))

def test_historical_formats_reference_precision_flags_and_binding_units():
    for edition,count in [('ame2016',3436),('ame2003',3179),('ame1995',2931)]:
        spec,body=snapshot(edition)
        assert len(body['records'])==count
        c12=next(r for r in body['records'] if r['Z']==6 and r['A']==12)
        h1=next(r for r in body['records'] if r['Z']==1 and r['A']==1)
        assert c12['values']['atomic_mass_u']==12 and c12['values']['mass_excess_keV']==0
        assert any(r['flags']['mass_excess_keV']['estimated'] for r in body['records'])
        assert c12['values']['binding_energy_per_nucleon_keV'] == pytest.approx(7680,abs=2)
        if edition=='ame1995':
            assert h1['uncertainties']['atomic_mass_u']==0
            assert h1['flags']['atomic_mass_sigma']['rounded_zero_possible']
            assert c12['flags']['binding_source_convention']=='total_keV_divided_by_A'
        else:
            assert h1['uncertainties']['atomic_mass_u']>0
    assert rd.ame_field('  * ')[0] is None
    assert rd.ame_field(' 1#25 ')[0]==1.25
    assert rd.ame_field(' 1#25 ')[1]['estimated']

def test_be2_and_evaluated_reaction_errors_are_source_quantities():
    _,body=snapshot('be2-2016-ca-sn')
    assert any(r['Z']==20 for r in body['records']) and any(r['Z']==50 for r in body['records'])
    carbon=next(r for r in body['records'] if r['nuclide']=='12C')
    assert carbon['values']['be2_up_e2fm4']==pytest.approx(39.7)
    assert carbon['uncertainties']['be2_up_e2fm4']==pytest.approx(2)
    assert rd.be2_convert(39.7,12,'e2_fm4','e2_fm4','up','down')==pytest.approx(7.94)
    assert rd.be2_convert(.00397,12,'e2_b2','Wu')==pytest.approx(39.7/(.297*12**(4/3)))
    assert carbon['values']['be2_source_wu']==4.86588  # Retained independently of rounded guide coefficient.
    for edition in ('ame1995','ame2003','ame2016'):
        _,rct=snapshot(edition+'-rct2')
        ca40=next(r for r in rct['records'] if r['nuclide']=='40Ca')
        assert ca40['values']['sn_keV']>0
        assert ca40['flags']['sn_keV']['uncertainty_model']=='published_evaluated_table'

def test_network_error_and_query_failures_never_mutate_previous_cache(tmp_path):
    spec,body=snapshot('livechart-levels')
    source=next(s for s in INDEX['sources'] if s['id']==spec['source_id'])
    previous=rd.json_bytes(body)
    target=tmp_path/'previous.json';target.write_bytes(previous)
    with pytest.raises(ValueError):
        rd.request_dataset(spec,source,{},1,fetcher=lambda *a,**k:b'<html>error</html>')
    assert target.read_bytes()==previous
    with pytest.raises(ValueError):rd.canonical_query(spec,{'url':'https://example.invalid'})
    with pytest.raises(ValueError):rd.normalize_livechart('0',spec,spec['query'])
    bad=dict(body,query={'fields':'levels','nuclides':'16o'})
    with pytest.raises(ValueError):rd.validate(bad,spec,rd.canonical_query(spec))
