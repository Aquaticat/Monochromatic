# Publish every importable workspace package to pnpr

## Purpose

Carry the 2026-09-15 overnight request across sessions:
every workspace package that is meant to publish but cannot publish as-is
gets a GitHub issue and the minimum changes that land it on
`https://pnpr.c.aquati.cat/`,
with those changes documented in its issue.
The owner wants to wake up to every such package on pnpr.

Registry design and prior state:
[the private registry decision](../decision/private-npm-registry.md).

## Requirements from the owner

- One GitHub issue per blocked package,
  with the changes documented in that issue.
- Minimum set of changes per package.
- "Intended to be published" means the package exposes something others can import
  (owner correction, 2026-09-15):
  apps such as `desktop-daemon-hall-monitor` and `webapp-productivity-doodle-widget`
  expose nothing importable and do not count.
- Keep this handover current after every step.

## Measured starting state

`package/config/pnpr/config.yaml` lists 121 of 155 workspace packages;
the pnpr-publish run 34918649436 reported `0 of 121 package versions are missing`.
The 34 unlisted packages,
from a scan of every `package/*/*/package.json` against the config list:

### Blocked and importable (in scope)

- `@monochromatic-dev/cli-markdown-lint`:
  no `version`;
  exports `.` from `dist/final/node` and a `markdown-lint` bin.
- `@monochromatic-dev/config-oxlint`:
  no `version`;
  exports `.` from `dist/final/node`.
- `@monochromatic-dev/config-stylelint`:
  no `version`;
  exports `./index.mjs`.
- `@monochromatic-dev/module-dom`:
  exports only `./ts` and `./ts/*`,
  which publishing strips,
  so the tarball would expose nothing.

### Not intended to publish (out of scope)

- Apps exposing nothing importable:
  `desktop-daemon-hall-monitor`,
  `webapp-productivity-doodle-widget`,
  `ssg-aquati.cat`,
  `webapp-productivity-done`,
  `webapp-productivity-done-postcss`.
- Deployment or machine configuration without exports:
  `config-cosign`,
  `config-dotfiles`,
  `config-pnpr`.
- `config-tofu`:
  its `./ts/*` export maps OpenTofu external data-source scripts
  (`src/fetch_ips.ts`,
   `src/resolve_hosts.ts`)
  that `hetzner.tf` runs;
  no workspace file imports the package.
  Judgment call:
  treated as infrastructure,
  not a library.
- `intellij-plugin-islands-black`:
  a JetBrains theme jar without JavaScript exports.
- `runtime-error-bun`:
  standalone error-trigger scripts without exports.
- Test sidecars without exports:
  `module-css-edit.bench`,
  `module-css-edit.conformance`,
  `module-css-edit.fuzz`,
  `module-jsonc-edit.bench`,
  `module-jsonc-edit.conformance`,
  `module-jsonc-edit.fuzz`,
  `module-logger.fuzz`,
  `module-toml-edit.fuzz`.
- The 11 packages under `package/test-fixture/`.

## Known hazards

- Adding names to `config.yaml` triggers both the Coolify redeploy
  (watch path `package/config/pnpr/**`)
  and the pnpr-publish workflow.
  If the workflow publishes before the registry reloads its trust list,
  the new names fail;
  re-dispatch with `gh workflow run pnpr-publish.yml --raw-field only='<names>'` from the repository root.
- `config-stylelint`'s `files` omits `property-disallowed-list.mjs` and `unit-disallowed-list.mjs`,
  which `index.mjs` may import;
  verify the packed tarball imports before publishing.

## Status

- [x] Issues opened:
      #522 `cli-markdown-lint`,
      #523 `config-oxlint`,
      #524 `config-stylelint`,
      #525 `module-dom`.
- [x] Manifest fixes committed in `cb4368eca`:
      `"version": "0.0.1"` for the three unversioned packages;
      `config-stylelint` `files` gained `property-disallowed-list.mjs` and `unit-disallowed-list.mjs`
       and its two example names were corrected;
      `module-dom` exports `.` from `dist/final/neutral` and ships `dist/final`.
- [x] Packed through the publish job's own `buildIfDeclared` and `packForPnpr`
      and installed with npm into a throwaway consumer routed to pnpr.
      All four root exports import;
      `markdown-lint bad.md` reports `MD001`;
      `stylelint bad.css` with the published config reports `color-named`,
       a rule `stylelint-config-standard` does not set.
      A dry-run pack of the pre-fix `config-stylelint` manifest listed only `index.mjs`,
       `README.md`,
       `package.json`,
       and licenses.
- [x] Config regenerated (125 of 155) and pushed in `2f9ed715d`;
      exclusion reasons now record both apps as exposing nothing importable.
- [x] Published.
      Run 34922532212 published `module-dom@0.0.1`
       and got `E403` for the other three at 02:48:23 to 02:48:29,
       while the Coolify redeploy was still loading the new trust list.
      Re-dispatched run 34922635675 reported `3 of 125 package versions are missing`
       and published all three,
       so pnpr serves every one of the 125 listed packages.
- [x] A fresh npm consumer without any pnpr credential
      (the only token in npm config is scoped to `registry.npmjs.org`)
      installed all four from `https://pnpr.c.aquati.cat/~monochromatic-dev/`,
      imported every root export,
      got `MD001` from the `markdown-lint` bin,
      and got `color-named` from Stylelint extending the published config.
- [x] Issues #522 to #525 carry the applied changes and verification and are closed.

Local-state note:
packing locally needed
`pnpm_config_dedupe_direct_deps=false pnpm install --force --filter <the four packages>`
(otherwise `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`),
which made file-enforcer add their `node_modules/.bin` paths to root `mise.toml`;
that diff is left uncommitted because it reflects local install layout, not this change.

## Unrelated work finished in the same session

- Changesets `version` job runs the dependent ripple
  (commits `013b460b4`,
   `451a6259d`,
   `de75c43a7`).
- cli-git added-path fixtures for merge,
  cherry-pick,
  and revert conclusions and for interrupted-commit recovery
  (commit `a37690a0d`);
  both recovery worktree-install calls were ablated in turn and the packed fixture failed each time.
- Owner action still pending:
  run `git cli-git trust` in the repository so `mono/dependent-version-bump` activates locally.

## Next action

None for this request;
it is complete.
Open follow-ups for the owner:

- Run `git cli-git trust` so `mono/dependent-version-bump` activates locally.
- Issue #521 (installability of every published package) is still open,
  deferred by the owner's earlier verification choice.

Done after the rollout:

- `fad49abcc` makes `pnpr-publish` retry `E403` every 20 seconds for 5 minutes from run start
  (`package/config/pnpr/src/publish-retry.ts`),
  so adding a package no longer needs a manual re-dispatch.
  Unit tests cover success,
  one retry,
  a non-`E403` failure,
  the deadline cap,
  and an expired window;
  removing the `E403` guard failed the non-`E403` test (`expected 2 to equal 1`).
  Run 34923170225 loaded the new code and reported `0 of 125 package versions are missing`.
  The retry path itself has not met a live `E403` yet;
  the next package added to `config.yaml` is its first real exercise.
- The root `mise.toml` noise came from three empty `node_modules/.bin` directories the forced relink left behind;
  a normal `pnpm install` did not remove them.
  Removing the empty directories and rerunning `mise run file-enforcer` left `mise.toml` clean.
