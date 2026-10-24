const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../static/js/wb-plot.js');

const species = [
  { label: '133Xe⁺ · ground state', color: '#3e63dd', points: [[0, 0], [1, 5], [2, 1]] },
  { label: '133Xem⁺ · isomer E* 233.221 keV', color: '#dc505b', points: [[0, 0], [1.4, 3], [2, 0]] },
  { label: 'Combined sample', color: 'ink', width: 2.5, points: [[0, 0], [1, 6], [2, 1]] },
  { label: '', noLegend: true, color: '#dc505b', dots: true, points: [[1, 5, 0.5]] },
];
const base = { xlabel: 'TOF (ns)', ylabel: 'counts', title: 'Peaks & <isomers>', caption: ['laps = 1000 · FWHM = 20 ns'], markers: [{ x: 1, color: '#3e63dd' }] };

test('every labelled series is in the legend, unlabelled helper series are not', () => {
  const sc = W.scene(species, base);
  assert.deepEqual(sc.entries.map(e => e.text), ['133Xe⁺ · ground state', '133Xem⁺ · isomer E* 233.221 keV', 'Combined sample']);
});

test('saved SVG carries species, isomer, title, axes, caption and escapes markup', () => {
  const svg = W.toSVG(W.scene(species, { ...base, ink: '#111111', background: '#fff' }));
  for (const text of ['133Xe⁺ · ground state', '133Xem⁺ · isomer E* 233.221 keV', 'Combined sample', 'TOF (ns)', 'counts', 'laps = 1000 · FWHM = 20 ns', 'Peaks &amp; &lt;isomers&gt;']) assert.ok(svg.includes(text), text);
  assert.ok(!svg.includes('<isomers>'));
  assert.match(svg, /stroke="#111111"/, 'the ink colour token is resolved');
  assert.ok(!/stroke="ink"/.test(svg));
  assert.doesNotMatch(svg, /<desc>/, 'description only when metadata is given');
  assert.match(W.toSVG(W.scene(species, base), { tool: 'mr' }), /<desc>\{&quot;tool&quot;:&quot;mr&quot;\}<\/desc>/);
});

test('legend position: bottom adds rows, inside uses a box, off removes it', () => {
  const bottom = W.scene(species, base), inside = W.scene(species, { ...base, legend: 'in' }), off = W.scene(species, { ...base, legend: 'off' });
  assert.ok(bottom.H > inside.H && inside.H > 0);
  assert.equal(off.entries.length, 0);
  assert.ok(inside.items.some(i => i.t === 'rect' && /rgba\(127,127,160,\.14\)/.test(i.fill || '')));
  assert.ok(!W.toSVG(off).includes('Combined sample'));
});

test('ten species wrap onto several legend rows', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ label: `${120 + i}Xe⁺ · ground state`, color: '#3e63dd', points: [[0, 0], [1, i]] }));
  const sc = W.scene(ten, base), wide = W.scene(ten, { ...base, width: 1400 });
  assert.equal(sc.entries.length, 10);
  assert.ok(sc.H > wide.H, 'narrow figure needs more legend rows');
});

test('style sizes change the layout and marker radius', () => {
  const small = W.scene(species, { ...base, style: { legendSize: 9, markerDiameter: 3 } }), large = W.scene(species, { ...base, style: { legendSize: 16, markerDiameter: 14 } });
  assert.ok(large.H > small.H);
  const radius = sc => Math.max(...sc.items.filter(i => i.t === 'clip').flatMap(c => c.items).filter(i => i.t === 'circle').map(i => i.r));
  assert.equal(radius(small), 1.5);
  assert.equal(radius(large), 7);
});

test('zoom keeps the centre fixed, pan shifts, view overrides the data range', () => {
  assert.deepEqual(W.zoomRange([0, 10], 0.5), [2.5, 7.5]);
  assert.deepEqual(W.zoomRange([0, 10], 0.5, 0), [0, 5]);
  assert.deepEqual(W.panRange([0, 10], 3), [3, 13]);
  const sc = W.scene(species, { ...base, x: [0.5, 1.5], y: [0, 2] });
  assert.deepEqual([sc.xr, sc.yr], [[0.5, 1.5], [0, 2]]);
});

test('histogram bars keep their data width when zoomed', () => {
  const bars = { label: 'hist', color: '#999', bars: true, points: [[0, 1], [1, 2], [2, 1]] };
  const width = sc => sc.items.find(i => i.t === 'clip').items.find(i => i.t === 'rect').w;
  const full = W.scene([bars], { ...base, x: [0, 2] }), zoom = W.scene([bars], { ...base, x: [0, 1] });
  assert.ok(Math.abs(width(zoom) / width(full) - 2) < 0.05);
});

test('hover targets carry the series label and values', () => {
  const sc = W.scene(species, base);
  const hit = sc.hits.find(h => h.label.startsWith('133Xem') && h.x === 1.4);
  assert.ok(hit && hit.y === 3);
  assert.ok(sc.hits.every(h => Number.isFinite(h.sx) && Number.isFinite(h.sy)));
});

test('empty and degenerate data do not throw', () => {
  assert.doesNotThrow(() => W.toSVG(W.scene([], { xlabel: 'x', ylabel: 'y', x: [-1, 1], y: [-5, 5] })));
  assert.doesNotThrow(() => W.toSVG(W.scene([{ label: 'one', color: '#000', points: [[1, 1]] }], {})));
});
