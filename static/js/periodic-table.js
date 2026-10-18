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
      src_caveat: 'Origin classes are qualitative (after Johnson, OSU) and show which processes contribute, not how much. The r-process site is still debated. Ionisation energy and electron affinity are in eV; kJ/mol = eV × 96.485.', src_list: 'Sources', prop_label: 'Property',
      timeline: 'Discovery timeline', known_by: 'Known by year', play: 'Play', compare: 'Compare two elements', compare_hint: 'Pick a second element: Shift+click in the table.', difference: 'Difference', bond_hint: 'Electronegativity difference suggests the bond type: <0.4 nonpolar covalent, 0.4–1.7 polar covalent, >1.7 mostly ionic (rule of thumb).', image_scale: 'Image scale', pixels: 'pixels', downloaded: 'Download started', dl_failed: 'Could not create the file',
      tab_data: 'Data table', x_axis: 'X axis', sort_hint: 'Click a column header to sort', rows_n: '{n} rows', kbd_hint: 'Arrow keys move between elements; Enter selects, Shift+Enter marks a second element.', symbol: 'Symbol', name: 'Name',
      origin_about_title: 'How the elements were made', origin_about: 'Hydrogen, helium and a little lithium formed in the first minutes after the Big Bang (Big Bang nucleosynthesis). Almost everything heavier was made in stars: fusion in massive stars builds elements up to the iron group, and the explosions of massive stars (core-collapse supernovae) and of white dwarfs (type Ia supernovae) spread them into space. Asymptotic-giant-branch stars make roughly half of the elements beyond iron by the slow neutron-capture process (s-process); the other half needs the rapid neutron-capture process (r-process), which requires extreme neutron densities. It is established for neutron-star mergers, while other possible sites are still debated. Lithium, beryllium and boron are mostly destroyed in stars and are made by cosmic-ray spallation. Many elements have several sources, so the table shows sets instead of single labels. Masses of exotic nuclei measured with ion traps (for example at IGISOL/JYFLTRAP) give the neutron-separation energies that fix the r-process path and the proton-capture waiting points of the rp-process: this is the link between nuclear physics and the origin of the elements.',
      sch_country: 'Discovery country', cell_isocount: 'Stable isotopes (count)', cell_origincount: 'Number of origin sources', cell_text: 'Text in cells', localnames: 'Names in the panel language', ex_key: 'Colour key and description in saved images', ex_csv_desc: 'Description lines (#) in the CSV', ex_csv_col: 'Colour columns in the CSV',
      key_block: 'Each cell is coloured by the chemical family of the element.', key_origin: 'Each cell is coloured by the astrophysical or human source(s) of the element; striped cells have several sources and the number counts the elements of each class.',
      key_country: 'Each cell is coloured by the country credited with the discovery; the number counts the elements per country.', key_state: 'Each cell is coloured by the state of matter at room temperature and normal pressure.',
      key_heat: 'The cell colour encodes the value of the shown property from the lowest (left end of the bar) to the highest value (right end){log}; grey cells have no data.',
      key_points: 'Each point is coloured by the chemical family of the element.', save_video: 'Save timeline video', clear_sel: 'Clear selection (Esc)'},
    zh: {tab_table: '周期表', tab_origins: '起源', tab_game: '找元素', tab_defs: '定义', tab_iso: '同位素', tab_trend: '趋势', tab_trendz: '按质子数', tab_sources: '来源',
      language: '语言', scheme: '着色方式', sch_block: '化学族块', sch_origin: '起源', sch_state: '物态', sch_heat: '性质热图', show: '格内显示', none_prop: '— 仅符号 —', unit: '单位', fullnames: '显示全名', logscale: '对数刻度', search: '搜索符号、名称或 Z', cell: '格子大小',
      legend_hint: '点击类别以高亮', n_el: '{n} 个元素', all_props: '全部性质', close: '关闭', missing: '无数据', pick_hint: '点击一个元素', trace_el: '仅痕量', sel: '已选',
      find_target: '找', score: '得分', rounds: '已找到', start: '开始', stop: '停止', timer: '计时', seconds: '秒数', time_up: '时间到！', right: '答对了！', wrong: '差一点。', idle: '点击“开始”，然后点出该元素。',
      og_title: '元素起源高亮游戏', og_mode_select: '全部点出', og_mode_which: '哪个来源？', og_select: '点出所有（也）由下列过程产生的元素：', og_which: '哪个来源参与产生了这个元素？', og_new: '新一轮', og_found: '已找到 {n} / {m}', og_done: '全部找到！', og_next: '下一个', og_truth: '{el} 的来源',
      tr_group: '族', tr_period: '周期', tr_index: '编号', tr_prop: '性质', tr_lines: '连线', tr_log: 'y 取对数', tr_copy: '复制 CSV', tr_copied: '已复制', tr_x_el: '元素', tr_x_z: '质子数 Z', tr_gaps: '无数据：{list}',
      iso_pick: '元素', iso_none: '没有稳定同位素。', iso_y: '天然丰度 (%)', iso_sum: '总和：{s} %',
      src_caveat: '起源类别是定性的（依据 Johnson，OSU），只表示有哪些过程贡献，不表示贡献多少。r 过程的发生地点仍有争议。电离能和电子亲和能以 eV 为单位；kJ/mol = eV × 96.485。', src_list: '来源', prop_label: '性质',
      timeline: '发现时间线', known_by: '截至年份已知', play: '播放', compare: '比较两个元素', compare_hint: '选择第二个元素：在表中按住 Shift 点击。', difference: '差值', bond_hint: '电负性差值提示键型：<0.4 非极性共价，0.4–1.7 极性共价，>1.7 以离子键为主（经验规则）。', image_scale: '图片倍数', pixels: '像素', downloaded: '已开始下载', dl_failed: '无法生成文件',
      tab_data: '数据表', x_axis: 'X 轴', sort_hint: '点击列标题排序', rows_n: '{n} 行', kbd_hint: '方向键在元素间移动；回车选中，Shift+回车标记第二个元素。', symbol: '符号', name: '名称',
      origin_about_title: '元素是如何形成的', origin_about: '氢、氦和少量锂形成于大爆炸后的最初几分钟（大爆炸核合成）。比锂更重的元素几乎都形成于恒星：大质量恒星中的聚变合成直到铁族的元素，大质量恒星的爆炸（核坍缩超新星）和白矮星的爆炸（Ia 型超新星）把它们抛向星际空间。渐近巨星支恒星通过慢中子俘获过程（s 过程）贡献了铁以后大约一半的元素；另一半需要快中子俘获过程（r 过程），它要求极高的中子密度，已在中子星并合中得到证实，其他可能的发生地点仍有争议。锂、铍、硼在恒星中大多被破坏，主要来自宇宙射线散裂。许多元素有多个来源，因此周期表给出来源集合而不是单一标签。用离子阱测得的奇特核质量（例如在 IGISOL/JYFLTRAP）给出中子分离能，决定 r 过程的路径和 rp 过程的质子俘获等待点——这是核物理与元素起源之间的联系。',
      sch_country: '发现国家', cell_isocount: '稳定同位素（个数）', cell_origincount: '起源来源数', cell_text: '格内文字大小', localnames: '元素名称使用面板语言', ex_key: '保存的图片中包含颜色图例和说明', ex_csv_desc: 'CSV 中包含说明行（#）', ex_csv_col: 'CSV 中包含颜色列',
      key_block: '每个格子按元素所属的化学类别着色。', key_origin: '每个格子按元素的天体物理或人工来源着色；条纹格子表示有多种来源，数字为各类别的元素个数。',
      key_country: '每个格子按发现该元素的国家着色；数字为各国发现的元素个数。', key_state: '每个格子按室温常压下的物质状态着色。',
      key_heat: '格子颜色表示所示性质的数值，从最低值（色条左端）到最高值（右端）{log}；灰色格子表示无数据。',
      key_points: '每个点按元素所属的化学类别着色。', save_video: '保存时间线视频', clear_sel: '取消选中 (Esc)'},
    fi: {tab_table: 'Taulukko', tab_origins: 'Alkuperä', tab_game: 'Etsi alkuaine', tab_defs: 'Määritelmät', tab_iso: 'Isotoopit', tab_trend: 'Trendit', tab_trendz: 'Trendit Z:n mukaan', tab_sources: 'Lähteet',
      language: 'Kieli', scheme: 'Väritys', sch_block: 'Kemiallinen lohko', sch_origin: 'Alkuperä', sch_state: 'Olomuoto', sch_heat: 'Ominaisuuden lämpökartta', show: 'Näytä ruuduissa', none_prop: '— vain symboli —', unit: 'Yksikkö', fullnames: 'Koko nimet', logscale: 'Logaritminen asteikko', search: 'Hae symbolia, nimeä tai Z:aa', cell: 'Ruudun koko',
      legend_hint: 'Napsauta luokkaa korostaaksesi', n_el: '{n} alkuainetta', all_props: 'Kaikki ominaisuudet', close: 'Sulje', missing: 'ei tietoa', pick_hint: 'Napsauta alkuainetta', trace_el: 'Vain jälkiä', sel: 'Valittu',
      find_target: 'Etsi', score: 'Pisteet', rounds: 'Löydetty', start: 'Aloita', stop: 'Lopeta', timer: 'Ajastin', seconds: 'Sekuntia', time_up: 'Aika loppui!', right: 'Oikein!', wrong: 'Ei aivan.', idle: 'Paina Aloita ja napsauta alkuainetta.',
      og_title: 'Alkuperän korostuspeli', og_mode_select: 'Napsauta kaikki', og_mode_which: 'Mikä lähde?', og_select: 'Napsauta jokainen alkuaine, jonka (myös) tämä synnytti:', og_which: 'Mikä lähde auttoi synnyttämään tämän alkuaineen?', og_new: 'Uusi kierros', og_found: 'Löydetty {n} / {m}', og_done: 'Kaikki löytyi!', og_next: 'Seuraava', og_truth: '{el}: lähteet',
      tr_group: 'Ryhmä', tr_period: 'Jakso', tr_index: 'Numero', tr_prop: 'Ominaisuus', tr_lines: 'Viivat', tr_log: 'Log y', tr_copy: 'Kopioi CSV', tr_copied: 'Kopioitu', tr_x_el: 'Alkuaine', tr_x_z: 'Protoniluku Z', tr_gaps: 'Ei tietoa: {list}',
      iso_pick: 'Alkuaine', iso_none: 'Ei vakaita isotooppeja.', iso_y: 'Luonnollinen runsaus (%)', iso_sum: 'Summa: {s} %',
      src_caveat: 'Alkuperäluokat ovat laadullisia (Johnsonin mukaan, OSU): ne kertovat mitkä prosessit vaikuttavat, eivät kuinka paljon. R-prosessin paikasta kiistellään yhä. Ionisaatioenergia ja elektroniaffiniteetti ovat eV:nä; kJ/mol = eV × 96,485.', src_list: 'Lähteet', prop_label: 'Ominaisuus',
      timeline: 'Löytöaikajana', known_by: 'Tunnettu vuoteen mennessä', play: 'Toista', compare: 'Vertaa kahta alkuainetta', compare_hint: 'Valitse toinen alkuaine: Shift+napsautus taulukossa.', difference: 'Erotus', bond_hint: 'Elektronegatiivisuuden ero ennustaa sidostyypin: <0,4 poolittoman kovalenttinen, 0,4–1,7 polaarinen kovalenttinen, >1,7 enimmäkseen ioninen (nyrkkisääntö).', image_scale: 'Kuvan skaalaus', pixels: 'pikseliä', downloaded: 'Lataus alkoi', dl_failed: 'Tiedoston luonti epäonnistui',
      tab_data: 'Datataulukko', x_axis: 'X-akseli', sort_hint: 'Napsauta sarakeotsikkoa lajitellaksesi', rows_n: '{n} riviä', kbd_hint: 'Nuolinäppäimet siirtävät elementtien välillä; Enter valitsee, Shift+Enter merkitsee toisen alkuaineen.', symbol: 'Symboli', name: 'Nimi',
      origin_about_title: 'Miten alkuaineet syntyivät', origin_about: 'Vety, helium ja hieman litiumia syntyi ensimmäisten minuuttien aikana alkuräjähdyksen jälkeen (alkuräjähdyksen ydinsynteesi). Lähes kaikki litiumia raskaampi syntyi tähdissä: massiivisten tähtien fuusio rakentaa alkuaineita rautaryhmään asti, ja massiivisten tähtien räjähdykset (ytimen romahtamisen supernovat) sekä valkoisten kääpiöiden räjähdykset (Ia-tyypin supernovat) levittävät ne avaruuteen. AGB-tähdet tuottavat hitaalla neutronikaappauksella (s-prosessi) noin puolet rautaa raskaammista alkuaineista; toinen puoli vaatii nopean neutronikaappauksen (r-prosessi), joka tarvitsee äärimmäisen suuren neutronitiheyden. Se on vahvistettu neutronitähtien yhdistymisissä, mutta muut mahdolliset paikat ovat yhä kiistanalaisia. Litium, beryllium ja boori tuhoutuvat pääosin tähdissä ja syntyvät kosmisen säteilyn spallaatiossa. Monella alkuaineella on useita lähteitä, joten taulukko näyttää joukkoja yksittäisten luokkien sijaan. Ioniloukuilla (esim. IGISOL/JYFLTRAP) mitatut eksoottisten ytimien massat antavat neutronien erotusenergiat, jotka määräävät r-prosessin polun ja rp-prosessin protonikaappauksen odotuspisteet – tämä yhdistää ydinfysiikan alkuaineiden alkuperään.',
      sch_country: 'Löytömaa', cell_isocount: 'Vakaat isotoopit (lukumäärä)', cell_origincount: 'Alkuperälähteiden lukumäärä', cell_text: 'Tekstin koko ruuduissa', localnames: 'Nimet paneelin kielellä', ex_key: 'Värien selite ja kuvaus tallennettuihin kuviin', ex_csv_desc: 'Kuvausrivit (#) CSV-tiedostoon', ex_csv_col: 'Värisarakkeet CSV-tiedostoon',
      key_block: 'Jokainen ruutu on väritetty alkuaineen kemiallisen ryhmän mukaan.', key_origin: 'Jokainen ruutu on väritetty alkuaineen astrofysikaalisen tai ihmisen tekemän alkuperän mukaan; raidalliset ruudut tarkoittavat useita lähteitä ja luku kertoo luokan alkuaineiden määrän.',
      key_country: 'Jokainen ruutu on väritetty löytäjämaan mukaan; luku kertoo maan löytämien alkuaineiden määrän.', key_state: 'Jokainen ruutu on väritetty huoneenlämpötilan ja normaalipaineen aggregaattitilan mukaan.',
      key_heat: 'Ruudun väri kuvaa näytettävän ominaisuuden arvoa pienimmästä (palkin vasen pää) suurimpaan (oikea pää){log}; harmaat ruudut eivät sisällä tietoa.',
      key_points: 'Jokainen piste on väritetty alkuaineen kemiallisen ryhmän mukaan.', save_video: 'Tallenna aikajanavideo', clear_sel: 'Poista valinta (Esc)'},
    de: {tab_table: 'Tabelle', tab_origins: 'Herkunft', tab_game: 'Element finden', tab_defs: 'Definitionen', tab_iso: 'Isotope', tab_trend: 'Trends', tab_trendz: 'Trends nach Z', tab_sources: 'Quellen',
      language: 'Sprache', scheme: 'Färben nach', sch_block: 'Chemischer Block', sch_origin: 'Herkunft', sch_state: 'Aggregatzustand', sch_heat: 'Eigenschafts-Heatmap', show: 'In Zellen zeigen', none_prop: '— nur Symbol —', unit: 'Einheit', fullnames: 'Volle Namen', logscale: 'Logarithmische Skala', search: 'Symbol, Name oder Z suchen', cell: 'Zellgröße',
      legend_hint: 'Klasse anklicken, um sie hervorzuheben', n_el: '{n} Elemente', all_props: 'Alle Eigenschaften', close: 'Schließen', missing: 'keine Daten', pick_hint: 'Element anklicken', trace_el: 'Nur Spuren', sel: 'Ausgewählt',
      find_target: 'Finde', score: 'Punkte', rounds: 'Gefunden', start: 'Start', stop: 'Stopp', timer: 'Timer', seconds: 'Sekunden', time_up: 'Zeit ist um!', right: 'Richtig!', wrong: 'Knapp daneben.', idle: 'Start drücken und das Element anklicken.',
      og_title: 'Herkunfts-Hervorhebungsspiel', og_mode_select: 'Alle anklicken', og_mode_which: 'Welche Quelle?', og_select: 'Klicke jedes Element an, das (auch) entstand durch:', og_which: 'Welche Quelle hat dieses Element mit erzeugt?', og_new: 'Neue Runde', og_found: 'Gefunden {n} von {m}', og_done: 'Alle gefunden!', og_next: 'Weiter', og_truth: 'Quellen von {el}',
      tr_group: 'Gruppe', tr_period: 'Periode', tr_index: 'Nummer', tr_prop: 'Eigenschaft', tr_lines: 'Linien', tr_log: 'Log y', tr_copy: 'CSV kopieren', tr_copied: 'Kopiert', tr_x_el: 'Element', tr_x_z: 'Ordnungszahl Z', tr_gaps: 'Keine Daten für: {list}',
      iso_pick: 'Element', iso_none: 'Keine stabilen Isotope.', iso_y: 'Natürliche Häufigkeit (%)', iso_sum: 'Summe: {s} %',
      src_caveat: 'Die Herkunftsklassen sind qualitativ (nach Johnson, OSU): Sie zeigen, welche Prozesse beitragen, nicht wie stark. Der Ort des r-Prozesses ist weiter umstritten. Ionisierungsenergie und Elektronenaffinität sind in eV; kJ/mol = eV × 96,485.', src_list: 'Quellen', prop_label: 'Eigenschaft',
      timeline: 'Entdeckungs-Zeitleiste', known_by: 'Bekannt bis Jahr', play: 'Abspielen', compare: 'Zwei Elemente vergleichen', compare_hint: 'Zweites Element wählen: Umschalt+Klick in der Tabelle.', difference: 'Differenz', bond_hint: 'Die Elektronegativitätsdifferenz deutet auf den Bindungstyp: <0,4 unpolar kovalent, 0,4–1,7 polar kovalent, >1,7 überwiegend ionisch (Faustregel).', image_scale: 'Bildmaßstab', pixels: 'Pixel', downloaded: 'Download gestartet', dl_failed: 'Datei konnte nicht erstellt werden',
      tab_data: 'Datentabelle', x_axis: 'X-Achse', sort_hint: 'Spaltenkopf anklicken zum Sortieren', rows_n: '{n} Zeilen', kbd_hint: 'Pfeiltasten wechseln das Element; Eingabe wählt, Umschalt+Eingabe markiert ein zweites Element.', symbol: 'Symbol', name: 'Name',
      origin_about_title: 'Wie die Elemente entstanden', origin_about: 'Wasserstoff, Helium und etwas Lithium entstanden in den ersten Minuten nach dem Urknall (primordiale Nukleosynthese). Fast alles Schwerere entstand in Sternen: Die Fusion in massereichen Sternen baut Elemente bis zur Eisengruppe auf; Explosionen massereicher Sterne (Kernkollaps-Supernovae) und Weißer Zwerge (Typ-Ia-Supernovae) verteilen sie im Raum. AGB-Sterne liefern über den langsamen Neutroneneinfang (s-Prozess) etwa die Hälfte der Elemente jenseits von Eisen; die andere Hälfte erfordert den schnellen Neutroneneinfang (r-Prozess) mit extrem hohen Neutronendichten. Er ist für Neutronensternverschmelzungen belegt, weitere mögliche Orte sind noch umstritten. Lithium, Beryllium und Bor werden in Sternen überwiegend zerstört und entstehen durch Spallation der kosmischen Strahlung. Viele Elemente haben mehrere Quellen, deshalb zeigt die Tabelle Mengen statt einzelner Etiketten. Mit Ionenfallen gemessene Massen exotischer Kerne (z. B. bei IGISOL/JYFLTRAP) liefern die Neutronentrennenergien, die den Pfad des r-Prozesses und die Protoneneinfang-Wartepunkte des rp-Prozesses bestimmen – die Verbindung zwischen Kernphysik und der Herkunft der Elemente.',
      sch_country: 'Entdeckungsland', cell_isocount: 'Stabile Isotope (Anzahl)', cell_origincount: 'Anzahl der Herkunftsquellen', cell_text: 'Textgröße in den Zellen', localnames: 'Namen in der Sprache des Panels', ex_key: 'Farblegende und Beschreibung in gespeicherten Bildern', ex_csv_desc: 'Beschreibungszeilen (#) in der CSV-Datei', ex_csv_col: 'Farbspalten in der CSV-Datei',
      key_block: 'Jede Zelle ist nach der chemischen Familie des Elements gefärbt.', key_origin: 'Jede Zelle ist nach der astrophysikalischen oder menschlichen Quelle des Elements gefärbt; gestreifte Zellen haben mehrere Quellen, die Zahl gibt die Anzahl der Elemente je Klasse an.',
      key_country: 'Jede Zelle ist nach dem Land der Entdeckung gefärbt; die Zahl gibt die Anzahl der Elemente je Land an.', key_state: 'Jede Zelle ist nach dem Aggregatzustand bei Raumtemperatur und Normaldruck gefärbt.',
      key_heat: 'Die Zellfarbe gibt den Wert der angezeigten Eigenschaft vom kleinsten (linkes Ende des Balkens) bis zum größten Wert (rechtes Ende) an{log}; graue Zellen haben keine Daten.',
      key_points: 'Jeder Punkt ist nach der chemischen Familie des Elements gefärbt.', save_video: 'Zeitleisten-Video speichern', clear_sel: 'Auswahl aufheben (Esc)'},
    ja: {tab_table: '周期表', tab_origins: '起源', tab_game: '元素探し', tab_defs: '用語', tab_iso: '同位体', tab_trend: '傾向', tab_trendz: '原子番号別', tab_sources: '出典',
      language: '言語', scheme: '色分け', sch_block: '化学ブロック', sch_origin: '起源', sch_state: '状態', sch_heat: '物性ヒートマップ', show: 'セルに表示', none_prop: '— 記号のみ —', unit: '単位', fullnames: '元素名を表示', logscale: '対数目盛', search: '記号・名前・Zで検索', cell: 'セルの大きさ',
      legend_hint: '分類をクリックして強調', n_el: '{n} 元素', all_props: 'すべての物性', close: '閉じる', missing: 'データなし', pick_hint: '元素をクリック', trace_el: '痕跡量のみ', sel: '選択中',
      find_target: '探す', score: '得点', rounds: '発見', start: '開始', stop: '停止', timer: 'タイマー', seconds: '秒', time_up: '時間切れ！', right: '正解！', wrong: 'おしい。', idle: '「開始」を押して、その元素をクリックしてください。',
      og_title: '起源ハイライトゲーム', og_mode_select: '全部クリック', og_mode_which: 'どの起源？', og_select: '次の起源で（も）作られた元素をすべてクリック：', og_which: 'この元素の生成に関わった起源はどれ？', og_new: '新しいラウンド', og_found: '{m} 個中 {n} 個発見', og_done: '全部見つけた！', og_next: '次へ', og_truth: '{el} の起源',
      tr_group: '族', tr_period: '周期', tr_index: '番号', tr_prop: '物性', tr_lines: '線', tr_log: 'y対数', tr_copy: 'CSVをコピー', tr_copied: 'コピーしました', tr_x_el: '元素', tr_x_z: '原子番号 Z', tr_gaps: 'データなし：{list}',
      iso_pick: '元素', iso_none: '安定同位体はありません。', iso_y: '天然存在比 (%)', iso_sum: '合計：{s} %',
      src_caveat: '起源の分類は定性的（Johnson、OSUに基づく）で、どの過程が寄与するかを示し、寄与の大きさは示しません。r過程の場所は今も議論中です。イオン化エネルギーと電子親和力は eV 単位で、kJ/mol = eV × 96.485 です。', src_list: '出典', prop_label: '物性',
      timeline: '発見の年表', known_by: '発見済み（年まで）', play: '再生', compare: '2つの元素を比較', compare_hint: '2つ目の元素: 表で Shift+クリック。', difference: '差', bond_hint: '電気陰性度の差は結合の型の目安: <0.4 無極性共有、0.4–1.7 極性共有、>1.7 主にイオン結合（経験則）。', image_scale: '画像の倍率', pixels: 'ピクセル', downloaded: 'ダウンロードを開始しました', dl_failed: 'ファイルを作成できませんでした',
      tab_data: 'データ表', x_axis: 'X軸', sort_hint: '列見出しをクリックして並べ替え', rows_n: '{n} 行', kbd_hint: '矢印キーで元素間を移動、Enter で選択、Shift+Enter で2つ目の元素を指定。', symbol: '記号', name: '名前',
      origin_about_title: '元素はどのようにできたか', origin_about: '水素・ヘリウム・少量のリチウムはビッグバン後の最初の数分間に作られました（ビッグバン元素合成）。それより重い元素のほとんどは恒星で作られます。大質量星の核融合は鉄族までの元素を作り、大質量星の爆発（重力崩壊型超新星）と白色矮星の爆発（Ia型超新星）がそれらを宇宙空間に放出します。AGB星は遅い中性子捕獲（s過程）で鉄より重い元素の約半分を作り、残りの半分には極めて高い中性子密度を必要とする速い中性子捕獲（r過程）が必要です。r過程は中性子星合体で確認されていますが、他の候補天体は今も議論されています。リチウム・ベリリウム・ホウ素は恒星内でほとんど壊され、宇宙線による破砕で作られます。多くの元素が複数の起源をもつため、周期表は単一のラベルではなく起源の集合を示します。イオントラップ（例：IGISOL/JYFLTRAP）で測定した不安定核の質量は中性子分離エネルギーを与え、r過程の経路やrp過程の陽子捕獲の待機点を決めます。これが原子核物理と元素の起源をつなぐ接点です。',
      sch_country: '発見国', cell_isocount: '安定同位体（個数）', cell_origincount: '起源の数', cell_text: 'セル内の文字サイズ', localnames: '元素名をパネルの言語で表示', ex_key: '保存画像に色の凡例と説明を含める', ex_csv_desc: 'CSV に説明行（#）を含める', ex_csv_col: 'CSV に色の列を含める',
      key_block: '各セルは元素の化学的な分類で色分けされています。', key_origin: '各セルは元素の天体物理的または人工的な起源で色分けされています。縞模様のセルは複数の起源を持ち、数字は各区分の元素数です。',
      key_country: '各セルは発見した国で色分けされています。数字は国ごとの元素数です。', key_state: '各セルは室温・常圧での物質の状態で色分けされています。',
      key_heat: 'セルの色は、表示している性質の値を最小（バーの左端）から最大（右端）まで表します{log}。灰色のセルはデータがありません。',
      key_points: '各点は元素の化学的な分類で色分けされています。', save_video: '年表の動画を保存', clear_sel: '選択を解除 (Esc)'},
    fr: {tab_table: 'Tableau', tab_origins: 'Origines', tab_game: 'Trouver l’élément', tab_defs: 'Définitions', tab_iso: 'Isotopes', tab_trend: 'Tendances', tab_trendz: 'Tendances selon Z', tab_sources: 'Sources',
      language: 'Langue', scheme: 'Colorier par', sch_block: 'Bloc chimique', sch_origin: 'Origine', sch_state: 'État', sch_heat: 'Carte thermique d’une propriété', show: 'Afficher dans les cases', none_prop: '— symbole seul —', unit: 'Unité', fullnames: 'Noms complets', logscale: 'Échelle log', search: 'Chercher symbole, nom ou Z', cell: 'Taille des cases',
      legend_hint: 'Cliquez sur une classe pour la mettre en évidence', n_el: '{n} éléments', all_props: 'Toutes les propriétés', close: 'Fermer', missing: 'pas de données', pick_hint: 'Cliquez sur un élément', trace_el: 'Traces seulement', sel: 'Sélectionné',
      find_target: 'Trouvez', score: 'Score', rounds: 'Trouvés', start: 'Démarrer', stop: 'Arrêter', timer: 'Minuteur', seconds: 'Secondes', time_up: 'Temps écoulé !', right: 'Juste !', wrong: 'Presque.', idle: 'Appuyez sur Démarrer, puis cliquez sur l’élément.',
      og_title: 'Jeu de mise en évidence des origines', og_mode_select: 'Tous les cliquer', og_mode_which: 'Quelle source ?', og_select: 'Cliquez sur chaque élément formé (aussi) par :', og_which: 'Quelle source a aidé à former cet élément ?', og_new: 'Nouvelle manche', og_found: '{n} trouvés sur {m}', og_done: 'Tous trouvés !', og_next: 'Suivant', og_truth: 'Sources de {el}',
      tr_group: 'Groupe', tr_period: 'Période', tr_index: 'Numéro', tr_prop: 'Propriété', tr_lines: 'Lignes', tr_log: 'Log y', tr_copy: 'Copier le CSV', tr_copied: 'Copié', tr_x_el: 'Élément', tr_x_z: 'Numéro atomique Z', tr_gaps: 'Pas de données pour : {list}',
      iso_pick: 'Élément', iso_none: 'Aucun isotope stable.', iso_y: 'Abondance naturelle (%)', iso_sum: 'Somme : {s} %',
      src_caveat: 'Les classes d’origine sont qualitatives (d’après Johnson, OSU) : elles disent quels processus contribuent, pas dans quelle proportion. Le site du processus r reste débattu. Énergie d’ionisation et affinité électronique sont en eV ; kJ/mol = eV × 96,485.', src_list: 'Sources', prop_label: 'Propriété',
      timeline: 'Chronologie des découvertes', known_by: 'Connus jusqu’en', play: 'Lecture', compare: 'Comparer deux éléments', compare_hint: 'Choisissez un second élément : Maj+clic dans le tableau.', difference: 'Différence', bond_hint: 'La différence d’électronégativité suggère le type de liaison : <0,4 covalente apolaire, 0,4–1,7 covalente polaire, >1,7 surtout ionique (règle empirique).', image_scale: 'Échelle de l’image', pixels: 'pixels', downloaded: 'Téléchargement lancé', dl_failed: 'Impossible de créer le fichier',
      tab_data: 'Tableau de données', x_axis: 'Axe X', sort_hint: 'Cliquez sur un en-tête pour trier', rows_n: '{n} lignes', kbd_hint: 'Les flèches changent d’élément ; Entrée sélectionne, Maj+Entrée marque un second élément.', symbol: 'Symbole', name: 'Nom',
      origin_about_title: 'Comment les éléments se sont formés', origin_about: 'L’hydrogène, l’hélium et un peu de lithium se sont formés pendant les premières minutes après le Big Bang (nucléosynthèse primordiale). Presque tout le reste est né dans les étoiles : la fusion dans les étoiles massives construit les éléments jusqu’au groupe du fer ; les explosions d’étoiles massives (supernovae à effondrement de cœur) et de naines blanches (supernovae de type Ia) les dispersent. Les étoiles AGB fournissent par capture lente de neutrons (processus s) environ la moitié des éléments plus lourds que le fer ; l’autre moitié exige la capture rapide de neutrons (processus r), qui nécessite des densités neutroniques extrêmes. Elle est établie pour les fusions d’étoiles à neutrons, d’autres sites possibles restent débattus. Le lithium, le béryllium et le bore sont surtout détruits dans les étoiles et produits par spallation des rayons cosmiques. Beaucoup d’éléments ont plusieurs sources ; le tableau montre donc des ensembles et non une étiquette unique. Les masses de noyaux exotiques mesurées avec des pièges à ions (p. ex. à IGISOL/JYFLTRAP) donnent les énergies de séparation des neutrons, qui fixent le chemin du processus r et les points d’attente de capture de protons du processus rp : c’est le lien entre physique nucléaire et origine des éléments.',
      sch_country: 'Pays de découverte', cell_isocount: 'Isotopes stables (nombre)', cell_origincount: 'Nombre de sources d’origine', cell_text: 'Taille du texte dans les cases', localnames: 'Noms dans la langue du panneau', ex_key: 'Légende des couleurs et description dans les images enregistrées', ex_csv_desc: 'Lignes de description (#) dans le CSV', ex_csv_col: 'Colonnes de couleur dans le CSV',
      key_block: 'Chaque case est colorée selon la famille chimique de l’élément.', key_origin: 'Chaque case est colorée selon l’origine astrophysique ou humaine de l’élément ; les cases rayées ont plusieurs origines, le nombre indique les éléments de chaque classe.',
      key_country: 'Chaque case est colorée selon le pays de la découverte ; le nombre indique les éléments par pays.', key_state: 'Chaque case est colorée selon l’état de la matière à température ambiante et pression normale.',
      key_heat: 'La couleur de la case code la valeur de la propriété affichée, de la plus faible (extrémité gauche de la barre) à la plus forte (extrémité droite){log} ; les cases grises n’ont pas de données.',
      key_points: 'Chaque point est coloré selon la famille chimique de l’élément.', save_video: 'Enregistrer la vidéo de la chronologie', clear_sel: 'Désélectionner (Échap)'},
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
    const S = {lang: LANGS.some(l => l[0] === pageLang) ? pageLang : 'en', tab: 'table', scheme: 'block', prop: '', unit: 'eV', full: false, log: false, cell: 0, sel: 'Fe', mark: '', timeline: false, year: 2020, playTimer: 0, imgScale: 4, textScale: 1, localNames: true, exKey: true, exCsvDesc: false, exCsvColour: false, note: '', filter: null, query: '',
      trend: {kind: 'group', index: 1, prop: 'mass', lines: true, log: false}, trendz: {prop: 'mass', lines: true, log: false}, iso: 'Fe', find: null, findTimer: 0, findMsg: '', findSeconds: 60, findUseTimer: false, og: null, ogMode: 'select', ogMsg: ''};
    // The outline of the selected element is shown only after the user picks an element (or marks one); Esc or the "Clear selection" button hides it, so saved figures stay clean.
    let selValue = S.sel; Object.defineProperty(S, 'sel', {get: () => selValue, set: v => { selValue = v; S.showSel = true; }, enumerable: true}); S.showSel = false;
    const t = (key, vars = {}) => (UI[S.lang][key] || UI.en[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    const name = e => P.displayName(e, S.lang);
    const nameLang = () => (S.localNames ? S.lang : 'en'); // language of the names written into the cells, tooltips, images and CSV
    const cellName = e => P.displayName(e, nameLang());
    const TABS = ['table', 'origins', 'game', 'defs', 'iso', 'trend', 'trendz', 'data', 'sources'];
    const numProps = P.NUMERIC;

    // ---- shared pieces -----------------------------------------------------------------------
    function autoCell() { const w = app.clientWidth || 640; return Math.max(26, Math.min(64, Math.floor((w - 26) / 18) - 2)); }
    function grid(opts) { // opts: scheme, prop, unit, full, highlight(Set), onPick, selected, plain, found(Set), flash(sym, cls)
      const size = S.cell || autoCell(), scale = opts.scheme === 'heat' ? P.heatScale(m, opts.heatKey || 'mass', opts.unit, S.log) : null;
      const g = h('div', {class: 'pt-grid', style: {'--pt-cell': size + 'px'}, role: 'group', 'aria-label': t('tab_table')});
      for (let c = 1; c <= 18; c++) g.append(h('span', {class: 'pt-axis', style: {gridRow: 1, gridColumn: c + 1}}, c));
      for (const [r, label] of [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [10, '6*'], [11, '7*']]) g.append(h('span', {class: 'pt-axis', style: {gridRow: r, gridColumn: 1}}, label));
      for (const e of m.elements) {
        const base = opts.plain && !(opts.found && opts.found.has(e.sym)) ? {background: 'var(--zg-soft)', color: 'var(--zg-ink)', striped: false, dim: false}
          : P.cellStyle(m, e, opts.plain ? 'origin' : opts.scheme, {key: opts.heatKey || 'mass', unit: opts.unit, scale, highlight: opts.highlight});
        const nameTxt = opts.full && !opts.hideName ? cellName(e) : '', valTxt = opts.prop && !opts.hideValue ? P.cellText(m, e, opts.prop, S.lang, opts.unit) : '';
        const L = P.cellLayout(size, {textScale: S.textScale, sym: e.sym, z: e.z, name: nameTxt, value: valTxt, flag: opts.prop === 'country'});
        const at = (item, extra) => ({left: item.cx + 'px', top: item.cy + 'px', fontSize: item.px + 'px', ...extra});
        const cell = h('button', {type: 'button', class: 'pt-cell' + (base.striped ? ' striped' : '') + (base.dim ? ' dim' : '') + (opts.selected === e.sym ? ' sel' : '') + (opts.marked === e.sym ? ' mark' : ''), 'data-sym': e.sym, tabindex: (opts.selected || 'H') === e.sym ? 0 : -1,
          style: {gridRow: e.row + 1, gridColumn: e.col + 1, background: base.background, color: base.color},
          title: `${e.z} ${cellName(e)}` + (valTxt && !opts.hideName ? `: ${valTxt}` : ''), 'aria-label': `${e.z} ${e.sym} ${name(e)}`, onclick: ev => opts.onPick(e.sym, ev.shiftKey || ev.ctrlKey || ev.metaKey)},
          h('span', {class: 'pt-z', style: {left: L.z.x + 'px', top: L.z.y + 'px', fontSize: L.z.px + 'px'}}, e.z), h('span', {class: 'pt-sym', style: at(L.sym)}, e.sym),
          L.name ? h('span', {class: 'pt-name', style: at(L.name)}, nameTxt) : null, L.val ? h('span', {class: 'pt-val', style: at(L.val)}, valTxt) : null);
        g.append(cell);
      }
      g.addEventListener('keydown', ev => { // arrow keys walk the table; Enter / Space (native click) selects, Shift+Enter marks
        const dirs = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}, d = dirs[ev.key], cur = ev.target.closest && ev.target.closest('.pt-cell');
        if (!d || !cur) return;
        const next = P.neighbor(m, cur.dataset.sym, d[0], d[1]); if (!next) return;
        ev.preventDefault(); cur.tabIndex = -1; const to = g.querySelector(`[data-sym="${next}"]`); to.tabIndex = 0; to.focus();
      });
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
      } else if (scheme === 'country') {
        const counts = P.countryCounts(m);
        for (const c of m.i18n.countries.order) box.append(h('button', {type: 'button', class: 'pt-chip' + (activeFilter === c ? ' on' : ''), 'aria-pressed': String(activeFilter === c), onclick: () => onClick(c)}, h('i', {style: {background: m.i18n.countries.color[c]}}), `${m.i18n.countries.flag[c]} ${P.countryLabel(m, S.lang, c)}`, h('b', {}, counts[c])));
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
    function orbitalDiagram(e) { // one row per subshell: boxes with arrows (Hund's rule); the electron count is checked against Z
      const subs = P.subshells(m, e.sym), total = subs.reduce((n, x) => n + x.e, 0);
      return h('div', {class: 'pt-orbitals', role: 'img', 'aria-label': `${P.label(m, S.lang, 'config')}: ${e.config}`}, h('p', {class: 'zg-small zg-muted'}, `${e.config} · ${total} e⁻`),
        subs.map(x => h('div', {class: 'pt-orb-row'}, h('span', {class: 'pt-orb-label'}, `${x.n}${x.letter}`), P.orbitalFill(x.l, x.e).map(b => h('span', {class: 'pt-orb'}, (b.up ? '↑' : '') + (b.down ? '↓' : ''))), h('span', {class: 'pt-orb-n'}, x.e))));
    }
    function openDialog(e) {
      const dlg = h('dialog', {class: 'pt-dialog', 'aria-label': name(e)});
      const rows = m.i18n.properties.order.filter(k => k !== 'origin').map(k => h('tr', {title: P.definition(m, S.lang, k)}, h('th', {}, P.label(m, S.lang, k)), h('td', {}, P.formatValue(m, e, k, S.lang, S.unit))));
      dlg.append(h('div', {class: 'pt-dialog-body'}, ...elementCard(e).slice(0, 1), h('h3', {}, P.label(m, S.lang, 'origin')),
        originChips(e), ...e.origin.map(c => h('p', {class: 'zg-small'}, h('b', {}, P.originLabel(m, S.lang, c) + ': '), P.originDesc(m, S.lang, c))), e.trace ? h('p', {class: 'zg-small zg-muted'}, m.i18n.origins.trace[S.lang]) : null,
        h('h3', {}, P.label(m, S.lang, 'config')), orbitalDiagram(e),
        h('table', {class: 'pt-table'}, h('tbody', {}, rows)), h('button', {type: 'button', class: 'zg-btn', onclick: () => { dlg.close(); dlg.remove(); }}, t('close'))));
      dlg.addEventListener('click', ev => { if (ev.target === dlg) { dlg.close(); dlg.remove(); } });
      dlg.addEventListener('close', () => dlg.remove());
      document.body.append(dlg); dlg.showModal();
    }
    const select = (label, value, options, onchange, extra = {}) => h('label', {class: 'pt-field'}, label, h('select', {onchange: ev => onchange(ev.target.value), ...extra}, options.map(([v, text]) => h('option', {value: v, selected: String(v) === String(value)}, text))));
    const check = (label, on, onchange) => h('label', {class: 'pt-field pt-check'}, h('input', {type: 'checkbox', checked: on, onchange: ev => onchange(ev.target.checked)}), label);
    const extraLabel = k => (k === 'group' ? t('tr_group') : k === 'period' ? t('tr_period') : k === 'iso_n' ? t('cell_isocount') : k === 'origin_n' ? t('cell_origincount') : P.label(m, S.lang, k));
    const propOptions = (withNone) => [...(withNone ? [['', t('none_prop')]] : []), ...numProps.filter(k => k !== 'z' || withNone).map(k => [k, P.label(m, S.lang, k)]), ...(withNone ? P.CELL_EXTRAS.map(k => [k, extraLabel(k)]) : [])];
    const unitSelect = prop => (prop === 'ie' || prop === 'ea') ? select(t('unit'), S.unit, [['eV', 'eV'], ['kJ/mol', 'kJ/mol']], v => { S.unit = v; refresh(); }) : null;

    // ---- exports: PNG / SVG / CSV downloads (same geometry as the desktop version of this table) --------------------
    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', NSURI = 'http://www.w3.org/2000/svg';
    const esc = x => String(x).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
    function note(text) { S.note = text; const out = root.querySelector('[data-pt-note]'); if (out) out.textContent = text; }
    function download(blob, filename) { // starts a browser download of a Blob
      const url = URL.createObjectURL(blob), a = h('a', {href: url, download: filename});
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      note(t('downloaded') + ': ' + filename);
    }
    const attempt = fn => { try { fn(); } catch (err) { note(t('dl_failed') + ': ' + err.message); } };
    const dlBtn = (label, title, fn) => h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', title, onclick: () => attempt(fn)}, label);
    const stamp = () => `${S.lang}`;
    function cellData(e, snap) { // style, texts and layout of one cell for the export (cell edge 48 logical px)
      const st = P.cellStyle(m, e, snap.scheme, {key: snap.heatKey || 'mass', unit: snap.unit, scale: snap.scale, highlight: snap.hl}), nameTxt = snap.full ? P.displayName(e, snap.nameLang || S.lang) : '';
      const valTxt = snap.prop && !snap.hideValue ? P.cellText(m, e, snap.prop, S.lang, snap.unit) : '';
      return {st, name: nameTxt, value: valTxt, L: P.cellLayout(48, {textScale: snap.textScale || 1, sym: e.sym, z: e.z, name: nameTxt, value: valTxt, flag: snap.prop === 'country'})};
    }
    function roundRect(ctx, x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function drawCell(ctx, r, e, snap, c) { // one element cell on a canvas (logical pixels; the context carries the pixel scale)
      const d = cellData(e, snap), st = d.st, fills = st.fills, L = d.L;
      ctx.save(); if (st.dim) ctx.globalAlpha = 0.2;
      roundRect(ctx, r.x, r.y, c, c, c * 0.12);
      if (fills.length === 1) ctx.fillStyle = fills[0];
      else { const g = ctx.createLinearGradient(r.x, r.y, r.x + c, r.y + c), n = fills.length, eps = 0.002; fills.forEach((col, i) => { g.addColorStop(i === 0 ? 0 : i / n + eps, col); g.addColorStop(i === n - 1 ? 1 : (i + 1) / n - eps, col); }); ctx.fillStyle = g; }
      ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(0.6, c * 0.015); ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = `700 ${L.sym.px}px ${FONT}`;
      if (st.striped) { const w = ctx.measureText(e.sym).width + c * 0.14; ctx.fillStyle = 'rgba(255,255,255,.84)'; roundRect(ctx, r.x + L.sym.cx - w / 2, r.y + L.sym.y + L.sym.h * 0.08, w, L.sym.h * 0.86, c * 0.07); ctx.fill(); }
      ctx.fillStyle = st.color; ctx.fillText(e.sym, r.x + L.sym.cx, r.y + L.sym.cy);
      ctx.textAlign = 'left'; ctx.font = `${L.z.px}px ${FONT}`; ctx.fillText(String(e.z), r.x + L.z.x, r.y + L.z.y + L.z.h / 2);
      ctx.textAlign = 'center';
      if (L.name) { ctx.font = `${L.name.px}px ${FONT}`; ctx.fillText(d.name, r.x + L.name.cx, r.y + L.name.cy); }
      if (L.val) { ctx.font = `${L.val.px}px ${FONT}`; ctx.fillText(d.value, r.x + L.val.cx, r.y + L.val.cy); }
      ctx.restore();
      if (snap.mark === e.sym) { ctx.save(); ctx.setLineDash([c * 0.1, c * 0.06]); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = Math.max(1.5, c * 0.045); roundRect(ctx, r.x + c * 0.03, r.y + c * 0.03, c * 0.94, c * 0.94, c * 0.1); ctx.stroke(); ctx.restore(); }
      if (snap.sel === e.sym) { ctx.save(); ctx.strokeStyle = '#111111'; ctx.lineWidth = Math.max(1.5, c * 0.05); roundRect(ctx, r.x + c * 0.02, r.y + c * 0.02, c * 0.96, c * 0.96, c * 0.11); ctx.stroke(); ctx.restore(); }
    }
    const PERIOD_LABELS = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [9, '6*'], [10, '7*']];
    // Colour key of a saved image: title, legend chips (or the heat-map bar) and a wrapped description. It is built as drawing
    // primitives (text / rect / grad, coordinates relative to the key origin) that the canvas and the SVG writer both use.
    let measureCtx = null;
    const measurer = (px, weight = '') => { measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = `${weight} ${px}px ${FONT}`.trim(); return s => measureCtx.measureText(s).width; };
    const schemeName = scheme => ({block: t('sch_block'), origin: t('sch_origin'), country: t('sch_country'), state: t('sch_state'), heat: t('sch_heat')}[scheme] || '');
    function tableKey(snap, width, c) { // width in logical px, c = cell edge of the image; returns {h, prims}
      const px = c * 0.3, items = P.legendItems(m, snap.scheme, S.lang, {heatKey: snap.heatKey, unit: snap.unit, scale: snap.scale}), prims = [], log = items.bar && items.bar.log ? ' (log)' : '';
      let top = 0; // top edge of the next block
      prims.push({k: 'text', x: 0, y: top + px * 0.7, px: px * 1.15, bold: true, txt: `${t('scheme')}: ${schemeName(snap.scheme)}${snap.scheme === 'heat' ? ' – ' + P.label(m, S.lang, snap.heatKey || 'mass') : ''}`}); top += px * 1.5;
      if (items.bar) {
        const b = items.bar, bw = Math.min(width * 0.6, c * 8);
        prims.push({k: 'grad', x: 0, y: top, w: bw, h: px, stops: b.ramp}, {k: 'text', x: bw + px * 0.6, y: top + px / 2, px, txt: `${P.formatNumber(b.lo, S.lang, 4)} … ${P.formatNumber(b.hi, S.lang, 4)} ${b.unit}${log}`}); top += px * 1.6;
      } else {
        const lay = P.layoutChips(items.chips, width, px, measurer(px));
        for (const it of lay.items) prims.push({k: 'rect', x: it.x, y: top + it.y + (it.h - it.dot) / 2, w: it.dot, h: it.dot, fill: it.chip.fills[0]}, {k: 'text', x: it.x + it.dot + px * 0.3, y: top + it.y + it.h / 2, px, txt: it.text});
        top += lay.height + px * 0.3;
      }
      const desc = t(snap.points ? 'key_points' : 'key_' + snap.scheme, {log}) + (snap.scheme === 'origin' ? ' ' + t('src_caveat') : ''); // charts: "each point", not "each cell"
      for (const line of P.wrapText(desc, width, measurer(px * 0.92))) { prims.push({k: 'text', x: 0, y: top + px * 0.65, px: px * 0.92, muted: true, txt: line}); top += px * 1.3; }
      return {h: top, prims};
    }
    function drawKey(ctx, kb) { // canvas writer of the key primitives
      ctx.save(); ctx.translate(kb.x, kb.y); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const p of kb.key.prims) {
        if (p.k === 'text') { ctx.font = `${p.bold ? '700 ' : ''}${p.px}px ${FONT}`; ctx.fillStyle = p.muted ? '#555555' : '#222222'; ctx.fillText(p.txt, p.x, p.y); }
        else if (p.k === 'rect') { roundRect(ctx, p.x, p.y, p.w, p.h, p.w * 0.2); ctx.fillStyle = p.fill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6; ctx.stroke(); }
        else { const g = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0); p.stops.forEach((col, i) => g.addColorStop(i / (p.stops.length - 1), col)); ctx.fillStyle = g; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6; ctx.strokeRect(p.x, p.y, p.w, p.h); }
      }
      ctx.restore();
    }
    function keySvg(prims, ink = '#222', muted = '#555') { // SVG writer of the key primitives (ink colours for a dark chart background)
      return prims.map(p => (p.k === 'text' ? `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-size="${p.px.toFixed(2)}"${p.bold ? ' font-weight="700"' : ''} fill="${p.muted ? muted : ink}" dominant-baseline="middle">${esc(p.txt)}</text>`
        : p.k === 'rect' ? `<rect x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" rx="${(p.w * 0.2).toFixed(2)}" fill="${p.fill}" stroke="rgba(128,128,128,.6)" stroke-width=".6"/>`
        : `<defs><linearGradient id="keybar">${p.stops.map((col, i) => `<stop offset="${(i / (p.stops.length - 1)).toFixed(3)}" stop-color="${col}"/>`).join('')}</linearGradient></defs><rect x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" fill="url(#keybar)" stroke="rgba(128,128,128,.6)" stroke-width=".6"/>`)).join('');
    }
    function imageSize(snap, scale, withKey) { // geometry of the table image with or without the colour key below the table
      const c = 48, L = P.tableLayout(m, c), kb = withKey ? {key: tableKey(snap, L.width - L.left, c), x: L.left, y: L.height + 2 + c * 0.35} : null;
      return {c, L, kb, W: Math.ceil((L.width + 2) * scale), H: Math.ceil((L.height + 2 + (kb ? c * 0.35 + kb.key.h + 4 : 0)) * scale), vw: Math.ceil(L.width + 2), vh: Math.ceil(L.height + 2 + (kb ? c * 0.35 + kb.key.h + 4 : 0))};
    }
    function tableCanvas(snap, scale, withKey = true) { // the table (and optionally its colour key) as a canvas of (width x scale) pixels
      const {c, L, kb, W, H} = imageSize(snap, scale, withKey);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'); if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.scale(scale, scale);
      ctx.fillStyle = '#555555'; ctx.font = `${c * 0.24}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let col = 1; col <= 18; col++) ctx.fillText(String(col), L.left + (col - 1) * L.pitch + c / 2, L.top / 2);
      ctx.textAlign = 'right'; for (const [row, label] of PERIOD_LABELS) ctx.fillText(label, L.left * 0.85, L.top + P.rowOffset(row) * L.pitch + c / 2);
      for (const e of m.elements) drawCell(ctx, L.rects[e.sym], e, snap, c);
      if (kb) drawKey(ctx, kb);
      return cv;
    }
    function tableSvg(snap, withKey = true) { // the table (and optionally its colour key) as scalable vector graphics
      const {c, L, kb, vw: W, vh: H} = imageSize(snap, 1, withKey), defs = new Map(), parts = [];
      const gradient = fills => { const key = fills.join(''); if (!defs.has(key)) defs.set(key, `<linearGradient id="g${defs.size}" x1="0" y1="0" x2="1" y2="1">${fills.map((col, i) => `<stop offset="${i === 0 ? 0 : (i / fills.length + 0.002).toFixed(4)}" stop-color="${col}"/><stop offset="${i === fills.length - 1 ? 1 : ((i + 1) / fills.length - 0.002).toFixed(4)}" stop-color="${col}"/>`).join('')}</linearGradient>`); return `url(#g${[...defs.keys()].indexOf(key)})`; };
      for (let col = 1; col <= 18; col++) parts.push(`<text x="${(L.left + (col - 1) * L.pitch + c / 2).toFixed(2)}" y="${(L.top / 2).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="${c * 0.24}" fill="#555">${col}</text>`);
      for (const [row, label] of PERIOD_LABELS) parts.push(`<text x="${(L.left * 0.85).toFixed(2)}" y="${(L.top + P.rowOffset(row) * L.pitch + c / 2).toFixed(2)}" text-anchor="end" dominant-baseline="middle" font-size="${c * 0.24}" fill="#555">${label}</text>`);
      for (const e of m.elements) {
        const r = L.rects[e.sym], d = cellData(e, snap), st = d.st, Y = d.L, g = [`<g${st.dim ? ' opacity="0.2"' : ''}>`, `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${c}" height="${c}" rx="${c * 0.12}" fill="${st.fills.length === 1 ? st.fills[0] : gradient(st.fills)}" stroke="rgba(0,0,0,.22)" stroke-width="${Math.max(0.6, c * 0.015)}"/>`];
        const T = (x, y, px, extra, txt, anchor = 'middle') => `<text x="${(r.x + x).toFixed(2)}" y="${(r.y + y).toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${px.toFixed(2)}" fill="${st.color}"${extra}>${esc(txt)}</text>`;
        if (st.striped) { const w = Y.sym.px * 0.62 * e.sym.length + c * 0.14; g.push(`<rect x="${(r.x + Y.sym.cx - w / 2).toFixed(2)}" y="${(r.y + Y.sym.y + Y.sym.h * 0.08).toFixed(2)}" width="${w.toFixed(2)}" height="${(Y.sym.h * 0.86).toFixed(2)}" rx="${c * 0.07}" fill="rgba(255,255,255,.84)"/>`); }
        g.push(T(Y.sym.cx, Y.sym.cy, Y.sym.px, ' font-weight="700"', e.sym), T(Y.z.x, Y.z.y + Y.z.h / 2, Y.z.px, '', String(e.z), 'start'));
        if (Y.name) g.push(T(Y.name.cx, Y.name.cy, Y.name.px, '', d.name));
        if (Y.val) g.push(T(Y.val.cx, Y.val.cy, Y.val.px, '', d.value));
        g.push('</g>');
        if (snap.mark === e.sym) g.push(`<rect x="${(r.x + c * 0.03).toFixed(2)}" y="${(r.y + c * 0.03).toFixed(2)}" width="${c * 0.94}" height="${c * 0.94}" rx="${c * 0.1}" fill="none" stroke="#e5484d" stroke-width="${Math.max(1.5, c * 0.045)}" stroke-dasharray="${c * 0.1} ${c * 0.06}"/>`);
        if (snap.sel === e.sym) g.push(`<rect x="${(r.x + c * 0.02).toFixed(2)}" y="${(r.y + c * 0.02).toFixed(2)}" width="${c * 0.96}" height="${c * 0.96}" rx="${c * 0.11}" fill="none" stroke="#111" stroke-width="${Math.max(1.5, c * 0.05)}"/>`);
        parts.push(g.join(''));
      }
      if (kb) parts.push(`<g transform="translate(${kb.x.toFixed(2)} ${kb.y.toFixed(2)})">${keySvg(kb.key.prims)}</g>`);
      return `<svg xmlns="${NSURI}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT.replace(/"/g, '&quot;')}'><rect width="${W}" height="${H}" fill="#fff"/><defs>${[...defs.values()].join('')}</defs>${parts.join('')}</svg>`;
    }
    function inlineSvg(svg, withKey = false) { // copy of a chart SVG with the computed colours and fonts written into it (CSS variables resolved); withKey adds the block colour key below a chart that marks it (data-key)
      const clone = svg.cloneNode(true), src = [svg, ...svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
      src.forEach((node, i) => { const cs = getComputedStyle(node); for (const prop of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity']) dst[i].style.setProperty(prop, cs.getPropertyValue(prop)); });
      const vb = svg.viewBox.baseVal, card = svg.closest('.zg-card'), bg = document.createElementNS(NSURI, 'rect');
      let extra = 0, keyG = null; // height added for the colour key
      if (withKey && svg.getAttribute('data-key') === 'block') {
        const kk = tableKey({scheme: 'block', points: true}, vb.width - 24, 40), tick = svg.querySelector('text'), ink = tick ? getComputedStyle(tick).fill : '#222222';
        extra = kk.h + 14; keyG = document.createElementNS(NSURI, 'g'); keyG.setAttribute('transform', `translate(12 ${vb.height + 6})`); keyG.innerHTML = keySvg(kk.prims, ink, ink);
      }
      clone.setAttribute('xmlns', NSURI); clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height + extra); clone.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height + extra}`);
      clone.setAttribute('font-family', FONT);
      bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height + extra); bg.setAttribute('fill', card ? getComputedStyle(card).backgroundColor : '#ffffff'); clone.insertBefore(bg, clone.firstChild);
      if (keyG) clone.append(keyG);
      return {text: new XMLSerializer().serializeToString(clone), w: vb.width, h: vb.height + extra};
    }
    function svgPng(svg, scale, filename) { // chart -> PNG with (viewBox width x scale) pixels
      const {text, w, h: hh} = inlineSvg(svg, S.exKey), img = new Image();
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(hh * scale); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(b => (b ? download(b, filename) : note(t('dl_failed'))), 'image/png'); };
      img.onerror = () => note(t('dl_failed'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    }
    const scaleSelect = after => select(t('image_scale'), S.imgScale, [1, 2, 3, 4, 6, 8].map(x => [x, x + '×']), v => { S.imgScale = Number(v); if (after) after(); });
    const chartButtons = (svg, stem) => [scaleSelect(), svg.getAttribute('data-key') ? check(t('ex_key'), S.exKey, v => { S.exKey = v; }) : null, dlBtn('PNG', 'PNG', () => svgPng(svg, S.imgScale, `${stem}-${stamp()}.png`)), dlBtn('SVG', 'SVG', () => download(new Blob([inlineSvg(svg, S.exKey).text], {type: 'image/svg+xml'}), `${stem}-${stamp()}.svg`))];
    const csvDownload = (rows, stem, comments = []) => download(new Blob(['﻿' + P.toCsv(rows, comments)], {type: 'text/csv;charset=utf-8'}), `${stem}-${stamp()}.csv`);
    // Description lines for the colour columns of the CSV: scheme, its explanation and the colour of every class.
    function colourNotes(snap) {
      const items = P.legendItems(m, snap.scheme, S.lang, {heatKey: snap.heatKey, unit: snap.unit, scale: snap.scale});
      return [`${t('scheme')}: ${schemeName(snap.scheme)}`, t('key_' + snap.scheme, {log: items.bar && items.bar.log ? ' (log)' : ''}) + ' [colour_class, colour_hex]',
        ...(items.bar ? [`${P.formatNumber(items.bar.lo, S.lang, 6)} ... ${P.formatNumber(items.bar.hi, S.lang, 6)} ${items.bar.unit}: ${items.bar.ramp.join(' -> ')}; no data: #e5e7eb`] : items.chips.map(c => `${c.fills[0]} = ${c.label} (${c.count})`))];
    }
    function tableCsv() { // data export of the whole table; options: colour columns and # description lines (both off by default)
      const heatKey = P.NUMERIC.includes(S.prop) ? S.prop : 'mass', snap = S.snap || {scheme: S.scheme, heatKey, unit: S.unit, scale: S.scheme === 'heat' ? P.heatScale(m, heatKey, S.unit, S.log) : null};
      const rows = P.csvRows(m, S.lang, {nameLang: nameLang(), colour: S.exCsvColour ? {scheme: snap.scheme, key: snap.heatKey || 'mass', unit: snap.unit, scale: snap.scale || undefined} : null});
      csvDownload(rows, 'periodic-table-data', S.exCsvDesc ? P.csvComments(m, S.lang, m.i18n.properties.order, S.exCsvColour ? colourNotes(snap) : []) : []);
    }

    // ---- tabs --------------------------------------------------------------------------------
    const tabs = {};
    tabs.table = () => {
      const host = h('div'), bar = h('div', {class: 'pt-bar-row'}), body = h('div', {class: 'pt-body'}), cardEl = h('div', {class: 'pt-card'}), narrow = h('div', {class: 'pt-card pt-card-narrow'});
      let yearIn = null, yearOut = null;
      S.drawTable = () => draw();
      const search = h('input', {type: 'search', class: 'pt-search', placeholder: t('search'), 'aria-label': t('search'), value: S.query, oninput: ev => { S.query = ev.target.value; draw(); }, onkeydown: ev => { if (ev.key === 'Enter') { const r = P.search(m, S.query); if (r[0]) { S.sel = r[0]; draw(); } } }});
      const stopPlay = () => { clearInterval(S.playTimer); S.playTimer = 0; };
      function togglePlay() {
        if (S.playTimer) { stopPlay(); return; }
        if (S.year >= 2020) S.year = 1650;
        S.playTimer = setInterval(() => { S.year = Math.min(2020, S.year + 3); if (yearIn) yearIn.value = S.year; draw(); if (S.year >= 2020) stopPlay(); }, 90);
      }
      // Save the discovery timeline (the same steps as Play) as a video; a header band shows the year, the number of known elements and a progress bar.
      function recordTimeline(btn) {
        if (!window.zgExport || !window.zgExport.record) { note(t('dl_failed')); return; }
        stopPlay();
        const years = P.timelineYears(1650, 2020, 3), base = {...S.snap, sel: '', mark: '', hl: null}, scale = 1.4, label = btn.textContent;
        const frame = year => tableCanvas({...base, hl: P.knownBy(m, year)}, scale, S.exKey);
        const first = frame(years[0]), band = Math.round(78 * scale), cv = document.createElement('canvas');
        cv.width = first.width; cv.height = first.height + band;
        const ctx = cv.getContext('2d');
        const paint = year => {
          const known = P.knownBy(m, year), tc = frame(year), pad = 14 * scale, barW = cv.width - 2 * pad, barY = 46 * scale, frac = (year - 1650) / 370;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = '#222222'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `700 ${24 * scale}px system-ui, sans-serif`;
          ctx.fillText(`${t('known_by')}: ${year}`, pad, 22 * scale);
          ctx.textAlign = 'right'; ctx.font = `600 ${18 * scale}px system-ui, sans-serif`; ctx.fillText(`${known.size} / ${m.elements.length}`, cv.width - pad, 22 * scale);
          ctx.fillStyle = '#e5e7eb'; ctx.fillRect(pad, barY, barW, 9 * scale);
          ctx.fillStyle = '#3b82f6'; ctx.fillRect(pad, barY, barW * frac, 9 * scale);
          ctx.fillStyle = '#1e3a8a'; ctx.fillRect(pad + barW * frac - 1.5 * scale, barY - 4 * scale, 3 * scale, 17 * scale);
          ctx.fillStyle = '#555555'; ctx.font = `${11 * scale}px system-ui, sans-serif`; ctx.textAlign = 'center';
          for (const y of [1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2020]) ctx.fillText(String(y), pad + barW * (y - 1650) / 370, barY + 24 * scale);
          ctx.drawImage(tc, 0, band);
        };
        const stepMs = 90, hold = 8, frames = [...Array(hold).fill(years[0]), ...years, ...Array(hold).fill(years[years.length - 1])];
        paint(frames[0]);
        const rec = window.zgExport.record(cv, frames.length * stepMs / 1000 + 0.8, 'periodic-table-timeline', on => { btn.disabled = on; btn.textContent = on ? '… ' + t('save_video') : label; }, {fps: 30, bitrate: 8e6});
        if (!rec) return;
        let i = 0; const timer = setInterval(() => { i += 1; if (i >= frames.length) { clearInterval(timer); return; } paint(frames[i]); }, stepMs);
      }
      function rebuildBar() {
        const videoBtn = S.timeline ? h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', 'data-timeline-video': '', onclick: () => recordTimeline(videoBtn)}, '🎬 ' + t('save_video')) : null;
        yearIn = S.timeline ? h('input', {type: 'range', min: 1650, max: 2020, step: 1, value: S.year, 'aria-label': t('known_by'), oninput: ev => { S.year = Number(ev.target.value); draw(); }}) : null;
        yearOut = S.timeline ? h('output', {class: 'pt-year'}) : null;
        fill(bar, select(t('scheme'), S.scheme, [['block', t('sch_block')], ['origin', t('sch_origin')], ['country', t('sch_country')], ['state', t('sch_state')], ['heat', t('sch_heat')]], v => { S.scheme = v; S.filter = null; rebuildBar(); draw(); }),
          select(t('show'), S.prop, propOptions(true), v => { S.prop = v; rebuildBar(); draw(); }), unitSelect(S.prop || (S.scheme === 'heat' ? 'mass' : '')), check(t('fullnames'), S.full, v => { S.full = v; draw(); }), check(t('localnames'), S.localNames, v => { S.localNames = v; draw(); }),
          S.scheme === 'heat' ? check(t('logscale'), S.log, v => { S.log = v; draw(); }) : null,
          check(t('timeline'), S.timeline, v => { S.timeline = v; if (!v) stopPlay(); rebuildBar(); draw(); }), yearIn, yearOut, S.timeline ? h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: togglePlay}, '▶ ' + t('play')) : null, videoBtn,
          h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', 'data-clear-selection': '', title: t('clear_sel'), onclick: clearSelection}, '✕ ' + t('clear_sel')),
          h('label', {class: 'pt-field'}, t('cell'), h('input', {type: 'range', min: 24, max: 80, step: 1, value: S.cell || autoCell(), oninput: ev => { S.cell = Number(ev.target.value); draw(); }})),
          h('label', {class: 'pt-field'}, `${t('cell_text')} (${Math.round(S.textScale * 100)} %)`, h('input', {type: 'range', min: 50, max: 200, step: 5, value: Math.round(S.textScale * 100), 'aria-label': t('cell_text'), oninput: ev => { S.textScale = Number(ev.target.value) / 100; rebuildBar(); draw(); }})), search);
      }
      function compareBox() { // second element: Shift/Ctrl/Cmd+click in the table
        if (!S.mark) return h('p', {class: 'zg-small zg-muted'}, t('compare_hint'));
        const A = m.bySym[S.sel], B = m.bySym[S.mark], rows = P.compareRows(m, S.sel, S.mark, S.unit), delta = A.chi !== null && B.chi !== null ? Math.abs(B.chi - A.chi) : null;
        return h('div', {class: 'pt-compare'}, h('table', {class: 'pt-table'}, h('thead', {}, h('tr', {}, h('th', {}, t('compare')), h('th', {}, `${A.z} ${A.sym}`), h('th', {}, `${B.z} ${B.sym}`), h('th', {}, t('difference')))),
          h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, P.label(m, S.lang, r.key)), h('td', {}, P.formatValue(m, A, r.key, S.lang, S.unit)), h('td', {}, P.formatValue(m, B, r.key, S.lang, S.unit)), h('td', {}, r.diff === null ? '' : P.formatNumber(r.diff, S.lang, 4)))))),
          delta === null ? null : h('p', {class: 'zg-small'}, `Δχ = ${P.formatNumber(delta, S.lang, 3)} – ${t('bond_hint')}`), h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: () => { S.mark = ''; draw(); }}, '× ' + t('close')));
      }
      function draw() {
        const prop = S.prop || (S.scheme === 'heat' ? 'mass' : S.scheme === 'country' ? 'country' : ''), heatKey = P.NUMERIC.includes(S.prop) ? S.prop : 'mass', found = S.query ? new Set(P.search(m, S.query)) : null, known = S.timeline ? P.knownBy(m, S.year) : null;
        let hl = found && found.size ? found : null;
        if (S.filter) hl = new Set(m.elements.filter(e => S.scheme === 'origin' ? e.origin.includes(S.filter) : S.scheme === 'country' ? e.cc.includes(S.filter) : e.block === S.filter).map(e => e.sym));
        if (known) hl = hl ? new Set([...hl].filter(x => known.has(x))) : known;
        const hideValue = !prop;
        const g = grid({scheme: S.scheme, prop, heatKey, unit: S.unit, full: S.full, highlight: hl, selected: S.showSel ? S.sel : '', marked: S.mark, onPick: (sym, shift) => { S.showSel = true; if (shift) S.mark = S.mark === sym ? '' : sym; else S.sel = sym; draw(); }, hideValue});
        S.snap = {scheme: S.scheme, prop, heatKey, textScale: S.textScale, unit: S.unit, full: S.full, nameLang: nameLang(), hl, sel: S.showSel ? S.sel : '', mark: S.mark, scale: g.scale, hideValue};
        if (yearOut) yearOut.textContent = `${t('known_by')}: ${S.year} (${known.size})`;
        const e = m.bySym[S.sel], sizeText = () => { const sz = imageSize(S.snap, S.imgScale, S.exKey); return `→ ${sz.W} × ${sz.H} ${t('pixels')}`; };
        const sizeLabel = h('span', {class: 'zg-small zg-muted'}, sizeText()), updateSize = () => { sizeLabel.textContent = sizeText(); }; // pixel size of the image follows scale and colour-key option
        fill(cardEl, ...elementCard(e, true)); fill(narrow, ...elementCard(e));
        g.el.append(cardEl);
        fill(body, narrow, h('div', {class: 'pt-scroll'}, g.el), legend(S.scheme, g.scale, heatKey, S.unit, c => { S.filter = S.filter === c ? null : c; draw(); }, S.filter),
          (S.scheme === 'block' || S.scheme === 'origin' || S.scheme === 'country') ? h('p', {class: 'zg-small zg-muted'}, S.scheme === 'origin' ? t('legend_hint') + ' · ' + t('src_caveat') : t('legend_hint')) : null, found ? h('p', {class: 'zg-small'}, t('n_el', {n: found.size})) : null,
          h('p', {class: 'zg-small zg-muted'}, t('kbd_hint')),
          compareBox(),
          h('div', {class: 'pt-bar-row pt-export'}, scaleSelect(updateSize), sizeLabel,
            dlBtn('PNG', t('image_scale'), () => tableCanvas(S.snap, S.imgScale, S.exKey).toBlob(b => (b ? download(b, `periodic-table-${S.scheme}-${stamp()}.png`) : note(t('dl_failed'))), 'image/png')),
            dlBtn('SVG', 'SVG', () => download(new Blob([tableSvg(S.snap, S.exKey)], {type: 'image/svg+xml'}), `periodic-table-${S.scheme}-${stamp()}.svg`)),
            dlBtn('CSV', 'CSV', tableCsv)),
          h('div', {class: 'pt-bar-row pt-export'}, check(t('ex_key'), S.exKey, v => { S.exKey = v; updateSize(); }), check(t('ex_csv_desc'), S.exCsvDesc, v => { S.exCsvDesc = v; }), check(t('ex_csv_col'), S.exCsvColour, v => { S.exCsvColour = v; })),
          h('p', {class: 'zg-small zg-muted', role: 'status', 'data-pt-note': ''}, S.note));
      }
      rebuildBar(); draw(); host.append(bar, body); return host;
    };

    tabs.origins = () => {
      const host = h('div'), top = h('div'), game = h('div', {class: 'pt-game'});
      function drawTop() {
        const gr = grid({scheme: 'origin', full: S.full, selected: S.showSel ? S.sel : '', highlight: S.filter ? new Set(m.elements.filter(e => e.origin.includes(S.filter)).map(e => e.sym)) : null, hideValue: true, onPick: sym => { S.sel = sym; drawTop(); }});
        const e = m.bySym[S.sel], cards = h('div', {class: 'pt-origin-cards'}, m.i18n.origins.order.map(c => h('button', {type: 'button', class: 'pt-origin-card' + (S.filter === c ? ' on' : ''), style: {'--pt-oc': m.i18n.origins.color[c]}, onclick: () => { S.filter = S.filter === c ? null : c; drawTop(); }}, h('b', {}, P.originLabel(m, S.lang, c)), h('span', {}, P.originDesc(m, S.lang, c)))));
        gr.el.append(h('div', {class: 'pt-card'}, ...elementCard(e, true).filter(Boolean)));
        fill(top, h('div', {class: 'pt-bar-row'}, check(t('fullnames'), S.full, v => { S.full = v; drawTop(); }), check(t('localnames'), S.localNames, v => { S.localNames = v; drawTop(); }), h('label', {class: 'pt-field'}, `${t('cell_text')} (${Math.round(S.textScale * 100)} %)`, h('input', {type: 'range', min: 50, max: 200, step: 5, value: Math.round(S.textScale * 100), 'aria-label': t('cell_text'), oninput: ev => { S.textScale = Number(ev.target.value) / 100; drawTop(); }}))), h('div', {class: 'pt-card pt-card-narrow'}, ...elementCard(e).filter(Boolean)), h('div', {class: 'pt-scroll'}, gr.el), h('p', {class: 'zg-small zg-muted'}, t('legend_hint')), cards, h('p', {class: 'zg-small zg-muted'}, t('src_caveat')));
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
      drawTop(); drawGame(); host.append(top, h('details', {class: 'pt-about'}, h('summary', {}, t('origin_about_title')), h('p', {}, t('origin_about'))), game); return host;
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
        fill(out, bar, svg, h('p', {class: 'zg-small zg-muted'}, t('iso_sum', {s: P.formatNumber(e.iso.reduce((s, i) => s + i.pct, 0), S.lang, 5)})), originChips(e), h('div', {class: 'pt-bar-row'}, ...chartButtons(svg, `isotopes-${e.sym}`)), h('p', {class: 'zg-small zg-muted', role: 'status', 'data-pt-note': ''}, S.note));
      }
      draw(); host.append(out); return host;
    };

    function trendView(cfg, kind) { // cfg: {kind,index,prop,lines,log}; kind 'z' uses all elements
      const host = h('div'), out = h('div');
      function draw() {
        const isZ = kind === 'z', xKey = isZ ? (cfg.x || 'z') : 'z', scat = isZ && xKey !== 'z';
        const pts = scat ? P.scatter(m, xKey, cfg.prop, S.unit, S.unit).map((p, i) => ({...p, i})) : P.trend(m, isZ ? 'z' : cfg.kind, cfg.index, cfg.prop, S.unit), vals = pts.filter(p => p.y !== null).map(p => p.y);
        const useLog = cfg.log && vals.length && vals.every(v => v > 0), f = v => (useLog ? Math.log10(v) : v);
        const controls = h('div', {class: 'pt-bar-row'}, isZ ? null : select(t('tr_group') + ' / ' + t('tr_period'), cfg.kind, [['group', t('tr_group')], ['period', t('tr_period')]], v => { cfg.kind = v; cfg.index = 1; draw(); }),
          isZ ? null : select(t('tr_index'), cfg.index, Array.from({length: cfg.kind === 'group' ? 18 : 7}, (_, i) => [i + 1, i + 1]), v => { cfg.index = Number(v); draw(); }),
          isZ ? select(t('x_axis'), xKey, numProps.map(k => [k, P.label(m, S.lang, k)]), v => { cfg.x = v; cfg.lines = v === 'z'; draw(); }) : null,
          select(t('tr_prop'), cfg.prop, numProps.filter(k => k !== 'z').map(k => [k, P.label(m, S.lang, k)]), v => { cfg.prop = v; draw(); }), unitSelect(cfg.prop),
          check(t('tr_lines'), cfg.lines, v => { cfg.lines = v; draw(); }), check(t('tr_log'), cfg.log, v => { cfg.log = v; draw(); }));
        const gaps = pts.filter(p => p.y === null).map(p => p.sym);
        const csv = () => ['Z,symbol,' + (scat ? xKey + ',' : '') + cfg.prop + (P.unitFor(m, cfg.prop, S.unit) ? ` [${P.unitFor(m, cfg.prop, S.unit)}]` : ''), ...pts.map(p => `${p.z},${p.sym},${scat ? p.x + ',' : ''}${p.y === null ? '' : p.y}`)].join('\n');
        const readout = h('p', {class: 'zg-small', 'aria-live': 'polite'}, ' ');
        let svg = h('p', {class: 'zg-muted'}, t('missing'));
        if (vals.length) {
          const W = 720, H = 360, L = 64, R = 14, T = 16, B = 48;
          let lo = Math.min(...vals.map(f)), hi = Math.max(...vals.map(f)); if (lo === hi) { lo -= 1; hi += 1; }
          const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
          const yt = useLog ? Array.from({length: Math.floor(hi) - Math.ceil(lo) + 1}, (_, i) => Math.ceil(lo) + i) : P.niceTicks(lo, hi, 6);
          const zmax = Math.max(...pts.map(p => p.z)), zmin = Math.min(...pts.map(p => p.z));
          let xlo = 0.5, xhi = 118.5; if (scat) { xlo = Math.min(...pts.map(p => p.x)); xhi = Math.max(...pts.map(p => p.x)); if (xlo === xhi) { xlo -= 1; xhi += 1; } const xp = (xhi - xlo) * 0.04; xlo -= xp; xhi += xp; }
          const x = p => isZ ? L + ((scat ? p.x : p.z) - xlo) / (xhi - xlo) * (W - L - R) : L + (p.i + 0.5) / pts.length * (W - L - R), y = v => T + (H - T - B) * (1 - (f(v) - lo) / (hi - lo));
          const segs = []; let run = []; for (const p of pts) { if (p.y === null) { if (run.length) segs.push(run); run = []; } else run.push(p); } if (run.length) segs.push(run);
          svg = h('svg:svg', {viewBox: `0 0 ${W} ${H}`, class: 'pt-svg', role: 'img', 'aria-label': P.label(m, S.lang, cfg.prop), 'data-key': 'block'},
            yt.map(v => [h('svg:line', {x1: L, x2: W - R, y1: T + (H - T - B) * (1 - (v - lo) / (hi - lo)), y2: T + (H - T - B) * (1 - (v - lo) / (hi - lo)), class: 'pt-gridline'}),
              h('svg:text', {x: L - 6, y: T + (H - T - B) * (1 - (v - lo) / (hi - lo)) + 4, class: 'pt-tick', 'text-anchor': 'end'}, useLog ? P.formatNumber(10 ** v, S.lang, 3) : P.formatNumber(v, S.lang, 4))]),
            isZ ? (scat ? P.niceTicks(xlo, xhi, 8) : P.niceTicks(zmin, zmax + 1, 13).filter(v => v >= 1 && v <= 118)).map(v => h('svg:text', {x: x({z: v, x: v}), y: H - B + 16, class: 'pt-tick', 'text-anchor': 'middle'}, P.formatNumber(v, S.lang, 4))) : pts.map(p => h('svg:text', {x: x(p), y: H - B + 16, class: 'pt-tick big', 'text-anchor': 'middle'}, p.sym)),
            cfg.lines ? segs.map(seg => h('svg:polyline', {points: seg.map(p => `${x(p)},${y(p.y)}`).join(' '), class: 'pt-line'})) : null,
            pts.filter(p => p.y !== null).map(p => h('svg:circle', {cx: x(p), cy: y(p.y), r: isZ ? 3.2 : 5, fill: m.i18n.groups.color[p.block], class: 'pt-dot', tabindex: 0,
              onmouseenter: () => { readout.textContent = `${p.z} ${p.sym} (${name(m.bySym[p.sym])}): ${scat ? P.formatNumber(p.x, S.lang, 5) + ', ' : ''}${P.formatNumber(p.y, S.lang, 5)} ${P.unitFor(m, cfg.prop, S.unit)}`; }, onfocus: () => { readout.textContent = `${p.z} ${p.sym}: ${P.formatNumber(p.y, S.lang, 5)}`; }}, h('svg:title', {}, `${p.z} ${p.sym}: ${scat ? P.formatNumber(p.x, S.lang, 5) + ', ' : ''}${P.formatNumber(p.y, S.lang, 5)}`))),
            h('svg:text', {x: (L + W - R) / 2, y: H - 6, class: 'pt-axis-title', 'text-anchor': 'middle'}, scat ? `${P.label(m, S.lang, xKey)}${P.unitFor(m, xKey, S.unit) ? ' (' + P.unitFor(m, xKey, S.unit) + ')' : ''}` : isZ ? t('tr_x_z') : t('tr_x_el')),
            h('svg:text', {x: 14, y: (T + H - B) / 2, class: 'pt-axis-title', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(T + H - B) / 2})`}, `${P.label(m, S.lang, cfg.prop)} ${P.unitFor(m, cfg.prop, S.unit) ? '(' + P.unitFor(m, cfg.prop, S.unit) + ')' : ''}`));
        }
        const copy = h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: ev => { const b = ev.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(csv()) : Promise.reject()).then(() => { b.textContent = t('tr_copied'); setTimeout(() => { b.textContent = t('tr_copy'); }, 1500); }).catch(() => { b.textContent = '⚠'; }); }}, t('tr_copy'));
        const table = h('table', {class: 'pt-table'}, h('thead', {}, h('tr', {}, h('th', {}, 'Z'), h('th', {}, ''), scat ? h('th', {}, P.label(m, S.lang, xKey)) : null, h('th', {}, P.label(m, S.lang, cfg.prop)))),
          h('tbody', {}, pts.map(p => h('tr', {}, h('td', {}, p.z), h('td', {}, p.sym), scat ? h('td', {}, P.formatNumber(p.x, S.lang, 5)) : null, h('td', {}, p.y === null ? '–' : P.formatNumber(p.y, S.lang, 5))))));
        fill(out, controls, svg, readout, gaps.length ? h('p', {class: 'zg-small zg-muted'}, t('tr_gaps', {list: gaps.join(', ')})) : null,
          h('div', {class: 'pt-bar-row'}, copy, h('button', {type: 'button', class: 'zg-btn zg-btn-ghost', onclick: () => attempt(() => csvDownload([['Z', 'symbol', 'name', ...(scat ? [`${xKey} [${P.unitFor(m, xKey, S.unit)}]`] : []), `${cfg.prop} [${P.unitFor(m, cfg.prop, S.unit)}]`], ...pts.map(p => [String(p.z), p.sym, cellName(m.bySym[p.sym]), ...(scat ? [String(p.x)] : []), p.y === null ? '' : String(p.y)])], `periodic-table-${scat ? xKey + '-vs-' : ''}${cfg.prop}`))}, 'CSV'), ...(vals.length ? chartButtons(svg, `periodic-table-${cfg.prop}`) : [])), h('p', {class: 'zg-small zg-muted', role: 'status', 'data-pt-note': ''}, S.note), h('details', {}, h('summary', {}, t('tab_trend')), table));
      }
      draw(); host.append(out); return host;
    }
    tabs.trend = () => trendView(S.trend, 'ptz-group');
    tabs.trendz = () => trendView(S.trendz, 'z');

    tabs.data = () => {
      const host = h('div'), out = h('div'); let key = 'z', asc = true, filter = '';
      const cols = P.DATA_COLUMNS, headLabel = k => (k === 'sym' ? t('symbol') : k === 'name' ? t('name') : P.label(m, S.lang, k === 'sym' ? 'z' : k)) + ((k === 'ie' || k === 'ea') ? ` (${S.unit})` : (m.i18n.properties.unit[k] && !['z', 'year'].includes(k) ? ` (${m.i18n.properties.unit[k]})` : ''));
      const fmt = (k, v) => (v === null || v === undefined || v === '' ? '–' : typeof v === 'number' ? (k === 'z' || k === 'year' ? String(v) : P.formatNumber(v, S.lang, 5)) : String(v));
      function draw() {
        let rows = P.sortRows(P.dataRows(m, S.lang, S.unit).map(r => ({...r, name: cellName(m.bySym[r.sym])})), key, asc, S.lang); // names follow the "names in the panel language" option
        if (filter) { const f = filter.toLowerCase(); rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(f))); }
        const head = h('tr', {}, cols.map(k => h('th', {scope: 'col', 'aria-sort': key === k ? (asc ? 'ascending' : 'descending') : 'none', class: 'pt-sortable', tabindex: 0, onclick: () => { if (key === k) asc = !asc; else { key = k; asc = true; } draw(); }, onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.target.click(); } }}, headLabel(k) + (key === k ? (asc ? ' ▲' : ' ▼') : ''))));
        const bar = h('div', {class: 'pt-bar-row'}, h('input', {type: 'search', class: 'pt-search', placeholder: t('search'), 'aria-label': t('search'), value: filter, oninput: ev => { filter = ev.target.value; draw(); const i = out.querySelector('.pt-search'); if (i) { i.focus(); i.setSelectionRange(filter.length, filter.length); } }}), unitSelect('ie'),
          h('span', {class: 'zg-small zg-muted'}, t('rows_n', {n: rows.length}) + ' · ' + t('sort_hint')), dlBtn('CSV', 'CSV', tableCsv), check(t('localnames'), S.localNames, v => { S.localNames = v; draw(); }), check(t('ex_csv_desc'), S.exCsvDesc, v => { S.exCsvDesc = v; }), check(t('ex_csv_col'), S.exCsvColour, v => { S.exCsvColour = v; }));
        fill(out, bar, h('div', {class: 'pt-data-scroll'}, h('table', {class: 'pt-table pt-data'}, h('thead', {}, head), h('tbody', {}, rows.map(r => h('tr', {onclick: () => { S.sel = r.sym; }}, cols.map(k => h('td', {class: typeof r[k] === 'number' ? 'num' : ''}, fmt(k, r[k])))))))),
          h('p', {class: 'zg-small zg-muted', role: 'status', 'data-pt-note': ''}, S.note));
      }
      draw(); host.append(out); return host;
    };

    tabs.sources = () => {
      const meta = m.data.meta;
      return h('div', {}, h('p', {}, t('src_caveat')), h('h3', {}, t('src_list')), h('ul', {}, meta.sources.filter(x => x.id !== 'gui').map(x => h('li', {}, x.url ? h('a', {href: x.url, rel: 'noopener', target: '_blank'}, x.text) : x.text))));
    };

    // ---- shell -------------------------------------------------------------------------------
    function show() {
      clearInterval(S.findTimer); S.findTimer = 0; clearInterval(S.playTimer); S.playTimer = 0;
      const head = h('div', {class: 'pt-head'}, h('div', {class: 'zg-local-tabs', role: 'tablist'}, TABS.map(k => h('button', {type: 'button', role: 'tab', class: 'zg-btn' + (S.tab === k ? '' : ' zg-btn-ghost'), 'aria-selected': String(S.tab === k), onclick: () => { S.tab = k; show(); }}, t('tab_' + k)))),
        select(t('language'), S.lang, LANGS, v => { S.lang = v; show(); }));
      fill(app, head, h('div', {class: 'pt-panel', role: 'tabpanel'}, tabs[S.tab]()));
    }
    function clearSelection() { S.showSel = false; S.mark = ''; if (S.tab === 'table' && S.drawTable) S.drawTable(); else show(); }
    document.addEventListener('keydown', ev => { // Esc: from the page body (a click re-renders the table and drops the focus) or from inside the panel; not from other fields
      if (ev.key !== 'Escape' || !root.isConnected || !(S.showSel || S.mark)) return;
      if (ev.target !== document.body && !root.contains(ev.target)) return;
      ev.preventDefault(); clearSelection();
    });
    function refresh() { show(); }
    show();
    if (typeof ResizeObserver !== 'undefined') { let w = app.clientWidth; new ResizeObserver(() => { if (!S.cell && Math.abs(app.clientWidth - w) > 24 && ['table', 'origins'].includes(S.tab)) { w = app.clientWidth; show(); } }).observe(app); }
    root.__pt = {state: S, model: m, tableCanvas, tableSvg, inlineSvg, download};
  }
})();
