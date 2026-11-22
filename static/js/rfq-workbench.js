/* RFQ input conventions and portable settings. All calculations use single-rod
   RF peak relative to the RF common mode, never the platform voltage.
   This module performs analytical bookkeeping, not field/trajectory simulation. */
(function(host){'use strict';
 const M=host.ZGMathieu||(typeof require==='function'?require('./mathieu-core.js'):null);
 const factors=Object.freeze({'rod-peak':1,'rod-pp':2,'differential-peak':2,'differential-pp':4});
 const voltageFields=Object.freeze({main:'ms-V',cooler:'ms-cooler-V',mf:'ms-mf-V',bun:'ms-bun-V',sigma:'ms-sigma-V'});
 const optional=new Set(['qmin','rod-count','rod-rule','rod-ratio','rod-radius','diameter-tolerance','radial-fraction','eta-target','vscan','voltage-convention','uncertainty-on','sigma-mass','sigma-V','sigma-r0','sigma-f']);
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function factor(convention){if(!Object.hasOwn(factors,convention))throw Error('voltage convention');return factors[convention];}
 function nonnegative(value){if(!finite(value)||value<0)throw Error('RF voltage');return value;}
 function toRodPeak(value,convention='rod-peak'){return nonnegative(value)/factor(convention);}
 function fromRodPeak(value,convention='rod-peak'){const result=nonnegative(value)*factor(convention);if(!finite(result))throw Error('RF voltage range');return result;}
 function conversions(peak){return Object.fromEntries(Object.keys(factors).map(c=>[c,fromRodPeak(peak,c)]));}
 function sourceForInputs(source,inputs,manualLabel){
  // An imported name alone is not a catalogue lookup. Keep attribution only
  // when both numerical ion mass and charge match the recorded lookup.
  if(!source||typeof source!=='object'||typeof source.label!=='string'||source.label.length>300||
     !finite(source.ionMassU)||source.ionMassU!==Number(inputs['ms-mass'])||
     !source.metadata||!Number.isInteger(source.metadata.q)||source.metadata.q!==Number(inputs['ms-charge']))return{label:manualLabel};
  return JSON.parse(JSON.stringify(source));
 }
 function normalizeSettings(raw,defaults,manualLabel='User-entered ion mass'){
  const s=raw&&['traps-rfq-design-v1','traps-rfq-stages-v1'].includes(raw.schema)?raw.settings:raw;
  if(!s||!['traps-mathieu-v1','traps-mathieu-v2'].includes(s.schema)||!s.inputs||typeof s.inputs!=='object'||Array.isArray(s.inputs))throw Error('settings schema');
  for(const key of Object.keys(s.inputs))if(!Object.hasOwn(defaults,key))throw Error('settings field');
  for(const key of Object.keys(defaults))if(!optional.has(key.slice(3))&&!Object.hasOwn(s.inputs,key))throw Error('missing settings field');
  const inputs={...defaults,...s.inputs};
  for(const [key,v]of Object.entries(inputs)){
   if(typeof defaults[key]==='boolean'){if(typeof v!=='boolean')throw Error('settings boolean');}
   else if(!['number','string'].includes(typeof v)||String(v).length>500)throw Error('settings value');
  }
  if(!Object.hasOwn(s.inputs,'ms-rod-rule')&&Object.hasOwn(s.inputs,'ms-rod-radius'))inputs['ms-rod-rule']='radius';
  const convention=s.schema==='traps-mathieu-v1'?'rod-peak':s.voltage?.convention;
  factor(convention);if(Object.hasOwn(inputs,'ms-voltage-convention'))inputs['ms-voltage-convention']=convention;
  const peaks={};
  for(const [key,name]of Object.entries(voltageFields)){
   if(!Object.hasOwn(inputs,name))continue;
   if(String(inputs[name]).trim()==='')throw Error('blank RF voltage');
   const computed=toRodPeak(Number(inputs[name]),convention);
   if(s.schema==='traps-mathieu-v2'){
    const stored=s.voltage?.rod_peak_V?.[key];nonnegative(stored);
    if(Math.abs(stored-computed)>16*Number.EPSILON*Math.max(1,stored,computed))throw Error('voltage settings mismatch');
    peaks[key]=stored;
   }else peaks[key]=computed;
   inputs[name]=String(fromRodPeak(peaks[key],convention));
  }
  return{schema:'traps-mathieu-v2',inputs,voltage:{convention,rod_peak_V:peaks},source:sourceForInputs(s.source,inputs,manualLabel),style:s.style||null};
 }
 function uncertainty(input,sigma){
  const p=M.parameters(input.mass_u,input.charge,input.U_V,input.V_rod_peak_V,input.r0_mm,input.f_MHz);
  const names=['mass_u','V_rod_peak_V','r0_mm','f_MHz'];
  for(const key of names)if(!finite(sigma[key])||sigma[key]<0)throw Error('uncertainty');
  // dq/dV is evaluated without division by V, including the V=0 limit.
  const dV=M.parameters(p.mass_u,p.charge,p.U_V,1,p.r0_mm,p.f_MHz).q;
  const derivative={mass_u:-p.q/p.mass_u,V_rod_peak_V:dV,r0_mm:-2*p.q/p.r0_mm,f_MHz:-2*p.q/p.f_MHz};
  const contributions=names.map(key=>({input:key,sigma:sigma[key],derivative:derivative[key],variance:(derivative[key]*sigma[key])**2}));
  const variance=contributions.reduce((sum,c)=>sum+c.variance,0);
  if(!finite(variance))throw Error('uncertainty range');
  for(const c of contributions)c.variance_fraction=variance?c.variance/variance:0;
  return{model:'first-order-independent-inputs',q:p.q,sigma_q:Math.sqrt(variance),relative_sigma_q:p.q?Math.sqrt(variance)/p.q:null,
   sensitivities:{mass_u:-1,V_rod_peak_V:1,r0_mm:-2,f_MHz:-2},contributions,
   assumptions:'Independent absolute 1-sigma input uncertainties; charge is exact. Zero sigma means treated as exact. No covariance, geometry-model error, higher-order terms or stability probability. Linearization may fail for large relative errors.'};
 }
 const api={factors,voltageFields,toRodPeak,fromRodPeak,conversions,normalizeSettings,sourceForInputs,uncertainty};
 host.ZGRFQWorkbench=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
