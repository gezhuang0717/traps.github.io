const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../static/js/rfq-extended-core.js'),M=require('../static/js/mathieu-core.js');
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);
test('zero gas gives no collisions and no cooling',()=>{const a=X.cooling({mass_u:100,gas_mass_u:4,temperature_K:300,pressure_mbar:0,cross_section_A2:100,energy_eV:10,residence_ms:1});close(a.estimated_energy_eV,10);assert.equal(a.tau_ms,null);});
test('pressure doubles collision rate in constant-speed proxy',()=>{const b={mass_u:100,gas_mass_u:4,temperature_K:300,cross_section_A2:100,energy_eV:10,residence_ms:1},a=X.cooling({...b,pressure_mbar:.001}),c=X.cooling({...b,pressure_mbar:.002});close(c.collision_rate_s,2*a.collision_rate_s);assert.ok(c.estimated_energy_eV<a.estimated_energy_eV);});
test('gas model explicitly disclaims RF and transport',()=>{const v=X.cooling({mass_u:100,gas_mass_u:4,temperature_K:300,pressure_mbar:.001,cross_section_A2:100,energy_eV:10,residence_ms:1});assert.match(v.assumptions.join(' '),/micromotion/);});
test('drift time scales as sqrt mass divided by charge voltage',()=>{const s={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:20,sigma_E_eV:0,rho:0},a=X.bunch(s),b=X.bunch({...s,mass_u:400});close(b.flight_ns/a.flight_ns,2);close(a.sigma_t_out_ns,20);});
test('positive t-E covariance can compress time with negative derivative',()=>{const s={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:20,sigma_E_eV:1},a=X.bunch({...s,rho:0}),b=X.bunch({...s,rho:.9});assert.ok(b.fwhm_out_ns<a.fwhm_out_ns);assert.equal(a.scan.length,81);});
test('rho and charge limits fail',()=>{const s={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:10,sigma_E_eV:1,rho:0};assert.throws(()=>X.bunch({...s,rho:1.2}));assert.throws(()=>X.bunch({...s,charge:1.5}));});
test('inventory respects lifetime and cap',()=>{const p={ion_rate_s:1000,hold_ms:1000,lifetime_ms:1000,capacity:1e6,extraction_fraction:.7},a=X.inventory(p),b=X.inventory({...p,capacity:50});close(a.captured_ions,1000*(1-Math.exp(-1)));assert.equal(b.captured_ions,50);close(b.delivered_ions,35);});
test('RK4 exactly remains on axis and clips radial loss',()=>{const p={a:0,q:.4,r0_mm:5,cycles:6,x_mm:0,y_mm:0},a=X.motion(p);assert.equal(a.alive,true);assert.ok(a.samples.every(x=>x.r_mm===0));const b=X.motion({...p,x_mm:5});assert.equal(b.alive,false);});
test('voltage scan interpolates endpoints and returns ideal classifications',()=>{const x=X.voltageScan({mass_u:100,charge:1,U_V:0,r0_mm:3.5,f_MHz:2,min_V:0,max_V:150,count:4},M);close(x.rows[0].voltage_rod_peak_V,0);close(x.rows[3].voltage_rod_peak_V,150);assert.ok(x.rows.every(r=>['stable','unstable','boundary','outside'].includes(r.classification)));});
test('local CSV covariance and statistics',()=>{const rows=X.parseCSV('t_ns,E_eV,x_mm,y_mm\n1,1,0,0\n2,2,3,4\n3,3,0,0'),s=X.analyzeSamples(rows);assert.equal(s.count,3);close(s.correlation,1);close(s.covariance_ns_eV,1);close(s.radial_rms_mm,Math.sqrt(25/3));});
test('unsafe CSV rejects malformed/oversized inputs',()=>{assert.throws(()=>X.parseCSV('t_ns,E_eV\n1,2\n3,4'));assert.throws(()=>X.parseCSV('t_ns,E_eV\n1,2\n3,\n4,5'));assert.throws(()=>X.parseCSV('t_ns,E_eV\n1,2\n3,4,5\n4,5'));});

test('motion uses actual time for fractional RF cycles and preserves initial velocity',()=>{
 const p={a:0,q:0,r0_mm:100,cycles:1.137,x_mm:.2,y_mm:-.1,vx_mm_per_tau:.3,vy_mm_per_tau:-.2,steps_per_rf_cycle:64};
 const run=X.motion(p),last=run.samples.at(-1),tau=Math.PI*p.cycles;
 close(last.cycle,p.cycles);close(last.tau,tau);close(last.x_mm,p.x_mm+p.vx_mm_per_tau*tau);close(last.y_mm,p.y_mm+p.vy_mm_per_tau*tau);
 close(last.vx_mm_per_tau,.3);close(last.vy_mm_per_tau,-.2);assert.equal(run.integration_steps,Math.ceil(p.cycles*64));
 close(run.effective_steps_per_rf_cycle,Math.ceil(p.cycles*64)/p.cycles);
});
test('circular aperture checks diagonal launch at t=0 and retains launch sample',()=>{
 const run=X.motion({a:0,q:.3,r0_mm:5,cycles:2,x_mm:4,y_mm:4});
 assert.equal(run.alive,false);assert.equal(run.loss_cycle,0);assert.equal(run.integration_steps,0);assert.equal(run.samples.length,1);close(run.samples[0].r_mm,Math.sqrt(32));
});
test('first detected loss is included even before sampling stride',()=>{
 const run=X.motion({a:0,q:0,r0_mm:1,cycles:1.137,x_mm:.999,y_mm:0,vx_mm_per_tau:1,steps_per_rf_cycle:64});
 assert.equal(run.alive,false);assert.equal(run.integration_steps,1);assert.equal(run.samples.length,2);
 const last=run.samples.at(-1);assert.ok(last.r_mm>=1);close(last.cycle,run.loss_cycle);close(last.cycle,1.137/Math.ceil(1.137*64));
});
test('RK4 converges at fourth order against nonzero analytic harmonic motion',()=>{
 const p={a:1,q:0,r0_mm:5,cycles:1.73,x_mm:.2,y_mm:0,vx_mm_per_tau:.1},tau=Math.PI*p.cycles;
 const exact=[.2*Math.cos(tau)+.1*Math.sin(tau),-.2*Math.sin(tau)+.1*Math.cos(tau)];
 const errors=[32,64,128].map(steps=>{
  const r=X.motion({...p,steps_per_rf_cycle:steps}).samples.at(-1);
  return Math.hypot(r.x_mm-exact[0],r.vx_mm_per_tau-exact[1]);
 });
 assert.ok(errors[0]/errors[1]>12&&errors[1]/errors[2]>12);assert.ok(errors[2]<1e-8);
 assert.throws(()=>X.motion({...p,steps_per_rf_cycle:48}));
});
test('nonzero Mathieu trajectory converges with finer RF integration',()=>{
 const p={a:0,q:.4,r0_mm:5,cycles:5.31,x_mm:.4,y_mm:-.2,vx_mm_per_tau:.1,vy_mm_per_tau:.03};
 const r=[32,64,128].map(steps=>X.motion({...p,steps_per_rf_cycle:steps}).samples.at(-1));
 const distance=(a,b)=>Math.hypot(a.x_mm-b.x_mm,a.y_mm-b.y_mm,a.vx_mm_per_tau-b.vx_mm_per_tau,a.vy_mm_per_tau-b.vy_mm_per_tau);
 assert.ok(distance(r[0],r[1])>10*distance(r[1],r[2]));assert.ok(distance(r[1],r[2])<1e-5);
});
test('all four scan axes follow independent parameter scaling and units',()=>{
 const p={mass_u:100,charge:1,U_V:1,V_rod_peak_V:100,r0_mm:5,f_MHz:1,count:3};
 const ranges={voltage:[100,200,2,4],frequency:[1,2,.25,.25],radius:[5,10,.25,.25],mass:[100,200,.5,.5]};
 for(const [axis,[min,max,qScale,depthScale]] of Object.entries(ranges)){
  const scan=X.parameterScan({...p,axis,min,max},M),lo=scan.rows[0],hi=scan.rows.at(-1);
  close(lo.scan_value,min);close(hi.scan_value,max);close(hi.q/lo.q,qScale);close(hi.rf_only_depth_eV/lo.rf_only_depth_eV,depthScale);
  close(lo.q,.39104032245526095,1e-8);close(lo.rf_only_depth_eV,9.776008061381523,1e-8);
  assert.ok(scan.scan_unit);assert.ok(scan.rows.every(r=>Number.isFinite(r.a)&&Number.isFinite(r.q)));
 }
 assert.throws(()=>X.parameterScan({...p,axis:'frequency',min:0,max:1},M));
 assert.throws(()=>X.parameterScan({...p,axis:'other',min:1,max:2},M));
});
test('bunch states small-spread applicability without claiming formal widths are predictions',()=>{
 const p={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:20,rho:0};
 const a=X.bunch({...p,sigma_E_eV:1}),b=X.bunch({...p,sigma_E_eV:20});
 close(a.relative_energy_spread,.01);assert.equal(a.valid_linearization,true);assert.deepEqual(a.warnings,[]);
 close(b.relative_energy_spread,.2);assert.equal(b.valid_linearization,false);assert.match(b.warnings.join(' '),/not a reliable prediction/);
});
test('covariance near an exact focus avoids catastrophic cancellation',()=>{
 const p={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:1e7,sigma_E_eV:0,rho:1};
 const g=X.bunch(p).dt_dE_ns_per_eV,se=p.sigma_t_ns*(1+1e-8)/(-g),r=X.bunch({...p,sigma_E_eV:se});
 const expected=Math.abs(p.sigma_t_ns+g*se);assert.ok(expected>.09&&expected<.11);close(r.sigma_t_out_ns,expected,1e-12);
 const focused=X.bunch({...p,sigma_E_eV:p.sigma_t_ns/(-g)});assert.ok(focused.sigma_t_out_ns<1e-8);
});
test('CSV roundtrips quoted export with BOM and CRLF',()=>{
 const original=[{t_ns:1,E_eV:2,x_mm:-.3,y_mm:4},{t_ns:2,E_eV:4,x_mm:.2,y_mm:0},{t_ns:3,E_eV:6,x_mm:0,y_mm:1}];
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"',keys=Object.keys(original[0]);
 const csv='\uFEFF'+[keys.map(quote).join(','),...original.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n')+'\r\n';
 assert.deepEqual(X.parseCSV(csv),original);
});
test('CSV accepts escaped quoted metadata and scientific numeric notation',()=>{
 const csv='"t_ns","E_eV","note"\r\n"1e2","2.5","a,b"\r\n"2e2","3.5","say ""hi"""\r\n"3e2","4.5","two\nlines"\r\n';
 assert.deepEqual(X.parseCSV(csv),[{t_ns:100,E_eV:2.5},{t_ns:200,E_eV:3.5},{t_ns:300,E_eV:4.5}]);
});
test('CSV rejects duplicate headers, broken quoting, nondecimal and negative energy',()=>{
 for(const csv of [
  't_ns,E_eV,T_NS\n1,2,1\n2,3,2\n3,4,3',
  't_ns,E_eV\n"1"x,2\n2,3\n3,4',
  't_ns,E_eV\n1,2\n2,3\n"3,4',
  't_ns,E_eV\n1,2\n2,3\n3"x,4',
  't_ns,E_eV\n0xFF,2\n2,3\n3,4',
  't_ns,E_eV\n1,-2\n2,3\n3,4'
 ])assert.throws(()=>X.parseCSV(csv));
});

test('3D RFQ motion preserves exact free axial drift and leaves transverse dynamics unchanged',()=>{
 const p={a:0,q:.2,r0_mm:5,cycles:3.137,x_mm:.2,y_mm:.1,vx_mm_per_tau:.03,vy_mm_per_tau:-.02};
 const xy=X.motion(p),xyz=X.motion({...p,z_mm:-2,vz_mm_per_tau:.4});
 assert.equal(xyz.axial_model,'free drift; no axial electric field');assert.equal(xyz.alive,xy.alive);
 assert.equal(xyz.samples.length,xy.samples.length);
 xyz.samples.forEach((row,i)=>{
  close(row.z_mm,-2+.4*row.tau);close(row.vz_mm_per_tau,.4);
  for(const key of ['x_mm','y_mm','vx_mm_per_tau','vy_mm_per_tau','r_mm'])assert.equal(row[key],xy.samples[i][key]);
 });
 // tau = pi*f_MHz*t_us, so velocity entry in mm/us has this conversion.
 const fMHz=2.5,vz=.7,run=X.motion({...p,z_mm:1,vz_mm_per_tau:vz/(Math.PI*fMHz)});
 for(const row of run.samples)close(row.z_mm,1+vz*row.cycle/fMHz);
});
test('RF running means use full centered windows and never invent endpoint values',()=>{
 const p={a:0,q:0,r0_mm:100,cycles:2.137,x_mm:1,y_mm:2,z_mm:3,vx_mm_per_tau:.1,vy_mm_per_tau:-.2,vz_mm_per_tau:.3};
 const run=X.motion(p);assert.equal(run.average_window_cycles,1);assert.equal(run.secular_approx_valid,false);
 for(const row of run.samples){
  const full=row.cycle>=.5-1e-12&&row.cycle<=run.completed_cycles-.5+1e-12;
  for(const axis of ['x','y','z']){
   if(full){close(row[axis+'_rf_average_mm'],row[axis+'_mm']);close(row[axis+'_rf_residual_mm'],0);}
   else{assert.equal(row[axis+'_rf_average_mm'],null);assert.equal(row[axis+'_rf_residual_mm'],null);}
  }
 }
 const short=X.motion({...p,cycles:.7});assert.ok(short.samples.every(r=>r.x_rf_average_mm===null));
});
test('RF period averaging agrees with an independent harmonic integral',()=>{
 const run=X.motion({a:1,q:0,r0_mm:5,cycles:4,x_mm:.2,y_mm:0,vx_mm_per_tau:.1,steps_per_rf_cycle:128});
 let compared=0;
 for(const row of run.samples)if(row.x_rf_average_mm!==null){
  const exact=(2/Math.PI)*(.2*Math.cos(row.tau)+.1*Math.sin(row.tau));
  assert.ok(Math.abs(row.x_rf_average_mm-exact)<1e-5);compared++;
  close(row.x_rf_average_mm+row.x_rf_residual_mm,row.x_mm);
 }
 assert.ok(compared>50);assert.equal(run.secular_approx_valid,false);
});
test('slow-motion interpretation is explicitly restricted and raw plus filtered residual is conserved',()=>{
 const p={a:0,q:.2,r0_mm:5,cycles:3,x_mm:.4,y_mm:.1};
 const low=X.motion(p);assert.equal(low.secular_approx_valid,true);
 assert.equal(X.motion({...p,q:.6}).secular_approx_valid,false);
 assert.equal(X.motion({...p,a:.01}).secular_approx_valid,false);
 for(const row of low.samples)if(row.x_rf_average_mm!==null)for(const axis of ['x','y','z'])close(row[axis+'_rf_average_mm']+row[axis+'_rf_residual_mm'],row[axis+'_mm']);
 assert.match(low.assumptions.join(' '),/not an exact secular\/micromotion decomposition/);
});

test('near a time focus, second-order Gaussian energy curvature is reported separately',()=>{
 const p={mass_u:100,charge:1,acceleration_V:100,drift_m:1,sigma_t_ns:0,sigma_E_eV:1,rho:1};
 const flight=X.bunch(p),st=-flight.dt_dE_ns_per_eV*p.sigma_E_eV,r=X.bunch({...p,sigma_t_ns:st});
 assert.ok(r.relative_energy_spread<.1);assert.equal(r.near_focus_warning,true);assert.equal(r.valid_linearization,false);
 close(r.second_order_sigma_t_ns,3*r.flight_ns/(4*Math.sqrt(2))*.01**2);
 close(r.second_order_mean_shift_ns,3*r.flight_ns/8*.01**2);
 assert.ok(r.sigma_t_out_ns<1e-10,'formal first-order width remains separate');assert.ok(r.second_order_sigma_t_ns>0);
 assert.match(r.second_order_model,/not nonlinear Monte Carlo/);assert.match(r.warnings.join(' '),/near_first_order_time_focus/);
 const ordinary=X.bunch({...p,rho:0,sigma_t_ns:st});assert.equal(ordinary.near_focus_warning,false);assert.equal(ordinary.valid_linearization,true);
 const exact=X.bunch({...p,sigma_E_eV:0});assert.equal(exact.near_focus_warning,false);assert.equal(exact.second_order_sigma_t_ns,0);
});
