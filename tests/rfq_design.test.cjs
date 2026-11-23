'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../static/js/mathieu-core.js'),H=require('../static/js/rfq-workbench.js');
const base={mass_u:100,charge:1,U_V:0,V_V:100,r0_mm:10,f_MHz:1,rod_count:4,rod_radius_mm:1,radial_fraction:.5,eta_target:.3};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function ui({subtabs=false}={}){
 const fs=require('node:fs'),vm=require('node:vm'),T=JSON.parse(fs.readFileSync('data/mathieu_labels.json')).en;
 class E{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.dataset={};this.textContent='';this.hidden=false;this.listeners=new Map();}setAttribute(k,v){this[k]=v;}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;this.textContent='';}addEventListener(k,fn){this[k]=fn;this.listeners.set(k,[...(this.listeners.get(k)||[]),fn]);}dispatchEvent(e){for(const fn of this.listeners.get(e.type)||[])fn(e);return true;}querySelectorAll(){return [];} }
 const fields=new Map(),slots=new Map(),buttons=new Map(),panels=new Map(),root=new E(),saved=[];
 const vals={geometry:'linear',mode:'voltage',bands:'3',qmin:'0',qmax:'2',amin:'-1',amax:'1',mass:'100',charge:'1',U:'0',V:'100',r0:'10',f:'1',a:'0',q:'.4','rod-count':'4','rod-rule':'radius','rod-ratio':'1.145108','diameter-tolerance':'0.05','rod-radius':'1','radial-fraction':'.5','eta-target':'.3',vscan:'50,100,150,200',species:'133Cs+','voltage-convention':'rod-peak','sigma-mass':'0','sigma-V':'0','sigma-r0':'0','sigma-f':'0'};
 for(const[k,v]of Object.entries(vals)){const e=new E('input');e.name='ms-'+k;e.value=v;e.type='text';fields.set(k,e);}
 {const e=new E('input');e.name='ms-uncertainty-on';e.type='checkbox';e.checked=false;fields.set('uncertainty-on',e);}
 for(const k of ['cooler','mf','bun']){const e=new E('input');e.name='ms-'+k+'-on';e.type='checkbox';e.checked=false;fields.set(k+'-on',e);}
 for(const k of ['error','figure','design','design-figure','design-readout','sections','band-formula','formula','mapping','readout','source','file','style','conversions','uncertainty','uncertainty-readout','direct-design','stage-feedback','stage-error'])slots.set(k,new E());
 for(const k of ['svg','png','pdf','csv'])buttons.set(k,new E('button'));
 if(subtabs){for(const name of ['classic','design']){const panel=new E();panel.hidden=name==='design';panels.set(name,panel);}for(const key of ['design-error','reference-note','stage-readout'])slots.set(key,new E());for(const key of ['cooler','mf','bun'])for(const [suffix,num] of [['U',3],['V',122],['r0',10],['f',1.3]]){const e=new E('input');e.name='ms-'+key+'-'+suffix;e.value=String(num);e.type='number';fields.set(key+'-'+suffix,e);}}
 root.dataset={labels:JSON.stringify(T),lang:'en'};
 root.querySelector=q=>{const panel=q.match(/^\[data-local-panel="(.+)"\]$/);if(panel)return panels.get(panel[1])||null;const f=q.match(/^\[name="ms-(.+)"\]$/);if(f)return fields.get(f[1])||null;const b=q.match(/^\[data-ms-action="(.+)"\]$/);if(b)return buttons.get(b[1]);return slots.get(q.replace(/^\[data-ms-|\]$/g,''))||null;};
 root.querySelectorAll=q=>q==='[name^="ms-"]'?[...fields.values()]:[];
 const microtasks=[],flush=()=>{while(microtasks.length)microtasks.shift()();};
 const exp={save:(blob,name)=>saved.push({blob,name})},docObj={querySelectorAll:()=>[root],createElement:tag=>new E(tag),createElementNS:(_,tag)=>new E(tag)},context={window:{ZGMathieu:M,ZGRFQWorkbench:H,zgExport:exp,document:docObj},zgExport:exp,document:{querySelectorAll:()=>[root],createElement:tag=>new E(tag),createElementNS:(_,tag)=>new E(tag)},Blob,URL,CustomEvent:class{constructor(type){this.type=type;}},queueMicrotask:fn=>microtasks.push(fn),setTimeout:fn=>{fn();return 1;},clearTimeout(){},console};
 vm.runInNewContext(fs.readFileSync('static/js/zg-ui.js','utf8'),context);vm.runInNewContext(fs.readFileSync('static/js/rfq-mathieu.js','utf8'),context);
 flush();
 const change=(name,value)=>{fields.get(name).value=value;root.input({target:fields.get(name),stopPropagation(){}});flush();};
 const click=action=>{const result=root.click({stopPropagation(){},target:{closest:()=>({dataset:{msAction:action}})}});flush();return result;};
 const clickTab=name=>{for(const [key,panel]of panels)panel.hidden=key!==name;root.click({stopPropagation(){},target:{closest:selector=>selector==='[data-local-tab]'?{dataset:{localTab:name}}:null}});};
 const stage=(kind,key)=>root.click({stopPropagation(){},target:{closest:selector=>selector==='[data-ms-stage-'+kind+']'?{dataset:{[kind==='apply'?'msStageApply':'msStageCopy']:key}}:null}});
 return{root,fields,slots,buttons,panels,saved,change,click,clickTab,stage,T};
}
test('Lab subtabs keep Mathieu independent of design errors, higher rods and blank inputs',()=>{
 const h=ui({subtabs:true}),figure=h.slots.get('figure'),notice=h.slots.get('design-error');
 assert.equal(figure.children[0].tag,'svg');
 h.change('vscan','not-a-number'); // invalid design scan must not invalidate Mathieu
 assert.equal(figure.children[0].tag,'svg');
 assert.ok(notice.textContent.length>0);
 h.change('vscan','50,100,150,200');
 h.change('rod-count','8');
 assert.equal(figure.hidden,false,'Mathieu remains an independent four-rod ideal reference');
 assert.equal(figure.children[0].tag,'svg');
 h.clickTab('design');
 assert.equal(figure.hidden,true,'do not misclassify 8 rods with quadrupole Mathieu');
 assert.equal(h.slots.get('design-figure').children[0].tag,'svg');
 h.clickTab('classic');
 assert.equal(figure.hidden,false,'returning to Mathieu restores diagram');
 h.change('mass','');
 assert.equal(figure.children.length,0,'blank mass is invalid, not silently zero');
 assert.ok(h.slots.get('error').textContent.length>0);
});
test('Independent stage comparison shares mass and voltage conventions and saves provenance',async()=>{
 const h=ui({subtabs:true});h.fields.get('cooler-on').checked=true;
 h.clickTab('design');
 const holder=h.slots.get('stage-readout');
 assert.equal(holder.children[0].children[0].tag,'table');
 const rows=holder.children[0].children[0].children[1].children;
 assert.equal(rows.length,1);
 assert.equal(rows[0].children[0].textContent,h.T.cooler);
 const q=Number(rows[0].children[6].textContent),p=M.parameters(100,1,3,122,10,1.3);
 assert.ok(Math.abs(q-p.q)<2e-7);
 await h.click('design-json');
 const log=JSON.parse(await h.saved.at(-1).blob.text());
 assert.equal(log.stage_comparison.length,1);
 assert.equal(log.stage_comparison[0].geometry,'ideal-four-rod-linear-RFQ');
 assert.equal(log.stage_comparison[0].q,p.q);
 h.fields.get('cooler-f').value='';
 h.change('mass','100');
 assert.ok(holder.children[0].children[0].children[1].children[0].children[0].textContent.includes(h.T.cooler));
});
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
 for(const k of ['rod-count','rod-rule','rod-ratio','diameter-tolerance','rod-radius','radial-fraction','eta-target','vscan'])delete settings.inputs['ms-'+k];
 h.change('rod-count','8');const file={size:5000,text:async()=>JSON.stringify(settings)},input=h.slots.get('file');input.files=[file];await input.change({target:input,stopPropagation(){}});
 assert.equal(h.fields.get('rod-count').value,'4');assert.equal(h.slots.get('figure').hidden,false);assert.equal(h.slots.get('error').textContent,'');
});

// ---- rod size and distance follow published design rules (owner textbook ch. 1 and 7; free-space round-rod multipole solution) ----
const R=require('../static/js/rfq-rod-ratios.js'),design={mass_u:133,charge:1,U_V:0,V_V:200,r0_mm:6,f_MHz:1,rod_count:4};
test('four rods: the free-space A6-zero table agrees with the rounded published 1.14511 and gives a 6.87 mm rod for r0 = 6 mm',()=>{
 assert.ok(Math.abs(R.rows[4].optimal-1.14511)<1e-5,String(R.rows[4].optimal));
 const d=M.rodDesign({...design,rod_rule:'optimal'});
 assert.ok(Math.abs(d.rod_radius_mm-6.87)<5e-3);assert.ok(Math.abs(d.rod_diameter_mm-13.74)<1e-2);
 close(d.center_radius_mm,6+d.rod_radius_mm);close(d.outer_radius_mm,d.center_radius_mm+d.rod_radius_mm);close(d.aperture_diameter_mm,12);
 close(d.adjacent_center_mm,Math.SQRT2*d.center_radius_mm);close(d.surface_gap_mm,d.adjacent_center_mm-2*d.rod_radius_mm);
 assert.equal(d.rod_rule,'optimal');assert.ok(Math.abs(d.ratio_deviation_percent)<1e-9);
});
test('round-rod attribution distinguishes the numerical free-space table from hardware optimization',()=>{
 const log=M.designLog({...design,rod_rule:'optimal'},[100]);
 assert.ok(log.sources.includes('https://doi.org/10.1016/0029-554X(71)90587-8'));
 assert.ok(log.references.some(s=>/finite-series free-space 2D calculation/.test(s)));
 assert.ok(log.references.some(s=>/not the precise tabulated rod-ratio digits/.test(s)));
 assert.ok(!log.references.some(s=>/Denison.*1\.14511/.test(s)));
});
test('eight rods: 0.37216 reproduces the published numerical optimum (0.372159) and the table is monotonic and below the touching ratio',()=>{
 assert.ok(Math.abs(R.rows[8].optimal-0.372159)<2e-5,String(R.rows[8].optimal));
 let last=Infinity;for(let N=4;N<=24;N+=2){const row=R.rows[N];assert.equal(row.n,N/2);assert.ok(row.optimal<last,N);last=row.optimal;assert.ok(row.optimal<row.touching,N);assert.ok(Math.abs(row.curvature-1/(N/2-1))<1e-8);assert.ok(row.optimal>row.curvature,N);
  assert.ok(row.residual_max<1e-8,`${N}: ${row.residual_max}`);assert.ok(row.optimal_change_with_larger_series<1e-6,N);
  const c=row.curve;assert.ok(c.ratio.every((x,i)=>i===0||x>c.ratio[i-1]));assert.ok(c.ratio[0]<row.optimal&&row.optimal<c.ratio.at(-1));
  assert.ok(c.A3n_over_An[0]>0&&c.A3n_over_An.at(-1)<0,`A_3n changes sign at the optimum for ${N} rods`);}
});
test('the parasitic harmonic changes sign across the optimum and grows away from it (interpolated from the solved curve)',()=>{
 const at=ratio=>M.rodDesign({...design,rod_rule:'ratio',rod_ratio:ratio}).parasitic_A_over_An;
 assert.ok(at(1.12)>0&&at(1.17)<0&&Math.abs(at(1.145108))<5e-5);assert.ok(Math.abs(at(1.0))>Math.abs(at(1.12)));
 const d=M.rodDesign({...design,rod_rule:'ratio',rod_ratio:1.0});close(d.parasitic_at_radial_fraction,d.parasitic_A_over_An*.5**4);
 assert.equal(M.rodDesign({...design,rod_rule:'ratio',rod_ratio:2.2}).parasitic_A_over_An,null);       // outside the solved range: no invented number
});
test('curvature rule, mass-filter compromise and own radius; unavailable or undefined rules fail loudly',()=>{
 close(M.rodDesign({...design,rod_count:8,rod_rule:'curvature'}).rod_ratio,1/3);close(M.rodDesign({...design,rod_rule:'curvature'}).rod_ratio,1);
 close(M.rodDesign({...design,rod_rule:'filter'}).rod_ratio,1.128);assert.throws(()=>M.rodDesign({...design,rod_count:6,rod_rule:'filter'}),/rod rule/);
 const own=M.rodDesign({...design,rod_radius_mm:7});assert.equal(own.rod_rule,'radius');close(own.rod_ratio,7/6);close(own.ratio_deviation_percent,100*(7/6/R.rows[4].optimal-1));
 for(const bad of [{},{rod_rule:'other'},{rod_rule:'ratio'},{rod_rule:'ratio',rod_ratio:-1},{rod_rule:'radius'}])assert.throws(()=>M.rodDesign({...design,...bad}),/rod/);   // no silent default radius any more
 assert.throws(()=>M.rodDesign({...design,rod_rule:'ratio',rod_ratio:3}),/rod overlap/);
});
test('tolerance and RF suggestions: ratio tolerance from the diameter tolerance; suggested peaks give the target q and the book range 0.3-0.5',()=>{
 const d=M.rodDesign({...design,rod_rule:'optimal',diameter_tolerance_mm:.05});close(d.ratio_tolerance,.05/12);assert.equal(M.rodDesign({...design,rod_rule:'optimal'}).ratio_tolerance,null);
 assert.deepEqual(M.Q_RANGE,[.3,.4,.5]);
 for(const s of d.suggested_RF){const q=M.parameters(133,1,0,s.V_rod_peak_V,6,1).q;close(q,s.q);const q2=M.parameters(133,1,0,200,6,s.f_MHz_at_current_V).q;close(q2,s.q);}
 assert.equal(M.rodDesign({...design,rod_count:6,rod_rule:'optimal'}).suggested_RF,null);
 // textbook worked example 2: 133Cs+, r0 = 5 mm, f = 1 MHz, V = 200 V gives q = 0.588 (the book's "design from scratch" chapter claims 0.37 for 10 mm / 0.5 MHz / 200 V: the correct value is 0.588)
 assert.ok(Math.abs(M.parameters(133,1,0,200,5,1).q-.588)<2e-3);assert.ok(Math.abs(M.parameters(133,1,0,200,10,.5).q-.588)<2e-3);
});
test('actual UI: default optimal rule fills the computed radius, shows ratio, parasitic harmonic and RF suggestions; own radius still overlaps loudly',async()=>{
 const h=ui();h.change('rod-rule','optimal');h.change('r0','6');
 const flat=n=>[n.textContent||'',n.title||'',...(n.children||[]).flatMap(flat)],text=h.slots.get('design-readout').children.flatMap(flat).join('\n');
 assert.equal(h.fields.get('rod-radius').disabled,true);assert.equal(h.fields.get('rod-ratio').disabled,true);
 assert.ok(Math.abs(Number(h.fields.get('rod-radius').value)-6.870648)<1e-4,h.fields.get('rod-radius').value);
 for(const label of [h.T.grp_geometry,h.T.k_rod_radius,h.T.k_parasitic,h.T.grp_suggest,h.T.rf_suggest,h.T.k_aperture,h.T.grp_rf,h.T.candidates,h.T.use_btn])assert.ok(text.includes(label),label);
 assert.ok(/q = 0\.4/.test(text)&&/6\.870648/.test(h.fields.get('rod-radius').value));
 const geometry=h.slots.get('design-readout').children.find(n=>/zg-rfold/.test(n.className));
 assert.ok(geometry,'the rod-geometry group is a fold-away group');assert.ok(!geometry.open,'closed by default');
 assert.ok(geometry.children[0].children.some(c=>/Ø/.test(c.textContent)),'its summary line keeps the key numbers');
 h.change('rod-rule','filter');h.change('rod-count','6');assert.equal(h.slots.get('error').textContent,h.T.rule_unavailable);
 h.change('rod-rule','radius');h.change('rod-count','4');h.change('rod-radius','100');assert.ok(h.slots.get('error').textContent.startsWith(h.T.rod_overlap));
});
test('older saved settings with only a rod radius keep meaning "own radius"',async()=>{
 const h=ui();await h.click('save');const settings=JSON.parse(await h.saved[0].blob.text());
 for(const k of ['rod-rule','rod-ratio','diameter-tolerance'])delete settings.inputs['ms-'+k];settings.inputs['ms-rod-radius']='2.5';
 const file={size:5000,text:async()=>JSON.stringify(settings)},input=h.slots.get('file');input.files=[file];await input.change({target:input,stopPropagation(){}});
 assert.equal(h.fields.get('rod-rule').value,'radius');assert.equal(h.fields.get('rod-radius').value,'2.5');assert.equal(h.slots.get('error').textContent,'');
});

// ---- figure legend, caption, zoom and apply-suggestion buttons ----
const allText=n=>[n.textContent||'',...(n.children||[]).flatMap(allText)];
test('the Mathieu figure explains the black point, the section dots and the shaded areas, and carries its parameters',()=>{
 const h=ui(),svg=h.slots.get('figure').children[0],texts=allText(svg).join('\n');
 assert.equal(svg.tag,'svg');
 for(const label of [h.T.legend_first,h.T.legend_second,h.T.legend_both,h.T.legend_point,'m = 100 u','U = 0 V','V = 100 V','r₀ = 10 mm','f = 1 MHz'])assert.ok(texts.includes(label),label);
 assert.ok(texts.includes(h.T.caption_formulas.slice(0,20)));
 const titles=[];const walk=n=>{if(n.tag==='title')titles.push(n.textContent);(n.children||[]).forEach(walk);};walk(svg);assert.ok(titles.some(t=>t.startsWith(h.T.legend_point)),'hover text of the black point');
});
test('zoom buttons narrow the axis ranges, reset restores the defaults, and the pan limits stay inside the valid domain',async()=>{
 const h=ui(),span=()=>({q:+h.fields.get('qmax').value-+h.fields.get('qmin').value,a:+h.fields.get('amax').value-+h.fields.get('amin').value});
 const before=span();await h.click('zoom-in');const zoomed=span();assert.ok(zoomed.q<before.q&&zoomed.a<before.a);
 await h.click('zoom-out');await h.click('zoom-out');assert.ok(span().q>zoomed.q);assert.ok(+h.fields.get('qmin').value>=0&&+h.fields.get('qmax').value<=12&&+h.fields.get('amin').value>=-60&&+h.fields.get('amax').value<=60);
 await h.click('reset-view');assert.deepEqual(['qmin','qmax','amin','amax'].map(k=>h.fields.get(k).value),['0','2','-1','1']);assert.equal(h.slots.get('error').textContent,'');
});
test('an RF suggestion button copies its voltage into the RF field and recalculates',()=>{
 const h=ui();h.root.click({stopPropagation(){},target:{closest:sel=>sel==='[data-ms-use]'?{dataset:{msUse:'123.5'}}:null}});
 assert.equal(h.fields.get('V').value,'123.5');
});

test('convention switching preserves physical values, suggestions, stages, sigma and saved settings',async()=>{
 const h=ui({subtabs:true});h.change('V','123.45678901234567');h.change('sigma-V','.125');
 h.fields.get('cooler-on').checked=true;const original=Number(h.fields.get('V').value);
 for(let repeat=0;repeat<4;repeat++)for(const convention of ['rod-pp','differential-peak','differential-pp','rod-peak'])h.change('voltage-convention',convention);
 assert.equal(Number(h.fields.get('V').value),original);assert.equal(h.fields.get('cooler-V').value,'122');
 h.change('voltage-convention','differential-pp');assert.equal(Number(h.fields.get('V').value),4*original);assert.equal(h.fields.get('sigma-V').value,'0.5');
 h.root.click({stopPropagation(){},target:{closest:sel=>sel==='[data-ms-use]'?{dataset:{msUse:'123.5'}}:null}});
 assert.equal(h.fields.get('V').value,'494');await h.click('save');
 const saved=JSON.parse(await h.saved.at(-1).blob.text());assert.equal(saved.schema,'traps-mathieu-v2');assert.equal(saved.voltage.rod_peak_V.main,123.5);assert.equal(saved.voltage.rod_peak_V.cooler,122);assert.equal(saved.voltage.rod_peak_V.sigma,.125);
 h.change('voltage-convention','rod-peak');const f=h.slots.get('file');f.files=[{size:5000,text:async()=>JSON.stringify(saved)}];await f.change({target:f,stopPropagation(){}});
 assert.equal(h.fields.get('V').value,'494');assert.equal(h.fields.get('voltage-convention').value,'differential-pp');
});
test('stages apply and copy in both directions without factor-two errors and preserve signed DC',async()=>{
 const h=ui({subtabs:true});h.change('voltage-convention','rod-pp');h.change('cooler-U','-2.375');h.change('cooler-V','300');h.change('cooler-r0','5');h.change('cooler-f','.7');
 await h.stage('apply','cooler');assert.equal(h.fields.get('U').value,'-2.375');assert.equal(h.fields.get('V').value,'300');assert.equal(h.fields.get('r0').value,'5');assert.equal(h.fields.get('f').value,'0.7');
 h.change('V','450');await h.stage('copy','bun');assert.equal(h.fields.get('bun-V').value,'450');assert.equal(h.fields.get('bun-U').value,'-2.375');assert.equal(h.fields.get('bun-on').checked,true);
 h.fields.get('mf-on').checked=false;await h.click('stage-json');const stages=JSON.parse(await h.saved.at(-1).blob.text());assert.equal(stages.schema,'traps-rfq-stages-v1');assert.equal(stages.stages.length,3);assert.equal(stages.stages.find(s=>s.stage==='mf').enabled,false);assert.equal(stages.stages.find(s=>s.stage==='bun').V_rod_peak_V,225);
 h.change('bun-V','10');const f=h.slots.get('file');f.files=[{size:5000,text:async()=>JSON.stringify(stages)}];await f.change({target:f,stopPropagation(){}});assert.equal(h.fields.get('bun-V').value,'450');assert.equal(h.fields.get('mf-on').checked,false);
});
test('invalid stage inputs and chart axes cannot erase a valid independent design result',async()=>{
 const h=ui({subtabs:true});h.fields.get('cooler-on').checked=true;h.change('cooler-f','');
 assert.equal(h.slots.get('figure').children[0].tag,'svg');assert.equal(h.slots.get('error').textContent,'');assert.ok(h.slots.get('stage-error').textContent.includes(h.T.stage_error));
 assert.equal(h.slots.get('design-figure').children[0].tag,'svg');h.change('qmax','-1');assert.equal(h.slots.get('figure').children.length,0);assert.equal(h.slots.get('design-figure').children[0].tag,'svg');
 await h.click('design-json');const log=JSON.parse(await h.saved.at(-1).blob.text());assert.equal(log.result.rod_count,4);assert.deepEqual(log.stage_input_errors,[h.T.cooler]);assert.ok(h.slots.get('error').textContent);
});
test('direct-mode design requires an explicit voltage transition and never rewrites a,q silently',async()=>{
 const h=ui({subtabs:true});h.change('mode','direct');h.change('a','-.125');h.change('q','.7');h.clickTab('design');
 assert.equal(h.fields.get('mode').value,'direct');assert.equal(h.slots.get('direct-design').hidden,false);assert.equal(h.slots.get('design-figure').children.length,0);assert.equal(h.fields.get('a').value,'-.125');
 await h.click('voltage-mode');assert.equal(h.fields.get('mode').value,'voltage');assert.equal(h.slots.get('direct-design').hidden,true);assert.equal(h.slots.get('design-figure').children[0].tag,'svg');assert.equal(h.fields.get('a').value,'-.125');
});
test('stable example is an explicit physical voltage calculation and uncertainty exports separately',async()=>{
 const h=ui({subtabs:true});h.change('voltage-convention','rod-pp');await h.click('stable-demo');assert.equal(h.fields.get('U').value,'0');
 close(M.parameters(+h.fields.get('mass').value,+h.fields.get('charge').value,0,+h.fields.get('V').value/2,+h.fields.get('r0').value,+h.fields.get('f').value).q,.4);
 h.fields.get('uncertainty-on').checked=true;h.change('sigma-V','2');h.change('sigma-r0','.01');await h.click('design-json');const log=JSON.parse(await h.saved.at(-1).blob.text());assert.equal(log.q_uncertainty.model,'first-order-independent-inputs');assert.ok(log.q_uncertainty.sigma_q>0);assert.equal(log.q_uncertainty.contributions.find(c=>c.input==='V_rod_peak_V').sigma,1);
 h.change('sigma-r0','-1');assert.equal(h.slots.get('figure').children[0].tag,'svg');assert.equal(h.slots.get('uncertainty-readout').children[0].textContent,h.T.uncertainty_bad);
});
test('failed settings imports roll back physical voltage and provenance even after changing display convention',async()=>{
 const h=ui({subtabs:true});h.change('voltage-convention','differential-pp');await h.click('save');const saved=JSON.parse(await h.saved.at(-1).blob.text());
 saved.voltage.rod_peak_V.main=400;const f=h.slots.get('file');f.files=[{size:5000,text:async()=>JSON.stringify(saved)}];await f.change({target:f,stopPropagation(){}});
 assert.equal(h.fields.get('V').value,'400');assert.equal(h.fields.get('voltage-convention').value,'differential-pp');assert.equal(h.slots.get('error').textContent,h.T.badfile);
 // Loading must remain possible when a current input is invalid.
 saved.voltage.rod_peak_V.main=100;h.change('V','');f.files=[{size:5000,text:async()=>JSON.stringify(saved)}];await f.change({target:f,stopPropagation(){}});assert.equal(h.fields.get('V').value,'400');assert.equal(h.slots.get('error').textContent,'');
});

test('r0=10mm worked geometry distinguishes all radii, diameters and centre distances',()=>{
 const d=M.rodDesign({...design,r0_mm:10,rod_rule:'optimal'});
 close(d.rod_radius_mm,11.4510807);close(d.rod_diameter_mm,22.9021614);
 close(d.aperture_diameter_mm,20);close(d.center_radius_mm,21.4510807);
 close(d.adjacent_center_mm,30.336409253499742);close(d.surface_gap_mm,7.434247853499741);
 close(d.opposite_center_mm,42.9021614);close(d.outer_radius_mm,32.9021614);
 for(let i=0;i<d.rod_count;i++){
  const p=d.rod_coordinates[i],next=d.rod_coordinates[(i+1)%d.rod_count];
  close(Math.hypot(p.x_mm-next.x_mm,p.y_mm-next.y_mm),d.adjacent_center_mm);
  close(Math.hypot(p.x_mm,p.y_mm)-d.rod_radius_mm,d.r0_mm);
 }
});
test('first-parasitic harmonic interpolation honors the independently solved cancellation root',()=>{
 for(let rod_count=4;rod_count<=24;rod_count+=2){
  const d=M.rodDesign({...design,rod_count,rod_rule:'optimal'});
  assert.equal(d.parasitic_A_over_An,0);assert.equal(d.parasitic_at_radial_fraction,0);
  assert.match(d.parasitic_interpolation,/numerical cancellation-root anchor/);
  const at=ratio=>M.rodDesign({...design,rod_count,rod_rule:'ratio',rod_ratio:ratio}).parasitic_A_over_An;
  assert.ok(at(d.rod_ratio-1e-5)>0);assert.ok(at(d.rod_ratio+1e-5)<0);
  assert.ok(Math.abs(at(d.rod_ratio+1e-9))<1e-8);
 }
});
