# Handover: index-only /ts cross-package imports, and build every package

Live progress for the refactor described in the approved plan at
`/home/user/.claude/plans/make-all-imports-between-keen-piglet.md`. Read that plan first; this doc tracks what is
done, what is next, and the gotchas a fresh session needs.

Branch: `refactor/ts-index-imports-build-all` (created off `main`). Commit after each package; use explicit scoped
pathspecs (`cli-git` rejects `git add -A`/`.`). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Goal and locked decisions

Make every non-exempt cross-package import in `packages/` resolve to TypeScript source via the package index only:
`@monochromatic-dev/<pkg>/ts`. Then build every package that has a source-to-dist transformation.

1. Import form: index only (`<pkg>/ts`). Anti-patterns to rewrite: bare (`<pkg>`), feature-named (`/tagged`,
   `/scope`), `<feature>/ts` (`/scope/ts`), and deep (`/ts/<file>.ts`). All collapse to `<pkg>/ts`.
2. Export maps: keep `./ts` and `./ts/*`; remove feature-named entries (Phase B2). Keep `.` (built dist).
3. Build shape: only `neutral` and `node` bundles, from a single `src/index.ts`. Per package pick neutral-only
   (exemplar `module-test`; `.` = `{types,default}` both neutral), node-only (exemplar `pi-shared-model-selection`,
   `module-matrix`, the `pi-*`; `.` = `{types,default}` both node), or both (exemplar `module-es`, `module-logger`;
   `.` = `{types: neutral, node, default: neutral}`). No per-feature bundles. Client bundles only for webapps,
   bin bundles only for CLIs.
4. Everything with a source-to-dist transformation must build a dist, even though the workspace consumes `/ts` source.
5. Tree scope: `packages/` only.
6. `config-oxlint` family: keep source-only.
7. CLI/app packages lacking a build task: add bundled-bin builds.
8. Shims (`shim-*`) and stubs (`stub-*`): leave hand-written `.cjs`/`.d.cts` as-is.
9. Executable-index packages (`cli-mvm`, `dev-script-inference-canary`): restructure to a library barrel `index.ts`
   plus a separate executable file (done in Phase A).

## Exemptions (NOT built, imports of them NOT rewritten)

Pure-data configs (`config-typescript`, `config-dprint`, `config-stylelint`, `config-cosign`, `config-tofu`,
`config-dotfiles`); `config-tsdown` (circular); `config-oxlint` family; `claude-code-plugins-source` (curated source
named subpaths consumed by sibling plugin bins); `test-fixture-*`; `shim-*`; `stub-*`. The codemod must skip these
targets. There are ~72 imports of these; they stay verbatim.

## Verification helpers

- Per-package type-check: `mise run //packages/<path>:lint:types`. Lint: `:lint:oxlint`.
- `mise.toml` is GENERATED from `mise.no-env.toml` by file-enforcer. Never edit `mise.toml` directly; edit
  `mise.no-env.toml` then run `mise run file-enforcer` to regenerate. (CLAUDE.md is likewise generated from AGENTS.md.)
- Resolution analysis (the measurement script used throughout): a Node script that walks `packages/**/*.ts`, resolves
  each `@monochromatic-dev/*` specifier against the target's `package.json` `exports`, classifies src/dist, and skips
  self-imports. Re-run it after Phase B to confirm 0 dist-resolving and 0 unresolved cross-package imports. The Phase A
  gate ("every non-exempt cross-package import target exposes ./ts") already PASSES.

## Phase A: DONE

Commits on the branch (newest last):

- `build(<pkg>): expose ./ts index source subpath` for 14 source-only libraries (added `./ts` + `./ts/*`):
  `module-or-throw`, `module-const`, `module-async-time`, `module-current-time-context`, `module-numeric-format`,
  `module-function-arity`, `module-i18n-compose`, `module-toml-edit`, `module-image-diff`, `module-token-count`,
  `module-fs-path` (also keeps its `./find-monorepo-root`/`./find-package-root` feature entries for now),
  `mcp-stdio`, `claude-code-plugins-hook-types`, `cli-terminal-exec` (its `.`/`./ts` point at `src/launch.ts`, the
  library entry; `index.ts` is its bin). `module-dom` already had `./ts` + `./ts/*` (no change needed).
- `refactor(pi-shared-model-selection): re-export all feature modules from index` (index now `export *` of core,
  scope, cost, budget, pi-coding-agent; overlapping types resolve to identical `types.ts` bindings).
- `refactor(cli-mvm): split library barrel from CLI executable` (`src/index.ts` -> barrel of the 10 command modules;
  executable moved to `src/cli.ts`; `bin` + package `mise run` repointed; added `.`/`./ts`/`./ts/*`; feature subpaths
  like `/clone` kept for Phase B2 removal).
- `refactor(dev-script-inference-canary): split library barrel from canary executable` (`src/index.ts` -> barrel of
  `linter-artifacts` + `runner-types`; executable moved to `src/canary.ts`; package + root `mise.no-env.toml` `canary`
  task repointed and `mise.toml` regenerated; added `.`/`./ts`/`./ts/*` PLUS a TEMPORARY `./src/*` passthrough so the
  viewer's existing deep `/src/*.ts` imports keep resolving until Phase B2).

Recommended confirmation before Phase B: a repo-wide `mise run lint:types` (per-package checks passed for every
touched package and the inference-canary-viewer consumer; additive exports cannot change existing type-checking).

## Phase B: NEXT — codemod + rewrite imports to `/ts`

Write `mise.rewrite-ts-imports.ts` (Bun, top-level await, AST-based via TS compiler API or `ts-morph`; NOT regex).
Rule per specifier starting `@monochromatic-dev/`:

- Skip self-imports (file's owner package == target) and exempt-target imports (see Exemptions).
- Leave `@monochromatic-dev/<pkg>/ts` unchanged.
- Else collapse `@monochromatic-dev/<pkg>[/anything]` -> `@monochromatic-dev/<pkg>/ts` (covers bare, feature,
  `<feature>/ts`, deep `/ts/<file>.ts`, and inference-canary's `/src/<file>.ts`). Named bindings stay; they resolve
  from the index barrel. Idempotent.

Measured scope (self-imports excluded, exempt excluded): ~598 specifiers change (451 bare, 142 feature-named, 5 deep
`.ts`); 150 already `/ts`; 72 exempt stay. Note module-logger's index re-exports tagged/logger/types and module-fs-path's
re-exports the find-monorepo-root symbols, so collapsing their feature imports to `/ts` resolves.

Order (keep tree green; commit per target package, explicit pathspecs):

1. Commit the codemod tool alone.
2. Risk tier first (resolution flips dist->src, new type-check surface): bare imports of already-built packages.
   `module-test` dominates (~334 files; its tsconfig pulls `@types/chai`/`sinon`). Run codemod scoped to `module-test`,
   then repo-wide `mise run lint:types`. Then fan out: `module-es`, `module-kv-store`, `module-async-iter`,
   `figma-kiwi`, `module-matrix`, `module-zip-writer`, `module-memoize`, `module-observable`, and the feature-named
   targets (`module-logger`, `pi-shared-model-selection`, `module-fs-path`, `cli-mvm`, `dev-script-inference-canary`).
3. Safe tier (src->src no-op): bare/feature imports of the Phase A source-only libs.

Verify repo-wide `lint:types` after each tier; then re-run the resolution analysis (expect 0 dist, 0 unresolved).

## Phase B2: remove feature-named export entries

After no consumer imports them, delete feature-named (and `<feature>/ts`) entries from each non-exempt package's
`exports`, leaving `.`, `./ts`, `./ts/*`. Examples: `module-logger` (drop `./logger`, `./tagged`, `./types`);
`module-fs-path` (drop `./find-monorepo-root`, `./find-package-root`); `pi-shared-model-selection` (drop `./core`,
`./scope`, `./cost`, `./budget`, `./pi-coding-agent` and their `/ts` twins); `cli-mvm` (drop `./list`, `./create`, ...);
`dev-script-inference-canary` (drop the TEMPORARY `./src/*` passthrough). Commit per package; verify `lint:types`.

## Phase C: convert source-only and bin packages to builds (LAST)

By now everything imports `/ts`, so flipping `.` from src to dist affects no in-repo consumer. Standard pattern
(precedent: commit `7f4b5e0`, `markdownlint-no-pipe-tables`): add tsdown config(s) for the package's bundle set
(`tsdown.browser.config.ts` -> `config-tsdown/.ts` for neutral; `tsdown.node.config.ts` -> `.node.ts` for node),
add matching `mise.toml` build tasks via `extends`, flip `exports["."]` to the dist shape mirroring the bundles, keep
`./ts` + `./ts/*`, set `"module"`, add `dist/final` to `files`, add `config-tsdown` + `config-typescript` (+ `module-test`)
devDeps.

- Library conversions (the 14 Phase A libs): determine each one's bundle set by runtime (node deps -> node; isomorphic
  -> neutral; both where needed).
- Bin builds (have `bin`, no build task): `cli-fy`, `cli-mvm`, `cli-rgffplay`, `cli-terminal-exec`, `mcp-mvm`,
  `dev-script-task-util`, `dev-script-vm-builder`, plus `module-image-diff`, `module-token-count`. (`claude-code-plugins-source`
  is exempt.) Note `cli-mvm` now has `src/cli.ts` as the bin and `dev-script-inference-canary` has `src/canary.ts`.
- Normalize `pi-shared-model-selection` to node-only single-index: collapse its tsdown entry config to `src/index.ts`
  only (emit `dist/final/node`), drop the separate scope/cost/budget/pi-coding-agent bundles.
- Pilot a foundational lib first (`module-fs-path` or `module-async-time`); verify the cycle (lib -> devDep
  `module-test` -> dep lib) does not deadlock build/test ordering before fanning out.
- Per-package exit: `mise run //packages/<path>:build` emits the chosen bundle(s); `:buildAndTest` passes (converted
  packages' tests import the built dist, so test import targets may need switching). `isolatedDeclarations: true` is
  newly exercised; expect to add explicit return types on some exported functions. Commit per package.

## Final verification

Repo-wide `mise run lint:types`, then `mise run build` and `mise run test` across `packages/`. Re-run the resolution
analysis for 0 dist-resolving cross-package imports.
