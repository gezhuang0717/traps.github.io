/* Interactive chart of nuclides — AME2020 / NUBASE2020 (static/data/nubase2020.json).
   Chart: zoom (wheel, ＋/−), drag to pan, click a box → zoom in + info card (all values with uncertainties;
   "#" = extrapolated / from systematics, as in AME and NUBASE). Colour modes, mass filters, search,
   mulberry periodic table. Chain plots (isotopic / isotonic / isobaric) with error bars.
   Exports: high-resolution PNG, CSV with uncertainties, WebM video (zoom tour) — via static/js/zg-export.js.
   Theory masses (FRDM 1995, HFB-17, HFB-D1M from static/data/massmodels.json, built by tools/make_mass_models.py):
   mass source select, drip lines (Sn, S2n, Sp, S2p = 0), r-/rp-process paths, model curves in chain plots,
   β2 deformation and ME(AME) − ME(model) colour modes. Pairing / p-n quantities: δVpn, Wigner indicator W, Δ(3)n, Δ(3)p.
   Labels: data-labels JSON (six languages) from layouts/_shortcodes/nuclide-chart.html + data/nuclide_chart_labels.yaml. */
(() => {
  const root = document.querySelector("[data-nuclide-chart]");
  if (!root) return;
  const T = JSON.parse(root.dataset.labels || "{}");
  const P=window.ZGPhysics; let catalog=null, selectedState=null;
  const unknown=T.state_unknown;
  const cardT=cardLabels(document.documentElement.lang);
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
  // Cached standalone HTML may predate the optional figure-style asset/host.
  // Keep the scientific chart and existing exports usable at baseline settings.
  const CP = window.ZGChainPlot, FS=typeof window.ZGFigureStyle?.controls==='function'?window.ZGFigureStyle:{
    controls:(_parent,{baseline})=>({get:()=>({...baseline}),valid:()=>true}),
    exportName:(_style,name)=>name,
    wrapText:(value,width,size,measure)=>{const lines=[];let part='';for(const char of String(value)){if(part&&(measure?measure(part+char):(part.length+1)*size*.62)>width){lines.push(part);part='';}part+=char;}if(part)lines.push(part);return lines.length?lines:[''];}
  }, rangeMemory = {};
  const chainStyleBase={titleSize:11,axisSize:11,tickSize:11,legendSize:10.5,markerDiameter:7.2,lineWidth:1,rasterWidth:5760,filename:''};
  let chainFigureStyle;
  const chainStyle=()=>chainFigureStyle?.get()||chainStyleBase;
  let activeChainType = pchain.value;
  const chainInput = name => root.querySelector(`[name=nc-${name}]`);
  const axisNumber = name => { const v = chainInput(name).value; return v === '' ? null : Number(v); };
  /* theory masses: MOD[key] = {name, ref, url, map: Map(key → [ME keV, β2·1000])}; src = "ame" or a model key */
  let MOD = {}, PATHS = {}, src = "ame", extraRows = [], modelIndex = null, indexLoading = null, modelLoads = new Map(), modelErrors = new Set(), measured = null, inputTable = null;
  let evaluated=null,evaluatedData=null,evaluatedWarning=false;
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
  const surface=window.ZGMassSurface.create(s=>getter(s),{get MEn(){return MEn;},get MEH(){return MEH;},get MEa(){return MEa;}},(s,z,n)=>{const b=MOD[s]?.map.get(key(z,n))?.[1];return b==null?null:{v:b,e:null,est:false};},(z,n,q)=>evaluated?.get(z,n,q));
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

  /* Experimental overlays (charge radii, moments, B(E2), E(2+)) and AME edition comparisons, loaded on demand from the compact tables
     built by tools/make_nuclear_properties.py and tools/make_chart_overlays.py. Unknown values stay null; nothing is invented. */
  const AUX = { props: null, be2: null, ed: null }, auxJobs = {}, auxBase = root.dataset.aux || "";
  let EDSTATS = null;  /* meta.stats of the edition table: measured / estimated masses and NUBASE isomers per AME edition */
  const auxFile = { props: "nuclear-properties-compact.json", be2: "be2-compact.json", ed: "ame-editions-compact.json" };
  function auxBuild(name, j) {
    const c = Object.fromEntries(j.columns.map((n, i) => [n, i]));
    if (name === "props") {
      const m = new Map();
      for (const x of j.rows) { const k = key(x[c.Z], x[c.A] - x[c.Z]); if (m.has(k) && x[c.kind] === "u") continue; m.set(k, { r: x[c.r_fm], sr: x[c.sigma_r_fm], mu: x[c.mu_muN], smu: x[c.sigma_mu_muN], Q: x[c.Q_b], sQ: x[c.sigma_Q_b], jp: x[c.Jpi] }); }
      return m;
    }
    if (name === "be2") return new Map(j.rows.map(x => [key(x[c.Z], x[c.N]), { E: x[c.E2_keV], sE: x[c.sigma_E2_keV], b: x[c.be2_up_e2b2], sb: x[c.sigma_be2_up_e2b2], beta: x[c.beta2], sbeta: x[c.sigma_beta2], year: x[c.evaluation_year] }]));
    EDSTATS = (j.meta && j.meta.stats) || null;
    return Object.fromEntries(Object.entries(j.editions).map(([e, rows]) => [e, new Map(rows.map(x => [key(x[0], x[1]), [x[2], x[3], x[4]]]))]));
  }
  function loadAux(name) {
    if (AUX[name]) return Promise.resolve();
    return auxJobs[name] || (auxJobs[name] = fetch(auxBase + auxFile[name]).then(r => { if (!r.ok) throw Error("overlay data " + r.status); return r.json(); }).then(j => { AUX[name] = auxBuild(name, j); autoCache.clear(); if (name === "ed") titleEditionOptions(); }).catch(e => { delete auxJobs[name]; const box = root.querySelector(".nc-model-error"); if (box) box.textContent = (T.aux_error || "Could not load the overlay data.") + " " + e.message; throw e; }));
  }
  const auxGet = (name, r) => AUX[name] && AUX[name].get(key(r[0], r[1]));
  const edDiff = (ed, r) => {
    const m = AUX.ed && AUX.ed[ed] && AUX.ed[ed].get(key(r[0], r[1]));
    if (!m || r[3] == null) return null;
    const known = r[4] != null && m[1] != null;
    return { v: r[3] - m[0], e: known ? Math.hypot(r[4], m[1]) : null, est: !!(r[5] || m[2]) };
  };
  const USER = { map: new Map(), column: "", rows: [], parsed: null, typed: null };  /* independent typed observable; mass adoption is explicit */
  let manualRange = null;  /* {lo, hi} set by the visitor; null = the default range of the quantity */
  /* Default scalar colour range: every finite available value, including extrema. The 2–98% window is an explicit opt-in button.
     Do not cache a fallback before an overlay/model table has loaded. Manual bounds always take precedence. */
  const autoCache = new Map();
  function autoBounds(m) {
    const id = src + "|" + m.label, hit = autoCache.get(id); if (hit) return hit;
    let lo = Infinity, hi = -Infinity;
    for (const r of allRows()) { const v = m.v(r); if (v != null && Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (!(hi >= lo)) return null;
    if (hi === lo) { lo -= 0.5; hi += 0.5; }
    const b = { lo, hi }; autoCache.set(id, b); return b;
  }
  const bounds = m => manualRange || (m.v && autoBounds(m)) || { lo: m.lo, hi: m.hi };
  /* Display/prefill limits outwards, so checking Manual never clips a rounded data extremum. */
  function rangeLabel(value, upper = false) {
    if (!Number.isFinite(value) || value === 0) return String(value);
    const step = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 5);
    if (!(step > 0) || !Number.isFinite(step)) return String(value);
    const rounded = (upper ? Math.ceil(value / step) : Math.floor(value / step)) * step;
    return String(Number(rounded.toPrecision(7)));
  }
  const pick = (name, f) => r => { const a = auxGet(name, r); const v = a ? f(a) : null; return v == null || Number.isNaN(v) ? null : v; };
  const logPos = x => x > 0 ? Math.log10(x) : null;
  /* discrete classes with a fixed legend (ground-state spin, mass precision, model deviation), parity filters and view options */
  const CL = window.ZGChartClasses, WHITE = "#ffffff";
  let emptyColour = "#e5e7eb", zpar = "all", npar = "all", isoMark = false;
  let classOn = false, classN = 9, classMethod = "equal", classText = "", classScheme = "default", classState = null, isolateMode = "";  /* divided colour bar (off = the continuous bar) */
  const isolate = new Set();
  let syncClassControls = () => {}, syncRangeControls = () => {};
  const syncColourControls = () => { syncClassControls(); syncRangeControls(); };
  const binMode = (label, of, list, none, extra = {}) => ({ label, f: r => { const k = of(r); return k == null ? (none ? none[0] : "#e5e7eb") : list[k][0]; }, bins: { of, list, none }, ...extra });
  const reactionDefinitions={
    q2bm:{label:'Q(2β⁻)',formula:'ME(Z,N) − ME(Z+2,N−2)',terms:[[0,0,1],[2,-2,-1]]},
    q2ec:{label:'Q(2EC)',formula:'ME(Z,N) − ME(Z−2,N+2)',terms:[[0,0,1],[-2,2,-1]]},
    qecbp:{label:'Q(ECβ⁺)',formula:'Q(2EC) − 2mₑc²',terms:[[0,0,1],[-2,2,-1]]},
    q2bp:{label:'Q(2β⁺)',formula:'Q(2EC) − 4mₑc²',terms:[[0,0,1],[-2,2,-1]]},
    q4bm:{label:'Q(4β⁻)',formula:'ME(Z,N) − ME(Z+4,N−4)',terms:[[0,0,1],[4,-4,-1]]},
    qep:{label:'Q(ECp)',formula:'ME(Z,N) − ME(Z−2,N+1) − ME(¹H)',terms:[[0,0,1],[-2,1,-1]]},
    qbmn:{label:'Q(β⁻n)',formula:'ME(Z,N) − ME(Z+1,N−2) − ME(n)',terms:[[0,0,1],[1,-2,-1]]},
    qda:{label:'Q(d,α)',formula:'ME(Z,N) + ME(²H) − ME(Z−1,N−1) − ME(⁴He)',terms:[[0,0,1],[-1,-1,-1]]},
    qpa:{label:'Q(p,α)',formula:'ME(Z,N) + ME(¹H) − ME(Z−1,N−2) − ME(⁴He)',terms:[[0,0,1],[-1,-2,-1]]},
    qna:{label:'Q(n,α)',formula:'ME(Z,N) + ME(n) − ME(Z−2,N−1) − ME(⁴He)',terms:[[0,0,1],[-2,-1,-1]]}
  };
  const MODES = {
    decay: { label: T.m_decay, f: r => DC[decayClass(r)] },
    hl: { label: T.m_hl, f: r => r[6] === 99 ? "#111827" : r[6] <= -98 ? "#e2e8f0" : ramp((r[6] + 9) / 29), range: ["1 ns", "10²⁰ s"] },
    be: { label: T.mf_be, v: r => mv(D(r).BE), lo: 0, hi: 2100, u: "MeV" },
    bea: { label: T.m_bea, v: r => mv(D(r).BEA), lo: 7.0, hi: 8.8, u: "MeV/nucleon" },
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
    s2p: { label: T.mf_s2p, v: r => mv(D(r).s2p), lo: 0, hi: 35, u: "MeV" },
    qec: { label: "Q(EC)", v: r => mv(D(r).qec), lo: 0, hi: 20, u: "MeV" },
    d2n: { label: "δ₂ₙ (shell gap)", v: r => mv(D(r).d2n), lo: 0, hi: 6, u: "MeV" },
    d2p: { label: "δ₂ₚ (shell gap)", v: r => mv(D(r).d2p), lo: 0, hi: 6, u: "MeV" },
    vpn: { label: T.m_vpn, v: r => mv(D(r).vpn), lo: 0, hi: 1.2, u: "MeV" },
    wig: { label: T.wig, v: r => mv(D(r).wig), lo: -0.4, hi: 0.4, u: "MeV", div: true },
    d3p: { label: "Δₚ⁽³⁾", v: r => mv(D(r).d3p), lo: 0, hi: 2.5, u: "MeV" },
    d5n: { label: "Δₙ⁽⁵⁾", v: r => mv(D(r).d5n), lo: 0, hi: 2.5, u: "MeV" },
    d5p: { label: "Δₚ⁽⁵⁾", v: r => mv(D(r).d5p), lo: 0, hi: 2.5, u: "MeV" },
    d3n: { label: T.m_d3n, v: r => mv(D(r).d3n), lo: 0, hi: 2.5, u: "MeV" },
    beta2: { label: T.m_beta2, need: true, v: r => { const v = MOD[modelKey()] && MOD[modelKey()].map.get(key(r[0], r[1])); return v && v[1] != null ? v[1] / 1000 : null; }, lo: -0.3, hi: 0.4, div: true },
    dmod: { label: T.m_dmod, need: true, v: r => mv(dmod(r)), lo: -3, hi: 3, u: "MeV", div: true },
    rms: { label: T.m_rms, aux: "props", v: pick("props", a => a.r), lo: 1.5, hi: 6, u: "fm" },
    mu: { label: T.m_mu, aux: "props", v: pick("props", a => a.mu), lo: -5, hi: 5, u: "μN", div: true },
    qmom: { label: T.m_qmom, aux: "props", v: pick("props", a => a.Q), lo: -1.5, hi: 1.5, u: "b", div: true },
    e2p: { label: T.m_e2p, aux: "be2", v: pick("be2", a => logPos(a.E)), lo: 1.5, hi: 3.7, rng: ["32 keV", "5 MeV"] },
    be2: { label: T.m_be2, aux: "be2", v: pick("be2", a => logPos(a.b)), lo: -3, hi: 1.3, rng: ["10⁻³ e²b²", "20 e²b²"] },
    beta2e: { label: T.m_beta2e, aux: "be2", v: pick("be2", a => a.beta), lo: 0, hi: 0.5 },
    dame16: { label: T.m_dame16, aux: "ed", v: r => { const d = edDiff("ame2016", r); return d ? d.v : null; }, lo: -30, hi: 30, u: "keV", div: true, auto: true },
    dame12: { label: T.m_dame12, aux: "ed", v: r => { const d = edDiff("ame2012", r); return d ? d.v : null; }, lo: -30, hi: 30, u: "keV", div: true, auto: true },
    mine: { label: T.m_mine, user: true, v: r => { const x = USER.map.get(key(r[0], r[1])); return x === undefined ? null : x; }, lo: 0, hi: 1 },
    dame03: { label: T.m_dame03, aux: "ed", v: r => { const d = edDiff("ame2003", r); return d ? d.v : null; }, lo: -30, hi: 30, u: "keV", div: true, auto: true },
    dame95: { label: T.m_dame95, aux: "ed", v: r => { const d = edDiff("ame1995", r); return d ? d.v : null; }, lo: -30, hi: 30, u: "keV", div: true, auto: true },
    spinb: binMode(T.m_spinb, r => CL.spinClass(r[8]), CL.SPIN_LABELS.map((l, i) => [CL.SPIN_COLOURS[i], l]), [WHITE, T.lg_uncertain]),
    precb: binMode(T.m_precb, r => CL.precisionClass(r[4], r[5], r[3] != null), [...CL.PRECISION_LABELS.map((l, i) => [CL.PRECISION_COLOURS[i], l]), ["#d946ef", T.extrap], [WHITE, T.lg_unknown]], null),
    dmodb: binMode(T.m_dmodb, r => { const x = dmod(r); return CL.deviationClass(x ? x.v : null); }, CL.DEVIATION_LABELS.map((l, i) => [CL.DEVIATION_COLOURS[i], "ΔME " + l]), [WHITE, T.lg_nodata], { need: true }),
  };
  for(const [name,q]of Object.entries(reactionDefinitions))MODES[name]={label:q.label,v:r=>mv(D(r)[name]),lo:-40,hi:40,u:'MeV',div:true};
  const extraFilters=window.ZGMassSurface.filters;
  const filterLabel=(name,f)=>name+' · '+T['mf_'+f.kind];
  for(const [name,f]of Object.entries(extraFilters))MODES[name]={label:filterLabel(name,f),v:r=>mv(D(r)[name]),lo:-3,hi:3,u:'MeV',div:true};
  const FILTERS = {
    all: [T.fl_all, () => true], missing: [T.fl_missing,r=>r[3]==null], unknown_unc: [T.fl_unknown_unc,r=>r[4]==null], known_unc: [T.fl_known_unc,r=>r[3]!=null&&r[4]!=null], state_hash: [T.fl_state_hash,r=>catalog && (catalog.groups.get(r[2].toLowerCase()+(r[0]+r[1]))||[]).some(s=>s.excitation.value_extrapolated)], meas: [T.fl_meas, r => r[3] != null && !r[5]], extr: [T.fl_extr, r => !!r[5]],
    d1: ["δm < 1 keV", r => r[4] != null && !r[5] && r[4] < 1], d10: ["δm < 10 keV", r => r[4] != null && !r[5] && r[4] < 10], d100: ["δm < 100 keV", r => r[4] != null && !r[5] && r[4] < 100],
    stable: [T.fl_stable, r => r[6] === 99], hl: [T.fl_hl, r => r[6] > -90 && r[6] !== 99], iso: [T.fl_iso, r => r[11].length > 0],
    magic: [T.fl_magic, r => MAGIC.includes(r[0]) || MAGIC.includes(r[1])], nz: ["N = Z", r => r[0] === r[1]],
    nz1: ["|N − Z| = 1", r => Math.abs(r[1] - r[0]) === 1], nz2: ["|N − Z| ≤ 2", r => Math.abs(r[1] - r[0]) <= 2], prich: ["N < Z", r => r[1] < r[0]],
    ee: [T.fl_ee, r => r[0] % 2 === 0 && r[1] % 2 === 0], eo: [T.fl_eo, r => r[0] % 2 === 0 && r[1] % 2 === 1],
    oe: [T.fl_oe, r => r[0] % 2 === 1 && r[1] % 2 === 0], oo: [T.fl_oo, r => r[0] % 2 === 1 && r[1] % 2 === 1],
    oddA: [T.fl_oddA || "odd A", r => (r[0] + r[1]) % 2 === 1], evenA: [T.fl_evenA || "even A", r => (r[0] + r[1]) % 2 === 0],
    p3: [T.fl_p3 || "3-point Δ⁽³⁾ available", r => derived(r).d3n != null], p5: [T.fl_p5 || "5-point Δ⁽⁵⁾ available", r => derived(r).d5n != null],
    unb: [T.fl_unb || "particle-unbound (Sₙ or Sₚ < 0)", r => { const d = derived(r); return (d.sn && d.sn.v < 0) || (d.sp && d.sp.v < 0); }],
    lowq: [T.fl_lowq || "Q(β) < 1 MeV", r => { const d = derived(r); return (d.qbm && d.qbm.v > 0 && d.qbm.v < 1000) || (d.qec && d.qec.v > 0 && d.qec.v < 1000); }],
  };
  const pass = r => (r.mo ? filt === "all" : FILTERS[filt][1](r)) && CL.parityOk(r[0], zpar) && CL.parityOk(r[1], npar);
  const allRows = () => src === "ame" ? rows : rows.concat(extraRows);
  function colour(r) {
    const m = MODES[mode]; if (m.f) return m.f(r);
    let v = m.v(r); if (v == null) return emptyColour;
    if (classOn && classState && classState.mode === mode) v = classState.centres[CL.classIndex(v, classState.edges)];
    return colourOfValue(m, v);
  }
  function colourOfValue(m, v) {
    const bd = bounds(m), x = (v - bd.lo) / (bd.hi - bd.lo), zero = (0 - bd.lo) / (bd.hi - bd.lo);
    if (m.div) { const t = Math.max(0, Math.min(1, x)), a = t < zero ? (zero > 0 ? (zero - t) / zero : 0) : (zero < 1 ? (t - zero) / (1 - zero) : 0); return t < zero ? `hsl(220,80%,${96 - 50 * Math.min(1, a)}%)` : `hsl(0,80%,${96 - 50 * Math.min(1, a)}%)`; }
    return classOn && classScheme === "viridis" ? CL.viridis(x) : ramp(x);
  }
  function colourGradient(m) {
    const bd = bounds(m), steps = Array.from({ length: 17 }, (_, i) => i / 16);
    if (m.div && bd.lo < 0 && bd.hi > 0) steps.push(-bd.lo / (bd.hi - bd.lo));
    return 'linear-gradient(90deg,' + [...new Set(steps)].sort((a,b) => a-b).map(t => colourOfValue(m, bd.lo + (bd.hi - bd.lo) * t) + ' ' + (100*t) + '%').join(',') + ')';
  }
  function drawLegend() {
    const m = MODES[mode];
    if (mode === "decay") legend.innerHTML = [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]].map(([k, l]) => `<span><i style="background:${DC[k]}"></i>${l}</span>`).join("");
    else if (mode === "est") legend.innerHTML = `<span><i style="background:#0ea5e9"></i>${T.measured}</span><span><i style="background:#f59e0b"></i>${T.extrap}</span>`;
    else if (mode === "iso") legend.innerHTML = [0, 1, 2, 3].map(n => `<span><i style="background:${["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][n]}"></i>${n}${n === 3 ? "+" : ""}</span>`).join("");
    else if (mode === "eo") legend.innerHTML = [["#0ea5e9", T.fl_ee], ["#f59e0b", T.fl_eo], ["#22c55e", T.fl_oe], ["#ef4444", T.fl_oo]].map(([c, l]) => `<span><i style="background:${c}"></i>${escape(l)}</span>`).join("");
    else if (m.bins) legend.innerHTML = legendItems([...m.bins.list, ...(m.bins.none ? [m.bins.none] : [])].map(([c, l], i) => ({ key: i === m.bins.list.length ? "none" : i, c, l }))) + (m.need && MOD[modelKey()] ? `<span class="nc-mnote">${escape(MOD[modelKey()].name)}</span>` : "");
    else if (classOn && m.v) legend.innerHTML = classLegend(m);
    else { const bd = bounds(m), numeric = !!m.v, lo = numeric ? rangeLabel(bd.lo) : m.range ? m.range[0] : m.rng ? m.rng[0] : m.lo, hi = numeric ? rangeLabel(bd.hi, true) : m.range ? m.range[1] : m.rng ? m.rng[1] : m.hi; legend.innerHTML = `<span>${lo}</span><span class="nc-ramp${m.div ? " nc-ramp-div" : ""}" style="background:${colourGradient(m)}"></span><span>${hi} ${m.u || ""}</span>` + (m.need || src !== "ame" ? `<span class="nc-mnote">${MOD[modelKey()] ? MOD[modelKey()].name : ""}</span>` : ""); }
     drawStats();
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
    const big = s >= 26 * sc, mid = s >= 14 * sc, iso = activeIso();
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const r of allRows()) {
      const [x, y] = P(r[0], r[1]);
      if (x < -s || y < -s || x > Wd || y > Hd) continue;
      const ok = pass(r) && (!iso || iso.has(classOf(r))); c.globalAlpha = ok ? (r.mo ? 0.5 : 1) : 0.1;
      const fill = r.mo && (mode === "decay" || MODES[mode].f) ? "#cbd5e1" : colour(r); c.fillStyle = fill; c.fillRect(x, y, s - (s > 3 ? sc : 0.3), s - (s > 3 ? sc : 0.3));
      if (isoMark && ok && r[11].length && s >= 5 * sc) { const t = Math.min(s * 0.38, 9 * sc), e = s > 3 ? sc : 0.3; c.fillStyle = "#7c3aed"; c.beginPath(); c.moveTo(x + s - e - t, y); c.lineTo(x + s - e, y); c.lineTo(x + s - e, y + t); c.closePath(); c.fill(); }
      if(ok&&s>=10*sc&&measured?.marked(r[0],r[1])){c.strokeStyle="#a71984";c.lineWidth=2*sc;c.strokeRect(x+sc,y+sc,s-3*sc,s-3*sc);}
      if (mid && ok) {
        const dark = r[6] === 99 || ["bm", "sf", "n"].includes(decayClass(r)) && mode === "decay" || (MODES[mode].bins && darkHex(fill));
        c.fillStyle = dark ? "#fff" : "#111";
        c.font = `${Math.min(14 * sc, s * 0.28)}px system-ui`;
        c.fillText(sup(r[0] + r[1]) + r[2] + (r[5] ? "#" : "") + (r.mo ? "*" : "") + (measured?.marked(r[0],r[1]) ? "★" : ""), x + s / 2, y + s * (big ? 0.32 : 0.5));
        if (big && !r.mo) { c.font = `${Math.min(11 * sc, s * 0.2)}px system-ui`; c.fillText(r[7].replace("stable", "★"), x + s / 2, y + s * 0.68); }
        if (s >= 66 * sc && !r.mo) { c.font = `${Math.min(9.5 * sc, s * 0.13)}px system-ui`; if (r[3] != null) c.fillText(meText(r), x + s / 2, y + s * 0.82); const th = src !== "ame" ? getM(src, r[0], r[1]) : null; if (th) c.fillText("th " + Math.round(th.v), x + s / 2, y + s * 0.93); }
      }
    }
    c.globalAlpha = 1;
    drawOverlays(c, v, Hd, sc);
    [[hover, ink], [pin, "#e5484d"]].forEach(([r, col]) => { if (!r || sc > 1 && r === hover) return; const [x, y] = P(r[0], r[1]); c.strokeStyle = col; c.lineWidth = 2 * sc; c.strokeRect(x - sc, y - sc, s + sc, s + sc); });
    c.fillStyle = sc > 1 ? '#222' : ink; c.font = `${12 * sc}px system-ui`; c.textAlign = "left"; c.fillText("N →", Wd - 36 * sc, Hd - 8 * sc); c.fillText("Z ↑", 6 * sc, 14 * sc);
  }
  /* ---------- label boxes: summary of the plotted values, AME edition hint and edition table ---------- */
  const statBox = root.querySelector(".nc-statbox"), edHint = root.querySelector(".nc-edhint"), edBox = root.querySelector(".nc-editions"), edTable = root.querySelector(".nc-ed-table");
  const EDMODE = { dame95: "ame1995", dame03: "ame2003", dame12: "ame2012", dame16: "ame2016" };
  const RNG_UNIT = { e2p: "keV", be2: "e²b²", dme: "keV" };   /* colour modes that store log10 of the quantity */
  const CATS = {
    decay: { of: r => decayClass(r), list: [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]] },
    est: { of: r => r[3] == null ? "none" : r[5] ? "x" : "m", list: [["m", T.measured], ["x", T.extrap]] },
    iso: { of: r => Math.min(3, r[11].length), list: [[0, "0"], [1, "1"], [2, "2"], [3, "3+"]] },
    eo: { of: r => (r[0] % 2) * 2 + (r[1] % 2), list: [[0, T.fl_ee], [1, T.fl_eo], [2, T.fl_oe], [3, T.fl_oo]] },
  };
  const nuc = r => sup(r[0] + r[1]) + r[2];
  /* ---- divided colour bar: class edges, legend with counts, click to isolate ---- */
  const rngUnit = m => m.rng ? RNG_UNIT[mode] || "" : m.u || "";
  function refreshClassState() {
    const m = MODES[mode]; classState = null;
    if (!classOn || m.f || !m.v) return;
    const bd = bounds(m); let edges;
    if (classMethod === "manual") { edges = CL.parseEdges(classText); if (m.rng) edges = edges.filter(e => e > 0).map(Math.log10); }
    else if (classMethod === "quantile") edges = CL.quantileEdges(allRows().filter(pass).map(r => m.v(r)).filter(Number.isFinite), classN);
    else edges = CL.equalEdges(bd.lo, bd.hi, classN, !!m.div);
    if (edges.length) classState = { mode, edges, centres: CL.classCentres(edges, bd.lo, bd.hi) };
  }
  function legendItems(items) {
    return items.map(it => `<button type="button" class="nc-lg" data-class="${it.key}" aria-pressed="false" title="${escape(T.cl_isolate)}"><i style="background:${it.c};outline:1px solid rgba(100,116,139,.55)"></i>${escape(it.l)} <small data-count="${it.key}"></small></button>`).join("")
      + `<button type="button" class="nc-lg nc-lg-all" data-class="all" hidden>${escape(T.cl_show_all)}</button>`;
  }
  function classLegend(m) {
    refreshClassState();
    const st = classState; if (!st) return `<span class="nc-mnote">${escape(T.cl_none)}</span>`;
    const f = v => String(Number((m.rng ? Math.pow(10, v) : v).toPrecision(4))), unit = rngUnit(m), labels = CL.classLabels(st.edges, f);
    return legendItems(labels.map((l, i) => ({ key: i, c: colourOfValue(m, st.centres[i]), l: l + (unit ? " " + unit : "") })));
  }
  const activeIso = () => isolateMode === mode && isolate.size ? isolate : null;
  function classOf(r) {
    const m = MODES[mode];
    if (m.bins) { const k = m.bins.of(r); return k == null ? "none" : k; }
    if (classOn && classState && classState.mode === mode && m.v) { const v = m.v(r); return v == null || !Number.isFinite(v) ? "none" : CL.classIndex(v, classState.edges); }
    return null;
  }
  function decorateLegend() {
    const m = MODES[mode], counts = new Map(), iso = activeIso();
    if (m.bins || (classOn && classState)) for (const r of allRows()) { if (!pass(r)) continue; const k = classOf(r); counts.set(k, (counts.get(k) || 0) + 1); }
    legend.querySelectorAll("[data-count]").forEach(el => { const k = el.dataset.count === "none" ? "none" : Number(el.dataset.count); el.textContent = "· " + (counts.get(k) || 0); });
    legend.querySelectorAll("[data-class]").forEach(b => {
      if (b.dataset.class === "all") { b.hidden = !iso; return; }
      const on = !!iso && iso.has(b.dataset.class === "none" ? "none" : Number(b.dataset.class));
      b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("nc-lg-on", on);
    });
  }
  const darkHex = h => { const m = /^#([0-9a-f]{6})$/i.exec(h); if (!m) return false; const n = parseInt(m[1], 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140; };
  const meText = r => "ME " + Number(r[3].toFixed(Math.abs(r[3]) >= 1e5 ? 0 : 1)) + (r[4] != null ? "(" + Number(r[4].toPrecision(2)) + ")" : "") + (r[5] ? "#" : "");
  const num = x => String(Number(Number(x).toPrecision(5)));
  const fill = (text, o) => String(text || "").replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");
  const edLabel = ed => ed.toUpperCase();
  const edText = ed => { const e = EDSTATS && EDSTATS[ed]; return e ? fill(T.ed_opt_title, { ed: edLabel(ed), n: e.nuclides, m: e.measured, e: e.estimated, i: e.nubase ? e.nubase.isomers : "?", nub: e.nubase ? e.nubase.table : "NUBASE" }) : ""; };
  function drawStats() {
    if (!statBox) return;
    const m = MODES[mode], list = allRows().filter(pass), ST = window.ZGChartStats;
    const cat = CATS[mode] || (m.bins && { of: r => { const k = m.bins.of(r); return k == null ? "none" : k; }, list: [...m.bins.list.map(([, l], i) => [i, l]), ...(m.bins.none ? [["none", m.bins.none[1]]] : [])] });
    const strong = t => `<b>${t}</b>`;
    let html = "";
    if (cat) {
      const count = new Map(); for (const r of list) { const k = cat.of(r); count.set(k, (count.get(k) || 0) + 1); }
      html = strong(fill(T.st_n, { n: list.length })) + " · " + cat.list.map(([k, l]) => `${escape(l)} ${strong(count.get(k) || 0)}`).join(" · ");
    } else if (mode === "hl") {
      const known = list.filter(r => r[6] > -98 && r[6] < 99), s = ST.summarize(known.map(r => ({ v: r[6], id: r }))), stable = list.filter(r => r[6] === 99).length;
      const t = v => ST.scientificSeconds(v);
      html = s ? strong(fill(T.st_hl, { n: s.n })) + ` · ${T.st_min} ${strong(t(s.min.v))} (${nuc(s.min.id)}) · ${T.st_max} ${strong(t(s.max.v))} (${nuc(s.max.id)}) · ${T.st_median} ${strong(t(s.median))} · ${T.st_hl_stable} ${strong(stable)}` : escape(T.st_none);
    } else if (m.v) {
      const items = list.map(r => ({ v: m.v(r), id: r })), s = ST.summarize(items);
      const unit = m.rng ? RNG_UNIT[mode] || "" : m.u || "", shown = v => num(m.rng ? Math.pow(10, v) : v) + (unit ? " " + unit : "");
      if (!s) html = escape(T.st_none);
      else {
        const bd = bounds(m), out = items.filter(x => Number.isFinite(x.v) && (x.v < bd.lo || x.v > bd.hi)).length;
        html = strong(fill(T.st_n, { n: s.n })) + ` · ${T.st_min} ${strong(shown(s.min.v))} (${nuc(s.min.id)}) · ${T.st_max} ${strong(shown(s.max.v))} (${nuc(s.max.id)}) · ${T.st_median} ${strong(shown(s.median))}` + (out ? ` · ${fill(T.st_clipped, { k: out })}` : "");
      }
    }
    statBox.innerHTML = html;
    decorateLegend(); drawEdHint(); renderEditions();
  }
  function drawEdHint() {
    if (!edHint) return;
    const ed = EDMODE[mode]; edHint.hidden = !ed; if (!ed) return;
    if (!AUX.ed || !EDSTATS) { edHint.textContent = T.ed_loading; return; }
    const c = window.ZGChartStats.compareEditions(rows, AUX.ed[ed], key), label = edLabel(ed), lines = [edText(ed), fill(T.ed_hint_head, { ed: label, n: c.compared })];
    if (c.added) lines.push(fill(T.ed_hint_new, { ed: label, n: c.added }));
    if (c.dropped) lines.push(fill(T.ed_hint_drop, { ed: label, n: c.dropped }));
    if (c.estimatedToMeasured || c.measuredToEstimated) lines.push(fill(T.ed_hint_stat, { a: c.estimatedToMeasured, b: c.measuredToEstimated }));
    if (c.largest) lines.push(fill(T.ed_hint_spread, { med: num(c.medianAbs), mean: num(c.meanDifference), max: num(c.largest.v), id: sup(c.largest.id[0] + c.largest.id[1]) + (EL.find(e => e[0] === c.largest.id[0]) || [0, "Z" + c.largest.id[0]])[1] }));
    lines.push(fill(T.ed_hint_sigma, { n: c.beyond3Sigma }));
    edHint.innerHTML = lines.map(l => `<p>${escape(l)}</p>`).join("");
  }
  function renderEditions() {
    if (!edTable || !edBox || !edBox.open) return;
    const ST = window.ZGChartStats;
    if (!EDSTATS) { edTable.textContent = T.ed_loading; return; }
    const head = [T.ed_col_ed, T.ed_col_nub, T.ed_col_n, T.ed_col_meas, T.ed_col_est, T.ed_col_iso, T.ed_col_wiso, T.ed_col_oth], cur = EDMODE[mode] || "ame2020";
    edTable.innerHTML = `<table class="nc-ed-tab"><thead><tr>${head.map(h => `<th scope="col">${escape(h)}</th>`).join("")}</tr></thead><tbody>` + ST.editionRows(EDSTATS).map(e =>
      `<tr${e.key === cur ? ' class="nc-ed-cur" aria-current="true"' : ""}><th scope="row">${e.label}</th><td>${escape(e.nubase)}</td><td>${e.nuclides}</td><td>${e.measured}</td><td>${e.estimated}</td><td>${e.isomers ?? "—"}</td><td>${e.withIsomers ?? "—"}</td><td>${e.other ?? "—"}</td></tr>`).join("") + "</tbody></table>";
  }
  function titleEditionOptions() {   /* hover hint for every AME edition entry of the colour menu */
    if (!EDSTATS) return;
    for (const o of sel.options) { const ed = EDMODE[o.value]; if (ed) o.title = edText(ed); }
  }
  if (edBox) edBox.addEventListener("toggle", () => { if (!edBox.open) return; renderEditions(); if (!EDSTATS) loadAux("ed").then(() => { renderEditions(); titleEditionOptions(); }).catch(() => {}); });

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
      const last = window.ZGMassSurface.dripBoundary(js.map(j => [j, val(j)]));
      /* Both AME and models require a neighbouring nonpositive value. Unknown
         values and finite table cutoffs leave a gap in the boundary overlay. */
      if (last != null) out.push([i, last]);
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
        const related=(m.source?.related_papers||[]).filter(p=>p.doi!==m.source?.doi).map(p=>' · <a href="https://doi.org/'+escape(p.doi)+'" target="_blank" rel="noopener">'+escape(p.name)+'</a>').join('');
        return '<div class="nc-model-item"><label><input type="checkbox" data-model-series="'+escape(k)+'"> '+escape(m.name)+'</label><small><a href="'+escape(table)+'" target="_blank" rel="noopener">'+escape(T.loaded_data_link)+'</a> · <a href="'+escape(paper)+'" target="_blank" rel="noopener">'+escape(T.loaded_paper_link)+'</a>'+related+'</small></div>';
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
        MOD[k]={...m,map};modelErrors.delete(k);memo.clear();autoCache.clear();dripCache.clear();return MOD[k];
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
      drawLegend(); draw(); syncColourControls(); plotChain(); if (pin) showCard(pin);
    };
    if (s === "ame") go();
    else {
      if (msel) msel.disabled = true;
      loadModels(s).then(go).catch(() => {
        root.querySelector(".nc-mref").textContent = T.loaded_model_error;
        if (msel) msel.value = src;
      }).finally(() => { if (msel) msel.disabled = false; });
    }
  }

  const W = () => cv._cw, H = () => cv._ch;
  function fit() { cancelAnimationFrame(anim); view = CP.chartFit(allRows(), W(), H()); draw(); }
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

  /* ---------- source/state presentation (pure; no mass recalculation) ---------- */
  function cardLabels(language='en') {
    const labels={
      en:{ground:'Ground state [g]',ame:'AME2020 ground-state mass excess',derived:'Ground-state derived quantities',selected:'Selected NUBASE2020 state',context:'The reference card and chain remain ground-state quantities.',stateME:'NUBASE2020 selected-state mass excess',excitation:'Excitation energy Eₓ',precision:'Sources and published precision',rounding:'AME2020 mass excess is shown at its tabulated precision in keV. NUBASE2020 state masses retain their published precision; small rounding differences are expected. Derived energies are in MeV; B/A is in MeV per nucleon.'},
      zh:{ground:'基态 [g]',ame:'AME2020 基态质量过剩',derived:'基态导出物理量',selected:'选中的 NUBASE2020 核态',context:'参考卡片与链图仍表示基态物理量。',stateME:'NUBASE2020 所选核态质量过剩',excitation:'激发能 Eₓ',precision:'数据来源与原表精度',rounding:'AME2020 质量过剩以 keV 显示并保留原表数值精度。NUBASE2020 核态质量保留其发布精度；微小舍入差异属于正常情况。导出能量采用 MeV；B/A 的单位为 MeV/核子。'},
      fi:{ground:'Perustila [g]',ame:'AME2020: perustilan massaylijäämä',derived:'Perustilan johdetut suureet',selected:'Valittu NUBASE2020-tila',context:'Viitekortti ja ketju kuvaavat edelleen perustilaa.',stateME:'NUBASE2020: valitun tilan massaylijäämä',excitation:'Viritysenergia Eₓ',precision:'Lähteet ja julkaistu tarkkuus',rounding:'AME2020-massaylijäämä näytetään taulukon tarkkuudella keV-yksiköissä. NUBASE2020-tilamassat säilyttävät julkaistun tarkkuutensa; pienet pyöristyserot ovat odotettuja. Johdetut energiat ovat MeV-yksiköissä; B/A on MeV nukleonia kohden.'},
      de:{ground:'Grundzustand [g]',ame:'AME2020-Massenexzess des Grundzustands',derived:'Abgeleitete Größen des Grundzustands',selected:'Gewählter NUBASE2020-Zustand',context:'Die Referenzkarte und Kette zeigen weiterhin Größen des Grundzustands.',stateME:'NUBASE2020-Massenexzess des gewählten Zustands',excitation:'Anregungsenergie Eₓ',precision:'Quellen und veröffentlichte Genauigkeit',rounding:'Der AME2020-Massenexzess wird mit tabellierter Genauigkeit in keV angezeigt. NUBASE2020-Zustandsmassen behalten ihre veröffentlichte Genauigkeit; kleine Rundungsunterschiede sind zu erwarten. Abgeleitete Energien stehen in MeV; B/A in MeV pro Nukleon.'},
      ja:{ground:'基底状態 [g]',ame:'AME2020 基底状態の質量超過',derived:'基底状態の導出量',selected:'選択した NUBASE2020 核状態',context:'参照カードと系列は引き続き基底状態の量を示します。',stateME:'NUBASE2020 選択状態の質量超過',excitation:'励起エネルギー Eₓ',precision:'出典と公表精度',rounding:'AME2020 の質量超過は表の精度を保ち keV で示します。NUBASE2020 の核状態質量は公表精度を保つため、小さな丸め差が生じます。導出エネルギーは MeV、B/A は核子あたりの MeV です。'}
    };
    const referenceLabels={
      en:{published:'Published AME2020 masses and reactions · ground state',publishedNote:'Published AME2020 table values and evaluated uncertainties include mass correlations. New inputs and model stencils are recalculated separately; unknown model uncertainty stays unknown. Q values describe the stated channel, not an observed branching ratio or a shell-specific neutrino energy.',unavailable:'Published AME2020 reaction data could not load. Recalculated energies use independent mass uncertainties; these are not the evaluated AME reaction uncertainties.',referenceValue:'Value ± uncertainty',notTabulated:'— = not tabulated. Each # belongs to the adjacent value or uncertainty.'},
      zh:{published:'AME2020 原表质量与反应能 · 基态',publishedNote:'AME2020 原表数值及评价不确定度包含质量关联。新输入和模型的差分组合另行重算；未知模型不确定度保留为未知。Q 值对应所注明的反应道，并不代表已观测分支比或特定电子壳层的中微子能量。',unavailable:'AME2020 原表反应数据未能载入。重算能量采用独立质量不确定度，不等同于 AME 评价反应能不确定度。',referenceValue:'数值 ± 不确定度',notTabulated:'— 表示原表未给出。每个 # 仅属于相邻的数值或不确定度。'},
      fi:{published:'AME2020:n julkaistut massat ja reaktiot · perustila',publishedNote:'Julkaistut AME2020-arvot ja arvioidut epävarmuudet sisältävät massakorrelaatiot. Uudet syötteet ja mallisuureet lasketaan erikseen; tuntematon malliepävarmuus pysyy tuntemattomana. Q-arvo koskee ilmoitettua kanavaa, ei mitattua haarautumissuhdetta tai kuorikohtaista neutriinon energiaa.',unavailable:'Julkaistua AME2020-reaktiotaulukkoa ei voitu ladata. Uudelleen lasketut energiat käyttävät riippumattomia massaepävarmuuksia, eivät AME:n arvioituja reaktioepävarmuuksia.',referenceValue:'Arvo ± epävarmuus',notTabulated:'— = ei taulukoitu. Kukin # kuuluu viereiseen arvoon tai epävarmuuteen.'},
      de:{published:'Veröffentlichte AME2020-Massen und Reaktionen · Grundzustand',publishedNote:'Veröffentlichte AME2020-Werte und evaluierte Unsicherheiten berücksichtigen Massenkorrelationen. Neue Eingaben und Modellgrößen werden getrennt berechnet; unbekannte Modellunsicherheiten bleiben unbekannt. Q bezieht sich auf den angegebenen Kanal, nicht auf ein beobachtetes Verzweigungsverhältnis oder eine schalenspezifische Neutrinoenergie.',unavailable:'Die veröffentlichte AME2020-Reaktionstabelle konnte nicht geladen werden. Neu berechnete Energien verwenden unabhängige Massenunsicherheiten, nicht die evaluierten AME-Reaktionsunsicherheiten.',referenceValue:'Wert ± Unsicherheit',notTabulated:'— = nicht tabelliert. Jedes # gehört zum benachbarten Wert oder seiner Unsicherheit.'},
      ja:{published:'AME2020 公表質量と反応エネルギー · 基底状態',publishedNote:'AME2020 の公表値と評価不確かさは質量相関を含みます。新しい入力と模型の差分量は別に再計算し、未知の模型不確かさは未知のままです。Q 値は記載した反応経路に対応し、観測分岐比や電子殻固有の中微子エネルギーを表しません。',unavailable:'AME2020 公表反応表を読み込めません。再計算値は独立な質量不確かさを用い、AME の評価反応不確かさとは異なります。',referenceValue:'値 ± 不確かさ',notTabulated:'— = 公表表に値なし。各 # は隣接する値または不確かさに対応します。'}
    };
    const k=String(language).toLowerCase().split('-')[0];
    return {...(labels[k]||labels.en),...(referenceLabels[k]||referenceLabels.en)};
  }
  function referenceMassText(value,unknown='?') {
    if(!value||!Number.isFinite(value.v))return '—';
    const mass=String(value.v)+(value.est?'#':'');
    const sigma=Number.isFinite(value.e)?String(value.e)+(value.sigmaEst?'#':''):unknown;
    return mass+' ± '+sigma;
  }
  function sourceQuantityText(quantity,unknown='?') {
    if(!quantity)return '—';
    const raw=String(quantity.raw??'').trim(),rawSigma=String(quantity.raw_uncertainty??'').trim();
    const value=raw||(Number.isFinite(quantity.value)?String(quantity.value)+(quantity.value_extrapolated?'#':''):'');
    if(!value)return '—';
    if(!rawSigma&&!Number.isFinite(quantity.uncertainty)&&(!Number.isFinite(quantity.value)||quantity.qualifier))return value;
    const sigma=rawSigma||(Number.isFinite(quantity.uncertainty)?String(quantity.uncertainty)+(quantity.uncertainty_extrapolated?'#':''):unknown);
    return value+' ± '+sigma;
  }
  function isomerExcitationText(row,state,unknown='?') {
    return sourceQuantityText(state?.excitation||{value:row[1],uncertainty:row[4],value_extrapolated:!!row[5],uncertainty_extrapolated:!!row[6]},unknown);
  }
  function selectedStateContext(state,labels) {
    return labels.selected+': '+state.A+state.element+' ['+state.label+']. '+labels.context;
  }
  function publishedReferenceHTML(data,Z,N,labels,unknown='?') {
    if(!data)return '<p>'+escape(labels.unavailable)+'</p>';
    const record=data?.records?.[Z+','+N];
    if(!record)return '<p>'+escape(labels.notTabulated)+'</p>';
    const names={me:'ME',BEA:'B/A',BE:'B = A × (B/A)',qbm:'Q(β⁻)',sn:'Sₙ',s2n:'S₂ₙ',sp:'Sₚ',s2p:'S₂ₚ',qa:'Q(α)',...Object.fromEntries(Object.entries(reactionDefinitions).map(([k,q])=>[k,q.label]))};
    const body=(data.quantities||Object.keys(record.values)).map(key=>{
      const cell=record.values[key],value=cell&&Number.isFinite(cell.value)?sourceQuantityText(cell,unknown):'—';
      const unit=data.metadata?.quantity_units?.[key]||(key==='BEA'?'keV/nucleon':'keV');
      return '<tr><th>'+escape(names[key]||key)+'</th><td>'+escape(value)+' '+escape(unit)+'</td></tr>';
    }).join('');
    const links=(data.metadata?.sources||[]).map(source=>'<a href="'+escape(source.url)+'">'+escape(source.table||'AME2020')+'</a>').join(' · ');
    return '<p>'+escape(labels.publishedNote)+'</p><table><thead><tr><th>'+escape(Z+N+' '+record.element+' [g]')+'</th><th>'+escape(labels.referenceValue)+'</th></tr></thead><tbody>'+body+'</tbody></table><p>'+escape(labels.notTabulated)+'</p><p>'+links+'</p>';
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
  const fv = (o, d = 3, f = 1000, u = " MeV") => { if (o == null) return "—"; const h = o.est ? "#" : "",sigmaHash=o.sigmaEst?'#':'';
    if (o.e == null) return `${(o.v/f).toFixed(d)}${h}${u} (${unknown})`;
    if (!(o.e > 0)) return `${(o.v / f).toFixed(d)}${h}${u}`;
    const [a, b] = fmtU(o.v / f, o.e / f); return `${a}${h} ± ${b}${sigmaHash}${u}`; };
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
  /* separation and decay channels of the card: green when energetically possible (Q > 0 decay, S < 0 emission), red when not, grey without data */
  const CHANNELS = [["S", "Sₙ", "sn"], ["S", "Sₚ", "sp"], ["Q", "Q(α)", "qa"], ["Q", "Q(β⁻)", "qbm"], ["Q", "Q(β⁺/EC)", "qec"], ["Q", "Q(ECp)", "qep"], ["Q", "Q(β⁻n)", "qbmn"],
    ["S", "S₂ₙ", "s2n"], ["S", "S₂ₚ", "s2p"], ["Q", "Q(2β⁻)", "q2bm"], ["Q", "Q(2EC)", "q2ec"], ["Q", "Q(2β⁺)", "q2bp"]];
  const channelItems = d => CHANNELS.map(([kind, name, k]) => { const o = d[k], st = CL.channelState(kind, o ? o.v : null);
    return `<li class="nc-ch nc-ch-${st}" title="${escape(T["ch_" + st])}"><b>${name}</b> = ${o ? fv(o, 1, 1, "") : "—"}</li>`; }).join("");
  function showCard(r) {
    if (!r) { card.hidden = true; return; }
    const d = derived(r), dm = src !== "ame" && MOD[src] ? derivedZN(r[0], r[1], src) : null, A = r[0] + r[1], el = EL.find(e => e[0] === r[0]), row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    card.hidden = false;
    card.innerHTML = `<button type="button" class="nc-close" aria-label="${T.state_close}">×</button>
      <div class="nc-head"><span class="nc-sym">${sup(A)}${r[2]}</span><span>${el ? el[2] : ""}<br><small>${cardT.ground} · Z = ${r[0]} · N = ${r[1]} · A = ${A}</small></span></div>
      <p class="nc-ground-context zg-small zg-muted" aria-live="polite">${cardT.context}</p>
      ${evaluatedWarning?'<p class="zg-small" role="status">'+cardT.unavailable+'</p>':''}
      <table>${row(T.hl, r[7] === "stable" ? T.stable : r[7])}${row("Jπ", r[8] || "—")}${row(T.decay, decayText(r[10]))}
      ${row(cardT.ame, escape(referenceMassText(d.me,unknown))+' keV')}
      <tr><th colspan="2">${cardT.derived}</th></tr>
      ${row("B/A", fv(d.BEA, 4,1000," MeV/nucleon"))}${row("Sₙ", fv(d.sn))}${row("S₂ₙ", fv(d.s2n))}${row("Sₚ", fv(d.sp))}${row("S₂ₚ", fv(d.s2p))}
      ${row("Q(β⁻)", fv(d.qbm))}${row("Q(EC)", fv(d.qec))}${row("Q(α)", fv(d.qa))}${row("δ₂ₙ", fv(d.d2n))}
      ${row("Δₙ⁽³⁾ · Δₚ⁽³⁾", fv(d.d3n) + "<br>" + fv(d.d3p))}${row("δV<sub>pn</sub>", fv(d.vpn))}${row(T.wig, fv(d.wig))}
      ${dm ? `<tr class="nc-mrow"><th colspan="2">${MOD[src].name} · ${cardT.ground}</th></tr>${row(T.me, dm.me ? (dm.me.v / 1000).toFixed(3) + " MeV" : "—")}${row("ME(AME) − ME(" + T.model_short + ")", d.me && dm.me ? ((d.me.v - dm.me.v) / 1000).toFixed(3) + " MeV" : "—")}${row("Sₙ · S₂ₙ", fv(dm.sn, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2n, 3).replace(/ ± 0\.000/, ""))}${row("Sₚ · S₂ₚ", fv(dm.sp, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2p, 3).replace(/ ± 0\.000/, ""))}${row("β₂", dm.beta2 ? (dm.beta2.v / 1000).toFixed(3) : "—")}` : ""}
      <tr class="nc-chan-row"><th colspan="2">${T.ch_title}</th></tr><tr><td colspan="2"><ul class="nc-chan" aria-label="${escape(T.ch_title)}">${channelItems(d)}</ul><p class="zg-small zg-muted">${T.ch_help}</p></td></tr>
      ${row(T.disc, r[9] || "—")}
      ${r[11].length ? row(T.isomers, r[11].map(i => `${sup(A)}${i[0]}${r[2]}: Eₓ = ${escape(isomerExcitationText(i,catalog?.states.get(i[7]),unknown))} keV, ${escape(i[2] || "?")}, ${escape(i[3] || "")}`).join("<br>")) : ""}</table>
      <details class="nc-explanation"><summary>${cardT.precision}</summary><p>${cardT.rounding}</p></details>
      <details class="nc-explanation nc-published-reference"><summary>${cardT.published}</summary>${publishedReferenceHTML(evaluatedData,r[0],r[1],cardT,unknown)}</details>
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
      const format=q=>escape(sourceQuantityText(q,unknown));
      const life=state.half_life;
      card.querySelector('.nc-ground-context').textContent=selectedStateContext(state,cardT);
      panel.querySelector(".nc-state-data").innerHTML=`<p><b>${state.A}${escape(state.element)} [${state.label}]</b> · ${escape(T.state_kinds[state.kind])}${state.existence==="withdrawn"?" — "+T.state_withdrawn:state.existence==="questioned"?" — "+T.state_questioned:""}</p><p>${cardT.stateME}: ${format(state.mass_excess)} keV<br>${cardT.excitation}: ${format(state.excitation)} keV<br>T½: ${format(life)} ${escape(life.unit)}<br>Jπ: ${escape(state.spin_parity)}</p><p>${state.ordering_uncertain?"* "+T.state_order_uncertain+". ":""}${state.ordering_inverted?"& "+T.state_order_inverted+". ":""}${escape(T.state_bases[state.classification_basis])}.</p><p>${T.state_model_note}</p>`;
      const stateURL=new URL(location.href);stateURL.searchParams.set('nuclide',state.A+state.element);stateURL.searchParams.set('state',state.source_state_index);
      const a=document.createElement("a");a.href=stateURL.href;a.textContent=T.state_link;a.onclick=e=>{e.preventDefault();history.pushState(null,'',a.href);a.textContent=T.state_link_ready;};panel.querySelector(".nc-state-data").appendChild(a);
      if(window.parent!==window)window.parent.postMessage({type:'zg-panel-state',nuclide:state.A+state.element,state:state.source_state_index},location.origin);
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
    me: [T.m_me, d => d.me, "MeV"], be: [T.mf_be, d => d.BE, "MeV"], bea: [T.m_bea, d => d.BEA, "MeV/nucleon"], sn: ["Sₙ", d => d.sn, "MeV"], s2n: ["S₂ₙ", d => d.s2n, "MeV"],
    atomic: [T.loaded_atomic, d => d.me ? P.combine([1000/P.C.uKeV,d.me],[1000,P.constant(d.A)]) : null, "u"],
    sp: ["Sₚ", d => d.sp, "MeV"], s2p: [T.mf_s2p, d => d.s2p, "MeV"], qbm: ["Q(β⁻)", d => d.qbm, "MeV"], qec: ["Q(EC)", d => d.qec, "MeV"],
    qa: ["Q(α)", d => d.qa, "MeV"], d2n: ["δ₂ₙ = S₂ₙ(N) − S₂ₙ(N+2)", d => d.d2n, "MeV"], dme: [T.m_dme, d => d.me?.e == null ? null : { v: d.me.e * 1000, e: null, est: d.me.est || d.me.sigmaEst, sigmaEst: d.me.sigmaEst, source: d.me.source, uncertainty_model: 'mass standard uncertainty; uncertainty of the uncertainty unavailable' }, "keV"],
    hl: ["log₁₀(T½ / s)", (d, r) => r[6] > -90 && r[6] !== 99 ? { v: r[6] * 1000, e: 0, est: false } : null, ""],
    d3n: ["Δₙ⁽³⁾ (pairing)", d => d.d3n, "MeV"], d3p: ["Δₚ⁽³⁾ (pairing)", d => d.d3p, "MeV"],
    d5n: ["Δₙ⁽⁵⁾ (pairing, 5-point)", d => d.d5n, "MeV"], d5p: ["Δₚ⁽⁵⁾ (pairing, 5-point)", d => d.d5p, "MeV"], d2p: ["δ₂ₚ = S₂ₚ(Z) − S₂ₚ(Z+2)", d => d.d2p, "MeV"],
    dmod: ["ME(AME) − ME(model)", (d, r) => dmod(r), "MeV"],
    vpn: ["δVpn", d => d.vpn, "MeV"], wig: ["W = δVpn − ½[δVpn(N±2)]", d => d.wig, "MeV"],
    beta2: ["β₂ (model)", d => d.beta2, ""],
  };
  for(const [name,q]of Object.entries(reactionDefinitions))PQ[name]=[q.label,d=>d[name],'MeV'];
  for(const [name,f]of Object.entries(extraFilters))PQ[name]=[filterLabel(name,f),d=>d[name],'MeV'];
  const linear = label => String(label).replace(/,\s*(?:log scale|对数|log|échelle log|対数)\)/, ")"); // chain plots show the value itself, not its logarithm
  const expObj = (v, e) => v == null ? null : { v: v * 1000, e: e == null ? null : e * 1000, est: false };
  PQ.rms = [T.m_rms, (d, r) => { const a = auxGet("props", r); return a ? expObj(a.r, a.sr) : null; }, "fm"];
  PQ.mu = [T.m_mu, (d, r) => { const a = auxGet("props", r); return a ? expObj(a.mu, a.smu) : null; }, "μN"];
  PQ.qmom = [T.m_qmom, (d, r) => { const a = auxGet("props", r); return a ? expObj(a.Q, a.sQ) : null; }, "b"];
  PQ.e2p = [linear(T.m_e2p), (d, r) => { const a = auxGet("be2", r); return a ? expObj(a.E, a.sE) : null; }, "keV"];
  PQ.be2 = [linear(T.m_be2), (d, r) => { const a = auxGet("be2", r); return a ? expObj(a.b, a.sb) : null; }, "e²b²"];
  PQ.beta2e = [T.m_beta2e, (d, r) => { const a = auxGet("be2", r); return a ? expObj(a.beta, a.sbeta) : null; }, ""];
  PQ.mine = [T.m_mine, () => null, ""]; // Custom values are an independent series, never an evaluated reference.
  for (const [name, ed] of [["dame16", "ame2016"], ["dame12", "ame2012"], ["dame03", "ame2003"], ["dame95", "ame1995"]]) PQ[name] = [T["m_" + name], (d, r) => { const x = edDiff(ed, r); return x ? { v: x.v * 1000, e: x.e == null ? null : x.e * 1000, est: x.est } : null; }, "keV"];
  // A plotted standard uncertainty is not a linear mass expression. Keep its
  // underlying mass separate for filtering, input labels and CSV provenance.
  const EXPQ = ["rms", "mu", "qmom", "e2p", "be2", "beta2e", "dame16", "dame12", "dame03", "dame95", "mine"];
  const dependencyValue=(quantity,derived,value)=>quantity==='dme'||EXPQ.includes(quantity)?derived.me:value;
  const formulaDefinitions={...extraFilters,...reactionDefinitions};
  const offsets=f=>f.terms.map(([z,n])=>'('+z+', '+n+')').join(' · ');
  root.querySelector('.nc-filter-definitions').innerHTML='<table><thead><tr><th>'+escape(T.pq)+'</th><th>'+escape(T.mf_formula)+'</th><th>'+escape(T.mf_neighbours)+'</th></tr></thead><tbody>'+Object.entries(formulaDefinitions).map(([name,f])=>'<tr><th>'+escape(f.label||filterLabel(name,f))+'</th><td>'+escape(f.formula)+'</td><td>'+escape(offsets(f))+'</td></tr>').join('')+'</tbody></table>';
  function filterFormula(){
    const f=formulaDefinitions[pq.value],box=root.querySelector('.nc-filter-formula');box.hidden=!f;
    box.textContent=f?pq.value+': '+f.formula+' · '+T.mf_neighbours+': '+offsets(f):'';
  }
  pq.innerHTML = window.ZGMassQuantityMenu.html(Object.fromEntries(Object.entries(PQ).map(([k,v])=>[k,v[0]])),T);
  pq.value = "s2n";
  const palette=['#167d45','#b94e00','#0095a8','#7352bd','#96610b','#0d807b','#c54646','#525d76','#668100','#874d70','#566bba','#8b651f'];
  const labelStyles=new Map(),labelColors=['#b41c81','#008080','#d2691e','#6a5acd','#228b22','#dc143c','#4682b4'];
  const markerPairs=[['diamond','square'],['triangle','down'],['circle','hexagon'],['star','diamond'],['hexagon','triangle'],['square','star']];
  function labelStyle(labels=['New']){
    const key=JSON.stringify(labels.length?labels:['New']);
    if(!labelStyles.has(key)){const i=labelStyles.size,pair=markerPairs[i%markerPairs.length];labelStyles.set(key,{labels:labels.length?labels:['New'],color:labelColors[i%labelColors.length],loaded:pair[0],hybrid:pair[1]});}
    return {key,...labelStyles.get(key)};
  }
  labelStyle();
  const referenceName=()=>['rms','mu','qmom'].includes(pq.value)?'IAEA LiveChart':['e2p','be2','beta2e'].includes(pq.value)?'NNDC B(E2)':pq.value==='mine'?T.mine_no_reference:'AME2020';
  const seriesMeta=(k,labels)=>{
    if(k==='mine')return {id:k,key:k,name:USER.typed?.label||T.m_mine,short:USER.typed?.label||T.m_mine,color:'#b41c81',shape:'diamond'};
    if(['loaded','hybrid'].includes(k)){
      const style=labelStyle(labels),name=style.labels.join(' / ')+(k==='hybrid'?' + AME2020':'');
      return {id:k,key:k+':'+style.key,labelKey:style.key,name,short:name,color:style.color,shape:style[k],open:false};
    }
    return k==='ame'?{id:k,key:k,name:referenceName(),short:referenceName(),color:'#3b5bdb',shape:'circle'}:{id:k,key:k,name:MOD[k]?.name||modelIndex?.[k]?.name||k,short:(MOD[k]?.name||k).split(' (')[0],color:palette[Object.keys(modelIndex||{}).indexOf(k)%palette.length],shape:'model'};
  };
  const inSeries=(p,s)=>p.styleKey===s.key;
  const chainColor=group=>{const groups=plotPts.groups||[];return groups.length>1?'hsl('+groups.indexOf(group)/groups.length*300+',75%,45%)':'#3b5bdb';};
  /* Publication options of the chain plot: line mode, marker offset (dodge) and a grey AME2020 reference. They change only the drawing. */
  const AME_GREY='#8a8f98';
  const chainOpt=()=>({lines:chainInput('lines').checked,mode:chainInput('linemode')?.value||'series',dodge:Math.max(0,Math.min(.4,Number(chainInput('dodge')?.value)||0)),mute:!!chainInput('muteame')?.checked});
  const muteActive=()=>chainOpt().mute&&plotPts.some(p=>p.series!=='ame');
  const shiftOf=series=>CP.seriesShift(series,chainOpt().dodge);
  const pointColor=(p,s)=>s.id==='ame'?(muteActive()?AME_GREY:chainColor(p.g)):s.color;
  const legendColor=s=>s.id==='ame'&&muteActive()?AME_GREY:s.color;
  let markerSignature='';
  function markerControls(){
    const current=new Set();
    for(const active of inputTable?.active.values()||[])if(!active.state.source_state_index)current.add(labelStyle(MM.labels(active.value,inputTable)).key);
    for(const s of visibleSeries)if(s.labelKey)current.add(s.labelKey);
    if(!current.size)current.add(labelStyle().key);
    const entries=[...labelStyles].filter(([key])=>current.has(key)),signature=JSON.stringify(entries.map(([key])=>key));if(signature===markerSignature)return;markerSignature=signature;
    root.querySelector('.nc-marker-rows').innerHTML=entries.map(([key,s])=>'<fieldset class="nc-marker-row" data-marker-key="'+escape(key)+'"><legend>'+escape(s.labels.join(' / '))+'</legend>'+['loaded','hybrid'].map(k=>'<label>'+escape(k==='loaded'?T.marker_new:T.marker_hybrid)+' <select data-marker-kind="'+k+'" aria-label="'+escape(s.labels.join(' / ')+' — '+(k==='loaded'?T.marker_new:T.marker_hybrid))+'">'+Object.keys(CP.markers).map(shape=>'<option value="'+shape+'"'+(s[k]===shape?' selected':'')+'>'+CP.markers[shape][0]+' / '+CP.markers[shape][1]+'# '+escape(T.marker_names[shape])+'</option>').join('')+'</select></label>').join('')+'<label>'+escape(T.marker_color)+' <select data-marker-kind="color" aria-label="'+escape(s.labels.join(' / ')+' — '+T.marker_color)+'">'+labelColors.map((color,i)=>'<option value="'+color+'"'+(s.color===color?' selected':'')+'>'+escape(T.marker_colors[i])+'</option>').join('')+'</select></label></fieldset>').join('');
  }
  root.querySelector('.nc-marker-rows').addEventListener('change',e=>{
    const control=e.target.closest('[data-marker-kind]');if(!control)return;
    const style=labelStyles.get(control.closest('[data-marker-key]').dataset.markerKey),kind=control.dataset.markerKind,old=style[kind];style[kind]=control.value;
    const other=kind==='loaded'?'hybrid':'loaded',collision=kind!=='color'&&style[kind]===style[other];
    if(collision){style[other]=old;markerSignature='';}
    root.querySelector('.nc-marker-status').textContent=collision?T.marker_swap:'';plotChain();
  });
  const markerGlyph=s=>s.shape==='model'?'– –':CP.markers[s.shape][s.open?1:0];
  const hasEstimated=s=>plotPts.concat(modPts,residualPts).some(p=>inSeries(p,s)&&p.est);
  const legendGlyph=s=>markerGlyph(s)+(hasEstimated(s)?' '+(CP.markers[s.shape]?.[1]||'○')+'#':'');
  function wrapFigureText(text,width,size){pg.save();pg.font=size+'px system-ui';const lines=FS.wrapText(text,Math.max(80,width),size,value=>pg.measureText(value).width);pg.restore();return lines;}
  const hasMeasured=s=>plotPts.concat(modPts,residualPts).some(p=>inSeries(p,s)&&!p.est);
  /* Legend: one line per series (filled and hollow-# glyphs together) or, with "measured and extrapolated (#) on separate lines", one line for the
     filled marker (measured) and one for the hollow marker with # (extrapolated) of every series that has both. */
  function seriesLegendLines(w){
    const out=[],split=!!chainInput('legendsplit')?.checked;
    for(const s of visibleSeries.slice(0,16)){
      const filled=s.shape==='model'?'– –':CP.markers[s.shape][0],hollow=(CP.markers[s.shape]?.[1]||'○')+'#',est=split&&hasEstimated(s),meas=hasMeasured(s);
      const entries=est?(meas?[{glyph:filled,suffix:' · '+T.leg_measured},{glyph:hollow,suffix:' · '+T.leg_extrapolated}]:[{glyph:hollow,suffix:' · '+T.leg_extrapolated}]):[{glyph:null,suffix:''}];
      for(const e of entries)wrapFigureText((s.short+e.suffix).slice(0,170),w-150,chainStyle().legendSize).forEach((text,i)=>out.push({style:s,first:i===0,text,glyph:e.glyph}));
    }
    if(visibleSeries.length>16)out.push({text:T.marker_more.replace('{n}',visibleSeries.length-16)});return out;
  }
  let inputLegend=[];
  function inputLegendLines(w){
    const lines=inputLegend.slice(0,8).flatMap(entry=>wrapFigureText(entry.text.slice(0,400),w-100,chainStyle().legendSize));
    if(inputLegend.length>8)lines.push('+ '+(inputLegend.length-8)+' · '+T.loaded_details);return lines;
  }
  const legendRow=()=>Math.max(16,chainStyle().legendSize*1.5);
  const titleLines=w=>wrapFigureText((pchain.value+' = '+(chain?(pchain.value==='Z'?chain[0]:pchain.value==='N'?chain[1]:chain[0]+chain[1]):'')+' · '+(PQ[pq.value]?.[0]||'')).trim(),Math.max(100,w-100),chainStyle().titleSize);
  const titleHeight=w=>titleLines(w).length*chainStyle().titleSize*1.35+5;
  const legendHeight=w=>titleHeight(w)+legendRow()*(seriesLegendLines(w).length+inputLegendLines(w).length);
  function plotPadding(domain,multiple){
    const st=chainStyle();pg.save();pg.font=st.tickSize+'px system-ui';const measured=Math.max(...niceTicks(domain.y0,domain.y1,6).map(y=>pg.measureText(fmtTick(y)).width),0);pg.restore();
    return {left:Math.max(62,Math.min(160,measured+st.axisSize+20)),right:multiple?78:Math.max(18,st.tickSize),bottom:Math.max(42,st.axisSize+st.tickSize+20)};
  }
  const plotGeom=(domain,w,h,sc=1)=>CP.geometry(domain,w,h,(plotPts.groups||[]).length>1,sc,legendHeight(w/sc),plotPadding(domain,(plotPts.groups||[]).length>1));
  const residualGeom=(domain,w,h)=>CP.geometry(domain,w,h,(plotPts.groups||[]).length>1,1,Math.max(0,chainStyle().titleSize-11)*1.5,plotPadding(domain,(plotPts.groups||[]).length>1));
  const figureStyleHost=root.querySelector('[data-chain-figure-style]');
  chainFigureStyle=figureStyleHost?FS.controls(figureStyleHost,{lang:(document.documentElement.lang||'en').split('-')[0],prefix:'chain',baseline:chainStyleBase,onChange:()=>{resize();drawPlot();drawResidual();}}):{get:()=>({...chainStyleBase}),valid:()=>true};
  function humanInputs(p){
    if(p.typed_provenance){const r=p.typed_provenance;return r.inputValue+' ± '+(r.inputSigma??T.mine_unknown)+' '+r.inputUnit+' · '+r.quantity+(r.reference?' · '+r.reference:'');}
    return MM.provenance(p.dependencyValue||p.valueObj,inputTable).map(x=>{
      const loaded=x.id.startsWith('loaded:')?inputTable.active.get(x.id.split(':')[1]):null;
      const r=M.get(Number(x.id.split(':').pop()));
      const name=loaded?loaded.label:r?String(r[0]+r[1])+r[2]:T.loaded_reference;
      const references=x.references.filter(Boolean);
      return x.coefficient+' × '+name+(references.length?' ('+references.join('; ')+')':'');
    }).join('; ');
  }
  function pointDetail(p){
    const box=root.querySelector('.nc-point-detail');
    if(!p){box.textContent='';return;}
    const inputs=humanInputs(p);
    box.textContent=p.r[0]+p.r[1]+p.r[2]+' · '+p.source+' · '+p.y+' ± '+(p.e??'—')+' '+(p.unit||PQ[pq.value][2])+' · '+inputs+(p.referenceEstimated?' · '+T.model_reference_extrapolated:'');
  }
  function pointTable(){
    const d=root.querySelector('.nc-point-table');if(!d.open||!plotDomain)return;
    const every=plotPts.concat(modPts).filter(p=>p.x>=plotDomain.x0&&p.x<=plotDomain.x1);
    const limitBox=d.querySelector('[name=nc-pt-limit]'),allBox=d.querySelector('[name=nc-pt-all]');
    const wanted=allBox.checked?every.length:Math.max(1,Math.floor(Number(limitBox.value))||300),ps=every.slice(0,wanted);
    limitBox.disabled=allBox.checked;d.querySelector('.nc-pt-count').textContent=T.pt_count.replace('{n}',ps.length).replace('{total}',every.length);
    d.querySelector('.nc-table-scroll').innerHTML='<table><thead><tr><th>Z,N</th><th>x</th><th>'+escape(PQ[pq.value][0])+'</th><th>σ</th><th>'+escape(T.point_source_inputs)+'</th></tr></thead><tbody>'+ps.map(p=>'<tr><td>'+p.r[0]+','+p.r[1]+'</td><td>'+p.x+'</td><td>'+p.y+(p.est?' #':'')+'</td><td>'+(p.e??'—')+'</td><td>'+escape(p.source)+'<br>'+escape(humanInputs(p))+'</td></tr>').join('')+'</tbody></table>';
  }
  root.querySelector('.nc-point-table').addEventListener('toggle',pointTable);
  root.querySelectorAll('.nc-point-table [name=nc-pt-limit], .nc-point-table [name=nc-pt-all]').forEach(el=>el.addEventListener('input',pointTable));
  const impact=root.querySelector('.nc-impact'),impactInput=root.querySelector('[name=nc-impact-input]'),impactQ=root.querySelector('[name=nc-impact-quantity]'),impactM=root.querySelector('[name=nc-impact-model]');
  let impactRows=[],impactPage=0,impactRequest=0;
  const impactNames={...Object.fromEntries(Object.entries(PQ).map(([k,v])=>[k,v[0]])),BE:T.loaded_be,BEA:T.m_bea,ex:'Eₓ from ME'};
  impactQ.insertAdjacentHTML('beforeend',window.ZGMassQuantityMenu.html(Object.fromEntries(window.ZGMassSurface.quantities.concat('ex').map(k=>[k,impactNames[k]])),T));
  const impactModels=()=>impactM.value==='selected'?selectedModels():impactM.value==='all'?Object.keys(modelIndex||{}):[impactM.value];
  const impactFiltered=()=>impactRows.filter(r=>(impactQ.value==='all'||r.quantity===impactQ.value)&&(impactInput.value==='all'||MM.affected(r.after,impactInput.value)));
  function impactInputs(){
    const selected=impactInput.value;impactInput.innerHTML='<option value="all">'+escape(T.loaded_all_inputs)+'</option>'+[...inputTable.active.values()].map(r=>'<option value="'+r.id+'">'+escape(r.label)+'</option>').join('');
    if(selected==='all'||inputTable.active.has(selected))impactInput.value=selected;
  }
  const impactFormat=v=>v?Number(v.v.toFixed(6))+(v.est?'#':'')+' ± '+(v.e==null?'?':Number(v.e.toPrecision(4))):'—';
  function impactRender(){
    if(!impact.open)return;
    const all=impactFiltered(),models=impactModels(),inputs=[...inputTable.active.values()].filter(r=>impactInput.value==='all'||r.id===impactInput.value);
    impact.querySelector('.nc-impact-input-info').textContent=inputs.map(r=>r.label+': ME '+impactFormat(r.value)+' keV').join('; ');
    impact.querySelector('.nc-impact-model-info').textContent=models.length?'':T.loaded_no_comparison;
    const ownCentre=r=>inputs.some(m=>m.state.Z===r.r[0]&&m.state.N===r.r[1]&&(m.state.label===(r.state||'g')));
    all.sort((a,b)=>Number(ownCentre(b))-Number(ownCentre(a))||a.r[0]-b.r[0]||a.r[1]-b.r[1]||a.quantity.localeCompare(b.quantity));
    impactPage=Math.max(0,Math.min(impactPage,Math.ceil(all.length/50)-1));
    impact.querySelector('.nc-impact-info').textContent=T.loaded_impact_count.replace('{rows}',all.length).replace('{nuclei}',new Set(all.map(r=>r.r[0]+'-'+r.r[1]+'-'+(r.state||'g'))).size)+(models.some(k=>!MOD[k])?' · '+(models.some(k=>modelErrors.has(k))?T.loaded_model_error:T.loaded_model_loading):'');
    impact.querySelector('tbody').innerHTML=all.length?all.slice(impactPage*50,impactPage*50+50).map(r=>'<tr'+(ownCentre(r)?' class="nc-impact-centre"':'')+'><td>'+escape((r.r[0]+r.r[1])+r.r[2]+(r.state?'['+r.state+']':''))+'</td><td>'+escape(impactNames[r.quantity])+'<br>'+r.unit+'</td><td>'+escape(impactFormat(r.before))+'</td><td>'+escape(impactFormat(r.after))+'</td><td>'+escape(impactFormat(r.delta))+'</td><td>'+models.map(k=>{const v=r.state?null:derivedZN(r.r[0],r.r[1],k)[r.quantity];return escape(MOD[k]?.name||modelIndex?.[k]?.name||k)+': '+escape(impactFormat(v))+'<br>Δ(new − model): '+(v?Number((r.after.v-v.v).toPrecision(8)):'—');}).join('<br>')+(models.length?'':'—')+'</td></tr>').join(''):'<tr><td colspan="6">'+escape(T.loaded_impact_empty)+'</td></tr>';
    impact.querySelector('.nc-impact-pager').innerHTML=all.length>50?'<button type="button" data-impact-page="-1" '+(impactPage===0?'disabled':'')+'>←</button><span>'+(impactPage*50+1)+'–'+Math.min(all.length,impactPage*50+50)+' / '+all.length+'</span><button type="button" data-impact-page="1" '+((impactPage+1)*50>=all.length?'disabled':'')+'>→</button>':'';
  }
  function impactRebuild(){
    if(!impact.open||!inputTable)return;
    impactInputs();
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
  function openImpact(id='all'){if(!inputTable)return;measured?.flush();impactPage=0;impactQ.value='all';impactInputs();impactInput.value=inputTable.active.has(id)?id:'all';if(!impact.open)impact.showModal();impactLoad();}
  root.querySelector('[data-mass=impact]').onclick=()=>openImpact();
  root.addEventListener('zg-mass-impact',e=>openImpact(e.detail.id));
  impactInput.onchange=()=>{impactPage=0;impactRender();};
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
    chain = r || chain; filterFormula(); if (!chain) return;
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
    const ownMatches=!!USER.typed&&(USER.typed.quantity==='custom'?'mine':USER.typed.quantity)===pq.value;
    const ownControl=root.querySelector('[data-series=mine]');ownControl.disabled=!ownMatches;
    root.querySelector('[data-series-mine-label]').textContent=USER.typed?.label||T.m_mine;
    root.querySelector('[data-series-reference-label]').textContent='● ○# '+referenceName();
    root.querySelector('[data-series=ame]').disabled=pq.value==='mine';
    const hasNewGround=!!inputTable&&[...inputTable.active.values()].some(r=>!r.state.source_state_index);
    [...inputTable?.active.values()||[]].filter(r=>!r.state.source_state_index).map(r=>MM.labels(r.value,inputTable)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))).forEach(labels=>labelStyle(labels));
    for(const s of ['loaded','hybrid']){
      const control=root.querySelector('[data-series='+s+']');
      control.disabled=!hasNewGround;
      control.parentElement.title=hasNewGround?'':T.loaded_requires_ground;
    }
    const passPoint=(r,v,source)=>{
      const [z,n]=r,ame=get(z,n),mass=source==='loaded'||source==='hybrid'?getter('hybrid')(z,n):ame;
      const referenceDerived=derivedZN(z,n,'ame'),hybridDerived=derivedZN(z,n,'hybrid');
      const reference=['hl','beta2',...EXPQ].includes(pq.value)?ame:q[1](referenceDerived,r);
      return CP.experimentalFilter({mode:filter,centre:ame,reference,value:v,
        active:!!inputTable?.active.has(z+'-'+n+'-0'),
        affected:MM.affected(dependencyValue(pq.value,hybridDerived,q[1](hybridDerived,r))),mass,maxSigma});
    };
    const makePoint=(r,s)=>{
      const v=q[1](derivedZN(r[0],r[1],s==='loaded'?'hybrid':s),r);if(!v||!Number.isFinite(v.v)||!passPoint(r,v,s))return null;
      const primitiveValue=dependencyValue(pq.value,derivedZN(r[0],r[1],s==='loaded'?'hybrid':s),v),composition=CP.composition(primitiveValue);
      if(s==='hybrid'&&!composition.mixed||s==='loaded'&&!composition.experimental.length)return null;
      const labels=['loaded','hybrid'].includes(s)?MM.labels(primitiveValue,inputTable):[],style=seriesMeta(s,labels);
      return {r,x:xv(r[0],r[1]),y:v.v/1000,e:v.e==null?null:v.e/1000,est:!!v.est,g:group(r[0],r[1]),series:s,styleKey:style.key,labels,source:style.name,valueObj:v,dependencyValue:primitiveValue};
    };
    plotPts=[];modPts=[];residualPts=[];bands=[];plotHover=null;pointDetail(null);
    const centres=new Map(rows.filter(r=>belongs(r[0],r[1])).map(r=>[key(r[0],r[1]),r]));
    for(const r of inputTable?.active.values()||[])if(!r.state.source_state_index&&belongs(r.state.Z,r.state.N)&&!centres.has(key(r.state.Z,r.state.N)))centres.set(key(r.state.Z,r.state.N),[r.state.Z,r.state.N,r.state.element,null,null,0,-97,'—','',null,'',[]]);
    if(ownMatches)for(const r of USER.typed.rows)if(belongs(r.Z,r.N)&&!centres.has(key(r.Z,r.N)))centres.set(key(r.Z,r.N),[r.Z,r.N,(EL.find(e=>e[0]===r.Z)||[r.Z,'Z'+r.Z])[1],null,null,0,-97,'—','',null,'',[]]);
    for(const s of ['ame','loaded','hybrid']){
      if(!root.querySelector('[data-series='+s+']').checked||s!=='ame'&&(!advanced||!hasNewGround))continue;
      if(s!=='ame'&&['hl','beta2','dmod',...EXPQ].includes(pq.value))continue;
      for(const r of centres.values()){
        if(!inX(r[0],r[1])||s==='loaded'&&!inputTable?.active.has(r[0]+'-'+r[1]+'-0'))continue;
        const p=makePoint(r,s);if(p)plotPts.push(p);
      }
    }
    if(ownMatches&&ownControl.checked)for(const u of USER.typed.rows){
      if(!belongs(u.Z,u.N)||!inX(u.Z,u.N))continue;
      const r=centres.get(key(u.Z,u.N)),style=seriesMeta('mine');
      plotPts.push({r,x:xv(u.Z,u.N),y:u.value,e:u.sigma,est:false,g:group(u.Z,u.N),series:'mine',styleKey:style.key,labels:[u.label||T.m_mine],source:style.name,typed_provenance:u,valueObj:{v:u.value*1000,e:u.sigma===null?null:u.sigma*1000,est:false,uncertainty_model:'user-reported standard uncertainty; unknown stays unknown; no covariance supplied'}});
    }
    const modelKeys=selectedModels();
    const modelReason=modelKeys.length&&!advanced?T.loaded_cap:modelKeys.length&&['dme','hl','dmod',...EXPQ].includes(pq.value)?T.model_quantity:modelKeys.some(k=>modelErrors.has(k))?T.loaded_model_error:modelKeys.some(k=>!MOD[k])?T.loaded_model_loading:'';
    const modelNuclei=[];
    if(advanced&&!['dme','hl','dmod',...EXPQ].includes(pq.value))for(const mk of modelKeys){
      if(!MOD[mk])continue;
      for(const k of MOD[mk].map.keys()){
        const z=Math.floor(k/1000),n=k%1000;if(!belongs(z,n))continue;modelNuclei.push([z,n]);if(!inX(z,n))continue;
        const r=M.get(k)||Object.assign([z,n,(EL.find(e=>e[0]===z)||[z,'Z'+z])[1],null,null,0,-97,'—','',null,'',[]],{mo:true});
        const p=makePoint(r,mk);if(p)modPts.push(p);
      }
    }
    /* One point per mass input: the "New" value of an input nucleus and its "New + AME2020" value are the same number when the quantity needs no neighbour that is not new,
       so the duplicate New marker (and its legend line) is dropped; unequal values are both kept. */
    if(chainInput('merge')?.checked){const kept=CP.mergeDuplicateInputs(plotPts);plotPts.length=0;plotPts.push(...kept);}
    const sort=(a,b)=>a.series.localeCompare(b.series)||a.g-b.g||a.x-b.x;plotPts.sort(sort);modPts.sort(sort);
    plotPts.groups=[...new Set(plotPts.concat(modPts).map(p=>p.g))];
    const seriesRank=s=>s.id==='ame'?0:s.id==='loaded'?1:s.id==='hybrid'?2:3;
    visibleSeries=[...new Map(plotPts.concat(modPts).map(p=>[p.styleKey,seriesMeta(p.series,p.labels)])).values()].sort((a,b)=>seriesRank(a)-seriesRank(b)||a.name.localeCompare(b.name));
    markerControls();
    inputLegend=measured?measured.legend().filter(x=>plotPts.some(p=>['loaded','hybrid'].includes(p.series)&&Object.keys((p.dependencyValue||p.valueObj).terms||{}).some(id=>id.startsWith('loaded:'+x.id+':')))):[];
    root.querySelector('.nc-input-legend').textContent=inputLegend.map(x=>x.text).join(' · ');
    if(chainInput('band').checked){
      bands=CP.experimentalBands(plotPts);
    }
    if(chainInput('residual').checked&&!['hl','dme','dmod','beta2','atomic',...EXPQ].includes(pq.value)){
      for(const p of plotPts.concat(modPts).filter(p=>!['ame','mine'].includes(p.series))){
        const a=q[1](derived(p.r),p.r);if(!a)continue;
        const d=P.combine([1,p.valueObj],[-1,a]),model=!['loaded','hybrid'].includes(p.series);
        if(filter==='measured'&&d.est)continue;
        residualPts.push({...p,y:d.v,e:model?a.e:d.e,...CP.residualStyle(d,a,model),valueObj:d,dependencyValue:d,unit:pq.value==='bea'?'keV/nucleon':'keV',panel:'residual',source:p.source+' − AME2020'});
      }
    }
    root.querySelector('.nc-residual-panel').hidden=!chainInput('residual').checked;
    root.querySelector('.nc-series-legend').innerHTML=visibleSeries.map(s=>'<span style="--series-color:'+legendColor(s)+'"><b aria-hidden="true">'+legendGlyph(s)+'</b> '+escape(s.name)+' ('+plotPts.concat(modPts).filter(p=>inSeries(p,s)).length+')</span>').join('');
    const label=(ch==='Z'?T.p_iso:ch==='N'?T.p_isot:T.p_isob)+': '+ch+' = '+first+(shown>1?'–'+(first+shown-1):'');
    pinfo.textContent=label+' · '+q[0]+' · '+(plotPts.length+modPts.length)+' '+T.points+' · '+T.chain_count.replace('{shown}',shown).replace('{total}',total)+(modelReason?' · '+modelReason:'')+(!advanced&&modelReason!==T.loaded_cap&&['loaded','hybrid'].some(s=>root.querySelector('[data-series='+s+']').checked)?' · '+T.loaded_cap:'')+' · '+bands.length+' '+T.loaded_band_points+(hasNewGround&&root.querySelector('[data-series=hybrid]').checked&&!plotPts.some(p=>p.series==='hybrid')?' · '+T.loaded_no_mixed:'');
    const fullX=[...centres.values()].map(r=>xv(r[0],r[1])).concat(modelNuclei.map(([z,n])=>xv(z,n)));
    plotDomain=CP.chainExtent(plotPts,modPts,{xMode:chainInput('xscale').value,yMode:chainInput('yscale').value,fullX,errors:chainInput('axis-errors').checked,manual:Object.fromEntries(['x0','x1','y0','y1'].map(k=>[k,axisNumber('axis-'+k)]))});
    root.querySelector('.nc-axis-note').textContent=(plotDomain.warnings.length?T.axis_invalid+' · ':'')+T.axis_offscale;
    root.querySelector('.nc-manual-x').hidden=chainInput('xscale').value!=='manual';root.querySelector('.nc-manual-y').hidden=chainInput('yscale').value!=='manual';
    pc.setAttribute('aria-label',label+'; '+q[0]+'; x '+plotDomain.x0+'–'+plotDomain.x1+'; '+(plotPts.length+modPts.length)+' '+T.points);
    pointTable();resize();drawPlot();drawResidual();
  }
  /* "revised": the whole chain with the new inputs (AME2020 values replaced by the New + AME2020 value where one exists);
     "changed": only the segments that touch a changed point. Lines run through the true N; only the markers are offset. */
  function drawRevised(c,px,py,group,hyb,mode){
    c.save();c.lineJoin='round';c.lineCap='round';c.beginPath();
    for(const [a,b] of CP.revisedSegments(plotPts.filter(p=>p.series==='ame'&&p.g===group),hyb,mode)){c.moveTo(px(a.x),py(a.y));c.lineTo(px(b.x),py(b.y));}
    c.stroke();c.restore();
  }
  function drawBands(c,points,px,py,sc=1){
    if(!chainInput('band').checked)return;
    const grouped=new Map();for(const p of CP.experimentalBands(points)){
      const k=p.styleKey+':'+p.g;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(p);
    }
    c.save();c.globalAlpha=.16;
    for(const ps of grouped.values()){
      ps.sort((a,b)=>a.x-b.x);c.fillStyle=pointColor(ps[0],seriesMeta(ps[0].series,ps[0].labels));
      for(const p of ps)c.fillRect(px(p.x)-2*sc,py(p.hi),4*sc,Math.max(.5*sc,py(p.lo)-py(p.hi)));
      if(chainInput('lines').checked)for(let i=1;i<ps.length;i++){
        const a=ps[i-1],b=ps[i];if(!CP.connects(a,b))continue;
        c.beginPath();c.moveTo(px(a.x),py(a.lo));c.lineTo(px(a.x),py(a.hi));c.lineTo(px(b.x),py(b.hi));c.lineTo(px(b.x),py(b.lo));c.closePath();c.fill();
      }
    }c.restore();
  }
  function drawPlot(c = pg, Wd = pc._cw, Hd = pc._ch, sc = 1) {
    const st=chainStyle(),lw=lineWidth()*st.lineWidth,mark=st.markerDiameter/7.2;
    if (c === pg) pg.setTransform(pc.width / pc._cw, 0, 0, pc.height / pc._ch, 0, 0);
    c.clearRect(0, 0, Wd, Hd); c.fillStyle = sc > 1 ? "#fff" : "transparent"; if (sc > 1) c.fillRect(0, 0, Wd, Hd);
    if (!plotPts.length && !modPts.length) { c.fillStyle = "#888"; c.font = `${st.axisSize * sc}px system-ui`; c.fillText(chain ? T.loaded_no_points : T.p_hint, 20 * sc, 30 * sc); return; }
    const { x0,x1,y0,y1 } = plotDomain, geom = plotGeom(plotDomain,Wd,Hd,sc);
    const { L,R,T:Tp,B,px,py } = geom;
    c.strokeStyle = "rgba(127,127,160,.45)"; c.lineWidth = 0.45 * lw * sc; c.strokeRect(L, Tp, Wd - L - R, Hd - B - Tp);
    c.fillStyle = sc > 1 ? "#222" : ink; c.font = `${st.tickSize * sc}px system-ui`; c.textAlign = "center";
    const xTicks = Math.max(2, Math.min(12, Math.floor((Wd - L - R) / (45 * sc))));
    niceTicks(x0, x1, xTicks).filter(x => Number.isInteger(x)).forEach(x => { c.fillText(x, px(x), Hd - B + 15 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(px(x), Tp); c.lineTo(px(x), Hd - B); c.stroke(); c.restore(); });
    c.font=`${st.axisSize * sc}px system-ui`;
    const ch = pchain.value; c.fillText(ch === "Z" ? "N" : "Z", (L + Wd - R) / 2, Hd - 8 * sc);
    c.font=`${st.tickSize * sc}px system-ui`;c.textAlign = "right"; niceTicks(y0, y1, 6).forEach(y => { c.fillText(fmtTick(y), L - 6 * sc, py(y) + 4 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(L, py(y)); c.lineTo(Wd - R, py(y)); c.stroke(); c.restore(); });
    c.font=`${st.axisSize * sc}px system-ui`;c.save(); c.translate((st.axisSize+3) * sc, (Tp + Hd - B) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText(`${PQ[pq.value][0]}${PQ[pq.value][2] ? " (" + PQ[pq.value][2] + ")" : ""}`, 0, 0); c.restore();
    c.strokeStyle = "rgba(229,72,77,.35)"; c.setLineDash([4 * sc, 4 * sc]);
    MAGIC.forEach(m => { if (m > x0 && m < x1) { c.beginPath(); c.moveTo(px(m), Tp); c.lineTo(px(m), Hd - B); c.stroke(); } }); c.setLineDash([]);
    c.save(); c.beginPath(); c.rect(L,Tp,Wd-L-R,Hd-B-Tp); c.clip();
    const groups=plotPts.groups||[],multi=groups.length>1;
    const gcol=chainColor;
    const showLine=chainInput('lines').checked,showErr=chainInput('err').checked;
    const modeSetting=chainInput('linemode').value||'series',dodge=Math.max(0,Math.min(.4,Number(chainInput('dodge').value)||0)),shiftOf=series=>CP.seriesShift(series,dodge);   /* publication options: line mode and marker offset */
    drawBands(c,plotPts,px,py,sc);
    // Mixed calculations first, then the reference and new input centres.
    const paintOrder=visibleSeries.slice().sort((a,b)=>(a.id==='loaded'?2:a.id==='ame'?1:0)-(b.id==='loaded'?2:b.id==='ame'?1:0));
    for(const s of paintOrder)for(const group of groups){
      const ps=plotPts.concat(modPts).filter(p=>inSeries(p,s)&&p.g===group);if(!ps.length)continue;
      const col=pointColor(ps[0],s);
      c.strokeStyle=col;c.lineWidth=(s.shape==='model'?1:1.2)*lw*sc;c.setLineDash(s.shape==='model'?[6*sc,4*sc]:s.id==='hybrid'?[2*sc,3*sc]:[]);
      const hybridSets=visibleSeries.filter(v=>v.id==='hybrid').length,lineMode=modeSetting==='revised'&&hybridSets>1?'changed':modeSetting,revisedLine=showLine&&s.id==='hybrid'&&(lineMode==='revised'||lineMode==='changed');   /* several input sets: each colours only its own changed segments */
      if(revisedLine){c.setLineDash([]);c.lineWidth=1.7*lw*sc;drawRevised(c,px,py,group,ps,lineMode);}
      else if(showLine&&s.id!=='loaded'){c.beginPath();ps.forEach((p,i)=>i&&CP.connects(ps[i-1],p)?c.lineTo(px(p.x),py(p.y)):c.moveTo(px(p.x),py(p.y)));c.stroke();}c.setLineDash([]);
      for(const p of ps){
        if(p.x<x0||p.x>x1)continue;
        const xx=px(p.x+shiftOf(p.series)),yy=py(p.y),color=col;c.strokeStyle=color;c.fillStyle=color;
        if(p.y<y0||p.y>y1){const y=geom.clampY(p.y),sign=p.y>y1?1:-1;c.beginPath();c.moveTo(xx,y);c.lineTo(xx-4*sc,y+sign*7*sc);c.lineTo(xx+4*sc,y+sign*7*sc);c.closePath();c.fill();continue;}
        if(showErr&&p.e>0){c.beginPath();c.moveTo(xx,py(p.y-p.e));c.lineTo(xx,py(p.y+p.e));for(const ey of [p.y-p.e,p.y+p.e]){c.moveTo(xx-3*sc,py(ey));c.lineTo(xx+3*sc,py(ey));}c.stroke();}
        const radius=(s.shape==='model'?1.8:multi?2.8:3.6)*mark*sc;
        const background=sc>1?'#fff':getComputedStyle(document.documentElement).getPropertyValue('--zg-card').trim()||'#fff';
        CP.paintMarker(c,s.shape,xx,yy,radius,color,p.est||s.open,background);
        if(chainInput('reference-ring').checked&&chain&&p.r[0]===chain[0]&&p.r[1]===chain[1]){c.strokeStyle='#e5484d';c.lineWidth=1.5*sc;c.beginPath();c.arc(xx,yy,7*sc,0,6.283);c.stroke();}
      }
    }
    c.restore();
    if(multi)groups.forEach(gk=>{const ps=plotPts.filter(p=>p.series==='ame'&&p.g===gk&&p.x>=x0&&p.x<=x1);if(!ps.length)return;const p=ps[ps.length-1];c.fillStyle=gcol(gk);c.font=st.tickSize*10/11*sc+'px system-ui';c.textAlign='left';c.fillText(ch+'='+gk,Math.min(px(p.x)+5*sc,Wd-R+4*sc),geom.clampY(p.y)+3*sc);});
    c.textAlign='center';c.fillStyle=sc>1?'#222':ink;c.font=st.titleSize*sc+'px system-ui';titleLines(Wd/sc).forEach((text,i)=>c.fillText(text,Wd/2,(st.titleSize+2+i*st.titleSize*1.35)*sc));
    c.textAlign='left';c.font=st.legendSize*sc+'px system-ui';
    const legendLines=seriesLegendLines(Wd/sc);
    legendLines.forEach((line,i)=>{const y=(titleHeight(Wd/sc)+12+i*legendRow())*sc;if(line.first){c.fillStyle=legendColor(line.style);c.fillText(line.glyph||legendGlyph(line.style),L,y);}c.fillStyle=sc>1?'#222':ink;c.fillText(line.text,L+40*sc,y);});
    c.fillStyle=sc>1?'#222':ink;inputLegendLines(Wd/sc).forEach((text,i)=>c.fillText(text,L,(titleHeight(Wd/sc)+12+legendRow()*(legendLines.length+i))*sc));
    if (plotHover && sc === 1 && plotHover.r) {
      const p = plotHover, value = p.e == null ? Number(p.y.toPrecision(7)).toString() : (([a,b])=>p.e>0?a+(p.est?'#':'')+' ± '+b:a)(fmtU(p.y,p.e));
      c.fillStyle=ink;c.textAlign='left';c.font=st.tickSize*12/11+'px system-ui';
      const width=Wd-L-R-8, text=`${sup(p.r[0]+p.r[1])}${p.r[2]}: ${value}${p.source?' ('+p.source+')':''}`, lines=[];
      let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
      const left=Math.max(L+4,Math.min(px(p.x)+8,Wd-R-width)), top=Math.max(Tp+16,Math.min(geom.clampY(p.y)-10,Hd-B-lines.length*14));
      lines.forEach((s,i)=>c.fillText(s,left,top+i*14));
    }
  }
  function drawResidual(c=rg,width=pc._cw,height=Math.max(230,Math.min(320,width*.45)),exporting=false){
    const st=chainStyle(),mark=st.markerDiameter/7.2;
    if(!plotDomain||root.querySelector('.nc-residual-panel').hidden)return;
    if(c===rg){sizeCanvas(rc,width,height);c.setTransform(rc.width/width,0,0,rc.height/height,0,0);}c.clearRect(0,0,width,height);if(exporting){c.fillStyle='#fff';c.fillRect(0,0,width,height);}
    if(!residualPts.length){
      residualDomain=null;c.fillStyle=exporting?'#222':ink;c.font=st.tickSize*12/11+'px system-ui';c.textAlign='left';
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
    const geom=residualGeom(domain,width,height),{L,R,T:top,B,px,py}=geom;
    c.lineWidth=lineWidth()*st.lineWidth;c.strokeStyle='rgba(127,127,160,.5)';c.strokeRect(L,top,width-L-R,height-B-top);c.fillStyle=exporting?'#222':ink;c.font=st.tickSize+'px system-ui';
    c.textAlign='right';niceTicks(domain.y0,domain.y1,4).forEach(y=>c.fillText(fmtTick(y),L-5,py(y)+3));c.textAlign='center';
    niceTicks(domain.x0,domain.x1,Math.max(2,Math.floor((width-L-R)/50))).filter(Number.isInteger).forEach(x=>c.fillText(x,px(x),height-B+15));
    c.font=st.titleSize+'px system-ui';c.fillText('Δ ('+(pq.value==='bea'?'keV/nucleon':'keV')+') = series − AME2020',(L+width-R)/2,Math.max(12,st.titleSize+1));c.beginPath();c.moveTo(L,py(0));c.lineTo(width-R,py(0));c.stroke();
    c.save();c.beginPath();c.rect(L,top,width-L-R,height-B-top);c.clip();
    const showLine=chainInput('lines').checked,showErr=chainInput('err').checked;
    drawBands(c,residualPts,px,py);
    for(const s of visibleSeries.filter(s=>s.id!=='ame'))for(const group of plotPts.groups||[]){
      const ps=residualPts.filter(p=>inSeries(p,s)&&p.g===group);c.strokeStyle=s.color;c.fillStyle=s.color;c.setLineDash(s.shape==='model'?[5,3]:s.id==='hybrid'?[2,3]:[]);
      if(showLine&&s.id!=='loaded'){c.beginPath();ps.forEach((p,i)=>i&&CP.connects(ps[i-1],p)?c.lineTo(px(p.x),py(p.y)):c.moveTo(px(p.x),py(p.y)));c.stroke();}c.setLineDash([]);
      ps.forEach(p=>{const x=px(p.x+shiftOf(p.series)),y=py(p.y),background=exporting?'#fff':getComputedStyle(document.documentElement).getPropertyValue('--zg-card').trim()||'#fff';CP.paintMarker(c,s.shape,x,y,2.5*mark,s.color,p.est||s.open,background);if(showErr&&p.e>0){c.beginPath();c.moveTo(x,py(p.y-p.e));c.lineTo(x,py(p.y+p.e));c.stroke();}});
    }
    c.restore();if(c===rg)rc.setAttribute('aria-label','Δ = series − AME2020, keV; shared x '+domain.x0+'–'+domain.x1+'; '+residualPts.length+' points');
  }
  rc.addEventListener('mousemove',e=>{if(!residualDomain)return;const b=rc.getBoundingClientRect(),geom=residualGeom(residualDomain,rc._cw,rc._ch);pointDetail(CP.nearest(residualPts,(e.clientX-b.left)*rc._cw/b.width,(e.clientY-b.top)*rc._ch/b.height,geom));});
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
  pq.onchange = () => { if (["beta2", "dmod"].includes(pq.value) && !Object.keys(MOD).length) loadModels().then(() => plotChain()); const au = EXPQ.includes(pq.value) && MODES[pq.value].aux; if (au && !AUX[au]) loadAux(au).then(() => plotChain()).catch(() => plotChain()); plotChain(); };
  root.querySelectorAll(".nc-prange input, [name=nc-lines], [name=nc-err], [name=nc-reference-ring], [name=nc-linemode], [name=nc-dodge], [name=nc-muteame], [name=nc-merge], [name=nc-legendsplit]").forEach(el => el.addEventListener("input", () => plotChain()));
  /* One choice that sets the options together: "publication" = revised curve in colour over a grey AME2020 line, markers offset, error bars, no reference ring. */
  chainInput('pubpreset')?.addEventListener('change',e=>{
    const v=e.target.value;if(!v)return;
    const set=(n,x)=>{const el=chainInput(n);if(!el)return;if(el.type==='checkbox')el.checked=!!x;else el.value=x;};
    if(v==='publication'){set('lines',true);set('linemode','revised');set('dodge',.12);set('muteame',true);set('err',true);set('band',false);set('reference-ring',false);set('merge',true);set('legendsplit',true);}
    else{set('lines',true);set('linemode','series');set('dodge',0);set('muteame',false);set('err',true);set('reference-ring',true);set('legendsplit',false);}
    plotChain();
  });
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
  const csvRow = r => {
    const d = derived(r), info = o => o ? [!!o.est, !!o.sigmaEst,
      o.uncertainty_model || (o.e == null ? 'uncertainty unavailable' : 'AME2020 tabulated marginal mass uncertainty'),
      o.source || (o.uncertainty_model ? 'AME2020 marginal masses; recalculated' : 'AME2020 mass table')] : ['', '', '', ''];
    const f = o => o ? [String(o.v / 1000), o.e == null ? '' : String(o.e / 1000), o.est ? '#' : '', ...info(o)] : ['', '', '', '', '', '', ''];
    const m = src !== "ame" && MOD[src] ? MOD[src].map.get(key(r[0], r[1])) : null;
    const modelInfo = m ? [false, false, 'model uncertainty unavailable', MOD[src].name || src] : ['', '', '', ''];
    return [r[0], r[1], r[0] + r[1], r[2], d.me ? d.me.v : '', d.me ? d.me.e ?? '' : '', d.me?.est ? '#' : '', ...info(d.me), ...f(d.BEA), ...f(d.sn), ...f(d.s2n), ...f(d.sp), ...f(d.s2p), ...f(d.qbm), ...f(d.qec), ...f(d.qa), ...f(d.d3n), ...f(d.d3p), ...f(d.vpn), ...Object.keys(window.ZGMassSurface.filters).flatMap(k=>f(d[k])), ...window.ZGMassSurface.quantities.filter(k=>k.startsWith('q')&&!['qbm','qec','qa'].includes(k)).flatMap(k=>f(d[k])), ...['BE','d2n','d2p','d5n','d5p','wig'].flatMap(k=>f(d[k])), r[7], r[8], r[10], r[9] || '', r[11].length, ...(src !== 'ame' ? [m ? m[0] : '', m && m[1] != null ? m[1] / 1000 : '', ...modelInfo] : [])];
  };
  const csvHead = () => {
    const info = k => [k+'_value_extrapolated', k+'_uncertainty_extrapolated', k+'_uncertainty_basis', k+'_source'];
    const f = k => { const unit = k === 'BE/A' ? 'MeV_per_nucleon' : 'MeV'; return [k+'_'+unit, 'd'+k+'_'+unit, k+'_flag', ...info(k)]; };
    return ['Z', 'N', 'A', 'El', 'ME_keV', 'dME_keV', 'ME_flag', ...info('ME'), ...['BE/A', 'Sn', 'S2n', 'Sp', 'S2p', 'Qbeta-', 'QEC', 'Qalpha', 'D3n', 'D3p', 'dVpn'].flatMap(f), ...Object.keys(window.ZGMassSurface.filters).flatMap(f), ...window.ZGMassSurface.quantities.filter(k=>k.startsWith('q')&&!['qbm','qec','qa'].includes(k)).flatMap(f), ...['BE','d2n','d2p','d5n','d5p','wig'].flatMap(f), 'T1/2', 'Jpi', 'decay_modes', 'discovery_year', 'isomers', ...(src !== 'ame' ? ['ME_keV_'+src, 'beta2_'+src, ...info('ME_'+src)] : [])];
  };
  root.querySelector("[name=nc-line-width]").onchange = () => { draw(); drawPlot(); drawResidual(); };
  root.querySelector("[data-nc=png]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = W() * sc; o.height = H() * sc; draw(o.getContext("2d"), o.width, o.height, sc); return o; }, "chart-of-nuclides", 6);
  root.querySelector("[data-nc=csv]").onclick = () => X.csv(csvHead(), allRows().filter(pass).map(csvRow), "ame2020-nubase2020" + (filt === "all" ? "" : "-" + filt) + (src === "ame" ? "" : "-with-" + src));
  root.querySelector("[data-nc=video]").onclick = e => {
    const b = e.currentTarget, tour = [rows.find(r => r[0] === 50 && r[1] === 50), rows.find(r => r[0] === 55 && r[1] === 78), rows.find(r => r[0] === 82 && r[1] === 126)].filter(Boolean);
    const keep = [cv._cw, cv._ch], hi = () => { cv.width = Math.round(cv._cw * 3); cv.height = Math.round(cv._ch * 3); draw(); };
    hi();   /* record the tour at 3× the displayed size */
    X.record(cv, 9, "chart-of-nuclides-tour", on => { b.disabled = on; b.classList.toggle("is-rec", on); if (!on) { sizeCanvas(cv, keep[0], keep[1]); draw(); } });
    fit(); let i = 0; const next = () => { if (i < tour.length) { const r = tour[i++]; pin = r; zoomTo(r, 30, () => setTimeout(next, 900)); } else setTimeout(fit, 400); }; setTimeout(next, 600);
  };
  root.querySelector("[data-nc=ppng]").onclick = () => {if(!chainFigureStyle.valid())return;return X.png(sc => {
    const o=document.createElement('canvas'),includeResidual=!root.querySelector('.nc-residual-panel').hidden;
    const residualHeight=includeResidual?Math.max(230,Math.min(320,pc._cw*.45)):0,gap=includeResidual?18:0;
    o.width=pc._cw*sc;o.height=(pc._ch+gap+residualHeight)*sc;
    const ctx=o.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,o.width,o.height);drawPlot(ctx,o.width,pc._ch*sc,sc);
    if(includeResidual){ctx.save();ctx.setTransform(sc,0,0,sc,0,(pc._ch+gap)*sc);drawResidual(ctx,pc._cw,residualHeight,true);ctx.restore();}
    return o;
  },FS.exportName(chainStyle(),"chain-"+pq.value),chainStyle().rasterWidth/pc._cw);};
  root.querySelector("[data-nc=pcsv]").onclick = () => {
    if(!plotDomain||!chainFigureStyle.valid())return;
    const points=plotPts.concat(modPts).map(p=>({...p,panel:'value',unit:PQ[pq.value][2]})).concat(residualPts);
    X.csv(['panel','chain_type','chain','x','Z','N','A','element','quantity','unit','value','uncertainty','uncertainty_basis','flag','series','source','input_provenance','loaded_table_sha256','AME_version','model_source_url','model_raw_sha256','axis_x0','axis_x1','axis_y0','axis_y1','input_labels','marker','marker_open','color','AME_reference_extrapolated','experimental_band_lower','experimental_band_upper','value_extrapolated','uncertainty_extrapolated','figure_style_json','line_mode','marker_offset_N','AME_grey'],
      points.map(p=>{const s=seriesMeta(p.series,p.labels);return [p.panel,pchain.value,p.g,p.x,p.r[0],p.r[1],p.r[0]+p.r[1],p.r[2],pq.value,p.unit,p.y,p.e??'',MOD[p.series]?(p.panel==='residual'?'AME only; model uncertainty unavailable':'unavailable model uncertainty'):(p.valueObj?.uncertainty_model||'independent primitives; shared terms cancelled'),p.est?'#':'',p.series,p.valueObj?.source||p.source,JSON.stringify(p.typed_provenance?[p.typed_provenance]:MM.provenance(p.dependencyValue||p.valueObj,inputTable)),measured.hash(),'AME2020/NUBASE2020',MOD[p.series]?.url||'',MOD[p.series]?.source?.raw_sha256||MOD[p.series]?.source?.sha256||'',plotDomain.x0,plotDomain.x1,p.panel==='value'?plotDomain.y0:residualDomain?.y0??'',p.panel==='value'?plotDomain.y1:residualDomain?.y1??'',JSON.stringify(p.labels||[]),s.shape,!!(p.est||s.open),pointColor(p,s),!!p.referenceEstimated,chainInput('band').checked&&['ame','loaded','hybrid'].includes(p.series)&&!p.est&&p.e>0?p.y-p.e:'',chainInput('band').checked&&['ame','loaded','hybrid'].includes(p.series)&&!p.est&&p.e>0?p.y+p.e:'',!!p.est,!!p.valueObj?.sigmaEst,JSON.stringify(chainStyle()),chainInput('lines').checked?(chainInput('linemode').value||'series'):'none',Number(chainInput('dodge').value)||0,!!chainInput('muteame').checked];}),FS.exportName(chainStyle(),'chain-'+pq.value));
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
  root.querySelector("[data-nc=random]").onclick = () => { const p = rows.filter(pass), r = p[Math.floor(Math.random() * p.length)]; if (!r) return; pin = r; zoomTo(r); showCard(r); plotChain(r); };
  sel.innerHTML = window.ZGMassQuantityMenu.html(Object.fromEntries(Object.entries(MODES).map(([k,m])=>[k,m.label])),T);
  sel.value=mode;
  function changeColourMode() {
    mode = sel.value; manualRange = null; isolate.clear(); isolateMode = "";
    const refresh = () => { memo.clear(); drawLegend(); draw(); syncColourControls(); };
    if (MODES[mode].need && !Object.keys(MOD).length) loadModels().then(refresh).catch(modelFailure);
    const au = MODES[mode].aux;
    if (au && !AUX[au]) loadAux(au).then(refresh).catch(() => {});
    refresh();
  }
  sel.onchange = changeColourMode;

  /* ---- parity filters, hotkeys, isomer marks and the colour of empty cells ---- */
  {
    const q = n => root.querySelector('[name="' + n + '"]'), zS = q("nc-zpar"), nS = q("nc-npar"), isoC = q("nc-isomark"), emC = q("nc-empty"), hk = root.querySelector(".nc-hotkey-status");
    const say = (key, v) => { if (hk) hk.textContent = fill(T[key], { v }); }, onoff = b => b ? T.hk_on : T.hk_off;
    const refresh = () => { memo.clear(); fsel.onchange(); };
    if (zS) zS.onchange = () => { zpar = zS.value; refresh(); };
    if (nS) nS.onchange = () => { npar = nS.value; refresh(); };
    if (isoC) isoC.onchange = () => { isoMark = isoC.checked; draw(); };
    if (emC) emC.oninput = () => { emptyColour = emC.value; memo.clear(); draw(); };
    cv.tabIndex = 0; cv.addEventListener("pointerdown", () => cv.focus({ preventScroll: true }));
    cv.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase(); let used = true;
      if (k === "m") { const b = ovl && ovl.querySelector("[data-opt=magic]"); if (b) { b.checked = !b.checked; draw(); say("hk_magic", onoff(b.checked)); } }
      else if (k === "p") { zpar = CL.nextParity(zpar); if (zS) zS.value = zpar; refresh(); say("hk_zpar", T["par_" + zpar]); }
      else if (k === "n") { npar = CL.nextParity(npar); if (nS) nS.value = npar; refresh(); say("hk_npar", T["par_" + npar]); }
      else if (k === "i") { isoMark = !isoMark; if (isoC) isoC.checked = isoMark; draw(); say("hk_iso", onoff(isoMark)); }
      else if (k === "d") { let i = sel.selectedIndex, n = sel.options.length; do { i = (i + 1) % n; } while (sel.options[i].value === "mine" && !USER.map.size && n > 1); sel.selectedIndex = i; sel.onchange(); say("hk_mode", sel.options[i].text); }
      else if (k === "g") { pin = null; showCard(null); fit(); }
      else if (k === "s") search.focus();
      else used = false;
      if (used) e.preventDefault();
    });
  }

  /* ---- divided colour bar (default off: the continuous bar) ---- */
  {
    const q = n => root.querySelector('[name="' + n + '"]'), cOn = q("nc-classes"), cN = q("nc-class-n"), cM = q("nc-class-method"), cE = q("nc-class-edges"), cS = q("nc-class-scheme"), note = root.querySelector(".nc-class-note");
    if (cOn && cN && cM && cE && cS) {
      const sync = syncClassControls = () => {
        const m = MODES[mode], off = !!m.f || !m.v, on = cOn.checked && !off, manual = cM.value === "manual";
        cOn.disabled = off; cN.disabled = !on || manual; cM.disabled = !on; cE.hidden = !manual; cE.disabled = !on || !manual; cS.disabled = !on || !!m.div;
        note.textContent = off ? T.cl_off_mode : on && m.div && !manual && classMethod === "equal" ? fill(T.cl_note_zero, { n: classState ? classState.edges.length + 1 : "" }) : "";
      };
      const apply = () => { classOn = cOn.checked; classN = Math.max(3, Math.min(20, Math.round(Number(cN.value)) || 9)); classMethod = cM.value; classText = cE.value; classScheme = cS.value; isolate.clear(); isolateMode = ""; memo.clear(); drawLegend(); draw(); sync(); };
      [cOn, cM, cS].forEach(e => { e.onchange = apply; }); cN.oninput = cE.oninput = apply;
      legend.addEventListener("click", e => {
        const b = e.target.closest("[data-class]"); if (!b) return;
        const k = b.dataset.class;
        if (k === "all") isolate.clear(); else { const key = k === "none" ? "none" : Number(k); if (isolateMode !== mode) isolate.clear(); isolate.has(key) ? isolate.delete(key) : isolate.add(key); }
        isolateMode = mode; draw(); drawStats();
      });
      cv.addEventListener("keydown", e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "c" && !cOn.disabled) { cOn.checked = !cOn.checked; apply(); const h = root.querySelector(".nc-hotkey-status"); if (h) h.textContent = fill(T.hk_class, { v: cOn.checked ? T.hk_on : T.hk_off }); e.preventDefault(); } });
      sync();
    }
  }

  /* ---- manual colour range and the visitor's own data layer ---- */
  {
    const q = n => root.querySelector('[name="' + n + '"]'), chk = q("nc-range-manual"), minI = q("nc-range-min"), maxI = q("nc-range-max"), note = root.querySelector(".nc-range-note"), autoB = root.querySelector('[data-nc="range-auto"]'), fullB = root.querySelector('[data-nc="range-full"]');
    const ta = q("nc-mine-text"), fileI = q("nc-mine-file"), colS = q("nc-mine-col"), status = root.querySelector(".nc-mine-status"), UD = window.ZGChartUserData, TD=window.ZGChartTypedData;
    const redraw = () => { memo.clear(); drawLegend(); draw(); };
    const clearValidity = () => { [minI, maxI].forEach(e => { e.setCustomValidity(""); e.removeAttribute("aria-invalid"); }); };
    function syncRange() {
      const m = MODES[mode], off = !!m.f || !m.v; [chk, autoB, fullB].forEach(e => { if (e) e.disabled = off; });
      minI.disabled = maxI.disabled = off || !manualRange;
      clearValidity();
      const bd = bounds(m); chk.checked = !!manualRange; if (!off) { minI.value = rangeLabel(bd.lo); maxI.value = rangeLabel(bd.hi, true); }
      note.textContent = off ? (T.range_off_mode || T.cl_off_mode) : m.rng ? T.range_log : "";
    }
    syncRangeControls = syncRange;
    function applyManual() {
      if (chk.disabled || !chk.checked) return;
      minI.disabled = maxI.disabled = false;
      const lo = Number(minI.value), hi = Number(maxI.value);
      if (minI.value === "" || maxI.value === "" || !Number.isFinite(lo) || !Number.isFinite(hi) || !(lo < hi)) { note.textContent = T.range_bad; [minI, maxI].forEach(e => { e.setCustomValidity(T.range_bad); e.setAttribute("aria-invalid", "true"); }); return; }
      clearValidity(); manualRange = { lo, hi }; note.textContent = MODES[mode].rng ? T.range_log : ""; redraw(); syncClassControls();
    }
    chk.onchange = () => { if (!chk.checked) { manualRange = null; syncRange(); redraw(); } else applyManual(); };
    minI.oninput = maxI.oninput = applyManual;
    const dataRange = full => {   /* full: the true minimum and maximum; otherwise the 2–98 % window that ignores a few outliers */
      const m = MODES[mode], vals = []; if (m.f) return;
      for (const r of allRows()) { if (!pass(r)) continue; const v = m.v(r); if (v != null && Number.isFinite(v)) vals.push(v); }
      const rr = full ? UD.range(vals) : UD.robustRange(vals); if (!rr) { note.textContent = T.mine_empty || "no values"; return; }
      let [lo, hi] = rr; if (hi === lo) { lo -= 0.5; hi += 0.5; }
      if (m.div && !full) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
      manualRange = { lo, hi }; syncRange(); redraw(); syncClassControls();
    };
    autoB.onclick = () => dataRange(false); if (fullB) fullB.onclick = () => dataRange(true);
    syncRange();
    // own data
    const symbolMap = () => new Map((EL || []).map(e => [e[1], e[0]]));
    const quantityS=q('nc-mine-quantity'),unitS=q('nc-mine-unit'),sigmaS=q('nc-mine-sigma'),customUnit=q('nc-mine-custom-unit'),labelI=q('nc-mine-label'),referenceI=q('nc-mine-reference');
    const appendB=root.querySelector('[data-nc=mine-append]'),replaceB=root.querySelector('[data-nc=mine-replace]');
    const option=(value,text)=>Object.assign(document.createElement('option'),{value,textContent:text});
    quantityS.replaceChildren(option('custom',T.mine_custom),...Object.keys(TD.specs).filter(k=>PQ[k]).map(k=>option(k,PQ[k][0])));
    function syncUnits(preferred){
      unitS.replaceChildren(...TD.units(quantityS.value).map(u=>option(u,u==='custom'?T.mine_custom:u)));
      if(TD.units(quantityS.value).includes(preferred))unitS.value=preferred;
      root.querySelector('.nc-mine-custom-unit').hidden=quantityS.value!=='custom';
    }
    syncUnits();
    const options=()=>({quantity:quantityS.value,unit:unitS.value,customUnit:customUnit.value,valueColumn:colS.value,sigmaColumn:sigmaS.value,label:labelI.value,reference:referenceI.value});
    function inputError(e){status.textContent=(T.error_prefix||'Check input: ')+(T['mine_error_'+e.message]||e.message);appendB.disabled=replaceB.disabled=true;}
    function columns(parsed,value=colS.value,sigma=sigmaS.value){
      colS.replaceChildren(...parsed.valueColumns.map(c=>option(c,c)));if(parsed.valueColumns.includes(value))colS.value=value;
      sigmaS.replaceChildren(option('',T.mine_unknown),...parsed.valueColumns.map(c=>option(c,c)));if(parsed.valueColumns.includes(sigma)&&sigma!==colS.value)sigmaS.value=sigma;
    }
    function build(focus=false){
      if(!USER.parsed)return false;
      try{
        const typed=TD.adapt(USER.parsed,options()),map=new Map(typed.rows.map(r=>[key(r.Z,r.N),r.value]));
        USER.typed=typed;USER.map=map;USER.column=colS.value;autoCache.clear();
        const matched=typed.rows.filter(r=>M.has(key(r.Z,r.N))).length,rg=UD.range([...map.values()]);
        if(rg){MODES.mine.lo=rg[0];MODES.mine.hi=rg[1]>rg[0]?rg[1]:rg[0]+1;}
        MODES.mine.label=T.m_mine+' ('+typed.unit+')';
        const colourOption=sel.querySelector('option[value=mine]');if(colourOption)colourOption.textContent=MODES.mine.label;
        PQ.mine[0]=typed.label||T.m_mine;PQ.mine[2]=typed.unit;
        appendB.disabled=replaceB.disabled=!typed.massAdoptable;
        const preview=root.querySelector('.nc-mine-preview');preview.textContent='';
        if(typed.massAdoptable){
          try{preview.textContent=T.mine_conversion_preview+' '+TD.massRows(typed).slice(0,3).map((r,i)=>{const normalized=MM.normalize(r,i,catalog);return (r.Z+r.N)+(EL.find(e=>e[0]===r.Z)||[r.Z,'Z'+r.Z])[1]+': '+r.quantity+' = '+r.value+' ± '+(r.uncertainty??T.mine_unknown)+' '+r.unit+(r.quantity==='bea'?' · BE = '+Number((r.value*(r.Z+r.N)).toPrecision(10))+' '+r.unit.replace('/nucleon',''):'')+' → ME = '+Number(normalized.me.toPrecision(10))+' ± '+(normalized.e===null?T.mine_unknown:Number(normalized.e.toPrecision(8)))+' keV';}).join('; ');}catch(e){preview.textContent=T.mine_conversion_preview+' '+(T.loaded_errors[e.message]||e.message);appendB.disabled=replaceB.disabled=true;}
        }
        status.textContent=T.mine_status.replace('{m}',matched).replace('{n}',map.size).replace('{e}',USER.parsed.errors.length+typed.errors.length)+' · '+(typed.label||T.m_mine)+' · '+(typed.quantity==='custom'?T.mine_custom:PQ[typed.quantity][0])+' ('+typed.unit+') · '+T.mine_unknown_count.replace('{n}',typed.rows.filter(r=>r.sigma===null).length)+(USER.parsed.duplicates?' · '+T.mine_duplicates.replace('{n}',USER.parsed.duplicates):'');
        manualRange=null;pq.value=typed.quantity==='custom'?'mine':typed.quantity;
        if(focus){const u=typed.rows[0];chainInput('range').checked=false;root.querySelector('.nc-prange-in').hidden=true;chainInput('xscale').value='data';chainInput('yscale').value='data';chain=M.get(key(u.Z,u.N))||[u.Z,u.N,(EL.find(e=>e[0]===u.Z)||[u.Z,'Z'+u.Z])[1]];}
        if(mode!=='mine'){sel.value='mine';sel.onchange();}else{syncRange();redraw();}
        pq.onchange();return true;
      }catch(e){inputError(e);return false;}
    }
    function apply(){
      try{
        let text=ta.value,settings=null;
        if(/^\s*\{/.test(text)&&JSON.parse(text).schema==='traps.typed-data.v1'){
          settings=TD.restore(text);text=settings.text;
          TD.adapt(UD.parse(text,{symbolToZ:symbolMap()}),settings.options); // Reject invalid units/settings before touching the working controls.
        }
        const parsed=UD.parse(text,{symbolToZ:symbolMap()});if(!parsed.rows.length)throw Error('rows');
        if(settings){
          const o=settings.options;quantityS.value=o.quantity||'custom';syncUnits(o.unit);customUnit.value=o.customUnit||'';labelI.value=o.label||'';referenceI.value=o.reference||'';ta.value=text;
          columns(parsed,o.valueColumn,o.sigmaColumn);
          for(const control of root.querySelectorAll('[data-series],[data-model-series]')){const id=control.dataset.series||'model:'+control.dataset.modelSeries;if(typeof settings.series?.[id]==='boolean')control.checked=settings.series[id];}
        }else columns(parsed);
        USER.parsed=parsed;build(true);if(settings)Promise.allSettled(selectedModels().map(k=>loadModels(k))).then(()=>plotChain());
      }catch(e){inputError(e);}
    }
    root.querySelector('[data-nc="mine-apply"]').onclick = apply;
    root.querySelector('[data-nc="mine-clear"]').onclick = () => { USER.map = new Map(); USER.parsed = USER.typed = null; autoCache.clear(); manualRange = null; ta.value = ""; colS.replaceChildren();sigmaS.replaceChildren(option('',T.mine_unknown));appendB.disabled=replaceB.disabled=true; status.textContent = "";root.querySelector('.nc-mine-preview').textContent=''; if (mode === "mine") { syncRange(); redraw(); }plotChain(); };
    colS.onchange=()=>{if(sigmaS.value===colS.value)sigmaS.value='';build();};sigmaS.onchange=unitS.onchange=()=>build();
    quantityS.onchange=()=>{syncUnits();build();};for(const input of [customUnit,labelI,referenceI])input.addEventListener('change',()=>build());
    for(const [button,method]of [[appendB,'append'],[replaceB,'replace']])button.onclick=()=>{
      try{if(!build())return;const table=measured[method](TD.massRows(USER.typed));status.textContent+=' · '+T.mine_adopted.replace('{n}',USER.typed.rows.length)+(table.errors.some(e=>e.code==='weighted_sigma')?' · '+T.mine_weighted_sigma:'');}catch(e){inputError(e);}
    };
    root.querySelector('[data-nc=mine-save]').onclick=()=>{
      try{if(!build())return;const checked={};for(const control of root.querySelectorAll('[data-series],[data-model-series]'))checked[control.dataset.series||'model:'+control.dataset.modelSeries]=control.checked;X.save(new Blob([JSON.stringify(TD.portable(ta.value,options(),checked),null,2)],{type:'application/json'}),'typed-chart-input-'+X.stamp()+'.json');}catch(e){inputError(e);}
    };
    fileI.onchange = async () => { const f = fileI.files[0]; if (!f) return; try { if (f.size > 5000000) throw Error("file larger than 5 MB"); ta.value = await f.text(); apply(); } catch (e) { status.textContent = (T.error_prefix || "Check input: ") + e.message; } finally { fileI.value = ""; } };
  }
  if (msel) msel.onchange = () => setSource(msel.value);
  if (ovl) ovl.addEventListener("change", e => { if (e.target.dataset.path && e.target.checked && !Object.keys(PATHS).length) loadIndex().then(draw).catch(modelFailure); draw(); });
  fsel.innerHTML = Object.entries(FILTERS).map(([k, f]) => `<option value="${k}">${f[0]}</option>`).join("");
  fsel.onchange = () => { filt = fsel.value; drawLegend(); draw(); drawStats(); root.querySelector(".nc-fcount").textContent = `${rows.filter(pass).length} ${T.nuclides}`; };
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

  const evaluatedRequest=fetch(root.dataset.reactions).then(response=>{
    if(!response.ok)throw new Error('Published AME2020 reference table unavailable');
    return response.json();
  }).then(data=>({data,adapter:window.ZGAMEEvaluated.fromData(data)})).catch(error=>{
    evaluatedWarning=true;console.warn('Published AME2020 reaction values unavailable; independent-mass fallback',error);return null;
  });
  Promise.all([fetch(root.dataset.src).then(r=>{if(!r.ok)throw new Error("Nuclear data unavailable");return r.json();}),P.load(root.dataset.catalogue,root.dataset.ame),evaluatedRequest]).then(([d,c,reference]) => {
    catalog=c;evaluated=reference?.adapter||null;evaluatedData=reference?.data||null;
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
