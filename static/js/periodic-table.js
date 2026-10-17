/* Periodic-table panel (Games page). Logic: periodic-table-core.js; data: data/periodic-table.json. Panel languages: en zh fi de ja fr. */
(() => {
  'use strict';
  const P = window.ZGPeriodicTable, root = document.querySelector('[data-periodic-table]');
  if (!P || !root) return;
  const LANGS = [['en', 'English'], ['zh', '中文'], ['fi', 'Suomi'], ['de', 'Deutsch'], ['ja', '日本語'], ['fr', 'Français']];
  const UI = {
    en: {tab_table: 'Table', tab_origins: 'Origins', tab_game: 'Find the element', tab_defs: 'Definitions', tab_iso: 'Isotopes', tab_trend: 'Trends', tab_trendz: 'Trends by Z', tab_sources: 'Sources',
      language: 'Language', scheme: 'Colour by', sch_block: 'Chemical block', sch_origin: 'Origin', sch_state: 'State', sch_heat: 'Property heat map', show: 'Show in cells', none_prop: '— symbol only —', unit: 'Unit', fullnames: 'Full names', logscale: 'Log scale', search: 'Search symbol, name or Z', cell: 'Cell size',
      legend_hint: 'Click a class to highlight it', n_el: '{n} elements', all_props: 'All properties', close: 'Close', missing: 'no data', pick_hint: 'Click an element', trace_el: 'Trace only', sel: 'Selected',
      find_target: 'Find', score: 'Score', rounds: 'Found', start: 'Start', stop: 'Stop', timer: 'Timer', seconds: 'Seconds', time_up: 'Time is up!', right: 'Right!', wrong: 'Not quite.', idle: 'Press Start, then click the element.',
      og_title: 'Origin highlight game', og_mode_select: 'Click them all', og_mode_which: 'Which source?', og_select: 'Click every element made (also) by', og_which: 'Which source helped make this element?', og_new: 'New round', og_found: 'Found {n} of {m}', og_done: 'All found!', og_next: 'Next', og_truth: 'Sources of {el}',
      tr_group: 'Group', tr_period: 'Period', tr_index: 'Number', tr_prop: 'Property', tr_lines: 'Lines', tr_log: 'Log y', tr_copy: 'Copy CSV', tr_copied: 'Copied', tr_x_el: 'Element', tr_x_z: 'Proton number Z', tr_gaps: 'No data for: {list}',
      iso_pick: 'Element', iso_none: 'No stable isotopes.', iso_y: 'Natural abundance (%)', iso_sum: 'Sum: {s} %',
      src_caveat: 'Origin classes are qualitative (after Johnson, OSU) and show which processes contribute, not how much. The r-process site is still debated. Ionisation energy and electron affinity are in eV; kJ/mol = eV × 96.485.', src_fixes: 'Corrections to the Mulberry GUI data', src_list: 'Sources', prop_label: 'Property'},
    zh: {tab_table: '周期表', tab_origins: '起源', tab_game: '找元素', tab_defs: '定义', tab_iso: '同位素', tab_trend: '趋势', tab_trendz: '按质子数', tab_sources: '来源',
      language: '语言', scheme: '着色方式', sch_block: '化学族块', sch_origin: '起源', sch_state: '物态', sch_heat: '性质热图', show: '格内显示', none_prop: '— 仅符号 —', unit: '单位', fullnames: '显示全名', logscale: '对数刻度', search: '搜索符号、名称或 Z', cell: '格子大小',
      legend_hint: '点击类别以高亮', n_el: '{n} 个元素', all_props: '全部性质', close: '关闭', missing: '无数据', pick_hint: '点击一个元素', trace_el: '仅痕量', sel: '已选',
      find_target: '找', score: '得分', rounds: '已找到', start: '开始', stop: '停止', timer: '计时', seconds: '秒数', time_up: '时间到！', right: '答对了！', wrong: '差一点。', idle: '点击“开始”，然后点出该元素。',
      og_title: '元素起源高亮游戏', og_mode_select: '全部点出', og_mode_which: '哪个来源？', og_select: '点出所有（也）由下列过程产生的元素：', og_which: '哪个来源参与产生了这个元素？', og_new: '新一轮', og_found: '已找到 {n} / {m}', og_done: '全部找到！', og_next: '下一个', og_truth: '{el} 的来源',
      tr_group: '族', tr_period: '周期', tr_index: '编号', tr_prop: '性质', tr_lines: '连线', tr_log: 'y 取对数', tr_copy: '复制 CSV', tr_copied: '已复制', tr_x_el: '元素', tr_x_z: '质子数 Z', tr_gaps: '无数据：{list}',
      iso_pick: '元素', iso_none: '没有稳定同位素。', iso_y: '天然丰度 (%)', iso_sum: '总和：{s} %',
      src_caveat: '起源类别是定性的（依据 Johnson，OSU），只表示有哪些过程贡献，不表示贡献多少。r 过程的发生地点仍有争议。电离能和电子亲和能以 eV 为单位；kJ/mol = eV × 96.485。', src_fixes: '对 Mulberry GUI 数据的修正', src_list: '来源', prop_label: '性质'},
    fi: {tab_table: 'Taulukko', tab_origins: 'Alkuperä', tab_game: 'Etsi alkuaine', tab_defs: 'Määritelmät', tab_iso: 'Isotoopit', tab_trend: 'Trendit', tab_trendz: 'Trendit Z:n mukaan', tab_sources: 'Lähteet',
      language: 'Kieli', scheme: 'Väritys', sch_block: 'Kemiallinen lohko', sch_origin: 'Alkuperä', sch_state: 'Olomuoto', sch_heat: 'Ominaisuuden lämpökartta', show: 'Näytä ruuduissa', none_prop: '— vain symboli —', unit: 'Yksikkö', fullnames: 'Koko nimet', logscale: 'Logaritminen asteikko', search: 'Hae symbolia, nimeä tai Z:aa', cell: 'Ruudun koko',
      legend_hint: 'Napsauta luokkaa korostaaksesi', n_el: '{n} alkuainetta', all_props: 'Kaikki ominaisuudet', close: 'Sulje', missing: 'ei tietoa', pick_hint: 'Napsauta alkuainetta', trace_el: 'Vain jälkiä', sel: 'Valittu',
      find_target: 'Etsi', score: 'Pisteet', rounds: 'Löydetty', start: 'Aloita', stop: 'Lopeta', timer: 'Ajastin', seconds: 'Sekuntia', time_up: 'Aika loppui!', right: 'Oikein!', wrong: 'Ei aivan.', idle: 'Paina Aloita ja napsauta alkuainetta.',
      og_title: 'Alkuperän korostuspeli', og_mode_select: 'Napsauta kaikki', og_mode_which: 'Mikä lähde?', og_select: 'Napsauta jokainen alkuaine, jonka (myös) tämä synnytti:', og_which: 'Mikä lähde auttoi synnyttämään tämän alkuaineen?', og_new: 'Uusi kierros', og_found: 'Löydetty {n} / {m}', og_done: 'Kaikki löytyi!', og_next: 'Seuraava', og_truth: '{el}: lähteet',
      tr_group: 'Ryhmä', tr_period: 'Jakso', tr_index: 'Numero', tr_prop: 'Ominaisuus', tr_lines: 'Viivat', tr_log: 'Log y', tr_copy: 'Kopioi CSV', tr_copied: 'Kopioitu', tr_x_el: 'Alkuaine', tr_x_z: 'Protoniluku Z', tr_gaps: 'Ei tietoa: {list}',
      iso_pick: 'Alkuaine', iso_none: 'Ei vakaita isotooppeja.', iso_y: 'Luonnollinen runsaus (%)', iso_sum: 'Summa: {s} %',
      src_caveat: 'Alkuperäluokat ovat laadullisia (Johnsonin mukaan, OSU): ne kertovat mitkä prosessit vaikuttavat, eivät kuinka paljon. R-prosessin paikasta kiistellään yhä. Ionisaatioenergia ja elektroniaffiniteetti ovat eV:nä; kJ/mol = eV × 96,485.', src_fixes: 'Korjaukset Mulberry-GUI:n tietoihin', src_list: 'Lähteet', prop_label: 'Ominaisuus'},
    de: {tab_table: 'Tabelle', tab_origins: 'Herkunft', tab_game: 'Element finden', tab_defs: 'Definitionen', tab_iso: 'Isotope', tab_trend: 'Trends', tab_trendz: 'Trends nach Z', tab_sources: 'Quellen',
      language: 'Sprache', scheme: 'Färben nach', sch_block: 'Chemischer Block', sch_origin: 'Herkunft', sch_state: 'Aggregatzustand', sch_heat: 'Eigenschafts-Heatmap', show: 'In Zellen zeigen', none_prop: '— nur Symbol —', unit: 'Einheit', fullnames: 'Volle Namen', logscale: 'Logarithmische Skala', search: 'Symbol, Name oder Z suchen', cell: 'Zellgröße',
      legend_hint: 'Klasse anklicken, um sie hervorzuheben', n_el: '{n} Elemente', all_props: 'Alle Eigenschaften', close: 'Schließen', missing: 'keine Daten', pick_hint: 'Element anklicken', trace_el: 'Nur Spuren', sel: 'Ausgewählt',
      find_target: 'Finde', score: 'Punkte', rounds: 'Gefunden', start: 'Start', stop: 'Stopp', timer: 'Timer', seconds: 'Sekunden', time_up: 'Zeit ist um!', right: 'Richtig!', wrong: 'Knapp daneben.', idle: 'Start drücken und das Element anklicken.',
      og_title: 'Herkunfts-Hervorhebungsspiel', og_mode_select: 'Alle anklicken', og_mode_which: 'Welche Quelle?', og_select: 'Klicke jedes Element an, das (auch) entstand durch:', og_which: 'Welche Quelle hat dieses Element mit erzeugt?', og_new: 'Neue Runde', og_found: 'Gefunden {n} von {m}', og_done: 'Alle gefunden!', og_next: 'Weiter', og_truth: 'Quellen von {el}',
      tr_group: 'Gruppe', tr_period: 'Periode', tr_index: 'Nummer', tr_prop: 'Eigenschaft', tr_lines: 'Linien', tr_log: 'Log y', tr_copy: 'CSV kopieren', tr_copied: 'Kopiert', tr_x_el: 'Element', tr_x_z: 'Ordnungszahl Z', tr_gaps: 'Keine Daten für: {list}',
      iso_pick: 'Element', iso_none: 'Keine stabilen Isotope.', iso_y: 'Natürliche Häufigkeit (%)', iso_sum: 'Summe: {s} %',
      src_caveat: 'Die Herkunftsklassen sind qualitativ (nach Johnson, OSU): Sie zeigen, welche Prozesse beitragen, nicht wie stark. Der Ort des r-Prozesses ist weiter umstritten. Ionisierungsenergie und Elektronenaffinität sind in eV; kJ/mol = eV × 96,485.', src_fixes: 'Korrekturen an den Daten der Mulberry-GUI', src_list: 'Quellen', prop_label: 'Eigenschaft'},
    ja: {tab_table: '周期表', tab_origins: '起源', tab_game: '元素探し', tab_defs: '用語', tab_iso: '同位体', tab_trend: '傾向', tab_trendz: '原子番号別', tab_sources: '出典',
      language: '言語', scheme: '色分け', sch_block: '化学ブロック', sch_origin: '起源', sch_state: '状態', sch_heat: '物性ヒートマップ', show: 'セルに表示', none_prop: '— 記号のみ —', unit: '単位', fullnames: '元素名を表示', logscale: '対数目盛', search: '記号・名前・Zで検索', cell: 'セルの大きさ',
      legend_hint: '分類をクリックして強調', n_el: '{n} 元素', all_props: 'すべての物性', close: '閉じる', missing: 'データなし', pick_hint: '元素をクリック', trace_el: '痕跡量のみ', sel: '選択中',
      find_target: '探す', score: '得点', rounds: '発見', start: '開始', stop: '停止', timer: 'タイマー', seconds: '秒', time_up: '時間切れ！', right: '正解！', wrong: 'おしい。', idle: '「開始」を押して、その元素をクリックしてください。',
      og_title: '起源ハイライトゲーム', og_mode_select: '全部クリック', og_mode_which: 'どの起源？', og_select: '次の起源で（も）作られた元素をすべてクリック：', og_which: 'この元素の生成に関わった起源はどれ？', og_new: '新しいラウンド', og_found: '{m} 個中 {n} 個発見', og_done: '全部見つけた！', og_next: '次へ', og_truth: '{el} の起源',
      tr_group: '族', tr_period: '周期', tr_index: '番号', tr_prop: '物性', tr_lines: '線', tr_log: 'y対数', tr_copy: 'CSVをコピー', tr_copied: 'コピーしました', tr_x_el: '元素', tr_x_z: '原子番号 Z', tr_gaps: 'データなし：{list}',
      iso_pick: '元素', iso_none: '安定同位体はありません。', iso_y: '天然存在比 (%)', iso_sum: '合計：{s} %',
      src_caveat: '起源の分類は定性的（Johnson、OSUに基づく）で、どの過程が寄与するかを示し、寄与の大きさは示しません。r過程の場所は今も議論中です。イオン化エネルギーと電子親和力は eV 単位で、kJ/mol = eV × 96.485 です。', src_fixes: 'Mulberry GUI データの修正', src_list: '出典', prop_label: '物性'},
    fr: {tab_table: 'Tableau', tab_origins: 'Origines', tab_game: 'Trouver l’élément', tab_defs: 'Définitions', tab_iso: 'Isotopes', tab_trend: 'Tendances', tab_trendz: 'Tendances selon Z', tab_sources: 'Sources',
      language: 'Langue', scheme: 'Colorier par', sch_block: 'Bloc chimique', sch_origin: 'Origine', sch_state: 'État', sch_heat: 'Carte thermique d’une propriété', show: 'Afficher dans les cases', none_prop: '— symbole seul —', unit: 'Unité', fullnames: 'Noms complets', logscale: 'Échelle log', search: 'Chercher symbole, nom ou Z', cell: 'Taille des cases',
      legend_hint: 'Cliquez sur une classe pour la mettre en évidence', n_el: '{n} éléments', all_props: 'Toutes les propriétés', close: 'Fermer', missing: 'pas de données', pick_hint: 'Cliquez sur un élément', trace_el: 'Traces seulement', sel: 'Sélectionné',
      find_target: 'Trouvez', score: 'Score', rounds: 'Trouvés', start: 'Démarrer', stop: 'Arrêter', timer: 'Minuteur', seconds: 'Secondes', time_up: 'Temps écoulé !', right: 'Juste !', wrong: 'Presque.', idle: 'Appuyez sur Démarrer, puis cliquez sur l’élément.',
      og_title: 'Jeu de mise en évidence des origines', og_mode_select: 'Tous les cliquer', og_mode_which: 'Quelle source ?', og_select: 'Cliquez sur chaque élément formé (aussi) par :', og_which: 'Quelle source a aidé à former cet élément ?', og_new: 'Nouvelle manche', og_found: '{n} trouvés sur {m}', og_done: 'Tous trouvés !', og_next: 'Suivant', og_truth: 'Sources de {el}',
      tr_group: 'Groupe', tr_period: 'Période', tr_index: 'Numéro', tr_prop: 'Propriété', tr_lines: 'Lignes', tr_log: 'Log y', tr_copy: 'Copier le CSV', tr_copied: 'Copié', tr_x_el: 'Élément', tr_x_z: 'Numéro atomique Z', tr_gaps: 'Pas de données pour : {list}',
      iso_pick: 'Élément', iso_none: 'Aucun isotope stable.', iso_y: 'Abondance naturelle (%)', iso_sum: 'Somme : {s} %',
      src_caveat: 'Les classes d’origine sont qualitatives (d’après Johnson, OSU) : elles disent quels processus contribuent, pas dans quelle proportion. Le site du processus r reste débattu. Énergie d’ionisation et affinité électronique sont en eV ; kJ/mol = eV × 96,485.', src_fixes: 'Corrections des données de la GUI Mulberry', src_list: 'Sources', prop_label: 'Propriété'},
  };
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = n => String(n).replace(/\d/g, d => SUP[d]);
  const NS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs = {}, ...kids) {
    const el = tag.startsWith('svg:') ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') el.setAttribute('class', v); else if (k === 'style' && typeof v === 'object') { for (const [prop, val] of Object.entries(v)) { if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val; } } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const fill = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false)); return el; };
  const pageLang = (document.documentElement.lang || root.dataset.lang || 'en').toLowerCase().startsWith('zh') ? 'zh' : (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();

  fetch(root.dataset.src).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(err => {
    const s = root.querySelector('[data-pt-status]'); if (s) s.textContent = 'Periodic-table data could not be loaded (' + err.message + ').';
  });

  function init(data) {
    const m = P.createModel(data), app = root.querySelector('[data-pt-app]');
    const S = {lang: LANGS.some(l => l[0] === pageLang) ? pageLang : 'en', tab: 'table', scheme: 'block', prop: '', unit: 'eV', full: false, log: false, cell: 0, sel: 'Fe', filter: null, query: '',
      trend: {kind: 'group', index: 1, prop: 'mass', lines: true, log: false}, trendz: {prop: 'mass', lines: true, log: false}, iso: 'Fe', find: null, findTimer: 0, findMsg: '', findSeconds: 60, findUseTimer: false, og: null, ogMode: 'select', ogMsg: ''};
    const t = (key, vars = {}) => (UI[S.lang][key] || UI.en[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    const name = e => P.displayName(e, S.lang);
    const TABS = ['table', 'origins', 'game', 'defs', 'iso', 'trend', 'trendz', 'sources'];
    const numProps = P.NUMERIC;

    // ---- shared pieces -----------------------------------------------------------------------
    function autoCell() { const w = app.clientWidth || 640; return Math.max(26, Math.min(64, Math.floor((w - 26) / 18) - 2)); }
    function grid(opts) { // opts: scheme, prop, unit, full, highlight(Set), onPick, selected, plain, found(Set), flash(sym, cls)
      const size = S.cell || autoCell(), scale = opts.scheme === 'heat' ? P.heatScale(m, opts.prop || 'mass', opts.unit, S.log) : null;
      const g = h('div', {class: 'pt-grid', style: {'--pt-cell': size + 'px'}, role: 'group', 'aria-label': t('tab_table')});
      for (let c = 1; c <= 18; c++) g.append(h('span', {class: 'pt-axis', style: {gridRow: 1, gridColumn: c + 1}}, c));
      for (const [r, label] of [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [10, '6*'], [11, '7*']]) g.append(h('span', {class: 'pt-axis', style: {gridRow: r, gridColumn: 1}}, label));
      for (const e of m.elements) {
        const base = opts.plain && !(opts.found && opts.found.has(e.sym)) ? {background: 'var(--zg-soft)', color: 'var(--zg-ink)', striped: false, dim: false}
          : P.cellStyle(m, e, opts.plain ? 'origin' : opts.scheme, {key: opts.prop || 'mass', unit: opts.unit, scale, highlight: opts.highlight});
        const val = opts.prop && !opts.hideValue ? P.value(m, e, opts.prop, opts.unit) : null;
        const cell = h('button', {type: 'button', class: 'pt-cell' + (base.striped ? ' striped' : '') + (base.dim ? ' dim' : '') + (opts.selected === e.sym ? ' sel' : ''), 'data-sym': e.sym,
          style: {gridRow: e.row + 1, gridColumn: e.col + 1, background: base.background, color: base.color},
          title: `${e.z} ${name(e)}` + (opts.hideName ? '' : ''), 'aria-label': `${e.z} ${e.sym} ${name(e)}`, onclick: () => opts.onPick(e.sym)},
          h('span', {class: 'pt-z'}, e.z), h('span', {class: 'pt-sym'}, e.sym),
          opts.full && !opts.hideName ? h('span', {class: 'pt-name'}, name(e)) : null,
          opts.prop && !opts.hideValue ? h('span', {class: 'pt-val'}, val === null ? '–' : P.formatNumber(val, S.lang, 4)) : null);
        g.append(cell);
      }
      return {el: g, scale};
    }
    function legend(scheme, scale, prop, unit, onClick, activeFilter) {
      const box = h('div', {class: 'pt-legend'});
      if (scheme === 'heat' && scale) {
        const stops = P.RAMP.join(', ');
        box.append(h('span', {class: 'pt-bar', style: {background: `linear-gradient(90deg, ${stops})`}}), h('span', {class: 'zg-small'}, `${P.formatNumber(scale.min, S.lang, 4)} … ${P.formatNumber(scale.max, S.lang, 4)} ${P.unitFor(m, prop, unit)}${scale.log ? ' (log)' : ''}`));
      } else if (scheme === 'origin') {
        const counts = P.legendCounts(m);
        for (const c of m.i18n.origins.order) box.append(h('button', {type: 'button', class: 'pt-chip' + (activeFilter === c ? ' on' : ''), 'aria-pressed': String(activeFilter === c), title: P.originDesc(m, S.lang, c), onclick: () => onClick(c)},
          h('i', {style: {background: m.i18n.origins.color[c]}}), P.originLabel(m, S.lang, c), h('b', {}, counts[c])));
      } else if (scheme === 'state') {
        for (const s of m.i18n.states.order) box.append(h('span', {class: 'pt-chip static'}, h('i', {style: {background: m.i18n.states.color[s]}}), P.stateLabel(m, S.lang, s)));
      } else {
        for (const b of m.i18n.groups.order) box.append(h('button', {type: 'button', class: 'pt-chip' + (activeFilter === b ? ' on' : ''), 'aria-pressed': String(activeFilter === b), onclick: () => onClick(b)}, h('i', {style: {background: m.i18n.groups.color[b]}}), P.groupLabel(m, S.lang, b)));
      }
      return box;
    }
    function originChips(e) {
      return h('span', {class: 'pt-chips'}, e.origin.map(c => h('span', {class: 'pt-chip static', title: P.originDesc(m, S.lang, c)}, h('i', {style: {background: m.i18n.origins.color[c]}}), P.originLabel(m, S.lang, c))));
    }
    function elementCard(e, compact) { // compact = card inside the table gap (little room): no trace note
      const bg = P.cellStyle(m, e, 'origin');
      return [h('div', {class: 'pt-card-head'}, h('span', {class: 'pt-big' + (bg.striped ? ' striped' : ''), style: {background: bg.background, color: bg.color}}, h('small', {}, e.z), h('b', {}, e.sym)),
        h('div', {class: 'pt-card-text'}, h('strong', {}, name(e)), h('div', {class: 'zg-small zg-muted'}, P.groupLabel(m, S.lang, e.block) + ' · ' + P.stateLabel(m, S.lang, e.state) + ' · ' + P.formatValue(m, e, 'mass', S.lang))),
        h('button', {type: 'button', class: 'zg-btn zg-btn-ghost pt-more', onclick: () => openDialog(e)}, t('all_props'))),
        originChips(e), !compact && e.trace ? h('div', {class: 'zg-small zg-muted'}, m.i18n.origins.trace[S.lang]) : null];
    }
    function openDialog(e) {
      const dlg = h('dialog', {class: 'pt-dialog', 'aria-label': name(e)});
      const rows = m.i18n.properties.order.filter(k => k !== 'origin').map(k => h('tr', {title: P.definition(m, S.lang, k)}, h('th', {}, P.label(m, S.lang, k)), h('td', {}, P.formatValue(m, e, k, S.lang, S.unit))));
      dlg.append(h('div', {class: 'pt-dialog-body'}, ...elementCard(e).slice(0, 1), h('h3', {}, P.label(m, S.lang, 'origin')),
        originChips(e), ...e.origin.map(c => h('p', {class: 'zg-small'}, h('b', {}, P.originLabel(m, S.lang, c) + ': '), P.originDesc(m, S.lang, c))), e.trace ? h('p', {class: 'zg-small zg-muted'}, m.i18n.origins.trace[S.lang]) : null,
        h('table', {class: 'pt-table'}, h('tbody', {}, rows)), h('button', {type: 'button', class: 'zg-btn', onclick: () => { dlg.close(); dlg.remove(); }}, t('close'))));
      dlg.addEventListener('click', ev => { if (ev.target === dlg) { dlg.close(); dlg.remove(); } });
      dlg.addEventListener('close', () => dlg.remove());
      document.body.append(dlg); dlg.showModal();
    }
    const select = (label, value, options, onchange, extra = {}) => h('label', {class: 'pt-field'}, label, h('select', {onchange: ev => onchange(ev.target.value), ...extra}, options.map(([v, text]) => h('option', {value: v, selected: String(v) === String(value)}, text))));
    const check = (label, on, onchange) => h('label', {class: 'pt-field pt-check'}, h('input', {type: 'checkbox', checked: on, onchange: ev => onchange(ev.target.checked)}), label);
    const propOptions = (withNone) => [...(withNone ? [['', t('none_prop')]] : []), ...numProps.filter(k => k !== 'z' || withNone).map(k => [k, P.label(m, S.lang, k)])];
    const unitSelect = prop => (prop === 'ie' || prop === 'ea') ? select(t('unit'), S.unit, [['eV', 'eV'], ['kJ/mol', 'kJ/mol']], v => { S.unit = v; refresh(); }) : null;

    // ---- tabs --------------------------------------------------------------------------------
    const tabs = {};
    tabs.table = () => {
      const host = h('div'), bar = h('div', {class: 'pt-bar-row'}), body = h('div', {class: 'pt-body'}), cardEl = h('div', {class: 'pt-card'}), narrow = h('div', {class: 'pt-card pt-card-narrow'});
      const search = h('input', {type: 'search', class: 'pt-search', placeholder: t('search'), 'aria-label': t('search'), value: S.query, oninput: ev => { S.query = ev.target.value; draw(); }, onkeydown: ev => { if (ev.key === 'Enter') { const r = P.search(m, S.query); if (r[0]) { S.sel = r[0]; draw(); } } }});
      function rebuildBar() {
        fill(bar, select(t('scheme'), S.scheme, [['block', t('sch_block')], ['origin', t('sch_origin')], ['state', t('sch_state')], ['heat', t('sch_heat')]], v => { S.scheme = v; S.filter = null; rebuildBar(); draw(); }),
          select(t('show'), S.prop, propOptions(true), v => { S.prop = v; rebuildBar(); draw(); }), unitSelect(S.prop || (S.scheme === 'heat' ? 'mass' : '')), check(t('fullnames'), S.full, v => { S.full = v; draw(); }),
          S.scheme === 'heat' ? check(t('logscale'), S.log, v => { S.log = v; draw(); }) : null,
          h('label', {class: 'pt-field'}, t('cell'), h('input', {type: 'range', min: 24, max: 80, step: 1, value: S.cell || autoCell(), oninput: ev => { S.cell = Number(ev.target.value); draw(); }})), search);
      }
      function draw() {
        const prop = S.prop || (S.scheme === 'heat' ? 'mass' : ''), found = S.query ? new Set(P.search(m, S.query)) : null;
        let hl = found && found.size ? found : null;
        if (S.filter) hl = new Set(m.elements.filter(e => S.scheme === 'origin' ? e.origin.includes(S.filter) : e.block === S.filter).map(e => e.sym));
        const g = grid({scheme: S.scheme, prop, unit: S.unit, full: S.full, highlight: hl, selected: S.sel, onPick: sym => { S.sel = sym; draw(); }, hideValue: !S.prop && S.scheme !== 'heat'});
        const e = m.bySym[S.sel];
        fill(cardEl, ...elementCard(e, true)); fill(narrow, ...elementCard(e));
        g.el.append(cardEl);
        fill(body, narrow, h('div', {class: 'pt-scroll'}, g.el), legend(S.scheme, g.scale, prop, S.unit, c => { S.filter = S.filter === c ? null : c; draw(); }, S.filter),
          (S.scheme === 'block' || S.scheme === 'origin') ? h('p', {class: 'zg-small zg-muted'}, S.scheme === 'origin' ? t('legend_hint') + ' · ' + t('src_caveat') : t('legend_hint')) : null, found ? h('p', {class: 'zg-small'}, t('n_el', {n: found.size})) : null);
      }
      rebuildBar(); draw(); host.append(bar, body); return host;
    };

    tabs.origins = () => {
      const host = h('div'), top = h('div'), game = h('div', {class: 'pt-game'});
      function drawTop() {
        const gr = grid({scheme: 'origin', full: false, selected: S.sel, highlight: S.filter ? new Set(m.elements.filter(e => e.origin.includes(S.filter)).map(e => e.sym)) : null, hideValue: true, onPick: sym => { S.sel = sym; drawTop(); }});
        const e = m.bySym[S.sel], cards = h('div', {class: 'pt-origin-cards'}, m.i18n.origins.order.map(c => h('button', {type: 'button', class: 'pt-origin-card' + (S.filter === c ? ' on' : ''), style: {'--pt-oc': m.i18n.origins.color[c]}, onclick: () => { S.filter = S.filter === c ? null : c; drawTop(); }}, h('b', {}, P.originLabel(m, S.lang, c)), h('span', {}, P.originDesc(m, S.lang, c)))));
        gr.el.append(h('div', {class: 'pt-card'}, ...elementCard(e, true).filter(Boolean)));
        fill(top, h('div', {class: 'pt-card pt-card-narrow'}, ...elementCard(e).filter(Boolean)), h('div', {class: 'pt-scroll'}, gr.el), h('p', {class: 'zg-small zg-muted'}, t('legend_hint')), cards, h('p', {class: 'zg-small zg-muted'}, t('src_caveat')));
      }
      function drawGame() {
        if (!S.og || S.og.mode !== S.ogMode) { S.og = P.createOriginGame(m, {mode: S.ogMode}); S.ogMsg = ''; }
        const g = S.og, head = h('div', {class: 'pt-bar-row'}, h('strong', {}, t('og_title')),
          h('button', {type: 'button', class: 'zg-btn' + (S.ogMode === 'select' ? '' : ' zg-btn-ghost'), onclick: () => { S.ogMode = 'select'; S.og = null; drawGame(); }}, t('og_mode_select')),
          h('button', {type: 'button', class: 'zg-btn' + (S.ogMode === 'which' ? '' : ' zg-btn-ghost'), onclick: () => { S.ogMode = 'which'; S.og = null; drawGame(); }}, t('og_mode_which')),
          h('span', {class: 'pt-score'}, `${t('score')}: ${g.score}`));
        if (g.mode === 'select') {
          const gr = grid({scheme: 'origin', plain: true, found: g.found, hideValue: true, onPick: sym => {
            const r = g.click(sym); S.ogMsg = r.ignored ? S.ogMsg : r.correct ? (r.done ? t('og_done') : t('right')) : t('wrong'); drawGame(); }});
          fill(game, head, h('p', {}, t('og_select') + ' ', h('span', {class: 'pt-chip static big'}, h('i', {style: {background: m.i18n.origins.color[g.target]}}), P.originLabel(m, S.lang, g.target))),
            h('p', {class: 'zg-small zg-muted'}, P.originDesc(m, S.lang, g.target)), h('div', {class: 'pt-scroll'}, gr.el),
            h('p', {role: 'status', 'aria-live': 'polite'}, t('og_found', {n: g.found.size, m: g.members.size}) + (S.ogMsg ? ' · ' + S.ogMsg : '')),
            h('button', {type: 'button', class: 'zg-btn', onclick: () => { g.restart(); S.ogMsg = ''; drawGame(); }}, t('og_new')));
        } else {
          const q = g.question, e = m.bySym[q.sym];
          fill(game, head, h('p', {}, t('og_which')), h('div', {class: 'pt-card-head'}, h('span', {class: 'pt-big', style: {background: 'var(--zg-soft)', color: 'var(--zg-ink)'}}, h('small', {}, e.z), h('b', {}, e.sym)), h('strong', {}, name(e))),
            h('div', {class: 'pt-options'}, q.options.map(c => h('button', {type: 'button', class: 'pt-chip big', onclick: () => {
              const r = g.answer(c); S.ogMsg = (r.correct ? t('right') : t('wrong')) + ' ' + t('og_truth', {el: name(m.bySym[r.element])}) + ': ' + m.bySym[r.element].origin.map(x => P.originLabel(m, S.lang, x)).join(' + '); drawGame(); }},
              h('i', {style: {background: m.i18n.origins.color[c]}}), P.originLabel(m, S.lang, c)))), h('p', {role: 'status', 'aria-live': 'polite', class: 'zg-small'}, S.ogMsg));
        }
      }
      drawTop(); drawGame(); host.append(top, game); return host;
    };

    tabs.game = () => {
      const host = h('div'), out = h('div');
      function stop() { clearInterval(S.findTimer); S.findTimer = 0; }
      function start() { stop(); S.find = P.createFindGame(m, {seconds: S.findUseTimer ? S.findSeconds : 0}); S.findMsg = ''; if (S.findUseTimer) S.findTimer = setInterval(() => { S.find.tick(1); if (S.find.finished) { stop(); S.findMsg = t('time_up'); } draw(); }, 1000); draw(); }
      function draw() {
        const g = S.find, active = g && !g.finished;
        const gr = grid({scheme: 'block', full: false, hideValue: true, hideName: true, onPick: sym => { if (!active) return; const r = g.guess(sym); S.findMsg = r.correct ? t('right') : t('wrong'); draw();
          const cell = out.querySelector(`[data-sym="${sym}"]`); if (cell) { cell.classList.add(r.correct ? 'ok' : 'bad'); setTimeout(() => cell.classList.remove('ok', 'bad'), 500); } }});
        fill(out, h('div', {class: 'pt-bar-row'},
          check(t('timer'), S.findUseTimer, v => { S.findUseTimer = v; }), h('label', {class: 'pt-field'}, t('seconds'), h('input', {type: 'number', min: 5, max: 600, step: 1, value: S.findSeconds, onchange: ev => { S.findSeconds = Math.max(5, Math.min(600, Number(ev.target.value) || 60)); }})),
          h('button', {type: 'button', class: 'zg-btn', onclick: start}, t('start')), h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: () => { stop(); if (S.find) S.find.finished = true; draw(); }}, t('stop'))),
          h('p', {class: 'pt-target', role: 'status', 'aria-live': 'polite'}, active ? `${t('find_target')}: ${name(m.bySym[g.target])}` : t('idle')),
          h('p', {}, `${t('score')}: ${g ? g.score : 0} · ${t('rounds')}: ${g ? g.rounds : 0}` + (g && g.timeLeft !== null ? ` · ${g.timeLeft}s` : '') + (S.findMsg ? ' · ' + S.findMsg : '')),
          h('div', {class: 'pt-scroll'}, gr.el));
      }
      draw(); host.append(out); return host;
    };

    tabs.defs = () => h('dl', {class: 'pt-defs'}, m.i18n.properties.order.map(k => [h('dt', {}, P.label(m, S.lang, k) + (m.i18n.properties.unit[k] && k !== 'iso' ? ` (${k === 'ie' || k === 'ea' ? 'eV · kJ/mol' : m.i18n.properties.unit[k]})` : '')), h('dd', {}, P.definition(m, S.lang, k))]));

    tabs.iso = () => {
      const host = h('div'), out = h('div');
      function draw() {
        const e = m.bySym[S.iso], list = m.elements.filter(x => x.iso.length);
        const pick = select(t('iso_pick'), S.iso, m.elements.map(x => [x.sym, `${x.z} ${x.sym} – ${name(x)}${x.iso.length ? '' : ' ∅'}`]), v => { S.iso = v; draw(); });
        const step = d => { const i = m.elements.indexOf(e); S.iso = m.elements[(i + d + 118) % 118].sym; draw(); };
        const bar = h('div', {class: 'pt-bar-row'}, h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', 'aria-label': '←', onclick: () => step(-1)}, '◀'), pick, h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', 'aria-label': '→', onclick: () => step(1)}, '▶'));
        if (!e.iso.length) { fill(out, bar, h('p', {}, `${name(e)}: ${t('iso_none')}`)); return; }
        const W = 640, H = 320, L = 56, R = 12, T = 22, B = 44, max = Math.max(...e.iso.map(i => i.pct)), ticks = P.niceTicks(0, max * 1.12, 6), top = ticks[ticks.length - 1];
        const bw = Math.min(56, (W - L - R) / e.iso.length * 0.7), x = i => L + (i + 0.5) * (W - L - R) / e.iso.length, y = v => T + (H - T - B) * (1 - v / top);
        const svg = h('svg:svg', {viewBox: `0 0 ${W} ${H}`, class: 'pt-svg', role: 'img', 'aria-label': t('iso_y')},
          ticks.map(v => [h('svg:line', {x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'pt-gridline'}), h('svg:text', {x: L - 6, y: y(v) + 4, class: 'pt-tick', 'text-anchor': 'end'}, v)]),
          e.iso.map((i, k) => [h('svg:rect', {x: x(k) - bw / 2, y: y(i.pct), width: bw, height: y(0) - y(i.pct), class: 'pt-iso-bar', rx: 3}, h('svg:title', {}, `${i.a}${e.sym}: ${P.formatNumber(i.pct, S.lang, 4)} %`)),
            h('svg:text', {x: x(k), y: y(i.pct) - 5, class: 'pt-tick', 'text-anchor': 'middle'}, P.formatNumber(i.pct, S.lang, 4)), h('svg:text', {x: x(k), y: H - B + 18, class: 'pt-tick big', 'text-anchor': 'middle'}, sup(i.a) + e.sym)]),
          h('svg:text', {x: 14, y: (T + H - B) / 2, class: 'pt-axis-title', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(T + H - B) / 2})`}, t('iso_y')));
        fill(out, bar, svg, h('p', {class: 'zg-small zg-muted'}, t('iso_sum', {s: P.formatNumber(e.iso.reduce((s, i) => s + i.pct, 0), S.lang, 5)})), originChips(e));
      }
      draw(); host.append(out); return host;
    };

    function trendView(cfg, kind) { // cfg: {kind,index,prop,lines,log}; kind 'z' uses all elements
      const host = h('div'), out = h('div');
      function draw() {
        const isZ = kind === 'z', pts = P.trend(m, isZ ? 'z' : cfg.kind, cfg.index, cfg.prop, S.unit), vals = pts.filter(p => p.y !== null).map(p => p.y);
        const useLog = cfg.log && vals.length && vals.every(v => v > 0), f = v => (useLog ? Math.log10(v) : v);
        const controls = h('div', {class: 'pt-bar-row'}, isZ ? null : select(t('tr_group') + ' / ' + t('tr_period'), cfg.kind, [['group', t('tr_group')], ['period', t('tr_period')]], v => { cfg.kind = v; cfg.index = 1; draw(); }),
          isZ ? null : select(t('tr_index'), cfg.index, Array.from({length: cfg.kind === 'group' ? 18 : 7}, (_, i) => [i + 1, i + 1]), v => { cfg.index = Number(v); draw(); }),
          select(t('tr_prop'), cfg.prop, numProps.filter(k => k !== 'z').map(k => [k, P.label(m, S.lang, k)]), v => { cfg.prop = v; draw(); }), unitSelect(cfg.prop),
          check(t('tr_lines'), cfg.lines, v => { cfg.lines = v; draw(); }), check(t('tr_log'), cfg.log, v => { cfg.log = v; draw(); }));
        const gaps = pts.filter(p => p.y === null).map(p => p.sym);
        const csv = () => ['Z,symbol,' + cfg.prop + (P.unitFor(m, cfg.prop, S.unit) ? ` [${P.unitFor(m, cfg.prop, S.unit)}]` : ''), ...pts.map(p => `${p.z},${p.sym},${p.y === null ? '' : p.y}`)].join('\n');
        const readout = h('p', {class: 'zg-small', 'aria-live': 'polite'}, ' ');
        let svg = h('p', {class: 'zg-muted'}, t('missing'));
        if (vals.length) {
          const W = 720, H = 360, L = 64, R = 14, T = 16, B = 48;
          let lo = Math.min(...vals.map(f)), hi = Math.max(...vals.map(f)); if (lo === hi) { lo -= 1; hi += 1; }
          const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
          const yt = useLog ? Array.from({length: Math.floor(hi) - Math.ceil(lo) + 1}, (_, i) => Math.ceil(lo) + i) : P.niceTicks(lo, hi, 6);
          const zmax = Math.max(...pts.map(p => p.z)), zmin = Math.min(...pts.map(p => p.z));
          const x = p => isZ ? L + (p.z - 0.5) / 118 * (W - L - R) : L + (p.i + 0.5) / pts.length * (W - L - R), y = v => T + (H - T - B) * (1 - (f(v) - lo) / (hi - lo));
          const segs = []; let run = []; for (const p of pts) { if (p.y === null) { if (run.length) segs.push(run); run = []; } else run.push(p); } if (run.length) segs.push(run);
          svg = h('svg:svg', {viewBox: `0 0 ${W} ${H}`, class: 'pt-svg', role: 'img', 'aria-label': P.label(m, S.lang, cfg.prop)},
            yt.map(v => [h('svg:line', {x1: L, x2: W - R, y1: T + (H - T - B) * (1 - (v - lo) / (hi - lo)), y2: T + (H - T - B) * (1 - (v - lo) / (hi - lo)), class: 'pt-gridline'}),
              h('svg:text', {x: L - 6, y: T + (H - T - B) * (1 - (v - lo) / (hi - lo)) + 4, class: 'pt-tick', 'text-anchor': 'end'}, useLog ? P.formatNumber(10 ** v, S.lang, 3) : P.formatNumber(v, S.lang, 4))]),
            isZ ? P.niceTicks(zmin, zmax + 1, 13).filter(v => v >= 1 && v <= 118).map(v => h('svg:text', {x: x({z: v}), y: H - B + 16, class: 'pt-tick', 'text-anchor': 'middle'}, v)) : pts.map(p => h('svg:text', {x: x(p), y: H - B + 16, class: 'pt-tick big', 'text-anchor': 'middle'}, p.sym)),
            cfg.lines ? segs.map(seg => h('svg:polyline', {points: seg.map(p => `${x(p)},${y(p.y)}`).join(' '), class: 'pt-line'})) : null,
            pts.filter(p => p.y !== null).map(p => h('svg:circle', {cx: x(p), cy: y(p.y), r: isZ ? 3.2 : 5, fill: m.i18n.groups.color[p.block], class: 'pt-dot', tabindex: 0,
              onmouseenter: () => { readout.textContent = `${p.z} ${p.sym} (${name(m.bySym[p.sym])}): ${P.formatNumber(p.y, S.lang, 5)} ${P.unitFor(m, cfg.prop, S.unit)}`; }, onfocus: () => { readout.textContent = `${p.z} ${p.sym}: ${P.formatNumber(p.y, S.lang, 5)}`; }}, h('svg:title', {}, `${p.z} ${p.sym}: ${P.formatNumber(p.y, S.lang, 5)}`))),
            h('svg:text', {x: (L + W - R) / 2, y: H - 6, class: 'pt-axis-title', 'text-anchor': 'middle'}, isZ ? t('tr_x_z') : t('tr_x_el')),
            h('svg:text', {x: 14, y: (T + H - B) / 2, class: 'pt-axis-title', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(T + H - B) / 2})`}, `${P.label(m, S.lang, cfg.prop)} ${P.unitFor(m, cfg.prop, S.unit) ? '(' + P.unitFor(m, cfg.prop, S.unit) + ')' : ''}`));
        }
        const copy = h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: ev => { const b = ev.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(csv()) : Promise.reject()).then(() => { b.textContent = t('tr_copied'); setTimeout(() => { b.textContent = t('tr_copy'); }, 1500); }).catch(() => { b.textContent = '⚠'; }); }}, t('tr_copy'));
        const table = h('table', {class: 'pt-table'}, h('thead', {}, h('tr', {}, h('th', {}, 'Z'), h('th', {}, ''), h('th', {}, P.label(m, S.lang, cfg.prop)))),
          h('tbody', {}, pts.map(p => h('tr', {}, h('td', {}, p.z), h('td', {}, p.sym), h('td', {}, p.y === null ? '–' : P.formatNumber(p.y, S.lang, 5))))));
        fill(out, controls, svg, readout, gaps.length ? h('p', {class: 'zg-small zg-muted'}, t('tr_gaps', {list: gaps.join(', ')})) : null, copy, h('details', {}, h('summary', {}, t('tab_trend')), table));
      }
      draw(); host.append(out); return host;
    }
    tabs.trend = () => trendView(S.trend, 'ptz-group');
    tabs.trendz = () => trendView(S.trendz, 'z');

    tabs.sources = () => {
      const meta = m.data.meta;
      return h('div', {}, h('p', {}, t('src_caveat')), h('h3', {}, t('src_list')), h('ul', {}, meta.sources.map(s => h('li', {}, s.url ? h('a', {href: s.url, rel: 'noopener', target: '_blank'}, s.text) : s.text))),
        h('h3', {}, t('src_fixes')), h('ul', {}, meta.fixes.map(f => h('li', {}, `${f.element}: ${f.what}`))));
    };

    // ---- shell -------------------------------------------------------------------------------
    function show() {
      clearInterval(S.findTimer); S.findTimer = 0;
      const head = h('div', {class: 'pt-head'}, h('div', {class: 'zg-local-tabs', role: 'tablist'}, TABS.map(k => h('button', {type: 'button', role: 'tab', class: 'zg-btn' + (S.tab === k ? '' : ' zg-btn-ghost'), 'aria-selected': String(S.tab === k), onclick: () => { S.tab = k; show(); }}, t('tab_' + k)))),
        select(t('language'), S.lang, LANGS, v => { S.lang = v; show(); }));
      fill(app, head, h('div', {class: 'pt-panel', role: 'tabpanel'}, tabs[S.tab]()));
    }
    function refresh() { show(); }
    show();
    if (typeof ResizeObserver !== 'undefined') { let w = app.clientWidth; new ResizeObserver(() => { if (!S.cell && Math.abs(app.clientWidth - w) > 24 && ['table', 'origins'].includes(S.tab)) { w = app.clientWidth; show(); } }).observe(app); }
    root.__pt = {state: S, model: m};
  }
})();
