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

## Phase B: DONE — every non-exempt cross-package import resolves to `/ts`

Approach decided WITH the user: NOT a heavy AST codemod. A minimal literal-replace tool did the specifier swap; the
duplicate-import merges (36 sites across 4 targets) were hand-merged. Final resolution sweep: 0 cross-package imports
resolve to non-`/ts`. The only remaining bare `@monochromatic-dev/*` specifiers are SELF-imports (a package importing
itself by name, plan-excluded; includes the intentional "tests import the built dist" pattern) and TSDoc/README
`@example` comments (deferred, see "Doc examples" below).

### The tools (repo root, UNTRACKED, throwaway)

`mise.rewrite-ts-imports.ts` — run per target: `bun mise.rewrite-ts-imports.ts <target-unscoped> [--dry]`. Prints the
changed-file list to stdout, a summary to stderr. Walks `packages/**/*.{ts,tsx,mts}` (skips `dist`, `node_modules`),
skips files OWNED by the target (self-imports), rewrites `@monochromatic-dev/<target>[/sub]` to `.../ts` ONLY in
import/export context (a `from`/`import`/`import(` with a word-boundary before it). Critical safety guard: never
touches bare string-literal package names (verified skips: `config/oxlint/.../allow-pkg.ts`,
`pi/auto-mode/.../git-worktree-read-allowlist.ts`). Boundary-safe, idempotent.

`mise.detect-merge-sites.ts` — run per target: reports files that would have DUPLICATE import statements after collapse
(condition: `valueCount + typeCount > 1` for the target's `/ts`; see the rule finding below). Used as the merge oracle
(detector -> 0 after merging), cross-checked against real scoped oxlint.

Both decide-on-keep-or-delete at the very end (after Phase C).

### Staging: paths contain SPACES (module/es dir names like `t object/...`)

`git add $(cat list)` / `$(cat list)` WORD-SPLITS and breaks. Use `git commit --pathspec-from-file=<list> -m ...`
(one path per line, spaces preserved; cli-git accepts it as explicit pathspecs). For module-logger the full set was
captured with `git diff --name-only` (tool's 38 + 26 hand-merges + the cli-git pilot = 65 files; untracked scratch
tools excluded automatically).

### The `/dom` prerequisite (NO new switches were needed during Phase B)

Importing a built package's `/ts` drags its dependency SOURCE into the consumer's type-check; `module-logger`'s
`src/sinks/opfs.ts` uses DOM APIs (`FileSystemWritableFileStream`, `navigator.storage`), so base-config consumers
without the DOM lib fail TS2304/TS2339. Fix (docs/troubleshooting/typescript.md §"All packages must extend
config-typescript/dom"): switch the consumer tsconfig to `config-typescript/dom`. The 9 base-extenders importing
module-test were switched in Phase A's prep (commit d4536cf8). NO further switches were needed: every built-package
flip (module-kv-store, figma-kiwi, ..., module-logger itself) kept repo-wide `lint:types` GREEN, because the remaining
module-logger consumers were already on `/dom`. (If a future flip DOES break, the lint:types error cites `opfs.ts`; the
reported consumer package varies run-to-run due to tsgo `--build` incremental caching, but the fix is always "switch
that consumer to /dom" and commit it with the target.)

### The duplicate-import rule — EMPIRICAL findings (correct the earlier guess)

The active rule is `eslint/no-duplicate-imports`, NOT `import/no-duplicates`, and the earlier "separate value/type is
fine under prefer-inline:false" note was WRONG. Validated by running scoped `mise run //packages/cli/git:lint:oxlint`
on a hand-merged pilot file:

- A separate `import type { X } from '.../ts'` alongside a value `import { ... } from '.../ts'` (same specifier) IS a
  duplicate. The fix is ONE merged statement with type bindings folded inline as `type X` specifiers
  (e.g. `import { initPromise, logger, tagged, type Logger } from '@monochromatic-dev/module-logger/ts';`). This is
  valid under `verbatimModuleSyntax: true`. Aliases preserved as `type Logger as ModuleLogger`, `logger as defaultLogger`.
- Therefore a file with `value=1 type=1` (one value import + one type import collapsing to the same `/ts`) IS a merge
  site. The detector condition is `value + type > 1`.
- `includeExports` is effectively false: an `export ... from '.../ts'` re-export does NOT conflict with an `import`
  from the same specifier (validated: `inference-canary-viewer/src/data/viewer-types.ts` has both, oxlint clean).
- dprint `importDeclaration.forceMultiLine: "whenMultiple"` (packages/config/dprint/index.json): a multi-specifier
  import MUST be multi-line, one binding per line. Single-binding imports stay inline. Merged blocks follow this; `mise
  run lint:dprint` confirmed none of the merged files were flagged.

PRE-EXISTING oxlint debt is IGNORED (user instruction); the gate is repo-wide `lint:types` GREEN. The only oxlint
constraint observed is "do not ADD a `no-duplicate-imports` violation", handled by the merges above.

### Progress — ALL targets committed (newest last)

Pilot + prep (prior session): `06b6afca` favicon dynamic->static; `d4536cf8` 9 tsconfigs to /dom; `35459241`
module-test (307 files).

This session, in dependency-risk order (each its own commit, repo-wide lint:types GREEN after each):
- Wave 1, pure src->src no-op source libs (no merge): `module-or-throw`, `module-const`, `module-async-time`,
  `module-current-time-context`, `module-numeric-format`, `module-toml-edit`, `mcp-stdio`,
  `claude-code-plugins-hook-types` (note: package NAME is `@monochromatic-dev/claude-code-plugins-hook-types`),
  `cli-terminal-exec`.
- Wave 2, bare imports of built packages (dist->src flip, no merge): `module-kv-store`, `module-async-iter`,
  `module-matrix`, `module-zip-writer`, `module-memoize`, `figma-kiwi`.
- Wave 3, feature/deep/merge targets: `module-fs-path` (`/find-monorepo-root`), `dev-script-inference-canary`
  (deep `/src/*.ts`), `build-tool-css` (`/ts/process-shim`; the redundant process-shim side-effect import was dropped,
  since importing applyMixins from the index runs the shim transitively), `cli-mvm` (8 features, 3 merges),
  `pi-shared-model-selection` (5 features, 6 merges), `module-logger` (108 specifiers / 65 files / 26 merges; commit
  `e671ac97`).

Targets with 0 cross-package specifiers (nothing to do): `module-es`, `module-observable`, `module-function-arity`,
`module-i18n-compose`, `module-image-diff`, `module-token-count`, `module-hyperscript`. (Their only bare specifiers are
self-imports.)

### Doc examples — DEFERRED (not code imports; out of the rewrite scope, fix in a docs pass)

TSDoc/README `@example` blocks still show old import forms. Known: `module/or-throw/README.md` (bare),
`module/logger/src/tagged.ts:17` (`/tagged`, escaped `\@`), `claude-code-plugins/hook-types/src/index.ts:11`
(`@monochromatic-dev/claude-code-hook-types` — ALSO a WRONG package name, missing `plugins`). These do not affect
lint:types or oxlint. Update them when convenient (the `/tagged` one becomes unimportable after Phase B2).

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
