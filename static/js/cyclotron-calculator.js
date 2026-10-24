/* Multi-species cyclotron calculations. Reuses physics.js AME2020/NUBASE2020
   primitives; no natural-isotope guesses, mass adjustment or binding model. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./physics.js'):root.ZGPhysics);if(typeof module==='object'&&module.exports)module.exports=api;else root.TrapsCyclotron=api;})(typeof globalThis!=='undefined'?globalThis:this,function(P){
  'use strict';
  const SCHEMA='traps-cyclotron-v1',POLICIES=['online-first','saved-only','online-only'];
  function fail(code,detail=''){const e=new RangeError(code);e.code=code;e.detail=detail;throw e;}
  function number(value){if(value==null||typeof value==='boolean'||String(value).trim()==='')fail('NUMBER');const n=Number(value);if(!Number.isFinite(n))fail('NUMBER');return n;}
  function sigma(value){if(value==null||String(value).trim()==='')return null;const n=number(value);if(n<0)fail('SIGMA');return n;}
  function normalize(text){const superDigits='⁰¹²³⁴⁵⁶⁷⁸⁹';return String(text??'').trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,c=>String(superDigits.indexOf(c))).replace(/[⁺]/g,'+').replace(/[⁻−]/g,'-').normalize('NFKC').replace(/\s+/g,'');}
  function aliases(table){const map=new Map();for(const e of table?.elements||[]){for(const n of [e.sym,...Object.values(e.names||{})])map.set(normalize(n).toLowerCase(),e.sym);}if(map.has('caesium'))map.set('cesium',map.get('caesium'));if(map.has('aluminium'))map.set('aluminum',map.get('aluminium'));return map;}
  function chargeText(input,override){let text=normalize(input),q=null,m;if(text.length>160||!text)fail('SPECIES');
    if((m=/:([+-]?\d+)e$/i.exec(text))){q=-Number(m[1]);text=text.slice(0,m.index);}
    else if((m=/:([+-]?\d+)$/.exec(text))){q=Number(m[1]);text=text.slice(0,m.index);}
    else if((m=/\^(?:(\d+)([+-])|([+-])(\d*)|([+-]))$/.exec(text))){q=Number(m[1]||m[4]||1)*((m[2]||m[3]||m[5])==='-'?-1:1);text=text.slice(0,m.index);}
    else if((m=/\](\d+)([+-])$/.exec(text))){q=Number(m[1])*(m[2]==='-'?-1:1);text=text.slice(0,m.index+1);}
    else if((m=/([+-])(\d+)$/.exec(text))&&(/\d/.test(text.slice(0,m.index))||m[1]==='+')){q=Number(m[2])*(m[1]==='-'?-1:1);text=text.slice(0,m.index);}
    else if(/[+-]$/.test(text)){q=text.endsWith('-')?-1:1;text=text.slice(0,-1);if(/\d$/.test(text))fail('AMBIGUOUS','Use ^2+, :+2, or the charge field; isotope count and charge are ambiguous.');}
    const explicit=override!=null&&String(override).trim()!==''?number(override):null;
    if(q!==null&&explicit!==null&&q!==explicit)fail('CHARGE_CONFLICT');q=explicit??q??1;
    if(!Number.isInteger(q)||q===0||Math.abs(q)>100)fail('CHARGE');return {text,q};
  }
  function parse(input,override,cat,nameMap=new Map()){
    const parsed=chargeText(input,override);let text=parsed.text;if(text.startsWith('[')&&text.endsWith(']'))text=text.slice(1,-1);
    function atomToken(token){let count=1,m;if((m=/^(\d+)\*(.+)$/.exec(token))){count=Number(m[1]);token=m[2];}else if((m=/^(.+)\*(\d+)$/.exec(token))){token=m[1];count=Number(m[2]);}if(!Number.isInteger(count)||count<1||count>1000)fail('COUNT');
      let state=0;if((m=/\[([gmnpqrxij]|m\d+|\d+)\]$/i.exec(token))){const labels={g:0,m:1,n:2,p:3,q:4,r:5,x:6,i:8,j:9};state=m[1].toLowerCase().startsWith('m')&&m[1].length>1?Number(m[1].slice(1)):labels[m[1].toLowerCase()]??Number(m[1]);token=token.slice(0,m.index);}
      else if((m=/^(\d+)m(\d*)([^\d]+)$/.exec(token))){state=Number(m[2]||1);token=m[1]+m[3];}
      else if((m=/^(.+)m(\d*)$/.exec(token))&&/\d/.test(m[1])){const whole=/^(\d+)-?(.+)$/.exec(token),known=whole&&(nameMap.has(whole[2].toLowerCase())||/^[A-Z][a-z]?$/.test(whole[2]));if(!known){state=Number(m[2]||1);token=m[1];}}
      const match=/^(\d{1,3})-?([^\d]+)$/.exec(token)||/^([^\d]+?)-?(\d{1,3})$/.exec(token);if(!match)fail('SPECIES');const first=/^\d+$/.test(match[1]),A=Number(first?match[1]:match[2]),name=(first?match[2]:match[1]).replace(/^-|-$/g,''),symbol=nameMap.get(name.toLowerCase())||(/^[a-z]{1,2}$/i.test(name)?name[0].toUpperCase()+name.slice(1).toLowerCase():null);if(!symbol)fail('SPECIES');
      try{return {...cat.atom(A,symbol,state,'ame'),count};}catch(e){fail('STATE',e.message);}
    }
    let atoms;
    if(/[:+·*]/.test(text)){const parts=text.split(/[:+·]/);if(parts.some(x=>!x)||parts.length>16)fail('SPECIES');atoms=parts.map(atomToken);}
    else{try{atoms=[atomToken(text)];}catch(e){if(e.code==='STATE')throw e;try{if(text.length>64)fail('SPECIES');atoms=cat.resolve(text,{q:1}).atoms;}catch(err){fail(/Ambiguous/.test(err.message)?'AMBIGUOUS':e.code||'SPECIES',err.message);}}}
    if(!atoms.length||atoms.length>16)fail('COUNT');if(parsed.q>atoms.reduce((n,a)=>n+a.Z*a.count,0))fail('CHARGE');return {atoms,q:parsed.q};
  }
  function frequency(massU,q,B,sigmaM=null,sigmaB=null,convention='neutral'){
    const mass=number(massU),field=number(B),charge=number(q),sm=sigma(sigmaM),sb=sigma(sigmaB);
    if(!Number.isInteger(charge)||!charge||Math.abs(charge)>100)fail('CHARGE');if(!['neutral','ionic'].includes(convention)||!(mass>0)||!(field>0))fail('PHYSICAL');const ionMassU=mass-(convention==='neutral'?charge*P.C.electronU:0);if(!(ionMassU>0))fail('PHYSICAL');
    const signed=charge*P.C.e*field/(2*Math.PI*ionMassU*P.C.uKg),Hz=Math.abs(signed),uncertainty=sm===null||sb===null?null:Hz*Math.hypot(sm/ionMassU,sb/field);if(!Number.isFinite(Hz)||uncertainty!==null&&!Number.isFinite(uncertainty))fail('PHYSICAL');return {Hz,signed_frequency_Hz:signed,sigma_Hz:uncertainty,ion_mass_u:ionMassU,mass_sigma_u:sm,B_T:field,sigma_B_T:sb,q:charge,uncertainty_model:uncertainty===null?'unknown-incomplete-inputs':'independent mass/B marginals; constants fixed',mass_convention:convention};
  }
  function create(cat,options={}){
    const nameMap=aliases(options.periodic),online=new Map();let registryReady=null;
    async function ground(A,element,policy){const key=A+element.toLowerCase();if(!online.has(key)){const job=(async()=>{if(!options.research)fail('ONLINE');if(!registryReady&&options.research.list)registryReady=options.research.list();if(registryReady)await registryReady;const r=await options.research.load('livechart-ground-states',{policy:'online-only',query:{nuclides:key},timeoutMs:options.timeoutMs??5000}),row=r.data.records.find(x=>x.state.kind==='ground'&&x.values.massexcess!=null);if(!row)fail('MASS');return {r,row};})();online.set(key,job);job.catch(()=>{online.delete(key);registryReady=null;});}return online.get(key);}
    async function resolve(row,policy='online-first'){
      if(!POLICIES.includes(policy))fail('POLICY');if(row.auto===false){const q=chargeText(row.species||row.label||'manual',row.q).q,factor=row.unit==='keV'?P.C.uKeV:row.unit==='u'?1:null;if(factor===null)fail('UNIT');const value=number(row.mass)/factor,error=sigma(row.sigma);return {mass_u:value,sigma_u:error===null?null:error/factor,q,label:row.label||row.species||'manual',source:'user',components:[],provenance:{origin:'user',mass_convention:row.convention},value:P.primitive('user:'+String(row.id),value,error===null?null:error/factor)};}
      const parsed=parse(row.species,row.q,cat,nameMap),atoms=await Promise.all(parsed.atoms.map(async a=>{const base={...a,source_state_id:a.state.id,source_state_index:a.state.source_state_index,excitation:a.state.excitation};if(policy==='saved-only')return {...base,provenance:{origin:'saved-snapshot',source:a.source}};
        try{const {r,row:record}=await ground(a.A,a.state.element,policy),gs=cat.atom(a.A,a.state.element,0,'ame'),v=record.values.massexcess,e=record.uncertainties.massexcess??null,newGround=P.combine([1,P.constant(a.A)],[1/P.C.uKeV,P.primitive('IAEA-AME2020:'+gs.state.id,v,e,gs.value.est,gs.value.sigmaEst)]),value=P.combine([1,a.value],[-1,gs.value],[1,newGround]);return {...base,value,source:'IAEA / AME2020'+(a.state.source_state_index?' + NUBASE2020 excitation':''),provenance:{origin:'online-response',source:r.data.source,raw_sha256:r.data.raw_sha256,query:r.data.query,source_fields:record.source_fields,flags:record.flags}};}
        catch(e){if(policy==='online-only')throw e;return {...base,provenance:{origin:'saved-fallback',source:a.source,online_failure:String(e.message),detail:e.detail||null}};}}));
      const value=P.combine(...atoms.map(a=>[a.count,a.value]));return {mass_u:value.v,sigma_u:value.e,q:parsed.q,value,label:row.label||atoms.map(a=>a.label+(a.count>1?'×'+a.count:'')).join('·'),source:[...new Set(atoms.map(a=>a.source))].join('; '),estimated:value.est,uncertainty_extrapolated:value.sigmaEst,components:atoms.map(a=>({count:a.count,isotope:a.label,Z:a.Z,A:a.A,source_state_id:a.source_state_id,source_state_index:a.source_state_index,excitation:a.excitation,source:a.source,provenance:a.provenance})),provenance:{source:cat.metadata,policy,convention:'neutral atom masses plus NUBASE excitation; molecular binding and ionization/affinity energies omitted',uncertainty:'diagonal primitive covariance; repeated isotope coefficients combined; excitation/ground covariance unavailable'}};
    }
    async function batch(rows,{B,sigmaB=null,policy='online-first'}={}){if(!Array.isArray(rows)||rows.length<1||rows.length>10)fail('ROWS');if(!(number(B)>0))fail('PHYSICAL');sigma(sigmaB);return Promise.allSettled(rows.map(async row=>{const ion=await resolve(row,policy);return {...ion,frequency:frequency(ion.mass_u,ion.q,B,ion.sigma_u,sigmaB,row.auto===false?row.convention||'neutral':'neutral')};}));}
    return {resolve,batch,clearOnline(){online.clear();registryReady=null;}};
  }
  const jobs=new Map();
  function load(urls,{fetch=globalThis.fetch,timeoutMs=15000}={}){const key=JSON.stringify(urls);if(!jobs.has(key)){const job=(async()=>{const results=await Promise.allSettled(urls.map(async url=>{const c=new AbortController();let timer;try{const response=await Promise.race([fetch(url,{signal:c.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{c.abort();reject(Error('timeout'));},timeoutMs);})]);if(!response.ok)fail('LOAD');return await response.json();}finally{clearTimeout(timer);}}));if(results.some(r=>r.status==='rejected'))fail('LOAD');const [states,ame,periodic]=results.map(r=>r.value);if(states.source?.name!=='NUBASE2020'||ame.metadata?.name!=='AME2020')fail('EDITION');return {catalogue:P.catalogue(states,ame),periodic};})();jobs.set(key,job);job.catch(()=>jobs.delete(key));}return jobs.get(key);}
  function settings(value){if(!value||value.schema!==SCHEMA||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>10||!POLICIES.includes(value.policy))fail('SETTINGS');const B=String(value.B),sB=value.sigmaB==null?'':String(value.sigmaB);if(!(number(B)>0))fail('PHYSICAL');sigma(sB);const rows=value.rows.map((r,i)=>{if(!r||typeof r!=='object'||typeof r.auto!=='boolean'||!['u','keV'].includes(r.unit)||!['neutral','ionic'].includes(r.convention))fail('SETTINGS');const out={id:String(i+1),auto:r.auto,unit:r.unit,convention:r.convention};for(const k of ['species','label','q','mass','sigma']){if(typeof r[k]!=='string'||r[k].length>160)fail('SETTINGS');out[k]=r[k];}if(out.q.trim())chargeText('manual',out.q);if(!out.auto){const factor=out.unit==='keV'?P.C.uKeV:1;frequency(number(out.mass)/factor,chargeText(out.species||'manual',out.q).q,B,sigma(out.sigma)===null?null:sigma(out.sigma)/factor,sB,out.convention);}return out;});return {schema:SCHEMA,B,sigmaB:sB,policy:value.policy,rows};}
  function serialize(value){return JSON.stringify(settings(value),null,2);}
  function parseSettings(text){if(typeof text!=='string'||text.length>131072)fail('SETTINGS');let v;try{v=JSON.parse(text);}catch(e){fail('SETTINGS');}return settings(v);}
  return {SCHEMA,POLICIES,number,sigma,normalize,aliases,chargeText,parse,frequency,create,load,settings,serialize,parseSettings,constants:P.C};
});
