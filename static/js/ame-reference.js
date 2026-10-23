/* Reference isotope helper: atomic mass, mass excess, binding energy, separation energies and Q values of one nuclide from the published
   AME2020 tables (static/data/research-cache/ame2020-reference.json, tools/make_ame_reference.py), plus a small binder that fills ordinary
   number inputs from it while a checkbox is ticked. Editing a filled input by hand unticks the box, so the visitor's own value is never
   overwritten. Units: keV, u (u = 931494.10242 keV, CODATA 2018 as in AME2020), keV per nucleon for B/A. Uncertainties are the published ones. */
(() => {
  'use strict';
  const U_KEV = 931494.10242, ELECTRON_U = 5.48579909065e-4;
  const norm = s => { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };

  /* "48Ca", "48 Ca", "48-Ca", "Ca48", "Ca-48", "ca 48" -> { symbol, A } ; null when the text is not an isotope label */
  function parseIsotope(text) {
    const s = String(text ?? '').trim();
    let m = /^(\d{1,3})\s*[- ]?\s*([A-Za-z]{1,2})$/.exec(s);
    if (m) return { symbol: norm(m[2]), A: Number(m[1]) };
    m = /^([A-Za-z]{1,2})\s*[- ]?\s*(\d{1,3})$/.exec(s);
    return m ? { symbol: norm(m[1]), A: Number(m[2]) } : null;
  }

  function fromJson(json) {
    const c = Object.fromEntries(json.columns.map((n, i) => [n, i])), byKey = new Map(), bySymbol = new Map();
    for (const r of json.rows) { byKey.set(r[0] + ',' + r[1], r); if (!bySymbol.has(r[2]) || r[2] === 'n' || r[0] > 0) bySymbol.set(r[2], r[0]); }
    const q = (row, name) => !row || row[c[name]] == null ? null : { v: row[c[name]], s: row[c[name + '_s']], est: row[c[name + '_x']] === 1 };
    const rowOf = (Z, A) => byKey.get(Z + ',' + (A - Z)) || null;
    function lookup(symbol, A) {
      const Z = bySymbol.get(norm(symbol)); if (Z === undefined) return null;
      const row = rowOf(Z, A); return row ? { Z, A, N: A - Z, symbol: row[2], row } : null;
    }
    /* All quantities of one nuclide. Each is { v, s, est } or null when AME2020 does not publish it. */
    function info(symbol, A) {
      const rec = lookup(symbol, A); if (!rec) return null;
      const { row, Z } = rec, me = q(row, 'me'), bea = q(row, 'bea'), below = rowOf(Z - 1, A);
      const qbmBelow = q(below, 'qbm');
      return {
        label: A + rec.symbol, symbol: rec.symbol, Z, N: rec.N, A,
        massExcessKeV: me,
        atomicMassU: me && { v: A + me.v / U_KEV, s: me.s == null ? null : me.s / U_KEV, est: me.est },
        bindingPerNucleonKeV: bea,
        bindingKeV: bea && { v: A * bea.v, s: bea.s == null ? null : A * bea.s, est: bea.est },   // A x published B/A, as in the reactions file
        sn: q(row, 'sn'), s2n: q(row, 's2n'), sp: q(row, 'sp'), s2p: q(row, 's2p'),
        qbm: q(row, 'qbm'), qa: q(row, 'qa'), q2bm: q(row, 'q2bm'),
        qec: qbmBelow && { v: -qbmBelow.v, s: qbmBelow.s, est: qbmBelow.est },                  // Q(EC) of (Z, A) = -Q(beta-) of (Z-1, A), published
      };
    }
    return { lookup, info, count: json.rows.length, meta: json.meta };
  }

  /* number of electrons removed: the ion mass is the atomic mass minus q electron masses (electron binding energies are neglected) */
  const ionMassU = (infoObj, q) => infoObj && infoObj.atomicMassU ? { ...infoObj.atomicMassU, v: infoObj.atomicMassU.v - q * ELECTRON_U } : null;

  /* keys that a bound input may request */
  const KEYS = {
    massU: i => i.atomicMassU, massU_s: i => i.atomicMassU && { v: i.atomicMassU.s },
    massExcessKeV: i => i.massExcessKeV, massExcessKeV_s: i => i.massExcessKeV && { v: i.massExcessKeV.s },
    bindingKeV: i => i.bindingKeV, bindingKeV_s: i => i.bindingKeV && { v: i.bindingKeV.s },
    bindingPerNucleonKeV: i => i.bindingPerNucleonKeV, bindingPerNucleonKeV_s: i => i.bindingPerNucleonKeV && { v: i.bindingPerNucleonKeV.s },
    A: i => ({ v: i.A }), sn: i => i.sn, sp: i => i.sp, s2n: i => i.s2n, s2p: i => i.s2p, qbm: i => i.qbm, qec: i => i.qec, qa: i => i.qa,
  };
  const digits = (v, n) => String(Number(Number(v).toPrecision(n)));

  /* o = { load: () => Promise<ref>, isotope: <input text>, check: <input checkbox>, fields: [{ el, key, ion }], charge: <input> | null, status: <element>,
           text: { loading, missing, user, source, estimated }, onFill?: (info) => void }.  Returns { refill }.  The result of every fill is a plain 'input' event, so a
           host that clears stale output on input keeps working. */
  function bind(o) {
    let ref = null, loading = null, filling = false, generation = 0;
    const T = Object.assign({ loading: 'loading AME2020 …', missing: 'not in AME2020', user: 'your own values', source: 'AME2020', estimated: 'estimated (#)' }, o.text || {});
    const say = s => { if (o.status) o.status.textContent = s; };
    async function refill() {
      const request = ++generation, isotope = o.isotope.value, charge = o.charge ? o.charge.value : null;
      const current = () => request === generation && o.check.checked && o.isotope.value === isotope && (!o.charge || o.charge.value === charge);
      if (!o.check.checked) { say(T.user); return; }
      try {
        if (!ref) {
          say(T.loading);
          if (!loading) loading = Promise.resolve().then(() => o.load()).then(value => { ref = value; loading = null; return value; }, error => { loading = null; throw error; });
          await loading;
        }
      } catch (e) { if (current()) say(String(e && e.message || e)); return; }
      // Fetching the shared table must never overwrite a newer request or an
      // own value entered while the promise was pending, even if no event fired.
      if (!current()) return;
      const p = parseIsotope(isotope), i = p && ref.info(p.symbol, p.A);
      if (!i) { say(p ? T.missing + ': ' + isotope.trim() : T.missing); return; }
      const q = o.charge ? Number(charge) : 0; let est = false;
      filling = true;
      try {
        for (const f of o.fields) {
          if (!current()) return;
          let x = f.ion ? ionMassU(i, Number.isFinite(q) ? q : 0) : (KEYS[f.key] || (() => null))(i);
          if (f.key.endsWith('_s') && x && x.v == null) x = null;
          if (!x || x.v == null || !Number.isFinite(x.v)) { f.el.value = ''; continue; }
          f.el.value = digits(x.v, f.key.endsWith('_s') ? 3 : 12); est = est || !!x.est;
          f.el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } finally { filling = false; }
      if (!current()) return;
      say(T.source + ' · ' + i.label + (est ? ' · ' + T.estimated : ''));
      if (o.onFill) o.onFill(i);
    }
    const edited = () => { if (!filling) { generation++; if (o.check.checked) o.check.checked = false; say(T.user); } };
    o.fields.forEach(f => f.el.addEventListener('input', edited));
    o.isotope.addEventListener('input', refill); o.isotope.addEventListener('change', refill);
    o.check.addEventListener('input', refill); o.check.addEventListener('change', refill);
    if (o.charge) o.charge.addEventListener('input', () => { if (o.fields.some(f => f.ion)) refill(); });
    return { refill };
  }

  /* One dictionary for every page (research tools, Lab calculators): [en, zh, fi, de, ja, fr]. */
  const LANGS = ['en', 'zh', 'fi', 'de', 'ja', 'fr'];
  const LABELS = Object.freeze({
    ame_use: ["Use AME2020 values", "使用 AME2020 数值", "Käytä AME2020-arvoja", "AME2020-Werte verwenden", "AME2020 の値を使う", "Utiliser les valeurs AME2020"],
    ame_isotope: ["Isotope (e.g. 42Ca)", "同位素（如 42Ca）", "Isotooppi (esim. 42Ca)", "Isotop (z. B. 42Ca)", "同位体（例：42Ca）", "Isotope (p. ex. 42Ca)"],
    ame_ref_isotope: ["Reference isotope (e.g. 40Ca)", "参考同位素（如 40Ca）", "Vertailuisotooppi (esim. 40Ca)", "Referenzisotop (z. B. 40Ca)", "参照同位体（例：40Ca）", "Isotope de référence (p. ex. 40Ca)"],
    ame_loading: ["Loading AME2020 …", "正在载入 AME2020 …", "Ladataan AME2020 …", "AME2020 wird geladen …", "AME2020 を読み込み中 …", "Chargement d’AME2020 …"],
    ame_missing: ["Not in AME2020", "AME2020 中没有", "Ei AME2020:ssä", "Nicht in AME2020", "AME2020 にありません", "Absent d’AME2020"],
    ame_user: ["your own values (tick the box to refill from AME2020)", "您自己的数值（勾选后重新从 AME2020 填入）", "omat arvosi (valitse ruutu täyttääksesi uudelleen AME2020:sta)", "Ihre eigenen Werte (Häkchen setzen, um neu aus AME2020 zu füllen)", "独自の値（チェックすると AME2020 から再入力）", "vos propres valeurs (cochez pour remplir à nouveau depuis AME2020)"],
    ame_est: ["includes extrapolated (#) values", "含外推值 (#)", "sisältää ekstrapoloituja (#) arvoja", "enthält extrapolierte (#) Werte", "外挿値 (#) を含む", "contient des valeurs extrapolées (#)"],
    ame_failed: ["The AME2020 table could not be loaded", "无法载入 AME2020 表", "AME2020-taulukkoa ei voitu ladata", "Die AME2020-Tabelle konnte nicht geladen werden", "AME2020 表を読み込めませんでした", "Impossible de charger la table AME2020"],
    ame_hint: ["Type an isotope: mass and uncertainty fill in from AME2020. Edit any number to use your own value.", "输入同位素即可从 AME2020 填入质量及不确定度；修改任一数值即改用您自己的数值。", "Kirjoita isotooppi: massa ja epävarmuus täytetään AME2020:sta. Muokkaa mitä tahansa lukua käyttääksesi omaa arvoasi.", "Isotop eingeben: Masse und Unsicherheit werden aus AME2020 gefüllt. Jede Zahl ändern, um den eigenen Wert zu nutzen.", "同位体を入力すると質量と不確かさが AME2020 から入ります。数値を編集すると独自の値になります。", "Saisissez un isotope : la masse et l’incertitude viennent d’AME2020. Modifiez un nombre pour utiliser votre propre valeur."],
    ame_card: ["Reference isotope · AME2020 masses and energies", "参考同位素 · AME2020 质量与能量", "Vertailuisotooppi · AME2020-massat ja energiat", "Referenzisotop · AME2020-Massen und Energien", "参照同位体 · AME2020 の質量とエネルギー", "Isotope de référence · masses et énergies AME2020"],
    ame_atomic_mass: ["Atomic mass / u", "原子质量 / u", "Atomimassa / u", "Atommasse / u", "原子質量 / u", "Masse atomique / u"],
    ame_me: ["Mass excess / keV", "质量过剩 / keV", "Massaylijäämä / keV", "Massenüberschuss / keV", "質量過剰 / keV", "Excès de masse / keV"],
    ame_be: ["Total binding energy / keV", "总结合能 / keV", "Kokonaissidosenergia / keV", "Gesamtbindungsenergie / keV", "全結合エネルギー / keV", "Énergie de liaison totale / keV"],
    ame_bea: ["Binding energy per nucleon / keV", "比结合能 / keV", "Sidosenergia nukleonia kohti / keV", "Bindungsenergie pro Nukleon / keV", "核子あたりの結合エネルギー / keV", "Énergie de liaison par nucléon / keV"],
    ame_value: ["Value ± published uncertainty", "数值 ± 公布的不确定度", "Arvo ± julkaistu epävarmuus", "Wert ± veröffentlichte Unsicherheit", "値 ± 公表された不確かさ", "Valeur ± incertitude publiée"],
    ame_card_note: ["Published AME2020 values and uncertainties; # marks values extrapolated from systematics. Separation energies and Q values carry their own published uncertainties, not an independent combination of mass-excess errors.", "AME2020 公布的数值与不确定度；# 表示由系统性外推的数值。分离能和 Q 值使用各自公布的不确定度，而不是质量过剩误差的独立组合。", "Julkaistut AME2020-arvot ja epävarmuudet; # merkitsee systematiikasta ekstrapoloituja arvoja. Erotusenergioilla ja Q-arvoilla on omat julkaistut epävarmuutensa, ei massaylijäämävirheiden riippumatonta yhdistelmää.", "Veröffentlichte AME2020-Werte und Unsicherheiten; # kennzeichnet aus der Systematik extrapolierte Werte. Separationsenergien und Q-Werte tragen ihre eigenen veröffentlichten Unsicherheiten, nicht eine unabhängige Kombination von Massenüberschuss-Fehlern.", "AME2020 の公表値と不確かさ。# は系統性からの外挿値。分離エネルギーと Q 値には、質量過剰の誤差を独立に合成したものではなく、公表された不確かさを使います。", "Valeurs et incertitudes publiées d’AME2020 ; # marque les valeurs extrapolées de la systématique. Les énergies de séparation et les valeurs Q portent leurs propres incertitudes publiées, et non une combinaison indépendante des erreurs d’excès de masse."],
    ame_use_in_calc: ["Use as reference in the isotope-shift calculator", "用作同位素位移计算器的参考", "Käytä vertailuna isotooppisiirtymälaskurissa", "Als Referenz im Isotopieverschiebungsrechner verwenden", "同位体シフト計算機の参照として使う", "Utiliser comme référence dans le calculateur de déplacement isotopique"],
    ame_hint_off: ["Type an isotope and tick the box to fill the value from AME2020; a number you type yourself stays as it is.", "输入同位素并勾选，即可从 AME2020 填入数值；您自己输入的数值保持不变。", "Kirjoita isotooppi ja valitse ruutu täyttääksesi arvon AME2020:sta; itse kirjoittamasi luku pysyy ennallaan.", "Isotop eingeben und Häkchen setzen, um den Wert aus AME2020 zu füllen; eine selbst eingegebene Zahl bleibt unverändert.", "同位体を入力してチェックすると、値が AME2020 から入ります。自分で入力した数値はそのまま残ります。", "Saisissez un isotope et cochez la case pour remplir la valeur depuis AME2020 ; un nombre saisi par vous reste inchangé."],
    ame_converter_card: ["AME2020 values of this isotope", "该同位素的 AME2020 数值", "Tämän isotoopin AME2020-arvot", "AME2020-Werte dieses Isotops", "この同位体の AME2020 の値", "Valeurs AME2020 de cet isotope"],
  });
  const translator = lang => { const i = Math.max(0, LANGS.indexOf(String(lang || 'en').slice(0, 2).toLowerCase())); return k => (LABELS[k] && LABELS[k][i]) || (LABELS[k] && LABELS[k][0]) || k; };

  /* Value ± published uncertainty as text; '#' marks an extrapolated AME2020 value. */
  const sig = (v, n) => String(Number(Number(v).toPrecision(n)));
  const valueText = (x, n) => !x || x.v == null ? '—' : sig(x.v, n) + (x.s != null ? ' ± ' + sig(x.s, 2) : '') + (x.est ? ' #' : '');
  /* Table rows [quantity, "value ± uncertainty"] for one isotope info(); t(key) translates the quantity names. */
  const rows = (i, t) => [
    [t('ame_atomic_mass'), valueText(i.atomicMassU, 12)], [t('ame_me'), valueText(i.massExcessKeV, 10)], [t('ame_be'), valueText(i.bindingKeV, 10)],
    [t('ame_bea'), valueText(i.bindingPerNucleonKeV, 9)], ['S(n) / keV', valueText(i.sn, 9)], ['S(2n) / keV', valueText(i.s2n, 9)], ['S(p) / keV', valueText(i.sp, 9)],
    ['S(2p) / keV', valueText(i.s2p, 9)], ['Q(β⁻) / keV', valueText(i.qbm, 9)], ['Q(EC) / keV', valueText(i.qec, 9)], ['Q(α) / keV', valueText(i.qa, 9)], ['Q(2β⁻) / keV', valueText(i.q2bm, 9)],
  ];

  /* The same control row everywhere: isotope text, "Use AME2020 values" checkbox, status line. It is inserted after `after` and wired with bind().
     o = { doc, t, load, name, label, iso, fields, charge, defaultOn = true, onFill, rowClass }.  Inline styles keep it independent of any theme sheet. */
  function mountRow(after, o) {
    const d = o.doc, h = (tag, text, attrs = {}) => { const e = d.createElement(tag); if (text != null) e.textContent = text; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
    const on = o.defaultOn !== false, row = h('div', null, { class: o.rowClass || 'sp-controls sp-ame-row' }), lab = h('label', o.label);
    const iso = h('input', null, { type: 'text', value: o.iso || '', spellcheck: 'false', autocomplete: 'off', 'aria-label': o.label }); if (o.name) iso.setAttribute('name', o.name);
    const cl = h('label', null, { style: 'display:flex;flex-direction:row;align-items:center;gap:.5rem;align-self:end;padding-bottom:.6rem' });
    const check = h('input', null, { type: 'checkbox', style: 'width:1.2rem;height:1.2rem;margin:0' }); check.checked = on; if (o.name) check.setAttribute('name', o.name + '-use-ame');
    const status = h('small', o.t(on ? 'ame_hint' : 'ame_hint_off'), { class: 'sp-note', role: 'status', 'aria-live': 'polite', style: 'flex:1 1 14rem;align-self:end' });
    lab.append(iso); cl.append(check, d.createTextNode(' ' + o.t('ame_use'))); row.append(lab, cl, status); after.after(row);
    const b = bind({ load: o.load, isotope: iso, check, fields: o.fields, charge: o.charge || null, status, onFill: o.onFill,
      text: { loading: o.t('ame_loading'), missing: o.t('ame_missing'), user: o.t('ame_user'), source: 'AME2020', estimated: o.t('ame_est') } });
    return { row, iso, check, status, refill: b.refill };
  }

  const api = Object.freeze({ U_KEV, ELECTRON_U, LABELS, translator, parseIsotope, fromJson, ionMassU, bind, rows, valueText, mountRow });
  if (typeof window !== 'undefined') window.TrapsAmeReference = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
