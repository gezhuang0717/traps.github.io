const test = require('node:test'), assert = require('node:assert/strict');
const U = require('../static/js/chart-user-data.js');
const symbolToZ = new Map([['H', 1], ['Ca', 20], ['Sn', 50], ['Pb', 82]]);
const keys = r => r.rows.map(x => x.Z + ',' + x.N);

test('any two of Z, N, A identify a nuclide and the third is derived and checked', () => {
  assert.deepEqual(keys(U.parse('Z,N,value\n20,28,1.5\n50,70,2')), ['20,28', '50,70']);
  assert.deepEqual(keys(U.parse('Z\tA\tvalue\n20\t48\t1.5\n50\t120\t2')), ['20,28', '50,70']);
  assert.deepEqual(keys(U.parse('N;A;v\n28;48;1\n70;120;2')), ['20,28', '50,70']);
  const all = U.parse('Z,N,A,v\n20,28,48,1\n20,28,49,2'); assert.equal(all.rows.length, 1); assert.match(all.errors[0].message, /A ≠ Z \+ N/);
});
test('element symbol with A or N, including the 48Ca style and case-insensitive symbols', () => {
  assert.deepEqual(keys(U.parse('element,A,x\nCa,48,1\nsn,120,2\nPb,208,3', { symbolToZ })), ['20,28', '50,70', '82,126']);
  assert.deepEqual(keys(U.parse('symbol,N,x\nCa,28,1', { symbolToZ })), ['20,28']);
  assert.deepEqual(keys(U.parse('Element,x\n48Ca,1\n120Sn,2', { symbolToZ })), ['20,28', '50,70']);
  assert.match(U.parse('element,A,x\nXx,48,1', { symbolToZ }).errors[0].message, /unknown element/);
});
test('value columns are every other numeric column; text columns are ignored', () => {
  const r = U.parse('Z,N,label,beta2,sigma\n20,28,a,0.1,0.01\n50,70,b,0.2,'); assert.deepEqual(r.valueColumns, ['beta2', 'sigma']);
  assert.equal(r.rows[0].values.beta2, 0.1); assert.ok(!('sigma' in r.rows[1].values));
});
test('tables without a header use the assumed identifier columns', () => {
  assert.deepEqual(keys(U.parse('20 28 1.5\n50 70 2', {})), ['20,28', '50,70']);
  assert.deepEqual(keys(U.parse('20 48 1.5', { assume: 'ZA' })), ['20,28']);
});
test('JSON: array of objects, rows with columns, and object of arrays', () => {
  assert.equal(U.parse('[{"Z":20,"N":28,"v":1},{"Z":50,"A":120,"v":2}]').rows.length, 2);
  assert.equal(U.parse('{"columns":["Z","N","v"],"rows":[[20,28,1],[50,70,2]]}').rows.length, 2);
  assert.equal(U.parse('{"Z":[20,50],"N":[28,70],"value":[1,2]}').rows.length, 2);
});
test('bad input is reported per line and never silently accepted; duplicates keep the later row', () => {
  const r = U.parse('Z,N,v\n20,28,1\n-1,5,2\n20.5,28,3\n20,28,9\n50,70,'); assert.equal(r.rows.length, 1); assert.equal(r.rows[0].values.v, 9); assert.equal(r.duplicates, 1); assert.deepEqual(r.errors.map(e => e.line), [3, 4, 6]);
  assert.match(U.parse('foo,bar\n1,2').errors[0].message, /two of Z, N, A/);
  assert.throws(() => U.parse('x'.repeat(5000001)), /5 MB/);
  assert.throws(() => U.parse('Z,N,v\n' + '1,1,1\n'.repeat(20001)), /20000/);
});
test('percentile range ignores outliers and degenerate data falls back to min-max', () => {
  const v = Array.from({ length: 100 }, (_, i) => i); v.push(1e6);
  const [lo, hi] = U.robustRange(v); assert.ok(lo > 0 && lo < 5 && hi > 95 && hi < 120);
  assert.deepEqual(U.robustRange([2, 2, 2]), [2, 2]); assert.equal(U.robustRange([]), null); assert.deepEqual(U.range([3, -1, 7]), [-1, 7]);
});
