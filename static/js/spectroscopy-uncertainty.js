/* First-order standard uncertainties and correlated functional-model King fits.
 * Conventions: delta nu = nu_isotope - nu_reference; masses in u, shifts MHz,
 * K GHz u, F GHz/fm^2. No missing standard uncertainty is replaced with zero.
 * Primary references: https://physics.nist.gov/cuu/Uncertainty/combination.html
 * https://arxiv.org/html/2404.13369v2 (leading-order isotope-shift equation).
 * King fit profiles latent true abscissae with known Gaussian covariance:
 * Q(a,b)=(y-a-bx)' [Cyy+b^2 Cxx-b(Cxy+Cyx)]^-1 (y-a-bx).
 * This is a functional errors-in-variables fit, not OLS or a marginal likelihood.
 */
(function (host) {
  'use strict';
  const SHIFT_ORDER = Object.freeze(['shiftMHz', 'K_GHz_u', 'F_GHz_fm2', 'massU', 'referenceMassU']);
  function fail(code, message) { const e = new RangeError(message); e.code = code; throw e; }
  function number(x, name) { if (typeof x !== 'number' || !Number.isFinite(x)) fail('INPUT_FINITE', name + ' must be finite'); return x; }
  function positive(x, name) { number(x, name); if (!(x > 0)) fail('INPUT_POSITIVE', name + ' must be positive'); return x; }
  function sigma(x, name) { if (x === null || x === undefined || x === '') return null; number(x, name); if (x < 0) fail('UNCERTAINTY_NEGATIVE', name + ' must be nonnegative'); return x; }
  function finiteResult(x) { if (!Number.isFinite(x)) fail('NUMERICAL_RANGE', 'Calculation outside finite numerical range'); return x === 0 ? 0 : x; }
  const zeros = (n, m = n) => Array.from({ length: n }, () => Array(m).fill(0));
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const mv = (a, x) => a.map(r => dot(r, x));
  function covariance(input, n) {
    if (!Array.isArray(input) || input.length !== n || input.some(r => !Array.isArray(r) || r.length !== n)) fail('COVARIANCE_SHAPE', 'Covariance has incorrect dimensions');
    const c = input.map(r => r.map(v => number(v, 'covariance entry')));
    const scales = c.map((r, i) => { if (r[i] < 0) fail('COVARIANCE_NOT_PSD', 'Covariance diagonal must be nonnegative'); return Math.sqrt(r[i]); });
    const corr = zeros(n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      const scale = scales[i] * scales[j];
      if (scale === 0) {
        if (c[i][j] !== 0 || c[j][i] !== 0) fail('COVARIANCE_NOT_PSD', 'Zero-variance coordinate has nonzero covariance');
      } else {
        if (Math.abs(c[i][j] - c[j][i]) > 1e-11 * scale) fail('COVARIANCE_ASYMMETRIC', 'Covariance must be symmetric');
        corr[i][j] = corr[j][i] = (c[i][j] + c[j][i]) / (2 * scale);
        if (Math.abs(corr[i][j]) > 1 + 1e-11) fail('COVARIANCE_NOT_PSD', 'Correlation magnitude exceeds one');
      }
    }
    // Unit-scaled semidefinite Cholesky supports exact shared-reference rank loss.
    const l = zeros(n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let z = corr[i][j];
      for (let k = 0; k < j; k++) z -= l[i][k] * l[j][k];
      if (i === j) { if (z < -2e-10) fail('COVARIANCE_NOT_PSD', 'Covariance is not positive semidefinite'); l[i][j] = Math.sqrt(Math.max(0, z)); }
      else if (l[j][j] > 1e-7) l[i][j] = z / l[j][j];
      else if (Math.abs(z) > 2e-9) fail('COVARIANCE_NOT_PSD', 'Covariance is not positive semidefinite');
    }
    return c.map((r, i) => r.map((v, j) => (v + c[j][i]) / 2));
  }
  function diagonal(sigmas) { const c = zeros(sigmas.length); sigmas.forEach((s, i) => { c[i][i] = finiteResult(s * s); }); return c; }
  function propagate(j, c) {
    return j.map(a => j.map(b => {
      let v = 0;
      for (let i = 0; i < a.length; i++) for (let k = 0; k < b.length; k++) v += a[i] * c[i][k] * b[k];
      return finiteResult(v);
    }));
  }
  function varianceToSigma(v) { if (v < -1e-12) fail('NUMERICAL_VARIANCE', 'Propagated variance became negative'); return Math.sqrt(Math.max(0, v)); }
  function uncertainty(p, order, jacobian) {
    const sigmas = order.map(key => sigma(p['sigma_' + key], 'sigma_' + key));
    const unknown = order.filter((_, i) => sigmas[i] === null);
    const c = p.covariance !== undefined && p.covariance !== null ? covariance(p.covariance, order.length) : unknown.length ? null : diagonal(sigmas);
    return { c, sigmas: c ? c.map((r, i) => Math.sqrt(r[i])) : sigmas, unknown: c ? [] : unknown, sigma: c ? varianceToSigma(propagate([jacobian], c)[0][0]) : null,
      model: c ? p.covariance ? 'first-order-full-covariance' : 'first-order-independent-inputs' : 'unknown-incomplete-input-uncertainties' };
  }
  function shiftToRadius(p) {
    SHIFT_ORDER.forEach(key => number(p[key], key));
    positive(p.massU, 'massU'); positive(p.referenceMassU, 'referenceMassU');
    const { shiftMHz: d, K_GHz_u: k, F_GHz_fm2: f, massU: m, referenceMassU: r } = p;
    if (f === 0) fail('FIELD_FACTOR_ZERO', 'Nonzero field-shift factor is required');
    const inv = (r - m) / m / r;
    const massShiftMHz = finiteResult(1000 * k * inv);
    const delta = finiteResult((d / 1000 - k * inv) / f);
    const j = [1 / (1000 * f), -inv / f, -delta / f, k / (f * m * m), -k / (f * r * r)].map(finiteResult);
    const u = uncertainty(p, SHIFT_ORDER, j);
    const warnings = [];
    if (u.unknown.length) warnings.push({ code: 'MISSING_UNCERTAINTY', fields: u.unknown });
    if (u.sigmas[2] !== null && u.sigmas[2] > 0 && Math.abs(f) <= 5 * u.sigmas[2]) warnings.push({ code: 'FIELD_FACTOR_NEAR_ZERO', ratio: Math.abs(f) / u.sigmas[2] });
    if (u.sigmas[3] !== null && u.sigmas[3] / m > 0.01 || u.sigmas[4] !== null && u.sigmas[4] / r > 0.01) warnings.push({ code: 'FIRST_ORDER_MASS_LIMIT' });
    if (p.sameReference === true) {
      if (d !== 0 || m !== r || u.sigmas[0] !== null && u.sigmas[0] !== 0 ||
          u.sigmas[3] !== null && u.sigmas[4] !== null && u.sigmas[3] !== u.sigmas[4]) fail('SAME_REFERENCE_CONFLICT', 'Same-reference identity requires zero shift and identical mass inputs');
      if (p.covariance && (u.c[0].some(v => v !== 0) || Math.abs(u.c[3][3] - u.c[3][4]) > 1e-12 * Math.max(u.c[3][3], 1e-300) ||
          Math.abs(u.c[4][4] - u.c[3][4]) > 1e-12 * Math.max(u.c[4][4], 1e-300))) fail('SAME_REFERENCE_CONFLICT', 'Same-reference covariance must encode the same mass and zero shift');
      return { delta_fm2: 0, massShiftMHz: 0, sigma_fm2: 0, jacobian: Object.fromEntries(SHIFT_ORDER.map(key => [key, 0])),
        covariance_order: SHIFT_ORDER, uncertainty_model: 'exact-same-reference-identity', warnings: [] };
    }
    return { delta_fm2: delta, massShiftMHz, sigma_fm2: u.sigma, jacobian: Object.fromEntries(SHIFT_ORDER.map((key, i) => [key, j[i]])),
      covariance_order: SHIFT_ORDER, input_covariance: u.c, uncertainty_model: u.model, warnings };
  }
  function radiusFromDifference(p) {
    const delta = number(p.delta_fm2, 'delta_fm2');
    const ref = positive(p.referenceRadius_fm, 'referenceRadius_fm');
    const square = ref * ref + delta;
    if (!(square > 0)) fail('RADIUS_SQUARE_NONPOSITIVE', 'Inferred squared rms radius must be positive');
    const radius = Math.sqrt(square), order = ['delta_fm2', 'referenceRadius_fm'];
    const j = [1 / (2 * radius), ref / radius], u = uncertainty(p, order, j);
    const warnings = u.unknown.length ? [{ code: 'MISSING_UNCERTAINTY', fields: u.unknown }] : [];
    if (u.sigma !== null && u.sigma > 0.1 * radius) warnings.push({ code: 'FIRST_ORDER_RADIUS_LIMIT' });
    return { radius_fm: finiteResult(radius), sigma_fm: u.sigma, jacobian: Object.fromEntries(order.map((k, i) => [k, j[i]])), uncertainty_model: u.model, warnings };
  }
  // Input covariance order: all shiftX_MHz, all shiftY_MHz, all massU, referenceMassU.
  // Output covariance order: all modified x, all modified y (MHz u).
  function modifiedKingData(p) {
    const points = p.points, ref = positive(p.referenceMassU, 'referenceMassU');
    if (!Array.isArray(points) || points.length < 3 || points.length > 50) fail('KING_POINT_COUNT', 'Three to fifty isotope pairs required');
    const n = points.length, size = 3 * n + 1, j = zeros(2 * n, size), values = [], sigmas = [];
    points.forEach((q, i) => { number(q.shiftX_MHz, 'shiftX_MHz'); number(q.shiftY_MHz, 'shiftY_MHz'); positive(q.massU, 'massU');
      const inv = (ref - q.massU) / q.massU / ref;
      if (inv === 0) fail('KING_REFERENCE_POINT', 'Reference isotope has undefined modified shift and must be excluded');
      for (let axis = 0; axis < 2; axis++) {
        const shift = axis ? q.shiftY_MHz : q.shiftX_MHz, row = axis * n + i;
        values[row] = finiteResult(shift / inv);
        j[row][axis * n + i] = 1 / inv;
        j[row][2 * n + i] = shift / (inv * inv * q.massU * q.massU);
        j[row][3 * n] = -shift / (inv * inv * ref * ref);
      }
    });
    ['shiftX_MHz', 'shiftY_MHz', 'massU'].forEach(key => points.forEach(q => sigmas.push(sigma(q['sigma_' + key], 'sigma_' + key))));
    sigmas.push(sigma(p.sigma_referenceMassU, 'sigma_referenceMassU'));
    const c = p.covariance != null ? covariance(p.covariance, size) : sigmas.includes(null) ? null : diagonal(sigmas);
    const out = c ? covariance(propagate(j, c), 2 * n) : null;
    return { points: points.map((q, i) => ({ x: values[i], y: values[n + i], sx: out ? varianceToSigma(out[i][i]) : null,
      sy: out ? varianceToSigma(out[n + i][n + i]) : null, label: q.label || '' })), covariance: out, covariance_order: 'all-x-then-all-y',
      jacobian: j, units: 'MHz u', uncertainty_model: c ? 'first-order-shared-mass-reference-covariance' : 'unknown-incomplete-input-uncertainties',
      warnings: c ? [{ code: 'FIRST_ORDER_MODIFIED_SHIFT', message: 'Mass denominator linearization requires uncertainty small compared with inverse-mass separation' }] : [{ code: 'MISSING_UNCERTAINTY' }] };
  }
  function solve(c, rhs) {
    const n = c.length, scales = c.map((r, i) => Math.sqrt(r[i]));
    if (scales.some(v => !(v > 0))) fail('FIT_SINGULAR_COVARIANCE', 'Residual covariance must be positive definite');
    const l = zeros(n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let z = c[i][j] / scales[i] / scales[j];
      for (let k = 0; k < j; k++) z -= l[i][k] * l[j][k];
      if (i === j) { if (!(z > 1e-12)) fail('FIT_SINGULAR_COVARIANCE', 'Residual covariance is singular or poorly conditioned'); l[i][j] = Math.sqrt(z); }
      else l[i][j] = z / l[j][j];
    }
    const a = rhs.map((v, i) => v / scales[i]);
    for (let i = 0; i < n; i++) { for (let j = 0; j < i; j++) a[i] -= l[i][j] * a[j]; a[i] /= l[i][i]; }
    for (let i = n - 1; i >= 0; i--) { for (let j = i + 1; j < n; j++) a[i] -= l[j][i] * a[j]; a[i] /= l[i][i]; }
    return a.map((v, i) => v / scales[i]);
  }
  function golden(fn, lo, hi) {
    const t = (Math.sqrt(5) - 1) / 2;
    let a = hi - t * (hi - lo), b = lo + t * (hi - lo), fa = fn(a), fb = fn(b);
    for (let i = 0; i < 90; i++) {
      if (fa < fb) { hi = b; b = a; fb = fa; a = hi - t * (hi - lo); fa = fn(a); }
      else { lo = a; a = b; fa = fb; b = lo + t * (hi - lo); fb = fn(b); }
    }
    return fa < fb ? a : b;
  }
  function kingFit(p) {
    const points = p.points;
    if (!Array.isArray(points) || points.length < 3 || points.length > 50) fail('KING_POINT_COUNT', 'Three to fifty King points required');
    const n = points.length, x = points.map(q => number(q.x, 'x')), y = points.map(q => number(q.y, 'y'));
    let c, model;
    if (p.covariance != null) { c = covariance(p.covariance, 2 * n); model = 'full-known-observation-covariance'; }
    else {
      c = zeros(2 * n); model = 'known-point-errors-independent-between-points';
      points.forEach((q, i) => { const sx = sigma(q.sx, 'sx'), sy = sigma(q.sy, 'sy');
        if (sx === null || sy === null) fail('MISSING_UNCERTAINTY', 'Every King point requires known sx and sy or a full covariance');
        const rho = q.rho_xy == null ? 0 : number(q.rho_xy, 'rho_xy');
        if (Math.abs(rho) > 1) fail('COVARIANCE_NOT_PSD', 'rho_xy must be in [-1,1]');
        c[i][i] = sx * sx; c[n + i][n + i] = sy * sy; c[i][n + i] = c[n + i][i] = rho * sx * sy;
      });
      c = covariance(c, 2 * n);
    }
    const x0 = x.reduce((s, v) => s + v / n, 0), y0 = y.reduce((s, v) => s + v / n, 0);
    const xs = Math.max(...x.map(v => Math.abs(v - x0))), ys = Math.max(...y.map(v => Math.abs(v - y0)), ...c.slice(n).map((r, i) => Math.sqrt(r[n + i])));
    if (!(xs > 0) || !(ys > 0)) fail('FIT_NOT_IDENTIFIABLE', 'King fit needs nonzero coordinate span');
    const X = x.map(v => (v - x0) / xs), Y = y.map(v => (v - y0) / ys), one = Array(n).fill(1);
    const C = c.map((r, i) => r.map((v, j) => v / (i < n ? xs : ys) / (j < n ? xs : ys)));
    function profile(theta, details = false) {
      const co = Math.cos(theta), si = Math.sin(theta), V = zeros(n), z = Y.map((v, i) => co * v - si * X[i]);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) V[i][j] = co * co * C[n + i][n + j] + si * si * C[i][j] - co * si * (C[i][n + j] + C[n + i][j]);
      const wi = solve(V, one), intercept = dot(wi, z) / dot(one, wi), residual = z.map(v => v - intercept), q = dot(residual, solve(V, residual));
      return details ? { q, intercept } : q;
    }
    // A full line-angle scan avoids choosing an OLS-seeded local branch.
    const steps = 360, grid = Array.from({ length: steps }, (_, i) => -Math.PI / 2 + i * Math.PI / steps);
    const scores = grid.map(t => { try { return profile(t); } catch (e) { if (e.code === 'FIT_SINGULAR_COVARIANCE') return Infinity; throw e; } });
    const candidates = [];
    for (let i = 0; i < steps; i++) if (Number.isFinite(scores[i]) && scores[i] <= scores[(i + steps - 1) % steps] && scores[i] <= scores[(i + 1) % steps]) {
      const safe = t => { try { return profile(t); } catch (e) { if (e.code === 'FIT_SINGULAR_COVARIANCE') return Infinity; throw e; } };
      const theta = golden(safe, grid[i] - Math.PI / steps, grid[i] + Math.PI / steps);
      candidates.push({ theta, q: safe(theta) });
    }
    candidates.sort((a, b) => a.q - b.q);
    if (!candidates.length) fail('FIT_SINGULAR_COVARIANCE', 'No nonsingular fit branch found');
    const best = candidates[0];
    if (Math.abs(Math.cos(best.theta)) < 1e-7) fail('FIT_VERTICAL', 'Best line is vertical; finite slope/intercept not identifiable');
    if (candidates.slice(1).some(q => q.q - best.q < 1)) fail('FIT_MULTIMODAL', 'Multiple line orientations lie within delta chi-square one');
    const b = Math.tan(best.theta), a = profile(best.theta, true).intercept / Math.cos(best.theta), V = zeros(n), D = zeros(n), DD = zeros(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      V[i][j] = C[n + i][n + j] + b * b * C[i][j] - b * (C[i][n + j] + C[n + i][j]);
      D[i][j] = 2 * b * C[i][j] - C[i][n + j] - C[n + i][j]; DD[i][j] = 2 * C[i][j];
    }
    const residual = Y.map((v, i) => v - a - b * X[i]), w = solve(V, residual), w1 = solve(V, one), wx = solve(V, X), Dw = mv(D, w), wDw = solve(V, Dw);
    const h00 = dot(one, w1), h01 = dot(one, wx) + dot(w1, Dw);
    const h11 = dot(X, wx) + 2 * dot(wx, Dw) + dot(Dw, wDw) - 0.5 * dot(w, mv(DD, w));
    const det = h00 * h11 - h01 * h01;
    if (!(h00 > 0 && h11 > 0 && det > 1e-12 * h00 * h11)) fail('FIT_NOT_IDENTIFIABLE', 'Local fit curvature does not identify two parameters');
    const covNorm = [[h11 / det, -h01 / det], [-h01 / det, h00 / det]], transform = [[ys, -ys * x0 / xs], [0, ys / xs]], outCov = propagate(transform, covNorm);
    const slope = finiteResult(b * ys / xs), intercept = finiteResult(y0 + ys * a - slope * x0);
    return { slope, intercept, sigma_slope: varianceToSigma(outCov[1][1]), sigma_intercept: varianceToSigma(outCov[0][0]), parameter_covariance: outCov,
      parameter_order: ['intercept', 'slope'], chi2: Math.max(0, best.q), dof: n - 2, n,
      residuals: x.map((v, i) => y[i] - intercept - slope * v), observation_covariance: c,
      method: 'correlated-functional-errors-in-variables-profile-chi-square', uncertainty_model: model,
      warnings: [{ code: 'LOCAL_CURVATURE_UNCERTAINTY', message: 'Parameter covariance is local inverse curvature with known errors, no chi-square rescaling; higher-order or strongly non-Gaussian uncertainty requires a separate analysis' }] };
  }
  const api = Object.freeze({ SHIFT_ORDER, shiftToRadius, radiusFromDifference, modifiedKingData, kingFit, validateCovariance: covariance });
  host.TrapsSpectroscopyUncertainty = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
