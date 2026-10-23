/* Allowed and unique-forbidden beta spectra (educational model, not a replacement for evaluated BetaShape/DDEP data).
   Units: energies in units of m_e c^2 inside the functions (W = total electron energy, p = sqrt(W^2 - 1), W0 = endpoint total energy);
   the public helpers take and return keV. Model:
     N(W) dW  ∝  p W q^2 F(Z,W) L0 C(W) dW,    q = W0 - W  (neutrino momentum in units of m_e c)
     F = relativistic Fermi function with a uniformly charged sphere of radius R = (alpha/2) A^(1/3) (Wilkinson),
     optional Rose screening, optional leading finite-size factor L0,
     C(W) = 1 (allowed),  p^2 + q^2 (first-forbidden unique),  p^4 + (10/3) p^2 q^2 + q^4 (second-forbidden unique), with lambda_k = 1.
   Limits: no radiative, atomic-exchange, weak-magnetism or induced-pseudoscalar corrections; non-unique forbidden decays use the allowed shape. */
(() => {
  'use strict';
  const ALPHA = 1 / 137.035999084, ME_KEV = 510.99895000;
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  /* Re ln Gamma(x + i y) by the Lanczos approximation (g = 7); valid for x >= 0.5. */
  function reLnGamma(x, y) {
    const zr = x - 1, zi = y;
    let sr = LANCZOS[0], si = 0;
    for (let i = 1; i < 9; i++) { const dr = zr + i, d = dr * dr + zi * zi; sr += LANCZOS[i] * dr / d; si -= LANCZOS[i] * zi / d; }
    const tr = zr + 7.5, ti = zi, lnAbsT = 0.5 * Math.log(tr * tr + ti * ti), argT = Math.atan2(ti, tr);
    // Re[(z + 1/2) ln t] = (zr + 1/2) ln|t| - zi arg t ;  Re ln(sum) = ln|sum|
    return 0.5 * Math.log(2 * Math.PI) + (zr + 0.5) * lnAbsT - zi * argT - tr + 0.5 * Math.log(sr * sr + si * si);
  }

  const radius = A => 0.5 * ALPHA * Math.cbrt(A);        // nuclear radius in units of hbar/(m_e c)
  /* Fermi function F0(Z,W). sign = +1 for beta-, -1 for beta+. Z is the daughter proton number. */
  function fermi(Z, W, A, sign = 1) {
    const p = Math.sqrt(W * W - 1);
    if (!(p > 0)) return NaN;
    const a = ALPHA * Z, gamma = Math.sqrt(1 - a * a), y = sign * a * W / p, R = radius(A);
    const lnF = Math.log(2 * (gamma + 1)) + 2 * (gamma - 1) * Math.log(2 * p * R) + Math.PI * y + 2 * reLnGamma(gamma, y) - 2 * reLnGamma(2 * gamma + 1, 0);
    return Math.exp(lnF);
  }
  /* Rose screening: electron energy shifted by V0 = 1.13 alpha^2 Z^(4/3) (m_e c^2); used only where the shifted energy stays above 1. */
  function screened(Z, W, A, sign) {
    const V0 = screenShift(Z), W1 = W - sign * V0;
    if (!(W1 > 1 + 1e-9)) return fermi(Z, W, A, sign);
    const p = Math.sqrt(W * W - 1), p1 = Math.sqrt(W1 * W1 - 1);
    return (p1 * W1) / (p * W) * fermi(Z, W1, A, sign);
  }
  /* Leading terms of the finite-size convolution correction L0 (Wilkinson). */
  function finiteSize(Z, W, A, sign) {
    const a = sign * ALPHA * Z, gamma = Math.sqrt(1 - (ALPHA * Z) ** 2), R = radius(A);
    return 1 + 13 / 60 * a * a - W * R * a * (41 - 26 * gamma) / (15 * (2 * gamma - 1)) - a * R * gamma * (17 - 2 * gamma) / (30 * W * (2 * gamma - 1));
  }
  const SHAPES = {
    allowed: () => 1,
    first_unique: (p, q) => p * p + q * q,
    second_unique: (p, q) => p ** 4 + 10 / 3 * p * p * q * q + q ** 4,
  };

  /* Un-normalised electron spectrum S(W). */
  function shape(par, W) {
    const { Z, A, W0, sign, screening, finite, type } = par, p = Math.sqrt(W * W - 1), q = W0 - W;
    if (!(p > 0) || !(q >= 0)) return 0;
    const F = screening ? screened(Z, W, A, sign) : fermi(Z, W, A, sign);
    return p * W * q * q * F * (finite ? finiteSize(Z, W, A, sign) : 1) * SHAPES[type](p, q);
  }

  /* 128-point Gauss-Legendre nodes on [-1,1] by Newton iteration (computed once). */
  const GL = (() => {
    const n = 128, x = [], w = [];
    for (let i = 0; i < n; i++) {
      let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1); } pp = n * (z * p1 - p2) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    return { x, w };
  })();
  /* Integral of f(W) over [1, W0]. W = 1 + (W0-1) t^2 removes the square-root behaviour at threshold. Rose screening of beta- decay switches on at
     W = 1 + V0 (kink), where the screened electron momentum starts from zero: the interval is then split there and each half gets its own
     square-root-removing substitution (W = 1 + (kink-1) t^2 below, W = kink + (W0-kink) u^2 above, p1 ~ u), so the 128-point rule stays accurate. */
  const gl = (g, a, b) => { let s = 0; for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * g(0.5 * (b - a) * GL.x[i] + 0.5 * (b + a)); return 0.5 * (b - a) * s; };
  function integrate(f, W0, kink) {
    const piece = (lo, hi) => gl(t => { const W = lo + (hi - lo) * t * t; return f(W) * 2 * (hi - lo) * t; }, 0, 1);
    return kink > 1 && kink < W0 ? piece(1, kink) + piece(kink, W0) : piece(1, W0);
  }
  const screenShift = Z => 1.13 * ALPHA * ALPHA * Math.pow(Z, 4 / 3);

  function validate(par) {
    const { Zd, A, Q_keV } = par;
    if (!Number.isInteger(Zd) || Zd < 1 || Zd > 118) throw RangeError('daughter proton number Z must be an integer from 1 to 118');
    if (!Number.isInteger(A) || A < 2 || A > 300) throw RangeError('mass number A must be an integer from 2 to 300');
    if (!(Q_keV > 0 && Q_keV < 30000)) throw RangeError('endpoint energy Q must be between 0 and 30 MeV (keV units)');
    if (!(par.type in SHAPES)) throw RangeError('unknown shape ' + par.type);
    if (!['-', '+'].includes(par.mode)) throw RangeError('mode must be - or +');
  }

  /* spectrum({Zd, A, Q_keV, mode: '-'|'+', type, screening, finite, points}) -> arrays in keV. Q is the kinetic-energy endpoint. */
  function spectrum(par) {
    validate(par);
    const p0 = { Z: par.Zd, A: par.A, W0: 1 + par.Q_keV / ME_KEV, sign: par.mode === '-' ? 1 : -1, screening: par.screening !== false, finite: par.finite !== false, type: par.type || 'allowed' };
    const kink = p0.screening && p0.sign === 1 ? 1 + screenShift(p0.Z) : 0;
    const norm = integrate(W => shape(p0, W), p0.W0, kink);
    const mean = integrate(W => (W - 1) * shape(p0, W), p0.W0, kink) / norm;
    const meanNu = integrate(W => (p0.W0 - W) * shape(p0, W), p0.W0, kink) / norm;
    const n = Math.max(20, Math.min(2000, par.points || 300)), E = [], N = [], Nnu = [];
    for (let i = 0; i <= n; i++) { const t = i / n, W = 1 + 1e-9 + (p0.W0 - 1 - 2e-9) * t; const s = shape(p0, W) / norm / ME_KEV; E.push((W - 1) * ME_KEV); N.push(s); Nnu.push(s); }
    const nuE = E.map(e => par.Q_keV - e);   // E_nu = Q - E_e (nuclear recoil neglected)
    let imax = 0; N.forEach((v, i) => { if (v > N[imax]) imax = i; });
    return { E_keV: E, N_per_keV: N, Enu_keV: nuE, Nnu_per_keV: Nnu, mean_keV: mean * ME_KEV, mean_nu_keV: meanNu * ME_KEV, mode_keV: E[imax], f: norm, log10f: Math.log10(norm), W0: p0.W0, params: p0 };
  }
  /* log ft = log10(f * t_partial), t_partial = T1/2 / branching in seconds. */
  const logft = (f, halfLife_s, branching) => Math.log10(f * halfLife_s / branching);

  const PRESETS = [
    { id: '3H', nuclide: '³H → ³He', Zd: 2, A: 3, Q_keV: 18.5906, mode: '-', type: 'allowed', ref_mean_keV: 5.68, t12_s: 3.8878e8, br: 1 },
    { id: '14C', nuclide: '¹⁴C → ¹⁴N', Zd: 7, A: 14, Q_keV: 156.476, mode: '-', type: 'allowed', ref_mean_keV: 49.47, t12_s: 1.8082e11, br: 1 },
    { id: '35S', nuclide: '³⁵S → ³⁵Cl', Zd: 17, A: 35, Q_keV: 167.33, mode: '-', type: 'allowed', ref_mean_keV: 48.8, t12_s: 7.5594e6, br: 1 },
    { id: '63Ni', nuclide: '⁶³Ni → ⁶³Cu', Zd: 29, A: 63, Q_keV: 66.945, mode: '-', type: 'allowed', ref_mean_keV: 17.43, t12_s: 3.1913e9, br: 1 },
    { id: '147Pm', nuclide: '¹⁴⁷Pm → ¹⁴⁷Sm', Zd: 62, A: 147, Q_keV: 224.1, mode: '-', type: 'allowed', ref_mean_keV: 62.0, t12_s: 8.2780e7, br: 1 },
    { id: '32P', nuclide: '³²P → ³²S', Zd: 16, A: 32, Q_keV: 1710.66, mode: '-', type: 'allowed', ref_mean_keV: 695.0, t12_s: 1.2329e6, br: 1 },
    { id: '90Y', nuclide: '⁹⁰Y → ⁹⁰Zr', Zd: 40, A: 90, Q_keV: 2278.7, mode: '-', type: 'first_unique', ref_mean_keV: 933.7, t12_s: 2.3053e5, br: 0.9998 },
    { id: '10Be', nuclide: '¹⁰Be → ¹⁰B', Zd: 5, A: 10, Q_keV: 556.02, mode: '-', type: 'second_unique', ref_mean_keV: null, t12_s: 4.3772e13, br: 1 },
    { id: '22Na', nuclide: '²²Na → ²²Ne', Zd: 10, A: 22, Q_keV: 545.6, mode: '+', type: 'allowed', ref_mean_keV: 215.5, t12_s: 8.2e7, br: 0.9044 },
  ];

  const api = Object.freeze({ ALPHA, ME_KEV, reLnGamma, fermi, screened, finiteSize, shape, spectrum, logft, integrate, PRESETS, SHAPES: Object.keys(SHAPES) });
  if (typeof window !== 'undefined') window.TrapsBetaSpectrum = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
