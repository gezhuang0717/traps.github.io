(() => {
  const root=document.querySelector('[data-trap2d]'), M=window.ZGTrapMotion;
  if(!root||!M) return;
  const q=s=>root.querySelector(s), top=q('#zg-sim-top'), side=q('#zg-sim-side'), gt=top.getContext('2d'), gs=side.getContext('2d');
  const ui=Object.fromEntries(['ratio','rp','rm','speed'].map(k=>[k,q('#zg-'+k)]));
  let t=0,trail=[],o,pulse=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,recordText=[], K=2;
  const setK=k=>{K=k;top.width=420*k;top.height=420*k;side.width=140*k;side.height=420*k;};setK(K);
  const sync=()=>{for(const k of ['rp','rm']){const v=100*M.radius(o[k==='rp'?'plus':'minus']);if(v>+ui[k].max){ui[k].max=Math.ceil(v);ui[k]._number.max=ui[k].max;}ui[k].value=v;q('#zg-'+k+'-o').textContent=v.toFixed(2);ui[k]._number.value=v.toFixed(2);}};
  const reset=()=>{o={plus:[+ui.rp.value/100,0],minus:[+ui.rm.value/100,0],axial:.65,phz:0};t=0;trail=[];pulse=null;};reset();
  Object.entries(ui).forEach(([k,r])=>{const n=document.createElement('input');n.type='number';n.min=r.min;n.max=r.max;n.step=r.step||'1';n.value=r.step==='1'?r.value:(+r.value).toFixed(2);n.setAttribute('aria-label',r.parentElement.childNodes[0].textContent.trim());n.className='zg-motion-number';r.after(n);r._number=n;
    r.addEventListener('input',()=>{n.value=r.step==='1'?r.value:(+r.value).toFixed(2);q('#zg-'+k+'-o').textContent=n.value;if(k==='rp'||k==='rm'){const key=k==='rp'?'plus':'minus',a=o[key],ph=Math.atan2(a[1],a[0]);o[key]=[+r.value/100*Math.cos(ph),+r.value/100*Math.sin(ph)];pulse=null;}});
    n.addEventListener('input',()=>{if(n.value!==''&&n.validity.valid){r.value=n.value;r.dispatchEvent(new Event('input'));}});
  });
  q('#zg-convert').onclick=()=>{pulse={elapsed:0,T:8};paused=false;};
  q('#zg-clear').onclick=()=>{trail=[];draw();};
  q('[data-motion-action="pause"]').onclick=()=>{paused=!paused;q('[data-motion-action="pause"]').setAttribute('aria-pressed',String(paused));};
  q('[data-motion-action="reset"]').onclick=()=>{ui.rp.value=25;ui.rm.value=70;reset();sync();draw();};
  q('#zg-sim-png').onclick=()=>{const k=K;setK(6);draw();window.zgExport?.png(top,'penning-trap-2d');setK(k);draw();};
  q('#zg-sim-video').onclick=function(){const b=this, k=K, was=paused,seconds=+q('[data-seconds]').value, process=q('[data-process]').value;
    recordText=['r+0='+Number(ui.rp.value).toFixed(2)+'; r−0='+Number(ui.rm.value).toFixed(2)+' (% of display scale)', 'ratio='+ui.ratio.value+'; speed='+ui.speed.value+'; '+process];
    if(process!=='current'){reset();sync();}
    setK(3);draw();window.zgExport?.record(top,seconds,'penning-2d-'+process,r=>{b.disabled=r;if(r){paused=false;if(process==='pulse')pulse={elapsed:0,T:seconds*(+ui.speed.value)*.75};draw();}else{paused=was;setK(k);draw();}});
  };
  function evolve(dt){const f=M.modes(+ui.ratio.value),cool=q('[data-cooling]').checked||q('[data-process]').value==='gas'&&q('#zg-sim-video').disabled||q('[data-process]').value==='sideband'&&q('#zg-sim-video').disabled;
    const recording=q('#zg-sim-video').disabled,proc=q('[data-process]').value,gamma=+q('[data-gamma]').value;
    if(cool) M.drag(o,dt/2,gamma,f);
    if(pulse){const h=Math.min(dt,pulse.T-pulse.elapsed);M.coupling(o,h,Math.PI/(2*pulse.T),0,pulse.elapsed);pulse.elapsed+=h;if(pulse.elapsed>=pulse.T-1e-10)pulse=null;}
    else if(q('[data-sideband]').checked||recording&&proc==='sideband')M.coupling(o,dt,Math.PI/16);
    if(recording&&proc==='kick'&&t<8)M.kick(o,Math.min(dt,8-t),.06,+q('[data-dipole-phase]').value*Math.PI/180);
    if(cool)M.drag(o,dt/2,gamma,f);
    t+=dt;const p=M.point(o,f,t);trail.push([210+189*p[0]*.65,210-189*p[1]*.65]);if(trail.length>2500)trail.shift();sync();
  }
  function draw(){gt.setTransform(K,0,0,K,0,0);gs.setTransform(K,0,0,K,0,0);const css=getComputedStyle(document.documentElement),ink=css.getPropertyValue('--zg-ink').trim()||'#202536',line=css.getPropertyValue('--zg-line').trim()||'#b0b7c4';
    gt.clearRect(0,0,420,420);if(q("#zg-sim-video").disabled){gt.fillStyle=css.getPropertyValue("--zg-card").trim()||"#fff";gt.fillRect(0,0,420,420);}gt.strokeStyle=line;gt.lineWidth=1;gt.beginPath();gt.arc(210,210,189,0,Math.PI*2);gt.stroke();gt.beginPath();gt.moveTo(204,210);gt.lineTo(216,210);gt.moveTo(210,204);gt.lineTo(210,216);gt.stroke();gt.fillStyle=ink;gt.font='14px system-ui';gt.fillText('q > 0, B ⊙',10,20);
    for(let i=1;i<trail.length;i++){gt.strokeStyle=`hsla(${220+140*i/trail.length},80%,55%,${.15+.85*i/trail.length})`;gt.beginPath();gt.moveTo(...trail[i-1]);gt.lineTo(...trail[i]);gt.stroke();}
    if(q('#zg-sim-video').disabled)window.zgExport.caption(gt,420,recordText,40);
    const p=M.point(o,M.modes(+ui.ratio.value),t),s=[210+189*p[0]*.65,210-189*p[1]*.65];gt.fillStyle='#e5484d';gt.beginPath();gt.arc(...s,5,0,Math.PI*2);gt.fill();gs.clearRect(0,0,140,420);gs.strokeStyle=ink;gs.lineWidth=3;gs.beginPath();gs.moveTo(15,20);gs.quadraticCurveTo(70,70,125,20);gs.moveTo(15,400);gs.quadraticCurveTo(70,350,125,400);gs.stroke();gs.fillStyle='#e5484d';gs.beginPath();gs.arc(70+p[0]*20,210+p[2]*145,5,0,Math.PI*2);gs.fill();gs.fillStyle=ink;gs.font='14px system-ui';gs.fillText('z',76,44);
  }
  function loop(now){const rect=root.getBoundingClientRect(),visible=rect.bottom>0&&rect.top<innerHeight;const elapsed=last?Math.min(.05,(now-last)/1000):0;last=now;if(!paused&&!root.closest('[hidden]')&&(visible||q('#zg-sim-video').disabled)){const n=Math.max(1,Math.ceil(elapsed*(+ui.speed.value)*M.modes(+ui.ratio.value).wp/.15));for(let i=0;i<n;i++)evolve(elapsed*(+ui.speed.value)/n);}if(visible||q('#zg-sim-video').disabled)draw();requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();
