# Data Pipeline Specification

## Overview
Source, clean, and prepare Australian housing price data for 4 cities, along with macroeconomic indicators, outputting structured JSON files consumed by the frontend and the three analysis modules.

## Cities
- Sydney
- Melbourne
- Brisbane
- Perth

> **Note:** Gold Coast was excluded because no usable SA4-level data exists for it in ABS Cat. 6416.0. The project uses real data only — Gold Coast data was not fabricated or proxied.

## Data Sources

### Housing Prices
- **Primary:** ABS Cat. 6416.0 — Residential Property Price Indexes (RPPI)
- **Granularity:** Quarterly (ABS standard cadence)
- **Metric:** Established house price index (index numbers, base period aligned)
- **Coverage:** Sydney, Melbourne, Brisbane, Perth — all available in ABS Cat. 6416.0 capital city tables

### Macroeconomic Indicators
| Indicator | Source | Frequency |
|---|---|---|
| Cash rate (interest rates) | RBA | Monthly → resample to quarterly |
| CPI (Consumer Price Index) | ABS Cat. 6401.0 | Quarterly |
| Unemployment rate | ABS Cat. 6202.0 | Monthly → resample to quarterly |

## Date Range
- **Target:** Q1 2005 – latest available quarter
- Align all series to the longest common overlap and document any truncation.

## Processing Steps
1. **Download** raw CSV/Excel files from ABS and RBA.
2. **Parse & normalise** — align date formats to ISO 8601 (`YYYY-QN` or `YYYY-MM-DD` for quarter start).
3. **Resample** monthly series to quarterly (period-end value or quarterly average — document choice).
4. **Align** all series to a common date index; forward-fill gaps up to 1 quarter, flag anything beyond.
5. **Compute returns** — quarter-on-quarter percentage change for each city's price index.
6. **Export** to static JSON files in `data/` directory.

## Output JSON Files

### `data/prices.json`
```json
{
  "meta": {
    "source": "ABS 6416.0",
    "last_updated": "2026-03-01",
    "base_period": "2011-12 = 100",
    "frequency": "quarterly"
  },
  "cities": ["sydney", "melbourne", "brisbane", "perth"],
  "dates": ["2005-Q1", "2005-Q2", "..."],
  "series": {
    "sydney": { "index": [100.0, 102.3, "..."], "returns": [null, 0.023, "..."] },
    "melbourne": { "...": "..." },
    "brisbane": { "...": "..." },
    "perth": { "...": "..." }
  }
}
```

### `data/macro.json`
```json
{
  "meta": { "sources": ["RBA", "ABS 6401.0", "ABS 6202.0"] },
  "dates": ["2005-Q1", "2005-Q2", "..."],
  "indicators": {
    "cash_rate": [5.25, 5.25, "..."],
    "cpi": [1.2, 0.8, "..."],
    "unemployment": [5.1, 5.0, "..."]
  }
}
```

## Python Environment
- Python 3.11+
- Dependencies: `pandas`, `requests` or `openpyxl` for ABS Excel files
- Script location: `python/data_pipeline.py`
- Idempotent — re-running overwrites `data/*.json` with fresh output

## Validation
- No NaN values in exported JSON (raise error if present after forward-fill)
- All city series have the same length as the `dates` array
- Macro indicators aligned to the same date array
