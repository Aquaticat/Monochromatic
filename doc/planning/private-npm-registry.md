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

## Adopted without asking (veto welcome)

- Packaging fixes land regardless of registry:
   bundled workspace packages move to `devDependencies`
   (the rule in `doc/decision/npm-publishing.md`),
   `oxlint` becomes a peer dependency of `oxlint-plugin-tsdoc`,
   and `config-typescript` drops `"private": true`.
- A snapshot trigger includes changes to anything bundled into the package,
   so `oxlint-plugin-shared` and `ownership-marker-foreign-borrowed` edits republish `oxlint-plugin-tsdoc`.

## Open questions

- Which project consumes the packages.
- Anonymous read or token-gated install.
- Whether consumers also need npmjs-published scope members through the same route.
- Spending tolerance.
- Registry product and host (registry options research running).
- How the consumer picks up new snapshots.
- Snapshot version format and retention.
- CI publish authentication.
