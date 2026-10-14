const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../static/js/neutral-cooling-core.js');
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}; tol ${t}`);
const setup=overrides=>C.validate(overrides),force=(r,v,overrides)=>{const {p,derived:d}=setup(overrides);return C.force(r,v,p,d);};
test('Neutral model uses angular linewidth, SI mass/wavelength and G/cm conversion',()=>{
 const {p,derived:d}=setup({method:'mot'});near(d.mass,p.mass_u*C.C.u,1e-36);near(d.k,2*Math.PI/(p.lambda_nm*1e-9),1e-8);near(d.gamma,2*Math.PI*p.gamma_MHz*1e6,1e-8);near(d.gradient,.1,1e-15);
});
test('At zero field six Gaussian beams give zero resting force and molasses has no restoring force',()=>{
 for(const r of [[0,0,0],[.001,-.002,.003]])for(const a of force(r,[0,0,0],{method:'molasses3d'}).acc)near(a,0,1e-10);
 const {p,derived:d}=setup({method:'molasses3d'}),response=C.linearResponse(p,d);for(const spring of response.spring_s2)near(spring,0,1e-8);assert.ok(response.damping_s.every(a=>a>0));
});
test('Ideal MOT restores all axes; strong z gradient gives twice transverse stiffness',()=>{
 const {p,derived:d}=setup({method:'mot'}),response=C.linearResponse(p,d);assert.ok(response.spring_s2.every(a=>a>0));near(response.spring_s2[2]/response.spring_s2[0],2,1e-7);
 for(let j=0;j<3;j++){const r=[0,0,0];r[j]=1e-4;assert.ok(C.force(r,[0,0,0],p,d).acc[j]<0);r[j]=-r[j];assert.ok(C.force(r,[0,0,0],p,d).acc[j]>0);}
});
test('MOT zero-gradient limit equals molasses including recoil covariance',()=>{
 const r=[.001,.002,-.003],v=[.2,-.4,.6],a=force(r,v,{method:'molasses3d'}),b=force(r,v,{method:'mot',gradient_Gcm:0});assert.deepEqual(a,b);
});
test('Circular projection and beam symmetry give odd optical force under inversion',()=>{
 for(const method of ['molasses3d','mot']){const r=[.001,.0004,-.0007],v=[.3,-.1,.4],a=force(r,v,{method}),b=force(r.map(x=>-x),v.map(x=>-x),{method});for(let j=0;j<3;j++)near(a.acc[j],-b.acc[j],1e-10);near(a.total,b.total,1e-7);}
});
test('Red detuning cools, blue detuning anti-damps, laser off has no light force or recoil',()=>{
 assert.ok(force([0,0,0],[.01,0,0],{detuning:-.5}).acc[0]<0);assert.ok(force([0,0,0],[.01,0,0],{detuning:.5}).acc[0]>0);
 const f=force([.001,0,0],[1,0,0],{method:'mot',laser:false,gravity:true});assert.deepEqual(f.acc,[0,0,-C.C.g]);assert.deepEqual(f.velocityVarianceRate,[0,0,0]);assert.equal(f.total,0);
});
test('Diffusion includes absorption and isotropic emission; ideal six-beam low-saturation T approaches Doppler scale',()=>{
 const {p,derived:d}=setup({s0:1e-7}),f=C.force([0,0,0],[0,0,0],p,d),R=d.gamma*.5*p.s0/(1+6*p.s0+1);
 for(const rate of f.velocityVarianceRate)near(rate,4*R*d.vr*d.vr,1e-12);
 for(const T of C.linearResponse(p,d).temperature_K)near(T/d.dopplerT,1,1e-6);
});
test('Temperature removes drift, uses N-1, and differs from velocity of the centroid',()=>{
 const s=C.create({n:16,temperature_uK:0,sigma_mm:0,laser:false});s.velocities=Array.from({length:16},(_,i)=>[10+(i%2?1:-1),-4,2]);const d=C.diagnostics(s);near(d.velocity[0],10);near(d.axes[0],s.d.mass*16/(15*C.C.kB),1e-10);near(d.axes[1],0);near(d.axes[2],0);
});
test('One seeded recoil step has the predicted velocity variance within finite-sample uncertainty',()=>{
 const s=C.create({n:512,temperature_uK:0,sigma_mm:0,dt_us:.001,duration_ms:.01}),expected=C.force([0,0,0],[0,0,0],s.p,s.d).velocityVarianceRate,dt=C.step(s),row=C.diagnostics(s);
 for(let j=0;j<3;j++)near(row.axes[j]*C.C.kB/s.d.mass/(expected[j]*dt),1,.2);
});
test('Same seed reproduces state and stochastic steps; different seeds change samples',()=>{
 const a=C.create({n:16}),b=C.create({n:16});for(let i=0;i<10;i++){C.step(a);C.step(b);}assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.velocities,b.velocities);assert.notDeepEqual(a.initialPositions,C.create({n:16,seed:2}).initialPositions);
});
test('Laser-off drift and gravity match analytic ballistic motion without invented damping',()=>{
 const s=C.create({n:16,temperature_uK:0,sigma_mm:0,driftX:1,driftY:2,driftZ:3,laser:false,gravity:true,duration_ms:.1});while(C.step(s)){};near(s.time,.0001,1e-15);for(const r of s.positions){near(r[0],s.time,1e-13);near(r[1],2*s.time,1e-13);near(r[2],3*s.time-.5*C.C.g*s.time**2,1e-13);}near(C.diagnostics(s).axes[0],0,1e-20);
});
test('Aperture loss is distinct from numerical failure, including all-lost diagnostics',()=>{
 const s=C.create({n:16,temperature_uK:0,sigma_mm:0,driftX:1,laser:false,duration_ms:.1,aperture_mm:.01});while(C.step(s)){}const d=C.diagnostics(s);assert.equal(d.n,0);assert.equal(d.lost,16);assert.equal(d.T,null);assert.equal(s.failure,null);
});
test('Every physical numeric input rejects NaN, infinity, out of range and invalid types',()=>{
 for(const [key,[lo,hi]]of Object.entries(C.bounds))for(const value of [NaN,Infinity,lo-1,hi+1,'1',null])assert.throws(()=>setup({[key]:value}));for(const key of ['laser','recoil','gravity'])assert.throws(()=>setup({[key]:'false'}));assert.throws(()=>setup({n:16.5}));assert.throws(()=>setup({seed:1.5}));assert.throws(()=>setup({method:'gray'}));assert.throws(()=>setup(null));assert.throws(()=>setup([]));assert.throws(()=>setup({unknown:true}));
});
test('Recoil-resolved Sr red line and excessive work requests fail before allocation',()=>{
 assert.throws(()=>setup({mass_u:87.9056,lambda_nm:689.4489,gamma_MHz:.007481}),/Recoil-resolved/);assert.throws(()=>setup({n:512,duration_ms:100,dt_us:.001}),/work limit/);
});
test('Safe timestep decreases with fast cloud transit and is never increased by stepping',()=>{
 const {p,derived:d}=setup({dt_us:20}),base=C.safeDt(p,d),fast=C.safeDt(p,d,500);assert.ok(fast<base);const s=C.create({n:16,dt_us:20});const actual=C.step(s);assert.ok(actual<=s.d.dt);assert.ok(actual<=20e-6);
});
test('All six non-recoil-resolved neutral species retain valid all-axis MOT responses',()=>{
 for(const [species,mass_u,lambda_nm,gamma_MHz]of [['rb87',86.90918052859357,780.241209686,6.0666],['cs133',132.90545195855648,852.34727582,5.234],['na23',22.989769281957617,589.1583264,9.7946],['sr88b',87.90561225397822,460.861952,30.3],['yb174b',173.93886754532093,398.9108443,29.13],['yb174g',173.93886754532093,555.80068663,.1824]]){
  const {p,derived:d}=setup({method:'mot',species,mass_u,lambda_nm,gamma_MHz}),response=C.linearResponse(p,d);assert.ok(response.damping_s.every(x=>x>0));assert.ok(response.spring_s2.every(x=>x>0));assert.ok(d.dt>0&&Number.isFinite(d.dt));
 }
});
test('Deterministic force motion converges when timestep is halved',()=>{
 function run(dt){const s=C.create({n:16,method:'mot',temperature_uK:0,sigma_mm:0,driftX:.5,recoil:false,duration_ms:.5,dt_us:dt});while(C.step(s)){}return s.positions[0][0];}
 const coarse=run(2),fine=run(1),reference=run(.25);assert.ok(Math.abs(fine-reference)<Math.abs(coarse-reference));assert.ok(Math.abs(fine-reference)<1e-7);
});
test('Five laser tabs, lazy method panels, exports and localized model limits are wired',()=>{
 const html=fs.readFileSync('layouts/_partials/zg/laser-cooling.html','utf8'),panel=fs.readFileSync('layouts/_partials/zg/neutral-cooling.html','utf8'),js=fs.readFileSync('static/js/neutral-cooling.js','utf8');
 for(const name of ['classic','advanced','fancier','molasses3d','mot'])assert.ok(html.includes(`data-local-panel="${name}"`));for(const token of ['data-neutral-import','data-act="png"','data-act="csv"','data-act="particles"','data-act="video"','data-act="settings"'])assert.ok(panel.includes(token));assert.ok(js.includes("attributeFilter:['hidden']"));assert.ok(js.includes('if(animation||!visible())return'));assert.ok(js.includes('4096/state.p.n'));assert.ok(panel.includes('不包含其真实超精细结构'));assert.ok(panel.includes('not a MOT wall'));
});
