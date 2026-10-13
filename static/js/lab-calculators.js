(function(host){
  'use strict';
  const C={uKeV:931494.10242,uKg:1.66053906660e-27,electronU:5.48579909065e-4,e:1.602176634e-19};
  function number(value){
    if(value==null||typeof value==='boolean'||String(value).trim()==='')throw new Error('missing');
    const n=Number(value);if(!Number.isFinite(n))throw new Error('finite');return n;
  }
  function cyclotron(mass,charge,field){
    const m=number(mass),q=number(charge),B=number(field),ionU=m-q*C.electronU;
    if(!(m>0)||!Number.isInteger(q)||q<1||q>100||!(B>0)||!(ionU>0))throw new Error('physical');
    const Hz=q*C.e*B/(2*Math.PI*ionU*C.uKg);
    if(!Number.isFinite(Hz))throw new Error('finite');
    return {Hz,ionU,atomicMassPerCharge:m/q};
  }
  function resolving(mass1,mass2){
    const a=number(mass1),b=number(mass2);
    if(!(a>0)||!(b>0))throw new Error('physical');
    const difference=Math.abs(a-b);
    const R=difference===0?null:(a/2+b/2)/difference,differenceKeV=difference*C.uKeV;
    if((R!==null&&!Number.isFinite(R))||!Number.isFinite(differenceKeV))throw new Error('finite');
    return {differenceU:difference,differenceKeV,R};
  }
  function convert(value,unit,massNumber){
    const v=number(value),factors={u:1,keV:C.uKeV,MeV:C.uKeV/1000,kg:C.uKg};
    if(!Object.prototype.hasOwnProperty.call(factors,unit))throw new Error('unit');
    const u=v/factors[unit],A=massNumber==null||String(massNumber).trim()===''?null:number(massNumber);
    if(A!==null&&(!Number.isInteger(A)||A<1))throw new Error('mass-number');
    const result={u,keV:u*C.uKeV,MeV:u*C.uKeV/1000,kg:u*C.uKg,ME:A===null?null:(u-A)*C.uKeV};
    if(Object.values(result).some(x=>x!==null&&!Number.isFinite(x)))throw new Error('finite');
    return result;
  }
  const api={number,cyclotron,resolving,convert};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!host.document)return;
  const $=id=>host.document.getElementById(id),root=$('zg-c-out');if(!root)return;
  const L=JSON.parse(root.dataset.labels),fmt=(x,d)=>x.toLocaleString(host.document.documentElement.lang,{maximumFractionDigits:d});
  function nuc(){
    try{
      const f=cyclotron($('zg-c-m').value,$('zg-c-q').value,$('zg-c-b').value);
      root.textContent=L.fc+': '+fmt(f.Hz,9)+' Hz · m_ion = '+fmt(f.ionU,12)+' u · m_atom/q = '+fmt(f.atomicMassPerCharge,9)+' u';
    }catch(_){root.textContent=L.invalid_cyclotron;}
  }
  $('zg-c-preset').addEventListener('change',function(){if(this.value){$('zg-c-m').value=this.value;nuc();}});
  ['zg-c-m','zg-c-q','zg-c-b'].forEach(id=>$(id).addEventListener('input',nuc));nuc();
  function res(){
    const out=$('zg-r-out'),meter=$('zg-r-meter');meter.replaceChildren();
    try{
      const f=resolving($('zg-r-m1').value,$('zg-r-m2').value);
      if(f.R===null){out.textContent=L.same;return;}
      out.textContent=L.dm+': '+fmt(f.differenceKeV,3)+' keV/c² · '+L.rr+': '+(f.R<1e4?fmt(f.R,0):f.R.toExponential(2));
      for(const [label,id]of [['MR-TOF','zg-guide-mr'],['TOF-ICR','zg-guide-tof'],['PI-ICR','zg-guide-pi']]){
        let guide=null;try{guide=number($(id).value);if(guide<1||guide>1e12)guide=null;}catch(_){}
        const li=host.document.createElement('li'),ok=guide!==null&&guide>=f.R;li.className=ok?'ok':'bad';
        for(const text of [label,guide===null?'—':'~'+guide.toExponential(2),guide===null?L.guide_unknown:ok?'✔ '+L.guide_yes:L.guide_no]){
          const span=host.document.createElement('span');span.textContent=text;li.append(span);
        }
        meter.append(li);
      }
    }catch(_){out.textContent=L.invalid_resolution;}
  }
  ['zg-r-m1','zg-r-m2','zg-guide-mr','zg-guide-tof','zg-guide-pi'].forEach(id=>$(id).addEventListener('input',res));
  host.document.querySelectorAll('.zg-guide-slider').forEach(r=>{
    const n=$(r.dataset.guide);r.addEventListener('input',()=>{n.value=Number(Math.pow(10,+r.value).toPrecision(6));res();});
    n.addEventListener('input',()=>{const v=Number(n.value);if(v>=1&&v<=1e12)r.value=Math.log10(v);});
  });res();
  function conv(){
    const out=$('zg-u-out'),message=$('zg-u-status');out.replaceChildren();message.textContent='';
    try{
      const f=convert($('zg-u-v').value,$('zg-u-unit').value,$('zg-u-a').value);
      const rows=[['u',fmt(f.u,12)],['keV/c²',fmt(f.keV,6)],['MeV/c²',fmt(f.MeV,9)],['kg',f.kg.toExponential(9)]];
      if(f.ME!==null)rows.push([L.me,fmt(f.ME,4)+' keV']);
      for(const [label,value]of rows){const tr=host.document.createElement('tr'),th=host.document.createElement('th'),td=host.document.createElement('td');th.textContent=label;td.textContent=value;tr.append(th,td);out.append(tr);}
    }catch(_){message.textContent=L.invalid_converter;}
  }
  ['zg-u-v','zg-u-unit','zg-u-a'].forEach(id=>$(id).addEventListener('input',conv));conv();
})(typeof globalThis!=='undefined'?globalThis:window);
