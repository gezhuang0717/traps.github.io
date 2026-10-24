const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const S = require('../static/js/spectroscopy-settings.js'), DS = require('../static/js/spectroscopy-data.js');
const FS = require('../static/js/figure-style.js');
const source = fs.readFileSync('static/js/spectroscopy.js', 'utf8');
const start = source.indexOf('    async function applySettings(value){'), end = source.indexOf('\n    file.onchange=', start);

// Run the actual UI restoration function with select option and event semantics.
// Dataset handlers rebuild the dependent choices, as a fresh browser page does.
function page() {
  const fields = new Map(), events = [];
  function input(name, value = '', options, type = 'text') {
    let current = value;
    const i = { name, type, tagName: options ? 'SELECT' : 'INPUT', options: (options || []).map(value => ({ value })), checked: type === 'checkbox',
      get value() { return current; }, set value(v) { current = options && !this.options.some(o => o.value === v) ? '' : v; },
      dispatchEvent(e) { events.push([name, e.type]); this.change?.(); } };
    fields.set(name, i); return i;
  }
  input('radius-dataset', 'builtin', ['builtin', 'iaea', 'user']); input('radius-user');
  input('radius-element', 'Ca', ['Ca']); input('radius-reference', '40', ['40', '48']);
  input('moment-dataset', 'builtin', ['builtin', 'iaea', 'user']); input('moment-user'); input('moment-element', 'Rb', ['Rb']);
  input('levels-dataset', 'builtin', ['builtin', 'user']); input('levels-user'); input('nuclear-scheme', '0', ['0']);
  input('max-energy', '10000'); input('radiusShift-isotope-use-ame', 'on', null, 'checkbox'); input('radiusShift-massU', '42');
  const data = { charge_radii: [{ element: 'Ca', A: 40 }, { element: 'Ca', A: 48 }], moments: [{ element: 'Rb', A: 87 }] };
  let tab = 'sp-radii', calculations = 0;
  const buttons = ['sp-radii', 'sp-moments', 'sp-levels', 'sp-cls', 'sp-beta', 'sp-datacode'].map(id => ({ getAttribute: () => id, click() { tab = id; } }));
  const snapshot = () => ({ schema: S.schema, inputs: Object.fromEntries([...fields].map(([n, i]) => [n, i.type === 'checkbox' ? String(i.checked) : i.value])), activeTab: tab });
  const setOptions = (name, options) => { const i = fields.get(name); i.options = options.map(value => ({ value })); i.value = options[0] || ''; };
  const radii = () => fields.get('radius-dataset').value === 'user' ? DS.parseTable(fields.get('radius-user').value, 'radii').rows : data.charge_radii;
  fields.get('radius-dataset').change = () => { setOptions('radius-element', [...new Set(radii().map(r => r.element))]); fields.get('radius-element').change(); };
  fields.get('radius-element').change = () => setOptions('radius-reference', radii().filter(r => r.element === fields.get('radius-element').value).map(r => String(r.A)));
  fields.get('moment-dataset').change = () => { const rows = fields.get('moment-dataset').value === 'user' ? DS.parseTable(fields.get('moment-user').value, 'moments').rows : data.moments; setOptions('moment-element', [...new Set(rows.map(r => r.element))]); };
  fields.get('levels-dataset').change = () => { fields.get('max-energy').value = '99999'; };
  const context = { S, DS, FS, data, iaea: null, iaeaReady: Promise.resolve(), snapshot, Event: class { constructor(type) { this.type = type; } },
    root: { querySelectorAll: () => [...fields.values()] }, tabs: { children: buttons }, methods: { querySelectorAll: () => [{ querySelector: selector => selector === '[data-sp-calculate]' ? { click() { calculations++; } } : null }] } };
  vm.createContext(context); vm.runInContext(source.slice(start, end) + '\nthis.restore = applySettings;', context);
  return { fields, events, snapshot, restore: context.restore, get calculations() { return calculations; } };
}

test('own radii/moments tables load before dataset element/reference choices, regardless of saved key order', async () => {
  for (const reverse of [false, true]) {
    const p = page(), entries = [['radius-dataset', 'user'], ['radius-element', 'K'], ['radius-reference', '41'], ['moment-dataset', 'user'], ['moment-element', 'Sn'], ['radius-user', 'K,39,3.4349,.0023\nK,41,3.451,.003'], ['moment-user', 'Sn,119,1/2,-1,.1'], ['levels-dataset', 'user'], ['levels-user', 'level,gs,0,,0+\nlevel,a,20,,2+'], ['max-energy', '25'], ['radiusShift-isotope-use-ame', 'false'], ['radiusShift-massU', '119']];
    await p.restore({ schema: S.schema, inputs: Object.fromEntries(reverse ? entries.reverse() : entries), activeTab: 'sp-cls' });
    assert.equal(p.fields.get('radius-element').value, 'K'); assert.equal(p.fields.get('radius-reference').value, '41');
    assert.equal(p.fields.get('moment-element').value, 'Sn'); assert.equal(p.fields.get('max-energy').value, '25');
    assert.equal(p.fields.get('radiusShift-isotope-use-ame').checked, false); assert.equal(p.fields.get('radiusShift-massU').value, '119');
    assert.equal(p.snapshot().activeTab, 'sp-cls'); assert.equal(p.calculations, 1);
  }
});
test('invalid dependent selection or active user table leaves all prior settings unchanged', async () => {
  for (const bad of [{ 'radius-dataset': 'user', 'radius-element': 'Sn', 'radius-user': 'K,39,3.4,.01' }, { 'radius-dataset': 'user', 'radius-user': 'Ca,40,-1,.01' }, { 'radiusShift-isotope-use-ame': 'yes' }]) {
    const p = page(), before = p.snapshot(); await assert.rejects(p.restore({ schema: S.schema, inputs: bad, activeTab: 'sp-beta' }));
    assert.deepEqual(p.snapshot(), before); assert.equal(p.events.length, 0);
  }
});
test('restoration invokes calculation controls without activating preset-fill buttons', async () => {
  const p = page(); await p.restore({ schema: S.schema, inputs: { 'radiusShift-massU': '55' }, activeTab: 'sp-datacode' });
  assert.equal(p.calculations, 1); assert.equal(p.fields.get('radiusShift-massU').value, '55'); assert.equal(p.snapshot().activeTab, 'sp-datacode');
});
