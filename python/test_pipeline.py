#!/usr/bin/env python3
"""Tests for the data pipeline and analysis scripts."""

import json
import os
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_prices_json():
    """Validate prices.json schema and integrity."""
    path = DATA_DIR / "prices.json"
    assert path.exists(), f"{path} does not exist"

    with open(path) as f:
        data = json.load(f)

    assert "meta" in data
    assert "cities" in data
    assert "dates" in data
    assert "series" in data

    dates = data["dates"]
    assert len(dates) > 0, "dates array is empty"

    for city in data["cities"]:
        assert city in data["series"], f"Missing series for {city}"
        series = data["series"][city]
        assert "index" in series, f"Missing index for {city}"
        assert "returns" in series, f"Missing returns for {city}"
        assert len(series["index"]) == len(dates), \
            f"{city} index length {len(series['index'])} != dates length {len(dates)}"
        assert len(series["returns"]) == len(dates), \
            f"{city} returns length mismatch"

        # No NaN in index
        for i, v in enumerate(series["index"]):
            assert v is not None, f"{city} index has None at {i}"

        # First return is null, rest are not
        assert series["returns"][0] is None, f"{city} first return should be null"
        for i, v in enumerate(series["returns"][1:], 1):
            assert v is not None, f"{city} return has None at {i}"

    print(f"  prices.json: OK ({len(dates)} quarters, {len(data['cities'])} cities)")


def test_macro_json():
    """Validate macro.json schema and integrity."""
    path = DATA_DIR / "macro.json"
    assert path.exists(), f"{path} does not exist"

    with open(path) as f:
        data = json.load(f)

    assert "meta" in data
    assert "dates" in data
    assert "indicators" in data

    dates = data["dates"]
    for indicator in ["cash_rate", "cpi", "unemployment"]:
        assert indicator in data["indicators"], f"Missing {indicator}"
        values = data["indicators"][indicator]
        assert len(values) == len(dates), f"{indicator} length mismatch"
        for i, v in enumerate(values):
            assert v is not None, f"{indicator} has None at {i}"

    print(f"  macro.json: OK ({len(dates)} quarters, 3 indicators)")


def test_granger_json():
    """Validate granger.json schema."""
    path = DATA_DIR / "granger.json"
    assert path.exists(), f"{path} does not exist"

    with open(path) as f:
        data = json.load(f)

    assert "meta" in data
    assert "results" in data
    assert data["meta"]["max_lag"] == 8
    assert data["meta"]["significance"] == 0.05

    # Should have n*(n-1) directed pairs where n = number of cities
    with open(DATA_DIR / "prices.json") as pf:
        prices = json.load(pf)
    n_cities = len(prices["cities"])
    expected_pairs = n_cities * (n_cities - 1)
    assert len(data["results"]) == expected_pairs, \
        f"Expected {expected_pairs} pairs ({n_cities} cities), got {len(data['results'])}"

    for r in data["results"]:
        assert "from" in r
        assert "to" in r
        assert "optimal_lag" in r
        assert "p_value" in r
        assert "f_statistic" in r
        assert "significant" in r
        assert isinstance(r["significant"], bool)
        assert 1 <= r["optimal_lag"] <= 8
        assert 0 <= r["p_value"] <= 1

    print(f"  granger.json: OK ({len(data['results'])} pairs)")


def test_hmm_json():
    """Validate hmm.json schema."""
    path = DATA_DIR / "hmm.json"
    assert path.exists(), f"{path} does not exist"

    with open(path) as f:
        data = json.load(f)

    assert "meta" in data
    assert "cities" in data
    assert "dates" in data
    assert data["meta"]["n_states"] == 3

    dates = data["dates"]
    valid_regimes = {"boom", "stagnation", "correction"}

    for city, city_data in data["cities"].items():
        assert "regimes" in city_data
        assert "state_params" in city_data
        assert "transition_matrix" in city_data

        assert len(city_data["regimes"]) == len(dates), \
            f"{city} regimes length mismatch"

        for r in city_data["regimes"]:
            assert r in valid_regimes, f"Invalid regime '{r}' for {city}"

        # Transition matrix dimensions match actual state count
        actual_n = city_data.get("actual_n_states", data["meta"]["n_states"])
        tm = city_data["transition_matrix"]
        assert len(tm) == actual_n, \
            f"{city} transition matrix has {len(tm)} rows, expected {actual_n}"
        for row in tm:
            assert len(row) == actual_n, \
                f"{city} transition matrix row has {len(row)} cols, expected {actual_n}"

    print(f"  hmm.json: OK ({len(data['cities'])} cities)")


def test_lightgbm_json():
    """Validate lightgbm.json schema."""
    path = DATA_DIR / "lightgbm.json"
    assert path.exists(), f"{path} does not exist"

    with open(path) as f:
        data = json.load(f)

    assert "meta" in data
    assert "cities" in data

    for city, city_data in data["cities"].items():
        assert "r_squared" in city_data, f"{city} missing r_squared"
        assert "rmse" in city_data, f"{city} missing rmse"
        assert "features" in city_data, f"{city} missing features"
        assert len(city_data["features"]) > 0

        # Out-of-sample R² should be substantially below 1.0 (sanity check)
        assert city_data["r_squared"] < 0.99, \
            f"{city} out-of-sample R²={city_data['r_squared']} suspiciously high"

        # Walk-forward CV metadata
        assert "n_train" in city_data, f"{city} missing n_train"
        assert "n_folds" in city_data, f"{city} missing n_folds"
        assert city_data["n_folds"] > 0, f"{city} n_folds must be > 0"

        # Feature importances should sum to ~1.0
        total_imp = sum(f["importance"] for f in city_data["features"])
        assert 0.99 <= total_imp <= 1.01, \
            f"{city} feature importances sum to {total_imp}, expected ~1.0"

        for feat in city_data["features"]:
            assert "name" in feat
            assert "importance" in feat
            assert "group" in feat
            assert feat["importance"] >= 0

    print(f"  lightgbm.json: OK ({len(data['cities'])} cities)")


if __name__ == "__main__":
    print("Running data validation tests...")
    tests = [test_prices_json, test_macro_json, test_granger_json, test_hmm_json, test_lightgbm_json]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  FAIL: {test.__name__}: {e}")
            failed += 1

    print(f"\n{passed}/{passed + failed} tests passed")
    if failed:
        sys.exit(1)
