# LightGBM Feature Importance Specification

## Overview
Train a LightGBM model to predict quarterly housing price returns using macroeconomic indicators. The primary output is feature importance — showing which macro drivers matter most for each city's price movements.

## Input
- `data/prices.json` — quarterly returns for all 4 cities (target variable)
- `data/macro.json` — macroeconomic indicators (features)

## Feature Engineering

### Base Features (from `macro.json`)
| Feature | Description |
|---|---|
| `cash_rate` | RBA cash rate (level) |
| `cash_rate_change` | QoQ change in cash rate |
| `cpi` | CPI quarterly % change |
| `unemployment` | Unemployment rate (level) |
| `unemployment_change` | QoQ change in unemployment |

### Lagged Features
- For each base feature, create lags of 1, 2, and 4 quarters
- Naming: `{feature}_lag{n}` (e.g., `cash_rate_lag2`)

### Cross-City Features (optional)
- Other cities' lagged returns as features (ties into Granger narrative)
- e.g., for predicting Melbourne: include `sydney_return_lag1`

### Total Features
~15–25 features per city model (5 base × 4 lag variants + optional cross-city)

## Model

### Method
- One LightGBM regressor per city (4 models total)
- Library: `lightgbm.LGBMRegressor`

### Parameters
| Parameter | Value | Rationale |
|---|---|---|
| n_estimators | 200 | Sufficient for small dataset |
| max_depth | 4 | Prevent overfitting on ~80 quarterly observations |
| learning_rate | 0.05 | Conservative for small data |
| subsample | 0.8 | Regularisation |
| colsample_bytree | 0.8 | Regularisation |
| objective | regression | Standard regression (LightGBM name) |
| random_state | 42 | Reproducibility |
| verbose | -1 | Suppress training logs |
| importance_type | gain | Gain-based importance |

### Validation
- Walk-forward cross-validation is preferred but optional for a portfolio project
- At minimum, report in-sample R² and RMSE per city in the JSON metadata
- This is a feature importance exercise, not a forecasting product — model accuracy is secondary to interpretability

### Feature Importance
- Use `model.feature_importances_` with `importance_type="gain"` for gain-based importance
- Normalise to sum to 1.0 per city
- Group lagged variants if desired for cleaner visualisation (e.g., all `cash_rate*` features summed)

## Output JSON

### `data/lightgbm.json`
```json
{
  "meta": {
    "method": "LightGBM Regressor",
    "n_estimators": 200,
    "max_depth": 4,
    "validation": "walk-forward CV",
    "min_train_size": 20
  },
  "cities": {
    "sydney": {
      "r_squared": -0.01,
      "rmse": 0.012,
      "r_squared_train": 0.76,
      "rmse_train": 0.008,
      "n_train": 64,
      "n_folds": 23,
      "features": [
        { "name": "cash_rate_change_lag1", "importance": 0.22, "group": "Interest Rates" },
        { "name": "unemployment_lag2", "importance": 0.18, "group": "Employment" },
        { "name": "cpi_lag1", "importance": 0.14, "group": "Inflation" },
        { "name": "melbourne_return_lag1", "importance": 0.10, "group": "Cross-City" },
        "..."
      ]
    },
    "melbourne": { "...": "..." },
    "brisbane": { "...": "..." },
    "perth": { "...": "..." }
  }
}
```

> **Note:** The schema uses walk-forward CV fields (`validation`, `min_train_size`, `n_folds`) rather than a single train/test split (`train_fraction`, `n_test`). Walk-forward CV is the preferred validation approach, providing ~40+ true out-of-sample predictions per city. `r_squared` is the out-of-fold R², which can be negative for cities where macro features have limited predictive power (e.g. Sydney).

## Visualisation

### Primary: Horizontal Bar Chart
- **Per city** (city selector: dropdown or tabs)
- Bars sorted descending by importance
- Bar colour coded by group (Interest Rates, Employment, Inflation, Cross-City)
- Show top 10 features (collapse rest into "Other" if many)
- Bar label: feature name (human-readable) + importance value

### Interaction
- Hover on bar: tooltip with exact importance value and feature description
- City selector: switch between city models
- Optional toggle: "Group by category" — aggregates all lags of the same base feature into one bar

### Secondary (optional): Cross-City Comparison
- Small multiples or grouped bar chart showing the #1 most important feature per city side by side
- Highlights structural differences (e.g., Perth driven by unemployment, Sydney by interest rates)

## Python Script
- Location: `python/lightgbm_model.py`
- Reads `data/prices.json` and `data/macro.json`, writes `data/lightgbm.json`
