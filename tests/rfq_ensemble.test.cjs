const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../static/js/rfq-ensemble-core.js');
const root=path.resolve(__dirname,'..');
const base={a:0,q:.3,r0_mm:5,f_MHz:2,count:8,cycles:10,steps:32,seed:20261128,
 sigma_position_mm:.4,sigma_velocity_mm_us:.005,mean_vz_mm_us:.08,
 sigma_vz_mm_us:.004};
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
test('the ideal many-ion trajectories are deterministic for a fixed seed',()=>{
 const a=E.generate(base),b=E.generate(base),c=E.generate({...base,seed:17});
 assert.equal(a.schema,'rfq-ideal-ensemble-v1');assert.deepEqual(a,b);
 assert.notDeepEqual(a.ions[0].initial,c.ions[0].initial);
 assert.equal(a.ions.length,base.count);
 assert.equal(a.survived+a.losses.length,a.count);
 assert.ok(a.assumptions.some(x=>/space charge/i.test(x)));
 assert.match(a.uncertainty_model,/NOT|not|hardware/i);
});
test('each ion is driven by physical time and exact free axial drift',()=>{
 const model=E.generate(base);
 for(const ion of model.ions)for(const row of ion.samples){
  close(row.time_us,row.cycle/base.f_MHz);
  close(row.z_mm,ion.initial.z+ion.initial.vz*row.time_us);
  close(row.r_mm,Math.hypot(row.x_mm,row.y_mm));
 }
});
test('no RF, no transverse velocity, ions remain at their initial transverse positions',()=>{
 const x=E.generate({...base,q:0,sigma_velocity_mm_us:0});
 assert.equal(x.survived,x.count);
 for(const ion of x.ions)for(const sample of ion.samples){
  close(sample.x_mm,ion.initial.x);close(sample.y_mm,ion.initial.y);
 }
});
test('axial speed rescales with RF period at fixed dimensionless transverse motion',()=>{
 const common={...base,sigma_velocity_mm_us:0,sigma_vz_mm_us:0};
 const a=E.generate({...common,f_MHz:2}),b=E.generate({...common,f_MHz:4});
 for(let k=0;k<a.count;k++){
  close(a.ions[k].samples.at(-1).x_mm,b.ions[k].samples.at(-1).x_mm);
  close(a.ions[k].samples.at(-1).y_mm,b.ions[k].samples.at(-1).y_mm);
  close(a.ions[k].samples.at(-1).z_mm,2*b.ions[k].samples.at(-1).z_mm);
 }
});
test('fast outward motion causes actual clipped aperture losses',()=>{
 const x=E.generate({...base,q:0,sigma_position_mm:0,
  sigma_velocity_mm_us:1.8,mean_vz_mm_us:0,sigma_vz_mm_us:0});
 assert.ok(x.losses.length>0);
 for(const ion of x.ions){
  if(!ion.alive){
   assert.equal(ion.samples.at(-1).cycle,ion.loss_cycle);
   assert.ok(ion.samples.at(-1).r_mm>=base.r0_mm);
  }
 }
});
test('invalid inputs fail instead of silently making fake physical results',()=>{
 const bad=[{count:1},{count:49},{seed:-1},{steps:48},{r0_mm:0},
  {cycles:61},{q:Infinity},{sigma_position_mm:8},
  {count:48,cycles:60,steps:128}];
 for(const item of bad)assert.throws(()=>E.generate({...base,...item}),JSON.stringify(item));
});
test('public RFQ cinema loads independent source and preserves user-reproducible exports',()=>{
 const markup=fs.readFileSync(root+'/layouts/_partials/zg/rfq-ensemble.html','utf8');
 const cinema=fs.readFileSync(root+'/layouts/_partials/zg/rfq-cinema.html','utf8');
 const rfq=fs.readFileSync(root+'/layouts/_partials/zg/rfq-mathieu.html','utf8');
 const script=fs.readFileSync(root+'/static/js/rfq-ensemble-ui.js','utf8');
 assert.match(cinema,/zg\/rfq-ensemble.html/);
 for(const key of ['data-rfq-ensemble-xy','data-rfq-ensemble-3d','data-rfq-ensemble-player',
   'data-rfq-ensemble-csv'])assert.ok(markup.includes(key),key);
 assert.ok(rfq.indexOf('rfq-ensemble-core.js')<rfq.indexOf('rfq-ensemble-ui.js'));
 assert.match(script,/ZGRFQPlayback/);
 assert.match(script,/NOT finite electrode SIMION|NOT measured|NOT native SIMION/i);
 assert.ok(script.includes('rfq-ideal-ensemble.csv'));
 assert.ok(!script.includes('https://'));
});
