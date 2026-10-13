"""Production config regeneration must retain interactive-control styling."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]

def test_production_config_retains_canonical_dialog_and_playback_styles(tmp_path,monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT/'tools'))
    spec=importlib.util.spec_from_file_location('theme_css_site',ROOT/'tools/site.py')
    site=importlib.util.module_from_spec(spec);spec.loader.exec_module(site)
    canonical=(ROOT/'assets/css/extended/zg-rainbow.css').read_text()
    # This assertion catches editing only the generated copy, which CI replaces.
    checked_copy=(ROOT/'assets/css/custom.css').read_text().split('\n',1)[1]
    assert checked_copy==canonical
    source=tmp_path/'assets/css/extended/zg-rainbow.css';source.parent.mkdir(parents=True);source.write_text(canonical)
    monkeypatch.setattr(site,'ROOT',tmp_path)
    monkeypatch.setattr(site,'deployment_config',lambda:{'live_theme':'congo','languages':[],'rainbow':True})
    monkeypatch.setattr(site,'gen_congo_like',lambda cfg,theme:tmp_path/'sites'/theme)
    monkeypatch.setattr(site,'gen_papermod',lambda cfg:tmp_path/'sites/papermod')
    site._cmd_config_direct(None)
    regenerated=(tmp_path/'assets/css/custom.css').read_text()
    assert regenerated.split('\n',1)[1]==canonical
    # The production output must have the actual positioning and both UI groups.
    base_rule=regenerated.split('.zg-cal-pop{',1)[1].split('}',1)[0]
    assert 'position:fixed' in base_rule and 'inset:0' in base_rule
    assert '.zg-cal-head{' in regenerated and '.g-playback{' in regenerated
