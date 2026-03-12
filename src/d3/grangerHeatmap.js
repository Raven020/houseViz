import * as d3 from 'd3';
import { CITY_NAMES } from '../utils/constants.js';

// Color constants
const COLOR_SIGNIFICANT = '#22c55e';
const COLOR_NONSIGNIFICANT = '#e5e7eb';
const COLOR_DIAGONAL = '#1f2937';

/**
 * Renders a Granger causality p-value heatmap into the given SVG element.
 *
 * @param {SVGSVGElement} svgEl   - The SVG DOM element to render into.
 * @param {object}        data    - Granger causality data ({ results: [...], meta: {...} }).
 * @param {object}        prices  - Prices data ({ cities: [...], ... }).
 */
export function renderGrangerHeatmap(svgEl, data, prices) {
  if (!data?.results || !prices?.cities) return;
  const cities = prices.cities;
  const n = cities.length;

  // Determine dimensions
  const containerWidth = svgEl.parentElement?.clientWidth || 600;

  // Margins must accommodate row/column labels
  const maxLabelLength = Math.max(...cities.map(c => (CITY_NAMES[c] || c).length));
  // Approximate: ~7px per character for 0.8rem font
  const labelWidth = Math.max(70, maxLabelLength * 7 + 8);
  const labelHeight = 56; // room for rotated column headers

  const margin = {
    top: labelHeight,
    right: 20,
    bottom: 20,
    left: labelWidth,
  };

  // Cell size: fill available width, capped at 90px, minimum 44px
  const availableWidth = containerWidth - margin.left - margin.right;
  const cellSize = Math.min(90, Math.max(44, Math.floor(availableWidth / n)));
  const innerW = cellSize * n;
  const innerH = cellSize * n;
  const width = innerW + margin.left + margin.right;
  const height = innerH + margin.top + margin.bottom;

  // Set up SVG
  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-label', 'Granger causality p-value heatmap showing directional relationships between cities')
    .attr('role', 'img');

  svg.selectAll('*').remove();

  // Tooltip (shared, reuse if already present)
  let tooltip = d3.select('body').select('.d3-tooltip.granger-heatmap-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body')
      .append('div')
      .attr('class', 'd3-tooltip granger-heatmap-tip')
      .style('opacity', 0);
  }

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Build a lookup map from the results array
  // Key: "from|to"  →  result object
  const resultMap = new Map(
    data.results.map(r => [`${r.from}|${r.to}`, r])
  );

  // --- Column headers (city names — "to" axis, top) ---
  const colHeaders = g.selectAll('.col-header')
    .data(cities)
    .join('text')
    .attr('class', 'col-header')
    .attr('x', (d, i) => i * cellSize + cellSize / 2)
    .attr('y', -8)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '0.78rem')
    .attr('font-weight', '500')
    .attr('fill', '#374151')
    .attr('transform', (d, i) => {
      const cx = i * cellSize + cellSize / 2;
      return `rotate(-40, ${cx}, -8)`;
    })
    .text(d => CITY_NAMES[d] || d);

  // "To →" axis label above columns
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', -margin.top + 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.75rem')
    .attr('fill', '#6b7280')
    .attr('font-style', 'italic')
    .text('→ To city (effect)');

  // --- Row headers (city names — "from" axis, left) ---
  g.selectAll('.row-header')
    .data(cities)
    .join('text')
    .attr('class', 'row-header')
    .attr('x', -8)
    .attr('y', (d, i) => i * cellSize + cellSize / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '0.78rem')
    .attr('font-weight', '500')
    .attr('fill', '#374151')
    .text(d => CITY_NAMES[d] || d);

  // "From ↓" axis label to the left of rows
  g.append('text')
    .attr('transform', `translate(${-margin.left + 10}, ${innerH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.75rem')
    .attr('fill', '#6b7280')
    .attr('font-style', 'italic')
    .text('From city (cause) ↓');

  // --- Build cell data ---
  // Each cell: { fromCity, toCity, row: i, col: j, result | null, isDiagonal }
  const cellData = [];
  cities.forEach((fromCity, row) => {
    cities.forEach((toCity, col) => {
      const isDiagonal = fromCity === toCity;
      const result = isDiagonal ? null : (resultMap.get(`${fromCity}|${toCity}`) || null);
      cellData.push({ fromCity, toCity, row, col, result, isDiagonal });
    });
  });

  // --- Draw cells ---
  function cellFill(d) {
    if (d.isDiagonal) return COLOR_DIAGONAL;
    if (!d.result) return COLOR_NONSIGNIFICANT;
    if (d.result.significant) {
      return COLOR_SIGNIFICANT;
    }
    return COLOR_NONSIGNIFICANT;
  }

  function cellOpacity(d) {
    if (d.isDiagonal) return 1;
    if (!d.result) return 0.4;
    // Opacity proportional to 1 - p_value (range [0,1])
    // Clamp p_value to [0, 1]
    const p = Math.min(1, Math.max(0, d.result.p_value));
    return 0.3 + (1 - p) * 0.7; // scale: min 0.3, max 1.0
  }

  const cellGroup = g.selectAll('.hm-cell')
    .data(cellData)
    .join('g')
    .attr('class', 'hm-cell')
    .attr('transform', d => `translate(${d.col * cellSize}, ${d.row * cellSize})`)
    .attr('tabindex', d => d.isDiagonal ? null : '0')
    .attr('role', d => d.isDiagonal ? null : 'img')
    .attr('aria-label', d => {
      if (d.isDiagonal) return null;
      const fromName = CITY_NAMES[d.fromCity] || d.fromCity;
      const toName = CITY_NAMES[d.toCity] || d.toCity;
      if (!d.result) {
        return `${fromName} to ${toName}: no data`;
      }
      return (
        `${fromName} to ${toName}: ` +
        `p=${d.result.p_value.toFixed(4)}, ` +
        `F=${d.result.f_statistic.toFixed(2)}, ` +
        `lag=${d.result.optimal_lag}Q, ` +
        `${d.result.significant ? 'significant' : 'not significant'}`
      );
    });

  // Background rect
  cellGroup.append('rect')
    .attr('x', 1)
    .attr('y', 1)
    .attr('width', cellSize - 2)
    .attr('height', cellSize - 2)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', cellFill)
    .attr('opacity', cellOpacity);

  // Diagonal hatching pattern to make it visually distinct
  const defs = svg.append('defs');
  defs.append('pattern')
    .attr('id', 'diagonal-hatch')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
    .append('path')
    .attr('d', 'M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2')
    .attr('stroke', '#374151')
    .attr('stroke-width', 1)
    .attr('opacity', 0.4);

  // Overlay for diagonal cells: subtle hatch
  cellGroup.filter(d => d.isDiagonal)
    .append('rect')
    .attr('x', 1)
    .attr('y', 1)
    .attr('width', cellSize - 2)
    .attr('height', cellSize - 2)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', 'url(#diagonal-hatch)');

  // Cell labels: significant pairs get "NQ" lag label
  const fontSize = cellSize >= 60 ? '0.75rem' : '0.65rem';

  cellGroup.filter(d => !d.isDiagonal && d.result && d.result.significant)
    .append('text')
    .attr('x', cellSize / 2)
    .attr('y', cellSize / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', fontSize)
    .attr('font-weight', '600')
    .attr('fill', '#fff')
    .attr('pointer-events', 'none')
    .text(d => `${d.result.optimal_lag}Q`);

  // --- Tooltip interactions ---
  function showTooltip(event, d) {
    if (d.isDiagonal) return;
    const fromName = CITY_NAMES[d.fromCity] || d.fromCity;
    const toName = CITY_NAMES[d.toCity] || d.toCity;
    let html;
    if (!d.result) {
      html = `<strong>${fromName} → ${toName}</strong><br/>No data`;
    } else {
      html =
        `<strong>${fromName} → ${toName}</strong><br/>` +
        `p=${d.result.p_value.toFixed(4)}, ` +
        `F=${d.result.f_statistic.toFixed(2)}, ` +
        `lag=${d.result.optimal_lag}Q`;
    }
    tooltip
      .style('opacity', 1)
      .html(html)
      .style('left', (event.pageX + 14) + 'px')
      .style('top', (event.pageY - 14) + 'px');
  }

  function hideTooltip() {
    tooltip.style('opacity', 0);
  }

  function showTooltipFromFocus(event, d) {
    if (d.isDiagonal) return;
    const rect = event.target.closest('g')?.getBoundingClientRect?.() ||
      event.target.getBoundingClientRect();
    const fakeEvent = {
      pageX: rect.left + rect.width / 2 + window.scrollX,
      pageY: rect.top + window.scrollY,
    };
    showTooltip(fakeEvent, d);
  }

  cellGroup
    .on('mousemove', showTooltip)
    .on('mouseleave', hideTooltip)
    .on('focus', showTooltipFromFocus)
    .on('blur', hideTooltip);

  // --- Grid border lines ---
  // Outer border
  g.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'none')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1);

  // --- Legend ---
  const legendY = innerH + 14;
  const legendG = g.append('g').attr('transform', `translate(0, ${legendY})`);

  // Significant swatch
  legendG.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 14).attr('height', 14)
    .attr('rx', 2).attr('fill', COLOR_SIGNIFICANT).attr('opacity', 0.9);
  legendG.append('text')
    .attr('x', 18).attr('y', 11)
    .attr('font-size', '0.72rem').attr('fill', '#374151')
    .text('Significant (p < 0.05)');

  // Not significant swatch
  legendG.append('rect')
    .attr('x', 160).attr('y', 0)
    .attr('width', 14).attr('height', 14)
    .attr('rx', 2).attr('fill', COLOR_NONSIGNIFICANT).attr('stroke', '#9ca3af').attr('stroke-width', 0.5);
  legendG.append('text')
    .attr('x', 178).attr('y', 11)
    .attr('font-size', '0.72rem').attr('fill', '#374151')
    .text('Not significant');

  // Opacity note
  legendG.append('text')
    .attr('x', 0).attr('y', 28)
    .attr('font-size', '0.7rem').attr('fill', '#6b7280')
    .attr('font-style', 'italic')
    .text('Opacity ∝ 1 − p-value  |  Label = optimal lag');

  // Resize SVG height to include legend
  const totalHeight = height + 50;
  svg.attr('height', totalHeight).attr('viewBox', `0 0 ${width} ${totalHeight}`);
}
