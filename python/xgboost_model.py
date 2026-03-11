#!/usr/bin/env python3
"""
XGBoost feature importance analysis for Australian housing markets.

Trains one XGBRegressor per city to predict quarterly price returns
from macroeconomic features. Outputs gain-based feature importances.

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
    "objective": "reg:squarederror",
    "random_state": 42,
}

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
    n = len(dates)

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
    from xgboost import XGBRegressor
    from sklearn.metrics import r2_score, mean_squared_error

    prices, macro = load_data()
    cities = prices["cities"]

    print(f"Training XGBoost models for {len(cities)} cities...")
    print(f"Parameters: {MODEL_PARAMS}")

    output = {
        "meta": {
            "method": "XGBoost Regressor",
            "n_estimators": MODEL_PARAMS["n_estimators"],
            "max_depth": MODEL_PARAMS["max_depth"],
        },
        "cities": {},
    }

    for city in cities:
        print(f"\n  {city}:")
        X, y, feature_cols = build_features(prices, macro, city)
        print(f"    Features: {len(feature_cols)}, Samples: {len(X)}")

        model = XGBRegressor(**MODEL_PARAMS)
        model.fit(X, y)

        # Predictions & metrics
        y_pred = model.predict(X)
        r2 = r2_score(y, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
        print(f"    R² = {r2:.4f}, RMSE = {rmse:.6f}")

        # Feature importances (gain-based)
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
            "r_squared": round(float(r2), 4),
            "rmse": round(float(rmse), 6),
            "features": features_list,
        }

    output_path = DATA_DIR / "xgboost.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
