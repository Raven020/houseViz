import React, { useRef, useEffect, useState } from 'react';
import { renderRegimeTimeline } from '../d3/regimeTimeline.js';
import { CITY_NAMES } from '../utils/constants.js';

export default function HMMSection({ data, prices }) {
  const svgRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState('sydney');

  const cities = prices ? prices.cities : [];

  useEffect(() => {
    if (data && prices && svgRef.current) {
      renderRegimeTimeline(svgRef.current, data, prices, selectedCity);
    }
  }, [data, prices, selectedCity]);

  if (!data || !prices) return null;

  return (
    <section className="section" id="hmm">
      <h2 className="section__title">Market Regimes: Hidden Markov Model</h2>
      <p className="section__explanation">
        A Hidden Markov Model identifies three latent market regimes in each city's
        price history: boom (strong growth), stagnation (flat or modest growth), and
        correction (declining prices). The model learns these states from the data
        without being told when they occur, then assigns each quarter to its most
        likely regime. The coloured bands below show how each city has cycled through
        these phases over the past two decades.
      </p>
      <div className="section__controls">
        <label htmlFor="hmm-city-select" className="sr-only">Select city</label>
        <select
          id="hmm-city-select"
          className="city-selector"
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
        >
          {cities.map((city) => (
            <option key={city} value={city}>
              {CITY_NAMES[city] || city}
            </option>
          ))}
        </select>
      </div>
      <div className="chart-container">
        <svg
          ref={svgRef}
          aria-label={`HMM regime timeline for ${CITY_NAMES[selectedCity] || selectedCity}`}
          role="img"
        />
      </div>
    </section>
  );
}
