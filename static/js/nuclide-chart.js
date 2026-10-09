/* Interactive chart of nuclides — AME2020 / NUBASE2020 (static/data/nubase2020.json).
   Chart: zoom (wheel, ＋/−), drag to pan, click a box → zoom in + info card (all values with uncertainties;
   "#" = extrapolated / from systematics, as in AME and NUBASE). Colour modes, mass filters, search,
   mulberry periodic table. Chain plots (isotopic / isotonic / isobaric) with error bars.
   Exports: high-resolution PNG, CSV with uncertainties, WebM video (zoom tour) — via static/js/zg-export.js.
   Theory masses (FRDM 1995, HFB-17, HFB-D1M from static/data/massmodels.json, built by tools/make_mass_models.py):
   mass source select, drip lines (Sn, S2n, Sp, S2p = 0), r-/rp-process paths, model curves in chain plots,
   β2 deformation and ME(AME) − ME(model) colour modes. Pairing / p-n quantities: δVpn, Wigner indicator W, Δ(3)n, Δ(3)p.
   Labels: data-labels JSON (five languages) from layouts/_shortcodes/nuclide-chart.html + data/nuclide_chart_labels.yaml. */
(() => {
  const root = document.querySelector("[data-nuclide-chart]");
  if (!root) return;
  const T = JSON.parse(root.dataset.labels || "{}");
  const P=window.ZGPhysics; let catalog=null, selectedState=null;
  const unknown=T.state_unknown;
  const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cv = root.querySelector("canvas.nc-canvas"), g = cv.getContext("2d");
  const card = root.querySelector(".nc-card"), legend = root.querySelector(".nc-legend"), ptab = root.querySelector(".nc-ptable");
  const sel = root.querySelector("[name=nc-colour]"), fsel = root.querySelector("[name=nc-filter]"), search = root.querySelector("[name=nc-search]");
  const pc = root.querySelector("canvas.nc-plot"), pg = pc.getContext("2d"), pq = root.querySelector("[name=nc-pq]"), pchain = root.querySelector("[name=nc-pchain]"), pinfo = root.querySelector(".nc-pinfo");
  const MAGIC = [2, 8, 20, 28, 50, 82, 126], SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).replace(/\d/g, d => SUP[d]);
  let rows = [], M = new Map(), EL = [], view = { s: 4, x: 10, y: 0 }, pin = null, hover = null, mode = "decay", filt = "all", anim = null;
  let chain = null, plotPts = [], modPts = [], plotHover = null, plotDomain = null, bands = [], residualPts = [], visibleSeries = [], residualDomain = null;
  const rc=root.querySelector("canvas.nc-residual"),rg=rc.getContext("2d");
  const CP = window.ZGChainPlot, rangeMemory = {};
  let activeChainType = pchain.value;
  const chainInput = name => root.querySelector(`[name=nc-${name}]`);
  const axisNumber = name => { const v = chainInput(name).value; return v === '' ? null : Number(v); };
  /* theory masses: MOD[key] = {name, ref, url, map: Map(key → [ME keV, β2·1000])}; src = "ame" or a model key */
  let MOD = {}, PATHS = {}, src = "ame", extraRows = [], modelIndex = null, indexLoading = null, modelLoads = new Map(), modelErrors = new Set(), measured = null, inputTable = null;
  const MM=window.ZGMeasuredMasses;
  const msel = root.querySelector("[name=nc-model]"), ovl = root.querySelector(".nc-ovl");
  const key = (Z, N) => Z * 1000 + N;
  let ink = '#1d2433';
  const updateInk = () => { ink=(getComputedStyle(document.documentElement).getPropertyValue('--zg-ink')||'').trim()||'#1d2433'; };
  updateInk();
  const X = window.zgExport;
  const lineWidth = () => +(root.querySelector("[name=nc-line-width]")?.value || 1);
  const DPR = () => Math.min(4, Math.max(2, window.devicePixelRatio || 1));   /* render at ≥ 2× for crisp text and lines */
  cv._cw = 960; cv._ch = 600; pc._cw = 960; pc._ch = 480;
  const sizeCanvas = (c, w, h) => { const k = DPR(); c._cw = w; c._ch = h; c.width = Math.round(w * k); c.height = Math.round(h * k); c.style.aspectRatio = `${w} / ${h}`; };

  /* ---------- physics with uncertainties (keV); est = any input from systematics (#) ---------- */
  const get = (Z, N) => { const r = M.get(key(Z, N)); return r && r[3] != null ? P.primitive("AME2020:"+key(Z,N),r[3],r[4],!!r[5],!!r[13]) : null; };
  let MEn = { v: 8071.3181, e: 0.0004, est: false }, MEH = { v: 7288.971064, e: 0.000013, est: false }, MEa = { v: 2424.91587, e: 0.00015, est: false };
  /* combine a·x + b·y + … ; uncertainties in quadrature (AME correlations neglected) */
  const comb=P.combine;
  const K=P.constant;
  const memo = {clear:()=>surface.clear()};
  const getM = (s, Z, N) => { const v = MOD[s] && MOD[s].map.get(key(Z, N)); return v ? P.primitive("model:"+s+":"+key(Z,N),v[0],null,false) : null; };
  const getter = s => s === "ame" ? get : s === "hybrid" ? (z,n)=>inputTable ? MM.getter(inputTable,get)(z,n) : get(z,n) : (Z,N)=>getM(s,Z,N);
  const derived = r => derivedZN(r[0], r[1], "ame");
  const surface=window.ZGMassSurface.create(s=>getter(s),{get MEn(){return MEn;},get MEH(){return MEH;},get MEa(){return MEa;}},(s,z,n)=>{const b=MOD[s]?.map.get(key(z,n))?.[1];return b==null?null:{v:b,e:null,est:false};});
  const derivedZN=(z,n,s='ame')=>surface.derive(z,n,s);
  /* ME(AME) − ME(model) for the chosen (or default FRDM) model */
  const modelKey = () => src !== "ame" ? src : MOD.frdm2012 ? "frdm2012" : MOD.frdm1995 ? "frdm1995" : Object.keys(MOD)[0];
  const dmod = r => { const mk = modelKey(), a = get(r[0], r[1]), b = mk && getM(mk, r[0], r[1]); return a && b ? { v: a.v - b.v, e: a.e, est: a.est } : null; };
  const decayClass = r => {
    const b = r[10] || "";
    if (r[6] === 99) return "stable";
    const first = (b.split(";")[0] || "").replace(/[=~<>?].*$/, "").trim();
    if (first === "B-" || first === "2B-") return "bm";
    if (first === "B+" || first === "EC" || first === "e+" || first === "2B+") return "bp";
    if (first === "A") return "a"; if (first === "SF") return "sf"; if (first === "IT") return "it";
    if (first === "p" || first === "2p") return "p"; if (first === "n" || first === "2n") return "n";
    return r[6] === -98 ? "punst" : "other";
  };
  const DC = { stable: "#111827", bm: "#3b82f6", bp: "#ef4444", a: "#f2c230", sf: "#22c55e", p: "#f97316", n: "#7c3aed", it: "#ec4899", punst: "#cbd5e1", other: "#94a3b8" };

  /* ---------- colour modes ---------- */
  const ramp = x => `hsl(${(1 - Math.max(0, Math.min(1, x))) * 270},85%,52%)`;
  const mv = (o, f = 1000) => o == null ? null : o.v / f;
  const D = r => derivedZN(r[0], r[1], src);          /* derived values from the current mass source */
  const MODES = {
    decay: { label: T.m_decay, f: r => DC[decayClass(r)] },
    hl: { label: T.m_hl, f: r => r[6] === 99 ? "#111827" : r[6] <= -98 ? "#e2e8f0" : ramp((r[6] + 9) / 29), range: ["1 ns", "10²⁰ s"] },
    bea: { label: T.m_bea, v: r => mv(D(r).BEA), lo: 7.0, hi: 8.8, u: "MeV" },
    me: { label: T.m_me, v: r => mv(D(r).me), lo: -95, hi: 80, u: "MeV" },
    sn: { label: T.m_sn, v: r => mv(D(r).sn), lo: 0, hi: 20, u: "MeV" },
    s2n: { label: T.m_s2n, v: r => mv(D(r).s2n), lo: 0, hi: 35, u: "MeV" },
    sp: { label: T.m_sp, v: r => mv(D(r).sp), lo: 0, hi: 20, u: "MeV" },
    qbm: { label: T.m_qb, v: r => mv(D(r).qbm), lo: 0, hi: 20, u: "MeV" },
    qa: { label: T.m_qa, v: r => mv(D(r).qa), lo: 0, hi: 10, u: "MeV" },
    dme: { label: T.m_dme, v: r => r[4] == null ? null : Math.log10(Math.max(r[4], 1e-4)), lo: -3, hi: 3, rng: ["0.001 keV", "1 MeV"] },
    est: { label: T.m_est, f: r => r[3] == null ? "#868e96" : r[5] ? "#f59e0b" : "#0ea5e9" },
    year: { label: T.m_year, v: r => r[9], lo: 1900, hi: 2020 },
    iso: { label: T.m_iso, f: r => ["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][Math.min(3, r[11].length)] },
    eo: { label: T.m_eo, f: r => ["#0ea5e9", "#f59e0b", "#22c55e", "#ef4444"][(r[0] % 2) * 2 + (r[1] % 2)] },
    s2p: { label: "S₂ₚ", v: r => mv(D(r).s2p), lo: 0, hi: 35, u: "MeV" },
    qec: { label: "Q(EC)", v: r => mv(D(r).qec), lo: 0, hi: 20, u: "MeV" },
    d2n: { label: "δ₂ₙ (shell gap)", v: r => mv(D(r).d2n), lo: 0, hi: 6, u: "MeV" },
    d2p: { label: "δ₂ₚ (shell gap)", v: r => mv(D(r).d2p), lo: 0, hi: 6, u: "MeV" },
    vpn: { label: T.m_vpn, v: r => mv(D(r).vpn), lo: 0, hi: 1.2, u: "MeV" },
    wig: { label: T.wig, v: r => mv(D(r).wig), lo: -0.4, hi: 0.4, u: "MeV", div: true },
    d3p: { label: "Δₚ⁽³⁾", v: r => mv(D(r).d3p), lo: 0, hi: 2.5, u: "MeV" },
    d5n: { label: "Δₙ⁽⁵⁾", v: r => mv(D(r).d5n), lo: 0, hi: 2.5, u: "MeV" },
    d5p: { label: "Δₚ⁽⁵⁾", v: r => mv(D(r).d5p), lo: 0, hi: 2.5, u: "MeV" },
    d3n: { label: T.m_d3n, v: r => mv(D(r).d3n), lo: 0, hi: 2.5, u: "MeV" },
    beta2: { label: T.m_beta2, need: true, v: r => { const v = MOD[modelKey()] && MOD[modelKey()].map.get(key(r[0], r[1])); return v ? v[1] / 1000 : null; }, lo: -0.3, hi: 0.4, div: true },
    dmod: { label: T.m_dmod, need: true, v: r => mv(dmod(r)), lo: -3, hi: 3, u: "MeV", div: true },
  };
  const FILTERS = {
    all: [T.fl_all, () => true], missing: [T.fl_missing,r=>r[3]==null], unknown_unc: [T.fl_unknown_unc,r=>r[4]==null], known_unc: [T.fl_known_unc,r=>r[3]!=null&&r[4]!=null], state_hash: [T.fl_state_hash,r=>catalog && (catalog.groups.get(r[2].toLowerCase()+(r[0]+r[1]))||[]).some(s=>s.excitation.value_extrapolated)], meas: [T.fl_meas, r => r[3] != null && !r[5]], extr: [T.fl_extr, r => !!r[5]],
    d1: ["δm < 1 keV", r => r[4] != null && !r[5] && r[4] < 1], d10: ["δm < 10 keV", r => r[4] != null && !r[5] && r[4] < 10], d100: ["δm < 100 keV", r => r[4] != null && !r[5] && r[4] < 100],
    stable: [T.fl_stable, r => r[6] === 99], hl: [T.fl_hl, r => r[6] > -90 && r[6] !== 99], iso: [T.fl_iso, r => r[11].length > 0],
    magic: [T.fl_magic, r => MAGIC.includes(r[0]) || MAGIC.includes(r[1])], nz: ["N = Z", r => r[0] === r[1]],
    nz1: ["|N − Z| = 1", r => Math.abs(r[1] - r[0]) === 1], nz2: ["|N − Z| ≤ 2", r => Math.abs(r[1] - r[0]) <= 2], prich: ["N < Z", r => r[1] < r[0]],
    ee: ["Z even · N even", r => r[0] % 2 === 0 && r[1] % 2 === 0], eo: ["Z even · N odd", r => r[0] % 2 === 0 && r[1] % 2 === 1],
    oe: ["Z odd · N even", r => r[0] % 2 === 1 && r[1] % 2 === 0], oo: ["Z odd · N odd", r => r[0] % 2 === 1 && r[1] % 2 === 1],
    oddA: [T.fl_oddA || "odd A", r => (r[0] + r[1]) % 2 === 1], evenA: [T.fl_evenA || "even A", r => (r[0] + r[1]) % 2 === 0],
    p3: [T.fl_p3 || "3-point Δ⁽³⁾ available", r => derived(r).d3n != null], p5: [T.fl_p5 || "5-point Δ⁽⁵⁾ available", r => derived(r).d5n != null],
    unb: [T.fl_unb || "particle-unbound (Sₙ or Sₚ < 0)", r => { const d = derived(r); return (d.sn && d.sn.v < 0) || (d.sp && d.sp.v < 0); }],
    lowq: [T.fl_lowq || "Q(β) < 1 MeV", r => { const d = derived(r); return (d.qbm && d.qbm.v > 0 && d.qbm.v < 1000) || (d.qec && d.qec.v > 0 && d.qec.v < 1000); }],
  };
  const pass = r => r.mo ? filt === "all" : FILTERS[filt][1](r);
  const allRows = () => src === "ame" ? rows : rows.concat(extraRows);
  function colour(r) {
    const m = MODES[mode]; if (m.f) return m.f(r);
    const v = m.v(r); if (v == null) return "#e5e7eb";
    const x = (v - m.lo) / (m.hi - m.lo);
    if (m.div) { const t = Math.max(0, Math.min(1, x)), a = Math.abs(t - (0 - m.lo) / (m.hi - m.lo)) * 2; return t < (0 - m.lo) / (m.hi - m.lo) ? `hsl(220,80%,${96 - 50 * Math.min(1, a)}%)` : `hsl(0,80%,${96 - 50 * Math.min(1, a)}%)`; }
    return ramp(x);
  }
  function drawLegend() {
    const m = MODES[mode];
    if (mode === "decay") legend.innerHTML = [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]].map(([k, l]) => `<span><i style="background:${DC[k]}"></i>${l}</span>`).join("");
    else if (mode === "est") legend.innerHTML = `<span><i style="background:#0ea5e9"></i>${T.measured}</span><span><i style="background:#f59e0b"></i>${T.extrap}</span>`;
    else if (mode === "iso") legend.innerHTML = [0, 1, 2, 3].map(n => `<span><i style="background:${["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][n]}"></i>${n}${n === 3 ? "+" : ""}</span>`).join("");
    else if (mode === "eo") legend.innerHTML = [["#0ea5e9", "Z even · N even"], ["#f59e0b", "Z even · N odd"], ["#22c55e", "Z odd · N even"], ["#ef4444", "Z odd · N odd"]].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
    else { const lo = m.range ? m.range[0] : m.rng ? m.rng[0] : m.lo, hi = m.range ? m.range[1] : m.rng ? m.rng[1] : m.hi; legend.innerHTML = `<span>${lo}</span><span class="nc-ramp${m.div ? " nc-ramp-div" : ""}"></span><span>${hi} ${m.u || ""}</span>` + (m.need || src !== "ame" ? `<span class="nc-mnote">${MOD[modelKey()] ? MOD[modelKey()].name : ""}</span>` : ""); }
  }

  /* ---------- drawing (any context / scale, for high-res export) ---------- */
  function draw(c = g, Wd = cv._cw, Hd = cv._ch, sc = 1) {
    if (c === g) g.setTransform(cv.width / cv._cw, 0, 0, cv.height / cv._ch, 0, 0);
    const v = { s: view.s * sc, x: view.x * sc, y: view.y * sc }, s = v.s;
    const P = (Z, N) => [v.x + N * s, Hd - v.y - (Z + 1) * s];
    c.clearRect(0, 0, Wd, Hd);
    if (sc > 1) { c.fillStyle = "#ffffff"; c.fillRect(0, 0, Wd, Hd); }
    c.strokeStyle = "rgba(127,127,160,.35)"; c.lineWidth = 0.45 * lineWidth() * sc;
    const optOn = n => !ovl || !ovl.querySelector(`[data-opt=${n}]`) || ovl.querySelector(`[data-opt=${n}]`).checked;
    if (optOn("magic")) MAGIC.forEach(m => {
      const [x] = P(0, m); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hd); c.moveTo(x + s, 0); c.lineTo(x + s, Hd); c.stroke();
      if (m <= 120) { const [, y] = P(m, 0); c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y); c.moveTo(0, y + s); c.lineTo(Wd, y + s); c.stroke(); }
    });
    if (optOn("nz")) { c.save(); c.strokeStyle = "rgba(142,78,198,.75)"; c.lineWidth = lineWidth() * sc; c.setLineDash([5 * sc, 5 * sc]); const a = P(0, 0), b = P(120, 120); c.beginPath(); c.moveTo(a[0], a[1] + s); c.lineTo(b[0] + s, b[1]); c.stroke(); c.restore(); }
    const big = s >= 26 * sc, mid = s >= 14 * sc;
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const r of allRows()) {
      const [x, y] = P(r[0], r[1]);
      if (x < -s || y < -s || x > Wd || y > Hd) continue;
      const ok = pass(r); c.globalAlpha = ok ? (r.mo ? 0.5 : 1) : 0.1;
      c.fillStyle = r.mo && (mode === "decay" || MODES[mode].f) ? "#cbd5e1" : colour(r); c.fillRect(x, y, s - (s > 3 ? sc : 0.3), s - (s > 3 ? sc : 0.3));
      if(ok&&s>=10*sc&&measured?.marked(r[0],r[1])){c.strokeStyle="#a71984";c.lineWidth=2*sc;c.strokeRect(x+sc,y+sc,s-3*sc,s-3*sc);}
      if (mid && ok) {
        const dark = r[6] === 99 || ["bm", "sf", "n"].includes(decayClass(r)) && mode === "decay";
        c.fillStyle = dark ? "#fff" : "#111";
        c.font = `${Math.min(14 * sc, s * 0.28)}px system-ui`;
        c.fillText(sup(r[0] + r[1]) + r[2] + (r[5] ? "#" : "") + (r.mo ? "*" : "") + (measured?.marked(r[0],r[1]) ? "★" : ""), x + s / 2, y + s * (big ? 0.32 : 0.5));
        if (big && !r.mo) { c.font = `${Math.min(11 * sc, s * 0.2)}px system-ui`; c.fillText(r[7].replace("stable", "★"), x + s / 2, y + s * 0.68); }
      }
    }
    c.globalAlpha = 1;
    drawOverlays(c, v, Hd, sc);
    [[hover, ink], [pin, "#e5484d"]].forEach(([r, col]) => { if (!r || sc > 1 && r === hover) return; const [x, y] = P(r[0], r[1]); c.strokeStyle = col; c.lineWidth = 2 * sc; c.strokeRect(x - sc, y - sc, s + sc, s + sc); });
    c.fillStyle = sc > 1 ? '#222' : ink; c.font = `${12 * sc}px system-ui`; c.textAlign = "left"; c.fillText("N →", Wd - 36 * sc, Hd - 8 * sc); c.fillText("Z ↑", 6 * sc, 14 * sc);
  }
  /* ---------- theory masses, drip lines and process paths ---------- */
  const DRIP = { sn: ["#2563eb", [6, 4]], s2n: ["#1e3a8a", []], sp: ["#ef4444", [6, 4]], s2p: ["#991b1b", []] };
  const dripCache = new Map();
  function dripLine(q) {          /* returns [[Z, N_last_bound], …] (n-type) or [[N, Z_last_bound], …] (p-type) */
    const ck = src + q; if (dripCache.has(ck)) return dripCache.get(ck);
    const nType = q === "sn" || q === "s2n", set = src === "ame" ? rows.map(r => [r[0], r[1]]) : [...MOD[src].map.keys()].map(k => [Math.floor(k / 1000), k % 1000]);
    const by = new Map(); set.forEach(([Z, N]) => { const i = nType ? Z : N, j = nType ? N : Z; (by.get(i) || by.set(i, []).get(i)).push(j); });
    const out = [];
    [...by.keys()].sort((a, b) => a - b).forEach(i => {
      const js = by.get(i).sort((a, b) => a - b), val = j => { const d = nType ? derivedZN(i, j, src) : derivedZN(j, i, src); return d[q] ? d[q].v : null; };
      let last = null, unbound = false;
      js.forEach(j => { const v = val(j); if (v == null) return; if (v > 0) { last = j; unbound = false; } else if (last != null) unbound = true; });
      /* AME: only where an unbound nucleus is actually known; models: the table edge is the predicted drip line */
      const anyUnbound = js.some(j => last != null && j > last && (val(j) ?? 1) <= 0);
      if (last != null && (src !== "ame" || anyUnbound)) out.push([i, last]);
    });
    dripCache.set(ck, out); return out;
  }
  function drawOverlays(c, v, Hd, sc) {
    if (!ovl) return; const s = v.s, xN = N => v.x + N * s, yZ = Z => Hd - v.y - Z * s;
    ovl.querySelectorAll("input[data-drip]:checked").forEach(cb => {
      const q = cb.dataset.drip; if (src !== "ame" && !MOD[src]) return;
      const [col, dash] = DRIP[q], pts = dripLine(q), nType = q === "sn" || q === "s2n";
      c.strokeStyle = col; c.lineWidth = Math.max(0.35 * sc, Math.min(lineWidth() * sc, 0.3 * s)); c.lineJoin = "round"; c.lineCap = "round"; c.setLineDash(dash.map(d => d * sc)); c.beginPath();
      let prev = null;
      pts.forEach(([i, j]) => {
        if (nType) { const x = xN(j + 1); if (prev && prev[0] === i - 1) c.lineTo(x, yZ(i)); else c.moveTo(x, yZ(i)); c.lineTo(x, yZ(i + 1)); }
        else { const y = yZ(j + 1); if (prev && prev[0] === i - 1) c.lineTo(xN(i), y); else c.moveTo(xN(i), y); c.lineTo(xN(i + 1), y); }
        prev = [i, j];
      });
      c.stroke(); c.setLineDash([]);
    });
    ovl.querySelectorAll("input[data-path]:checked").forEach(cb => {
      const P = PATHS[cb.dataset.path]; if (!P) return; const col = cb.dataset.path === "r" ? "#d97706" : "#00873e";
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.5 * sc; c.globalAlpha = 0.85;
      P.pts.forEach(([Z, N]) => { c.beginPath(); c.arc(xN(N + 0.5), yZ(Z + 0.5), Math.max(1.4 * sc, s * 0.22), 0, 6.283); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 0.5 * sc; c.stroke(); });
      c.globalAlpha = 1;
    });
  }
  function loadIndex(){
    if(indexLoading)return indexLoading;
    indexLoading=fetch(root.dataset.models).then(r=>{if(!r.ok)throw new Error('Model index');return r.json();}).then(d=>{
      modelIndex=d.models;PATHS=d.paths;
      msel.innerHTML='<option value="ame">AME2020</option>'+Object.entries(modelIndex).map(([k,m])=>'<option value="'+escape(k)+'">'+escape(m.name)+'</option>').join('');
      root.querySelector('.nc-model-series').innerHTML=Object.entries(modelIndex).map(([k,m])=>{
        const table=m.source?.table_url||m.source?.url||new URL(m.data_url,new URL(root.dataset.models,location.href)).href;
        const paper=m.source?.doi?'https://doi.org/'+m.source.doi:m.url;
        return '<div class="nc-model-item"><label><input type="checkbox" data-model-series="'+escape(k)+'"> '+escape(m.name)+'</label><small><a href="'+escape(table)+'" target="_blank" rel="noopener">'+escape(T.loaded_data_link)+'</a> · <a href="'+escape(paper)+'" target="_blank" rel="noopener">'+escape(T.loaded_paper_link)+'</a></small></div>';
      }).join('');
      root.querySelector('[name=nc-impact-model]').innerHTML='<option value="selected">'+escape(T.loaded_selected_models)+'</option><option value="all">'+escape(T.loaded_all)+'</option>'+Object.entries(modelIndex).map(([k,m])=>'<option value="'+escape(k)+'">'+escape(m.name)+'</option>').join('');
      return d;
    }).catch(e=>{indexLoading=null;throw e;});
    return indexLoading;
  }
  function loadModels(k){
    return loadIndex().then(()=>{
      k=k||modelKey()||'frdm2012';
      if(MOD[k])return MOD[k];
      if(modelLoads.has(k))return modelLoads.get(k);
      const m=modelIndex[k];if(!m)throw new Error('Unknown model');
      const dataURL=new URL(m.data_url,new URL(root.dataset.models,location.href));if(m.payload_sha256)dataURL.searchParams.set('v',m.payload_sha256);
      const promise=fetch(dataURL).then(r=>{if(!r.ok)throw new Error('Model data');return r.json();}).then(d=>{
        const map=new Map();d.rows.forEach(([z,n,me,b])=>map.set(key(z,n),[me,b]));
        MOD[k]={...m,map};modelErrors.delete(k);memo.clear();dripCache.clear();return MOD[k];
      }).catch(e=>{modelLoads.delete(k);modelErrors.add(k);throw e;});
      modelLoads.set(k,promise);return promise;
    });
  }
  function modelFailure(){root.querySelector('.nc-model-error').textContent=T.loaded_model_error;}
  function selectedModels(){return [...root.querySelectorAll('[data-model-series]:checked')].map(el=>el.dataset.modelSeries);}
  root.querySelector('.nc-model-series').addEventListener('change',e=>{
    root.querySelector('.nc-model-error').textContent='';
    if(e.target.checked)loadModels(e.target.dataset.modelSeries).then(()=>plotChain()).catch(()=>{modelFailure();plotChain();});
    plotChain();
  });
  root.querySelector('[data-model-all]').onclick=()=>{root.querySelector('.nc-model-error').textContent='';root.querySelectorAll('[data-model-series]').forEach(el=>el.checked=true);Promise.allSettled(selectedModels().map(k=>loadModels(k))).then(results=>{if(results.some(r=>r.status==='rejected'))modelFailure();plotChain();});};
  root.querySelector('[data-model-none]').onclick=()=>{root.querySelectorAll('[data-model-series]').forEach(el=>el.checked=false);plotChain();};
  function setSource(s) {
    const go = () => {
      src = s; memo.clear(); dripCache.clear();
      if(s!=="ame"){const box=root.querySelector('[data-model-series="'+s+'"]');if(box)box.checked=true;}
      extraRows = s === "ame" ? [] : [...MOD[s].map.keys()].filter(k => !M.has(k)).map(k => { const Z = Math.floor(k / 1000), N = k % 1000, el = EL.find(e => e[0] === Z);
        const r = [Z, N, el ? el[1] : "Z" + Z, null, null, 0, -97, "—", "", null, "", []]; r.mo = true; return r; });
      root.querySelector(".nc-mref").innerHTML = s === "ame" ? "" : `${T.modnote} <a href="${MOD[s].url}" target="_blank" rel="noopener">${MOD[s].ref}</a>`;
      drawLegend(); draw(); plotChain(); if (pin) showCard(pin);
    };
    if (s === "ame") go();
    else {
      if (msel) msel.disabled = true;
      loadModels(s).then(go).catch(() => {
        root.querySelector(".nc-mref").textContent = "Model data unavailable / 模型数据不可用";
        if (msel) msel.value = src;
      }).finally(() => { if (msel) msel.disabled = false; });
    }
  }

  const W = () => cv._cw, H = () => cv._ch;
  function fit() { const s = Math.min(W() / 182, H() / 122); view = { s, x: (W() - 180 * s) / 2, y: (H() - 120 * s) / 2 }; draw(); }
  function zoomTo(r, s = 34, done) {
    const wide = cv.getBoundingClientRect().width > 640, cxp = wide ? W() * 0.3 : W() / 2;
    const target = { s, x: cxp - (r[1] + 0.5) * s, y: H() / 2 - (r[0] + 0.5) * s }, start = { ...view }, t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = now => { const k = Math.min(1, (now - t0) / 600), e = k * k * (3 - 2 * k); view = { s: start.s + (target.s - start.s) * e, x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e }; draw(); if (k < 1) anim = requestAnimationFrame(step); else done && done(); };
    anim = requestAnimationFrame(step);
  }
  function at(ev) {
    const b = cv.getBoundingClientRect(), x = (ev.clientX - b.left) * W() / b.width, y = (ev.clientY - b.top) * H() / b.height;
    const k = key(Math.floor((H() - view.y - y) / view.s), Math.floor((x - view.x) / view.s));
    return M.get(k) || (src !== "ame" && extraRows.find(r => key(r[0], r[1]) === k)) || null;
  }

  /* ---------- formatting: uncertainty with 2 significant digits, value rounded to the same decimal ---------- */
  function niceTicks(a, b, n = 6) {
    const span = b - a; if (!(span > 0)) return [a]; const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * span; v += step) out.push(+v.toFixed(12)); return out;
  }
  const fmtTick = v => { const a = Math.abs(v); return a === 0 ? "0" : a >= 1e4 || a < 1e-3 ? v.toExponential(1) : String(+v.toPrecision(5)); };
  function fmtU(v, e) {           /* → [value string, uncertainty string] */
    if (e == null) return [String(+v.toPrecision(10)), "?"];
    if (!(e > 0)) { const d = Math.abs(v) >= 100 ? 1 : 3; return [v.toFixed(d), "0"]; }
    const dec = Math.max(0, 1 - Math.floor(Math.log10(e)));
    return [v.toFixed(dec), e.toFixed(dec)];
  }
  const fv = (o, d = 3, f = 1000, u = " MeV") => { if (o == null) return "—"; const h = o.est ? "#" : "";
    if (o.e == null) return `${(o.v/f).toFixed(d)}${h}${u} (${unknown})`;
    if (!(o.e > 0)) return `${(o.v / f).toFixed(d)}${h}${u}`;
    const [a, b] = fmtU(o.v / f, o.e / f); return `${a}${h} ± ${b}${h}${u}`; };
  const DM = { "B-": "β⁻", "B+": "β⁺", "EC": "EC", "A": "α", "IT": "IT", "SF": "SF", "p": "p", "2p": "2p", "n": "n", "2n": "2n", "B-n": "β⁻n", "B-2n": "β⁻2n", "B+p": "β⁺p", "e+": "e⁺", "2B-": "2β⁻", "2B+": "2β⁺", "IS": T.abund };
  const decayText = b => !b ? "—" : b.split(";").map(x => {
    const m = x.trim().match(/^([A-Za-z0-9+\-]+)(.*)$/); if (!m) return x;
    const rest = m[2].trim().replace(/^([=~<>?]*\s*[\d.]+(?:[eE][-+]?\d+)?)\s+\d+$/, "$1");
    return (DM[m[1]] || m[1]) + (rest ? " " + rest.replace(/^=/, "= ") + (/\d/.test(rest) ? " %" : "") : "");
  }).join(" · ");
  function facts(r, d) {
    const [Z, N] = r, out = [];
    if (MAGIC.includes(Z) && MAGIC.includes(N)) out.push(T.f_dmagic); else if (MAGIC.includes(Z) || MAGIC.includes(N)) out.push(T.f_magic.replace("{k}", MAGIC.includes(Z) ? "Z = " + Z : "N = " + N));
    if (Z === N) out.push(T.f_nz);
    if (M.get(key(N, Z)) && Z !== N) out.push(T.f_mirror.replace("{m}", sup(Z + N) + M.get(key(N, Z))[2]));
    const iso = rows.filter(x => x[0] === Z), lo = Math.min(...iso.map(x => x[1])), hi = Math.max(...iso.map(x => x[1]));
    if (N === lo) out.push(T.f_light); if (N === hi) out.push(T.f_heavy);
    if (d.sn && d.sn.v < 0) out.push(T.f_nunb); if (d.sp && d.sp.v < 0) out.push(T.f_punb);
    if (r[9]) out.push(T.f_year.replace("{y}", r[9]).replace("{n}", new Date().getFullYear() - r[9]));
    if (d.BE && d.A > 1) out.push(T.f_be.replace("{e}", (d.BE.v / 1000).toFixed(1)).replace("{p}", (d.BE.v / (d.A * 931494.1) * 100).toFixed(2)));
    if (r[6] !== 99 && r[6] > -90) { const f = 100 * Math.pow(0.5, 86400 / Math.pow(10, r[6]));
      out.push(T.f_left.replace("{p}", f >= 99.995 ? "≈ 100" : f >= 0.01 ? f.toFixed(2) : f > 1e-300 ? f.toExponential(1).replace(/e([+-]\d+)/, (_, x) => " × 10" + String(+x).replace(/-/, "⁻").replace(/\d/g, d => SUP[d])) : "≈ 0")); }
    return out;
  }
  function showCard(r) {
    if (!r) { card.hidden = true; return; }
    const d = derived(r), dm = src !== "ame" && MOD[src] ? derivedZN(r[0], r[1], src) : null, A = r[0] + r[1], el = EL.find(e => e[0] === r[0]), row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    card.hidden = false;
    card.innerHTML = `<button type="button" class="nc-close" aria-label="${T.state_close}">×</button>
      <div class="nc-head"><span class="nc-sym">${sup(A)}${r[2]}</span><span>${el ? el[2] : ""}<br><small>Z = ${r[0]} · N = ${r[1]} · A = ${A}</small></span></div>
      <table>${row(T.hl, r[7] === "stable" ? T.stable : r[7])}${row("Jπ", r[8] || "—")}${row(T.decay, decayText(r[10]))}
      ${row(T.me, d.me ? (() => { const [a, b] = fmtU(d.me.v, d.me.e), h = d.me.est ? "#" : ""; return `${a}${h} ± ${b}${d.me.sigmaEst ? "#" : ""} keV`; })() : "—")}
      ${row("B/A", fv(d.BEA, 4))}${row("Sₙ", fv(d.sn))}${row("S₂ₙ", fv(d.s2n))}${row("Sₚ", fv(d.sp))}${row("S₂ₚ", fv(d.s2p))}
      ${row("Q(β⁻)", fv(d.qbm))}${row("Q(EC)", fv(d.qec))}${row("Q(α)", fv(d.qa))}${row("δ₂ₙ", fv(d.d2n))}
      ${row("Δₙ⁽³⁾ · Δₚ⁽³⁾", fv(d.d3n) + "<br>" + fv(d.d3p))}${row("δV<sub>pn</sub>", fv(d.vpn))}${row(T.wig, fv(d.wig))}
      ${dm ? `<tr class="nc-mrow"><th colspan="2">${MOD[src].name}</th></tr>${row(T.me, dm.me ? (dm.me.v / 1000).toFixed(3) + " MeV" : "—")}${row("ME(AME) − ME(" + T.model_short + ")", d.me && dm.me ? ((d.me.v - dm.me.v) / 1000).toFixed(3) + " MeV" : "—")}${row("Sₙ · S₂ₙ", fv(dm.sn, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2n, 3).replace(/ ± 0\.000/, ""))}${row("Sₚ · S₂ₚ", fv(dm.sp, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2p, 3).replace(/ ± 0\.000/, ""))}${row("β₂", dm.beta2 ? (dm.beta2.v / 1000).toFixed(3) : "—")}` : ""}
      ${row(T.disc, r[9] || "—")}
      ${r[11].length ? row(T.isomers, r[11].map(i => `${sup(A)}${i[0]}${r[2]}: ${i[1] == null ? "?" : i[1].toLocaleString()} keV, ${i[2] || "?"}, ${i[3] || ""}`).join("<br>")) : ""}</table>
      <div class="nc-cbtn"><button type="button" class="zg-btn" data-ch="Z">${T.p_iso}</button><button type="button" class="zg-btn" data-ch="N">${T.p_isot}</button><button type="button" class="zg-btn" data-ch="A">${T.p_isob}</button></div>
      <ul class="nc-facts">${facts(r, d).map(x => "<li>" + x + "</li>").join("")}</ul>
      <p class="nc-src"># ${T.hashnote} · ${T.errnote}<br>AME2020 · NUBASE2020 (Chin. Phys. C 45, 030001–030003, 2021)</p>`;
    card.insertAdjacentHTML("beforeend",measured?.annotation(r[0],r[1])||"");
    showStates(r);
    card.querySelector(".nc-close").onclick = () => { pin = null; showCard(null); draw(); };
    card.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => { pchain.value = b.dataset.ch; plotChain(r); pc.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }


  function showStates(r) {
    const group=catalog?.groups.get(r[2].toLowerCase()+(r[0]+r[1])); if(!group)return;
    const panel=document.createElement("div");panel.className="nc-state-list";
    const hintId = "nc-state-" + r[2] + (r[0] + r[1]);
    panel.innerHTML = `
      <h4>${T.state_heading}</h4>
      <details class="nc-explanation"><summary>${T.loaded_hint_toggle}</summary><p class="nc-state-help">${T.state_intro}</p></details>
      <label>${T.state_search}<input type="search" class="nc-state-search" aria-describedby="${hintId}-search"></label>
      <details class="nc-explanation"><summary>${T.loaded_hint_toggle} · ${T.state_search}</summary><p class="nc-state-help" id="${hintId}-search">${T.state_search_hint}</p></details>
      <label>${T.state_class}<select class="nc-state-kind" aria-describedby="${hintId}-class">
        <option value="isomer">${T.state_isomers}</option><option value="all">${T.state_all}</option><option value="unclassified">${T.state_pending}</option>
      </select></label>
      <details class="nc-explanation"><summary>${T.loaded_hint_toggle} · ${T.state_class}</summary><p class="nc-state-help" id="${hintId}-class">${T.state_class_hint}</p></details>
      <details class="zg-control-help"><summary>${T.state_help_title}</summary><p>${T.state_definitions}</p><p>${T.state_values_hint}</p></details>
      <button type="button" class="zg-btn zg-btn-ghost nc-state-reset">${T.state_reset}</button>
      <p class="nc-state-status" role="status"></p><div class="nc-state-buttons"></div><div class="nc-state-data" aria-live="polite"></div>`;
    card.appendChild(panel);
    const target=group.find(s=>s.id===selectedState);
    if(target && !["ground","isomer"].includes(target.kind))panel.querySelector("select").value="all";
    function detail(state) {
      selectedState=state.id;panel.querySelectorAll("[data-state]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.state===state.id?"true":"false"));
      const format=q=>`${escape(q.raw||"—")} ${q.raw_uncertainty?"± "+escape(q.raw_uncertainty):"("+unknown+")"}`;
      const life=state.half_life;
      panel.querySelector(".nc-state-data").innerHTML=`<p><b>${state.A}${escape(state.element)} [${state.label}]</b> · ${escape(T.state_kinds[state.kind])}${state.existence==="withdrawn"?" — "+T.state_withdrawn:state.existence==="questioned"?" — "+T.state_questioned:""}</p><p>ME (NUBASE2020): ${format(state.mass_excess)} keV<br>Eₓ: ${format(state.excitation)} keV<br>T½: ${format(life)} ${escape(life.unit)}<br>Jπ: ${escape(state.spin_parity)}</p><p>${state.ordering_uncertain?"* "+T.state_order_uncertain+". ":""}${state.ordering_inverted?"& "+T.state_order_inverted+". ":""}${escape(T.state_bases[state.classification_basis])}.</p><p>${T.state_model_note}</p>`;
      const a=document.createElement("a");a.href=location.pathname+"?nuclide="+state.A+state.element+"&state="+state.source_state_index;a.textContent=T.state_link;a.onclick=e=>{e.preventDefault();history.pushState(null,'',a.href);a.textContent=T.state_link_ready;};panel.querySelector(".nc-state-data").appendChild(a);
    }
    function populate() {
      const q=panel.querySelector("input").value.trim().toLowerCase(), kind=panel.querySelector("select").value;
      const exactLabel = group.some(s => s.label.toLowerCase() === q);
      const visible = group.filter(s => {
        const inClass = kind === "all" || s.kind === "ground" || s.kind === kind;
        const text = `${s.label} ${s.kind} ${T.state_kinds[s.kind]} ${s.excitation.raw} ${s.spin_parity}`.toLowerCase();
        return inClass && (exactLabel ? s.label.toLowerCase() === q : text.includes(q));
      });
      panel.querySelector(".nc-state-status").textContent = visible.length ? T.state_matches.replace("{n}", visible.length).replace("{total}", group.length) : T.state_empty;
      const box=panel.querySelector(".nc-state-buttons");box.innerHTML=visible.map(st=>`<button type="button" data-state="${st.id}" aria-pressed="${selectedState===st.id}">${escape(st.label)} · ${escape(T.state_kinds[st.kind])}${st.source_state_index?" · "+escape(st.excitation.raw)+" ± "+escape(st.excitation.raw_uncertainty||"?")+" keV":""}</button>`).join("");
      box.querySelectorAll("button").forEach(b=>b.onclick=()=>detail(catalog.states.get(b.dataset.state)));
    }
    panel.querySelector(".nc-state-reset").onclick = () => { panel.querySelector("input").value = ""; panel.querySelector("select").value = "isomer"; populate(); panel.querySelector("input").focus(); };
    panel.querySelector("input").oninput=populate;panel.querySelector("select").onchange=populate;populate();detail(target||group[0]);
  }

  /* ---------- chain plot with error bars ---------- */
  const PQ = {
    me: [T.m_me, d => d.me, "MeV"], bea: [T.m_bea, d => d.BEA, "MeV/nucleon"], sn: ["Sₙ", d => d.sn, "MeV"], s2n: ["S₂ₙ", d => d.s2n, "MeV"],
    sp: ["Sₚ", d => d.sp, "MeV"], s2p: ["S₂ₚ", d => d.s2p, "MeV"], qbm: ["Q(β⁻)", d => d.qbm, "MeV"], qec: ["Q(EC)", d => d.qec, "MeV"],
    qa: ["Q(α)", d => d.qa, "MeV"], d2n: ["δ₂ₙ = S₂ₙ(N) − S₂ₙ(N+2)", d => d.d2n, "MeV"], dme: [T.m_dme, (d, r) => d.me?.e == null ? null : { v: d.me.e * 1000, e: 0, est: d.me.est }, "keV"],
    hl: ["log₁₀(T½ / s)", (d, r) => r[6] > -90 && r[6] !== 99 ? { v: r[6] * 1000, e: 0, est: false } : null, ""],
    d3n: ["Δₙ⁽³⁾ (pairing)", d => d.d3n, "MeV"], d3p: ["Δₚ⁽³⁾ (pairing)", d => d.d3p, "MeV"],
    d5n: ["Δₙ⁽⁵⁾ (pairing, 5-point)", d => d.d5n, "MeV"], d5p: ["Δₚ⁽⁵⁾ (pairing, 5-point)", d => d.d5p, "MeV"], d2p: ["δ₂ₚ = S₂ₚ(Z) − S₂ₚ(Z+2)", d => d.d2p, "MeV"],
    dmod: ["ME(AME) − ME(model)", (d, r) => dmod(r), "MeV"],
    vpn: ["δVpn", d => d.vpn, "MeV"], wig: ["W = δVpn − ½[δVpn(N±2)]", d => d.wig, "MeV"],
    beta2: ["β₂ (model)", d => d.beta2, ""],
  };
  pq.innerHTML = Object.entries(PQ).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("");
  pq.value = "s2n";
  const palette=['#167d45','#b94e00','#0095a8','#7352bd','#96610b','#0d807b','#c54646','#525d76','#668100','#874d70','#566bba'];
  const seriesMeta=k=>k==='ame'?{id:k,name:'AME2020',short:'AME2020',color:'#3b5bdb',shape:'circle'}:k==='loaded'?{id:k,name:T.loaded_only,short:'New',color:'#b41c81',shape:'diamond'}:k==='hybrid'?{id:k,name:T.loaded_hybrid,short:'New + AME2020',color:'#b41c81',shape:'square'}:{id:k,name:MOD[k]?.name||modelIndex?.[k]?.name||k,short:(MOD[k]?.name||k).split(' (')[0],color:palette[Object.keys(modelIndex||{}).indexOf(k)%palette.length],shape:'model'};
  let inputLegend=[];
  function inputLegendLines(w){
    const max=Math.max(15,Math.floor((w-80)/6.2)),lines=[];
    for(const entry of inputLegend.slice(0,8)){
      const words=entry.text.slice(0,400).split(/\s+/);let line='';for(const word of words){if(line&&(line+' '+word).length>max){lines.push(line);line='';}if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));}else line=line?line+' '+word:word;}if(line)lines.push(line);
    }if(inputLegend.length>8)lines.push('+ '+(inputLegend.length-8)+' · '+T.loaded_details);return lines;
  }
  const legendHeight=w=>16*(Math.ceil(visibleSeries.length/Math.max(1,Math.floor((w-80)/140)))+inputLegendLines(w).length);
  const plotGeom=(domain,w,h,sc=1)=>CP.geometry(domain,w,h,(plotPts.groups||[]).length>1,sc,legendHeight(w/sc));
  function humanInputs(p){
    return MM.provenance(p.valueObj,inputTable).map(x=>{
      const loaded=x.id.startsWith('loaded:')?inputTable.active.get(x.id.split(':')[1]):null;
      const r=M.get(Number(x.id.split(':').pop()));
      const name=loaded?loaded.label:r?String(r[0]+r[1])+r[2]:T.loaded_reference;
      return x.coefficient+' × '+name+(x.references.length?' ('+x.references.filter(Boolean).join('; ')+')':'');
    }).join('; ');
  }
  function pointDetail(p){
    const box=root.querySelector('.nc-point-detail');
    if(!p){box.textContent='';return;}
    const inputs=humanInputs(p);
    box.textContent=p.r[0]+p.r[1]+p.r[2]+' · '+p.source+' · '+p.y+' ± '+(p.e??'—')+' '+(p.unit||PQ[pq.value][2])+' · '+inputs;
  }
  function pointTable(){
    const d=root.querySelector('.nc-point-table');if(!d.open||!plotDomain)return;
    const ps=plotPts.concat(modPts).filter(p=>p.x>=plotDomain.x0&&p.x<=plotDomain.x1).slice(0,300);
    d.querySelector('div').innerHTML='<table><thead><tr><th>Z,N</th><th>x</th><th>'+escape(PQ[pq.value][0])+'</th><th>σ</th><th>Source / inputs</th></tr></thead><tbody>'+ps.map(p=>'<tr><td>'+p.r[0]+','+p.r[1]+'</td><td>'+p.x+'</td><td>'+p.y+(p.est?' #':'')+'</td><td>'+(p.e??'—')+'</td><td>'+escape(p.source)+'<br>'+escape(humanInputs(p))+'</td></tr>').join('')+'</tbody></table>';
  }
  root.querySelector('.nc-point-table').addEventListener('toggle',pointTable);
  const impact=root.querySelector('.nc-impact'),impactQ=root.querySelector('[name=nc-impact-quantity]'),impactM=root.querySelector('[name=nc-impact-model]');
  let impactRows=[],impactPage=0,impactRequest=0;
  const impactNames={...Object.fromEntries(Object.entries(PQ).map(([k,v])=>[k,v[0]])),BE:T.loaded_be,BEA:T.m_bea,ex:'Eₓ from ME'};
  window.ZGMassSurface.quantities.concat('ex').forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=impactNames[k];impactQ.append(o);});
  const impactModels=()=>impactM.value==='selected'?selectedModels():impactM.value==='all'?Object.keys(modelIndex||{}):[impactM.value];
  const impactFiltered=()=>impactRows.filter(r=>impactQ.value==='all'||r.quantity===impactQ.value);
  const impactFormat=v=>v?Number(v.v.toFixed(6))+(v.est?'#':'')+' ± '+(v.e==null?'?':Number(v.e.toPrecision(4))):'—';
  function impactRender(){
    if(!impact.open)return;
    const all=impactFiltered(),models=impactModels();impactPage=Math.max(0,Math.min(impactPage,Math.ceil(all.length/50)-1));
    impact.querySelector('.nc-impact-info').textContent=T.loaded_impact_count.replace('{rows}',all.length).replace('{nuclei}',new Set(all.map(r=>r.r[0]+'-'+r.r[1]+'-'+(r.state||'g'))).size)+(models.some(k=>!MOD[k])?' · '+(models.some(k=>modelErrors.has(k))?T.loaded_model_error:T.loaded_model_loading):'');
    impact.querySelector('tbody').innerHTML=all.slice(impactPage*50,impactPage*50+50).map(r=>'<tr><td>'+escape((r.r[0]+r.r[1])+r.r[2]+(r.state?'['+r.state+']':''))+'</td><td>'+escape(impactNames[r.quantity])+'<br>'+r.unit+'</td><td>'+escape(impactFormat(r.before))+'</td><td>'+escape(impactFormat(r.after))+'</td><td>'+escape(impactFormat(r.delta))+'</td><td>'+models.map(k=>{const v=r.state?null:derivedZN(r.r[0],r.r[1],k)[r.quantity];return escape(MOD[k]?.name||modelIndex?.[k]?.name||k)+': '+escape(impactFormat(v))+'<br>Δ(new − model): '+(v?Number((r.after.v-v.v).toPrecision(8)):'—');}).join('<br>')+'</td></tr>').join('');
    impact.querySelector('.nc-impact-pager').innerHTML=all.length>50?'<button type="button" data-impact-page="-1" '+(impactPage===0?'disabled':'')+'>←</button><span>'+(impactPage*50+1)+'–'+Math.min(all.length,impactPage*50+50)+' / '+all.length+'</span><button type="button" data-impact-page="1" '+((impactPage+1)*50>=all.length?'disabled':'')+'>→</button>':'';
  }
  function impactRebuild(){
    if(!impact.open||!inputTable)return;
    impactRows=window.ZGMassSurface.changes(rows,inputTable.active,derivedZN,MM.affected);
    for(const r of inputTable.active.values())if(r.state.source_state_index){
      const s=r.state,m=s.mass_excess,old=m.value==null?null:P.primitive('NUBASE2020:'+s.id,m.value,m.uncertainty,m.value_extrapolated),gs=get(s.Z,s.N),newgs=getter('hybrid')(s.Z,s.N),centre=[s.Z,s.N,s.element];
      for(const [quantity,before,after]of [['me',old,r.value],['ex',old&&gs?P.combine([1,old],[-1,gs]):null,newgs?P.combine([1,r.value],[-1,newgs]):null]])if(after)impactRows.push({r:centre,state:s.label,quantity,unit:'keV',before,after,delta:before?P.combine([1,after],[-1,before]):null});
    }
    impactRows.sort((a,b)=>a.r[0]-b.r[0]||a.r[1]-b.r[1]||a.quantity.localeCompare(b.quantity));impactRender();
  }
  async function impactLoad(){
    const seq=++impactRequest;impactRebuild();
    await Promise.allSettled(impactModels().map(k=>loadModels(k)));
    if(seq===impactRequest&&impact.open){impactRebuild();plotChain();}
  }
  root.querySelector('[data-mass=impact]').onclick=()=>{impactPage=0;impact.showModal();impactLoad();};
  impactQ.onchange=()=>{impactPage=0;impactRender();};impactM.onchange=()=>{impactPage=0;impactLoad();};
  impact.addEventListener('click',e=>{
    const page=e.target.closest('[data-impact-page]');if(page){impactPage+=+page.dataset.impactPage;impactRender();return;}
    const act=e.target.closest('[data-impact]')?.dataset.impact;if(act==='close')impact.close();
    if(act==='csv'){
      const models=impactModels(),out=[];
      for(const r of impactFiltered())for(const k of (models.length?models:[''])){const v=k&&!r.state?derivedZN(r.r[0],r.r[1],k)[r.quantity]:null;out.push([r.r[0]+r.r[1]+r.r[2],r.state||'g',r.r[0],r.r[1],r.quantity,r.unit,r.before?.v??'',r.before?.e??'',r.after.v,r.after.e??'',r.delta?.v??'',r.delta?.e??'',k,MOD[k]?.name||'',v?.v??'',v?r.after.v-v.v:'','unknown model uncertainty; independent experimental inputs, shared terms cancelled',JSON.stringify(MM.provenance(r.after,inputTable)),measured.hash()]);}
      X.csv(['nuclide','state','Z','N','quantity','unit','reference_value','reference_sigma','recalculated','recalculated_sigma','new_minus_reference','delta_sigma','model','model_name','model_value','new_minus_model','uncertainty_basis','input_provenance','input_table_sha256'],out,'affected-mass-quantities');
    }
  });
  function plotChain(r) {
    chain = r || chain; if (!chain) return;
    const ch = pchain.value, [Z,N] = chain, A=Z+N;
    if(ch!==activeChainType){
      rangeMemory[activeChainType]=Object.fromEntries(['c0','c1','x0','x1'].map(k=>[k,chainInput(k).value]));activeChainType=ch;
      Object.entries(CP.rangeFor(rangeMemory,ch,ch==='Z'?Z:ch==='N'?N:A)).forEach(([k,v])=>chainInput(k).value=v);
    }
    const q=PQ[pq.value],on=chainInput('range').checked,own=ch==='Z'?Z:ch==='N'?N:A;
    const cfrom=on&&axisNumber('c0')!=null?axisNumber('c0'):own,cto=on&&axisNumber('c1')!=null?axisNumber('c1'):cfrom;
    const xlo=on?axisNumber('x0'):null,xhi=on?axisNumber('x1'):null;
    const first=Math.max(0,Math.ceil(Math.min(cfrom,cto))),last=Math.min(400,Math.floor(Math.max(cfrom,cto))),total=Math.max(0,last-first+1),shown=Math.min(total,40);
    const group=(z,n)=>ch==='Z'?z:ch==='N'?n:z+n, xv=(z,n)=>ch==='Z'?n:z;
    const belongs=(z,n)=>group(z,n)>=first&&group(z,n)<first+shown;
    const inX=(z,n)=>(xlo==null||xv(z,n)>=xlo)&&(xhi==null||xv(z,n)<=xhi);
    const advanced=shown<=6,filter=chainInput('exp-filter').value,maxSigma=axisNumber('max-sigma');
    const hasNewGround=!!inputTable&&[...inputTable.active.values()].some(r=>!r.state.source_state_index);
    for(const s of ['loaded','hybrid']){
      const control=root.querySelector('[data-series='+s+']');
      control.disabled=!hasNewGround;
      control.parentElement.title=hasNewGround?'':T.loaded_requires_ground;
    }
    const passPoint=(r,v,source)=>{
      const [z,n]=r,ame=get(z,n),mass=source==='loaded'||source==='hybrid'?getter('hybrid')(z,n):ame;
      if(filter==='measured'&&(!ame||ame.est))return false;
      if(filter==='loaded'&&!inputTable?.active.has(z+'-'+n+'-0'))return false;
      if(filter==='affected'&&!MM.affected(q[1](derivedZN(z,n,'hybrid'),r)))return false;
      if(maxSigma!=null&&(!mass||mass.e==null||mass.e>maxSigma||maxSigma<0))return false;
      return true;
    };
    const makePoint=(r,s)=>{
      const v=q[1](derivedZN(r[0],r[1],s==='loaded'?'hybrid':s),r);if(!v||!Number.isFinite(v.v)||!passPoint(r,v,s))return null;
      return {r,x:xv(r[0],r[1]),y:v.v/1000,e:v.e==null?null:v.e/1000,est:!!v.est,g:group(r[0],r[1]),series:s,source:seriesMeta(s).name,valueObj:v};
    };
    plotPts=[];modPts=[];residualPts=[];bands=[];plotHover=null;pointDetail(null);
    const centres=new Map(rows.filter(r=>belongs(r[0],r[1])).map(r=>[key(r[0],r[1]),r]));
    for(const r of inputTable?.active.values()||[])if(!r.state.source_state_index&&belongs(r.state.Z,r.state.N)&&!centres.has(key(r.state.Z,r.state.N)))centres.set(key(r.state.Z,r.state.N),[r.state.Z,r.state.N,r.state.element,null,null,0,-97,'—','',null,'',[]]);
    for(const s of ['ame','loaded','hybrid']){
      if(!root.querySelector('[data-series='+s+']').checked||s!=='ame'&&(!advanced||!hasNewGround))continue;
      if(s!=='ame'&&['hl','beta2','dmod'].includes(pq.value))continue;
      for(const r of centres.values()){
        if(!inX(r[0],r[1])||s==='loaded'&&!inputTable?.active.has(r[0]+'-'+r[1]+'-0'))continue;
        const p=makePoint(r,s);if(p)plotPts.push(p);
      }
    }
    const modelKeys=selectedModels();
    const modelReason=modelKeys.length&&!advanced?T.loaded_cap:modelKeys.length&&['dme','hl','dmod'].includes(pq.value)?T.model_quantity:modelKeys.some(k=>modelErrors.has(k))?T.loaded_model_error:modelKeys.some(k=>!MOD[k])?T.loaded_model_loading:'';
    const modelNuclei=[];
    if(advanced&&!['dme','hl','dmod'].includes(pq.value))for(const mk of modelKeys){
      if(!MOD[mk])continue;
      for(const k of MOD[mk].map.keys()){
        const z=Math.floor(k/1000),n=k%1000;if(!belongs(z,n))continue;modelNuclei.push([z,n]);if(!inX(z,n))continue;
        const r=M.get(k)||Object.assign([z,n,(EL.find(e=>e[0]===z)||[z,'Z'+z])[1],null,null,0,-97,'—','',null,'',[]],{mo:true});
        const p=makePoint(r,mk);if(p)modPts.push(p);
      }
    }
    const sort=(a,b)=>a.series.localeCompare(b.series)||a.g-b.g||a.x-b.x;plotPts.sort(sort);modPts.sort(sort);
    plotPts.groups=[...new Set(plotPts.concat(modPts).map(p=>p.g))];
    visibleSeries=[...new Set(plotPts.concat(modPts).map(p=>p.series))].map(seriesMeta);
    root.querySelector('.nc-series-legend').innerHTML=visibleSeries.map(s=>'<span style="--series-color:'+s.color+'">'+escape(s.name)+' ('+plotPts.concat(modPts).filter(p=>p.series===s.id).length+')</span>').join('');
    inputLegend=measured?measured.legend().filter(x=>plotPts.some(p=>['loaded','hybrid'].includes(p.series)&&Object.keys(p.valueObj.terms||{}).some(id=>id.startsWith('loaded:'+x.id+':')))):[];
    root.querySelector('.nc-input-legend').textContent=inputLegend.map(x=>'◆ '+x.text).join(' · ');
    if(chainInput('band').checked){
      const b=new Map();for(const p of modPts){const k=p.g+':'+p.x;if(!b.has(k))b.set(k,[]);b.get(k).push(p);}
      bands=[...b.values()].filter(ps=>ps.length>=2).map(ps=>({g:ps[0].g,x:ps[0].x,lo:Math.min(...ps.map(p=>p.y)),hi:Math.max(...ps.map(p=>p.y)),count:ps.length})).sort((a,b)=>a.g-b.g||a.x-b.x);
    }
    if(chainInput('residual').checked&&!['hl','dme','dmod','beta2'].includes(pq.value)){
      for(const p of plotPts.concat(modPts).filter(p=>p.series!=='ame')){
        const a=q[1](derived(p.r),p.r);if(!a)continue;
        const d=P.combine([1,p.valueObj],[-1,a]),model=!['loaded','hybrid'].includes(p.series);
        residualPts.push({...p,y:d.v,e:model?a.e:d.e,valueObj:d,unit:pq.value==='bea'?'keV/nucleon':'keV',panel:'residual',source:p.source+' − AME2020'});
      }
    }
    root.querySelector('.nc-residual-panel').hidden=!chainInput('residual').checked;
    const label=(ch==='Z'?T.p_iso:ch==='N'?T.p_isot:T.p_isob)+': '+ch+' = '+first+(shown>1?'–'+(first+shown-1):'');
    pinfo.textContent=label+' · '+q[0]+' · '+(plotPts.length+modPts.length)+' '+T.points+' · '+T.chain_count.replace('{shown}',shown).replace('{total}',total)+(modelReason?' · '+modelReason:'')+(!advanced&&modelReason!==T.loaded_cap&&['loaded','hybrid'].some(s=>root.querySelector('[data-series='+s+']').checked)?' · '+T.loaded_cap:'')+' · '+bands.length+' '+T.loaded_band_points;
    const fullX=[...centres.values()].map(r=>xv(r[0],r[1])).concat(modelNuclei.map(([z,n])=>xv(z,n)));
    plotDomain=CP.chainExtent(plotPts,modPts,{xMode:chainInput('xscale').value,yMode:chainInput('yscale').value,fullX,errors:chainInput('axis-errors').checked,manual:Object.fromEntries(['x0','x1','y0','y1'].map(k=>[k,axisNumber('axis-'+k)]))});
    root.querySelector('.nc-axis-note').textContent=(plotDomain.warnings.length?T.axis_invalid+' · ':'')+T.axis_offscale;
    root.querySelector('.nc-manual-x').hidden=chainInput('xscale').value!=='manual';root.querySelector('.nc-manual-y').hidden=chainInput('yscale').value!=='manual';
    pc.setAttribute('aria-label',label+'; '+q[0]+'; x '+plotDomain.x0+'–'+plotDomain.x1+'; '+(plotPts.length+modPts.length)+' '+T.points);
    pointTable();resize();drawPlot();drawResidual();
  }
  function drawPlot(c = pg, Wd = pc._cw, Hd = pc._ch, sc = 1) {
    if (c === pg) pg.setTransform(pc.width / pc._cw, 0, 0, pc.height / pc._ch, 0, 0);
    c.clearRect(0, 0, Wd, Hd); c.fillStyle = sc > 1 ? "#fff" : "transparent"; if (sc > 1) c.fillRect(0, 0, Wd, Hd);
    if (!plotPts.length && !modPts.length) { c.fillStyle = "#888"; c.font = `${13 * sc}px system-ui`; c.fillText(chain ? T.loaded_no_points : T.p_hint, 20 * sc, 30 * sc); return; }
    const { x0,x1,y0,y1 } = plotDomain, geom = plotGeom(plotDomain,Wd,Hd,sc);
    const { L,R,T:Tp,B,px,py } = geom;
    c.strokeStyle = "rgba(127,127,160,.45)"; c.lineWidth = 0.45 * lineWidth() * sc; c.strokeRect(L, Tp, Wd - L - R, Hd - B - Tp);
    c.fillStyle = sc > 1 ? "#222" : ink; c.font = `${11 * sc}px system-ui`; c.textAlign = "center";
    const xTicks = Math.max(2, Math.min(12, Math.floor((Wd - L - R) / (45 * sc))));
    niceTicks(x0, x1, xTicks).filter(x => Number.isInteger(x)).forEach(x => { c.fillText(x, px(x), Hd - B + 15 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(px(x), Tp); c.lineTo(px(x), Hd - B); c.stroke(); c.restore(); });
    const ch = pchain.value; c.fillText(ch === "Z" ? "N" : "Z", (L + Wd - R) / 2, Hd - 8 * sc);
    c.textAlign = "right"; niceTicks(y0, y1, 6).forEach(y => { c.fillText(fmtTick(y), L - 6 * sc, py(y) + 4 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(L, py(y)); c.lineTo(Wd - R, py(y)); c.stroke(); c.restore(); });
    c.save(); c.translate(14 * sc, (Tp + Hd - B) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText(`${PQ[pq.value][0]}${PQ[pq.value][2] ? " (" + PQ[pq.value][2] + ")" : ""}`, 0, 0); c.restore();
    c.strokeStyle = "rgba(229,72,77,.35)"; c.setLineDash([4 * sc, 4 * sc]);
    MAGIC.forEach(m => { if (m > x0 && m < x1) { c.beginPath(); c.moveTo(px(m), Tp); c.lineTo(px(m), Hd - B); c.stroke(); } }); c.setLineDash([]);
    c.save(); c.beginPath(); c.rect(L,Tp,Wd-L-R,Hd-B-Tp); c.clip();
    const groups=plotPts.groups||[],multi=groups.length>1;
    const gcol=k=>multi?'hsl('+groups.indexOf(k)/groups.length*300+',75%,45%)':'#3b5bdb';
    const showLine=chainInput('lines').checked,showErr=chainInput('err').checked;
    if(bands.length){
      c.fillStyle='rgba(30,135,95,.17)';
      bands.forEach(b=>c.fillRect(px(b.x)-2*sc,py(b.hi),4*sc,Math.max(sc,py(b.lo)-py(b.hi))));
      for(let i=1;i<bands.length;i++){const a=bands[i-1],b=bands[i];if(a.g!==b.g||b.x-a.x!==1)continue;c.beginPath();c.moveTo(px(a.x),py(a.lo));c.lineTo(px(a.x),py(a.hi));c.lineTo(px(b.x),py(b.hi));c.lineTo(px(b.x),py(b.lo));c.closePath();c.fill();}
    }
    // Draw recalculation first: coincident unchanged AME lines retain their blue colour.
    const paintOrder=visibleSeries.slice().sort((a,b)=>(a.id==='loaded'?2:a.id==='ame'?1:0)-(b.id==='loaded'?2:b.id==='ame'?1:0));
    for(const s of paintOrder)for(const group of groups){
      const ps=plotPts.concat(modPts).filter(p=>p.series===s.id&&p.g===group);if(!ps.length)continue;
      const col=s.id==='ame'&&multi?gcol(group):s.color;
      c.strokeStyle=col;c.lineWidth=(s.shape==='model'?1:1.2)*lineWidth()*sc;c.setLineDash(s.shape==='model'?[6*sc,4*sc]:s.id==='hybrid'?[2*sc,3*sc]:[]);
      if(showLine&&s.id!=='loaded'){c.beginPath();ps.forEach((p,i)=>i&&CP.connects(ps[i-1],p)?c.lineTo(px(p.x),py(p.y)):c.moveTo(px(p.x),py(p.y)));c.stroke();}c.setLineDash([]);
      for(const p of ps){
        if(p.x<x0||p.x>x1)continue;
        const xx=px(p.x),yy=py(p.y),color=col;c.strokeStyle=color;c.fillStyle=color;
        if(p.y<y0||p.y>y1){const y=geom.clampY(p.y),sign=p.y>y1?1:-1;c.beginPath();c.moveTo(xx,y);c.lineTo(xx-4*sc,y+sign*7*sc);c.lineTo(xx+4*sc,y+sign*7*sc);c.closePath();c.fill();continue;}
        if(showErr&&p.e>0){c.beginPath();c.moveTo(xx,py(p.y-p.e));c.lineTo(xx,py(p.y+p.e));for(const ey of [p.y-p.e,p.y+p.e]){c.moveTo(xx-3*sc,py(ey));c.lineTo(xx+3*sc,py(ey));}c.stroke();}
        const radius=(s.shape==='model'?1.8:multi?2.8:3.6)*sc;c.beginPath();
        if(s.shape==='diamond'){c.moveTo(xx,yy-radius-1*sc);c.lineTo(xx+radius+1*sc,yy);c.lineTo(xx,yy+radius+1*sc);c.lineTo(xx-radius-1*sc,yy);c.closePath();}
        else if(s.shape==='square')c.rect(xx-radius,yy-radius,radius*2,radius*2);
        else c.arc(xx,yy,radius,0,6.283);
        // Recalculated squares outline the reference rather than painting over it.
        if(s.id==='hybrid')c.stroke();
        else if(p.est){c.fillStyle=sc>1?'#fff':getComputedStyle(document.documentElement).getPropertyValue('--zg-card').trim()||'#fff';c.fill();c.stroke();}else c.fill();
        if(chainInput('reference-ring').checked&&chain&&p.r[0]===chain[0]&&p.r[1]===chain[1]){c.strokeStyle='#e5484d';c.lineWidth=1.5*sc;c.beginPath();c.arc(xx,yy,7*sc,0,6.283);c.stroke();}
      }
    }
    c.restore();
    if(multi)groups.forEach(gk=>{const ps=plotPts.filter(p=>p.series==='ame'&&p.g===gk&&p.x>=x0&&p.x<=x1);if(!ps.length)return;const p=ps[ps.length-1];c.fillStyle=gcol(gk);c.font=10*sc+'px system-ui';c.textAlign='left';c.fillText(ch+'='+gk,Math.min(px(p.x)+5*sc,Wd-R+4*sc),geom.clampY(p.y)+3*sc);});
    const columns=Math.max(1,Math.floor((Wd/sc-80)/140));c.textAlign='left';c.font=10.5*sc+'px system-ui';
    visibleSeries.forEach((s,i)=>{const x=L+(i%columns)*140*sc,y=12*sc+Math.floor(i/columns)*16*sc;c.fillStyle=s.color;c.fillText(s.shape==='diamond'?'◆':s.shape==='square'?'□':s.shape==='model'?'– –':'●○',x,y);c.fillStyle=sc>1?'#222':ink;c.fillText(s.short,x+(s.id==='ame'?23:16)*sc,y);});
    c.fillStyle=sc>1?'#222':ink;inputLegendLines(Wd/sc).forEach((text,i)=>c.fillText(text,L,(12+16*Math.ceil(visibleSeries.length/columns)+i*16)*sc));
    if (plotHover && sc === 1 && plotHover.r) {
      const p = plotHover, value = p.e == null ? Number(p.y.toPrecision(7)).toString() : (([a,b])=>p.e>0?a+(p.est?'#':'')+' ± '+b:a)(fmtU(p.y,p.e));
      c.fillStyle=ink;c.textAlign='left';c.font='12px system-ui';
      const width=Wd-L-R-8, text=`${sup(p.r[0]+p.r[1])}${p.r[2]}: ${value}${p.source?' ('+p.source+')':''}`, lines=[];
      let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
      const left=Math.max(L+4,Math.min(px(p.x)+8,Wd-R-width)), top=Math.max(Tp+16,Math.min(geom.clampY(p.y)-10,Hd-B-lines.length*14));
      lines.forEach((s,i)=>c.fillText(s,left,top+i*14));
    }
  }
  function drawResidual(c=rg,width=pc._cw,height=Math.max(230,Math.min(320,width*.45)),exporting=false){
    if(!plotDomain||root.querySelector('.nc-residual-panel').hidden)return;
    if(c===rg){sizeCanvas(rc,width,height);c.setTransform(rc.width/width,0,0,rc.height/height,0,0);}c.clearRect(0,0,width,height);if(exporting){c.fillStyle='#fff';c.fillRect(0,0,width,height);}
    if(!residualPts.length){
      residualDomain=null;c.fillStyle=exporting?'#222':ink;c.font='12px system-ui';c.textAlign='left';
      const words=T.loaded_residual_empty.split(/\s+/);let line='',y=28;
      for(const word of words){
        const next=line?line+' '+word:word;
        if(line&&c.measureText(next).width>width-40){c.fillText(line,20,y);y+=18;line='';}
        if(c.measureText(word).width>width-40){for(const char of word){if(line&&c.measureText(line+char).width>width-40){c.fillText(line,20,y);y+=18;line='';}line+=char;}}
        else line=line?line+' '+word:word;
      }if(line)c.fillText(line,20,y);
      if(c===rg)rc.setAttribute('aria-label',T.loaded_residual_empty);return;
    }
    const domain={...CP.chainExtent(residualPts,[],{errors:chainInput('axis-errors').checked}),x0:plotDomain.x0,x1:plotDomain.x1};
    domain.y0=Math.min(domain.y0,0);domain.y1=Math.max(domain.y1,0);residualDomain=domain;
    const geom=CP.geometry(domain,width,height,(plotPts.groups||[]).length>1),{L,R,T:top,B,px,py}=geom;
    c.lineWidth=lineWidth();c.strokeStyle='rgba(127,127,160,.5)';c.strokeRect(L,top,width-L-R,height-B-top);c.fillStyle=exporting?'#222':ink;c.font='11px system-ui';
    c.textAlign='right';niceTicks(domain.y0,domain.y1,4).forEach(y=>c.fillText(fmtTick(y),L-5,py(y)+3));c.textAlign='center';
    niceTicks(domain.x0,domain.x1,Math.max(2,Math.floor((width-L-R)/50))).filter(Number.isInteger).forEach(x=>c.fillText(x,px(x),height-B+15));
    c.fillText('Δ ('+(pq.value==='bea'?'keV/nucleon':'keV')+') = series − AME2020',(L+width-R)/2,12);c.beginPath();c.moveTo(L,py(0));c.lineTo(width-R,py(0));c.stroke();
    c.save();c.beginPath();c.rect(L,top,width-L-R,height-B-top);c.clip();
    const showLine=chainInput('lines').checked,showErr=chainInput('err').checked;
    for(const s of visibleSeries.filter(s=>s.id!=='ame'))for(const group of plotPts.groups||[]){
      const ps=residualPts.filter(p=>p.series===s.id&&p.g===group);c.strokeStyle=s.color;c.fillStyle=s.color;c.setLineDash(s.shape==='model'?[5,3]:[]);
      if(showLine&&s.id!=='loaded'){c.beginPath();ps.forEach((p,i)=>i&&CP.connects(ps[i-1],p)?c.lineTo(px(p.x),py(p.y)):c.moveTo(px(p.x),py(p.y)));c.stroke();}c.setLineDash([]);
      ps.forEach(p=>{const x=px(p.x),y=py(p.y);c.beginPath();if(s.shape==='square')c.rect(x-2.5,y-2.5,5,5);else if(s.shape==='diamond'){c.moveTo(x,y-3.5);c.lineTo(x+3.5,y);c.lineTo(x,y+3.5);c.lineTo(x-3.5,y);c.closePath();}else c.arc(x,y,2.5,0,6.283);c.fillStyle=p.est?(exporting?'#fff':getComputedStyle(document.documentElement).getPropertyValue('--zg-card').trim()||'#fff'):s.color;if(s.id==='hybrid')c.stroke();else{c.fill();if(p.est)c.stroke();}if(showErr&&p.e>0){c.beginPath();c.moveTo(x,py(p.y-p.e));c.lineTo(x,py(p.y+p.e));c.stroke();}});
    }
    c.restore();if(c===rg)rc.setAttribute('aria-label','Δ = series − AME2020, keV; shared x '+domain.x0+'–'+domain.x1+'; '+residualPts.length+' points');
  }
  rc.addEventListener('mousemove',e=>{if(!residualDomain)return;const b=rc.getBoundingClientRect(),geom=CP.geometry(residualDomain,rc._cw,rc._ch,(plotPts.groups||[]).length>1);pointDetail(CP.nearest(residualPts,(e.clientX-b.left)*rc._cw/b.width,(e.clientY-b.top)*rc._ch/b.height,geom));});
  function plotAt(e) {
    if(!plotDomain)return null;const b=pc.getBoundingClientRect(),x=(e.clientX-b.left)*pc._cw/b.width,y=(e.clientY-b.top)*pc._ch/b.height,geom=plotGeom(plotDomain,pc._cw,pc._ch);
    if(x<geom.L||x>geom.right||y<geom.T||y>geom.bottom)return null;
    return CP.nearest(modPts.filter(p=>p.r).concat(plotPts),x,y,geom);
  }
  pc.addEventListener("mousemove", e => {
    plotHover = plotAt(e); pointDetail(plotHover);drawPlot();
  });
  pc.addEventListener('mouseleave',()=>{plotHover=null;drawPlot();});
  pc.addEventListener("click", e => { if(plotMoved)return;const point=plotAt(e); if (point) { pointDetail(point);pin = point.r; zoomTo(pin); showCard(pin); } });
  function applyPlotView(d){
    if(!d||!['x0','x1','y0','y1'].every(k=>Number.isFinite(d[k]))||d.x1-d.x0<1e-7||d.y1-d.y0<1e-12)return;
    for(const axis of ['x','y']){chainInput(axis+'scale').value='manual';for(const end of [0,1])chainInput('axis-'+axis+end).value=Number(d[axis+end].toPrecision(14));}plotChain();
  }
  function zoomPlot(f,x=.5,y=.5){if(plotDomain)applyPlotView(CP.zoomExtent(plotDomain,f,x,y));}
  function fitPlot(){chainInput('xscale').value='full';chainInput('yscale').value='all';plotChain();}
  root.querySelector('[data-plot=in]').onclick=()=>zoomPlot(1/1.5);
  root.querySelector('[data-plot=out]').onclick=()=>zoomPlot(1.5);
  root.querySelector('[data-plot=fit]').onclick=fitPlot;
  const plotPointers=new Map();let plotDrag=null,plotMoved=false,plotPinch=null;
  const plotPos=e=>{const b=pc.getBoundingClientRect(),g=plotGeom(plotDomain,pc._cw,pc._ch);return {x:(e.clientX-b.left)*pc._cw/b.width,y:(e.clientY-b.top)*pc._ch/b.height,g};};
  pc.addEventListener('wheel',e=>{if(!plotDomain)return;e.preventDefault();const {x,y,g}=plotPos(e);zoomPlot(Math.exp(Math.max(-.5,Math.min(.5,e.deltaY*.002))),(x-g.L)/(g.right-g.L),1-(y-g.T)/(g.bottom-g.T));},{passive:false});
  pc.addEventListener('pointerdown',e=>{
    if(!plotDomain||e.button>0)return;pc.setPointerCapture(e.pointerId);pc.focus({preventScroll:true});plotPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});plotMoved=false;
    plotDrag={x:e.clientX,y:e.clientY,d:{...plotDomain}};
    if(plotPointers.size===2){const [a,b]=[...plotPointers.values()];plotPinch={distance:Math.hypot(a.x-b.x,a.y-b.y),d:{...plotDomain}};plotMoved=true;}
  });
  pc.addEventListener('pointermove',e=>{
    if(!plotPointers.has(e.pointerId)||!plotDrag)return;plotPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(plotPointers.size===2&&plotPinch){const [a,b]=[...plotPointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance>1)applyPlotView(CP.zoomExtent(plotPinch.d,plotPinch.distance/distance));plotMoved=true;return;}
    const dx=e.clientX-plotDrag.x,dy=e.clientY-plotDrag.y;if(Math.abs(dx)+Math.abs(dy)<4&&!plotMoved)return;plotMoved=true;
    const box=pc.getBoundingClientRect(),g=plotGeom(plotDrag.d,pc._cw,pc._ch);
    applyPlotView(CP.panExtent(plotDrag.d,-dx*pc._cw/box.width/(g.right-g.L)*(plotDrag.d.x1-plotDrag.d.x0),dy*pc._ch/box.height/(g.bottom-g.T)*(plotDrag.d.y1-plotDrag.d.y0)));
  });
  function endPlotPointer(e){plotPointers.delete(e.pointerId);plotPinch=null;plotDrag=null;}
  pc.addEventListener('pointerup',endPlotPointer);pc.addEventListener('pointercancel',endPlotPointer);
  pc.addEventListener('dblclick',e=>{e.preventDefault();fitPlot();});
  pc.addEventListener('keydown',e=>{
    if(!plotDomain)return;const dx=(plotDomain.x1-plotDomain.x0)*.1,dy=(plotDomain.y1-plotDomain.y0)*.1;
    if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
    if(e.key==='+'||e.key==='=')zoomPlot(1/1.5);else if(e.key==='-')zoomPlot(1.5);else if(e.key==='Home')fitPlot();
    else if(e.key.startsWith('Arrow'))applyPlotView(CP.panExtent(plotDomain,e.key==='ArrowLeft'?-dx:e.key==='ArrowRight'?dx:0,e.key==='ArrowDown'?-dy:e.key==='ArrowUp'?dy:0));
  });
  pq.onchange = () => { if (["beta2", "dmod"].includes(pq.value) && !Object.keys(MOD).length) loadModels().then(() => plotChain()); plotChain(); };
  root.querySelectorAll(".nc-prange input, [name=nc-lines], [name=nc-err]").forEach(el => el.addEventListener("input", () => plotChain()));
  root.querySelectorAll('.nc-axes input,.nc-axes select').forEach(el=>el.addEventListener('input',()=>plotChain()));
  const rgb = root.querySelector("[name=nc-range]"); if (rgb) rgb.addEventListener("change", () => { root.querySelector(".nc-prange-in").hidden = !rgb.checked;
    if (rgb.checked && chain) { const ch = pchain.value, own = ch === "Z" ? chain[0] : ch === "N" ? chain[1] : chain[0] + chain[1], set = (n, v) => { const el = root.querySelector(`[name=${n}]`); if (el.value === "") el.value = v; };
      set("nc-c0", own); set("nc-c1", own); } plotChain(); });
  root.querySelectorAll('.nc-series input,.nc-experiment-filter input,.nc-experiment-filter select').forEach(el=>el.addEventListener('input',()=>plotChain()));
  pchain.onchange = () => plotChain();

  /* ---------- periodic table (mulberry) ---------- */
  function ptPos(Z) {
    if (Z === 1) return [1, 1]; if (Z === 2) return [1, 18];
    if (Z <= 10) return [2, Z <= 4 ? Z - 2 : Z + 8]; if (Z <= 18) return [3, Z <= 12 ? Z - 10 : Z];
    if (Z <= 36) return [4, Z - 18]; if (Z <= 54) return [5, Z - 36];
    if (Z >= 57 && Z <= 71) return [9, Z - 54]; if (Z >= 89 && Z <= 103) return [10, Z - 86];
    if (Z <= 86) return [6, Z <= 56 ? Z - 54 : Z - 68]; return [7, Z <= 88 ? Z - 86 : Z - 100];
  }
  function buildPT() {
    const count = {}; rows.forEach(r => { count[r[0]] = (count[r[0]] || 0) + 1; }); const max = Math.max(...Object.values(count));
    ptab.innerHTML = EL.map(([Z, s, n]) => { const [p, gc] = ptPos(Z), c = count[Z] || 0; return `<button type="button" style="grid-row:${p};grid-column:${gc};--k:${(c / max).toFixed(2)}" data-z="${Z}" title="${n} — ${c} ${T.known}"><small>${Z}</small><b>${s}</b><i>${c}</i></button>`; }).join("")
      + `<span class="nc-pt-note" style="grid-row:8;grid-column:3/19">${T.ptnote}</span>`;
    ptab.addEventListener("click", e => {
      const b = e.target.closest("[data-z]"); if (!b) return;
      const Z = +b.dataset.z, iso = rows.filter(r => r[0] === Z), st = iso.find(r => r[6] === 99) || iso[Math.floor(iso.length / 2)];
      if (st) { pin = st; zoomTo(st, 22); showCard(st); pchain.value = "Z"; plotChain(st); cv.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  /* ---------- exports ---------- */
  const csvRow = r => { const d = derived(r), f = o => o ? [String(o.v / 1000), o.e == null ? "" : String(o.e / 1000), o.est ? "#" : ""] : ["", "", ""];
    const m = src !== "ame" && MOD[src] ? MOD[src].map.get(key(r[0], r[1])) : null;
    return [r[0], r[1], r[0] + r[1], r[2], d.me ? d.me.v : "", d.me ? d.me.e : "", r[5] ? "#" : "", ...f(d.BEA), ...f(d.sn), ...f(d.s2n), ...f(d.sp), ...f(d.s2p), ...f(d.qbm), ...f(d.qec), ...f(d.qa), ...f(d.d3n), ...f(d.d3p), ...f(d.vpn), r[7], r[8], r[10], r[9] || "", r[11].length, ...(src !== "ame" ? [m ? m[0] : "", m ? m[1] / 1000 : ""] : [])]; };
  const csvHead = () => ["Z", "N", "A", "El", "ME_keV", "dME_keV", "ME_flag", ...["BE/A", "Sn", "S2n", "Sp", "S2p", "Qbeta-", "QEC", "Qalpha", "D3n", "D3p", "dVpn"].flatMap(k => [k + "_MeV", "d" + k + "_MeV", k + "_flag"]), "T1/2", "Jpi", "decay_modes", "discovery_year", "isomers", ...(src !== "ame" ? ["ME_keV_" + src, "beta2_" + src] : [])];
  root.querySelector("[name=nc-line-width]").onchange = () => { draw(); drawPlot(); drawResidual(); };
  root.querySelector("[data-nc=png]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = W() * sc; o.height = H() * sc; draw(o.getContext("2d"), o.width, o.height, sc); return o; }, "chart-of-nuclides", 6);
  root.querySelector("[data-nc=csv]").onclick = () => X.csv(csvHead(), rows.filter(pass).map(csvRow), "ame2020-nubase2020" + (filt === "all" ? "" : "-" + filt) + (src === "ame" ? "" : "-with-" + src));
  root.querySelector("[data-nc=video]").onclick = e => {
    const b = e.currentTarget, tour = [rows.find(r => r[0] === 50 && r[1] === 50), rows.find(r => r[0] === 55 && r[1] === 78), rows.find(r => r[0] === 82 && r[1] === 126)].filter(Boolean);
    const keep = [cv._cw, cv._ch], hi = () => { cv.width = Math.round(cv._cw * 3); cv.height = Math.round(cv._ch * 3); draw(); };
    hi();   /* record the tour at 3× the displayed size */
    X.record(cv, 9, "chart-of-nuclides-tour", on => { b.disabled = on; b.classList.toggle("is-rec", on); if (!on) { sizeCanvas(cv, keep[0], keep[1]); draw(); } });
    fit(); let i = 0; const next = () => { if (i < tour.length) { const r = tour[i++]; pin = r; zoomTo(r, 30, () => setTimeout(next, 900)); } else setTimeout(fit, 400); }; setTimeout(next, 600);
  };
  root.querySelector("[data-nc=ppng]").onclick = () => X.png(sc => {
    const o=document.createElement('canvas'),includeResidual=!root.querySelector('.nc-residual-panel').hidden;
    const residualHeight=includeResidual?Math.max(230,Math.min(320,pc._cw*.45)):0,gap=includeResidual?18:0;
    o.width=pc._cw*sc;o.height=(pc._ch+gap+residualHeight)*sc;
    const ctx=o.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,o.width,o.height);drawPlot(ctx,o.width,pc._ch*sc,sc);
    if(includeResidual){ctx.save();ctx.setTransform(sc,0,0,sc,0,(pc._ch+gap)*sc);drawResidual(ctx,pc._cw,residualHeight,true);ctx.restore();}
    return o;
  },"chain-"+pq.value,6);
  root.querySelector("[data-nc=pcsv]").onclick = () => {
    if(!plotDomain)return;
    const points=plotPts.concat(modPts).map(p=>({...p,panel:'value',unit:PQ[pq.value][2]})).concat(residualPts);
    X.csv(['panel','chain_type','chain','x','Z','N','A','element','quantity','unit','value','uncertainty','uncertainty_basis','flag','series','source','input_provenance','loaded_table_sha256','AME_version','model_source_url','model_raw_sha256','axis_x0','axis_x1','axis_y0','axis_y1'],
      points.map(p=>[p.panel,pchain.value,p.g,p.x,p.r[0],p.r[1],p.r[0]+p.r[1],p.r[2],pq.value,p.unit,p.y,p.e??'',MOD[p.series]?(p.panel==='residual'?'AME only; model uncertainty unavailable':'unavailable model uncertainty'):'independent primitives; shared terms cancelled',p.est?'#':'',p.series,p.source,JSON.stringify(MM.provenance(p.valueObj,inputTable)),measured.hash(),'AME2020/NUBASE2020',MOD[p.series]?.url||'',MOD[p.series]?.source?.raw_sha256||MOD[p.series]?.source?.sha256||'',plotDomain.x0,plotDomain.x1,p.panel==='value'?plotDomain.y0:residualDomain?.y0??'',p.panel==='value'?plotDomain.y1:residualDomain?.y1??'']),'chain-'+pq.value);
  };

  /* ---------- events ---------- */
  let drag = null, moved = false;
  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, view.x, view.y]; moved = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (drag) { const b = cv.getBoundingClientRect(), k = W() / b.width, dx = (e.clientX - drag[0]) * k, dy = (e.clientY - drag[1]) * k; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view.x = drag[2] + dx; view.y = drag[3] - dy; draw(); return; }
    hover = at(e); draw();
  });
  cv.addEventListener("pointerup", e => { if (!moved) { const r = at(e); if (r) { pin = r; zoomTo(r, Math.max(34, view.s)); showCard(r); plotChain(r); } } drag = null; });
  cv.addEventListener("wheel", e => {
    e.preventDefault(); const b = cv.getBoundingClientRect(), mx = (e.clientX - b.left) * W() / b.width, my = (e.clientY - b.top) * H() / b.height;
    const s2 = Math.max(2, Math.min(80, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))), k = s2 / view.s;
    view.x = mx - (mx - view.x) * k; view.y = (H() - my) - ((H() - my) - view.y) * k; view.s = s2; draw();
  }, { passive: false });
  const zoomBy = f => { const cx = W() / 2, cy = H() / 2, s2 = Math.max(2, Math.min(80, view.s * f)), k = s2 / view.s; view.x = cx - (cx - view.x) * k; view.y = (H() - cy) - ((H() - cy) - view.y) * k; view.s = s2; draw(); };
  root.querySelector("[data-nc=in]").onclick = () => zoomBy(1.4);
  root.querySelector("[data-nc=out]").onclick = () => zoomBy(1 / 1.4);
  root.querySelector("[data-nc=fit]").onclick = () => { pin = null; showCard(null); fit(); };
  root.querySelector("[data-nc=random]").onclick = () => { const p = rows.filter(pass), r = p[Math.floor(Math.random() * p.length)]; pin = r; zoomTo(r); showCard(r); plotChain(r); };
  sel.innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("");
  sel.onchange = () => { mode = sel.value; if (MODES[mode].need && !Object.keys(MOD).length) loadModels().then(() => { memo.clear(); drawLegend(); draw(); }); drawLegend(); draw(); };
  if (msel) msel.onchange = () => setSource(msel.value);
  if (ovl) ovl.addEventListener("change", e => { if (e.target.dataset.path && !Object.keys(PATHS).length) loadModels().then(draw); draw(); });
  fsel.innerHTML = Object.entries(FILTERS).map(([k, f]) => `<option value="${k}">${f[0]}</option>`).join("");
  fsel.onchange = () => { filt = fsel.value; draw(); root.querySelector(".nc-fcount").textContent = `${rows.filter(pass).length} ${T.nuclides}`; };
  search.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    try {
      const ion=catalog.resolve(search.value), atom=ion.atoms[0];
      if(ion.atoms.length!==1 || atom.count!==1) throw new Error(T.notfound);
      const r=M.get(key(atom.state.Z,atom.state.N)); if(!r) throw new Error(T.notfound);
      selectedState=atom.state.id; pin=r;zoomTo(r);showCard(r);plotChain(r);
    } catch(error) { search.setCustomValidity(error.message);search.reportValidity();setTimeout(()=>search.setCustomValidity(""),1500); }
  });
  /* canvases follow the browser window: width of the card, height limited to ~78 % of the window */
  const resize = () => {
    const w = Math.round(cv.getBoundingClientRect().width), h = Math.round(Math.min(w * 0.62, innerHeight * 0.78, 1100));
    if (w && (Math.abs(w - cv._cw) > 2 || Math.abs(h - cv._ch) > 2 || cv.width !== Math.round(w * DPR()))) { sizeCanvas(cv, w, h); fit(); }
    const pw = Math.round(pc.getBoundingClientRect().width);
    const ph = Math.round(Math.max(260,Math.min(pw * 0.5, innerHeight * 0.6, 700))+legendHeight(pw));
    if (pw && (Math.abs(pw - pc._cw) > 2 || Math.abs(ph - pc._ch) > 2 || pc.width !== Math.round(pw * DPR()))) { sizeCanvas(pc, pw, ph); drawPlot();drawResidual(); }
  };
  new ResizeObserver(resize).observe(cv); new ResizeObserver(resize).observe(pc); addEventListener("resize", resize);
  new MutationObserver(()=>{updateInk();draw();drawPlot();drawResidual();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});

  Promise.all([fetch(root.dataset.src).then(r=>{if(!r.ok)throw new Error("Nuclear data unavailable");return r.json();}),P.load(root.dataset.catalogue,root.dataset.ame)]).then(([d,c]) => {
    catalog=c;
    rows = d.rows; EL = d.elements; rows.forEach(r => M.set(key(r[0], r[1]), r));
    MEn = get(0, 1) || MEn; MEH = get(1, 0) || MEH; MEa = get(2, 2) || MEa;
    root.querySelector(".nc-count").textContent = `${rows.length} ${T.nuclides} · ${rows.reduce((a,r)=>a+r[11].length,0)} ${T.state_count}`;
    measured=window.ZGMeasuredMassUI.attach(root,T,catalog,get,table=>{inputTable=table;memo.clear();plotChain();draw();if(pin)showCard(pin);impactRebuild();});
    inputTable=measured.table();
    loadIndex().catch(modelFailure);
    buildPT(); drawLegend(); fit(); fsel.onchange();
    function openBookmark(){
      const params=new URLSearchParams(location.search),name=params.get('nuclide');if(!name)return false;
      const state=catalog.lookupState(name,params.get('state')||0),r=state&&M.get(key(state.Z,state.N));
      if(!r){card.hidden=false;card.textContent=T.notfound;return true;}
      search.value=name+(state.source_state_index?'['+state.label+']':'');selectedState=state.id;pin=r;zoomTo(r);showCard(r);plotChain(r);return true;
    }
    addEventListener('popstate',openBookmark);
    if(!openBookmark()){const sn=rows.find(r=>r[0]===50&&r[1]===50);pchain.value='Z';plotChain(sn);}
  }).catch(error => { console.error('Nuclear chart initialization failed',error);card.hidden = false; card.textContent = "Chart data could not load."; });
})();
