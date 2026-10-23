#!/usr/bin/env python3
"""Compact nuclear charge radii and electromagnetic moments for the Research page tools.

Input : one validated LiveChart ground-state cache file written by tools/research_data.py
        (python tools/research_data.py --fetch --dataset livechart-ground-states --query nuclides=all --output DIR).
Output: static/data/research-cache/nuclear-properties-compact.json
        columns: Z, A, Jpi, r_rms (fm), sigma_r, mu (muN), sigma_mu, Q (barn), sigma_Q, kind (g = ground, u = unresolved).
Only rows with a radius, a magnetic moment or a quadrupole moment are kept. Unknown uncertainties stay null (never 0).
Usage: python tools/make_nuclear_properties.py CACHE.json [--check]
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static/data/research-cache/nuclear-properties-compact.json"
COLUMNS = ["Z", "A", "Jpi", "r_fm", "sigma_r_fm", "mu_muN", "sigma_mu_muN", "Q_b", "sigma_Q_b", "kind"]


def symbols():
    table = json.loads((ROOT / "static/data/periodic-table.json").read_text(encoding="utf8"))["elements"]
    out = {e["z"]: e["sym"] for e in table}
    out[0] = "n"  # the free neutron has a magnetic moment but no element symbol
    return out


def number(value):
    return None if value is None or value == "" else float(value)


def build(cache_path):
    raw = json.loads(Path(cache_path).read_text(encoding="utf8"))
    if raw.get("query", {}).get("fields") != "ground_states" or raw["query"].get("nuclides") != "all":
        raise SystemExit("cache must be the complete ground_states response")
    rows = []
    dropped = {"neutron_radius": 0, "spin0_moments": 0}
    for rec in raw["records"]:
        v = rec["values"]
        r, mu, q = number(v.get("radius")), number(v.get("magnetic_dipole")), number(v.get("electric_quadrupole"))
        jp = rec["state"].get("spin_parity") or ""
        if rec["Z"] == 0 and r is not None:  # the free neutron entry is <r^2> in fm^2, not an RMS radius
            r = None
            dropped["neutron_radius"] += 1
        if jp.startswith("0") and (mu is not None or q is not None):  # I = 0 has no dipole or quadrupole moment
            mu = q = None
            dropped["spin0_moments"] += 1
        if r is None and mu is None and q is None:
            continue
        kind = "g" if rec["state"]["kind"] == "ground" else "u"
        rows.append([rec["Z"], rec["A"], rec["state"].get("spin_parity") or None,
                     r, number(v.get("unc_r")) if r is not None else None,
                     mu, number(v.get("unc_md")) if mu is not None else None,
                     q, number(v.get("unc_eq")) if q is not None else None, kind])
    rows.sort(key=lambda x: (x[0], x[1], x[9]))
    sym = symbols()
    assert all(r[0] in sym for r in rows)
    source = raw["source"]
    return {
        "schema_version": 1,
        "columns": COLUMNS,
        "symbols": {str(z): sym[z] for z in sorted({r[0] for r in rows})},
        "meta": {
            "title": "Nuclear charge radii and electromagnetic moments (ground states)",
            "service": source.get("url"),
            "query": raw["query"],
            "retrieved_at": source.get("retrieved_at"),
            "evaluation": source.get("evaluation"),
            "radius_source": "Angeli & Marinova, At. Data Nucl. Data Tables 99, 69 (2013), as distributed by IAEA LiveChart",
            "moment_source": "Stone, IAEA INDC(NDS)-0658 (2014) and later updates, as distributed by IAEA LiveChart",
            "units": {"r": "fm (RMS charge radius)", "mu": "nuclear magneton", "Q": "barn (spectroscopic quadrupole moment)"},
            "raw_sha256": raw.get("raw_sha256"),
            "excluded_inconsistent": dropped,
            "rows": len(rows),
            "with_radius": sum(r[3] is not None for r in rows),
            "with_moment": sum(r[5] is not None for r in rows),
            "with_quadrupole": sum(r[7] is not None for r in rows),
            "note": "Marginal uncertainties only; evaluated covariances between isotopes are not published. kind u = state not resolved in the source. Spin-0 moment entries and the neutron radius (a mean-square value) are excluded as inconsistent. Acknowledge IAEA and the original evaluations.",
        },
        "rows": rows,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cache")
    ap.add_argument("--check", action="store_true", help="fail if the committed file differs")
    args = ap.parse_args(argv)
    text = json.dumps(build(args.cache), ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.check:
        raise SystemExit(0 if OUT.read_text(encoding="utf8") == text else "static/data/research-cache/nuclear-properties-compact.json differs")
    OUT.write_text(text, encoding="utf8")
    print("wrote", OUT, len(text), "bytes", hashlib.sha256(text.encode()).hexdigest()[:16])


if __name__ == "__main__":
    main()
