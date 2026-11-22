# traps.github.io — public scientific website

Public academic website for experimental nuclear physics, ion traps, laser spectroscopy and mass spectrometry. The source is built with Hugo and three interchangeable themes. **This repository contains public-facing software, data and documentation only.**

**Live:** https://gezhuang0717.github.io/traps.github.io/

## Website sections

- Research, publications, talks, facilities, databases and daily research updates
- Lab: Penning trap, MR-TOF, laser spectroscopy, nuclear data and RFQ workbenches
- Games: educational physics challenges, including the separate ideal-RFQ mass-filter game

The Lab RFQ workbench has a shared ion/RF operating point and seven tabs:

| Tab | Public calculation | Evidence boundary |
|---|---|---|
| Mathieu stability | Ideal four-rod characteristic bands, selected point and multi-stage comparisons | Ideal Mathieu only |
| Rod design | Circular-rod geometry and multipole indicators | Ideal geometry |
| Ion trajectories | RK4 integration of the ideal transverse Mathieu equations | No finite electrodes, collision dynamics or space charge |
| Gas cooling model | Uniform-gas kinetic collision-rate and energy-relaxation proxy | Not a measured cooling time, RF heating model or Monte Carlo |
| Bunching and extraction | Linearized field-free time/energy covariance; ideal inventory | No axial-potential solver or extraction-pulser trajectories |
| RF parameter scan | Ideal Mathieu operating points versus RF voltage | Not a real mass-filter transmission curve |
| Local data analysis | Browser-only CSV statistics for t_ns and E_eV, with optional x_mm/y_mm | No upload, no server retention, not native SIMION |

The Games RFQ tool remains educational, with a validated preset link to the Lab. Both are clearly labeled ideal calculations; **green stability is not experimental transport efficiency**.

All public model exports identify the model, numerical scope, and units. No experimental calibration, unpublished engineering baseline, credentials, or private reports are included.

## Repository layout

```text
site.yaml               public site identity and multilingual menus
content/<language>/     public Markdown pages
data/                   public YAML/JSON metadata and translations
layouts/                Hugo shortcodes and RFQ workbench tabs
static/js/              browser-local scientific calculators
static/css/             browser styles
tests/                  scientific and website regression tests
tools/                  build, public-source validation and publication checks
.github/workflows/      build/test and GitHub Pages deployment
themes/                 Git submodules: Congo, Blowfish, PaperMod
```

## Install and validate

Use Python 3.12, Node.js 24 and pinned Hugo Extended 0.166.0 as in CI.

```bash
git clone --recurse-submodules https://github.com/gezhuang0717/traps.github.io.git
cd traps.github.io
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python tools/site.py check
python -m pytest tests -q
node --test tests/*.test.cjs
hugo server --configDir sites/congo --themesDir themes
```

Open http://localhost:1313/traps.github.io/ or the URL printed by Hugo. GitHub Actions validates the full public build and links before publication; merging to `main` deploys only after the publication gate passes.

## Contribution and scientific validation

Make changes on a feature branch and preserve the public README, multilingual labels, regression tests, plots/exports, and exact physics conventions. Do not infer native field-map, RFQ cooling, mass resolution or transmission from analytical Mathieu stability. Lab models can be extended through separately tested JavaScript modules; private laboratory data and detailed internal reproducibility material must never enter the public repository.

The publication gate runs via `python tools/publish.py check` in CI. Browser-local CSV analysis is intentionally not a cloud upload.
