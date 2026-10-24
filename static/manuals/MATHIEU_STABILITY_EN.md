---
title: Mathieu Stability User Guide
author: TrapLab documentation
date: 2026-10-24
documentclass: revtex4-2
classoption: [aps, onecolumn, 11pt]
---

This guide explains the separate Mathieu stability explorer on the website and in the installed companion application. It calculates ideal bounded motion in one or more Mathieu bands. A stable point is not a measured transmission, a cooling efficiency or an electrode-clearance result. The classic Keep the ions game remains a separate trajectory demonstration.

## First calculation

1. Open Games, go to Keep the ions, and select Mathieu bands. The same independent explorer is available on Lab. Choose **Linear RFQ**, **Direct point**, three bands, horizontal limit 2 and vertical limits −1 to 1.
2. Enter $a=0$ and $q=0.4$. Both transverse planes should report stable in the first band. Change $a$ or $q$ and read each plane's status rather than judging the shaded picture alone.
3. Switch to voltage input. Use ion mass 100 u, charge 1, $U=0$ V, $V=122$ V, $r_0=10$ mm and $f=1.3$ MHz. The calculation gives $a=0$ and $q\simeq0.07057237$. The shipped voltage inputs have $U=3$ V instead; those give $a\simeq0.00347077$. Do not assume that every default operating point is stable in both planes.
4. Change the three section settings independently. Cooler defaults are 3 V, 122 V, 10 mm and 1.3 MHz; mass-filter and buncher defaults are each 3 V, 244 V, 3.75 mm and 3 MHz. Read their separate lines and ion markers. These overlays belong to the linear RFQ geometry.
5. Open **Figure style** to change text, reference marker diameter, line width, raster width or filename prefix. These controls change drawing only. Save settings JSON, change an input, reopen the saved JSON, and check that the inputs, axes and style return.

The Species field and **Fill ion mass** explicitly obtain an ion mass from the existing isotope catalogue. Manual mass and charge remain editable; merely typing a species does not perform an automatic fill. Record the returned source metadata when using an evaluated mass.

## Equation and voltage convention

The independent variable and standard equation are

$$\tau=\frac{\Omega t}{2},\qquad \Omega=2\pi f,$$

$$\frac{d^2w}{d\tau^2}+\left[a-2q\cos(2\tau)\right]w=0.$$

For this linear-rod convention,

$$a=\frac{8zeU}{m r_0^2\Omega^2},\qquad q=\frac{4zeV}{m r_0^2\Omega^2}.$$

Here $z$ is the positive integer charge state, $e$ is the elementary charge, and $m$ is the actual ion mass in kg. The UI accepts mass in u, radius in mm and frequency in MHz and converts them to SI. $U$ is signed DC voltage and $V$ is the rod-to-ground RF peak. The differential RF peak is $2V$; RMS or peak-to-peak values must be converted before entry. The second transverse plane uses

$$a_y=-a_x,\qquad q_y=-q_x.$$

Both planes must be stable for ideal transverse confinement. Reducing the rod radius or frequency increases the magnitude of the parameters quadratically. Charge must be an integer from 1 to 100; mass, radius and frequency must be positive and finite, and RF peak must be nonnegative.

## Bands and the separate three dimensional geometry

For nonzero real $q$, the displayed one-dimensional bands are indexed by $n=0,\ldots,N-1$ and satisfy

$$a_n(|q|)<a<b_{n+1}(|q|).$$

The UI supports one to six bands and $|q|\leq12$. A boundary is reported separately. Above the calculated bands or outside the covered domain, the status is outside coverage, not a demonstrated instability. At $q=0$, positive $a$ is treated analytically as stable; $(a,q)=(0,0)$ is a boundary.

The **3D Paul** view accepts direct axial parameters only. It uses

$$a_r=-\frac{a_z}{2},\qquad q_r=-\frac{q_z}{2}.$$

Its radial boundary curves in axial coordinates therefore are

$$-2a_n(|q_z|/2),\qquad -2b_{n+1}(|q_z|/2).$$

The interface does not infer an electrode voltage convention for this geometry. The three linear-section lines and points are hidden in this view. Do not transfer the linear-rod voltage formula to an arbitrary three-dimensional electrode layout.

## Numerical checks and saved files

The browser computes characteristic values from parity-specific symmetric Hill matrices using Sturm bisection. Native computation uses installed SciPy Mathieu characteristic functions. An independent RK4 integration over one coefficient period constructs a monodromy matrix $M$. Its diagnostics include

$$\det M\simeq1,\qquad |\operatorname{tr}M|<2,$$

$$\Delta_{\mathrm{tr}}=|\operatorname{tr}M_{1024}-\operatorname{tr}M_{512}|.$$

The strict trace inequality describes the interior stable case. Near boundaries, inspect the characteristic-value classification and convergence diagnostic. Failure of the numerical diagnostic to converge is unresolved. The shaded diagram samples 241 horizontal points, so narrow higher-band regions can be visually undersampled; the selected point uses characteristic values directly.

**SVG** saves vector curves and text. **PNG** uses the selected raster width. **CSV** saves the sampled band data; **Save settings JSON** preserves geometry, inputs, section parameters, axes and style for reopening. Browser files go to the browser's configured download location. The existing shared image-PDF facility, where exposed, is a raster figure PDF; it is distinct from the vector SVG and from compiling this guide's TeX source.

## Installed companion workflow

In the separately installed companion folder, open `Individual_tools/13_Mathieu_stability.command`, or run

```sh
./Run_private.command traplab.py gui --standalone --page mathieu_stability
```

The integrated page is Mathieu stability multiple bands under Paul trap and RFQ. It starts with a selected 133Cs ion and provides one selected operating line, direct or voltage inputs, local axis font and marker diameter, normal page-state persistence, and the existing Plot style dock and Export plots actions. The existing `rfq_sections` page retains the native three-section workflow; the new native page does not add three independent section lines. Native launch modules are portable entry-point labels, not website downloads.

Web SI u is $1.66053906660\times10^{-27}$ kg from its retained CODATA2018 profile; the native profile uses $1.66053906892\times10^{-27}$ kg from CODATA2022. Small parameter differences are expected. No uncertainty propagation, fringe fields, collisions, space charge, electrode losses or hardware acceptance is included.

## Recovery and evidence

For a blank or invalid input, restore a finite value in the stated range. If a requested point is outside coverage, reduce the domain or increase the band count within the supported limits; do not relabel it stable. If a species fill fails, retain its exact isotope/state or explicitly enter an ion mass. Reopen settings of this explorer rather than a legacy diagram file.

Source checks covered 150 characteristic values at six selected $q$ values and orders through 12 against SciPy 1.10.1, with maximum absolute difference $2.85\times10^{-14}$. Nine focused web tests and five native offscreen tests passed. These bounded checks do not establish browser download acceptance, native Cocoa export acceptance or experimental performance.

## Primary references

- NIST Digital Library of Mathematical Functions, version 1.2.8, [28.2 Definitions and Basic Properties](https://dlmf.nist.gov/28.2) and [28.17 Stability](https://dlmf.nist.gov/28.17), checked 24 October 2026.
- SciPy official documentation, [mathieu_a](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.mathieu_a.html) and [mathieu_b](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.mathieu_b.html). The installed native validation version is 1.10.1; current online documentation may describe a later release.
- Evaluated mass provenance, when filling an ion, is retained from [AME2020](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt) and [NUBASE2020](https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt). Numerical conventions reuse the existing companion `paul_mathieu` and `rfq_sections` implementations.
