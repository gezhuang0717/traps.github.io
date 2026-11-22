/* Browser-only RFQ extensions. One shared ion/RF point, honest model boundaries.
   Deliberately avoids network requests, telemetry, persistent storage and remote uploads. */
(function(){'use strict';
const X=window.ZGRFQExtras,M=window.ZGMathieu,H=window.ZGRFQWorkbench;
if(!X||!M||!H)return;
const root=document.querySelector('#rfq-workbench');
if(!root||root.dataset.extrasReady)return;root.dataset.extrasReady='true';
const f=name=>root.querySelector('[name="'+name+'"]');
const v=name=>{const e=f(name);if(!e||!String(e.value).trim())throw Error(name);const x=Number(e.value);if(!Number.isFinite(x))throw Error(name);return x;};
const labels=JSON.parse(root.dataset.extrasLabels||'{}');
const msg=(key,fallback)=>labels[key]||fallback;
const escapeCSV=s=>'"'+String(s??'').replaceAll('"','""')+'"';
const save=(content,name,type)=>{const blob=new Blob([content],{type});if(window.zgExport?.save){window.zgExport.save(blob,name);return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);};
let latest={},localRows=null,debounce=null;
const source=()=>{
 const mass=v('ms-mass'),charge=v('ms-charge'),r0=v('ms-r0'),fMHz=v('ms-f');
 if(!Number.isInteger(charge)||charge<1||mass<=0||r0<=0||fMHz<=0)throw Error('ion');
 const direct=f('ms-mode').value==='direct'||f('ms-geometry').value==='paul3d';
 let p,rodPeak;
 if(direct){p={a:v('ms-a'),q:v('ms-q')};rodPeak=null;}
 else{rodPeak=H.toRodPeak(v('ms-V'),f('ms-voltage-convention').value);p=M.parameters(mass,charge,v('ms-U'),rodPeak,r0,fMHz);}
 return{mass,charge,r0,fMHz,direct,rodPeak,p,geometry:f('ms-geometry').value};
};
const nice=x=>Number.isFinite(x)?Number(x.toPrecision(7)).toString():'—';
const ns='http://www.w3.org/2000/svg';
function el(type,attrs={},label){const o=document.createElementNS(ns,type);Object.entries(attrs).forEach(([k,v])=>o.setAttribute(k,String(v)));if(label!=null)o.textContent=label;return o;}
function plot(series,title,xlabel,ylabel,scatter=false){
 const samples=series.flatMap(s=>s.rows),w=820,h=355,l=76,r=24,t=44,b=72;
 if(!samples.length)return null;
 let xmin=Math.min(...samples.map(x=>x.x)),xmax=Math.max(...samples.map(x=>x.x)),ymin=Math.min(...samples.map(x=>x.y)),ymax=Math.max(...samples.map(x=>x.y));
 if(!Number.isFinite(xmin+xmax+ymin+ymax))throw Error('plot');
 if(xmax===xmin){xmin-=1;xmax+=1;}if(ymax===ymin){ymin-=1;ymax+=1;}
 const dx=(xmax-xmin)*.06,dy=(ymax-ymin)*.1;xmin-=dx;xmax+=dx;ymin-=dy;ymax+=dy;
 const Xp=x=>l+(x-xmin)/(xmax-xmin)*(w-l-r),Yp=y=>t+(ymax-y)/(ymax-ymin)*(h-t-b);
 const svg=el('svg',{xmlns:ns,viewBox:'0 0 '+w+' '+h,width:w,height:h,role:'img','aria-label':title,style:'font-family:Arial,sans-serif;background:white;color:#18243a'});
 svg.append(el('rect',{x:0,y:0,width:w,height:h,fill:'#fff'}),el('text',{x:w/2,y:26,'text-anchor':'middle','font-size':18,fill:'#15243c'},title));
 for(let k=0;k<=4;k++){
  const x=l+(w-l-r)*k/4,y=t+(h-t-b)*k/4;
  svg.append(el('line',{x1:x,y1:t,x2:x,y2:h-b,stroke:'#e4eaf0'}),el('line',{x1:l,y1:y,x2:w-r,y2:y,stroke:'#e4eaf0'}));
  svg.append(el('text',{x,y:h-b+21,'text-anchor':'middle','font-size':12,fill:'#42516a'},nice(xmin+(xmax-xmin)*k/4)));
  svg.append(el('text',{x:l-9,y:y+4,'text-anchor':'end','font-size':12,fill:'#42516a'},nice(ymax-(ymax-ymin)*k/4)));
 }
 svg.append(el('text',{x:w/2,y:h-12,'text-anchor':'middle','font-size':14,fill:'#14243c'},xlabel));
 svg.append(el('text',{transform:'translate(21 '+h/2+') rotate(-90)','text-anchor':'middle','font-size':14,fill:'#14243c'},ylabel));
 series.forEach((s,i)=>{
  const color=['#2966c1','#d46c39','#208b76','#853db9'][i%4],points=s.rows.map(q=>[Xp(q.x),Yp(q.y)]);
  if(!scatter)svg.append(el('polyline',{points:points.map(q=>q.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2.3,'stroke-linejoin':'round'}));
  else for(const [x,y]of points)svg.append(el('circle',{cx:x,cy:y,r:3.7,fill:color,opacity:.75}));
  svg.append(el('line',{x1:l+i*185,y1:h-44,x2:l+i*185+22,y2:h-44,stroke:color,'stroke-width':3}));
  svg.append(el('text',{x:l+i*185+28,y:h-39,'font-size':12,fill:'#14243c'},s.name));
 });return svg;
}
const lineRows=(lines)=>lines.map(([k,val])=>k+': '+(typeof val==='number'?nice(val):val)).join('\n');
const panels=['motion','gas','bunch','scan','data'];
function render(kind){
 const out=root.querySelector('[data-rfx-output="'+kind+'"]'),chart=root.querySelector('[data-rfx-figure="'+kind+'"]'),err=root.querySelector('[data-rfx-error="'+kind+'"]');if(!out||!chart)return;
 out.textContent='';chart.replaceChildren();err.textContent='';delete latest[kind];
 try{
  const s=source();let report,svg,rows=[];
  if(kind==='motion'){
   if(s.geometry!=='linear')throw Error('4-rod linear reference only');
   const q=s.p.q,a=s.p.a,run=X.motion({a,q,r0_mm:s.r0,cycles:v('rx-cycles'),x_mm:v('rx-x'),y_mm:v('rx-y'),phase_rad:v('rx-phase')});
   rows=run.samples;report={...run,shared:{mass_u:s.mass,charge:s.charge,a,q,mode:s.direct?'direct-aq':'voltage'}};
   out.textContent=lineRows([['a',a],['q',q],['Model',run.model],['Radial aperture survival',run.alive?'yes (ideal finite time)':'no'],['First loss cycle',run.loss_cycle??'not observed'],['Sampled points',rows.length]]);
   svg=plot([{name:'x (mm)',rows:rows.map(p=>({x:p.cycle,y:p.x_mm}))},{name:'y (mm)',rows:rows.map(p=>({x:p.cycle,y:p.y_mm}))}],'Ideal Mathieu transverse motion','RF cycles','Position (mm)');
  }else if(kind==='gas'){
   report=X.cooling({mass_u:s.mass,gas_mass_u:v('rx-gas_mass'),temperature_K:v('rx-T'),pressure_mbar:v('rx-p'),cross_section_A2:v('rx-sigma'),energy_eV:v('rx-E'),residence_ms:v('rx-ms'),transfer_efficiency:v('rx-eta')});
   rows=report.points;out.textContent=lineRows([['Number density (m⁻³)',report.density_m3],['Collision proxy rate (s⁻¹)',report.collision_rate_s],['Relaxation time (ms)',report.tau_ms??'∞'],['Energy floor (eV)',report.energy_floor_eV],['Estimated final energy (eV)',report.estimated_energy_eV],['Model',report.model]]);
   svg=plot([{name:'energy',rows:rows.map(p=>({x:p.t_ms,y:p.energy_eV}))}],'Gas energy-relaxation proxy','Residence (ms)','Mean energy (eV)');
  }else if(kind==='bunch'){
   const b=X.bunch({mass_u:s.mass,charge:s.charge,acceleration_V:v('rx-V'),drift_m:v('rx-L'),sigma_t_ns:v('rx-st'),sigma_E_eV:v('rx-sE'),rho:v('rx-rho')});
   const invent=X.inventory({ion_rate_s:v('rx-rate'),hold_ms:v('rx-hold'),lifetime_ms:v('rx-life'),capacity:v('rx-capacity'),extraction_fraction:v('rx-eff')});
   report={bunch:b,inventory:invent};rows=b.scan;
   out.textContent=lineRows([['Drift energy (eV)',b.energy_eV],['Flight time (ns)',b.flight_ns],['dt/dE (ns/eV)',b.dt_dE_ns_per_eV],['Covariance (ns·eV)',b.covariance_ns_eV],['Gaussian FWHM (ns)',b.fwhm_out_ns],['Stored ions (expected)',invent.captured_ions],['Delivered ions (expected)',invent.delivered_ions],['Model',b.model]]);
   svg=plot([{name:'Gaussian FWHM',rows:rows.map(p=>({x:p.rho,y:p.fwhm_ns}))}],'Ideal time–energy covariance scan','Input correlation ρ','Gaussian FWHM (ns)');
  }else if(kind==='scan'){
   if(s.geometry!=='linear'||s.direct)throw Error('scan requires linear voltage mode');
   report=X.voltageScan({mass_u:s.mass,charge:s.charge,U_V:v('ms-U'),r0_mm:s.r0,f_MHz:s.fMHz,min_V:v('rx-vmin'),max_V:v('rx-vmax'),count:v('rx-count')},M);
   rows=report.rows;
   const stable=rows.filter(r=>r.classification==='stable').length;
   out.textContent=lineRows([['Scan points',rows.length],['Stable ideal points',stable],['Unstable/outside/boundary',rows.length-stable],['Voltage definition','single-rod RF peak'],['Model',report.model]]);
   svg=plot([{name:'Mathieu q',rows:rows.map(p=>({x:p.voltage_rod_peak_V,y:p.q}))}],'Ideal RF scan','Single-rod peak V','Mathieu q');
  }else if(kind==='data'){
   if(!localRows){out.textContent=msg('no_data','Choose a local CSV');return;}
   report=X.analyzeSamples(localRows);rows=localRows;
   out.textContent=lineRows([['Events',report.count],['Mean TOF (ns)',report.mean_t_ns],['Sample σ(t) (ns)',report.sigma_t_ns],['Gaussian-equivalent FWHM (ns)',report.gaussian_equivalent_fwhm_ns],['Sample σ(E) (eV)',report.sigma_E_eV],['Cov(t,E) (ns·eV)',report.covariance_ns_eV],['Correlation',report.correlation??'undefined'],['Radial RMS (mm)',report.radial_rms_mm??'not provided'],['Model',report.model]]);
   svg=plot([{name:'local t–E events',rows:rows.slice(0,3000).map(p=>({x:p.t_ns,y:p.E_eV}))}],'Local table: time vs energy','TOF (ns)','Energy (eV)',true);
  }
  if(svg)chart.append(svg);
  latest[kind]={report,rows,svg};
 }catch(e){err.textContent=msg('bad','Invalid inputs')+' ('+e.message+')';}
}
async function exportKind(kind,action){
 render(kind);const result=latest[kind];if(!result)return;
 if(action==='json')save(JSON.stringify({schema:'rfq-browser-workbench-v1',kind,generated_utc:new Date().toISOString(),model_evidence:'analytical-or-numerical-browser-only',result:result.report},null,2)+'\n','rfq-'+kind+'-model.json','application/json');
 if(action==='csv'){
  if(!result.rows.length)return;const cols=Object.keys(result.rows[0]),text=[cols.map(escapeCSV).join(','),...result.rows.map(row=>cols.map(k=>escapeCSV(row[k])).join(','))].join('\n')+'\n';
  save(text,'rfq-'+kind+'-model.csv','text/csv');
 }
 if(['svg','png','pdf'].includes(action)&&result.svg){
  // Encode traceability, not raw locally loaded CSV contents, in exported figure metadata.
  const provenance={
   schema:'rfq-browser-figure-v1',kind,model_evidence:'browser-only educational model',
   model:result.report.model || result.report.bunch?.model || 'local sample statistics',
   limits:'No measured transmission, 3D electrode fields or native SIMION simulation',
   generated_utc:new Date().toISOString()
  };
  if(window.ZGFigureStyle){
   try{await window.ZGFigureStyle.exportSVG(result.svg,action.toUpperCase(),'rfq-'+kind+'-figure',undefined,provenance);}
   catch(e){const box=root.querySelector('[data-rfx-error="'+kind+'"]');if(box)box.textContent=msg('bad','Export unavailable')+' ('+e.message+')';}
  }else if(action==='svg'){
   save(new XMLSerializer().serializeToString(result.svg),'rfq-'+kind+'-figure.svg','image/svg+xml');
  }else{
   const box=root.querySelector('[data-rfx-error="'+kind+'"]');if(box)box.textContent=msg('bad','Export unavailable')+' (figure exporter unavailable)';
  }
 }
}
let useTimer=()=>{clearTimeout(debounce);debounce=setTimeout(()=>panels.filter(k=>k!=='data').forEach(render),160);};
root.addEventListener('input',e=>{if(e.target.matches?.('[name^="ms-"],[name^="rx-"]'))useTimer();});
root.addEventListener('change',e=>{if(e.target.matches?.('[name^="ms-"],[name^="rx-"]'))useTimer();});
root.addEventListener('click',e=>{const btn=e.target.closest?.('[data-rfx-action]');if(!btn||!root.contains(btn))return;const kind=btn.dataset.rfxKind,action=btn.dataset.rfxAction;if(!panels.includes(kind))return;if(action==='run')render(kind);else exportKind(kind,action);});
const picker=root.querySelector('[data-rfx-file]');if(picker)picker.addEventListener('change',async e=>{
 const file=e.target.files?.[0],error=root.querySelector('[data-rfx-error="data"]');
 if(!file)return;try{
  if(file.size>1500000)throw Error('file too large (>1.5 MB)');
  localRows=X.parseCSV(await file.text());render('data');
 }catch(ex){localRows=null;render('data');error.textContent=msg('bad','Bad input')+' ('+ex.message+')';}finally{picker.value='';}
});
panels.filter(k=>k!=='data').forEach(render);render('data');
})();
