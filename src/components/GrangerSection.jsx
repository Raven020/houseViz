import React, { useRef, useEffect, useState } from 'react';
import { renderGrangerGraph } from '../d3/grangerGraph.js';

export default function GrangerSection({ data, prices }) {
  const svgRef = useRef(null);
  const [showNonSignificant, setShowNonSignificant] = useState(false);

  useEffect(() => {
    if (data && svgRef.current) {
      renderGrangerGraph(svgRef.current, data, prices, { showNonSignificant });
    }
  }, [data, prices, showNonSignificant]);

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
      <div className="section__controls">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showNonSignificant}
            onChange={(e) => setShowNonSignificant(e.target.checked)}
          />
          Show non-significant pairs
        </label>
      </div>
      <div className="chart-container">
        <svg
          ref={svgRef}
          aria-label="Granger causality network graph showing lead-lag relationships between Australian cities"
          role="img"
        />
      </div>
    </section>
  );
}
