# Implementation Plan — Australian Housing Market Econometrics

> Greenfield project. No source code exists yet. All items below need to be built.
> Specs: `specs/data-pipeline.md`, `specs/granger-causality.md`, `specs/hmm-regimes.md`, `specs/xgboost-features.md`, `specs/frontend.md`, `specs/deployment.md`
> See `specs/README.md` for a keyword index of all spec files.

## Key Decisions

- **Gold Coast:** Include only if real ABS SA4 data is available. If not, drop to 4 cities. No synthetic/proxy data for Gold Coast.
- **Real data is mandatory.** Synthetic data is used only as temporary scaffolding to unblock frontend development. All shared/deployed output must use real ABS/RBA data.
- **Build order: vertical slices.** Each analysis module is built end-to-end (Python script → JSON → React/D3 viz) before moving to the next. See Build Order below.
- **City count is dynamic.** All code (Python + frontend) must handle 4 or 5 cities gracefully based on what `prices.json` contains.

## Phase 1: Project Scaffolding ★ HIGHEST PRIORITY — unblocks everything

- [x] Create `package.json` with React 18, Vite, D3.js v7 dependencies and scripts (`dev`, `build`, `preview`, `prebuild`)
- [x] Create `vite.config.js` with React plugin and `base: '/aus-housing-econometrics/'` for GitHub Pages
- [x] Create `python/requirements.txt` with: `pandas>=2.0`, `openpyxl>=3.1`, `statsmodels>=0.14`, `hmmlearn>=0.3`, `xgboost>=2.0`, `scikit-learn>=1.3`
- [x] Create directory structure: `src/components/`, `src/d3/`, `src/utils/`, `src/styles/`, `python/`, `data/`, `public/data/`
- [x] Create `index.html` entry point with root div and Vite module script tag
- [x] Create `.gitignore` for `node_modules/`, `dist/`, `__pycache__/`, `.env`, `venv/`
- [x] Create `AGENTS.md` with operational notes (how to run Python scripts, dev server, build)

## Phase 2: Data Pipeline (`python/data_pipeline.py`) ★ HIGH PRIORITY — all analysis scripts depend on this

- [x] Implement synthetic/sample data generation fallback for offline development (do this FIRST to unblock frontend work)
- [ ] Implement ABS Cat. 6416.0 housing price data fetching/parsing for Sydney, Melbourne, Brisbane, Perth
- [ ] Attempt Gold Coast via ABS SA4-level tables; include if data is sufficient, otherwise drop and proceed with 4 cities
- [ ] Implement RBA cash rate fetching (monthly → resample to quarterly; document resampling method)
- [ ] Implement ABS Cat. 6401.0 (CPI) and ABS Cat. 6202.0 (unemployment) fetching (unemployment is monthly → resample to quarterly; document resampling method)
- [ ] Align all series to common quarterly date index (Q1 2005 – latest), forward-fill gaps ≤1Q; document any truncation if Gold Coast or other series start later
- [ ] Compute QoQ percentage returns for each city's price index
- [ ] Output `data/prices.json` per spec schema (meta, cities, dates, series with index + returns)
- [ ] Output `data/macro.json` per spec schema (meta, dates, indicators: cash_rate, cpi, unemployment)
- [ ] Validate: no NaN in output, all series same length as dates array
- [ ] Ensure script is idempotent (re-running overwrites `data/*.json` cleanly)

## Phase 3: Granger Causality Analysis (`python/granger.py`)

- [x] Load `data/prices.json` and extract quarterly return series per city
- [x] Run pairwise Granger causality tests across all 20 directed city pairs using `statsmodels.tsa.stattools.grangercausalitytests`
- [x] Parameters: max lag 8 quarters, F-test (ssr_ftest), significance threshold α=0.05
- [x] For each pair: record optimal lag (lowest p-value), p-value, F-statistic, significance boolean
- [x] Optionally run ADF stationarity test on each return series and log results; if non-stationary, apply further differencing
- [x] Output `data/granger.json` per spec schema

## Phase 4: HMM Regime Detection (`python/hmm_regimes.py`)

- [x] Load `data/prices.json` quarterly returns per city
- [x] Fit 3-state Gaussian HMM per city using `hmmlearn.GaussianHMM` (covariance_type="full", n_iter=200, random_state=42, n_init=10)
- [x] Post-process: label states by mean return (boom=highest, stagnation=middle, correction=lowest)
- [x] Extract Viterbi decoded state sequence, state means/variances, 3×3 transition matrix per city
- [x] Output `data/hmm.json` per spec schema

## Phase 5: XGBoost Feature Importance (`python/xgboost_model.py`)

- [x] Load `data/prices.json` and `data/macro.json`
- [x] Engineer features: base macro features + QoQ changes + lags (1, 2, 4 quarters) + cross-city lagged returns (~15-25 features)
- [x] Train one `XGBRegressor` per city (n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, objective='reg:squarederror', random_state=42)
- [x] Extract gain-based feature importances, normalize to sum=1.0, assign feature groups (Interest Rates, Employment, Inflation, Cross-City)
- [x] Report in-sample R² and RMSE per city
- [x] Output `data/xgboost.json` per spec schema

## Phase 6: Frontend App Shell & Data Loading

- [x] Create `src/main.jsx` — React DOM root render
- [x] Create `src/App.jsx` — top-level layout; fetches all 5 JSON files on mount; loading spinner while fetching; user-friendly error message on failure; passes data to sections
- [x] Create `src/utils/dataLoader.js` — async fetch functions for all 5 JSON files (prices, macro, granger, hmm, xgboost); return meaningful error messages on failure
- [x] Create `src/utils/constants.js` — city color palette (Sydney=#2563EB, Melbourne=#7C3AED, Brisbane=#D97706, Perth=#DC2626, Gold Coast=#059669) AND city display-name mapping (e.g., `gold_coast` → "Gold Coast")
- [x] Create `src/components/Header.jsx` — title "Australian Housing Market Econometrics", subtitle, 2-3 sentence intro
- [x] Create `src/components/Footer.jsx` — data sources (ABS, RBA links), methodology notes, author/GitHub/LinkedIn links

## Phase 7: Granger Causality Visualization

- [x] Create `src/d3/grangerGraph.js` — D3 force-directed network graph
  - [x] 5 city nodes in approximate geographic layout, color-coded per constants.js palette
  - [x] Directed arrows for significant pairs; thickness/opacity ∝ F-statistic; labeled with lag ("2Q")
  - [x] Non-significant pairs: hidden by default (toggle to show as dashed)
  - [x] Hover node: highlight inbound/outbound edges
  - [x] Hover edge: tooltip with p-value, F-stat, lag
- [x] Create `src/components/GrangerSection.jsx` — section heading, plain-language explanation, SVG container, toggle for non-significant pairs

## Phase 8: HMM Regime Visualization

- [x] Create `src/d3/regimeTimeline.js` — D3 timeline chart
  - [x] X-axis: time (quarters), Y-axis: price index level
  - [x] Line chart of city price index
  - [x] Semi-transparent background bands: boom=green, stagnation=amber, correction=red/pink
  - [x] Hover regime band: tooltip with label, duration, avg return
  - [x] Hover price line: tooltip with date and index value
- [x] Create `src/components/HMMSection.jsx` — section heading, explanation, city selector (dropdown/tabs, default Sydney), SVG container

## Phase 9: XGBoost Feature Importance Visualization

- [x] Create `src/d3/featureImportanceChart.js` — D3 horizontal bar chart
  - [x] Bars sorted descending by importance, top 10 (rest collapsed to "Other")
  - [x] Color-coded by group (Interest Rates, Employment, Inflation, Cross-City)
  - [x] Bar labels: human-readable feature name + importance value
  - [x] Hover bar: tooltip with exact importance + feature description
  - [x] Optional toggle: "Group by category" aggregation
- [x] Create `src/components/XGBoostSection.jsx` — section heading, explanation, city selector, model metrics (R², RMSE), SVG container

## Phase 10: Styling, Responsiveness & Accessibility

- [x] Create global stylesheet (`src/styles/index.css`) — white bg, dark text, max-width 900px centered, system font stack or Inter/DM Sans
- [ ] Per-component CSS modules for section spacing, controls, cards (CSS Modules chosen over Tailwind — either acceptable per frontend spec)
- [x] Responsive SVG: `ResizeObserver` or container-width-based redraw; mobile (375px) and desktop (1440px) breakpoints
- [x] `aria-label` on all chart SVGs and interactive elements
- [x] Keyboard-navigable city selectors and toggles
- [ ] Tooltips on both hover and focus
- [ ] Verify WCAG AA contrast for all 5 city accent colors on white

## Phase 11: Deployment & CI

- [x] Set `vite.config.js` `base` to `/aus-housing-econometrics/`
- [x] Add `prebuild` script in `package.json`: `cp -r data/ public/data/`
- [x] Create `.github/workflows/deploy.yml` — checkout → setup Node 20 → npm ci → npm run build → deploy via `peaceiris/actions-gh-pages@v3`
- [ ] Create `README.md` — project overview, methodology summary, local dev instructions, live URL
- [ ] Verify pre-deployment checklist: 5 JSON files in data/, build succeeds, dist/data/ populated, local preview works, responsive layout checked
- [ ] Set GitHub repo to public, add live URL to About section

## Optional Enhancements (low priority, implement only if time permits)

- [ ] Granger secondary visualization: 5×5 heatmap (rows="from", cols="to", cell color by p-value, label with optimal lag)
- [ ] HMM secondary visualization: 3×3 transition matrix heatmap per city
- [ ] XGBoost: walk-forward cross-validation instead of in-sample metrics
- [ ] HMM: overlay multiple cities on same timeline chart
- [ ] XGBoost secondary visualization: cross-city comparison (small multiples or grouped bars showing #1 feature per city side by side)

---

## Known Issues / Learnings

- **hmmlearn 0.3.3 does not support `n_init` parameter:** The `n_init` argument is not available in hmmlearn 0.3.3. Multi-init behavior was implemented manually using a loop, fitting the model multiple times and keeping the result with the best log-likelihood.
- **numpy bool not JSON serializable:** `numpy.bool_` values cannot be passed directly to `json.dump`. Must cast to Python `bool()` before serialization.
- **`cp -r data/ public/data/` creates nested directory:** Running `cp -r data/ public/data/` when `public/data/` already exists produces `public/data/data/`. Use `mkdir -p public/data && cp data/*.json public/data/` instead (also update the `prebuild` script in `package.json` accordingly).
- **HMM produces poor regime separation with synthetic data:** This is expected behavior. Regime labels (boom/stagnation/correction) will be more meaningful once real ABS/RBA data is used.

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
