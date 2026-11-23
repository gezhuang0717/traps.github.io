'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const X = require('../static/js/rfq-extended-core.js'), M = require('../static/js/mathieu-core.js'), H = require('../static/js/rfq-workbench.js');
const files = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), labels = JSON.parse(files('data/rfq_scene_labels.json'));
class E {
 constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.dataset = {}; this.events = {}; this.clientWidth = 244; this.value = ''; this.textContent = ''; }
 setAttribute(k, v) { this.attrs[k] = String(v); }
 append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
 prepend(...items) { for (const item of [...items].reverse()) { this.children.unshift(item); item.parent = this; } }
 replaceChildren(...items) { this.children = []; this.append(...items); }
 addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
 remove() { if (this.parent) this.parent.children = this.parent.children.filter(e => e !== this); }
 fire(type) { for (const fn of this.events[type] || []) fn({ target: this }); }
}
const walk = e => [e, ...e.children.flatMap(walk)], text = e => e.textContent + e.children.map(text).join(' ');
const near = (a, b) => assert.ok(Math.abs(a - b) < 2e-10 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(kind, overrides = {}, width = 244, lang = 'en') {
 const inputs = { 'ms-mass': '100', 'ms-charge': '1', 'ms-U': '0', 'ms-V': '600', 'ms-voltage-convention': 'differential-pp', 'ms-r0': '10', 'ms-f': '.7', 'rx-gas_mass': '4', 'rx-T': '300', 'rx-p': '.001', 'rx-sigma': '100', 'rx-E': '10', 'rx-ms': '2', 'rx-eta': '1', 'rx-V': '1000', 'rx-L': '.5', 'rx-st': '20', 'rx-sE': '.5', 'rx-rho': '.7', 'rx-scan-axis': 'voltage', 'rx-vmin': '0', 'rx-vmax': '400', 'rx-count': '21', 'rx-scan-metric': 'q', ...overrides };
 let report, rows;
 if (kind === 'gas') { report = X.cooling({ mass_u: +inputs['ms-mass'], gas_mass_u: +inputs['rx-gas_mass'], temperature_K: +inputs['rx-T'], pressure_mbar: +inputs['rx-p'], cross_section_A2: +inputs['rx-sigma'], energy_eV: +inputs['rx-E'], residence_ms: +inputs['rx-ms'], transfer_efficiency: +inputs['rx-eta'] }); rows = report.points; }
 if (kind === 'bunch') { report = { bunch: X.bunch({ mass_u: +inputs['ms-mass'], charge: +inputs['ms-charge'], acceleration_V: +inputs['rx-V'], drift_m: +inputs['rx-L'], sigma_t_ns: +inputs['rx-st'], sigma_E_eV: +inputs['rx-sE'], rho: +inputs['rx-rho'] }), inventory: X.inventory({ ion_rate_s: 1000, hold_ms: 20, lifetime_ms: 1000, capacity: 1e5, extraction_fraction: .7 }) }; rows = report.bunch.scan; }
 if (kind === 'scan') { report = X.parameterScan({ axis: inputs['rx-scan-axis'], min: +inputs['rx-vmin'], max: +inputs['rx-vmax'], count: +inputs['rx-count'], mass_u: +inputs['ms-mass'], charge: +inputs['ms-charge'], U_V: +inputs['ms-U'], V_rod_peak_V: H.toRodPeak(+inputs['ms-V'], inputs['ms-voltage-convention']), r0_mm: +inputs['ms-r0'], f_MHz: +inputs['ms-f'] }, M); rows = report.rows; }
 const document = { createElement: tag => new E(tag), createElementNS: (ns, tag) => new E(tag) }, host = { document, ZGRFQExtras: X, ZGMathieu: M, ZGRFQWorkbench: H }, context = { window: host, document, console };
 vm.runInNewContext(files('static/js/rfq-chart.js'), context); vm.runInNewContext(files('static/js/rfq-lab-scenes.js'), context);
 const root = new E(), chart = new E(), changes = []; root.dataset = { lang, sceneLabels: JSON.stringify(labels[lang]) }; root.clientWidth = chart.clientWidth = width;
 const original = new E('svg'); chart.append(original);
 const scene = host.ZGRFQScenes.mount({ root, kind, chart, report, rows, inputs, onParameterChange: values => changes.push(values) });
 return { scene, root, chart, original, inputs, report, rows, changes, button: key => walk(chart).find(e => e.tag === 'button' && e.textContent === labels[lang][key]) };
}

test('scene cooling frames match the analytic report at physical start and finish, including zero rate', () => {
 for (const overrides of [{}, { 'rx-p': '0' }, { 'rx-eta': '0' }, { 'rx-E': '0' }, { 'rx-ms': '0' }]) {
  const h = fixture('gas', overrides), first = h.scene.renderFrame(0), last = h.scene.renderFrame(1);
  near(+first.dataset.sceneEnergyEv, +h.inputs['rx-E']); near(+last.dataset.sceneEnergyEv, h.report.estimated_energy_eV); near(+last.dataset.sceneTimeMs, +h.inputs['rx-ms']);
  assert.ok(!/NaN|undefined/.test(text(last))); assert.equal(h.chart.children[0], h.original);
 }
});
test('gas playback cursor follows its declared nonlinear time spacing without changing E(t)', () => {
 const h = fixture('gas'), svg = h.scene.renderFrame(.37), time = +svg.dataset.sceneTimeMs;
 near(+svg.dataset.sceneEnergyEv, h.report.energy_floor_eV + (+h.inputs['rx-E'] - h.report.energy_floor_eV) * Math.exp(-time / h.report.tau_ms));
 h.button('gas_one_tau').fire('click'); near(h.changes.at(-1)['rx-ms'], h.report.tau_ms);
 h.button('gas_no_gas').fire('click'); assert.equal(h.changes.at(-1)['rx-p'], 0);
});
test('bunch frames conserve energy spread and reproduce the covariance drift width', () => {
 for (const rho of ['-.85', '0', '.95', '1']) {
  const h = fixture('bunch', { 'rx-rho': rho }), first = h.scene.renderFrame(0), last = h.scene.renderFrame(1);
  near(+first.dataset.sceneSigmaNs, +h.inputs['rx-st']); near(+last.dataset.sceneSigmaNs, h.report.bunch.sigma_t_out_ns);
  const mid = h.scene.renderFrame(.4), b = h.report.bunch, g = .4 * b.dt_dE_ns_per_eV;
  near((+mid.dataset.sceneSigmaNs) ** 2, b.initial_sigma_t_ns ** 2 + g * g * b.sigma_E_eV ** 2 + 2 * g * b.covariance_ns_eV);
 }
});
test('compression preset chooses the analytical drift minimum for its stated correlation', () => {
 const h = fixture('bunch'); h.button('bunch_focus').fire('click'); const change = h.changes.at(-1), b = h.report.bunch;
 assert.equal(change['rx-rho'], .95); const g = b.dt_dE_ns_per_eV * change['rx-L'] / +h.inputs['rx-L']; near(g, -.95 * b.initial_sigma_t_ns / b.sigma_E_eV);
 h.button('bunch_defocus').fire('click'); assert.equal(h.changes.at(-1)['rx-rho'], -.85);
});
test('scene exposes the near-focus limitation instead of claiming a finite resolved pulse', () => {
 const b = fixture('bunch').report.bunch, h = fixture('bunch', { 'rx-rho': '1', 'rx-st': String(-b.dt_dE_ns_per_eV * b.sigma_E_eV) });
 assert.ok(text(h.scene.renderFrame(1)).includes(labels.en.bunch_near_focus));
});
test('scan frames reveal calculated rows and applying voltage preserves the selected convention', () => {
 const h = fixture('scan'); h.scene.renderFrame(.5); const r = h.rows[Math.floor((h.rows.length - 1) / 2)];
 near(+h.scene.getSVG().dataset.sceneParameter, r.scan_value); near(+h.scene.getSVG().dataset.sceneQ, r.q);
 h.button('scan_use').fire('click'); near(h.changes.at(-1)['ms-V'], r.voltage_rod_peak_V * 4);
 h.scene.renderFrame(1); assert.equal(+h.scene.getSVG().dataset.sceneIndex, h.rows.length - 1);
});
test('scan presets reference the shared point rather than the first scan sample', () => {
 const h = fixture('scan', { 'rx-scan-axis': 'frequency', 'rx-vmin': '.1', 'rx-vmax': '2' });
 h.button('scan_frequency_preset').fire('click'); near(h.changes.at(-1)['rx-vmin'], .7 * .4); near(h.changes.at(-1)['rx-vmax'], .7 * 2);
 h.button('scan_voltage_preset').fire('click'); const top = h.changes.at(-1)['rx-vmax']; near(M.parameters(100, 1, 0, top, 10, .7).q, 1.2);
});
test('all scene languages and narrow frames have defined text and lifecycle leaves the primary figure intact', () => {
 assert.deepEqual(Object.keys(labels.en).sort(), Object.keys(labels.zh).sort());
 for (const lang of ['en', 'zh']) for (const kind of ['gas', 'bunch', 'scan']) for (const width of [200, 244, 800]) {
  const h = fixture(kind, {}, width, lang), svg = h.scene.renderFrame(.5);
  assert.ok(!/NaN|undefined|gas_step|bunch_step|scan_step/.test(text(svg))); assert.ok(+svg.attrs.width <= width); assert.ok(+svg.attrs.height > 100);
  h.scene.destroy(); assert.equal(h.chart.children.length, 1); assert.equal(h.chart.children[0], h.original); assert.equal(h.scene.getSVG(), null);
 }
});
