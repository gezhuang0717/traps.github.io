# Public mass-model sources

Fourteen models. Ground-state numerical predictions only; raw downloads, private experimental inputs and source audits are excluded. Unknown model uncertainty stays unknown. Each selected model loads independently.

| Model | Nuclei | Data | Paper |
|---|---:|---|---|
| FRDM1992 (published 1995) | 8755 | [Source](https://doi.org/10.1006/adnd.1995.1002) | [Paper](https://doi.org/10.1006/adnd.1995.1002) |
| FRDM2012 (published 2016) | 9318 | [Source](https://arxiv.org/pdf/1508.06294) | [Paper](https://doi.org/10.1016/j.adt.2015.10.002) |
| HFB-17 (Skyrme) | 9985 | [Source](https://doi.org/10.1103/PhysRevLett.102.152503) | [Paper](https://doi.org/10.1103/PhysRevLett.102.152503) |
| HFB-D1M (Gogny) | 8322 | [Source](https://doi.org/10.1103/PhysRevLett.102.242501) | [Paper](https://doi.org/10.1103/PhysRevLett.102.242501) |
| HFB-14 (BSk14) | 8388 | [Source](https://www.astro.ulb.ac.be/Nucdata/Masses/hfb14-plain) | [Paper](https://doi.org/10.1103/PhysRevC.75.064312) |
| HFB-24 (BSk24) | 8392 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb24-dat) | [Paper](https://doi.org/10.1103/PhysRevC.88.024308) |
| BSkG3 (2023) | 8485 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/bskg03-dat) | [Paper](https://doi.org/10.1140/epja/s10050-023-01158-6) |
| HFB-21 (BSk21) | 8387 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb21-dat) | [Paper](https://doi.org/10.1103/PhysRevC.82.035804) |
| HFB-25 (BSk25) | 9484 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb25-dat) | [Paper](https://doi.org/10.1103/PhysRevC.88.024308) |
| HFB-26 (BSk26) | 9511 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb26-dat) | [Paper](https://doi.org/10.1103/PhysRevC.88.024308) |
| HFB-27 (BSk27) | 8386 | [Source](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb27-dat) | [Paper](https://doi.org/10.1103/PhysRevC.88.061302) |
| KTUY05 (2005) | 9436 | [Source](https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05_m246.dat) | [Paper](https://doi.org/10.1143/PTP.113.305) |

| WS4 (2014) | 10237 | [Author data page](http://www.imqmd.com/mass/) | [WS4 paper](https://doi.org/10.1016/j.physletb.2014.05.049) |
| WS4+RBF (2014) | 10237 | [Author data page](http://www.imqmd.com/mass/) | [WS4 paper](https://doi.org/10.1016/j.physletb.2014.05.049), [RBF method](https://doi.org/10.1103/PhysRevC.84.051303) |

FRDM1992, HFB-17 and HFB-D1M retain their earlier TALYS1.95 normalized lineage; the other tables were independently recovered from public author or institutional sources. Per-model source JSON records the exact snapshot hash, column normalization, precision, coverage and checks.

ULB tables retain 10 keV mass precision and 0.01 beta2 precision. HFB14 requires fixed-column parsing because columns can be blank. Separation-energy consistency checks use the source rounding tolerance; they are not an experimental validation of a model.

KTUY05 retains JAEA atomic mass excesses at 10 keV source precision. All 9,436 mass entries match the separately published JAEA PDF table; 36,747 Sn/S2n/Sp/S2p checks agree within 0.016 MeV using the PDF’s rounded particle-mass constants. Both numerical tables contain 9,436 rows although the explanation says 9,437. Alpha2/alpha4/alpha6 are not exported as beta2: beta2 remains unavailable, together with model sigma. KTUY05 is fitted to AME2003 and is distinct from KTUY04.

## Update procedure

Save the public source and its URL outside the checkout. Review exact model variant, columns, units and coverage; independently compare numerical identities and separation/Q energies. Keep unknown values absent. Then run the appropriate importer and generator, test and review the interface before a normal commit. The KTUY importer pins the audited source hash; a changed source requires a new independent audit.

```sh
python tools/import_bruslib.py KEY /private/path/table --audit /private/path/audit.json
python tools/import_ktuy.py /private/path/KTUY05_m246.dat --audit /private/path/audit.json
python tools/make_mass_models.py
```

Keep the normalized table, source JSON, complete legacy JSON, lightweight index and individual payloads together. Hashes in the index prevent stale browser caches. Full chart must fit actual AME plus selected-model coverage. Missing beta2 must display as unavailable, never spherical zero.

## Coverage and exported missing values

Chart CSV includes the AME/reference and selected-model-only nuclei. AME columns stay reference values; separately named model columns hold the selected model’s mass and beta2. Unknown beta2 exports as a blank field; true zero remains zero. Chain-series CSV is separate.

A drip overlay requires a positive separation value immediately followed by a nonpositive one. A finite table cutoff and a missing neighbour are not a crossing. In KTUY05 the old table-edge shortcut gave49/44/10/7 unsupported Sn/S2n/Sp/S2p edges; the supported neighbouring brackets number80/85/189/192. Rounded model boundaries are predictions, not measured drip lines; no model uncertainty is supplied.

## Candidates still pending

WS3, the distinct DZ variants, HFB22/23, UNEDF0/1, BSkG1/2/4, INM2012 and FRLDM still require reliable public data lineage, exact versions and normalization checks. Private communication tables remain excluded. Source-access failures are not replaced with a different model under the requested name.

## WS4 variants

The author-labelled table dated 2014-June-3 contains A, Z, WS4 and WS4+RBF in MeV. The two predictions stay separate; the R comparison importer selects the fourth column, WS4+RBF. Both normalized tables retain 0.1 keV rounding. Neither model sigma nor beta2 is supplied. The supplied snapshot was checked against the original R importer for every identity and ME; the live author-host download was unavailable at review, while both papers were verified. This is a fixed table, not an RBF fit updated with the browser’s new masses. WS4 and WS4+RBF are related variants; their spread is not a confidence interval.

```sh
python tools/import_ws4.py /private/path/WS4_RBF.txt --audit /private/path/ws4-audit.json
python tools/make_mass_models.py
```
