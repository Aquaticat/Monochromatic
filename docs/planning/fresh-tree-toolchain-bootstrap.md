# Planning: fresh-tree toolchain bootstrap (issue #243)

Status: design agreed in conversation, not yet implemented. Revised after an external review and a pnpm bin-linking
test that invalidated the first design's selection mechanism. This doc captures the plan so a future session can build
and verify it.

Resolves issue #243: a fresh `git worktree add` (or clone) does not yield a working lint/types/build toolchain after
the documented bootstrap, which is `mise trust --all && mise run prepareAndBuild` (README.md).

## What the issue reported

On a fresh tree, `pnpm install` succeeded and `bun`-based `test:unit` worked, but the rest did not:

1. `:lint:types` failed with `Command 'task-tsgo' not found`, `:lint:oxlint` likewise lacked `task-oxlint`.
2. Plain `oxlint` could not load `oxlint.config.ts` because it imports the built `@monochromatic-dev/config-oxlint`
   (`dist/final/node/index.mjs`), absent until the config packages build.
3. `mise run build` aborted at `//packages/dev-script/inference-canary-*:build`.
4. Zero packages had `dist/final/node`, so anything importing a built workspace package failed until a full build.

## What is already resolved

Symptom 3 is gone. The `dev-script/inference-canary` and `inference-canary-viewer` packages now live under
`packages-paused/`, which is not in `config_roots` (`mise.no-env.toml`: `config_roots = ["packages/*/*",
"packages-deprecated/*/*"]`). They no longer participate in `mise run build`.

## Root cause

Two bootstrap cycles remain. Both are layering problems, not the inference-canary failure.

### Problem A: workspace bins are unbuilt on a fresh tree

`packages/dev-script/task-util` declares its `task-*` bins pointing at `dist/final/node/*.mjs`, and
`packages/build-tool/css` declares `build-css` pointing at `dist/final/node/cli.mjs`. On a fresh tree those dist
files are unbuilt, and pnpm does not create a `.bin` shim when the target file is absent at install time, so the
command is missing. This breaks, at minimum:

- `lint:types` (`task-tsgo`), `lint:oxlint` and `format:oxlint` (`task-oxlint`), via the shared task templates.
- `prepare:pnpm:install` (`task-pnpm`) and `prepare:playwright` (`task-depends`), so the documented
  `mise run prepareAndBuild` dies inside `prepare` before anything builds.
- `build:css` in two active packages, `webapp-productivity/done-postcss` and `webapp-content/messages-demo`
  (`build-css`), so the full `mise run build` also fails.
- Five packages that hardcode `task-oxlint` in their own `mise.toml` instead of extending the template:
  `oxlint-plugins/stylistic`, `webapp-productivity/doodle-widget`, `pi/morph-compact`, `figma-parsers/penpot`,
  `cli/git-clone-size`.

### Problem B: oxlint needs the built config-oxlint, deliberately

The repo-root `oxlint.config.ts` imports the built `@monochromatic-dev/config-oxlint` (`package.json` default export
is `dist/final/node/index.mjs`) on purpose: loading the prebuilt config is 20% to 40% faster than evaluating `/ts`
source on every lint run. `task-oxlint` (its wrapper at `packages/dev-script/task-util/src/oxlint-wrapper.ts` spawns
plain `oxlint`) therefore cannot lint on a fresh tree until that config dist exists. The 20% to 40% speedup must be
preserved, so the answer is to produce that dist on a fresh tree, not to switch the root config to source.

The handover doc `docs/handover/ts-index-imports-build-all.md` previously marked the `config-oxlint` family
"source-only"; that was outdated and has been corrected (it builds a dist, consumed built at the root for speed, and
is exempt only from the import-rewrite-to-`/ts` rule).

## Verified constraints and findings

- Preserve normal-case speed. The prebuilt bundle must stay the hot path. A plain repoint of bins to `src/*.ts` would
  make every `task-tsgo`/`task-oxlint` run pay per-invocation type-stripping plus multi-file source resolution.
- Migrating away from bun. The runtime for any source execution is Node, not bun.
- Node runs TypeScript natively. Measured: Node v26.3.0, `process.features.typescript === 'strip'`. The repo enforces
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, and `allowImportingTsExtensions`
  (`packages/config/typescript/tsconfig.options.json`), so src files are strip-safe; `node .../src/append.ts --help`
  runs directly, exit 0.
- nushell is the task shell (`mise.no-env.toml`: `unix_default_inline_shell_args = "nu -c"`), guaranteed available,
  so selection logic can live in nushell.
- pnpm does not relink a late-appearing bin. Tested in a throwaway workspace under pnpm 11.5.2: a bin whose target is
  absent at first `pnpm install` is not linked; creating the target and reinstalling with node_modules intact still
  does not create the shim; only deleting and recreating node_modules links it. So any design that links `-ts` bins on
  a fresh install and then expects the built `task-*` shim to appear after a build is broken.

## Design: invoke the file directly, never the shim name

The selection gate checks the built file and runs the actual file under Node, rather than calling a `.bin` shim that
pnpm may never have linked. This removes the dependence on pnpm bin-linking from the entire bootstrap-critical path.

Per invocation site, in nushell, prefer the built bundle and fall back to source:

```nu
# example: lint:types
let root = ($env.MISE_MONOREPO_ROOT? | default (pwd))
let built = ([$root packages dev-script task-util dist final node tsgo-filter.mjs] | path join)
let src = ([$root packages dev-script task-util src tsgo-filter.ts] | path join)
if ($built | path exists) { node $built --build } else { node $src --build }
```

- Built tree: runs the bundled `.mjs` under Node. No type-stripping, no multi-file resolution, no shim lookup. Speed
  is preserved (`node` ignores the file's shebang when the path is passed explicitly, so the shebang is irrelevant
  here).
- Fresh tree, after install: runs the `.ts` under Node strip-types. Works because node_modules exists, so the bin's
  own dependencies resolve.
- Dist-exists-but-shim-missing regime (the pnpm finding above): irrelevant, because nothing calls the shim.

The same built-or-src dispatch applies to `build-css` (target `packages/build-tool/css/dist/final/node/cli.mjs`,
source `src/cli.ts`).

This logic repeats across many sites, so factor it once rather than copy it. Use an inline Nushell command
definition from root mise vars. It resolves `dist/final/node/<entry>.mjs` under the requested workspace package when
present, otherwise `src/<entry>.ts`, then invokes the selected file with `node`. Do not add a `launch.ts` file and do
not duplicate the built/source branch across every `mise.toml`.

## Bootstrap ordering and the install step

- `prepare:pnpm:install` must run raw `pnpm install`, not `task-pnpm install`. On a fresh tree there is no
  node_modules, so neither a shim nor `node .../src/pnpm-filter.ts` (which imports node_modules deps) can run. Raw
  `pnpm` is a mise-managed tool and is the only thing that works from zero. `fix:reinstall` already needs the same
  treatment (it `rm -rf`s node_modules first).
- `prepare` fans out its children in parallel (`mise.no-env.toml` `vars.fanout`, which joins children with `:::`).
  So `prepare:playwright` (which runs `task-depends`) can start before `prepare:pnpm` has installed anything.
  Serialize `prepare` so `prepare:pnpm` completes first, then fan out the remaining `prepare:*` children.
- After install completes, `mise run build` produces every dist, including `task-util`'s bins and `config-oxlint`'s
  config; the direct-`node` dispatch then routes to the fast built path. `build:css` works during the parallel build
  fanout because its dispatch falls back to `node .../build-tool/css/src/cli.ts` when the dist is not yet emitted.

## The oxlint config contract (Problem B)

Pick the self-healing contract so the issue's symptom actually closes. Add a guard to the `lint:oxlint` and
`format:oxlint` sites: if `packages/config/oxlint/dist/final/node/index.mjs` is missing, build it first via
`mise run //packages/config/oxlint:build:js:node` (raw tsdown, no task bins), then run oxlint. This only fires on a
fresh tree; on a built tree it is a single `path exists` no-op, so the hot path is unaffected. This is the
"rebuild only when missing" shape, not the rejected "couple every lint run to a build" shape from issue #231.

`lint:types` needs no such guard: `tsgo` type-checks against `/ts` source, not built dist, so it self-heals through
the direct-`node` dispatch alone once node_modules exists.

## Sites to edit

`mise.toml` and `CLAUDE.md` are generated from `mise.no-env.toml` and `AGENTS.md`. Edit the source, then run
`mise run file-enforcer` (`bun packages/dev-script/file-enforcer/src/cli.ts`).

- `mise.no-env.toml` `task_templates."lint:types"`, `task_templates."lint:oxlint"`, `tasks."format:oxlint"`: direct
  dispatch (plus the config-oxlint guard for the two oxlint sites).
- `mise.no-env.toml` `tasks."prepare:pnpm:install"`: raw `pnpm install`. `tasks."fix:reinstall"`: raw `pnpm install`.
- `mise.no-env.toml` `tasks.prepare`: serialize so `prepare:pnpm` precedes the other `prepare:*` children.
- `mise.no-env.toml` `tasks."prepare:playwright"`: dispatch `task-depends`.
- `packages/webapp-productivity/done-postcss/mise.toml` and `packages/webapp-content/messages-demo/mise.toml`
  `build:css`: dispatch `build-css`.
- The five hardcoded `task-oxlint` package files: route them through the same factored dispatch (and config guard),
  or fold them back into the template if their flag differences allow.
- `packages/build-tool/css/tsdown.node.config.ts` and `packages/dev-script/task-util/tsdown.node.config.ts`: update
  the bin notes that currently say `package.json#bin` must resolve to built files.

Audit every active `packages/*/*/mise.toml` for any other workspace-bin invocation before declaring the site list
complete.

## Migration-aligned extras (optional, not required for the fix)

- Flip the `bun` shebangs to `node` on the task-util and build-tool-css source CLIs. The direct-`node` dispatch does
  not need this (it ignores the shebang), but it matches the bun migration and is required if anyone executes those
  files directly or via a shim.
- Optionally add `task-*-ts` bin entries pointing at `src/*.ts`, so a human on a fresh tree has a working command to
  type. mise's own path does not depend on them.

## Verification plan (throwaway worktree, documented boundary)

Verify at the user boundary on a disposable fixture, exercising the documented bootstrap, not an invented sequence.

1. `git worktree add` a scratch worktree on the change branch (do not mutate the real checkout).
2. From zero node_modules, run `mise run prepareAndBuild`. It must complete: `prepare:pnpm:install` runs raw `pnpm`,
   no `task-*` or `build-css` invocation fires before install, and the full build finishes (`build:css` included).
3. After that bootstrap, run `mise run //packages/dev-script/task-util:lint:types`, a package `:lint:oxlint`, and
   `format:oxlint`. All pass; oxlint loads the now-built config.
4. Fresh-install-only regime: in a second scratch worktree, run only `pnpm install`, then `lint:types` before any
   build. It passes through the source dispatch (`config-oxlint` guard builds the config for oxlint sites).
5. Per-bin runtime check: `node packages/dev-script/task-util/src/tsgo-filter.ts --build` and the built
   `node .../dist/final/node/tsgo-filter.mjs --build` both run under the mise-managed Node. Repeat for the other
   entries that bootstrap uses (oxlint-wrapper, pnpm-filter, depends) and for build-tool-css's cli.
6. Fast-path check: after the full build, confirm the dispatch routes to the built `.mjs` (the file exists) and that
   it executes, with no second `pnpm install` required.

Avoid the full Rust build; it is unrelated and heavy. Run heavy or host-stressing steps in a container or VM.

## Open considerations

- `prepare:playwright` builds a podman image and needs podman present. Serializing it after install fixes the
  `task-depends`-before-install race, but podman availability on a fresh machine is orthogonal to issue #243 and is
  not solved here.
- Whether to keep `task-pnpm`'s output filtering for non-bootstrap installs via a separate alias, since the bootstrap
  install tasks drop it for raw `pnpm`.
- DRY: use the inline Nushell command definition from root mise vars. Copying the built/source branch into each task
  remains the wrong shape.

## Evidence

- README.md: documented bootstrap is `mise run prepareAndBuild`.
- `mise.no-env.toml`: `config_roots`; `vars.fanout` (parallel `:::`); `tasks.prepare` extends the parallel template;
  `tasks."prepare:pnpm:install"` runs `task-pnpm install`; `tasks."prepare:playwright"` runs `task-depends`;
  `tasks.build` is `mise '//packages/...:build'` with no inter-package ordering; `unix_default_inline_shell_args`;
  the `test:unit` template's use of `MISE_MONOREPO_ROOT`.
- `packages/dev-script/task-util/package.json`: six `bin` entries pointing at `dist/final/node/*.mjs`.
- `packages/dev-script/task-util/src/oxlint-wrapper.ts`: spawns plain `oxlint`.
- `packages/build-tool/css/package.json`: `build-css` points at `dist/final/node/cli.mjs`; source CLI shebang is bun.
- `packages/webapp-productivity/done-postcss/mise.toml`, `packages/webapp-content/messages-demo/mise.toml`: both call
  `build-css`.
- Hardcoded `task-oxlint`: `packages/oxlint-plugins/stylistic`, `packages/webapp-productivity/doodle-widget`,
  `packages/pi/morph-compact`, `packages/figma-parsers/penpot`, `packages/cli/git-clone-size`.
- `packages/config/typescript/tsconfig.options.json`: `erasableSyntaxOnly`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`.
- `oxlint.config.ts` and `packages/config/oxlint/package.json`: root imports the built default export.
- pnpm relink behavior: reproduced under pnpm 11.5.2 in a throwaway workspace (Phase 2 did not relink; Phase 3, after
  recreating node_modules, did).
