/* Reference isotope helper: atomic mass, mass excess, binding energy, separation energies and Q values of one nuclide from the published
   AME2020 tables (static/data/research-cache/ame2020-reference.json, tools/make_ame_reference.py), plus a small binder that fills ordinary
   number inputs from it while a checkbox is ticked. Editing a filled input by hand unticks the box, so the visitor's own value is never
   overwritten. Units: keV, u (u = 931494.10242 keV, CODATA 2018 as in AME2020), keV per nucleon for B/A. Uncertainties are the published ones. */
(() => {
  'use strict';
  const U_KEV = 931494.10242, ELECTRON_U = 5.48579909065e-4;
  const norm = s => { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };

  /* "48Ca", "48 Ca", "48-Ca", "Ca48", "Ca-48", "ca 48" -> { symbol, A } ; null when the text is not an isotope label */
  function parseIsotope(text) {
    const s = String(text ?? '').trim();
    let m = /^(\d{1,3})\s*[- ]?\s*([A-Za-z]{1,2})$/.exec(s);
    if (m) return { symbol: norm(m[2]), A: Number(m[1]) };
    m = /^([A-Za-z]{1,2})\s*[- ]?\s*(\d{1,3})$/.exec(s);
    return m ? { symbol: norm(m[1]), A: Number(m[2]) } : null;
  }

  function fromJson(json) {
    const c = Object.fromEntries(json.columns.map((n, i) => [n, i])), byKey = new Map(), bySymbol = new Map();
    for (const r of json.rows) { byKey.set(r[0] + ',' + r[1], r); if (!bySymbol.has(r[2]) || r[2] === 'n' || r[0] > 0) bySymbol.set(r[2], r[0]); }
    const q = (row, name) => !row || row[c[name]] == null ? null : { v: row[c[name]], s: row[c[name + '_s']], est: row[c[name + '_x']] === 1 };
    const rowOf = (Z, A) => byKey.get(Z + ',' + (A - Z)) || null;
    function lookup(symbol, A) {
      const Z = bySymbol.get(norm(symbol)); if (Z === undefined) return null;
      const row = rowOf(Z, A); return row ? { Z, A, N: A - Z, symbol: row[2], row } : null;
    }
    /* All quantities of one nuclide. Each is { v, s, est } or null when AME2020 does not publish it. */
    function info(symbol, A) {
      const rec = lookup(symbol, A); if (!rec) return null;
      const { row, Z } = rec, me = q(row, 'me'), bea = q(row, 'bea'), below = rowOf(Z - 1, A);
      const qbmBelow = q(below, 'qbm');
      return {
        label: A + rec.symbol, symbol: rec.symbol, Z, N: rec.N, A,
        massExcessKeV: me,
        atomicMassU: me && { v: A + me.v / U_KEV, s: me.s == null ? null : me.s / U_KEV, est: me.est },
        bindingPerNucleonKeV: bea,
        bindingKeV: bea && { v: A * bea.v, s: bea.s == null ? null : A * bea.s, est: bea.est },   // A x published B/A, as in the reactions file
        sn: q(row, 'sn'), s2n: q(row, 's2n'), sp: q(row, 'sp'), s2p: q(row, 's2p'),
        qbm: q(row, 'qbm'), qa: q(row, 'qa'), q2bm: q(row, 'q2bm'),
        qec: qbmBelow && { v: -qbmBelow.v, s: qbmBelow.s, est: qbmBelow.est },                  // Q(EC) of (Z, A) = -Q(beta-) of (Z-1, A), published
      };
    }
    return { lookup, info, count: json.rows.length, meta: json.meta };
  }

  /* number of electrons removed: the ion mass is the atomic mass minus q electron masses (electron binding energies are neglected) */
  const ionMassU = (infoObj, q) => infoObj && infoObj.atomicMassU ? { ...infoObj.atomicMassU, v: infoObj.atomicMassU.v - q * ELECTRON_U } : null;

  /* keys that a bound input may request */
  const KEYS = {
    massU: i => i.atomicMassU, massU_s: i => i.atomicMassU && { v: i.atomicMassU.s },
    massExcessKeV: i => i.massExcessKeV, massExcessKeV_s: i => i.massExcessKeV && { v: i.massExcessKeV.s },
    bindingKeV: i => i.bindingKeV, bindingKeV_s: i => i.bindingKeV && { v: i.bindingKeV.s },
    bindingPerNucleonKeV: i => i.bindingPerNucleonKeV, bindingPerNucleonKeV_s: i => i.bindingPerNucleonKeV && { v: i.bindingPerNucleonKeV.s },
    sn: i => i.sn, sp: i => i.sp, s2n: i => i.s2n, s2p: i => i.s2p, qbm: i => i.qbm, qec: i => i.qec, qa: i => i.qa,
  };
  const digits = (v, n) => String(Number(Number(v).toPrecision(n)));

  /* o = { load: () => Promise<ref>, isotope: <input text>, check: <input checkbox>, fields: [{ el, key, ion }], charge: <input> | null, status: <element>,
           text: { loading, missing, user, source, estimated }, onFill?: (info) => void }.  Returns { refill }.  The result of every fill is a plain 'input' event, so a
           host that clears stale output on input keeps working. */
  function bind(o) {
    let ref = null, filling = false;
    const T = Object.assign({ loading: 'loading AME2020 …', missing: 'not in AME2020', user: 'your own values', source: 'AME2020', estimated: 'estimated (#)' }, o.text || {});
    const say = s => { if (o.status) o.status.textContent = s; };
    async function refill() {
      if (!o.check.checked) { say(T.user); return; }
      try { if (!ref) { say(T.loading); ref = await o.load(); } } catch (e) { say(String(e && e.message || e)); return; }
      const p = parseIsotope(o.isotope.value), i = p && ref.info(p.symbol, p.A);
      if (!i) { say(p ? T.missing + ': ' + o.isotope.value.trim() : T.missing); return; }
      const q = o.charge ? Number(o.charge.value) : 0; let est = false;
      filling = true;
      try {
        for (const f of o.fields) {
          let x = f.ion ? ionMassU(i, Number.isFinite(q) ? q : 0) : (KEYS[f.key] || (() => null))(i);
          if (f.key.endsWith('_s') && x && x.v == null) x = null;
          if (!x || x.v == null || !Number.isFinite(x.v)) { f.el.value = ''; continue; }
          f.el.value = digits(x.v, f.key.endsWith('_s') ? 3 : 12); est = est || !!x.est;
          f.el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } finally { filling = false; }
      say(T.source + ' · ' + i.label + (est ? ' · ' + T.estimated : ''));
      if (o.onFill) o.onFill(i);
    }
    const edited = () => { if (!filling && o.check.checked) { o.check.checked = false; say(T.user); } };
    o.fields.forEach(f => f.el.addEventListener('input', edited));
    o.isotope.addEventListener('input', refill); o.isotope.addEventListener('change', refill);
    o.check.addEventListener('change', refill);
    if (o.charge) o.charge.addEventListener('input', () => { if (o.fields.some(f => f.ion)) refill(); });
    return { refill };
  }

  const api = Object.freeze({ U_KEV, ELECTRON_U, parseIsotope, fromJson, ionMassU, bind });
  if (typeof window !== 'undefined') window.TrapsAmeReference = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
