const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../static/js/spectroscopy-core.js');

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(Number.isFinite(actual), `nonfinite result: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${expected} ± ${tolerance}; got ${actual}`);
}

const beam = { restTHz: 500, massU: 40, voltageV: 20000, charge: 1, geometry: 'collinear' };
const shift = { shiftMHz: 200, K_GHz_u: 24, F_GHz_fm2: -2, massU: 12, referenceMassU: 24 };

test('browser global and CommonJS expose the same calculation API without a DOM', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/spectroscopy-core.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.TrapsSpectroscopy).sort(), Object.keys(S).sort());
  assert.equal(context.TrapsSpectroscopy.nuclearG(3, 1.5), 2);
});

test('rms radii yield signed mean-square differences with independent first-order uncertainties', () => {
  const forward = S.radiusDifference(3, 0.1, 4, 0.2);
  close(forward.delta_fm2, -7);
  close(forward.sigma_fm2, Math.sqrt(2.92));
  const reverse = S.radiusDifference(4, 0.2, 3, 0.1);
  close(reverse.delta_fm2, 7);
  close(reverse.sigma_fm2, forward.sigma_fm2);
});

test('radius covariance has the correct sign and physical covariance bounds', () => {
  close(S.radiusDifference(3, 0.1, 4, 0.2, { covariance_fm2: 0.01 }).sigma_fm2, 1.4);
  close(S.radiusDifference(3, 0.1, 4, 0.2, { covariance_fm2: 0.02 }).sigma_fm2, 1);
  close(S.radiusDifference(3, 0.1, 4, 0.2, { covariance_fm2: -0.02 }).sigma_fm2, 2.2);
  assert.throws(() => S.radiusDifference(3, 0.1, 4, 0.2, { covariance_fm2: 0.021 }), /must not exceed/);
  assert.throws(() => S.radiusDifference(3, 0, 4, 0.2, { covariance_fm2: Number.MIN_VALUE }), /must not exceed/);
});

test('self-reference cancels its own error, while equal independent measurements do not', () => {
  assert.deepEqual(S.radiusDifference(5, 0.1, 5, 0.1, { sameReference: true }), { delta_fm2: 0, sigma_fm2: 0 });
  close(S.radiusDifference(5, 0.1, 5, 0.1).sigma_fm2, Math.SQRT2);
  close(S.radiusDifference(5, 0.1, 5, 0.1, { covariance_fm2: 0.01 }).sigma_fm2, 0);
  assert.throws(() => S.radiusDifference(5, 0.1, 5.1, 0.1, { sameReference: true }), /identical/);
  assert.throws(() => S.radiusDifference(5, 0.1, 5, 0.2, { sameReference: true }), /identical/);
});

test('close radii retain the small difference; uncertainty calculation avoids squaring huge derivatives', () => {
  const r = 5 + 2 ** -40;
  close(S.radiusDifference(r, 0, 5, 0).delta_fm2, 10 * 2 ** -40 + 2 ** -80, 1e-25);
  close(S.radiusDifference(1e100, 1e100, 1e100, 0).sigma_fm2 / 1e200, 2);
});

test('nuclear g is dimensionless in nuclear magnetons and preserves signed moments', () => {
  close(S.nuclearG(2.79284734463, 0.5), 5.58569468926);
  close(S.nuclearG(-1.5, 1.5), -1);
  assert.equal(S.nuclearG(0, 1), 0);
  assert.throws(() => S.nuclearG(0, 0), /undefined/);
  assert.throws(() => S.nuclearG(1, 0.2), /half-integer/);
});

test('analytic beta = 3/5 beam gives exact collinear doubling and anticollinear halving', () => {
  // gamma = 5/4, so kinetic energy = rest energy/4.
  const p = { ...beam, voltageV: 40 * 931494103.72 / 4 };
  const col = S.doppler(p);
  const anti = S.doppler({ ...p, geometry: 'anticollinear' });
  close(col.beta, 0.6);
  close(anti.beta, 0.6);
  close(col.labTHz, 1000);
  close(anti.labTHz, 250);
});

test('collinear and anticollinear resonance product equals the rest frequency squared', () => {
  for (const voltageV of [0, 1e-5, 20000, 1e12]) {
    const col = S.doppler({ ...beam, voltageV });
    const anti = S.doppler({ ...beam, voltageV, geometry: 'anticollinear' });
    close(col.labTHz * anti.labTHz, 250000, 1e-9);
    assert.ok(col.labTHz >= 500 && anti.labTHz <= 500);
  }
});

test('20 kV 88Sr+ agrees with the independently published qspec tutorial', () => {
  // https://patmlr.github.io/qspec/tutorials/start.html
  const result = S.doppler({ restTHz: 734.9906765, massU: 87.905612253 - 0.000548579909, voltageV: 20000,
    charge: 1, geometry: 'anticollinear' });
  close(result.beta * 299792458, 209533.6, 0.1);
  close(result.labTHz, 734.4771498, 1e-7);
});

test('Doppler retains tiny kinetic energies and finite extreme anticollinear frequencies', () => {
  const low = S.doppler({ ...beam, massU: 1, voltageV: 931494103.72e-30 });
  close(low.beta / 1e-15, Math.SQRT2, 1e-12);
  const high = S.doppler({ ...beam, massU: 1, voltageV: 931494103.72e12, geometry: 'anticollinear' });
  close(high.labTHz / 1e-10, 2.5, 1e-10);
  assert.ok(high.beta > 0 && high.beta <= 1); // beta may round to 1 at such large gamma.
  assert.deepEqual(S.doppler({ ...beam, voltageV: 0 }), { beta: 0, labTHz: 500 });
});

test('doubling charge and mass together preserves the electrostatic Doppler result', () => {
  assert.deepEqual(S.doppler({ ...beam, massU: 80, charge: 2 }), S.doppler(beam));
});

test('87Rb ground-state splitting reproduces the independently tabulated 6.83468261090429 GHz interval', () => {
  // Steck 87Rb D Line Data, Table 5; A/h = 3417.341305452145 MHz, I=3/2, J=1/2.
  const levels = S.hyperfine({ spin: 1.5, J: 0.5, A_MHz: 3417.341305452145, B_MHz: 0 });
  assert.deepEqual(levels.map(level => level.F), [1, 2]);
  close(levels[1].energy_MHz - levels[0].energy_MHz, 6834.68261090429, 2e-12);
  close(3 * levels[0].energy_MHz + 5 * levels[1].energy_MHz, 0, 2e-11);
});

test('pure quadrupole I=J=1 has analytic 5/2, -5/4, 1/4 coefficients', () => {
  const levels = S.hyperfine({ spin: 1, J: 1, A_MHz: 0, B_MHz: 4 });
  assert.deepEqual(levels, [{ F: 0, energy_MHz: 10 }, { F: 1, energy_MHz: -5 }, { F: 2, energy_MHz: 1 }]);
});

test('hyperfine degeneracy-weighted centroids vanish and I/J exchange leaves the spectrum unchanged', () => {
  for (const spin of [0, 0.5, 1, 1.5, 2.5, 5]) {
    for (const J of [0, 0.5, 1, 1.5, 3]) {
      const p = { spin, J, A_MHz: -17, B_MHz: Math.min(spin, J) >= 1 ? 3 : 0 };
      const levels = S.hyperfine(p);
      close(levels.reduce((total, level) => total + (2 * level.F + 1) * level.energy_MHz, 0), 0, 2e-11);
      assert.deepEqual(S.hyperfine({ ...p, spin: J, J: spin }), levels);
    }
  }
});

test('hyperfine level range includes J=0 or I=0 and rejects undefined quadrupole constants', () => {
  assert.deepEqual(S.hyperfine({ spin: 0, J: 0.5, A_MHz: 10, B_MHz: 0 }), [{ F: 0.5, energy_MHz: 0 }]);
  assert.deepEqual(S.hyperfine({ spin: 2.5, J: 0, A_MHz: 10, B_MHz: 0 }), [{ F: 2.5, energy_MHz: 0 }]);
  assert.throws(() => S.hyperfine({ spin: 1.5, J: 0.5, A_MHz: 10, B_MHz: 1 }), /nonzero B/);
  assert.throws(() => S.hyperfine({ spin: 0.5, J: 1.5, A_MHz: 10, B_MHz: 1 }), /nonzero B/);
  assert.throws(() => S.hyperfine({ spin: 0.3, J: 0.5, A_MHz: 10, B_MHz: 0 }), /half-integer/);
  assert.throws(() => S.hyperfine({ spin: 6000, J: 6000, A_MHz: 10, B_MHz: 0 }), /at most/);
});

test('isotope-shift inference preserves isotope-minus-reference sign and GHz-to-MHz units', () => {
  // K=24 GHz u, masses 12 and 24 u give a +1 GHz mass shift.
  // Observed +0.2 GHz minus mass shift gives -0.8 GHz; F=-2 gives +0.4 fm^2.
  assert.deepEqual(S.radiusFromShift(shift), { delta_fm2: 0.4, massShiftMHz: 1000 });
  const reverse = S.radiusFromShift({ ...shift, shiftMHz: -200, massU: 24, referenceMassU: 12 });
  assert.deepEqual(reverse, { delta_fm2: -0.4, massShiftMHz: -1000 });
});

test('equal isotope masses have zero mass shift and zero F cannot identify a radius difference', () => {
  assert.deepEqual(S.radiusFromShift({ ...shift, massU: 24 }), { delta_fm2: -0.1, massShiftMHz: 0 });
  assert.throws(() => S.radiusFromShift({ ...shift, F_GHz_fm2: 0 }), /nonzero/);
  assert.throws(() => S.radiusFromShift({ ...shift, massU: 0 }), /positive/);
});

test('King OLS recovers an exact signed line independently of point ordering', () => {
  const points = [{ x: -2, y: 7 }, { x: 0, y: 3 }, { x: 2, y: -1 }, { x: 1, y: 1 }];
  assert.deepEqual(S.kingFit(points), { slope: -2, intercept: 3, r2: 1, n: 4 });
  assert.deepEqual(S.kingFit(points.toReversed()), { slope: -2, intercept: 3, r2: 1, n: 4 });
});

test('King OLS noisy example matches hand-calculated slope, intercept and R squared', () => {
  const fit = S.kingFit([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 5 }]);
  close(fit.slope, 1.1);
  close(fit.intercept, 1.1);
  close(fit.r2, 121 / 175);
  assert.equal(fit.n, 4);
});

test('King OLS centers large coordinates and avoids squaring tiny coordinates', () => {
  const large = S.kingFit([0, 1, 2].map(x => ({ x: 1e12 + x, y: 1 + 2 * x })));
  assert.deepEqual(large, { slope: 2, intercept: 1 - 2e12, r2: 1, n: 3 });
  const tiny = S.kingFit([1, 2, 3].map(x => ({ x: x * 1e-200, y: 2 * x * 1e-200 })));
  close(tiny.slope, 2);
  close(tiny.intercept, 0, 1e-210);
  close(tiny.r2, 1);
});

test('King OLS documents the constant-y convention and rejects underdetermined x data', () => {
  assert.deepEqual(S.kingFit([{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }]),
    { slope: 0, intercept: 4, r2: 1, n: 3 });
  assert.throws(() => S.kingFit([{ x: 1, y: 1 }, { x: 2, y: 2 }]), /at least three/);
  assert.throws(() => S.kingFit([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }]), /distinct x/);
});

test('blank, nonnumeric and nonfinite values never silently become physical zeros', () => {
  for (const invalid of ['', ' ', '12', null, undefined, NaN, Infinity, -Infinity, true]) {
    assert.throws(() => S.radiusDifference(invalid, 0.1, 4, 0.1), /finite number/);
    assert.throws(() => S.nuclearG(invalid, 0.5), /finite number/);
    assert.throws(() => S.doppler({ ...beam, restTHz: invalid }), /finite number/);
    assert.throws(() => S.hyperfine({ spin: 1, J: 1, A_MHz: invalid, B_MHz: 0 }), /finite number/);
    assert.throws(() => S.radiusFromShift({ ...shift, shiftMHz: invalid }), /finite number/);
    assert.throws(() => S.kingFit([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: invalid }]), /finite number/);
  }
});

test('unphysical bounds and malformed options produce usable errors', () => {
  assert.throws(() => S.radiusDifference(-1, 0.1, 4, 0.1), /nonnegative/);
  assert.throws(() => S.radiusDifference(3, -0.1, 4, 0.1), /nonnegative/);
  assert.throws(() => S.radiusDifference(3, 0.1, 4, 0.1, null), /object/);
  assert.throws(() => S.radiusDifference(3, 0.1, 4, 0.1, { sameReference: 'true' }), /boolean/);
  assert.throws(() => S.doppler({ ...beam, massU: 0 }), /positive/);
  assert.throws(() => S.doppler({ ...beam, voltageV: -1 }), /nonnegative/);
  assert.throws(() => S.doppler({ ...beam, charge: 0.5 }), /integer charge/);
  assert.throws(() => S.doppler({ ...beam, geometry: 'sideways' }), /geometry/);
  assert.throws(() => S.doppler(null), /object/);
  assert.throws(() => S.hyperfine(null), /object/);
  assert.throws(() => S.radiusFromShift(null), /object/);
});

test('nonrepresentable calculation outputs fail instead of returning Infinity or NaN', () => {
  assert.throws(() => S.radiusDifference(1e200, 0, 1, 0), /numerical range/);
  assert.throws(() => S.doppler({ ...beam, restTHz: 1e308, voltageV: 1e20 }), /numerical range/);
  assert.throws(() => S.radiusFromShift({ ...shift, K_GHz_u: 1e308 }), /numerical range/);
});
