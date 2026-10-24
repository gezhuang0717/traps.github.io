'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../static/js/mathieu-core.js');
const base={mass_u:100,charge:1,U_V:0,V_V:100,r0_mm:10,f_MHz:1,rod_count:4,rod_radius_mm:1,radial_fraction:.5,eta_target:.3};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function ui(){
 const fs=require('node:fs'),vm=require('node:vm'),T=JSON.parse(fs.readFileSync('data/mathieu_labels.json')).en;
 class E{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.dataset={};this.textContent='';this.hidden=false;}setAttribute(k,v){this[k]=v;}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;this.textContent='';}addEventListener(k,fn){this[k]=fn;}querySelectorAll(){return [];} }
 const fields=new Map(),slots=new Map(),buttons=new Map(),root=new E(),saved=[];
 const vals={geometry:'linear',mode:'voltage',bands:'3',qmax:'2',amin:'-1',amax:'1',mass:'100',charge:'1',U:'0',V:'100',r0:'10',f:'1',a:'0',q:'.4','rod-count':'4','rod-radius':'1','radial-fraction':'.5','eta-target':'.3',vscan:'50,100,150,200',species:'133Cs+'};
 for(const[k,v]of Object.entries(vals)){const e=new E('input');e.name='ms-'+k;e.value=v;e.type='text';fields.set(k,e);}
 for(const k of ['cooler','mf','bun']){const e=new E('input');e.name='ms-'+k+'-on';e.type='checkbox';e.checked=false;fields.set(k+'-on',e);}
 for(const k of ['error','figure','design','design-figure','design-readout','sections','band-formula','formula','mapping','readout','source','file','style'])slots.set(k,new E());
 for(const k of ['svg','png','csv'])buttons.set(k,new E('button'));
 root.dataset={labels:JSON.stringify(T),lang:'en'};
 root.querySelector=q=>{const f=q.match(/^\[name="ms-(.+)"\]$/);if(f)return fields.get(f[1])||null;const b=q.match(/^\[data-ms-action="(.+)"\]$/);if(b)return buttons.get(b[1]);return slots.get(q.replace(/^\[data-ms-|\]$/g,''))||null;};
 root.querySelectorAll=q=>q==='[name^="ms-"]'?[...fields.values()]:[];
 const exp={save:(blob,name)=>saved.push({blob,name})},context={window:{ZGMathieu:M,zgExport:exp},zgExport:exp,document:{querySelectorAll:()=>[root],createElement:tag=>new E(tag),createElementNS:(_,tag)=>new E(tag)},Blob,URL,setTimeout:fn=>{fn();return 1;},clearTimeout(){},console};
 vm.runInNewContext(fs.readFileSync('static/js/rfq-mathieu.js','utf8'),context);
 const change=(name,value)=>{fields.get(name).value=value;root.input({target:fields.get(name),stopPropagation(){}});};
 const click=action=>root.click({stopPropagation(){},target:{closest:()=>({dataset:{msAction:action}})}});
 return{fields,slots,buttons,saved,change,click,T};
}
test('round rods keep an explicit aperture, clearance, alternating phases and coordinates',()=>{
 for(const rod_count of [4,6,8,10,24]){const d=M.rodDesign({...base,rod_count});close(d.center_radius_mm,11);close(d.adjacent_center_mm,22*Math.sin(Math.PI/rod_count));close(d.surface_gap_mm,d.adjacent_center_mm-2);close(d.opposite_center_mm,22);assert.equal(d.rod_coordinates.length,rod_count);for(const [i,p]of d.rod_coordinates.entries()){close(Math.hypot(p.x_mm,p.y_mm),11);assert.equal(p.phase,i%2?-1:1);}}
});
test('quadrupole adiabaticity equals the conventional q and Mathieu bridge includes DC',()=>{
 const d=M.rodDesign(base),p=M.parameters(100,1,0,100,10,1);close(d.eta,p.q);assert.deepEqual(d.parameters,p);assert.equal(d.classification.status,'stable');
 const dc=M.rodDesign({...base,U_V:100});assert.equal(dc.classification.status,'unstable');
});
test('multipole radial powers are independently consistent with the RF gradient',()=>{
 const a=M.rodDesign({...base,rod_count:8,radial_fraction:.25}),b=M.rodDesign({...base,rod_count:8,radial_fraction:.5});
 close(b.field_RF_V_m/a.field_RF_V_m,8);close(b.pseudopotential_eV/a.pseudopotential_eV,64);close(b.eta/a.eta,4);
 const mass=base.mass_u*M.C.u,omega=2*Math.PI*1e6,Q=M.C.e;close(b.pseudopotential_eV,Q*Q*b.field_RF_V_m**2/(4*mass*omega**2)/M.C.e);
 assert.equal(b.classification,null);assert.equal(b.parameters,null);assert.equal(b.model,'ideal-multipole-adiabatic');
});
test('RF limits invert the chosen eta at the chosen radius without a universal threshold',()=>{
 const d=M.rodDesign({...base,rod_count:6,eta_target:.17});
 close(M.rodDesign({...base,rod_count:6,eta_target:.17,V_V:d.eta_voltage_max_V}).eta,.17);
 close(M.rodDesign({...base,rod_count:6,eta_target:.17,f_MHz:d.eta_frequency_min_MHz}).eta,.17);
 const doubled=M.rodDesign({...base,rod_count:6,f_MHz:2});close(doubled.eta,d.eta/4);close(doubled.pseudopotential_eV,d.pseudopotential_eV/4);
});
test('zero RF can satisfy an eta target while providing zero RF confinement energy',()=>{
 const d=M.rodDesign({...base,rod_count:6,V_V:0});assert.equal(d.eta,0);assert.equal(d.pseudopotential_eV,0);assert.equal(d.eta_target_met,true);assert.equal(d.classification,null);assert.equal(d.eta_frequency_min_MHz,0);assert.ok(d.eta_voltage_max_V>0);
});
test('invalid, overlapping or touching geometry and nonphysical scan inputs fail closed',()=>{
 for(const change of [{rod_count:5},{rod_count:26},{rod_radius_mm:100},{radial_fraction:0},{radial_fraction:1.1},{eta_target:0},{mass_u:''},{f_MHz:NaN},{V_V:-1},{charge:1.5}])assert.throws(()=>M.rodDesign({...base,...change}));
 for(const values of [[],[NaN],[-1],Array(13).fill(10)])assert.throws(()=>M.voltageCandidates(base,values));
});
test('candidate RF amplitudes retain individual four-rod decisions and audit logs roundtrip',()=>{
 const log=M.designLog({...base,U_V:3},[0,100,500],'2026-10-24T12:00:00Z');assert.equal(log.schema,'traps-rfq-design-v1');const reopened=JSON.parse(JSON.stringify(log));assert.equal(JSON.stringify(reopened),JSON.stringify(log));assert.deepEqual(reopened.inputs,log.inputs);close(reopened.result.pseudopotential_eV,log.result.pseudopotential_eV);assert.equal(log.candidates.length,3);assert.ok(log.candidates.every(c=>c.classification&&c.classification.geometry==='linear'));assert.ok(log.sources.every(s=>s.startsWith('https://')));assert.match(log.units.voltage,/differential peak=2V/);assert.match(log.limits,/not a stability guarantee/);assert.ok(log.equations.eta&&log.constants.atomic_mass_kg);
 const higher=M.designLog({...base,rod_count:10},[0,100]);assert.ok(higher.candidates.every(c=>c.classification===null));
});
test('actual UI draws geometry, suppresses higher-pole Mathieu output, and saves the calculated log',async()=>{
 const h=ui();assert.equal(h.slots.get('error').textContent,'');assert.equal(h.slots.get('design-figure').children[0].tag,'svg');
 h.change('rod-count','6');assert.equal(h.slots.get('figure').hidden,true);assert.equal(h.buttons.get('csv').disabled,true);assert.equal(h.slots.get('readout').children[0].textContent,h.T.multipole);
 await h.click('design-json');const log=JSON.parse(await h.saved[0].blob.text());assert.equal(log.result.rod_count,6);assert.equal(log.result.classification,null);assert.equal(log.candidates.length,4);
 await h.click('design-csv');const csv=await h.saved[1].blob.text();assert.match(csv,/"mass_u","100","u"/);assert.match(csv,/traps-rfq-design-v1/);assert.match(csv,/eta-target-only/);
 h.change('V','0');assert.ok(h.slots.get('design-readout').children.some(e=>e.textContent===h.T.zero_rf));
 h.change('rod-radius','100');assert.equal(h.slots.get('design-figure').children.length,0);assert.ok(h.slots.get('error').textContent.startsWith(h.T.rod_overlap));
});
test('actual settings loader accepts the earlier schema without rod fields and restores design defaults',async()=>{
 const h=ui();await h.click('save');const settings=JSON.parse(await h.saved[0].blob.text());
 for(const k of ['rod-count','rod-radius','radial-fraction','eta-target','vscan'])delete settings.inputs['ms-'+k];
 h.change('rod-count','8');const file={size:5000,text:async()=>JSON.stringify(settings)},input=h.slots.get('file');input.files=[file];await input.change({target:input,stopPropagation(){}});
 assert.equal(h.fields.get('rod-count').value,'4');assert.equal(h.slots.get('figure').hidden,false);assert.equal(h.slots.get('error').textContent,'');
});
