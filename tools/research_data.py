#!/usr/bin/env python3
"""Bounded research-data refresh; failed requests preserve the previous cache.

--list; --fetch --dataset KEY (repeatable); --fetch --all; --query nuclides=12c.
Official CSV/download adapters retain source/state/unit/error/flag provenance.
Raw responses stay outside public Git. The public index points to immutable,
hash-addressed snapshots; only the index pointer is atomically replaced.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlencode

import yaml

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "data/research_sources.yaml"
DEFAULT_OUTPUT = ROOT / "static/data/research-cache"
DEFAULT_RAW = ROOT.parent / "evidence/spectroscopy-20261023/online-data/raw"
NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$")
NUCLIDE = re.compile(r"^[1-9]\d{0,2}[a-z]{1,3}$")
PARENTS = {"232th", "233u", "235u", "238u", "237np", "239pu", "241pu", "241am"}
UNCERTAINTIES = {
    "radius": "unc_r", "abundance": "unc_a", "energy": "unc_e",
    "magnetic_dipole": "unc_md", "electric_quadrupole": "unc_eq",
    "half_life_sec": "unc_hls", "massexcess": "unc_me", "atomic_mass": "unc_am",
    "binding": "unc_ba", "qbm": "unc_qb", "qbm_n": "unc_qbmn", "qa": "unc_qa",
    "qec": "unc_qec", "sn": "unc_sn", "sp": "unc_sp", "intensity": "unc_i",
    "relative_intensity": "unc_ri", "start_level_energy": "unc_sle",
    "end_level_energy": "unc_ele", "p_energy": "unc_pe", "q": "unc_q",
    "dn_de": "unc_dn_de", "dn_de_nu": "unc_dn_de_nu",
    "cumulative_thermal_fy": "unc_ct", "cumulative_fast_fy": "unc_cf",
    "cumulative_14mev_fy": "unc_c14", "independent_thermal_fy": "unc_it",
    "independent_fast_fy": "unc_if", "independent_14mev_fy": "unc_i14",
    "b_e1": "unc_be1", "b_e2": "unc_be2", "b_m1": "unc_bm1", "b_m2": "unc_bm2",
}


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def number(raw):
    text = "" if raw is None else str(raw).strip()
    if not text or "*" in text:
        return None
    text = text.replace("#", ".").replace("D", "E").replace("d", "e")
    if not NUMBER.fullmatch(text):
        return None
    value = float(text)
    if not math.isfinite(value):
        raise ValueError("Non-finite source number")
    return value


def canonical_query(spec, override=None):
    query = dict(spec.get("query", {}))
    override = override or {}
    if set(override) - set(spec.get("allowed_query", [])):
        raise ValueError("Unsupported query override")
    # Selecting a parent replaces the default product filter (and conversely).
    if "parents" in override and "products" not in override:
        query.pop("products", None)
    if "products" in override and "parents" not in override:
        query.pop("parents", None)
    query.update({str(k): str(v).lower() if k in ("nuclides", "parents", "products", "rad_types") else str(v)
                  for k, v in override.items()})
    if spec["format"] == "livechart-csv":
        field = query["fields"]
        for key in ("nuclides", "products", "parents"):
            if key in query:
                value = query[key]
                if not (key == "nuclides" and value == "all" and field == "ground_states") and not NUCLIDE.fullmatch(value):
                    raise ValueError("Use a single nuclide such as 135xe")
        if "parents" in query and query["parents"] not in PARENTS:
            raise ValueError("Parent outside the documented fission-yield set")
        if field in ("cumulative_fy", "independent_fy"):
            if not (query.get("parents") or query.get("products")):
                raise ValueError("Fission yields require a parent or product")
        elif not query.get("nuclides"):
            raise ValueError("This field requires nuclides")
        if field in ("decay_rads", "bin_beta"):
            allowed = {"bp", "bm"} if field == "bin_beta" else {"a", "bp", "bm", "g", "e", "x"}
            if query.get("rad_types") not in allowed:
                raise ValueError("Unsupported radiation type")
        if "metastable_seqno" in query and not re.fullmatch(r"[1-9]\d*", query["metastable_seqno"]):
            raise ValueError("metastable_seqno must be a positive integer")
    return dict(sorted(query.items()))


def normalize_livechart(text, spec, query):
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    headers = reader.fieldnames or []
    field = query["fields"]
    required = ({"z_daughter", "a_daughter", "daughter_level_idx"} if field.endswith("_fy")
                else {"p_z", "p_n", "p_symbol"} if field in ("decay_rads", "bin_beta")
                else {"z", "n", "symbol"})
    if not required.issubset(headers):
        raise ValueError("LiveChart returned an error, HTML or unexpected CSV schema")
    records = []
    for i, raw in enumerate(reader):
        if None in raw or not any(str(v or "").strip() for v in raw.values()):
            if None in raw:
                raise ValueError("Malformed CSV row")
            continue
        if field.endswith("_fy"):
            z, a, element = int(raw["z_daughter"]), int(raw["a_daughter"]), raw["element_daughter"]
            n = a - z
            state = {"kind": "source-state-index", "id": raw["daughter_level_idx"],
                     "parent": raw["a_parent"] + raw["element_parent"]}
        else:
            prefix = "p_" if field in ("decay_rads", "bin_beta") else ""
            z, n, element = int(raw[prefix + "z"]), int(raw[prefix + "n"]), raw[prefix + "symbol"]
            a = z + n
            enkey = "p_energy" if prefix else "energy"
            shiftkey = "p_energy_shift" if prefix else "energy_shift"
            en, shift = number(raw.get(enkey)), raw.get(shiftkey, "").strip()
            state = {"kind": "unresolved" if shift else "ground" if en == 0 else "excited" if en is not None else "unspecified",
                     "energy_keV": en, "energy_shift": shift, "spin_parity": raw.get("jp"), "id": raw.get("idx")}
            if field == "gammas":
                state = {"kind": "transition", "from_id": raw.get("start_level_idx"),
                         "to_id": raw.get("end_level_idx"), "from_energy_keV": number(raw.get("start_level_energy")),
                         "to_energy_keV": number(raw.get("end_level_energy"))}
        if z < 0 or n < 0 or a <= 0:
            raise ValueError("Invalid nuclear identity")
        values = {k: number(v) for k, v in raw.items() if k not in ("Extraction_date", "extraction_date")}
        uncertainties = {key: number(raw.get(column)) for key, column in UNCERTAINTIES.items() if key in raw}
        if "energy" in raw and "unc_en" in raw:
            uncertainties["energy"] = number(raw["unc_en"])
        flags = {"missing": [k for k, value in values.items() if not str(raw.get(k, "")).strip()],
                 "operators": {k: v for k, v in raw.items() if k.startswith("operator_") and v}}
        if raw.get("half_life"):
            flags["half_life_uncertainty"] = "ENSDF last-digit notation retained in source_fields; not independently decoded"
        records.append({"id": str(i), "nuclide": str(a) + element, "A": a, "Z": z, "N": n,
                        "state": state, "values": values, "uncertainties": uncertainties,
                        "flags": flags, "source_fields": raw})
    return records


def ame_field(raw):
    raw = raw.strip()
    value = number(raw)
    return value, {"estimated": "#" in raw, "missing": value is None,
                   "printed": raw, "rounded_zero_possible": value == 0 and bool(raw)}


def normalize_ame(text, edition):
    old = edition == "ame1995"
    slices = {"mass_excess_keV": (28, 39 if old else 41),
              "mass_excess_sigma": (39, 48) if old else (41, 52),
              "binding": (48, 59) if old else (52, 63),
              "binding_sigma": (59, 68) if old else (63, 72),
              "atomic_fraction": (100, 110) if old else (100, 112),
              "atomic_sigma": (110, 119) if old else (112, 123)}
    rows = []
    for line_no, line in enumerate(text.splitlines(), 1):
        try:
            n, z, a = int(line[4:9]), int(line[9:14]), int(line[14:19])
        except ValueError:
            continue
        element = line[20:23].strip()
        if n < 0 or z < 0 or a != n + z or not element:
            continue
        line = line.ljust(124)  # valid estimated rows can omit trailing blanks
        fields = {key: line[start:end].strip() for key, (start, end) in slices.items()}
        parsed = {key: ame_field(raw) for key, raw in fields.items()}
        fraction, massflag = parsed["atomic_fraction"]
        mass_integer = number(line[96:99])
        # Decimal addition avoids losing the published fractional digits early.
        atomic_mass = None if fraction is None or mass_integer is None else float(
            Decimal(line[96:99].strip()) + Decimal(fields["atomic_fraction"].replace("#", ".")) / Decimal(1000000))
        atomic_sigma = parsed["atomic_sigma"][0]
        values = {"mass_excess_keV": parsed["mass_excess_keV"][0], "atomic_mass_u": atomic_mass,
                  "binding_energy_per_nucleon_keV": None if parsed["binding"][0] is None else parsed["binding"][0] / a if old else parsed["binding"][0]}
        sigma = {"mass_excess_keV": parsed["mass_excess_sigma"][0],
                 "atomic_mass_u": None if atomic_sigma is None else atomic_sigma / 1e6,
                 "binding_energy_per_nucleon_keV": None if parsed["binding_sigma"][0] is None else parsed["binding_sigma"][0] / a if old else parsed["binding_sigma"][0]}
        flags = {"mass_excess_keV": parsed["mass_excess_keV"][1], "mass_excess_sigma": parsed["mass_excess_sigma"][1],
                 "atomic_mass_u": massflag, "atomic_mass_sigma": parsed["atomic_sigma"][1],
                 "binding_source_convention": "total_keV_divided_by_A" if old else "keV_per_nucleon"}
        rows.append({"id": "%s-%s" % (z, a), "nuclide": str(a) + element, "A": a, "Z": z, "N": n,
                     "state": {"kind": "ground", "energy_keV": 0}, "values": values,
                     "uncertainties": sigma, "flags": flags,
                     "source_fields": dict(fields, atomic_integer=line[96:99].strip(), origin=line[23:27].strip(), line=line_no)})
    expected = {"ame2016": 3436, "ame2003": 3179, "ame1995": 2931}
    if len(rows) != expected[edition] or len({(r["Z"], r["A"]) for r in rows}) != len(rows):
        raise ValueError("Historical AME row count or identity mismatch: %s" % len(rows))
    c12 = next(r for r in rows if r["Z"] == 6 and r["A"] == 12)
    h1 = next(r for r in rows if r["Z"] == 1 and r["A"] == 1)
    known_h = {"ame2016": 7288.97061, "ame2003": 7288.97050, "ame1995": 7288.969}
    if c12["values"]["atomic_mass_u"] != 12 or c12["values"]["mass_excess_keV"] != 0 or abs(h1["values"]["mass_excess_keV"] - known_h[edition]) > 1e-7:
        raise ValueError("Historical AME 12C/1H reference check failed")
    return rows


def be2_convert(value, a, unit_from="e2_b2", unit_to="e2_fm4", direction_from="up", direction_to="up"):
    if a <= 0 or direction_from not in ("up", "down") or direction_to not in ("up", "down"):
        raise ValueError("B(E2) requires positive A and explicit up/down direction")
    def factor(unit, direction):
        if unit == "e2_b2":
            return 1e4
        if unit == "e2_fm4":
            return 1.0
        if unit == "Wu":
            return (0.297 if direction == "up" else 0.0594) * a ** (4 / 3)
        raise ValueError("Unknown B(E2) unit")
    physical = value * factor(unit_from, direction_from)
    if direction_from != direction_to:
        physical *= 5 if direction_to == "up" else 0.2
    return physical / factor(unit_to, direction_to)


def normalize_ame_reactions(text, spec):
    keys = ("s2n", "s2p", "qa", "q2bm", "qep", "qbmn") if spec["table"] == "rct1" else ("sn", "sp", "q4bm", "qda", "qpa", "qna")
    records, identities = [], set()
    for line_no, line in enumerate(text.splitlines(), 1):
        try:
            a, z = int(line[1:4]), int(line[8:11])
        except ValueError:
            continue
        element = line[5:8].strip()
        if a <= 0 or z < 0 or a < z or not element:
            continue
        identities.add((z, a))
        if element not in ("Ca", "Sn") and not (element == "C" and a == 12):
            continue
        line = line.ljust(124)
        values, errors, flags, raw = {}, {}, {}, {}
        for index, key in enumerate(keys):
            start = 12 + 18*index
            value, flag = ame_field(line[start:start+10])
            sigma, sflag = ame_field(line[start+10:start+18])
            values[key + "_keV"], errors[key + "_keV"] = value, sigma
            flags[key + "_keV"] = dict(flag, uncertainty=sflag, uncertainty_model="published_evaluated_table")
            raw[key] = {"value": line[start:start+10].strip(), "uncertainty": line[start+10:start+18].strip()}
        records.append({"id": "%s-%s" % (z, a), "nuclide": str(a) + element, "A": a, "Z": z, "N": a-z,
                        "state": {"kind": "ground", "energy_keV": 0}, "values": values, "uncertainties": errors,
                        "flags": flags, "source_fields": dict(raw, line=line_no, table=spec["table"], edition=spec["edition"])})
    if len(identities) != {"ame2016": 3436, "ame2003": 3179, "ame1995": 2931}[spec["edition"]]:
        raise ValueError("Historical reaction-table identity/format mismatch")
    return records


def normalize_be2(text):
    payload = json.loads(text)
    if not isinstance(payload, list):
        raise ValueError("Unexpected NNDC B(E2) JSON")
    selected = []
    for entry in payload:
        nuclide = entry.get("nuclide", {})
        if entry.get("reference") != "ADNDT_107_1_2016_2016PR01" or entry.get("adoptedEntryType") != "MODEL_INDEPENDENT":
            continue
        if nuclide.get("symbol") not in ("Ca", "Sn") and not (nuclide.get("symbol") == "C" and nuclide.get("a") == 12):
            continue
        if "be2" not in entry:
            continue  # energy-only entries do not become zero strength
        a, z = int(nuclide["a"]), int(nuclide["z"])
        value, sigma = entry["be2"].get("value"), entry["be2"].get("error")
        if value is None or value < 0:
            raise ValueError("Invalid adopted B(E2)")
        values, errors = {}, {}
        for label, unit, direction in (("be2_up_e2b2", "e2_b2", "up"), ("be2_down_e2b2", "e2_b2", "down"),
                                       ("be2_up_e2fm4", "e2_fm4", "up"), ("be2_down_e2fm4", "e2_fm4", "down"),
                                       ("be2_up_wu", "Wu", "up")):
            values[label] = be2_convert(value, a, "e2_b2", unit, "up", direction)
            errors[label] = None if sigma is None else be2_convert(sigma, a, "e2_b2", unit, "up", direction)
        for label, sourcekey in (("be2_source_wu", "be2Weisskopf"), ("transition_energy_keV", "transitionEnergy")):
            values[label] = entry.get(sourcekey, {}).get("value")
            errors[label] = entry.get(sourcekey, {}).get("error")
        selected.append({"id": str(a) + nuclide["symbol"], "nuclide": str(a) + nuclide["symbol"], "A": a, "Z": z, "N": a-z,
                         "state": {"kind": "nuclear-transition", "initial_spin_parity": "0+", "final_spin_parity": "2+", "direction": "up"},
                         "values": values, "uncertainties": errors,
                         "flags": {"evaluation": "2016PR01", "adopted_type": "MODEL_INDEPENDENT",
                                   "Wu_convention": "Upward reference 0.297*A^(4/3); downward 0.0594*A^(4/3), e2 fm4. Source help arrow is inconsistent with its prose.",
                                   "scope": "Selected Ca/Sn and 12C entries, not a full evaluation mirror"}, "source_fields": entry})
    if not selected:
        raise ValueError("No selected 2016 adopted B(E2) records")
    return selected


def normalize(raw, spec, source, query, url, retrieved_at=None):
    text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else raw
    if spec["format"] == "livechart-csv":
        records = normalize_livechart(text, spec, query)
    elif spec["format"] == "ame-rct":
        records = normalize_ame_reactions(text, spec)
    elif spec["format"].startswith("ame"):
        records = normalize_ame(text, spec["format"])
    elif spec["format"] == "be2-json":
        records = normalize_be2(text)
    else:
        raise ValueError("No numerical adapter for this source")
    source_info = {"id": source["id"], "title": source["title"], "url": url,
                   "evaluation_date": source.get("evaluation_date"), "evaluation": source.get("evaluation"),
                   "retrieved_at": retrieved_at or utc_now(), "licence": source.get("licence"),
                   "guide_url": source.get("guide_url"), "capability": source["capability"]}
    body = {"schema_version": 1, "dataset_key": spec["key"], "query": query, "source": source_info,
            "units": spec.get("units", {}), "records": records,
            "raw_sha256": hashlib.sha256(raw if isinstance(raw, bytes) else raw.encode("utf-8")).hexdigest(),
            "notes": [note for note in (spec.get("note"), source.get("caveat")) if note]}
    validate(body, spec, query)
    return body


def validate(body, spec, query):
    if body.get("schema_version") != 1 or body.get("dataset_key") != spec["key"] or body.get("query") != query:
        raise ValueError("Cache identity/query mismatch")
    if body.get("source", {}).get("id") != spec["source_id"] or not body["source"].get("retrieved_at"):
        raise ValueError("Missing source provenance")
    records = body.get("records")
    if not isinstance(records, list) or not 0 < len(records) <= spec.get("max_records", 50000):
        raise ValueError("Empty or excessive dataset")
    for record in records:
        if not isinstance(record.get("state"), dict) or not isinstance(record.get("values"), dict) or not isinstance(record.get("source_fields"), dict):
            raise ValueError("Missing scientific record schema")
        if not record.get("nuclide") or not isinstance(record.get("A"), int) or record["A"] < 1:
            raise ValueError("Missing nuclear identity")
        for value in list(record["values"].values()) + list(record.get("uncertainties", {}).values()):
            if value is not None and (not isinstance(value, (int, float)) or not math.isfinite(value)):
                raise ValueError("Non-finite/non-numeric normalized quantity")
        if any(value is not None and value < 0 for value in record.get("uncertainties", {}).values()):
            raise ValueError("Negative uncertainty")
    return body


def fetch_bytes(url, timeout=25, max_bytes=8*1024*1024):
    # curl is reused, not installed. stdout is bounded by the source-size check
    # immediately after a per-request timeout; registries contain fixed HTTPS URLs.
    result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "-L", "-A", "Livechart/1.0",
                             "--max-time", str(timeout), "--max-filesize", str(max_bytes), url],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=timeout+5)
    if len(result.stdout) > max_bytes:
        raise ValueError("Source exceeds byte budget")
    return result.stdout


def request_dataset(spec, source, override, timeout, fetcher=fetch_bytes):
    query = canonical_query(spec, override)
    urls = [spec.get("url", source["service_url"])] + (spec.get("fallback_urls", []) if spec.get("url") else source.get("fallback_urls", []))
    failures = []
    for base in urls:
        url = base + "?" + urlencode(query) if spec["format"] == "livechart-csv" else base
        try:
            raw = fetcher(url, timeout=timeout)
            return normalize(raw, spec, source, query, url), raw
        except (ValueError, OSError, subprocess.SubprocessError) as error:
            failures.append(str(error))
    raise ValueError("All verified source endpoints failed: " + "; ".join(failures))


def atomic_write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".research-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)  # this attempt's own incomplete temporary file only


def json_bytes(body):
    return (json.dumps(body, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def write_snapshot(output, body):
    raw = json_bytes(body)
    sha = hashlib.sha256(raw).hexdigest()
    filename = body["dataset_key"] + "--" + sha[:16] + ".json"
    atomic_write(output / filename, raw)
    return {"file": filename, "sha256": sha, "bytes": len(raw), "record_count": len(body["records"]),
            "query": body["query"], "retrieved_at": body["source"]["retrieved_at"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--dataset", action="append", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--query", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--from-file", type=Path, help="Validate/import one retained official raw response, with explicit provenance")
    args = parser.parse_args(argv)
    registry = yaml.safe_load(args.registry.read_text(encoding="utf-8"))
    specs = {d["key"]: d for d in registry["datasets"]}
    sources = {s["id"]: s for s in registry["sources"]}
    if args.list:
        print(json.dumps({"datasets": list(specs.values()), "sources": list(sources.values()),
                          "linked_resources": registry.get("linked_resources", [])}, ensure_ascii=False, indent=2))
    if not args.fetch:
        return 0
    keys = list(specs) if args.all else args.dataset
    if not keys or set(keys) - set(specs):
        parser.error("Choose valid --dataset KEY or --all; use --list")
    overrides = dict(part.split("=", 1) for part in args.query)
    if (overrides or args.from_file) and len(keys) != 1:
        parser.error("--query/--from-file require exactly one dataset")
    nearest = args.output
    while not nearest.exists():
        nearest = nearest.parent
    if shutil.disk_usage(nearest).free < 4*1024**3:
        raise SystemExit("PSSD reserve below 4 GiB: no refresh started")
    existing = args.output / "index.json"
    previous = json.loads(existing.read_text()) if existing.exists() else {}
    cached = {d["key"]: d.get("cache") for d in previous.get("datasets", [])}
    results, failures = {}, {}
    with ThreadPoolExecutor(max_workers=max(1, min(4, args.workers))) as executor:
        if args.from_file:
            key = keys[0]
            source = sources[specs[key]["source_id"]]
            raw = args.from_file.read_bytes()
            body = normalize(raw, specs[key], source, canonical_query(specs[key], overrides), specs[key].get("url", source["service_url"]))
            body["source"]["acquisition"] = "validated retained official raw response; original row extraction dates preserved"
            results[key] = (body, raw)
            jobs = {}
        else:
            jobs = {executor.submit(request_dataset, specs[key], sources[specs[key]["source_id"]], overrides,
                                    max(1, min(60, args.timeout))): key for key in dict.fromkeys(keys)}
        for future in as_completed(jobs):
            key = jobs[future]
            try:
                results[key] = future.result()
            except Exception as error:
                failures[key] = str(error)
    for key, (body, raw) in results.items():
        receipt = write_snapshot(args.output, body)
        # Only replace a dataset's default cache with an exactly matching query.
        # Dynamic query snapshots remain addressable via the batch receipt.
        if body["query"] == canonical_query(specs[key]):
            cached[key] = receipt
        atomic_write(args.raw_dir / (key + "--" + body["raw_sha256"][:16] + ".raw"), raw)
        results[key] = receipt
    if results:
        index = dict(registry, generated_at=utc_now())
        index["datasets"] = [dict(spec, cache=cached.get(key)) for key, spec in specs.items()]
        atomic_write(existing, json_bytes(index))
    report = {"retrieved_at": utc_now(), "success": results, "failures": failures,
              "previous_cache_preserved_on_failure": True}
    atomic_write(args.raw_dir / ("refresh-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json"), json_bytes(report))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
