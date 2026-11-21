'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../static/js/rfq-preset.js');
const M = require('../static/js/mathieu-core.js');
const BASE = 'https://gezhuang0717.github.io/traps.github.io/zh-hans/lab/?existing=keep#old';
const original = {
  mass_u: 132.9049034, charge: 1, U_V: 3,
  V_rod_peak_V: 122, r0_mm: 10, f_MHz: 1.3, species: '133Cs+'
};
test('Game -> Lab scientific preset keeps the project path, language, isotope label and exact numbers', () => {
  const target = new URL(R.link(BASE, original));
  assert.equal(target.pathname, '/traps.github.io/zh-hans/lab/');
  assert.equal(target.hash, '#rfq-workbench');
  assert.equal(target.searchParams.get('existing'), 'keep');
  assert.equal(target.searchParams.get('rfq_preset'), 'v1');
  assert.equal(target.searchParams.get('rfq_voltage_convention'), 'rod-peak');
  assert.deepEqual(R.parse(target.search), original);
  assert.deepEqual(R.parse(R.link(target.href, original).split('?')[1].split('#')[0]), original);
});
test('Transferred q and a agree with the exact Mathieu rod-peak convention (no spurious 2x)', () => {
  const p = R.parse(new URL(R.link(BASE, original)).search);
  const same = M.parameters(p.mass_u, p.charge, p.U_V, p.V_rod_peak_V, p.r0_mm, p.f_MHz);
  const differentialAsRodPeak = M.parameters(p.mass_u, p.charge, p.U_V, 2*p.V_rod_peak_V, p.r0_mm, p.f_MHz);
  assert.ok(Math.abs(differentialAsRodPeak.q/same.q - 2) < 1e-12);
  assert.ok(Math.abs(same.q - 4*p.charge*M.C.e*p.V_rod_peak_V/
    (p.mass_u*M.C.u*(p.r0_mm/1000)**2*(2*Math.PI*p.f_MHz*1e6)**2)) < 1e-14);
  assert.equal(same.mass_u, original.mass_u);
});
test('Ill-defined, missing or changed conventions fail closed', () => {
  assert.equal(R.parse('?unrelated=1'), null);
  for(const key of ['mass_u','charge','U_V','V_rod_peak_V','r0_mm','f_MHz']) {
    const u=new URL(R.link(BASE, original));
    u.searchParams.delete(key);
    assert.throws(() => R.parse(u.search), /Missing/);
  }
  for(const override of [
    {mass_u:0}, {mass_u:NaN}, {mass_u:''}, {charge:1.5}, {charge:0},
    {V_rod_peak_V:-1}, {r0_mm:0}, {f_MHz:0}, {f_MHz:Infinity},
    {species:'x'.repeat(101)}
  ]) assert.throws(() => R.link(BASE, {...original,...override}));
  const wrong = new URL(R.link(BASE, original));
  wrong.searchParams.set('rfq_voltage_convention','differential');
  assert.throws(() => R.parse(wrong.search), /convention/);
  wrong.searchParams.set('rfq_voltage_convention','rod-peak');
  wrong.searchParams.set('rfq_preset','v2');
  assert.throws(() => R.parse(wrong.search), /convention/);
});
test('Signed DC and multiple charge states survive transfer without truncation', () => {
  const p={...original,charge:2,U_V:-4.125,V_rod_peak_V:0.00029,f_MHz:0.99999,species:'133Cs+2'};
  assert.deepEqual(R.parse(new URL(R.link(BASE,p)).search),p);
});
test('Mathieu defaults are transparent manual values, not a false Cs-133 catalogue lookup', () => {
  const root=path.resolve(__dirname,'..');
  const mathieu=fs.readFileSync(path.join(root,'layouts/_partials/zg/rfq-mathieu.html'),'utf8');
  const game=fs.readFileSync(path.join(root,'layouts/_shortcodes/games.html'),'utf8');
  const lab=fs.readFileSync(path.join(root,'layouts/_shortcodes/lab-more.html'),'utf8');
  assert.match(mathieu,/name="ms-species" type="text" value="" placeholder="133Cs\+"/);
  assert.match(mathieu,/name="ms-mass" type="number"[^>]+value="100"/);
  assert.match(mathieu,/id="rfq-workbench"/);
  assert.match(mathieu,/js\/rfq-preset.js/);
  assert.match(game,/data-act="workbench" data-rfq-workbench-link/);
  assert.match(game,/relLangURL \}\}#rfq-workbench/);
  assert.match(lab,/partial "zg\/rfq-mathieu.html"/);
  assert.doesNotMatch(game,/partial "zg\/rfq-mathieu.html"/);
});

test('Lab RFQ keeps stability first and design second with shared inputs and stages', () => {
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'layouts/_partials/zg/rfq-mathieu.html'),'utf8');
  const script=fs.readFileSync(path.join(root,'static/js/rfq-mathieu.js'),'utf8');
  const labels=JSON.parse(fs.readFileSync(path.join(root,'data/mathieu_labels.json'),'utf8'));
  const stability=html.indexOf('data-local-tab="classic"');
  const design=html.indexOf('data-local-tab="design"');
  assert.ok(stability>0 && design>stability, 'the new tab must follow Mathieu');
  assert.ok(html.indexOf('data-local-panel="classic"')>design);
  assert.ok(html.indexOf('data-local-panel="design"')>html.indexOf('data-local-panel="classic"'));
  assert.equal((html.match(/data-mathieu(?:\s|>)/g)||[]).length,1);
  for(const name of ['mass','charge','U','V','r0','f','rod-count'])assert.equal((html.match(new RegExp('name="ms-'+name+'"','g'))||[]).length,1,name);
  assert.equal((html.match(/data-ms-sections/g)||[]).length,1);
  assert.match(html,/data-ms-stage-readout/);
  assert.match(html,/data-ms-design-error/);
  assert.match(script,/function renderStages\(/);
  assert.match(script,/function designErrorText\(/);
  assert.match(script,/function higher\(\)/);
  for(const [lang,d] of Object.entries(labels)){
    assert.ok(d.design_tab_note && d.quadrupole_reference,lang);
    assert.ok(d.design_title && d.title,lang);
  }
});
