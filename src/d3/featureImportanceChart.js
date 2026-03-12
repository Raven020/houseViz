import * as d3 from 'd3';
import { FEATURE_GROUP_COLORS, humanReadableName } from '../utils/constants.js';

const FEATURE_DESCRIPTIONS = {
  cash_rate: 'RBA cash rate level',
  cash_rate_change: 'Quarter-on-quarter change in cash rate',
  cpi: 'CPI quarterly percentage change',
  unemployment: 'Unemployment rate level',
  unemployment_change: 'Quarter-on-quarter change in unemployment',
};

function getDescription(name) {
  const base = name.replace(/_lag\d+$/, '');
  const lagMatch = name.match(/_lag(\d+)$/);
  const desc = FEATURE_DESCRIPTIONS[base] || `${humanReadableName(base)}`;
  return lagMatch ? `${desc} (${lagMatch[1]}-quarter lag)` : desc;
}

export function renderFeatureImportanceChart(svgEl, data, city, options = {}) {
  const { aggregateByCategory = false } = options;
  const width = svgEl.parentElement?.clientWidth || 800;
  const margin = { top: 20, right: 30, bottom: 20, left: 180 };

  const cityData = data.cities[city];
  if (!cityData) return;

  let features;
  if (aggregateByCategory) {
    // Aggregate lagged variants of the same base feature into one bar
    const baseMap = new Map();
    cityData.features.forEach(f => {
      const base = f.name.replace(/_lag\d+$/, '');
      if (!baseMap.has(base)) {
        baseMap.set(base, { name: base, importance: 0, group: f.group });
      }
      baseMap.get(base).importance += f.importance;
    });
    const sorted = [...baseMap.values()].sort((a, b) => b.importance - a.importance);
    if (sorted.length > 10) {
      const top10 = sorted.slice(0, 10);
      const otherImportance = sorted.slice(10).reduce((s, f) => s + f.importance, 0);
      features = [...top10, { name: 'other', importance: otherImportance, group: 'Other' }];
    } else {
      features = sorted;
    }
  } else {
    // Top 10 features; collapse rest to "Other"
    const sortedFeatures = [...cityData.features].sort((a, b) => b.importance - a.importance);
    if (sortedFeatures.length > 10) {
      const top10 = sortedFeatures.slice(0, 10);
      const otherImportance = sortedFeatures.slice(10).reduce((s, f) => s + f.importance, 0);
      features = [...top10, { name: 'other', importance: otherImportance, group: 'Other' }];
    } else {
      features = sortedFeatures;
    }
  }

  const barHeight = 28;
  const gap = 4;
  const height = margin.top + margin.bottom + features.length * (barHeight + gap);

  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  // Tooltip
  let tooltip = d3.select('body').select('.d3-tooltip.lgbm-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip lgbm-tip')
      .style('opacity', 0);
  }

  const x = d3.scaleLinear()
    .domain([0, d3.max(features, d => d.importance) * 1.1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(features.map(d => d.name))
    .range([margin.top, height - margin.bottom])
    .padding(0.15);

  const g = svg.append('g');

  function buildBarTooltipHTML(d) {
    return (
      `<strong>${humanReadableName(d.name)}</strong><br/>` +
      `${getDescription(d.name)}<br/>` +
      `Importance: ${(d.importance * 100).toFixed(1)}%<br/>` +
      `Group: ${d.group}`
    );
  }

  // Bars
  g.selectAll('.bar')
    .data(features)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', margin.left)
    .attr('y', d => y(d.name))
    .attr('width', d => Math.max(0, x(d.importance) - margin.left))
    .attr('height', y.bandwidth())
    .attr('fill', d => FEATURE_GROUP_COLORS[d.group] || '#9ca3af')
    .attr('rx', 3)
    .attr('tabindex', '0')
    .attr('role', 'img')
    .attr('aria-label', d =>
      `${humanReadableName(d.name)}, importance ${(d.importance * 100).toFixed(1)}%, group ${d.group}`
    )
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(buildBarTooltipHTML(d))
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
      tooltip.html(buildBarTooltipHTML(d))
        .style('left', (domRect.right + window.scrollX + 12) + 'px')
        .style('top', (domRect.top + window.scrollY) + 'px');
      d3.select(event.target).attr('opacity', 0.8);
    })
    .on('blur', (event) => {
      tooltip.transition().duration(150).style('opacity', 0);
      d3.select(event.target).attr('opacity', 1);
    });

  // Labels on bars
  g.selectAll('.bar-label')
    .data(features)
    .join('text')
    .attr('class', 'bar-label')
    .attr('x', margin.left - 6)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('font-size', '0.75rem')
    .attr('fill', '#374151')
    .text(d => humanReadableName(d.name));

  // Value labels
  g.selectAll('.value-label')
    .data(features)
    .join('text')
    .attr('class', 'value-label')
    .attr('x', d => x(d.importance) + 4)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('font-size', '0.7rem')
    .attr('fill', '#6b7280')
    .text(d => `${(d.importance * 100).toFixed(1)}%`);

  // Legend
  const groups = [...new Set(features.map(d => d.group))];
  const legend = g.append('g')
    .attr('transform', `translate(${width - margin.right - groups.length * 100}, ${margin.top - 14})`);

  groups.forEach((group, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 100}, 0)`);
    lg.append('rect')
      .attr('width', 10).attr('height', 10)
      .attr('fill', FEATURE_GROUP_COLORS[group] || '#9ca3af')
      .attr('rx', 2);
    lg.append('text')
      .attr('x', 14).attr('y', 9)
      .attr('font-size', '0.65rem')
      .attr('fill', '#6b7280')
      .text(group);
  });
}
