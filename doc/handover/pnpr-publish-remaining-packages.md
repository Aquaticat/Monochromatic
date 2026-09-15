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

- [ ] Issues opened.
- [ ] `cli-markdown-lint` fixed, packed, imported from a throwaway consumer.
- [ ] `config-oxlint` fixed, packed, imported.
- [ ] `config-stylelint` fixed, packed, imported.
- [ ] `module-dom` fixed, packed, imported.
- [ ] Config regenerated and pushed.
- [ ] pnpr-publish run green;
      each new package installs anonymously from pnpr.

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

Open the four issues,
then fix and verify the packages one at a time.
