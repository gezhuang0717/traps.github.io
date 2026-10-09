import os,sys,shutil,subprocess
from pathlib import Path
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import publish

def test_stylesheet_missing_icons_are_reported_and_resolve_after_addition(tmp_path,monkeypatch):
    monkeypatch.setattr(publish,'PUBLIC',tmp_path)
    css=tmp_path/'vendor/map';css.mkdir(parents=True)
    (css/'map.css').write_text('/* url(ignored.png) */ .a{background:url("images/layers.png")} .b{background:url(data:image/png;base64,AA)} .c{background:url(//cdn.example.test/icon.png)}')
    gate=publish.Gate();assert not publish.check_links(gate,'https://example.test/traps.github.io/')
    assert len(gate.results[0]['items'])==1 and 'images/layers.png' in gate.results[0]['items'][0]
    (css/'images').mkdir();(css/'images/layers.png').write_bytes(b'icon fixture')
    assert publish.check_links(publish.Gate(),'https://example.test/traps.github.io/')

def test_srcset_and_project_absolute_assets(tmp_path,monkeypatch):
    monkeypatch.setattr(publish,'PUBLIC',tmp_path)
    (tmp_path/'index.html').write_text('<img srcset="/traps.github.io/a.png 1x, /traps.github.io/b.png 2x">')
    (tmp_path/'a.png').write_bytes(b'a')
    gate=publish.Gate();assert not publish.check_links(gate,'https://example.test/traps.github.io/')
    assert len(gate.results[0]['items'])==1 and 'b.png' in gate.results[0]['items'][0]
    (tmp_path/'b.png').write_bytes(b'b')
    assert publish.check_links(publish.Gate(),'https://example.test/traps.github.io/')

def test_real_hugo_resolved_markdown_links_preserve_query_and_fragment_in_five_languages(tmp_path):
    hugo=os.environ.get('HUGO_TEST_BIN') or shutil.which('hugo')
    if not hugo:pytest.skip('Pinned Hugo required; installed in CI before tests')
    root=Path(__file__).resolve().parents[1]
    layouts=tmp_path/'layouts';(layouts/'_markup').mkdir(parents=True)
    (layouts/'_markup/render-link.html').write_bytes((root/'layouts/_markup/render-link.html').read_bytes())
    (layouts/'single.html').write_text('{{ .Content }}')
    config=['baseURL="https://example.test/traps.github.io/"','defaultContentLanguage="en"','disableKinds=["taxonomy","term","RSS","sitemap","robotsTXT","404"]']
    for lang in ('en','zh-hans','fi','de','ja'):
        content=tmp_path/'content'/lang;content.mkdir(parents=True)
        (content/'from.md').write_text('---\ntitle: From\n---\n[State](../lab/?nuclide=116Sn&state=1#details)\n')
        (content/'lab.md').write_text('---\ntitle: Lab\n---\n## Details\n')
        config.extend([f'[languages.{lang}]',f'contentDir="content/{lang}"'])
    (tmp_path/'hugo.toml').write_text('\n'.join(config)+'\n')
    env={**os.environ,'GOMAXPROCS':'1','GOMEMLIMIT':'96MiB'}
    result=subprocess.run([hugo,'--source',str(tmp_path),'--destination',str(tmp_path/'public'),'--noBuildLock'],env=env,text=True,capture_output=True)
    assert result.returncode==0,result.stderr
    for lang in ('en','zh-hans','fi','de','ja'):
        prefix='' if lang=='en' else lang+'/'
        links=publish.Links();links.feed((tmp_path/'public'/prefix/'from/index.html').read_text())
        assert links.urls==[f'https://example.test/traps.github.io/{prefix}lab/?nuclide=116Sn&state=1#details']
