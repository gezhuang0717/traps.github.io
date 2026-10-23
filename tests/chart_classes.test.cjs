const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../static/js/chart-classes.js');

test('spin text of NUBASE is parsed into one value or marked ambiguous', () => {
  const p = t => C.parseSpin(t);
  assert.deepEqual([p('0+').J, p('0+').parity], [0, '+']);
  assert.deepEqual([p('1/2-').J, p('1/2-').parity], [0.5, '-']);
  assert.equal(p('5/2+*').J, 2.5);
  assert.equal(p('1/2-#').J, 0.5);
  assert.deepEqual([p('(7/2+)').J, p('(7/2+)').tentative], [3.5, true]);
  assert.equal(p('12+').J, 12);
  for (const t of ['3/2+,5/2+', '(1,2)+', '7/2+ to 11/2+', '(3/2,5/2)', '1-,2-']) assert.equal(p(t).J, null, t);
  assert.equal(p('3/2+,5/2+').ambiguous, true);
  for (const t of ['', null, undefined, '—']) assert.equal(p(t).J, null);
});

test('spin classes follow 0, 1/2 or 1, 3/2 or 2 … 15/2 or 8, >8', () => {
  const cls = t => C.spinClass(t);
  assert.deepEqual(['0+', '1/2+', '1+', '3/2-', '2+', '5/2+', '3-', '15/2-', '8+', '17/2+', '9-'].map(cls), [0, 1, 1, 2, 2, 3, 3, 8, 8, 9, 9]);
  assert.equal(cls('3/2+,5/2+'), null); assert.equal(cls(''), null);
  assert.equal(C.SPIN_LABELS.length, 10); assert.equal(C.SPIN_COLOURS.length, 10); assert.equal(new Set(C.SPIN_COLOURS).size, 10);
});

test('every ground-state spin of NUBASE2020 falls into a class, ambiguous ones are only the uncertain bin', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data/nubase2020.json'), 'utf8')).rows;
  const counts = new Array(10).fill(0); let uncertain = 0;
  for (const r of rows) { const k = C.spinClass(r[8]); if (k == null) uncertain++; else counts[k]++; }
  assert.equal(counts.reduce((a, b) => a + b, 0) + uncertain, rows.length);
  assert.ok(counts[0] > 500 && counts[1] > 400, counts.join());   // many 0+ even-even nuclei and 1/2 ground states
  assert.ok(uncertain > 100 && uncertain < rows.length / 2, String(uncertain));
  const ca48 = rows.find(r => r[0] === 20 && r[1] === 28); assert.equal(C.spinClass(ca48[8]), 0);
});

test('precision classes: boundaries, extrapolated and unknown', () => {
  const p = (u, e = 0, m = true) => C.precisionClass(u, e, m);
  assert.deepEqual([0.2, 1, 4.99, 5, 9.9, 10, 49, 50, 99.9, 100, 4000].map(u => p(u)), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(p(30, 1), 6); assert.equal(p(null), 7); assert.equal(p(5, 0, false), 7);
  assert.equal(C.PRECISION_LABELS.length, 6); assert.equal(C.PRECISION_COLOURS.length, 6);
});

test('deviation classes: upper edge belongs to the lower class', () => {
  const d = C.deviationClass;
  assert.deepEqual([-5000, -1000, -999, -500, -300, -100, -99.9, 0, 100, 100.1, 300, 500, 1000, 1000.1].map(d), [0, 0, 1, 1, 2, 3, 4, 4, 4, 5, 5, 6, 7, 8]);
  assert.equal(d(null), null); assert.equal(d(NaN), null);
  assert.equal(C.DEVIATION_LABELS.length, 9); assert.equal(C.DEVIATION_COLOURS.length, 9);
});

test('parity filters and channel energetics', () => {
  assert.deepEqual(['all', 'odd', 'even'].map(k => C.parityOk(7, k)), [true, true, false]);
  assert.deepEqual(['all', 'odd', 'even'].map(k => C.parityOk(8, k)), [true, false, true]);
  assert.deepEqual(['all', 'odd', 'even'].map(C.nextParity), ['odd', 'even', 'all']);
  assert.equal(C.channelState('Q', 185.77), 'possible'); assert.equal(C.channelState('Q', -1636.7), 'impossible');
  assert.equal(C.channelState('S', 9542.8), 'impossible'); assert.equal(C.channelState('S', -120), 'possible');
  assert.equal(C.channelState('Q', null), 'nodata'); assert.equal(C.channelState('S', NaN), 'nodata');
});

const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/js/nuclide-chart.js'), 'utf8');
const slice = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a); assert.ok(a >= 0 && b > a, start); return source.slice(a, b); };

test('chart class modes colour by the fixed classes and keep missing values in the "none" colour', () => {
  const ctx = { window: { ZGChartClasses: C } };
  vm.runInNewContext(slice('  /* discrete classes with a fixed legend', '  const reactionDefinitions=') + '\nout = { binMode, WHITE };', ctx);
  const spin = ctx.out.binMode('Spin', r => C.spinClass(r[8]), C.SPIN_LABELS.map((l, i) => [C.SPIN_COLOURS[i], l]), ['#ffffff', 'uncertain']);
  assert.equal(spin.f([0, 0, 'X', 0, 0, 0, 0, '', '0+']), C.SPIN_COLOURS[0]);
  assert.equal(spin.f([0, 0, 'X', 0, 0, 0, 0, '', '(7/2+)']), C.SPIN_COLOURS[4]);
  assert.equal(spin.f([0, 0, 'X', 0, 0, 0, 0, '', '3/2+,5/2+']), '#ffffff');
  assert.equal(spin.bins.list.length, 10);
});

test('the card lists every separation and decay channel, green when possible and red when not', () => {
  const ctx = { CL: C, T: { ch_possible: 'possible', ch_impossible: 'not possible', ch_nodata: 'no data' }, escape: s => s, fv: o => String(o.v) };
  vm.runInNewContext(slice('  const CHANNELS =', '  function showCard(r)') + '\nout = channelItems({ sn: { v: 9542.8 }, sp: { v: -120 }, qa: { v: -1661.8 }, qec: { v: 185.77 }, s2n: { v: 17036 } });', ctx);
  const html = ctx.out, item = name => new RegExp('<li class="nc-ch nc-ch-(\\w+)"[^>]*><b>' + name.replace(/[()⁻⁺]/g, m => '\\' + m) + '</b>').exec(html)[1];
  assert.equal(item('Sₙ'), 'impossible');      // bound neutron: no spontaneous emission
  assert.equal(item('Sₚ'), 'possible');        // negative separation energy: proton emission allowed
  assert.equal(item('Q(α)'), 'impossible');
  assert.equal(item('Q(β⁺/EC)'), 'possible');
  assert.equal(item('S₂ₙ'), 'impossible');
  assert.equal(item('Q(β⁻n)'), 'nodata');
  assert.equal((html.match(/<li /g) || []).length, 12);
});

test('the hotkey, parity and class controls are wired in the template and menu', () => {
  const template = fs.readFileSync(path.join(__dirname, '../layouts/_shortcodes/nuclide-chart.html'), 'utf8');
  for (const name of ['nc-zpar', 'nc-npar', 'nc-isomark', 'nc-empty', 'nc-hotkey-status']) assert.ok(template.includes(name), name);
  assert.match(template, /js\/chart-classes\.js.*readFile.*sha256/);
  assert.deepEqual(require('../static/js/mass-quantity-menu.js').overlay.classes, ['spinb', 'precb', 'dmodb']);
  for (const key of ['m', 'p', 'n', 'i', 'd', 'g', 's']) assert.ok(source.includes('k === "' + key + '"'), key);
});
