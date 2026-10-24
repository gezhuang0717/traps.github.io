const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const CP = require('../static/js/chain-plot.js');

const ame = (xs) => xs.map(x => ({ x, y: 10 - x * 0.1, series: 'ame', g: 50 }));
const hyb = (xs) => xs.map(x => ({ x, y: 9 - x * 0.1, series: 'hybrid', g: 50 }));

test('revised curve: AME2020 everywhere, the changed value where one exists, consecutive N only', () => {
  const seg = CP.revisedSegments(ame([50, 51, 52, 53, 55, 56]), hyb([52, 53]), 'revised');
  assert.deepEqual(seg.map(([a, b]) => [a.x, b.x, a.series, b.series]), [
    [50, 51, 'ame', 'ame'], [51, 52, 'ame', 'hybrid'], [52, 53, 'hybrid', 'hybrid'], [55, 56, 'ame', 'ame']]);
  // the changed point replaces the AME point at the same N
  assert.equal(seg[1][1].y, 9 - 52 * 0.1);
});

test('changed mode keeps only the segments that touch a changed point', () => {
  const seg = CP.revisedSegments(ame([64, 65, 66, 67, 68, 69]), hyb([66, 67]), 'changed');
  assert.deepEqual(seg.map(([a, b]) => [a.x, b.x]), [[65, 66], [66, 67], [67, 68]]);
  assert.deepEqual(CP.revisedSegments(ame([60, 61]), [], 'changed'), []);
});

test('a changed point without an AME neighbour still connects to the neighbours that exist', () => {
  const seg = CP.revisedSegments(ame([51, 52]), hyb([50]), 'revised');
  assert.deepEqual(seg.map(([a, b]) => [a.x, b.x]), [[50, 51], [51, 52]]);
});

test('marker offset moves New left, New + AME2020 right, own points further left, AME and models not at all', () => {
  assert.equal(CP.seriesShift('ame', .12), 0);
  assert.equal(CP.seriesShift('loaded', .12), -.12);
  assert.equal(CP.seriesShift('hybrid', .12), .12);
  assert.equal(CP.seriesShift('mine', .12), -.24);
  assert.equal(CP.seriesShift('ws4', .12), 0);
  assert.equal(CP.seriesShift('hybrid', 0), 0);
});

test('template, script and six-language labels carry the publication options', () => {
  const html = fs.readFileSync('layouts/_shortcodes/nuclide-chart.html', 'utf8');
  for (const name of ['nc-linemode', 'nc-dodge', 'nc-muteame', 'nc-pubpreset']) assert.ok(html.includes(`name="${name}"`), name);
  const js = fs.readFileSync('static/js/nuclide-chart.js', 'utf8');
  for (const token of ['CP.revisedSegments', 'CP.seriesShift', 'AME_GREY', "chainInput('pubpreset')", "'line_mode','marker_offset_N','AME_grey'"]) assert.ok(js.includes(token), token);
  const yaml = fs.readFileSync('data/nuclide_chart_labels.yaml', 'utf8');
  for (const key of ['p_linemode', 'lm_series', 'lm_revised', 'lm_changed', 'p_dodge', 'p_muteame', 'p_preset', 'pp_publication', 'pp_default', 'p_pub_hint'])
    assert.equal((yaml.match(new RegExp('^  ' + key + ':', 'gm')) || []).length, 6, key);
});

test('the visible-points table has a row-count box (initial 300) and a list-all option instead of a fixed limit', () => {
  const html = fs.readFileSync('layouts/_shortcodes/nuclide-chart.html', 'utf8');
  assert.ok(html.includes('name="nc-pt-limit"') && html.includes('value="300"') && html.includes('name="nc-pt-all"'));
  const js = fs.readFileSync('static/js/nuclide-chart.js', 'utf8');
  assert.ok(!js.includes('.slice(0,300)'), 'no fixed 300-row limit in the script');
  assert.ok(js.includes("[name=nc-pt-limit]") && js.includes("[name=nc-pt-all]") && js.includes('T.pt_count'));
  const yaml = fs.readFileSync('data/nuclide_chart_labels.yaml', 'utf8');
  for (const key of ['pt_limit', 'pt_all', 'pt_count']) assert.equal((yaml.match(new RegExp('^  ' + key + ':', 'gm')) || []).length, 6, key);
  const measured = JSON.parse(fs.readFileSync('data/measured_labels.json', 'utf8'));
  for (const lang of Object.keys(measured)) assert.ok(!/300/.test(measured[lang].loaded_details), lang + ' heading still names 300');
});
