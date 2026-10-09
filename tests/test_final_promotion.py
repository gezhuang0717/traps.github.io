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


def test_testsite_ribbon_honours_boolean_and_text_environment_values(tmp_path):
 import os,shutil,subprocess
 import pytest
 hugo=shutil.which('hugo')
 if not hugo:pytest.skip('Pinned Hugo not on PATH')
 fixture=tmp_path/'ribbon';(fixture/'layouts/_partials/zg').mkdir(parents=True)
 (fixture/'layouts/home.html').write_text('{{ partial "zg/fun.html" . }}')
 (fixture/'layouts/_partials/zg/fun.html').write_bytes((ROOT/'layouts/_partials/zg/fun.html').read_bytes())
 (fixture/'layouts/_partials/zg/glossary.html').write_text('')
 # Production CI sets this override globally. Isolate config cases, then test
 # the real environment override explicitly so CI cannot mask either path.
 clean_env={k:v for k,v in os.environ.items() if k!='HUGO_PARAMS_TESTSITE'}
 for value,override,expected in [(False,None,False),('false',None,False),(True,None,True),('true',None,True),(True,'false',False),(False,'true',True)]:
  (fixture/'hugo.json').write_text(json.dumps({'baseURL':'https://example.org/','params':{'testsite':value}}))
  env={**clean_env,'GOMAXPROCS':'1','GOMEMLIMIT':'96MiB'}
  if override is not None:env['HUGO_PARAMS_TESTSITE']=override
  result=subprocess.run([hugo,'--source',str(fixture),'--destination',str(fixture/'public'),'--noBuildLock'],capture_output=True,text=True,env=env)
  assert result.returncode==0,result.stderr
  assert ('TEST SITE' in (fixture/'public/index.html').read_text())==expected
