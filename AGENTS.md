# Operational Notes

## Dev Server
```bash
npm install
npm run dev
```

## Python Pipeline
```bash
cd python
sudo apt-get install python3-pip   # if pip3 not available
pip3 install -r requirements.txt
python3 data_pipeline.py    # generates data/prices.json + data/macro.json
python3 granger.py          # generates data/granger.json
python3 hmm_regimes.py      # generates data/hmm.json
python3 xgboost_model.py    # generates data/xgboost.json
```
Run scripts in order — each depends on output from prior steps.

Use `python3` (not `python`). `pip` is not available by default — use `pip3`.

## Python Gotchas
- **pip3 on Python 3.12**: This system uses an externally-managed environment — run `pip3 install --break-system-packages -r requirements.txt`.
- **hmmlearn 0.3.3**: `GaussianHMM` has no `n_init` param — use a manual loop to run multiple initializations and keep the best result.
- **JSON serialization**: numpy bools are not JSON serializable — wrap in `bool()` before `json.dump`.

## Build
```bash
npm run build    # prebuild copies data/ to public/data/, then vite builds to dist/
npm run preview  # preview the built site
```

Prebuild copies JSON files with `mkdir -p public/data && cp data/*.json public/data/`. Do NOT use `cp -r data/ public/data/` — it nests the directory instead of flattening the files.

## Tests
```bash
npm test                            # frontend tests (vitest)
python3 python/test_pipeline.py     # data pipeline validation
npm run test:watch                  # frontend watch mode
```
