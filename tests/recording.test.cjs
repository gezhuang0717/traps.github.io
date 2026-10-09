const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('static/js/zg-export.js','utf8');
function setup(failAt){
 const nodes=[],alerts=[],states=[];let stopped=0,clicked=0;
 const box={querySelector:()=>null,append:n=>nodes.push(n)};
 const element=tag=>({tag,dataset:{},style:{},append(...children){this.children=children;},click(){clicked++;}});
 class Recorder{
  static isTypeSupported(t){return t==='video/mp4';}
  constructor(stream,options){if(failAt==='construct')throw Error('codec');this.mimeType=options.mimeType;this.state='inactive';}
  start(){if(failAt==='start')throw Error('start');this.state='recording';}
  stop(){this.state='inactive';if(failAt!=='empty')this.ondataavailable({data:new Blob(['frame'])});this.onstop();}
 }
 const context={window:{MediaRecorder:Recorder},MediaRecorder:Recorder,Blob,TextEncoder,Uint8Array,Date,alert:x=>alerts.push(x),setTimeout:()=>0,
  URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:()=>{}},
  document:{readyState:'loading',documentElement:{lang:'en'},addEventListener:()=>{},createElement:element}};
 vm.runInNewContext(source,context);
 const canvas={captureStream:()=>({getTracks:()=>[{stop(){stopped++;}}]}),closest:()=>box};
 const record=()=>context.window.zgExport.record(canvas,3,'custom-radii',r=>states.push(r));
 return {record,nodes,alerts,states,get stopped(){return stopped;},get clicked(){return clicked;}};
}
test('recording produces a preview and correctly typed Save link without automatic download',()=>{
 const x=setup();x.record().stop();
 assert.deepEqual(x.states,[true,false]);assert.equal(x.stopped,1);assert.equal(x.clicked,0);
 const [video,link]=x.nodes[0].children;assert.equal(video.tag,'video');assert.equal(video.controls,true);assert.match(link.download,/^custom-radii-.*\.mp4$/);assert.equal(link.href,'blob:preview');
});
test('recorder construction and start failures release tracks and restore controls',()=>{
 for(const where of ['construct','start']){const x=setup(where);assert.equal(x.record(),undefined);assert.equal(x.stopped,1);assert.equal(x.states.at(-1),false);assert.equal(x.alerts.length,1);assert.equal(x.nodes.length,0);}
});
test('recorder runtime error and empty output never offer a broken saved video',()=>{
 const x=setup();const r=x.record();r.onerror();r.stop();assert.equal(x.states.at(-1),false);assert.equal(x.nodes.length,0);assert.equal(x.alerts.length,1);
 const y=setup('empty');y.record().stop();assert.equal(y.states.at(-1),false);assert.equal(y.nodes.length,0);assert.equal(y.alerts.length,1);
});
