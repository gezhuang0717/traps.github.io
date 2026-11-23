(function(){'use strict';
 const M=window.ZGMathieu,H=window.ZGRFQWorkbench,NS='http://www.w3.org/2000/svg',U=window.ZGUI;if(!M||!H)return;
 document.querySelectorAll('[data-mathieu]').forEach(root=>{
  if(root.dataset.mathieuReady)return;root.dataset.mathieuReady='true';
  const T=JSON.parse(root.dataset.labels),field=n=>root.querySelector('[name="ms-'+n+'"]'),value=n=>{const input=field(n);if(!input||!String(input.value).trim())return NaN;return Number(input.value);},err=root.querySelector('[data-ms-error]'),figure=root.querySelector('[data-ms-figure]');
  let source={label:T.manual},last=null,timer=null,styleControl=null,lastDesign=null,designSVG=null,lastStages=[],lastStageErrors=[],lastUncertainty=null;
  const geoOpen={v:false};   /* the rod-geometry group starts folded and keeps the state the visitor chose */
  const defaults=Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
  const el=(tag,attrs={},txt)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(txt!=null)e.textContent=txt;return e;};
  const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(7)).toString():'—';
  let convention=field('voltage-convention')?.value||'rod-peak';
  const peaks={},displayCache={};
  const voltageField=key=>field(H.voltageFields[key].slice(3));
  function peak(key){
   const input=voltageField(key);if(!input)throw Error('RF input');
   // Preserve the canonical number when only the display convention changes.
   // A genuine text edit is the only operation that reparses a displayed value.
   if(input.value!==displayCache[key]){
    if(!String(input.value).trim())throw Error('RF input');
    peaks[key]=H.toRodPeak(Number(input.value),convention);displayCache[key]=input.value;
   }
   if(!Number.isFinite(peaks[key]))throw Error('RF input');return peaks[key];
  }
  function setPeak(key,v){const input=voltageField(key);if(!input)return;const displayed=H.fromRodPeak(v,convention);peaks[key]=v;input.value=String(displayed);displayCache[key]=input.value;}
  function changeConvention(next){
   H.fromRodPeak(0,next);const valid={};
   for(const key of Object.keys(H.voltageFields))if(voltageField(key))try{valid[key]=peak(key);}catch(_){}
   convention=next;if(field('voltage-convention'))field('voltage-convention').value=next;
   for(const [key,v]of Object.entries(valid))setPeak(key,v);
  }
  function restoreVoltages(s){convention=s.voltage?.convention||'rod-peak';for(const key of Object.keys(displayCache))delete displayCache[key];for(const key of Object.keys(peaks))delete peaks[key];for(const [key,v]of Object.entries(s.voltage?.rod_peak_V||{}))setPeak(key,v);}
  function state(){return{schema:'traps-mathieu-v2',inputs:Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value])),voltage:{convention,rod_peak_V:Object.fromEntries(Object.keys(H.voltageFields).filter(k=>voltageField(k)).map(k=>[k,peak(k)]))},source,style:styleControl?.get()||null};}
  function selectedVoltagePoint(){return M.parameters(value('mass'),value('charge'),value('U'),peak('main'),value('r0'),value('f'));}
  function inputs(){
   const geometry=field('geometry').value,mode=geometry==='paul3d'?'direct':field('mode').value,count=value('bands'),qmax=value('qmax'),qmin=field('qmin')?value('qmin'):0,amin=value('amin'),amax=value('amax');
   if(!['linear','paul3d'].includes(geometry)||!['voltage','direct'].includes(mode)||!Number.isInteger(count)||count<1||count>6||!Number.isFinite(qmax)||qmax<=0||qmax>12||!Number.isFinite(qmin)||qmin<0||qmin>=qmax||!Number.isFinite(amin)||!Number.isFinite(amax)||amin>=amax||amin< -60||amax>60)throw Error('inputs');
   const p=mode==='voltage'?selectedVoltagePoint():{a:value('a'),q:value('q')};
   if(!Number.isFinite(p.a)||!Number.isFinite(p.q)||(!higher()&&Math.abs(p.q)>12))throw Error('inputs');
   const sections=[];
   if(geometry==='linear'&&!higher())for(const stage of lastStages)sections.push({key:stage.stage,...stage});
   return{geometry,mode,count,qmin,qmax,amin,amax,p,sections};
  }
  function higher(){const panel=root.querySelector('[data-local-panel="design"]');return !!field('rod-count')&&field('geometry').value==='linear'&&field('mode').value==='voltage'&&value('rod-count')>4&&(!panel||!panel.hidden);}
  // Mathieu remains an independent ideal four-rod reference when a separate design subtab uses a higher multipole.
  function designInputs(){
   const numeric=n=>{if(!field(n).value.trim())throw Error('blank');const x=Number(field(n).value);if(!Number.isFinite(x))throw Error('finite');return x;};
   const rule=field('rod-rule').value,input={mass_u:numeric('mass'),charge:numeric('charge'),U_V:numeric('U'),V_V:peak('main'),r0_mm:numeric('r0'),f_MHz:numeric('f'),rod_count:numeric('rod-count'),rod_rule:rule,radial_fraction:numeric('radial-fraction'),eta_target:numeric('eta-target'),bands:M.MAX_BANDS};
   if(rule==='ratio')input.rod_ratio=numeric('rod-ratio');if(rule==='radius')input.rod_radius_mm=numeric('rod-radius');
   if(field('diameter-tolerance').value.trim()!=='')input.diameter_tolerance_mm=numeric('diameter-tolerance');
   return input;
  }
  function renderDesign(){
   const box=root.querySelector('[data-ms-design-readout]'),holder=root.querySelector('[data-ms-design-figure]');if(!box||!holder)return;box.replaceChildren();holder.replaceChildren();lastDesign=null;designSVG=null;
   if(field('geometry').value!=='linear'||field('mode').value!=='voltage')return;
   const voltages=field('vscan').value.split(',').map(v=>{if(!v.trim())throw Error('RF scan');return Number(v);});
   const log=M.designLog(designInputs(),voltages),d=log.result,S=styleControl?.get()||{titleSize:18,tickSize:13,lineWidth:1};lastDesign=log;
   const rule=field('rod-rule').value;field('rod-ratio').disabled=rule!=='ratio';field('rod-radius').disabled=rule!=='radius';
   if(rule!=='ratio')field('rod-ratio').value=String(Number(d.rod_ratio.toPrecision(7)));if(rule!=='radius')field('rod-radius').value=String(Number(d.rod_radius_mm.toPrecision(7)));
   const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
   const dev=Math.abs(d.ratio_deviation_percent),devTone=dev<2?'ok':dev<10?'warn':'bad',t=(k,v,u,tone,hint,note)=>({k,v,u,tone,hint,note});
   const status=d.classification?d.classification.status:null,statusTone=status==='stable'?'ok':status==='unstable'?'bad':'warn';
   if(U){
    const nodes=[];
    const geo=U.group(T.grp_geometry,'info',[t(T.k_rod_count,`${d.rod_count} (n = ${d.rod_count/2})`,''),t(T.radius+' r₀',fmt(d.r0_mm),'mm',null,null,T.geometry_dimension_note),t(T.k_rod_radius,fmt(d.rod_radius_mm),'mm'),t(T.k_rod_diameter,fmt(d.rod_diameter_mm),'mm'),t(T.k_ratio,fmt(d.rod_ratio),'',devTone,T.geometry_out,T.n_ratio),t(T.k_deviation,fmt(d.ratio_deviation_percent),'%',devTone,null,T.n_deviation),
     t(T.k_outer,fmt(d.outer_radius_mm),'mm',null,T.envelope_out,T.n_outer),t(T.k_aperture,fmt(d.aperture_diameter_mm),'mm',null,null,T.n_aperture),t(T.k_adjacent,fmt(d.adjacent_center_mm),'mm',null,T.gaps,T.n_adjacent),t(T.k_gap,fmt(d.surface_gap_mm),'mm',null,null,T.n_gap),t(T.k_opposite,fmt(d.opposite_center_mm),'mm',null,null,T.n_opposite),
     t(T.k_parasitic,d.parasitic_A_over_An===null?T.parasitic_none:fmt(d.parasitic_A_over_An),'',d.parasitic_A_over_An===null?'warn':Math.abs(d.parasitic_A_over_An)<1e-3?'ok':'warn',T.parasitic_out,T.n_parasitic),
     ...(d.parasitic_at_radial_fraction===null?[]:[t(T.k_parasitic_x,fmt(d.parasitic_at_radial_fraction),'',null,null,T.n_parasitic_x)]),...(d.ratio_tolerance===null?[]:[t(T.k_tol,'±'+fmt(d.ratio_tolerance),'',null,null,T.n_tol)])],[],
     {fold:true,open:geoOpen.v,summary:[U.make('span','zg-pill',`Ø ${fmt(d.rod_diameter_mm)} mm`),U.make('span','zg-pill',`ρ/r₀ ${fmt(d.rod_ratio)}`),U.make('span','zg-pill '+(devTone==='bad'?'bad':devTone==='warn'?'warn':'ok'),`${fmt(d.ratio_deviation_percent)} %`)]});
    geo.addEventListener('toggle',()=>{geoOpen.v=geo.open;});nodes.push(geo);
    nodes.push(U.group(T.grp_rf,status?statusTone:d.eta_target_met?'ok':'warn',[...(status?[t(T.readout,T[status],'',statusTone)]:[]),t(T.k_field,fmt(d.field_RF_V_m),'V/m',null,T.field_depth,T.n_field),t(T.k_pseudo,fmt(d.pseudopotential_eV),'eV',null,null,T.n_pseudo),
     t(T.k_eta,`${fmt(d.eta)} / ${fmt(d.eta_target)}`,'',d.eta_target_met?'ok':'warn',T.eta_readout+' · '+(d.eta_target_met?T.target_met:T.target_above),T.n_eta),t(T.k_fmin,fmt(d.eta_frequency_min_MHz),'MHz',null,T.rf_target,T.n_fmin),t(T.k_vmax,fmt(d.eta_voltage_max_V),'V',null,null,T.n_vmax)]));
    if(d.V_V===0){const n=U.make('p','zg-notice',T.zero_rf);nodes.push(n);}
    if(d.suggested_RF){const chips=U.make('div','zg-chips');d.suggested_RF.forEach(x=>{const row=U.make('span','zg-chip-row'),use=U.make('button','',T.use_btn);use.type='button';use.dataset.msUse=String(Number(x.V_rod_peak_V.toPrecision(7)));row.append(U.make('b','','q = '+x.q),U.make('span','',`${fmt(x.V_rod_peak_V)} V · ${x.f_MHz_at_current_V===null?'—':fmt(x.f_MHz_at_current_V)} MHz`),use);chips.append(row);});nodes.push(U.group(T.grp_suggest,'ok',[],[U.make('p','zg-muted',T.rf_suggest),chips]));}
    const cand=U.make('div','zg-chips');log.candidates.forEach(c=>{const row=U.make('span','zg-chip-row'),st=c.classification?c.classification.status:null,tone=c.V_V===0?'warn':c.classification?(st==='stable'?'ok':st==='unstable'?'bad':'warn'):(c.eta_target_met?'ok':'warn');row.append(U.make('b','',fmt(c.V_V)+' V'),U.badge(c.classification?T[st]:c.eta_target_met?T.target_met:T.target_above,tone),U.make('span','',`η=${fmt(c.eta)} · ${fmt(c.pseudopotential_eV)} eV`));cand.append(row);});
    nodes.push(U.group(T.candidates,'info',[],[cand]));
    {const clean=v=>Math.abs(v)<1e-9*Math.max(1,d.center_radius_mm)?0:v,tb=U.make('tbody'),th=U.make('tr'),body=U.make('div');
     for(const h of [T.coord_rod,'x (mm)','y (mm)',T.coord_angle,T.coord_phase])th.append(U.make('th','',h));
     for(const q of d.rod_coordinates){const x=clean(q.x_mm),y=clean(q.y_mm),angle=((Math.atan2(y,x)*180/Math.PI)%360+360)%360,row=U.make('tr'),cells=[U.make('b','',String(q.index)),fmt(x),fmt(y),fmt(angle)+'°',U.badge(q.phase>0?'+V':'−V',q.phase>0?'info':'bad')];
      for(const c of cells){const td=U.make('td');if(c&&c.nodeType)td.append(c);else td.textContent=c;row.append(td);}tb.append(row);}
     const table=U.make('table','zg-table'),head=U.make('thead');head.append(th);table.append(head,tb);const wrap=U.make('div','rfq-table-scroll rfq-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',T.coordinates);wrap.append(table);
     body.append(U.make('p','zg-muted zg-small',`${T.coord_note} R_c = ${fmt(d.center_radius_mm)} mm, ρ = ${fmt(d.rod_radius_mm)} mm.`),wrap);nodes.push(U.fold(T.coordinates,body));}
    box.replaceChildren(...nodes);
   }else{
    add(`${T.geometry_out}: ${fmt(d.rod_radius_mm)} / ${fmt(d.rod_diameter_mm)} · ${fmt(d.rod_ratio)} · ${fmt(d.ratio_deviation_percent)}`);add(`${T.envelope_out}: ${fmt(d.outer_radius_mm)} / ${fmt(d.aperture_diameter_mm)}`);add(`${T.gaps}: ${fmt(d.adjacent_center_mm)} / ${fmt(d.surface_gap_mm)} / ${fmt(d.opposite_center_mm)}`);
    add(`${T.eta_readout}: ${fmt(d.eta)} / ${fmt(d.eta_target)} · ${d.eta_target_met?T.target_met:T.target_above}`);if(d.V_V===0)add(T.zero_rf);
   }
   const W=Math.min(620,layoutWidth(holder)),narrow=W<440,titleSize=Math.max(14,Math.min(S.titleSize,narrow?17:22)),labelSize=Math.max(11,Math.min(S.tickSize,narrow?12:14)),captionSize=11;
   const title=wrapLines(T.design_title,W-32,titleSize),top=24+title.length*(titleSize+4)+8;
   const extent=d.center_radius_mm+d.rod_radius_mm,radius=Math.min((W-40)/2,190),scale=radius/extent,cx=W/2,cy=top+radius;
   // Each named quantity keeps its own record. Values and millimetre units
   // move together to a new line rather than breaking an "mm" or a dimension.
   const dimensions=[
    {key:'rod-count',label:T.k_rod_count,value:`${d.rod_count} (n = ${d.rod_count/2})`},
    {key:'inscribed-radius',label:T.radius+' r₀',value:fmt(d.r0_mm)+' mm'},
    {key:'aperture-diameter',label:T.k_aperture,value:fmt(d.aperture_diameter_mm)+' mm'},
    {key:'rod-radius',label:T.k_rod_radius,value:fmt(d.rod_radius_mm)+' mm'},
    {key:'rod-radius-ratio',label:T.k_ratio,value:fmt(d.rod_ratio)},
    {key:'adjacent-centres',label:T.k_adjacent,value:fmt(d.adjacent_center_mm)+' mm'},
    {key:'surface-gap',label:T.k_gap,value:fmt(d.surface_gap_mm)+' mm'}
   ].map(item=>({...item,lines:textWidth(item.label+' = '+item.value,labelSize)<=W-32?[item.label+' = '+item.value]:[...wrapLines(item.label,W-32,labelSize),item.value]}));
   const dimensionY=cy+radius+24,dimensionsHeight=dimensions.reduce((height,item)=>height+item.lines.length*(labelSize+4)+4,0),legendY=dimensionY+dimensionsHeight+10;
   const legend=flow([{kind:'area',fill:'#dae6ff',color:'#315aa3',text:'+V'},{kind:'area',fill:'#ffe2da',color:'#ac4835',text:'−V'},{kind:'line',color:'#73808f',text:T.geometry_circle+' r₀'}],W-32,labelSize);
   const formulas=['ρ = (ρ/r₀) × r₀','R_c = r₀ + ρ','D = 2R_c sin(π/N)','g = D − 2ρ; N = 2n'].flatMap(line=>wrapLines(line,W-32,captionSize));
   const captionY=legendY+legendHeight(legend,labelSize)+6,H=captionY+formulas.length*(captionSize+4)+16;
   const svg=el('svg',{xmlns:NS,width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':T.design_title,'data-rfq-layout-width':W,'data-rfq-chart':'responsive','data-rfq-geometry':'round-rods','data-rfq-length-unit':'mm',style:'display:block;width:100%;max-width:620px;margin-inline:auto;height:auto;background:#fff;color:#172235;font-family:Arial,"Noto Sans",sans-serif'});
   svg.append(el('title',{},T.design_title),el('desc',{},T.geometry_dimension_note+' '+dimensions.map(item=>item.label+' = '+item.value).join('; ')),el('rect',{width:W,height:H,fill:'#fff'}),textLines(title,16,24,titleSize,{'font-weight':600,'data-chart-label':'title'}),el('circle',{cx,cy,r:d.r0_mm*scale,fill:'none',stroke:'#73808f','stroke-dasharray':'5 4','stroke-width':S.lineWidth,'data-rfq-aperture':'inscribed-circle'}));
   for(const p of d.rod_coordinates){
    const rodNode=el('circle',{cx:cx+p.x_mm*scale,cy:cy-p.y_mm*scale,r:d.rod_radius_mm*scale,fill:p.phase>0?'#dae6ff':'#ffe2da',stroke:p.phase>0?'#315aa3':'#ac4835','stroke-width':S.lineWidth,'data-rfq-rod':p.index});
    rodNode.append(el('title',{},`${p.index}: ${p.phase>0?'+':'−'}V, (${fmt(p.x_mm)}, ${fmt(p.y_mm)}) mm`));
    svg.append(rodNode,el('text',{x:cx+p.x_mm*scale,y:cy-p.y_mm*scale+labelSize*.34,'text-anchor':'middle','font-size':labelSize,fill:'#172235'},String(p.index)));
   }
   // Radius: axis to the right-hand inner surface. Diameter: the complete
   // vertical chord through the axis. Both use the same mm-to-pixel scale.
   const apertureRadius=d.r0_mm*scale,arrow=Math.min(5,apertureRadius/5),radiusColor='#0d6a72',diameterColor='#8a4f04';
   svg.append(
    el('line',{x1:cx,y1:cy-apertureRadius,x2:cx,y2:cy+apertureRadius,stroke:diameterColor,'stroke-width':Math.max(1.2,S.lineWidth),'data-rfq-dimension':'aperture-diameter','data-rfq-value-mm':d.aperture_diameter_mm}),
    el('path',{d:`M${cx-arrow/2},${cy-apertureRadius+arrow} L${cx},${cy-apertureRadius} L${cx+arrow/2},${cy-apertureRadius+arrow} M${cx-arrow/2},${cy+apertureRadius-arrow} L${cx},${cy+apertureRadius} L${cx+arrow/2},${cy+apertureRadius-arrow}`,fill:'none',stroke:diameterColor,'stroke-width':1.4}),
    el('line',{x1:cx,y1:cy,x2:cx+apertureRadius,y2:cy,stroke:radiusColor,'stroke-width':Math.max(1.2,S.lineWidth),'data-rfq-dimension':'inscribed-radius','data-rfq-value-mm':d.r0_mm}),
    el('path',{d:`M${cx+apertureRadius-arrow},${cy-arrow/2} L${cx+apertureRadius},${cy} L${cx+apertureRadius-arrow},${cy+arrow/2}`,fill:'none',stroke:radiusColor,'stroke-width':1.4}),
    el('text',{x:cx+apertureRadius*.55,y:cy-6,'text-anchor':'middle','font-size':labelSize,fill:radiusColor,'data-chart-label':'radius-dimension'},'r₀'),
    el('text',{x:cx-6,y:cy+labelSize*.35,'text-anchor':'end','font-size':labelSize,fill:diameterColor,'data-chart-label':'diameter-dimension'},'2r₀'),
    el('circle',{cx,cy,r:2,fill:'#172235'}));
   let dimensionOffset=0;for(const item of dimensions){
    svg.append(textLines(item.lines,16,dimensionY+dimensionOffset,labelSize,{'data-chart-label':'dimensions','data-rfq-quantity':item.key}));
    dimensionOffset+=item.lines.length*(labelSize+4)+4;
   }
   drawLegend(svg,legend,16,legendY,labelSize);
   svg.append(textLines(formulas,16,captionY,captionSize,{fill:'#53647a','data-chart-label':'caption'}));
   holder.append(svg);designSVG=svg;{const n=U?.notesBlock('rfq-geometry');if(n)holder.append(n);}

  }
  function sync(){
   const three=field('geometry').value==='paul3d';if(three)field('mode').value='direct';
   const multi=higher(),direct=three||field('mode').value==='direct';field('mode').disabled=three;
   root.querySelectorAll('[data-ms-voltage]').forEach(e=>{e.hidden=direct;});root.querySelectorAll('[data-ms-direct]').forEach(e=>{e.hidden=!direct;});
   root.querySelector('[data-ms-sections]').hidden=three;
   const designBox=root.querySelector('[data-ms-design]'),formulaBox=root.querySelector('[data-ms-band-formula]');if(designBox)designBox.hidden=three||direct;
   const directNote=root.querySelector('[data-ms-direct-design]');if(directNote)directNote.hidden=!direct;
   const referenceNote=root.querySelector('[data-ms-reference-note]');if(referenceNote)referenceNote.hidden=value('rod-count')<=4;
   const uncertainty=root.querySelector('[data-ms-uncertainty]');if(uncertainty)uncertainty.hidden=direct;
   root.querySelectorAll('[data-ms-stage-copy]').forEach(e=>{e.disabled=direct;});
   if(formulaBox)formulaBox.hidden=multi;root.querySelector('[data-ms-formula]').hidden=three;
   root.querySelector('[data-ms-mapping]').textContent=three?T.mapping_paul:T.mapping_linear;figure.hidden=multi;
   for(const action of ['svg','png','pdf','csv'])root.querySelector('[data-ms-action="'+action+'"]').disabled=multi;
  }
  function renderConversions(){
   const box=root.querySelector('[data-ms-conversions]');if(!box)return;box.hidden=field('mode').value!=='voltage';box.textContent='';
   if(box.hidden)return;
   try{const v=H.conversions(peak('main'));box.textContent=[[T.convention_rod_peak,v['rod-peak']],[T.convention_rod_pp,v['rod-pp']],[T.convention_diff_peak,v['differential-peak']],[T.convention_diff_pp,v['differential-pp']]].map(([label,x])=>label+': '+fmt(x)+' V').join(' · ');}catch(_){}
  }
  function renderUncertainty(){
   const box=root.querySelector('[data-ms-uncertainty-readout]');lastUncertainty=null;if(!box)return;box.replaceChildren();
   if(!field('uncertainty-on')?.checked||field('mode').value!=='voltage')return;
   try{
    lastUncertainty=H.uncertainty(selectedVoltagePoint(),{mass_u:value('sigma-mass'),V_rod_peak_V:peak('sigma'),r0_mm:value('sigma-r0'),f_MHz:value('sigma-f')});
    const r=lastUncertainty,p=document.createElement('p');p.textContent=`q = ${fmt(r.q)}; σ(q) = ${fmt(r.sigma_q)}; ${T.uncertainty_relative} = ${r.relative_sigma_q===null?'—':fmt(100*r.relative_sigma_q)+' %'}`;box.append(p);
    const sensitivities=document.createElement('p');sensitivities.className='zg-muted';sensitivities.textContent=T.sensitivity+': m −1; V +1; r₀ −2; f −2.';box.append(sensitivities);
   }catch(_){const p=document.createElement('p');p.textContent=T.uncertainty_bad;box.append(p);}
  }
  // Match the extension charts' CJK-aware wrapping even on the initial draw,
  // before rfq-chart.js has finished loading.
  const textWidth=(text,size)=>window.ZGRFQChart?.widthOf(text,size)??Array.from(String(text)).reduce((sum,ch)=>sum+size*(/[^\u0000-\u02ff]/u.test(ch)?1.02:/[ilI.,:;'| ]/.test(ch)?.34:.63),0);
  function wrapLines(text,maxWidth,size){
   if(window.ZGRFQChart)return window.ZGRFQChart.wrap(text,maxWidth,size);
   const lines=[];let line='';for(const token of String(text).split(/(\s+|(?=[\u3000-\u9fff]))/u).filter(Boolean)){
    if(line&&textWidth(line+token,size)>maxWidth){lines.push(line.trim());line='';}
    if(textWidth(token,size)>maxWidth){for(const ch of token){if(line&&textWidth(line+ch,size)>maxWidth){lines.push(line.trim());line='';}line+=ch;}}else line+=token;
   }if(line.trim())lines.push(line.trim());return lines.length?lines:[''];
  }
  function contentWidth(node){
   if(!node?.clientWidth)return 0;const css=window.getComputedStyle?.(node);
   return node.clientWidth-(parseFloat(css?.paddingLeft)||0)-(parseFloat(css?.paddingRight)||0);
  }
  const layoutWidth=node=>Math.round(Math.max(180,Math.min(1440,contentWidth(node)||contentWidth(root)||800)));
  const textLines=(lines,x,y,size,attrs={})=>{
   const node=el('text',{x,y,'font-size':size,fill:'#172235',...attrs});
   lines.forEach((line,i)=>node.append(el('tspan',{x,dy:i?size+4:0},line)));return node;
  };
  function flow(items,width,size){
   const rows=[[]];let x=0;for(const item of items){
    const lines=wrapLines(item.text,Math.max(32,width-30),size),w=Math.min(width,30+Math.max(...lines.map(line=>textWidth(line,size)))+12);
    if(x+w>width&&rows.at(-1).length){rows.push([]);x=0;}
    rows.at(-1).push({...item,lines,x,w});x+=w;
   }return rows;
  }
  const legendHeight=(rows,size)=>rows.reduce((sum,row)=>sum+Math.max(1,...row.map(item=>item.lines.length))*(size+4)+10,0);
  function drawLegend(svg,rows,x0,y0,size){
   let offset=0;rows.forEach(row=>{const y=y0+offset,mid=y-size/2+2;row.forEach(item=>{const x=x0+item.x,g=el('g',{});
    if(item.kind==='area')g.append(el('rect',{x,y:mid-6,width:20,height:12,fill:item.fill,stroke:item.color,'stroke-width':1}));
    if(item.kind==='line'||item.kind==='dotline')g.append(el('line',{x1:x,x2:x+20,y1:mid,y2:mid,stroke:item.color,'stroke-width':2,'stroke-dasharray':'6 3'}));
    if(item.kind==='dot'||item.kind==='dotline')g.append(el('circle',{cx:x+10,cy:mid,r:item.r,fill:item.color,stroke:item.stroke||'#fff','stroke-width':1.2}));
    g.append(textLines(item.lines,x+26,y,size,{'data-chart-label':'legend'}));if(item.title)g.append(el('title',{},item.title));svg.append(g);
   });offset+=Math.max(1,...row.map(item=>item.lines.length))*(size+4)+10;});
  }
  function draw(d){
   const S=styleControl?.get()||{titleSize:20,axisSize:16,tickSize:13,legendSize:13,markerDiameter:10,lineWidth:1};
   const W=layoutWidth(figure),narrow=W<520,lg=Math.max(11,Math.min(S.legendSize,narrow?12:16)),tickSize=Math.max(11,Math.min(S.tickSize,narrow?12:16)),axisSize=Math.max(11,Math.min(S.axisSize,narrow?14:20)),titleSize=Math.max(14,Math.min(S.titleSize,narrow?18:26));
   const tickFmt=x=>window.ZGRFQChart?.formatTick(x)??String(Number(x.toPrecision(4)));
   const yTicks=Array.from({length:narrow?5:6},(_,i)=>d.amin+(d.amax-d.amin)*i/(narrow?4:5));
   const left=Math.max(narrow?58:72,Math.max(...yTicks.map(a=>textWidth(tickFmt(a),tickSize)))+44),right=22,w=W-left-right,h=narrow?260:400,qr=d.qmax-d.qmin;
   const areaItems=[{kind:'area',fill:'#dfeafb',color:'#2f62b8',text:T.legend_first},{kind:'area',fill:'#ffe6ce',color:'#ad6a25',text:T.legend_second},{kind:'area',fill:'#8ed3ac',color:'#23865b',text:T.legend_both}];
   const colours=['#7b4dbb','#c54847','#008391'],qOf=x=>fmt(Math.abs(x));
   const markItems=[{kind:'dot',r:S.markerDiameter/2,color:'#172235',stroke:'#fff',text:`${T.legend_point}: q = ${qOf(d.p.q)}, a = ${fmt(d.p.a)}`,title:T.legend_point}];
   d.sections.forEach((sec,i)=>markItems.push({kind:'dotline',r:Math.max(2.5,S.markerDiameter*.4),color:colours[i],text:`${T[sec.key]}: q = ${qOf(sec.q)}, a = ${fmt(sec.a)}${sec.V_rod_peak_V?` (a/q = ${fmt(2*sec.U_V/sec.V_rod_peak_V)})`:''}`,title:`${T[sec.key]} · ${T.legend_line}`}));
   const detail=d.mode==='voltage'?`m = ${fmt(d.p.mass_u)} u · z = ${d.p.charge} · U = ${fmt(d.p.U_V)} V · V = ${fmt(d.p.V_rod_peak_V)} V · r₀ = ${fmt(d.p.r0_mm)} mm · f = ${fmt(d.p.f_MHz)} MHz`:T.caption_direct;
   const titleLines=wrapLines(T.title,W-32,titleSize),captionSize=Math.max(11,lg-1),caption=wrapLines((source.label&&source.label!==T.manual?source.label+' · ':'')+detail+'. '+T.caption_formulas,W-32,captionSize);
   const areaRows=flow(areaItems,W-32,lg),areaY=24+titleLines.length*(titleSize+4)+10,top=areaY+legendHeight(areaRows,lg)+12;
   const bottomRows=flow(markItems,W-32,lg),legendY=top+h+70,captionY=legendY+legendHeight(bottomRows,lg)+4,H=captionY+caption.length*(captionSize+4)+16;
   const svg=el('svg',{xmlns:NS,width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':T.title,'data-rfq-layout-width':W,'data-rfq-chart':'responsive',style:'display:block;width:100%;max-width:100%;height:auto;background:#fff;color:#172235;font-family:Arial,"Noto Sans",sans-serif'});
   svg.append(el('rect',{x:0,y:0,width:W,height:H,fill:'#fff'}),textLines(titleLines,16,24,titleSize,{'font-weight':600,'data-chart-label':'title'}));
   drawLegend(svg,areaRows,16,areaY,lg);
   const X=q=>left+(q-d.qmin)/qr*w,Y=a=>top+(d.amax-a)/(d.amax-d.amin)*h;
   const chart=el('svg',{x:left,y:top,width:w,height:h,viewBox:`${left} ${top} ${w} ${h}`,overflow:'hidden'});svg.append(chart);
   const qs=Array.from({length:241},(_,i)=>d.qmin+qr*i/240),factor=d.geometry==='linear'?1:2;
   const rows=qs.map(q=>{const first=M.bands(q,d.count),second=M.bands(q/factor,d.count).map(b=>({n:b.n,lo:-factor*b.hi,hi:-factor*b.lo}));return{q,first,second};});
   const path=(points,close=false)=>points.map(([x,y],i)=>(i?'L':'M')+fmt(X(x))+','+fmt(Y(y))).join(' ')+(close?'Z':'');
   function strip(select,fill){let run=[];const flush=()=>{if(run.length>1){const pts=run.map(r=>[r.q,r.lo]).concat(run.slice().reverse().map(r=>[r.q,r.hi]));chart.append(el('path',{d:path(pts,true),fill,stroke:'none'}));}run=[];};rows.forEach(r=>{const b=select(r);if(b&&b.hi>b.lo)run.push({q:r.q,...b});else flush();});flush();}
   for(let n=0;n<d.count;n++){strip(r=>r.first[n],'#dfeafb');strip(r=>r.second[n],'#ffe6ce');}
   for(let i=0;i<d.count;i++)for(let j=0;j<d.count;j++)strip(r=>({lo:Math.max(r.first[i].lo,r.second[j].lo),hi:Math.min(r.first[i].hi,r.second[j].hi)}),'#8ed3ac');
   const xIntervals=w<300?2:w<550?4:5;
   for(let i=0;i<=xIntervals;i++){const q=d.qmin+qr*i/xIntervals;chart.append(el('line',{x1:X(q),x2:X(q),y1:top,y2:top+h,stroke:'#d9dee6','stroke-width':.7}));svg.append(el('text',{x:X(q),y:top+h+23,'text-anchor':i===0?'start':i===xIntervals?'end':'middle','font-size':tickSize,fill:'#172235','data-chart-label':'x-tick'},tickFmt(q)));}
   for(const a of yTicks){chart.append(el('line',{x1:left,x2:left+w,y1:Y(a),y2:Y(a),stroke:'#d9dee6','stroke-width':.7}));svg.append(el('text',{x:left-10,y:Y(a)+4,'text-anchor':'end','font-size':tickSize,fill:'#172235','data-chart-label':'y-tick'},tickFmt(a)));}
   for(let n=0;n<d.count;n++)for(const [plane,color,dash] of [['first','#2f62b8',''],['second','#ad6a25','5 3']])for(const side of ['lo','hi'])chart.append(el('path',{d:path(rows.map(r=>[r.q,r[plane][n][side]])),fill:'none',stroke:color,'stroke-width':S.lineWidth,'stroke-dasharray':dash}));
   d.sections.forEach((sec,i)=>{const color=colours[i],ratio=sec.V_rod_peak_V?2*sec.U_V/sec.V_rod_peak_V:null;if(ratio!==null)chart.append(el('line',{x1:X(d.qmin),y1:Y(ratio*d.qmin),x2:X(d.qmax),y2:Y(ratio*d.qmax),stroke:color,'stroke-width':2*S.lineWidth,'stroke-dasharray':'7 3'}));if(sec.V_rod_peak_V===0)chart.append(el('line',{x1:X(0),x2:X(0),y1:top,y2:top+h,stroke:color,'stroke-width':2*S.lineWidth}));
    const dot=el('circle',{cx:X(Math.abs(sec.q)),cy:Y(sec.a),r:Math.max(2.5,S.markerDiameter*.4),fill:color,stroke:'#fff','stroke-width':1.2});dot.append(el('title',{},`${T[sec.key]}: q = ${qOf(sec.q)}, a = ${fmt(sec.a)}`));chart.append(dot);});
   const point=el('circle',{cx:X(Math.abs(d.p.q)),cy:Y(d.p.a),r:S.markerDiameter/2,fill:'#172235',stroke:'#fff','stroke-width':1.5});point.append(el('title',{},`${T.legend_point}: q = ${qOf(d.p.q)}, a = ${fmt(d.p.a)}`));chart.append(point);
   svg.append(el('rect',{x:left,y:top,width:w,height:h,fill:'none',stroke:'#172235'}),el('text',{x:left+w/2,y:top+h+48,'text-anchor':'middle','font-size':axisSize,fill:'#172235'},d.geometry==='linear'?'q':'q_z'),el('text',{x:16,y:top+h/2,'text-anchor':'middle',transform:`rotate(-90 16 ${top+h/2})`,'font-size':axisSize,fill:'#172235'},d.geometry==='linear'?'a':'a_z'));
   drawLegend(svg,bottomRows,16,legendY,lg);
   svg.append(textLines(caption,16,captionY,captionSize,{fill:'#53647a','data-chart-label':'caption'}));
   figure.replaceChildren(svg);return{svg,rows,view:{W,H,left,top,w,h,qmin:d.qmin,qmax:d.qmax,amin:d.amin,amax:d.amax}};
  }
  function renderStages(){
    const holder=root.querySelector('[data-ms-stage-readout]');
    if(!holder)return;
    holder.replaceChildren();lastStages=[];
    if(value('rod-count')>4){const note=document.createElement('p');note.className='zg-muted';note.textContent=T.quadrupole_reference;holder.append(note);}
    const head=[T.stage_name,'U (V)',T.convention_rod_peak+' (V)','r₀ (mm)','f (MHz)','a','q',T.readout];
    const table=document.createElement('table');table.className='zg-table';
    const trHead=document.createElement('tr');
    for(const h of head){const th=document.createElement('th');th.textContent=h;trHead.append(th);}
    const thead=document.createElement('thead');thead.append(trHead);table.append(thead);
    const tbody=document.createElement('tbody');
    const m=value('mass'),z=value('charge'),stageErrors=[];
    for(const key of ['cooler','mf','bun']){
      if(!field(key+'-on')?.checked)continue;
      try{
        const p=M.parameters(m,z,value(key+'-U'),peak(key),value(key+'-r0'),value(key+'-f'));
        const c=M.classify(p.a,p.q,'linear',M.MAX_BANDS);
        lastStages.push({stage:key,geometry:'ideal-four-rod-linear-RFQ',...p,classification:c.status,voltage_convention:'rod-peak'});
        const row=document.createElement('tr');
        for(const cell of [T[key],p.U_V,p.V_rod_peak_V,p.r0_mm,p.f_MHz,fmt(p.a),fmt(p.q),T[c.status]]){
          const td=document.createElement('td');td.textContent=String(cell);row.append(td);
        }
        tbody.append(row);
      }catch(_){
        const row=document.createElement('tr'),cell=document.createElement('td');
        cell.colSpan=head.length;cell.textContent=T[key]+': '+T.bad;row.append(cell);tbody.append(row);stageErrors.push(T[key]);
      }
    }
    lastStageErrors=stageErrors;const stageNotice=root.querySelector('[data-ms-stage-error]');if(stageNotice)stageNotice.textContent=stageErrors.length?T.stage_error+' '+stageErrors.join(', '):'';
    if(!tbody.children.length){const notice=document.createElement('p');notice.textContent=T.section_note;holder.append(notice);return;}
    table.append(tbody);const wrap=document.createElement('div');wrap.className='rfq-table-scroll rfq-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',T.sections);wrap.append(table);holder.append(wrap);
  }
  function designErrorText(e){return e.message==='rod overlap'?T.rod_overlap+' ρ/r₀ < '+fmt(Math.sin(Math.PI/value('rod-count'))/(1-Math.sin(Math.PI/value('rod-count')))):e.message==='rod rule'?T.rule_unavailable:T.bad;}
  function refresh(){
   // All programmatic changes (stage apply, reset, presets and file loads)
   // notify the dependent RFQ panels after this synchronous refresh.
   queueMicrotask(()=>root.dispatchEvent(new CustomEvent('rfq:statechange')));
   sync();let designError=null;
   const designNotice=root.querySelector('[data-ms-design-error]');if(designNotice)designNotice.textContent='';
   try{renderDesign();}catch(e){designError=e;lastDesign=null;designSVG=null;root.querySelector('[data-ms-design-readout]')?.replaceChildren();root.querySelector('[data-ms-design-figure]')?.replaceChildren();if(designNotice)designNotice.textContent=designErrorText(e);}
   renderStages();renderConversions();renderUncertainty();
   try{const d=inputs(),multi=higher(),c=multi?null:M.classify(d.p.a,d.p.q,d.geometry,d.count),drawn=multi?{svg:null,rows:[]}:draw(d);err.textContent=designError&&!designNotice?designErrorText(designError):'';last={...d,...drawn,classification:c};
    const box=root.querySelector('[data-ms-readout]');box.replaceChildren();const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
    if(multi){add(T.multipole);return;}
    const tone=st=>st==='stable'?'ok':st==='unstable'?'bad':st==='boundary'||st==='unresolved'?'warn':'info',planes=[c.first,c.second].map((p,i)=>{let diag;try{diag=M.diagnostic(p.a,p.q);}catch(_){diag={status:'unresolved',trace:NaN,det:NaN,trace_delta:NaN};}return{p,i,diag};});
    if(U){
     const nodes=[U.group(T.grp_point,tone(c.status),[{k:T.readout,v:T[c.status],tone:tone(c.status)},{k:'q',v:fmt(d.p.q)},{k:'a',v:fmt(d.p.a)},...(source.label&&source.label!==T.manual?[{k:T.species,v:source.label}]:[])])];
     for(const{p,i,diag}of planes)nodes.push(U.group(i?T.second:T.first,tone(p.status),[{k:T.k_status,v:T[p.status],tone:tone(p.status)},{k:T.band,v:String(p.band??'—')},{k:T.trace,v:fmt(diag.trace),hint:T.diagnostic},{k:T.det,v:fmt(diag.det)},{k:'Δ',v:fmt(diag.trace_delta),hint:T.diagnostic},{k:T.k_status+' (Floquet)',v:T[diag.status],tone:tone(diag.status)}]));
     nodes.push(U.make('p','zg-muted zg-small',T.diagnostic));box.replaceChildren(...nodes);
    }else{add(`${T.readout}: ${T[c.status]} · a=${fmt(d.p.a)}, q=${fmt(d.p.q)}`);planes.forEach(({p,i,diag})=>add(`${i?T.second:T.first}: ${T[p.status]} · ${T.band} ${p.band??'—'} · ${T.trace}=${fmt(diag.trace)}, ${T.det}=${fmt(diag.det)}, Δ=${fmt(diag.trace_delta)} · ${T[diag.status]}`));add(T.diagnostic);}
   }catch(e){last=null;figure.replaceChildren();root.querySelector('[data-ms-readout]').replaceChildren();const sine=Math.sin(Math.PI/value('rod-count'));err.textContent=e.message==='rod overlap'?T.rod_overlap+' ρ/r₀ < '+fmt(sine/(1-sine)):e.message==='rod rule'?T.rule_unavailable:T.bad;}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(refresh,100);}
  let resizeTimer=null;
  function redrawResponsiveFigures(){
   const designHolder=root.querySelector('[data-ms-design-figure]');
   if(figure.clientWidth>0&&!figure.hidden&&last?.svg&&Number(last.svg.dataset.rfqLayoutWidth)!==layoutWidth(figure)){
    try{last={...last,...draw(last)};}catch(_){/* An independent input error is handled by refresh(). */}
   }
   if(designHolder?.clientWidth>0&&designSVG&&Number(designSVG.dataset.rfqLayoutWidth)!==Math.min(620,layoutWidth(designHolder))){
    try{renderDesign();}catch(_){/* Preserve the existing validation feedback. */}
   }
  }
  const queueResponsiveDraw=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(redrawResponsiveFigures,80);};
  window.addEventListener?.('resize',queueResponsiveDraw,{passive:true});
  root.addEventListener('rfq:statechange',queueResponsiveDraw);
  const clampView=v=>{let{qmin,qmax,amin,amax}=v;if(qmin<0){qmax-=qmin;qmin=0;}if(qmax>12){qmin=Math.max(0,qmin-(qmax-12));qmax=12;}if(amin<-60){amax+=-60-amin;amin=-60;}if(amax>60){amin-=amax-60;amax=60;}return{qmin,qmax,amin,amax};};
  function setView(v){for(const[k,x]of Object.entries(clampView(v))){const f=field(k);if(f)f.value=String(Number(x.toPrecision(6)));}queue();}
  function zoom(factor,q0,a0){const m=last?.view;if(!m)return;q0=q0??(m.qmin+m.qmax)/2;a0=a0??(m.amin+m.amax)/2;const v={qmin:q0-(q0-m.qmin)*factor,qmax:q0+(m.qmax-q0)*factor,amin:a0-(a0-m.amin)*factor,amax:a0+(m.amax-a0)*factor};if(!(v.qmax-v.qmin>1e-3)||!(v.amax-v.amin>1e-3))return;setView(v);}
  function resetView(){for(const k of ['qmin','qmax','amin','amax']){const f=field(k);if(f&&('ms-'+k) in defaults)f.value=defaults['ms-'+k];}queue();}
  const toData=(e,svg)=>{const m=last?.view;if(!m||!svg.getBoundingClientRect)return null;const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*m.W,vy=(e.clientY-r.top)/r.height*m.H;return{q:m.qmin+(vx-m.left)/m.w*(m.qmax-m.qmin),a:m.amax-(vy-m.top)/m.h*(m.amax-m.amin),inside:vx>=m.left&&vx<=m.left+m.w&&vy>=m.top&&vy<=m.top+m.h,rect:r};};
  let drag=null;const endDrag=()=>{drag=null;if(figure.style)figure.style.cursor='';};
  figure.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;const svg=figure.querySelector('svg'),p=svg&&toData(e,svg);if(!p||!p.inside)return;e.preventDefault();zoom(e.deltaY<0?.8:1.25,p.q,p.a);},{passive:false});
  figure.addEventListener('pointerdown',e=>{const svg=figure.querySelector('svg'),p=svg&&toData(e,svg);if(!p||!p.inside||e.button!==0)return;drag={x:e.clientX,y:e.clientY,view:{...last.view},rect:p.rect};figure.setPointerCapture?.(e.pointerId);if(figure.style)figure.style.cursor='grabbing';});
  figure.addEventListener('pointermove',e=>{if(!drag)return;const m=drag.view,dq=-(e.clientX-drag.x)/drag.rect.width*m.W/m.w*(m.qmax-m.qmin),da=(e.clientY-drag.y)/drag.rect.height*m.H/m.h*(m.amax-m.amin);setView({qmin:m.qmin+dq,qmax:m.qmax+dq,amin:m.amin+da,amax:m.amax+da});});
  figure.addEventListener('pointerup',endDrag);figure.addEventListener('pointercancel',endDrag);figure.addEventListener('dblclick',resetView);
  if(window.ZGFigureStyle)styleControl=ZGFigureStyle.controls(root.querySelector('[data-ms-style]'),{lang:root.dataset.lang,prefix:'mathieu',baseline:{titleSize:20,axisSize:16,tickSize:13,legendSize:13,markerDiameter:10},onChange:queue});
  root.addEventListener('input',e=>{if(e.target.closest?.('[data-rfq-extras-pane],[data-local-panel="resonance"]')||e.target.name?.startsWith('rx-'))return;e.stopPropagation();if(e.target.name==='ms-voltage-convention'){changeConvention(e.target.value);refresh();return;}if(['ms-mass','ms-charge','ms-species'].includes(e.target.name)){source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;}queue();});
  root.addEventListener('change',e=>{if(e.target.closest?.('[data-rfq-extras-pane],[data-local-panel="resonance"]')||e.target.name?.startsWith('rx-'))return;e.stopPropagation();if(e.target.matches?.('[data-ms-file]'))return;if(e.target.name==='ms-voltage-convention'){if(e.target.value!==convention)changeConvention(e.target.value);refresh();return;}queue();});
  root.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.closest?.('[data-local-tab]'))queue();});
  const save=(blob,name)=>{if(window.zgExport?.save)zgExport.save(blob,name);else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}};
  root.addEventListener('click',async e=>{
   e.stopPropagation();const useBtn=e.target.closest('[data-ms-use]');if(useBtn&&useBtn.dataset.msUse!==undefined){setPeak('main',Number(useBtn.dataset.msUse));refresh();return;}
   const applyStage=e.target.closest('[data-ms-stage-apply]')?.dataset.msStageApply,copyStage=e.target.closest('[data-ms-stage-copy]')?.dataset.msStageCopy;
   if(applyStage||copyStage){
    const key=applyStage||copyStage;if(!['cooler','mf','bun'].includes(key))return;
    try{
     if(applyStage){
      const p=M.parameters(value('mass'),value('charge'),value(key+'-U'),peak(key),value(key+'-r0'),value(key+'-f'));
      field('geometry').value='linear';field('mode').value='voltage';
      for(const [n,v]of Object.entries({U:p.U_V,r0:p.r0_mm,f:p.f_MHz}))field(n).value=String(v);setPeak('main',p.V_rod_peak_V);
     }else{
      if(field('mode').value!=='voltage'||field('geometry').value!=='linear')return;
      const p=selectedVoltagePoint();for(const [n,v]of Object.entries({U:p.U_V,r0:p.r0_mm,f:p.f_MHz}))field(key+'-'+n).value=String(v);setPeak(key,p.V_rod_peak_V);
     }
     field(key+'-on').checked=true;refresh();const note=root.querySelector('[data-ms-stage-feedback]');if(note)note.textContent=(applyStage?T.stage_applied:T.stage_copied)+': '+T[key];
    }catch(_){const notice=root.querySelector('[data-ms-stage-error]');if(notice)notice.textContent=T[key]+': '+T.bad;else err.textContent=T.bad;}return;
   }
   const tab=e.target.closest('[data-local-tab]')?.dataset.localTab;
   if(tab==='design'||tab==='classic'){refresh();return;}
   const action=e.target.closest('[data-ms-action]')?.dataset.msAction;if(!action)return;
   if(action==='voltage-mode'){field('geometry').value='linear';field('mode').value='voltage';refresh();return;}
   if(action==='stable-demo'){try{const unit=M.parameters(value('mass'),value('charge'),0,1,value('r0'),value('f'));field('geometry').value='linear';field('mode').value='voltage';field('rod-count').value='4';field('U').value='0';setPeak('main',0.4/unit.q);refresh();}catch(_){err.textContent=T.bad;}return;}
   if(action==='zoom-in'){zoom(.8);return;}if(action==='zoom-out'){zoom(1.25);return;}if(action==='reset-view'){resetView();return;}
   if(action==='fill'){err.textContent=T.loading;try{const cat=await ZGPhysics.load(root.dataset.catalogue,root.dataset.ame),r=cat.resolve(field('species').value);if(!Number.isInteger(r.q)||r.q<1||r.q>100)throw Error('charge');field('mass').value=r.ionMassU;field('charge').value=r.q;source={label:r.label,source:r.source,ionMassU:r.ionMassU,metadata:r};root.querySelector('[data-ms-source]').textContent=r.label+' · '+r.source;refresh();}catch(_){err.textContent=T.unavailable;}return;}
   if(action==='load'){root.querySelector('[data-ms-file]').click();return;}
   if(action==='reset'){Object.entries(defaults).forEach(([n,v])=>{const e=root.querySelector('[name="'+n+'"]');if(e.type==='checkbox')e.checked=v;else e.value=v;});restoreVoltages({voltage:{convention:'rod-peak',rod_peak_V:{}}});source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;styleControl?.reset();refresh();return;}
   if(action==='save'){refresh();if(!last||styleControl?.valid&&!styleControl.valid())return;try{save(new Blob([JSON.stringify(state(),null,2)],{type:'application/json'}),'mathieu-settings.json');}catch(_){err.textContent=T.bad;}return;}
   refresh();
   const settings=()=>{try{return state();}catch(_){return null;}},log=()=>({...lastDesign,limits:lastDesign.limits.replace(', uncertainty propagation',''),q_uncertainty:lastUncertainty,display_voltage_convention:convention,stage_comparison:lastStages,stage_input_errors:[...lastStageErrors],settings:settings()});
   if(action==='stage-json'){
    try{const s=state(),stages=['cooler','mf','bun'].map(key=>({stage:key,enabled:field(key+'-on').checked,...M.parameters(value('mass'),value('charge'),value(key+'-U'),peak(key),value(key+'-r0'),value(key+'-f'))}));save(new Blob([JSON.stringify({schema:'traps-rfq-stages-v1',model:'independent ideal four-rod RFQ stages; no beam transport',voltage_convention:'rod-peak',stages,settings:s},null,2)],{type:'application/json'}),'rfq-stage-settings.json');}catch(_){const notice=root.querySelector('[data-ms-stage-error]');if(notice)notice.textContent=T.bad;else err.textContent=T.bad;}return;
   }
   if(action==='design-json'){if(lastDesign)save(new Blob([JSON.stringify(log(),null,2)],{type:'application/json'}),'rfq-design-log.json');return;}

   if(action==='design-csv'){if(!lastDesign)return;const d=lastDesign.result,rows=[['record','quantity','value','unit','classification_or_note']];for(const[k,v]of Object.entries(d))if(typeof v==='number')rows.push(['result',k,v,k==='mass_u'?'u':k.endsWith('_mm')?'mm':k.endsWith('_MHz')?'MHz':k.endsWith('_eV')?'eV':k.endsWith('_V_m')?'V/m':k.endsWith('_V')?'V':'dimensionless','']);for(const c of lastDesign.candidates)rows.push(['candidate','RF_rod_peak',c.V_V,'V',c.classification?c.classification.status:'eta-target-only: '+c.eta_target_met]);for(const p of d.rod_coordinates)rows.push(['rod',p.index,`${p.x_mm};${p.y_mm}`,'mm',p.phase]);for(const stage of lastStages){rows.push(['stage',stage.stage,'ideal 4-rod Mathieu','model',stage.classification]);for(const k of ['a','q','U_V','V_rod_peak_V','r0_mm','f_MHz'])rows.push(['stage',stage.stage+':'+k,stage[k],k.endsWith('_V')?'V':k.endsWith('_mm')?'mm':k.endsWith('_MHz')?'MHz':'dimensionless',stage.classification]);}if(lastUncertainty){rows.push(['uncertainty','sigma_q',lastUncertainty.sigma_q,'dimensionless',lastUncertainty.model]);for(const c of lastUncertainty.contributions)rows.push(['uncertainty',c.input,c.sigma,'input unit','dq/dinput='+c.derivative]);}rows.push(['metadata','calculation_log',JSON.stringify(log()),'JSON','']);const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';save(new Blob([csv],{type:'text/csv'}),'rfq-design-log.csv');return;}
   if(['design-svg','design-png','design-pdf'].includes(action)){try{if(designSVG&&window.ZGFigureStyle)await ZGFigureStyle.exportSVG(designSVG,action.slice(7).toUpperCase(),'rfq-rod-geometry',styleControl?.get(),lastDesign);}catch(_){root.querySelector('[data-ms-design-error]').textContent=T.badfile;}return;}
   if(!last||higher())return;
   if(action==='csv'){const rows=[['plane','band_n','q','a_low','a_high','geometry']];last.rows.forEach(r=>{for(const k of ['first','second'])r[k].forEach(b=>rows.push([k,b.n,r.q,b.lo,b.hi,last.geometry]));});rows.push(['point','',last.p.q,last.p.a,last.classification.status,last.geometry]);save(new Blob([rows.map(r=>r.join(',')).join('\n')+'\n'],{type:'text/csv'}),'mathieu-bands.csv');return;}
   if(['svg','png','pdf'].includes(action)){if(styleControl?.valid&&!styleControl.valid())return;try{if(window.ZGFigureStyle){await ZGFigureStyle.exportSVG(last.svg,action.toUpperCase(),'mathieu-stability',styleControl?.get(),{inputs:state(),model:'ideal Mathieu characteristic bands',source:'https://dlmf.nist.gov/28.17'});}else if(action==='svg')save(new Blob([new XMLSerializer().serializeToString(last.svg)],{type:'image/svg+xml'}),'mathieu-stability.svg');}catch(_){err.textContent=T.badfile;}}
  });
  root.querySelector('[data-ms-file]').addEventListener('change',async e=>{
   e.stopPropagation();const file=e.target.files[0];if(!file)return;
   const before={inputs:Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(x=>[x.name,x.type==='checkbox'?x.checked:x.value])),convention,peaks:{...peaks},displayCache:{...displayCache},source,style:styleControl?.get()||null};
   const applyInputs=values=>Object.entries(values).forEach(([name,v])=>{const input=field(name.slice(3));if(input.type==='checkbox')input.checked=v;else input.value=String(v);});
   try{
    if(file.size>300000)throw Error('size');const normalized=H.normalizeSettings(JSON.parse(await file.text()),defaults,T.manual);
    applyInputs(normalized.inputs);restoreVoltages(normalized);inputs();
    source=normalized.source;root.querySelector('[data-ms-source]').textContent=source.label;if(normalized.style)styleControl?.set(normalized.style);refresh();
   }catch(_){
    applyInputs(before.inputs);convention=before.convention;for(const key of Object.keys(peaks))delete peaks[key];Object.assign(peaks,before.peaks);for(const key of Object.keys(displayCache))delete displayCache[key];Object.assign(displayCache,before.displayCache);
    source=before.source;root.querySelector('[data-ms-source]').textContent=source.label;if(before.style)styleControl?.set(before.style);refresh();err.textContent=T.badfile;
   }finally{e.target.value='';}
  });
  {const n=U?.notesBlock('mathieu');if(n)figure.after(n);const slot=root.querySelector('[data-ms-design-notes]'),dn=U?.notesBlock('rfq-design');if(slot&&dn)slot.append(dn);}
  // The game links to this canonical workbench with a versioned, validated
  // operating-point preset. An ion name in the URL is NOT catalogue provenance:
  // visitors must use 'Fill ion mass' to obtain an evaluated catalogue value.
  let importError=false;
  try{
   const preset=window.ZGRFQPreset?.parse(window.location?.search||'');
   if(preset){
    const map={mass_u:'mass',charge:'charge',U_V:'U',V_rod_peak_V:'V',r0_mm:'r0',f_MHz:'f'};
    field('geometry').value='linear';field('mode').value='voltage';field('rod-count').value='4';
    for(const [key,target] of Object.entries(map))field(target).value=String(preset[key]);
    field('species').value=preset.species;
    for(const stage of ['cooler','mf','bun'])field(stage+'-on').checked=false;
    source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;
   }
  }catch(_){importError=true;}
  refresh();
  if(importError)err.textContent=T.badfile;
 });
})();
