'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spectrum, project } = require('../static/js/rfq-motion-view.js');
const { videoTypes } = require('../static/js/rfq-playback.js');

test('calibrated Hann spectrum recovers independent known amplitudes and frequencies', () => {
  const rows = Array.from({ length: 2048 }, (_, i) => ({ cycle: i/32,
    x_mm: 9 + 1.2*Math.cos(2*Math.PI*.125*i/32) + .4*Math.cos(2*Math.PI*i/32) }));
  const result = spectrum(rows, .7);
  for (const [frequency, amplitude] of [[.0875, 1.2], [.7, .4]]) {
    const bin = result.points.reduce((best, p) => Math.abs(p.x-frequency) < Math.abs(best.x-frequency) ? p : best);
    assert.ok(Math.abs(bin.x-frequency) < 1e-12);
    assert.ok(Math.abs(bin.y-amplitude) < .0001, `${frequency}: ${bin.y}`);
  }
  assert.equal(result.window, 'Hann');
  assert.equal(result.source_samples, 2048);
  assert.equal(result.fft_size, 2048);
  assert.ok(Math.abs(result.resolution_MHz - .7/64) < 1e-12);
});

test('FFT padding preserves actual record resolution and drops only a short final interval', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ cycle:i/32, x_mm:Math.sin(i) }));
  rows.push({cycle:99.5/32,x_mm:0});
  const result = spectrum(rows, 1);
  assert.equal(result.source_samples, 100);
  assert.equal(result.fft_size, 128);
  assert.equal(result.resolution_MHz, .32);
  assert.equal(spectrum(rows.slice(0,7),1), null);
  const bad=rows.slice(0,50); bad[20]={...bad[20],cycle:bad[20].cycle+.01};
  assert.throws(()=>spectrum(bad,1), /uniform/);
});

test('3D camera is a rigid rotation, preserving physical distances before projection', () => {
  for(const yaw of [-180,-35,0,79,180]) for(const pitch of [-80,0,25,80]) {
    const p=project([3,4,12],yaw,pitch,2);
    assert.ok(Math.abs(Math.hypot(...p)-Math.sqrt(125))<1e-12);
    const a=project([1,2,3],yaw,pitch,2),b=project([4,6,15],yaw,pitch,2);
    assert.ok(Math.abs(Math.hypot(...a.map((v,i)=>b[i]-v))-13)<1e-12);
    assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<=13+1e-12);
  }
  assert.deepEqual(project([3,4,12],0,0,2),[3,4,10]);
});

test('video types follow actual browser capabilities and never invent a container', () => {
  assert.deepEqual(videoTypes(null), []);
  assert.deepEqual(videoTypes({isTypeSupported:t=>t==='video/webm;codecs=vp8'}),['video/webm;codecs=vp8']);
  assert.deepEqual(videoTypes({isTypeSupported:t=>t==='video/mp4'||t==='video/webm'}),['video/mp4','video/webm']);
  assert.deepEqual(videoTypes({isTypeSupported:()=>{throw Error('unsupported');}}),[]);
});
