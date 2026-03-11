#!/usr/bin/env python3
"""
Data pipeline for Australian Housing Market Econometrics.

Phase 1: Generates synthetic data for frontend development.
Phase 2: Will fetch real ABS/RBA data (see TODO markers).

Usage:
    python data_pipeline.py              # generate synthetic data
    python data_pipeline.py --real       # fetch real ABS/RBA data (not yet implemented)
"""

import json
import os
import sys
import math
import random
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

CITIES = ["sydney", "melbourne", "brisbane", "perth", "gold_coast"]

def generate_dates(start_year=2005, end_year=2025):
    """Generate quarterly date strings from start_year Q1 to end_year Q4."""
    dates = []
    for year in range(start_year, end_year + 1):
        for q in range(1, 5):
            dates.append(f"{year}-Q{q}")
    return dates


def generate_synthetic_prices(dates):
    """
    Generate synthetic but realistic-looking price index data for all cities.
    Uses a random walk with drift and city-specific characteristics to produce
    plausible Australian housing market trajectories.
    """
    random.seed(42)
    n = len(dates)

    # City-specific parameters: (initial_index, drift, volatility, gfc_sensitivity)
    city_params = {
        "sydney":     (100.0, 0.015, 0.020, 0.7),
        "melbourne":  (100.0, 0.014, 0.018, 0.6),
        "brisbane":   (100.0, 0.012, 0.022, 0.8),
        "perth":      (100.0, 0.010, 0.025, 0.9),
        "gold_coast": (100.0, 0.011, 0.024, 0.85),
    }

    series = {}
    for city in CITIES:
        initial, drift, vol, gfc_sens = city_params[city]
        index_values = [initial]
        returns = [None]  # First quarter has no return

        for i in range(1, n):
            year = 2005 + i // 4
            # Simulate GFC dip (2008-2009)
            gfc_effect = 0
            if 2008 <= year <= 2009:
                gfc_effect = -0.02 * gfc_sens
            # Simulate COVID dip then boom (2020-2021)
            covid_effect = 0
            if year == 2020 and (i % 4) < 2:
                covid_effect = -0.015 * gfc_sens
            elif 2020 <= year <= 2021 and (i % 4) >= 2:
                covid_effect = 0.025

            # Simulate mining boom effect on Perth (2010-2013)
            mining_effect = 0
            if city == "perth" and 2010 <= year <= 2013:
                mining_effect = 0.01

            ret = drift + gfc_effect + covid_effect + mining_effect + random.gauss(0, vol)
            new_val = index_values[-1] * (1 + ret)
            index_values.append(round(new_val, 1))
            returns.append(round(ret, 6))

        series[city] = {
            "index": index_values,
            "returns": returns,
        }

    return series


def generate_synthetic_macro(dates):
    """Generate synthetic macroeconomic indicators."""
    random.seed(123)
    n = len(dates)

    cash_rates = []
    cpis = []
    unemployment = []

    rate = 5.25  # Starting cash rate
    ue = 5.1     # Starting unemployment

    for i in range(n):
        year = 2005 + i // 4
        q = i % 4

        # Cash rate trajectory
        if year < 2008:
            rate += random.gauss(0.05, 0.1)
        elif 2008 <= year <= 2009:
            rate -= random.gauss(0.3, 0.1)
        elif 2010 <= year <= 2011:
            rate += random.gauss(0.05, 0.05)
        elif 2012 <= year <= 2019:
            rate -= random.gauss(0.05, 0.05)
        elif year == 2020:
            rate = max(0.1, rate - 0.3)
        elif year >= 2022:
            rate += random.gauss(0.15, 0.1)

        rate = max(0.1, min(7.5, rate))
        cash_rates.append(round(rate, 2))

        # CPI (quarterly % change)
        base_cpi = 0.6 + random.gauss(0, 0.3)
        if year >= 2022:
            base_cpi += 0.5  # Inflation spike
        cpis.append(round(base_cpi, 2))

        # Unemployment
        if 2008 <= year <= 2009:
            ue += random.gauss(0.15, 0.1)
        elif year == 2020:
            ue += random.gauss(0.3, 0.2)
        elif year >= 2021:
            ue -= random.gauss(0.1, 0.05)
        else:
            ue += random.gauss(-0.02, 0.1)

        ue = max(3.0, min(8.0, ue))
        unemployment.append(round(ue, 1))

    return {
        "cash_rate": cash_rates,
        "cpi": cpis,
        "unemployment": unemployment,
    }


def validate_no_nan(data, label):
    """Ensure no None/NaN in the data (except first return which is null by spec)."""
    if isinstance(data, list):
        for i, v in enumerate(data):
            if v is None and not (label.endswith("returns") and i == 0):
                raise ValueError(f"NaN/None found in {label} at index {i}")
    elif isinstance(data, dict):
        for key, val in data.items():
            validate_no_nan(val, f"{label}.{key}")


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    dates = generate_dates(2005, 2025)
    series = generate_synthetic_prices(dates)
    macro_indicators = generate_synthetic_macro(dates)

    # Validate
    for city in CITIES:
        assert len(series[city]["index"]) == len(dates), \
            f"{city} index length mismatch: {len(series[city]['index'])} vs {len(dates)}"
        assert len(series[city]["returns"]) == len(dates), \
            f"{city} returns length mismatch"
        validate_no_nan(series[city]["index"], f"{city}.index")

    for indicator in ["cash_rate", "cpi", "unemployment"]:
        assert len(macro_indicators[indicator]) == len(dates), \
            f"{indicator} length mismatch"
        validate_no_nan(macro_indicators[indicator], indicator)

    # Write prices.json
    prices_data = {
        "meta": {
            "source": "Synthetic data (development only)",
            "last_updated": "2026-03-11",
            "base_period": "2011-12 = 100",
            "frequency": "quarterly",
        },
        "cities": CITIES,
        "dates": dates,
        "series": series,
    }

    prices_path = DATA_DIR / "prices.json"
    with open(prices_path, "w") as f:
        json.dump(prices_data, f, indent=2)
    print(f"Wrote {prices_path} ({len(dates)} quarters, {len(CITIES)} cities)")

    # Write macro.json
    macro_data = {
        "meta": {
            "sources": ["Synthetic (development only)"],
        },
        "dates": dates,
        "indicators": macro_indicators,
    }

    macro_path = DATA_DIR / "macro.json"
    with open(macro_path, "w") as f:
        json.dump(macro_data, f, indent=2)
    print(f"Wrote {macro_path}")

    print("Data pipeline complete.")


if __name__ == "__main__":
    main()
