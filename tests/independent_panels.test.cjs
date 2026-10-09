const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../static/js/independent-panels.js');
test('panel links accept nuclei and explicit states without paths or HTML',()=>{
 assert.deepEqual(C.parse('116Sn:1'),{nuclide:'116Sn',state:1});assert.deepEqual(C.parse('116mSn'),{nuclide:'116mSn',state:0});
 for(const bad of ['https://other/','<svg>','../lab','116Sn&x=1','116Sn:999',''])assert.equal(C.parse(bad),null);
 assert.equal(C.selection('?panels=116Sn,118Sn,120Sn,122Sn,124Sn').length,4);
 assert.equal(C.selection('?panels=116Sn,bad,118Sn').length,2);
});
test('panel browser saves are isolated from normal Lab and other panels',()=>{
 assert.equal(C.storageKey(''),'traps.measured-masses.v1');
 const a=C.storageKey('?panelId=one'),b=C.storageKey('?panelId=two');
 assert.notEqual(a,b);assert.notEqual(a,C.storageKey(''));
 assert.equal(C.storageKey('?panelId=../bad'),C.storageKey(''));
});
