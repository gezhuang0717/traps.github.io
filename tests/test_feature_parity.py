"""Accepted public features/data must survive later versions and exports."""
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from tools import maintenance, site

ROOT=Path(__file__).resolve().parents[1]

def test_daily_baseline_is_preserved_and_public_export_matches_canonical():
    baseline=json.loads((ROOT/'tests/feature-parity-baseline.json').read_text())
    entries=site.all_entries()
    identity=lambda e:(maintenance.item_identity(e),e.get('lang',''))
    actual={identity(e) for e in entries}
    assert set(map(tuple,baseline['required_entries']))<=actual
    assert len([e for e in entries if e['date']=='2026-10-09'])>=baseline['required_2026_10_09_entries']
    exported=json.loads((ROOT/'static/data/daily.json').read_text())['entries']
    assert {identity(e) for e in exported}==actual
    for e in entries:maintenance.validate_daily(e)

def test_traps_has_scheduled_daily_collection_validation_and_publication():
    workflow=(ROOT/'.github/workflows/hugo.yml').read_text()
    for job,next_job in [('daily','validate'),('validate','deploy')]:
        section=workflow.split('\n  '+job+':',1)[1].split('\n  '+next_job+':',1)[0]
        assert "github.repository == 'gezhuang0717/traps.github.io'" in section
    assert 'tools/site.py fetch' in workflow and 'git pull --rebase --autostash origin main' in workflow

def test_existing_model_families_and_reference_marker_controls_are_preserved():
    baseline=json.loads((ROOT/'tests/feature-parity-baseline.json').read_text())
    models=json.loads((ROOT/'static/data/massmodels-index.json').read_text())['models']
    assert len(models)>=baseline['required_models']
    assert {'ws4','ws4rbf','ktuy05','frdm2012','hfb27'}<=set(models)
    chart=(ROOT/'layouts/_shortcodes/nuclide-chart.html').read_text()
    for feature in ['nc-reference-ring','nc-band','nc-residual','nc-exp-filter','nc-impact-quantity','nc-marker-rows']:
        assert feature in chart or feature in (ROOT/'layouts/_partials/zg/measured-masses.html').read_text()
