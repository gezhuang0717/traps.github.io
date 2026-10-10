/* Shared export helpers for the site's canvases and data tables.
   window.zgExport.png(render, name)   render(scale) → canvas drawn at `scale`× resolution (high-quality PNG)
   window.zgExport.csv(header, rows, name)
   window.zgExport.record(canvas, seconds, name, onState)   WebM video of a live canvas (MediaRecorder)
   window.zgExport.button(label, onClick) → <button>                                                   */
(() => {
  if (window.zgExport) return;
  const save = (blob, name) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  let imageFormat = "png";
  // A self-contained image PDF: no upload, external service or website branding.
  function imagePdf(canvas, name) {
    const flat = document.createElement("canvas");
    flat.width = canvas.width; flat.height = canvas.height;
    const ctx = flat.getContext("2d"); ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, flat.width, flat.height); ctx.drawImage(canvas, 0, 0);
    const jpeg = Uint8Array.from(atob(flat.toDataURL("image/jpeg", 0.97).split(",")[1]), c => c.charCodeAt(0));
    const landscape = flat.width >= flat.height, pageW = landscape ? 842 : 595, pageH = landscape ? 595 : 842;
    const ratio = Math.min((pageW - 36) / flat.width, (pageH - 36) / flat.height);
    const w = flat.width * ratio, h = flat.height * ratio, x = (pageW - w) / 2, y = (pageH - h) / 2;
    const enc = new TextEncoder(), chunks = [], offsets = [0]; let size = 0;
    const append = v => { const b = typeof v === "string" ? enc.encode(v) : v; chunks.push(b); size += b.length; };
    const object = (n, body) => { offsets[n] = size; append(`${n} 0 obj\n${body}\nendobj\n`); };
    append("%PDF-1.4\n% image figure\n");
    object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Figure 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = size;
    append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${flat.width} /Height ${flat.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg); append("\nendstream\nendobj\n");
    const commands = `q\n${w.toFixed(5)} 0 0 ${h.toFixed(5)} ${x.toFixed(5)} ${y.toFixed(5)} cm\n/Figure Do\nQ\n`;
    object(5, `<< /Length ${enc.encode(commands).length} >>\nstream\n${commands}endstream`);
    const xref = size;
    append("xref\n0 6\n0000000000 65535 f \n");
    for (let i = 1; i <= 5; i++) append(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    save(new Blob(chunks, { type: "application/pdf" }), `${name}-${stamp()}.pdf`);
  }
  window.zgExport = {
    save, stamp,
    png(render, name, scale = 4) {
      const c = typeof render === "function" ? render(scale) : render;
      if (imageFormat === "pdf") { imagePdf(c, name); return; }
      c.toBlob(b => save(b, `${name}-${stamp()}.png`), "image/png");
    },
    pdf(render, name, scale = 4) {
      imagePdf(typeof render === "function" ? render(scale) : render, name);
    },
    csv(header, rows, name) {
      const q = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const text = "﻿" + [header, ...rows].map(r => r.map(q).join(",")).join("\r\n");
      save(new Blob([text], { type: "text/csv;charset=utf-8" }), `${name}-${stamp()}.csv`);
    },
    record(canvas, seconds, name, onState, options = {}) {
      if (!canvas.captureStream || !window.MediaRecorder) { const lang=(document.documentElement.lang||'en').split('-')[0];alert(({en:'Video recording is not supported in this browser.',zh:'此浏览器不支持视频录制。',fi:'Selain ei tue videon tallennusta.',de:'Dieser Browser unterstützt keine Videoaufnahme.',ja:'このブラウザーは動画の録画に対応していません。'})[lang]||'Video recording is not supported in this browser.');onState&&onState(false);return; }
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
      const type = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
      let stream,rec,failed=false;
      const parts=[];
      const finish=()=>{stream?.getTracks().forEach(t=>t.stop());onState&&onState(false);};
      const failure=error=>{console.warn("Video recording failed:",error?.message||"empty recording");failed=true;finish();const lang=(document.documentElement.lang||'en').split('-')[0];alert(({en:'Video recording failed. Try a shorter duration or another browser.',zh:'视频录制失败。请尝试较短时长或其他浏览器。',fi:'Videon tallennus epäonnistui. Kokeile lyhyempää kestoa tai toista selainta.',de:'Videoaufnahme fehlgeschlagen. Kürzere Dauer oder anderen Browser versuchen.',ja:'録画に失敗しました。短い時間または別のブラウザーでお試しください。'})[lang]||'Video recording failed.');};
      try{stream=canvas.captureStream(options.fps || 60);rec=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),videoBitsPerSecond:options.bitrate || 25e6});}catch(error){failure(error);return;}
      rec.ondataavailable = e => e.data.size && parts.push(e.data);
      rec.onerror=failure;
      rec.onstop = () => {
        if(failed){finish();return;}
        if(!parts.length){failure();return;}
        const container=canvas.closest('[data-trap3d],[data-trap2d],[data-workbench],[data-paul-cooling],[data-laser],#g-rfq');
        const mime=rec.mimeType||type||'video/webm';
        if(!container){save(new Blob(parts,{type:mime}),`${name}-${stamp()}.${mime.includes('mp4')?'mp4':'webm'}`);finish();return;}
        const previous=container.querySelector('[data-recording-result]');
        if(previous){URL.revokeObjectURL(previous.dataset.url);previous.remove();}
        const url=URL.createObjectURL(new Blob(parts,{type:mime})), box=document.createElement('div'),video=document.createElement('video'),link=document.createElement('a');
        const lang=(document.documentElement.lang||'en').split('-')[0],label=({en:'Save recorded video',zh:'保存录制视频',fi:'Tallenna kuvattu video',de:'Aufgenommenes Video speichern',ja:'録画した動画を保存'})[lang]||'Save recorded video';
        box.dataset.recordingResult='';box.dataset.url=url;video.src=url;video.controls=true;video.preload='metadata';video.style.width='100%';video.style.maxHeight='360px';link.href=url;link.download=`${name}-${stamp()}.${mime.includes('mp4')?'mp4':'webm'}`;link.textContent=label;link.className='zg-btn zg-btn-ghost';box.append(video,link);container.append(box);
        finish();
      };
      try{onState&&onState(true);rec.start(1000);}catch(error){failure(error);return;}
      setTimeout(() => rec.state !== "inactive" && rec.stop(), seconds * 1000);
      return rec;
    },
    caption(ctx,width,lines,y=18){
      ctx.save();ctx.font='12px system-ui';
      const wrapped=[];
      for(const line of lines){let text='';for(const word of line.split(' ')){const next=text?text+' '+word:word;if(text&&ctx.measureText(next).width>width-24){wrapped.push(text);text=word;}else text=next;}wrapped.push(text);}
      ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(5,y-14,width-10,wrapped.length*16+5);
      ctx.fillStyle='#17202a';wrapped.forEach((line,i)=>ctx.fillText(line,10,y+i*16));ctx.restore();
    },
  };
  // Reuse each figure's own PNG renderer so PDF shows the same inputs and view.
  const lang = (document.documentElement.lang || "en").split("-")[0];
  const note = ({ en: "Save PDF · high-resolution image", zh: "保存 PDF · 高分辨率图像", fi: "Tallenna PDF · tarkka kuva", de: "PDF speichern · hochauflösendes Bild", ja: "PDF 保存 · 高解像度画像" })[lang] || "Save PDF";
  function addPdfButtons(node) {
    const buttons = node.matches?.("button") ? [node] : Array.from(node.querySelectorAll?.("button") || []);
    for (const source of buttons) {
      if (source.dataset.pdfExport !== undefined || source.dataset.pdfReady || !/\bPNG\b/i.test(source.textContent)) continue;
      source.dataset.pdfReady = "true";
      const button = document.createElement("button"); button.type = "button";
      button.className = source.className; button.textContent = "⤓ PDF";
      button.title = note; button.setAttribute("aria-label", note); button.dataset.pdfExport = "";
      button.addEventListener("click", () => { if (source.disabled) return; imageFormat = "pdf"; try { source.click(); } finally { imageFormat = "png"; } });
      source.after(button);
    }
  }
  const install = () => {
    addPdfButtons(document.body);
    new MutationObserver(changes => { for (const change of changes) for (const node of change.addedNodes) if (node.nodeType === 1) addPdfButtons(node); }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
