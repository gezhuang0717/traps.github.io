#!/usr/bin/env python3
"""Import *official* AMDC AME2026/NUBASE2026/RCT1/RCT2 as public evaluated data.

Only https://amdc.impcas.ac.cn/masstables/Ame2026/ files are accepted.
No synthetic/2020 mass is ever passed off as 2026. Raw ASCII is preserved
byte-for-byte and SHA-256 pinned in a machine-readable manifest.

Run (online, explicit): python tools/import_ame2026.py --download
Run (from checked-in raw): python tools/import_ame2026.py
Check generated output: python tools/import_ame2026.py --check
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, re, sys, tempfile, time
import urllib.request
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from make_ame_reactions import (parse_mass,parse_reactions,comparison,
    LABELS,MASS_FIELDS,TABLES)
from make_state_catalogue import parse as parse_states

VERSION="2026"
BASE="https://amdc.impcas.ac.cn/masstables/Ame2026/"
FILES=("mass.mas26","rct1.mas26","rct2.mas26","nubase.mas26")
RAW_DIR=ROOT/"tools/data/ame2026"
DATA_DIR=ROOT/"static/data"
CITATIONS=[
  {"title":"The AME2026 atomic mass evaluation (I), input data and adjustment",
   "doi":"10.1088/1674-1137/aebcec","journal":"Chinese Physics C 50, 120002 (2026)"},
  {"title":"The AME2026 atomic mass evaluation (II), tables and references",
   "doi":"10.1088/1674-1137/aebceb","journal":"Chinese Physics C 50, 120003 (2026)"},
  {"title":"The NUBASE2026 evaluation of fundamental nuclear physics properties",
   "doi":"10.1088/1674-1137/aebced","journal":"Chinese Physics C 50, 120001 (2026)"}
]
EXPECTED={
 "mass.mas26":("A T O M I C M A S S A D J U S T M E N T","f14.6,f12.6,f13.5","MASS EXCESS"),
 "rct1.mas26":("A T O M I C M A S S A D J U S T M E N T","6(f12.4,f10.4)","S(2n)"),
 "rct2.mas26":("A T O M I C M A S S A D J U S T M E N T","6(f12.4,f10.4)","S(n)"),
 "nubase.mas26":("NUBASE2026","Data FORMAT","Mass Excess")
}

def sha(blob):
    return hashlib.sha256(blob).hexdigest()

def validate_original(filename,raw):
    if filename not in FILES:raise ValueError("Unlisted source filename")
    if len(raw)<180000 or len(raw)>1800000:raise ValueError(filename+" has implausible byte count")
    try:text=raw.decode("ascii")
    except UnicodeDecodeError as exc:raise ValueError("Unexpected non-ASCII source file: "+filename) from exc
    if any(term not in text[:6200] for term in EXPECTED[filename]):
        raise ValueError(filename+" does not have the official 2026 header/column contract")
    if filename!="nubase.mas26" and "# in" not in text[:6200] and "decimal point" not in text[:6200]:
        raise ValueError(filename+" is missing source-estimation notation")
    if "\r" in text.replace("\r\n",""):
        raise ValueError("Unexpected line endings")
    return text

def download_original(filename):
    url=BASE+filename
    for trial in range(3):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"traps-nuclear-data/2026 scholarly ingestion (source-attributed)"})
            with urllib.request.urlopen(req,timeout=35) as resp:
                if resp.url!=url:raise ValueError("Unexpected HTTP redirect "+resp.url)
                if resp.status!=200:raise ValueError("HTTP "+str(resp.status))
                raw=resp.read(2000000)
            validate_original(filename,raw)
            return raw
        except (OSError,ValueError) as error:
            if trial==2:raise RuntimeError("Official AMDC download failed for "+url+"; do not substitute another edition") from error
            time.sleep(2*(trial+1))

def save_atomic(path,raw):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix="."+path.name+"-",dir=path.parent,delete=False) as h:
        tmp=Path(h.name);h.write(raw);h.flush();os.fsync(h.fileno())
    try:os.replace(tmp,path)
    finally:tmp.unlink(missing_ok=True)

def encoded(value):
    return (json.dumps(value,ensure_ascii=False,separators=(",",":"),allow_nan=False)+"\n").encode("utf-8")

def mass_catalogue(records,raw):
    rows=[]
    for r in records.values():
        v=r["values"]["me"]
        if v["value"] is not None:
            rows.append([r["Z"],r["A"],r["element"],v["value"],v["uncertainty"],
                         int(v["value_extrapolated"]),int(v["uncertainty_extrapolated"])])
    rows.sort(key=lambda x:(x[1],x[0]))
    if len(rows)<3300:raise ValueError("Too few AME2026 ground masses")
    return {"source":"AME2026 unrounded mass.mas26 (Huang et al., Chinese Phys. C 50, 120002/120003, 2026)",
     "metadata":{"name":"AME2026","version":"mass.mas26","url":BASE+"mass.mas26",
       "sha256":sha(raw),"edition":"2026",
       "transformation":"Official ground-state mass excess and 1-sigma uncertainty in keV; independent value/uncertainty estimated flags",
       "columns":["Z","A","element","mass_excess_keV","uncertainty_keV","value_extrapolated","uncertainty_extrapolated"],
       "citation":CITATIONS[:2]},"rows":rows}

def combine_reactions(parsed,amejson,raws):
    records=parsed["mass"]
    for tab in ("rct1","rct2"):
        if records.keys()!=parsed[tab].keys():
            onlymass=list(records.keys()-parsed[tab].keys())[:5]
            onlyrct=list(parsed[tab].keys()-records.keys())[:5]
            raise ValueError("Official mass/reaction isotope mismatch "+str((tab,onlymass,onlyrct)))
        for key,r in parsed[tab].items():
            target=records[key]
            if any(target[k]!=r[k] for k in ("Z","N","A","element")):
                raise ValueError("AME2026 reaction identity conflict at "+key)
            target["values"].update(r["values"])
            target["source_lines"].update(r["source_lines"])
    validated=comparison(records,amejson)
    if validated["status"]!="PASS":
        raise ValueError("AME2026 independent central-value checks failed: "+str(validated["failures"][:8]))
    keys=[*TABLES["rct1"][1],*TABLES["rct2"][1],*MASS_FIELDS,"BE"]
    sources=[{"table":key,"filename":name,"url":BASE+name,"sha256":sha(raws[name]),
              "bytes":len(raws[name]),"format":"AME2026 published fixed-width, unrounded"}
             for key,name in (("mass","mass.mas26"),("rct1","rct1.mas26"),("rct2","rct2.mas26"))]
    return {"schema":"zg-ame2026-reactions-v1","unit":"keV",
       "metadata":{"name":"AME2026 evaluated ground-state reaction energies",
           "version":"AME2026, Oct 24 2026 unrounded tables",
           "units":"keV except BEA (keV/nucleon)","sources":sources,"papers":CITATIONS[:2],
           "quantity_labels":LABELS,
           "quantity_units":{k:"keV/nucleon" if k=="BEA" else "keV" for k in keys},
           "quantity_sources":{**{k:t for t,(_,ks) in TABLES.items() for k in ks},
                              **{k:"mass" for k in MASS_FIELDS},"BE":"mass"},
           "quantity_transformations":{"BE":"A × published BEA; not independently read from AME"},
           "value_columns":"A[1:4], element[5:8], Z[8:11]; reactions six (value12,uncertainty10) fields",
           "mass_value_columns":{k:list(v) for k,v in MASS_FIELDS.items()},
           "flags":"# is source-estimated and replaces decimal point; * missing never equals zero",
           "uncertainty_scope":"Official evaluated marginal 1-sigma uncertainties with AME mass correlations retained; no diagonal-error substitution",
           "comparison_mass_catalogue_sha256":sha(encoded(amejson))},
       "quantities":keys,"records":records,"validation":validated}

def classify_2026(state):
    """Conservative NUBASE2026 state taxonomy; do not invent unlabelled isomers."""
    if state["source_state_index"]==0:return "ground","NUBASE2026 column index=0"
    if state["label"] in ("i","j") or state["source_state_index"] in (8,9):
        return "analogue","NUBASE2026 isobaric-analogue index"
    if "spmix" in state["spin_parity"] or "fsmix" in state["spin_parity"]:
        return "mixture","NUBASE2026 mixed levels"
    sec=state["half_life"]["seconds"]
    if state["label"] in ("m","n"):return "isomer","NUBASE2026 source isomer suffix"
    if state["label"] in ("p","q","r","x") and sec is not None and sec>=1e-7:
        return "isomer","NUBASE2026 long-lived excited state, source half-life >=100ns"
    if state["source_state_index"]==5:return "resonance","NUBASE2026 resonance-state index"
    return "unclassified","NUBASE2026 excited state, not enough evidence to assign isomer"

def nubase_catalogue(raw,state_text,ame,raw_ame):
    # State reader respects original fixed-width columns 1..209 and all
    # separate Z-N-index identities, excitation, decay, spin and lifetime fields.
    states=parse_states(RAW_DIR/"nubase.mas26")
    gs={};iso={};counts=Counter()
    masses={(r[0],r[1]-r[0]):r for r in ame["rows"]}
    for state in states:
        state["kind"],state["classification_basis"]=classify_2026(state)
        counts[state["kind"]]+=1
        key=(state["Z"],state["N"])
        if state["source_state_index"]==0:
            life=state["half_life"];seconds=life["seconds"]
            lg=99 if life["status"]=="stable" else -98 if life["status"]=="particle_unstable" else round(math.log10(seconds),3) if seconds and seconds>0 else -99
            half="stable" if lg==99 else "particle unstable" if lg==-98 else (life["raw"]+" "+life["unit"]).strip()
            m=masses.get(key)
            src=state["mass_excess"]
            me,dm,est,estdm=(m[3],m[4],m[5],m[6]) if m else (src["value"],src["uncertainty"],int(src["value_extrapolated"]),int(src["uncertainty_extrapolated"]))
            yr=state["discovery_year"]
            gs[key]=[state["Z"],state["N"],state["element"],me,dm,est,lg,half,state["spin_parity"],
                     int(yr) if yr.isdigit() else None,state["decay"],[],state["id"],estdm]
        elif state["kind"]=="isomer" and state["existence"]!="withdrawn":
            ex=state["excitation"];life=state["half_life"]
            iso.setdefault(key,[]).append([state["label"],ex["value"],
                (life["raw"]+" "+life["unit"]).strip(),state["spin_parity"],
                ex["uncertainty"],int(ex["value_extrapolated"]),
                int(ex["uncertainty_extrapolated"]),state["id"]])
    for key,stateshere in iso.items():
        if key in gs:gs[key][11]=stateshere
    if len(gs)<3300 or len(states)<5000:raise ValueError("NUBASE2026 inventory implausible")
    elements=json.loads((DATA_DIR/"nubase2020.json").read_text())["elements"]
    chart={"source":"NUBASE2026 (Kondev et al., Chinese Phys. C 50, 120001, 2026) / AME2026 (Huang et al., 120002/120003)",
       "edition":"2026","elements":elements,"rows":sorted(gs.values())}
    meta={"schema_version":2,
      "source":{"name":"NUBASE2026","doi":"10.1088/1674-1137/aebced",
        "url":BASE+"nubase.mas26","sha256":sha(raw),
        "mass_reference":"AME2026 mass.mas26","mass_sha256":sha(raw_ame),
        "uncertainty":"published uncertainties when given, qualifiers and # flags preserved",
        "transformation":"Fixed-width NUBASE2026 states; distinct Z-N-index; conservative state classification",
        "half_life_year_seconds":31556926.08},
      "counts":{**counts,"total":len(states),"excited":sum(s["source_state_index"]!=0 for s in states),
            "ground":len(gs),"isomers":sum(len(v) for v in iso.values())},
      "states":states}
    return chart,meta

def build(raw_dir):
    raws={name:(raw_dir/name).read_bytes() for name in FILES}
    text={name:validate_original(name,raw) for name,raw in raws.items()}
    parsed={"mass":parse_mass(text["mass.mas26"]),
            "rct1":parse_reactions(text["rct1.mas26"],"rct1"),
            "rct2":parse_reactions(text["rct2.mas26"],"rct2")}
    mass=mass_catalogue(parsed["mass"],raws["mass.mas26"])
    reaction=combine_reactions(parsed,mass,raws)
    chart,states=nubase_catalogue(raws["nubase.mas26"],text["nubase.mas26"],mass,raws["mass.mas26"])
    if len(mass["rows"])>len(chart["rows"])+80:raise ValueError("Unexplained AME/NUBASE catalogue coverage mismatch")
    files={"ame2026.json":mass,"ame2026-reactions.json":reaction,
           "nubase2026.json":chart,"nuclear-states2026.json":states}
    summary={"schema":"amdc-2026-import-v1","edition":"AME2026+NUBASE2026",
       "authority":"AMDC Institute of Modern Physics, Chinese Academy of Sciences",
       "directory":BASE,"sources":[{"name":n,"url":BASE+n,"bytes":len(raws[n]),"sha256":sha(raws[n])} for n in FILES],
       "papers":CITATIONS,"counts":{"masses":len(mass["rows"]),"chart":len(chart["rows"]),
               "states":len(states["states"]),"reaction_rows":len(reaction["records"])},
       "validation":{"status":reaction["validation"]["status"],
                     "central_values":sum(x["checked"] for x in reaction["validation"]["quantities"].values()),
                     "no_synthetic_2026":True,"no_2020_fallback_mislabel":True,
                     "value_uncertainty_estimated_flags_distinct":True},
       "outputs":[{"filename":n,"sha256":sha(encoded(data)),"bytes":len(encoded(data))} for n,data in files.items()]}
    files["ame2026-source-manifest.json"]=summary
    return files

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--download",action="store_true")
    ap.add_argument("--check",action="store_true")
    args=ap.parse_args()
    if args.download and args.check:raise SystemExit("Choose download or check")
    if args.download:
        for filename in FILES:
            raw=download_original(filename)
            save_atomic(RAW_DIR/filename,raw)
            print("OFFICIAL RAW",filename,len(raw),sha(raw),flush=True)
    result=build(RAW_DIR)
    for filename,data in result.items():
        target=DATA_DIR/filename
        raw=encoded(data)
        if args.check:
            if not target.is_file() or target.read_bytes()!=raw:
                raise SystemExit("Generated data differ at "+str(target))
        else:save_atomic(target,raw)
        print("PASS",filename,len(raw),sha(raw),flush=True)
    print(json.dumps(result["ame2026-source-manifest.json"]["counts"]))

if __name__=="__main__":main()
