const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const R = require('../static/js/ame-reference.js');
const json = JSON.parse(fs.readFileSync('static/data/research-cache/ame2020-reference.json', 'utf8')), ref = R.fromJson(json);

test('isotope labels in the usual spellings', () => {
  for (const s of ['48Ca', '48 Ca', '48-Ca', 'Ca48', 'Ca-48', 'ca 48', ' CA48 ']) assert.deepEqual(R.parseIsotope(s), { symbol: 'Ca', A: 48 }, s);
  for (const s of ['', 'Ca', '48', 'Calcium48', '4 8Ca', null]) assert.equal(R.parseIsotope(s), null, String(s));
});
test('published AME2020 values, not marginal combinations: 48Ca and the 155Eu beta-minus Q value with its published uncertainty', () => {
  const ca = ref.info('Ca', 48);
  assert.equal(ca.massExcessKeV.v, -44224.868); assert.equal(ca.massExcessKeV.s, 0.018);
  assert.ok(Math.abs(ca.atomicMassU.v - (48 - 44224.868 / R.U_KEV)) < 1e-12);               // 47.952252…
  assert.ok(Math.abs(ca.atomicMassU.v - 47.952522654) < 1e-9);   // AME2020 atomic mass of 48Ca in u
  assert.equal(ca.bindingPerNucleonKeV.v, 8666.6916); assert.ok(Math.abs(ca.bindingKeV.v - 416001.1968) < 1e-6);
  const eu = ref.info('Eu', 155); assert.equal(eu.qbm.v, 251.9612); assert.equal(eu.qbm.s, 0.8682);
});
test('Q(EC) is the published Q(beta-) of the isobar below with the opposite sign; missing values stay null', () => {
  const col = json.columns.indexOf('qbm'), ar = ref.lookup('Ar', 40);
  assert.equal(ref.info('K', 40).qec.v, -ar.row[col]);
  assert.equal(ref.info('K', 40).qec.s, ar.row[col + 1]);
  assert.equal(ref.info('He', 3).sn, null);
  assert.equal(ref.info('Xx', 3), null); assert.equal(ref.info('Ca', 300), null);
});
test('estimated (#) values keep their flag', () => {
  const he = ref.info('He', 3); assert.equal(he.qbm.est, true);
  assert.equal(ref.info('Ca', 48).massExcessKeV.est, false);
});
test('ion mass subtracts q electron masses', () => {
  const a = ref.info('Ar', 40), i = R.ionMassU(a, 1);
  assert.ok(Math.abs(a.atomicMassU.v - i.v - R.ELECTRON_U) < 1e-15);
});

/* the binder, with the smallest possible DOM stand-in */
function fakeInput(value = '') { const l = {}; return { value, checked: false, textContent: '', addEventListener(t, f) { (l[t] ||= []).push(f); }, dispatchEvent(e) { (l[e.type] || []).forEach(f => f(e)); }, fire(t) { this.dispatchEvent({ type: t }); } }; }
global.Event = class { constructor(type) { this.type = type; } };
test('binder fills while the box is ticked, an own value unticks it, re-ticking restores the AME2020 value', async () => {
  const iso = fakeInput('48Ca'), check = fakeInput(); check.checked = true; const mass = fakeInput('1'), sig = fakeInput(''), status = fakeInput(); let inputs = 0; mass.addEventListener('input', () => inputs++);
  const b = R.bind({ load: async () => ref, isotope: iso, check, fields: [{ el: mass, key: 'massU' }, { el: sig, key: 'massU_s' }], status });
  await b.refill();
  assert.ok(Math.abs(Number(mass.value) - 47.952522654) < 1e-9); assert.ok(Number(sig.value) > 0 && Number(sig.value) < 1e-6); assert.match(status.textContent, /AME2020 · 48Ca/); assert.ok(inputs >= 1);
  assert.equal(check.checked, true);                                  // a fill is not an edit
  mass.value = '47.9'; mass.fire('input'); assert.equal(check.checked, false); assert.equal(mass.value, '47.9');
  iso.value = '40Ca'; iso.fire('input'); await Promise.resolve(); assert.equal(mass.value, '47.9');   // unticked: the visitor's value survives an isotope change
  check.checked = true; check.fire('change'); await new Promise(r => setTimeout(r, 0));
  assert.ok(Math.abs(Number(mass.value) - 39.96259) < 1e-4);
});
test('binder reports an unknown isotope and fills ion masses with the charge state', async () => {
  const iso = fakeInput('Xx99'), check = fakeInput(), m = fakeInput(), charge = fakeInput('2'), status = fakeInput(); check.checked = true;
  const b = R.bind({ load: async () => ref, isotope: iso, check, fields: [{ el: m, key: 'massU', ion: true }], charge, status });
  await b.refill(); assert.match(status.textContent, /not in AME2020/); assert.equal(m.value, '');
  iso.value = '40Ar'; await b.refill(); const atom = ref.info('Ar', 40).atomicMassU.v;
  assert.ok(Math.abs(Number(m.value) - (atom - 2 * R.ELECTRON_U)) < 1e-9);
  charge.value = '1'; charge.fire('input'); await new Promise(r => setTimeout(r, 0)); assert.ok(Math.abs(Number(m.value) - (atom - R.ELECTRON_U)) < 1e-9);
});

test('every label has all six languages, long texts are real translations, and nothing is empty', () => {
  const keys = Object.keys(R.LABELS); assert.ok(keys.length >= 19);
  for (const k of keys) {
    assert.equal(R.LABELS[k].length, 6, k);
    R.LABELS[k].forEach((v, i) => { assert.ok(typeof v === 'string' && v.trim(), k + ' ' + i); if (R.LABELS[k][0].length > 60 && i > 0) assert.notEqual(v, R.LABELS[k][0], k + ' ' + i); });
  }
  assert.equal(R.translator('zh-hans')('ame_use'), R.LABELS.ame_use[1]); assert.equal(R.translator('fr')('ame_use'), R.LABELS.ame_use[5]);
  assert.equal(R.translator('xx')('ame_use'), R.LABELS.ame_use[0]); assert.equal(R.translator('en')('no_such_key'), 'no_such_key');
});
test('rows lists mass, binding energy, separation energies and Q values with published uncertainties and the # flag', () => {
  const t = R.translator('en'), r = R.rows(ref.info('Ca', 48), t), by = Object.fromEntries(r);
  assert.equal(r.length, 12); assert.equal(by['Mass excess / keV'], '-44224.868 ± 0.018'); assert.equal(by['Binding energy per nucleon / keV'], '8666.6916 ± 0.0004');
  assert.equal(by['Q(β⁻) / keV'], '279.2155 ± 4.9');
  assert.match(R.rows(ref.info('He', 3), t).find(x => x[0] === 'Q(β⁻) / keV')[1], / #$/);          // extrapolated value is marked
  assert.equal(R.rows(ref.info('He', 3), t).find(x => x[0] === 'S(n) / keV')[1], '—');             // not published
});
