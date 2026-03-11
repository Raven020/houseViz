import React from 'react';

export default function Header() {
  return (
    <header className="header">
      <h1 className="header__title">Australian Housing Market Econometrics</h1>
      <p className="header__subtitle">
        An interactive exploration of price dynamics across major Australian cities
      </p>
      <p className="header__intro">
        This project applies three econometric techniques to quarterly housing price data
        from the Australian Bureau of Statistics: Granger causality testing to uncover
        lead-lag relationships between cities, Hidden Markov Models to identify boom,
        stagnation, and correction regimes, and LightGBM to quantify the macroeconomic
        drivers behind price movements.
      </p>
    </header>
  );
}
