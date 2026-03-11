# LightGBM Feature Importance Specification

## Overview
Train a LightGBM model to predict quarterly housing price returns using macroeconomic indicators. The primary output is feature importance — showing which macro drivers matter most for each city's price movements.

## Migration from XGBoost
This module originally used XGBoost (`xgboost.XGBRegressor`). It has been migrated to LightGBM (`lightgbm.LGBMRegressor`) for the following reasons:
- Faster training on small–medium datasets
- Native categorical feature support (not currently used, but available for future work)
- Comparable or better generalisation with default regularisation

### What Changed
| Aspect | Before (XGBoost) | After (LightGBM) |
|---|---|---|
| Library | `xgboost>=2.0` | `lightgbm>=4.0` |
| Class | `xgboost.XGBRegressor` | `lightgbm.LGBMRegressor` |
| Objective param | `objective="reg:squarederror"` | `objective="regression"` |
| Subsample param | `subsample` | `subsample` (same name) |
| Column sampling param | `colsample_bytree` | `colsample_bytree` (same name) |
| Verbosity | default | `verbose=-1` (suppress iteration logs) |
| Feature importance | `model.feature_importances_` (gain) | `model.feature_importances_` (split-based by default; set `importance_type="gain"` for gain-based) |
| Output file | `data/xgboost.json` | `data/xgboost.json` (filename kept for compatibility) |
| Script | `python/xgboost_model.py` | `python/xgboost_model.py` (filename kept for compatibility) |
| Meta field | `"method": "XGBoost Regressor"` | `"method": "LightGBM Regressor"` |

### Frontend Text Updates
All user-facing references to "XGBoost" should be updated to "LightGBM":
- `src/components/XGBoostSection.jsx` — section title, explanation paragraph, aria-label
- `src/components/Header.jsx` — intro paragraph
- `src/components/Footer.jsx` — methodology note

The component filename (`XGBoostSection.jsx`) and data key (`xgboost`) in the data loader may optionally be renamed but are not required to change since they are internal identifiers.

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
| importance_type | gain | Gain-based importance (matches previous XGBoost behaviour) |

### Validation
- Walk-forward cross-validation is preferred but optional for a portfolio project
- At minimum, report in-sample R² and RMSE per city in the JSON metadata
- This is a feature importance exercise, not a forecasting product — model accuracy is secondary to interpretability

### Feature Importance
- Use `model.feature_importances_` with `importance_type="gain"` to match previous XGBoost gain-based output
- Normalise to sum to 1.0 per city
- Group lagged variants if desired for cleaner visualisation (e.g., all `cash_rate*` features summed)

## Output JSON

### `data/xgboost.json`
```json
{
  "meta": {
    "method": "LightGBM Regressor",
    "n_estimators": 200,
    "max_depth": 4,
    "train_fraction": 0.75
  },
  "cities": {
    "sydney": {
      "r_squared": 0.45,
      "rmse": 0.012,
      "r_squared_train": 0.78,
      "rmse_train": 0.008,
      "n_train": 45,
      "n_test": 15,
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
- Location: `python/xgboost_model.py`
- Reads `data/prices.json` and `data/macro.json`, writes `data/xgboost.json`
