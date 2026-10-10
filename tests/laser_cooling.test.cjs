// Laser (Doppler) cooling: independent checks of the two-level formulas, the stochastic molasses and the Penning-trap
// mode rates (Itano–Wineland window, Hendricks et al. arXiv:0709.3817).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../static/js/physics.js'),read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../static/data',n)));
const cat=P.catalogue(read('nuclear-states.json'),read('ame2020.json'));
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tol ${t})`);
const CA={gamma:2*Math.PI*23.05e6,lambda:396.958979e-9,massKg:cat.resolve('40Ca',{q:1}).ionMassU*P.C.uKg};
test('scattering saturates at Γ/2 and is Lorentzian',()=>{near(P.laserScatter(1e9,0,1),0.5,1e-8);near(P.laserScatter(1,1,2)/P.laserScatter(1,0,2),2/3,1e-15);});
test('Doppler limit ħΓ/2k_B at δ=−Γ/2, s→0 (0.553 mK for Ca+); η=1/3 gives 2/3 of it',()=>{
  const t=P.molassesTheory({...CA,delta:-CA.gamma/2,s0:1e-6});near(t.T/t.TDoppler,1,1e-5);near(t.TDoppler*1e3,0.5533,2e-3);
  assert.ok(P.molassesTheory({...CA,delta:-.4*CA.gamma,s0:1e-6}).T>t.T&&P.molassesTheory({...CA,delta:-.6*CA.gamma,s0:1e-6}).T>t.T);
  assert.equal(P.molassesTheory({...CA,delta:CA.gamma/2,s0:.1}).T,Infinity);
  near(P.molassesTheory({...CA,delta:-CA.gamma/2,s0:1e-6,eta:1/3}).T/t.T,2/3,1e-5);
  near(P.molassesTheory({...CA,delta:-CA.gamma/2,s0:1}).T/t.TDoppler,1.5,1e-9);   // (1+s0+1)/2
});
test('Ca+ recoil velocity ≈ 2.5 cm/s; recoil temperature ≪ Doppler limit',()=>{const t=P.molassesTheory({...CA,delta:-CA.gamma/2,s0:.5});near(t.vr,0.02510,2e-4);assert.ok(t.Trecoil<t.TDoppler/100);});
test('stochastic molasses reaches the analytic temperature',()=>{
  const p={...CA,delta:-CA.gamma/2,s0:.2,eta:1},th=P.molassesTheory(p),rnd=P.rng(20261010),v=Array.from({length:3000},()=>3*P.gaussian(rnd)),dt=0.05/CA.gamma;
  for(let i=0;i<Math.ceil(12*th.dampingTime/dt);i++)P.molassesStep(v,p,dt,rnd);
  const mu=v.reduce((a,b)=>a+b,0)/v.length,T=CA.massKg*v.reduce((a,b)=>a+(b-mu)**2,0)/v.length/P.KB;near(T/th.T,1,0.12);
});
test('Penning trap: centred beam heats the magnetron; offset inside the window cools all three modes',()=>{
  const ion=cat.resolve('40Ca',{q:1}),b={ion,B:7,U0:100,d:26.05e-3,lambda:CA.lambda,gamma:CA.gamma,delta:-CA.gamma/2,s0:1,w:100e-6,theta:0.2};
  const c=P.penningLaser({...b,yb:0});assert.ok(c.gp<0&&c.gz<0&&c.gm>0&&!c.allCooled);
  const o=P.penningLaser({...b,yb:20e-6});assert.ok(o.Fy>o.window[0]&&o.Fy<o.window[1]&&o.allCooled);
  assert.ok(P.penningLaser({...b,yb:-20e-6}).gm>0);near(P.penningLaser({...b,yb:20e-6,theta:0}).gz,0,0);
  near(o.gp+o.gm,-o.beta*Math.cos(.2)**2/(2*o.m),1e-9*Math.abs(o.gp));   // sum rule: total radial damping = β_r/2m
});
test('amplitude evolution',()=>{near(P.amplitudeAt(1e-3,-100,2e-12,1),Math.sqrt(2e-12/200),1e-9);assert.ok(P.amplitudeAt(1e-4,10,0,.1)>1e-4*Math.E**.99);});
