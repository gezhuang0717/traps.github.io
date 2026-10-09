# Public mass-model sources

Numerical facts only; raw downloads, audits and private experiment tables are excluded. Model error columns are residuals, not mass uncertainties. Ground-state theory only; each model loads independently after selection.

| Model | Rows | Primary source | Raw SHA-256 / lineage |
|---|---:|---|---|
| FRDM1992 (published 1995) | 8755 | [P. Möller, J.R. Nix, W.D. Myers, W.J. Swiatecki, At. Data Nucl. Data Tables 59, 185 (1995)](https://doi.org/10.1006/adnd.1995.1002) | legacy TALYS1.95 normalized extraction; see citation |
| FRDM2012 (published 2016) | 9318 | [P. Möller, A.J. Sierk, T. Ichikawa, H. Sagawa, At. Data Nucl. Data Tables 109–110, 1–204 (2016)](https://doi.org/10.1016/j.adt.2015.10.002) | 99ce7ece6830b0904f68d9a6342b9e66d0ebf0d235c2eb6c4de78716768c10e4 |
| HFB-17 (Skyrme) | 9985 | [S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. Lett. 102, 152503 (2009)](https://doi.org/10.1103/PhysRevLett.102.152503) | legacy TALYS1.95 normalized extraction; see citation |
| HFB-D1M (Gogny) | 8322 | [S. Goriely, S. Hilaire, M. Girod, S. Péru, Phys. Rev. Lett. 102, 242501 (2009)](https://doi.org/10.1103/PhysRevLett.102.242501) | legacy TALYS1.95 normalized extraction; see citation |
| HFB-14 (BSk14) | 8388 | [S. Goriely et al., Phys. Rev. C 75, 064312 (2007)](https://www.astro.ulb.ac.be/pmwiki/Brusslib/Hfb14) | a08bd5362ce67581441407a77312a002ecc512bd1e12a84e8745396fa7bd1810 |
| HFB-24 (BSk24) | 8392 | [S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)](https://doi.org/10.1103/PhysRevC.88.024308) | 23ced4dcf37a9ba7a06130dce16f9148a17e4591118857c6779e3ff06a76f63e |
| BSkG3 (2023) | 8485 | [G. Grams et al., Eur. Phys. J. A 59, 270 (2023)](https://www.astro.ulb.ac.be/pmwiki/Brusslib/BSkG3) | 6caff2762ea1ce8deb3707ac16d286bdb084ea97fdf084d5783a157fb20543b6 |

New ULB inputs retain10keV mass precision and0.01 beta2 precision. HFB14 uses fixed columns because fields can be blank. First/last identities and24,933 neutron-separation differences agree within0.016MeV rounding tolerance. Raw tables have8388 HFB14,8392 HFB24,8485 BSkG3 rows; older ULB prose quotes differing counts/ranges, so the hashed table defines this snapshot. Internal consistency is not model or experimental validation.

Public author tables:

- hfb14: [author table](https://www.astro.ulb.ac.be/Nucdata/Masses/hfb14-plain)
- hfb24: [author table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb24-dat)
- bskg3: [author table](https://www.astro.ulb.ac.be/bruslib/nucdata/bskg03-dat)

## Update procedure

Save a public author-hosted table and its URL outside the checkout. Run the following, review identities, columns, precision and metadata, then test Python/Node and preview before a normal commit. Keep normalized data and generated index/payloads together. Missing values remain missing; model sigma is never invented.

    python tools/import_bruslib.py KEY /private/path/table --audit /private/path/audit.json
    python tools/make_mass_models.py

## Candidates still pending

WS3/WS4(+RBF), DZ28/31, KTUY05, HFB21/22/23/25/26/27, UNEDF0/1, BSkG1/2/4 and INM are not included. Public author tables, units/precision/reuse review and tests are required. IMQMD WS4 endpoints timed out in this audit; private communication tables remain excluded. IAEA HFB14 returned403; the publicly linked author ULB table was used instead.
