import React, { useRef, useEffect, useState } from 'react';
import { renderRegimeTimeline } from '../d3/regimeTimeline.js';
import { renderTransitionMatrix } from '../d3/transitionMatrix.js';
import { CITY_NAMES } from '../utils/constants.js';

export default function HMMSection({ data, prices }) {
  const svgRef = useRef(null);
  const matrixSvgRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState('sydney');

  const cities = prices ? prices.cities : [];

  useEffect(() => {
    if (data && prices && svgRef.current) {
      renderRegimeTimeline(svgRef.current, data, prices, selectedCity);
    }
  }, [data, prices, selectedCity]);

  useEffect(() => {
    if (data && matrixSvgRef.current) {
      renderTransitionMatrix(matrixSvgRef.current, data, selectedCity);
    }
  }, [data, selectedCity]);

  if (!data || !prices) return null;

  return (
    <section className="section" id="hmm">
      <h2 className="section__title">Market Regimes: Hidden Markov Model</h2>
      <p className="section__explanation">
        A Hidden Markov Model identifies latent market regimes in each city's
        price history. The model typically finds three states — boom (strong growth),
        stagnation (flat or modest growth), and correction (declining prices) — but
        may use fewer when the data does not support a full three-state separation.
        It learns these states from the data without being told when they occur, then
        assigns each quarter to its most likely regime. The coloured bands below show
        how each city has cycled through these phases over the past two decades.
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
      <div className="chart-container chart-container--matrix">
        <h3 className="chart-container__label">Transition Probabilities</h3>
        <p className="chart-container__sublabel">
          Each cell shows the probability of moving from one market regime (row) to
          another (column) in the next quarter.
        </p>
        <svg
          ref={matrixSvgRef}
          aria-label={`Transition probability matrix for ${CITY_NAMES[selectedCity] || selectedCity}`}
          role="img"
        />
      </div>
    </section>
  );
}
