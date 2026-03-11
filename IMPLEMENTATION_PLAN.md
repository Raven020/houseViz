# Implementation Plan — Australian Housing Market Econometrics

> Project scaffolding, analysis pipeline, frontend, and all D3 visualizations are complete.
> Specs: `specs/data-pipeline.md`, `specs/granger-causality.md`, `specs/hmm-regimes.md`, `specs/xgboost-features.md`, `specs/frontend.md`, `specs/deployment.md`
> See `specs/README.md` for a keyword index of all spec files.

## Key Decisions

- **Gold Coast:** Include only if real ABS SA4 data is available. If not, drop to 4 cities. No synthetic/proxy data for Gold Coast.
- **Real data is mandatory.** Synthetic data is used only as temporary scaffolding to unblock frontend development. All shared/deployed output must use real ABS/RBA data.
- **Build order: vertical slices.** Each analysis module is built end-to-end (Python script → JSON → React/D3 viz) before moving to the next. See Build Order below.
- **City count is dynamic.** All code (Python + frontend) must handle 4 or 5 cities gracefully based on what `prices.json` contains.

---

## Remaining Work — Prioritized

All priorities (P0-P9) are fully resolved. Full spec compliance audit completed at v0.0.9. Test/spec hygiene pass at v0.0.10. Spec alignment pass at v0.0.11.

### P9: Spec Alignment (v0.0.11)

- [x] **`gold_coast` still in `constants.js`** — `CITY_COLORS` and `CITY_NAMES` had gold_coast entries despite Gold Coast being dropped. Removed. Updated `constants.test.js` to assert exactly 4 cities.
- [x] **Header subtitle didn't match spec** — Said "across major Australian cities" instead of spec's "across 4 cities". Fixed.
- [x] **Vite base path mismatch** — Spec assumed repo name `aus-housing-econometrics` but actual GitHub repo is `houseViz`. Base path `/aus-housing-econometrics/` would cause all assets to 404 on GitHub Pages. Changed to `/houseViz/`. Updated `deployment.md` spec to match.
- [n/a] **Footer author/LinkedIn placeholders** — Contain "Developer" / `linkedin.com/in/developer`. Cannot fix without knowing real author identity. Noted for manual update.

---

## Completed Phases

### Phase 1: Project Scaffolding — COMPLETE

Directory structure, `package.json`, `vite.config.js`, `index.html`, `python/requirements.txt`, `.gitignore`, and `AGENTS.md` all created and verified.

### Phase 2: Data Pipeline (`python/data_pipeline.py`) — COMPLETE

- [x] Implement synthetic/sample data generation fallback for offline development
- [x] ABS Cat. 6416.0 housing price data (series ceased Dec 2021, data covers Q1 2003–Q4 2021)
- [x] Gold Coast — ABS 6416.0 only covers 8 capital cities, no SA4 data. Dropped to 4 cities.
- [x] RBA cash rate (monthly → quarterly, end-of-quarter resampling)
- [x] ABS Cat. 6401.0 CPI (quarterly % change from previous period)
- [x] ABS Cat. 6202.0 unemployment (monthly → quarterly, seasonally adjusted, end-of-quarter)
- [x] Align to common quarterly dates Q1 2005 – Q4 2021 (68 quarters)
- [x] Compute QoQ returns
- [x] Output prices.json and macro.json
- [x] Validation (no NaN, same length)
- [x] Idempotent

### Phase 3: Granger Causality Analysis (`python/granger.py`) — COMPLETE

Pairwise Granger causality tests across all directed city pairs (max lag 8Q, F-test, α=0.05); ADF stationarity check per city; output `data/granger.json`.

### Phase 4: HMM Regime Detection (`python/hmm_regimes.py`) — COMPLETE (with mitigations for degeneracy)

3-state Gaussian HMM per city (boom/stagnation/correction), Viterbi decoding, transition matrices, regularization via `covars_prior`/`covars_weight`, automatic 2-state fallback for degenerate cities; output `data/hmm.json`.

### Phase 5: Feature Importance (`python/xgboost_model.py`) — COMPLETE

Feature engineering with macro lags and cross-city returns; one model per city; walk-forward CV (min 20 obs, expanding window); gain-based importances averaged across valid folds and normalized to sum to 1.0; reports both in-sample and OOF R²/RMSE; output `data/xgboost.json`. Fully migrated to LGBMRegressor per spec.

### Phase 6: Frontend App Shell & Data Loading — COMPLETE

`src/main.jsx`, `src/App.jsx`, `src/utils/dataLoader.js`, `src/utils/constants.js`, `src/components/Header.jsx`, and `src/components/Footer.jsx` all created and wired up.

### Phase 7: Granger Causality Visualization — COMPLETE

D3 network graph + NxN heatmap with tab toggle, directed arrows, F-statistic-weighted edges, hover/focus tooltips, and non-significant pair toggle.

### Phase 8: HMM Regime Visualization — COMPLETE

D3 timeline chart with price index line, color-coded regime bands, hover/focus tooltips, and 3x3 transition matrix heatmap per city.

### Phase 9: Feature Importance Visualization — COMPLETE

D3 horizontal bar chart with group color-coding, top-10 display with "Other" collapse, hover/focus tooltips.

### Phase 10: Styling, Responsiveness & Accessibility — COMPLETE

- [x] Create global stylesheet (`src/styles/index.css`) — white bg, dark text, max-width 900px centered, Inter font
- [x] `aria-label` on all chart SVGs and interactive elements
- [x] Keyboard-navigable city selectors and toggles
- [x] Tooltips on both hover and focus
- [x] Verify WCAG AA contrast (Brisbane #B45309, Gold Coast #047857)
- [x] Responsive CSS breakpoint at 640px
- [x] ResizeObserver for dynamic chart redraw (see P1)
- [x] Granger tab `aria-controls` + arrow-key navigation (see P1)
- [x] Transition matrix keyboard hover highlight (see P1)
- [x] `aria-live` on loading spinner (see P1)
- [x] `prefers-reduced-motion` CSS rule (see P2)

### Phase 11: Deployment & CI — CODE COMPLETE; one manual step remains

- [x] Set `vite.config.js` `base` to `/aus-housing-econometrics/`
- [x] Add `prebuild` script in `package.json`
- [x] Create `.github/workflows/deploy.yml`
- [x] README.md created
- [x] Verify pre-deployment checklist: 5 JSON files in data/, build succeeds
- [x] `deploy.yml` polish: permissions, caching, SHA pinning
- [ ] Set GitHub repo to public, add live URL to About section — manual step, no code required

---

## Known Issues / Learnings

- **hmmlearn 0.3.3 does not support `n_init` parameter:** The `n_init` argument is not available in hmmlearn 0.3.3. Multi-init behavior was implemented manually using a loop, fitting the model multiple times and keeping the result with the best log-likelihood.
- **numpy bool not JSON serializable:** `numpy.bool_` values cannot be passed directly to `json.dump`. Must cast to Python `bool()` before serialization.
- **`cp -r data/ public/data/` creates nested directory:** Running `cp -r data/ public/data/` when `public/data/` already exists produces `public/data/data/`. Use `mkdir -p public/data && cp data/*.json public/data/` instead (also update the `prebuild` script in `package.json` accordingly).
- **HMM degeneracy mitigated:** The code now includes regularization (`covars_prior`, `covars_weight=2.0`) and automatic 2-state fallback for degenerate cities. Output quality was reviewed — Brisbane/Melbourne regime assignments are acceptable.
- **ABS Cat. 6416.0 (RPPI) was ceased Dec 2021:** Date range is constrained to Q1 2005 – Q4 2021; data prior to Q1 2005 exists but is excluded to align with other series.
- **Gold Coast not available in ABS 6416.0:** The ABS 6416.0 RPPI covers 8 capital cities only; Gold Coast has no equivalent series, so the project uses 4 cities (Sydney, Melbourne, Brisbane, Perth).
- **ABS Excel files have duplicate column names:** Different series types (Trend/Seasonally Adjusted/Original) share column names across sheets. Parse by column index, not column name, to avoid silent mismatches.
- **Brisbane and Gold Coast failed WCAG AA contrast:** Brisbane (#D97706) achieved 3.19:1 and Gold Coast (#059669) achieved 3.77:1 against white — both below the 4.5:1 threshold. Replaced with #B45309 (Brisbane) and #047857 (Gold Coast).
- **Sydney returns are non-stationary (ADF p=0.12):** Sydney's return series does not pass the ADF unit-root test at conventional thresholds. Granger causality results for Sydney pairs should be interpreted with caution.
- **Walk-forward CV replaced single train/test split for LightGBM:** Walk-forward CV with expanding window (min 20 obs, 23 valid folds per city out of 43 total) provides robust out-of-sample evaluation. OOF R² ranges from -0.01 (Sydney) to 0.26 (Melbourne). Feature importances are averaged across valid folds (those with non-zero gains) and normalized to sum to 1.0. Full-sample in-sample R² ranges from 0.52 (Perth) to 0.76 (Sydney).
- **Walk-forward fold counting bug (fixed v0.0.9):** Early folds with few training observations produced all-zero feature importances from LightGBM. The original code counted these zero-gain folds in the denominator, deflating all importances to ~0.535 total. Fixed by only incrementing `n_folds` when gains are non-zero, plus a final normalization to 1.0.

---

## Build Order (Vertical Slices)

Each slice is end-to-end: Python script → JSON output → React/D3 visualization.

```
Step 1: Scaffolding (Phase 1)                    ✅ COMPLETE
  └── Project setup, directories, configs, synthetic data for dev

Step 2: Real Data Pipeline (Phase 2)              ✅ COMPLETE
  └── ABS/RBA fetching → prices.json + macro.json (real data replaces synthetic)

Step 3: Granger Slice (Phases 3 + 7)              ✅ COMPLETE
  └── granger.py → granger.json → GrangerSection.jsx + grangerGraph.js

Step 4: HMM Slice (Phases 4 + 8)                  ✅ COMPLETE
  └── hmm_regimes.py → hmm.json → HMMSection.jsx + regimeTimeline.js

Step 5: Feature Importance Slice (Phases 5 + 9)   ✅ COMPLETE
  └── xgboost_model.py → xgboost.json → XGBoostSection.jsx + featureImportanceChart.js

Step 6: Styling & Polish (Phase 10)               ✅ COMPLETE
  └── CSS, responsiveness, accessibility

Step 7: Deployment (Phase 11)                     🔶 CODE COMPLETE
  └── GitHub Actions, README, deploy.yml polish all done — only manual step: set repo public
```

### Notes
- Frontend shell (Phase 6: App.jsx, Header, Footer, dataLoader, constants) is built during Step 1 alongside scaffolding
- Synthetic data is scaffolding only — replaced by real data in Step 2 before any analysis work
- Each vertical slice produces a working, testable feature before moving on
- No `src/lib` directory exists; shared utilities are in `src/utils/`
