import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPrices, loadGranger, loadHMM, loadLightGBM, loadAllData } from '../utils/dataLoader.js';

const mockPrices = { cities: ['sydney'], dates: ['2005-Q1'], series: {} };
const mockGranger = { results: [] };
const mockHMM = { cities: {}, dates: [] };
const mockLightGBM = { cities: {} };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    let data;
    if (url.includes('prices.json')) data = mockPrices;
    else if (url.includes('granger.json')) data = mockGranger;
    else if (url.includes('hmm.json')) data = mockHMM;
    else if (url.includes('lightgbm.json')) data = mockLightGBM;
    else return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    });
  });
});

describe('dataLoader', () => {
  it('loadPrices fetches prices.json', async () => {
    const result = await loadPrices();
    expect(result).toEqual(mockPrices);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('prices.json'));
  });

  it('loadGranger fetches granger.json', async () => {
    const result = await loadGranger();
    expect(result).toEqual(mockGranger);
  });

  it('loadHMM fetches hmm.json', async () => {
    const result = await loadHMM();
    expect(result).toEqual(mockHMM);
  });

  it('loadLightGBM fetches lightgbm.json', async () => {
    const result = await loadLightGBM();
    expect(result).toEqual(mockLightGBM);
  });

  it('loadAllData fetches all 4 data files', async () => {
    const result = await loadAllData();
    expect(result).toHaveProperty('prices');
    expect(result).toHaveProperty('granger');
    expect(result).toHaveProperty('hmm');
    expect(result).toHaveProperty('lightgbm');
  });

  it('throws on fetch failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' })
    );
    await expect(loadPrices()).rejects.toThrow('Failed to load prices.json');
  });
});
