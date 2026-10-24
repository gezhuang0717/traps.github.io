"""Generate tiny, deterministic King teaching datasets; no measured data or network."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "static/data/research-examples/king"
CASES = [
    ("correlated", "king_library_correlated", "Five current default points with supplied within-pair rho.",
     "0,1.02,0.05,0.10,0.2\n1,2.95,0.06,0.12,-0.1\n2,5.10,0.05,0.10,0.15\n3,6.90,0.07,0.14,0\n4,9.05,0.06,0.12,0.25"),
    ("heteroscedastic", "king_library_hetero", "Linear trend plus fixed teaching offsets; unequal errors, rho=0.",
     "0,1.06,0.03,0.08,0\n1,2.91,0.07,0.18,0\n2,5.12,0.04,0.10,0\n3,6.82,0.10,0.25,0\n4,9.04,0.05,0.12,0\n5,11.17,0.08,0.20,0"),
    ("exact-x", "king_library_exact_x", "x is declared exact for this synthetic example: sx=0, known positive sy.",
     "0,1.04,0,0.10,0\n1,2.96,0,0.15,0\n2,5.08,0,0.12,0\n3,6.94,0,0.18,0\n4,9.03,0,0.10,0"),
    ("ols", "king_library_ols", "Same x,y as correlated example; all input errors intentionally omitted.",
     "0,1.02\n1,2.95\n2,5.10\n3,6.90\n4,9.05"),
    ("curved", "king_library_curved", "Artificial y=1+2x+0.3*x^2. A linear fit is inadequate by construction; not evidence of new physics.",
     "0,1,0.05,0.10,0\n1,3.3,0.05,0.10,0\n2,6.2,0.05,0.10,0\n3,9.7,0.05,0.10,0\n4,13.8,0.05,0.10,0\n5,18.5,0.05,0.10,0"),
]


def generate():
    DEST.mkdir(parents=True, exist_ok=True)
    generator = "tools/make_king_examples.py"
    digest = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    index = []
    for name, title_key, definition, text in CASES:
        values = [[float(v) for v in row.split(",")] for row in text.splitlines()]
        columns = ["x", "y"] if len(values[0]) == 2 else ["x", "y", "sx", "sy", "rho_xy"]
        provenance = {"generator": generator, "generator_sha256": digest,
                      "source": "deterministic synthetic teaching definitions in the generator; not measurements",
                      "definition": definition, "generated_date": "2026-10-24",
                      "evaluation_date": None, "retrieved_date": None,
                      "calculation_sources": ["static/js/spectroscopy-data.js", "static/js/spectroscopy-uncertainty.js"],
                      "limits": "Independent rows; supplied rho only correlates x/y within one row. Shared-reference cross-row covariance requires the numerical API. No new-physics inference."}
        payload = {"schema": "traps-king-data-v1", "id": name, "kind": "synthetic-training",
                   "units": "GHz·u", "rho_units": "1", "provenance": provenance,
                   "points": [dict(zip(columns, row)) for row in values]}
        comments = (f"# dataset_id: {name}\n# kind: synthetic-training\n# units: GHz·u\n"
                    f"# generator: {generator}\n# source: deterministic synthetic teaching inputs; not measurements\n"
                    f"# {definition}\n# rho is dimensionless; rows independent\n")
        (DEST / (name + ".json")).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        (DEST / (name + ".csv")).write_text(comments + ",".join(columns) + "\n" + text + "\n")
        (DEST / (name + ".txt")).write_text(comments + "# " + "\t".join(columns) + "\n" + text.replace(",", "\t") + "\n")
        index.append({"id": name, "title_key": title_key, "kind": "synthetic-training", "rows": len(values),
                      "method": "OLS" if len(columns) == 2 else "EIV", "units": "GHz·u",
                      "files": {ext: name + "." + ext for ext in ["csv", "txt", "json"]}})
    (DEST / "index.json").write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    generate()
