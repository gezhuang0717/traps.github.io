/* Labelled data table for tools that read pasted text (King plot, user radii, user moments, ...).
   The text area stays the single source of truth (it is what the tool parses, loads files into and exports), but it is folded away: the visitor
   fills a table whose columns say what each number is, in which unit, and whether it is optional. Every table edit rewrites the text and fires an
   'input' event on it; text edits and programmatic changes (refresh()) rebuild the table.
   ZGDataTable.mount(textarea, { columns:[{label, unit?, hint, optional?}], labels, example?, parse?, format?, onChange? }) -> { refresh, rows, set }
   Text format: one row per line, cells separated by comma, semicolon, tab or blank; lines starting with # are comments.
   parse(text) -> array of cell arrays (may throw; used for JSON or special files); format(rows) -> text (default: comma separated, empty cells at the end dropped). */
(function (host) {
  'use strict';
  if (host.ZGDataTable) { if (typeof module === 'object') module.exports = host.ZGDataTable; return; }
  const split = line => line.trim().split(/[\s,;]+/).filter(x => x !== '');
  function parseText(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(split);
  }
  const formatRows = rows => rows.map(r => { const cells = r.slice(); while (cells.length && cells[cells.length - 1] === '') cells.pop(); return cells.join(','); }).filter(Boolean).join('\n');

  function mount(textarea, o) {
    const doc = textarea.ownerDocument, L = o.labels || {}, cols = o.columns, n = cols.length;
    const make = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    let rows = [], note = '', fromTable = false;
    const wrap = make('div', 'zg-dtable'), legend = make('dl', 'zg-defs'), table = make('table', 'zg-table'), head = make('thead'), tr = make('tr'), body = make('tbody');
    const status = make('p', 'zg-muted zg-small'), bar = make('div', 'zg-dtable-bar');
    status.setAttribute('role', 'status');
    for (const h of ['#', ...cols.map(c => c.label + (c.unit ? ' (' + c.unit + ')' : '') + (c.optional ? ' *' : ''))]) tr.append(make('th', '', h));
    tr.append(make('th', '', ''));
    head.append(tr); table.append(head, body);
    for (const c of cols) legend.append(make('dt', '', c.label + (c.unit ? ' (' + c.unit + ')' : '')), make('dd', '', (c.optional ? (L.optional || 'optional') + ' · ' : '') + c.hint));
    const legendFold = make('details', 'zg-fold'), legendSum = make('summary', '', L.columns || 'What each column means');
    legendFold.append(legendSum, legend);
    const addBtn = make('button', 'zg-btn zg-btn-ghost', '＋ ' + (L.add || 'Add row')), clearBtn = make('button', 'zg-btn zg-btn-ghost', L.clear || 'Clear table');
    addBtn.type = clearBtn.type = 'button'; bar.append(addBtn, clearBtn);
    if (o.example) { const ex = make('button', 'zg-btn zg-btn-ghost', L.example || 'Load example'); ex.type = 'button'; ex.onclick = () => { textarea.value = o.example; commitFromText(); emit(); }; bar.append(ex); }
    const tableWrap = make('div', 'wb-table-wrap'); tableWrap.append(table);
    wrap.append(legendFold, tableWrap, bar, status);
    const holder = textarea.closest ? (textarea.closest('label') || textarea) : textarea;
    const textFold = make('details', 'zg-fold zg-dtable-text'), textSum = make('summary', '', L.text || 'Paste or edit as text');
    holder.before(wrap); textFold.append(textSum); holder.before(textFold); textFold.append(holder);

    const cell = (r, c) => (rows[r] && rows[r][c]) ?? '';
    function render() {
      body.replaceChildren();
      rows.forEach((row, r) => {
        const trow = make('tr'), num = make('td', '', String(r + 1));
        trow.append(num);
        cols.forEach((col, c) => {
          const td = make('td'), input = make('input');
          input.type = 'text'; input.inputMode = 'decimal'; input.value = cell(r, c); input.autocomplete = 'off'; input.spellcheck = false;
          input.setAttribute('aria-label', `${r + 1}: ${col.label}${col.unit ? ' (' + col.unit + ')' : ''}`);
          input.dataset.row = String(r); input.dataset.col = String(c);
          input.addEventListener('input', () => { while (rows[r].length < n) rows[r].push(''); rows[r][c] = input.value.trim(); commitFromTable(); });
          input.addEventListener('paste', e => {
            const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
            if (!/[\n\t,;]/.test(text.trim())) return;
            e.preventDefault();
            const pasted = parseText(text);
            pasted.forEach((cells, k) => { const rr = r + k; while (rows.length <= rr) rows.push(Array(n).fill('')); cells.forEach((v, j) => { if (c + j < n) rows[rr][c + j] = v; }); });
            render(); commitFromTable();
          });
          td.append(input); trow.append(td);
        });
        const del = make('button', 'zg-btn zg-btn-ghost', '×'); del.type = 'button'; del.setAttribute('aria-label', (L.remove || 'Remove row') + ' ' + (r + 1));
        del.onclick = () => { rows.splice(r, 1); render(); commitFromTable(); };
        const tdd = make('td'); tdd.append(del); trow.append(tdd); body.append(trow);
      });
      status.textContent = note || (L.rows || '{n} rows').replace('{n}', String(rows.filter(r => r.some(x => x !== '')).length));
    }
    const fire = () => { fromTable = true; try { textarea.dispatchEvent(new (host.Event || Event)('input', { bubbles: true })); } finally { fromTable = false; } };
    function emit() { fire(); if (o.onChange) o.onChange(rows); }
    function commitFromTable() { textarea.value = (o.format || formatRows)(rows); note = ''; status.textContent = (L.rows || '{n} rows').replace('{n}', String(rows.filter(r => r.some(x => x !== '')).length)); fire(); if (o.onChange) o.onChange(rows); }
    function commitFromText() {
      try { rows = (o.parse || parseText)(textarea.value).map(r => { const c = r.map(x => (x == null ? '' : String(x))); while (c.length < n) c.push(''); return c.slice(0, n); }); note = ''; }
      catch (e) { note = (L.parse_error || 'The text is not a valid table: ') + e.message; }
      if (!rows.length) rows = [Array(n).fill('')];
      render();
    }
    addBtn.onclick = () => { rows.push(Array(n).fill('')); render(); const last = body.querySelector('tr:last-child input'); if (last && last.focus) last.focus(); };
    clearBtn.onclick = () => { rows = [Array(n).fill('')]; render(); commitFromTable(); };
    textarea.addEventListener('input', () => { if (!fromTable) commitFromText(); });
    commitFromText();
    return { element: wrap, text: textFold, refresh: commitFromText, rows: () => rows.map(r => r.slice()), set: next => { rows = next.map(r => r.slice()); render(); commitFromTable(); } };
  }
  const api = { mount, parseText, formatRows };
  host.ZGDataTable = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
