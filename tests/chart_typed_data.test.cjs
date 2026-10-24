'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const TD=require('../static/js/chart-typed-data.js'),UD=require('../static/js/chart-user-data.js'),MM=require('../static/js/measured-masses.js'),P=require('../static/js/physics.js'),S=require('../static/js/mass-surface.js');
const catalog=P.catalogue(JSON.parse(fs.readFileSync('static/data/nuclear-states.json')),JSON.parse(fs.readFileSync('static/data/ame2020.json')));
const nuclei=JSON.parse(fs.readFileSync('static/data/nubase2020.json')).rows,map=new Map(nuclei.map(r=>[r[0]*1000+r[1],r]));
const base=(z,n)=>{const r=map.get(z*1000+n);return r&&r[3]!=null?P.primitive('AME2020:'+(z*1000+n),r[3],r[4],!!r[5]):null;};
const parsed=UD.parse('50,50,8'),opts={valueColumn:'value1',quantity:'custom',unit:'custom',customUnit:'counts',label:'Own input',reference:'doi:test'};
const typed=(quantity,unit,extra={})=>TD.adapt(parsed,{...opts,quantity,unit,...extra});
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('headerless 50,50,8 defaults to custom values, never mass inference',()=>{
 const t=TD.adapt(parsed,opts);assert.equal(t.quantity,'custom');assert.equal(t.rows[0].Z,50);assert.equal(t.rows[0].N,50);assert.equal(t.rows[0].value,8);assert.equal(t.rows[0].sigma,null);assert.equal(t.massAdoptable,false);assert.equal(t.unit,'counts');assert.throws(()=>TD.massRows(t),/mass_quantity/);
 assert.throws(()=>TD.adapt(parsed,{...opts,customUnit:''}),/unit/);
});
test('BEA 8 MeV/nucleon, total BE 8 MeV and ME 8 keV remain different physical inputs',()=>{
 const bea=typed('bea','MeV/nucleon'),be=typed('be','MeV'),me=typed('me','keV');
 assert.equal(bea.rows[0].value,8);assert.equal(be.rows[0].value,8);assert.equal(me.rows[0].value,.008);
 const b=MM.normalize(TD.massRows(bea)[0],0,catalog),total=MM.normalize(TD.massRows(be)[0],0,catalog),m=MM.normalize(TD.massRows(me)[0],0,catalog);
 near(total.me-b.me,792000);assert.equal(m.me,8);assert.equal(b.e,null);
 const table=MM.build(TD.massRows(bea),catalog),surface=S.create(s=>s==='hybrid'?MM.getter(table,base):base,{MEH:base(1,0),MEn:base(0,1),MEa:base(2,2)});
 near(surface.derive(50,50,'hybrid').BEA.v/1000,8);near(surface.derive(50,50,'hybrid').BE.v/1000,800);assert.equal(surface.derive(50,50,'hybrid').sn.e,null);
});
test('reported sigma scales with units, while unknown and a reported zero stay distinct',()=>{
 const p=UD.parse('Z,N,value,sigma\n50,50,8,2\n50,52,9,\n50,54,10,0');
 const t=TD.adapt(p,{...opts,quantity:'me',unit:'keV',valueColumn:'value',sigmaColumn:'sigma'});
 assert.deepEqual(t.rows.map(r=>r.sigma),[.002,null,0]);assert.deepEqual(t.rows.map(r=>r.uncertainty_status),['reported','unknown','reported']);
 const r=TD.massRows(t).map((r,i)=>MM.normalize(r,i,catalog));assert.deepEqual(r.map(r=>r.e),[2,null,0]);
 const b=TD.adapt(p,{...opts,quantity:'bea',unit:'keV/nucleon',valueColumn:'value',sigmaColumn:'sigma'});near(MM.normalize(TD.massRows(b)[0],0,catalog).e,200);
});
test('ordinary mass-table invalid sigma contract remains strict',()=>{
 for(const sigma of ['',null,0,-1,'NaN','Infinity'])assert.throws(()=>MM.normalize({Z:50,N:50,value:8,uncertainty:sigma,unit:'keV',quantity:'me'},0,catalog),/sigma/);
 assert.doesNotThrow(()=>MM.normalize({Z:50,N:50,value:8,uncertainty:2,uncertainty_status:'unknown',unit:'keV',quantity:'me'},0,catalog),'known nonblank sigma remains valid');
});
test('compatible spectroscopy units convert with identical scaling for value and sigma',()=>{
 const p=UD.parse('Z,N,value,sigma\n50,50,200,5'),o={...opts,valueColumn:'value',sigmaColumn:'sigma'};
 for(const [q,u,v,s]of [['rms','fm',200,5],['qmom','fm²',2,.05],['e2p','MeV',200000,5000],['be2','e²fm⁴',.02,.0005],['atomic','µu',.0002,.000005]]){const t=TD.adapt(p,{...o,quantity:q,unit:u});near(t.rows[0].value,v);near(t.rows[0].sigma,s);}
});
test('unit mismatches and using the same value/sigma column are rejected',()=>{
 for(const [q,u]of [['bea','MeV'],['be','MeV/nucleon'],['me','fm'],['rms','MeV'],['be2','b'],['atomic','keV']])assert.throws(()=>typed(q,u),/unit/);
 assert.throws(()=>typed('me','keV',{sigmaColumn:'value1'}),/column/);
});
test('negative sigma rows are rejected without creating zero uncertainty',()=>{
 const p=UD.parse('Z,N,value,sigma\n50,50,8,-1\n50,52,8,0');
 const t=TD.adapt(p,{...opts,quantity:'me',unit:'keV',valueColumn:'value',sigmaColumn:'sigma'});assert.equal(t.rows.length,1);assert.equal(t.errors[0].code,'sigma');assert.equal(t.rows[0].sigma,0);
});
test('all 38 mass-surface quantities can be direct inputs; only four mass types are adoptable',()=>{
 for(const key of S.quantities){const q=key==='BE'?'be':key==='BEA'?'bea':key;assert.ok(TD.specs[q],q);assert.equal(typed(q,q==='bea'?'MeV/nucleon':'MeV').massAdoptable,['me','be','bea'].includes(q),q);}
 for(const q of ['sn','rms','mu','qmom','e2p','be2','beta2'])assert.throws(()=>TD.massRows(typed(q,TD.units(q)[0])),/mass_quantity/);
});
test('weighted duplicates with unknown or zero sigma do not invent weights or an active mass',()=>{
 for(const sigma of [null,0]){
  const row=TD.massRows(typed('me','keV'))[0];row.uncertainty=sigma;row.uncertainty_status=sigma===null?'unknown':'reported';
  const table=MM.build([row,{...row,value:10}],catalog,'weighted');assert.equal(table.valid.length,2);assert.equal(table.active.size,0);assert.equal(table.errors.length,2);assert.ok(table.errors.every(e=>e.code==='weighted_sigma'));
  assert.equal(MM.build([row,{...row,value:10}],catalog,'last').active.get('50-50-0').me,10);
 }
});
test('mass CSV/JSON preserve original quantity, units, unknown sigma, label and reference',()=>{
 const original=TD.massRows(typed('bea','MeV/nucleon'));
 for(const restored of [MM.parse(MM.csv(original)),MM.parse(JSON.stringify({schema:1,rows:original}))]){
  const table=MM.build(restored,catalog),entry=table.active.get('50-50-0'),raw=table.raw[0];assert.equal(raw.quantity,'bea');assert.equal(raw.unit,'MeV/nucleon');assert.equal(Number(raw.value),8);assert.equal(raw.uncertainty_status,'unknown');assert.equal(entry.e,null);assert.equal(raw.label,'Own input');assert.equal(raw.reference,'doi:test');
  const prov=MM.provenance(entry.value,table)[0].inputs[0];assert.equal(prov.unit,'MeV/nucleon');assert.equal(prov.quantity,'bea');assert.equal(prov.input_origin,'typed-chart');
 }
});
test('portable input settings reproduce the exact typed observable and selected series',()=>{
 const o={...opts,quantity:'bea',unit:'MeV/nucleon'},original=TD.adapt(parsed,o),saved=TD.portable('50,50,8',o,{ame:true,mine:true,'model:frdm2012':false});
 const restored=TD.restore(JSON.stringify(saved));assert.deepEqual(TD.adapt(UD.parse(restored.text),restored.options),original);assert.deepEqual(restored.series,saved.series);
 assert.throws(()=>TD.restore(JSON.stringify({...saved,schema:'other'})),/settings/);assert.throws(()=>TD.restore(JSON.stringify({...saved,series:{ame:'true'}})),/settings/);
});
