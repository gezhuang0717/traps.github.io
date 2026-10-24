/* Plot engine of the measurement workbenches (TOF-ICR, MR-TOF, Penning): one scene description, drawn to a canvas for the page and written
   as SVG for saving, so the saved figure always contains exactly what is shown: axes, in-figure legend with every species and isomer,
   markers and a parameter caption. Zoom (buttons, Ctrl/⌘ + wheel, drag, double-click) changes only the view, never the data.
   series: [{ label, color, points:[[x,y,sigma?],…], width?, dash?, dots?, bars? }]
   options: { xlabel, ylabel, title, caption:[lines], x:[lo,hi], y:[lo,hi], markers:[{x,color,label}], style, legend:'bottom'|'in'|'off', width, height }
   style:   { titleSize, axisSize, tickSize, legendSize, markerDiameter, lineWidth }  (px; same keys as ZGFigureStyle)                         */
(function (host) {
  'use strict';
  if (host.ZGWbPlot) { if (typeof module === 'object') module.exports = host.ZGWbPlot; return; }
  const BASE = Object.freeze({ titleSize: 16, axisSize: 13, tickSize: 11, legendSize: 11, markerDiameter: 6, lineWidth: 1 });
  const fmt = (x, n = 3) => x == null || !Number.isFinite(x) ? '—' : String(Number(x.toPrecision(n)));
  const textWidth = (s, size) => String(s).length * size * .58;
  const finite = p => Number.isFinite(p[0]) && Number.isFinite(p[1]);

  function dataRanges(series, options) {
    const pts = series.flatMap(s => s.points).filter(finite);
    let xr = options.x || [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))];
    let yr = options.y || [Math.min(0, ...pts.map(p => p[1] - (p[2] || 0))), Math.max(0, ...pts.map(p => p[1] + (p[2] || 0))) * 1.08];
    if (!pts.length && !options.x) xr = [-1, 1];
    if (!(xr[1] > xr[0])) xr = [xr[0] - 1, xr[0] + 1];
    if (!(yr[1] > yr[0])) yr = [yr[0] - 1, yr[0] + 1];
    return { x: xr, y: yr };
  }
  function legendEntries(series, options) {
    const out = [];
    for (const s of series) if (s.label && !s.noLegend) out.push({ kind: s.bars ? 'bars' : s.dots ? 'dots' : 'line', color: s.color, dash: s.dash, text: s.label });
    for (const m of options.markers || []) if (m && m.label) out.push({ kind: 'marker', color: m.color, text: m.label });
    return out;
  }
  function flow(entries, width, size) {
    const rows = [[]]; let x = 0;
    for (const e of entries) { const w = 30 + textWidth(e.text, size) + 14; if (x + w > width && rows.at(-1).length) { rows.push([]); x = 0; } rows.at(-1).push({ ...e, x, w }); x += w; }
    return rows;
  }

  /* The scene: a flat list of primitives in CSS-pixel coordinates plus the data needed for hover and zoom. */
  function scene(rawSeries, options = {}) {
    const ink = options.ink || '#1d2433', resolve = c => c === 'ink' ? ink : c;
    const series = rawSeries.map(s => ({ ...s, color: resolve(s.color) }));
    options = { ...options, markers: (options.markers || []).map(m => typeof m === 'number' ? { x: m } : { ...m, color: resolve(m.color) }) };
    const S = { ...BASE, ...(options.style || {}) }, W = Math.max(220, Math.round(options.width || 650));
    const entries = options.legend === 'off' ? [] : legendEntries(series, options);
    const l = Math.round(30 + S.tickSize * 5), r = W - Math.round(10 + S.tickSize * 2.6), mid = (l + r) / 2;
    const title = options.title ? wrapLines(options.title, W - 24, S.titleSize) : [];
    const cap = (options.caption || []).flatMap(line => wrapLines(line, W - 24, Math.max(9, S.legendSize - 1)));
    const t = 10 + title.length * (S.titleSize + 4) + (title.length ? 4 : 0), plotH = options.height || (W < 500 ? 215 : 250), b = t + plotH;
    const rows = options.legend === 'in' ? [] : flow(entries, W - 24, S.legendSize);
    const legendTop = b + S.tickSize + S.axisSize + 26, capTop = legendTop + rows.length * (S.legendSize + 8) + (cap.length ? 6 : 0);
    const H = Math.round(capTop + cap.length * (S.legendSize + 3) + 10);
    const view = dataRanges(series, options), xr = view.x, yr = view.y;
    const X = v => l + (v - xr[0]) / (xr[1] - xr[0]) * (r - l), Y = v => b - (v - yr[0]) / (yr[1] - yr[0]) * (b - t);
    const items = [], hits = [], grid = 'rgba(127,127,160,.2)';
    title.forEach((line, i) => items.push({ t: 'text', x: mid, y: 8 + S.titleSize + i * (S.titleSize + 4), s: line, size: S.titleSize, anchor: 'middle', color: ink, weight: 600 }));
    for (let i = 0; i <= 4; i++) {
      const xv = xr[0] + (xr[1] - xr[0]) * i / 4, yv = yr[0] + (yr[1] - yr[0]) * i / 4;
      items.push({ t: 'segs', list: [[X(xv), t, X(xv), b], [l, Y(yv), r, Y(yv)]], stroke: grid, w: 1 },
        { t: 'text', x: X(xv), y: b + S.tickSize + 6, s: fmt(xv), size: S.tickSize, anchor: 'middle', color: ink },
        { t: 'text', x: l - 6, y: Y(yv) + S.tickSize * .35, s: fmt(yv), size: S.tickSize, anchor: 'end', color: ink });
    }
    const clip = { t: 'clip', x: l, y: t, w: r - l, h: b - t, items: [] };
    const radius = Math.max(1.5, S.markerDiameter / 2);
    for (const s of series) {
      const pts = s.points.filter(finite);
      if (s.bars) {
        const bw = pts.length > 1 ? Math.abs(X(pts[1][0]) - X(pts[0][0])) : r - l;
        for (const p of pts) clip.items.push({ t: 'rect', x: X(p[0]) - bw / 2, y: Y(p[1]), w: Math.max(1, bw - .3), h: Y(0) - Y(p[1]), fill: s.color });
      } else if (s.dots) {
        clip.items.push({ t: 'segs', list: pts.filter(p => p[2] > 0).map(p => [X(p[0]), Y(p[1] - p[2]), X(p[0]), Y(p[1] + p[2])]), stroke: s.color, w: 1.2 * S.lineWidth });
        for (const p of pts) clip.items.push({ t: 'circle', x: X(p[0]), y: Y(p[1]), r: radius, fill: s.color, stroke: '#fff', sw: .8 });
      } else if (pts.length > 1) clip.items.push({ t: 'line', pts: pts.map(p => [X(p[0]), Y(p[1])]), stroke: s.color, w: (s.width || 1.8) * S.lineWidth, dash: s.dash });
      for (const p of pts) if (!s.bars && Number.isFinite(X(p[0]))) hits.push({ sx: X(p[0]), sy: Y(p[1]), label: s.label || '', x: p[0], y: p[1], sigma: p[2] });
    }
    for (const mk of options.markers) { if (Number.isFinite(mk.x)) clip.items.push({ t: 'line', pts: [[X(mk.x), t], [X(mk.x), b]], stroke: mk.color || ink, w: 1.2 * S.lineWidth, dash: [3, 4] }); }
    items.push(clip, { t: 'rect', x: l, y: t, w: r - l, h: b - t, stroke: 'rgba(100,100,130,.7)', sw: 1 });
    items.push({ t: 'text', x: mid, y: b + S.tickSize + S.axisSize + 14, s: options.xlabel || '', size: S.axisSize, anchor: 'middle', color: ink },
      { t: 'text', x: 14, y: (t + b) / 2, s: options.ylabel || '', size: S.axisSize, anchor: 'middle', color: ink, rot: -90 });
    const sample = (e, x, y) => {
      if (e.kind === 'bars') items.push({ t: 'rect', x, y: y - 5, w: 22, h: 9, fill: e.color });
      else if (e.kind === 'dots') items.push({ t: 'circle', x: x + 11, y, r: radius, fill: e.color, stroke: '#fff', sw: .8 });
      else items.push({ t: 'line', pts: [[x, y], [x + 22, y]], stroke: e.color, w: 2.2 * S.lineWidth, dash: e.kind === 'marker' ? [3, 4] : e.dash });
    };
    rows.forEach((row, ri) => row.forEach(e => { const y = legendTop + ri * (S.legendSize + 8), x = 12 + e.x; sample(e, x, y - S.legendSize * .35); items.push({ t: 'text', x: x + 28, y, s: e.text, size: S.legendSize, anchor: 'start', color: ink }); }));
    if (options.legend === 'in' && entries.length) {
      const boxW = Math.max(...entries.map(e => textWidth(e.text, S.legendSize))) + 44, boxH = entries.length * (S.legendSize + 7) + 8, bx = r - boxW - 6, by = t + 6;
      items.push({ t: 'rect', x: bx, y: by, w: boxW, h: boxH, fill: options.background ? 'rgba(255,255,255,.9)' : 'rgba(127,127,160,.14)', stroke: 'rgba(100,100,130,.5)', sw: 1 });
      entries.forEach((e, i) => { const y = by + 6 + (i + 1) * (S.legendSize + 7) - 4; sample(e, bx + 6, y - S.legendSize * .35); items.push({ t: 'text', x: bx + 34, y, s: e.text, size: S.legendSize, anchor: 'start', color: ink }); });
    }
    cap.forEach((line, i) => items.push({ t: 'text', x: 12, y: capTop + (i + 1) * (S.legendSize + 3) - 2, s: line, size: Math.max(9, S.legendSize - 1), anchor: 'start', color: '#53647a' }));
    return { W, H, l, r, t, b, xr, yr, items, hits, entries, style: S };
  }
  function wrapLines(text, maxWidth, size) {
    const lines = []; let line = '';
    for (const word of String(text).split(/\s+/)) { const next = line ? line + ' ' + word : word; if (line && textWidth(next, size) > maxWidth) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line); return lines.length ? lines : [''];
  }

  function drawItems(g, items) {
    for (const it of items) {
      if (it.t === 'clip') { g.save(); g.beginPath(); g.rect(it.x, it.y, it.w, it.h); g.clip(); drawItems(g, it.items); g.restore(); }
      else if (it.t === 'segs') { g.beginPath(); for (const [a, b, c, d] of it.list) { g.moveTo(a, b); g.lineTo(c, d); } g.strokeStyle = it.stroke; g.lineWidth = it.w; g.setLineDash([]); g.stroke(); }
      else if (it.t === 'line') { g.beginPath(); it.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = it.stroke; g.lineWidth = it.w; g.setLineDash(it.dash || []); g.stroke(); g.setLineDash([]); }
      else if (it.t === 'rect') { if (it.fill) { g.fillStyle = it.fill; g.fillRect(it.x, it.y, it.w, it.h); } if (it.stroke) { g.strokeStyle = it.stroke; g.lineWidth = it.sw || 1; g.strokeRect(it.x, it.y, it.w, it.h); } }
      else if (it.t === 'circle') { g.beginPath(); g.arc(it.x, it.y, it.r, 0, 2 * Math.PI); if (it.fill) { g.fillStyle = it.fill; g.fill(); } if (it.stroke) { g.strokeStyle = it.stroke; g.lineWidth = it.sw || 1; g.stroke(); } }
      else if (it.t === 'text') { g.save(); g.fillStyle = it.color; g.font = `${it.weight || 400} ${it.size}px system-ui, Arial, sans-serif`; g.textAlign = it.anchor === 'end' ? 'right' : it.anchor === 'middle' ? 'center' : 'left'; g.translate(it.x, it.y); if (it.rot) g.rotate(it.rot * Math.PI / 180); g.fillText(it.s, 0, 0); g.restore(); }
    }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n2 = v => Number(v.toFixed(2));
  function itemsToSVG(items, counter) {
    return items.map(it => {
      if (it.t === 'clip') { const id = 'wbclip' + (counter.n++); return `<clipPath id="${id}"><rect x="${n2(it.x)}" y="${n2(it.y)}" width="${n2(it.w)}" height="${n2(it.h)}"/></clipPath><g clip-path="url(#${id})">${itemsToSVG(it.items, counter)}</g>`; }
      if (it.t === 'segs') return `<path d="${it.list.map(([a, b, c, d]) => `M${n2(a)},${n2(b)}L${n2(c)},${n2(d)}`).join('')}" fill="none" stroke="${esc(it.stroke)}" stroke-width="${it.w}"/>`;
      if (it.t === 'line') return `<path d="${it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)},${n2(y)}`).join('')}" fill="none" stroke="${esc(it.stroke)}" stroke-width="${it.w}"${it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : ''}/>`;
      if (it.t === 'rect') return `<rect x="${n2(it.x)}" y="${n2(it.y)}" width="${n2(Math.max(0, it.w))}" height="${n2(Math.abs(it.h))}"${it.h < 0 ? ` transform="translate(0 ${n2(it.h)})"` : ''} fill="${it.fill ? esc(it.fill) : 'none'}"${it.stroke ? ` stroke="${esc(it.stroke)}" stroke-width="${it.sw || 1}"` : ''}/>`;
      if (it.t === 'circle') return `<circle cx="${n2(it.x)}" cy="${n2(it.y)}" r="${n2(it.r)}" fill="${it.fill ? esc(it.fill) : 'none'}"${it.stroke ? ` stroke="${esc(it.stroke)}" stroke-width="${it.sw || 1}"` : ''}/>`;
      if (it.t === 'text') return `<text x="${n2(it.x)}" y="${n2(it.y)}" font-size="${it.size}" font-family="system-ui, Arial, sans-serif" font-weight="${it.weight || 400}" text-anchor="${it.anchor}" fill="${esc(it.color)}"${it.rot ? ` transform="rotate(${it.rot} ${n2(it.x)} ${n2(it.y)})"` : ''}>${esc(it.s)}</text>`;
      return '';
    }).join('');
  }
  /* A self-contained SVG: white background, the same scene as the canvas, and a <desc> with the metadata that produced it. */
  function toSVG(sc, metadata = null) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sc.W} ${sc.H}" width="${sc.W}" height="${sc.H}" role="img">${metadata ? `<desc>${esc(JSON.stringify(metadata))}</desc>` : ''}<rect width="${sc.W}" height="${sc.H}" fill="#fff"/>${itemsToSVG(sc.items, { n: 0 })}</svg>`;
  }

  /* Canvas drawing: `canvas._series` / `_options` / `_view` / `_style` are kept so every redraw and export uses the same state. */
  function plot(canvas, series, options = {}) {
    const width = Math.max(220, options.renderWidth || canvas.clientWidth || 650), dpr = options.renderScale || Math.min(3, (host.devicePixelRatio || 1));
    const ink = options.ink || (host.getComputedStyle ? host.getComputedStyle(canvas).color : '') || '#1d2433';
    const opts = { ...options, ink, width, style: { ...(options.style || {}), ...(canvas._style || {}) }, x: (canvas._view && canvas._view.x) || options.x, y: (canvas._view && canvas._view.y) || options.y, legend: canvas._legend || options.legend || 'bottom' };
    const sc = scene(series, opts);
    canvas.width = Math.round(sc.W * dpr); canvas.height = Math.round(sc.H * dpr); if (canvas.style) canvas.style.height = sc.H + 'px';
    const g = canvas.getContext('2d'); g.scale(dpr, dpr);
    if (options.background) { g.fillStyle = options.background; g.fillRect(0, 0, sc.W, sc.H); }
    drawItems(g, sc.items);
    canvas._series = series; canvas._options = options; canvas._scene = sc;
    if (canvas.setAttribute) canvas.setAttribute('aria-label', `${options.title ? options.title + '. ' : ''}${options.xlabel || ''}; ${options.ylabel || ''}. ${options.description || ''}${sc.entries.length ? ' ' + sc.entries.map(e => e.text).join('; ') : ''}`);
    return sc;
  }

  const zoomRange = (range, factor, center) => { const c = center == null ? (range[0] + range[1]) / 2 : center; return [c - (c - range[0]) * factor, c + (range[1] - c) * factor]; };
  const panRange = (range, delta) => [range[0] + delta, range[1] + delta];

  /* Interactions on one canvas: Ctrl/⌘ + wheel zoom about the cursor, drag to pan, double-click to reset, hover value tooltip. */
  function attach(canvas, redraw, tip) {
    let drag = null;
    const pos = e => { const r = canvas.getBoundingClientRect(), sc = canvas._scene; return { x: (e.clientX - r.left) / r.width * sc.W, y: (e.clientY - r.top) / r.height * sc.H }; };
    const inside = p => { const sc = canvas._scene; return p.x >= sc.l && p.x <= sc.r && p.y >= sc.t && p.y <= sc.b; };
    const dataAt = p => { const sc = canvas._scene; return { x: sc.xr[0] + (p.x - sc.l) / (sc.r - sc.l) * (sc.xr[1] - sc.xr[0]), y: sc.yr[0] + (sc.b - p.y) / (sc.b - sc.t) * (sc.yr[1] - sc.yr[0]) }; };
    const setView = v => { canvas._view = v; redraw(); };
    canvas.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey) || !canvas._scene) return; const p = pos(e); if (!inside(p)) return; e.preventDefault(); const f = e.deltaY < 0 ? .8 : 1.25, d = dataAt(p), sc = canvas._scene; setView({ x: zoomRange(sc.xr, f, d.x), y: zoomRange(sc.yr, f, d.y) }); }, { passive: false });
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || !canvas._scene) return; const p = pos(e); if (!inside(p)) return; drag = { p, xr: canvas._scene.xr.slice(), yr: canvas._scene.yr.slice(), moved: false }; if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!canvas._scene) return; const p = pos(e), sc = canvas._scene;
      if (drag) { const dx = (p.x - drag.p.x) / (sc.r - sc.l) * (drag.xr[1] - drag.xr[0]), dy = (p.y - drag.p.y) / (sc.b - sc.t) * (drag.yr[1] - drag.yr[0]); if (Math.abs(p.x - drag.p.x) + Math.abs(p.y - drag.p.y) > 2) drag.moved = true; if (drag.moved) { if (tip) tip.hidden = true; setView({ x: panRange(drag.xr, -dx), y: panRange(drag.yr, dy) }); } return; }
      if (!tip || !inside(p)) { if (tip) tip.hidden = true; return; }
      let best = null, bd = 14 * 14; for (const h of sc.hits) { const d = (h.sx - p.x) ** 2 + (h.sy - p.y) ** 2; if (d < bd) { bd = d; best = h; } }
      if (!best) { tip.hidden = true; return; }
      tip.textContent = `${best.label ? best.label + ': ' : ''}${fmt(best.x, 6)}, ${fmt(best.y, 6)}${best.sigma ? ' ± ' + fmt(best.sigma, 3) : ''}`;
      const r = canvas.getBoundingClientRect(); tip.style.left = Math.min(r.width - 120, best.sx / sc.W * r.width + 8) + 'px'; tip.style.top = (best.sy / sc.H * r.height - 26) + 'px'; tip.hidden = false;
    });
    const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });
    canvas.addEventListener('dblclick', () => setView(null));
    return { zoom: f => { const sc = canvas._scene; if (sc) setView({ x: zoomRange(sc.xr, f), y: zoomRange(sc.yr, f) }); }, reset: () => setView(null) };
  }
  const api = { BASE, scene, plot, toSVG, drawItems, legendEntries, zoomRange, panRange, attach, wrapLines, dataRanges };
  host.ZGWbPlot = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
