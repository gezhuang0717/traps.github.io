#!/usr/bin/env python3
"""Build static/data/periodic-table.json for the Games periodic-table panel.

Inputs (all in tools/periodic_source/):
  gui_dump.json       element data, names, definitions and translations extracted from the Mulberry GUI
  origins_johnson.tsv per-element origin codes (Johnson / OSU table, read from the Commons SVG)
  names_de_ja.tsv     hand-written German and Japanese names
  i18n_hand.json      hand-written labels, origin classes, definitions, sources

Usage:
  python tools/make_periodic_table.py          write static/data/periodic-table.json
  python tools/make_periodic_table.py --check  rebuild in memory and compare with the committed file

The output is deterministic (no timestamps) so --check can prove reproducibility.
Physical fixes applied to the GUI dump are listed in meta.fixes and guarded by assertions,
so a changed dump is noticed instead of being silently patched.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools" / "periodic_source"
OUT = ROOT / "static" / "data" / "periodic-table.json"

LANGS = ["en", "zh", "fi", "de", "ja", "fr"]
GUI_LANG = {"en": "en", "zh": "zh-hans", "fi": "fi", "fr": "fr"}  # languages present in the GUI dump
ORIGIN_ORDER = ["b", "j", "y", "o", "g", "c", "z"]
EV_TO_KJ_MOL = 96.4853321233  # 1 eV per particle in kJ/mol (CODATA 2018 exact: e*N_A/1000)
TRACE_Z = {84, 85, 86, 87, 88, 89, 91, 93, 94}  # Po-Ac, Pa, Np, Pu: only trace amounts in nature

# Colours shared by the website and the Mulberry GUI (group colours follow the usual textbook scheme).
GROUP_ORDER = ["Alkali Metal", "Alkaline Earth Metal", "Transition Metal", "Post-transition Metal", "Metalloid",
               "Nonmetal", "Halogen", "Noble Gas", "Lanthanide", "Actinide"]
GROUP_COLOR = {"Alkali Metal": "#ff6666", "Alkaline Earth Metal": "#ffdead", "Transition Metal": "#ffc0c0",
               "Post-transition Metal": "#cccccc", "Metalloid": "#cccc99", "Nonmetal": "#a0ffa0",
               "Halogen": "#ffff99", "Noble Gas": "#c0ffff", "Lanthanide": "#ffbfff", "Actinide": "#ff99cc"}
ORIGIN_COLOR = {"b": "#7b61c9", "j": "#e0729a", "y": "#e67e22", "o": "#2e86c1", "g": "#27ae60", "c": "#f4d03f", "z": "#9aa5b1"}
STATE_COLOR = {"Solid": "#d9dee5", "Liquid": "#8ecae6", "Gas": "#b9f0cf"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_rows(path: Path) -> list[list[str]]:
    """Read a '|'-separated table, skipping comment lines and blank lines."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            rows.append([c.strip() for c in line.split("|")])
    return rows


def strip_unit(label: str) -> str:
    """Remove the unit from a GUI property label ("Boiling Point (K)" -> "Boiling Point")."""
    label = label.replace(", pm)", ")")
    return re.sub(r"\s*\((K|kJ/mol|g/cm³)\)$", "", label)


def split_definitions(blob: str, count: int) -> list[str]:
    """Split a GUI definition blob ("Name: text" paragraphs) into the texts only."""
    texts = []
    for para in [p for p in blob.split("\n\n") if p.strip()]:
        m = re.match(r"^[^:：]+[:：]\s*(.*)$", para.strip(), re.S)
        texts.append((m.group(1) if m else para).strip())
    assert len(texts) == count, (len(texts), count)
    return texts


def isotope_list(sym: str, items: list[dict]) -> list[dict]:
    out = []
    for item in items:
        name, mass_number = item["isotope"].split("-")
        assert name == sym, item
        out.append({"a": int(mass_number), "pct": item["abundance"]})
    return sorted(out, key=lambda x: x["a"])


def apply_isotope_fixes(elements: dict, fixes: list[dict]) -> None:
    """Correct the GUI isotope tables (values: IUPAC 2013 natural abundances, percent)."""
    cd = {i["a"]: i["pct"] for i in elements["Cd"]["iso"]}
    assert 113 not in cd and abs(sum(cd.values()) - 87.78) < 1e-6, "Cd dump changed; re-audit"
    elements["Cd"]["iso"] = sorted(elements["Cd"]["iso"] + [{"a": 113, "pct": 12.22}], key=lambda x: x["a"])
    fixes.append({"element": "Cd", "what": "added missing 113Cd 12.22 % (GUI table summed to 87.78 %)"})
    se = {i["a"]: i["pct"] for i in elements["Se"]["iso"]}
    assert se == {74: 0.86, 76: 9.23, 77: 7.6, 78: 23.77, 80: 49.61, 82: 8.73}, "Se dump changed; re-audit"
    for item in elements["Se"]["iso"]:
        item["pct"] = {74: 0.89, 76: 9.37, 77: 7.63}.get(item["a"], item["pct"])
    fixes.append({"element": "Se", "what": "74Se 0.86->0.89, 76Se 9.23->9.37, 77Se 7.60->7.63 % (sum 99.80 -> 100.00 %)"})


# Atomic masses that the GUI stored rounded or outdated; replaced by the CIAAW abridged standard atomic weights
# (2024 edition, conventional values, https://ciaaw.org/abridged-atomic-weights.htm): symbol -> (value in the dump, corrected value).
MASS_FIXES = {"Li": (7.0, 6.94), "S": (32.07, 32.06), "Ar": (39.9, 39.95), "Ca": (40.08, 40.078), "Fe": (55.84, 55.845), "Cu": (63.55, 63.546),
              "Zn": (65.4, 65.38), "Se": (78.97, 78.971), "Br": (79.9, 79.904), "Kr": (83.8, 83.798), "Zr": (91.22, 91.222), "Ru": (101.1, 101.07),
              "Sm": (150.4, 150.36), "Os": (190.2, 190.23), "Pb": (207, 207.2)}


def apply_mass_fixes(elements: dict, fixes: list[dict]) -> None:
    """Replace rounded / outdated atomic masses; the assertion notices a changed dump."""
    for sym, (old, new) in MASS_FIXES.items():
        assert elements[sym]["mass"] == old, f"{sym} mass in the dump changed; re-audit"
        elements[sym]["mass"] = new
    fixes.append({"element": ", ".join(MASS_FIXES), "what": "atomic mass replaced by the CIAAW abridged standard atomic weight (e.g. Li 7 -> 6.94, Fe 55.84 -> 55.845, Pb 207 -> 207.2); "
                  "the other masses already agree with CIAAW at its printed precision; radioactive elements keep the mass of a representative isotope"})


def build() -> dict:
    gui = json.loads((SRC / "gui_dump.json").read_text(encoding="utf-8"))
    hand = json.loads((SRC / "i18n_hand.json").read_text(encoding="utf-8"))
    de_ja = {int(r[0]): r for r in read_rows(SRC / "names_de_ja.tsv")}
    origin_rows = {r[0]: r for r in read_rows(SRC / "origins_johnson.tsv")}
    assert len(gui["elements"]) == 118 and len(de_ja) == 118

    fixes: list[dict] = []
    elements = []
    for sym, e in gui["elements"].items():
        z = e["Proton Number"]
        assert de_ja[z][1] == sym, (z, sym, de_ja[z])
        if z <= 103:
            codes = origin_rows[sym][4]
        else:
            codes = "z"  # Rf..Og are absent from the Johnson table: human synthesis only
        assert set(codes) <= set(ORIGIN_ORDER), (sym, codes)
        names = {GUI_LANG[l]: None for l in GUI_LANG}
        names = {l: gui["full_name"][GUI_LANG[l]][sym] for l in GUI_LANG}
        names["de"], names["ja"] = de_ja[z][2], de_ja[z][3]
        row, col = e["pos"]
        elements.append({
            "z": z, "sym": sym, "names": {l: names[l] for l in LANGS}, "row": row, "col": col,
            "block": e["Chemical Group Block"], "mass": e["Atomic Mass"], "state": e["Standard State"],
            "config": e["Electron Configuration"], "ox": e["Oxidation States"],
            "chi": e["Electronegativity (Pauling)"], "radius": e["Atomic Radius (van der Waals, pm)"],
            # The GUI labels these two "kJ/mol" but the numbers are eV (H 13.598, EA(H) 0.754).
            "ie": e["Ionization Energy (kJ/mol)"], "ea": e["Electron Affinity (kJ/mol)"],
            "mp": e["Melting Point (K)"], "bp": e["Boiling Point (K)"], "density": e["Density (g/cm³)"],
            "year": e["Year Discovered"], "country": e["Discovery Country"],
            "origin": [c for c in ORIGIN_ORDER if c in codes], "trace": z in TRACE_Z,
            "iso": isotope_list(sym, e["Stable Isotopes"]),
        })
    elements.sort(key=lambda x: x["z"])
    assert [x["z"] for x in elements] == list(range(1, 119))
    by_sym = {x["sym"]: x for x in elements}
    apply_isotope_fixes(by_sym, fixes)
    apply_mass_fixes(by_sym, fixes)
    fixes.insert(0, {"element": "all", "what": "ionization energy and electron affinity are eV (the GUI labelled them kJ/mol); kJ/mol = eV x 96.485 is computed on display"})
    fixes.append({"element": "Rf-Og", "what": "origin class 'z' (human synthesis); the Johnson table stops at Lr"})
    fixes.append({"element": "all", "what": "origin is a set of sources (Johnson/OSU) instead of one label; 74 of 118 GUI entries said 'Merging Neutron Stars'"})

    prop = hand["properties"]
    order = prop["order"]
    # Property labels (unit removed) and definitions in six languages.
    labels = {l: {} for l in LANGS}
    defs = {l: {} for l in LANGS}
    for l in ("en", "zh", "fi", "fr"):
        pn = gui["property_names"][GUI_LANG[l]]
        texts = split_definitions(gui["definitions"][GUI_LANG[l]], len(order))
        for key, text in zip(order, texts):
            labels[l][key] = strip_unit(pn[prop["gui_key"][key]])
            defs[l][key] = text
        defs[l].update(hand["properties"]["definition"][l])
    for l in ("de", "ja"):
        labels[l] = dict(prop["label"][l])
        defs[l] = dict(prop["definition"][l])
    for l in LANGS:
        assert set(labels[l]) == set(order) == set(defs[l]), l

    groups_label = {l: dict(gui["group_block_translations"][GUI_LANG[l]]) for l in GUI_LANG}
    groups_label["zh"].update(hand["groups"]["zh_override"])
    groups_label["de"], groups_label["ja"] = hand["groups"]["de"], hand["groups"]["ja"]
    for l in LANGS:
        assert set(groups_label[l]) == set(GROUP_ORDER), l

    inputs = {n: sha256(SRC / n) for n in ("gui_dump.json", "origins_johnson.tsv", "names_de_ja.tsv", "i18n_hand.json")}
    return {
        "meta": {
            "title": "Periodic table data for the Games panel and the Mulberry GUI",
            "units": {"mass": "u", "radius": "pm", "ie": "eV", "ea": "eV", "mp": "K", "bp": "K", "density": "g/cm3",
                      "iso": "natural abundance, percent", "ev_to_kj_mol": EV_TO_KJ_MOL},
            "origin_note": "Origin classes are qualitative sets after Johnson (OSU); no percentages are implied. "
                           "The r-process site (neutron-star mergers vs. other sources) is debated.",
            "fixes": fixes, "sources": hand["sources"], "inputs_sha256": inputs,
            "generator": "tools/make_periodic_table.py",
        },
        "i18n": {
            "languages": LANGS,
            "groups": {"order": GROUP_ORDER, "color": GROUP_COLOR, "label": groups_label},
            "states": {"order": ["Solid", "Liquid", "Gas"], "color": STATE_COLOR, "label": hand["states"]},
            "origins": {"order": ORIGIN_ORDER, "color": ORIGIN_COLOR,
                        "label": {l: {c: hand["origins"][c]["label"][l] for c in ORIGIN_ORDER} for l in LANGS},
                        "desc": {l: {c: hand["origins"][c]["desc"][l] for c in ORIGIN_ORDER} for l in LANGS},
                        "trace": hand["trace"]},
            "properties": {"order": order, "unit": prop["unit"], "numeric": prop["numeric"], "label": labels, "definition": defs},
        },
        "elements": elements,
    }


def dumps(data: dict) -> str:
    """Stable serialisation: one top-level key per block, one element per line (small diffs)."""
    def j(x):
        return json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    lines = ["{", f'"meta":{j(data["meta"])},', f'"i18n":{j(data["i18n"])},', '"elements":[']
    lines += [j(e) + ("," if i < len(data["elements"]) - 1 else "") for i, e in enumerate(data["elements"])]
    lines += ["]", "}", ""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="compare a fresh build with the committed JSON")
    args = ap.parse_args()
    text = dumps(build())
    json.loads(text)  # the serialisation must stay valid JSON
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print(f"MISMATCH: {OUT} differs from a fresh build", file=sys.stderr)
            return 1
        print(f"OK: {OUT.relative_to(ROOT)} reproduces ({len(text)} bytes)")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(text)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
