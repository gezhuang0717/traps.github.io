(function (host) {
  'use strict';
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const valid = p => finite(p.x) && finite(p.y);
  function chainExtent(data, models = [], options = {}) {
    const points = data.concat(models).filter(valid);
    const xs = options.xMode === 'full' ? (options.fullX || []).filter(finite) : points.map(p => p.x);
    let x0 = xs.length ? Math.min(...xs) - 1 : 0, x1 = xs.length ? Math.max(...xs) + 1 : 1;
    const yp = options.yMode === 'data' && data.some(valid) ? data.filter(valid) : points;
    const ys = yp.flatMap(p => options.errors === false ? [p.y] : [p.y - (finite(p.e) ? p.e : 0), p.y + (finite(p.e) ? p.e : 0)]);
    let y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : 1;
    const pad = (y1 - y0) * .08 || 1; y0 -= pad; y1 += pad;
    const warnings = [], m = options.manual || {};
    for (const [mode, lo, hi] of [[options.xMode, 'x0', 'x1'], [options.yMode, 'y0', 'y1']]) {
      if (mode !== 'manual') continue;
      if (!(finite(m[lo]) && finite(m[hi]) && m[hi] > m[lo])) warnings.push(lo[0]);
      else if (lo === 'x0') { x0 = m.x0; x1 = m.x1; } else { y0 = m.y0; y1 = m.y1; }
    }
    return { x0, x1, y0, y1, warnings };
  }
  function geometry(extent, width, height, multiple = false, scale = 1, legendHeight = 0) {
    const L = 62 * scale, R = (multiple ? 78 : 18) * scale, T = (18+legendHeight) * scale, B = 42 * scale;
    const px = x => L + (x - extent.x0) / (extent.x1 - extent.x0) * (width - L - R);
    const py = y => height - B - (y - extent.y0) / (extent.y1 - extent.y0) * (height - B - T);
    return { L, R, T, B, right: width - R, bottom: height - B, px, py, clampY: y => Math.max(T, Math.min(height - B, py(y))) };
  }
  function nearest(points, x, y, geom, radius = 24) {
    let found = null, distance = radius ** 2;
    for (const p of points.filter(valid)) {
      const dx = geom.px(p.x) - x, dy = geom.clampY(p.y) - y;
      const d = dx * dx + dy * dy;
      if (d <= distance && geom.px(p.x) >= geom.L && geom.px(p.x) <= geom.right) { found = p; distance = d; }
    }
    return found;
  }
  const connects = (a, b, step = 1) => a && b && a.g === b.g && a.series === b.series && b.x - a.x === step;
  function rangeFor(memory, type, own) {
    return memory[type] || { c0: String(own), c1: String(own), x0: '', x1: '' };
  }
  function zoomExtent(d,factor,ax=.5,ay=.5){
    if(!(factor>0&&finite(factor)))return {...d};
    const f=Math.max(.1,Math.min(10,factor)),out={...d};
    for(const [lo,hi,a]of [['x0','x1',ax],['y0','y1',ay]]){
      const anchor=d[lo]+Math.max(0,Math.min(1,a))*(d[hi]-d[lo]);
      out[lo]=anchor+(d[lo]-anchor)*f;out[hi]=anchor+(d[hi]-anchor)*f;
    }return out;
  }
  function panExtent(d,dx,dy){return {...d,x0:d.x0+dx,x1:d.x1+dx,y0:d.y0+dy,y1:d.y1+dy};}
  function chartFit(rows,width,height){
    let maxZ=0,maxN=0;
    for(const [z,n] of rows){if(finite(z)&&finite(n)){maxZ=Math.max(maxZ,z);maxN=Math.max(maxN,n);}}
    const s=Math.min(width/(maxN+3),height/(maxZ+3));
    return {s,x:(width-(maxN+1)*s)/2,y:(height-(maxZ+1)*s)/2};
  }
  // Count only surviving algebraic primitives; cancelled inputs are not sources.
  function composition(value) {
    const ids=Object.entries(value?.terms||{}).filter(([,t])=>finite(t.c)&&Math.abs(t.c)>=1e-14).map(([id])=>id);
    const experimental=ids.filter(id=>id.startsWith('loaded:'));
    // Fixed n, 1H and alpha reference masses do not make an otherwise fully
    // new nuclide stencil mixed. They remain present in values/uncertainties.
    const references=new Set(['AME2020:1','AME2020:1000','AME2020:2002']);
    const ame=ids.filter(id=>id.startsWith('AME2020:')&&!references.has(id));
    return {experimental,ame,mixed:experimental.length>0&&ame.length>0};
  }
  const markers=Object.freeze({circle:['●','○'],diamond:['◆','◇'],square:['■','□'],triangle:['▲','△'],down:['▼','▽'],hexagon:['⬢','⬡'],star:['★','☆']});
  // Experimental selection uses the whole AME stencil, including neighbours.
  // Models have no experimental sigma of their own; the caller supplies the
  // AME centre sigma, or the active input sigma for New / New + AME2020.
  function experimentalFilter({mode='all',centre,reference,value,active=false,affected=false,mass,maxSigma=null}) {
    if(mode==='measured'&&(!centre||centre.est||!reference||reference.est||!value||value.est))return false;
    if(mode==='loaded'&&!active||mode==='affected'&&!affected)return false;
    if(maxSigma!=null&&(!finite(maxSigma)||maxSigma<0||!mass||!finite(mass.e)||mass.e>maxSigma))return false;
    return true;
  }
  function markerPath(c,shape,x,y,r){
    c.beginPath();
    if(shape==='circle'||shape==='model'){c.arc(x,y,r,0,Math.PI*2);return;}
    if(shape==='square'){c.rect(x-r,y-r,2*r,2*r);return;}
    const count=shape==='diamond'?4:shape==='hexagon'?6:shape==='star'?10:3;
    const angle=shape==='down'?Math.PI/2:-Math.PI/2;
    for(let i=0;i<count;i++){
      const radius=shape==='star'&&i%2?r*.45:r*1.25,a=angle+i*2*Math.PI/count;
      const xx=x+radius*Math.cos(a),yy=y+radius*Math.sin(a);
      if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy);
    }c.closePath();
  }
  function paintMarker(c,shape,x,y,r,color,open=false,background='#fff'){
    markerPath(c,shape,x,y,r);c.fillStyle=open?background:color;c.strokeStyle=color;c.fill();c.stroke();
  }
  const api = { chainExtent, geometry, nearest, connects, rangeFor, zoomExtent, panExtent, chartFit, composition, experimentalFilter, markers, markerPath, paintMarker };
  host.ZGChainPlot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
