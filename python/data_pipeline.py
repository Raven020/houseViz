#!/usr/bin/env python3
"""
Data pipeline for Australian Housing Market Econometrics.

Fetches real data from ABS and RBA:
- ABS Cat. 6416.0: Residential Property Price Indexes (ceased Dec 2021)
- RBA F1.1: Cash rate target (monthly → quarterly)
- ABS Cat. 6401.0: Consumer Price Index (quarterly)
- ABS Cat. 6202.0: Labour Force / unemployment (monthly → quarterly)

Gold Coast: Not available in ABS 6416.0 (capital cities only). Dropped to 4 cities.
Date range: Q1 2005 – Q4 2021 (constrained by RPPI cessation).

Usage:
    python3 data_pipeline.py           # fetch real data (with synthetic fallback)
    python3 data_pipeline.py --synthetic  # force synthetic data
"""

import json
import os
import sys
import io
import math
import random
import logging
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# ABS 6416.0 covers 8 capital cities only — no Gold Coast SA4 data available.
CITIES = ["sydney", "melbourne", "brisbane", "perth"]

# ABS Excel data format: metadata rows at top, then time series data.
# The Data1 sheet has series descriptions in row 1, Series IDs in row ~10,
# and actual data starting around row 11.

ABS_RPPI_URL = "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641601.xlsx"
ABS_CPI_URL = "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/dec-quarter-2024/640101.xlsx"
ABS_LABOUR_URL = "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/jan-2026/6202001.xlsx"
RBA_CASH_RATE_URL = "https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv"

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)


def download_file(url, description):
    """Download a file from URL, return bytes content."""
    import requests
    log.info(f"  Downloading {description}...")
    log.info(f"    URL: {url}")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    log.info(f"    Downloaded {len(resp.content)} bytes")
    return resp.content


def date_to_quarter(dt):
    """Convert a datetime to 'YYYY-QN' string."""
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def parse_abs_excel(content, description):
    """
    Parse an ABS time-series Excel file (Data1 sheet).
    Returns (dates, columns_info) where columns_info is a list of dicts with:
      - col_idx: integer column index in the raw DataFrame
      - description: series description from row 0
      - series_type: Trend/Seasonally Adjusted/Original from row 2
      - series_id: ABS Series ID from row 9
      - values: list of float values
    """
    import pandas as pd
    log.info(f"  Parsing {description}...")

    xls = pd.ExcelFile(io.BytesIO(content))
    data_sheet = None
    for name in xls.sheet_names:
        if name.lower().startswith("data"):
            data_sheet = name
            break

    if data_sheet is None:
        raise ValueError(f"No Data sheet found in {description}. Sheets: {xls.sheet_names}")

    df_raw = pd.read_excel(xls, sheet_name=data_sheet, header=None)

    # Row 0: descriptions, Row 2: series type, Row 9: Series IDs
    descriptions = [str(df_raw.iloc[0, c]).strip() if c > 0 else "" for c in range(df_raw.shape[1])]
    series_types = [str(df_raw.iloc[2, c]).strip() if 2 < df_raw.shape[0] and c > 0 else "" for c in range(df_raw.shape[1])]
    series_ids = [str(df_raw.iloc[9, c]).strip() if 9 < df_raw.shape[0] and c > 0 else "" for c in range(df_raw.shape[1])]

    # Find data start row
    data_start = None
    for i in range(1, min(15, len(df_raw))):
        val = df_raw.iloc[i, 0]
        if isinstance(val, (datetime, pd.Timestamp)):
            data_start = i
            break
        try:
            pd.to_datetime(val)
            data_start = i
            break
        except (ValueError, TypeError):
            continue

    if data_start is None:
        raise ValueError(f"Could not find data start row in {description}")

    # Extract dates
    dates = [pd.to_datetime(df_raw.iloc[r, 0]) for r in range(data_start, len(df_raw))]

    # Extract each column as a separate series
    columns_info = []
    for c in range(1, df_raw.shape[1]):
        values = []
        for r in range(data_start, len(df_raw)):
            v = df_raw.iloc[r, c]
            try:
                values.append(float(v))
            except (ValueError, TypeError):
                values.append(None)

        columns_info.append({
            "col_idx": c,
            "description": descriptions[c],
            "series_type": series_types[c],
            "series_id": series_ids[c],
            "values": values,
        })

    log.info(f"    Data starts at row {data_start}, {len(columns_info)} series, {len(dates)} rows")
    return dates, columns_info


def fetch_rppi(content):
    """
    Parse ABS 6416.0 RPPI data for Sydney, Melbourne, Brisbane, Perth.
    Returns dict of {city: {dates, index_values}}.
    """
    raw_dates, columns = parse_abs_excel(content, "ABS 6416.0 RPPI")

    city_keywords = {
        "sydney": "sydney",
        "melbourne": "melbourne",
        "brisbane": "brisbane",
        "perth": "perth",
    }

    results = {}
    for city, keyword in city_keywords.items():
        # Find column with city keyword and "Index" in description
        matching = [
            c for c in columns
            if keyword.lower() in c["description"].lower()
            and "index" in c["description"].lower()
        ]
        if not matching:
            matching = [c for c in columns if keyword.lower() in c["description"].lower()]

        if not matching:
            log.warning(f"    WARNING: No column found for {city}")
            continue

        col = matching[0]
        log.info(f"    {city}: '{col['description'][:80]}'")

        # Build date→value pairs, skipping None
        dates = []
        values = []
        for dt, v in zip(raw_dates, col["values"]):
            if v is not None:
                dates.append(date_to_quarter(dt))
                values.append(round(v, 1))

        results[city] = {"dates": dates, "values": values}

    return results


def fetch_rba_cash_rate(content):
    """
    Parse RBA F1.1 CSV for monthly cash rate target.
    Returns DataFrame with date index and 'cash_rate' column.
    """
    import pandas as pd
    log.info("  Parsing RBA cash rate CSV...")

    # RBA CSV has a title row, then description row, then data
    lines = content.decode("utf-8", errors="replace").splitlines()

    # Find the data start — look for rows that start with a date pattern
    data_lines = []
    header_found = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Check if line starts with a date (DD/MM/YYYY or DD-Mon-YYYY)
        parts = stripped.split(",")
        if len(parts) >= 2:
            try:
                pd.to_datetime(parts[0].strip(), dayfirst=True)
                data_lines.append(stripped)
            except (ValueError, TypeError):
                if not header_found and "title" in stripped.lower():
                    header_found = True

    if not data_lines:
        raise ValueError("No data rows found in RBA CSV")

    log.info(f"    Found {len(data_lines)} data rows")

    # Parse into DataFrame
    records = []
    for line in data_lines:
        parts = line.split(",")
        try:
            dt = pd.to_datetime(parts[0].strip(), dayfirst=True)
            # Cash Rate Target is the second column
            rate_str = parts[1].strip() if len(parts) > 1 else ""
            rate = float(rate_str) if rate_str else None
            if rate is not None:
                records.append({"date": dt, "cash_rate": rate})
        except (ValueError, IndexError):
            continue

    df = pd.DataFrame(records).set_index("date").sort_index()
    log.info(f"    Cash rate range: {df.index[0].strftime('%Y-%m')} to {df.index[-1].strftime('%Y-%m')}")
    return df


def fetch_cpi(content):
    """
    Parse ABS 6401.0 CPI data.
    Returns dict of {quarter_str: cpi_value} for QoQ percentage change.
    """
    raw_dates, columns = parse_abs_excel(content, "ABS 6401.0 CPI")

    # Want: "Percentage Change from Previous Period ; All groups CPI ; Australia"
    qoq_cols = [
        c for c in columns
        if "percentage change from previous period" in c["description"].lower()
        and "all groups" in c["description"].lower()
        and "australia" in c["description"].lower()
    ]

    if qoq_cols:
        col = qoq_cols[0]
        log.info(f"    CPI QoQ: '{col['description'][:80]}'")
    else:
        # Fallback: use index numbers and compute QoQ change
        idx_cols = [
            c for c in columns
            if "index numbers" in c["description"].lower()
            and "all groups" in c["description"].lower()
            and "australia" in c["description"].lower()
        ]
        if idx_cols:
            col = idx_cols[0]
            log.info(f"    CPI: computing QoQ change from '{col['description'][:80]}'")
            # Compute pct change
            prev = None
            computed_values = []
            for v in col["values"]:
                if v is not None and prev is not None:
                    computed_values.append(round((v - prev) / prev * 100, 2))
                else:
                    computed_values.append(None)
                prev = v
            col = dict(col)  # copy
            col["values"] = computed_values
        else:
            raise ValueError("Could not find CPI column")

    result = {}
    for dt, v in zip(raw_dates, col["values"]):
        if v is not None:
            result[date_to_quarter(dt)] = round(float(v), 2)

    log.info(f"    CPI: {len(result)} quarters")
    return result


def fetch_unemployment(content):
    """
    Parse ABS 6202.0 labour force data for national unemployment rate.
    Returns dict of {quarter_str: ue_value} (monthly resampled to quarterly end-of-quarter).
    """
    import pandas as pd
    raw_dates, columns = parse_abs_excel(content, "ABS 6202.0 Labour Force")

    # Find "Unemployment rate ; Persons ;" with "Seasonally Adjusted" series type
    ue_cols = [
        c for c in columns
        if "unemployment rate" in c["description"].lower()
        and "person" in c["description"].lower()
        and "looked for" not in c["description"].lower()
    ]

    # Prefer Seasonally Adjusted
    sa_cols = [c for c in ue_cols if "seasonally adjusted" in c["series_type"].lower()]
    col = sa_cols[0] if sa_cols else (ue_cols[0] if ue_cols else None)

    if col is None:
        raise ValueError("Could not find unemployment rate column")

    log.info(f"    Unemployment: '{col['description'][:60]}' ({col['series_type']}, ID={col['series_id']})")

    # Build monthly series then resample to quarterly
    monthly = {}
    for dt, v in zip(raw_dates, col["values"]):
        if v is not None:
            monthly[dt] = round(float(v), 1)

    # Convert to pandas Series for resampling
    s = pd.Series(monthly).sort_index()
    # Resample to quarterly (end-of-quarter, take last month's value)
    q = s.resample("QE").last().dropna()

    result = {}
    for dt, v in q.items():
        result[date_to_quarter(dt)] = round(float(v), 1)

    log.info(f"    Unemployment quarterly: {len(result)} quarters")
    return result


def resample_monthly_to_quarterly(df, method="last"):
    """
    Resample monthly data to quarterly.
    method: 'last' uses end-of-quarter value, 'mean' uses quarter average.
    """
    import pandas as pd
    # Resample to quarter-end, taking the last value
    if method == "last":
        return df.resample("QE").last()
    else:
        return df.resample("QE").mean()


def align_to_common_dates(price_data, macro_data, start="2005-Q1"):
    """
    Align all series to a common quarterly date range.
    Forward-fill gaps up to 1 quarter.
    """
    import pandas as pd

    # Find the common date range
    all_date_sets = []
    for city, data in price_data.items():
        all_date_sets.append(set(data["dates"]))

    common_dates = set.intersection(*all_date_sets) if all_date_sets else set()

    # Filter to start date onwards
    start_year, start_q = start.split("-Q")
    start_year, start_q = int(start_year), int(start_q)

    common_dates = sorted([
        d for d in common_dates
        if (int(d.split("-Q")[0]) > start_year) or
           (int(d.split("-Q")[0]) == start_year and int(d.split("-Q")[1]) >= start_q)
    ])

    if not common_dates:
        raise ValueError("No common dates found across all price series")

    # Also constrain by macro data availability
    macro_dates = set(macro_data.get("dates", []))
    if macro_dates:
        common_dates = [d for d in common_dates if d in macro_dates]

    log.info(f"  Common date range: {common_dates[0]} to {common_dates[-1]} ({len(common_dates)} quarters)")
    return common_dates


def fetch_real_data():
    """
    Fetch and process real ABS/RBA data.
    Returns (cities, dates, series, macro_indicators) or raises on failure.
    """
    import pandas as pd

    # Download all files
    rppi_content = download_file(ABS_RPPI_URL, "ABS 6416.0 RPPI")
    rba_content = download_file(RBA_CASH_RATE_URL, "RBA Cash Rate")
    cpi_content = download_file(ABS_CPI_URL, "ABS 6401.0 CPI")
    labour_content = download_file(ABS_LABOUR_URL, "ABS 6202.0 Labour Force")

    # Parse housing prices
    log.info("\nProcessing housing prices...")
    price_data = fetch_rppi(rppi_content)
    cities = sorted(price_data.keys())
    log.info(f"  Cities available: {cities}")

    if not cities:
        raise ValueError("No city price data found")

    # Parse macro indicators
    log.info("\nProcessing cash rate...")
    cash_rate_df = fetch_rba_cash_rate(rba_content)
    # Resample monthly → quarterly (end-of-quarter value)
    cash_rate_q = resample_monthly_to_quarterly(cash_rate_df, method="last")
    log.info(f"  Cash rate quarterly: {len(cash_rate_q)} quarters")
    cash_lookup = {date_to_quarter(d): round(float(v), 2) for d, v in cash_rate_q["cash_rate"].items()}

    log.info("\nProcessing CPI...")
    cpi_lookup = fetch_cpi(cpi_content)  # returns dict

    log.info("\nProcessing unemployment...")
    ue_lookup = fetch_unemployment(labour_content)  # returns dict

    all_macro_dates = set(cash_lookup.keys()) & set(cpi_lookup.keys()) & set(ue_lookup.keys())
    macro_data = {"dates": sorted(all_macro_dates)}

    # Align all to common dates
    common_dates = align_to_common_dates(price_data, macro_data, start="2005-Q1")

    # Build output series
    series = {}
    for city in cities:
        date_to_val = dict(zip(price_data[city]["dates"], price_data[city]["values"]))
        index_values = []
        for d in common_dates:
            val = date_to_val.get(d)
            if val is None and index_values:
                # Forward-fill up to 1 quarter
                val = index_values[-1]
            if val is None:
                raise ValueError(f"Missing value for {city} at {d} with no forward-fill possible")
            index_values.append(val)

        # Compute QoQ returns
        returns = [None]
        for i in range(1, len(index_values)):
            ret = (index_values[i] - index_values[i - 1]) / index_values[i - 1]
            returns.append(round(float(ret), 6))

        series[city] = {
            "index": index_values,
            "returns": returns,
        }

    # Build macro indicators for common dates
    cash_rates = []
    cpis = []
    unemployment = []
    for d in common_dates:
        cr = cash_lookup.get(d)
        cp = cpi_lookup.get(d)
        ue = ue_lookup.get(d)

        if cr is None or cp is None or ue is None:
            missing = []
            if cr is None: missing.append("cash_rate")
            if cp is None: missing.append("cpi")
            if ue is None: missing.append("unemployment")
            raise ValueError(f"Missing macro data at {d}: {missing}")

        cash_rates.append(round(float(cr), 2))
        cpis.append(round(float(cp), 2))
        unemployment.append(round(float(ue), 1))

    macro_indicators = {
        "cash_rate": cash_rates,
        "cpi": cpis,
        "unemployment": unemployment,
    }

    return cities, common_dates, series, macro_indicators


# ─── Synthetic data fallback ────────────────────────────────────────────────

def generate_dates(start_year=2005, end_year=2025):
    """Generate quarterly date strings."""
    dates = []
    for year in range(start_year, end_year + 1):
        for q in range(1, 5):
            dates.append(f"{year}-Q{q}")
    return dates


def generate_synthetic_prices(dates, cities):
    """Generate synthetic price index data for development."""
    random.seed(42)
    n = len(dates)
    city_params = {
        "sydney":     (100.0, 0.015, 0.020, 0.7),
        "melbourne":  (100.0, 0.014, 0.018, 0.6),
        "brisbane":   (100.0, 0.012, 0.022, 0.8),
        "perth":      (100.0, 0.010, 0.025, 0.9),
        "gold_coast": (100.0, 0.011, 0.024, 0.85),
    }
    series = {}
    for city in cities:
        initial, drift, vol, gfc_sens = city_params.get(city, (100.0, 0.012, 0.02, 0.7))
        index_values = [initial]
        returns = [None]
        for i in range(1, n):
            year = 2005 + i // 4
            gfc_effect = -0.02 * gfc_sens if 2008 <= year <= 2009 else 0
            covid_effect = 0
            if year == 2020 and (i % 4) < 2:
                covid_effect = -0.015 * gfc_sens
            elif 2020 <= year <= 2021 and (i % 4) >= 2:
                covid_effect = 0.025
            mining_effect = 0.01 if city == "perth" and 2010 <= year <= 2013 else 0
            ret = drift + gfc_effect + covid_effect + mining_effect + random.gauss(0, vol)
            new_val = index_values[-1] * (1 + ret)
            index_values.append(round(new_val, 1))
            returns.append(round(ret, 6))
        series[city] = {"index": index_values, "returns": returns}
    return series


def generate_synthetic_macro(dates):
    """Generate synthetic macroeconomic indicators."""
    random.seed(123)
    n = len(dates)
    cash_rates, cpis, unemployment = [], [], []
    rate, ue = 5.25, 5.1
    for i in range(n):
        year = 2005 + i // 4
        if year < 2008: rate += random.gauss(0.05, 0.1)
        elif 2008 <= year <= 2009: rate -= random.gauss(0.3, 0.1)
        elif 2010 <= year <= 2011: rate += random.gauss(0.05, 0.05)
        elif 2012 <= year <= 2019: rate -= random.gauss(0.05, 0.05)
        elif year == 2020: rate = max(0.1, rate - 0.3)
        elif year >= 2022: rate += random.gauss(0.15, 0.1)
        rate = max(0.1, min(7.5, rate))
        cash_rates.append(round(rate, 2))
        base_cpi = 0.6 + random.gauss(0, 0.3) + (0.5 if year >= 2022 else 0)
        cpis.append(round(base_cpi, 2))
        if 2008 <= year <= 2009: ue += random.gauss(0.15, 0.1)
        elif year == 2020: ue += random.gauss(0.3, 0.2)
        elif year >= 2021: ue -= random.gauss(0.1, 0.05)
        else: ue += random.gauss(-0.02, 0.1)
        ue = max(3.0, min(8.0, ue))
        unemployment.append(round(ue, 1))
    return {"cash_rate": cash_rates, "cpi": cpis, "unemployment": unemployment}


# ─── Validation ─────────────────────────────────────────────────────────────

def validate_no_nan(data, label):
    """Ensure no None/NaN in the data (except first return which is null by spec)."""
    if isinstance(data, list):
        for i, v in enumerate(data):
            if v is None and not (label.endswith("returns") and i == 0):
                raise ValueError(f"NaN/None found in {label} at index {i}")
    elif isinstance(data, dict):
        for key, val in data.items():
            validate_no_nan(val, f"{label}.{key}")


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    use_synthetic = "--synthetic" in sys.argv

    if use_synthetic:
        log.info("Using synthetic data (--synthetic flag)")
        cities = ["sydney", "melbourne", "brisbane", "perth", "gold_coast"]
        dates = generate_dates(2005, 2025)
        series = generate_synthetic_prices(dates, cities)
        macro_indicators = generate_synthetic_macro(dates)
        source = "Synthetic data (development only)"
        macro_sources = ["Synthetic (development only)"]
    else:
        log.info("Fetching real ABS/RBA data...")
        try:
            cities, dates, series, macro_indicators = fetch_real_data()
            source = "ABS 6416.0 — Residential Property Price Indexes"
            macro_sources = ["RBA (cash rate)", "ABS 6401.0 (CPI)", "ABS 6202.0 (unemployment)"]
            log.info(f"\nReal data loaded: {len(cities)} cities, {len(dates)} quarters")
        except Exception as e:
            log.error(f"\nFailed to fetch real data: {e}")
            log.info("Falling back to synthetic data...")
            cities = ["sydney", "melbourne", "brisbane", "perth", "gold_coast"]
            dates = generate_dates(2005, 2025)
            series = generate_synthetic_prices(dates, cities)
            macro_indicators = generate_synthetic_macro(dates)
            source = "Synthetic data (development only — real data fetch failed)"
            macro_sources = ["Synthetic (development only)"]

    # Validate
    log.info("\nValidating output...")
    for city in cities:
        assert len(series[city]["index"]) == len(dates), \
            f"{city} index length mismatch: {len(series[city]['index'])} vs {len(dates)}"
        assert len(series[city]["returns"]) == len(dates), \
            f"{city} returns length mismatch"
        validate_no_nan(series[city]["index"], f"{city}.index")

    for indicator in ["cash_rate", "cpi", "unemployment"]:
        assert len(macro_indicators[indicator]) == len(dates), \
            f"{indicator} length mismatch: {len(macro_indicators[indicator])} vs {len(dates)}"
        validate_no_nan(macro_indicators[indicator], indicator)

    # Write prices.json
    prices_data = {
        "meta": {
            "source": source,
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "base_period": "2011-12 = 100",
            "frequency": "quarterly",
        },
        "cities": cities,
        "dates": dates,
        "series": series,
    }

    prices_path = DATA_DIR / "prices.json"
    with open(prices_path, "w") as f:
        json.dump(prices_data, f, indent=2)
    log.info(f"Wrote {prices_path} ({len(dates)} quarters, {len(cities)} cities)")

    # Write macro.json
    macro_data = {
        "meta": {"sources": macro_sources},
        "dates": dates,
        "indicators": macro_indicators,
    }

    macro_path = DATA_DIR / "macro.json"
    with open(macro_path, "w") as f:
        json.dump(macro_data, f, indent=2)
    log.info(f"Wrote {macro_path}")

    log.info("\nData pipeline complete.")


if __name__ == "__main__":
    main()
