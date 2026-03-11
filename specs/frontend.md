# Frontend Specification

## Overview
Single-page React application with three D3.js visualisations, reading pre-computed JSON. No backend. Clean, professional UI suitable for a LinkedIn portfolio piece.

## Tech Stack
| Layer | Choice |
|---|---|
| Framework | React 18 (Vite) |
| Charting | D3.js v7 (direct SVG bindings, not a wrapper) |
| Styling | CSS Modules or Tailwind CSS |
| Routing | None — single scrollable page with section anchors |
| Build | Vite → static output to `dist/` |

## Layout & Narrative Flow

The page reads as a top-to-bottom data story:

```
┌──────────────────────────────────┐
│           Header / Hero          │
│  Title, subtitle, brief intro    │
├──────────────────────────────────┤
│  Section 1: City Relationships   │
│  (Granger Causality)             │
│  Directed graph + explanation    │
├──────────────────────────────────┤
│  Section 2: Market Regimes       │
│  (HMM)                          │
│  Timeline with regime bands      │
├──────────────────────────────────┤
│  Section 3: What Drives Prices   │
│  (LightGBM)                      │
│  Feature importance bars         │
├──────────────────────────────────┤
│           Footer                 │
│  Methodology notes, data sources │
│  GitHub link, author info        │
└──────────────────────────────────┘
```

## Components

### `App.jsx`
- Top-level layout, loads JSON data via `fetch()` on mount
- Passes data down to section components
- Loading state while JSON fetches complete

### `Header.jsx`
- Project title: "Australian Housing Market Econometrics"
- Subtitle: "An interactive exploration of price dynamics across 5 cities"
- Brief 2–3 sentence intro setting the narrative context

### `GrangerSection.jsx`
- Section heading + 1–2 paragraph explanation of Granger causality in plain language
- Embeds `GrangerGraph` (D3 component)
- See `specs/granger-causality.md` for visualisation details

### `HMMSection.jsx`
- Section heading + plain-language explanation of HMM regimes
- City selector (dropdown or tabs): Sydney | Melbourne | Brisbane | Perth | Gold Coast
- Embeds `RegimeTimeline` (D3 component)
- See `specs/hmm-regimes.md` for visualisation details

### `XGBoostSection.jsx`
- Section heading + plain-language explanation of feature importance (LightGBM)
- User-facing text references "LightGBM", not "XGBoost"
- City selector (shared or independent from HMM section)
- Embeds `FeatureImportanceChart` (D3 component)
- See `specs/xgboost-features.md` for visualisation details

### `Footer.jsx`
- Data sources with links (ABS, RBA)
- Methodology summary (link to GitHub README for detail)
- Author name + LinkedIn link

## D3 Integration Pattern
- Use `useRef` + `useEffect` for D3 bindings (D3 owns the SVG, React owns the container)
- D3 code in separate utility files under `src/d3/` (e.g., `src/d3/grangerGraph.js`)
- Responsive: use `ResizeObserver` or container width to redraw on resize

## Data Loading
- All JSON in `public/data/` (copied from `data/` at build time or symlinked)
- Fetch on mount in `App.jsx`, store in state
- Show a simple loading spinner until all 3 JSON files are loaded
- Handle fetch errors with a user-friendly message

## Styling Guidelines
- Clean, minimal aesthetic — white background, dark text
- Accent colour palette for the 5 cities (consistent across all charts):
  - Sydney: `#2563EB` (blue)
  - Melbourne: `#7C3AED` (purple)
  - Brisbane: `#B45309` (dark amber — WCAG AA compliant; original `#D97706` fails 4.5:1 contrast)
  - Perth: `#DC2626` (red)
  - Gold Coast: `#047857` (dark teal — WCAG AA compliant; original `#059669` fails 4.5:1 contrast)
- Typography: system font stack or Inter/DM Sans from Google Fonts
- Max content width: 900px, centred
- Generous whitespace between sections
- Mobile responsive: charts scale down, city selector stacks vertically

## Accessibility
- All charts include `aria-label` descriptions
- Colour choices pass WCAG AA contrast on white backgrounds
- Tooltips triggered on both hover and focus
- City selector is keyboard-navigable

## File Structure
```
src/
├── App.jsx
├── main.jsx
├── components/
│   ├── Header.jsx
│   ├── GrangerSection.jsx
│   ├── HMMSection.jsx
│   ├── XGBoostSection.jsx
│   └── Footer.jsx
├── d3/
│   ├── grangerGraph.js
│   ├── regimeTimeline.js
│   └── featureImportanceChart.js
├── styles/
│   └── (CSS files)
└── utils/
    └── dataLoader.js
public/
└── data/
    ├── prices.json
    ├── macro.json
    ├── granger.json
    ├── hmm.json
    └── xgboost.json
```
