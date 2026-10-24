#!/usr/bin/env python3
"""Compact AME2020 reference table for the reference-isotope helper on the research page.

Run from website/:  python3 tools/make_ame_reference.py          (writes static/data/research-cache/ame2020-reference.json)
Verify without writing: python3 tools/make_ame_reference.py --check

Input is static/data/ame2020-reactions.json (tools/make_ame_reactions.py: official mass_1.mas20, rct1.mas20 and rct2_1.mas20, published values and
published uncertainties, '#' extrapolation flags kept). Nothing is recomputed here and no uncertainty is substituted by an independent
combination of neighbouring mass errors; the browser derives only the atomic mass in u (A + ME / u) and the total binding energy (A x published
BE/A, which is exactly how the reactions file defines BE).

Schema zg-ame2020-reference-v2: columns = Z, N, symbol, then for each quantity q in QUANTITIES four columns q, q_s, q_x, q_d
(value, published uncertainty, 1 when the published value is an extrapolation '#', number of decimals printed in the AME2020 table; the value and the
uncertainty always share it, so a page can print them exactly as published). Units: keV, except bea = keV per nucleon. null = not published.
The published atomic mass (micro-u, mass_1.mas20 columns "ATOMIC MASS") follows as amu, amu_s, amu_x, amu_d; it is read from the original text file,
not recomputed from the mass excess (the table's atomic mass and its uncertainty are rounded independently of the mass excess).
"""
from pathlib import Path
import argparse
import json
import hashlib
import os
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "static/data/ame2020-reactions.json"
MASS = ROOT / "tools/data/ame2020/mass_1.mas20.txt"
OUT = ROOT / "static/data/research-cache/ame2020-reference.json"
QUANTITIES = ["me", "bea", "sn", "s2n", "sp", "s2p", "qbm", "qa", "q2bm"]
LABELS = {"me": "mass excess", "bea": "binding energy per nucleon", "sn": "S(n)", "s2n": "S(2n)", "sp": "S(p)", "s2p": "S(2p)",
          "qbm": "Q(beta-)", "qa": "Q(alpha)", "q2bm": "Q(2beta-)"}


TAIL = re.compile(r"(\d+)\s+([0-9#.]+)\s+([0-9#.]+)\s*$")


def decimals(token):
    """Digits after the decimal point of a published token; '#' replaces the decimal point of an extrapolated value (no decimals printed)."""
    parts = re.split(r"[.#]", token, maxsplit=1)
    return len(parts[1]) if len(parts) == 2 else 0


def atomic_mass(line):
    """(value, uncertainty, extrapolated, decimals) in micro-u from the ATOMIC MASS columns of one mass_1.mas20 line (the part after the beta-decay columns)."""
    m = TAIL.search(line[105:])
    if not m:
        raise ValueError("no atomic mass in line: " + line)
    macro, micro, unc = m.groups()
    est = "#" in micro or "#" in unc
    value = int(macro) * 1_000_000 + float(micro.replace("#", "."))
    return value, float(unc.replace("#", ".")), 1 if est else 0, decimals(micro)


def build():
    d = json.loads(SRC.read_text(encoding="utf8"))
    raw = MASS.read_bytes()
    mass_sha = [s["sha256"] for s in d["metadata"]["sources"] if s["filename"] == "mass_1.mas20.txt"][0]
    if hashlib.sha256(raw).hexdigest() != mass_sha:
        raise SystemExit("tools/data/ame2020/mass_1.mas20.txt is not the file the reactions table was built from")
    mass_lines = raw.decode("utf8").split("\n")
    columns = ["Z", "N", "symbol"] + [c for q in QUANTITIES for c in (q, q + "_s", q + "_x", q + "_d")] + ["amu", "amu_s", "amu_x", "amu_d"]
    rows = []
    for rec in d["records"].values():
        row = [rec["Z"], rec["N"], rec["element"]]
        for q in QUANTITIES:
            cell = rec["values"].get("BEA" if q == "bea" else q)
            if not cell or cell.get("value") is None:
                row += [None, None, None, None]
            else:
                assert decimals(cell["raw"]) == decimals(cell["raw_uncertainty"]), (rec["Z"], rec["N"], q)
                row += [cell["value"], cell.get("uncertainty"), 1 if cell.get("value_extrapolated") else 0, decimals(cell["raw"])]
        row += list(atomic_mass(mass_lines[rec["source_lines"]["mass"] - 1]))
        rows.append(row)
    rows.sort(key=lambda r: (r[0], r[1]))
    src = d["metadata"]["sources"]
    return {
        "schema": "zg-ame2020-reference-v2",
        "meta": {
            "name": "AME2020 reference table",
            "evaluation": "AME2020 (Huang et al. and Wang et al., Chin. Phys. C 45, 030002 and 030003, 2021)",
            "units": "keV; bea in keV per nucleon; amu in micro-u; u = 931494.10242 keV (CODATA 2018, as used by AME2020); _d = decimals printed in the AME2020 table",
            "labels": LABELS,
            "uncertainty": "published AME2020 uncertainties of each quantity (not combined from mass-excess marginals)",
            "derived_from": "static/data/ame2020-reactions.json; atomic mass from tools/data/ame2020/mass_1.mas20.txt",
            "sources": [{"filename": s["filename"], "url": s["url"], "sha256": s["sha256"]} for s in src],
            "rows": len(rows),
        },
        "columns": columns,
        "rows": rows,
    }


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
    new = json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
    if a.check:
        ok = OUT.exists() and OUT.read_text(encoding="utf8") == new
        print("current" if ok else "OUT OF DATE: run tools/make_ame_reference.py"); raise SystemExit(0 if ok else 1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=OUT.parent, suffix=".tmp"); os.close(fd)
    Path(tmp).write_text(new, encoding="utf8"); os.replace(tmp, OUT)
    print("wrote", OUT, len(new), "bytes")


if __name__ == "__main__":
    main()
