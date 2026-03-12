# Deployment Specification

## Overview
Deploy the static React app to GitHub Pages. The Python analysis pipeline runs locally (or in CI) and commits JSON output; the frontend builds and deploys from the same repo.

## Repository Structure
```
houseViz/
├── python/                  # Analysis scripts
│   ├── data_pipeline.py
│   ├── granger.py
│   ├── hmm_regimes.py
│   ├── lightgbm_model.py
│   └── requirements.txt
├── data/                    # Generated JSON (committed to repo)
│   ├── prices.json
│   ├── macro.json
│   ├── granger.json
│   ├── hmm.json
│   └── lightgbm.json
├── src/                     # React app source
├── public/
│   └── data/ → ../data/     # Symlink or copy at build time
├── specs/                   # These spec files
├── package.json
├── vite.config.js
└── README.md
```

## GitHub Pages Setup

### Vite Config
```js
// vite.config.js
export default {
  base: '/houseViz/',
  build: {
    outDir: 'dist'
  }
}
```

### Deployment Method
- Use `gh-pages` npm package or GitHub Actions
- Target URL: `https://<username>.github.io/houseViz/`

### GitHub Actions Workflow (recommended)
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Data Copy Step
Before `npm run build`, copy `data/` into `public/data/` so Vite includes it in the build output:
```json
// package.json scripts
{
  "prebuild": "mkdir -p public/data && cp data/*.json public/data/",
  "build": "vite build"
}
```

## Python Environment

### `python/requirements.txt`
```
pandas>=2.0
openpyxl>=3.1
statsmodels>=0.14
hmmlearn>=0.3
lightgbm>=4.0
scikit-learn>=1.3
```

### Running the Pipeline
```bash
cd python
pip install -r requirements.txt
python data_pipeline.py
python granger.py
python hmm_regimes.py
python lightgbm_model.py
```

All scripts read from and write to `data/`. Run them in order (pipeline first, then analyses).

## Pre-Deployment Checklist
- [ ] All 5 JSON files present in `data/`
- [ ] `npm run build` succeeds with no errors
- [ ] `dist/data/` contains all JSON files
- [ ] Local preview (`npm run preview`) loads all visualisations
- [ ] Responsive layout checked at mobile (375px) and desktop (1440px)
- [ ] GitHub repo is public (required for free GitHub Pages)
- [ ] Repository About section includes the live URL
