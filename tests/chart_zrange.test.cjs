const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync('static/js/nuclide-chart.js', 'utf8');
function slice(start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert.ok(a >= 0 && b > a, start); return source.slice(a, b); }
function context(values, extra = {}) {
  const ctx = { src: 'ame', manualRange: null, emptyColour: '#e5e7eb', classOn: false, classScheme: 'default', classState: null, rows: values.map((v, i) => [i, 0, 'X', 0, 0, 0, 0, 0, 0, 0, 0, [], v]), extraRows: [], mode: 'd', ramp: x => 'ramp' + x.toFixed(2), ...extra };
  ctx.MODES = { d: { label: 'diff', v: r => r[12], lo: -30, hi: 30, div: true, auto: true }, f: { label: 'fixed', v: r => r[12], lo: -5, hi: 5, div: true } };
  vm.createContext(ctx);
  vm.runInContext('const allRows = () => src === "ame" ? rows : rows.concat(extraRows);\n' + slice('  const autoCache = new Map();', '  const pick =') + '\n' + slice('  function colour(r) {', '  function drawLegend()') + '\nthis.bounds = bounds; this.colour = colour;', ctx);
  return ctx;
}
test('an auto mode takes the minimum and maximum of all plotted values instead of the fixed ±30 keV window', () => {
  const c = context([-812.5, 3, 40, 1450.2, null]);
  assert.deepEqual({ ...c.bounds(c.MODES.d) }, { lo: -812.5, hi: 1450.2 });
  assert.deepEqual({ ...c.bounds(c.MODES.f) }, { lo: -5, hi: 5 });   // fixed-scale modes are unchanged
});
test('the manual range wins over the data range, and a constant data set still gets a finite span', () => {
  const c = context([1, 2, 3]); c.manualRange = { lo: -1, hi: 10 }; assert.deepEqual({ ...c.bounds(c.MODES.d) }, { lo: -1, hi: 10 });
  const k = context([4, 4]); const b = k.bounds(k.MODES.d); assert.ok(b.hi > b.lo && b.lo < 4 && b.hi > 4);
});
test('before the overlay table has loaded the fallback is not cached', () => {
  const c = context([null, null]); assert.deepEqual({ ...c.bounds(c.MODES.d) }, { lo: -30, hi: 30 });
  c.rows.forEach((r, i) => { r[12] = [-7, 90][i]; }); assert.deepEqual({ ...c.bounds(c.MODES.d) }, { lo: -7, hi: 90 });
});
test('diverging colours saturate at both ends of an asymmetric range and are white at zero', () => {
  const c = context([-10, 90]);
  const L = v => /hsl\(220,80%,(\d+)%\)/.exec(c.colour([0, 0, 'X', 0, 0, 0, 0, 0, 0, 0, 0, [], v])), R = v => /hsl\(0,80%,(\d+)%\)/.exec(c.colour([0, 0, 'X', 0, 0, 0, 0, 0, 0, 0, 0, [], v]));
  assert.equal(L(-10)[1], '46'); assert.equal(R(90)[1], '46');            // 96 - 50 at both extremes
  assert.ok(Number(R(0)[1]) >= 95 || Number(L(-0.001)[1]) >= 94);          // near zero: almost white
  assert.equal(c.colour([0, 0, 'X', 0, 0, 0, 0, 0, 0, 0, 0, [], null]), '#e5e7eb');
});
