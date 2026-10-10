/* Laser-cooling game — Games → Laser cooling.
   Original tab: 1D optical molasses, stochastic per-photon Poisson simulation (physics.js molassesStep) compared with the
   semiclassical theory (molassesTheory). Advanced tab: one ion in a Penning trap cooled by a radial, offset, tilted beam
   (penningLaser / amplitudeAt; Itano & Wineland PRA 25, 35 (1982); Hendricks et al. arXiv:0709.3817).
   Masses use m ≈ A·u − q·mₑ (better than 0.1 %; only the recoil scale depends on it). */
(() => {
  "use strict";
  const P = window.ZGPhysics; if (!P) return;
  const U = 1.66053906660e-27, ME = 5.48579909065e-4, TAU = 2 * Math.PI;
  const css = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
  const ink = () => css("--zg-ink", getComputedStyle(document.body).color || "#222");
  const fmt = (x, d = 3) => !isFinite(x) ? "∞" : Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(d - 1) : x.toPrecision(d);
  const tUnit = T => !isFinite(T) ? "∞" : T >= 1 ? fmt(T) + " K" : T >= 1e-3 ? fmt(T * 1e3) + " mK" : T >= 1e-6 ? fmt(T * 1e6) + " µK" : fmt(T * 1e9) + " nK";
  const tmUnit = t => t >= 1 ? fmt(t) + " s" : t >= 1e-3 ? fmt(t * 1e3) + " ms" : fmt(t * 1e6) + " µs";
  function massU(s) { const A = +String(s.nuclide).match(/^\d+/)[0]; return A - (s.q || 0) * ME; }
  function crisp(cv) { const r = devicePixelRatio || 1, w = cv.width, h = cv.height; if (!cv.dataset.w) { cv.dataset.w = w; cv.dataset.h = h; } const W = +cv.dataset.w, H = +cv.dataset.h; if (cv.width !== W * r) { cv.width = W * r; cv.height = H * r; } const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H); return { g, W, H }; }
  function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function pngOf(cvs, name) {
    const W = Math.max(...cvs.map(c => c.width)), H = cvs.reduce((s, c) => s + c.height, 0), out = document.createElement("canvas"); out.width = W; out.height = H;
    const g = out.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); let y = 0; cvs.forEach(c => { g.drawImage(c, 0, y); y += c.height; });
    out.toBlob(b => b && download(name, b), "image/png");
  }
  function axes(g, W, H, m, xl, yl) { g.strokeStyle = ink(); g.globalAlpha = .6; g.lineWidth = 1; g.beginPath(); g.moveTo(m.l, m.t); g.lineTo(m.l, H - m.b); g.lineTo(W - m.r, H - m.b); g.stroke(); g.globalAlpha = 1; g.fillStyle = ink(); g.font = "11px system-ui,sans-serif"; g.textAlign = "center"; g.fillText(xl, (m.l + W - m.r) / 2, H - 4); g.save(); g.translate(11, (m.t + H - m.b) / 2); g.rotate(-Math.PI / 2); g.fillText(yl, 0, 0); g.restore(); }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
  function sliders(box, fmts, onInput) {
    box.querySelectorAll(".g-slider input[type=range]").forEach(inp => { const o = box.querySelector(`output[data-o="${inp.name}"]`), show = () => { if (o) o.textContent = fmts[inp.name] ? fmts[inp.name](+inp.value) : inp.value; }; show(); inp.addEventListener("input", () => { show(); onInput(inp.name); }); });
  }
  function fillSpecies(box, list, L) {
    const sel = box.querySelector("select[name=species]"); list.forEach(s => sel.add(new Option(s.label, s.id)));
    const src = box.querySelector(".g-laser-src"); const show = () => { const s = list.find(x => x.id === sel.value); src.innerHTML = ""; const a = document.createElement("a"); a.href = s.src; a.textContent = L.source; src.append(`Γ/2π = ${s.gamma_MHz} MHz · λ = ${s.lambda_nm} nm · ${L.repump}: ${s.repump} · `, a); src.title = s.note; }; show(); sel.addEventListener("change", show); return sel;
  }

  /* ---------- Original tab: optical molasses ---------- */
  function molasses(box) {
    const list = JSON.parse(box.dataset.species), L = JSON.parse(box.dataset.labels), q = n => box.querySelector(`[name=${n}]`);
    const cv = n => box.querySelector(`[data-cv=${n}]`), out = box.querySelector("[data-out]"), msg = box.querySelector(".g-msg");
    const sel = fillSpecies(box, list, L); let st = null, timer = 0, record = {};
    const params = () => { const s = list.find(x => x.id === sel.value), gamma = TAU * s.gamma_MHz * 1e6; return { s, gamma, delta: +q("delta").value * gamma, s0: +q("s0").value, lambda: s.lambda_nm * 1e-9, massKg: massU(s) * U, eta: +q("eta").value }; };
    function reset() {
      const p = params(), th = P.molassesTheory(p), T0 = +q("t0").value * th.TDoppler, sig = Math.sqrt(P.KB * T0 / p.massKg), r = rng(20261010), n = +q("n").value;
      const v = new Float64Array(n); for (let i = 0; i < n; i++) v[i] = sig * gauss(r);
      st = { v, x: Float64Array.from({ length: n }, () => r()), y: Float64Array.from({ length: n }, () => r()), r, t: 0, photons: 0, sig0: sig, hist: [[0, T0]], Ts: T0, reached: null, key: sel.value + q("eta").value };
      msg.textContent = ""; draw();
    }
    const temp = () => { let a = 0, b = 0; const v = st.v; for (const x of v) { a += x; b += x * x; } a /= v.length; return params().massKg * (b / v.length - a * a) / P.KB; };
    function step() {
      const p = params(), th = P.molassesTheory(p), dt = Math.min(Math.abs(p.massKg / th.beta) / 40 || 1e-6, 60 / p.gamma, 1e-3), n = +q("speed").value;
      for (let i = 0; i < n; i++) { st.photons += P.molassesStep(st.v, p, dt, st.r); st.t += dt; }
      const T = temp(); st.Ts = st.Ts * 0.85 + T * 0.15; st.hist.push([st.t, T]); if (st.hist.length > 4000) st.hist.splice(1, 1);
      for (let i = 0; i < st.v.length; i++) { st.x[i] += st.v[i] / st.sig0 * 0.004; if (st.x[i] < 0 || st.x[i] > 1) st.x[i] = (st.x[i] + 1) % 1; }
      if (!st.reached && st.Ts < 1.2 * th.TDoppler && st.hist.length > 20) { st.reached = st.t; const best = record[st.key]; if (!best || st.t < best) record[st.key] = st.t; msg.textContent = `✅ ${L.reached} ${tmUnit(st.t)} (${L.record}: ${tmUnit(record[st.key])})`; }
      draw(); if (timer) timer = requestAnimationFrame(step);
    }
    function draw() {
      const p = params(), th = P.molassesTheory(p), T = st.hist[st.hist.length - 1][1];
      /* cloud */
      { const { g, W, H } = crisp(cv("cloud")); g.fillStyle = "rgba(255,80,80,.10)"; g.fillRect(0, 0, W, H); g.fillStyle = ink(); g.font = "12px system-ui"; g.fillText("→ beam", 8, 14); g.textAlign = "right"; g.fillText("beam ←", W - 8, 14);
        for (let i = 0; i < st.v.length; i++) { const u = Math.min(1, Math.abs(st.v[i]) / (2 * st.sig0)); g.fillStyle = `hsl(${220 - 220 * u},85%,${45 + 10 * u}%)`; g.beginPath(); g.arc(8 + st.x[i] * (W - 16), 22 + st.y[i] * (H - 30), 2.4, 0, TAU); g.fill(); } }
      /* histogram + force */
      { const { g, W, H } = crisp(cv("hist")), m = { l: 34, r: 10, t: 10, b: 30 }, vm = 3 * st.sig0, nb = 41, h = new Array(nb).fill(0);
        for (const x of st.v) { const k = Math.floor((x + vm) / (2 * vm) * nb); if (k >= 0 && k < nb) h[k]++; }
        const hm = Math.max(...h, 1), bw = (W - m.l - m.r) / nb; g.fillStyle = "rgba(71,140,255,.55)"; h.forEach((c, i) => { const y = (H - m.b - m.t) * c / hm; g.fillRect(m.l + i * bw + 1, H - m.b - y, bw - 2, y); });
        const F = v => P.HBAR * th.k * (P.laserScatter(p.s0, p.delta - th.k * v, p.gamma) - P.laserScatter(p.s0, p.delta + th.k * v, p.gamma));
        let fm = 0; for (let i = 0; i <= 200; i++) fm = Math.max(fm, Math.abs(F(-vm + 2 * vm * i / 200))); const y0 = (m.t + H - m.b) / 2;
        g.strokeStyle = "#e0457b"; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 200; i++) { const v = -vm + 2 * vm * i / 200, X = m.l + (W - m.l - m.r) * i / 200, Y = y0 - (H - m.t - m.b) / 2.2 * F(v) / (fm || 1); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke();
        g.setLineDash([4, 4]); g.strokeStyle = ink(); g.globalAlpha = .4; g.beginPath(); g.moveTo(m.l, y0); g.lineTo(W - m.r, y0); [-th.vCapture, th.vCapture].forEach(vc => { if (Math.abs(vc) < vm) { const X = m.l + (W - m.l - m.r) * (vc + vm) / (2 * vm); g.moveTo(X, m.t); g.lineTo(X, H - m.b); } }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        axes(g, W, H, m, `v (m/s), ±${fmt(vm, 2)} · dashed: ±v_capture`, "N · F(v)"); }
      /* temperature vs time */
      { const { g, W, H } = crisp(cv("temp")), m = { l: 40, r: 10, t: 10, b: 30 }, pts = st.hist, tmax = Math.max(pts[pts.length - 1][0], 1e-9);
        const vals = pts.map(x => x[1]).concat([th.TDoppler, isFinite(th.T) ? th.T : th.TDoppler]), lo = Math.log10(Math.min(...vals, th.Trecoil) * 0.7), hi = Math.log10(Math.max(...vals) * 1.4);
        const X = t => m.l + (W - m.l - m.r) * t / tmax, Y = T => H - m.b - (H - m.t - m.b) * (Math.log10(Math.max(T, 1e-30)) - lo) / (hi - lo);
        const hl = (T, c, lab) => { if (!isFinite(T)) return; g.strokeStyle = c; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(m.l, Y(T)); g.lineTo(W - m.r, Y(T)); g.stroke(); g.setLineDash([]); g.fillStyle = c; g.font = "10px system-ui"; g.textAlign = "right"; g.fillText(lab, W - m.r - 2, Y(T) - 3); };
        hl(th.TDoppler, "#1a9e5c", L.t_doppler); hl(th.T, "#e08a00", L.t_theory); hl(th.Trecoil, "#8b6cff", L.t_recoil);
        g.strokeStyle = "#478cff"; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([t, T], i) => i ? g.lineTo(X(t), Y(T)) : g.moveTo(X(t), Y(T))); g.stroke();
        axes(g, W, H, m, `${L.time} (0 … ${tmUnit(tmax)})`, "T (log)"); }
      const rows = [[L.t_now, tUnit(st.Ts)], [L.t_theory, tUnit(th.T)], [L.t_doppler, tUnit(th.TDoppler)], [L.t_recoil, tUnit(th.Trecoil)], [L.tau, isFinite(th.dampingTime) && th.dampingTime > 0 ? tmUnit(th.dampingTime) : "—"], [L.vcap, fmt(th.vCapture) + " m/s"], [L.photons, fmt(st.photons / st.v.length) + " / atom"], [L.time, tmUnit(st.t)]];
      out.replaceChildren(...rows.flatMap(([a, b]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = a; dd.textContent = b; return [dt, dd]; }));
      if (!st.reached) msg.textContent = p.delta > 0 ? "🔥 " + L.blue : th.Trecoil > th.TDoppler ? "⚠️ " + L.narrow : "";
    }
    const runBtn = box.querySelector("[data-act=run]");
    const stop = () => { cancelAnimationFrame(timer); timer = 0; runBtn.textContent = L.start; };
    box.addEventListener("click", e => { const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "run") { if (timer) stop(); else { runBtn.textContent = L.pause; timer = requestAnimationFrame(step); } }
      if (a === "reset") { stop(); reset(); }
      if (a === "best") { q("delta").value = (-0.5 * Math.sqrt(1 + +q("s0").value)).toFixed(2); q("delta").dispatchEvent(new Event("input")); }
      if (a === "png") pngOf(["cloud", "hist", "temp"].map(cv), `laser-molasses-${sel.value}.png`);
      if (a === "csv") { const p = params(), th = P.molassesTheory(p); const head = `# species=${sel.value} lambda_nm=${p.lambda * 1e9} gamma_2pi_MHz=${p.gamma / TAU / 1e6} delta_over_gamma=${q("delta").value} s0=${p.s0} eta=${p.eta} T_theory_K=${th.T} T_Doppler_K=${th.TDoppler}\n`;
        download(`laser-molasses-${sel.value}.csv`, new Blob([head + "time_s,T_K\n" + st.hist.map(r => r.join(",")).join("\n") + "\n\n# final velocities (m/s)\nv\n" + Array.from(st.v).join("\n")], { type: "text/csv" })); }
    });
    sliders(box, { delta: v => v.toFixed(2) + " Γ", s0: v => v.toFixed(2), t0: v => v + " × T_D", n: v => v, speed: v => v + "×" }, n => { if (n === "n" || n === "t0") { stop(); reset(); } else draw(); });
    sel.addEventListener("change", () => { stop(); reset(); }); q("eta").addEventListener("change", () => { stop(); reset(); });
    addEventListener("resize", () => st && draw()); reset();
  }

  /* ---------- Advanced tab: Penning-trap ion ---------- */
  function penning(box) {
    const all = JSON.parse(box.dataset.species), list = all.filter(s => s.ion && !(s.gamma_MHz < 1)), L = JSON.parse(box.dataset.labels), q = n => box.querySelector(`[name=${n}]`);
    const cv = n => box.querySelector(`[data-cv=${n}]`), out = box.querySelector("[data-out]"), msg = box.querySelector(".g-msg");
    const sel = fillSpecies(box, list, L); let res = null, simT = 0, anim = 0, phase = 0, last = 0;
    const params = () => { const s = list.find(x => x.id === sel.value), gamma = TAU * s.gamma_MHz * 1e6; return { s, ion: { q: s.q, ionMassU: massU(s) }, B: +q("B").value, U0: +q("U0").value, d: +q("d").value * 1e-3, lambda: s.lambda_nm * 1e-9, gamma, delta: +q("delta").value * gamma, s0: +q("s0").value, w: +q("w").value * 1e-6, yb: +q("yb").value * 1e-6, theta: +q("theta").value * Math.PI / 180, eta: +q("eta").value }; };
    const amps = t => { const A0 = +q("a0").value * 1e-6; return [P.amplitudeAt(A0, res.gp, res.Dr, t), P.amplitudeAt(A0, res.gm, res.Dr, t), P.amplitudeAt(A0, res.gz, res.Dz, t)]; };
    function compute() { res = P.penningLaser(params()); draw(); }
    function draw() {
      const p = params();
      if (!res.stable) { out.replaceChildren(); msg.textContent = "⚠️ unstable trap (ν_c² < 2ν_z²)"; [cv("win"), cv("orbit"), cv("amp")].forEach(c => crisp(c)); return; }
      /* window bar */
      { const { g, W, H } = crisp(cv("win")), [a, b] = res.window, lo = Math.min(a, res.Fy, 0) - (b - a) * 0.3, hi = Math.max(b, res.Fy) + (b - a) * 0.3, X = v => 20 + (W - 40) * (v - lo) / (hi - lo);
        g.fillStyle = "rgba(26,158,92,.25)"; g.fillRect(X(a), 22, X(b) - X(a), 30); g.strokeStyle = ink(); g.strokeRect(X(a), 22, X(b) - X(a), 30);
        g.fillStyle = res.Fy > a && res.Fy < b ? "#1a9e5c" : "#e0457b"; g.beginPath(); g.moveTo(X(res.Fy), 18); g.lineTo(X(res.Fy) - 7, 6); g.lineTo(X(res.Fy) + 7, 6); g.fill(); g.fillRect(X(res.Fy) - 1.5, 18, 3, 38);
        g.fillStyle = ink(); g.font = "11px system-ui"; g.textAlign = "center"; g.fillText("β_r ω₋", X(a), 70); g.fillText("β_r ω₊", X(b), 70); g.fillText("F′ = " + fmt(res.Fy) + " N/m", X(res.Fy), 84); }
      /* amplitude log-log */
      { const { g, W, H } = crisp(cv("amp")), m = { l: 46, r: 12, t: 12, b: 34 }, t0 = 1e-6, t1 = 1, n = 160, cols = ["#e0457b", "#478cff", "#1a9e5c"], names = [L.cyc, L.mag, L.ax];
        const series = [0, 1, 2].map(j => Array.from({ length: n + 1 }, (_, i) => { const t = t0 * (t1 / t0) ** (i / n); return [t, amps(t)[j]]; }));
        const lo = -7, hi = -1.5, X = t => m.l + (W - m.l - m.r) * Math.log10(t / t0) / Math.log10(t1 / t0), Y = A => H - m.b - (H - m.t - m.b) * (Math.min(hi, Math.max(lo, Math.log10(Math.max(A, 1e-12)))) - lo) / (hi - lo);
        g.font = "10px system-ui"; g.fillStyle = ink(); g.globalAlpha = .55; g.textAlign = "right"; for (let e = -7; e <= -2; e++) { g.fillText(e === -6 ? "1 µm" : e === -3 ? "1 mm" : "1e" + e, m.l - 3, Y(10 ** e) + 3); } g.textAlign = "center"; [1e-6, 1e-4, 1e-2, 1].forEach(t => g.fillText(tmUnit(t), X(t), H - m.b + 12)); g.globalAlpha = 1;
        g.strokeStyle = "#e08a00"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(m.l, Y(1e-5)); g.lineTo(W - m.r, Y(1e-5)); g.moveTo(X(0.1), m.t); g.lineTo(X(0.1), H - m.b); g.stroke(); g.setLineDash([]);
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
      const p = params(), { g, W, H } = crisp(cv("orbit")), t = simT || 0, [ap, am] = amps(t), A0 = +q("a0").value * 1e-6, sc = Math.min(W, H) / 2 / (1.25 * Math.max(A0, p.w, Math.abs(p.yb) + p.w / 2)), cx = W / 2, cy = H / 2;
      const grd = g.createLinearGradient(0, cy - p.yb * sc - p.w * sc, 0, cy - p.yb * sc + p.w * sc); grd.addColorStop(0, "rgba(124,58,237,0)"); grd.addColorStop(.5, "rgba(124,58,237,.35)"); grd.addColorStop(1, "rgba(124,58,237,0)"); g.fillStyle = grd; g.fillRect(0, cy - p.yb * sc - p.w * sc, W, 2 * p.w * sc);
      g.fillStyle = ink(); g.font = "10px system-ui"; g.fillText("laser →  (y_b = " + q("yb").value + " µm)", 6, cy - p.yb * sc - 4);
      g.strokeStyle = ink(); g.globalAlpha = .25; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke(); g.globalAlpha = 1;
      g.strokeStyle = "#478cff"; g.setLineDash([3, 4]); g.beginPath(); g.arc(cx, cy, am * sc, 0, TAU); g.stroke(); g.setLineDash([]);
      g.strokeStyle = "#e0457b"; g.lineWidth = 1.4; g.beginPath(); for (let i = 0; i <= 600; i++) { const s = phase - 6 + 6 * i / 600, x = ap * Math.cos(14 * s) + am * Math.cos(s), y = ap * Math.sin(14 * s) + am * Math.sin(s); i ? g.lineTo(cx + x * sc, cy - y * sc) : g.moveTo(cx + x * sc, cy - y * sc); } g.stroke();
      const x = ap * Math.cos(14 * phase) + am * Math.cos(phase), y = ap * Math.sin(14 * phase) + am * Math.sin(phase); g.fillStyle = "#e08a00"; g.beginPath(); g.arc(cx + x * sc, cy - y * sc, 5, 0, TAU); g.fill();
      g.fillStyle = ink(); g.fillText(`t = ${tmUnit(t || 0)} · r₊ = ${fmt(ap * 1e6)} µm · r₋ = ${fmt(am * 1e6)} µm`, 6, H - 8);
    }
    const runBtn = box.querySelector("[data-act=run]");
    function frame(ts) { const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; phase += dt * 2.2; simT = Math.max(simT, 1e-6) * 10 ** (dt * 0.8); if (simT >= 1) { simT = 1; anim = 0; runBtn.textContent = L.run; draw(); return; } draw(); anim = requestAnimationFrame(frame); }
    box.addEventListener("click", e => { const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "run") { if (anim) { cancelAnimationFrame(anim); anim = 0; runBtn.textContent = L.run; } else { simT = 1e-6; last = 0; runBtn.textContent = L.pause; anim = requestAnimationFrame(frame); } }
      if (a === "auto") { const p = params(); let best = null; for (let yb = -150; yb <= 150; yb += 0.5) { const r = P.penningLaser({ ...p, yb: yb * 1e-6 }); if (!r.stable) continue; const sc = Math.min(-r.gp, -r.gm, r.gz < 0 ? -r.gz : Infinity); if (!best || sc > best[1]) best = [yb, sc]; } if (best) { q("yb").value = best[0]; q("yb").dispatchEvent(new Event("input")); } }
      if (a === "png") pngOf(["win", "orbit", "amp"].map(cv), `laser-penning-${sel.value}.png`);
      if (a === "csv") { const p = params(); const head = `# ion=${sel.value} B_T=${p.B} U0_V=${p.U0} d_m=${p.d} delta_over_gamma=${q("delta").value} s0=${p.s0} w_m=${p.w} yb_m=${p.yb} theta_rad=${p.theta} eta=${p.eta}\n# gamma_plus=${res.gp} gamma_minus=${res.gm} gamma_z=${res.gz} 1/s Fy=${res.Fy} N/m window=${res.window.join("..")}\n`;
        const rows = Array.from({ length: 121 }, (_, i) => { const t = 1e-6 * 1e6 ** (i / 120); return [t, ...amps(t)].join(","); }); download(`laser-penning-${sel.value}.csv`, new Blob([head + "t_s,r_plus_m,r_minus_m,z_m\n" + rows.join("\n")], { type: "text/csv" })); }
    });
    sliders(box, { B: v => v.toFixed(2) + " T", U0: v => v + " V", d: v => v.toFixed(2) + " mm", delta: v => v.toFixed(2) + " Γ", s0: v => v.toFixed(2), w: v => v + " µm", yb: v => v.toFixed(1) + " µm", theta: v => v.toFixed(1) + "°", a0: v => v + " µm" }, () => compute());
    sel.addEventListener("change", compute); q("eta").addEventListener("change", compute); addEventListener("resize", () => res && draw()); compute();
  }

  document.querySelectorAll("[data-laser=molasses]").forEach(molasses);
  document.querySelectorAll("[data-laser=penning]").forEach(penning);
})();
