# Hidden Markov Model — Market Regimes Specification

## Overview
Fit a Gaussian Hidden Markov Model to each city's housing price returns to identify latent market regimes (e.g., boom, stagnation, correction). Regimes are overlaid as coloured bands on a price timeline.

## Input
- `data/prices.json` — quarterly returns series for all 4 cities

## Analysis

### Method
- Gaussian HMM with 3 hidden states per city
- Library: `hmmlearn.GaussianHMM`

### Parameters
| Parameter | Value | Rationale |
|---|---|---|
| Number of states | 3 | Boom / Stagnation / Correction |
| Covariance type | "full" | Allow flexible variance per regime |
| Number of iterations | 200 | Convergence for EM algorithm |
| Random state | 42 | Reproducibility |
| n_init | 10 | Multiple initialisations to avoid local optima |

### Regime Labelling
After fitting, states are arbitrarily numbered (0, 1, 2). Post-process to assign semantic labels based on the mean return of each state:
- **Boom:** state with highest mean return
- **Stagnation:** state with middle mean return
- **Correction:** state with lowest mean return

### Per-City Output
For each city:
- Decoded state sequence (Viterbi path) — one regime label per quarter
- State means and variances
- Transition probability matrix (3×3)

## Output JSON

### `data/hmm.json`
```json
{
  "meta": {
    "method": "Gaussian HMM",
    "n_states": 3,
    "covariance_type": "full",
    "regime_labels": ["correction", "stagnation", "boom"]
  },
  "cities": {
    "sydney": {
      "regimes": ["boom", "boom", "stagnation", "correction", "..."],
      "state_params": {
        "boom": { "mean_return": 0.035, "std": 0.012 },
        "stagnation": { "mean_return": 0.005, "std": 0.008 },
        "correction": { "mean_return": -0.018, "std": 0.015 }
      },
      "transition_matrix": [
        [0.85, 0.10, 0.05],
        [0.08, 0.82, 0.10],
        [0.05, 0.12, 0.83]
      ]
    },
    "melbourne": { "...": "..." },
    "brisbane": { "...": "..." },
    "perth": { "...": "..." }
  },
  "dates": ["2005-Q1", "2005-Q2", "..."]
}
```

## Visualisation

### Primary: Price Timeline with Regime Bands
- **X-axis:** Time (quarters)
- **Y-axis:** Price index level (from `prices.json`)
- **Line:** City price index
- **Background bands:** Coloured rectangles behind the line indicating regime
  - Boom: green (semi-transparent)
  - Stagnation: amber/yellow
  - Correction: red/pink
- **City selector:** Dropdown or tab bar to switch between 4 cities (default: Sydney)

### Interaction
- Hover on a regime band: tooltip showing regime label, duration, average return during that period
- Hover on price line: tooltip with date and index value
- Optional toggle: overlay multiple cities on the same chart for comparison

### Secondary (optional): Transition Matrix Heatmap
- 3×3 heatmap per city showing transition probabilities
- Useful for narrative ("once in a boom, 85% chance of staying in boom next quarter")

## Python Script
- Location: `python/hmm_regimes.py`
- Reads `data/prices.json`, writes `data/hmm.json`
