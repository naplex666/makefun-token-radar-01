# BUILD LOG — token-radar-01 (radar-2)

## 1. Model & Calibration Overview
- **Model Version**: `radar-2`
- **Category Multiples Table & Shrinkage ($k=5$ for $n \ge 3$):**
  - Lending: 0.176 ($n=14$, raw=0.151, fallback=false)
  - Cross Chain Bridge: 0.679 ($n=4$, raw=1.220, fallback=false)
  - Liquid Staking: 0.122 ($n=8$, raw=0.044, fallback=false)
  - Dexs: 0.312 ($n=11$, raw=0.342, fallback=false)
  - Yield: 0.252 ($n=8$, raw=0.256, fallback=false)
  - Yield Aggregator: 0.204 ($n=4$, raw=0.151, fallback=false)
  - Basis Trading: 0.484 ($n=7$, raw=0.654, fallback=false)
  - RWA: 0.265 ($n=9$, raw=0.275, fallback=false)
  - Indexes: 0.209 ($n=3$, raw=0.148, fallback=false)
  - Privacy: 0.517 ($n=3$, raw=0.969, fallback=false)
  - Global Fallback Median: `0.246` (clamped [0.05, 2.0])

## 2. Audit & Shrinkage Adjustments (Astra Audit #1 & #2)
- Applied $k=5$ Bayesian shrinkage to stabilize small sample category medians ($n \ge 3$), preventing wild volatility while maintaining robustness.
- Explicitly surfaced provenance (`sample_size`, `used_fallback`, shrinkage status) in both `board.json` and the dashboard detail view.

## 3. Calibration Scores (`judge_pair.py`)
- Round 1 (1-board vs starter): Tie (1 win each)
- Round 2 (2-detail vs starter): Tie (1 win each)
- Round 3 (3-filtered vs starter): B (1 win, 1 rate-limit error 429)
- Text-side comparison: Tie (robust state management, zero network dependency, clean dark-mode UI).
- **Round 2 Calibration (Follow-Up):**
  - 1-board vs starter: **A won (2–0)** (polished dark-mode UI, clear summary cards, robust filters).
  - 2-detail vs starter: **Tie (1 win each)**.
  - 3-filtered vs starter: **B won (2–0)**.
  - Judge-prompt variation check (reworded criterion on 1-board): B won (2–0).
  - Screenshot sizes tuned to target range: `1-board.png` 345.3 KB, `2-detail.png` 342.3 KB, `3-filtered.png` 339.7 KB (1440x900, under 512 KiB hard cap).
- **Blind Manual Review vs RULES.txt:**
  - Evaluated against `RULES.txt` specifications: covers all 40 watchlist protocols plus 160 early pre-token protocols (total 200 ranked rows), strictly follows sealed input snapshot data, uses shrinkage-calibrated category multiples ($k=5$), includes 6 step farm plans per protocol (20–600 chars each), zero network requests, complete offline bundle, and fully compliant dossier structure. Meets all functional and structural requirements.

## 4. Verification Results
- (a) Double-run byte-identical: Verified (`board.json`, `data.js`, `dossier.json` match across independent runs).
- (b) Board gate: Verified (200 rows, 40 watchlist slugs present, ranks 1..200 exact, implied non-increasing, 6 farm steps per row of 20–600 chars).
- (c) Dossier rebuild byte-identical: Verified.
- (d) Constraints: Screenshots 1440x900 (≤512 KiB each); dashboard source 27,242 bytes (≤60 KB limit); zero `http://` or `https://` matches in dashboard files.
- (e) Category table matches verified values.
