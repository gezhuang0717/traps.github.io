// Tests of the save options of the periodic-table panel: names language and colour columns of the CSV, and the six-language option strings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../static/js/periodic-table-core.js');

const model = P.createModel(JSON.parse(fs.readFileSync(path.join(__dirname, '../static/data/periodic-table.json'), 'utf8')));
const column = (rows, name) => rows[0].indexOf(name);
const row = (rows, sym) => rows.find(r => r[1] === sym);

test('csvRows: the name column follows nameLang, labels follow lang, no colour columns by default', () => {
  const plain = P.csvRows(model, 'en'), german = P.csvRows(model, 'en', {nameLang: 'de'}), french = P.csvRows(model, 'de', {nameLang: 'en'});
  assert.equal(plain[0].length, P.CSV_HEADER.length);
  assert.equal(row(plain, 'Fe')[column(plain, 'name')], 'Iron');
  assert.equal(row(german, 'Fe')[column(german, 'name')], 'Eisen');
  assert.equal(row(german, 'Fe')[column(german, 'name_en')], 'Iron');
  assert.equal(row(french, 'Fe')[column(french, 'name')], 'Iron'); // labels in German, names in English
  assert.equal(row(german, 'Fe')[column(german, 'origin_labels')], row(plain, 'Fe')[column(plain, 'origin_labels')]); // other columns follow lang only
  assert.equal(plain.length, 119);
});

test('csvRows: colour columns for every colour scheme', () => {
  const n = P.CSV_HEADER.length;
  for (const scheme of ['block', 'origin', 'country', 'state', 'heat']) {
    const rows = P.csvRows(model, 'en', {colour: {scheme, key: 'mass'}});
    assert.deepEqual(rows[0].slice(n), ['colour_scheme', 'colour_class', 'colour_hex'], scheme);
    assert.ok(rows.slice(1).every(r => r.length === n + 3 && r[n] === scheme && r[n + 2] !== ''), scheme);
  }
  const block = P.csvRows(model, 'de', {colour: {scheme: 'block'}}), fe = model.bySym.Fe;
  assert.equal(row(block, 'Fe')[n + 1], P.groupLabel(model, 'de', fe.block));
  assert.equal(row(block, 'Fe')[n + 2], model.i18n.groups.color[fe.block]);
  const origin = P.csvRows(model, 'en', {colour: {scheme: 'origin'}}), li = model.bySym.Li;
  assert.deepEqual(row(origin, 'Li')[n + 2].split(';'), li.origin.map(c => model.i18n.origins.color[c]));
  assert.equal(row(origin, 'Li')[n + 1].split(' + ').length, li.origin.length);
  assert.ok(li.origin.length > 1);
  const state = P.csvRows(model, 'fi', {colour: {scheme: 'state'}});
  assert.equal(row(state, 'Hg')[n + 1], P.stateLabel(model, 'fi', 'Liquid'));
});

test('csvRows: heat-map colour columns give the value, and grey with an empty class where there is no data', () => {
  const n = P.CSV_HEADER.length, rows = P.csvRows(model, 'en', {colour: {scheme: 'heat', key: 'ie', unit: 'eV'}});
  const missing = model.elements.find(e => e.ie === null), present = model.bySym.He;
  assert.ok(missing, 'at least one element without ionisation energy');
  assert.equal(row(rows, missing.sym)[n + 1], '');
  assert.equal(row(rows, missing.sym)[n + 2], '#e5e7eb');
  assert.equal(row(rows, 'He')[n + 1], P.formatValue(model, present, 'ie', 'en', 'eV'));
  assert.notEqual(row(rows, 'He')[n + 2], '#e5e7eb');
});

test('colourInfo agrees with the colours used to paint the cells', () => {
  for (const scheme of ['block', 'origin', 'country', 'state']) {
    for (const e of model.elements) assert.equal(P.colourInfo(model, e, scheme, 'en')[1], P.cellStyle(model, e, scheme).fills.join(';'), `${scheme} ${e.sym}`);
  }
});

test('the save-option strings exist in all six languages, and the heat description keeps its {log} slot', () => {
  const source = fs.readFileSync(path.join(__dirname, '../static/js/periodic-table.js'), 'utf8');
  for (const key of ['localnames', 'ex_key', 'ex_csv_desc', 'ex_csv_col', 'key_block', 'key_points', 'key_origin', 'key_country', 'key_state', 'key_heat']) {
    assert.equal((source.match(new RegExp('\\b' + key + ': \'', 'g')) || []).length, 6, key);
  }
  assert.equal((source.match(/key_heat: '[^']*\{log\}/g) || []).length, 6);
});
