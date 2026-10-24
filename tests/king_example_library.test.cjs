'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const D=require('../static/js/spectroscopy-data.js'),U=require('../static/js/spectroscopy-uncertainty.js');
const dir='static/data/research-examples/king/',index=JSON.parse(fs.readFileSync(dir+'index.json'));
test('five training datasets have identical rows/methods in CSV, TXT and JSON, with explicit units/provenance',()=>{
 assert.deepEqual(index.map(q=>q.id),['correlated','heteroscedastic','exact-x','ols','curved']);
 const hash=crypto.createHash('sha256').update(fs.readFileSync('tools/make_king_examples.py')).digest('hex');
 for(const item of index){let expected;for(const ext of ['csv','txt','json']){const text=fs.readFileSync(dir+item.files[ext],'utf8'),p=D.parseKing(text);assert.equal(p.points.length,item.rows);assert.equal(p.weighted,item.method==='EIV');assert.equal(p.units,'GHz·u');assert.equal(p.provenance.kind,'synthetic-training');assert.equal(p.provenance.dataset_id,item.id);if(expected)assert.deepEqual(p.points,expected);else expected=p.points;}
  const j=JSON.parse(fs.readFileSync(dir+item.files.json));assert.equal(j.provenance.generator_sha256,hash);assert.equal(j.provenance.evaluation_date,null);assert.equal(j.provenance.retrieved_date,null);for(const source of j.provenance.calculation_sources)assert.ok(fs.existsSync(source));}
});
test('correlated example is exactly the requested five points; omitted OLS errors remain absent',()=>{
 const a=D.parseKing(fs.readFileSync(dir+'correlated.csv','utf8')).points,b=D.parseKing(fs.readFileSync(dir+'ols.json','utf8'));
 assert.deepEqual(a,[{x:0,y:1.02,sx:.05,sy:.1,rho_xy:.2},{x:1,y:2.95,sx:.06,sy:.12,rho_xy:-.1},{x:2,y:5.1,sx:.05,sy:.1,rho_xy:.15},{x:3,y:6.9,sx:.07,sy:.14,rho_xy:0},{x:4,y:9.05,sx:.06,sy:.12,rho_xy:.25}]);
 assert.deepEqual(b.points,a.map(({x,y})=>({x,y})));assert.equal(b.weighted,false);
});
test('all EIV examples fit with supplied errors; exact x stays zero and constructed curvature has a poor line fit',()=>{
 for(const item of index.filter(q=>q.method==='EIV')){const p=D.parseKing(fs.readFileSync(dir+item.files.json,'utf8')),fit=U.kingFit(p);assert.ok(Number.isFinite(fit.slope));assert.ok(fit.sigma_slope>0);assert.ok(fit.sigma_intercept>0);if(item.id==='exact-x')assert.ok(p.points.every(q=>q.sx===0&&q.sy>0));if(item.id==='curved'){assert.ok(p.points.every(q=>Math.abs(q.y-(1+2*q.x+.3*q.x*q.x))<1e-12));assert.ok(fit.chi2/fit.dof>10);}}
});
test('bare JSON arrays preserve explicit unknown errors and reject half-supplied errors or rho without errors',()=>{
 const p=D.parseKing(JSON.stringify([{x:0,y:1,sx:null,sy:null},{x:1,y:3},{x:2,y:5}]));assert.equal(p.weighted,false);assert.ok(p.points.every(q=>!Object.hasOwn(q,'sx')));
 for(const row of [{x:0,y:1,sx:0.1},{x:0,y:1,rho_xy:.2}])assert.throws(()=>D.parseKing(JSON.stringify([row])),/sx and sy|rho requires/);
});
