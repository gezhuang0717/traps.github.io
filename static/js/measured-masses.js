/* Browser-local experimental inputs. No network or storage access in this module. */
(function(host){
  'use strict';
  const P=host.ZGPhysics || (typeof require==='function'?require('./physics.js'):null);
  const MAX_ROWS=2000, MAX_TEXT=2*1024*1024;
  const fail=code=>{throw new Error(code);};
  const fields=['use','nuclide','Z','N','state','value','uncertainty','unit','quantity','label','facility','method','year','reference','note','mixture'];
  const flag=x=>x===true||x===1||/^(true|yes|1)$/i.test(String(x));
  function stateFor(row,catalog){
    let text=String(row.nuclide||'').trim().replace(/\s/g,'');
    let A,el,tag=row.state==null?'':String(row.state).toLowerCase(), explicitTag='', m;
    if(!text && row.Z!==undefined && row.Z!=='' && row.N!==undefined && row.N!==''){
      const z=Number(row.Z),n=Number(row.N);
      if(!Number.isInteger(z)||!Number.isInteger(n)||z<0||n<0)fail('identity');
      const gs=catalog.states.get(`${z}-${n}-0`);if(!gs)fail('identity'); A=z+n;el=gs.element;
    } else {
      if((m=text.match(/^([A-Z][a-z]?)-(\d+)(.*)$/i)))text=m[2]+m[1]+m[3];
      if((m=text.match(/^(\d+)m(\d*)([A-Z][a-z]?)$/i))){A=+m[1];el=m[3];explicitTag='m'+m[2];tag=tag||explicitTag;}
      else if((m=text.match(/^(\d+)([A-Z][a-z]?)(?:\[([a-z0-9]+)\]|(m\d*|n|p|q|r|x|i|j))?$/i))){A=+m[1];el=m[2];explicitTag=(m[3]||m[4]||'').toLowerCase();tag=tag||explicitTag;}
      else fail('identity');
    }
    const labels={g:0,m:1,m1:1,m2:2,n:2,p:3,q:4,r:5,x:6,i:8,j:9};
    const stateIndex=t=>t===''?0:t in labels?labels[t]:/^\d+$/.test(t)?+t:fail('state');
    const index=stateIndex(tag);
    if(explicitTag&&stateIndex(explicitTag)!==index)fail('state');
    const gs=catalog.ground.get(el.toLowerCase()+A), state=gs&&catalog.states.get(`${gs.Z}-${gs.N}-${index}`);
    if(!state||state.existence==='withdrawn')fail('state');
    if(row.Z!==undefined&&row.Z!==''&&Number(row.Z)!==state.Z || row.N!==undefined&&row.N!==''&&Number(row.N)!==state.N)fail('identity');
    return state;
  }
  function normalize(row,i,catalog){
    const state=stateFor(row,catalog), text=String(row.value??'').trim(), sig=String(row.uncertainty??row.sigma??'').trim();
    if(!text||!Number.isFinite(Number(text.replace(/#$/,''))))fail('value');
    if(!sig||!Number.isFinite(Number(sig))||Number(sig)<=0)fail('sigma');
    const quantity=String(row.quantity||'me').toLowerCase().replace(/[ _-]/g,'');
    if(!['me','massexcess','atomic','atomicmass','mass','be','bindingenergy'].includes(quantity))fail('quantity');
    const unit=String(row.unit||'keV').replace(/μ/g,'µ').toLowerCase();
    const factor={kev:1,mev:1000,u:P.C.uKeV,'µu':P.C.uKeV/1e6,micro_u:P.C.uKeV/1e6}[unit];
    if(!factor)fail('unit');
    const value=Number(text.replace(/#$/,''))*factor, atomic=['atomic','atomicmass','mass'].includes(quantity),binding=['be','bindingenergy'].includes(quantity);
    if(binding&&!['kev','mev'].includes(unit))fail('beunit');
    const me=binding?(state.Z*(catalog.atom(1,'H').value.v-1)+state.N*(catalog.atom(1,'n').value.v-1))*P.C.uKeV-value:value-(atomic?state.A*P.C.uKeV:0), e=Number(sig)*factor;
    if(!Number.isFinite(me)||!Number.isFinite(e))fail('value');
    const mixture=flag(row.mixture), use=row.use===undefined||row.use===''?!mixture:flag(row.use);
    return {state,id:state.id,row:i+1,me,e,est:text.endsWith('#'),use,mixture,
      label:`${state.A}${state.element}[${state.label}]`,raw:row};
  }
  function build(raw,catalog,policy='last'){
    if(!Array.isArray(raw)||raw.length>MAX_ROWS)fail('limit');
    const valid=[],errors=[],groups=new Map(),active=new Map();
    raw.forEach((row,i)=>{try{const r=normalize(row,i,catalog);valid.push(r);if(r.use){if(!groups.has(r.id))groups.set(r.id,[]);groups.get(r.id).push(r);}}catch(e){errors.push({row:i+1,code:e.message});}});
    for(const [id,rs] of groups){
      const last=rs[rs.length-1];let entry={...last,rows:[last.row],birge:null};
      if(policy==='weighted'&&rs.length>1){
        const scale=Math.min(...rs.map(r=>r.e)),weights=rs.map(r=>(scale/r.e)**2),sum=weights.reduce((a,b)=>a+b,0);
        const mean=rs.reduce((a,r,i)=>a+weights[i]*r.me,0)/sum,inner=scale/Math.sqrt(sum);
        const chi2=rs.reduce((a,r)=>a+((r.me-mean)/r.e)**2,0),birge=Math.sqrt(chi2/(rs.length-1));
        entry={...entry,rows:rs.map(x=>x.row),me:mean,e:inner*Math.max(1,birge),inner,birge,est:rs.some(r=>r.est)};
      }
      entry.value=P.primitive('loaded:'+id+':'+entry.rows.join('+'),entry.me,entry.e,entry.est);
      active.set(id,entry);
    }
    return {raw,valid,errors,active,groups,policy,duplicates:[...groups].filter(([,rs])=>rs.length>1).map(([id])=>id)};
  }
  function getter(table,base){return (z,n)=>table.active.get(`${z}-${n}-0`)?.value||base(z,n);}
  const affected=(v,id)=>!!v&&Object.keys(v.terms||{}).some(k=>k.startsWith(id?'loaded:'+id+':':'loaded:'));
  function provenance(value,table){
    return Object.entries(value?.terms||{}).map(([id,t])=>{
      const loaded=id.startsWith('loaded:')?table.active.get(id.split(':')[1]):null;
      return {id,coefficient:t.c,value_keV:t.v,uncertainty_keV:t.e,source:loaded?'loaded':'AME/model',rows:loaded?.rows||[],
        references:loaded?[...new Set(loaded.rows.map(i=>String(table.raw[i-1].reference||'')))]:[],labels:loaded?[...new Set(loaded.rows.map(i=>String(table.raw[i-1].label||'New')))]:[]};
    });
  }
  function parseDelimited(text,sep){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else fail('csv');}
      else if(c===sep&&!quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)fail('csv');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  function parse(text){
    if(typeof text!=='string'||text.length>MAX_TEXT)fail('limit');
    text=text.replace(/^\uFEFF/,'').trim(); if(!text)return [];
    let out;
    if(/^[\[{]/.test(text)){try{const data=JSON.parse(text);out=Array.isArray(data)?data:data.rows;}catch(_){fail('json');}}
    else {
      const rows=parseDelimited(text,text.split(/\r?\n/)[0].includes('\t')?'\t':',');
      const alias={sigma:'uncertainty',sig:'uncertainty',dme:'uncertainty',me:'value',mass_excess:'value',doi:'reference',isotope:'nuclide'};
      const head=rows.shift().map(x=>{const k=x.trim().toLowerCase();return k==='z'?'Z':k==='n'?'N':alias[k]||k;});
      if(new Set(head).size!==head.length||!head.includes('value')||!head.includes('uncertainty'))fail('header');
      out=rows.map(r=>{if(r.length!==head.length)fail('csv');return Object.fromEntries(head.map((k,i)=>[k,r[i].trim()]));});
    }
    if(!Array.isArray(out)||out.length>MAX_ROWS||out.some(x=>!x||typeof x!=='object'||Array.isArray(x)))fail('limit');return out;
  }
  function csv(raw){
    const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
    return [fields,...raw.map(r=>fields.map(f=>f==='uncertainty'?(r.uncertainty??r.sigma??''):(r[f]??'')))].map(r=>r.map(quote).join(',')).join('\n');
  }
  const api={MAX_ROWS,MAX_TEXT,fields,stateFor,normalize,build,getter,affected,provenance,parse,csv};
  host.ZGMeasuredMasses=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
