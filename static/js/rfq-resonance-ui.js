/* Isolated resonance panel. Shared RF inputs are read after rfq:statechange;
 * local rr-* controls do not refresh unrelated demos. Figures are vector SVG. */
(function () {
  'use strict';
  const R = window.ZGRFQResonance, M = window.ZGMathieu, H = window.ZGRFQWorkbench, Chart = window.ZGRFQChart;
  const root = document.querySelector('#rfq-workbench'), pane = root?.querySelector('[data-rfq-resonance]');
  if (!R || !M || !H || !Chart || !pane || pane.dataset.ready) return;
  pane.dataset.ready = 'true';
  const T = JSON.parse(pane.dataset.labels || '{}'), t = key => T[key] || key;
  const node = name => pane.querySelector('[name="rr-' + name + '"]');
  const shared = name => root.querySelector('[name="ms-' + name + '"]');
  const element = (name, cls, text) => { const e = document.createElement(name); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const number = e => { if (!e || !String(e.value).trim() || !Number.isFinite(Number(e.value))) throw Error(e?.name || 'input'); return Number(e.value); };
  const nice = x => Number.isFinite(x) ? Number(x.toPrecision(7)).toString() : '—';
  const box = name => pane.querySelector('[data-rr-' + name + ']');
  const holder = kind => pane.querySelector('[data-rr-figure="' + kind + '"]');
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  let generation = 0, timer = null, dirty = true, busy = false, latest = null, resized = null, requestedInputs = null;
  const spectra = new Map();
  function snapshot() {
    return Object.fromEntries([...root.querySelectorAll('[name^="ms-"],[name^="rr-"]')]
      .filter(e => e.type !== 'file').map(e => [e.name, e.type === 'checkbox' ? e.checked : e.value]));
  }
  function calculationKey(inputs = snapshot()) {
    // Changing the export target does not change the calculation. In
    // particular, input followed by an unchanged blur/change must not discard
    // a finished result just as the user clicks its export button.
    return JSON.stringify(Object.fromEntries(Object.entries(inputs).filter(([key]) => key !== 'rr-export-target')));
  }
  function state() {
    const f = number(shared('f')) * 1e6, mass = number(shared('mass')), charge = number(shared('charge')), r0 = number(shared('r0'));
    if (f <= 0 || mass <= 0 || r0 <= 0 || charge < 1 || charge > 100 || !Number.isInteger(charge)) throw Error('ion / RF');
    const direct = shared('mode').value === 'direct' || shared('geometry').value === 'paul3d';
    const p = direct ? { a: number(shared('a')), q: number(shared('q')) } : M.parameters(mass, charge, number(shared('U')),
      H.toRodPeak(number(shared('V')), shared('voltage-convention').value), r0, f / 1e6);
    return { a: p.a, q: p.q, f_Hz: f, mass_u: mass, charge, r0_mm: r0, direct,
      referenceOnly: shared('geometry').value !== 'linear' || number(shared('rod-count')) !== 4,
      dipole: node('dipole').checked, parametric: node('parametric').checked, nonlinear: node('nonlinear').checked,
      dipole_Hz: number(node('drive')) * 1000, parametric_Hz: number(node('modulation')) * 1000,
      perturbation: node('perturbation').value, custom: { p: number(node('p')), r: number(node('r')), k: number(node('k')) },
      field_V_m: number(node('field')), cycles: number(node('pulse')), steps: number(node('steps')) };
  }
  function controls() {
    box('custom').hidden = node('perturbation').value !== 'custom';
    box('candidate-note').hidden = !node('nonlinear').checked;
  }
  function metrics(point, s) {
    const dl = element('dl', 'rfq-metrics');
    const entries = [[t('selected'), `a = ${nice(s.a)} · q = ${nice(s.q)}`], ['f_RF', nice(s.f_Hz / 1000) + ' kHz'],
      ['βₓ / βᵧ', nice(point.x.beta) + ' / ' + nice(point.y.beta)],
      [t('frequency_x'), point.stable ? nice(point.f_x_Hz / 1000) + ' kHz' : '—'],
      [t('frequency_y'), point.stable ? nice(point.f_y_Hz / 1000) + ' kHz' : '—'],
      [t('twice_x'), point.stable ? nice(point.primary_parametric_x_Hz / 1000) + ' kHz' : '—'],
      [t('twice_y'), point.stable ? nice(point.primary_parametric_y_Hz / 1000) + ' kHz' : '—'],
      [t('beta_error'), nice(Math.max(point.x.beta_step_difference ?? NaN, point.y.beta_step_difference ?? NaN))],
      [t('drive_ratio'), nice(s.dipole_Hz / s.f_Hz)]];
    for (const [label, value] of entries) { const item = element('div', 'rfq-metric'); item.append(element('dt', '', label), element('dd', '', value)); dl.append(item); }
    box('readout').replaceChildren(dl);
    box('reference').hidden = !s.referenceOnly;
    box('point-warning').hidden = point.stable;
    box('point-warning').textContent = t('outside');
    for (const action of ['match-dipole', 'match-parametric']) pane.querySelector('[data-rr-action="' + action + '"]').disabled = !point.stable;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function svgElement(name, attributes = {}, text) {
    const e = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) e.setAttribute(key, String(value));
    if (text != null) e.textContent = text; return e;
  }
  function textLines(lines, x, y, size, attributes = {}) {
    const e = svgElement('text', { x, y, 'font-size': size, fill: '#263c56', ...attributes });
    lines.forEach((line, i) => e.append(svgElement('tspan', { x, dy: i ? size + 4 : 0 }, line))); return e;
  }
  function candidateLabel(c) {
    const parts = [];
    if (c.p) parts.push((c.p === 1 ? '' : c.p === -1 ? '−' : c.p) + 'βₓ');
    if (c.r) { const coefficient = Math.abs(c.r) === 1 ? '' : Math.abs(c.r); parts.push((parts.length ? c.r < 0 ? '− ' : '+ ' : c.r < 0 ? '−' : '') + coefficient + 'βᵧ'); }
    return parts.join(' ') + ' = ' + 2 * c.k;
  }
  function lineStyle(line) {
    return { color: line.family === 'dipole' ? '#1962a3' : line.family === 'parametric' ? '#c36520' : '#8153a5',
      dash: line.family === 'candidate' ? '3 3' : line.axis === 'y' ? '8 4' : '',
      label: line.family === 'candidate' ? candidateLabel(line) : t(line.family) + ' ' + line.axis + ' · ' + nice(line.drive_Hz / 1000) + ' kHz' };
  }
  function contourPath(segments, xp, yp) {
    // Continue through shared triangle-edge intersections so SVG dashes run
    // along a contour. Starting a new M for every tiny segment resets the dash
    // phase and makes a nominally dashed curve look solid.
    const nodes = new Map(), edges = [], paths = [];
    const nodeAt = point => {
      const x = xp(point.q), y = yp(point.a), key = Math.round(x * 1e6) + ',' + Math.round(y * 1e6);
      if (!nodes.has(key)) nodes.set(key, { x, y, edges: [] });
      return nodes.get(key);
    };
    const coordinate = node => node.x.toFixed(2) + ',' + node.y.toFixed(2);
    for (const [p, q] of segments) {
      const a = nodeAt(p), b = nodeAt(q); if (a === b) continue;
      const edge = { a, b, used: false }; edges.push(edge); a.edges.push(edge); b.edges.push(edge);
    }
    const walk = (start, first) => {
      let current = start, edge = first, path = 'M' + coordinate(start);
      while (edge && !edge.used) {
        edge.used = true; current = edge.a === current ? edge.b : edge.a;
        path += 'L' + coordinate(current);
        if (current === start) { path += 'Z'; break; }
        if (current.edges.length !== 2) break;
        edge = current.edges.find(candidate => !candidate.used);
      }
      paths.push(path);
    };
    for (const node of nodes.values()) if (node.edges.length !== 2)
      for (const edge of node.edges) if (!edge.used) walk(node, edge);
    for (const edge of edges) if (!edge.used) walk(edge.a, edge);
    return paths.join('');
  }
  function mapFigure(grid, lines, point, s) {
    const W = Math.max(240, Math.min(1200, holder('map').clientWidth || root.clientWidth - 28 || 840));
    const small = W < 500, font = small ? 12 : 13, titleSize = small ? 17 : 20;
    const title = Chart.wrap(t('map_title'), W - 36, titleSize), caption = Chart.wrap(t('model_caption'), W - 36, 11);
    const left = small ? 48 : 64, right = 22, top = 38 + title.length * (titleSize + 4), ph = small ? 270 : 350, pw = W - left - right, bottom = top + ph;
    const xp = q => left + (q - grid.q_min) / (grid.q_max - grid.q_min) * pw;
    const yp = a => top + (grid.a_max - a) / (grid.a_max - grid.a_min) * ph;
    const legend = [{ color: '#bcd9e5', dash: '', label: t('stable'), fill: true },
      ...lines.map(lineStyle), { color: '#182b43', label: t('selected_key'), point: true }];
    let lx = 18, ly = bottom + 67, rowHeight = 0;
    for (const entry of legend) {
      entry.lines = Chart.wrap(entry.label, W - 80, font);
      const width = Math.min(W - 36, Math.max(...entry.lines.map(l => Chart.widthOf(l, font))) + 43);
      if (lx > 18 && lx + width > W - 18) { lx = 18; ly += rowHeight + 11; rowHeight = 0; }
      entry.x = lx; entry.y = ly; lx += width + 14; rowHeight = Math.max(rowHeight, entry.lines.length * (font + 4));
    }
    const captionY = ly + rowHeight + 22, H = captionY + caption.length * 15 + 12;
    const svg = svgElement('svg', { xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
      'aria-label': t('map_title'), 'data-rfq-chart': 'responsive', 'data-rfq-resonance-map': 'first-zone',
      style: 'display:block;width:100%;height:auto;background:#fff;font-family:Arial,"Noto Sans",sans-serif' });
    svg.append(svgElement('title', {}, t('map_title')), svgElement('desc', {}, t('map_note') + ' ' + t('model_caption')),
      svgElement('rect', { width: W, height: H, fill: '#fff' }), textLines(title, 18, 27, titleSize, { 'font-weight': 600, 'data-chart-label': 'title' }));
    svg.append(svgElement('rect', { x: left, y: top, width: pw, height: ph, fill: '#f6f8fb', stroke: '#cbd6e3' }));
    const valid = grid.envelope.filter(e => e.top !== null);
    if (valid.length) {
      // The common-zone vertical bound is min(b1(q), -a0(q)); no unstable
      // pixels are colored as stable. The q=0 origin is a boundary point.
      const shape = [{ q: 0, top: 0 }, ...valid, { q: valid.at(-1).q, top: 0 }];
      const d = shape.map((e, i) => (i ? 'L' : 'M') + xp(e.q) + ',' + yp(e.top)).join(' ') +
        ' ' + [...shape].reverse().map(e => 'L' + xp(e.q) + ',' + yp(-e.top)).join(' ') + ' Z';
      svg.append(svgElement('path', { d, fill: '#dbeaf0', stroke: '#7eabbc', 'stroke-width': 1.3, 'data-rr-stable-region': 'both-planes' }));
    }
    for (const q of Chart.ticks(grid.q_min, grid.q_max, small ? 5 : 6)) {
      const x = xp(q); svg.append(svgElement('line', { x1: x, x2: x, y1: top, y2: bottom, stroke: '#dce5ee', 'stroke-width': .7 }),
        svgElement('text', { x, y: bottom + 22, 'text-anchor': 'middle', 'font-size': font, fill: '#50647b', 'data-chart-label': 'x-tick' }, Chart.formatTick(q)));
    }
    for (const a of Chart.ticks(grid.a_min, grid.a_max, 6)) {
      const y = yp(a); svg.append(svgElement('line', { x1: left, x2: W - right, y1: y, y2: y, stroke: '#dce5ee', 'stroke-width': .7 }),
        svgElement('text', { x: left - 9, y: y + 4, 'text-anchor': 'end', 'font-size': font, fill: '#50647b', 'data-chart-label': 'y-tick' }, Chart.formatTick(a)));
    }
    svg.append(svgElement('text', { x: left + pw / 2, y: bottom + 46, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: '#263c56', 'data-chart-label': 'x-axis' }, 'q'),
      svgElement('text', { x: left - 30, y: top - 10, 'font-size': 15, 'font-weight': 600, fill: '#263c56', 'data-chart-label': 'y-axis' }, 'a'));
    for (const line of lines) {
      const style = lineStyle(line), d = contourPath(line.segments, xp, yp);
      if (d) { const path = svgElement('path', { d, fill: 'none', stroke: style.color, 'stroke-width': line.family === 'candidate' ? 1.5 : 2,
        'stroke-dasharray': style.dash, 'data-rr-family': line.family, 'data-rr-axis': line.axis || '' }); path.append(svgElement('title', {}, line.condition)); svg.append(path); }
    }
    const onMap = s.q >= grid.q_min && s.q <= grid.q_max && s.a >= grid.a_min && s.a <= grid.a_max;
    if (onMap) {
      const x = xp(s.q), y = yp(s.a), marker = svgElement('g', { 'data-rr-selected-point': 'true' });
      marker.append(svgElement('circle', { cx: x, cy: y, r: 6, fill: point.stable ? '#153c55' : '#b74642', stroke: '#fff', 'stroke-width': 2 }),
        svgElement('line', { x1: x - 10, x2: x + 10, y1: y, y2: y, stroke: '#153c55', 'stroke-width': 1 }),
        svgElement('line', { x1: x, x2: x, y1: y - 10, y2: y + 10, stroke: '#153c55', 'stroke-width': 1 })); svg.append(marker);
    } else {
      box('point-warning').hidden = false; box('point-warning').textContent = (point.stable ? '' : t('outside') + ' ') + t('out_of_frame');
    }
    for (const entry of legend) {
      if (entry.point) svg.append(svgElement('circle', { cx: entry.x + 12, cy: entry.y - 4, r: 4, fill: entry.color }));
      else if (entry.fill) svg.append(svgElement('rect', { x: entry.x, y: entry.y - 11, width: 25, height: 12, fill: entry.color }));
      else svg.append(svgElement('line', { x1: entry.x, x2: entry.x + 25, y1: entry.y - 4, y2: entry.y - 4, stroke: entry.color, 'stroke-width': 2, 'stroke-dasharray': entry.dash || '' }));
      svg.append(textLines(entry.lines, entry.x + 33, entry.y, font, { 'data-chart-label': 'legend' }));
    }
    svg.append(textLines(caption, 18, captionY, 11, { fill: '#617487', 'data-chart-label': 'caption' }));
    const hit = svgElement('rect', { x: left, y: top, width: pw, height: ph, fill: 'transparent', style: 'cursor:crosshair', 'data-rr-pick-area': 'true' });
    hit.addEventListener('click', event => {
      const rect = svg.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * W, y = (event.clientY - rect.top) / rect.height * H;
      const q = grid.q_min + (x - left) / pw * (grid.q_max - grid.q_min), a = grid.a_max - (y - top) / ph * (grid.a_max - grid.a_min);
      if (q < grid.q_min || q > grid.q_max || a < grid.a_min || a > grid.a_max) return;
      shared('geometry').value = 'linear'; shared('mode').value = 'direct';
      shared('a').value = String(Number(a.toPrecision(7))); shared('q').value = String(Number(q.toPrecision(7)));
      shared('mode').dispatchEvent(new Event('input', { bubbles: true })); queue();
    });
    svg.append(hit); return svg;
  }
  function responseFigure(response) {
    return Chart.plot([{ name: t('spectrum_x'), color: '#1962a3', rows: response.rows.map(r => ({ x: r.drive_Hz / 1000, y: r.x_rms_mm })) },
      { name: t('spectrum_y'), color: '#c36520', dash: '7 4', rows: response.rows.map(r => ({ x: r.drive_Hz / 1000, y: r.y_rms_mm })) }],
    t('spectrum_title'), t('frequency_axis'), t('response_axis'), {
      width: Math.max(240, holder('spectrum').clientWidth || root.clientWidth - 28 || 840),
      references: [{ x: response.f_x_Hz / 1000, label: 'fₓ = ' + nice(response.f_x_Hz / 1000) + ' kHz', color: '#1962a3' },
        { x: response.f_y_Hz / 1000, label: 'fᵧ = ' + nice(response.f_y_Hz / 1000) + ' kHz', color: '#c36520' }],
      caption: `${response.pulse_cycles} RF ${root.dataset.lang === 'zh' ? '周期' : 'periods'} · E_ex = ${nice(response.field_V_m)} V/m · ${t('model_caption')}`
    });
  }
  function exportsDisabled(disabled) {
    for (const action of ['svg', 'png', 'pdf', 'csv', 'json']) pane.querySelector('[data-rr-action="' + action + '"]').disabled = disabled;
  }
  async function refresh() {
    if (pane.hidden) { dirty = true; return; }
    const token = ++generation; busy = true; dirty = false; latest = null; exportsDisabled(true); controls();
    box('error').hidden = true; box('progress').textContent = t('build');
    const cancelled = () => token !== generation || pane.hidden;
    try {
      const s = state(), point = R.selected(s), inputs = snapshot(), inputKey = calculationKey(inputs);
      requestedInputs = inputKey; metrics(point, s);
      const fine = node('grid').value === 'fine';
      const grid = await R.grid({ columns: fine ? 201 : 121, rows: fine ? 141 : 85 },
        { cancelled, progress: p => { if (!cancelled()) box('progress').textContent = t('build') + ' ' + Math.round(p * 100) + '%'; } });
      if (!grid || cancelled()) return;
      const lines = R.overlays(grid, s), map = mapFigure(grid, lines, point, s);
      holder('map').replaceChildren(map); box('empty').hidden = !lines.some(l => l.family !== 'candidate' && !l.segments.length);
      let response = null, spectrumSVG = null;
      if (point.stable) {
        const responseInput = { a: s.a, q: s.q, f_Hz: s.f_Hz, mass_u: s.mass_u, charge: s.charge, field_V_m: s.field_V_m, cycles: s.cycles, steps: s.steps };
        const key = JSON.stringify(responseInput);
        response = spectra.get(key) || await R.spectrum(responseInput, { cancelled });
        if (!response || cancelled()) return;
        if (!spectra.has(key)) { if (spectra.size >= 3) spectra.delete(spectra.keys().next().value); spectra.set(key, response); }
        spectrumSVG = responseFigure(response); holder('spectrum').replaceChildren(spectrumSVG);
        const exceeds = response.rows.some(r => Math.max(r.x_max_mm, r.y_max_mm) >= s.r0_mm);
        box('response-warning').hidden = !exceeds; box('response-warning').textContent = t('aperture_warning');
      } else {
        holder('spectrum').replaceChildren(); box('response-warning').hidden = false; box('response-warning').textContent = t('no_response');
      }
      latest = { inputs, inputKey, state: s, point, grid, lines, response, map, spectrumSVG };
      box('progress').textContent = t('ready'); exportsDisabled(false);
    } catch (error) {
      if (!cancelled()) { latest = null; holder('map').replaceChildren(); holder('spectrum').replaceChildren();
        box('error').hidden = false; box('error').textContent = t('invalid') + ' (' + error.message + ')'; box('progress').textContent = ''; }
    } finally { if (token === generation) busy = false; }
  }
  function queue(force = false) {
    const key = calculationKey();
    if (force !== true && key === requestedInputs && (busy || dirty || latest)) return;
    requestedInputs = key;
    generation++; dirty = true; latest = null; exportsDisabled(true); clearTimeout(timer);
    if (!pane.hidden) timer = setTimeout(refresh, 140);
  }
  function save(data, name, type) {
    const blob = new Blob([data], { type });
    if (window.zgExport?.save) { window.zgExport.save(blob, name); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function exportResult(action, button) {
    const status = box('export-status');
    try {
      button.disabled = true; status.textContent = t('exporting');
      if (busy || dirty || !latest || latest.inputKey !== calculationKey()) {
        clearTimeout(timer); await refresh();
      }
      if (busy || dirty || !latest || latest.inputKey !== calculationKey()) { status.textContent = t('export_wait'); return; }
      button.disabled = true;
      const result = latest, target = node('export-target').value, svg = target === 'map' ? result.map : result.spectrumSVG;
      const metadata = { schema: 'rfq-resonance-export-v1', generated_utc: new Date().toISOString(),
        inputs: { ...result.inputs, 'rr-export-target': target }, point: result.point,
        conditions: result.lines.map(({ segments, ...line }) => ({ ...line, segment_count: segments.length })),
        grid: { columns: result.grid.columns, rows: result.grid.rows, steps: result.grid.steps, method: result.grid.method },
        model_evidence: 'ideal numerical calculation; not measured loss or native SIMION', units: { frequency: 'Hz', position: 'mm', a: 'dimensionless', q: 'dimensionless' },
        sources: R.sources, limits: result.point.limits };
      if (action === 'json') save(JSON.stringify({ ...metadata, contour_segments: result.lines, response: result.response }, null, 2) + '\n', 'rfq-resonance-model.json', 'application/json');
      else if (action === 'csv') {
        const rows = target === 'spectrum' ? result.response?.rows : result.grid.nodes.flat().map(p => ({ a: p.a, q: p.q, stable: p.stable,
          beta_x: p.beta_x, beta_y: p.beta_y, f_x_Hz: p.stable ? p.beta_x * result.state.f_Hz / 2 : null,
          f_y_Hz: p.stable ? p.beta_y * result.state.f_Hz / 2 : null }));
        if (!rows?.length) throw Error(t('no_response'));
        const columns = Object.keys(rows[0]);
        save([columns.map(quote).join(','), ...rows.map(row => columns.map(c => quote(row[c])).join(','))].join('\r\n') + '\r\n', 'rfq-resonance-' + target + '.csv', 'text/csv');
      } else {
        if (!svg) throw Error(t('no_response'));
        if (window.ZGFigureStyle) await window.ZGFigureStyle.exportSVG(svg, action.toUpperCase(), 'rfq-resonance-' + target, undefined, metadata);
        else if (action === 'svg') save(new XMLSerializer().serializeToString(svg), 'rfq-resonance-' + target + '.svg', 'image/svg+xml');
        else throw Error('figure exporter unavailable');
      }
      status.textContent = t('export_ready');
    } catch (error) { status.textContent = t('invalid') + ' (' + error.message + ')'; }
    finally { button.disabled = busy || dirty || !latest || latest.inputKey !== calculationKey(); }
  }
  root.addEventListener('rfq:statechange', queue);
  for (const eventName of ['input', 'change']) pane.addEventListener(eventName, event => {
    if (!event.target.name?.startsWith('rr-')) return;
    event.stopPropagation(); controls();
    if (event.target.name !== 'rr-export-target') queue();
  });
  pane.addEventListener('click', event => {
    const button = event.target.closest?.('[data-rr-action]'); if (!button) return;
    event.stopPropagation(); const action = button.dataset.rrAction;
    if (action === 'run') { clearTimeout(timer); refresh(); }
    else if (action.startsWith('match-')) {
      try {
        const p = R.selected(state()); if (!p.stable) return;
        node(action === 'match-dipole' ? 'drive' : 'modulation').value = nice((action === 'match-dipole' ? p.f_x_Hz : p.primary_parametric_x_Hz) / 1000); queue();
      } catch (_) { queue(); }
    } else exportResult(action, button);
  });
  if (window.MutationObserver) new MutationObserver(() => {
    if (!pane.hidden && dirty) refresh();
    else if (pane.hidden) { generation++; busy = false; dirty = true; }
  }).observe(pane, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', () => {
    clearTimeout(resized); resized = setTimeout(() => { if (!pane.hidden) queue(true); }, 100);
  });
  controls(); exportsDisabled(true); if (!pane.hidden) refresh();
})();
