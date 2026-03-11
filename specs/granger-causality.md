# Granger Causality Specification

## Overview
Test whether lagged housing price returns in one city help predict returns in another. This reveals lead/lag dynamics — e.g., does a Sydney boom precede a Melbourne boom?

## Input
- `data/prices.json` — quarterly returns series for all 5 cities

## Analysis

### Method
- Pairwise Granger causality tests across all city pairs (5 × 4 = 20 directed pairs)
- Library: `statsmodels.tsa.stattools.grangercausalitytests`

### Parameters
| Parameter | Value | Rationale |
|---|---|---|
| Max lag | 8 quarters (2 years) | Housing cycles transmit slowly |
| Significance level | 0.05 | Standard threshold |
| Test statistic | F-test (ssr_ftest) | Default, most common |

### Stationarity
- Use returns (QoQ %) rather than raw index levels to ensure stationarity
- Optionally run ADF test on each series and log result; if non-stationary, difference further

### Output
For each directed pair (city_a → city_b), record:
- Optimal lag (the lag with lowest p-value)
- p-value at optimal lag
- Whether significant at α = 0.05
- F-statistic at optimal lag

## Output JSON

### `data/granger.json`
```json
{
  "meta": {
    "method": "Granger causality (F-test)",
    "max_lag": 8,
    "significance": 0.05
  },
  "results": [
    {
      "from": "sydney",
      "to": "melbourne",
      "optimal_lag": 2,
      "p_value": 0.003,
      "f_statistic": 6.12,
      "significant": true
    },
    {
      "from": "melbourne",
      "to": "sydney",
      "optimal_lag": 4,
      "p_value": 0.21,
      "f_statistic": 1.45,
      "significant": false
    }
  ]
}
```

## Visualisation

### Primary: Directed Network Graph
- **Nodes:** 5 cities, positioned in an approximate geographic layout
- **Edges:** Directed arrows for each significant Granger-causal pair
  - Arrow thickness or opacity proportional to F-statistic (strength)
  - Label on edge: optimal lag in quarters (e.g., "2Q")
  - Non-significant pairs: no edge drawn (or faint dashed line with toggle)
- **Interaction:**
  - Hover on node: highlight all inbound/outbound edges
  - Hover on edge: tooltip showing p-value, F-stat, lag
  - Toggle: show/hide non-significant pairs

### Secondary (optional): Heatmap
- 5×5 matrix, rows = "from" city, columns = "to" city
- Cell colour: p-value (green = significant, grey = not)
- Cell label: optimal lag
- Diagonal: blank (no self-causality)

## Python Script
- Location: `python/granger.py`
- Reads `data/prices.json`, writes `data/granger.json`
