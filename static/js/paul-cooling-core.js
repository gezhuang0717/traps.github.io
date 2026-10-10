/* Ideal linear Paul or Penning trap; independent two-level beams, classical Coulomb ions.
   Phi_RF = V cos(Omega t)(x^2-y^2)/(2 r0^2); q_M=2 Q V/(m r0^2 Omega^2).
   Axial DC confinement implies radial defocusing -omega_z^2/2.
   Model and numerical controls are recorded in exported settings. */
(function(host){
  'use strict';
  const U=1.66053906660e-27,E=1.602176634e-19,K=1.380649e-23,H=1.054571817e-34,KE=8.9875517923e9;
  function random(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
  const normal=r=>Math.sqrt(-2*Math.log(Math.max(r(),1e-12)))*Math.cos(2*Math.PI*r());
  /* Exact Mathieu characteristic exponent β(a,q) of the first stability region (continued fraction,
     McLachlan / March): β² = a + q²/((β+2)²−a−q²/((β+4)²−a−…)) + q²/((β−2)²−a−q²/((β−4)²−a−…)).
     Returns NaN outside 0<β<1.  Secular angular frequency ω = βΩ/2 (exact for the ideal quadrupole). */
  function mathieuBeta(a,q){q=Math.abs(q);if(q===0)return a>0&&a<1?Math.sqrt(a):NaN;let b=Math.sqrt(Math.max(1e-12,a+q*q/2));
    for(let it=0;it<200;it++){const cf=sg=>{let v=0;for(let n=14;n>=1;n--){const m=b+2*sg*n;v=q*q/(m*m-a-v);}return v;};const b2=a+cf(1)+cf(-1);if(!(b2>0))return NaN;const nb=Math.sqrt(b2);if(Math.abs(nb-b)<1e-15){b=nb;break;}b=.5*(b+nb);}
    return b>0&&b<1?b:NaN;}
  /* Electrode design → Mathieu parameters (linear Paul) or eigenfrequencies (Penning).
     Paul: q = 2QV_rf/(m r0² Ω²), a_dc = 4QU_dc/(m r0² Ω²), ω_z² = 2QκU_end/(m z0²).  Penning: ω_z² = QU0/(m d²). */
  function design(p){const m=p.massU*U,Q=p.charge*E;if(p.trap==='penning'){const wz2=Q*p.U0/(m*p.d*p.d);return{axialHz:Math.sqrt(Math.max(0,wz2))/(2*Math.PI),wz2};}
    const O=2*Math.PI*p.rfHz;return{q:2*Q*p.Vrf/(m*p.r0*p.r0*O*O),aDC:4*Q*p.Udc/(m*p.r0*p.r0*O*O),axialHz:Math.sqrt(Math.max(0,2*Q*p.kappa*p.Uend/(m*p.z0*p.z0)))/(2*Math.PI)};}
  function frequencies(p){if(p.trap==='penning'){const wc=p.charge*E*p.B/(p.massU*U),wz=2*Math.PI*p.axialHz,d=wc*wc-2*wz*wz;return{O:0,wc,wz,wr:Math.sqrt(Math.max(0,d)),wp:(wc+Math.sqrt(Math.max(0,d)))/2,wm:(wc-Math.sqrt(Math.max(0,d)))/2,stable:d>0&&wc>0,voltage:0,U0:p.d?wz*wz*p.massU*U*p.d*p.d/(p.charge*E):undefined};}
    const O=2*Math.PI*p.rfHz,wz=2*Math.PI*p.axialHz,aDC=p.aDC||0,ae=-2*wz*wz/(O*O),ax=aDC+ae,ay=-aDC+ae,bx=mathieuBeta(ax,p.q),by=mathieuBeta(ay,p.q);
    const exact=p.exact!==false,wxA=Math.sqrt(Math.max(0,O*O/4*(ax+p.q*p.q/2))),wyA=Math.sqrt(Math.max(0,O*O/4*(ay+p.q*p.q/2)));
    const wx=exact?bx*O/2:wxA,wy=exact?by*O/2:wyA,stable=Number.isFinite(bx)&&Number.isFinite(by)&&wx>0&&wy>0&&p.q<.908;
    return{O,wz,wx:stable?wx:0,wy:stable?wy:0,wr:stable?Math.min(wx,wy):0,wxApprox:wxA,wyApprox:wyA,a:aDC,ax,ay,q:p.q,betaX:bx,betaY:by,stable,
      voltage:p.q*p.massU*U*(p.r0*p.r0)*O*O/(2*E*p.charge),depth_eV:p.q*p.q*p.massU*U*O*O*p.r0*p.r0/(16*E)};}
  function create(p){const r=random(p.seed),s=Math.sqrt(K*p.temperature/(p.massU*U));return{r,t:0,photons:0,positions:Array.from({length:p.n},()=>[normal(r)*p.radius,normal(r)*p.radius,normal(r)*p.radius]),velocities:Array.from({length:p.n},()=>[normal(r)*s,normal(r)*s,normal(r)*s]),history:[],lost:0};}
  function acceleration(s,p,t){const f=frequencies(p),rf=p.mode==='rf',rad=f.O*f.O*p.q/2*Math.cos(f.O*t),dc=f.O*f.O/4*(p.aDC||0),wz2=f.wz*f.wz;
    const a=s.positions.map(v=>p.trap==='penning'?[wz2/2*v[0],wz2/2*v[1],-wz2*v[2]]:rf?[-(dc+rad-wz2/2)*v[0],(dc+rad+wz2/2)*v[1],-wz2*v[2]]:[-f.wx*f.wx*v[0],-f.wy*f.wy*v[1],-wz2*v[2]]);
    if(p.coulomb){const c=KE*(p.charge*E)**2/(p.massU*U);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const d=s.positions[i].map((v,k)=>v-s.positions[j][k]),d3=(d.reduce((v,x)=>v+x*x,0)+p.softening*p.softening)**1.5;for(let k=0;k<3;k++){const g=c*d[k]/d3;a[i][k]+=g;a[j][k]-=g;}}}return a;}
  function poisson(mu,r){if(mu<=0)return 0;if(mu>30)return Math.max(0,Math.round(mu+Math.sqrt(mu)*normal(r)));let n=0,x=1,lim=Math.exp(-mu);do{n++;x*=r();}while(x>lim);return n-1;}
  function step(s,p,dt){const f=frequencies(p);if(!(dt>0)||dt>(p.trap==='penning'?.08/Math.max(f.wc,f.wz):1/(40*p.rfHz))+1e-15)throw Error('RF timestep must resolve at least 40 points per drive period');
    const a=acceleration(s,p,s.t);for(let i=0;i<a.length;i++){
      for(let k=0;k<3;k++)s.velocities[i][k]+=.5*dt*a[i][k];
      if(p.trap==='penning'){for(let k=0;k<3;k++)s.positions[i][k]+=dt*s.velocities[i][k]/2;const v=s.velocities[i],x=v[0],y=v[1],c=Math.cos(f.wc*dt),sn=Math.sin(f.wc*dt);v[0]=c*x+sn*y;v[1]=c*y-sn*x;for(let k=0;k<3;k++)s.positions[i][k]+=dt*v[k]/2;}
      else for(let k=0;k<3;k++)s.positions[i][k]+=dt*s.velocities[i][k];
    }
    const b=acceleration(s,p,s.t+dt);for(let i=0;i<b.length;i++)for(let k=0;k<3;k++)s.velocities[i][k]+=.5*dt*b[i][k];
    if(p.laser){const g=2*Math.PI*p.gammaMHz*1e6,k=2*Math.PI/(p.lambdaNm*1e-9),vr=H*k/(p.massU*U);
      for(let i=0;i<s.velocities.length;i++){const v=s.velocities[i];for(let axis=0;axis<3;axis++){
        const sat=p.s0/6*(p.trap==='penning'&&axis===0?Math.exp(-2*((s.positions[i][1]-p.offset)/p.waist)**2):1),rate=d=>g/2*sat/(1+sat+(2*d/g)**2);
        const nplus=p.trap==='penning'&&axis===1?0:poisson(rate(p.detuning*g-k*v[axis])*dt,s.r),nminus=p.trap==='penning'&&axis<2?0:poisson(rate(p.detuning*g+k*v[axis])*dt,s.r),n=nplus+nminus;v[axis]+=(nplus-nminus)*vr;s.photons+=n;
        for(let j=0;j<n;j++){const z=2*s.r()-1,phi=2*Math.PI*s.r(),r=Math.sqrt(1-z*z);v[0]+=vr*r*Math.cos(phi);v[1]+=vr*r*Math.sin(phi);v[2]+=vr*z;}
      }}
    }
    s.t+=dt;s.lost=s.positions.filter(v=>v.some(x=>!Number.isFinite(x)||Math.abs(x)>p.r0)).length;if(s.lost)throw Error('Ion outside selected trap aperture; reduce timestep/temperature or choose stable confinement');return diagnostics(s,p);
  }
  function diagnostics(s,p){const n=s.velocities.length,mean=[0,1,2].map(k=>s.velocities.reduce((v,a)=>v+a[k],0)/n),T=[0,1,2].map(k=>p.massU*U/K*s.velocities.reduce((v,a)=>v+(a[k]-mean[k])**2,0)/Math.max(n-1,1));return{t:s.t,T:T.reduce((a,b)=>a+b,0)/3,axes:T,rms:Math.sqrt(s.positions.reduce((a,v)=>a+v.reduce((b,x)=>b+x*x,0),0)/n),photons:s.photons/n,frequencies:frequencies(p)};}
  function relax(s,p){if(p.trap==='penning')return s;const cfg={...p,mode:'secular'},f=frequencies(cfg),tau=.1/Math.max(f.wr,f.wz,1);for(let j=0;j<5000;j++){const a=acceleration(s,cfg,0);for(let i=0;i<a.length;i++)for(let k=0;k<3;k++)s.positions[i][k]+=Math.max(-p.radius/20,Math.min(p.radius/20,a[i][k]*tau*tau));}return s;}
  const api={frequencies,design,mathieuBeta,create,step,diagnostics,acceleration,random,normal,relax};host.ZGPaulCooling=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
