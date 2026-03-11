#!/usr/bin/env python3
"""
Hidden Markov Model regime detection for Australian housing markets.

Fits a 3-state Gaussian HMM to each city's quarterly price returns
to identify boom, stagnation, and correction regimes.

Usage:
    python hmm_regimes.py
"""

import json
import warnings
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

N_STATES = 3
COVARIANCE_TYPE = "full"
N_ITER = 200
RANDOM_STATE = 42
N_INIT = 10

REGIME_LABELS = ["correction", "stagnation", "boom"]


def load_prices():
    with open(DATA_DIR / "prices.json") as f:
        return json.load(f)


def fit_hmm(returns):
    """
    Fit a 3-state Gaussian HMM to a return series.
    Multiple random initializations to avoid local optima.
    Returns (regimes, state_params, transition_matrix).
    """
    from hmmlearn.hmm import GaussianHMM

    X = np.array(returns).reshape(-1, 1)

    best_model = None
    best_score = -np.inf

    for init in range(N_INIT):
        model = GaussianHMM(
            n_components=N_STATES,
            covariance_type=COVARIANCE_TYPE,
            n_iter=N_ITER,
            random_state=RANDOM_STATE + init,
        )

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                model.fit(X)
                score = model.score(X)
                if score > best_score:
                    best_score = score
                    best_model = model
            except Exception:
                continue

    if best_model is None:
        raise RuntimeError("All HMM initializations failed")

    model = best_model

    # Viterbi decode
    hidden_states = model.predict(X)

    # Get means and sort to assign semantic labels
    means = model.means_.flatten()
    variances = np.array([model.covars_[i][0][0] for i in range(N_STATES)])
    sorted_indices = np.argsort(means)  # correction (lowest) → stagnation → boom (highest)

    # Map raw state indices to semantic labels
    state_map = {}
    for rank, raw_idx in enumerate(sorted_indices):
        state_map[raw_idx] = REGIME_LABELS[rank]

    # Build regime sequence
    regimes = [state_map[s] for s in hidden_states]

    # State parameters
    state_params = {}
    for rank, raw_idx in enumerate(sorted_indices):
        label = REGIME_LABELS[rank]
        state_params[label] = {
            "mean_return": round(float(means[raw_idx]), 6),
            "std": round(float(np.sqrt(variances[raw_idx])), 6),
        }

    # Reorder transition matrix to match [correction, stagnation, boom]
    raw_trans = model.transmat_
    reordered_trans = np.zeros((N_STATES, N_STATES))
    for i, ri in enumerate(sorted_indices):
        for j, rj in enumerate(sorted_indices):
            reordered_trans[i][j] = raw_trans[ri][rj]

    transition_matrix = [[round(float(v), 4) for v in row] for row in reordered_trans]

    return regimes, state_params, transition_matrix


def main():
    prices = load_prices()
    cities = prices["cities"]
    dates = prices["dates"]

    print(f"Fitting {N_STATES}-state Gaussian HMM for {len(cities)} cities...")
    print(f"Parameters: covariance={COVARIANCE_TYPE}, n_iter={N_ITER}, "
          f"random_state={RANDOM_STATE}, n_init={N_INIT}")

    output = {
        "meta": {
            "method": "Gaussian HMM",
            "n_states": N_STATES,
            "covariance_type": COVARIANCE_TYPE,
            "regime_labels": REGIME_LABELS,
        },
        "cities": {},
        "dates": dates,
    }

    for city in cities:
        print(f"\n  {city}:")
        returns = prices["series"][city]["returns"]

        # Replace first None with 0 for HMM fitting
        clean_returns = [0.0 if v is None else float(v) for v in returns]

        regimes, state_params, trans_matrix = fit_hmm(clean_returns)

        # Log regime distribution
        for label in REGIME_LABELS:
            count = regimes.count(label)
            pct = count / len(regimes) * 100
            mean = state_params[label]["mean_return"]
            print(f"    {label}: {count} quarters ({pct:.1f}%), mean return={mean:.4f}")

        output["cities"][city] = {
            "regimes": regimes,
            "state_params": state_params,
            "transition_matrix": trans_matrix,
        }

    output_path = DATA_DIR / "hmm.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
