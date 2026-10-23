/* Discrete colour classes and parity filters for the chart of nuclides: ground-state spin, mass precision and model-minus-experiment
   deviation, each with a fixed, labelled legend, plus the energetic "possible / impossible" test of a decay or emission channel.
   Pure functions, no DOM. */
(() => {
  'use strict';

  /* ---- spin: Jπ text of NUBASE ("0+", "(7/2+)", "5/2+*", "1/2-#", "3/2+,5/2+", "(1,2)+", "7/2+ to 11/2+") ---- */
  function parseSpin(text) {
    const s = String(text ?? '').replace(/[*#]/g, '').trim();
    if (!s) return { J: null, parity: null, tentative: false, ambiguous: false };
    const tentative = /\(/.test(s);
    const body = s.replace(/[()]/g, '');
    if (/[,;]| to |\bor\b|:|>|<|~|\//.test(body.replace(/\d+\/\d+/g, ''))) return { J: null, parity: null, tentative, ambiguous: true };
    const m = /^(\d+(?:\/\d+)?)([+-]?)$/.exec(body.replace(/\s+/g, ''));
    if (!m) return { J: null, parity: null, tentative, ambiguous: /\d/.test(body) };
    const [a, b] = m[1].split('/').map(Number), J = b ? a / b : a;
    return { J, parity: m[2] || null, tentative, ambiguous: false };
  }
  const SPIN_LABELS = ['0', '1/2 or 1', '3/2 or 2', '5/2 or 3', '7/2 or 4', '9/2 or 5', '11/2 or 6', '13/2 or 7', '15/2 or 8', '>8'];
  const SPIN_COLOURS = ['#111827', '#1e3a8a', '#3b82f6', '#22d3ee', '#4ade80', '#facc15', '#f97316', '#ef4444', '#d946ef', '#7c3aed'];
  /* class index 0..9 (0, then ceil(J) for 1/2..8, then >8) or null when the spin is missing / ambiguous */
  function spinClass(text) {
    const p = parseSpin(text);
    if (p.J == null) return null;
    if (p.J === 0) return 0;
    const k = Math.ceil(p.J - 1e-9);
    return k > 8 ? 9 : k;
  }

  /* ---- mass precision: uncertainty of the mass excess in keV, extrapolated values apart ---- */
  const PRECISION_EDGES = [1, 5, 10, 50, 100];
  const PRECISION_LABELS = ['<1 keV', '1–5 keV', '5–10 keV', '10–50 keV', '50–100 keV', '>100 keV'];
  const PRECISION_COLOURS = ['#111827', '#14532d', '#4ade80', '#facc15', '#f97316', '#ef4444'];
  /* 0..5 for the six precision classes, 6 extrapolated (#), 7 unknown (no mass or no uncertainty) */
  function precisionClass(uncertaintyKeV, estimated, hasMass = true) {
    if (!hasMass) return 7;
    if (estimated) return 6;
    if (uncertaintyKeV == null || !Number.isFinite(uncertaintyKeV)) return 7;
    let k = 0; while (k < PRECISION_EDGES.length && uncertaintyKeV >= PRECISION_EDGES[k]) k++;
    return k;
  }

  /* ---- model deviation: ME(AME) - ME(model) in keV ---- */
  const DEVIATION_EDGES = [-1000, -500, -300, -100, 100, 300, 500, 1000];
  const DEVIATION_LABELS = ['≤ −1000', '−1000 … −500', '−500 … −300', '−300 … −100', '−100 … 100', '100 … 300', '300 … 500', '500 … 1000', '> 1000'];
  const DEVIATION_COLOURS = ['#ef4444', '#f97316', '#fbbf24', '#fde047', '#a3e635', '#15803d', '#67e8f9', '#2563eb', '#1e3a8a'];
  /* class 0..8 with the upper edge included in the lower class (≤ −1000, (−1000,−500], …, > 1000); null without a value */
  function deviationClass(keV) {
    if (keV == null || !Number.isFinite(keV)) return null;
    let k = 0; while (k < DEVIATION_EDGES.length && keV > DEVIATION_EDGES[k]) k++;
    return k;
  }

  /* ---- parity filters ---- */
  const parityOk = (n, kind) => kind === 'odd' ? n % 2 === 1 : kind === 'even' ? n % 2 === 0 : true;
  const nextParity = kind => kind === 'all' ? 'odd' : kind === 'odd' ? 'even' : 'all';

  /* ---- channel energetics: a decay is possible when Q > 0, a particle emission when its separation energy S < 0 ---- */
  function channelState(kind, valueKeV) {
    if (valueKeV == null || !Number.isFinite(valueKeV)) return 'nodata';
    const open = kind === 'S' ? valueKeV < 0 : valueKeV > 0;
    return open ? 'possible' : 'impossible';
  }

  /* ---- divided colour bar: n classes from interior edges ---- */
  /* equal-width interior edges (n - 1 of them) over [lo, hi]; with `symmetric` the range is ±max(|lo|,|hi|) and n is made odd, so the middle class contains zero */
  function equalEdges(lo, hi, n, symmetric = false) {
    n = Math.max(2, Math.min(40, Math.round(n)));
    if (symmetric) { const a = Math.max(Math.abs(lo), Math.abs(hi)); if (n % 2 === 0) n += 1; lo = -a; hi = a; }
    if (!(hi > lo)) return [];
    return Array.from({ length: n - 1 }, (_, i) => lo + (hi - lo) * (i + 1) / n);
  }
  /* equal-count interior edges: the values at the k/n quantiles; repeated edges are merged, so fewer classes can come back */
  function quantileEdges(values, n) {
    const s = values.filter(Number.isFinite).sort((a, b) => a - b); n = Math.max(2, Math.min(40, Math.round(n)));
    if (s.length < 2) return [];
    const at = q => { const x = (s.length - 1) * q, i = Math.floor(x), f = x - i; return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * f; };
    const e = []; for (let k = 1; k < n; k++) { const v = at(k / n); if (!e.length || v > e[e.length - 1]) e.push(v); }
    return e;
  }
  const parseEdges = text => [...new Set(String(text ?? '').split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  /* class of v: the number of interior edges strictly below it, so an edge value belongs to the lower class */
  function classIndex(v, edges) { let k = 0; while (k < edges.length && v > edges[k]) k++; return k; }
  /* one representative value per class, used to colour it with the same scale as the continuous bar: the middle of the part of the class
     that lies inside [lo, hi]; a class wholly outside the range takes the nearest range end */
  function classCentres(edges, lo, hi) {
    const pts = [-Infinity, ...edges, Infinity];
    return Array.from({ length: edges.length + 1 }, (_, i) => { const a = Math.max(pts[i], lo), b = Math.min(pts[i + 1], hi); return a <= b ? (a + b) / 2 : (pts[i + 1] < lo ? lo : hi); });
  }
  const classLabels = (edges, f) => edges.length ? ['≤ ' + f(edges[0]), ...edges.slice(1).map((e, i) => f(edges[i]) + ' … ' + f(e)), '> ' + f(edges[edges.length - 1])] : [];
  /* colour-blind-safe sequential scheme (viridis, eight anchors), x in [0, 1] */
  const VIRIDIS = [[68, 1, 84], [70, 50, 126], [54, 92, 141], [39, 127, 142], [31, 161, 135], [74, 194, 109], [159, 218, 58], [253, 231, 37]];
  function viridis(x) {
    const t = Math.max(0, Math.min(1, x)) * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(t)), f = t - i;
    return 'rgb(' + [0, 1, 2].map(k => Math.round(VIRIDIS[i][k] + (VIRIDIS[i + 1][k] - VIRIDIS[i][k]) * f)).join(',') + ')';
  }

  const api = Object.freeze({ equalEdges, quantileEdges, parseEdges, classIndex, classCentres, classLabels, viridis, parseSpin, spinClass, SPIN_LABELS, SPIN_COLOURS, precisionClass, PRECISION_EDGES, PRECISION_LABELS, PRECISION_COLOURS,
    deviationClass, DEVIATION_EDGES, DEVIATION_LABELS, DEVIATION_COLOURS, parityOk, nextParity, channelState });
  if (typeof window !== 'undefined') window.ZGChartClasses = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
