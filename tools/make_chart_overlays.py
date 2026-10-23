#!/usr/bin/env python3
"""Compact overlay tables for the chart of nuclides.

1. static/data/research-cache/be2-compact.json
   from the complete NNDC adopted B(E2) JSON (https://www.nndc.bnl.gov/be2/data/adopted-entries.json), saved as raw JSON.
   columns: Z, N, E2_keV, sigma_E2_keV, B(E2)up (e2 b2), sigma, beta2, sigma_beta2.
2. static/data/research-cache/ame-editions-compact.json
   from the validated AME1995/2003/2016 caches already in static/data/research-cache/.
   rows per edition: [Z, N, mass_excess_keV, sigma_keV, estimated(0/1)]; unknown sigma stays null.
Usage: python tools/make_chart_overlays.py --be2 RAW.json [--check]
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "static/data/research-cache"
EDITIONS = {"ame1995": "ame1995--b788736036d0c3b0.json", "ame2003": "ame2003--4f5d3418ae510ef2.json", "ame2016": "ame2016--fd2b0b9c190b6f6b.json"}


def val(entry, key):
    obj = entry.get(key)
    if not obj or obj.get("value") is None:
        return None, None
    err = obj.get("error")
    return float(obj["value"]), (float(err) if err is not None else None)


def be2_table(raw_path):
    raw_bytes = Path(raw_path).read_bytes()
    rows, chosen = [], {}
    for e in json.loads(raw_bytes):
        n = e["nuclide"]
        year = 2016 if "2016" in e["reference"] else 2001
        key = (n["z"], n["n"])
        if key not in chosen or year > chosen[key][0]:  # the 2016 evaluation supersedes Raman 2001 for the same nuclide
            chosen[key] = (year, e)
    for (z, nn), (year, e) in chosen.items():
        energy, s_energy = val(e, "transitionEnergy")
        b, s_b = val(e, "be2")
        beta, s_beta = val(e, "deformationParameter")
        if energy is None and b is None:
            continue
        rows.append([z, nn, energy, s_energy, b, s_b, beta, s_beta, year])
    rows.sort(key=lambda r: (r[0], r[1]))
    return {
        "schema_version": 1,
        "columns": ["Z", "N", "E2_keV", "sigma_E2_keV", "be2_up_e2b2", "sigma_be2_up_e2b2", "beta2", "sigma_beta2", "evaluation_year"],
        "meta": {
            "title": "Adopted B(E2; 0+ -> 2+1) values and first 2+ energies of even-even nuclei",
            "service": "https://www.nndc.bnl.gov/be2/data/adopted-entries.json",
            "evaluation": "Pritychenko et al., At. Data Nucl. Data Tables 107, 1 (2016), updating Raman et al., ibid. 78, 1 (2001)",
            "units": {"E2": "keV", "B(E2)up": "e^2 b^2 (upward 0+ -> 2+)", "beta2": "dimensionless deformation parameter from B(E2)"},
            "raw_sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "rows": len(rows), "with_be2": sum(r[4] is not None for r in rows), "with_energy": sum(r[2] is not None for r in rows),
            "note": "One entry per nuclide: the 2016 evaluation where it exists, otherwise Raman 2001. Marginal uncertainties as published; entries without B(E2) keep only the 2+ energy. Acknowledge NNDC and the evaluators.",
        },
        "rows": rows,
    }


def editions_table():
    out, meta = {}, {}
    for key, name in EDITIONS.items():
        cache = json.loads((CACHE / name).read_text(encoding="utf8"))
        rows = []
        for rec in cache["records"]:
            if rec["state"]["kind"] != "ground" or rec["values"].get("mass_excess_keV") is None:
                continue
            sigma = rec["uncertainties"].get("mass_excess_keV")
            est = rec["flags"]["mass_excess_keV"]["estimated"]
            rows.append([rec["Z"], rec["N"], rec["values"]["mass_excess_keV"], sigma, 1 if est else 0])
        rows.sort(key=lambda r: (r[0], r[1]))
        out[key] = rows
        src = cache["source"]
        meta[key] = {"title": src.get("title"), "url": src.get("url"), "evaluation_date": src.get("evaluation_date"), "raw_sha256": cache.get("raw_sha256"), "rows": len(rows)}
    return {"schema_version": 1, "columns": ["Z", "N", "mass_excess_keV", "sigma_keV", "estimated"],
            "meta": {"editions": meta, "note": "Atomic mass excess of ground states; # (estimated) flags kept; printed zero uncertainties may be rounded."}, "editions": out}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--be2", required=True, help="raw adopted-entries.json")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    outputs = {CACHE / "be2-compact.json": be2_table(args.be2), CACHE / "ame-editions-compact.json": editions_table()}
    for path, data in outputs.items():
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
        if args.check:
            if path.read_text(encoding="utf8") != text:
                raise SystemExit(str(path) + " differs")
        else:
            path.write_text(text, encoding="utf8")
            print("wrote", path.name, len(text), "bytes")


if __name__ == "__main__":
    main()
