"""Schema checks for data/databases.yaml (Databases page)."""
from pathlib import Path
import json
import os
import shutil
import subprocess

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
D = yaml.safe_load((ROOT / "data" / "databases.yaml").read_text(encoding="utf-8"))
LANGS = ("en", "zh", "fi", "de", "ja", "fr")


def test_labels_complete_in_six_languages():
    keys = set(D["labels"]["en"])
    for lang in LANGS:
        assert set(D["labels"][lang]) == keys, lang
        assert all(isinstance(v, str) for v in D["labels"][lang].values())


def test_categories_have_six_language_names():
    for c in D["categories"]:
        assert set(LANGS) <= set(c["name"]), c["key"]


def test_items_valid():
    cats = {c["key"] for c in D["categories"]}
    ids = [i["id"] for i in D["items"]]
    assert len(ids) == len(set(ids))
    for i in D["items"]:
        assert i["cat"] in cats, i["id"]
        assert i["url"].startswith(("https://", "http://")), i["id"]
        assert "k_" + i["kind"] in D["labels"]["en"], i["id"]
        for f in ("short", "what"):
            assert i[f]["en"].strip(), (i["id"], f)
        if "use" in i:
            assert isinstance(i["use"]["en"], list) and i["use"]["en"], i["id"]


def test_nndc_networks_listed():
    urls = {i["url"] for i in D["items"]}
    assert "https://www.nndc.bnl.gov/networks/" in urls


def test_every_visible_french_card_category_and_term_resolves_without_english_fallback():
    # These are exactly the locale-valued fields consumed by the Databases shortcode.
    for category in D["categories"]:
        assert category["name"]["fr"].strip()
        assert category["name"]["fr"] != category["name"]["en"]
    for item in D["items"]:
        for field in ("short", "what", "use", "tips", "cite"):
            value = item.get(field)
            if not isinstance(value, dict):  # Literal resource names and bibliography remain original.
                continue
            assert "fr" in value, (item["id"], field)
            assert isinstance(value["fr"], type(value["en"])), (item["id"], field)
            if isinstance(value["en"], list):
                assert len(value["fr"]) == len(value["en"]) > 0
                assert all(isinstance(step, str) and step.strip() for step in value["fr"])
            else:
                assert value["fr"].strip(), (item["id"], field)
                # This exact constants equation is intentionally language-independent.
                if (item["id"], field) != ("codata", "tips"):
                    assert value["fr"] != value["en"], (item["id"], field)
    for term in D["terms"]:
        assert all(term[field]["fr"].strip() for field in ("name", "text")), term["key"]
    # Protect semantic distinctions that must remain in the operator guidance.
    by_id = {item["id"]: item for item in D["items"]}
    assert "inconnue" in by_id["livechart-api"]["tips"]["fr"]
    assert "corrélées" in " ".join(by_id["amdc"]["use"]["fr"])
    assert "facteur cinq" in by_id["be2"]["tips"]["fr"]
    assert "citez la version" in by_id["qspec"]["cite"]["fr"]
    assert "10.1016/j.cpc.2025.109550" in by_id["qspec"]["cite"]["fr"]


def test_all_english_locale_maps_have_french_strings_or_lists():
    def walk(value, path="databases"):
        if isinstance(value, dict):
            if "en" in value:
                assert "fr" in value, path
                assert isinstance(value["fr"], type(value["en"])), path
            for key, child in value.items():
                walk(child, path + "/" + str(key))
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, path + "/" + str(index))
    walk(D)


def test_actual_lookup_handler_renders_french_controls_and_keeps_scientific_source_links():
    node = os.environ.get("NODE_TEST_BIN") or shutil.which("node")
    if not node:
        pytest.skip("Node required for the real progressive-enhancement handler")
    source = (ROOT / "static/js/databases.js").read_text()
    nb = json.loads((ROOT / "static/data/nubase2020.json").read_text())
    ca40 = next(row for row in nb["rows"] if row[0] == row[1] == 20)
    payload = {"labels": D["labels"]["fr"], "nb": {"elements": nb["elements"], "rows": [ca40]}, "source": source}
    script = r"""
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync(0,'utf8')),nodes=new Map();
function node(key){if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,listeners:{},classList:{toggle(){},add(){}},addEventListener(type,fn){this.listeners[type]=fn;},querySelector(q){return node(key+' '+q);},querySelectorAll(){return[];}});return nodes.get(key);}
const root=node('root');root.dataset={labels:JSON.stringify(data.labels),nubase:'/data/nubase2020.json',chart:'/fr/lab/'};
root.querySelector=q=>q==='.zg-db-dialog'?null:node(q);root.querySelectorAll=()=>[];
node('.zg-db-tools [name=q]').value='';node('.zg-db-lookup-f [name=nuc]').value='40Ca';
const context={document:{querySelector:()=>root},localStorage:{getItem:()=>null},location:{hash:'',href:'https://example.test/fr/databases/'},fetch:async()=>({json:async()=>data.nb}),Promise,setTimeout};
vm.runInNewContext(data.source,context);node('.zg-db-lookup-f').listeners.submit();
setImmediate(()=>{const html=node('.zg-db-lookup-out').innerHTML;
 for(const text of ['Excès de masse','Demi-vie','Spin/parité','Modes de désintégration','Découverte','API IAEA LiveChart (CSV)','Wikipédia','Carte de ce site'])assert.ok(html.includes(text),text);
 for(const text of ['Mass excess','Half-life','Decay modes','Discovered','IAEA LiveChart API (CSV)'])assert.ok(!html.includes(text),text);
 assert.ok(html.includes('AME2020'));assert.ok(html.includes('keV'));assert.ok(html.includes('nuclides=40ca'));assert.ok(html.includes('https://en.wikipedia.org/wiki/Isotopes_of_calcium'));assert.ok(html.includes('/fr/lab/?nuclide=40Ca'));
 assert.equal(node('.zg-db-tools .zg-db-count').textContent,'0 ressources affichées');
 process.stdout.write('French lookup handler passed\n');});
"""
    run = subprocess.run([node, "-e", script], input=json.dumps(payload), text=True, capture_output=True, timeout=20)
    assert run.returncode == 0, run.stdout + run.stderr
    assert "French lookup handler passed" in run.stdout
