/* Lab calculators: reference-isotope rows that fill masses from the published AME2020 table (static/js/ame-reference.js), unticking themselves
   when the visitor types a number. Cyclotron frequency (atomic mass), "Can I resolve them?" (m1, m2) and the mass unit converter (value, A). */
(() => {
  'use strict';
  const AR = window.TrapsAmeReference, me = document.currentScript, url = me && me.dataset.ameUrl;
  if (!AR || !url) return;
  const t = AR.translator(document.documentElement.lang);
  let job = null;
  const load = () => job || (job = fetch(url).then(r => { if (!r.ok) throw Error(t('ame_failed')); return r.json(); }).then(AR.fromJson).catch(e => { job = null; throw e; }));
  const $ = id => document.getElementById(id), form = id => $(id) && $(id).closest('.zg-form');
  const PRESET_ISOTOPE = { '132.905451961': '133Cs', '84.911789738': '85Rb', '12': '12C', '99.9385': '100Sn', '238.0507884': '238U' };

  function boot() {
    const common = { doc: document, t, load, rowClass: 'zg-form zg-ame-row' };
    if (form('zg-c-m')) {
      const r = AR.mountRow(form('zg-c-m'), { ...common, name: 'cyclotron-isotope', label: t('ame_isotope'), iso: '133Cs', fields: [{ el: $('zg-c-m'), key: 'massU' }] });
      $('zg-c-preset').addEventListener('change', function () { const iso = PRESET_ISOTOPE[this.value]; if (iso) { r.iso.value = iso; r.check.checked = true; r.refill(); } });
    }
    if (form('zg-r-m1')) {
      const second = AR.mountRow(form('zg-r-m1'), { ...common, name: 'resolve-isotope-2', label: t('ame_isotope') + ' · m₂', iso: '', defaultOn: false, fields: [{ el: $('zg-r-m2'), key: 'massU' }] });
      AR.mountRow(form('zg-r-m1'), { ...common, name: 'resolve-isotope-1', label: t('ame_isotope') + ' · m₁', iso: '', defaultOn: false, fields: [{ el: $('zg-r-m1'), key: 'massU' }] });
      void second;
    }
    if (form('zg-u-v')) {
      const card = document.createElement('details'), summary = document.createElement('summary'), table = document.createElement('table');
      summary.textContent = t('ame_converter_card'); table.className = 'zg-table'; card.hidden = true; card.className = 'zg-ame-card'; card.append(summary, table); $('zg-u-status').after(card);
      const r = AR.mountRow(form('zg-u-v'), { ...common, name: 'converter-isotope', label: t('ame_isotope'), iso: '', defaultOn: false,
        fields: [{ el: $('zg-u-v'), key: 'massU' }, { el: $('zg-u-a'), key: 'A' }],
        onFill: info => {
          $('zg-u-unit').value = 'u'; $('zg-u-unit').dispatchEvent(new Event('input', { bubbles: true }));
          table.replaceChildren(...AR.rows(info, t).map(([q, v]) => { const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td'); th.textContent = q; td.textContent = v; tr.append(th, td); return tr; }));
          card.hidden = false;
        } });
      r.check.addEventListener('change', () => { if (!r.check.checked) card.hidden = true; });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
