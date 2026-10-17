/* Periodic-table panel: pure logic (no DOM) so Node tests can check it.
 * Data: static/data/periodic-table.json (built by tools/make_periodic_table.py).
 * Origin classes are qualitative sets after Johnson (OSU); no percentages are implied.
 * Ionisation energy and electron affinity are stored in eV; kJ/mol = eV x meta.units.ev_to_kj_mol.
 */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZGPeriodicTable = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const RAMP = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']; // colour-blind-safe, perceptually even
  const NUMERIC = ['z', 'mass', 'chi', 'radius', 'ie', 'ea', 'mp', 'bp', 'density', 'year'];
  const DECIMAL_COMMA = new Set(['fi', 'de', 'fr']);
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function createModel(data) {
    if (!data || !Array.isArray(data.elements) || data.elements.length !== 118) throw new TypeError('Periodic-table data must hold 118 elements.');
    const bySym = {}, byZ = {};
    for (const e of data.elements) { bySym[e.sym] = e; byZ[e.z] = e; }
    return {data, elements: data.elements, bySym, byZ, i18n: data.i18n, evToKj: data.meta.units.ev_to_kj_mol, langs: data.i18n.languages};
  }
  // Group 1-18 for the main body (rows 1-7); lanthanides/actinides (rows 9-10) have no group number.
  const groupOf = e => (e.row <= 7 ? e.col : null);
  const periodOf = e => (e.row === 9 ? 6 : e.row === 10 ? 7 : e.row);

  const pick = (table, lang, key) => (table[lang] && table[lang][key]) || table.en[key];
  const label = (m, lang, key) => pick(m.i18n.properties.label, lang, key);
  const definition = (m, lang, key) => pick(m.i18n.properties.definition, lang, key);
  const groupLabel = (m, lang, block) => pick(m.i18n.groups.label, lang, block);
  const stateLabel = (m, lang, state) => pick(m.i18n.states.label, lang, state);
  const originLabel = (m, lang, code) => pick(m.i18n.origins.label, lang, code);
  const originDesc = (m, lang, code) => pick(m.i18n.origins.desc, lang, code);
  const displayName = (e, lang) => e.names[lang] || e.names.en;

  // Unit of a property for display; ie/ea can be shown in eV or kJ/mol.
  function unitFor(m, key, unit) {
    if (key === 'ie' || key === 'ea') return unit === 'kJ/mol' ? 'kJ/mol' : 'eV';
    return m.i18n.properties.unit[key] || '';
  }
  // Numeric value of a property (null when missing or non-numeric such as year "Ancient").
  function value(m, e, key, unit) {
    let v = key === 'z' ? e.z : e[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if ((key === 'ie' || key === 'ea') && unit === 'kJ/mol') v *= m.evToKj;
    return v;
  }
  function formatNumber(v, lang, digits = 5) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    let s = String(Number.parseFloat(Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(digits - 1) : v.toPrecision(digits)));
    if (DECIMAL_COMMA.has(lang)) s = s.replace('.', ',');
    return s;
  }
  // Text shown for any property of an element, localised.
  function formatValue(m, e, key, lang, unit) {
    if (key === 'block') return groupLabel(m, lang, e.block);
    if (key === 'state') return stateLabel(m, lang, e.state);
    if (key === 'origin') return e.origin.map(c => originLabel(m, lang, c)).join(' + ');
    if (key === 'iso') return e.iso.length ? e.iso.map(i => `${i.a}${e.sym} ${formatNumber(i.pct, lang, 4)} %`).join(', ') : '—';
    if (key === 'config' || key === 'ox' || key === 'country') return e[key] === null || e[key] === undefined || e[key] === '' ? '—' : String(e[key]);
    if (key === 'year') return typeof e.year === 'number' ? String(e.year) : (e.year ? (lang === 'zh' ? '古代' : lang === 'fi' ? 'Muinaisaika' : lang === 'de' ? 'Altertum' : lang === 'ja' ? '古代' : lang === 'fr' ? 'Antiquité' : 'Ancient') : '—');
    if (key === 'z') return String(e.z);
    const v = value(m, e, key, unit), u = unitFor(m, key, unit);
    return v === null ? '—' : `${formatNumber(v, lang, key === 'mass' ? 6 : 5)}${u ? ' ' + u : ''}`;
  }

  // ---- colours -------------------------------------------------------------------------------
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((x, i) => x + (B[i] - x) * t)); }
  function rampColor(t) {
    const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x));
    return mix(RAMP[i], RAMP[i + 1], x - i);
  }
  function textColor(bg) { // WCAG relative luminance: dark text on light fills, white on dark fills
    const [r, g, b] = hex2rgb(bg).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
  }
  // One colour for a single source; hard-stop diagonal stripes for several sources.
  function originGradient(codes, colors) {
    if (codes.length === 1) return colors[codes[0]];
    const n = codes.length, stops = codes.map((c, i) => `${colors[c]} ${(100 * i / n).toFixed(2)}% ${(100 * (i + 1) / n).toFixed(2)}%`);
    return `linear-gradient(135deg, ${stops.join(', ')})`;
  }
  // Heat-map scale over all elements for one numeric property (optionally logarithmic).
  function heatScale(m, key, unit, log) {
    const vals = m.elements.map(e => value(m, e, key, unit)).filter(v => v !== null);
    if (!vals.length) return {min: 0, max: 1, log: false, color: () => null};
    const useLog = !!log && vals.every(v => v > 0), f = v => (useLog ? Math.log10(v) : v);
    const lo = Math.min(...vals), hi = Math.max(...vals), a = f(lo), b = f(hi);
    return {min: lo, max: hi, log: useLog, color: v => (v === null || v === undefined ? null : rampColor(b === a ? 0.5 : (f(v) - a) / (b - a)))};
  }
  // Fill for one element cell. scheme: block | origin | state | heat.
  function cellStyle(m, e, scheme, opts = {}) {
    let bg, solid;
    if (scheme === 'origin') {
      bg = originGradient(e.origin, m.i18n.origins.color); solid = m.i18n.origins.color[e.origin[0]];
    } else if (scheme === 'state') { solid = bg = m.i18n.states.color[e.state];
    } else if (scheme === 'heat') {
      const scale = opts.scale || heatScale(m, opts.key || 'mass', opts.unit, opts.log), c = scale.color(value(m, e, opts.key || 'mass', opts.unit));
      solid = bg = c || '#e5e7eb';
    } else { solid = bg = m.i18n.groups.color[e.block]; }
    const missing = scheme === 'heat' && bg === '#e5e7eb';
    // multi-source origin cells carry their own stripes; keep text legible with a light chip behind it
    const striped = scheme === 'origin' && e.origin.length > 1;
    const dim = opts.highlight ? !opts.highlight.has(e.sym) : false;
    return {background: bg, color: striped ? '#111111' : textColor(solid), striped, missing, dim};
  }
  const legendCounts = m => Object.fromEntries(m.i18n.origins.order.map(c => [c, m.elements.filter(e => e.origin.includes(c)).length]));

  // ---- search ----------------------------------------------------------------------------------
  // Symbol, atomic number or name in any language; diacritics and case ignored; best matches first.
  function search(m, query) {
    const q = fold(String(query || '').trim());
    if (!q) return [];
    const scored = [];
    for (const e of m.elements) {
      let best = 99;
      const names = Object.values(e.names).map(fold);
      if (fold(e.sym) === q) best = 0;
      else if (String(e.z) === q) best = 1;
      else if (names.includes(q)) best = 2;
      else if (names.some(n => n.startsWith(q)) || fold(e.sym).startsWith(q)) best = 3;
      else if (q.length >= 2 && names.some(n => n.includes(q))) best = 4;
      if (best < 99) scored.push([best, e.z, e.sym]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }

  // ---- trends ----------------------------------------------------------------------------------
  // kind: group (1-18), period (1-7, includes the f-block) or z (all elements). Missing values stay null.
  function trend(m, kind, index, key, unit) {
    const members = m.elements.filter(e => kind === 'group' ? groupOf(e) === index : kind === 'period' ? periodOf(e) === index : true)
      .sort((a, b) => a.z - b.z);
    return members.map((e, i) => ({i, z: e.z, sym: e.sym, block: e.block, y: value(m, e, key, unit)}));
  }
  // "Nice" axis ticks (1-2-5 sequence) covering [lo, hi].
  function niceTicks(lo, hi, count = 6) {
    if (!(hi > lo)) return [lo];
    const raw = (hi - lo) / Math.max(1, count - 1), mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, ticks = [];
    for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(12)));
    return ticks;
  }

  // ---- games -----------------------------------------------------------------------------------
  function makeRng(seed) { // mulberry32: small, seedable, good enough for quizzes
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const randInt = (rng, n) => Math.floor(rng() * n);
  function shuffle(rng, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const SCORE = Object.freeze({right: 10, wrong: -5});

  // Find the named element: +10 right, -5 wrong; optional countdown in seconds.
  function createFindGame(m, {rng = Math.random, seconds = 0} = {}) {
    const g = {score: 0, rounds: 0, wrong: 0, timeLeft: seconds > 0 ? seconds : null, finished: false, target: null, last: null};
    const next = () => { let e; do { e = m.elements[randInt(rng, 118)]; } while (e.sym === g.target); g.target = e.sym; };
    g.guess = sym => {
      if (g.finished) return {ignored: true};
      const ok = sym === g.target; g.score += ok ? SCORE.right : SCORE.wrong; if (ok) { g.rounds++; g.last = sym; next(); } else g.wrong++;
      return {correct: ok, score: g.score};
    };
    g.tick = (dt = 1) => { if (g.timeLeft !== null && !g.finished) { g.timeLeft = Math.max(0, g.timeLeft - dt); if (g.timeLeft === 0) g.finished = true; } return g.timeLeft; };
    next();
    return g;
  }

  // Origin highlight game. select: click every element made (also) by the target class; which: pick a class for an element.
  function createOriginGame(m, {rng = Math.random, mode = 'select', target = null} = {}) {
    const order = m.i18n.origins.order, g = {mode, score: 0, rounds: 0, finished: false, target: null, members: new Set(), found: new Set(), wrongClicks: new Set(), question: null};
    function newSelect(code) {
      g.target = code || order[randInt(rng, order.length)];
      g.members = new Set(m.elements.filter(e => e.origin.includes(g.target)).map(e => e.sym)); g.found = new Set(); g.wrongClicks = new Set(); g.finished = false;
    }
    function newQuestion() {
      const e = m.elements[randInt(rng, 118)], right = e.origin[randInt(rng, e.origin.length)];
      const others = shuffle(rng, order.filter(c => !e.origin.includes(c))).slice(0, 3);
      g.question = {sym: e.sym, options: shuffle(rng, [right, ...others])};
    }
    g.click = sym => { // select mode
      if (g.mode !== 'select' || g.finished) return {ignored: true};
      if (g.members.has(sym)) {
        if (g.found.has(sym)) return {ignored: true};
        g.found.add(sym); g.score += SCORE.right; if (g.found.size === g.members.size) { g.finished = true; g.rounds++; }
        return {correct: true, remaining: g.members.size - g.found.size, done: g.finished};
      }
      if (!g.wrongClicks.has(sym)) { g.wrongClicks.add(sym); g.score += SCORE.wrong; }
      return {correct: false, remaining: g.members.size - g.found.size, done: false};
    };
    g.answer = code => { // which mode
      if (g.mode !== 'which') return {ignored: true};
      const ok = m.bySym[g.question.sym].origin.includes(code); g.score += ok ? SCORE.right : SCORE.wrong; g.rounds++;
      const was = g.question.sym; newQuestion(); return {correct: ok, element: was, score: g.score};
    };
    g.restart = code => { g.mode === 'select' ? newSelect(code) : newQuestion(); };
    if (mode === 'select') newSelect(target); else newQuestion();
    return g;
  }


  // ---- discovery timeline, comparison, export geometry and CSV -----------------------------------
  // Elements known by a year; elements without a numeric year ("Ancient") are always known.
  const knownBy = (m, year) => new Set(m.elements.filter(e => typeof e.year !== 'number' || e.year <= year).map(e => e.sym));
  // Both elements' values for every numeric property with the difference (b - a); null when either is missing.
  function compareRows(m, a, b, unit) {
    const A = m.bySym[a], B = m.bySym[b];
    return NUMERIC.map(key => { const va = value(m, A, key, unit), vb = value(m, B, key, unit); return {key, a: va, b: vb, diff: va === null || vb === null ? null : vb - va}; });
  }
  // Rule of thumb for the bond type from the electronegativity difference (Pauling).
  const bondClass = delta => (delta === null || delta === undefined ? null : delta < 0.4 ? 'nonpolar' : delta <= 1.7 ? 'polar' : 'ionic');
  // Painted-table geometry in units of the cell edge; identical to the Mulberry GUI (periodic_table_view.py).
  const LAYOUT = Object.freeze({axisW: 0.8, axisH: 0.7, gap: 0.04, fOffset: 0.5, pitchesV: 9.5});
  const rowOffset = row => (row <= 7 ? row - 1 : 7 + LAYOUT.fOffset + (row - 9));
  function tableLayout(m, cell) {
    const pitch = cell * (1 + LAYOUT.gap), left = LAYOUT.axisW * cell, top = LAYOUT.axisH * cell, rects = {};
    for (const e of m.elements) rects[e.sym] = {x: left + (e.col - 1) * pitch, y: top + rowOffset(e.row) * pitch, w: cell, h: cell};
    return {cell, pitch, left, top, rects, width: left + 18 * pitch - cell * LAYOUT.gap, height: top + LAYOUT.pitchesV * pitch - cell * LAYOUT.gap};
  }
  const CSV_HEADER = ['Z', 'symbol', 'name', 'name_en', 'block', 'state', 'mass_u', 'configuration', 'oxidation_states', 'electronegativity', 'radius_pm',
    'ionization_energy_eV', 'ionization_energy_kJ_mol', 'electron_affinity_eV', 'electron_affinity_kJ_mol', 'melting_point_K', 'boiling_point_K',
    'density_g_cm3', 'year', 'country', 'origin_codes', 'origin_labels', 'trace_only', 'stable_isotopes'];
  // Rows of the data export (header + 118 elements): names in the chosen language, energies in eV and kJ/mol.
  function csvRows(m, lang) {
    const n = (e, key, unit) => { const v = value(m, e, key, unit); return v === null ? '' : String(v); };
    const rows = [CSV_HEADER.map((h, i) => (i === 2 ? 'name_' + lang : h))];
    for (const e of m.elements) rows.push([e.z, e.sym, displayName(e, lang), e.names.en, e.block, e.state, n(e, 'mass'), e.config || '', e.ox || '', n(e, 'chi'), n(e, 'radius'),
      n(e, 'ie', 'eV'), n(e, 'ie', 'kJ/mol'), n(e, 'ea', 'eV'), n(e, 'ea', 'kJ/mol'), n(e, 'mp'), n(e, 'bp'), n(e, 'density'), e.year, e.country || '',
      e.origin.join(''), e.origin.map(c => originLabel(m, lang, c)).join('; '), e.trace ? 'yes' : 'no', e.iso.map(i => `${i.a}${e.sym} ${i.pct}%`).join('; ')].map(String));
    return rows;
  }
  // RFC 4180 quoting; lines end with CRLF.
  const toCsv = rows => rows.map(r => r.map(c => (/[",\r\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(',')).join('\r\n') + '\r\n';

  return {RAMP, NUMERIC, SCORE, createModel, groupOf, periodOf, label, definition, groupLabel, stateLabel, originLabel, originDesc, displayName,
    unitFor, value, formatNumber, formatValue, rampColor, textColor, originGradient, heatScale, cellStyle, legendCounts, search, trend, niceTicks,
    makeRng, createFindGame, createOriginGame, knownBy, compareRows, bondClass, LAYOUT, rowOffset, tableLayout, CSV_HEADER, csvRows, toCsv};
});
