const {test}=require('node:test'),assert=require('node:assert/strict');
const {stepDecimal:s}=require('../static/js/decimal-controls.js');
test('coarse decimal stepping preserves a fine typed tail exactly',()=>{
 assert.equal(s('808542.7880001',1,'1'),'808543.7880001');
 assert.equal(s('808543.7880001',-1,'1'),'808542.7880001');
 assert.equal(s('7.0000000001',1),'8.0000000001');
 assert.equal(s('.00025',1,'.001'),'0.00125');
 assert.equal(s('1.2e-8',1,'1e-9'),'0.000000013');
});
test('decimal stepping clamps at physical bounds and handles zero crossings',()=>{
 assert.equal(s('.00025',-1,'.001',0),'0');
 assert.equal(s('99',1,'5',1,100),'100');
 assert.equal(s('-0.1',1,'.1'),'0.0');
 assert.equal(s('0.1',-1,'.2'),'-0.1');
 for(const x of ['', 'Infinity','1e999'])assert.throws(()=>s(x,1));
 assert.throws(()=>s(1,1,0));
});
