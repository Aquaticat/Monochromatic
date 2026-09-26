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
- Whether any current build already emits `UNRESOLVED_IMPORT`
  (subagent running in a throwaway worktree).
- The oxlint wrapper's exit and output contract,
  and which caller misread the failure.
- Whether a post-merge or post-checkout hook, or pnpm's own dependency verification,
  can keep install state current.

## Commits

- This handover only.
