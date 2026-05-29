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

## Phase B: IN PROGRESS — rewrite imports to `/ts`

Approach decided WITH the user: NOT a heavy AST codemod. The user steered to a minimal literal-replace tool
("automation would slow you down"); the rewrite is exact-string replacement, the only tricky part (duplicate-import
merges) is bounded to 36 sites and hand-merged.

### The tool: `mise.rewrite-ts-imports.ts` (repo root, UNTRACKED, throwaway)

Run per target: `bun mise.rewrite-ts-imports.ts <target-unscoped> [--dry]`. Prints the changed-file list to stdout
(redirect to a file for staging), a summary to stderr. Logic:

- Walks `packages/**/*.{ts,tsx,mts}` (skips `dist`, `node_modules`).
- Skips files OWNED by the target (self-imports).
- Rewrites a `@monochromatic-dev/<target>[/sub]` specifier to `@monochromatic-dev/<target>/ts` ONLY in import/export
  context: a `from`/`import`/`import(` with a word-boundary before it. This is the critical safety guard: it must NOT
  touch bare string-literal package names. Verified hazards it correctly skips: `config/oxlint/.../allow-pkg.ts`
  (`package: "@monochromatic-dev/module-logger/types"`), `pi/auto-mode/.../git-worktree-read-allowlist.ts`
  (`const CLI_GIT_PACKAGE_NAME = '@monochromatic-dev/cli-git'`). Boundary-safe (`module-test` won't match
  `module-testing`). Idempotent (leaves `/ts` alone). Decide on committing or deleting the tool at the very end.

### Staging: paths contain SPACES (module/es dir names like `t object/...`)

`git add $(cat list)` / `$(cat list)` WORD-SPLITS and breaks. Use `git commit --pathspec-from-file=<list> -m ...`
(one path per line, spaces preserved; cli-git accepts it as explicit pathspecs). Confirm `git diff --cached` empty first.

### The `/dom` prerequisite (DONE for module-test consumers; MORE needed for later built targets)

Importing a built package's `/ts` (source) drags its dependency SOURCE into the consumer's type-check. `module-logger`'s
`src/sinks/opfs.ts` uses DOM APIs (`FileSystemWritableFileStream`, `navigator.storage`); base-config consumers lack the
DOM lib and fail TS2304/TS2339. Canonical fix (docs/troubleshooting/typescript.md §"All packages must extend
config-typescript/dom"): switch the consumer tsconfig from base to `config-typescript/dom` (purely lib-additive).
Committed for the 9 base-extenders that import module-test. The 8 remaining base-extenders are `shim-*`/`stub-*`/
`test-fixture-*` (left on base: they don't import module-test, and adding DOM lib to a polyfill shim risks global
redeclaration collisions e.g. `DOMException`) and `inference-canary/tsconfig.canary-lint.json` (auxiliary, generated
code, not in the lint:types gate). EXPECT to switch more base-extenders as `module-logger`/`module-es` get rewritten;
the repo-wide lint:types gate catches each one (error cites `opfs.ts`; the REPORTED consumer package varies run-to-run
due to tsgo `--build` incremental caching, but the fix is always "switch that consumer to /dom").

### oxlint policy (user instruction)

PRE-EXISTING oxlint debt exists and is to be IGNORED (e.g. `module/es` has ~27 errors/168 warnings: regex `u`-flag,
nullish-union, in SOURCE files untouched by this work). The gate is repo-wide `lint:types` GREEN, not lint:oxlint.
BUT do not ADD new oxlint errors: the duplicate-import rule IS enabled, so collapsed feature imports that land two
`/ts` statements in one file MUST be hand-merged (value bindings into one `import { ... }`, type bindings into one
`import type { ... }`; separate value/type statements are fine under `no-duplicates` default `prefer-inline:false`).

### 36 merge sites (must hand-merge after the target's literal replace)

Files importing 2+ distinct feature-subpaths of the SAME package. By target: `module-logger` (most; the `log.ts`
boilerplate `/logger`+`/tagged`+`/types`, plus `/logger`+`/tagged` and `/tagged`+`/types` variants; ALSO `favicon.ts`
now has `/logger`+`/tagged`), `pi-shared-model-selection` (in `pi/advisor`, `pi/auto-mode`), `cli-mvm` (3 files in
`mcp/mvm`), `build-tool-css` (1 file in `done-postcss`: `/ts/process-shim`+`/ts`). Confirm each merge target's index
re-exports the needed bindings (module-logger does: logger/initPromise/tagged/sinks/types).

### Progress

DONE (committed, newest last): `refactor(webapp-content-ssg-test): use static logger import in favicon` (06b6afca,
dynamic import()->static, per user); `build(*): extend config-typescript/dom in raw-ts module-test consumers`
(d4536cf8, 9 tsconfigs); `refactor(module-test): import via /ts index` (35459241, 307 single-specifier rewrites, no
merge sites). Repo-wide lint:types GREEN after these.

NEXT — remaining targets (enumerate precisely by dry-running the tool for each non-exempt package; the list below is
the expected set):

1. Built-package bare targets: `module-es`, `module-kv-store`, `module-async-iter`, `figma-kiwi`, `module-matrix`,
   `module-zip-writer`, `module-memoize`, `module-observable`. (`module-hyperscript` is mostly already `/ts`.)
2. Feature-named / merge-site targets: `module-logger`, `pi-shared-model-selection`, `module-fs-path`, `cli-mvm`,
   `dev-script-inference-canary` (its viewer's 5 deep `/src/*.ts`), `build-tool-css`.
3. Safe source-only libs (src->src no-op): `module-const`, `module-or-throw`, `module-async-time`,
   `module-current-time-context`, `module-numeric-format`, `module-function-arity`, `module-i18n-compose`,
   `module-toml-edit`, `module-image-diff`, `module-token-count`, `mcp-stdio`, `claude-code-plugins-hook-types`,
   `cli-terminal-exec`.

Per-target loop: `bun mise.rewrite-ts-imports.ts <t> > /tmp/agent_<t>.out` -> hand-merge if merge site -> repo-wide
`mise '//packages/...:lint:types'` GREEN (switch any newly-breaking base consumer to /dom, commit that with the
target) -> `git commit --pathspec-from-file=/tmp/agent_<t>.out -m "refactor(<t>): import via /ts index"`. Ignore
pre-existing oxlint. After all targets, re-run the resolution analysis (expect 0 dist-resolving, 0 unresolved).

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
