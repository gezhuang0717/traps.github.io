/* Reproducible educational ensemble of ideal Mathieu trajectories.
 * No gas collisions, space-charge, finite-electrode fields or SIMION are used.
 * Pure deterministic model, with fixed seed and actual aperture loss records.
 */
(function(host){'use strict';
const X=typeof module==='object'&&module.exports?require('./rfq-extended-core.js'):host.ZGRFQExtras;
function integer(value,label,min,max){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(label+' must be '+min+'..'+max);
 return value;
}
function numeric(value,label,minimum,maximum){
 if(typeof value!=='number'||!Number.isFinite(value)||value<minimum||value>maximum)throw Error(label+' out of range');
 return value;
}
function random(seed){
 let state=seed>>>0;
 const next=()=>{state=(state+0x6D2B79F5)>>>0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296;};
 let spare=null;
 return()=>{if(spare!==null){const x=spare;spare=null;return x;}let u=next(),v=next();u=Math.max(1e-12,u);const r=Math.sqrt(-2*Math.log(u)),theta=2*Math.PI*v;spare=r*Math.sin(theta);return r*Math.cos(theta);};
}
function generate(params){
 const a=numeric(params.a,'a',-12,12),q=numeric(params.q,'q',-12,12),
 r0=numeric(params.r0_mm,'r0_mm',.001,1000),
 f=numeric(params.f_MHz,'f_MHz',.000001,1e6),
 count=integer(params.count,'count',2,48),cycles=integer(params.cycles,'cycles',2,60),
 steps=integer(params.steps,'steps',32,128),seed=integer(params.seed,'seed',0,4294967295);
 if(![32,64,128].includes(steps))throw Error('RK4 steps must be 32,64 or 128');
 const sigmaX=numeric(params.sigma_position_mm,'sigma_position_mm',0,r0),
 sigmaV=numeric(params.sigma_velocity_mm_us,'sigma_velocity_mm_us',0,1000),
 meanVz=numeric(params.mean_vz_mm_us,'mean_vz_mm_us',-1000,1000),
 spreadVz=numeric(params.sigma_vz_mm_us,'sigma_vz_mm_us',0,1000),
 z0=numeric(params.z0_mm||0,'z0_mm',-1e6,1e6),
 phase=numeric(params.phase_rad||0,'phase_rad',-1e5,1e5);
 if(count*cycles*steps>150000)throw Error('The ensemble exceeds the browser step budget');
 const draw=random(seed),periodToUs=1/(Math.PI*f),ions=[],losses=[],w=Math.PI*f;
 for(let i=0;i<count;i++){
   const p={x:sigmaX*draw(),y:sigmaX*draw(),vx:sigmaV*draw(),vy:sigmaV*draw(),
      z:z0, vz:meanVz+spreadVz*draw()};
   const m=X.motion({a,q,r0_mm:r0,cycles,steps_per_rf_cycle:steps,phase_rad:phase,
     x_mm:p.x,y_mm:p.y,z_mm:p.z,vx_mm_per_tau:p.vx/w,
     vy_mm_per_tau:p.vy/w,vz_mm_per_tau:p.vz/w});
   // Keep every loss endpoint and all stored physical samples. A decimated
   // path is solely a rendering choice; analysis retains all stored points.
   const samples=m.samples.map(t=>({cycle:t.cycle,time_us:t.cycle/f,
     x_mm:t.x_mm,y_mm:t.y_mm,z_mm:t.z_mm,r_mm:t.r_mm}));
   ions.push({id:i,initial:p,samples,alive:m.alive,loss_cycle:m.loss_cycle,
     completed_cycles:m.completed_cycles});
   if(!m.alive)losses.push({id:i,cycle:m.loss_cycle});
 }
 return {schema:'rfq-ideal-ensemble-v1',model:'ideal four-rod transverse Mathieu RK4, free axial drift, finite circular aperture at r0',
   assumptions:['independent Gaussian initial x/y and transverse velocity','independent Gaussian axial velocity; no gas or collisions',
    'no space charge, collective beam physics, electrode fringe fields or native SIMION',
    'finite-step radial aperture crossing, evaluate 32/64/128 convergence','event count is simulated, not measured'],
   source_kind:'independent_analytical_ode',seed,count,cycles,steps,
   a,q,r0_mm:r0,frequency_MHz:f,initial_sigma_position_mm:sigmaX,
   initial_sigma_velocity_mm_us:sigmaV,mean_vz_mm_us:meanVz,sigma_vz_mm_us:spreadVz,
   ions,losses,survived:count-losses.length,retained_fraction:(count-losses.length)/count,
   uncertainty_model:'No statistical confidence interval for hardware transmission. Ensemble is an ideal-model finite-aperture illustration.'};
}
const API=Object.freeze({generate,random});
host.ZGRFQEnsemble=API;if(typeof module==='object'&&module.exports)module.exports=API;
})(typeof window==='object'?window:globalThis);
