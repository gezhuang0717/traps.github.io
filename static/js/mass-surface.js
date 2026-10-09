/* Ground-state mass surface in keV. Static, model and browser-local sources share identical stencils. */
(function(host){
  'use strict';
  const P=host.ZGPhysics || (typeof require==='function' ? require('./physics.js') : null);
  function create(getter, constants, beta=()=>null) {
    const comb=P.combine, memo=new Map();
  function derive(Z, N, s = "ame") {
    const k = s + ":" + (Z*1000+N); if (memo.has(k)) return memo.get(k);
    const {MEn,MEH,MEa}=constants; const get = getter(s), A = Z + N, m = get(Z, N);
    const BE = comb([Z, MEH], [N, MEn], [-1, m]);
    const out = {
      A, me: m, BE, BEA: BE && A > 0 ? comb([1/A,BE]) : null,
      sn: comb([1, get(Z, N - 1)], [1, MEn], [-1, m]), s2n: comb([1, get(Z, N - 2)], [2, MEn], [-1, m]),
      sp: comb([1, get(Z - 1, N)], [1, MEH], [-1, m]), s2p: comb([1, get(Z - 2, N)], [2, MEH], [-1, m]),
      qbm: comb([1, m], [-1, get(Z + 1, N - 1)]), qec: comb([1, m], [-1, get(Z - 1, N + 1)]), qa: comb([1, m], [-1, get(Z - 2, N - 2)], [-1, MEa]),
    };
    /* two-neutron shell gap δ2n = S2n(Z,N) − S2n(Z,N+2) */
    out.d2n = comb([1, get(Z, N - 2)], [-2, m], [1, get(Z, N + 2)]);   /* = ME(N−2) − 2·ME(N) + ME(N+2) */
    /* Mass-excess odd–even indicators; no absolute-value clamp. */
    out.d3n = P.pairingIndicator(get, Z, N, "N", 3);
    out.d3p = P.pairingIndicator(get, Z, N, "Z", 3);
    out.d5n = P.pairingIndicator(get, Z, N, "N", 5);
    out.d5p = P.pairingIndicator(get, Z, N, "Z", 5);
    out.d2p = comb([1, get(Z - 2, N)], [-2, m], [1, get(Z + 2, N)]);   /* δ2p = S2p(Z) − S2p(Z+2) */
    /* proton–neutron interaction δVpn (Zhang et al. 1989; Cakirli & Casten 2005) from binding energies B = Z·ME(¹H) + N·ME(n) − ME */
    const B = (z, n) => comb([z, MEH], [n, MEn], [-1, get(z, n)]);
    const ze = Z % 2 === 0, ne = N % 2 === 0;
    out.vpn = ze && ne ? comb([0.25, B(Z, N)], [-0.25, B(Z, N - 2)], [-0.25, B(Z - 2, N)], [0.25, B(Z - 2, N - 2)])
      : !ze && !ne ? comb([1, B(Z, N)], [-1, B(Z, N - 1)], [-1, B(Z - 1, N)], [1, B(Z - 1, N - 1)])
      : ze ? comb([0.5, B(Z, N)], [-0.5, B(Z, N - 1)], [-0.5, B(Z - 2, N)], [0.5, B(Z - 2, N - 1)])
      : comb([0.5, B(Z, N)], [-0.5, B(Z, N - 2)], [-0.5, B(Z - 1, N)], [0.5, B(Z - 1, N - 2)]);
    out.beta2 = beta(s,Z,N);   /* β2 × 1000 */
    /* Wigner-energy indicator (as in the Mulberry code): W = δVpn(N) − ½[δVpn(N+2) + δVpn(N−2)]; peaks at N = Z.
       Lazy getter: neighbours only need their δVpn, so there is no recursion chain. */
    let wig;
    Object.defineProperty(out, "wig", { get() {
      if (wig !== undefined) return wig;
      const vp = derive(Z, N + 2, s).vpn, vm = derive(Z, N - 2, s).vpn;
      return (wig = out.vpn && vp && vm ? comb([1, out.vpn], [-0.5, vp], [-0.5, vm]) : null);
    } });
    memo.set(k, out); return out;
  }

    return {derive, clear:()=>memo.clear()};
  }
  const quantities=['me','BE','BEA','sn','s2n','sp','s2p','qbm','qec','qa','d2n','d2p','d3n','d3p','d5n','d5p','vpn','wig'];
  function changes(centres,active,derive,affected){
    const masses=[...active.values()].filter(x=>!x.state.source_state_index),out=[];
    // Every current stencil lies within ΔZ=±2, ΔN=±4 (including Wigner neighbours).
    for(const r of centres){const [z,n]=r;if(!masses.some(m=>Math.abs(z-m.state.Z)<=2&&Math.abs(n-m.state.N)<=4))continue;
      const a=derive(z,n,'ame'),b=derive(z,n,'hybrid');
      for(const quantity of quantities){const value=b[quantity];if(!value||!affected(value))continue;const reference=a[quantity];out.push({r,quantity,unit:quantity==='BEA'?'keV/nucleon':'keV',before:reference,after:value,delta:reference?P.combine([1,value],[-1,reference]):null});}
    }return out;
  }
  // A finite source-table edge is not evidence of a separation-energy boundary.
  // Return the last positive sample only if its immediate neighbour brackets zero.
  function dripBoundary(samples){
    let last=null;
    for(const [index,value]of samples){
      if(Number.isInteger(index)&&Number.isFinite(value)&&value>0&&(last==null||index>last))last=index;
    }
    if(last==null)return null;
    const next=samples.find(([index])=>index===last+1);
    return next&&Number.isFinite(next[1])&&next[1]<=0?last:null;
  }
  const api={create,quantities,changes,dripBoundary};
  host.ZGMassSurface=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
