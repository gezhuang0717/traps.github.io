/* Public educational RFQ models. These are NOT measured, PIC, gas-trajectory,
   electrode-field, or native SIMION results. No network/telemetry or private data. */
(function(host){'use strict';
const C=Object.freeze({e:1.602176634e-19,u:1.66053906660e-27,k:1.380649e-23,fwhm:2*Math.sqrt(2*Math.log(2))});
function n(x,name,lo=-Infinity,hi=Infinity){const v=Number(x);if(x===''||x===null||x===undefined||!Number.isFinite(v)||v<lo||v>hi)throw Error(name);return v;}
function motion(input){
 const a=n(input.a,'a',-12,12),q=n(input.q,'q',-12,12),r0=n(input.r0_mm,'r0',.001,1000),cycles=n(input.cycles,'cycles',.1,100),phase=n(input.phase_rad??0,'phase',-1e5,1e5);
 const steps=n(input.steps_per_rf_cycle??64,'steps per RF cycle');
 if(![32,64,128].includes(steps))throw Error('steps per RF cycle must be 32, 64 or 128');
 const total=Math.ceil(cycles*steps),dt=Math.PI*cycles/total;
 let s=[n(input.x_mm,'x',-1e6,1e6),n(input.y_mm,'y',-1e6,1e6),n(input.vx_mm_per_tau??0,'vx',-1e4,1e4),n(input.vy_mm_per_tau??0,'vy',-1e4,1e4)],tau=0,loss=null,performed=0;
 function deriv(t,y){const b=2*q*Math.cos(2*t+phase);return[y[2],y[3],(-a+b)*y[0],(a-b)*y[1]];}
 function add(y,k,h){return y.map((v,i)=>v+h*k[i]);}
 function sample(){return{cycle:tau/Math.PI,tau,x_mm:s[0],y_mm:s[1],vx_mm_per_tau:s[2],vy_mm_per_tau:s[3],r_mm:Math.hypot(s[0],s[1])};}
 const samples=[sample()];
 // Test the actual circular aperture at launch, including diagonal offsets.
 if(samples[0].r_mm>=r0)loss=0;
 for(let k=1;loss===null&&k<=total;k++){
  const k1=deriv(tau,s),k2=deriv(tau+dt/2,add(s,k1,dt/2)),k3=deriv(tau+dt/2,add(s,k2,dt/2)),k4=deriv(tau+dt,add(s,k3,dt));
  s=s.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);tau=k*dt;performed=k;
  const row=sample();
  if(!Number.isFinite(row.r_mm)||row.r_mm>=r0){loss=row.cycle;samples.push(row);break;}
  if(k%4===0||k===total)samples.push(row);
 }
 return{schema:'rfq-motion-ideal-v2',model:'infinite-length ideal four-rod Mathieu RK4; no collisions or fringe fields',samples,alive:loss===null,loss_cycle:loss,r0_mm:r0,steps_per_rf_cycle:steps,effective_steps_per_rf_cycle:total/cycles,integration_steps:performed,requested_cycles:cycles,completed_cycles:tau/Math.PI,step_tau:dt,loss_resolution_cycles:dt/Math.PI,units:{tau:'dimensionless; pi per RF cycle',cycle:'RF periods',x_mm:'mm',y_mm:'mm',vx_mm_per_tau:'mm per unit tau',vy_mm_per_tau:'mm per unit tau'},assumptions:['first RF phase explicitly selected','no axial trapping curvature or axial trajectory','radial aperture proxy is circular','loss is sampled at step endpoints; compare 32/64/128 steps for convergence','finite-time integration is not experimental transmission']};
}
function cooling(input){
 const mass=n(input.mass_u,'mass',.001,1e6),gas=n(input.gas_mass_u,'gas mass',.1,300),T=n(input.temperature_K,'temperature',1,2500),p=n(input.pressure_mbar,'pressure',0,10),sigma=n(input.cross_section_A2,'cross section',.01,1e6)*1e-20,energy=n(input.energy_eV,'energy',0,1e6),ms=n(input.residence_ms,'residence',0,1e5),coupling=n(input.transfer_efficiency??1,'transfer factor',0,1);
 const mi=mass*C.u,mg=gas*C.u,mu=mi*mg/(mi+mg),density=p*100/(C.k*T),v0=Math.sqrt(2*energy*C.e/mi),vgas=Math.sqrt(8*C.k*T/(Math.PI*mg)),vrel=Math.hypot(v0,vgas),nu=density*sigma*vrel;
 const transfer=2*mi*mg/(mi+mg)**2,rate=nu*transfer*coupling,Eeq=1.5*C.k*T/C.e;
 const at=t=>rate===0?energy:Eeq+(energy-Eeq)*Math.exp(-rate*t/1000);
 const points=Array.from({length:61},(_,i)=>({t_ms:ms*i/60,energy_eV:at(ms*i/60)}));
 return{schema:'rfq-gas-relaxation-proxy-v1',model:'constant initial relative speed; stationary homogeneous gas; exponential energy-relaxation proxy',density_m3:density,relative_speed_m_s:vrel,collision_rate_s:nu,energy_transfer_fraction:transfer,effective_rate_s:rate,energy_floor_eV:Eeq,estimated_energy_eV:at(ms),tau_ms:rate>0?1000/rate:null,points,assumptions:['no RF micromotion heating or field gradients','cross section and transfer factor are user-supplied','not a Monte Carlo collision model','no prediction of transmitted ion counts or emittance']};
}
function bunch(input){
 const m=n(input.mass_u,'mass',.001,1e6)*C.u,z=n(input.charge,'charge',1,100),V=n(input.acceleration_V,'acceleration',.001,1e7),L=n(input.drift_m,'drift',.001,1e4),st=n(input.sigma_t_ns,'sigma t',0,1e9),se=n(input.sigma_E_eV,'sigma E',0,1e8),rho=n(input.rho,'rho',-1,1);
 if(!Number.isInteger(z))throw Error('integer charge');const E=z*V;
 const t_ns=1e9*L*Math.sqrt(m/(2*E*C.e)),g=-t_ns/(2*E),cov=rho*st*se,h=-g*se;
 // Equivalent to st^2+h^2-2*rho*st*h, without cancellation at a temporal focus.
 const width=r=>Math.hypot(st-h,Math.sqrt(2*(1-r))*Math.sqrt(st)*Math.sqrt(h));
 const sigma=width(rho),scan=Array.from({length:81},(_,i)=>{const r=-1+i/40;return{rho:r,fwhm_ns:C.fwhm*width(r)};});
 const relative=se/E,valid=relative<=.1;
 return{schema:'rfq-drift-covariance-v2',model:'linearized field-free drift; Gaussian approximation; start-time and energy covariance',energy_eV:E,flight_ns:t_ns,dt_dE_ns_per_eV:g,initial_sigma_t_ns:st,sigma_E_eV:se,covariance_ns_eV:cov,sigma_t_out_ns:sigma,fwhm_out_ns:C.fwhm*sigma,relative_energy_spread:relative,valid_linearization:valid,linearization_limit:.1,warnings:valid?[]:['relative_energy_spread_exceeds_0.1; widths are formal linearized values, not a reliable prediction'],scan,assumptions:['small relative energy spread; sigma_E/E <= 0.1 is a screening criterion, not an accuracy guarantee','higher-order drift terms matter near a temporal focus even at small spread','no acceleration fringe or trajectory aberrations','not an RFQ extraction waveform calculation','not final MR-TOF resolving power']};
}
function inventory(input){
 const rate=n(input.ion_rate_s,'rate',0,1e13),hold=n(input.hold_ms,'hold',0,1e9),life=n(input.lifetime_ms,'lifetime',.001,1e12),capacity=n(input.capacity,'capacity',0,1e13),eff=n(input.extraction_fraction,'efficiency',0,1);
 const t=hold/1000,tau=life/1000,N=Math.min(capacity,rate*tau*(-Math.expm1(-t/tau)));
 return{schema:'rfq-inventory-proxy-v1',model:'constant rate; exponential loss; user-defined hard capacity; no space-charge solution',captured_ions:N,delivered_ions:N*eff,delivered_rate_s:hold>0?N*eff/(hold/1000):0,assumptions:['ion counts are expectations, not integer samples','capacity is a supplied limit, not a simulated space-charge result']};
}
function parameterScan(input,mathieu){
 if(!mathieu||typeof mathieu.parameters!=='function'||typeof mathieu.classify!=='function')throw Error('Mathieu core missing');
 const axis=input.axis,keys={voltage:'V_rod_peak_V',frequency:'f_MHz',radius:'r0_mm',mass:'mass_u'};
 if(!Object.hasOwn(keys,axis))throw Error('scan axis');
 const lo=n(input.min,'scan min',axis==='voltage'?0:Number.MIN_VALUE,1e6),hi=n(input.max,'scan max',axis==='voltage'?0:Number.MIN_VALUE,1e6),count=n(input.count,'count',3,201);
 if(!Number.isInteger(count)||hi<=lo)throw Error('scan range');
 const base={mass_u:n(input.mass_u,'mass',.001,1e6),charge:n(input.charge,'charge',1,100),U_V:n(input.U_V,'U'),V_rod_peak_V:n(input.V_rod_peak_V??0,'RF peak',0),r0_mm:n(input.r0_mm,'r0',.001,1000),f_MHz:n(input.f_MHz,'frequency',.000001,1e6)};
 if(!Number.isInteger(base.charge))throw Error('integer charge');
 const rows=Array.from({length:count},(_,i)=>{
  const value=lo+(hi-lo)*i/(count-1),v={...base,[keys[axis]]:value};
  const p=mathieu.parameters(v.mass_u,v.charge,v.U_V,v.V_rod_peak_V,v.r0_mm,v.f_MHz),c=mathieu.classify(p.a,p.q,'linear',6);
  const depth=v.charge*p.q*v.V_rod_peak_V/4;
  if(![p.a,p.q,depth].every(Number.isFinite))throw Error('scan range overflows model');
  return{scan_value:value,voltage_rod_peak_V:v.V_rod_peak_V,f_MHz:v.f_MHz,r0_mm:v.r0_mm,mass_u:v.mass_u,a:p.a,q:p.q,classification:c.status,rf_only_depth_eV:depth};
 });
 return{schema:'rfq-parameter-scan-v1',axis,scan_unit:{voltage:'V single-rod peak',frequency:'MHz',radius:'mm',mass:'u'}[axis],model:'independent ideal Mathieu points; RF-only pseudopotential depth at r0; no transmission or cooling',rows,assumptions:['RF amplitude is single-rod zero-to-peak with balanced opposite RF phases','RF-only depth is the low-q approximation; it excludes DC and does not imply stability','classification outside means outside the validated Mathieu calculation domain']};
}
function voltageScan(input,mathieu){
 const report=parameterScan({...input,axis:'voltage',min:input.min_V,max:input.max_V},mathieu);
 return{...report,schema:'rfq-voltage-scan-v1'};
}
function analyzeSamples(rows){
 if(!Array.isArray(rows)||rows.length<3||rows.length>50000)throw Error('sample count');
 const a=rows.map(v=>({t_ns:n(v.t_ns,'t'),E_eV:n(v.E_eV,'E',0),x_mm:v.x_mm==null?null:n(v.x_mm,'x'),y_mm:v.y_mm==null?null:n(v.y_mm,'y')}));
 const avg=k=>a.reduce((s,r)=>s+r[k],0)/a.length,mt=avg('t_ns'),mE=avg('E_eV'),sums=a.reduce((o,r)=>{const dt=r.t_ns-mt,dE=r.E_eV-mE;o.tt+=dt*dt;o.ee+=dE*dE;o.te+=dt*dE;return o;},{tt:0,ee:0,te:0});
 const st=Math.sqrt(sums.tt/(a.length-1)),se=Math.sqrt(sums.ee/(a.length-1)),cov=sums.te/(a.length-1);
 const radial=a.every(r=>r.x_mm!=null&&r.y_mm!=null)?Math.sqrt(a.reduce((s,r)=>s+r.x_mm**2+r.y_mm**2,0)/a.length):null;
 return{schema:'rfq-local-table-stats-v1',model:'unweighted sample statistics; Gaussian equivalent FWHM; not a fitted non-Gaussian FWHM',count:a.length,mean_t_ns:mt,mean_E_eV:mE,sigma_t_ns:st,sigma_E_eV:se,covariance_ns_eV:cov,correlation:st>0&&se>0?cov/(st*se):null,gaussian_equivalent_fwhm_ns:C.fwhm*st,radial_rms_mm:radial};
}
function parseCSV(s){
 if(typeof s!=='string'||s.length>5000000)throw Error('CSV size');
 // RFC 4180 fields: doubled quotes, quoted commas/newlines, CRLF and UTF-8 BOM.
 // Only the documented numeric columns are imported; extra metadata is ignored.
 s=s.replace(/^\uFEFF/,'');
 const table=[];let row=[],field='',state='start';
 const cell=()=>{row.push(field);field='';state='start';};
 const record=()=>{cell();if(row.some(v=>v.trim()!==''))table.push(row);row=[];};
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(state==='quoted'){
   if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else state='closed';}else field+=c;
   continue;
  }
  if(c===','){cell();continue;}
  if(c==='\r'||c==='\n'){record();if(c==='\r'&&s[i+1]==='\n')i++;continue;}
  if(state==='closed')throw Error('CSV characters after closing quote');
  if(c==='"'){if(state!=='start')throw Error('CSV malformed quote');state='quoted';continue;}
  field+=c;state='plain';
 }
 if(state==='quoted')throw Error('CSV unterminated quote');
 if(field!==''||row.length||state==='closed')record();
 if(!table.length)throw Error('CSV header');
 const head=table.shift().map(v=>v.trim().toLowerCase());
 if(head.some(v=>!v)||new Set(head).size!==head.length)throw Error('CSV duplicate or empty header');
 for(const col of ['t_ns','e_ev'])if(!head.includes(col))throw Error('CSV requires t_ns,E_eV');
 if(table.length<3||table.length>50000)throw Error('CSV row count');
 const numberPattern=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
 return table.map(cols=>{
  if(cols.length!==head.length)throw Error('CSV column count');
  const obj={};
  for(const key of ['t_ns','e_ev','x_mm','y_mm']){
   const i=head.indexOf(key);if(i===-1)continue;
   const value=cols[i].trim();if(!numberPattern.test(value))throw Error('CSV numeric cell: '+key);
   obj[key==='e_ev'?'E_eV':key]=n(value,key,key==='e_ev'?0:-Infinity);
  }
  return obj;
 });
}
const api=Object.freeze({C,motion,cooling,bunch,inventory,parameterScan,voltageScan,analyzeSamples,parseCSV});
host.ZGRFQExtras=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
