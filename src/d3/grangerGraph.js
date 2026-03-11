import * as d3 from 'd3';
import { CITY_COLORS, CITY_NAMES } from '../utils/constants.js';

// Approximate geographic positions (normalised 0-1, flipped Y for SVG)
const GEO_POSITIONS = {
  sydney: { x: 0.82, y: 0.55 },
  melbourne: { x: 0.72, y: 0.75 },
  brisbane: { x: 0.85, y: 0.35 },
  perth: { x: 0.15, y: 0.55 },
  gold_coast: { x: 0.90, y: 0.42 },
};

export function renderGrangerGraph(svgEl, data, prices, options = {}) {
  const { showNonSignificant = false } = options;
  const cities = prices.cities;
  const width = svgEl.parentElement?.clientWidth || 800;
  const height = 450;
  const margin = { top: 30, right: 30, bottom: 30, left: 30 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  // Tooltip
  let tooltip = d3.select('body').select('.d3-tooltip.granger-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip granger-tip')
      .style('opacity', 0);
  }

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Arrow marker
  svg.append('defs').selectAll('marker')
    .data(['arrow-sig', 'arrow-nonsig'])
    .join('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 28)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', d => d === 'arrow-sig' ? '#374151' : '#d1d5db');

  // Build nodes
  const nodes = cities.map(city => ({
    id: city,
    x: (GEO_POSITIONS[city]?.x || 0.5) * innerW,
    y: (GEO_POSITIONS[city]?.y || 0.5) * innerH,
  }));

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Build edges
  const edges = data.results
    .filter(r => showNonSignificant || r.significant)
    .filter(r => nodeMap[r.from] && nodeMap[r.to]);

  const maxF = d3.max(edges, d => d.f_statistic) || 1;

  // Draw edges
  const edgeGroup = g.selectAll('.edge')
    .data(edges)
    .join('g')
    .attr('class', 'edge');

  edgeGroup.append('line')
    .attr('x1', d => nodeMap[d.from].x)
    .attr('y1', d => nodeMap[d.from].y)
    .attr('x2', d => nodeMap[d.to].x)
    .attr('y2', d => nodeMap[d.to].y)
    .attr('stroke', d => d.significant ? '#374151' : '#d1d5db')
    .attr('stroke-width', d => d.significant ? 1 + (d.f_statistic / maxF) * 4 : 1)
    .attr('stroke-dasharray', d => d.significant ? null : '5,5')
    .attr('opacity', d => d.significant ? 0.4 + (d.f_statistic / maxF) * 0.5 : 0.3)
    .attr('marker-end', d => d.significant ? 'url(#arrow-sig)' : 'url(#arrow-nonsig)');

  // Edge labels
  edgeGroup.append('text')
    .attr('x', d => (nodeMap[d.from].x + nodeMap[d.to].x) / 2)
    .attr('y', d => (nodeMap[d.from].y + nodeMap[d.to].y) / 2 - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.7rem')
    .attr('fill', '#6b7280')
    .text(d => d.significant ? `${d.optimal_lag}Q` : '');

  // Edge hover
  edgeGroup
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[d.from] || d.from} → ${CITY_NAMES[d.to] || d.to}</strong><br/>` +
        `p-value: ${d.p_value.toFixed(4)}<br/>` +
        `F-statistic: ${d.f_statistic.toFixed(2)}<br/>` +
        `Optimal lag: ${d.optimal_lag}Q<br/>` +
        `${d.significant ? 'Significant' : 'Not significant'}`
      )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 12) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(150).style('opacity', 0);
    });

  // Draw nodes
  const nodeGroup = g.selectAll('.node')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  nodeGroup.append('circle')
    .attr('r', 20)
    .attr('fill', d => CITY_COLORS[d.id] || '#888')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer');

  nodeGroup.append('text')
    .attr('dy', 35)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.8rem')
    .attr('font-weight', '500')
    .attr('fill', '#374151')
    .text(d => CITY_NAMES[d.id] || d.id);

  // Node hover: highlight edges
  nodeGroup
    .on('mouseover', (event, d) => {
      edgeGroup.select('line')
        .attr('opacity', e =>
          (e.from === d.id || e.to === d.id) ? 1 : 0.1
        );
    })
    .on('mouseout', () => {
      edgeGroup.select('line')
        .attr('opacity', e => e.significant ? 0.4 + (e.f_statistic / maxF) * 0.5 : 0.3);
    });
}
