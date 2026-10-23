/* Local teaching exercises. Numbers below are invented, never measured records. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.TrapsSpectroscopyGames) root.TrapsSpectroscopyGames.mountAll();
  else { root.TrapsSpectroscopyGames = api; api.mountAll(); }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const languages = ["en", "zh", "fi", "de", "ja"];
  const text = (en, zh, fi, de, ja) => Object.fromEntries(languages.map((lang, i) => [lang, [en, zh, fi, de, ja][i]]));
  const getText = (value, lang) => typeof value === "string" ? value : value[lang] || value.en;
  const labels = {
    round: text("Challenge {n} / {total}", "第 {n} / {total} 题", "Tehtävä {n} / {total}", "Aufgabe {n} / {total}", "問題 {n} / {total}"),
    score: text("Score {score} / {tried}", "得分 {score} / {tried}", "Pisteet {score} / {tried}", "Punkte {score} / {tried}", "正解 {score} / {tried}"),
    next: text("Next challenge →", "下一题 →", "Seuraava tehtävä →", "Nächste Aufgabe →", "次の問題 →"),
    reset: text("Restart", "重新开始", "Aloita alusta", "Neu starten", "最初から"),
    correct: text("Correct!", "答对了！", "Oikein!", "Richtig!", "正解！"),
    wrong: text("Try the reasoning below.", "看看下面的推理。", "Katso perustelu alta.", "Sieh dir die Begründung an.", "下の説明を確認しましょう。"),
    answer: text("Answer: ", "正确答案：", "Vastaus: ", "Antwort: ", "正解："),
    source: text("Read the source: ", "阅读原始来源：", "Lue lähde: ", "Quelle lesen: ", "出典を読む："),
    complete: text("Trail complete", "闯关完成", "Polku suoritettu", "Parcours geschafft", "全問終了"),
    summary: text("All eight challenges answered. Restart to practise the same sequence.", "八题已完成，可重新开始练习同一组题。", "Kaikki kahdeksan tehtävää vastattu. Harjoittele samaa sarjaa aloittamalla alusta.", "Alle acht Aufgaben beantwortet. Starte neu, um dieselbe Folge zu üben.", "8問すべてに回答しました。最初から同じ順番で練習できます。"),
    progress: text("Challenges answered", "已作答题数", "Vastatut tehtävät", "Beantwortete Aufgaben", "回答済みの問題"),
    sourceFamily: text("01 · Find the source", "01 · 选择数据来源", "01 · Etsi lähde", "01 · Quelle finden", "01 · データ源を選ぶ"),
    hfsFamily: text("02 · Hyperfine selection", "02 · 超精细选择定则", "02 · Ylihienorakenteen valintasääntö", "02 · Hyperfein-Auswahlregel", "02 · 超微細構造の選択則"),
    shiftFamily: text("03 · Isotope-shift sign", "03 · 同位素位移符号", "03 · Isotooppisiirtymän etumerkki", "03 · Vorzeichen der Isotopieverschiebung", "03 · 同位体シフトの符号"),
    gammaFamily: text("04 · Gamma energy", "04 · 伽马能量", "04 · Gammaenergia", "04 · Gammaenergie", "04 · ガンマ線のエネルギー")
  };
  const sources = {
    asd: {name: "NIST Atomic Spectra Database", url: "https://www.nist.gov/pml/atomic-spectra-database"},
    nudat: {name: "NNDC NuDat · Levels & Gammas", url: "https://www.nndc.bnl.gov/nudat3/guide/"},
    steck: {name: "Daniel A. Steck · Alkali D Line Data", url: "https://steck.us/alkalidata/"},
    gamma: {name: "NNDC · Gamma Emission and Internal Conversion", url: "https://www.nndc.bnl.gov/nudat3/help/gammaemission.jsp"}
  };
  const questions = [
    {
      id: "atomic-source", family: "source", symbol: "λ ↔ E", source: "asd", answer: 0,
      prompt: text("You need an evaluated wavelength for an electronic transition in an atom or atomic ion. Where should you start?", "要查询原子或原子离子电子跃迁的评价波长，应先查哪个数据库？", "Tarvitset arvioidun aallonpituuden atomin tai atomisen ionin elektronisiirtymälle. Mistä aloitat?", "Du suchst eine evaluierte Wellenlänge für einen elektronischen Übergang eines Atoms oder Atomions. Wo beginnst du?", "原子や原子イオンの電子遷移について、評価済みの波長を探すには、どこから調べますか？"),
      choices: ["NIST ASD", "NNDC NuDat", "Crossref"],
      explanation: text("NIST ASD provides evaluated atomic energy levels, wavelengths and transition probabilities. Follow each record’s references and uncertainty; a database name alone does not validate a measurement.", "NIST ASD 提供评价原子能级、波长和跃迁概率。使用时仍需核对具体记录的文献和不确定度。", "NIST ASD sisältää arvioituja atomien energiatasoja, aallonpituuksia ja siirtymätodennäköisyyksiä. Tarkista myös tietueen viitteet ja epävarmuus.", "NIST ASD enthält evaluierte atomare Energieniveaus, Wellenlängen und Übergangswahrscheinlichkeiten. Prüfe auch die Referenzen und Unsicherheiten des Eintrags.", "NIST ASD は評価済みの原子のエネルギー準位、波長、遷移確率を提供します。各記録の参考文献と不確かさも確認します。")
    },
    {
      id: "allowed-f", family: "hfs", symbol: "F → F′", source: "steck", answer: 1,
      prompt: text("In a weak field, assume the electronic E1 transition is allowed. Which pair passes the total-F selection rule alone?", "在弱场中，假设电子 E1 跃迁已允许。以下哪组满足总角动量 F 的选择定则？", "Heikossa kentässä elektroninen E1-siirtymä on sallittu. Mikä pari täyttää pelkän kokonaiskulmaliikemäärän F valintasäännön?", "Im schwachen Feld sei der elektronische E1-Übergang erlaubt. Welches Paar erfüllt allein die Auswahlregel für den Gesamtdrehimpuls F?", "弱い場で電子の E1 遷移が許されると仮定します。全角運動量 F の選択則を満たす組はどれですか？"),
      choices: ["F = 1 → F′ = 3", "F = 1 → F′ = 2", "F = 2 → F′ = 4"],
      explanation: text("The E1 rule is ΔF = 0, ±1, excluding 0 → 0. Here 1 → 2 passes. Magnetic-sublevel and polarization rules must also hold; passing this test alone does not fix line strength.", "E1 要求 ΔF = 0、±1，并排除 0 → 0，因此 1 → 2 符合。仍须满足磁子能级和偏振选择定则；仅此条件不能决定谱线强度。", "E1-sääntö on ΔF = 0, ±1; 0 → 0 on kielletty. Siis 1 → 2 sopii. Myös magneettisten alatasojen ja polarisaation sääntöjen on toteuduttava; tämä ehto ei määrää viivan voimakkuutta.", "Für E1 gilt ΔF = 0, ±1, außer 0 → 0. Also besteht 1 → 2 den Test. Regeln für magnetische Unterniveaus und Polarisation gelten zusätzlich; die Linienstärke folgt daraus noch nicht.", "E1 では ΔF = 0, ±1 で、0 → 0 は除外されます。よって 1 → 2 は条件を満たします。磁気副準位と偏光の条件も必要で、これだけでは線の強さは決まりません。")
    },
    {
      id: "negative-shift", family: "shift", symbol: "δν = νA − νref", source: "steck", answer: 2,
      prompt: text("Invented example: define δν = νA − νref. If δν = −20 MHz, where is isotope A’s transition frequency?", "虚构示例：定义 δν = νA − νref。若 δν = −20 MHz，同位素 A 的跃迁频率怎样变化？", "Keksitty esimerkki: δν = νA − νref. Kun δν = −20 MHz, missä isotoopin A siirtymätaajuus on?", "Erfundenes Beispiel: δν = νA − νref. Wo liegt die Übergangsfrequenz von Isotop A bei δν = −20 MHz?", "架空の例です。δν = νA − νref と定義し、δν = −20 MHz なら、同位体 A の遷移周波数は基準よりどうなりますか？"),
      choices: [text("20 MHz higher", "高 20 MHz", "20 MHz korkeampi", "20 MHz höher", "20 MHz 高い"), text("Unchanged", "不变", "Ennallaan", "Unverändert", "同じ"), text("20 MHz lower", "低 20 MHz", "20 MHz matalampi", "20 MHz niedriger", "20 MHz 低い")],
      explanation: text("The stated subtraction gives νA = νref − 20 MHz. Always read the isotope order: reversing it reverses the sign. This arithmetic does not determine a nuclear charge radius.", "按题设减法，νA = νref − 20 MHz。交换同位素顺序，符号就反转。此算术练习不能给出核电荷半径。", "Määritelmästä νA = νref − 20 MHz. Isotooppien järjestyksen vaihtaminen kääntää etumerkin. Tämä lasku ei määritä ytimen varausjakauman sädettä.", "Nach der Definition gilt νA = νref − 20 MHz. Vertauscht man die Isotopenreihenfolge, wechselt das Vorzeichen. Diese Rechnung liefert keinen Kernladungsradius.", "定義から νA = νref − 20 MHz です。同位体の順序を逆にすれば符号も逆になります。この計算だけで核の電荷半径は決まりません。")
    },
    {
      id: "one-gamma", family: "gamma", symbol: "900 → 300 keV", source: "gamma", answer: 0,
      prompt: text("A fictional nucleus emits one gamma ray from a 900 keV level to a 300 keV level. Neglect recoil. What is Eγ?", "某虚构原子核由 900 keV 能级跃迁至 300 keV 能级并发射一条伽马射线。忽略反冲，Eγ 是多少？", "Kuvitteellinen ydin lähettää gammasäteen tasolta 900 keV tasolle 300 keV. Sivuutetaan rekyyli. Mikä on Eγ?", "Ein fiktiver Kern emittiert ein Gammaquant vom 900-keV-Niveau zum 300-keV-Niveau. Rückstoß vernachlässigt: Wie groß ist Eγ?", "架空の原子核が 900 keV の準位から 300 keV の準位へガンマ線を放出します。反跳を無視すると Eγ はいくつですか？"),
      choices: ["600 keV", "1200 keV", "900 keV"],
      explanation: text("Energy conservation gives Eγ ≈ Ei − Ef = 900 − 300 = 600 keV when recoil is neglected. A gamma energy is the level difference, not the initial excitation energy alone.", "忽略反冲时，由能量守恒得 Eγ ≈ Ei − Ef = 900 − 300 = 600 keV。伽马能量对应能级差，而不是单独的初始激发能。", "Ilman rekyyliä energian säilyminen antaa Eγ ≈ Ei − Ef = 900 − 300 = 600 keV. Gammaenergia on tasojen erotus, ei pelkkä alkutilan viritysenergia.", "Ohne Rückstoß liefert die Energieerhaltung Eγ ≈ Ei − Ef = 900 − 300 = 600 keV. Entscheidend ist die Energiedifferenz, nicht allein die anfängliche Anregungsenergie.", "反跳を無視すると、エネルギー保存から Eγ ≈ Ei − Ef = 900 − 300 = 600 keV です。ガンマ線のエネルギーは初期の励起エネルギーそのものではなく準位差です。")
    },
    {
      id: "nuclear-source", family: "source", symbol: "levels + γ", source: "nudat", answer: 2,
      prompt: text("You need evaluated nuclear excited levels and associated gamma rays. Which service is designed for this?", "要查询评价核激发能级及其伽马射线，哪个服务适合？", "Tarvitset arvioituja ytimen viritystasoja ja niihin liittyviä gammasäteitä. Mikä palvelu sopii tähän?", "Du suchst evaluierte angeregte Kernniveaus und zugehörige Gammastrahlung. Welcher Dienst passt dazu?", "評価済みの原子核の励起準位と関連するガンマ線を探すには、どのサービスが適していますか？"),
      choices: ["NIST ASD", "Crossref", "NNDC NuDat"],
      explanation: text("NuDat’s Levels & Gammas search exposes ENSDF adopted nuclear datasets. NIST ASD concerns atomic spectra; Crossref finds publication metadata rather than evaluated level schemes.", "NuDat 的 Levels & Gammas 查询提供 ENSDF 采用的评价核数据。NIST ASD 侧重原子光谱；Crossref 用于文献元数据。", "NuDatin Levels & Gammas -haku tarjoaa ENSDF:n arvioituja ydinaineistoja. NIST ASD koskee atomispektrejä; Crossref hakee julkaisujen metatietoja.", "NuDats Suche Levels & Gammas erschließt evaluierte ENSDF-Kerndatensätze. NIST ASD behandelt Atomspektren; Crossref bietet Publikationsmetadaten.", "NuDat の Levels & Gammas 検索では ENSDF の評価済み核データを調べられます。NIST ASD は原子スペクトル、Crossref は文献のメタデータを扱います。")
    },
    {
      id: "forbidden-f", family: "hfs", symbol: "|ΔF| ≤ 1", source: "steck", answer: 1,
      prompt: text("Assume an allowed electronic E1 transition and well-defined F. Which pair fails the total-F rule?", "假设电子 E1 跃迁允许，且 F 是良好量子数。哪组不满足 F 选择定则？", "Elektroninen E1-siirtymä on sallittu ja F on hyvin määritelty. Mikä pari rikkoo F-valintasääntöä?", "Der elektronische E1-Übergang sei erlaubt und F wohldefiniert. Welches Paar verletzt die F-Auswahlregel?", "電子の E1 遷移が許され、F が良い量子数であるとします。F の選択則に反する組はどれですか？"),
      choices: ["F = 2 → F′ = 1", "F = 2 → F′ = 4", "F = 2 → F′ = 3"],
      explanation: text("For 2 → 4, ΔF = +2, outside the E1 values 0, ±1. The other two pairs pass this necessary F test. Strong-field mixing and other multipoles are outside this exercise.", "2 → 4 的 ΔF = +2，超出 E1 的 0、±1。另两组符合这一必要条件。本题不考虑强场混合及其他多极跃迁。", "Siirtymässä 2 → 4 on ΔF = +2, joten E1-ehto 0, ±1 ei täyty. Muut parit läpäisevät tämän välttämättömän testin. Vahvan kentän sekoittuminen ja muut multipolit jäävät tehtävän ulkopuolelle.", "Für 2 → 4 ist ΔF = +2 und liegt außerhalb der E1-Werte 0, ±1. Die anderen Paare erfüllen diese notwendige Bedingung. Starkfeldmischung und andere Multipole sind hier nicht enthalten.", "2 → 4 では ΔF = +2 となり、E1 の 0, ±1 の範囲を外れます。他の2組はこの必要条件を満たします。強い場での混合や他の多重極遷移は扱いません。")
    },
    {
      id: "reverse-shift", family: "shift", symbol: "A − ref ↔ ref − A", source: "steck", answer: 0,
      prompt: text("Invented example: νA is 30 MHz above νref. Using the reversed order δνref,A = νref − νA, what is the shift?", "虚构示例：νA 比 νref 高 30 MHz。采用反向定义 δνref,A = νref − νA，位移是多少？", "Keksitty esimerkki: νA on 30 MHz suurempi kuin νref. Mikä on siirtymä käänteisellä määritelmällä δνref,A = νref − νA?", "Erfundenes Beispiel: νA liegt 30 MHz über νref. Wie lautet die Verschiebung bei umgekehrter Reihenfolge δνref,A = νref − νA?", "架空の例で、νA は νref より 30 MHz 高いとします。逆の順序で δνref,A = νref − νA と定義すると、シフトはいくつですか？"),
      choices: ["−30 MHz", "+30 MHz", "0 MHz"],
      explanation: text("νref − (νref + 30 MHz) = −30 MHz. A quoted isotope shift needs its explicit isotope order and units; the sign alone is ambiguous without a convention.", "νref − (νref + 30 MHz) = −30 MHz。引用同位素位移时必须明确同位素顺序及单位；没有约定，单独的符号没有确定含义。", "νref − (νref + 30 MHz) = −30 MHz. Isotooppisiirtymän yhteydessä on kerrottava isotooppien järjestys ja yksikkö; pelkkä etumerkki ilman määritelmää on epäselvä.", "νref − (νref + 30 MHz) = −30 MHz. Eine Isotopieverschiebung benötigt die ausdrückliche Isotopenreihenfolge und Einheit; das Vorzeichen allein ist ohne Konvention mehrdeutig.", "νref − (νref + 30 MHz) = −30 MHz です。同位体シフトには同位体の順序と単位を明記する必要があり、定義なしでは符号だけでは意味が定まりません。")
    },
    {
      id: "gamma-cascade", family: "gamma", symbol: "1200 → 500 → 0 keV", source: "gamma", answer: 2,
      prompt: text("A fictional two-gamma cascade goes 1200 → 500 → 0 keV. Neglect recoil and other radiation. What is the sum of the two photon energies?", "虚构的双伽马级联为 1200 → 500 → 0 keV。忽略反冲且无其他辐射，两光子能量之和是多少？", "Kuvitteellinen kahden gamman kaskadi on 1200 → 500 → 0 keV. Ei rekyyliä eikä muuta säteilyä. Mikä on fotonien energioiden summa?", "Eine fiktive Zweigamma-Kaskade verläuft 1200 → 500 → 0 keV. Ohne Rückstoß und weitere Strahlung: Wie groß ist die Summe der beiden Photonenenergien?", "架空の2段ガンマカスケードが 1200 → 500 → 0 keV と進みます。反跳と他の放射を無視すると、2つの光子のエネルギーの和はいくつですか？"),
      choices: ["500 keV", "700 keV", "1200 keV"],
      explanation: text("The photons carry 1200 − 500 = 700 keV and 500 − 0 = 500 keV. Their sum is 1200 keV. The intermediate level cancels in the total energy balance.", "两光子能量分别为 1200 − 500 = 700 keV 和 500 − 0 = 500 keV，总和 1200 keV。总能量平衡中，中间能级相消。", "Fotonien energiat ovat 1200 − 500 = 700 keV ja 500 − 0 = 500 keV. Summa on 1200 keV. Välitason energia kumoutuu kokonaisenergiataseessa.", "Die Photonen tragen 1200 − 500 = 700 keV und 500 − 0 = 500 keV. Die Summe ist 1200 keV. Das Zwischenniveau kürzt sich in der Gesamtbilanz heraus.", "光子のエネルギーは 1200 − 500 = 700 keV と 500 − 0 = 500 keV で、和は 1200 keV です。全体のエネルギー収支では中間準位が相殺されます。")
    }
  ];

  function passesFRule(f, upper) {
    return [f, upper].every(v => Number.isFinite(v) && v >= 0 && Number.isInteger(2 * v)) &&
      !(f === 0 && upper === 0) && [0, 1].includes(Math.abs(upper - f));
  }
  function photonEnergy(initial, final) {
    if (![initial, final].every(v => Number.isFinite(v) && v >= 0) || initial < final) throw new RangeError("Invalid level energies");
    return initial - final; // Same input/output energy unit; recoil neglected.
  }
  function isotopeShift(frequency, reference) {
    if (![frequency, reference].every(Number.isFinite)) throw new RangeError("Invalid frequencies");
    return frequency - reference; // Frequencies must use the same unit.
  }
  function createSession() {
    let index = 0, score = 0, selected = null;
    const snapshot = () => ({index, score, selected, answered: selected !== null, tried: index + Number(selected !== null), complete: index === questions.length - 1 && selected !== null, question: questions[index]});
    return {
      state: snapshot,
      answer(choice) {
        if (selected === null && Number.isInteger(choice) && choice >= 0 && choice < questions[index].choices.length) {
          selected = choice;
          if (choice === questions[index].answer) score += 1;
        }
        return snapshot();
      },
      next() { if (selected !== null && index < questions.length - 1) { index += 1; selected = null; } return snapshot(); },
      reset() { index = 0; score = 0; selected = null; return snapshot(); }
    };
  }
  function mount(section) {
    if (section.dataset.sgReady) return;
    section.dataset.sgReady = "true";
    const lang = languages.includes(section.dataset.lang) ? section.dataset.lang : "en";
    const t = (key, vars = {}) => getText(labels[key], lang).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
    const find = name => section.querySelector("[data-sg-" + name + "]");
    const doc = section.ownerDocument;
    const session = createSession();
    const stage = find("stage"), options = find("options"), feedback = find("feedback"), next = find("next"), reset = find("reset"), question = find("question"), progress = find("progress");
    progress.setAttribute("aria-label", t("progress"));
    reset.textContent = t("reset");
    function render() {
      const state = session.state(), item = state.question;
      find("round").textContent = t("round", {n: state.index + 1, total: questions.length});
      find("score").textContent = t("score", {score: state.score, tried: state.tried});
      progress.max = questions.length; progress.value = state.tried;
      find("card").dataset.family = item.family;
      find("family").textContent = t(item.family + "Family");
      find("symbol").textContent = item.symbol;
      question.textContent = getText(item.prompt, lang);
      options.replaceChildren();
      item.choices.forEach((choice, index) => {
        const button = doc.createElement("button"), key = doc.createElement("span"), label = doc.createElement("span");
        button.type = "button"; button.className = "sg-choice"; button.dataset.sgChoice = String(index); button.disabled = state.answered;
        key.className = "sg-choice-key"; key.setAttribute("aria-hidden", "true"); key.textContent = String.fromCharCode(65 + index);
        label.textContent = getText(choice, lang);
        if (state.answered && index === item.answer) { button.dataset.result = "correct"; key.textContent = "✓"; }
        else if (state.answered && index === state.selected) { button.dataset.result = "wrong"; key.textContent = "×"; }
        button.append(key, label);
        button.addEventListener("click", () => { session.answer(index); render(); feedback.focus(); });
        options.append(button);
      });
      feedback.replaceChildren(); feedback.hidden = !state.answered;
      if (state.answered) {
        const verdict = doc.createElement("strong"), answer = doc.createElement("p"), explanation = doc.createElement("p"), link = doc.createElement("a");
        verdict.textContent = t(state.selected === item.answer ? "correct" : "wrong");
        answer.textContent = t("answer") + getText(item.choices[item.answer], lang);
        explanation.textContent = getText(item.explanation, lang);
        link.href = sources[item.source].url; link.textContent = t("source") + sources[item.source].name;
        feedback.append(verdict, answer, explanation, link);
        if (state.complete) { const summary = doc.createElement("p"); summary.textContent = t("summary"); feedback.append(summary); }
      }
      next.textContent = t(state.complete ? "complete" : "next");
      next.disabled = !state.answered || state.complete;
    }
    next.addEventListener("click", () => { session.next(); render(); question.focus(); });
    reset.addEventListener("click", () => { session.reset(); render(); question.focus(); });
    render(); stage.hidden = false; find("loading").hidden = true;
  }
  function mountAll(scope) {
    if (!scope && typeof document === "undefined") return;
    (scope || document).querySelectorAll("[data-spectroscopy-games]").forEach(mount);
  }
  return {languages, labels, sources, questions, getText, createSession, passesFRule, photonEnergy, isotopeShift, mountAll};
});
