---
title: Cyclotron Frequency Comparison User Guide
author: TrapLab documentation
date: 2026-10-24
documentclass: revtex4-2
classoption: [aps, onecolumn, 11pt]
---

Use the existing Lab cyclotron calculator to compare one to ten explicitly identified ions or isotope-resolved molecules at a shared magnetic field. Each row retains its own mass convention, uncertainty and source. This tool calculates free cyclotron frequencies; it does not fit a resonance, calibrate a magnetic field or infer an atomic composition.

## Compare two ions on the website

1. Open Lab and find the cyclotron calculator. Keep $B=7$ T for the first comparison. Leave field uncertainty blank to retain unknown uncertainty, or enter zero only when you deliberately treat the field as fixed.
2. Enter `133Cs` in the first row and select evaluated masses. Add a species row containing `85Rb`. Leave charge blank for the parsed charge or the default $+1$, or enter a consistent nonzero integer explicitly.
3. Choose **Saved AME2020 / NUBASE2020** for a reproducible offline comparison, then **Calculate all rows**. Each row should show frequency in Hz, charge, ion mass and either a known uncertainty or an explicit unknown state. The Cs frequency is approximately 0.81 MHz at 7 T; use the returned full precision rather than this rounded check value.
4. Open each row's source details. Confirm the evaluation, nuclear-state identifier, source origin and mass uncertainty. Online-first may fall back explicitly to the saved 2020 edition; online-only reports failure if its ground-state request cannot be fulfilled.
5. Save all rows JSON and download results CSV. Change a row and observe that its previous result becomes stale. Load the JSON again and verify recalculated results and retained source details. These files go to the browser's selected download location.

Add permits at most ten rows; Remove leaves at least one. A field edit invalidates affected results, and newer input cancels older asynchronous fills. Do not copy a displayed number after changing its input without recalculating.

## Species and manual mass entry

Accepted examples include `133Cs`, `Cs-133`, `cesium-133`, `133Xe[m1]`, `12C:16O*2` and `[133Cs+1H]+`. Every molecular component must have an isotope. Bare `Cs`, `H2O`, unavailable states and conflicting charge indications are rejected. Use a bracketed explicit charge or the charge field when a trailing digit could be interpreted as an isotope count.

For a user mass, clear evaluated-mass selection and enter mass and optional uncertainty. Choose **Neutral atom or component sum** or **Already ionic mass** explicitly. Units are u or keV/$c^2$. The keV/$c^2$ field is a full mass, not a mass excess. Changing its unit converts both mass and known uncertainty. Editing an automatically filled mass clears the former evaluated uncertainty and switches to manual entry, preventing an old error from being attached to a new value.

Charge is a nonzero integer between −100 and 100. The field and resulting ion mass must be positive. The reported frequency is a magnitude; signed frequency is retained in the exported data.

## Formula and units

Let $M$ and $m_e$ be numerical masses in u and let $u$ denote the atomic mass constant in kg. The entered convention controls whether the electron correction is applied:

$$m_{\mathrm{ion}}=M-qm_e\quad\text{for neutral input},$$

$$m_{\mathrm{ion}}=M\quad\text{for already ionic input}.$$

For positive ions the first expression subtracts electron masses; for negative ions it adds them. Ionization, electron-affinity and molecular binding energies are omitted. Already ionic input is not corrected twice.

$$\nu_c=\frac{|q|eB}{2\pi m_{\mathrm{ion}}u},\qquad \nu_{\mathrm{signed}}=\frac{qeB}{2\pi m_{\mathrm{ion}}u}.$$

Frequency is in Hz for $B$ in T. The mass-energy conversion retained by this implementation is

$$C_u=uc^2=931494.10242\ {\mathrm{keV}},$$

$$M=\frac{E_{\mathrm{mass}}}{C_u},\qquad M=A+\frac{ME}{C_u}.$$

The first relation converts a full mass entered in keV/$c^2$; the second explains conversion of an evaluated atomic mass excess $ME$. They are different inputs and must not be interchanged.

## Uncertainty and correlations

When both mass and field uncertainties are supplied, the displayed marginal uncertainty is

$$\sigma_{\nu}=\nu_c\sqrt{\left(\frac{\sigma_B}{B}\right)^2+\left(\frac{\sigma_M}{m_{\mathrm{ion}}}\right)^2}.$$

Constants are held fixed. Blank uncertainty is unknown; numerical zero is a known fixed input. If either required uncertainty is unknown, frequency uncertainty remains unknown. For a repeated isotope in a molecule, primitive coefficients are combined before propagation:

$$M_{\mathrm{sum}}=\sum_i n_iM_i,\qquad \sigma_{M_{\mathrm{sum}}}^2=\sum_i n_i^2\sigma_{M_i}^2.$$

This is a diagonal primitive model, not the complete AME covariance. Rows share the same field. Its contribution to their covariance is

$$\operatorname{Cov}_B(\nu_j,\nu_k)=\frac{\nu_j\nu_k}{B^2}\sigma_B^2.$$

Shared isotope primitives can correlate rows as well. The calculator supplies row marginals; it does not provide a joint frequency-ratio fit or justify treating all displayed rows as independent.

## Evaluations and website versus native conventions

Saved ground-state masses come from AME2020; exact state identities and excitation information come from NUBASE2020. In the website convention,

$$M^*=M_{g,\mathrm{AME2020}}+\frac{E_{x,\mathrm{NUBASE2020}}}{C_u}.$$

The web online choice queries IAEA LiveChart ground-state mass excess while retaining the explicit 2020 source policy and saved fallback. Source evaluation date and request/retrieval date are distinct. The native `ame2020` policy uses AME ground masses and direct NUBASE selected-state masses, rather than reconstructing excited masses with the above expression. Native `nubase2020` explicitly uses that saved evaluation. This distinction can change an isomer result; preserve the state and source policy with every exported comparison.

The web keeps its CODATA2018/AME2020 constant profile, including $m_e=5.48579909065\times10^{-4}$ u and $u=1.66053906660\times10^{-27}$ kg. The native compatibility profile retains the same mass-energy conversion but uses $m_e=5.485799090441\times10^{-4}$ u and $u=1.66053906892\times10^{-27}$ kg. Small cross-platform numerical differences therefore do not necessarily indicate a bug.

## Run the installed companion

Open a terminal in the separately installed companion application folder. For a saved-source command-line comparison, run

```sh
./Run_private.command -m traplab_qt.cyclotron_compare 133Cs 85Rb --B 7 --sigma-B 0 --policy ame2020
```

Append `--output cyclotron-example` to create a new bundle directory containing `cyclotron_rows.json` and `cyclotron_results.csv`. An existing directory is rejected, preserving earlier results. Use `--settings cyclotron-example/cyclotron_rows.json` to reopen inputs and recalculate. This native service is offline; it does not implement the browser's online-source policy. The companion GUI entry is `Individual_tools/14_Cyclotron_comparison.command` and its standalone page is `cyclotron_compare`. Module and launcher names identify the installed application; they do not link to private source downloads.

The GUI can also be opened with `./Run_private.command traplab.py gui --standalone --page cyclotron_compare`. It offers an English or Chinese switch, one to ten rows, a frequency-by-row plot, expandable source details, and Auto, TrapLab, Cloudberry or MRS legacy notation. Native examples include `133Cs`, `133Xe[m1]` and `12C:16O2`; full element-name aliases are not advertised by this native page. Its Save action creates a fresh `outputs/cyclotron_compare/run-N/` bundle, and Open rows JSON validates all settings before replacing them and recalculating. The dedicated bundle contains CSV and JSON; figure saving uses the existing Plot style and Export plots facilities, not an assumed all-format bundle.

## Recovery and evidence

Resolve ambiguous species by naming isotopes, select an available nuclear state, correct charge conflicts, and recalculate. If the service fails, choose saved data explicitly or retry; inputs are retained. For manual input, fill a finite positive mass and choose its convention. Empty uncertainty must not be replaced with zero merely to obtain an error bar.

The web source has 43 focused parser, calculation and UI tests. Eleven native core and actual BasePage tests passed, including signed charges, state errors, repeated-isotope uncertainty, units, unknown and zero errors, settings reopening and invalid-input preservation. Offscreen construction does not establish native Cocoa export, browser download, hardware or precision mass-measurement acceptance. The mathematical result is conditional on the selected mass source and omitted binding corrections.

## Primary references

- M. Wang, W. J. Huang, F. G. Kondev, G. Audi and S. Naimi, The AME2020 atomic mass evaluation II, Chinese Physics C 45, 030003 (2021); [official unrounded mass table](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt). Table flags distinguish estimated values and missing quantities.
- F. G. Kondev et al., The NUBASE2020 evaluation of nuclear physics properties, Chinese Physics C 45, 030001 (2021), [DOI 10.1088/1674-1137/abddae](https://doi.org/10.1088/1674-1137/abddae); [official state table](https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt).
- IAEA Nuclear Data Services, [LiveChart Data Download API guide](https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html), checked 24 October 2026. This guide describes API fields; it does not change the selected AME/NUBASE evaluation.
