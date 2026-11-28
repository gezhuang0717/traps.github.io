/* RFQ analytical workbench. All uploaded data stay in this browser.
 * Each model validates only the inputs it uses. Numerical output is not a
 * measured transmission, a finite-electrode solution, or native SIMION data.
 */
(function () {
  'use strict';
  const X = window.ZGRFQExtras, M = window.ZGMathieu, H = window.ZGRFQWorkbench;
  const root = document.querySelector('#rfq-workbench');
  if (!X || !M || !H || !root || root.dataset.extrasReady) return;
  root.dataset.extrasReady = 'true';
  const labels = JSON.parse(root.dataset.extrasLabels || '{}');
  const msg = (key, fallback = key) => labels[key] || fallback;
  const field = name => root.querySelector('[name="' + name + '"]');
  const value = name => {
    const e = field(name), text = e?.value?.trim();
    if (!text || !Number.isFinite(Number(text))) throw Error(name);
    return Number(text);
  };
  const make = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  };
  const nice = x => Number.isFinite(x) ? Number(x.toPrecision(7)).toString() : '—';
  const quote = s => '"' + String(s ?? '').replaceAll('"', '""') + '"';
  const panels = ['motion', 'gas', 'bunch', 'scan', 'data'];
  const latest = {}, players = {}, scenes = {};
  let localRows = null, localSource = '', localExample = null, timer = null, resizeTimer = null;
  const save = (content, name, type) => {
    const blob = new Blob([content], { type });
    if (window.zgExport?.save) { window.zgExport.save(blob, name); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.download = name; link.href = url; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const ion = (chargeRequired = true) => {
    const mass = value('ms-mass'), charge = chargeRequired ? value('ms-charge') : null;
    if (mass <= 0 || (chargeRequired && (!Number.isInteger(charge) || charge < 1 || charge > 100))) throw Error('ion');
    return { mass, charge };
  };
  const point = () => {
    const s = ion(), r0 = value('ms-r0'), fMHz = value('ms-f');
    if (r0 <= 0 || fMHz <= 0) throw Error('r₀ / f');
    const geometry = field('ms-geometry').value;
    const direct = field('ms-mode').value === 'direct' || geometry === 'paul3d';
    const rodPeak = direct ? null : H.toRodPeak(value('ms-V'), field('ms-voltage-convention').value);
    const p = direct ? { a: value('ms-a'), q: value('ms-q') } : M.parameters(s.mass, s.charge, value('ms-U'), rodPeak, r0, fMHz);
    return { ...s, r0, fMHz, geometry, direct, rodPeak, p };
  };
  const inputSnapshot = () => Object.fromEntries([...root.querySelectorAll('[name^="ms-"],[name^="rx-"]')]
    .filter(e => e.type !== 'file').map(e => [e.name, e.type === 'checkbox' ? e.checked : e.value]));
  function metrics(out, rows, modelKey) {
    const dl = make('dl', 'rfq-metrics');
    for (const [label, result, tone] of rows) {
      const item = make('div', 'rfq-metric' + (tone ? ' rfq-metric-' + tone : ''));
      item.append(make('dt', '', label + ':'), make('dd', '', typeof result === 'number' ? nice(result) : result));
      dl.append(item);
    }
    out.replaceChildren(dl, make('p', 'rfq-model-caption', msg('model') + ': ' + msg(modelKey)));
  }
  function showPoint() {
    const box = root.querySelector('[data-rfx-shared-summary]');
    if (!box) return;
    try {
      const s = point();
      box.replaceChildren(make('strong', '', msg('parameters')),
        make('span', '', `m = ${nice(s.mass)} u · z = ${s.charge} · a = ${nice(s.p.a)} · q = ${nice(s.p.q)}`),
        make('span', 'zg-muted', s.direct ? msg('direct_point') : `V = ${nice(s.rodPeak)} V (${msg('axis_voltage')}) · r₀ = ${nice(s.r0)} mm · f = ${nice(s.fMHz)} MHz`));
    } catch (_) { box.textContent = msg('bad'); }
  }
  function plot(chart, series, title, xlabel, ylabel, options = {}) {
    const svg = window.ZGRFQChart?.plot(series, title, xlabel, ylabel, {
      width: Math.max(200, (chart.clientWidth || root.clientWidth - 36 || 824) - 4), ...options
    });
    if (!svg) throw Error('chart unavailable');
    chart.replaceChildren(svg);
    return svg;
  }
  const axisInfo = {
    voltage: { key: 'axis_voltage', unit: 'V', range: [0, 200], lower: 0 },
    frequency: { key: 'axis_frequency', unit: 'MHz', range: [.5, 3], lower: .000001 },
    radius: { key: 'axis_radius', unit: 'mm', range: [2, 12], lower: .001 },
    mass: { key: 'axis_mass', unit: 'u', range: [20, 240], lower: .001 }
  };
  let scanAxis = field('rx-scan-axis').value;
  const scanRanges = {};
  function scanLabels(changeRange = false) {
    const axis = field('rx-scan-axis').value, info = axisInfo[axis];
    if (!info) return;
    if (changeRange && axis !== scanAxis) {
      scanRanges[scanAxis] = [field('rx-vmin').value, field('rx-vmax').value];
      const range = scanRanges[axis] || info.range;
      field('rx-vmin').value = range[0]; field('rx-vmax').value = range[1]; scanAxis = axis;
    }
    root.querySelector('[data-rfx-min-label]').textContent = `${msg('scan_min')} (${info.unit})`;
    root.querySelector('[data-rfx-max-label]').textContent = `${msg('scan_max')} (${info.unit})`;
    for (const n of ['rx-vmin', 'rx-vmax']) field(n).min = info.lower;
  }
  function scanTable(rows) {
    const box = root.querySelector('[data-rfx-scan-table]'); box.replaceChildren();
    const table = make('table', 'zg-table'), head = make('thead'), tr = make('tr');
    [msg(axisInfo[field('rx-scan-axis').value].key), 'a', 'q', msg('metric_depth'), JSON.parse(root.dataset.labels).readout].forEach(x => tr.append(make('th', '', x)));
    head.append(tr); table.append(head); const body = make('tbody');
    for (const row of rows) {
      const tr = make('tr');
      [nice(row.scan_value), nice(row.a), nice(row.q), nice(row.rf_only_depth_eV), msg('class_' + row.classification, row.classification)].forEach(x => tr.append(make('td', '', x)));
      body.append(tr);
    }
    table.append(body); box.append(table);
  }
  function histogram(rows) {
    let low = Infinity, high = -Infinity;
    for (const r of rows) { low = Math.min(low, r.t_ns); high = Math.max(high, r.t_ns); }
    if (low === high) { low -= .5; high += .5; }
    const count = Math.min(40, Math.max(5, Math.ceil(Math.sqrt(rows.length))));
    const dx = (high - low) / count, bins = Array(count).fill(0);
    for (const r of rows) bins[Math.min(count - 1, Math.floor((r.t_ns - low) / dx))]++;
    return bins.flatMap((y, i) => [{ x: low + i * dx, y }, { x: low + (i + 1) * dx, y }]);
  }
  function dispose(kind) {
    players[kind]?.destroy(); scenes[kind]?.destroy();
    delete players[kind]; delete scenes[kind];
  }
  function applyInputs(values) {
    if (Object.hasOwn(values, 'rx-scan-axis')) {
      field('rx-scan-axis').value = values['rx-scan-axis']; scanLabels(true);
    }
    for (const [name, result] of Object.entries(values)) {
      const input = field(name);
      if (input) input.value = String(result);
    }
    // Let the shared workbench update conversions and emit rfq:statechange.
    field('ms-mode').dispatchEvent(new Event('change', { bubbles: true }));
    scanLabels(); queueAll();
  }
  function motionPreset(name) {
    const r0 = value('ms-r0'), f = value('ms-f');
    if (!(r0 > 0 && f > 0)) return;
    const p = { 'ms-geometry': 'linear', 'ms-mode': 'direct', 'ms-a': 0, 'ms-q': .25,
      'rx-cycles': 48, 'rx-steps': 128, 'rx-x': .1*r0, 'rx-y': .04*r0,
      'rx-z': 0, 'rx-vx': 0, 'rx-vy': 0, 'rx-vz': 0, 'rx-phase': 0, 'rx-motion-view': 'filtered' };
    if (name === 'gentle') p['ms-q'] = .12;
    if (name === 'strong') Object.assign(p, { 'ms-q': .55, 'rx-cycles': 24 });
    if (name === 'orbitPreset') Object.assign(p, { 'rx-y': 0, 'rx-vy': 2*Math.PI*(.25*f/(2*Math.sqrt(2)))*p['rx-x'], 'rx-motion-view': 'orbit' });
    if (name === 'flight') Object.assign(p, { 'ms-q': .3, 'rx-cycles': 24, 'rx-z': -2*r0, 'rx-vz': 4*r0*f/24, 'rx-motion-view': 'spatial' });
    if (name === 'phases') Object.assign(p, { 'ms-q': .4, 'rx-cycles': 24, 'rx-motion-view': 'comparison' });
    if (name === 'unstable') Object.assign(p, { 'ms-q': 1.05, 'rx-cycles': 24, 'rx-motion-view': 'orbit' });
    applyInputs(p);
  }
  function render(kind) {
    const out = root.querySelector('[data-rfx-output="' + kind + '"]');
    const chart = root.querySelector('[data-rfx-figure="' + kind + '"]');
    const err = root.querySelector('[data-rfx-error="' + kind + '"]');
    if (!out || !chart) return;
    dispose(kind);
    out.replaceChildren(); chart.replaceChildren(); chart.hidden = false; err.textContent = ''; delete latest[kind];
    if (kind === 'scan') root.querySelector('[data-rfx-scan-table]').replaceChildren();
    root.querySelectorAll('[data-rfx-kind="' + kind + '"]').forEach(b => {
      if (['csv', 'json', 'svg', 'png', 'pdf'].includes(b.dataset.rfxAction)) b.disabled = true;
    });
    try {
      let report, svg, rows = [], modelKey = kind + '_model';
      if (kind === 'motion') {
        const s = point(); if (s.geometry !== 'linear') throw Error(msg('four_rod_only'));
        const config = { a: s.p.a, q: s.p.q, r0_mm: s.r0, cycles: value('rx-cycles'),
          x_mm: value('rx-x'), y_mm: value('rx-y'), phase_rad: value('rx-phase'),
          z_mm: value('rx-z'), vz_mm_per_tau: value('rx-vz') / (Math.PI * s.fMHz),
          vx_mm_per_tau: value('rx-vx') / (Math.PI * s.fMHz), vy_mm_per_tau: value('rx-vy') / (Math.PI * s.fMHz),
          steps_per_rf_cycle: value('rx-steps') };
        const run = X.motion(config);
        const transit = X.transitEstimate({mass_u:s.mass,active_length_mm:value('rx-length'),
          vz_mm_per_us:value('rx-vz'),f_MHz:s.fMHz,observation_cycles:value('rx-cycles')});
        const physicalRows = samples => samples.map(r => ({ ...r, time_us: r.cycle / s.fMHz,
          vx_mm_per_us: r.vx_mm_per_tau * Math.PI * s.fMHz, vy_mm_per_us: r.vy_mm_per_tau * Math.PI * s.fMHz,
          vz_mm_per_us: r.vz_mm_per_tau * Math.PI * s.fMHz }));
        rows = physicalRows(run.samples);
        report = { ...run, transit, shared: { mass_u: s.mass, charge: s.charge, a: s.p.a, q: s.p.q, f_MHz: s.fMHz }, samples: rows };
        metrics(out, [[msg('current'), run.alive ? msg('yes_ideal') : msg('no_loss'), run.alive ? 'ok' : 'warn'],
          ['a', s.p.a], ['q', s.p.q], [msg('first_loss'), run.loss_cycle ?? msg('none_observed')],
          [msg('samples'), rows.length], [msg('integrator'), run.steps_per_rf_cycle], [msg('duration_us'), value('rx-cycles') / s.fMHz],
          [msg('active_length'), transit.active_length_mm],
          [msg('axial_ke'), transit.axial_kinetic_eV],
          [msg('transit_time'), transit.transit_time_us ?? msg('no_forward_motion')],
          [msg('transit_cycles'), transit.transit_rf_cycles ?? msg('no_forward_motion')],
          [msg('transit_window'), !transit.forward_exit_possible ? msg('no_forward_motion') :
            transit.observation_covers_nominal_exit ? msg('window_covers') : msg('window_short'),
            transit.observation_covers_nominal_exit ? 'ok' : 'warn']], modelKey);
        out.append(make('p', 'zg-muted zg-small', msg('length_note')));
        const view = field('rx-motion-view').value;
        if (view === 'comparison') {
          report.phase_comparison = [0, Math.PI/2, Math.PI].map(phase_rad => {
            const comparison = X.motion({ ...config, phase_rad });
            return { phase_rad, alive: comparison.alive, loss_cycle: comparison.loss_cycle, samples: physicalRows(comparison.samples) };
          });
        }
        const scene = window.ZGRFQMotionView.mount({ root, chart, rows, report, r0: s.r0, fMHz: s.fMHz, view, onPreset: motionPreset });
        scenes.motion = scene; svg = scene.getSVG();
        if (scene.spectrum) report.spectrum = scene.spectrum;
        players.motion = window.ZGRFQPlayback.mount({ ...scene, filename: 'rfq-motion-' + view,
          renderFrame: fraction => { const frame = scene.renderFrame(fraction); if (latest.motion) latest.motion.svg = frame; return frame; },
          metadata: { model: report.model, view, inputs: inputSnapshot() } });
        svg = scene.getSVG();
      } else if (kind === 'gas') {
        const s = ion(false);
        report = X.cooling({ mass_u: s.mass, gas_mass_u: value('rx-gas_mass'), temperature_K: value('rx-T'),
          pressure_mbar: value('rx-p'), cross_section_A2: value('rx-sigma'), energy_eV: value('rx-E'),
          residence_ms: value('rx-ms'), transfer_efficiency: value('rx-eta') });
        rows = report.points;
        metrics(out, [[msg('density'), report.density_m3], [msg('collision_rate'), report.collision_rate_s],
          [msg('relaxation'), report.tau_ms ?? '∞'], [msg('energy_floor'), report.energy_floor_eV], [msg('final_energy'), report.estimated_energy_eV]], modelKey);
        svg = plot(chart, [{ name: msg('energy_series'), rows: rows.map(p => ({ x: p.t_ms, y: p.energy_eV })) }],
          msg('gas_title'), msg('residence'), msg('energy_axis'), { references: [{ y: report.energy_floor_eV, label: msg('energy_floor'), color: '#b46c22' }] });
      } else if (kind === 'bunch') {
        const s = ion(), b = X.bunch({ mass_u: s.mass, charge: s.charge, acceleration_V: value('rx-V'),
          drift_m: value('rx-L'), sigma_t_ns: value('rx-st'), sigma_E_eV: value('rx-sE'), rho: value('rx-rho') });
        const inv = X.inventory({ ion_rate_s: value('rx-rate'), hold_ms: value('rx-hold'), lifetime_ms: value('rx-life'),
          capacity: value('rx-capacity'), extraction_fraction: value('rx-eff') });
        report = { bunch: b, inventory: inv }; rows = b.scan;
        metrics(out, [[msg('width_axis'), b.fwhm_out_ns], [msg('drift_energy'), b.energy_eV], [msg('flight_time'), b.flight_ns],
          [msg('derivative'), b.dt_dE_ns_per_eV], [msg('covariance'), b.covariance_ns_eV], [msg('stored'), inv.captured_ions], [msg('delivered'), inv.delivered_ions]], modelKey);
        const meanNote = make('p', 'rfq-expectation-note');
        const zh = root.dataset.lang === 'zh';
        if (!['en', 'zh'].includes(root.dataset.lang)) meanNote.lang = 'en';
        meanNote.textContent = zh
          ? `这里是每周期的平均期望计数，不是单个离子的分数。重复 100 个相同周期，平均总存储 ${nice(100*inv.captured_ions)} 个离子、总提取 ${nice(100*inv.delivered_ions)} 个离子。N_ext = ηN_store；这里 η = ${nice(value('rx-eff'))}。每次实际计数均为整数。`
          : `These are expected counts per cycle, not fractions of a physical ion. Over 100 identical cycles, the expected totals are ${nice(100*inv.captured_ions)} stored and ${nice(100*inv.delivered_ions)} extracted ions. N_ext = ηN_store; here η = ${nice(value('rx-eff'))}. Each actual count is an integer.`;
        out.append(meanNote);
        if (b.relative_energy_spread > .1) out.append(make('p', 'rfq-warning', msg('linear_warning')));
        if (b.near_focus_warning) out.append(make('p', 'rfq-warning', msg('near_focus_warning') + ' ' + nice(b.second_order_sigma_t_ns) + ' ns.'));
        svg = plot(chart, [{ name: msg('width_axis'), rows: rows.map(p => ({ x: p.rho, y: p.fwhm_ns })) }], msg('bunch_title'), msg('rho_axis'), msg('width_axis'),
          { xDomain: [-1, 1], markers: [{ x: value('rx-rho'), y: b.fwhm_out_ns, label: msg('current') }], references: [{ y: X.C.fwhm * value('rx-st'), label: msg('initial_width') }] });
      } else if (kind === 'scan') {
        const s = point(); if (s.geometry !== 'linear' || s.direct) throw Error(msg('voltage_required'));
        const axis = field('rx-scan-axis').value;
        report = X.parameterScan({ axis, min: value('rx-vmin'), max: value('rx-vmax'), count: value('rx-count'), mass_u: s.mass,
          charge: s.charge, U_V: value('ms-U'), V_rod_peak_V: s.rodPeak, r0_mm: s.r0, f_MHz: s.fMHz }, M);
        rows = report.rows;
        metrics(out, [[msg('count'), rows.length], [msg('stable_points'), rows.filter(r => r.classification === 'stable').length],
          [msg('other_points'), rows.filter(r => r.classification !== 'stable').length]], modelKey);
        const depth = field('rx-scan-metric').value === 'depth', key = depth ? 'rf_only_depth_eV' : 'q';
        // Distinguish classifications with both colour and marker shape; a line
        // alone can look stable even when every computed point is unstable.
        const groups = ['stable', 'unstable', 'boundary', 'outside', 'unresolved'].map((status, i) => ({
          name: msg('class_' + status), color: ['#19786c', '#b64a3f', '#a66b20', '#788396', '#7b528b'][i],
          rows: rows.filter(r => r.classification === status).map(p => ({ x: p.scan_value, y: p[key] })),
          scatter: true, marker: ['circle', 'cross', 'square', 'diamond', 'triangle'][i]
        })).filter(s => s.rows.length);
        svg = plot(chart, groups, msg('scan_title'), msg(axisInfo[axis].key), msg(depth ? 'metric_depth' : 'metric_q'), { scatter: true });
        scanTable(rows);
      } else if (kind === 'data') {
        if (!localRows) { out.textContent = msg('no_data'); chart.hidden = true; return; }
        report = { ...X.analyzeSamples(localRows), teaching_example: localExample }; rows = localRows;
        metrics(out, [[msg('events'), report.count], [msg('mean_t'), report.mean_t_ns], [msg('sigma_time'), report.sigma_t_ns],
          [msg('gaussian_fwhm'), report.gaussian_equivalent_fwhm_ns], [msg('sigma_energy'), report.sigma_E_eV],
          [msg('covariance'), report.covariance_ns_eV], [msg('correlation'), report.correlation ?? msg('undefined')],
          [msg('radial_rms'), report.radial_rms_mm ?? msg('not_provided')]], modelKey);
        const view = field('rx-data-view').value;
        svg = window.ZGRFQDataViews?.render({ view, chart, rows, report, plot, msg });
        if (svg) { /* The selected example view produced its own calibrated axes. */ }
        else if (view === 'histogram') {
          const bins = histogram(rows), maximumCount = Math.max(...bins.map(p => p.y));
          svg = plot(chart, [{ name: msg('events'), rows: bins }], msg('hist_title'), 'TOF (ns)', msg('counts_axis'), { yDomain: [0, Math.max(1, maximumCount * 1.08)] });
        } else {
          const plotted = rows.length <= 3000 ? rows : Array.from({ length: 3000 }, (_, i) => rows[Math.floor(i * (rows.length - 1) / 2999)]);
          svg = plot(chart, [{ name: msg('data_series'), rows: plotted.map(p => ({ x: p.t_ns, y: p.E_eV })) }], msg('data_title'), 'TOF (ns)', msg('energy_axis'), { scatter: true });
          if (rows.length > 3000) out.append(make('p', 'zg-muted', msg('plot_subset')));
        }
      }
      chart.hidden = !svg;
      latest[kind] = { report, rows, svg, inputs: inputSnapshot(), source: kind === 'data' ? localSource : null, modelKey };
      if (['gas', 'bunch', 'scan'].includes(kind)) {
        const scene = window.ZGRFQScenes.mount({ root, kind, chart, report, rows, inputs: inputSnapshot(), onParameterChange: applyInputs });
        scenes[kind] = scene;
        players[kind] = window.ZGRFQPlayback.mount({ ...scene, filename: 'rfq-' + kind + '-explainer', metadata: {
          kind, model: report.model || report.bunch?.model, inputs: inputSnapshot() } });
      }
      root.querySelectorAll('[data-rfx-kind="' + kind + '"]').forEach(b => {
        if (['csv', 'json', 'svg', 'png', 'pdf'].includes(b.dataset.rfxAction)) b.disabled = false;
      });
    } catch (e) {
      chart.hidden = true;
      err.textContent = msg('bad') + ' (' + e.message + ')';
    }
  }
  async function exportKind(kind, action, button) {
    // Flush edits before saving, while retaining the current animation frame
    // and camera if its numerical inputs have not changed.
    if (!latest[kind] || JSON.stringify(latest[kind].inputs) !== JSON.stringify(inputSnapshot())) {
      clearTimeout(timer); timer = null; render(kind);
    }
    const result = latest[kind], status = root.querySelector('[data-rfx-export-status="' + kind + '"]');
    if (!result) { status.textContent = msg('empty_error'); return; }
    if (kind === 'motion') { players.motion?.pause(); result.svg = scenes.motion?.getSVG() || result.svg; }
    const generated = new Date().toISOString();
    if (action === 'json') save(JSON.stringify({ schema: 'rfq-browser-workbench-v2', kind, generated_utc: generated,
      model_evidence: 'analytical-or-numerical-browser-only', inputs: result.inputs, data_source: result.source,
      units: { mass: 'u', RF_voltage: 'selected display convention; canonical amplitude is single-rod peak', radius: 'mm', frequency: 'MHz', time: 'ns unless time_us or t_ms', energy: 'eV' },
      result: result.report }, null, 2) + '\n', 'rfq-' + kind + '-model.json', 'application/json');
    else if (action === 'csv') {
      if (!result.rows.length) return;
      const cols = Object.keys(result.rows[0]);
      const text = [cols.map(quote).join(','), ...result.rows.map(r => cols.map(k => quote(r[k])).join(','))].join('\n') + '\n';
      save(text, 'rfq-' + kind + '-model.csv', 'text/csv');
    } else if (['svg', 'png', 'pdf'].includes(action) && result.svg) {
      status.textContent = msg('exporting'); if (button) button.disabled = true;
      try {
        const provenance = { schema: 'rfq-browser-figure-v2', kind, model: result.report.model || result.report.bunch?.model,
          model_evidence: 'browser educational calculation', inputs: result.inputs, generated_utc: generated,
          limits: 'No measured transmission or native SIMION execution. Raw imported events are excluded from figure metadata.' };
        if (window.ZGFigureStyle) await window.ZGFigureStyle.exportSVG(result.svg, action.toUpperCase(), 'rfq-' + kind + '-figure', undefined, provenance);
        else if (action === 'svg') save(new XMLSerializer().serializeToString(result.svg), 'rfq-' + kind + '-figure.svg', 'image/svg+xml');
        else throw Error('figure exporter unavailable');
      } catch (e) { status.textContent = msg('bad') + ' (' + e.message + ')'; return; }
      finally { if (button) button.disabled = false; }
    }
    status.textContent = msg('export_ready');
  }
  function refreshAll() { showPoint(); scanLabels(); panels.forEach(render); }
  function queueAll() { clearTimeout(timer); timer = setTimeout(refreshAll, 120); }
  root.addEventListener('rfq:statechange', queueAll);
  root.addEventListener('rfq:load-data', e => {
    localRows = e.detail.rows; localSource = e.detail.source; localExample = e.detail.example || null;
    root.querySelector('[data-rfx-data-source]').textContent = localSource; render('data');
  });
  root.addEventListener('input', e => {
    if (e.target.name?.startsWith('rx-') && e.target.name !== 'rx-example' && e.target.type !== 'file') queueAll();
  });
  root.addEventListener('change', e => {
    if (e.target.name === 'rx-scan-axis') scanLabels(true);
    if (e.target.name?.startsWith('rx-') && e.target.name !== 'rx-example' && e.target.type !== 'file') queueAll();
  });
  root.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-rfx-action]');
    if (!btn || !root.contains(btn)) return;
    const kind = btn.dataset.rfxKind, action = btn.dataset.rfxAction;
    if (!panels.includes(kind)) return;
    if (action === 'demo') {
      localRows = Array.from({ length: 61 }, (_, i) => ({ t_ns: 1000 + (i - 30) * 1.5,
        E_eV: 1000 + .035 * (i - 30) + .12 * Math.sin(i * 2.4), x_mm: .1 * Math.cos(i), y_mm: .12 * Math.sin(i) }));
      localSource = 'deterministic educational example'; localExample = null;
      root.querySelector('[data-rfx-data-source]').textContent = msg('demo_note'); render('data');
    } else if (action === 'clear') {
      localRows = null; localSource = ''; localExample = null; root.querySelector('[data-rfx-data-source]').textContent = ''; render('data');
    } else if (action === 'run') render(kind);
    else exportKind(kind, action, btn);
  });
  const picker = root.querySelector('[data-rfx-file]');
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0]; if (!file) return;
    try {
      if (file.size > 1500000) throw Error('file too large (>1.5 MB)');
      localRows = X.parseCSV(await file.text()); localSource = file.name; localExample = null;
      root.querySelector('[data-rfx-data-source]').textContent = file.name; render('data');
    } catch (e) {
      localRows = null; localSource = ''; localExample = null; render('data');
      root.querySelector('[data-rfx-data-source]').textContent = '';
      root.querySelector('[data-rfx-error="data"]').textContent = msg('bad') + ' (' + e.message + ')';
    } finally { picker.value = ''; }
  });
  // Hidden panels have no usable width. Rebuild the visible chart on tab
  // selection or resize; numerical data remain independent of its pixel size.
  const resizeVisible = () => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {
      for (const kind of panels) if (!root.querySelector('[data-local-panel="' + kind + '"]').hidden) render(kind);
    }, 80);
  };
  window.addEventListener('resize', resizeVisible);
  // Hidden panels must not keep animating or finish a recording off screen.
  new MutationObserver(records => {
    for (const record of records) if (record.target.hidden) {
      const kind = record.target.dataset.localPanel;
      if (players[kind]?.recording) dispose(kind); else players[kind]?.pause();
    }
  }).observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  if (window.ResizeObserver) {
    let width = 0;
    new ResizeObserver(entries => {
      const next = entries[0].contentRect.width;
      if (Math.abs(next - width) > 2) { width = next; resizeVisible(); }
    }).observe(root);
  }
  refreshAll();
})();
