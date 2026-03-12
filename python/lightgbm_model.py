#!/usr/bin/env python3
"""
LightGBM feature importance analysis for Australian housing markets.

Trains one LGBMRegressor per city to predict quarterly price returns
from macroeconomic features. Outputs gain-based feature importances.

Uses walk-forward cross-validation: an expanding training window predicts
one quarter ahead at each step, collecting true out-of-sample predictions
across the full evaluation period for robust metrics.

Usage:
    python lightgbm_model.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MODEL_PARAMS = {
    "n_estimators": 200,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "objective": "regression",
    "random_state": 42,
    "verbose": -1,
    "importance_type": "gain",
}

# Minimum number of observations required before the first walk-forward fold.
# Walk-forward CV trains on observations 0..t and predicts t+1,
# expanding from MIN_TRAIN_SIZE to n-1.
MIN_TRAIN_SIZE = 20

FEATURE_GROUPS = {
    "cash_rate": "Interest Rates",
    "cash_rate_change": "Interest Rates",
    "cpi": "Inflation",
    "unemployment": "Employment",
    "unemployment_change": "Employment",
}


def load_data():
    with open(DATA_DIR / "prices.json") as f:
        prices = json.load(f)
    with open(DATA_DIR / "macro.json") as f:
        macro = json.load(f)
    return prices, macro


def build_features(prices, macro, target_city):
    """Build feature DataFrame for a given target city."""
    dates = prices["dates"]

    df = pd.DataFrame({"date": dates})

    # Base macro features
    df["cash_rate"] = macro["indicators"]["cash_rate"]
    df["cpi"] = macro["indicators"]["cpi"]
    df["unemployment"] = macro["indicators"]["unemployment"]

    # QoQ changes
    df["cash_rate_change"] = df["cash_rate"].diff()
    df["unemployment_change"] = df["unemployment"].diff()

    # Lagged features (1, 2, 4 quarters)
    base_features = ["cash_rate", "cash_rate_change", "cpi", "unemployment", "unemployment_change"]
    for feat in base_features:
        for lag in [1, 2, 4]:
            df[f"{feat}_lag{lag}"] = df[feat].shift(lag)

    # Cross-city lagged returns
    for city in prices["cities"]:
        if city != target_city:
            returns = prices["series"][city]["returns"]
            returns_clean = [0.0 if v is None else float(v) for v in returns]
            df[f"{city}_return_lag1"] = pd.Series(returns_clean).shift(1)

    # Target
    target_returns = prices["series"][target_city]["returns"]
    df["target"] = [0.0 if v is None else float(v) for v in target_returns]

    # Drop rows with NaN from lagging (first 4 rows)
    df = df.dropna().reset_index(drop=True)

    feature_cols = [c for c in df.columns if c not in ["date", "target"]]
    X = df[feature_cols]
    y = df["target"]

    return X, y, feature_cols


def get_feature_group(feature_name):
    """Assign a feature to its group."""
    # Check cross-city features
    if "_return_lag" in feature_name:
        return "Cross-City"

    # Strip lag suffix to find base feature
    base = feature_name
    for lag_suffix in ["_lag1", "_lag2", "_lag4"]:
        if base.endswith(lag_suffix):
            base = base[: -len(lag_suffix)]
            break

    return FEATURE_GROUPS.get(base, "Other")


def walk_forward_cv(X, y, feature_cols, min_train_size):
    """Walk-forward cross-validation with expanding window.

    For each fold t (from min_train_size to n-1):
      - Train on observations 0..t-1
      - Predict observation t
    Returns aggregated out-of-sample predictions and per-fold importances.

    Why walk-forward: unlike a single train/test split, this evaluates every
    observation from MIN_TRAIN_SIZE onward as a true out-of-sample prediction,
    giving ~40+ test points instead of ~16 for more robust metrics.
    """
    from lightgbm import LGBMRegressor

    n = len(X)
    oof_preds = np.full(n, np.nan)
    importance_accum = np.zeros(len(feature_cols))
    n_folds = 0

    for t in range(min_train_size, n):
        X_train, y_train = X.iloc[:t], y.iloc[:t]
        model = LGBMRegressor(**MODEL_PARAMS)
        model.fit(X_train, y_train)
        oof_preds[t] = model.predict(X.iloc[[t]])[0]

        # Accumulate gain-based importances (only count folds with signal)
        imp = model.feature_importances_
        total = imp.sum()
        if total > 0:
            importance_accum += imp / total
            n_folds += 1

    # Average importances across folds that had non-zero gains, then
    # normalise to sum to 1.0 so displayed percentages are correct.
    if n_folds > 0:
        importance_accum /= n_folds
        final_total = importance_accum.sum()
        if final_total > 0:
            importance_accum /= final_total

    # Mask: only indices where we have OOF predictions
    mask = ~np.isnan(oof_preds)
    return oof_preds, mask, importance_accum, n_folds


def main():
    from lightgbm import LGBMRegressor
    from sklearn.metrics import r2_score, mean_squared_error

    prices, macro = load_data()
    cities = prices["cities"]

    print(f"Training LightGBM models for {len(cities)} cities...")
    print(f"Parameters: {MODEL_PARAMS}")
    print(f"Validation: walk-forward CV (min training window = {MIN_TRAIN_SIZE})")

    output = {
        "meta": {
            "method": "LightGBM Regressor",
            "n_estimators": MODEL_PARAMS["n_estimators"],
            "max_depth": MODEL_PARAMS["max_depth"],
            "validation": "walk-forward CV",
            "min_train_size": MIN_TRAIN_SIZE,
        },
        "cities": {},
    }

    for city in cities:
        print(f"\n  {city}:")
        X, y, feature_cols = build_features(prices, macro, city)
        n = len(X)

        print(f"    Features: {len(feature_cols)}, Observations: {n}")
        print(f"    Walk-forward folds: {n - MIN_TRAIN_SIZE}")

        # Walk-forward CV for robust out-of-sample metrics
        oof_preds, mask, avg_importances, n_folds = walk_forward_cv(
            X, y, feature_cols, MIN_TRAIN_SIZE
        )

        y_oof = y.values[mask]
        preds_oof = oof_preds[mask]
        r2_oof = r2_score(y_oof, preds_oof)
        rmse_oof = float(np.sqrt(mean_squared_error(y_oof, preds_oof)))

        # Full-sample model for in-sample metrics and final feature importances
        full_model = LGBMRegressor(**MODEL_PARAMS)
        full_model.fit(X, y)
        y_full_pred = full_model.predict(X)
        r2_train = r2_score(y, y_full_pred)
        rmse_train = float(np.sqrt(mean_squared_error(y, y_full_pred)))

        print(f"    Full-sample — R² = {r2_train:.4f}, RMSE = {rmse_train:.6f}")
        print(f"    Walk-forward OOF — R² = {r2_oof:.4f}, RMSE = {rmse_oof:.6f} ({n_folds} folds)")

        # Use average walk-forward importances (more stable than single-model)
        features_list = []
        for feat, imp in sorted(zip(feature_cols, avg_importances), key=lambda x: -x[1]):
            features_list.append({
                "name": feat,
                "importance": round(float(imp), 6),
                "group": get_feature_group(feat),
            })

        # Log top 5
        for f in features_list[:5]:
            print(f"    {f['name']}: {f['importance']:.4f} ({f['group']})")

        output["cities"][city] = {
            "r_squared": round(float(r2_oof), 4),
            "rmse": round(float(rmse_oof), 6),
            "r_squared_train": round(float(r2_train), 4),
            "rmse_train": round(float(rmse_train), 6),
            "n_train": n,
            "n_folds": n_folds,
            "features": features_list,
        }

    output_path = DATA_DIR / "lightgbm.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
