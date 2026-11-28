/* Published AME2020 and AME2026 evaluated values/uncertainties, in keV.
   Raw mass/reaction tables are distinct from browser-local and model stencils. */
(function(host){
  'use strict';
  function fromData(data){
    if(!data || !data.records || data.unit!=='keV')throw new Error('Invalid AME evaluated table');
    const edition=/AME2026/i.test(data.metadata?.name||data.source||'')?'AME2026':'AME2020';
    const direct=(z,n,q)=>{const entry=data.records[`${z},${n}`]?.values[q];
      return entry?{...entry,evaluation_edition:edition}:null;};
    const reverse=(z,n,q,dz,dn)=>{
      const t=direct(z+dz,n+dn,q);
      return t&&{...t,value:t.value==null?null:-t.value,derived_from:`reverse ${q} at Z=${z+dz},N=${n+dn}`};
    };
    function get(z,n,q){
      const tab=direct(z,n,q);if(tab)return tab;
      // Reversing the identical evaluated mass difference preserves its
      // uncertainty. Positron thresholds subtract fixed CODATA2018 constants;
      // shell holes and excited daughter energies are not included here.
      if(q==='qec')return reverse(z,n,'qbm',-1,1);
      if(['q2ec','qecbp','q2bp'].includes(q)){
        const t=reverse(z,n,'q2bm',-2,2);if(!t)return null;
        const c=host.ZGPhysics || (typeof require==='function'?require('./physics.js'):null);
        const electrons=q==='qecbp'?2:q==='q2bp'?4:0;
        return {...t,value:t.value==null?null:t.value-electrons*c.C.electronU*c.C.uKeV,
          derived_from:t.derived_from+(electrons?`; minus ${electrons} electron rest energies`:'')};
      }
      return null;
    }
    return {get,metadata:data.metadata,edition};
  }
  function apply(recomputed,tab){
    if(!tab || !Number.isFinite(tab.value))return null;
    // Retain mass identity terms for whole-stencil filters/provenance. They do
    // not represent the covariance of the published reaction uncertainty.
    const edition=tab.evaluation_edition||'AME2020';
    const value={...(recomputed||{}),v:tab.value,e:tab.uncertainty,
      est:!!tab.value_extrapolated,sigmaEst:!!tab.uncertainty_extrapolated,
      offset:(recomputed?.offset||0)+tab.value-(recomputed?.v||0),
      uncertainty_model:edition+' evaluated table; mass correlations retained',
      source:tab.derived_from?edition+' evaluated mass difference':edition+' published table',published:true,
      table_source:tab.source_file||tab.source||null,derived_from:tab.derived_from||null,
      recomputed_value:recomputed?.v??null,recomputed_uncertainty:recomputed?.e??null};
    return value;
  }
  const api={fromData,apply};host.ZGAMEEvaluated=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
