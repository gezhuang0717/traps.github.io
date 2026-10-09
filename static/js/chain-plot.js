(function (host) {
  'use strict';
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const valid = p => finite(p.x) && finite(p.y);
  function chainExtent(data, models = [], options = {}) {
    const points = data.concat(models).filter(valid);
    const xs = options.xMode === 'full' ? (options.fullX || []).filter(finite) : points.map(p => p.x);
    let x0 = xs.length ? Math.min(...xs) - 1 : 0, x1 = xs.length ? Math.max(...xs) + 1 : 1;
    const yp = options.yMode === 'data' && data.some(valid) ? data.filter(valid) : points;
    const ys = yp.flatMap(p => options.errors === false ? [p.y] : [p.y - (finite(p.e) ? p.e : 0), p.y + (finite(p.e) ? p.e : 0)]);
    let y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : 1;
    const pad = (y1 - y0) * .08 || 1; y0 -= pad; y1 += pad;
    const warnings = [], m = options.manual || {};
    for (const [mode, lo, hi] of [[options.xMode, 'x0', 'x1'], [options.yMode, 'y0', 'y1']]) {
      if (mode !== 'manual') continue;
      if (!(finite(m[lo]) && finite(m[hi]) && m[hi] > m[lo])) warnings.push(lo[0]);
      else if (lo === 'x0') { x0 = m.x0; x1 = m.x1; } else { y0 = m.y0; y1 = m.y1; }
    }
    return { x0, x1, y0, y1, warnings };
  }
  function geometry(extent, width, height, multiple = false, scale = 1) {
    const L = 62 * scale, R = (multiple ? 78 : 18) * scale, T = 18 * scale, B = 42 * scale;
    const px = x => L + (x - extent.x0) / (extent.x1 - extent.x0) * (width - L - R);
    const py = y => height - B - (y - extent.y0) / (extent.y1 - extent.y0) * (height - B - T);
    return { L, R, T, B, right: width - R, bottom: height - B, px, py, clampY: y => Math.max(T, Math.min(height - B, py(y))) };
  }
  function nearest(points, x, y, geom, radius = 24) {
    let found = null, distance = radius ** 2;
    for (const p of points.filter(valid)) {
      const dx = geom.px(p.x) - x, dy = geom.clampY(p.y) - y;
      const d = dx * dx + dy * dy;
      if (d <= distance && geom.px(p.x) >= geom.L && geom.px(p.x) <= geom.right) { found = p; distance = d; }
    }
    return found;
  }
  const connects = (a, b, step = 1) => a && b && a.g === b.g && b.x - a.x === step;
  function rangeFor(memory, type, own) {
    return memory[type] || { c0: String(own), c1: String(own), x0: '', x1: '' };
  }
  const api = { chainExtent, geometry, nearest, connects, rangeFor };
  host.ZGChainPlot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
