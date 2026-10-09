(() => {
  "use strict";
  const P = window.ZGPhysics, COL = ["#3e63dd", "#dc505b", "#16856b"], SUM = "#8e4ec6";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (x, n = 5) => x == null || !Number.isFinite(x) ? "—" : Number(x.toPrecision(n)).toLocaleString(undefined, { maximumFractionDigits: 10 });
  const density = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
  function plot(canvas, series, options = {}) {
    const width = Math.max(180, options.renderWidth || canvas.clientWidth || 650), height = width < 500 ? 275 : 310, dpr = options.renderScale || Math.min(3, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.height = height + "px";
    const g = canvas.getContext("2d"); g.scale(dpr, dpr);
    if(options.background){g.fillStyle=options.background;g.fillRect(0,0,width,height);}
    const ink = options.ink || getComputedStyle(canvas).color || "#222", l = 76, r = width - 16, t = 20, b = height - 52;
    const points = series.flatMap(s => s.points).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    let xr = options.x || [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0]))];
    let yr = options.y || [Math.min(0, ...points.map(p => p[1] - (p[2] || 0))), Math.max(0, ...points.map(p => p[1] + (p[2] || 0))) * 1.08];
    if (!(xr[1] > xr[0])) xr = [xr[0] - 1, xr[0] + 1]; if (!(yr[1] > yr[0])) yr = [yr[0] - 1, yr[0] + 1];
    const X = v => l + (v - xr[0]) / (xr[1] - xr[0]) * (r - l), Y = v => b - (v - yr[0]) / (yr[1] - yr[0]) * (b - t);
    g.font = "11px system-ui"; g.fillStyle = ink; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / 4, y = yr[0] + (yr[1] - yr[0]) * i / 4;
      g.strokeStyle = "rgba(127,127,160,.18)"; g.beginPath(); g.moveTo(X(x), t); g.lineTo(X(x), b); g.moveTo(l, Y(y)); g.lineTo(r, Y(y)); g.stroke();
      g.textAlign = "center"; g.fillText(fmt(x, 3), X(x), b + 17); g.textAlign = "right"; g.fillText(fmt(y, 3), l - 6, Y(y) + 4);
    }
    g.strokeStyle = "rgba(127,127,160,.6)"; g.strokeRect(l, t, r - l, b - t);
    g.save(); g.beginPath(); g.rect(l, t, r - l, b - t); g.clip();
    for (const s of series) {
      g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.width || 1.8; g.setLineDash(s.dash || []); g.beginPath();
      s.points.forEach((p, i) => {
        if (s.dots) { if (p[2] > 0) { g.moveTo(X(p[0]), Y(p[1] - p[2])); g.lineTo(X(p[0]), Y(p[1] + p[2])); } g.moveTo(X(p[0]) + 2.7, Y(p[1])); g.arc(X(p[0]), Y(p[1]), 2.7, 0, 2 * Math.PI); }
        else if (s.bars) { const bw = (r - l) / s.points.length; g.fillRect(X(p[0]) - bw / 2, Y(p[1]), Math.max(1, bw - .3), Y(0) - Y(p[1])); }
        else i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]));
      }); g.stroke();
    }
    for (const [i, x] of (options.markers || []).entries()) { g.strokeStyle = COL[i]; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(x), t); g.lineTo(X(x), b); g.stroke(); }
    g.restore(); g.setLineDash([]); g.fillStyle = ink; g.textAlign = "center"; g.font = "12px system-ui"; g.fillText(options.xlabel || "", (l + r) / 2, height - 12);
    g.save(); g.translate(14, (t + b) / 2); g.rotate(-Math.PI / 2); g.fillText(options.ylabel || "", 0, 0); g.restore();
    canvas._series = series; canvas._options = options;
    canvas.setAttribute("aria-label", `${options.xlabel}; ${options.ylabel}. ${options.description || ""}`);
  }
  document.querySelectorAll("[data-workbench]").forEach(async root => {
    const kind = root.dataset.workbench, T = JSON.parse(root.dataset.labels), controls = root.querySelector(".wb-controls"), plots = root.querySelector(".wb-plots"), summary = root.querySelector(".wb-summary"), error = root.querySelector(".wb-error");
    const $ = name => controls.querySelector(`[name="${name}"]`), val = name => {
      const input = $(name), n = input.value === "" ? NaN : +input.value;
      if (!Number.isFinite(n) || (input.step === "1" && !Number.isInteger(n)) || n < +input.min || (input.max !== "" && n > +input.max)) throw new Error(`${input.closest("label").textContent.trim()}: invalid value`);
      return n;
    };
    const field = (name, label, value, min = 0, max = 1e6, step = .01) => `<label>${esc(label)}<input name="${name}" type="number" value="${name === 'B' ? Number(value).toFixed(10) : step === 1 ? value : Number(value).toFixed(2)}" min="${min}" max="${max}" step="${name === 'B' ? 'any' : step}"${name === 'B' ? ' data-decimal-places="10"' : ''}></label>`;
    const select = (name, label, options, selected) => `<label>${esc(label)}<select name="${name}">${options.map(([v, s]) => `<option value="${v}"${String(v) === String(selected) ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>`;
    const check = (name, label, selected = true) => `<label class="wb-check"><input name="${name}" type="checkbox"${selected ? " checked" : ""}>${esc(label)}</label>`;
    const figure = (id, title) => `<figure class="wb-figure"><figcaption>${esc(title)}</figcaption><canvas data-plot="${id}"></canvas><div class="wb-legend" data-legend="${id}"></div><div class="wb-actions">${["png","csv","json"].map(format=>`<button class="zg-btn zg-btn-ghost" type="button" data-wb="figure-${format}" data-figure="${id}">${esc(format==="png"?T.png:format==="csv"?T.csv:T.save)}</button>`).join("")}</div></figure>`;
    let cat, ions = [], model = null, acquisition = null, fit = null, parameters = null, displayRows = [], origin = 0, view = "top", paused = matchMedia("(prefers-reduced-motion: reduce)").matches, play = 1, orbit = [], frame = null;
    try { cat = await P.load(root.dataset.catalogue, root.dataset.ame); } catch (e) { error.hidden = false; error.textContent = e.message; summary.textContent = e.message; return; }
    const ionRows = kind === "penning" ? 1 : 3;
    controls.innerHTML = (kind !== "penning" ? select("number", T.number, [[1, "1"], [2, "2"], [3, "3"]], 2) + select("preset", T.preset, [["isomer", T.isomers], ["overlap", T.overlapping], ["separate", T.separated], ["unequal", T.unequal], ["three", T.three], ["molecular", T.molecular]], kind === "mr" ? "isomer" : "overlap") : "") +
      `<div class="wb-species-list">${Array.from({ length: ionRows }, (_, i) => `<fieldset class="wb-ion" data-ion-row="${i}" style="--species-colour:${COL[i]}"><legend>${T.species} ${i + 1}</legend><label>${T.species}<input name="ion-${i}" type="text" value="${kind === "mr" ? i === 2 ? "133Cs" : "133Xe" : i === 1 ? "133Xe" : i === 2 ? "133Ba" : "133Cs"}" spellcheck="false"></label><label>${T.state}<select name="state-${i}"></select></label><div class="wb-pair">${field(`charge-${i}`, T.charge, 1, 1, 100, 1)}${kind !== "penning" ? field(`weight-${i}`, T.population, kind === "mr" ? i === 0 ? 70 : 30 : 50, 0, 1000) : ""}</div><small data-ion-info="${i}"></small></fieldset>`).join("")}</div>`;
    if (kind === "mr") {
      controls.insertAdjacentHTML("beforeend", field("laps", T.laps, 1000, 0, 100000, 1) + field("width", T.width, 20, .1, 10000) + field("broadening", T.broadening, 20, 0, 10000) + check("histogram", T.histogram) +
        `<details><summary>${T.advanced}</summary>${field("reference-time", T.reference_time, 10, .001)}${field("lap-time", T.lap_time, 8, .001)}${field("delay", T.delay, 0)}${field("counts", T.counts, 400, 2, 50000, 1)}${field("seed", T.seed, 20261007, 0, 4294967295, 1)}</details>` +
        `<details><summary>${T.calibration}</summary><label>${T.reference_ion}<input name="cal-ion" value="133Cs" type="text"></label>${field("cal-ref", T.reference_tof, 0)}${field("cal-time", T.observed_tof, 0)}${field("cal-sig", T.time_sigma, 1)}${field("cal-ref-sig", T.reference_sigma, 1)}${field("cal-delay-sig", T.delay_sigma, 0)}<button type="button" class="zg-btn" data-wb="calibrate">${T.calibrate}</button><p class="wb-cal-result" aria-live="polite"></p></details>`);
      plots.innerHTML = figure("spectrum", T.spectrum) + figure("power", T.power_plot) + figure("laps", T.laps_plot);
    } else if (kind === "tof") {
      controls.insertAdjacentHTML("beforeend", field("B", T.magnetic, 7, .01, 30) + field("T", T.excitation, 200, 1, 10000) + select("scheme", T.scheme, [["rect", T.rect], ["ramsey", T.ramsey]], "rect") + `<div class="wb-sequence"></div>` + select("target", T.target, [[0, "1"], [1, "2"], [2, "3"]], 0) +
        `<details><summary>${T.advanced}</summary>${field("points", T.points, 31, 5, 201, 1)}${field("ions-point", T.ions_point, 20, 2, 10000, 1)}${field("span", T.scan_span, 0, 0, 100000)}${field("seed", T.seed, 20261007, 0, 4294967295, 1)}${field("detuning", T.detuning, 0, -100000, 100000)}</details><button type="button" class="zg-btn" data-wb="generate">${T.generate}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="fit">${T.fit}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="clear-fit">${T.clear_fit}</button><p class="zg-muted">${T.seed_hint}</p>`);
      plots.innerHTML = figure("resonance", T.resonance) + figure("residuals", T.residuals) + figure("distribution", T.distribution);
    } else {
      controls.insertAdjacentHTML("beforeend", field("B", T.magnetic, 7, 0, 30, .01) + field("voltage", T.voltage, 100, -1000, 1000, .01) + field("d", T.geometry, 26.05, .1, 100, .01) +
        `<details><summary>${T.advanced}</summary>${field("x0", T.originx, 0, -20, 20, .01)}${field("y0", T.originy, 0, -20, 20, .01)}${field("z0", T.originz, 0, -20, 20, .01)}${field("rp", T.cyclotron_radius, .4, 0, 20, .01)}${field("rm", T.magnetron_radius, 1.2, 0, 20, .01)}${field("axial", T.axial, 1, 0, 20, .01)}${field("duration", T.duration, 50, .1, 10000)}${field("playback", T.playback, 1, .05, 10)}</details><div class="wb-actions"><button type="button" class="zg-btn zg-btn-ghost" data-wb="pause">${T.pause}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="reset">${T.reset}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="step">${T.step}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="video">${T.record}</button></div><p>${T.originhint}</p>`);
      plots.innerHTML = `<div class="wb-actions">${["top", "side", "3D"].map(v => `<button type="button" class="zg-btn zg-btn-ghost" data-wb="view" data-view="${v}">${v}</button>`).join("")}</div>` + figure("trajectory", T.penning_title);
    }
    if(kind==='penning') for(const n of ['B','voltage','d','x0','y0','z0','rp','rm','axial','duration','playback']){const number=$(n),range=document.createElement('input');range.type='range';range.min=number.min;range.max=number.max;range.step=number.step;range.value=number.value;range.className='wb-paired-range';range.setAttribute('aria-label',number.parentElement.childNodes[0].textContent);number.before(range);range.addEventListener('input',()=>{number.value=range.value;number.dispatchEvent(new Event('change',{bubbles:true}));});number.addEventListener('input',()=>{if(number.validity.valid){range.value=number.value;number.dispatchEvent(new Event('change',{bubbles:true}));}});}
    function syncStates(i, preserve = true, preferred = null) {
      const input = $(`ion-${i}`), state = $(`state-${i}`), previous = state.value;
      try {
        const resolved = cat.resolve(input.value, { q: val(`charge-${i}`) });
        if (resolved.atoms.length !== 1 || resolved.atoms[0].count !== 1) { state.innerHTML = `<option value="">${esc(T.molecular)}</option>`; state.disabled = true; return; }
        state.disabled = false; const atom = resolved.atoms[0], group = cat.groups.get(atom.state.element.toLowerCase() + atom.A);
        state.innerHTML = group.filter(s => s.existence !== "withdrawn").map(s => `<option value="${s.source_state_index}"${s.source_state_index && (!P.numeric(s.excitation.value) || s.excitation.qualifier) ? " disabled" : ""}>${esc(s.source_state_index ? `[${s.label}] ${fmt(s.excitation.value)}${s.excitation.value_extrapolated ? "#" : ""} keV · ${s.kind} · ${s.half_life.raw} ${s.half_life.unit}` : T.ground)}</option>`).join("");
        const selected = preferred ?? (preserve && [...state.options].some(o => o.value === previous && !o.disabled) ? previous : atom.state.source_state_index);
        state.value = String(selected);
      } catch (_) { state.innerHTML = `<option value="">—</option>`; state.disabled = true; }
    }
    function readIons() {
      const count = kind === "penning" ? 1 : val("number"), parsed = [];
      for (let i = 0; i < ionRows; i++) {
        controls.querySelector(`[data-ion-row="${i}"]`).hidden = i >= count; if (i >= count) continue;
        let text = $(`ion-${i}`).value;
        let q = val(`charge-${i}`), w = kind === "penning" ? 1 : val(`weight-${i}`), base = cat.resolve(text, { q, w }), state = $(`state-${i}`); q = base.q; w = base.w;
        if (!state.disabled && state.value !== "") text = `${base.atoms[0].A}${base.atoms[0].state.element}[${state.value}]`;
        const ion = cat.resolve(text, { q, w }); $(`charge-${i}`).value = ion.q; if($(`weight-${i}`)) $(`weight-${i}`).value=ion.w; parsed.push(ion);
        const a = ion.atoms[0], ex = a.state.excitation;
        controls.querySelector(`[data-ion-info="${i}"]`).textContent = `${ion.label}: ${fmt(ion.M, 11)} u; σ = ${ion.e == null ? T.unknown : fmt(ion.e) + (ion.uncertainty_extrapolated?"#":"") + " keV"}${ion.est ? " (#)" : ""}. ${ion.source}${a.state.source_state_index ? `; Eₓ = ${ex.raw} ± ${ex.raw_uncertainty || T.unknown} keV` : ""}`;
      }
      if (!parsed.some(i => i.w > 0)) throw new Error("At least one detected population must be positive.");
      return parsed;
    }
    function legend(id, labels, extra = true) {
      root.querySelector(`[data-legend="${id}"]`).innerHTML = labels.map((s, i) => `<span style="--species-colour:${COL[i]}">${esc(s)}</span>`).join("") + (extra ? `<span style="--species-colour:${SUM}">${T.combined}</span>` : "");
    }
    const canvas = id => plots.querySelector(`[data-plot="${id}"]`);
    function renderMR() {
      parameters = { laps: val("laps"), referenceUs: val("reference-time"), lapUs: val("lap-time"), widthNs: val("width"), broadeningNs: val("broadening") / 1000, delayUs: val("delay") };
      model = P.mrtof(ions, parameters); const n = val("counts"), random = P.rng(val("seed")), sp = model.species;
      const low = Math.min(...sp.map(i => i.time)) - model.origin - 3 * model.width, high = Math.max(...sp.map(i => i.time)) - model.origin + 3 * model.width, bins = 90, binWidth = (high - low) / bins;
      const xs = Array.from({ length: 401 }, (_, i) => low + (high - low) * i / 400), curves = sp.map((s, j) => ({ color: COL[j], points: xs.map(x => [x, n * s.w * binWidth * density(x, s.time - model.origin, s.sigma)]) }));
      curves.push({ color: SUM, width: 2.5, points: xs.map((x, i) => [x, curves.slice(0, sp.length).reduce((s, c) => s + c.points[i][1], 0)]) });
      if ($("histogram").checked) {
        const hist = new Array(bins).fill(0);
        for (let k = 0; k < n; k++) { let w = random(), j = 0; while (j < sp.length - 1 && (w -= sp[j].w) > 0) j++; const x = sp[j].time - model.origin + sp[j].sigma * P.gaussian(random), b = Math.floor((x - low) / binWidth); if (b >= 0 && b < bins) hist[b]++; }
        curves.unshift({ color: "rgba(127,127,160,.28)", bars: true, points: hist.map((v, i) => [low + (i + .5) * binWidth, v]) });
      }
      plot(canvas("spectrum"), curves, { xlabel: "TOF − t₁ (ns)", ylabel: T.counts_bin, x: [low, high], markers: sp.map(s => s.time - model.origin), description: `FWHM ${fmt(model.width)} ns; t₁ ${fmt(model.origin / 1000, 9)} µs` }); legend("spectrum", sp.map(s => s.label));
      const maxLap = Math.min(100000, Math.max(5000, parameters.laps * 1.3)), ns = Array.from({ length: 101 }, (_, i) => Math.round(maxLap * i / 100));
      const models = ns.map(laps => P.mrtof(ions, { ...parameters, laps }));
      const lapCurves = model.pairs.map((pair, j) => ({ color: COL[j], points: ns.map((n, k) => [n, Math.abs(models[k].pairs[j].dt)]) }));
      lapCurves.push({ color: SUM, dash: [5, 4], points: ns.map((n, k) => [n, models[k].width]) });
      plot(canvas("laps"), lapCurves, { xlabel: T.laps, ylabel: "Δt, FWHM (ns)" }); legend("laps", model.pairs.map(p => `${sp[p.i].label}–${sp[p.j].label}`), false);root.querySelector('[data-legend="laps"]').insertAdjacentHTML("beforeend",`<span style="--species-colour:${SUM}">FWHM</span>`);
      const powers=sp.map((ion,j)=>({color:COL[j],points:ns.map((n,k)=>[n,models[k].species[j].resolvingPower])}));
      model.pairs.forEach((pair,j)=>{const a=sp[pair.i].ionMassU/sp[pair.i].q,b=sp[pair.j].ionMassU/sp[pair.j].q,required=Math.abs(a-b)>0?(a+b)/2/Math.abs(a-b):null;if(required!=null)powers.push({label:T.power_required+": "+sp[pair.i].label+"–"+sp[pair.j].label,color:COL[j],dash:[6,4],points:[[0,required],[maxLap,required]]});});
      plot(canvas("power"),powers,{xlabel:T.laps,ylabel:"R",description:T.mr_note});legend("power",sp.map(ion=>ion.label),false);powers.filter(s=>s.dash).forEach(s=>root.querySelector('[data-legend="power"]').insertAdjacentHTML("beforeend",`<span style="--species-colour:${s.color}">${esc(s.label)}</span>`));
      root.querySelector('[data-legend="laps"]').insertAdjacentHTML("beforeend", `<span style="--species-colour:${SUM}">FWHM</span>`);
      summary.innerHTML = `<p>t₁ = <b>${fmt(model.origin / 1000, 10)} µs</b>; FWHM = <b>${fmt(model.width)} ns</b>; R₁ = ${fmt(sp[0].resolvingPower)}.</p>` + `<div class="wb-table-wrap"><table><thead><tr><th>${T.species}</th><th>t (µs)</th><th>FWHM (ns)</th><th>${T.population}</th></tr></thead><tbody>${sp.map(s=>`<tr><td>${esc(s.label)}</td><td>${fmt(s.time/1000,11)}</td><td>${fmt(s.fwhm)}</td><td>${fmt(100*s.w)}%</td></tr>`).join("")}</tbody></table></div>` + model.pairs.map(p => `<p>${p.i + 1}–${p.j + 1}: Δt = <b>${fmt(p.dt)} ns</b> (${fmt(p.widths, 3)} FWHM); ΔM = ${fmt(p.dmKeV, 8)} ± ${p.eKeV == null ? T.unknown : fmt(p.eKeV)} keV/c².</p>`).join("") + `<p>${T.survival}: ${sp.map(s => `${esc(s.label)} ${s.survival == null ? T.unknown : fmt(100 * s.survival, 4) + "%"}`).join("; ")}. ${T.mr_note}</p>`;
      try { const refIon = cat.resolve($("cal-ion").value), ref = P.mrtof([refIon], parameters).species[0];
      if (!$("cal-ref").dataset.edited) $("cal-ref").value = (ref.time / 1000).toFixed(8);
      if (!$("cal-time").dataset.edited) $("cal-time").value = (sp[0].time / 1000).toFixed(8);
      } catch (e) { controls.querySelector(".wb-cal-result").textContent = e.message; }
      displayRows = xs.map((x, i) => [x, ...curves.filter(c => !c.bars).map(c => c.points[i][1])]);
    }
    /* CAL1: calibrant-based field (and ν−/νz) when the calibration box is checked */
    const calEl = root.querySelector("[data-cal-panel]"), calOf = () => (window.ZGCal ? window.ZGCal.active(calEl) : null);
    /* fancier tab: double-trap summary for one ion (trap-1 cleaning νc, trap-2 frequencies, periods, TOFs) */
    function calibrationNote(ion) {
      const dt = calEl && calEl.zgCal ? calEl.zgCal.double() : null, c = calOf(); if (!dt || !c) return "";
      const f = P.doubleTrapFrequencies(ion, dt), t2 = f.trap2, p = f.periodsUs;
      return `<p>⚙ ${esc(c.list.map(x => x.label).join(", "))} · ${esc(c.mode)} · B = ${fmt(c.B, 10)} T</p><p>${esc(ion.label)}: ` +
        (f.trap1 ? `νc(T1) = ${fmt(f.trap1.nc, 10)} Hz; ` : "") + (t2 ? `νc(T2) = ${fmt(t2.nc, 10)}${t2.snc != null ? ` ± ${fmt(t2.snc, 3)}` : ""} Hz; ν+ = ${fmt(t2.np, 10)} Hz; ν− = ${fmt(t2.nm, 7)} Hz; νz = ${fmt(t2.nz, 8)} Hz; ` : "") +
        (p ? `T(axial/cyc/mag) = ${fmt(p.axial, 4)} / ${fmt(p.cyclotron, 4)} / ${fmt(p.magnetron, 4)} µs; ` : "") + (f.keVperHz != null ? `${fmt(f.keVperHz, 4)} keV/Hz; ` : "") +
        (f.tofRfqT1 != null ? `TOF RFQ→T1 ${fmt(f.tofRfqT1, 4)} µs; ` : "") + (f.tofT1T2 != null ? `TOF T1→T2 ${fmt(f.tofT1T2, 4)} µs` : "") + `</p>`;
    }
    function tofParameters() { const c = calOf(); return { B: c ? c.B : val("B"), T: val("T") / 1000, scheme: $("scheme").value, calibrated: !!c }; }
    function renderTOF() {
      parameters = tofParameters(); const target = Math.min(val("target"), ions.length - 1); $("target").value = target;
      [...$("target").options].forEach((o, i) => { o.hidden = i >= ions.length; o.textContent = ions[i]?.label || "—"; });
      origin = P.frequency(ions[target], parameters.B); const centres = ions.map(i => P.frequency(i, parameters.B) - origin);
      const span = val("span") || Math.max(4 / parameters.T, ...centres.map(c => Math.abs(c) + 3 / parameters.T));
      const xs = Array.from({ length: 401 }, (_, i) => -span + 2 * span * i / 400), curves = ions.map((ion, i) => ({ color: COL[i], points: xs.map(x => [x, P.tofMean(P.conversion(x + origin - P.frequency(ion, parameters.B), parameters.T, parameters.scheme))]) }));
      curves.push({ color: SUM, width: 2.5, points: xs.map(x => [x, P.mixture(ions, origin + x, parameters)]) });
      if (acquisition) curves.push({ color: getComputedStyle(root).color, dots: true, points: acquisition.scan.map(s => [s.f - origin, s.mean, s.se]) });
      if (fit?.predict) curves.push({ color: "#b67c00", dash: [6, 4], points: xs.map(x => [x, fit.predict(origin + x)]) });
      plot(canvas("resonance"), curves, { xlabel: `νRF − νc(${ions[target].label}) (Hz)`, ylabel: T.mean_tof, y: [145, 275], x: [-span, span], markers: centres }); legend("resonance", ions.map(i => i.label)); if(fit?.predict) root.querySelector('[data-legend="resonance"]').insertAdjacentHTML("beforeend",`<span style="--species-colour:#b67c00">${T.fit}</span>`);
      if (fit?.predict) plot(canvas("residuals"), [{ color: "#b67c00", dots: true, points: fit.residuals.map(r => [r.f - origin, r.residual, r.se]) }], { xlabel: `νRF − νc(${ions[target].label}) (Hz)`, ylabel: T.residual_tof, x: [-span, span], y: [-Math.max(5, ...fit.residuals.map(r => Math.abs(r.residual) + r.se)) * 1.1, Math.max(5, ...fit.residuals.map(r => Math.abs(r.residual) + r.se)) * 1.1] });
      else plot(canvas("residuals"), [], { xlabel: `νRF − νc(${ions[target].label}) (Hz)`, ylabel: T.residual_tof, x: [-span,span], y: [-5, 5], description: T.fit });
      const detuning = val("detuning"), W = ions.reduce((s, i) => s + i.w, 0), ts = Array.from({ length: 251 }, (_, i) => 130 + i * .6);
      const distributions = ions.map((ion, j) => { const mu = P.tof(P.conversion(origin + detuning - P.frequency(ion, parameters.B), parameters.T, parameters.scheme)); return { color: COL[j], points: ts.map(t => [t, ion.w / W * (.92 * density(t, mu, 7) + .08 * density(t, 255, 9))]) }; });
      distributions.push({ color: SUM, width: 2.5, points: ts.map((t, i) => [t, distributions.slice(0, ions.length).reduce((s, c) => s + c.points[i][1], 0)]) });
      plot(canvas("distribution"), distributions, { xlabel: T.event_tof, ylabel: T.probability_density }); legend("distribution", ions.map(i => i.label));
      controls.querySelector(".wb-sequence").innerHTML = parameters.scheme === "rect" ? `<span style="width:100%">RF ${fmt(parameters.T * 1000)} ms</span>` : `<span style="width:10%" title="RF ${fmt(parameters.T*100)} ms">RF</span><span class="wb-wait" style="width:80%">${fmt(parameters.T * 800)} ms</span><span style="width:10%" title="RF ${fmt(parameters.T*100)} ms">RF</span>`;
      const pairs = []; for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) pairs.push(`${i + 1}–${j + 1}: Δν = ${fmt(Math.abs(centres[i] - centres[j]))} Hz`);
      summary.innerHTML = (parameters.calibrated ? calibrationNote(ions[target]) : "") + `<p>νtarget = <b>${fmt(origin, 12)} Hz</b>. ${pairs.join("; ")}. 1/T = ${fmt(1 / parameters.T)} Hz (scale).</p>` + (fit?.predict ? `<p>Fit: <b>${esc(fit.status)}</b>; νfit = ${fmt(fit.center, 12)} Hz; <b>bias = ${fmt(fit.bias)} Hz</b>; χ²/dof = ${fmt(fit.reducedChi2)} (${fit.dof} dof).</p><p>Local Δχ² = 1 interval: ${fit.interval?.every(P.numeric) ? fit.interval.map(x => fmt(x, 12)).join("–") + " Hz" : T.unknown}. Baseline ${fmt(fit.baseline)} µs; depth ${fmt(fit.depth)} µs.</p>` : `<p>${fit ? "Fit: " + esc(fit.status) : T.generate + " → " + T.fit}.</p>`) + `<p>${T.tof_note}</p>`;
      model = { centresHz: centres.map(c => c + origin), span, target }; displayRows = xs.map((x, i) => [x + origin, ...curves.filter(c => !c.dots).map(c => c.points[i][1])]);
    }
    function renderPenning() {
      parameters = { B: val("B"), voltage: val("voltage"), d: val("d") / 1000, rp: val("rp"), rm: val("rm"), axial: val("axial"), duration: val("duration") * 1e-6, x0:val("x0"),y0:val("y0"),z0:val("z0") };
      { const c = calOf(); if (c) { parameters.B = c.B; parameters.calibrated = c.list.map(x => x.label).join(", ") + " · " + c.mode; } model = c ? P.calibratedPenning(ions[0], c) : P.penning(ions[0], parameters.B, parameters.voltage, parameters.d); }
      if (!model.stable) { orbit = []; displayRows = []; plot(canvas("trajectory"), [], { x: [-1, 1], y: [-1, 1], xlabel: "x (mm)", ylabel: "y (mm)" }); summary.innerHTML = `<p><b>${model.marginal ? "Marginal confinement" : "Unconfined / invalid ideal-trap parameters"}</b>. νc² − 2νz² must be positive and U₀ > 0 for confinement.</p>`; return; }
      const count = Math.max(200, Math.ceil(model.np * parameters.duration * 24)); if (count > 60000) throw new Error("Shorten the trajectory duration: at least 24 samples per cyclotron cycle are required.");
      orbit = Array.from({ length: count + 1 }, (_, i) => { const time = parameters.duration * i / count; return [time, parameters.x0 + parameters.rp * Math.cos(2 * Math.PI * model.np * time) + parameters.rm * Math.cos(2 * Math.PI * model.nm * time), parameters.y0 - parameters.rp * Math.sin(2 * Math.PI * model.np * time) - parameters.rm * Math.sin(2 * Math.PI * model.nm * time), parameters.z0 + parameters.axial * Math.cos(2 * Math.PI * model.nz * time)]; });
      summary.innerHTML = (parameters.calibrated ? calibrationNote(ions[0]) : "") + `<p>νc = <b>${fmt(model.nc, 10)} Hz</b>; ν+ = ${fmt(model.np, 10)} Hz; ν− = ${fmt(model.nm, 10)} Hz; νz = ${fmt(model.nz, 10)} Hz.</p><p>ν+ + ν− = νc; ν+² + ν−² + νz² = νc². t = ${fmt(parameters.duration * 1e6)} µs, ${count + 1} samples.</p><p>${T.penning_note}</p>`;
      displayRows = orbit; paintOrbit();
    }
    function paintOrbit() {
      if (!orbit.length) return; const cut = Math.max(2, Math.round(orbit.length * play)), slice = orbit.slice(0, cut), a = parameters;
      let pts, xlabel, ylabel, bound;
      if (view === "side") { pts = slice.map(p => [p[1], p[3]]); xlabel = "x (mm)"; ylabel = "z (mm)"; bound = Math.max(a.rp+a.rm+Math.abs(a.x0),a.axial+Math.abs(a.z0),.1)*1.15; }
      else if (view === "3D") { pts = slice.map(p => [(p[1] - p[2]) / Math.sqrt(2), p[3] * .8 + (p[1] + p[2]) / Math.sqrt(6)]); xlabel = "(x − y)/√2 (mm)"; ylabel = "projected coordinate (mm)"; bound = Math.max(.1,a.rp+a.rm+a.axial+Math.abs(a.x0)+Math.abs(a.y0)+Math.abs(a.z0))*1.1; }
      else { pts = slice.map(p => [p[1], p[2]]); xlabel = "x (mm)"; ylabel = "y (mm)"; bound = Math.max(.1,a.rp+a.rm+Math.max(Math.abs(a.x0),Math.abs(a.y0)))*1.15; }
      plot(canvas("trajectory"), [{ color: SUM, points: pts }, { color: COL[1], dots: true, points: [pts[pts.length - 1]] }], { x: [-bound, bound], y: [-bound, bound], xlabel, ylabel, description: `t=${fmt(slice[slice.length - 1][0] * 1e6)} µs; ${view}` });
    }
    function update(clear = true) {
      try { if (clear) { acquisition = null; fit = null; } ions = readIons(); if (kind === "mr") renderMR(); else if (kind === "tof") renderTOF(); else renderPenning(); error.hidden = true; root.querySelectorAll('.wb-actions button').forEach(b => b.disabled = false); }
      catch (e) { error.hidden = false; error.textContent = e.message; model = null; summary.textContent = e.message; root.querySelectorAll('.wb-actions button').forEach(b => b.disabled = true); }
    }
    function preset(name) {
      const settings = name === "three" ? [["133Cs", 0, 50], ["133Xe", 0, 30], ["133Ba", 0, 20]] : name === "isomer" ? [["133Xe", 0, 70], ["133Xe", 1, 30]] : name === "separate" ? [["133Cs", 0, 50], ["132Cs", 0, 50]] : name === "molecular" ? [["133Cs", 0, 50], ["12C11", 0, 50]] : [["133Cs", 0, name === "unequal" ? 90 : 50], ["133Xe", 0, name === "unequal" ? 10 : 50]];
      $("number").value = settings.length;
      settings.forEach(([ion, state, w], i) => { $(`ion-${i}`).value = ion; $(`weight-${i}`).value = w; $(`charge-${i}`).value = 1; syncStates(i, false, state); }); update();
    }
    controls.addEventListener("input", e => { if(kind === "mr" && e.target.type === "number" && e.target.name === "laps" && e.target.value !== "" && e.target.validity.valid) update(); });
    controls.addEventListener("change", e => {
      if (e.target.name === "preset") return preset(e.target.value);
      if (e.target.name === "number" && e.target.value === "3") { const s = kind === "mr" ? [["133Xe", 0, 60], ["133Xe", 1, 30], ["133Cs", 0, 10]] : [["133Cs", 0, 50], ["133Xe", 0, 30], ["133Ba", 0, 20]]; s.forEach(([ion, state, w], i) => { $(`ion-${i}`).value = ion; $(`weight-${i}`).value = w; syncStates(i, false, state); }); }
      if (/^ion-/.test(e.target.name)) syncStates(+e.target.name.split("-")[1], false);
      if (["cal-ref", "cal-time"].includes(e.target.name)) e.target.dataset.edited = "true";
      if (!e.target.name.startsWith("cal-")) update();
    });
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-wb]"); if (!b) return; const action = b.dataset.wb;
      try {
        if (action === "generate") { update(); if (!model) return; acquisition = P.acquire(ions, parameters, origin - model.span, origin + model.span, val("points"), val("ions-point"), val("seed")); fit = null; renderTOF(); }
        if (action === "clear-fit") { fit=null;renderTOF(); }
        if (action === "fit") { if (!acquisition) throw new Error(T.generate); fit = P.fitSingle(acquisition.scan, parameters, origin); renderTOF(); }
        if (action === "calibrate") { const ref = cat.resolve($("cal-ion").value), c = P.calibration(val("cal-time"), val("cal-ref"), ref, ions[0].q, val("delay"), val("cal-sig") / 1000, val("cal-ref-sig") / 1000, val("cal-delay-sig") / 1000); controls.querySelector(".wb-cal-result").textContent = `${fmt(c.atomicMassU, 12)} ± ${c.uncertaintyU == null ? T.unknown : fmt(c.uncertaintyU)} u. ${c.uncertainty_model}`; }
        if (action === "view") { view = b.dataset.view; paintOrbit(); }
        if (action === "pause") {paused=!paused;e.target.closest("button").setAttribute("aria-pressed",String(paused));}
        if (action === "reset") { play = 0; paintOrbit(); }
        if (action === "step") { paused = true; play = Math.min(1, play + .01); paintOrbit(); }
        if (action.startsWith("figure-")) {
          const id=b.dataset.figure,c=canvas(id),format=action.slice(7),legendRows=[...root.querySelector(`[data-legend="${id}"]`).children];
          const series=c._series.map((s,i)=>({...s,label:s.label||(s.bars?T.histogram:s.dots?(id==="residuals"?T.residuals:T.observations):legendRows.find(l=>l.style.getPropertyValue("--species-colour")===s.color)?.textContent)||String(i+1)}));
          if(format==="png")window.zgExport?.png(scale=>{const off=document.createElement("canvas");plot(off,c._series,{...c._options,renderWidth:c.clientWidth,renderScale:scale,ink:"#222",background:"#fff"});return off;},kind+"-"+id);
          if(format==="csv")window.zgExport?.csv(["series","x","y","sigma_y","x_axis","y_axis"],series.flatMap(s=>s.points.map(p=>[s.label,p[0],p[1],p[2]??"",c._options.xlabel,c._options.ylabel])),kind+"-"+id);
          if(format==="json"){const data={version:1,tool:kind,figure:id,caption:c.closest("figure").querySelector("figcaption").textContent,axes:c._options,series,parameters,controls:Object.fromEntries([...controls.querySelectorAll("[name]")].map(e=>[e.name,e.type==="checkbox"?e.checked:e.value])),ions,constants:P.C,source:cat.metadata,assumptions:[T.mass_note,T[`${kind}_note`]],seed:kind==="penning"?null:val("seed"),acquisition,fit:fit&&{...fit,predict:undefined}},a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.href=url;a.download=kind+"-"+id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
        }
        if (action === "png") { const c = plots.querySelector("canvas"); window.zgExport?.png(scale => { const off=document.createElement("canvas"); plot(off,c._series,{...c._options,renderWidth:c.clientWidth,renderScale:scale,ink:"#222",background:"#fff"}); return off; }, kind + "-comparison"); }
        if(action === "video"){const was=paused;play=0;paused=false;paintOrbit();window.zgExport?.record(canvas("trajectory"),6,"penning-advanced-"+view,r=>{e.target.closest("button").disabled=r;if(!r)paused=was;});}
        if (action === "csv") window.zgExport?.csv(kind === "penning" ? ["time_s", "x_mm", "y_mm", "z_mm"] : kind === "mr" ? ["tof_offset_ns", ...ions.map(i => i.label + "_counts_per_bin"), "total_counts_per_bin"] : ["frequency_Hz", ...ions.map(i => i.label + "_mean_tof_us"), "mixture_mean_tof_us", ...(fit?.predict ? ["single_species_fit_us"] : [])], displayRows, kind + "-comparison");
        if (action === "json") { const data = { version: 2, model: kind, constants: P.C, source: cat.metadata, parameters, units: kind === "mr" ? {referenceUs:"µs at mion/q=100 u/e",lapUs:"µs/lap at mion/q=100 u/e",delayUs:"µs",widthNs:"ns FWHM",broadeningNs:"ns/lap"} : kind === "tof" ? {B:"T",T:"s",frequency:"Hz",TOF:"µs"} : {B:"T",voltage:"V",d:"m",rp:"mm",rm:"mm",axial:"mm",duration:"s"}, controls: Object.fromEntries([...controls.querySelectorAll("[name]")].map(e=>[e.name,e.type==="checkbox"?e.checked:e.value])), ions, modelResult: model, acquisition, fit: fit && { ...fit, predict: undefined }, assumptions: [T.mass_note, T[`${kind}_note`]], seed: kind === "penning" ? null : val("seed") }; const a = document.createElement("a"), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.href = url; a.download = kind + "-inputs-results.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        error.hidden = true;
      } catch (err) { error.hidden = false; error.textContent = err.message; }
    });
    for (let i = 0; i < ionRows; i++) syncStates(i, false, kind === "mr" && i === 1 ? 1 : 0);
    if (calEl) calEl.addEventListener("zg-cal-change", () => update());
    update();
    if (kind === "tof" && model) { acquisition = P.acquire(ions, parameters, origin - model.span, origin + model.span); fit = P.fitSingle(acquisition.scan, parameters, origin); renderTOF(); }
    new ResizeObserver(() => { if (!model) return; if (kind === "mr") renderMR(); else if (kind === "tof") renderTOF(); else paintOrbit(); }).observe(plots);
    if (kind === "penning") { let last = 0; function animate(time) { if (!paused && model?.stable && root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight && time - last > 70) { play = (play + .015 * val("playback")) % 1; paintOrbit(); last = time; } frame = requestAnimationFrame(animate); } frame = requestAnimationFrame(animate); }
  });
})();
