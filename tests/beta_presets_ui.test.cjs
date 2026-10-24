'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../static/js/beta-spectrum.js'),source=fs.readFileSync('static/js/spectroscopy.js','utf8');
const added=['187Re','115In-exc','135Cs-exc','106Ru','151Sm','151Sm-exc','241Pu'];
function labels(){const open=source.indexOf('{',source.indexOf('const extra='));let depth=0,end=open;for(;end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}'&&!--depth)break;}return Function('return ('+source.slice(open,end+1)+')')();}
function page(lang=0){
  class E{constructor(text=''){this.textContent=text??'';this.children=[];this.events={};this.parentElement={hidden:false};this._value='';}set value(v){this._value=String(v);}get value(){return this._value;}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}addEventListener(k,fn){(this.events[k]||=[]).push(fn);}dispatchEvent(e){for(const f of this.events[e.type]||[])f(e);}}
  const fields=new Map(),p=new E(),words=labels(),context={window:{TrapsBetaSpectrum:B},panels:{beta:p},t:k=>words[k]?.[lang]||k,fmt:x=>Number.isFinite(x)?String(Number(x.toPrecision(12))):'—',el:(tag,text)=>new E(text),document:{createTextNode:t=>new E(t)},group:()=>new E(),control(parent,label,name,options,value){const e=new E();e.name=name;e.options=options;e.value=value??options?.[0]?.value??'';fields.set(name,e);return e;},howto(){},note(panel,key){panel.append(new E(words[key]?.[lang]||key));},error(){const e=new E();context.errorNode=e;return e;},savebar(panel,name,state){context.saved=state;},num:e=>{if(e.value.trim()===''||!Number.isFinite(Number(e.value)))throw Error('number');return Number(e.value);},table(out,headers,rows){context.tableRows=rows;},figure(){},userError:e=>e.message};
  const a=source.indexOf('    {\n      const B=window.TrapsBetaSpectrum,p=panels.beta;'),z=source.indexOf('\n    {\n      const p=panels.datacode',a);assert.ok(a>0&&z>a);vm.runInNewContext(source.slice(a,z),context);
  const change=(name,value,type='change')=>{fields.get(name).value=value;fields.get(name).dispatchEvent({type});};
  return {fields,context,change,select(id){change('beta-preset',String(B.PRESETS.findIndex(s=>s.id===id)));},data:()=>context.saved()};
}
test('seven added beta branches have source-pinned endpoints, separate unknowns and honest classifications',()=>{
  assert.equal(B.PRESETS.length,16);assert.equal(new Set(B.PRESETS.map(s=>s.id)).size,16);
  for(const id of added){const s=B.PRESETS.find(s=>s.id===id);assert.ok(s&&s.source.url.startsWith('https://'));assert.ok(s.source.retrieved&&s.source.branch_id&&s.classification);assert.ok(s.uncertainties.Q_keV>0);assert.equal(s.mode,'-');assert.equal(s.ref_mean_keV,null);assert.equal(s.source.daughter_level_sigma_keV===0,false);}
  assert.equal(B.PRESETS.find(s=>s.id==='187Re').Q_keV,2.4709);assert.equal(B.PRESETS.find(s=>s.id==='115In-exc').Q_keV,.147);
  const cs=B.PRESETS.find(s=>s.id==='135Cs-exc');assert.equal(cs.status,'candidate');assert.equal(cs.t12_s,null);assert.equal(cs.br,null);assert.ok(cs.Q_keV-2*cs.uncertainties.Q_keV<0);
  assert.equal(B.PRESETS.find(s=>s.id==='106Ru').type,'allowed');
  for(const id of ['151Sm','151Sm-exc','241Pu']){const s=B.PRESETS.find(s=>s.id===id);assert.equal(s.type,'allowed');assert.equal(s.classification,'first_nonunique');assert.equal(s.model_approximation,'allowed_nonunique');}
});
test('source-null rates render spectra and export null log ft instead of inheriting a prior preset',()=>{
  const p=page();for(const id of ['187Re','135Cs-exc','115In-exc']){p.select(id);const d=p.data();assert.ok(d&&d.rows.length===301);assert.equal(p.context.errorNode.textContent,'');assert.equal(d.meta.log_ft,null);assert.equal(p.fields.get('beta-halflife').value,'');if(id!=='115In-exc')assert.equal(p.fields.get('beta-branching').value,'');assert.deepEqual(JSON.parse(d.rows[0][4]),JSON.parse(JSON.stringify(d.meta)));assert.equal(d.headers.at(-1),'calculation_metadata_json');}
});
test('total half-life divided by branch is used only when both supplied; manual overrides drop source sigma',()=>{
  const p=page();p.select('151Sm-exc');let d=p.data(),s=B.PRESETS.find(s=>s.id==='151Sm-exc');assert.equal(d.meta.log_ft,B.logft(d.meta.f,s.t12_s,s.br));assert.equal(d.meta.input_uncertainties.br,.0004);
  p.change('beta-branching','.01','input');d=p.data();assert.equal(d.meta.input_uncertainties.br,null);assert.equal(d.meta.log_ft,B.logft(d.meta.f,s.t12_s,.01));
  p.change('beta-branching','','input');assert.ok(p.data());assert.equal(p.data().meta.branching_fraction,null);assert.equal(p.data().meta.log_ft,null);
  p.change('beta-branching','0','input');assert.equal(p.data(),null);assert.ok(p.context.errorNode.textContent);
});
test('candidate, ultralow-Q, dated and nonunique warnings are localized and metadata retains full sources',()=>{
  const w=labels();for(let lang=0;lang<6;lang++){const p=page(lang);for(const id of ['135Cs-exc','151Sm','241Pu']){p.select(id);const d=p.data();assert.equal(d.meta.preset_source.id,B.PRESETS.find(s=>s.id===id).source.id);assert.equal(d.meta.preset_status,B.PRESETS.find(s=>s.id===id).status);assert.ok(p.fields.get('beta-preset').options.find(o=>o.value===String(B.PRESETS.findIndex(s=>s.id===id))).label.includes('Q='));}
    for(const key of ['beta_catalogue','beta_ultralow','beta_candidate','beta_missing_ft','beta_nonunique','beta_status_dated']){assert.ok(w[key][lang]);if(lang)assert.notEqual(w[key][lang],w[key][0]);}}
});
