/* Transfer the *same* RFQ operating point from the trajectory game to Lab.
   V_rod_peak_V is peak voltage on one rod pair relative to ground;
   the differential peak is 2*V_rod_peak_V. No conversion is applied here.
   This transfers input values, not measured transmission or ion provenance. */
(function (host) {
  "use strict";
  const LIMITS = [
    ["mass_u", 0.000001, 1000000],
    ["charge", 1, 100],
    ["U_V", -1000000, 1000000],
    ["V_rod_peak_V", 0, 1000000],
    ["r0_mm", 0.001, 1000],
    ["f_MHz", 0.000001, 1000]
  ];
  function normalize(source) {
    if (!source || typeof source !== "object") throw Error("Invalid RFQ preset");
    const values = {};
    for (const [key, min, max] of LIMITS) {
      const raw = source[key];
      if ((typeof raw !== "number" && typeof raw !== "string") ||
          (typeof raw === "string" && !raw.trim())) throw Error("Missing RFQ " + key);
      const number = Number(raw);
      if (!Number.isFinite(number) || number < min || number > max ||
          (key === "charge" && !Number.isInteger(number))) throw Error("Invalid RFQ " + key);
      values[key] = number;
    }
    const species = source.species == null ? "" : String(source.species).trim();
    if (species.length > 100 || /[\u0000-\u001f\u007f]/.test(species)) throw Error("Invalid species label");
    values.species = species;
    return values;
  }
  function link(href, source) {
    const p = normalize(source), url = new URL(href);
    url.searchParams.set("rfq_preset", "v1");
    url.searchParams.set("rfq_voltage_convention", "rod-peak");
    for (const [key] of LIMITS) url.searchParams.set(key, String(p[key]));
    if (p.species) url.searchParams.set("species", p.species);
    else url.searchParams.delete("species");
    url.hash = "rfq-workbench";
    return url.toString();
  }
  function parse(search) {
    const query = new URLSearchParams(search);
    if (!query.has("rfq_preset")) return null;
    if (query.get("rfq_preset") !== "v1" ||
        query.get("rfq_voltage_convention") !== "rod-peak") throw Error("Unknown RFQ preset convention");
    const source = {species: query.get("species") || ""};
    for (const [key] of LIMITS) {
      const value = query.get(key);
      if (value == null || !value.trim()) throw Error("Missing RFQ " + key);
      source[key] = value;
    }
    return normalize(source);
  }
  const api = Object.freeze({link, parse, normalize});
  host.ZGRFQPreset = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
