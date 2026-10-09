const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('reference checkbox immediately redraws each scoped plot',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../static/js/nuclide-chart.js'),'utf8');
 const line=source.split('\n').find(x=>x.includes('root.querySelectorAll(".nc-prange input'));
 assert.ok(line,'plot-control binding exists');
 const make=()=>{let draws=0,events={};const input={addEventListener:(name,cb)=>events[name]=cb};const root={querySelectorAll:selector=>selector.includes('[name=nc-reference-ring]')?[input]:[]};vm.runInNewContext(line,{root,plotChain:()=>draws++});return {events,count:()=>draws};};
 const main=make(),child=make();assert.equal(typeof main.events.input,'function');
 main.events.input();assert.equal(main.count(),1);assert.equal(child.count(),0);
 child.events.input();assert.equal(child.count(),1);assert.equal(main.count(),1);
});
