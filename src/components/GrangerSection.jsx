import React, { useRef, useEffect, useState } from 'react';
import { renderGrangerGraph } from '../d3/grangerGraph.js';
import { renderGrangerHeatmap } from '../d3/grangerHeatmap.js';

export default function GrangerSection({ data, prices }) {
  const networkSvgRef = useRef(null);
  const heatmapSvgRef = useRef(null);

  const [activeView, setActiveView] = useState('network'); // 'network' | 'heatmap'
  const [showNonSignificant, setShowNonSignificant] = useState(false);

  // Render network graph whenever relevant state changes and view is network
  useEffect(() => {
    if (data && networkSvgRef.current) {
      renderGrangerGraph(networkSvgRef.current, data, prices, { showNonSignificant });
    }
  }, [data, prices, showNonSignificant]);

  // Render heatmap when data is ready; re-render on data/prices change
  useEffect(() => {
    if (data && heatmapSvgRef.current) {
      renderGrangerHeatmap(heatmapSvgRef.current, data, prices);
    }
  }, [data, prices]);

  if (!data) return null;

  return (
    <section className="section" id="granger">
      <h2 className="section__title">City Relationships: Granger Causality</h2>
      <p className="section__explanation">
        Granger causality tests whether past price movements in one city help predict
        future movements in another. An arrow from City A to City B means that
        A's historical returns contain statistically significant predictive information
        about B's future returns. This does not imply direct causation, but reveals
        lead-lag dynamics in Australia's housing market — for example, a Sydney boom
        may systematically precede a Melbourne upturn by several quarters.
      </p>

      {/* View toggle tabs */}
      <div className="section__controls">
        <div role="tablist" aria-label="Granger causality view" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            role="tab"
            aria-selected={activeView === 'network'}
            onClick={() => setActiveView('network')}
            style={{
              padding: '0.35rem 0.9rem',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              fontWeight: activeView === 'network' ? '600' : '400',
              borderRadius: '6px',
              border: activeView === 'network' ? '2px solid #2563EB' : '1px solid #d1d5db',
              background: activeView === 'network' ? '#eff6ff' : '#fff',
              color: activeView === 'network' ? '#1d4ed8' : '#374151',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Network
          </button>
          <button
            role="tab"
            aria-selected={activeView === 'heatmap'}
            onClick={() => setActiveView('heatmap')}
            style={{
              padding: '0.35rem 0.9rem',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              fontWeight: activeView === 'heatmap' ? '600' : '400',
              borderRadius: '6px',
              border: activeView === 'heatmap' ? '2px solid #2563EB' : '1px solid #d1d5db',
              background: activeView === 'heatmap' ? '#eff6ff' : '#fff',
              color: activeView === 'heatmap' ? '#1d4ed8' : '#374151',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Heatmap
          </button>
        </div>

        {/* Show non-significant toggle — only relevant for the network view */}
        {activeView === 'network' && (
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showNonSignificant}
              onChange={(e) => setShowNonSignificant(e.target.checked)}
            />
            Show non-significant pairs
          </label>
        )}
      </div>

      {/* Network view */}
      <div
        className="chart-container"
        role="tabpanel"
        aria-label="Network view"
        style={{ display: activeView === 'network' ? 'block' : 'none' }}
      >
        <svg
          ref={networkSvgRef}
          aria-label="Granger causality network graph showing lead-lag relationships between Australian cities"
          role="img"
        />
      </div>

      {/* Heatmap view */}
      <div
        className="chart-container"
        role="tabpanel"
        aria-label="Heatmap view"
        style={{ display: activeView === 'heatmap' ? 'block' : 'none' }}
      >
        <svg
          ref={heatmapSvgRef}
          aria-label="Granger causality p-value heatmap showing directional relationships between Australian cities"
          role="img"
        />
      </div>
    </section>
  );
}
