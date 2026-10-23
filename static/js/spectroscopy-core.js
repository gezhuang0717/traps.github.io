/* Pure input calculations for laser spectroscopy; no fitted atomic constants.
 * Radii are rms charge radii in fm; uncertainties are standard uncertainties.
 * Formula conventions and primary sources are recorded next to each calculation.
 */
(function (host) {
  'use strict';

  // 2022 CODATA: https://physics.nist.gov/cuu/Constants/Table/allascii.txt
  const U_ENERGY_EV = 931494103.72;

  function finite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(name + ' must be a finite number (blank values are invalid)');
    }
    return value;
  }

  function nonnegative(value, name) {
    finite(value, name);
    if (value < 0) throw new RangeError(name + ' must be nonnegative');
    return value;
  }

  function positive(value, name) {
    finite(value, name);
    if (value <= 0) throw new RangeError(name + ' must be positive');
    return value;
  }

  function object(value, name) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(name + ' must be an object');
    }
    return value;
  }

  function result(value, name) {
    if (!Number.isFinite(value)) throw new RangeError(name + ' is outside the finite numerical range');
    return value === 0 ? 0 : value;
  }

  function quantum(value, name) {
    nonnegative(value, name);
    if (!Number.isSafeInteger(2 * value)) {
      throw new RangeError(name + ' must be a nonnegative integer or half-integer');
    }
    return value;
  }

  // First-order propagation of r^2 - r_ref^2, including Cov(r, r_ref) in fm^2.
  // Independent-radius formula: https://patmlr.github.io/qspec/doc/functions/physics/delta_r2.html
  function radiusDifference(r, sigma, referenceR, referenceSigma, options = {}) {
    nonnegative(r, 'r (fm)');
    nonnegative(referenceR, 'referenceR (fm)');
    nonnegative(sigma, 'sigma (fm)');
    nonnegative(referenceSigma, 'referenceSigma (fm)');
    object(options, 'radius options');
    const { sameReference = false, covariance_fm2 = 0 } = options;
    if (typeof sameReference !== 'boolean') throw new TypeError('sameReference must be a boolean');
    finite(covariance_fm2, 'covariance_fm2');
    const bound = result(sigma * referenceSigma, 'uncertainty product');
    if (Math.abs(covariance_fm2) > bound * (1 + 8 * Number.EPSILON)) {
      throw new RangeError('|covariance_fm2| must not exceed sigma × referenceSigma');
    }
    if (sameReference) {
      if (r !== referenceR || sigma !== referenceSigma) {
        throw new RangeError('sameReference requires identical radius and uncertainty inputs');
      }
      return { delta_fm2: 0, sigma_fm2: 0 };
    }
    // Decimal covariance and sigma products may differ by a rounding unit at |rho|=1.
    const atBound = bound > 0 && Math.abs(Math.abs(covariance_fm2) - bound) <= 8 * Number.EPSILON * bound;
    const rho = bound === 0 ? 0 : atBound ? Math.sign(covariance_fm2) : Math.max(-1, Math.min(1, covariance_fm2 / bound));
    const a = result(2 * r * sigma, 'radius uncertainty');
    const b = result(2 * referenceR * referenceSigma, 'reference radius uncertainty');
    // This form avoids subtracting nearly equal positive variance contributions.
    const correlatedTerm = Math.sqrt(2 * (1 - rho)) * Math.sqrt(a) * Math.sqrt(b);
    return {
      delta_fm2: result(r === referenceR ? 0 : (r - referenceR) * (r + referenceR), 'radius difference'),
      sigma_fm2: result(Math.hypot(a - b, correlatedTerm), 'radius-difference uncertainty')
    };
  }

  // mu is expressed in nuclear magnetons: mu = g_I I mu_N.
  // This g_I is not the electron-Bohr-magneton convention used in some atomic tables.
  function nuclearG(mu, spin) {
    finite(mu, 'mu (nuclear magnetons)');
    quantum(spin, 'spin I');
    if (spin === 0) throw new RangeError('nuclear g factor is undefined for spin I = 0');
    return result(mu / spin, 'nuclear g factor');
  }

  // Ions start at rest; q is a positive integer charge state and V >= 0.
  // gamma = 1 + q V / (m_u c^2); laser frequency = nu_0/[gamma(1-beta cos alpha)].
  // https://patmlr.github.io/qspec/doc/functions/physics/v_el.html
  // https://patmlr.github.io/qspec/doc/functions/physics/doppler.html
  function doppler(parameters) {
    object(parameters, 'Doppler parameters');
    const { restTHz, massU, voltageV, charge, geometry } = parameters;
    positive(restTHz, 'restTHz');
    positive(massU, 'massU');
    nonnegative(voltageV, 'voltageV');
    positive(charge, 'charge');
    if (!Number.isSafeInteger(charge)) throw new RangeError('charge must be a positive integer charge state');
    if (geometry !== 'collinear' && geometry !== 'anticollinear') {
      throw new RangeError('geometry must be collinear or anticollinear');
    }
    const kineticRatio = result((voltageV / U_ENERGY_EV) * (charge / massU), 'kinetic-energy ratio');
    const gamma = result(1 + kineticRatio, 'Lorentz factor');
    // Retain tiny energies even when adding kineticRatio to 1 rounds to 1.
    const momentum = result(Math.sqrt(kineticRatio) * Math.sqrt(kineticRatio + 2), 'relativistic momentum');
    const factor = result(gamma + momentum, 'Doppler factor');
    return {
      beta: result(Math.min(1, momentum / gamma), 'beta'),
      // Reciprocal anticollinear factor avoids gamma - momentum cancellation.
      labTHz: result(geometry === 'collinear' ? restTHz * factor : restTHz / factor, 'labTHz')
    };
  }

  // Zero-field magnetic dipole + electric quadrupole energies relative to centroid.
  // Steck 87Rb D Line Data, Eq. (16): https://steck.us/alkalidata/rubidium87numbers.pdf
  function hyperfine(parameters) {
    object(parameters, 'hyperfine parameters');
    const { spin, J, A_MHz, B_MHz } = parameters;
    quantum(spin, 'spin I');
    quantum(J, 'J');
    finite(A_MHz, 'A_MHz');
    finite(B_MHz, 'B_MHz');
    if (B_MHz !== 0 && (spin < 1 || J < 1)) {
      throw new RangeError('nonzero B_MHz requires I >= 1 and J >= 1');
    }
    const count = 2 * Math.min(spin, J) + 1;
    if (count > 10001) throw new RangeError('hyperfine calculation supports at most 10001 levels');
    const minimum = Math.abs(spin - J);
    const maximum = spin + J;
    if (!Number.isSafeInteger(2 * maximum)) throw new RangeError('I + J is outside the supported quantum-number range');
    const levels = [];
    for (let i = 0; i < count; i += 1) {
      const F = minimum + i;
      // Factored differences reduce cancellation for I and J of unequal size.
      const large = Math.max(spin, J);
      const small = Math.min(spin, J);
      const K = (F - large) * (F + large + 1) - small * (small + 1);
      let energy = A_MHz * K / 2;
      if (B_MHz !== 0) {
        energy += B_MHz * (0.75 * K * (K + 1) - spin * (spin + 1) * J * (J + 1)) /
          (2 * spin * (2 * spin - 1) * J * (2 * J - 1));
      }
      levels.push({ F, energy_MHz: result(energy, 'hyperfine energy') });
    }
    return levels;
  }

  // Convention: delta nu = nu_isotope - nu_reference; delta r^2 = r_isotope^2 - r_reference^2.
  // delta nu = K (1/m_isotope - 1/m_reference) + F delta r^2.
  // K is signed for this convention; literature using the reverse mass factor needs -K.
  // K [GHz u], F [GHz/fm^2], supplied shift [MHz]. Leading-order model only.
  // Eq. (1), https://arxiv.org/abs/2404.13369 ; no higher-order nuclear moments.
  function radiusFromShift(parameters) {
    object(parameters, 'isotope-shift parameters');
    const { shiftMHz, K_GHz_u, F_GHz_fm2, massU, referenceMassU } = parameters;
    finite(shiftMHz, 'shiftMHz');
    finite(K_GHz_u, 'K_GHz_u');
    finite(F_GHz_fm2, 'F_GHz_fm2');
    positive(massU, 'massU');
    positive(referenceMassU, 'referenceMassU');
    if (F_GHz_fm2 === 0) throw new RangeError('F_GHz_fm2 must be nonzero to infer a radius difference');
    const inverseMassDifference = (referenceMassU - massU) / massU / referenceMassU;
    const massShiftMHz = result(K_GHz_u * inverseMassDifference * 1000, 'mass shift');
    return {
      delta_fm2: result(((shiftMHz - massShiftMHz) / 1000) / F_GHz_fm2, 'radius difference from isotope shift'),
      massShiftMHz
    };
  }

  // Unweighted OLS of user-supplied modified shifts. x is treated as exact.
  // No uncertainties, correlations, atomic constants or experimental inference are supplied.
  function kingFit(points) {
    if (!Array.isArray(points) || points.length < 3) throw new RangeError('King fit requires at least three points');
    points.forEach((point, i) => {
      object(point, 'point ' + (i + 1));
      finite(point.x, 'point ' + (i + 1) + ' x');
      finite(point.y, 'point ' + (i + 1) + ' y');
    });
    if (new Set(points.map(point => point.x)).size < 3) {
      throw new RangeError('King fit requires at least three distinct x values');
    }
    const n = points.length;
    const x0 = points[0].x;
    const y0 = points[0].y;
    const dx = points.map(point => result(point.x - x0, 'x range'));
    const dy = points.map(point => result(point.y - y0, 'y range'));
    const meanDx = dx.reduce((sum, value) => sum + value / n, 0);
    const meanDy = dy.reduce((sum, value) => sum + value / n, 0);
    const centeredX = dx.map(value => result(value - meanDx, 'centered x'));
    const centeredY = dy.map(value => result(value - meanDy, 'centered y'));
    const xScale = centeredX.reduce((scale, value) => Math.max(scale, Math.abs(value)), 0);
    const yScale = centeredY.reduce((scale, value) => Math.max(scale, Math.abs(value)), 0);
    let xx = 0, xy = 0, yy = 0;
    for (let i = 0; i < n; i += 1) {
      const x = centeredX[i] / xScale;
      const y = yScale === 0 ? 0 : centeredY[i] / yScale;
      xx += x * x;
      xy += x * y;
      yy += y * y;
    }
    const slope = result(yScale === 0 ? 0 : (xy / xx) * (yScale / xScale), 'King-fit slope');
    return {
      slope,
      intercept: result(y0 + meanDy - slope * (x0 + meanDx), 'King-fit intercept'),
      r2: yy === 0 ? 1 : Math.max(0, Math.min(1, (xy / xx) * (xy / yy))),
      n
    };
  }

  const api = Object.freeze({ radiusDifference, nuclearG, doppler, hyperfine, radiusFromShift, kingFit });
  host.TrapsSpectroscopy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
