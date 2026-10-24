/* Shared presentation helpers: colourful result tiles and groups, status badges, fold-away long text, and figure explanations.
   Presentation only: no physics, no data. Works with the real DOM and with the minimal fake DOM used in tests (className strings, textContent,
   append, setAttribute; no classList or style objects).
   ZGUI.tile / group / readout     structured results instead of lines of text
   ZGUI.badge(text, tone)          tone: ok | warn | bad | info
   ZGUI.fold(summary, node, open)  <details> with a triangle; long text goes in here
   ZGUI.autoFold(root)             folds long explanatory paragraphs (class zg-muted / zg-small / sp-note / wb-note / wb-intro)
   ZGUI.attachNotes(root)          puts the figure explanation after every element marked data-figure-note="id"
   ZGUI.pills(el)                  turns a status line 'a = 1 · b = 2 · ✔ ok' into coloured pills
   ZGUI.ionText(label)             133Xe[m] +1 -> 133Xem⁺ for plots and legends
   ZGUI.attachSteps(root)          puts a numbered "How to use" list into every element marked data-tool-steps="id" (data/tool_steps.yaml);
                                   {name:X} {act:X} {sel:CSS} in a step are replaced by the visible label of that control in the page language
   ZGUI.notes(id)                  explanation of one figure (title, summary, items) in the page language, from #zg-figure-notes
   ZGUI.notesBlock(id)             the same as a fold-away block for the page; ZGUI.notesLines(id, max) as plain lines for exported figures */
(function (host) {
  'use strict';
  if (host.ZGUI) { if (typeof module === 'object') module.exports = host.ZGUI; return; }
  const doc = () => host.document;
  const make = (tag, className, text) => { const n = doc().createElement(tag); if (className) n.className = className; if (text != null) n.textContent = String(text); return n; };
  const TONES = ['ok', 'warn', 'bad', 'info'];
  const tone = t => TONES.includes(t) ? t : 'info';

  /* One result: small label, large value, optional unit, a visible one-line note and a hint (tooltip). */
  function tile({ k, v, u, tone: t, hint, note }) {
    const n = make('div', 'zg-tile ' + tone(t));
    n.append(make('span', 'k', k), make('span', 'v', v));
    if (u) n.append(make('span', 'u', u));
    if (note) n.append(make('span', 'n', note));
    if (hint) n.setAttribute('title', hint);
    return n;
  }
  function badge(text, t) { return make('span', 'zg-badge ' + tone(t), text); }
  /* A coloured group: heading, then tiles; extra nodes (buttons, notes) can follow. */
  function group(title, t, tiles, extra = [], opts = {}) {
    /* opts.fold: a <details> group; opts.open its state; opts.summary: nodes (pills) shown next to the heading while it is closed */
    const g = make(opts.fold ? 'details' : 'section', 'zg-rgroup ' + tone(t) + (opts.fold ? ' zg-rfold' : ''));
    if (opts.fold) {
      if (opts.open) g.open = true;
      const sum = make('summary'); sum.append(make('h4', '', title), ...(opts.summary || [])); g.append(sum);
    } else g.append(make('h4', '', title));
    const grid = make('div', 'zg-tiles');
    for (const item of tiles) grid.append(item.nodeType ? item : tile(item));
    g.append(grid, ...extra);
    return g;
  }
  function readout(container, nodes) { container.replaceChildren(...nodes); return container; }

  function fold(summary, node, open) {
    const d = make('details', 'zg-fold'), s = make('summary', '', summary);
    if (open) d.open = true;
    d.append(s, node);
    return d;
  }
  /* A plain-text status line 'title: a = 1 · b = 2 · ✔ ok' becomes coloured pills (the ' · ' separators stay in the text, hidden). */
  function pills(el) {
    if (!el || (el.children && el.children.length) || (el.dataset && el.dataset.zgPills === '0')) return false;
    const parts = el.textContent.trim().split(/\s+·\s+/);
    if (parts.length < 3) return false;
    const row = make('span', 'zg-pillrow');
    parts.forEach((part, i) => {
      if (i) row.append(make('span', 'zg-sep', ' · '));
      const tone = /✔|✓|separated|resolved/i.test(part) ? 'ok' : /✘|✗|⚠|not separated|unresolved|overlap/i.test(part) ? 'warn' : '';
      const kv = i ? /^([^=≈:→]{1,30}?)\s*(?:=|≈|:)\s*(.+)$/.exec(part) : null, pill = make('span', 'zg-pill' + (tone ? ' ' + tone : ''));
      if (kv) pill.append(make('span', 'k', kv[1]), make('b', 'v', kv[2])); else pill.append(make(i ? 'span' : 'b', 'v', part));
      row.append(pill);
    });
    el.replaceChildren(row);
    return true;
  }
  /* Display form of an ion label: 133Xe[m] +1 -> 133Xem⁺, 133Cs +2 -> 133Cs²⁺ (state letter after the element, charge as a superscript). */
  const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function ionText(label) {
    const m = /^(.*?)\s*([+-])(\d+)$/.exec(String(label)), q = m ? +m[3] : 0, minus = !!m && m[2] === '-';
    const base = (m ? m[1] : String(label)).replace(/(\d+[A-Za-z]{1,2})\[([A-Za-z0-9]+)\]/g, '$1$2');
    return base + (q > 1 ? [...String(q)].map(c => SUPD[c]).join('') : '') + (q >= 1 ? (minus ? '⁻' : '⁺') : '');
  }
  /* [data-figure-note="id"] on a canvas or its grid: the explanation of that figure follows it as a fold-away block (once). */
  const NOTE_SELECTOR = '[data-figure-note]';
  function attachNotes(root) {
    const scope = root || doc();
    if (!scope.querySelectorAll) return 0;
    const found = [...(scope.matches && scope.matches(NOTE_SELECTOR) ? [scope] : []), ...scope.querySelectorAll(NOTE_SELECTOR)];
    let n = 0;
    for (const el of found) {
      if (el.dataset.zgNoted) continue;
      el.dataset.zgNoted = '1';
      let anchor = el;
      for (const id of el.dataset.figureNote.split(/\s+/).filter(Boolean)) { const block = notesBlock(id); if (block) { anchor.after(block); anchor = block; n++; } }
    }
    return n;
  }
  /* First sentence (at most 90 characters) as the label of a folded paragraph. */
  function lead(text) {
    const t = String(text).replace(/\s+/g, ' ').trim(), m = /^(.{12,90}?[.!?。！？])(\s|$)/.exec(t);
    return m ? m[1] : (t.length > 90 ? t.slice(0, 87).replace(/\s+\S*$/, '') + '…' : t);
  }
  const FOLD_SELECTOR = 'p.zg-muted, p.zg-small, p.sp-note, p.wb-note, p.wb-intro, small.sp-note, .zg-fold-me';
  function autoFold(root) {
    const scope = root || doc();
    if (!scope.querySelectorAll) return 0;
    let n = 0;
    for (const el of scope.querySelectorAll(FOLD_SELECTOR)) {
      if (el.dataset.zgFolded || el.closest('details, [data-no-fold], [role="status"], [role="alert"], nav, footer, .zg-fold, button')) continue;
      const text = el.textContent.trim();
      if (text.length < 170 || !el.closest('.zg-card, .zg-form, main')) continue;
      el.dataset.zgFolded = '1';
      const label = el.dataset.foldLabel || lead(text), wrapper = fold(label, make('div', 'zg-fold-body'));
      /* plain text: the label is its first sentence, so the folded part keeps only the rest */
      if (!el.dataset.foldLabel && !el.children.length && text.startsWith(label) && text.length > label.length + 20) el.textContent = text.slice(label.length).trim();
      el.replaceWith(wrapper);
      wrapper.lastChild.append(el);
      n++;
    }
    return n;
  }

  /* ---- numbered "How to use" steps (data/tool_steps.yaml, one language per page) ---- */
  let stepCache = null;
  function allSteps() {
    if (stepCache) return stepCache;
    stepCache = {};
    try { const n = doc() && doc().getElementById('zg-tool-steps'); if (n) stepCache = JSON.parse(n.textContent); } catch (_) { stepCache = {}; }
    return stepCache;
  }
  /* 'Press {act:shot}.' -> [{text:'Press '}, {ref:'act:shot'}, {text:'.'}] */
  function splitRefs(text) {
    const parts = [], re = /\{(name|act|sel):([^{}]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(text))) { if (m.index > last) parts.push({ text: text.slice(last, m.index) }); parts.push({ ref: m[1] + ':' + m[2] }); last = re.lastIndex; }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  }
  const collapse = t => String(t || '').replace(/\s+/g, ' ').trim();
  /* The visible name of a control: the text of its <label> without the control itself (own text first, so a unit span does not repeat), or the text of a button. */
  function labelOf(el) {
    if (!el) return '';
    const tag = String(el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const label = (el.closest && el.closest('label')) || (el.id && doc().querySelector('label[for="' + el.id + '"]'));
      if (!label) return collapse(el.getAttribute && el.getAttribute('aria-label'));
      const own = collapse([...label.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join(' '));
      if (own) return own;
      const copy = label.cloneNode(true);
      for (const c of [...copy.querySelectorAll('input, select, textarea, output, option, button, details, canvas, svg')]) c.remove();
      return collapse(copy.textContent);
    }
    return collapse(el.textContent);
  }
  function refTarget(ref, container) {
    const i = ref.indexOf(':'), kind = ref.slice(0, i), key = ref.slice(i + 1);
    const css = kind === 'name' ? '[name="' + key + '"]' : kind === 'act' ? '[data-act="' + key + '"]' : key;
    /* the tool itself first, then the enclosing sections (a sub-form such as the rod design shares the point form of its explorer) */
    try { for (let scope = container; scope; scope = scope.parentElement && scope.parentElement.closest('section, [data-local-panel]')) { const found = scope.querySelector(css); if (found) return found; } } catch (_) { /* bad selector */ }
    return null;
  }
  const pendingSteps = new Set();
  /* Fill the {…} placeholders of one steps block from the controls of its tool; controls built later are picked up by the next call. */
  function resolveSteps(block, final) {
    const container = block.closest && block.closest('[data-tool-steps]');
    if (!container) return true;
    let open = 0;
    for (const b of block.querySelectorAll('b[data-ref]')) {
      if (b.dataset.done === '1') continue;
      const label = labelOf(refTarget(b.dataset.ref, container));
      if (label) { b.textContent = label; b.dataset.done = '1'; continue; }
      open++;
      /* a control that is still missing when the page has loaded shows its key until it appears */
      if (final && !b.dataset.done) { b.textContent = b.dataset.ref.replace(/^[a-z]+:/, '').replace(/[^A-Za-z0-9]+/g, ' ').trim(); b.dataset.done = '0'; }
    }
    return open === 0;
  }
  function openState(id, key) { try { return host.localStorage.getItem(key) !== 'closed'; } catch (_) { return true; } }
  function stepsBlock(id) {
    const s = allSteps()[id]; if (!s || !s.steps || !s.steps.length) return null;
    const list = make('ol', 'zg-steps-list');
    for (const text of s.steps) {
      const li = make('li');
      for (const p of splitRefs(text)) { if (p.ref) { const b = make('b', 'zg-ref', ''); b.dataset.ref = p.ref; li.append(b); } else li.append(doc().createTextNode(p.text)); }
      list.append(li);
    }
    const key = 'zg-steps-' + id, block = fold(s.title, list, openState(id, key));
    block.className += ' zg-steps'; block.dataset.stepsId = id;
    block.addEventListener('toggle', () => { try { host.localStorage.setItem(key, block.open ? 'open' : 'closed'); } catch (_) { /* private mode */ } });
    return block;
  }
  /* The steps go right after the first heading of the tool (or the first child when there is none); a tool rebuilt later gets them again. */
  const STEPS_SELECTOR = '[data-tool-steps]';
  function attachSteps(root) {
    const scope = root || doc();
    if (!scope.querySelectorAll) return 0;
    const found = new Set([...(scope.matches && scope.matches(STEPS_SELECTOR) ? [scope] : []), ...scope.querySelectorAll(STEPS_SELECTOR)]);
    const up = scope.closest && scope.closest(STEPS_SELECTOR); if (up) found.add(up);
    let n = 0;
    for (const el of found) {
      const have = [...el.children].find(c => c.dataset && c.dataset.stepsId);
      if (have) { if (pendingSteps.has(have)) resolveSteps(have) && pendingSteps.delete(have); continue; }
      const block = stepsBlock(el.dataset.toolSteps); if (!block) continue;
      const kids = [...el.children], head = kids.find(c => /^(H[1-6]|LEGEND)$/.test(c.tagName)) || kids.find(c => c.tagName === 'P' || c.classList.contains('zg-fold'));
      if (head) head.after(block); else el.prepend(block);
      if (!resolveSteps(block)) pendingSteps.add(block);
      n++;
    }
    return n;
  }
  function settleSteps(final) { for (const b of [...pendingSteps]) if (resolveSteps(b, final)) pendingSteps.delete(b); }

  /* ---- figure explanations (data/figure_notes.yaml, one language per page) ---- */
  let cache = null;
  function allNotes() {
    if (cache) return cache;
    cache = {};
    try { const n = doc() && doc().getElementById('zg-figure-notes'); if (n) cache = JSON.parse(n.textContent); } catch (_) { cache = {}; }
    return cache;
  }
  const notes = id => allNotes()[id] || null;
  function notesBlock(id, open) {
    const n = notes(id); if (!n) return null;
    const body = make('div', 'zg-fig-notes');
    if (n.summary) body.append(make('p', '', n.summary));
    const dl = make('dl', 'zg-defs');
    for (const [sym, text] of n.items || []) dl.append(make('dt', '', sym), make('dd', '', text));
    body.append(dl);
    const block = fold('ⓘ ' + n.title, body, open);
    block.className += ' zg-fig-fold';
    return block;
  }
  /* Plain lines for exported figures: title line, then "symbol: meaning" up to `max` entries. */
  function notesLines(id, max = 6) {
    const n = notes(id); if (!n) return [];
    return [n.title, ...(n.items || []).slice(0, max).map(([s, t]) => s + ': ' + t)];
  }
  const api = { tile, badge, group, readout, fold, lead, autoFold, attachNotes, attachSteps, splitRefs, labelOf, pills, ionText, notes, notesBlock, notesLines, tone, make };
  host.ZGUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (host.document && host.document.addEventListener) {
    const run = () => {
      attachNotes(host.document); attachSteps(host.document); autoFold(host.document);
      if (host.MutationObserver) new host.MutationObserver(changes => { for (const c of changes) for (const n of c.addedNodes) if (n.nodeType === 1) { attachNotes(n); attachSteps(n); autoFold(n); } settleSteps(false); }).observe(host.document.body, { childList: true, subtree: true });
      host.addEventListener('load', () => { attachSteps(host.document); settleSteps(true); });
    };
    if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
  }
})(typeof window === 'object' ? window : globalThis);
