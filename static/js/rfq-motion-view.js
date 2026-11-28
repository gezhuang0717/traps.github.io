/* Ideal RFQ motion explorer. SVG figures, orthographic 3D and calibrated FFT.
 * Projection never changes the integrated coordinates. z is exact free drift.
 */
(function (host) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', BLUE = '#2475bd', TEAL = '#138575', GOLD = '#d17a22';
  const EN = {
    time:'Micromotion and secular motion', orbit:'Transverse orbit', phase:'Transverse phase space',
    xz:'Axial-radial XZ projection', yz:'Axial-radial YZ projection', rz:'Radius vs axial position',
    filtered:'One-RF-period mean and residual', axial:'Axial flight in an ideal RFQ', spatial:'3D trajectory · ideal RFQ',
    comparison:'Launch at different RF phases', spectrum:'Trajectory frequency spectrum',
    integrated:'Integrated trajectory', mean:'One-RF-period mean', residual:'RF-period residual',
    current:'Ion position', radius:'Circular aperture proxy', cycles:'RF cycles', position:'Position (mm)',
    yaw:'Camera azimuth', pitch:'Camera elevation', reset:'Reset camera', meanToggle:'Show RF-period mean',
    perspective:'Perspective depth', turntable:'Orbit camera during playback',
    rotate:'Drag to rotate. Arrow keys rotate; R resets. Orthographic projection; all coordinates are in mm.',
    model:'Ideal four-rod field; axial free drift z = z₀ + v_z t. The cylinder marks the circular aperture proxy.',
    filterNote:'The mean is a centered one-RF-period filter; incomplete edge windows are omitted. It is not an exact Floquet decomposition.',
    shortSpectrum:'Use at least 32 RF cycles to separate the slow oscillation and RF sidebands. Padding does not improve 1/T resolution.',
    spectralNote:'Hann window; single-sided displacement amplitude. RF is a frequency reference, not necessarily a spectral peak.',
    lowq:'Low-q RF-only secular approximation', fullDuration:'Full record', bin:'Frequency cursor', resolution:'Resolution 1/T',
    averageWarning:'At this operating point the one-period mean must not be identified with an exact secular orbit.',
    actual:'Physical time', completed:'Computed path', lost:'Aperture boundary crossed',
    preset:'Motion example', apply:'Load example', custom:'Keep current inputs',
    gentle:'Gentle confinement', strong:'Stronger micromotion', orbitPreset:'Transverse swirl',
    flight:'3D axial flight', phases:'Compare launch phases', unstable:'Aperture-loss example',
    presetNote:'Examples set direct Mathieu a, q and initial conditions. They are ideal-model teaching cases.'
  };
  const ZH = {
    time:'微运动与久期运动', orbit:'横向轨道', phase:'横向相空间', xz:'轴向 XZ 轨迹', yz:'轴向 YZ 轨迹', rz:'轴向半径 RZ 轨迹', filtered:'一个射频周期均值与残差',
    axial:'理想 RFQ 中的轴向飞行', spatial:'三维轨迹 · 理想 RFQ', comparison:'不同射频相位注入',
    spectrum:'轨迹频谱', integrated:'积分轨迹', mean:'一个射频周期均值', residual:'射频周期残差',
    current:'离子位置', radius:'圆形孔径近似', cycles:'射频周期数', position:'位置（mm）',
    yaw:'相机方位角', pitch:'相机仰角', reset:'重置视角', meanToggle:'显示射频周期均值',
    perspective:'透视深度', turntable:'播放时自动旋转相机',
    rotate:'拖动旋转；方向键旋转；R 重置。采用正交投影，所有空间坐标均以 mm 表示。',
    model:'理想四杆电场；轴向自由漂移 z = z₀ + v_z t。圆柱表示圆形孔径近似。',
    filterNote:'采用居中的一个射频周期滤波；不完整的边缘窗口省略。这不是严格的 Floquet 分解。',
    shortSpectrum:'建议至少使用 32 个射频周期，以区分慢振荡与射频边带。补零不提高 1/T 分辨率。',
    spectralNote:'Hann 窗，单边位移幅度谱。射频线仅为频率参考，不保证是频谱峰。',
    lowq:'低 q、纯 RF 的久期频率近似', fullDuration:'完整记录', bin:'频率游标', resolution:'分辨率 1/T',
    averageWarning:'此工作点下，不应把一个射频周期均值称为精确的久期轨道。',
    actual:'实际物理时间', completed:'已计算轨迹', lost:'越过孔径边界',
    preset:'运动示例', apply:'载入示例', custom:'保留当前输入', gentle:'弱约束慢振荡',
    strong:'较强微运动', orbitPreset:'横向旋转轨道', flight:'三维轴向飞行',
    phases:'比较注入相位', unstable:'孔径损失示例',
    presetNote:'示例设置直接输入的 Mathieu a、q 和初始条件，仅用于理想模型教学。'
  };
  function spectrum(samples, fMHz) {
    let rows = samples.slice(), step = rows.length > 1 ? rows[1].cycle - rows[0].cycle : NaN;
    if (!(step > 0 && fMHz > 0) || rows.length < 8) return null;
    if (Math.abs(rows.at(-1).cycle - rows.at(-2).cycle - step) > step * 1e-6) rows.pop();
    if (rows.some((r,i) => i && Math.abs(r.cycle - rows[i-1].cycle - step) > step * 1e-6)) throw Error('Spectrum requires uniform samples');
    const count = rows.length, n = 2 ** Math.ceil(Math.log2(count)), re = new Float64Array(n), im = new Float64Array(n);
    const mean = rows.reduce((sum,r) => sum + r.x_mm, 0) / count; let gain = 0;
    for (let i=0;i<count;i++) { const w = .5 - .5*Math.cos(2*Math.PI*i/(count-1)); gain += w; re[i]=(rows[i].x_mm-mean)*w; }
    for (let i=1,j=0;i<n;i++) { let bit=n>>1; for(;j&bit;bit>>=1)j^=bit; j^=bit; if(i<j){const v=re[i];re[i]=re[j];re[j]=v;} }
    for(let len=2;len<=n;len<<=1) {
      const angle=-2*Math.PI/len, wr0=Math.cos(angle), wi0=Math.sin(angle);
      for(let start=0;start<n;start+=len) { let wr=1,wi=0;
        for(let j=0;j<len/2;j++) { const a=start+j,b=a+len/2,tr=re[b]*wr-im[b]*wi,ti=re[b]*wi+im[b]*wr;
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          const next=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=next;
        }
      }
    }
    const sampleRate=fMHz/step, points=[];
    for(let k=1;k<=n/2;k++) { const frequency=k*sampleRate/n; if(frequency>2*fMHz)break;
      points.push({x:frequency,y:Math.hypot(re[k],im[k])*(k===n/2?1:2)/gain});
    }
    return {points, resolution_MHz:sampleRate/count, sample_rate_MHz:sampleRate, source_samples:count, fft_size:n, window:'Hann'};
  }
  function project(point, yaw, pitch, zCenter=0) {
    const a=yaw*Math.PI/180,b=pitch*Math.PI/180,x=point[0],y=point[1],z=point[2]-zCenter;
    const u=x*Math.cos(a)+z*Math.sin(a),depth=-x*Math.sin(a)+z*Math.cos(a);
    return [u,y*Math.cos(b)-depth*Math.sin(b),y*Math.sin(b)+depth*Math.cos(b)];
  }
  function mount(options) {
    const {root,chart,rows,report,r0,fMHz,view,onPreset} = options, C=host.ZGRFQChart;
    const t=document.documentElement.lang.startsWith('zh')?ZH:EN;
    const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
    const element=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=null)e.textContent=String(text);return e;};
    const block=make('section','rfq-motion-explorer'); if(!/^(en|zh)/.test(document.documentElement.lang))block.lang='en';
    const tools=make('div','rfq-motion-toolbar'),presetLabel=make('label','',t.preset),presets=make('select');
    presets.setAttribute('aria-label',t.preset);presets.dataset.motionPreset='';
    for(const key of ['custom','gentle','strong','orbitPreset','flight','phases','unstable']){const o=make('option','',t[key]);o.value=key;presets.append(o);}
    const load=make('button','zg-btn zg-btn-ghost',t.apply);load.type='button';load.dataset.motionAction='preset';
    load.addEventListener('click',()=>{if(presets.value!=='custom')onPreset?.(presets.value);});
    presetLabel.append(presets);tools.append(presetLabel,load);
    const note=make('p','rfq-motion-note',view==='filtered'?t.filterNote:view==='spectrum'?t.spectralNote:t.model);
    const stage=make('div','rfq-motion-stage');stage.dataset.motionView=view;stage.tabIndex=0;
    stage.setAttribute('role','group');stage.setAttribute('aria-label',t[view]||t.time);
    const camera=make('div','rfq-motion-camera');camera.hidden=view!=='spatial';
    let yaw=-35,pitch=25,fraction=1,currentSVG=null,orbitBase=-35;
    const cameraInput=(label,min,max,value)=>{const box=make('label','',label),slider=make('input');slider.type='range';slider.min=min;slider.max=max;slider.value=value;slider.step=1;slider.setAttribute('aria-label',label);box.append(slider);camera.append(box);return slider;};
    const yawInput=cameraInput(t.yaw,-180,180,yaw),pitchInput=cameraInput(t.pitch,-80,80,pitch);
    const reset=make('button','zg-btn zg-btn-ghost',t.reset);reset.type='button';camera.append(reset);
    const toggleLabel=make('label','rfq-playback-check'),meanToggle=make('input');meanToggle.type='checkbox';meanToggle.checked=true;
    toggleLabel.append(meanToggle,document.createTextNode(t.meanToggle));camera.append(toggleLabel);
    const perspectiveLabel=make('label','rfq-playback-check'),perspectiveToggle=make('input');
    perspectiveToggle.type='checkbox';perspectiveToggle.dataset.motionProjectionToggle='';
    perspectiveLabel.append(perspectiveToggle,document.createTextNode(t.perspective));camera.append(perspectiveLabel);
    const orbitLabel=make('label','rfq-playback-check'),orbitToggle=make('input');
    orbitToggle.type='checkbox';orbitToggle.dataset.motionCameraOrbit='';
    orbitLabel.append(orbitToggle,document.createTextNode(t.turntable));camera.append(orbitLabel);
    const help=make('p','zg-muted zg-small',view==='spatial'?t.rotate:t.presetNote);
    const slot=make('div');slot.dataset.motionPlayback='';
    block.append(tools,note,camera,stage,help,slot);chart.replaceChildren(block);
    const raw=rows,means=rows.filter(r=>Number.isFinite(r.x_rf_average_mm)),spectrumData=view==='spectrum'?spectrum(rows,fMHz):null;
    const lastCycle=rows.at(-1).cycle,number=x=>Number.isFinite(x)?Number(x.toPrecision(5)).toString():'—';
    if((view==='filtered'||view==='spatial')&&!report.secular_approx_valid)help.append(document.createTextNode(' '+t.averageWarning));
    if(view==='spectrum'&&lastCycle<32)help.append(document.createTextNode(' '+t.shortSpectrum));
    function spatial(f) {
      const w=Math.max(200,Math.min(1440,stage.clientWidth||chart.clientWidth||800)),narrow=w<520;
      const titleLines=C.wrap(t.spatial,w-36,narrow?16:20),top=18+titleLines.length*(narrow?21:25),height=narrow?280:390;
      const footer=top+height+30,footerLines=[
        t.actual+': '+number(raw[Math.min(raw.length-1,Math.round(f*(raw.length-1)))].time_us)+' µs',
        'a = '+number(report.shared.a)+' · q = '+number(report.shared.q)+' · r₀ = '+number(r0)+' mm',
        'z = z₀ + v_z t · '+t.completed
      ].flatMap(x=>C.wrap(x,w-36,12));
      const legendLines=[t.integrated,t.mean,t.radius].map(x=>C.wrap(x,w-70,12)),legendHeight=legendLines.reduce((a,x)=>a+x.length*17+8,0);
      const h=footer+footerLines.length*17+legendHeight+18;
      const svg=element('svg',{xmlns:NS,viewBox:'0 0 '+w+' '+h,width:w,height:h,role:'img','aria-label':t.spatial,
        style:'display:block;background:white;font-family:Arial,\"Noto Sans\",sans-serif','data-motion-projection':perspectiveToggle.checked?'perspective':'orthographic',
        'data-camera-azimuth-deg':yaw.toFixed(4),'data-camera-elevation-deg':pitch.toFixed(4),
        'data-camera-orbit-active':orbitToggle.checked?'true':'false'});
      svg.append(element('rect',{width:w,height:h,fill:'#ffffff'}));
      const text=(lines,x,y,size,attrs={})=>{const n=element('text',{x,y,'font-size':size,fill:'#243b56',...attrs});lines.forEach((s,i)=>n.append(element('tspan',{x,dy:i?size+4:0},s)));return n;};
      svg.append(text(titleLines,18,22,narrow?16:20,{'font-weight':600,'data-chart-label':'title'}));
      let zmin=Math.min(...raw.map(r=>r.z_mm)),zmax=Math.max(...raw.map(r=>r.z_mm));
      if(zmax-zmin<2*r0){const z=(zmin+zmax)/2;zmin=z-r0;zmax=z+r0;}
      const zmid=(zmin+zmax)/2,bounds=[];
      const cameraDistance=Math.max(6*r0,2.5*(zmax-zmin),1);
      const renderPoint=p=>{
        const [u,v,depth]=project(p,yaw,pitch,zmid);
        if(!perspectiveToggle.checked)return[u,v];
        // Pure visualization projection, not a 3-D electrode-field solution.
        const magnification=cameraDistance/Math.max(cameraDistance*.2,cameraDistance-depth);
        return[u*magnification,v*magnification];
      };
      for(const x of [-1.3*r0,1.3*r0])for(const y of [-1.3*r0,1.3*r0])for(const z of [zmin,zmax])bounds.push(renderPoint([x,y,z]));
      const loX=Math.min(...bounds.map(p=>p[0])),hiX=Math.max(...bounds.map(p=>p[0])),loY=Math.min(...bounds.map(p=>p[1])),hiY=Math.max(...bounds.map(p=>p[1]));
      const scale=Math.min((w-64)/(hiX-loX),(height-58)/(hiY-loY)),cx=w/2,cy=top+height/2;
      const xy=p=>{const v=renderPoint(p);return [cx+(v[0]-(loX+hiX)/2)*scale,cy-(v[1]-(loY+hiY)/2)*scale];};
      const path=(points,color,width=1,dash=null)=>{const n=element('polyline',{points:points.map(p=>xy(p).map(x=>x.toFixed(3)).join(',')).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);return n;};
      svg.append(element('rect',{x:12,y:top+6,width:w-24,height:height-12,rx:8,fill:'#f3f8fc',stroke:'#dbe7f0'}));
      for(const z of [zmin,(zmin+zmax)/2,zmax])path(Array.from({length:97},(_,i)=>[r0*Math.cos(i*Math.PI/48),r0*Math.sin(i*Math.PI/48),z]),'#b0c4d6',1,'4 4');
      for(let i=0;i<8;i++){const a=i*Math.PI/4;path([[r0*Math.cos(a),r0*Math.sin(a),zmin],[r0*Math.cos(a),r0*Math.sin(a),zmax]],'#d2dfeb');}
      path(raw.map(r=>[r.x_mm,r.y_mm,r.z_mm]),'#cbdde9',1.4);
      const end=Math.max(1,Math.min(raw.length,1+Math.round(f*(raw.length-1)))),seen=raw.slice(0,end);
      path(seen.map(r=>[r.x_mm,r.y_mm,r.z_mm]),BLUE,2.5);
      if(meanToggle.checked&&means.length)path(means.filter(r=>r.cycle<=seen.at(-1).cycle).map(r=>[r.x_rf_average_mm,r.y_rf_average_mm,r.z_rf_average_mm]),TEAL,2.2);
      const p=xy([seen.at(-1).x_mm,seen.at(-1).y_mm,seen.at(-1).z_mm]);
      svg.append(element('circle',{cx:p[0],cy:p[1],r:5,fill:!report.alive&&f===1?'#be3c42':GOLD,stroke:'white','stroke-width':2}));
      const origin=[0,0,zmid],axes=[['x',[r0,0,zmid],BLUE],['y',[0,r0,zmid],TEAL],['z',[0,0,zmax],GOLD]];
      for(const [name,p1,color]of axes){path([origin,p1],color,1.6);const a=xy(p1);svg.append(element('text',{x:a[0]+4,y:a[1]-6,'font-size':12,fill:color,'font-weight':700},name));}
      svg.append(text(footerLines,18,footer,12,{'data-chart-label':'caption'}));
      let ly=footer+footerLines.length*17+12;
      for(let i=0;i<legendLines.length;i++){svg.append(element('line',{x1:18,x2:38,y1:ly-4,y2:ly-4,stroke:[BLUE,TEAL,'#a2b8ca'][i],'stroke-width':2.4}));svg.append(text(legendLines[i],48,ly,12,{'data-chart-label':'legend'}));ly+=legendLines[i].length*17+8;}
      return svg;
    }
    function frame(f) {
      fraction=f;
      if(view==='spatial'&&orbitToggle.checked){
        yaw=((orbitBase+360*f+180)%360+360)%360-180;
        yawInput.value=String(Math.round(yaw));
      }
      const count=Math.max(1,Math.min(raw.length,1+Math.round(f*(raw.length-1)))),seen=raw.slice(0,count),last=seen.at(-1);
      const width=Math.max(200,stage.clientWidth||chart.clientWidth||800),options={width};
      let svg,title=t[view]||t.time,series=[],xlabel=t.cycles,ylabel=t.position;
      const caption=t.actual+': '+number(last.time_us)+' µs · '+number(last.cycle)+' RF '+(!report.alive&&f===1?'· '+t.lost:'');
      options.caption=caption;
      const visible=(name,field,color)=>{series.push({name:'',color:'#d6e3ed',rows:raw.map(r=>({x:r.cycle,y:r[field]}))},{name,color,rows:seen.map(r=>({x:r.cycle,y:r[field]}))});};
      if(view==='spatial')svg=spatial(f);
      else {
        if(view==='orbit'){
          const ring=Array.from({length:129},(_,i)=>({x:r0*Math.cos(i*Math.PI/64),y:r0*Math.sin(i*Math.PI/64)}));
          series=[{name:'',color:'#d6e3ed',rows:raw.map(r=>({x:r.x_mm,y:r.y_mm}))},{name:t.integrated,color:BLUE,rows:seen.map(r=>({x:r.x_mm,y:r.y_mm}))},
            {name:t.mean,color:TEAL,rows:means.filter(r=>r.cycle<=last.cycle).map(r=>({x:r.x_rf_average_mm,y:r.y_rf_average_mm}))},{name:t.radius,color:'#97aabd',dash:'5 4',rows:ring}];
          xlabel='x (mm)';ylabel='y (mm)';options.equalAspect=true;options.markers=[{x:last.x_mm,y:last.y_mm,label:t.current,color:GOLD}];
        }else if(['xz','yz','rz'].includes(view)){
          // Source x, y and z are the same integrated phase-space sample.
          // z is free flight; radial motion is from the ideal quadrupole,
          // so the projection does not imply 3D electrostatic focusing.
          const axis=view==='xz'?'x_mm':view==='yz'?'y_mm':'r_mm';
          const coordinate=view==='xz'?'x':view==='yz'?'y':'r';
          series=[
            {name:'',color:'#d6e3ed',rows:raw.map(row=>({x:row.z_mm,y:row[axis]}))},
            {name:t.integrated,color:BLUE,rows:seen.map(row=>({x:row.z_mm,y:row[axis]}))}
          ];
          xlabel='z (mm)';ylabel=coordinate+' (mm)';
          options.equalAspect=true;
          options.markers=[{x:last.z_mm,y:last[axis],label:t.current,color:GOLD}];
          options.caption=caption+' · '+t.model;
        }else if(view==='phase'){
          series=[{name:'',color:'#d6e3ed',rows:raw.map(r=>({x:r.x_mm,y:r.vx_mm_per_us}))},{name:'x–vₓ',color:BLUE,rows:seen.map(r=>({x:r.x_mm,y:r.vx_mm_per_us}))}];
          xlabel='x (mm)';ylabel='vₓ (mm/µs)';options.markers=[{x:last.x_mm,y:last.vx_mm_per_us,label:t.current,color:GOLD}];
        }else if(view==='filtered'){
          visible('x (mm)','x_mm',BLUE);
          series.push({name:t.mean,color:TEAL,rows:means.map(r=>({x:r.cycle,y:r.x_rf_average_mm}))},
            {name:t.residual,color:GOLD,rows:means.map(r=>({x:r.cycle,y:r.x_rf_residual_mm}))});
          options.caption=caption+' · '+t.filterNote;
        }else if(view==='axial'){visible('z (mm)','z_mm',TEAL);options.caption=caption+' · z = z₀ + v_z t';}
        else if(view==='comparison'){
          series=(report.phase_comparison||[]).map((run,i)=>({name:'φ = '+number(run.phase_rad)+' rad',color:[BLUE,TEAL,GOLD][i],rows:run.samples.map(r=>({x:r.cycle,y:r.x_mm}))}));
          options.references=[{x:last.cycle,label:t.current,color:'#b34a54'}];ylabel='x (mm)';
        }else if(view==='spectrum'){
          if(!spectrumData)throw Error('At least eight uniformly spaced samples are required');
          series=[{name:'x · '+t.integrated,color:BLUE,rows:spectrumData.points}];xlabel='f (MHz)';ylabel='Amplitude (mm)';
          const point=spectrumData.points[Math.min(spectrumData.points.length-1,Math.round(f*(spectrumData.points.length-1)))];
          options.markers=[{x:point.x,y:point.y,label:t.bin,color:GOLD}];
          options.references=[{x:fMHz,label:'f_RF',color:'#777e8b'}];
          if(report.secular_approx_valid)options.references.push({x:Math.abs(report.shared.q)*fMHz/(2*Math.sqrt(2)),label:t.lowq,color:TEAL});
          options.caption=t.resolution+': '+number(spectrumData.resolution_MHz)+' MHz · '+t.spectralNote;
        }else{visible('x (mm)','x_mm',BLUE);visible('y (mm)','y_mm',GOLD);options.references=[{x:last.cycle,label:t.current,color:TEAL}];}
        svg=C.plot(series,title,xlabel,ylabel,options);
      }
      currentSVG=svg;stage.replaceChildren(svg);return svg;
    }
    const move=()=>{orbitToggle.checked=false;yaw=Number(yawInput.value);pitch=Number(pitchInput.value);frame(fraction);};
    yawInput.addEventListener('input',move);pitchInput.addEventListener('input',move);
    meanToggle.addEventListener('change',()=>frame(fraction));
    perspectiveToggle.addEventListener('change',()=>frame(fraction));
    orbitToggle.addEventListener('change',()=>{
      orbitBase=yaw-360*fraction;frame(fraction);
    });
    const resetCamera=()=>{orbitToggle.checked=false;orbitBase=-35;yaw=-35;pitch=25;yawInput.value=yaw;pitchInput.value=pitch;frame(fraction);};reset.addEventListener('click',resetCamera);
    let pointer=null;
    stage.addEventListener('pointerdown',e=>{if(view!=='spatial')return;orbitToggle.checked=false;pointer={x:e.clientX,y:e.clientY,yaw,pitch};stage.setPointerCapture(e.pointerId);});
    stage.addEventListener('pointermove',e=>{if(!pointer)return;yaw=Math.max(-180,Math.min(180,pointer.yaw+(e.clientX-pointer.x)*.5));pitch=Math.max(-80,Math.min(80,pointer.pitch-(e.clientY-pointer.y)*.4));yawInput.value=yaw;pitchInput.value=pitch;frame(fraction);});
    stage.addEventListener('pointerup',()=>{pointer=null;});stage.addEventListener('pointercancel',()=>{pointer=null;});
    stage.addEventListener('keydown',e=>{if(view!=='spatial')return;if(e.key.toLowerCase()==='r'){resetCamera();return;}
      const delta={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]}[e.key];if(!delta)return;e.preventDefault();
      yawInput.value=Math.max(-180,Math.min(180,yaw+delta[0]));pitchInput.value=Math.max(-80,Math.min(80,pitch+delta[1]));move();});
    frame(1);
    return {container:slot,renderFrame:frame,getSVG:()=>currentSVG,spectrum:spectrumData,destroy(){block.remove();}};
  }
  host.ZGRFQMotionView=Object.freeze({mount,spectrum,project});
  if(typeof module==='object'&&module.exports)module.exports={spectrum,project};
})(typeof window==='object'?window:globalThis);
