import * as d3 from 'd3';
import { CITY_COLORS, CITY_NAMES, REGIME_COLORS, REGIME_COLORS_SOLID } from '../utils/constants.js';

function parseQuarter(q) {
  // "2005-Q1" → Date(2005, 0, 1)
  const [year, qn] = q.split('-Q');
  const month = (parseInt(qn) - 1) * 3;
  return new Date(parseInt(year), month, 1);
}

export function renderRegimeTimeline(svgEl, hmmData, pricesData, city) {
  const width = svgEl.parentElement?.clientWidth || 800;
  const height = 380;
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };

  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  const cityHMM = hmmData.cities[city];
  const citySeries = pricesData.series[city];
  if (!cityHMM || !citySeries) return;

  const dates = pricesData.dates.map(parseQuarter);
  const indexValues = citySeries.index;

  // Tooltip
  let tooltip = d3.select('body').select('.d3-tooltip.hmm-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip hmm-tip')
      .style('opacity', 0);
  }

  const x = d3.scaleTime()
    .domain(d3.extent(dates))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([d3.min(indexValues) * 0.95, d3.max(indexValues) * 1.05])
    .range([height - margin.bottom, margin.top]);

  const g = svg.append('g');

  // Draw regime bands
  const regimes = cityHMM.regimes;
  let bandStart = 0;
  for (let i = 0; i <= regimes.length; i++) {
    if (i === regimes.length || regimes[i] !== regimes[bandStart]) {
      const regime = regimes[bandStart];
      const x0 = x(dates[bandStart]);
      const x1 = i < dates.length ? x(dates[i]) : x(dates[dates.length - 1]);

      const avgReturn = citySeries.returns
        .slice(bandStart, i)
        .filter(v => v !== null)
        .reduce((a, b) => a + b, 0) / Math.max(1, i - bandStart);

      const durationQ = i - bandStart;
      const bandLabel = `${regime.charAt(0).toUpperCase() + regime.slice(1)} regime, duration ${durationQ} quarter${durationQ !== 1 ? 's' : ''}, average return ${(avgReturn * 100).toFixed(2)}%`;

      function showBandTooltip(event) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
          `<strong style="color:${REGIME_COLORS_SOLID[regime]}">${regime.charAt(0).toUpperCase() + regime.slice(1)}</strong><br/>` +
          `Duration: ${durationQ} quarter${durationQ !== 1 ? 's' : ''}<br/>` +
          `Avg return: ${(avgReturn * 100).toFixed(2)}%`
        )
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 12) + 'px');
      }

      function showBandTooltipFromFocus(event) {
        tooltip.transition().duration(150).style('opacity', 1);
        const rect = event.target.getBoundingClientRect();
        tooltip.html(
          `<strong style="color:${REGIME_COLORS_SOLID[regime]}">${regime.charAt(0).toUpperCase() + regime.slice(1)}</strong><br/>` +
          `Duration: ${durationQ} quarter${durationQ !== 1 ? 's' : ''}<br/>` +
          `Avg return: ${(avgReturn * 100).toFixed(2)}%`
        )
          .style('left', (rect.left + rect.width / 2 + window.scrollX + 12) + 'px')
          .style('top', (rect.top + window.scrollY - 12) + 'px');
      }

      g.append('rect')
        .attr('x', x0)
        .attr('y', margin.top)
        .attr('width', Math.max(0, x1 - x0))
        .attr('height', height - margin.top - margin.bottom)
        .attr('fill', REGIME_COLORS[regime] || 'transparent')
        .attr('class', 'regime-band')
        .attr('tabindex', '0')
        .attr('role', 'img')
        .attr('aria-label', bandLabel)
        .style('cursor', 'pointer')
        .on('mouseover', showBandTooltip)
        .on('mouseout', () => {
          tooltip.transition().duration(150).style('opacity', 0);
        })
        .on('focus', showBandTooltipFromFocus)
        .on('blur', () => {
          tooltip.transition().duration(150).style('opacity', 0);
        });

      bandStart = i;
    }
  }

  // Price line
  const line = d3.line()
    .x((_, i) => x(dates[i]))
    .y(d => y(d))
    .defined(d => d != null);

  g.append('path')
    .datum(indexValues)
    .attr('fill', 'none')
    .attr('stroke', CITY_COLORS[city] || '#333')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Price dots for hover and focus
  g.selectAll('.price-dot')
    .data(indexValues)
    .join('circle')
    .attr('class', 'price-dot')
    .attr('cx', (_, i) => x(dates[i]))
    .attr('cy', d => y(d))
    .attr('r', 3)
    .attr('fill', 'transparent')
    .attr('stroke', 'transparent')
    .attr('tabindex', '0')
    .attr('role', 'img')
    .attr('aria-label', (d, i) => `${CITY_NAMES[city]}, ${pricesData.dates[i]}, index ${d.toFixed(1)}`)
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      const i = indexValues.indexOf(d);
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[city]}</strong><br/>` +
        `${pricesData.dates[i]}<br/>` +
        `Index: ${d.toFixed(1)}`
      )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 12) + 'px');
      d3.select(event.target).attr('r', 5).attr('fill', CITY_COLORS[city]);
    })
    .on('mouseout', (event) => {
      tooltip.transition().duration(150).style('opacity', 0);
      d3.select(event.target).attr('r', 3).attr('fill', 'transparent');
    })
    .on('focus', (event, d) => {
      const i = indexValues.indexOf(d);
      const domRect = event.target.getBoundingClientRect();
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[city]}</strong><br/>` +
        `${pricesData.dates[i]}<br/>` +
        `Index: ${d.toFixed(1)}`
      )
        .style('left', (domRect.left + window.scrollX + 12) + 'px')
        .style('top', (domRect.top + window.scrollY - 12) + 'px');
      d3.select(event.target).attr('r', 5).attr('fill', CITY_COLORS[city]).attr('stroke', CITY_COLORS[city]);
    })
    .on('blur', (event) => {
      tooltip.transition().duration(150).style('opacity', 0);
      d3.select(event.target).attr('r', 3).attr('fill', 'transparent').attr('stroke', 'transparent');
    });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width > 500 ? 10 : 5))
    .selectAll('text')
    .attr('font-size', '0.75rem');

  g.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6))
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
    .text('Price Index');

  // Legend — derive from actual regimes present in this city's data
  const legendData = cityHMM.regime_labels
    ? [...cityHMM.regime_labels].reverse()
    : [...new Set(cityHMM.regimes)].sort((a, b) => {
        const order = { boom: 0, stagnation: 1, correction: 2 };
        return (order[a] ?? 3) - (order[b] ?? 3);
      });
  const legend = g.append('g')
    .attr('transform', `translate(${margin.left + 10}, ${margin.top + 5})`);

  legendData.forEach((regime, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 110}, 0)`);
    lg.append('rect')
      .attr('width', 12).attr('height', 12)
      .attr('fill', REGIME_COLORS_SOLID[regime])
      .attr('opacity', 0.5)
      .attr('rx', 2);
    lg.append('text')
      .attr('x', 16).attr('y', 10)
      .attr('font-size', '0.7rem')
      .attr('fill', '#4b5563')
      .text(regime.charAt(0).toUpperCase() + regime.slice(1));
  });
}
