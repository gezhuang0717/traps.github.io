/* 3D Penning trap — rotatable hyperbolic electrodes and a cloud of ions with
   magnetron (ν₋), reduced-cyclotron (ν₊) and axial (ν_z) motion.
   Options: frequency ratio, speed, radii, axial amplitude, trail length, number of ions and mass spread,
   buffer-gas cooling, dipole (ν₋) and quadrupole (ν_c, π-pulse) excitation, view presets, electrode/field/detector toggles. */
(() => {
  const root = document.querySelector("[data-trap3d]");
  if (!root) return;
  const M=window.ZGTrapMotion; if(!M) return;
  const cv = root.querySelector("canvas"), g = cv.getContext("2d");
  const LW = () => cv._w || cv.width, LH = () => cv._h || cv.height;   /* logical (CSS) size */
  const q = n => root.querySelector(`[name="${n}"]`);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ink = (getComputedStyle(document.documentElement).getPropertyValue("--zg-ink") || "").trim() || "#1d2433";
  let yaw = 0.6, pitch = 0.35, zoom = 1, drag = null, t = 0, ions = [], pulse = null, dip = 0, paused=reduce, last=0, recording=false,recordText=[];

  function makeIons() {
    const n=+q("ions").value,spread=+q("spread").value/100;
    ions=Array.from({length:n},(_,i)=>({m:i===0?1:1+spread*(2*i/n-1),phz:2*Math.PI*i/n,trail:[],plus:[+q("rp").value/100,0],minus:[+q("rm").value/100*Math.cos(2*Math.PI*i/n),+q("rm").value/100*Math.sin(2*Math.PI*i/n)],axial:+q("az").value/100}));
    t=0;pulse=null;dip=0;
  }
  const control=s=>root.querySelector(s);
  function liveRadii(){const o=ions[0];if(!o)return;for(const [k,value] of [["rp",100*M.radius(o.plus)],["rm",100*M.radius(o.minus)],["az",100*o.axial]]){const r=q(k);if(value>+r.max){r.max=Math.ceil(value);if(r._number)r._number.max=r.max;}r.value=value;r.parentElement.querySelector('output').textContent=value.toFixed(2);if(r._number)r._number.value=value.toFixed(2);}}
  function begin(a,T=8){paused=false;if(a==='pulse')pulse={elapsed:0,T};if(a==='dipole')dip=8;}
  function P(x, y, z) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
    const d = 5 / (5 + y2), s = Math.min(LW(), LH() * 1.3) / 5.6 * zoom * d;
    return [LW() / 2 + x1 * s, LH() / 2 - z2 * s];
  }
  /* electrode meshes: ring r²/2 − z² = z0², caps z² − r²/2 = z0² */
  const mesh = [];
  for (let j = 0; j < 12; j++) {
    const ph = j / 12 * 6.283, ring = [], cu = [], cd = [];
    for (let i = 0; i <= 16; i++) {
      const zr = -0.9 + 1.8 * i / 16, rr = Math.sqrt(2 * (1 + zr * zr)), rc = i / 16 * 1.6, zc = Math.sqrt(1 + rc * rc / 2);
      ring.push([rr * Math.cos(ph), rr * Math.sin(ph), zr]); cu.push([rc * Math.cos(ph), rc * Math.sin(ph), zc]); cd.push([rc * Math.cos(ph), rc * Math.sin(ph), -zc]);
    }
    mesh.push(["ring", ring], ["cap", cu], ["cap", cd]);
  }
  for (let m = 0; m <= 4; m++) {
    const zr = -0.9 + m * 0.45, rr = Math.sqrt(2 * (1 + zr * zr)), rc = m * 0.4, zc = Math.sqrt(1 + rc * rc / 2), a = [], b = [], c = [];
    for (let k = 0; k <= 48; k++) { const p = k / 48 * 6.283; a.push([rr * Math.cos(p), rr * Math.sin(p), zr]); b.push([rc * Math.cos(p), rc * Math.sin(p), zc]); c.push([rc * Math.cos(p), rc * Math.sin(p), -zc]); }
    mesh.push(["ring", a], ["cap", b], ["cap", c]);
  }
  const line = (pts, style, w = 1) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => { const s = P(...p); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.stroke(); };

  function step(dt) {
    const ratio=+q("ratio").value,ref=M.modes(ratio),cool=q("cool").checked, gamma=+control('[data-gamma]').value;
    ions.forEach(o=>{
      const f=M.modes(ratio,o.m);if(!f){o.trail=[];return;}
      if(cool)M.drag(o,dt/2,gamma,f);
      if(pulse)M.coupling(o,Math.min(dt,pulse.T-pulse.elapsed),Math.PI/(2*pulse.T),f.wc-ref.wc,pulse.elapsed);
      else if(control('[data-sideband]').checked)M.coupling(o,dt,Math.PI/16,f.wc-ref.wc,t);
      if(dip>0)M.kick(o,Math.min(dt,dip),.06,+control('[data-dipole-phase]').value*Math.PI/180,f.wm-ref.wm,t);
      if(cool)M.drag(o,dt/2,gamma,f);
      const pos=M.point(o,f,t+dt);o.trail.push(pos);const L=+q("trail").value;while(o.trail.length>L)o.trail.shift();
    });
    if(pulse){pulse.elapsed+=dt;if(pulse.elapsed>=pulse.T-1e-10)pulse=null;}
    dip=Math.max(0,dip-dt);t+=dt;liveRadii();
  }
  function draw() {
    g.setTransform(cv.width / LW(), 0, 0, cv.height / LH(), 0, 0); g.clearRect(0, 0, LW(), LH());

    if (q("electrodes").checked) mesh.forEach(([k, pts]) => line(pts, k === "ring" ? "rgba(214,140,40,.5)" : "rgba(90,120,220,.45)"));
    if (q("field").checked) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; line([[1.9 * Math.cos(a), 1.9 * Math.sin(a), -1.9], [1.9 * Math.cos(a), 1.9 * Math.sin(a), 1.9]], "rgba(120,120,140,.35)"); }
    line([[0, 0, -2], [0, 0, 2]], ink, 1.5); const b = P(0, 0, 2); g.fillStyle = ink; g.font = "13px system-ui"; g.fillText("B", b[0] + 6, b[1]);
    if (q("detector").checked) {            /* PI-ICR-like projection onto a detector plane below the trap */
      const zD = -2.1; line([[-1.4, -1.4, zD], [1.4, -1.4, zD], [1.4, 1.4, zD], [-1.4, 1.4, zD], [-1.4, -1.4, zD]], "rgba(229,72,77,.5)");
      ions.forEach((o, k) => { const p = o.trail[o.trail.length - 1]; if (!p) return; const s = P(p[0] * 1.3, p[1] * 1.3, zD); g.fillStyle = `hsla(${k / ions.length * 300},85%,50%,.8)`; g.beginPath(); g.arc(s[0], s[1], 3, 0, 6.283); g.fill(); });
    }
    ions.forEach((o, k) => {
      const hue = ions.length > 1 ? k / (ions.length - 1) * 300 : null;
      for (let n = 1; n < o.trail.length; n++) {
        const a = P(...o.trail[n - 1]), c = P(...o.trail[n]), f = n / o.trail.length;
        g.strokeStyle = `hsla(${hue ?? f * 300},85%,55%,${0.08 + 0.9 * f})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke();
      }
      const e = o.trail[o.trail.length - 1]; if (e) { const s = P(...e); g.fillStyle = hue == null ? "#e5484d" : `hsl(${hue},85%,45%)`; g.beginPath(); g.arc(s[0], s[1], 4.5, 0, 6.283); g.fill(); }
    });
  }
  function recordingCaption(){if(recording){window.zgExport.caption(g,LW(),recordText);g.globalCompositeOperation='destination-over';g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--zg-card').trim()||'#fff';g.fillRect(0,0,LW(),LH());g.globalCompositeOperation='source-over';}}
  function loop(now){const rect=root.getBoundingClientRect(),visible=rect.bottom>0&&rect.top<innerHeight;const elapsed=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(!paused&&!root.closest('[hidden]')&&(visible||recording)){const dt=elapsed*(+q("speed").value),n=Math.max(1,Math.ceil(M.modes(+q("ratio").value).wp*dt/.2));for(let k=0;k<n;k++)step(dt/n);if(q("auto").checked&&!drag)yaw+=elapsed*.24;}
    if(visible||recording){draw();recordingCaption();}requestAnimationFrame(loop);
  }

  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (drag) { yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.5, Math.min(1.5, drag[3] + (e.clientY - drag[1]) * 0.01)); } });
  cv.addEventListener("pointerup", () => { drag = null; });
  cv.addEventListener("wheel", e => { e.preventDefault(); zoom = Math.max(0.5, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  root.addEventListener("click", e => {
    const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
    if (a === "pulse") begin("pulse");
    if (a === "dipole") begin("dipole");
    if (a === "reset") { yaw = 0.6; pitch = 0.35; zoom = 1; }
    if (a === "top") { pitch = 1.5; q("auto").checked = false; }
    if (a === "side") { pitch = 0; q("auto").checked = false; }
    if (a === "iso") { pitch = 0.35; yaw = 0.6; }
    if (a === "png" && window.zgExport) {            /* 3× resolution still */
      const w = cv.width, h = cv.height; cv.width = LW() * 6; cv.height = LH() * 6;     /* 6× still on white */
      draw(); g.globalCompositeOperation = "destination-over"; g.fillStyle = "#fff"; g.fillRect(0, 0, LW(), LH()); g.globalCompositeOperation = "source-over";
      zgExport.png(cv, "penning-trap-3d"); cv.width = w; cv.height = h; draw();
    }
    if(a==='video'&&window.zgExport){const b=e.target.closest('[data-act]'),w=cv.width,h=cv.height,was=paused,seconds=+control('[data-seconds]').value,process=control('[data-process]').value;
      recordText=['r+0='+Number(q('rp').value).toFixed(2)+'; r−0='+Number(q('rm').value).toFixed(2)+'; z0='+Number(q('az').value).toFixed(2)+' (% of display scale)', 'ratio='+q('ratio').value+'; speed='+q('speed').value+'; ions='+q('ions').value+'; '+process];
      if(process!=='current'){makeIons();liveRadii();q('cool').checked=process==='gas'||process==='sideband';control('[data-sideband]').checked=process==='sideband';}
      cv.width=LW()*3;cv.height=LH()*3;draw();
      zgExport.record(cv,seconds,'penning-3d-'+process,r=>{recording=r;b.disabled=r;b.classList.toggle('is-rec',r);if(r){paused=false;if(process==='pulse')begin('pulse',seconds*(+q('speed').value)*.75);if(process==='kick')begin('dipole');draw();recordingCaption();}else{paused=was;cv.width=w;cv.height=h;draw();}});
    }
  });
  control('[data-motion-action="pause"]').onclick=()=>{paused=!paused;control('[data-motion-action="pause"]').setAttribute('aria-pressed',String(paused));};
  control('[data-motion-action="reset"]').onclick=()=>{q('rp').value=25;q('rm').value=65;q('az').value=45;makeIons();liveRadii();};
  ["ions", "spread", "rp", "rm", "az"].forEach(n => q(n).addEventListener("input", makeIons));
  root.querySelectorAll("input[type=range]").forEach(r => { const o = r.parentElement.querySelector("output"); if (o) { const u = () => (o.textContent = r.step==="1"||["ions","trail"].includes(r.name)?r.value:(+r.value).toFixed(2)); r.addEventListener("input",u);u();const n=document.createElement('input');n.type='number';n.min=r.min;n.max=r.max;n.step=r.step||'1';n.value=o.textContent;n.className='zg-motion-number';n.setAttribute('aria-label',r.parentElement.childNodes[0].textContent.trim());r.after(n);r._number=n;r.addEventListener('input',()=>n.value=o.textContent);n.addEventListener('input',()=>{if(n.value!==''&&n.validity.valid){r.value=n.value;r.dispatchEvent(new Event('input'));}}); } });
  /* logical size follows the card width (height ≤ 80 % of the window); backing store at ≥ 2× for sharp lines */
  const fitCanvas = () => { const w = Math.round(cv.getBoundingClientRect().width), h = Math.round(Math.min(w * 0.78, innerHeight * 0.8)), k = Math.min(3, Math.max(2, devicePixelRatio || 1));
    if (w && (Math.abs(w - LW()) > 2 || Math.abs(h - LH()) > 2)) { cv._w = w; cv._h = h; cv.width = w * k; cv.height = h * k; cv.style.aspectRatio = `${w} / ${h}`; } };
  new ResizeObserver(fitCanvas).observe(cv); addEventListener("resize", fitCanvas);
  makeIons(); requestAnimationFrame(loop);
})();
