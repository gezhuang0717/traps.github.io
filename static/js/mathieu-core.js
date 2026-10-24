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
 const api={C,MAX_Q,MAX_BANDS,characteristic,bands,plane,classify,parameters,monodromy,diagnostic};host.ZGMathieu=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
