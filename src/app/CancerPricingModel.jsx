"use client";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar } from "recharts";

// ═══════════════════════════════════════════════════════════════
// DATA TABLES (from HLI 2026.04.07 pricing data)
// ═══════════════════════════════════════════════════════════════
const LAPSE_20YR=[0.1137,0.1285,0.1181,0.0911,0.0844,0.0717,0.0592,0.0327,0.0248,0.0187,0.0142,0.0107,0.0081,0.0061,0.0045,0.0033,0.0025,0.0018,0.0013,0.001,0.012,0.008,0.008,0.008,0.008,0.008,0.008,0.008,0.008,0.008];
const LAPSE_30YR=[0.1137,0.1285,0.1181,0.0911,0.0844,0.0717,0.0592,0.0327,0.0248,0.0187,0.0142,0.0107,0.0081,0.0061,0.0045,0.0033,0.0025,0.0018,0.0013,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.001,0.0095,0.008];
const MORT_M=[0.00176,0.00011,9e-05,8e-05,7e-05,5e-05,5e-05,4e-05,4e-05,5e-05,5e-05,6e-05,8e-05,0.0001,0.00012,0.00016,0.00019,0.00023,0.00026,0.00029,0.00032,0.00035,0.00037,0.00038,0.0004,0.00041,0.00042,0.00044,0.00045,0.00047,0.0005,0.00052,0.00055,0.00058,0.00062,0.00065,0.00069,0.00073,0.00077,0.00081,0.00085,0.0009,0.00096,0.00102,0.0011,0.00119,0.00128,0.00139,0.0015,0.00161,0.00174,0.00188,0.00202,0.00218,0.00235,0.00254,0.00274,0.00296,0.00321,0.00347,0.00377,0.00411,0.00449,0.00492,0.00541,0.00597,0.0066,0.00732,0.00813,0.00905,0.0101,0.01133,0.01279,0.01453,0.01656,0.01889,0.02148,0.0243,0.02752,0.03097,0.0344,0.03808,0.04213,0.04661,0.05156,0.05701,0.06302,0.06964,0.07694,0.08497,0.09379,0.10282,0.11221,0.12243,0.13352,0.14554,0.15857,0.17268,0.18794,0.20443,0.22221,0.24134,0.26192,0.28401,0.30765,0.33294,0.35989,0.38856,0.41895,0.45108,1,0,0];
const MORT_F=[0.00149,0.0001,8e-05,6e-05,5e-05,4e-05,4e-05,3e-05,3e-05,3e-05,3e-05,4e-05,4e-05,5e-05,7e-05,9e-05,0.00011,0.00013,0.00016,0.00018,0.0002,0.00022,0.00023,0.00024,0.00024,0.00025,0.00025,0.00026,0.00028,0.0003,0.00032,0.00035,0.00037,0.00039,0.0004,0.00041,0.00043,0.00044,0.00046,0.00047,0.0005,0.00052,0.00055,0.00057,0.0006,0.00064,0.00067,0.00071,0.00076,0.00081,0.00087,0.00093,0.00098,0.00104,0.00109,0.00114,0.0012,0.00126,0.00133,0.00141,0.0015,0.00161,0.00175,0.00191,0.00211,0.00234,0.00261,0.00292,0.00326,0.00365,0.0041,0.00465,0.00532,0.00614,0.00713,0.00832,0.00973,0.01138,0.01331,0.01556,0.01798,0.02076,0.02397,0.02767,0.03193,0.03684,0.04248,0.04897,0.05642,0.06496,0.07475,0.08597,0.09877,0.11336,0.12997,0.14275,0.1557,0.16974,0.18495,0.20138,0.21912,0.23826,0.25886,0.281,0.30472,0.33014,0.35723,0.3861,0.41676,0.44919,0.48341,0.51938,1];
const INC_M=[0.000571,0.000495,0.000425,0.000362,0.000309,0.000268,0.000239,0.000221,0.000213,0.000212,0.000217,0.000225,0.000236,0.00025,0.000266,0.000285,0.000307,0.000331,0.000357,0.000386,0.000419,0.00046,0.000511,0.000576,0.000655,0.000744,0.000838,0.000929,0.001014,0.001093,0.00117,0.001251,0.001342,0.001447,0.001565,0.001693,0.001827,0.001964,0.002103,0.002242,0.00238,0.002512,0.002633,0.002737,0.00283,0.002927,0.00305,0.003218,0.003446,0.003733,0.004068,0.004436,0.004826,0.005231,0.005654,0.006101,0.006573,0.007071,0.007597,0.008155,0.008756,0.009418,0.010158,0.01099,0.011918,0.012934,0.01403,0.015212,0.016487,0.017841,0.019231,0.020591,0.021852,0.022973,0.023973,0.024924,0.025932,0.027128,0.02858,0.030238,0.031948,0.033526,0.034813,0.03573,0.036296,0.036602,0.036757,0.036856,0.036941,0.037006,0.037033,0.03704,0.037043,0.037048,0.037054,0.037056,0.037057,0.037057,0.037057,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0.037058,0,0,0];
const INC_F=[0.000504,0.00043,0.000362,0.000305,0.000261,0.00023,0.000211,0.000201,0.0002,0.000205,0.000215,0.000231,0.00025,0.000274,0.000302,0.000338,0.000381,0.000435,0.000502,0.000583,0.000678,0.000787,0.000906,0.001036,0.001179,0.001336,0.001513,0.001718,0.001956,0.002226,0.002521,0.002827,0.003133,0.003431,0.003719,0.003994,0.004259,0.004514,0.004762,0.004998,0.00522,0.005427,0.005621,0.005803,0.00597,0.006116,0.006237,0.00633,0.006394,0.00643,0.006447,0.006455,0.006465,0.006478,0.006497,0.006521,0.006556,0.006601,0.006658,0.006729,0.00682,0.006936,0.007082,0.007261,0.007473,0.007718,0.007993,0.008291,0.008611,0.008959,0.009346,0.009784,0.010293,0.010888,0.011557,0.012261,0.012944,0.01356,0.014085,0.014519,0.014883,0.015199,0.015489,0.015763,0.016018,0.016247,0.016452,0.016637,0.016803,0.016951,0.01708,0.017193,0.017293,0.017381,0.017458,0.017524,0.01758,0.017629,0.017671,0.017708,0.017738,0.017764,0.017786,0.017804,0.01782,0.017832,0.017844,0.017856,0.017864,0.017869,0.017873,0.017879,0];
const PH_M={15:0.001025080298,16:0.0013212146063,17:0.001184537233,18:0.001685687601,19:0.0024146335907,20:0.0026196496503,21:0.0026652087747,22:0.0030524613317,23:0.0031663591426,24:0.0040547620675,25:0.004123100754,26:0.0043281168136,27:0.0053531971116,28:0.0045559124354,29:0.0043736759379,30:0.0048520467437,31:0.0048748263058,32:0.0050115036789,33:0.0054215357981,34:0.0050798423654,35:0.0050798423654,36:0.0046470306841,37:0.0047381489328,38:0.0046925898084,39:0.0052392993007,40:0.0055126540468,41:0.0046242511219,42:0.0063327182852,43:0.0070161051505,44:0.0077906102645,45:0.0073805781453,46:0.0082917606324,47:0.0081550832593,48:0.0082234219458,49:0.0089295883733,50:0.0089751474977,51:0.0101369051687,52:0.0100230073578,53:0.0120276088294,54:0.0126654365703,55:0.0122781840133,56:0.0118453723319,57:0.0129843504408,58:0.0110480876558,59:0.0111392059045,60:0.0117086949589,61:0.0111164263423,62:0.0099318891091,63:0.0109341898449,64:0.0103874803526,65:0.0106836146609,66:0.0091118248707,67:0.007995626324,68:0.0071300029613,69:0.0062188204743,70:0.0055582131711,71:0.004123100754,72:0.0033258160778,73:0.002961343083,74:0.0022551766555,75:0.0020046014716,76:0.0015262306658,77:0.0016173489146,78:0.0009567416114,79:0.0009111824871,80:0.0003416934327};
const PH_F={15:0.0007061664275,16:0.0013895532928,17:0.001184537233,18:0.0017312467254,19:0.001799585412,20:0.0032574773913,21:0.002961343083,22:0.0033030365156,23:0.0035080525752,24:0.004145880316,25:0.004510353311,26:0.0051937401763,27:0.0044875737488,28:0.0046925898084,29:0.0049431649924,30:0.0050115036789,31:0.0054215357981,32:0.0048292671815,33:0.0058087883551,34:0.0064693956582,35:0.0048520467437,36:0.0049659445545,37:0.0057632292307,38:0.0061960409121,39:0.0065832934691,40:0.0076311533292,41:0.0069705460261,42:0.0076311533292,43:0.00972687305,44:0.0127109956947,45:0.0112531037153,46:0.0138955329279,47:0.0119592701428,48:0.0124148613864,49:0.0131210278138,50:0.0136677373061,51:0.0147383767284,52:0.0169252146974,53:0.0183375475523,54:0.0194765256612,55:0.02009157384,56:0.0191120526663,57:0.0206382833322,58:0.0193626278503,59:0.0186109022985,60:0.0191576117907,61:0.0183375475523,62:0.0156267796533,63:0.0188159183581,64:0.0180641928062,65:0.0189070366068,66:0.0159684730859,67:0.0128704526299,68:0.0120276088294,69:0.0097040934873,70:0.0090662657464,71:0.0090662657464,72:0.0052620788628,73:0.0051937401763,74:0.004123100754,75:0.0032346978291,76:0.0033258160778,77:0.002460192715,78:0.002574090526,79:0.0017312467254,80:0.0007517255518};

// ═══════════════════════════════════════════════════════════════
// INFRASTRUCTURE BASE COSTS (from HLI vendor P&L, Feb 2026)
// Derived from SUMPRODUCT of vendor costs × mode splits / active PHs or cases
// ═══════════════════════════════════════════════════════════════
const INFRA_HX_PER_PH_MONTHLY = 0.04306539294945023;  // $/PH/month (from R101)
const INFRA_TX_PER_CASE = 76.05557698675499;           // $/case (from S101)
const INFRA_RX_PER_CASE = 22.15703918322296;           // $/case (from T101)

// ═══════════════════════════════════════════════════════════════
// SCENARIO PRESETS
// ═══════════════════════════════════════════════════════════════
const SCENARIOS = {
  "Base – July 2025": {
    desc: "Original baseline from July 2025 pricing engagement.",
    hx: 0.41, tx: 217, halo: 658, recoveryPct: 0.5,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.08, haloYears: "3,4,5,6,7",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Base – April 2026": {
    desc: "Updated baseline linked to actual COGS as of April 2026. Lower Recovery utilization (10%) based on observed data.",
    hx: 0.467, tx: 393.33, halo: 562.59, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.08, haloYears: "3,4,5,6,7",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "AI Acceleration": {
    desc: "AI advances reduce Treatment costs 10%/yr in years 2–7 and double Halo efficiency to 20%, starting in year 2.",
    hx: 0.467, tx: 393.33, halo: 562.59, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.20, haloYears: "2,3,4,5,6,7",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0.10, txStepYears: "2,3,4,5,6,7",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Healthy Mode Investment": {
    desc: "Increased investment in cancer prevention — Healthy Mode costs grow 15% above inflation in years 2–5, then stabilizes.",
    hx: 0.467, tx: 393.33, halo: 562.59, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.08, haloYears: "3,4,5,6,7",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0.15, hxStepYears: "2,3,4,5",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Infra Costs Up": {
    desc: "Rising compute and cloud costs — 10% infrastructure step-up in years 2–10 on top of standard inflation.",
    hx: 0.467, tx: 393.33, halo: 562.59, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.08, haloYears: "3,4,5,6,7",
    infraStepUp: 0.10, infraContractYears: 5,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Conservative Headwinds": {
    desc: "Hx +10% yrs 2–5, Tx step-down 8% yrs 3–7, 10% Halo efficiency. Infrastructure at inflation only.",
    hx: 0.467, tx: 393.33, halo: 562.59, recoveryPct: 0.1,
    inflation: 0.05, discount: 0.05,
    haloEff: 0.10, haloYears: "3,4,5,6,7",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0.10, hxStepYears: "2,3,4,5",
    txStepDown: 0.08, txStepYears: "3,4,5,6,7",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
  "Custom": {
    desc: "Start from scratch — fill in your own assumptions.",
    hx: 0, tx: 0, halo: 0, recoveryPct: 0,
    inflation: 0, discount: 0,
    haloEff: 0, haloYears: "",
    infraStepUp: 0, infraContractYears: 5,
    hxStepUp: 0, hxStepYears: "",
    txStepDown: 0, txStepYears: "",
    nxCost: 0, caseFee: 0, caseFeeEnabled: false, caseFeeYear: 1, caseFeeTrigger: 0.0075,
  },
};

// ═══════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════
function parseYears(s) {
  if (!s || !s.trim()) return new Set();
  return new Set(s.split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x)));
}

// Build per-year infrastructure cost curves (Hx infra, Tx infra, Rx infra)
// Matches Excel Control Center: compound at (infraStepUp + inflation) for years 1-N
// (where N = infraContractYears, typically 5), then just inflation after.
function buildInfraCurves(params, nYears) {
  const { inflation, infraStepUp, infraContractYears = 5 } = params;
  const hxInfra = [INFRA_HX_PER_PH_MONTHLY * 12]; // annualize
  const txInfra = [INFRA_TX_PER_CASE];
  const rxInfra = [INFRA_RX_PER_CASE];
  for (let y = 2; y <= nYears; y++) {
    const rate = y <= infraContractYears ? (infraStepUp + inflation) : inflation;
    hxInfra.push(hxInfra[y - 2] * (1 + rate));
    txInfra.push(txInfra[y - 2] * (1 + rate));
    rxInfra.push(rxInfra[y - 2] * (1 + rate));
  }
  return { hxInfra, txInfra, rxInfra };
}

function buildCostCurves(params, nYears) {
  const { hx, tx, halo, recoveryPct, inflation, haloEff, haloYears: haloYearsStr,
          hxStepUp, hxStepYears: hxStepYearsStr,
          txStepDown, txStepYears: txStepYearsStr } = params;
  const haloYrs = parseYears(haloYearsStr);
  const hxStepYrs = parseYears(hxStepYearsStr);
  const txStepYrs = parseYears(txStepYearsStr);

  // Service-level cost curves (from Cost Scenarios — no infra)
  // hx is monthly cost per PH; annualize to match Excel (×12)
  const hxCurve = [hx * 12];
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

  // Infrastructure curves
  const { hxInfra, txInfra, rxInfra } = buildInfraCurves(params, nYears);

  // Total cost per PH = service + infra (matching Excel Control Center rows 63, 72)
  const totalHxCurve = hxCurve.map((v, i) => v + hxInfra[i]);
  const totalTxPerCase = txCurve.map((t, i) => t + haloCurve[i] + txInfra[i] + recoveryCurve[i] + rxInfra[i]);

  return { hxCurve, txCurve, haloCurve, recoveryCurve, hxInfra, txInfra, rxInfra, totalHxCurve, totalTxPerCase };
}

function runCohort(age, gender, params, duration) {
  const nYears = duration;
  const lapse = duration === 20 ? LAPSE_20YR : LAPSE_30YR;
  const mort = gender === "M" ? MORT_M : MORT_F;
  const inc = gender === "M" ? INC_M : INC_F;
  const curves = buildCostCurves(params, nYears);
  const { nxCost = 0, inflation } = params;
  const years = [];
  let retention = 1;
  for (let y = 1; y <= nYears; y++) {
    const lapseRate = lapse[y - 1] || 0.008;
    const ageAtYear = age + y - 1;  // age 40 in year 1 = index 40, year 2 = index 41, etc.
    const mortRate = (ageAtYear < mort.length) ? mort[ageAtYear] : 0.1;
    const incRate = (ageAtYear < inc.length) ? inc[ageAtYear] : (gender === "M" ? 0.037 : 0.018);
    // Additive attrition: matches Excel Retention rate sheet (lapse + mort, capped at 1)
    const attrition = Math.min(lapseRate + mortRate, 1);
    retention *= (1 - attrition);
    const hxAnnual = curves.totalHxCurve[y - 1];
    const txPerCase = curves.totalTxPerCase[y - 1];
    // Nx cost only in year 1 (per-new-PH onboarding, inflated from base)
    const nxAnnual = y === 1 ? nxCost : 0;
    years.push({ year: y, survival: retention, incRate, hxAnnual, txPerCase, nxAnnual });
  }
  return { years, curves };
}

function solvePMPM(age, gender, params, duration, targetCM) {
  const { years } = runCohort(age, gender, params, duration);
  const { discount, caseFee: rawCaseFee = 0, caseFeeEnabled = false, caseFeeYear = 1, caseFeeTrigger = 0.0075 } = params;
  const caseFee = caseFeeEnabled ? rawCaseFee : 0;
  let npvCost = 0, npvPHYears = 0, npvCaseFee = 0;
  for (const yr of years) {
    const df = 1 / Math.pow(1 + discount, yr.year);
    const phs = yr.survival;
    // Total cost per PH in this year: Hx + incidence × Tx + Nx
    npvCost += (phs * yr.hxAnnual + phs * yr.incRate * yr.txPerCase + yr.nxAnnual) * df;
    npvPHYears += phs * df;
    // Case fee revenue: triggered when incidence exceeds threshold, only after kick-in year
    if (caseFee > 0 && yr.year >= caseFeeYear) {
      const excessInc = Math.max(yr.incRate - caseFeeTrigger, 0);
      const inflatedFee = caseFee * Math.pow(1 + (params.inflation || 0), yr.year - caseFeeYear);
      npvCaseFee += phs * excessInc * inflatedFee * df;
    }
  }
  if (npvPHYears === 0 || targetCM >= 1) return 0;
  // PMPM = (NPV_cost / (1-CM) - NPV_casefee) / NPV_PH_years / 12
  return (npvCost / (1 - targetCM) - npvCaseFee) / npvPHYears / 12;
}

function computeMarginProfile(age, gender, params, duration, pmpm) {
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

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
const fmt = (v, d = 2) => v == null || isNaN(v) ? "-" : "$" + v.toFixed(d);
const fmtK = (v) => Math.abs(v) >= 1e6 ? "$" + (v/1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? "$" + (v/1e3).toFixed(0) + "K" : "$" + v.toFixed(0);
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";

function NumInput({ label, value, onChange, step, unit }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" value={Math.round(value * 100) / 100} onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={step || 0.01}
          className="w-24 px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors" />
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

function TxtInput({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. 2,3,4,5"
        className="w-full px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors" />
    </label>
  );
}

// Section wrapper
function Section({ id, children, dark }) {
  return (
    <section id={id} className={`min-h-screen px-6 py-16 md:px-12 lg:px-20 ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

function SectionTitle({ label, title, subtitle }) {
  return (
    <div className="mb-10">
      <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">{label}</div>
      <h2 className="text-3xl font-bold tracking-tight mb-2">{title}</h2>
      {subtitle && <p className="text-base text-slate-400 max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// Blended demographics
function getBlendedStats() {
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

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const SECTIONS = ["model", "assumptions", "data", "pricing", "margin", "howitworks"];
const SECTION_LABELS = ["The Model", "Assumptions", "The Data", "Pricing", "Margin", "How It Works"];

export default function CancerPricingModel() {
  const [scenario, setScenario] = useState("Base – April 2026");
  const [modified, setModified] = useState(false);
  const [duration, setDuration] = useState(30);
  const [targetCM, setTargetCM] = useState(0.70);
  const [cohortSize, setCohortSize] = useState(100000);
  const [activeSection, setActiveSection] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [costCurveView, setCostCurveView] = useState("chart");
  const [costPopup, setCostPopup] = useState(null); // { year, field, lines, x, y }
  const [params, setParams] = useState({ ...SCENARIOS["Base – April 2026"] });
  const sectionRefs = useRef([]);

  const updateParam = useCallback((key, val) => { setParams(p => ({ ...p, [key]: val })); setModified(true); }, []);
  const selectScenario = useCallback((name) => { setScenario(name); setParams({ ...SCENARIOS[name] }); setModified(false); }, []);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
      const offsets = sectionRefs.current.map(el => el ? el.getBoundingClientRect().top : 9999);
      const idx = offsets.findIndex((t, i) => i < offsets.length - 1 && t <= 200 && offsets[i + 1] > 200);
      if (idx >= 0) setActiveSection(idx);
      else if (offsets[offsets.length - 1] <= 200) setActiveSection(offsets.length - 1);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (idx) => sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });

  // ── Computations ──
  const costCurveData = useMemo(() => {
    const c = buildCostCurves(params, duration);
    const haloYrs = parseYears(params.haloYears);
    const hxStepYrs = parseYears(params.hxStepYears);
    const txStepYrs = parseYears(params.txStepYears);
    const inf = params.inflation;
    return Array.from({ length: duration }, (_, i) => {
      const y = i + 1;
      // Build explanations for each cost component
      const healthyParts = [];
      healthyParts.push(`Base: $${(params.hx * 12).toFixed(2)}/yr (${params.hx} $/mo × 12)`);
      if (y > 1) healthyParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      if (y > 1 && params.hxStepUp > 0) {
        const activeYrs = Array.from(hxStepYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) healthyParts.push(`Hx step-up: +${(params.hxStepUp * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }
      healthyParts.push(`Infra: $${c.hxInfra[i].toFixed(2)} (base $${(INFRA_HX_PER_PH_MONTHLY * 12).toFixed(2)}${params.infraStepUp > 0 ? ` + ${(params.infraStepUp * 100).toFixed(0)}% step-up` : ""} + inflation)`);
      healthyParts.push(`Total: $${c.totalHxCurve[i].toFixed(2)}`);

      const txParts = [];
      txParts.push(`Base: $${params.tx.toFixed(2)}/case`);
      if (y > 1) txParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      if (y > 1 && params.txStepDown > 0) {
        const activeYrs = Array.from(txStepYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) txParts.push(`Tx step-down: -${(params.txStepDown * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }

      const haloParts = [];
      haloParts.push(`Base: $${params.halo.toFixed(2)}/case`);
      if (y > 1) haloParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      if (y > 1 && params.haloEff > 0) {
        const activeYrs = Array.from(haloYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) haloParts.push(`Halo efficiency: -${(params.haloEff * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }

      const recParts = [];
      recParts.push(`Recovery % = ${(params.recoveryPct * 100).toFixed(0)}%`);
      recParts.push(`= ${(params.recoveryPct * 100).toFixed(0)}% × (Tx $${c.txCurve[i].toFixed(2)} + Halo $${c.haloCurve[i].toFixed(2)})`);

      return {
        year: y, healthy: c.totalHxCurve[i], treatment: c.txCurve[i], halo: c.haloCurve[i], recovery: c.recoveryCurve[i],
        hxInfra: c.hxInfra[i], txInfra: c.txInfra[i], rxInfra: c.rxInfra[i],
        explain: { healthy: healthyParts, treatment: txParts, halo: haloParts, recovery: recParts },
      };
    });
  }, [params, duration]);

  const pricingTable = useMemo(() => {
    const rows = [];
    for (let age = 15; age <= 80; age++) {
      rows.push({ age, male: solvePMPM(age, "M", params, duration, targetCM), female: solvePMPM(age, "F", params, duration, targetCM) });
    }
    return rows;
  }, [params, duration, targetCM]);

  const blended = useMemo(() => {
    let tWM = 0, tWF = 0, wPmpmM = 0, wPmpmF = 0;
    for (let age = 15; age <= 80; age++) {
      const wM = PH_M[age] || 0, wF = PH_F[age] || 0;
      if (wM > 0) { wPmpmM += wM * solvePMPM(age, "M", params, duration, targetCM); tWM += wM; }
      if (wF > 0) { wPmpmF += wF * solvePMPM(age, "F", params, duration, targetCM); tWF += wF; }
    }
    const tot = tWM + tWF;
    return { blendedPMPM: (wPmpmM + wPmpmF) / tot, malePMPM: wPmpmM / tWM, femalePMPM: wPmpmF / tWF, maleWeight: tWM / tot, femaleWeight: tWF / tot };
  }, [params, duration, targetCM]);

  const blendedMarginProfile = useMemo(() => {
    // Each age/gender gets its OWN solved PMPM (matching Excel CM calc sheet)
    const profiles = [];
    for (let age = 15; age <= 80; age++) {
      const wM = PH_M[age] || 0, wF = PH_F[age] || 0;
      if (wM > 0) { const pmpm = solvePMPM(age, "M", params, duration, targetCM); profiles.push({ w: wM, p: computeMarginProfile(age, "M", params, duration, pmpm) }); }
      if (wF > 0) { const pmpm = solvePMPM(age, "F", params, duration, targetCM); profiles.push({ w: wF, p: computeMarginProfile(age, "F", params, duration, pmpm) }); }
    }
    const totalW = profiles.reduce((s, x) => s + x.w, 0);
    return Array.from({ length: duration }, (_, y) => {
      let wRev = 0, wCost = 0, wMargin = 0, wCumNPV = 0, wSurv = 0, wMarginPct = 0;
      for (const { w, p } of profiles) {
        if (p[y]) {
          const nw = w / totalW;
          wRev += p[y].revenue * nw; wCost += p[y].totalCost * nw; wMargin += p[y].margin * nw;
          wCumNPV += p[y].cumNPVMargin * nw; wSurv += p[y].survival * nw;
          // Match Excel: blended CM% = PH-mix weighted average of per-age spot CM%
          wMarginPct += p[y].marginPct * nw;
        }
      }
      return { year: y + 1, revenue: wRev * cohortSize, totalCost: wCost * cohortSize, margin: wMargin * cohortSize, marginPct: Math.round(wMarginPct * 10) / 10, cumNPVMargin: wCumNPV * cohortSize, survival: Math.round(wSurv * 100) / 100 };
    });
  }, [params, duration, targetCM, cohortSize]);

  // Data for section 2 charts
  const incidenceData = useMemo(() => Array.from({ length: 66 }, (_, i) => ({ age: 15 + i, male: INC_M[15 + i] * 1000, female: INC_F[15 + i] * 1000 })), []);
  const lapseData = useMemo(() => LAPSE_30YR.map((v, i) => ({ year: i + 1, "30yr": v * 100, "20yr": (LAPSE_20YR[i] || 0) * 100 })), []);
  const mortalityData = useMemo(() => Array.from({ length: 66 }, (_, i) => ({ age: 15 + i, male: MORT_M[15 + i] * 1000, female: MORT_F[15 + i] * 1000 })), []);

  // ── How It Works: blended HLI book walkthrough ──
  const traceData = useMemo(() => {
    const nYears = duration;
    const curves = buildCostCurves(params, nYears);
    const { hxCurve, txCurve, haloCurve, recoveryCurve, hxInfra, txInfra, rxInfra, totalHxCurve, totalTxPerCase } = curves;
    const { discount } = params;

    // Step 1: cost curves for first 5 years (scenario-level, same for all ages)
    const step1 = [];
    for (let y = 0; y < Math.min(5, nYears); y++) {
      step1.push({
        year: y + 1,
        hxService: hxCurve[y], hxInfra: hxInfra[y], totalHx: totalHxCurve[y],
        tx: txCurve[y], halo: haloCurve[y], txInfraVal: txInfra[y],
        totalTx: txCurve[y] + haloCurve[y] + txInfra[y],
        recovery: recoveryCurve[y], rxInfraVal: rxInfra[y],
        totalRx: recoveryCurve[y] + rxInfra[y],
      });
    }

    // Step 2 & 3: blended cohort projection weighted by HLI PH mix
    // Run per-age/gender cohorts, solve per-age PMPMs, then blend
    const perAgeResults = [];
    for (let age = 15; age <= 80; age++) {
      for (const gender of ["M", "F"]) {
        const w = gender === "M" ? (PH_M[age] || 0) : (PH_F[age] || 0);
        if (w === 0) continue;
        const { years } = runCohort(age, gender, params, duration);
        const pmpm = solvePMPM(age, gender, params, duration, targetCM);
        perAgeResults.push({ age, gender, w, years, pmpm });
      }
    }
    const totalW = perAgeResults.reduce((s, x) => s + x.w, 0);

    // Blended cohort projection
    const step2 = [];
    let blNpvCost = 0, blNpvPH = 0;
    for (let y = 1; y <= nYears; y++) {
      let wRetention = 0, wIncRate = 0, wYearCost = 0, wNpvCost = 0, wNpvPH = 0;
      const df = 1 / Math.pow(1 + discount, y);
      const lapseRate = (duration === 20 ? LAPSE_20YR : LAPSE_30YR)[y - 1] || 0.008;
      for (const { w, years } of perAgeResults) {
        const nw = w / totalW;
        const yr = years[y - 1];
        wRetention += yr.survival * nw;
        wIncRate += yr.incRate * nw;
        const yrCost = yr.survival * yr.hxAnnual + yr.survival * yr.incRate * yr.txPerCase + yr.nxAnnual;
        wYearCost += yrCost * nw;
        wNpvCost += yrCost * df * nw;
        wNpvPH += yr.survival * df * nw;
      }
      blNpvCost += wNpvCost;
      blNpvPH += wNpvPH;
      step2.push({
        year: y, lapseRate, retention: wRetention, incRate: wIncRate,
        yearCost: wYearCost, df, yearNPVCost: wNpvCost, yearNPVPH: wNpvPH,
        cumNPVCost: blNpvCost, cumNPVPH: blNpvPH,
      });
    }

    // Step 3: blended PMPM (from the blended computation already available)
    const blendedPMPM = blended.blendedPMPM;
    const neededRevenue = blNpvCost / (1 - targetCM);

    // Step 4: blended margin profile (using per-age PMPMs, weighted avg of per-age CM%)
    const step4 = [];
    let cumNPVMargin = 0;
    for (let y = 1; y <= nYears; y++) {
      let wRev = 0, wCost = 0, wMarginPct = 0;
      const df = 1 / Math.pow(1 + discount, y);
      for (const { w, years, pmpm } of perAgeResults) {
        const nw = w / totalW;
        const yr = years[y - 1];
        const rev = yr.survival * pmpm * 12;
        const cost = yr.survival * yr.hxAnnual + yr.survival * yr.incRate * yr.txPerCase + yr.nxAnnual;
        wRev += rev * nw;
        wCost += cost * nw;
        const pct = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
        wMarginPct += pct * nw;
      }
      const margin = wRev - wCost;
      cumNPVMargin += margin * df;
      step4.push({ year: y, revenue: wRev, cost: wCost, margin, marginPct: Math.round(wMarginPct * 10) / 10, cumNPVMargin, survival: step2[y - 1].retention });
    }

    return {
      step1, step2, pmpm: blendedPMPM,
      npvCost: blNpvCost, npvPHYears: blNpvPH, npvCaseFee: 0,
      neededRevenue, step4,
    };
  }, [params, duration, targetCM, blended.blendedPMPM]);

  const stats = getBlendedStats();
  const zeroCross = blendedMarginProfile.find((d, i) => i > 0 && blendedMarginProfile[i - 1].marginPct >= 0 && d.marginPct < 0);

  const chartColors = { healthy: "#34d399", treatment: "#fbbf24", halo: "#a78bfa", recovery: "#f87171", margin: "#3b82f6", male: "#60a5fa", female: "#f472b6" };

  return (
    <div className="bg-slate-900 text-white" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ─── STICKY NAV ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 shadow-lg" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-white tracking-tight">Growth Pricing Framework</span>
            <div className="hidden md:flex items-center gap-1">
              {SECTION_LABELS.map((label, i) => (
                <button key={i} onClick={() => scrollTo(i)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${activeSection === i ? "bg-blue-500/20 text-blue-400 font-medium" : "text-slate-500 hover:text-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={`flex items-center gap-4 transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-0"}`}>
            <span className="text-xs text-slate-500">{scenario}{modified ? " (modified)" : ""}</span>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-400">{fmt(blended.blendedPMPM)}</div>
              <div className="text-[10px] text-slate-500 -mt-0.5">Blended PMPM</div>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── SECTION 1: THE MODEL ─── */}
      <section ref={el => sectionRefs.current[0] = el} id="model"
        className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950" />
        <div className="relative max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 mb-4">Need &times; Hanwha Life Insurance</div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white">
            Growth Pricing Framework
          </h1>

          {/* Hero Stats */}
          <div className="flex gap-10 items-start">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Policy Term</div>
              <div className="flex gap-1">
                {[20, 30].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`h-9 px-3 text-sm font-semibold rounded-md transition-all ${duration === d ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                    {d}yr
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Target CM</div>
              <div className="flex items-center gap-1">
                <input type="number" value={Math.round(targetCM * 100)} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTargetCM(Math.max(0, Math.min(100, v)) / 100); }}
                  className="h-9 w-14 bg-slate-800 border border-slate-700 rounded-md px-2 text-sm font-semibold text-slate-200 text-right focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-sm font-semibold text-slate-400">%</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Blended PMPM</div>
              <div className="h-9 flex items-center text-sm font-semibold text-blue-400">{fmt(blended.blendedPMPM)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Year CM Crosses 0</div>
              <div className="h-9 flex items-center text-sm font-semibold text-slate-200">{zeroCross ? `Year ${zeroCross.year}` : "N/A"}</div>
            </div>
          </div>

          {/* Section Navigation */}
          <div className="mt-14 flex flex-col gap-3">
            {[
              { idx: 1, num: "01", title: "Cost Scenario / Assumptions", desc: "Inputs" },
              { idx: 2, num: "02", title: "Insurer Provided Data (cancer incidence, mortality, lapse rates)", desc: "Inputs" },
              { idx: 3, num: "03", title: "PMPM Table by Age and Gender", desc: "Outputs" },
              { idx: 4, num: "04", title: "Annual CM Over Cohort Life", desc: "Outputs" },
              { idx: 5, num: "05", title: "How It Works", desc: "Calculation engine walkthrough" },
            ].map(s => (
              <button key={s.idx} onClick={() => scrollTo(s.idx)}
                className="flex-1 min-w-0 text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/40 rounded-lg px-5 py-3 transition-all group">
                <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mb-0.5">{s.desc}</div>
                <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                  <span className="text-blue-400 mr-1.5">{s.num}</span>{s.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: ASSUMPTIONS ─── */}
      <section ref={el => sectionRefs.current[1] = el} id="assumptions" className="bg-slate-950 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="01 — Assumptions" title="Adjust the assumptions"
            subtitle="Every field is editable. Change a number and watch the cost curves, pricing table, and margin chart update in real time." />

          {/* Scenario Picker */}
          <div className="mb-8">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Choose a scenario</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SCENARIOS).map(s => (
                <button key={s} onClick={() => selectScenario(s)}
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${scenario === s
                    ? "bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25"
                    : "bg-slate-800 text-slate-300 border border-slate-700 hover:border-blue-500/50 hover:text-white"}`}>
                  {s}
                </button>
              ))}
              {modified && <span className="px-2.5 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full font-medium self-center">Modified</span>}
            </div>
            {SCENARIOS[scenario]?.desc && (
              <p className="mt-3 text-sm text-slate-500 max-w-xl">{SCENARIOS[scenario].desc}</p>
            )}
          </div>

          {/* Assumption groups */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Starting Costs */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Starting Costs</h3>
              <div className="grid grid-cols-2 gap-4">
                <NumInput label="Healthy Mode" value={params.hx} onChange={v => updateParam("hx", v)} step={0.01} unit="$/mo/PH" />
                <NumInput label="Treatment" value={params.tx} onChange={v => updateParam("tx", v)} step={1} unit="$/case" />
                <NumInput label="Halo" value={params.halo} onChange={v => updateParam("halo", v)} step={1} unit="$/case" />
                <NumInput label="Recovery %" value={params.recoveryPct * 100} onChange={v => updateParam("recoveryPct", v / 100)} step={5} unit="%" />
              </div>
            </div>

            {/* Cost Dynamics */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Cost Dynamics</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="Halo Eff %" value={params.haloEff * 100} onChange={v => updateParam("haloEff", v / 100)} step={1} unit="%" />
                <TxtInput label="Halo Eff Years" value={params.haloYears} onChange={v => updateParam("haloYears", v)} />
                <NumInput label="Hx Step-up %" value={params.hxStepUp * 100} onChange={v => updateParam("hxStepUp", v / 100)} step={1} unit="%" />
                <TxtInput label="Hx Step-up Years" value={params.hxStepYears} onChange={v => updateParam("hxStepYears", v)} />
                <NumInput label="Tx Step-down %" value={params.txStepDown * 100} onChange={v => updateParam("txStepDown", v / 100)} step={1} unit="%" />
                <TxtInput label="Tx Step-down Years" value={params.txStepYears} onChange={v => updateParam("txStepYears", v)} />
                <NumInput label="Infra Step-up %" value={params.infraStepUp * 100} onChange={v => updateParam("infraStepUp", v / 100)} step={1} unit="%" />
                <NumInput label="Infra Contract Yrs" value={params.infraContractYears} onChange={v => updateParam("infraContractYears", v)} step={1} />
              </div>
            </div>

            {/* Model Parameters */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Model Parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                <NumInput label="Inflation %" value={params.inflation * 100} onChange={v => updateParam("inflation", v / 100)} step={0.5} unit="%" />
                <NumInput label="Discount Rate %" value={params.discount * 100} onChange={v => updateParam("discount", v / 100)} step={0.5} unit="%" />
                <NumInput label="Target CM %" value={targetCM * 100} onChange={v => setTargetCM(v / 100)} step={5} unit="%" />
                <NumInput label="Cohort Size" value={cohortSize} onChange={setCohortSize} step={10000} />
                <NumInput label="Nx Cost" value={params.nxCost} onChange={v => updateParam("nxCost", v)} step={1} unit="$/new PH" />
              </div>
            </div>
          </div>

          {/* Case Fee */}
          <div className="mb-10">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Case Fee</h3>
                <button onClick={() => updateParam("caseFeeEnabled", !params.caseFeeEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${params.caseFeeEnabled ? "bg-blue-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${params.caseFeeEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {params.caseFeeEnabled && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <NumInput label="Case Fee" value={params.caseFee} onChange={v => updateParam("caseFee", v)} step={1} unit="$/case" />
                  <NumInput label="Case Fee Year" value={params.caseFeeYear} onChange={v => updateParam("caseFeeYear", v)} step={1} />
                  <NumInput label="Case Fee Trigger %" value={params.caseFeeTrigger * 100} onChange={v => updateParam("caseFeeTrigger", v / 100)} step={0.1} unit="%" />
                </div>
              )}
            </div>
          </div>

          {/* Live Cost Curves */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Projected Cost Curves</h3>
                {costCurveView === "table" && <p className="text-[11px] text-slate-500 mt-0.5">Click any value for a breakdown of how it was calculated.</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{duration}-year projection with current assumptions</span>
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  {["chart", "table"].map(v => (
                    <button key={v} onClick={() => setCostCurveView(v)}
                      className={`px-3 py-1 text-xs rounded-md transition-all capitalize ${costCurveView === v ? "bg-blue-500 text-white font-semibold" : "text-slate-400 hover:text-white"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {costCurveView === "chart" ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={costCurveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Policy Year", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => "$" + v.toLocaleString()} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => ["$" + Number(v).toFixed(2), name]} labelFormatter={v => `Year ${v}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="healthy" name="Healthy ($/yr/PH)" stroke={chartColors.healthy} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="treatment" name="Treatment ($/case)" stroke={chartColors.treatment} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="halo" name="Halo ($/case)" stroke={chartColors.halo} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="recovery" name="Recovery ($/case)" stroke={chartColors.recovery} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto relative">
                {costPopup && (
                  <div className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-4 max-w-xs" style={{ top: costPopup.y, left: costPopup.x }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Year {costPopup.year} — {costPopup.field}</span>
                      <button onClick={() => setCostPopup(null)} className="text-slate-500 hover:text-white text-sm ml-3">✕</button>
                    </div>
                    {costPopup.lines.map((line, i) => (
                      <div key={i} className="text-xs text-slate-300 py-0.5">{line}</div>
                    ))}
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">Year</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Healthy ($/yr/PH)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Treatment ($/case)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Halo ($/case)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Recovery ($/case)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCurveData.map(d => {
                      const cell = (field, val) => (
                        <td key={field} className="px-3 py-1.5 text-right font-mono text-slate-300 cursor-pointer hover:text-blue-400 hover:bg-slate-800 transition-colors rounded"
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCostPopup(prev => prev && prev.year === d.year && prev.field === field ? null : {
                              year: d.year, field, lines: d.explain[field],
                              x: Math.min(rect.left, window.innerWidth - 320), y: rect.bottom + 4,
                            });
                          }}>
                          ${Number(val).toFixed(2)}
                        </td>
                      );
                      return (
                        <tr key={d.year} className="border-b border-slate-800">
                          <td className="px-3 py-1.5 text-slate-300 font-medium">{d.year}</td>
                          {cell("healthy", d.healthy)}
                          {cell("treatment", d.treatment)}
                          {cell("halo", d.halo)}
                          {cell("recovery", d.recovery)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: THE DATA ─── */}
      <Section id="data" dark>
        <div ref={el => sectionRefs.current[2] = el} />
        <SectionTitle label="02 — The Data" title="What drives the model"
          subtitle="Three datasets from Hanwha Life Insurance underpin every calculation: how often cancer occurs, how fast policyholders leave, and background mortality. All rates are per 1,000 lives." />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Incidence */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Cancer Incidence by Age</h3>
            <p className="text-xs text-slate-500 mb-4">Female incidence rises earlier and faster, peaking around age 55. Male incidence accelerates after 60.</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={incidenceData}>
                <defs>
                  <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.male} stopOpacity={0.3}/><stop offset="100%" stopColor={chartColors.male} stopOpacity={0}/></linearGradient>
                  <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.female} stopOpacity={0.3}/><stop offset="100%" stopColor={chartColors.female} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="age" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.toFixed(0)} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v.toFixed(2) + " per 1K"]} />
                <Area type="monotone" dataKey="male" name="Male" stroke={chartColors.male} fill="url(#gM)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="female" name="Female" stroke={chartColors.female} fill="url(#gF)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Lapse */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Lapse Rates by Policy Year</h3>
            <p className="text-xs text-slate-500 mb-4">Highest attrition in years 1–3 (~11–13%), then declines sharply. 30yr policies stabilize at 0.1% by year 20.</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={lapseData}>
                <defs>
                  <linearGradient id="gL30" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" stopOpacity={0.3}/><stop offset="100%" stopColor="#fbbf24" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gL20" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3}/><stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v + "%"} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v.toFixed(2) + "%"]} />
                <Area type="monotone" dataKey="30yr" name="30-year" stroke="#fbbf24" fill="url(#gL30)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="20yr" name="20-year" stroke="#a78bfa" fill="url(#gL20)" strokeWidth={1.5} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Mortality */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Mortality Rates by Age</h3>
            <p className="text-xs text-slate-500 mb-4">Background mortality rises exponentially after age 60. Male rates are consistently higher than female.</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mortalityData}>
                <defs>
                  <linearGradient id="gMortM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.male} stopOpacity={0.3}/><stop offset="100%" stopColor={chartColors.male} stopOpacity={0}/></linearGradient>
                  <linearGradient id="gMortF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.female} stopOpacity={0.3}/><stop offset="100%" stopColor={chartColors.female} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="age" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.toFixed(0)} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v.toFixed(3) + " per 1K"]} />
                <Area type="monotone" dataKey="male" name="Male" stroke={chartColors.male} fill="url(#gMortM)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="female" name="Female" stroke={chartColors.female} fill="url(#gMortF)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PH Distribution summary */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 flex flex-wrap items-center gap-8">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Policyholder Distribution</div>
            <div className="text-sm font-medium text-white">HLI All Cancer Coverage Products</div>
          </div>
          <div className="flex gap-6 text-sm">
            <div><span className="text-slate-500">Avg Age:</span> <span className="text-white font-medium">{stats.avgAge}</span> <span className="text-slate-600">(M: {stats.avgAgeM}, F: {stats.avgAgeF})</span></div>
            <div><span className="text-slate-500">Gender:</span> <span className="text-white font-medium">{stats.femalePct}% F / {stats.malePct}% M</span></div>
            <div><span className="text-slate-500">Age Range:</span> <span className="text-white font-medium">15 – 80</span></div>
          </div>
        </div>
      </Section>

      {/* ─── SECTION 4: PRICING TABLE ─── */}
      <Section id="pricing" dark>
        <div ref={el => sectionRefs.current[3] = el} />
        <SectionTitle label="03 — The Price" title="PMPM by age and gender"
          subtitle="The monthly premium per member that achieves the target contribution margin over the full policy term, weighted by HLI's policyholder distribution." />

        {/* Blended PMPM hero stat */}
        <div className="flex items-end gap-8 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl px-8 py-5 shadow-lg shadow-blue-600/20">
            <div className="text-xs text-blue-200 uppercase tracking-widest mb-1">Weighted Blended PMPM</div>
            <div className="text-4xl font-bold text-white">{fmt(blended.blendedPMPM)}</div>
          </div>
          <div className="text-sm text-slate-400">
            <div>Male avg: <span className="text-white font-medium">{fmt(blended.malePMPM)}</span> ({pct(blended.maleWeight)} of book)</div>
            <div>Female avg: <span className="text-white font-medium">{fmt(blended.femalePMPM)}</span> ({pct(blended.femaleWeight)} of book)</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-4">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400 w-16">Age</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-400">Male PMPM</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-400">Female PMPM</th>
                  <th className="text-right px-4 py-2.5 font-medium text-blue-400">Blended</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">PH Weight</th>
                </tr>
              </thead>
              <tbody>
                {pricingTable.map(row => {
                  const wM = PH_M[row.age] || 0, wF = PH_F[row.age] || 0, tot = wM + wF;
                  const bl = tot > 0 ? (row.male * wM + row.female * wF) / tot : (row.male + row.female) / 2;
                  return (
                    <tr key={row.age} className="border-b border-slate-800/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-1.5 font-medium text-slate-300">{row.age}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-slate-300">{fmt(row.male)}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-slate-300">{fmt(row.female)}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-blue-400 font-medium">{fmt(bl)}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-slate-600 text-xs">{pct(tot, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Demographics bar */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-wrap items-center gap-6 text-xs text-slate-500">
          <div><span className="text-slate-600">Source:</span> <span className="text-slate-300 font-medium">HLI All Cancer PH Distribution</span></div>
          <div><span className="text-slate-600">Avg Age:</span> <span className="text-slate-300 font-medium">{stats.avgAge}</span></div>
          <div><span className="text-slate-600">Gender:</span> <span className="text-slate-300 font-medium">{stats.femalePct}% F / {stats.malePct}% M</span></div>
          <div><span className="text-slate-600">Target CM:</span> <span className="text-slate-300 font-medium">{pct(targetCM, 0)}</span></div>
          <div><span className="text-slate-600">Duration:</span> <span className="text-slate-300 font-medium">{duration}yr</span></div>
        </div>
      </Section>

      {/* ─── SECTION 5: COHORT MARGIN ─── */}
      <section ref={el => sectionRefs.current[4] = el} id="margin" className="bg-slate-950 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="04 — The Margin" title="Annual contribution margin over the life of a cohort"
            subtitle="Weighted across all ages (15–80) and genders using HLI's actual policyholder distribution. Each age is priced at its own solved PMPM, then aggregated. As the cohort ages, rising cancer incidence erodes the margin year over year." />

          {/* Zero crossing callout */}
          <div className={`mb-6 px-5 py-4 rounded-xl border ${zeroCross ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <span className={`text-sm font-semibold ${zeroCross ? "text-red-400" : "text-emerald-400"}`}>
              {zeroCross
                ? `Annual margin turns negative in Year ${zeroCross.year} (${zeroCross.marginPct}%)`
                : "Annual margin stays positive across all policy years"}
            </span>
            {zeroCross && <span className="text-xs text-red-400/70 ml-3">Rising cancer incidence outpaces the age-banded PMPM for the blended book.</span>}
          </div>

          {/* Chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4">Annual Contribution Margin % by Year — HLI Blended Book (all ages, {Math.round(blended.femaleWeight * 100)}% F / {Math.round(blended.maleWeight * 100)}% M)</h3>
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={blendedMarginProfile}>
                <defs>
                  <linearGradient id="gMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.margin} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={chartColors.margin} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Policy Year", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }} />
                <YAxis tickFormatter={v => v + "%"} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v + "%", "Margin"]} labelFormatter={v => `Year ${v}`} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                <Area type="monotone" dataKey="marginPct" name="Margin %" stroke={chartColors.margin} fill="url(#gMargin)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Year-by-year table */}
          <details className="group">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Show year-by-year breakdown
            </summary>
            <div className="mt-4 bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="px-3 py-2 text-left text-slate-400">Year</th>
                    <th className="px-3 py-2 text-right text-slate-400">Survival %</th>
                    <th className="px-3 py-2 text-right text-slate-400">Revenue</th>
                    <th className="px-3 py-2 text-right text-slate-400">Cost</th>
                    <th className="px-3 py-2 text-right text-slate-400">Margin</th>
                    <th className="px-3 py-2 text-right text-slate-400">Margin %</th>
                    <th className="px-3 py-2 text-right text-slate-400">Cum NPV</th>
                  </tr>
                </thead>
                <tbody>
                  {blendedMarginProfile.map(d => (
                    <tr key={d.year} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                      <td className="px-3 py-1.5 text-slate-300">{d.year}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{d.survival}%</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtK(d.revenue)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtK(d.totalCost)}</td>
                      <td className={`px-3 py-1.5 text-right ${d.margin < 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtK(d.margin)}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${d.marginPct < 0 ? "text-red-400" : "text-emerald-400"}`}>{d.marginPct}%</td>
                      <td className={`px-3 py-1.5 text-right ${d.cumNPVMargin < 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtK(d.cumNPVMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </section>

      {/* ─── SECTION 6: HOW IT WORKS ─── */}
      <section ref={el => sectionRefs.current[5] = el} id="howitworks" className="bg-slate-900 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="05 — How It Works" title="Calculation engine walkthrough"
            subtitle="A step-by-step walkthrough from input assumptions to how the model calculates to the final outputs." />

          {/* Blended result banner */}
          <div className="flex items-center gap-4 mb-10 px-5 py-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <span className="text-xs text-slate-400 uppercase tracking-widest">HLI Blended Book</span>
            <span className="ml-auto text-sm text-slate-400">
              Blended PMPM: <span className="text-blue-400 font-bold text-lg">{fmt(traceData.pmpm)}</span>
            </span>
          </div>

          {/* ── STEP 1: Build Cost Curves ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">1</div>
              <div>
                <h3 className="text-base font-semibold text-white">Build Cost Curves</h3>
                <p className="text-xs text-slate-500">buildCostCurves &amp; buildInfraCurves</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-3">
              <p className="text-sm text-slate-400 mb-4">
                This table shows the projected annual cost of each mode and their respective components.
                All costs start at historical cost data and compound with inflation ({pct(params.inflation, 0)}/yr).
                Scenario adjustments (step-ups, step-downs, efficiency gains) are applied in the years you specified.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="px-2 py-1 text-left text-slate-500" rowSpan={2}>Year</th>
                      <th className="px-2 py-1 text-center text-blue-400 font-semibold border-b border-slate-700" colSpan={3}>Hx (Healthy Mode)</th>
                      <th className="px-2 py-1 text-center text-blue-400 font-semibold border-b border-slate-700" colSpan={4}>Tx (Treatment)</th>
                      <th className="px-2 py-1 text-center text-blue-400 font-semibold border-b border-slate-700" colSpan={3}>Rx (Recovery)</th>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-1.5 text-right text-slate-500">Service</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Infra</th>
                      <th className="px-2 py-1.5 text-right text-blue-300 font-semibold">Total</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Tx</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Halo</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Infra</th>
                      <th className="px-2 py-1.5 text-right text-blue-300 font-semibold">Total</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Recovery</th>
                      <th className="px-2 py-1.5 text-right text-slate-500">Infra</th>
                      <th className="px-2 py-1.5 text-right text-blue-300 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceData.step1.map(r => (
                      <tr key={r.year} className="border-b border-slate-800/50">
                        <td className="px-2 py-1.5 text-slate-300 font-medium">{r.year}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.hxService.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500 font-mono">${r.hxInfra.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-300 font-mono font-medium">${r.totalHx.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.tx.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.halo.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500 font-mono">${r.txInfraVal.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-300 font-mono font-medium">${r.totalTx.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.recovery.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500 font-mono">${r.rxInfraVal.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-300 font-mono font-medium">${r.totalRx.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── STEP 2: Run Cohort Projection ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">2</div>
              <div>
                <h3 className="text-base font-semibold text-white">Run Blended Cohort Projection</h3>
                <p className="text-xs text-slate-500">runCohort per age/gender, then PH-mix weighted blend — {duration}yr policy</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-3">
              <p className="text-sm text-slate-400 mb-4">
                For each of the 132 age/gender cohorts: look up lapse, mortality, and cancer incidence per year. Compute additive attrition, then retention.
                The values below are PH-mix weighted averages across the full HLI book.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-2 text-left text-slate-500">Year</th>
                      <th className="px-2 py-2 text-right text-blue-400">Blended Retention</th>
                      <th className="px-2 py-2 text-right text-slate-500">Blended Incidence</th>
                      <th className="px-2 py-2 text-right text-slate-500">Blended Year Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceData.step2.filter((_, i) => i < 10 || (i + 1) % 5 === 0).map(r => (
                      <tr key={r.year} className="border-b border-slate-800/50">
                        <td className="px-2 py-1.5 text-slate-300 font-medium">{r.year}</td>
                        <td className="px-2 py-1.5 text-right text-blue-300 font-mono font-medium">{(r.retention * 100).toFixed(3)}%</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{(r.incRate * 1000).toFixed(2)}‰</td>
                        <td className="px-2 py-1.5 text-right text-slate-300 font-mono">${r.yearCost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Showing years 1-10 and every 5th year after. All values are PH-mix weighted averages per policyholder. Incidence shown per 1,000 lives (‰).</p>
            </div>
          </div>

          {/* ── STEP 3: Solve for PMPM ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">3</div>
              <div>
                <h3 className="text-base font-semibold text-white">Solve for Blended PMPM</h3>
                <p className="text-xs text-slate-500">solvePMPM per age/gender, then PH-mix weighted average — target {pct(targetCM, 0)} CM</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-3">
              <p className="text-sm text-slate-400 mb-4">
                Each age/gender gets its own solved PMPM at {pct(params.discount, 0)} discount rate. The blended PMPM
                is the PH-mix weighted average across all cohorts. Below are the blended NPV totals.
              </p>
              <div className="bg-slate-900/60 rounded-lg p-3 mb-4 font-mono text-xs text-slate-300">
                <div>discountFactor[y] = 1 / (1 + {params.discount})^y</div>
                <div className="mt-1">NPV of Costs = &Sigma; (yearCost &times; discountFactor) = <span className="text-blue-300">${traceData.npvCost.toFixed(4)}</span></div>
                <div>NPV of PH-Years = &Sigma; (retention &times; discountFactor) = <span className="text-blue-300">{traceData.npvPHYears.toFixed(4)}</span></div>
                {traceData.npvCaseFee > 0 && <div>NPV of Case Fee = <span className="text-emerald-300">${traceData.npvCaseFee.toFixed(4)}</span></div>}
                <div className="mt-2 border-t border-slate-700 pt-2">
                  Needed Revenue = NPV Costs / (1 - CM) = {traceData.npvCost.toFixed(4)} / {(1 - targetCM).toFixed(2)} = <span className="text-blue-300">${traceData.neededRevenue.toFixed(4)}</span>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-white font-semibold">PMPM</span> = {traceData.npvCaseFee > 0
                    ? `(${traceData.neededRevenue.toFixed(2)} - ${traceData.npvCaseFee.toFixed(2)})`
                    : traceData.neededRevenue.toFixed(4)} / {traceData.npvPHYears.toFixed(4)} / 12 = <span className="text-blue-400 font-bold">${traceData.pmpm.toFixed(4)}</span>
                </div>
              </div>

              {/* NPV accumulation table */}
              <details className="group">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Show year-by-year NPV accumulation
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-2 py-2 text-left text-slate-500">Year</th>
                        <th className="px-2 py-2 text-right text-slate-500">DF</th>
                        <th className="px-2 py-2 text-right text-slate-500">Year Cost</th>
                        <th className="px-2 py-2 text-right text-slate-500">NPV Cost</th>
                        <th className="px-2 py-2 text-right text-blue-400">Cum NPV Cost</th>
                        <th className="px-2 py-2 text-right text-slate-500">NPV PH</th>
                        <th className="px-2 py-2 text-right text-blue-400">Cum NPV PH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traceData.step2.filter((_, i) => i < 10 || (i + 1) % 5 === 0).map(r => (
                        <tr key={r.year} className="border-b border-slate-800/50">
                          <td className="px-2 py-1.5 text-slate-300 font-medium">{r.year}</td>
                          <td className="px-2 py-1.5 text-right text-slate-500 font-mono">{r.df.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.yearCost.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.yearNPVCost.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right text-blue-300 font-mono">${r.cumNPVCost.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{r.yearNPVPH.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right text-blue-300 font-mono">{r.cumNPVPH.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>

          {/* ── STEP 4: Compute Margin Profile ── */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">4</div>
              <div>
                <h3 className="text-base font-semibold text-white">Blended Margin Profile</h3>
                <p className="text-xs text-slate-500">Per-age revenue vs. cost, then PH-mix weighted — CM% is weighted avg of per-age CMs</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <p className="text-sm text-slate-400 mb-4">
                Each age uses its own solved PMPM. Revenue and cost are PH-mix weighted. The margin % is the weighted average
                of per-age spot CMs (matching the Excel's blending method). As the book ages, incidence rises and margin compresses.
              </p>
              <div className="bg-slate-900/60 rounded-lg p-3 mb-4 font-mono text-xs text-slate-300">
                <div>revenue[y] = retention[y] &times; PMPM &times; 12</div>
                <div>margin[y] = revenue[y] - cost[y]</div>
                <div>cumNPVMargin = &Sigma; margin[y] &times; discountFactor[y]</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-2 text-left text-slate-500">Year</th>
                      <th className="px-2 py-2 text-right text-slate-500">Survival</th>
                      <th className="px-2 py-2 text-right text-slate-500">Revenue</th>
                      <th className="px-2 py-2 text-right text-slate-500">Cost</th>
                      <th className="px-2 py-2 text-right text-slate-500">Margin</th>
                      <th className="px-2 py-2 text-right text-slate-500">Margin %</th>
                      <th className="px-2 py-2 text-right text-blue-400">Cum NPV Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceData.step4.filter((_, i) => i < 10 || (i + 1) % 5 === 0).map(r => (
                      <tr key={r.year} className="border-b border-slate-800/50">
                        <td className="px-2 py-1.5 text-slate-300 font-medium">{r.year}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{(r.survival * 100).toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.revenue.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.cost.toFixed(4)}</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${r.margin < 0 ? "text-red-400" : "text-emerald-400"}`}>${r.margin.toFixed(4)}</td>
                        <td className={`px-2 py-1.5 text-right font-mono font-medium ${r.marginPct < 0 ? "text-red-400" : "text-emerald-400"}`}>{r.marginPct.toFixed(1)}%</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${r.cumNPVMargin < 0 ? "text-red-400" : "text-emerald-400"}`}>${r.cumNPVMargin.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">All values are PH-mix weighted averages per policyholder. Margin % = weighted avg of per-age CMs, matching the Excel methodology.</p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-8 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>Growth Pricing Framework &middot; Need &times; Hanwha Life Insurance &middot; April 2026</span>
          <span>Data: HLI 2026.04.07 pricing data request</span>
        </div>
      </footer>

      {/* ─── SIDE NAV DOTS ─── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3">
        {SECTIONS.map((_, i) => (
          <button key={i} onClick={() => scrollTo(i)}
            className={`w-2 h-2 rounded-full transition-all ${activeSection === i ? "bg-blue-400 scale-125" : "bg-slate-600 hover:bg-slate-400"}`}
            title={SECTION_LABELS[i]} />
        ))}
      </div>
    </div>
  );
}
