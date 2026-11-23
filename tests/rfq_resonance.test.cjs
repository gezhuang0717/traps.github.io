const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../static/js/rfq-resonance-core.js');
const M = require('../static/js/mathieu-core.js');
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b} ± ${tolerance}`);
const immediate = { schedule: async () => {} };

test('Floquet monodromy recovers analytic constant focusing and unit determinant', () => {
  for (const a of [.01, .25, .81]) {
    const result = R.floquet(a, 0);
    assert.equal(result.status, 'stable'); close(result.beta, Math.sqrt(a), 2e-9);
    close(result.trace, 2 * Math.cos(Math.PI * Math.sqrt(a)), 1e-8);
    close(result.determinant, 1, 1e-10); assert.equal(result.reliable, true);
  }
});

test('numerical exponents agree with independent SciPy DOP853 reference cases', () => {
  // Independent solve_ivp of both fundamental solutions over tau=pi;
  // DOP853, rtol=2e-13, atol=2e-15. These are not values from this implementation.
  for (const [a, q, beta] of [[0, .3, .216059134936334], [.05, .4, .37513123394814846],
    [-.05, .4, .1761789835860785], [0, .8, .6885639920929445]]) {
    close(R.floquet(a, q).beta, beta, 2e-9);
    close(R.floquet(a, -q).beta, beta, 2e-9);
  }
});

test('boundaries, unstable points and higher bands never acquire aliased secular frequencies', () => {
  assert.equal(R.floquet(0, 0).status, 'boundary');
  assert.equal(R.floquet(-.1, .1).status, 'unstable');
  assert.equal(R.floquet(4, 0).status, 'outside-first-zone');
  assert.equal(R.floquet(1, 0).beta, null);
  assert.equal(R.floquet(0, 1.2).beta, null);
  const outside = R.selected({ a: 0, q: .92, f_Hz: 1e6 });
  assert.equal(outside.stable, false); assert.equal(outside.f_x_Hz, null);
});

test('selected frequencies use canonical voltage convention and scale linearly with RF frequency at fixed a,q', () => {
  const p = M.parameters(100, 1, 0, 150, 10, .7);
  const s = R.selected({ ...p, f_Hz: 700000 }), twice = R.selected({ ...p, f_Hz: 1400000 });
  close(s.f_x_Hz, 75428.4999381953, .001); close(s.f_x_Hz, s.f_y_Hz, 1e-8);
  close(s.primary_parametric_x_Hz, 2 * s.f_x_Hz, 1e-10);
  close(twice.f_x_Hz, 2 * s.f_x_Hz, 1e-8);
  const split = R.selected({ a: .05, q: .4, f_Hz: 1e6 });
  assert.ok(split.f_x_Hz > split.f_y_Hz);
});

test('grid masks every node outside both first bands and caches immutable calculation settings', async () => {
  const grid = await R.grid({ columns: 33, rows: 25 }, immediate);
  assert.ok(grid.nodes.flat().some(p => p.stable));
  for (const p of grid.nodes.flat()) {
    if (p.stable) {
      assert.equal(M.classify(p.a, p.q, 'linear').status, 'stable');
      assert.ok(p.beta_x > 0 && p.beta_x < 1 && p.beta_y > 0 && p.beta_y < 1);
    } else { assert.equal(p.beta_x, null); assert.equal(p.beta_y, null); }
  }
  assert.equal(await R.grid({ columns: 33, rows: 25 }, immediate), grid);
  assert.ok(grid.nodes.at(-1).every(p => !p.stable));
});

test('grid cancellation yields without publishing a partial field', async () => {
  let ticks = 0;
  const grid = await R.grid({ columns: 35, rows: 27 }, { cancelled: () => ticks > 0, schedule: async () => { ticks++; } });
  assert.equal(ticks, 1); assert.equal(grid, null);
});

test('fixed-Hz dipole and modulation lines respond to the RF frequency with different factors of two', async () => {
  const grid = await R.grid({ columns: 41, rows: 35 }, immediate);
  const config = { f_Hz: 1e6, dipole_Hz: 100000, parametric_Hz: 250000 };
  const first = R.overlays(grid, config), changed = R.overlays(grid, { ...config, f_Hz: 2e6 });
  close(first[0].beta, .2); close(first[2].beta, .25);
  close(changed[0].beta, .1); close(changed[2].beta, .125);
  assert.ok(first.every(l => l.segments.length > 0));
  const scaled = R.overlays(grid, { f_Hz: 2e6, dipole_Hz: 200000, parametric_Hz: 500000 });
  assert.deepEqual(scaled.map(l => l.segments), first.map(l => l.segments));
  const absent = R.overlays(grid, { ...config, dipole_Hz: 600000, parametric: false });
  assert.ok(absent.every(l => l.segments.length === 0));
});

test('candidate terms retain symmetry families and do not pretend to predict losses', async () => {
  assert.deepEqual(R.candidates('sixth').map(c => c.p + c.r), [6, 6, 6, 6]);
  assert.ok(R.candidates('fourth').every(c => c.p % 2 === 0 && c.r % 2 === 0));
  assert.deepEqual(R.candidates('coupling'), [{ p: 1, r: -1, k: 0 }]);
  assert.throws(() => R.candidates('custom', { p: 0, r: 0, k: 0 }));
  assert.throws(() => R.candidates('custom', { p: 1.2, r: 2, k: 1 }));
  const g = await R.grid({ columns: 41, rows: 35 }, immediate);
  const lines = R.overlays(g, { f_Hz: 1e6, dipole: false, parametric: false, nonlinear: true, perturbation: 'sixth' });
  assert.equal(lines.length, 4); assert.ok(lines.every(l => /requires a nonzero/.test(l.interpretation)));
  assert.ok(lines.every(l => !Object.hasOwn(l, 'loss_probability')));
});

test('contour extraction never crosses masked triangles', () => {
  const grid = { columns: 2, rows: 2, nodes: [
    [{ q: 0, a: 0, stable: true, value: 0 }, { q: 0, a: 1, stable: false, value: 0 }],
    [{ q: 1, a: 0, stable: true, value: 1 }, { q: 1, a: 1, stable: true, value: 1 }]
  ] };
  const segments = R.contour(grid, p => p.value, .5);
  assert.equal(segments.length, 1);
  close(segments[0][0].q, .5); close(segments[0][1].q, .5);
  assert.ok(segments[0].every(p => p.a <= .5));
});

test('physical dipole acceleration uses SI mass, charge, MHz/Hz and metre-to-mm conversion', () => {
  const force = R.driveAcceleration(100, 1, 1, 1e6);
  const physicalAcceleration = R.C.e / (100 * R.C.u);
  close(force * (Math.PI * 1e6) ** 2 / 1000, physicalAcceleration, 1e-8);
  close(R.driveAcceleration(200, 2, 1, 2e6), force / 4, 1e-15);
  assert.throws(() => R.driveAcceleration(100, 1.5, 1, 1e6));
});

test('finite forced trajectory matches exact off-resonance harmonic solution and independent quadrature', () => {
  const input = { a: .25, q: 0, drive_ratio: .18, acceleration_mm_per_tau2: .003, cycles: 3.2, steps: 128 };
  const result = R.drivenAxis(input);
  close(result.final_x_mm, -.02982940473061026, 2e-10);
  close(result.final_v_mm_per_tau, -.007726233596109001, 1e-10);
  close(result.rms_mm, .012329015541145428, 1e-7);
});

test('resonant harmonic motion grows with finite pulse duration, with correct linear field scaling', () => {
  const input = { a: .25, q: 0, drive_ratio: .25, acceleration_mm_per_tau2: .003, cycles: 3.2, steps: 128 };
  const a = R.drivenAxis(input), twice = R.drivenAxis({ ...input, acceleration_mm_per_tau2: .006 });
  const tau = Math.PI * input.cycles, omega = .5;
  const exact = input.acceleration_mm_per_tau2 * tau * Math.sin(omega * tau) / (2 * omega);
  close(a.final_x_mm, exact, 2e-10); close(twice.rms_mm, 2 * a.rms_mm, 1e-12);
  assert.equal(R.drivenAxis({ ...input, acceleration_mm_per_tau2: 0 }).rms_mm, 0);
});

test('spectrum contains both Floquet frequencies and preserves x/y symmetry at a=0', async () => {
  const input = { a: 0, q: .3, f_Hz: 1e6, mass_u: 100, charge: 1, field_V_m: 1, cycles: 16, samples: 19 };
  const s = await R.spectrum(input, immediate);
  assert.ok(s.rows.some(r => Math.abs(r.drive_Hz - s.f_x_Hz) < 1e-7));
  assert.ok(s.rows.some(r => Math.abs(r.drive_Hz - s.f_y_Hz) < 1e-7));
  // q and -q share Floquet frequencies, but fixed launch RF phase can make
  // finite-pulse x/y amplitudes differ. Do not assert false response equality.
  close(s.f_x_Hz, s.f_y_Hz, 1e-7);
  assert.ok(s.rows.every(r => r.x_rms_mm >= 0 && r.y_rms_mm >= 0));
  assert.match(s.limits.join(' '), /not steady-state gain or loss probability/);
  await assert.rejects(R.spectrum({ ...input, q: .95 }, immediate), /first stable zone/);
});

test('published English and Chinese labels have complete matching keys and explicit caveats', () => {
  const labels = require('../data/rfq_resonance_labels.json');
  assert.deepEqual(Object.keys(labels.en).sort(), Object.keys(labels.zh).sort());
  assert.match(labels.en.fundamental_2, /folds all higher bands/);
  assert.match(labels.en.candidate_note, /not sufficient/);
  assert.match(labels.en.spectrum_note, /two separate driven/);
});
