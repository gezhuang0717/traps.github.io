---
title: "Mass filter equations and software guide"
subtitle: "Sources and reproducible conventions for the website and TrapLab"
date: "2026-10-24"
lang: "en-US"
---

Public edition 2026-10-24. Open a terminal in the separately installed companion application folder before running its commands. Module labels identify its entry points and are not download links. Equations and official references are preserved from the checked source edition. Canonical Markdown SHA-256: `f858a87ed961a5e62a4cfe32468744f8fa0f219578702bf1290b65d009cb88a6`.

This guide records all 38 shared mass-related quantities, the separate native legacy W indicator, and 28 legacy binding-energy recipes in the appendix, with exact stencils, units, signs, practical uses, sources and program entry points. Choose the physical question first, supply consistent masses, then interpret the output and its uncertainty. Equations follow the current source inventory; literature definitions and implementation conventions are distinguished. This is not a new mass evaluation, model-accuracy benchmark or measurement.

Machine-readable inventory and sources: current inventory · sources.json.

# Start with one reproducible question

To study neutron binding along the tin isotopes, choose s2n and fix Z at 50. The reference is AME2020. If the 116Sn mass excess is deliberately increased by 10 keV, the same primitive-mass stencil changes S₂ₙ of 116Sn by −10 keV, S₂ₙ of 118Sn by +10 keV, and the 116Sn two-neutron shell gap by −20 keV. This explicitly synthetic exercise demonstrates neighbouring sensitivity; it is not a new measurement. A separately rounded published reaction table can retain a small printed-value difference.

## Website workflow

Open the website Lab page and its chart of nuclides. Select a key from the chain-plot quantity menu, choose a fixed-Z, fixed-N or fixed-A chain, and select the reference nuclide and range. Colour layers, classed legends, manual colour limits, magic lines and N = Z are display controls; they do not change masses. When choosing AME, new inputs, mixed stencils or models, inspect the series source and uncertainty basis together.

[Website Lab](https://gezhuang0717.github.io/traps.github.io/lab/) · [Public source](https://github.com/gezhuang0717/traps.github.io)

Current website source: `layouts/_shortcodes/nuclide-chart.html`; `static/js/nuclide-chart.js`.

## Native applications and individual code

Use the existing launcher from the GUI checkout below. Both standalone entry points share the mass-workbench engine; the independent plotter generates data and static figures. These are operating instructions: this documentation build did not start Qt or rerun an analysis. Choose a fresh output directory and preserve the original inputs.

```sh

./Run_private.command apps/ame_nubase.py --quantity s2n --z 50 --minimum 60 --maximum 74
./Run_private.command apps/mulberry_mass.py --quantity s2n --z 50 --minimum 60 --maximum 74
./Run_private.command scripts/plot_mass_workbench.py --help
```

Each entry and the code index identify its functions, files and launch arguments. GUI session JSON preserves inputs and the view; CSV preserves editable masses and results; PNG, PDF and SVG are figures. Saving does not validate measurement provenance, and static mass comparisons need no physical-motion video. Windows execution and native file-dialog acceptance are outside this documentation build.

# Typed data input workflow

The current website My data panel treats a pasted table as a typed observable, never as an automatic mass replacement. For headerless `50,50,8`, the first two columns identify Z = 50 and N = 50 and the third is the value 8. Choose the quantity and input unit explicitly. The initial type is Custom with an explicit custom-unit label; it is not ME. Per-row quantity, unit, label or reference columns are not applied automatically. Split tables containing different physical quantities or units.

1. Open My data, paste `50,50,8`, select BE/A and MeV/nucleon, choose the value column, leave sigma unknown, and enter a series label and reference. Press Apply. The own point is 8 MeV/nucleon and the conversion preview is total BE = 800 MeV for A = 100. Selecting total BE instead means 8 MeV total. Selecting ME and keV makes the chain point 0.008 MeV. These are deliberately chosen input examples, not measured records.
2. To supply uncertainties, add a fourth numeric column and select it as sigma. Sigma must be nonnegative and use the same input unit as the value. A blank or unselected sigma is unknown; an entered zero is a reported zero. Both value and sigma undergo the same unit conversion.
3. Own points, AME and selected model checkboxes are independent. All 38 mass-filter quantities can be supplied as direct values and compared with the same available reference quantity. Radii and moments compare with the existing IAEA data; E2 and upward B(E2) use NNDC data. A custom observable has its own series only. Direct-input residuals are not calculated, and mass/max-sigma filters apply to reference/model series while direct points stay visible.
4. Use Append as measured masses or Replace measured masses only when you explicitly want a mass-table change. ME, total BE, BE/A and neutral atomic mass are the only adoptable types; ground-state catalogue identities are required. Append keeps prior rows and the current duplicate policy; Replace is explicit. All rows are validated before mutation. Direct Sn or other filter/property values remain observables and cannot become masses. Weighted duplicates containing unknown/zero sigma have no active weighted aggregate; choose last-row policy or provide positive sigmas.
5. Save inputs and settings JSON, then reopen through File or paste it and Apply. Raw text, selected value/sigma columns, quantity/unit, label/reference and own/reference/model choices are retained. Chain CSV records direct-input provenance; mass-table CSV/JSON additionally retain original quantity/value/unit, uncertainty status and input origin. Existing plot PNG/CSV controls operate on the plotted quantity; their native downloads are a separate browser acceptance task.

Energy chain values normalize to MeV, BE/A to MeV/nucleon, atomic mass to u, radii to fm, magnetic moments to μ_N, quadrupole moments to b, E2 to keV and upward B(E2) to e²b². The adapter scales e²fm⁴ by 1e-4 to e²b² and quadrupole fm² by 0.01 to b. It introduces no new fit, covariance estimate or mass-model equation.

Implementation: `static/js/chart-typed-data.js` provides units, adapt, massRows, portable and restore; `static/js/nuclide-chart.js` binds the controls; measured-masses and measured-masses-ui handle explicit adoption. The source-freeze receipt records 88 targeted Node and 14 targeted Python tests. This is source/fixture evidence, not a claim that file selection, downloads or a full browser workflow were verified by the manual build.

Receipt: typed input implementation and source freeze.

# Notation units and uncertainty

Z is proton number, N is neutron number and $A=Z+N$. M in the equations denotes neutral-atom mass excess ME, normally in keV; some plots divide both value and uncertainty by 1000 to show MeV. B or BE is positive total binding energy and BEA is binding energy per nucleon. Symbols n, H, d and α denote the mass excesses of a neutron, neutral hydrogen, deuterium and helium. State assignments must agree, and a missing neighbour must not be replaced by zero.

$$
\mathrm{ME}(Z,N)=\bigl[M_{\mathrm{atom}}(Z,N)-Au\bigr]c^2,\qquad A=Z+N
$$

$$
F(Z,N)=\sum_i c_i\,\mathrm{ME}(Z+\Delta Z_i,N+\Delta N_i)+C
$$

Stencil coefficients are dimensionless. Offset C must use the same energy unit as the output. Combine repeated occurrences of an identical primitive mass before propagating uncertainty. Full covariance and its independent approximation are:

$$
\sigma_F^2=\boldsymbol{c}^{\mathsf T}\mathbf C\boldsymbol{c},\qquad \sigma_{F,\mathrm{ind}}^2=\sum_i c_i^2\sigma_i^2
$$

Directly published AME energies and errors retain evaluation correlations. Marginal mass errors used for new inputs or arbitrary stencils are not full evaluated covariance. All fourteen model mass uncertainties remain unknown; extra model columns or model spread must not be relabelled experimental uncertainty. The following explanation reuses the existing bilingual AME audit guide.

Let a quantity be a linear combination of mass excesses. Its variance depends on both individual mass errors and correlations:

$$
q=\sum_i c_i\,\mathrm{ME}_i,\qquad
\sigma_q^2=\sum_i c_i^2\sigma_i^2+2\sum_{i<j}c_i c_j\,\mathrm{Cov}(\mathrm{ME}_i,\mathrm{ME}_j).
$$

For two masses in a decay-energy difference:

$$
q=\mathrm{ME}_P-\mathrm{ME}_D,\qquad
\sigma_q^2=\sigma_P^2+\sigma_D^2-2\,\mathrm{Cov}(\mathrm{ME}_P,\mathrm{ME}_D).
$$

The AME least-squares evaluation links masses through shared mass-spectrometric, decay and reaction constraints. Its published energy uncertainties retain these evaluation correlations. Setting every off-diagonal covariance to zero is a separate approximation, documented as independent propagation. A positive parent–daughter covariance reduces the uncertainty of their difference. A coefficient with the same sign changes that effect. The figure compares the published result with the diagonal approximation; it does not reconstruct the covariance matrix. See [AME2020 Part I](https://doi.org/10.1088/1674-1137/abddb0).

Atomic masses and mass excesses give the following ground-state expressions. ME denotes mass excess expressed as an energy, and the neutron ME uses the same AME source:

$$
Q_{\beta^-}=\mathrm{ME}(Z,N)-\mathrm{ME}(Z+1,N-1),
$$

$$
Q_{2\beta^-}=\mathrm{ME}(Z,N)-\mathrm{ME}(Z+2,N-2),\qquad
S_{2n}=\mathrm{ME}(Z,N-2)+2\mathrm{ME}_n-\mathrm{ME}(Z,N).
$$

Other double-beta channels need the correct electron thresholds: the neutral-atom double-electron-capture mass difference is the parent minus the daughter at Z−2; EC plus beta-plus subtracts two electron rest energies, and double beta-plus subtracts four. Capture-hole energies and daughter excitation energies are additional channel-specific requirements. A ground-state mass difference alone does not establish a resonant capture condition, decay rate or branching ratio.

## Constants and implementation differences

| Profile | Constant key | Value |
| --- | --- | ---: |
| web | u_keV | 931494.10242 |
| web | electron_u | 0.000548579909065 |
| web | u_kg | 1.6605390666e-27 |
| web | electron_keV | 510.99895000014743 |
| native | u_keV | 931494.10242 |
| native | electron_u | 0.0005485799090441 |
| native | u_kg | 1.66053906892e-27 |
| native | electron_keV | 510.99894998067913 |
| legacy_gsi | ME_n_keV | 8071.3181 |
| legacy_gsi | ME_H_keV | 7288.97106 |
| legacy_gsi | electron_u | 0.000548579909065 |

u_keV is one atomic-mass unit in rest energy (keV); electron_u is electron mass in u and electron_keV its rest energy; u_kg is in kg. Legacy ME_n_keV and ME_H_keV are in keV.

| Reference particle | ME keV | σ keV |
| --- | ---: | ---: |
| n | 8071.31806 | 0.00044 |
| H | 7288.971064 | 1.3e-05 |
| d | 13135.722895 | 1.5e-05 |
| alpha | 2424.91587 | 0.00015 |

These constants describe the current code snapshot. The website and native default use different CODATA editions for electron rest energy; preserve the documented difference rather than forcing numerical identity. Positron channels need their atomic-mass electron thresholds; an EC mass difference is not a shell-resolved neutrino energy.

**legacy-W** · Native legacy W uses fixed quarter-normalized D2pS2n at adjacent isobar centers. Shared wig uses parity-dependent vpn at N±2 with fixed Z. R W1/W2/W3 are three additional distinct stencils.

**pn-parity** · Legacy native dVpn is an alias for fixed D2pS2n, not the general parity-dependent vpn. They agree at even-even centers only. Other fixed mixed filters match the physical automatic parity branch as stated.

**electron-constants** · Web uses AME2020/CODATA2018 electron_u=5.48579909065e-4. Native default uses CODATA2022 electron_u=5.485799090441e-4 with AME2020 u_keV=931494.10242. qecbp and q2bp differ by the corresponding 2e/4e threshold. Constants are fixed in these errors; no independent electron/u uncertainty is added.

**SI-u** · Web u_kg=1.66053906660e-27 vs native default1.66053906892e-27. This affects mass/frequency conversions, not pure keV mass stencils. Native AME2020_COMPAT is separately selectable in APIs.

**input-sigma-hash** · Native experimental workbench permits separate trailing # on value and uncertainty. Web measured-masses.js accepts # on value but requires plain numeric positive sigma. Public AME primitives preserve separate value and sigma flags in both.

**light-models** · Web mass-surface uses experimental n/H/alpha (and experimental deuterium fallback) even for models. Native ModelData fills missing light species from AME with unknown sigma, but does not override a light species already present in a model payload. Constants.py rounded legacy light values are separate from the richer canonical reference data.

**published-vs-raw** · Both default canonical reference surfaces prefer published AME values/evaluated uncertainties or exact reverse mass differences. Supplying custom/model maps disables these overrides. Small value differences from independently rounded source columns are retained.

**legacy-Gsym** · R metadata prose states 2δ−δ−δ without /2, but executable CSV weights and canonical Gsym have /2. Inventory documents executable behavior.

**recipe-units** · R-derived recipes use BE inputs and mixed output units MeV/keV, fixed R H=7288.97106 keV, and explicit Qec offset. Canonical surface uses ME primitives and all outputs keV except BEA. A same-looking key is not a unit guarantee.

**recipe-covariance** · Canonical Surface has diagonal primitive covariance only, plus direct evaluated override. GSI apply_energy_operator optionally accepts a user-supplied input-row covariance; science.nuclear_mass_operator instead expects covariance in original coefficient order, including zero weights. These matrix layouts must not be interchanged.

**old-manual-constant-description** · Existing NUCLEAR_REFERENCE_EN.md says website CODATA2018 thresholds for the adapter; current native default uses the mixed compatibility profile stated above. Treat older claims of complete numeric web/native parity as historical evidence at their source hashes.

**edition-uncertainty** · Chart edition difference is ME2020−MEedition and hypot of marginal sigmas when both known. Evaluations share data/correlations, so this is a diagonal approximation, not a published evaluated cross-edition uncertainty.

**model-residual-error** · Chart dmod shows MEAME−MEmodel and experimental sigma only; this is conditional data uncertainty, not total theory predictive error. Native model residual uncertainty remains unknown when model errors are absent.

## Supporting conversion and processing equations

### linear_uncertainty

$$
F=\sum_i c_i M_i+C,\quad \sigma_F^2=\sum_i c_i^2\sigma_i^2\quad(\mathrm{diagonal})
$$

Combine identical primitive identities before squaring. A zero-coefficient absent/unknown mass has no effect. Unknown nonzero sigma makes sigma unknown. Genuine zero sigma stays zero. Constant offsets are fixed.

### full_covariance

$$
\sigma_F^2=\boldsymbol c^\mathsf{T}\mathbf C\boldsymbol c=\sum_i c_i^2C_{ii}+2\sum_{i<j}c_ic_jC_{ij}
$$

Implemented only when explicit covariance is supplied to GSI adapters; direct evaluated AME errors are retained without reconstructing C.

### atomic_mass

$$
M_{\mathrm{atom}}/u=A+M(Z,N)/(u c^2),\quad u c^2=931494.10242\ {\mathrm{keV}}
$$

Mass excess M in energy keV, not absolute atomic mass. Atomic mass sigma=sigmaME/uKeV; fixed conversion constant.

### ion_mass

$$
M_{\mathrm{ion}}/u=M_{\mathrm{atom}}/u-q m_e/u+E_{\mathrm{ion}}/(u c^2)
$$

Signed q. Binding/ionization correction positive increases ion mass relative to pure electron subtraction. Binding input eV requires denominator1000*uKeV. No binding or constant uncertainty invented. Web catalogue resolve omits these binding energies.

### ratio_mass

$$
r=\nu_{\mathrm{ref}}/\nu_{\mathrm{IOI}},\quad M_{\mathrm{IOI,ion}}=r(q_{\mathrm{IOI}}/q_{\mathrm{ref}})M_{\mathrm{ref,ion}}
$$

Neutralization adds qIOI electron masses and subtracts IOI ionization correction. Charges are positive magnitudes in ratio_mass_result. Independent sigma contributions factor*MrefIon*sigma_r and factor*r*sigma_ref are added in quadrature.

### weighted_duplicates

$$
\bar M=\frac{\sum_i M_i/\sigma_i^2}{\sum_i1/\sigma_i^2},\quad \sigma_{\bar M}=(\sum_i1/\sigma_i^2)^{-1/2}\max[1,\sqrt{\chi^2/(k-1)}]
$$

Independent duplicate input rows only; last-row policy is an alternative. No facility/systematic covariance or global AME adjustment.

### residual_cancellation

$$
\Delta F=F_{\mathrm{New}}-F_{\mathrm{AME}},\quad \sigma_{\Delta F}^2=\sum_{\text{replaced }i}c_i^2(\sigma_{{\mathrm{New}},i}^2+\sigma_{{\mathrm{AME}},i}^2)
$$

Native Workbench residual rule; unchanged shared AME primitives cancel. It is a declared diagonal comparison, not propagation of independent nested reaction errors.

### single_beta_plus

$$
Q_{\beta^+}=M(Z,N)-M(Z-1,N+1)-2e
$$

Implemented native physics.q_beta_plus and decay.evaluate, separate from the canonical qecbp double-weak mode.

### state_Qstar

$$
Q^*=Q_{\mathrm{selected\ states}}-E_x,\quad \sigma_{Q^*}=\sqrt{\sigma_Q^2+\sigma_{E_x}^2}
$$

Native decay.evaluate. Selected daughter-state excitation already in its mass; Ex is ADDITIONAL energy. Ground-ground evaluated lookup when available; otherwise selected NUBASE masses diagonal. Missing sigma remains unknown.

### general_reaction

$$
Q=\sum_{\mathrm{reactants}}a_i M_i-\sum_{\mathrm{products}}b_j M_j
$$

NuclearData.reaction checks total A and Z conservation for neutral atoms, combines repeated identities and propagates diagonal primitive sigma. No evaluated covariance or molecular binding correction.

### drip_boundary

$$
S_n>0,\ S_n(N+1)\leq0\quad\text{or analogous }S_{2n},S_p,S_{2p}
$$

dripBoundary returns last positive integer-index sample only if its immediate index+1 neighbor is finite and nonpositive. Missing samples and source-table edges are not physical drip lines; no interpolation.

### legacy_four_mass_tool

$$
S_n=M_{N-1}+n-M_N,\quad S_{2n}=M_{N-2}+2n-M_N,\quad Q_{\mathrm{EC}}=M_N-M_{\mathrm{daughter}}
$$

gsi_mrtof.science.mass_quantities: optional four independent nonnegative input sigmas; fixed historical neutron ME offset. No covariance lookup.

# Equations and practical use by quantity

Every entry gives the actual equation and primitive-mass stencil. Keys remain unchanged so they can be searched in menus, command lines and source. Use the equation's sign and parity factors rather than inferring them from a name. A positive Q only establishes an energy allowance for its stated channel; a difference or cusp does not identify a unique structural mechanism.

## 1 me Mass excess

Neutral atomic mass excess

Use and what it reveals: Compare the atomic mass with the integer mass number; inspect evaluation residuals.

$$
M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-91525.979 ± 0.096 keV

Default evaluated reference: -91525.979 ± 0.096 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn me --format csv
```

## 2 BE Total binding energy

Positive total nuclear binding energy in the atomic-hydrogen convention

Use and what it reveals: Compare total binding; neutral hydrogen accounts for atomic electrons.

$$
B(Z,N)=Z H+N n-M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | Z |
| n | N |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

988681.52416 ± 0.10029827565815876 keV

Default evaluated reference: 988681.5256 ± 0.1044 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn BE --format csv
```

## 3 BEA Binding energy / nucleon

Binding energy per nucleon

Use and what it reveals: Compare binding on a per-nucleon scale; divide by A, not by Z or N.

$$
B(Z,N)/A,\quad A=Z+N
$$

Output unit: keV/nucleon. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -1/A |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | Z/A |
| n | N/A |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

8523.116587586206 ± 0.0008646403073979202 keV/nucleon

Default evaluated reference: 8523.1166 ± 0.0009 keV/nucleon

[Original source table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn BEA --format csv
```

## 4 sn One-neutron separation Sn

Energy required to remove one neutron

Use and what it reveals: Inspect one-neutron thresholds and local changes in binding.

$$
S_n=M(Z,N-1)+n-M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `S1n`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 1 |
| 0 | 0 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| n | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

9563.451060000001 ± 0.09716580468456996 keV

Default evaluated reference: 9563.4512 ± 0.0948 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 27

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn sn --format csv
```

## 5 s2n Two-neutron separation S2n

Energy required to remove two neutrons

Use and what it reveals: Track isotopic trends with reduced odd-even staggering.

$$
S_{2n}=M(Z,N-2)+2n-M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `S2n`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| n | 2 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

17108.880120000005 ± 0.10028845596577904 keV

Default evaluated reference: 17108.8797 ± 0.098 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 27

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2n --format csv
```

## 6 sp One-proton separation Sp

Atomic-convention one-proton separation energy

Use and what it reveals: Inspect proton-emission thresholds. H means neutral 1H, not bare-proton mass excess.

$$
S_p=M(Z-1,N)+H-M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `S1p`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | 0 | 1 |
| 0 | 0 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

9278.593064000004 ± 0.09674709385299385 keV

Default evaluated reference: 9278.5934 ± 0.0953 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 28

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn sp --format csv
```

## 7 s2p Two-proton separation S2p

Atomic-convention two-proton separation energy

Use and what it reveals: Inspect two-proton thresholds and isotonic trends.

$$
S_{2p}=M(Z-2,N)+2H-M(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `S2p`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | 0 | 1 |
| 0 | 0 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | 2 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

16088.987128000013 ± 0.29221909704192844 keV

Default evaluated reference: 16088.987 ± 0.2899 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 28

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2p --format csv
```

## 8 qbm Q(beta-)

Total atomic beta-minus energy allowance

Use and what it reveals: Check energetics; positive Q does not predict a branch, endpoint to an excited level, or rate.

$$
Q_{\beta^-}=M(Z,N)-M(Z+1,N-1)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 1 | -1 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-4703.959000000003 ± 5.154893985330833 keV

Default evaluated reference: -4703.9591 ± 5.154 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qbm --format csv
```

## 9 qec Q(EC)

Total atomic electron-capture energy allowance

Use and what it reveals: Subtract shell-hole and daughter-excitation energies separately for a capture-specific neutrino energy.

$$
Q_{\mathrm{EC}}=M(Z,N)-M(Z-1,N+1)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | 1 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-3276.221000000005 ± 0.24003333101883997 keV

Default evaluated reference: -3276.2204 ± 0.2397 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qec --format csv
```

## 10 qa Q(alpha)

Neutral-atom alpha-decay energy allowance

Use and what it reveals: Compare alpha energetics, excluding recoil partition and daughter excitation.

$$
Q_\alpha=M(Z,N)-M(Z-2,N-2)-\alpha
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | -2 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| alpha | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-3376.037870000003 ± 0.26779847367003423 keV

Default evaluated reference: -3376.0374 ± 0.2664 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qa --format csv
```

## 11 q2bm Q(2beta-)

Total double-beta-minus energy allowance

Use and what it reveals: Compare double-beta candidate ground-state differences; no matrix element or rate is calculated.

$$
Q_{2\beta^-}=M(Z,N)-M(Z+2,N-2)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 2 | -2 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-6262.1860000000015 ± 24.2061903652764 keV

Default evaluated reference: -6262.1863 ± 24.206 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 35

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2bm --format csv
```

## 12 q2ec Q(2EC)

Total double-electron-capture atomic energy allowance

Use and what it reveals: Capture shells, vacancies and final excitation are additional physics.

$$
Q_{2{\mathrm{EC}}}=M(Z,N)-M(Z-2,N+2)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-2813.4900000000052 ± 0.1865904606350496 keV

Default evaluated reference: -2813.4899 ± 0.1295 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 36

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2ec --format csv
```

## 13 qecbp Q(EC beta+)

Mixed electron-capture/positron threshold

Use and what it reveals: Includes two fixed electron rest energies; this is not single-beta-plus Q.

$$
Q_{{\mathrm{EC}}\beta^+}=M(Z,N)-M(Z-2,N+2)-2e
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

Constant offset: 

$$
C=-2e
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-3835.4878999613634 ± 0.1865904606350496 keV

Default evaluated reference: -3835.487799961358 ± 0.1295 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 37

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qecbp --format csv
```

## 14 q2bp Q(2beta+)

Double-positron threshold

Use and what it reveals: Includes four fixed electron rest energies.

$$
Q_{2\beta^+}=M(Z,N)-M(Z-2,N+2)-4e
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

Constant offset: 

$$
C=-4e
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-4857.4857999227215 ± 0.1865904606350496 keV

Default evaluated reference: -4857.485699922717 ± 0.1295 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 38

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2bp --format csv
```

## 15 q4bm Q(4beta-)

Formal quadruple-beta-minus atomic mass difference

Use and what it reveals: Check mass allowance only; not an observed-mode or probability claim.

$$
Q_{4\beta^-}=M(Z,N)-M(Z+4,N-4)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 4 | -4 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-18479.102000000014 ± 13.017353993803809 keV

Default evaluated reference: -18479.1015 ± 13.0175 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 39

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q4bm --format csv
```

## 16 qep Q(EC p)

Electron-capture plus proton-emission atomic mass difference

Use and what it reveals: Check the combined final-state energy allowance; no branching or sequential threshold model.

$$
Q_{{\mathrm{EC}}p}=M(Z,N)-M(Z-2,N+1)-H
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 1 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-10730.470064000012 ± 0.6580402724522262 keV

Default evaluated reference: -10730.4702 ± 0.6573 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 40

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qep --format csv
```

## 17 qbmn Q(beta- n)

Beta-minus plus neutron-emission atomic mass difference

Use and what it reveals: Check a beta-delayed neutron energy allowance; no feeding model.

$$
Q_{\beta^-n}=M(Z,N)-M(Z+1,N-2)-n
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 1 | -2 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| n | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-12593.88506000001 ± 16.025287554162638 keV

Default evaluated reference: -12593.8847 ± 16.0256 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 41

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qbmn --format csv
```

## 18 qda Q(d,alpha)

Target(d,alpha) reaction Q

Use and what it reveals: Neutral-atom bookkeeping conserves mass number and charge.

$$
Q_{(d,\alpha)}=M(Z,N)+d-M(Z-1,N-1)-\alpha
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | -1 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| d | 1 |
| alpha | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

7754.635024999995 ± 0.3159383210770735 keV

Default evaluated reference: 7754.6353 ± 0.3154 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 45

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qda --format csv
```

## 19 qpa Q(p,alpha)

Target(p,alpha) reaction Q

Use and what it reveals: The projectile hydrogen atom and alpha atom provide the consistent electron bookkeeping.

$$
Q_{(p,\alpha)}=M(Z,N)+H-M(Z-1,N-2)-\alpha
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | -2 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| H | 1 |
| alpha | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

2705.1991940000007 ± 0.21109245052583003 keV

Default evaluated reference: 2705.1998 ± 0.2103 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 46

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qpa --format csv
```

## 20 qna Q(n,alpha)

Target(n,alpha) reaction Q

Use and what it reveals: The neutron and alpha mass excesses are explicit light-particle inputs.

$$
Q_{(n,\alpha)}=M(Z,N)+n-M(Z-2,N-1)-\alpha
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | -1 | -1 |

Light-particle terms

| Particle | Coefficient |
| --- | ---: |
| n | 1 |
| alpha | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

3163.709189999986 ± 0.263137257149192 keV

Default evaluated reference: 3163.7098 ± 0.2602 keV

[Original source table](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 47

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qna --format csv
```

## 21 d2n Neutron shell gap delta2n

Empirical two-neutron shell gap

Use and what it reveals: A local two-step curvature; interpretation as a shell closure needs other structure evidence.

$$
\delta_{2n}=M(Z,N-2)-2M(Z,N)+M(Z,N+2)=S_{2n}(Z,N)-S_{2n}(Z,N+2)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `dS2n`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -2 |
| 0 | 2 | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

839.3800000000192 ± 0.5354493440093097 keV

Default evaluated reference: 839.3800000000192 ± 0.5354493440093097 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 49

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d2n --format csv
```

## 22 d2p Proton shell gap delta2p

Empirical two-proton shell gap

Use and what it reveals: A local proton two-step curvature.

$$
\delta_{2p}=M(Z-2,N)-2M(Z,N)+M(Z+2,N)=S_{2p}(Z,N)-S_{2p}(Z+2,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `dS2p`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | 0 | 1 |
| 0 | 0 | -2 |
| 2 | 0 | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

5346.266000000018 ± 18.309087251963163 keV

Default evaluated reference: 5346.266000000018 ± 18.309087251963163 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 55

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d2p --format csv
```

## 23 d3n Neutron OES delta3n

Signed three-point neutron odd-even staggering

Use and what it reveals: Apply the implemented (-1)^N convention; no absolute-value clamp.

$$
\Delta_n^{(3)}=\frac{(-1)^N}{2}[M(Z,N-1)-2M(Z,N)+M(Z,N+1)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `D3n`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 * (-1)^N |
| 0 | 0 | -1 * (-1)^N |
| 0 | 1 | 0.5 * (-1)^N |

Constant offset: 

$$
C=0
$$

Convention: (-1)^N multiplies the full stencil; signs are not absolute-valued.

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`, `pairing-context-satula1998`. Pairing literature is context, not a claim of direct code attribution.

### Checkable example

**116Sn** · Calculated from retained source data

1310.185000000005 ± 0.25998942286177723 keV

Default evaluated reference: 1310.185000000005 ± 0.25998942286177723 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 51

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d3n --format csv
```

## 24 d3p Proton OES delta3p

Signed three-point proton odd-even staggering

Use and what it reveals: Apply (-1)^Z, not (-1)^N.

$$
\Delta_p^{(3)}=\frac{(-1)^Z}{2}[M(Z-1,N)-2M(Z,N)+M(Z+1,N)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `D3p`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | 0 | 0.5 * (-1)^Z |
| 0 | 0 | -1 * (-1)^Z |
| 1 | 0 | 0.5 * (-1)^Z |

Constant offset: 

$$
C=0
$$

Convention: (-1)^Z multiplies the full stencil; signs are not absolute-valued.

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`, `pairing-context-satula1998`. Pairing literature is context, not a claim of direct code attribution.

### Checkable example

**116Sn** · Calculated from retained source data

2438.0185000000056 ± 4.219596455823708 keV

Default evaluated reference: 2438.0185000000056 ± 4.219596455823708 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 52

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d3p --format csv
```

## 25 d5n Neutron OES delta5n

Signed five-point neutron odd-even staggering

Use and what it reveals: Suppress smooth low-order trends; the ME sign is opposite to the BE stencil sign.

$$
\Delta_n^{(5)}=\frac{(-1)^N}{8}[-M(Z,N-2)+4M(Z,N-1)-6M(Z,N)+4M(Z,N+1)-M(Z,N+2)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.125 * (-1)^N |
| 0 | -1 | 0.5 * (-1)^N |
| 0 | 0 | -0.75 * (-1)^N |
| 0 | 1 | 0.5 * (-1)^N |
| 0 | 2 | -0.125 * (-1)^N |

Constant offset: 

$$
C=0
$$

Convention: (-1)^N multiplies the full stencil; signs are not absolute-valued.

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`, `pairing-context-satula1998`. Pairing literature is context, not a claim of direct code attribution.

### Checkable example

**116Sn** · Calculated from retained source data

1205.2625000000062 ± 0.2597427212647161 keV

Default evaluated reference: 1205.2625000000062 ± 0.2597427212647161 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 53

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d5n --format csv
```

## 26 d5p Proton OES delta5p

Signed five-point proton odd-even staggering

Use and what it reveals: Uses proton parity and neighbors at fixed N.

$$
\Delta_p^{(5)}=\frac{(-1)^Z}{8}[-M(Z-2,N)+4M(Z-1,N)-6M(Z,N)+4M(Z+1,N)-M(Z+2,N)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | 0 | -0.125 * (-1)^Z |
| -1 | 0 | 0.5 * (-1)^Z |
| 0 | 0 | -0.75 * (-1)^Z |
| 1 | 0 | 0.5 * (-1)^Z |
| 2 | 0 | -0.125 * (-1)^Z |

Constant offset: 

$$
C=0
$$

Convention: (-1)^Z multiplies the full stencil; signs are not absolute-valued.

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`, `pairing-context-satula1998`. Pairing literature is context, not a claim of direct code attribution.

### Checkable example

**116Sn** · Calculated from retained source data

1769.735250000007 ± 4.7998167217613625 keV

Default evaluated reference: 1769.735250000007 ± 4.7998167217613625 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 54

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d5p --format csv
```

## 27 vpn Parity-dependent deltaVpn

Parity-dependent average proton-neutron interaction indicator

Use and what it reveals: Select the physical branch using both Z and N parity. This is an empirical mass difference.

$$
\delta V_{pn}(Z,N)=\sum_i b_i B(Z+\Delta Z_i,N+\Delta N_i)\quad\text{(four parity branches)}
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Constant offset: 

$$
C=0
$$

Z even, N even

$$
\delta V_{pn}^{ee}=\frac14[-M(Z,N)+M(Z,N-2)+M(Z-2,N)-M(Z-2,N-2)]
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |

Z even, N odd

$$
\delta V_{pn}^{eo}=\frac12[-M(Z,N)+M(Z,N-1)+M(Z-2,N)-M(Z-2,N-1)]
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |

Z odd, N even

$$
\delta V_{pn}^{oe}=\frac12[-M(Z,N)+M(Z,N-2)+M(Z-1,N)-M(Z-1,N-2)]
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | -2 | -0.5 |
| -1 | 0 | 0.5 |
| 0 | -2 | 0.5 |
| 0 | 0 | -0.5 |

Z odd, N odd

$$
\delta V_{pn}^{oo}=-M(Z,N)+M(Z,N-1)+M(Z-1,N)-M(Z-1,N-1)
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | -1 | -1 |
| -1 | 0 | 1 |
| 0 | -1 | 1 |
| 0 | 0 | -1 |

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`.

### Checkable example

**116Sn** · Calculated from retained source data

381.54175000000396 ± 0.09641479398930436 keV

Default evaluated reference: 381.54175000000396 ± 0.09641479398930436 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 60

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn vpn --format csv
```

## 28 wig Wigner N-chain indicator

Fixed-Z neutron-chain Wigner cusp indicator

Use and what it reveals: Compares vpn at N and N±2. It is not the native legacy isobar W or R W1/W2/W3.

$$
W_N(Z,N)=\delta V_{pn}(Z,N)-\frac12[\delta V_{pn}(Z,N-2)+\delta V_{pn}(Z,N+2)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Constant offset: 

$$
C=0
$$

Z even, N even

$$
0.125M(Z-2,N-4)-0.375M(Z-2,N-2)+0.375M(Z-2,N)-0.125M(Z-2,N+2)-0.125M(Z,N-4)+0.375M(Z,N-2)-0.375M(Z,N)+0.125M(Z,N+2)
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | -4 | 0.125 |
| -2 | -2 | -0.375 |
| -2 | 0 | 0.375 |
| -2 | 2 | -0.125 |
| 0 | -4 | -0.125 |
| 0 | -2 | 0.375 |
| 0 | 0 | -0.375 |
| 0 | 2 | 0.125 |

Z even, N odd

$$
0.25M(Z-2,N-3)-0.25M(Z-2,N-2)-0.5M(Z-2,N-1)+0.5M(Z-2,N)+0.25M(Z-2,N+1)-0.25M(Z-2,N+2)-0.25M(Z,N-3)+0.25M(Z,N-2)+0.5M(Z,N-1)-0.5M(Z,N)-0.25M(Z,N+1)+0.25M(Z,N+2)
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | -3 | 0.25 |
| -2 | -2 | -0.25 |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |
| -2 | 1 | 0.25 |
| -2 | 2 | -0.25 |
| 0 | -3 | -0.25 |
| 0 | -2 | 0.25 |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |
| 0 | 1 | -0.25 |
| 0 | 2 | 0.25 |

Z odd, N even

$$
0.25M(Z-1,N-4)-0.75M(Z-1,N-2)+0.75M(Z-1,N)-0.25M(Z-1,N+2)-0.25M(Z,N-4)+0.75M(Z,N-2)-0.75M(Z,N)+0.25M(Z,N+2)
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | -4 | 0.25 |
| -1 | -2 | -0.75 |
| -1 | 0 | 0.75 |
| -1 | 2 | -0.25 |
| 0 | -4 | -0.25 |
| 0 | -2 | 0.75 |
| 0 | 0 | -0.75 |
| 0 | 2 | 0.25 |

Z odd, N odd

$$
0.5M(Z-1,N-3)-0.5M(Z-1,N-2)-M(Z-1,N-1)+M(Z-1,N)+0.5M(Z-1,N+1)-0.5M(Z-1,N+2)-0.5M(Z,N-3)+0.5M(Z,N-2)+M(Z,N-1)-M(Z,N)-0.5M(Z,N+1)+0.5M(Z,N+2)
$$

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | -3 | 0.5 |
| -1 | -2 | -0.5 |
| -1 | -1 | -1 |
| -1 | 0 | 1 |
| -1 | 1 | 0.5 |
| -1 | 2 | -0.5 |
| 0 | -3 | -0.5 |
| 0 | -2 | 0.5 |
| 0 | -1 | 1 |
| 0 | 0 | -1 |
| 0 | 1 | -0.5 |
| 0 | 2 | 0.5 |

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Attribution: this entry follows the current implementation. Its name does not prove identity with a similarly named quantity in a paper.

Source index: `ame2020`, `filters-implementation`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`.

### Checkable example

**116Sn** · Calculated from retained source data

-6.846624999992855 ± 0.16974401683122736 keV

Default evaluated reference: -6.846624999992855 ± 0.16974401683122736 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn wig --format csv
```

## 29 D1nS1n D1nS1n mass filter

One-neutron finite-difference gap

Use and what it reveals: A one-step second difference; without parity factor it is not the pairing indicator.

$$
S_n(Z,N)-S_n(Z,N+1)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 1 |
| 0 | 0 | -2 |
| 0 | 1 | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

2620.37000000001 ± 0.5199788457235545 keV

Default evaluated reference: 2620.37000000001 ± 0.5199788457235545 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 24
- mass-surface.js · `create.derive` · line 8

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1nS1n --format csv
```

## 30 D1pS1p D1pS1p mass filter

One-proton finite-difference gap

Use and what it reveals: A one-step second difference along Z.

$$
S_p(Z,N)-S_p(Z+1,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -1 | 0 | 1 |
| 0 | 0 | -2 |
| 1 | 0 | 1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

4876.037000000011 ± 8.439192911647416 keV

Default evaluated reference: 4876.037000000011 ± 8.439192911647416 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 25
- mass-surface.js · `create.derive` · line 9

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS1p --format csv
```

## 31 D1nS2n D1nS2n mass filter

Forward slope of two-neutron separation energy

Use and what it reveals: Sign is next minus current, not current minus next.

$$
S_{2n}(Z,N+1)-S_{2n}(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -1 |
| 0 | -1 | 1 |
| 0 | 0 | 1 |
| 0 | 1 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-602.3480000000127 ± 0.49352912781314134 keV

Default evaluated reference: -602.3480000000127 ± 0.49352912781314134 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 26
- mass-surface.js · `create.derive` · line 10

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1nS2n --format csv
```

## 32 D1pS2p D1pS2p mass filter

Forward slope of two-proton separation energy

Use and what it reveals: Proton analogue of the forward S2n slope.

$$
S_{2p}(Z+1,N)-S_{2p}(Z,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -2 | 0 | -1 |
| -1 | 0 | 1 |
| 0 | 0 | 1 |
| 1 | 0 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-2407.838000000018 ± 8.442067578502318 keV

Default evaluated reference: -2407.838000000018 ± 8.442067578502318 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 27
- mass-surface.js · `create.derive` · line 11

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS2p --format csv
```

## 33 D2pS2n D2pS2n mass filter

Quarter-normalized two-proton/two-neutron mixed difference

Use and what it reveals: Equals the automatic vpn branch only at even Z and even N.

$$
\frac14[S_{2n}(Z,N)-S_{2n}(Z-2,N)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

Menu or code aliases: `dVpn`.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.25 |
| 0 | -2 | 0.25 |
| -2 | 0 | 0.25 |
| -2 | -2 | -0.25 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

381.54175000000396 ± 0.09641479398930436 keV

Default evaluated reference: 381.54175000000396 ± 0.09641479398930436 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 28
- mass-surface.js · `create.derive` · line 12

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D2pS2n --format csv
```

## 34 D1pS1n D1pS1n mass filter

One-proton/one-neutron mixed difference

Use and what it reveals: Equals automatic vpn at odd Z and odd N.

$$
S_n(Z,N)-S_n(Z-1,N)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -1 |
| 0 | -1 | 1 |
| -1 | 0 | 1 |
| -1 | -1 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

525.5829999999987 ± 0.31652172121356853 keV

Default evaluated reference: 525.5829999999987 ± 0.31652172121356853 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 29
- mass-surface.js · `create.derive` · line 13

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS1n --format csv
```

## 35 D1pS2n D1pS2n mass filter

Half-normalized one-proton/two-neutron mixed difference

Use and what it reveals: Equals automatic vpn at odd Z and even N.

$$
\frac12[S_{2n}(Z,N)-S_{2n}(Z-1,N)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.5 |
| 0 | -2 | 0.5 |
| -1 | 0 | 0.5 |
| -1 | -2 | -0.5 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

398.50500000000466 ± 0.10670637281812179 keV

Default evaluated reference: 398.50500000000466 ± 0.10670637281812179 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 30
- mass-surface.js · `create.derive` · line 14

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS2n --format csv
```

## 36 D2pS1n D2pS1n mass filter

Half-normalized two-proton/one-neutron mixed difference

Use and what it reveals: Equals automatic vpn at even Z and odd N; dZ is -2.

$$
\frac12[S_n(Z,N)-S_n(Z-2,N)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.5 |
| 0 | -1 | 0.5 |
| -2 | 0 | 0.5 |
| -2 | -1 | -0.5 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

260.2425000000003 ± 0.19081535577620581 keV

Default evaluated reference: 260.2425000000003 ± 0.19081535577620581 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 31
- mass-surface.js · `create.derive` · line 15

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D2pS1n --format csv
```

## 37 Gplus Gplus mass filter

One-sided third mass difference on the two-neutron grid

Use and what it reveals: Removes a constant shell-gap background; needs N−2 through N+4.

$$
\delta_{2n}(Z,N)-\delta_{2n}(Z,N+2)
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -3 |
| 0 | 2 | 3 |
| 0 | 4 | -1 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Attribution: this entry follows the current implementation. Its name does not prove identity with a similarly named quantity in a paper.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

157.41400000004796 ± 1.7807846585143303 keV

Default evaluated reference: 157.41400000004796 ± 1.7807846585143303 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 32
- mass-surface.js · `create.derive` · line 16

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn Gplus --format csv
```

## 38 Gsym Gsym mass filter

Half-normalized symmetric fourth mass difference

Use and what it reveals: Uses the executable half-normalization; needs N−4 through N+4.

$$
\frac12[2\delta_{2n}(Z,N)-\delta_{2n}(Z,N-2)-\delta_{2n}(Z,N+2)]
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -4 | -0.5 |
| 0 | -2 | 2 |
| 0 | 0 | -3 |
| 0 | 2 | 2 |
| 0 | 4 | -0.5 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Attribution: this entry follows the current implementation. Its name does not prove identity with a similarly named quantity in a paper.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

29.176000000043132 ± 1.1469616384169088 keV

Default evaluated reference: 29.176000000043132 ± 1.1469616384169088 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 33
- mass-surface.js · `create.derive` · line 17

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn Gsym --format csv
```

## 39 W Legacy isobar Wigner indicator

Preserved native isobar Wigner cusp indicator

Use and what it reveals: Uses the fixed quarter-normalized V0 at three isobaric centers; do not replace by parity-dependent vpn.

$$
W_{\mathrm{isobar}}(Z,N)=V_0(Z,N)-\frac12[V_0(Z-1,N+1)+V_0(Z+1,N-1)],\quad V_0={\mathrm{D2pS2n}}
$$

Output unit: keV. Inputs are all masses in the state-consistent stencil below; missing terms make the result unavailable.

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| -3 | -1 | 0.125 |
| -3 | 1 | -0.125 |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |
| -1 | -3 | 0.125 |
| -1 | -1 | -0.25 |
| -1 | 1 | 0.125 |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |
| 1 | -3 | -0.125 |
| 1 | -1 | 0.125 |

Constant offset: 

$$
C=0
$$

Convention: Neutral atomic mass excess, ground states, fixed Z/N coordinate convention.

Source index: `ame2020`, `filters-implementation`.

### Checkable example

**116Sn** · Calculated from retained source data

-3.282374999997046 ± 2.6904594664527095 keV

Default evaluated reference: -3.282374999997046 ± 2.6904594664527095 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: use the primitive-identity combination rule above. Keep directly evaluated reference errors separate from independently recalculated errors; model uncertainty is unavailable.

### Program mapping

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 230

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn W --format csv
```

# Separate legacy recipe appendix

This appendix preserves the R-derived binding-energy recipes and their individual code entry points. The gsi namespace prevents similarly named recipes from being silently merged with the shared mass-excess kernel. Recipes commonly output MeV while the shared kernel uses keV; normalization, shifts and parity filters can also differ. Compare exact stencils before comparing values.

## 1 gsi:identity_op Identity operator; binding energy

Identity operator; binding energy

Use: Does not do a thing (except maybe unit conversion): gives back the binding energy

Binding-energy form

$$
10^{-3}[1B(Z,N)]
$$

Equivalent mass-excess form

$$
10^{-3}[Z H+N n-M(Z,N)]
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.05 |
| n | 0.066 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 2
- nuclear_operator_metadata.csv · `` · line 2

**Z=50, N=66** · Calculated from retained source data

988.6815266 ± 9.6e-05 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 2 gsi:S1n One-neutron separation energy

One-neutron separation energy

Use: Calculated by S1n(N,Z) = ME(N-1,Z)+ME_n-ME(N,Z) = BE(N,Z)-BE(N-1,Z).

Binding-energy form

$$
10^{-3}[-1B(Z,N-1)+1B(Z,N)]
$$

Equivalent mass-excess form

$$
0.001M(Z,N-1)-0.001M(Z,N) + 0.001 n
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.001 |
| 0 | 0 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.001 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 3
- nuclear_operator_metadata.csv · `` · line 3

**Z=50, N=66** · Calculated from retained source data

9.563451099999838 ± 9.716480844420989e-05 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 3 gsi:S1p One-proton separation energy

One-proton separation energy

Use: Calculated by S1p(N,Z) = ME(N,Z-1)+ME_p-ME(N,Z) = BE(N,Z)-BE(N,Z-1).

Binding-energy form

$$
10^{-3}[1B(Z,N)-1B(Z-1,N)]
$$

Equivalent mass-excess form

$$
-0.001M(Z,N)+0.001M(Z-1,N) + 0.001 H
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |
| -1 | 0 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -1 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.001 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 5
- nuclear_operator_metadata.csv · `` · line 4

**Z=50, N=66** · Calculated from retained source data

9.278593059999935 ± 9.67470929795826e-05 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 4 gsi:S2n Two-neutron separation energy

Two-neutron separation energy

Use: Calculated by S2n(N,Z) = ME(N-2,Z)+2*ME_n-ME(N,Z) = BE(N,Z)-BE(N-2,Z).

Binding-energy form

$$
10^{-3}[-1B(Z,N-2)+1B(Z,N)]
$$

Equivalent mass-excess form

$$
0.001M(Z,N-2)-0.001M(Z,N) + 0.002 n
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.002 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 7
- nuclear_operator_metadata.csv · `` · line 5

**Z=50, N=66** · Calculated from retained source data

17.10888019999993 ± 0.0001002845950283492 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 5 gsi:S2p Two-proton separation energy

Two-proton separation energy

Use: Calculated by S2p(N,Z) = ME(N,Z-2)+2*ME_p-ME(N,Z) = BE(N,Z)-BE(N,Z-2).

Binding-energy form

$$
10^{-3}[1B(Z,N)-1B(Z-2,N)]
$$

Equivalent mass-excess form

$$
-0.001M(Z,N)+0.001M(Z-2,N) + 0.002 H
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |
| -2 | 0 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -2 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.002 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 9
- nuclear_operator_metadata.csv · `` · line 6

**Z=50, N=66** · Calculated from retained source data

16.08898712000007 ± 0.00029221909588526216 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 6 gsi:D1nS1n Empirical one-neutron shell gap

Empirical one-neutron shell gap

Use: Calculated by D1nS1n(N,Z) = S1n(N,Z)-S1n(N+1,Z) = {BE(N,Z)-BE(N-1,Z)} - {BE(N+1,Z)-BE(N,Z)}.

Binding-energy form

$$
10^{-3}[-1B(Z,N-1)+2B(Z,N)-1B(Z,N+1)]
$$

Equivalent mass-excess form

$$
0.001M(Z,N-1)-0.002M(Z,N)+0.001M(Z,N+1)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.001 |
| 0 | 0 | -0.002 |
| 0 | 1 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 2.0 |
| 0 | 1 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 11
- nuclear_operator_metadata.csv · `` · line 7

**Z=50, N=66** · Calculated from retained source data

2.620369999999866 ± 0.0005199788457235544 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 7 gsi:D1nS2n The slope of the S2n values

The slope of the S2n values

Use: Calculated by D1nS2n(N,Z) = (-1)*{S2n(N,Z)-S2n(N+1,Z)} = (-1)*{[BE(N,Z)-BE(N-2,Z)] - [BE(N+1,Z)-BE(N-1,Z)]}. See S. Ayet PRC 99 064313 (2019).

Binding-energy form

$$
10^{-3}[1B(Z,N-2)-1B(Z,N-1)-1B(Z,N)+1B(Z,N+1)]
$$

Equivalent mass-excess form

$$
-0.001M(Z,N-2)+0.001M(Z,N-1)+0.001M(Z,N)-0.001M(Z,N+1)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.001 |
| 0 | -1 | 0.001 |
| 0 | 0 | 0.001 |
| 0 | 1 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 1.0 |
| 0 | -1 | -1.0 |
| 0 | 0 | -1.0 |
| 0 | 1 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 14
- nuclear_operator_metadata.csv · `` · line 8

**Z=50, N=66** · Calculated from retained source data

-0.60234800000012 ± 0.0004935291278131413 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 8 gsi:D2nS2n Empirical two-neutron shell gap

Empirical two-neutron shell gap

Use: Calculated by D2nS2n(N,Z) = S2n(N,Z)-S2n(N+2,Z) = {BE(N,Z)-BE(N-2,Z)} - {BE(N+2,Z)-BE(N,Z)}.

Binding-energy form

$$
10^{-3}[-1B(Z,N-2)+2B(Z,N)-1B(Z,N+2)]
$$

Equivalent mass-excess form

$$
0.001M(Z,N-2)-0.002M(Z,N)+0.001M(Z,N+2)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.002 |
| 0 | 2 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 2.0 |
| 0 | 2 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 18
- nuclear_operator_metadata.csv · `` · line 9

**Z=50, N=66** · Calculated from retained source data

0.8393799999998919 ± 0.0005354493440093097 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 9 gsi:D1pS1p Empirical one-proton shell gap

Empirical one-proton shell gap

Use: Calculated by D1pS1p(N,Z) = S1p(N,Z)-S1p(N,Z+1) = {BE(N,Z)-BE(N,Z-1)} - {BE(N,Z+1)-BE(N,Z)}.

Binding-energy form

$$
10^{-3}[-1B(Z+1,N)+2B(Z,N)-1B(Z-1,N)]
$$

Equivalent mass-excess form

$$
0.001M(Z+1,N)-0.002M(Z,N)+0.001M(Z-1,N)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | 0.001 |
| 0 | 0 | -0.002 |
| -1 | 0 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | -1.0 |
| 0 | 0 | 2.0 |
| -1 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 21
- nuclear_operator_metadata.csv · `` · line 10

**Z=50, N=66** · Calculated from retained source data

4.876036999999997 ± 0.008439192911647417 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 10 gsi:D1pS2p The slope of the S2p values

The slope of the S2p values

Use: Calculated by D1pS2p(N,Z) = (-1)*{S2p(N,Z)-S2p(N,Z+1)} = (-1)*{[BE(N,Z)-BE(N,Z-2)] - [BE(N,Z+1)-BE(N,Z-1)]}. See analogue for neutrons in S. Ayet PRC 99 064313 (2019).

Binding-energy form

$$
10^{-3}[1B(Z+1,N)-1B(Z,N)-1B(Z-1,N)+1B(Z-2,N)]
$$

Equivalent mass-excess form

$$
-0.001M(Z+1,N)+0.001M(Z,N)+0.001M(Z-1,N)-0.001M(Z-2,N)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | -0.001 |
| 0 | 0 | 0.001 |
| -1 | 0 | 0.001 |
| -2 | 0 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | 0 | -1.0 |
| -2 | 0 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 24
- nuclear_operator_metadata.csv · `` · line 11

**Z=50, N=66** · Calculated from retained source data

-2.407838000000197 ± 0.008442067578502318 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 11 gsi:D2pS2p Empirical two-proton shell gap

Empirical two-proton shell gap

Use: Calculated by D2pS2p(N,Z) = S2p(N,Z)-S2p(N,Z+2) = {BE(N,Z)-BE(N,Z-2)} - {BE(N,Z+2)-BE(N,Z)}.

Binding-energy form

$$
10^{-3}[-1B(Z+2,N)+2B(Z,N)-1B(Z-2,N)]
$$

Equivalent mass-excess form

$$
0.001M(Z+2,N)-0.002M(Z,N)+0.001M(Z-2,N)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 2 | 0 | 0.001 |
| 0 | 0 | -0.002 |
| -2 | 0 | 0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 2 | 0 | -1.0 |
| 0 | 0 | 2.0 |
| -2 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 28
- nuclear_operator_metadata.csv · `` · line 12

**Z=50, N=66** · Calculated from retained source data

5.346266000000014 ± 0.018309087251963167 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 12 gsi:D2pS2n dVnp_ee: Two Proton two neutron interaction strength

dVnp_ee: Two Proton two neutron interaction strength

Use: Calculated by D2pS2n(N,Z) = 1/4*[S2n(N,Z)-S2n(N,Z-2)] = 1/4*{[BE(N,Z)-BE(N-2,Z)] - [BE(N,Z-2)-BE(N-2,Z-2)]}.

Binding-energy form

$$
-0.25B(Z,N-2)+0.25B(Z,N)+0.25B(Z-2,N-2)-0.25B(Z-2,N)
$$

Equivalent mass-excess form

$$
0.25M(Z,N-2)-0.25M(Z,N)-0.25M(Z-2,N-2)+0.25M(Z-2,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.25 |
| 0 | 0 | 0.25 |
| -2 | -2 | 0.25 |
| -2 | 0 | -0.25 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: e
- `Z_filter`: e
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 31
- nuclear_operator_metadata.csv · `` · line 13

**Z=50, N=66** · Calculated from retained source data

381.54175000000396 ± 0.09641479398930436 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 13 gsi:D1pS1n dVnp_oo: One proton one neutron interaction strength

dVnp_oo: One proton one neutron interaction strength

Use: Calculated by D1pS1n(N,Z) = [S1n(N,Z)-S1n(N,Z-1)] = {[BE(N,Z)-BE(N-1,Z)] - [BE(N,Z-1)-BE(N-1,Z-1)]}.

Binding-energy form

$$
-1B(Z,N-1)+1B(Z,N)+1B(Z-1,N-1)-1B(Z-1,N)
$$

Equivalent mass-excess form

$$
1M(Z,N-1)-1M(Z,N)-1M(Z-1,N-1)+1M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -1 | -1.0 |
| -1 | 0 | 1.0 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -1 | 1.0 |
| -1 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: o
- `Z_filter`: o
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 35
- nuclear_operator_metadata.csv · `` · line 14

**Z=51, N=67** · Calculated from retained source data

484.877000000095 ± 8.973390106308763 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 14 gsi:D1pS2n dVnp_eo: One proton two neutron interaction strength

dVnp_eo: One proton two neutron interaction strength

Use: Calculated by D2pS2n(N,Z) = 1/2*[S2n(N,Z)-S2n(N,Z-1)] = 1/2*{[BE(N,Z)-BE(N-2,Z)] - [BE(N,Z-1)-BE(N-2,Z-1)]}.

Binding-energy form

$$
-0.5B(Z,N-2)+0.5B(Z,N)+0.5B(Z-1,N-2)-0.5B(Z-1,N)
$$

Equivalent mass-excess form

$$
0.5M(Z,N-2)-0.5M(Z,N)-0.5M(Z-1,N-2)+0.5M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.5 |
| 0 | 0 | -0.5 |
| -1 | -2 | -0.5 |
| -1 | 0 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.5 |
| 0 | 0 | 0.5 |
| -1 | -2 | 0.5 |
| -1 | 0 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: e
- `Z_filter`: o
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 39
- nuclear_operator_metadata.csv · `` · line 15

**Z=51, N=66** · Calculated from retained source data

334.954000000027 ± 9.05529749649342 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 15 gsi:D2pS1n dVnp_oe: Two proton one neutron interaction strength

dVnp_oe: Two proton one neutron interaction strength

Use: Calculated by D2pS1n(N,Z) = 1/2*[S1n(N,Z)-S1n(N,Z-2)] = 1/2*{[BE(N,Z)-BE(N-1,Z)] - [BE(N,Z-2)-BE(N-1,Z-2)]}.

Binding-energy form

$$
-0.5B(Z,N-1)+0.5B(Z,N)+0.5B(Z-2,N-1)-0.5B(Z-2,N)
$$

Equivalent mass-excess form

$$
0.5M(Z,N-1)-0.5M(Z,N)-0.5M(Z-2,N-1)+0.5M(Z-2,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 0.5 |
| -2 | -1 | 0.5 |
| -2 | 0 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: o
- `Z_filter`: e
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 43
- nuclear_operator_metadata.csv · `` · line 16

**Z=50, N=67** · Calculated from retained source data

401.108499999973 ± 0.43083697612902266 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 16 gsi:Gplus_2n2n2n One-sided (neutron-deficient) 3rd order mass difference

One-sided (neutron-deficient) 3rd order mass difference

Use: Calculated by Gplus_2n2n2n(N,Z) = D2nS2n(N,Z) - D2nS2n(N+2,Z) = {[BE(N,Z)-BE(N-2,Z)]-[BE(N+2,Z)-BE(N,Z)]} - {[BE(N+2,Z)-BE(N,Z)]-[BE(N+4,Z)-BE(N+2,Z)]}. 
 One-sided (neutron-deficient) 3rd order mass difference: the idea is to correct a possible constant offset of `D2nSn`: can be used, where data with less neutrons is unavailable.

Binding-energy form

$$
10^{-3}[-1B(Z,N-2)+3B(Z,N)-3B(Z,N+2)+1B(Z,N+4)]
$$

Equivalent mass-excess form

$$
0.001M(Z,N-2)-0.003M(Z,N)+0.003M(Z,N+2)-0.001M(Z,N+4)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.003 |
| 0 | 2 | 0.003 |
| 0 | 4 | -0.001 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 3.0 |
| 0 | 2 | -3.0 |
| 0 | 4 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 47
- nuclear_operator_metadata.csv · `` · line 17

**Z=50, N=66** · Calculated from retained source data

0.15741399999990335 ± 0.0017807846585143304 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 17 gsi:Gsym_2n2n2n2n Two-sided (symmetrical) 4th order mass difference

Two-sided (symmetrical) 4th order mass difference

Use: Calculated by Gsym_2n2n2n2n(N,Z) = 2*D2nS2n(N,Z) - D2nS2n(N+2,Z) - D2nS2n(N-2,Z) = 
 = 2*{[BE(N,Z)-BE(N-2,Z)]-[BE(N+2,Z)-BE(N,Z)]} - {[BE(N+2,Z)-BE(N,Z)]-[BE(N+4,Z)-BE(N+2,Z)]} - {[BE(N-2,Z)-BE(N-4,Z)]-[BE(N,Z)-BE(N-2,Z)]}. 
 Two-sided (symmetrical) 4th order mass difference: the idea is to correct a possible constant offset of `D2nSn`: can be used, where data with less and more neutrons is available.

Binding-energy form

$$
10^{-3}[0.5B(Z,N-4)-2B(Z,N-2)+3B(Z,N)-2B(Z,N+2)+0.5B(Z,N+4)]
$$

Equivalent mass-excess form

$$
-0.0005M(Z,N-4)+0.002M(Z,N-2)-0.003M(Z,N)+0.002M(Z,N+2)-0.0005M(Z,N+4)
$$

Output unit: MeV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -4 | -0.0005 |
| 0 | -2 | 0.002 |
| 0 | 0 | -0.003 |
| 0 | 2 | 0.002 |
| 0 | 4 | -0.0005 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -4 | 0.5 |
| 0 | -2 | -2.0 |
| 0 | 0 | 3.0 |
| 0 | 2 | -2.0 |
| 0 | 4 | 0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 51
- nuclear_operator_metadata.csv · `` · line 19

**Z=50, N=66** · Calculated from retained source data

0.02917599999994991 ± 0.001146961638416909 MeV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 18 gsi:V_1p1n V_1p1n: Proton-neutron interaction strength where N/Z can be both odd and even

V_1p1n: Proton-neutron interaction strength where N/Z can be both odd and even

Use: Calculated by V_1p1n(N,Z) = [S1n(N,Z)-S1n(N,Z-1)] = {[BE(N,Z)-BE(N-1,Z)] - [BE(N,Z-1)-BE(N-1,Z-1)]}.

Binding-energy form

$$
-1B(Z,N-1)+1B(Z,N)+1B(Z-1,N-1)-1B(Z-1,N)
$$

Equivalent mass-excess form

$$
1M(Z,N-1)-1M(Z,N)-1M(Z-1,N-1)+1M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -1 | -1.0 |
| -1 | 0 | 1.0 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -1 | 1.0 |
| -1 | 0 | -1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 56
- nuclear_operator_metadata.csv · `` · line 22

**Z=50, N=66** · Calculated from retained source data

525.5829999998678 ± 0.31652172121356853 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 19 gsi:R1D1n1p dnp1: Residual neutron-proton interaction 1

dnp1: Residual neutron-proton interaction 1

Use: Calculated by R1D1n1p(N,Z) = 1/2*[V1n-1p(Z,N)-V1n-1p(Z,N-1))]=BE(Z-1,N-1)-BE(Z,N-1)+1/2*[BE(Z,N)-BE(Z-1,N)-BE(Z-1,N-2)+BE(Z,N-2)]. 
 The delta-np(1) formula can be imagined as a generalization of delta-np(2) also to even-even nuclei.

Binding-energy form

$$
0.5B(Z,N-2)-1B(Z,N-1)+0.5B(Z,N)-0.5B(Z-1,N-2)+1B(Z-1,N-1)-0.5B(Z-1,N)
$$

Equivalent mass-excess form

$$
-0.5M(Z,N-2)+1M(Z,N-1)-0.5M(Z,N)+0.5M(Z-1,N-2)-1M(Z-1,N-1)+0.5M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.5 |
| 0 | -1 | 1.0 |
| 0 | 0 | -0.5 |
| -1 | -2 | 0.5 |
| -1 | -1 | -1.0 |
| -1 | 0 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.5 |
| 0 | -1 | -1.0 |
| 0 | 0 | 0.5 |
| -1 | -2 | -0.5 |
| -1 | -1 | 1.0 |
| -1 | 0 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 60
- nuclear_operator_metadata.csv · `` · line 23

**Z=50, N=66** · Calculated from retained source data

127.0779999999213 ± 0.31970650603326795 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 20 gsi:R2D1n1p dnp2: Residual neutron-proton interaction 2

dnp2: Residual neutron-proton interaction 2

Use: Calculated by R2D1n1p(N,Z) = D1pS1n(N,Z)-D2pS2n(N-1,Z-1)=[S1n(N,Z)-S1n(N,Z-1)]-1/4*[S2n(N-1,Z-1)-S2n(N-1,Z-3)]={[BE(N,Z)-BE(N-1,Z)] - [BE(N,Z-1)-BE(N-1,Z-1)]}-1/4*{[BE(N-1,Z-1)-BE(N-3,Z-1)] - [BE(N-1,Z-3)-BE(N-3,Z-3)]}. 
 the residual interaction between the last two (unpaired) neutron and proton, which is only relevant for odd-odd nuclei.

Binding-energy form

$$
-1B(Z,N-1)+1B(Z,N)+0.25B(Z-1,N-3)+0.75B(Z-1,N-1)-1B(Z-1,N)-0.25B(Z-3,N-3)+0.25B(Z-3,N-1)
$$

Equivalent mass-excess form

$$
1M(Z,N-1)-1M(Z,N)-0.25M(Z-1,N-3)-0.75M(Z-1,N-1)+1M(Z-1,N)+0.25M(Z-3,N-3)-0.25M(Z-3,N-1)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -3 | -0.25 |
| -1 | -1 | -0.75 |
| -1 | 0 | 1.0 |
| -3 | -3 | 0.25 |
| -3 | -1 | -0.25 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -3 | 0.25 |
| -1 | -1 | 0.75 |
| -1 | 0 | -1.0 |
| -3 | -3 | -0.25 |
| -3 | -1 | 0.25 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: o
- `Z_filter`: o
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 66
- nuclear_operator_metadata.csv · `` · line 25

**Z=51, N=67** · Calculated from retained source data

103.33525000009104 ± 8.973651308831872 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 21 gsi:Pgap3N_even Three-point formula of the neutron-pairing gap for even N

Three-point formula of the neutron-pairing gap for even N

Use: Calculated by Pgap3N_even(N,Z) = 1/2*[-BE(Z,N-1)-BE(Z,N+1)+2*BE(Z,N)] = (-1)^N*1/2*[S1n(N,Z)-S1n(N+1,Z)]. 
 Three-point formula of the neutron-pairing gap is a measure of the odd-even neutron staggering between the neighboring isotones with a fixed Z.

Binding-energy form

$$
-0.5B(Z,N-1)+1B(Z,N)-0.5B(Z,N+1)
$$

Equivalent mass-excess form

$$
0.5M(Z,N-1)-1M(Z,N)+0.5M(Z,N+1)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -1.0 |
| 0 | 1 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 1.0 |
| 0 | 1 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: e
- `Z_filter`: e
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 73
- nuclear_operator_metadata.csv · `` · line 27

**Z=50, N=66** · Calculated from retained source data

1310.1849999999395 ± 0.25998942286177723 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 22 gsi:Pgap3N_odd Three-point formula of the neutron-pairing gap for odd N

Three-point formula of the neutron-pairing gap for odd N

Use: Calculated by Pgap3N_odd(N,Z) = -1/2*[-BE(Z,N-1)-BE(Z,N+1)+2*BE(Z,N)] = (-1)^N*1/2*[S1n(N,Z)-S1n(N+1,Z)]. 
 Three-point formula of the neutron-pairing gap is a measure of the odd-even neutron staggering between the neighboring isotones with a fixed Z.

Binding-energy form

$$
0.5B(Z,N-1)-1B(Z,N)+0.5B(Z,N+1)
$$

Equivalent mass-excess form

$$
-0.5M(Z,N-1)+1M(Z,N)-0.5M(Z,N+1)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 1.0 |
| 0 | 1 | -0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -1.0 |
| 0 | 1 | 0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: o
- `Z_filter`: o
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 76
- nuclear_operator_metadata.csv · `` · line 29

**Z=51, N=67** · Calculated from retained source data

1061.3474999999744 ± 6.255797251350143 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 23 gsi:Pgap3Z_even Three-point formula of the proton-pairing gap for even Z

Three-point formula of the proton-pairing gap for even Z

Use: Calculated by Pgap3Z_even(N,Z) = 1/2*[-BE(Z-1,N)-BE(Z+1,N)+2*BE(Z,N)] = (-1)^N*1/2*[S1p(N,Z)-S1p(N,Z+1)]. 
 Three-point formula of the proton-pairing gap is a measure of the odd-even proton staggering between the neighboring isotones with a fixed N.

Binding-energy form

$$
-0.5B(Z+1,N)+1B(Z,N)-0.5B(Z-1,N)
$$

Equivalent mass-excess form

$$
0.5M(Z+1,N)-1M(Z,N)+0.5M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | 0.5 |
| 0 | 0 | -1.0 |
| -1 | 0 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | -0.5 |
| 0 | 0 | 1.0 |
| -1 | 0 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: e
- `Z_filter`: e
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 79
- nuclear_operator_metadata.csv · `` · line 31

**Z=50, N=66** · Calculated from retained source data

2438.0185000000056 ± 4.219596455823708 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 24 gsi:Pgap3Z_odd Three-point formula of the proton-pairing gap for odd Z

Three-point formula of the proton-pairing gap for odd Z

Use: Calculated by Pgap3Z_odd(N,Z) = -1/2*[-BE(Z-1,N)-BE(Z+1,N)+2*BE(Z,N)] = (-1)^N*1/2*[S1p(N,Z)-S1p(N,Z+1)]. 
 Three-point formula of the proton-pairing gap is a measure of the odd-even proton staggering between the neighboring isotones with a fixed N.

Binding-energy form

$$
0.5B(Z+1,N)-1B(Z,N)+0.5B(Z-1,N)
$$

Equivalent mass-excess form

$$
-0.5M(Z+1,N)+1M(Z,N)-0.5M(Z-1,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | -0.5 |
| 0 | 0 | 1.0 |
| -1 | 0 | -0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | 0 | 0.5 |
| 0 | 0 | -1.0 |
| -1 | 0 | 0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: o
- `Z_filter`: o
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 82
- nuclear_operator_metadata.csv · `` · line 33

**Z=51, N=67** · Calculated from retained source data

793.9364999999525 ± 4.732536238635685 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 25 gsi:W1 Wigner Energy 1

Wigner Energy 1

Use: Calculated by Wigner1(N,Z) =D2pS2n(Z,N)-1/2*[D2pS2n(Z-2,N)+D2pS2n(Z,N+2)]=1/8*[3BE(Z,N)-4BE(Z-2,N)+3BE(Z-2,N-2)-2BE(Z,N-2)+BE(Z-4,N)-BE(Z-4,N-2)-BE(Z,N+2)+BE(Z-2,N+2)] /n

Binding-energy form

$$
-0.25B(Z,N-2)+0.375B(Z,N)-0.125B(Z,N+2)+0.375B(Z-2,N-2)-0.5B(Z-2,N)+0.125B(Z-2,N+2)-0.125B(Z-4,N-2)+0.125B(Z-4,N)
$$

Equivalent mass-excess form

$$
0.25M(Z,N-2)-0.375M(Z,N)+0.125M(Z,N+2)-0.375M(Z-2,N-2)+0.5M(Z-2,N)-0.125M(Z-2,N+2)+0.125M(Z-4,N-2)-0.125M(Z-4,N)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.375 |
| 0 | 2 | 0.125 |
| -2 | -2 | -0.375 |
| -2 | 0 | 0.5 |
| -2 | 2 | -0.125 |
| -4 | -2 | 0.125 |
| -4 | 0 | -0.125 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -2 | -0.25 |
| 0 | 0 | 0.375 |
| 0 | 2 | -0.125 |
| -2 | -2 | 0.375 |
| -2 | 0 | -0.5 |
| -2 | 2 | 0.125 |
| -4 | -2 | -0.125 |
| -4 | 0 | 0.125 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 85
- nuclear_operator_metadata.csv · `` · line 35

**Z=50, N=66** · Calculated from retained source data

21.63537499999802 ± 0.841936801740487 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 26 gsi:W2 Wigner Energy 2

Wigner Energy 2

Use: Calculated by W2(N,Z) =1/2*[D2pS2n(Z-1,N-1)+D2pS2n(Z+1,N+1)]-D2pS2n(Z-1,N+1)=1/8*[4BE(Z-1,N-1)-BE(Z-1,N-3)+BE(Z-3,N-3)+BE(Z+1,N+1)-BE(Z+1,N-1)-3BE(Z-3,N-1)-3BE(Z-1,N+1)+2BE(Z-3,N+1)] /n

Binding-energy form

$$
-0.125B(Z+1,N-1)+0.125B(Z+1,N+1)-0.125B(Z-1,N-3)+0.5B(Z-1,N-1)-0.375B(Z-1,N+1)+0.125B(Z-3,N-3)-0.375B(Z-3,N-1)+0.25B(Z-3,N+1)
$$

Equivalent mass-excess form

$$
0.125M(Z+1,N-1)-0.125M(Z+1,N+1)+0.125M(Z-1,N-3)-0.5M(Z-1,N-1)+0.375M(Z-1,N+1)-0.125M(Z-3,N-3)+0.375M(Z-3,N-1)-0.25M(Z-3,N+1)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | -1 | 0.125 |
| 1 | 1 | -0.125 |
| -1 | -3 | 0.125 |
| -1 | -1 | -0.5 |
| -1 | 1 | 0.375 |
| -3 | -3 | -0.125 |
| -3 | -1 | 0.375 |
| -3 | 1 | -0.25 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 1 | -1 | -0.125 |
| 1 | 1 | 0.125 |
| -1 | -3 | -0.125 |
| -1 | -1 | 0.5 |
| -1 | 1 | -0.375 |
| -3 | -3 | 0.125 |
| -3 | -1 | -0.375 |
| -3 | 1 | 0.25 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 93
- nuclear_operator_metadata.csv · `` · line 36

**Z=50, N=66** · Calculated from retained source data

35.21899999995367 ± 1.7382872542031136 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 27 gsi:W3 Wigner Energy 3

Wigner Energy 3

Use: Calculated by W3(N,Z) =[D2pS2n(Z-1,N)+D2pS2n(Z,N+1)]-2D2pS2n(Z-1,N+1)=1/4*[BE(Z-1,N)-BE(Z-1,N-2)-BE(Z-3,N)+BE(Z-3,N-2)+BE(Z,N+1)-BE(Z,N-1)-BE(Z-2,N+1)+BE(Z-2,N-1)-2BE(Z-1,N+1)+2BE(Z-1,N-1)+2BE(Z-3,N+1)-2BE(Z-3,N-1)] /n

Binding-energy form

$$
-0.25B(Z,N-1)+0.25B(Z,N+1)-0.25B(Z-1,N-2)-0.5B(Z-1,N-1)+0.25B(Z-1,N)+0.5B(Z-1,N+1)+0.25B(Z-2,N-1)-0.25B(Z-2,N+1)+0.25B(Z-3,N-2)+0.5B(Z-3,N-1)-0.25B(Z-3,N)-0.5B(Z-3,N+1)
$$

Equivalent mass-excess form

$$
0.25M(Z,N-1)-0.25M(Z,N+1)+0.25M(Z-1,N-2)+0.5M(Z-1,N-1)-0.25M(Z-1,N)-0.5M(Z-1,N+1)-0.25M(Z-2,N-1)+0.25M(Z-2,N+1)-0.25M(Z-3,N-2)-0.5M(Z-3,N-1)+0.25M(Z-3,N)+0.5M(Z-3,N+1)
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | 0.25 |
| 0 | 1 | -0.25 |
| -1 | -2 | 0.25 |
| -1 | -1 | 0.5 |
| -1 | 0 | -0.25 |
| -1 | 1 | -0.5 |
| -2 | -1 | -0.25 |
| -2 | 1 | 0.25 |
| -3 | -2 | -0.25 |
| -3 | -1 | -0.5 |
| -3 | 0 | 0.25 |
| -3 | 1 | 0.5 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | -1 | -0.25 |
| 0 | 1 | 0.25 |
| -1 | -2 | -0.25 |
| -1 | -1 | -0.5 |
| -1 | 0 | 0.25 |
| -1 | 1 | 0.5 |
| -2 | -1 | 0.25 |
| -2 | 1 | -0.25 |
| -3 | -2 | 0.25 |
| -3 | -1 | 0.5 |
| -3 | 0 | -0.25 |
| -3 | 1 | -0.5 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 101
- nuclear_operator_metadata.csv · `` · line 37

**Z=50, N=66** · Calculated from retained source data

1336.5740000000224 ± 4.919423759445816 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

## 28 gsi:Qec Qec value of electron capture

Qec value of electron capture

Use: Calculated by Qec(N,Z) = ME(N,Z)-ME(N+1,Z-1) = BE(N+1,Z-1)-BE(N,Z)-ME_n+ME_p /n

Binding-energy form

$$
-1B(Z,N)+1B(Z-1,N+1)-782.34704
$$

Equivalent mass-excess form

$$
1M(Z,N)-1M(Z-1,N+1) + -1 H + 1 n -782.34704
$$

Output unit: keV

Exact stencil `terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -1 | 1 | -1.0 |

Exact stencil `be_terms`

| ΔZ | ΔN | Coefficient |
| ---: | ---: | ---: |
| 0 | 0 | -1.0 |
| -1 | 1 | 1.0 |

Exact stencil `light_terms`

| Particle | Coefficient |
| --- | ---: |
| H | -1.0 |
| n | 1.0 |

offset_latex:

$$
-782.34704
$$


- `N_filter`: oe
- `Z_filter`: oe
- `meaning`: e=even, o=odd, oe=both; applied by comparison() after calculation, not apply_energy_operator().

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 113
- nuclear_operator_metadata.csv · `` · line 38

**Z=50, N=66** · Calculated from retained source data

-3276.220999999881 ± 0.24003333101883997 keV

Recalculated and evaluated values/errors are distinct; source rounding is retained. Full primitive inputs, flags and hashes are in this entry's worked_example in inventory-delivery.json.

Uncertainty: combine repeated primitive identities and use the stated covariance approximation. Marginal mass errors alone do not recover full AME evaluated covariance.

# Data links and citations

These records distinguish original tables, paper definitions, historical evaluations and code conventions. Retrieval date is not evaluation date, and a current online edition need not match a pinned local snapshot. Complete URLs, hashes, retrieval status and limits are in sources.json and inventory-delivery.json beside this guide.

## ame2020

W. J. Huang et al., Chinese Physics C 45, 030002 (2021); M. Wang et al., Chinese Physics C 45, 030003 (2021).

Evaluation or version date: 2020

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/abddaf)
- DOI [10.1088/1674-1137/abddb0](https://doi.org/10.1088/1674-1137/abddb0)
- DOI [10.1088/1674-1137/abddaf](https://doi.org/10.1088/1674-1137/abddaf)
- [mass_1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)
- [rct1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)
- [rct2_1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

Published evaluated quantity errors retain AME correlations. Rederived arbitrary stencils do not recover the full AME covariance from marginal mass errors. # value and uncertainty flags remain separate; missing *, bounds and symbolic values are not zero.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## ame2016

W. J. Huang et al., Chinese Physics C 41, 030002 (2017); M. Wang et al., Chinese Physics C 41, 030003 (2017).

Evaluation or version date: 2016

Original numerical retrieval date: 2026-10-23T02:53:19.900902Z

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030002)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030003)
- [actual recorded numerical source](https://www-nds.iaea.org/amdc/ame2016/mass16.txt)
- DOI [10.1088/1674-1137/41/3/030002](https://doi.org/10.1088/1674-1137/41/3/030002)
- DOI [10.1088/1674-1137/41/3/030003](https://doi.org/10.1088/1674-1137/41/3/030003)

Source # estimates and missing tokens retained. Printed zero marginal uncertainties may be rounded; no full covariance reconstructed. Editions are separate evaluations, not independent repeated measurements.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## ame2012

G. Audi et al., Chinese Physics C 36, 1287–1602 (2012); M. Wang et al., Chinese Physics C 36, 1603–2014 (2012).

Evaluation or version date: 2012

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/002)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/003)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame2012/mass.mas12)
- DOI [10.1088/1674-1137/36/12/002](https://doi.org/10.1088/1674-1137/36/12/002)
- DOI [10.1088/1674-1137/36/12/003](https://doi.org/10.1088/1674-1137/36/12/003)

Source # estimates and missing tokens retained. Printed zero marginal uncertainties may be rounded; no full covariance reconstructed. Editions are separate evaluations, not independent repeated measurements.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## ame2003

A. H. Wapstra, G. Audi and C. Thibault, Nuclear Physics A 729, 129–336 (2003); G. Audi, A. H. Wapstra and C. Thibault, Nuclear Physics A 729, 337–676 (2003).

Evaluation or version date: 2003

Original numerical retrieval date: 2026-10-23T02:53:22.411179Z

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame2003/mass.mas03)
- DOI [10.1016/j.nuclphysa.2003.11.002](https://doi.org/10.1016/j.nuclphysa.2003.11.002)
- DOI [10.1016/j.nuclphysa.2003.11.003](https://doi.org/10.1016/j.nuclphysa.2003.11.003)

Source # estimates and missing tokens retained. Printed zero marginal uncertainties may be rounded; no full covariance reconstructed. Editions are separate evaluations, not independent repeated measurements.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## ame1995

G. Audi and A. H. Wapstra, Nuclear Physics A 595, 409–480 (1995).

Evaluation or version date: 1995

Original numerical retrieval date: 2026-10-23T02:53:27.079438Z

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame1995/mass_rmd.mas95)
- DOI [10.1016/0375-9474(95)00445-9](https://doi.org/10.1016/0375-9474(95)00445-9)

Source # estimates and missing tokens retained. Printed zero marginal uncertainties may be rounded; no full covariance reconstructed. Editions are separate evaluations, not independent repeated measurements.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## nubase2020

F. G. Kondev, M. Wang, W. J. Huang, S. Naimi and G. Audi, Chinese Physics C 45, 030001 (2021).

Evaluation or version date: 2020

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/abddae)
- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- DOI [10.1088/1674-1137/abddae](https://doi.org/10.1088/1674-1137/abddae)

Raw flags, limits, symbolic excitation offsets and source state index are retained. Not every state is an isomer and not every numeric field is a measured Gaussian value.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## nubase2016

G. Audi, F. G. Kondev, M. Wang, W. J. Huang and S. Naimi, Chinese Physics C 41, 030001 (2017).

Evaluation or version date: 2016

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030001)
- DOI [10.1088/1674-1137/41/3/030001](https://doi.org/10.1088/1674-1137/41/3/030001)

Evaluation includes measured and systematics-estimated fields. Ground-state and isomer counts use retained classifier definitions; other excited/analogue records are separate. Historical statistics are not complete state payloads.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## nubase2012

G. Audi et al., Chinese Physics C 36, 1157–1286 (2012).

Evaluation or version date: 2012

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/001)
- DOI [10.1088/1674-1137/36/12/001](https://doi.org/10.1088/1674-1137/36/12/001)

Evaluation includes measured and systematics-estimated fields. Ground-state and isomer counts use retained classifier definitions; other excited/analogue records are separate. Historical statistics are not complete state payloads.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## nubase2003

G. Audi, O. Bersillon, J. Blachot and A. H. Wapstra, Nuclear Physics A 729, 3–128 (2003).

Evaluation or version date: 2003

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://amdc.impcas.ac.cn/nubase/nubase2003/nubtab03.asc)
- DOI [10.1016/j.nuclphysa.2003.11.001](https://doi.org/10.1016/j.nuclphysa.2003.11.001)

Evaluation includes measured and systematics-estimated fields. Ground-state and isomer counts use retained classifier definitions; other excited/analogue records are separate. Historical statistics are not complete state payloads.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## nubase1997

G. Audi, O. Bersillon, J. Blachot and A. H. Wapstra, Nuclear Physics A 624, 1–124 (1997).

Evaluation or version date: 1997

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://www.sciencedirect.com/science/article/pii/S037594749700482X)
- DOI [10.1016/S0375-9474(97)00482-X](https://doi.org/10.1016/S0375-9474(97)00482-X)

Evaluation includes measured and systematics-estimated fields. Ground-state and isomer counts use retained classifier definitions; other excited/analogue records are separate. Historical statistics are not complete state payloads.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## angeli-marinova-2013

I. Angeli and K. P. Marinova, Atomic Data and Nuclear Data Tables 99, 69–95 (2013).

Evaluation or version date: 2013

Original numerical retrieval date: 2026-10-23

- [primary metadata/reference](https://www-nds.iaea.org/radii/)
- DOI [10.1016/j.adt.2011.12.006](https://doi.org/10.1016/j.adt.2011.12.006)

Published 2013 Ca rms radii only; preliminary update columns excluded. Independent radius-error propagation does not supply shared-reference/evaluation correlations.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## livechart

International Atomic Energy Agency Nuclear Data Section, LiveChart Data Download API, v1 (v0 alias), official API guide.

Evaluation or version date: Field-dependent; guide identifies ENSDF April 2022 snapshot plus AME2020/NUBASE2020 and named radii/moment evaluations

Original numerical retrieval date: 2026-10-23

- [primary metadata/reference](https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html)
- [primary metadata/reference](https://nds.iaea.org/relnsd/v1/data)

Blank means unavailable. Preserve operators, cutoff dates, state identities and extraction dates. Gamma photon energies are not level-energy differences; uncertainties may be blank and must remain unknown. API docs identify ENSDF April 2022, not a 2026 reevaluation.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## stone-long-lived

N. J. Stone, IAEA INDC(NDS)-0794 (November 2019).

Evaluation or version date: 2019-11

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://nds.iaea.org/records/x2773-kj397)
- DOI [10.61092/iaea.yjpc-cns6](https://doi.org/10.61092/iaea.yjpc-cns6)

Not a numerical uncertainty source by itself; retain the quantity-specific convention.

Source report was not downloaded locally by this audit. 2026-10-23 is the selected LiveChart snapshot retrieval date, not an original report download or evaluation date.

## stone-short-lived

N. J. Stone, IAEA INDC(NDS)-0816 (September 2020).

Evaluation or version date: 2020-09

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://nds.iaea.org/records/5g7ec-evw90)
- DOI [10.61092/iaea.1p48-p6c6](https://doi.org/10.61092/iaea.1p48-p6c6)

Not a numerical uncertainty source by itself; retain the quantity-specific convention.

Source report was not downloaded locally by this audit. 2026-10-23 is the selected LiveChart snapshot retrieval date, not an original report download or evaluation date.

## stone-quadrupole

N. J. Stone, IAEA INDC(NDS)-0833.

Evaluation or version date: not recorded

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://nds.iaea.org/records/xk3d8-tw250)

Not a numerical uncertainty source by itself; retain the quantity-specific convention.

Source report was not downloaded locally by this audit. 2026-10-23 is the selected LiveChart snapshot retrieval date, not an original report download or evaluation date.

## be2

B. Pritychenko, M. Birch, B. Singh and M. Horoi, Atomic Data and Nuclear Data Tables 107, 1–139 (2016); erratum 114, 371–374 (2017).

Evaluation or version date: 2016

Original numerical retrieval date: 2026-10-23T02:53:18.448505Z

- [primary metadata/reference](https://www.nndc.bnl.gov/be2/)
- [primary metadata/reference](https://www.nndc.bnl.gov/be2/help.html)
- [primary metadata/reference](https://arxiv.org/abs/1312.5975)
- [actual source JSON distribution](https://www.nndc.bnl.gov/be2/data/adopted-entries.json)
- DOI [10.1016/j.adt.2015.10.001](https://doi.org/10.1016/j.adt.2015.10.001)
- DOI [10.1016/j.adt.2016.08.002](https://doi.org/10.1016/j.adt.2016.08.002)

2016 and fallback 2001 entries stay distinct. Upward 0+ to 2+ B is five times downward 2+ to 0+ B. Source missing/error operators retained. Derived beta2 is a collective estimate, not the signed theoretical model deformation; NNDC help has an inconsistent arrow beside its 0.297 convention. Do not infer branching fractions.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## be2-raman2001

S. Raman, C. W. Nestor Jr. and P. Tikkanen, Atomic Data and Nuclear Data Tables 78, 1–128 (2001).

Evaluation or version date: 2001

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://www.nndc.bnl.gov/be2/)
- DOI [10.1006/adnd.2001.0858](https://doi.org/10.1006/adnd.2001.0858)

Not a numerical uncertainty source by itself; retain the quantity-specific convention.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## codata2018

NIST, Fundamental Physical Constants, 2018 CODATA adjustment, extensive listing.

Evaluation or version date: 2018

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://physics.nist.gov/cuu/pdf/all_2018.pdf)

Software treats constant choices and binding corrections as fixed; their uncertainties/covariances are not added to mass errors. Keep constant profile in exported metadata.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## codata2022

NIST, Fundamental Physical Constants, 2022 CODATA adjustment, complete listing.

Evaluation or version date: 2022

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://physics.nist.gov/cuu/Constants/Table/allascii.txt)

Software treats constant choices and binding corrections as fixed; their uncertainties/covariances are not added to mass errors. Keep constant profile in exported metadata.

GUI default compatibility profile mixes AME2020/CODATA2018 u-energy with CODATA2022 electron and SI-u masses. A separately named full-2022 profile exists. Website mass kernel remains CODATA2018; do not call the default entirely CODATA2022.

## delta-vpn-zhang1989

J.-Y. Zhang, R. F. Casten and D. S. Brenner, Physics Letters B 227, 1–5 (1989).

Evaluation or version date: 1989

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://www.sciencedirect.com/science/article/pii/0370269389912732/pdf)
- DOI [10.1016/0370-2693(89)91273-2](https://doi.org/10.1016/0370-2693(89)91273-2)

Literature attribution is not proof of each software stencil/sign/parity centre; current equation inventory is authoritative about implementation.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## delta-vpn-cakirli2005

R. B. Cakirli, D. S. Brenner, R. F. Casten and E. A. Millman, Physical Review Letters 94, 092501 (2005).

Evaluation or version date: 2005

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.94.092501)
- DOI [10.1103/PhysRevLett.94.092501](https://doi.org/10.1103/PhysRevLett.94.092501)

Literature attribution is not proof of each software stencil/sign/parity centre; current equation inventory is authoritative about implementation.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## delta-vpn-cakirli2005-erratum

R. B. Cakirli, D. S. Brenner, R. F. Casten and E. A. Millman, Physical Review Letters 95, 119903 (2005).

Evaluation or version date: 2005

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.95.119903)
- DOI [10.1103/PhysRevLett.95.119903](https://doi.org/10.1103/PhysRevLett.95.119903)

Literature attribution is not proof of each software stencil/sign/parity centre; current equation inventory is authoritative about implementation.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## pairing-context-satula1998

W. Satuła, J. Dobaczewski and W. Nazarewicz, Physical Review Letters 81, 3599–3602 (1998).

Evaluation or version date: 1998

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.81.3599)
- DOI [10.1103/PhysRevLett.81.3599](https://doi.org/10.1103/PhysRevLett.81.3599)

Literature attribution is not proof of each software stencil/sign/parity centre; current equation inventory is authoritative about implementation.

Current link verification is not a new numerical-data retrieval; source files were not downloaded by this audit.

## frdm1995

P. Möller, J.R. Nix, W.D. Myers, W.J. Swiatecki, At. Data Nucl. Data Tables 59, 185 (1995)

Evaluation or version date: 1992 calculation, 1995 publication

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1006/adnd.1995.1002)
- [verified primary alternative metadata](https://arxiv.org/abs/nucl-th/9308022)
- DOI [10.1006/adnd.1995.1002](https://doi.org/10.1006/adnd.1995.1002)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

legacy TALYS1.95 normalized extraction; see citation

## frdm2012

P. Möller, A.J. Sierk, T. Ichikawa, H. Sagawa, At. Data Nucl. Data Tables 109–110, 1–204 (2016)

Evaluation or version date: 2012 model, 2016 publication

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1016/j.adt.2015.10.002)
- [verified primary alternative metadata](https://arxiv.org/abs/1508.06294)
- DOI [10.1016/j.adt.2015.10.002](https://doi.org/10.1016/j.adt.2015.10.002)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Frozen attributed table, not a refit to current/new masses.

## hfb17

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. Lett. 102, 152503 (2009)

Evaluation or version date: 2009

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevLett.102.152503)
- DOI [10.1103/PhysRevLett.102.152503](https://doi.org/10.1103/PhysRevLett.102.152503)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

legacy TALYS1.95 normalized extraction; see citation

## hfbd1m

S. Goriely, S. Hilaire, M. Girod, S. Péru, Phys. Rev. Lett. 102, 242501 (2009)

Evaluation or version date: 2009

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevLett.102.242501)
- DOI [10.1103/PhysRevLett.102.242501](https://doi.org/10.1103/PhysRevLett.102.242501)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

legacy TALYS1.95 normalized extraction; see citation

## hfb14

S. Goriely et al., Phys. Rev. C 75, 064312 (2007)

Evaluation or version date: 2007

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.75.064312)
- [recorded source table](https://www.astro.ulb.ac.be/Nucdata/Masses/hfb14-plain)
- DOI [10.1103/PhysRevC.75.064312](https://doi.org/10.1103/PhysRevC.75.064312)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## hfb24

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

Evaluation or version date: 2013

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb24-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## bskg3

G. Grams et al., Eur. Phys. J. A 59, 270 (2023)

Evaluation or version date: 2023

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1140/epja/s10050-023-01158-6)
- [verified primary alternative metadata](https://arxiv.org/abs/2307.14276)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/bskg03-dat)
- DOI [10.1140/epja/s10050-023-01158-6](https://doi.org/10.1140/epja/s10050-023-01158-6)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## hfb21

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 82, 035804 (2010)

Evaluation or version date: 2010

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.82.035804)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb21-dat)
- DOI [10.1103/PhysRevC.82.035804](https://doi.org/10.1103/PhysRevC.82.035804)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## hfb25

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

Evaluation or version date: 2013

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb25-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## hfb26

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

Evaluation or version date: 2013

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb26-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## hfb27

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 061302(R) (2013)

Evaluation or version date: 2013

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1103/PhysRevC.88.061302)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb27-dat)
- DOI [10.1103/PhysRevC.88.061302](https://doi.org/10.1103/PhysRevC.88.061302)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.

## ktuy05

H. Koura, T. Tachibana, M. Uno, M. Yamada, Prog. Theor. Phys. 113, 305–325 (2005)

Evaluation or version date: 2005; fitted to AME2003

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1143/PTP.113.305)
- [verified primary alternative metadata](https://academic.oup.com/ptp/issue/113/2)
- [recorded source table](https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05_m246.dat)
- DOI [10.1143/PTP.113.305](https://doi.org/10.1143/PTP.113.305)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

KTUY05 fitted to AME2003; distinct from KTUY04. Both numerical tables contain 9436 rows; explanatory prose says 9437. Missing neighbours remain missing. Source alpha2/alpha4/alpha6 are not beta2; beta2 unavailable. Model sigma unavailable.

## ws4

N. Wang, M. Liu, X. Wu, J. Meng, Phys. Lett. B 734, 215–219 (2014)

Evaluation or version date: 2014-June-3 author-labelled table

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1016/j.physletb.2014.05.049)
- [verified primary alternative metadata](https://arxiv.org/abs/1405.2616)
- [recorded source table](http://www.imqmd.com/mass/)
- DOI [10.1016/j.physletb.2014.05.049](https://doi.org/10.1016/j.physletb.2014.05.049)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Author-labelled 2014 table supplied for verification. Live author-host download unavailable at review; papers verified. WS4 and WS4+RBF are related variants, not independent error estimates. No RBF re-fit to AME2020 or new input masses.

## ws4rbf

WS4: N. Wang et al., Phys. Lett. B 734, 215–219 (2014); RBF method: N. Wang, M. Liu, Phys. Rev. C 84, 051303(R) (2011)

Evaluation or version date: 2014-June-3 author-labelled table; RBF method 2011

Original numerical retrieval date: not recorded; link-check date is not numerical retrieval date

- [model paper](https://doi.org/10.1016/j.physletb.2014.05.049)
- [verified primary alternative metadata](https://journals.aps.org/prc/abstract/10.1103/PhysRevC.84.051303)
- [recorded source table](http://www.imqmd.com/mass/)
- DOI [10.1016/j.physletb.2014.05.049](https://doi.org/10.1016/j.physletb.2014.05.049)
- DOI [10.1103/PhysRevC.84.051303](https://doi.org/10.1103/PhysRevC.84.051303)

No model mass standard uncertainty is supplied (null). Beta2 is not sigma. Model spread and global rms residuals are not per-nuclide independent errors. Missing neighbours/shape values remain absent.

Author-labelled 2014 table supplied for verification. Live author-host download unavailable at review; papers verified. WS4 and WS4+RBF are related variants, not independent error estimates. No RBF re-fit to AME2020 or new input masses.

# Individual programs and source file index

Run these entry points from the GUI checkout. Commands are recorded from the inventory and were not executed by this documentation build. Full scientific file hashes and line numbers are retained in inventory-delivery.json; document generation is not new scientific or native-GUI acceptance.

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2n --format csv
```

```sh
./Run_private.command traplab.py gui --page mass_landscape --standalone
```

```sh
./Run_private.command traplab.py gui --page nuclear_chart --standalone
```

```sh
./Run_private.command traplab.py gui --page mass_workbench --standalone
```

```sh
./Run_private.command apps/ame_nubase.py --quantity s2n --z 50 --minimum 60 --maximum 74
```

```sh
./Run_private.command apps/mulberry_mass.py --quantity s2n --z 50 --minimum 60 --maximum 74
```

```sh
./Run_private.command scripts/plot_mass_workbench.py --input private_examples/mass_workbench_v2/116Sn_ME.csv --quantity s2n --z 50 --minimum 60 --maximum 74 --models ws4rbf frdm2012 --output outputs/mass_workbench/FRESH_RUN_NAME --formats png pdf svg
```

```sh
from gsi_mrtof.science import nuclear_mass_operator; nuclear_mass_operator(records,z,n,[(dN,dZ,coefficient),...],offset_keV=0,covariance=None)
```

```sh
from gsi_mrtof.nuclear import apply_energy_operator; result=apply_energy_operator('R1D1n1p',table,be_unit='keV',covariance=None)
```

```sh
./Run_private.command -m gsi_mrtof run ame_analysis --inputs @PATH_TO_INPUTS_JSON
```

```sh
const P=require('./static/js/physics.js'),S=require('./static/js/mass-surface.js'); const {derive}=S.create(getter,{MEn,MEH,MEa,MEd},betaLookup,evaluatedLookup); derive(Z,N,'ame').s2n;
```

- energies.py · `8a8e6ad37aec99fabf5a5d87f5ec3ab70dc998589e990ba8ff7dc74191377677`
- constants.py · `76c6d2fe38d002795b2ff4997b1850fe125ad35bcb13aca8d6152c34194c37e3`
- models.py · `e6cc878e85d0bbdaf38fbe65da97776fe7b9dda802cb1c8b8ef0a33c28dc3c0f`
- service.py · `d1578556ae15e80f6ef3a325a1ddd0af52260a46c6644208c10bdfe87be8eb03`
- decay.py · `44337db5aa71ec5c0b3f11750673e57ef0ed1045dcfabc61b948926bd849e2a6`
- __main__.py · `4d66bd55cb44e79b39a2df3994907e268546e510583c40d6a1211ac191854c08`
- nuclear_reference.py · `e92474c8cf387d607fcfb7404fbc3065bd2326e4dd05be23b095c9328bf2556d`
- physics.py · `ed1487953b7e3998bbb6d00a6952b8fe54d9bbfd4d2c1d81b3a8d97e26ee15cd`
- mass_workbench.py · `384516621386296cb0739d796ea6d3a7ce32ec67479c4053ecc31ce893b8977c`
- mass_landscape.py · `51b25b54eca939360911ae571572f99ce62b7a4f778229e364189542386a806a`
- nuclear_chart.py · `b5247847f7836fe80e6292a2b4bc3fa7c4008ae9cd9d1dfda90fae38b9f772c4`
- mass_tools.py · `9a87d2f3d46a816a32a90687b3cd83fc3af3ad71a0654b4dd0a7d3d1be62604e`
- mass_workbench_ui.py · `3f03ecf297f24db5fff2c99bc3d51ebd3f7029d6e8f5012686e31b4e3aa0b78f`
- plot_mass_workbench.py · `caacefbba4df1eda7887b75f33e2bd1bf491b58b5066cf2fcc1cbfaf6a42b6f9`
- ame_nubase.py · `4fae5f046e983f4dfee8f765848127663811c70d0faef80c75d4a91df6dde1a4`
- mulberry_mass.py · `b9cfa27bf5ba371d891deb24148b80653c7731b1e26f0ca8533166c52d41f157`
- run_individual.py · `e1edc328dd460b0267498165827a3934690ad57ec60fea40c54d8e2e7846804a`
- nuclear.py · `721f27ce9a6a1d44af4d7e25bb7a285a10b73f03967ad04b8473dd4b07a5116b`
- science.py · `7988e5dbebdd7e5e9d0e33db2a9a138a1555d80d79b72f71d0e24164c75becb1`
- __main__.py · `31fc3c5fa727f82c7ed0c53b17feb4b28b06f75a0a3743f7c5332d9096757490`
- nuclear_operator_metadata.csv · `e7ac96558532287f83f84f145e2196f72129db10fe6574d29eec3abec52138af`
- nuclear_operator_weights.csv · `50691edddf6b7b1c8b9207ca281c719769c155468a1bb04b9b94e1b71dfc6865`
- NUCLEAR_REFERENCE_EN.md · `e8f684dc1273542210fbb9450ba1bcd0b24670788d2a375d9e3fc915471c9228`
- NUCLEAR_DATA_EN.md · `7c32914782e2b39bc0d008b865c95f67f6a6552ce4fab02cdf286adda03395a9`
- MASS_WORKBENCH_EN.md · `280072337fe3aed9eb9624e35cd2d76a068199c3a738144136b8fedb6c54772e`
- AME_MULBERRY_FEATURE_REVIEW_EN.md · `28fa3b49ccde73f90cc08299093a5d221d6db39962dd539c040120a13acd9e96`
- mass-surface.js · `0563dd3aa7ba2633d9867051dc4035db91195bd736106926ad3fc0963bdb8fcc`
- physics.js · `7bdf10025e7571b1dea722c2407305f2c2332a24cdcc184baaec317087c0746a`
- ame-evaluated.js · `e4fc2de8ef689dd32765e4c2ad2bfe86081c713179ce89e65c9e5f0deda70cfd`
- nuclide-chart.js · `7ea908222322320624d4e2c2b277d3cb23c5292fe6a2180afe03d0ac91870bd5`
- mass-quantity-menu.js · `68654dd057ac856e1caf35b8e35bb1be52be1eb49677c2885be22f12226f69ad`
- measured-masses.js · `730f1daed0677af8848b09c05d3bf709b42db0d2d3310e9a435c9c51409158c0`
- ame2020_reference.csv · `f8cddd5544c1d7fa3f56213c58b3bde1d1e6cc7ec3c69e8b7933bfdb1612fca8`
- ame2020_reference_metadata.csv · `df9652aa9e6985686583eb3782bd568232356c8fbaace073778986d4cc5c448f`
- index.json · `71338c7c73837caa9b24092d43d93707ffa3b287302ae9d76162e5386c2ff834`
- ame2020-reactions.json · `902d19a60e7b42772044c06c2277615d9f7f9cbb90454baa85ebff2535b48ffc`
- chart-typed-data.js · `bb9aef72fbef7ef49817aee63e6b0882c869b63c4cc1f600195d85803e0208bc`
- measured-masses-ui.js · `e698b612fa6c5343d1a56b81d4e9f8c915f383022314868ccc1955cefd685046`
- nuclide_chart_labels.yaml · `f193f37649fb262df9d6ea92fd41b4a51eacbcef35ad01420e8e7e7b5aecfe28`
- nuclide-chart.html · `49904708401e5c3b12416314c5aee21bb7cb6943eb0c0637aa35b140911e3ba2`
- chart_typed_data.test.cjs · `e0553c10c99e76d72ee75fa8f65468d12dd9d6d872de902d7810156eb9988a3b`
- measured_mass_ui.test.cjs · `35f4330dffdee8dcbb863fee2b1916ddfc2bb34f7a80c402748c30e6dcd9ff5e`
- chart_controls.test.cjs · `7ace99cded8be5a33c83f3c19692878dab005b271e22e819e8ed35635b9a4dc8`
- test_chart_script_dependencies.py · `226d42e1744cc6587f3133e5781030c3dc2203b9b9c0a9db537e63475ef0820b`

# Modification reproduction and evidence limits

When equations, stencils, units or provenance change, update the machine-readable inventory and run existing scientific regressions before rebuilding the guide. Do not loosen independent reference tolerances merely to pass a test. Results with different source or uncertainty models may differ; retain the difference and its reason. Module names identify implementation entry points; the companion application is installed and run locally. Public-edition file hashes are listed in MANIFEST.json.

This public edition provides portable Markdown, editable Word equations, offline MathML HTML and standalone TeX source. Equations are editable Word OMML, not images. The owner's explicit instruction prohibits creating or saving screenshots of manual pages. OOXML structure, math lint and optional vector-PDF text/page-bound checks do not establish all-page visual layout acceptance in Word. Scientific-data verification, browser interactions, downloads, deployment, Qt, Windows and hardware acceptance are separate evidence levels.

## Reused bilingual documentation

- AME audit
- Mass workbench
- Nuclear reference
