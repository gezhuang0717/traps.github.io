/* Responsive, self-contained SVG figures for the RFQ workbench.
 * SVG text is laid out at the available width instead of shrinking a desktop
 * figure on phones. All colours and fonts are embedded for SVG/PNG/PDF export.
 */
(function (host) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const colours = ['#245fa8', '#d27732', '#147d72', '#734b91', '#a84255'];
  let serial = 0;
  const widthOf = (text, size = 13) => Array.from(String(text)).reduce((sum, ch) =>
    sum + size * (/[^\u0000-\u02ff]/u.test(ch) ? 1.02 : /[ilI.,:;'| ]/.test(ch) ? .34 : .63), 0);

  function wrap(text, maxWidth, size = 13) {
    const tokens = String(text).split(/(\s+|(?=[\u3000-\u9fff]))/u).filter(Boolean);
    const lines = []; let line = '';
    for (const token of tokens) {
      const next = line + token;
      if (line && widthOf(next, size) > maxWidth) { lines.push(line.trim()); line = ''; }
      if (widthOf(token, size) > maxWidth) {
        for (const ch of token) {
          if (line && widthOf(line + ch, size) > maxWidth) { lines.push(line.trim()); line = ''; }
          line += ch;
        }
      } else line += token;
    }
    if (line.trim()) lines.push(line.trim());
    return lines.length ? lines : [''];
  }

  function formatTick(value) {
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    const a = Math.abs(value);
    const result = (a >= 100000 || a < .001)
      ? value.toExponential(2).replace(/\.?(0+)(?=e)/, '').replace('e+', 'e')
      : String(Number(value.toPrecision(4)));
    return result.replaceAll('-', '−');
  }

  function ticks(min, max, target) {
    const raw = (max - min) / Math.max(1, target - 1);
    const scale = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find(n => n * scale >= raw) * scale;
    const start = Math.ceil((min - step * 1e-10) / step) * step;
    const out = [];
    for (let k = 0; k < 100; k++) {
      const value = start + k * step;
      if (value > max + step * 1e-10) break;
      out.push(Math.abs(value) < step * 1e-9 ? 0 : value);
    }
    return out.length >= 2 ? out : [min, max];
  }

  function plot(series, title, xlabel, ylabel, options = {}) {
    if (typeof options === 'boolean') options = { scatter: options };
    const doc = host.document;
    if (!doc) throw Error('RFQ chart requires a document');
    const element = (name, attrs = {}, text) => {
      const node = doc.createElementNS(NS, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
      if (text != null) node.textContent = String(text);
      return node;
    };
    const groups = series.map((s, i) => ({ ...s, colour: s.color || s.colour || colours[i % colours.length],
      rows: (s.rows || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)) }));
    const samples = groups.flatMap(s => s.rows);
    if (!samples.length) return null;
    const observed = samples.reduce((d, p) => [Math.min(d[0], p.x), Math.max(d[1], p.x), Math.min(d[2], p.y), Math.max(d[3], p.y)], [Infinity, -Infinity, Infinity, -Infinity]);
    // References are part of the displayed scientific comparison. A thermal
    // floor or initial width must not acquire a legend while falling off-chart.
    for (const reference of options.references || []) {
      if (Number.isFinite(reference.x)) { observed[0] = Math.min(observed[0], reference.x); observed[1] = Math.max(observed[1], reference.x); }
      if (Number.isFinite(reference.y)) { observed[2] = Math.min(observed[2], reference.y); observed[3] = Math.max(observed[3], reference.y); }
    }
    for (const marker of options.markers || []) if (Number.isFinite(marker.x) && Number.isFinite(marker.y)) {
      observed[0] = Math.min(observed[0], marker.x); observed[1] = Math.max(observed[1], marker.x);
      observed[2] = Math.min(observed[2], marker.y); observed[3] = Math.max(observed[3], marker.y);
    }
    const extend = (lo, hi, fraction) => {
      if (lo === hi) { const step = Math.abs(lo) * .1 || 1; lo -= step; hi += step; }
      const pad = (hi - lo) * fraction; return [lo - pad, hi + pad];
    };
    let [xmin, xmax] = options.xDomain || extend(observed[0], observed[1], .035);
    let [ymin, ymax] = options.yDomain || extend(observed[2], observed[3], .08);
    if (![xmin, xmax, ymin, ymax].every(Number.isFinite) || xmin >= xmax || ymin >= ymax) throw Error('RFQ chart range');
    const w = Math.max(200, Math.min(1440, Number(options.width) || 800));
    const narrow = w < 520;
    const font = narrow ? 12 : 13, titleSize = narrow ? 16 : 19;
    const titleLines = wrap(title, w - 40, titleSize);
    const yLabelLines = wrap(ylabel, w - 40, 13);
    const top = 22 + titleLines.length * (titleSize + 5) + (narrow ? yLabelLines.length * 17 + 10 : 15);
    let yTicks = ticks(ymin, ymax, narrow ? 5 : 6);
    let left = Math.max(narrow ? 48 : 70, Math.max(...yTicks.map(n => widthOf(formatTick(n), font))) + (narrow ? 16 : 38));
    const right = 24;
    let plotWidth = w - left - right;
    const plotHeight = narrow ? 235 : 285;
    // With x and y in the same units, preserve circles and aperture geometry.
    // Extend the smaller domain; never remove any supplied data from the view.
    if (options.equalAspect) {
      for (let iteration = 0; iteration < 3; iteration++) {
        const sx = (xmax - xmin) / plotWidth, sy = (ymax - ymin) / plotHeight;
        if (sx < sy) { const mid = (xmin + xmax) / 2, half = sy * plotWidth / 2; xmin = mid - half; xmax = mid + half; }
        else { const mid = (ymin + ymax) / 2, half = sx * plotHeight / 2; ymin = mid - half; ymax = mid + half; }
        yTicks = ticks(ymin, ymax, narrow ? 5 : 6);
        left = Math.max(narrow ? 48 : 70, Math.max(...yTicks.map(n => widthOf(formatTick(n), font))) + (narrow ? 16 : 38));
        plotWidth = w - left - right;
      }
      const sx = (xmax - xmin) / plotWidth, sy = (ymax - ymin) / plotHeight;
      if (sx < sy) { const mid = (xmin + xmax) / 2, half = sy * plotWidth / 2; xmin = mid - half; xmax = mid + half; }
      else { const mid = (ymin + ymax) / 2, half = sx * plotHeight / 2; ymin = mid - half; ymax = mid + half; }
      yTicks = ticks(ymin, ymax, narrow ? 5 : 6);
    }
    const xTicks = ticks(xmin, xmax, plotWidth < 310 ? 3 : plotWidth < 600 ? 5 : 7);
    const bottom = top + plotHeight;
    const xLabelLines = wrap(xlabel, w - 40, 14);
    const xLabelY = bottom + 46;
    const legendY = xLabelY + xLabelLines.length * 18 + 13;
    const entries = groups.filter(s => s.name).map(s => ({ name: s.name, colour: s.colour, dash: s.dash, marker: s.marker, scatter: options.scatter || s.scatter }));
    for (const ref of options.references || []) if (ref.label) entries.push({ name: ref.label, colour: ref.color || '#6b7789', dash: '5 4' });
    for (const marker of options.markers || []) if (marker.label) entries.push({ name: marker.label, colour: marker.color || '#182d45', scatter: true });
    const legend = []; let lx = 20, ly = legendY, maxLineHeight = 0;
    for (const entry of entries) {
      const lines = wrap(entry.name, w - 76, font);
      const itemWidth = Math.min(w - 40, Math.max(...lines.map(line => widthOf(line, font))) + 42);
      if (lx > 20 && lx + itemWidth > w - 20) { lx = 20; ly += maxLineHeight + 10; maxLineHeight = 0; }
      legend.push({ ...entry, lines, x: lx, y: ly });
      maxLineHeight = Math.max(maxLineHeight, lines.length * 17);
      lx += itemWidth + 16;
    }
    const captionLines = options.caption ? wrap(options.caption, w - 40, 11) : [];
    const captionY = (legend.length ? ly + maxLineHeight + 14 : legendY) + 4;
    const h = Math.ceil(captionY + captionLines.length * 16 + 12);
    const id = 'rfq-plot-' + (++serial);
    const svg = element('svg', { xmlns: NS, viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img',
      'aria-labelledby': `${id}-title ${id}-desc`, class: 'rfq-responsive-figure', 'data-rfq-chart': 'responsive',
      style: 'display:block;max-width:100%;height:auto;font-family:Arial,"Noto Sans",sans-serif;background:#fff;color:#172b44' });
    svg.append(element('title', { id: id + '-title' }, title), element('desc', { id: id + '-desc' },
      options.description || `${title}. ${xlabel}: ${formatTick(observed[0])} to ${formatTick(observed[1])}. ${ylabel}: ${formatTick(observed[2])} to ${formatTick(observed[3])}. ${samples.length} displayed samples.`));
    svg.append(element('rect', { width: w, height: h, fill: '#ffffff' }));
    const textLines = (lines, x, y, size, attrs = {}) => {
      const node = element('text', { x, y, 'font-size': size, fill: '#243b56', ...attrs });
      lines.forEach((line, i) => node.append(element('tspan', { x, dy: i ? size + 4 : 0 }, line)));
      return node;
    };
    svg.append(textLines(titleLines, 20, 24, titleSize, { 'font-weight': 600, fill: '#172b44', 'data-chart-label': 'title' }));
    if (narrow) svg.append(textLines(yLabelLines, 20, top - yLabelLines.length * 17, 13, { 'font-weight': 600, 'data-chart-label': 'y-axis' }));
    else svg.append(element('text', { transform: `translate(20 ${top + plotHeight / 2}) rotate(-90)`, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: '#243b56', 'data-chart-label': 'y-axis' }, ylabel));
    svg.append(element('rect', { x: left, y: top, width: plotWidth, height: plotHeight, fill: '#f8fafc', stroke: '#d9e2ec' }));
    const xp = x => left + (x - xmin) / (xmax - xmin) * plotWidth;
    const yp = y => top + (ymax - y) / (ymax - ymin) * plotHeight;
    for (const value of xTicks) {
      const x = xp(value);
      svg.append(element('line', { x1: x, x2: x, y1: top, y2: bottom, stroke: '#e3eaf1', 'stroke-width': 1 }));
      svg.append(element('text', { x, y: bottom + 22, 'text-anchor': 'middle', 'font-size': font, fill: '#50647b', 'data-chart-label': 'x-tick' }, formatTick(value)));
    }
    for (const value of yTicks) {
      const y = yp(value);
      svg.append(element('line', { x1: left, x2: w - right, y1: y, y2: y, stroke: '#e3eaf1', 'stroke-width': 1 }));
      svg.append(element('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', 'font-size': font, fill: '#50647b', 'data-chart-label': 'y-tick' }, formatTick(value)));
    }
    svg.append(textLines(xLabelLines, w / 2, xLabelY, 14, { 'text-anchor': 'middle', 'font-weight': 600, 'data-chart-label': 'x-axis' }));
    const defs = element('defs'), clip = element('clipPath', { id: id + '-clip' });
    clip.append(element('rect', { x: left, y: top, width: plotWidth, height: plotHeight })); defs.append(clip); svg.append(defs);
    const traces = element('g', { 'clip-path': `url(#${id}-clip)` });
    const mark = (x, y, size, colour, shape = 'circle', opacity = 1) => {
      const attrs = { fill: colour, opacity };
      if (shape === 'square') return element('rect', { x: x - size, y: y - size, width: 2 * size, height: 2 * size, ...attrs });
      if (shape === 'diamond') return element('polygon', { points: `${x},${y-size*1.3} ${x+size*1.3},${y} ${x},${y+size*1.3} ${x-size*1.3},${y}`, ...attrs });
      if (shape === 'triangle') return element('polygon', { points: `${x},${y-size*1.3} ${x+size*1.2},${y+size} ${x-size*1.2},${y+size}`, ...attrs });
      if (shape === 'cross') return element('path', { d: `M${x-size},${y-size}L${x+size},${y+size}M${x-size},${y+size}L${x+size},${y-size}`, fill: 'none', stroke: colour, 'stroke-width': 1.7, opacity });
      return element('circle', { cx: x, cy: y, r: size, ...attrs });
    };
    for (const reference of options.references || []) {
      const a = { stroke: reference.color || '#6b7789', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' };
      if (Number.isFinite(reference.x)) traces.append(element('line', { x1: xp(reference.x), x2: xp(reference.x), y1: top, y2: bottom, ...a }));
      else if (Number.isFinite(reference.y)) traces.append(element('line', { x1: left, x2: w - right, y1: yp(reference.y), y2: yp(reference.y), ...a }));
    }
    for (const s of groups) {
      if (!options.scatter && !s.scatter) traces.append(element('polyline', {
        points: s.rows.map(p => `${xp(p.x).toFixed(3)},${yp(p.y).toFixed(3)}`).join(' '), fill: 'none', stroke: s.colour,
        'stroke-width': narrow ? 2 : 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(s.dash ? { 'stroke-dasharray': s.dash } : {}) }));
      else for (const p of s.rows) {
        const circle = mark(xp(p.x), yp(p.y), s.rows.length > 500 ? 2.2 : 3.3, p.color || s.colour, p.marker || s.marker, .8);
        circle.append(element('title', {}, `${s.name || ''}: ${formatTick(p.x)}, ${formatTick(p.y)}`)); traces.append(circle);
      }
    }
    for (const marker of options.markers || []) if (Number.isFinite(marker.x) && Number.isFinite(marker.y)) {
      const point = element('circle', { cx: xp(marker.x), cy: yp(marker.y), r: 5, fill: marker.color || '#182d45', stroke: '#fff', 'stroke-width': 2 });
      point.append(element('title', {}, `${marker.label || ''}: ${formatTick(marker.x)}, ${formatTick(marker.y)}`)); traces.append(point);
    }
    svg.append(traces);
    for (const entry of legend) {
      if (entry.scatter) svg.append(mark(entry.x + 10, entry.y - 4, 4, entry.colour, entry.marker));
      else svg.append(element('line', { x1: entry.x, x2: entry.x + 22, y1: entry.y - 4, y2: entry.y - 4, stroke: entry.colour, 'stroke-width': 2.5, ...(entry.dash ? { 'stroke-dasharray': entry.dash } : {}) }));
      svg.append(textLines(entry.lines, entry.x + 30, entry.y, font, { 'data-chart-label': 'legend' }));
    }
    if (captionLines.length) svg.append(textLines(captionLines, 20, captionY, 11, { fill: '#607185', 'data-chart-label': 'caption' }));
    return svg;
  }

  const api = Object.freeze({ plot, wrap, formatTick, ticks, widthOf });
  host.ZGRFQChart = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
