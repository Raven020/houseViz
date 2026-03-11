import { describe, it, expect } from 'vitest';
import { CITY_COLORS, CITY_NAMES, REGIME_COLORS, FEATURE_GROUP_COLORS } from '../utils/constants.js';

describe('constants', () => {
  it('defines colors for all 4 cities', () => {
    const cities = ['sydney', 'melbourne', 'brisbane', 'perth'];
    cities.forEach(city => {
      expect(CITY_COLORS[city]).toBeDefined();
      expect(CITY_COLORS[city]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
    expect(Object.keys(CITY_COLORS)).toHaveLength(4);
  });

  it('defines display names for all 4 cities', () => {
    expect(CITY_NAMES.sydney).toBe('Sydney');
    expect(CITY_NAMES.melbourne).toBe('Melbourne');
    expect(CITY_NAMES.brisbane).toBe('Brisbane');
    expect(CITY_NAMES.perth).toBe('Perth');
    expect(Object.keys(CITY_NAMES)).toHaveLength(4);
  });

  it('defines regime colors for all 3 regimes', () => {
    expect(REGIME_COLORS.boom).toBeDefined();
    expect(REGIME_COLORS.stagnation).toBeDefined();
    expect(REGIME_COLORS.correction).toBeDefined();
  });

  it('defines feature group colors', () => {
    expect(FEATURE_GROUP_COLORS['Interest Rates']).toBeDefined();
    expect(FEATURE_GROUP_COLORS['Employment']).toBeDefined();
    expect(FEATURE_GROUP_COLORS['Inflation']).toBeDefined();
    expect(FEATURE_GROUP_COLORS['Cross-City']).toBeDefined();
  });
});
