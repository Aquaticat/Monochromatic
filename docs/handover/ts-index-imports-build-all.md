# Handover: index-only /ts cross-package imports, and build every package

Live progress for the refactor described in the approved plan at
`/home/user/.claude/plans/make-all-imports-between-keen-piglet.md`. Read that plan first; this doc tracks what is
done, what is next, and the gotchas a fresh session needs.

Branch: `refactor/ts-index-imports-build-all` (created off `main`). Commit after each package; use explicit scoped
pathspecs (`cli-git` rejects `git add -A`/`.`). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
(the harness-specified form; an earlier "(1M context)" variant appears in older commits, harmless).

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

## Phase B2: DONE (5 of 7 packages; 2 deferred to Phase C)

Removed feature-named (and `<feature>/ts`) export entries, leaving `.`, `./ts`, `./ts/*` (where it existed). Verified by
the resolution sweep (still 0 in-scope non-`/ts` cross-package imports) + a repo-wide non-`.ts` reference grep (0
references in `packages/` to any removed entry; the only hits are `packages-paused/` (out of scope), `docs/`, READMEs,
and the throwaway tool) + a JSON-parse/keys check on each edited file. NOTE: `lint:types` is a WEAK B2 gate (a
package.json-only edit may not invalidate a consumer's tsbuildinfo, so green can be stale); the sweep + 0-consumer proof
is the real verification. It was green anyway.

Done (one commit each): `module-logger` (`./logger`, `./tagged`, `./types`); `pi-shared-model-selection` (all 5
per-feature dist entries `./core`/`./scope`/`./cost`/`./budget`/`./pi-coding-agent` AND their `/ts` twins — leaving
`.`+`./ts`; the per-feature dist BUNDLES are collapsed to a single index in Phase C); `cli-mvm` (10 feature entries);
`module-fs-path` (`./find-monorepo-root`, `./find-package-root`); `dev-script-inference-canary` (the temporary `./src/*`
passthrough).

DEFERRED to Phase C (structural, not simple dead-entry pruning):

- `cli-vmsync`: its `exports` is feature-ONLY (`./import`, `./boot`, `./sync`, ...), with NO `.`/`./ts`/`./ts/*`. It was
  never a Phase B target (0 cross-package consumers) and never got Phase A's `./ts`. Removing its only exports needs the
  Phase A `./ts` add + the Phase C bin-build treatment together. All its feature exports are confirmed unimported.
- `build-tool-css`: has explicit `./ts/fs-registry` + `./ts/process-shim` (a `/ts/<file>` form) and NO `./ts/*`
  wildcard. Both are confirmed unimported (Phase B collapsed the one `done-postcss` consumer to `/ts`). Normalize to the
  canonical `.`+`./ts`+`./ts/*` shape (replace the two explicit entries with a single `./ts/*`) during its Phase C build
  review. (The advisor's "build-tool-css needs no B2 change" assumed it resolved via an existing `./ts/*`; the file has
  no `./ts/*`, so the explicit entries are the thing to normalize, just not in B2.)

## Phase C: IN PROGRESS — convert source-only and bin packages to builds

Everything imports `/ts`, so flipping `.` from src to dist affects no in-repo consumer. Precedent: commit `7f4b5e0`
(`markdownlint-no-pipe-tables`, node-only). Neutral exemplar: `module-test`.

### PROVEN recipe per neutral source-only lib (validated on `module-async-time` + `module-const`)

1. Add `tsdown.browser.config.ts` (one line): `export { default, } from '@monochromatic-dev/config-tsdown/.ts';`
   (neutral). For node use `tsdown.node.config.ts` -> `'@monochromatic-dev/config-tsdown/.node.ts'`.
2. `mise.toml`: add `build`, `build:js`, `build:js:browser` (or `build:js:node`) + the three `watch:*` twins via
   `extends`, and a `buildAndTest` task. CAVEAT: the test-task wiring VARIES per package — some have
   `[tasks."test:unit"] extends = "test:unit"` (then `buildAndTest = "mise run build; mise run test:unit"`), others a
   custom `[tasks.test] run = "bun src/self.unit.test.ts"` (then `buildAndTest = "mise run build; mise run test"`).
   Read the existing mise.toml and preserve its test task; only ADD build + buildAndTest.
3. `package.json`: `"module"` -> `dist/final/neutral/index.mjs`; `exports["."]` -> `{ "types":
   "./dist/final/neutral/index.d.mts", "default": "./dist/final/neutral/index.mjs" }` (node: swap `neutral`->`node`);
   keep `./ts` + `./ts/*`; `files` -> add `"dist/final"` before `"src"`; add `"@monochromatic-dev/config-tsdown":
   "workspace:*"` as the first devDep.
4. Switch the package's own unit tests to import the BUILT dist instead of sibling source. PREFERRED form: switch the
   specifier to the package BY NAME (`@monochromatic-dev/<pkg>`), which resolves to `.` = dist after the flip. This is
   UNIFORM (one target string regardless of the test file's directory depth, so it works for nested-`src/` packages
   like `module-es` too, unlike a relative `../dist/...` path which the precedent used). KEY: tests that ALREADY import
   by name (e.g. `module-function-arity`'s) need NO edit at all -- they follow `.` automatically. Only relative source
   imports (`} from './foo.ts';`) need switching, to `} from '@monochromatic-dev/<pkg>';`. Leave test-aggregator
   imports (`import './foo.unit.test.ts'`), `module-test/ts`, and other-package `/ts` imports alone. The dist index
   must re-export every symbol the tests use; if not, `buildAndTest` fails loudly naming the symbol -> add the
   re-export to the index (finishing Phase A) OR keep that one test on source if it tests a genuine internal. If a
   single test file imports TWO+ own source modules, switching both to by-name creates a duplicate import -> merge them
   into one statement (same as Phase B's eslint/no-duplicate-imports merges).

   SCALING: packages with one test file per function (`module-or-throw` = 25, `module-toml-edit` = 18,
   `module-i18n-compose` = 9) make manual per-file switching expensive. For those, consider a small throwaway tool
   (`*.unit.test.ts` only: rewrite a relative import of an own non-test source module to `@monochromatic-dev/<pkg>`,
   merging duplicates) and let `buildAndTest` be the oracle. Tests already importing by name cost nothing.
5. `pnpm install` (links the new config-tsdown devDep; updates root `pnpm-lock.yaml`).
6. Gate: `mise run //packages/<path>:buildAndTest` (build emits `dist/final/neutral`, tests pass against it).
7. Commit: `git add <tsdown.config>` (untracked), then `git commit <package.json> <mise.toml> <tsdown.config>
   <switched test files> pnpm-lock.yaml -m "build(<pkg>): produce neutral dist"`.

### Findings (de-risk the fan-out)

- isolatedDeclarations: 0 new errors. `config-typescript` already runs a declaration-emitting types build under
  `lint:types`, so the source already satisfies it. The plan's "expect to add return types" caution is STALE.
- No build/test cycle stall: `module-test` is consumed via `/ts` source, so building a lib never needs module-test's
  dist and vice versa.
- `dist/` is gitignored; commits never include built artifacts (only `files: [dist/final, src]` for publish).
- GATE IS build + buildAndTest PER PACKAGE, not lint:types. Do NOT run repo-wide `lint:types` mid-batch: converted
  tests import `../dist/.../index.mjs` whose `.d.mts` only exists after a build, so lint:types FALSE-FAILS on any
  package edited-but-not-yet-built. Run repo-wide lint:types only as a FINAL check after all dist exist. (Same reason
  `git clean -dX` then lint:types breaks until rebuild: inherent to the precedent's pattern.)
- First-with-deps bundling CONFIRMED: the neutral config (`packages/config/tsdown/src/index.ts`) sets
  `deps: { alwaysBundle: ['@monochromatic-dev/**'] }`, so workspace deps are INLINED into the self-contained bundle
  (verified: `module-logger`/`numeric-format`/`toml-edit` dist `.mjs` have zero `@monochromatic-dev` imports). External
  npm deps (e.g. `toml-eslint-parser`) stay EXTERNAL (one bare import in the dist, resolved from the consumer's
  node_modules). Consequence: build order is irrelevant; a lib builds standalone regardless of whether its workspace
  deps are built yet.
- DEP CLASSIFICATION decides the bundle shape (tsdown defaults): `dependencies`/`peerDependencies` are
  EXTERNALIZED (bare import in dist, consumer installs); `devDependencies` are AUTO-BUNDLED inline (consumers never
  install devDeps). The config's `alwaysBundle`/`neverBundle` override this. So a runtime dep that must ship inlined
  belongs in devDeps OR `alwaysBundle`; a dep meant to stay external stays in `dependencies`. For each dep-heavy
  package, classify accordingly and VERIFY by grepping the built dist's `import ... from` lines (the method used for
  toml-edit/module-logger). Do NOT reclassify a package's existing deps without reason; respect its split + the config
  overrides.
- NODE config (`packages/config/tsdown/src/index.node.ts`): `platform: 'node'`, `outDir: dist/final/node`,
  `alwaysBundle: ['@monochromatic-dev/**', 'find-up', 'nano-spawn']` (find-up/nano-spawn force-bundled despite being
  `dependencies`), `neverBundle: ['@earendil-works/pi-coding-agent', 'typebox', '@earendil-works/pi-ai']` (pi runtime
  peer deps, provided at load time -- bundling them causes CJS/ESM "exports is not defined"). Relevant to pi-shared and
  any pi-* / CLI package consuming those peers.
- THE BY-NAME SMOKE-TEST LEVER (sharpens step 4): the dist's ONLY new risk vs source is re-export/bundle integrity;
  the source unit tests already cover the logic and bundling adds no code paths. So you do NOT need every public test
  routed through the dist -- you need the public surface exercised BY-NAME once (executes the bundle) PLUS the dts emit
  (which fails the build if any index re-export is missing, covering re-export completeness for free). Practical rule:
  if a package already has a by-name test (e.g. a `public-api.unit.test.ts`), it IS the smoke test -- flip with ZERO
  test edits. If not, switch ONE or TWO broad round-trip tests to by-name and leave the rest on source. Internal-symbol
  tests (symbols NOT in the index) CANNOT route through dist and MUST stay on source -- this is forced, not a choice.
- A THIRD throwaway tool exists: `mise.switch-tests-byname.ts` (repo root, UNTRACKED). `bun mise.switch-tests-byname.ts
  <pkgDir> <pkgName> [--dry]`. Switches a `*.unit.test.ts`'s relative own-source import to by-name, but ONLY for files
  with EXACTLY ONE own-source import (no-merge tier); files with 2+ are reported and SKIPPED for hand-merge (the
  `eslint/no-duplicate-imports` case). No regex (pure string scan), idempotent. Used for `module-or-throw` (25 files,
  all single-binding public). buildAndTest is the oracle for internal-symbol mistakes.

### Done (neutral unless noted; repo-wide lint:types not yet re-run as final — see Final verification)

- `module-async-time` (`test:unit` variant; tests switched to relative-to-dist) — `build(module-async-time): produce neutral dist (Phase C pilot)`.
- `module-const` (custom `test` aggregator variant; 5 tests switched to relative-to-dist) — `build(module-const): produce neutral dist`.
- `module-function-arity` (`test:unit`; test already by-name, NO test edit) — `build(module-function-arity): produce neutral dist`.
- `module-current-time-context` (`test:unit`; 1 test switched to by-name) — `build(module-current-time-context): produce neutral dist`.
- `module-numeric-format` (custom `test` aggregator; 3 leaf tests switched to by-name; FIRST built lib WITH workspace
  deps -- module-const + module-or-throw inlined) — `build(module-numeric-format): produce neutral dist`.
- `module-or-throw` (`test:unit`; 25 single-binding public tests switched to by-name via `mise.switch-tests-byname.ts`)
  — `build(module-or-throw): produce neutral dist`.
- `module-i18n-compose` (`test:unit`; `public-api.unit.test.ts` already by-name = the smoke test, ZERO test edits)
  — `build(module-i18n-compose): produce neutral dist`.
- `module-toml-edit` (`test:unit`; two clean all-public round-trips `canonical`+`toml-delete` hand-merged to by-name;
  toml-eslint-parser stays external; internal `tomlFloat`/`tomlInteger`/`encodeKey`/`isAttachedGap` tests stay on source)
  — `build(module-toml-edit): produce neutral dist`.
- `mcp-stdio` (NODE bundle — uses process.stdin/stdout; `private: true`; FIRST node build) — per user direction the
  index was EXPANDED to re-export the previously-internal `JSON_RPC_*` codes + `PROTOCOL_VERSION` + `readLines`, so all
  4 tests route through dist: json-rpc + line-reader via the tool, transport (3) + server (5) hand-merged; added the
  missing `test:unit` task — `build(mcp-stdio): produce node dist`.

(Note: async-time/const used relative-to-dist `../dist/final/neutral/index.mjs`; later conversions use the cleaner
by-name form. Both work; no need to retrofit the first two.)

### Remaining — bundle sets determined (deps + `node:` built-in scan)

NEUTRAL, no bin: ALL DONE except `claude-code-plugins-hook-types` (pure types, 0 tests, no module-test devDep). A build
would emit only a `.d.mts` with no runtime code -- there is no source-to-dist TRANSFORMATION, so it is analogous to the
exempt pure-data config-* packages, NOT a buildable lib. RECOMMENDATION: leave it source-only (`.` stays at
`./src/index.ts`); do not add a build. Confirm with the user if treating it as a build is desired, otherwise skip.

VERIFY-THEN-ROUTE: `mcp-stdio` — DONE (node bundle; see Done above). Confirmed it uses `process` stdin/stdout.

NEUTRAL but cross-runtime/OPFS: `module-fs-path` (uses a computed `node:path` dynamic import + happy-opfs; its tests
may need a non-node/DOM env). Do as its own mini-pilot.

BINS (different mechanics: `#!/usr/bin/env bun` shebang on the bin entry, a `bin` bundle in addition to/instead of the
lib bundle): `module-image-diff`, `module-token-count`, `cli-terminal-exec`, plus `cli-fy`, `cli-mvm`, `cli-rgffplay`,
`mcp-mvm`, `dev-script-task-util`, `dev-script-vm-builder`. (`claude-code-plugins-source` is exempt.) `cli-mvm`'s bin is
`src/cli.ts`; `dev-script-inference-canary`'s is `src/canary.ts`. Each bin needs its own mini-pilot.

NORMALIZE: `pi-shared-model-selection` -> node-only single-index: collapse the tsdown entry config to `src/index.ts`
only (emit `dist/final/node`), drop the separate scope/cost/budget/pi-coding-agent bundles. Its export map was already
pruned to `.`+`./ts` in B2, so only the build config + the `.` dist shape need finishing.

DEFERRED B2 (fold into their Phase C conversion): `cli-vmsync` (add `./ts`+`./ts/*` first, then bin build);
`build-tool-css` (consolidate `./ts/fs-registry`+`./ts/process-shim` to a single `./ts/*`; its `.` is already dist).

## Final verification

Repo-wide `mise run lint:types`, then `mise run build` and `mise run test` across `packages/`. Re-run the resolution
analysis for 0 dist-resolving cross-package imports.
