import * as d3 from 'd3';
import { CITY_COLORS, CITY_NAMES, humanReadableName } from '../utils/constants.js';

/**
 * Render a grouped bar chart showing the #1 most important feature per city.
 * Allows quick visual comparison of what drives each city's prices.
 */
export function renderCrossCityComparison(svgEl, data) {
  const width = svgEl.parentElement?.clientWidth || 800;
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 60, left: 55 };

  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  // Extract top feature per city
  const cityKeys = Object.keys(data.cities);
  const entries = cityKeys.map(city => {
    const features = data.cities[city].features;
    if (!features || features.length === 0) return null;
    const top = features.reduce((best, f) => f.importance > best.importance ? f : best, features[0]);
    return { city, feature: top.name, importance: top.importance, group: top.group };
  }).filter(Boolean);

  if (entries.length === 0) return;

  // Tooltip
  let tooltip = d3.select('body').select('.d3-tooltip.cc-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip cc-tip')
      .style('opacity', 0);
  }

  const x = d3.scaleBand()
    .domain(entries.map(d => d.city))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(entries, d => d.importance) * 1.15])
    .range([height - margin.bottom, margin.top]);

  const g = svg.append('g');

  // Bars
  g.selectAll('.cc-bar')
    .data(entries)
    .join('rect')
    .attr('class', 'cc-bar')
    .attr('x', d => x(d.city))
    .attr('y', d => y(d.importance))
    .attr('width', x.bandwidth())
    .attr('height', d => Math.max(0, y(0) - y(d.importance)))
    .attr('fill', d => CITY_COLORS[d.city] || '#9ca3af')
    .attr('rx', 4)
    .attr('tabindex', '0')
    .attr('role', 'img')
    .attr('aria-label', d =>
      `${CITY_NAMES[d.city]}: top feature is ${humanReadableName(d.feature)}, importance ${(d.importance * 100).toFixed(1)}%`
    )
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[d.city]}</strong><br/>` +
        `Top feature: ${humanReadableName(d.feature)}<br/>` +
        `Importance: ${(d.importance * 100).toFixed(1)}%<br/>` +
        `Group: ${d.group}`
      )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 12) + 'px');
      d3.select(event.target).attr('opacity', 0.8);
    })
    .on('mouseout', (event) => {
      tooltip.transition().duration(150).style('opacity', 0);
      d3.select(event.target).attr('opacity', 1);
    })
    .on('focus', (event, d) => {
      const domRect = event.target.getBoundingClientRect();
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[d.city]}</strong><br/>` +
        `Top feature: ${humanReadableName(d.feature)}<br/>` +
        `Importance: ${(d.importance * 100).toFixed(1)}%<br/>` +
        `Group: ${d.group}`
      )
        .style('left', (domRect.right + window.scrollX + 12) + 'px')
        .style('top', (domRect.top + window.scrollY) + 'px');
      d3.select(event.target).attr('opacity', 0.8);
    })
    .on('blur', (event) => {
      tooltip.transition().duration(150).style('opacity', 0);
      d3.select(event.target).attr('opacity', 1);
    });

  // Feature name labels above bars
  g.selectAll('.cc-feature-label')
    .data(entries)
    .join('text')
    .attr('class', 'cc-feature-label')
    .attr('x', d => x(d.city) + x.bandwidth() / 2)
    .attr('y', d => y(d.importance) - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.65rem')
    .attr('fill', '#4b5563')
    .text(d => humanReadableName(d.feature));

  // Value labels inside bars
  g.selectAll('.cc-value-label')
    .data(entries)
    .join('text')
    .attr('class', 'cc-value-label')
    .attr('x', d => x(d.city) + x.bandwidth() / 2)
    .attr('y', d => y(d.importance) + 18)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.7rem')
    .attr('fill', '#fff')
    .attr('font-weight', '600')
    .text(d => `${(d.importance * 100).toFixed(1)}%`);

  // X-axis: city names
  g.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d => CITY_NAMES[d] || d))
    .selectAll('text')
    .attr('font-size', '0.8rem')
    .attr('fill', '#374151');

  // Y-axis: importance
  g.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`))
    .selectAll('text')
    .attr('font-size', '0.75rem');

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height / 2))
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.75rem')
    .attr('fill', '#6b7280')
    .text('Feature Importance');
}
