import * as d3 from 'd3';
import { CITY_COLORS, CITY_NAMES, REGIME_COLORS, REGIME_COLORS_SOLID } from '../utils/constants.js';

/**
 * Overlay multiple cities' normalised price index lines on a single chart.
 * No regime bands are drawn — the purpose is cross-city comparison.
 * Each line uses the city's standard colour from CITY_COLORS.
 */
export function renderRegimeTimelineOverlay(svgEl, hmmData, pricesData, cities) {
  const width = svgEl.parentElement?.clientWidth || 800;
  const height = 380;
  const margin = { top: 30, right: 20, bottom: 40, left: 55 };

  const svg = d3.select(svgEl)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  if (!cities || cities.length === 0) return;

  const dates = pricesData.dates.map(parseQuarter);

  // Normalise each city's index to 100 at start date for fair comparison
  const normalised = {};
  cities.forEach(city => {
    const raw = pricesData.series[city]?.index;
    if (!raw || raw.length === 0) return;
    const base = raw[0];
    normalised[city] = raw.map(v => (v / base) * 100);
  });

  const activeCities = cities.filter(c => normalised[c]);
  if (activeCities.length === 0) return;

  // Tooltip
  let tooltip = d3.select('body').select('.d3-tooltip.hmm-overlay-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip hmm-overlay-tip')
      .style('opacity', 0);
  }

  // Compute global Y domain across all selected cities
  const allValues = activeCities.flatMap(c => normalised[c]);
  const yMin = d3.min(allValues) * 0.95;
  const yMax = d3.max(allValues) * 1.05;

  const x = d3.scaleTime()
    .domain(d3.extent(dates))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height - margin.bottom, margin.top]);

  const g = svg.append('g');

  // Draw a line for each city
  activeCities.forEach(city => {
    const values = normalised[city];
    const line = d3.line()
      .x((_, i) => x(dates[i]))
      .y(d => y(d))
      .defined(d => d != null);

    g.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', CITY_COLORS[city] || '#333')
      .attr('stroke-width', 2)
      .attr('d', line);
  });

  // Vertical hover line + crosshair tooltip showing all cities' values
  const hoverLine = g.append('line')
    .attr('stroke', '#9ca3af')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .style('opacity', 0);

  // Invisible overlay rect for mouse tracking
  g.append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const dateAtMouse = x.invert(mx);
      // Find nearest quarter index
      const bisect = d3.bisector(d => d).left;
      let idx = bisect(dates, dateAtMouse, 1);
      if (idx >= dates.length) idx = dates.length - 1;
      if (idx > 0 && (dateAtMouse - dates[idx - 1]) < (dates[idx] - dateAtMouse)) {
        idx = idx - 1;
      }
      const snappedX = x(dates[idx]);
      hoverLine.attr('x1', snappedX).attr('x2', snappedX).style('opacity', 1);

      const rows = activeCities.map(city => {
        const val = normalised[city][idx];
        const color = CITY_COLORS[city] || '#333';
        return `<span style="color:${color}"><strong>${CITY_NAMES[city]}</strong>: ${val.toFixed(1)}</span>`;
      }).join('<br/>');

      tooltip.transition().duration(100).style('opacity', 1);
      tooltip.html(`<strong>${pricesData.dates[idx]}</strong><br/>${rows}`)
        .style('left', (event.pageX + 14) + 'px')
        .style('top', (event.pageY - 14) + 'px');
    })
    .on('mouseout', () => {
      hoverLine.style('opacity', 0);
      tooltip.transition().duration(150).style('opacity', 0);
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
    .text('Normalised Index (100 = start)');

  // Legend — horizontal, top of chart
  const legend = g.append('g')
    .attr('transform', `translate(${margin.left + 10}, ${margin.top + 5})`);

  activeCities.forEach((city, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 110}, 0)`);
    lg.append('line')
      .attr('x1', 0).attr('y1', 6)
      .attr('x2', 14).attr('y2', 6)
      .attr('stroke', CITY_COLORS[city])
      .attr('stroke-width', 2);
    lg.append('text')
      .attr('x', 18).attr('y', 10)
      .attr('font-size', '0.7rem')
      .attr('fill', '#4b5563')
      .text(CITY_NAMES[city] || city);
  });
}

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

  // Price dots for hover and focus — bind {value, i} to avoid indexOf bug
  const dotData = indexValues.map((value, i) => ({ value, i }));

  g.selectAll('.price-dot')
    .data(dotData)
    .join('circle')
    .attr('class', 'price-dot')
    .attr('cx', d => x(dates[d.i]))
    .attr('cy', d => y(d.value))
    .attr('r', 3)
    .attr('fill', 'transparent')
    .attr('stroke', 'transparent')
    .attr('tabindex', '0')
    .attr('role', 'img')
    .attr('aria-label', d => `${CITY_NAMES[city]}, ${pricesData.dates[d.i]}, index ${d.value.toFixed(1)}`)
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[city]}</strong><br/>` +
        `${pricesData.dates[d.i]}<br/>` +
        `Index: ${d.value.toFixed(1)}`
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
      const domRect = event.target.getBoundingClientRect();
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(
        `<strong>${CITY_NAMES[city]}</strong><br/>` +
        `${pricesData.dates[d.i]}<br/>` +
        `Index: ${d.value.toFixed(1)}`
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
