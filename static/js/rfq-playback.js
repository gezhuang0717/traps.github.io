/* Shared scientific SVG playback and real canvas/MediaRecorder video export.
 * Animation time is deliberately slowed; the SVG retains physical time/units.
 * No camera, microphone, server upload, fabricated MP4, or external encoder.
 */
(function (host) {
  'use strict';
  const EN = { play: 'Play', pause: 'Pause', replay: 'Replay', position: 'Animation position', speed: 'Playback speed',
    duration: 'Video duration', seconds: 's', loop: 'Loop', video: 'Save video', cancel: 'Cancel recording',
    frame: 'Save current frame', recording: 'Recording the plotted model… keep this tab visible.',
    saved: 'Video saved.', cancelled: 'Recording cancelled.', unavailable: 'Video recording is unavailable in this browser. Figure exports remain available.',
    hidden: 'Recording stopped because the tab was hidden. Keep it visible and try again.',
    note: 'Playback is slowed for teaching. Physical times are shown in the figure.', exportError: 'Export failed' };
  const ZH = { play: '播放', pause: '暂停', replay: '重播', position: '动画进度', speed: '播放速度',
    duration: '视频时长', seconds: '秒', loop: '循环', video: '保存视频', cancel: '取消录制',
    frame: '保存当前帧', recording: '正在录制模型图…请保持此标签页可见。', saved: '视频已保存。', cancelled: '已取消录制。',
    unavailable: '此浏览器不能录制视频，仍可导出静态图。', hidden: '标签页隐藏，录制已停止。请保持页面可见后重试。',
    note: '为便于观察，动画按慢速播放；图中标注实际物理时间。', exportError: '导出失败' };
  function videoTypes(recorder = host.MediaRecorder) {
    if (!recorder?.isTypeSupported) return [];
    return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .filter(type => { try { return recorder.isTypeSupported(type); } catch (_) { return false; } });
  }
  function download(blob, filename) {
    if (host.zgExport?.save) { host.zgExport.save(blob, filename); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function mount(options) {
    const { container, renderFrame, getSVG } = options;
    const t = { ...(document.documentElement.lang.startsWith('zh') ? ZH : EN), ...(options.labels || {}) };
    const save = options.saveBlob || download, filename = options.filename || 'rfq-animation';
    const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const bar = make('div', 'rfq-playback'); bar.dataset.rfqPlayback = filename;
    if (!/^(en|zh)/.test(document.documentElement.lang)) bar.lang = 'en';
    const row = make('div', 'rfq-playback-controls'), playback = make('button', 'zg-btn', '▶ ' + t.play);
    const replay = make('button', 'zg-btn zg-btn-ghost', '↺ ' + t.replay);
    playback.type = replay.type = 'button'; playback.dataset.playbackAction = 'play'; replay.dataset.playbackAction = 'replay';
    const speedLabel = make('label', '', t.speed), speed = make('select'); speed.setAttribute('aria-label', t.speed);
    for (const x of [.25, .5, 1, 2, 4]) { const o = make('option', '', x + '×'); o.value = x; o.selected = x === 1; speed.append(o); }
    speedLabel.append(speed);
    const loopLabel = make('label', 'rfq-playback-check'), loop = make('input'); loop.type = 'checkbox'; loopLabel.append(loop, document.createTextNode(t.loop));
    row.append(playback, replay, speedLabel, loopLabel);
    const seekLabel = make('label', 'rfq-playback-seek', t.position), seek = make('input');
    seek.type = 'range'; seek.min = '0'; seek.max = '1000'; seek.step = '1'; seek.value = '1000'; seek.setAttribute('aria-label', t.position); seek.dataset.playbackSeek = '';
    seekLabel.append(seek);
    const exportRow = make('div', 'rfq-playback-controls');
    for (const format of ['SVG', 'PNG', 'PDF']) {
      const button = make('button', 'zg-btn zg-btn-ghost', t.frame + ' ' + format); button.type = 'button';
      button.dataset.playbackFrame = format.toLowerCase();
      // This toolbar already has a native PDF action. Suppress the site's
      // legacy automatic PDF wrapper around PNG buttons.
      if (format === 'PNG') button.dataset.pdfReady = 'true';
      button.addEventListener('click', async () => {
        pause(); const svg = getSVG(); if (!svg) return;
        button.disabled = true;
        try {
          if (host.ZGFigureStyle) await host.ZGFigureStyle.exportSVG(svg, format, filename + '-frame', undefined, {
            schema: 'rfq-animation-frame-v1', fraction, model: 'browser analytical/ideal-trajectory model', ...options.metadata
          });
          else if (format === 'SVG') save(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }), filename + '-frame.svg');
          else throw Error('Figure exporter unavailable');
        } catch (error) { status.textContent = t.exportError + ': ' + error.message; }
        finally { button.disabled = false; }
      }); exportRow.append(button);
    }
    const durationLabel = make('label', '', t.duration), duration = make('select'); duration.setAttribute('aria-label', t.duration);
    for (const n of [4, 8, 12, 20]) { const o = make('option', '', n + ' ' + t.seconds); o.value = n; o.selected = n === (options.durationSeconds || 8); duration.append(o); }
    durationLabel.append(duration);
    const types = videoTypes(), canRecord = !!types.length && typeof HTMLCanvasElement.prototype.captureStream === 'function';
    const extension = types[0]?.startsWith('video/mp4') ? 'mp4' : 'webm';
    const recordButton = make('button', 'zg-btn', t.video + ' (' + extension.toUpperCase() + ')'); recordButton.type = 'button';
    recordButton.dataset.playbackAction = 'record'; recordButton.disabled = !canRecord;
    exportRow.append(durationLabel, recordButton);
    const status = make('p', 'rfq-playback-status', canRecord ? t.note : t.unavailable); status.setAttribute('role', 'status');
    const preview = make('div', 'rfq-recording-preview'); preview.hidden = true;
    bar.append(row, seekLabel, exportRow, status, preview); container.append(bar);
    let fraction = 1, playing = false, raf = null, last = 0, destroyed = false, recording = false, cancelRecording = false;
    let recorder = null, stream = null;
    const draw = value => {
      fraction = Math.max(0, Math.min(1, Number(value))); seek.value = Math.round(fraction * 1000);
      bar.dataset.fraction = fraction.toFixed(6); return renderFrame(fraction);
    };
    function pause() { playing = false; if (raf !== null) cancelAnimationFrame(raf); raf = null; playback.textContent = '▶ ' + t.play; }
    function tick(timestamp) {
      if (!playing || destroyed) return;
      const step = last ? Math.min(.1, (timestamp - last) / 1000) : 0; last = timestamp;
      let next = fraction + step * Number(speed.value) / Number(duration.value);
      if (next >= 1) { if (loop.checked) next %= 1; else { draw(1); pause(); return; } }
      draw(next); raf = requestAnimationFrame(tick);
    }
    function play() {
      if (destroyed || recording) return;
      if (fraction >= 1) draw(0);
      playing = true; last = 0; playback.textContent = 'Ⅱ ' + t.pause; raf = requestAnimationFrame(tick);
    }
    playback.addEventListener('click', () => playing ? pause() : play());
    replay.addEventListener('click', () => { pause(); draw(0); play(); });
    seek.addEventListener('input', () => { pause(); draw(Number(seek.value) / 1000); });
    function visibleChange() { if (document.hidden) { pause(); if (recording) cancelRecording = true; } }
    document.addEventListener('visibilitychange', visibleChange);
    async function raster(svg, canvas) {
      if (!svg) throw Error('No rendered figure');
      const copy = svg.cloneNode(true); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const vb = (copy.getAttribute('viewBox') || '0 0 800 500').split(/[ ,]+/).map(Number);
      copy.setAttribute('width', String(vb[2])); copy.setAttribute('height', String(vb[3]));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = new Image(); await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(Error('SVG could not be rendered')); img.src = url; });
        const ctx = canvas.getContext('2d'), scale = Math.min(canvas.width / vb[2], canvas.height / vb[3]);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, (canvas.width - vb[2] * scale) / 2, (canvas.height - vb[3] * scale) / 2, vb[2] * scale, vb[3] * scale);
      } finally { URL.revokeObjectURL(url); }
    }
    async function record() {
      if (recording) { cancelRecording = true; return; }
      if (!canRecord || destroyed) return;
      pause(); recording = true; cancelRecording = false;
      const controls = [...bar.querySelectorAll('button,input,select')]; controls.forEach(e => { if (e !== recordButton) e.disabled = true; });
      recordButton.textContent = t.cancel; status.textContent = t.recording;
      const canvas = make('canvas'); canvas.width = 1280; canvas.height = 800; canvas.setAttribute('aria-label', t.recording);
      preview.replaceChildren(canvas); preview.hidden = false;
      let saved = false;
      try {
        await raster(draw(0), canvas); stream = canvas.captureStream(30);
        for (const mimeType of types) { try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 }); break; } catch (_) { recorder = null; } }
        if (!recorder) throw Error(t.unavailable);
        const chunks = [], type = recorder.mimeType;
        let recorderError = null;
        // Settle with an outcome, rather than leaving a rejected promise
        // unobserved while SVG frames are still being rasterized.
        const stopped = new Promise(resolve => {
          recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
          recorder.onerror = e => { recorderError = e.error || Error('MediaRecorder failed'); resolve(recorderError); };
          recorder.onstop = () => resolve(recorderError);
        });
        recorder.start(250);
        const seconds = Number(duration.value), start = performance.now(); let frames = 0;
        while (!cancelRecording && !destroyed && !recorderError) {
          if (document.hidden) { cancelRecording = true; break; }
          const f = Math.min(1, (performance.now() - start) / (1000 * seconds));
          await raster(draw(f), canvas); frames++;
          if (f >= 1) break;
          await new Promise(resolve => setTimeout(resolve, 1000 / 30));
        }
        if (recorder.state !== 'inactive') recorder.stop();
        const terminalError = await stopped; if (terminalError) throw terminalError;
        if (!cancelRecording && !destroyed) {
          const blob = new Blob(chunks, { type }); if (blob.size < 1000 || frames < 2) throw Error('Empty recording');
          const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm'; save(blob, filename + '.' + ext);
          bar.dataset.lastVideoType = type; bar.dataset.lastVideoBytes = blob.size; bar.dataset.lastVideoFrames = frames;
          status.textContent = t.saved + ' ' + ext.toUpperCase() + ' · ' + (blob.size / 1048576).toFixed(2) + ' MB'; saved = true;
        }
      } catch (error) { if (!destroyed) status.textContent = t.exportError + ': ' + error.message; }
      finally {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        stream?.getTracks().forEach(track => track.stop()); stream = null; recorder = null; recording = false;
        if (!destroyed) {
          controls.forEach(e => e.disabled = false); recordButton.disabled = !canRecord;
          recordButton.textContent = t.video + ' (' + extension.toUpperCase() + ')'; preview.hidden = true;
          if (!saved && cancelRecording) status.textContent = document.hidden ? t.hidden : t.cancelled;
        }
      }
    }
    recordButton.addEventListener('click', record);
    draw(1);
    return { play, pause, seek: draw, record, get fraction() { return fraction; }, get recording() { return recording; },
      destroy() { destroyed = true; cancelRecording = true; pause(); document.removeEventListener('visibilitychange', visibleChange);
        if (recorder && recorder.state !== 'inactive') recorder.stop(); stream?.getTracks().forEach(track => track.stop()); bar.remove(); } };
  }
  host.ZGRFQPlayback = Object.freeze({ mount, videoTypes });
  if (typeof module === 'object' && module.exports) module.exports = { videoTypes };
})(typeof window === 'object' ? window : globalThis);
