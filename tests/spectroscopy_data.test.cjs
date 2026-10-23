const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const D = require('../static/js/spectroscopy-data.js'), U = require('../static/js/spectroscopy-uncertainty.js');
const compact = JSON.parse(fs.readFileSync('static/data/research-cache/nuclear-properties-compact.json', 'utf8'));
const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('compact IAEA table: counts, provenance and known values', () => {
  const m = compact.meta, { radii, moments } = D.fromCompact(compact);
  assert.equal(radii.length, m.with_radius); assert.equal(moments.filter(r => r.mu_muN != null).length, m.with_moment); assert.equal(moments.filter(r => r.Q_b != null).length, m.with_quadrupole);
  assert.ok(radii.length > 800 && moments.length > 900); assert.match(m.retrieved_at, /^2026-10-23/); assert.equal(m.query.nuclides, 'all');
  const pb = radii.find(r => r.element === 'Pb' && r.A === 208); assert.deepEqual([pb.r_fm, pb.sigma_fm], [5.5012, 0.0013]);
  const ca = radii.filter(r => r.element === 'Ca' && r.A >= 40 && r.A <= 48 && r.A !== 46 && r.A !== 47 && r.A !== 45); assert.equal(ca.length, 6);
  const rb = moments.find(r => r.element === 'Rb' && r.A === 87); assert.equal(rb.spin, '3/2'); close(rb.mu_muN, 2.75129, 1e-6);
});
test('physically undefined entries are excluded: no moments for spin-0 states and no neutron radius', () => {
  const { radii, moments } = D.fromCompact(compact);
  assert.ok(!moments.some(r => String(r.spin_parity || '').startsWith('0')));
  assert.ok(!radii.some(r => r.element === 'n')); assert.ok(radii.every(r => r.r_fm > 0));
  assert.ok(compact.meta.excluded_inconsistent.spin0_moments > 100);
});
test('hand-entered radii accept CSV, TSV, spaces, headers, comments and JSON; unknown sigma stays null', () => {
  const csv = D.parseTable('element,A,r_fm,sigma_fm\n# comment\nCa,40,3.4776,0.0019\nca\t48\t3.4771\t\nK 39 3.4349 0.0023', 'radii');
  assert.equal(csv.errors.length, 0); assert.equal(csv.rows.length, 3); assert.equal(csv.rows[1].element, 'Ca'); assert.equal(csv.rows[1].sigma_fm, null);
  const js = D.parseTable('[{"element":"Sn","A":120,"r_fm":4.6519,"sigma_fm":0.0021}]', 'radii'); assert.equal(js.rows[0].A, 120);
  const bad = D.parseTable('Ca,40,-1,0.1\nXx1,40,3,0.1\nCa,x,3,0.1\nCa,40,3,-0.2', 'radii'); assert.equal(bad.rows.length, 0); assert.deepEqual(bad.errors.map(e => e.line), [1, 2, 3, 4]);
  assert.equal(D.parseTable('x'.repeat(500000), 'radii').errors.length, 1);
});
test('hand-entered moments need a spin and at least one moment', () => {
  const ok = D.parseTable('Rb,87,3/2,2.75129,0.00008\nCs,133,7/2,2.5778,0.0014,-0.00355,0.00004', 'moments');
  assert.equal(ok.errors.length, 0); assert.equal(ok.rows[1].Q_b, -0.00355); assert.equal(ok.rows[0].Q_b, null);
  const bad = D.parseTable('Rb,87,3/2\nRb,87,x,1.0\nRb,87,1,,,-0.1,-0.01', 'moments'); assert.equal(bad.rows.length, 0); assert.equal(bad.errors.length, 3);
});
test('King lines: errors optional, all-or-nothing per line, rho validated by the fit', () => {
  assert.equal(D.parseKing('1,3\n2,5\n3,7').weighted, false);
  const w = D.parseKing('1,3,0.1,0.2\n2,5,0.1,0.2\n3,7,0.1,0.2\n# c\n'); assert.equal(w.weighted, true); assert.equal(w.points[0].sy, 0.2);
  assert.throws(() => D.parseKing('1,3,0.1'), /sx and sy/); assert.throws(() => D.parseKing('1,3,-1,1'), /negative/); assert.throws(() => D.parseKing('1,a'), /line 1/);
  assert.equal(D.parseKing('1,3,0.1,0.2,0.5').points[0].rho_xy, 0.5);
});
test('King input rejects mixed known/missing row errors instead of silently switching to OLS', () => {
  const known = ['0,1,0.1,0.2', '1,3,0.1,0.2', '2,5,0.1,0.2'];
  for (let missing = 0; missing < known.length; missing++) {
    const lines = known.map((line, i) => i === missing ? line.split(',').slice(0, 2).join(',') : line);
    assert.throws(() => D.parseKing(lines.join('\n')), e => e.code === 'KING_MIXED_UNCERTAINTY');
  }
  const plain = D.parseKing('0,1\n1,3\n2,5');
  assert.equal(plain.weighted, false);
  assert.ok(plain.points.every(p => !Object.hasOwn(p, 'sx') && !Object.hasOwn(p, 'sy')));
  const exactX = D.parseKing('0,1,0,0.2\n1,3,0,0.2\n2,5,0,0.2');
  assert.equal(exactX.weighted, true);
  assert.ok(exactX.points.every(p => p.sx === 0 && p.sy === 0.2));
  close(U.kingFit(exactX).slope, 2, 1e-7);
});
test('OLS band equals the textbook confidence-line standard error', () => {
  const pts = [[1, 3.1], [2, 4.9], [3, 7.2], [4, 8.8], [5, 11.1]].map(([x, y]) => ({ x, y })), r = D.olsWithBand(pts, [0, 2.5, 6]);
  const n = 5, mx = 3, sxx = 10, my = pts.reduce((s, p) => s + p.y, 0) / n, b = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx, a = my - b * mx;
  close(r.slope, b); close(r.intercept, a); const s2 = pts.reduce((s, p) => s + (p.y - a - b * p.x) ** 2, 0) / 3;
  for (const q of r.band) close(q.sigma, Math.sqrt(s2 * (1 / n + (q.x - mx) ** 2 / sxx)), 1e-12);
  assert.ok(r.band[1].sigma < r.band[0].sigma && r.band[1].sigma < r.band[2].sigma);
});
test('weighted EIV King fit gives a band consistent with its parameter covariance', () => {
  const pts = [[0, 1.02, 0.05, 0.1], [1, 2.95, 0.05, 0.1], [2, 5.1, 0.05, 0.1], [3, 6.9, 0.05, 0.1], [4, 9.05, 0.05, 0.1]].map(([x, y, sx, sy]) => ({ x, y, sx, sy }));
  const f = U.kingFit({ points: pts }), band = D.lineBand(f.intercept, f.slope, f.parameter_covariance, [0, 2, 4]);
  close(f.slope, 2, 0.05); assert.ok(f.sigma_slope > 0 && f.dof === 3); for (const q of band) { assert.ok(q.sigma > 0); close(q.hi - q.y, q.sigma); close(q.y - q.lo, q.sigma); }
  const centre = band[1].sigma; assert.ok(centre < band[0].sigma && centre < band[2].sigma);
});
test('hand-entered nuclear scheme is validated against its own level ids', () => {
  const t = 'level,gs,0,,0+\nlevel,a,4439.82,0.21,2+\ngamma,a,gs,4438.94';
  const ok = D.parseScheme(t, 'X'); assert.equal(ok.errors.length, 0); assert.equal(ok.scheme.transitions[0].sigma_energy_keV, null); assert.equal(ok.scheme.levels[1].spin_parity, '2+');
  assert.ok(D.parseScheme('level,a,1\nlevel,a,2', 'X').errors.length > 0); assert.ok(D.parseScheme('gamma,a,b,10', 'X').errors.length > 0); assert.ok(D.parseScheme('foo,1', 'X').errors.length > 0);
  assert.ok(D.parseScheme(t + ',-1', 'X').errors.length > 0, 'negative gamma uncertainty');
  assert.ok(D.parseScheme('level,gs,0\nlevel,a,20\ngamma,gs,a,20', 'X').errors.length > 0, 'upward emission');
  assert.ok(D.parseScheme('level,a,20\ngamma,a,a,1', 'X').errors.length > 0, 'self emission');
});
