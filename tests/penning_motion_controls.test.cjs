'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Motion=require('../static/js/trap-motion.js');
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

// Execute the actual controllers with bounded DOM/canvas stubs. Motion itself is
// the real teaching kernel; point() observes the state without a production test API.
function fixture(kind,{reduced=false}={}){
  class Element{
    constructor(value=''){this.value=value;this.min='0';this.max='200';this.step='0.01';this.checked=false;this.disabled=false;this.attrs={};this.events={};this.style={};this.dataset={};this.validity={valid:true};this.classList={toggle(){}};this.parentElement={childNodes:[{textContent:'Control'}],querySelector:()=>this.output};this.output={textContent:''};}
    addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
    dispatchEvent(e){for(const fn of this.events[e.type]||[])fn(e);}
    setAttribute(k,v){this.attrs[k]=v;}
    after(e){e.movedAfter=this;}
    append(e){e.appendedTo=this;}
    closest(s){return s==='[data-act]'&&this.dataset.act?this:null;}
    setPointerCapture(){}
    getBoundingClientRect(){return {width:640,top:0,bottom:440};}
  }
  const f={fields:{},nodes:new Map(),captions:[],raf:[],dragCalls:0,couplingCalls:0};
  const ctx=()=>new Proxy({lines:[],images:[],clearRect(){this.lines=[];},lineTo(...p){this.lines.push(p);},fillRect(){this.images=[];this.background=this.fillStyle;},drawImage(c,x,y){this.images.push({canvas:c,x,y,width:c.width,height:c.height});}}, {get(o,k){return k in o?o[k]:(()=>{});}});
  const canvas=()=>{const c=new Element();c.width=640;c.height=440;c.context=ctx();c.getContext=()=>c.context;return c;};
  f.top=canvas();f.side=canvas();
  const values=kind===2?{ratio:18,rp:25,rm:70,az:65,speed:6}:{ratio:21,rp:25,rm:65,az:45,speed:4,trail:1400,ions:1,spread:4,auto:0,cool:0,electrodes:0,field:0,detector:0};
  for(const [k,v]of Object.entries(values)){const el=new Element(String(v));el.name=k;if(k==='ions')el.step='1';f.fields[k]=el;f.nodes.set(kind===2?'#zg-'+k:`[name="${k}"]`,el);if(kind===2)f.nodes.set('#zg-'+k+'-o',el.output);}
  for(const key of ['pause','reset']){f[key]=new Element();f.nodes.set(`[data-motion-action="${key}"]`,f[key]);}
  for(const [sel,value]of [['[data-gamma]','0.08'],['[data-process]','current'],['[data-seconds]','6'],['[data-dipole-phase]','0'],['[data-cooling]',''],['[data-sideband]','']])f.nodes.set(sel,new Element(value));
  if(kind===2){f.nodes.set('#zg-sim-top',f.top);f.nodes.set('#zg-sim-side',f.side);for(const k of ['clear','convert','sim-png','sim-video'])f.nodes.set('#zg-'+k,new Element());f.axialExport=new Element();f.axialExport.checked=true;f.nodes.set('#zg-sim-export-axial',f.axialExport);}
  else{f.nodes.set('canvas',f.top);for(const k of ['pulse','dipole','reset','video']){const e=new Element();e.dataset.act=k;f.nodes.set('act:'+k,e);}}
  f.root=new Element();f.root.querySelector=s=>{const e=f.nodes.get(s);if(!e)throw Error('Unstubbed selector '+s);return e;};f.root.querySelectorAll=()=>Object.values(f.fields).filter(e=>!['auto','cool','electrodes','field','detector'].includes(e.name));
  const kernel={...Motion,point(o,m,t){f.state=o;f.time=t;return Motion.point(o,m,t);},drag(...a){f.dragCalls++;return Motion.drag(...a);},coupling(...a){f.couplingCalls++;return Motion.coupling(...a);}};
  const capture=cv=>({width:cv.width,height:cv.height,copies:cv.context.images.slice(),background:cv.context.background});
  const exports={png(cv){f.pngCapture=capture(cv);},caption(g,w,text){f.captions.push(Array.from(text));},record(cv,seconds,name,cb){f.recording={cv,seconds,name,cb,initial:capture(cv)};cb(true);}};
  const context={window:{ZGTrapMotion:kernel,zgExport:exports},zgExport:exports,document:{querySelector:()=>f.root,createElement:type=>type==='canvas'?canvas():new Element(),documentElement:{}},matchMedia:()=>({matches:reduced}),getComputedStyle:()=>({getPropertyValue:()=>''}),innerHeight:900,devicePixelRatio:2,requestAnimationFrame:fn=>f.raf.push(fn),addEventListener(){},ResizeObserver:class{observe(){}},Event:class{constructor(type){this.type=type;}}};
  vm.runInNewContext(fs.readFileSync(`static/js/trap${kind}d.js`,'utf8'),context);
  f.frame=now=>{const fn=f.raf.shift();assert.equal(typeof fn,'function');fn(now);};
  f.change=(key,value,number=false)=>{const e=number?f.fields[key]._number:f.fields[key];e.value=String(value);e.dispatchEvent({type:'input'});};
  f.click=action=>{if(action==='pause'||action==='reset')f[action].onclick();else if(kind===2)f.nodes.get('#zg-'+action).onclick();else f.root.dispatchEvent({type:'click',target:f.nodes.get('act:'+action)});};
  f.video=()=>kind===2?f.click('sim-video'):f.click('video');
  f.cool=kind===2?f.nodes.get('[data-cooling]'):f.fields.cool;
  f.couple=f.nodes.get('[data-sideband]');
  f.frame(1000);return f;
}

test('2D axial slider and number change amplitude while preserving phase and radial state',()=>{
  const f=fixture(2,{reduced:true});near(f.state.axial,.65);f.state.phz=1.23;f.state.plus=[.1,.2];
  f.change('az',120);near(f.state.axial,1.2);near(f.state.phz,1.23);assert.deepEqual(Array.from(f.state.plus),[.1,.2]);
  assert.equal(f.fields.az._number.value,'120.00');f.change('az',82.5,true);near(f.state.axial,.825);near(f.state.phz,1.23);
  const before=f.state.axial;f.fields.az._number.value='';f.fields.az._number.dispatchEvent({type:'input'});near(f.state.axial,before);
});

test('2D damping synchronizes axial amplitude and reset restores undamped motion beside Clear trail',()=>{
  const f=fixture(2);f.cool.checked=true;f.couple.checked=true;f.frame(1050);assert.ok(f.state.axial<.65);
  near(+f.fields.az.value,100*f.state.axial);assert.equal(f.fields.az._number.value,(100*f.state.axial).toFixed(2));
  f.change('ratio',32);f.change('speed',12);f.state.phz=2;f.click('reset');
  near(f.state.axial,.65);near(Motion.radius(f.state.plus),.25);near(Motion.radius(f.state.minus),.7);near(f.state.phz,0);near(f.time,0);
  assert.equal(f.cool.checked,false);assert.equal(f.couple.checked,false);assert.equal(+f.fields.ratio.value,32);assert.equal(+f.fields.speed.value,12);
  assert.equal(f.reset.movedAfter,f.nodes.get('#zg-clear'));assert.equal(f.top.context.lines.length,2,'old trail is cleared');
  const dr=f.dragCalls,co=f.couplingCalls;f.frame(1100);f.frame(1150);near(f.state.axial,.65);assert.equal(f.dragCalls,dr);assert.equal(f.couplingCalls,co);
});

test('2D pause state agrees with reduced motion, excitation, reset and recording restore',()=>{
  const f=fixture(2,{reduced:true});assert.equal(f.pause.attrs['aria-pressed'],'true');f.click('reset');assert.equal(f.pause.attrs['aria-pressed'],'true');
  f.click('convert');assert.equal(f.pause.attrs['aria-pressed'],'false');f.click('pause');assert.equal(f.pause.attrs['aria-pressed'],'true');
  f.change('az',91.25);f.nodes.get('[data-process]').value='gas';f.video();assert.equal(f.pause.attrs['aria-pressed'],'false');assert.equal(f.reset.disabled,true);
  assert.ok(f.captions.flat().some(s=>s.includes('z0=91.25')));f.recording.cb(false);assert.equal(f.pause.attrs['aria-pressed'],'true');assert.equal(f.reset.disabled,false);
});

test('2D HD PNG composites both native-resolution views on white and restores preview scale',()=>{
  const f=fixture(2,{reduced:true});f.click('sim-png');const p=f.pngCapture;
  assert.deepEqual([p.width,p.height],[3360,2520]);assert.equal(p.background,'#fff');assert.equal(p.copies.length,2);
  assert.equal(p.copies[0].canvas,f.top);assert.equal(p.copies[1].canvas,f.side);assert.deepEqual([p.copies[1].x,p.copies[1].y],[2520,0]);
  assert.deepEqual([p.copies[0].width,p.copies[0].height,p.copies[1].width,p.copies[1].height],[2520,2520,840,2520]);
  assert.deepEqual([f.top.width,f.top.height,f.side.width,f.side.height],[840,840,280,840]);
  f.axialExport.checked=false;f.click('sim-png');assert.deepEqual([f.pngCapture.width,f.pngCapture.height],[2520,2520]);assert.equal(f.pngCapture.copies.length,1);
});

test('2D recording starts from a populated composite and freezes its view choice until completion',()=>{
  const f=fixture(2,{reduced:true});f.video();const r=f.recording;
  assert.deepEqual([r.initial.width,r.initial.height],[1680,1260]);assert.equal(r.initial.copies.length,2);assert.equal(r.initial.background,'#fff');
  assert.equal(r.cv.appendedTo,f.root,'shared recording helper can find the preview/save container');assert.equal(r.cv.hidden,true);
  assert.equal(f.axialExport.disabled,true);assert.equal(f.nodes.get('#zg-sim-png').disabled,true);f.axialExport.checked=false;f.frame(1050);
  assert.equal(r.cv.width,1680);assert.equal(r.cv.context.images.length,2,'live frames retain the captured source choice');
  r.cb(false);assert.equal(f.axialExport.disabled,false);assert.equal(f.nodes.get('#zg-sim-png').disabled,false);assert.equal(f.top.width,840);
  f.video();assert.deepEqual([f.recording.initial.width,f.recording.initial.height],[1260,1260]);assert.equal(f.recording.initial.copies.length,1);
});

test('3D reset restores amplitudes, visible initial state and disables drag/coupling without changing view-reset meaning',()=>{
  const f=fixture(3);f.cool.checked=true;f.couple.checked=true;f.frame(1050);assert.ok(f.state.axial<.45);
  near(+f.fields.az.value,100*f.state.axial);f.change('ratio',35);f.change('speed',9);f.click('pause');f.click('reset');
  near(f.state.axial,.45);near(Motion.radius(f.state.plus),.25);near(Motion.radius(f.state.minus),.65);near(f.time,0);
  assert.equal(f.state.trail.length,1,'paused restart retains the initial point');assert.equal(f.cool.checked,false);assert.equal(f.couple.checked,false);assert.equal(f.pause.attrs['aria-pressed'],'true');
  assert.equal(+f.fields.ratio.value,35);assert.equal(+f.fields.speed.value,9);
  const state=f.state;f.cool.checked=true;f.couple.checked=true;f.root.dispatchEvent({type:'click',target:f.nodes.get('act:reset')});
  assert.equal(f.state,state);assert.equal(f.cool.checked,true,'Reset view only resets camera');assert.equal(f.couple.checked,true);
});

test('3D paused initial axial edits remain visible and recording caption/restart retain initial z',()=>{
  const f=fixture(3,{reduced:true});assert.equal(f.pause.attrs['aria-pressed'],'true');assert.equal(f.state.trail.length,1);
  f.change('az',105.5,true);near(f.state.axial,1.055);assert.equal(f.state.trail.length,1);
  f.nodes.get('[data-process]').value='sideband';f.video();assert.equal(f.pause.attrs['aria-pressed'],'false');assert.equal(f.reset.disabled,true);
  assert.ok(f.captions.flat().some(s=>s.includes('z0=105.50')));f.recording.cb(false);assert.equal(f.pause.attrs['aria-pressed'],'true');assert.equal(f.reset.disabled,false);
});

test('2D axial labels cover six languages and each Penning view reuses one motion reset',()=>{
  const template=fs.readFileSync('layouts/_shortcodes/lab.html','utf8'),labels=fs.readFileSync('data/trap_labels.yaml','utf8'),three=fs.readFileSync('layouts/_partials/zg/legacy-penning3d.html','utf8');
  assert.equal((template.match(/id="zg-az"/g)||[]).length,1);assert.match(template,/trap_labels \$k\)\.az/);assert.equal((template.match(/zg\/trap-process-controls.html/g)||[]).length,1);
  assert.equal((template.match(/id="zg-sim-export-axial"/g)||[]).length,1);assert.match(template,/id="zg-sim-export-axial" checked/);
  for(const lang of ['en','zh','fi','de','ja','fr'])assert.match(labels,new RegExp('^'+lang+':\\n  az: .+z₀\\n  exportaxial: .+','m'));
  assert.equal((three.match(/data-act="reset"/g)||[]).length,1);assert.equal((three.match(/zg\/trap-process-controls.html/g)||[]).length,1);
  assert.match(three,/"fr" \(dict "t3d" "Piège de Penning 3D"/);assert.match(three,/"reset" "Réinitialiser la vue"/);
  const fr=three.slice(three.indexOf('"fr" (dict'),three.indexOf('-}}',three.indexOf('"fr" (dict'))),keys=new Set([...fr.matchAll(/"([a-z0-9]+)"\s+"[^"]*"/g)].map(m=>m[1]));
  for(const [,key]of three.matchAll(/\$t\.([a-z0-9]+)/g))assert.ok(keys.has(key),'French3D missing '+key);
});
