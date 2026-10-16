const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const P=require('../static/js/physics.js'),CP=require('../static/js/chain-plot.js'),MM=require('../static/js/measured-masses.js');
const source=fs.readFileSync('static/js/nuclide-chart.js','utf8');
function slice(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function chartFixture({filter='all',sigmaEst=false,quantity='dme'}={}){
 const ame=P.primitive('AME2020:50066',-91525.979,.096,false,sigmaEst);
 const input=P.primitive('loaded:50-66-0:test',-91515.979,1,false);
 const inputTable={active:new Map([['50-66-0',{value:input,label:'JYFLTRAP',rows:[],references:[]}]])};
 const context={P,CP,MM,inputTable,filter,maxSigma:null,pq:{value:quantity},
  T:new Proxy({}, {get:(o,k)=>String(k)}),reactionDefinitions:{},extraFilters:{},dmod:()=>null,
  derivedZN:(z,n,s)=>({me:s==='hybrid'?input:ame,s2n:P.combine([1,ame],[-1,s==='hybrid'?input:ame])}),
  get:()=>ame,getter:()=>()=>input,xv:(z,n)=>n,group:()=>50,
  seriesMeta:(s,labels)=>({key:s+labels.join(),name:s})};
 vm.runInNewContext(slice('  const PQ = {','  const formulaDefinitions=')+'\nq=PQ[pq.value];\n'+
  slice('    const passPoint=','    plotPts=[];')+'\nresult={PQ,dependencyValue,passPoint,makePoint};',context);
 return {...context.result,context,ame,input};
}
test('actual chart keeps new mass-uncertainty points under Affected and preserves input provenance',()=>{
 const f=chartFixture({filter:'affected'}),p=f.makePoint([50,66,'Sn'],'loaded');
 assert.ok(p,'active 116Sn input must survive the affected filter');
 assert.equal(p.y,1);assert.equal(p.e,null,'the uncertainty of sigma is unavailable, not zero');
 assert.equal(p.dependencyValue,f.input);assert.equal(MM.affected(p.dependencyValue),true);
 assert.equal(MM.provenance(p.dependencyValue,f.context.inputTable)[0].id,'loaded:50-66-0:test');
 assert.equal(f.makePoint([50,66,'Sn'],'hybrid'),null,'one new mass alone is not a mixed mass expression');
});
test('uncertainty-only AME # stays an open diagnostic point and retains the original mass metadata',()=>{
 const f=chartFixture({sigmaEst:true}),p=f.makePoint([50,66,'Sn'],'ame');
 assert.equal(p.y,.096);assert.equal(p.est,true);assert.equal(p.valueObj.sigmaEst,true);
 assert.equal(p.dependencyValue.est,false);assert.equal(p.dependencyValue.sigmaEst,true);
 assert.match(p.valueObj.uncertainty_model,/uncertainty of the uncertainty unavailable/);
 const filtered=chartFixture({sigmaEst:true,filter:'measured'});
 assert.equal(filtered.makePoint([50,66,'Sn'],'ame'),null,'exclude # also applies to the plotted standard uncertainty');
});
test('ordinary mass plots retain the quantity itself as the dependency and exact residual provenance',()=>{
 const f=chartFixture({quantity:'me',filter:'affected'}),p=f.makePoint([50,66,'Sn'],'loaded');
 assert.equal(p.y,-91.515979);assert.equal(p.e,.001);assert.equal(p.valueObj,p.dependencyValue);
 const residual=P.combine([1,p.valueObj],[-1,f.ame]);
 assert.equal(f.dependencyValue('me',{},residual),residual);
 assert.deepEqual(Object.keys(residual.terms).sort(),['AME2020:50066','loaded:50-66-0:test']);
});
test('actual chain CSV uses mass provenance for the sigma diagnostic and residual terms for residual rows',()=>{
 const f=chartFixture(),p=f.makePoint([50,66,'Sn'],'loaded'),saved=[];
 const residual=P.combine([1,f.input],[-1,f.ame]);
 const residualPoint={...p,valueObj:residual,dependencyValue:residual,panel:'residual',unit:'keV',y:10,e:residual.e};
 const button={},context={root:{querySelector:()=>button},plotDomain:{x0:60,x1:70,y0:0,y1:2},residualDomain:null,
  plotPts:[p],modPts:[],residualPts:[residualPoint],pq:{value:'dme'},PQ:f.PQ,pchain:{value:'Z'},
  MOD:{},MM,inputTable:f.context.inputTable,measured:{hash:()=>''},seriesMeta:()=>({shape:'diamond'}),
  pointColor:()=> 'magenta',chainInput:()=>({checked:false}),X:{csv:(...args)=>saved.push(args)}};
 const a=source.indexOf('  root.querySelector("[data-nc=pcsv]").onclick'),b=source.indexOf('\n\n  /* ---------- events',a);
 vm.runInNewContext(source.slice(a,b),context);button.onclick();
 const [head,rows]=saved[0],i=head.indexOf('input_provenance');
 assert.ok(rows.every(row=>row.length===head.length));
 assert.equal(JSON.parse(rows[0][i])[0].id,'loaded:50-66-0:test');
 assert.deepEqual(JSON.parse(rows[1][i]).map(x=>x.id).sort(),['AME2020:50066','loaded:50-66-0:test']);
 assert.equal(rows[0][head.indexOf('uncertainty')],'');
});
test('chart parity filters and their legend share translated labels',()=>{
 const labels={fl_ee:'偶 Z · 偶 N',fl_eo:'偶 Z · 奇 N',fl_oe:'奇 Z · 偶 N',fl_oo:'奇 Z · 奇 N'};
 const legend={},context={mode:'eo',MODES:{eo:{}},legend,T:labels,escape:s=>s};
 vm.runInNewContext(slice('  function drawLegend()','\n  /* ---------- drawing')+'\ndrawLegend();',context);
 for(const text of Object.values(labels))assert.ok(legend.innerHTML.includes(text));
 assert.equal(/\beven\b|\bodd\b/.test(legend.innerHTML),false);
});
