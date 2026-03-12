const BASE = import.meta.env.BASE_URL;

async function fetchJSON(path) {
  const url = `${BASE}data/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function loadPrices() {
  return fetchJSON('prices.json');
}

export async function loadGranger() {
  return fetchJSON('granger.json');
}

export async function loadHMM() {
  return fetchJSON('hmm.json');
}

export async function loadLightGBM() {
  return fetchJSON('lightgbm.json');
}

export async function loadAllData() {
  const [prices, granger, hmm, lightgbm] = await Promise.all([
    loadPrices(),
    loadGranger(),
    loadHMM(),
    loadLightGBM(),
  ]);
  return { prices, granger, hmm, lightgbm };
}
