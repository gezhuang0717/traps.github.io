'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../static/js/mathieu-core.js');
// SciPy1.10.1 mathieu_a/b, offline 2026-10-24. DLMF28.2/28.17.
const refs=[
[0,0,1,4,1,4,9],
[.5,-.1217655449410827,1.4667668425160558,4.10090059556048,.4706543549338391,3.979189215751357,9.013719838920395],
[1,-.45513860410741364,1.8591080725143634,4.371300982735086,-.11024881699209521,3.917024772998471,9.047739259809374],
[5,-5.800046020851508,1.8581875415477507,7.449109739529177,-5.790080598637771,2.0994604454866654,9.2363277136937],
[10,-13.936979956658925,-2.3991424000362636,7.717369849779623,-13.936552479250087,-2.3821582359569553,7.98606914468166]
];
test('characteristic values agree with independent SciPy across low and high q',()=>{
 refs.forEach(([q,...vs])=>vs.forEach((v,i)=>assert.ok(Math.abs(M.characteristic(i<3?'a':'b',i<3?i:i-2,q)-v)<1e-10)));
});
test('Hill matrix dimensions converge for all exposed bands and q=12',()=>{
 for(const q of [0,.5,1,5,10,12])for(const kind of ['a','b'])for(let n=kind==='a'?0:1;n<=12;n++)assert.ok(Math.abs(M.characteristic(kind,n,q,24)-M.characteristic(kind,n,q,32))<1e-10);
});
test('higher stable bands survive instead of a first-region shortcut',()=>{
 const bs=M.bands(5);assert.equal(M.plane((bs[1].lo+bs[1].hi)/2,5).band,1);assert.equal(M.plane((bs[2].lo+bs[2].hi)/2,5).status,'stable');
 assert.equal(M.plane((bs[0].hi+bs[1].lo)/2,5).status,'unstable');
});
test('linear and 3D axis mappings are different and explicit',()=>{
 const l=M.classify(-.2,.7,'linear'),p=M.classify(-.2,.7,'paul3d');
 assert.equal(l.second.a,.2);assert.equal(l.second.q,-.7);assert.equal(p.second.a,.1);assert.equal(p.second.q,-.35);
 assert.equal(M.classify(0,.4).status,'stable');
});
test('boundaries, q=0 analytical exception and truncated coverage are honest',()=>{
 assert.equal(M.plane(M.characteristic('a',0,.5),.5).status,'boundary');
 assert.equal(M.plane(4,0).status,'stable');assert.equal(M.plane(0,0).status,'boundary');assert.equal(M.plane(-1,0).status,'unstable');assert.equal(M.plane(99,.5).status,'outside');assert.equal(M.plane(0,13).status,'outside');
});
test('RFQ units preserve fractional mass and frequency and signed DC',()=>{
 const p=M.parameters(100,1,3,122,10,1.3);assert.ok(Math.abs(p.a-.0034707720916814996)<1e-14);assert.ok(Math.abs(p.q-.0705723658641905)<1e-14);
 const f=M.parameters(100.5,2,-3,122,10,1.3005);assert.ok(f.a<0&&f.q>0);assert.notEqual(f.q,2*p.q);assert.throws(()=>M.parameters(100,1.2,0,100,10,1));
});
test('independent Floquet converges and does not classify numerical boundaries as ordinary stable',()=>{
 const d=M.diagnostic(0,.4);assert.equal(d.status,'stable');assert.ok(Math.abs(d.det-1)<1e-8&&d.trace_delta<1e-6);
 assert.equal(M.diagnostic(M.characteristic('b',1,.5),.5).status,'boundary');
});
test('invalid mode/count/domain inputs fail closed',()=>{
 assert.throws(()=>M.bands(.5,2.5));assert.throws(()=>M.characteristic('b',0,.5));assert.throws(()=>M.characteristic('a',1,13));assert.throws(()=>M.monodromy(0,.5,1));assert.throws(()=>M.classify(0,.4,'madeup'));
});
test('six locale key sets match and old RFQ controls stay isolated',()=>{
 const W=path.resolve(__dirname,'..'),labels=JSON.parse(fs.readFileSync(path.join(W,'data/mathieu_labels.json'),'utf8'));
 assert.deepEqual(Object.keys(labels).sort(),['de','en','fi','fr','ja','zh']);for(const d of Object.values(labels)){assert.deepEqual(Object.keys(d).sort(),Object.keys(labels.en).sort());assert.ok(Object.values(d).every(x=>typeof x==='string'&&x.length));}
 const games=fs.readFileSync(path.join(W,'layouts/_shortcodes/games.html'),'utf8'),js=fs.readFileSync(path.join(W,'static/js/games.js'),'utf8');assert.equal((games.match(/zg\/rfq-mathieu.html/g)||[]).length,1);assert.match(js,/const box = container.querySelector\(':scope > \[data-local-panel="classic"\]'/);
});
