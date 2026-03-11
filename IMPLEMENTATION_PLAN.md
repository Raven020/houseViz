# Implementation Plan — Australian Housing Market Econometrics

> Project scaffolding, analysis pipeline, frontend, and all D3 visualizations are complete.
> Specs: `specs/data-pipeline.md`, `specs/granger-causality.md`, `specs/hmm-regimes.md`, `specs/xgboost-features.md`, `specs/frontend.md`, `specs/deployment.md`
> See `specs/README.md` for a keyword index of all spec files.

## Key Decisions

- **Gold Coast:** Include only if real ABS SA4 data is available. If not, drop to 4 cities. No synthetic/proxy data for Gold Coast.
- **Real data is mandatory.** Synthetic data is used only as temporary scaffolding to unblock frontend development. All shared/deployed output must use real ABS/RBA data.
- **Build order: vertical slices.** Each analysis module is built end-to-end (Python script → JSON → React/D3 viz) before moving to the next. See Build Order below.
- **City count is dynamic.** All code (Python + frontend) must handle 4 or 5 cities gracefully based on what `prices.json` contains.

## Phase 1: Project Scaffolding — COMPLETE

Directory structure, `package.json`, `vite.config.js`, `index.html`, `python/requirements.txt`, `.gitignore`, and `AGENTS.md` all created and verified.

## Phase 2: Data Pipeline (`python/data_pipeline.py`) ★ HIGH PRIORITY — all analysis scripts depend on this

- [x] Implement synthetic/sample data generation fallback for offline development (do this FIRST to unblock frontend work)
- [x] ABS Cat. 6416.0 housing price data (note: series ceased Dec 2021, data covers Q1 2003–Q4 2021)
- [x] Gold Coast — ABS 6416.0 only covers 8 capital cities, no SA4 data. Dropped to 4 cities.
- [x] RBA cash rate (monthly → quarterly, end-of-quarter resampling)
- [x] ABS Cat. 6401.0 CPI (quarterly % change from previous period)
- [x] ABS Cat. 6202.0 unemployment (monthly → quarterly, seasonally adjusted, end-of-quarter)
- [x] Align to common quarterly dates Q1 2005 – Q4 2021 (68 quarters)
- [x] Compute QoQ returns
- [x] Output prices.json and macro.json
- [x] Validation (no NaN, same length)
- [x] Idempotent

## Phase 3: Granger Causality Analysis (`python/granger.py`) — COMPLETE

Pairwise Granger causality tests across all directed city pairs (max lag 8Q, F-test, α=0.05); ADF stationarity check per city; output `data/granger.json`.

## Phase 4: HMM Regime Detection (`python/hmm_regimes.py`) — COMPLETE

3-state Gaussian HMM per city (boom/stagnation/correction), Viterbi decoding, transition matrices; output `data/hmm.json`.

## Phase 5: XGBoost Feature Importance (`python/xgboost_model.py`) — COMPLETE

Feature engineering with macro lags and cross-city returns; one XGBRegressor per city; gain-based importances normalized to 1.0; output `data/xgboost.json`.

## Phase 6: Frontend App Shell & Data Loading — COMPLETE

`src/main.jsx`, `src/App.jsx`, `src/utils/dataLoader.js`, `src/utils/constants.js`, `src/components/Header.jsx`, and `src/components/Footer.jsx` all created and wired up.

## Phase 7: Granger Causality Visualization — COMPLETE

D3 force-directed network graph with directed arrows, F-statistic-weighted edges, hover tooltips, and non-significant pair toggle; `src/d3/grangerGraph.js` and `src/components/GrangerSection.jsx` complete.

## Phase 8: HMM Regime Visualization — COMPLETE

D3 timeline chart with price index line, color-coded regime bands, and hover tooltips; `src/d3/regimeTimeline.js` and `src/components/HMMSection.jsx` complete.

## Phase 9: XGBoost Feature Importance Visualization — COMPLETE

D3 horizontal bar chart with group color-coding, top-10 display, hover tooltips, and category aggregation toggle; `src/d3/featureImportanceChart.js` and `src/components/XGBoostSection.jsx` complete.

## Phase 10: Styling, Responsiveness & Accessibility

- [x] Create global stylesheet (`src/styles/index.css`) — white bg, dark text, max-width 900px centered, system font stack or Inter/DM Sans
- [ ] Per-component CSS modules for section spacing, controls, cards — using global CSS instead; acceptable per spec
- [x] Responsive SVG: `ResizeObserver` or container-width-based redraw; mobile (375px) and desktop (1440px) breakpoints
- [x] `aria-label` on all chart SVGs and interactive elements
- [x] Keyboard-navigable city selectors and toggles
- [x] Tooltips on both hover and focus
- [x] Verify WCAG AA contrast (Brisbane #D97706→#B45309, Gold Coast #059669→#047857)

## Phase 11: Deployment & CI

- [x] Set `vite.config.js` `base` to `/aus-housing-econometrics/`
- [x] Add `prebuild` script in `package.json`: `cp -r data/ public/data/`
- [x] Create `.github/workflows/deploy.yml` — checkout → setup Node 20 → npm ci → npm run build → deploy via `peaceiris/actions-gh-pages@v3`
- [x] README.md created
- [x] Verify pre-deployment checklist: 5 JSON files in data/, build succeeds, dist/data/ populated, all tests pass
- [ ] Set GitHub repo to public, add live URL to About section

## Optional Enhancements

- [x] Granger secondary visualization: NxN heatmap (rows="from", cols="to", cell color by p-value, label with optimal lag). Tab toggle between Network/Heatmap views.
- [x] HMM secondary visualization: 3×3 transition matrix heatmap per city, rendered below the regime timeline, updates on city selector change.
- [ ] XGBoost: walk-forward cross-validation instead of in-sample metrics
- [ ] HMM: overlay multiple cities on same timeline chart
- [ ] XGBoost secondary visualization: cross-city comparison (small multiples or grouped bars showing #1 feature per city side by side)

---

## Known Issues / Learnings

- **hmmlearn 0.3.3 does not support `n_init` parameter:** The `n_init` argument is not available in hmmlearn 0.3.3. Multi-init behavior was implemented manually using a loop, fitting the model multiple times and keeping the result with the best log-likelihood.
- **numpy bool not JSON serializable:** `numpy.bool_` values cannot be passed directly to `json.dump`. Must cast to Python `bool()` before serialization.
- **`cp -r data/ public/data/` creates nested directory:** Running `cp -r data/ public/data/` when `public/data/` already exists produces `public/data/data/`. Use `mkdir -p public/data && cp data/*.json public/data/` instead (also update the `prebuild` script in `package.json` accordingly).
- **HMM produces poor regime separation with synthetic data:** This is expected behavior. Regime labels (boom/stagnation/correction) will be more meaningful once real ABS/RBA data is used.
- **ABS Cat. 6416.0 (RPPI) was ceased Dec 2021:** Date range is constrained to Q1 2005 – Q4 2021; data prior to Q1 2005 exists but is excluded to align with other series.
- **Gold Coast not available in ABS 6416.0:** The ABS 6416.0 RPPI covers 8 capital cities only; Gold Coast has no equivalent series, so the project uses 4 cities (Sydney, Melbourne, Brisbane, Perth).
- **ABS Excel files have duplicate column names:** Different series types (Trend/Seasonally Adjusted/Original) share column names across sheets. Parse by column index, not column name, to avoid silent mismatches.
- **Brisbane and Gold Coast failed WCAG AA contrast:** Brisbane (#D97706) achieved 3.19:1 and Gold Coast (#059669) achieved 3.77:1 against white — both below the 4.5:1 threshold. Replaced with #B45309 (Brisbane) and #047857 (Gold Coast).
- **Sydney returns are non-stationary (ADF p=0.12):** Sydney's return series does not pass the ADF unit-root test at conventional thresholds. Granger causality results for Sydney pairs should be interpreted with caution.

---

## Build Order (Vertical Slices)

Each slice is end-to-end: Python script → JSON output → React/D3 visualization.

```
Step 1: Scaffolding (Phase 1)
  └── Project setup, directories, configs, synthetic data for dev

Step 2: Real Data Pipeline (Phase 2)
  └── ABS/RBA fetching → prices.json + macro.json (real data replaces synthetic)

Step 3: Granger Slice (Phases 3 + 7)
  └── granger.py → granger.json → GrangerSection.jsx + grangerGraph.js

Step 4: HMM Slice (Phases 4 + 8)
  └── hmm_regimes.py → hmm.json → HMMSection.jsx + regimeTimeline.js

Step 5: XGBoost Slice (Phases 5 + 9)
  └── xgboost_model.py → xgboost.json → XGBoostSection.jsx + featureImportanceChart.js

Step 6: Styling & Polish (Phase 10)
  └── CSS, responsiveness, accessibility

Step 7: Deployment (Phase 11)
  └── GitHub Actions, README, go-live
```

### Notes
- Frontend shell (Phase 6: App.jsx, Header, Footer, dataLoader, constants) is built during Step 1 alongside scaffolding
- Synthetic data is scaffolding only — replaced by real data in Step 2 before any analysis work
- Each vertical slice produces a working, testable feature before moving on
