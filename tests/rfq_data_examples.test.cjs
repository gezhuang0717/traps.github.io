'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), vm = require('node:vm'), cp = require('node:child_process');
const X = require('../static/js/rfq-extended-core.js');
const D = require('../static/js/rfq-data-examples.js');
const base = path.join(__dirname, '../static/data/rfq-examples');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
const get = id => X.parseCSV(fs.readFileSync(path.join(base, id + '.csv'), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) <= 2e-10 * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);

test('all ten marked synthetic CSVs match independent Python statistics and exact file hashes', () => {
  D.validateManifest(manifest); assert.equal(manifest.examples.length, 10);
  for (const item of manifest.examples) {
    const content = fs.readFileSync(path.join(base, item.file));
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'), item.sha256);
    assert.match(content.toString(), /source\n/); assert.match(content.toString(), /synthetic-teaching/);
    const rows = X.parseCSV(content.toString()), stats = X.analyzeSamples(rows);
    assert.equal(rows.length, item.count);
    for (const [key, expected] of Object.entries(item.expected)) {
      if (expected === null) assert.equal(stats[key], null); else close(stats[key], expected);
    }
    assert.ok(item.name.en && item.name.zh && item.description.en && item.description.zh);
  }
});

test('standard-library regeneration reproduces every committed CSV and the catalog byte for byte', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rfq-examples-'));
  try {
    cp.execFileSync('python3', [path.join(__dirname, '../tools/generate_rfq_examples.py'), '--output', temp]);
    for (const file of ['manifest.json', ...manifest.examples.map(item => item.file)]) {
      assert.deepEqual(fs.readFileSync(path.join(temp, file)), fs.readFileSync(path.join(base, file)), file);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('representative datasets retain their intended scientific distinctions', () => {
  const stats = Object.fromEntries(manifest.examples.map(item => [item.id, item.expected]));
  assert.ok(stats.broad.sigma_t_ns > 8 * stats.narrow.sigma_t_ns);
  assert.ok(stats.positive.correlation > .85); assert.ok(stats.negative.correlation < -.85);
  const tail = get('tail').map(row => row.t_ns).sort((a, b) => a - b);
  assert.ok(stats.tail.mean_t_ns > (tail[127] + tail[128]) / 2 + 2);
  const double = get('double'), mean = rows => rows.reduce((sum, row) => sum + row.t_ns, 0) / rows.length;
  assert.ok(mean(double.filter((_, i) => i % 2)) - mean(double.filter((_, i) => !(i % 2))) > 20);
  const drift = get('drift'); assert.ok(mean(drift.slice(-32)) - mean(drift.slice(0, 32)) > 15);
  assert.equal(get('outliers').filter(row => Math.abs(row.t_ns - 1000) > 40).length, 8);
  assert.equal(stats.narrow.radial_rms_mm, null);
  assert.ok(stats['tilted-spot'].radial_rms_mm > 2 * stats['round-spot'].radial_rms_mm);
});

test('energy histogram conserves event counts including constant and extreme boundary values', () => {
  for (const rows of [get('broad'), [{ E_eV: 4 }, { E_eV: 4 }, { E_eV: 4 }], [{ E_eV: 0 }, { E_eV: 1 }, { E_eV: 2 }]]) {
    const h = D.histogram(rows, 'E_eV');
    assert.equal(h.bins.reduce((a, b) => a + b, 0), rows.length);
    assert.ok(h.width > 0); assert.equal(h.rows[0].y, 0); assert.equal(h.rows.at(-1).y, 0);
  }
});

test('new plot views preserve coordinate units, equal transverse scale and original event indices', () => {
  const rows = get('tilted-spot'), xy = D.viewData('xy-spot', rows);
  assert.equal(xy.options.equalAspect, true); assert.equal(xy.options.scatter, true);
  assert.deepEqual(xy.series[0].rows[0], { x: rows[0].x_mm, y: rows[0].y_mm });
  assert.throws(() => D.viewData('xy-spot', get('narrow')), /requires x_mm and y_mm/);
  const long = Array.from({ length: 5000 }, (_, i) => ({ t_ns: i / 10, E_eV: i + 1 }));
  const time = D.viewData('event-time', long), energy = D.viewData('event-energy', long);
  assert.equal(time.displayed, 3000); assert.deepEqual(time.series[0].rows[0], { x: 1, y: 0 });
  assert.deepEqual(time.series[0].rows.at(-1), { x: 5000, y: 499.9 });
  assert.equal(energy.series[0].rows.at(-1).y, 5000); assert.match(time.options.caption, /statistics use every event/);
  assert.equal(D.viewData('scatter', rows), null); assert.equal(D.labels('ja'), D.labels('en'));
  assert.match(D.viewData('event-energy', rows, 'zh-Hans').title, /能量/);
});

test('catalog rejects mislabeled measurement data and unsafe filenames', () => {
  assert.throws(() => D.validateManifest({ ...manifest, measured: true }));
  assert.throws(() => D.validateManifest({ ...manifest, examples: [{ ...manifest.examples[0], file: '../secret.csv' }] }));
});

test('example controls load real CSV rows through the parser and dispatch provenance; fallback language is explicit', async () => {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; }
    append(...items) { this.children.push(...items); }
    prepend(...items) { this.children.unshift(...items); }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(key, handler) { this.listeners[key] = handler; }
    querySelector(selector) { const match = selector.match(/^option\[value="([^"]+)"\]$/); return match ? this.children.find(c => c.value === match[1]) || null : null; }
  }
  const root = new Element('section'), panel = new Element('div'), view = new Element('select');
  const controls = new Element('div'), picker = new Element('input'); let inserted, dispatched;
  controls.before = element => { inserted = element; }; picker.closest = () => controls;
  panel.querySelector = selector => selector === '[data-rfx-file]' ? picker : null;
  root.querySelector = selector => selector === '[data-local-panel="data"]' ? panel : selector === '[name="rx-data-view"]' ? view : null;
  root.dispatchEvent = event => { dispatched = event; }; root.dataset.examplesBase = '/prefix/data/rfq-examples/';
  const doc = { documentElement: { lang: 'de' }, baseURI: 'https://example.test/prefix/lab/', readyState: 'loading',
    createElement: tag => new Element(tag), addEventListener() {}, querySelector: () => root };
  const host = { document: doc, ZGRFQExtras: X, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    fetch: async url => { assert.match(url, /^https:\/\/example.test\/prefix\/data\/rfq-examples\//);
      const filename = new URL(url).pathname.split('/').at(-1);
      return { ok: true, json: async () => manifest, text: async () => fs.readFileSync(path.join(base, filename), 'utf8') }; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/rfq-data-examples.js'), 'utf8'), { window: host, URL });
  const ui = host.ZGRFQDataExamples.init(root); await ui.ready;
  assert.equal(inserted, ui.box); assert.equal(ui.box.lang, 'en'); assert.equal(ui.select.children.length, 10);
  assert.equal(view.children.length, 4); assert.equal(ui.download.download, 'narrow.csv');
  assert.match(ui.expected.textContent, /256 events/);
  await ui.load.listeners.click();
  assert.equal(dispatched.type, 'rfq:load-data'); assert.equal(dispatched.detail.rows.length, 256);
  assert.match(dispatched.detail.source, /Synthetic teaching example: narrow/);
  assert.equal(dispatched.detail.example.origin, 'synthetic-teaching');
  assert.equal(dispatched.detail.example.generator, 'tools/generate_rfq_examples.py');
  assert.equal(ui.load.disabled, false); assert.equal(host.ZGRFQDataExamples.init(root), null);
});
