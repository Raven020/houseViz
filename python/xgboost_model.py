#!/usr/bin/env python3
"""
LightGBM feature importance analysis for Australian housing markets.

Trains one LGBMRegressor per city to predict quarterly price returns
from macroeconomic features. Outputs gain-based feature importances.

Uses a time-series-aware train/test split (first 75% train, last 25% test)
to produce honest out-of-sample metrics and avoid overfitting on ~60 samples.

Usage:
    python xgboost_model.py
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

# Fraction of data used for training (remainder is test).
# Time-series split: first TRAIN_FRACTION chronologically for training,
# the rest for out-of-sample evaluation.
TRAIN_FRACTION = 0.75

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


def main():
    from lightgbm import LGBMRegressor
    from sklearn.metrics import r2_score, mean_squared_error

    prices, macro = load_data()
    cities = prices["cities"]

    print(f"Training LightGBM models for {len(cities)} cities...")
    print(f"Parameters: {MODEL_PARAMS}")
    print(f"Train/test split: {TRAIN_FRACTION*100:.0f}% / {(1-TRAIN_FRACTION)*100:.0f}% (chronological)")

    output = {
        "meta": {
            "method": "LightGBM Regressor",
            "n_estimators": MODEL_PARAMS["n_estimators"],
            "max_depth": MODEL_PARAMS["max_depth"],
            "train_fraction": TRAIN_FRACTION,
        },
        "cities": {},
    }

    for city in cities:
        print(f"\n  {city}:")
        X, y, feature_cols = build_features(prices, macro, city)
        n = len(X)
        split_idx = int(n * TRAIN_FRACTION)

        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        print(f"    Features: {len(feature_cols)}, "
              f"Train: {len(X_train)}, Test: {len(X_test)}")

        model = LGBMRegressor(**MODEL_PARAMS)
        model.fit(X_train, y_train)

        # In-sample metrics (train set)
        y_train_pred = model.predict(X_train)
        r2_train = r2_score(y_train, y_train_pred)
        rmse_train = float(np.sqrt(mean_squared_error(y_train, y_train_pred)))

        # Out-of-sample metrics (test set)
        y_test_pred = model.predict(X_test)
        r2_test = r2_score(y_test, y_test_pred)
        rmse_test = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))

        print(f"    Train — R² = {r2_train:.4f}, RMSE = {rmse_train:.6f}")
        print(f"    Test  — R² = {r2_test:.4f}, RMSE = {rmse_test:.6f}")

        # Feature importances (gain-based) from train-set model
        importances = model.feature_importances_
        total = importances.sum()
        if total > 0:
            importances = importances / total  # Normalise to sum=1

        features_list = []
        for feat, imp in sorted(zip(feature_cols, importances), key=lambda x: -x[1]):
            features_list.append({
                "name": feat,
                "importance": round(float(imp), 6),
                "group": get_feature_group(feat),
            })

        # Log top 5
        for f in features_list[:5]:
            print(f"    {f['name']}: {f['importance']:.4f} ({f['group']})")

        output["cities"][city] = {
            "r_squared": round(float(r2_test), 4),
            "rmse": round(float(rmse_test), 6),
            "r_squared_train": round(float(r2_train), 4),
            "rmse_train": round(float(rmse_train), 6),
            "n_train": len(X_train),
            "n_test": len(X_test),
            "features": features_list,
        }

    output_path = DATA_DIR / "xgboost.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
