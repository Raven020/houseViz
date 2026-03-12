import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import App from '../App.jsx';

// Mock dataLoader to avoid actual fetch
vi.mock('../utils/dataLoader.js', () => ({
  loadAllData: vi.fn(),
}));

// Mock D3 modules to avoid SVG rendering issues in jsdom
vi.mock('../d3/grangerGraph.js', () => ({ renderGrangerGraph: vi.fn() }));
vi.mock('../d3/grangerHeatmap.js', () => ({ renderGrangerHeatmap: vi.fn() }));
vi.mock('../d3/regimeTimeline.js', () => ({ renderRegimeTimeline: vi.fn(), renderRegimeTimelineOverlay: vi.fn() }));
vi.mock('../d3/transitionMatrix.js', () => ({ renderTransitionMatrix: vi.fn() }));
vi.mock('../d3/featureImportanceChart.js', () => ({ renderFeatureImportanceChart: vi.fn() }));
vi.mock('../d3/crossCityComparison.js', () => ({ renderCrossCityComparison: vi.fn() }));

import { loadAllData } from '../utils/dataLoader.js';

const mockData = {
  prices: {
    cities: ['sydney', 'melbourne', 'brisbane', 'perth'],
    dates: ['2005-Q1', '2005-Q2'],
    series: {
      sydney: { index: [100, 102], returns: [null, 0.02] },
      melbourne: { index: [100, 101], returns: [null, 0.01] },
      brisbane: { index: [100, 103], returns: [null, 0.03] },
      perth: { index: [100, 99], returns: [null, -0.01] },
    },
  },
  granger: {
    meta: { method: 'Granger causality (F-test)', max_lag: 8, significance: 0.05 },
    results: [
      { from: 'sydney', to: 'melbourne', optimal_lag: 2, p_value: 0.003, f_statistic: 6.12, significant: true },
    ],
  },
  hmm: {
    meta: { method: 'Gaussian HMM', n_states: 3 },
    cities: {
      sydney: {
        regimes: ['boom', 'boom'],
        state_params: { boom: { mean_return: 0.02, std: 0.01 }, stagnation: { mean_return: 0.005, std: 0.008 }, correction: { mean_return: -0.01, std: 0.015 } },
        transition_matrix: [[0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]],
      },
    },
    dates: ['2005-Q1', '2005-Q2'],
  },
  lightgbm: {
    meta: { method: 'LightGBM Regressor' },
    cities: {
      sydney: {
        r_squared: 0.45,
        rmse: 0.012,
        r_squared_train: 0.78,
        rmse_train: 0.008,
        n_train: 45,
        n_folds: 25,
        features: [
          { name: 'cash_rate_change_lag1', importance: 0.22, group: 'Interest Rates' },
        ],
      },
    },
  },
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    loadAllData.mockReturnValue(new Promise(() => {})); // never resolves
    render(<App />);
    expect(screen.getByText('Loading analysis data...')).toBeInTheDocument();
  });

  it('renders all sections after data loads', async () => {
    loadAllData.mockResolvedValue(mockData);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Australian Housing Market Econometrics')).toBeInTheDocument();
    });

    expect(screen.getByText(/City Relationships/)).toBeInTheDocument();
    expect(screen.getByText(/Market Regimes/)).toBeInTheDocument();
    expect(screen.getByText(/What Drives Prices/)).toBeInTheDocument();
  });

  it('shows error message on data load failure', async () => {
    loadAllData.mockRejectedValue(new Error('Network error'));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows compare toggle in HMM section and hides city selector when enabled', async () => {
    loadAllData.mockResolvedValue(mockData);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Market Regimes/)).toBeInTheDocument();
    });

    // Compare toggle should be present
    const toggle = screen.getByLabelText('Compare all cities');
    expect(toggle).toBeInTheDocument();
    expect(toggle.checked).toBe(false);

    // HMM city selector should be visible
    const hmmSelect = document.getElementById('hmm-city-select');
    expect(hmmSelect).toBeInTheDocument();

    // Enable compare mode
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

    // HMM city selector should be hidden
    expect(document.getElementById('hmm-city-select')).not.toBeInTheDocument();
  });
});
