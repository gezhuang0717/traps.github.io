from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def test_final_traps_promotion_and_obvious_ring_control():
 s=(ROOT/'.github/workflows/hugo.yml').read_text()
 assert 'HUGO_PARAMS_TESTSITE=false' in s and 'HUGO_PARAMS_ROBOTS=index, follow' in s
 chart=(ROOT/'layouts/_shortcodes/nuclide-chart.html').read_text()
 toolbar=chart.split('nc-plot-toolbar',1)[1].split('</div>',1)[0]
 assert 'name="nc-reference-ring"' in toolbar and 'checked' in toolbar and '#e5484d' in toolbar
 assert chart.count('name="nc-reference-ring"')==1

def test_reviewed_facility_relationships_preserve_canonical_export():
 canonical=json.loads((ROOT/'data/facilities/facilities.json').read_text())['facilities']
 exported=json.loads((ROOT/'static/data/facilities.json').read_text())['facilities']
 ids=['igisol-jyfltrap','frib','cern-isolde','triumf-isac','riken-ribf','gsi-fair','mpik-heidelberg']
 for fid in ids:
  a=next(f for f in canonical if f['id']==fid);b=next(f for f in exported if f['id']==fid)
  assert a==b and a['host']['en'] and a['description']['zh']
  assert a['research_units'] and a['content_checked']=='2026-10-10'
  assert all(u['url'] in a['source_urls'] and u['purpose']['zh'] for u in a['research_units'])
 assert 'KISS' not in next(f for f in canonical if f['id']=='riken-ribf')['name']['en']
