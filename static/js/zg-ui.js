/* Shared presentation helpers: colourful result tiles and groups, status badges, fold-away long text, and figure explanations.
   Presentation only: no physics, no data. Works with the real DOM and with the minimal fake DOM used in tests (className strings, textContent,
   append, setAttribute; no classList or style objects).
   ZGUI.tile / group / readout     structured results instead of lines of text
   ZGUI.badge(text, tone)          tone: ok | warn | bad | info
   ZGUI.fold(summary, node, open)  <details> with a triangle; long text goes in here
   ZGUI.autoFold(root)             folds long explanatory paragraphs (class zg-muted / zg-small / sp-note / wb-note / wb-intro)
   ZGUI.attachNotes(root)          puts the figure explanation after every element marked data-figure-note="id"
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
  function group(title, t, tiles, extra = []) {
    const g = make('section', 'zg-rgroup ' + tone(t));
    g.append(make('h4', '', title));
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
      el.replaceWith(wrapper);
      wrapper.lastChild.append(el);
      n++;
    }
    return n;
  }

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
  const api = { tile, badge, group, readout, fold, lead, autoFold, attachNotes, notes, notesBlock, notesLines, tone, make };
  host.ZGUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (host.document && host.document.addEventListener) {
    const run = () => {
      attachNotes(host.document); autoFold(host.document);
      if (host.MutationObserver) new host.MutationObserver(changes => { for (const c of changes) for (const n of c.addedNodes) if (n.nodeType === 1) { attachNotes(n); autoFold(n); } }).observe(host.document.body, { childList: true, subtree: true });
    };
    if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
  }
})(typeof window === 'object' ? window : globalThis);
