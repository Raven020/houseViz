# Australian Housing Market Econometrics

An interactive single-page application exploring price dynamics across Australia's major cities through three econometric analyses, visualised with React and D3.js.

## Overview

This project applies quantitative methods from time-series econometrics and machine learning to Australian residential property data spanning 2005 to the present. Rather than presenting static charts, it builds an interactive data story that lets users interrogate the relationships and patterns embedded in two decades of housing market data.

The application is structured around three analyses. Granger causality tests reveal directional price-leadership relationships between Sydney, Melbourne, Brisbane, Perth, and Gold Coast — identifying which cities tend to move first and which follow. Hidden Markov Model (HMM) regime detection classifies each city's market history into boom, stagnation, and correction states, producing timeline visualisations that map how regimes have evolved and how often markets transition between them. LightGBM feature importance analysis quantifies the relative contribution of macroeconomic drivers — interest rates, inflation, unemployment, and cross-city spillovers — to each city's quarterly price returns.

The frontend is a static React 18 / Vite application with D3.js v7 visualisations. All analysis is pre-computed by a Python pipeline that writes JSON files consumed at build time. There is no backend or runtime data fetching beyond loading those static assets.

## Live Demo

[https://\<username\>.github.io/aus-housing-econometrics/](https://<username>.github.io/aus-housing-econometrics/)

## Data Sources

| Dataset | Description |
|---|---|
| ABS Cat. 6416.0 | Residential Property Price Indexes — quarterly price index by city |
| ABS Cat. 6401.0 | Consumer Price Index — quarterly CPI used as inflation measure |
| ABS Cat. 6202.0 | Labour Force, Australia — monthly unemployment rate, resampled to quarterly |
| RBA Cash Rate Target | Reserve Bank of Australia official cash rate — monthly, resampled to quarterly |

All series are aligned to a common quarterly date index. Unemployment and cash rate series are resampled from monthly frequency using end-of-quarter values.

## Methodology

### Granger Causality

Pairwise Granger causality tests are run across all directed city pairs using `statsmodels.tsa.stattools.grangercausalitytests`. The test asks whether lagged values of city A's returns improve the forecast of city B's returns beyond city B's own lags alone. Parameters: maximum lag of 8 quarters, F-test (`ssr_ftest`), significance threshold α = 0.05. Each series is tested for stationarity via ADF; further differencing is applied if required.

### HMM Regime Detection

A 3-state Gaussian HMM is fit independently to each city's quarterly return series using `hmmlearn.GaussianHMM` (full covariance, 200 iterations, 10 random initialisations with best log-likelihood selected). States are post-labelled by mean return: boom (highest), stagnation (middle), and correction (lowest). Output includes the Viterbi-decoded state sequence, per-state means and variances, and a 3x3 transition probability matrix.

### LightGBM Feature Importance

One `LGBMRegressor` is trained per city to predict quarterly price returns from a feature set of ~15–25 engineered inputs: base macro indicators (cash rate, CPI, unemployment), their quarter-on-quarter changes, lags at 1, 2, and 4 quarters, and cross-city lagged returns. Gain-based feature importances are normalised to sum to 1.0 and grouped into four categories: Interest Rates, Employment, Inflation, and Cross-City. Train and test R² and RMSE are reported per city.

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.x with `pip3`

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Run the Python data pipeline

Run scripts in order — each depends on output from prior steps.

```bash
cd python
pip3 install -r requirements.txt
python3 data_pipeline.py    # generates data/prices.json + data/macro.json
python3 granger.py          # generates data/granger.json
python3 hmm_regimes.py      # generates data/hmm.json
python3 xgboost_model.py    # generates data/xgboost.json
```

### 3. Start the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build      # copies data/ to public/data/, then builds to dist/
npm run preview    # preview the production build locally
```

### Run tests

```bash
npm test                           # frontend tests (vitest)
python3 python/test_pipeline.py    # data pipeline validation
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Visualisation | D3.js v7 — direct SVG bindings |
| Styling | CSS Modules |
| Build | Vite — static output to `dist/` |
| Data pipeline | Python 3 — pandas, statsmodels, hmmlearn, lightgbm, scikit-learn |
| Deployment | GitHub Pages via GitHub Actions |

## Project Structure

```
aus-housing-econometrics/
├── src/
│   ├── App.jsx                      # Root layout, data loading
│   ├── main.jsx                     # React DOM entry point
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── GrangerSection.jsx       # Section 1: city relationships
│   │   ├── HMMSection.jsx           # Section 2: market regimes
│   │   ├── XGBoostSection.jsx       # Section 3: price drivers
│   │   └── Footer.jsx
│   ├── d3/
│   │   ├── grangerGraph.js          # Force-directed causality graph
│   │   ├── regimeTimeline.js        # HMM regime timeline chart
│   │   └── featureImportanceChart.js
│   ├── styles/
│   └── utils/
│       ├── dataLoader.js
│       └── constants.js             # City colours and display names
├── python/
│   ├── requirements.txt
│   ├── data_pipeline.py
│   ├── granger.py
│   ├── hmm_regimes.py
│   ├── xgboost_model.py
│   └── test_pipeline.py
├── data/                            # Pre-computed JSON (source of truth)
│   ├── prices.json
│   ├── macro.json
│   ├── granger.json
│   ├── hmm.json
│   └── xgboost.json
├── public/data/                     # Copied at build time
├── specs/                           # Detailed technical specifications
├── .github/workflows/deploy.yml     # GitHub Actions deployment
├── AGENTS.md
├── IMPLEMENTATION_PLAN.md
├── index.html
├── vite.config.js
└── package.json
```
