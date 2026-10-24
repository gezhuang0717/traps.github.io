'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const DS=require('../static/js/spectroscopy-data.js'),U=require('../static/js/spectroscopy-uncertainty.js');
const source=fs.readFileSync('static/js/spectroscopy.js','utf8');
const start=source.indexOf("    {\n      const box=el('section',null,{class:'sp-method','data-tool-steps':'king'});box.append(el('h3',t('king')))");
const end=source.indexOf("    {\n      const p=panels.cooling",start);assert.ok(start>=0&&end>start);
// Exercise the actual King UI handlers with real parsing/EIV/OLS kernels.
// Figure arguments are retained to test the error bars and fit-band data;
// browser SVG rendering is verified separately.
function page(options={}){
 const nodes=[];
 class Element{
  constructor(tag,text,attrs={}){this.tag=tag;this.textContent=text||'';this.attrs=attrs;this.children=[];this.value='';nodes.push(this);}
  append(...children){this.children.push(...children);}
  insertBefore(child,before){this.children=this.children.filter(c=>c!==child);this.children.splice(this.children.indexOf(before),0,child);}
  replaceChildren(...children){this.children=[...children];}
  querySelector(selector){return this.children.find(e=>e.tag===selector)||null;}
  setAttribute(name,value){this.attrs[name]=value;}
  click(){this.onclick?.();}
 }
 const el=(tag,text,attrs)=>new Element(tag,text,attrs),methods=el('main');let error,out,state;
 const context={methods,DS,root:{dataset:{exampleBase:'/data/research-examples/'}},fetch:options.fetch||(async url=>({ok:true,text:async()=>fs.readFileSync('static'+url,'utf8')})),window:{TrapsSpectroscopyUncertainty:U},t:k=>k,el,se:(tag,attrs,text)=>el(tag,text,attrs),fmt:x=>String(x),userError:e=>e.code||e.message,
  group:p=>{const g=el('div');p.append(g);return g;},error:p=>{error=el('p');p.append(error);return error;},output:p=>{out=el('pre');p.append(out);return out;},
  savebar:(p,name,getter)=>{state=getter;},note(){},figure:(plot,title,xlabel,ylabel,points,log,fit,extra)=>{plot.view={points,fit,extra,xlabel,ylabel};plot.replaceChildren(el('svg'));}};
 vm.runInNewContext(source.slice(start,end),context);
 const by=(name,value)=>nodes.find(n=>n.attrs[name]===value),input=by('name','king-points'),calculate=by('data-sp-calculate','true');
 const importFile=async file=>{const f=by('name','king-points-file');f.files=[file];await f.onchange();};
 return {input,error,out,state:()=>state(),method:by('data-king-method','true'),example:kind=>by('data-king-example',kind).click(),calculate:()=>calculate.click(),edit:text=>{input.value=text;input.oninput();},select:id=>{const s=by('name','king-example-library');s.value=id;s.onchange();},load:()=>by('data-king-library-load','true').onclick(),loadDisabled:()=>by('data-king-library-load','true').disabled,link:format=>by('data-king-download',format).attrs.href,importFile,import:async text=>{await importFile({size:text.length,text:async()=>text});assert.equal(by('name','king-points-file').value,'');}};
}
test('fresh King page demonstrates supplied x/y errors, correlated EIV and nonzero fit band',()=>{
 const p=page(),parsed=DS.parseKing(p.input.value),saved=p.state();assert.equal(parsed.weighted,true);assert.equal(parsed.points.length,5);assert.ok(parsed.points.some(q=>q.rho_xy!==0));
 assert.equal(p.method.textContent,'king_autoking_weighted');assert.match(p.out.textContent,/king_weighted/);assert.equal(p.error.textContent,'');
 assert.equal(saved.meta.weighted,true);assert.equal(saved.meta.method,U.kingFit(parsed).method);assert.ok(saved.meta.sigma_slope>0);assert.ok(saved.meta.sigma_intercept>0);
 assert.ok(saved.plot.view.points.every(q=>q.s>0&&q.sx>0));assert.ok(saved.plot.view.extra.band.every(q=>q.sigma>0));
 assert.equal(saved.headers.at(-1),'rho_xy');assert.equal(saved.rows[0].at(-1),.2);assert.match(saved.meta.uncertainty_model,/independent rows/);
});
test('explicit no-errors example selects OLS without assigning any synthetic uncertainty',()=>{
 const p=page();p.example('plain');const parsed=DS.parseKing(p.input.value),saved=p.state();assert.equal(parsed.weighted,false);assert.equal(saved.meta.weighted,false);assert.equal(saved.meta.method,'unweighted OLS');assert.equal(p.method.textContent,'king_autoking_ols');assert.match(p.out.textContent,/king_ols/);
 assert.ok(saved.rows.every(r=>r[2]===''&&r[3]===''&&r.at(-1)===''));assert.ok(saved.plot.view.points.every(q=>q.s===undefined&&q.sx===undefined));assert.match(saved.meta.uncertainty_model,/no input uncertainties/);
 p.example('errors');assert.equal(p.state().meta.weighted,true);assert.equal(p.method.textContent,'king_autoking_weighted');
});
test('editing changes automatic method before Calculate and invalidates old exports',()=>{
 const p=page();p.edit('0,1\n1,3\n2,5');assert.equal(p.method.textContent,'king_autoking_ols');assert.equal(p.state(),null);assert.equal(p.out.textContent,'');p.calculate();assert.equal(p.state().meta.weighted,false);
 p.edit('0,1,.1,.2\n1,3,.1,.2\n2,5,.1,.2');assert.equal(p.method.textContent,'king_autoking_weighted');p.calculate();assert.equal(p.state().meta.weighted,true);
});
test('mixed or invalid user uncertainties remain errors rather than silently falling back to OLS',()=>{
 const p=page();for(const text of ['0,1,.1,.2\n1,3\n2,5,.1,.2','0,1,-.1,.2\n1,3,.1,.2\n2,5,.1,.2','0,1,.1,.2,1.1\n1,3,.1,.2\n2,5,.1,.2']){p.edit(text);p.calculate();assert.equal(p.state(),null);assert.ok(p.error.textContent);assert.equal(p.out.textContent,'');}
 p.example('errors');assert.equal(p.error.textContent,'');assert.equal(p.state().meta.weighted,true);
});
test('entered uncertainty magnitudes and rho survive actual exports and affect fitted covariance',()=>{
 const p=page();p.edit('0,1.1,.10,.20,.4\n1,2.9,.10,.20,.4\n2,5.2,.10,.20,.4\n3,6.8,.10,.20,.4');p.calculate();const a=p.state();assert.ok(a.rows.every(r=>r[2]===.1&&r[3]===.2&&r.at(-1)===.4));
 p.edit('0,1.1,.20,.40,.4\n1,2.9,.20,.40,.4\n2,5.2,.20,.40,.4\n3,6.8,.20,.40,.4');p.calculate();const b=p.state();assert.ok(Math.abs(b.meta.sigma_slope/a.meta.sigma_slope-2)<1e-6);assert.ok(Math.abs(b.meta.sigma_intercept/a.meta.sigma_intercept-2)<1e-6);
});
test('library selection offers matching downloadable CSV/TXT/JSON and loads each actual dataset',async()=>{
 const p=page(),index=JSON.parse(fs.readFileSync('static/data/research-examples/king/index.json','utf8'));
 for(const item of index){p.select(item.id);for(const ext of ['csv','txt','json'])assert.equal(p.link(ext),'/data/research-examples/king/'+item.files[ext]);await p.load();assert.equal(p.error.textContent,'',item.id);assert.equal(p.state().meta.weighted,item.method==='EIV',item.id);assert.equal(p.state().rows.length,item.rows,item.id);assert.equal(p.state().meta.input_provenance.kind,'synthetic-training');assert.equal(p.state().meta.input_provenance.dataset_id,item.id);}
});
test('actual file-import handlers round-trip all three formats without dropping rho or zero sx',async()=>{
 const p=page();for(const id of ['correlated','exact-x','ols']){let expected;for(const ext of ['csv','txt','json']){const text=fs.readFileSync('static/data/research-examples/king/'+id+'.'+ext,'utf8');await p.import(text);assert.equal(p.error.textContent,'',id+ext);const saved=p.state();assert.ok(saved);assert.equal(saved.meta.input_text,text);const values=JSON.stringify(saved.rows);if(expected)assert.equal(values,expected,id+ext);else expected=values;}}
});
test('invalid file unit/schema/header is rejected before replacing the working input',async()=>{
 const p=page(),before=p.input.value;for(const text of ['# units: MHz\nx,y\n0,1\n1,3\n2,5',JSON.stringify({schema:'other',points:[]}),JSON.stringify({schema:'traps-king-data-v1',units:'MHz',points:[]}), 'x,y,sy,sx\n0,1,.1,.2\n1,3,.1,.2\n2,5,.1,.2']){await p.import(text);assert.ok(p.error.textContent);assert.equal(p.input.value,before);}
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('slow example response cannot replace typing, inline example, selection change or a newer file',async()=>{
 const text=fs.readFileSync('static/data/research-examples/king/exact-x.json','utf8');
 for(const next of ['typing','inline','selection','file']){const d=deferred(),p=page({fetch:()=>d.promise}),pending=p.load();assert.equal(p.loadDisabled(),true);
  if(next==='typing')p.edit('0,2\n1,4\n2,6');else if(next==='inline')p.example('plain');else if(next==='selection')p.select('ols');else await p.import('0,4\n1,6\n2,8');
  const expected=p.input.value;d.resolve({ok:true,text:async()=>text});await pending;assert.equal(p.input.value,expected,next);assert.equal(p.error.textContent,'');assert.equal(p.loadDisabled(),false);}
});
test('new example request wins over an older success or rejection',async()=>{
 for(const fails of [false,true]){const first=deferred(),second=deferred();let n=0;const p=page({fetch:()=>++n===1?first.promise:second.promise}),old=p.load();p.select('ols');const recent=p.load();second.resolve({ok:true,text:async()=>fs.readFileSync('static/data/research-examples/king/ols.json','utf8')});await recent;const expected=p.input.value;if(fails)first.reject(Error('old failure'));else first.resolve({ok:true,text:async()=>fs.readFileSync('static/data/research-examples/king/exact-x.json','utf8')});await old;assert.equal(p.input.value,expected);assert.equal(p.state().meta.weighted,false);assert.equal(p.error.textContent,'');assert.equal(p.loadDisabled(),false);}
});
test('slow file reads cannot replace newer typing or file selection',async()=>{
 for(const next of ['typing','file']){const d=deferred(),p=page(),pending=p.importFile({size:100,text:()=>d.promise});if(next==='typing')p.edit('0,4\n1,6\n2,8');else await p.import('0,9\n1,10\n2,11');const expected=p.input.value;d.resolve('0,1\n1,3\n2,5');await pending;assert.equal(p.input.value,expected);assert.equal(p.error.textContent,'');assert.equal(p.loadDisabled(),false);}
});
