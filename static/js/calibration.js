/* Shared double-trap calibrant panel (CAL1) — layouts/_partials/zg/calibration-panel.html.
   JYFLTRAP as in PyMassScanner (ame_legacy.get_trap1/2_frequencies, get_TOFs): trap 1 = purification trap,
   trap 2 = precision trap, each with its own reference ion(s), measured νc and ν−; TOF calibrations RFQ→T1 and T1→T2.
   Each [data-cal-panel] element gets el.zgCal = { get(trap), double(), resolve(), record() } and fires a bubbling
   "zg-cal-change" event. get() returns the calibration of the host's trap (data-trap or the "cal-trap" select), or null
   when the box is unchecked or the input is invalid, so every host keeps its ideal-trap behaviour in that case. */
(function () {
  "use strict";
  /* PyMassScanner R31 default.ini (2026-07-22): examples, not current measurements */
  const PRESETS = {
    jyfltrap: { "1": [{ ion: "97Mo", q: 1, nc: 1108887.227, snc: 0, nm: 1653.063, snm: 0 }],
                "2": [{ ion: "133Cs", q: 1, nc: 808542.788, snc: 0, nm: 1653.063, snm: 0 }],
                tof: { rfqT1: { ion: "82Se", q: 1, t: 177 }, t1T2: { ion: "133Cs", q: 1, t: 47.3 } } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 3) => x == null || !Number.isFinite(x) ? "—" : x.toFixed(d);
  const sig = (x, n = 3) => x == null || !Number.isFinite(x) ? "—" : x === 0 ? "0" : x.toPrecision(n);

  function init(el) {
    if (el.zgCal) return;
    const P = window.ZGPhysics, L = JSON.parse(el.dataset.labels || "{}"), full = el.hasAttribute("data-full");
    const $ = s => el.querySelector(s), out = $(".zg-cal-out"), badge = $(".zg-cal-badge");
    const body = k => el.querySelector(`[data-trap-table="${k}"] tbody`);
    let catalog = null, dt = null, error = "", computed = [];
    const loading = P.load(el.dataset.catalogue, el.dataset.ame).then(c => (catalog = c)).catch(e => { error = e.message; paint(); });

    function row(k, c) {
      const tr = document.createElement("tr"), cell = (label, html) => `<td data-label="${esc(label)}">${html}</td>`;
      tr.innerHTML = cell(L.calibrant, `<input type="text" name="c-ion" value="${esc(c.ion)}" spellcheck="false" aria-label="${esc(L.calibrant)}">`) +
        cell("q", `<input type="number" name="c-q" min="1" max="100" step="1" value="${c.q}" aria-label="q">`) +
        cell(L.nc, `<input type="number" name="c-nc" min="0" step="0.001" value="${c.nc}" aria-label="${esc(L.nc)}">`) +
        cell(L.snc, `<input type="number" name="c-snc" min="0" step="0.001" value="${c.snc}" aria-label="${esc(L.snc)}">`) +
        cell(L.nm, `<input type="number" name="c-nm" min="0" step="0.001" value="${c.nm}" aria-label="${esc(L.nm)}">`) +
        cell(L.snm, `<input type="number" name="c-snm" min="0" step="0.001" value="${c.snm}" aria-label="${esc(L.snm)}">`) +
        `<td><button type="button" class="zg-btn zg-btn-ghost" data-cal="del" title="${esc(L.remove)}">×</button></td>`;
      body(k).appendChild(tr);
    }
    function preset(name) {
      const p = PRESETS[name]; if (!p) return;
      for (const k of ["1", "2"]) { body(k).innerHTML = ""; p[k].forEach(c => row(k, c)); }
      for (const [k, t] of Object.entries(p.tof)) { const tr = el.querySelector(`[data-tof="${k}"]`); tr.querySelector("[name=t-ion]").value = t.ion; tr.querySelector("[name=t-q]").value = t.q; tr.querySelector("[name=t-t]").value = t.t; }
    }
    preset($("[name=cal-preset]").value);

    const opts = () => ({ massSource: $("[name=cal-source]").value });
    const resolve = (text, q) => catalog.resolve(text, { ...opts(), q });
    const hostTrap = () => ($("[name=cal-trap]")?.value) || el.dataset.trap || "2";
    function rows(k) {
      return [...body(k).querySelectorAll("tr")].map(tr => {
        const v = n => tr.querySelector(`[name=${n}]`)?.value ?? "";
        return { text: v("c-ion").trim(), q: +v("c-q") || 1, nc: +v("c-nc"), snc: +v("c-snc") || 0, nm: +v("c-nm"), snm: +v("c-snm") || 0 };
      }).filter(r => r.text || r.nc);
    }
    function ionOf(text, q) { try { return resolve(text, q); } catch (e) { throw new Error(`${L.bad_ion}: ${text}`); } }
    function update() {
      dt = null; error = "";
      if (!catalog) { paint(); return; }
      try {
        const spec = { traps: {}, tof: {} };
        for (const k of ["1", "2"]) spec.traps[k] = rows(k).map(r => ({ ion: ionOf(r.text, r.q), nc: r.nc, snc: r.snc, nm: r.nm, snm: r.snm }));
        el.querySelectorAll("[data-tof]").forEach(tr => {
          const text = tr.querySelector("[name=t-ion]").value.trim(), t = +tr.querySelector("[name=t-t]").value;
          if (text && t > 0) spec.tof[tr.dataset.tof] = { ion: ionOf(text, +tr.querySelector("[name=t-q]").value || 1), t };
        });
        dt = P.doubleTrapCalibration(spec, $("[name=cal-mode]").value);
        dt.source = opts().massSource === "ame" ? "AME2020" : "NUBASE2020";
        if (!dt.traps[hostTrap()]) throw new Error(`${L.invalid} (${hostTrap() === "1" ? L.trap1 : L.trap2})`);
      } catch (e) { error = e.message; if (!dt || !dt.traps) dt = null; }
      paint();
      el.dispatchEvent(new CustomEvent("zg-cal-change", { bubbles: true, detail: { scope: el.dataset.scope } }));
      if (full) results();
    }
    const on = () => $("[name=cal-on]").checked;
    function active(trap) { if (!on() || !dt) return null; const c = dt.traps[trap || hostTrap()]; return c ? Object.assign(c, { trap: trap || hostTrap(), source: dt.source }) : null; }
    function trapLine(k) {
      const c = dt.traps[k]; if (!c) return "";
      const cons = c.list.length > 1 ? ` · ${esc(L.consistency)}: ${c.list.map((x, i) => `${esc(x.label)} ${c.ppb[i] >= 0 ? "+" : ""}${fmt(c.ppb[i], 2)} ppb`).join(", ")}${c.birge != null ? ` · ${esc(L.birge)} ${fmt(c.birge, 2)}` : ""}` : "";
      return `<span class="zg-cal-line${k === hostTrap() ? " used" : ""}">${esc(k === "1" ? L.trap1 : L.trap2)}: B = <b>${c.B.toFixed(10)} T</b>${c.sB ? ` ± ${sig(c.sB, 2)} T` : ""} · ν− = ${fmt(c.nm, 3)} Hz${cons}</span>`;
    }
    function paint() {
      badge.textContent = on() ? (active() ? L.on : "⚠") : L.off; badge.classList.toggle("on", !!active());
      if (!on()) { out.textContent = ""; return; }
      if (!dt) { out.innerHTML = `<span class="g-warn">${esc(error || L.invalid)}</span>`; return; }
      out.innerHTML = trapLine("1") + trapLine("2") + (dt.fieldRatio ? `<span class="zg-cal-line">${esc(L.field_ratio)} = ${(dt.fieldRatio - 1).toExponential(3)} (${esc(dt.source)})</span>` : "") +
        (error ? `<span class="g-warn">${esc(error)}</span>` : "");
    }
    function results() {
      const host = $(".zg-cal-results"); if (!host) return;
      computed = []; if (!on() || !dt) { host.innerHTML = ""; return; }
      const items = $("[name=cal-ions]").value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean), bad = [];
      for (const t of items) { let ion; try { ion = catalog.resolve(t, opts()); } catch (e) { bad.push(t); continue; } computed.push({ ion, f: P.doubleTrapFrequencies(ion, dt) }); }
      const T2 = dt.traps["2"], ref2 = T2 && T2.list[0];
      host.innerHTML = (bad.length ? `<p class="g-warn">${esc(L.bad_ion)}: ${bad.map(esc).join(", ")}</p>` : "") +
        `<div class="zg-cal-tablewrap"><table class="zg-table"><thead><tr><th>${esc(L.ion)}</th><th>q</th><th>${esc(L.mion)}</th><th>${esc(L.nc1)}</th><th>${esc(L.nc2)}</th><th>σνc (Hz)</th><th>ν+ (Hz)</th><th>ν− (Hz)</th><th>νz (Hz)</th><th>${esc(L.periods)}</th><th>${esc(L.kevhz)}</th><th>${esc(L.tof_rfq)}</th><th>${esc(L.tof_t12)}</th><th>${esc(L.ratio)}</th><th>${esc(L.src)}</th></tr></thead><tbody>` +
        computed.map(({ ion, f }) => { const t2 = f.trap2, p = f.periodsUs;
          return `<tr><td>${esc(ion.label)}</td><td>${ion.q}</td><td>${ion.ionMassU.toFixed(9)}${ion.est ? "#" : ""}</td><td>${f.trap1 ? fmt(f.trap1.nc) : "—"}</td><td>${t2 ? fmt(t2.nc) : "—"}</td><td>${t2 ? sig(t2.snc) : "—"}</td><td>${t2 ? fmt(t2.np) : "—"}</td><td>${t2 ? fmt(t2.nm) : "—"}</td><td>${t2 ? fmt(t2.nz) : "—"}</td>` +
            `<td>${p ? `${fmt(p.axial)} / ${fmt(p.cyclotron)} / ${fmt(p.magnetron)}` : "—"}</td><td>${f.keVperHz == null ? "—" : f.keVperHz.toFixed(2)}</td><td>${fmt(f.tofRfqT1)}</td><td>${fmt(f.tofT1T2)}</td><td>${t2 ? (ref2.nc / t2.nc).toFixed(12) : "—"}</td><td class="zg-muted">${esc(ion.source)}</td></tr>`; }).join("") +
        `</tbody></table></div><p class="zg-muted zg-small">${esc(dt.traps["2"]?.convention || dt.traps["1"].convention)} · ${esc(dt.mode === "ideal" ? L.ideal : L.fixed)}</p>`;
    }
    function record() {
      if (!on() || !dt) return null;
      const trap = c => c && { calibrants: c.list.map((x, i) => ({ ion: x.label, q: x.q, nu_c_Hz: x.nc, sigma_nu_c_Hz: x.snc, nu_minus_Hz: x.nm, sigma_nu_minus_Hz: x.snm, B_T: x.B, sigma_B_T: x.sB, weight: c.weights[i], deviation_ppb: c.ppb[i] })), B_T: c.B, sigma_B_T: c.sB, birge: c.birge };
      return { model: "JYFLTRAP double Penning trap, calibrant-based frequencies (PyMassScanner ame_legacy)", mode: dt.mode, mass_source: dt.source,
        trap1_purification: trap(dt.traps["1"]), trap2_precision: trap(dt.traps["2"]), B2_over_B1_minus_1: dt.fieldRatio ? dt.fieldRatio - 1 : null,
        tof_calibration: Object.fromEntries(Object.entries(dt.tof).map(([k, t]) => [k, { ion: t.ion.label, t_us: t.t }])),
        ions: computed.map(({ ion, f }) => ({ ion: ion.label, q: ion.q, ion_mass_u: ion.ionMassU, extrapolated: !!ion.est, mass_source: ion.source,
          trap1_nu_c_Hz: f.trap1?.nc ?? null, trap2_nu_c_Hz: f.trap2?.nc ?? null, trap2_sigma_nu_c_Hz: f.trap2?.snc ?? null, trap2_nu_plus_Hz: f.trap2?.np ?? null, trap2_nu_minus_Hz: f.trap2?.nm ?? null, trap2_nu_z_Hz: f.trap2?.nz ?? null,
          periods_us: f.periodsUs, keV_per_Hz: f.keVperHz, tof_rfq_t1_us: f.tofRfqT1, tof_t1_t2_us: f.tofT1T2 })) };
    }

    el.addEventListener("input", e => { if (e.target.closest(".zg-cal-cals")) $("[name=cal-preset]").value = "custom"; if (e.target.name !== "cal-ions") update(); });
    el.addEventListener("change", e => { const n = e.target.name; if (n === "cal-preset") { preset(e.target.value); update(); } else if (["cal-on", "cal-source", "cal-mode", "cal-trap"].includes(n)) update(); });
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-cal]"); if (!b) return; const a = b.dataset.cal;
      if (a === "toggle") return show(pop.hidden);
      if (a === "close") return show(false);
      if (a === "add") { row(b.dataset.trap, { ion: "", q: 1, nc: "", snc: 0, nm: "", snm: 0 }); $("[name=cal-preset]").value = "custom"; }
      else if (a === "del") { b.closest("tr").remove(); $("[name=cal-preset]").value = "custom"; update(); }
      else if (a === "compute") results();
      else if (a === "csv" && window.zgExport && computed.length) window.zgExport.csv(["ion", "q", "ion_mass_u", "trap1_nu_c_Hz", "trap2_nu_c_Hz", "trap2_sigma_nu_c_Hz", "trap2_nu_plus_Hz", "trap2_nu_minus_Hz", "trap2_nu_z_Hz", "axial_period_us", "cyclotron_period_us", "magnetron_period_us", "keV_per_Hz", "tof_rfq_t1_us", "tof_t1_t2_us", "mass_source", "mode"],
        computed.map(({ ion, f }) => [ion.label, ion.q, ion.ionMassU, f.trap1?.nc, f.trap2?.nc, f.trap2?.snc, f.trap2?.np, f.trap2?.nm, f.trap2?.nz, f.periodsUs?.axial, f.periodsUs?.cyclotron, f.periodsUs?.magnetron, f.keVperHz, f.tofRfqT1, f.tofT1T2, ion.source, dt.mode]), "double-trap-frequencies");
      else if (a === "json") { const d = record(); if (!d) return; const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), u = URL.createObjectURL(blob), x = document.createElement("a"); x.href = u; x.download = "double-trap-frequencies.json"; x.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    });
    /* hint-like pop-up: the toggle button opens/closes it; ×, Escape or a click outside closes it */
    const pop = $(".zg-cal-pop"), toggle = $(".zg-cal-toggle");
    function show(open) { pop.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); if (open) pop.querySelector("input,select,button:not(.zg-cal-x)")?.focus({ preventScroll: true }); }
    document.addEventListener("click", e => { if (!pop.hidden && !el.contains(e.target)) show(false); });
    el.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { show(false); toggle.focus(); } });
    el.zgCal = { get: active, double: () => (on() ? dt : null), resolve, state: () => ({ dt, error }), ready: loading, record };
    loading.then(update);
  }
  function boot() { document.querySelectorAll("[data-cal-panel]").forEach(init); }
  window.ZGCal = { init, boot, active: (el, trap) => el && el.zgCal ? el.zgCal.get(trap) : null };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
