# Specs Index

Quick-reference keyword index for all specification files in this directory.

## data-pipeline.md
**Python data ingestion and JSON output**
Keywords: ABS, RBA, housing prices, macro indicators, cash rate, CPI, unemployment, quarterly, resampling, forward-fill, prices.json, macro.json, 4 cities, SA4, Cat 6416.0, Cat 6401.0, Cat 6202.0, pandas, openpyxl, idempotent, synthetic data, date alignment, QoQ returns, validation, NaN check

## granger-causality.md
**Lead/lag relationships between cities**
Keywords: Granger causality, pairwise, directed pairs, F-test, ssr_ftest, p-value, optimal lag, significance, statsmodels, stationarity, ADF test, network graph, force-directed, D3, directed arrows, heatmap, granger.json, 12 city pairs, max lag 8

## hmm-regimes.md
**Market regime detection per city**
Keywords: Hidden Markov Model, HMM, Gaussian, hmmlearn, 3 states, boom, stagnation, correction, Viterbi, transition matrix, regime labels, mean return, covariance, EM algorithm, timeline chart, regime bands, green/amber/red, city selector, hmm.json

## xgboost-features.md
**Macro feature importance for price prediction (LightGBM)**
Keywords: LightGBM, LGBMRegressor, feature importance, gain-based, feature engineering, lagged features, cross-city returns, cash_rate_change, unemployment_change, CPI, R-squared, RMSE, horizontal bar chart, feature groups, Interest Rates, Employment, Inflation, Cross-City, xgboost.json, migration from XGBoost

## frontend.md
**React + D3 single-page application**
Keywords: React 18, Vite, D3.js v7, CSS Modules, single-page, scrollable, App.jsx, Header, Footer, GrangerSection, HMMSection, XGBoostSection, useRef, useEffect, ResizeObserver, city color palette, Sydney #2563EB, Melbourne #7C3AED, Brisbane #B45309, Perth #DC2626, 4 cities, accessibility, WCAG AA, aria-label, dataLoader.js, constants.js, public/data/

## deployment.md
**GitHub Pages deployment and CI**
Keywords: GitHub Pages, GitHub Actions, Vite base path, peaceiris/actions-gh-pages, prebuild script, cp data public, Node 20, npm ci, dist/, requirements.txt, python scripts run order, pre-deployment checklist
