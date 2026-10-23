#!/usr/bin/env python3
"""Independent mpmath reference for static/js/beta-spectrum.js (same formulas, 30-digit arithmetic, adaptive quadrature).
Run:  python tests/make_beta_reference.py > tests/beta-reference.json   (needs mpmath; not part of the site build)"""
import json
import mpmath as mp

mp.mp.dps = 30
ALPHA = 1 / mp.mpf("137.035999084")
ME = mp.mpf("510.99895")

def fermi(Z, W, A, sign):
    p = mp.sqrt(W * W - 1); a = ALPHA * Z; g = mp.sqrt(1 - a * a); y = sign * a * W / p; R = ALPHA / 2 * mp.cbrt(A)
    return 2 * (g + 1) * (2 * p * R) ** (2 * (g - 1)) * mp.e ** (mp.pi * y) * abs(mp.gamma(mp.mpc(g, y))) ** 2 / mp.gamma(2 * g + 1) ** 2

def screened(Z, W, A, sign):
    V0 = mp.mpf("1.13") * ALPHA ** 2 * mp.mpf(Z) ** (mp.mpf(4) / 3); W1 = W - sign * V0
    if not W1 > 1 + mp.mpf("1e-9"):  # beta- below 1 + V0: the screening ratio is held at its threshold value (continuous spectrum)
        Wt = 1 + V0 + mp.mpf("2e-9")
        return fermi(Z, W, A, sign) * screened(Z, Wt, A, sign) / fermi(Z, Wt, A, sign)
    return mp.sqrt(W1 ** 2 - 1) * W1 / (mp.sqrt(W ** 2 - 1) * W) * fermi(Z, W1, A, sign)

def l0(Z, W, A, sign):
    a = sign * ALPHA * Z; g = mp.sqrt(1 - (ALPHA * Z) ** 2); R = ALPHA / 2 * mp.cbrt(A)
    return 1 + mp.mpf(13) / 60 * a * a - W * R * a * (41 - 26 * g) / (15 * (2 * g - 1)) - a * R * g * (17 - 2 * g) / (30 * W * (2 * g - 1))

SHAPES = {"allowed": lambda p, q: 1, "first_unique": lambda p, q: p * p + q * q, "second_unique": lambda p, q: p ** 4 + mp.mpf(10) / 3 * p * p * q * q + q ** 4}

def spec(par, W):
    Z, A, W0, sign = par["Zd"], par["A"], 1 + mp.mpf(par["Q_keV"]) / ME, 1 if par["mode"] == "-" else -1
    p = mp.sqrt(W * W - 1); q = W0 - W
    if p == 0:  # exactly at threshold the integrand has only a removable singularity; the quadrature weight there is zero
        return mp.mpf(0)
    return p * W * q * q * screened(Z, W, A, sign) * l0(Z, W, A, sign) * SHAPES[par["type"]](p, q)

def moments(par):
    W0 = 1 + mp.mpf(par["Q_keV"]) / ME
    # W = lo + (hi-lo) t^2 removes the square-root behaviour at an interval end; beta- Rose screening has a kink at W = 1 + V0 (screened momentum starts at 0)
    V0 = mp.mpf("1.13") * ALPHA ** 2 * mp.mpf(par["Zd"]) ** (mp.mpf(4) / 3)
    edges = [mp.mpf(1), 1 + V0, W0] if par["mode"] == "-" and 1 + V0 < W0 else [mp.mpf(1), W0]
    def integral(k):
        tot = mp.mpf(0)
        for lo, hi in zip(edges[:-1], edges[1:]):
            tot += mp.quad(lambda t: spec(par, lo + (hi - lo) * t * t) * (lo + (hi - lo) * t * t - 1) ** k * 2 * (hi - lo) * t, [0, 0.5, 1])
        return tot
    n0, n1 = integral(0), integral(1)
    return {"f": float(n0), "mean_keV": float(n1 / n0 * ME)}

out = {"generator": "tests/make_beta_reference.py (mpmath %s, 30 digits)" % mp.__version__, "fermi": [], "l0": [], "spectra": []}
for Z, A, W, s in [(2, 3, 1.01, 1), (2, 3, 1.036, 1), (29, 63, 1.05, 1), (29, 63, 1.1, 1), (29, 63, 1.3, 1), (82, 208, 1.5, 1), (82, 208, 3.0, 1), (10, 22, 1.4, -1), (62, 147, 1.2, -1), (7, 14, 1.2, 1), (100, 250, 2.0, 1)]:
    W = mp.mpf(W)
    out["fermi"].append({"Z": Z, "A": A, "W": float(W), "sign": s, "F": float(fermi(Z, W, A, s)), "F_screened": float(screened(Z, W, A, s)), "L0": float(l0(Z, W, A, s))})
for par in [dict(Zd=2, A=3, Q_keV=18.5906, mode="-", type="allowed"), dict(Zd=29, A=63, Q_keV=66.945, mode="-", type="allowed"), dict(Zd=7, A=14, Q_keV=156.476, mode="-", type="allowed"),
            dict(Zd=40, A=90, Q_keV=2278.7, mode="-", type="first_unique"), dict(Zd=5, A=10, Q_keV=556.02, mode="-", type="second_unique"), dict(Zd=10, A=22, Q_keV=545.6, mode="+", type="allowed")]:
    out["spectra"].append({**par, **moments(par)})
print(json.dumps(out, indent=1))
