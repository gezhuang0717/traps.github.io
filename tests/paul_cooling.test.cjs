const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../static/js/paul-cooling-core.js');
const p={n:8,temperature:.05,radius:3e-6,rfHz:2e6,q:.16,axialHz:30e3,detuning:-.5,s0:.6,seed:20261010,mode:'secular',laser:false,coulomb:false,softening:.3e-6,r0:.001,massU:39.99945142,charge:1,lambdaNm:396.958979,gammaMHz:23.05};
test('Paul convention: q maps to rod-pair differential peak and stable secular frequency',()=>{const f=C.frequencies(p);assert.ok(f.stable&&f.wr>0);assert.ok(Math.abs(f.voltage-5.237)<.01);assert.equal(C.frequencies({...p,q:.02,axialHz:200e3}).stable,false);});
test('Conservative Verlet energy and time-step refinement',()=>{let errs=[];for(const div of [40,80]){const s=C.create(p),f=C.frequencies(p),energy=()=>s.positions.reduce((a,v,i)=>a+v.reduce((b,x,k)=>b+x*x*(k===2?f.wz:f.wr)**2+s.velocities[i][k]**2,0),0),a=energy();for(let i=0;i<div*100;i++)C.step(s,p,1/(div*p.rfHz));errs.push(Math.abs(energy()/a-1));}assert.ok(errs[0]<.001&&errs[1]<errs[0]*.4);});
test('Coulomb pairs cancel internally and unresolved RF timestep is rejected',()=>{const s=C.create(p),a=C.acceleration(s,{...p,coulomb:true},0),b=C.acceleration(s,p,0);for(let k=0;k<3;k++)assert.ok(Math.abs(a.reduce((v,x,i)=>v+x[k]-b[i][k],0))<1e-5);assert.throws(()=>C.step(s,p,1e-6));});
test('Photon cooling and blue heating differ with reproducible seeds',()=>{let end=[];for(const d of [-.5,.5]){const cfg={...p,laser:true,detuning:d},s=C.create(cfg);for(let i=0;i<12000;i++)C.step(s,cfg,1/(40*p.rfHz));end.push(C.diagnostics(s,cfg).T);}assert.ok(end[0]<.01&&end[1]>.1);const a=C.create(p),b=C.create(p);assert.deepEqual(a.positions,b.positions);});
test('Third tab retains originals and detailed hints are folded',()=>{const fs=require('node:fs'),s=fs.readFileSync('layouts/_partials/zg/laser-cooling.html','utf8');for(const panel of ['classic','advanced','fancier'])assert.ok(s.includes(`data-local-panel="${panel}"`));assert.ok(!s.includes('class="g-hints" open'));});
test('Penning magnetic rotation conserves pure-B speed and rotates positive ions clockwise',()=>{
 const cfg={...p,trap:'penning',B:.1,axialHz:0,offset:20e-6,waist:100e-6},s=C.create(cfg);s.positions=s.positions.map(()=>[0,0,0]);s.velocities=s.velocities.map(()=>[1,0,0]);const dt=.04/C.frequencies(cfg).wc;
 for(let i=0;i<100;i++)C.step(s,cfg,dt);
 assert.ok(Math.abs(Math.hypot(...s.velocities[0])-1)<1e-12);assert.ok(Math.abs(s.velocities[0][1]+Math.sin(4))<1e-12);
 assert.equal(C.frequencies({...cfg,axialHz:100e3}).stable,false);
});
test('Numerical 3D Penning red cooling and blue loss remain distinct',()=>{
 const cfg={...p,trap:'penning',B:.1,n:16,temperature:.02,radius:15e-6,axialHz:5e3,offset:20e-6,waist:100e-6,laser:true},dt=.05/C.frequencies(cfg).wc;
 const red=C.create(cfg);for(let i=0;i<10000;i++)C.step(red,cfg,dt);assert.ok(C.diagnostics(red,cfg).T<.002);
 const blueCfg={...cfg,detuning:.5},blue=C.create(blueCfg);assert.throws(()=>{for(let i=0;i<10000;i++)C.step(blue,blueCfg,dt);},/aperture/);
});
test('Single-ion Paul axial orbit agrees with the harmonic solution and converges',()=>{
 const cfg={...p,n:1},w=C.frequencies(cfg).wz,T=2*Math.PI/w,errors=[];
 for(const div of [40,80]){const dt=1/(div*cfg.rfHz),s=C.create(cfg);s.positions=[[0,0,5e-6]];s.velocities=[[0,0,0]];const n=Math.round(2.25*T/dt);for(let i=0;i<n;i++)C.step(s,cfg,dt);errors.push(Math.abs(s.positions[0][2]/5e-6-Math.cos(w*n*dt)));}assert.ok(errors[0]<.00002&&errors[1]<errors[0]*.3);
});
test('Penning radial eigenmode matches the analytic clockwise orbit and converges',()=>{
 const cfg={...p,n:1,trap:'penning',B:.1,axialHz:5e3,laser:false},f=C.frequencies(cfg),wp=(f.wc+Math.sqrt(f.wc*f.wc-2*f.wz*f.wz))/2,errors=[];
 for(const h of [.05,.025]){const dt=h/f.wc,n=Math.round(10*2*Math.PI/wp/dt),s=C.create(cfg),R=10e-6;s.positions=[[R,0,0]];s.velocities=[[0,-wp*R,0]];for(let i=0;i<n;i++)C.step(s,cfg,dt);errors.push(Math.hypot(s.positions[0][0]/R-Math.cos(wp*n*dt),s.positions[0][1]/R+Math.sin(wp*n*dt)));}assert.ok(errors[0]<.01&&errors[1]<errors[0]*.3);
});
