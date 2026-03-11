import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__section">
        <h3>Data Sources</h3>
        <ul>
          <li>
            <a href="https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/latest-release" target="_blank" rel="noopener noreferrer">
              ABS Cat. 6416.0 — Residential Property Price Indexes
            </a>
          </li>
          <li>
            <a href="https://www.rba.gov.au/statistics/cash-rate/" target="_blank" rel="noopener noreferrer">
              RBA Cash Rate
            </a>
          </li>
          <li>
            <a href="https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release" target="_blank" rel="noopener noreferrer">
              ABS Cat. 6401.0 — Consumer Price Index
            </a>
          </li>
          <li>
            <a href="https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release" target="_blank" rel="noopener noreferrer">
              ABS Cat. 6202.0 — Labour Force
            </a>
          </li>
        </ul>
      </div>
      <div className="footer__section">
        <h3>Methodology</h3>
        <p>
          Granger causality tests use statsmodels (F-test, max 8 lags).
          HMM regime detection uses hmmlearn (3-state Gaussian HMM).
          Feature importance uses LightGBM (gain-based, normalised).
          All analysis runs on quarterly data from Q1 2005 to Q4 2021.
          See the{' '}
          <a href="https://github.com/Raven020/houseViz" target="_blank" rel="noopener noreferrer">
            GitHub README
          </a>{' '}
          for full methodology details.
        </p>
      </div>
      <div className="footer__section footer__meta">
        <p>
          Built with React, D3.js, and Python by{' '}
          <a href="https://linkedin.com/in/developer" target="_blank" rel="noopener noreferrer">
            Developer
          </a>.
        </p>
      </div>
    </footer>
  );
}
