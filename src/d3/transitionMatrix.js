import * as d3 from 'd3';
import { CITY_NAMES } from '../utils/constants.js';

// Default 3-state labels; overridden per-city when the HMM fell back to 2 states
const DEFAULT_STATES = ['correction', 'stagnation', 'boom'];

function getStateLabels(cityHMM, hmmMeta) {
  // Per-city override (set when HMM fell back to fewer states)
  if (cityHMM.regime_labels) return cityHMM.regime_labels;
  // Top-level meta labels
  if (hmmMeta?.regime_labels) return hmmMeta.regime_labels;
  return DEFAULT_STATES;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderTransitionMatrix(svgEl, hmmData, city) {
  const cityHMM = hmmData?.cities?.[city];
  if (!cityHMM || !cityHMM.transition_matrix) return;

  const matrix = cityHMM.transition_matrix; // NxN array, row = from, col = to
  const nStates = matrix.length;
  const stateLabels = getStateLabels(cityHMM, hmmData.meta);
  const cityLabel = CITY_NAMES[city] || city;

  // Layout constants — adapt to state count
  const cellSize = 72;
  const headerWidth = 84;   // left header column width
  const headerHeight = 48;  // top header row height
  const titleHeight = 32;
  const padding = { top: titleHeight + headerHeight, left: headerWidth, right: 16, bottom: 16 };

  const innerWidth = cellSize * nStates;
  const innerHeight = cellSize * nStates;
  const totalWidth = padding.left + innerWidth + padding.right;
  const totalHeight = padding.top + innerHeight + padding.bottom;

  const svg = d3.select(svgEl)
    .attr('width', totalWidth)
    .attr('height', totalHeight)
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .attr('role', 'img')
    .attr('aria-label', `Transition probability matrix for ${cityLabel}`);

  svg.selectAll('*').remove();

  // Color scale: 0 → white-ish, 1 → deep blue
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);

  // Tooltip (shared with other charts, use a distinct class)
  let tooltip = d3.select('body').select('.d3-tooltip.tm-tip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip tm-tip')
      .style('opacity', 0);
  }

  const g = svg.append('g');

  // --- Title ---
  g.append('text')
    .attr('x', totalWidth / 2)
    .attr('y', titleHeight - 8)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.85rem')
    .attr('font-weight', '600')
    .attr('fill', '#1f2937')
    .text(`${cityLabel} — State Transition Probabilities`);

  // --- Column headers ("To" state) ---
  const colHeader = g.append('g')
    .attr('transform', `translate(${padding.left}, ${titleHeight})`);

  // "To →" label
  colHeader.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.7rem')
    .attr('fill', '#6b7280')
    .text('To →');

  stateLabels.forEach((state, j) => {
    colHeader.append('text')
      .attr('x', j * cellSize + cellSize / 2)
      .attr('y', headerHeight - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.72rem')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text(capitalize(state));
  });

  // --- Row headers ("From" state) ---
  const rowHeader = g.append('g')
    .attr('transform', `translate(0, ${padding.top})`);

  // "↓ From" label
  rowHeader.append('text')
    .attr('x', headerWidth / 2)
    .attr('y', innerHeight / 2 - 12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '0.7rem')
    .attr('fill', '#6b7280')
    .text('↓ From');

  stateLabels.forEach((state, i) => {
    rowHeader.append('text')
      .attr('x', headerWidth - 8)
      .attr('y', i * cellSize + cellSize / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '0.72rem')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text(capitalize(state));
  });

  // --- Cells ---
  const cellGroup = g.append('g')
    .attr('transform', `translate(${padding.left}, ${padding.top})`);

  matrix.forEach((row, i) => {
    row.forEach((prob, j) => {
      const x = j * cellSize;
      const y = i * cellSize;
      const pct = Math.round(prob * 100);
      const fromState = capitalize(stateLabels[i] || `State ${i}`);
      const toState = capitalize(stateLabels[j] || `State ${j}`);
      const ariaLabel = `From ${fromState} to ${toState}: ${(prob * 100).toFixed(1)}% probability`;

      const cell = cellGroup.append('g')
        .attr('transform', `translate(${x}, ${y})`)
        .attr('tabindex', '0')
        .attr('role', 'img')
        .attr('aria-label', ariaLabel)
        .style('cursor', 'default');

      // Background rect
      cell.append('rect')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', colorScale(prob))
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1)
        .attr('rx', 2);

      // Probability label
      // Use white text on dark cells (prob > 0.5), dark text on light cells
      const textColor = prob > 0.55 ? '#ffffff' : '#1f2937';
      cell.append('text')
        .attr('x', cellSize / 2)
        .attr('y', cellSize / 2 + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '0.85rem')
        .attr('font-weight', '600')
        .attr('fill', textColor)
        .text(`${pct}%`);

      // Hover / focus tooltip handlers
      function showTooltip(event) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
          `From <strong>${fromState}</strong> → To <strong>${toState}</strong>: ` +
          `${(prob * 100).toFixed(1)}% probability`
        )
          .style('left', (event.pageX + 14) + 'px')
          .style('top', (event.pageY - 14) + 'px');
      }

      function showTooltipFromFocus(event) {
        const rect = event.target.closest('g').getBoundingClientRect();
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
          `From <strong>${fromState}</strong> → To <strong>${toState}</strong>: ` +
          `${(prob * 100).toFixed(1)}% probability`
        )
          .style('left', (rect.left + rect.width / 2 + window.scrollX + 14) + 'px')
          .style('top', (rect.top + window.scrollY - 14) + 'px');
      }

      function hideTooltip() {
        tooltip.transition().duration(150).style('opacity', 0);
      }

      // Highlight border on hover/focus via a transparent overlay rect
      const hoverRect = cell.append('rect')
        .attr('class', 'tm-hover-rect')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 2)
        .attr('rx', 2);

      cell
        .on('mouseover', (event) => {
          hoverRect.attr('stroke', '#1d4ed8');
          showTooltip(event);
        })
        .on('mousemove', showTooltip)
        .on('mouseout', () => {
          hoverRect.attr('stroke', 'transparent');
          hideTooltip();
        })
        .on('focus', (event) => {
          hoverRect.attr('stroke', '#1d4ed8');
          showTooltipFromFocus(event);
        })
        .on('blur', () => {
          hoverRect.attr('stroke', 'transparent');
          hideTooltip();
        });
    });
  });

  // --- Color scale legend bar ---
  const legendW = innerWidth;
  const legendH = 8;
  const legendY = padding.top + innerHeight + 10;

  const defs = svg.append('defs');
  const linearGrad = defs.append('linearGradient')
    .attr('id', `tm-grad-${city}`)
    .attr('x1', '0%').attr('x2', '100%')
    .attr('y1', '0%').attr('y2', '0%');

  d3.range(0, 1.01, 0.1).forEach(t => {
    linearGrad.append('stop')
      .attr('offset', `${Math.round(t * 100)}%`)
      .attr('stop-color', colorScale(t));
  });

  const legendG = svg.append('g')
    .attr('transform', `translate(${padding.left}, ${legendY})`);

  legendG.append('rect')
    .attr('width', legendW)
    .attr('height', legendH)
    .attr('fill', `url(#tm-grad-${city})`)
    .attr('rx', 2)
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 0.5);

  legendG.append('text')
    .attr('x', 0)
    .attr('y', legendH + 12)
    .attr('font-size', '0.65rem')
    .attr('fill', '#6b7280')
    .text('0%');

  legendG.append('text')
    .attr('x', legendW)
    .attr('y', legendH + 12)
    .attr('text-anchor', 'end')
    .attr('font-size', '0.65rem')
    .attr('fill', '#6b7280')
    .text('100%');
}
