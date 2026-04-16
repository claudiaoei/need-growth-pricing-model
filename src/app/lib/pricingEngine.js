// Shared pricing engine — used by both the main app component and the Excel exporter.
// Data tables come from HLI 2026.04.07 pricing data request; infra costs from HLI vendor P&L Feb 2026.

// ═══════════════════════════════════════════════════════════════
// DATA TABLES
// ═══════════════════════════════════════════════════════════════
export const LAPSE_20YR = [0.1137,0.1285,0.1181,0.0911,0.0844,0.0717,0.0592,0.0327,0.0248,0.0187,0.0142,0.0107,0.0081,0.0061,0.0045,0.0033,0.0025,0.0018,0.0013,0.001,0.012,0.008,0.008,0.008,0.008,0.008,0.008,0.008,0.008,0.008];
export const LAPSE_30YR = [0.1137,0.1285,0.1181,0.0911,0.0844,0.0717,0.0592,0.0327,0.0248,0.0187,0.0142,0.0107,0.0081,0.0061,0.0045,0.0033,0.0025,0.0018,0.0013,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.0095,0.008];
export const MORT_M = [0.00176,0.00011,9e-05,8e-05,7e-05,5e-05,5e-05,4e-05,4e-05,5e-05,5e-05,6e-05,8e-05,0.0001,0.00012,0.00016,0.00019,0.00023,0.00026,0.00029,0.00032,0.00035,0.00037,0.00038,0.0004,0.00041,0.00042,0.00044,0.00045,0.00047,0.0005,0.00052,0.00055,0.00058,0.00062,0.00065,0.00069,0.00073,0.00077,0.00081,0.00085,0.0009,0.00096,0.00102,0.0011,0.00119,0.00128,0.00139,0.0015,0.00161,0.00174,0.00188,0.00202,0.00218,0.00235,0.00254,0.00274,0.00296,0.00321,0.00347,0.00377,0.00411,0.00449,0.00492,0.00541,0.00597,0.0066,0.00732,0.00813,0.00905,0.0101,0.01133,0.01279,0.01453,0.01656,0.01889,0.02148,0.0243,0.02752,0.03097,0.0344,0.03808,0.04213,0.04661,0.05156,0.05701,0.06302,0.06964,0.07694,0.08497,0.09379,0.10282,0.11221,0.12243,0.13352,0.14554,0.15857,0.17268,0.18794,0.20443,0.22221,0.24134,0.26192,0.28401,0.30765,0.33294,0.35989,0.38856,0.41895,0.45108,1,0,0];
export const MORT_F = [0.00149,0.0001,8e-05,6e-05,5e-05,4e-05,4e-05,3e-05,3e-05,3e-05,3e-05,4e-05,4e-05,5e-05,7e-05,9e-05,0.00011,0.00013,0.00016,0.00018,0.0002,0.00022,0.00023,0.00024,0.00024,0.00025,0.00025,0.00026,0.00028,0.0003,0.00032,0.00035,0.00037,0.00039,0.0004,0.00041,0.00043,0.00044,0.00046,0.00047,0.0005,0.00052,0.00055,0.00057,0.0006,0.00064,0.00067,0.00071,0.00076,0.00081,0.00087,0.00093,0.00098,0.00104,0.00109,0.00114,0.0012,0.00126,0.00133,0.00141,0.0015,0.00161,0.00175,0.00191,0.00211,0.00234,0.00261,0.00292,0.00326,0.00365,0.0041,0.00465,0.00532,0.00614,0.00713,0.00832,0.00973,0.01138,0.01331,0.01556,0.01798,0.02076,0.02397,0.02767,0.03193,0.03684,0.04248,0.04897,0.05642,0.06496,0.07475,0.08597,0.09877,0.11336,0.12997,0.14275,0.1557,0.16974,0.18495,0.20138,0.21912,0.23826,0.25886,0.281,0.30472,0.33014,0.35723,0.3861,0.41676,0.44919,0.48341,0.51938,1];
export const INC_M = [0.000571,0.000495,0.000425,0.000362,0.000309,0.000268,0.000239,0.000221,0.000213,0.000212,0.000217,0.000225,0.000236,0.00025,0.000266,0.000285,0.000307,0.000331,0.000357,0.000386,0.000419,0.00046,0.000511,0.000576,0.000655,0.000744,0.000838,0.000929,0.001014,0.001093,0.00117,0.001251,0.001342,0.001447,0.001565,0.001693,0.001827,0.001964,0.002103,0.002242,0.00238,0.002512,0.002633,0.002737,0.00283,0.002927,0.00305,0.003218,0.003446,0.003733,0.004068,0.004436,0.004826,0.005231,0.005654,0.006101,0.006573,0.007071,0.007597,0.008155,0.008756,0.009418,0.010158,0.01099,0.011918,0.012934,0.01403,0.015212,0.016487,0.017841,0.019231,0.020591,0.021852,0.022973,0.023973,0.024924,0.025932,0.027128,0.02858,0.030238,0.031948,0.033526,0.034813,0.03573,0.036296,0.036602,0.036757,0.036856,0.036941,0.037006,0.037033,0.03704,0.037043,0.037048,0.037054,0.037056,0.037057,0.037057,0.037057,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0,0,0];
export const INC_F = [0.000504,0.00043,0.000362,0.000305,0.000261,0.00023,0.000211,0.000201,0.0002,0.000205,0.000215,0.000231,0.00025,0.000274,0.000302,0.000338,0.000381,0.000435,0.000502,0.000583,0.000678,0.000787,0.000906,0.001036,0.001179,0.001336,0.001513,0.001718,0.001956,0.002226,0.002521,0.002827,0.003133,0.003431,0.003719,0.003994,0.004259,0.004514,0.004762,0.004998,0.00522,0.005427,0.005621,0.005803,0.00597,0.006116,0.006237,0.00633,0.006394,0.00643,0.006447,0.006455,0.006465,0.006478,0.006497,0.006521,0.006556,0.006601,0.006658,0.006729,0.00682,0.006936,0.007082,0.007261,0.007473,0.007718,0.007993,0.008291,0.008611,0.008959,0.009346,0.009784,0.010293,0.010888,0.011557,0.012261,0.012944,0.01356,0.014085,0.014519,0.014883,0.015199,0.015489,0.015763,0.016018,0.016247,0.016452,0.016637,0.016803,0.016951,0.01708,0.017193,0.017293,0.017381,0.017458,0.017524,0.01758,0.017629,0.017671,0.017708,0.017738,0.017764,0.017786,0.017804,0.01782,0.017832,0.017844,0.017856,0.017864,0.017869,0.017873,0.017879,0];
export const PH_M = {15:0.001025080298,16:0.0013212146063,17:0.001184537233,18:0.001685687601,19:0.0024146335907,20:0.0026196496503,21:0.0026652087747,22:0.0030524613317,23:0.0031663591426,24:0.0040547620675,25:0.004123100754,26:0.0043281168136,27:0.0053531971116,28:0.0045559124354,29:0.0043736759379,30:0.0048520467437,31:0.0048748263058,32:0.0050115036789,33:0.0054215357981,34:0.0050798423654,35:0.0050798423654,36:0.0046470306841,37:0.0047381489328,38:0.0046925898084,39:0.0052392993007,40:0.0055126540468,41:0.0046242511219,42:0.0063327182852,43:0.0070161051505,44:0.0077906102645,45:0.0073805781453,46:0.0082917606324,47:0.0081550832593,48:0.0082234219458,49:0.0089295883733,50:0.0089751474977,51:0.0101369051687,52:0.0100230073578,53:0.0120276088294,54:0.0126654365703,55:0.0122781840133,56:0.0118453723319,57:0.0129843504408,58:0.0110480876558,59:0.0111392059045,60:0.0117086949589,61:0.0111164263423,62:0.0099318891091,63:0.0109341898449,64:0.0103874803526,65:0.0106836146609,66:0.0091118248707,67:0.007995626324,68:0.0071300029613,69:0.0062188204743,70:0.0055582131711,71:0.004123100754,72:0.0033258160778,73:0.002961343083,74:0.0022551766555,75:0.0020046014716,76:0.0015262306658,77:0.0016173489146,78:0.0009567416114,79:0.0009111824871,80:0.0003416934327};
export const PH_F = {15:0.0007061664275,16:0.0013895532928,17:0.001184537233,18:0.0017312467254,19:0.001799585412,20:0.0032574773913,21:0.002961343083,22:0.0033030365156,23:0.0035080525752,24:0.004145880316,25:0.004510353311,26:0.0051937401763,27:0.0044875737488,28:0.0046925898084,29:0.0049431649924,30:0.0050115036789,31:0.0054215357981,32:0.0048292671815,33:0.0058087883551,34:0.0064693956582,35:0.0048520467437,36:0.0049659445545,37:0.0057632292307,38:0.0061960409121,39:0.0065832934691,40:0.0076311533292,41:0.0069705460261,42:0.0076311533292,43:0.00972687305,44:0.0127109956947,45:0.0112531037153,46:0.0138955329279,47:0.0119592701428,48:0.0124148613864,49:0.0131210278138,50:0.0136677373061,51:0.0147383767284,52:0.0169252146974,53:0.0183375475523,54:0.0194765256612,55:0.02009157384,56:0.0191120526663,57:0.0206382833322,58:0.0193626278503,59:0.0186109022985,60:0.0191576117907,61:0.0183375475523,62:0.0156267796533,63:0.0188159183581,64:0.0180641928062,65:0.0189070366068,66:0.0159684730859,67:0.0128704526299,68:0.0120276088294,69:0.0097040934873,70:0.0090662657464,71:0.0090662657464,72:0.0052620788628,73:0.0051937401763,74:0.004123100754,75:0.0032346978291,76:0.0033258160778,77:0.002460192715,78:0.002574090526,79:0.0017312467254,80:0.0007517255518};

// ═══════════════════════════════════════════════════════════════
// INFRASTRUCTURE BASE COSTS (HLI vendor P&L, Feb 2026)
// ═══════════════════════════════════════════════════════════════
export const INFRA_HX_PER_PH_MONTHLY = 0.04306539294945023;
export const INFRA_TX_PER_CASE = 76.05557698675499;
export const INFRA_RX_PER_CASE = 22.15703918322296;

// ═══════════════════════════════════════════════════════════════
// SCENARIO PRESETS
// ═══════════════════════════════════════════════════════════════
export const SCENARIOS = {
  "Base": {
    desc: "Base case from v69 Cost Scenarios: Halo efficiency 40% in yrs 2–4, Hx step-up 25% and Tx step-down 25% in yrs 2–7, infra step-up 20% in yrs 2–10.",
    hx: 1.027119529539755, tx: 625.7882010497684, halo: 562.5881058045244, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.40, haloYears: "2,3,4",
    infraStepUp: 0.20,
    hxStepUp: 0.25, hxStepYears: "2,3,4,5,6,7",
    txStepDown: 0.25, txStepYears: "2,3,4,5,6,7",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Bull": {
    desc: "Bull case from v69 Cost Scenarios: stronger Halo efficiency (50% in yrs 2–4), lighter Hx step-up (15%) and infra step-up (15%), Tx step-down 25% in yrs 2–7.",
    hx: 1.027119529539755, tx: 625.7882010497684, halo: 562.5881058045244, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.50, haloYears: "2,3,4",
    infraStepUp: 0.15,
    hxStepUp: 0.15, hxStepYears: "2,3,4,5,6,7",
    txStepDown: 0.25, txStepYears: "2,3,4,5,6,7",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Bear": {
    desc: "Bear case from v69 Cost Scenarios: weaker Halo efficiency (25% in yrs 2–4), heavier Hx step-up (30%) and infra step-up (30%) in yrs 2–10, Tx step-down 25% in yrs 2–7.",
    hx: 1.027119529539755, tx: 625.7882010497684, halo: 562.5881058045244, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.25, haloYears: "2,3,4",
    infraStepUp: 0.30,
    hxStepUp: 0.30, hxStepYears: "2,3,4,5,6,7",
    txStepDown: 0.25, txStepYears: "2,3,4,5,6,7",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Custom": {
    desc: "Start from scratch — fill in your own assumptions.",
    hx: 0, tx: 0, halo: 0, recoveryPct: 0,
    inflation: 0, discount: 0,
    haloEff: 0, haloYears: "",
    infraStepUp: 0,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
};

// ═══════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════
export function parseYears(s) {
  if (!s || !s.trim()) return new Set();
  return new Set(s.split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x)));
}

export function buildInfraCurves(params, nYears) {
  const { inflation, infraStepUp } = params;
  const hxInfra = [INFRA_HX_PER_PH_MONTHLY * 12];
  const txInfra = [INFRA_TX_PER_CASE];
  const rxInfra = [INFRA_RX_PER_CASE];
  for (let y = 2; y <= nYears; y++) {
    const rate = y <= 10 ? (inflation + infraStepUp) : inflation;
    hxInfra.push(hxInfra[y - 2] * (1 + rate));
    txInfra.push(txInfra[y - 2] * (1 + rate));
    rxInfra.push(rxInfra[y - 2] * (1 + rate));
  }
  return { hxInfra, txInfra, rxInfra };
}

export function buildCostCurves(params, nYears) {
  const { hx, tx, halo, recoveryPct, inflation, haloEff, haloYears: haloYearsStr,
          hxStepUp, hxStepYears: hxStepYearsStr,
          txStepDown, txStepYears: txStepYearsStr } = params;
  const haloYrs = parseYears(haloYearsStr);
  const hxStepYrs = parseYears(hxStepYearsStr);
  const txStepYrs = parseYears(txStepYearsStr);

  const hxCurve = [hx];
  const txCurve = [tx];
  const haloCurve = [halo];

  for (let y = 2; y <= nYears; y++) {
    const hxMult = hxStepYrs.has(y) ? (1 + hxStepUp) : 1;
    hxCurve.push(hxCurve[y - 2] * (1 + inflation) * hxMult);
    const txMult = txStepYrs.has(y) ? (1 - txStepDown) : 1;
    txCurve.push(txCurve[y - 2] * (1 + inflation) * txMult);
    const haloMult = haloYrs.has(y) ? (1 - haloEff) : 1;
    haloCurve.push(haloCurve[y - 2] * (1 + inflation) * haloMult);
  }
  const recoveryCurve = txCurve.map((t, i) => recoveryPct * (t + haloCurve[i]));
  const { hxInfra, txInfra, rxInfra } = buildInfraCurves(params, nYears);
  const totalHxCurve = hxCurve.map((v, i) => v + hxInfra[i]);
  const totalTxPerCase = txCurve.map((t, i) => t + haloCurve[i] + txInfra[i] + recoveryCurve[i] + rxInfra[i]);

  return { hxCurve, txCurve, haloCurve, recoveryCurve, hxInfra, txInfra, rxInfra, totalHxCurve, totalTxPerCase };
}

export function runCohort(age, gender, params, duration) {
  const nYears = duration;
  const lapse = duration <= 20 ? LAPSE_20YR : LAPSE_30YR;
  const mort = gender === "M" ? MORT_M : MORT_F;
  const inc = gender === "M" ? INC_M : INC_F;
  const curves = buildCostCurves(params, nYears);
  const { nxCost = 0 } = params;
  const years = [];
  let retention = 1;
  for (let y = 1; y <= nYears; y++) {
    const lapseRate = lapse[y - 1] || 0.008;
    const ageAtYear = age + y - 1;
    const mortRate = (ageAtYear < mort.length) ? mort[ageAtYear] : 0.1;
    const incRate = (ageAtYear < inc.length) ? inc[ageAtYear] : (gender === "M" ? 0.037 : 0.018);
    const attrition = Math.min(lapseRate + mortRate, 1);
    retention *= (1 - attrition);
    const hxAnnual = curves.totalHxCurve[y - 1];
    const txPerCase = curves.totalTxPerCase[y - 1];
    const nxAnnual = y === 1 ? nxCost : 0;
    years.push({ year: y, survival: retention, incRate, hxAnnual, txPerCase, nxAnnual });
  }
  return { years, curves };
}

export function solvePMPM(age, gender, params, duration, targetCM) {
  const { years } = runCohort(age, gender, params, duration);
  const { discount, caseFee: rawCaseFee = 0, caseFeeEnabled = false, caseFeeYear = 1, caseFeeTrigger = 0.0075 } = params;
  const caseFee = caseFeeEnabled ? rawCaseFee : 0;
  let npvCost = 0, npvPHYears = 0, npvCaseFee = 0;
  for (const yr of years) {
    const df = 1 / Math.pow(1 + discount, yr.year);
    const phs = yr.survival;
    npvCost += (phs * yr.hxAnnual + phs * yr.incRate * yr.txPerCase + yr.nxAnnual) * df;
    npvPHYears += phs * df;
    if (caseFee > 0 && yr.year >= caseFeeYear) {
      const excessInc = Math.max(yr.incRate - caseFeeTrigger, 0);
      const inflatedFee = caseFee * Math.pow(1 + (params.inflation || 0), yr.year - caseFeeYear);
      npvCaseFee += phs * excessInc * inflatedFee * df;
    }
  }
  if (npvPHYears === 0 || targetCM >= 1) return 0;
  return (npvCost / (1 - targetCM) - npvCaseFee) / npvPHYears / 12;
}

export function computeMarginProfile(age, gender, params, duration, pmpm) {
  const { years } = runCohort(age, gender, params, duration);
  const { discount } = params;
  const profile = [];
  let cumNPVMargin = 0;
  for (const yr of years) {
    const df = 1 / Math.pow(1 + discount, yr.year);
    const phs = yr.survival;
    const revenue = phs * pmpm * 12;
    const totalCost = phs * yr.hxAnnual + phs * yr.incRate * yr.txPerCase + yr.nxAnnual;
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    cumNPVMargin += margin * df;
    profile.push({ year: yr.year, revenue, totalCost, margin, marginPct: Math.round(marginPct * 10) / 10, cumNPVMargin, survival: Math.round(yr.survival * 10000) / 100 });
  }
  return profile;
}

// Blended PMPM across HLI PH-mix for a given (params, duration, targetCM)
export function computeBlended(params, duration, targetCM) {
  let tWM = 0, tWF = 0, wPmpmM = 0, wPmpmF = 0;
  for (let age = 15; age <= 80; age++) {
    const wM = PH_M[age] || 0, wF = PH_F[age] || 0;
    if (wM > 0) { wPmpmM += wM * solvePMPM(age, "M", params, duration, targetCM); tWM += wM; }
    if (wF > 0) { wPmpmF += wF * solvePMPM(age, "F", params, duration, targetCM); tWF += wF; }
  }
  const tot = tWM + tWF;
  return {
    blendedPMPM: (wPmpmM + wPmpmF) / tot,
    malePMPM: tWM > 0 ? wPmpmM / tWM : 0,
    femalePMPM: tWF > 0 ? wPmpmF / tWF : 0,
    maleWeight: tWM / tot,
    femaleWeight: tWF / tot,
  };
}

export function getBlendedStats() {
  let wAgeM = 0, wAgeF = 0, tWM = 0, tWF = 0;
  for (let a = 15; a <= 80; a++) {
    const wM = PH_M[a] || 0, wF = PH_F[a] || 0;
    wAgeM += a * wM; tWM += wM; wAgeF += a * wF; tWF += wF;
  }
  return {
    avgAge: ((wAgeM + wAgeF) / (tWM + tWF)).toFixed(1),
    avgAgeM: (wAgeM / tWM).toFixed(1),
    avgAgeF: (wAgeF / tWF).toFixed(1),
    femalePct: ((tWF / (tWM + tWF)) * 100).toFixed(1),
    malePct: ((tWM / (tWM + tWF)) * 100).toFixed(1),
  };
}
