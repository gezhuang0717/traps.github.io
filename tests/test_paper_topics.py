from pathlib import Path
import json,yaml
ROOT=Path(__file__).resolve().parents[1]
def test_topic_registry_and_classification_preserve_old_publications():
 registry=json.loads((ROOT/'data/paper_topics.json').read_text())
 ids=[t['id'] for t in registry['topics']]
 assert len(ids)==len(set(ids))==24
 assert set(['nz','neutrino','isotope-shift','detectors']).issubset(ids)
 for t in registry['topics']:
  for key in ['name','description','observables']:assert t[key]['en'] and t[key]['zh']
  assert t['sources'] and all(s['url'].startswith('https://') for s in t['sources'])
 papers=yaml.safe_load((ROOT/'data/publications.yaml').read_text())['papers'];assert len(papers)==100
 for p in papers:assert set(p.get('topics',[])).issubset(ids) and len(p.get('topics',[]))==len(set(p.get('topics',[])))
 by_title={p['title']:p for p in papers}
 neutron=next(p for p in papers if 'correlated free four-neutron' in p['title'])
 assert 'multi-neutron' in neutron['topics'] and 'mass-innovations' not in neutron['topics']
 rpc=[p for p in papers if 'resistive-plate-chambers' in p.get('topics',[])]
 assert not rpc # MCP papers must not be relabelled RPC.
 assert all('nova-reactions' not in p.get('topics',[]) for p in papers if 'Big-Bang' in p['title'] or 'SNe temperature' in p['title'])
