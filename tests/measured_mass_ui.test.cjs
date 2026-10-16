'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../static/js/physics.js'),MM=require('../static/js/measured-masses.js');
const state={id:'50-66-0',A:116,Z:50,N:66,element:'Sn',label:'g',source_state_index:0};
const catalog={states:new Map([[state.id,state]]),ground:new Map([['sn116',state]])};
const rows=[{nuclide:'116Sn',value:100,uncertainty:2,label:'A'},{nuclide:'116Sn',value:104,uncertainty:2,label:'B'}];
// Exercise the real event handlers with a small DOM test double. Browser
// rendering is outside this test; no storage, network or download is used.
function ui(){
 const nodes=new Map(),saved={'traps.measured-masses.v1':'preserve existing browser save'},writes=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',checked:false,hidden:false,textContent:'',innerHTML:'',listeners:{},dataset:{},classList:{add(){},remove(){}},addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},querySelector(q){return node(key+' '+q);},querySelectorAll(){return [];},after(){},focus(){},select(){},setAttribute(){}});return nodes.get(key);};
 const root=node('root'),panel=node('panel'),body=node('body'),policy=node('policy');policy.value='last';
 root.querySelector=q=>q==='.nc-measured'?panel:node('root '+q);
 const pselect={'tbody':body,'[name=nc-mass-policy]':policy,'[name=nc-mass-example]':node('kind')};pselect['[name=nc-mass-example]'].value='me';
 panel.querySelector=q=>pselect[q]||node('panel '+q);body.parentElement={parentElement:{after(){}}};
 const T=new Proxy({loaded_summary:'{valid}/{errors}/{active}/{duplicates}',loaded_empty:'empty',loaded_errors:{json:'Invalid JSON'}},{get:(o,k)=>k in o?o[k]:String(k)});
 const localStorage={getItem:k=>saved[k]??null,setItem:(k,v)=>{writes.push(k);saved[k]=v;},removeItem:k=>{writes.push(k);delete saved[k];}};
 const base=(z,n)=>P.primitive('AME2020:'+(z*1000+n),z===50&&n===66?-90000:8000,1);
 const host={ZGMeasuredMasses:MM,ZGPhysics:P};host.parent=host;
 const context={window:host,document:{createElement:()=>node('pager')},location:{search:'',origin:'https://example.invalid'},localStorage,TextEncoder,setTimeout,clearTimeout,Blob};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/measured-masses-ui.js'),'utf8'),context);
 const adapter=host.ZGMeasuredMassUI.attach(root,T,catalog,base,()=>{});
 const click=action=>{for(const cb of panel.listeners.click||[])cb({target:{closest:()=>({dataset:{mass:action}})}});};
 const paste=text=>{panel.querySelector('[name=nc-mass-paste]').value=text;click('import');};
 const file=async text=>{const target=panel.querySelector('[name=nc-mass-file]');target.files=[{size:text.length,text:async()=>text}];for(const cb of target.listeners.change||[])await cb({target});assert.equal(target.value,'');};
 return {adapter,policy,panel,click,paste,file,writes,saved,error:()=>panel.querySelector('.nc-mass-error').textContent};
}
const value=fixture=>fixture.adapter.table().active.get(state.id);
function portable(policy){const source=ui();source.policy.value=policy;source.paste(JSON.stringify(rows));source.click('json');return source.panel.querySelector('[name=nc-mass-json]').value;}
function noSave(fixture){assert.deepEqual(fixture.writes,[]);assert.equal(fixture.saved['traps.measured-masses.v1'],'preserve existing browser save');}

test('actual adapter portable weighted JSON round-trips through paste and file import',async()=>{
 const text=portable('weighted');assert.equal(JSON.parse(text).policy,'weighted');
 for(const mode of ['paste','file']){
  const destination=ui();await destination[mode](text);
  assert.equal(destination.policy.value,'weighted');assert.equal(value(destination).me,102);assert.equal(value(destination).e,2);
  assert.deepEqual(MM.labels(value(destination).value,destination.adapter.table()),['A','B']);
  noSave(destination);
 }
});
test('portable last policy replaces a working weighted policy in both import paths',async()=>{
 for(const mode of ['paste','file']){
  const destination=ui();destination.policy.value='weighted';await destination[mode](portable('last'));
  assert.equal(destination.policy.value,'last');assert.equal(value(destination).me,104);assert.deepEqual(value(destination).rows,[2]);noSave(destination);
 }
});
test('legacy bare rows, rows envelope, CSV and TSV retain the working duplicate policy',async()=>{
 for(const text of [JSON.stringify(rows),JSON.stringify({rows}),MM.csv(rows),'nuclide\tvalue\tuncertainty\n116Sn\t100\t2\n116Sn\t104\t2']){
  for(const mode of ['paste','file']){
   const destination=ui();destination.policy.value='weighted';await destination[mode](text);
   assert.equal(destination.policy.value,'weighted');assert.equal(value(destination).me,102);assert.equal(destination.error(),'');noSave(destination);
  }
 }
});
test('unknown imported policy or schema is rejected before changing working table or browser save',async()=>{
 for(const envelope of [{schema:1,policy:'unknown',rows},{schema:1,policy:null,rows},{schema:2,policy:'last',rows},{schema:'1',policy:'last',rows}]){
  for(const mode of ['paste','file']){
   const destination=ui();destination.policy.value='weighted';destination.paste(JSON.stringify(rows));
   await destination[mode](JSON.stringify(envelope));
   assert.equal(destination.error(),'Invalid JSON');assert.equal(destination.policy.value,'weighted');assert.equal(value(destination).me,102);noSave(destination);
  }
 }
});
