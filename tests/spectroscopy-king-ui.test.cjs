'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const DS=require('../static/js/spectroscopy-data.js'),U=require('../static/js/spectroscopy-uncertainty.js');
const source=fs.readFileSync('static/js/spectroscopy.js','utf8');
const start=source.indexOf("    {\n      const box=el('section',null,{class:'sp-method'});box.append(el('h3',t('king')))");
const end=source.indexOf("    {\n      const p=panels.cooling",start);assert.ok(start>=0&&end>start);
// Exercise the actual King UI handlers with real parsing/EIV/OLS kernels.
// Figure arguments are retained to test the error bars and fit-band data;
// browser SVG rendering is verified separately.
function page(){
 const nodes=[];
 class Element{
  constructor(tag,text,attrs={}){this.tag=tag;this.textContent=text||'';this.attrs=attrs;this.children=[];this.value='';nodes.push(this);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  querySelector(selector){return this.children.find(e=>e.tag===selector)||null;}
  click(){this.onclick?.();}
 }
 const el=(tag,text,attrs)=>new Element(tag,text,attrs),methods=el('main');let error,out,state;
 const context={methods,DS,window:{TrapsSpectroscopyUncertainty:U},t:k=>k,el,se:(tag,attrs,text)=>el(tag,text,attrs),fmt:x=>String(x),userError:e=>e.code||e.message,
  group:p=>{const g=el('div');p.append(g);return g;},error:p=>{error=el('p');p.append(error);return error;},output:p=>{out=el('pre');p.append(out);return out;},
  savebar:(p,name,getter)=>{state=getter;},note(){},figure:(plot,title,xlabel,ylabel,points,log,fit,extra)=>{plot.view={points,fit,extra,xlabel,ylabel};plot.replaceChildren(el('svg'));}};
 vm.runInNewContext(source.slice(start,end),context);
 const by=(name,value)=>nodes.find(n=>n.attrs[name]===value),input=by('name','king-points'),calculate=by('data-sp-calculate','true');
 return {input,error,out,state:()=>state(),method:by('data-king-method','true'),example:kind=>by('data-king-example',kind).click(),calculate:()=>calculate.click(),edit:text=>{input.value=text;input.oninput();}};
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
