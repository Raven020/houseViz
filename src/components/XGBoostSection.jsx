import React, { useRef, useEffect, useState } from 'react';
import { renderFeatureImportanceChart } from '../d3/featureImportanceChart.js';
import { CITY_NAMES } from '../utils/constants.js';

export default function XGBoostSection({ data, prices }) {
  const svgRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState('sydney');

  const cities = prices ? prices.cities : [];

  useEffect(() => {
    if (data && svgRef.current) {
      renderFeatureImportanceChart(svgRef.current, data, selectedCity);
    }
  }, [data, selectedCity]);

  if (!data || !prices) return null;

  const cityData = data.cities[selectedCity];

  return (
    <section className="section" id="xgboost">
      <h2 className="section__title">What Drives Prices: LightGBM Feature Importance</h2>
      <p className="section__explanation">
        A LightGBM model trained on macroeconomic indicators reveals which factors
        matter most for predicting each city's quarterly price movements. Features
        include interest rate changes, unemployment levels, inflation, and price
        spillovers from other cities. The bars below show each feature's contribution
        to the model's predictions, grouped by category.
      </p>
      <div className="section__controls">
        <label htmlFor="xgb-city-select" className="sr-only">Select city</label>
        <select
          id="xgb-city-select"
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
        {cityData && (
          <div className="model-metrics">
            <span className="metric">R² = {cityData.r_squared.toFixed(3)}</span>
            <span className="metric">RMSE = {cityData.rmse.toFixed(4)}</span>
          </div>
        )}
      </div>
      <div className="chart-container">
        <svg
          ref={svgRef}
          aria-label={`LightGBM feature importance chart for ${CITY_NAMES[selectedCity] || selectedCity}`}
          role="img"
        />
      </div>
    </section>
  );
}
