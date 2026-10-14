/* Six-beam neutral-atom cooling. SI internally; browser teaching model, not PyLCP.
 * Heuristic F=0 -> F'=1 force: Eckel et al., CPC 270 (2022) 108166, Eq.35.
 * Adiabatic internal response, shared saturation, isotropic spontaneous diffusion.
 * No hyperfine pumping, optical coherence, atom collisions or collective radiation.
 */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZGNeutralCooling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const C = Object.freeze({hbar:1.054571817e-34, kB:1.380649e-23, u:1.66053906660e-27, muB:9.2740100783e-24, g:9.80665});
  const bounds = Object.freeze({mass_u:[1,300],lambda_nm:[100,2000],gamma_MHz:[.001,100],detuning:[-10,5],s0:[0,5],waist_mm:[.1,100],gradient_Gcm:[0,100],muEff:[0,3],n:[16,512],temperature_uK:[0,100000],sigma_mm:[0,20],driftX:[-50,50],driftY:[-50,50],driftZ:[-50,50],duration_ms:[.01,100],dt_us:[.001,20],seed:[1,4294967295],aperture_mm:[0,100]});
  const defaults = Object.freeze({method:'molasses3d',species:'rb87',mass_u:86.90918052859357,lambda_nm:780.241209686,gamma_MHz:6.0666,detuning:-.5,s0:.1,waist_mm:10,gradient_Gcm:10,muEff:1,n:128,temperature_uK:500,sigma_mm:.5,driftX:0,driftY:0,driftZ:0,duration_ms:5,dt_us:2,seed:20261014,aperture_mm:0,laser:true,recoil:true,gravity:false});
  function validate(input={}) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Conditions must be an object.');
    for(const key of Object.keys(input))if(!Object.prototype.hasOwnProperty.call(defaults,key)&&key!=='source')throw new RangeError('Unknown condition field: '+key);
    const p={...defaults};for(const key of Object.keys(defaults))if(Object.prototype.hasOwnProperty.call(input,key))p[key]=input[key];
    for(const [key,[lo,hi]] of Object.entries(bounds)) {
      if(typeof p[key] !== 'number'||!Number.isFinite(p[key])||p[key]<lo||p[key]>hi) throw new RangeError(`${key}: ${lo} … ${hi}`);
    }
    for(const key of ['n','seed']) if(!Number.isInteger(p[key])) throw new RangeError(`${key}: integer required`);
    for(const key of ['laser','recoil','gravity']) if(typeof p[key]!=='boolean') throw new TypeError(`${key}: boolean required`);
    if(!['molasses3d','mot'].includes(p.method)) throw new RangeError('method: molasses3d / mot');
    if(typeof p.species!=='string'||p.species.length>100) throw new TypeError('species: text required');
    const mass=p.mass_u*C.u,k=2*Math.PI/(p.lambda_nm*1e-9),gamma=2*Math.PI*p.gamma_MHz*1e6;
    const recoilT=(C.hbar*k)**2/(mass*C.kB),dopplerT=C.hbar*gamma/(2*C.kB);
    if(recoilT/dopplerT>.2) throw new RangeError('Recoil-resolved transition: semiclassical diffusion is not valid here.');
    const derived={mass,k,gamma,vr:C.hbar*k/mass,recoilT,dopplerT,gradient:p.method==='mot'?p.gradient_Gcm*.01:0};
    const dtLimit=safeDt(p,derived);
    const dt=Math.min(p.dt_us*1e-6,dtLimit);
    if(Math.ceil(p.duration_ms*1e-3/dt)*p.n>20000000) throw new RangeError('Requested duration / timestep / particles exceeds the 20 million particle-step work limit.');
    return {p,derived:{...derived,dtLimit,dt}};
  }
  function rng(seed) {let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function normal(random) {return Math.sqrt(-2*Math.log(Math.max(1e-15,random())))*Math.cos(2*Math.PI*random());}
  function safeDt(p,d,speed=0) {
    // Gaussian wings can retain one strong pair while the other pairs vanish.
    // For its local intensity s <= s0, total saturation is at least 2s;
    // s/(1+2s)^(3/2) peaks at s=1. Keep 3.9 as the conservative coefficient
    // (the isolated-pair Lorentzian derivative coefficient is 9/(4*sqrt(3))).
    const peakS=Math.min(p.s0,1),rateBound=p.laser?3.9*peakS/(1+2*peakS)**1.5:0;
    const damping=rateBound*C.hbar*d.k*d.k/d.mass;
    const oscillation=Math.sqrt(rateBound*d.k*p.muEff*C.muB*d.gradient/d.mass);
    const v=Math.max(speed,Math.hypot(p.driftX,p.driftY,p.driftZ)+5*Math.sqrt(C.kB*p.temperature_uK*1e-6/d.mass));
    const transit=v/(p.waist_mm*1e-3),zeeman=p.muEff*C.muB*d.gradient*v/(C.hbar*d.gamma);
    return Math.min(20e-6,.02/Math.max(1,damping,oscillation,transit,zeeman));
  }
  function force(position,velocity,p,d) {
    const B=[-d.gradient*position[0]/2,-d.gradient*position[1]/2,d.gradient*position[2]],Bmag=Math.hypot(...B),unit=Bmag>1e-20?B.map(x=>x/Bmag):[0,0,1];
    const local=[0,1,2].map(axis=>p.s0*Math.exp(-2*position.reduce((sum,x,j)=>sum+(j===axis?0:x*x),0)/(p.waist_mm*1e-3)**2));
    const saturation=2*local.reduce((sum,x)=>sum+x,0),rates=[],acc=[0,0,p.gravity?-C.g:0],axisRate=[0,0,0];
    for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      let rate=0;
      if(p.laser) for(const q of [-1,0,1]) {
        const cosine=sign*unit[axis],helicity=axis===2?1:-1;
        const weight=q===0?(1-cosine*cosine)/2:(1+q*helicity*cosine)**2/4;
        const delta=p.detuning*d.gamma-sign*d.k*velocity[axis]-q*p.muEff*C.muB*Bmag/C.hbar;
        rate+=d.gamma*.5*local[axis]*weight/(1+saturation+4*(delta/d.gamma)**2);
      }
      rates.push(rate);axisRate[axis]+=rate;acc[axis]+=sign*d.vr*rate;
    }
    const total=rates.reduce((sum,x)=>sum+x,0);
    // Var(dv_j)/dt: absorption shot noise + isotropic emission (1/3 each axis).
    const velocityVarianceRate=axisRate.map(rate=>p.recoil?d.vr*d.vr*(rate+total/3):0);
    return {acc,rates,total,velocityVarianceRate,B};
  }
  function create(input) {
    const {p,derived:d}=validate(input),random=rng(p.seed),sigma=p.sigma_mm*1e-3,sv=Math.sqrt(C.kB*p.temperature_uK*1e-6/d.mass),drift=[p.driftX,p.driftY,p.driftZ];
    const positions=Array.from({length:p.n},()=>[0,1,2].map(()=>sigma*normal(random)));
    const velocities=Array.from({length:p.n},()=>[0,1,2].map(j=>drift[j]+sv*normal(random)));
    const state={p,d,random,positions,velocities,initialPositions:positions.map(r=>r.slice()),initialVelocities:velocities.map(v=>v.slice()),alive:Array(p.n).fill(true),time:0,steps:0,particleSteps:0,photons:0,dtMin:null,dtMax:0,lastDt:0,history:[],failure:null};
    applyAperture(state);state.history.push(diagnostics(state));return state;
  }
  function applyAperture(s) {if(s.p.aperture_mm>0) for(let i=0;i<s.p.n;i++) if(s.alive[i]&&Math.hypot(...s.positions[i])>s.p.aperture_mm*1e-3)s.alive[i]=false;}
  function step(s) {
    if(s.failure) throw new Error(s.failure);
    const remaining=s.p.duration_ms*1e-3-s.time;if(remaining<=1e-15)return 0;
    const speed=s.velocities.reduce((max,v,i)=>s.alive[i]?Math.max(max,Math.hypot(...v)):max,0);
    const dt=Math.min(s.d.dt,safeDt(s.p,s.d,speed),remaining),active=s.alive.filter(Boolean).length;
    if(!active)return 0;
    if(s.particleSteps+active>20000000){s.failure='Particle-step work limit reached; shorten the run or use fewer particles.';throw new Error(s.failure);}
    for(let i=0;i<s.p.n;i++)if(s.alive[i]) {
      const r=s.positions[i],v=s.velocities[i],f=force(r,v,s.p,s.d);
      for(let j=0;j<3;j++) {
        const dv=f.acc[j]*dt+(s.p.recoil?Math.sqrt(f.velocityVarianceRate[j]*dt)*normal(s.random):0);
        r[j]+=(v[j]+.5*dv)*dt;v[j]+=dv;
        if(!Number.isFinite(r[j])||!Number.isFinite(v[j])){s.failure='Numerical failure: nonfinite motion; reset with a smaller timestep.';throw new Error(s.failure);}
      }
      s.photons+=f.total*dt;
    }
    s.time+=dt;s.steps++;s.particleSteps+=active;s.lastDt=dt;s.dtMin=s.dtMin===null?dt:Math.min(s.dtMin,dt);s.dtMax=Math.max(s.dtMax,dt);applyAperture(s);return dt;
  }
  function diagnostics(s) {
    const ids=s.alive.flatMap((on,i)=>on?[i]:[]),n=ids.length,mean=(array,j)=>n?ids.reduce((sum,i)=>sum+array[i][j],0)/n:null;
    const position=[0,1,2].map(j=>mean(s.positions,j)),velocity=[0,1,2].map(j=>mean(s.velocities,j));
    const axes=[0,1,2].map(j=>n>1?s.d.mass*ids.reduce((sum,i)=>sum+(s.velocities[i][j]-velocity[j])**2,0)/((n-1)*C.kB):null);
    const rms=[0,1,2].map(j=>n?Math.sqrt(ids.reduce((sum,i)=>sum+(s.positions[i][j]-position[j])**2,0)/n):null);
    return {t:s.time,n,lost:s.p.n-n,position,velocity,axes,T:n>1?axes.reduce((sum,x)=>sum+x,0)/3:null,rms,photons:s.photons,steps:s.steps,dtLast:s.lastDt,dtMin:s.dtMin,dtMax:s.dtMax};
  }
  function sample(s) {const row=diagnostics(s);if(s.history.at(-1).t===row.t)s.history[s.history.length-1]=row;else s.history.push(row);if(s.history.length>2001)s.history.splice(1,1);return row;}
  function linearResponse(p,d) {
    const velocityStep=d.gamma/d.k*1e-5,positionStep=Math.max(1e-9,p.waist_mm*1e-8),zero=[0,0,0];
    const damping=[],spring=[];
    for(let axis=0;axis<3;axis++) {
      const v=zero.slice(),r=zero.slice();v[axis]=velocityStep;r[axis]=positionStep;
      damping.push(-(force(zero,v,p,d).acc[axis]-force(zero,v.map(x=>-x),p,d).acc[axis])/(2*velocityStep));
      spring.push(-(force(r,zero,p,d).acc[axis]-force(r.map(x=>-x),zero,p,d).acc[axis])/(2*positionStep));
    }
    const noise=force(zero,zero,p,d).velocityVarianceRate;
    return {damping_s:damping,spring_s2:spring,temperature_K:damping.map((a,j)=>a>0?d.mass*noise[j]/(2*a*C.kB):null)};
  }
  return {C,bounds,defaults,validate,rng,normal,safeDt,force,create,step,diagnostics,sample,linearResponse};
});
