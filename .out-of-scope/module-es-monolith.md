# module/es as the canonical utility-library home

This project is **not** going to keep growing `packages/module/es` as the single
catch-all home for utility helpers. The plan is to split it into many smaller,
focused packages and then delete `packages/module/es/` entirely.

## Why this is out of scope

`module/es` started as an ambitious "comprehensive functional programming utility
library" and accumulated a deeply nested `src/types/...` taxonomy. The accumulated
costs:

- Consumers import a huge barrel even when they only need one helper. Tree-shaking
  helps but doesn't eliminate the cognitive load of "what's in here?"
- The deep taxonomy makes the package navigationally opaque; `AUDIT.fallow-tools.md`
  already disables `unused-*` rules for the type-system subtree because the
  structure is the point, not the contents.
- Adding a new helper means picking a path through the taxonomy, which biases
  toward "just put it at the top" or "match the deepest existing path."
- Future migrations (e.g. shipping a focused helper as a standalone package) get
  harder the bigger the monolith gets.

Smaller packages (`module/time`, `module/bytes`, `module/web`, `module/cli`,
`module/rng`, etc.) have the opposite shape: each is browseable, each can be
audited or replaced independently, and consumers can import only what they need
without scanning a barrel.

## What we do instead

- **For new helpers**: file proposals against the smaller package they belong in,
  not against `module/es`. The per-helper issues already filed (covered by tracking
  issue `#185`) will be retargeted as part of the split.
- **For existing code in `module/es`**: migrate package-by-package per
  [PLANNING.extract-refactor-guardrail.md](../PLANNING.extract-refactor-guardrail.md):
  land the new package as a verified additive change, migrate consumers, then
  delete the `module/es` symbol.
- **For consumers**: import from the smallest specific package, never from
  `module/es` for new code.

## Tracking

- `#185`: top-level plan and progress.
- The 17+ filed issues targeting `module/es` in their agent briefs are not yet
  retargeted; that retargeting happens as the split decisions land in `#185`.

## Re-evaluation

If the per-package overhead (lockfile entries, `package.json` boilerplate, version
churn across many packages) ever exceeds the navigability benefit, the policy may
revisit. Today the trade-off favors smaller packages.
