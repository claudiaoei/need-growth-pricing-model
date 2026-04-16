"use client";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area } from "recharts";
import {
  LAPSE_20YR, LAPSE_30YR, MORT_M, MORT_F, INC_M, INC_F, PH_M, PH_F,
  INFRA_HX_PER_PH_MONTHLY, SCENARIOS,
  parseYears, buildCostCurves, runCohort, solvePMPM, computeMarginProfile,
  getBlendedStats,
} from "./lib/pricingEngine";
import { exportPricingWorkbook, autoFilename, ensureXlsx } from "./lib/exportToExcel";

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
const fmt = (v, d = 2) => v == null || isNaN(v) ? "-" : "$" + v.toFixed(d);
const fmtK = (v) => Math.abs(v) >= 1e6 ? "$" + (v/1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? "$" + (v/1e3).toFixed(0) + "K" : "$" + v.toFixed(0);
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";

function NumInput({ label, value, onChange, step, unit }) {
  const display = Math.round(value * 100) / 100;
  const [local, setLocal] = useState(String(display));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(String(display));
  }, [display, focused]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" value={focused ? local : display}
          onChange={e => {
            setLocal(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const v = parseFloat(local);
            if (!isNaN(v)) onChange(v);
            else setLocal(String(display));
          }}
          step={step || 0.01}
          className="w-24 px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors" />
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

function HeroCMInput({ targetCM, setTargetCM }) {
  const display = Math.round(targetCM * 100);
  const [local, setLocal] = useState(String(display));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocal(String(display));
  }, [display, focused]);

  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Target CM</div>
      <div className="flex items-center gap-1">
        <input type="number" value={focused ? local : display}
          onChange={e => {
            setLocal(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) setTargetCM(Math.max(0, Math.min(100, v)) / 100);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const v = parseFloat(local);
            if (!isNaN(v)) setTargetCM(Math.max(0, Math.min(100, v)) / 100);
            else setLocal(String(display));
          }}
          className="h-9 w-16 bg-slate-800 border border-slate-700 rounded-md px-2 text-sm font-semibold text-slate-200 text-right focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        <span className="text-sm font-semibold text-slate-400">%</span>
      </div>
    </div>
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
    <section id={id} className={`px-6 py-16 md:px-12 lg:px-20 ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
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

// ═══════════════════════════════════════════════════════════════
// EXPORT SECTION
// ═══════════════════════════════════════════════════════════════
const EXPORT_DEFAULTS = {
  scenarios: { Base: true, Bull: true, Bear: true },
  durations: { 3: false, 5: false, 10: false, 15: false, 20: true, 30: true },
  cms: { 0.70: true, 0.65: true },
  ageMin: 0,
  ageMax: 85,
  includeAssumptions: false,
  includeMargin: false,
};
const EXPORT_STORAGE_KEY = "needPricingExportConfig";
const DURATION_OPTIONS = [3, 5, 10, 15, 20, 30];
const CM_OPTIONS = [0.70, 0.65];

function CheckChip({ checked, onChange, label, id }) {
  return (
    <button
      type="button"
      id={id}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-full border transition-all ${
        checked
          ? "bg-blue-500/20 border-blue-400/60 text-blue-200 font-medium"
          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
          checked ? "bg-blue-400 border-blue-300" : "bg-slate-700 border-slate-600"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

function ExportSection({ refCallback }) {
  const [customer, setCustomer] = useState("");
  const [scenarios, setScenarios] = useState(EXPORT_DEFAULTS.scenarios);
  const [durations, setDurations] = useState(EXPORT_DEFAULTS.durations);
  const [cms, setCms] = useState(EXPORT_DEFAULTS.cms);
  const [customCmPct, setCustomCmPct] = useState("");
  const [ageMin, setAgeMin] = useState(EXPORT_DEFAULTS.ageMin);
  const [ageMax, setAgeMax] = useState(EXPORT_DEFAULTS.ageMax);
  const [includeAssumptions, setIncludeAssumptions] = useState(EXPORT_DEFAULTS.includeAssumptions);
  const [includeMargin, setIncludeMargin] = useState(EXPORT_DEFAULTS.includeMargin);
  const [filenameOverride, setFilenameOverride] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);
  const [successName, setSuccessName] = useState(null);
  const hydratedRef = useRef(false);

  // Load persisted prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPORT_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.scenarios) setScenarios({ ...EXPORT_DEFAULTS.scenarios, ...p.scenarios });
        if (p.durations) setDurations({ ...EXPORT_DEFAULTS.durations, ...p.durations });
        if (p.cms) setCms({ ...EXPORT_DEFAULTS.cms, ...p.cms });
        if (typeof p.ageMin === "number") setAgeMin(p.ageMin);
        if (typeof p.ageMax === "number") setAgeMax(p.ageMax);
        if (typeof p.includeAssumptions === "boolean") setIncludeAssumptions(p.includeAssumptions);
        if (typeof p.includeMargin === "boolean") setIncludeMargin(p.includeMargin);
      }
    } catch {}
    hydratedRef.current = true;
  }, []);

  // Persist prefs (excluding customer & filename)
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        EXPORT_STORAGE_KEY,
        JSON.stringify({ scenarios, durations, cms, ageMin, ageMax, includeAssumptions, includeMargin })
      );
    } catch {}
  }, [scenarios, durations, cms, ageMin, ageMax, includeAssumptions, includeMargin]);

  const selectedScenarios = useMemo(() => Object.keys(scenarios).filter(k => scenarios[k]), [scenarios]);
  const selectedDurations = useMemo(
    () => DURATION_OPTIONS.filter(d => durations[d]).sort((a, b) => a - b),
    [durations]
  );
  const selectedCms = useMemo(() => {
    const base = CM_OPTIONS.filter(v => cms[v]);
    const custom = parseFloat(customCmPct);
    if (!isNaN(custom) && custom > 0 && custom < 100) {
      const asFrac = custom / 100;
      if (!base.includes(asFrac)) base.push(asFrac);
    }
    return base.sort((a, b) => b - a); // descending (70% first)
  }, [cms, customCmPct]);

  const autoName = useMemo(() => autoFilename(customer), [customer]);
  const currentFilename = filenameOverride ?? autoName;

  const validation = useMemo(() => {
    const errs = [];
    if (!customer.trim()) errs.push("Enter a customer name");
    if (selectedScenarios.length === 0) errs.push("select at least one scenario");
    if (selectedDurations.length === 0) errs.push("select at least one duration");
    if (selectedCms.length === 0) errs.push("select at least one target CM");
    if (ageMin < 0 || ageMax > 110 || ageMin > ageMax) errs.push("age range is invalid");
    if (!currentFilename.trim()) errs.push("enter a filename");
    return errs;
  }, [customer, selectedScenarios, selectedDurations, selectedCms, ageMin, ageMax, currentFilename]);

  const canDownload = validation.length === 0 && !busy;

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    setSuccessName(null);
    setProgress({ done: 0, total: 0 });
    try {
      await exportPricingWorkbook(
        {
          customer: customer.trim(),
          scenarios: selectedScenarios,
          durations: selectedDurations,
          cms: selectedCms,
          ageRange: { min: ageMin, max: ageMax },
          includeAssumptions,
          includeMargin,
          filename: currentFilename,
        },
        (done, total) => setProgress({ done, total })
      );
      setSuccessName(ensureXlsx(currentFilename));
    } catch (e) {
      setError(e?.message || "Failed to generate workbook");
    } finally {
      setBusy(false);
    }
  };

  const progressPct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <section ref={refCallback} id="export" className="bg-slate-900 text-white px-6 py-16 md:px-12 lg:px-20">
      <div className="max-w-7xl mx-auto">
        <SectionTitle
          label="06 — Export"
          title="Export to Excel"
          subtitle="Generate a cleanly-formatted Excel workbook tailored to the scenarios, durations, and target CMs you select below."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* File name */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Name this file</h3>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. Hanwha Life Insurance"
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors"
              />
            </div>

            {/* Scenarios */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Scenarios</h3>
              <div className="flex flex-wrap gap-2">
                {["Base", "Bull", "Bear"].map(s => (
                  <CheckChip
                    key={s}
                    checked={!!scenarios[s]}
                    onChange={(v) => setScenarios(prev => ({ ...prev, [s]: v }))}
                    label={s}
                    id={`exp-scen-${s}`}
                  />
                ))}
              </div>
            </div>

            {/* Durations */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Service Durations</h3>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map(d => (
                  <CheckChip
                    key={d}
                    checked={!!durations[d]}
                    onChange={(v) => setDurations(prev => ({ ...prev, [d]: v }))}
                    label={`${d}yr`}
                    id={`exp-dur-${d}`}
                  />
                ))}
              </div>
            </div>

            {/* Target CMs */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Target Contribution Margin</h3>
              <div className="flex flex-wrap items-center gap-2">
                {CM_OPTIONS.map(v => (
                  <CheckChip
                    key={v}
                    checked={!!cms[v]}
                    onChange={(checked) => setCms(prev => ({ ...prev, [v]: checked }))}
                    label={`${Math.round(v * 100)}%`}
                    id={`exp-cm-${v}`}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-xs text-slate-500">Custom:</span>
                  <input
                    type="number"
                    value={customCmPct}
                    onChange={(e) => setCustomCmPct(e.target.value)}
                    placeholder="—"
                    min={1}
                    max={99}
                    className="w-16 px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-600 focus:border-blue-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            </div>

            {/* Age range + optional sheets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Age Range</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={ageMin}
                    onChange={(e) => setAgeMin(parseInt(e.target.value) || 0)}
                    min={0}
                    max={110}
                    className="w-20 px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none"
                  />
                  <span className="text-slate-500">–</span>
                  <input
                    type="number"
                    value={ageMax}
                    onChange={(e) => setAgeMax(parseInt(e.target.value) || 0)}
                    min={0}
                    max={110}
                    className="w-20 px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Optional Sheets</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked disabled className="accent-blue-500 opacity-60" />
                    <span>Summary comparison grid</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider ml-auto">always</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked disabled className="accent-blue-500 opacity-60" />
                    <span>Per-scenario pricing tables</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider ml-auto">always</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={includeAssumptions}
                      onChange={(e) => setIncludeAssumptions(e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span>Assumptions detail</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={includeMargin}
                      onChange={(e) => setIncludeMargin(e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span>Margin profile (year-by-year CM)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: filename & download */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 sticky top-20">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Filename</h3>
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={currentFilename}
                  onChange={(e) => setFilenameOverride(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-white focus:border-blue-400 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setFilenameOverride(null)}
                  disabled={filenameOverride === null}
                  title="Reset to auto-generated"
                  className="px-2 py-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                {filenameOverride === null ? "Auto-generated from the name above + current year/month." : "Custom filename. Click ↻ to reset."}
              </p>

              <div className="mt-5 pt-5 border-t border-slate-700/50">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!canDownload}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                      canDownload
                        ? "bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {busy ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span>
                          Generating… {progress.total > 0 && `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        <span>Download Excel</span>
                      </>
                    )}
                  </button>
                  {validation.length > 0 && !busy && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-slate-950 border border-slate-700 text-slate-300 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg">
                      {validation.join(" · ")}
                    </div>
                  )}
                </div>

                {busy && progress.total > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 text-right">{progressPct}%</div>
                  </div>
                )}

                {successName && !busy && (
                  <div className="mt-3 px-3 py-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-md">
                    Downloaded <span className="font-mono">{successName}</span>
                  </div>
                )}
                {error && !busy && (
                  <div className="mt-3 px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-md">
                    {error}
                  </div>
                )}
              </div>

              {/* Export preview summary */}
              <div className="mt-5 pt-5 border-t border-slate-700/50 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between"><span>Tabs:</span>
                  <span className="text-slate-200">{1 + selectedScenarios.length + (includeAssumptions ? 1 : 0) + (includeMargin ? 1 : 0)}</span>
                </div>
                <div className="flex justify-between"><span>Scenarios:</span>
                  <span className="text-slate-200">{selectedScenarios.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between"><span>Durations:</span>
                  <span className="text-slate-200">{selectedDurations.length ? selectedDurations.map(d => `${d}yr`).join(", ") : "—"}</span>
                </div>
                <div className="flex justify-between"><span>Target CMs:</span>
                  <span className="text-slate-200">{selectedCms.length ? selectedCms.map(c => `${Math.round(c * 100)}%`).join(", ") : "—"}</span>
                </div>
                <div className="flex justify-between"><span>Age range:</span>
                  <span className="text-slate-200">{ageMin}–{ageMax}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const SECTIONS = ["model", "pricingprinciples", "assumptions", "data", "pricing", "margin", "export", "howitworks"];
const SECTION_LABELS = ["The Model", "Pricing Principles", "Assumptions", "The Data", "Pricing", "Margin", "Export", "How It Works"];

export default function CancerPricingModel() {
  const [scenario, setScenario] = useState("Base");
  const [modified, setModified] = useState(false);
  const [duration, setDuration] = useState(10);
  const [targetCM, setTargetCM] = useState(0.70);
  const [cohortSize, setCohortSize] = useState(100000);
  const [activeSection, setActiveSection] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [costCurveView, setCostCurveView] = useState("chart");
  const [marginProfileView, setMarginProfileView] = useState("chart");
  const [costPopup, setCostPopup] = useState(null); // { year, field, lines, x, y }
  const [params, setParams] = useState({ ...SCENARIOS["Base"] });
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
      healthyParts.push(`Base: $${params.hx.toFixed(3)}/yr`);
      if (y > 1) healthyParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      else healthyParts.push("Inflation: not applied in Year 1");
      if (y > 1 && params.hxStepUp > 0) {
        const activeYrs = Array.from(hxStepYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) healthyParts.push(`Hx step-up: +${(params.hxStepUp * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }
      healthyParts.push(`Infra: $${c.hxInfra[i].toFixed(2)} (base $${(INFRA_HX_PER_PH_MONTHLY * 12).toFixed(2)}${params.infraStepUp > 0 ? ` + ${(params.infraStepUp * 100).toFixed(0)}% step-up yrs 2–10` : ""} + inflation)`);
      healthyParts.push(`Total: $${c.totalHxCurve[i].toFixed(2)}`);

      const txParts = [];
      txParts.push(`Base: $${params.tx.toFixed(2)}/case`);
      if (y > 1) txParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      else txParts.push("Inflation: not applied in Year 1");
      if (y > 1 && params.txStepDown > 0) {
        const activeYrs = Array.from(txStepYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) txParts.push(`Tx step-down: -${(params.txStepDown * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }
      txParts.push(`Halo component: $${c.haloCurve[i].toFixed(2)}/case`);
      txParts.push(`Infra: $${c.txInfra[i].toFixed(2)}/case`);
      txParts.push(`Total (Tx + Halo + Infra): $${(c.txCurve[i] + c.haloCurve[i] + c.txInfra[i]).toFixed(2)}/case`);

      const haloParts = [];
      haloParts.push(`Component only (service): Halo cost shown separately for transparency`);
      haloParts.push(`Base: $${params.halo.toFixed(2)}/case`);
      if (y > 1) haloParts.push(`Inflation: ${(inf * 100).toFixed(1)}%/yr compounded ${y - 1}yr`);
      else haloParts.push("Inflation: not applied in Year 1");
      if (y > 1 && params.haloEff > 0) {
        const activeYrs = Array.from(haloYrs).filter(yr => yr <= y).sort((a,b) => a - b);
        if (activeYrs.length > 0) haloParts.push(`Halo efficiency: -${(params.haloEff * 100).toFixed(0)}% in yr${activeYrs.length > 1 ? "s" : ""} ${activeYrs.join(", ")}`);
      }
      haloParts.push(`Displayed value: $${c.haloCurve[i].toFixed(2)}/case`);

      const recParts = [];
      recParts.push(`Base recovery service = ${(params.recoveryPct * 100).toFixed(0)}% × (Tx $${c.txCurve[i].toFixed(2)} + Halo $${c.haloCurve[i].toFixed(2)})`);
      if (y === 1) recParts.push("Inflation: not applied in Year 1");
      recParts.push(`Recovery service: $${c.recoveryCurve[i].toFixed(2)}/case`);
      recParts.push(`Infra: $${c.rxInfra[i].toFixed(2)}/case`);
      recParts.push(`Total (Recovery + Infra): $${(c.recoveryCurve[i] + c.rxInfra[i]).toFixed(2)}/case`);

      return {
        year: y,
        healthy: c.totalHxCurve[i],
        treatment: c.txCurve[i] + c.haloCurve[i] + c.txInfra[i],
        halo: c.haloCurve[i],
        recovery: c.recoveryCurve[i] + c.rxInfra[i],
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
  const incidenceData = useMemo(() => Array.from({ length: 66 }, (_, i) => ({ age: 15 + i, male: INC_M[15 + i] * 100, female: INC_F[15 + i] * 100 })), []);
  const lapseData = useMemo(() => LAPSE_30YR.map((v, i) => ({ year: i + 1, "30yr": v * 100, "20yr": (LAPSE_20YR[i] || 0) * 100 })), []);
  const mortalityData = useMemo(() => Array.from({ length: 66 }, (_, i) => ({ age: 15 + i, male: MORT_M[15 + i] * 100, female: MORT_F[15 + i] * 100 })), []);

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
      const lapseRate = (duration <= 20 ? LAPSE_20YR : LAPSE_30YR)[y - 1] || 0.008;
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
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Need Service Period</div>
              <div className="flex gap-1">
                {[3, 5, 10, 15, 20, 30].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`h-9 px-3 text-sm font-semibold rounded-md transition-all ${duration === d ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                    {d}yr
                  </button>
                ))}
              </div>
            </div>
            <HeroCMInput targetCM={targetCM} setTargetCM={setTargetCM} />
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
              { idx: 1, num: "01", title: "Pricing Principles", desc: "Guiding framework" },
              { idx: 2, num: "02", title: "Cost Scenario / Assumptions", desc: "Inputs" },
              { idx: 3, num: "03", title: "Insurer Provided Data (cancer incidence, mortality, lapse rates)", desc: "Inputs" },
              { idx: 4, num: "04", title: "PMPM Table by Age and Gender", desc: "Outputs" },
              { idx: 5, num: "05", title: "Annual CM Over Cohort Life", desc: "Outputs" },
              { idx: 6, num: "06", title: "Export to Excel", desc: "Deliverable" },
              { idx: 7, num: "07", title: "How It Works", desc: "Calculation engine walkthrough" },
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

      {/* ─── SECTION 2: PRICING PRINCIPLES ─── */}
      <section ref={el => sectionRefs.current[1] = el} id="pricingprinciples" className="bg-slate-900 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            label="01 — Pricing Principles"
            title="Pricing principles"
            subtitle="Core principles that guide how we evaluate and structure all upcoming deals."
          />
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-sm font-semibold text-white mb-2">1. We do not want to get a worse deal than the 1st Hanwha deal</h3>
              <p className="text-sm text-slate-300">
                For any upcoming deal, we should target policyholder volumes and contribution margin equal to or above our 1st Hanwha deal.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-sm font-semibold text-white mb-2">2. Need&apos;s pricing framework requires a positive contribution margin at the cohort level. We do not cross-subsidize cohorts (ie ponzi scheme).</h3>
              <p className="text-sm text-slate-300">
                Our revenue from a cohort should be able to cover the cost of policyholders within the cohort throughout the service period.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-sm font-semibold text-white mb-2">3. We can introduce a mechanism to renegotiate prices for years beyond the service period we are comfortable committing to today</h3>
              <p className="text-sm text-slate-300">
                Given the unpredictability of future healthcare/ AI scene, we should explore a mechanism to renegotiate our prices with insurance partner based on refreshed market conditions in at the end of the service period in an effort to match service and benefit periods.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: ASSUMPTIONS ─── */}
      <section ref={el => sectionRefs.current[2] = el} id="assumptions" className="bg-slate-950 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="02 — Assumptions" title="Adjust the assumptions"
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
                <NumInput label="Healthy Mode" value={params.hx} onChange={v => updateParam("hx", v)} step={0.01} unit="$/yr/PH" />
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
                <NumInput label="Infra Step-up % (Yrs 2–10)" value={params.infraStepUp * 100} onChange={v => updateParam("infraStepUp", v / 100)} step={1} unit="%" />
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
              </div>
            </div>
          </div>

          {/* Nx Cost + Case Fee */}
          <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Nx Cost */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Nx Cost</h3>
                <button onClick={() => updateParam("nxCostEnabled", !params.nxCostEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${params.nxCostEnabled ? "bg-blue-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${params.nxCostEnabled ? "translate-x-4" : ""}`} />
                </button>
              </div>
              {params.nxCostEnabled && (
                <div className="mt-3">
                  <NumInput label="Nx Cost" value={params.nxCost} onChange={v => updateParam("nxCost", v)} step={1} unit="$/new PH" />
                </div>
              )}
            </div>

            {/* Case Fee */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Case Fee</h3>
                <button onClick={() => updateParam("caseFeeEnabled", !params.caseFeeEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${params.caseFeeEnabled ? "bg-blue-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${params.caseFeeEnabled ? "translate-x-4" : ""}`} />
                </button>
              </div>
              {params.caseFeeEnabled && (
                <div className="mt-3 grid grid-cols-3 gap-3">
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
                <p className="text-[11px] text-slate-500 mt-0.5">Year 1 uses base costs; inflation compounds from Year 2 onward.</p>
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
                  <Line type="monotone" dataKey="healthy" name="Healthy Total ($/yr/PH, incl. infra)" stroke={chartColors.healthy} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="treatment" name="Treatment Total ($/case, Tx+Halo+infra)" stroke={chartColors.treatment} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="halo" name="Halo Service Component ($/case)" stroke={chartColors.halo} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="recovery" name="Recovery Total ($/case, incl. infra)" stroke={chartColors.recovery} strokeWidth={2} dot={false} />
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
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Healthy Total ($/yr/PH)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Treatment Total ($/case)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Halo Service Component ($/case)</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">Recovery Total ($/case)</th>
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

      {/* ─── SECTION 4: THE DATA ─── */}
      <Section id="data" dark>
        <div ref={el => sectionRefs.current[3] = el} />
        <SectionTitle label="03 — The Data" title="What drives the model"
          subtitle="Three datasets from Hanwha Life Insurance underpin every calculation: how often cancer occurs, how fast policyholders leave, and background mortality. All rates are shown as percentages." />

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
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.toFixed(1) + "%"} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v.toFixed(2) + "%"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
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
                <Legend wrapperStyle={{ fontSize: 10 }} />
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
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.toFixed(1) + "%"} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v.toFixed(3) + "%"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
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

      {/* ─── SECTION 5: PRICING TABLE ─── */}
      <section id="pricing" className="bg-slate-950 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
        <div ref={el => sectionRefs.current[4] = el} />
        <SectionTitle label="04 — The Price" title="PMPM by age and gender"
          subtitle="The monthly premium per member that achieves the target contribution margin over the full Need service period, weighted by HLI's policyholder distribution." />

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
                  <th className="text-right px-4 py-2.5 font-medium text-slate-400">PH Weight</th>
                  <th className="text-right px-4 py-2.5 font-medium text-blue-400">Blended</th>
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
                      <td className="px-4 py-1.5 text-right font-mono text-slate-300">{pct(tot, 2)}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-blue-400 font-medium">{fmt(bl)}</td>
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
        </div>
      </section>

      {/* ─── SECTION 6: COHORT MARGIN ─── */}
      <section ref={el => sectionRefs.current[5] = el} id="margin" className="bg-slate-900 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="05 — The Margin" title="Annual contribution margin over the life of a cohort"
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
                    <th className="px-3 py-2 text-right text-slate-400">Retention %</th>
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

      {/* ─── SECTION 7: EXPORT ─── */}
      <ExportSection refCallback={el => sectionRefs.current[6] = el} />

      {/* ─── SECTION 8: HOW IT WORKS ─── */}
      <section ref={el => sectionRefs.current[7] = el} id="howitworks" className="bg-slate-950 text-white px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="07 — How It Works" title="Calculation engine walkthrough"
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
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-3">
              <p className="text-sm text-slate-400 mb-6">
                Each age/gender gets its own solved PMPM at {pct(params.discount, 0)} discount rate. The blended PMPM
                is the PH-mix weighted average across all cohorts. The equation below traces how blended NPV totals produce the final price.
              </p>

              {/* Equation Row 1: NPV Costs ÷ (1 - CM) = Needed Revenue */}
              <div className="flex items-stretch gap-3 mb-4 flex-wrap">
                <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 min-w-[140px] flex flex-col justify-between">
                  <div className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-1">NPV of Costs</div>
                  <div className="text-lg font-bold text-white font-mono">${traceData.npvCost.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&Sigma; yearCost &times; df</div>
                </div>
                <span className="text-slate-400 text-lg font-light flex items-center">&divide;</span>
                <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 min-w-[100px] flex flex-col justify-between">
                  <div className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-1">1 &minus; CM</div>
                  <div className="text-lg font-bold text-white font-mono">{pct(1 - targetCM, 0)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">1 &minus; {pct(targetCM, 0)}</div>
                </div>
                <span className="text-slate-400 text-lg font-light flex items-center">=</span>
                <div className="bg-slate-900/80 border border-blue-500/30 rounded-lg px-4 py-3 min-w-[140px] flex flex-col justify-between">
                  <div className="text-xs text-blue-300 uppercase tracking-widest font-medium mb-1">Needed Revenue</div>
                  <div className="text-lg font-bold text-blue-300 font-mono">${traceData.neededRevenue.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&nbsp;</div>
                </div>
              </div>

              {/* Equation Row 2: (Needed Revenue - Case Fee) ÷ NPV PH-Years ÷ 12 = PMPM */}
              <div className="flex items-stretch gap-3 mb-4 flex-wrap">
                <div className="bg-slate-900/80 border border-blue-500/30 rounded-lg px-4 py-3 min-w-[140px] flex flex-col justify-between">
                  <div className="text-xs text-blue-300 uppercase tracking-widest font-medium mb-1">{traceData.npvCaseFee > 0 ? "Rev \u2212 Case Fee" : "Needed Revenue"}</div>
                  <div className="text-lg font-bold text-blue-300 font-mono">
                    ${(traceData.neededRevenue - traceData.npvCaseFee).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{traceData.npvCaseFee > 0 ? <>&minus; ${traceData.npvCaseFee.toFixed(2)} case fee</> : <>&nbsp;</>}</div>
                </div>
                <span className="text-slate-400 text-lg font-light flex items-center">&divide;</span>
                <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 min-w-[140px] flex flex-col justify-between">
                  <div className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-1">NPV of PH-Years</div>
                  <div className="text-lg font-bold text-white font-mono">{traceData.npvPHYears.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&Sigma; retention &times; df</div>
                </div>
                <span className="text-slate-400 text-lg font-light flex items-center">&divide;</span>
                <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 flex flex-col justify-between">
                  <div className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-1">Months</div>
                  <div className="text-lg font-bold text-white font-mono">12</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&nbsp;</div>
                </div>
                <span className="text-slate-400 text-lg font-light flex items-center">=</span>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg px-5 py-3 shadow-lg shadow-blue-600/20 flex flex-col justify-between">
                  <div className="text-xs text-blue-100 uppercase tracking-widest font-medium mb-1">Blended PMPM</div>
                  <div className="text-2xl font-bold text-white font-mono">${traceData.pmpm.toFixed(2)}</div>
                  <div className="text-[11px] mt-0.5">&nbsp;</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 mb-4">
                discountFactor[y] = 1 / (1 + {params.discount})<sup>y</sup> &nbsp;&middot;&nbsp; All values are PH-mix weighted averages across 132 age/gender cohorts.
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
                          <td className="px-2 py-1.5 text-right text-slate-500 font-mono">{r.df.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.yearCost.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.yearNPVCost.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-blue-300 font-mono">${r.cumNPVCost.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{r.yearNPVPH.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-blue-300 font-mono">{r.cumNPVPH.toFixed(2)}</td>
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
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              {/* KPI Cards */}
              {(() => {
                const s4 = traceData.step4;
                const yr1 = s4[0];
                const cross = s4.find((d, i) => i > 0 && s4[i - 1].marginPct >= 0 && d.marginPct < 0);
                const finalCum = s4[s4.length - 1].cumNPVMargin;
                const npvRev = s4.reduce((sum, d) => sum + d.revenue / Math.pow(1 + params.discount, d.year), 0);
                const npvCost = s4.reduce((sum, d) => sum + d.cost / Math.pow(1 + params.discount, d.year), 0);
                const npvCM = npvRev > 0 ? ((npvRev - npvCost) / npvRev) * 100 : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-slate-900/70 rounded-lg px-4 py-3 border border-slate-700/50">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Year 1 Margin</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono">{yr1.marginPct.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-900/70 rounded-lg px-4 py-3 border border-slate-700/50">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Lifetime NPV CM</div>
                      <div className={`text-xl font-bold font-mono ${npvCM < 0 ? "text-red-400" : "text-emerald-400"}`}>{npvCM.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-900/70 rounded-lg px-4 py-3 border border-slate-700/50">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">CM Crosses 0%</div>
                      <div className={`text-xl font-bold font-mono ${cross ? "text-red-400" : "text-emerald-400"}`}>
                        {cross ? `Year ${cross.year}` : "Never"}
                      </div>
                    </div>
                    <div className="bg-slate-900/70 rounded-lg px-4 py-3 border border-slate-700/50">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Final Year Margin</div>
                      <div className={`text-xl font-bold font-mono ${s4[s4.length - 1].marginPct < 0 ? "text-red-400" : "text-emerald-400"}`}>{s4[s4.length - 1].marginPct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })()}

              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "15.3%" }} />
                    <col style={{ width: "15.3%" }} />
                    <col style={{ width: "15.3%" }} />
                    <col style={{ width: "15.3%" }} />
                    <col style={{ width: "15.3%" }} />
                    <col style={{ width: "15.3%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-2 text-left text-slate-500">Year</th>
                      <th className="px-2 py-2 text-right text-slate-500">Retention</th>
                      <th className="px-2 py-2 text-right text-slate-500">Revenue</th>
                      <th className="px-2 py-2 text-right text-slate-500">Incidence (%)</th>
                      <th className="px-2 py-2 text-right text-slate-500">Cost</th>
                      <th className="px-2 py-2 text-right text-slate-500">Margin</th>
                      <th className="px-2 py-2 text-right text-slate-500">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceData.step4.filter((_, i) => i < 10 || (i + 1) % 5 === 0).map(r => {
                      return (
                        <tr key={r.year} className="border-b border-slate-800/50">
                          <td className="px-2 py-1.5 text-slate-300 font-medium">{r.year}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{(r.survival * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.revenue.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{(traceData.step2[r.year - 1].incRate * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right text-slate-400 font-mono">${r.cost.toFixed(2)}</td>
                          <td className={`px-2 py-1.5 text-right font-mono ${r.margin < 0 ? "text-red-400" : "text-emerald-400"}`}>${r.margin.toFixed(2)}</td>
                          <td className={`px-2 py-1.5 text-right font-mono font-medium ${r.marginPct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {r.marginPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-600 mt-3">All values are PH-mix weighted averages per policyholder. Margin % = weighted avg of per-age CMs.</p>
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
