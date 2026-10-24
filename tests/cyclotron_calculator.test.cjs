'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../static/js/cyclotron-calculator.js'),P=require('../static/js/physics.js'),UI=require('../static/js/cyclotron-ui.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'../static/data',p),'utf8')),states=read('nuclear-states.json'),ame=read('ame2020.json'),periodic=read('periodic-table.json'),cat=P.catalogue(states,ame),names=C.aliases(periodic);
const row=(species='133Cs',extra={})=>({id:'1',species,label:'',q:'',auto:true,mass:'',sigma:'',unit:'u',convention:'neutral',...extra});
const near=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
test('explicit isotope names, superscripts and source-state isomers resolve without natural masses',()=>{
 const reference=cat.atom(133,'Cs').value.v;
 for(const s of ['133Cs','Cs-133','cesium-133','133caesium','¹³³Cs⁺'])near(C.parse(s,'',cat,names).atoms[0].value.v,reference);
 for(const s of ['133Xe[m1]','133mXe','133Xem']){const a=C.parse(s,'',cat,names).atoms[0];assert.equal(a.state.id,'54-79-1');assert.equal(a.state.excitation.value,233.221);}
 assert.equal(C.parse('151Sm','',cat,names).atoms[0].state.source_state_index,0);
 assert.equal(C.parse('48Titanium','',cat,names).atoms[0].state.element,'Ti');
 for(const s of ['Cs','H2O','133Xe[m99]'])assert.throws(()=>C.parse(s,'',cat,names));
});
test('explicit molecules/adducts retain repeated-isotope correlation and reject ambiguous charge',async()=>{
 const r=C.create(cat,{periodic}),a=await r.resolve(row('16O*2'),'saved-only');near(a.mass_u,2*cat.atom(16,'O').value.v);near(a.sigma_u,2*cat.atom(16,'O').value.e);
 for(const s of ['12C:16O*2','12C16O2'])near((await r.resolve(row(s),'saved-only')).mass_u,12+2*cat.atom(16,'O').value.v);
 const adduct=C.parse('[133Cs+1H]+','',cat,names);assert.equal(adduct.q,1);assert.equal(adduct.atoms.length,2);
 assert.equal(C.parse('133Cs:+1e','',cat,names).q,-1);assert.equal(C.parse('133Cs^-2','',cat,names).q,-2);
 for(const s of ['16O2+','133Cs:+0'])assert.throws(()=>C.parse(s,'',cat,names));
 assert.throws(()=>C.parse('133Cs+2','1',cat,names),/CHARGE_CONFLICT/);assert.throws(()=>C.parse('1H','2',cat,names),/CHARGE/);
});
test('frequency agrees with independent SI calculation; signed charge and ionic convention are explicit',()=>{
 const a=C.frequency(12,1,7,.0001,.0002),ion=(12-P.C.electronU)*P.C.uKg;near(a.Hz,P.C.e*7/(2*Math.PI*ion));near(a.sigma_Hz,a.Hz*Math.sqrt((.0002/7)**2+(.0001/(12-P.C.electronU))**2));
 const negative=C.frequency(12,-1,7,0,0);assert.ok(negative.signed_frequency_Hz<0);near(negative.ion_mass_u,12+P.C.electronU);assert.equal(negative.sigma_Hz,0);
 near(C.frequency(12,1,7,0,0,'ionic').ion_mass_u,12);assert.equal(C.frequency(12,1,7,0,null).sigma_Hz,null);assert.equal(C.frequency(12,1,7,null,0).sigma_Hz,null);
 for(const q of [0,.5,101])assert.throws(()=>C.frequency(12,q,7));assert.throws(()=>C.frequency(12,1,0));
});
test('manual u/keV masses bypass catalogue/network and preserve null versus zero errors',async()=>{
 const engine=C.create(null),a=await engine.batch([row('',{auto:false,mass:'12',sigma:'0',q:'-1'}),row('',{auto:false,mass:String(12*P.C.uKeV),sigma:'',unit:'keV',q:'-1'}),row('',{auto:false,mass:'bad'})],{B:'7',sigmaB:'0'});
 assert.equal(a[0].status,'fulfilled');assert.equal(a[1].status,'fulfilled');assert.equal(a[2].status,'rejected');near(a[0].value.frequency.Hz,a[1].value.frequency.Hz);assert.equal(a[0].value.frequency.sigma_Hz,0);assert.equal(a[1].value.frequency.sigma_Hz,null);assert.equal(a[0].value.source,'user');
});
test('ten-row allSettled batch deduplicates online ground data and retains explicit source/unknown sigma',async()=>{
 let lists=0,requests=0;const research={list:async()=>{lists++;},load:async(key,o)=>{requests++;assert.equal(o.policy,'online-only');assert.equal(o.query.nuclides,'133cs');return {data:{source:{name:'AME2020',retrieved_date:'2026-10-24'},query:o.query,raw_sha256:'test',records:[{state:{kind:'ground'},values:{massexcess:-88000},uncertainties:{massexcess:null},source_fields:{},flags:[]}]}};}};
 const r=C.create(cat,{periodic,research}),out=await r.batch(Array.from({length:10},()=>row()),{B:7,sigmaB:0});assert.equal(requests,1);assert.equal(lists,1);assert.equal(out.filter(x=>x.status==='fulfilled').length,10);
 const v=out[0].value;near(v.mass_u,133-88000/P.C.uKeV);assert.equal(v.sigma_u,null);assert.equal(v.components[0].provenance.origin,'online-response');assert.equal(v.frequency.sigma_Hz,null);
});
test('online-first preserves 2020 saved source on failure; online-only never silently falls back',async()=>{
 const r=C.create(cat,{periodic,research:{load:async()=>{throw Error('CORS blocked');}}});const v=await r.resolve(row('133Xe[m1]'),'online-first');assert.equal(v.components[0].provenance.origin,'saved-fallback');assert.match(v.components[0].provenance.online_failure,/CORS/);assert.match(v.source,/NUBASE2020 excitation/);near(v.mass_u,cat.atom(133,'Xe',1).value.v);await assert.rejects(r.resolve(row(),'online-only'),/CORS/);
 await assert.rejects(r.batch([row()],{B:0,sigmaB:0}),/PHYSICAL/);await assert.rejects(r.batch(Array(11).fill(row()),{B:7}),/ROWS/);
});
test('settings round trip all rows, mass convention and unknown/zero uncertainties without trusting saved results',()=>{
 const data={schema:C.SCHEMA,B:'7.0000000000',sigmaB:'0',policy:'saved-only',rows:[row('',{auto:false,mass:'12',sigma:'0',q:'-1',convention:'ionic'}),row('133Xe[m1]')],results:[{invented:true}]};const got=C.parseSettings(C.serialize(data));assert.equal(got.rows.length,2);assert.equal(got.rows[0].sigma,'0');assert.equal(got.rows[1].sigma,'');assert.equal(got.rows[0].convention,'ionic');assert.equal(got.results,undefined);
 assert.throws(()=>C.parseSettings(JSON.stringify({...data,rows:[]})));assert.throws(()=>C.parseSettings(JSON.stringify({...data,policy:'latest'})));assert.throws(()=>C.parseSettings('{'));
});
function harness(options={}){
 class E{constructor(tag){this.tagName=tag.toUpperCase();this.type='';this.value='';this.textContent='';this.children=[];this.dataset={};this.listeners={};this.checked=false;}setAttribute(k,v){this[k==='class'?'className':k]=String(v);}append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}prepend(n){n.parent=this;this.children.unshift(n);}insertBefore(n,b){n.parent=this;this.children.splice(this.children.indexOf(b),0,n);}replaceChildren(...nodes){this.children=[];this.append(...nodes);}remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);}addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}dispatch(k){for(const fn of this.listeners[k]||[])fn.call(this);return this['on'+k]?.call(this);}}
 const doc={documentElement:{lang:'en'},createElement:t=>new E(t)},root=new E('section'),fields=new Map();root.ownerDocument=doc;root.dataset={lang:'en',statesUrl:'states',ameUrl:'ame',elementsUrl:'elements'};
 for(const [s,tag]of [['[data-cyclotron-controls]','div'],['[data-cyclotron-rows]','div'],['#zg-c-out','p'],['#zg-c-b','input'],['#zg-c-preset','select']]){const e=new E(tag);fields.set(s,e);root.append(e);}fields.get('#zg-c-b').value='7';root.querySelector=s=>fields.get(s);const controller=UI.mount(root,{load:async()=>({catalogue:cat,periodic}),...options});return {controller,root};
}
test('actual UI starts with one row, enforces 1–10, manual edits invalidate results and source evidence',async()=>{
 const {controller:h}=harness();assert.equal(h.rows.length,1);assert.equal(h.rows[0].remove.disabled,true);for(let i=0;i<12;i++)h.controls.add.onclick();assert.equal(h.rows.length,10);assert.equal(h.controls.add.disabled,true);h.rows[9].remove.onclick();assert.equal(h.rows.length,9);
 h.controls.policy.value='saved-only';h.controls.sigmaB.value='0';await h.run();assert.equal(h.rows[0].result.source,'AME2020');assert.ok(h.rows[0].provenance.textContent.includes('AME2020'));h.rows[0].species.value='85Rb';h.rows[0].species.dispatch('input');assert.equal(h.rows[0].mass.value,'');assert.equal(h.rows[0].result,null);assert.equal(h.rows[0].provenance.textContent,'');
 h.rows[0].mass.value='12';h.rows[0].mass.dispatch('input');assert.equal(h.rows[0].auto.checked,false);assert.equal(h.rows[0].sigma.value,'');h.rows[0].sigma.value='0';await h.run();assert.equal(h.rows[0].result.frequency.sigma_Hz,0);
});
test('actual UI exports all rows/source metadata and round trips JSON without fetching manual masses',async()=>{
 let fetches=0,blob,saved,csv;const {controller:h}=harness({load:async()=>{fetches++;throw Error('not called');}});global.zgExport={save:(b,n)=>{blob=b;saved=n;},csv:(headers,rows,name)=>{csv={headers,rows,name};}};
 const r=h.rows[0];r.auto.checked=false;r.mass.value='12';r.sigma.value='0';r.q.value='-1';r.convention.value='ionic';h.controls.sigmaB.value='0';await h.run();assert.equal(fetches,0);h.controls.save.onclick();assert.equal(saved,'cyclotron-rows.json');const text=await blob.text();assert.equal(JSON.parse(text).results[0].frequency.q,-1);h.controls.csv.onclick();assert.equal(csv.rows.length,1);assert.match(csv.rows[0].at(-1),/"origin":"user"/);
 h.controls.file.files=[{size:text.length,text:async()=>text}];await h.controls.file.onchange();assert.equal(h.rows[0].auto.checked,false);assert.equal(h.rows[0].result.frequency.q,-1);assert.equal(h.rows[0].result.frequency.sigma_Hz,0);delete global.zgExport;
});
test('slow source/load completion cannot overwrite a newer edit and invalid B does not fetch',async()=>{
 let done,calls=0;const {controller:h}=harness({load:()=>{calls++;return new Promise(r=>done=r);}});h.controls.B.value='0';await h.run();assert.equal(calls,0);h.controls.B.value='7';h.controls.policy.value='saved-only';const pending=h.run();h.rows[0].mass.value='99';h.rows[0].mass.dispatch('input');done({catalogue:cat,periodic});await pending;assert.equal(h.rows[0].mass.value,'99');assert.equal(h.rows[0].result,null);
});
test('six locales and original route have one calculator and dependency-ordered scripts',()=>{
 for(const [key,texts]of Object.entries(UI.labels)){assert.equal(texts.length,6,key);assert.ok(texts.every(x=>typeof x==='string'&&x.length>0),key);}
 const html=fs.readFileSync(path.join(__dirname,'../layouts/_shortcodes/lab.html'),'utf8');assert.equal((html.match(/data-cyclotron data-lang/g)||[]).length,1);assert.equal((html.match(/id="zg-c-out"/g)||[]).length,1);assert.ok(!html.includes('id="zg-c-m"'));const scripts=['js/physics.js','js/research-data.js','js/cyclotron-calculator.js','js/cyclotron-ui.js'];assert.ok(scripts.every((s,i)=>i===0||html.indexOf(s)>html.indexOf(scripts[i-1])));
});
