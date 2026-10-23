const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../static/js/spectroscopy-settings.js');
const example={schema:S.schema,activeTab:'sp-cls',inputs:{'doppler-massU':'87.905063674','radiusShift-massU':'42','king-points':'1,4\n2,7\n3,10','quoted':'a,"b" = c','formula':'=1+1'},sources:[{id:'test',evaluation_date:'2013',retrieved_date:'2026-10-23'}]};
for(const format of ['json','csv','txt'])test('Lossless '+format+' preserves independent inputs, multiline values and source dates',()=>{assert.deepEqual(S.parse(S.serialize(example,format),format),example);assert.deepEqual(S.parse('\uFEFF'+S.serialize(example,format)),example);});
test('CSV values are JSON encoded so formulas do not start spreadsheet cells',()=>{const csv=S.serialize(example,'csv');assert.match(csv,/"""=1\+1"""/);});
test('Duplicate assignments and malformed quoted CSV are rejected',()=>{assert.throws(()=>S.parse('schema = "traps-spectroscopy-v1"\ninput.a = "1"\ninput.a = "2"','txt'),/settings_duplicate/);assert.throws(()=>S.parse('section,key,json_value\ninput,a,"broken','csv'),/settings_csv_quotes/);});
test('No prototype keys, unsupported tabs, missing schemas or non-string inputs',()=>{for(const value of [{...example,schema:'unknown'},{...example,activeTab:'external'},{...example,inputs:{x:5}},JSON.parse('{"schema":"traps-spectroscopy-v1","inputs":{"__proto__":"x"}}')])assert.throws(()=>S.normalize(value));});
test('TXT parser preserves equals and comments inside JSON values',()=>{assert.equal(S.parse(S.serialize({...example,inputs:{x:'# a = b'}},'txt')).inputs.x,'# a = b');});
test('Resource size and unknown formats are bounded',()=>{assert.throws(()=>S.parse(' '.repeat(131073)));assert.throws(()=>S.serialize(example,'xml'));});
