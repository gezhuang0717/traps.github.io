'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../static/js/physics.js'),S=require('../static/js/mass-surface.js'),CP=require('../static/js/chain-plot.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const constant={MEn:P.constant(8071),MEH:P.constant(7289),MEa:P.constant(2425)};
const surface=(B,missing=()=>false,sigma=1,estimated=()=>false)=>S.create(()=> (z,n)=>missing(z,n)?null:P.primitive(`AME2020:${z*1000+n}`,z*7289+n*8071-B(z,n),sigma,estimated(z,n)),constant);
test('additional filters use forward slope signs and the R executable half-normalized Gsym',()=>{
 const b=(z,n)=>3*z*n+2*n*n+5*z*z+n*n*n/1000;
 const s=surface(b),z=50,n=66,d=s.derive(z,n);
 const sn=(z,n)=>b(z,n)-b(z,n-1),s2n=(z,n)=>b(z,n)-b(z,n-2);
 const sp=(z,n)=>b(z,n)-b(z-1,n),s2p=(z,n)=>b(z,n)-b(z-2,n);
 const gap=n=>s2n(z,n)-s2n(z,n+2);
 const expected={D1nS1n:sn(z,n)-sn(z,n+1),D1pS1p:sp(z,n)-sp(z+1,n),D1nS2n:s2n(z,n+1)-s2n(z,n),D1pS2p:s2p(z+1,n)-s2p(z,n),D2pS2n:(s2n(z,n)-s2n(z-2,n))/4,D1pS1n:sn(z,n)-sn(z-1,n),D1pS2n:(s2n(z,n)-s2n(z-1,n))/2,D2pS1n:(sn(z,n)-sn(z-2,n))/2,Gplus:gap(n)-gap(n+2),Gsym:(2*gap(n)-gap(n-2)-gap(n+2))/2};
 assert.equal(S.quantities.length,28);assert.deepEqual(Object.keys(expected),Object.keys(S.filters));
 for(const [k,v]of Object.entries(expected))near(d[k].v,v);
 near(surface((z,n)=>n**3).derive(z,n).Gplus.v,48);
 near(surface((z,n)=>n**4).derive(z,n).Gsym.v,192);
});
test('every nonzero neighbour is required; missing unused sites do not create false gaps',()=>{
 for(const [k,f]of Object.entries(S.filters)){
  for(const [dz,dn]of f.terms)assert.equal(surface((z,n)=>z*n,(z,n)=>z===50+dz&&n===66+dn).derive(50,66)[k],null,k);
  assert.ok(surface((z,n)=>z*n,(z,n)=>z===54&&n===71).derive(50,66)[k]);
 }
});
test('new filters propagate exact independent mass weights, unknown sigma and # provenance',()=>{
 for(const [k,f]of Object.entries(S.filters)){
  const d=surface((z,n)=>z*n).derive(50,66)[k];near(d.e,Math.sqrt(f.terms.reduce((s,[,,c])=>s+c*c,0)));
  assert.equal(surface((z,n)=>z*n,()=>false,null).derive(50,66)[k].e,null);
  const [dz,dn]=f.terms[0],v=surface((z,n)=>z*n,()=>false,1,(z,n)=>z===50+dz&&n===66+dn).derive(50,66)[k];
  assert.equal(v.est,true);assert.equal(CP.experimentalFilter({mode:'measured',centre:d,reference:v,value:d,mass:d}),false);
 }
});
test('a single 116Sn +10 keV mass changes exactly the inverse nonzero stencil, including N±4',()=>{
 const base=(z,n)=>P.primitive(`AME2020:${z*1000+n}`,100+z*z+n*n,2);
 const fresh=P.primitive('loaded:50-66-0',base(50,66).v+10,3);
 const s=S.create(source=>(z,n)=>source==='hybrid'&&z===50&&n===66?fresh:base(z,n),constant);
 const centres=[];for(let z=47;z<=53;z++)for(let n=61;n<=71;n++)centres.push([z,n,'X']);
 const active=new Map([['50-66-0',{state:{Z:50,N:66,source_state_index:0}}]]);
 const affected=x=>Object.keys(x?.terms||{}).includes('loaded:50-66-0');
 const changes=S.changes(centres,active,s.derive,affected);
 for(const [k,f]of Object.entries(S.filters)){
  const got=changes.filter(x=>x.quantity===k);assert.equal(got.length,f.terms.length,k);
  for(const [dz,dn,c]of f.terms){const x=got.find(x=>x.r[0]===50-dz&&x.r[1]===66-dn);assert.ok(x,k);near(x.delta.v,10*c);near(x.delta.e,Math.abs(c)*Math.sqrt(13));}
 }
 const gs=changes.find(x=>x.quantity==='Gsym'&&x.r[0]===50&&x.r[1]===66);near(gs.delta.v,-30);
 assert.ok(changes.some(x=>x.quantity==='Gsym'&&x.r[1]===70));
});
test('fixed proton-neutron filters agree at their physical parity with automatic δVpn',()=>{
 const s=surface((z,n)=>3*z*n+z*z+n*n);
 for(const [z,n,k]of [[50,66,'D2pS2n'],[51,67,'D1pS1n'],[51,66,'D1pS2n'],[50,67,'D2pS1n']]){
  const d=s.derive(z,n);near(d[k].v,d.vpn.v);near(d[k].e,d.vpn.e);
 }
});
