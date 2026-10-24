(function(){'use strict';
 const M=window.ZGMathieu,NS='http://www.w3.org/2000/svg';if(!M)return;
 document.querySelectorAll('[data-mathieu]').forEach(root=>{
  if(root.dataset.mathieuReady)return;root.dataset.mathieuReady='true';
  const T=JSON.parse(root.dataset.labels),field=n=>root.querySelector('[name="ms-'+n+'"]'),value=n=>+field(n).value,err=root.querySelector('[data-ms-error]'),figure=root.querySelector('[data-ms-figure]');
  let source={label:T.manual},last=null,timer=null,styleControl=null,lastDesign=null,designSVG=null;
  const defaults=Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
  const el=(tag,attrs={},txt)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(txt!=null)e.textContent=txt;return e;};
  const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(7)).toString():'—';
  function state(){return{schema:'traps-mathieu-v1',inputs:Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value])),source,style:styleControl?.get()||null};}
  function inputs(){
   const geometry=field('geometry').value,mode=geometry==='paul3d'?'direct':field('mode').value,count=value('bands'),qmax=value('qmax'),amin=value('amin'),amax=value('amax');
   if(!['linear','paul3d'].includes(geometry)||!['voltage','direct'].includes(mode)||!Number.isInteger(count)||count<1||count>6||!Number.isFinite(qmax)||qmax<=0||qmax>12||!Number.isFinite(amin)||!Number.isFinite(amax)||amin>=amax||amin< -60||amax>60)throw Error('inputs');
   const p=mode==='voltage'?M.parameters(value('mass'),value('charge'),value('U'),value('V'),value('r0'),value('f')):{a:value('a'),q:value('q')};
   if(!Number.isFinite(p.a)||!Number.isFinite(p.q)||(!higher()&&Math.abs(p.q)>12))throw Error('inputs');
   const sections=[];
   if(geometry==='linear'&&!higher())for(const key of ['cooler','mf','bun'])if(field(key+'-on').checked){const x=M.parameters(value('mass'),value('charge'),value(key+'-U'),value(key+'-V'),value(key+'-r0'),value(key+'-f'));sections.push({key,...x});}
   return{geometry,mode,count,qmax,amin,amax,p,sections};
  }
  const designNames=['rod-count','rod-rule','rod-ratio','rod-radius','diameter-tolerance','radial-fraction','eta-target','vscan'];
  function higher(){return !!field('rod-count')&&field('geometry').value==='linear'&&value('rod-count')>4;}
  function designInputs(){
   const numeric=n=>{if(!field(n).value.trim())throw Error('blank');const x=Number(field(n).value);if(!Number.isFinite(x))throw Error('finite');return x;};
   const rule=field('rod-rule').value,input={mass_u:numeric('mass'),charge:numeric('charge'),U_V:numeric('U'),V_V:numeric('V'),r0_mm:numeric('r0'),f_MHz:numeric('f'),rod_count:numeric('rod-count'),rod_rule:rule,radial_fraction:numeric('radial-fraction'),eta_target:numeric('eta-target'),bands:numeric('bands')};
   if(rule==='ratio')input.rod_ratio=numeric('rod-ratio');if(rule==='radius')input.rod_radius_mm=numeric('rod-radius');
   if(field('diameter-tolerance').value.trim()!=='')input.diameter_tolerance_mm=numeric('diameter-tolerance');
   return input;
  }
  function renderDesign(){
   const box=root.querySelector('[data-ms-design-readout]'),holder=root.querySelector('[data-ms-design-figure]');if(!box||!holder)return;box.replaceChildren();holder.replaceChildren();lastDesign=null;designSVG=null;
   if(field('geometry').value!=='linear'||field('mode').value!=='voltage')return;
   const voltages=field('vscan').value.split(',').map(v=>{if(!v.trim())throw Error('RF scan');return Number(v);});
   const log=M.designLog(designInputs(),voltages),d=log.result,S=styleControl?.get()||{titleSize:18,tickSize:13,lineWidth:1};lastDesign=log;
   const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
   const rule=field('rod-rule').value;field('rod-ratio').disabled=rule!=='ratio';field('rod-radius').disabled=rule!=='radius';
   if(rule!=='ratio')field('rod-ratio').value=String(Number(d.rod_ratio.toPrecision(7)));if(rule!=='radius')field('rod-radius').value=String(Number(d.rod_radius_mm.toPrecision(7)));
   add(`${T.geometry_out}: ${fmt(d.rod_radius_mm)} / ${fmt(d.rod_diameter_mm)} · ${fmt(d.rod_ratio)} · ${fmt(d.ratio_deviation_percent)}`);
   add(`${T.envelope_out}: ${fmt(d.outer_radius_mm)} / ${fmt(d.aperture_diameter_mm)}`);
   add(`${T.gaps}: ${fmt(d.adjacent_center_mm)} / ${fmt(d.surface_gap_mm)} / ${fmt(d.opposite_center_mm)}`);
   add(`${T.parasitic_out}: ${d.parasitic_A_over_An===null?T.parasitic_none:fmt(d.parasitic_A_over_An)+' / '+fmt(d.parasitic_at_radial_fraction)}`);
   if(d.ratio_tolerance!==null)add(`${T.tol_out}: ±${fmt(d.ratio_tolerance)}`);
   if(d.suggested_RF)add(`${T.rf_suggest}: ${d.suggested_RF.map(x=>fmt(x.V_rod_peak_V)).join(' / ')} · ${d.suggested_RF.map(x=>x.f_MHz_at_current_V===null?'—':fmt(x.f_MHz_at_current_V)).join(' / ')}`);
   add(`${T.field_depth}: ${fmt(d.field_RF_V_m)} / ${fmt(d.pseudopotential_eV)}`);
   if(d.V_V===0)add(T.zero_rf);add(`${T.eta_readout}: ${fmt(d.eta)} / ${fmt(d.eta_target)} · ${d.eta_target_met?T.target_met:T.target_above}`);
   add(`${T.rf_target}: ${fmt(d.eta_frequency_min_MHz)} / ${fmt(d.eta_voltage_max_V)}`);
   add(`${T.candidates}: `+log.candidates.map(c=>`${fmt(c.V_V)} V → ${c.classification?T[c.classification.status]:c.eta_target_met?T.target_met:T.target_above} (η=${fmt(c.eta)}, ${fmt(c.pseudopotential_eV)} eV)`).join('; '));
   const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=T.coordinates;pre.textContent=d.rod_coordinates.map(p=>`${p.index}: (${fmt(p.x_mm)}, ${fmt(p.y_mm)}) · ${p.phase>0?'+':'−'}V`).join('\n');details.append(summary,pre);box.append(details);
   const extent=d.center_radius_mm+d.rod_radius_mm,scale=150/extent,cx=230,cy=200;
   const svg=el('svg',{xmlns:NS,viewBox:'0 0 460 410',role:'img','aria-label':T.design_title,style:'display:block;width:100%;max-width:520px;height:auto;background:#fff;font-family:Arial,sans-serif'});
   svg.append(el('rect',{width:460,height:410,fill:'#fff'}),el('text',{x:230,y:25,'text-anchor':'middle','font-size':S.titleSize},T.design_title),el('circle',{cx,cy,r:d.r0_mm*scale,fill:'none',stroke:'#73808f','stroke-dasharray':'5 4','stroke-width':S.lineWidth}));
   for(const p of d.rod_coordinates){svg.append(el('circle',{cx:cx+p.x_mm*scale,cy:cy-p.y_mm*scale,r:d.rod_radius_mm*scale,fill:p.phase>0?'#dae6ff':'#ffe2da',stroke:p.phase>0?'#315aa3':'#ac4835','stroke-width':S.lineWidth}),el('text',{x:cx+p.x_mm*scale,y:cy-p.y_mm*scale+4,'text-anchor':'middle','font-size':S.tickSize},String(p.index)));}
   svg.append(el('line',{x1:cx,y1:cy,x2:cx+d.r0_mm*scale,y2:cy,stroke:'#172235','stroke-width':S.lineWidth}),el('text',{x:cx+10,y:cy-8,'font-size':S.tickSize},`r₀=${fmt(d.r0_mm)} mm`),el('text',{x:230,y:390,'text-anchor':'middle','font-size':S.tickSize},`2n=${d.rod_count}; r=${fmt(d.rod_radius_mm)} mm (r/r₀=${fmt(d.rod_ratio)}); ±V`));holder.append(svg);designSVG=svg;
  }
  function sync(){const three=field('geometry').value==='paul3d',multi=higher();if(three)field('mode').value='direct';else if(multi)field('mode').value='voltage';field('mode').disabled=three||multi;const direct=three||field('mode').value==='direct';root.querySelectorAll('[data-ms-voltage]').forEach(e=>{e.hidden=direct;});root.querySelectorAll('[data-ms-direct]').forEach(e=>{e.hidden=!direct;});root.querySelector('[data-ms-sections]').hidden=three||multi;const designBox=root.querySelector('[data-ms-design]'),formulaBox=root.querySelector('[data-ms-band-formula]');if(designBox)designBox.hidden=three||direct;if(formulaBox)formulaBox.hidden=multi;root.querySelector('[data-ms-formula]').hidden=three;root.querySelector('[data-ms-mapping]').textContent=three?T.mapping_paul:T.mapping_linear;figure.hidden=multi;for(const action of ['svg','png','csv'])root.querySelector('[data-ms-action="'+action+'"]').disabled=multi;}
  function draw(d){
   const S=styleControl?.get()||{titleSize:20,axisSize:16,tickSize:13,legendSize:13,markerDiameter:10,lineWidth:1};
   const W=900,H=620,left=86,right=30,top=72,bottom=100,w=W-left-right,h=H-top-bottom,X=q=>left+q/d.qmax*w,Y=a=>top+(d.amax-a)/(d.amax-d.amin)*h;
   const svg=el('svg',{xmlns:NS,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':T.title,style:'display:block;width:100%;height:auto;min-width:280px;background:#fff;color:#172235;font-family:Arial,sans-serif'});
   svg.append(el('rect',{x:0,y:0,width:W,height:H,fill:'#fff'}),el('text',{x:W/2,y:31,'text-anchor':'middle','font-size':S.titleSize,fill:'#172235'},T.title));
   const chart=el('svg',{x:left,y:top,width:w,height:h,viewBox:`${left} ${top} ${w} ${h}`,overflow:'hidden'});svg.append(chart);
   const qs=Array.from({length:241},(_,i)=>d.qmax*i/240),factor=d.geometry==='linear'?1:2;
   const rows=qs.map(q=>{const first=M.bands(q,d.count),second=M.bands(q/factor,d.count).map(b=>({n:b.n,lo:-factor*b.hi,hi:-factor*b.lo}));return{q,first,second};});
   const path=(points,close=false)=>points.map(([x,y],i)=>(i?'L':'M')+fmt(X(x))+','+fmt(Y(y))).join(' ')+(close?'Z':'');
   function strip(select,fill){let run=[];const flush=()=>{if(run.length>1){const pts=run.map(r=>[r.q,r.lo]).concat(run.slice().reverse().map(r=>[r.q,r.hi]));chart.append(el('path',{d:path(pts,true),fill,stroke:'none'}));}run=[];};rows.forEach(r=>{const b=select(r);if(b&&b.hi>b.lo)run.push({q:r.q,...b});else flush();});flush();}
   for(let n=0;n<d.count;n++){strip(r=>r.first[n],'#dfeafb');strip(r=>r.second[n],'#ffe6ce');}
   for(let i=0;i<d.count;i++)for(let j=0;j<d.count;j++)strip(r=>({lo:Math.max(r.first[i].lo,r.second[j].lo),hi:Math.min(r.first[i].hi,r.second[j].hi)}),'#8ed3ac');
   for(let i=0;i<=5;i++){const q=d.qmax*i/5,a=d.amin+(d.amax-d.amin)*i/5;chart.append(el('line',{x1:X(q),x2:X(q),y1:top,y2:top+h,stroke:'#d9dee6','stroke-width':.7}),el('line',{x1:left,x2:left+w,y1:Y(a),y2:Y(a),stroke:'#d9dee6','stroke-width':.7}));svg.append(el('text',{x:X(q),y:top+h+23,'text-anchor':'middle','font-size':S.tickSize,fill:'#172235'},fmt(q)),el('text',{x:left-10,y:Y(a)+4,'text-anchor':'end','font-size':S.tickSize,fill:'#172235'},fmt(a)));}
   for(let n=0;n<d.count;n++)for(const [plane,color,dash] of [['first','#2f62b8',''],['second','#ad6a25','5 3']])for(const side of ['lo','hi'])chart.append(el('path',{d:path(rows.map(r=>[r.q,r[plane][n][side]])),fill:'none',stroke:color,'stroke-width':S.lineWidth,'stroke-dasharray':dash}));
   const colours=['#7b4dbb','#c54847','#008391'];
   d.sections.forEach((s,i)=>{const color=colours[i],ratio=s.V_rod_peak_V?2*s.U_V/s.V_rod_peak_V:null;if(ratio!==null)chart.append(el('line',{x1:X(0),y1:Y(0),x2:X(d.qmax),y2:Y(ratio*d.qmax),stroke:color,'stroke-width':2*S.lineWidth,'stroke-dasharray':'7 3'}));if(s.V_rod_peak_V===0)chart.append(el('line',{x1:X(0),x2:X(0),y1:top,y2:top+h,stroke:color,'stroke-width':2*S.lineWidth}));chart.append(el('circle',{cx:X(Math.abs(s.q)),cy:Y(s.a),r:S.markerDiameter*.35,fill:color}));svg.append(el('text',{x:left+i*240,y:H-20,'font-size':S.legendSize,fill:color},T[s.key]));});
   chart.append(el('circle',{cx:X(Math.abs(d.p.q)),cy:Y(d.p.a),r:S.markerDiameter/2,fill:'#172235',stroke:'#fff','stroke-width':1.5}));
   svg.append(el('rect',{x:left,y:top,width:w,height:h,fill:'none',stroke:'#172235'}),el('text',{x:left+w/2,y:H-55,'text-anchor':'middle','font-size':S.axisSize,fill:'#172235'},d.geometry==='linear'?'q':'q_z'),el('text',{x:23,y:top+h/2,'text-anchor':'middle',transform:`rotate(-90 23 ${top+h/2})`,'font-size':S.axisSize,fill:'#172235'},d.geometry==='linear'?'a':'a_z'));
   [[T.first,'#2f62b8'],[T.second,'#ad6a25'],[T.both,'#23865b']].forEach(([label,color],i)=>svg.append(el('text',{x:left+i*240,y:54,'font-size':S.legendSize,fill:color},label)));
   figure.replaceChildren(svg);return{svg,rows};
  }
  function refresh(){
   sync();try{renderDesign();const d=inputs(),multi=higher(),c=multi?null:M.classify(d.p.a,d.p.q,d.geometry,d.count),drawn=multi?{svg:null,rows:[]}:draw(d);err.textContent='';last={...d,...drawn,classification:c};
    const box=root.querySelector('[data-ms-readout]');box.replaceChildren();const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
    if(multi){add(T.multipole);return;}add(`${T.readout}: ${T[c.status]} · a=${fmt(d.p.a)}, q=${fmt(d.p.q)}`);
    [c.first,c.second].forEach((p,i)=>{let diag;try{diag=M.diagnostic(p.a,p.q);}catch(_){diag={status:'unresolved',trace:NaN,det:NaN,trace_delta:NaN};}add(`${i?T.second:T.first}: ${T[p.status]} · ${T.band} ${p.band??'—'} · ${T.trace}=${fmt(diag.trace)}, ${T.det}=${fmt(diag.det)}, Δ=${fmt(diag.trace_delta)} · ${T[diag.status]}`);});add(T.diagnostic);
   }catch(e){last=null;lastDesign=null;designSVG=null;figure.replaceChildren();root.querySelector('[data-ms-readout]').replaceChildren();root.querySelector('[data-ms-design-readout]')?.replaceChildren();root.querySelector('[data-ms-design-figure]')?.replaceChildren();const sine=Math.sin(Math.PI/value('rod-count'));err.textContent=e.message==='rod overlap'?T.rod_overlap+' r/r₀ < '+fmt(sine/(1-sine)):e.message==='rod rule'?T.rule_unavailable:T.bad;}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(refresh,100);}
  if(window.ZGFigureStyle)styleControl=ZGFigureStyle.controls(root.querySelector('[data-ms-style]'),{lang:root.dataset.lang,prefix:'mathieu',baseline:{titleSize:20,axisSize:16,tickSize:13,legendSize:13,markerDiameter:10},onChange:queue});
  root.addEventListener('input',e=>{e.stopPropagation();if(['ms-mass','ms-charge','ms-species'].includes(e.target.name)){source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;}queue();});
  root.addEventListener('change',e=>{e.stopPropagation();if(e.target.matches('[data-ms-file]'))return;queue();});
  const save=(blob,name)=>{if(window.zgExport?.save)zgExport.save(blob,name);else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}};
  root.addEventListener('click',async e=>{
   e.stopPropagation();const action=e.target.closest('[data-ms-action]')?.dataset.msAction;if(!action)return;
   if(action==='fill'){err.textContent=T.loading;try{const cat=await ZGPhysics.load(root.dataset.catalogue,root.dataset.ame),r=cat.resolve(field('species').value);if(!Number.isInteger(r.q)||r.q<1||r.q>100)throw Error('charge');field('mass').value=r.ionMassU;field('charge').value=r.q;source={label:r.label,source:r.source,ionMassU:r.ionMassU,metadata:r};root.querySelector('[data-ms-source]').textContent=r.label+' · '+r.source;refresh();}catch(_){err.textContent=T.unavailable;}return;}
   if(action==='load'){root.querySelector('[data-ms-file]').click();return;}
   if(action==='reset'){Object.entries(defaults).forEach(([n,v])=>{const e=root.querySelector('[name="'+n+'"]');if(e.type==='checkbox')e.checked=v;else e.value=v;});source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;styleControl?.reset();refresh();return;}
   if(action==='save'){refresh();if(!last||styleControl?.valid&&!styleControl.valid())return;save(new Blob([JSON.stringify(state(),null,2)],{type:'application/json'}),'mathieu-settings.json');return;}
   refresh();if(!last)return;
   if(action==='design-json'){if(lastDesign)save(new Blob([JSON.stringify({...lastDesign,settings:state()},null,2)],{type:'application/json'}),'rfq-design-log.json');return;}
   if(action==='design-csv'){if(!lastDesign)return;const d=lastDesign.result,rows=[['record','quantity','value','unit','classification_or_note']];for(const[k,v]of Object.entries(d))if(typeof v==='number')rows.push(['result',k,v,k==='mass_u'?'u':k.endsWith('_mm')?'mm':k.endsWith('_MHz')?'MHz':k.endsWith('_eV')?'eV':k.endsWith('_V_m')?'V/m':k.endsWith('_V')?'V':'dimensionless','']);for(const c of lastDesign.candidates)rows.push(['candidate','RF_rod_peak',c.V_V,'V',c.classification?c.classification.status:'eta-target-only: '+c.eta_target_met]);for(const p of d.rod_coordinates)rows.push(['rod',p.index,`${p.x_mm};${p.y_mm}`,'mm',p.phase]);rows.push(['metadata','calculation_log',JSON.stringify(lastDesign),'JSON','']);const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';save(new Blob([csv],{type:'text/csv'}),'rfq-design-log.csv');return;}
   if(action==='design-svg'){if(designSVG&&window.ZGFigureStyle)await ZGFigureStyle.exportSVG(designSVG,'SVG','rfq-rod-geometry',styleControl?.get(),lastDesign);return;}
   if(higher())return;
   if(action==='csv'){const rows=[['plane','band_n','q','a_low','a_high','geometry']];last.rows.forEach(r=>{for(const k of ['first','second'])r[k].forEach(b=>rows.push([k,b.n,r.q,b.lo,b.hi,last.geometry]));});rows.push(['point','',last.p.q,last.p.a,last.classification.status,last.geometry]);save(new Blob([rows.map(r=>r.join(',')).join('\n')+'\n'],{type:'text/csv'}),'mathieu-bands.csv');return;}
   if(['svg','png'].includes(action)){if(styleControl?.valid&&!styleControl.valid())return;try{if(window.ZGFigureStyle){await ZGFigureStyle.exportSVG(last.svg,action.toUpperCase(),'mathieu-stability',styleControl?.get(),{inputs:state(),model:'ideal Mathieu characteristic bands',source:'https://dlmf.nist.gov/28.17'});}else if(action==='svg')save(new Blob([new XMLSerializer().serializeToString(last.svg)],{type:'image/svg+xml'}),'mathieu-stability.svg');}catch(_){err.textContent=T.badfile;}}
  });
  root.querySelector('[data-ms-file]').addEventListener('change',async e=>{e.stopPropagation();const file=e.target.files[0];if(!file)return;const before=state();try{if(file.size>300000)throw Error('size');const s=JSON.parse(await file.text());if(s.schema!=='traps-mathieu-v1'||!s.inputs||Object.keys(defaults).filter(k=>!designNames.includes(k.slice(3))).some(k=>!(k in s.inputs)))throw Error('schema');for(const key of designNames){const name='ms-'+key;if(!(name in s.inputs)&&field(key))field(key).value=defaults[name];}if(!('ms-rod-rule' in s.inputs)&&'ms-rod-radius' in s.inputs)field('rod-rule').value='radius';for(const [n,v]of Object.entries(s.inputs)){const el=root.querySelector('[name="'+n+'"]');if(!el||n.includes('"'))throw Error('key');if(el.type==='checkbox'){if(typeof v!=='boolean')throw Error('type');el.checked=v;}else el.value=String(v);}inputs();source=s.source&&typeof s.source==='object'?s.source:{label:T.manual};root.querySelector('[data-ms-source]').textContent=typeof source.label==='string'?source.label:T.manual;if(s.style)styleControl?.set(s.style);refresh();}catch(_){Object.entries(before.inputs).forEach(([n,v])=>{const el=root.querySelector('[name="'+n+'"]');if(el.type==='checkbox')el.checked=v;else el.value=v;});source=before.source;refresh();err.textContent=T.badfile;}finally{e.target.value='';}});
  refresh();
 });
})();
