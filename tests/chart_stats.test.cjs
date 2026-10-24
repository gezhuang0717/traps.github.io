const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../static/js/chart-stats.js');

const key = (z, n) => z * 1000 + n;
const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data/research-cache/ame-editions-compact.json'), 'utf8'));

test('summarize finds min, max, median and ignores missing values', () => {
  const s = S.summarize([{ v: 3, id: 'a' }, { v: null, id: 'x' }, { v: -2, id: 'b' }, { v: 10, id: 'c' }, { v: NaN, id: 'y' }, { v: 4, id: 'd' }]);
  assert.equal(s.n, 4);
  assert.equal(s.min.id, 'b'); assert.equal(s.max.id, 'c');
  assert.equal(s.median, 3.5); assert.equal(s.mean, 3.75);
  assert.equal(S.summarize([]), null); assert.equal(S.summarize([{ v: null }]), null);
  assert.equal(S.summarize([{ v: 1, id: 'first' }, { v: 1, id: 'second' }]).min.id, 'first');
});

test('compareEditions counts present, new, dropped and status changes', () => {
  const old = new Map([[key(1, 0), [10, 1, 0]], [key(2, 2), [20, 2, 1]], [key(3, 3), [30, 1, 0]], [key(9, 9), [90, 1, 0]]]);
  const cur = [
    [1, 0, 'H', 10.5, 0.5, 0], [2, 2, 'He', 21, 1, 0],      // He: estimated -> measured, shift 1 keV
    [3, 3, 'Li', 50, 1, 1],                                   // measured -> estimated, shift 20 keV (> 3 sigma)
    [4, 4, 'Be', 40, 1, 0], [5, 5, 'B', null, null, 0],       // Be is new, B has no mass excess
  ];
  const c = S.compareEditions(cur, old, key);
  assert.deepEqual([c.compared, c.added, c.dropped, c.estimatedToMeasured, c.measuredToEstimated, c.beyond3Sigma], [3, 1, 1, 1, 1, 1]);
  assert.equal(c.largest.v, 20); assert.deepEqual(c.largest.id, [3, 3]);
  assert.equal(c.medianAbs, 1); assert.ok(Math.abs(c.meanDifference - (0.5 + 1 + 20) / 3) < 1e-12);
});

test('the real AME2016 table gives a consistent comparison with itself', () => {
  const rows = cache.editions.ame2016.map(r => [r[0], r[1], 'x', r[2], r[3], r[4]]);
  const c = S.compareEditions(rows, new Map(cache.editions.ame2016.map(r => [key(r[0], r[1]), [r[2], r[3], r[4]]])), key);
  assert.equal(c.compared, 3436); assert.equal(c.added, 0); assert.equal(c.dropped, 0); assert.equal(c.largest.v, 0);
  assert.equal(c.beyond3Sigma, 0);
});

test('edition table rows follow the published tables', () => {
  const rows = S.editionRows(cache.meta.stats);
  assert.deepEqual(rows.map(r => r.label), ['AME1995', 'AME2003', 'AME2012', 'AME2016', 'AME2020']);
  const by = Object.fromEntries(rows.map(r => [r.key, r]));
  assert.equal(by.ame2020.nuclides, 3558); assert.equal(by.ame2020.isomers, 1841); assert.equal(by.ame2020.nubase, 'NUBASE2020');
  assert.equal(by.ame1995.nubase, 'NUBASE1997');
  for (const r of rows) assert.equal(r.measured + r.estimated, r.nuclides, r.key);
  for (const k of ['ame1995', 'ame2003', 'ame2012', 'ame2016']) assert.equal(by[k].nuclides, cache.editions[k].length);
  assert.equal(S.editionRows(null).length, 0);
});

test('state counts: isomers grow with every edition and NUBASE ground states cover the AME table', () => {
  const rows = S.editionRows(cache.meta.stats);
  for (let i = 1; i < rows.length; i++) { assert.ok(rows[i].isomers > rows[i - 1].isomers, rows[i].key); assert.ok(rows[i].withIsomers > rows[i - 1].withIsomers, rows[i].key); }
  for (const [k, e] of Object.entries(cache.meta.stats)) {
    const n = e.nubase;
    assert.ok(n.ground_states >= e.nuclides, k);
    assert.equal(n.ground_measured + n.ground_estimated + n.ground_no_mass, n.ground_states, k);
    assert.ok(n.nuclides_with_isomers <= n.isomers, k);
    assert.equal(n.raw_sha256.length, 64); assert.ok(n.url.startsWith('https://amdc.impcas.ac.cn/'), k);
  }
  // NUBASE2020 documents 1378 m-isomers and 463 n-isomers (state index 1 and 2)
  assert.equal(cache.meta.stats.ame2020.nubase.isomers, 1378 + 463);
});

test('half-lives are written as mantissa x 10^integer seconds', () => {
  assert.equal(S.scientificSeconds(0.9705), '9.343×10⁰ s');
  assert.equal(S.scientificSeconds(-22.066), '8.590×10⁻²³ s');
  assert.equal(S.scientificSeconds(31.851), '7.096×10³¹ s');
  assert.equal(S.scientificSeconds(3), '1.000×10³ s');
  assert.equal(S.scientificSeconds(-1), '1.000×10⁻¹ s');
  assert.equal(S.scientificSeconds(0.99999), '1.000×10¹ s');   // rounds up into the next decade
  assert.equal(S.scientificSeconds(NaN), '');
  assert.ok(!/10\^/.test(fs.readFileSync(path.join(__dirname, '../static/js/nuclide-chart.js'), 'utf8').split('\n').filter(l => l.includes('scientificSeconds')).join('')));
});
