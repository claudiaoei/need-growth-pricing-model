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
// 1-based column index → Excel column letter (1 → "A", 27 → "AA")
function colLetter(colIdx) {
  let s = "";
  let n = colIdx;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Build an absolute cross-sheet reference, e.g. "'Base case'!$C$5"
function sheetRef(sheetName, col, row) {
  return `'${sheetName}'!$${colLetter(col)}$${row}`;
}

// Build an absolute cross-sheet range ref, e.g. "'Base case'!$C$27:$C$92"
function sheetRangeRef(sheetName, col, row1, row2) {
  const L = colLetter(col);
  return `'${sheetName}'!$${L}$${row1}:$${L}$${row2}`;
}

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

// ───────── LAYOUT HELPER ─────────
// Computes the shared geometry used by the PH Weights / Scenario / Summary sheets
// so the cross-sheet formulas all line up on the same rows & columns.
//
// Scenario sheet layout (per CM block):
//   row 1               → title ("<Scen> case (<CM>% CM)")
//   rows 2..topBlockEnd → top block with 3 rows per duration (Blended / Male / Female),
//                         durations sorted descending to match the HLI reference
//   row bandRow         → "Growth Pricing Framework" band (dynamic, sits one row
//                         below the top block so it never collides with content)
//   rows bandRow+1..+2  → column headers (Duration-group / Age / Male / Female)
//   rows gridFirstRow.. → per-age pricing grid (one row per age in ageRange)
//
// PH Weights sheet layout:
//   row 1          → headers
//   rows 2..       → one row per age in the intersection of [15, 80] and ageRange
//   phTotalsRow    → SUM totals (=SUM(col2:colLast))
//   phPctRow       → share-of-book (=colTotal / $D$totalsRow)
function buildLayout(durations, cms, ageRange) {
  const blockWidth = 1 + durations.length * 2; // Age + (M,F) per duration
  const blockGap = 1;
  const stride = blockWidth + blockGap;

  // Top block: 3 rows per duration, starting at row 2. Sorted descending for display.
  const sortedDurs = [...durations].sort((a, b) => b - a);
  const topBlockLastRow = 1 + sortedDurs.length * 3;         // e.g. 2 durs → row 7
  const bandRow = topBlockLastRow + 2;                        // leave a blank row, then band
  const headerRowDur = bandRow + 1;                           // duration-group + Age
  const headerRowGender = bandRow + 2;                        // Male / Female
  const gridFirstRow = bandRow + 3;                           // first age row

  // PH Weights geometry (ages are clipped to 15-80 intersection with user range)
  const phMinAge = Math.max(15, ageRange.min);
  const phMaxAge = Math.min(80, ageRange.max);
  const phCount = Math.max(0, phMaxAge - phMinAge + 1);
  const phFirstRow = 2;
  const phLastRow = phFirstRow + phCount - 1;
  const phTotalsRow = phLastRow + 1;
  const phPctRow = phLastRow + 2;

  // Row in scenario per-age grid that corresponds to each age in the PH Weights slice
  const gridRowForAge = (age) => gridFirstRow + (age - ageRange.min);
  const gridFirstAgeRow = gridRowForAge(phMinAge);
  const gridLastAgeRow = gridRowForAge(phMaxAge);

  // Column helpers for the scenario tab's per-CM blocks
  const startColForCm = (cmIdx) => 1 + cmIdx * stride;
  const valueColForCm = (cmIdx) => startColForCm(cmIdx) + 2; // top block value column
  const maleGridCol = (cmIdx, durIdx) => startColForCm(cmIdx) + 1 + durIdx * 2;
  const femaleGridCol = (cmIdx, durIdx) => maleGridCol(cmIdx, durIdx) + 1;

  // Row helpers for the top block (sorted-descending)
  const blendedRowForSorted = (sIdx) => 2 + sIdx * 3;
  const maleRowForSorted = (sIdx) => blendedRowForSorted(sIdx) + 1;
  const femaleRowForSorted = (sIdx) => blendedRowForSorted(sIdx) + 2;

  return {
    blockWidth, blockGap, stride, sortedDurs,
    topBlockLastRow, bandRow, headerRowDur, headerRowGender, gridFirstRow,
    phMinAge, phMaxAge, phCount, phFirstRow, phLastRow, phTotalsRow, phPctRow,
    gridFirstAgeRow, gridLastAgeRow, gridRowForAge,
    startColForCm, valueColForCm, maleGridCol, femaleGridCol,
    blendedRowForSorted, maleRowForSorted, femaleRowForSorted,
  };
}

// ───────── PH WEIGHTS SHEET ─────────
// Provides transparent PH-mix inputs that drive every blended/weighted figure in
// the workbook. The customer can change any weight and every SUMPRODUCT /
// share-of-book formula will recompute automatically.
function buildPHWeightsSheet(wb, { ageRange, layout }) {
  const ws = wb.addWorksheet("PH Weights", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Title row merged across the header area (visible above frozen row? actually
  // we put title into a separate row by adjusting — keep it simple: row 1 = headers)
  ["Age", "Male PH Mix", "Female PH Mix", "Total PH Mix"].forEach((h, i) => {
    const c = ws.getRow(1).getCell(1 + i);
    c.value = h;
    styleHeaderCell(c, { fill: BRAND_BLUE });
  });

  const { phMinAge, phMaxAge, phFirstRow, phLastRow, phTotalsRow, phPctRow } = layout;

  for (let age = phMinAge; age <= phMaxAge; age++) {
    const rowIdx = phFirstRow + (age - phMinAge);
    const r = ws.getRow(rowIdx);

    const ageC = r.getCell(1);
    ageC.value = age;
    ageC.numFmt = INT_FMT;
    ageC.font = { bold: true, size: 10, color: { argb: LABEL_GREY } };
    ageC.alignment = { horizontal: "center" };
    applyBorder(ageC);

    const mC = r.getCell(2);
    mC.value = PH_M[age] || 0;
    mC.numFmt = "0.0000%";
    mC.alignment = { horizontal: "right" };
    mC.font = { size: 10 };
    applyBorder(mC);

    const fC = r.getCell(3);
    fC.value = PH_F[age] || 0;
    fC.numFmt = "0.0000%";
    fC.alignment = { horizontal: "right" };
    fC.font = { size: 10 };
    applyBorder(fC);

    const tC = r.getCell(4);
    tC.value = { formula: `B${rowIdx}+C${rowIdx}`, result: (PH_M[age] || 0) + (PH_F[age] || 0) };
    tC.numFmt = "0.0000%";
    tC.alignment = { horizontal: "right" };
    tC.font = { size: 10, italic: true, color: { argb: LABEL_GREY } };
    applyBorder(tC);

    if ((age - phMinAge) % 2 === 1) zebra(r);
  }

  // Totals row
  const totalsRow = ws.getRow(phTotalsRow);
  const lblT = totalsRow.getCell(1);
  lblT.value = "Total";
  lblT.font = { bold: true, size: 10 };
  lblT.alignment = { horizontal: "left" };
  lblT.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  applyBorder(lblT);
  for (let c = 2; c <= 4; c++) {
    const cell = totalsRow.getCell(c);
    const L = colLetter(c);
    cell.value = { formula: `SUM(${L}${phFirstRow}:${L}${phLastRow})` };
    cell.numFmt = "0.0000%";
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    applyBorder(cell);
  }

  // % of book row
  const pctRow = ws.getRow(phPctRow);
  const lblP = pctRow.getCell(1);
  lblP.value = "% of book";
  lblP.font = { bold: true, size: 10, color: { argb: SECTION_TITLE_RED } };
  lblP.alignment = { horizontal: "left" };
  applyBorder(lblP);
  for (let c = 2; c <= 4; c++) {
    const cell = pctRow.getCell(c);
    const L = colLetter(c);
    cell.value = { formula: `${L}${phTotalsRow}/$D$${phTotalsRow}` };
    cell.numFmt = "0.0%";
    cell.font = { bold: true, size: 10, color: { argb: SECTION_TITLE_RED } };
    cell.alignment = { horizontal: "right" };
    applyBorder(cell);
  }

  // Note row
  const noteRow = ws.getRow(phPctRow + 2);
  ws.mergeCells(phPctRow + 2, 1, phPctRow + 2, 4);
  const note = noteRow.getCell(1);
  note.value = "Source of truth for every age-weighted and blended figure in this workbook. "
    + "Change any weight and the scenario tabs + Summary tab will recompute automatically.";
  note.font = { italic: true, size: 9, color: { argb: LABEL_GREY } };
  note.alignment = { wrapText: true, vertical: "top" };
  noteRow.height = 32;

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
}

// ───────── SUMMARY SHEET ─────────
// Rebuilds the HLI 2026.4 "Summary" sheet layout:
//   Row: [label] [Scenario 1] [Scenario 2] ... (one col per scenario × CM)
//   Rows: HLI 20Y, HLI 30Y, optional HLI blended (55% 20Y / 45% 30Y)
//
// Every data cell is a cross-sheet formula pointing at the corresponding scenario
// tab's Blended PMPM cell — so Summary → scenario tab → PH Weights is one audit chain.
function buildSummarySheet(wb, {
  customer, scenarios, durations, cms, cachedBlended, layout,
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

  // Data rows: one per duration. Each cell = cross-sheet ref to the scenario
  // tab's Blended PMPM cell for that (scenario, duration, CM).
  //
  // Summary row geometry so the 55/45 row can reference these rows by letter:
  //   Row (6 + durations.indexOf(d)) = HLI dY
  const summaryRowForDur = new Map();
  let rowIdx = 6;
  for (const dur of durations) {
    summaryRowForDur.set(dur, rowIdx);
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

    const sIdx = layout.sortedDurs.indexOf(dur);
    const blendedRow = layout.blendedRowForSorted(sIdx);

    for (const scen of scenarios) {
      for (const cm of cms) {
        const cmIdx = cms.indexOf(cm);
        const valueCol = layout.valueColForCm(cmIdx);
        const sheetName = `${scen} case`;
        const c = r.getCell(colMap.get(`${scen}|${cm}`));
        const precomputed = cachedBlended[`${scen}|${dur}|${cm}`].blendedPMPM;
        c.value = { formula: sheetRef(sheetName, valueCol, blendedRow), result: precomputed };
        styleDataCell(c, { fmt: MONEY_FMT, bold: true });
      }
    }
    r.height = 36;
    rowIdx++;
  }

  // Optional 55/45 HLI-blended row (only when both 20Y and 30Y are selected).
  // Uses a local formula against the 20Y / 30Y rows in the same Summary sheet.
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

    const row20 = summaryRowForDur.get(20);
    const row30 = summaryRowForDur.get(30);

    for (const scen of scenarios) {
      for (const cm of cms) {
        const c = r.getCell(colMap.get(`${scen}|${cm}`));
        const colIdx = colMap.get(`${scen}|${cm}`);
        const L = colLetter(colIdx);
        const v20 = cachedBlended[`${scen}|20|${cm}`].blendedPMPM;
        const v30 = cachedBlended[`${scen}|30|${cm}`].blendedPMPM;
        c.value = {
          formula: `0.55*${L}${row20}+0.45*${L}${row30}`,
          result: 0.55 * v20 + 0.45 * v30,
        };
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
// Mirrors HLI 2026.4 "Base case" sheet layout with key upgrades for auditability:
//   • Top block row count scales with `durations.length`, and the "Growth Pricing
//     Framework" band sits just below it (no fixed row 9 → no content collision).
//   • Top-block Male / Female values are SUMPRODUCT formulas over the per-age grid
//     weighted by 'PH Weights' — relabeled to make it clear they are age-weighted
//     gender averages, not gender×overall-book blends.
//   • Top-block Blended PMPM value is ('PH Weights'!$B$69 × Male_avg) +
//     ('PH Weights'!$C$69 × Female_avg) — no hardcoded aggregation.
//   • Per-age grid cells remain hardcoded (they are the NPV-solver's output and
//     would otherwise require re-implementing the solver in Excel).
function buildScenarioSheet(wb, {
  scenarioName, durations, cms, ageRange, cachedBlended, cachedPricing, layout,
}) {
  const {
    blockWidth, blockGap, sortedDurs,
    bandRow, headerRowDur, headerRowGender, gridFirstRow,
    phFirstRow, phLastRow, phTotalsRow, phPctRow,
    gridFirstAgeRow, gridLastAgeRow,
    startColForCm, valueColForCm, maleGridCol, femaleGridCol,
    blendedRowForSorted, maleRowForSorted, femaleRowForSorted,
  } = layout;

  const ws = wb.addWorksheet(`${scenarioName} case`, {
    views: [{ state: "frozen", ySplit: headerRowGender, xSplit: 1 }],
  });

  // ── Top block: blended summary per CM (now a formula block) ──
  cms.forEach((cm, cmIdx) => {
    const startCol = startColForCm(cmIdx);
    const valueCol = valueColForCm(cmIdx);
    const valueColLetter = colLetter(valueCol);

    // Title at row 1
    ws.mergeCells(1, startCol, 1, startCol + 2);
    const title = ws.getCell(1, startCol);
    title.value = `${scenarioName} case (${Math.round(cm * 100)}% CM)`;
    title.font = { bold: true, size: 12, color: { argb: SECTION_TITLE_RED } };
    title.alignment = { horizontal: "left", vertical: "middle" };

    const b = cachedBlended[`${scenarioName}|${durations[0]}|${cm}`];
    const malePct = Math.round(b.maleWeight * 100);
    const femalePct = Math.round(b.femaleWeight * 100);

    sortedDurs.forEach((dur, sIdx) => {
      const durIdx = durations.indexOf(dur);
      const mCol = maleGridCol(cmIdx, durIdx);
      const fCol = femaleGridCol(cmIdx, durIdx);

      const blendedRow = blendedRowForSorted(sIdx);
      const maleRow = maleRowForSorted(sIdx);
      const femaleRow = femaleRowForSorted(sIdx);

      const precomp = cachedBlended[`${scenarioName}|${dur}|${cm}`];

      // Labels (col 1 = duration tag, col 2 = descriptive label)
      const setDurLabel = (r) => {
        const c = ws.getRow(r).getCell(startCol);
        c.value = `${dur}Y`;
        c.font = { bold: true, size: 10 };
        c.alignment = { horizontal: "left" };
      };
      const setDescLabel = (r, text, bold = false, color = "FF0F172A") => {
        const c = ws.getRow(r).getCell(startCol + 1);
        c.value = text;
        c.font = { bold, size: 10, color: { argb: color } };
        c.alignment = { horizontal: "left" };
      };

      setDurLabel(blendedRow);
      setDescLabel(blendedRow, "Blended PMPM", true);

      setDurLabel(maleRow);
      setDescLabel(maleRow, `Male (age-weighted · ${malePct}% of mix)`);

      setDurLabel(femaleRow);
      setDescLabel(femaleRow, `Female (age-weighted · ${femalePct}% of mix)`);

      // Male age-weighted avg = SUMPRODUCT(PH male weights, grid male column) / total male weight
      const maleRange = sheetRangeRef(`${scenarioName} case`, mCol, gridFirstAgeRow, gridLastAgeRow);
      const maleFormula =
        `SUMPRODUCT('PH Weights'!$B$${phFirstRow}:$B$${phLastRow},${maleRange})`
        + `/'PH Weights'!$B$${phTotalsRow}`;
      const maleCell = ws.getRow(maleRow).getCell(valueCol);
      maleCell.value = { formula: maleFormula, result: precomp.malePMPM };
      styleDataCell(maleCell, { fmt: MONEY_FMT });

      const femaleRange = sheetRangeRef(`${scenarioName} case`, fCol, gridFirstAgeRow, gridLastAgeRow);
      const femaleFormula =
        `SUMPRODUCT('PH Weights'!$C$${phFirstRow}:$C$${phLastRow},${femaleRange})`
        + `/'PH Weights'!$C$${phTotalsRow}`;
      const femaleCell = ws.getRow(femaleRow).getCell(valueCol);
      femaleCell.value = { formula: femaleFormula, result: precomp.femalePMPM };
      styleDataCell(femaleCell, { fmt: MONEY_FMT });

      // Blended PMPM = ph_male_share × male_avg + ph_female_share × female_avg
      const blendedFormula =
        `'PH Weights'!$B$${phPctRow}*${valueColLetter}${maleRow}`
        + `+'PH Weights'!$C$${phPctRow}*${valueColLetter}${femaleRow}`;
      const blendedCell = ws.getRow(blendedRow).getCell(valueCol);
      blendedCell.value = { formula: blendedFormula, result: precomp.blendedPMPM };
      styleDataCell(blendedCell, { fmt: MONEY_FMT, bold: true, color: BRAND_BLUE });
    });
  });

  // ── Section band: "Growth Pricing Framework" (dynamic row) ──
  cms.forEach((cm, cmIdx) => {
    const startCol = startColForCm(cmIdx);
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

  // ── Column headers: Duration-group / Age / Male / Female ──
  cms.forEach((cm, cmIdx) => {
    const startCol = startColForCm(cmIdx);
    const gHeader = ws.getRow(headerRowGender);

    // Age column spans both header rows
    ws.mergeCells(headerRowDur, startCol, headerRowGender, startCol);
    const ageCell = ws.getCell(headerRowDur, startCol);
    ageCell.value = "Age";
    styleHeaderCell(ageCell, { fill: BRAND_BLUE });

    durations.forEach((dur, dIdx) => {
      const col = startCol + 1 + dIdx * 2;
      ws.mergeCells(headerRowDur, col, headerRowDur, col + 1);
      const dCell = ws.getCell(headerRowDur, col);
      dCell.value = `${dur}-Year Policy`;
      styleHeaderCell(dCell, { fill: BRAND_BLUE_LIGHT });

      const mCell = gHeader.getCell(col);
      mCell.value = "Male";
      styleHeaderCell(mCell, { fill: "FF60A5FA", fontColor: "FFFFFFFF" });
      const fCell = gHeader.getCell(col + 1);
      fCell.value = "Female";
      styleHeaderCell(fCell, { fill: "FFF472B6", fontColor: "FFFFFFFF" });
    });
  });
  ws.getRow(headerRowDur).height = 20;
  ws.getRow(headerRowGender).height = 20;

  // ── Data rows: per age (hardcoded — foundation of every upstream formula) ──
  const firstAge = ageRange.min;
  const lastAge = ageRange.max;
  let row = gridFirstRow;
  for (let age = firstAge; age <= lastAge; age++) {
    const rr = ws.getRow(row);
    cms.forEach((cm, cmIdx) => {
      const startCol = startColForCm(cmIdx);
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
    if ((row - gridFirstRow) % 2 === 1) zebra(rr);
    row++;
  }

  // ── Column widths ──
  const totalCols = cms.length * blockWidth + (cms.length - 1) * blockGap;
  for (let c = 1; c <= totalCols; c++) {
    const modWithinBlock = (c - 1) % (blockWidth + blockGap);
    if (modWithinBlock === 0) ws.getColumn(c).width = 8;
    else if (modWithinBlock === blockWidth) ws.getColumn(c).width = 2;
    else if (modWithinBlock === 1) ws.getColumn(c).width = 26; // description label col (shared with first-dur Male grid col)
    else if (modWithinBlock === 2) ws.getColumn(c).width = 13; // value col (shared with first-dur Female grid col)
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

  ws.mergeCells(1, 1, 1, 6);
  const title = ws.getCell(1, 1);
  title.value = "Blended Book Margin Profile";
  title.font = { bold: true, size: 14, color: { argb: BRAND_BLUE } };

  ws.mergeCells(2, 1, 2, 6);
  const sub = ws.getCell(2, 1);
  sub.value = "Year-by-year cohort margin using per-age solved PMPMs, weighted by HLI PH-mix.";
  sub.font = { italic: true, size: 10, color: { argb: LABEL_GREY } };

  let row = 4;

  for (const scen of scenarios) {
    for (const dur of durations) {
      for (const cm of cms) {
        ws.mergeCells(row, 1, row, 6);
        const st = ws.getCell(row, 1);
        st.value = `${scen} — ${dur}Y — ${Math.round(cm * 100)}% target CM`;
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        st.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        st.alignment = { horizontal: "left", vertical: "middle" };
        applyBorder(st);
        ws.getRow(row).height = 20;
        row++;

        const hdr = ws.getRow(row);
        const headers = ["Year", "Retention %", "Revenue ($/PH)", "Cost ($/PH)", "Margin ($/PH)", "Margin %"];
        headers.forEach((h, i) => {
          const c = hdr.getCell(1 + i);
          c.value = h;
          styleHeaderCell(c, { fill: "FF475569" });
        });
        row++;

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
          let wRev = 0, wCost = 0, wMargin = 0, wSurv = 0, wMarginPct = 0;
          for (const { w, p } of profiles) {
            if (!p[y]) continue;
            const nw = w / totalW;
            wRev += p[y].revenue * nw;
            wCost += p[y].totalCost * nw;
            wMargin += p[y].margin * nw;
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

          if (y % 2 === 1) zebra(rr);
          row++;
        }
        row++;
      }
    }
  }

  ws.getColumn(1).width = 8;
  [2, 3, 4, 5, 6].forEach((c) => { ws.getColumn(c).width = 18; });
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

  // Shared geometry used by Summary / Scenario / PH Weights so all cross-sheet
  // formulas reference the same rows & columns.
  const layout = buildLayout(durations, cms, ageRange);

  buildSummarySheet(wb, { customer, scenarios, durations, cms, cachedBlended, layout });
  for (const scen of scenarios) {
    buildScenarioSheet(wb, {
      scenarioName: scen,
      durations,
      cms,
      ageRange,
      cachedBlended,
      cachedPricing,
      layout,
    });
  }
  buildPHWeightsSheet(wb, { ageRange, layout });
  if (includeAssumptions) buildAssumptionsSheet(wb, { scenarios });
  if (includeMargin) buildMarginProfileSheet(wb, { scenarios, durations, cms, cachedPricing });

  // ── Save ──
  const buf = await wb.xlsx.writeBuffer();
  const finalName = ensureXlsx(filename || autoFilename(customer));
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), finalName);
}

export { autoFilename, sanitizeFilename, ensureXlsx };
