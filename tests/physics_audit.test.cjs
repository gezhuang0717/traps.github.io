// Independent invariants and numerical regressions from the scientific demo audit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const P = require('../static/js/physics.js');

const ion = (id, mass, sigma = 0) => ({
  label: id, q: 1, sign: 1, ionMassU: mass, value: P.primitive(id, mass, sigma)
});
const relative = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.abs(expected), `${actual} != ${expected}`);

test('legacy first-region classifier is invariant under RF phase and charge reversal', () => {
  for (const a of [-.3, -.15, 0, .15, .3]) for (const q of [.1, .4, .7, .9, .95]) {
    assert.equal(P.mathieuStable(a, q), P.mathieuStable(a, -q));
    assert.equal(P.mathieuStable(a, q), P.mathieuStable(-a, -q));
  }
  const positive = ion('positive', 100), negative = { ...positive, sign: -1 };
  const p = P.mathieuParameters(positive, 3, 150, 10, .7);
  const n = P.mathieuParameters(negative, 3, 150, 10, .7);
  assert.equal(P.mathieuStable(p.a, p.q), true);
  assert.equal(P.mathieuStable(n.a, n.q), true);
  assert.equal(P.mathieuStable(0, 0), false);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(P.mathieuStable(0, value), false);
});

test('first-region RF-only edge uses characteristic values without six-digit truncation', () => {
  // The root b1(q)=0 is approximately 0.908046333734; these points straddle it.
  assert.equal(P.mathieuStable(0, .9080462), true);
  assert.equal(P.mathieuStable(0, .9080465), false);
});

test('no light gives zero scattering and no defined cooling equilibrium', () => {
  const p = { gamma: 2 * Math.PI * 20e6, delta: -Math.PI * 20e6,
    s0: 0, lambda: 397e-9, massKg: 40 * P.C.uKg, eta: 1 / 3 };
  const r = P.molassesTheory(p);
  assert.equal(r.beta, 0); assert.equal(r.D0, 0); assert.equal(r.Rtot, 0);
  assert.equal(r.T, Infinity); assert.equal(r.dampingTime, Infinity);
  const velocities = [-10, 0, 17];
  assert.equal(P.molassesStep(velocities, p, 1e-4, P.rng(123)), 0);
  assert.deepEqual(velocities, [-10, 0, 17]);
});

test('repeating a mass-limited calibrant does not reduce its shared mass uncertainty', () => {
  const c = { ion: ion('shared', 100, 1), nc: 1e6, snc: 0, nm: 100 };
  const one = P.trapCalibration([c]), two = P.trapCalibration([c, c]);
  relative(two.B, one.B); relative(two.sB, one.sB);
  assert.equal(two.correlatedMasses, true);
  assert.equal(two.chi2, null); assert.equal(two.birge, null);
});

test('repeated calibrants reduce independent frequency noise while retaining common mass error', () => {
  const c = { ion: ion('shared', 100, 1), nc: 1e6, snc: 1000, nm: 100 };
  const cal = P.trapCalibration([c, c]);
  const expected = cal.B * Math.hypot(1 / 100, 1000 / 1e6 / Math.SQRT2);
  relative(cal.sB, expected);
  // For this same target ion, the common mass cancels in the frequency ratio.
  relative(P.calibratedPenning(c.ion, cal).snc, 1000 / Math.SQRT2);
});

test('arithmetic field-mean uncertainty agrees with a finite-difference primitive Jacobian', () => {
  const specs = [
    { ion: ion('cal-a', 100, 1), nc: 1e6, snc: 1000, nm: 100 },
    { ion: ion('cal-b', 200, 2), nc: 4e6, snc: 5000, nm: 100 }
  ];
  const target = ion('target', 150, .3), cal = P.trapCalibration(specs);
  const input = [100, 200, 150, 1e6, 4e6], sigma = [1, 2, .3, 1000, 5000];
  // The nominal estimator is Σ a_i νc,i m_i / m_target; a_i are fixed for propagation.
  const estimator = x => (cal.weights[0] * x[3] * x[0] + cal.weights[1] * x[4] * x[1]) / x[2];
  const variance = input.reduce((sum, value, i) => {
    const h = value * 1e-5, plus = input.slice(), minus = input.slice();
    plus[i] += h; minus[i] -= h;
    const derivative = (estimator(plus) - estimator(minus)) / (2 * h);
    return sum + (derivative * sigma[i]) ** 2;
  }, 0);
  const f = P.calibratedPenning(target, cal);
  relative(f.nc, estimator(input));
  relative(f.snc, Math.sqrt(variance), 2e-9);
});

test('unequal field estimates still cancel a shared target mass exactly', () => {
  const same = ion('shared', 100, 2);
  const specs = [
    { ion: same, nc: 1e6, snc: 100, nm: 100 },
    { ion: same, nc: 2e6, snc: 250, nm: 100 }
  ];
  const cal = P.trapCalibration(specs), result = P.calibratedPenning(same, cal);
  const expected = Math.hypot(...specs.map((c, i) => cal.weights[i] * c.snc));
  relative(result.snc, expected);
});

test('ideal calibrated magnetron frequency remains positive below subtraction precision', () => {
  const c = { ion: ion('small-mode', 100), nc: 1e6, snc: 0, nm: 1e-12 };
  const f = P.calibratedPenning(c.ion, P.trapCalibration([c], 'ideal'));
  assert.equal(f.stable, true);
  relative(f.nm, c.nm);
  relative(2 * f.np * f.nm, f.nz ** 2);
});

test('signed-charge TOF calibration recovers neutral mass for positive and negative targets', () => {
  const data = file => JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data', file), 'utf8'));
  const cat = P.catalogue(data('nuclear-states.json'), data('ame2020.json'));
  const reference = cat.resolve('133Cs'), delay = 42, referenceTime = 200;
  for (const text of ['85Rb+', '85Rb-', '85Rb2-', '85Rb2+']) {
    const target = cat.resolve(text), signed = target.sign * target.q;
    const time = delay + (referenceTime - delay) * Math.sqrt((target.ionMassU / target.q) / (reference.ionMassU / reference.q));
    const result = P.calibration(time, referenceTime, reference, signed, delay, .001, .001, .001);
    relative(result.atomicMassU, target.M); relative(result.ionMassU, target.ionMassU);
    assert.equal(result.signedCharge, signed); assert.ok(result.uncertaintyU > 0);
  }
  for (const q of [0, .5, NaN, Infinity]) assert.throws(() => P.calibration(200, 200, reference, q, delay));
});

test('PI-ICR caller preserves catalogue negative-ion mass in manual and calibrated frequencies', () => {
  const data = file => JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data', file), 'utf8'));
  const cat = P.catalogue(data('nuclear-states.json'), data('ame2020.json'));
  const negative = cat.resolve('133Cs-'), positive = cat.resolve('133Cs+');
  const source = fs.readFileSync(path.join(__dirname, '../static/js/games.js'), 'utf8');
  const fn = source.match(/function freqs\(sp\) \{([^\n]*)\}/)[0];
  const run = new Function('P', 'calOf', 'V', 'sp', fn + '; return freqs(sp);');
  const manual = run(P, () => null, key => ({ B: 7, u0: -100, dch: 26.05 })[key], negative);
  assert.equal(manual.stable, true); relative(manual.nc, P.frequency(negative, 7));
  assert.ok(manual.nc < P.frequency(positive, 7));
  const cal = P.trapCalibration([{ ion: positive, nc: 808542.788, nm: 1653.063 }]);
  relative(run(P, () => cal, () => 0, negative).nc, P.calibratedPenning(negative, cal).nc);
  const piSource = source.slice(source.indexOf('function piicrGame('));
  assert.doesNotMatch(piSource, /(?:sp|ref|s)\.M\s*-\s*(?:sp|ref|s)\.q\s*\*/);
});

test('TOF-ICR mass guess uses the charge sign and MRTOF workbench passes it to calibration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../static/js/games.js'), 'utf8');
  const expression = source.match(/const mG = (.*?), dm =/)[1];
  const guess = new Function('ZQ', 'SIGN_ION', 'QE', 'B', 'NU_REF', 'sl', 'U', 'ME', 'return ' + expression);
  const mass = 100, sign = -1, charge = 2, ionic = mass - sign * charge * P.C.electronU;
  const nc = charge * P.C.e * 7 / (2 * Math.PI * ionic * P.C.uKg);
  assert.ok(Math.abs(guess(charge, sign, P.C.e, 7, nc, { value: 0 }, P.C.uKg, 9.1093837e-31) - mass) < 2e-10);
  const workbench = fs.readFileSync(path.join(__dirname, '../static/js/workbenches.js'), 'utf8');
  assert.match(workbench, /P\.calibration\([^;]+\(ions\[0\]\.sign \|\| 1\) \* ions\[0\]\.q/);
  assert.match(workbench, /c\.ionMassU \/ ions\[0\]\.q/);
});
