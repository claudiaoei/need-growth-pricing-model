// Smoke test for the Excel export pipeline.
//   - Runs the full workbook generator end-to-end
//   - Reloads the output workbook via ExcelJS to inspect cells
//   - Verifies: PH Weights sheet structure, scenario tab dynamic band row,
//     formula strings for top-block Male/Female/Blended, Summary cross-sheet refs,
//     Margin Profile column count (should be 6, no Cum NPV)
//
// Run:  node --experimental-vm-modules scripts/smoke-export.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../tmp-smoke.xlsx");

// The export module ends in `saveAs(new Blob(...))`. We shim file-saver via
// the ESM loader; we also intercept `new Blob(...)` here to persist the bytes.
globalThis.Blob = class Blob {
  constructor(parts) {
    const chunks = parts.map((p) => (p instanceof ArrayBuffer ? Buffer.from(p) : Buffer.from(p)));
    this._buf = Buffer.concat(chunks);
    fs.writeFileSync(outPath, this._buf);
  }
};

const mod = await import("../src/app/lib/exportToExcel.js");
const engine = await import("../src/app/lib/pricingEngine.js");

const config = {
  customer: "Hanwha Life",
  scenarios: ["Base", "Bull", "Bear"],
  durations: [20, 30],
  cms: [0.70, 0.65],
  ageRange: { min: 0, max: 85 },
  includeAssumptions: true,
  includeMargin: true,
  filename: "tmp-smoke.xlsx",
};

console.log("Running export pipeline …");
const t0 = Date.now();
await mod.exportPricingWorkbook(config, (done, total) => {
  if (done % 500 === 0 || done === total) {
    process.stdout.write(`  ${done}/${total} solves\r`);
  }
});
console.log(`\nExported in ${Date.now() - t0}ms → ${outPath}`);

// ────── Reload the output workbook and inspect ──────
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.readFile(outPath);

function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

const phWS = wb2.getWorksheet("PH Weights");
assert(phWS, "PH Weights sheet exists");
assert(phWS.getCell("A1").value === "Age", "PH Weights A1 = Age");
assert(phWS.getCell("A2").value === 15, "PH Weights A2 = 15 (first age)");
assert(phWS.getCell("A67").value === 80, "PH Weights A67 = 80 (last age)");
const totalMale = phWS.getCell("B68");
assert(totalMale.formula && totalMale.formula.startsWith("SUM("), `PH Weights B68 is SUM formula (got ${JSON.stringify(totalMale.value)})`);
const pctMale = phWS.getCell("B69");
assert(pctMale.formula && pctMale.formula.includes("B68/"), `PH Weights B69 is share formula (got ${JSON.stringify(pctMale.value)})`);

const baseWS = wb2.getWorksheet("Base case");
assert(baseWS, "Base case sheet exists");
// With 2 durations, band row = 3*2 + 3 = 9
const bandCell = baseWS.getCell("A9");
assert(bandCell.value === "Growth Pricing Framework", `Band row A9 = 'Growth Pricing Framework' (got ${JSON.stringify(bandCell.value)})`);

// Top block: with sortedDurs [30, 20], row 2 = 30Y Blended PMPM, row 5 = 20Y Blended PMPM
// Value column for CM block 0 (70%) = C
const blended30 = baseWS.getCell("C2");
assert(blended30.formula && blended30.formula.includes("'PH Weights'!$B$69") && blended30.formula.includes("'PH Weights'!$C$69"),
  `C2 (30Y Blended PMPM) is a ph-share weighted formula (got ${JSON.stringify(blended30.value)})`);

const male30 = baseWS.getCell("C3");
assert(male30.formula && male30.formula.startsWith("SUMPRODUCT('PH Weights'!$B$2:$B$67"),
  `C3 (30Y Male age-weighted) is a SUMPRODUCT formula (got ${JSON.stringify(male30.value)})`);

const female20 = baseWS.getCell("C7");
assert(female20.formula && female20.formula.startsWith("SUMPRODUCT('PH Weights'!$C$2:$C$67"),
  `C7 (20Y Female age-weighted) is a SUMPRODUCT formula (got ${JSON.stringify(female20.value)})`);

// Check labels
assert(baseWS.getCell("B3").value?.includes?.("age-weighted") && baseWS.getCell("B3").value?.includes?.("% of mix"),
  `B3 label mentions age-weighted and % of mix (got ${JSON.stringify(baseWS.getCell("B3").value)})`);

// Summary sheet: cross-sheet refs
const summaryWS = wb2.getWorksheet("Summary");
assert(summaryWS, "Summary sheet exists");
// Row 6 = HLI 20Y, col B = first scenario×cm (Base 70%)
// 20Y blended PMPM on Base case is at C5 (sortedDurs.indexOf(20) = 1, row = 2+1*3 = 5)
const sumB6 = summaryWS.getCell("B6");
assert(sumB6.formula && sumB6.formula.includes("'Base case'!$C$5"),
  `Summary B6 (20Y Base 70%) = 'Base case'!$C$5 (got ${JSON.stringify(sumB6.value)})`);

const sumB7 = summaryWS.getCell("B7");
assert(sumB7.formula && sumB7.formula.includes("'Base case'!$C$2"),
  `Summary B7 (30Y Base 70%) = 'Base case'!$C$2 (got ${JSON.stringify(sumB7.value)})`);

// HLI blended (55/45) row should reference B6 & B7 locally
const sumB8 = summaryWS.getCell("B8");
assert(sumB8.formula && sumB8.formula.includes("B6") && sumB8.formula.includes("B7"),
  `Summary B8 (HLI blended 55/45) references B6 & B7 locally (got ${JSON.stringify(sumB8.value)})`);

// Margin Profile should have 6 headers, no Cum NPV
const mpWS = wb2.getWorksheet("Margin Profile");
assert(mpWS, "Margin Profile sheet exists");
const hdr5 = mpWS.getCell("E5").value;
const hdr6 = mpWS.getCell("F5").value;
const hdr7 = mpWS.getCell("G5").value;
assert(hdr5 === "Margin ($/PH)", `Margin Profile E5 = 'Margin ($/PH)' (got ${JSON.stringify(hdr5)})`);
assert(hdr6 === "Margin %", `Margin Profile F5 = 'Margin %' (got ${JSON.stringify(hdr6)})`);
assert(!hdr7 || hdr7 === "", `Margin Profile G5 is blank (no Cum NPV column, got ${JSON.stringify(hdr7)})`);

// ────── Numeric sanity: reconstruct the blended formula and compare to engine ──────
// For Base 70% 20Y: formula = PH_male_share × Male_avg + PH_female_share × Female_avg
// Where Male_avg = SUMPRODUCT(PH_M weights, per-age male PMPM) / sum(PH_M weights).
// We already have the precomputed `result` on the formula cells.
const expectedBase2070 = engine.computeBlended(engine.SCENARIOS.Base, 20, 0.70).blendedPMPM;
const actualPrecomp = blended30.result ?? null; // C2 is 30Y, not 20Y — use C5
const actualPrecomp20 = baseWS.getCell("C5").result ?? null;
console.log(`\nExpected Base 20Y 70% blendedPMPM = ${expectedBase2070.toFixed(4)}`);
console.log(`Workbook precomputed result     = ${actualPrecomp20?.toFixed?.(4) ?? actualPrecomp20}`);
assert(Math.abs(actualPrecomp20 - expectedBase2070) < 0.01,
  `Base 20Y 70% precomputed result matches engine within $0.01`);

console.log("\nSmoke test complete.");
