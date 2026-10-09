"""Render the actual bibliography templates; prevent implicit list-count and role regressions."""
import hashlib,importlib.util,os,shutil,subprocess,sys
from pathlib import Path
from html.parser import HTMLParser
import pytest,yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('website_site',ROOT/'tools/site.py')
site=importlib.util.module_from_spec(spec);spec.loader.exec_module(site)

def test_first_author_does_not_implicitly_assign_corresponding_authorship():
    assert 'corresponding' not in site.clean_pub({'role':'first','year':2026,'title':'First only'})
    assert site.clean_pub({'role':'first','corresponding':False,'year':2026,'title':'Explicit false'})['corresponding'] is False

class Papers(HTMLParser):
    def __init__(self,text):
        super().__init__();self.starts=[];self.papers=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='ol' and a.get('class')=='zg-papers':self.starts.append(a.get('start'))
        if tag=='li' and a.get('class')=='zg-paper':self.papers.append(a)

def test_hugo_numbering_and_independent_roles_in_all_languages(tmp_path):
    hugo=os.environ.get('HUGO_TEST_BIN') or shutil.which('hugo')
    if not hugo:pytest.skip('Pinned Hugo required; installed in CI before tests')
    for rel in ['layouts/_shortcodes/pubs.html','layouts/_shortcodes/publication-search.html','layouts/_partials/zg/paper.html','data/publications.yaml','static/js/publication-search.js']+[f'i18n/{l}.yaml' for l in ('en','zh','fi','de','ja')]:
        target=tmp_path/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/rel).read_bytes())
    (tmp_path/'layouts/single.html').write_text('{{ .Content }}')
    config=['baseURL="https://example.test/traps.github.io/"','defaultContentLanguage="en"','disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in ('en','zh','fi','de','ja'):
        content=tmp_path/'content'/lang;content.mkdir(parents=True)
        (content/'publications.md').write_bytes((ROOT/'content'/lang/'publications.md').read_bytes())
        (content/'roles.md').write_text('---\ntitle: Roles\n---\n{{< pubs role="corresponding" >}}')
        config.extend([f'[languages.{lang}]',f'contentDir="content/{lang}"'])
    # Future corresponding coauthor must be included in Main without double listing.
    data=yaml.safe_load((tmp_path/'data/publications.yaml').read_text())
    data['papers'] += [dict(role='coauthor',corresponding=True,position=3,year=2026,title='Corresponding fixture'),dict(role='first',year=2026,title='First-only fixture')]
    (tmp_path/'data/publications.yaml').write_text(yaml.safe_dump(data,allow_unicode=True))
    (tmp_path/'hugo.toml').write_text('\n'.join(config)+'\n')
    result=subprocess.run([hugo,'--source',str(tmp_path),'--destination',str(tmp_path/'public'),'--noBuildLock'],env={**os.environ,'GOMAXPROCS':'1','GOMEMLIMIT':'96MiB'},capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    for lang in ('en','zh','fi','de','ja'):
        base=tmp_path/'public'/('' if lang=='en' else lang)
        html=(base/'publications/index.html').read_text();p=Papers(html)
        version=hashlib.sha256((ROOT/'static/js/publication-search.js').read_bytes()).hexdigest()[:12]
        assert 'js/publication-search.js?v='+version in html
        assert len(p.papers)==102 and p.starts==['26']
        assert [int(x['value']) for x in p.papers if 'value' in x]==list(range(26,0,-1))
        corresponding=Papers((base/'roles/index.html').read_text()).papers
        assert len(corresponding)==23 and all(x['data-corresponding']=='true' for x in corresponding)
