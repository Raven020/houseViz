#!/usr/bin/env python3
"""
Granger causality analysis for Australian housing price returns.

Runs pairwise Granger causality tests across all city pairs using
statsmodels F-test. Outputs data/granger.json.

Usage:
    python granger.py
"""

import json
import itertools
import warnings
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MAX_LAG = 8
SIGNIFICANCE = 0.05


def load_prices():
    with open(DATA_DIR / "prices.json") as f:
        return json.load(f)


def granger_causality_test(x, y, max_lag):
    """
    Test if x Granger-causes y using OLS F-test.
    Returns dict with optimal_lag, p_value, f_statistic, significant.
    """
    try:
        from statsmodels.tsa.stattools import grangercausalitytests
        # grangercausalitytests expects a 2D array [y, x] where we test if x causes y
        data = np.column_stack([y, x])

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            results = grangercausalitytests(data, maxlag=max_lag, verbose=False)

        best_lag = None
        best_pvalue = 1.0
        best_fstat = 0.0

        for lag in range(1, max_lag + 1):
            if lag in results:
                test_result = results[lag][0]
                ftest = test_result["ssr_ftest"]
                pvalue = ftest[1]
                fstat = ftest[0]

                if pvalue < best_pvalue:
                    best_pvalue = pvalue
                    best_fstat = fstat
                    best_lag = lag

        return {
            "optimal_lag": best_lag or 1,
            "p_value": round(float(best_pvalue), 6),
            "f_statistic": round(float(best_fstat), 4),
            "significant": best_pvalue < SIGNIFICANCE,
        }
    except Exception as e:
        print(f"  Warning: Granger test failed: {e}")
        return {
            "optimal_lag": 1,
            "p_value": 1.0,
            "f_statistic": 0.0,
            "significant": False,
        }


def run_adf_test(series, name):
    """Run Augmented Dickey-Fuller test and log result."""
    try:
        from statsmodels.tsa.stattools import adfuller
        result = adfuller(series, autolag="AIC")
        stationary = result[1] < 0.05
        print(f"  ADF test for {name}: statistic={result[0]:.4f}, p-value={result[1]:.4f} → {'stationary' if stationary else 'NON-STATIONARY'}")
        return stationary
    except Exception as e:
        print(f"  ADF test failed for {name}: {e}")
        return True  # Assume stationary if test fails


def main():
    prices = load_prices()
    cities = prices["cities"]

    print(f"Running Granger causality tests for {len(cities)} cities...")
    print(f"Parameters: max_lag={MAX_LAG}, significance={SIGNIFICANCE}")

    # Extract return series (skip first None)
    returns = {}
    for city in cities:
        ret = prices["series"][city]["returns"]
        # Replace None with 0 for the first value, then convert to float array
        clean = [0.0 if v is None else float(v) for v in ret]
        returns[city] = np.array(clean[1:])  # Skip first quarter (no return)

    # ADF stationarity check
    print("\nStationarity checks (ADF test on returns):")
    for city in cities:
        run_adf_test(returns[city], city)

    # Pairwise Granger tests
    results = []
    pairs = list(itertools.permutations(cities, 2))
    print(f"\nTesting {len(pairs)} directed pairs...")

    for from_city, to_city in pairs:
        result = granger_causality_test(returns[from_city], returns[to_city], MAX_LAG)
        result["from"] = from_city
        result["to"] = to_city
        results.append(result)
        sig_marker = "***" if result["significant"] else ""
        print(f"  {from_city} → {to_city}: lag={result['optimal_lag']}, "
              f"p={result['p_value']:.4f}, F={result['f_statistic']:.2f} {sig_marker}")

    significant_count = sum(1 for r in results if r["significant"])
    print(f"\n{significant_count}/{len(results)} pairs significant at α={SIGNIFICANCE}")

    # Output
    output = {
        "meta": {
            "method": "Granger causality (F-test)",
            "max_lag": MAX_LAG,
            "significance": SIGNIFICANCE,
        },
        "results": [
            {
                "from": r["from"],
                "to": r["to"],
                "optimal_lag": r["optimal_lag"],
                "p_value": r["p_value"],
                "f_statistic": r["f_statistic"],
                "significant": bool(r["significant"]),
            }
            for r in results
        ],
    }

    output_path = DATA_DIR / "granger.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
