#!/usr/bin/env python3
"""
Hidden Markov Model regime detection for Australian housing markets.

Fits a 3-state Gaussian HMM to each city's quarterly price returns
to identify boom, stagnation, and correction regimes.

Uses covariance regularization (covars_prior / covars_weight) to prevent
degenerate states with only ~68 quarterly observations. Falls back to a
2-state model when 3 states still degenerate after regularization.

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

# Minimum fraction of observations a state must be assigned for the fit
# to be considered non-degenerate.  With 68 observations, 5% ≈ 3 quarters.
MIN_STATE_OCCUPANCY = 0.05

REGIME_LABELS_3 = ["correction", "stagnation", "boom"]
REGIME_LABELS_2 = ["correction", "boom"]


def load_prices():
    with open(DATA_DIR / "prices.json") as f:
        return json.load(f)


def _estimate_variance_prior(X):
    """Compute a reasonable variance prior from the data.

    Returns a prior equal to the overall sample variance, which prevents
    any single state from collapsing to near-zero variance while still
    allowing the model flexibility to find meaningful regimes.
    """
    return float(np.var(X))


def _build_model(n_states, covariance_type, random_state, var_prior):
    """Create a GaussianHMM with regularization."""
    from hmmlearn.hmm import GaussianHMM

    kwargs = dict(
        n_components=n_states,
        covariance_type=covariance_type,
        n_iter=N_ITER,
        random_state=random_state,
    )

    # Add covariance regularization to prevent degenerate states.
    # covars_prior sets the expected covariance; covars_weight controls
    # how strongly that prior is enforced (higher = more regularization).
    if var_prior is not None and var_prior > 0:
        if covariance_type == "full":
            # For full covariance on 1-D data, prior is shape (1, 1)
            kwargs["covars_prior"] = np.array([[var_prior]])
            kwargs["covars_weight"] = 2.0  # mild regularization
        elif covariance_type in ("diag", "spherical"):
            kwargs["covars_prior"] = var_prior
            kwargs["covars_weight"] = 2.0

    return GaussianHMM(**kwargs)


def _fit_multi_init(X, n_states, covariance_type, var_prior):
    """Run N_INIT random restarts and return the best model."""
    best_model = None
    best_score = -np.inf

    for init in range(N_INIT):
        model = _build_model(n_states, covariance_type,
                             RANDOM_STATE + init, var_prior)
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

    return best_model


def _is_degenerate(model, X, n_states):
    """Check whether any state is degenerate (too few assignments or
    states with near-identical means that make them indistinguishable)."""
    hidden_states = model.predict(X)
    n = len(X)

    for s in range(n_states):
        count = int(np.sum(hidden_states == s))
        if count < max(2, int(n * MIN_STATE_OCCUPANCY)):
            return True

    # Check for near-identical means (within 0.5 std of the overall data)
    means = model.means_.flatten()
    overall_std = float(np.std(X))
    if overall_std > 0:
        sorted_means = np.sort(means)
        for i in range(len(sorted_means) - 1):
            if abs(sorted_means[i + 1] - sorted_means[i]) < 0.3 * overall_std:
                return True

    return False


def _extract_results(model, X, regime_labels):
    """Extract regimes, state_params, and transition_matrix from a fitted model."""
    n_states = model.n_components

    hidden_states = model.predict(X)

    means = model.means_.flatten()
    if model.covariance_type == "full":
        variances = np.array([model.covars_[i][0][0] for i in range(n_states)])
    elif model.covariance_type == "diag":
        variances = np.array([model.covars_[i][0] for i in range(n_states)])
    else:  # spherical
        variances = model.covars_

    sorted_indices = np.argsort(means)

    # Map raw state indices to semantic labels
    state_map = {}
    for rank, raw_idx in enumerate(sorted_indices):
        state_map[raw_idx] = regime_labels[rank]

    regimes = [state_map[s] for s in hidden_states]

    state_params = {}
    for rank, raw_idx in enumerate(sorted_indices):
        label = regime_labels[rank]
        state_params[label] = {
            "mean_return": round(float(means[raw_idx]), 6),
            "std": round(float(np.sqrt(max(0, variances[raw_idx]))), 6),
        }

    # Reorder transition matrix to match label order
    raw_trans = model.transmat_
    reordered_trans = np.zeros((n_states, n_states))
    for i, ri in enumerate(sorted_indices):
        for j, rj in enumerate(sorted_indices):
            reordered_trans[i][j] = raw_trans[ri][rj]

    transition_matrix = [[round(float(v), 4) for v in row] for row in reordered_trans]

    return regimes, state_params, transition_matrix


def fit_hmm(returns):
    """
    Fit a Gaussian HMM to a return series with regularization and
    automatic fallback from 3 states to 2 states if degenerate.

    Returns (regimes, state_params, transition_matrix, actual_n_states).
    """
    X = np.array(returns).reshape(-1, 1)
    var_prior = _estimate_variance_prior(X)

    # Try 3-state model first
    model = _fit_multi_init(X, N_STATES, COVARIANCE_TYPE, var_prior)

    if model is not None and not _is_degenerate(model, X, N_STATES):
        regimes, state_params, trans_matrix = _extract_results(
            model, X, REGIME_LABELS_3)
        return regimes, state_params, trans_matrix, N_STATES

    # 3-state model degenerated — fall back to 2 states
    print("    ⚠ 3-state model degenerate, falling back to 2-state model")
    model_2 = _fit_multi_init(X, 2, COVARIANCE_TYPE, var_prior)

    if model_2 is None:
        raise RuntimeError("All HMM initializations failed (both 3-state and 2-state)")

    regimes, state_params, trans_matrix = _extract_results(
        model_2, X, REGIME_LABELS_2)
    return regimes, state_params, trans_matrix, 2


def main():
    prices = load_prices()
    cities = prices["cities"]
    dates = prices["dates"]

    print(f"Fitting Gaussian HMM for {len(cities)} cities...")
    print(f"Parameters: covariance={COVARIANCE_TYPE}, n_iter={N_ITER}, "
          f"random_state={RANDOM_STATE}, n_init={N_INIT}")
    print(f"Regularization: covars_prior=sample_variance, covars_weight=2.0")
    print(f"Degeneracy threshold: min {MIN_STATE_OCCUPANCY*100:.0f}% state occupancy")

    output = {
        "meta": {
            "method": "Gaussian HMM",
            "n_states": N_STATES,
            "covariance_type": COVARIANCE_TYPE,
            "n_init": N_INIT,
            "regime_labels": REGIME_LABELS_3,
        },
        "cities": {},
        "dates": dates,
    }

    for city in cities:
        print(f"\n  {city}:")
        returns = prices["series"][city]["returns"]

        # Replace first None with 0 for HMM fitting
        clean_returns = [0.0 if v is None else float(v) for v in returns]

        regimes, state_params, trans_matrix, actual_n_states = fit_hmm(clean_returns)

        # Determine which labels were used
        labels_used = REGIME_LABELS_3 if actual_n_states == 3 else REGIME_LABELS_2

        # Log regime distribution
        for label in labels_used:
            count = regimes.count(label)
            pct = count / len(regimes) * 100
            mean = state_params[label]["mean_return"]
            std = state_params[label]["std"]
            print(f"    {label}: {count} quarters ({pct:.1f}%), "
                  f"mean={mean:.4f}, std={std:.4f}")

        city_output = {
            "regimes": regimes,
            "state_params": state_params,
            "transition_matrix": trans_matrix,
        }

        # Record fallback so frontend can adapt
        if actual_n_states != N_STATES:
            city_output["actual_n_states"] = actual_n_states
            city_output["regime_labels"] = labels_used

        output["cities"][city] = city_output

    output_path = DATA_DIR / "hmm.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
