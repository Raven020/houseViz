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

export async function loadMacro() {
  return fetchJSON('macro.json');
}

export async function loadGranger() {
  return fetchJSON('granger.json');
}

export async function loadHMM() {
  return fetchJSON('hmm.json');
}

export async function loadXGBoost() {
  return fetchJSON('xgboost.json');
}

export async function loadAllData() {
  const [prices, macro, granger, hmm, xgboost] = await Promise.all([
    loadPrices(),
    loadMacro(),
    loadGranger(),
    loadHMM(),
    loadXGBoost(),
  ]);
  return { prices, macro, granger, hmm, xgboost };
}
