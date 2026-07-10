# Restore config-oxlint declaration bundling with TypeScript 7

## Status

Diagnosis complete and repair strategy comparison in progress on 2026-07-09.

The failing surface is
`mise run //packages/pi-plugins/auto-mode:lint:oxlint`.
The failure occurs before oxlint starts,
while the lint task refreshes the shared built oxlint configuration.
rolldown-plugin-dts 0.27.2 introduced the regression;
upstream 0.27.4 provides the verified generator selector needed for the durable repair.
No repair has been implemented in the main worktree.

## Goal

Restore package-scoped oxlint tasks on a fresh or stale checkout without weakening declaration generation,
without requiring developers to prebuild the three oxlint plugin packages manually,
and without making the generated oxlint configuration depend on untracked build state.

The implementation must preserve these existing behaviors:

- `ensureOxlintConfig()` rebuilds the shared configuration when any bundled oxlint package source is newer than its outputs.
- `packages/config/oxlint/dist/final/node/index.mjs` and its three plugin sidecars remain self-contained.
- Source exports under each plugin package's `/ts` subpath remain usable for in-repository development.
- Package builds and lint tasks continue to run through mise.

## Observed task chain

The current task graph is:

1. `packages/pi-plugins/auto-mode/mise.toml` extends the root `lint:oxlint` task template.
2. The template in `mise.toml` calls `ensureOxlintConfig()` before invoking the oxlint wrapper.
3. `ensureOxlintConfig()` considers source and configuration files from `packages/config/oxlint` and every package under
   `packages/oxlint-plugins`.
4. A missing or stale output triggers
   `mise run //packages/config/oxlint:build:js:node`.
5. `packages/config/oxlint/tsdown.node.config.ts` builds one config entry and three plugin sidecar entries.
6. Each sidecar re-exports a plugin package's TypeScript `/ts` source subpath so the JavaScript bundle can inline it.
7. Declaration generation fails for the external plugin package `src/index.ts` files before the lint process starts.

## Evidence collected

The lockfile currently resolves:

- TypeScript `7.0.1-rc`.
- tsdown `0.22.4`.
- rolldown-plugin-dts `0.27.2`.

Commit `797061b59ea222281a19d89ccbad6200ea526a70` updated only `pnpm-lock.yaml` and moved
rolldown-plugin-dts from `0.27.1` to `0.27.2`.
The update added TypeScript 7 to the plugin's peer range.

rolldown-plugin-dts `0.27.2` selects its `tsgo` path when the installed TypeScript major version is 7.
Its generated `dist/index.mjs` does the following:

- Runs tsgo once with the current tsconfig,
  a temporary output directory,
  and `rootDir` set to the tsconfig directory.
- Registers every TypeScript module traversed by the JavaScript bundle in a declaration map.
- For every registered module,
  expects tsgo to have emitted a corresponding declaration into the temporary directory.
- Throws `tsgo did not generate dts file for <source>` when that expected file is absent.

`packages/config/oxlint/tsconfig.json` extends the shared configuration whose `include` paths are scoped through
`${configDir}` to the consuming package.
The three plugin source files reported by the failure are outside that package directory.
The user-provided TSFILE list contains declarations for `packages/config/oxlint` files,
but none for the three external plugin package entry files.

An independent reproduction ran at commit `ebc4a04d3c02e7dbe2c4268d14846566749a4d1d`
in a disposable Git worktree.
The minimized command was:

```sh
mise run //packages/config/oxlint:build:js:node
```

It failed on two consecutive runs with the same three missing declaration paths.
The complete user-facing command also reproduced independently:

```sh
mise run //packages/pi-plugins/auto-mode:lint:oxlint
```

The full task reached `ensureOxlintConfig()`,
ran the minimized command,
and propagated its nonzero exit before invoking the oxlint wrapper.
The failing build wrote declarations for the config-oxlint project into a fresh temporary directory on every run,
but did not write declarations for the three plugin package entry files.

The differential probes confirmed an upstream option-resolution regression:

- rolldown-plugin-dts 0.27.1 passed the aggregate build under the original config.
- rolldown-plugin-dts 0.27.2 failed the aggregate build under the original config.
- A package-local stylistic plugin build passed under 0.27.2,
  disproving a broad TypeScript 7 incompatibility.
- Explicit `oxc: true` under 0.27.2 failed with the plugin's unconditional
  `TypeScript 7.0 is installed, but the tsgo option is disabled` error.
- rolldown-plugin-dts 0.27.4 passed the aggregate build under both inferred and explicit Oxc selection.
- Explicit Oxc selection through the shared Node and neutral presets also passed representative package builds,
  type lint,
  and oxlint.
- Rebuilt tracked artifacts were byte-identical to their pre-regression Oxc output.

The complete source trace,
version catalog,
and upstream-filing decision are recorded in
`docs/troubleshooting/rolldown-plugin-dts-typescript-7-generator.md`.

## Hypothesis results

1. **Confirmed:** rolldown-plugin-dts 0.27.2 chooses tsgo before reading inherited `isolatedDeclarations`.
   Tsgo emits the package tsconfig project,
   while Rolldown later requests declarations for external workspace source modules included by the JavaScript bundle.
2. **Rejected as a repair:** an aggregate declaration tsconfig would model Rolldown's dynamic bundle graph as a static
   TypeScript project.
   Upstream 0.27.4 instead restores the repository's per-module Oxc path without coupling config-oxlint to transitive
   source directories.
3. **Rejected as a repair:** consuming prebuilt plugin declarations adds build-order and freshness dependencies that
   the current source-driven sidecars intentionally avoid.
   The 0.27.4 Oxc path preserves source inlining and requires no plugin prebuild.
4. **Disproved:** TypeScript 7 is not broadly incompatible with repository declaration settings.
   Package-local 0.27.2 builds pass,
   and Node plus neutral builds pass under the explicit 0.27.4 Oxc generator.

## Investigation procedure

All mutating reproduction and build probes belong in a disposable Git worktree.
The main worktree contains unrelated concurrent changes and must retain them untouched.

1. Reproduce the original lint-triggered build failure twice in the disposable worktree.
2. Tighten the feedback loop to the config-oxlint build task.
3. Run a representative plugin package build as the within-package control.
4. Compare rolldown-plugin-dts `0.27.1` and `0.27.2` with all other inputs held constant.
5. Capture tsgo's exact command and temporary output tree under the plugin's debug namespace.
6. Test one variable at a time for each viable consumer-side fix:
   declaration project scope,
   declaration engine selection if supported,
   sidecar dependency boundary,
   and dependency pinning.
7. Inspect rolldown-plugin-dts and tsdown primary source plus upstream issue and release history before deciding whether
   the behavior is an upstream defect or a documented constraint.

## Fix options awaiting verification

### Keep 0.27.2 and supply a declaration project spanning bundled source

Pros:
keeps current dependency resolution and TypeScript 7 support;
retains direct source bundling.

Cons:
may require a specialized build tsconfig;
could couple config-oxlint to every bundled package path;
may conflict with package-scoped path aliases or root placement.

### Keep 0.27.2 and select another supported declaration engine

Pros:
can preserve the existing package graph with a narrowly scoped tsdown configuration change.

Cons:
may be unsupported when TypeScript 7 is installed;
could bypass TypeScript 7 behavior intentionally selected by the plugin;
requires upstream source and runtime verification rather than an assumed option.

### Pin rolldown-plugin-dts 0.27.1

Pros:
small dependency-level rollback;
likely restores the immediately preceding behavior if the differential probe passes.

Cons:
the prior version does not declare TypeScript 7 support;
a transitive override adds maintenance burden;
postpones rather than resolves compatibility with the new declaration path.

### Build plugin packages first and consume built package exports

Pros:
creates explicit package build boundaries;
the aggregate package no longer asks one declaration project to emit external package source.

Cons:
adds build-order dependencies to a lint prerequisite;
requires generated plugin artifacts to be present and fresh;
works against the current design goal of source-driven inlining without manual prebuilds.

No option is selected until the probes establish which ones actually work.
Any remaining choice between verified approaches will be put to the user one decision at a time.

## Planned implementation shape

This section will be replaced after diagnosis and user decisions.
A complete implementation plan must name:

- Exact files and symbols to change.
- Dependency and lockfile regeneration steps,
  if applicable.
- A regression test or deterministic build fixture that fails on the current state and passes with the repair.
- Package-scoped lint,
  type-check,
  build,
  and end-user oxlint invocation checks.
- Generated artifact expectations and freshness behavior.
- Troubleshooting documentation required by the external-tool investigation.
- Rollback criteria if the selected declaration path changes upstream.

## Acceptance criteria

The eventual implementation is complete only when:

- The minimized reproduction is green.
- `mise run //packages/config/oxlint:build:js:node` succeeds from a fresh-output fixture.
- `mise run //packages/pi-plugins/auto-mode:lint:oxlint` reaches and completes oxlint successfully.
- Each affected package's type lint passes with zero warnings or errors.
- A representative built config can be loaded by Node and passed to the real oxlint wrapper.
- Editing a bundled plugin source makes `ensureOxlintConfig()` rebuild the shared outputs.
- No manual plugin prebuild is needed unless the selected architecture explicitly adopts and tests that dependency.
- Generated output changes are intentional and enumerated.
- The final plan and troubleshooting document match verified behavior.
