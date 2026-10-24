#!/usr/bin/env python3
"""Round-rod multipole table for the RFQ / multipole rod-radius rule.

Run from website/:  python3 tools/make_rfq_rod_ratios.py            (writes static/js/rfq-rod-ratios.js)
                    python3 tools/make_rfq_rod_ratios.py --check     (verify the committed file without writing)
                    python3 tools/make_rfq_rod_ratios.py --json PATH (also write the same table as JSON, e.g. for the desktop GUI)
Needs numpy and scipy (not part of the site build; the generated JavaScript file is committed).

Geometry (the convention of the owner's textbook and of the web tool): r0 is the distance from the axis to the rod SURFACE (field radius),
the rod radius is rho = ratio * r0, rod centres lie on a circle of radius Rc = r0 + rho, adjacent rods carry opposite potentials.

Physics: 2n round rods (n = N/2) have, in free space, the potential
    Phi(r, theta) = sum_k A_k (r/r0)^k cos(k theta),   k = n, 3n, 5n, ...
and the first parasitic harmonic is k = 3n (the dodecapole A6 for four rods). The rod radius that makes A_3n vanish is the 'optimal' ratio:
four rods give r/r0 = 1.14511 (Denison's condition, quoted in the textbook), eight rods 0.37216 (reported by an independent numerical study).
This script solves the 2D Laplace problem exactly with a multipole (charge-simulation) series and does not use those numbers as input.

Method: every rod is the image of rod 0 under rotation by j*2pi/N together with a sign (-1)^j, so only rod 0 needs unknown coefficients:
    Phi_0(z) = a0 ln|z - c0| + Re sum_m a_m (rho/(z - c0))^m,   Phi_j(z) = (-1)^j [a0 ln|z - c_j| + Re sum_m a_m e^{i m alpha_j} (rho/(z - c_j))^m].
The coefficients follow from Phi = +1 on the surface of rod 0 (least squares on P collocation points, residual reported). A_k then follow from an
FFT of the potential on a circle of radius 0.8 r0 inside the aperture (the optimal ratios do not change with the circle radius between 0.7 and 0.9). Convergence is certified by repeating the whole table with a larger
series (M, P) and requiring the optimal ratios to agree to 1e-6.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import tempfile

import numpy as np
import scipy.linalg as sla
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static/js/rfq-rod-ratios.js"
ROD_COUNTS = tuple(range(4, 25, 2))
VERSION = "rfq-rod-ratios-1 (2026-10-24)"


def harmonics(n_rods, ratio, M=60, P=400, circle=0.8, kmax=3):
    """Return ({k: A_k} for k = n, 3n, ..., residual) with A_k the coefficient of (r/r0)^k cos(k theta); r0 = 1."""
    rho = float(ratio)
    rc = 1.0 + rho
    alpha = 2 * np.pi * np.arange(n_rods) / n_rods
    centres = rc * np.exp(1j * alpha)
    sign = np.where(np.arange(n_rods) % 2 == 0, 1.0, -1.0)

    def design(z):
        """Columns: a0, then (Re a_m, Im a_m) for m = 1..M, summed over all rods."""
        cols = np.zeros((len(z), 2 * M + 1))
        for j in range(n_rods):
            d = z - centres[j]
            cols[:, 0] += sign[j] * np.log(np.abs(d))
            w = rho / d
            wm = np.ones_like(w)
            for m in range(1, M + 1):
                wm = wm * w
                term = wm * np.exp(1j * m * alpha[j])
                cols[:, 2 * m - 1] += sign[j] * term.real
                cols[:, 2 * m] += -sign[j] * term.imag
        return cols

    t = np.exp(1j * 2 * np.pi * (np.arange(P) + 0.5) / P)
    z_rod = centres[0] + rho * t
    A = design(z_rod)
    b = np.ones(P)
    assert np.all(np.isfinite(A))
    sol = sla.lstsq(A, b, lapack_driver="gelsy")[0]
    residual = float(np.max(np.abs(A @ sol - b)))
    theta = 2 * np.pi * np.arange(512) / 512
    phi = design(circle * np.exp(1j * theta)) @ sol
    spectrum = np.fft.rfft(phi) / len(theta) * 2
    n = n_rods // 2
    return {n * (2 * s + 1): float(spectrum[n * (2 * s + 1)].real / circle ** (n * (2 * s + 1))) for s in range(kmax)}, residual


def touching_ratio(n_rods):
    s = math.sin(math.pi / n_rods)
    return s / (1 - s)


def relative(n_rods, ratio, **kw):
    h, residual = harmonics(n_rods, ratio, **kw)
    n = n_rods // 2
    return h[3 * n] / h[n], h[5 * n] / h[n], residual


def optimal_ratio(n_rods, **kw):
    """The rod radius (units of r0) at which the first parasitic harmonic A_3n vanishes, searched below the touching ratio."""
    top = 0.97 * touching_ratio(n_rods)
    grid = np.linspace(0.05, top, 48)
    values = [relative(n_rods, r, **kw)[0] for r in grid]
    roots = [brentq(lambda r: relative(n_rods, r, **kw)[0], a, b, xtol=1e-12) for a, b, fa, fb in zip(grid[:-1], grid[1:], values[:-1], values[1:]) if fa * fb < 0]
    if not roots:
        raise RuntimeError("no sign change of A_3n below the touching ratio for %d rods" % n_rods)
    return roots[0], roots


def build(M=80, P=600):
    rows = {}
    for N in ROD_COUNTS:
        n = N // 2
        opt, roots = optimal_ratio(N, M=M, P=P)
        opt_check, _ = optimal_ratio(N, M=M + 20, P=P + 200)
        assert abs(opt - opt_check) < 1e-6, (N, opt, opt_check)
        top = min(1.5 * opt, 0.97 * touching_ratio(N))
        grid = np.linspace(0.6 * opt, top, 41)
        curve = [relative(N, r, M=M, P=P) for r in grid]
        worst = max(c[2] for c in curve)
        rows[str(N)] = dict(n=n, optimal=round(opt, 8), optimal_change_with_larger_series=float('%.2e' % abs(opt - opt_check)), curvature=round(1 / (n - 1), 8), touching=round(touching_ratio(N), 8), roots_below_touching=[round(r, 8) for r in roots],
                            residual_max=worst, curve=dict(ratio=[round(float(r), 8) for r in grid], A3n_over_An=[float("%.6e" % c[0]) for c in curve], A5n_over_An=[float("%.6e" % c[1]) for c in curve]))
    return rows


def render(rows):
    meta = dict(schema="zg-rfq-rod-ratios-v1", version=VERSION, generator="tools/make_rfq_rod_ratios.py",
                convention="r0 = axis to rod surface; rod radius = ratio * r0; rod centres at r0 + rod radius; adjacent rods opposite potential",
                harmonic="A_3n/A_n = coefficient of (r/r0)^(3n) cos(3n theta) over that of (r/r0)^n cos(n theta), free-space 2D round rods",
                numerics="multipole series M=80, P=600 collocation points; optimal ratios repeated with M=100, P=800 and agree to 1e-6 (change recorded per row)",
                numpy=np.__version__)
    payload = dict(meta, rows=rows)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    js = ("/* Generated by tools/make_rfq_rod_ratios.py - do not edit. Free-space multipole solution of 2n round rods (r0 = axis to rod surface).\n"
          "   optimal: rod radius / r0 that cancels the first parasitic harmonic A_3n (four rods: 1.14511, Denison's dodecapole condition).\n"
          "   curvature: r0/(n-1), the radius of curvature of the ideal multipole equipotential at the apex. touching: rods touch above this ratio.\n"
          "   curve: A_3n/A_n and A_5n/A_n against ratio, for estimating the parasitic harmonic of a chosen rod radius. */\n"
          "(function(host){'use strict';const data=Object.freeze(" + text + ");host.ZGRodRatios=data;if(typeof module!=='undefined'&&module.exports)module.exports=data;})(typeof window!=='undefined'?window:globalThis);\n")
    return js, payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--json")
    a = ap.parse_args()
    rows = build()
    js, payload = render(rows)
    for N, r in rows.items():
        print("%2s rods  optimal r/r0 = %.6f   curvature %.4f   touching %.4f   max residual %.1e" % (N, r["optimal"], r["curvature"], r["touching"], r["residual_max"]))
    if a.check:
        ok = OUT.exists() and OUT.read_text(encoding="utf8") == js
        print("current" if ok else "OUT OF DATE: run tools/make_rfq_rod_ratios.py")
        raise SystemExit(0 if ok else 1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=OUT.parent, suffix=".tmp")
    os.close(fd)
    Path(tmp).write_text(js, encoding="utf8")
    os.replace(tmp, OUT)
    print("wrote", OUT, len(js), "bytes, sha256", hashlib.sha256(js.encode()).hexdigest()[:16])
    if a.json:
        Path(a.json).write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf8")
        print("wrote", a.json)


if __name__ == "__main__":
    main()
