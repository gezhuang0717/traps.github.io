"""Bounded French source coverage; not a claim that every site text is translated."""
from pathlib import Path
import json
import re
import yaml

ROOT=Path(__file__).resolve().parents[1]
CURATED=("calibration_labels", "chain_labels", "chart_hints", "chart_state_labels", "country_labels",
         "daily_reading_labels", "lab_calculator_labels", "learning_labels", "nuclide_chart_labels",
         "panel_labels", "reader_navigation", "rfq_results", "tool_navigation", "trap_labels",
         "mass_filter_labels", "paper_topic_labels", "measured_labels", "nobel_labels",
         "workbench_labels", "game_additions", "games_labels", "laser_cooling", "databases")

def shape(reference, translated, location=""):
    if isinstance(reference,dict):
        assert set(reference)==set(translated),location
        for key in reference:shape(reference[key],translated[key],location+"/"+key)
    elif isinstance(reference,list):
        assert len(reference)==len(translated),location
        for index,(a,b) in enumerate(zip(reference,translated)):shape(a,b,f"{location}/{index}")
    elif isinstance(reference,str):
        assert isinstance(translated,str) and (not reference or translated.strip()),location
        placeholder=r"\{[A-Za-z_][A-Za-z0-9_]*\}"
        assert sorted(re.findall(placeholder,reference))==sorted(re.findall(placeholder,translated)),location

def test_french_main_routes_and_menu_have_real_french_content():
    site=yaml.safe_load((ROOT/"site.yaml").read_text())
    assert [x["code"] for x in site["languages"]]==["en","zh","fi","de","ja","fr"]
    for item in site["menu"]:
        assert item["label"]["fr"]
        route=ROOT/"content/fr"/item["page"]
        assert route.with_suffix(".md").exists() or (route/"_index.md").exists()
    assert "Chercheur" in (ROOT/"content/fr/_index.md").read_text()
    research=(ROOT/"content/fr/research.md").read_text().strip()
    assert research.endswith("{{< trap-zoo >}}")
    assert "../games/#spectroscopy-trail" in research
    assert "{{< spectroscopy-games >}}" not in research
    assert (ROOT/"content/fr/games.md").read_text().count("{{< spectroscopy-games >}}") == 1

def test_curated_french_roots_cover_every_current_english_key_and_placeholder():
    for name in CURATED:
        path=next(p for p in [ROOT/"data"/(name+".yaml"),ROOT/"data"/(name+".json")] if p.exists())
        data=yaml.safe_load(path.read_text())
        owner=data.get("labels",data)
        shape(owner["en"],owner["fr"],name)
        prior=["en","zh"] if name=="paper_topic_labels" else ["en","zh","fi","de","ja"]
        assert all(language in owner for language in prior+["fr"]),name

def test_french_i18n_retains_calendar_and_publication_controls():
    en=yaml.safe_load((ROOT/"i18n/en.yaml").read_text())
    fr=yaml.safe_load((ROOT/"i18n/fr.yaml").read_text())
    shape(en,fr,"i18n")
    assert len(fr["zg_months"].split(","))==12
    assert len(fr["zg_weekdays"].split(","))==7
    assert fr["zg_pub_reset"]=="Réinitialiser les filtres"
