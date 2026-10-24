const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../static/js/chart-classes.js');
const UD = require('../static/js/chart-user-data.js');
const TD = require('../static/js/chart-typed-data.js');
const source = fs.readFileSync(path.join(__dirname, '../static/js/nuclide-chart.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../layouts/_shortcodes/nuclide-chart.html'), 'utf8');
const cut = (a,b) => { const i=source.indexOf(a), j=source.indexOf(b,i); assert.ok(i>=0&&j>i,a); return source.slice(i,j); };
class Control {
  constructor(value='',checked=false) { this.value=value;this.checked=checked;this.disabled=false;this.hidden=false;this.attrs={};this.listeners={};this.dataset={};this.files=[]; }
  addEventListener(type,fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type) { const event={target:this,key:'',preventDefault(){}};this['on'+type]?.(event);for(const fn of this.listeners[type]||[])fn(event); }
  setCustomValidity(text) { this.validationMessage=text; }
  setAttribute(key,v) { this.attrs[key]=v; }
  removeAttribute(key) { delete this.attrs[key]; }
  replaceChildren(...options) { this.options=options;this.value=options[0]?.value||''; }
  querySelector() { return null; }
}
function harness(initial='decay') {
  const controls=new Map(), get=name=>{if(!controls.has(name))controls.set(name,new Control());return controls.get(name);};
  for(const [name,value] of Object.entries({'nc-colour':initial,'nc-class-n':'9','nc-class-method':'equal','nc-class-scheme':'default','nc-class-edges':'','nc-mine-text':'','nc-mine-custom-unit':'counts'}))get(name).value=value;
  const legend=new Control(), canvas=new Control();
  const root={querySelector(selector){const m=/^\[name="?([^\]"]+)"?\]$/.exec(selector);return m?get(m[1]):selector==='.nc-legend'?legend:get(selector);}};
  const ctx={root,sel:get('nc-colour'),legend,cv:canvas,mode:initial,manualRange:null,classOn:false,classN:9,classMethod:'equal',classText:'',classScheme:'default',classState:null,isolate:new Set(),isolateMode:'',
    emptyColour:'#e5e7eb',src:'ame',MOD:{frdm:{name:'FRDM'}},AUX:{ed:null},rows:[{value:-10},{value:0},{value:10},{value:90}],extraRows:[],USER:{map:new Map(),parsed:null},EL:[],M:new Map(),CL:C,RNG_UNIT:{dme:'keV'},DC:{},
    T:{cl_off_mode:'Fixed colours',range_off_mode:'Choose a numerical quantity',range_bad:'min must be smaller than max',range_log:'log10',cl_note_zero:'{n} classes',mine_status:'{m}/{n}/{e}',mine_unknown_count:'{n} unknown sigma',mine_custom:'Custom',mine_duplicates:'{n} duplicate identities',mine_unknown:'unknown',cl_none:'no edges'},
    fill:(t,o)=>String(t||'').replace(/\{(\w+)\}/g,(_,k)=>o[k]??''),escape:s=>String(s),ramp:x=>'hsl('+270*(1-Math.max(0,Math.min(1,x)))+',85%,52%)',modelKey:()=> 'frdm',pass:()=>true,memo:{clear(){}},drawStats(){},modelFailure(){},
    window:{ZGChartUserData:UD,ZGChartTypedData:TD},document:{createElement:()=>({})},key:(z,n)=>z*1000+n,chain:null,chainInput:n=>get('nc-'+n),pq:{value:'mine',onchange(){}},PQ:{mine:['My data',()=>null,'counts']},plotChain(){},loads:[],allRows(){return ctx.rows.concat(ctx.src==='ame'?[]:ctx.extraRows);},loadModels:()=>Promise.resolve(),loadAux:name=>{ctx.loads.push(name);return Promise.resolve().then(()=>{ctx.AUX[name]=true;ctx.rows=[{value:-800},{value:0},{value:1450}];});}
  };
  const numerical={label:'ME',v:r=>r.value,lo:-30,hi:30};
  ctx.MODES={decay:{label:'decay',f:()=> '#111'},me:numerical,dme:{...numerical,label:'precision',rng:['0.001 keV','1 MeV'],lo:-3,hi:3},dame16:{...numerical,label:'edition',v:r=>ctx.AUX.ed?r.value:null,auto:true,div:true,aux:'ed'},beta2:{...numerical,label:'model',div:true,lo:-.3,hi:.4},mine:{...numerical,label:'mine',user:true,lo:0,hi:1}};
  ctx.draw=()=>{ctx.painted=ctx.rows.map(r=>ctx.colour(r));};
  vm.createContext(ctx);
  vm.runInContext(cut('  const autoCache = new Map();','  const pick =')+'\n'+cut('  function colour(r) {','  /* ---------- drawing')+'\n'+cut('  const rngUnit =','  const darkHex =')+'\n'+cut('  function changeColourMode()','  /* ---- parity filters')+'\n'+cut('  /* ---- divided colour bar (default off:','  if (msel) msel.onchange')+'\nthis.colour=colour;this.bounds=bounds;this.colourGradient=colourGradient;this.syncColourControls=syncColourControls;',vm.createContext(Object.assign(ctx,{syncClassControls:()=>{},syncRangeControls:()=>{},syncColourControls:()=>{ctx.syncClassControls();ctx.syncRangeControls();}})));
  return {ctx,get,legend,canvas,setMode(name,direct=false){ctx.sel.value=name;if(direct)ctx.sel.onchange();else ctx.sel.fire('change');}};
}

test('fresh overlay defaults enable only N=Z; no runtime handler forces saved line choices',()=>{
  const overlays=[...template.matchAll(/<input\b[^>]*data-(drip|opt|path)="([^"]+)"[^>]*>/g)];
  assert.equal(overlays.length,8);
  assert.deepEqual(overlays.filter(m=>/\schecked(?:\s|>)/.test(m[0])).map(m=>m[2]),['nz']);
  assert.doesNotMatch(template, /name="nc-classes"[^>]*checked/);
  assert.doesNotMatch(source,/data-(?:drip|path)[^\n]{0,50}\.checked\s*=\s*(?:true|false)/);
});

test('dropdown and direct mode callback both enable numerical controls and clear old isolation',()=>{
  for(const direct of [false,true]){
    const h=harness();assert.equal(h.get('nc-classes').disabled,true);assert.equal(h.get('.nc-class-note').textContent,'Fixed colours');assert.equal(h.get('.nc-range-note').textContent,'Choose a numerical quantity');
    h.ctx.isolate.add(2);h.ctx.isolateMode='decay';h.setMode('me',direct);
    assert.equal(h.get('nc-classes').disabled,false);assert.equal(h.get('nc-range-manual').disabled,false);assert.equal(h.get('nc-range-min').disabled,true);assert.equal(h.ctx.isolate.size,0);
    h.get('nc-classes').checked=true;h.get('nc-classes').fire('change');
    assert.equal(h.get('nc-class-n').disabled,false);assert.equal(h.ctx.classState.edges.length,8);assert.match(h.legend.innerHTML,/data-class="8"/);
    h.setMode('decay',direct);assert.equal(h.get('nc-classes').disabled,true);assert.equal(h.get('nc-class-method').disabled,true);assert.equal(h.get('nc-range-manual').disabled,true);
    h.setMode('me',direct);assert.equal(h.get('nc-class-method').disabled,false);
  }
});

test('manual range checkbox controls fields, rejects invalid edits and restores automatic bounds',()=>{
  const h=harness();h.setMode('me');
  const on=h.get('nc-range-manual'),lo=h.get('nc-range-min'),hi=h.get('nc-range-max');
  assert.equal(lo.disabled,true);assert.equal(lo.value,'-10');on.checked=true;on.fire('change');assert.equal(lo.disabled,false);
  lo.value='-10';hi.value='90';lo.fire('input');assert.deepEqual({...h.ctx.manualRange},{lo:-10,hi:90});
  const before=h.ctx.painted.slice();hi.value='-20';hi.fire('input');assert.deepEqual({...h.ctx.manualRange},{lo:-10,hi:90});assert.deepEqual(h.ctx.painted,before);assert.equal(hi.attrs['aria-invalid'],'true');assert.ok(hi.validationMessage);
  hi.value='100';hi.fire('input');assert.equal(hi.validationMessage,'');assert.equal(hi.attrs['aria-invalid'],undefined);
  on.checked=false;on.fire('change');assert.equal(h.ctx.manualRange,null);assert.equal(lo.disabled,true);assert.equal(lo.value,'-10');assert.equal(hi.value,'90');
  lo.value='-999';lo.fire('input');assert.equal(h.ctx.manualRange,null);
});

test('classes update legend and cells together after manual range and method edits',()=>{
  const h=harness();h.setMode('me');h.get('nc-classes').checked=true;h.get('nc-classes').fire('change');
  h.get('nc-range-manual').checked=true;h.get('nc-range-manual').fire('change');h.get('nc-range-min').value='-10';h.get('nc-range-max').value='90';h.get('nc-range-max').fire('input');
  assert.ok(h.ctx.classState.edges[0]>-10&&h.ctx.classState.edges.at(-1)<90);assert.ok(h.legend.innerHTML.includes(h.ctx.colour({value:10})));
  h.get('nc-class-method').value='manual';h.get('nc-class-method').fire('change');assert.equal(h.get('nc-class-edges').disabled,false);assert.equal(h.get('nc-class-n').disabled,true);
  h.get('nc-class-edges').value='-5, 5, 50';h.get('nc-class-edges').fire('input');assert.deepEqual([...h.ctx.classState.edges],[-5,5,50]);assert.equal(h.ctx.colour({value:6}),h.ctx.colour({value:49}));
  h.get('nc-class-method').value='quantile';h.get('nc-class-method').fire('change');assert.equal(h.get('nc-class-edges').disabled,true);assert.ok(h.ctx.classState.edges.length>0);
  h.get('nc-classes').checked=false;h.get('nc-classes').fire('change');assert.match(h.legend.innerHTML,/linear-gradient/);assert.notEqual(h.ctx.colour({value:6}),h.ctx.colour({value:49}));
});

test('AME edition asynchronous range refill, model and logarithmic modes stay coherent',async()=>{
  const h=harness();h.setMode('dame16',true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.get('nc-range-min').value,'-800');assert.equal(h.get('nc-range-max').value,'1450');
  h.get('nc-classes').checked=true;h.get('nc-classes').fire('change');assert.equal(h.get('nc-class-scheme').disabled,true);assert.equal(h.ctx.classState.edges.length,8);
  h.setMode('beta2',true);assert.equal(h.get('nc-range-min').value,'-800');assert.equal(h.get('nc-range-max').value,'1450');
  h.setMode('dme',true);assert.equal(h.get('.nc-range-note').textContent,'log10');h.get('nc-class-method').value='manual';h.get('nc-class-method').fire('change');h.get('nc-class-edges').value='0.1,1,100';h.get('nc-class-edges').fire('input');assert.deepEqual([...h.ctx.classState.edges],[-1,0,2]);
});

test('own-table Apply enters the numeric mode through the same control synchronization',()=>{
  const h=harness();h.ctx.rows=[[20,28],[20,30]];h.ctx.MODES.mine.v=r=>h.ctx.USER.map.get(h.ctx.key(r[0],r[1]));h.get('nc-mine-text').value='Z,N,value\n20,28,3\n20,30,7';h.get('[data-nc="mine-apply"]').onclick();
  assert.equal(h.ctx.mode,'mine');assert.equal(h.get('nc-classes').disabled,false);assert.equal(h.get('nc-range-manual').disabled,false);assert.equal(h.get('nc-range-min').value,'3');assert.equal(h.get('nc-range-max').value,'7');
});

test('asymmetric signed legend places zero where the cell colour function does',()=>{
  const h=harness();h.ctx.AUX.ed=true;h.setMode('dame16');h.ctx.manualRange={lo:-10,hi:90};
  const gradient=h.ctx.colourGradient(h.ctx.MODES.dame16);assert.match(gradient,/hsl\(0,80%,96%\) 10%/);assert.notEqual(h.ctx.colour({value:-10}),h.ctx.colour({value:90}));
  assert.match(source,/draw\(o\.getContext\("2d"\), o\.width, o\.height, sc\)/); // PNG reuses the exact cell renderer.
});

test('disabled range explanations exist in every supported language',()=>{
  const labels=fs.readFileSync(path.join(__dirname,'../data/nuclide_chart_labels.yaml'),'utf8');
  for(const lang of ['en','zh','fi','de','ja','fr']){const section=labels.split('\n'+lang+':')[1];assert.ok(section,lang);assert.match(section.split(/\n[a-z]{2}:/)[0],/range_off_mode: .+/);}
});

test('full-data and opt-in percentile buttons keep finite spans and show the chosen override',()=>{
  const h=harness();h.setMode('me');h.get('[data-nc="range-auto"]').onclick();
  assert.ok(h.ctx.manualRange.lo>-10 && h.ctx.manualRange.hi<90);assert.equal(h.get('nc-range-manual').checked,true);
  h.get('[data-nc="range-full"]').onclick();assert.deepEqual({...h.ctx.manualRange},{lo:-10,hi:90});
  h.ctx.rows=[{value:4},{value:4}];h.get('[data-nc="range-full"]').onclick();assert.ok(h.ctx.manualRange.lo<4&&h.ctx.manualRange.hi>4);assert.equal(h.get('nc-range-min').disabled,false);
});

test('random selection is safe when parity and mass filters leave no candidates',()=>{
  const control=new Control();let zooms=0;
  const ctx={root:{querySelector:()=>control},rows:[],pass:()=>true,pin:null,zoomTo(){zooms++;},showCard(){},plotChain(){},Math};
  vm.runInNewContext(cut('  root.querySelector("[data-nc=random]").onclick','  sel.innerHTML ='),ctx);
  control.onclick();assert.equal(zooms,0);assert.equal(ctx.pin,null);
  ctx.rows=[[20,28,'Ca']];control.onclick();assert.equal(zooms,1);assert.equal(ctx.pin[2],'Ca');
});

test('unchecked paths do not load a model and a failed path index reports an error',async()=>{
  const overlay=new Control();let loads=0,errors=0,draws=0;
  const ctx={ovl:overlay,PATHS:{},loadIndex(){loads++;return Promise.reject(Error('offline'));},modelFailure(){errors++;},draw(){draws++;}};
  vm.runInNewContext(cut('  if (ovl) ovl.addEventListener("change"','  fsel.innerHTML ='),ctx);
  const cb=new Control();cb.dataset.path='r';overlay.listeners.change[0]({target:cb});assert.equal(loads,0);
  cb.checked=true;overlay.listeners.change[0]({target:cb});await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);assert.equal(errors,1);assert.equal(draws,2);
});

test('automatic bound labels and manual prefill round outwards, preserving extrema',()=>{
  const h=harness();h.ctx.rows=[{value:-0.123456789},{value:1.23456789}];h.setMode('me');
  assert.ok(Number(h.get('nc-range-min').value)<=-0.123456789);assert.ok(Number(h.get('nc-range-max').value)>=1.23456789);
  h.get('nc-range-manual').checked=true;h.get('nc-range-manual').fire('change');assert.ok(h.ctx.manualRange.lo<=-0.123456789);assert.ok(h.ctx.manualRange.hi>=1.23456789);
});
