'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../static/js/research-data.js'),registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../static/data/research-cache/index.json'),'utf8'));
const FS=require('../static/js/figure-style.js');
const source=fs.readFileSync(path.join(__dirname,'../static/js/spectroscopy.js'),'utf8');
const response=text=>({ok:true,status:200,text:async()=>text});
function saved(key){const spec=registry.datasets.find(d=>d.key===key);return fs.readFileSync(path.join(__dirname,'../static/data/research-cache',spec.cache.file),'utf8');}
function result(key,policy='saved-only'){return {data:JSON.parse(saved(key)),origin:'saved-cache',warnings:[],policy};}
function setup(){R.configure(registry,{baseURL:'https://saved.test/data/'});}
test('strict source policies do not silently cross acquisition modes',async()=>{
 setup();let remote=0,local=0;
 const fetch=async url=>{if(url.startsWith('https://saved.test/')){local++;return response(saved('livechart-ground-states'));}remote++;throw Error('CORS blocked');};
 let r=await R.load('livechart-ground-states',{policy:'saved-only',fetch});assert.equal(r.origin,'saved-cache');assert.equal(remote,0);assert.equal(local,1);
 await assert.rejects(R.load('livechart-ground-states',{policy:'online-only',fetch}),/CORS blocked/);assert.equal(local,1);
 r=await R.load('livechart-ground-states',{policy:'online-first',fetch});assert.equal(r.origin,'session-cache');assert.equal(r.cached_origin,'saved-cache');assert.ok(r.warnings.length);
 await assert.rejects(R.load('livechart-ground-states',{policy:'invented',fetch}),/policy/);
});
test('last good online result retains acquisition identity and saved-only rechecks immutable snapshot',async()=>{
 setup();const csv='z,n,symbol,energy,jp,radius,unc_r,Extraction_date\n20,23,Ca,0,7/2-,3.4954,,2026-10-24\n';
 let r=await R.load('livechart-ground-states',{policy:'online-only',fetch:async()=>response(csv)});assert.equal(r.origin,'online');assert.equal(r.data.records[0].uncertainties.radius,null);
 r=await R.load('livechart-ground-states',{policy:'online-first',fetch:async()=>{throw Error('offline');}});assert.equal(r.origin,'session-cache');assert.equal(r.cached_origin,'online');assert.equal(r.data.records[0].uncertainties.radius,null);
 r=await R.load('livechart-ground-states',{policy:'saved-only',fetch:async url=>{assert.ok(url.startsWith('https://saved.test/'));return response(saved('livechart-ground-states'));}});assert.equal(r.origin,'saved-cache');assert.equal(r.data.records[0].uncertainties.radius,.0019);
});
test('wrong response nuclide and unmatched query cannot masquerade as valid requested data',async()=>{
 setup();const csv='z,n,symbol,energy,radius,unc_r\n8,8,O,0,2.7,.01\n';
 await assert.rejects(R.load('livechart-ground-states',{policy:'online-only',fetch:async()=>response(csv)}),/nuclide\/query mismatch/);
 await assert.rejects(R.load('livechart-ground-states',{policy:'saved-only',query:{nuclides:'16o'},fetch:async()=>{throw Error('must not fetch unmatched snapshot');}}),/No matching saved query/);
});
test('ground-state adapters retain physical units, ambiguous spin, zero and unknown errors',()=>{
 const r=result('livechart-ground-states'),row=r.data.records[0];row.uncertainties.radius=null;row.uncertainties.magnetic_dipole=0;row.source_fields.jp='(5/2,7/2)';row.state.spin_parity='(5/2,7/2)';
 const d=R.groundRows(r);assert.equal(d.radii[0].r_fm,3.4954);assert.equal(d.radii[0].sigma_fm,null);assert.equal(d.moments[0].spin,null);assert.equal(d.moments[0].sigma_muN,0);assert.equal(d.moments[0].Q_b,-.0408);assert.equal(d.provenance.origin,'saved-cache');assert.ok(d.provenance.extraction_dates.length);assert.ok(d.provenance.publication_cutoffs.length);
});
test('levels join gamma source IDs, preserve emitted energies/errors and exclude unresolved offsets',()=>{
 const l=result('livechart-levels'),g=result('livechart-gammas'),s=R.levelScheme(l,g);assert.equal(s.nuclide,'12C');assert.equal(s.levels.find(r=>r.id==='1').energy_keV,4439.82);const gamma=s.transitions.find(r=>r.from==='1'&&r.to==='0');assert.equal(gamma.energy_keV,4438.94);assert.equal(gamma.sigma_energy_keV,null);assert.notEqual(gamma.energy_keV,s.levels.find(r=>r.id==='1').energy_keV);assert.equal(s.provenance.length,2);
 l.data.records[1].state.kind='unresolved';const removed=R.levelScheme(l,g);assert.ok(!removed.levels.some(r=>r.id==='1'));assert.ok(!removed.transitions.some(r=>r.from==='1'||r.to==='1'));assert.ok(removed.omitted>0);g.data.query.nuclides='16o';assert.throws(()=>R.levelScheme(l,g),/mismatch/);
});
function harness(load){
 class E{constructor(tag,text,attrs={}){this.tagName=tag.toUpperCase();this.textContent=text||'';this.children=[];this.value='';this.hidden=false;Object.assign(this,attrs);}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.textContent='';}}
 const fields=new Map(),context={window:{TrapsResearchData:{...R,load}},app:new E('div'),document:{createTextNode:t=>new E('text',t)},t:k=>k,el:(tag,text,attrs)=>{const e=new E(tag,text,attrs);if(e.name)fields.set(e.name,e);return e;},group:p=>{const e=new E('div');p.append(e);return e;},control(p,label,name,options){const e=new E('select','',{name});e.value=options[0]?.value||'';fields.set(name,e);p.append(e);return e;}};
 const a=source.indexOf('    const R=window.TrapsResearchData,apiTools='),b=source.indexOf('    const output=',a);assert.ok(a>0&&b>a);vm.runInNewContext(source.slice(a,b)+'; this.api={apiBox,apiExport,sourcePolicy,apiTools};',context);return {api:context.api,fields,E};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('actual source controls discard old query, dataset and policy responses',async()=>{
 const pending=[],h=harness((key,options)=>new Promise(resolve=>pending.push({resolve,key,options}))),seen=[],tool=h.api.apiBox(new h.E('div'),'radius',['livechart-ground-states'],'43ca',v=>seen.push(v));tool.activate(true);assert.equal(pending.length,1);
 tool.query.value='48ca';tool.query.oninput();tool.query.value='43ca';tool.query.oninput();tool.activate(true);assert.equal(pending.length,2);pending[0].resolve(result('livechart-ground-states'));await tick();assert.equal(tool.results,null);
 pending[1].resolve(result('livechart-ground-states'));await tick();assert.ok(tool.results);h.api.sourcePolicy.value='online-only';h.api.sourcePolicy.onchange();assert.equal(pending[2].options.policy,'online-only');tool.activate(false);pending[2].resolve(result('livechart-ground-states'));await tick();assert.equal(tool.results,null);assert.equal(tool.box.hidden,true);
});
test('primed settings API result applies synchronously and exports provenance without mutation or duplicate columns',()=>{
 let calls=0;const h=harness(async()=>{calls++;return result('livechart-ground-states');}),tool=h.api.apiBox(new h.E('div'),'radius',['livechart-ground-states'],'43ca',()=>{});tool.prime([result('livechart-ground-states')],'43ca','online-first');tool.activate(true);assert.equal(calls,0);
 const input={headers:['sigma'],rows:[[null]],meta:{quantity:'radius'}},a=h.api.apiExport(input,'radius'),b=h.api.apiExport(input,'radius');assert.equal(a.headers.length,2);assert.equal(b.headers.length,2);assert.equal(input.headers.length,1);assert.equal(a.rows[0][0],null);assert.equal(JSON.parse(a.rows[0][1]).research_sources[0].source.id,'livechart');tool.activate(false);assert.equal(h.api.apiExport(input,'radius'),input);
});
function settingsPage(prepare=async()=>[result('livechart-ground-states')]){
 const S=require('../static/js/spectroscopy-settings.js'),DS=require('../static/js/spectroscopy-data.js'),fields=new Map();let primed=null,primeCount=0;
 const input=(name,value,options)=>{let current=value;const e={name,type:'text',tagName:options?'SELECT':'INPUT',options:(options||[]).map(value=>({value})),get value(){return current;},set value(v){current=options&&!e.options.some(x=>x.value===v)?'':v;},dispatchEvent(){e.change?.();}};fields.set(name,e);return e;};
 input('source-policy','online-first',['online-first','saved-only','online-only']);input('radius-api-nuclide','43ca');input('radius-dataset','builtin',['builtin','iaea','user','api']);input('radius-element','Ca',['Ca']);input('radius-reference','40',['40']);input('moment-dataset','builtin',['builtin','iaea','user','api']);input('moment-element','Rb',['Rb']);input('levels-dataset','builtin',['builtin','user','api']);input('nuclear-scheme','0',['0']);input('radiusShift-massU','42');
 fields.get('radius-dataset').change=()=>{const refs=fields.get('radius-reference');refs.options=(fields.get('radius-dataset').value==='api'?R.groundRows(primed[0]).radii.map(r=>String(r.A)):['40']).map(value=>({value}));refs.value=refs.options[0].value;};
 const snapshot=()=>({schema:S.schema,inputs:Object.fromEntries([...fields].map(([k,v])=>[k,v.value])),activeTab:'sp-radii'}),ctx={S,DS,R,FS,source,iaeaReady:Promise.resolve(),sourceRegistryReady:Promise.resolve(),sourceRestoring:false,snapshot,data:{charge_radii:[{element:'Ca',A:40}],moments:[{element:'Rb',A:87}]},apiTools:new Map([['radius',{prepare,prime(values){primed=values;primeCount++;}}]]),root:{querySelectorAll:()=>[...fields.values()]},methods:{querySelectorAll:()=>[]},tabs:{children:[]},Event:class{constructor(type){this.type=type;}}};
 const a=source.indexOf('    async function applySettings(value){'),b=source.indexOf('\n    file.onchange=',a);vm.runInNewContext(source.slice(a,b)+';this.restore=applySettings;',ctx);return {fields,snapshot,restore:ctx.restore,primeCount:()=>primeCount};
}
test('actual settings restoration loads API before rebuilding isotope choices and preserves manual mass',async()=>{
 const p=settingsPage();await p.restore({schema:'traps-spectroscopy-v1',inputs:{'radius-reference':'43','radius-dataset':'api','radius-api-nuclide':'43ca','source-policy':'saved-only','radius-element':'Ca','radiusShift-massU':'119'},activeTab:'sp-radii'});assert.equal(p.fields.get('radius-reference').value,'43');assert.equal(p.fields.get('source-policy').value,'saved-only');assert.equal(p.fields.get('radiusShift-massU').value,'119');assert.equal(p.primeCount(),1);
});
test('slow API settings import cannot overwrite manual edits made while source loads',async()=>{
 let resolve;const p=settingsPage(()=>new Promise(r=>{resolve=r;})),pending=p.restore({schema:'traps-spectroscopy-v1',inputs:{'radius-dataset':'api'},activeTab:'sp-radii'});await tick();p.fields.get('radiusShift-massU').value='999';resolve([result('livechart-ground-states')]);await assert.rejects(pending,/Settings changed/);assert.equal(p.fields.get('radiusShift-massU').value,'999');assert.equal(p.fields.get('radius-dataset').value,'builtin');assert.equal(p.primeCount(),0);
});
test('new API UI and script dependencies are explicit and preserve archived/user dataset choices',()=>{
 const template=fs.readFileSync(path.join(__dirname,'../layouts/_shortcodes/spectroscopy-tools.html'),'utf8');assert.equal((template.match(/js\/research-data\.js/g)||[]).length,1);assert.ok(template.indexOf('js/research-data.js')<template.indexOf('js/spectroscopy.js'));
 for(const name of ['radius','moment','levels'])assert.ok(source.includes("'"+name+"-dataset'"));assert.ok(source.includes("'api-preview-dataset'"));
});
