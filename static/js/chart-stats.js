/* Summary statistics for the chart of nuclides: minimum / maximum / median of the plotted values, a comparison of one AME edition with
   AME2020, and the per-edition table of measured / estimated masses and documented isomers (numbers computed by tools/make_chart_overlays.py
   from the original AME and NUBASE tables). Pure functions, no DOM. */
(() => {
  'use strict';
  const ORDER = ['ame1995', 'ame2003', 'ame2012', 'ame2016', 'ame2020'];

  /* items: [{ v: number|null, id: any }]; the first item wins a tie for min / max. Returns null when no finite value exists. */
  function summarize(items) {
    const a = items.filter(x => x && Number.isFinite(x.v));
    if (!a.length) return null;
    let min = a[0], max = a[0], sum = 0;
    for (const x of a) { if (x.v < min.v) min = x; if (x.v > max.v) max = x; sum += x.v; }
    const s = a.map(x => x.v).sort((p, q) => p - q), n = s.length;
    return { n, min, max, mean: sum / n, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 };
  }

  /* current: AME2020 rows [Z, N, symbol, ME_keV, sigma_keV, estimated, ...]; old: Map key -> [ME_keV, sigma_keV, estimated(0/1)].
     Difference = AME2020 - old edition. A nuclide counts as present in AME2020 only when its mass excess is known. */
  function compareEditions(current, old, key) {
    const present = new Set(), abs = [];
    let compared = 0, added = 0, estimatedToMeasured = 0, measuredToEstimated = 0, beyond3Sigma = 0, sum = 0;
    for (const r of current) {
      if (r[3] == null) continue;
      const k = key(r[0], r[1]); present.add(k);
      const o = old.get(k);
      if (!o) { added++; continue; }
      compared++;
      const d = r[3] - o[0]; sum += d; abs.push({ v: Math.abs(d), id: [r[0], r[1]] });
      const e = r[4] != null && o[1] != null ? Math.hypot(r[4], o[1]) : null;
      if (e && Math.abs(d) > 3 * e) beyond3Sigma++;
      if (o[2] && !r[5]) estimatedToMeasured++;
      else if (!o[2] && r[5]) measuredToEstimated++;
    }
    let dropped = 0; for (const k of old.keys()) if (!present.has(k)) dropped++;
    const s = summarize(abs);
    return { compared, added, dropped, estimatedToMeasured, measuredToEstimated, beyond3Sigma,
      meanDifference: compared ? sum / compared : null, medianAbs: s ? s.median : null, largest: s ? s.max : null };
  }

  /* stats: meta.stats of ame-editions-compact.json -> table rows in edition order. */
  function editionRows(stats) {
    return ORDER.filter(k => stats && stats[k] && stats[k].nuclides != null).map(k => {
      const e = stats[k], n = e.nubase || {};
      return { key: k, label: k.toUpperCase(), nubase: n.table || '', nuclides: e.nuclides, measured: e.measured, estimated: e.estimated,
        isomers: n.isomers ?? null, withIsomers: n.nuclides_with_isomers ?? null, other: n.other_excited_states ?? null };
    });
  }

  const api = Object.freeze({ summarize, compareEditions, editionRows, ORDER });
  if (typeof window !== 'undefined') window.ZGChartStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
