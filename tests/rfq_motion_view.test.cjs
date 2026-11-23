'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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

test('mocked encoder error restores playback without an unhandled rejection or download', async () => {
  // This is controlled failure-path evidence, not browser/video-decoding evidence.
  // Exercise the actual playback module; only its DOM, rasterizer and encoder
  // boundary are stubs. Real encoded files are checked in browser acceptance.
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.disabled = false; }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(e => e !== this); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    addEventListener() {}
    cloneNode() { const copy = new Element(this.tag); copy.attrs = { ...this.attrs }; return copy; }
    querySelectorAll(selector) {
      const tags = selector.split(','), found = [];
      for (const child of this.children) { if (tags.includes(child.tag)) found.push(child); found.push(...child.querySelectorAll(selector)); }
      return found;
    }
    get value() { return this._value ?? this.children.find(e => e.selected)?.value ?? ''; }
    set value(value) { this._value = String(value); }
  }
  let stoppedTracks = 0, now = 0, encoderErrors = 0;
  const track = { stop() { stoppedTracks++; } }, stream = { getTracks: () => [track] };
  class Canvas extends Element {
    constructor() { super('canvas'); }
    captureStream() { return stream; }
    getContext() { return { fillRect() {}, drawImage() {} }; }
  }
  class RasterImage { set src(_) { setImmediate(() => this.onload()); } }
  class Encoder {
    static isTypeSupported(type) { return type === 'video/webm'; }
    constructor(_, options) { this.mimeType = options.mimeType; this.state = 'inactive'; }
    start() {
      this.state = 'recording';
      setImmediate(() => {
        this.state = 'inactive'; encoderErrors++;
        this.onerror({ error: Error('Synthetic encoder failure') });
        this.ondataavailable({ data: new Blob(['partial encoded output']) });
        this.onstop();
      });
    }
    stop() { this.state = 'inactive'; setImmediate(() => this.onstop()); }
  }
  const document = { documentElement: { lang: 'en' }, hidden: false,
    createElement: tag => tag === 'canvas' ? new Canvas() : new Element(tag),
    createTextNode: text => Object.assign(new Element('#text'), { textContent: text }),
    addEventListener() {}, removeEventListener() {} };
  const sandbox = { document, HTMLCanvasElement: Canvas, MediaRecorder: Encoder, Image: RasterImage, Blob,
    XMLSerializer: class { serializeToString() { return '<svg xmlns="http://www.w3.org/2000/svg"/>'; } },
    URL: { createObjectURL: () => 'blob:mock-frame', revokeObjectURL() {} },
    performance: { now: () => (now += 250) },
    setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 1)), cancelAnimationFrame() {} };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/rfq-playback.js'), 'utf8'), sandbox);
  const container = new Element('div'), svg = new Element('svg'); svg.setAttribute('viewBox', '0 0 400 300');
  const downloads = [], rendered = [], unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const player = sandbox.ZGRFQPlayback.mount({ container, renderFrame: f => { rendered.push(f); return svg; },
    getSVG: () => svg, saveBlob: (...args) => downloads.push(args), durationSeconds: 4 });
  try {
    const bar = container.children[0], controls = bar.querySelectorAll('button,input,select');
    const recordButton = controls.find(e => e.dataset.playbackAction === 'record');
    const pending = player.record();
    assert.equal(player.recording, true);
    assert.ok(controls.every(e => e === recordButton ? !e.disabled : e.disabled));
    await pending;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(encoderErrors, 1, 'the asynchronous encoder failure was actually injected');
    assert.deepEqual(unhandled, [], 'encoder failure must be handled before the next event-loop turn');
    assert.equal(stoppedTracks, 1, 'all capture tracks are stopped on failure');
    assert.equal(player.recording, false);
    assert.ok(controls.every(e => !e.disabled), 'controls are usable again');
    assert.equal(recordButton.textContent, 'Save video (WEBM)');
    assert.equal(bar.children.find(e => e.className === 'rfq-recording-preview').hidden, true);
    assert.match(bar.children.find(e => e.className === 'rfq-playback-status').textContent, /Export failed: Synthetic encoder failure/);
    assert.equal(downloads.length, 0, 'partial encoder output must not be downloaded');
    assert.ok(rendered.length <= 3, 'an encoder failure stops the frame loop promptly');
  } finally { player.destroy(); process.removeListener('unhandledRejection', onUnhandled); }
});
