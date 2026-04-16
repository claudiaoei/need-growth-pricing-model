// Excel export generator for the pricing deck.
// Produces a customer-ready workbook matching the HLI 2026.4 Pricing Table format:
//   • Summary tab with scenario × CM × duration grid
//   • One tab per selected scenario (Base / Bull / Bear), each with:
//       - Top block: blended / male blended / female blended PMPM per duration, per CM
//       - Bottom block: per-age pricing grid (duration × gender), per CM, side-by-side
//   • Optional Assumptions sheet
//   • Optional Margin Profile sheet (year-by-year blended book margin)

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  SCENARIOS, PH_M, PH_F,
  solvePMPM, computeBlended, computeMarginProfile,
} from "./pricingEngine";

// ───────── styling constants ─────────
const BRAND_BLUE = "FF1E3A8A";      // blue-900
const BRAND_BLUE_LIGHT = "FF3B82F6"; // blue-500
const HEADER_GREEN = "FF15803D";     // green-700 (matches HLI reference band)
const SECTION_TITLE_RED = "FFB91C1C"; // red-700 (matches HLI reference titles)
const ZEBRA_FILL = "FFF8FAFC";       // slate-50
const BORDER_GREY = "FFCBD5E1";      // slate-300
const LABEL_GREY = "FF475569";       // slate-600

const MONEY_FMT = '"$"#,##0.00';
const PCT_FMT = "0.00%";
const INT_FMT = "0";

// ───────── helpers ─────────
function sanitizeFilename(name) {
  return (name || "Pricing")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function autoFilename(customer) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const name = (customer || "Customer").trim();
  return `${yyyy}.${mm} ${name} Pricing.xlsx`;
}

function ensureXlsx(filename) {
  const clean = sanitizeFilename(filename);
  return clean.toLowerCase().endsWith(".xlsx") ? clean : `${clean}.xlsx`;
}

function applyBorder(cell, color = BORDER_GREY) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function styleHeaderCell(cell, { fill = BRAND_BLUE, fontColor = "FFFFFFFF", align = "center" } = {}) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: fontColor }, size: 11 };
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: true };
  applyBorder(cell);
}

function styleSubHeaderCell(cell, { fill = "FFE2E8F0", fontColor = LABEL_GREY, align = "center" } = {}) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: fontColor }, size: 10, italic: true };
  cell.alignment = { horizontal: align, vertical: "middle" };
  applyBorder(cell);
}

function styleDataCell(cell, { fmt = MONEY_FMT, bold = false, color = "FF0F172A" } = {}) {
  cell.numFmt = fmt;
  cell.font = { bold, color: { argb: color }, size: 10 };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  applyBorder(cell);
}

function styleLabelCell(cell, { bold = false, color = "FF0F172A" } = {}) {
  cell.font = { bold, color: { argb: color }, size: 10 };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  applyBorder(cell);
}

function zebra(row) {
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (!cell.fill || cell.fill.type !== "pattern") {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
    }
  });
}

// ───────── SUMMARY SHEET ─────────
// Rebuilds the HLI 2026.4 "Summary" sheet layout:
//   Row: [label] [Scenario 1] [Scenario 2] ... (one col per scenario × CM)
//   Rows: HLI 20Y, HLI 30Y, optional HLI blended (55% 20Y / 45% 30Y)
function buildSummarySheet(wb, {
  customer, scenarios, durations, cms, cachedBlended,
}) {
  const ws = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 1 }],
  });

  // Title + customer
  ws.mergeCells(1, 1, 1, 1 + scenarios.length * cms.length);
  const title = ws.getCell(1, 1);
  title.value = `Growth Pricing Framework — ${customer}`;
  title.font = { bold: true, size: 16, color: { argb: BRAND_BLUE } };
  title.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(2, 1, 2, 1 + scenarios.length * cms.length);
  const subtitle = ws.getCell(2, 1);
  subtitle.value = `Generated ${new Date().toISOString().slice(0, 10)} · Need × Hanwha partnership pricing framework`;
  subtitle.font = { italic: true, size: 10, color: { argb: LABEL_GREY } };

  // "PMPM" label row
  const labelRow = ws.getRow(3);
  labelRow.getCell(1).value = "PMPM";
  labelRow.getCell(1).font = { bold: true, color: { argb: SECTION_TITLE_RED }, size: 11 };

  // Scenario header row (Scenario 1, Scenario 2, …)
  // CM sub-header row (Base 70%, Base 65%, …)
  const headerRow1 = ws.getRow(4);
  const headerRow2 = ws.getRow(5);
  let col = 2;
  let scenarioIdx = 1;
  const colMap = new Map(); // "Base|0.70" -> column index
  for (const scen of scenarios) {
    for (const cm of cms) {
      const c1 = headerRow1.getCell(col);
      c1.value = `Scenario ${scenarioIdx}`;
      styleHeaderCell(c1, { fill: BRAND_BLUE });

      const c2 = headerRow2.getCell(col);
      c2.value = `${scen} ${Math.round(cm * 100)}%`;
      styleSubHeaderCell(c2, { fill: "FFE2E8F0" });

      colMap.set(`${scen}|${cm}`, col);
      col++;
      scenarioIdx++;
    }
  }

  // Data rows: one per duration
  let rowIdx = 6;
  for (const dur of durations) {
    const r = ws.getRow(rowIdx);
    const label = r.getCell(1);
    label.value = {
      richText: [
        { text: `HLI ${dur}Y`, font: { bold: true, size: 10 } },
        { text: `\nBased on HLI PH mix (avg. 40% male, 50yo; 60% female, 53yo)`, font: { italic: true, size: 9, color: { argb: LABEL_GREY } } },
      ],
    };
    label.alignment = { wrapText: true, vertical: "middle" };
    applyBorder(label);

    for (const scen of scenarios) {
      for (const cm of cms) {
        const c = r.getCell(colMap.get(`${scen}|${cm}`));
        c.value = cachedBlended[`${scen}|${dur}|${cm}`].blendedPMPM;
        styleDataCell(c, { fmt: MONEY_FMT, bold: true });
      }
    }
    r.height = 36;
    rowIdx++;
  }

  // Optional 55/45 blended row (only if both 20Y and 30Y are in the selection)
  if (durations.includes(20) && durations.includes(30)) {
    const r = ws.getRow(rowIdx);
    const label = r.getCell(1);
    label.value = {
      richText: [
        { text: `HLI blended`, font: { bold: true, size: 10 } },
        { text: `\n55% 20Y\n45% 30Y`, font: { italic: true, size: 9, color: { argb: LABEL_GREY } } },
      ],
    };
    label.alignment = { wrapText: true, vertical: "middle" };
    applyBorder(label);

    for (const scen of scenarios) {
      for (const cm of cms) {
        const v20 = cachedBlended[`${scen}|20|${cm}`].blendedPMPM;
        const v30 = cachedBlended[`${scen}|30|${cm}`].blendedPMPM;
        const c = r.getCell(colMap.get(`${scen}|${cm}`));
        c.value = 0.55 * v20 + 0.45 * v30;
        styleDataCell(c, { fmt: MONEY_FMT, bold: true, color: BRAND_BLUE });
      }
    }
    r.height = 44;
    rowIdx++;
  }

  // Column widths
  ws.getColumn(1).width = 42;
  for (let c = 2; c <= 1 + scenarios.length * cms.length; c++) {
    ws.getColumn(c).width = 14;
  }

  // Row heights
  ws.getRow(1).height = 26;
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 22;
}

// ───────── PER-SCENARIO SHEET ─────────
// Mirrors HLI 2026.4 "Base case" sheet layout:
//   Top block (rows 1-7): Blended / Male blended / Female blended PMPM per duration, per CM
//   Row 9: "Growth Pricing Framework" band spanning the per-CM pricing grid
//   Row 10+: per-age grid with columns [Age, dur-M, dur-F, ...] repeated per CM side-by-side
function buildScenarioSheet(wb, {
  scenarioName, scenarioParams, durations, cms, ageRange, cachedBlended, cachedPricing,
}) {
  const ws = wb.addWorksheet(`${scenarioName} case`, {
    views: [{ state: "frozen", ySplit: 11, xSplit: 1 }],
  });

  const blockWidth = 1 + durations.length * 2; // Age + (M,F) per duration
  const blockGap = 1;

  // ── Top block: blended summary per CM ──
  // Each CM block occupies `blockWidth` columns starting at startCol.
  cms.forEach((cm, cmIdx) => {
    const startCol = 1 + cmIdx * (blockWidth + blockGap);

    // Title at row 1
    ws.mergeCells(1, startCol, 1, startCol + 2);
    const title = ws.getCell(1, startCol);
    title.value = `${scenarioName} case (${Math.round(cm * 100)}% CM)`;
    title.font = { bold: true, size: 12, color: { argb: SECTION_TITLE_RED } };
    title.alignment = { horizontal: "left", vertical: "middle" };

    // Data rows 2-7: 3 rows per duration (Blended / Male blended / Female blended)
    // If multiple durations, iterate in descending order (30Y first, then 20Y) to match HLI reference
    const sortedDurs = [...durations].sort((a, b) => b - a);
    let row = 2;
    for (const dur of sortedDurs) {
      const b = cachedBlended[`${scenarioName}|${dur}|${cm}`];
      const rows = [
        [`${dur}Y`, "Blended PMPM", b.blendedPMPM, true],
        [`${dur}Y`, "Male blended", b.malePMPM, false],
        [`${dur}Y`, "Female blended", b.femalePMPM, false],
      ];
      for (const [durLabel, lbl, val, bold] of rows) {
        const rr = ws.getRow(row);
        const c1 = rr.getCell(startCol);
        c1.value = durLabel;
        c1.font = { bold: true, size: 10 };
        c1.alignment = { horizontal: "left" };

        const c2 = rr.getCell(startCol + 1);
        c2.value = lbl;
        c2.font = { bold, size: 10 };
        c2.alignment = { horizontal: "left" };

        const c3 = rr.getCell(startCol + 2);
        c3.value = val;
        c3.numFmt = MONEY_FMT;
        c3.font = { bold, size: 10, color: { argb: bold ? BRAND_BLUE : "FF0F172A" } };
        c3.alignment = { horizontal: "right" };
        row++;
      }
    }
  });

  // ── Section band: "Growth Pricing Framework" ──
  const bandRow = 9;
  cms.forEach((cm, cmIdx) => {
    const startCol = 1 + cmIdx * (blockWidth + blockGap);
    const endCol = startCol + blockWidth - 1;
    ws.mergeCells(bandRow, startCol, bandRow, endCol);
    const band = ws.getCell(bandRow, startCol);
    band.value = "Growth Pricing Framework";
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREEN } };
    band.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    band.alignment = { horizontal: "center", vertical: "middle" };
    applyBorder(band);
  });
  ws.getRow(bandRow).height = 22;

  // ── Header rows 10 (duration) + 11 (Age/Male/Female) ──
  cms.forEach((cm, cmIdx) => {
    const startCol = 1 + cmIdx * (blockWidth + blockGap);

    const dHeader = ws.getRow(10);
    const gHeader = ws.getRow(11);

    // Age column spans both header rows
    ws.mergeCells(10, startCol, 11, startCol);
    const ageCell = ws.getCell(10, startCol);
    ageCell.value = "Age";
    styleHeaderCell(ageCell, { fill: BRAND_BLUE });

    durations.forEach((dur, dIdx) => {
      const col = startCol + 1 + dIdx * 2;
      // Duration group header (merged across the 2 gender cols)
      ws.mergeCells(10, col, 10, col + 1);
      const dCell = ws.getCell(10, col);
      dCell.value = `${dur}-Year Policy`;
      styleHeaderCell(dCell, { fill: BRAND_BLUE_LIGHT });

      // Male / Female sub-headers
      const mCell = gHeader.getCell(col);
      mCell.value = "Male";
      styleHeaderCell(mCell, { fill: "FF60A5FA", fontColor: "FFFFFFFF" });
      const fCell = gHeader.getCell(col + 1);
      fCell.value = "Female";
      styleHeaderCell(fCell, { fill: "FFF472B6", fontColor: "FFFFFFFF" });
    });
  });
  ws.getRow(10).height = 20;
  ws.getRow(11).height = 20;

  // ── Data rows: per age ──
  const firstAge = ageRange.min;
  const lastAge = ageRange.max;
  let row = 12;
  for (let age = firstAge; age <= lastAge; age++) {
    const rr = ws.getRow(row);
    cms.forEach((cm, cmIdx) => {
      const startCol = 1 + cmIdx * (blockWidth + blockGap);
      const ageCell = rr.getCell(startCol);
      ageCell.value = age;
      ageCell.numFmt = INT_FMT;
      ageCell.font = { bold: true, size: 10, color: { argb: LABEL_GREY } };
      ageCell.alignment = { horizontal: "center" };
      applyBorder(ageCell);

      durations.forEach((dur, dIdx) => {
        const col = startCol + 1 + dIdx * 2;
        const key = `${scenarioName}|${dur}|${cm}|${age}`;
        const cached = cachedPricing[key];
        const mCell = rr.getCell(col);
        mCell.value = cached.male;
        styleDataCell(mCell, { fmt: MONEY_FMT });

        const fCell = rr.getCell(col + 1);
        fCell.value = cached.female;
        styleDataCell(fCell, { fmt: MONEY_FMT });
      });
    });
    if ((row - 12) % 2 === 1) zebra(rr);
    row++;
  }

  // ── Column widths ──
  const totalCols = cms.length * blockWidth + (cms.length - 1) * blockGap;
  for (let c = 1; c <= totalCols; c++) {
    const modWithinBlock = (c - 1) % (blockWidth + blockGap);
    // Age column is wider
    if (modWithinBlock === 0) ws.getColumn(c).width = 8;
    else if (modWithinBlock === blockWidth) ws.getColumn(c).width = 2; // gap column
    else ws.getColumn(c).width = 11;
  }
}

// ───────── ASSUMPTIONS SHEET ─────────
function buildAssumptionsSheet(wb, { scenarios }) {
  const ws = wb.addWorksheet("Assumptions", {
    views: [{ state: "frozen", ySplit: 3, xSplit: 1 }],
  });

  ws.mergeCells(1, 1, 1, 1 + scenarios.length);
  const title = ws.getCell(1, 1);
  title.value = "Scenario Assumptions";
  title.font = { bold: true, size: 14, color: { argb: BRAND_BLUE } };

  const header = ws.getRow(3);
  header.getCell(1).value = "Assumption";
  styleHeaderCell(header.getCell(1), { fill: BRAND_BLUE });
  scenarios.forEach((scen, i) => {
    const c = header.getCell(2 + i);
    c.value = `${scen} case`;
    styleHeaderCell(c, { fill: BRAND_BLUE });
  });

  const rows = [
    ["Starting Hx cost ($/yr/PH)", "hx", MONEY_FMT],
    ["Starting Tx cost ($/case)", "tx", MONEY_FMT],
    ["Starting Halo cost ($/case)", "halo", MONEY_FMT],
    ["Recovery cost (% of Tx+Halo)", "recoveryPct", PCT_FMT],
    ["Inflation (per yr)", "inflation", PCT_FMT],
    ["Discount rate (per yr)", "discount", PCT_FMT],
    ["Halo efficiency", "haloEff", PCT_FMT],
    ["Halo efficiency years", "haloYears", "@"],
    ["Hx step-up", "hxStepUp", PCT_FMT],
    ["Hx step-up years", "hxStepYears", "@"],
    ["Tx step-down", "txStepDown", PCT_FMT],
    ["Tx step-down years", "txStepYears", "@"],
    ["Infra step-up (yrs 2–10)", "infraStepUp", PCT_FMT],
  ];

  rows.forEach((spec, rIdx) => {
    const [label, key, fmt] = spec;
    const r = ws.getRow(4 + rIdx);
    const lbl = r.getCell(1);
    lbl.value = label;
    styleLabelCell(lbl, { bold: true });

    scenarios.forEach((scen, i) => {
      const c = r.getCell(2 + i);
      c.value = SCENARIOS[scen][key];
      if (fmt === "@") {
        c.numFmt = fmt;
        c.alignment = { horizontal: "center" };
        applyBorder(c);
        c.font = { size: 10 };
      } else {
        styleDataCell(c, { fmt });
      }
    });
    if (rIdx % 2 === 1) zebra(r);
  });

  // Description row at bottom
  const descRow = ws.getRow(4 + rows.length + 1);
  descRow.getCell(1).value = "Description";
  styleLabelCell(descRow.getCell(1), { bold: true });
  scenarios.forEach((scen, i) => {
    const c = descRow.getCell(2 + i);
    c.value = SCENARIOS[scen].desc;
    c.alignment = { wrapText: true, vertical: "top" };
    c.font = { size: 9, italic: true, color: { argb: LABEL_GREY } };
    applyBorder(c);
  });
  descRow.height = 80;

  ws.getColumn(1).width = 36;
  scenarios.forEach((_, i) => { ws.getColumn(2 + i).width = 22; });
}

// ───────── MARGIN PROFILE SHEET ─────────
// One consolidated sheet with a block per (scenario × duration × CM), stacked vertically.
// Shows year-by-year blended book margin using per-age solved PMPMs (matches app's blendedMarginProfile).
function buildMarginProfileSheet(wb, {
  scenarios, durations, cms, cachedPricing,
}) {
  const ws = wb.addWorksheet("Margin Profile", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  ws.mergeCells(1, 1, 1, 7);
  const title = ws.getCell(1, 1);
  title.value = "Blended Book Margin Profile";
  title.font = { bold: true, size: 14, color: { argb: BRAND_BLUE } };

  ws.mergeCells(2, 1, 2, 7);
  const sub = ws.getCell(2, 1);
  sub.value = "Year-by-year cohort margin using per-age solved PMPMs, weighted by HLI PH-mix.";
  sub.font = { italic: true, size: 10, color: { argb: LABEL_GREY } };

  let row = 4;

  for (const scen of scenarios) {
    for (const dur of durations) {
      for (const cm of cms) {
        // Section title
        ws.mergeCells(row, 1, row, 7);
        const st = ws.getCell(row, 1);
        st.value = `${scen} — ${dur}Y — ${Math.round(cm * 100)}% target CM`;
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        st.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        st.alignment = { horizontal: "left", vertical: "middle" };
        applyBorder(st);
        ws.getRow(row).height = 20;
        row++;

        // Column headers
        const hdr = ws.getRow(row);
        const headers = ["Year", "Retention %", "Revenue ($/PH)", "Cost ($/PH)", "Margin ($/PH)", "Margin %", "Cum NPV Margin ($/PH)"];
        headers.forEach((h, i) => {
          const c = hdr.getCell(1 + i);
          c.value = h;
          styleHeaderCell(c, { fill: "FF475569" });
        });
        row++;

        // Compute blended margin profile for this (scen, dur, cm)
        const profiles = [];
        for (let age = 15; age <= 80; age++) {
          const wM = PH_M[age] || 0, wF = PH_F[age] || 0;
          if (wM > 0) {
            const pmpm = cachedPricing[`${scen}|${dur}|${cm}|${age}`].male;
            profiles.push({ w: wM, p: computeMarginProfile(age, "M", SCENARIOS[scen], dur, pmpm) });
          }
          if (wF > 0) {
            const pmpm = cachedPricing[`${scen}|${dur}|${cm}|${age}`].female;
            profiles.push({ w: wF, p: computeMarginProfile(age, "F", SCENARIOS[scen], dur, pmpm) });
          }
        }
        const totalW = profiles.reduce((s, x) => s + x.w, 0);

        for (let y = 0; y < dur; y++) {
          let wRev = 0, wCost = 0, wMargin = 0, wCumNPV = 0, wSurv = 0, wMarginPct = 0;
          for (const { w, p } of profiles) {
            if (!p[y]) continue;
            const nw = w / totalW;
            wRev += p[y].revenue * nw;
            wCost += p[y].totalCost * nw;
            wMargin += p[y].margin * nw;
            wCumNPV += p[y].cumNPVMargin * nw;
            wSurv += p[y].survival * nw;
            wMarginPct += p[y].marginPct * nw;
          }

          const rr = ws.getRow(row);
          rr.getCell(1).value = y + 1;
          rr.getCell(1).numFmt = INT_FMT;
          rr.getCell(1).alignment = { horizontal: "center" };
          applyBorder(rr.getCell(1));

          rr.getCell(2).value = wSurv / 100;
          styleDataCell(rr.getCell(2), { fmt: PCT_FMT });

          rr.getCell(3).value = wRev;
          styleDataCell(rr.getCell(3), { fmt: MONEY_FMT });

          rr.getCell(4).value = wCost;
          styleDataCell(rr.getCell(4), { fmt: MONEY_FMT });

          rr.getCell(5).value = wMargin;
          styleDataCell(rr.getCell(5), {
            fmt: MONEY_FMT,
            color: wMargin < 0 ? "FFDC2626" : "FF059669",
            bold: true,
          });

          rr.getCell(6).value = wMarginPct / 100;
          styleDataCell(rr.getCell(6), {
            fmt: PCT_FMT,
            color: wMarginPct < 0 ? "FFDC2626" : "FF059669",
            bold: true,
          });

          rr.getCell(7).value = wCumNPV;
          styleDataCell(rr.getCell(7), {
            fmt: MONEY_FMT,
            color: wCumNPV < 0 ? "FFDC2626" : "FF059669",
          });

          if (y % 2 === 1) zebra(rr);
          row++;
        }
        row++; // blank row between sections
      }
    }
  }

  // Column widths
  ws.getColumn(1).width = 8;
  [2, 3, 4, 5, 6, 7].forEach((c) => { ws.getColumn(c).width = 18; });
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export async function exportPricingWorkbook(config, onProgress) {
  const {
    customer,
    scenarios,        // e.g. ["Base", "Bull", "Bear"]
    durations,        // e.g. [20, 30]
    cms,              // e.g. [0.70, 0.65]
    ageRange,         // { min: 0, max: 85 }
    includeAssumptions,
    includeMargin,
    filename,
  } = config;

  // ── Pre-compute all pricing up front, reporting progress ──
  // Total solves: scenarios × durations × cms × (ageRange span + 1) × 2 genders
  // Plus: scenarios × durations × cms blended (but these just reuse the age-range solves,
  // since PH weights only exist 15-80 — we recompute blended separately from the age grid).
  const ageCount = ageRange.max - ageRange.min + 1;
  const totalSolves =
    scenarios.length * durations.length * cms.length * ageCount * 2 + // per-age grid
    scenarios.length * durations.length * cms.length; // blended summaries

  let done = 0;
  const report = async (n = 1) => {
    done += n;
    if (onProgress) onProgress(done, totalSolves);
    // yield to UI thread every 200 solves
    if (done % 200 === 0) await new Promise((r) => setTimeout(r, 0));
  };

  const cachedPricing = {};  // key: "Scen|dur|cm|age" -> { male, female }
  const cachedBlended = {};  // key: "Scen|dur|cm" -> { blendedPMPM, malePMPM, femalePMPM, ... }

  for (const scen of scenarios) {
    const params = SCENARIOS[scen];
    for (const dur of durations) {
      for (const cm of cms) {
        // Per-age grid (may go outside 15-80 for HLI reference range 0-85)
        for (let age = ageRange.min; age <= ageRange.max; age++) {
          const male = solvePMPM(age, "M", params, dur, cm);
          const female = solvePMPM(age, "F", params, dur, cm);
          cachedPricing[`${scen}|${dur}|${cm}|${age}`] = { male, female };
          await report(2);
        }
        // Blended summary (PH-mix across 15-80)
        cachedBlended[`${scen}|${dur}|${cm}`] = computeBlended(params, dur, cm);
        await report(1);
      }
    }
  }

  // ── Build workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "Need";
  wb.lastModifiedBy = "Need Growth Pricing Framework";
  wb.company = customer || "Need";
  wb.created = new Date();

  buildSummarySheet(wb, { customer, scenarios, durations, cms, cachedBlended });
  for (const scen of scenarios) {
    buildScenarioSheet(wb, {
      scenarioName: scen,
      scenarioParams: SCENARIOS[scen],
      durations,
      cms,
      ageRange,
      cachedBlended,
      cachedPricing,
    });
  }
  if (includeAssumptions) buildAssumptionsSheet(wb, { scenarios });
  if (includeMargin) buildMarginProfileSheet(wb, { scenarios, durations, cms, cachedPricing });

  // ── Save ──
  const buf = await wb.xlsx.writeBuffer();
  const finalName = ensureXlsx(filename || autoFilename(customer));
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), finalName);
}

export { autoFilename, sanitizeFilename, ensureXlsx };
