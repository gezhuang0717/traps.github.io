const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../static/js/physics.js'),MM=require('../static/js/measured-masses.js'),S=require('../static/js/mass-surface.js');
const data=JSON.parse(fs.readFileSync('static/data/nuclear-states.json')),ame=JSON.parse(fs.readFileSync('static/data/ame2020.json'));
const catalog=P.catalogue(data,ame),rows=JSON.parse(fs.readFileSync('static/data/nubase2020.json')).rows;
const map=new Map(rows.map(r=>[r[0]*1000+r[1],r]));
const base=(z,n)=>{const r=map.get(z*1000+n);return r&&r[3]!=null?P.primitive('AME2020:'+(z*1000+n),r[3],r[4],!!r[5],!!r[13]):null;};
const constants={MEn:base(0,1),MEH:base(1,0),MEa:base(2,2)};
const surface=table=>S.create(s=>s==='hybrid'?MM.getter(table,base):base,constants);
const row=(nuclide,value,sigma=1,extra={})=>({nuclide,value,uncertainty:sigma,unit:'keV',quantity:'me',...extra});
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('state names, no unknown-state or ground-state fallback, Z/N identity',()=>{
 for(const name of ['116mSn','94Agm','151Ybm'])assert.equal(MM.normalize(row(name,1),0,catalog).state.source_state_index,1);
 assert.equal(MM.normalize(row('116Sn',1),0,catalog).state.source_state_index,0);
 assert.equal(MM.normalize({...row('',1),Z:50,N:66,state:'m'},0,catalog).state.source_state_index,1);
 for(const name of ['999Sn','116Sn[m9]','116Sn[foo]','mystery'])assert.throws(()=>MM.normalize(row(name,1),0,catalog));
 assert.throws(()=>MM.normalize({...row('116Sn',1),Z:49,N:67},0,catalog));
 for(const r of [{...row('116mSn',1),state:'g'},{...row('116Sn[g]',1),state:'m'}])assert.throws(()=>MM.normalize(r,0,catalog));
 assert.equal(MM.normalize({...row('116mSn',1),state:'m1'},0,catalog).state.source_state_index,1);
});
test('atomic mass and mass-excess unit conversions, positive finite uncertainty',()=>{
 for(const [unit,factor] of [['keV',1],['MeV',1000],['u',P.C.uKeV],['µu',P.C.uKeV/1e6],['μu',P.C.uKeV/1e6]]){
  const r=MM.normalize(row('116Sn',2,3,{unit}),0,catalog);near(r.me,2*factor);near(r.e,3*factor);
 }
 const r=MM.normalize(row('116Sn',116-0.1/P.C.uKeV,1e-6,{unit:'u',quantity:'atomic'}),0,catalog);near(r.me,-.1,3e-8);near(r.e,P.C.uKeV*1e-6);
 for(const sigma of [0,-1,'',null,'NaN','Infinity'])assert.throws(()=>MM.normalize(row('116Sn',1,sigma),0,catalog));
 assert.throws(()=>MM.normalize(row('116Sn',1,1,{unit:'kg'}),0,catalog));
 assert.throws(()=>MM.normalize(row('116Sn','',1),0,catalog));
});
test('10-keV replacement propagates through neighbours with hand-computed signs',()=>{
 const table=MM.build([row('116Sn',base(50,66).v+10)],catalog),s=surface(table),a=(n,k)=>s.derive(50,n,'ame')[k],b=(n,k)=>s.derive(50,n,'hybrid')[k];
 near(b(66,'me').v-a(66,'me').v,10);near(b(66,'s2n').v-a(66,'s2n').v,-10);near(b(68,'s2n').v-a(68,'s2n').v,10);
 near(b(66,'d2n').v-a(66,'d2n').v,-20);near(b(64,'d2n').v-a(64,'d2n').v,10);
 near(b(66,'d3n').v-a(66,'d3n').v,-10);near(b(65,'d3n').v-a(65,'d3n').v,-5);
 near(b(66,'d5n').v-a(66,'d5n').v,-7.5);near(b(64,'d5n').v-a(64,'d5n').v,-1.25);
 assert.deepEqual(b(70,'s2n'),a(70,'s2n'));assert.equal(MM.affected(b(68,'s2n')),true);assert.equal(MM.affected(b(70,'s2n')),false);
 const residual=P.combine([1,b(68,'s2n')],[-1,a(68,'s2n')]);near(residual.e,Math.hypot(1,base(50,66).e));
 assert.ok(MM.provenance(b(68,'s2n'),table).some(x=>x.rows[0]===1));
});
test('isomer changes excitation only; every ground-state output stays identical',()=>{
 const table=MM.build([row('116mSn',base(50,66).v+1000)],catalog),s=surface(table);
 for(const n of [64,65,66,67,68])for(const k of ['me','BE','BEA','sn','s2n','qbm','vpn','wig','d3n','d5n'])assert.deepEqual(s.derive(50,n,'ame')[k],s.derive(50,n,'hybrid')[k]);
 const ex=P.combine([1,table.active.get('50-66-1').value],[-1,MM.getter(table,base)(50,66)]);near(ex.v,1000);
});
test('duplicates, weighted mean, Birge inflation, mixtures and use flags',()=>{
 const input=[row('116Sn',100,2),row('116Sn',104,2),row('116Sn',500,1,{use:false})];
 const last=MM.build(input,catalog);near(last.active.get('50-66-0').me,104);assert.equal(last.duplicates.length,1);assert.deepEqual(last.active.get('50-66-0').rows,[2]);
 const w=MM.build(input,catalog,'weighted').active.get('50-66-0');near(w.me,102);near(w.inner,Math.SQRT2);near(w.birge,Math.SQRT2);near(w.e,2);assert.deepEqual(w.rows,[1,2]);
 assert.equal(MM.build([row('116Sn',1,1,{mixture:true})],catalog).active.size,0);
 assert.equal(MM.build([row('116Sn',1,1,{mixture:true,use:true})],catalog).active.size,1);
});
test('CSV/TSV/JSON import, multiline quoting, Unicode references and round-trip',()=>{
 const input=[row('116Sn',-91500,1,{use:true,reference:'doi,"quoted"\nline 中文'})];
 const imported=MM.parse(MM.csv(input));assert.equal(imported[0].reference,input[0].reference);
 near(MM.build(imported,catalog).active.get('50-66-0').me,-91500);
 assert.equal(MM.parse('nuclide\tvalue\tsigma\n116Sn\t-91500\t1')[0].uncertainty,'1');
 assert.equal(MM.parse(JSON.stringify({rows:input})).length,1);
 for(const text of ['nuclide,value\n116Sn,1','nuclide,value,uncertainty\n116Sn,"1,2','{}','[null]'])assert.throws(()=>MM.parse(text));
 assert.throws(()=>MM.build(Array(2001).fill(input[0]),catalog));
 const alias={...row('116Sn',-91500),sigma:2};delete alias.uncertainty;
 const again=MM.build(MM.parse(MM.csv([alias])),catalog);assert.equal(again.active.size,1);near(again.active.get('50-66-0').e,2);
});
test('AME-only values exactly match the pre-refactor checkpoint for representative chains',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/mass-surface-regression.json')),s=surface(MM.build([],catalog));
 for(const item of fixture.values){const d=s.derive(item.Z,item.N,'ame');for(const [k,v] of Object.entries(item.quantities))assert.deepEqual(d[k]?{v:d[k].v,e:d[k].e,est:d[k].est}:null,v,`${item.Z},${item.N} ${k}`);}
});

test('case-insensitive ME, atomic mass alias and total binding energy input',()=>{
 const me=base(50,66).v,be=50*base(1,0).v+66*base(0,1).v-me;
 near(MM.normalize(row('116Sn',me,1,{quantity:'ME'}),0,catalog).me,me);
 near(MM.normalize(row('116Sn',be/1000,.001,{quantity:'BE',unit:'MeV'}),0,catalog).me,me,1e-6);
 near(MM.normalize(row('116Sn',116+me/P.C.uKeV,1e-6,{quantity:'mass',unit:'u'}),0,catalog).me,me,1e-6);
 assert.throws(()=>MM.normalize(row('116Sn',be,1,{quantity:'BE',unit:'u'}),0,catalog));
});

test('six copy-ready public example files encode the same enabled synthetic mass',()=>{
 for(const file of fs.readdirSync('static/data/examples/measured-masses').filter(f=>!f.startsWith('.'))){
  const t=MM.build(MM.parse(fs.readFileSync('static/data/examples/measured-masses/'+file,'utf8')),catalog);
  assert.equal(t.errors.length,0,file);assert.equal(t.active.size,1,file);
  const v=t.active.get('50-66-0');near(v.me,base(50,66).v+10,1e-6);near(v.e,1,1e-10);
 }
});

test('affected-quantity report includes every dependent neighbour, including Wigner N+4',()=>{
 const table=MM.build([row('116Sn',base(50,66).v+10)],catalog),s=surface(table);
 const report=S.changes(rows,table.active,s.derive,MM.affected);
 const at=(z,n,k)=>report.find(x=>x.r[0]===z&&x.r[1]===n&&x.quantity===k);
 near(at(50,66,'s2n').delta.v,-10);near(at(50,68,'s2n').delta.v,10);
 near(at(50,66,'d2n').delta.v,-20);assert.ok(at(50,70,'wig'));
 assert.equal(at(50,70,'s2n'),undefined);assert.ok(at(51,65,'qec'));
 for(const r of rows.filter(r=>Math.abs(r[0]-50)<=3&&Math.abs(r[1]-66)<=5))for(const k of S.quantities){
  const v=s.derive(r[0],r[1],'hybrid')[k];assert.equal(!!at(r[0],r[1],k),MM.affected(v));
 }
 assert.equal(S.changes(rows,MM.build([row('116mSn',-89000)],catalog).active,s.derive,MM.affected).length,0);
});
