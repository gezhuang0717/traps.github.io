/* Resonance diagnostics for the FIRST common stability zone of an ideal linear
 * quadrupole. Frequencies come from the Floquet monodromy, not q/sqrt(2).
 * Candidate nonlinear contours are kinematic conditions, not computed loss.
 * NIST DLMF 28.2; March et al., doi:10.1016/0168-1176(90)85024-V;
 * Wang et al., doi:10.1016/0168-1176(93)80004-X. */
(function (host) {
  'use strict';
  const M = host.ZGMathieu || (typeof require === 'function' ? require('./mathieu-core.js') : null);
  const C = { e: 1.602176634e-19, u: 1.66053906660e-27 };
  const periodCache = new Map(), gridCache = new Map();
  const sources = ['https://dlmf.nist.gov/28.2', 'https://dlmf.nist.gov/28.17',
    'https://doi.org/10.1016/0168-1176(90)85024-V', 'https://doi.org/10.1016/0168-1176(93)80004-X'];
  function number(value, name, min = -Infinity, max = Infinity) {
    if (value === '' || value === null || value === undefined) throw Error(name);
    const x = Number(value);
    if (!Number.isFinite(x) || x < min || x > max) throw Error(name);
    return x;
  }
  function integer(value, name, min, max) {
    const x = number(value, name, min, max);
    if (!Number.isInteger(x)) throw Error(name);
    return x;
  }
  function coefficients(steps) {
    if (!periodCache.has(steps)) {
      const h = Math.PI / steps;
      periodCache.set(steps, Array.from({ length: steps }, (_, i) =>
        [2 * Math.cos(2 * i * h), 2 * Math.cos((2 * i + 1) * h), 2 * Math.cos((2 * i + 2) * h)]));
    }
    return periodCache.get(steps);
  }
  // Propagate both independent columns of the fundamental matrix. Scalar RK4
  // avoids per-step allocations when constructing thousands of grid points.
  function monodromy(a, q, steps = 256) {
    a = number(a, 'a', -2, 2); q = number(q, 'q', -1, 1);
    steps = integer(steps, 'Floquet steps', 64, 2048);
    const h = Math.PI / steps, h2 = h / 2, h6 = h / 6;
    let x = 1, v = 0, y = 0, w = 1;
    for (const c of coefficients(steps)) {
      const b0 = -a + q * c[0], bm = -a + q * c[1], b1 = -a + q * c[2];
      const k1v = b0 * x, k2x = v + h2 * k1v, k2v = bm * (x + h2 * v);
      const k3x = v + h2 * k2v, k3v = bm * (x + h2 * k2x);
      const k4x = v + h * k3v, k4v = b1 * (x + h * k3x);
      const k1w = b0 * y, k2y = w + h2 * k1w, k2w = bm * (y + h2 * w);
      const k3y = w + h2 * k2w, k3w = bm * (y + h2 * k2y);
      const k4y = w + h * k3w, k4w = b1 * (y + h * k3y);
      x += h6 * (v + 2 * k2x + 2 * k3x + k4x);
      v += h6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      y += h6 * (w + 2 * k2y + 2 * k3y + k4y);
      w += h6 * (k1w + 2 * k2w + 2 * k3w + k4w);
    }
    return { trace: x + w, determinant: x * w - y * v, matrix: [[x, y], [v, w]], steps };
  }
  function boundaries(q) {
    q = number(q, 'q', -1, 1);
    return { low: M.characteristic('a', 0, q), high: M.characteristic('b', 1, q) };
  }
  function betaFromMatrix(a, q, steps) {
    const matrix = monodromy(a, q, steps), half = matrix.trace / 2;
    if (!Number.isFinite(half) || Math.abs(half) >= 1 || Math.abs(matrix.determinant - 1) > 2e-6)
      return { ...matrix, status: 'unresolved', beta: null };
    return { ...matrix, status: 'stable', beta: Math.acos(half) / Math.PI };
  }
  function floquet(a, q, options = {}) {
    a = number(a, 'a'); q = number(q, 'q');
    const steps = integer(options.steps ?? 256, 'Floquet steps', 64, 1024);
    const base = { a, q, zone: 0, beta: null, status: 'outside-first-zone' };
    // A principal arccos folds higher bands. Never present its alias as an
    // unwrapped physical secular frequency outside this declared domain.
    if (Math.abs(q) > 1 || Math.abs(a) > 2) return base;
    const edge = boundaries(q), tol = 2e-9 * (1 + Math.abs(a));
    if (Math.abs(a - edge.low) <= tol || Math.abs(a - edge.high) <= tol)
      return { ...base, status: 'boundary' };
    if (a < edge.low || a > edge.high) return { ...base, status: a < edge.low ? 'unstable' : 'outside-first-zone' };
    const high = betaFromMatrix(a, q, steps);
    const result = { ...base, ...high, first_band_low: edge.low, first_band_high: edge.high };
    if (options.checkConvergence !== false) {
      const low = betaFromMatrix(a, q, Math.max(64, Math.floor(steps / 2)));
      result.beta_step_difference = high.beta !== null && low.beta !== null ? Math.abs(high.beta - low.beta) : null;
      result.reliable = result.beta_step_difference !== null && result.beta_step_difference < 2e-5;
      if (!result.reliable) { result.status = 'unresolved'; result.beta = null; }
    }
    return result;
  }
  function selected(input) {
    const a = number(input.a, 'a'), q = number(input.q, 'q'), f = number(input.f_Hz, 'RF frequency', Number.MIN_VALUE, 1e12);
    const x = floquet(a, q), y = floquet(-a, -q);
    const stable = x.status === 'stable' && y.status === 'stable';
    return { schema: 'rfq-resonance-point-v1', model: 'ideal linear quadrupole; first common stability zone',
      a, q, f_RF_Hz: f, stable, x, y,
      f_x_Hz: stable ? x.beta * f / 2 : null, f_y_Hz: stable ? y.beta * f / 2 : null,
      primary_parametric_x_Hz: stable ? x.beta * f : null, primary_parametric_y_Hz: stable ? y.beta * f : null,
      sources, limits: ['No higher-zone exponent unwrapping', 'No axial confinement, collisions or damping',
        'An undriven ideal quadrupole has no nonlinear resonance loss lines', 'Round-rod normalization and higher multipoles are not applied'] };
  }
  function gridOptions(input = {}) {
    const p = { q_min: number(input.q_min ?? 0, 'q min', 0, 1), q_max: number(input.q_max ?? 1, 'q max', 0, 1),
      a_min: number(input.a_min ?? -.26, 'a min', -1, 1), a_max: number(input.a_max ?? .26, 'a max', -1, 1),
      columns: integer(input.columns ?? 121, 'columns', 9, 241), rows: integer(input.rows ?? 85, 'rows', 9, 201),
      steps: integer(input.steps ?? 128, 'grid steps', 64, 512) };
    if (p.q_max <= p.q_min || p.a_max <= p.a_min) throw Error('grid bounds');
    return p;
  }
  async function grid(input = {}, control = {}) {
    const p = gridOptions(input), key = JSON.stringify(p);
    if (gridCache.has(key)) return gridCache.get(key);
    const schedule = control.schedule || (() => new Promise(resolve => setTimeout(resolve, 0)));
    const nodes = [], envelope = [];
    for (let i = 0; i < p.columns; i++) {
      if (control.cancelled?.()) return null;
      const q = p.q_min + (p.q_max - p.q_min) * i / (p.columns - 1), edge = boundaries(q);
      const top = Math.min(edge.high, -edge.low), row = [];
      envelope.push({ q, top: top > 0 ? top : null });
      for (let j = 0; j < p.rows; j++) {
        const a = p.a_min + (p.a_max - p.a_min) * j / (p.rows - 1);
        const node = { a, q, beta_x: null, beta_y: null, stable: false };
        if (top > 0 && Math.abs(a) < top - 2e-9) {
          const x = betaFromMatrix(a, q, p.steps), y = betaFromMatrix(-a, q, p.steps);
          if (x.beta !== null && y.beta !== null) { node.beta_x = x.beta; node.beta_y = y.beta; node.stable = true; }
        }
        row.push(node);
      }
      nodes.push(row);
      if (i % 4 === 3) { control.progress?.((i + 1) / p.columns); await schedule(); }
    }
    const result = { schema: 'rfq-resonance-grid-v1', ...p, nodes, envelope,
      method: 'RK4 monodromy; principal beta restricted to both first stable bands; linear contour interpolation', sources };
    if (gridCache.size >= 3) gridCache.delete(gridCache.keys().next().value);
    gridCache.set(key, result); control.progress?.(1);
    return result;
  }
  function contour(gridData, evaluate, target) {
    const segments = [];
    // Two triangles per cell avoid ambiguous saddle connectivity. Mask any
    // triangle with an unstable/unresolved vertex: no line crosses that region.
    for (let i = 0; i < gridData.columns - 1; i++) for (let j = 0; j < gridData.rows - 1; j++) {
      const corners = [gridData.nodes[i][j], gridData.nodes[i + 1][j], gridData.nodes[i + 1][j + 1], gridData.nodes[i][j + 1]];
      for (const ids of [[0, 1, 2], [0, 2, 3]]) {
        const tri = ids.map(k => corners[k]); if (!tri.every(p => p.stable)) continue;
        const values = tri.map(evaluate), crosses = [];
        for (let k = 0; k < 3; k++) {
          const next = (k + 1) % 3, v = values[k], w = values[next];
          if ((v <= target && w > target) || (w <= target && v > target)) {
            const t = (target - v) / (w - v), left = tri[k], right = tri[next];
            crosses.push({ q: left.q + t * (right.q - left.q), a: left.a + t * (right.a - left.a) });
          }
        }
        if (crosses.length === 2) segments.push(crosses);
      }
    }
    return segments;
  }
  function candidates(kind, custom = {}) {
    const pairs = { sixth: [[6, 0], [4, 2], [2, 4], [0, 6]],
      fourth: [[4, 0], [2, 2], [0, 4]], third: [[3, 0], [2, 1], [1, 2], [0, 3]], coupling: [[1, -1]] };
    if (kind === 'custom') {
      const p = integer(custom.p, 'resonance p', -8, 8), r = integer(custom.r, 'resonance r', -8, 8), k = integer(custom.k, 'resonance k', -4, 4);
      if (p === 0 && r === 0) throw Error('nonzero resonance order');
      return [{ p, r, k }];
    }
    if (!Object.hasOwn(pairs, kind)) throw Error('perturbation family');
    return pairs[kind].map(([p, r]) => ({ p, r, k: kind === 'coupling' ? 0 : 1 }));
  }
  function overlays(gridData, input) {
    const f = number(input.f_Hz, 'RF frequency', Number.MIN_VALUE, 1e12), lines = [];
    for (const family of ['dipole', 'parametric']) if (input[family] !== false) {
      const drive = number(input[family + '_Hz'], family + ' frequency', 0, 1e12);
      const beta = (family === 'dipole' ? 2 : 1) * drive / f;
      for (const axis of ['x', 'y']) lines.push({ family, axis, beta, drive_Hz: drive,
        condition: family === 'dipole' ? 'f_ex = beta_' + axis + ' f_RF / 2' : 'f_mod = beta_' + axis + ' f_RF',
        segments: beta > 0 && beta < 1 ? contour(gridData, p => p['beta_' + axis], beta) : [] });
    }
    if (input.nonlinear) for (const c of candidates(input.perturbation || 'sixth', input.custom)) {
      lines.push({ family: 'candidate', ...c, condition: `${c.p} beta_x + ${c.r} beta_y = ${2 * c.k}`,
        interpretation: 'kinematic candidate only; requires a nonzero symmetry-allowed perturbation and finite-time dynamics',
        segments: contour(gridData, p => c.p * p.beta_x + c.r * p.beta_y, 2 * c.k) });
    }
    return lines;
  }
  function driveAcceleration(massU, charge, fieldVm, fHz) {
    const mass = number(massU, 'mass', .001, 1e6), z = integer(charge, 'charge', 1, 100);
    const field = number(fieldVm, 'dipole field', 0, 1e6), f = number(fHz, 'RF frequency', 1, 1e12);
    return 4 * z * C.e * field * 1000 / (mass * C.u * (2 * Math.PI * f) ** 2);
  }
  // A finite cosine dipole pulse, starting from x=x'=0; no damping and no
  // aperture clipping. Returns the actual numerical response, not a Lorentzian.
  function drivenAxis(input) {
    const a = number(input.a, 'a', -2, 2), q = number(input.q, 'q', -1, 1);
    const ratio = number(input.drive_ratio, 'drive / RF', 0, .75), force = number(input.acceleration_mm_per_tau2, 'drive acceleration', 0, 1e6);
    const cycles = number(input.cycles ?? 48, 'pulse cycles', 1, 200), steps = integer(input.steps ?? 64, 'response steps', 32, 256);
    const count = Math.ceil(cycles * steps), h = Math.PI * cycles / count, h2 = h / 2;
    let x = 0, v = 0, area = 0, max = 0;
    const acceleration = (t, u) => (-a + 2 * q * Math.cos(2 * t)) * u + force * Math.cos(2 * ratio * t);
    for (let i = 0; i < count; i++) {
      const t = i * h, a1 = acceleration(t, x), v2 = v + h2 * a1, a2 = acceleration(t + h2, x + h2 * v);
      const v3 = v + h2 * a2, a3 = acceleration(t + h2, x + h2 * v2), v4 = v + h * a3, a4 = acceleration(t + h, x + h * v3);
      const next = x + h * (v + 2 * v2 + 2 * v3 + v4) / 6;
      v += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
      area += h * (x * x + next * next) / 2; x = next; max = Math.max(max, Math.abs(x));
      if (!Number.isFinite(x) || !Number.isFinite(v)) throw Error('response overflow');
    }
    return { final_x_mm: x, final_v_mm_per_tau: v, rms_mm: Math.sqrt(area / (Math.PI * cycles)),
      maximum_abs_mm: max, cycles, steps_per_rf_cycle: steps, integration_steps: count };
  }
  async function spectrum(input, control = {}) {
    const point = selected(input); if (!point.stable) throw Error('first stable zone required');
    const samples = integer(input.samples ?? 81, 'spectrum points', 9, 201), cycles = number(input.cycles ?? 48, 'pulse cycles', 1, 200);
    const force = driveAcceleration(input.mass_u, input.charge, input.field_V_m, point.f_RF_Hz);
    const min = number(input.min_ratio ?? .005, 'minimum drive ratio', 0, .5), max = number(input.max_ratio ?? .495, 'maximum drive ratio', 0, .5);
    if (max <= min) throw Error('spectrum range');
    const ratios = Array.from({ length: samples }, (_, i) => min + (max - min) * i / (samples - 1));
    // Explicitly sample both Floquet predictions; a coarse sweep must not miss
    // its narrow finite-time resonance merely because it lies between bins.
    for (const b of [point.x.beta / 2, point.y.beta / 2]) if (b >= min && b <= max) ratios.push(b);
    ratios.sort((a, b) => a - b);
    const rows = [], schedule = control.schedule || (() => new Promise(resolve => setTimeout(resolve, 0)));
    for (const ratio of [...new Set(ratios)]) {
      if (control.cancelled?.()) return null;
      const common = { drive_ratio: ratio, acceleration_mm_per_tau2: force, cycles, steps: input.steps ?? 64 };
      const x = drivenAxis({ ...common, a: point.a, q: point.q }), y = drivenAxis({ ...common, a: -point.a, q: -point.q });
      rows.push({ drive_Hz: ratio * point.f_RF_Hz, drive_over_RF: ratio, x_rms_mm: x.rms_mm, y_rms_mm: y.rms_mm,
        x_max_mm: x.maximum_abs_mm, y_max_mm: y.maximum_abs_mm });
      if (rows.length % 4 === 0) await schedule();
    }
    return { schema: 'rfq-dipole-finite-pulse-v1', model: 'two separate ideal dipole excitations along x and y; zero initial conditions; no damping',
      a: point.a, q: point.q, f_RF_Hz: point.f_RF_Hz, field_V_m: input.field_V_m, acceleration_mm_per_tau2: force,
      pulse_cycles: cycles, pulse_seconds: cycles / point.f_RF_Hz, steps_per_rf_cycle: input.steps ?? 64,
      f_x_Hz: point.f_x_Hz, f_y_Hz: point.f_y_Hz, rows,
      limits: ['Finite-pulse RMS displacement, not steady-state gain or loss probability', 'No nonlinear or parametric drive in this spectrum',
        'No aperture clipping; values beyond the aperture are outside the device interpretation', 'RF phase and auxiliary cosine phase start at zero'], sources };
  }
  host.ZGRFQResonance = { C, sources, monodromy, boundaries, floquet, selected, grid, contour, candidates, overlays, driveAcceleration, drivenAxis, spectrum };
  if (typeof module !== 'undefined') module.exports = host.ZGRFQResonance;
})(typeof window !== 'undefined' ? window : globalThis);
