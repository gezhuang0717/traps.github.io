/* User data layer for the chart of nuclides: parse CSV / TSV / TXT / JSON tables in which every row identifies a nuclide by any two of
   Z, N, A (or an element symbol plus A or N) and carries one or more numeric value columns. Pure functions, no DOM. */
(() => {
  'use strict';
  const MAX_ROWS = 20000, MAX_CHARS = 5000000;
  const ALIAS = {
    Z: ['z', 'protons', 'proton', 'protonnumber', 'atomicnumber', 'zp'],
    N: ['n', 'neutrons', 'neutron', 'neutronnumber', 'nn'],
    A: ['a', 'massnumber', 'nucleons', 'amass', 'an'],
    S: ['element', 'symbol', 'sym', 'el', 'elem'],
  };
  const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const role = name => { const n = norm(name); for (const [k, list] of Object.entries(ALIAS)) if (list.includes(n)) return k; return null; };
  const isNum = t => t !== '' && Number.isFinite(Number(t)) && !/^0x/i.test(t);
  const split = line => line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : line.includes(',') ? line.split(',') : line.trim().split(/\s+/);

  function table(text) {
    const raw = String(text ?? '');
    if (raw.length > MAX_CHARS) throw Error('input larger than 5 MB');
    const t = raw.trim();
    if (!t) return { header: [], rows: [] };
    if (t[0] === '[' || t[0] === '{') {
      const j = JSON.parse(t);
      if (Array.isArray(j)) { const header = [...new Set(j.flatMap(o => Object.keys(o)))]; return { header, rows: j.map(o => header.map(h => o[h] ?? '')) }; }
      if (Array.isArray(j.rows) && Array.isArray(j.columns)) return { header: j.columns, rows: j.rows };
      const header = Object.keys(j), n = Math.max(...header.map(h => Array.isArray(j[h]) ? j[h].length : 0));
      return { header, rows: Array.from({ length: n }, (_, i) => header.map(h => j[h][i] ?? '')) };
    }
    const lines = t.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
    const first = split(lines[0]).map(s => s.trim());
    const hasHeader = first.some(s => !isNum(s));
    const rows = (hasHeader ? lines.slice(1) : lines).map(l => split(l).map(s => s.trim()));
    return { header: hasHeader ? first : null, rows };
  }

  /* options: symbolToZ (Map) for element symbols; assume: 'ZN' | 'ZA' | 'NA' used when the table has no header. */
  function parse(text, options = {}) {
    const symbolToZ = options.symbolToZ || new Map(), assume = options.assume || 'ZN';
    const { header, rows: raw } = table(text);
    if (!raw.length) return { rows: [], valueColumns: [], errors: [], columns: [], duplicates: 0 };
    if (raw.length > MAX_ROWS) throw Error('at most ' + MAX_ROWS + ' rows');
    const width = Math.max(...raw.map(r => r.length));
    const names = header ? header.map(String) : [...assume.split(''), ...Array.from({ length: width - 2 }, (_, i) => 'value' + (i + 1))];
    const roles = names.map(role);
    const ids = {}; roles.forEach((r, i) => { if (r && ids[r] === undefined) ids[r] = i; });
    const have = ['Z', 'N', 'A'].filter(k => ids[k] !== undefined).length + (ids.S !== undefined ? 1 : 0);
    const errors = [];
    const ok = (ids.Z !== undefined && ids.N !== undefined) || (ids.Z !== undefined && ids.A !== undefined) || (ids.N !== undefined && ids.A !== undefined) || ids.S !== undefined;  // a symbol alone works when it carries the mass number (48Ca)
    if (!ok) return { rows: [], valueColumns: [], errors: [{ line: 0, message: 'need two of Z, N, A or element symbol with A or N' }], columns: names, duplicates: 0 };
    const used = new Set(Object.values(ids));
    const valueColumns = names.map((n, i) => ({ name: n || 'col' + (i + 1), index: i })).filter(c => !used.has(c.index) && raw.some(r => isNum(String(r[c.index] ?? '').trim())));
    const rows = [], seen = new Map(); let duplicates = 0;
    const int = (s, lo, hi) => { const x = Number(s); return Number.isInteger(x) && x >= lo && x <= hi ? x : null; };
    raw.forEach((r, i) => {
      const line = i + (header ? 2 : 1), get = k => ids[k] === undefined ? null : String(r[ids[k]] ?? '').trim();
      const cell = k => { const x = get(k); return x === null || x === '' ? null : x; };
      let Z = cell('Z') === null ? null : int(cell('Z'), 0, 130), N = cell('N') === null ? null : int(cell('N'), 0, 260), A = cell('A') === null ? null : int(cell('A'), 1, 390);
      if (get('S') !== null && Z === null) { const sym = get('S').replace(/^\d+/, ''); const z = symbolToZ.get(sym.charAt(0).toUpperCase() + sym.slice(1).toLowerCase()); if (z === undefined) { errors.push({ line, message: 'unknown element symbol ' + get('S') }); return; } Z = z; if (A === null && N === null) { const m = /^(\d+)/.exec(get('S')); if (m) A = Number(m[1]); } }
      if ([['Z', cell('Z'), Z], ['N', cell('N'), N], ['A', cell('A'), A]].some(([, s, v]) => s !== null && v === null)) { errors.push({ line, message: 'Z, N and A must be integers in range' }); return; }
      if (Z !== null && N === null && A !== null) N = A - Z; else if (N !== null && Z === null && A !== null) Z = A - N; else if (Z !== null && N !== null && A === null) A = Z + N;
      else if (Z !== null && N !== null && A !== null && A !== Z + N) { errors.push({ line, message: 'A ≠ Z + N' }); return; }
      if (Z === null || N === null || Z < 0 || N < 0) { errors.push({ line, message: 'cannot determine Z and N' }); return; }
      const values = {};
      for (const c of valueColumns) { const s = String(r[c.index] ?? '').trim(); if (isNum(s)) values[c.name] = Number(s); }
      if (!Object.keys(values).length) { errors.push({ line, message: 'no numeric value' }); return; }
      const key = Z + ',' + N;
      if (seen.has(key)) { duplicates++; rows[seen.get(key)] = { Z, N, values }; } else { seen.set(key, rows.length); rows.push({ Z, N, values }); }  // a repeated nuclide: the later row wins
    });
    return { rows, valueColumns: valueColumns.map(c => c.name), errors, columns: names, duplicates };
  }

  function range(values) { let lo = Infinity, hi = -Infinity; for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; } return Number.isFinite(lo) ? [lo, hi] : null; }
  /* percentile range (default 2–98 %) so that a few outliers do not flatten the colour scale */
  function robustRange(values, p = 2) {
    const s = values.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null;
    const at = q => { const x = (s.length - 1) * q / 100, i = Math.floor(x), f = x - i; return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * f; };
    const lo = at(p), hi = at(100 - p); return lo === hi ? range(s) : [lo, hi];
  }

  const api = Object.freeze({ parse, table, range, robustRange, role });
  if (typeof window !== 'undefined') window.ZGChartUserData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
