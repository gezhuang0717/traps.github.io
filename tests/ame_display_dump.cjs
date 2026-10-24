// Prints, for every nuclide of the reference table, the text the page shows in the reference-isotope card (tests/test_ame_display_audit.py compares it with the original AME2020 text files).
const fs = require('node:fs');
const path = require('node:path');
const R = require('../static/js/ame-reference.js');
const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data/research-cache/ame2020-reference.json'), 'utf8'));
const ref = R.fromJson(json), t = R.translator('en'), out = [];
for (const row of json.rows) {
  const info = ref.info(row[2], row[0] + row[1]);
  if (!info) continue;   // the free neutron: its symbol 'n' is not an element symbol of the card
  out.push({ Z: row[0], N: row[1], rows: R.rows(info, t) });
}
process.stdout.write(JSON.stringify(out));
