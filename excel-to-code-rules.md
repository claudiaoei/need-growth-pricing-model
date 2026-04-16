# Excel-to-Code Translation Rules

These rules exist because of a real mistake: I once read only 8 columns of a 30-year model, saw a uniform formula pattern, and concluded it applied to all years. It didn't — the formula changed at year 11, dropping an infrastructure step-up component. Always assume formulas can change at any column boundary.

## Never sample only the first few columns

When reading any row of repeating formulas, always read the first column, a column in the middle of the range, and the last populated column. If the model spans 30 years, that means checking columns near years 1, 15, and 30 — not just years 1 through 8.

If any assumption labels a year range (e.g., "Infra step-up Yrs 2–10", "Halo efficiency years 3–7"), also read the column immediately after that range ends to confirm the formula reverts.

## Verify year-boundary transitions

For every year-range assumption, confirm the effect is absent before the range starts, present within it, and absent after it ends. Four columns tell the whole story: one before, the first, the last, and one after.

## Labels describe intent, formulas are truth

Row headers and cell comments say what the modeler meant to build. The actual formula is what got built. Treat the formula as the source of truth, but flag any discrepancies — the label might be stale, or the formula might have a bug. When in doubt, ask.

## Say what you checked

When translating Excel logic to code, note which columns you verified and what transitions you found. Example: "Row 105 (Hx Infra): years 2–10 use `*(1+(infl+stepUp))`, year 11+ switches to `*(1+(infl))` — verified at columns D, L, M, Q."
