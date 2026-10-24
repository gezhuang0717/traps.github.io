/* Explicit observable adapter. Parsing identities never implies a mass measurement. */
(function(host){
  'use strict';
  const energy=['me','be','sn','s2n','sp','s2p','qbm','qec','qa','d2n','d2p','d3n','d3p','d5n','d5p','vpn','wig','q2bm','q2ec','qecbp','q2bp','q4bm','qep','qbmn','qda','qpa','qna','D1nS1n','D1pS1p','D1nS2n','D1pS2p','D2pS2n','D1pS1n','D1pS2n','D2pS1n','Gplus','Gsym'];
  const specs=Object.fromEntries(energy.map(k=>[k,{unit:'MeV',units:{MeV:1,keV:.001,eV:.000001}}]));
  Object.assign(specs,{
    bea:{unit:'MeV/nucleon',units:{'MeV/nucleon':1,'keV/nucleon':.001}},
    atomic:{unit:'u',units:{u:1,'µu':.000001}},
    rms:{unit:'fm',units:{fm:1}},mu:{unit:'μN',units:{'μN':1}},
    qmom:{unit:'b',units:{b:1,'fm²':.01}},e2p:{unit:'keV',units:{keV:1,MeV:1000,eV:.001}},
    be2:{unit:'e²b²',units:{'e²b²':1,'e²fm⁴':.0001}},
    beta2e:{unit:'1',units:{'1':1}},beta2:{unit:'1',units:{'1':1}}
  });
  const massTypes=['me','be','bea','atomic'];
  const finite=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x));
  const fail=code=>{throw new Error(code);};
  function units(quantity){if(quantity==='custom')return ['custom'];if(!specs[quantity])fail('quantity');return Object.keys(specs[quantity].units);}
  function adapt(parsed,options){
    if(!parsed||!Array.isArray(parsed.rows)||!Array.isArray(parsed.valueColumns))fail('rows');
    const quantity=options.quantity||'custom',custom=quantity==='custom',spec=specs[quantity];
    if(!custom&&!spec)fail('quantity');
    const unit=String(options.unit||'').trim(),displayUnit=custom?String(options.customUnit||'').trim():spec.unit;
    if(custom?!displayUnit:!Object.hasOwn(spec.units,unit))fail('unit');
    const valueColumn=String(options.valueColumn||''),sigmaColumn=String(options.sigmaColumn||'');
    if(!parsed.valueColumns.includes(valueColumn)||sigmaColumn&&(!parsed.valueColumns.includes(sigmaColumn)||sigmaColumn===valueColumn))fail('column');
    const factor=custom?1:spec.units[unit],rows=[],errors=[];
    for(const [i,r]of parsed.rows.entries()){
      if(!Number.isInteger(r.Z)||!Number.isInteger(r.N)||r.Z<0||r.N<0||r.Z+r.N<1)fail('identity');
      const inputValue=r.values[valueColumn];if(!finite(inputValue)){errors.push({row:i+1,code:'value'});continue;}
      const rawSigma=sigmaColumn?r.values[sigmaColumn]:null;
      // A missing cell is unknown, not zero. A selected negative sigma rejects its row.
      if(rawSigma!==null&&rawSigma!==undefined&&(!finite(rawSigma)||Number(rawSigma)<0)){errors.push({row:i+1,code:'sigma'});continue;}
      const inputSigma=rawSigma===null||rawSigma===undefined?null:Number(rawSigma),value=Number(inputValue)*factor,sigma=inputSigma===null?null:inputSigma*factor;
      if(!Number.isFinite(value)||sigma!==null&&!Number.isFinite(sigma)){errors.push({row:i+1,code:'value'});continue;}
      rows.push({Z:r.Z,N:r.N,value,sigma,inputValue:Number(inputValue),inputSigma,inputUnit:custom?displayUnit:unit,quantity,unit:displayUnit,label:String(options.label||'').trim(),reference:String(options.reference||'').trim(),uncertainty_status:sigma===null?'unknown':'reported'});
    }
    if(!rows.length)fail(errors[0]?.code||'rows');
    return {quantity,unit:displayUnit,inputUnit:custom?displayUnit:unit,valueColumn,sigmaColumn,label:String(options.label||'').trim(),reference:String(options.reference||'').trim(),rows,errors,massAdoptable:massTypes.includes(quantity)};
  }
  function massRows(table){
    if(!table?.massAdoptable||!massTypes.includes(table.quantity))fail('mass_quantity');
    return table.rows.map(r=>({Z:r.Z,N:r.N,state:'g',value:r.inputValue,uncertainty:r.inputSigma,uncertainty_status:r.uncertainty_status,unit:r.inputUnit,quantity:table.quantity,label:r.label||'My data',reference:r.reference,note:'Explicit typed chart input; ground state',input_origin:'typed-chart',use:true}));
  }
  function portable(text,options,checked={}){return {schema:'traps.typed-data.v1',text:String(text),options:{...options},series:{...checked}};}
  function restore(text){
    const data=JSON.parse(text);if(data?.schema!=='traps.typed-data.v1'||typeof data.text!=='string'||!data.options||typeof data.options!=='object'||Array.isArray(data.options)||data.series&&Object.values(data.series).some(x=>typeof x!=='boolean'))fail('settings');
    return data;
  }
  const api={specs,units,adapt,massRows,portable,restore};host.ZGChartTypedData=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
