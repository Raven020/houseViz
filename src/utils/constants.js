export const CITY_COLORS = {
  sydney: '#2563EB',
  melbourne: '#7C3AED',
  brisbane: '#B45309',
  perth: '#DC2626',
};

export const CITY_NAMES = {
  sydney: 'Sydney',
  melbourne: 'Melbourne',
  brisbane: 'Brisbane',
  perth: 'Perth',
};

export const REGIME_COLORS = {
  boom: 'rgba(34, 197, 94, 0.2)',
  stagnation: 'rgba(245, 158, 11, 0.2)',
  correction: 'rgba(239, 68, 68, 0.2)',
};

export const REGIME_COLORS_SOLID = {
  boom: '#22c55e',
  stagnation: '#f59e0b',
  correction: '#ef4444',
};

export const FEATURE_GROUP_COLORS = {
  'Interest Rates': '#2563EB',
  'Employment': '#7C3AED',
  'Inflation': '#B45309',
  'Cross-City': '#047857',
};

export function humanReadableName(name) {
  return name
    .replace(/_lag(\d+)/, ' (lag $1Q)')
    .replace(/_return/, ' return')
    .replace(/_change/, ' change')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
