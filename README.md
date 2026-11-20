# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/naplex666/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/naplex666/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Offline token launch radar with TVL-matched valuation ranges and category-specific trial plans.

## Run it

```sh
node main.ts --input /path/to/kit/input/snapshot.json --output ./out
```

Open `out/dashboard/index.html` in a browser. Node 22 with native TypeScript stripping enabled (22.18+) or later runs the build without dependencies. In the grader, the default paths are `/input/snapshot.json` and `/output`.

The launch board includes the sealed watchlist plus other snapshot protocols that record no token, subject to category and product-name exclusions. Use the token record filter to browse reported market caps separately. Rank follows the implied value in whole dollars, with slug order breaking ties.

The model multiplies TVL by a size-matched peer multiple, a bounded weekly growth factor and a tracking-age factor. It blends weighted medians of tokenized peers within the category and across categories. The detail view shows the factors and the peer interquartile range. That range measures peer dispersion rather than a statistical uncertainty interval. Trial plans use snapshot categories and chains, with budgets and exit checks to confirm against current product terms.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
