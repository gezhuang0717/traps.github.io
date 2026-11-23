/* Explanatory RFQ scenes. All frames are derived from existing model reports.
 * No particles, gas collisions, extraction pulses or measured efficiencies
 * are invented. The parent owns playback, exports and input validation.
 */
(function (host) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', C = { blue: '#2863a6', teal: '#127c74', orange: '#b97028', purple: '#7852a2', ink: '#19334d', muted: '#587086', grid: '#dce7ef', gray: '#91a4b5' };
  const preferences = new WeakMap();
  let serial = 0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const number = (n, digits = 4) => !Number.isFinite(n) ? '—' : n === 0 ? '0' : String(Number(n.toPrecision(digits))).replace('e+', 'e').replaceAll('-', '−');
  const finite = n => Number.isFinite(Number(n));
  const node = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text != null) e.textContent = String(text);
    return e;
  };
  const html = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const widthOf = (text, size) => host.ZGRFQChart?.widthOf(text, size) ?? Array.from(String(text)).reduce((s, ch) => s + size * (/[^\u0000-\u02ff]/u.test(ch) ? 1.02 : .63), 0);
  function wrap(text, width, size) {
    if (host.ZGRFQChart) return host.ZGRFQChart.wrap(String(text), Math.max(20, width), size);
    const lines = []; let line = '';
    for (const ch of String(text)) { if (line && widthOf(line + ch, size) > width) { lines.push(line.trim()); line = ''; } line += ch; }
    if (line.trim()) lines.push(line.trim()); return lines.length ? lines : [''];
  }
  function textBlock(parent, text, x, y, width, size = 12, colour = C.ink, weight = 400, role = 'scene-note') {
    const lines = wrap(text, width, size), e = node('text', { x, y, 'font-size': size, fill: colour, 'font-weight': weight, 'data-chart-label': role });
    lines.forEach((line, i) => e.append(node('tspan', { x, dy: i ? size + 5 : 0 }, line)));
    parent.append(e); return y + lines.length * (size + 5);
  }
  function fixedText(parent, text, x, y, size = 11, anchor = 'start', colour = C.muted, role = 'scene-axis') {
    parent.append(node('text', { x, y, 'font-size': size, 'text-anchor': anchor, fill: colour, 'data-chart-label': role }, text));
  }
  function frame(width, title, description) {
    const svg = node('svg', { xmlns: NS, width, height: 1, viewBox: `0 0 ${width} 1`, role: 'img', 'aria-label': title,
      'data-rfq-chart': 'scene', style: 'display:block;width:100%;height:auto;background:#fff;font-family:Arial,"Noto Sans",sans-serif;color:#19334d' });
    svg.append(node('title', {}, title), node('desc', {}, description));
    const background = node('rect', { width, height: 1, fill: '#fff', rx: 14 }); svg.append(background);
    return { svg, finish(height) { height = Math.ceil(height); svg.setAttribute('height', height); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); background.setAttribute('height', height); return svg; } };
  }
  function header(svg, width, title, caption, kicker) {
    let y = textBlock(svg, kicker, 16, 22, width - 32, 10, C.teal, 700, 'scene-kicker') + 5;
    y = textBlock(svg, title, 16, y, width - 32, width < 360 ? 16 : 19, C.ink, 600, 'scene-title') + 5;
    return textBlock(svg, caption, 16, y, width - 32, 11, C.muted) + 10;
  }
  function stats(svg, width, y, items) {
    if (width < 360) {
      const surface = node('rect', { x: 16, y, width: width - 32, height: 1, rx: 9, fill: '#f1f6fa', stroke: '#e1ebf2' }); svg.append(surface);
      let next = y + 20;
      for (const [label, value, colour] of items) next = textBlock(svg, label + ': ' + value, 26, next, width - 52, 11, colour || C.ink, 500, 'scene-stat-value') + 6;
      surface.setAttribute('height', next - y); return next + 15;
    }
    const cols = width >= 660 ? 3 : width >= 360 ? 2 : 1, gap = 9, cell = (width - 32 - gap * (cols - 1)) / cols;
    let offset = 0;
    for (let start = 0; start < items.length; start += cols) {
      const batch = items.slice(start, start + cols), rowHeight = Math.max(...batch.map(([label, value]) => 26 + wrap(label, cell - 20, 10).length * 14 + wrap(value, cell - 20, 15).length * 20));
      batch.forEach(([label, value, colour], i) => {
        const x = 16 + i * (cell + gap), top = y + offset;
        svg.append(node('rect', { x, y: top, width: cell, height: rowHeight, rx: 9, fill: '#f1f6fa', stroke: '#e1ebf2' }));
        const labelEnd = textBlock(svg, label, x + 10, top + 18, cell - 20, 10, C.muted, 400, 'scene-stat-label');
        textBlock(svg, value, x + 10, labelEnd + 4, cell - 20, 15, colour || C.ink, 600, 'scene-stat-value');
      }); offset += rowHeight + gap;
    }
    return y + offset + 5;
  }
  function range(low, high) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) return [-1, 1];
    if (low === high) { const pad = Math.abs(low) * .1 || 1; return [low - pad, high + pad]; }
    return [low, high];
  }
  function panel(svg, x0, y0, width, title, xlabel, ylabel, xd, yd, options = {}) {
    [xd, yd] = [range(...xd), range(...yd)];
    const group = node('g'), surface = node('rect', { x: x0, y: y0, width, height: 1, rx: 11, fill: '#f8fbfd', stroke: '#dce7ef' }); group.append(surface); svg.append(group);
    let y = textBlock(group, title, x0 + 12, y0 + 23, width - 24, 14, C.ink, 600, 'scene-panel-title');
    y = textBlock(group, ylabel, x0 + 12, y + 4, width - 24, 10, C.muted, 400, 'scene-y-axis') + 5;
    const yvals = [yd[0], (yd[0] + yd[1]) / 2, yd[1]], tick = 10;
    const margin = Math.max(37, ...yvals.map(v => widthOf(number(v, 3), tick) + 13));
    const left = x0 + margin, right = x0 + width - 14, top = y + 6, bottom = top + (options.plotHeight || 145);
    const xx = v => left + (v - xd[0]) / (xd[1] - xd[0]) * (right - left), yy = v => bottom - (v - yd[0]) / (yd[1] - yd[0]) * (bottom - top);
    const clipId = 'rfq-scene-clip-' + (++serial), defs = node('defs'), clip = node('clipPath', { id: clipId }); clip.append(node('rect', { x: left, y: top, width: Math.max(1, right - left), height: bottom - top })); defs.append(clip); group.append(defs);
    for (const v of yvals) { group.append(node('line', { x1: left, y1: yy(v), x2: right, y2: yy(v), stroke: C.grid, 'stroke-width': 1 })); fixedText(group, number(v, 3), left - 6, yy(v) + 3, tick, 'end', C.muted, 'scene-y-tick'); }
    const xvals = width < 320 ? [xd[0], xd[1]] : [xd[0], (xd[0] + xd[1]) / 2, xd[1]];
    xvals.forEach((v, i) => { group.append(node('line', { x1: xx(v), y1: top, x2: xx(v), y2: bottom, stroke: C.grid, 'stroke-width': 1 })); fixedText(group, options.xTick ? options.xTick(v) : number(v, 3), xx(v), bottom + 18, tick, i === 0 ? 'start' : i === xvals.length - 1 ? 'end' : 'middle', C.muted, 'scene-x-tick'); });
    y = textBlock(group, xlabel, x0 + 12, bottom + 40, width - 24, 11, C.ink, 400, 'scene-x-axis');
    const height = y - y0 + 9; surface.setAttribute('height', height);
    const data = node('g', { 'clip-path': `url(#${clipId})` }), markers = node('g', { 'data-scene-marker-layer': 'true' }); group.append(data, markers);
    const line = (points, colour, dash, lineWidth = 2, opacity = 1) => {
      const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (valid.length) data.append(node('path', { d: valid.map((p, i) => `${i ? 'L' : 'M'}${xx(p.x)},${yy(p.y)}`).join(' '), fill: 'none', stroke: colour, 'stroke-width': lineWidth, 'stroke-dasharray': dash || '', opacity, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    };
    const marker = (point, colour, shape = 'circle', size = 3.2) => {
      const x = xx(point.x), y = yy(point.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      // A point on the axis boundary still has a complete visible symbol.
      // Curves stay clipped; finite markers inside the data domain may extend
      // by their radius into the existing plot margins (at most 5.3 px).
      if (x < left - 1e-7 || x > right + 1e-7 || y < top - 1e-7 || y > bottom + 1e-7) return;
      if (shape === 'cross') markers.append(node('path', { d: `M${x - size},${y - size}L${x + size},${y + size}M${x - size},${y + size}L${x + size},${y - size}`, stroke: colour, 'stroke-width': 1.6 }));
      else if (shape === 'square') markers.append(node('rect', { x: x - size, y: y - size, width: size * 2, height: size * 2, fill: colour }));
      else if (shape === 'diamond') markers.append(node('path', { d: `M${x},${y - size - 1}L${x + size + 1},${y}L${x},${y + size + 1}L${x - size - 1},${y}Z`, fill: colour }));
      else if (shape === 'triangle') markers.append(node('path', { d: `M${x},${y - size - 1}L${x + size + 1},${y + size}L${x - size - 1},${y + size}Z`, fill: colour }));
      else markers.append(node('circle', { cx: x, cy: y, r: size, fill: colour }));
    };
    return { height, line, marker, group, data, xx, yy, left, right, top, bottom };
  }
  function legend(svg, width, y, entries) {
    let x = 16, rowHeight = 0;
    for (const [label, colour, dashed] of entries) {
      const lines = wrap(label, width - 62, 10), itemWidth = Math.min(width - 32, 30 + Math.max(...lines.map(s => widthOf(s, 10))) + 12);
      if (x > 16 && x + itemWidth > width - 16) { y += rowHeight + 9; x = 16; rowHeight = 0; }
      svg.append(node('line', { x1: x, y1: y - 3, x2: x + 18, y2: y - 3, stroke: colour, 'stroke-width': 2.5, 'stroke-dasharray': dashed ? '4 3' : '' }));
      textBlock(svg, label, x + 24, y, width - x - 40, 10, C.muted, 400, 'scene-legend');
      rowHeight = Math.max(rowHeight, lines.length * 15); x += itemWidth;
    }
    return y + rowHeight + 12;
  }
  function twoPanels(svg, width, y, leftSpec, rightSpec) {
    const gap = 14, inner = width - 32;
    if (width >= 700) { const pw = (inner - gap) / 2, a = leftSpec(16, y, pw), b = rightSpec(16 + pw + gap, y, pw); return { a, b, next: y + Math.max(a.height, b.height) + 14 }; }
    const a = leftSpec(16, y, inner), b = rightSpec(16, y + a.height + gap, inner); return { a, b, next: y + a.height + b.height + gap + 14 };
  }
  function controlButton(parent, text, callback) { const b = html('button', 'rfq-scene-button', text); b.type = 'button'; b.addEventListener('click', callback); parent.append(b); return b; }
  const statusColours = { stable: C.teal, unstable: '#b3483c', boundary: C.orange, outside: '#718297', unresolved: C.purple };
  const statusShapes = { stable: 'circle', unstable: 'cross', boundary: 'square', outside: 'diamond', unresolved: 'triangle' };

  function mount(options) {
    const { root, kind, chart, report, rows = [], inputs = {}, onParameterChange } = options;
    if (!root || !chart || !['gas', 'bunch', 'scan'].includes(kind) || !report) return null;
    let labels = options.labels;
    if (!labels) { try { labels = JSON.parse(root.dataset.sceneLabels || '{}'); } catch (_) { labels = {}; } }
    const t = key => labels[key] || key;
    const prefs = preferences.get(root) || {}; preferences.set(root, prefs); prefs[kind] ||= {};
    const state = prefs[kind], section = html('section', 'rfq-lab-scene'), controls = html('div', 'rfq-scene-controls'), display = html('div', 'rfq-scene-display'), toolbar = html('div', 'rfq-scene-playback');
    section.dataset.rfqScene = kind; section.lang = labels.language || 'en'; section.setAttribute('data-no-fold', '');
    if (!['en', 'zh'].includes(root.dataset.lang)) section.append(html('span', 'rfq-scene-language', t('fallback')));
    const intro = html('p', 'rfq-scene-intro', t(kind + '_intro')); section.append(intro, controls, display, toolbar);
    const guide = html('details', 'rfq-scene-guide'), summary = html('summary', '', t('explain')), guideCards = html('div', 'rfq-scene-guide-grid'); guide.append(summary, guideCards);
    for (let i = 1; i <= 3; i++) { const article = html('article', ''); article.append(html('h4', '', t(kind + '_step' + i + '_title')), html('p', '', t(kind + '_step' + i + '_body'))); guideCards.append(article); }
    const assumptions = html('div', 'rfq-scene-assumptions');
    for (const key of kind === 'gas' ? ['gas_model_note', 'gas_pdf_assumption'] : kind === 'bunch' ? ['bunch_beamline_note', 'bunch_contour_note', 'bunch_projection_note', 'bunch_inventory_note'] : ['scan_law_' + report.axis, 'scan_model_note']) assumptions.append(html('p', '', t(key)));
    guide.append(assumptions); section.append(guide); chart.append(section);
    const width = Math.max(180, Math.min(1100, Math.floor(chart.clientWidth || root.clientWidth - 36 || 800) - 2));
    let alive = true, currentSVG = null, lastFraction = 1, currentRow = rows.at(-1);
    const change = values => { if (typeof onParameterChange === 'function') onParameterChange(values); };
    const presetBox = html('div', 'rfq-scene-presets'); controls.append(presetBox);
    const addPresets = note => { controls.append(html('p', 'rfq-scene-control-note', note)); };
    let showPDF = null, timeMode = null, usePoint = null;
    if (kind === 'gas') {
      const selectLabel = html('label', 'rfq-scene-select-label', t('gas_time_mode')); timeMode = html('select', '');
      for (const [value, key] of [['early', 'gas_logtime'], ['linear', 'gas_lineartime']]) { const option = html('option', '', t(key)); option.value = value; timeMode.append(option); }
      timeMode.value = state.timeMode || 'early'; timeMode.addEventListener('change', () => { state.timeMode = timeMode.value; renderFrame(lastFraction); }); selectLabel.append(timeMode); controls.prepend(selectLabel);
      const checkLabel = html('label', 'rfq-scene-check'); showPDF = html('input', ''); showPDF.type = 'checkbox'; showPDF.checked = !!state.pdf;
      showPDF.addEventListener('change', () => { state.pdf = showPDF.checked; renderFrame(lastFraction); }); checkLabel.append(showPDF, html('span', '', t('gas_pdf_toggle'))); controls.append(checkLabel);
      for (const [factor, key] of [[1, 'gas_one_tau'], [5, 'gas_five_tau']]) { const b = controlButton(presetBox, t(key), () => change({ 'rx-ms': report.tau_ms * factor })); b.disabled = !(report.tau_ms > 0 && report.tau_ms * factor <= 100000); }
      controlButton(presetBox, t('gas_no_gas'), () => change({ 'rx-p': 0 })); addPresets(t('gas_time_note'));
    } else if (kind === 'bunch') {
      const b = report.bunch, length = Number(inputs['rx-L']), st = b.initial_sigma_t_ns, se = b.sigma_E_eV;
      controlButton(presetBox, t('bunch_uncorrelated'), () => change({ 'rx-rho': 0 }));
      const focusLength = .95 * st * length / (Math.abs(b.dt_dE_ns_per_eV) * se);
      const focus = controlButton(presetBox, t('bunch_focus'), () => change({ 'rx-rho': .95, 'rx-L': focusLength })); focus.disabled = !(Number.isFinite(focusLength) && focusLength >= .001 && focusLength <= 10000 && st > 0 && se > 0);
      controlButton(presetBox, t('bunch_defocus'), () => change({ 'rx-rho': -.85 })); addPresets(t('bunch_preset_note'));
    } else {
      const base = { mass_u: Number(inputs['ms-mass']), r0_mm: Number(inputs['ms-r0']), f_MHz: Number(inputs['ms-f']) }, ranges = {
        voltage: [0, NaN], frequency: [Math.max(.000001, base.f_MHz * .4), base.f_MHz * 2],
        radius: [Math.max(.001, base.r0_mm * .5), base.r0_mm * 2], mass: [Math.max(.001, base.mass_u * .5), base.mass_u * 2]
      };
      try { const unit = host.ZGMathieu.parameters(base.mass_u, Number(inputs['ms-charge']), Number(inputs['ms-U']), 1, base.r0_mm, base.f_MHz); ranges.voltage[1] = 1.2 / unit.q; } catch (_) {}
      for (const axis of ['voltage', 'frequency', 'radius', 'mass']) {
        const r = ranges[axis], b = controlButton(presetBox, t('scan_' + axis + '_preset'), () => change({ 'rx-scan-axis': axis, 'rx-vmin': r[0], 'rx-vmax': r[1] })); b.disabled = !(r.every(finite) && r[1] > r[0] && r[1] <= 1e6);
      }
      usePoint = controlButton(controls, t('scan_use'), () => {
        if (!currentRow) return;
        const names = { voltage: 'ms-V', frequency: 'ms-f', radius: 'ms-r0', mass: 'ms-mass' };
        let value = currentRow.scan_value;
        if (report.axis === 'voltage') value = host.ZGRFQWorkbench.fromRodPeak(currentRow.voltage_rod_peak_V, inputs['ms-voltage-convention'] || 'rod-peak');
        change({ [names[report.axis]]: value });
      }); addPresets(t('scan_preset_note'));
    }
    function gasFrame(fraction) {
      const start = rows[0]?.energy_eV ?? Number(inputs['rx-E']), floor = report.energy_floor_eV, end = rows.at(-1)?.t_ms ?? Number(inputs['rx-ms']), tau = report.tau_ms;
      const early = timeMode.value === 'early' && tau > 0 && end > 0;
      const time = early ? tau * Math.expm1(fraction * Math.log1p(end / tau)) : end * fraction;
      const energyAt = x => tau > 0 ? floor + (start - floor) * Math.exp(-x / tau) : start;
      const current = energyAt(time), rem = start === floor ? 0 : tau > 0 ? Math.exp(-time / tau) : 1, transform = x => early ? Math.log1p(x / tau) : x, inverse = x => early ? tau * Math.expm1(x) : x;
      const f = frame(width, t('gas_title'), t('gas_model_note') + (showPDF.checked ? ' ' + t('gas_pdf_assumption') : '')); f.svg.dataset.sceneKind = 'gas'; f.svg.dataset.sceneTimeMs = String(time); f.svg.dataset.sceneEnergyEv = String(current);
      let y = header(f.svg, width, t('gas_title'), t('frame_note'), t('kicker'));
      y = stats(f.svg, width, y, [[t('gas_time'), number(time) + ' ms'], [t('gas_mean'), number(current) + ' eV', C.teal], [t('gas_deviation'), start === floor ? '—' : number(rem * 100) + ' %']]);
      const ymax = Math.max(start, floor, .000001) * 1.08, xend = transform(end) || 1;
      const p = panel(f.svg, 16, y, width - 32, t('gas_curve'), t('gas_time_axis') + (early ? ' · log(1 + t/τ)' : ''), t('gas_energy_axis'), [0, xend], [0, ymax], { xTick: x => number(inverse(x), 3) });
      const points = end === 0 ? [{ x: 0, y: start }] : Array.from({ length: 121 }, (_, i) => { const x = xend * i / 120; return { x, y: energyAt(inverse(x)) }; });
      p.line(points, C.gray, '', 2, .45); p.line(points.filter(v => v.x < transform(time)).concat([{ x: transform(time), y: current }]), C.teal, '', 2.7);
      p.line([{ x: 0, y: floor }, { x: xend, y: floor }], C.orange, '5 4', 1.5); p.line([{ x: transform(time), y: 0 }, { x: transform(time), y: ymax }], C.blue, '3 4', 1.3); p.marker({ x: transform(time), y: current }, C.teal, 'circle', 4.5);
      y += p.height + 18; y = legend(f.svg, width, y, [[t('gas_mean'), C.teal], [t('gas_floor'), C.orange, true]]);
      y = textBlock(f.svg, `τ = ${tau > 0 ? number(tau) : '∞'} ms; ν_eff = ${number(report.effective_rate_s)} s⁻¹`, 16, y, width - 32, 11, C.ink) + 7;
      if (!(tau > 0)) y = textBlock(f.svg, t('gas_zero_rate'), 16, y, width - 32, 11, C.orange) + 7;
      if (start === floor) y = textBlock(f.svg, t('gas_at_equilibrium'), 16, y, width - 32, 11, C.teal) + 7;
      if (showPDF.checked) {
        // A log-spaced energy axis keeps the hot and cold assumptions visible.
        // Each density is divided by its own analytic maximum: no absolute
        // population or probability integral is inferred from the picture.
        const reference = Math.max(floor, 1e-12), span = Math.log1p(8 * Math.max(start, floor, 1e-12) / reference);
        const profile = (E, mean) => { const kT = 2 * mean / 3, x = E / kT; return kT > 0 ? Math.sqrt(Math.max(0, 2 * x)) * Math.exp(.5 - x) : 0; };
        const sample = mean => Array.from({ length: 161 }, (_, i) => { const E = 8 * mean * (i / 160) ** 2; return { x: Math.log1p(E / reference), y: profile(E, mean) }; });
        const a = sample(current), b = sample(floor);
        const pdf = panel(f.svg, 16, y, width - 32, t('gas_pdf_title'), t('gas_pdf_energy') + ' · log(1 + E/E_th)', t('gas_pdf_axis'), [0, span], [0, 1.08], { xTick: x => number(reference * Math.expm1(x), 3) }); pdf.line(b, C.orange, '5 4'); if (current > 0) pdf.line(a, C.teal, '', 2.6);
        y += pdf.height + 17; y = legend(f.svg, width, y, [[t('current'), C.teal], [t('gas_floor'), C.orange, true]]);
        y = textBlock(f.svg, t('gas_pdf_frame_note'), 16, y, width - 32, 10, C.orange) + 7;
        if (current === 0) y = textBlock(f.svg, t('gas_pdf_zero'), 16, y, width - 32, 10, C.orange) + 7;
      }
      y = textBlock(f.svg, t('gas_frame_note'), 16, y, width - 32, 10, C.muted); return f.finish(y + 12);
    }
    function bunchFrame(fraction) {
      const b = report.bunch, st = b.initial_sigma_t_ns, se = b.sigma_E_eV, inputRho = Number(inputs['rx-rho']), rho = Number.isFinite(inputRho) ? clamp(inputRho, -1, 1) : st * se ? b.covariance_ns_eV / (st * se) : 0;
      const g = b.dt_dE_ns_per_eV * fraction, sigma = Math.hypot(st + g * rho * se, g * se * Math.sqrt(Math.max(0, 1 - rho * rho))), L = Number(inputs['rx-L']), fwhm = (host.ZGRFQExtras?.C.fwhm || 2.354820045) * sigma;
      const f = frame(width, t('bunch_title'), t('bunch_beamline_note')); f.svg.dataset.sceneKind = 'bunch'; f.svg.dataset.sceneDriftFraction = String(fraction); f.svg.dataset.sceneSigmaNs = String(sigma);
      let y = header(f.svg, width, t('bunch_title'), t('frame_note'), t('kicker'));
      y = stats(f.svg, width, y, [[t('bunch_distance'), number(L * fraction) + ' m'], [t('bunch_width'), number(fwhm) + ' ns', C.teal], [t('bunch_flight'), number(b.flight_ns * fraction / 1000) + ' µs']]);
      const beamLeft = 34, beamRight = width - 34, beamY = y + 29;
      f.svg.append(node('line', { x1: beamLeft, y1: beamY, x2: beamRight, y2: beamY, stroke: '#a5b6c5', 'stroke-width': 5, 'stroke-linecap': 'round' }), node('rect', { x: beamLeft - 8, y: beamY - 15, width: 16, height: 30, rx: 4, fill: C.blue }), node('line', { x1: beamRight, y1: beamY - 20, x2: beamRight, y2: beamY + 20, stroke: C.ink, 'stroke-width': 3 }), node('line', { x1: beamLeft + (beamRight - beamLeft) * fraction, y1: beamY - 18, x2: beamLeft + (beamRight - beamLeft) * fraction, y2: beamY + 18, stroke: C.teal, 'stroke-width': 3 }));
      y = textBlock(f.svg, t('bunch_source') + ' → ' + t('bunch_drift') + ' → ' + t('bunch_plane'), 16, beamY + 43, width - 32, 11, C.ink) + 4;
      y = textBlock(f.svg, t('bunch_beamline_short'), 16, y, width - 32, 10, C.muted) + 12;
      const boundT = Math.max(2.3 * (st + Math.abs(b.dt_dE_ns_per_eV) * se), .1), boundE = Math.max(se * 2.3, .1);
      const ellipse = shear => Array.from({ length: 97 }, (_, i) => { const angle = i * 2 * Math.PI / 96, dE = 2 * se * (rho * Math.cos(angle) + Math.sqrt(Math.max(0, 1 - rho * rho)) * Math.sin(angle)); return { x: 2 * st * Math.cos(angle) + shear * dE, y: dE }; });
      const pairs = twoPanels(f.svg, width, y,
        (x, y, w) => panel(f.svg, x, y, w, t('bunch_phase_title'), t('bunch_time_axis'), t('bunch_energy_axis'), [-boundT, boundT], [-boundE, boundE]),
        (x, y, w) => panel(f.svg, x, y, w, t('bunch_projection_title'), t('bunch_time_axis'), t('bunch_profile_axis'), [-boundT, boundT], [0, 1.08]));
      pairs.a.line(ellipse(0), C.gray, '5 4', 1.8); pairs.a.line(ellipse(g), C.teal, '', 2.5);
      const gaussian = sd => Array.from({ length: 121 }, (_, i) => { const dt = (i / 120 * 8 - 4) * sd; return { x: dt, y: Math.exp(-.5 * (dt / sd) ** 2) }; });
      if (st > 0) pairs.b.line(gaussian(st), C.gray, '5 4', 1.8); else pairs.b.line([{ x: 0, y: 0 }, { x: 0, y: 1 }], C.gray, '5 4');
      if (sigma > 0) pairs.b.line(gaussian(sigma), C.teal, '', 2.5); else pairs.b.line([{ x: 0, y: 0 }, { x: 0, y: 1 }], C.teal, '', 2.5);
      y = legend(f.svg, width, pairs.next + 3, [[t('initial'), C.gray, true], [t('current'), C.teal]]);
      y = textBlock(f.svg, `g = ${number(g)} ns/eV; Δt_out = Δt_in + gΔE`, 16, y, width - 32, 11, C.ink) + 5;
      const second = b.second_order_sigma_t_ns * fraction;
      if (second > 0 && sigma <= 3 * second) y = textBlock(f.svg, t('bunch_near_focus'), 16, y, width - 32, 11, C.orange, 600, 'scene-warning') + 6;
      if (b.relative_energy_spread > .1) y = textBlock(f.svg, t('bunch_large_spread'), 16, y, width - 32, 11, C.orange, 600, 'scene-warning') + 6;
      if (st === 0 || sigma === 0) y = textBlock(f.svg, t('bunch_degenerate'), 16, y, width - 32, 10, C.orange) + 6;
      y = textBlock(f.svg, t('bunch_contour_short'), 16, y, width - 32, 10, C.muted) + 5;
      y = textBlock(f.svg, t('bunch_projection_short'), 16, y, width - 32, 10, C.muted) + 11;
      y = textBlock(f.svg, t('bunch_inventory'), 16, y, width - 32, 12, C.ink, 600) + 4;
      y = textBlock(f.svg, `${t('bunch_stored')}: ${number(report.inventory.captured_ions)} → ${t('bunch_extracted')}: ${number(report.inventory.delivered_ions)}`, 16, y, width - 32, 11, C.ink) + 4;
      y = textBlock(f.svg, t('bunch_frame_note'), 16, y, width - 32, 10, C.muted); return f.finish(y + 12);
    }
    function scanFrame(fraction) {
      const index = Math.min(rows.length - 1, Math.floor(fraction * (rows.length - 1))), row = rows[index]; currentRow = row;
      const axis = report.axis, depth = inputs['rx-scan-metric'] === 'depth', key = depth ? 'rf_only_depth_eV' : 'q', unit = { voltage: 'V', frequency: 'MHz', radius: 'mm', mass: 'u' }[axis];
      const f = frame(width, t('scan_title'), t('scan_model_note')); f.svg.dataset.sceneKind = 'scan'; f.svg.dataset.sceneIndex = String(index); f.svg.dataset.sceneParameter = String(row.scan_value); f.svg.dataset.sceneQ = String(row.q);
      let y = header(f.svg, width, t('scan_title'), t('frame_note'), t('kicker'));
      y = stats(f.svg, width, y, [[t('scan_parameter'), number(row.scan_value) + ' ' + unit], [t('scan_q'), number(row.q), C.blue], [t('scan_depth'), number(row.rf_only_depth_eV) + ' eV', C.teal]]);
      const low = Math.min(...rows.map(r => r[key])), high = Math.max(...rows.map(r => r[key])), pad = (high - low || Math.abs(high) || 1) * .08;
      const p = panel(f.svg, 16, y, width - 32, t('scan_curve'), t('scan_' + axis), t(depth ? 'scan_depth_axis' : 'scan_q_axis'), [rows[0].scan_value, rows.at(-1).scan_value], [Math.min(0, low - pad), high + pad]);
      for (const r of rows) p.marker({ x: r.scan_value, y: r[key] }, '#d6e1e9', 'circle', 2.4);
      for (const r of rows.slice(0, index + 1)) p.marker({ x: r.scan_value, y: r[key] }, statusColours[r.classification] || C.gray, statusShapes[r.classification] || 'triangle', 3);
      p.line([{ x: row.scan_value, y: low - pad }, { x: row.scan_value, y: high + pad }], C.blue, '3 4', 1.2); p.marker({ x: row.scan_value, y: row[key] }, C.ink, 'circle', 5.3); p.marker({ x: row.scan_value, y: row[key] }, '#fff', 'circle', 2.4);
      y += p.height + 20;
      y = textBlock(f.svg, `${t('scan_progress')}: ${index + 1} / ${rows.length}`, 16, y, width - 32, 11, C.muted) + 5;
      y = textBlock(f.svg, `${t('scan_classification')}: ${t('scan_' + row.classification)}`, 16, y, width - 32, 13, statusColours[row.classification] || C.ink, 600, 'scene-classification') + 6;
      y = textBlock(f.svg, `a = ${number(row.a)}; q = ${number(row.q)}; U = ${number(Number(inputs['ms-U']))} V`, 16, y, width - 32, 11, C.ink) + 6;
      const law = { voltage: 'q ∝ V; D_RF ∝ V²; a = const.', frequency: 'a, q, D_RF ∝ f_RF⁻²', radius: 'a, q, D_RF ∝ r₀⁻²', mass: 'a, q, D_RF ∝ m⁻¹' }[axis];
      y = textBlock(f.svg, law, 16, y, width - 32, 11, C.ink) + 8;
      y = textBlock(f.svg, t('scan_frame_note'), 16, y, width - 32, 10, C.muted); return f.finish(y + 12);
    }
    function renderFrame(fraction) {
      if (!alive) return currentSVG;
      lastFraction = clamp(Number.isFinite(Number(fraction)) ? Number(fraction) : 0, 0, 1);
      currentSVG = kind === 'gas' ? gasFrame(lastFraction) : kind === 'bunch' ? bunchFrame(lastFraction) : scanFrame(lastFraction);
      currentSVG.setAttribute('data-scene-fraction', lastFraction); display.replaceChildren(currentSVG); return currentSVG;
    }
    renderFrame(1);
    return { container: toolbar, renderFrame, getSVG: () => currentSVG, destroy() { alive = false; section.remove(); currentSVG = null; } };
  }
  host.ZGRFQScenes = Object.freeze({ mount });
})(typeof window !== 'undefined' ? window : globalThis);
