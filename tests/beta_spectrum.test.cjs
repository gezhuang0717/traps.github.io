const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const B = require('../static/js/beta-spectrum.js'), ref = JSON.parse(fs.readFileSync('tests/beta-reference.json', 'utf8'));
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test('Fermi function, Rose screening and finite-size factor match the 30-digit mpmath reference', () => {
  for (const c of ref.fermi) {
    assert.ok(rel(B.fermi(c.Z, c.W, c.A, c.sign), c.F) < 2e-9, `F Z=${c.Z} W=${c.W}: ${B.fermi(c.Z, c.W, c.A, c.sign)} vs ${c.F}`);
    assert.ok(rel(B.screened(c.Z, c.W, c.A, c.sign), c.F_screened) < 2e-9, `screened Z=${c.Z} W=${c.W}`);
    assert.ok(rel(B.finiteSize(c.Z, c.W, c.A, c.sign), c.L0) < 1e-12, `L0 Z=${c.Z}`);
  }
});
test('spectrum moments (normalisation f and mean energy) match the independent adaptive quadrature', () => {
  for (const c of ref.spectra) {
    const s = B.spectrum({ Zd: c.Zd, A: c.A, Q_keV: c.Q_keV, mode: c.mode, type: c.type });
    assert.ok(rel(s.f, c.f) < 1e-7, `f Z=${c.Zd} ${c.type}: ${s.f} vs ${c.f}`);
    assert.ok(rel(s.mean_keV, c.mean_keV) < 1e-7, `mean Z=${c.Zd} ${c.type}: ${s.mean_keV} vs ${c.mean_keV}`);
  }
});
test('limits: no Coulomb field gives F = 1, the plotted spectrum is normalised, and the neutrino carries the rest of Q', () => {
  assert.ok(rel(B.fermi(1e-9, 1.5, 3, 1), 1) < 1e-6 || Math.abs(B.fermi(1e-9, 1.5, 3, 1) - 1) < 1e-5);
  const s = B.spectrum({ Zd: 29, A: 63, Q_keV: 66.945, mode: '-', type: 'allowed', points: 600 });
  let area = 0; for (let i = 1; i < s.E_keV.length; i++) area += 0.5 * (s.N_per_keV[i] + s.N_per_keV[i - 1]) * (s.E_keV[i] - s.E_keV[i - 1]);
  assert.ok(Math.abs(area - 1) < 2e-3, 'area ' + area);
  assert.ok(Math.abs(s.mean_keV + s.mean_nu_keV - 66.945) < 1e-6);   // <E_e> + <E_nu> = Q
  assert.ok(s.E_keV[0] < 1e-3 && Math.abs(s.E_keV.at(-1) - 66.945) < 1e-3 && s.N_per_keV.at(-1) < 1e-6 * Math.max(...s.N_per_keV));
});
test('beta+ decay suppresses low energies while beta- enhances them (Coulomb effect)', () => {
  const m = B.spectrum({ Zd: 10, A: 22, Q_keV: 545.6, mode: '-', type: 'allowed' }).mean_keV, p = B.spectrum({ Zd: 10, A: 22, Q_keV: 545.6, mode: '+', type: 'allowed' }).mean_keV;
  assert.ok(p > m + 15, `mean beta+ ${p} should exceed beta- ${m}`);
});
test('presets reproduce evaluated mean energies within the stated accuracy of this model (allowed 1 %, forbidden unique 2 %)', () => {
  const tol = { allowed: 0.01, first_unique: 0.02, second_unique: 0.03 };
  for (const p of B.PRESETS) { if (p.ref_mean_keV == null) continue; const s = B.spectrum(p); assert.ok(rel(s.mean_keV, p.ref_mean_keV) < tol[p.type], `${p.id}: ${s.mean_keV.toFixed(2)} vs ${p.ref_mean_keV}`); }
  assert.ok(B.PRESETS.some(p => p.mode === '+') && B.PRESETS.some(p => p.type === 'first_unique') && B.PRESETS.some(p => p.type === 'second_unique'));
});
test('log ft and input validation', () => {
  assert.ok(Math.abs(B.logft(10, 100, 0.5) - Math.log10(10 * 100 / 0.5)) < 1e-12);
  assert.throws(() => B.spectrum({ Zd: 0, A: 3, Q_keV: 10, mode: '-', type: 'allowed' }), /proton number/);
  assert.throws(() => B.spectrum({ Zd: 2, A: 3, Q_keV: -5, mode: '-', type: 'allowed' }), /endpoint/);
  assert.throws(() => B.spectrum({ Zd: 2, A: 3, Q_keV: 10, mode: 'x', type: 'allowed' }), /mode/);
  assert.throws(() => B.spectrum({ Zd: 2, A: 3, Q_keV: 10, mode: '-', type: 'weird' }), /shape/);
});
test('beta- screening is continuous at W = 1 + V0 (the ratio below it is frozen, not reset to the unscreened function)', () => {
  for (const [Z, A] of [[7, 14], [29, 63], [82, 208]]) {
    const V0 = 1.13 * B.ALPHA * B.ALPHA * Math.pow(Z, 4 / 3), Wk = 1 + V0, p = W => Math.sqrt(W * W - 1);
    const below = B.screened(Z, Wk - 1e-7, A, 1) * p(Wk - 1e-7), above = B.screened(Z, Wk + 1e-7, A, 1) * p(Wk + 1e-7);
    assert.ok(Math.abs(below / above - 1) < 2e-4, `Z=${Z}: ${below} vs ${above}`);
  }
});
