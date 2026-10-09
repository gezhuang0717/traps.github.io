const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../static/js/chain-plot.js');
test('full chain retains nuclei with unavailable derived quantities and model-only endpoints',()=>{
 const e=C.chainExtent([{x:52,y:10,e:.2}],[{x:30,y:80},{x:100,y:-30}],{xMode:'full',fullX:[28,52,100,102],yMode:'data'});
 assert.deepEqual([e.x0,e.x1],[27,103]);assert.ok(e.y0<9.8&&e.y1>10.2&&e.y1<11);
});
test('manual domain validation never propagates NaNs or reversed axes',()=>{
 const e=C.chainExtent([{x:50,y:5}],[],{xMode:'manual',yMode:'manual',manual:{x0:10,x1:20,y0:9,y1:1}});
 assert.deepEqual([e.x0,e.x1],[10,20]);assert.deepEqual(e.warnings,['y']);assert.ok(e.y1>e.y0);
});
test('model-expanded axis and both screen dimensions select the actual drawn point',()=>{
 const points=[{x:50,y:5,g:50},{x:50,y:7,g:51},{x:52,y:6,g:50}];
 const e=C.chainExtent(points,[{x:10,y:5},{x:100,y:6}]);const g=C.geometry(e,960,480,true);
 assert.equal(C.nearest(points,g.px(50)+1,g.py(7)+1,g),points[1]);
 assert.equal(C.nearest(points,0,0,g),null);
 const scaled=C.geometry(e,5760,2880,true,6);
 assert.ok(Math.abs(scaled.px(50)/6-g.px(50))<1e-12);
});
test('missing neighbours make gaps, with two-step connection only explicit',()=>{
 assert.equal(C.connects({g:50,x:50},{g:50,x:52}),false);
 assert.equal(C.connects({g:50,x:50},{g:50,x:51}),true);
 assert.equal(C.connects({g:50,x:50},{g:51,x:51}),false);
 assert.equal(C.connects({g:50,x:50},{g:50,x:52},2),true);
});
test('isotope ranges never become isotone or isobar ranges',()=>{
 const memory={Z:{c0:'40',c1:'50',x0:'',x1:''}};
 assert.equal(C.rangeFor(memory,'Z',50).c0,'40');
 assert.deepEqual(C.rangeFor(memory,'N',50),{c0:'50',c1:'50',x0:'',x1:''});
 assert.equal(C.rangeFor(memory,'A',100).c0,'100');
});
test('plot navigation preserves the cursor anchor and translates both axes reversibly',()=>{
 const d={x0:10,x1:30,y0:-20,y1:80},z=C.zoomExtent(d,.5,.25,.75);
 assert.deepEqual([z.x0,z.x1,z.y0,z.y1],[12.5,22.5,17.5,67.5]);
 assert.deepEqual(C.panExtent(C.panExtent(d,4,-7),-4,7),d);
 assert.deepEqual(C.zoomExtent(z,2,.25,.75),d);
 assert.deepEqual(C.zoomExtent(d,NaN),d);
});
test('full nuclear chart fits every actual model endpoint, including extended HFB and KTUY coverage',()=>{
 const index=require('../static/data/massmodels-index.json');
 for(const [key,meta] of Object.entries(index.models)){
  const rows=require('../static/data/'+meta.data_url).rows;
  for(const [width,height] of [[960,600],[390,244]]){
   const v=C.chartFit(rows,width,height);
   assert.ok(Number.isFinite(v.s)&&v.s>0,key);
   for(const [z,n] of rows){
    const x=v.x+n*v.s,y=height-v.y-(z+1)*v.s;
    assert.ok(x>=0&&x+v.s<=width+1e-9&&y>=0&&y+v.s<=height+1e-9,key+': '+z+','+n);
   }
  }
 }
});

test('model export retains missing deformation and every model-only chart nucleus',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('static/js/nuclide-chart.js','utf8');
 // Execute the actual chart CSV builder/handler with an in-memory export sink.
 // This verifies content only; it never invokes a browser or file download.
 const start=source.indexOf('  const csvRow ='),end=source.indexOf('  root.querySelector("[name=nc-line-width]")',start);
 const exportLine=source.split('\n').find(line=>line.includes('root.querySelector("[data-nc=csv]").onclick'));
 assert.ok(start>0&&end>start&&exportLine);
 const reference=[50,66,'Sn',-91525.979,null,0,0,'','','','',[]];
 const modelOnly=Object.assign([130,200,'Z130',null,null,0,0,'','','','',[]],{mo:true});
 const button={},saved=[];
 const values=new Map([[50066,[-91210,null]],[130200,[315130,null]]]);
 const context={src:'ktuy05',MOD:{ktuy05:{map:values}},key:(z,n)=>z*1000+n,
  derived:r=>r[3]==null?{}:{me:{v:r[3],e:r[4]}},rows:[reference],allRows:()=>[reference,modelOnly],pass:()=>true,filt:'all',
  root:{querySelector:()=>button},X:{csv:(...args)=>saved.push(args)}};
 vm.runInNewContext(source.slice(start,end)+'\n'+exportLine,context);
 button.onclick();
 const [head,rows]=saved[0],b=head.indexOf('beta2_ktuy05'),m=head.indexOf('ME_keV_ktuy05');
 assert.equal(rows.length,2);assert.equal(rows[0][b],'');assert.equal(rows[1][b],'');
 assert.equal(rows[0][m],-91210);assert.equal(rows[1][m],315130);assert.equal(rows[1][4],'');
 assert.ok(rows.every(row=>row.length===head.length));
 values.set(50066,[-91210,0]);button.onclick();assert.equal(saved[1][1][0][b],0);
 values.set(50066,[-91210,-120]);button.onclick();assert.equal(saved[2][1][0][b],-.12);
});

test('finite mass-table cutoffs never become drip lines; missing neighbours leave gaps',()=>{
 const boundary=require('../static/js/mass-surface.js').dripBoundary;
 assert.equal(boundary([[10,2],[11,.5]]),null);
 assert.equal(boundary([[10,2],[11,.5],[12,-.1]]),11);
 assert.equal(boundary([[10,2],[11,.5],[12,0]]),11);
 assert.equal(boundary([[10,2],[11,.5],[12,null],[13,-.1]]),null);
 assert.equal(boundary([[10,2],[11,.5],[13,-.1]]),null);
 assert.equal(boundary([[10,-1],[11,2],[12,-1],[13,1],[14,-1]]),13);
 assert.equal(boundary([[10,-2],[11,-1]]),null);
 const rows=require('../static/data/massmodels/ktuy05.json').rows,map=new Map(rows.map(([z,n,me])=>[z*1000+n,me]));
 for(const[q,dz,dn,c,count]of [['sn',0,1,8071.3181,80],['s2n',0,2,16142.6362,85],['sp',1,0,7288.971064,189],['s2p',2,0,14577.942128,192]]){
  const groups=new Map();for(const[z,n,me]of rows){const prev=map.get((z-dz)*1000+n-dn),v=prev==null?null:prev+c-me,i=dn?z:n,j=dn?n:z;if(!groups.has(i))groups.set(i,[]);groups.get(i).push([j,v]);}
  assert.equal([...groups.values()].filter(g=>boundary(g)!=null).length,count,q);
  if(dn)assert.equal(boundary(groups.get(130)),null,q+' at positive N=200 cutoff');
 }
});
