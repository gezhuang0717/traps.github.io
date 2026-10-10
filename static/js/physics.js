(function (host) {
  "use strict";
  if (host.ZGPhysics) { if (typeof module !== "undefined" && module.exports) module.exports = host.ZGPhysics; return; }
  const C = Object.freeze({ uKeV: 931494.10242, uKg: 1.66053906660e-27, electronU: 5.48579909065e-4, e: 1.602176634e-19, version: "CODATA2018/AME2020" });
  const FWHM = 2 * Math.sqrt(2 * Math.log(2));
  const numeric = x => typeof x === "number" && Number.isFinite(x);
  function primitive(id, v, e, est = false, sigmaEst = false) { return { v, e, est, sigmaEst, offset: 0, terms: { [id]: { c: 1, e, v, est, sigmaEst } } }; }
  function combine(...terms) {
    if (terms.some(([, x]) => !x || !numeric(x.v))) return null;
    const p = {}; let offset = 0;
    for (const [c, x] of terms) {
      offset += c * (x.offset ?? x.v);
      for (const [id, t] of Object.entries(x.terms || {})) {
        p[id] ||= { c: 0, e: t.e, v: t.v, est: t.est, sigmaEst:t.sigmaEst }; p[id].c += c * t.c;
      }
    }
    for (const id of Object.keys(p)) if (Math.abs(p[id].c) < 1e-14) delete p[id];
    const e = Object.values(p).some(t => !numeric(t.e)) ? null : Math.sqrt(Object.values(p).reduce((s, t) => s + (t.c * t.e) ** 2, 0));
    const v = offset + Object.values(p).reduce((s,t)=>s+t.c*t.v,0), est = Object.values(p).some(t=>t.est);
    return { v, e, est, sigmaEst:Object.values(p).some(t=>t.sigmaEst), offset, terms: p, uncertainty_model: "diagonal primitive covariance; repeated inputs combined" };
  }
  const constant = v => ({ v, e: 0, est: false, offset: v, terms: {} });
  // Atomic mass-excess convention: the five-point sign is opposite to B.
  function pairingIndicator(getMass, Z, N, axis = "N", order = 3) {
    if (!["N", "Z"].includes(axis) || ![3, 5].includes(order)) throw new Error("Invalid pairing stencil");
    const n = axis === "N" ? N : Z, parity = n % 2 ? -1 : 1;
    const weights = order === 3 ? [0.5, -1, 0.5] : [-0.125, 0.5, -0.75, 0.5, -0.125];
    const half = (weights.length - 1) / 2;
    return combine(...weights.map((w, i) => [parity * w, getMass(Z + (axis === "Z" ? i - half : 0), N + (axis === "N" ? i - half : 0))]));
  }
  function catalogue(data, ameData) {
    const states = new Map(data.states.map(s => [s.id, s])), groups = new Map(), ground = new Map();
    data.states.forEach(s => { const k = s.element.toLowerCase() + s.A; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); if (!s.source_state_index) ground.set(k, s); });
    const ame = new Map(ameData.rows.map(r => [r[2].toLowerCase() + r[1], r]));
    function atom(A, element, state = 0, massSource = "ame") {
      const k = element.toLowerCase() + A, gs = ground.get(k), st = gs && states.get(`${gs.Z}-${gs.N}-${state}`), am = ame.get(k);
      if (!st || st.existence === "withdrawn") throw new Error(`Unavailable state: ${A}${element}[${state}]`);
      if (state && (!numeric(st.excitation.value) || st.excitation.qualifier)) throw new Error(`Excitation energy unavailable or limited: ${A}${element}[${st.label}]`);
      const useAme = massSource === "ame" && am && numeric(am[3]);
      const me = useAme ? am[3] : gs.mass_excess.value, er = useAme ? am[4] : gs.mass_excess.uncertainty;
      if (!numeric(me) || (!useAme && gs.mass_excess.qualifier)) throw new Error(`Mass unavailable: ${A}${element}`);
      const src = useAme ? "AME2020" : "NUBASE2020";
      let value = combine([1, constant(A)], [1 / C.uKeV, primitive(`${src}:${gs.id}`, me, er, useAme ? !!am[5] : gs.mass_excess.value_extrapolated, useAme ? !!am[6] : gs.mass_excess.uncertainty_extrapolated)]);
      if (state) value = combine([1, value], [1 / C.uKeV, primitive(`NUBASE2020:Ex:${st.id}`, st.excitation.value, st.excitation.uncertainty, st.excitation.value_extrapolated, st.excitation.uncertainty_extrapolated)]);
      return { value, state: st, A, Z: gs.Z, label: `${A}${gs.element}${state ? `[${st.label}]` : ""}`, source: src + (state ? " + NUBASE2020 excitation" : "") };
    }
    function resolve(text, options = {}) {
      let s = String(text).trim().replace(/\s/g, ""), q = options.q ?? 1, w = options.w ?? 1, m;
      if ((m = s.match(/:([\d.]+)$/))) { w = +m[1]; s = s.slice(0, m.index); }
      if ((m = s.match(/\+(\d+)$/))) { q = +m[1]; s = s.slice(0, m.index); }
      else if ((m = s.match(/^(\d+(?:m\d*)?[A-Za-z]{1,2}(?:m\d*|\*)?)(\d+)\+$/))) { q = +m[2]; s = m[1]; }
      else s = s.replace(/\+$/, "");
      if (!Number.isInteger(q) || q < 1 || q > 100 || !numeric(w) || w < 0) throw new Error("Charge must be an integer 1–100; population must be nonnegative.");
      if ((m = s.match(/^([A-Za-z]{1,2})-?(\d+)$/))) s = m[2] + m[1];
      let explicit = 0;
      if ((m = s.match(/^(\d+)m(\d*)([A-Za-z]{1,2})$/))) { explicit = +(m[2] || 1); s = m[1] + m[3]; }
      else if ((m = s.match(/^(\d+[A-Za-z]{1,2})(?:m(\d*)|\*)$/))) { explicit = +(m[2] || 1); s = m[1]; }
      else if ((m = s.match(/^(\d+)([A-Za-z]{1,2})\[([gmnpqrxij]|\d+)\]$/))) { const labels = { g: 0, m: 1, n: 2, p: 3, q: 4, r: 5, x: 6, i: 8, j: 9 }; explicit = m[3] in labels ? labels[m[3]] : +m[3]; s = m[1] + m[2]; }
      function readings(t) {
        if (!t) return [[]];
        const a = t.match(/^(\d+)([A-Z][a-z]?|[a-z]{1,2})(\d*)/); if (!a) return [];
        const out = [];
        for (let n = 0; n <= a[3].length; n++) {
          const count = +(a[3].slice(0, n) || 1); if (count < 1 || count > 1000) continue;
          let x; try { x = atom(+a[1], a[2], explicit, options.massSource); } catch (_) { continue; }
          const rest = t.slice(a[1].length + a[2].length + n);
          if (explicit && rest) continue;
          for (const r of readings(rest)) out.push([{ ...x, count }, ...r]);
        }
        return out;
      }
      const variants = readings(s);
      if (!variants.length) throw new Error(`Unknown, unavailable or nonnumeric ion/state: ${text}`);
      if (variants.length > 1) throw new Error(`Ambiguous molecular input: ${text}; use an explicit isotope composition.`);
      const atoms = variants[0], value = combine(...atoms.map(a => [a.count, a.value]));
      const M = value.v, ionMassU = M - q * C.electronU;
      if (!(ionMassU > 0) || q > atoms.reduce((z, a) => z + a.count * a.Z, 0)) throw new Error("Charge exceeds the ion's electron count.");
      return { M, e: value.e == null ? null : value.e * C.uKeV, value, est: value.est, uncertainty_extrapolated:value.sigmaEst, q, w, ionMassU,
        A: atoms.reduce((a, x) => a + x.A * x.count, 0), atoms,
        label: atoms.map(a => a.label + (a.count > 1 ? `×${a.count}` : "")).join("·") + ` +${q}`,
        source: [...new Set(atoms.map(a => a.source))].join("; "), txt: text,
        mass_convention: "atomic mass minus q electron masses; ionization and molecular binding energies omitted" };
    }
    // Display/bookmark lookup must not require a calculable ion mass or excitation.
    function lookupState(text,index=0){
      const m=String(text).trim().match(/^(\d+)([A-Za-z]{1,2})$/);
      const gs=m&&ground.get(m[2].toLowerCase()+Number(m[1]));
      return gs&&/^\d+$/.test(String(index))?states.get(`${gs.Z}-${gs.N}-${Number(index)}`)||null:null;
    }
    return { states, groups, ground, resolve, atom, lookupState, metadata: {...data.source,ground_mass_source:ameData.metadata || {description:ameData.source}} };
  }
  const loads = new Map();
  function load(catalogueUrl, ameUrl) {
    const k = catalogueUrl + "|" + ameUrl;
    if (!loads.has(k)) loads.set(k, Promise.all([catalogueUrl, ameUrl].map(async u => { const r = await fetch(u); if (!r.ok) throw new Error(`Nuclear data unavailable (${r.status})`); return r.json(); })).then(([d, a]) => catalogue(d, a)));
    return loads.get(k);
  }
  function frequency(ion, B) { if (!(B > 0)) throw new Error("B must be positive"); return ion.q * C.e * B / (2 * Math.PI * ion.ionMassU * C.uKg); }
  function penning(ion, B, voltage, d) {
    const nc = frequency(ion, B), nz = voltage >= 0 && d > 0 ? Math.sqrt(ion.q * C.e * voltage / (ion.ionMassU * C.uKg * d * d)) / (2 * Math.PI) : NaN;
    const D = nc * nc - 2 * nz * nz, stable = D > 0 && nz > 0;
    const np = D >= 0 ? (nc + Math.sqrt(D)) / 2 : null;
    const nm = np > 0 ? nz * nz / (2 * np) : null;
    return { nc, nz, np, nm, stable, marginal: D === 0 || voltage === 0, convention: "Phi=U0(2z²−x²−y²)/(4d²)" };
  }
  function mrtof(ions, p) {
    if (!(p.laps >= 0 && Number.isInteger(p.laps)) || !(p.referenceUs > 0 && p.lapUs > 0 && p.widthNs > 0 && p.broadeningNs >= 0 && p.delayUs >= 0)) throw new Error("Invalid MR-TOF time, width or lap count.");
    const norm = ions.reduce((s, i) => s + i.w, 0); if (!(norm > 0)) throw new Error("At least one population must be positive.");
    const fw = Math.hypot(p.widthNs, p.laps * p.broadeningNs);
    const species = ions.map(i => { const flight = (p.referenceUs + p.laps * p.lapUs) * 1000 * Math.sqrt(i.ionMassU / i.q / 100), time = p.delayUs * 1000 + flight;
      const life = i.atoms.length === 1 ? i.atoms[0].state.half_life : null;
      const survival = life?.status === "stable" ? 1 : life?.seconds > 0 && !life.qualifier ? Math.exp(-Math.LN2 * flight * 1e-9 / life.seconds) : null;
      return { ...i, w: i.w / norm, time, flight, fwhm: fw, sigma: fw / FWHM, resolvingPower: flight / (2 * fw), survival }; });
    const pairs = []; for (let i = 0; i < species.length; i++) for (let j = i + 1; j < species.length; j++) {
      const dm = combine([1, species[j].value], [-1, species[i].value]);
      pairs.push({ i, j, dt: species[j].time - species[i].time, widths: Math.abs(species[j].time - species[i].time) / fw, dmKeV: dm.v * C.uKeV, eKeV: dm.e == null ? null : dm.e * C.uKeV }); }
    return { species, pairs, width: fw, origin: species[0].time, parameters: p };
  }
  function calibration(t, refTime, refIon, q, delay, sigT = 0, sigRef = 0, sigDelay = 0) {
    if (!(t > delay && refTime > delay && q > 0) || [sigT, sigRef, sigDelay].some(x => x < 0)) throw new Error("Calibration times must exceed delay.");
    const a = t - delay, b = refTime - delay, mass = refIon.ionMassU * q / refIon.q * (a / b) ** 2;
    const derivatives = [2 * mass / a, -2 * mass / b, 2 * mass * (1 / b - 1 / a)];
    const e = refIon.e == null ? null : Math.hypot(...derivatives.map((d, i) => d * [sigT, sigRef, sigDelay][i]), mass / refIon.ionMassU * refIon.e / C.uKeV);
    return { atomicMassU: mass + q * C.electronU, uncertaintyU: e, uncertainty_model: "independent times/reference mass; shared time-zero derivative combined" };
  }
  function conversion(detuning, T, scheme = "rect") {
    if (!(T > 0)) throw new Error("Excitation time must be positive");
    const d = 2 * Math.PI * detuning;
    if (scheme === "rect") { const g = Math.PI / (2 * T), o = Math.hypot(2 * g, d); return (2 * g / o) ** 2 * Math.sin(o * T / 2) ** 2; }
    const tau = 0.1 * T, wait = 0.8 * T, g = Math.PI / (4 * tau), o = Math.hypot(2 * g, d);
    return 4 * (2 * g / o) ** 2 * Math.sin(o * tau / 2) ** 2 * (Math.cos(d * wait / 2) * Math.cos(o * tau / 2) - d / o * Math.sin(d * wait / 2) * Math.sin(o * tau / 2)) ** 2;
  }
  const tof = F => 62 + 193 / Math.sqrt(1 + 1.876 * F);
  const tofMean = F => 0.92 * tof(F) + 0.08 * 255;
  const tofShape = (d, T, scheme) => (255 - tofMean(conversion(d, T, scheme))) / (255 - tofMean(1));
  function mixture(ions, f, p) {
    const W = ions.reduce((s, i) => s + i.w, 0); if (!(W > 0)) throw new Error("At least one population must be positive.");
    return ions.reduce((s, i) => s + i.w / W * tofMean(conversion(f - frequency(i, p.B), p.T, p.scheme)), 0);
  }
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussian(random) { return Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, random()))) * Math.cos(2 * Math.PI * random()); }
  function acquire(ions, p, lo, hi, points = 31, counts = 20, seed = 20261007) {
    if (!(hi > lo) || !Number.isFinite(lo+hi) || !Number.isInteger(points) || points < 5 || points > 201 || !Number.isInteger(counts) || counts < 2 || counts > 10000) throw new Error("Use an increasing scan, 5–201 frequency points and 2–10000 ions per point.");
    const random = rng(seed), W = ions.reduce((s, i) => s + i.w, 0), events = [], scan = [];
    if (!(W > 0)) throw new Error("At least one population must be positive.");
    for (let j = 0; j < points; j++) {
      const f = lo + (hi - lo) * j / (points - 1), values = [];
      for (let k = 0; k < counts; k++) { let x = random() * W, species = 0; while (species < ions.length - 1 && (x -= ions[species].w) > 0) species++;
        const F = conversion(f - frequency(ions[species], p.B), p.T, p.scheme), value = random() < 0.08 ? 255 + 9 * gaussian(random) : tof(F) + 7 * gaussian(random);
        values.push(value); events.push({ f, tof: value, species }); }
      const mean = values.reduce((s, x) => s + x, 0) / counts, variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (counts - 1);
      scan.push({ f, mean, se: Math.sqrt(variance / counts), n: counts });
    }
    return { scan, events, seed };
  }
  function fitSingle(scan, p, target) {
    if (new Set(scan.map(s=>s.f)).size < 5 || scan.some(s => !(s.n >= 2 && s.se > 0) || !Number.isFinite(s.f+s.mean+s.se))) return { status: "insufficient data" };
    const lo = Math.min(...scan.map(s => s.f)), hi = Math.max(...scan.map(s => s.f));
    function profile(center) {
      let S = 0, Sx = 0, Sxx = 0, Sy = 0, Sxy = 0;
      for (const r of scan) { const x = tofShape(r.f - center, p.T, p.scheme), w = 1 / r.se ** 2; S += w; Sx += w * x; Sxx += w * x * x; Sy += w * r.mean; Sxy += w * x * r.mean; }
      const den = S * Sxx - Sx * Sx; if (!(den > 1e-12 * S * Sxx)) return { chi2: Infinity };
      let depth = (Sy * Sx - Sxy * S) / den, baseline = (Sy + depth * Sx) / S;
      if (depth < 0) { depth = 0; baseline = Sy / S; }
      const predict = f => baseline - depth * tofShape(f - center, p.T, p.scheme);
      return { center, baseline, depth, predict, chi2: scan.reduce((s, r) => s + ((r.mean - predict(r.f)) / r.se) ** 2, 0) };
    }
    const N = Math.max(600, Math.min(5000, Math.ceil((hi - lo) * p.T * 100))), grid = [];
    for (let i = 0; i <= N; i++) grid.push(profile(lo + (hi - lo) * i / N));
    let index = 0; grid.forEach((g, i) => { if (g.chi2 < grid[index].chi2) index = i; });
    if (!Number.isFinite(grid[index].chi2)) return { status: "unconstrained fit" };
    if (index === 0 || index === N) { const fit = grid[index]; return { ...fit, status: "boundary-limited fit", interval: [null, null], bias: fit.center - target, dof: scan.length - 3, reducedChi2: fit.chi2 / (scan.length - 3), residuals: scan.map(r => ({ f: r.f, residual: r.mean - fit.predict(r.f), se: r.se })) }; }
    let a = grid[index - 1].center, b = grid[index + 1].center;
    for (let i = 0; i < 40; i++) { const x = a + (b - a) / 3, y = b - (b - a) / 3; if (profile(x).chi2 < profile(y).chi2) b = y; else a = x; }
    const fit = profile((a + b) / 2), threshold = fit.chi2 + 1;
    function crossing(direction) { let last = fit.center, step = (hi - lo) / N;
      for (let c = fit.center + direction * step; c >= lo && c <= hi; c += direction * step) { if (profile(c).chi2 >= threshold) { let near = last, far = c; for (let k = 0; k < 32; k++) { const m = (near + far) / 2; if (profile(m).chi2 < threshold) near = m; else far = m; } return (near + far) / 2; } last = c; } return null; }
    const left = crossing(-1), right = crossing(1), modes = grid.filter((g, i) => i > 0 && i < N && g.chi2 < grid[i - 1].chi2 && g.chi2 < grid[i + 1].chi2 && g.chi2 <= fit.chi2 + 1).length;
    return { ...fit, status: fit.depth === 0 ? "unconstrained fit" : left == null || right == null ? "boundary-limited interval" : modes > 1 ? "multiple fit minima" : "ok", interval: [left, right], bias: fit.center - target, dof: scan.length - 3, reducedChi2: fit.chi2 / (scan.length - 3), residuals: scan.map(r => ({ f: r.f, residual: r.mean - fit.predict(r.f), se: r.se })) };
  }
  const wrapPhase = angle => ((angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
  function phaseResolution(frequencyHz, time, radiusMm, sigmaMm, count, floorRad = 0) {
    if (!(radiusMm > 0 && time > 0 && sigmaMm > 0 && Number.isInteger(count) && count > 0 && floorRad >= 0)) return { defined: false };
    const eventSigma = sigmaMm / radiusMm, centroidSigma = Math.hypot(eventSigma / Math.sqrt(count), floorRad);
    return { defined: true, eventSigma, centroidSigma, frequencySigma: centroidSigma / (2 * Math.PI * time), resolvingPower: 2 * Math.PI * frequencyHz * time / (FWHM * eventSigma), smallAngle: eventSigma < 0.3 };
  }
  function eigLow(diag, off) {           /* lowest eigenvalue of a symmetric tridiagonal matrix */
    const n = diag.length; let lo = Infinity, hi = -Infinity;
    diag.forEach((d, i) => { const r = Math.abs(off[i - 1] || 0) + Math.abs(off[i] || 0); lo = Math.min(lo, d - r); hi = Math.max(hi, d + r); });
    const below = x => { let c = 0, d = 1; for (let i = 0; i < n; i++) { d = diag[i] - x - (i ? off[i - 1] * off[i - 1] / d : 0); if (d === 0) d = -1e-300; if (d < 0) c++; } return c; };
    for (let it = 0; it < 64; it++) { const m = (lo + hi) / 2; below(m) >= 1 ? (hi = m) : (lo = m); }
    return (lo + hi) / 2;
  }
  const MA0 = q => eigLow([...Array(14)].map((_, r) => 4 * r * r), [...Array(13)].map((_, r) => r ? q : Math.SQRT2 * q));
  const MB1 = q => eigLow([...Array(14)].map((_, r) => r ? (2 * r + 1) ** 2 : 1 - q), [...Array(13)].map(() => q));
  const Q_EDGE = 0.908046, Q_TIP = 0.705996, A_TIP = 0.236994;
  const mathieuStable = (a, q) => q > 0 && q < Q_EDGE && a < MB1(q) && a > MA0(q) && -a < MB1(q) && -a > MA0(q);


  function mathieuParameters(ion,U,V,r0,frequencyMHz) { const k=C.e*ion.q/(ion.ionMassU*C.uKg*(r0/1000)**2*(2*Math.PI*frequencyMHz*1e6)**2);return {a:8*k*U,q:4*k*V}; }
  // First simultaneous x/y stability region. Cutoffs are in m/z (u per elementary charge).
  function rfqCutoffs(U,V,r0,frequencyMHz) {
    if(![U,V,r0,frequencyMHz].every(Number.isFinite)||!(r0>0&&frequencyMHz>0&&V>=0))return {status:'invalid'};
    if(V===0)return {status:'rf-off',slope:null,lowMassU:null,highMassU:null};
    const bisect=(fn,lo,hi)=>{for(let i=0;i<55;i++){const m=(lo+hi)/2;if(fn(m)>0)lo=m;else hi=m;}return (lo+hi)/2;};
    const edge=bisect(MB1,.8,1),tip=bisect(q=>MB1(q)+MA0(q),.6,.8);
    const slope=2*Math.abs(U)/V,criticalSlope=MB1(tip)/tip;
    if(slope>=criticalSlope)return {status:'no-window',slope,criticalSlope,lowMassU:null,highMassU:null};
    let qLow=0;
    if(slope>0) { let lo=0,hi=tip;for(let i=0;i<60;i++){const m=(lo+hi)/2;(-MA0(m)/m>slope)?hi=m:lo=m;}qLow=(lo+hi)/2; }
    const qHigh=bisect(q=>MB1(q)-slope*q,tip,edge);
    const massScale=4*C.e*V/(C.uKg*(r0/1000)**2*(2*Math.PI*frequencyMHz*1e6)**2);
    return {status:Math.abs(U)===0?'rf-only':'window',slope,criticalSlope,qLow,qHigh,aLow:slope*qLow,aHigh:slope*qHigh,lowMassU:massScale/qHigh,highMassU:qLow===0?Infinity:massScale/qLow};
  }
  function shortestPhaseTime(frequencies,sigma,target,maxMs=5000,stepMs=.01,adjustTimeMs=null) {
    if(frequencies.length<2||!frequencies.every(Number.isFinite)||!(sigma>0&&target>0&&maxMs>0&&stepMs>0))return null;
    const differences=[];for(let i=0;i<frequencies.length;i++)for(let j=i+1;j<frequencies.length;j++){const d=Math.abs(frequencies[i]-frequencies[j]);if(d===0)return null;differences.push(d);}
    const angle=sigma*target;if(angle>Math.PI)return null;
    const first=adjustTimeMs?1:Math.max(1,Math.ceil(angle/(2*Math.PI*Math.min(...differences))*1000/stepMs-1e-9));
    for(let k=first;k<=Math.floor(maxMs/stepMs);k++){const requested=k*stepMs,ms=adjustTimeMs?adjustTimeMs(requested):requested;if(ms<=maxMs&&differences.every(d=>{const phase=wrapPhase(2*Math.PI*d*ms/1000);return Math.min(phase,2*Math.PI-phase)+1e-12>=angle;}))return requested;}
    return null;
  }
  // Projected PI-ICR patterns: alpha+ - alpha- = 2pi nu_c t + offset.
  // Advance to the next permitted turn, then optionally emulate a timing clock.
  function phaseTiming(requestedSeconds,frequencyHz,minusDeg=0,plusDeg=0,overlap=false,clockNs=4) {
    if(![requestedSeconds,frequencyHz,minusDeg,plusDeg,clockNs].every(numeric)||requestedSeconds<0||frequencyHz<=0||clockNs<0)throw new Error('Invalid reference phase timing');
    const shift=(plusDeg-minusDeg)/360;
    const requestedCycles=frequencyHz*requestedSeconds+shift;
    const turns=overlap?Math.ceil(requestedCycles-8*Number.EPSILON*Math.max(1,Math.abs(requestedCycles))):null;
    const idealSeconds=overlap?(turns-shift)/frequencyHz:requestedSeconds;
    const tick=clockNs*1e-9;
    let actualSeconds=overlap&&tick>0?Math.round(idealSeconds/tick)*tick:idealSeconds;
    // Preserve a non-earlier request when it lies between timing-clock ticks.
    if(overlap&&tick>0&&actualSeconds<requestedSeconds-1e-14)actualSeconds=Math.ceil(requestedSeconds/tick)*tick;
    const cycles=frequencyHz*actualSeconds+shift;
    return {requestedSeconds,idealSeconds,actualSeconds,turns,clockNs:overlap?clockNs:0,overlap,
            residualDeg:(wrapPhase(2*Math.PI*(cycles-Math.round(cycles))+Math.PI)-Math.PI)*180/Math.PI};
  }
  // Rest-energy increase at fixed charge and field, relative to the input ion.
  function phaseEnergyStep(ion,B,time,energyKeV=1) {
    if(!(ion.ionMassU>0&&time>=0&&energyKeV>=0))throw new Error('Invalid mass-energy phase comparison');
    const massStepU=energyKeV/C.uKeV,nu=frequency(ion,B);
    const deltaHz=-nu*massStepU/(ion.ionMassU+massStepU);
    const turns=deltaHz*time,angleDeg=turns===0?0:360*turns;
    return {energyKeV,massStepU,deltaHz,turns,angleDeg,residualDeg:(wrapPhase(2*Math.PI*turns+Math.PI)-Math.PI)*180/Math.PI};
  }
  /* ---------- calibrant-based trap frequencies (as in PyMassScanner, ame_legacy 172–219) ----------
     A calibrant is a resolved ion (catalogue.resolve) with a measured cyclotron frequency nc ± snc and magnetron
     frequency nm ± snm (Hz). The effective field follows from nc = qeB/(2π m_ion); every other ion or state is scaled by
     the frequency-ratio law nc(ion) = nc(cal)·(m_cal/m_ion)·(q_ion/q_cal) (isomers include Ex through the catalogue mass).
     Modes:  "fixed-minus" (PyMassScanner): ν− is the calibrant's ν− for every ion; ν+ = νc − ν−; νz = √(2ν+ν−).
             "ideal": νz² ∝ q/m from the calibrant (ideal quadrupole), ν± = [νc ± √(νc² − 2νz²)]/2 (mass-dependent ν−).
     Uncertainty: relative σ of νc combines the calibrant σνc and the mass covariance of shared primitives (AME/NUBASE inputs),
     so an ion identical to the calibrant returns exactly σνc; several calibrants are averaged with weights 1/σB². */
  function massTerms(ion) {               /* u per keV coefficients of the atomic-mass primitives of an ion */
    const t = {}; for (const [id, x] of Object.entries(ion.value?.terms || {})) t[id] = { c: x.c, e: x.e }; return t;
  }
  function trapCalibration(calibrants, mode = "fixed-minus") {
    if (!Array.isArray(calibrants) || !calibrants.length) throw new Error("At least one calibrant is required.");
    if (!["fixed-minus", "ideal"].includes(mode)) throw new Error("Unknown calibration mode.");
    const list = calibrants.map(c => {
      const ion = c.ion, nc = +c.nc, nm = +c.nm, snc = +(c.snc || 0), snm = +(c.snm || 0);
      if (!(ion && ion.ionMassU > 0 && ion.q > 0)) throw new Error("Calibrant ion unavailable.");
      if (!(nc > 0) || !(nm > 0) || !(nm < nc / 2) || !(snc >= 0) || !(snm >= 0)) throw new Error("Calibrant needs νc > 0, 0 < ν− < νc/2 and nonnegative uncertainties.");
      const m = ion.ionMassU, B = 2 * Math.PI * nc * m * C.uKg / (ion.q * C.e);
      const terms = massTerms(ion), massSigma = Object.values(terms).some(t => !numeric(t.e)) ? null : Math.sqrt(Object.values(terms).reduce((s, t) => s + (t.c * t.e) ** 2, 0));
      const relB = massSigma == null ? null : Math.hypot(snc / nc, massSigma / m);
      const np = nc - nm, nz2 = 2 * np * nm;
      return { ion, label: ion.label, q: ion.q, m, nc, snc, nm, snm, np, nz: Math.sqrt(nz2), k: nz2 * m / ion.q, B, sB: relB == null ? null : B * relB, terms };
    });
    const known = list.every(c => c.sB > 0);
    const w = list.map(c => known ? 1 / c.sB ** 2 : 1), W = w.reduce((a, b) => a + b, 0), a = w.map(x => x / W);
    const B = list.reduce((s, c, i) => s + a[i] * c.B, 0);
    const sB = list.every(c => c.sB != null) ? Math.sqrt(list.reduce((s, c, i) => s + (a[i] * c.sB) ** 2, 0)) : null;
    const ppb = list.map(c => (c.B - B) / B * 1e9);
    const chi2 = known && list.length > 1 ? list.reduce((s, c) => s + ((c.B - B) / c.sB) ** 2, 0) : null;
    const k = list.reduce((s, c, i) => s + a[i] * c.k, 0), nm = list.reduce((s, c, i) => s + a[i] * c.nm, 0);
    return { mode, list, weights: a, B, sB, ppb, chi2, birge: chi2 == null ? null : Math.sqrt(chi2 / (list.length - 1)), k, nm,
      convention: "nc ∝ q/m_ion (m_ion = M_atom − q·m_e); ν+ + ν− = νc; ν+² + ν−² + νz² = νc²" };
  }
  function calibratedPenning(ion, cal) {
    if (!cal || !cal.list) throw new Error("Calibration unavailable.");
    if (!(ion.ionMassU > 0 && ion.q > 0)) throw new Error("Ion unavailable.");
    const m = ion.ionMassU, q = ion.q, nc = q * C.e * cal.B / (2 * Math.PI * m * C.uKg);
    /* σ(ln νc) = Σ_i a_i ln νc,i − ln m_ion + Σ a_i ln m_cal,i  → gradient over shared mass primitives */
    const own = massTerms(ion), g = {};
    let unknown = Object.values(own).some(t => !numeric(t.e)) || cal.list.some(c => Object.values(c.terms).some(t => !numeric(t.e)));
    cal.list.forEach((c, i) => { for (const [id, t] of Object.entries(c.terms)) { g[id] ||= { c: 0, e: t.e }; g[id].c += cal.weights[i] * t.c / c.m; } });
    for (const [id, t] of Object.entries(own)) { g[id] ||= { c: 0, e: t.e }; g[id].c -= t.c / m; }
    const rel = unknown ? null : Math.sqrt(Object.values(g).reduce((s, t) => s + (t.c * t.e) ** 2, 0) + cal.list.reduce((s, c, i) => s + (cal.weights[i] * c.snc / c.nc) ** 2, 0));
    let np, nm, nz, stable;
    if (cal.mode === "fixed-minus") { nm = cal.nm; np = nc - nm; nz = np > 0 ? Math.sqrt(2 * np * nm) : NaN; stable = np > nm && nm > 0; }
    else { const nz2 = cal.k * q / m, D = nc * nc - 2 * nz2; nz = Math.sqrt(nz2); stable = D > 0; np = D >= 0 ? (nc + Math.sqrt(D)) / 2 : null; nm = D >= 0 ? (nc - Math.sqrt(D)) / 2 : null; }
    const snm = cal.mode === "fixed-minus" ? Math.sqrt(cal.list.reduce((s, c, i) => s + (cal.weights[i] * c.snm) ** 2, 0)) : null;
    return { nc, snc: rel == null ? null : nc * rel, relSigma: rel, np, nm, nz, snm, stable, marginal: false, B: cal.B, mode: cal.mode, calibrated: true,
      keVperHz: m * C.uKeV / nc, convention: cal.convention };
  }
  /* time of flight ∝ √(m/q) relative to a calibrant time (same flight path, same energy per charge) */
  function tofScale(tCal, calIon, ion) {
    if (!(tCal > 0 && calIon.ionMassU > 0 && ion.ionMassU > 0)) throw new Error("Invalid TOF scaling input.");
    return tCal * Math.sqrt((ion.ionMassU / ion.q) / (calIon.ionMassU / calIon.q));
  }
  /* ---------- JYFLTRAP double Penning trap (PyMassScanner ame_legacy: get_trap1/2_frequencies, get_TOFs) ----------
     Trap 1 = purification trap (mass-selective buffer-gas cooling: νc for the conversion/cleaning scan);
     Trap 2 = precision trap (TOF-ICR/PI-ICR: νc, ν+ = νc − ν−, νz, motion periods, keV per Hz).
     Each trap has its own calibrant(s) and ν−. TOF calibrations RFQ→T1 and T1→T2 scale as √(m/q) of the ion mass
     (here including the isomer excitation, which PyMassScanner's get_TOFs omits). */
  function doubleTrapCalibration(spec, mode = "fixed-minus") {
    const out = { mode, traps: {}, tof: {} };
    for (const k of ["1", "2"]) if (spec.traps && spec.traps[k] && spec.traps[k].length) out.traps[k] = trapCalibration(spec.traps[k], mode);
    if (!out.traps["1"] && !out.traps["2"]) throw new Error("At least one trap needs a calibrant.");
    for (const k of ["rfqT1", "t1T2"]) { const t = spec.tof && spec.tof[k]; if (t && t.ion && t.t > 0) out.tof[k] = t; }
    if (out.traps["1"] && out.traps["2"]) out.fieldRatio = out.traps["2"].B / out.traps["1"].B;
    return out;
  }
  function doubleTrapFrequencies(ion, dt) {
    const t1 = dt.traps["1"] ? calibratedPenning(ion, dt.traps["1"]) : null, t2 = dt.traps["2"] ? calibratedPenning(ion, dt.traps["2"]) : null;
    const tof = k => dt.tof[k] ? tofScale(dt.tof[k].t, dt.tof[k].ion, ion) : null;
    return { trap1: t1, trap2: t2, tofRfqT1: tof("rfqT1"), tofT1T2: tof("t1T2"),
      periodsUs: t2 && t2.nz > 0 && t2.np > 0 && t2.nm > 0 ? { axial: 1e6 / t2.nz, cyclotron: 1e6 / t2.np, magnetron: 1e6 / t2.nm } : null,
      keVperHz: t2 ? t2.keVperHz : t1 ? t1.keVperHz : null };
  }
  /* ---------- laser (Doppler) cooling — two-level scattering model ----------
     One beam: R = (Γ/2) s/(1 + s + (2Δ/Γ)²), Δ = δ − k·v (Γ, δ in rad/s; δ < 0 = red). Two counter-propagating beams are
     added, each with its own saturation s0 (Metcalf & van der Straten, JOSA B 20, 887 (2003)). Low-velocity damping
     β = −8ħk²δ s0 /(Γ(1+s0+(2δ/Γ)²)²) (F = −βv); diffusion D0 = ħ²k² R_tot (1+η)/2 with η = ⟨cos²⟩ of the emission recoil
     (1 along the axis, 1/3 isotropic); k_B T = D0/β = ħΓ(1+η)(1+s0+(2δ/Γ)²)/(16|δ|/Γ) → ħΓ/(2k_B) for η = 1, s0 → 0, δ = −Γ/2.
     Penning trap (Hendricks et al., arXiv:0709.3817, re-deriving Itano & Wineland, PRA 25, 35 (1982)): a beam along x with
     an intensity gradient at the trap centre gives dA₊/dt = (F_y − β_r ω₊)A₊/(2mΔω), dA₋/dt = (β_r ω₋ − F_y)A₋/(2mΔω),
     dA_z/dt = −β_z A_z/(2m); both radial modes cool only when β_r ω₋ < F_y < β_r ω₊. */
  const HBAR = 1.054571817e-34, KB = 1.380649e-23;
  function laserScatter(s, detuning, gamma) {
    if (!(gamma > 0) || !(s >= 0)) throw new Error("Positive linewidth and nonnegative saturation required.");
    return gamma / 2 * s / (1 + s + (2 * detuning / gamma) ** 2);
  }
  function molassesTheory(p) {            /* p: { gamma, delta (rad/s), s0, lambda (m), massKg, eta } */
    const k = 2 * Math.PI / p.lambda, X = 2 * p.delta / p.gamma, D = 1 + p.s0 + X * X, eta = p.eta ?? 1;
    const beta = -8 * HBAR * k * k * p.delta * p.s0 / (p.gamma * D * D);
    const Rtot = 2 * laserScatter(p.s0, p.delta, p.gamma), D0 = HBAR * HBAR * k * k * Rtot * (1 + eta) / 2;
    return { k, beta, D0, Rtot, T: p.delta < 0 ? D0 / beta / KB : Infinity, TDoppler: HBAR * p.gamma / (2 * KB),
      Trecoil: HBAR * HBAR * k * k / (p.massKg * KB), vr: HBAR * k / p.massKg, vCapture: p.gamma / (2 * k) * Math.sqrt(1 + p.s0),
      dampingTime: p.delta < 0 ? p.massKg / beta : Infinity, optimalDelta: -p.gamma / 2 * Math.sqrt(1 + p.s0) };
  }
  function poisson(mean, random) {
    if (!(mean > 0)) return 0;
    if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(random)));
    const L = Math.exp(-mean); let k = 0, q = 1; do { k++; q *= random(); } while (q > L); return k - 1;
  }
  function molassesStep(v, p, dt, random) {     /* per-photon Poisson scheme; returns photons scattered */
    const k = 2 * Math.PI / p.lambda, vr = HBAR * k / p.massKg, iso = (p.eta ?? 1) < 1; let photons = 0;
    for (let i = 0; i < v.length; i++) {
      const np = poisson(laserScatter(p.s0, p.delta - k * v[i], p.gamma) * dt, random), nm = poisson(laserScatter(p.s0, p.delta + k * v[i], p.gamma) * dt, random), n = np + nm;
      let kick = 0; for (let j = 0; j < n; j++) kick += iso ? 2 * random() - 1 : (random() < 0.5 ? -1 : 1);
      v[i] += vr * (np - nm + kick); photons += n;
    }
    return photons;
  }
  function penningLaser(p) {   /* p: { ion, B, U0, d, lambda, gamma, delta, s0, w, yb, theta, eta } */
    const m = p.ion.ionMassU * C.uKg, f = penning(p.ion, p.B, p.U0, p.d);
    if (!f.stable) return { stable: false, freq: f };
    const wp = 2 * Math.PI * f.np, wm = 2 * Math.PI * f.nm, wz = 2 * Math.PI * f.nz, dW = wp - wm, k = 2 * Math.PI / p.lambda;
    const sAt = y => p.s0 * Math.exp(-2 * (y - p.yb) ** 2 / (p.w * p.w)), F0 = y => HBAR * k * laserScatter(sAt(y), p.delta, p.gamma);
    const s = sAt(0), D = 1 + s + (2 * p.delta / p.gamma) ** 2, beta = -8 * HBAR * k * k * s * p.delta / (p.gamma * D * D) / 2;
    const h = Math.max(p.w * 1e-4, 1e-9), c = Math.cos(p.theta), sn = Math.sin(p.theta), Fy = (F0(h) - F0(-h)) / (2 * h) * c;
    const br = beta * c * c, bz = beta * sn * sn;
    const gp = (Fy - br * wp) / (2 * m * dW), gm = (br * wm - Fy) / (2 * m * dW), gz = -bz / (2 * m);
    const R = laserScatter(s, p.delta, p.gamma), vr = HBAR * k / m, eta = p.eta ?? 1 / 3;
    const Dr = R * vr * vr * (c * c + (1 - eta)) / (dW * dW), Dz = R * vr * vr * (sn * sn + eta) / (wz * wz);
    const eq = (g, Dd) => g < 0 ? Math.sqrt(Dd / (-2 * g)) : Infinity;
    return { stable: true, freq: f, m, beta, F0: F0(0), Fy, window: [br * wm, br * wp], gp, gm, gz, R, Dr, Dz,
      eqPlus: eq(gp, Dr), eqMinus: eq(gm, Dr), eqZ: eq(gz, Dz), allCooled: gp < 0 && gm < 0 && gz < 0 };
  }
  function amplitudeAt(A0, g, Dd, t) {
    if (g === 0) return Math.sqrt(A0 * A0 + Dd * t);
    if(2*g*t>700)return Infinity; const e = Math.exp(2 * g * t); return Math.sqrt(Math.max(0, A0 * A0 * e + Dd * Math.expm1(2*g*t) / (2*g)));
  }
  const api = { C, FWHM, numeric, primitive, combine, constant, pairingIndicator, catalogue, load, frequency, penning, mrtof, calibration, conversion, tof, tofMean, tofShape, mixture, rng, gaussian, acquire, fitSingle, wrapPhase, phaseResolution, mathieuA0: MA0, mathieuB1: MB1, mathieuStable, mathieuParameters, rfqCutoffs, shortestPhaseTime, phaseTiming, phaseEnergyStep, trapCalibration, calibratedPenning, tofScale, doubleTrapCalibration, doubleTrapFrequencies, HBAR, KB, laserScatter, molassesTheory, molassesStep, penningLaser, amplitudeAt, poisson };
  host.ZGPhysics = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
