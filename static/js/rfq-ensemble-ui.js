/* RFQ ideal-ensemble cinema. Synchronized XY/orthographic XYZ SVG animation,
 * reproducible seed, per-ion loss and browser recording. NOT SIMION or a gas cooler.
 */
(function(host){'use strict';
if(typeof document==='undefined')return;
const root=document.querySelector('#rfq-workbench'),cinema=root?.querySelector('[data-rfq-cinema]');
const area=root?.querySelector('[data-rfq-ensemble]'),E=host.ZGRFQEnsemble;
if(!root||!cinema||!area||!E||!host.ZGRFQPlayback||!host.ZGRFQMotionView)return;
const M=host.ZGMathieu,H=host.ZGRFQWorkbench,NS='http://www.w3.org/2000/svg';
const zh=document.documentElement.lang.startsWith('zh');
const L=zh?{ready:'模拟束团',survived:'孔径存活',lost:'失去',time:'射频周期',error:'模型错误',
 xy:'二维离子轨迹',xyz:'三维正交轨迹',note:'仅理想 Mathieu + 自由轴向漂移；非实测'}:
 {ready:'Simulated packet',survived:'aperture survivors',lost:'lost',time:'RF cycles',
 error:'Model error',xy:'2D ion packet',xyz:'3D orthographic flight',
 note:'Ideal Mathieu + free axial drift; NOT measured'};
const colors=['#1769ae','#168877','#c67725','#9659aa','#4097ab','#b14c61','#548341'];
const q=s=>area.querySelector(s),fld=n=>root.querySelector('[name="'+n+'"]');
const left=q('[data-rfq-ensemble-xy]'),right=q('[data-rfq-ensemble-3d]');
const info=q('[data-rfq-ensemble-status]'),slot=q('[data-rfq-ensemble-player]');
const csv=q('[data-rfq-ensemble-csv]');
let plot=null,result=null,player=null,image=null,frac=1;
function read(name){
 const field=name.startsWith('re-')?q('[name="'+name+'"]'):fld(name);
 if(!field||String(field.value).trim()===''||!Number.isFinite(Number(field.value)))throw Error('Invalid '+name);
 return Number(field.value);
}
function svgNode(tag,attrs={},label){
 const s=document.createElementNS(NS,tag);
 for(const[k,v]of Object.entries(attrs))s.setAttribute(k,String(v));
 if(label!==undefined)s.textContent=String(label);
 return s;
}
function text(svg,str,x,y,size=12){svg.append(svgNode('text',{x,y,'font-size':size,fill:'#203856'},str));}
function stroke(svg,points,color,width=1.4,extra={}){
 if(points.length<2)return;
 svg.append(svgNode('polyline',{points:points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' '),
  fill:'none',stroke:color,'stroke-width':width,
  'stroke-linecap':'round','stroke-linejoin':'round',...extra}));
}
function physics(){
 const mass=read('ms-mass'),z=read('ms-charge'),r0=read('ms-r0'),f=read('ms-f');
 if(!(mass>0&&Number.isInteger(z)&&z>0&&r0>0&&f>0))throw Error('Ion/field parameters');
 if(fld('ms-geometry').value!=='linear')throw Error('Ideal linear four-rod field only');
 const p=fld('ms-mode').value==='direct'?{a:read('ms-a'),q:read('ms-q')}:
  M.parameters(mass,z,read('ms-U'),H.toRodPeak(read('ms-V'),
    fld('ms-voltage-convention').value),r0,f);
 return{mass,z,r0,f,p};
}
function simulate(){
 const p=physics(),run=E.generate({
  a:p.p.a,q:p.p.q,r0_mm:p.r0,f_MHz:p.f,
  count:read('re-count'),seed:read('re-seed'),steps:read('re-steps'),
  cycles:read('re-cycles'),sigma_position_mm:read('re-pos'),
  sigma_velocity_mm_us:read('re-vel'),mean_vz_mm_us:read('re-vz'),
  sigma_vz_mm_us:read('re-sigmaz')
 });
 run.mass_u=p.mass;run.charge=p.z;
 const tracks=run.ions.map(ion=>{
  const stride=Math.max(1,Math.ceil(ion.samples.length/200));
  const points=ion.samples.filter((_,k)=>k%stride===0);
  if(points.at(-1)!==ion.samples.at(-1))points.push(ion.samples.at(-1));
  return{points,id:ion.id,loss_cycle:ion.loss_cycle};
 });
 const zall=tracks.flatMap(x=>[x.points[0].z_mm,x.points.at(-1).z_mm]);
 const min=Math.min(...zall),max=Math.max(...zall),mid=(min+max)/2;
 return{run,tracks,zmid:mid,zmin:mid-Math.max(run.r0_mm,(max-min)/2),
       zmax:mid+Math.max(run.r0_mm,(max-min)/2)};
}
function one(view,fraction){
 const {run,tracks,zmin,zmax,zmid}=plot;
 const w=620,h=440,top=46,bottom=380,cx=w/2,cy=(top+bottom)/2;
 const svg=svgNode('svg',{xmlns:NS,viewBox:'0 0 '+w+' '+h,width:w,height:h,role:'img',
  'data-rfq-ensemble-view':view,'aria-label':view==='xy'?L.xy:L.xyz,
  style:'display:block;width:100%;height:auto;background:#fff'});
 svg.append(svgNode('rect',{width:w,height:h,fill:'#fff'}));
 text(svg,view==='xy'?L.xy:L.xyz,18,27,19);
 svg.append(svgNode('rect',{x:20,y:top,width:w-40,height:bottom-top,rx:8,
  fill:'#f4f8fd',stroke:'#dae4ee'}));
 let coord;
 if(view==='xy'){
  const scale=Math.min((w-118)/(2.5*run.r0_mm),(bottom-top-20)/(2.5*run.r0_mm));
  coord=p=>[cx+p[0]*scale,cy-p[1]*scale];
  svg.append(svgNode('circle',{cx,cy,r:run.r0_mm*scale,
    fill:'none',stroke:'#9fb5c6','stroke-width':1.2,'stroke-dasharray':'5 4'}));
  text(svg,'x (mm)',w-85,cy-5);text(svg,'y (mm)',cx+8,top+17);
 }else{
  const yaw=read('re-yaw'),pitch=read('re-pitch');
  const corners=[];
  for(const x of [-1.4*run.r0_mm,1.4*run.r0_mm])
   for(const y of [-1.4*run.r0_mm,1.4*run.r0_mm])
    for(const z of [zmin,zmax])corners.push(host.ZGRFQMotionView.project([x,y,z],yaw,pitch,zmid));
  const loX=Math.min(...corners.map(p=>p[0])),hiX=Math.max(...corners.map(p=>p[0]));
  const loY=Math.min(...corners.map(p=>p[1])),hiY=Math.max(...corners.map(p=>p[1]));
  const scale=Math.min((w-118)/Math.max(1e-8,hiX-loX),
    (bottom-top-42)/Math.max(1e-8,hiY-loY));
  coord=p=>{
   const r=host.ZGRFQMotionView.project(p,yaw,pitch,zmid);
   return[cx+(r[0]-(hiX+loX)/2)*scale,cy-(r[1]-(hiY+loY)/2)*scale];
  };
  for(const z of [zmin,zmax]){
   const ring=Array.from({length:65},(_,k)=>[run.r0_mm*Math.cos(k*Math.PI/32),
      run.r0_mm*Math.sin(k*Math.PI/32),z]);
   stroke(svg,ring.map(coord),'#b2c4d3',1,{'stroke-dasharray':'4 4'});
  }
  for(let k=0;k<8;k++){
   const a=k*Math.PI/4;
   stroke(svg,[[run.r0_mm*Math.cos(a),run.r0_mm*Math.sin(a),zmin],
     [run.r0_mm*Math.cos(a),run.r0_mm*Math.sin(a),zmax]].map(coord),'#d0ddea',1);
  }
  for(const [name,point,color]of [['x',[run.r0_mm,0,zmid],'#1769ae'],
      ['y',[0,run.r0_mm,zmid],'#168877'],['z',[0,0,zmax],'#c67725']]){
   stroke(svg,[[0,0,zmid],point].map(coord),color,2);
   const p=coord(point);text(svg,name,p[0]+5,p[1]-5);
  }
 }
 const time=run.cycles*fraction;
 let lost=0;
 for(const ion of tracks){
  const rows=ion.points.filter(x=>x.cycle<=time+1e-9);if(!rows.length)continue;
  const color=colors[ion.id%colors.length],end=rows.at(-1);
  const gone=ion.loss_cycle!==null&&ion.loss_cycle<=time+1e-9;
  if(gone)lost++;
  const points=rows.map(r=>coord([r.x_mm,r.y_mm,r.z_mm]));
  stroke(svg,points,color,1.6,{opacity:.72});
  const p=points.at(-1);
  svg.append(svgNode('circle',{cx:p[0],cy:p[1],r:gone?4.5:2.9,
    fill:gone?'#bd4247':color,stroke:'#fff','stroke-width':.7}));
 }
 text(svg,L.time+' '+time.toFixed(2)+'/'+run.cycles+
  ' · '+L.lost+': '+lost+'/'+run.count,18,404,12);
 text(svg,'a='+run.a.toFixed(4)+' q='+run.q.toFixed(4)+
  ' r0='+run.r0_mm.toFixed(3)+'mm · '+L.note,18,427,10);
 svg.dataset.lost=String(lost);return svg;
}
function combined(a,b){
 const svg=svgNode('svg',{xmlns:NS,viewBox:'0 0 1280 490',width:1280,height:490,
  role:'img','aria-label':'Synchronized 2D XY / 3D RFQ ideal ion packet'});
 svg.append(svgNode('rect',{width:1280,height:490,fill:'#fff'}));
 [a,b].forEach((source,i)=>{
   const p=source.cloneNode(true);
   p.setAttribute('x',String(i*640));p.setAttribute('y','0');
   p.setAttribute('width','630');p.setAttribute('height','445');
   p.setAttribute('viewBox','0 0 620 440');
   p.removeAttribute('style');svg.append(p);
 });
 text(svg,L.note,16,473,12);return svg;
}
function frame(value){
 if(!plot)return null;frac=value;
 const a=one('xy',value),b=one('xyz',value);
 left.replaceChildren(a);right.replaceChildren(b);
 image=combined(a,b);return image;
}
function run(){
 try{
  player?.destroy();player=null;slot.replaceChildren();
  left.replaceChildren();right.replaceChildren();csv.disabled=true;
  plot=simulate();result=plot.run;
  info.textContent=L.ready+': '+result.count+
    ' · '+L.survived+': '+result.survived+'/'+result.count+
    ' · '+L.lost+': '+result.losses.length+' · seed='+result.seed+' · '+L.note;
  frame(1);
  player=host.ZGRFQPlayback.mount({
    container:slot,renderFrame:frame,getSVG:()=>image,
    filename:'rfq-ideal-ion-packet-2d3d',durationSeconds:8,
    metadata:{schema:result.schema,source:result.source_kind,seed:result.seed,
      ions:result.count,survived:result.survived,steps:result.steps,
      mass_u:result.mass_u,charge:result.charge,a:result.a,q:result.q,
      limitation:'Ideal Mathieu and free drift, NOT finite electrode SIMION or measured transmission'}
  });
  csv.disabled=false;area.dataset.ensembleReady='true';
 }catch(e){result=plot=image=null;info.textContent=L.error+': '+e.message;area.dataset.ensembleReady='false';}
}
function downloadCSV(){
 if(!result)return;
 const header=['ion_id','seed','rf_cycle','time_us','x_mm','y_mm','z_mm',
  'r_mm','initial_vx_mm_us','initial_vy_mm_us','initial_vz_mm_us','survived','loss_cycle'];
 const rows=[header.join(',')];
 for(const ion of result.ions)for(const r of ion.samples)
  rows.push([ion.id,result.seed,r.cycle,r.time_us,r.x_mm,r.y_mm,r.z_mm,
   r.r_mm,ion.initial.vx,ion.initial.vy,ion.initial.vz,
   ion.alive?1:0,ion.loss_cycle===null?'':ion.loss_cycle].join(','));
 const blob=new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'});
 if(host.zgExport?.save){host.zgExport.save(blob,'rfq-ideal-ensemble.csv');return;}
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='rfq-ideal-ensemble.csv';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
q('[data-rfq-ensemble-run]').addEventListener('click',run);
csv.addEventListener('click',downloadCSV);
area.addEventListener('toggle',()=>{if(area.open&&!cinema.hidden&&!result)run();});
for(const key of ['re-yaw','re-pitch'])
 q('[name="'+key+'"]').addEventListener('input',()=>{if(plot)frame(frac);});
root.addEventListener('click',e=>{
 if(e.target.closest('[data-local-tab="cinema"]')&&area.open&&!result)setTimeout(run,80);
});
host.ZGRFQEnsembleUI=Object.freeze({run,get result(){return result;}});
})(typeof window==='object'?window:globalThis);
