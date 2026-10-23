const test = require('node:test');
const assert = require('node:assert/strict');
const {integerTicks} = require('../static/js/spectroscopy-core.js');

test('Ca mass-number axis uses real integer ticks instead of fractional padded limits', () => {
  assert.deepEqual(integerTicks(39.1, 50.9), [40, 42, 44, 46, 48, 50]);
  assert.deepEqual(integerTicks(39.82, 40.18), [40]);
  assert.deepEqual(integerTicks(39.91, 41.09), [40, 41]);
});
test('N, Z and A count axes stay ordered, nonnegative and sparse at every nuclear scale', () => {
  for (let last = 1; last <= 400; last++) {
    const ticks = integerTicks(-last * .09, last * 1.09);
    assert.ok(ticks.length <= 6);
    assert.ok(ticks.every((v,i) => Number.isInteger(v) && v >= 0 && (i === 0 || v > ticks[i-1])));
  }
  assert.deepEqual(integerTicks(.2, .8), []);
});
test('malformed count ranges reject rather than showing misleading labels', () => {
  for (const args of [[NaN,40], [0,Infinity], [41,40], [0,1e20]]) assert.throws(() => integerTicks(...args));
});
