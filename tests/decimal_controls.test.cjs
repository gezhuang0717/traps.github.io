const {test}=require('node:test'),assert=require('node:assert/strict');
const {stepDecimal:s}=require('../static/js/decimal-controls.js');
test('evaluated cyclotron masses and uncertainties bypass display rounding',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../layouts/_shortcodes/lab.html'),'utf8');
 assert.match(html,/<section[^>]*data-cyclotron\b[^>]*data-full-precision/);
 const inputs=['132.905451958','5.1e-9','7.0000000001'].map(value=>({
  value,dataset:{},readOnly:false,disabled:false,step:'any',id:'',nodeType:1,
  matches:()=>true,closest:selector=>selector==='[data-full-precision]'?{}:null,
  querySelectorAll:()=>[]
 }));
 const document={documentElement:{lang:'en',nodeType:1,matches:()=>false,querySelectorAll:()=>inputs},body:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/decimal-controls.js'),'utf8'),{document,MutationObserver:class{observe(){}},window:{}});
 assert.deepEqual(inputs.map(n=>n.value),['132.905451958','5.1e-9','7.0000000001']);
 assert.ok(inputs.every(n=>!n.dataset.decimalControl));
});
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
