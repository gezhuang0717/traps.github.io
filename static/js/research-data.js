/* Validated online-first research data; no remote failure can replace good data. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrapsResearchData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  let registry = null;
  let baseURL = typeof document !== 'undefined' && document.currentScript ? new URL('../data/research-cache/', document.currentScript.src).href : 'http://localhost/data/research-cache/';
  const memory = new Map();
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/;
  function number(raw) {
    const text = raw == null ? '' : String(raw).trim();
    if (!text || text.includes('*')) return null;
    const cleaned = text.replace(/#/g, '.').replace(/[dD]/g, 'E');
    if (!numeric.test(cleaned)) return null;
    const value = Number(cleaned);
    if (!Number.isFinite(value)) throw new Error('Non-finite source value');
    return value;
  }
  function configure(value, options = {}) {
    if (!value || value.schema_version !== 1 || !Array.isArray(value.datasets) || !Array.isArray(value.sources)) throw new Error('Invalid research registry');
    registry = value;
    if (options.baseURL) baseURL = options.baseURL;
    memory.clear();
    return api;
  }
  function canonicalQuery(spec, override = {}) {
    if (Object.keys(override).some(k => !(spec.allowed_query || []).includes(k))) throw new Error('Unsupported query override');
    const query = {...spec.query};
    if (override.parents && !override.products) delete query.products;
    if (override.products && !override.parents) delete query.parents;
    for (const [key, value] of Object.entries(override)) query[key] = ['nuclides', 'parents', 'products', 'rad_types'].includes(key) ? String(value).toLowerCase() : String(value);
    if (spec.format === 'livechart-csv') {
      const field = query.fields;
      for (const key of ['nuclides', 'parents', 'products']) if (key in query && !(key === 'nuclides' && query[key] === 'all' && field === 'ground_states') && !/^[1-9]\d{0,2}[a-z]{1,3}$/.test(query[key])) throw new Error('Use a single nuclide such as 135xe');
      if (query.parents && !['232th', '233u', '235u', '238u', '237np', '239pu', '241pu', '241am'].includes(query.parents)) throw new Error('Unsupported fission parent');
      if (['decay_rads', 'bin_beta'].includes(field) && !(field === 'bin_beta' ? ['bp', 'bm'] : ['a', 'bp', 'bm', 'g', 'e', 'x']).includes(query.rad_types)) throw new Error('Unsupported radiation type');
      if (query.metastable_seqno && !/^[1-9]\d*$/.test(query.metastable_seqno)) throw new Error('Invalid metastable index');
    }
    return Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
  }
  function csv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') {cell += '"'; i++;} else quoted = !quoted; }
      else if (!quoted && (c === ',' || c === '\n')) {row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') {rows.push(row); row = [];}}
      else cell += c;
    }
    if (quoted) throw new Error('Malformed quoted CSV');
    if (cell || row.length) {row.push(cell.replace(/\r$/, '')); rows.push(row);}
    const header = rows.shift() || [];
    return {header, rows: rows.filter(r => r.some(v => v.trim())).map(r => {if (r.length !== header.length) throw new Error('Malformed CSV row'); return Object.fromEntries(header.map((key, i) => [key, r[i]]));})};
  }
  const uncertaintyColumns = {radius:'unc_r', abundance:'unc_a', energy:'unc_e', magnetic_dipole:'unc_md', electric_quadrupole:'unc_eq', half_life_sec:'unc_hls', massexcess:'unc_me', atomic_mass:'unc_am', binding:'unc_ba', intensity:'unc_i', relative_intensity:'unc_ri', start_level_energy:'unc_sle', end_level_energy:'unc_ele', p_energy:'unc_pe', q:'unc_q', dn_de:'unc_dn_de', dn_de_nu:'unc_dn_de_nu', cumulative_thermal_fy:'unc_ct', cumulative_fast_fy:'unc_cf', cumulative_14mev_fy:'unc_c14', independent_thermal_fy:'unc_it', independent_fast_fy:'unc_if', independent_14mev_fy:'unc_i14', qbm:'unc_qb', qbm_n:'unc_qbmn', qa:'unc_qa', qec:'unc_qec', sn:'unc_sn', sp:'unc_sp', b_e1:'unc_be1', b_e2:'unc_be2', b_m1:'unc_bm1', b_m2:'unc_bm2'};
  function normalizeLivechart(text, spec, query) {
    const parsed = csv(text.replace(/^\uFEFF/, '')), field = query.fields;
    const required = field.endsWith('_fy') ? ['z_daughter','a_daughter','daughter_level_idx'] : ['decay_rads','bin_beta'].includes(field) ? ['p_z','p_n','p_symbol'] : ['z','n','symbol'];
    if (required.some(k => !parsed.header.includes(k))) throw new Error('LiveChart error or unexpected CSV schema');
    return parsed.rows.map((raw, i) => {
      let Z, A, N, element, state;
      if (field.endsWith('_fy')) {
        Z = Number(raw.z_daughter); A = Number(raw.a_daughter); N = A-Z; element = raw.element_daughter;
        state = {kind:'source-state-index', id:raw.daughter_level_idx, parent:raw.a_parent+raw.element_parent};
      } else {
        const prefix = ['decay_rads','bin_beta'].includes(field) ? 'p_' : '';
        Z = Number(raw[prefix+'z']); N = Number(raw[prefix+'n']); A = Z+N; element = raw[prefix+'symbol'];
        const energy = number(raw[prefix ? 'p_energy' : 'energy']), shift = (raw[prefix ? 'p_energy_shift' : 'energy_shift'] || '').trim();
        state = {kind:shift ? 'unresolved' : energy === 0 ? 'ground' : energy == null ? 'unspecified' : 'excited', energy_keV:energy, energy_shift:shift, spin_parity:raw.jp || null, id:raw.idx || null};
        if (field === 'gammas') state = {kind:'transition', from_id:raw.start_level_idx, to_id:raw.end_level_idx, from_energy_keV:number(raw.start_level_energy), to_energy_keV:number(raw.end_level_energy)};
      }
      const values = Object.fromEntries(Object.entries(raw).filter(([k]) => !['Extraction_date','extraction_date'].includes(k)).map(([k,v]) => [k, number(v)]));
      const uncertainties = Object.fromEntries(Object.entries(uncertaintyColumns).filter(([k]) => k in raw).map(([k,v]) => [k, number(raw[v])]));
      if ('unc_en' in raw && 'energy' in raw) uncertainties.energy = number(raw.unc_en);
      const flags = {missing:Object.keys(values).filter(k => !String(raw[k] || '').trim()), operators:Object.fromEntries(Object.entries(raw).filter(([k,v]) => k.startsWith('operator_') && v))};
      if (raw.half_life) flags.half_life_uncertainty = 'ENSDF last-digit notation retained in source_fields; not independently decoded';
      return {id:String(i), nuclide:String(A)+element, A, Z, N, state, values, uncertainties, flags, source_fields:raw};
    });
  }
  function ameCell(raw) {return {value:number(raw), flag:{estimated:raw.includes('#'), missing:number(raw) == null, printed:raw.trim(), rounded_zero_possible:number(raw) === 0 && !!raw.trim()}};}
  function normalizeAME(text, edition) {
    const old = edition === 'ame1995', records = [];
    for (const [lineNo, original] of text.split(/\r?\n/).entries()) {
      if (!/^\s*\d+\s*$/.test(original.slice(4,9)) || !/^\s*\d+\s*$/.test(original.slice(9,14)) || !/^\s*\d+\s*$/.test(original.slice(14,19))) continue;
      const N=Number(original.slice(4,9)), Z=Number(original.slice(9,14)), A=Number(original.slice(14,19)), element=original.slice(20,23).trim();
      if (A !== N+Z || !element) continue;
      const line=original.padEnd(124), slices=old ? [[28,39],[39,48],[48,59],[59,68],[100,110],[110,119]] : [[28,41],[41,52],[52,63],[63,72],[100,112],[112,123]];
      const raw=slices.map(([a,b])=>line.slice(a,b).trim()), cells=raw.map(ameCell), massInteger=number(line.slice(96,99));
      const values={mass_excess_keV:cells[0].value, atomic_mass_u:cells[4].value == null || massInteger == null ? null : massInteger+cells[4].value/1e6, binding_energy_per_nucleon_keV:cells[2].value == null ? null : cells[2].value/(old ? A : 1)};
      const uncertainties={mass_excess_keV:cells[1].value, atomic_mass_u:cells[5].value == null ? null : cells[5].value/1e6, binding_energy_per_nucleon_keV:cells[3].value == null ? null : cells[3].value/(old ? A : 1)};
      const names=['mass_excess_keV','mass_excess_sigma','binding','binding_sigma','atomic_fraction','atomic_sigma'];
      records.push({id:Z+'-'+A, nuclide:A+element, A,Z,N,state:{kind:'ground',energy_keV:0},values,uncertainties,flags:{mass_excess_keV:cells[0].flag,mass_excess_sigma:cells[1].flag,atomic_mass_u:cells[4].flag,atomic_mass_sigma:cells[5].flag,binding_source_convention:old?'total_keV_divided_by_A':'keV_per_nucleon'},source_fields:{...Object.fromEntries(names.map((name,i)=>[name,raw[i]])),atomic_integer:line.slice(96,99).trim(),origin:line.slice(23,27).trim(),line:lineNo+1}});
    }
    if (records.length !== {ame2016:3436,ame2003:3179,ame1995:2931}[edition] || new Set(records.map(r=>r.id)).size !== records.length) throw new Error('AME record-count/identity validation failed');
    const carbon=records.find(r=>r.Z===6&&r.A===12), hydrogen=records.find(r=>r.Z===1&&r.A===1);
    if (!carbon || carbon.values.atomic_mass_u!==12 || carbon.values.mass_excess_keV!==0 || Math.abs(hydrogen.values.mass_excess_keV-{ame2016:7288.97061,ame2003:7288.97050,ame1995:7288.969}[edition])>1e-7) throw new Error('AME reference check failed');
    return records;
  }
  function be2Convert(value,A,unitFrom='e2_b2',unitTo='e2_fm4',directionFrom='up',directionTo='up') {
    if (!(A>0) || !['up','down'].includes(directionFrom) || !['up','down'].includes(directionTo)) throw new Error('Explicit B(E2) direction and A required');
    function factor(unit,direction) {if(unit==='e2_b2')return 1e4;if(unit==='e2_fm4')return 1;if(unit==='Wu')return (direction==='up'?.297:.0594)*A**(4/3);throw new Error('Unknown B(E2) unit');}
    return value*factor(unitFrom,directionFrom)*(directionFrom===directionTo?1:directionTo==='up'?5:.2)/factor(unitTo,directionTo);
  }
  function normalizeBE2(text) {
    const payload=JSON.parse(text); if(!Array.isArray(payload))throw new Error('Unexpected NNDC JSON');
    return payload.filter(e=>e.reference==='ADNDT_107_1_2016_2016PR01'&&e.adoptedEntryType==='MODEL_INDEPENDENT'&&e.be2&&(['Ca','Sn'].includes(e.nuclide.symbol)||(e.nuclide.symbol==='C'&&e.nuclide.a===12))).map(e=>{
      const A=e.nuclide.a,Z=e.nuclide.z,values={},uncertainties={};
      for(const [key,unit,direction] of [['be2_up_e2b2','e2_b2','up'],['be2_down_e2b2','e2_b2','down'],['be2_up_e2fm4','e2_fm4','up'],['be2_down_e2fm4','e2_fm4','down'],['be2_up_wu','Wu','up']]) {values[key]=be2Convert(e.be2.value,A,'e2_b2',unit,'up',direction);uncertainties[key]=e.be2.error==null?null:be2Convert(e.be2.error,A,'e2_b2',unit,'up',direction);}
      for(const [key,field]of[['be2_source_wu','be2Weisskopf'],['transition_energy_keV','transitionEnergy']]){values[key]=e[field]?.value??null;uncertainties[key]=e[field]?.error??null;}
      return {id:A+e.nuclide.symbol,nuclide:A+e.nuclide.symbol,A,Z,N:A-Z,state:{kind:'nuclear-transition',initial_spin_parity:'0+',final_spin_parity:'2+',direction:'up'},values,uncertainties,flags:{evaluation:'2016PR01',adopted_type:'MODEL_INDEPENDENT',Wu_convention:'Upward reference 0.297*A^(4/3); downward 0.0594*A^(4/3), e2 fm4. Source help arrow is inconsistent with its prose.',scope:'Selected Ca/Sn and 12C entries, not a full evaluation mirror'},source_fields:e};
    });
  }
  function normalizeReactions(text,spec) {
    const keys=spec.table==='rct1'?['s2n','s2p','qa','q2bm','qep','qbmn']:['sn','sp','q4bm','qda','qpa','qna'],identities=new Set(),records=[];
    for(const [i,original]of text.split(/\r?\n/).entries()){
      if(!/^\s*\d+\s*$/.test(original.slice(1,4))||!/^\s*\d+\s*$/.test(original.slice(8,11)))continue;
      const A=Number(original.slice(1,4)),Z=Number(original.slice(8,11)),element=original.slice(5,8).trim();if(A<=0||Z>A||!element)continue;identities.add(Z+'-'+A);
      if(!['Ca','Sn'].includes(element)&&!(element==='C'&&A===12))continue;
      const line=original.padEnd(124),values={},uncertainties={},flags={},raw={};
      keys.forEach((key,k)=>{const offset=12+18*k,v=ameCell(line.slice(offset,offset+10)),s=ameCell(line.slice(offset+10,offset+18));values[key+'_keV']=v.value;uncertainties[key+'_keV']=s.value;flags[key+'_keV']={...v.flag,uncertainty:s.flag,uncertainty_model:'published_evaluated_table'};raw[key]={value:line.slice(offset,offset+10).trim(),uncertainty:line.slice(offset+10,offset+18).trim()};});
      records.push({id:Z+'-'+A,nuclide:A+element,A,Z,N:A-Z,state:{kind:'ground',energy_keV:0},values,uncertainties,flags,source_fields:{...raw,line:i+1,table:spec.table,edition:spec.edition}});
    }
    if(identities.size!=={ame2016:3436,ame2003:3179,ame1995:2931}[spec.edition])throw new Error('Historical reaction-table identity/format mismatch');return records;
  }
  function validate(data,spec,query) {
    if(!data||data.schema_version!==1||data.dataset_key!==spec.key||JSON.stringify(data.query)!==JSON.stringify(query)||data.source?.id!==spec.source_id||!data.source.retrieved_at)throw new Error('Cache identity/query/source mismatch');
    if(!Array.isArray(data.records)||!data.records.length||data.records.length>(spec.max_records||50000))throw new Error('Empty/excessive dataset');
    for(const row of data.records){if(!row.nuclide||!Number.isInteger(row.A)||row.A<1||!row.state||!row.values||!row.source_fields)throw new Error('Invalid scientific record');for(const v of [...Object.values(row.values),...Object.values(row.uncertainties||{})])if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw new Error('Invalid normalized number');for(const v of Object.values(row.uncertainties||{}))if(v!==null&&v<0)throw new Error('Negative uncertainty');}return data;
  }
  async function sha256(text) {
    if(root.crypto?.subtle){const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
    if(typeof require==='function')return require('node:crypto').createHash('sha256').update(text).digest('hex');throw new Error('SHA-256 unavailable');
  }
  async function fetchText(url,options={}) {
    const controller=new AbortController(),timeout=Math.max(1,Math.min(60000,options.timeoutMs??8000));let timer;
    try{return await Promise.race([(async()=>{const response=await(options.fetch||root.fetch)(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const text=await response.text();if(text.length>8*1024*1024)throw new Error('Response exceeds budget');return text;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Request timeout'));},timeout);})]);}finally{clearTimeout(timer);}
  }
  async function getRegistry(options) {
    if(options.registry)configure(options.registry,{baseURL:options.baseURL||baseURL});
    if(!registry)configure(JSON.parse(await fetchText(new URL('index.json',options.baseURL||baseURL).href,options)),{baseURL:options.baseURL||baseURL});
    return registry;
  }
  async function load(key,options={}) {
    const reg=await getRegistry(options),spec=reg.datasets.find(d=>d.key===key);if(!spec)throw new Error('Unknown numerical dataset: '+key);
    const source=reg.sources.find(s=>s.id===spec.source_id),query=canonicalQuery(spec,options.query),identity=key+'|'+JSON.stringify(query),warnings=[];
    async function online(){const urls=[spec.url||source.service_url,...(spec.url?(spec.fallback_urls||[]):(source.fallback_urls||[]))];let failure;
      for(const base of urls){const url=spec.format==='livechart-csv'?base+'?'+new URLSearchParams(query):base;try{const text=await fetchText(url,options);const records=spec.format==='livechart-csv'?normalizeLivechart(text,spec,query):spec.format==='be2-json'?normalizeBE2(text):spec.format==='ame-rct'?normalizeReactions(text,spec):normalizeAME(text,spec.format);const data={schema_version:1,dataset_key:key,query,source:{id:source.id,title:source.title,url,evaluation_date:source.evaluation_date||null,evaluation:source.evaluation||null,retrieved_at:new Date().toISOString(),licence:source.licence,guide_url:source.guide_url,capability:source.capability},units:spec.units||{},records,raw_sha256:await sha256(text),notes:[spec.note,source.caveat].filter(Boolean)};validate(data,spec,query);memory.set(identity,data);return {data,origin:'online',warnings};}catch(error){failure=error;}}throw failure;
    }
    async function saved(){if(memory.has(identity))return {data:validate(memory.get(identity),spec,query),origin:'session-cache',warnings};const cache=spec.cache;if(!cache||JSON.stringify(cache.query)!==JSON.stringify(query)||!/^[a-z0-9-]+\.json$/.test(cache.file))throw new Error('No matching saved query snapshot');const text=await fetchText(new URL(cache.file,options.baseURL||baseURL).href,options);if(await sha256(text)!==cache.sha256)throw new Error('Saved snapshot SHA-256 mismatch');const data=validate(JSON.parse(text),spec,query);memory.set(identity,data);return {data,origin:'saved-cache',warnings};}
    const attempts=options.onlineFirst===false?[saved,online]:[online,saved];for(const attempt of attempts){try{return await attempt();}catch(error){warnings.push(String(error.message||error));}}throw new Error('No validated data available: '+warnings.join('; '));
  }
  async function refresh(keys,options={}){return Promise.allSettled(keys.map(key=>load(key,{...options,onlineFirst:true})));}
  const api={configure,load,refresh,list:async(options={})=>(await getRegistry(options)).datasets,number,canonicalQuery,normalizeLivechart,normalizeAME,normalizeReactions,normalizeBE2,be2Convert,validate,sha256};
  return api;
});
