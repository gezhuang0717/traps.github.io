(() => {
  "use strict";
  /* Measurement workbenches: MR-TOF, TOF-ICR and Penning. Plots are drawn by ZGWbPlot (static/js/wb-plot.js) from one scene description, so the
     figure on the page, the saved PNG / PDF / SVG and the CSV contain the same legend: every species, every isomer, the combined curve and the
     parameters. Up to ten species; neighbouring peaks (in flight-time or frequency order) are compared unless "every pair" is ticked. */
  const P = window.ZGPhysics, W = window.ZGWbPlot, U = window.ZGUI;
  if (!P || !W || !U) { console.error("workbenches.js needs physics.js, wb-plot.js and zg-ui.js"); return; }
  const MAXN = 10, SUM = "ink";
  const COL = ["#3e63dd", "#dc505b", "#16856b", "#e5a000", "#0e9fbd", "#d6409f", "#7a8a2a", "#a35c2f", "#5b6678", "#6f4bd8"];
  const BASE_STYLE = { titleSize: 15, axisSize: 12, tickSize: 11, legendSize: 11, markerDiameter: 6, lineWidth: 1, rasterWidth: 2160, filename: "" };
  const NOTE_ID = { spectrum: "mr-spectrum", power: "mr-power", laps: "mr-laps", resonance: "tof-resonance", residuals: "tof-residuals", distribution: "tof-distribution", trajectory: "penning-trajectory" };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (x, n = 5) => x == null || !Number.isFinite(x) ? "—" : Number(x.toPrecision(n)).toLocaleString(undefined, { maximumFractionDigits: 10 });
  const density = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
  const node = (tag, cls, text) => U.make(tag, cls, text);
  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sup = n => [...String(Math.abs(n))].map(c => SUP[c]).join("");
  const chargeText = q => q === 1 ? "⁺" : q > 1 ? sup(q) + "⁺" : q === -1 ? "⁻" : q < -1 ? sup(q) + "⁻" : "";
  const lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  function table(head, rows) {
    const wrap = node("div", "wb-table-wrap"), t = node("table"), th = node("thead"), tr = node("tr"), tb = node("tbody");
    head.forEach(h => tr.append(node("th", "", h))); th.append(tr);
    for (const r of rows) { const row = node("tr"); for (const c of r) { const td = node("td"); if (c && c.nodeType) td.append(c); else td.textContent = c == null ? "" : String(c); row.append(td); } tb.append(row); }
    t.append(th, tb); wrap.append(t); return wrap;
  }
  function swatch(color, text) { const s = node("span", "wb-sw"); s.style.setProperty("--species-colour", color === SUM ? "currentColor" : color); s.append(node("i"), document.createTextNode(text)); return s; }
  const download = (blob, name) => (window.zgExport?.save ? window.zgExport.save(blob, name) : (() => { const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })());

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
    const figure = (id, title) => `<figure class="wb-figure" data-fig="${id}"><figcaption>${esc(title)}</figcaption>
      <div class="zg-fig-tools">${[["zoom-in", "＋ " + T.zoom_in], ["zoom-out", "− " + T.zoom_out], ["reset-view", "↺ " + T.reset_view]].map(([a, t]) => `<button type="button" class="zg-btn zg-btn-ghost" data-wb="${a}" data-figure="${id}">${esc(t)}</button>`).join("")}</div>
      <div class="wb-canvas"><canvas data-plot="${id}" data-title="${esc(title)}" role="img" tabindex="0"></canvas><div class="wb-tip" hidden></div></div>
      <div class="wb-actions" aria-label="${esc(T.save_figure)}">${["png", "svg", "csv", "json"].map(f => `<button class="zg-btn zg-btn-ghost" type="button" data-wb="figure-${f}" data-figure="${id}" title="${esc(T.save_figure)}">${f.toUpperCase()}</button>`).join("")}</div>
      <div data-notes="${NOTE_ID[id] || ""}"></div></figure>`;
    let cat, ions = [], descs = [], names = [], labels = [], model = null, acquisition = null, fit = null, parameters = null, displayRows = [], origin = 0, view = "top", paused = matchMedia("(prefers-reduced-motion: reduce)").matches, play = 1, orbit = [], frame = null;
    const ui = { style: { ...BASE_STYLE }, legend: "bottom", explain: true };
    try { cat = await P.load(root.dataset.catalogue, root.dataset.ame); } catch (e) { error.hidden = false; error.textContent = e.message; summary.textContent = e.message; return; }
    const FS = window.ZGFigureStyle;   /* loaded by the chart / spectroscopy scripts of the same page; looked up after the data arrived */
    if (!FS) { error.hidden = false; error.textContent = "figure-style.js is not loaded on this page"; return; }
    const ionRows = kind === "penning" ? 1 : MAXN;
    const DEFAULT_ION = kind === "mr" ? ["133Xe", "133Xe", "133Cs", "132Xe", "134Xe", "131Xe", "135Xe", "130Xe", "136Xe", "129Xe"] : ["133Cs", "133Xe", "133Ba", "132Xe", "134Xe", "131Xe", "135Xe", "130Xe", "136Xe", "129Xe"];
    const defaultWeight = i => kind === "mr" ? (i === 0 ? 70 : i < 3 ? 30 : 10) : 50;
    controls.innerHTML = (kind !== "penning" ? select("number", T.number, Array.from({ length: MAXN }, (_, i) => [i + 1, String(i + 1)]), 2) + select("preset", T.preset, [["isomer", T.isomers], ["overlap", T.overlapping], ["separate", T.separated], ["unequal", T.unequal], ["three", T.three], ["many", T.many], ["molecular", T.molecular]], kind === "mr" ? "isomer" : "overlap") + check("allpairs", T.pairs_all, false) + `<p class="zg-muted zg-small">${esc(T.pairs_note)}</p>` : "") +
      `<div class="wb-species-list">${Array.from({ length: ionRows }, (_, i) => `<fieldset class="wb-ion" data-ion-row="${i}" style="--species-colour:${COL[i]}"><legend>${T.species} ${i + 1} <span data-ion-kind="${i}"></span></legend><label>${T.species}<input name="ion-${i}" type="text" value="${DEFAULT_ION[i]}" spellcheck="false"></label><label>${T.state}<select name="state-${i}"></select></label><div class="wb-pair">${field(`charge-${i}`, T.charge, 1, 1, 100, 1)}${kind !== "penning" ? field(`weight-${i}`, T.population, defaultWeight(i), 0, 1000) : ""}</div><small data-ion-info="${i}"></small></fieldset>`).join("")}</div>`;
    if (kind === "mr") {
      controls.insertAdjacentHTML("beforeend", field("laps", T.laps, 1000, 0, 100000, 1) + field("width", T.width, 20, .1, 10000) + field("broadening", T.broadening, 20, 0, 10000) + check("histogram", T.histogram) +
        `<details><summary>${T.advanced}</summary>${field("reference-time", T.reference_time, 10, .001)}${field("lap-time", T.lap_time, 8, .001)}${field("delay", T.delay, 0)}${field("counts", T.counts, 400, 2, 50000, 1)}${field("seed", T.seed, 20261007, 0, 4294967295, 1)}</details>` +
        `<details><summary>${T.calibration}</summary><label>${T.reference_ion}<input name="cal-ion" value="133Cs" type="text"></label>${field("cal-ref", T.reference_tof, 0)}${field("cal-time", T.observed_tof, 0)}${field("cal-sig", T.time_sigma, 1)}${field("cal-ref-sig", T.reference_sigma, 1)}${field("cal-delay-sig", T.delay_sigma, 0)}<button type="button" class="zg-btn" data-wb="calibrate">${T.calibrate}</button><p class="wb-cal-result" aria-live="polite"></p></details>`);
    } else if (kind === "tof") {
      controls.insertAdjacentHTML("beforeend", field("B", T.magnetic, 7, .01, 30) + field("T", T.excitation, 200, 1, 10000) + select("scheme", T.scheme, [["rect", T.rect], ["ramsey", T.ramsey]], "rect") + `<div class="wb-sequence"></div>` + select("target", T.target, Array.from({ length: MAXN }, (_, i) => [i, String(i + 1)]), 0) +
        `<details><summary>${T.advanced}</summary>${field("points", T.points, 31, 5, 201, 1)}${field("ions-point", T.ions_point, 20, 2, 10000, 1)}${field("span", T.scan_span, 0, 0, 100000)}${field("seed", T.seed, 20261007, 0, 4294967295, 1)}${field("detuning", T.detuning, 0, -100000, 100000)}</details><button type="button" class="zg-btn" data-wb="generate">${T.generate}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="fit">${T.fit}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="clear-fit">${T.clear_fit}</button><p class="zg-muted">${T.seed_hint}</p>`);
    } else {
      controls.insertAdjacentHTML("beforeend", field("B", T.magnetic, 7, 0, 30, .01) + field("voltage", T.voltage, 100, -1000, 1000, .01) + field("d", T.geometry, 26.05, .1, 100, .01) +
        `<details><summary>${T.advanced}</summary>${field("x0", T.originx, 0, -20, 20, .01)}${field("y0", T.originy, 0, -20, 20, .01)}${field("z0", T.originz, 0, -20, 20, .01)}${field("rp", T.cyclotron_radius, .4, 0, 20, .01)}${field("rm", T.magnetron_radius, 1.2, 0, 20, .01)}${field("axial", T.axial, 1, 0, 20, .01)}${field("duration", T.duration, 50, .1, 10000)}${field("playback", T.playback, 1, .05, 10)}</details><div class="wb-actions"><button type="button" class="zg-btn zg-btn-ghost" data-wb="pause">${T.pause}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="reset">${T.reset}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="step">${T.step}</button><button type="button" class="zg-btn zg-btn-ghost" data-wb="video">${T.record}</button></div><p>${T.originhint}</p>`);
    }
    /* figure bar: one set of display options for every figure of this workbench */
    const bar = node("div", "wb-figbar");
    bar.innerHTML = `<label>${esc(T.legend_position)}<select name="fig-legend">${[["bottom", T.legend_bottom], ["in", T.legend_inside], ["off", T.legend_off]].map(([v, s]) => `<option value="${v}">${esc(s)}</option>`).join("")}</select></label>${check("fig-explain", T.explain_fig, true)}<p class="zg-muted zg-small">${esc(T.view_hint)}</p><div data-wb-style></div>`;
    const figureHTML = kind === "mr" ? figure("spectrum", T.spectrum) + figure("power", T.power_plot) + figure("laps", T.laps_plot)
      : kind === "tof" ? figure("resonance", T.resonance) + figure("residuals", T.residuals) + figure("distribution", T.distribution)
        : `<div class="wb-actions">${["top", "side", "3D"].map(v => `<button type="button" class="zg-btn zg-btn-ghost" data-wb="view" data-view="${v}">${v}</button>`).join("")}</div>` + figure("trajectory", T.penning_title);
    plots.innerHTML = figureHTML;
    plots.prepend(bar);
    plots.querySelectorAll("[data-notes]").forEach(slot => { const block = slot.dataset.notes && U.notesBlock(slot.dataset.notes); if (block) slot.append(block); });
    const styleControls = FS.controls(bar.querySelector("[data-wb-style]"), { lang, prefix: "wb-" + kind, baseline: BASE_STYLE, onChange: v => { ui.style = v; redraw(); } });
    bar.querySelector('[name="fig-legend"]').addEventListener("change", e => { ui.legend = e.target.value; redraw(); });
    bar.querySelector('[name="fig-explain"]').addEventListener("change", e => { ui.explain = e.target.checked; });
    if (kind === 'penning') for (const n of ['B', 'voltage', 'd', 'x0', 'y0', 'z0', 'rp', 'rm', 'axial', 'duration', 'playback']) { const number = $(n), range = document.createElement('input'); range.type = 'range'; range.min = number.min; range.max = number.max; range.step = number.step; range.value = number.value; range.className = 'wb-paired-range'; range.setAttribute('aria-label', number.parentElement.childNodes[0].textContent); number.before(range); range.addEventListener('input', () => { number.value = range.value; number.dispatchEvent(new Event('change', { bubbles: true })); }); number.addEventListener('input', () => { if (number.validity.valid) { range.value = number.value; number.dispatchEvent(new Event('change', { bubbles: true })); } }); }
    const canvas = id => plots.querySelector(`[data-plot="${id}"]`);
    const handles = {};
    plots.querySelectorAll("canvas[data-plot]").forEach(c => { handles[c.dataset.plot] = W.attach(c, () => { if (c._series) W.plot(c, c._series, c._options); }, c.parentElement.querySelector(".wb-tip")); });
    /* draw one figure: title, caption (parameters) and style come from the page; the series carry their own labels */
    function draw(id, series, options) {
      const c = canvas(id); c._style = ui.style; c._legend = ui.legend;
      W.plot(c, series, { title: c.dataset.title, ...options });
    }
    const clearViews = () => plots.querySelectorAll("canvas[data-plot]").forEach(c => { c._view = null; });

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
    /* species versus isomer: nuclide, nuclear state and excitation energy are kept separately for legends, tables and CSV */
    function describe(ion) {
      const atom = ion.atoms.length === 1 && ion.atoms[0].count === 1 ? ion.atoms[0] : null, st = atom && atom.state;
      const isomer = !!(st && st.source_state_index), E = isomer && P.numeric(st.excitation.value) ? st.excitation.value : null;
      return { kind: atom ? (isomer ? "isomer" : "ground") : "molecule", nuclide: atom ? `${atom.A}${st.element}` : ion.label, state: isomer ? String(st.label) : atom ? "g" : "", excitation_keV: E, charge: ion.q };
    }
    /* 133Xe, 133Xem (isomer letter directly after the element), 133Xe⁺, 133Xem²⁺; molecules keep their formula */
    const ionText = (ion, d) => (d.kind === "molecule" ? ion.label.replace(/\s*\+\d+$/, "") : d.nuclide + d.state.replace(/^g$/, "")) + chargeText(ion.q);
    const tagText = d => d.kind === "isomer" ? `${T.isomer_tag}${d.excitation_keV != null ? ` E* ${fmt(d.excitation_keV, 6)} keV` : ""}` : d.kind === "ground" ? T.ground_tag : T.molecule_tag;
    const legendName = (ion, d) => `${ionText(ion, d)} · ${tagText(d)}`;
    const meta = j => ({ ...descs[j] });
    function readIons() {
      const count = kind === "penning" ? 1 : val("number"), parsed = [];
      for (let i = 0; i < ionRows; i++) {
        controls.querySelector(`[data-ion-row="${i}"]`).hidden = i >= count; if (i >= count) continue;
        let text = $(`ion-${i}`).value;
        let q = val(`charge-${i}`), w = kind === "penning" ? 1 : val(`weight-${i}`), base = cat.resolve(text, { q, w }), state = $(`state-${i}`); q = base.q; w = base.w;
        if (!state.disabled && state.value !== "") text = `${base.atoms[0].A}${base.atoms[0].state.element}[${state.value}]`;
        const ion = cat.resolve(text, { q, w }); $(`charge-${i}`).value = ion.q; if ($(`weight-${i}`)) $(`weight-${i}`).value = ion.w; parsed.push(ion);
        const a = ion.atoms[0], ex = a.state.excitation, d = describe(ion), badge = controls.querySelector(`[data-ion-kind="${i}"]`);
        badge.replaceChildren(U.badge(tagText(d), d.kind === "isomer" ? "warn" : d.kind === "ground" ? "ok" : "info"));
        controls.querySelector(`[data-ion-info="${i}"]`).textContent = `${ion.label}: ${fmt(ion.M, 11)} u; σ = ${ion.e == null ? T.unknown : fmt(ion.e) + (ion.uncertainty_extrapolated ? "#" : "") + " keV"}${ion.est ? " (#)" : ""}. ${ion.source}${a.state.source_state_index ? `; Eₓ = ${ex.raw} ± ${ex.raw_uncertainty || T.unknown} keV` : ""}`;
      }
      if (!parsed.some(i => i.w > 0)) throw new Error("At least one detected population must be positive.");
      descs = parsed.map(describe); labels = parsed.map((ion, i) => ionText(ion, descs[i])); names = parsed.map((ion, i) => legendName(ion, descs[i]));
      return parsed;
    }
    /* neighbouring pairs in the order of `key` (flight time or frequency); every pair when ticked */
    function chosenPairs(pairs, key) {
      if (!pairs.length) return [];
      if ($("allpairs")?.checked) return pairs.map((p, k) => ({ p, k, rank: k }));
      const order = key.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]), out = [];
      for (let r = 0; r + 1 < order.length; r++) { const i = Math.min(order[r], order[r + 1]), j = Math.max(order[r], order[r + 1]), k = pairs.findIndex(p => p.i === i && p.j === j); if (k >= 0) out.push({ p: pairs[k], k, rank: r }); }
      return out;
    }
    const pairName = (i, j) => `${labels[i]} – ${labels[j]}`;

    function renderMR() {
      parameters = { laps: val("laps"), referenceUs: val("reference-time"), lapUs: val("lap-time"), widthNs: val("width"), broadeningNs: val("broadening") / 1000, delayUs: val("delay") };
      model = P.mrtof(ions, parameters); const n = val("counts"), random = P.rng(val("seed")), sp = model.species;
      const low = Math.min(...sp.map(i => i.time)) - model.origin - 3 * model.width, high = Math.max(...sp.map(i => i.time)) - model.origin + 3 * model.width, bins = 90, binWidth = (high - low) / bins;
      const xs = Array.from({ length: 401 }, (_, i) => low + (high - low) * i / 400), curves = sp.map((s, j) => ({ label: names[j], color: COL[j], meta: meta(j), points: xs.map(x => [x, n * s.w * binWidth * density(x, s.time - model.origin, s.sigma)]) }));
      curves.push({ label: T.combined, color: SUM, width: 2.5, meta: { kind: "combined" }, points: xs.map((x, i) => [x, curves.slice(0, sp.length).reduce((s, c) => s + c.points[i][1], 0)]) });
      if ($("histogram").checked) {
        const hist = new Array(bins).fill(0);
        for (let k = 0; k < n; k++) { let w = random(), j = 0; while (j < sp.length - 1 && (w -= sp[j].w) > 0) j++; const x = sp[j].time - model.origin + sp[j].sigma * P.gaussian(random), b = Math.floor((x - low) / binWidth); if (b >= 0 && b < bins) hist[b]++; }
        curves.unshift({ label: T.hist_series, color: "rgba(127,127,160,.45)", bars: true, meta: { kind: "synthetic histogram" }, points: hist.map((v, i) => [low + (i + .5) * binWidth, v]) });
      }
      const caption = [`${T.laps} = ${parameters.laps} · FWHM₀ = ${fmt(parameters.widthNs)} ns · ${fmt(val("broadening"))} ps/lap · t₁ = ${fmt(model.origin / 1000, 9)} µs · FWHM = ${fmt(model.width)} ns`, `t(100 u, q = 1) = ${fmt(parameters.referenceUs)} µs · T_lap = ${fmt(parameters.lapUs)} µs · delay ${fmt(parameters.delayUs)} µs · N = ${n}, seed ${val("seed")}`];
      draw("spectrum", curves, { xlabel: "TOF − t₁ (ns)", ylabel: T.counts_bin, x: [low, high], markers: sp.map((s, j) => ({ x: s.time - model.origin, color: COL[j] })), description: `FWHM ${fmt(model.width)} ns; t₁ ${fmt(model.origin / 1000, 9)} µs`, caption });
      const maxLap = Math.min(100000, Math.max(5000, parameters.laps * 1.3)), ns = Array.from({ length: 101 }, (_, i) => Math.round(maxLap * i / 100));
      const models = ns.map(laps => P.mrtof(ions, { ...parameters, laps })), shown = chosenPairs(model.pairs, sp.map(s => s.time));
      const lapCurves = shown.map(({ p, k, rank }) => ({ label: pairName(p.i, p.j), color: COL[rank % COL.length], meta: { kind: "pair", species: [names[p.i], names[p.j]] }, points: ns.map((nn, m) => [nn, Math.abs(models[m].pairs[k].dt)]) }));
      lapCurves.push({ label: "FWHM", color: SUM, dash: [5, 4], meta: { kind: "FWHM" }, points: ns.map((nn, m) => [nn, models[m].width]) });
      draw("laps", lapCurves, { xlabel: T.laps, ylabel: "Δt, FWHM (ns)", caption: [`${T.laps} ≤ ${maxLap} · FWHM₀ = ${fmt(parameters.widthNs)} ns · ${fmt(val("broadening"))} ps`] });
      const powers = sp.map((ion, j) => ({ label: names[j], color: COL[j], meta: meta(j), points: ns.map((nn, m) => [nn, models[m].species[j].resolvingPower]) }));
      for (const { p, rank } of shown) { const a = sp[p.i].ionMassU / sp[p.i].q, b = sp[p.j].ionMassU / sp[p.j].q, required = Math.abs(a - b) > 0 ? (a + b) / 2 / Math.abs(a - b) : null; if (required != null) powers.push({ label: `${T.power_required}: ${pairName(p.i, p.j)}`, color: COL[rank % COL.length], dash: [6, 4], meta: { kind: "required resolving power", species: [names[p.i], names[p.j]] }, points: [[0, required], [maxLap, required]] }); }
      draw("power", powers, { xlabel: T.laps, ylabel: "R", description: T.mr_note, caption: [`R = t / (2·FWHM) · ${T.laps} ≤ ${maxLap}`] });
      /* summary: colour tiles, species table (species and isomer tag separate), neighbouring pairs, folded notes */
      const nodes = [U.group(T.spectrum, "info", [{ k: "t₁", v: fmt(model.origin / 1000, 10), u: "µs" }, { k: "FWHM", v: fmt(model.width), u: "ns" }, { k: "R₁", v: fmt(sp[0].resolvingPower) }, { k: T.species_total, v: String(sp.length) }])];
      nodes.push(table([T.species, "", "t (µs)", "FWHM (ns)", T.population, T.survival], sp.map((s, j) => [swatch(COL[j], labels[j]), U.badge(tagText(descs[j]), descs[j].kind === "isomer" ? "warn" : descs[j].kind === "ground" ? "ok" : "info"), fmt(s.time / 1000, 11), fmt(s.fwhm), fmt(100 * s.w) + " %", s.survival == null ? T.unknown : fmt(100 * s.survival, 4) + " %"])));
      if (shown.length) nodes.push(table([T.laps_plot, "Δt (ns)", "Δt / FWHM", "ΔM (keV/c²)"], shown.map(({ p, rank }) => [swatch(COL[rank % COL.length], pairName(p.i, p.j)), fmt(p.dt), fmt(p.widths, 3), `${fmt(p.dmKeV, 8)} ± ${p.eKeV == null ? T.unknown : fmt(p.eKeV)}`])));
      nodes.push(U.fold(T.advanced, node("p", "", T.mr_note)));
      summary.replaceChildren(...nodes);
      try {
        const refIon = cat.resolve($("cal-ion").value), ref = P.mrtof([refIon], parameters).species[0];
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
      [...$("target").options].forEach((o, i) => { o.hidden = i >= ions.length; o.textContent = ions[i] ? `${i + 1}: ${labels[i]}` : "—"; });
      origin = P.frequency(ions[target], parameters.B); const centres = ions.map(i => P.frequency(i, parameters.B) - origin);
      const span = val("span") || Math.max(4 / parameters.T, ...centres.map(c => Math.abs(c) + 3 / parameters.T));
      const xs = Array.from({ length: 401 }, (_, i) => -span + 2 * span * i / 400), curves = ions.map((ion, i) => ({ label: names[i], color: COL[i], meta: meta(i), points: xs.map(x => [x, P.tofMean(P.conversion(x + origin - P.frequency(ion, parameters.B), parameters.T, parameters.scheme))]) }));
      curves.push({ label: T.combined, color: SUM, width: 2.5, meta: { kind: "combined" }, points: xs.map(x => [x, P.mixture(ions, origin + x, parameters)]) });
      if (acquisition) curves.push({ label: T.observations, color: SUM, dots: true, meta: { kind: "synthetic observations" }, points: acquisition.scan.map(s => [s.f - origin, s.mean, s.se]) });
      if (fit?.predict) curves.push({ label: T.fit, color: "#b67c00", dash: [6, 4], meta: { kind: "single-species fit" }, points: xs.map(x => [x, fit.predict(origin + x)]) });
      const xlabel = `νRF − νc(${labels[target]}) (Hz)`, caption = [`B = ${fmt(parameters.B, 10)} T · T = ${fmt(parameters.T * 1000)} ms · ${parameters.scheme === "rect" ? T.rect : T.ramsey}`, `ν_target = ${fmt(origin, 12)} Hz (${labels[target]}) · 1/T = ${fmt(1 / parameters.T)} Hz`];
      draw("resonance", curves, { xlabel, ylabel: T.mean_tof, y: [145, 275], x: [-span, span], markers: centres.map((x, i) => ({ x, color: COL[i] })), caption });
      if (fit?.predict) { const m = Math.max(5, ...fit.residuals.map(r => Math.abs(r.residual) + r.se)) * 1.1; draw("residuals", [{ label: T.residuals, color: "#b67c00", dots: true, meta: { kind: "fit residuals" }, points: fit.residuals.map(r => [r.f - origin, r.residual, r.se]) }], { xlabel, ylabel: T.residual_tof, x: [-span, span], y: [-m, m], caption: [`χ²/dof = ${fmt(fit.reducedChi2)} (${fit.dof} dof)`] }); }
      else draw("residuals", [], { xlabel, ylabel: T.residual_tof, x: [-span, span], y: [-5, 5], description: T.fit, caption: [T.generate + " → " + T.fit] });
      const detuning = val("detuning"), Wt = ions.reduce((s, i) => s + i.w, 0), ts = Array.from({ length: 251 }, (_, i) => 130 + i * .6);
      const distributions = ions.map((ion, j) => { const mu = P.tof(P.conversion(origin + detuning - P.frequency(ion, parameters.B), parameters.T, parameters.scheme)); return { label: names[j], color: COL[j], meta: meta(j), points: ts.map(t => [t, ion.w / Wt * (.92 * density(t, mu, 7) + .08 * density(t, 255, 9))]) }; });
      distributions.push({ label: T.combined, color: SUM, width: 2.5, meta: { kind: "combined" }, points: ts.map((t, i) => [t, distributions.slice(0, ions.length).reduce((s, c) => s + c.points[i][1], 0)]) });
      draw("distribution", distributions, { xlabel: T.event_tof, ylabel: T.probability_density, caption: [`νRF − ν_target = ${fmt(detuning)} Hz · ${parameters.scheme === "rect" ? T.rect : T.ramsey}`] });
      controls.querySelector(".wb-sequence").innerHTML = parameters.scheme === "rect" ? `<span style="width:100%">RF ${fmt(parameters.T * 1000)} ms</span>` : `<span style="width:10%" title="RF ${fmt(parameters.T * 100)} ms">RF</span><span class="wb-wait" style="width:80%">${fmt(parameters.T * 800)} ms</span><span style="width:10%" title="RF ${fmt(parameters.T * 100)} ms">RF</span>`;
      const every = []; for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) every.push({ i, j });
      const pairs = chosenPairs(every, centres);
      const nodes = [];
      if (parameters.calibrated) { const holder = node("div"); holder.innerHTML = calibrationNote(ions[target]); nodes.push(holder); }
      const tiles = [{ k: "ν_target", v: fmt(origin, 12), u: "Hz", note: labels[target] }, { k: "1/T", v: fmt(1 / parameters.T), u: "Hz", note: T.scheme + ": " + (parameters.scheme === "rect" ? T.rect : T.ramsey) }];
      if (fit?.predict) tiles.push({ k: T.fit, v: String(fit.status), tone: /ok|converged|success/i.test(String(fit.status)) ? "ok" : "warn" }, { k: "ν_fit", v: fmt(fit.center, 12), u: "Hz" }, { k: "bias", v: fmt(fit.bias), u: "Hz", tone: "warn", note: "ν_fit − ν_target" }, { k: "χ²/dof", v: fmt(fit.reducedChi2), note: `${fit.dof} dof` }, { k: "Δχ² = 1", v: fit.interval?.every(P.numeric) ? fit.interval.map(x => fmt(x, 12)).join(" – ") : T.unknown, u: "Hz" }, { k: "baseline", v: fmt(fit.baseline), u: "µs" }, { k: "depth", v: fmt(fit.depth), u: "µs" });
      nodes.push(U.group(T.resonance, "info", tiles));
      if (pairs.length) nodes.push(table([T.species, "Δν (Hz)"], pairs.map(({ p, rank }) => [swatch(COL[rank % COL.length], pairName(p.i, p.j)), fmt(Math.abs(centres[p.i] - centres[p.j]))])));
      nodes.push(U.fold(T.advanced, node("p", "", T.tof_note)));
      summary.replaceChildren(...nodes);
      model = { centresHz: centres.map(c => c + origin), span, target }; displayRows = xs.map((x, i) => [x + origin, ...curves.filter(c => !c.dots).map(c => c.points[i][1])]);
    }
    function renderPenning() {
      parameters = { B: val("B"), voltage: val("voltage"), d: val("d") / 1000, rp: val("rp"), rm: val("rm"), axial: val("axial"), duration: val("duration") * 1e-6, x0: val("x0"), y0: val("y0"), z0: val("z0") };
      { const c = calOf(); if (c) { parameters.B = c.B; parameters.calibrated = c.list.map(x => x.label).join(", ") + " · " + c.mode; } model = c ? P.calibratedPenning(ions[0], c) : P.penning(ions[0], parameters.B, parameters.voltage, parameters.d); }
      if (!model.stable) { orbit = []; displayRows = []; draw("trajectory", [], { x: [-1, 1], y: [-1, 1], xlabel: "x (mm)", ylabel: "y (mm)" }); summary.replaceChildren(U.group(model.marginal ? "Marginal confinement" : "Unconfined / invalid ideal-trap parameters", "bad", [], [node("p", "", "νc² − 2νz² > 0, U₀ > 0")])); return; }
      const count = Math.max(200, Math.ceil(model.np * parameters.duration * 24)); if (count > 60000) throw new Error("Shorten the trajectory duration: at least 24 samples per cyclotron cycle are required.");
      orbit = Array.from({ length: count + 1 }, (_, i) => { const time = parameters.duration * i / count; return [time, parameters.x0 + parameters.rp * Math.cos(2 * Math.PI * model.np * time) + parameters.rm * Math.cos(2 * Math.PI * model.nm * time), parameters.y0 - parameters.rp * Math.sin(2 * Math.PI * model.np * time) - parameters.rm * Math.sin(2 * Math.PI * model.nm * time), parameters.z0 + parameters.axial * Math.cos(2 * Math.PI * model.nz * time)]; });
      const nodes = []; if (parameters.calibrated) { const holder = node("div"); holder.innerHTML = calibrationNote(ions[0]); nodes.push(holder); }
      nodes.push(U.group(labels[0], "info", [{ k: "νc", v: fmt(model.nc, 10), u: "Hz", note: "ν+ + ν− = νc" }, { k: "ν+", v: fmt(model.np, 10), u: "Hz", note: T.cyclotron_radius }, { k: "ν−", v: fmt(model.nm, 10), u: "Hz", note: T.magnetron_radius }, { k: "νz", v: fmt(model.nz, 10), u: "Hz", note: T.axial }, { k: "t", v: fmt(parameters.duration * 1e6), u: "µs", note: `${count + 1} samples` }]));
      nodes.push(node("p", "zg-muted zg-small", "ν+² + ν−² + νz² = νc²"), U.fold(T.advanced, node("p", "", T.penning_note)));
      summary.replaceChildren(...nodes);
      displayRows = orbit; paintOrbit();
    }
    function paintOrbit() {
      if (!orbit.length) return; const cut = Math.max(2, Math.round(orbit.length * play)), slice = orbit.slice(0, cut), a = parameters;
      let pts, xlabel, ylabel, bound;
      if (view === "side") { pts = slice.map(p => [p[1], p[3]]); xlabel = "x (mm)"; ylabel = "z (mm)"; bound = Math.max(a.rp + a.rm + Math.abs(a.x0), a.axial + Math.abs(a.z0), .1) * 1.15; }
      else if (view === "3D") { pts = slice.map(p => [(p[1] - p[2]) / Math.sqrt(2), p[3] * .8 + (p[1] + p[2]) / Math.sqrt(6)]); xlabel = "(x − y)/√2 (mm)"; ylabel = "projected coordinate (mm)"; bound = Math.max(.1, a.rp + a.rm + a.axial + Math.abs(a.x0) + Math.abs(a.y0) + Math.abs(a.z0)) * 1.1; }
      else { pts = slice.map(p => [p[1], p[2]]); xlabel = "x (mm)"; ylabel = "y (mm)"; bound = Math.max(.1, a.rp + a.rm + Math.max(Math.abs(a.x0), Math.abs(a.y0))) * 1.15; }
      const caption = [`B = ${fmt(a.B, 10)} T · U₀ = ${fmt(a.voltage)} V · d = ${fmt(a.d * 1000)} mm · r₊ = ${fmt(a.rp)} mm, r₋ = ${fmt(a.rm)} mm, A_z = ${fmt(a.axial)} mm`, `νc = ${fmt(model.nc, 10)} Hz · ν₊ = ${fmt(model.np, 10)} Hz · ν₋ = ${fmt(model.nm, 10)} Hz · νz = ${fmt(model.nz, 10)} Hz`];
      draw("trajectory", [{ label: names[0] || labels[0], color: SUM, meta: { ...descs[0], kind: "trajectory" }, points: pts }, { label: "", noLegend: true, color: COL[1], dots: true, meta: { kind: "current position" }, points: [pts[pts.length - 1]] }], { x: [-bound, bound], y: [-bound, bound], xlabel, ylabel, description: `t=${fmt(slice[slice.length - 1][0] * 1e6)} µs; ${view}`, caption });
    }
    function redraw() { if (!model) return; if (kind === "mr") renderMR(); else if (kind === "tof") renderTOF(); else paintOrbit(); }
    function update(clear = true) {
      try { if (clear) { acquisition = null; fit = null; } clearViews(); ions = readIons(); if (kind === "mr") renderMR(); else if (kind === "tof") renderTOF(); else renderPenning(); error.hidden = true; root.querySelectorAll('.wb-actions button').forEach(b => b.disabled = false); }
      catch (e) { error.hidden = false; error.textContent = e.message; model = null; summary.textContent = e.message; root.querySelectorAll('.wb-actions button').forEach(b => b.disabled = true); }
    }
    function preset(name) {
      const xe = ["124", "126", "128", "129", "130", "131", "132", "133", "134", "136"].map(a => [a + "Xe", 0, 10]);
      const settings = name === "many" ? xe : name === "three" ? [["133Cs", 0, 50], ["133Xe", 0, 30], ["133Ba", 0, 20]] : name === "isomer" ? [["133Xe", 0, 70], ["133Xe", 1, 30]] : name === "separate" ? [["133Cs", 0, 50], ["132Cs", 0, 50]] : name === "molecular" ? [["133Cs", 0, 50], ["12C11", 0, 50]] : [["133Cs", 0, name === "unequal" ? 90 : 50], ["133Xe", 0, name === "unequal" ? 10 : 50]];
      $("number").value = settings.length;
      settings.forEach(([ion, state, w], i) => { $(`ion-${i}`).value = ion; $(`weight-${i}`).value = w; $(`charge-${i}`).value = 1; syncStates(i, false, state); }); update();
    }
    controls.addEventListener("input", e => { if (kind === "mr" && e.target.type === "number" && e.target.name === "laps" && e.target.value !== "" && e.target.validity.valid) update(); });
    controls.addEventListener("change", e => {
      if (e.target.name === "preset") return preset(e.target.value);
      if (e.target.name === "allpairs") return redraw();
      if (e.target.name === "number" && e.target.value === "3") { const s = kind === "mr" ? [["133Xe", 0, 60], ["133Xe", 1, 30], ["133Cs", 0, 10]] : [["133Cs", 0, 50], ["133Xe", 0, 30], ["133Ba", 0, 20]]; s.forEach(([ion, state, w], i) => { $(`ion-${i}`).value = ion; $(`weight-${i}`).value = w; syncStates(i, false, state); }); }
      if (/^ion-/.test(e.target.name)) syncStates(+e.target.name.split("-")[1], false);
      if (["cal-ref", "cal-time"].includes(e.target.name)) e.target.dataset.edited = "true";
      if (!e.target.name.startsWith("cal-")) update();
    });

    /* ---- saving: the saved figure is the scene on the page (current zoom), written as SVG, then rasterised for PNG / PDF ---- */
    function exportScene(c) {
      const sc = c._scene, id = c.dataset.plot, explain = ui.explain ? U.notesLines(NOTE_ID[id], 4).slice(1) : [];
      return W.scene(c._series, { ...c._options, width: 760, height: 300, style: ui.style, legend: ui.legend, ink: "#1d2433", background: "#fff", x: sc.xr, y: sc.yr, caption: [...(c._options.caption || []), ...explain], title: c.dataset.title });
    }
    const figureMetadata = (c) => ({ tool: kind, figure: c.dataset.plot, title: c.dataset.title, species: descs.map((d, i) => ({ legend: names[i], ...d })), parameters, view: { x: c._scene.xr, y: c._scene.yr }, legend: ui.legend, source: cat.metadata?.source || null });
    async function saveImage(c, type) {
      const svgText = W.toSVG(exportScene(c)), el = document.importNode(new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement, true);
      await FS.exportSVG(el, type, kind + "-" + c.dataset.plot, ui.style, figureMetadata(c));
    }
    function saveCSV(c) {
      const rows = c._series.flatMap(s => s.points.map(p => [c.dataset.title, s.label, s.meta?.kind ?? "", s.meta?.nuclide ?? "", s.meta?.state ?? "", s.meta?.excitation_keV ?? "", s.meta?.charge ?? "", p[0], p[1], p[2] ?? "", c._options.xlabel, c._options.ylabel]));
      window.zgExport?.csv(["figure", "series", "kind", "nuclide", "nuclear_state", "excitation_keV", "charge", "x", "y", "sigma_y", "x_axis", "y_axis"], rows, FS.exportName(ui.style, kind + "-" + c.dataset.plot));
    }
    function saveJSON(c, id) {
      const series = c._series.map(s => ({ ...s })), data = { version: 2, tool: kind, figure: id, caption: c.dataset.title, axes: c._options, view: { x: c._scene.xr, y: c._scene.yr }, legend: ui.legend, figure_style: ui.style, species: descs.map((d, i) => ({ legend: names[i], ...d })), series, parameters, controls: Object.fromEntries([...controls.querySelectorAll("[name]")].map(e => [e.name, e.type === "checkbox" ? e.checked : e.value])), ions, constants: P.C, source: cat.metadata, assumptions: [T.mass_note, T[`${kind}_note`]], seed: kind === "penning" ? null : val("seed"), acquisition, fit: fit && { ...fit, predict: undefined } };
      download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), FS.exportName(ui.style, kind + "-" + id) + ".json");
    }

    root.addEventListener("click", e => {
      const b = e.target.closest("[data-wb]"); if (!b) return; const action = b.dataset.wb;
      try {
        if (action === "generate") { update(); if (!model) return; acquisition = P.acquire(ions, parameters, origin - model.span, origin + model.span, val("points"), val("ions-point"), val("seed")); fit = null; renderTOF(); }
        if (action === "clear-fit") { fit = null; renderTOF(); }
        if (action === "fit") { if (!acquisition) throw new Error(T.generate); fit = P.fitSingle(acquisition.scan, parameters, origin); renderTOF(); }
        if (action === "calibrate") { const ref = cat.resolve($("cal-ion").value), c = P.calibration(val("cal-time"), val("cal-ref"), ref, ions[0].q, val("delay"), val("cal-sig") / 1000, val("cal-ref-sig") / 1000, val("cal-delay-sig") / 1000); controls.querySelector(".wb-cal-result").textContent = `${fmt(c.atomicMassU, 12)} ± ${c.uncertaintyU == null ? T.unknown : fmt(c.uncertaintyU)} u. ${c.uncertainty_model}`; }
        if (action === "view") { view = b.dataset.view; clearViews(); paintOrbit(); }
        if (action === "pause") { paused = !paused; b.setAttribute("aria-pressed", String(paused)); }
        if (action === "reset") { play = 0; paintOrbit(); }
        if (action === "step") { paused = true; play = Math.min(1, play + .01); paintOrbit(); }
        if (action === "zoom-in") handles[b.dataset.figure]?.zoom(.8);
        if (action === "zoom-out") handles[b.dataset.figure]?.zoom(1.25);
        if (action === "reset-view") handles[b.dataset.figure]?.reset();
        if (action.startsWith("figure-")) {
          const id = b.dataset.figure, c = canvas(id), format = action.slice(7);
          if (format === "png") saveImage(c, "PNG"); else if (format === "pdf") saveImage(c, "PDF"); else if (format === "svg") saveImage(c, "SVG");
          else if (format === "csv") saveCSV(c); else if (format === "json") saveJSON(c, id);
        }
        if (action === "png") saveImage(plots.querySelector("canvas[data-plot]"), "PNG");
        if (action === "video") { const was = paused; play = 0; paused = false; paintOrbit(); window.zgExport?.record(canvas("trajectory"), 6, "penning-advanced-" + view, r => { b.disabled = r; if (!r) paused = was; }); }
        if (action === "csv") window.zgExport?.csv(kind === "penning" ? ["time_s", "x_mm", "y_mm", "z_mm"] : kind === "mr" ? ["tof_offset_ns", ...ions.map((i, j) => names[j] + "_counts_per_bin"), "total_counts_per_bin"] : ["frequency_Hz", ...ions.map((i, j) => names[j] + "_mean_tof_us"), "mixture_mean_tof_us", ...(fit?.predict ? ["single_species_fit_us"] : [])], displayRows, kind + "-comparison");
        if (action === "json") { const data = { version: 3, model: kind, constants: P.C, source: cat.metadata, parameters, species: descs.map((d, i) => ({ legend: names[i], ...d })), units: kind === "mr" ? { referenceUs: "µs at mion/q=100 u/e", lapUs: "µs/lap at mion/q=100 u/e", delayUs: "µs", widthNs: "ns FWHM", broadeningNs: "ns/lap" } : kind === "tof" ? { B: "T", T: "s", frequency: "Hz", TOF: "µs" } : { B: "T", voltage: "V", d: "m", rp: "mm", rm: "mm", axial: "mm", duration: "s" }, controls: Object.fromEntries([...controls.querySelectorAll("[name]")].map(e => [e.name, e.type === "checkbox" ? e.checked : e.value])), ions, modelResult: model, acquisition, fit: fit && { ...fit, predict: undefined }, assumptions: [T.mass_note, T[`${kind}_note`]], seed: kind === "penning" ? null : val("seed") }; download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), kind + "-inputs-results.json"); }
        error.hidden = true;
      } catch (err) { error.hidden = false; error.textContent = err.message; }
    });
    for (let i = 0; i < ionRows; i++) syncStates(i, false, kind === "mr" && i === 1 ? 1 : 0);
    if (calEl) calEl.addEventListener("zg-cal-change", () => update());
    update();
    if (kind === "tof" && model) { acquisition = P.acquire(ions, parameters, origin - model.span, origin + model.span); fit = P.fitSingle(acquisition.scan, parameters, origin); renderTOF(); }
    new ResizeObserver(() => redraw()).observe(plots);
    if (kind === "penning") { let last = 0; function animate(time) { if (!paused && model?.stable && root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight && time - last > 70) { play = (play + .015 * val("playback")) % 1; paintOrbit(); last = time; } frame = requestAnimationFrame(animate); } frame = requestAnimationFrame(animate); }
  });
})();
