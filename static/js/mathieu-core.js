/* Ideal Mathieu equation w''+(a-2q cos(2τ))w=0, τ=Ωt/2.
   Characteristic values: parity-specific symmetric Hill matrices, Sturm bisection.
   NIST DLMF 28.2, 28.17. Domain validated against SciPy: |q|≤12, orders≤12.
   No first-band shortcut, empirical transmission, cooling, or measured outputs. */
(function(host){'use strict';
 const C={e:1.602176634e-19,u:1.66053906660e-27},MAX_Q=12,MAX_BANDS=6,cache=new Map();
 function finite(x){return typeof x==='number'&&Number.isFinite(x);}
 function eigen(diag,off,index){
  let lo=Infinity,hi=-Infinity;
  diag.forEach((d,i)=>{const r=Math.abs(off[i-1]||0)+Math.abs(off[i]||0);lo=Math.min(lo,d-r);hi=Math.max(hi,d+r);});
  for(let it=0;it<76;it++){
   const x=(lo+hi)/2;let count=0,p=0;
   for(let i=0;i<diag.length;i++){p=diag[i]-x-(i?off[i-1]*off[i-1]/p:0);if(Math.abs(p)<1e-100)p=-1e-100;if(p<0)count++;}
   if(count>index)hi=x;else lo=x;
  }return(lo+hi)/2;
 }
 function characteristic(kind,n,q,dimension=32){
  if(!['a','b'].includes(kind)||!Number.isInteger(n)||n<0||n>12||kind==='b'&&n===0||!finite(q)||Math.abs(q)>MAX_Q||!Number.isInteger(dimension)||dimension<16)throw Error('domain');
  // Curves are labelled for |q|. A half-period shift makes stability invariant
  // under q→−q; odd a_n/b_n names themselves exchange for signed q.
  q=Math.abs(q);if(q===0)return n*n;
  const key=[kind,n,q,dimension].join(':');if(cache.has(key))return cache.get(key);
  const odd=n%2===1;let diag,off,index;
  if(odd){diag=Array.from({length:dimension},(_,i)=>(2*i+1)**2);diag[0]+=kind==='a'?q:-q;off=Array(dimension-1).fill(q);index=(n-1)/2;}
  else if(kind==='a'){diag=Array.from({length:dimension},(_,i)=>4*i*i);off=Array.from({length:dimension-1},(_,i)=>i?q:Math.SQRT2*q);index=n/2;}
  else{diag=Array.from({length:dimension},(_,i)=>4*(i+1)**2);off=Array(dimension-1).fill(q);index=n/2-1;}
  const value=eigen(diag,off,index);if(cache.size>12000)cache.clear();cache.set(key,value);return value;
 }
 function bands(q,count=MAX_BANDS){
  if(!Number.isInteger(count)||count<1||count>MAX_BANDS)throw Error('bands');
  return Array.from({length:count},(_,n)=>({n,lo:characteristic('a',n,q),hi:characteristic('b',n+1,q)}));
 }
 function plane(a,q,count=MAX_BANDS){
  if(!finite(a)||!finite(q)||Math.abs(q)>MAX_Q)return{status:'outside',band:null};
  if(q===0)return{status:a>0?'stable':a===0?'boundary':'unstable',band:a>0?Math.floor(Math.sqrt(a)):null};
  const bs=bands(q,count),tol=2e-9*(1+Math.abs(a));
  for(const b of bs){if(Math.abs(a-b.lo)<=tol||Math.abs(a-b.hi)<=tol)return{status:'boundary',band:b.n};if(a>b.lo&&a<b.hi)return{status:'stable',band:b.n};}
  return{status:a>bs[bs.length-1].hi?'outside':'unstable',band:null};
 }
 function classify(a,q,geometry='linear',count=MAX_BANDS){
  if(!['linear','paul3d'].includes(geometry))throw Error('geometry');
  const factor=geometry==='linear'?-1:-0.5,p1=plane(a,q,count),p2=plane(factor*a,factor*q,count);
  const s=[p1.status,p2.status],status=s.includes('unstable')?'unstable':s.includes('outside')?'outside':s.includes('boundary')?'boundary':'stable';
  return{status,geometry,first:{a,q,...p1},second:{a:factor*a,q:factor*q,...p2}};
 }
 function parameters(massU,charge,U,V,r0mm,fMHz){
  if(![massU,charge,U,V,r0mm,fMHz].every(finite)||massU<=0||!Number.isInteger(charge)||charge<1||charge>100||V<0||r0mm<=0||fMHz<=0)throw Error('inputs');
  const scale=charge*C.e/(massU*C.u*(r0mm/1000)**2*(2*Math.PI*fMHz*1e6)**2);
  return{a:8*scale*U,q:4*scale*V,mass_u:massU,charge,U_V:U,V_rod_peak_V:V,r0_mm:r0mm,f_MHz:fMHz};
 }
 // Ideal 2n-pole model; round rods specify geometry. Rod radius follows a published rule instead of a free number:
 // 'optimal' = radius that cancels the first parasitic harmonic A_3n of 2n round rods (four rods: Denison's 1.14511 r0; table solved by
 // tools/make_rfq_rod_ratios.py), 'curvature' = r0/(n-1) (curvature of the ideal equipotential at the apex), 'filter' = 1.128 r0 (four rods;
 // A6/A10 compromise of mass filters, Douglas & Konenkov 2002), or the user's own ratio / radius. r0 is the distance from the axis to the rod SURFACE.
 const RR=host.ZGRodRatios||(typeof require==='function'?require('./rfq-rod-ratios.js'):null),FILTER_RATIO=1.128,Q_RANGE=[.3,.4,.5],ROD_RULES=['optimal','curvature','filter','ratio','radius'];
 function rodRow(count){const row=RR&&RR.rows[String(count)];if(!row)throw Error('rod count');return row;}
 function rodGeometry({rod_rule,rod_ratio,rod_radius_mm,r0_mm,rod_count}){
  const row=rodRow(rod_count),rule=rod_rule===undefined&&rod_radius_mm!==undefined?'radius':rod_rule;
  if(!ROD_RULES.includes(rule))throw Error('rod rule');
  if(rule==='filter'&&rod_count!==4)throw Error('rod rule');
  const ratio={optimal:row.optimal,curvature:1/(rod_count/2-1),filter:FILTER_RATIO,ratio:rod_ratio,radius:rod_radius_mm/r0_mm}[rule];
  if(!finite(ratio)||ratio<=0)throw Error('rod inputs');
  return{rule,ratio,row};
 }
 function interpolate(xs,ys,x){if(x<xs[0]||x>xs[xs.length-1])return null;let i=1;while(i<xs.length-1&&xs[i]<x)i++;const t=(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[i-1]+t*(ys[i]-ys[i-1]);}
 function rodDesign(input){
  const {mass_u,charge,U_V,V_V,r0_mm,f_MHz,rod_count,radial_fraction=.5,eta_target=.3,bands:count=6,diameter_tolerance_mm=null}=input;
  if(![mass_u,charge,U_V,V_V,r0_mm,f_MHz,rod_count,radial_fraction,eta_target].every(finite)||mass_u<=0||!Number.isInteger(charge)||charge<1||charge>100||V_V<0||r0_mm<=0||f_MHz<=0||!Number.isInteger(rod_count)||rod_count<4||rod_count>24||rod_count%2||radial_fraction<=0||radial_fraction>1||eta_target<=0||(diameter_tolerance_mm!==null&&(!finite(diameter_tolerance_mm)||diameter_tolerance_mm<0)))throw Error('rod inputs');
  const g=rodGeometry({rod_rule:input.rod_rule,rod_ratio:input.rod_ratio,rod_radius_mm:input.rod_radius_mm,r0_mm,rod_count}),rod_radius_mm=g.ratio*r0_mm;
  const n=rod_count/2,R=r0_mm+rod_radius_mm,adjacent=2*R*Math.sin(Math.PI/rod_count),gap=adjacent-2*rod_radius_mm;
  if(![R,adjacent,gap,rod_radius_mm].every(finite)||gap<=0)throw Error('rod overlap');
  const mass=mass_u*C.u,Q=charge*C.e,r0=r0_mm/1000,omega=2*Math.PI*f_MHz*1e6,x=radial_fraction;
  const etaPerV=2*Q*n*(n-1)/(mass*omega**2*r0**2)*x**(n-2),eta=etaPerV*V_V;
  const p=rod_count===4?parameters(mass_u,charge,U_V,V_V,r0_mm,f_MHz):null;
  const curve=g.row.curve,parasitic=interpolate(curve.ratio,curve.A3n_over_An,g.ratio);
  const qScale=Q/(mass*r0**2*omega**2),suggestedRF=rod_count===4?Q_RANGE.map(q=>({q,V_rod_peak_V:q/(4*qScale),f_MHz_at_current_V:V_V>0?Math.sqrt(4*Q*V_V/(mass*r0**2*q))/(2*Math.PI)*1e-6:null})):null;
  const result={mass_u,charge,U_V,V_V,r0_mm,f_MHz,rod_count,rod_rule:g.rule,rod_ratio:g.ratio,rod_radius_mm,rod_diameter_mm:2*rod_radius_mm,radial_fraction,eta_target,order_n:n,
   rod_ratio_optimal:g.row.optimal,rod_ratio_curvature:1/(n-1),rod_ratio_touching:g.row.touching,ratio_deviation_percent:100*(g.ratio/g.row.optimal-1),
   aperture_diameter_mm:2*r0_mm,center_radius_mm:R,outer_radius_mm:R+rod_radius_mm,adjacent_center_mm:adjacent,surface_gap_mm:gap,opposite_center_mm:2*R,
   parasitic_harmonic_order:3*n,parasitic_A_over_An:parasitic,parasitic_at_radial_fraction:parasitic===null?null:parasitic*x**(2*n),
   diameter_tolerance_mm,ratio_tolerance:diameter_tolerance_mm===null?null:diameter_tolerance_mm/(2*r0_mm),
   rod_coordinates:Array.from({length:rod_count},(_,i)=>({index:i+1,x_mm:R*Math.cos(2*Math.PI*i/rod_count),y_mm:R*Math.sin(2*Math.PI*i/rod_count),phase:i%2?-1:1})),
   field_RF_V_m:n*V_V/r0*x**(n-1),dc_potential_at_theta0_V:U_V*x**n,
   pseudopotential_eV:Q**2*n**2*V_V**2/(4*mass*omega**2*r0**2)*x**(2*n-2)/C.e,
   eta,eta_target_met:eta<=eta_target,eta_frequency_min_MHz:f_MHz*Math.sqrt(eta/eta_target),eta_voltage_max_V:eta_target/etaPerV,suggested_RF:suggestedRF,
   classification:p?classify(p.a,p.q,'linear',count):null,parameters:p,model:p?'quadrupole-Mathieu':'ideal-multipole-adiabatic'};
  if(Object.values(result).some(v=>typeof v==='number'&&!finite(v)))throw Error('inputs range');return result;
 }
 function voltageCandidates(input,values){
  if(!Array.isArray(values)||!values.length||values.length>12||!values.every(v=>finite(v)&&v>=0))throw Error('RF scan');
  return values.map(V_V=>rodDesign({...input,V_V}));
 }
 function designLog(input,values,date=new Date().toISOString()){
  return{schema:'traps-rfq-design-v1',timestamp_UTC:date,inputs:{...input},result:rodDesign(input),candidates:voltageCandidates(input,values),
   constants:{elementary_charge_C:C.e,atomic_mass_kg:C.u,edition:'CODATA2018; fixed constants'},
   units:{length:'mm',mass:'u',frequency:'MHz',voltage:'V rod peak; differential peak=2V',field:'V/m',energy:'eV',eta:'dimensionless'},
   equations:{potential:'Phi=(U+V cos(Omega t))(r/r0)^n cos(n theta); 2n rods',geometry:'r0 = axis to rod surface; rr = ratio r0; Rc=r0+rr; Dadj=2Rc sin(pi/rod_count); gap=Dadj-2rr; outer radius Rc+rr',rod_rule:'optimal: A_3n(rr/r0)=0 for 2n round rods (four rods 1.14511); curvature: rr=r0/(n-1); filter: 1.128 (four rods); ratio/radius: user value; parasitic harmonic: A_3n/A_n (r/r0)^(2n)',rf_suggestion:'V_rod_peak=q m r0^2 Omega^2/(4Q) for q=0.3, 0.4, 0.5; f=sqrt(4QV/(m r0^2 q))/(2 pi)',phase:'Positive Mathieu q uses a half-period RF phase-origin shift relative to Phi with +V cos(Omega t); stability is invariant',field:'E_RF=n V/r0 (r/r0)^(n-1)',pseudopotential:'Ueff=Q^2 n^2 V^2/(4m Omega^2 r0^2)(r/r0)^(2n-2)',eta:'eta=2|Q| n(n-1)V/(m Omega^2 r0^2)(r/r0)^(n-2)'},
   sources:['https://dlmf.nist.gov/28.17','https://doi.org/10.3390/physics1030028','https://arxiv.org/abs/0902.2746','https://doi.org/10.1002/rcm.735','https://doi.org/10.1002/rcm.7018'],references:['D. R. Denison, J. Vac. Sci. Technol. 8 (1971) 266 (A6 = 0 at r/r0 = 1.14511 for four round rods; citation as usually quoted, DOI not verified here)','Rod-radius table: tools/make_rfq_rod_ratios.py, free-space multipole solution'],
   limits:'Ideal infinite multipole for the RF/adiabaticity numbers; the rod-radius rule and the parasitic harmonic come from a free-space two-dimensional round-rod solution (no grounded housing, end fields, rod tolerances or space charge). Eta target is user-selected, not a stability guarantee. Higher poles have no Mathieu classification; DC is excluded from pseudopotential/eta. Zero RF gives zero pseudopotential even when the eta target is met. No end fields, collisions, space charge, uncertainty propagation or hardware acceptance.'};
 }
 function monodromy(a,q,steps=512){
  if(!finite(a)||!finite(q)||Math.abs(q)>MAX_Q||Math.abs(a)>100||!Number.isInteger(steps)||steps<64||steps>4096)throw Error('domain');
  let y=[1,0,0,1];const h=Math.PI/steps;
  const f=(t,v)=>{const k=-(a-2*q*Math.cos(2*t));return[v[1],k*v[0],v[3],k*v[2]];};
  for(let i=0;i<steps;i++){const t=i*h,k1=f(t,y),k2=f(t+h/2,y.map((v,j)=>v+h*k1[j]/2)),k3=f(t+h/2,y.map((v,j)=>v+h*k2[j]/2)),k4=f(t+h,y.map((v,j)=>v+h*k3[j]));y=y.map((v,j)=>v+h*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6);}
  const trace=y[0]+y[3],det=y[0]*y[3]-y[1]*y[2];return{trace,det,steps};
 }
 function diagnostic(a,q){
  const low=monodromy(a,q,512),high=monodromy(a,q,1024),delta=Math.abs(high.trace-low.trace),reliable=finite(high.trace)&&Math.abs(high.det-1)<1e-5&&delta<1e-5;
  return{...high,trace_delta:delta,reliable,status:!reliable?'unresolved':Math.abs(Math.abs(high.trace)-2)<1e-6?'boundary':Math.abs(high.trace)<2?'stable':'unstable'};
 }
 const api={C,MAX_Q,MAX_BANDS,ROD_RULES,FILTER_RATIO,Q_RANGE,characteristic,bands,plane,classify,parameters,rodGeometry,rodDesign,voltageCandidates,designLog,monodromy,diagnostic};host.ZGMathieu=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
