/* Dataset adapters, hand-data parsers and King-plot bands for the Research-page spectroscopy tools.
   Pure functions (no DOM) so they can be unit-tested in Node. Unknown uncertainties stay null, never 0. */
(() => {
  'use strict';
  const MAX_LINES = 5000;
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const num = s => { const t = String(s ?? '').trim(); if (t === '' || t === '-' || t === '—' || /^(nan|null|none|n\/a)$/i.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : NaN; };
  const spinValue = s => { const parts = String(s).split('/'); return parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(s); };
  const jpSpin = jp => { const m = /^\(?\s*(\d+(?:\/\d+)?)/.exec(String(jp || '')); return m ? m[1] : null; };

  /* IAEA compact table -> row objects used by the tools (ground states only keep their Jpi; kind u = unresolved). */
  function fromCompact(compact) {
    const cols = Object.fromEntries(compact.columns.map((c, i) => [c, i])), sym = compact.symbols || {}, radii = [], moments = [];
    for (const row of compact.rows) {
      const Z = row[cols.Z], A = row[cols.A], element = sym[String(Z)] || String(Z), jp = row[cols.Jpi], state = row[cols.kind] === 'u' ? 'unresolved' : 'ground';
      if (row[cols.r_fm] != null) radii.push({ element, A, Z, state, r_fm: row[cols.r_fm], sigma_fm: row[cols.sigma_r_fm], source_id: 'iaea-radii' });
      if (row[cols.mu_muN] != null || row[cols.Q_b] != null) {
        moments.push({ element, A, Z, state, spin: jpSpin(jp), spin_parity: jp, mu_muN: row[cols.mu_muN], sigma_muN: row[cols.sigma_mu_muN], Q_b: row[cols.Q_b], sigma_Q_b: row[cols.sigma_Q_b], source_id: 'iaea-moments' });
      }
    }
    return { radii, moments };
  }

  function splitLine(line) {
    if (line.includes('\t')) return line.split('\t').map(s => s.trim());
    if (line.includes(';')) return line.split(';').map(s => s.trim());
    if (line.includes(',')) return line.split(',').map(s => s.trim());
    return line.trim().split(/\s+/);
  }

  /* Hand-entered tables. kind: radii -> element,A,r_fm[,sigma_fm]; moments -> element,A,spin,mu_muN[,sigma_muN[,Q_b[,sigma_Q_b]]].
     A header line, # comments and blank lines are ignored. JSON arrays of objects with the same field names are accepted. */
  function parseTable(text, kind) {
    const errors = [], rows = [], raw = String(text || '').trim();
    if (!raw) return { rows, errors };
    if (raw.length > 400000) return { rows, errors: [{ line: 0, message: 'input too large' }] };
    if (raw[0] === '[') {
      let list; try { list = JSON.parse(raw); } catch (e) { return { rows, errors: [{ line: 1, message: 'invalid JSON' }] }; }
      if (!Array.isArray(list) || list.length > MAX_LINES) return { rows, errors: [{ line: 1, message: 'JSON array of at most ' + MAX_LINES + ' objects required' }] };
      list.forEach((o, i) => { const r = fromFields(kind, [o.element, o.A, kind === 'radii' ? o.r_fm : o.spin, kind === 'radii' ? o.sigma_fm : o.mu_muN, o.sigma_muN, o.Q_b, o.sigma_Q_b], i + 1); if (r.error) errors.push({ line: i + 1, message: r.error }); else rows.push(r.row); });
      return { rows, errors };
    }
    const lines = raw.split(/\r?\n/);
    if (lines.length > MAX_LINES) return { rows, errors: [{ line: 0, message: 'at most ' + MAX_LINES + ' lines' }] };
    lines.forEach((line, i) => {
      const s = line.trim(); if (!s || s.startsWith('#')) return;
      const f = splitLine(s);
      if (i === 0 && !/^\d/.test(f[1] ?? '') && /[a-z]/i.test(f[1] ?? '')) return; // header
      const r = fromFields(kind, f, i + 1);
      if (r.error) errors.push({ line: i + 1, message: r.error }); else rows.push(r.row);
    });
    return { rows, errors };
  }

  function fromFields(kind, f, line) {
    const element = String(f[0] ?? '').trim(), A = Number(f[1]);
    if (!/^[A-Za-z]{1,2}$/.test(element)) return { error: 'element symbol required' };
    if (!Number.isInteger(A) || A < 1 || A > 400) return { error: 'mass number A (1–400) required' };
    const e = element[0].toUpperCase() + element.slice(1).toLowerCase();
    if (kind === 'radii') {
      const r = num(f[2]), s = num(f[3]);
      if (r === null || Number.isNaN(r) || r <= 0) return { error: 'positive radius in fm required' };
      if (Number.isNaN(s) || (s !== null && s < 0)) return { error: 'uncertainty must be ≥ 0 or empty' };
      return { row: { element: e, A, state: 'user', r_fm: r, sigma_fm: s, source_id: 'user' } };
    }
    const spin = String(f[2] ?? '').trim(), I = spinValue(spin), mu = num(f[3]), sm = num(f[4]), Q = num(f[5]), sQ = num(f[6]);
    if (!/^\d+(\/\d+)?$/.test(spin) || !Number.isFinite(I) || I < 0) return { error: 'spin I such as 7/2 or 1 required' };
    if (mu === null && Q === null) return { error: 'a magnetic moment or a quadrupole moment is required' };
    if ([mu, sm, Q, sQ].some(v => Number.isNaN(v)) || (sm !== null && sm < 0) || (sQ !== null && sQ < 0)) return { error: 'invalid number or negative uncertainty' };
    return { row: { element: e, A, state: 'user', spin, spin_parity: spin, mu_muN: mu, sigma_muN: sm, Q_b: Q, sigma_Q_b: sQ, source_id: 'user' } };
  }

  /* King-plot lines: x,y[,sx,sy[,rho]]. Points with both sx and sy use the errors-in-variables fit. */
  function parseKing(text) {
    const lines = String(text || '').trim().split(/\r?\n/).filter(s => s.trim() && !s.trim().startsWith('#'));
    if (lines.length > 2000) throw Error('maximum 2000 points');
    const points = lines.map((s, i) => {
      const v = s.trim().split(/[\s,;]+/);
      if (v.length < 2 || v.length > 5 || v.some(x => x === '' || !Number.isFinite(Number(x)))) throw Error('x,y[,sx,sy[,rho]] required at line ' + (i + 1));
      const [x, y, sx, sy, rho] = v.map(Number), p = { x, y };
      if (v.length >= 3) { if (v.length < 4) throw Error('sx and sy must both be given at line ' + (i + 1)); if (sx < 0 || sy < 0) throw Error('negative uncertainty at line ' + (i + 1)); p.sx = sx; p.sy = sy; }
      if (v.length === 5) p.rho_xy = rho;
      return p;
    });
    const supplied = points.map(p => p.sx != null && p.sy != null);
    // A missing error is unknown. Mixing known/unknown rows must not silently
    // discard all supplied errors by falling back to a descriptive OLS fit.
    if (supplied.some(Boolean) && !supplied.every(Boolean)) {
      throw Object.assign(Error('Every King point must supply sx and sy, or all points must omit uncertainties'), { code: 'KING_MIXED_UNCERTAINTY' });
    }
    return { points, weighted: points.length >= 3 && supplied.every(Boolean) };
  }

  /* ±1σ band of the line y = a + b x from the parameter covariance [[var a, cov],[cov, var b]] (order intercept, slope). */
  function lineBand(a, b, cov, xs) {
    return xs.map(x => { const v = cov[0][0] + x * x * cov[1][1] + 2 * x * cov[0][1], h = Math.sqrt(Math.max(0, v)), y = a + b * x; return { x, y, lo: y - h, hi: y + h, sigma: h }; });
  }

  /* Unweighted OLS with a residual-scatter band; this is a descriptive band, not an error model of the inputs. */
  function olsWithBand(points, xs) {
    const n = points.length; if (n < 3) throw RangeError('three points required');
    const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0, sxy = 0; for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
    if (!(sxx > 0)) throw RangeError('three distinct x values required');
    const b = sxy / sxx, a = my - b * mx, ssr = points.reduce((s, p) => s + (p.y - a - b * p.x) ** 2, 0), s2 = ssr / (n - 2);
    const cov = [[s2 * (1 / n + mx * mx / sxx), -s2 * mx / sxx], [-s2 * mx / sxx, s2 / sxx]];
    return { slope: b, intercept: a, sigma_slope: Math.sqrt(cov[1][1]), sigma_intercept: Math.sqrt(cov[0][0]), parameter_covariance: cov, residual_sigma: Math.sqrt(s2), n, band: lineBand(a, b, cov, xs) };
  }

  /* Hand-entered nuclear scheme: "level,id,E_keV[,sigma[,Jpi]]" and "gamma,from,to,E_keV[,sigma]" lines. */
  function parseScheme(text, name) {
    const errors = [], levels = [], transitions = [];
    String(text || '').trim().split(/\r?\n/).forEach((line, i) => {
      const s = line.trim(); if (!s || s.startsWith('#')) return;
      const f = s.split(/[,;\t]/).map(v => v.trim());
      if (f[0].toLowerCase() === 'level') {
        const E = num(f[2]), sg = num(f[3]);
        if (!f[1] || E === null || Number.isNaN(E) || E < 0 || Number.isNaN(sg) || (sg !== null && sg < 0)) errors.push({ line: i + 1, message: 'level,id,E_keV[,sigma[,Jpi]] with E ≥ 0' });
        else levels.push({ id: f[1], energy_keV: E, sigma_energy_keV: sg, spin_parity: f[4] || '' });
      } else if (f[0].toLowerCase() === 'gamma') {
        const E = num(f[3]), sg = num(f[4]);
        if (!f[1] || !f[2] || E === null || Number.isNaN(E) || E <= 0 || Number.isNaN(sg) || (sg !== null && sg < 0)) errors.push({ line: i + 1, message: 'gamma,from,to,E_keV[,sigma] with E > 0' });
        else transitions.push({ from: f[1], to: f[2], energy_keV: E, sigma_energy_keV: sg });
      } else errors.push({ line: i + 1, message: 'line must start with level or gamma' });
    });
    const ids = new Set(levels.map(l => l.id));
    if (ids.size !== levels.length) errors.push({ line: 0, message: 'duplicate level id' });
    const energy = new Map(levels.map(l => [l.id, l.energy_keV]));
    transitions.forEach(t => { if (!ids.has(t.from) || !ids.has(t.to)) errors.push({ line: 0, message: 'gamma refers to an undefined level' }); else if (!(energy.get(t.from) > energy.get(t.to))) errors.push({ line: 0, message: 'gamma must connect a higher level to a lower level' }); });
    return { scheme: { nuclide: name || 'user', source_id: 'user', levels, transitions }, errors };
  }

  const api = Object.freeze({ fromCompact, parseTable, parseKing, lineBand, olsWithBand, parseScheme, spinValue, jpSpin });
  if (typeof window !== 'undefined') window.TrapsSpectroscopyData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
