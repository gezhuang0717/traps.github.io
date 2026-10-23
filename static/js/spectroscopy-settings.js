/* Portable settings, with lossless TXT/CSV/JSON round trips and no code execution. */
(function(host){
  'use strict';
  const SCHEMA='traps-spectroscopy-v1',LIMIT=131072;
  function safeKey(key){return typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_.:-]{0,100}$/.test(key)&&!['__proto__','constructor','prototype'].includes(key);}
  function normalize(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==SCHEMA)throw Error('settings_schema');
    if(!value.inputs||typeof value.inputs!=='object'||Array.isArray(value.inputs))throw Error('settings_inputs');
    const entries=Object.entries(value.inputs);
    if(entries.length>500)throw Error('settings_too_many');
    for(const[key,v]of entries)if(!safeKey(key)||typeof v!=='string'||v.length>32000)throw Error('settings_value');
    const activeTab=value.activeTab??'sp-radii';
    if(!/^sp-(radii|moments|levels|cls|cooling)$/.test(activeTab))throw Error('settings_tab');
    const sources=value.sources??[];
    if(!Array.isArray(sources)||sources.length>200)throw Error('settings_sources');
    // Source metadata is retained for attribution; it never replaces trusted data.
    return{schema:SCHEMA,inputs:Object.fromEntries(entries),activeTab,sources};
  }
  function rows(value){const v=normalize(value);return[['meta','schema',v.schema],['meta','activeTab',v.activeTab],['meta','sources',v.sources],...Object.entries(v.inputs).map(([k,x])=>['input',k,x])];}
  const cell=v=>'"'+String(v).replace(/"/g,'""')+'"';
  function serialize(value,format='json'){
    const v=normalize(value);let text;
    if(format==='json')text=JSON.stringify(v,null,2)+'\n';
    else if(format==='csv')text=[['section','key','json_value'],...rows(v).map(([section,key,x])=>[section,key,JSON.stringify(x)])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
    else if(format==='txt')text='# Traps spectroscopy settings v1\n'+rows(v).map(([section,key,x])=>(section==='input'?'input.':'')+key+' = '+JSON.stringify(x)).join('\n')+'\n';
    else throw Error('settings_format');
    if(text.length>LIMIT)throw Error('settings_size');return text;
  }
  function parseCsv(text){
    const result=[];let row=[],field='',quoted=false,closed=false;
    function emit(){row.push(field);field='';closed=false;}
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
      if(c==='"'){if(field!==''||closed)throw Error('settings_csv_quotes');quoted=true;}
      else if(c===',')emit();
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;emit();if(row.some(x=>x!==''))result.push(row);row=[];}
      else{if(closed)throw Error('settings_csv_quotes');field+=c;}
    }
    if(quoted)throw Error('settings_csv_quotes');if(field!==''||row.length||closed){emit();result.push(row);}return result;
  }
  function fromRows(input){
    const meta=new Map(),inputs=new Map();
    for(const row of input){if(row.length!==3)throw Error('settings_columns');const[section,key,text]=row;if(section!=='meta'&&section!=='input')throw Error('settings_section');const target=section==='meta'?meta:inputs;if(target.has(key))throw Error('settings_duplicate');let value;try{value=JSON.parse(text);}catch{throw Error('settings_json_value');}if(section==='meta'&&!['schema','activeTab','sources'].includes(key))throw Error('settings_key');if(section==='input'&&!safeKey(key))throw Error('settings_key');target.set(key,value);}
    return normalize({schema:meta.get('schema'),activeTab:meta.get('activeTab'),sources:meta.get('sources'),inputs:Object.fromEntries(inputs)});
  }
  function parse(input,format){
    if(typeof input!=='string'||input.length>LIMIT)throw Error('settings_size');const text=input.replace(/^\uFEFF/,'').trim();
    if(!format)format=text.startsWith('{')?'json':/^"?section"?,/.test(text)?'csv':'txt';
    if(format==='json'){let value;try{value=JSON.parse(text);}catch{throw Error('settings_json');}return normalize(value);}
    if(format==='csv'){const list=parseCsv(text),header=list.shift();if(!header||header.join('|')!=='section|key|json_value')throw Error('settings_csv_header');return fromRows(list);}
    if(format==='txt'){const list=[];for(const line of text.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('#'))continue;const equal=line.indexOf('=');if(equal<0)throw Error('settings_txt_line');let key=line.slice(0,equal).trim();const section=key.startsWith('input.')?'input':'meta';if(section==='input')key=key.slice(6);list.push([section,key,line.slice(equal+1).trim()]);}return fromRows(list);}
    throw Error('settings_format');
  }
  const api={schema:SCHEMA,normalize,serialize,parse};if(typeof module==='object'&&module.exports)module.exports=api;if(host)host.TrapsSpectroscopySettings=api;
})(typeof globalThis==='object'?globalThis:this);
