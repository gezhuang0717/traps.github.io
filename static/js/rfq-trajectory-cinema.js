/* RFQ Synchronized Trajectory Cinema — public educational ideal-field model.
   One RK4 integration, 2D XY and rotatable orthographic 3D (free axial drift).
   Frame SVG/PNG/PDF and real MediaRecorder video; NOT native SIMION or 3D fields.
*/
(function(host){'use strict';
if(typeof document==='undefined')return;
const root=document.querySelector('#rfq-workbench'),panel=root?.querySelector('[data-local-panel="cinema"]');
const X=host.ZGRFQExtras,M=host.ZGMathieu,H=host.ZGRFQWorkbench;
if(!root||!panel||!X||!M||!H||!host.ZGRFQMotionView||!host.ZGRFQPlayback)return;
const NS='http://www.w3.org/2000/svg',isZh=document.documentElement.lang.startsWith('zh');
const L=isZh?{idle:'选择场景启动同步二维/三维动画',ready:'理想积分已完成',warning:'仅理想四杆横向场和自由轴向漂移；三维是投影图，并非三维场求解',error:'参数或模型无效',pts:'采样点',flight:'轴向位移',alive:'孔径存活',yes:'是',no:'否'}:
{idle:'Select a scene to animate synchronized 2D and 3D trajectories',ready:'Ideal integration complete',
warning:'Ideal four-rod transverse field and free axial drift only: a 3D projection is NOT a 3D field solver',
error:'Invalid parameters or model',pts:'samples',flight:'axial displacement',alive:'aperture survival',yes:'yes',no:'no'};
const find=s=>panel.querySelector(s),field=n=>root.querySelector('[name="'+n+'"]');
const val=n=>{const e=field(n);if(!e||!String(e.value).trim()||!Number.isFinite(Number(e.value)))throw Error(n);return Number(e.value);};
const set=(n,x)=>{const e=field(n);if(e)e.value=String(x);};
const warn=find('[data-rfq-cinema-warning]'),status=find('[data-rfq-cinema-status]'),
leftBox=find('[data-rfq-cinema-2d]'),rightBox=find('[data-rfq-cinema-3d]'),playerBox=find('[data-rfq-cinema-player]');
let left=null,right=null,player=null,result=null,timer=0,count=0;
function dispose(){
  if(player)player.destroy();if(left)left.destroy();if(right)right.destroy();
  player=left=right=null;leftBox.replaceChildren();rightBox.replaceChildren();playerBox.replaceChildren();
}
function source(){
  const mass=val('ms-mass'),charge=val('ms-charge'),radius=val('ms-r0'),f=val('ms-f');
  if(!(mass>0&&Number.isInteger(charge)&&charge>0&&radius>0&&f>0))throw Error('ion parameters');
  if(field('ms-geometry').value!=='linear')throw Error('four-rod linear geometry required');
  const p=field('ms-mode').value==='direct'?{a:val('ms-a'),q:val('ms-q')}:
    M.parameters(mass,charge,val('ms-U'),H.toRodPeak(val('ms-V'),
      field('ms-voltage-convention').value),radius,f);
  return{mass,charge,radius,f,p};
}
function combined(){
  if(!left||!right)return null;
  const chunks=[left.getSVG(),right.getSVG()];if(chunks.some(x=>!x))return null;
  const base=640,gap=16,p=chunks.map(x=>{
    const vb=(x.getAttribute('viewBox')||'0 0 640 420').split(/[ ,]+/).map(Number);
    return{svg:x,vb,h:x?Math.ceil(base*vb[3]/vb[2]):420};
  });
  const h=Math.max(p[0].h,p[1].h)+54,total=base*2+gap,svg=document.createElementNS(NS,'svg');
  [['xmlns',NS],['viewBox','0 0 '+total+' '+h],['width',total],['height',h],
   ['role','img'],['aria-label','Synchronized ideal RFQ XY 2D and XYZ 3D trajectory']].forEach(x=>svg.setAttribute(x[0],String(x[1])));
  const rect=document.createElementNS(NS,'rect');rect.setAttribute('width',total);rect.setAttribute('height',h);rect.setAttribute('fill','white');svg.append(rect);
  p.forEach((q,i)=>{
    const child=q.svg.cloneNode(true);
    [['x',i*(base+gap)],['y',6],['width',base],['height',q.h],
     ['viewBox',q.vb.join(' ')],['xmlns',NS]].forEach(pair=>child.setAttribute(pair[0],String(pair[1])));
    child.removeAttribute('style');svg.append(child);
  });
  const note=document.createElementNS(NS,'text');
  note.setAttribute('x',14);note.setAttribute('y',h-19);note.setAttribute('fill','#334155');
  note.setAttribute('font-size','13');note.textContent=L.warning;svg.append(note);
  return svg;
}
function frames(f){left?.renderFrame(f);right?.renderFrame(f);return combined();}
function render(){
  if(panel.hidden)return;
  try{
    const s=source(),omega=Math.PI*s.f,cycles=val('rx-cycles');
    const model=X.motion({a:s.p.a,q:s.p.q,r0_mm:s.radius,cycles,
      x_mm:val('rx-x'),y_mm:val('rx-y'),z_mm:val('rx-z'),
      vx_mm_per_tau:val('rx-vx')/omega,vy_mm_per_tau:val('rx-vy')/omega,
      vz_mm_per_tau:val('rx-vz')/omega,phase_rad:val('rx-phase'),
      steps_per_rf_cycle:val('rx-steps')});
    const data=model.samples.map(t=>Object.assign({},t,{time_us:t.cycle/s.f,
      vx_mm_per_us:t.vx_mm_per_tau*omega,vy_mm_per_us:t.vy_mm_per_tau*omega,
      vz_mm_per_us:t.vz_mm_per_tau*omega}));
    const report=Object.assign({},model,{samples:data,shared:{mass_u:s.mass,
      charge:s.charge,a:s.p.a,q:s.p.q,f_MHz:s.f}});
    dispose();
    const settings={root,rows:data,report,r0:s.radius,fMHz:s.f,onPreset:preset};
    left=host.ZGRFQMotionView.mount(Object.assign({chart:leftBox,
      view:find('[data-rfq-cinema-left-view]').value},settings));
    right=host.ZGRFQMotionView.mount(Object.assign({chart:rightBox,
      view:'spatial'},settings));
    player=host.ZGRFQPlayback.mount({container:playerBox,renderFrame:frames,getSVG:combined,
      filename:'rfq-ideal-trajectory-2d3d',durationSeconds:8,
      metadata:{schema:'rfq-cinema-v1',evidence:'ideal Mathieu RK4 and free axial drift, not native SIMION',
        mass_u:s.mass,charge:s.charge,a:s.p.a,q:s.p.q,r0_mm:s.radius,
        f_MHz:s.f,cycles,steps:model.steps_per_rf_cycle}});
    const zvals=data.map(d=>d.z_mm),distance=Math.max(...zvals)-Math.min(...zvals);
    status.textContent=L.ready+'; a='+Number(s.p.a.toPrecision(5))+'; q='+Number(s.p.q.toPrecision(5))+
      '; '+L.pts+'='+data.length+'; '+L.flight+'='+Number(distance.toPrecision(5))+' mm; '+
      L.alive+'='+(model.alive?L.yes:L.no);
    warn.textContent=L.warning;result={data,report};panel.dataset.cinemaIteration=String(++count);
  }catch(error){dispose();status.textContent='';warn.textContent=L.error+': '+error.message;}
}
function schedule(){clearTimeout(timer);timer=setTimeout(render,170);}
function preset(name){
  const r0=val('ms-r0'),f=val('ms-f');
  const p={'ms-geometry':'linear','ms-mode':'direct','ms-a':0,'ms-q':.3,'rx-cycles':24,
    'rx-steps':128,'rx-x':.17*r0,'rx-y':.07*r0,'rx-z':0,
    'rx-vx':0,'rx-vy':0,'rx-vz':0,'rx-phase':0};
  if(name==='flight')Object.assign(p,{'rx-z':-2*r0,'rx-vz':4*r0*f/24});
  if(name==='orbitPreset')Object.assign(p,{'ms-q':.24,'rx-y':0,'rx-vy':.32*r0*f,'rx-cycles':48});
  if(name==='unstable')Object.assign(p,{'ms-q':1.12,'rx-x':.34*r0,'rx-cycles':18});
  if(name==='strong')Object.assign(p,{'ms-q':.56,'rx-cycles':32});
  if(name==='gentle')Object.assign(p,{'ms-q':.11,'rx-cycles':60});
  if(name==='phases')Object.assign(p,{'ms-q':.40,'rx-phase':Math.PI/2});
  for(const [key,value]of Object.entries(p))set(key,value);
  field('ms-mode').dispatchEvent(new Event('change',{bubbles:true}));
  schedule();
}
panel.addEventListener('click',e=>{
  const button=e.target.closest('[data-rfq-cinema-preset]');
  if(button){preset(button.dataset.rfqCinemaPreset);return;}
  if(e.target.closest('[data-rfq-cinema-run]'))render();
});
find('[data-rfq-cinema-left-view]')?.addEventListener('change',render);
root.addEventListener('click',e=>{
  if(e.target.closest('[data-local-tab="cinema"]'))setTimeout(render,70);
});
root.addEventListener('change',e=>{
  if(e.target.matches?.('[name^="ms-"],[name^="rx-"]'))schedule();
});
root.addEventListener('input',e=>{
  if(e.target.matches?.('[name^="ms-"],[name^="rx-"]')&&e.target.type==='number')schedule();
});
warn.textContent=L.idle;
host.ZGRFQCinema=Object.freeze({refresh:render,get report(){return result?.report||null;}});
})(typeof window==='object'?window:globalThis);
