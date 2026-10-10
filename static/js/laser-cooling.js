/* Laser-cooling game — Games → Laser cooling.
   Original tab: 1D optical molasses, stochastic per-photon Poisson simulation (physics.js molassesStep) compared with the
   semiclassical theory (molassesTheory). Advanced tab: one ion in a Penning trap cooled by a radial, offset, tilted beam
   (penningLaser / amplitudeAt; Itano & Wineland PRA 25, 35 (1982); Hendricks et al. arXiv:0709.3817).
   Mass presets use AME2020 atomic mass minus q electron masses; ionization binding corrections are omitted. */
(() => {
  "use strict";
  const P = window.ZGPhysics; if (!P) return;
  const U = 1.66053906660e-27, ME = 5.48579909065e-4, TAU = 2 * Math.PI;
  const css = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
  const ink = () => css("--zg-ink", getComputedStyle(document.body).color || "#222");
  const fmt = (x, d = 3) => !isFinite(x) ? "∞" : Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(d - 1) : x.toPrecision(d);
  const tUnit = T => !isFinite(T) ? "∞" : T >= 1 ? fmt(T) + " K" : T >= 1e-3 ? fmt(T * 1e3) + " mK" : T >= 1e-6 ? fmt(T * 1e6) + " µK" : fmt(T * 1e9) + " nK";
  const tmUnit = t => t >= 1 ? fmt(t) + " s" : t >= 1e-3 ? fmt(t * 1e3) + " ms" : fmt(t * 1e6) + " µs";
  function massU(s) { const A = +String(s.nuclide).match(/^\d+/)[0]; return s.mass_u || A - (s.q || 0) * ME; }
  function crisp(cv) { const r = Math.min(devicePixelRatio || 1, 2), w = cv.width, h = cv.height; if (!cv.dataset.w) { cv.dataset.w = w; cv.dataset.h = h; } const W = Math.max(320,Math.round(cv.clientWidth||360)), H = cv.dataset.cv==="win"?180:Math.max(180,Math.round(W*(+cv.dataset.h/+cv.dataset.w))); if (cv.width !== W * r || cv.height !== H * r) { cv.width = W * r; cv.height = H * r; } const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle="#fff"; g.fillRect(0,0,W,H); return { g, W, H }; }
  function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function pngOf(cvs, name) {
    const W = Math.max(...cvs.map(c => c.width)), H = cvs.reduce((s, c) => s + c.height, 0), out = document.createElement("canvas"); out.width = W; out.height = H;
    const g = out.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); let y = 0; cvs.forEach(c => { g.drawImage(c, 0, y); y += c.height; });
    if(window.zgExport)zgExport.png(out,name.replace(/\.png$/, ""));else out.toBlob(b => b && download(name, b), "image/png");
  }
  function axes(g, W, H, m, xl, yl) { g.strokeStyle = "#7b8ba2"; g.lineWidth = 1; g.beginPath(); g.moveTo(m.l, m.t); g.lineTo(m.l, H - m.b); g.lineTo(W - m.r, H - m.b); g.stroke(); g.fillStyle = "#23314a"; g.font = "12px system-ui,sans-serif"; g.textAlign = "center"; g.fillText(xl, (m.l + W - m.r) / 2, H - 4); g.save(); g.translate(12, (m.t + H - m.b) / 2); g.rotate(-Math.PI / 2); g.fillText(yl, 0, 0); g.restore(); }
  function temperaturePlot(cv,pts,th,L){const{g,W,H}=crisp(cv),m={l:62,r:16,t:65,b:38},tmax=Math.max(pts[pts.length-1][0],1e-9),vals=pts.map(x=>x[1]).filter(x=>x>0&&isFinite(x));const refs=[[th.TDoppler,"#15803d",L.t_doppler],[th.T,"#b45309",L.t_theory],[th.Trecoil,"#7c3aed",L.t_recoil]].filter(x=>x[0]>0&&isFinite(x[0]));const all=vals.concat(refs.map(x=>x[0])),lo=Math.floor(Math.log10(Math.min(...all)*1e3)),hi=Math.max(lo+1,Math.ceil(Math.log10(Math.max(...all)*1e3))),X=t=>m.l+(W-m.l-m.r)*t/tmax,Y=T=>H-m.b-(H-m.t-m.b)*(Math.log10(Math.max(T,1e-30)*1e3)-lo)/(hi-lo);g.font="11px system-ui";for(let e=lo;e<=hi;e++){const y=Y(10**e/1e3);g.strokeStyle="#dce3ed";g.beginPath();g.moveTo(m.l,y);g.lineTo(W-m.r,y);g.stroke();g.fillStyle="#23314a";g.textAlign="right";g.fillText(fmt(10**e,2),m.l-5,y+4);}for(let i=0;i<=4;i++){const t=tmax*i/4;g.textAlign="center";g.fillText(fmt(t*1e3,2),X(t),H-m.b+15);}refs.forEach(([T,c,label],i)=>{g.strokeStyle=c;g.setLineDash([5,4]);g.beginPath();g.moveTo(m.l,Y(T));g.lineTo(W-m.r,Y(T));g.stroke();g.setLineDash([]);g.fillStyle=c;g.textAlign="left";g.fillText(label+" · "+tUnit(T),m.l,14+i*15);});g.strokeStyle="#2563eb";g.lineWidth=2;g.beginPath();pts.forEach(([t,T],i)=>i?g.lineTo(X(t),Y(T)):g.moveTo(X(t),Y(T)));g.stroke();axes(g,W,H,m,L.time+" (ms)","T (mK, log)");}

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
  function sliders(box, fmts, onInput) {
    box.querySelectorAll(".g-slider input[type=range]").forEach(inp => { const o = box.querySelector(`output[data-o="${inp.name}"]`), show = () => { if (o) o.textContent = fmts[inp.name] ? fmts[inp.name](+(inp._number?.value??inp.value)) : inp.value; }; const num=document.createElement("input");num.type="number";num.className="g-num";num.min=inp.min;num.max=inp.max;num.step=inp.name==="B"?"any":inp.step;num.value=inp.name==="B"?(+inp.value).toFixed(10):inp.value;num.dataset.numeric=inp.name;inp._number=num;num.setAttribute("aria-label",inp.closest("label").childNodes[0].textContent.trim());inp.after(num);show();inp.addEventListener("input",()=>{num.value=inp.name==="B"?(+inp.value).toFixed(10):inp.value;show();onInput(inp.name);});num.addEventListener("change",()=>{if(!num.checkValidity())return;inp.value=num.value;show();onInput(inp.name);}); });
  }

  /* ---------- hand-typed ion/atom: derived quantities and explanation (shared with the Fancier tab) ---------- */
  const ZGCustomIon = {
    derive(v, B) { /* v: {mass_u, q, lambda_nm, gamma_MHz} → SI derived quantities used by the simulations */
      const H = 6.62607015e-34, HB = 1.054571817e-34, KB = 1.380649e-23, C = 299792458, E = 1.602176634e-19, U = 1.66053906660e-27;
      const m = v.mass_u * U, g = 2 * Math.PI * v.gamma_MHz * 1e6, lam = v.lambda_nm * 1e-9, k = 2 * Math.PI / lam;
      const out = { m, g, k, TD: HB * g / (2 * KB), Tr: (HB * k) ** 2 / (m * KB), vr: HB * k / m, vc: g / (2 * k), Isat: Math.PI * H * C * g / (3 * lam ** 3) / 10, amax: HB * k * g / (2 * m) };
      if (B > 0 && v.q > 0) out.nuc = v.q * E * B / (2 * Math.PI * m);
      return out;
    },
    text(d, zh) {
      const f = (x, u) => (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-2 ? x.toExponential(4) : x.toPrecision(5)) + " " + u;
      const p = [[zh ? "质量" : "m", f(d.m, "kg")], ["Γ", f(d.g, "rad/s")], ["k = 2π/λ", f(d.k, "m⁻¹")], ["T_D = ħΓ/2k_B", f(d.TD * 1e3, "mK")], ["T_r = ħ²k²/(m k_B)", f(d.Tr * 1e6, "µK")],
        ["v_rec = ħk/m", f(d.vr * 1e3, "mm/s")], ["v_cap ≈ Γ/2k", f(d.vc, "m/s")], ["I_sat = πhcΓ/3λ³", f(d.Isat, "mW/cm²")], [zh ? "最大减速 ħkΓ/2m" : "max decel. ħkΓ/2m", f(d.amax, "m/s²")]];
      if (d.nuc) p.push(["ν_c = qB/2πm", f(d.nuc / 1e3, "kHz")]);
      return p.map(([a, b]) => a + " = " + b).join(" · ");
    },
    help(zh) {
      const d = document.createElement("details"), s = document.createElement("summary"), q = document.createElement("div");
      s.textContent = zh ? "手动输入如何进入计算？（点击展开）" : "How are the hand-typed values used? (click)";
      const P = zh ? [
        "① 质量 m（u）：输入离子质量（AME 原子质量减去 q·mₑ）。m = 质量 × 1.66053906660×10⁻²⁷ kg。它决定反冲速度 v_rec = ħk/m、反冲温度 T_r、阱频率 ν_c = qB/2πm、ν_z ∝ √(qU₀/m d²)、保罗阱 q = 2QV/(m r₀²Ω²) 以及库仑相互作用下的加速度。",
        "② 电荷 q（e）：Q = q·e，进入所有阱频率、马蒂厄参数与离子间库仑力 Q²/4πε₀r²。",
        "③ 波长 λ（nm，真空）：k = 2π/λ，每个光子的动量 ħk；多普勒频移 k·v 决定冷却力 F(v) = ħk[R(δ−kv) − R(δ+kv)]；饱和光强 I_sat = πhcΓ/3λ³。",
        "④ 线宽 Γ/2π（MHz）：Γ = 2π × 输入值 × 10⁶ s⁻¹。散射率 R = (Γ/2)s/(1 + s + (2Δ/Γ)²)，失谐以 Γ 为单位（δ/Γ），多普勒极限 T_D = ħΓ/2k_B，俘获速度 ≈ Γ/2k。",
        "⑤ 计算步骤：输入 → 换算为 SI（m、Q、k、Γ）→ 每个时间步对每个离子计算局部 s 与 Δ = δ − k·v → 泊松抽样光子数 → 动量反冲 ħk 与随机发射反冲 → 更新速度 → 统计温度。下方一行显示由您的输入直接得到的各量，请先核对它们是否合理（例如 T_D 应为 µK–mK 量级）。",
        "⑥ 注意：模型为二能级跃迁（无超精细、暗态或回泵细节）；若 T_r ≳ T_D（窄线），半经典结果不可靠。"] : [
        "① Mass m (u): type the ion mass (AME atomic mass minus q·mₑ). m = value × 1.66053906660×10⁻²⁷ kg. It sets the recoil velocity v_rec = ħk/m, the recoil temperature T_r, the trap frequencies ν_c = qB/2πm, ν_z ∝ √(qU₀/m d²), the Paul q = 2QV/(m r₀²Ω²) and the Coulomb accelerations.",
        "② Charge q (e): Q = q·e enters every trap frequency, the Mathieu parameters and the ion–ion force Q²/4πε₀r².",
        "③ Wavelength λ (nm, vacuum): k = 2π/λ, photon momentum ħk; the Doppler shift k·v builds the cooling force F(v) = ħk[R(δ−kv) − R(δ+kv)]; saturation intensity I_sat = πhcΓ/3λ³.",
        "④ Linewidth Γ/2π (MHz): Γ = 2π × value × 10⁶ s⁻¹. Scattering rate R = (Γ/2)s/(1 + s + (2Δ/Γ)²); detunings are in units of Γ (δ/Γ); Doppler limit T_D = ħΓ/2k_B; capture velocity ≈ Γ/2k.",
        "⑤ Calculation chain: input → SI (m, Q, k, Γ) → every time step, for each ion: local s and Δ = δ − k·v → Poisson photon numbers → recoil ħk plus random emission kicks → new velocity → temperature statistics. The line below shows what your numbers give directly; check that they are sensible (T_D should be µK–mK).",
        "⑥ Caveat: two-level model (no hyperfine structure, dark states or repumpers); if T_r ≳ T_D (narrow line) the semiclassical result is not reliable."];
      for (const t of P) { const e = document.createElement("p"); e.textContent = t; q.append(e); }
      d.append(s, q); return d;
    },
    button(sel, zh) {
      const b = document.createElement("button"); b.type = "button"; b.className = "zg-btn zg-btn-ghost"; b.textContent = zh ? "✎ 手动输入离子" : "✎ Type ion by hand";
      b.title = zh ? "选择“自定义”，在下方输入质量、电荷、波长和线宽" : "Switch to the custom entry and type mass, charge, wavelength and linewidth below";
      b.addEventListener("click", () => { sel.value = "custom"; sel.dispatchEvent(new Event("change", { bubbles: true })); });
      sel.insertAdjacentElement("afterend", b); return b;
    }
  };
  window.ZGCustomIon = ZGCustomIon;

  function fillSpecies(box, list, L) {
    const sel = box.querySelector("select[name=species]");
    /* "custom" entry: mass (u), charge, λ (nm) and Γ/2π (MHz) typed by hand; values read live from the inputs */
    const zh = (document.documentElement.lang || "").startsWith("zh"), row = document.createElement("div"); row.className = "g-opts-row g-custom-ion"; row.dataset.customIon = ""; row.hidden = true;
    const head = document.createElement("strong"); head.textContent = zh ? "手动输入（自定义离子/原子）：" : "Typed by hand (custom ion/atom):"; row.append(head);
    const fld = (n, lab, v, step, tip) => { const l = document.createElement("label"), i = document.createElement("input"); i.type = "number"; i.name = n; i.dataset.fullPrecision = ""; i.step = step || "any"; i.value = v; i.title = tip; l.title = tip; l.append(lab + " ", i); row.append(l); return i; };
    const base = list.find(x => x.ion) || list[0], f = {
      m: fld("cMass", zh ? "离子质量 m (u)" : "ion mass m (u)", base.mass_u || +String(base.nuclide).match(/^\d+/)[0], "any", zh ? "离子质量（原子质量单位 u）；AME 原子质量减 q·mₑ" : "ion mass in u (AME atomic mass minus q·mₑ)"),
      q: fld("cCharge", zh ? "电荷 q (e)" : "charge q (e)", base.q, "1", zh ? "电荷态（中性原子填 0）" : "charge state (0 for a neutral atom)"),
      l: fld("cLambda", zh ? "冷却波长 λ (nm)" : "cooling wavelength λ (nm)", base.lambda_nm, "any", zh ? "冷却跃迁的真空波长" : "vacuum wavelength of the cooling transition"),
      g: fld("cGamma", zh ? "自然线宽 Γ/2π (MHz)" : "natural linewidth Γ/2π (MHz)", base.gamma_MHz, "any", zh ? "跃迁自然线宽 Γ/2π = 1/(2πτ)" : "natural linewidth Γ/2π = 1/(2πτ) of the transition") };
    const derived = document.createElement("div"); derived.className = "g-custom-derived";
    const upd = () => { const B = +(box.querySelector('[name=B]')?.value || 0); derived.textContent = (zh ? "由输入得到：" : "Derived from your input: ") + ZGCustomIon.text(ZGCustomIon.derive({ mass_u: +f.m.value, q: +f.q.value, lambda_nm: +f.l.value, gamma_MHz: +f.g.value }, B), zh); };
    row.append(derived, ZGCustomIon.help(zh)); upd(); row.addEventListener("input", upd);
    const custom = { id: "custom", label: zh ? "✎ 自定义（手动输入）" : "✎ Custom (type by hand)", ion: !!box.dataset.laser && box.dataset.laser === "penning" ? true : base.ion, nuclide: "0X", repump: "—", note: zh ? "用户输入" : "user input", src: "" };
    Object.defineProperties(custom, { mass_u: { get: () => +f.m.value }, q: { get: () => +f.q.value }, lambda_nm: { get: () => +f.l.value }, gamma_MHz: { get: () => +f.g.value } });
    list.push(custom); sel.closest(".g-opts-row").after(row);
    list.forEach(s => sel.add(new Option(s.label, s.id)));
    ZGCustomIon.button(sel, zh);
    sel.addEventListener("change", () => { row.hidden = sel.value !== "custom";
      if (sel.value === "custom" && sel.dataset.last !== "custom") { const s0 = list.find(x => x.id === sel.dataset.last); if (s0) { f.m.value = s0.mass_u || f.m.value; f.q.value = s0.q; f.l.value = s0.lambda_nm; f.g.value = s0.gamma_MHz; upd(); } } /* pre-fill once, from the previous species */
      sel.dataset.last = sel.value; });
    sel.dataset.last = sel.value;
    row.addEventListener("change", () => sel.dispatchEvent(new Event("change")));
    const src = box.querySelector(".g-laser-src"); const show = () => { const s = list.find(x => x.id === sel.value); src.innerHTML = ""; const a = document.createElement("a"); a.href = s.src; a.textContent = L.source; src.append(`Γ/2π = ${s.gamma_MHz} MHz · λ = ${s.lambda_nm} nm · ${L.repump}: ${s.repump} · `, a); if(s.src2){const b=document.createElement('a');b.href=s.src2;b.textContent=L.source;src.append(' · ',b);}src.title = s.note;let detail=box.querySelector('[data-species-note]');if(!detail){detail=document.createElement('details');detail.dataset.speciesNote='';src.after(detail);}const summary=document.createElement('summary'),note=document.createElement('p');summary.textContent=document.documentElement.lang.startsWith('zh')?'谱线数据与近似':'Transition data and approximations';note.textContent=s.note;detail.replaceChildren(summary,note); }; show(); sel.addEventListener("change", show); return sel;
  }

  /* ---------- Original tab: optical molasses ---------- */
  function molasses(box) {
    const list = JSON.parse(box.dataset.species), L = JSON.parse(box.dataset.labels), q = n => box.querySelector(`[name=${n}]`);
    const cv = n => box.querySelector(`[data-cv=${n}]`), out = box.querySelector("[data-out]"), msg = box.querySelector(".g-msg");
    const sel = fillSpecies(box, list, L); let st = null, timer = 0, record = {};
    const params = () => { const s = list.find(x => x.id === sel.value), gamma = TAU * s.gamma_MHz * 1e6; return { s, gamma, delta: +q("delta").value * gamma, s0: +q("s0").value, lambda: s.lambda_nm * 1e-9, massKg: massU(s) * U, eta: +q("eta").value }; };
    function reset() {
      const p = params(), th = P.molassesTheory(p), T0 = +q("t0").value * th.TDoppler, sig = Math.sqrt(P.KB * T0 / p.massKg), r = rng(+q("seed").value), n = +q("n").value;
      const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = sig * gauss(r);
      st = { v, x: Float64Array.from({ length: n }, () => r()), y: Float64Array.from({ length: n }, () => r()), r, t: 0, photons: 0, sig0: sig, hist: [[0, T0]], Ts: T0, reached: null, key: sel.value + q("eta").value };
      st.hist=[[0,temp()]];st.Ts=st.hist[0][1];msg.textContent = ""; draw();
    }
    const temp = () => { let a = 0, b = 0; const v = st.v; for (const x of v) { a += x; b += x * x; } a /= v.length; return params().massKg * Math.max(0,b-v.length*a*a) / Math.max(1,v.length-1) / P.KB; };
    function step() {
      const p = params(), th = P.molassesTheory(p), dt = Math.min(Math.abs(p.massKg / th.beta) / 40 || 1e-6, 60 / p.gamma, 1e-3), n = ZGCoolingView.isRecording(box)?Math.max(1,Math.min(240,Math.ceil(+q("duration").value/1e3/dt/360))):+q("speed").value;
      for (let i = 0; i < n && st.t < +q("duration").value/1e3; i++) { const h=Math.min(dt,+q("duration").value/1e3-st.t);st.photons += P.molassesStep(st.v, p, h, st.r); st.t += h; }
      const T = temp(); st.Ts = st.Ts * 0.85 + T * 0.15; st.hist.push([st.t, T]); if (st.hist.length > 4000) st.hist.splice(1, 1);
      for (let i = 0; i < st.v.length; i++) { st.x[i] += st.v[i] / st.sig0 * 0.004; if (st.x[i] < 0 || st.x[i] > 1) st.x[i] = (st.x[i] + 1) % 1; }
      if (!st.reached && st.Ts < 1.2 * th.TDoppler && st.hist.length > 20) { st.reached = st.t; const best = record[st.key]; if (!best || st.t < best) record[st.key] = st.t; msg.textContent = `✅ ${L.reached} ${tmUnit(st.t)} (${L.record}: ${tmUnit(record[st.key])})`; }
      draw(); if(st.t >= +q("duration").value/1e3) stop(false); if (timer) timer = requestAnimationFrame(step);
    }
    function draw() {
      const p = params(), th = P.molassesTheory(p), T = st.hist[st.hist.length - 1][1];
      /* cloud */
      { const { g, W, H } = crisp(cv("cloud")); g.fillStyle = "rgba(255,80,80,.10)"; g.fillRect(0, 0, W, H); g.fillStyle = ink(); g.font = "12px system-ui"; g.fillText("→ beam · schematic position; colour = speed", 8, 14); g.textAlign = "right"; g.fillText("beam ←", W - 8, 14);
        for (let i = 0; i < st.v.length; i++) { const u = Math.min(1, Math.abs(st.v[i]) / (2 * st.sig0)); g.fillStyle = `hsl(${220 - 220 * u},85%,${45 + 10 * u}%)`; g.beginPath(); g.arc(8 + st.x[i] * (W - 16), 22 + st.y[i] * (H - 30), 2.4, 0, TAU); g.fill(); } }
      /* histogram + force */
      { const { g, W, H } = crisp(cv("hist")), m = { l: 34, r: 10, t: 10, b: 30 }, vm = Math.max(1e-6, q("vview").value === "capture" ? 3*th.vCapture : q("vview").value === "current" ? 4*Math.sqrt(P.KB*Math.max(T,1e-20)/p.massKg) : 3*st.sig0), nb = 41, h = new Array(nb).fill(0);
        for (const x of st.v) { const k = Math.floor((x + vm) / (2 * vm) * nb); if (k >= 0 && k < nb) h[k]++; }
        const hm = Math.max(...h, 1), bw = (W - m.l - m.r) / nb; g.fillStyle = "rgba(71,140,255,.55)"; h.forEach((c, i) => { const y = (H - m.b - m.t) * c / hm; g.fillRect(m.l + i * bw + 1, H - m.b - y, bw - 2, y); });
        const F = v => P.HBAR * th.k * (P.laserScatter(p.s0, p.delta - th.k * v, p.gamma) - P.laserScatter(p.s0, p.delta + th.k * v, p.gamma));
        let fm = 0; for (let i = 0; i <= 200; i++) fm = Math.max(fm, Math.abs(F(-vm + 2 * vm * i / 200))); const y0 = (m.t + H - m.b) / 2;
        g.strokeStyle = "#e0457b"; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 200; i++) { const v = -vm + 2 * vm * i / 200, X = m.l + (W - m.l - m.r) * i / 200, Y = y0 - (H - m.t - m.b) / 2.2 * F(v) / (fm || 1); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke();
        g.setLineDash([4, 4]); g.strokeStyle = ink(); g.globalAlpha = .4; g.beginPath(); g.moveTo(m.l, y0); g.lineTo(W - m.r, y0); [-th.vCapture, th.vCapture].forEach(vc => { if (Math.abs(vc) < vm) { const X = m.l + (W - m.l - m.r) * (vc + vm) / (2 * vm); g.moveTo(X, m.t); g.lineTo(X, H - m.b); } }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        g.fillStyle="#23314a";g.font="11px system-ui";g.textAlign="left";g.fillText("Blue: counts · rose: normalised F(v)",m.l+3,12);[-vm,0,vm].forEach(v=>{g.textAlign="center";g.fillText(fmt(v,3),m.l+(W-m.l-m.r)*(v+vm)/(2*vm),H-m.b+13);});axes(g,W,H,m,"v (m/s) · dashed: capture limits","Counts / normalised force"); }
      temperaturePlot(cv("temp"),st.hist,th,L);
      const rows = [[L.t_now, tUnit(st.Ts)], [L.t_theory, tUnit(th.T)], [L.t_doppler, tUnit(th.TDoppler)], [L.t_recoil, tUnit(th.Trecoil)], [L.tau, isFinite(th.dampingTime) && th.dampingTime > 0 ? tmUnit(th.dampingTime) : "—"], [L.vcap, fmt(th.vCapture) + " m/s"], [L.photons, fmt(st.photons / st.v.length) + " / atom"], [L.time, tmUnit(st.t)]];
      out.replaceChildren(...rows.flatMap(([a, b]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = a; dd.textContent = b; return [dt, dd]; }));
      if (!st.reached) msg.textContent = p.delta > 0 ? "🔥 " + L.blue : th.Trecoil > th.TDoppler ? "⚠️ " + L.narrow : "";
    }
    function conditions(){const p=params();return{parameters:{species:sel.value,trap:'1D optical molasses',mass_u:p.massKg/U,lambda_nm:p.lambda*1e9,gamma_2pi_MHz:p.gamma/TAU/1e6,delta_over_gamma:p.delta/p.gamma,s0:p.s0,eta:p.eta,n:st.v.length,seed:+q('seed').value,initial_T_D:+q('t0').value,observation_ms:+q('duration').value},view:{velocity_range:q('vview').value},time_s:st.t};}
    const runBtn = box.querySelector("[data-act=run]");
    const stop = (stopVideo=true) => { cancelAnimationFrame(timer); timer = 0; runBtn.textContent = L.start;if(stopVideo)ZGCoolingView.stopRecording(box); };
    box.addEventListener("click", e => { const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "run") { if (timer) stop(); else { runBtn.textContent = L.pause; timer = requestAnimationFrame(step); } }
      if (a === "reset") { stop(); reset(); }
      if (a === "best") { q("delta").value = (-0.5 * Math.sqrt(1 + +q("s0").value)).toFixed(2); q("delta").dispatchEvent(new Event("input")); }
      if (a === "png") zgExport.png(ZGCoolingView.compose(["cloud","hist","temp"].map(cv),conditions()),`laser-molasses-${sel.value}`);
      if(a==='settings')zgExport.save(new Blob([JSON.stringify(conditions(),null,2)],{type:'application/json'}),'molasses-conditions.json');
      if(a==='video'){if(ZGCoolingView.isRecording(box)){ZGCoolingView.stopRecording(box);return;}if(st.t>=+q('duration').value/1e3){stop();reset();}ZGCoolingView.recordPanel(box,['cloud','hist','temp'].map(cv),'laser-molasses-'+sel.value,conditions,()=>{if(!timer){runBtn.textContent=L.pause;timer=requestAnimationFrame(step);}});}
      if (a === "csv") { const p = params(), th = P.molassesTheory(p); const head = `# species=${sel.value} lambda_nm=${p.lambda * 1e9} gamma_2pi_MHz=${p.gamma / TAU / 1e6} delta_over_gamma=${q("delta").value} s0=${p.s0} eta=${p.eta} T_theory_K=${th.T} T_Doppler_K=${th.TDoppler}\n`;
        download(`laser-molasses-${sel.value}.csv`, new Blob([head + "time_s,T_K\n" + st.hist.map(r => r.join(",")).join("\n") + "\n\n# final velocities (m/s)\nv\n" + Array.from(st.v).join("\n")], { type: "text/csv" })); }
    });
    sliders(box, { delta: v => v.toFixed(2) + " Γ", s0: v => v.toFixed(2), t0: v => v + " × T_D", n: v => v, speed: v => v + "×" }, n => { if (n === "speed") draw(); else { stop(); reset(); } });
    q("vview").addEventListener("change",draw); q("seed").addEventListener("change",()=>{stop();reset();});
    sel.addEventListener("change", () => { stop(); reset(); }); q("eta").addEventListener("change", () => { stop(); reset(); });
    new MutationObserver(()=>{if(box.closest("[hidden]"))stop();}).observe(box.parentElement,{attributes:true,attributeFilter:["hidden"]});document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});addEventListener("resize", () => st && draw()); reset();
  }

  /* ---------- Advanced tab: Penning-trap ion ---------- */
  function penning(box) {
    const all = JSON.parse(box.dataset.species), list = all.filter(s => s.ion && !(s.gamma_MHz < 1)), L = JSON.parse(box.dataset.labels), q = n => box.querySelector(`[name=${n}]`);
    const cv = n => box.querySelector(`[data-cv=${n}]`), out = box.querySelector("[data-out]"), msg = box.querySelector(".g-msg");
    const sel = fillSpecies(box, list, L); let res = null, simT = 0, anim = 0, phase = 0, last = 0, pitch=Math.PI/6;
    const params = () => { const s = list.find(x => x.id === sel.value), gamma = TAU * s.gamma_MHz * 1e6; return { s, ion: { q: s.q, ionMassU: massU(s) }, B: +(box.querySelector('[data-numeric="B"]')?.value??q("B").value), U0: +q("U0").value, d: +q("d").value * 1e-3, lambda: s.lambda_nm * 1e-9, gamma, delta: +q("delta").value * gamma, s0: +q("s0").value, w: +q("w").value * 1e-6, yb: +q("yb").value * 1e-6, theta: +q("theta").value * Math.PI / 180, eta: +q("eta").value }; };
    const amps = t => { const A = n => +(q(n)?._number?.value ?? q(n).value) * 1e-6; return [P.amplitudeAt(A("a0p"), res.gp, res.Dr, t), P.amplitudeAt(A("a0m"), res.gm, res.Dr, t), P.amplitudeAt(A("a0z"), res.gz, res.Dz, t)]; };
    function compute() { ZGCoolingView.stopRecording(box);res = P.penningLaser(params()); draw(); }
    function draw() {
      const p = params();
      if (!res.stable) { out.replaceChildren(); msg.textContent = "⚠️ unstable trap (ν_c² < 2ν_z²)"; ["win","orbit","axial","space","amp"].map(cv).forEach(c => crisp(c)); return; }
      /* Log frequency scale: F′/βr is compared directly with ω− and ω+. */
      { const {g,W,H}=crisp(cv("win")),br=res.beta*Math.cos(p.theta)**2,low=res.freq.nm,high=res.freq.np,nu=br>0?res.Fy/br/TAU:NaN;
        const l=Math.log10(low)-.45,h=Math.log10(high)+.45,X=v=>40+(W-80)*(Math.log10(Math.max(v,10**l))-l)/(h-l),inside=br>0&&nu>low&&nu<high;
        g.fillStyle="#dcfce7";g.fillRect(X(low),52,X(high)-X(low),30);g.strokeStyle="#16805c";g.strokeRect(X(low),52,X(high)-X(low),30);
        g.font="13px system-ui";g.fillStyle="#23314a";g.textAlign="left";g.fillText((br<=0?"βr ≤ 0 · "+L.notall:inside?(box.dataset.zh==="true"?"✓ 两个径向模均冷却":"✓ Both radial modes cool"):(box.dataset.zh==="true"?(nu<=low?"⚠ 磁控管加热":"⚠ 回旋模加热"):(nu<=low?"⚠ Magnetron heats":"⚠ Cyclotron heats"))),12,20);
        g.fillText("F′ / (2π βr) = "+(Number.isFinite(nu)?fmt(nu,5)+" Hz":"—")+" · "+(box.dataset.zh==="true"?"对数频率轴":"log frequency scale"),12,40);
        const at=Math.max(24,Math.min(W-24,Number.isFinite(nu)&&nu>0?X(nu):24));g.strokeStyle=inside?"#16805c":"#e11d48";g.fillStyle=g.strokeStyle;g.lineWidth=3;g.beginPath();g.moveTo(at,46);g.lineTo(at,86);g.stroke();g.beginPath();g.moveTo(at,52);g.lineTo(at-6,43);g.lineTo(at+6,43);g.closePath();g.fill();
        g.fillStyle="#23314a";g.textAlign="left";g.fillText("ν− = "+fmt(low,4)+" Hz",X(low),103);g.textAlign="right";g.fillText("ν+ = "+fmt(high/1e3,4)+" kHz",X(high),103);
        g.textAlign="left";g.fillText("γ− = "+fmt(res.gm,4)+" s⁻¹ · γ+ = "+fmt(res.gp,4)+" s⁻¹",12,124);g.fillText("γz = "+fmt(res.gz,4)+" s⁻¹ · "+(box.dataset.zh==="true"?"负值 = 冷却":"negative = cooling"),12,146);
      }
      /* amplitude log-log */
      { const { g, W, H } = crisp(cv("amp")), m = { l: 46, r: 12, t: 12, b: 34 }, t0 = 1e-6, t1 = +q("span").value/1e3, n = 160, cols = ["#e0457b", "#478cff", "#1a9e5c"], names = [L.cyc, L.mag, L.ax];
        const series = [0, 1, 2].map(j => Array.from({ length: n + 1 }, (_, i) => { const t = t0 * (t1 / t0) ** (i / n); return [t, amps(t)[j]]; }));
        const finite=series.flat().map(x=>x[1]).filter(x=>x>0&&isFinite(x)),lo=Math.max(-10,Math.floor(Math.log10(Math.min(1e-5,...finite)))),hi=Math.min(-1,Math.max(lo+1,Math.ceil(Math.log10(Math.max(1e-5,...finite))))), X = t => m.l + (W - m.l - m.r) * Math.log10(t / t0) / Math.log10(t1 / t0), Y = A => H - m.b - (H - m.t - m.b) * (Math.min(hi, Math.max(lo, Math.log10(Math.max(A, 1e-12)))) - lo) / (hi - lo);
        g.font = "10px system-ui"; g.fillStyle = ink(); g.globalAlpha = .55; g.textAlign = "right"; for (let e = lo; e <= hi; e++) { g.fillText(e === -6 ? "1 µm" : e === -3 ? "1 mm" : "1e" + e, m.l - 3, Y(10 ** e) + 3); } g.textAlign = "center"; [t0,Math.sqrt(t0*t1),t1].forEach(t => g.fillText(tmUnit(t), X(t), H - m.b + 12)); g.globalAlpha = 1;
        g.strokeStyle = "#e08a00"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(m.l, Y(1e-5)); g.lineTo(W - m.r, Y(1e-5)); if(t1>=.1){g.moveTo(X(0.1), m.t); g.lineTo(X(0.1), H - m.b);} g.stroke(); g.setLineDash([]);
        series.forEach((s, j) => { g.strokeStyle = cols[j]; g.lineWidth = 2; g.beginPath(); s.forEach(([t, A], i) => i ? g.lineTo(X(t), Y(A)) : g.moveTo(X(t), Y(A))); g.stroke(); g.fillStyle = cols[j]; g.textAlign = "left"; g.fillText(names[j], m.l + 6, m.t + 12 + 13 * j); });
        if (simT > 0) { g.strokeStyle = ink(); g.globalAlpha = .5; g.beginPath(); g.moveTo(X(Math.max(simT, t0)), m.t); g.lineTo(X(Math.max(simT, t0)), H - m.b); g.stroke(); g.globalAlpha = 1; }
        axes(g, W, H, m, L.time + " (log)", "amplitude (log)"); }
      drawOrbit();
      const f = res.freq, A100 = amps(0.1), rate = g => fmt(g) + " s⁻¹", eqs = x => isFinite(x) ? fmt(x * 1e6) + " µm" : L.lost;
      const state = res.Fy <= res.window[0] ? L.below : res.Fy >= res.window[1] ? L.above : L.inside;
      const rows = [["ν₊ / ν₋ / ν_z", `${fmt(f.np / 1e3, 6)} kHz / ${fmt(f.nm, 5)} Hz / ${fmt(f.nz / 1e3, 5)} kHz`], [L.rates, `${L.cyc} ${rate(res.gp)} · ${L.mag} ${rate(res.gm)} · ${L.ax} ${rate(res.gz)}`], [L.window, state], [L.eq, `${eqs(res.eqPlus)} / ${eqs(res.eqMinus)} / ${eqs(res.eqZ)}`], ["A(100 ms)", A100.map(a => fmt(a * 1e6) + " µm").join(" / ")], ["γ₊ + γ₋ = −β_r/2m", `${fmt(res.gp + res.gm)} = ${fmt(-res.beta * Math.cos(p.theta) ** 2 / (2 * res.m))} s⁻¹`]];
      out.replaceChildren(...rows.flatMap(([a, b]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = a; dd.textContent = b; return [dt, dd]; }));
      const goal = res.allCooled && A100.every(a => a < 1e-5);
      msg.textContent = (res.allCooled ? "✅ " + L.allcool : "⚠️ " + L.notall) + (goal ? " · 🏆 " + L.goal_p.replace(/^[^:：]*[:：]\s*/, "") : "");
    }
    function drawOrbit() {
      const p=params(),t=simT||0,[ap,am,az]=amps(t),rr=+q("radialRange").value*1e-6/+q("zoom").value,zr=+q("axialRange").value*1e-6/+q("zoom").value;
      const point=u=>{const[a,b,c]=amps(u),f=res.freq;return[a*Math.cos(TAU*f.np*u)+b*Math.cos(TAU*f.nm*u),-a*Math.sin(TAU*f.np*u)-b*Math.sin(TAU*f.nm*u),c*Math.cos(TAU*f.nz*u)];};const trail=Math.min(t,6/res.freq.np);
      for(const name of ["orbit","axial","space"]){const{g,W,H}=crisp(cv(name)),extent=Math.max(rr,zr)*1e6,map=ZGCoolingView.frame(g,W,H,{xmin:-(name==='space'?extent:name==='axial'?zr*1e6:rr*1e6),xmax:name==='space'?extent:name==='axial'?zr*1e6:rr*1e6,ymin:-(name==='space'?extent:rr*1e6),ymax:name==='space'?extent:rr*1e6,equal:true,xlabel:name==='space'?'projected horizontal (µm)':name==='axial'?'z (µm)':'x (µm)',ylabel:name==='space'?'projected vertical (µm)':name==='axial'?'x (µm)':'y (µm)',title:'t = '+tmUnit(t)+(name==='space'?' · x / y / z':name==='axial'?' · z–x':' · x–y')});
        const project=v=>name==='orbit'?[v[0]*1e6,v[1]*1e6]:name==='axial'?[v[2]*1e6,v[0]*1e6]:ZGCoolingView.project(v.map(x=>x*1e6),(+q('camera').value)*Math.PI/180,pitch),coords=v=>{const[x,y]=project(v);return[map.X(x),map.Y(y)];};
        g.save();g.beginPath();g.rect(map.l,map.t,map.w,map.h);g.clip();
        if(name==='orbit'){const y=map.Y(p.yb*1e6),waist=Math.abs(map.Y(p.w*1e6)-map.Y(0)),grad=g.createLinearGradient(0,y-waist,0,y+waist);grad.addColorStop(0,'#ffffff00');grad.addColorStop(.5,'#7c3aed33');grad.addColorStop(1,'#ffffff00');g.fillStyle=grad;g.fillRect(map.l,y-waist,map.w,2*waist);}
        if(name==='space')ZGCoolingView.cage(g,map,extent*.6,(+q('camera').value)*Math.PI/180,pitch);
        g.strokeStyle='#2563eb';g.lineWidth=1.8;g.beginPath();for(let i=0;i<=360;i++){const[x,y]=coords(point(t-trail+trail*i/360));if(Number.isFinite(x)&&Number.isFinite(y)){i?g.lineTo(x,y):g.moveTo(x,y);}}g.stroke();const[x,y]=coords(point(t));if(Number.isFinite(x)&&Number.isFinite(y)){g.fillStyle='#f59e0b';g.beginPath();g.arc(x,y,5,0,TAU);g.fill();}g.restore();
        if(name==='space'){for(const[k,color]of ['#b91c1c','#15803d','#1d4ed8'].entries()){const basis=[0,0,0];basis[k]=(k===2?zr:rr)*.8;const[x,y]=coords(basis);g.strokeStyle=color;g.fillStyle=color;g.lineWidth=2;g.beginPath();g.moveTo(map.X(0),map.Y(0));g.lineTo(x,y);g.stroke();g.textAlign='left';g.fillText(['x','y','z'][k],x+4,y-4);}}
        if(![ap,am,az].every(Number.isFinite)||ap+am>rr||az>zr){g.fillStyle='#b91c1c';g.textAlign='right';g.fillText(box.dataset.zh==='true'?'超出范围；适应当前轨道':'Outside range; Fit current orbit',W-12,32);}
      }
    }
    function conditions(){const p=params();return{parameters:{species:sel.value,trap:'analytic Penning envelopes',B_T:p.B,U0_V:p.U0,d_m:p.d,lambda_nm:p.lambda*1e9,gamma_2pi_MHz:p.gamma/TAU/1e6,delta_over_gamma:p.delta/p.gamma,s0:p.s0,waist_m:p.w,offset_m:p.yb,theta_rad:p.theta,eta:p.eta,initial_amplitudes_um:{r_plus:+q('a0p').value,r_minus:+q('a0m').value,z:+q('a0z').value},observation_ms:+q('span').value},view:{yaw_deg:+q('camera').value,pitch_rad:pitch,radial_half_um:+q('radialRange').value,axial_half_um:+q('axialRange').value,zoom:+q('zoom').value},time_s:simT};}
    const runBtn = box.querySelector("[data-act=run]");
    function frame(ts) { const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; phase += dt * 2.2; simT = Math.max(simT, 1e-6) * 10 ** (dt * 0.8); if (simT >= +q("span").value/1e3) { simT = +q("span").value/1e3; anim = 0; runBtn.textContent = L.run; draw(); return; } draw(); anim = requestAnimationFrame(frame); }
    box.addEventListener("click", e => { const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "run") { if (anim) { cancelAnimationFrame(anim); anim = 0; runBtn.textContent = L.run; } else { simT = 1e-6; last = 0; runBtn.textContent = L.pause; anim = requestAnimationFrame(frame); } }
      if(a === "inspect"){ZGCoolingView.stopRecording(box);if(q("inspectTime").checkValidity()){cancelAnimationFrame(anim);anim=0;simT=+q("inspectTime").value/1e3;phase=2.2;draw();}}
      if(a === "fit"){const a=amps(simT);if(a.every(Number.isFinite)){q("radialRange").value=(+Math.max(.01,1.3*(a[0]+a[1])*1e6).toPrecision(5));q("axialRange").value=(+Math.max(.01,1.3*a[2]*1e6).toPrecision(5));q("zoom").value=1;}draw();}
      if(a === "reset"){ZGCoolingView.stopRecording(box);q("radialRange").value=60;q("axialRange").value=60;q("inspectTime").value=0;cancelAnimationFrame(anim);anim=0;simT=0;phase=0;q("zoom").value=1;draw();}
      if (a === "auto") { const p = params(); let best = null; for (let yb = -150; yb <= 150; yb += 0.5) { const r = P.penningLaser({ ...p, yb: yb * 1e-6 }); if (!r.stable) continue; const sc = Math.min(-r.gp, -r.gm, r.gz < 0 ? -r.gz : Infinity); if (!best || sc > best[1]) best = [yb, sc]; } if (best) { q("yb").value = best[0]; q("yb").dispatchEvent(new Event("input")); } }
      if (a === "png") zgExport.png(ZGCoolingView.compose(["win", "orbit", "axial", "space", "amp"].map(cv),conditions()),`laser-penning-${sel.value}`);
      if(a==='settings')zgExport.save(new Blob([JSON.stringify(conditions(),null,2)],{type:'application/json'}),'analytic-penning-conditions.json');
      if(a==='video'){ZGCoolingView.recordPanel(box,["win", "orbit", "axial", "space", "amp"].map(cv),'laser-penning-'+sel.value,conditions,()=>{if(!anim){simT=1e-6;last=0;runBtn.textContent=L.pause;anim=requestAnimationFrame(frame);}});}
      if (a === "csv") { const p = params(); const head = `# ion=${sel.value} B_T=${p.B} U0_V=${p.U0} d_m=${p.d} delta_over_gamma=${q("delta").value} s0=${p.s0} w_m=${p.w} yb_m=${p.yb} theta_rad=${p.theta} eta=${p.eta}\n# gamma_plus=${res.gp} gamma_minus=${res.gm} gamma_z=${res.gz} 1/s Fy=${res.Fy} N/m window=${res.window.join("..")}\n`;
        const rows = Array.from({ length: 121 }, (_, i) => { const t = 1e-6 * (+q("span").value/1e-3) ** (i / 120); return [t, ...amps(t)].join(","); }); download(`laser-penning-${sel.value}.csv`, new Blob([head + "t_s,r_plus_m,r_minus_m,z_m\n" + rows.join("\n")], { type: "text/csv" })); }
    });
    sliders(box, { B: v => v.toFixed(10) + " T", U0: v => v + " V", d: v => v.toFixed(2) + " mm", delta: v => v.toFixed(2) + " Γ", s0: v => v.toFixed(2), w: v => v + " µm", yb: v => v.toFixed(1) + " µm", theta: v => v.toFixed(1) + "°", a0p: v => v + " µm", a0m: v => v + " µm", a0z: v => v + " µm" }, () => {ZGCoolingView.stopRecording(box);cancelAnimationFrame(anim);anim=0;simT=0;compute();});
    ZGCoolingView.interact(cv("space"),{rotate:(dx,dy)=>{q("camera").value=(+q("camera").value+dx*.6+360)%360;pitch=Math.max(-1.5,Math.min(1.5,pitch+dy*.01));draw();},zoom:factor=>{q("zoom").value=Math.max(.1,Math.min(20,+q("zoom").value*factor));draw();}});
    q("camera").addEventListener("input",draw);for(const n of ["radialRange","axialRange"]){q(n).addEventListener("change",()=>{if(q(n).checkValidity())draw();});}q("inspectTime").addEventListener("change",()=>{if(!q("inspectTime").checkValidity())return;cancelAnimationFrame(anim);anim=0;simT=+q("inspectTime").value/1e3;phase=2.2;draw();});q("zoom").addEventListener("input",draw);q("span").addEventListener("change",draw);sel.addEventListener("change",()=>{ZGCoolingView.stopRecording(box);cancelAnimationFrame(anim);anim=0;simT=0;compute();}); q("eta").addEventListener("change", compute); new MutationObserver(()=>{if(box.closest("[hidden]")){ZGCoolingView.stopRecording(box);cancelAnimationFrame(anim);anim=0;}}).observe(box.parentElement,{attributes:true,attributeFilter:["hidden"]});document.addEventListener("visibilitychange",()=>{if(document.hidden){ZGCoolingView.stopRecording(box);cancelAnimationFrame(anim);anim=0;}});addEventListener("resize", () => res && draw()); compute();
  }

  document.querySelectorAll("[data-laser=molasses]").forEach(molasses);
  document.querySelectorAll("[data-laser=penning]").forEach(penning);
})();
