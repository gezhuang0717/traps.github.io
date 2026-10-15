'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../static/js/physics.js'),S=require('../static/js/mass-surface.js'),E=require('../static/js/ame-evaluated.js');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const ame=JSON.parse(fs.readFileSync('static/data/ame2020.json','utf8'));
const masses=new Map(ame.rows.map(r=>[`${r[0]},${r[1]-r[0]}`,P.primitive(`AME2020:${r[0]*1000+r[1]-r[0]}`,r[3],r[4],!!r[5],!!r[6])]));
const get=(z,n)=>masses.get(`${z},${n}`)||null;
const constants={MEn:get(0,1),MEH:get(1,0),MEa:get(2,2),MEd:get(1,1)};
const data=()=>E.fromData(JSON.parse(fs.readFileSync('static/data/ame2020-reactions.json','utf8')));
test('155Eu default AME beta energy uses evaluated covariance uncertainty, not independent mass errors',()=>{
 const published=data(),raw=S.create(()=>get,constants).derive(63,92).qbm;
 const d=S.create(()=>get,constants,()=>null,published.get).derive(63,92);
 near(raw.e,Math.hypot(1.252,.983));near(d.qbm.v,251.9612);near(d.qbm.e,.8682);
 assert.equal(d.qbm.published,true);assert.match(d.qbm.uncertainty_model,/evaluated/);
 // The same unedited masses in a user/model surface remain explicitly
 // recalculated, rather than inheriting an evaluated AME uncertainty.
 const model=S.create(()=>get,constants,()=>null,published.get).derive(63,92,'model');
 near(model.qbm.e,raw.e);assert.equal(model.qbm.published,undefined);
});
test('published separation and double-beta energies retain source precision and uncertainty',()=>{
 const published=data(),s=S.create(()=>get,constants,()=>null,published.get);
 const sn=s.derive(50,66);near(sn.sn.v,9563.4512);near(sn.sn.e,.0948);
 near(sn.s2n.v,17108.8797);near(sn.s2n.e,.0980);
 for(const [z,n,v,e]of [[32,44,2039.0612,.0075],[20,28,4268.084,.0726],[54,82,2457.909,.2448]]){
  const d=s.derive(z,n).q2bm;near(d.v,v);near(d.e,e);
 }
 // Inverse evaluated reaction is the same random variable with opposite sign.
 const inverse=s.derive(34,42).q2ec;near(inverse.v,-2039.0612);near(inverse.e,.0075);
 const reverse=s.derive(64,91).qec;near(reverse.v,-251.9612);near(reverse.e,.8682);
});
test('positron rest-mass thresholds, missing data, and extrapolation flags remain distinct',()=>{
 const lookup=(z,n)=>z>=0&&n>=0?P.primitive(`AME2020:${z*1000+n}`,z*2000+n*100,2):null;
 const d=S.create(()=>lookup,constants).derive(50,66);
 near(d.qecbp.v,d.q2ec.v-2*P.C.electronU*P.C.uKeV);
 near(d.q2bp.v,d.q2ec.v-4*P.C.electronU*P.C.uKeV);
 assert.equal(S.create(()=>()=>null,constants).derive(1,0).q2bm,null);
 const t={value:10,uncertainty:3,value_extrapolated:true,uncertainty_extrapolated:false};
 const value=E.apply(P.primitive('AME2020:1',9,4),t);assert.equal(value.est,true);assert.equal(value.sigmaEst,false);
 near(P.combine([1,value]).v,10);assert.equal(E.apply(value,{value:null}),null);
});
test('new masses affect inverse reaction stencils as far as the four-beta daughter',()=>{
 const fresh=P.primitive('loaded:50-66-0',get(50,66).v+10,.1);
 const s=S.create(source=>(z,n)=>source==='hybrid'&&z===50&&n===66?fresh:get(z,n),constants);
 near(s.derive(50,66,'hybrid').q2bm.v-s.derive(50,66).q2bm.v,10);
 near(s.derive(48,68,'hybrid').q2bm.v-s.derive(48,68).q2bm.v,-10);
 const centres=[[46,70,'Pd']];
 const active=new Map([['x',{state:{Z:50,N:66,source_state_index:0}}]]);
 const changed=S.changes(centres,active,s.derive,x=>!!x?.terms?.['loaded:50-66-0']);
 assert.ok(changed.some(x=>x.quantity==='q4bm'&&Math.abs(x.delta.v+10)<1e-7));
});
