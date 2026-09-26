# Handover: config-oxlint stale plugin bundle (issue #570)

## Status (2026-09-25, grilling in progress, no code changed)

Issue:
 [#570](https://github.com/Aquaticat/Monochromatic/issues/570).
The user asked to resolve it,
then asked for a grilling session before any code change.

Next action:
 finish fact gathering,
 then ask the reframed design-tree questions under "Open questions".
No code edits until the user confirms shared understanding.

## Requirements from the user

- Grill the design before editing code.
- Do not plainly adopt the issue's framing or its listed remediations;
  look for fixes that dissolve the failure instead of patching one link.
- The first round of questions (which of the issue's remediations to do,
  and where a rolldown build guard lives) was rejected as unanswerable as posed.

## Rejected framing

Asking "which of the issue's remediations (build guard, wrapper guidance, post-build import check)"
and "shared versus local build guard" presupposes the issue's framing
that the bundler step is the thing to fix.
The user rejected that round.

## Evidence gathered

### Rolldown behavior (installed 1.2.9, catalog `>=1.2.5` in `pnpm-workspace.yaml`)

- An unresolved bare specifier emits `UNRESOLVED_IMPORT` as a warning
  and is kept as an external import;
  the build exits 0
  (upstream `crates/rolldown/src/module_loader/resolve_utils.rs` lines 118 to 143 at tag v1.2.9).
- Path-like unresolved specifiers are hard errors already.
- No strict mode;
  `checks.unresolvedImport` only silences;
  no `logLevel` value makes it an error.
- The input option `onLog` can escalate with `defaultHandler('error', log)`;
  a subagent probe showed `rolldown -c` then exits 1,
  with a positive control (non-matching filter exits 0 and emits the bare import).
- Log fields:
  `log.code`,
  `log.id` (importer path),
  `log.exporter` (unresolved specifier).
  `log.message` carries ANSI codes,
  so filter on fields.

### Repo structure

- `dist/` is gitignored (`.gitignore` line 53),
  so `package/config/oxlint/dist` is a local build artifact,
  not committed.
  The issue's "committed-to-disk" wording means "present on disk".
- The root `oxlint.config.ts` imports the built default export
  `@monochromatic-dev/config-oxlint`
  (`package/config/oxlint/package.json` `exports["."]` points at `dist/final/node/index.mjs`).
- `package/config/oxlint/src/index.ts` is an existing source entry (`./ts` export)
  that resolves plugin `/ts` source via `import.meta.resolve()`
  so in-repo linting tracks live source with no rebuild.
  The root config does not use it.
- `package/config/oxlint/src/index.node.ts` says the prebuilt sidecars
  avoid plugin resolution at lint time,
  an optimization tracked in issue #238
  (not yet read;
   `gh` hit a TLS timeout).
- All three shared rolldown flavors
  (`package/config/rolldown/src/index.ts`,
   `index.client.ts`,
   `index.node.ts`)
  use `packageExternals`,
  which bundles undeclared bare imports by omission,
  so every flavor shares the silent-external weak point.
- `config-oxlint` has no `version` and is not published yet;
  publishing is tracked by #523
  (`doc/handover/pnpr-publish-remaining-packages.md`).
- `mise.toml` has `prepare:pnpm:install` (`pnpm install`);
  build tasks do not depend on it.

### Existing freshness check backfires (verified by reading `mise.toml` lines 374 to 421)

- `lint:oxlint` and `format:oxlint` templates call `ensureOxlintConfig()`,
  which rebuilds `//package/config/oxlint:build:js:node`
  when `shouldBuildOxlintConfig()` finds a source newer than the oldest sidecar.
- Sources are `src`, `package.json`, `tsconfig.json`, `rolldown.node.config.ts`
  of `config-oxlint` and each `package/oxlint-plugin/*`,
  plus `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- In the #570 sequence:
  a merge or `pnpm install --lockfile-only` touches `pnpm-lock.yaml`;
  the next lint rebuilds before install,
  producing the broken bundle now newer than every source;
  a later `pnpm install` touches none of those sources,
  so the check never rebuilds again.
  This is why "install did not help" in the issue.
- Second hole:
  transitively inlined workspace packages
  (for example `package/module/logger` source)
  are not in the source list,
  so editing them never rebuilds the sidecars either.

### Install freshness (subagent report, not re-verified except where noted)

- No git hook or cli-git post-action runs `pnpm install`;
  hk is retired (`doc/decision/cli-git-policies-platform.md` line 870);
  `.git/hooks` holds only Git LFS shims.
- pnpm `verifyDepsBeforeRun` only fires on `pnpm run` and `pnpm exec`,
  which repo tasks never use (CM3).
- `node_modules/.pnpm/lock.yaml` is pnpm's record of the last installed lockfile;
  comparing it with `pnpm-lock.yaml` detects "lockfile changed, not installed".
  Every install rewrites its mtime.
- No-op `pnpm install --frozen-lockfile --offline` measured 0.39 s then 0.21 s
  (two runs, no spread band),
  and relinks six packages every run (cause not investigated).
- mise native `sources`/`outputs` exist; no repo task uses them.
  `task-util` `depends` helper is used only by `prepare:playwright`.

### Consumers, reproduction, wrapper (subagent report; starred items re-verified)

- No rolldown config in the repo sets `onLog`, `onwarn`, or `checks`.
  All three shared factories build from one base object
  (`package/config/rolldown/src/index.node.ts` `baseOptions`,
   `index.ts`,
   `index.client.ts`),
  so one `onLog` there reaches every consumer.
- With dependencies installed,
  `//package/config/oxlint:build` emits no `UNRESOLVED_IMPORT`.
- Issue #570 reproduced in a throwaway worktree:
  after removing the plugin's `module-logger` link,
  rolldown printed
  `[UNRESOLVED_IMPORT] Could not resolve '@monochromatic-dev/module-logger/ts' ... treating it as an external dependency`,
  exited 0,
  and oxlint then failed to load the config.
- A fresh-worktree full `mise run build` printed `UNRESOLVED_IMPORT` only from
  raw (non-`config-rolldown`) electron main configs
  and from `package/kwin/key-helper/src/nvim.ts` line 19 (starred),
  which imports bare `@monochromatic-dev/module-async-time`
  instead of the `/ts` subpath (ST3),
  so it depends on sibling dist build order.
  The full build also exited 1 partway with no error line (not investigated).
- Starred:
  `~/temp/agent/node_modules/@monochromatic-dev/module-logger` is a stray symlink (dated Sep 23)
  to the main checkout;
  any worktree under `~/temp/agent` resolves `module-logger` through it,
  masking this bug in reproductions.
- Starred:
  `package/oxlint-plugin/no-restricted-syntax/package.json` lists `module-logger`
  as a devDependency (the issue calls it "declared");
  workspace code is bundled at build time,
  so dev classification is consistent with the bundling policy.
- Wrapper source:
  `package/dev-script/task-util/src/oxlint-wrapper.ts`;
  `finalizeResult` keeps oxlint's exit code.
  oxlint 1.85.0 prints the config-load failure block on stdout, not stderr.
  The wrapper has no test;
  `oxlint-augment.ts` holds testable pure helpers.

## Reframed failure chain

These are separate links;
a fix at an earlier link can make later ones moot:

1. Install state drifts from manifests (merge without `pnpm install`).
2. The bundler silently turns an unresolvable workspace import into an external.
3. In-repo lint consumes a gitignored build artifact whose freshness nobody tracks
   against its inputs (source and installed dependencies),
   so `pnpm install` alone cannot repair it.
4. The lint wrapper exits 1 with no findings,
   and a caller that filters output for diagnostics reads that as clean.
   Per `AGENTS.md` XIC this is a separate incident until boundaries match.

Candidate dissolutions under investigation:

- In-repo lint uses the `./ts` source entry,
  removing link 3 for in-repo use;
  cost is the #238 lint-time optimization,
  which must be measured before it is weighed.
- Tie builds (or lint) to install freshness,
  removing link 1 for every tool, not only rolldown.
- Track `config-oxlint` build freshness via task sources/outputs
  (the `task-util` `depends` helper already supports `--sources`/`--outputs`).

## Open questions (pending facts)

- Measured lint wall time: built sidecars versus `./ts` source entry.
- What #238 decided and why.
- Round 2 (2026-09-25) user answers:
  build guard scope and wrapper behavior are premature, do not decide yet;
  the stray `~/temp/agent/node_modules/@monochromatic-dev/module-logger` symlink
  was removed as instructed
  (`~/temp/agent/node_modules/.monochromatic` left untouched).
- The user partially blames pnpm and mise;
  both get their own investigations
  (troubleshooting docs `doc/troubleshooting/pnpm-stale-node-modules-detection.md`
   and `doc/troubleshooting/mise-dependency-freshness.md`, subagents running).
- Lint wall time,
  built sidecars versus `./ts` source entry (subagent running).

## Commits

- This handover only.
