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
