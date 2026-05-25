# webapp-forge-seed

Synthetic-data generator for the webapp-forge stack.

Mulberry32 RNG produces deterministic, reproducible users, repositories,
labels, issues, and comments at sizes that match the long-tail distribution
of real GitHub data: P50 ~10 issues per repo, P95 ~200, P99 ~5K, tail ~50K.

Used both as a CLI (`mise run seed:demo`) and as a library by `webapp-forge-stress`.
