const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('static/js/cooling-view.js','utf8'),ctx);const V=ctx.window.ZGCoolingView;
test('Playback consumes the same fixed steps at different presentation frame rates',()=>{
 function count(fps){const c=V.playbackClock(()=>1);let n=0;c.next(0,20);for(let i=1;i<=fps;i++)n+=c.next(1000*i/fps,20);return n;}
 assert.equal(count(60),1200);assert.equal(count(30),1200);assert.equal(count(20),1200);
});
test('Slow playback carries fractional work and single reset clears stale wall time',()=>{
 const c=V.playbackClock(()=>.05);let n=0;c.next(0,4);for(let i=1;i<=60;i++)n+=c.next(1000*i/60,4);assert.equal(n,12);
 c.reset();assert.equal(c.next(100000,4),0);assert.equal(c.next(100000+1000/60,4),0);
});
test('Fast playback caps work and discards a hidden-tab backlog',()=>{
 const c=V.playbackClock(()=>10);assert.equal(c.next(0,32),0);assert.equal(c.next(60000,32),240);
 assert.ok(c.next(60001,32)<=20);
});
test('All cooling tabs include the shared speed number/slider, step and selectable capture fps',()=>{
 const classic=fs.readFileSync('layouts/_partials/zg/laser-cooling.html','utf8'),fancy=fs.readFileSync('layouts/_partials/zg/paul-cooling.html','utf8'),panel=fs.readFileSync('layouts/_partials/zg/cooling-playback.html','utf8');
 assert.equal((classic.match(/partial "zg\/cooling-playback.html"/g)||[]).length,2);assert.equal((fancy.match(/partial "zg\/cooling-playback.html"/g)||[]).length,1);
 for(const token of ['name="playbackSlider"','name="playbackSpeed"','data-playback-step','name="videoFps"'])assert.ok(panel.includes(token));
});
