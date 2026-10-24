(function(){'use strict';
 const M=window.ZGMathieu,NS='http://www.w3.org/2000/svg',U=window.ZGUI;if(!M)return;
 document.querySelectorAll('[data-mathieu]').forEach(root=>{
  if(root.dataset.mathieuReady)return;root.dataset.mathieuReady='true';
  const T=JSON.parse(root.dataset.labels),field=n=>root.querySelector('[name="ms-'+n+'"]'),value=n=>+field(n).value,err=root.querySelector('[data-ms-error]'),figure=root.querySelector('[data-ms-figure]');
  let source={label:T.manual},last=null,timer=null,styleControl=null,lastDesign=null,designSVG=null;
  const geoOpen={v:false};   /* the rod-geometry group starts folded and keeps the state the visitor chose */
  const defaults=Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));
  const el=(tag,attrs={},txt)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(txt!=null)e.textContent=txt;return e;};
  const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(7)).toString():'—';
  function state(){return{schema:'traps-mathieu-v1',inputs:Object.fromEntries([...root.querySelectorAll('[name^="ms-"]')].map(e=>[e.name,e.type==='checkbox'?e.checked:e.value])),source,style:styleControl?.get()||null};}
  function inputs(){
   const geometry=field('geometry').value,mode=geometry==='paul3d'?'direct':field('mode').value,count=value('bands'),qmax=value('qmax'),qmin=field('qmin')?value('qmin'):0,amin=value('amin'),amax=value('amax');
   if(!['linear','paul3d'].includes(geometry)||!['voltage','direct'].includes(mode)||!Number.isInteger(count)||count<1||count>6||!Number.isFinite(qmax)||qmax<=0||qmax>12||!Number.isFinite(qmin)||qmin<0||qmin>=qmax||!Number.isFinite(amin)||!Number.isFinite(amax)||amin>=amax||amin< -60||amax>60)throw Error('inputs');
   const p=mode==='voltage'?M.parameters(value('mass'),value('charge'),value('U'),value('V'),value('r0'),value('f')):{a:value('a'),q:value('q')};
   if(!Number.isFinite(p.a)||!Number.isFinite(p.q)||(!higher()&&Math.abs(p.q)>12))throw Error('inputs');
   const sections=[];
   if(geometry==='linear'&&!higher())for(const key of ['cooler','mf','bun'])if(field(key+'-on').checked){const x=M.parameters(value('mass'),value('charge'),value(key+'-U'),value(key+'-V'),value(key+'-r0'),value(key+'-f'));sections.push({key,...x});}
   return{geometry,mode,count,qmin,qmax,amin,amax,p,sections};
  }
  const designNames=['qmin','rod-count','rod-rule','rod-ratio','rod-radius','diameter-tolerance','radial-fraction','eta-target','vscan'];
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
   const rule=field('rod-rule').value;field('rod-ratio').disabled=rule!=='ratio';field('rod-radius').disabled=rule!=='radius';
   if(rule!=='ratio')field('rod-ratio').value=String(Number(d.rod_ratio.toPrecision(7)));if(rule!=='radius')field('rod-radius').value=String(Number(d.rod_radius_mm.toPrecision(7)));
   const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
   const dev=Math.abs(d.ratio_deviation_percent),devTone=dev<2?'ok':dev<10?'warn':'bad',t=(k,v,u,tone,hint,note)=>({k,v,u,tone,hint,note});
   const status=d.classification?d.classification.status:null,statusTone=status==='stable'?'ok':status==='unstable'?'bad':'warn';
   if(U){
    const nodes=[];
    const geo=U.group(T.grp_geometry,'info',[t(T.k_rod_radius,fmt(d.rod_radius_mm),'mm'),t(T.k_rod_diameter,fmt(d.rod_diameter_mm),'mm'),t(T.k_ratio,fmt(d.rod_ratio),'',devTone,T.geometry_out,T.n_ratio),t(T.k_deviation,fmt(d.ratio_deviation_percent),'%',devTone,null,T.n_deviation),
     t(T.k_outer,fmt(d.outer_radius_mm),'mm',null,T.envelope_out,T.n_outer),t(T.k_aperture,fmt(d.aperture_diameter_mm),'mm',null,null,T.n_aperture),t(T.k_adjacent,fmt(d.adjacent_center_mm),'mm',null,T.gaps,T.n_adjacent),t(T.k_gap,fmt(d.surface_gap_mm),'mm',null,null,T.n_gap),t(T.k_opposite,fmt(d.opposite_center_mm),'mm',null,null,T.n_opposite),
     t(T.k_parasitic,d.parasitic_A_over_An===null?T.parasitic_none:fmt(d.parasitic_A_over_An),'',d.parasitic_A_over_An===null?'warn':Math.abs(d.parasitic_A_over_An)<1e-3?'ok':'warn',T.parasitic_out,T.n_parasitic),
     ...(d.parasitic_at_radial_fraction===null?[]:[t(T.k_parasitic_x,fmt(d.parasitic_at_radial_fraction),'',null,null,T.n_parasitic_x)]),...(d.ratio_tolerance===null?[]:[t(T.k_tol,'±'+fmt(d.ratio_tolerance),'',null,null,T.n_tol)])],[],
     {fold:true,open:geoOpen.v,summary:[U.make('span','zg-pill',`Ø ${fmt(d.rod_diameter_mm)} mm`),U.make('span','zg-pill',`r/r₀ ${fmt(d.rod_ratio)}`),U.make('span','zg-pill '+(devTone==='bad'?'bad':devTone==='warn'?'warn':'ok'),`${fmt(d.ratio_deviation_percent)} %`)]});
    geo.addEventListener('toggle',()=>{geoOpen.v=geo.open;});nodes.push(geo);
    nodes.push(U.group(T.grp_rf,status?statusTone:d.eta_target_met?'ok':'warn',[...(status?[t(T.readout,T[status],'',statusTone)]:[]),t(T.k_field,fmt(d.field_RF_V_m),'V/m',null,T.field_depth,T.n_field),t(T.k_pseudo,fmt(d.pseudopotential_eV),'eV',null,null,T.n_pseudo),
     t(T.k_eta,`${fmt(d.eta)} / ${fmt(d.eta_target)}`,'',d.eta_target_met?'ok':'warn',T.eta_readout+' · '+(d.eta_target_met?T.target_met:T.target_above),T.n_eta),t(T.k_fmin,fmt(d.eta_frequency_min_MHz),'MHz',null,T.rf_target,T.n_fmin),t(T.k_vmax,fmt(d.eta_voltage_max_V),'V',null,null,T.n_vmax)]));
    if(d.V_V===0){const n=U.make('p','zg-notice',T.zero_rf);nodes.push(n);}
    if(d.suggested_RF){const chips=U.make('div','zg-chips');d.suggested_RF.forEach(x=>{const row=U.make('span','zg-chip-row'),use=U.make('button','',T.use_btn);use.type='button';use.dataset.msUse=String(Number(x.V_rod_peak_V.toPrecision(7)));row.append(U.make('b','','q = '+x.q),U.make('span','',`${fmt(x.V_rod_peak_V)} V · ${x.f_MHz_at_current_V===null?'—':fmt(x.f_MHz_at_current_V)} MHz`),use);chips.append(row);});nodes.push(U.group(T.grp_suggest,'ok',[],[U.make('p','zg-muted',T.rf_suggest),chips]));}
    const cand=U.make('div','zg-chips');log.candidates.forEach(c=>{const row=U.make('span','zg-chip-row'),st=c.classification?c.classification.status:null,tone=c.classification?(st==='stable'?'ok':st==='unstable'?'bad':'warn'):(c.eta_target_met?'ok':'warn');row.append(U.make('b','',fmt(c.V_V)+' V'),U.badge(c.classification?T[st]:c.eta_target_met?T.target_met:T.target_above,tone),U.make('span','',`η=${fmt(c.eta)} · ${fmt(c.pseudopotential_eV)} eV`));cand.append(row);});
    nodes.push(U.group(T.candidates,'info',[],[cand]));
    {const clean=v=>Math.abs(v)<1e-9*Math.max(1,d.center_radius_mm)?0:v,tb=U.make('tbody'),th=U.make('tr'),body=U.make('div');
     for(const h of [T.coord_rod,'x (mm)','y (mm)',T.coord_angle,T.coord_phase])th.append(U.make('th','',h));
     for(const q of d.rod_coordinates){const x=clean(q.x_mm),y=clean(q.y_mm),angle=((Math.atan2(y,x)*180/Math.PI)%360+360)%360,row=U.make('tr'),cells=[U.make('b','',String(q.index)),fmt(x),fmt(y),fmt(angle)+'°',U.badge(q.phase>0?'+V':'−V',q.phase>0?'info':'bad')];
      for(const c of cells){const td=U.make('td');if(c&&c.nodeType)td.append(c);else td.textContent=c;row.append(td);}tb.append(row);}
     const table=U.make('table','zg-table'),head=U.make('thead');head.append(th);table.append(head,tb);const wrap=U.make('div','wb-table-wrap');wrap.append(table);
     body.append(U.make('p','zg-muted zg-small',`${T.coord_note} R_c = ${fmt(d.center_radius_mm)} mm, ρ = ${fmt(d.rod_radius_mm)} mm.`),wrap);nodes.push(U.fold(T.coordinates,body));}
    box.replaceChildren(...nodes);
   }else{
    add(`${T.geometry_out}: ${fmt(d.rod_radius_mm)} / ${fmt(d.rod_diameter_mm)} · ${fmt(d.rod_ratio)} · ${fmt(d.ratio_deviation_percent)}`);add(`${T.envelope_out}: ${fmt(d.outer_radius_mm)} / ${fmt(d.aperture_diameter_mm)}`);add(`${T.gaps}: ${fmt(d.adjacent_center_mm)} / ${fmt(d.surface_gap_mm)} / ${fmt(d.opposite_center_mm)}`);
    add(`${T.eta_readout}: ${fmt(d.eta)} / ${fmt(d.eta_target)} · ${d.eta_target_met?T.target_met:T.target_above}`);if(d.V_V===0)add(T.zero_rf);
   }
   const extent=d.center_radius_mm+d.rod_radius_mm,scale=150/extent,cx=230,cy=200;
   const svg=el('svg',{xmlns:NS,viewBox:'0 0 460 450',role:'img','aria-label':T.design_title,style:'display:block;width:100%;max-width:520px;height:auto;background:#fff;font-family:Arial,sans-serif'});
   svg.append(el('rect',{width:460,height:450,fill:'#fff'}),el('text',{x:230,y:25,'text-anchor':'middle','font-size':S.titleSize},T.design_title),el('circle',{cx,cy,r:d.r0_mm*scale,fill:'none',stroke:'#73808f','stroke-dasharray':'5 4','stroke-width':S.lineWidth}));
   for(const p of d.rod_coordinates){const rodNode=el('circle',{cx:cx+p.x_mm*scale,cy:cy-p.y_mm*scale,r:d.rod_radius_mm*scale,fill:p.phase>0?'#dae6ff':'#ffe2da',stroke:p.phase>0?'#315aa3':'#ac4835','stroke-width':S.lineWidth});rodNode.append(el('title',{},`${p.index}: ${p.phase>0?'+':'−'}V, (${fmt(p.x_mm)}, ${fmt(p.y_mm)}) mm`));svg.append(rodNode,el('text',{x:cx+p.x_mm*scale,y:cy-p.y_mm*scale+4,'text-anchor':'middle','font-size':S.tickSize},String(p.index)));}
   svg.append(el('line',{x1:cx,y1:cy,x2:cx+d.r0_mm*scale,y2:cy,stroke:'#172235','stroke-width':S.lineWidth}),el('text',{x:cx+10,y:cy-8,'font-size':S.tickSize},`r₀=${fmt(d.r0_mm)} mm`),el('text',{x:230,y:384,'text-anchor':'middle','font-size':S.tickSize},`2n=${d.rod_count}; ρ=${fmt(d.rod_radius_mm)} mm (ρ/r₀=${fmt(d.rod_ratio)}); D=${fmt(d.adjacent_center_mm)} mm; g=${fmt(d.surface_gap_mm)} mm`));
   [['#dae6ff','#315aa3','+V'],['#ffe2da','#ac4835','−V']].forEach(([fill,stroke,text],i)=>svg.append(el('circle',{cx:40+i*70,cy:416,r:6,fill,stroke,'stroke-width':S.lineWidth}),el('text',{x:52+i*70,y:420,'font-size':S.tickSize},text)));
   svg.append(el('line',{x1:190,x2:216,y1:416,y2:416,stroke:'#73808f','stroke-dasharray':'5 4','stroke-width':S.lineWidth}),el('text',{x:222,y:420,'font-size':S.tickSize},`r₀ (${T.k_aperture})`),el('text',{x:230,y:442,'text-anchor':'middle','font-size':Math.max(9,S.tickSize-2),fill:'#53647a'},T.legend_line.replace('a = (2U/V) q','')+'ρ = ratio × r₀; Rc = r₀ + ρ; D = 2Rc sin(π/N); g = D − 2ρ'));holder.append(svg);designSVG=svg;{const n=U?.notesBlock('rfq-geometry');if(n)holder.append(n);}
  }
  function sync(){const three=field('geometry').value==='paul3d',multi=higher();if(three)field('mode').value='direct';else if(multi)field('mode').value='voltage';field('mode').disabled=three||multi;const direct=three||field('mode').value==='direct';root.querySelectorAll('[data-ms-voltage]').forEach(e=>{e.hidden=direct;});root.querySelectorAll('[data-ms-direct]').forEach(e=>{e.hidden=!direct;});root.querySelector('[data-ms-sections]').hidden=three||multi;const designBox=root.querySelector('[data-ms-design]'),formulaBox=root.querySelector('[data-ms-band-formula]');if(designBox)designBox.hidden=three||direct;if(formulaBox)formulaBox.hidden=multi;root.querySelector('[data-ms-formula]').hidden=three;root.querySelector('[data-ms-mapping]').textContent=three?T.mapping_paul:T.mapping_linear;figure.hidden=multi;for(const action of ['svg','png','csv'])root.querySelector('[data-ms-action="'+action+'"]').disabled=multi;}
  const textWidth=(text,size)=>String(text).length*size*.58;
  function wrapLines(text,maxWidth,size){const lines=[];let line='';for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(line&&textWidth(next,size)>maxWidth){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines.length?lines:[''];}
  function flow(items,width,size){const rows=[[]];let x=0;for(const item of items){const w=28+textWidth(item.text,size)+16;if(x+w>width&&rows.at(-1).length){rows.push([]);x=0;}rows.at(-1).push({...item,x,w});x+=w;}return rows;}
  function drawLegend(svg,rows,x0,y0,size){
   rows.forEach((row,r)=>{const y=y0+r*(size+9),mid=y-size/2+2;row.forEach(item=>{const x=x0+item.x,g=el('g',{});
    if(item.kind==='area')g.append(el('rect',{x,y:mid-6,width:20,height:12,fill:item.fill,stroke:item.color,'stroke-width':1}));
    if(item.kind==='line'||item.kind==='dotline')g.append(el('line',{x1:x,x2:x+20,y1:mid,y2:mid,stroke:item.color,'stroke-width':2,'stroke-dasharray':'6 3'}));
    if(item.kind==='dot'||item.kind==='dotline')g.append(el('circle',{cx:x+10,cy:mid,r:item.r,fill:item.color,stroke:item.stroke||'#fff','stroke-width':1.2}));
    g.append(el('text',{x:x+26,y,'font-size':size,fill:'#172235'},item.text));if(item.title)g.append(el('title',{},item.title));svg.append(g);});});
  }
  function draw(d){
   const S=styleControl?.get()||{titleSize:20,axisSize:16,tickSize:13,legendSize:13,markerDiameter:10,lineWidth:1};
   const W=900,left=86,right=30,w=W-left-right,h=440,lg=S.legendSize,qr=d.qmax-d.qmin;
   const areaItems=[{kind:'area',fill:'#dfeafb',color:'#2f62b8',text:T.legend_first},{kind:'area',fill:'#ffe6ce',color:'#ad6a25',text:T.legend_second},{kind:'area',fill:'#8ed3ac',color:'#23865b',text:T.legend_both}];
   const colours=['#7b4dbb','#c54847','#008391'],qOf=x=>fmt(Math.abs(x));
   const markItems=[{kind:'dot',r:S.markerDiameter/2,color:'#172235',stroke:'#fff',text:`${T.legend_point}: q = ${qOf(d.p.q)}, a = ${fmt(d.p.a)}`,title:T.legend_point}];
   d.sections.forEach((sec,i)=>markItems.push({kind:'dotline',r:Math.max(2.5,S.markerDiameter*.4),color:colours[i],text:`${T[sec.key]}: q = ${qOf(sec.q)}, a = ${fmt(sec.a)}${sec.V_rod_peak_V?` (a/q = ${fmt(2*sec.U_V/sec.V_rod_peak_V)})`:''}`,title:`${T[sec.key]} · ${T.legend_line}`}));
   const detail=d.mode==='voltage'?`m = ${fmt(d.p.mass_u)} u · z = ${d.p.charge} · U = ${fmt(d.p.U_V)} V · V = ${fmt(d.p.V_rod_peak_V)} V · r₀ = ${fmt(d.p.r0_mm)} mm · f = ${fmt(d.p.f_MHz)} MHz`:T.caption_direct;
   const caption=wrapLines((source.label&&source.label!==T.manual?source.label+' · ':'')+detail+'. '+T.caption_formulas,W-left-right,lg),top=44+flow(areaItems,w,lg).length*(lg+9)+12;
   const bottomRows=flow(markItems,w,lg),bottom=60+bottomRows.length*(lg+9)+caption.length*(lg+4)+10,H=top+h+bottom;
   const svg=el('svg',{xmlns:NS,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':T.title,style:'display:block;width:100%;height:auto;min-width:280px;background:#fff;color:#172235;font-family:Arial,sans-serif'});
   svg.append(el('rect',{x:0,y:0,width:W,height:H,fill:'#fff'}),el('text',{x:W/2,y:31,'text-anchor':'middle','font-size':S.titleSize,fill:'#172235'},T.title));
   drawLegend(svg,flow(areaItems,w,lg),left,56,lg);
   const X=q=>left+(q-d.qmin)/qr*w,Y=a=>top+(d.amax-a)/(d.amax-d.amin)*h;
   const chart=el('svg',{x:left,y:top,width:w,height:h,viewBox:`${left} ${top} ${w} ${h}`,overflow:'hidden'});svg.append(chart);
   const qs=Array.from({length:241},(_,i)=>d.qmin+qr*i/240),factor=d.geometry==='linear'?1:2;
   const rows=qs.map(q=>{const first=M.bands(q,d.count),second=M.bands(q/factor,d.count).map(b=>({n:b.n,lo:-factor*b.hi,hi:-factor*b.lo}));return{q,first,second};});
   const path=(points,close=false)=>points.map(([x,y],i)=>(i?'L':'M')+fmt(X(x))+','+fmt(Y(y))).join(' ')+(close?'Z':'');
   function strip(select,fill){let run=[];const flush=()=>{if(run.length>1){const pts=run.map(r=>[r.q,r.lo]).concat(run.slice().reverse().map(r=>[r.q,r.hi]));chart.append(el('path',{d:path(pts,true),fill,stroke:'none'}));}run=[];};rows.forEach(r=>{const b=select(r);if(b&&b.hi>b.lo)run.push({q:r.q,...b});else flush();});flush();}
   for(let n=0;n<d.count;n++){strip(r=>r.first[n],'#dfeafb');strip(r=>r.second[n],'#ffe6ce');}
   for(let i=0;i<d.count;i++)for(let j=0;j<d.count;j++)strip(r=>({lo:Math.max(r.first[i].lo,r.second[j].lo),hi:Math.min(r.first[i].hi,r.second[j].hi)}),'#8ed3ac');
   for(let i=0;i<=5;i++){const q=d.qmin+qr*i/5,a=d.amin+(d.amax-d.amin)*i/5;chart.append(el('line',{x1:X(q),x2:X(q),y1:top,y2:top+h,stroke:'#d9dee6','stroke-width':.7}),el('line',{x1:left,x2:left+w,y1:Y(a),y2:Y(a),stroke:'#d9dee6','stroke-width':.7}));svg.append(el('text',{x:X(q),y:top+h+23,'text-anchor':'middle','font-size':S.tickSize,fill:'#172235'},fmt(q)),el('text',{x:left-10,y:Y(a)+4,'text-anchor':'end','font-size':S.tickSize,fill:'#172235'},fmt(a)));}
   for(let n=0;n<d.count;n++)for(const [plane,color,dash] of [['first','#2f62b8',''],['second','#ad6a25','5 3']])for(const side of ['lo','hi'])chart.append(el('path',{d:path(rows.map(r=>[r.q,r[plane][n][side]])),fill:'none',stroke:color,'stroke-width':S.lineWidth,'stroke-dasharray':dash}));
   d.sections.forEach((sec,i)=>{const color=colours[i],ratio=sec.V_rod_peak_V?2*sec.U_V/sec.V_rod_peak_V:null;if(ratio!==null)chart.append(el('line',{x1:X(d.qmin),y1:Y(ratio*d.qmin),x2:X(d.qmax),y2:Y(ratio*d.qmax),stroke:color,'stroke-width':2*S.lineWidth,'stroke-dasharray':'7 3'}));if(sec.V_rod_peak_V===0)chart.append(el('line',{x1:X(0),x2:X(0),y1:top,y2:top+h,stroke:color,'stroke-width':2*S.lineWidth}));
    const dot=el('circle',{cx:X(Math.abs(sec.q)),cy:Y(sec.a),r:Math.max(2.5,S.markerDiameter*.4),fill:color,stroke:'#fff','stroke-width':1.2});dot.append(el('title',{},`${T[sec.key]}: q = ${qOf(sec.q)}, a = ${fmt(sec.a)}`));chart.append(dot);});
   const point=el('circle',{cx:X(Math.abs(d.p.q)),cy:Y(d.p.a),r:S.markerDiameter/2,fill:'#172235',stroke:'#fff','stroke-width':1.5});point.append(el('title',{},`${T.legend_point}: q = ${qOf(d.p.q)}, a = ${fmt(d.p.a)}`));chart.append(point);
   svg.append(el('rect',{x:left,y:top,width:w,height:h,fill:'none',stroke:'#172235'}),el('text',{x:left+w/2,y:top+h+48,'text-anchor':'middle','font-size':S.axisSize,fill:'#172235'},d.geometry==='linear'?'q':'q_z'),el('text',{x:23,y:top+h/2,'text-anchor':'middle',transform:`rotate(-90 23 ${top+h/2})`,'font-size':S.axisSize,fill:'#172235'},d.geometry==='linear'?'a':'a_z'));
   drawLegend(svg,bottomRows,left,top+h+70,lg);
   caption.forEach((line,i)=>svg.append(el('text',{x:left,y:top+h+70+bottomRows.length*(lg+9)+8+i*(lg+4),'font-size':Math.max(9,lg-1),fill:'#53647a'},line)));
   figure.replaceChildren(svg);return{svg,rows,view:{W,H,left,top,w,h,qmin:d.qmin,qmax:d.qmax,amin:d.amin,amax:d.amax}};
  }
  function refresh(){
   sync();try{renderDesign();const d=inputs(),multi=higher(),c=multi?null:M.classify(d.p.a,d.p.q,d.geometry,d.count),drawn=multi?{svg:null,rows:[]}:draw(d);err.textContent='';last={...d,...drawn,classification:c};
    const box=root.querySelector('[data-ms-readout]');box.replaceChildren();const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
    if(multi){add(T.multipole);return;}
    const tone=st=>st==='stable'?'ok':st==='unstable'?'bad':st==='boundary'||st==='unresolved'?'warn':'info',planes=[c.first,c.second].map((p,i)=>{let diag;try{diag=M.diagnostic(p.a,p.q);}catch(_){diag={status:'unresolved',trace:NaN,det:NaN,trace_delta:NaN};}return{p,i,diag};});
    if(U){
     const nodes=[U.group(T.grp_point,tone(c.status),[{k:T.readout,v:T[c.status],tone:tone(c.status)},{k:'q',v:fmt(d.p.q)},{k:'a',v:fmt(d.p.a)},...(source.label&&source.label!==T.manual?[{k:T.species,v:source.label}]:[])])];
     for(const{p,i,diag}of planes)nodes.push(U.group(i?T.second:T.first,tone(p.status),[{k:T.k_status,v:T[p.status],tone:tone(p.status)},{k:T.band,v:String(p.band??'—')},{k:T.trace,v:fmt(diag.trace),hint:T.diagnostic},{k:T.det,v:fmt(diag.det)},{k:'Δ',v:fmt(diag.trace_delta),hint:T.diagnostic},{k:T.k_status+' (Floquet)',v:T[diag.status],tone:tone(diag.status)}]));
     nodes.push(U.make('p','zg-muted zg-small',T.diagnostic));box.replaceChildren(...nodes);
    }else{add(`${T.readout}: ${T[c.status]} · a=${fmt(d.p.a)}, q=${fmt(d.p.q)}`);planes.forEach(({p,i,diag})=>add(`${i?T.second:T.first}: ${T[p.status]} · ${T.band} ${p.band??'—'} · ${T.trace}=${fmt(diag.trace)}, ${T.det}=${fmt(diag.det)}, Δ=${fmt(diag.trace_delta)} · ${T[diag.status]}`));add(T.diagnostic);}
   }catch(e){last=null;lastDesign=null;designSVG=null;figure.replaceChildren();root.querySelector('[data-ms-readout]').replaceChildren();root.querySelector('[data-ms-design-readout]')?.replaceChildren();root.querySelector('[data-ms-design-figure]')?.replaceChildren();const sine=Math.sin(Math.PI/value('rod-count'));err.textContent=e.message==='rod overlap'?T.rod_overlap+' r/r₀ < '+fmt(sine/(1-sine)):e.message==='rod rule'?T.rule_unavailable:T.bad;}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(refresh,100);}
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
  root.addEventListener('input',e=>{e.stopPropagation();if(['ms-mass','ms-charge','ms-species'].includes(e.target.name)){source={label:T.manual};root.querySelector('[data-ms-source]').textContent=T.manual;}queue();});
  root.addEventListener('change',e=>{e.stopPropagation();if(e.target.matches('[data-ms-file]'))return;queue();});
  const save=(blob,name)=>{if(window.zgExport?.save)zgExport.save(blob,name);else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}};
  root.addEventListener('click',async e=>{
   e.stopPropagation();const useBtn=e.target.closest('[data-ms-use]');if(useBtn&&useBtn.dataset.msUse!==undefined){field('V').value=useBtn.dataset.msUse;refresh();return;}
   const action=e.target.closest('[data-ms-action]')?.dataset.msAction;if(!action)return;
   if(action==='zoom-in'){zoom(.8);return;}if(action==='zoom-out'){zoom(1.25);return;}if(action==='reset-view'){resetView();return;}
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
  {const n=U?.notesBlock('mathieu');if(n)figure.after(n);const slot=root.querySelector('[data-ms-design-notes]'),dn=U?.notesBlock('rfq-design');if(slot&&dn)slot.append(dn);}
  refresh();
 });
})();
