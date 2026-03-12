import React, { useRef, useEffect, useState, useCallback } from 'react';
import { renderGrangerGraph } from '../d3/grangerGraph.js';
import { renderGrangerHeatmap } from '../d3/grangerHeatmap.js';

const VIEWS = ['network', 'heatmap'];

export default function GrangerSection({ data, prices }) {
  const networkSvgRef = useRef(null);
  const heatmapSvgRef = useRef(null);
  const containerRef = useRef(null);

  const [activeView, setActiveView] = useState('network');
  const [showNonSignificant, setShowNonSignificant] = useState(false);

  const renderCharts = useCallback(() => {
    if (data && networkSvgRef.current) {
      renderGrangerGraph(networkSvgRef.current, data, prices, { showNonSignificant });
    }
    if (data && heatmapSvgRef.current) {
      renderGrangerHeatmap(heatmapSvgRef.current, data, prices);
    }
  }, [data, prices, showNonSignificant]);

  useEffect(() => {
    renderCharts();
  }, [renderCharts]);

  // Clean up tooltips on unmount
  useEffect(() => {
    return () => {
      document.querySelectorAll('.granger-tip, .granger-heatmap-tip').forEach(el => el.remove());
    };
  }, []);

  // ResizeObserver for responsive chart redraw
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => renderCharts());
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderCharts]);

  // Arrow-key navigation between tabs
  const handleTabKeyDown = useCallback((e) => {
    const idx = VIEWS.indexOf(activeView);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = VIEWS[(idx + 1) % VIEWS.length];
      setActiveView(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length];
      setActiveView(prev);
    }
  }, [activeView]);

  if (!data) return null;

  const tabStyle = (view) => ({
    padding: '0.35rem 0.9rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: activeView === view ? '600' : '400',
    borderRadius: '6px',
    border: activeView === view ? '2px solid #2563EB' : '1px solid #d1d5db',
    background: activeView === view ? '#eff6ff' : '#fff',
    color: activeView === view ? '#1d4ed8' : '#374151',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <section className="section" id="granger" ref={containerRef}>
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
            id="granger-tab-network"
            aria-selected={activeView === 'network'}
            aria-controls="granger-panel-network"
            tabIndex={activeView === 'network' ? 0 : -1}
            onClick={() => setActiveView('network')}
            onKeyDown={handleTabKeyDown}
            style={tabStyle('network')}
          >
            Network
          </button>
          <button
            role="tab"
            id="granger-tab-heatmap"
            aria-selected={activeView === 'heatmap'}
            aria-controls="granger-panel-heatmap"
            tabIndex={activeView === 'heatmap' ? 0 : -1}
            onClick={() => setActiveView('heatmap')}
            onKeyDown={handleTabKeyDown}
            style={tabStyle('heatmap')}
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
        id="granger-panel-network"
        className="chart-container"
        role="tabpanel"
        aria-labelledby="granger-tab-network"
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
        id="granger-panel-heatmap"
        className="chart-container"
        role="tabpanel"
        aria-labelledby="granger-tab-heatmap"
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
