import React, { useRef, useEffect, useState, useCallback } from 'react';
import { renderFeatureImportanceChart } from '../d3/featureImportanceChart.js';
import { renderCrossCityComparison } from '../d3/crossCityComparison.js';
import { CITY_NAMES } from '../utils/constants.js';

export default function XGBoostSection({ data, prices }) {
  const svgRef = useRef(null);
  const comparisonSvgRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState('sydney');
  const [aggregateLags, setAggregateLags] = useState(false);

  const cities = prices ? prices.cities : [];

  const renderChart = useCallback(() => {
    if (data && svgRef.current) {
      renderFeatureImportanceChart(svgRef.current, data, selectedCity, { aggregateByCategory: aggregateLags });
    }
    if (data && comparisonSvgRef.current) {
      renderCrossCityComparison(comparisonSvgRef.current, data);
    }
  }, [data, selectedCity, aggregateLags]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // ResizeObserver for responsive chart redraw
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => renderChart());
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderChart]);

  if (!data || !prices) return null;

  const cityData = data.cities[selectedCity];

  return (
    <section className="section" id="xgboost" ref={containerRef}>
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
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={aggregateLags}
            onChange={(e) => setAggregateLags(e.target.checked)}
          />
          Group by category
        </label>
        {cityData && (
          <div className="model-metrics">
            <span className="metric" title="Out-of-sample R² from walk-forward cross-validation">
              OOF R² = {cityData.r_squared.toFixed(3)}
            </span>
            <span className="metric" title="Out-of-sample RMSE from walk-forward cross-validation">
              OOF RMSE = {cityData.rmse.toFixed(4)}
            </span>
            {cityData.r_squared_train != null && (
              <span className="metric" title="In-sample R² (full training set)">
                Train R² = {cityData.r_squared_train.toFixed(3)}
              </span>
            )}
            {cityData.n_folds && (
              <span className="metric" title="Number of walk-forward cross-validation folds">
                {cityData.n_folds} CV folds
              </span>
            )}
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
      <div className="chart-container" style={{ marginTop: '2rem' }}>
        <h3 className="chart-container__label">Cross-City Comparison: Top Feature</h3>
        <p className="chart-container__sublabel">
          The most important feature for each city's model, shown side by side to
          highlight which macroeconomic driver dominates in each market.
        </p>
        <svg
          ref={comparisonSvgRef}
          aria-label="Cross-city comparison of top LightGBM features"
          role="img"
        />
      </div>
    </section>
  );
}
