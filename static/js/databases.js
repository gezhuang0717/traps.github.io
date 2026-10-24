/* Databases page — progressive enhancement of the server-rendered cards in layouts/_shortcodes/databases.html.
   Search, category chips, favourites (this browser only), pop-up guides, card links, CSV export and a nuclide look-up
   (AME2020 / NUBASE2020 values from static/data/nubase2020.json; external links only to verified URL patterns). */
(function () {
  "use strict";
  const root = document.querySelector("[data-databases]");
  if (!root) return;
  const L = JSON.parse(root.dataset.labels || "{}");
  const cards = [...root.querySelectorAll(".zg-db-card")];
  const tools = root.querySelector(".zg-db-tools");
  const q = tools.querySelector("[name=q]");
  const chips = [...tools.querySelectorAll("[data-cat]")];
  const count = tools.querySelector(".zg-db-count");
  const none = root.querySelector(".zg-db-none");
  const dlg = root.querySelector(".zg-db-dialog");
  const dbody = root.querySelector(".zg-db-dbody");
  tools.hidden = false;

  /* favourites: localStorage is optional (private mode, blocked storage) */
  const FK = "zg-db-favs";
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FK) || "[]")); } catch (e) { favs = new Set(); }
  const saveFavs = () => { try { localStorage.setItem(FK, JSON.stringify([...favs])); } catch (e) { /* not stored */ } };

  let cat = "";
  function apply() {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    cards.forEach(c => {
      const sec = c.closest(".zg-db-cat").dataset.cat;
      const text = c.dataset.text + " " + c.textContent.toLowerCase();
      const ok = (cat === "" || (cat === "__fav" ? favs.has(c.dataset.id) : sec === cat)) && words.every(w => text.includes(w));
      c.hidden = !ok; if (ok) n++;
    });
    root.querySelectorAll(".zg-db-cat").forEach(s => { s.hidden = !s.querySelector(".zg-db-card:not([hidden])"); });
    count.textContent = `${n} ${L.count || ""}`;
    none.hidden = n > 0;
  }
  q.addEventListener("input", apply);
  chips.forEach(b => b.addEventListener("click", () => { cat = b.dataset.cat; chips.forEach(x => x.classList.toggle("on", x === b)); apply(); }));

  cards.forEach(c => {
    const fb = c.querySelector(".zg-db-fav"), id = c.dataset.id;
    const paint = () => { const on = favs.has(id); fb.textContent = on ? "★" : "☆"; fb.setAttribute("aria-pressed", on); c.classList.toggle("fav", on); };
    paint();
    fb.addEventListener("click", () => { favs.has(id) ? favs.delete(id) : favs.add(id); saveFavs(); paint(); if (cat === "__fav") apply(); });
    /* guide as a pop-up dialog; the <details> stays as the no-JS / print version */
    const det = c.querySelector(".zg-db-guide");
    det.querySelector("summary").addEventListener("click", e => {
      if (!dlg || typeof dlg.showModal !== "function") return;   /* old browsers: keep the inline <details> */
      e.preventDefault();
      dbody.innerHTML = `<h3>${c.querySelector("h3").innerHTML}</h3><p class="zg-db-org">${c.querySelector(".zg-db-org").innerHTML}</p>` +
        [...det.children].filter(x => x.tagName !== "SUMMARY").map(x => x.outerHTML).join("") +
        `<p class="zg-db-dfoot">${c.querySelector("footer").innerHTML}</p>`;
      dbody.querySelectorAll(".zg-db-link").forEach(x => x.remove());
      dlg.showModal();
    });
    const lb = c.querySelector(".zg-db-link");
    lb.hidden = false;
    lb.addEventListener("click", () => {
      const u = location.href.split("#")[0] + "#db-" + id;
      const done = () => { lb.textContent = L.copied || "Copied"; setTimeout(() => { lb.textContent = L.link; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, () => { location.hash = "db-" + id; });
      else location.hash = "db-" + id;
    });
  });
  if (dlg) dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  tools.querySelector("[data-act=expand]").addEventListener("click", () => root.querySelectorAll(".zg-db-guide").forEach(d => { d.open = true; }));
  tools.querySelector("[data-act=collapse]").addEventListener("click", () => root.querySelectorAll(".zg-db-guide").forEach(d => { d.open = false; }));
  tools.querySelector("[data-act=csv]").addEventListener("click", () => {
    const esc = s => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [["name", "organisation", "category", "type", "url", "help", "summary"]];
    cards.filter(c => !c.hidden).forEach(c => {
      const a = c.querySelectorAll("footer a");
      rows.push([c.querySelector("h3").textContent.trim(), c.querySelector(".zg-db-org").textContent.split("·")[0].trim(),
        c.closest(".zg-db-cat").dataset.cat, c.dataset.kind, a[0] ? a[0].href : "", a[1] ? a[1].href : "", c.querySelector(".zg-db-short").textContent.trim()]);
    });
    const blob = new Blob(["﻿" + rows.map(r => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nuclear-databases.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* deep link to a card: open and highlight it */
  if (location.hash.startsWith("#db-")) {
    const c = document.getElementById(location.hash.slice(1));
    if (c) { c.classList.add("hl"); c.scrollIntoView({ block: "center" }); }
  }
  apply();

  /* ---------- nuclide look-up ---------- */
  const form = root.querySelector(".zg-db-lookup-f"), out = root.querySelector(".zg-db-lookup-out");
  let NB = null;
  const load = () => NB ? Promise.resolve(NB) : fetch(root.dataset.nubase).then(r => r.json()).then(d => (NB = d));
  /* accepts 100Sn, 100sn, Sn-100, Sn100, sn 100, 100-Sn; isomer suffixes are shown in the list, the look-up is per nuclide */
  function parse(s, els) {
    s = s.trim().replace(/\s+/g, "");
    let m = s.match(/^(\d{1,3})-?([A-Za-z]{1,2})$/) || s.match(/^([A-Za-z]{1,2})-?(\d{1,3})$/);
    if (!m) return null;
    let A, sym; if (/^\d/.test(m[1])) { A = +m[1]; sym = m[2]; } else { A = +m[2]; sym = m[1]; }
    sym = sym[0].toUpperCase() + sym.slice(1).toLowerCase();
    if (sym === "N" && A === 1 && /^1-?n$/i.test(s)) return { Z: 0, A: 1, sym: "n", name: "neutron" };
    const e = els.find(x => x[1] === sym);
    if (!e || A < e[0]) return null;
    return { Z: e[0], A, sym, name: e[2] };
  }
  const fmt = (v, e, est) => {
    if (v == null) return "—";
    const d = e > 0 ? Math.max(0, Math.min(6, -Math.floor(Math.log10(e)) + 1)) : 3;
    return `${v.toFixed(d)}${est ? "#" : ""}${e > 0 ? " ± " + e.toFixed(d) + (est ? "#" : "") : ""}`;
  };
  /* NUBASE decay-mode codes → readable symbols (the raw string is kept in the title attribute) */
  const decay = s => String(s || "").split(";").map(t => t.replace(/^IS=([\d.]+) (\d+)$/, "IS $1($2) %").replace(/^IS=/, "IS ").replace(/\bB\+/g, "β⁺").replace(/\bB-/g, "β⁻").replace(/2B-/g, "2β⁻").replace(/^A(?=[=~<>\s])/, "α").replace(/\bEC\b/g, "EC").replace(/\bSF\b/g, "SF")).join("; ");
  const escH = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function lookup() {
    const s = form.querySelector("[name=nuc]").value;
    load().then(d => {
      const p = parse(s, d.elements);
      if (!p) { out.innerHTML = `<p class="zg-db-bad">${escH(L.lookup_bad)}</p>`; return; }
      const N = p.A - p.Z, r = d.rows.find(x => x[0] === p.Z && x[1] === N);
      if (!r) { out.innerHTML = `<p class="zg-db-bad">${escH(L.lookup_bad)}</p>`; return; }
      const sup = `<sup>${p.A}</sup>${escH(p.sym)}`;
      const iso = (r[11] || []).map(m => `<li>${sup}<sup>${escH(m[0])}</sup>: E<sub>x</sub> = ${fmt(m[1], m[4], !!m[5])} keV · T½ ${escH(m[2] || "—")} · J<sup>π</sup> ${escH(m[3] || "—")}</li>`).join("");
      const api = `https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=${p.A}${p.sym.toLowerCase()}`;
      const wiki = p.Z > 0 ? `https://en.wikipedia.org/wiki/Isotopes_of_${encodeURIComponent(p.name.toLowerCase().replace("aluminum", "aluminium").replace("cesium", "caesium"))}` : "https://en.wikipedia.org/wiki/Free_neutron_decay";
      const chart = `${root.dataset.chart}?nuclide=${p.A}${p.sym}`;
      out.innerHTML = `<div class="zg-db-nuc">
        <h3>${sup} <small>(Z = ${p.Z}, N = ${N})</small></h3>
        <dl>
          <dt>${escH(L.me)} (${escH(L.ame)})</dt><dd>${fmt(r[3], r[4], !!r[5])} keV</dd>
          <dt>${escH(L.hl)}</dt><dd>${escH(r[7] || "—")}</dd>
          <dt>${escH(L.jp)}</dt><dd>${escH(r[8] || "—")}</dd>
          <dt>${escH(L.dm)}</dt><dd title="${escH(r[10] || "")}">${escH(decay(r[10]) || "—")}</dd>
          <dt>${escH(L.disc)}</dt><dd>${escH(r[9] || "—")}</dd>
        </dl>
        ${iso ? `<p><b>${escH(L.isomers)} (${escH(L.nubase)})</b></p><ul>${iso}</ul>` : ""}
        ${r[5] ? `<p class="zg-db-est">${escH(L.est)}</p>` : ""}
        <p class="zg-db-ext">
          <a class="zg-db-btn" href="${api}" target="_blank" rel="noopener">${escH(L.lookup_api)} ↗</a>
          <a class="zg-db-btn" href="https://www-nds.iaea.org/livechart/" target="_blank" rel="noopener">IAEA LiveChart ↗</a>
          <a class="zg-db-btn" href="${wiki}" target="_blank" rel="noopener">${escH(L.lookup_wiki)} ↗</a>
          <a class="zg-db-btn" href="${chart}">${escH(L.chart_link || "Chart")} →</a>
        </p></div>`;
    }).catch(() => { out.textContent = "—"; });
  }
  form.addEventListener("submit", lookup);
})();
