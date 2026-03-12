# Implementation Plan — Australian Housing Market Econometrics

> Project is near-complete. All 16 frontend tests and 5 pipeline tests pass. Build succeeds.
> Specs: `specs/data-pipeline.md`, `specs/granger-causality.md`, `specs/hmm-regimes.md`, `specs/lightgbm-features.md`, `specs/frontend.md`, `specs/deployment.md`
> See `specs/README.md` for a keyword index of all spec files.

---

## Open Items (Priority Order)

All 6 specs are fully implemented. The items below are robustness, quality, and accessibility gaps discovered during a code-vs-spec audit (2026-03-13).

### P0 — Reliability / Correctness

- [ ] **CI does not run tests before deploy** — `deploy.yml` runs `npm run build` but never `npm test`. A test regression ships silently to GitHub Pages. Fix: add `npm test` step before `npm run build` in the workflow.
- [ ] **Granger D3 modules missing data guards** — `grangerGraph.js` and `grangerHeatmap.js` do not guard against `data.results` being undefined/null (unlike all other D3 modules which have early-return guards). A malformed `granger.json` will crash the entire app via uncaught TypeError. Fix: add `if (!data?.results) return;` early-return in both `renderGrangerGraph` and `renderGrangerHeatmap`.
- [ ] **`ErrorBoundary` missing `componentDidCatch`** — `App.jsx` catches render errors via `getDerivedStateFromError` but never logs them (`componentDidCatch` is absent). Errors are silently swallowed with no `console.error`. Fix: add `componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }`.

### P1 — Consistency / Polish

- [ ] **`grangerHeatmap.js` tooltip has no transition** — Uses `.style('opacity', 1/0)` directly while all other D3 modules use `.transition().duration(150)`. Fix: add `.transition().duration(150)` to heatmap tooltip show/hide for consistency.
- [ ] **`GrangerSection.jsx` inline tab styles** — The only component using inline `style={{}}` objects with hardcoded hex colors (`#2563EB`, `#1d4ed8`, `#374151`, `#d1d5db`). All other components use CSS classes from `index.css`. Fix: extract tab styling to CSS classes (e.g., `.tab-btn`, `.tab-btn--active`).
- [ ] **`transitionMatrix.js` is not responsive** — Fixed `cellSize = 72` regardless of container width. All other D3 charts derive dimensions from container. The matrix overflows on narrow viewports. Fix: derive `cellSize` from `containerWidth / (nStates + headerRatio)` with a sensible minimum.
- [ ] **`featureImportanceChart.js` legend spacing is fragile** — Uses `groups.length * 100` (100px per group) to position the legend. Can clip on narrow viewports. Fix: measure actual text widths or wrap the legend below the chart on small screens.

### P2 — Accessibility

- [ ] **No `aria-live` region for chart updates** — When a user changes city selector or toggle, the chart re-renders silently. Screen reader users receive no announcement. Fix: add an `aria-live="polite"` region in each section that announces the selected city/mode on change.
- [ ] **SVG `role="img"` on individual `<rect>`/`<circle>` elements** — `regimeTimeline.js` applies `role="img"` to individual SVG `<rect>` elements. Per ARIA spec, `role="img"` is for container elements. Current approach works in most screen readers but is technically incorrect. Low priority — consider wrapping in `<g role="img">` groups.

### P3 — Test Coverage / Quality

- [ ] **D3 modules have zero direct test coverage** — All 6 D3 modules are mocked in `App.test.jsx`. No tests verify rendering logic, data transformations, or DOM output. Consider adding smoke tests for each module using jsdom + mock container.
- [ ] **Python pipeline tests only validate output JSON, not logic** — `test_pipeline.py` checks schema of pre-written JSON files but never exercises `parse_abs_excel`, `granger_causality_test`, `fit_hmm`, or `walk_forward_cv` directly. Unit tests would catch regressions from dependency upgrades.
- [ ] **`test_granger_json` does not check `stationarity` block** — The stationarity section added in v0.0.16 has no test coverage. Fix: add assertions for `stationarity` key, per-city `stationary`/`adf_statistic`/`p_value` fields.
- [ ] **`test_hmm_json` does not validate transition matrix row sums** — Spec requires each row sums to 1.0. Fix: add `assert abs(sum(row) - 1.0) < 0.01` for each row.
- [ ] **No coverage tooling** — No `@vitest/coverage-v8` installed, no coverage scripts, no thresholds. Consider adding coverage reporting to CI.

### P4 — Data Pipeline / Future

- [ ] **Uncommitted spec change** — `specs/data-pipeline.md` has an uncommitted note documenting ABS 6416.0 cessation and 6432.0 splice option. Should be committed.
- [ ] **ABS URLs are version-locked** — `data_pipeline.py` hardcodes URLs to specific ABS publication dates (Dec 2021 RPPI, Dec 2024 CPI, Jan 2026 Labour). These will break when ABS reorganizes their file structure. No automated detection of stale URLs.
- [ ] **`requirements.txt` uses `>=` not `==`** — Python dependencies are not pinned, so the environment is not reproducible. A fresh `pip install` may pull breaking upgrades (especially hmmlearn or lightgbm major versions).

---

## Key Decisions

- **Gold Coast:** Include only if real ABS SA4 data is available. If not, drop to 4 cities. No synthetic/proxy data for Gold Coast.
- **Real data is mandatory.** Synthetic data is used only as temporary scaffolding to unblock frontend development. All shared/deployed output must use real ABS/RBA data.
- **Build order: vertical slices.** Each analysis module is built end-to-end (Python script → JSON → React/D3 viz) before moving to the next. See Build Order below.
- **City count is dynamic.** All code (Python + frontend) must handle 4 or 5 cities gracefully based on what `prices.json` contains.

---

## Completed Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Scaffolding | COMPLETE |
| 2 | Data Pipeline (`python/data_pipeline.py`) | COMPLETE |
| 3 | Granger Causality Analysis (`python/granger.py`) | COMPLETE |
| 4 | HMM Regime Detection (`python/hmm_regimes.py`) | COMPLETE |
| 5 | Feature Importance (`python/lightgbm_model.py`) | COMPLETE |
| 6 | Frontend App Shell & Data Loading | COMPLETE |
| 7 | Granger Causality Visualization | COMPLETE |
| 8 | HMM Regime Visualization | COMPLETE |
| 9 | Feature Importance Visualization | COMPLETE |
| 10 | Styling, Responsiveness & Accessibility | COMPLETE |
| 11 | Deployment & CI | COMPLETE (one manual step: set repo public) |

> **Deployment note:** `specs/deployment.md` prebuild command updated to match implementation (`mkdir -p public/data && cp data/*.json public/data/`) and gh-pages action updated to v4.

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
- **City ordering mismatch (fixed v0.0.14):** `data_pipeline.py` used `sorted(price_data.keys())` producing alphabetical order `["brisbane","melbourne","perth","sydney"]`, but the spec requires `["sydney","melbourne","brisbane","perth"]`. This affected Granger heatmap row/column layout and dropdown ordering. Fixed by replacing `sorted()` with a spec-defined `CITY_ORDER` list.
- **Dead `gold_coast` in synthetic data (fixed v0.0.15):** `generate_synthetic_prices()` still had a `gold_coast` entry in its `city_params` dict — unreachable dead code since the cities list never includes it. Removed.
- **Duplicated `humanReadableName` (fixed v0.0.15):** Identical function was defined in both `featureImportanceChart.js` and `crossCityComparison.js`. Extracted to `src/utils/constants.js` as a single source of truth with unit test coverage (15 tests now, up from 14).
- **HMM meta missing `n_init` (fixed v0.0.16):** The `hmm.json` meta block did not record the `n_init` parameter despite the spec listing it as a model parameter. Added `"n_init": 10` to the meta dict for reproducibility.
- **Granger ADF results were console-only (fixed v0.0.16):** `run_adf_test()` ran the ADF stationarity test but only logged results to stdout. Enhanced to return structured results (stationary bool, ADF statistic, p-value) and added a `"stationarity"` section to `granger.json` so downstream consumers can see which cities' return series are non-stationary. Confirms Sydney p=0.1249 (non-stationary) while Melbourne, Brisbane, Perth are stationary.
- **public/data in .gitignore but tracked (fixed v0.0.17):** `public/data/` is listed in `.gitignore` but the files were previously force-added and tracked. After v0.0.16 added stationarity and n_init to `data/` originals, the `public/data/` copies were not committed. Fixed in v0.0.17 by force-adding the synced copies. Future pipeline runs that update `data/` must also `git add -f public/data/` to keep them in sync.
- **Full spec compliance verified (v0.0.17):** All 6 specs reviewed and confirmed fully implemented. All D3 modules have both hover and focus tooltip events for accessibility.
- **Toggle label mismatch (fixed v0.0.18):** LightGBMSection toggle read "Group lag variants" but spec says "Group by category". Fixed to match spec.
- **REGIME_COLORS_SOLID untested (fixed v0.0.18):** Added test coverage for solid regime colors. Test count now 16 (up from 15).
- **Granger heatmap column headers obscured (fixed v0.0.19):** Column headers were drawn before grid cells in SVG document order. Since SVG z-ordering follows document order (later elements render on top), cells painted over the rotated column header text. Fixed by moving column header rendering after cell rendering and increasing `labelHeight` from 56px to 80px for better spacing.
- **README.md live demo URL incorrect (fixed v0.0.20):** README existed but had wrong live demo URL (`aus-housing-econometrics` instead of `houseViz`), outdated date range ("2005 to present" vs "Q1 2005 – Q4 2021"), missing walk-forward CV details in LightGBM methodology, wrong project directory name in structure tree, and incomplete D3 file listing. All corrected.
- **Tooltip DOM leak (fixed v0.0.20):** D3 tooltip `<div>` elements appended to `<body>` were never removed on React component unmount. Added `useEffect` cleanup functions in `GrangerSection.jsx`, `HMMSection.jsx`, and `LightGBMSection.jsx` that remove their respective tooltip elements (`.granger-tip`, `.granger-heatmap-tip`, `.hmm-tip`, `.hmm-overlay-tip`, `.tm-tip`, `.lgbm-tip`, `.cc-tip`) on unmount. Prevents orphaned DOM nodes on hot-reload.

---

## Build Order (Vertical Slices)

Each slice is end-to-end: Python script → JSON output → React/D3 visualization.

```
Step 1: Scaffolding (Phase 1)                    COMPLETE
  └── Project setup, directories, configs, synthetic data for dev

Step 2: Real Data Pipeline (Phase 2)             COMPLETE
  └── ABS/RBA fetching → prices.json + macro.json (real data replaces synthetic)

Step 3: Granger Slice (Phases 3 + 7)             COMPLETE
  └── granger.py → granger.json → GrangerSection.jsx + grangerGraph.js

Step 4: HMM Slice (Phases 4 + 8)                 COMPLETE
  └── hmm_regimes.py → hmm.json → HMMSection.jsx + regimeTimeline.js

Step 5: Feature Importance Slice (Phases 5 + 9)  COMPLETE
  └── lightgbm_model.py → lightgbm.json → LightGBMSection.jsx + featureImportanceChart.js

Step 6: Styling & Polish (Phase 10)              COMPLETE
  └── CSS, responsiveness, accessibility

Step 7: Deployment (Phase 11)                    COMPLETE (manual: set repo public)
  └── GitHub Actions, README, deploy.yml — only remaining step is manual
```

### Notes
- Frontend shell (Phase 6: App.jsx, Header, Footer, dataLoader, constants) is built during Step 1 alongside scaffolding
- Synthetic data is scaffolding only — replaced by real data in Step 2 before any analysis work
- Each vertical slice produces a working, testable feature before moving on
- No `src/lib` directory exists; shared utilities are in `src/utils/`
