'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../static/js/rfq-workbench.js'),M=require('../static/js/mathieu-core.js');
const close=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<eps*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const point={mass_u:100,charge:1,U_V:-3,V_rod_peak_V:150,r0_mm:10,f_MHz:.7};
test('the four stated voltage conventions produce the same field and q',()=>{
 const v=H.conversions(150);assert.deepEqual(v,{'rod-peak':150,'rod-pp':300,'differential-peak':300,'differential-pp':600});
 for(const [convention,value]of Object.entries(v)){
  const p=M.parameters(100,1,-3,H.toRodPeak(value,convention),10,.7);
  close(p.q,.29926555280314987);assert.ok(p.a<0);
 }
 for(const bad of [NaN,Infinity,-1,'150',null])assert.throws(()=>H.toRodPeak(bad));
 assert.throws(()=>H.toRodPeak(150,'Vpp'));assert.throws(()=>H.fromRodPeak(Number.MAX_VALUE,'differential-pp'));
});
test('first-order uncertainty agrees with analytic scaling and independent finite differences',()=>{
 const sigma={mass_u:.1,V_rod_peak_V:1.5,r0_mm:.02,f_MHz:.0007};
 const r=H.uncertainty(point,sigma);
 close(r.relative_sigma_q,Math.sqrt(.001**2+.01**2+(.004)**2+.002**2));
 close(r.contributions.reduce((sum,c)=>sum+c.variance_fraction,0),1);
 const q=p=>M.parameters(p.mass_u,p.charge,p.U_V,p.V_rod_peak_V,p.r0_mm,p.f_MHz).q;
 for(const c of r.contributions){const step=point[c.input]*1e-5,numerical=(q({...point,[c.input]:point[c.input]+step})-q({...point,[c.input]:point[c.input]-step}))/(2*step);close(c.derivative,numerical,2e-9);}
 for(const bad of [-1,NaN,Infinity])assert.throws(()=>H.uncertainty(point,{...sigma,f_MHz:bad}));
});
test('zero RF retains a finite absolute dq/dV and does not invent relative uncertainty',()=>{
 const r=H.uncertainty({...point,V_rod_peak_V:0},{mass_u:0,V_rod_peak_V:2,r0_mm:0,f_MHz:0});
 assert.equal(r.q,0);assert.equal(r.relative_sigma_q,null);close(r.sigma_q,2*M.parameters(100,1,0,1,10,.7).q);
});
const defaults={'ms-mass':'100','ms-charge':'1','ms-U':'-3','ms-V':'150','ms-r0':'10','ms-f':'.7','ms-geometry':'linear','ms-mode':'voltage','ms-species':'','ms-voltage-convention':'rod-peak','ms-sigma-V':'0','ms-uncertainty-on':false,'ms-rod-rule':'optimal','ms-rod-radius':'1'};
test('RFQ edition URLs always pair AME and NUBASE from one year and never silently fall back',()=>{
 const urls={catalogue:'/data/nuclear-states2026.json',ame:'/data/ame2026.json',
             catalogue2020:'/data/nuclear-states.json',ame2020:'/data/ame2020.json'};
 const y26=H.evaluationSources('2026',urls),y20=H.evaluationSources('2020',urls);
 assert.deepEqual({...y26},{edition:'2026',catalogue:urls.catalogue,ame:urls.ame,massEdition:'AME2026',stateEdition:'NUBASE2026'});
 assert.deepEqual({...y20},{edition:'2020',catalogue:urls.catalogue2020,ame:urls.ame2020,massEdition:'AME2020',stateEdition:'NUBASE2020'});
 for(const year of ['2016','2027','','latest'])assert.throws(()=>H.evaluationSources(year,urls),/edition/);
 assert.throws(()=>H.evaluationSources('2020',{...urls,ame2020:''}),/URLs required/);
 assert.throws(()=>H.evaluationSources('2026',{...urls,catalogue:null}),/URLs required/);
});
test('new edition setting is validated, old saved lookup settings retain historical 2020 edition',()=>{
 const defaults26={...defaults,'ms-evaluation':'2026'};
 const old={schema:'traps-mathieu-v1',inputs:Object.fromEntries(Object.entries(defaults).filter(([k])=>k!=='ms-voltage-convention'&&k!=='ms-sigma-V'&&k!=='ms-uncertainty-on'&&k!=='ms-rod-rule'))};
 const restored=H.normalizeSettings(old,defaults26);
 assert.equal(restored.inputs['ms-evaluation'],'2020');
 assert.throws(()=>H.normalizeSettings({...old,inputs:{...old.inputs,'ms-evaluation':'2025'}},defaults26),/edition/);
 const saved={...old,inputs:{...old.inputs,'ms-evaluation':'2026'}};
 assert.equal(H.normalizeSettings(saved,defaults26).inputs['ms-evaluation'],'2026');
 const source={label:'133Cs+',ionMassU:132.9,source:'AME2026',evaluation:'2026',metadata:{q:1}};
 assert.equal(H.sourceForInputs(source,{...defaults26,'ms-mass':'132.9'},'manual').evaluation,'2026');
 assert.deepEqual(H.sourceForInputs(source,{...defaults26,'ms-mass':'132.9','ms-evaluation':'2020'},'manual'),{label:'manual'});
});
test('legacy settings mean rod peak and never inherit the currently selected display convention',()=>{
 const inputs={...defaults};delete inputs['ms-voltage-convention'];delete inputs['ms-sigma-V'];delete inputs['ms-uncertainty-on'];delete inputs['ms-rod-rule'];
 const r=H.normalizeSettings({schema:'traps-mathieu-v1',inputs},{...defaults,'ms-voltage-convention':'differential-pp'});
 assert.equal(r.voltage.convention,'rod-peak');assert.equal(r.voltage.rod_peak_V.main,150);assert.equal(r.inputs['ms-V'],'150');assert.equal(r.inputs['ms-rod-rule'],'radius');
});
test('new settings retain physical amplitude and reject contradictory serialized values',()=>{
 const raw={schema:'traps-mathieu-v2',inputs:{...defaults,'ms-V':'600','ms-voltage-convention':'differential-pp'},voltage:{convention:'differential-pp',rod_peak_V:{main:150,sigma:0}}};
 const r=H.normalizeSettings(raw,defaults);assert.equal(r.inputs['ms-V'],'600');assert.equal(r.voltage.rod_peak_V.main,150);
 assert.deepEqual(H.normalizeSettings({schema:'traps-rfq-stages-v1',settings:raw},defaults),r);
 assert.deepEqual(H.normalizeSettings({schema:'traps-rfq-design-v1',settings:raw},defaults),r);
 assert.throws(()=>H.normalizeSettings({...raw,voltage:{...raw.voltage,rod_peak_V:{main:600,sigma:0}}},defaults));
 assert.throws(()=>H.normalizeSettings({...raw,inputs:{...raw.inputs,'ms-invented':'1'}},defaults));
 assert.throws(()=>H.normalizeSettings({...raw,inputs:{...raw.inputs,'ms-uncertainty-on':'false'}},defaults));
});
test('catalogue attribution requires the saved numerical mass and charge to match the lookup',()=>{
 const source={label:'Example ion',ionMassU:100,source:'catalogue',metadata:{q:1}};
 assert.equal(H.sourceForInputs(source,defaults,'manual').source,'catalogue');
 for(const inputs of [{...defaults,'ms-mass':'99'},{...defaults,'ms-charge':'2'}])assert.deepEqual(H.sourceForInputs(source,inputs,'manual'),{label:'manual'});
 assert.deepEqual(H.sourceForInputs({label:'Example ion'},defaults,'manual'),{label:'manual'});
});
