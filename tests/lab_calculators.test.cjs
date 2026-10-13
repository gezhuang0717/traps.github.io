const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../static/js/lab-calculators.js');
test('blank, nonfinite and unphysical calculator inputs cannot produce a result',()=>{
 for(const bad of ['', ' ',null,undefined,NaN,Infinity,true])assert.throws(()=>L.number(bad));
 for(const q of [0,-1,1.1,101,''])assert.throws(()=>L.cyclotron(133,q,7));
 for(const args of [[0,1,7],[133,1,0],[.0001,1,7]])assert.throws(()=>L.cyclotron(...args));
 assert.throws(()=>L.resolving('',133));assert.throws(()=>L.convert('', 'u', ''));
 assert.throws(()=>L.convert(133,'u',132.5));assert.throws(()=>L.convert(133,'unknown',''));
});
test('cyclotron calculator respects field scaling and resolves fine B entry',()=>{
 const a=L.cyclotron('132.905451961','1','7.0000000000'),b=L.cyclotron(132.905451961,1,'7.0000000001');
 // Independent Python Decimal evaluation, 50 digits, with the stated CODATA constants.
 assert.ok(Math.abs(a.Hz-808795.011361913067244180406794908706)<1e-6);
 assert.ok(b.Hz>a.Hz);assert.ok(Math.abs(b.Hz/a.Hz-7.0000000001/7)<1e-15);
 assert.equal(L.cyclotron(132.905451961,1,14).Hz,2*a.Hz);
});
test('mass conversion and ME are invariant to input unit, with optional integer A',()=>{
 const m=115.9017428,a=L.convert(m,'u',116);
 for(const unit of ['keV','MeV','kg']){
   const b=L.convert(a[unit],unit,'116');assert.ok(Math.abs(a.ME-b.ME)<1e-7);assert.ok(Math.abs(a.u-b.u)<1e-12);
 }
 assert.equal(L.convert(0,'keV','').ME,null);assert.equal(L.convert(12,'u',12).ME,0);
 assert.equal(L.resolving(12,12).R,null);
 assert.equal(L.resolving(10,11).R,10.5);
});
