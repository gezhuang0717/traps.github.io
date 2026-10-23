const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const U = require('../static/js/spectroscopy-uncertainty.js');
const S = require('../static/js/spectroscopy-core.js');
const p = { shiftMHz: 200, K_GHz_u: 24, F_GHz_fm2: -2, massU: 12, referenceMassU: 24,
  sigma_shiftMHz: 1, sigma_K_GHz_u: .1, sigma_F_GHz_fm2: .02, sigma_massU: .001, sigma_referenceMassU: .001 };
const near = (a, b, eps = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= eps, `${a} != ${b} (tol ${eps})`);
const diag = v => v.map((s, i) => v.map((_, j) => i === j ? s * s : 0));
const error = code => e => e.code === code;

test('DOM-free browser and CommonJS have identical APIs', () => {
  const c = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../static/js/spectroscopy-uncertainty.js'), 'utf8'), c);
  assert.deepEqual(Object.keys(c.TrapsSpectroscopyUncertainty), Object.keys(U));
});
test('signed field and mass factors retain core values, with analytic independent standard uncertainty', () => {
  const r = U.shiftToRadius(p);
  near(r.delta_fm2, .4); near(r.massShiftMHz, 1000);
  assert.deepEqual({ delta_fm2: r.delta_fm2, massShiftMHz: r.massShiftMHz }, S.radiusFromShift(p));
  const j = [-.0005, 1 / 48, .2, -1 / 12, 1 / 48];
  const s = [1, .1, .02, .001, .001];
  near(r.sigma_fm2, Math.sqrt(j.reduce((z, v, i) => z + v * v * s[i] * s[i], 0)));
  for (let i = 0; i < j.length; i++) near(r.jacobian[U.SHIFT_ORDER[i]], j[i]);
});
test('all five radius derivatives agree with independent central numerical differences for signed K/F', () => {
  for (const K of [-24, 24]) for (const F of [-2, 2]) {
    const a = { ...p, K_GHz_u: K, F_GHz_fm2: F }, r = U.shiftToRadius(a);
    U.SHIFT_ORDER.forEach(key => {
      const h = Math.max(Math.abs(a[key]), 1) * 1e-5;
      const derivative = (S.radiusFromShift({ ...a, [key]: a[key] + h }).delta_fm2 - S.radiusFromShift({ ...a, [key]: a[key] - h }).delta_fm2) / (2 * h);
      near(r.jacobian[key], derivative, 2e-10);
    });
  }
});
test('full covariance cross terms change uncertainty and survive scale-separated units', () => {
  const c = diag([1, .1, .02, .001, .001]); c[1][2] = c[2][1] = -.001;
  const r = U.shiftToRadius({ ...p, covariance: c });
  const base = U.shiftToRadius(p);
  near(r.sigma_fm2 ** 2, base.sigma_fm2 ** 2 + 2 * r.jacobian.K_GHz_u * r.jacobian.F_GHz_fm2 * -.001);
  const tiny = [[1e-20, 1e-11], [1e-11, .01]];
  assert.doesNotThrow(() => U.validateCovariance(tiny, 2));
  assert.throws(() => U.validateCovariance([[1e-20, 2e-11], [2e-11, .01]], 2), error('COVARIANCE_NOT_PSD'));
});
test('missing, blank and nonnumeric uncertainties stay unknown or fail explicitly', () => {
  const r = U.shiftToRadius({ ...p, sigma_massU: null });
  assert.equal(r.sigma_fm2, null); assert.equal(r.warnings[0].code, 'MISSING_UNCERTAINTY');
  assert.equal(U.shiftToRadius({ ...p, sigma_massU: '' }).sigma_fm2, null);
  assert.throws(() => U.shiftToRadius({ ...p, sigma_massU: '1' }), error('INPUT_FINITE'));
  assert.throws(() => U.shiftToRadius({ ...p, sigma_massU: -1 }), error('UNCERTAINTY_NEGATIVE'));
  assert.throws(() => U.shiftToRadius({ ...p, F_GHz_fm2: 0 }), error('FIELD_FACTOR_ZERO'));
  assert.ok(U.shiftToRadius({ ...p, sigma_F_GHz_fm2: 1 }).warnings.some(w => w.code === 'FIELD_FACTOR_NEAR_ZERO'));
});
test('covariance validation rejects nonsymmetric and globally indefinite correlation matrices', () => {
  assert.throws(() => U.validateCovariance([[1, .2], [.3, 1]], 2), error('COVARIANCE_ASYMMETRIC'));
  assert.throws(() => U.validateCovariance([[1, -.9, -.9], [-.9, 1, -.9], [-.9, -.9, 1]], 3), error('COVARIANCE_NOT_PSD'));
  assert.throws(() => U.validateCovariance([[0, 1e-300], [1e-300, 1]], 2), error('COVARIANCE_NOT_PSD'));
  assert.doesNotThrow(() => U.validateCovariance([[1, 1], [1, 1]], 2));
});
test('same measured reference cancels exactly and does not equate independent equal masses', () => {
  const self = { ...p, shiftMHz: 0, massU: 24, sameReference: true, sigma_shiftMHz: 0 };
  near(U.shiftToRadius(self).sigma_fm2, 0);
  assert.ok(U.shiftToRadius({ ...self, sameReference: false }).sigma_fm2 > 0);
  assert.throws(() => U.shiftToRadius({ ...self, sigma_shiftMHz: 1 }), error('SAME_REFERENCE_CONFLICT'));
  const c = diag([0, .1, .02, .001, .001]); c[3][4] = c[4][3] = .000001;
  near(U.shiftToRadius({ ...self, covariance: c }).sigma_fm2, 0);
});
test('absolute rms radius includes reference radius and delta covariance', () => {
  const a = { delta_fm2: 7, referenceRadius_fm: 3, sigma_delta_fm2: .4, sigma_referenceRadius_fm: .1 };
  near(U.radiusFromDifference(a).radius_fm, 4); near(U.radiusFromDifference(a).sigma_fm, Math.sqrt(.4 ** 2 / 64 + .75 ** 2 * .1 ** 2));
  near(U.radiusFromDifference({ ...a, covariance: [[.16, .02], [.02, .01]] }).sigma_fm ** 2, .011875);
  assert.equal(U.radiusFromDifference({ ...a, sigma_referenceRadius_fm: null }).sigma_fm, null);
});
test('modified King shifts propagate shared masses/reference into both axes and across isotope pairs', () => {
  const raw = { referenceMassU: 40, sigma_referenceMassU: .001, points: [42,44,48].map((massU, i) => ({ massU, shiftX_MHz: 100 + i * 20,
    shiftY_MHz: 200 + i * 40, sigma_shiftX_MHz: .1, sigma_shiftY_MHz: .2, sigma_massU: .001 })) };
  const r = U.modifiedKingData(raw);
  near(r.points[0].x, 100 / (1 / 42 - 1 / 40), 1e-8);
  assert.ok(r.covariance[0][1] > 0 && r.covariance[0][3] > 0);
  const h = 1e-5;
  const high = U.modifiedKingData({ ...raw, referenceMassU: 40 + h });
  const low = U.modifiedKingData({ ...raw, referenceMassU: 40 - h });
  near(r.jacobian[0][9], (high.points[0].x - low.points[0].x) / (2 * h), 1e-4);
  assert.equal(U.modifiedKingData({ ...raw, sigma_referenceMassU: null }).covariance, null);
  assert.throws(() => U.modifiedKingData({ ...raw, referenceMassU: 42 }), error('KING_REFERENCE_POINT'));
});
test('King exact line matches analytic known-error Fisher covariance without residual rescaling', () => {
  const points = [0,1,2].map(x => ({ x, y: 1 + 2 * x, sx: .1, sy: .2 }));
  const r = U.kingFit({ points });
  near(r.slope, 2, 1e-7); near(r.intercept, 1, 1e-7); near(r.chi2, 0, 1e-10);
  near(r.sigma_slope ** 2, .08 / 2, 1e-8); near(r.sigma_intercept ** 2, .08 * 5 / 6, 1e-8);
  near(r.parameter_covariance[0][1], -.04, 1e-8); assert.equal(r.dof, 1);
});
test('independent isotropic errors recover analytic total least squares, differing from OLS', () => {
  const points = [[0,0],[1,2],[2,2],[3,5]].map(([x,y]) => ({ x,y,sx:.2,sy:.2 }));
  const mx=1.5,my=2.25, xx=5, xy=7.5, yy=12.75;
  const expected=(yy-xx+Math.sqrt((yy-xx)**2+4*xy*xy))/(2*xy);
  const r=U.kingFit({points}); near(r.slope,expected,1e-7); near(r.intercept,my-expected*mx,1e-7);
  assert.ok(Math.abs(r.slope-xy/xx)>.1);
});
test('full shared reference covariance preserves slope information and expands intercept uncertainty', () => {
  const points=[0,1,2,3].map(x=>({x,y:1+2*x,sx:.1,sy:.2})), independent=U.kingFit({points}), n=points.length;
  const c=diag([...Array(n).fill(.1),...Array(n).fill(.2)]);
  for(let i=0;i<n;i++) for(let j=0;j<n;j++){c[i][j]+=.09;c[n+i][n+j]+=.16;c[i][n+j]+=.06;c[n+i][j]+=.06;}
  const r=U.kingFit({points,covariance:c}); near(r.slope,2,1e-7);
  near(r.sigma_slope,independent.sigma_slope,1e-7);
  near(r.sigma_intercept**2-independent.sigma_intercept**2,.16+4*.09-4*.06,1e-7);
});
// Independent full 2N observation-space GLS with latent true x_i, avoiding the
// residual-covariance formula used in production. Gaussian elimination is test-only.
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);for(let k=0;k<b.length;k++){let m=k;for(let i=k+1;i<b.length;i++)if(Math.abs(a[i][k])>Math.abs(a[m][k]))m=i;[a[k],a[m]]=[a[m],a[k]];let v=a[k][k];for(let j=k;j<=b.length;j++)a[k][j]/=v;for(let i=0;i<b.length;i++)if(i!==k){v=a[i][k];for(let j=k;j<=b.length;j++)a[i][j]-=v*a[k][j];}}return a.map(r=>r[b.length]);}
function latentQ(points,c,b){const n=points.length, m=2*n,z=[...points.map(q=>q.x),...points.map(q=>q.y)], W=Array.from({length:m},(_,j)=>solve(c,Array.from({length:m},(_,i)=>+(i===j))));
 const design=Array.from({length:m},(_,i)=>Array.from({length:n+1},(_,j)=>i<n?+(i===j):j===n?1:j===i-n?b:0));
 const wd=design.map((_,i)=>Array.from({length:n+1},(_,j)=>W[i].reduce((s,v,k)=>s+v*design[k][j],0))), wz=W.map(r=>r.reduce((s,v,i)=>s+v*z[i],0));
 const normal=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>design.reduce((s,r,k)=>s+r[i]*wd[k][j],0))), rhs=Array.from({length:n+1},(_,i)=>design.reduce((s,r,k)=>s+r[i]*wz[k],0));
 const v=solve(normal,rhs),res=z.map((a,i)=>a-design[i].reduce((s,t,j)=>s+t*v[j],0));return res.reduce((s,t,i)=>s+t*W[i].reduce((u,v,j)=>u+v*res[j],0),0);}
test('correlated non-collinear fit agrees with independent latent-observation numerical minimization',()=>{
 const points=[[0,.1],[1,1.7],[2,4.3],[3,5.8]].map(([x,y])=>({x,y})),n=points.length,c=diag([.2,.1,.25,.15,.3,.35,.2,.25]);
 const v=[.1,.15,.12,.1,.2,.15,.1,.12];for(let i=0;i<2*n;i++)for(let j=0;j<2*n;j++)c[i][j]+=v[i]*v[j];
 let lo=1,hi=3; for(let k=0;k<75;k++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(latentQ(points,c,a)<latentQ(points,c,b))hi=b;else lo=a;}
 const r=U.kingFit({points,covariance:c});near(r.slope,(lo+hi)/2,2e-7);near(r.chi2,latentQ(points,c,r.slope),1e-9);
});
test('known x weighted fit remains supported but missing and singular errors fail closed',()=>{
 const points=[0,1,2].map(x=>({x,y:1+2*x,sx:0,sy:.2})); near(U.kingFit({points}).slope,2,1e-7);
 assert.throws(()=>U.kingFit({points:points.map(q=>({...q,sx:null}))}),error('MISSING_UNCERTAINTY'));
 assert.throws(()=>U.kingFit({points:points.map(q=>({...q,sy:0}))}),error('FIT_SINGULAR_COVARIANCE'));
});
