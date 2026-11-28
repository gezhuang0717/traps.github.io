const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..'),P=require('../static/js/physics.js');
const load=name=>JSON.parse(fs.readFileSync(path.join(dir,'static/data',name),'utf8'));
const html=fs.readFileSync(path.join(dir,'layouts/_shortcodes/games.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'static/js/games.js'),'utf8');
test('Games loads evaluated AME2026/NUBASE2026 as one consistent default trio',()=>{
 assert.match(html,/data-catalogue="\{\{ "data\/nuclear-states2026\.json"/);
 assert.match(html,/data-src="\{\{ "data\/nubase2026\.json"/);
 assert.match(html,/data-ame="\{\{ "data\/ame2026\.json"/);
 assert.match(html,/data-edition="2026"/);
 for(const name of ['data-catalogue-2020','data-src-2020','data-ame-2020'])assert.ok(html.includes(name));
 assert.ok(html.includes('data-games-edition'));
 assert.ok(js.includes("get('evaluation')==='2020'?'2020':'2026'"));
 assert.ok(js.includes("root.getAttribute('data-'+name+'-2020')"));
 assert.ok(js.includes('root.dataset.activeEvaluation=editionYear'));
});
test('Ground ion masses actually change between the source evaluations',()=>{
 const old=P.catalogue(load('nuclear-states.json'),load('ame2020.json'));
 const now=P.catalogue(load('nuclear-states2026.json'),load('ame2026.json'));
 const delta=(now.resolve('100Sn').M-old.resolve('100Sn').M)*P.C.uKeV;
 assert.ok(Math.abs(delta-0.287)<.015,'AME2026−AME2020 shared mass difference '+delta);
 const newer=JSON.stringify(now.resolve('100Sn').value.terms||{});
 const older=JSON.stringify(old.resolve('100Sn').value.terms||{});
 assert.match(newer,/AME2026/);assert.match(older,/AME2020/);
});
test('Year-specific scientific provenance is not hard-coded to AME2020 in game outputs',()=>{
 assert.ok(js.includes("const AME='AME'+editionYear,NUBASE='NUBASE'+editionYear"));
 assert.ok(js.includes("source:{names:[AME,NUBASE]"));
 assert.ok(js.includes('source={name:AME'));
 assert.ok(js.includes('NUBASE} Eₓ'));
 assert.ok(!js.includes("source:{names:['AME2020','NUBASE2020']"));
 assert.ok(!js.includes('vs AME2020)'));
});
test('No private research manuals or credentials added to public source',()=>{
 assert.ok(!html.includes('website_manuals'));
 assert.ok(!js.includes('website_manuals'));
 assert.ok(!html.includes('sk-proj'));
 assert.ok(!js.includes('PRIVATE'));
 assert.ok(html.includes('https://amdc.impcas.ac.cn/masstables/Ame2026/filel.html'));
});
