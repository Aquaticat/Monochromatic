# Private npm registry for unpolished packages

Status:
 grilling in progress (started 2026-09-14);
 nothing implemented.
Owner decisions are recorded here as they land;
 this file is canonical for the effort.

## Goal

Publish `@monochromatic-dev/oxlint-plugin-tsdoc`,
 `@monochromatic-dev/config-typescript`,
 and `@monochromatic-dev/module-or-throw`
 somewhere another owner project can install them with pnpm.
The owner judges them below public-release quality.
The Hetzner server managed by Coolify is available but not a constraint.

Scope widened by the owner on 2026-09-14:
 the registry immediately reflects every change of every workspace package,
 not only those three.

## Measured facts (2026-09-14)

- `Aquaticat/Monochromatic` is public on GitHub (`gh repo view`),
   so a separate registry buys unlisting and version freedom,
   not source confidentiality.
- `@monochromatic-dev/module-logger` is already public on npmjs (`0.1.0` to `0.4.0`,
   maintainer `aquaticat`),
   released through changesets and trusted publishing per `doc/decision/npm-publishing.md`.
- All three target packages are in the `ignore` list of `.changeset/config.json`.
- A scoped `.npmrc` route (`@monochromatic-dev:registry=`) sends the whole scope to one registry,
   so a second registry must proxy npmjs for the scope
   or consumers lose access to the npmjs-published scope members.
- `oxlint-plugin-tsdoc`:
   - `dist/final/node/index.mjs` imports only `@oxlint/plugins` at runtime;
      `oxlint-plugin-shared` and `ownership-marker-foreign-borrowed` are bundled.
   - `dependencies` still lists both bundled workspace packages,
      which `pnpm pack` would rewrite to `0.0.1` versions no registry serves.
   - `dist/final/node/index.d.mts` imports `defineConfig` from `oxlint`,
      which the manifest does not declare.
- `module-or-throw` has no runtime or declaration imports.
- `config-typescript` is JSON only,
   extends only its own files,
   and is `"private": true`,
   which blocks publishing.
- No `package.json` within depth 4 of the home directory,
   outside Monochromatic worktrees and scratch clones,
   references any of the three packages.
- The consumer is `Aquaticat/labwc-config` (public).
   At `ca229f1` it holds shell scripts,
    Python helpers,
    libvirt XML,
    and labwc configs;
   it has no `package.json`,
    no TypeScript,
    and no `.github/workflows`.
   The local checkout is `~/labwc-vm-test`.
- pnpm `12.3.4` (the version `mise.toml` resolves from `pnpm = "latest"`)
   routes a single dependency to another registry:
   `pnpm-workspace.yaml` declares `registries: { <url>: { prefix: <name> } }`
   and the manifest specifier is `<name>:@scope/pkg@<range>`.
   Probe:
    `mirror:@monochromatic-dev/module-logger@^0.4.0` installed through `https://registry.npmmirror.com/`;
    pointing the same prefix at `https://registry.invalid/` failed metadata fetch for that package only.
   Lockfile keys become registry-qualified (`@monochromatic-dev/module-logger@mirror:0.4.0`).
   Docs: https://pnpm.io/settings/dependency-resolution (`registries`, `prefix` since 11.23.0).
- Workspace size (`pnpm list --recursive --depth -1 --json`):
   154 packages under `package/` plus the root;
   120 are `"private": true`.
   Categories include `test-fixture` (11 packages),
    `webapp-productivity` (6),
    and `desktop-app` (3).
- Publish volume for one week of `main` (2026-09-07 to 2026-09-13,
   script `publish-volume.ts` in the session scratchpad,
   commits from `git log --name-only`):
   - 328 commits,
      of which 75 touched a workspace package directory.
   - Republishing only directly touched packages:
      111 publishes.
   - Adding every dependent through `dependencies`,
       `peerDependencies`,
       and `optionalDependencies`:
      449 publishes.
   - Adding dependents through `devDependencies` as well:
      3216 publishes,
      up to 131 packages in one commit;
      `config-typescript` has 140 transitive dependents that way
       and `module-logger` has 130.
- Daily commit counts on `main` that week peaked at 172 (2026-09-09).
- `pnpm add 'mirror:@monochromatic-dev/module-logger@^0.4.0'` fails on `12.3.4` with `ERR_PNPM_INVALID_DEPENDENCY_NAME`
   (`dependency with an invalid name: "mirror:"`),
   although the docs show `pnpm add work:@corp/lib@^2.0.0`;
   writing the specifier into `package.json` and running `pnpm install` works.

## Settled decisions

- Registry:
   a registry other than npmjs
   (owner chose it over public npmjs at 0.x and over tarball URLs).
- Install environments:
   owner dev machine,
   GitHub Actions CI,
   and another owner machine such as `m1`;
   not a Coolify build.
   Consequence:
   the registry must be reachable from GitHub-hosted runners.
- Publish cadence (superseded 2026-09-14):
   automatic snapshot per push that touches a package
   (owner chose it over changesets releases and manual local publish).
   Replaced by the change-detection decision:
   versions change only by manual bumps.
- Consumer:
   `Aquaticat/labwc-config`.
- Read access:
   anonymous install;
   publishing still authenticates
   (owner chose it over token-gated install).
- Budget:
   no new spend;
   the already-paid Hetzner server and free tiers qualify.
- Scope routing:
   consumers route the whole `@monochromatic-dev` scope to the private registry,
   which proxies npmjs for scope members it does not hold
   (owner chose it over pnpm `prefix` specifiers and over a proxy-less scope route).
   Consequence:
   the registry product must support an npmjs uplink for the scope.
- Package set:
   every workspace package except the 11 under `package/test-fixture/`,
   private ones included
   (owner chose it over all 154 and over only the 35 non-private).
   npm packages only;
   Rust crates and Kotlin artifacts keep their own pipelines.
- Trigger:
   a GitHub Actions workflow on each push to `main`
   (owner chose it over a local post-commit hook plus CI and over a working-tree watcher).
- Refs:
   `main` only
   (owner chose it over per-branch dist-tags).
- Change detection:
   a package republishes only when its `package.json` `version` changes by a manual bump
   (hand edit or changesets);
   CI on `main` publishes every version the private registry lacks.
   Owner chose it over CI-computed snapshot versions and committed automatic bumps,
    knowingly dropping "every change is reflected";
   "immediately" now means as soon as a bumped version lands on `main`.
   Rejected along the way:
    tarball content diff,
    runtime dependency ripple,
    and directly touched packages as republish triggers.
- Consumer scope:
   publish side only;
   verification installs from a throwaway consumer,
   and `labwc-config` stays untouched
   (owner chose it over full and minimal consumer wiring).

## Adopted without asking (veto welcome)

- Packaging fixes land regardless of registry:
   bundled workspace packages move to `devDependencies`
   (the rule in `doc/decision/npm-publishing.md`),
   `oxlint` becomes a peer dependency of `oxlint-plugin-tsdoc`,
   and `config-typescript` drops `"private": true`.
- Published versions are immutable:
   a version already in the registry is never overwritten.
- The first workflow run publishes the current version of every package in the set,
   since all of them are missing from a new registry.
- The publish step removes `"private": true` from the packed manifest,
   because `npm publish` refuses private packages.
- Publishing runs in dependency order;
   a package that fails to build blocks itself and its dependents,
   the rest still publish,
   and the run reports failure.
- `latest` moves only when the published version is greater than the current `latest`.

## Open questions

- Overlap with `.github/workflows/npm-release.yml`,
   which publishes to npmjs any non-private,
    non-ignored package version missing there
   and runs on pushes that change `**/package.json`:
   which registry holds bumped versions of the npmjs-released packages.
   Today those are only `module-logger` (manifest `0.4.0`,
    npmjs `0.1.0` to `0.4.0`)
   and `module-fs-path` (manifest `0.2.0`,
    npmjs `0.1.0` and `0.2.0`);
   the other 33 non-private packages are in the changesets `ignore` list.
- Bump mechanism,
   and whether dependents of a bumped package must bump too
   (a published `workspace:*` pin freezes at pack time).
- Registry product and host (registry options research running,
   briefed before the scope widened).
- How the consumer picks up new snapshots.
- Snapshot version format and retention.
- CI publish authentication.
