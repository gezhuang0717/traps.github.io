const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const source = fs.readFileSync('static/js/spectroscopy.js', 'utf8');
function object(startMarker) {
  const a = source.indexOf(startMarker), open = source.indexOf('{', a); let depth = 0, i = open;
  for (; i < source.length; i++) { const c = source[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break; }
  return Function('return (' + source.slice(open, i + 1) + ')')();
}
test('every interface label added for the dataset tools has all six languages', () => {
  const extra = object('const extra=');
  const keys = Object.keys(extra); assert.ok(keys.length > 40);
  for (const k of keys) { assert.equal(extra[k].length, 6, k); extra[k].forEach((v, i) => assert.ok(typeof v === 'string' && v.trim(), k + ' language ' + i)); }
  for (const k of ['dataset', 'ds_builtin', 'ds_user', 'user_radii_help', 'king_help', 'howto_radii', 'howto_cls', 'band_label']) assert.ok(extra[k], k);
});
test('long help texts are real translations, not copies of the English text', () => {
  const extra = object('const extra=');
  for (const k of Object.keys(extra)) for (let i = 1; i < 6; i++) if (extra[k][0].length > 60) assert.notEqual(extra[k][i], extra[k][0], k + ' language ' + i);
});
test('how-to texts keep four numbered steps in every language', () => {
  const extra = object('const extra=');
  for (const k of ['howto_radii', 'howto_moments', 'howto_levels', 'howto_cls']) extra[k].forEach((v, i) => assert.equal(v.split('\n').length, 4, k + ' ' + i));
  for (const v of extra.howto_cooling) assert.equal(v.split('\n').length, 3);
});
