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
- Publish cadence:
   automatic snapshot per push that touches a package
   (owner chose it over changesets releases and manual local publish).
- Consumer:
   `Aquaticat/labwc-config`.
- Read access:
   anonymous install;
   publishing still authenticates
   (owner chose it over token-gated install).
- Budget:
   no new spend;
   the already-paid Hetzner server and free tiers qualify.

## Adopted without asking (veto welcome)

- Packaging fixes land regardless of registry:
   bundled workspace packages move to `devDependencies`
   (the rule in `doc/decision/npm-publishing.md`),
   `oxlint` becomes a peer dependency of `oxlint-plugin-tsdoc`,
   and `config-typescript` drops `"private": true`.
- A snapshot trigger includes changes to anything bundled into the package,
   so `oxlint-plugin-shared` and `ownership-marker-foreign-borrowed` edits republish `oxlint-plugin-tsdoc`.

## Open questions

- Scope routing:
   owner asked for more detail;
   the pnpm `prefix` probe offers per-dependency routing that needs no npmjs proxy.
- Whether bootstrapping Node tooling in `labwc-config` is part of this effort.
- Registry product and host (registry options research running).
- How the consumer picks up new snapshots.
- Snapshot version format and retention.
- CI publish authentication.
