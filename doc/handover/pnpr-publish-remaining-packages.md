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
- Owner decisions (2026-09-15, after the rollout):
  work #521 now,
  and the agent runs `git cli-git trust`.
- Trust:
  `git cli-git trust --yes` succeeded
  (it also accepted the recursive stage `cli-git.config.ts` requests,
   covering repositories beneath the repository root);
  `git cli-git check --policy mono/dependent-version-bump --all` now exits 0,
  while an unknown policy ID still fails with `Unknown built-in policy ID`.
- #521 in progress:
  harness at the session scratchpad `pnpr-521/harness.ts`
  runs in `node:26-slim` with 4 GiB and 4 CPUs.
  Per package it installs from pnpr alone with `npm install --ignore-scripts`,
  checks every export,
  `main`,
  `module`,
  `types`,
  and bin target exists,
  imports each Node-resolvable export,
  resolves bare imports in shipped JavaScript statically,
  and type-checks exports that declare types with `typescript@latest` under `nodenext`,
  keeping only diagnostics in `@monochromatic-dev` files or the check file.
  Smoke run on five packages:
  four clean;
  `config-stylelint` reported `TS7016` only because it ships no declarations,
  so JavaScript-only exports are now a note,
  not a problem.
- #521 run 1 (125 packages):
  97 clean,
  28 flagged.
  Issues and fixes:
  #537 selection ignores `main`/`module` shadowed by `exports` and TypeScript-source `main`,
   `module`,
   and bin targets,
   and tarballs drop TypeScript-source `main`/`module`
   (`517d150f7`;
    ten packages left `config.yaml`,
    125 to 115);
  #528,
   #529,
   #530 dev-script manifests pointed at `.js`/`.d.ts`
   (`02809a5c6`);
  #531 `module-hyperscript` stale `module` (`3e076a2f6`);
  #532 `module-test` ships `@types/sinon` (`c563119ed`);
  #533 `pi-plugin-advisor` declares the `pi-ai` peer (`c27de260f`);
  #534 `pi-shared-model-selection` requires the `pi-coding-agent` peer (`7b5fdccd2`);
  #535 `typeface-aquaticat` gains a `build` task and pnpr-publish installs `uv` (`31566eb0e`).
  False positives,
  no change:
  `config-dprint` (JSON needs an import attribute)
  and `stub-throwing` (throws by design).
- Correction:
  #536 excluded `oxlint-plugin-test-support` as repository-bound (`1ee33b53a`).
  That was wrong:
  it walks up from its install location to any `mise.toml` with `[monorepo]`,
  and it imports inside such a consumer.
  Reverted in `aa17c8b6e`,
  #536 closed as not planned,
  corrective comment on commit `1ee33b53a`.
- Committing the dev-script fix showed `git add` of a hand bump was refused with `dependent-version-stale`
  (pre-forward add cannot apply patches;
   the policy defaults to error).
  `d07b4b54c` limits pre-forward findings to `commit`;
  the packed fixture now stages the bump first (`65e8d8e29`),
  and removing the guard failed it with `git add package/module/base/package.json expected 0, got 1`.
  cli-git re-trusted afterwards so the local bundle carries the change.
- #521 run 2 (114 packages, after publishing):
  104 clean.
  The rest were the two false positives,
  `backup-path` (a command script whose import parses arguments;
   `node dist/final/node/index.mjs --help` prints usage),
  and seven CLI packages whose root import fails but whose surface is a bin.
- Bin check (`pnpr-521/bin-check.ts`,
  every bin run with `--help`,
  39 invocations):
  #538 `dev-script-task-util` and #539 `mcp-mvm` shipped bins without their bundle chunks
   (no `files` list;
    `fcfed6f98`,
    `4417efca8`);
  #540 TypeScript-source bins (`spawn-claude`,
   `watch-restart`) are dropped from tarballs (`9efbd971e`)
   and both packages republished (`d8050e6a8`,
    which rippled the eight `claude-code-plugin-*` packages).
  Environment or design,
  no change:
  hook bins that read JSON from stdin,
  `adb`,
  terminal emulator,
  real `git`,
  or `sudo` requirements,
  tools without `--help`,
  and `deps-cube` needing a `pnpm-workspace.yaml` root.
  Known limitation:
  `claude-code-plugin-source` exports only TypeScript source,
  but stays published because the plugins list it as a runtime dependency.
- Done:
  pnpr-publish run 34927915986 published the 12 republished versions;
  the harness and bin check re-run from pnpr pass for them,
  and `task-oxlint`/`task-pnpm` print usage once `oxlint` and `pnpm` are on `PATH`.
  #521 carries the full results comment and is closed;
  every fix issue carries its applied change and verification.
- Owner decisions (2026-09-15, after #521):
  move `claude-code-plugin-source` to `devDependencies` of the hook plugins;
  leave the seven CLI packages' `main: src/*.ts` until their next bump.
- #543 done:
  the eight plugins list `claude-code-plugin-source` as a dev dependency at 0.0.3 (`c998c1241`),
  and `claude-code-plugin-source` is excluded from pnpr (`b95ffe72a`;
   114 of 155 listed).
  Extending the #537 rule to TypeScript-only exports was rejected:
  it would also drop `ownership-marker-foreign-borrowed`,
  `config-rolldown`,
  and `claude-code-plugin-hook-type`,
  which pass the type check and have runtime dependents.
  From pnpr,
  each plugin installs without `claude-code-plugin-source`
  and each hook bin loads;
  three reject an empty `{}` payload in handler logic
  (`Unhandled terminal-title hook event.` and two missing-field `TypeError`s).
  The first push was rejected by three docs-only commits from another session;
  the unstaged `mise.lock` blocked a rebase,
  so they were merged (`0b073ae6c`).
- Remaining known limitation,
  by owner choice:
  seven CLI packages keep `main: src/*.ts` in their current versions until their next bump.
- Harness scripts lived in the session scratchpad (`pnpr-521/harness.ts`,
  `pnpr-521/bin-check.ts`);
  the method is written out in the #521 results comment for reproduction.

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
