# Growth Pricing Framework — Need × Hanwha Life Insurance

An interactive pricing model that calculates the per-member-per-month (PMPM) price for Need's AI-powered cancer prevention service embedded in Hanwha Life Insurance (HLI) policies.

## What This Does

Need provides cancer prevention services (screening, monitoring, AI-powered tools) to HLI policyholders. This tool models the economics of that partnership — projecting costs, survival, and revenue over the life of a cancer insurance policy to solve for the monthly price HLI should charge each member.

The model produces results identical to the reference Excel spreadsheet (v63_CF) — verified to 0.00% variance across all ages and durations.

## Key Concepts

### PMPM (Per Member Per Month)
The monthly price charged per policyholder. The model solves for the PMPM that achieves a target contribution margin over the full policy term. Each age/gender cohort gets its own solved PMPM; the "blended PMPM" is the weighted average across HLI's actual policyholder distribution.

### Cost Structure — Three Modes
- **Hx (Healthy Mode)**: Per-member cost of cancer prevention — charged for every policyholder, every year. Base cost is monthly (`$/mo/PH`), annualized internally (`×12`).
- **Tx (Treatment)**: Per-case cost when a policyholder is diagnosed with cancer — includes treatment and Halo (follow-up care). Only triggered by diagnosis.
- **Rx (Recovery)**: Recovery support cost — calculated as a percentage of (Treatment + Halo).

Each mode includes both service costs and infrastructure costs (cloud, compute, vendor fees). All costs compound annually with inflation, plus any scenario-specific step-ups or step-downs.

### Contribution Margin (CM)
Annual CM% = (Revenue − Cost) / Revenue for each year. The blended CM% is the PH-mix weighted average of per-age spot CMs (not margin-of-the-blend). This matches Excel's `CM calc` sheet methodology.

### Policyholder (PH) Distribution
HLI's actual book: ages 15–80, approximately 60% female / 40% male, with 132 age/gender cohorts. Weights sum to 1.0.

## Scenarios

| Scenario | Description |
|---|---|
| **Base – July 2025** | Original baseline from July 2025 pricing engagement. |
| **Base – April 2026** | Updated baseline linked to actual COGS as of April 2026. Lower Recovery utilization (10%) based on observed data. |
| **AI Acceleration** | AI advances reduce Treatment costs 10%/yr in years 2–7 and double Halo efficiency to 20%, starting in year 2. |
| **Healthy Mode Investment** | Increased investment in cancer prevention — Healthy Mode costs grow 15% above inflation in years 2–5, then stabilizes. |
| **Infra Costs Up** | Rising compute and cloud costs — 10% infrastructure step-up in years 2–10 on top of standard inflation. |
| **Conservative Headwinds** | Hx +10% yrs 2–5, Tx step-down 8% yrs 3–7, 10% Halo efficiency. Infrastructure at inflation only. |
| **Custom** | Start from scratch — fill in your own assumptions. |

## Calculation Engine

### Key Formulas
- **Attrition**: `attrition = min(lapse + mortality, 1)`
- **Retention**: `retention[y] = retention[y-1] × (1 - attrition[y])`
- **PMPM backward-solver**: `PMPM = (NPV_cost / (1 - CM) - NPV_casefee) / NPV_PH_years / 12`
- **Blended PMPM**: PH-mix weighted average of per-age solved PMPMs
- **Blended CM%**: `SUMPRODUCT(PH_mix × per_age_CM%)` — weighted average of spot CMs

### Data Sources (from HLI)
- **Cancer incidence rates** by age and gender (INC_M, INC_F)
- **Lapse rates** by policy year (20-year and 30-year terms)
- **Mortality rates** by age and gender (MORT_M, MORT_F)
- **Policyholder distribution** by age and gender (PH_M, PH_F)

### Infrastructure Costs (from vendor P&L, Feb 2026)
- Hx infra: $0.0431/PH/month
- Tx infra: $76.06/case
- Rx infra: $22.16/case

## Model Defaults
- **Target CM**: 70%
- **Policy Term**: 30 years
- **Inflation**: 5%
- **Discount Rate**: 5%
- **Cohort Size**: 100,000

## App Sections

1. **Assumptions** — Choose a scenario and adjust all cost inputs, dynamics, and model parameters. Includes an interactive cost curve chart with chart/table toggle.
2. **Insurer Provided Data** — Visualizations of cancer incidence, lapse rates, mortality rates, and PH distribution from HLI.
3. **PMPM Table** — Per-member-per-month price by age and gender.
4. **Annual CM Over Cohort Life** — Contribution margin projected year-by-year across the blended HLI book. Shows where margin crosses zero.
5. **How It Works** — Step-by-step calculation engine walkthrough from inputs to outputs.

## Tech Stack
- **Next.js** (App Router) with TypeScript and Tailwind CSS
- **Recharts** for data visualization
- **Vercel** for deployment

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Push to GitHub and import into [Vercel](https://vercel.com). The app will auto-deploy on every push to `main`.

## Reference
- Excel model: `2026.04 Growth Pricing Framework v63_CF`
- Key Excel sheets: "Cost Scenarios", "Control Center", "PMPM by PH Demo (Term)", "CM calc (Scenario 1)", "Output (Scenario 1)", "Retention rate"
