'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../static/js/figure-style.js'),C=require('../static/js/spectroscopy-core.js'),CP=require('../static/js/chain-plot.js');
test('appearance settings round-trip every field without replacing scientific data',()=>{
 const style=F.normalize({titleSize:24,axisSize:20,tickSize:18,legendSize:18,markerDiameter:14,lineWidth:2,rasterWidth:1800,filename:'my-figure'});
 assert.deepEqual(F.parse(F.serialize(style)),style);assert.equal(F.exportName(style,'king-plot'),'my-figure-king-plot');
 for(const bad of [{tickSize:''},{tickSize:Infinity},{markerDiameter:0},{lineWidth:-1},{rasterWidth:1800.5},{filename:'../private'},{filename:'x\n'}])assert.throws(()=>F.normalize(bad));
 assert.throws(()=>F.parse('{"schema":"traps-figure-style-v1"}'));assert.throws(()=>F.parse('{"schema":"other","style":{}}'));
});
test('real nuclear-level viewBox exports with its 720:420 aspect ratio',()=>{
 assert.deepEqual(F.rasterSize('0 0 720 420',2160),{width:2160,height:1260});
 assert.deepEqual(F.rasterSize('0 0 720 380',1800),{width:1800,height:950});
 assert.throws(()=>F.rasterSize('0 0 0 420',2160));
});
test('all six language controls are complete and long words wrap within the measured width',()=>{
 for(const lang of ['en','zh','fi','de','ja','fr'])assert.equal(F.labels[lang].length,14);
 const lines=F.wrapText('long-isotope-reference-and-provenance 123Cs',60,10,s=>s.length*6);
 assert.ok(lines.length>2);assert.ok(lines.every(s=>s.length*6<=60));
 assert.equal(lines.join('').replaceAll(' ',''),'long-isotope-reference-and-provenance123Cs');
});
function elements(){
 const nodes=[];class E{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.listeners={};this.ownerDocument=doc;nodes.push(this);}append(...v){this.children.push(...v);}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}addEventListener(k,f){this.listeners[k]=f;}querySelector(s){return this.children.find(n=>n.tag===s)||null;}replaceChildren(...v){this.children=v;}getContext(){return{font:'',measureText:s=>({width:String(s).length*7})};}}
 const doc={createElement:tag=>new E(tag)};return{nodes,doc,E};
}
test('actual controls apply valid edits, preserve last valid rendering during invalid typing, reset and import presets',async()=>{
 const {E}=elements(),host=new E('div'),changes=[],ui=F.controls(host,{lang:'fr',prefix:'unit',onChange:s=>changes.push(s)});
 ui.fields.markerDiameter.value='14';ui.fields.markerDiameter.listeners.input();assert.equal(ui.get().markerDiameter,14);
 ui.fields.markerDiameter.value='';ui.fields.markerDiameter.listeners.input();assert.equal(ui.get().markerDiameter,14);assert.equal(ui.valid(),false);assert.throws(()=>ui.validate());
 ui.reset();assert.deepEqual(ui.get(),F.defaults);assert.equal(changes.length,2);
 const file=ui.element.children[2].children[2].children[0],preset=F.serialize({...F.defaults,tickSize:17});file.files=[{size:preset.length,text:async()=>preset}];await file.onchange();assert.equal(ui.get().tickSize,17);assert.equal(file.value,'');
});
const source=fs.readFileSync('static/js/spectroscopy.js','utf8');
function render(style){
 const {E,doc}=elements(),se=(tag,attrs={},text)=>{const n=new E(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.textContent=text||'';return n;},parent=new E('div');
 const context={NS:'http://www.w3.org/2000/svg',FS:F,figureStyle:{get:()=>style},figureRenderers:new Map(),document:doc,C,t:k=>k,se,el:(tag,text)=>{const n=new E(tag);n.textContent=text;return n;}};
 const start=source.indexOf('    function figure(parent,'),end=source.indexOf('    function savebar(',start);vm.runInNewContext(source.slice(start,end)+';this.render=figure;',context);
 const points=[{x:40,y:3.5,s:.02},{x:42,y:3.6,s:.01}],before=JSON.stringify(points);context.render(parent,'Charge radii','A','r / fm',points,false,null,{integerX:true,caption:'Source snapshot'});assert.equal(JSON.stringify(points),before);return parent.children[0];
}
const all=n=>[n,...n.children.flatMap(all)];
test('actual spectroscopy renderer changes SVG text, marks and lines while retaining scientific points',()=>{
 const a=render(F.defaults),style=F.normalize({titleSize:24,axisSize:20,tickSize:18,legendSize:18,markerDiameter:14,lineWidth:2}),b=render(style),nodes=all(b);
 assert.equal(nodes.find(n=>n.attrs['data-figure-role']==='title').attrs['font-size'],'24');
 assert.equal(nodes.find(n=>n.attrs['data-figure-role']==='tick').attrs['font-size'],'18');
 assert.equal(nodes.find(n=>n.attrs['data-figure-role']==='axis').attrs['font-size'],'20');
 assert.ok(nodes.filter(n=>n.tag==='circle').every(n=>n.attrs.r==='7'));assert.equal(nodes.filter(n=>n.tag==='circle').length,2);
 assert.ok(nodes.some(n=>n.tag==='path'&&n.attrs['stroke-width']==='3'));
 assert.ok(Number(b.attrs.viewBox.split(' ')[3])>Number(a.attrs.viewBox.split(' ')[3]));
});
test('chain geometry keeps hit testing aligned when larger fonts reserve extra margins',()=>{
 const extent={x0:48,x1:52,y0:7,y1:9},point={x:50,y:8};
 const g=CP.geometry(extent,900,500,false,1,70,{left:110,right:25,bottom:65});
 assert.equal(g.L,110);assert.equal(g.B,65);assert.equal(CP.nearest([point],g.px(50),g.py(8),g),point);
 const exportG=CP.geometry(extent,1800,1000,false,2,70,{left:110,right:25,bottom:65});assert.equal(exportG.px(50),2*g.px(50));assert.equal(exportG.py(8),2*g.py(8));
});
test('cached chart HTML without the optional style helper keeps baseline controls and exports usable',()=>{
 const source=fs.readFileSync('static/js/nuclide-chart.js','utf8'),start=source.indexOf('  // Cached standalone HTML'),end=source.indexOf('  let activeChainType',start);
 for(const supplied of [undefined,{}]){const context={window:{ZGChainPlot:CP,ZGFigureStyle:supplied}};vm.runInNewContext(source.slice(start,end)+';this.api=FS;this.style=chainStyle();',context);
  assert.equal(context.style.markerDiameter,7.2);assert.equal(context.style.rasterWidth,5760);const fallback=context.api.controls(null,{baseline:context.style});assert.equal(fallback.valid(),true);assert.equal(fallback.get().tickSize,11);assert.equal(context.api.exportName(context.style,'chain-bea'),'chain-bea');assert.ok(context.api.wrapText('long-name',24,10,s=>s.length*6).every(s=>s.length<=4));}
 assert.match(source,/figureStyleHost\?FS\.controls/);
});
test('actual chain canvas uses selected title/tick/legend fonts and relative display marker size',()=>{
 const chain=fs.readFileSync('static/js/nuclide-chart.js','utf8'),start=chain.indexOf('  function drawPlot('),end=chain.indexOf('  function drawResidual(',start),texts=[],arcs=[];
 const canvas={font:'',fillText(text){texts.push([text,this.font]);},arc(x,y,r){arcs.push(r);},measureText:s=>({width:String(s).length*7})};
 for(const key of ['setTransform','clearRect','fillRect','strokeRect','save','restore','translate','rotate','beginPath','rect','clip','setLineDash','moveTo','lineTo','stroke','fill','closePath'])canvas[key]=()=>{};
 const points=[{x:50,y:8,r:[50,50,'Sn'],g:50,series:'ame',styleKey:'ame'}];points.groups=[50];const style={titleSize:22,axisSize:20,tickSize:18,legendSize:17,markerDiameter:14.4,lineWidth:2};
 const context={chainStyle:()=>style,lineWidth:()=>1,pg:canvas,pc:{width:900,height:500,_cw:900,_ch:500},plotPts:points,modPts:[],plotDomain:{x0:48,x1:52,y0:7,y1:9},plotGeom:(d,w,h,s)=>CP.geometry(d,w,h,false,s),plotHover:null,ink:'#222',niceTicks:(a,b)=>[a,b],fmtTick:String,pchain:{value:'Z'},pq:{value:'bea'},PQ:{bea:['BE/A',null,'MeV/nucleon']},MAGIC:[],chainColor:()=> '#123',chainInput:()=>({checked:false}),drawBands(){},visibleSeries:[{id:'ame',key:'ame',shape:'circle'}],inSeries:(p,s)=>p.styleKey===s.key,pointColor:()=> '#123',CP,chain:null,getComputedStyle:()=>({getPropertyValue:()=> '#fff'}),document:{documentElement:{}},titleLines:()=>['title'],titleHeight:()=>30,legendRow:()=>24,seriesLegendLines:()=>[{text:'AME',first:false}],inputLegendLines:()=>[]};
 vm.runInNewContext(chain.slice(start,end)+';drawPlot();',context);assert.ok(arcs.includes(7.2));assert.ok(texts.some(([text,font])=>text==='title'&&font==='22px system-ui'));assert.ok(texts.some(([text,font])=>text==='AME'&&font==='17px system-ui'));assert.ok(texts.some(([,font])=>font==='18px system-ui'));
});
